// 시간표 입력 폼의 항목과 표시를 서로 맞추는 함수들.
//
// 선택지 목록을 다시 채우고 필드를 보이거나 숨긴다. 서버는 부르지 않는다.
// 관리자에서 sync*/refresh* 는 대부분 서버가 아니라 이 일을 한다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function refreshAdminScheduleWeekLabels() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  adminScheduleWeeks.forEach((week, offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    Object.assign(week, {
      label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
      range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      note: offset === 0 ? "이번 주 실시간 수업과 변경 요청" : "다음 주 실시간 수업과 변경 요청",
      startDate: adminLocalDateKey(start),
      endDate: adminLocalDateKey(end),
    });
  });
}

function syncAdminScheduleWeek() {
  const week = activeAdminWeek();
  if (state.liveScheduleLoaded) {
    // Live lessons stay as one canonical collection. Rendering applies the week filter.
    // Replacing this array with only one week made other live lessons appear deleted.
    return;
  }
  for (let index = lessons.length - 1; index >= 0; index -= 1) {
    if (`${lessons[index].id}`.startsWith("admin-week-")) lessons.splice(index, 1);
  }
  (week.lessons || []).forEach((lesson) => {
    lessons.push({ ...lesson });
  });
}

async function persistLessonPolicies(message, allLessonPolicies = lessonPolicies) {
  allLessonPolicies.forEach((policy, index) => {
    policy.order = index;
  });
  reflectLessonPoliciesInActiveVersion();
  saveSnapshot();
  renderLessonPolicySettings();
  renderPolicyVersionSettings();
  const target = await syncLessonPoliciesToServer();
  showToast(target === "server" ? `${message} · 서버 저장 완료` : target === "blocked" ? `${message} · 서버 저장 확인 필요` : `${message} · 로컬 저장 완료`);
}

function syncOnsitePaymentScheduleChoice() {
  const ticket = onsitePaymentSourceTickets().find((item) => item.serverTicketId === $("#onsitePaymentSourceTicket")?.value);
  const product = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const checkbox = $("#onsitePaymentKeepSchedule");
  if (!checkbox) return;
  if (!ticket) {
    checkbox.disabled = true;
    checkbox.checked = false;
    return;
  }
  const compatible = Boolean(ticket && product
    && String(ticket.productKind || "regular") === "regular"
    && String(product.server.product_kind || "regular") === "regular"
    && Number(ticket.groupSize || 1) === Number(product.server.group_size || 1));
  checkbox.disabled = !compatible;
  if (!compatible) checkbox.checked = false;
}

function syncLessonRepeatPreviewPanel(markup = "") {
  const panel = $("#lessonRepeatPreviewPanel");
  if (!panel) return;
  panel.hidden = !markup;
  panel.innerHTML = markup || "";
}

function refreshLessonExtraTimeOptions() {
  $$("[data-lesson-slot-time]").forEach((select) => {
    const day = select.closest(".lesson-repeat-slot")?.querySelector("[data-lesson-slot-day]")?.value || "";
    const options = getTimeOptionsForLessonSlot(day);
    const currentValue = select.value;
    fillSelect(select, options);
    select.value = options.some((option) => option.value === currentValue) ? currentValue : "";
  });
}

function refreshLessonTimeOptions(keepValue = "") {
  const day = $("#lessonDay").value;
  const pinnedTime = !state.editingLessonId
    && state.pinnedLessonDay === day
    && state.pinnedLessonTime
    ? state.pinnedLessonTime
    : "";
  const currentValue = pinnedTime || keepValue || $("#lessonTime").value;
  const durationMinutes = getLessonDurationFromSelectedTicket();
  const pastCorrection = isPastLessonCorrectionMode({ day, time: currentValue, durationMinutes });
  const sourceTimes = pastCorrection || adminManualOverrideEnabled()
    ? getScheduleTimeOptions()
    : getCoachTimeOptions($("#lessonCoach").value, day, durationMinutes);
  if (pinnedTime && !sourceTimes.includes(pinnedTime)) sourceTimes.unshift(pinnedTime);
  const timeOptions = sourceTimes.map((time) => ({ value: time, label: time }));
  const fallbackOptions = timeOptions.length ? timeOptions : [{ value: "", label: "가능 시간 없음" }];
  fillSelect($("#lessonTime"), fallbackOptions);
  $("#lessonTime").value = fallbackOptions.some((option) => option.value === currentValue) ? currentValue : fallbackOptions[0].value;
  refreshLessonExtraTimeOptions();
}

