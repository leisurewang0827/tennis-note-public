// 공통 입력 폼의 항목과 표시를 서로 맞추는 함수들.
//
// 선택지 목록을 다시 채우고 필드를 보이거나 숨긴다. 서버는 부르지 않는다.
// 관리자에서 sync*/refresh* 는 대부분 서버가 아니라 이 일을 한다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function ensureOperationProfiles() {
  if (!operationProfiles.length) {
    operationProfiles.push(createOperationProfile("기본 운영"));
  }
  if (!operationProfiles.some((profile) => profile.id === activeOperationProfileId)) {
    activeOperationProfileId = operationProfiles[0].id;
  }
  const fallbackBranch = defaultOperationBranch();
  if (fallbackBranch) {
    operationProfiles.forEach((profile) => {
      if (profile.branchId) return;
      profile.branchId = fallbackBranch.id;
      profile.branchName = fallbackBranch.name;
    });
  }
  Object.entries(activeOperationProfileIdsByBranch).forEach(([branchId, profileId]) => {
    const profile = operationProfiles.find((item) => (
      String(item.id) === String(profileId)
      && String(item.branchId || "") === String(branchId)
    ));
    if (!profile) delete activeOperationProfileIdsByBranch[branchId];
  });
  const globalActiveProfile = operationProfiles.find((profile) => profile.id === activeOperationProfileId);
  [...new Set(operationProfiles.map((profile) => String(profile.branchId || "")).filter(Boolean))]
    .forEach((branchId) => {
      if (activeOperationProfileIdsByBranch[branchId]) return;
      const fallbackProfile = String(globalActiveProfile?.branchId || "") === branchId
        ? globalActiveProfile
        : operationProfiles.find((profile) => String(profile.branchId || "") === branchId);
      if (fallbackProfile) activeOperationProfileIdsByBranch[branchId] = fallbackProfile.id;
    });
}

async function persistOperationProfileWorkspace(backup, successMessage) {
  saveSnapshot();
  const synced = await syncLiveSchedulePolicyToServer();
  if (synced !== "server") {
    restoreOperationProfileWorkspace(backup);
    if (synced === "conflict") await loadLiveSchedulePolicyFromServer();
    saveSnapshot();
    renderAll();
    showToast(synced === "conflict"
      ? "다른 화면에서 설정이 변경되어 최신 운영 프로필을 다시 불러왔습니다."
      : "서버 저장에 실패해 이전 운영 프로필로 되돌렸습니다.");
    return false;
  }
  saveSnapshot();
  renderAll();
  showToast(successMessage);
  return true;
}

async function syncPopupNoticeFromServer() {
  const client = liveNoticeReadClient();
  if (!client?.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_notice_popups", {
      select: "id,title,body,audience,priority,status,starts_on,ends_on,show_once_per_day,display_order,image_url,image_storage_path,image_alt,action_label,action_url,created_at,updated_at",
      limit: 100,
    });
    const notices = (rows || [])
      .map((row) => noticeRowToAppNotice(row))
      .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const shared = loadSharedData();
    if (!notices.length) {
      shared.notices = [];
      shared.noticeSource = "server";
      saveSharedData(shared);
      renderNoticePopupSettings();
      renderDashboardNoticeSummary();
      return true;
    }
    shared.notices = notices.slice(0, 100);
    shared.noticeSource = "server";
    saveSharedData(shared);
    renderNoticePopupSettings();
    renderDashboardNoticeSummary();
    return true;
  } catch (error) {
    return false;
  }
}

function syncSharedPaymentRequests() {
  if (!adminDemoMode) return;
  const shared = loadSharedData();
  const incomingRequests = shared.paymentRequests || [];
  let added = 0;
  incomingRequests.forEach((request) => {
    const paymentId = request.paymentId || `${request.member}-${request.productId}-${request.requestedAt}`;
    if (!paymentId || billings.some((billing) => billing.providerPaymentId === paymentId)) return;
    const { status, statusLabel } = billingStatusFromSharedPayment(request);
    billings.unshift({
      member: request.member || "회원앱 요청",
      item: request.productTitle || request.productId || "회원권 구매",
      amount: moneyFromLabel(request.amountLabel),
      method: request.method || "회원앱",
      status,
      statusLabel,
      providerPaymentId: paymentId,
      requestedAt: request.requestedAt || new Date().toISOString(),
      source: "회원앱",
    });
    added += 1;
  });
  if (added) billingLogs.unshift(`회원앱 결제 요청 ${added}건 관리자 결제/정산 화면으로 가져옴`);
}

async function persistPolicyVersions(message) {
  reflectHoldingPolicyInActiveVersion();
  reflectRefundPolicyInActiveVersion();
  reflectLessonPoliciesInActiveVersion();
  saveSnapshot();
  renderPolicyVersionSettings();
  const target = await syncPolicyVersionsToServer();
  showToast(target === "server" ? `${message} · 서버 저장 완료` : target === "blocked" ? `${message} · 서버 저장 확인 필요` : `${message} · 로컬 저장 완료`);
}

