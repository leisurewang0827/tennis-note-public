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
  const params = new URLSearchParams({ v: "1.0.373" });
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
