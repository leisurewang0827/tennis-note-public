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