async function loadNotificationPolicyFromServer() {
  const client = liveNoticeClient();
  if (!client?.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: notificationPolicyKey },
      limit: 1,
    });
    if (rows?.[0]?.value) {
      Object.assign(notificationPolicySettings, normalizeNotificationPolicy({
        ...rows[0].value,
        updatedAt: rows[0].value.updatedAt || rows[0].updated_at,
      }));
      saveSnapshot();
    }
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return true;
  } catch {
    return false;
  }
}

function syncOnsitePaymentSourceTickets(options = {}) {
  const select = $("#onsitePaymentSourceTicket");
  if (!select) return;
  const previousValue = select.value;
  const sourceTickets = onsitePaymentSourceTickets();
  select.innerHTML = `
    <option value="">첫 회원권 등록</option>
    ${sourceTickets.map((ticket) => `<option value="${escapeHtml(ticket.serverTicketId)}">기존 회원권 연장 · ${escapeHtml(onsitePaymentTicketLabel(ticket))}</option>`).join("")}`;
  if (options.preserveEmpty && previousValue === "") select.value = "";
  else if (sourceTickets.some((ticket) => ticket.serverTicketId === previousValue)) select.value = previousValue;
  else select.value = sourceTickets[0]?.serverTicketId || "";
  const selectedTicket = sourceTickets.find((ticket) => ticket.serverTicketId === select.value) || null;
  if ($("#onsitePaymentTitle")) $("#onsitePaymentTitle").textContent = selectedTicket ? "회원권 연장·결제 등록" : "첫 회원권·결제 등록";
  const submitButton = $("#onsitePaymentForm button[type='submit']");
  if (submitButton) submitButton.textContent = selectedTicket ? "연장과 결제 함께 저장" : "회원권과 결제 함께 저장";
  const matchingProduct = onsitePaymentProducts().find(({ server }) => String(server.id) === String(selectedTicket?.productId || ""));
  if (matchingProduct && $("#onsitePaymentProduct")) $("#onsitePaymentProduct").value = String(matchingProduct.server.id);
  syncOnsitePaymentCoaches();
  updateOnsitePaymentAmount();
  syncOnsitePaymentScheduleChoice();
}

function syncSameDayRegularAdjustmentPanel(candidate = getLessonFormCandidate()) {
  const panel = $("#lessonSameDayAdjustmentPanel");
  const select = $("#lessonSameDayAdjustmentSource");
  const guide = $("#lessonSameDayAdjustmentGuide");
  const button = $("#moveSameDayRegularLessonButton");
  if (!panel || !select || !guide || !button) return;
  const context = sameDayRegularAdjustmentContext(candidate);
  panel.hidden = !context || !context.memberName;
  if (panel.hidden) {
    select.innerHTML = "";
    return;
  }
  const options = context.sourceLessons.map((lesson) => ({
    value: String(lesson.id),
    label: `${lesson.time} · ${getLessonMembersLabel(lesson)} · ${getCoachName(lesson.coachId)}`,
  }));
  fillSelect(select, options.length ? options : [{ value: "", label: "같은 날 옮길 정규수업 없음" }]);
  button.disabled = !options.length;
  guide.textContent = options.length
    ? `${context.memberName} 회원의 기존 정규수업을 선택한 ${candidate.time} 시간으로 옮깁니다. 회차는 추가 차감하지 않습니다.`
    : `${context.memberName} 회원의 같은 날짜 정규수업을 찾지 못했습니다. 보강 예약이라면 등록 구분을 보강으로 유지하세요.`;
}

function syncAdminManualOverrideUi(warnings = []) {
  const panel = $("#lessonAdminOverridePanel");
  const details = $("#lessonAdminOverrideDetails");
  const list = $("#lessonAdminOverrideWarnings");
  if (!panel || !details || !list) return;
  const available = adminManualOverrideAvailable();
  const enabled = adminManualOverrideEnabled();
  panel.hidden = !available;
  details.hidden = !enabled;
  list.innerHTML = (warnings.length ? warnings : ["감지된 정책 충돌은 없지만 강제 처리 사실은 기록됩니다."])
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
}

