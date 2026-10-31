"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { validateLocalScope, validatePrBoundary, PIN, BASE, SOURCE, METADATA, CORRECTIVE, BRANCH, PROJECT,
  PHONE_PREDECESSOR, PHONE_CORRECTIVE_BASE, PHONE_BLOBLESS_BASE, PHONE_PIN, validatePhoneLocalScope, validatePhonePriorRun, validatePhonePrGraph,
  validatePhonePriorJobs, validatePhoneDeltaRows } = require("../scripts/check_r3_response_label_successor.cjs");

test("phone successor jobs and exact delta reject missing or extra evidence", () => {
  const step = { name: "Admit exact response-label successor", status: "completed", conclusion: "success" };
  const job = { name: "build-and-check", status: "completed", conclusion: "success", steps: [step] };
  assert.equal(validatePhonePriorJobs({ jobs: [job] }), true);
  for (const bad of [{ jobs: [] }, { jobs: [job, job] }, { jobs: [{ ...job, steps: [] }] },
    { jobs: [{ ...job, steps: [{ ...step, conclusion: "failure" }] }] }]) {
    assert.throws(() => validatePhonePriorJobs(bad), /STATUS_SUCCESSOR_HOLD/);
  }
  const wire = [".github/workflows/tennisnote-public-ci.yml", "scripts/collect_r3_response_label_pr.cjs"];
  const rows = [...Object.keys(PHONE_PIN), ...wire].map((p) => ["M", p]);
  assert.equal(validatePhoneDeltaRows(rows, wire), true);
  for (const bad of [rows.slice(1), [...rows, ["M", "extra"]], rows.map((x, i) => i ? x : ["A", x[1]])]) {
    assert.throws(() => validatePhoneDeltaRows(bad, wire), /STATUS_SUCCESSOR_HOLD/);
  }
});

test("phone successor graph: exact predecessor CI and PR metadata fail closed", () => {
  const repo = "leisurewang0827/tennis-note-public", head = "1".repeat(40), merge = "2".repeat(40);
  const run = { id: 41166580662, head_sha: PHONE_PREDECESSOR, event: "pull_request", run_attempt: 1,
    status: "completed", conclusion: "success", name: "Tennis Note Public PWA CI", workflow_id: 329932540,
    path: ".github/workflows/tennisnote-public-ci.yml", repository: { full_name: repo }, head_repository: { full_name: repo },
    pull_requests: [{ number: 228, head: { sha: head }, base: { sha: BASE } }] };
  assert.equal(validatePhonePriorRun(run, head).deploymentAdmitted, false);
  for (const change of [{ head_sha: head }, { run_attempt: 2 }, { conclusion: "failure" }, { workflow_id: 1 },
    { repository: { full_name: "other" } }, { head_repository: null }, { pull_requests: [] }]) {
    assert.throws(() => validatePhonePriorRun({ ...run, ...change }, head), /STATUS_SUCCESSOR_HOLD/);
  }
  const s = { event: "pull_request", repo, baseRepo: repo, headRepo: repo, base: BASE,
    baseRef: "codex/tennisnote-r3-current-term-dev570-20261031", headRef: BRANCH,
    attempt: 1, number: 228, ref: "refs/pull/228/merge", workflow: "Tennis Note Public PWA CI",
    workflowRef: `${repo}/.github/workflows/tennisnote-public-ci.yml@refs/pull/228/merge`,
    head, merge, headTree: head, mergeTree: head, headParents: [PHONE_BLOBLESS_BASE], bloblessParents: [PHONE_CORRECTIVE_BASE], correctiveParents: [PHONE_PREDECESSOR], mergeParents: [BASE, head],
    githubSha: merge, workflowSha: merge, clean: true, indexClean: true };
  assert.equal(validatePhonePrGraph(s).status, "PHONE_PR_METADATA_ONLY_NOT_ADMITTED");
  for (const change of [{ number: 229 }, { base: head }, { headRepo: "other" }, { attempt: 2 },
    { headParents: [CORRECTIVE] }, { mergeParents: [head, BASE] }, { mergeTree: merge }, { clean: false }]) {
    assert.throws(() => validatePhonePrGraph({ ...s, ...change }), /STATUS_SUCCESSOR_HOLD/);
  }
});

