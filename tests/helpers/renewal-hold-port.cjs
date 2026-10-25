const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/renewal-hold-source-parity.json"), "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
function restoreManualPayoutAdminIndex(file, source, currentVersion) {
  if (file !== "app/admin/index.html") return source;
  const retained = require("./r3-retained-response-port.cjs").restore(file, source);
  if (retained.applied) { source = retained.text; currentVersion = retained.baseVersion; }
  source = require("./r3-history-port.cjs").restoreOpenRefresh(file, source, {inputVersion: currentVersion});
  // raw555는 위 exact inverse를 통과해야만 기존554 계약으로 들어간다.
  if (currentVersion === "1.0.555") currentVersion = "1.0.554";
  const authority = JSON.parse(read("tests/fixtures/r3-manual-payout-port-source-authority.json")).releaseSuccessor;
  assert.equal(authority.baseCommit, "636bdb571dab9d67e18725cd101f0fbe452d69d7");
  assert.equal(authority.featureCommit, "758feca68b3dcc7df89652c0dda03176e1c2dc16");
  assert.equal(authority.candidateCommit, "1b1a73ce73ea2998ed91b54d52aa312d6a2d47f6");
  if (currentVersion === authority.baseVersion) return source;
  assert.equal(currentVersion, authority.targetVersion, "unrecognized manual payout release stage");
  const commitFile = (revision) => execFileSync("git", ["show", `${revision}:${file}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
  const atBase = commitFile(authority.baseCommit);
  const atFeature = commitFile(authority.featureCommit);
  const normalized = source.replaceAll(currentVersion, authority.baseVersion);
  assert.ok([sha(atBase), sha(atFeature)].includes(sha(normalized)), "manual payout admin index stage drift");
  return atBase;
}
// 승인된 후보 전체 hash와 각 hunk의 유일성을 확인한 뒤 기존 golden 검사를 그대로 사용한다.
function restoreBase(file, source) {
  source = require("./verified-profile-phone-port.cjs").restorePhone(file, source);
  // R3 후속 후보는 먼저 exact 해시/offset으로 역변환한다. 기존 HOLD 근거는 그대로 검사한다.
  const r3 = require("./r3-effective-port.cjs");
  const currentVersion = JSON.parse(read("app/release.json")).version;
  source = restoreManualPayoutAdminIndex(file, source, currentVersion);
  const r3SourceVersion = file === "app/admin/index.html" && ["1.0.554", "1.0.555"].includes(currentVersion) ? "1.0.552" : currentVersion;
  if (r3.manifest.files.some(item => item.path === file)) {
    source = r3.restore(file, r3.canonicalRelease(file, source, r3SourceVersion));
    source = source.replaceAll(r3.manifest.publicVersion, currentVersion);
  } else {
    // R3 내부 chain이 이미 소비한 최신 증분을 두 번 역변환하지 않는다.
    // manifest 밖의 잠금 수정만 별도 chain으로 검증한다.
    source = require("./r3-admin-history-port.cjs").restoreUnlock(file, source);
  }
  const row = manifest.files.find(item => item.path === file);
  if (!row) return source;
  // 승인된 Excel 증분만 먼저 exact hash로 역변환한다. 기존 HOLD golden은 보존한다.
  const excel = JSON.parse(read("tests/fixtures/excel-retry-source-parity.json"));
  const refresh = excel.files.find(item => item.path === file);
  if (refresh) {
    assert.equal(sha(source), refresh.candidateSha256, `candidate drift: ${file}`);
    for (const hunk of [...refresh.hunks].reverse()) {
      assert.equal(source.split(hunk.after).length, 2, `ambiguous Excel hunk: ${file}`);
      source = source.replace(hunk.after, () => hunk.before);
    }
    assert.equal(sha(source), refresh.baseSha256, `Excel base drift: ${file}`);
  }
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
module.exports = {root, manifest, sha, read, restoreBase, appSource, definition, restoreManualPayoutAdminIndex};