async function verifyRefundAdminInputs({ requireReason = true } = {}) {
  const reason = $("#refundReason")?.value.trim() || "";
  const confirmation = $("#refundConfirmationText")?.value.trim() || "";
  const pin = $("#refundAdminPin")?.value.trim() || "";
  if (requireReason && reason.length < 2) {
    refundFlowState.message = "환불 사유를 2자 이상 입력해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (confirmation !== "환불") {
    refundFlowState.message = "최종 확인란에 환불을 입력해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (adminPinNeedsSetup()) {
    refundFlowState.message = "먼저 설정의 보안/잠금에서 관리자 PIN을 설정해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (!(await verifyAdminPin(pin))) {
    refundFlowState.message = "관리자 PIN이 맞지 않습니다.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (refundFlowState.preview?.requiresPolicyFallbackConfirmation && !$("#acceptRefundPolicyFallback")?.checked) {
    refundFlowState.message = "현재 정책 기준 계산 확인란을 체크해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  return { reason, confirmation };
}

function loadBreakFavorite(favoriteId) {
  const favorite = scheduleSettings.breakFavorites.find((item) => item.id === favoriteId);
  if (!favorite) return;
  state.editingBreakRuleId = "";
  $$('[data-break-day]').forEach((input) => { input.checked = favorite.days.includes(input.value); });
  const coachRoleIds = Array.isArray(favorite.coachRoleIds) ? favorite.coachRoleIds : [];
  $$('[data-break-coach]').forEach((input) => { input.checked = !coachRoleIds.length || coachRoleIds.includes(input.value); });
  if ($("#breakStartInput")) $("#breakStartInput").value = favorite.start;
  if ($("#breakEndInput")) $("#breakEndInput").value = favorite.end;
  if ($("#breakLabelInput")) $("#breakLabelInput").value = favorite.label || "브레이크";
  if ($("#applyBreakRuleButton")) $("#applyBreakRuleButton").textContent = "브레이크 추가";
  $("#breakStartInput")?.focus();
}

function syncBranchSalesDraftFromForm() {
  branchSalesSettingsState.draftConfig = branchSalesConfigFromForm();
  renderBranchSalesPreview();
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function adminStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || value || "";
}

function requestAdminActionUnlock(action, label, afterUnlock) {
  if (!isAdminLockActive() || !adminLockSettings.pastAbsenceRequirePinEveryTime) return true;
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("보안/잠금에서 관리자 PIN을 먼저 설정해 주세요");
    return false;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = action;
  adminLockSession.pendingLabel = label;
  adminLockSession.error = "";
  adminLockSession.afterUnlock = typeof afterUnlock === "function" ? afterUnlock : null;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
  return false;
}

function requestAdminUnlock(view, afterUnlock = null) {
  if (!isAdminLockActive() || !adminLockSettings.lockedViews.includes(view)) return true;
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    if (view === "settings") return true;
    setView("settings", { skipLock: true });
    renderSettingsTabs();
    showToast("먼저 보안/잠금에서 관리자 PIN을 설정해 주세요");
    return false;
  }
  if (!isAdminViewLocked(view) || isAdminUnlocked()) return true;
  adminLockSession.pendingView = view;
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = typeof afterUnlock === "function" ? afterUnlock : null;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
  return false;
}

function flushSnapshotSave() {
  if (adminSnapshotSaveHandle) {
    if (typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(adminSnapshotSaveHandle);
    } else {
      window.clearTimeout(adminSnapshotSaveHandle);
    }
  }
  adminSnapshotSaveHandle = 0;
  adminSnapshotSaveQueued = false;
  return writeSnapshotNow();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function getAvailableCourtId(day, time, durationMinutes = 20) {
  const usedCourts = new Set(getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson))
    .map((lesson) => lesson.courtId));
  return getCourtOptions().find((court) => !usedCourts.has(court.value))?.value || getCourtOptions()[0]?.value || "court-1";
}

function moveAdminToolPanel(selector, targetId) {
  const panel = $(selector);
  const target = $(`#${targetId}`);
  if (!panel || !target) return;
  panel.removeAttribute("data-settings-panel");
  panel.removeAttribute("hidden");
  panel.querySelector(":scope > .setting-help")?.remove();
  target.append(panel);
}

function organizeAdminTools() {
  if (document.body.dataset.adminToolsOrganized === "true") return;
  document.body.dataset.adminToolsOrganized = "true";

  moveAdminToolPanel("#dataView .data-import-panel", "dataToolsModalContent");
  moveAdminToolPanel("#dataView .data-export-panel", "dataToolsModalContent");
  $("#settingsView .service-readiness-panel")?.remove();
  $("#settingsView .payment-setup-panel")?.remove();
  $("#dataToolsModalContent .import-step-grid")?.remove();
  $("#dataView")?.remove();

  [".access-policy-panel", ".coach-role-flow-panel", ".policy-guide-panel"].forEach((selector) => {
    $(`#settingsView ${selector}`)?.remove();
  });
  $$('#settingsView [data-settings-panel="live"]').forEach((panel) => panel.remove());

  [".policy-version-panel", ".holding-policy-panel", ".refund-policy-panel"].forEach((selector) => {
    const panel = $(`#settingsView ${selector}`);
    if (panel) panel.dataset.settingsPanel = "membership";
  });
  $$('[data-admin-tool-panel]').forEach((panel) => panel.setAttribute("hidden", ""));
}

function getSearchText() {
  return ($("#globalSearch").value || "").trim().toLowerCase();
}

function clearGlobalSearch() {
  const input = $("#globalSearch");
  if (input) input.value = "";
  renderGlobalSearchResults();
}

async function prepareAuthProviderSwitch(userId, button) {
  const fromProvider = document.querySelector(`[data-auth-switch-from="${userId}"]`)?.value || "";
  const targetProvider = document.querySelector(`[data-auth-switch-target="${userId}"]`)?.value || "";
  if (!fromProvider || !targetProvider) {
    showToast("현재 로그인과 변경할 로그인을 선택해 주세요.");
    return;
  }
  const message = `${authProviderLabel(fromProvider)} 로그인을 ${authProviderLabel(targetProvider)} 로그인으로 변경 준비할까요?\n\n회원이 24시간 안에 새 수단으로 로그인하면 기존 연결이 자동 해제됩니다.`;
  if (!window.confirm(message)) return;
  await invokeAdminAccountControl({
    action: "prepare_auth_provider_switch",
    userId,
    fromProvider,
    targetProvider,
  }, button, `${authProviderLabel(targetProvider)} 로그인 변경 대기를 시작했습니다.`);
}