test("phone corrective prior immutable head and current PR head stay distinct", () => {
  const repo = "leisurewang0827/tennis-note-public", current = "1".repeat(40);
  const run = { id: 41166580662, head_sha: PHONE_PREDECESSOR, event: "pull_request", run_attempt: 1,
    status: "completed", conclusion: "success", name: "Tennis Note Public PWA CI", workflow_id: 329932540,
    path: ".github/workflows/tennisnote-public-ci.yml", repository: { full_name: repo }, head_repository: { full_name: repo },
    pull_requests: [{ number: 228, head: { sha: current }, base: { sha: BASE } }] };
  assert.equal(validatePhonePriorRun(run, current).deploymentAdmitted, false);
  assert.throws(() => validatePhonePriorRun({ ...run, head_sha: current }, current));
  assert.throws(() => validatePhonePriorRun(run, "2".repeat(40)));
});

test("phone corrective blobless lineage pins all three historical parents", () => {
  const repo = "leisurewang0827/tennis-note-public", head = "1".repeat(40), merge = "2".repeat(40);
  const s = { event: "pull_request", repo, baseRepo: repo, headRepo: repo, base: BASE,
    baseRef: "codex/tennisnote-r3-current-term-dev570-20261031", headRef: BRANCH,
    attempt: 1, number: 228, ref: "refs/pull/228/merge", workflow: "Tennis Note Public PWA CI",
    workflowRef: `${repo}/.github/workflows/tennisnote-public-ci.yml@refs/pull/228/merge`,
    head, merge, headTree: head, mergeTree: head, headParents: [PHONE_BLOBLESS_BASE],
    bloblessParents: [PHONE_CORRECTIVE_BASE], correctiveParents: [PHONE_PREDECESSOR], mergeParents: [BASE, head],
    githubSha: merge, workflowSha: merge, clean: true, indexClean: true };
  assert.equal(validatePhonePrGraph(s).status, "PHONE_PR_METADATA_ONLY_NOT_ADMITTED");
  for (const key of ["headParents", "bloblessParents", "correctiveParents"]) {
    assert.throws(() => validatePhonePrGraph({ ...s, [key]: ["3".repeat(40)] }));
  }
});

test("phone successor: exact new scope stays separate from old pins", () => {
  const s = { predecessor: PHONE_PREDECESSOR, branch: BRANCH, environment: "development", projectFingerprint: PROJECT,
    rollbackCommit: PHONE_PREDECESSOR, version: "1.0.572", releaseId: "2026.10.31.03", memberCache: 605, coachCache: 578,
    nativeBuildChanged: false, databaseAction: false, paths: Object.keys(PHONE_PIN), hashes: { ...PHONE_PIN } };
  for (const p of s.paths) {
    s.hashes[p] = createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n")).digest("hex");
  }
  assert.deepEqual(validatePhoneLocalScope(s), { status: "LOCAL_SCOPE_ONLY_NOT_DEPLOYABLE", files: 15 });
  for (const change of [{ predecessor: CORRECTIVE }, { rollbackCommit: BASE }, { environment: "production" },
    { memberCache: 604 }, { coachCache: 577 }, { paths: [...s.paths, "extra"] },
    { paths: s.paths.slice(1) }, { hashes: { ...s.hashes, "app/admin/domain/coaches.js": "0".repeat(64) } },
    { databaseAction: true }, { nativeBuildChanged: true }]) {
    assert.throws(() => validatePhoneLocalScope({ ...s, ...change }), /STATUS_SUCCESSOR_HOLD/);
  }
  assert.equal(PIN["app/admin/index.html"], "a96fee16f09a376844ffa7de153cb3f45cb40d2692363f7bd11ae6b3f612a8fe");
});

