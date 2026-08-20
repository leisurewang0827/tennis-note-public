// 시간표 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function focusQuickLessonReturnSlot(slot = null) {
  if (!slot) return;
  const buttons = [...document.querySelectorAll('.admin-duration-add[data-quick-lesson-entry="true"]')]
    .filter((button) => !button.disabled && button.offsetParent !== null);
  const sameLane = buttons
    .filter((button) => button.dataset.addLessonDay === slot.day
      && button.dataset.addLessonCoach === slot.coachId)
    .sort((left, right) => timeToMinutes(left.dataset.addLessonTime) - timeToMinutes(right.dataset.addLessonTime));
  const target = sameLane.find((button) => button.dataset.addLessonTime === slot.time)
    || sameLane.find((button) => timeToMinutes(button.dataset.addLessonTime) > timeToMinutes(slot.time))
    || sameLane[0];
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function focusScheduleLessonCard(lessonId) {
  if (!lessonId) return;
  window.requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("[data-schedule-lesson-id]")]
      .find((item) => String(item.dataset.scheduleLessonId) === String(lessonId));
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    card.classList.add("is-search-target");
    window.setTimeout(() => card.classList.remove("is-search-target"), 2200);
  });
}

function jumpToScheduleSearchResult(date, day, lessonId = "") {
  if (date) state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(date), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  if (day) state.selectedScheduleDay = day;
  state.scheduleView = "week";
  renderSchedule();
  saveSnapshot();
  focusScheduleLessonCard(lessonId);
}

function toggleScheduleBulkMode(force) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 여러 수업을 한 번에 수정할 수 있습니다.");
    return;
  }
  state.scheduleBulkMode = typeof force === "boolean" ? force : !state.scheduleBulkMode;
  if (!state.scheduleBulkMode) {
    state.selectedScheduleLessonIds = [];
    state.scheduleBulkOperationKey = "";
  }
  renderSchedule();
}

function toggleScheduleOpenSlotMode(force) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 빈칸을 여러 개 선택할 수 있습니다.");
    return;
  }
  state.scheduleOpenSlotMode = typeof force === "boolean" ? force : !state.scheduleOpenSlotMode;
  if (state.scheduleOpenSlotMode) {
    state.scheduleBulkMode = false;
    state.selectedScheduleLessonIds = [];
  } else {
    state.selectedScheduleOpenSlots = [];
    state.scheduleOpenSlotAnchorKey = "";
  }
  renderSchedule();
}

function toggleScheduleOpenSlotSelection(key, range = false) {
  if (range && selectScheduleOpenSlotRange(key)) {
    renderSchedule();
    return;
  }
  const selected = selectedScheduleOpenSlotKeys();
  const nextSelected = !selected.has(String(key));
  if (!setScheduleOpenSlotSelection(key, nextSelected)) return;
  state.scheduleOpenSlotAnchorKey = String(key);
  renderSchedule();
}

function toggleScheduleLessonSelection(lessonId, range = false) {
  if (range && selectScheduleLessonRange(lessonId)) {
    renderSchedule();
    return;
  }
  const selected = selectedScheduleLessonIdSet();
  const nextSelected = !selected.has(String(lessonId));
  if (!setScheduleLessonSelection(lessonId, nextSelected)) return;
  state.scheduleBulkAnchorLessonId = String(lessonId);
  renderSchedule();
}

function openLessonModalFromSelectedOpenSlots() {
  const slots = sortedSelectedScheduleOpenSlots();
  if (!slots.length) return;
  if (slots.length > 3) {
    showToast("정규 반복 수업은 한 번에 최대 3칸까지 선택할 수 있습니다.");
    return;
  }
  const coachIds = new Set(slots.map((slot) => slot.coachId));
  if (coachIds.size > 1) {
    showToast("같은 코치의 빈칸만 한 번에 등록할 수 있습니다.");
    return;
  }
  const first = slots[0];
  const clipboard = state.scheduleLessonClipboard;
  const clipboardDefaults = clipboard
    ? scheduleClipboardDefaultsForSlot(first.day, first.time, first.coachId)
    : {};
  if (clipboard) {
    const blockedSlot = slots.find((slot) => !scheduleClipboardCanPaste(slot.day, slot.time, slot.coachId));
    if (blockedSlot) {
      showToast(`${blockedSlot.day} ${blockedSlot.time}에는 복사한 수업을 붙여넣을 수 없습니다.`);
      return;
    }
  }
  state.scheduleOpenSlotMode = false;
  state.selectedScheduleOpenSlots = [];
  state.scheduleOpenSlotAnchorKey = "";
  openLessonModal({
    day: first.day,
    time: first.time,
    coachId: first.coachId,
    quickEntry: true,
    repeatSlots: slots,
    ...clipboardDefaults,
  });
}