async function unlinkAuthProvider(userId, provider, button) {
  const label = authProviderLabel(provider) || provider;
  if (!window.confirm(`${label} 로그인 연결을 해제할까요?\n\n다른 로그인 수단은 유지되고 과거 회원·수업 기록은 삭제되지 않습니다.`)) return;
  await invokeAdminAccountControl({
    action: "unlink_auth_provider",
    userId,
    provider,
  }, button, `${label} 로그인 연결을 해제했습니다.`);
}

function scheduleAccountDeletionRetryRefresh(requests) {
  if (accountDeletionRetryTimer) window.clearTimeout(accountDeletionRetryTimer);
  accountDeletionRetryTimer = 0;
  const now = Date.now();
  const nextRetryAt = (requests || [])
    .filter((request) => request.status === "processing")
    .map((request) => Date.parse(request.executionStartedAt || "") + ACCOUNT_DELETION_STALE_MS)
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((left, right) => left - right)[0];
  if (!nextRetryAt) return;
  accountDeletionRetryTimer = window.setTimeout(() => {
    accountDeletionRetryTimer = 0;
    loadServerAccountDeletionRequests();
  }, Math.max(250, nextRetryAt - now + 250));
}

function memberCreateStepIsValid(step) {
  const panel = $(`#memberManagementForm [data-member-create-panel="${step}"]`);
  if (!panel) return true;
  const controls = [...panel.querySelectorAll("input, select, textarea")].filter((control) => !control.disabled);
  const invalid = controls.find((control) => !control.checkValidity());
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
}

function memberManagementSelectedDays(form) {
  return [...form.querySelectorAll('input[name="lessonDays"]:checked:not(:disabled)')]
    .map((input) => Number(input.value))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function memberManagementDatabasePayload(form, member, ticket, reason) {
  const record = memberDatabaseRecord(member, ticket);
  const hasControl = (name) => Boolean(form.elements.namedItem(name));
  const product = (adminLiveDataState.products || []).find((item) => item.id === (form.elements.productId?.value || ticket?.productId));
  const ticketCancelledFromInlineEditor = Boolean(ticket && hasControl("productId") && !form.elements.productId.value);
  const ticketStatus = ticketCancelledFromInlineEditor
    ? "expired"
    : form.elements.ticketStatus?.value || ticket?.status || (ticket ? "active" : "");
  const recordStatus = ticketStatus === "expired"
    ? "historical"
    : form.elements.recordStatus?.value || record?.record_status || (ticket || form.elements.productId ? "active" : "pending");
  return {
    userId: member?.serverUserId || null,
    ticketId: ticket?.serverTicketId || null,
    productId: form.elements.productId?.value || ticket?.productId || null,
    branchId: record?.branch_id || ticket?.branchId || product?.branch_id || null,
    name: form.elements.memberName?.value.trim() || member?.name || "",
    nickname: hasControl("memberNickname") ? form.elements.memberNickname.value.trim() : member?.nickname || "",
    phone: hasControl("memberPhone") ? form.elements.memberPhone.value.trim() : member?.phone || "",
    birthYear: hasControl("memberBirthYear") ? memberManagementNullableNumber(form.elements.memberBirthYear) : member?.birthYear || null,
    neighborhood: hasControl("memberNeighborhood") ? form.elements.memberNeighborhood.value.trim() : member?.neighborhood || "",
    gender: hasControl("memberGender") ? form.elements.memberGender.value || null : member?.gender || null,
    dominantHand: hasControl("memberDominantHand") ? form.elements.memberDominantHand.value || null : member?.dominantHand || null,
    backhandStyle: hasControl("memberBackhandStyle") ? form.elements.memberBackhandStyle.value || null : member?.backhandStyle || null,
    tennisStartedOn: hasControl("memberTennisStartedOn") ? form.elements.memberTennisStartedOn.value || null : member?.tennisStartedOn || null,
    selfNtrp: hasControl("memberSelfNtrp") ? memberManagementNullableNumber(form.elements.memberSelfNtrp) : member?.selfNtrp || null,
    coachNtrp: hasControl("memberCoachNtrp") ? memberManagementNullableNumber(form.elements.memberCoachNtrp) : member?.coachNtrp || null,
    tennisGoal: hasControl("memberTennisGoal") ? form.elements.memberTennisGoal.value.trim() : member?.tennisGoal || "",
    playStyleMemo: hasControl("memberPlayStyleMemo") ? form.elements.memberPlayStyleMemo.value.trim() : member?.playStyleMemo || "",
    coachRoleId: form.elements.coachRoleId?.value || record?.coach_role_id || ticket?.coachRoleId || null,
    scheduleScope: form.elements.scheduleScope?.value || record?.lesson_schedule_scope || ticket?.scheduleScope || null,
    weeklyFrequency: hasControl("weeklyFrequency")
      ? memberManagementNullableNumber(form.elements.weeklyFrequency)
      : record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? null,
    lessonType: form.elements.lessonType?.value || record?.lesson_type || ticket?.lessonTypeCode || "one_on_one",
    lessonDays: hasControl("lessonDays")
      ? memberManagementSelectedDays(form)
      : record?.lesson_days || ticket?.lessonDays || [],
    startsOn: form.elements.startsOn?.value || record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || null,
    expiresOn: form.elements.expiresOn?.value || ticket?.expires || null,
    totalSessions: hasControl("totalSessions") ? memberManagementNullableNumber(form.elements.totalSessions) : record?.total_sessions ?? ticket?.total ?? null,
    usedSessions: hasControl("usedSessions") ? memberManagementNullableNumber(form.elements.usedSessions) : record?.used_sessions ?? ticket?.used ?? null,
    remainingSessions: hasControl("remainingSessions") ? memberManagementNullableNumber(form.elements.remainingSessions) : record?.remaining_sessions ?? ticket?.remaining ?? null,
    paymentDate: hasControl("paymentDate") ? form.elements.paymentDate.value || null : record?.payment_recorded_on || null,
    paymentMethod: hasControl("paymentMethod") ? form.elements.paymentMethod.value || null : record?.payment_method || null,
    paymentAmount: hasControl("paymentAmount") ? memberManagementNullableNumber(form.elements.paymentAmount) : record?.payment_amount ?? null,
    paymentRecordState: hasControl("paymentRecordState")
      ? form.elements.paymentRecordState.value || null
      : memberPaymentRecordState(record),
    existingPaymentId: hasControl("existingPaymentId") ? form.elements.existingPaymentId.value || null : null,
    note: hasControl("note") ? form.elements.note.value.trim() || null : record?.admin_note || null,
    partnerUserId: hasControl("partnerUserId")
      ? form.elements.partnerUserId.disabled ? null : form.elements.partnerUserId.value || null
      : memberTicketPartnerUserId(ticket, member) || null,
    partnerMode: hasControl("partnerMode") ? form.elements.partnerMode.value : null,
    partnerName: hasControl("partnerName") ? form.elements.partnerName.value.trim() : null,
    partnerPhone: hasControl("partnerPhone") ? form.elements.partnerPhone.value.trim() : null,
    partnerBirthYear: hasControl("partnerBirthYear") ? memberManagementNullableNumber(form.elements.partnerBirthYear) : null,
    partnerGender: hasControl("partnerGender") ? form.elements.partnerGender.value || null : null,
    ticketStatus: ticketStatus || null,
    recordStatus,
    reason,
    expectedTicketUpdatedAt: hasControl("expectedTicketUpdatedAt")
      ? form.elements.expectedTicketUpdatedAt.value || ticket?.serverUpdatedAt || null
      : ticket?.serverUpdatedAt || null,
    applyToFutureSchedule: hasControl("applyToFutureSchedule")
      ? form.elements.applyToFutureSchedule.value === "true"
      : false,
    changeBatchId: form.dataset.changeBatchId || null,
    changeSource: "admin_web",
    createWithoutSchedule: hasControl("createWithoutSchedule")
      ? form.elements.createWithoutSchedule.value === "true"
      : true,
  };
}

function memberInlineInitialValue(control) {
  if (control instanceof HTMLSelectElement) {
    return control.querySelector("option[selected]")?.value ?? control.options[0]?.value ?? "";
  }
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    return String(control.defaultChecked);
  }
  return String(control.defaultValue ?? "");
}

