// 홈 화면의 카드와 이용권 패널.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindHomeEvents() {
  $("#openChangeHistory")?.addEventListener("click", openChangeHistoryModal);
  $("#currentTicketPanel")?.addEventListener("click", (event) => {
    const membershipPurchaseButton = event.target.closest("[data-open-membership-products]");
    if (membershipPurchaseButton) {
      openMembershipDetails("membershipPurchaseDetails");
      return;
    }
    const membershipHistoryButton = event.target.closest("[data-open-membership-history]");
    if (membershipHistoryButton) {
      openMembershipDetails("membershipHistoryDetails");
      return;
    }
    const holdingButton = event.target.closest("[data-open-holding-request]");
    if (holdingButton) {
      openHoldingRequestModal(holdingButton.dataset.openHoldingRequest);
      return;
    }
    const resumeButton = event.target.closest("[data-resume-pending-ticket]");
    if (resumeButton) {
      resumePendingTicketPayment(resumeButton.dataset.resumePendingTicket);
      return;
    }
    const cancelButton = event.target.closest("[data-cancel-pending-ticket]");
    if (cancelButton) {
      cancelPendingTicketPayment(cancelButton.dataset.cancelPendingTicket);
      return;
    }
    const button = event.target.closest("[data-check-pending-ticket]");
    if (button) checkPendingTicketPayment(button.dataset.checkPendingTicket);
  });
  $("#todayActionCards")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-action]");
    if (button) handleHomeAction(button.dataset.homeAction);
  });
  $("#homeUpcomingLessons")?.addEventListener("click", (event) => {
    const scheduleButton = event.target.closest("[data-home-ticket-schedule]");
    if (scheduleButton) {
      state.selectedMemberScheduleTicketId = scheduleButton.dataset.homeTicketSchedule || "";
      state.memberScheduleMode = "mine";
      state.memberScheduleModeTouched = true;
      setView("scheduleView");
      renderSchedule();
      jumpToTop();
      saveSnapshot();
      return;
    }
    const availabilityButton = event.target.closest("[data-home-ticket-availability]");
    if (availabilityButton) {
      state.selectedMemberScheduleTicketId = availabilityButton.dataset.homeTicketAvailability || "";
      const source = currentScheduledLessonsForChange().find((lesson) => (
        memberLessonTicketId(lesson) === state.selectedMemberScheduleTicketId
      ));
      void openMemberChangeTimetable(source?.id || "");
      return;
    }
    const button = event.target.closest("[data-home-change-lesson]");
    if (!button) return;
    state.selectedMemberScheduleTicketId = button.dataset.homeTicketId || "";
    void openMemberChangeTimetable(button.dataset.homeChangeLesson || "");
  });
}
