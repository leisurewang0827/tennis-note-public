import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";

export const pins = Object.freeze({
  repo: "leisurewang0827/tennis-note-public",
  repoId: 1299952631,
  branch: "codex/tennisnote-r4-ui-finish-dev-20261108",
  parent: "690f2d2bdd3e7c8d3583af93b3f99b0de21e149d",
  localCandidate: "9cd9b23c4f2ab463519ad8132904e34897e6f59161608447fb0a6d64f7ea4be8",
  localManifest: "487fd24b7bc1058d1743b66ce91d82042e49ec188a3f14f15c4eec894b3dc111",
  workflow: ".github/workflows/r4-first-issue-linked-evidence.yml",
  environment: "tennisnote-r4-admin-production",
  environmentId: 26219323796,
});
export const exactFiles = Object.freeze([
  pins.workflow,
  "release-sources/r4-first-issue-linked-evidence/check.mjs",
  "release-sources/r4-first-issue-linked-evidence/evidence.mjs",
]);
const digest = (x, n) => typeof x === "string" && x.length === n && /^[0-9a-f]+$/.test(x);
const id = x => Number.isSafeInteger(x) && x > 0;
const need = (x, code) => { if (!x) throw new Error(code); };

export function reviewComment(sha, run, qa) {
  need(digest(sha, 40) && id(run) && digest(qa, 64), "EVIDENCE_COMMENT_INPUT");
  return `R4 EVIDENCE ONLY v1\nsha:${sha}\nrun:${run}\nqa-sha256:${qa}\ncandidate:${pins.localCandidate}\nmanifest-sha256:${pins.localManifest}`;
}

export function validateFiles(diff) {
  need(diff?.status === "ahead" && diff.total_commits === 1 && diff.files?.length === exactFiles.length &&
    diff.files.every(f => f.status === "added" && digest(f.sha, 40)) &&
    JSON.stringify(diff.files.map(f => f.filename).sort()) === JSON.stringify(exactFiles), "EVIDENCE_EXACT_FILES");
}

// Only an evidence receipt. Never returns a production permit.
export function validateEvidence({run, jobs, reviews, environment, ref, diff, commit}, {sha, runId}) {
  const expectedRef = "refs/heads/" + pins.branch;
  need(digest(sha, 40) && id(runId) && run?.id === runId && run.event === "push" &&
    run.path === pins.workflow && run.head_branch === pins.branch && run.head_sha === sha &&
    run.head_repository?.id === pins.repoId && run.run_attempt === 1 && run.status === "in_progress" &&
    ref?.ref === expectedRef && ref.object?.sha === sha && commit?.sha === sha &&
    commit.parents?.length === 1 && commit.parents[0].sha === pins.parent, "EVIDENCE_RUN_BINDING");
  validateFiles(diff);
  const protections = environment?.protection_rules?.filter(x => x.type === "required_reviewers");
  const list = protections?.[0]?.reviewers;
  need(environment?.id === pins.environmentId && environment.name === pins.environment &&
    protections?.length === 1 && list?.length === 1 && list[0].type === "User" && id(list[0].reviewer?.id),
  "EVIDENCE_REVIEWER_BINDING");
  const rows = reviews?.filter(r => r.environments?.some(x => x.id === pins.environmentId));
  need(rows?.length === 1 && rows[0].environments.length === 1 && rows[0].environments[0].name === pins.environment &&
    rows[0].state === "approved" && rows[0].user?.id === list[0].reviewer.id, "EVIDENCE_OFFICIAL_REVIEW");
  const qa = rows[0].comment?.split("\n")[3]?.slice("qa-sha256:".length);
  need(digest(qa, 64) && rows[0].comment === reviewComment(sha, runId, qa), "EVIDENCE_EXACT_REVIEW_COMMENT");
  const findJob = name => jobs?.jobs?.find(j => j.name === name && j.run_id === runId && j.head_sha === sha);
  const ci = findJob("linked-source-only");
  const protectedJob = findJob("linked-evidence-only");
  need(jobs?.total_count === 2 && jobs.jobs?.length === 2 && ci?.status === "completed" && ci.conclusion === "success" &&
    protectedJob?.status === "in_progress" && Date.parse(ci.completed_at) <= Date.parse(protectedJob.started_at),
  "EVIDENCE_JOB_ORDER");
  return Object.freeze({state: "R4_ACTUAL_READ_ONLY_APPROVAL", sha, runId, qa,
    candidate: pins.localCandidate, manifest: pins.localManifest, productionPermit: false});
}

const git = (...args) => execFileSync("git", args, {encoding:"utf8"}).trim();
export function checkCommit(env = process.env) {
  const sha = env.GITHUB_SHA;
  need(env.GITHUB_REPOSITORY === pins.repo && env.GITHUB_EVENT_NAME === "push" &&
    env.GITHUB_REF === "refs/heads/" + pins.branch && env.GITHUB_RUN_ATTEMPT === "1" &&
    digest(sha, 40) && git("rev-parse", "HEAD") === sha && git("rev-parse", "HEAD^") === pins.parent, "EVIDENCE_CHECKOUT");
  const actual = git("diff-tree", "--no-commit-id", "--name-status", "-r", sha).split(/\r?\n/).sort();
  need(JSON.stringify(actual) === JSON.stringify(exactFiles.map(x => "A\t" + x).sort()), "EVIDENCE_CHECKOUT_FILES");
}

async function main(env) {
  checkCommit(env);
  const sha = env.GITHUB_SHA, runId = Number(env.GITHUB_RUN_ID);
  need(id(runId) && env.GITHUB_JOB === "linked-evidence-only" && env.GITHUB_TOKEN, "EVIDENCE_RUN_CONTEXT");
  const base = "https://api.github.com/repos/" + pins.repo;
  const path = "/actions/runs/" + runId;
  const get = async route => {
    const res = await fetch(base + route, {method:"GET", redirect:"error", cache:"no-store",
      headers:{Authorization:"Bearer "+env.GITHUB_TOKEN, Accept:"application/vnd.github+json"},
      signal:AbortSignal.timeout(10000)});
    need(res.status === 200, "EVIDENCE_GITHUB_HTTP_" + res.status);
    return res.json();
  };
  const routes = {run:path, jobs:path+"/jobs", reviews:path+"/approvals",
    environment:"/environments/"+pins.environment, ref:"/git/ref/heads/"+pins.branch,
    diff:"/compare/"+pins.parent+"..."+sha, commit:"/git/commits/"+sha};
  const evidence = Object.fromEntries(await Promise.all(Object.entries(routes).map(async ([k, route]) => [k, await get(route)])));
  console.log(JSON.stringify(validateEvidence(evidence, {sha,runId})));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(process.env); }
  catch (error) { console.error(/^EVIDENCE_[A-Z0-9_]+$/.test(error.message) ? error.message : "EVIDENCE_UNAVAILABLE"); process.exitCode = 1; }
}