function memberInlineChangeSummary(form) {
  const member = members.find((item) => item.id === Number(form?.dataset.memberInlineForm));
  const ticket = [...tickets, ...expiredTickets]
    .find((item) => String(item.serverTicketId || "") === String(form?.dataset.ticketId || ""));
  const labels = {
    memberName: "이름",
    memberPhone: "연락처",
    memberBirthYear: "출생연도",
    memberNeighborhood: "거주동",
    memberGender: "성별",
    productId: "회원권",
    coachRoleId: "담당 코치",
    partnerUserId: "파트너",
    startsOn: "시작일",
    expiresOn: "만료일",
    totalSessions: "총 횟수",
    usedSessions: "소진 횟수",
    paymentRecordState: "결제 구분",
    paymentDate: "결제일",
    paymentMethod: "결제수단",
    paymentAmount: "결제금액",
    note: "비고",
    scheduleDay1: "정규시간",
    scheduleDay2: "정규시간",
    scheduleDay3: "정규시간",
    scheduleTime1: "정규시간",
    scheduleTime2: "정규시간",
    scheduleTime3: "정규시간",
  };
  const changed = [...(form?.elements || [])]
    .filter((control) => control.name && labels[control.name] && String(control.value) !== memberInlineInitialValue(control))
    .map((control) => labels[control.name]);
  const ticketLabel = ticket ? ` · ${getTicketDisplayProduct(ticket) || ticket.product || "회원권"}` : "";
  return `${member?.name || "회원"}${ticketLabel}: ${[...new Set(changed)].join(", ") || "입력값"}`;
}

function memberInlineDraft(form) {
  return {
    memberId: Number(form?.dataset.memberInlineForm) || 0,
    ticketId: String(form?.dataset.ticketId || ""),
    values: Object.fromEntries(memberInlineDraftFieldNames
      .map((name) => [name, form?.elements?.[name]?.value])
      .filter(([, value]) => value !== undefined)),
  };
}

