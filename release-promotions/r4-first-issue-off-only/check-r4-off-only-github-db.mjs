import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPinnedReviewSql } from './r4-prod-catalog-pinned-db-packet.mjs';
import { exactGitHubRelease, exactSignedClaims, releaseApprovalComment, scope as s } from './r4-off-only-github-admission.mjs';
import { inspectOffOnlyDbTransportInIsolation } from './r4-off-only-db-transport.mjs';

const checkout = process.argv[2];
assert.ok(checkout);
const p = { commit: 'a'.repeat(40), packageSha: 'b'.repeat(64), runId: 111, jobId: 222,
  operation: '01234567-1234-1234-1234-123456789abc' };
const job = { run_id: p.runId, head_sha: p.commit };
const reviewer = { id: s.reviewerId, login: s.reviewer };
const ref = 'refs/heads/' + s.branch;
const claims = { iss: 'https://token.actions.githubusercontent.com', aud: 'tennisnote-r4-install-off-admin-only',
  repository: s.repo, repository_id: String(s.repoId), sub: `repo:${s.repo}:environment:${s.environment}`,
  environment: s.environment, ref, sha: p.commit, workflow_ref: `${s.repo}/${s.workflow}@${ref}`, workflow_sha: p.commit,
  event_name: 'push', run_id: String(p.runId), run_attempt: '1', iat: 2000, exp: 2300 };
assert.equal(exactSignedClaims(claims, p, 2001), true);
for (const key of Object.keys(claims)) assert.equal(exactSignedClaims({ ...claims, [key]: null }, p, 2001), false, key);
assert.equal(exactSignedClaims(claims, p, 2300), false);
const e = { head: { ref: 'refs/heads/' + s.branch, object: { sha: p.commit } },
  commit: { sha: p.commit, parents: [{ sha: s.parent }] },
  run: { id: p.runId, path: s.workflow, head_sha: p.commit, event: 'push', run_attempt: 1, status: 'in_progress',
    head_branch: s.branch, head_repository: { id: s.repoId } },
  jobs: [{ ...job, name: s.job, id: p.jobId, status: 'in_progress' },
    { ...job, name: s.deltaJob, status: 'completed', conclusion: 'success' }],
  env: { id: s.environmentId, name: s.environment, protection_rules: [{ type: 'required_reviewers',
    reviewers: [{ type: 'User', reviewer }] }] },
  approvals: [{ user: reviewer, state: 'approved', environments: [{ id: s.environmentId }], comment: releaseApprovalComment(p) }] };
e.releases=[e.run];
assert.equal(exactGitHubRelease(p, e), true);
for (const changed of [
  { ...e, approvals: [{ ...e.approvals[0], comment: 'review only' }] },
  { ...e, approvals: [e.approvals[0], e.approvals[0]] },
  { ...e, releases: [e.run,{...e.run,id:999}] },
  { ...e, run: { ...e.run, run_attempt: 2 } },
  { ...e, jobs: [e.jobs[0], { ...e.jobs[1], conclusion: 'failure' }] },
  { ...e, jobs: [{ ...e.jobs[0], id: 333 }, e.jobs[1]] },
  { ...e, head: { ...e.head, object: { sha: s.parent } } },
]) assert.equal(exactGitHubRelease(p, changed), false);

const b = buildPinnedReviewSql(checkout,{offOnly:true});
const sql = { install: b.install.sql, restore: b.restore.sql,
  off: readFileSync(resolve(checkout, 'release-sources/r4-first-issue-candidate/prod-off-template-v2.sql'), 'utf8'),
  observe: readFileSync(new URL('prod-r4-install-committed-off-readonly.sql', import.meta.url), 'utf8') };
const calls = [];
const transport = inspectOffOnlyDbTransportInIsolation({ sql, authorized: plan => exactGitHubRelease(plan, e),
  claimOnce: () => true, observeRequest: r => calls.push(r) });
await assert.rejects(transport.install({ ...p, packageSha: 'c'.repeat(64) }));
assert.equal(calls.length, 0);
for (const kind of ['install', 'off', 'restore']) {
  await transport[kind](p);
  await assert.rejects(transport[kind](p));
}
await transport.observeInstalled();
assert.deepEqual(calls.map(r => [r.readOnly, r.reviewLines, r.singleTransaction]),
  [[false, 0, true], [false, 0, true], [false, 0, true], [true, 0, false]]);
assert.equal(new Set(calls.map(r => r.url)).size, 1);
assert.ok(calls[0].url.startsWith('https://api.supabase.com/v1/projects/'));
assert.throws(() => inspectOffOnlyDbTransportInIsolation({ sql: { ...sql, off: sql.off + '\n' },
  authorized: () => true, claimOnce: () => true, observeRequest() {} }), /R4_DB_BINDINGS_UNAVAILABLE/);
console.log('R4_OFF_ONLY_GITHUB_DB_DELTA_PASS: release identity, exact SQL and no write retries; synthetic evidence only');
