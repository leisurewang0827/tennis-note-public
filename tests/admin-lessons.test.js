import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

// lessons.js 의 함수 일부는 values.js 의 함수를 부른다. 둘 다 같이 평가한다.
const L = loadAdminDomain("app/admin/domain/values.js", "app/admin/domain/lessons.js");

// ⚠ 지금 이렇게 동작한다를 고정한 것이다. app.js 에서 본문 그대로 옮겼으므로
// 여기가 깨지면 옮기다 뭔가 바뀐 것이다.

test("lessonStatusValue — 서버 상태를 화면 상태로 바꾼다", () => {
  assert.equal(L.lessonStatusValue({ status: "pending" }), "pending_change");
  assert.equal(L.lessonStatusValue({ status: "confirmed" }), "scheduled");
  assert.equal(L.lessonStatusValue({ status: "cancelled" }), "cancelled");
  assert.equal(L.lessonStatusValue({}), "scheduled", "상태가 없으면 예정으로 본다");
  assert.equal(L.lessonStatusValue(), "scheduled");
});

test("상태 판정 헬퍼", () => {
  assert.equal(L.isLessonPendingChange({ status: "pending" }), true);
  assert.equal(L.isLessonPendingChange({ status: "scheduled" }), false);
  assert.equal(L.isLessonCancelled({ status: "cancelled" }), true);
  assert.equal(L.isLessonAvailable({ status: "available" }), true);
  assert.equal(L.isLessonAvailable({ status: "scheduled" }), false);
});

test("isMakeupLesson — 네 가지 경로 중 하나만 맞아도 보강", () => {
  assert.equal(L.isMakeupLesson({ lessonSource: "makeup" }), true);
  assert.equal(L.isMakeupLesson({ type: "보강 요청" }), true);
  assert.equal(L.isMakeupLesson({ type: "대리 수업" }), true);
  assert.equal(L.isMakeupLesson({ makeup: true }), true);
  assert.equal(L.isMakeupLesson({ type: "개인" }), false);
});

test("getLessonStatusLabel — 회원·코치에게 보이는 문구", () => {
  assert.equal(L.getLessonStatusLabel({ status: "completed", deductedSessions: 1 }), "완료 · 차감");
  assert.equal(L.getLessonStatusLabel({ status: "completed", deductedSessions: 0 }), "완료 · 미차감");
  assert.equal(L.getLessonStatusLabel({ status: "no_show", deductedSessions: 1 }), "노쇼 · 차감");
  assert.equal(L.getLessonStatusLabel({ status: "no_show" }), "노쇼 · 미차감");
  assert.equal(L.getLessonStatusLabel({ status: "cancelled" }), "취소");
  assert.equal(L.getLessonStatusLabel({ status: "available" }), "보강 가능");
  assert.equal(L.getLessonStatusLabel({ status: "confirmed" }), "확정");
  assert.equal(L.getLessonStatusLabel({}), "예정");
  assert.equal(L.getLessonStatusLabel({ makeup: true }), "보강");
  assert.equal(L.getLessonStatusLabel({ makeup: true, status: "pending" }), "보강접수중");
  assert.equal(L.getLessonStatusLabel({ status: "pending" }), "승인 필요");

  // 원데이 예약은 다른 문구 체계를 쓴다
  assert.equal(L.getLessonStatusLabel({ oneDayBooking: true }), "원데이 예약");
  assert.equal(L.getLessonStatusLabel({ oneDayBooking: true, status: "completed" }), "원데이 완료");
  assert.equal(L.getLessonStatusLabel({ oneDayBooking: true, status: "checked_in" }), "방문");
});

test("durationTone — 수업 길이·성격에 따른 표시 등급", () => {
  assert.equal(L.durationTone({ status: "available" }), "available");
  assert.equal(L.durationTone({ makeup: true, durationMinutes: 20 }), "makeup");
  assert.equal(L.durationTone({ durationMinutes: 40 }), "stacked");
  assert.equal(L.durationTone({ durationMinutes: 60 }), "stacked");
  assert.equal(L.durationTone({ durationMinutes: 30 }), "half");
  assert.equal(L.durationTone({ durationMinutes: 20 }), "short");
});

test("durationBadge — 40·60분은 2회분으로 표기", () => {
  assert.match(L.durationBadge({ durationMinutes: 40 }), /20분x2/);
  assert.match(L.durationBadge({ durationMinutes: 60 }), /30분x2/);
  assert.match(L.durationBadge({ durationMinutes: 20 }), /20분/);
  assert.match(L.durationBadge({ durationMinutes: 20 }), /duration-pill short/);
});

test("lessonTicketUnits — 수업 시간이 이용권 단위보다 길면 여러 회 차감", () => {
  // 이용권 기본 단위가 20분일 때
  assert.equal(L.lessonTicketUnits({ durationMinutes: 20 }, {}), 1);
  assert.equal(L.lessonTicketUnits({ durationMinutes: 40 }, {}), 2);
  assert.equal(L.lessonTicketUnits({ durationMinutes: 30 }, {}), 2, "올림 처리한다");
  assert.equal(L.lessonTicketUnits({}, {}), 1, "시간이 없으면 20분으로 본다");
  assert.ok(L.lessonTicketUnits({ durationMinutes: 0 }, {}) >= 1, "최소 1회");
});

test("isBookedLesson — 예약된 자리인가", () => {
  assert.equal(L.isBookedLesson({ status: "scheduled" }), true);
  assert.equal(L.isBookedLesson({ status: "available" }), false);
});

test("getLessonMembersLabel", () => {
  assert.equal(L.getLessonMembersLabel({ member: "김서준" }), "김서준");
});

test("scheduleLessonExceptionLabel — 예외 상황 문구", () => {
  assert.equal(L.scheduleLessonExceptionLabel({}), "", "특별한 일이 없으면 빈 문자열");
  assert.equal(L.scheduleLessonExceptionLabel({ releasedOriginLabel: "직접 지정" }), "직접 지정");
  assert.equal(L.scheduleLessonExceptionLabel({ status: "completed", deductedSessions: 1 }), "완료 · 차감");
  assert.equal(L.scheduleLessonExceptionLabel({ status: "no_show" }), "노쇼 · 미차감");
  assert.equal(L.scheduleLessonExceptionLabel({ type: "대타 수업" }), "대타");
  assert.equal(L.scheduleLessonExceptionLabel({ changeNote: "코치 변경" }), "코치 변경");
  assert.equal(L.scheduleLessonExceptionLabel({ changeNote: "시간 변경" }), "시간 변경");
  assert.equal(
    L.scheduleLessonExceptionLabel({ originalCoachRoleId: "a", coachRoleId: "b" }),
    "대타",
    "담당 코치가 바뀌었으면 대타로 본다",
  );
});
