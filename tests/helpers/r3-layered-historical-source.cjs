"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = "tests/fixtures/r3-manual-payout-release-layer.json";
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, CONTRACT_PATH), "utf8"));
const normalize = value => value.toString("utf8").replace(/\r\n?/g, "\n");
const sha256 = value => crypto.createHash("sha256").update(normalize(value), "utf8").digest("hex");
const fileRows = new Map(contract.productFiles.map(row => [row.path, row]));

function validateReleaseLayer({
  layer = contract,
  actualPaths,
  readCandidate,
  privateSourceCommit,
  release,
  previousRelease,
}) {
  assert.equal(layer.contract, "r3-manual-payout-public-release-layer/1");
  assert.match(layer.base, /^[0-9a-f]{40}$/);
  assert.equal(layer.base, contract.base, "historical base source drift");
  assert.equal(layer.privateSourceCommit, privateSourceCommit, "private source commit drift");
  const paths = layer.productFiles.map(row => row.path);
  assert.equal(new Set(paths).size, paths.length, "duplicate candidate path");
  assert.deepEqual(paths.slice().sort(), actualPaths.slice().sort(), "exact app path set drift");
  for (const row of layer.productFiles) {
    assert.match(row.baseGitBlobSha1, /^[0-9a-f]{40}$/);
    assert.match(row.baseSha256, /^[0-9a-f]{64}$/);
    assert.match(row.candidateSha256, /^[0-9a-f]{64}$/);
    assert.equal(sha256(readCandidate(row.path)), row.candidateSha256, `candidate hash drift: ${row.path}`);
    const baseRef = `${layer.base}:${row.path}`;
    const actualBlob = execFileSync("git", ["rev-parse", baseRef], { cwd: ROOT, encoding: "utf8" }).trim();
    assert.equal(actualBlob, row.baseGitBlobSha1, `base blob drift: ${row.path}`);
    const actualBase = execFileSync("git", ["show", baseRef], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(sha256(actualBase), row.baseSha256, `base content drift: ${row.path}`);
  }
  assert.equal(release.version, layer.release.version, "release version drift");
  assert.equal(release.releaseId, layer.release.releaseId, "release id drift");
  assert.equal(release.memberCache, layer.release.memberCache, "member cache drift");
  assert.equal(release.coachCache, layer.release.coachCache, "coach cache drift");
  assert.ok(compareVersions(release.version, previousRelease.version) > 0, "version must increase");
  assert.ok(release.releaseId > previousRelease.releaseId, "release id must increase");
  assert.ok(Number(release.memberCache) > Number(previousRelease.memberCache), "member cache must increase");
  assert.ok(Number(release.coachCache) > Number(previousRelease.coachCache), "coach cache must increase");
  assert.deepEqual(release.nativePlatforms, previousRelease.nativePlatforms, "native artifact contract changed");
  return true;
}

function compareVersions(left, right) {
  const parse = value => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value));
    assert.ok(match, `invalid semantic version: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left), b = parse(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function restoreBeforeManualPayoutLayer(file, currentText) {
  const row = fileRows.get(file);
  if (!row) return normalize(currentText);
  const blob = execFileSync("git", ["rev-parse", `${contract.base}:${file}`], {
    cwd: ROOT, encoding: "utf8",
  }).trim();
  assert.equal(blob, row.baseGitBlobSha1, `manual payout base blob drift: ${file}`);
  const prior = execFileSync("git", ["show", `${contract.base}:${file}`], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(sha256(prior), row.baseSha256, `manual payout base content drift: ${file}`);
  const current = normalize(currentText);
  if (sha256(current) === row.baseSha256) return current;
  assert.equal(sha256(current), row.candidateSha256, `manual payout layer candidate drift: ${file}`);
  return normalize(prior);
}

module.exports = {
  ROOT,
  CONTRACT_PATH,
  contract,
  sha256,
  compareVersions,
  validateReleaseLayer,
  restoreBeforeManualPayoutLayer,
};
