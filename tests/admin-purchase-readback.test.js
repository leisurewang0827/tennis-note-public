import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const current = path => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const sha = value => createHash("sha256").update(value).digest("hex");
// 기존 PR565 계약은 refresh-only hunk를 exact 역이식한 원본에서 검증한다.
const refresh = JSON.parse(current("tests/fixtures/production-excel-refresh-source.json"));
function read(path) {
  let text = current(path);
  const patch = refresh.products.find(row => row.path === path);
  if (!patch) return text;
  assert.equal(sha(text), patch.candidateSha256, path);
  for (const h of [...patch.hunks].reverse()) {
    assert.equal(text.split(h.after).length, 2, path);
    text = text.replace(h.after, () => h.before);
  }
  assert.equal(sha(text), patch.baseSha256, path);
  return text;
}
const manifest = JSON.parse(read("docs/admin-purchase-readback-source-parity-20261001.json"));

test("저장 후 대상 조회와 기존 결제 검증 VM 계약", () => {
  const report = JSON.parse(execFileSync(process.execPath, ["scripts/check_tennisnote_admin_purchase_readback.cjs"], { cwd: root, encoding: "utf8" }));
  assert.equal(report.result, "PASS");
  assert.equal(report.checks, 19);
  assert.equal(report.purchaseWrites, 0);
});

test("private PR565 조회 helper 및 등록·추가·연장 호출 이식 범위", () => {
  const common = read("app/admin/actions/common.js");
  const member = read("app/admin/actions/member.js");
  const helper = common.match(/async function loadAdminPostWriteMemberRows\([\s\S]*?\n\}/)[0];
  // 번역된 설명 주석만 제외하고 private 원본과 동일한 실행 소스다.
  assert.equal(sha(helper.replace(/^\s*\/\/.*\n/gm, "")), manifest.helperExecutableSha256);
  for (const row of manifest.products) assert.equal(sha(read(row.path)), row.candidateSha256);
  const withoutMemberPatch = member.replace(/    const memberWriteReadbackUserId = \["create", "assign", "reenroll"\][\s\S]*?      : "";\n/, "")
    .replace("syncAdminLiveData(true, { memberWriteReadbackUserId })", "syncAdminLiveData(true)");
  assert.equal(sha(withoutMemberPatch), manifest.products.find(row => row.path.endsWith("member.js")).baseSha256);
  const withoutCommonPatch = common.replace(helper + "\n\n", "")
    .replace(/loadAdminPostWriteMemberRows\(client, options.memberWriteReadbackUserId, "(memberDatabaseRecords|memberMembershipRecords)", "tn_member_(?:database|membership)_records", \(\) => (rosterRows\([^\n]+?\))\) : Promise.resolve\(\[\]\),/g, "$2 : Promise.resolve([]),");
  assert.equal(sha(withoutCommonPatch), manifest.products.find(row => row.path.endsWith("common.js")).baseSha256);
  const html = read("app/admin/index.html");
  assert.ok(html.includes("actions/member.js?v="));
  assert.ok(html.includes("actions/common.js?v="));
});
