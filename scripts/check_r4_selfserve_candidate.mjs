import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Script, createContext } from "node:vm";
const value = (prefix) => process.argv.find((s) => s.startsWith(prefix))?.slice(prefix.length);
const repository = value("--repository=") || process.cwd();
const ref = value("--ref=") || process.env.GITHUB_SHA || "HEAD";
const base = "69c2f77161bf57ebc3e2efa3bcf061e1d5e6a1da";
const branch = "refs/heads/codex/tennisnote-r4-admin-prod-candidate";
const expected = {
  "app/admin/index.html": "69a6d068b8c83185d0d6dd03d37744e5bd7245743d4a24f76e41793ec97af3df",
  "app/admin/r4-selfserve-client.js": "4da7498e721a2cb05cd76b88826633353c59c3ed296f9a7ded526d8726266d66",
  "app/admin/r4-onboarding.js": "fc1ddf49148417fbee745566b0045ddd21b3f1e4153bed7f6894ac967228dabe",
};
const git = (...args) => execFileSync("git", ["-C", repository, ...args], { encoding: "utf8", maxBuffer: 3e6 }).trimEnd();
const read = (path) => execFileSync("git", ["-C", repository, "show", ref + ":" + path], { encoding: "utf8", maxBuffer: 3e6 });
const sha = git("rev-parse", ref);
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(git("rev-list", "--parents", "-n", "1", sha), sha + " " + base);
if (process.env.GITHUB_ACTIONS === "true") {
  assert.equal(process.env.GITHUB_REPOSITORY, "leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF, branch);
  assert.equal(process.env.GITHUB_SHA, sha);
}
if (process.argv.includes("--require-prior-ci")) {
  const api = async (path) => {
    const response = await fetch((process.env.GITHUB_API_URL || "https://api.github.com") + path, {
      headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.ok, true, "CI receipt lookup failed");
    return response.json();
  };
  const prefix = "/repos/leisurewang0827/tennis-note-public";
  const { workflow_runs } = await api(prefix + "/actions/workflows/deploy-cloudflare-pages.yml/runs?head_sha=" + sha + "&status=completed&event=workflow_dispatch&per_page=30");
  let verified = false;
  for (const run of workflow_runs) {
    if (run.head_sha !== sha || run.conclusion !== "success" || !run.display_title.startsWith("R4 administrator verify / ")) continue;
    const { jobs } = await api(prefix + "/actions/runs/" + run.id + "/jobs");
    if (jobs.some((job) => job.name === "verify-candidate" && job.conclusion === "success") &&
        jobs.every((job) => job.name !== "admin-only" || job.conclusion === "skipped")) verified = true;
  }
  assert.equal(verified, true, "No prior successful verification-only run for this exact source");
  console.log("PASS existing exact-head verification receipt; no old suite rerun");
} else {
  const paths = [...Object.keys(expected), ".github/workflows/deploy-cloudflare-pages.yml", "scripts/check_r4_selfserve_candidate.mjs"].sort();
  assert.deepEqual(git("diff", "--name-only", base, sha).split("\n").sort(), paths);
  for (const [path, digest] of Object.entries(expected)) {
    assert.equal(createHash("sha256").update(read(path)).digest("hex"), digest, path + " differs from reviewed source");
  }
  for (const path of Object.keys(expected).filter((x) => x.endsWith(".js"))) new Script(read(path), { filename: path });
  const adapter = read("app/admin/r4-selfserve-client.js");
  const onboarding = read("app/admin/r4-onboarding.js");
  const workflow = read(".github/workflows/deploy-cloudflare-pages.yml");
  assert.match(workflow, /default: verify/);
  assert.match(workflow, /inputs\.mode == 'deploy'/);
  assert.match(workflow, /node scripts\/check_r4_selfserve_candidate\.mjs --require-prior-ci/);
  assert.match(workflow, /APPROVED_SHA: \$\{\{ vars\.TENNISNOTE_R4_ADMIN_APPROVED_SHA \}\}/);
  assert.match(workflow, /environment: tennisnote-r4-admin-production/);
  assert.match(workflow, /project-name=tennisnote-admin --branch=main/);
  assert.doesNotMatch(workflow, /project-name=tennisnote-app|scripts\/verify\.sh/);
  assert.match(onboarding, /tn_r4_prod_create_selfserve_branch/);
  assert.match(onboarding, /ctx\.selfServeOff/);
  const window = {};
  new Script(adapter).runInContext(createContext({ window }));
  let actor = "test-a";
  const calls = [];
  const client = { sessionSubject: () => actor, rpc: async (...args) => { calls.push(args); return { ok: true }; } };
  const own = "dc53dd51-546b-48fe-839b-f41abda564af";
  const foreign = "b17959c9-e60a-40d9-8539-4acccdeebcdc";
  const scoped = window.TennisNoteR4SelfserveClient.forBranch(client, own);
  assert.equal(scoped, window.TennisNoteR4SelfserveClient.forBranch(client, own));
  await scoped.rpc("tn_r4_get_operating_hours", { target_branch: own }, { retryAuth: true });
  assert.equal(calls[0][0], "tn_r4_prod_selfserve_get_hours");
  assert.equal(calls[0][2].requireCurrentSession, true);
  assert.equal(calls[0][2].retryAuth, false);
  await assert.rejects(scoped.rpc("tn_r4_get_operating_hours", { target_branch: foreign }));
  await assert.rejects(scoped.rpc("tn_r4_correct_pending_manual_payment", { target_branch_id: own }));
  await assert.rejects(scoped.rpc("tn_schedule_v2_save_lesson", { target_branch_id: own, target_schedule_kind: "regular", target_lesson_id: own }));
  actor = "test-b";
  await assert.rejects(scoped.rpc("tn_r4_my_managed_branches", {}));
  assert.equal(calls.length, 1);
  for (const path of paths) assert.doesNotMatch(read(path), /sb_secret_[a-zA-Z0-9_-]{16,}/);
  console.log("PASS exact reviewed administrator delta; scoped RPC/session/payment boundaries; protected deployment remains separate");
}
