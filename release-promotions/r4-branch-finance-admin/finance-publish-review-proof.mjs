// Read-only validation for a protected review's attestation. Does not publish.
import { createHash } from 'node:crypto';
import { packageProof, pins } from './observe-production-off-for-publish.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const require = (ok, reason) => { if (!ok) throw Error(reason); };
const hex = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const id = value => Number.isSafeInteger(value) && value > 0;
const reviewer = { login: 'leisurewang0827', id: 294703475 };
const environment = { name: 'tennisnote-r4-admin-production', id: 26219323796 };
const repo = 'leisurewang0827/tennis-note-public';
const branch = 'codex/tennisnote-r4-ui-finish-dev-20261108';
const workflow = '.github/workflows/r4-branch-finance-protected-publish.yml';
const jobName = 'r4-finance-admin-publish';
const yes = ['pilotOff','rlsAndTableAcl','rpcAcl','writerPinned','readerPinned','postimagesPinned'];
const zero = ['termActive','paidActive','historyActive','paidReceipts','termReceipts','gateRows'];

function context(target) {
  require(hex(target?.commit) && id(target?.run) && id(target?.job), 'PUBLISH_CONTEXT_INVALID');
  return { commit: target.commit, run: target.run, job: target.job };
}

function commitObservation(rows, target, now) {
  const { commit, run, job } = context(target);
  const { evidence } = packageProof(rows, commit, run, now);
  return { action: 'publish-admin-only', repository: repo, environment: environment.id, job, ...evidence };
}

// Build only after a separate genuine, hash-pinned DB read. Never post automatically.
export function makeReviewComment(rows, target, now = Date.now()) {
  const attestation = commitObservation(rows, target, now);
  const { publishCommit, publishRun, job, proof } = attestation;
  return ['TN-R4-FINANCE-OFF-v1', publishCommit, publishRun, job, proof.dbObservedAt,
    sha(JSON.stringify(attestation))].join(' ');
}

export function verifyOfficialReview({target, run, jobs, approvals, now = Date.now()}) {
  const t = context(target);
  require(run?.repository?.full_name === repo && run?.head_repository?.full_name === repo &&
    run.id === t.run && run.head_sha === t.commit && run.head_branch === branch &&
    run.path === workflow && run.event === 'push' && run.run_attempt === 1 &&
    run.status === 'in_progress', 'PUBLISH_RUN_NOT_LIVE');
  const matchingJobs = Array.isArray(jobs) ? jobs.filter(j => j.name === jobName) : [];
  const j = matchingJobs[0];
  require(matchingJobs.length === 1 && j.id === t.job && j.run_id === t.run && j.head_sha === t.commit &&
    j.run_attempt === 1 && j.status === 'in_progress', 'PUBLISH_JOB_NOT_LIVE');
  require(Array.isArray(approvals) && approvals.length === 1, 'PUBLISH_REVIEW_AMBIGUOUS');
  const a = approvals[0];
  require(a.state === 'approved' && a.user?.id === reviewer.id && a.user?.login === reviewer.login &&
    a.environments?.length === 1 && a.environments[0].id === environment.id &&
    a.environments[0].name === environment.name, 'PUBLISH_REVIEW_NOT_AUTHORIZED');
  const match = typeof a.comment === 'string' && a.comment.match(
    /^TN-R4-FINANCE-OFF-v1 ([a-f0-9]{40}) ([1-9][0-9]*) ([1-9][0-9]*) (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) ([a-f0-9]{64})$/);
  require(match?.[0] === a.comment && match[1] === t.commit && match[2] === String(t.run) &&
    match[3] === String(t.job), 'PUBLISH_REVIEW_CONTEXT_MISMATCH');
  const observed = Date.parse(match[4]);
  require(Number.isFinite(now) && Number.isFinite(observed) && new Date(observed).toISOString() === match[4] &&
    now - observed >= 0 && now - observed <= 120000, 'PUBLISH_REVIEW_OFF_STALE');
  // These values are attested by the official designated reviewer, not measured by this job.
  const proof = { kind:'R4_FINANCE_COMMITTED_OFF_DB_READ_V1', dbObservedAt:match[4],
    ...Object.fromEntries(zero.map(k => [k, 0])), ...Object.fromEntries(yes.map(k => [k, true])) };
  require(makeReviewComment([{proof}], t, now) === a.comment, 'PUBLISH_REVIEW_DIGEST_MISMATCH');
  return { reviewMatched:true, provenance:'github-required-reviewer-attestation',
    observedAt:proof.dbObservedAt, install:pins.installSqlSha, deployAuthorized:false };
}

// Use only in the reviewed protected workflow. Keep the endpoint and method fixed;
// this module cannot approve the job or reach Supabase or Cloudflare.
export async function readOfficialReview({ target, token, fetchRead = fetch, now = () => Date.now() }) {
  const t = context(target);
  require(typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token), 'GITHUB_READ_TOKEN_MISSING');
  const api = `https://api.github.com/repos/${repo}`;
  const runPath = `/actions/runs/${t.run}`;
  const read = async path => {
    const res = await fetchRead(`${api}${path}`, { method:'GET', redirect:'error', cache:'no-store',
      signal:AbortSignal.timeout(8000), headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28' } });
    require(res.status === 200, 'GITHUB_REVIEW_READ_FAILED');
    return res.json();
  };
  const [run, jobs, approvals, ref] = await Promise.all([read(runPath), read(`${runPath}/attempts/1/jobs?per_page=100`),
    read(`${runPath}/approvals`), read(`/git/ref/heads/${branch}`)]);
  require(ref?.ref === `refs/heads/${branch}` && ref.object?.type === 'commit' && ref.object?.sha === t.commit,
    'PUBLISH_BRANCH_DRIFT');
  require(Array.isArray(jobs?.jobs) && jobs.total_count === jobs.jobs.length, 'PUBLISH_JOB_LIST_INCOMPLETE');
  return verifyOfficialReview({ target:t, run, jobs:jobs.jobs, approvals, now:now() });
}
