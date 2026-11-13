// Exact SQL only. The caller must supply a protected-job authority check and one-use journal.
import { createHash } from 'node:crypto';
import { readExactGitHubRelease } from './r4-off-only-github-admission.mjs';
import { buildOffOnlyReviewBundle } from './r4-off-only-review-bundle.mjs';

const ref = 'cnympiwrwgouuvhaivbc';
const fingerprint = '3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const endpoint = 'https://api.supabase.com/v1/projects/' + ref + '/database/query';
const sha = x => createHash('sha256').update(x).digest('hex');
const reviewLine = /^do \$(review|stop|external)\$ begin raise exception '(r4_[a-z_]+)'; end \$\1\$;\r?$/gm;
const expected = Object.freeze({
  install: Object.freeze(['r4_linked_route_review_only','r4_external_authority_unbound',
    'r4_local_canary_candidate_not_authorized','r4_local_storage_fence_not_authorized','r4_issue_commit_fence_review_only']),
  off: Object.freeze(['r4_external_authority_unbound']),
  restore: Object.freeze(['r4_linked_route_review_only','r4_local_issue_fence_restore_not_authorized',
    'r4_local_lesson_restore_not_authorized','r4_external_authority_unbound']),
});
const pins = Object.freeze({
  install: '3e06d71b538e9f072e64433aaa8549e6e2a9e860699e5c090f73294569731493',
  off: '06b8d930275ee7b98d2796a5decd158994f572b1d5a25f0e60967126e204feb0',
  restore: 'e9a8c08e5a7c0b066a326c23433e68e4c156ef85b06e3b49e5bdce06878f366d',
  observe: '91f59db56dd9758b09e1c4acfb8a4ac72361fd1cb5ae54d53f5a8eb4f63dbf79',
});

function exactWrite(kind, sql) {
  if (!/^begin;\r?\n[\s\S]*\r?\ncommit;\s*$/i.test(sql) ||
      JSON.stringify([...sql.matchAll(reviewLine)].map(m => m[2])) !== JSON.stringify(expected[kind]))
    throw Error('R4_SQL_REVIEW_BOUNDARY_DRIFT');
  // No source/template is changed. Only the approved in-memory request is rendered.
  return sql.replace(reviewLine, '-- Exact protected-job approval verified before provider request.');
}

function transport({ sql, readToken, writeToken, claimOnce, authorized, request }) {
  if (sha(ref) !== fingerprint || !sql || Object.keys(sql).length !== Object.keys(pins).length ||
      !Object.entries(pins).every(([k, v]) => typeof sql[k] === 'string' && sha(sql[k]) === v) ||
      typeof readToken !== 'string' || typeof writeToken !== 'string' || readToken.length < 15 ||
      writeToken.length < 15 || readToken === writeToken || typeof authorized !== 'function' ||
      typeof claimOnce !== 'function' || typeof request !== 'function') throw Error('R4_DB_BINDINGS_UNAVAILABLE');
  const fixed = Object.freeze({ ...sql });
  const attempted = new Set();
  const send = async (query, isRead) => {
    const r = await request(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(35000), headers: { Authorization: 'Bearer ' + (isRead ? readToken : writeToken),
        Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ query, read_only: isRead }) });
    if (r.status !== 201 && r.status !== 200) throw Error('R4_DB_REPLY_NOT_CONFIRMED');
    return isRead ? r.json() : undefined;
  };
  const write = async (kind, plan) => {
    if (attempted.has(kind) || await authorized(plan, kind) !== true || await claimOnce(plan, kind) !== true)
      throw Error('R4_DB_WRITE_NOT_AUTHORIZED_OR_ALREADY_ATTEMPTED');
    attempted.add(kind);
    return send(exactWrite(kind, fixed[kind]), false);
  };
  return Object.freeze({ observeInstalled: () => send(fixed.observe, true),
    observeExact: (query, digest) => {
      if (sha(query) !== digest || !/^begin(?: isolation level repeatable read)? read only;\r?\n/i.test(query) ||
          !/\r?\nrollback;\s*$/i.test(query)) throw Error('R4_DB_OBSERVE_BOUNDARY');
      return send(query, true);
    },
    install: plan => write('install', plan), off: plan => write('off', plan), restore: plan => write('restore', plan) });
}

export function bindOffOnlyDbTransport({ checkout, sql, readToken, writeToken, claimOnce, githubToken }) {
  if (process.env.GITHUB_ACTIONS !== 'true' || !githubToken) throw Error('R4_REAL_PROTECTED_JOB_REQUIRED');
  const run = Number(process.env.GITHUB_RUN_ID), commit = process.env.GITHUB_SHA;
  const { sha256: verifiedPackage } = buildOffOnlyReviewBundle(checkout);
  return transport({ sql, readToken, writeToken, claimOnce, request: fetch,
    authorized: plan => plan?.commit === commit && plan?.runId === run && plan?.packageSha === verifiedPackage &&
      readExactGitHubRelease(plan, githubToken) });
}

// Isolated seam receives metadata only; rendered write SQL is never returned.
export function inspectOffOnlyDbTransportInIsolation({ sql, authorized, claimOnce, observeRequest }) {
  return transport({ sql, authorized, claimOnce, readToken: 'synthetic-read-only', writeToken: 'synthetic-write-only',
    request: async (url, { body }) => {
      const { read_only: readOnly, query } = JSON.parse(body);
      await observeRequest({ url, readOnly, querySha: sha(query), reviewLines: [...query.matchAll(reviewLine)].length,
        singleTransaction: /^begin;\r?\n[\s\S]*\r?\ncommit;\s*$/i.test(query) });
      return { status: 201, json: async () => [] };
    } });
}
