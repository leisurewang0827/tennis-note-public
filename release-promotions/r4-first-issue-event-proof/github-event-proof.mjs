// Proof only: GitHub reads and a proof-audience OIDC token; no provider transport.
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export const pin = Object.freeze({
  repo: "leisurewang0827/tennis-note-public", repoId: 1299952631,
  branch: "codex/tennisnote-r4-ui-finish-dev-20261108",
  workflow: ".github/workflows/r4-first-issue-event-proof.yml",
  environment: "tennisnote-r4-evidence-only", task: "tennisnote-r4-event-proof-v1",
  jobName: "r4-event-proof", issuer: "https://token.actions.githubusercontent.com",
});
const ref = "refs/heads/" + pin.branch;
const workflowRef = pin.repo + "/" + pin.workflow + "@" + ref;
const api = "https://api.github.com/repos/" + pin.repo;
const sha = x => typeof x === "string" && /^[a-f0-9]{40}$/.test(x);
const id = x => Number.isSafeInteger(x) && x > 0;
const require = (v, code) => { if (!v) throw Error(code); };
const digest = x => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const payloadIsProof = p => p && typeof p === "object" && !Array.isArray(p) &&
  Object.keys(p).length === 1 && p.mode === "proof-only";

export function eventBinding(event, runtime) {
  const d = event?.deployment;
  require(runtime?.event === "deployment" && runtime.ref === ref && sha(runtime.sha) &&
    runtime.workflowRef === workflowRef && runtime.workflowSha === runtime.sha &&
    id(runtime.run) && runtime.attempt === 1 && runtime.job === pin.jobName &&
    event.repository?.id === pin.repoId && event.repository?.full_name === pin.repo &&
    id(d?.id) && d.sha === runtime.sha && d.ref === pin.branch &&
    d.environment === pin.environment && d.task === pin.task &&
    d.production_environment === false && d.transient_environment === true &&
    id(d.creator?.id) && payloadIsProof(d.payload), "R4_PROOF_EVENT_SCOPE");
  const fields = [pin.repoId, d.id, runtime.run, runtime.sha, ref, pin.workflow, d.creator.id];
  return Object.freeze({
    request: d.id, run: runtime.run, sha: runtime.sha, requester: d.creator.id,
    audience: "urn:tennisnote:r4:event-proof:" + digest(fields),
  });
}

export function signedJob(token, jwks, binding, now) {
  const parts = typeof token === "string" && token.length <= 16384 ? token.split(".") : [];
  require(parts.length === 3 && parts.every(x => /^[A-Za-z0-9_-]+$/.test(x)), "R4_PROOF_TOKEN");
  const [header, claims] = parts.slice(0, 2).map(x => JSON.parse(Buffer.from(x, "base64url")));
  const matches = jwks?.keys?.filter(k => k.kid === header.kid && k.kty === "RSA" && k.use === "sig");
  require(header.alg === "RS256" && matches?.length === 1 &&
    verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]),
      createPublicKey({ key: matches[0], format: "jwk" }), Buffer.from(parts[2], "base64url")), "R4_PROOF_SIGNATURE");
  const check = Number(claims.check_run_id);
  require(claims.iss === pin.issuer && claims.aud === binding.audience &&
    claims.sub === "repo:" + pin.repo + ":environment:" + pin.environment &&
    claims.environment === pin.environment && claims.repository === pin.repo &&
    String(claims.repository_id) === String(pin.repoId) && claims.ref === ref &&
    claims.event_name === "deployment" && claims.sha === binding.sha &&
    claims.workflow_ref === workflowRef && claims.workflow_sha === binding.sha &&
    String(claims.run_id) === String(binding.run) && String(claims.run_attempt) === "1" &&
    claims.runner_environment === "github-hosted" && id(check) && String(check) === String(claims.check_run_id) &&
    [claims.iat, claims.nbf, claims.exp, now].every(Number.isSafeInteger) &&
    claims.iat <= now && claims.nbf <= now && claims.exp > now &&
    claims.exp > claims.iat && claims.exp - claims.iat <= 600,
  "R4_PROOF_SIGNED_SCOPE");
  return check;
}