function refreshLessonDayOptions() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const regularScheduleMode = isRegularScheduleSetup(ticket);
  const scheduleCount = requiredRegularScheduleCount(ticket);
  const availableDays = adminManualOverrideEnabled() ? scheduleDays : ticket ? getTicketScheduleDays(ticket) : scheduleDays;
  const pinnedDay = !state.editingLessonId ? state.pinnedLessonDay : "";
  const selectableDays = pinnedDay && !availableDays.includes(pinnedDay)
    ? [pinnedDay, ...availableDays]
    : availableDays;
  const target = $("#lessonRepeatSlots");
  const previousSlots = $$("[data-lesson-slot-day]").map((daySelect) => {
    const row = daySelect.closest(".lesson-repeat-slot");
    return {
      day: daySelect.value,
      time: row?.querySelector("[data-lesson-slot-time]")?.value || "",
    };
  });
  const repeatDefaults = Array.isArray(state.pinnedLessonRepeatSlots) ? state.pinnedLessonRepeatSlots : [];
  target.innerHTML = "";
  target.hidden = !regularScheduleMode;
  const previousPrimaryDay = $("#lessonDay").value;
  fillSelect($("#lessonDay"), selectableDays.map((day) => ({ value: day, label: `${day}요일` })));
  const primaryDayToKeep = pinnedDay || previousPrimaryDay;
  $("#lessonDay").value = selectableDays.includes(primaryDayToKeep) ? primaryDayToKeep : selectableDays[0] || "";
  const primaryDay = $("#lessonDay").value;
  for (let index = 2; index <= 7; index += 1) {
    const isActive = index <= scheduleCount;
    const previous = previousSlots[index - 2] || repeatDefaults[index - 1] || {};
    const selectedDay = previous.day && availableDays.includes(previous.day) ? previous.day : "";
    const row = document.createElement("label");
    row.className = "form-field lesson-repeat-slot";
    row.innerHTML = `
      <span>요일/시간 ${index}</span>
      <div class="lesson-inline-selects">
        <select data-lesson-slot-day></select>
        <select data-lesson-slot-time></select>
      </div>
    `;
    const daySelect = row.querySelector("[data-lesson-slot-day]");
    const timeSelect = row.querySelector("[data-lesson-slot-time]");
    fillSelect(daySelect, [{ value: "", label: "요일 선택" }, ...availableDays.map((day) => ({ value: day, label: `${day}요일` }))]);
    daySelect.value = selectedDay;
    fillSelect(timeSelect, getTimeOptionsForLessonSlot(selectedDay));
    if ([...timeSelect.options].some((option) => option.value === previous.time)) timeSelect.value = previous.time;
    daySelect.disabled = !isActive;
    timeSelect.disabled = !isActive;
    row.classList.toggle("is-disabled", !isActive);
    row.hidden = !isActive;
    row.setAttribute("aria-hidden", isActive ? "false" : "true");
    target.appendChild(row);
    daySelect.addEventListener("change", () => {
      fillSelect(timeSelect, getTimeOptionsForLessonSlot(daySelect.value));
      timeSelect.value = "";
      renderLessonPreview();
    });
    timeSelect.addEventListener("change", renderLessonPreview);
  }
}

function refreshLessonDurationOptions() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const durationMinutes = getTicketDurationMinutes(ticket);
  const previousDuration = $("#lessonDuration").value;
  const ticketDurations = [...new Set([durationMinutes, durationMinutes * 2])]
    .filter((minutes) => [20, 30, 40, 60].includes(minutes));
  const options = adminManualOverrideEnabled()
    ? [20, 30, 40, 60].map((minutes) => ({ value: String(minutes), label: `${minutes}분${minutes === durationMinutes ? " · 회원권 기준" : ""}` }))
    : ticketDurations.map((minutes) => ({
        value: String(minutes),
        label: `${minutes}분 · ${Math.max(1, Math.ceil(minutes / durationMinutes))}회 사용`,
      }));
  fillSelect($("#lessonDuration"), options);
  $("#lessonDuration").value = options.some((item) => item.value === previousDuration)
    ? previousDuration
    : String(durationMinutes);
  renderLessonDurationQuickButtons();
}

function refreshLessonMakeupEntitlementOptions() {
  const field = $("#lessonMakeupEntitlementField");
  const select = $("#lessonMakeupEntitlement");
  if (!field || !select) return;
  const shouldShow = normalizeLessonSource($("#lessonSource")?.value) === "makeup" && !state.editingLessonId;
  field.hidden = !shouldShow;
  if (!shouldShow) {
    select.innerHTML = "";
    syncMakeupEntitlementIdentityLock();
    return;
  }
  const previous = select.value;
  const options = matchingAdminMakeupEntitlements();
  select.innerHTML = [
    '<option value="">보강 대기 없음 · 관리자 직접 입력</option>',
    ...options.map((item) => `<option value="${item.id}">${item.member} · ${item.originalLabel} · ${item.durationMinutes}분</option>`),
  ].join("");
  if (options.some((item) => item.id === previous)) select.value = previous;
  else if (options.length === 1) select.value = options[0].id;
  applySelectedAdminMakeupEntitlement();
  syncMakeupEntitlementIdentityLock();
}

function syncLessonSourceOptions() {
  const select = $("#lessonSource");
  if (!select) return;
  const ticket = getSelectedTicket();
  const editingLesson = getCurrentEditingLesson();
  const pastCorrection = isPastLessonCorrectionMode(getLessonFormCandidate());
  const allowed = new Set(adminManualOverrideEnabled()
    ? ["regular", "makeup", "coupon", "coach_change"]
    : allowedLessonSourcesForTicket(ticket));
  // Walk-in lessons do not require a member ticket, so keep this choice available.
  allowed.add("one_day");
  // Keep coupon lessons visible for manual registration; submission still verifies a coupon ticket.
  allowed.add("coupon");
  if (pastCorrection) allowed.add("admin");
  if (editingLesson?.lessonSource === "coach_change") allowed.add("coach_change");
  [...select.options].forEach((option) => {
    option.hidden = !allowed.has(option.value);
    option.disabled = !allowed.has(option.value);
  });
  const currentSource = normalizeLessonSource(select.value);
  if (!allowed.has(currentSource)) {
    select.value = state.releasedAbsenceEntitlementId ? "makeup" : suggestedLessonSourceForTicket(ticket);
    state.lessonSourceTouched = false;
  }
}

function syncLessonSourceFromTicket(force = false) {
  const select = $("#lessonSource");
  if (!select || (!force && state.lessonSourceTouched)) return;
  select.value = state.releasedAbsenceEntitlementId ? "makeup" : suggestedLessonSourceForTicket();
  syncLessonSourceOptions();
}