function openSelectedScheduleSubstitute() {
  const selected = selectedScheduleLessons();
  if (!selected.length) return;
  const dates = new Set(selected.map((lesson) => lesson.lessonDate));
  if (dates.size !== 1) {
    showToast("대타 지정은 같은 날짜의 수업끼리 선택해 주세요.");
    return;
  }
  openSubstituteModal(selected[0]);
  state.selectedSubstituteLessonIds = selected.map((lesson) => String(lesson.serverLessonId));
  renderSubstituteLessonList();
}

function openAdminMakeupEntitlements() {
  return (state.makeupEntitlements || []).filter((item) => item.status === "open");
}

function showLessonSaveResultPanel({
  status = "saving",
  title = "서버 저장 확인",
  message = "",
  expectedCount = 0,
  confirmedCount = 0,
  missingRows = [],
  recoverySteps = [],
} = {}) {
  const target = $("#lessonSaveResultPanel");
  if (!target) return;
  const safeMissingRows = Array.isArray(missingRows) ? missingRows : [];
  const safeRecoverySteps = Array.isArray(recoverySteps) ? recoverySteps.filter(Boolean) : [];
  const statusClass = status === "danger" ? "is-danger" : status === "good" ? "is-good" : "is-saving";
  const missingMarkup = safeMissingRows.length
    ? `<ul class="lesson-save-result-missing">${safeMissingRows.slice(0, 5).map((item) => `<li>${escapeHtml(`${item.day || item.lessonDate || ""} ${item.time || ""}`.trim())}</li>`).join("")}</ul>`
    : "";
  const recoveryMarkup = safeRecoverySteps.length
    ? `<ol class="lesson-save-result-recovery">${safeRecoverySteps.slice(0, 4).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
    : "";
  target.hidden = false;
  target.className = `lesson-save-result-panel ${statusClass}`;
  target.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    <div class="lesson-save-result-grid">
      <span class="lesson-save-result-item"><span>저장 요청</span><b>${expectedCount || 0}건</b></span>
      <span class="lesson-save-result-item"><span>시간표 확인</span><b>${confirmedCount || 0}건</b></span>
      <span class="lesson-save-result-item"><span>미확인</span><b>${safeMissingRows.length}건</b></span>
    </div>
    ${missingMarkup}
    ${recoveryMarkup}
  `;
}

function pushLessonModalHistoryState() {
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteAdminModal === "lessonModal") return;
  history.pushState({ ...historyState, tennisNoteAdminModal: "lessonModal" }, "", window.location.href);
}

function clearLessonModalHistoryState() {
  const historyState = typeof history.state === "object" && history.state ? { ...history.state } : {};
  if (historyState.tennisNoteAdminModal !== "lessonModal") return;
  delete historyState.tennisNoteAdminModal;
  history.replaceState(historyState, "", window.location.href);
}

