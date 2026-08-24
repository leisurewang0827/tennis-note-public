// 시간표의 주차·요일·시간대를 계산하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function buildScheduleWeeks() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  return [0, 1, 2].map((offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    return {
      label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
      range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      startDate: localDateKey(start),
      endDate: localDateKey(end),
    };
  });
}

function scheduleWeek(offset = 0) {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  return {
    ...(offset >= 0 ? scheduleWeeks[offset] || {} : {}),
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}

function activeWeekIndex() {
  const offset = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(Number(state.selectedWeekIndex) || 0, coachScheduleMaxWeekOffset),
  );
  state.selectedWeekIndex = offset;
  return offset;
}

function activeScheduleWeek() {
  return scheduleWeek(activeWeekIndex());
}

function coachScheduleV2SyncRange(week = activeScheduleWeek(), today = new Date()) {
  const feedbackCutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const todayKey = localDateKey(today);
  const cutoffKey = localDateKey(feedbackCutoff);
  const candidateFrom = week.startDate > cutoffKey ? cutoffKey : week.startDate;
  const candidateTo = week.endDate < todayKey ? todayKey : week.endDate;
  const spanDays = Math.round((
    new Date(`${candidateTo}T12:00:00`) - new Date(`${candidateFrom}T12:00:00`)
  ) / 86_400_000);
  if (spanDays <= 31) return { startDate: candidateFrom, endDate: candidateTo };
  return { startDate: week.startDate, endDate: week.endDate };
}

function weekLessons() {
  const week = activeWeekIndex();
  if (state.liveLessonsLoaded || state.dataMode === "live") {
    const selectedWeek = activeScheduleWeek();
    return [...state.liveLessons, ...(state.releasedMakeupSlots || [])].filter((lesson) => (
      !lesson.lessonDate
      || (lesson.lessonDate >= selectedWeek.startDate && lesson.lessonDate <= selectedWeek.endDate)
    ));
  }
  const adminLessons = adminLessonsForCoachApp();
  const baseLessons = adminLessons.length
    ? adminLessons.map((lesson) => {
        const stored = state.todayLessons.find((item) => item.id === lesson.id);
        return stored ? { ...lesson, ...stored, coach: lesson.coach, ticket: lesson.ticket, type: lesson.type } : lesson;
      })
    : state.todayLessons;
  if (week === 0) return baseLessons;
  if (week === 1) {
    return [
      ...baseLessons.filter((lesson) => !["lesson-1", "lesson-4"].includes(lesson.id)),
      { id: "week2-change-1", day: "화", time: "18:50", coach: "노 코치", member: "김서준", type: "시간변경", ticket: "개인레슨 10회", status: "변경 완료", remaining: 7, task: "수요일 20:00에서 변경됨", changeNote: "변경 완료" },
      { id: "week2-request-1", day: "금", time: "19:00", coach: "강 코치", member: "이하린", type: "변경요청", ticket: "개인레슨 8회", status: "승인 대기", remaining: 2, task: "기준시간 이내 요청", changeNote: "승인 필요" },
    { id: "week2-change-2", day: "토", time: "20:20", coach: "박창준 코치", member: "임현우", type: "시간변경", ticket: "주말반 8회", status: "변경 완료", remaining: 3, task: "코치 일정 변경", changeNote: "코치 변경" },
    ];
  }
  if (week === 2) {
    return [
      ...baseLessons,
      { id: "week3-request-1", day: "목", time: "19:40", coach: "노 코치", member: "오윤정", type: "변경요청", ticket: "주2회 12회", status: "승인 대기", remaining: 10, task: "회원 요청", changeNote: "승인 필요" },
    ];
  }
  return [];
}

