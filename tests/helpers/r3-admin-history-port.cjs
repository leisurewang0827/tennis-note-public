const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-admin-history-source-parity.json"), "utf8"));
const unlockManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-admin-unlock-source-parity.json"), "utf8"));
const previewFenceManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-preview-identity-fence-source-parity.json"), "utf8"));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
function restoreManualPayoutSource(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  const authority = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-manual-payout-port-source-authority.json"), "utf8"));
  const row = authority.publicFiles.find(item => item.path === file);
  if (!row) return text;
  const source = text.replace(/\r\n/g, "\n");
  const baseCommit = authority.releaseSuccessor.baseCommit;
  const featureCommit = authority.releaseSuccessor.featureCommit;
  const commitFile = revision => execFileSync("git", ["show", revision + ":" + file], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
  if (row.releaseInvariantSha256) {
    const currentVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version;
    const sourceVersions = [authority.releaseSuccessor.baseVersion, authority.releaseSuccessor.targetVersion,
      JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version, inputVersion];
    const normalized = source.replace(/\?v=\d+\.\d+\.\d+/g, "?v=<VERSION>");
    const queries = [...source.matchAll(/\?v=(\d+\.\d+\.\d+)/g)];
    const sourceVersion = queries[0]?.[1];
    if (!sourceVersions.includes(sourceVersion) || queries.some(match => match[1] !== sourceVersion)) throw Error("R3 manual payout release source version drift: " + file);
    const baseline = commitFile(baseCommit);
    const baselineAtSourceVersion = baseline.replaceAll(authority.releaseSuccessor.baseVersion, sourceVersion);
    if (source === baselineAtSourceVersion) return source;
    if (queries.length !== row.versionQueryCount || sha(normalized) !== row.releaseInvariantSha256) throw Error("R3 manual payout release source candidate drift: " + file);
    const feature = commitFile(featureCommit).replace(/\?v=\d+\.\d+\.\d+/g, "?v=<VERSION>");
    if (sha(feature) !== row.releaseInvariantSha256) throw Error("R3 manual payout release feature object drift: " + file);
    return baseline.replaceAll(authority.releaseSuccessor.baseVersion, sourceVersion);
  }
  if (sha(source) !== row.canonicalLfSha256) throw Error("R3 manual payout source candidate drift: " + file);
  const blob = value => crypto.createHash("sha1").update("blob " + Buffer.byteLength(value, "utf8") + "\0").update(value, "utf8").digest("hex");
  const feature = commitFile(featureCommit);
  if (sha(feature) !== row.canonicalLfSha256 || blob(feature) !== row.gitBlob) throw Error("R3 manual payout feature object drift: " + file);
  const baseline = commitFile(baseCommit);
  if (sha(baseline) === row.canonicalLfSha256) throw Error("R3 manual payout inverse is empty: " + file);
  return baseline;
}
function restorePreviewIdentityFence(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  text = restoreManualPayoutSource(file, text, inputVersion);
  const entry = previewFenceManifest.files.find(item => item.path === file);
  if (!entry) return text;
  text = text.replaceAll(inputVersion, previewFenceManifest.publicVersion);
  if (sha(text) !== entry.candidateSha256) throw Error("R3 preview identity candidate drift: " + file);
  for (const hunk of [...entry.hunks].reverse()) {
    if (!hunk.after || text.split(hunk.after).length !== 2) throw Error("R3 preview identity inverse drift: " + file);
    text = text.replace(hunk.after, () => hunk.before);
  }
  if (sha(text) !== entry.baseSha256) throw Error("R3 preview identity baseline drift: " + file);
  return text.replaceAll(previewFenceManifest.publicVersion, inputVersion);
}
function restoreUnlock(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  // 최신 계정 보호를 먼저 역변환한 뒤 기존 잠금·이력 golden을 그대로 검사합니다.
  text = restorePreviewIdentityFence(file, text, inputVersion);
  const entry = unlockManifest.files.find(item => item.path === file);
  if (!entry) return text;
  // 최신 잠금 UI 수정만 정확히 역변환하고 이전 엑셀·연장·결제 golden은 보존한다.
  if (sha(text) !== entry.candidateSha256) throw Error("R3 unlock candidate drift: " + file);
  for (const hunk of [...entry.hunks].reverse()) {
    if (!hunk.after || text.split(hunk.after).length !== 2) throw Error("R3 unlock inverse hunk drift: " + file);
    text = text.replace(hunk.after, () => hunk.before);
  }
  if (sha(text) !== entry.baseSha256) throw Error("R3 unlock baseline drift: " + file);
  return text;
}
function restore(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  text = restoreUnlock(file, text, inputVersion);
  const entry = manifest.files.find(item => item.path === file);
  if (!entry) return text;
  text = text.replaceAll(inputVersion, manifest.publicVersion);
  if (sha(text) !== entry.candidateSha256) throw Error("R3 admin history candidate drift: " + file);
  for (const hunk of [...entry.hunks].reverse()) {
    const chars = Array.from(text);
    if (chars.slice(hunk.start, hunk.end).join("") !== hunk.after) throw Error("R3 admin history inverse drift: " + file);
    text = chars.slice(0, hunk.start).join("") + hunk.before + chars.slice(hunk.end).join("");
  }
  if (sha(text) !== entry.baseSha256) throw Error("R3 admin history baseline drift: " + file);
  return text.replaceAll(manifest.publicVersion, inputVersion);
}
module.exports = {root, manifest, unlockManifest, previewFenceManifest, sha, restoreManualPayoutSource, restorePreviewIdentityFence, restoreUnlock, restore};
