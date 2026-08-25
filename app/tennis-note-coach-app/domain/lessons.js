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

function requestCoachRoleId(request = {}) {
  return String(
    request.coachRoleId
    || request.coach_role_id
    || request.targetCoachRoleId
    || request.target_coach_role_id
    || "",
  ).trim();
}

function makeupRequestBelongsToCurrentCoach(request = {}) {
  const roleId = currentCoachRoleId();
  const targetRoleId = requestCoachRoleId(request);
  if (roleId && targetRoleId) return roleId === targetRoleId;
  if (state.dataMode === "live" || state.liveProfileId) return false;
  return canonicalCoachName(requestCoach(request)) === currentCoachName();
}

function lessonGroupDeductionSummary(lesson = {}, participants = []) {
  if (participants.length < 2 || !lessonChartFinalized(lesson)) return "";
  const deducted = participants.reduce((total, participant) => (
    total + (Number(participant.deductedSessions ?? participant.deducted_sessions) || 0)
  ), 0);
  return deducted === 1
    ? `${participants.length}명 완료 · 공유 회원권 1회 차감`
    : `${participants.length}명 완료 · 회원권 ${deducted}회 차감`;
}

function normalizedLessonCompletionErrorCode(error) {
  let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
  if (typeof code === "string" && code.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(code);
      code = parsed.message || parsed.code || code;
    } catch {
      // Keep the provider message when it is not JSON.
    }
  }
  return String(code || "server_error").trim().slice(0, 120);
}

function lessonCompletionErrorMessage(code, { fromOfflineQueue = false } = {}) {
  const normalized = String(code || "server_error").toLowerCase();
  const mappings = [
    [["lesson_not_ended"], lessonOutcomeGuardMessage()],
    [["already_processed", "existing_final", "status_invalid", "concurrent_update"], "다른 화면에서 이미 처리됐습니다. 최신 상태를 다시 확인해 주세요."],
    [["ticket_units_unavailable", "ticket_unavailable", "remaining_sessions"], "차감 가능한 회원권 횟수가 없습니다. 회원권 잔여 횟수를 확인해 주세요."],
    [["ticket_expired", "ticket_paused", "ticket_inactive"], "만료·중지된 회원권입니다. 사용할 회원권을 먼저 확인해 주세요."],
    [["participant_ticket_mismatch", "participant_input_missing", "participant_reference_invalid"], "수업 회원과 회원권 연결이 맞지 않습니다. 최신 상태를 확인해 주세요."],
    [["group", "participant_missing"], "그룹수업 참가자 또는 회원권 연결이 일부 누락됐습니다. 전체 연결을 확인해 주세요."],
    [["next_curriculum", "curriculum_ref"], "다음 커리큘럼 서버 연결을 확인한 뒤 다시 시도해 주세요."],
    [["comment_too_short"], "코치 코멘트는 직접 5자 이상 작성해야 합니다."],
    [["comment_too_generic"], "짧은 칭찬이나 확인 문구만으로는 횟수 차감이 불가합니다."],
    [["comment_recent_duplicate", "comment_member_duplicate_limit"], "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다."],
    [["forbidden", "coach_required", "assigned_coach"], "담당 코치 또는 지정된 대타 코치만 처리할 수 있습니다."],
    [["login_required", "jwt", "session"], "로그인이 만료됐습니다. 다시 로그인한 뒤 작성 내용을 확인해 주세요."],
  ];
  const matched = mappings.find(([needles]) => needles.some((needle) => normalized.includes(needle)));
  if (matched) return matched[1];
  if (fromOfflineQueue) return "자동 동기화에 실패했습니다. 연결 상태를 확인한 뒤 최신 상태를 다시 확인해 주세요.";
  return `수업 완료 처리에 실패했습니다. 최신 상태를 다시 확인해 주세요. (오류 ${normalized.replace(/[^a-z0-9_:-]/g, "_").slice(0, 40) || "server_error"})`;
}

function coachCompletionPreflightMessage(status = "") {
  return ({
    superseded: "시간이 변경되어 종료된 이전 수업입니다. 최신 시간표를 다시 불러왔습니다.",
    prior_ticket: "이전 회원권에 연결된 수업입니다. 현재 회원권 일정에서 처리해 주세요.",
    session_limit: "회원권 횟수 종료로 닫힌 수업입니다. 현재 회원권을 확인해 주세요.",
    date_range: "회원권 기간 종료로 닫힌 수업입니다. 현재 회원권을 확인해 주세요.",
    ticket_status: "사용이 종료된 회원권의 수업입니다. 현재 회원권을 확인해 주세요.",
    member_absence: "회원 불참으로 종료된 수업입니다. 차감·피드백 처리 대상이 아닙니다.",
    admin_cancelled: "관리자가 취소한 수업입니다. 관리자 시간표에서 복구한 뒤 처리해 주세요.",
    cancelled: "취소 또는 변경된 수업입니다. 최신 시간표를 다시 불러왔습니다.",
    status_invalid: "현재 상태에서는 처리할 수 없는 수업입니다. 최신 시간표를 확인해 주세요.",
    lesson_not_found: "삭제되거나 교체된 수업입니다. 최신 시간표를 다시 불러왔습니다.",
    participants_missing: "수업 참가자 연결이 비어 있습니다. 관리자에게 연결 확인을 요청해 주세요.",
    participant_ticket_mismatch: "회원과 회원권 연결이 일치하지 않습니다. 관리자에게 연결 확인을 요청해 주세요.",
    ticket_unavailable: "회원권이 만료·중지·소진되어 처리할 수 없습니다.",
  })[String(status || "").toLowerCase()] || "최신 수업·회원권 상태를 확인하지 못했습니다. 다시 시도해 주세요.";
}
