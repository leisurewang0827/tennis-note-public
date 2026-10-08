// 승인 전화번호 증분만 exact 후보/역변환 해시로 분리하고 기존 golden은 보존한다.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/verified-profile-phone-source-parity.json"), "utf8"));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
function restorePhone(file, text, inputVersion = JSON.parse(fs.readFileSync(path.join(root, "app/release.json"), "utf8")).version) {
  const row = manifest.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replaceAll(inputVersion, manifest.publicVersion);
  assert.equal(sha(text), row.candidateSha256, `phone candidate drift: ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after, `empty phone hunk: ${file}`);
    assert.equal(text.split(hunk.after).length, 2, `exact phone hunk: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(sha(text), row.baseSha256, `phone base drift: ${file}`);
  return text.replaceAll(manifest.publicVersion, inputVersion);
}
module.exports = { restorePhone, manifest };
