// 수업 하나를 어떻게 다루고 보여줄지 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function adminTicketForMember(memberName, snapshot) {
  const ticket = (snapshot?.tickets || []).find((item) => item.member === memberName || `${item.member || ""}`.includes(memberName));
  return ticket || {};
}

function normalizeAdminLessonForCoachApp(lesson, snapshot) {
  const coach = adminCoachNameForCoachApp(lesson, snapshot);
  const rawText = `${lesson.type || ""} ${lesson.status || ""} ${coach}`;
  if (/무인|볼머신/.test(rawText)) return null;
  const member = lesson.member === "빈자리" || lesson.member === "보강대기" ? "" : lesson.member || "";
  if (!member && lesson.status === "available") return null;
  const duration = Number(lesson.durationMinutes) || 20;
  const ticket = adminTicketForMember(member, snapshot);
  const pending = lesson.status === "pending" || /요청|접수/.test(rawText);
  const ticketLabel = coach.includes("박창준") && member === "박민재"
    ? "박창준 코치 주 1회 개인 30분"
    : ticket.product || ticket.lessonKind || "회원권 연결";
  return {
    id: `admin-${lesson.id}`,
    day: lesson.day,
    time: lesson.time,
    coach,
    member: member || "변경요청",
    type: pending ? "변경요청" : `${lesson.makeup ? "보강" : "정규"} ${duration}분`,
    ticket: ticketLabel,
    status: pending ? "승인 대기" : lesson.status === "confirmed" ? "확인됨" : "예정",
    lessonSource: lesson.lessonSource || (lesson.makeup ? "makeup" : "regular"),
    remaining: Number(ticket.remaining ?? ticket.total ?? 8),
    task: pending ? "보강/변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
    changeNote: pending ? "승인 필요" : "",
  };
}

function adminLessonsForCoachApp() {
  const snapshot = readAdminSnapshot();
  if (!snapshot || !Array.isArray(snapshot.lessons)) return [];
  return snapshot.lessons
    .map((lesson) => normalizeAdminLessonForCoachApp(lesson, snapshot))
    .filter(Boolean);
}

function ensureCoachLessonRecord(id) {
  let lesson = state.todayLessons.find((item) => item.id === id);
  if (lesson) return lesson;
  const source = weekLessons().find((item) => item.id === id);
  if (!source) return null;
  lesson = { ...source };
  state.todayLessons.push(lesson);
  return lesson;
}

function lessonBelongsToCurrentCoach(lesson = {}) {
  const roleId = currentCoachRoleId();
  const lessonRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
  if (roleId && lessonRoleId) return roleId === lessonRoleId;
  if (roleId && (state.dataMode === "live" || state.liveProfileId)) return false;
  return canonicalCoachName(lesson.coach) === currentCoachName();
}

function lessonAssignedToCurrentCoachForTasks(lesson = {}) {
  const roleId = currentCoachRoleId();
  const lessonRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
  const substituteRoleId = String(lesson.substituteCoachRoleId || lesson.substitute_coach_role_id || "").trim();
  if (lesson.isSubstitute || substituteRoleId) {
    if (roleId && substituteRoleId) return roleId === substituteRoleId;
    if (roleId && lessonRoleId) return roleId === lessonRoleId;
    if (roleId && (state.dataMode === "live" || state.liveProfileId)) return false;
    return canonicalCoachName(lesson.coach) === currentCoachName();
  }
  if (roleId && lessonRoleId) return roleId === lessonRoleId;
  return lessonBelongsToCurrentCoach(lesson);
}

function ownTodayLessons() {
  const currentLessons = state.liveLessonsLoaded || state.dataMode === "live"
    ? weekLessons().filter((lesson) => lesson.lessonDate === localDateKey())
    : weekLessons();
  return currentLessons.filter((lesson) => (
    lessonAssignedToCurrentCoachForTasks(lesson)
    && !lesson.releasedMakeupSlot
    && lesson.status !== "available"
  ));
}

function isMakeupLesson(lesson) {
  return `${lesson.type || ""} ${lesson.status || ""}`.includes("보강");
}

function memberForLesson(lesson) {
  const names = String(lesson?.member || "")
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
  return (
    state.members.find((member) => member.name === lesson?.member) ||
    state.members.find((member) => names.includes(member.name)) ||
    state.members.find((member) => names.some((name) => member.name.includes(name))) ||
    null
  );
}

function canProcessLesson(lesson) {
  if (!lesson) return false;
  if (!lessonAssignedToCurrentCoachForTasks(lesson)) return false;
  if (lesson.v2Permissions) return lesson.v2Permissions.canProcess === true;
  return true;
}

function lessonOutcomeWindowOpen(lesson, now = new Date()) {
  if (!lesson) return false;
  const lessonDate = String(lesson.lessonDate || lesson.lesson_date || "").trim();
  const lessonTime = String(lesson.time || lesson.startTime || lesson.start_time || "").slice(0, 5);
  const strictLiveLesson = Boolean(state.dataMode === "live" || state.liveProfileId || lesson.serverLessonId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate) || !/^\d{2}:\d{2}$/.test(lessonTime)) {
    return !strictLiveLesson;
  }
  const today = localDateKey(now);
  if (lessonDate < today) return true;
  if (lessonDate > today) return false;
  const startMinutes = minutesFromTime(lessonTime);
  if (!Number.isFinite(startMinutes)) return !strictLiveLesson;
  const durationMinutes = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= startMinutes + durationMinutes;
}

