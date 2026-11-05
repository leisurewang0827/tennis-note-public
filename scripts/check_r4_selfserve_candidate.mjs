import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const source = "c20639b1521e8bc8b4e520ade96bd2c5a4e2faf3";
const admissionParent = "67a5600e8d9b3798d1da37db5d0404d4bd5682a2";
const repository = "leisurewang0827/tennis-note-public";
const branch = "refs/heads/codex/tennisnote-r4-admin-prod-candidate";
const changed = [".github/workflows/deploy-cloudflare-pages.yml", "docs/tennisnote-r4-prod-selfserve-release-approval.json", "scripts/build_r4_prod_selfserve_release.mjs", "scripts/check_r4_selfserve_candidate.mjs"].sort();
const option = prefix => process.argv.find(item => item.startsWith(prefix))?.slice(prefix.length);
const repo = option("--repository=") || process.cwd();
const ref = option("--ref=") || process.env.GITHUB_SHA || "HEAD";
const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 6e6 }).trimEnd();
const read = (at, path) => execFileSync("git", ["-C", repo, "show", at + ":" + path], { encoding: "utf8", maxBuffer: 6e6 });
const hash = value => createHash("sha256").update(value).digest("hex");
export function admitReceipt(run, jobs, expectedSha, id) {
  assert.equal(run.id, Number(id));
  assert.equal(run.head_sha, expectedSha);
  assert.equal(run.head_branch, branch.replace("refs/heads/", ""));
  assert.equal(run.repository.full_name, repository);
  assert.equal(run.event, "workflow_dispatch");
  assert.equal(run.conclusion, "success");
  assert.ok(run.path.startsWith(".github/workflows/deploy-cloudflare-pages.yml"));
  assert.equal(jobs.find(job => job.name === "verify-candidate")?.conclusion, "success");
  assert.equal(jobs.find(job => job.name === "admin-only")?.conclusion, "skipped");
}
async function requireReceipt(id, expectedSha) {
  assert.match(String(id), /^\d+$/);
  assert.ok(process.env.GH_TOKEN, "GITHUB_READ_TOKEN_REQUIRED");
  const get = async suffix => {
    const response = await fetch("https://api.github.com/repos/" + repository + "/actions/runs/" + id + suffix, { headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, "VERIFICATION_RECEIPT_UNAVAILABLE");
    return response.json();
  };
  const run = await get("");
  const jobs = await get("/jobs?per_page=100");
  admitReceipt(run, jobs.jobs, expectedSha, id);
}
function localReceiptChecks() {
  const id = 123;
  const run = { id, head_sha: source, head_branch: branch.slice(11), repository: { full_name: repository }, event: "workflow_dispatch", conclusion: "success", path: ".github/workflows/deploy-cloudflare-pages.yml" };
  const jobs = [{ name: "verify-candidate", conclusion: "success" }, { name: "admin-only", conclusion: "skipped" }];
  admitReceipt(run, jobs, source, id);
  for (const delta of [{ head_sha: "0".repeat(40) }, { conclusion: "failure" }, { event: "push" }, { repository: { full_name: "other/repo" } }, { head_branch: "main" }]) assert.throws(() => admitReceipt({ ...run, ...delta }, jobs, source, id));
  assert.throws(() => admitReceipt(run, [{ name: "verify-candidate", conclusion: "skipped" }], source, id));
  assert.throws(() => admitReceipt(run, [{ name: "verify-candidate", conclusion: "success" }, { name: "admin-only", conclusion: "success" }], source, id));
}
try {
  const sha = git("rev-parse", ref);
  assert.equal(git("rev-list", "--parents", "-n", "1", sha), sha + " " + admissionParent, "EXACT_ADMISSION_FIX_PARENT_ONLY");
  assert.equal(git("rev-list", "--parents", "-n", "1", admissionParent), admissionParent + " " + source);
  assert.deepEqual(git("diff", "--name-only", source, sha).split("\n").sort(), changed);
  const plan = JSON.parse(read(sha, "docs/tennisnote-r4-prod-selfserve-release-approval.json"));
  assert.equal(plan.runtimeSource, source);
  assert.equal(plan.priorVerificationRun, 42013885792);
  assert.equal(plan.repository, repository);
  assert.equal(plan.protectedEnvironment, "tennisnote-r4-admin-production");
  assert.equal(plan.cloudflareProject, "tennisnote-admin");
  assert.equal(plan.project, "cnympiwrwgouuvhaivbc");
  assert.equal(plan.fingerprint, hash(plan.project));
  assert.equal(plan.privateSqlSource, "edc9459f328a4c33f2aa99d7b0bf84d53178646f");
  assert.equal(plan.configSha256, "0a89879945c847ecf2244823a1a32ff21dfb6936ecc80706b183c7231671bd64");
  assert.equal(plan.artifactSha256, "f67aca0feb04748be8ebe72e588a2bbfb25d7013f1f8d2561d36eaffed0bcc49");
  assert.equal(plan.operatingBase, "69c2f77161bf57ebc3e2efa3bcf061e1d5e6a1da");
  assert.deepEqual(plan.crlfAssets, ["index.html", "styles.css", "tennis-note-member-app/assets/app-icon.svg", "_headers", "_redirects", "_worker.js"]);
  assert.equal(plan.authorized.paidSales, false);
  assert.equal(plan.authorized.pilot, false);
  assert.equal(plan.authorized.existingPaymentsChanged, false);
  assert.equal(plan.authorized.memberCoachAppsChanged, false);
  assert.deepEqual([...plan.admissionFiles].sort(), changed);
  const frozen = JSON.parse(read(source, "docs/tennisnote-r4-prod-selfserve-candidate.json"));
  assert.equal(frozen.privateCheckpoint.sha, plan.privateSqlSource);
  assert.equal(frozen.sql["sql/apply.sql"], plan.applySqlSha256);
  assert.equal(frozen.sql["sql/restore.sql"], plan.restoreSqlSha256);
  for (const [path, expected] of Object.entries(frozen.effectiveChangedRuntime)) assert.equal(hash(read(sha, path)), expected, "RUNTIME_MUST_REMAIN_C206");
  assert.equal(read(sha, "scripts/build_r4_prod_selfserve_review.mjs"), read(source, "scripts/build_r4_prod_selfserve_review.mjs"), "REVIEW_BUILDER_UNCHANGED");
  const workflow = read(sha, ".github/workflows/deploy-cloudflare-pages.yml");
  const oldWorkflow = read(source, ".github/workflows/deploy-cloudflare-pages.yml");
  assert.equal(workflow.slice(workflow.indexOf("  development-only:")), oldWorkflow.slice(oldWorkflow.indexOf("  development-only:")), "DEVELOPMENT_JOB_UNCHANGED");
  for (const marker of ["environment: tennisnote-r4-admin-production", "persist-credentials: false", "permissions:\n  contents: read\n  actions: read", "cancel-in-progress: false", "secrets.R4_ADMIN_CLOUDFLARE_API_TOKEN", "pages deploy dist/admin --project-name=tennisnote-admin --branch=main", "--require-prior-ci", "vars.TENNISNOTE_R4_ADMIN_APPROVED_SHA"]) assert.ok(workflow.includes(marker), "MISSING_DEPLOYMENT_PROTECTION");
  assert.equal(/push:|pull_request:|pull_request_target:/.test(workflow), false, "MANUAL_WORKFLOW_ONLY");
  localReceiptChecks();
  const builder = await import("data:text/javascript;base64," + Buffer.from(read(sha, "scripts/build_r4_prod_selfserve_release.mjs")).toString("base64"));
  const fixture = { environment: "production", supabaseUrl: "https://" + plan.project + ".supabase.co", projectFingerprint: plan.fingerprint, supabasePublishableKey: "sb_publishable_local_config_shape_only" };
  const encode = runtime => "window.TENNISNOTE_CONFIG = " + JSON.stringify(runtime) + ";\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = {};\n";
  const config = encode(fixture);
  builder.validatePublicConfiguration(config, { ...plan, configSha256: hash(config) });
  for (const delta of [{ environment: "development" }, { supabaseUrl: "https://other.supabase.co" }, { projectFingerprint: "0".repeat(64) }, { supabasePublishableKey: "sb_secret_not_permitted" }]) {
    const bad = encode({ ...fixture, ...delta });
    assert.throws(() => builder.validatePublicConfiguration(bad, { ...plan, configSha256: hash(bad) }));
  }
  assert.throws(() => builder.validatePublicConfiguration(config, plan));
  if (process.env.GITHUB_ACTIONS === "true") {
    assert.equal(process.env.GITHUB_REPOSITORY, repository);
    assert.equal(process.env.GITHUB_REF, branch);
    assert.equal(process.env.GITHUB_SHA, sha);
    assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
    await requireReceipt(plan.priorVerificationRun, source);
  }
  if (process.argv.includes("--require-prior-ci")) {
    assert.equal(process.env.GITHUB_ACTIONS, "true", "PROTECTED_WORKFLOW_REQUIRED");
    assert.equal(process.env.R4_EXECUTION_MODE, "deploy");
    assert.equal(process.env.APPROVED_SHA, sha, "EXACT_APPROVED_ADMISSION_SHA_REQUIRED");
    await requireReceipt(process.env.R4_VERIFICATION_RUN, sha);
  }
  console.log(JSON.stringify({ state: "ADMISSION_DELTA_PASS", admissionSha: sha, runtimeSha: source, deltaFiles: 4, priorFunctionalTestsReused: true, receiptNegativeChecks: 7, configNegativeChecks: 5, deploymentRequested: process.argv.includes("--require-prior-ci") }));
} catch (error) { console.error("R4_ADMISSION_BLOCKED: " + String(error.message).split("\n")[0].slice(0,220)); process.exitCode = 1; }
