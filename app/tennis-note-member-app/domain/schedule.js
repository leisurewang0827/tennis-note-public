// 시간표의 주차·요일·시간대를 계산하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function refreshMemberScheduleWeekLabels() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const dateLabel = (value) => `${value.getMonth() + 1}/${value.getDate()}`;
  memberScheduleWeeks.forEach((week, offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + (offset * 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    week.label = `${start.getMonth() + 1}\uC6D4 ${weekOfMonth}\uC8FC\uCC28`;
    week.range = `${dateLabel(start)}~${dateLabel(end)}`;
    week.startDate = localDateKey(start);
    week.endDate = localDateKey(end);
  });
}

function memberScheduleTimes(policy = loadAdminSchedulePolicy()) {
  const range = "all";
  const allStart = policy.openStart;
  const allEnd = policy.openEnd;
  if (range === "morning") return makeMemberTimeRange(allStart, "12:00");
  if (range === "afternoon") return makeMemberTimeRange("12:00", "17:00");
  if (range === "evening") return makeMemberTimeRange("17:00", allEnd);
  if (range === "all") return makeMemberTimeRange(allStart, allEnd);
  const openStartMinutes = minutesFromTime(allStart);
  const openEndMinutes = minutesFromTime(allEnd);
  const allScheduleLessons = memberScheduleLessons().filter((lesson) => {
    const start = minutesFromTime(lesson.time);
    const serverStatus = lesson.serverStatus || lesson.status;
    return lesson.status !== "available"
      && serverStatus !== "completed"
      && start >= openStartMinutes
      && start < openEndMinutes;
  });
  const ownScheduleLessons = allScheduleLessons.filter((lesson) => isOwnMemberScheduleLesson(lesson));
  const scheduleLessons = ownScheduleLessons.length ? ownScheduleLessons : allScheduleLessons;
  if (!scheduleLessons.length) return makeMemberTimeRange("17:00", allEnd);
  const starts = scheduleLessons.map((lesson) => minutesFromTime(lesson.time));
  const ends = scheduleLessons.map((lesson) => minutesFromTime(lesson.time) + lessonDuration(lesson));
  const start = Math.max(minutesFromTime(allStart), Math.floor((Math.min(...starts) - 30) / 10) * 10);
  const end = Math.min(minutesFromTime(allEnd), Math.ceil((Math.max(...ends) + 30) / 10) * 10);
  if (end <= start) return makeMemberTimeRange("17:00", allEnd);
  const startText = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const endText = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return makeMemberTimeRange(startText, endText);
}

function hasMemberCoachLessonAt(scheduleLessons, day, time, coach, durationMinutes = 10, policy = loadAdminSchedulePolicy()) {
  const slotStart = minutesFromTime(time);
  const slotEnd = slotStart + durationMinutes;
  return scheduleLessons.some((lesson) => {
    if (lesson.status === "available" || lesson.day !== day) return false;
    const lessonStatus = String(lesson.serverStatus || lesson.status || "").toLowerCase();
    if (["cancelled", "canceled", "absence", "absent", "makeup_due"].includes(lessonStatus)) return false;
    const lessonCoach = memberLessonCoach(lesson, policy);
    if (lessonCoach.id !== coach.id) return false;
    const lessonStart = minutesFromTime(lesson.time);
    const lessonEnd = lessonStart + lessonDuration(lesson);
    return slotStart < lessonEnd && slotEnd > lessonStart;
  });
}

