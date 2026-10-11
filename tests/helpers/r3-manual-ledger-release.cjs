"use strict";
// Exact approved R3 inverse ahead of older release/product evidence. No golden repin.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const integration = require("./integrated-feature-release.cjs");
const normalize = text => text.replace(/\r\n/g, "\n");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const raw = normalize(fs.readFileSync(path.join(root, "tests/fixtures/r3-manual-ledger-release-parity.json"), "utf8"));
assert.equal(hash(raw), "03f6688fc31517f55a5f999f4c1a13502876b762641b416dcdb4409068c0ac16", "reviewed R3 inverse contract drift");
const contract = JSON.parse(raw);
assert.equal(contract.version, "r3-manual-ledger-release-inverse/1");
assert.equal(contract.publicBase, "686cc97d9676da2d16ca3cdfbd862dc9cd19434e");
assert.equal(contract.publicFeature, "17b5f7239392789b77c1d1b8c33e01a6f9ba2920");
assert.equal(contract.privateAuthority, "32c274fdec7fca6e7e66e629459fea73b48692fc");
assert.equal(contract.frozenManifestSha256, "58f97625a6267448a35bc27a87015535a132ab579cebf69c526e7ef11a1d487d");
assert.equal(contract.products.length, 18);
assert.equal(new Set(contract.products.map(row => row.path)).size, 18);
function restoreCandidate(file, text) {
  text = integration.restore(file, normalize(text));
  if (text === null) return null;
  const row = contract.products.find(item => item.path === file.replace(/\\/g, "/"));
  if (!row) return text;
  assert.equal(hash(text), row.afterSha256, `R3 reviewed candidate drift: ${file}`);
  if (row.status === "A") {
    assert.equal(row.beforeSha256, null);
    assert.equal(row.hunks.length, 0);
    assert.equal(text, row.addedSource);
    return null; // absence is distinct from an empty historical file
  }
  assert.equal(row.status, "M");
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after && text.split(hunk.after).length === 2, `R3 unique inverse: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(hash(text), row.beforeSha256, `R3 exact baseline drift: ${file}`);
  return text;
}
function assertAddedAbsentAt(base, file) {
  assert(contract.products.some(row => row.path === file && row.status === "A"), "unapproved added path");
  const names = execFileSync("git", ["ls-tree", "--name-only", base, "--", file], {cwd:root,encoding:"utf8"});
  assert.equal(names.trim(), "", `R3 added path existed in historical base: ${file}`);
}
function validateAll() {
  for (const row of contract.products) {
    const restored = restoreCandidate(row.path, fs.readFileSync(path.join(root,row.path),"utf8"));
    if (row.status === "A") assertAddedAbsentAt(contract.publicBase,row.path);
    else assert.equal(restored, normalize(execFileSync("git", ["show", contract.publicBase+":"+row.path], {cwd:root,encoding:"utf8",maxBuffer:8e6})), row.path);
    assert.equal(hash(normalize(execFileSync("git", ["show", contract.publicFeature+":"+row.path], {cwd:root,encoding:"utf8",maxBuffer:8e6}))), row.frozenFeatureSha256, row.path);
  }
}
module.exports = {contract, hash, normalize, restoreCandidate, assertAddedAbsentAt, validateAll};
