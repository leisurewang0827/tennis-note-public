import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const values = loadAdminDomain("app/admin/domain/values.js");
const B = loadAdminDomain("app/admin/domain/values.js", "app/admin/domain/billing.js");
const NAMES = Object.keys(values);

// ⚠ 이 테스트는 "지금 이렇게 동작한다"를 고정한 것이다.
// app.js 에서 본문 그대로 옮겨왔으므로, 여기가 깨지면 옮기다 뭔가 바뀐 것이다.

test("옮긴 함수가 전부 존재한다", () => {
  // 개수가 아니라 이름을 적어둔다. 함수를 추가로 옮기면 여기에도 적어야 하고,
  // 실수로 사라지면(옮기다 빠뜨리거나 중복 선언에 가려지면) 여기서 잡힌다.
  const expected = [
    "adminLocalDateKey", "cloneOperationProfileValue", "compactDashboardPageIndexes",
    "escapeHtml", "getTicketDisplayProduct", "getTicketDurationMinutes", "getTicketWeeklyCount",
    "isDeductedLesson", "isExpectedPersonalGroupTicketSet", "isHistoricalImportedPayment",
    "isReleasedRegularMakeupSlot", "journalBodySummary", "lessonRawStatusValue",
    "lessonScheduleCoachId", "lessonUnitLabel", "memberServerUserIds",
    "memberTicketDuplicateFingerprint", "minutesToTime", "normalizeLessonSource",
    "numericValue", "participantOutcomeLabel", "paymentMethodLabel", "pendingRecordType",
    "recordTimestamp", "scheduleCoachDisplayName", "sortAdminRecords", "splitMemberNames",
    "ticketParticipantUserIds", "timeToMinutes", "lessonEndTimestamp",
  ];
  assert.deepEqual([...NAMES].sort(), [...expected].sort());
  for (const name of NAMES) {
    assert.equal(typeof values[name], "function", `${name} 이 함수가 아니다`);
  }
});

test("timeToMinutes / minutesToTime", () => {
  assert.equal(values.timeToMinutes("00:00"), 0);
  assert.equal(values.timeToMinutes("18:40"), 1120);
  assert.equal(values.timeToMinutes("23:59"), 1439);
  assert.equal(values.minutesToTime(0), "00:00");
  assert.equal(values.minutesToTime(1120), "18:40");
  assert.equal(values.minutesToTime(540), "09:00");
  // 왕복해도 같은 값
  for (const time of ["07:00", "12:30", "19:20"]) {
    assert.equal(values.minutesToTime(values.timeToMinutes(time)), time);
  }
});

test("numericValue — 숫자로 못 읽으면 기본값", () => {
  assert.equal(values.numericValue("42"), 42);
  assert.equal(values.numericValue(7), 7);
  assert.equal(values.numericValue("abc", 5), 5);
  assert.equal(values.numericValue(undefined, 9), 9);
  assert.equal(values.numericValue(Infinity, 1), 1, "무한대는 유한하지 않으므로 기본값");

  // ⚠ 현재 동작을 기록한 것이지 옳다는 뜻이 아니다.
  // Number(null) 과 Number("") 은 0 이고 0 은 유한하므로 기본값이 안 쓰인다.
  // "값 없음"과 "진짜 0"이 구분되지 않는다.
  // tickets 의 remaining 이 null 이면 "소진"으로 판정되는 것과 같은 뿌리다.
  assert.equal(values.numericValue(null, 3), 0, "null 은 기본값이 아니라 0 이 된다");
  assert.equal(values.numericValue("", 3), 0, "빈 문자열도 0 이 된다");
});

test("splitMemberNames — & 와 · 로 나누고 중복 제거", () => {
  assert.deepEqual(values.splitMemberNames("김서준"), ["김서준"]);
  assert.deepEqual(values.splitMemberNames("이하린&최유나"), ["이하린", "최유나"]);
  assert.deepEqual(values.splitMemberNames("이하린 · 최유나"), ["이하린", "최유나"]);
  assert.deepEqual(values.splitMemberNames("김서준&김서준"), ["김서준"], "중복은 하나로");
  assert.deepEqual(values.splitMemberNames(""), []);
  assert.deepEqual(values.splitMemberNames(), []);
  assert.deepEqual(values.splitMemberNames("이하린&"), ["이하린"], "빈 조각은 버린다");
  assert.deepEqual(values.splitMemberNames("이하린,최유나"), ["이하린,최유나"], "쉼표는 구분자가 아니다");
});

