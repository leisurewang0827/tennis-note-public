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
  // 후속 홈 포트와 릴리스 치환만 exact hash로 검증·역변환한다. HOLD golden은 변경하지 않는다.
  const home = JSON.parse(read("tests/fixtures/member-home-source-parity.json"));
  const version = JSON.parse(read("app/release.json")).version;
  source = source.replaceAll(version, home.publicVersion);
  const projection = home.files.find(item => item.path === file);
  if (projection) {
    assert.equal(sha(source), projection.candidateSha256, `candidate drift: ${file}`);
    for (const hunk of [...projection.hunks].reverse()) {
      assert.equal(source.split(hunk.after).length, 2, `ambiguous home hunk: ${file}`);
      source = source.replace(hunk.after, () => hunk.before);
    }
    assert.equal(sha(source), projection.baseSha256, `home base drift: ${file}`);
  }
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
