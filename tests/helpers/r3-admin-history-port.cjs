const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-admin-history-source-parity.json"), "utf8"));
const unlockManifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-admin-unlock-source-parity.json"), "utf8"));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
function restoreUnlock(file, text) {
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
  text = restoreUnlock(file, text);
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
module.exports = {root, manifest, unlockManifest, sha, restoreUnlock, restore};
