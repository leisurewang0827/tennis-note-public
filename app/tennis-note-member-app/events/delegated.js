// document·window 에 거는 리스너. 서로 순서가 얽히므로 한곳에 원래 순서대로 모은다.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindDelegatedEvents() {
  window.addEventListener("tennisnote:oauth-result", handleOAuthResult);
  $("#publicProductPreviewList")?.addEventListener("click", (event) => {
    void handlePublicOnboardingAction(event.target);
  });
  $("#publicOnboardingExistingLogin")?.addEventListener("click", openExistingMemberLoginFromOnboarding);
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#scheduleGrid [data-lesson]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      handleScheduleClick(button.dataset.lesson, String(button.dataset.lessonSegments || "").split(",").filter(Boolean));
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (activeAppSheetId && window.TennisNoteBottomSheet?.trapFocus?.(event)) return;
    if (activeAppModalId && event.key === "Tab") {
      const modal = $(`#${activeAppModalId}`);
      const focusable = focusableElements(modal);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "Escape" && activeAppModalId) {
      event.preventDefault();
      closeVisibleAppModal();
      return;
    }
    if (event.key === "Escape" && !$("#noticeDialog")?.hidden) {
      event.preventDefault();
      closeNotice(false);
      return;
    }
    if (event.key === "Escape" && activeAppSheetId) {
      event.preventDefault();
      closeVisibleAppSheet();
      return;
    }
    if (event.key === "Escape" && purchaseFlowState().open) {
      event.preventDefault();
      closeMembershipPurchaseFlow();
      return;
    }
    if (event.key === "Escape" && !$("#kakaoInquiryModal")?.hidden) closeKakaoInquiryModal();
    if (event.key === "Escape" && !$("#memberEnrollmentModal")?.hidden) closeMemberEnrollmentModal();
  });
  window.addEventListener("popstate", (event) => {
    if (activeAppModalId) {
      closeVisibleAppModal(true);
      return;
    }
    if (activeAppSheetId) {
      closeVisibleAppSheet(true);
      return;
    }
    if (purchaseFlowState().open) {
      // A nested modal/sheet returns to the purchase history entry first.
      // Only a back action leaving that entry should close the purchase flow.
      if (event.state?.tennisNotePurchase === true) return;
      closeMembershipPurchaseFlow({ fromHistory: true });
      return;
    }
    const targetView = event.state?.tennisNoteView;
    if (targetView && $(`#${targetView}`)) setView(targetView, { replaceHistory: false });
  });
  document.addEventListener("change", (event) => {
    const discountCouponSelect = event.target.closest("[data-select-discount-coupon]");
    if (discountCouponSelect) {
      const flow = purchaseFlowState();
      flow.discountIssueId = discountCouponSelect.value || "";
      flow.discountSelectionMode = "manual";
      saveSnapshot();
      renderMembershipPurchaseFlow();
      return;
    }
    const renewalTicketSelect = event.target.closest("#purchaseRenewalTicket");
    if (renewalTicketSelect) {
      selectPurchaseRenewalTicket(renewalTicketSelect.value);
      return;
    }
    const purchaseTimeSelect = event.target.closest("[data-purchase-time-select]");
    if (!purchaseTimeSelect?.value) return;
    const selectedOption = purchaseTimeSelect.selectedOptions?.[0];
    if (!selectedOption) return;
    applyPurchaseScheduleSlot({
      lessonDate: selectedOption.dataset.purchaseSlotDate || "",
      day: selectedOption.dataset.purchaseSlotDay || "",
      time: selectedOption.dataset.purchaseSlotTime || "",
      coachRoleId: selectedOption.dataset.purchaseSlotCoach || "",
      coachName: selectedOption.dataset.purchaseSlotCoachName || "",
    });
  });
  document.addEventListener("click", (event) => {
    const oneDayPurchaseButton = event.target.closest("[data-start-one-day-purchase]");
    if (oneDayPurchaseButton) {
      event.preventDefault();
      void openOneDayPurchaseFlow(oneDayPurchaseButton);
      return;
    }
    const pendingPurchaseCancelButton = event.target.closest("[data-cancel-pending-purchase]");
    if (pendingPurchaseCancelButton) {
      void cancelPendingPurchasePayment(
        pendingPurchaseCancelButton.dataset.cancelPendingPurchase,
        pendingPurchaseCancelButton.dataset.pendingPurchaseTitle || "회원권",
      );
      return;
    }
    const curriculumVideoButton = event.target.closest("[data-play-curriculum-video]");
    if (curriculumVideoButton) {
      playCurriculumVideo(curriculumVideoButton);
      return;
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      navigateMemberView(viewButton.dataset.view);
      return;
    }
    const groupModeButton = event.target.closest("[data-member-group-mode]");
    if (groupModeButton) {
      setMemberGroupPaymentMode(groupModeButton.dataset.memberGroupMode);
      return;
    }
    const groupLinkButton = event.target.closest("[data-member-group-link]");
    if (groupLinkButton) {
      linkMemberGroupPartner();
      return;
    }
    const renewalButton = event.target.closest("[data-renew-ticket]");
    if (renewalButton) {
      openMembershipPurchaseFlow(renewalButton.dataset.renewTicket, "", "renew_same");
      return;
    }
    const reregisterButton = event.target.closest("[data-reregister-ticket]");
    if (reregisterButton) {
      openMembershipPurchaseFlow(reregisterButton.dataset.reregisterTicket, "", "new_purchase");
      return;
    }
    const openPurchaseFlowButton = event.target.closest("[data-open-purchase-flow]");
    if (openPurchaseFlowButton) {
      event.preventDefault();
      void openMembershipPurchaseEntry({
        purpose: openPurchaseFlowButton.dataset.openPurchaseFlow || "new_purchase",
        trigger: openPurchaseFlowButton,
      });
      return;
    }
    if (event.target.closest("[data-open-current-membership]")) {
      closeMembershipPurchaseFlow({ showCurrentMembership: true });
      return;
    }
    if (event.target.closest("[data-close-purchase-flow]")) {
      closeMembershipPurchaseFlow();
      return;
    }
    const purchasePurposeButton = event.target.closest("[data-purchase-purpose]");
    if (purchasePurposeButton) {
      selectPurchasePurpose(purchasePurposeButton.dataset.purchasePurpose || "");
      return;
    }
    const purchaseFamilyButton = event.target.closest("[data-purchase-family]");
    if (purchaseFamilyButton) {
      selectPurchaseFamily(purchaseFamilyButton.dataset.purchaseFamily);
      return;
    }
    if (event.target.closest("[data-open-purchase-product]")) {
      openPurchaseProductSheet();
      return;
    }
    if (event.target.closest("[data-close-purchase-product]")) {
      closeAppSheet("purchaseProductSheet");
      return;
    }
    const purchaseFrequencyButton = event.target.closest("[data-purchase-frequency]");
    if (purchaseFrequencyButton) {
      const flow = purchaseFlowState();
      flow.productFrequency = Math.max(1, Math.min(3, Number(purchaseFrequencyButton.dataset.purchaseFrequency) || 1));
      flow.productId = "";
      flow.showAllProducts = false;
      flow.coachRoleId = "";
      flow.coachName = "";
      clearPurchaseSchedules();
      saveSnapshot();
      renderMembershipPurchaseFlow();
      return;
    }
    const purchaseScopeButton = event.target.closest("[data-purchase-scope]");
    if (purchaseScopeButton) {
      const flow = purchaseFlowState();
      flow.productScheduleScope = purchaseScopeButton.dataset.purchaseScope === "weekend" ? "weekend" : "weekday";
      flow.productId = "";
      flow.showAllProducts = false;
      flow.coachRoleId = "";
      flow.coachName = "";
      clearPurchaseSchedules();
      saveSnapshot();
      renderMembershipPurchaseFlow();
      return;
    }
    const purchaseProductButton = event.target.closest("[data-purchase-product]");
    if (purchaseProductButton) {
      selectPurchaseProduct(purchaseProductButton.dataset.purchaseProduct);
      closeAppSheet("purchaseProductSheet", false, { restoreFocus: true });
      return;
    }
    if (event.target.closest("[data-edit-purchase-renewal-schedule]")) {
      const flow = purchaseFlowState();
      flow.scheduleMode = "change";
      clearPurchaseSchedules();
      saveSnapshot();
      renderMembershipPurchaseFlow();
      openPurchaseScheduleSheet();
      return;
    }
    const purchaseScheduleModeButton = event.target.closest("[data-purchase-schedule-mode]");
    if (purchaseScheduleModeButton) {
      const flow = purchaseFlowState();
      flow.scheduleMode = purchaseScheduleModeButton.dataset.purchaseScheduleMode;
      if (flow.scheduleMode === "change") {
        flow.showMoreSlots = false;
        clearPurchaseSchedules();
      } else {
        const sourceTicket = purchaseFlowSourceTicket();
        const lesson = purchaseTicketLesson(sourceTicket || {});
        flow.coachRoleId = sourceTicket?.coachRoleId || flow.coachRoleId || "";
        flow.coachName = sourceTicket?.coach || flow.coachName || "";
        flow.preferredDate = lesson?.lessonDate || "";
        flow.preferredDay = lesson?.day || "";
        flow.preferredTime = lesson?.time || "";
        flow.preferredSchedules = [];
      }
      saveSnapshot();
      renderMembershipPurchaseFlow();
      if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
      return;
    }
    const purchaseCoachFilterButton = event.target.closest("[data-purchase-coach-filter]");
    if (purchaseCoachFilterButton) {
      const flow = purchaseFlowState();
      const nextCoachRoleId = purchaseCoachFilterButton.dataset.purchaseCoachFilter || "";
      if (String(flow.coachRoleId || "") !== String(nextCoachRoleId)) clearPurchaseSchedules();
      flow.coachRoleId = nextCoachRoleId;
      flow.coachName = purchaseCoachFilterButton.dataset.purchaseCoachFilterName || "";
      flow.showMoreSlots = false;
      flow.scheduleWeekStart = purchaseEarliestScheduleWeekStart(nextCoachRoleId, purchaseFlowProduct());
      saveSnapshot();
      renderMembershipPurchaseFlow();
      if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
      return;
    }
    if (event.target.closest("[data-clear-purchase-coach]")) {
      const flow = purchaseFlowState();
      flow.coachRoleId = "";
      flow.coachName = "";
      clearPurchaseSchedules();
      flow.showMoreSlots = false;
      flow.scheduleWeekStart = purchaseWeekStartDate(purchaseAvailabilityRange().start);
      saveSnapshot();
      renderMembershipPurchaseFlow();
      if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
      return;
    }
    if (event.target.closest("[data-clear-purchase-schedules]")) {
      clearPurchaseSchedules();
      saveSnapshot();
      renderMembershipPurchaseFlow();
      if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
      return;
    }
    if (event.target.closest("[data-purchase-show-more-slots]")) {
      const flow = purchaseFlowState();
      flow.showMoreSlots = true;
      saveSnapshot();
      renderMembershipPurchaseFlow();
      return;
    }
    if (event.target.closest("[data-open-purchase-schedule]")) {
      openPurchaseScheduleSheet();
      return;
    }
    if (event.target.closest("[data-close-purchase-schedule]")) {
      closeAppSheet("purchaseScheduleSheet");
      return;
    }
    const purchaseScheduleWeekButton = event.target.closest("[data-purchase-schedule-week]");
    if (purchaseScheduleWeekButton) {
      movePurchaseSchedulePickerWeek(Number(purchaseScheduleWeekButton.dataset.purchaseScheduleWeek) || 0);
      return;
    }
    if (event.target.closest("#purchaseScheduleAvailableOnly")) {
      const flow = purchaseFlowState();
      flow.scheduleAvailableOnly = !flow.scheduleAvailableOnly;
      saveSnapshot();
      renderPurchaseScheduleSheet();
      return;
    }
    if (event.target.closest("#completePurchaseScheduleSelection")) {
      completePurchaseScheduleSelection();
      return;
    }
    const purchaseScheduleDateButton = event.target.closest("[data-purchase-schedule-date]");
    if (purchaseScheduleDateButton) {
      const flow = purchaseFlowState();
      clearPurchaseSchedules();
      flow.preferredDate = purchaseScheduleDateButton.dataset.purchaseScheduleDate || "";
      flow.preferredDay = purchaseScheduleDateButton.dataset.purchaseScheduleDay || purchaseDateDay(flow.preferredDate);
      flow.preferredTime = "";
      saveSnapshot();
      renderMembershipPurchaseFlow();
      return;
    }
    const purchaseSlotButton = event.target.closest("[data-purchase-slot]");
    if (purchaseSlotButton) {
      applyPurchaseScheduleSlot({
        lessonDate: purchaseSlotButton.dataset.purchaseSlotDate || "",
        day: purchaseSlotButton.dataset.purchaseSlotDay || "",
        time: purchaseSlotButton.dataset.purchaseSlotTime || "",
        coachRoleId: purchaseSlotButton.dataset.purchaseSlotCoach || "",
        coachName: purchaseSlotButton.dataset.purchaseSlotCoachName || "",
      });
      return;
    }
    if (event.target.closest("[data-purchase-back]")) {
      movePurchaseStep(-1);
      return;
    }
    if (event.target.closest("[data-purchase-next]")) {
      movePurchaseStep(1);
      return;
    }
    if (event.target.closest("[data-purchase-pay]")) {
      void submitMembershipPurchaseFlow();
      return;
    }
    if (event.target.closest("[data-retry-bank-transfer]")) {
      void submitMembershipPurchaseFlow();
      return;
    }
    const membershipFilterButton = event.target.closest("[data-membership-filter]");
    if (membershipFilterButton) {
      const key = membershipFilterButton.dataset.membershipFilter;
      if (membershipFilterDefinitions.some((definition) => definition.key === key)) {
        state.membershipSelectedFamilyId = "";
        state.membershipFilters[key] = membershipFilterButton.dataset.membershipFilterValue || "all";
        renderProducts();
      }
      return;
    }
    const membershipPresetButton = event.target.closest("[data-membership-preset]");
    if (membershipPresetButton) {
      const preset = membershipPresetDefinitions.find((item) => item.id === membershipPresetButton.dataset.membershipPreset);
      if (preset) selectPurchaseFamily(preset.id);
      return;
    }
    const membershipFilterReset = event.target.closest("[data-membership-filter-reset]");
    if (membershipFilterReset) {
      state.membershipSelectedFamilyId = "";
      state.membershipFilters = {
        scheduleScope: "all",
        productKind: "all",
        groupSize: "all",
        lessonMinutes: "all",
      };
      renderProducts();
      return;
    }
    const paymentMethodButton = event.target.closest("[data-select-payment-method]");
    if (paymentMethodButton) {
      selectPaymentMethod(paymentMethodButton.dataset.selectPaymentMethod);
      closeAppSheet("purchasePaymentMethodSheet", false, { restoreFocus: true });
      return;
    }
    if (event.target.closest("[data-open-purchase-payment-method]")) {
      renderPurchasePaymentMethodSheet();
      openAppSheet("purchasePaymentMethodSheet", { initialFocus: "[data-select-payment-method]" });
      return;
    }
    if (event.target.closest("[data-close-purchase-payment-method]")) {
      closeAppSheet("purchasePaymentMethodSheet");
      return;
    }
    if (event.target.closest("#copyBankTransferAccountButton")) {
      void copyBankTransferAccountNumber();
      return;
    }
    if (event.target.closest("#cancelBankTransferRequestButton")) {
      void cancelBankTransferRequest();
      return;
    }
    if (event.target.closest("[data-close-bank-transfer-instructions]")) {
      closeAppSheet("bankTransferInstructionsSheet");
      return;
    }
    const productButton = event.target.closest("[data-buy-product]");
    if (productButton) {
      event.preventDefault();
      selectPurchaseProduct(productButton.dataset.buyProduct);
      return;
    }
    if (event.target.closest("[data-close-payment-confirmation]")) {
      closePaymentConfirmationModal();
      return;
    }
    if (event.target.closest("#openPreparedPaymentButton")) {
      completePreparedPayment();
      return;
    }
    if (event.target.closest("#switchPaymentToBankTransferButton")) {
      if (!isPaymentGatewayReady("bank_transfer")) {
        showToast("현재 계좌이체를 사용할 수 없습니다. 관리자에게 문의해 주세요.");
        return;
      }
      closePaymentConfirmationModal();
      selectPaymentMethod("bank_transfer");
      showToast("계좌이체로 변경했습니다. 선택 내용을 확인한 뒤 결제해 주세요.");
      return;
    }
    const pageButton = event.target.closest("[data-page-list]");
    if (pageButton) {
      changePagedList(pageButton.dataset.pageList, Number(pageButton.dataset.pageIndex));
      return;
    }
    const detailButton = event.target.closest("[data-open-journal-detail]");
    if (detailButton) {
      openJournalDetail(detailButton.dataset.openJournalDetail);
      return;
    }
    const dayButton = event.target.closest("[data-open-journal-day]");
    if (dayButton) {
      openJournalDay(dayButton.dataset.openJournalDay);
      return;
    }
    const curriculumFilterButton = event.target.closest("[data-member-curriculum-filter]");
    if (curriculumFilterButton) {
      state.curriculumFilter = curriculumFilterButton.dataset.memberCurriculumFilter;
      renderCurriculum();
      saveSnapshot();
      return;
    }
    const curriculumButton = event.target.closest("[data-open-curriculum-view]");
    if (curriculumButton) setView("curriculumView");
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-buy-product], [data-purchase-pay]")) preloadPortOneSdk();
  }, { passive: true });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "memberCurriculumSearch") return;
    state.curriculumQuery = event.target.value;
    renderMemberCurriculumLibrary();
    saveSnapshot();
  });
}