function memberInlineCoachChanged(form) {
  if (!form?.dataset.ticketId) return false;
  return String(form.elements.coachRoleId?.value || "") !== String(form.dataset.initialCoachRoleId || "");
}

function scheduleClipboardDefaults(button) {
  return scheduleClipboardDefaultsForSlot(
    button.dataset.addLessonDay,
    button.dataset.addLessonTime,
    button.dataset.addLessonCoach,
  );
}

function adminManualOverrideEnabled() {
  return adminManualOverrideAvailable() && Boolean($("#lessonAdminOverride")?.checked);
}

function sameDayRegularAdjustmentContext(candidate = getLessonFormCandidate()) {
  if (operationsRole() !== "admin" || state.editingLessonId || !state.quickLessonEntry) return null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const releasedSlot = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .find((lesson) => lesson.coachId === candidate.coachId && isReleasedRegularMakeupSlot(lesson));
  if (!lessonDate || !releasedSlot) return null;
  const memberName = $("#lessonMember")?.value || "";
  const sourceLessons = memberName ? lessons.filter((lesson) => (
    lesson.serverLessonId
    && lessonSourceValue(lesson) === "regular"
    && isLessonEditableScheduled(lesson)
    && String(lesson.id) !== String(releasedSlot.id)
    && (lesson.lessonDate || adminWeekDateForDay(lesson.day)) === lessonDate
    && getLessonParticipantNames(lesson).includes(memberName)
  )).sort((left, right) => String(left.time || "").localeCompare(String(right.time || ""))) : [];
  return { lessonDate, releasedSlot, memberName, sourceLessons };
}

function oneDayBookingFormValues() {
  return {
    bookingId: state.editingOneDayBookingId || null,
    guestName: $("#oneDayGuestName")?.value.trim() || "",
    guestPhone: $("#oneDayGuestPhone")?.value.trim() || "",
    coachId: $("#oneDayCoach")?.value || "",
    bookingDate: $("#oneDayDate")?.value || "",
    time: $("#oneDayTime")?.value || "",
    durationMinutes: Number($("#oneDayDuration")?.value || 20),
    status: $("#oneDayStatus")?.value || "reserved",
    note: $("#oneDayNote")?.value.trim() || "",
  };
}

function newRefundIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `refund:${value}`;
}

function newPaymentCancelIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cancel:${value}`;
}

function ticketReviewState(ticket) {
  return window.TennisNoteTicketState?.derive(ticket) || ticket?.status || "unknown";
}

function adminCurriculumChoices() {
  const refs = (adminLiveDataState.curriculumRefs || []).filter((item) => item.status === "active");
  const catalogSteps = window.TennisNoteCurriculumCatalog?.steps || [];
  const choices = catalogSteps.map((step) => {
    const ref = refs.find((item) => item.skill_label === step.id || item.title === step.title);
    return {
      value: ref?.id || `catalog:${step.id}`,
      label: `${step.trackTitle || step.category || step.level || "커리큘럼"} · ${step.title}`,
      notionUrl: step.notionUrl || ref?.notion_url || "",
      step,
    };
  });
  refs.forEach((ref) => {
    if (choices.some((item) => item.value === ref.id || item.step?.id === ref.skill_label)) return;
    choices.push({
      value: ref.id,
      label: `${ref.level_label || "커리큘럼"} · ${ref.title}`,
      notionUrl: ref.notion_url || "",
      step: null,
    });
  });
  return choices;
}

function rankedAdminCurriculumChoices(choices, query) {
  if (!query) return choices;
  const search = window.TennisNoteCurriculumSearch;
  if (!search?.search) {
    const normalizedQuery = String(query).trim().toLocaleLowerCase("ko-KR");
    return choices.filter((item) => `${item.value} ${item.label}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  }
  const byValue = new Map(choices.map((choice) => [choice.value, choice]));
  return search.search(choices.map(searchableAdminCurriculumChoice), query, { limit: 24 })
    .map((result) => byValue.get(result.step.__choiceValue))
    .filter(Boolean);
}

function downloadSettlementCsv() {
  const rows = [["정산일", "총매출", "수수료", "최종정산액"]].concat(settlements.map((item) => [item.date, item.sales, item.fee, item.net]));
  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tennis-note-settlement-demo.csv";
  link.click();
  URL.revokeObjectURL(url);
  billingLogs.unshift("코치 정산 CSV 다운로드 생성");
  renderAll();
  showToast("엑셀 다운로드 준비 완료");
}

function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadWorkbook(filename, sheets) {
  try {
    await ensureXlsxLibrary();
  } catch {
    const firstSheet = sheets[0];
    downloadRowsAsCsv(filename.replace(/\.xlsx$/i, ".csv"), firstSheet.rows);
    showToast("엑셀 모듈을 불러오지 못해 CSV로 저장했습니다");
    return;
  }
  const workbook = window.XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = window.XLSX.utils.aoa_to_sheet(sheet.rows);
    if (Array.isArray(sheet.columns)) worksheet["!cols"] = sheet.columns;
    if (sheet.autoFilter) worksheet["!autofilter"] = { ref: sheet.autoFilter };
    window.XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  window.XLSX.writeFile(workbook, filename);
}