function syncAdminForceDeleteLessonButton(candidate = getLessonFormCandidate()) {
  const button = $("#deleteLessonButton");
  if (!button) return null;
  const targetLesson = adminForceDeleteLessonTarget(candidate);
  const available = operationsRole() === "admin" && Boolean(targetLesson);
  button.hidden = !available;
  button.textContent = "관리자 강제 삭제";
  button.dataset.forceDeleteLessonId = available ? String(targetLesson.id) : "";
  button.title = available
    ? `${getLessonMembersLabel(targetLesson)} · ${targetLesson.day} ${targetLesson.time} 수업을 강제 삭제합니다.`
    : "삭제할 기존 수업이 없습니다.";
  return targetLesson;
}

function syncLessonTypeFromForm() {
  $("#lessonType").value = getLessonTypeFromForm();
}

function refreshLessonTicketOptions() {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  const previousTicketId = $("#lessonTicket").value;
  const eligible = getEligibleTickets(memberReference, coachId);
  fillSelect(
    $("#lessonTicket"),
    eligible.length
      ? eligible.map((ticket) => ({ value: ticket.id, label: getLessonTicketOptionLabel(ticket) }))
      : [{ value: "", label: "해당 코치 회원권 없음" }],
  );
  if (eligible.some((ticket) => String(ticket.id) === String(previousTicketId))) {
    $("#lessonTicket").value = String(previousTicketId);
  }
  syncLessonSourceOptions();
  refreshLessonDurationOptions();
  refreshLessonDayOptions();
  syncLessonTypeFromForm();
  renderLessonTicketHint();
}

function syncPastLessonCorrectionUi(candidate = getLessonFormCandidate()) {
  const panel = $("#lessonPastCorrectionPanel");
  const repeatSlots = $("#lessonRepeatSlots");
  const sourceSelect = $("#lessonSource");
  const adminOption = sourceSelect?.querySelector('option[value="admin"]');
  const editingLesson = getCurrentEditingLesson();
  const pastCorrection = isPastLessonCorrectionMode(candidate);
  const correctionMode = pastLessonCorrectionMode();
  const absenceMode = pastCorrection && correctionMode === "absence";
  const commentField = $("#lessonPastCommentField");
  const commentInput = $("#lessonPastCoachComment");

  if (panel) panel.hidden = !pastCorrection;
  if (commentField) commentField.hidden = absenceMode;
  if (commentInput) commentInput.required = pastCorrection && !absenceMode;
  if (repeatSlots) repeatSlots.hidden = pastCorrection;
  if (adminOption) adminOption.hidden = !pastCorrection;
  syncLessonSourceOptions();

  if (pastCorrection && !editingLesson && normalizeLessonSource(sourceSelect?.value) === "regular") {
    sourceSelect.value = "admin";
    state.lessonSourceTouched = true;
    refreshLessonMakeupEntitlementOptions();
  } else if (!pastCorrection && normalizeLessonSource(sourceSelect?.value) === "admin") {
    sourceSelect.value = suggestedLessonSourceForTicket();
    state.lessonSourceTouched = false;
    refreshLessonMakeupEntitlementOptions();
  }

  if (pastCorrection) {
    $("#lessonModalTitle").textContent = absenceMode ? "지난 수업 사전 불참 보정" : editingLesson ? "지난 수업 완료 처리" : "과거 수업 보정";
    $("#saveLessonButton").textContent = absenceMode ? "불참 보정·차감 안 함" : "완료 반영·횟수 차감";
  } else if ($("#lessonModalTitle") && $("#saveLessonButton")) {
    const completedCorrection = isCompletedLessonCorrectionMode();
    $("#lessonModalTitle").textContent = completedCorrection ? "완료 수업 정정" : editingLesson ? "수업 수정" : "수업 추가";
    $("#saveLessonButton").textContent = completedCorrection ? "완료 이력 수정" : editingLesson ? "수정 저장" : "시간표에 추가";
  }
  return pastCorrection;
}

