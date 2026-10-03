const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/renewal-hold-source-parity.json"), "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
// 승인된 후보 전체 hash와 각 hunk의 유일성을 확인한 뒤 기존 golden 검사를 그대로 사용한다.
function restoreBase(file, source) {
  const row = manifest.files.find(item => item.path === file);
  if (!row) return source;
  assert.equal(sha(source), row.candidateSha256, `candidate drift: ${file}`);
  for (const hunk of row.hunks) {
    assert.equal(source.split(hunk.after).length, 2, `ambiguous hunk: ${file}`);
    source = source.replace(hunk.after, hunk.before);
  }
  assert.equal(sha(source), row.baseSha256, `base drift: ${file}`);
  return source;
}
function appSource(app) {
  const visit = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? visit(target) : entry.name.endsWith(".js") ? [fs.readFileSync(target,"utf8").replace(/\r\n/g,"\n")] : [];
  });
  return visit(path.join(root, "app", app)).join("\n");
}
function definition(source, name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(source);
  assert(match, `missing function: ${name}`);
  const end = source.indexOf("\n}", match.index);
  assert(end > match.index);
  return source.slice(match.index, end + 2);
}
module.exports = {root, manifest, sha, read, restoreBase, appSource, definition};
