// 로그인·프로필·공지·푸시 알림·동기화 재시도.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindAccountEvents() {
  $('#coachLogoutButton').addEventListener('click', logoutCoach);
  $$(".tab").forEach((button) => button.addEventListener("click", () => navigateCoachView(button.dataset.view)));
  $("#coachProfileButton")?.addEventListener("click", () => navigateCoachView("coachProfileView"));
  $("#coachSettlementSummaryButton")?.addEventListener("click", () => {
    openCoachSettlement();
    if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();
  });
  $("#refreshButton").addEventListener("click", renderAll);
  $("#userModeButton")?.addEventListener("click", openUserMode);
  $("#userModeLoginButton")?.addEventListener("click", openUserMode);
  $("#noticeClose")?.addEventListener("click", () => closeNotice(false));
  $("#noticeHideToday")?.addEventListener("click", () => closeNotice(true));
  $("#noticeAction")?.addEventListener("click", () => closeNotice(false));
  $("#saveCoachProfile")?.addEventListener("click", saveCoachProfile);
  $("#refreshCoachSettlement")?.addEventListener("click", () => void syncCoachSettlementFromServer());
  $("#coachPushNotificationButton")?.addEventListener("click", () => void toggleNativeCoachPush());
  $("#enableCoachPushFromPrimer")?.addEventListener("click", () => void enableNativeCoachPush());
  $("#coachPushPrimerModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-defer-coach-push-primer]")) deferNativeCoachPushPrimer();
  });
  $("#coachSyncRetryButton")?.addEventListener("click", () => {
    if (window.TennisNoteDataClient?.isOnline?.() === false) {
      renderCoachConnectivityStatus();
      return;
    }
    void flushCoachOfflineLessonDrafts();
  });
}