function lessonOutcomeGuardMessage() {
  return "수업 종료 후 피드백 완료와 회원권 횟수 차감을 처리할 수 있습니다.";
}

function transferredTodayLessons() {
  const currentLessons = state.liveLessonsLoaded || state.dataMode === "live"
    ? weekLessons().filter((lesson) => lesson.lessonDate === localDateKey())
    : weekLessons();
  return currentLessons.filter((lesson) => (
    lesson.isSubstitute
    && canonicalCoachName(lesson.originalCoach) === currentCoachName()
    && canonicalCoachName(lesson.coach) !== currentCoachName()
    && !lesson.releasedMakeupSlot
  ));
}

function canRescheduleLesson(lesson) {
  if (!lesson) return false;
  if (!lessonAssignedToCurrentCoachForTasks(lesson)) return false;
  if (lesson.v2Permissions && lesson.v2Permissions.canEdit !== true) return false;
  if (lesson.serverStatus) return lesson.serverStatus === "scheduled";
  return !["완료", "취소", "노쇼", "변경 요청"].includes(lesson.status);
}

function canMarkRegularLessonAbsent(lesson) {
  return canRescheduleLesson(lesson) && String(lesson.lessonSource || lesson.lesson_source || "regular") === "regular";
}

function todayLessonPriority(lesson = {}, now = new Date()) {
  const start = minutesFromTime(String(lesson.time || ""));
  const current = now.getHours() * 60 + now.getMinutes();
  if (!Number.isFinite(start)) return { group: 3, distance: Number.MAX_SAFE_INTEGER, start: Number.MAX_SAFE_INTEGER };
  const end = start + Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  if (start <= current && current < end) return { group: 0, distance: 0, start };
  if (start > current) return { group: 1, distance: start - current, start };
  return { group: 2, distance: current - end, start: -start };
}

function compareTodayLessonsByNearest(left, right, now = new Date()) {
  const leftPriority = todayLessonPriority(left, now);
  const rightPriority = todayLessonPriority(right, now);
  return leftPriority.group - rightPriority.group
    || leftPriority.distance - rightPriority.distance
    || leftPriority.start - rightPriority.start;
}

function lessonCreditUnits(lesson = {}) {
  const duration = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const ticketUnit = Math.max(1, Number(lesson.ticketLessonMinutes) || duration);
  return Math.max(1, Math.ceil(duration / ticketUnit));
}

function lessonDurationUsageLabel(lesson = {}) {
  const duration = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const units = lessonCreditUnits(lesson);
  return `${duration}분${units > 1 ? ` · ${units}회 사용` : ""}`;
}

function coachLessonStateClass(lesson = {}) {
  return coachLessonCardState(lesson).className;
}

function coachLessonVisualKind(lesson = {}) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  if (lesson.releasedMakeupSlot || lesson.status === "available") return "released";
  if (["no_show", "cancelled_late"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase())) return "noShow";
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup";
  if (source === "one_day") return "coupon";
  if (source === "coupon" || String(lesson.type || "").includes("쿠폰")) return "coupon";
  if (lessonDuration(lesson) === 30) return "regular30";
  return "regular";
}

function coachScheduleLessonActionAttrs(lesson = {}) {
  if (lesson.oneDayBooking) {
    return `disabled aria-label="${lesson.member || "원데이"} 원데이 예약"`;
  }
  if (!canProcessLesson(lesson) && !canRescheduleLesson(lesson)) {
    return `disabled aria-label="${lesson.member || "회원"} 다른 코치 수업 읽기 전용"`;
  }
  if (lesson.releasedMakeupSlot) {
    if (lesson.historicalReleasedSlot) {
      return `disabled aria-label="${lesson.member || "회원"} 과거 정규 불참 기록"`;
    }
    return `data-restore-absence-id="${lesson.entitlementId || ""}" aria-label="${lesson.member || "회원"} 정규수업 복원"`;
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function coachLessonColorStyle(lesson, policy) {
  const kind = coachLessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const changed = ["makeup", "coupon"].includes(kind);
  const fallback = { regular: "#2f6fc4", regular30: "#2f6fc4", makeup: "#7357ad", coupon: "#7357ad", noShow: "#7357ad" };
  const custom = (policy?.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  const saved = changed
    ? policy?.lessonColors?.changed || ""
    : custom?.color || policy?.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function recordableCoachLessons() {
  const lessons = ownTodayLessons();
  if (lessons.length || state.dataMode === "live") return lessons;
  return state.todayLessons;
}

function lessonRecordOptions(selectedId) {
  const lessons = recordableCoachLessons();
  return lessons
    .map((lesson) => `<option value="${lesson.id}" ${lesson.id === selectedId ? "selected" : ""}>${lesson.day} ${lesson.time} · ${lesson.member} · ${lesson.type}</option>`)
    .join("");
}