export function matchOfficial(binding, check, { request: d, run, job, env, reviews, branch }) {
  require(d?.id === binding.request && d.sha === binding.sha && d.ref === pin.branch &&
    d.environment === pin.environment && d.task === pin.task &&
    d.production_environment === false && d.transient_environment === true &&
    d.creator?.id === binding.requester && payloadIsProof(d.payload), "R4_PROOF_OFFICIAL_REQUEST");
  require(run?.id === binding.run && run.head_sha === binding.sha && run.head_branch === pin.branch &&
    run.repository?.id === pin.repoId && run.head_repository?.id === pin.repoId &&
    run.event === "deployment" && run.run_attempt === 1 && run.status === "in_progress" && run.path === pin.workflow &&
    job?.id === check && job.run_id === binding.run && job.head_sha === binding.sha &&
    job.name === pin.jobName && job.status === "in_progress" && job.check_run_url === api + "/check-runs/" + check &&
    branch?.ref === ref && branch.object?.sha === binding.sha, "R4_PROOF_OFFICIAL_RUN");
  const reviewerRules = env?.protection_rules?.filter(r => r.type === "required_reviewers");
  const eligible = reviewerRules?.[0]?.reviewers;
  const review = Array.isArray(reviews) && reviews.filter(x => x.environments?.some(y => y.id === env?.id));
  require(id(env?.id) && env.name === pin.environment && reviewerRules?.length === 1 && eligible?.length === 1 &&
    eligible[0].type === "User" && id(eligible[0].reviewer?.id) &&
    eligible[0].reviewer.id !== binding.requester && review?.length === 1 &&
    review[0].user?.id === eligible[0].reviewer.id && review[0].state === "approved" &&
    review[0].environments.length === 1 && review[0].environments[0].name === pin.environment,
  "R4_PROOF_OFFICIAL_REVIEW");
  return Object.freeze({ proofOnly: true, canOperate: false, commit: binding.sha,
    request: binding.request, run: binding.run, job: check });
}

async function json(url, token) {
  const r = await fetch(url, { method: "GET", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(5000),
    headers: token ? { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" } : {} });
  require(r.status === 200, "R4_PROOF_READ_FAILED");
  return r.json();
}
async function runnerProof(e) {
  const binding = eventBinding(JSON.parse(readFileSync(e.GITHUB_EVENT_PATH, "utf8")), {
    event: e.GITHUB_EVENT_NAME, ref: e.GITHUB_REF, sha: e.GITHUB_SHA, workflowRef: e.GITHUB_WORKFLOW_REF,
    workflowSha: e.GITHUB_WORKFLOW_SHA, run: Number(e.GITHUB_RUN_ID), attempt: Number(e.GITHUB_RUN_ATTEMPT),
    job: e.GITHUB_JOB,
  });
  const endpoint = new URL(e.ACTIONS_ID_TOKEN_REQUEST_URL);
  require(endpoint.protocol === "https:" && endpoint.hostname.endsWith(".actions.githubusercontent.com") &&
    !endpoint.username && !endpoint.password && !endpoint.port && !endpoint.hash &&
    typeof e.ACTIONS_ID_TOKEN_REQUEST_TOKEN === "string" && typeof e.GITHUB_TOKEN === "string", "R4_PROOF_RUNTIME");
  endpoint.searchParams.set("audience", binding.audience);
  const result = await json(endpoint, e.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
  const jwks = await json(pin.issuer + "/.well-known/jwks");
  const now = () => Math.floor(Date.now() / 1000);
  const check = signedJob(result.value, jwks, binding, now());
  const runPath = "/actions/runs/" + binding.run;
  const routes = { request: "/deployments/" + binding.request, run: runPath, job: "/actions/jobs/" + check,
    env: "/environments/" + pin.environment, reviews: runPath + "/approvals", branch: "/git/ref/heads/" + pin.branch };
  const official = Object.fromEntries(await Promise.all(Object.entries(routes).map(async ([k, path]) => [
    k, await json(api + path, e.GITHUB_TOKEN),
  ])));
  signedJob(result.value, jwks, binding, now());
  return matchOfficial(binding, check, official);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await runnerProof(process.env))); }
  catch { console.error("R4_PROOF_UNCONFIRMED"); process.exitCode = 1; }
}
