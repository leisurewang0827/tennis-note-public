// 문서 전역 위임 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindDelegatedEvents() {
  window.addEventListener("pagehide", flushSnapshotSave);
  window.addEventListener("popstate", () => {
    if (document.body.classList.contains("admin-menu-open")) {
      closeAdminMenu();
      return;
    }
    if (!$("#onsitePaymentModal")?.hidden) {
      closeOnsitePaymentModal();
      return;
    }
    if (!$("#lessonModal")?.hidden) closeLessonModal({ fromHistory: true });
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("admin-menu-open")) closeAdminMenu();
  });
  document.addEventListener("click", (event) => {
    const menuButton = event.target.closest(".compact-action-menu-panel button");
    if (menuButton) menuButton.closest(".compact-action-menu")?.removeAttribute("open");
  });
  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-dashboard-page]");
    if (!pageButton) return;
    const page = Number(pageButton.dataset.dashboardPageIndex) || 0;
    if (pageButton.dataset.dashboardPage === "member-directory") {
      state.memberListPage = page;
      state.selectedMemberId = null;
      void loadAdminMemberDirectoryPage({ force: true, preserveList: true });
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "membership-products") {
      state.membershipProductPage = page;
      state.activeMembershipProductId = "";
      renderServiceReadiness();
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "billing") {
      state.billingPage = page;
      renderBilling();
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "settlement") {
      state.settlementPage = page;
      renderCoachSettlementPreview();
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "recharge") {
      state.rechargePage = page;
      renderBilling();
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "tasks") state.adminTaskPage = page;
    if (pageButton.dataset.dashboardPage === "members") state.memberStatusPage = page;
    renderAdminOperations();
    saveSnapshot();
  });
  document.addEventListener("click", (event) => {
    const buttonId = event.target.closest("button")?.id || "";
    const settingsTabsByButton = {
      openScheduleSettingsButton: "operation",
      openNoticeSettingsButton: "notifications",
      openProductSettingsButton: "membership",
      openReportLayoutSettingsButton: "layout",
    };
    if (buttonId === "openDataToolsButton") openAdminToolsModal("data");
    if (settingsTabsByButton[buttonId]) openSettingsWorkspace(settingsTabsByButton[buttonId]);
  });
  document.addEventListener("click", async (event) => {
    const laneMoveButton = event.target.closest("[data-move-coach-lane]");
    if (laneMoveButton) {
      moveCoachLaneOrder(laneMoveButton.dataset.roleId, laneMoveButton.dataset.moveCoachLane);
      return;
    }
    if (event.target.closest("[data-preview-coach-lane-order]")) {
      await previewCoachLaneOrder();
      return;
    }
    if (event.target.closest("[data-save-coach-lane-order]")) {
      await saveCoachLaneOrder();
      return;
    }
    const reconcileButton = event.target.closest("[data-reconcile-coach-login]");
    if (reconcileButton) {
      await reconcileCoachLogin(reconcileButton.dataset.reconcileCoachLogin);
      return;
    }
    if (event.target.closest("#addCoachStaffButton")) {
      openCoachStaffModal();
      return;
    }
    const editButton = event.target.closest("[data-edit-coach-staff]");
    if (editButton) {
      openCoachStaffModal(editButton.dataset.editCoachStaff);
      return;
    }
    const tabButton = event.target.closest("[data-coach-staff-tab]");
    if (tabButton) {
      const inputGuardWasDirty = Boolean(
        window.TennisNoteInputGuard?.isDirty?.("#coachStaffModal"),
      );
      readCoachStaffPanel();
      coachStaffEditorState.tab = tabButton.dataset.coachStaffTab;
      coachStaffEditorState.message = "";
      renderCoachStaffModal();
      if (!inputGuardWasDirty) {
        window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
      }
      return;
    }
    const addBlockButton = event.target.closest("[data-add-coach-staff-block]");
    if (addBlockButton) {
      addCoachStaffBlock(addBlockButton.dataset.addCoachStaffBlock);
      return;
    }
    const editBlockButton = event.target.closest("[data-edit-coach-staff-block]");
    if (editBlockButton) {
      beginCoachStaffBlockEdit(editBlockButton.dataset.coachStaffBlockType, editBlockButton.dataset.editCoachStaffBlock);
      return;
    }
    const cancelBlockButton = event.target.closest("[data-cancel-coach-staff-block]");
    if (cancelBlockButton) {
      cancelCoachStaffBlockEdit();
      return;
    }
    const removeBlockButton = event.target.closest("[data-remove-coach-staff-block]");
    if (removeBlockButton) {
      removeCoachStaffBlock(removeBlockButton.dataset.coachStaffBlockType, removeBlockButton.dataset.removeCoachStaffBlock);
      return;
    }
    const stateButton = event.target.closest("[data-coach-staff-state]");
    if (stateButton) {
      await setCoachStaffState(stateButton.dataset.coachStaffState);
      return;
    }
    if (event.target.closest("[data-delete-coach-staff]")) {
      await deleteCoachStaff();
      return;
    }
    const listFilterButton = event.target.closest("[data-coach-staff-filter]");
    if (listFilterButton) {
      state.coachStaffListFilter = listFilterButton.dataset.coachStaffFilter === "inactive" ? "inactive" : "active";
      renderCoaches();
      return;
    }
    if (event.target.closest("#closeCoachStaffModal, #cancelCoachStaffModal")) closeCoachStaffModal();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id !== "coachStaffSettlementMethod" || !coachStaffEditorState.draft) return;
    coachStaffEditorState.draft.settlement.method = event.target.value;
    syncCoachStaffSettlementFieldVisibility(event.target.value);
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-select-schedule-sheet-row]")) {
      toggleScheduleSheetPasteRowSelection(event.target.dataset.selectScheduleSheetRow, event.target.checked);
      return;
    }
    if (event.target.matches("[data-schedule-sheet-field]")) {
      updateScheduleSheetPasteRow(event.target.dataset.rowIndex, event.target.dataset.scheduleSheetField, event.target.value);
      return;
    }
    if (event.target.id === "recordCoachFilter") {
      state.recordCoachFilter = event.target.value || "all";
      state.recordPage = 0;
      renderNotes();
      saveSnapshot();
    }
    if (event.target.id === "recordPendingTypeFilter") {
      state.recordPendingType = event.target.value || "all";
      state.recordPage = 0;
      renderNotes();
      saveSnapshot();
    }
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-jump]");
    if (!button) return;
    if (button.dataset.scheduleTicketId) {
      const ticket = scheduleTicketById(button.dataset.scheduleTicketId);
      if (!ticket) {
        showToast("회원권 정보를 다시 불러와 주세요");
        return;
      }
      beginScheduleTicketAssignment(
        ticket.id,
        button.dataset.scheduleLessonSource || normalizeLessonSource(ticket.productKind === "pass" || ticket.productKind === "coupon" ? "coupon" : "regular"),
      );
      return;
    }
    setView(button.dataset.jump);
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-settings-tab]");
    if (!button) return;
    state.settingsTab = button.dataset.settingsTab || "operation";
    renderSettingsTabs();
    renderActiveSettingsPanel();
    void ensureAdminViewData("settings", state.settingsTab);
    saveSnapshot();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-membership-section]");
    if (!button) return;
    state.membershipSettingsSection = button.dataset.membershipSection === "discounts" ? "discounts" : "products";
    renderSettingsTabs();
    renderActiveSettingsPanel();
    saveSnapshot();
  });
  document.addEventListener("click", async (event) => {
    const presetButton = event.target.closest("[data-admin-layout-preset]");
    if (presetButton) {
      applyAdminLayoutPreset(presetButton.dataset.adminLayoutPreset);
      return;
    }
    const placementButton = event.target.closest("[data-admin-menu-placement]");
    if (placementButton) {
      setAdminMenuPlacement(placementButton.dataset.adminLayoutId, placementButton.dataset.adminMenuPlacement);
      return;
    }
    const moveButton = event.target.closest("[data-move-admin-layout]");
    if (moveButton) {
      moveAdminLayoutItem(
        moveButton.dataset.moveAdminLayout,
        moveButton.dataset.adminLayoutId,
        moveButton.dataset.direction,
        moveButton.dataset.adminLayoutGroup,
      );
      return;
    }
    if (event.target.closest("#resetAdminLayoutButton")) {
      adminLayoutSettings = defaultAdminLayoutSettings();
      adminLayoutSaveState = "local";
      persistAdminLayoutLocal();
      renderAdminLayoutSettings();
      return;
    }
    if (event.target.closest("#saveAdminLayoutButton")) {
      await saveAdminLayoutSettings();
    }
  });
  document.addEventListener("change", (event) => {
    const sizeSelect = event.target.closest("[data-admin-report-widget-size]");
    if (sizeSelect) {
      setAdminReportWidgetOption("size", sizeSelect.dataset.adminReportWidgetSize, sizeSelect.value);
      return;
    }
    const filterSelect = event.target.closest("[data-admin-report-widget-filter]");
    if (filterSelect) {
      setAdminReportWidgetOption("filter", filterSelect.dataset.adminReportWidgetFilter, filterSelect.value);
      return;
    }
    const input = event.target.closest("[data-admin-layout-visible]");
    if (!input) return;
    setAdminLayoutVisibility(input.dataset.adminLayoutVisible, input.dataset.adminLayoutId, input.checked);
  });
  document.addEventListener("click", async (event) => {
    if (event.target.closest("#addLessonPolicyButton")) {
      await createLessonPolicy();
      return;
    }
    const saveLessonPolicyButton = event.target.closest("[data-save-lesson-policy]");
    if (saveLessonPolicyButton) {
      await saveLessonPolicy(saveLessonPolicyButton.dataset.saveLessonPolicy);
      return;
    }
    const deleteLessonPolicyButton = event.target.closest("[data-delete-lesson-policy]");
    if (deleteLessonPolicyButton) {
      await deleteLessonPolicy(deleteLessonPolicyButton.dataset.deleteLessonPolicy);
      return;
    }
    const moveLessonPolicyButton = event.target.closest("[data-move-lesson-policy]");
    if (moveLessonPolicyButton) {
      await moveLessonPolicy(moveLessonPolicyButton.dataset.moveLessonPolicy, moveLessonPolicyButton.dataset.direction);
      return;
    }
    if (event.target.closest("#saveHoldingPolicy")) {
      await saveHoldingPolicySettings();
      return;
    }
    if (event.target.closest("#saveMemberManagementPolicy")) {
      await saveMemberManagementPolicySettings();
      return;
    }
    const reviewButton = event.target.closest("[data-review-holding]");
    if (reviewButton) {
      await reviewHoldingRequest(reviewButton.dataset.holdingRequestId, reviewButton.dataset.reviewHolding);
      return;
    }
    const accountDeletionButton = event.target.closest("[data-review-account-deletion]");
    if (accountDeletionButton) {
      await reviewAccountDeletionRequest(accountDeletionButton.dataset.accountDeletionId, accountDeletionButton.dataset.reviewAccountDeletion);
      return;
    }
    const accountDeletionReadinessButton = event.target.closest("[data-retry-account-deletion-readiness]");
    if (accountDeletionReadinessButton) {
      await checkAccountDeletionServerReadiness({ force: true });
      return;
    }
    const evidenceButton = event.target.closest("[data-view-holding-evidence]");
    if (evidenceButton) {
      await viewHoldingEvidence(evidenceButton.dataset.viewHoldingEvidence);
      return;
    }
    const deleteEvidenceButton = event.target.closest("[data-delete-holding-evidence]");
    if (deleteEvidenceButton) await deleteHoldingEvidence(deleteEvidenceButton.dataset.deleteHoldingEvidence);
  });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "lessonPolicySearch") return;
    state.lessonPolicySearch = event.target.value;
    renderLessonPolicySettings();
    saveSnapshot();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "adminLockEnabled") {
      adminSecurityModeOverride = "custom";
      currentAdminSecurityDraft().enabled = event.target.checked;
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
      return;
    }
    if (event.target.id === "adminLockTimeout") {
      adminSecurityModeOverride = "custom";
      currentAdminSecurityDraft().timeoutMinutes = numericValue(event.target.value, 10);
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
      return;
    }
    if (event.target.id === "adminPastAbsenceLockEveryTime") {
      adminSecurityModeOverride = "custom";
      currentAdminSecurityDraft().pastAbsenceRequirePinEveryTime = event.target.checked;
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
      return;
    }
    if (event.target.matches("[data-admin-lock-view]")) {
      adminSecurityModeOverride = "custom";
      currentAdminSecurityDraft().lockedViews = $$("[data-admin-lock-view]:checked").map((input) => input.value);
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
    }
  });
  document.addEventListener("click", (event) => {
    const securityModeButton = event.target.closest("[data-admin-security-mode]");
    if (securityModeButton) {
      const mode = securityModeButton.dataset.adminSecurityMode;
      applyAdminSecurityMode(mode);
      return;
    }
    if (event.target.id === "adminLockNowButton") {
      lockAdminNow();
      renderAll();
      showToast("관리자 메뉴를 다시 잠갔습니다");
      return;
    }
    if (event.target.id === "saveAdminSecurityButton") {
      saveAdminSecuritySettings();
      return;
    }
    if (event.target.id === "resetAdminSecurityButton") {
      resetAdminSecurityDraft();
      renderAdminSecurity();
      showToast("저장 전 보안 설정 변경을 취소했습니다");
      return;
    }
    if (event.target.id === "changeAdminPinButton") {
      changeAdminPin();
    }
  });
  document.addEventListener("click", (event) => {
    const oneDaySlotButton = event.target.closest("[data-add-one-day-day]");
    if (oneDaySlotButton) {
      event.stopPropagation();
      openOneDayBookingModal({
        day: oneDaySlotButton.dataset.addOneDayDay,
        time: oneDaySlotButton.dataset.addOneDayTime,
        coachId: oneDaySlotButton.dataset.addOneDayCoach,
      });
      return;
    }
    const releasedSlotButton = event.target.closest("[data-open-released-makeup-slot]");
    if (releasedSlotButton) {
      event.stopPropagation();
      openLessonModal({
        day: releasedSlotButton.dataset.releasedSlotDay,
        time: releasedSlotButton.dataset.releasedSlotTime,
        courtId: releasedSlotButton.dataset.releasedSlotCourt,
        coachId: releasedSlotButton.dataset.releasedSlotCoach,
        lessonSource: "makeup",
        quickEntry: true,
        releasedSlot: true,
      });
      return;
    }
    const slotButton = event.target.closest("[data-add-lesson-day]");
    if (!slotButton) return;
    event.stopPropagation();
    if (slotButton.dataset.selectScheduleSlot) {
      toggleScheduleOpenSlotSelection(slotButton.dataset.selectScheduleSlot, event.shiftKey);
      return;
    }
    const assignmentDefaults = scheduleAssignmentDefaultsForSlot(
      slotButton.dataset.addLessonDay,
      slotButton.dataset.addLessonTime,
      slotButton.dataset.addLessonCoach,
    );
    if (assignmentDefaults.blockedMessage) {
      showToast(assignmentDefaults.blockedMessage);
      return;
    }
    openLessonModal({
      day: slotButton.dataset.addLessonDay,
      time: slotButton.dataset.addLessonTime,
      courtId: slotButton.dataset.addLessonCourt,
      coachId: slotButton.dataset.addLessonCoach,
      quickEntry: slotButton.dataset.quickLessonEntry === "true",
      ...scheduleClipboardDefaults(slotButton),
      ...assignmentDefaults,
    });
  });
  document.addEventListener("keydown", (event) => {
    const lessonButton = event.target.closest("[data-edit-lesson-id], [data-select-schedule-lesson]");
    const typingTarget = event.target.closest("input, textarea, select, [contenteditable='true']");
    if (!typingTarget && state.scheduleOpenSlotMode && state.selectedScheduleOpenSlots?.length && event.key === "Enter") {
      event.preventDefault();
      openLessonModalFromSelectedOpenSlots();
      return;
    }
    if (!typingTarget && state.scheduleBulkMode && state.selectedScheduleLessonIds?.length && event.altKey && !event.ctrlKey && !event.metaKey) {
      const minuteDelta = event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0;
      if (minuteDelta) {
        event.preventDefault();
        void submitScheduleBulkShift(minuteDelta);
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && lessonButton) {
      event.preventDefault();
      const lessonId = lessonButton.dataset.selectScheduleLesson;
      if (lessonId) {
        state.selectedScheduleLessonIds = [String(lessonId)];
      } else {
        const localId = lessonButton.dataset.editLessonId;
        const lesson = lessons.find((item) => String(item.id) === String(localId));
        state.selectedScheduleLessonIds = lesson?.serverLessonId ? [String(lesson.serverLessonId)] : [];
      }
      copySelectedScheduleLesson();
      return;
    }
    const slotButton = event.target.closest('[data-quick-lesson-entry="true"]');
    if (!slotButton) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      if (slotButton.dataset.pasteScheduleLesson === "true") slotButton.click();
      else showToast("복사한 수업의 담당 코치가 근무하는 빈 시간을 선택해 주세요.");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      slotButton.click();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      || !moveScheduleAddButtonFocus(slotButton, event.key)) return;
    event.preventDefault();
  });
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-select-schedule-lesson]");
    if (button) beginScheduleBulkDrag(event, button);
  });
  document.addEventListener("pointerover", (event) => {
    const button = event.target.closest("[data-select-schedule-lesson]");
    if (button) continueScheduleBulkDrag(event, button);
  });
  document.addEventListener("pointerup", endScheduleBulkDrag);
  document.addEventListener("pointercancel", endScheduleBulkDrag);
  document.addEventListener("click", (event) => {
    const bulkLessonButton = event.target.closest("[data-select-schedule-lesson]");
    if (bulkLessonButton) {
      event.stopPropagation();
      if (state.scheduleBulkSuppressClick) return;
      toggleScheduleLessonSelection(bulkLessonButton.dataset.selectScheduleLesson, event.shiftKey);
      return;
    }
    const oneDayBookingButton = event.target.closest("[data-edit-one-day-booking-id]");
    if (oneDayBookingButton) {
      openOneDayBookingModal({ bookingId: oneDayBookingButton.dataset.editOneDayBookingId });
      return;
    }
    const lessonButton = event.target.closest("[data-edit-lesson-id]");
    if (!lessonButton) return;
    openEditLessonModal(lessonButton.dataset.editLessonId);
  });
  document.addEventListener("click", (event) => {
    const scheduleViewButton = event.target.closest("[data-schedule-view]");
    if (scheduleViewButton) {
      state.scheduleView = scheduleViewButton.dataset.scheduleView;
      renderSchedule();
      saveSnapshot();
      return;
    }
    const coachFilterButton = event.target.closest("[data-select-schedule-coach]");
    if (coachFilterButton) {
      state.scheduleCoachFilter = coachFilterButton.dataset.selectScheduleCoach || "all";
      renderSchedule();
      saveSnapshot();
    }
  });
  document.addEventListener("click", (event) => {
    const searchShell = event.target.closest(".global-search-shell");
    if (searchShell) return;
    const results = $("#globalSearchResults");
    if (results) results.hidden = true;
    $("#globalSearch")?.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (event) => {
    const loginButton = event.target.closest("[data-admin-login-provider]");
    if (loginButton) startAdminImportLogin(loginButton.dataset.adminLoginProvider);

    const authButton = event.target.closest("[data-admin-auth-action]");
    if (authButton?.dataset.adminAuthAction === "refresh") refreshAdminImportAuthState().then(refreshAdminPendingUsers);
    if (authButton?.dataset.adminAuthAction === "logout") signOutAdminImport();

    const adminUsersAction = event.target.closest("[data-admin-users-action]");
    if (adminUsersAction?.dataset.adminUsersAction === "refresh") refreshAdminPendingUsers();

    const adminApproveButton = event.target.closest("[data-admin-approve-user]");
    if (adminApproveButton) approveAdminPendingUser(adminApproveButton.dataset.adminApproveUser);

    const adminHoldButton = event.target.closest("[data-admin-hold-user]");
    if (adminHoldButton) holdAdminPendingUser(adminHoldButton.dataset.adminHoldUser);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#onsitePaymentModal")?.hidden) closeOnsitePaymentModal();
    if (event.key === "Escape" && !$("#lessonModal").hidden) closeLessonModal();
    if (event.key === "Escape" && !$("#oneDayBookingModal")?.hidden) closeOneDayBookingModal();
    if (event.key === "Escape" && !$("#coachStaffModal")?.hidden) closeCoachStaffModal();
    if (event.key === "Escape" && !$("#paymentCancelModal")?.hidden) closePaymentCancelModal();
    if (event.key === "Escape" && !$("#refundModal").hidden) closeRefundModal();
    if (event.key === "Escape" && !$("#adminLockModal").hidden) closeAdminLockModal();
    if (event.key === "Escape" && !$("#adminToolsModal").hidden) closeAdminToolsModal();
    if (event.key === "Escape" && !$("#memberManagementModal")?.hidden) closeMemberManagementModal();
    if (event.key === "Escape" && !$("#substituteModal")?.hidden) closeSubstituteModal();
    if (event.key === "Escape" && !$("#policyVersionEditorModal")?.hidden) closePolicyVersionEditor();
  });
  document.addEventListener("click", (event) => {
    const billingFilterButton = event.target.closest("[data-billing-filter]");
    if (billingFilterButton) {
      state.billingFilter = billingFilterButton.dataset.billingFilter || "action";
      state.billingPage = 0;
      renderBilling();
      saveSnapshot();
      return;
    }
    const discountViewButton = event.target.closest("[data-discount-view]");
    if (discountViewButton) {
      state.discountView = discountViewButton.dataset.discountView || "policies";
      renderServiceReadiness();
      saveSnapshot();
      return;
    }
    const policyGuideButton = event.target.closest("[data-copy-policy-guide]");
    if (policyGuideButton) copyPolicyGuide(policyGuideButton.dataset.copyPolicyGuide);
  });
  document.addEventListener("input", (event) => {
    if (!event.target.closest("#branchSalesSetupPanel")) return;
    if (!event.target.matches("[data-sales-payment-method], [data-sales-benefit], [data-sales-feature]")) return;
    syncBranchSalesDraftFromForm();
  });
  document.addEventListener("change", (event) => {
    if (event.target.closest("#branchSalesSetupPanel") && event.target.matches("[data-sales-payment-method], [data-sales-benefit], [data-sales-feature]")) {
      syncBranchSalesDraftFromForm();
      return;
    }
    if (event.target.matches("[data-select-member-row]")) {
      const id = Number(event.target.dataset.selectMemberRow);
      const selected = selectedMemberIdSet();
      if (event.target.checked) selected.add(id); else selected.delete(id);
      state.selectedMemberIds = [...selected];
      renderMemberBulkToolbar();
      return;
    }
    if (event.target.matches("#selectVisibleMembers")) {
      const selected = selectedMemberIdSet();
      const visibleIds = $$('[data-select-member-row]').map((input) => Number(input.dataset.selectMemberRow));
      visibleIds.forEach((id) => event.target.checked ? selected.add(id) : selected.delete(id));
      state.selectedMemberIds = [...selected];
      renderMembers();
      return;
    }
    if (event.target.matches("#memberBulkAction")) {
      syncMemberBulkRenewalFields();
      return;
    }
    if (event.target.matches("[data-select-product-row]")) {
      const selected = selectedProductIdSet();
      const id = String(event.target.dataset.selectProductRow);
      if (event.target.checked) selected.add(id); else selected.delete(id);
      state.selectedMembershipProductIds = [...selected];
      renderProductBulkToolbar();
      return;
    }
    if (event.target.matches("[data-quick-product-status]")) {
      void updateMembershipProductQuickStatus(
        event.target.dataset.quickProductStatus,
        event.target.value,
        event.target,
      );
      return;
    }
    if (event.target.matches("#substituteDate")) {
      state.selectedSubstituteLessonIds = [];
      renderSubstituteLessonList();
      return;
    }
    if (event.target.matches("#substituteSettlementMode")) {
      syncSubstituteSettlementFields();
      return;
    }
    if (event.target.matches("[data-select-substitute-lesson]")) {
      const selected = new Set((state.selectedSubstituteLessonIds || []).map(String));
      const id = String(event.target.dataset.selectSubstituteLesson);
      if (event.target.checked) selected.add(id); else selected.delete(id);
      state.selectedSubstituteLessonIds = [...selected];
      renderSubstituteLessonList();
      return;
    }
    if (event.target.matches("#selectAllSubstituteLessons")) {
      state.selectedSubstituteLessonIds = event.target.checked
        ? substituteLessonsForDate($("#substituteDate")?.value || "").map((lesson) => String(lesson.serverLessonId))
        : [];
      renderSubstituteLessonList();
      return;
    }
    if (event.target.matches("#noticeImageInput")) {
      selectNoticeImage(event.target.files?.[0]);
      return;
    }
    if (event.target.closest("[data-ticket-group-size]")) {
      syncMemberTicketPartnerField(event.target.closest("[data-ticket-lesson-setup]"));
      return;
    }
    if (event.target.matches("#memberManagementForm select[name='productId']")) {
      applyMemberManagementProductDefaults(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm select[name='paymentMethod']")) {
      syncMemberManagementPaymentFields(event.target.form, { forcePrice: true });
      return;
    }
    if (event.target.matches("#memberManagementForm select[name='scheduleScope'], #memberManagementForm select[name='weeklyFrequency'], #memberManagementForm select[name='lessonType']")) {
      syncMemberManagementScopeFields(event.target.form);
      syncManualMemberPartnerField(event.target.form);
      syncMemberManagementProductForMethod(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='partnerMode']")) {
      syncManualMemberPartnerField(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='createScheduleLater']")) {
      syncMemberCreateSchedule(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='reenrollScheduleMode']")) {
      syncMemberReenrollSchedule(event.target.form);
      return;
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches('[data-product-field="cashAmount"]')) {
      const productCard = event.target.closest("[data-product-card]");
      const cardPriceInput = productCard?.querySelector('[data-product-field="cardAmount"]');
      if (cardPriceInput) cardPriceInput.value = String(Math.round(Math.max(0, Number(event.target.value) || 0) * 1.1));
    }
    if (event.target.matches("#memberManagementForm input[name='extendedExpiresOn']")) {
      syncMemberTicketExtensionPreview(event.target.form);
      return;
    }
    if (event.target.matches("[data-product-inline-form] input:not([type='checkbox'])")) {
      setProductInlineDirtyState(event.target.closest("[data-product-inline-form]"));
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='totalSessions'], #memberManagementForm input[name='usedSessions']")) {
      syncMemberManagementBalance(event.target.form);
      syncMemberRegistrationSummary(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='startsOn']")) {
      const product = (adminLiveDataState.products || []).find((item) => item.id === event.target.form?.elements.productId?.value);
      if (product && event.target.form?.elements.expiresOn) {
        const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
        event.target.form.elements.expiresOn.value = addMemberManagementDays(event.target.value, validityDays - 1);
      }
      syncMemberRegistrationSummary(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='paymentDate'], #memberManagementForm input[name='paymentAmount'], #memberManagementForm input[name='paymentOverrideReason'], #memberManagementForm select[name^='scheduleTime']")) {
      syncMemberManagementPaymentFields(event.target.form);
      syncMemberRegistrationSummary(event.target.form);
      return;
    }
    if (event.target.matches("[data-ticket-partner-search]")) {
      filterMemberTicketPartnerOptions(event.target.closest("[data-ticket-lesson-setup]"));
      return;
    }
    if (event.target.matches("[data-manual-member-partner-search]")) {
      filterManualMemberPartnerOptions(event.target.form);
      queueManualMemberPartnerSearch(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='partnerPhone']")) {
      const form = event.target.form;
      const digits = normalizedMemberPhone(event.target.value);
      setManualMemberPartnerStatus(form, "", "", "new");
      if (digits.length >= 9 && form?.elements?.partnerSearch) {
        form.elements.partnerSearch.value = digits;
        queueManualMemberPartnerSearch(form, { promoteExactPhone: true });
      }
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='memberPhone']") && memberManagementModalState.action === "create") {
      const digits = normalizedMemberPhone(event.target.value);
      setManualPrimaryPhoneStatus(
        event.target.form,
        !digits
          ? "신규회원의 휴대전화 번호는 필수입니다."
          : /^01[0-9]{8,9}$/.test(digits)
            ? "등록할 때 앱 가입 계정과 자동으로 대조합니다."
            : "휴대전화 번호를 010-0000-0000 형식으로 입력해 주세요.",
        digits && !/^01[0-9]{8,9}$/.test(digits) ? "danger" : "",
      );
      return;
    }
    if (event.target.matches("[data-member-product-search]")) {
      filterMemberInlineProductOptions(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='memberName']")) {
      const label = event.target.form?.querySelector("[data-manual-primary-member]");
      if (label) label.textContent = event.target.value.trim() || "새 회원";
      return;
    }
    if (event.target.matches("[data-member-inline-form] input[name='totalSessions'], [data-member-inline-form] input[name='usedSessions']")) {
      syncMemberManagementBalance(event.target.form);
      setMemberInlineDirtyState(event.target.form);
      return;
    }
    if (event.target.matches("[data-member-inline-form] input, [data-member-inline-form] select")) {
      if (event.target.matches("select[name='productId']")) syncMemberInlineProductCancellation(event.target.form, { restoreActive: true });
      if (event.target.matches("select[name='scheduleScope']")) {
        event.target.form.dataset.scheduleScopeTouched = "true";
      }
      if (event.target.matches("select[name^='scheduleTime']") && event.target.form?.elements.applyToFutureSchedule) {
        event.target.form.elements.applyToFutureSchedule.value = "true";
      }
      setMemberInlineDirtyState(event.target.form);
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-select-product-row]")) return;
    if (event.target.matches("[data-product-inline-form] input, [data-product-inline-form] select")) {
      setProductInlineDirtyState(event.target.closest("[data-product-inline-form]"));
      return;
    }
    if (!event.target.matches("[data-member-inline-form] select[name='productId'], [data-member-inline-form] select[name='coachRoleId'], [data-member-inline-form] select[name='scheduleScope']")) return;
    const form = event.target.form;
    setMemberInlineDirtyState(form);
    if (event.target.name === "productId") {
      form.dataset.scheduleScopeTouched = "false";
      syncMemberQuickEditorProduct(form);
      syncMemberInlineProductCancellation(form, { restoreActive: true });
    }
    syncMemberInlineFutureScheduleChoice(form);
    if (event.target.name === "productId" && !form.dataset.ticketId && event.target.value) {
      const product = (adminLiveDataState.products || []).find((item) => item.id === event.target.value);
      if (product) {
        const startsOn = form.elements.startsOn?.value || adminLocalDateKey(new Date());
        const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
        if (form.elements.startsOn && !form.elements.startsOn.value) form.elements.startsOn.value = startsOn;
        if (form.elements.expiresOn && !form.elements.expiresOn.value) {
          form.elements.expiresOn.value = addMemberManagementDays(startsOn, validityDays - 1);
        }
        form.elements.totalSessions.disabled = false;
        form.elements.usedSessions.disabled = false;
        form.elements.totalSessions.value = Number(product.total_sessions) || 1;
        form.elements.usedSessions.value = 0;
        form.elements.remainingSessions.value = Number(product.total_sessions) || 1;
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (!event.target.matches("[data-member-product-search]")) return;
    const form = event.target.form;
    const firstResult = form?.querySelector("[data-select-member-product]");
    if (event.key === "Enter" && firstResult) {
      event.preventDefault();
      selectMemberInlineProductSearchResult(firstResult);
    } else if (event.key === "ArrowDown" && firstResult) {
      event.preventDefault();
      firstResult.focus();
    } else if (event.key === "Escape") {
      closeMemberInlineProductResults(form);
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.id === "memberManagementForm") await submitMemberManagementForm(event);
    if (event.target.id === "substituteForm") await submitSubstituteAssignments(event);
    if (event.target.matches("[data-product-inline-form]")) {
      event.preventDefault();
      await updateMembershipProductSetting(event.target.dataset.productInlineForm);
    }
    if (event.target.matches("[data-member-inline-form]")) {
      event.preventDefault();
      await submitMemberInlineEditor(event.target);
    }
  });
  document.addEventListener("click", async (event) => {
    if (event.target.matches("[data-select-product-row]")) event.stopPropagation();
    const paymentOverrideButton = event.target.closest("[data-enable-payment-override]");
    if (paymentOverrideButton) {
      enableMemberManagementPaymentOverride(paymentOverrideButton.closest("form"));
      return;
    }
    const memberProductDuration = event.target.closest("[data-member-product-duration]");
    if (memberProductDuration) {
      requestMemberInlineProductDuration(
        memberProductDuration.closest("[data-member-inline-form]"),
        Number(memberProductDuration.dataset.memberProductDuration),
      );
      return;
    }
    const memberProductResult = event.target.closest("[data-select-member-product]");
    if (memberProductResult) {
      selectMemberInlineProductSearchResult(memberProductResult);
      return;
    }
    const clearMemberProductSearch = event.target.closest("[data-clear-member-product-search]");
    if (clearMemberProductSearch) {
      const form = clearMemberProductSearch.closest("[data-member-inline-form]");
      const input = form?.querySelector("[data-member-product-search]");
      if (input) input.value = "";
      filterMemberInlineProductOptions(form);
      input?.focus();
      return;
    }
    if (!event.target.closest("[data-member-product-search-shell]")) {
      document.querySelectorAll("[data-member-inline-form]").forEach(closeMemberInlineProductResults);
    }
    const ticketExtensionPreset = event.target.closest("[data-ticket-extension-days]");
    if (ticketExtensionPreset) {
      applyMemberTicketExtensionPreset(ticketExtensionPreset);
      return;
    }
    const scheduleDayButton = event.target.closest("[data-member-schedule-day]");
    if (scheduleDayButton) {
      const row = scheduleDayButton.closest("[data-member-schedule-row]");
      const form = scheduleDayButton.closest("form");
      const index = row?.dataset.memberScheduleRow || "";
      const dayInput = form?.elements[`scheduleDay${index}`];
      if (!form || !dayInput || scheduleDayButton.disabled) return;
      dayInput.value = scheduleDayButton.dataset.memberScheduleDay || "";
      if (form.elements.applyToFutureSchedule) form.elements.applyToFutureSchedule.value = "true";
      if (form.matches("[data-member-inline-form]")) {
        syncMemberQuickEditorSchedule(form);
        setMemberInlineDirtyState(form);
      } else {
        if (memberManagementModalState.action === "reenroll") syncMemberReenrollSchedule(form);
        else syncMemberCreateSchedule(form);
        syncMemberRegistrationSummary(form);
      }
      return;
    }
    const scheduleSeparateButton = event.target.closest("[data-member-schedule-separate]");
    if (scheduleSeparateButton) {
      keepMemberInlineScheduleSeparate(scheduleSeparateButton.closest("[data-member-inline-form]"));
      return;
    }
    if (event.target.closest("#toggleMemberAdminEdit")) {
      requestMemberAdminEdit();
      return;
    }
    const inlineMemberButton = event.target.closest("[data-open-member-inline]");
    if (inlineMemberButton) {
      const memberId = Number(inlineMemberButton.dataset.openMemberInline);
      const ticketId = String(inlineMemberButton.dataset.memberInlineTicket || "");
      requestMemberInlineEditor(memberId, ticketId);
      return;
    }
    if (event.target.closest("[data-close-member-inline]")) {
      state.inlineMemberId = null;
      state.inlineMemberTicketId = "";
      renderMembers();
      return;
    }
    if (event.target.closest("#saveVisibleMemberRows")) {
      await saveVisibleMemberRows();
      return;
    }
    if (event.target.closest("#showChangedMemberRows")) {
      memberInlineRowFilter = memberInlineRowFilter === "changed" ? "all" : "changed";
      applyMemberInlineRowFilter();
      return;
    }
    if (event.target.closest("#showFailedMemberRows")) {
      memberInlineRowFilter = memberInlineRowFilter === "failed" ? "all" : "failed";
      applyMemberInlineRowFilter();
      return;
    }
    if (event.target.closest("#saveVisibleProductRows")) {
      await saveVisibleProductRows();
      return;
    }
    if (event.target.closest("#toggleScheduleBulkMode")) {
      toggleScheduleBulkMode();
      return;
    }
    if (event.target.closest("#toggleScheduleOpenSlotMode")) {
      toggleScheduleOpenSlotMode();
      return;
    }
    if (event.target.closest("#createLessonFromOpenSlots")) {
      openLessonModalFromSelectedOpenSlots();
      return;
    }
    if (event.target.closest("#clearScheduleOpenSlotSelection")) {
      state.selectedScheduleOpenSlots = [];
      state.scheduleOpenSlotAnchorKey = "";
      renderSchedule();
      return;
    }
    if (event.target.closest("#closeScheduleOpenSlotMode")) {
      toggleScheduleOpenSlotMode(false);
      return;
    }
    const shiftButton = event.target.closest("[data-shift-schedule-lessons]");
    if (shiftButton) {
      await submitScheduleBulkShift(Number(shiftButton.dataset.shiftScheduleLessons));
      return;
    }
    if (event.target.closest("#bulkScheduleSubstitute")) {
      openSelectedScheduleSubstitute();
      return;
    }
    if (event.target.closest("#copyScheduleLesson")) {
      copySelectedScheduleLesson();
      return;
    }
    if (event.target.closest("#clearScheduleLessonClipboard")) {
      clearScheduleLessonClipboard();
      return;
    }
    if (event.target.closest("#openScheduleSheetPaste")) {
      openScheduleSheetPastePanel();
      return;
    }
    if (event.target.closest("#closeScheduleSheetPaste")) {
      closeScheduleSheetPastePanel();
      return;
    }
    if (event.target.closest("#previewScheduleSheetPaste")) {
      previewScheduleSheetPaste();
      return;
    }
    const sheetPasteFilterButton = event.target.closest("[data-schedule-sheet-filter]");
    if (sheetPasteFilterButton) {
      state.scheduleSheetPasteFilter = sheetPasteFilterButton.dataset.scheduleSheetFilter || "all";
      renderScheduleSheetPastePreview();
      return;
    }
    if (event.target.closest("[data-select-visible-schedule-sheet-rows]")) {
      selectVisibleScheduleSheetPasteRows();
      return;
    }
    if (event.target.closest("[data-clear-schedule-sheet-selection]")) {
      clearScheduleSheetPasteSelection();
      return;
    }
    if (event.target.closest("[data-apply-schedule-sheet-bulk]")) {
      applyScheduleSheetPasteBulkUpdate();
      return;
    }
    const removeSheetPasteRowButton = event.target.closest("[data-remove-schedule-sheet-row]");
    if (removeSheetPasteRowButton) {
      removeScheduleSheetPasteRow(removeSheetPasteRowButton.dataset.removeScheduleSheetRow);
      return;
    }
    if (event.target.closest("[data-clear-schedule-sheet-issues]")) {
      clearScheduleSheetPasteIssueRows();
      return;
    }
    if (event.target.closest("#saveScheduleSheetPaste")) {
      await submitScheduleSheetPaste();
      return;
    }
    if (event.target.closest("#clearScheduleSheetPaste")) {
      clearScheduleSheetPaste();
      return;
    }
    if (event.target.closest("#clearScheduleBulkSelection")) {
      clearScheduleBulkSelection();
      return;
    }
    if (event.target.closest("#closeScheduleBulkMode")) {
      clearScheduleBulkSelection(true);
      return;
    }
    if (event.target.closest("#openLessonSubstituteButton")) {
      const lesson = lessons.find((item) => item.id === state.editingLessonId);
      if (!lesson?.serverLessonId) return;
      closeLessonModal();
      openSubstituteModal(lesson);
      return;
    }
    if (event.target.closest("#openSubstituteModal")) {
      openSubstituteModal();
      return;
    }
    if (event.target.closest("#closeSubstituteModal, #cancelSubstituteModal")) {
      closeSubstituteModal();
      return;
    }
    if (event.target.closest("#cancelSubstituteAssignments")) {
      await cancelSubstituteAssignments();
      return;
    }
    if (event.target.closest("#runMemberBulkAction")) {
      await runMemberBulkAction();
      return;
    }
    if (event.target.closest("#selectAllFilteredMembers")) {
      const filteredIds = filteredMembers().map((member) => Number(member.id));
      const selected = selectedMemberIdSet();
      const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
      filteredIds.forEach((id) => allFilteredSelected ? selected.delete(id) : selected.add(id));
      state.selectedMemberIds = [...selected];
      renderMembers();
      return;
    }
    if (event.target.closest("#deleteSelectedMembers")) {
      const actionSelect = $("#memberBulkAction");
      const selectedMembers = members.filter((member) => selectedMemberIdSet().has(Number(member.id)));
      const permanentDelete = selectedMembers.length > 0
        && selectedMembers.every((member) => memberListStatus(member) === "inactive" && member.authRole !== "admin");
      if (actionSelect) actionSelect.value = permanentDelete ? "permanent_delete" : "deactivate";
      await runMemberBulkAction();
      return;
    }
    if (event.target.closest("#clearMemberBulkSelection")) {
      state.selectedMemberIds = [];
      renderMembers();
      return;
    }
    if (event.target.closest("#runProductBulkAction")) {
      await runProductBulkAction();
      return;
    }
    if (event.target.closest("#saveSelectedProducts")) {
      await runProductBulkAction("save");
      return;
    }
    if (event.target.closest("#deleteSelectedProducts")) {
      await runProductBulkAction("delete");
      return;
    }
    if (event.target.closest("#selectAllProducts")) {
      const visibleIds = filteredMembershipProducts().map((product) => String(product.id));
      const selected = selectedProductIdSet();
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
      visibleIds.forEach((id) => allVisibleSelected ? selected.delete(id) : selected.add(id));
      state.selectedMembershipProductIds = [...selected];
      renderServiceReadiness();
      return;
    }
    if (event.target.closest("#clearProductBulkSelection")) {
      state.selectedMembershipProductIds = [];
      renderServiceReadiness();
      return;
    }
    const manualPartnerButton = event.target.closest("[data-select-manual-member-partner]");
    if (manualPartnerButton) {
      const form = manualPartnerButton.closest("form");
      if (form?.elements?.partnerUserId) {
        form.elements.partnerUserId.value = manualPartnerButton.dataset.selectManualMemberPartner;
        form.elements.partnerUserId.dispatchEvent(new Event("change", { bubbles: true }));
        filterManualMemberPartnerOptions(form);
        syncMemberRegistrationSummary(form);
      }
      return;
    }
    const memberButton = event.target.closest("[data-select-member]");
    if (memberButton) {
      const memberId = Number(memberButton.dataset.selectMember);
      const member = members.find((item) => item.id === memberId);
      if (!$("#memberDetail")) {
        if (!member) return;
        state.inlineMemberId = null;
        state.inlineMemberTicketId = "";
        state.selectedMemberId = member?.id || null;
        const ticketId = memberButton.dataset.memberTicket || memberCurrentTicket(member)?.serverTicketId || "";
        await openMemberManagementModal(member, "profile", ticketId);
        return;
      }
      state.selectedMemberId = state.selectedMemberId === memberId ? null : memberId;
      state.inlineMemberId = null;
      state.inlineMemberTicketId = "";
      renderMembers();
      const selectedMember = members.find((member) => member.id === state.selectedMemberId);
      if (selectedMember) void loadAdminMemberDetail(selectedMember);
      return;
    }
    const retryMemberDetailButton = event.target.closest("[data-retry-member-detail]");
    if (retryMemberDetailButton) {
      const selectedMember = members.find((member) => String(member.serverUserId || "") === retryMemberDetailButton.dataset.retryMemberDetail);
      if (selectedMember) void loadAdminMemberDetail(selectedMember, { force: true });
      return;
    }

    const inlineManagementButton = event.target.closest("[data-inline-member-management]");
    if (inlineManagementButton) {
      const member = members.find((item) => item.id === Number(inlineManagementButton.dataset.inlineMemberManagement));
      const ticketId = inlineManagementButton.dataset.inlineMemberTicket || "";
      state.selectedMemberId = member?.id || null;
      await openMemberManagementModal(member, ticketId ? "profile" : "assign", ticketId);
      return;
    }

    if (event.target.closest("[data-close-member-detail]")) {
      state.selectedMemberId = null;
      renderMembers();
      return;
    }

    const ticketManageButton = event.target.closest("[data-manage-member-ticket]");
    if (ticketManageButton) {
      const ticketId = ticketManageButton.dataset.manageMemberTicket || "";
      const action = document.querySelector(`[data-member-ticket-action="${CSS.escape(ticketId)}"]`)?.value || "correct";
      const member = members.find((item) => item.id === state.selectedMemberId);
      await openMemberManagementModal(member, action, ticketId);
      return;
    }

    const memberManagementButton = event.target.closest("[data-open-member-management]");
    if (memberManagementButton) {
      const explicitMemberId = Number(memberManagementButton.dataset.memberManagementMemberId || 0);
      const member = members.find((item) => item.id === (explicitMemberId || state.selectedMemberId));
      if (explicitMemberId) state.selectedMemberId = member?.id || null;
      await openMemberManagementModal(
        member,
        memberManagementButton.dataset.openMemberManagement,
        memberManagementButton.dataset.memberManagementTicket || "",
      );
      return;
    }

    if (event.target.closest("[data-close-member-management]")) {
      closeMemberManagementModal();
      return;
    }

    const saveTicketLessonSetupButton = event.target.closest("[data-save-ticket-lesson-setup]");
    if (saveTicketLessonSetupButton) {
      await saveMemberTicketLessonSetup(saveTicketLessonSetupButton);
      return;
    }

    const groupPaymentModeButton = event.target.closest("[data-group-payment-mode]");
    if (groupPaymentModeButton) {
      await setGroupPaymentMode(groupPaymentModeButton.dataset.groupAccountId, groupPaymentModeButton.dataset.groupPaymentMode);
    }

    const switchGroupPayerButton = event.target.closest("[data-switch-group-payer]");
    if (switchGroupPayerButton) {
      await switchGroupPayer(switchGroupPayerButton.dataset.switchGroupPayer);
    }

    const approvePendingMemberButton = event.target.closest("[data-approve-pending-member]");
    if (approvePendingMemberButton) {
      const member = members.find((item) => item.id === Number(approvePendingMemberButton.dataset.approvePendingMember));
      if (member) {
        const role = document.querySelector(`[data-pending-member-role="${member.id}"]`)?.value || "member";
        const coach = document.querySelector(`[data-pending-member-coach="${member.id}"]`)?.value || "미배정";
        member.status = "active";
        member.statusLabel = "수강중";
        member.authRole = role;
        member.coach = coach;
        member.source = "소셜 로그인 승인";
        member.note = "신규 로그인 회원 승인 완료";
        renderAll();
        showToast("회원 승인 완료");
      }
    }

    const holdPendingMemberButton = event.target.closest("[data-hold-pending-member]");
    if (holdPendingMemberButton) {
      const member = members.find((item) => item.id === Number(holdPendingMemberButton.dataset.holdPendingMember));
      if (member) {
        member.status = "expired";
        member.statusLabel = "보류";
        member.note = "신규 가입 보류 처리됨";
        renderAll();
        showToast("신규 가입 보류 처리 완료");
      }
    }

    const authLinkButton = event.target.closest("[data-copy-auth-link]");
    if (authLinkButton) {
      await copyMemberAuthSql(authLinkButton.dataset.authMemberId, authLinkButton.dataset.copyAuthLink);
      return;
    }

    const prepareAuthSwitchButton = event.target.closest("[data-prepare-auth-switch]");
    if (prepareAuthSwitchButton) {
      await prepareAuthProviderSwitch(prepareAuthSwitchButton.dataset.prepareAuthSwitch, prepareAuthSwitchButton);
      return;
    }

    const cancelAuthSwitchButton = event.target.closest("[data-cancel-auth-switch]");
    if (cancelAuthSwitchButton) {
      await cancelAuthProviderSwitch(cancelAuthSwitchButton.dataset.authUserId, cancelAuthSwitchButton.dataset.cancelAuthSwitch, cancelAuthSwitchButton);
      return;
    }

    const unlinkAuthProviderButton = event.target.closest("[data-unlink-auth-provider]");
    if (unlinkAuthProviderButton) {
      await unlinkAuthProvider(unlinkAuthProviderButton.dataset.authUserId, unlinkAuthProviderButton.dataset.unlinkAuthProvider, unlinkAuthProviderButton);
      return;
    }

    const coachStatusButton = event.target.closest("[data-set-coach-status]");
    if (coachStatusButton) {
      await setCoachApproval(coachStatusButton.dataset.setCoachStatus, coachStatusButton.dataset.coachStatus, coachStatusButton);
      return;
    }

    const bookEntitlementButton = event.target.closest("[data-book-entitlement]");
    if (bookEntitlementButton) {
      const entitlement = openAdminMakeupEntitlements().find((item) => item.id === bookEntitlementButton.dataset.bookEntitlement);
      if (!entitlement) {
        showToast("연결할 보강 대기를 찾지 못했습니다. 새로고침 후 다시 확인해 주세요.");
        return;
      }
      openAdminMakeupBooking(entitlement);
      return;
    }

    const reviewChangeRequestButton = event.target.closest("[data-review-change-request]");
    if (reviewChangeRequestButton) {
      await reviewAdminLessonChangeRequest(
        reviewChangeRequestButton.dataset.reviewChangeRequest,
        reviewChangeRequestButton.dataset.reviewDecision,
        reviewChangeRequestButton,
      );
      return;
    }

    const makeupButton = event.target.closest("[data-approve-makeup]");
    if (makeupButton) {
      const request = makeupRequests.find((item) => String(item.id) === String(makeupButton.dataset.approveMakeup));
      if (!request) return;
      if (request.serverRequestId && request.makeupType !== "entitlement") {
        await reviewAdminLessonChangeRequest(request.serverRequestId, "approved", makeupButton);
        return;
      }
      if (request.status === "approved") {
        showToast("이미 승인된 보강입니다");
        return;
      }
      request.status = "approved";
      request.statusLabel = "승인완료";
      const pendingMakeupLesson = lessons.find((lesson) => lesson.member === request.member && isMakeupLesson(lesson) && lesson.status === "pending") ||
        lessons.find((lesson) => lesson.member === "보강대기" && isMakeupLesson(lesson) && lesson.status === "pending");
      if (pendingMakeupLesson) {
        pendingMakeupLesson.member = request.member;
        pendingMakeupLesson.type = "보강";
        pendingMakeupLesson.status = "scheduled";
        pendingMakeupLesson.makeup = true;
      }
      billingLogs.unshift(`${request.member} 보강 요청 승인`);
      renderAll();
      showToast("보강 승인 완료");
    }

    const syncServerPaymentsButton = event.target.closest("#syncServerPaymentsButton");
    if (syncServerPaymentsButton) {
      await loadServerPaymentsIntoBilling({ force: true });
      return;
    }
    const approvePaymentButton = event.target.closest("[data-approve-payment]");
    if (approvePaymentButton) {
      const item = billings[Number(approvePaymentButton.dataset.approvePayment)];
      await verifyBillingPaymentItem(item);
      return;
    }


    const serverReadyPaymentButton = event.target.closest("[data-server-ready-payment]");
    if (serverReadyPaymentButton) {
      const item = billings[Number(serverReadyPaymentButton.dataset.serverReadyPayment)];
      await verifyBillingPaymentItem(item);
      return;
    }

    const reviewPaymentButton = event.target.closest("[data-review-payment]");
    if (reviewPaymentButton) {
      const item = billings[Number(reviewPaymentButton.dataset.reviewPayment)];
      await verifyBillingPaymentItem(item);
      return;
    }

    const paidPaymentButton = event.target.closest("[data-paid-payment]");
    if (paidPaymentButton) {
      const item = billings[Number(paidPaymentButton.dataset.paidPayment)];
      if (paymentRequiresTicketRepair(item)) openBillingMemberReview(item);
      else showToast(`${item.member} 결제는 이미 승인됐고 회원권에 연결됐습니다`);
      return;
    }

    const refundPaymentButton = event.target.closest("[data-refund-payment]");
    if (refundPaymentButton) {
      const itemIndex = Number(refundPaymentButton.dataset.refundPayment);
      const item = billings[itemIndex];
      await openRefundModal(item);
      return;
    }

    const cancelPaymentButton = event.target.closest("[data-cancel-payment]");
    if (cancelPaymentButton) {
      const itemIndex = Number(cancelPaymentButton.dataset.cancelPayment);
      const item = billings[itemIndex];
      await cancelBillingPaymentItem(item, itemIndex);
      return;
    }

    const failedPaymentButton = event.target.closest("[data-failed-payment]");
    if (failedPaymentButton) {
      const item = billings[Number(failedPaymentButton.dataset.failedPayment)];
      billingLogs.unshift(`${item.member} 결제 실패 확인: ${item.providerPaymentId || item.item}`);
      renderAll();
      showToast("결제 실패 항목을 확인했습니다");
    }

    const renewTicketButton = event.target.closest("[data-renew-ticket]");
    if (renewTicketButton) {
      const ticketId = renewTicketButton.dataset.renewTicket || "";
      const memberName = renewTicketButton.dataset.renewMember || "";
      const refreshed = await syncAdminLiveData();
      if (!refreshed) {
        showToast("최신 회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const ticket = [...tickets, ...expiredTickets].find((item) => String(item.serverTicketId || "") === ticketId);
      const participantIds = new Set(ticketParticipantUserIds(ticket).map(String));
      const member = members.find((item) => item.name === memberName || memberServerUserIds(item).some((id) => participantIds.has(String(id))));
      if (!member || !ticketId) {
        showToast("회원권 정보를 다시 불러와 주세요.");
        return;
      }
      await openMemberManagementModal(member, "reenroll", ticketId);
      return;
    }

    const recalculateThreeMonthButton = event.target.closest("[data-recalculate-three-month]");
    if (recalculateThreeMonthButton) {
      recalculateThreeMonthProductPrice(recalculateThreeMonthButton.dataset.recalculateThreeMonth);
      return;
    }

    const saveProductSettingButton = event.target.closest("[data-save-product-setting]");
    if (saveProductSettingButton) {
      await updateMembershipProductSetting(saveProductSettingButton.dataset.saveProductSetting);
      return;
    }

    const saveGroupPolicyButton = event.target.closest("[data-save-group-deduction-policy]");
    if (saveGroupPolicyButton) {
      const productId = saveGroupPolicyButton.dataset.saveGroupDeductionPolicy;
      const control = document.querySelector(`[data-group-deduction-policy="${CSS.escape(productId)}"]`);
      await saveGroupDeductionPolicy(productId, control);
      return;
    }

    if (event.target.closest("#addOneDayProductButton")) {
      await createMembershipProductSetting({ preset: "one_day" });
      return;
    }

    if (event.target.closest("#addMembershipProductButton")) {
      await createMembershipProductSetting();
      return;
    }

    const moveProductButton = event.target.closest("[data-move-product-setting]");
    if (moveProductButton) {
      await moveMembershipProductSetting(
        moveProductButton.dataset.moveProductSetting,
        moveProductButton.dataset.moveDirection,
      );
      return;
    }

    const forceDeleteProductButton = event.target.closest("[data-force-delete-product-setting]");
    if (forceDeleteProductButton) {
      await forceDeleteMembershipProductSetting(forceDeleteProductButton.dataset.forceDeleteProductSetting);
      return;
    }

    const createDiscountButton = event.target.closest("#createDiscountPolicy");
    if (createDiscountButton) {
      await createDiscountPolicy();
      return;
    }

    const saveDiscountButton = event.target.closest("[data-save-discount-policy]");
    if (saveDiscountButton) {
      await updateDiscountPolicy(saveDiscountButton.dataset.saveDiscountPolicy);
      return;
    }

    const archiveDiscountButton = event.target.closest("[data-archive-discount-policy]");
    if (archiveDiscountButton) {
      await archiveDiscountPolicy(archiveDiscountButton.dataset.archiveDiscountPolicy);
      return;
    }

    const copyPolicyVersionButton = event.target.closest("[data-copy-policy-version]");
    if (copyPolicyVersionButton) {
      await copyPolicyVersion(copyPolicyVersionButton.dataset.copyPolicyVersion);
      return;
    }

    const editPolicyVersionButton = event.target.closest("[data-edit-policy-version]");
    if (editPolicyVersionButton) {
      openPolicyVersionEditor(editPolicyVersionButton.dataset.editPolicyVersion);
      return;
    }

    const activatePolicyVersionButton = event.target.closest("[data-activate-policy-version]");
    if (activatePolicyVersionButton) {
      await activatePolicyVersion(activatePolicyVersionButton.dataset.activatePolicyVersion);
      return;
    }

    const deletePolicyVersionButton = event.target.closest("[data-delete-policy-version]");
    if (deletePolicyVersionButton) {
      await deletePolicyVersion(deletePolicyVersionButton.dataset.deletePolicyVersion);
      return;
    }

    if (event.target.closest("#addPolicyVersionSection")) {
      addPolicyVersionSectionEditor();
      return;
    }

    const removePolicySectionButton = event.target.closest("[data-remove-policy-section]");
    if (removePolicySectionButton) {
      removePolicySectionButton.closest("[data-policy-section-editor]")?.remove();
      return;
    }

    const previewPolicySnapshotButton = event.target.closest("[data-preview-policy-snapshot]");
    if (previewPolicySnapshotButton) {
      showPolicySnapshotPreview(previewPolicySnapshotButton.dataset.previewPolicySnapshot);
    }

    if (event.target.closest("#saveRefundPolicyButton")) {
      await saveRefundPolicySettings();
    }

    if (event.target.closest("#resetRefundPolicyButton")) {
      await resetRefundPolicySettings();
    }

    const savePaymentConfigButton = event.target.closest("#savePaymentConfigButton");
    if (savePaymentConfigButton) {
      savePaymentGatewayConfig();
    }

    const clearPaymentConfigButton = event.target.closest("#clearPaymentConfigButton");
    if (clearPaymentConfigButton) {
      clearPaymentGatewayConfig();
    }

    if (event.target.closest("#saveBranchPaymentAccountButton")) {
      await saveBranchPaymentAccount();
      return;
    }
    if (event.target.closest("#saveSalesBranchPaymentAccountButton")) {
      await saveBranchPaymentAccount();
      return;
    }
    const revokeBankDeviceButton = event.target.closest("[data-revoke-bank-device]");
    if (revokeBankDeviceButton) {
      await revokeBankNotificationDevice(revokeBankDeviceButton.dataset.revokeBankDevice);
      return;
    }
    if (event.target.closest("#saveBranchSalesDraftButton")) {
      await saveBranchSalesSettings(false);
      return;
    }
    if (event.target.closest("#applyBranchSalesSettingsButton")) {
      await saveBranchSalesSettings(true);
      return;
    }

    if (event.target.closest("#issueDiscountCouponButton")) {
      await issueDiscountCoupons();
      return;
    }

    const editNoticeButton = event.target.closest("[data-edit-notice]");
    if (editNoticeButton) {
      editPopupNotice(editNoticeButton.dataset.editNotice);
      return;
    }

    const moveNoticeButton = event.target.closest("[data-move-notice]");
    if (moveNoticeButton) {
      await movePopupNotice(moveNoticeButton.dataset.moveNotice, moveNoticeButton.dataset.direction);
      return;
    }

    const deleteNoticeButton = event.target.closest("[data-delete-notice]");
    if (deleteNoticeButton) {
      await deletePopupNotice(deleteNoticeButton.dataset.deleteNotice);
      return;
    }

    const removeNoticeImageButton = event.target.closest("#removeNoticeImageButton");
    if (removeNoticeImageButton) {
      if (noticeImageDraftUrl) URL.revokeObjectURL(noticeImageDraftUrl);
      noticeImageDraftFile = null;
      noticeImageDraftUrl = "";
      noticeImageRemoveRequested = true;
      renderNoticePopupSettings();
      showToast("저장하면 공지 이미지가 삭제됩니다");
      return;
    }

    const saveNoticePopupButton = event.target.closest("#saveNoticePopupButton");
    if (saveNoticePopupButton) {
      await saveNoticePopupSettings();
      return;
    }

    const disableNoticePopupButton = event.target.closest("#disableNoticePopupButton");
    if (disableNoticePopupButton) {
      await saveNoticePopupSettings("disabled");
      return;
    }

    const newNoticePopupButton = event.target.closest("#newNoticePopupButton");
    if (newNoticePopupButton) {
      startNewPopupNotice();
      return;
    }

    const saveNotificationPolicyButton = event.target.closest("#saveNotificationPolicyButton");
    if (saveNotificationPolicyButton) {
      await saveNotificationPolicySettings();
    }

    const refreshNotificationStatusButton = event.target.closest("#refreshNotificationStatusButton");
    if (refreshNotificationStatusButton) {
      await loadNotificationDeliveryStatus();
      showToast("알림 발송 현황을 확인했습니다");
    }

    const resetNoticeDismissalsButton = event.target.closest("#resetNoticeDismissalsButton");
    if (resetNoticeDismissalsButton) {
      resetNoticeDismissals();
      showToast("회원/코치 앱에서 공지를 다시 볼 수 있게 초기화했습니다");
    }

    const modeActionButton = event.target.closest("[data-mode-action]");
    if (modeActionButton) {
      handleModeAction(modeActionButton.dataset.modeAction);
    }

    const racketTabButton = event.target.closest("[data-racket-tab]");
    if (racketTabButton) {
      state.racketTab = racketTabButton.dataset.racketTab;
      $$(".segment[data-racket-tab]").forEach((item) => item.classList.toggle("is-active", item === racketTabButton));
      billingLogs.unshift(`운영 ${state.racketTab} 탭 확인`);
      saveSnapshot();
      showToast(`${state.racketTab} 탭 열림`);
    }

    const communityChannelButton = event.target.closest("[data-community-channel]");
    if (communityChannelButton) {
      state.communityChannel = communityChannelButton.dataset.communityChannel;
      $$(".channel-pill[data-community-channel]").forEach((item) => item.classList.toggle("is-active", item === communityChannelButton));
      renderCommunity();
      saveSnapshot();
      showToast(`${state.communityChannel} 채널 열림`);
    }

    const recordFilterButton = event.target.closest("[data-record-filter]");
    if (recordFilterButton) {
      state.recordFilter = recordFilterButton.dataset.recordFilter;
      state.recordPage = 0;
      renderNotes();
      saveSnapshot();
      return;
    }
    const recordPageButton = event.target.closest('[data-dashboard-page="records"]');
    if (recordPageButton) {
      state.recordPage = Number(recordPageButton.dataset.dashboardPageIndex) || 0;
      renderNotes();
      saveSnapshot();
      return;
    }

    const lessonRecordButton = event.target.closest("[data-open-lesson-record]");
    if (lessonRecordButton) {
      openLessonRecordModal(lessonRecordButton.dataset.openLessonRecord);
      return;
    }

    const openProductSettingButton = event.target.closest("[data-open-product-setting]");
    if (openProductSettingButton) {
      state.activeMembershipProductId = String(openProductSettingButton.dataset.openProductSetting || "");
      renderServiceReadiness();
      document.querySelector(`[data-product-card="${CSS.escape(state.activeMembershipProductId)}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }

    if (event.target.closest("[data-close-product-setting]")) {
      state.activeMembershipProductId = "";
      renderServiceReadiness();
      return;
    }

    if (event.target.closest("#generateLessonRecordComment")) {
      applyAdminCommentDraft("#lessonRecordCommentKeywords", "#lessonRecordComment");
      return;
    }

    if (event.target.closest("#generateLessonPastComment")) {
      applyAdminCommentDraft("#lessonPastCommentKeywords", "#lessonPastCoachComment");
      return;
    }

    const recordMemberButton = event.target.closest("[data-record-member-id]");
    if (recordMemberButton) {
      const member = members.find((item) => Number(item.id) === Number(recordMemberButton.dataset.recordMemberId));
      if (!member) {
        showToast("회원 정보를 다시 불러온 뒤 확인해 주세요.");
        return;
      }
      setView("members");
      state.selectedMemberId = member.id;
      await openMemberManagementModal(member, "profile", recordMemberButton.dataset.recordTicketId || "");
      return;
    }

    const recordActionButton = event.target.closest("[data-record-action-view]");
    if (recordActionButton) {
      setView(recordActionButton.dataset.recordActionView);
      return;
    }

    const journalMediaButton = event.target.closest("[data-open-journal-media]");
    if (journalMediaButton) {
      openJournalMedia(journalMediaButton.dataset.openJournalMedia);
      return;
    }

    if (event.target.closest("[data-close-lesson-record]")) {
      closeLessonRecordModal();
      return;
    }

    const schedulePresetButton = event.target.closest("[data-schedule-preset]");
    if (schedulePresetButton) {
      const message = applySchedulePreset(schedulePresetButton.dataset.schedulePreset);
      renderAll();
      saveSnapshot();
      await saveLiveSchedulePolicy();
      showToast(message);
      return;
    }

    const editBreakRuleButton = event.target.closest("[data-edit-break-rule]");
    if (editBreakRuleButton) {
      editBreakRule(editBreakRuleButton.dataset.editBreakRule);
      return;
    }

    const toggleBreakFavoriteButton = event.target.closest("[data-toggle-break-favorite]");
    if (toggleBreakFavoriteButton) {
      toggleBreakFavorite(toggleBreakFavoriteButton.dataset.toggleBreakFavorite);
      renderScheduleSettings();
      saveSnapshot();
      await saveLiveSchedulePolicy();
      return;
    }

    const loadBreakFavoriteButton = event.target.closest("[data-load-break-favorite]");
    if (loadBreakFavoriteButton) {
      loadBreakFavorite(loadBreakFavoriteButton.dataset.loadBreakFavorite);
      return;
    }

    const removeBreakFavoriteButton = event.target.closest("[data-remove-break-favorite]");
    if (removeBreakFavoriteButton) {
      scheduleSettings.breakFavorites = scheduleSettings.breakFavorites.filter((favorite) => favorite.id !== removeBreakFavoriteButton.dataset.removeBreakFavorite);
      renderScheduleSettings();
      saveSnapshot();
      await saveLiveSchedulePolicy();
      return;
    }

    const removeBreakRuleButton = event.target.closest("[data-remove-break-rule]");
    if (removeBreakRuleButton) {
      scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => rule.id !== removeBreakRuleButton.dataset.removeBreakRule);
      if (state.editingBreakRuleId === removeBreakRuleButton.dataset.removeBreakRule) clearBreakRuleEditor();
      renderAll();
      saveSnapshot();
      await saveLiveSchedulePolicy();
    }

  });
}
