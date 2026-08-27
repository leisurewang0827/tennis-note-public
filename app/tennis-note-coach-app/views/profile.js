// 코치 프로필과 알림 설정 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderCoachPushNotificationSettings() {
  const card = $(".coach-push-settings-card");
  const status = $("#coachPushNotificationStatus");
  const detail = $("#coachPushNotificationDetail");
  const button = $("#coachPushNotificationButton");
  if (!card || !status || !detail || !button) return;
  const permission = coachPushUiState.permission || "unknown";
  card.classList.toggle("is-enabled", permission === "granted");
  card.classList.toggle("is-denied", permission === "denied");
  status.textContent = coachPushUiState.status || "앱 알림 확인 중";
  detail.textContent = coachPushUiState.detail || "수업 일정과 처리할 기록을 알려드립니다.";
  button.textContent = permission === "granted"
    ? "알림 끄기"
    : permission === "denied"
      ? "설정 확인"
      : "알림 켜기";
}

function renderCoachProfile() {
  const name = currentCoachName();
  const profile = currentCoachProfile();
  const badge = $("#coachProfileBadge");
  const profilePerson = { name, profilePhotoUrl: state.coach?.profilePhotoUrl || profile.photo || "" };
  renderPersonAvatar(badge, profilePerson, "large", "coach-profile-badge");
  renderPersonAvatar($("#coachTopAvatar"), profilePerson, "small");
  if ($("#coachProfileName")) $("#coachProfileName").textContent = name;
  if ($("#coachProfileSummary")) $("#coachProfileSummary").textContent = profile.specialty;
  const form = $("#coachProfileFormCard");
  if (!form || form.hidden) {
    if ($("#coachIntro")) $("#coachIntro").value = profile.intro || "";
    if ($("#coachSpecialty")) $("#coachSpecialty").value = profile.specialty || "";
    if ($("#coachLessonStyle")) $("#coachLessonStyle").value = profile.lessonStyle || "";
    if ($("#coachAvailableMemo")) $("#coachAvailableMemo").value = profile.availableMemo || "";
    if ($("#coachMemberMessage")) $("#coachMemberMessage").value = profile.memberMessage || "";
  }
  const adminWebButton = $("#adminWebPortalButton");
  if (adminWebButton) adminWebButton.hidden = state.coach?.role !== "admin";
  renderCoachSettlement();
}
