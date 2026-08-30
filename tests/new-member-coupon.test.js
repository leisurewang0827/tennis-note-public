const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("관리자는 신규회원 전용 쿠폰의 자격 제외 인원을 구분해 안내한다", () => {
  const billing = read("app/admin/actions/billing.js");

  assert.match(billing, /result\.ineligibleCount \?\? result\.ineligible_count/);
  assert.match(billing, /신규회원 아님 \$\{ineligibleCount\}명 제외/);
  assert.match(billing, /exclusionSummary/);
});

test("회원앱은 신규회원 전용 쿠폰 자격 오류를 안전한 문구로 안내한다", () => {
  const payment = read("app/tennis-note-member-app/domain/payment.js");

  assert.match(
    payment,
    /discount_coupon_member_ineligible:\s*"신규회원 전용 쿠폰 대상이 아닙니다\. 쿠폰함을 새로고침해 주세요\."/,
  );
});