function syncQuickLessonEntryUi(candidate = getLessonFormCandidate()) {
  const modal = $("#lessonModal");
  const summary = $("#lessonQuickSummary");
  if (!modal || !summary) return;
  const quickMode = state.quickLessonEntry || state.quickLessonEdit;
  const ticket = getSelectedTicket();
  const source = normalizeLessonSource($("#lessonSource")?.value);
  const requiredCount = source === "regular" && !state.quickLessonEntry
    ? Math.max(1, Math.min(3, getTicketWeeklyCount(ticket)))
    : 1;
  const expanded = quickMode && state.quickLessonDetailsExpanded;
  modal.classList.toggle("is-quick-entry", state.quickLessonEntry);
  modal.classList.toggle("is-quick-edit", state.quickLessonEdit);
  modal.classList.toggle("is-quick-expanded", expanded);
  summary.hidden = !quickMode;
  const quickSourcePanel = $("#lessonQuickSourcePanel");
  if (quickSourcePanel) {
    quickSourcePanel.hidden = !state.quickLessonEntry;
    [...quickSourcePanel.querySelectorAll("[data-lesson-quick-source]")].forEach((button) => {
      const active = button.dataset.lessonQuickSource === source;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  const editingLesson = state.quickLessonEdit ? getCurrentEditingLesson() : null;
  const completedCorrection = isCompletedLessonCorrectionMode();
  const pastAbsenceCorrection = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && normalizeLessonSource(editingLesson.lessonSource) === "regular"
    && operationsRole() === "admin"
    && isPastLessonCorrectionMode(candidate)
  );
  const canMarkAbsent = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && normalizeLessonSource(editingLesson.lessonSource) === "regular"
    && operationsRole() === "admin"
  );
  const canCompleteLesson = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && isPastLessonCorrectionMode(candidate)
  );
  if (!canMarkAbsent && state.lessonQuickAction === "absence") state.lessonQuickAction = "schedule";
  if (!canCompleteLesson && state.lessonQuickAction === "record") state.lessonQuickAction = "schedule";
  const absenceFocus = canMarkAbsent && state.lessonQuickAction === "absence";
  const detailsFocus = state.lessonQuickAction === "details";
  if (absenceFocus || detailsFocus) {
    state.quickLessonDetailsExpanded = true;
    modal.classList.add("is-quick-expanded");
  }
  modal.classList.toggle("is-absence-focus", absenceFocus);
  const quickActions = $("#lessonQuickActions");
  if (quickActions) {
    quickActions.hidden = !state.quickLessonEdit || completedCorrection;
    [...quickActions.querySelectorAll("[data-lesson-quick-action]")].forEach((button) => {
      const action = button.dataset.lessonQuickAction;
      button.hidden = false;
      button.disabled = (action === "absence" && !canMarkAbsent)
        || (action === "record" && !canCompleteLesson);
      if (button.disabled) {
        button.title = action === "record"
          ? "수업 시작 시간이 지난 뒤 사용할 수 있습니다."
          : "정규 예정 수업에서 사용할 수 있습니다.";
      } else {
        button.removeAttribute("title");
      }
      button.classList.toggle("is-active", action === state.lessonQuickAction);
      button.setAttribute("aria-pressed", String(action === state.lessonQuickAction));
    });
  }
  if ($("#lessonStatusGuide")) {
    $("#lessonStatusGuide").hidden = !state.quickLessonEdit || completedCorrection;
  }
  if ($("#lessonQuickLabel")) $("#lessonQuickLabel").textContent = state.quickLessonEdit ? "수정 대상" : "선택 시간";
  const scheduleLabel = state.quickLessonEdit && editingLesson
    ? `${getLessonMembersLabel(editingLesson)} · ${editingLesson.day}요일 ${adminScheduleDateLabel(editingLesson.day)} · ${editingLesson.time}`
    : candidate?.day && candidate?.time
      ? `${candidate.day}요일 ${adminScheduleDateLabel(candidate.day)} · ${candidate.time} · ${scheduleCoachDisplayName(getCoachName(candidate.coachId))}`
      : "요일과 시간을 선택해 주세요.";
  if ($("#lessonQuickSchedule")) $("#lessonQuickSchedule").textContent = scheduleLabel;
  if ($("#lessonQuickGuide")) {
    const quickTicketSummary = ticket
      ? `${getTicketDisplayProduct(ticket) || "회원권"} · ${ticketUsageLabel(ticket)} · ${lessonSourceLabel(source)}`
      : "";
    $("#lessonQuickGuide").textContent = state.quickLessonEdit
      ? absenceFocus
        ? "이 수업만 불참으로 바꾸며 횟수는 차감하지 않습니다."
        : completedCorrection
        ? "완료 기록과 피드백은 유지됩니다. 잘못된 코치·요일·시간·수업시간만 바로잡으세요."
        : "요일·시간·코치·수업 길이를 바꾸고 아래에서 적용 범위를 선택하세요."
      : state.quickLessonEntry
        ? quickTicketSummary
          ? source === "regular"
            ? `${quickTicketSummary} · 이 시간을 기준으로 남은 회차까지 자동 등록`
            : `${quickTicketSummary} · 이번 수업 1회만 등록`
          : "회원 이름을 검색하면 회원권과 파트너가 자동으로 연결됩니다."
      : requiredCount > 1
        ? `주 ${requiredCount}회 회원권은 나머지 요일과 시간을 모두 선택해야 합니다.`
        : quickTicketSummary || "회원 검색 후 회원권을 확인하고 저장하세요.";
  }
  if (absenceFocus && pastAbsenceCorrection && $("#lessonQuickGuide")) {
    $("#lessonQuickGuide").textContent = "지난 정규수업을 불참·차감 없음으로 보정하고 보강 신청을 엽니다.";
  }
  const absenceButton = quickActions?.querySelector('[data-lesson-quick-action="absence"]');
  if (absenceButton) {
    absenceButton.textContent = pastAbsenceCorrection ? "지난 불참 보정" : "불참 처리";
  }
  const markAbsentButton = $("#markLessonAbsentButton");
  if (markAbsentButton) {
    markAbsentButton.textContent = pastAbsenceCorrection ? "불참·차감 없음으로 보정" : "불참 처리·보강 열기";
  }
  const toggle = $("#toggleLessonQuickDetails");
  if (toggle) {
    toggle.hidden = state.quickLessonEdit || completedCorrection;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "간단히 보기" : "추가 설정";
  }
  syncLessonEditScopeUi();
}

function syncLessonEditScopeUi() {
  const panel = $("#lessonEditScopePanel");
  if (!panel || panel.hidden || !state.editingLessonId) return;
  const scope = selectedLessonEditScope();
  const count = scope === "series" || scope === "reset"
    ? Math.max(1, matchingRegularLessonSeries().length)
    : 1;
  const impact = $("#lessonEditScopeImpact");
  const saveButton = $("#saveLessonButton");
  const resetStartField = $("#lessonResetStartField");
  const resetStartInput = $("#lessonResetStartOn");

  if (resetStartField) resetStartField.hidden = scope !== "reset";
  if (resetStartInput) resetStartInput.required = scope === "reset";

  if (impact) {
    impact.textContent = scope === "reset"
      ? `완료된 수업은 보존하고 예정된 정규수업 ${count}건을 새 시작일부터 다시 만듭니다.`
      : scope === "series"
      ? `선택한 날짜부터 같은 정규시간 ${count}건을 함께 변경합니다. 완료된 수업은 유지됩니다.`
      : "선택한 수업 1건만 변경하고 나머지 정규일정은 유지합니다.";
  }
  if (saveButton && !isCompletedLessonCorrectionMode()) {
    saveButton.textContent = scope === "reset"
      ? "정규 일정 다시 설정"
      : scope === "series"
        ? "이후 정규일정 저장"
        : "이번 수업만 저장";
  }
}