async function readWorkbookFile(file) {
  await ensureXlsxLibrary();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = window.XLSX.read(reader.result, { type: "array" });
      const sheets = Object.fromEntries(workbook.SheetNames.map((sheetName) => [
        sheetName,
        window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }),
      ]));
      if (sheets[importMemberSheetName]) {
        const guideVersion = importGuideMetadata(sheets[importGuideSheetName] || [])[normalizeImportHeader("양식 버전")];
        resolve({
          schemaVersion: String(guideVersion || "2.0"),
          guide: { name: importGuideSheetName, rows: sheets[importGuideSheetName] || [] },
          members: { name: importMemberSheetName, rows: sheets[importMemberSheetName] },
          schedules: { name: importScheduleSheetName, rows: sheets[importScheduleSheetName] || [importScheduleColumns] },
          reviews: { name: importReviewSheetName, rows: sheets[importReviewSheetName] || [] },
          paymentReviews: { name: importPaymentReviewSheetName, rows: sheets[importPaymentReviewSheetName] || [] },
        });
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      resolve({ schemaVersion: "1.0", legacyRows: sheets[firstSheetName] || [] });
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function clearDataImportResult() {
  const input = $("#dataImportFile");
  if (input) input.value = "";
  setDataImportState({
    fileName: "",
    fileType: "",
    status: "idle",
    message: "아직 선택된 파일이 없습니다.",
    columns: [],
    rowCount: 0,
    readyRows: 0,
    reviewRows: 0,
    errorRows: 0,
    issues: [],
    rawRows: [],
    schemaVersion: "",
    workbookPayload: null,
    memberRowCount: 0,
    scheduleRowCount: 0,
    serverStatus: "idle",
    serverMessage: "",
    serverPreview: null,
  });
}

function scheduleAdminInitialLiveSync() {
  if (adminInitialLiveSyncHandle || adminLiveSyncPromise) return;
  const run = async () => {
    adminInitialLiveSyncHandle = 0;
    adminInitialLiveSyncKind = "";
    await syncAdminLiveData(false, { abortIfDirty: true });
  };
  if (typeof window.requestIdleCallback === "function") {
    adminInitialLiveSyncKind = "idle";
    adminInitialLiveSyncHandle = window.requestIdleCallback(run, { timeout: 800 });
    return;
  }
  adminInitialLiveSyncKind = "timer";
  adminInitialLiveSyncHandle = window.setTimeout(run, 120);
}

function selectedExportSheets() {
  const includePrivate = $("#dataExportPrivateFields")?.checked || false;
  const dataset = $("#dataExportDataset")?.value || "all";
  const allRows = exportRowsByDataset(includePrivate);
  if (dataset === "all") return Object.values(allRows).map((item) => ({ name: item.label, rows: item.rows }));
  const selected = allRows[dataset] || allRows.members;
  return [{ name: selected.label, rows: selected.rows }];
}

async function downloadDataExport() {
  const format = $("#dataExportFormat")?.value || "xlsx";
  const dataset = $("#dataExportDataset")?.value || "all";
  const sheets = selectedExportSheets();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const payload = Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet.rows]));
    downloadTextFile(`tennis-note-${dataset}-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  } else if (format === "csv") {
    const rows = dataset === "all"
      ? sheets.flatMap((sheet) => [[sheet.name], ...sheet.rows, []])
      : sheets[0].rows;
    downloadRowsAsCsv(`tennis-note-${dataset}-${stamp}.csv`, rows);
  } else {
    await downloadWorkbook(`tennis-note-${dataset}-${stamp}.xlsx`, sheets);
  }
  billingLogs.unshift(`데이터 내보내기 생성: ${dataset} ${format}`);
  renderAll();
  showToast("데이터 내보내기 완료");
}

function writeCommunityPost() {
  if (!$("#communityFeed")) return;
  const channel = state.communityChannel === "홈" ? "레슨후기" : state.communityChannel;
  communityPosts.unshift({
    channel,
    type: "공지",
    title: `${channel} 새 글 초안`,
    body: "관리자가 데모에서 작성한 게시글입니다. 실제 버전에서는 사진, 공지 팝업, 댓글 기능과 연결합니다.",
    likes: 0,
    comments: 0,
  });
  state.communityChannel = channel;
  $$(".channel-pill[data-community-channel]").forEach((button) => button.classList.toggle("is-active", button.dataset.communityChannel === channel));
  renderCommunity();
  saveSnapshot();
  showToast("커뮤니티 글쓰기 완료");
}

function readCoachStaffPanel() {
  const draft = coachStaffEditorState.draft;
  if (!draft) return;
  if (coachStaffEditorState.tab === "basic") {
    draft.name = $("#coachStaffName")?.value.trim() || "";
    draft.phone = $("#coachStaffPhone")?.value.trim() || "";
    draft.jobTitle = $("#coachStaffJobTitle")?.value.trim() || "레슨";
    draft.bio = $("#coachStaffBio")?.value.trim() || "";
    draft.color = $("#coachStaffColor")?.value || "#157a5b";
    draft.approvalStatus = $("#coachStaffApprovalStatus")?.value || "pending";
    draft.employmentStartedOn = $("#coachStaffEmploymentStartedOn")?.value || "";
  }
  if (coachStaffEditorState.tab === "settlement") {
    draft.settlement.method = $("#coachStaffSettlementMethod")?.value || "ratio";
    draft.settlement.ratio = numericValue($("#coachStaffSettlementRatio")?.value, draft.settlement.ratio);
    draft.settlement.hourly = numericValue($("#coachStaffSettlementHourly")?.value, draft.settlement.hourly);
    draft.settlement.basis = $("#coachStaffSettlementBasis")?.value || "cash_ex_vat";
    draft.settlement.substitute = $("#coachStaffSettlementSubstitute")?.value || "actualCoach";
    draft.settlement.effectiveFrom = $("#coachStaffSettlementEffectiveFrom")?.value || new Date().toISOString().slice(0, 10);
  }
}

function editBreakRule(ruleId) {
  if (!scheduleSettings.breakRules.some((rule) => rule.id === ruleId)) return;
  state.editingBreakRuleId = ruleId;
  renderScheduleSettings();
  $("#breakStartInput")?.focus();
}

function clearBreakRuleEditor() {
  state.editingBreakRuleId = "";
  $$('[data-break-day]').forEach((input) => { input.checked = false; });
  $$('[data-break-coach]').forEach((input) => { input.checked = true; });
  if ($("#breakLabelInput")) $("#breakLabelInput").value = "브레이크";
  const applyButton = $("#applyBreakRuleButton");
  if (applyButton) applyButton.textContent = "브레이크 추가";
}

function readNoticePopupForm(statusOverride = "") {
  const baseNotice = editingPopupNotice();
  const actionUrl = $("#noticeActionUrlInput")?.value.trim() || "";
  return normalizePopupNotice({
    ...baseNotice,
    id: $("#noticePopupSettings")?.dataset.noticeId || baseNotice.id,
    title: $("#noticeTitleInput")?.value.trim() || defaultPopupNotice.title,
    body: $("#noticeBodyInput")?.value.trim() || defaultPopupNotice.body,
    audience: $("#noticeAudienceInput")?.value || "all",
    status: statusOverride || $("#noticeStatusInput")?.value || "active",
    priority: $("#noticePriorityInput")?.value || "normal",
    startDate: $("#noticeStartDateInput")?.value || "",
    endDate: $("#noticeEndDateInput")?.value || "",
    showOncePerDay: $("#noticeOncePerDayInput")?.checked !== false,
    displayOrder: baseNotice.displayOrder || ((popupNotices().length + 1) * 10),
    imageUrl: noticeImageRemoveRequested ? "" : baseNotice.imageUrl,
    imageStoragePath: noticeImageRemoveRequested ? "" : baseNotice.imageStoragePath,
    imageAlt: $("#noticeImageAltInput")?.value.trim() || "",
    actionLabel: actionUrl ? ($("#noticeActionLabelInput")?.value.trim() || "자세히 보기") : "",
    actionUrl,
  });
}

function editPopupNotice(noticeId = "") {
  if (!popupNotices().some((notice) => notice.id === noticeId)) return;
  resetNoticeImageDraft();
  state.noticeDraft = null;
  state.noticeEditingId = noticeId;
  renderNoticePopupSettings();
  $("#noticeTitleInput")?.focus();
}

function branchSalesConfigFromForm() {
  const panel = $("#branchSalesSetupPanel");
  const next = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  if (!panel) return next;
  panel.querySelectorAll("[data-sales-feature]").forEach((input) => {
    next.features[input.dataset.salesFeature] = input.checked === true;
  });
  panel.querySelectorAll("[data-sales-payment-method][data-sales-field]").forEach((input) => {
    const method = next.paymentMethods[input.dataset.salesPaymentMethod];
    if (!method) return;
    const field = input.dataset.salesField;
    method[field] = input.type === "checkbox" ? input.checked === true : input.type === "number" ? Number(input.value || 0) : input.value.trim();
  });
  panel.querySelectorAll("[data-sales-benefit][data-sales-field]").forEach((input) => {
    const benefit = next.benefits[input.dataset.salesBenefit];
    if (!benefit) return;
    const field = input.dataset.salesField;
    benefit[field] = input.type === "checkbox" ? input.checked === true : input.type === "number" ? Number(input.value || 0) : input.value.trim();
  });
  next.features.newMemberBenefit = next.benefits.newMember.enabled === true;
  next.features.returningMemberBenefit = next.benefits.returningMember.enabled === true;
  next.features.referralBenefit = next.benefits.referral.enabled === true;
  return normalizeBranchSalesConfig(next);
}

function adminHasUnsavedChanges() {
  if (document.querySelector('[data-dirty="true"]')) return true;
  const inputGuard = window.TennisNoteInputGuard;
  if (!inputGuard?.isDirty) return false;
  return [...document.querySelectorAll("[data-tn-input-guard]")].some((root) => (
    !root.hidden
    && root.getAttribute("aria-hidden") !== "true"
    && inputGuard.isDirty(root)
  ));
}
