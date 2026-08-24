// 수업 변경·보강 요청의 조건과 문구를 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberChangePolicyForLesson(lesson) {
  const lessonDate = lesson?.lessonDate || memberScheduleDateForDay(lesson?.day);
  if (!lessonDate || !lesson?.time) return "coach";
  const lessonAt = new Date(`${lessonDate}T${lesson.time}:00`);
  return lessonAt.getTime() - Date.now() >= 24 * 60 * 60 * 1000 ? "auto" : "coach";
}

function memberChangeDirection(sourceLesson, targetLesson) {
  const sourceAt = memberLessonTimestamp(sourceLesson);
  const targetAt = memberLessonTimestamp(targetLesson);
  if (!Number.isFinite(sourceAt) || !Number.isFinite(targetAt)) return "change";
  return targetAt < sourceAt ? "advance" : "change";
}

function memberMakeupDueLessons() {
  const memberName = currentMemberName();
  return memberOpenMakeupEntitlements().map((item) => ({
    id: `makeup-due-${item.id}`,
    makeupEntitlementId: item.id,
    serverLessonId: item.sourceLessonId,
    member_ticket_id: item.ticketId,
    coach_role_id: item.coachRoleId,
    coachRoleId: item.coachRoleId,
    lessonDate: item.lessonDate,
    day: item.day,
    time: item.time,
    coach: item.coach,
    member: memberName,
    type: "보강 필요",
    status: "makeup_due",
    lessonSource: "makeup",
    durationMinutes: item.durationMinutes,
    reason: item.reason,
    isOwnLesson: true,
  }));
}

function memberAllInlineChangeSources() {
  return currentScheduledLessonsForChange().filter((lesson) => (
    lesson.status === "scheduled"
    || lesson.status === "makeup_due"
    || lesson.couponBooking
    || lesson.regularInitialBooking
    || lesson.resumePausedTicket
  ));
}

function memberInlineChangeSources() {
  const selectedTicketId = ensureMemberScheduleTicketSelection();
  return memberAllInlineChangeSources()
    .filter((lesson) => !selectedTicketId || memberLessonTicketId(lesson) === selectedTicketId);
}

function memberChangeSourceActionLabel(source = {}) {
  if (source.couponBooking) return "쿠폰";
  if (source.resumePausedTicket) return "복귀";
  if (source.regularInitialBooking) return "첫 수업";
  if (source.status === "makeup_due") return "보강";
  return "변경";
}

function memberChangeSourceOptionLabel(source = {}) {
  const action = memberChangeSourceActionLabel(source);
  if (source.couponBooking || source.regularInitialBooking) {
    const remaining = Number.isFinite(Number(source.remaining)) ? ` · 잔여 ${Number(source.remaining)}회` : "";
    return `${action} · ${source.ticketTitle || source.type || "회원권"}${remaining}`;
  }
  return `${action} · ${lessonDateTimeLabel(source)} · ${memberCoachShortName(source.coach || "담당 코치")}`.trim();
}

function memberLessonChangeContext(lesson = {}) {
  const request = memberApprovedChangeForLesson(lesson);
  const originalDate = request?.originalDate
    || lesson.originalLessonDate
    || lesson.original_lesson_date
    || lesson.changedFromDate
    || "";
  const originalTime = request?.originalTime
    || lesson.originalStartTime
    || lesson.original_start_time
    || lesson.changedFromTime
    || "";
  const targetDate = lesson.lessonDate || request?.targetDate || "";
  const targetTime = lesson.time || request?.targetTime || "";
  const original = `${compactLessonDateLabel(originalDate)} ${String(originalTime).slice(0, 5)}`.trim();
  const current = `${compactLessonDateLabel(targetDate, lesson.day)} ${String(targetTime).slice(0, 5)}`.trim();
  if (!originalDate && memberScheduleExceptionLabel(lesson) === "시간 변경") {
    return { original: "기존 일정", current, exact: false };
  }
  if (!original || !current || original === current) return null;
  return { original, current, exact: true };
}

function memberChangeSubmitLabel(source = null, selected = null) {
  if (source?.makeupEntitlementId || source?.status === "makeup_due") return "보강 예약 확정";
  if (source?.couponBooking) return "쿠폰 예약 확정";
  if (source?.regularInitialBooking) return source?.resumePausedTicket ? "복귀하고 시간 확정" : "수업시간 확정";
  if (!selected) return "새 시간 선택";
  if (memberChangePolicySnapshot(selected)?.isGroup) return "그룹 변경 승인 요청";
  return selected.policy === "coach" ? "승인 요청" : "바로 변경";
}
