import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const D = loadAdminDomain(
  "app/admin/domain/values.js",
  "app/admin/domain/lessons.js",
  "app/admin/domain/billing.js",
  "app/admin/domain/tickets.js",
  "app/admin/domain/coaches.js",
  "app/admin/domain/schedule.js",
  "app/admin/domain/payment.js",
  "app/admin/domain/policy.js",
  "app/admin/domain/record.js",
);

// ⚠ 지금 이렇게 동작한다를 고정한 것이다. app.js 에서 본문 그대로 옮겼으므로
// 여기가 깨지면 옮기다 뭔가 바뀐 것이다.

test("intervalsOverlap — 시간 겹침 판정", () => {
  // 수업이 겹치는지 보는 데 쓴다. 경계 처리가 틀리면 예약이 겹치거나
  // 멀쩡한 자리가 막힌다.
  assert.equal(D.intervalsOverlap({ start: 0, end: 20 }, { start: 10, end: 30 }), true);
  assert.equal(D.intervalsOverlap({ start: 0, end: 20 }, { start: 20, end: 40 }), false, "맞닿은 건 안 겹친다");
  assert.equal(D.intervalsOverlap({ start: 20, end: 40 }, { start: 0, end: 20 }), false, "반대 방향도 같다");
  assert.equal(D.intervalsOverlap({ start: 0, end: 60 }, { start: 20, end: 30 }), true, "완전히 포함해도 겹친다");
  assert.equal(D.intervalsOverlap({ start: 0, end: 0 }, { start: 0, end: 0 }), false, "길이 0 은 안 겹친다");
});

test("normalizeMemberPaymentMethod — 계좌이체 표기 통일", () => {
  for (const input of ["bank", "banktransfer", "transfer", "Bank Transfer", "계좌-이체bank"]) {
    const out = D.normalizeMemberPaymentMethod(input);
    if (["bank", "banktransfer", "transfer", "Bank Transfer"].includes(input)) {
      assert.equal(out, "banktransfer", `${input} 는 banktransfer 로 통일`);
    }
  }
  assert.equal(D.normalizeMemberPaymentMethod("TossPay"), "tosspay", "소문자로 만들고 기호를 뗀다");
  assert.equal(D.normalizeMemberPaymentMethod(""), "");
  assert.equal(D.normalizeMemberPaymentMethod(), "");
});

test("groupPaymentModeLabel — 2대1 결제 방식 문구", () => {
  assert.equal(D.groupPaymentModeLabel("alternate"), "결제자 번갈아 지정");
  assert.equal(D.groupPaymentModeLabel("separate"), "각자 결제");
  assert.equal(D.groupPaymentModeLabel("representative"), "한 명이 두 사람 함께 결제");
  assert.equal(D.groupPaymentModeLabel(), "한 명이 두 사람 함께 결제", "기본값은 대표 결제");
  assert.equal(D.groupPaymentModeLabel("모르는값"), "한 명이 두 사람 함께 결제");
});

test("memberManagementScheduleScopeLabel — 이용 요일 범위 문구", () => {
  assert.equal(D.memberManagementScheduleScopeLabel("mixed"), "혼합 (월~일)");
  assert.equal(D.memberManagementScheduleScopeLabel("weekend"), "주말 (토·일)");
  assert.equal(D.memberManagementScheduleScopeLabel("weekday"), "평일 (월~금)");
  assert.equal(D.memberManagementScheduleScopeLabel(), "평일 (월~금)", "모르면 평일로 본다");
});

test("normalizeRefundPolicySettings — 환불 정책 값 범위", () => {
  const base = D.normalizeRefundPolicySettings();
  assert.equal(base.penaltyRate, 10, "기본 위약금율 10%");
  assert.equal(base.reservationFee, 30000, "기본 예약금 3만원");
  assert.ok(base.memo.length > 0, "메모 기본값이 있다");

  assert.equal(D.normalizeRefundPolicySettings({ penaltyRate: 50 }).penaltyRate, 10, "10% 를 넘길 수 없다");
  assert.equal(D.normalizeRefundPolicySettings({ penaltyRate: -5 }).penaltyRate, 0, "음수는 0");
  assert.equal(D.normalizeRefundPolicySettings({ reservationFee: -1 }).reservationFee, 0, "예약금도 음수 불가");
  assert.equal(
    D.normalizeRefundPolicySettings({ memo: "  " }).memo,
    base.memo,
    "빈 메모는 기본 문구로 되돌린다",
  );
});

test("lessonRecordErrorMessage — 서버 오류를 사람 말로", () => {
  assert.equal(
    D.lessonRecordErrorMessage({ payload: { code: "lesson_complete_comment_too_short" } }),
    "코치 코멘트는 5자 이상 작성해 주세요.",
  );
  assert.equal(
    D.lessonRecordErrorMessage({ message: "lesson_complete_ticket_unavailable" }),
    "사용 가능한 회원권 횟수가 없습니다.",
  );
  assert.equal(
    D.lessonRecordErrorMessage({ message: '{"code":"lesson_complete_forbidden"}' }),
    "이 수업을 처리할 권한이 없습니다.",
    "JSON 문자열로 온 것도 풀어서 본다",
  );
  assert.equal(
    D.lessonRecordErrorMessage({}),
    "서버 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.",
    "모르는 오류는 일반 문구",
  );
  assert.equal(
    D.lessonRecordErrorMessage({ message: "{망가진 JSON" }),
    "서버 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.",
    "JSON 파싱이 실패해도 터지지 않는다",
  );
});