function syncLessonRecordOutcomeUi() {
  const value = selectedLessonRecordOutcome();
  const noShow = value.startsWith("no_show");
  const deduct = value.endsWith("_deduct");
  const comment = $("#lessonRecordComment");
  const curriculum = $("#lessonRecordCurriculum");
  $("#lessonRecordCommentLabel").textContent = noShow ? "노쇼 사유" : "코치 코멘트";
  comment.placeholder = noShow ? "예: 연락 없이 불참" : "이번 수업에서 확인한 내용과 다음 연습 포인트를 5자 이상 작성해 주세요.";
  comment.minLength = noShow ? 2 : 5;
  curriculum.required = !noShow;
  curriculum.closest("label").hidden = noShow;
  $("#lessonRecordCurriculumLink").hidden = noShow || !$("#lessonRecordCurriculumLink").href;
  $("#saveLessonRecordButton").textContent = `${noShow ? "노쇼" : "완료"} 저장 · ${deduct ? "횟수 차감" : "차감 없음"}`;
}

async function ensureActiveAdminWeekLoaded() {
  if (!state.liveScheduleLoaded || state.liveScheduleLoading || activeAdminWeekIsLoaded()) return false;
  Object.assign(state, {
    liveScheduleLoading: true,
    liveScheduleMessage: "선택한 주의 시간표를 불러오는 중",
  });
  renderSchedule();
  return refreshAdminLiveSchedule({ force: true });
}

async function refreshAdminLiveSchedule(options = {}) {
  const force = options.force === true;
  if (
    adminLiveScheduleRefreshInFlight
    || document.hidden
    || adminHasUnsavedChanges()
    || !adminLiveRefreshViews.has(state.view)
    || !operationsAccessReady()
    || !$("#lessonModal")?.hidden
    || !$("#memberManagementModal")?.hidden
    || (!force && Date.now() - adminLiveScheduleLastRefreshAt < ADMIN_LIVE_REFRESH_STALE_MS)
  ) return false;

  adminLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncAdminLiveData(false, { abortIfDirty: true });
    if (synced) adminLiveScheduleLastRefreshAt = Date.now();
    return synced;
  } finally {
    adminLiveScheduleRefreshInFlight = false;
  }
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function isAdminMobileSchedule() {
  return window.matchMedia?.("(max-width: 760px)").matches ?? window.innerWidth <= 760;
}