function candidate() {
  return { base: BASE, branch: BRANCH, environment: "development", projectFingerprint: PROJECT,
    rollbackCommit: BASE, version: "1.0.571", releaseId: "2026.10.31.02", memberCache: 604, coachCache: 577,
    nativeBuildChanged: false, databaseAction: false, paths: Object.keys(PIN), hashes: { ...PIN } };
}
test("exact local scope is not a deploy authorization", () => {
  assert.deepEqual(validateLocalScope(candidate()), { status: "LOCAL_SCOPE_ONLY_NOT_DEPLOYABLE", files: 15 });
});
test("all fifteen candidate files match the exact LF-normalized content pins", () => {
  const c = candidate();
  for (const p of c.paths) {
    const content = fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
    c.hashes[p] = createHash("sha256").update(content).digest("hex");
  }
  assert.equal(validateLocalScope(c).status, "LOCAL_SCOPE_ONLY_NOT_DEPLOYABLE");
});
test("identity, environment, cache, source and diff drift are rejected", () => {
  const c = candidate();
  const bad = [
    { ...c, base: "0".repeat(40) }, { ...c, branch: "main" }, { ...c, environment: "production" },
    { ...c, projectFingerprint: "0".repeat(64) }, { ...c, rollbackCommit: "0".repeat(40) },
    { ...c, version: "1.0.570" }, { ...c, releaseId: "2026.10.31.01" },
    { ...c, memberCache: 603 }, { ...c, coachCache: 576 }, { ...c, nativeBuildChanged: true },
    { ...c, databaseAction: true }, { ...c, paths: [...c.paths, "app/other.js"] },
    { ...c, paths: c.paths.slice(1) }, { ...c, paths: [...c.paths.slice(1), c.paths[1]] },
    { ...c, hashes: { ...c.hashes, "app/admin/views/billing.js": "0".repeat(64) } },
    { ...c, hashes: { ...c.hashes, "unknown": "0".repeat(64) } },
  ];
  for (const item of bad) assert.throws(() => validateLocalScope(item), /STATUS_SUCCESSOR_HOLD/);
});
test("inherited hashes cannot impersonate exact own pins", () => {
  const c = candidate(), inherited = Object.create(PIN);
  for (let i = 0; i < 15; i++) inherited[`unknown${i}`] = "x";
  assert.throws(() => validateLocalScope({ ...c, hashes: inherited }), /STATUS_SUCCESSOR_HOLD/);
});
test("PR metadata and merge parent order fail closed without admitting CI", () => {
  const head = "1".repeat(40), merge = "2".repeat(40), tree = "3".repeat(40), source = SOURCE;
  const s = { event: "pull_request", repo: "leisurewang0827/tennis-note-public", baseRepo: "leisurewang0827/tennis-note-public",
    headRepo: "leisurewang0827/tennis-note-public", base: BASE, baseRef: "codex/tennisnote-r3-current-term-dev570-20261031",
    headRef: BRANCH, attempt: 1, number: 7, ref: "refs/pull/7/merge", workflow: "Tennis Note Public PWA CI",
    workflowRef: "leisurewang0827/tennis-note-public/.github/workflows/tennisnote-public-ci.yml@refs/pull/7/merge",
    head, source, metadata: METADATA, corrective: CORRECTIVE, merge, headTree: tree, mergeTree: tree, headParents: [CORRECTIVE], correctiveParents: [METADATA], metadataParents: [source], sourceParents: [BASE], mergeParents: [BASE, head],
    githubSha: merge, workflowSha: merge, clean: true, indexClean: true };
  assert.equal(validatePrBoundary(s).status, "PR_METADATA_ONLY_NOT_ADMITTED");
  for (const change of [{ event: "push" }, { repo: "unknown" }, { headRepo: "fork" }, { base: head },
    { attempt: 2 }, { ref: "refs/heads/main" }, { mergeParents: [head, BASE] }, { mergeTree: head },
    { headParents: [merge] }, { correctiveParents: [head] }, { metadataParents: [head] }, { sourceParents: [head] }, { sourceParents: [BASE, merge] }, { workflowSha: head }, { clean: false }, { indexClean: false }]) {
    assert.throws(() => validatePrBoundary({ ...s, ...change }), /STATUS_SUCCESSOR_HOLD/);
  }
});
test("fourth layer keeps the previously verified corrective parent", () => {
  const head = "1".repeat(40), merge = "2".repeat(40), tree = "3".repeat(40);
  const s = { event: "pull_request", repo: "leisurewang0827/tennis-note-public", baseRepo: "leisurewang0827/tennis-note-public", headRepo: "leisurewang0827/tennis-note-public",
    base: BASE, baseRef: "codex/tennisnote-r3-current-term-dev570-20261031", headRef: BRANCH, attempt: 1, number: 7,
    ref: "refs/pull/7/merge", workflow: "Tennis Note Public PWA CI", workflowRef: "leisurewang0827/tennis-note-public/.github/workflows/tennisnote-public-ci.yml@refs/pull/7/merge",
    head, source: SOURCE, metadata: METADATA, corrective: CORRECTIVE, merge, headTree: tree, mergeTree: tree,
    headParents: [CORRECTIVE], correctiveParents: [METADATA], metadataParents: [SOURCE], sourceParents: [BASE], mergeParents: [BASE, head], githubSha: merge, workflowSha: merge, clean: true, indexClean: true };
  assert.equal(validatePrBoundary(s).status, "PR_METADATA_ONLY_NOT_ADMITTED");
  for (const bad of [{ headParents: [METADATA] }, { correctiveParents: [SOURCE] }, { corrective: "4".repeat(40) }]) {
    assert.throws(() => validatePrBoundary({ ...s, ...bad }), /STATUS_SUCCESSOR_HOLD/);
  }
});
