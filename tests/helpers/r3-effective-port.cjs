/* 원본 projection의 exact 후보 해시를 확인한 뒤 승인된 부분만 역변환한다. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-effective-source-parity.json"), "utf8"));
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
function normalize(text) { return text.replace(/\r\n/g, "\n"); }
function restore(file, text) {
  const entry = manifest.files.find(item => item.path === file);
  if (!entry) return text;
  if (sha(text) !== entry.candidateSha256) throw Error("candidate drift (R3 projection exact hash): " + file);
  if (entry.new) return null;
  for (const hunk of [...entry.hunks].reverse()) {
    const chars = Array.from(text);
    if (chars.slice(hunk.start, hunk.end).join("") !== hunk.after) throw Error("R3 projection hunk drift: " + file);
    text = chars.slice(0, hunk.start).join("") + hunk.before + chars.slice(hunk.end).join("");
  }
  if (sha(text) !== entry.baseSha256) throw Error("R3 projection baseline drift: " + file);
  return text;
}
module.exports = { root, manifest, sha, normalize, restore };
