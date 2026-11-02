const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const root = require("node:path").resolve(__dirname, "..");
const settings = fs.readFileSync(`${root}/app/admin/views/settings.js`, "utf8");
const record = fs.readFileSync(`${root}/app/admin/domain/record.js`, "utf8");
const baselineSha256 = "3c6654fce208679ff9b6c0fc1ebef78f1036b78f9e551f7f49e9b6366aaa4e51";
const between = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));

test("display labels preserve internal category, priority and action", () => {
  const source = between(settings, "function dashboardTaskLabel(", "function renderAdminOperations(");
  const label = vm.runInNewContext(`${source}; dashboardTaskLabel`);
  assert.equal(label({ type: "결제오류", view: "billing" }), "회원권 연결 확인");
  assert.equal(label({ type: "긴급", view: "schedule" }), "시간표 배정");
  assert.equal(label({ type: "긴급", view: "billing" }), "긴급");
  const current = between(record, "function getAdminTasks()", "function urgentOperationsRecords()");
  const normalized = current.replace("회원권 연결 확인 필요", "회원권 연결 누락").replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(normalized).digest("hex"), baselineSha256);
  assert.match(settings, /escapeHtml\(dashboardTaskLabel\(task\)\)/g);
  assert.match(record, /결제의 회원권 연결을 확인해 주세요/);
});
