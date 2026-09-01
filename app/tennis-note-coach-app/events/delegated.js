// document·window 에 거는 리스너. 서로 순서가 얽히므로 한곳에 원래 순서대로 모은다.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindDelegatedEvents() {
  document.addEventListener("change", (event) => {
    const settlementMonth = event.target.closest("#coachSettlementMonth");
    if (settlementMonth) {
      state.settlementMonth = /^\d{4}-\d{2}$/.test(settlementMonth.value) ? settlementMonth.value : localDateKey().slice(0, 7);
      state.coachSettlement = null;
      void syncCoachSettlementFromServer();
      return;
    }

    const scheduleMonth = event.target.closest("[data-coach-month]");
    if (scheduleMonth) {
      selectCoachMonth(scheduleMonth.value);
      return;
    }

    const photoInput = event.target.closest("#coachPhotoInput");
    if (photoInput && photoInput.files?.[0]) {
      updateCoachPhoto(photoInput.files[0]);
      photoInput.value = "";
      return;
    }

    const curriculumSelect = event.target.closest("[data-next-curriculum]");
    if (curriculumSelect) updateLogDraft(curriculumSelect.dataset.nextCurriculum);

    const participantCurriculumSelect = event.target.closest("[data-log-participant-curriculum]");
    if (participantCurriculumSelect) updateLogDraft(participantCurriculumSelect.dataset.logParticipantCurriculum);

    const modalCurriculum = event.target.closest("[data-modal-next-curriculum]");
    if (modalCurriculum) updateLessonCompletionUi(modalCurriculum.dataset.modalNextCurriculum);

    if (event.target.closest("#recordLessonSelect")) {
      state.writingLessonId = event.target.value;
    }

    const ntrpSelect = event.target.closest("[data-member-ntrp]");
    if (ntrpSelect) updateMemberNtrp(ntrpSelect.dataset.memberNtrp, ntrpSelect.value, ntrpSelect.dataset.memberGroupName || "");
  });

  document.addEventListener("input", (event) => {
    const modalComment = event.target.closest("[data-modal-coach-comment]");
    if (modalComment) updateLessonCompletionUi(modalComment.dataset.modalCoachComment);

    const commentInput = event.target.closest("[data-coach-comment]");
    if (commentInput) updateLogDraft(commentInput.dataset.coachComment);

    const participantCommentInput = event.target.closest("[data-log-participant-comment]");
    if (participantCommentInput) updateLogDraft(participantCommentInput.dataset.logParticipantComment);

    const feedbackInput = event.target.closest("[data-feedback-comment]");
    if (feedbackInput) updateFeedbackDraft(feedbackInput.dataset.feedbackComment);

    const curriculumOptionSearch = event.target.closest("[data-curriculum-option-search]");
    if (curriculumOptionSearch) filterCurriculumOptions(curriculumOptionSearch);

    const curriculumSearch = event.target.closest("#curriculumSearchInput");
    if (curriculumSearch) {
      state.curriculumQuery = curriculumSearch.value;
      renderCurriculumLibraryOnly();
      saveSnapshot();
    }

    const memberSearch = event.target.closest("#memberSearchInput");
    if (memberSearch) {
      state.memberQuery = memberSearch.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const draftKeywords = event.target.closest("[data-log-comment-keywords], [data-log-participant-keywords]");
    if (draftKeywords && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      draftKeywords.closest(".tn-comment-draft-tools")?.querySelector("button")?.click();
      return;
    }
    const curriculumSearch = event.target.closest("[data-curriculum-option-search]");
    if (!curriculumSearch) return;
    const suggestions = curriculumSearch.closest("label")?.querySelector("[data-curriculum-option-suggestions]");
    if (event.key === "Escape") {
      if (suggestions) suggestions.hidden = true;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    suggestions?.querySelector("[data-curriculum-option-code]")?.click();
  });

  document.addEventListener("click", (event) => {
    const sameDayAbsenceReviewButton = event.target.closest("[data-review-same-day-absence]");
    if (sameDayAbsenceReviewButton) {
      void reviewMemberSameDayAbsence(
        sameDayAbsenceReviewButton.dataset.reviewSameDayAbsence,
        sameDayAbsenceReviewButton.dataset.approve === "true",
        sameDayAbsenceReviewButton,
      );
      return;
    }

    const closeSettlementButton = event.target.closest("[data-close-coach-settlement]");
    if (closeSettlementButton) {
      closeCoachSettlementModal();
      return;
    }

    const openSettlementButton = event.target.closest("[data-open-coach-settlement]");
    if (openSettlementButton) {
      openCoachSettlement();
      if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();
      return;
    }

    const curriculumSuggestion = event.target.closest("[data-curriculum-option-code]");
    if (curriculumSuggestion) {
      selectCoachCurriculumSuggestion(curriculumSuggestion);
      return;
    }

    const participantTab = event.target.closest("[data-lesson-participant-tab]");
    if (participantTab) {
      const key = participantTab.dataset.lessonParticipantTab;
      const panel = participantTab.closest(".lesson-action-panel");
      panel?.querySelectorAll("[data-lesson-participant-tab]").forEach((button) => {
        const active = button === participantTab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      panel?.querySelectorAll("[data-lesson-participant-panel]").forEach((participantPanel) => {
        participantPanel.hidden = participantPanel.dataset.lessonParticipantPanel !== key;
      });
      const activePanel = [...(panel?.querySelectorAll("[data-lesson-participant-panel]") || [])]
        .find((participantPanel) => participantPanel.dataset.lessonParticipantPanel === key);
      activePanel?.querySelector("textarea, button")?.focus({ preventScroll: true });
      return;
    }

    const editFinalFeedbackButton = event.target.closest("[data-edit-final-feedback]");
    if (editFinalFeedbackButton) {
      openFinalFeedbackRevision(state.editingLessonId, editFinalFeedbackButton.dataset.editFinalFeedback);
      return;
    }
    const saveFinalFeedbackButton = event.target.closest("[data-save-final-feedback]");
    if (saveFinalFeedbackButton) {
      void saveFinalFeedbackRevision(saveFinalFeedbackButton.dataset.saveFinalFeedback);
      return;
    }
    const cancelFinalFeedbackButton = event.target.closest("[data-cancel-final-feedback]");
    if (cancelFinalFeedbackButton) {
      cancelFinalFeedbackRevision(cancelFinalFeedbackButton.dataset.cancelFinalFeedback);
      return;
    }

    const historyToggle = event.target.closest("[data-toggle-lesson-history]");
    if (historyToggle) {
      const key = historyToggle.dataset.toggleLessonHistory;
      const participantPanel = historyToggle.closest("[data-lesson-participant-panel]");
      const history = [...(participantPanel?.querySelectorAll("[data-lesson-history-panel]") || [])]
        .find((candidate) => candidate.dataset.lessonHistoryPanel === key);
      if (history) {
        history.hidden = !history.hidden;
        historyToggle.textContent = history.hidden ? "지난 기록 보기" : "지난 기록 닫기";
      }
      return;
    }
    const modalCommentDraftButton = event.target.closest("[data-generate-modal-comment]");
    if (modalCommentDraftButton) {
      const participantRow = modalCommentDraftButton.closest("[data-modal-participant-row]");
      applyCoachCommentDraft(
        participantRow?.querySelector("[data-modal-comment-keywords]"),
        participantRow?.querySelector("[data-modal-coach-comment]"),
      );
      return;
    }

    const logCommentDraftButton = event.target.closest("[data-generate-log-comment]");
    if (logCommentDraftButton) {
      const id = logCommentDraftButton.dataset.generateLogComment;
      applyCoachCommentDraft(`[data-log-comment-keywords="${id}"]`, `[data-coach-comment="${id}"]`);
      return;
    }

    const logParticipantDraftButton = event.target.closest("[data-generate-log-participant-comment]");
    if (logParticipantDraftButton) {
      const participantRow = logParticipantDraftButton.closest("[data-log-participant-row]");
      applyCoachCommentDraft(
        participantRow?.querySelector("[data-log-participant-keywords]"),
        participantRow?.querySelector("[data-log-participant-comment]"),
      );
      return;
    }

    const summaryActionButton = event.target.closest("[data-summary-action]");
    if (summaryActionButton) {
      handleSummaryAction(summaryActionButton.dataset.summaryAction);
      return;
    }

    const todayTaskTabButton = event.target.closest("[data-today-task-tab]");
    if (todayTaskTabButton) {
      openTodayTaskTab(todayTaskTabButton.dataset.todayTaskTab, false);
      return;
    }

    const toggleTaskButton = event.target.closest("[data-toggle-task-list]");
    if (toggleTaskButton) {
      toggleTodayTaskList(toggleTaskButton.dataset.toggleTaskList);
      return;
    }

    const focusRecordButton = event.target.closest("[data-focus-record]");
    if (focusRecordButton) {
      focusRecordProcessing(focusRecordButton.dataset.focusRecord);
      return;
    }

    const curriculumFilterButton = event.target.closest("[data-curriculum-filter]");
    if (curriculumFilterButton) {
      state.curriculumFilter = curriculumFilterButton.dataset.curriculumFilter;
      renderCurriculums();
      saveSnapshot();
      return;
    }

    const favoriteCurriculumButton = event.target.closest("[data-toggle-curriculum-favorite]");
    if (favoriteCurriculumButton) {
      toggleCurriculumFavorite(favoriteCurriculumButton.dataset.toggleCurriculumFavorite);
      return;
    }

    const curriculumDetailButton = event.target.closest("[data-open-curriculum-detail]");
    if (curriculumDetailButton && !event.target.closest("a")) {
      openCurriculumDetail(curriculumDetailButton.dataset.openCurriculumDetail);
      return;
    }

    const makeupDetailButton = event.target.closest("[data-open-makeup-detail]");
    if (makeupDetailButton) {
      openMakeupDetail(makeupDetailButton.dataset.openMakeupDetail);
      return;
    }

    const linkedLogButton = event.target.closest("[data-open-linked-log]");
    if (linkedLogButton) {
      openLinkedLog(linkedLogButton.dataset.openLinkedLog);
      return;
    }

    const weekButton = event.target.closest("[data-change-week]");
    if (weekButton) {
      changeScheduleWeek(weekButton.dataset.changeWeek);
      return;
    }

    const monthButton = event.target.closest("[data-change-coach-month]");
    if (monthButton) {
      changeCoachMonth(Number(monthButton.dataset.changeCoachMonth));
      return;
    }

    const scheduleDayButton = event.target.closest("[data-coach-schedule-day]");
    if (scheduleDayButton) {
      coachSchedulePreferenceTouched = true;
      state.selectedFullScheduleDay = scheduleDayButton.dataset.coachScheduleDay;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const showAllScheduleButton = event.target.closest("[data-coach-schedule-show-all]");
    if (showAllScheduleButton) {
      coachSchedulePreferenceTouched = true;
      state.scheduleFilter = "all";
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const jumpScheduleDayButton = event.target.closest("[data-coach-schedule-jump-day]");
    if (jumpScheduleDayButton) {
      coachSchedulePreferenceTouched = true;
      state.selectedFullScheduleDay = jumpScheduleDayButton.dataset.coachScheduleJumpDay;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const scheduleFilterButton = event.target.closest("[data-schedule-filter]");
    if (scheduleFilterButton) {
      coachSchedulePreferenceTouched = true;
      state.scheduleFilter = scheduleFilterButton.dataset.scheduleFilter;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const scheduleTimeRangeButton = event.target.closest("[data-schedule-time-range]");
    if (scheduleTimeRangeButton) {
      state.scheduleTimeRange = scheduleTimeRangeButton.dataset.scheduleTimeRange;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const coachModeButton = event.target.closest("[data-select-coach-mode]");
    if (coachModeButton) {
      selectCoachMode(coachModeButton.dataset.selectCoachMode);
      return;
    }

    const memberFilterButton = event.target.closest("[data-member-filter]");
    if (memberFilterButton) {
      state.memberFilter = memberFilterButton.dataset.memberFilter;
      if (state.memberFilter === "all") {
        state.memberQuery = "";
        state.memberTicketFilter = "all";
      }
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
      return;
    }

    const clearMemberSearchButton = event.target.closest("[data-clear-member-search]");
    if (clearMemberSearchButton) {
      state.memberQuery = "";
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
      $("#memberSearchInput")?.focus({ preventScroll: true });
      return;
    }

    const recordStatusButton = event.target.closest("[data-record-status-filter]");
    if (recordStatusButton) {
      state.recordStatusFilter = recordStatusButton.dataset.recordStatusFilter === "completed" ? "completed" : "pending";
      renderLogs();
      saveSnapshot();
      return;
    }

    const memberDetailRow = event.target.closest("[data-member-detail-id]");
    const memberDetailInteractive = event.target.closest("select, button, a, input, textarea");
    if (memberDetailRow && (!memberDetailInteractive || memberDetailInteractive === memberDetailRow)) {
      openMemberDetail(memberDetailRow.dataset.memberDetailId, memberDetailRow.dataset.memberGroupName || "");
      return;
    }

    const revealMemberContactButton = event.target.closest("[data-reveal-member-contact]");
    if (revealMemberContactButton) {
      state.revealedMemberContactKey = revealMemberContactButton.dataset.revealMemberContact;
      openMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
      saveSnapshot();
      return;
    }

    const refreshMemberChartButton = event.target.closest("[data-refresh-member-chart]");
    if (refreshMemberChartButton) {
      const member = findMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
      const userId = refreshMemberChartButton.dataset.refreshMemberChart || coachMemberChartUserId(member || {});
      void syncCoachMemberChart(userId, member?.displayName || member?.name || "회원", true);
      return;
    }

    const memberPageButton = event.target.closest("[data-member-page]");
    if (memberPageButton) {
      state.memberPage = Number(memberPageButton.dataset.memberPage) || 0;
      renderMembers();
      saveSnapshot();
      return;
    }

    const restoreAbsenceButton = event.target.closest("[data-restore-absence-id]");
    if (restoreAbsenceButton) {
      restoreCoachLessonAbsence(restoreAbsenceButton.dataset.restoreAbsenceId);
      return;
    }

    const lockedTimeButton = event.target.closest("[data-coach-add-locked-time]");
    if (lockedTimeButton) {
      const wrapper = lockedTimeButton.closest(".coach-mobile-locked-add");
      const time = wrapper?.querySelector("[data-coach-locked-time-select]")?.value || "";
      if (!time) {
        showToast("등록할 시간을 선택해 주세요.");
        return;
      }
      openCoachQuickAdd({
        dataset: {
          date: lockedTimeButton.dataset.date,
          day: lockedTimeButton.dataset.day,
          time,
          coachRoleId: lockedTimeButton.dataset.coachRoleId,
        },
      });
      return;
    }

    const quickAddSlot = event.target.closest("[data-coach-add-lesson]");
    if (quickAddSlot) {
      openCoachQuickAdd(quickAddSlot);
      return;
    }

    const quickAddKind = event.target.closest("[data-coach-add-kind]");
    if (quickAddKind && state.coachQuickAdd) {
      state.coachQuickAdd.kind = quickAddKind.dataset.coachAddKind;
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || state.coachQuickAdd.ticketId;
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || state.coachQuickAdd.note;
      state.coachQuickAdd.validationMessage = "";
      renderLessonEditModal();
      return;
    }

    const quickAddDuration = event.target.closest("[data-coach-add-duration]");
    if (quickAddDuration && state.coachQuickAdd) {
      state.coachQuickAdd.durationMinutes = Number(quickAddDuration.dataset.coachAddDuration) || 20;
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || state.coachQuickAdd.ticketId;
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || state.coachQuickAdd.note;
      state.coachQuickAdd.validationMessage = "";
      renderLessonEditModal();
      return;
    }

    if (event.target.closest("[data-save-coach-quick-add]")) {
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || "";
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || "";
      saveCoachQuickAdd();
      return;
    }

    const editLessonButton = event.target.closest("[data-edit-lesson-id]");
    if (editLessonButton) {
      state.activeLessonDisplaySegmentIds = String(editLessonButton.dataset.lessonSegments || "").split(",").filter(Boolean);
      openLessonEditor(editLessonButton.dataset.editLessonId);
      return;
    }

    const absentLessonButton = event.target.closest("[data-mark-lesson-absent]");
    if (absentLessonButton) {
      markCoachLessonAbsent(absentLessonButton.dataset.markLessonAbsent);
      return;
    }

    const attendanceButton = event.target.closest("[data-process-attendance]");
    if (attendanceButton) {
      processCoachAttendance(
        attendanceButton.dataset.processAttendance,
        attendanceButton.dataset.outcome,
        attendanceButton.dataset.deduct === "true",
      );
      return;
    }

    const noShowButton = event.target.closest("[data-process-no-show]");
    if (noShowButton) {
      processCoachNoShow(noShowButton.dataset.processNoShow, noShowButton.dataset.deduct === "true");
      return;
    }

    const saveScheduleButton = event.target.closest("[data-save-schedule-edit]");
    if (saveScheduleButton) {
      saveLessonEdit(saveScheduleButton.dataset.saveScheduleEdit);
      return;
    }

    const openRecordWriterButton = event.target.closest("[data-open-record-writer]");
    if (openRecordWriterButton) {
      openLessonRecordWriter(openRecordWriterButton.dataset.openRecordWriter);
      return;
    }

    if (event.target.closest("[data-save-lesson-record]")) {
      saveLessonRecord();
      return;
    }
    const completeLessonButton = event.target.closest("[data-complete-lesson-from-modal]");
    if (completeLessonButton) {
      completeLessonFromModal(completeLessonButton.dataset.completeLessonFromModal);
      return;
    }

    if (event.target.closest("[data-cancel-schedule-edit]")) {
      closeLessonEditor();
      return;
    }

    if (event.target.closest("[data-close-lesson-modal]")) {
      closeLessonEditor();
      return;
    }

    if (event.target.closest("[data-close-member-modal]")) {
      closeMemberDetailModal();
      return;
    }

    const approveButton = event.target.closest("[data-approve-makeup]");
    if (approveButton) approveMakeup(approveButton.dataset.approveMakeup);

    const rejectButton = event.target.closest("[data-reject-makeup]");
    if (rejectButton) rejectMakeup(rejectButton.dataset.rejectMakeup);

    const completeNtrpButton = event.target.closest("[data-complete-ntrp]");
    if (completeNtrpButton) completeNtrpRequest(completeNtrpButton.dataset.completeNtrp);

    const commentInput = event.target.closest("[data-coach-comment]");
    if (commentInput) updateLogDraft(commentInput.dataset.coachComment);

    const curriculumSelect = event.target.closest("[data-next-curriculum]");
    if (curriculumSelect) updateLogDraft(curriculumSelect.dataset.nextCurriculum);

    const confirmButton = event.target.closest("[data-confirm-log]");
    if (confirmButton) {
      const logId = confirmButton.dataset.confirmLog;
      const log = state.lessonLogs.find((item) => item.id === logId);
      const fromOfflineQueue = ["동기화 대기", "동기화 실패"].includes(log?.status);
      confirmLog(logId, { fromOfflineQueue });
    }
    const refreshLogButton = event.target.closest("[data-refresh-log-completion]");
    if (refreshLogButton) void refreshLessonCompletionFromUi({ logId: refreshLogButton.dataset.refreshLogCompletion });

    const refreshLessonButton = event.target.closest("[data-refresh-lesson-completion]");
    if (refreshLessonButton) void refreshLessonCompletionFromUi({ lessonId: refreshLessonButton.dataset.refreshLessonCompletion });


    const feedbackButton = event.target.closest("[data-confirm-feedback]");
    if (feedbackButton) confirmFeedback(feedbackButton.dataset.confirmFeedback);
  });

  document.addEventListener("keydown", (event) => {
    if (activeCoachModalId && event.key === "Tab") {
      const focusable = coachFocusableElements($(`#${activeCoachModalId}`));
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
    if (event.key === "Escape" && activeCoachModalId) {
      event.preventDefault();
      closeCoachModal(activeCoachModalId);
      return;
    }
    if (event.key === "Escape" && !$("#noticeDialog")?.hidden) {
      event.preventDefault();
      closeNotice(false);
      return;
    }
    const summaryCard = event.target.closest?.(".summary-grid [data-summary-action]");
    if (!summaryCard || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    handleSummaryAction(summaryCard.dataset.summaryAction);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("#memberCoachFilter")) {
      state.memberCoachFilter = event.target.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
    if (event.target.matches("#memberTicketFilter")) {
      state.memberTicketFilter = event.target.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
  });
  window.addEventListener("popstate", (event) => {
    if (activeCoachModalId) {
      closeCoachModal(activeCoachModalId, true);
      return;
    }
    const targetView = event.state?.tennisNoteView;
    if (targetView && $(`#${targetView}`)) setView(targetView);
  });
}
