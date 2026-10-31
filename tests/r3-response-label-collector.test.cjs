"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { wrapWorkflow, wrapDeployWorkflow, validateLayerRows, verifyReceiptFields } = require("../scripts/collect_r3_response_label_pr.cjs");
test("a real dirty checkout is held before CI environment or API access", () => {
  const root = path.join(__dirname, "..");
  const result = spawnSync(process.execPath, ["scripts/collect_r3_response_label_pr.cjs"], {
    cwd: root, encoding: "utf8", timeout: 20000, env: { ...process.env, GITHUB_TOKEN: "synthetic-not-a-credential" },
  });
  assert.equal(result.status, 1);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, { status: "HOLD", reason: "DIRTY_WORKTREE", deploymentAdmitted: false });
  assert.equal(result.stderr, "");
  assert.ok(!result.stdout.includes("synthetic-not-a-credential"));
});
test("workflow wrapper preserves the entire prior workflow and gates after tests", () => {
  const root = path.join(__dirname, "..");
  const previous = execFileSync("git", ["show", "efc84a88a389b292ff226b760c935de19ac9f07b:.github/workflows/tennisnote-public-ci.yml"], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_LAZY_FETCH: "1" } }).replace(/\r\n/g, "\n");
  const actual = fs.readFileSync(path.join(root, ".github/workflows/tennisnote-public-ci.yml"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(actual, wrapWorkflow(previous));
  assert.ok(actual.indexOf("node --test tests/r3-admin-response-label.test.js") < actual.indexOf("echo 'scoped=true'"));
  assert.throws(() => wrapWorkflow("bad"), /WORKFLOW_BASE/);
});
test("deploy workflow wrapper only adds the pinned Node runtime", () => {
  const root = path.join(__dirname, ".."), file = ".github/workflows/deploy-cloudflare-pages-dev.yml";
  const previous = execFileSync("git", ["show", `efc84a88a389b292ff226b760c935de19ac9f07b:${file}`], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_LAZY_FETCH: "1" } }).replace(/\r\n/g, "\n");
  const actual = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
  assert.equal(actual, wrapDeployWorkflow(previous));
  assert.throws(() => wrapDeployWorkflow("bad"), /DEPLOY_WORKFLOW_BASE/);
});
test("scoped signal follows source and all focused checks with no branch-only job skip", () => {
  const root = path.join(__dirname, ".."), file = ".github/workflows/tennisnote-public-ci.yml";
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const scope = text.indexOf("echo 'scoped=true'");
  for (const required of ["node scripts/collect_r3_response_label_pr.cjs", "node --test tests/r3-admin-response-label.test.js", "python tests/r3-response-label-deploy.test.py"]) {
    assert.ok(text.indexOf(required) >= 0 && text.indexOf(required) < scope);
  }
  assert.ok(text.includes("/.github/workflows/tennisnote-public-ci.yml"));
  assert.ok(text.includes("/tests/fixtures/r3-dev-cache-floors.json"));
  assert.ok(!/build-and-check:\s*\n\s*if:/.test(text));
});
test("workflow wrapper two-layer paths reject missing, unknown and wrong-status entries", () => {
  const paths = ["a", "b"], expected = (p) => p === "a" ? "M" : "A";
  assert.doesNotThrow(() => validateLayerRows([["M", "a"], ["A", "b"]], paths, expected));
  for (const rows of [[["M", "a"]], [["M", "a"], ["A", "c"]], [["M", "a"], ["M", "b"]]]) {
    assert.throws(() => validateLayerRows(rows, paths, expected), /LAYER_SCOPE/);
  }
});
test("receipt requires exact source context and never authorizes deployment", () => {
  const head = "1".repeat(40), source = "2".repeat(40), merge = "3".repeat(40), tree = "4".repeat(40), wire = "5".repeat(64);
  const context = { head, source, merge, tree, workflowSha: merge, wiringLfSha256: wire };
  const receipt = { contract: "r3-response-label-source/1", status: "SOURCE_SCOPE_PROVEN", ...context,
    productFiles: 15, wiringFiles: 8, deploymentAdmitted: false };
  assert.equal(verifyReceiptFields(receipt, context), true);
  for (const change of [{ status: "FACTS_ONLY_NOT_ADMITTED" }, { deploymentAdmitted: true }, { head: source },
    { source: head }, { merge: head }, { tree: head }, { workflowSha: head }, { wiringLfSha256: "0".repeat(64) },
    { productFiles: 14 }, { wiringFiles: 7 }]) {
    assert.throws(() => verifyReceiptFields({ ...receipt, ...change }, context), /RECEIPT_HOLD/);
  }
});