function openLessonModal(defaults = {}) {
  if (!$("#oneDayBookingModal")?.hidden) closeOneDayBookingModal();
  const absenceButton = $("#markLessonAbsentButton");
  if (absenceButton) {
    absenceButton.disabled = false;
    absenceButton.textContent = "불참 처리·보강 열기";
  }
  state.editingLessonId = defaults.editingLessonId || null;
  $("#lessonModal").dataset.tnInputGuard = state.editingLessonId
    ? `admin-lesson-${state.editingLessonId}`
    : "admin-lesson-new";
  state.quickLessonEntry = Boolean(!state.editingLessonId && defaults.quickEntry);
  state.quickLessonEdit = Boolean(state.editingLessonId && defaults.quickEdit);
  state.releasedSlotQuickEntry = Boolean(!state.editingLessonId && defaults.releasedSlot);
  state.quickLessonDetailsExpanded = false;
  state.lessonQuickAction = "schedule";
  state.quickLessonReturnSlot = state.quickLessonEntry
    ? { day: defaults.day || "", time: defaults.time || "", coachId: defaults.coachId || "" }
    : null;
  state.lessonOperationKey = createAdminOperationKey(
    state.editingLessonId ? "lesson-edit" : "lesson-create",
  );
  state.releasedAbsenceEntitlementId = state.editingLessonId ? "" : defaults.entitlementId || "";
  state.pinnedLessonDay = state.editingLessonId ? "" : defaults.day || "";
  state.pinnedLessonTime = state.editingLessonId ? "" : defaults.time || "";
  state.pinnedLessonRepeatSlots = !state.editingLessonId && Array.isArray(defaults.repeatSlots) ? defaults.repeatSlots : [];
  const restoreEntitlement = state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
  state.pinnedLessonTicketId = state.editingLessonId ? "" : defaults.ticketId || restoreEntitlement?.ticketId || "";
  state.lessonSourceTouched = false;
  clearLessonSaveResultPanel();
  const hasPinnedScheduleSlot = Boolean(!state.editingLessonId && defaults.day && defaults.time && defaults.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const defaultCorrectionMode = document.querySelector('input[name="lessonPastCorrectionMode"][value="complete"]');
  if (defaultCorrectionMode) defaultCorrectionMode.checked = true;
  const completedCorrection = Boolean(
    editingLesson
    && lessonStatusValue(editingLesson) === "completed"
    && operationsRole() === "admin"
  );
  if (completedCorrection) state.quickLessonDetailsExpanded = true;
  const editingMemberName = getEditingLessonMemberName(editingLesson);
  const requestedMemberName = defaults.memberName || restoreEntitlement?.memberNames?.[0] || "";
  const initialMemberName = editingMemberName || requestedMemberName;
  ["#lessonMemberSearch", "#lessonMember", "#lessonTicket", "#lessonCoach"].forEach((selector) => {
    if ($(selector)) $(selector).disabled = false;
  });
  $("#lessonMemberSearch").value = "";
  refreshLessonMemberOptions(initialMemberName, editingLesson);
  if (initialMemberName && [...$("#lessonMember").options].some((option) => option.value === initialMemberName)) {
    $("#lessonMember").value = initialMemberName;
  } else if (initialMemberName && !editingLesson) {
    const matchingTicket = ticketsForMember(initialMemberName).find((ticket) => String(ticket.id) === String(state.pinnedLessonTicketId))
      || ticketsForMember(initialMemberName)[0];
    ensureLessonMemberOption(
      initialMemberName,
      matchingTicket
        ? `${ticketParticipantNames(matchingTicket).join(" & ") || initialMemberName} · ${getTicketDisplayProduct(matchingTicket)} · ${ticketUsageLabel(matchingTicket)}`
        : `${initialMemberName} · 회원권 확인`,
    );
  }
  fillSelect(
    $("#lessonCoach"),
    coaches
      .filter((coach) => coach.status === "active")
      .map((coach) => ({ value: coach.id, label: `${coach.name} · ${coach.role} · ${getCoachAvailabilityLabel(coach.id)}` })),
  );
  fillSelect(
    $("#lessonCourt"),
    getCourtOptions(),
  );
  fillSelect(
    $("#lessonDay"),
    scheduleDays.map((day) => ({ value: day, label: `${day}요일` })),
  );
  if (!editingLesson && !defaults.day && [...$("#lessonDay").options].some((option) => option.value === currentScheduleDay())) {
    $("#lessonDay").value = currentScheduleDay();
  }
  fillSelect(
    $("#lessonTime"),
    getScheduleTimeOptions().map((time) => ({ value: time, label: time })),
  );
  $("#lessonRepeatSlots").innerHTML = "";
  $("#lessonRepeatSlots").hidden = false;
  if ($("#lessonAdminOverride")) {
    $("#lessonAdminOverride").checked = completedCorrection || scheduleSettings.adminTuningMode === true;
  }
  $("#lessonPastCoachComment").value = "";
  $("#lessonPastCommentKeywords").value = "";
  $("#lessonType").value = "개인";
  $("#lessonSource").value = "regular";
  $("#lessonDuration").value = "20";
  if (editingLesson) {
    if (editingMemberName) $("#lessonMember").value = editingMemberName;
    $("#lessonCoach").value = editingLesson.coachId;
    $("#lessonCourt").value = editingLesson.courtId;
    $("#lessonDay").value = editingLesson.day;
    $("#lessonTime").value = editingLesson.time;
    $("#lessonType").value = editingLesson.type;
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource);
    $("#lessonDuration").value = String(editingLesson.durationMinutes);
  }
  if (defaults.day) $("#lessonDay").value = defaults.day;
  if (defaults.time) $("#lessonTime").value = defaults.time;
  if (defaults.courtId) $("#lessonCourt").value = defaults.courtId;
  if (defaults.coachId) $("#lessonCoach").value = defaults.coachId;
  if (!editingLesson && defaults.lessonType) $("#lessonType").value = defaults.lessonType;
  if (!editingLesson && defaults.durationMinutes) $("#lessonDuration").value = String(defaults.durationMinutes);
  if (!editingLesson && !defaults.coachId) alignCoachToSelectedMemberTicket();
  refreshLessonTicketOptions();
  if (!editingLesson && defaults.ticketId && [...$("#lessonTicket").options].some((option) => String(option.value) === String(defaults.ticketId))) {
    $("#lessonTicket").value = String(defaults.ticketId);
  }
  if (editingLesson) {
    const editingTicket = getTicketByLesson(editingLesson);
    if (editingTicket && [...$("#lessonTicket").options].some((option) => option.value === editingTicket.id)) {
      $("#lessonTicket").value = editingTicket.id;
    }
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource);
    state.lessonSourceTouched = true;
  } else {
    syncLessonSourceFromTicket(true);
  }
  if (completedCorrection) {
    $("#lessonMember").disabled = true;
    $("#lessonTicket").disabled = true;
  }
  if (!editingLesson && defaults.lessonSource) {
    $("#lessonSource").value = normalizeLessonSource(defaults.lessonSource);
    state.lessonSourceTouched = true;
    const matchingTicket = alignTicketToLessonSource(defaults.ticketId);
    if (matchingTicket && String(matchingTicket.id) === String(defaults.ticketId || "")) {
      state.pinnedLessonTicketId = String(defaults.ticketId);
    }
  }
  if (!editingLesson && restoreEntitlement) {
    $("#lessonSource").value = "makeup";
    state.lessonSourceTouched = true;
    alignTicketToLessonSource();
  }
  refreshLessonTimeOptions($("#lessonTime").value);
  if (!editingLesson && !hasPinnedScheduleSlot) autoAssignOpenLessonSlot();
  if (!editingLesson && !hasPinnedScheduleSlot && isPastLessonCorrectionMode(getLessonFormCandidate())) {
    const currentDayIndex = Math.max(0, scheduleDays.indexOf($("#lessonDay").value));
    for (const nextDay of scheduleDays.slice(currentDayIndex + 1)) {
      $("#lessonDay").value = nextDay;
      refreshLessonTimeOptions("");
      autoAssignOpenLessonSlot();
      if (!isPastLessonCorrectionMode(getLessonFormCandidate())) break;
    }
  }
  refreshLessonDurationOptions();
  if (!editingLesson && defaults.durationMinutes && [...$("#lessonDuration").options].some((option) => option.value === String(defaults.durationMinutes))) {
    $("#lessonDuration").value = String(defaults.durationMinutes);
  }
  refreshLessonTimeOptions(hasPinnedScheduleSlot ? defaults.time : $("#lessonTime").value);
  if (hasPinnedScheduleSlot) {
    $("#lessonCoach").value = defaults.coachId;
    $("#lessonDay").value = defaults.day;
    $("#lessonCourt").value = defaults.courtId || $("#lessonCourt").value;
    refreshLessonTimeOptions(defaults.time);
  }
  if (state.releasedSlotQuickEntry && isPastLessonCorrectionMode(getLessonFormCandidate())) {
    if ($("#lessonAdminOverride")) $("#lessonAdminOverride").checked = true;
    if ($("#lessonPastCoachComment") && !$("#lessonPastCoachComment").value.trim()) {
      $("#lessonPastCoachComment").value = "관리자 확인 실제 보강 수업";
    }
  }
  refreshLessonDayOptions();
  if (!editingLesson && defaults.ticketId && [...$("#lessonTicket").options]
    .some((option) => String(option.value) === String(defaults.ticketId))) {
    $("#lessonTicket").value = String(defaults.ticketId);
    state.pinnedLessonTicketId = String(defaults.ticketId);
    refreshLessonDurationOptions();
    refreshLessonDayOptions();
    refreshLessonTimeOptions(hasPinnedScheduleSlot ? defaults.time : $("#lessonTime").value);
  }
  if (!editingLesson && Array.isArray(defaults.repeatSlots) && defaults.repeatSlots.length > 1) {
    applyLessonRepeatSlotDefaults(defaults.repeatSlots);
  }
  syncLessonTypeFromForm();
  renderCurrentLessonMembers(editingLesson);
  renderLessonExpiredTickets();
  $("#lessonModalTitle").textContent = completedCorrection ? "완료 수업 정정" : editingLesson ? "수업 수정" : "수업 추가";
  $("#saveLessonButton").textContent = completedCorrection ? "완료 이력 수정" : editingLesson ? "수정 저장" : "시간표에 추가";
  const editScopePanel = $("#lessonEditScopePanel");
  if (editScopePanel) {
    const canEditSeries = Boolean(editingLesson?.serverLessonId
      && editingLesson.serverStatus === "scheduled"
      && normalizeLessonSource(editingLesson.lessonSource) === "regular");
    editScopePanel.hidden = !canEditSeries;
    const singleScope = editScopePanel.querySelector('input[name="lessonEditScope"][value="single"]');
    if (singleScope) singleScope.checked = true;
    const resetStartInput = $("#lessonResetStartOn");
    if (resetStartInput) {
      resetStartInput.value = editingLesson?.lessonDate || adminWeekDateForDay(editingLesson?.day) || "";
      resetStartInput.min = adminLocalDateKey(new Date());
    }
  }
  const substituteButton = $("#openLessonSubstituteButton");
  if (substituteButton) {
    substituteButton.hidden = !(editingLesson?.serverLessonId && operationsRole() === "admin");
  }
  syncAdminForceDeleteLessonButton();
  const absencePanel = $("#lessonAbsencePanel");
  if (absencePanel) {
    absencePanel.hidden = !(
      editingLesson?.serverLessonId
      && editingLesson.serverStatus === "scheduled"
      && normalizeLessonSource(editingLesson.lessonSource) === "regular"
      && operationsRole() === "admin"
    );
  }
  if ($("#lessonAbsenceReason")) $("#lessonAbsenceReason").value = "";
  refreshLessonMakeupEntitlementOptions();
  if (restoreEntitlement && [...$("#lessonMakeupEntitlement").options].some((option) => option.value === restoreEntitlement.id)) {
    $("#lessonMakeupEntitlement").value = restoreEntitlement.id;
    applySelectedAdminMakeupEntitlement();
  }
  renderLessonAbsenceRestorePanel();
  $("#lessonModal").hidden = false;
  if (!editingLesson && defaults.ticketId) {
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  }
  pushLessonModalHistoryState();
  renderLessonPreview();
  syncLessonEditScopeUi();
  (state.quickLessonEntry ? $("#lessonMemberSearch") : state.quickLessonEdit ? $("#lessonTime") : $("#lessonMember"))?.focus();
}

