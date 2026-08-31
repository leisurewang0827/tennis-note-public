// 시간표·예약 가능 시간·변경/홀딩/등록 모달·공지.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindScheduleEvents() {
  $("#makeupSlot").addEventListener("change", renderAvailableSlots);
  $("#absenceLesson").addEventListener("change", () => {
    state.regularInitialSelections = [];
    state.regularInitialOperationKey = "";
    state.memberLessonChangeOperationKey = "";
    state.memberLessonChangeOperationSignature = "";
    state.selectedMemberChangeSourceId = $("#absenceLesson")?.value || "";
    renderSelects();
    renderAvailableSlots();
    renderChangeModalSummary();
    const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value);
    void syncMemberChangeCandidates(source);
  });
  $("#confirmLatestLesson")?.addEventListener("click", confirmLatestLesson);
  $("#noticeClose").addEventListener("click", () => closeNotice(false));
  $("#noticeHideToday").addEventListener("click", () => closeNotice(true));
  $("#noticeAction")?.addEventListener("click", (event) => {
    const route = event.currentTarget?.dataset?.route || "";
    if (route === "schedule") {
      event.preventDefault();
      closeNotice(false);
      setView("scheduleView");
      jumpToTop();
      return;
    }
    closeNotice(false);
  });
  $("#scheduleGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lesson]");
    if (button) handleScheduleClick(button.dataset.lesson, String(button.dataset.lessonSegments || "").split(",").filter(Boolean));
  });
  $("#memberWeekSwitcher")?.addEventListener("click", (event) => {
    const quickButton = event.target.closest("[data-select-member-week]");
    if (quickButton) {
      selectMemberWeekOffset(Number(quickButton.dataset.selectMemberWeek));
      return;
    }
    const button = event.target.closest("[data-change-member-week]");
    if (button) changeMemberWeek(Number(button.dataset.changeMemberWeek));
  });
  $("#scheduleGrid")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-confirm-initial-schedule]")) {
      confirmRegularInitialSchedule();
      return;
    }
    const fullScheduleButton = event.target.closest("[data-toggle-full-member-schedule]");
    if (fullScheduleButton) {
      state.memberScheduleFullView = !state.memberScheduleFullView;
      renderSchedule();
      saveSnapshot();
      return;
    }
    const modeButton = event.target.closest("[data-member-schedule-mode]");
    if (modeButton) {
      changeMemberScheduleMode(modeButton.dataset.memberScheduleMode);
      return;
    }
    const ticketButton = event.target.closest("[data-member-ticket-filter]");
    if (ticketButton) {
      state.selectedMemberScheduleTicketId = ticketButton.dataset.memberTicketFilter || "";
      // A ticket can have more than one upcoming lesson. Choosing the ticket
      // narrows the list, but the member must still choose the exact source
      // lesson that will be changed.
      state.selectedMemberChangeSourceId = "";
      renderSelects();
      renderSchedule();
      saveSnapshot();
      return;
    }
    if (event.target.closest("[data-retry-member-change]")) {
      const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
      void syncMemberChangeCandidates(source);
      return;
    }
    const couponButton = event.target.closest("[data-start-coupon-ticket]");
    if (couponButton) {
      startCouponBooking(couponButton.dataset.startCouponTicket);
      return;
    }
    const couponProductsButton = event.target.closest("[data-flex-booking-products]");
    if (couponProductsButton) {
      state.membershipFilters.productKind = "coupon";
      navigateMemberView("shopView");
      return;
    }
    if (event.target.closest("[data-open-one-day-inquiry]")) {
      openKakaoInquiryModal("one-day");
      return;
    }
    const dayButton = event.target.closest("[data-member-schedule-day]");
    if (dayButton) {
      state.selectedScheduleDay = dayButton.dataset.memberScheduleDay;
      renderSchedule();
      saveSnapshot();
      return;
    }
    const button = event.target.closest("[data-member-schedule-time-range]");
    if (button) changeMemberScheduleTimeRange(button.dataset.memberScheduleTimeRange);
  });
  $("#scheduleGrid")?.addEventListener("change", (event) => {
    const ticketSelect = event.target.closest("#memberScheduleTicketSelect");
    if (ticketSelect) {
      state.selectedMemberScheduleTicketId = ticketSelect.value;
      const source = memberAllInlineChangeSources().find((lesson) => (
        memberLessonTicketId(lesson) === state.selectedMemberScheduleTicketId
      ));
      state.selectedMemberChangeSourceId = source?.id || "";
      renderSelects();
      renderSchedule();
      if (state.memberScheduleMode === "availability" && source) void syncMemberChangeCandidates(source);
      saveSnapshot();
      return;
    }
    const sourceSelect = event.target.closest("#memberInlineChangeSource");
    if (!sourceSelect) return;
    state.selectedMemberChangeSourceId = sourceSelect.value;
    const selectedSource = memberAllInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
    const selectedTicketId = memberLessonTicketId(selectedSource || {});
    if (selectedTicketId) state.selectedMemberScheduleTicketId = selectedTicketId;
    renderSelects();
    renderSchedule();
    void syncMemberChangeCandidates(selectedSource);
    saveSnapshot();
  });
  $$('[data-member-schedule-mode]').forEach((button) => {
    button.addEventListener("click", () => changeMemberScheduleMode(button.dataset.memberScheduleMode));
  });
  $("#scheduleGrid")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-open-member-change]")) return;
    openMemberChangeTimetable("");
  });
  $("#availableSlotList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-slot]");
    if (button) selectAvailableSlot(button.dataset.selectSlot);
  });
  $("#changeRequestModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-change-modal]")) closeChangeRequestModal();
  });
  $("#holdingRequestModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-holding-modal]")) closeHoldingRequestModal();
  });
  $("#holdingRequestType")?.addEventListener("change", updateHoldingEvidenceFields);
  $("#holdingRequestForm")?.addEventListener("submit", submitHoldingRequest);
  $("#memberEnrollmentForm")?.addEventListener("submit", submitMemberEnrollment);
  $("#memberEnrollmentModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-member-enrollment]")) closeMemberEnrollmentModal();
  });
  $("#changeHistoryModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-history-modal]")) closeChangeHistoryModal();
  });
  $("#journalDetailModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-journal-modal]")) closeJournalDetail();
  });
  $("#ntrpReferenceModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-ntrp-modal]")) closeNtrpReference();
  });
}
