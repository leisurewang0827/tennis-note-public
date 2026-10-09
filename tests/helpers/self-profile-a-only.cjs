// 승인된 본인 프로필 증분만 역변환하여 기존 운영 golden을 그대로 검사한다.
"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/self-profile-a-only.json"), "utf8"));
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const normalize = text => text.replace(/\r\n/g, "\n");
function undoRelease(file, text) {
  text = normalize(text);
  const row = contract.release.files.find(item => item.path === file);
  if (!row) return text;
  assert.equal(hash(text), row.afterHash, `A-only release candidate drift: ${file}`);
  for (const p of [...row.patches].reverse()) {
    assert(p.after && text.split(p.after).length === 2, `A-only release exact inverse: ${file}`);
    text = text.replace(p.after, () => p.before);
  }
  assert.equal(hash(text), row.beforeHash, `A-only release baseline drift: ${file}`);
  return text;
}
function restoreCandidate(file, text) {
  text = undoRelease(file, text);
  const row = contract.files.find(item => item.path === file);
  if (!row) return text;
  assert.equal(hash(text), row.afterHash, `A-only product candidate drift: ${file}`);
  for (const p of [...row.patches].reverse()) {
    assert(p.after && text.split(p.after).length === 2, `A-only exact inverse: ${file}`);
    text = text.replace(p.after, () => p.before);
  }
  assert.equal(hash(text), row.beforeHash, `A-only product baseline drift: ${file}`);
  return text;
}
function changedBeforeCandidate(base, paths) {
  const { execFileSync } = require("node:child_process");
  return paths.filter(file => {
    const current = restoreCandidate(file, fs.readFileSync(path.join(root, file), "utf8"));
    const original = normalize(execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8", maxBuffer: 12e6 }));
    return current !== original;
  });
}
module.exports = { contract, hash, normalize, undoRelease, restoreCandidate, changedBeforeCandidate };
