// 코치의 근무·휴식·차단을 판정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function defaultCoachSchedulePolicy() {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  return {
    openStart: "06:40",
    openEnd: "22:00",
    allowCoachLockedTimeOverride: true,
    allowCoachHolidayOverride: false,
    breakRules: [{ id: "weekday-midday", days: weekdays, start: "13:00", end: "17:00", label: "수업 없음" }],
    lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
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

function defaultWorkBlocksForCoach(coach) {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
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
  return [{ id: `${coach.id || "coach"}-all`, days: scheduleDays, start: "06:40", end: "22:00", label: "전체" }];
}

function normalizeCoachPolicyItem(coach) {
  const normalized = { ...coach };
  normalized.id = normalized.id || coachKeyFromName(normalized.name) || `coach-${normalized.name || Date.now()}`;
  normalized.name = normalized.name || "이름 없음";
  normalized.status = normalized.status || "active";
  normalized.workBlocks = Array.isArray(normalized.workBlocks) && normalized.workBlocks.length
    ? normalized.workBlocks
    : defaultWorkBlocksForCoach(normalized);
  normalized.workBlocks = normalized.workBlocks
    .map((block, index) => ({
      id: block.id || `${normalized.id}-block-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "근무",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  if (!normalized.workBlocks.length) normalized.workBlocks = defaultWorkBlocksForCoach(normalized);
  normalized.blockedBlocks = (Array.isArray(normalized.blockedBlocks) ? normalized.blockedBlocks : [])
    .map((block, index) => ({
      id: block.id || `${normalized.id}-blocked-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "브레이크·상담",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  return normalized;
}

function scheduleRuleForSlot(rules, day, time, durationMinutes = scheduleBlockMinutes) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (rules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    return start < minutesFromTime(rule.end) && end > minutesFromTime(rule.start);
  });
}

function breakRuleForSlot(policy, day, time, durationMinutes = scheduleBlockMinutes) {
  return scheduleRuleForSlot(policy.breakRules, day, time, durationMinutes);
}

function coachBlockedRuleForSlot(coach, day, time, durationMinutes = scheduleBlockMinutes) {
  return scheduleRuleForSlot(coach.blockedBlocks, day, time, durationMinutes);
}

function coachClosureForSlot(day, time, durationMinutes = scheduleBlockMinutes) {
  const date = coachWeekDateForDay(day);
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (scheduleV2CoachWorkspace()?.closures || []).find((closure) => {
    if (String(closure.date || "") !== date) return false;
    if (closure.allDay) return true;
    return start < minutesFromTime(String(closure.endTime || "").slice(0, 5))
      && end > minutesFromTime(String(closure.startTime || "").slice(0, 5));
  });
}

function coachSlotAccess(coach, day, time, durationMinutes = scheduleBlockMinutes, policy = loadCoachSchedulePolicy()) {
  const currentRoleId = currentCoachRoleId();
  const laneRoleId = String(coach.roleId || coach.id || "");
  if (!currentRoleId || laneRoleId !== currentRoleId) return { allowed: false, reason: "other_coach" };
  const closure = coachClosureForSlot(day, time, durationMinutes);
  if (closure && policy.allowCoachHolidayOverride !== true) return { allowed: false, reason: "holiday_locked", closure };
  const breakRule = breakRuleForSlot(policy, day, time, durationMinutes);
  const blockedRule = coachBlockedRuleForSlot(coach, day, time, durationMinutes);
  const working = isPolicyCoachWorking(coach, day, time, durationMinutes);
  const lockedRule = blockedRule || breakRule;
  if (lockedRule && policy.allowCoachLockedTimeOverride !== false) {
    return { allowed: true, reason: "locked_time_override", lockedRule, closure, working };
  }
  if (!working || lockedRule) return { allowed: false, reason: working ? "blocked_time" : "outside_working_hours", lockedRule, closure, working };
  return { allowed: true, reason: closure ? "holiday_override" : "available", closure, working };
}

function isPolicyCoachWorking(coach, day, time, durationMinutes = scheduleBlockMinutes) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (coach.workBlocks || []).some((block) => {
    if (!block.days.includes(day)) return false;
    return start >= minutesFromTime(block.start) && end <= minutesFromTime(block.end);
  });
}
