// 시간표 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindScheduleEvents() {
  $("#toggleScheduleEditMode")?.addEventListener("click", () => {
    state.scheduleEditMode = !state.scheduleEditMode;
    if (!state.scheduleEditMode) toggleScheduleOpenSlotMode(false);
    renderSchedule();
  });
  $("#adminWeekSwitcher")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-go-admin-today]")) {
      goToAdminScheduleToday();
      return;
    }
    const monthButton = event.target.closest("[data-change-admin-month]");
    if (monthButton) {
      changeAdminMonth(Number(monthButton.dataset.changeAdminMonth));
      return;
    }
    const button = event.target.closest("[data-change-admin-week]");
    if (button) changeAdminWeek(Number(button.dataset.changeAdminWeek));
  });
  $("#adminWeekSwitcher")?.addEventListener("change", (event) => {
    if (event.target.matches("[data-admin-month]")) selectAdminMonth(event.target.value);
  });
  $("#scheduleAssignmentTicket")?.addEventListener("change", (event) => {
    const ticketId = event.target.value || "";
    if (!ticketId) {
      clearScheduleTicketAssignment();
      return;
    }
    beginScheduleTicketAssignment(ticketId, "regular");
  });
  $("#scheduleAssignmentSearch")?.addEventListener("input", (event) => {
    state.scheduleAssignmentSearch = event.target.value || "";
    renderScheduleAssignmentPicker();
  });
  $("#scheduleAssignmentSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = scheduleAssignmentQueueCandidates()[0];
    if (!first) return;
    event.preventDefault();
    beginScheduleTicketAssignment(first.id, "regular");
  });
  $("#scheduleAssignmentStatusFilter")?.addEventListener("change", (event) => {
    state.scheduleAssignmentFilter = event.target.value || "all";
    renderScheduleAssignmentPicker();
  });
  $("#nextScheduleAssignment")?.addEventListener("click", () => {
    advanceScheduleTicketAssignment();
  });
  $("#clearScheduleAssignment")?.addEventListener("click", () => {
    clearScheduleTicketAssignment();
    showToast("회원 시간 배정을 종료했습니다.");
  });
  $("#adminScheduleDayPicker")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-admin-day]");
    if (!button) return;
    state.selectedScheduleDay = button.dataset.selectAdminDay;
    renderSchedule();
    saveSnapshot();
  });
  $("#openLessonModal").addEventListener("click", openLessonModal);
  $("#saveScheduleList").addEventListener("click", async () => {
    if (state.liveScheduleLoaded) {
      await saveLiveSchedulePolicy();
      return;
    }
    billingLogs.unshift(`레슨시간표 목록 저장 완료: ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
    renderAll();
    showToast("레슨시간표 저장 완료");
  });
  $("#saveLiveSchedulePolicyButton")?.addEventListener("click", saveLiveSchedulePolicy);
  $("#closeLessonModal").addEventListener("click", closeLessonModal);
  $("#cancelLessonModal").addEventListener("click", closeLessonModal);
  $("#closeOneDayBookingModal")?.addEventListener("click", closeOneDayBookingModal);
  $("#cancelOneDayBookingModal")?.addEventListener("click", closeOneDayBookingModal);
  $("#oneDayBookingForm")?.addEventListener("submit", saveOneDayBooking);
  $("#deleteOneDayBookingButton")?.addEventListener("click", deleteOneDayBooking);
  $("#saveLessonButton")?.addEventListener("click", (event) => {
    if (!isPastLessonCorrectionMode(getLessonFormCandidate())) return;
    event.preventDefault();
    submitLessonFormWithoutNativeValidation();
  });
  $("#lessonForm").addEventListener("submit", addLessonFromForm);
  $("#deleteLessonButton").addEventListener("click", deleteEditingLesson);
  $("#markLessonAbsentButton")?.addEventListener("click", markEditingLessonAbsentForMakeup);
  $("#restoreAbsentLessonButton")?.addEventListener("click", restoreAbsentLessonFromModal);
  $("#applyBreakRuleButton").addEventListener("click", async () => {
    const selectedDays = $$("[data-break-day]:checked").map((input) => input.value);
    const availableCoachRoleIds = memberManagementCoachRoles().map((role) => role.id);
    const selectedCoachRoleIds = $$("[data-break-coach]:checked").map((input) => input.value);
    const start = $("#breakStartInput").value;
    const end = $("#breakEndInput").value;
    const label = $("#breakLabelInput")?.value.trim() || "브레이크";
    if (!selectedDays.length || !selectedCoachRoleIds.length || !start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
      showToast("적용 코치, 요일, 시간을 확인해주세요");
      return;
    }
    const coachRoleIds = selectedCoachRoleIds.length === availableCoachRoleIds.length ? [] : selectedCoachRoleIds;
    const editingRuleId = state.editingBreakRuleId;
    scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => {
      if (editingRuleId && rule.id === editingRuleId) return false;
      const sameTime = rule.start === start && rule.end === end;
      const overlapDay = rule.days.some((day) => selectedDays.includes(day));
      const sameCoaches = JSON.stringify(breakRuleCoachRoleIds(rule).sort()) === JSON.stringify([...coachRoleIds].sort());
      return !(sameTime && overlapDay && sameCoaches);
    });
    const savedRule = { id: editingRuleId || `break-${Date.now()}`, days: selectedDays, start, end, label, coachRoleIds };
    scheduleSettings.breakRules.push(savedRule);
    const favoriteIndex = scheduleSettings.breakFavorites.findIndex((favorite) => favorite.sourceRuleId === savedRule.id);
    if (favoriteIndex >= 0) scheduleSettings.breakFavorites[favoriteIndex] = favoriteBreakFromRule(savedRule);
    state.editingBreakRuleId = "";
    renderAll();
    saveSnapshot();
    await saveLiveSchedulePolicy();
  });
  const adminScheduleTuningModeInput = $("#adminScheduleTuningMode");
  if (adminScheduleTuningModeInput) {
    adminScheduleTuningModeInput.addEventListener("change", async () => {
      const previousValue = scheduleSettings.adminTuningMode === true;
      scheduleSettings.adminTuningMode = adminScheduleTuningModeInput.checked;
      saveSnapshot();
      const synced = await syncLiveSchedulePolicyToServer();
      if (!(await recoverLiveSchedulePolicySave(synced, () => {
        scheduleSettings.adminTuningMode = previousValue;
        adminScheduleTuningModeInput.checked = previousValue;
      }))) return;
      renderScheduleSettings();
      showToast(scheduleSettings.adminTuningMode ? "관리자 튜닝 모드 사용" : "관리자 튜닝 모드 해제");
    });
  }
  $$('[data-lesson-color]').forEach((input) => {
    input.addEventListener("change", async () => {
      const colorKey = input.dataset.lessonColor;
      const previousValue = scheduleSettings.lessonColors[colorKey];
      scheduleSettings.lessonColors[colorKey] = input.value;
      renderSchedule();
      saveSnapshot();
      const synced = await syncLiveSchedulePolicyToServer();
      if (!(await recoverLiveSchedulePolicySave(synced, () => {
        scheduleSettings.lessonColors[colorKey] = previousValue;
      }))) return;
      showToast("시간표 색상 저장 완료");
    });
  });
  $("#moveSameDayRegularLessonButton")?.addEventListener("click", moveSameDayRegularLessonToSelectedSlot);
  $("#lessonCoach").addEventListener("change", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    if (!state.editingLessonId) ensureMemberHasCoachTicket();
    refreshLessonTicketOptions();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  ["#lessonDay", "#lessonDuration"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      if (selector === "#lessonDay") {
        state.pinnedLessonDay = "";
        state.pinnedLessonTime = "";
      }
      // Day and duration only change slot availability. Rebuilding ticket options
      // here silently selected a different ticket after an unavailable-slot warning.
      // Ticket identity is changed only by member, coach, ticket, or source actions.
      if (selector === "#lessonDuration") refreshLessonDayOptions();
      refreshLessonTimeOptions($("#lessonTime").value);
      renderLessonDurationQuickButtons();
      renderLessonPreview();
    });
  });
  $("#lessonDurationQuickButtons")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lesson-duration-quick]");
    if (!button || button.disabled) return;
    $("#lessonDuration").value = button.dataset.lessonDurationQuick;
    refreshLessonDayOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    renderLessonDurationQuickButtons();
    renderLessonPreview();
  });
  $("#addLessonColorRuleButton")?.addEventListener("click", () => {
    const index = scheduleSettings.lessonColorRules.length + 1;
    scheduleSettings.lessonColorRules.push({ id: `custom-${Date.now()}`, label: `추가 표시 ${index}`, match: `추가 표시 ${index}`, color: "#64748b" });
    renderCustomLessonColorRules();
    saveSnapshot();
  });
  $("#customLessonColorRules")?.addEventListener("change", async (event) => {
    const id = event.target.dataset.customLessonLabel || event.target.dataset.customLessonMatch || event.target.dataset.customLessonColor;
    const rule = scheduleSettings.lessonColorRules.find((item) => item.id === id);
    if (!rule) return;
    const previousRule = cloneOperationProfileValue(rule);
    if (event.target.dataset.customLessonLabel) rule.label = event.target.value.trim() || rule.label;
    if (event.target.dataset.customLessonMatch) rule.match = event.target.value.trim();
    if (event.target.dataset.customLessonColor) rule.color = event.target.value;
    renderSchedule();
    saveSnapshot();
    const synced = await syncLiveSchedulePolicyToServer();
    if (!(await recoverLiveSchedulePolicySave(synced, () => {
      Object.assign(rule, previousRule);
    }))) return;
    showToast("추가 표시 종류 저장 완료");
  });
  $("#customLessonColorRules")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-lesson-color-rule]");
    if (!button) return;
    const previousRules = cloneOperationProfileValue(scheduleSettings.lessonColorRules);
    scheduleSettings.lessonColorRules = scheduleSettings.lessonColorRules.filter((rule) => rule.id !== button.dataset.deleteLessonColorRule);
    renderCustomLessonColorRules();
    saveSnapshot();
    const synced = await syncLiveSchedulePolicyToServer();
    await recoverLiveSchedulePolicySave(synced, () => {
      scheduleSettings.lessonColorRules = previousRules;
    });
  });
  $("#lessonTime").addEventListener("change", () => {
    state.pinnedLessonTime = "";
    refreshLessonExtraTimeOptions();
    renderLessonPreview();
    syncLessonEditScopeUi();
  });
  $$('input[name="lessonEditScope"]').forEach((input) => {
    input.addEventListener("change", () => {
      renderLessonPreview();
      syncLessonEditScopeUi();
    });
  });
  $("#lessonResetStartOn")?.addEventListener("change", () => {
    renderLessonPreview();
    syncLessonEditScopeUi();
  });
  $("#lessonType").addEventListener("change", () => {
    syncLessonTypeFromForm();
    renderLessonPreview();
  });
  $("#lessonTicket").addEventListener("change", () => {
    state.pinnedLessonTicketId = $("#lessonTicket").value || "";
    state.lessonSourceTouched = false;
    syncLessonSourceFromTicket(true);
    syncLessonModalWeekToSelectedTicket();
    refreshLessonDurationOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonDayOptions();
    syncLessonTypeFromForm();
    renderLessonTicketHint();
    renderLessonPreview();
  });
  $("#lessonSource").addEventListener("change", () => {
    if ($("#lessonSource").value === "one_day") {
      const defaults = {
        day: $("#lessonDay")?.value || "",
        time: $("#lessonTime")?.value || "",
        coachId: $("#lessonCoach")?.value || "",
      };
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal({ fromHistory: true, clearHistory: true });
      openOneDayBookingModal(defaults);
      return;
    }
    state.lessonSourceTouched = true;
    alignTicketToLessonSource();
    syncLessonSourceOptions();
    refreshLessonDurationOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonDayOptions();
    syncLessonTypeFromForm();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#toggleLessonQuickDetails")?.addEventListener("click", () => {
    state.quickLessonDetailsExpanded = !state.quickLessonDetailsExpanded;
    syncQuickLessonEntryUi();
  });
  $$("[data-lesson-quick-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.dataset.lessonQuickSource || "regular";
      const sourceSelect = $("#lessonSource");
      if (!sourceSelect || ![...sourceSelect.options].some((option) => option.value === source)) return;
      sourceSelect.value = source;
      sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  $$("[data-lesson-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.lessonQuickAction || "schedule";
      if (action === "record") {
        const lessonId = getCurrentEditingLesson()?.serverLessonId || "";
        if (!lessonId) {
          showToast("수업 정보를 다시 불러온 뒤 피드백을 작성해 주세요.");
          return;
        }
        closeLessonModal();
        openLessonRecordModal(lessonId);
        return;
      }
      state.lessonQuickAction = action;
      state.quickLessonDetailsExpanded = action !== "schedule";
      syncQuickLessonEntryUi();
      if (action === "absence") {
        setLessonFormMessage("");
        $("#lessonAbsenceReason")?.focus();
      }
      if (action === "schedule") $("#lessonTime")?.focus();
    });
  });
  $("#lessonMakeupEntitlement")?.addEventListener("change", () => {
    applySelectedAdminMakeupEntitlement();
    syncMakeupEntitlementIdentityLock();
    renderLessonPreview();
  });
  ["#lessonPastCoachComment"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderLessonPreview);
  });
  $$('input[name="lessonPastCorrectionMode"]').forEach((input) => {
    input.addEventListener("change", renderLessonPreview);
  });
  ["#lessonCourt"].forEach((selector) => {
    $(selector).addEventListener("change", renderLessonPreview);
  });
  $("#lessonModal").addEventListener("click", (event) => {
    if (event.target.id === "lessonModal") closeLessonModal();
  });
  $("#oneDayBookingModal")?.addEventListener("click", (event) => {
    if (event.target.id === "oneDayBookingModal") closeOneDayBookingModal();
  });
  ["#oneDayGuestName", "#oneDayGuestPhone", "#oneDayCoach", "#oneDayDate", "#oneDayTime", "#oneDayDuration", "#oneDayStatus", "#oneDayNote"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderOneDayBookingPreview);
    $(selector)?.addEventListener("change", renderOneDayBookingPreview);
  });
  $$(".segment[data-schedule-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scheduleFilter = button.dataset.scheduleFilter;
      $$(".segment[data-schedule-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderSchedule();
    });
  });
  $("#lessonRecordForm")?.addEventListener("submit", saveLessonRecord);
  $$('input[name="lessonRecordOutcome"]').forEach((input) => input.addEventListener("change", () => {
    syncLessonRecordOutcomeUi();
    updateLessonRecordCurriculumLink();
  }));
  $("#lessonRecordCurriculum")?.addEventListener("change", updateLessonRecordCurriculumLink);
  $("#lessonRecordCurriculumSearch")?.addEventListener("input", filterLessonRecordCurriculumOptions);
  $("#lessonRecordCommentKeywords")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    applyAdminCommentDraft("#lessonRecordCommentKeywords", "#lessonRecordComment");
  });
  $("#lessonPastCommentKeywords")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    applyAdminCommentDraft("#lessonPastCommentKeywords", "#lessonPastCoachComment");
  });
  $("#lessonRecordCurriculumSearch")?.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const suggestions = $("#lessonRecordCurriculumSuggestions");
    if (event.key === "Escape") {
      if (suggestions) suggestions.hidden = true;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    suggestions?.querySelector("[data-lesson-record-curriculum-choice]")?.click();
  });
  $("#lessonRecordCurriculumSuggestions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lesson-record-curriculum-choice]");
    if (!button) return;
    const select = $("#lessonRecordCurriculum");
    const searchInput = $("#lessonRecordCurriculumSearch");
    if (select) {
      select.value = button.dataset.lessonRecordCurriculumChoice;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (searchInput) searchInput.value = button.dataset.curriculumSearchLabel || button.textContent.trim();
    $("#lessonRecordCurriculumSuggestions").hidden = true;
  });
}
