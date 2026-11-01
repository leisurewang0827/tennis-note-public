const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app/admin/views/billing.js"), "utf8");
const match = source.match(/function adminSettlementResponseLabel\(reconciliation\) \{[\s\S]*?\n\}/);
assert.ok(match, "actual display helper must exist");
const label = vm.runInNewContext(`(${match[0]})`);

test("확정 이력의 실제 응답 상태를 대소문자와 무관하게 표시한다", () => {
  for (const status of ["acknowledged", "ACKNOWLEDGED"]) assert.equal(label({ status }), "확인 완료");
  for (const status of ["disputed", "DISPUTED"]) assert.equal(label({ status }), "이의 접수");
  assert.equal(label(null), "응답 대기");
  assert.equal(label(undefined), "응답 대기");
  for (const status of ["", "unexpected"]) assert.equal(label({ status }), "상태 확인 필요");
});

test("응답 표시는 실제 확정 이력에 연결되고 지급 조건은 독립적으로 유지된다", () => {
  assert.match(source, /\["코치 응답", adminSettlementResponseLabel\(value\.reconciliation\)\]/);
  assert.match(source, /current\.scopeState\?\.reconciliation\?\.status === "acknowledged"/);
  assert.match(source, /originalAck:adminMonthlySettlementWrite\.scopeState\?\.reconciliation\?\.status==="acknowledged"/);
});
