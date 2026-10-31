"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { wrapWorkflow, wrapDeployWorkflow, wrapPhoneWorkflow, validateLayerRows, verifyReceiptFields, decodePinnedBlob, ensurePinnedBlobs, safeHold, FIX, AUTH_FIX, BASE_BLOBS, PHONE_WIRING, phoneGithubJson } = require("../scripts/collect_r3_response_label_pr.cjs");

test("phone corrective diagnostics allow only fixed redacted codes", () => {
  assert.equal(safeHold(Error("PHONE_API_HTTP")).reason, "PHONE_API_HTTP");
  assert.equal(safeHold(Error("STATUS_SUCCESSOR_HOLD")).reason, "STATUS_SUCCESSOR_HOLD");
  assert.equal(safeHold(Error("PHONE_API_HTTP raw private detail")).reason, "COLLECTION_HOLD");
});
const { CORRECTIVE } = require("../scripts/check_r3_response_label_successor.cjs");
const { createHash } = require("node:crypto");
test("phone successor workflow is the exact additive wrapper around the predecessor", () => {
  const root = path.join(__dirname, ".."), file = ".github/workflows/tennisnote-public-ci.yml";
  const previous = execFileSync("git", ["show", `470a2b9427eaf29aff9e6dd9b89ab608145dfa37:${file}`],
    { cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_LAZY_FETCH: "1" } }).replace(/\r\n/g, "\n");
  const current = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
  assert.equal(wrapPhoneWorkflow(previous), current);
  assert.throws(() => wrapPhoneWorkflow(previous.replace("--prepare-base", "--wrong")), /PHONE_WORKFLOW_OLD/);
  assert.throws(() => wrapPhoneWorkflow(previous.replace("/app/admin/views/billing.js", "/different")), /PHONE_WORKFLOW_SPARSE/);
});
test("phone successor collector allows only exact authenticated read endpoints", async () => {
  const original = global.fetch, calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, hasAuth: options.headers.Authorization === "Bearer synthetic-token", redirect: options.redirect });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    assert.deepEqual(await phoneGithubJson("pulls/228", "synthetic-token"), { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].hasAuth, true);
    assert.equal(calls[0].redirect, "error");
    await assert.rejects(phoneGithubJson("pulls/229", "synthetic-token"), /PHONE_API_SCOPE/);
    await assert.rejects(phoneGithubJson("pulls/228", ""), /PHONE_API_SCOPE/);
    assert.equal(calls.length, 1, "invalid input never reaches network");
    global.fetch = async () => new Response("denied", { status: 403 });
    await assert.rejects(phoneGithubJson("actions/runs/41166580662", "synthetic-token"), /PHONE_API_HTTP/);
    assert.equal(new Set(PHONE_WIRING).size, PHONE_WIRING.length);
  } finally { global.fetch = original; }
});
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
    productFiles: 15, wiringFiles: 8, priorHead: CORRECTIVE, priorCiRun: 41165808761, deploymentAdmitted: false };
  assert.equal(verifyReceiptFields(receipt, context), true);
  for (const change of [{ status: "FACTS_ONLY_NOT_ADMITTED" }, { deploymentAdmitted: true }, { head: source },
    { source: head }, { merge: head }, { tree: head }, { workflowSha: head }, { wiringLfSha256: "0".repeat(64) },
    { productFiles: 14 }, { wiringFiles: 7 }]) {
    assert.throws(() => verifyReceiptFields({ ...receipt, ...change }, context), /RECEIPT_HOLD/);
  }
});
test("auth fourth layer is exactly the prior seven wiring paths plus deployment workflow", () => {
  const rows = AUTH_FIX.map((p) => ["M", p]);
  assert.equal(AUTH_FIX.length, 8);
  assert.deepEqual(new Set(AUTH_FIX), new Set([...FIX, ".github/workflows/deploy-cloudflare-pages-dev.yml"]));
  assert.doesNotThrow(() => validateLayerRows(rows, AUTH_FIX, () => "M"));
  assert.throws(() => validateLayerRows([...rows.slice(1), ["M", "unknown"]], AUTH_FIX, () => "M"), /LAYER_SCOPE/);
});
test("auth deploy wrapper adds token to exactly two preflight steps", () => {
  const root = path.join(__dirname, ".."), file = ".github/workflows/deploy-cloudflare-pages-dev.yml";
  const previous = execFileSync("git", ["show", `efc84a88a389b292ff226b760c935de19ac9f07b:${file}`], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_LAZY_FETCH: "1" } }).replace(/\r\n/g, "\n");
  const actual = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
  assert.equal(actual, wrapDeployWorkflow(previous));
  assert.equal((actual.match(/STATUS_GITHUB_TOKEN:/g) || []).length, 2);
  assert.ok(!actual.includes("actions: write"));
});
test("receipt pinned blob decoder rejects malformed data, wrong size and hashes", () => {
  const bytes = Buffer.from("synthetic\n"), size = bytes.length;
  const oid = createHash("sha1").update(Buffer.from(`blob ${size}\0`)).update(bytes).digest("hex");
  const lf = createHash("sha256").update(bytes).digest("hex");
  const payload = { sha: oid, size, encoding: "base64", content: bytes.toString("base64") };
  assert.deepEqual(decodePinnedBlob(payload, oid, size, lf), bytes);
  for (const bad of [{ ...payload, content: "???" }, { ...payload, size: size + 1 }, { ...payload, sha: "0".repeat(40) }]) {
    assert.throws(() => decodePinnedBlob(bad, oid, size, lf), /BLOB_/);
  }
  assert.throws(() => decodePinnedBlob(payload, oid, size, "0".repeat(64)), /BLOB_IDENTITY/);
});
test("receipt corrective layer admits only the exact modified wiring paths", () => {
  const rows = FIX.map((p) => ["M", p]);
  assert.doesNotThrow(() => validateLayerRows(rows, FIX, () => "M"));
  for (const bad of [rows.slice(1), [...rows.slice(1), ["M", "unknown"]], rows.map((r, i) => i ? r : ["A", r[1]])]) {
    assert.throws(() => validateLayerRows(bad, FIX, () => "M"), /LAYER_SCOPE/);
  }
});
test("receipt missing pinned blob is fetched once and verified after storing", async () => {
  const bytes = Buffer.from("synthetic\n"), size = bytes.length;
  const oid = createHash("sha1").update(Buffer.from(`blob ${size}\0`)).update(bytes).digest("hex");
  const lf = createHash("sha256").update(bytes).digest("hex");
  let stored = null, fetches = 0, writes = 0;
  const result = await ensurePinnedBlobs([[oid, size, lf]], async () => stored,
    async () => { fetches++; return { sha: oid, size, encoding: "base64", content: bytes.toString("base64") }; },
    async (value) => { writes++; stored = value; return oid; });
  assert.deepEqual(result, [true]); assert.equal(fetches, 1); assert.equal(writes, 1);
  await assert.rejects(() => ensurePinnedBlobs([[oid, size, lf]], async () => null,
    async () => ({ sha: oid, size, encoding: "base64", content: "!!!" }), async () => { throw Error("unexpected write"); }), /BLOB_ENCODING/);
});
test("receipt failure output only exposes allowlisted reason codes", () => {
  assert.deepEqual(safeHold(Error("BLOB_IDENTITY")), { status: "HOLD", reason: "BLOB_IDENTITY", deploymentAdmitted: false });
  for (const message of ["SECRET", "token=synthetic", "", "C:\\private\\path"]) {
    assert.deepEqual(safeHold(Error(message)), { status: "HOLD", reason: "COLLECTION_HOLD", deploymentAdmitted: false });
  }
});
test("receipt pinned base blobs match exact historical git bytes", () => {
  const root = path.join(__dirname, ".."), base = "efc84a88a389b292ff226b760c935de19ac9f07b";
  const paths = [".github/workflows/tennisnote-public-ci.yml", ".github/workflows/deploy-cloudflare-pages-dev.yml"];
  assert.equal(BASE_BLOBS.length, paths.length);
  for (let i = 0; i < paths.length; i++) {
    const bytes = execFileSync("git", ["show", `${base}:${paths[i]}`], { cwd: root, env: { ...process.env, GIT_NO_LAZY_FETCH: "1" } });
    const [oid, size, lf] = BASE_BLOBS[i];
    assert.equal(bytes.length, size);
    assert.equal(createHash("sha1").update(Buffer.from(`blob ${size}\0`)).update(bytes).digest("hex"), oid);
    assert.equal(createHash("sha256").update(bytes.toString("utf8").replace(/\r\n/g, "\n")).digest("hex"), lf);
  }
});
