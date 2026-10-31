"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { validateLocalScope, validatePrBoundary, PIN, BASE, SOURCE, METADATA, BRANCH, PROJECT } = require("../scripts/check_r3_response_label_successor.cjs");

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
    head, source, metadata: METADATA, merge, headTree: tree, mergeTree: tree, headParents: [METADATA], metadataParents: [source], sourceParents: [BASE], mergeParents: [BASE, head],
    githubSha: merge, workflowSha: merge, clean: true, indexClean: true };
  assert.equal(validatePrBoundary(s).status, "PR_METADATA_ONLY_NOT_ADMITTED");
  for (const change of [{ event: "push" }, { repo: "unknown" }, { headRepo: "fork" }, { base: head },
    { attempt: 2 }, { ref: "refs/heads/main" }, { mergeParents: [head, BASE] }, { mergeTree: head },
    { headParents: [merge] }, { metadataParents: [head] }, { sourceParents: [head] }, { sourceParents: [BASE, merge] }, { workflowSha: head }, { clean: false }, { indexClean: false }]) {
    assert.throws(() => validatePrBoundary({ ...s, ...change }), /STATUS_SUCCESSOR_HOLD/);
  }
});
