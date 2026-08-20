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