test("adminLocalDateKey — 브라우저 로컬 시간 기준 YYYY-MM-DD", () => {
  assert.match(values.adminLocalDateKey(), /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(2026, 7, 18, 13, 45);
  assert.equal(values.adminLocalDateKey(date), "2026-08-18");
  assert.equal(values.adminLocalDateKey(new Date(2026, 0, 5)), "2026-01-05", "한 자리 월·일은 0 을 채운다");
});

test("recordTimestamp / lessonEndTimestamp", () => {
  assert.equal(values.recordTimestamp(""), 0);
  assert.equal(values.recordTimestamp("이상한 값"), 0);
  assert.equal(values.recordTimestamp("2026-08-18T00:00:00Z"), Date.parse("2026-08-18T00:00:00Z"));

  assert.equal(values.lessonEndTimestamp(null), 0);
  assert.equal(values.lessonEndTimestamp({ lessonDate: "2026-08-18" }), 0, "시간이 없으면 0");
  const end = values.lessonEndTimestamp({ lessonDate: "2026-08-18", time: "18:40", durationMinutes: 30 });
  assert.equal(end, new Date("2026-08-18T18:40:00").getTime() + 30 * 60 * 1000);
  const fallback = values.lessonEndTimestamp({ lessonDate: "2026-08-18", time: "18:40" });
  assert.equal(fallback, new Date("2026-08-18T18:40:00").getTime() + 20 * 60 * 1000, "기본 20분");
});

test("cloneOperationProfileValue — 깊은 복사", () => {
  const source = { branch: { id: "b1", coaches: ["가", "나"] } };
  const copy = values.cloneOperationProfileValue(source);
  assert.deepEqual(copy, source);
  copy.branch.coaches.push("다");
  assert.deepEqual(source.branch.coaches, ["가", "나"], "원본이 바뀌면 안 된다");
});

test("billing — 결제 기준일 계산", () => {
  // 여러 후보 필드 중 먼저 나오는 것을 쓴다 (paidAt > verifiedAt > requestedAt > createdAt)
  assert.equal(B.billingEffectiveDate({ paidAt: "2026-08-18" }), "2026-08-18");
  assert.equal(B.billingEffectiveDate({ paid_at: "2026-08-18T10:00:00Z" }), "2026-08-18");
  assert.equal(
    B.billingEffectiveDate({ createdAt: "2026-01-02", paidAt: "2026-08-18" }),
    "2026-08-18",
    "결제일이 생성일보다 우선",
  );
  assert.equal(B.billingEffectiveDate({}), "", "아무 날짜도 없으면 빈 문자열");

  assert.equal(B.billingMatchesMonth({ paidAt: "2026-08-18" }, "2026-08"), true);
  assert.equal(B.billingMatchesMonth({ paidAt: "2026-07-31" }, "2026-08"), false);
  assert.equal(B.billingMatchesMonth({ paidAt: "2026-08-18" }, ""), true, "월 지정이 없으면 전부 통과");
});

test("coachWorksAtPreviewTime 이 쓰는 시간 비교가 성립한다", () => {
  // 관리자 설정 > 코치 > 레인 순서 편집기가 정의되지 않은 minutesFromTime 을
  // 부르고 있었다. 본문이 동일한 timeToMinutes 로 바꿨다.
  // 그 화면이 하는 비교(근무 블록 안에 있는가)가 성립하는지 확인한다.
  const inBlock = (time, start, end) =>
    values.timeToMinutes(time) >= values.timeToMinutes(start)
    && values.timeToMinutes(time) < values.timeToMinutes(end);

  assert.equal(inBlock("19:00", "18:00", "21:00"), true);
  assert.equal(inBlock("18:00", "18:00", "21:00"), true, "시작 시각은 포함");
  assert.equal(inBlock("21:00", "18:00", "21:00"), false, "종료 시각은 미포함");
  assert.equal(inBlock("17:59", "18:00", "21:00"), false);
});
