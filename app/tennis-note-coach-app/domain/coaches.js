// 코치 자신과 다른 코치를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function approvedCoachesFromAdmin() {
  try {
    const snapshot = readAdminSnapshot();
    const adminCoaches = Array.isArray(snapshot?.coaches) ? snapshot.coaches : [];
    const approved = adminCoaches
      .filter((coach) => (
        coach.status === "active"
        && coach.coachMode === "approved"
        && (coach.employmentStatus || "active") === "active"
        && !coach.archivedAt
        && !coach.deletedAt
        && coach.name !== "무인"
      ))
      .map((coach) => ({ id: coach.id, name: coach.name, role: coach.role || "레슨" }));
    if (approved.length) return approved;
  } catch {
    return [];
  }
  return [
    { id: "coach-no", name: "노 코치", role: "레슨" },
    { id: "coach-kang", name: "강 코치", role: "레슨" },
    { id: "coach-hwang", name: "황 코치", role: "레슨/보강" },
  ];
}

function adminCoachNameForCoachApp(lesson, snapshot) {
  const coach = (snapshot?.coaches || []).find((item) => item.id === lesson.coachId);
  return coach?.name || lesson.coach || "미지정 코치";
}

function coachOrder(id = "") {
  const order = ["coach-no", "coach-hwang", "coach-kang", "coach-park"];
  const index = order.indexOf(id);
  return index >= 0 ? index : order.length;
}

function coachFromLesson(lesson, policy) {
  const scheduleCoachName = lesson.isSubstitute && lesson.originalCoach
    ? lesson.originalCoach
    : lesson.coach;
  const roleId = String(lesson.originalCoachRoleId || lesson.coachRoleId || "");
  const key = coachKeyFromName(scheduleCoachName);
  return policy.coaches.find((coach) => String(coach.roleId || coach.id) === roleId)
    || policy.coaches.find((coach) => coach.id === key)
    || policy.coaches.find((coach) => coach.name === scheduleCoachName)
    || normalizeCoachPolicyItem({ id: key || scheduleCoachName, name: scheduleCoachName || "미지정 코치" });
}

function coachColorClass(name) {
  if (name.includes("노")) return "coach-color-no";
  if (name.includes("강")) return "coach-color-kang";
  if (name.includes("황")) return "coach-color-hwang";
  if (name.includes("박")) return "coach-color-park";
  return "coach-color-default";
}

function canUseCoachAppProfile(profile, coachRole) {
  return Boolean(profile?.id && coachRole?.status === "approved");
}

function memberModeUrl(openProfile = false, memberMode = true) {
  const params = new URLSearchParams({ v: "1.0.453" });
  if (memberMode) params.set("mode", "member");
  if (openProfile) params.set("view", "profileView");
  return `../tennis-note-member-app/index.html?${params.toString()}`;
}

function requestCoach(request) {
  if (request.coach) return request.coach;
  const exactMember = state.members.find((member) => member.name === request.member);
  if (exactMember?.coach) return exactMember.coach;
  const groupedMember = state.members.find((member) => member.name.includes(request.member));
  if (groupedMember?.coach) return groupedMember.coach;
  const requested = String(request.requested || "");
  return requested.includes("강") ? "강 코치" : requested.includes("황") ? "황 코치" : "노 코치";
}

function currentCoachProfile() {
  ensureMemberLists();
  const name = currentCoachName();
  return state.coachProfiles[name] || state.coachProfiles["노 코치"] || {};
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function scheduleV2CoachWorkspace() {
  return coachScheduleV2WorkspaceCache?.workspace || null;
}

async function syncCoachSchedulePreview() {
  if (await syncCoachScheduleV2()) {
    state.scheduleV2SyncError = "";
    return true;
  }
  return false;
}

function resetCoachScheduleLaunchView() {
  if (coachSchedulePreferenceTouched) return;
  state.scheduleFilter = "mine";
  state.selectedFullScheduleDay = currentCoachScheduleDay();
}

function setCoachPushNotificationState(permission, status, detail) {
  coachPushUiState = { permission, status, detail };
  renderCoachPushNotificationSettings();
}

function navigateCoachView(viewId) {
  setView(viewId, { pushHistory: true });
}

async function markCoachLessonAbsent(id) {
  return processCoachAttendance(id, "absence", false);
}

async function processCoachNoShow(lessonId, deduct) {
  return processCoachAttendance(lessonId, "no_show", deduct);
}

function refreshSelectedCoachScheduleWeek() {
  if (state.dataMode !== "live" || !state.coach?.branchId) return;
  coachScheduleV2WorkspaceCache = null;
  void syncCoachScheduleV2({ force: true }).then((synced) => {
    if (!synced) return refreshCoachLiveSchedule({ force: true });
    renderAll();
    saveSnapshot();
    return true;
  }).catch(() => false);
}

function changeCoachMonth(delta) {
  const currentStart = new Date(`${activeScheduleWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(coachWeekOffsetForDate(target), coachScheduleMaxWeekOffset),
  );
  renderAll();
  saveSnapshot();
  refreshSelectedCoachScheduleWeek();
}

function selectCoachMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeScheduleWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(coachWeekOffsetForDate(target), coachScheduleMaxWeekOffset),
  );
  renderAll();
  saveSnapshot();
  refreshSelectedCoachScheduleWeek();
}
