// 코치의 근무·휴식·배정을 판정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function makeMemberTimeRange(startTime, endTime, stepMinutes = 10) {
  const result = [];
  for (let current = minutesFromTime(startTime); current <= minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function defaultMemberCoachPolicy() {
  const weekdays = days.slice(0, 5);
  const weekend = days.slice(5);
  return {
    openStart: "06:40",
    openEnd: "22:00",
    breakRules: [{ id: "weekday-midday", days: weekdays, start: "13:00", end: "17:00", label: "수업 없음" }],
    lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
    memberScheduleRequestOnly: true,
    requireMakeupDayAnchor: true,
    makeupAnchorGapMinutes: 40,
    coaches: [
      {
        id: "coach-no",
        name: "노 코치",
        status: "active",
        workBlocks: [
          { id: "coach-no-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" },
          { id: "coach-no-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" },
        ],
      },
      {
        id: "coach-hwang",
        name: "황 코치",
        status: "active",
        workBlocks: [{ id: "coach-hwang-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" }],
      },
      {
        id: "coach-kang",
        name: "강 코치",
        status: "active",
        workBlocks: [{ id: "coach-kang-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" }],
      },
      {
        id: "coach-park",
        name: "박창준 코치",
        status: "active",
        workBlocks: [{ id: "coach-park-weekend", days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }],
      },
    ],
  };
}

function memberDefaultWorkBlocksForCoach(coach) {
  const weekdays = days.slice(0, 5);
  const weekend = days.slice(5);
  if (coach.id === "coach-no" || coach.availability === "split") {
    return [
      { id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" },
      { id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" },
    ];
  }
  if (coach.id === "coach-hwang" || coach.availability === "weekday-am") {
    return [{ id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" }];
  }
  if (coach.id === "coach-kang" || coach.availability === "weekday-pm") {
    return [{ id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" }];
  }
  if (coach.id === "coach-park" || coach.availability === "weekend") {
    return [{ id: `${coach.id}-weekend`, days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }];
  }
  return [{ id: `${coach.id || "coach"}-all`, days, start: "06:40", end: "22:00", label: "전체" }];
}

function normalizeMemberCoach(coach) {
  const normalized = { ...coach };
  normalized.id = normalized.id || memberCoachKey(normalized.name) || `coach-${normalized.name || Date.now()}`;
  normalized.name = normalized.name || "이름 없음";
  normalized.status = normalized.status || "active";
  normalized.workBlocks = Array.isArray(normalized.workBlocks) && normalized.workBlocks.length
    ? normalized.workBlocks
    : memberDefaultWorkBlocksForCoach(normalized);
  normalized.workBlocks = normalized.workBlocks
    .map((block, index) => ({
      id: block.id || `${normalized.id}-block-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : days,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "근무",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  if (!normalized.workBlocks.length) normalized.workBlocks = memberDefaultWorkBlocksForCoach(normalized);
  return normalized;
}

function adminCoachNameForLesson(lesson, snapshot) {
  const coach = (snapshot?.coaches || []).find((item) => item.id === lesson.coachId);
  return coach?.name || lesson.coach || "미지정 코치";
}

function memberCoachKey(name = "") {
  if (name.includes("노")) return "coach-no";
  if (name.includes("강")) return "coach-kang";
  if (name.includes("황")) return "coach-hwang";
  if (name.includes("박")) return "coach-park";
  return "";
}

function memberCoachOrder(id = "") {
  const order = ["coach-no", "coach-hwang", "coach-kang", "coach-park"];
  const index = order.indexOf(id);
  return index >= 0 ? index : order.length;
}

function memberCoachShortName(name = "") {
  return name.replace(" 코치", "").replace("코치", "").trim();
}

function memberAssignedCoachRoleIds() {
  return new Set(memberScheduleCoachTickets()
    .map((ticket) => String(ticket.coachRoleId || "").trim())
    .filter(Boolean));
}

function memberCoachMatchesAssignment(coach = {}) {
  const assignedRoleIds = memberAssignedCoachRoleIds();
  if (!assignedRoleIds.size && memberInitialCoachSelectionSource()) return true;
  return assignedRoleIds.has(String(coach.serverRoleId || coach.id || "").trim());
}

function memberInitialCoachSelectionSource() {
  return memberBookableRegularTickets()
    .concat(memberBookablePausedTickets())
    .find((lesson) => lesson.regularInitialBooking && !String(lesson.coachRoleId || "").trim()) || null;
}

function memberLessonCoach(lesson, policy) {
  const key = memberCoachKey(lesson.coach);
  const serverRoleId = lesson.coach_role_id || lesson.coachRoleId || "";
  return policy.coaches.find((coach) => String(coach.serverRoleId || "") === String(serverRoleId))
    || policy.coaches.find((coach) => coach.id === key)
    || policy.coaches.find((coach) => coach.name === lesson.coach)
    || normalizeMemberCoach({
      id: serverRoleId || key || lesson.coach,
      serverRoleId,
      roleId: serverRoleId,
      name: lesson.coach || "미지정 코치",
    });
}

function memberBreakRuleForSlot(policy, day, time) {
  const current = minutesFromTime(time);
  return (policy.breakRules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    return current >= minutesFromTime(rule.start) && current < minutesFromTime(rule.end);
  });
}

function memberBreakRuleOverlaps(policy, day, time, durationMinutes = 20) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (policy.breakRules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    const ruleStart = minutesFromTime(rule.start);
    const ruleEnd = minutesFromTime(rule.end);
    return start < ruleEnd && ruleStart < end;
  });
}

function isMemberCoachWorking(coach, day, time, durationMinutes = 10) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (coach.workBlocks || []).some((block) => {
    if (!block.days.includes(day)) return false;
    return start >= minutesFromTime(block.start) && end <= minutesFromTime(block.end);
  });
}

function memberCoachBookableTimes(coach, day, durationMinutes = 20) {
  const stepMinutes = memberBookingGridMinutes(durationMinutes);
  return [...new Set((coach.workBlocks || [])
    .filter((block) => block.days.includes(day))
    .flatMap((block) => makeMemberStartTimes(block.start, block.end, stepMinutes)))]
    .sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
}

function memberScheduleCoachNames(scheduleLessons = []) {
  const preferred = ["노 코치", "강 코치", "황 코치"];
  const fromLessons = scheduleLessons.map((lesson) => lesson.coach).filter(Boolean);
  return [...new Set([...preferred, ...fromLessons])];
}

function memberCoachColorClass(name = "") {
  if (name.includes("노")) return "coach-color-no";
  if (name.includes("강")) return "coach-color-kang";
  if (name.includes("황")) return "coach-color-hwang";
  if (name.includes("박")) return "coach-color-park";
  return "coach-color-default";
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function syncConfirmationsFromCoach() {
  const shared = loadSharedData();
  state.lessonLogs.forEach((log) => {
    const sharedLog = shared.lessonLogs.find((item) => item.id === log.id);
    if (!sharedLog) return;
    const wasConfirmed = log.status === "confirmed";
    log.status = sharedLog.status;
    log.coachComment = sharedLog.coachComment || log.coachComment || "";
    log.nextCurriculumId = sharedLog.nextCurriculumId || log.nextCurriculumId || log.curriculum?.id;
    log.curriculum = curriculumById(log.nextCurriculumId, log.curriculum);
    log.memberVisibleSummary = sharedLog.memberVisibleSummary || log.memberVisibleSummary || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    if (!wasConfirmed && log.status === "confirmed" && !log.ticketDeducted && state.remaining > 0) {
      state.remaining -= 1;
      log.ticketDeducted = true;
      state.ticketHistory.unshift({ text: `${lessonReviewTitle(log)} · 1회 차감`, tone: "done" });
      if (state.remaining === 2) {
        state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
      }
    }
  });
}

function syncPracticeFeedbackFromCoach() {
  const shared = loadSharedData();
  state.practiceLogs.forEach((log) => {
    const sharedRequest = shared.feedbackRequests.find((item) => item.id === log.id);
    if (!sharedRequest) return;
    log.feedbackStatus = sharedRequest.status;
    log.coachFeedback = sharedRequest.coachFeedback || log.coachFeedback || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
  });
}

function syncNtrpResultFromCoach() {
  const shared = loadSharedData();
  const request = shared.ntrpRequests.find((item) => isCurrentMemberName(item.member));
  if (!request) return;
  state.profile.ntrpCheckRequested = request.status !== "측정 완료";
  state.profile.selfNtrp = request.selfNtrp || state.profile.selfNtrp;
  state.profile.coachNtrp = request.coachNtrp || state.profile.coachNtrp || "측정 전";
  state.profile.ntrpSurvey = request.surveyAnswers || state.profile.ntrpSurvey || {};
}

function syncMakeupRequestsFromCoach() {
  const shared = loadSharedData();
  shared.makeupRequests.forEach((sharedRequest) => {
    const existing = state.makeupRequests.find((request) => request.id === sharedRequest.id);
    if (!existing) return;
    if (sharedRequest.status === "승인 완료") existing.status = "코치 승인 완료";
    else if (sharedRequest.status === "거절") existing.status = "코치 거절";
    else existing.status = sharedRequest.status || existing.status;
  });
}

function purchaseCoachOptions() {
  if (state.dataMode === "live") {
    const workspaceCoaches = memberScheduleV2WorkspaceCache?.workspace?.coaches;
    if (!Array.isArray(workspaceCoaches) || !workspaceCoaches.length) return [];
  }
  const policy = loadAdminSchedulePolicy();
  return (policy.coaches || [])
    .filter((coach) => ["active", "approved"].includes(String(coach.status || "active").toLowerCase()))
    .filter((coach) => String(coach.employmentStatus || coach.employment_status || "active").toLowerCase() === "active")
    .filter((coach) => !coach.archivedAt && !coach.archived_at && !coach.deletedAt && !coach.deleted_at)
    .sort((left, right) => memberScheduleLaneOrder(left) - memberScheduleLaneOrder(right));
}

function canUseCoachMode() {
  return state.member?.coachApproved === true && !isApprovalPending();
}

function shouldOpenCoachModeByDefault() {
  return canUseCoachMode() && !memberModeOverrideActive();
}