function openAdminMakeupBooking(entitlement) {
  if (!entitlement || entitlement.status !== "open") return;
  setView("schedule");
  openLessonModal();
  $("#lessonMemberSearch").value = entitlement.memberNames[0] || entitlement.member;
  refreshLessonMemberOptions(entitlement.memberNames[0] || entitlement.member);
  const memberOption = entitlement.memberNames.find((name) => [...$("#lessonMember").options].some((option) => option.value === name));
  if (memberOption) $("#lessonMember").value = memberOption;
  if ([...$("#lessonCoach").options].some((option) => option.value === entitlement.coachId)) {
    $("#lessonCoach").value = entitlement.coachId;
  }
  refreshLessonTicketOptions();
  $("#lessonSource").value = "makeup";
  state.lessonSourceTouched = true;
  refreshLessonMakeupEntitlementOptions();
  $("#lessonMakeupEntitlement").value = entitlement.id;
  applySelectedAdminMakeupEntitlement();
  renderLessonPreview();
}

function closeLessonModal(options = {}) {
  const fromHistory = options?.fromHistory === true;
  const clearHistory = options?.clearHistory === true;
  const quickReturnSlot = state.quickLessonReturnSlot;
  $("#lessonModal").hidden = true;
  $("#lessonModal").classList.remove("is-quick-entry", "is-quick-edit", "is-quick-expanded", "is-absence-focus");
  state.editingLessonId = null;
  state.quickLessonEntry = false;
  state.quickLessonEdit = false;
  state.releasedSlotQuickEntry = false;
  state.quickLessonDetailsExpanded = false;
  state.lessonQuickAction = "schedule";
  state.quickLessonReturnSlot = null;
  state.lessonOperationKey = "";
  state.releasedAbsenceEntitlementId = "";
  state.pinnedLessonTicketId = "";
  state.pinnedLessonDay = "";
  state.pinnedLessonTime = "";
  state.pinnedLessonRepeatSlots = [];
  setLessonFormMessage("");
  clearLessonSaveResultPanel();
  if (quickReturnSlot) window.requestAnimationFrame(() => focusQuickLessonReturnSlot(quickReturnSlot));
  if (clearHistory) {
    clearLessonModalHistoryState();
  } else if (!fromHistory && history.state?.tennisNoteAdminModal === "lessonModal") {
    history.back();
  }
}