function getLessonConflict(candidate) {
  if (!candidate.day || !candidate.time) return { lesson: null, message: "선택 가능한 수업 시간이 없습니다." };
  const candidateInterval = lessonInterval(candidate);
  const breakRule = getCoachBreakOverlapping(candidate.coachId, candidate.day, candidate.time, candidate.durationMinutes)
    || getBreakRuleOverlapping(candidate.day, candidate.time, candidate.durationMinutes, candidate.coachId);
  if (breakRule) {
    return { lesson: null, message: `${candidate.day} ${breakRule.start}~${breakRule.end} ${breakRule.label || "브레이크타임"}과 겹칩니다.` };
  }
  if (!isCoachAvailableForSlot(candidate.coachId, candidate.day, candidate.time, candidate.durationMinutes)) {
    return { lesson: null, message: `${getCoachName(candidate.coachId)} 수업 가능 시간이 아닙니다.` };
  }
  const replacementTicket = !state.editingLessonId
    && normalizeLessonSource(candidate.lessonSource) === "regular"
    ? scheduleTicketById(candidate.ticketId)
    : null;
  const allOverlappingBooked = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .filter((lesson) => (
      String(lesson.id) !== String(candidate.id)
      && !(
        replacementTicket
        && String(lesson.ticketId || "") === String(replacementTicket.id)
        && lessonSourceValue(lesson) === "regular"
        && lessonStatusValue(lesson) === "scheduled"
      )
    ));
  const releasedRegularSlot = allOverlappingBooked.find((lesson) => (
    isReleasedRegularMakeupSlot(lesson) && lesson.coachId === candidate.coachId
  ));
  const restoresReleasedRegularSlot = Boolean(
    releasedRegularSlot
    && normalizeLessonSource(candidate.lessonSource) === "regular"
    && String(releasedRegularSlot.ticketId || "") === String(candidate.ticketId || "")
  );
  const adjustsRegularLessonOnSameDate = isSameDateRegularLessonAdjustment(candidate, releasedRegularSlot);
  if (
    releasedRegularSlot
    && normalizeLessonSource(candidate.lessonSource) !== "makeup"
    && !restoresReleasedRegularSlot
    && !adjustsRegularLessonOnSameDate
  ) {
    return {
      lesson: releasedRegularSlot,
      message: "불참으로 비워진 정규자리입니다. 보강 또는 기존 정규수업의 같은 날 시간조정만 가능합니다.",
    };
  }
  const overlappingBooked = allOverlappingBooked.filter((lesson) => !isReleasedRegularMakeupSlot(lesson));
  const coachConflict = overlappingBooked.find((lesson) => lesson.coachId === candidate.coachId);
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}가 같은 시간에 이미 수업 중입니다.` };
  }
  const courtConflict = overlappingBooked.find((lesson) => lesson.courtId === candidate.courtId);
  const usedCourtIds = new Set(overlappingBooked.map((lesson) => lesson.courtId).filter(Boolean));
  const availableCourt = getCourtOptions().find((court) => !usedCourtIds.has(court.value));
  if (courtConflict && !availableCourt) {
    return { lesson: courtConflict, message: `${getCourtLabel(candidate.courtId)}가 같은 시간에 이미 사용 중입니다.` };
  }
  if (overlappingBooked.length >= fixedCourtCount) {
    return { lesson: overlappingBooked[0], message: `현재 코트 ${fixedCourtCount}개가 모두 사용 중입니다.` };
  }
  return null;
}

function moveScheduleAddButtonFocus(button, key) {
  const current = scheduleAddButtonGridPosition(button);
  if (!current) return false;
  const candidates = [...document.querySelectorAll('.admin-duration-add[data-quick-lesson-entry="true"]')]
    .filter((candidate) => candidate !== button && !candidate.disabled && candidate.offsetParent !== null)
    .map((candidate) => ({ button: candidate, position: scheduleAddButtonGridPosition(candidate) }))
    .filter((candidate) => candidate.position);
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const direction = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
  const aligned = candidates.filter(({ position }) => (
    vertical
      ? position.column === current.column && Math.sign(position.row - current.row) === direction
      : position.row === current.row && Math.sign(position.column - current.column) === direction
  ));
  aligned.sort((left, right) => {
    const leftDistance = vertical
      ? Math.abs(left.position.row - current.row)
      : Math.abs(left.position.column - current.column);
    const rightDistance = vertical
      ? Math.abs(right.position.row - current.row)
      : Math.abs(right.position.column - current.column);
    return leftDistance - rightDistance;
  });
  if (!aligned.length) return false;
  aligned[0].button.focus({ preventScroll: true });
  aligned[0].button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function memberInlineScheduleIsComplete(form, schedules = memberInlineScheduleValues(form)) {
  const product = (adminLiveDataState.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!memberManagementProductSupportsRegularSchedule(product)) return false;
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const requiredCount = memberRegularScheduleFrequency(product, ticket);
  return schedules.length === requiredCount
    && schedules.every((slot) => memberScheduleDayOrder.includes(slot.dayOfWeek) && /^\d{2}:\d{2}$/.test(slot.startTime));
}

function visibleScheduleOpenSlotKeys() {
  return [...document.querySelectorAll("[data-select-schedule-slot]")]
    .map((button) => String(button.dataset.selectScheduleSlot || ""))
    .filter(Boolean);
}

function visibleScheduleLessonSelectionIds() {
  return [...document.querySelectorAll("[data-select-schedule-lesson]")]
    .map((button) => String(button.dataset.selectScheduleLesson || ""))
    .filter(Boolean);
}

function beginScheduleBulkDrag(event, button) {
  if (!state.scheduleBulkMode || event.pointerType === "touch" || event.button !== 0) return;
  const lessonId = String(button.dataset.selectScheduleLesson || "");
  if (!lessonId) return;
  event.preventDefault();
  if (event.shiftKey && selectScheduleLessonRange(lessonId)) {
    state.scheduleBulkSuppressClick = true;
    renderSchedule();
    window.setTimeout(() => {
      state.scheduleBulkSuppressClick = false;
    }, 0);
    return;
  }
  const selecting = !selectedScheduleLessonIdSet().has(lessonId);
  state.scheduleBulkDrag = { selecting, touched: new Set([lessonId]) };
  state.scheduleBulkAnchorLessonId = lessonId;
  setScheduleLessonSelection(lessonId, selecting);
  renderScheduleBulkToolbar();
}

function continueScheduleBulkDrag(event, button) {
  const drag = state.scheduleBulkDrag;
  if (!drag || event.pointerType === "touch" || !(event.buttons & 1)) return;
  const lessonId = String(button.dataset.selectScheduleLesson || "");
  if (!lessonId || drag.touched.has(lessonId)) return;
  drag.touched.add(lessonId);
  setScheduleLessonSelection(lessonId, drag.selecting);
  renderScheduleBulkToolbar();
}

function endScheduleBulkDrag() {
  if (!state.scheduleBulkDrag) return;
  state.scheduleBulkDrag = null;
  state.scheduleBulkSuppressClick = true;
  renderSchedule();
  window.setTimeout(() => {
    state.scheduleBulkSuppressClick = false;
  }, 0);
}

function isRegularScheduleSetup(ticket) {
  return Boolean(
    ticket
    && !state.editingLessonId
    && !state.quickLessonEntry
    && normalizeLessonSource($("#lessonSource")?.value) === "regular"
    && !isPastLessonCorrectionMode(getLessonFormCandidate())
  );
}

function requiredRegularScheduleCount(ticket) {
  if (!isRegularScheduleSetup(ticket)) return 1;
  const weeklyUnits = Math.max(1, getTicketWeeklyCount(ticket));
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const selectedMinutes = Math.max(baseMinutes, Number($("#lessonDuration")?.value) || baseMinutes);
  const unitsPerLesson = Math.max(1, Math.ceil(selectedMinutes / baseMinutes));
  return Math.max(1, Math.min(7, Math.ceil(weeklyUnits / unitsPerLesson)));
}

function getLessonScheduleSlots() {
  const primaryDay = $("#lessonDay").value;
  const primaryTime = $("#lessonTime").value;
  if (isPastLessonCorrectionMode({
    day: primaryDay,
    time: primaryTime,
    durationMinutes: Number($("#lessonDuration").value) || 20,
  })) {
    return [{ day: primaryDay, time: primaryTime }];
  }
  const extraSchedules = $$("[data-lesson-slot-day]")
    .filter((daySelect) => !daySelect.disabled)
    .map((daySelect) => {
      const row = daySelect.closest(".lesson-repeat-slot");
      const timeSelect = row?.querySelector("[data-lesson-slot-time]");
      return { day: daySelect.value, time: timeSelect?.value || "" };
    });
  return [{ day: primaryDay, time: primaryTime }].concat(extraSchedules);
}

function getRegularScheduleValidation(ticket) {
  const editingExistingLesson = Boolean(state.editingLessonId);
  const requiredCount = editingExistingLesson ? 1 : requiredRegularScheduleCount(ticket);
  const slots = getLessonScheduleSlots().slice(0, requiredCount);
  const incompleteSlots = slots.filter((slot) => !slot.day || !slot.time);
  const weeklyUnits = Math.max(1, getTicketWeeklyCount(ticket));
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const selectedMinutes = Math.max(baseMinutes, Number($("#lessonDuration")?.value) || baseMinutes);
  const unitsPerLesson = Math.max(1, Math.ceil(selectedMinutes / baseMinutes));
  const allocatedUnits = requiredCount * unitsPerLesson;
  const weeklyUnitLimit = getTicketWeeklyUnitLimit(ticket);
  const allocationMismatch = !editingExistingLesson
    && !state.quickLessonEntry
    && (allocatedUnits < weeklyUnits || allocatedUnits > weeklyUnitLimit);
  const missingSlotNumbers = slots
    .map((slot, index) => (!slot.day || !slot.time ? index + 1 : null))
    .filter(Boolean);
  return {
    requiredCount,
    slots,
    isRequired: requiredCount > 1,
    incompleteSlots,
    duplicateDay: "",
    weeklyUnits,
    weeklyUnitLimit,
    unitsPerLesson,
    allocatedUnits,
    allocationMismatch,
    valid: incompleteSlots.length === 0 && !allocationMismatch && slots.length === requiredCount,
    message: incompleteSlots.length
      ? `주 ${weeklyUnits}회 이용권입니다. 일정 ${missingSlotNumbers.join(", ")}의 요일과 시간을 선택해 주세요.`
      : allocationMismatch
        ? `${selectedMinutes}분 수업은 ${unitsPerLesson}회분을 사용합니다. 이 회원권은 주 ${weeklyUnits}~${weeklyUnitLimit}회분까지 배정할 수 있습니다.`
        : "",
  };
}

function getTimeOptionsForLessonSlot(day) {
  if (!day) return [{ value: "", label: "시간 선택" }];
  const coachId = $("#lessonCoach").value;
  const durationMinutes = getLessonDurationFromSelectedTicket();
  const sourceTimes = adminManualOverrideEnabled()
    ? getScheduleTimeOptions()
    : getCoachTimeOptions(coachId, day, durationMinutes);
  const timeOptions = sourceTimes.map((time) => ({ value: time, label: time }));
  return timeOptions.length ? timeOptions : [{ value: "", label: "가능 시간 없음" }];
}

function ticketCanBeUsedOnLessonDate(ticket, lessonDate = lessonTicketEligibilityDate()) {
  const ticketState = window.TennisNoteTicketState?.derive(ticket, lessonDate) || "";
  if (ticketState) return ["current", "paused"].includes(ticketState);
  return isCurrentMemberTicket(ticket, lessonDate);
}

async function moveSameDayRegularLessonToSelectedSlot() {
  const targetCandidate = getLessonFormCandidate();
  const context = sameDayRegularAdjustmentContext(targetCandidate);
  const sourceLessonId = $("#lessonSameDayAdjustmentSource")?.value || "";
  const sourceLesson = context?.sourceLessons.find((lesson) => String(lesson.id) === sourceLessonId);
  const sourceTicket = getTicketByLesson(sourceLesson);
  if (!context || !sourceLesson || !sourceTicket) {
    setLessonFormMessage("같은 날짜에 옮길 기존 정규수업을 선택해 주세요.", "danger");
    return;
  }
  const sourceDate = sourceLesson.lessonDate || adminWeekDateForDay(sourceLesson.day);
  if (sourceDate !== context.lessonDate) {
    setLessonFormMessage("당일 시간조정은 같은 날짜 안에서만 가능합니다.", "danger");
    return;
  }

  const target = {
    day: targetCandidate.day,
    time: targetCandidate.time,
    coachId: targetCandidate.coachId,
    courtId: targetCandidate.courtId,
  };
  state.editingLessonId = sourceLesson.id;
  state.quickLessonEntry = false;
  state.quickLessonEdit = true;
  state.quickLessonDetailsExpanded = false;
  state.releasedAbsenceEntitlementId = "";
  state.pinnedLessonTicketId = "";
  state.pinnedLessonRepeatSlots = [];
  state.lessonSourceTouched = true;
  state.lessonOperationKey = createAdminOperationKey("same-day-regular-adjustment");
  $("#lessonRepeatSlots").innerHTML = "";
  const memberName = getLessonParticipantNames(sourceLesson)[0] || context.memberName;
  $("#lessonMemberSearch").value = memberName;
  refreshLessonMemberOptions(memberName, sourceLesson);
  $("#lessonMember").value = memberName;
  $("#lessonCoach").value = target.coachId;
  refreshLessonTicketOptions();
  $("#lessonTicket").value = sourceTicket.id;
  $("#lessonSource").value = "regular";
  $("#lessonDuration").value = String(sourceLesson.durationMinutes || 20);
  $("#lessonDay").value = target.day;
  $("#lessonTime").value = target.time;
  $("#lessonCourt").value = target.courtId;
  const singleScope = document.querySelector('input[name="lessonEditScope"][value="single"]');
  if (singleScope) singleScope.checked = true;
  renderLessonPreview();
  await addLessonFromForm({ preventDefault() {} });
}

function selectedAdminMakeupEntitlement() {
  const entitlementId = $("#lessonMakeupEntitlement")?.value || "";
  return openAdminMakeupEntitlements().find((item) => item.id === entitlementId) || null;
}

function autoAssignOpenLessonSlot() {
  const durationMinutes = Number($("#lessonDuration").value);
  const day = $("#lessonDay").value;
  const time = $("#lessonTime").value;
  if (!day || !time) return;
  const pinnedTicket = tickets.find((ticket) => String(ticket.id) === String(state.pinnedLessonTicketId || ""));
  if (pinnedTicket) {
    const pinnedMemberName = ticketParticipantNames(pinnedTicket)[0] || splitMemberNames(pinnedTicket.member)[0] || "";
    if (pinnedMemberName && [...$("#lessonMember").options].some((option) => option.value === pinnedMemberName)) {
      $("#lessonMember").value = pinnedMemberName;
    }
    if ([...$("#lessonCoach").options].some((option) => option.value === pinnedTicket.coachId)) {
      $("#lessonCoach").value = pinnedTicket.coachId;
    }
    $("#lessonCourt").value = getAvailableCourtId(day, time, durationMinutes);
    return;
  }
  $("#lessonCoach").value = getAvailableCoachId(day, time, durationMinutes, $("#lessonCoach").value);
  $("#lessonCourt").value = getAvailableCourtId(day, time, durationMinutes);
  ensureMemberHasCoachTicket();
}

function getLessonFormCandidate(overrides = {}) {
  const day = overrides.day || $("#lessonDay").value;
  const durationMinutes = Number($("#lessonDuration").value);
  const selectedTicket = getSelectedTicket();
  const participantNames = ticketParticipantNames(selectedTicket);
  const displayedLessonDate = overrides.lessonDate || adminLessonDateForCandidate(day);
  const lessonDate = !state.editingLessonId && normalizeLessonSource($("#lessonSource").value) === "regular"
    ? firstEligibleScheduleDateForTicket(selectedTicket, day, displayedLessonDate) || displayedLessonDate
    : displayedLessonDate;
  syncLessonTypeFromForm();
  return {
    id: state.editingLessonId || Date.now(),
    day,
    lessonDate,
    time: $("#lessonTime").value,
    courtId: $("#lessonCourt").value,
    coachId: $("#lessonCoach").value,
    member: participantNames.length ? participantNames.join("&") : $("#lessonMember").value,
    ticketId: selectedTicket?.id || "",
    type: getLessonTypeFromForm(),
    lessonSource: normalizeLessonSource($("#lessonSource").value),
    durationMinutes,
    status: $("#lessonType").value === "보강 가능" ? "available" : "scheduled",
    ...overrides,
  };
}

function clearLessonSaveResultPanel() {
  const target = $("#lessonSaveResultPanel");
  if (!target) return;
  target.hidden = true;
  target.className = "lesson-save-result-panel";
  target.innerHTML = "";
}

function adminLessonEndTimestamp(candidate = {}) {
  const lessonDate = candidate.lessonDate || adminWeekDateForDay(candidate.day || $("#lessonDay")?.value);
  const lessonTime = candidate.time || $("#lessonTime")?.value;
  const durationMinutes = Number(candidate.durationMinutes || $("#lessonDuration")?.value) || 20;
  if (!lessonDate || !lessonTime) return Number.NaN;
  const startTimestamp = new Date(`${lessonDate}T${lessonTime}:00`).getTime();
  return startTimestamp + durationMinutes * 60 * 1000;
}

function isCompletedLessonCorrectionMode() {
  const editingLesson = getCurrentEditingLesson();
  const correctingAsAbsence = document.querySelector('input[name="lessonPastCorrectionMode"]:checked')?.value === "absence";
  return Boolean(
    state.liveScheduleLoaded
    && operationsRole() === "admin"
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "completed"
    && !correctingAsAbsence
  );
}

function pastLessonCorrectionMode() {
  return document.querySelector('input[name="lessonPastCorrectionMode"]:checked')?.value === "absence"
    ? "absence"
    : "complete";
}

function selectedLessonEditScope() {
  const value = document.querySelector('input[name="lessonEditScope"]:checked')?.value;
  return value === "series" || value === "reset" ? value : "single";
}

function selectedLessonRecordOutcome() {
  return document.querySelector('input[name="lessonRecordOutcome"]:checked')?.value || "completed_deduct";
}

function installAdminLiveScheduleRefresh() {
  if (adminLiveScheduleRefreshTimer) return;
  const refresh = () => refreshAdminLiveSchedule().catch(() => false);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  renderCustomLessonColorRules();
  adminLiveScheduleRefreshTimer = window.setInterval(refresh, ADMIN_LIVE_REFRESH_INTERVAL_MS);
}

function lessonTicketCanBeSelected(ticket, lessonDate = lessonTicketEligibilityDate()) {
  if (state.editingLessonId) return ticketCanBeUsedOnLessonDate(ticket, lessonDate);
  const day = $("#lessonDay")?.value || currentScheduleDay();
  return ticketCanBeUsedOnLessonDate(ticket, lessonDate)
    || ticketCanBeScheduledOnOrAfterDate(ticket, day, lessonDate);
}

function syncLessonModalWeekToSelectedTicket() {
  if (state.editingLessonId) return false;
  const ticket = scheduleTicketById($("#lessonTicket")?.value);
  const day = $("#lessonDay")?.value || currentScheduleDay();
  const displayedDate = adminWeekDateForDay(day);
  const targetDate = firstEligibleScheduleDateForTicket(ticket, day, displayedDate);
  if (!targetDate || targetDate === displayedDate) return false;
  state.activeAdminWeekIndex = Math.min(
    Math.max(adminWeekOffsetForDate(targetDate), adminScheduleMinWeekOffset),
    adminScheduleMaxWeekOffset,
  );
  state.selectedScheduleDay = day;
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
  setLessonFormMessage(`시작 예정 회원권이라 ${memberDetailDateLabel(targetDate)} 주차로 이동했습니다.`, "good");
  return true;
}
