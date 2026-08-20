// 로그인·로그아웃·도움말·문의.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindAccountEvents() {
  $$("[data-login-provider]").forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.loginProvider));
  });
  $("#memberEmailLoginForm")?.addEventListener("submit", loginWithEmail);
  $$("[data-install-pwa]").forEach((button) => {
    button.addEventListener("click", promptPwaInstall);
  });
  $("#logoutButton")?.addEventListener("click", logout);
  $("#profileLogoutButton")?.addEventListener("click", logout);
  $("#pendingLogoutButton")?.addEventListener("click", logout);
  $("#coachModeButton")?.addEventListener("click", openCoachMode);
  $("#openMemberHelpButton")?.addEventListener("click", openMemberHelpModal);
  $("#memberHelpSearch")?.addEventListener("input", (event) => {
    memberHelpQuery = event.target.value;
    renderMemberHelp();
  });
  $("#memberHelpModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-member-help]")) {
      closeMemberHelpModal();
      return;
    }
    const categoryButton = event.target.closest("[data-member-help-category]");
    if (categoryButton) {
      memberHelpCategory = categoryButton.dataset.memberHelpCategory || "all";
      renderMemberHelp();
      return;
    }
    const actionButton = event.target.closest("[data-member-help-action]");
    if (actionButton) runMemberHelpAction(actionButton.dataset.memberHelpAction);
  });
  $("#openKakaoInquiryButton")?.addEventListener("click", openKakaoInquiryModal);
  $("#kakaoInquiryModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-kakao-inquiry-modal]")) closeKakaoInquiryModal();
  });
  $("#homeAccountSummary")?.addEventListener("click", () => navigateMemberView("profileView"));
  $("#memberRefreshButton")?.addEventListener("click", () => window.location.reload());
  $$("[data-summary-action]").forEach((button) => {
    button.addEventListener("click", () => handleSummaryAction(button.dataset.summaryAction));
  });
}
