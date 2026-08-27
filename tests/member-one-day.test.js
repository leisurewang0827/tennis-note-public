import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const lessonSource = readFileSync(
  join(repoRoot, "app/tennis-note-member-app/domain/lessons.js"),
  "utf8",
);

const L = new Function(
  "days",
  "currentMemberName",
  `${lessonSource}\nreturn {
    memberOneDayBookingIdsFromPayments,
    memberOneDayLessonFromSlot,
    memberUpcomingOneDayBookings,
    memberLessonCanRequestChange,
    memberLessonTitle,
    lessonDetailStatusInfo,
  };`,
)(["월", "화", "수", "목", "금", "토", "일"], () => "박창준");

test("결제된 원데이 예약을 본인 일정으로 구분한다", () => {
  const ownIds = L.memberOneDayBookingIdsFromPayments([
    { status: "verified", one_day_booking_id: "booking-own" },
    { status: "failed", one_day_booking_id: "booking-failed" },
    { status: "verified", one_day_booking_id: null },
  ]);
  assert.deepEqual([...ownIds], ["booking-own"]);

  const own = L.memberOneDayLessonFromSlot({
    id: "booking-own",
    booking_date: "2026-08-29",
    start_time: "13:40:00",
    duration_minutes: 20,
    coach_role_id: "coach-1",
    booking_status: "reserved",
  }, "박창준", ownIds, "박창준");

  assert.equal(own.isOwnLesson, true);
  assert.equal(own.status, "scheduled");
  assert.equal(own.serverStatus, "reserved");
  assert.equal(own.member, "박창준");
  assert.equal(own.type, "원데이 예약");
});

test("다른 회원의 원데이는 신원을 숨긴 점유 상태로 유지한다", () => {
  const lesson = L.memberOneDayLessonFromSlot({
    id: "booking-other",
    booking_date: "2026-08-29",
    start_time: "14:00:00",
    duration_minutes: 20,
    coach_role_id: "coach-1",
  }, "박창준", new Set(["booking-own"]), "박창준");

  assert.equal(lesson.isOwnLesson, false);
  assert.equal(lesson.status, "occupied");
  assert.equal(lesson.member, "");
});

test("회원 화면에는 앞으로 남은 본인 원데이 예약만 날짜순으로 표시한다", () => {
  const rows = [
    { id: "other", oneDayBooking: true, isOwnLesson: false, lessonDate: "2026-08-30", time: "10:00", status: "occupied" },
    { id: "later", oneDayBooking: true, isOwnLesson: true, lessonDate: "2026-08-30", time: "11:00", status: "scheduled" },
    { id: "past", oneDayBooking: true, isOwnLesson: true, lessonDate: "2026-08-20", time: "11:00", status: "scheduled" },
    { id: "first", oneDayBooking: true, isOwnLesson: true, lessonDate: "2026-08-29", time: "13:40", status: "scheduled" },
    { id: "regular", oneDayBooking: false, isOwnLesson: true, lessonDate: "2026-08-29", time: "12:00", status: "scheduled" },
  ];
  const result = L.memberUpcomingOneDayBookings(rows, new Date("2026-08-27T12:00:00+09:00"));
  assert.deepEqual(result.map((row) => row.id), ["first", "later"]);
});

test("본인 원데이는 일반 회원권 수업과 다른 문구와 동작을 사용한다", () => {
  const lesson = { oneDayBooking: true, isOwnLesson: true, status: "scheduled" };
  assert.equal(L.memberLessonTitle(lesson, true), "원데이 예약");
  assert.equal(L.memberLessonCanRequestChange(lesson), false);
  assert.equal(L.memberLessonCanRequestChange({ isOwnLesson: true, status: "scheduled" }), true);
  assert.deepEqual(L.lessonDetailStatusInfo(lesson), {
    label: "예약 완료",
    message: "결제가 확인된 원데이 예약입니다.",
    primaryAction: "",
  });
});

test("결제 완료 뒤 원데이 일정과 회원 화면을 즉시 다시 읽는다", () => {
  const formPayment = readFileSync(
    join(repoRoot, "app/tennis-note-member-app/forms/payment.js"),
    "utf8",
  );
  const paymentAction = readFileSync(
    join(repoRoot, "app/tennis-note-member-app/actions/payment.js"),
    "utf8",
  );
  const syncSource = readFileSync(
    join(repoRoot, "app/tennis-note-member-app/data/sync.js"),
    "utf8",
  );
  const ticketView = readFileSync(
    join(repoRoot, "app/tennis-note-member-app/views/tickets.js"),
    "utf8",
  );
  const memberHtml = readFileSync(
    join(repoRoot, "app/tennis-note-member-app/index.html"),
    "utf8",
  );

  assert.match(syncSource, /selectRows\("tn_payments"[\s\S]*one_day_booking_id/);
  assert.match(formPayment, /syncMemberLessonsFromServer\([^)]*force:\s*true/);
  assert.match(paymentAction, /syncMemberLessonsFromServer\([^)]*force:\s*true/);
  assert.match(ticketView, /renderMemberOneDayReservationPanel/);
  assert.match(memberHtml, /id="memberOneDayReservationPanel"/);
});
