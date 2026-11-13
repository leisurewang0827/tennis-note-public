// GitHub의 공식 읽기 기록만 사용한다. 이 파일은 승인·배포 요청을 만들지 않는다.
import { createPublicKey, verify } from 'node:crypto';
export const scope = Object.freeze({
  repo: 'leisurewang0827/tennis-note-public', repoId: 1299952631,
  branch: 'codex/tennisnote-r4-ui-finish-dev-20261108',
  parent: '9966c55f774ee8c5cced5d30632d73b1052a5a19',
  workflow: '.github/workflows/r4-first-issue-off-only-release.yml',
  environment: 'tennisnote-r4-admin-production', environmentId: 26219323796,
  reviewerId: 294703475, reviewer: 'leisurewang0827', job: 'production-install-off-and-publish-admin',
  deltaJob: 'off-only-release-delta',
});
const int = x => Number.isSafeInteger(x) && x > 0;
const sha = (x, n) => typeof x === 'string' && x.length === n && /^[a-f0-9]+$/.test(x);
const issuer = 'https://token.actions.githubusercontent.com';
const audience = 'tennisnote-r4-install-off-admin-only';

export function exactSignedClaims(claims, plan, now) {
  const ref = 'refs/heads/' + scope.branch;
  return claims?.iss === issuer && claims.aud === audience && claims.repository === scope.repo &&
    String(claims.repository_id) === String(scope.repoId) && claims.sub === `repo:${scope.repo}:environment:${scope.environment}` &&
    claims.environment === scope.environment && claims.ref === ref && claims.sha === plan.commit &&
    claims.workflow_ref === `${scope.repo}/${scope.workflow}@${ref}` && claims.workflow_sha === plan.commit &&
    claims.event_name === 'push' && String(claims.run_id) === String(plan.runId) && String(claims.run_attempt) === '1' &&
    Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp) && claims.iat <= now + 15 &&
    claims.exp > now && claims.exp > claims.iat && claims.exp - claims.iat <= 600;
}

async function readSignedJobIdentity(plan) {
  const u = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '');
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!token || u.protocol !== 'https:' || !u.hostname.endsWith('.actions.githubusercontent.com') ||
      u.username || u.password || u.port) return false;
  u.searchParams.set('audience', audience);
  const get = async (url, auth) => {
    const r = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: auth ? { Authorization: 'Bearer ' + auth } : {} });
    if (r.status !== 200) throw Error('R4_SIGNED_JOB_READ_FAILED');
    return r.json();
  };
  const [{ value }, { keys }] = await Promise.all([get(u, token), get(issuer + '/.well-known/jwks')]);
  if (typeof value !== 'string' || value.length > 16000) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || !parts.every(s => /^[A-Za-z0-9_-]+$/.test(s))) return false;
  const h = JSON.parse(Buffer.from(parts[0], 'base64url'));
  const key = h.alg === 'RS256' && typeof h.kid === 'string' &&
    keys?.find(k => k.kid === h.kid && k.kty === 'RSA' && k.use === 'sig');
  return !!key && verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({ key, format: 'jwk' }),
    Buffer.from(parts[2], 'base64url')) &&
    exactSignedClaims(JSON.parse(Buffer.from(parts[1], 'base64url')), plan, Math.floor(Date.now()/1000));
}

export function releaseApprovalComment(p) {
  return `R4 INSTALL-OFF ADMIN-ONLY ${p.commit} ${p.packageSha} ${p.runId} ${p.jobId} ${p.operation}`;
}

export function exactGitHubRelease(plan, evidence) {
  const { run, jobs, env, approvals, head, commit, releases } = evidence ?? {};
  if (!sha(plan?.commit, 40) || plan.commit === scope.parent || !sha(plan.packageSha, 64) ||
      !int(plan.runId) || !int(plan.jobId) || plan.runId === 43339313485 ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(plan.operation ?? '') ||
      head?.ref !== `refs/heads/${scope.branch}` || head.object?.sha !== plan.commit ||
      commit?.sha !== plan.commit || commit.parents?.length !== 1 || commit.parents[0]?.sha !== scope.parent ||
      run?.id !== plan.runId || run.path !== scope.workflow || run.head_sha !== plan.commit ||
      run.event !== 'push' || run.run_attempt !== 1 || run.status !== 'in_progress' ||
      run.head_branch !== scope.branch || run.head_repository?.id !== scope.repoId ||
      env?.id !== scope.environmentId || env.name !== scope.environment ||
      !Array.isArray(jobs) || !Array.isArray(approvals) || !Array.isArray(releases) ||
      releases.length!==1 || releases[0]?.id!==plan.runId || releases[0]?.head_sha!==plan.commit ||
      releases[0]?.path!==scope.workflow || releases[0]?.run_attempt!==1) return false;
  const sameRun = j => j.run_id === plan.runId && j.head_sha === plan.commit;
  const protectedJobs = jobs.filter(j => j.name === scope.job);
  const delta = jobs.filter(j => j.name === scope.deltaJob);
  if (protectedJobs.length !== 1 || !sameRun(protectedJobs[0]) || protectedJobs[0].id !== plan.jobId ||
      protectedJobs[0].status !== 'in_progress' || delta.length !== 1 || !sameRun(delta[0]) ||
      delta[0].status !== 'completed' || delta[0].conclusion !== 'success') return false;
  const rules = env.protection_rules?.filter(x => x.type === 'required_reviewers');
  if (rules?.length !== 1 || rules[0].reviewers?.length !== 1 || rules[0].reviewers[0].type !== 'User' ||
      rules[0].reviewers[0].reviewer?.id !== scope.reviewerId) return false;
  const records = approvals.filter(r => r.environments?.some(e => e.id === scope.environmentId));
  return records.length === 1 && records[0].environments.length === 1 && records[0].state === 'approved' &&
    records[0].user?.id === scope.reviewerId && records[0].user?.login === scope.reviewer &&
    records[0].comment === releaseApprovalComment(plan);
}

export async function readExactGitHubRelease(plan, token) {
  if (!token || !int(plan?.runId) || !sha(plan?.commit, 40)) return false;
  const base = 'https://api.github.com/repos/' + scope.repo;
  const get = async path => {
    const r = await fetch(base + path, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
    if (r.status !== 200) throw Error('R4_GITHUB_READ_FAILED');
    return r.json();
  };
  const prefix = '/actions/runs/' + plan.runId;
  const [run, jobList, env, approvals, head, commit, signed, history] = await Promise.all([
    get(prefix), get(prefix + '/attempts/1/jobs?per_page=100'), get('/environments/' + scope.environment),
    get(prefix + '/approvals'), get('/git/ref/heads/' + scope.branch), get('/git/commits/' + plan.commit), readSignedJobIdentity(plan),
    get('/actions/runs?event=push&per_page=100&head_sha='+plan.commit),
  ]);
  return signed === true && exactGitHubRelease(plan, {
    run, jobs: jobList?.total_count === 2 ? jobList.jobs : null, env, approvals, head, commit,
    releases: history?.total_count<=100 ? history.workflow_runs?.filter(r=>r.path===scope.workflow) : null,
  });
}
