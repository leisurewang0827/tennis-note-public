import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import layerGuard from "./helpers/r3-layered-historical-source.cjs";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const normalize = value => value.replace(/\r\n?/g, "\n");
const cacheVersion = path => {
  const source = read(path);
  const match = source.match(/^const CACHE_NAME = "[^"]+-v(\d+)";/m);
  assert.ok(match, `${path}: cache version missing`);
  return Number(match[1]);
};

const release = JSON.parse(read("app/release.json"));
release.memberCache = cacheVersion("app/tennis-note-member-app/service-worker.js");
release.coachCache = cacheVersion("app/tennis-note-coach-app/service-worker.js");
const baseRelease = JSON.parse(execFileSync("git", [
  "show", `${layerGuard.contract.base}:app/release.json`,
], { encoding: "utf8" }));
baseRelease.memberCache = Number(execFileSync("git", [
  "show", `${layerGuard.contract.base}:app/tennis-note-member-app/service-worker.js`,
], { encoding: "utf8" }).match(/^const CACHE_NAME = "[^"]+-v(\d+)";/m)[1]);
baseRelease.coachCache = Number(execFileSync("git", [
  "show", `${layerGuard.contract.base}:app/tennis-note-coach-app/service-worker.js`,
], { encoding: "utf8" }).match(/^const CACHE_NAME = "[^"]+-v(\d+)";/m)[1]);

const tracked = execFileSync("git", ["diff", "--name-only", layerGuard.contract.base, "--", "app"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean);
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "app"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean);
const actualPaths = [...new Set([...tracked, ...untracked])].sort();

test("R3 1.0.554 layer pins exact modular app set, source, release and monotonic caches", () => {
  const sourceParity = JSON.parse(read("tests/fixtures/r3-manual-payout-source-parity.json"));
  assert.equal(sourceParity.privateSourceBinding.commit, layerGuard.contract.privateSourceCommit);
  assert.equal(layerGuard.validateReleaseLayer({
    actualPaths,
    readCandidate: path => normalize(read(path)),
    privateSourceCommit: sourceParity.privateSourceBinding.commit,
    release,
    previousRelease: baseRelease,
  }), true);
  assert.equal(layerGuard.contract.productFiles.length, 19);
  assert.deepEqual(release.nativePlatforms, baseRelease.nativePlatforms);
  for (const row of layerGuard.contract.productFiles) {
    assert.equal(
      normalize(layerGuard.restoreBeforeManualPayoutLayer(row.path, read(row.path))),
      execFileSync("git", ["show", `${layerGuard.contract.base}:${row.path}`], { encoding: "utf8" }).replace(/\r\n/g, "\n"),
      `${row.path}: exact historical 1.0.553 layer restoration`,
    );
  }
});

test("R3 1.0.554 layer rejects missing, duplicate, changed, wrong-source and regressed candidates", () => {
  const args = {
    actualPaths,
    readCandidate: path => normalize(read(path)),
    privateSourceCommit: layerGuard.contract.privateSourceCommit,
    release,
    previousRelease: baseRelease,
  };
  const missing = structuredClone(layerGuard.contract);
  missing.productFiles.pop();
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: missing }), /exact app path set drift/);

  const duplicate = structuredClone(layerGuard.contract);
  duplicate.productFiles[1].path = duplicate.productFiles[0].path;
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: duplicate }), /duplicate candidate path/);

  const changed = structuredClone(layerGuard.contract);
  changed.productFiles[0].candidateSha256 = "0".repeat(64);
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: changed }), /candidate hash drift/);
  const wrongBase = structuredClone(layerGuard.contract);
  wrongBase.base = "0".repeat(40);
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: wrongBase }), /historical base source drift/);
  const wrongBlob = structuredClone(layerGuard.contract);
  wrongBlob.productFiles[0].baseGitBlobSha1 = "0".repeat(40);
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: wrongBlob }), /base blob drift/);
  const wrongBaseContent = structuredClone(layerGuard.contract);
  wrongBaseContent.productFiles[0].baseSha256 = "0".repeat(64);
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, layer: wrongBaseContent }), /base content drift/);
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, privateSourceCommit: "0".repeat(40) }), /private source commit drift/);

  const regressed = { ...release, version: "1.0.553", releaseId: "2026.10.21.01", memberCache: 589, coachCache: 562 };
  assert.throws(() => layerGuard.validateReleaseLayer({ ...args, release: regressed }), /release version drift|release id drift|cache drift/);
  assert.equal(layerGuard.compareVersions("1.0.100", "1.0.99"), 1);
  assert.equal(layerGuard.compareVersions("1.0.99", "1.0.100"), -1);
  assert.throws(() => layerGuard.compareVersions("1.0.x", "1.0.100"), /invalid semantic version/);
});