async function restoreAbsentLessonFromModal() {
  const entitlement = releasedAbsenceEntitlement();
  if (!entitlement) return;
  const cancelBookedMakeup = entitlement.status === "booked";
  const confirmation = cancelBookedMakeup
    ? `${entitlement.member} 회원의 원래 정규수업을 복원할까요?\n\n이미 잡힌 보강 ${entitlement.bookedDate} ${entitlement.bookedTime} 수업은 취소되고, ${entitlement.originalLabel} 정규수업이 다시 확정됩니다.`
    : `${entitlement.member} 회원의 ${entitlement.originalLabel} 정규수업을 다시 살릴까요?\n\n불참 처리와 보강 대기는 취소됩니다.`;
  if (!window.confirm(confirmation)) return;
  const button = $("#restoreAbsentLessonButton");
  if (button) {
    button.disabled = true;
    button.textContent = "복원 중";
  }
  setLessonFormMessage("불참 처리를 되돌리고 원래 정규수업을 복원하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_restore_absent_lesson", {
      target_entitlement_id: entitlement.id,
      target_reason: "회원 참석 재확인",
      target_cancel_booked_makeup: cancelBookedMakeup,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
    closeLessonModal();
    await syncAdminLiveData();
    setView("schedule");
    showToast("원래 정규수업 복원 완료");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const messages = {
      absence_original_slot_occupied: "원래 시간에 다른 수업이 있어 복원할 수 없습니다. 먼저 해당 수업을 이동해 주세요.",
      absence_original_lesson_already_started: "이미 지난 정규수업은 참석으로 되돌릴 수 없습니다.",
      absence_booked_makeup_locked: "이미 시작하거나 완료된 보강이 있어 원래 수업으로 되돌릴 수 없습니다.",
      absence_restore_coach_or_admin_required: "관리자 또는 담당 코치만 원래 수업을 복원할 수 있습니다.",
    };
    setLessonFormMessage(Object.entries(messages).find(([key]) => code.includes(key))?.[1] || "원래 정규수업 복원에 실패했습니다. 시간표를 새로고침해 주세요.", "danger");
    if (button) {
      button.disabled = false;
      button.textContent = "원래 정규수업 복원";
    }
  }
}

function openEditLessonModal(lessonId, allLessons = lessons) {
  const parsedId = Number.isNaN(Number(lessonId)) ? lessonId : Number(lessonId);
  const lesson = allLessons.find((item) => item.id === parsedId);
  if (!lesson) return;
  openLessonModal({ editingLessonId: parsedId, quickEdit: true });
}

function closeLessonRecordModal() {
  const modal = $("#lessonRecordModal");
  if (modal) modal.hidden = true;
  Object.assign(lessonRecordEditorState, { lessonId: "", journalId: "", saving: false });
  $("#lessonRecordForm")?.reset();
  if ($("#lessonRecordMessage")) $("#lessonRecordMessage").textContent = "";
}

function openLessonRecordModal(lessonId) {
  const lesson = lessons.find((item) => item.serverLessonId === lessonId);
  const reviewableStatuses = new Set(["scheduled", "pending_change", "completed", "no_show"]);
  if (!lesson || !reviewableStatuses.has(String(lesson.serverStatus || ""))) {
    showToast("처리할 수업을 새로고침 후 다시 선택해 주세요.");
    return;
  }
  const ownRoleIds = currentOperationsCoachRoleIds();
  if (operationsRole() === "coach" && !ownRoleIds.has(lesson.coachRoleId)) {
    showToast("본인 담당 수업만 처리할 수 있습니다.");
    return;
  }
  const scheduleV2 = window.TennisNoteScheduleV2Admin;
  if (scheduleV2?.openLesson) {
    setView("schedule", { skipLock: true });
    void scheduleV2.openLesson({
      lessonId,
      lessonDate: lesson.lessonDate,
      mode: "outcome",
    }).then((opened) => {
      if (!opened && lesson.serverStatus === "scheduled") openLegacyLessonRecordModal(lessonId);
      else if (!opened) showToast("V2 기록에서 수업을 찾지 못했습니다. 새로고침 후 다시 선택해 주세요.");
    }).catch(() => {
      if (lesson.serverStatus === "scheduled") openLegacyLessonRecordModal(lessonId);
      else showToast("완료 기록을 불러오지 못했습니다. 새로고침 후 다시 선택해 주세요.");
    });
    return;
  }
  openLegacyLessonRecordModal(lessonId);
}

function openLegacyLessonRecordModal(lessonId) {
  const lesson = lessons.find((item) => item.serverLessonId === lessonId);
  if (!lesson || lesson.serverStatus !== "scheduled") {
    showToast("처리할 수업을 새로고침 후 다시 선택해 주세요.");
    return;
  }
  const ownRoleIds = currentOperationsCoachRoleIds();
  if (operationsRole() === "coach" && !ownRoleIds.has(lesson.coachRoleId)) {
    showToast("본인 담당 수업만 처리할 수 있습니다.");
    return;
  }
  const journal = (adminLiveDataState.journalEntries || [])
    .filter((entry) => entry.lesson_id === lessonId)
    .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")))[0] || null;
  const mediaCount = journal
    ? (adminLiveDataState.mediaFiles || []).filter((media) => media.journal_entry_id === journal.id).length
    : 0;
  Object.assign(lessonRecordEditorState, { lessonId, journalId: journal?.id || "", saving: false });
  $("#lessonRecordContext").innerHTML = `
    <strong>${escapeHtml(lesson.member)} · ${escapeHtml(lesson.lessonDate)} ${escapeHtml(lesson.time)}</strong>
    <span>${escapeHtml(getCoachName(lesson.coachId))} · ${escapeHtml(lesson.type)} ${Number(lesson.durationMinutes) || 20}분 · 잔여 ${Number(lesson.ticketRemaining) || 0}회</span>
    <p>${journal ? escapeHtml(journalBodySummary(journal.body)) : "회원 운동일지 미작성 · 코치 기록만으로 완료할 수 있습니다."}</p>
    ${mediaCount ? `<button class="ghost-button" type="button" data-open-journal-media="${escapeHtml(journal.id)}">사진·영상 ${mediaCount}개 보기</button>` : ""}`;
  const select = $("#lessonRecordCurriculum");
  const choices = adminCurriculumChoices();
  if ($("#lessonRecordCurriculumSearch")) $("#lessonRecordCurriculumSearch").value = "";
  if ($("#lessonRecordCurriculumSuggestions")) $("#lessonRecordCurriculumSuggestions").hidden = true;
  select.innerHTML = `<option value="">다음 커리큘럼 선택</option>${choices.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}`;
  $("#lessonRecordComment").value = "";
  const defaultOutcome = document.querySelector('input[name="lessonRecordOutcome"][value="completed_deduct"]');
  if (defaultOutcome) defaultOutcome.checked = true;
  $("#lessonRecordMessage").textContent = choices.length ? "" : "연결된 커리큘럼이 없습니다.";
  $("#lessonRecordModal").hidden = false;
  syncLessonRecordOutcomeUi();
  updateLessonRecordCurriculumLink();
  $("#lessonRecordComment").focus();
}