function makeCoachTimeRange(startTime, endTime, stepMinutes = scheduleBlockMinutes) {
  const result = [];
  for (let current = minutesFromTime(startTime); current <= minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function coachScheduleCardCoachLabel(lesson = {}) {
  const actualCoach = shortCoachName(lesson.coach || "");
  return lesson.isSubstitute ? `대타 ${actualCoach || "확인"}` : actualCoach;
}

function coachScheduleTimes(policy = loadCoachSchedulePolicy()) {
  const range = "all";
  const allStart = policy.openStart;
  const allEnd = policy.openEnd;
  if (range === "morning") return makeCoachTimeRange(allStart, "12:00");
  if (range === "afternoon") return makeCoachTimeRange("12:00", "17:00");
  if (range === "evening") return makeCoachTimeRange("17:00", allEnd);
  if (range === "all") return makeCoachTimeRange(allStart, allEnd);
  const lessons = weekLessons().filter((lesson) => lesson.status !== "available");
  if (!lessons.length) return makeCoachTimeRange("17:00", allEnd);
  const starts = lessons.map((lesson) => minutesFromTime(lesson.time));
  const ends = lessons.map((lesson) => minutesFromTime(lesson.time) + lessonDuration(lesson));
  const start = Math.max(minutesFromTime(allStart), Math.floor((Math.min(...starts) - 30) / 10) * 10);
  const end = Math.min(minutesFromTime(allEnd), Math.ceil((Math.max(...ends) + 30) / 10) * 10);
  const startText = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const endText = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return makeCoachTimeRange(startText, endText);
}

function coachScheduleRoundLabel(lesson = {}) {
  const ticketTotal = Number(lesson.totalSessions) || Number(String(lesson.ticket || "").match(/(\d+)\s*회/)?.[1]) || 0;
  const used = Math.max(0, Number(lesson.usedSessions) || Math.max(0, ticketTotal - (Number(lesson.remaining) || 0)));
  const completed = Number(lesson.deductedSessions) > 0;
  const round = ticketTotal ? Math.min(ticketTotal, completed ? Math.max(1, used) : used + 1) : 0;
  return `${round}/${ticketTotal}회차`;
}

function coachScheduleExceptionLabel(lesson = {}) {
  if (lesson.releasedOriginLabel) return lesson.releasedOriginLabel;
  const context = `${lesson.lessonSource || ""} ${lesson.type || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`;
  let detail = "";
  if ((lesson.originalCoachRoleId && lesson.coachRoleId && lesson.originalCoachRoleId !== lesson.coachRoleId) || /대타/.test(context)) detail = "대타";
  else if (/코치\s*변경/.test(context)) detail = "코치 변경";
  else if (/시간\s*변경|변경\s*완료/.test(context)) detail = "시간 변경";
  const cardState = coachLessonCardState(lesson);
  const stateLabel = cardState.id === "scheduled" ? "" : cardState.label;
  return stateLabel ? `${stateLabel}${detail ? ` · ${detail}` : ""}` : detail;
}

function currentCoachScheduleDay() {
  const dayIndex = new Date().getDay();
  return scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1];
}

function selectedCoachScheduleDay() {
  if (!scheduleDays.includes(state.selectedFullScheduleDay)) state.selectedFullScheduleDay = currentCoachScheduleDay();
  return state.selectedFullScheduleDay;
}

function coachWeekDateForDay(day) {
  const week = activeScheduleWeek();
  const dayIndex = scheduleDays.indexOf(day);
  if (!week?.startDate || dayIndex < 0) return "";
  const value = new Date(`${week.startDate}T00:00:00`);
  value.setDate(value.getDate() + dayIndex);
  return localDateKey(value);
}

function coachScheduleDateLabel(day) {
  const value = coachWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function coachScheduleOperationDay(day) {
  const date = coachWeekDateForDay(day);
  return (state.scheduleOperationDays || []).find((operation) => operation.date === date) || null;
}

function makeCoachStartTimes(startTime, endTime, stepMinutes = scheduleBlockMinutes) {
  const result = [];
  for (let current = minutesFromTime(startTime); current < minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function coachOperatingWindows(day, policy) {
  return mergeCoachScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
}

function coachCanAddToSlot(coach, day, time, durationMinutes = scheduleBlockMinutes, policy = loadCoachSchedulePolicy()) {
  return coachSlotAccess(coach, day, time, durationMinutes, policy).allowed;
}

function coachQuickAddSlotMarkup({ coach, day, time, className, label, style = "", policy = loadCoachSchedulePolicy() }) {
  const access = coachSlotAccess(coach, day, time, scheduleBlockMinutes, policy);
  const canAdd = access.allowed;
  const lockedOverride = access.reason === "locked_time_override";
  const date = coachWeekDateForDay(day);
  const overrideClass = canAdd && lockedOverride ? " locked-override" : "";
  const content = canAdd ? `<span aria-hidden="true">+</span><small>${lockedOverride ? "수동" : ""}</small>` : (label ? `<span>${escapeHtml(label)}</span>` : "");
  const styleAttr = style ? ` style="${style}"` : "";
  if (!canAdd) return `<div class="${className}${overrideClass}"${styleAttr} aria-label="${day}요일 ${time} ${escapeHtml(shortCoachName(coach.name))} ${label || "빈 시간"}">${content}</div>`;
  return `<button class="${className} coach-add-slot${overrideClass}"${styleAttr} type="button" data-coach-add-lesson data-date="${date}" data-day="${day}" data-time="${time}" data-coach-role-id="${escapeHtml(coach.roleId || coach.id)}" aria-label="${day}요일 ${time} ${escapeHtml(shortCoachName(coach.name))} ${lockedOverride ? "브레이크·상담 시간 수동 등록" : "수업 추가"}">${content}</button>`;
}

function coachLockedTimesForDay(day, policy) {
  if (policy.allowCoachLockedTimeOverride === false) return [];
  const currentRoleId = currentCoachRoleId();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id || "") === currentRoleId);
  if (!coach || !(coach.workBlocks || []).some((block) => block.days.includes(day))) return [];
  const rules = [...(policy.breakRules || []), ...(coach.blockedBlocks || [])]
    .filter((rule) => Array.isArray(rule.days) && rule.days.includes(day));
  const seen = new Set();
  return rules.flatMap((rule) => makeCoachStartTimes(rule.start, rule.end)
    .filter((time) => coachSlotAccess(coach, day, time, scheduleBlockMinutes, policy).allowed)
    .map((time) => ({ time, label: rule.label || "브레이크·상담" })))
    .filter((item) => {
      if (seen.has(item.time)) return false;
      seen.add(item.time);
      return true;
    });
}

function fullScheduleFilterOptions() {
  return [
    { id: "mine", label: "내 수업" },
    { id: "feedback", label: "피드백 필요" },
    { id: "makeupChange", label: "변경·보강" },
    { id: "all", label: "전체 시간표" },
  ];
}

function fullScheduleFilterLabel(filter) {
  return fullScheduleFilterOptions().find((item) => item.id === filter)?.label || "전체";
}

function filterFullScheduleLessons(lessons, filter) {
  if (filter === "mine") return lessons.filter((lesson) => (
    canonicalCoachName(lesson.coach) === currentCoachName()
    || canonicalCoachName(lesson.originalCoach) === currentCoachName()
  ));
  if (filter === "feedback") return lessons.filter((lesson) => (
    lessonAssignedToCurrentCoachForTasks(lesson)
    && coachLessonCardState(lesson).needsFeedback
  ));
  if (filter === "makeupChange")
    return lessons.filter((lesson) =>
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("보강") ||
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("변경") ||
      `${lesson.status || ""}`.includes("승인 대기"),
    );
  return lessons;
}

function coachRequestTimelineState(lesson = {}) {
  const context = `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`;
  if (/승인 대기|승인 필요|pending_change/.test(context)) return { id: "approval", label: "승인 필요", order: 0 };
  if (lesson.releasedMakeupSlot || /시간 선택 대기|보강 가능/.test(context)) return { id: "slot", label: "시간 선택", order: 1 };
  if (/변경/.test(context)) return { id: "changed", label: "변경 완료", order: 2 };
  return { id: "booked", label: "보강 확정", order: 3 };
}

function coachRequestTimelineDate(lesson = {}) {
  return String(lesson.lessonDate || coachWeekDateForDay(lesson.day) || "");
}

function coachWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const targetDayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + targetDayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
}

function coachScheduleMonthValue(week = activeScheduleWeek()) {
  return String(week.startDate || "").slice(0, 7);
}