function makeMemberStartTimes(startTime, endTime, stepMinutes = 10) {
  const result = [];
  const rawStart = minutesFromTime(startTime);
  const firstAligned = Math.ceil(rawStart / stepMinutes) * stepMinutes;
  for (let current = firstAligned; current < minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function memberBookingGridMinutes(durationMinutes = 20) {
  return Number(durationMinutes) === 30 ? 30 : [20, 40].includes(Number(durationMinutes)) ? 20 : 10;
}

function memberScheduleDateForDay(day) {
  const week = activeMemberWeek();
  const dayIndex = days.indexOf(day);
  if (!week?.startDate || dayIndex < 0) return "";
  const date = new Date(`${week.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return localDateKey(date);
}

function memberLessonExtendsAnchorWindow(lesson = {}) {
  const status = String(lesson.serverStatus || lesson.status || "").toLowerCase();
  return ["scheduled", "completed", "no_show"].includes(status)
    && !lesson.releasedRegularSlot;
}

function memberSlotInsideAnchorWindow(scheduleLessons, policy, sourceLesson, day, time, coach) {
  if (policy.requireMakeupDayAnchor === false) return true;
  const releasedSlot = memberReleasedMakeupSlot(
    memberScheduleDateForDay(day),
    time,
    coach.id,
    lessonDuration(sourceLesson),
  );
  if (releasedSlot) return true;

  const configuredGap = sourceLesson.makeupAnchorMinutes ?? policy.makeupAnchorGapMinutes ?? 40;
  if (configuredGap === null || String(configuredGap).toLowerCase() === "unlimited") return true;
  const gapMinutes = Math.min(100, Math.max(0, Number(configuredGap) || 0));
  const anchors = scheduleLessons.filter((lesson) => {
    if (lesson.day !== day || !memberLessonExtendsAnchorWindow(lesson)) return false;
    return memberLessonCoach(lesson, policy).id === coach.id;
  });
  if (!anchors.length) return false;

  const firstStart = Math.min(...anchors.map((lesson) => minutesFromTime(lesson.time)));
  const lastEnd = Math.max(...anchors.map((lesson) => minutesFromTime(lesson.time) + lessonDuration(lesson)));
  const slotStart = minutesFromTime(time);
  return slotStart >= firstStart - gapMinutes && slotStart <= lastEnd + gapMinutes;
}

function generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson = null) {
  const result = [];
  const sourceLesson = selectedLesson
    || scheduleLessons.find((lesson) => memberLessonCanRequestChange(lesson) && lesson.serverLessonId)
    || scheduleLessons.find((lesson) => memberLessonCanRequestChange(lesson));
  if (!sourceLesson) return result;
  const sourceCoach = memberLessonCoach(sourceLesson, policy);
  const durationMinutes = lessonDuration(sourceLesson);
  const scheduleScope = sourceLessonScheduleScope(sourceLesson);
  const isMakeupDue = Boolean(sourceLesson.makeupEntitlementId);
  const isCouponBooking = Boolean(sourceLesson.couponBooking);
  const isRegularInitialBooking = Boolean(sourceLesson.regularInitialBooking);
  const requestPolicy = isMakeupDue || isCouponBooking || isRegularInitialBooking
    ? "auto"
    : memberChangePolicyForLesson(sourceLesson);
  days.forEach((day) => {
    const isWeekend = ["토", "일"].includes(day);
    if ((scheduleScope === "weekday" && isWeekend) || (scheduleScope === "weekend" && !isWeekend)) return;
    const lessonDate = memberScheduleDateForDay(day);
    if (!lessonDate) return;
    if (sourceLesson.startsOn && lessonDate < sourceLesson.startsOn) return;
    if (sourceLesson.expiresOn && lessonDate > sourceLesson.expiresOn) return;
    const initialCoachSelection = isRegularInitialBooking && !sourceLesson.coachRoleId;
    const coaches = (initialCoachSelection
      ? policy.coaches.filter((coach) => (coach.workBlocks || []).some((block) => block.days.includes(day)))
      : memberDayCoaches(day, policy, scheduleLessons)
    ).filter((coach) => initialCoachSelection || coach.id === sourceCoach.id);
    coaches.forEach((coach) => {
      memberCoachBookableTimes(coach, day, durationMinutes).forEach((time) => {
        if (new Date(`${lessonDate}T${time}:00`).getTime() <= Date.now()) return;
        if (memberBreakRuleOverlaps(policy, day, time, durationMinutes)) return;
        if (!isMemberCoachWorking(coach, day, time, durationMinutes)) return;
        if (hasMemberCoachLessonAt(scheduleLessons, day, time, coach, durationMinutes, policy)) return;
        const releasedSlot = memberReleasedMakeupSlot(lessonDate, time, coach.id, durationMinutes);
        if (!memberSlotInsideAnchorWindow(scheduleLessons, policy, sourceLesson, day, time, coach)) return;
        result.push({
          id: `auto-slot-${day}-${time}-${coach.id}`,
          day,
          time,
          coach: coach.name,
          coachRoleId: sourceLesson.coach_role_id || sourceLesson.coachRoleId || coach.serverRoleId || coach.id || "",
          lessonDate,
          member: "",
          type: releasedSlot ? "정규 자리 · 보강 가능" : isMakeupDue ? "보강 신청가능" : isCouponBooking ? "쿠폰 예약 가능" : "수업 변경 신청가능",
          status: "available",
          policy: requestPolicy,
          generated: true,
          durationMinutes,
          makeupEntitlementId: sourceLesson.makeupEntitlementId || "",
          couponBooking: isCouponBooking,
          regularInitialBooking: isRegularInitialBooking,
          resumePausedTicket: Boolean(sourceLesson.resumePausedTicket),
          frequencyPerWeek: Number(sourceLesson.frequencyPerWeek) || 1,
          member_ticket_id: sourceLesson.member_ticket_id || sourceLesson.ticketId || "",
          ticketId: sourceLesson.member_ticket_id || sourceLesson.ticketId || "",
          releasedSlotId: releasedSlot?.id || "",
          releasedRegularSlot: Boolean(releasedSlot),
        });
      });
    });
  });
  return result;
}

function memberScheduleRequestOnly(policy = loadAdminSchedulePolicy()) {
  return policy.memberScheduleRequestOnly !== false;
}

function memberScheduleVisibleLesson(lesson, policy = loadAdminSchedulePolicy()) {
  if (lesson.status === "available") return true;
  return isOwnMemberScheduleLesson(lesson);
}

function memberScheduleWeekForOffset(rawOffset = 0) {
  const offset = Math.min(
    Math.max(Number(rawOffset) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  return {
    ...(offset >= 0 ? memberScheduleWeeks[offset] || {} : {}),
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    note: offset === 0 ? "이번 주 정규 수업과 변경 가능 시간" : "선택한 주의 수업과 변경 가능 시간",
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}

function memberQuickWeekOptions() {
  return [
    { offset: 0, label: "이번 주" },
    { offset: 1, label: "다음 주" },
    { offset: 2, label: "다다음 주" },
  ].map((option) => ({ ...option, week: memberScheduleWeekForOffset(option.offset) }));
}

function scheduleSummaryText(lesson, fallback) {
  if (!lesson) return fallback;
  return lessonDateTimeLabel(lesson, fallback);
}

function memberScheduleTicketCoachName(ticket = {}, policy = loadAdminSchedulePolicy()) {
  const roleId = String(ticket.coachRoleId || ticket.coach_role_id || "");
  const coach = policy.coaches.find((item) => (
    String(item.serverRoleId || item.roleId || item.id || "") === roleId
  ));
  return memberCoachShortName(coach?.name || ticket.coachName || memberTicketLessonCoach(ticket.id) || "담당 코치");
}

function memberScheduleCardName(lesson, isMine) {
  return isMine ? (currentMemberName() || "회원") : memberLessonTitle(lesson, false);
}

function memberScheduleExceptionLabel(lesson = {}) {
  const status = String(lesson.serverStatus || lesson.status || "").toLowerCase();
  if (lesson.oneDayBooking && ["reserved", "scheduled", "checked_in"].includes(status)) return "원데이 예약";
  const context = `${lesson.lessonSource || ""} ${lesson.type || ""} ${lesson.changeNote || ""}`;
  let detail = "";
  if ((lesson.originalCoachRoleId && lesson.coach_role_id && lesson.originalCoachRoleId !== lesson.coach_role_id) || /대타/.test(context)) detail = "대타";
  else if (/코치\s*변경/.test(context)) detail = "코치 변경";
  else if (/시간\s*변경|변경\s*완료/.test(context)) detail = "시간 변경";
  const deducted = Number(lesson.deductedSessions) > 0;
  const outcome = status === "completed"
    ? `완료 · ${deducted ? "차감" : "미차감"}`
    : status === "no_show"
      ? `노쇼 · ${deducted ? "차감" : "미차감"}`
      : ["absence", "absent"].includes(status)
        ? `불참 · ${deducted ? "차감" : "차감 없음"}`
        : status === "holiday"
          ? "휴무 · 차감 없음"
          : status === "cancelled"
            ? "취소 · 차감 없음"
            : "";
  return outcome ? `${outcome}${detail ? ` · ${detail}` : ""}` : detail;
}

function currentMemberScheduleDay() {
  const dayIndex = new Date().getDay();
  return days[dayIndex === 0 ? 6 : dayIndex - 1];
}

function memberWeekDateForDay(day) {
  const week = activeMemberWeek();
  const dayIndex = days.indexOf(day);
  if (!week.startDate || dayIndex < 0) return "";
  const value = new Date(`${week.startDate}T00:00:00`);
  value.setDate(value.getDate() + dayIndex);
  return localDateKey(value);
}

function memberScheduleDateLabel(day) {
  const value = memberWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function currentWeekMemberLessons() {
  const week = activeMemberWeek();
  const selectedTicketId = ensureMemberScheduleTicketSelection();
  return memberScheduleLessons()
    .filter((lesson) => isOwnMemberScheduleLesson(lesson) && ["scheduled", "requested", "makeup_due"].includes(lesson.status))
    .filter((lesson) => !selectedTicketId || memberLessonTicketId(lesson) === selectedTicketId)
    .filter((lesson) => !lesson.lessonDate || (lesson.lessonDate >= week.startDate && lesson.lessonDate <= week.endDate))
    .sort((a, b) => `${a.lessonDate || ""} ${a.time || ""}`.localeCompare(`${b.lessonDate || ""} ${b.time || ""}`));
}

function regularInitialSourceLesson() {
  return currentScheduledLessonsForChange().find((lesson) => lesson.regularInitialBooking) || null;
}

function memberBookingSourceTitle(source = {}) {
  if (source.couponBooking || source.regularInitialBooking) {
    return source.ticketTitle || memberBookingSourceTicket(source)?.title || "회원권";
  }
  if (source.status === "makeup_due") return `보강 · ${lessonDateTimeLabel(source)}`;
  return `${lessonDateTimeLabel(source)} 수업`;
}

function memberBookingSourceMeta(source = {}) {
  const ticket = memberBookingSourceTicket(source);
  const remainingValue = Number.isFinite(Number(source.remaining))
    ? Number(source.remaining)
    : Number(ticket?.remaining);
  const remaining = Number.isFinite(remainingValue) ? ` · 잔여 ${Math.max(0, remainingValue)}회` : "";
  return `${memberCoachShortName(source.coach || memberScheduleTicketCoachName(ticket || {}))} 코치${remaining}`;
}

function memberCandidateWindowLabel(lesson = {}) {
  if (lesson.releasedRegularSlot) return "불참으로 열린 자리";
  return "예약 가능";
}

function memberChangeCandidateRange(source = null, week = activeMemberWeek()) {
  const activeStart = new Date(`${week.startDate}T12:00:00`);
  const activeEnd = new Date(`${week.endDate}T12:00:00`);
  const sourceDate = source?.lessonDate ? new Date(`${source.lessonDate}T12:00:00`) : activeStart;
  const sourceDayOffset = sourceDate.getDay() === 0 ? -6 : 1 - sourceDate.getDay();
  const sourceStart = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate() + sourceDayOffset);
  const sourceEnd = new Date(sourceStart.getFullYear(), sourceStart.getMonth(), sourceStart.getDate() + 6);
  const nextWeekEnd = new Date(activeEnd.getFullYear(), activeEnd.getMonth(), activeEnd.getDate() + 7);
  let from = new Date(Math.min(activeStart.getTime(), sourceStart.getTime()));
  let to = new Date(Math.max(activeEnd.getTime(), sourceEnd.getTime(), nextWeekEnd.getTime()));
  if ((to.getTime() - from.getTime()) / 86400000 > 30) {
    from = new Date(sourceStart.getFullYear(), sourceStart.getMonth(), sourceStart.getDate() - 7);
    to = new Date(sourceEnd.getFullYear(), sourceEnd.getMonth(), sourceEnd.getDate() + 7);
  }
  return { from: localDateKey(from), to: localDateKey(to) };
}

function memberChangeCandidateInActiveWeek(candidate = {}) {
  const week = activeMemberWeek();
  const lessonDate = String(candidate.lessonDate || "");
  return Boolean(lessonDate && lessonDate >= week.startDate && lessonDate <= week.endDate);
}

function memberChangeCandidateKey(source = null, week = activeMemberWeek()) {
  const ticketId = source?.member_ticket_id || source?.ticketId || "";
  const sourceId = source?.serverLessonId || (source?.couponBooking && ticketId ? `coupon:${ticketId}` : "");
  const range = memberChangeCandidateRange(source, week);
  const editKey = state.editingChangeRequestId ? `:edit:${state.editingChangeRequestId}` : "";
  return sourceId ? `${sourceId}:${range.from}:${range.to}${editKey}` : "";
}

function memberChangeCandidateUiState(source = null) {
  const loadState = memberChangeCandidateLoadState(source);
  if (loadState === "idle") return "loading";
  if (loadState === "fallback") return "ready";
  return loadState;
}

function memberScheduleIdentityIssue(workspace = {}, integrity = null, profileId = "") {
  const integrityStatus = String(integrity?.status || "");
  if (integrityStatus === "identity_ambiguous") {
    return {
      code: "auth_profile_mapping_ambiguous",
      message: "로그인 계정이 여러 회원 정보에 연결되어 있습니다. 관리자에게 회원 연결 확인을 요청해 주세요.",
    };
  }
  if (integrityStatus === "identity_unlinked") {
    return {
      code: "auth_profile_unlinked",
      message: "로그인 계정과 회원 정보 연결을 확인해야 합니다. 관리자에게 회원 연결을 요청해 주세요.",
    };
  }
  if (workspace?.actorUserId && profileId && String(workspace.actorUserId) !== String(profileId)) {
    return {
      code: "member_profile_actor_mismatch",
      message: "앱의 회원 정보와 서버 연결 정보가 일치하지 않습니다. 기존 화면은 유지하고 연결 확인을 기다립니다.",
    };
  }
  return null;
}

function memberChangeCandidateFailure(errorText = "") {
  const normalized = String(errorText || "");
  if (/auth_profile_mapping_ambiguous/i.test(normalized)) {
    return {
      code: "auth_profile_mapping_ambiguous",
      message: "로그인 계정에 회원 정보가 두 개 이상 연결되어 있습니다. 관리자에게 회원 연결 확인을 요청해 주세요.",
    };
  }
  if (/auth_profile_mapping_stale|auth_profile_identity_context_invalid/i.test(normalized)) {
    return {
      code: "auth_profile_mapping_stale",
      message: "회원 연결 상태가 갱신 중입니다. 다시 확인해도 계속되면 관리자에게 회원 연결 확인을 요청해 주세요.",
    };
  }
  if (/auth_profile_unlinked|member_not_linked|member_required/i.test(normalized)) {
    return {
      code: "auth_profile_unlinked",
      message: "로그인 계정과 회원 정보 연결을 확인해야 변경 가능한 시간을 볼 수 있습니다.",
    };
  }
  if (/source_lesson_not_found|lesson_not_found/i.test(normalized)) {
    return {
      code: "source_lesson_not_found",
      message: "변경할 원래 수업을 찾지 못했습니다. 최신 시간표를 다시 불러온 뒤 수업을 다시 선택해 주세요.",
    };
  }
  if (/source_lesson_not_owned|lesson_not_owned|ticket_not_owned/i.test(normalized)) {
    return {
      code: "source_lesson_not_owned",
      message: "이 수업과 로그인한 회원의 연결을 확인해야 합니다. 관리자에게 문의해 주세요.",
    };
  }
  if (/ticket_(inactive|expired|not_started)|outside_ticket_period/i.test(normalized)) {
    return {
      code: "ticket_not_available",
      message: "회원권 이용기간 또는 상태 때문에 변경할 수 없습니다. 회원권 내용을 확인해 주세요.",
    };
  }
  return {
    code: "candidate_server_failed",
    message: "변경 가능한 시간을 서버에서 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
  };
}

function scheduleV2MemberLessonKind(kind = "") {
  return {
    regular: "정규",
    makeup: "보강",
    coupon: "쿠폰",
    one_day: "원데이",
    correction: "관리자 보정",
  }[String(kind || "").toLowerCase()] || "수업";
}

function scheduleV2MemberOutcomeStatus(record = null, fallback = "scheduled") {
  if (!record || String(record.recordStatus || "") !== "final") return fallback;
  return {
    absence: "absent",
  }[String(record.outcome || "").toLowerCase()] || String(record.outcome || fallback).toLowerCase();
}

function memberWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const targetDayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + targetDayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
}

function memberScheduleMonthValue(week = activeMemberWeek()) {
  return String(week.startDate || "").slice(0, 7);
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function ensureScheduleBaseline() {
  if (state.dataMode === "live") return;
  const baseline = [
    { id: "mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "mon-1900", day: "월", time: "19:00", coach: "강 코치", member: "최유나&이하린", type: "정규", status: "occupied" },
    { id: "mon-1900-no", day: "월", time: "19:00", coach: "노 코치", member: "윤서준", type: "정규", status: "occupied" },
    { id: "tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "fri-1900", day: "금", time: "19:00", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "sat-2020", day: "토", time: "20:20", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "thu-2020", day: "목", time: "20:20", coach: "강 코치", member: "박민재", type: "정규", status: "occupied" },
    { id: "fri-2050", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규", status: "occupied" },
    { id: "sat-1840", day: "토", time: "18:40", coach: "황 코치", member: "임현우", type: "정규", status: "occupied" },
  ];
  baseline.forEach((item) => {
    const existing = lessons.find((lesson) => lesson.id === item.id);
    if (existing) {
      if (existing.type.includes("보강") || existing.type.includes("변경")) existing.type = "수업 변경 가능";
      existing.policy = existing.policy || item.policy;
      if (!existing.status && existing.member && !isCurrentMemberName(existing.member)) existing.status = "occupied";
      return;
    }
    lessons.push(item);
  });
}

function memberNotificationLesson(data = {}) {
  const lessonId = String(data.lessonId || data.lesson_id || "").trim();
  if (!lessonId) return null;
  return memberScheduleOptions().find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || (state.liveLessons || []).find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || null;
}

function memberScheduleLaneOrder(coach = {}) {
  const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
  const workspaceCoaches = memberScheduleV2WorkspaceCache?.workspace?.coaches || [];
  const index = workspaceCoaches.findIndex((item) => String(item.roleId || "") === roleId);
  const serverCoach = index >= 0 ? workspaceCoaches[index] : null;
  if (Number.isFinite(Number(serverCoach?.laneOrder)) && Number(serverCoach.laneOrder) !== 1000) {
    return Number(serverCoach.laneOrder);
  }
  if (index >= 0) return 1000 + index;
  return Number(coach.laneOrder ?? coach.scheduleLaneOrder ?? memberCoachOrder(coach.id));
}

function sourceLessonScheduleScope(sourceLesson = {}) {
  const ticketId = sourceLesson.member_ticket_id || sourceLesson.ticketId || "";
  const ticket = (state.liveTickets || []).find((item) => item.id === ticketId);
  return ticket?.scheduleScope || activeTicketScheduleScope();
}

function memberOpenMakeupEntitlements() {
  return (state.liveMakeupEntitlements || []).filter((item) => (
    item.status === "open" && !memberTicketRefundHeld(item.ticketId)
  ));
}

function memberReleasedMakeupSlot(lessonDate, time, coachRoleId, durationMinutes) {
  return (state.liveReleasedMakeupSlots || []).find((slot) => (
    slot.lessonDate === lessonDate
    && slot.time === time
    && slot.coachRoleId === coachRoleId
    && Number(slot.durationMinutes) === Number(durationMinutes)
  ));
}

function memberLessons() {
  const current = memberScheduleLessons().filter((lesson) => isOwnMemberScheduleLesson(lesson) && ["scheduled", "requested"].includes(lesson.status));
  if (current.length || state.liveLessonsLoaded || state.dataMode === "live") return current;
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && ["scheduled", "requested"].includes(lesson.status));
}

function currentScheduledLessonsForChange() {
  const dueLessons = memberMakeupDueLessons();
  const fromSchedule = memberScheduleLessons().filter((lesson) => (
    memberLessonCanRequestChange(lesson)
    && !memberTicketRefundHeld(memberLessonTicketId(lesson))
  ));
  const futureLessons = loadedFutureScheduledLessonsForChange()
    .filter((lesson) => !memberTicketRefundHeld(memberLessonTicketId(lesson)));
  const couponTickets = memberBookableCouponTickets();
  const regularTickets = memberBookableRegularTickets();
  const pausedTickets = memberBookablePausedTickets();
  const editingRequest = state.makeupRequests.find((request) => (
    String(request.serverRequestId || request.id || "") === String(state.editingChangeRequestId || "")
    && request.rawStatus === "pending"
  ));
  const editablePendingLesson = editingRequest
    ? memberScheduleLessons().find((lesson) => (
      isOwnMemberScheduleLesson(lesson)
      && String(lesson.serverLessonId || "") === String(editingRequest.lessonId || "")
    ))
    : null;
  const editablePending = editablePendingLesson ? [{ ...editablePendingLesson, status: "scheduled", editingChangeRequest: true }] : [];
  if (dueLessons.length || fromSchedule.length || futureLessons.length || couponTickets.length || regularTickets.length || pausedTickets.length || editablePending.length || state.liveLessonsLoaded || state.dataMode === "live") {
    const seen = new Set();
    return editablePending.concat(dueLessons, fromSchedule, futureLessons, couponTickets, regularTickets, pausedTickets).filter((lesson) => {
      const key = String(lesson.id || lesson.serverLessonId || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
}

function loadedFutureScheduledLessonsForChange(today = localDateKey()) {
  return (state.liveLessons || [])
    .filter((lesson) => (
      memberLessonCanRequestChange(lesson)
      && lesson.lessonDate
      && lesson.lessonDate >= today
    ))
    .sort((a, b) => `${a.lessonDate} ${a.time || ""}`.localeCompare(`${b.lessonDate} ${b.time || ""}`));
}

function memberScheduleLessons() {
  const liveLessons = (state.liveLessons || []).filter((lesson) => {
    const week = activeMemberWeek();
    if (!lesson.lessonDate || !week.startDate || !week.endDate) return true;
    return lesson.lessonDate >= week.startDate && lesson.lessonDate <= week.endDate;
  });
  if (state.dataMode === "live" || state.liveLessonsLoaded || liveLessons.length || state.liveLessons?.length) return liveLessons;
  const adminLessons = adminMemberScheduleLessons();
  if (state.activeMemberWeekIndex === 0 && adminLessons.length) {
    return adminLessons.map((adminLesson) => lessons.find((stored) => stored.id === adminLesson.id) || adminLesson);
  }
  const weekLessons = activeMemberWeek().lessons || [];
  if (!weekLessons.length && state.activeMemberWeekIndex !== 0) return [];
  const storedWeekIds = new Set(weekLessons.map((lesson) => lesson.id));
  const mergedWeekLessons = weekLessons.map((lesson) => lessons.find((stored) => stored.id === lesson.id) || lesson);
  return lessons.filter((lesson) => !storedWeekIds.has(lesson.id)).concat(mergedWeekLessons);
}

function memberApprovedChangeForLesson(lesson = {}) {
  const lessonId = String(lesson.serverLessonId || lesson.id || "");
  return (state.makeupRequests || []).find((request) => (
    String(request.lessonId || "") === lessonId
    && ["approved", "auto_approved"].includes(request.rawStatus)
    && request.originalDate
    && request.targetDate
  )) || null;
}

function memberScheduleRoundLabel(lesson, isMine) {
  if (!isMine || lesson?.oneDayBooking) return "";
  const total = Math.max(0, Number(lesson.ticketTotalSessions) || 0);
  const used = Math.max(0, Number(lesson.ticketUsedSessions) || 0);
  const completed = ["completed", "no_show"].includes(String(lesson.serverStatus || "").toLowerCase());
  const ticketId = memberLessonTicketId(lesson);
  const futureLessons = (state.liveLessons || [])
    .filter((item) => (
      isOwnMemberScheduleLesson(item)
      && item.status === "scheduled"
      && memberLessonTicketId(item) === ticketId
    ))
    .sort((left, right) => `${left.lessonDate || ""}T${left.time || ""}`.localeCompare(`${right.lessonDate || ""}T${right.time || ""}`));
  const futureIndex = futureLessons.findIndex((item) => String(item.id) === String(lesson.id));
  const nextRound = used + Math.max(0, futureIndex) + 1;
  const round = total ? Math.min(total, completed ? Math.max(1, used) : nextRound) : 0;
  return `${round}/${total}회차`;
}

function memberScheduleOperationDay(day) {
  const date = memberWeekDateForDay(day);
  return (state.scheduleOperationDays || []).find((operation) => operation.date === date) || null;
}

function memberChangeTimetableIsPending(source = null) {
  if (!memberChangeUsesServerCandidates(source)) return false;
  const loadState = memberChangeCandidateUiState(source);
  return loadState === "loading"
    || loadState === "error"
    || (loadState === "ready" && state.serverChangeCandidates.length === 0);
}

function memberDesktopScheduleBackgroundRuns(policy, day, coach, scheduleTimeList) {
  return scheduleTimeList.reduce((runs, time, timeIndex) => {
    const breakRule = memberBreakRuleForSlot(policy, day, time);
    const isWorking = !breakRule && isMemberCoachWorking(coach, day, time, 10);
    const state = breakRule ? "blocked" : isWorking ? "base" : "off";
    const label = breakRule ? (breakRule.label || "브레이크") : state === "off" ? "근무외" : "";
    const previous = runs.at(-1);
    if (previous && previous.state === state && previous.label === label) {
      previous.span += 1;
      return runs;
    }
    runs.push({ state, label, startIndex: timeIndex, span: 1 });
    return runs;
  }, []);
}

function memberChangeUsesServerCandidates(source = null) {
  const ticketId = source?.member_ticket_id || source?.ticketId || "";
  return Boolean(
    state.dataMode === "live"
    && (source?.serverLessonId || (source?.couponBooking && ticketId))
    && !source?.makeupEntitlementId
    && !source?.regularInitialBooking,
  );
}

function memberChangeCandidateLoadState(source = null) {
  if (!memberChangeUsesServerCandidates(source)) return "fallback";
  const key = memberChangeCandidateKey(source);
  if (state.serverChangeCandidateKey !== key) return "idle";
  return state.serverChangeCandidateStatus || "idle";
}

function purchaseScheduleOperationForDate(dateKey = "") {
  const directory = purchaseDirectoryForCurrentProduct();
  const operationDays = Array.isArray(directory?.operationDays) ? directory.operationDays : state.scheduleOperationDays || [];
  return operationDays.find((operation) => String(operation.date || "") === dateKey) || null;
}

function purchaseScheduleAvailabilityState() {
  if (state.dataMode !== "live" || !state.member?.profileId) return "ready";
  const context = purchaseDirectoryContext();
  if (memberPurchaseDirectoryLoad.key !== context.key || memberPurchaseDirectoryLoad.status === "idle") return "loading";
  if (memberPurchaseDirectoryLoad.status === "error") return "error";
  if (memberPurchaseDirectoryLoad.status !== "ready") return "loading";
  const directory = purchaseDirectoryForCurrentProduct();
  if (!Array.isArray(directory?.coaches) || !directory.coaches.length) return "coach_error";
  return "ready";
}

function purchaseAvailableScheduleSlots(product = purchaseFlowProduct()) {
  if (!product || purchaseScheduleAvailabilityState() !== "ready") return [];
  const policy = purchaseSchedulePolicy(product);
  const sourceTicket = purchaseFlowSourceTicket();
  const durationMinutes = Math.max(10, Number(product.lessonMinutes) || 20);
  const scopes = purchaseProductScheduleScopes(product);
  const scheduleLessons = purchaseOccupancyLessons(product);
  const { start, end } = purchaseAvailabilityRange();
  const now = Date.now();
  const sourceCoachId = purchaseFlowState().purchasePurpose === "renew_same"
    ? String(sourceTicket?.coachRoleId || "")
    : "";
  const coaches = purchaseCoachOptions().filter((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    if (!purchaseProductAllowsCoach(product, roleId)) return false;
    if (!sourceCoachId) return true;
    return roleId === sourceCoachId;
  });
  const slots = [];
  for (let dateKey = start; dateKey <= end;) {
    const day = purchaseDateDay(dateKey);
    const dateScope = ["토", "일"].includes(day) ? "weekend" : "weekday";
    const operation = purchaseScheduleOperationForDate(dateKey);
    if (scopes.has(dateScope)
      && !(durationMinutes === 30 && dateScope === "weekend")
      && operation?.mode !== "closed") {
      coaches.forEach((coach) => {
        memberCoachBookableTimes(coach, day, durationMinutes).forEach((time) => {
          if (new Date(`${dateKey}T${time}:00`).getTime() <= now) return;
          if (!purchaseOperationAllowsSlot(operation, time, durationMinutes)) return;
          if (memberBreakRuleOverlaps(policy, day, time, durationMinutes)) return;
          if (!isMemberCoachWorking(coach, day, time, durationMinutes)) return;
          if (purchaseHasCoachLessonAtDate(scheduleLessons, dateKey, time, coach, durationMinutes, policy)) return;
          if (!purchaseSlotInsideAnchorWindow(scheduleLessons, product, dateKey, time, coach, policy)) return;
          const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
          if (!roleId) return;
          slots.push({
            id: `purchase-slot-${dateKey}-${time}-${roleId}`,
            lessonDate: dateKey,
            day,
            time,
            coachRoleId: roleId,
            coachName: coach.name || "담당 코치",
          });
        });
      });
    }
    const next = new Date(`${dateKey}T12:00:00`);
    next.setDate(next.getDate() + 1);
    dateKey = localDateKey(next);
  }
  return slots.sort((left, right) => (
    `${left.lessonDate} ${left.time}`.localeCompare(`${right.lessonDate} ${right.time}`)
    || left.coachName.localeCompare(right.coachName, "ko")
  ));
}

function memberScheduleV2Context(profile = null, week = activeMemberWeek()) {
  const profileId = profile?.id || state.member?.profileId || "";
  const workspaceStart = new Date(`${week.startDate}T12:00:00`);
  const workspaceEnd = new Date(
    workspaceStart.getFullYear(),
    workspaceStart.getMonth(),
    workspaceStart.getDate() + memberScheduleWorkspaceDays,
  );
  const workspaceEndDate = localDateKey(workspaceEnd);
  return {
    profileId,
    week,
    workspaceEndDate,
    key: `${profileId}:${week.startDate}:${workspaceEndDate}`,
  };
}

function liveLessonForJournal(log = {}) {
  const targetDate = log.journalDate || "";
  const targetTime = String(log.lessonLabel || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
  const candidates = state.liveLessons.filter((lesson) => lesson.isOwnLesson && lesson.status === "scheduled");
  return candidates.find((lesson) => lesson.id === log.lessonId)
    || candidates.find((lesson) => lesson.lessonDate === targetDate && lesson.time === targetTime)
    || candidates.find((lesson) => lesson.lessonDate === targetDate)
    || null;
}

function selectedLessonDetail() {
  return memberDisplayLessons(memberScheduleOptions()).find((lesson) => lesson.id === state.selectedLessonDetailId)
    || memberDisplayLessons(memberMakeupDueLessons()).find((lesson) => lesson.id === state.selectedLessonDetailId)
    || memberDisplayLessons(state.liveLessons || []).find((lesson) => lesson.id === state.selectedLessonDetailId)
    || null;
}
