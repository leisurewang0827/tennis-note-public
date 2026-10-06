const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
test("엑셀 등록 이력 원복: exact key, 확인 전 저장0, 중복 및 실패 차단", () => {
  const output = execFileSync(process.execPath, ["scripts/check_tennisnote_single_sheet_initial_envelope.cjs"], {
    cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 30000,
  });
  assert.match(output, /PASS single-sheet initial envelope JS 51 assertions/);
});
