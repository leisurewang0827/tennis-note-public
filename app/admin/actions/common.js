// 공통 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function operationsAccessReady() {
  if (adminLocalPreviewMode) return true;
  return Boolean(
    window.TennisNoteDataClient?.getSession?.()?.access_token
    && ["admin", "coach"].includes(operationsRole()),
  );
}

async function createAdminPinHash(value) {
  const pin = `${value || ""}`.trim();
  const text = `${adminPinHashVersion}:${pin}`;
  try {
    if (window.crypto?.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return `sha256:${hex}`;
    }
  } catch {
    // Local demo fallback only. Live service should verify admin auth on the server.
  }
  return fallbackAdminPinHash(pin);
}

function resetAdminSecurityDraft() {
  adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  adminSecurityModeOverride = "";
  adminSecuritySaveState.status = "idle";
}

function applyAdminSecurityMode(mode) {
  const preset = adminSecurityPresets[mode];
  if (!preset) {
    adminSecurityModeOverride = "custom";
    adminSecuritySaveState.status = "idle";
    renderAdminSecurity();
    return;
  }
  adminSecurityModeOverride = mode;
  adminSecurityDraft = {
    enabled: preset.enabled,
    timeoutMinutes: preset.timeoutMinutes,
    lockedViews: [...preset.lockedViews],
    pastAbsenceRequirePinEveryTime: preset.pastAbsenceRequirePinEveryTime,
  };
  adminSecuritySaveState.status = "idle";
  renderAdminSecurity();
}

async function confirmAdminUnlock() {
  if (adminPinNeedsSetup()) {
    closeAdminLockModal();
    state.settingsTab = "security";
    setView("settings", { skipLock: true });
    renderSettingsTabs();
    showToast("관리자 PIN을 먼저 설정해 주세요");
    return;
  }
  const input = $("#adminPinInput");
  const value = input?.value.trim() || "";
  if (!(await verifyAdminPin(value))) {
    adminLockSession.error = "PIN이 맞지 않습니다.";
    renderAdminLockModal();
    setTimeout(() => $("#adminPinInput")?.focus(), 0);
    return;
  }
  const oneTimeAction = adminLockSession.pendingAction;
  if (oneTimeAction) {
    adminLockSession.oneTimeGrant = oneTimeAction;
    setTimeout(() => {
      if (adminLockSession.oneTimeGrant === oneTimeAction) adminLockSession.oneTimeGrant = "";
    }, 5000);
  } else {
    adminLockSession.unlockedUntil = Date.now() + adminLockSettings.timeoutMinutes * 60000;
  }
  const targetView = adminLockSession.pendingView;
  const callback = adminLockSession.afterUnlock;
  closeAdminLockModal();
  renderAdminSecurity();
  showToast(oneTimeAction ? "관리자 확인 완료" : `관리자 잠금 해제 · ${adminLockSettings.timeoutMinutes}분 유지`);
  if (callback) callback();
  else if (targetView) setView(targetView, { skipLock: true });
}

async function changeAdminPin() {
  const currentPin = $("#adminCurrentPin")?.value.trim() || "";
  const nextPin = $("#adminNewPin")?.value.trim() || "";
  const confirmPin = $("#adminConfirmPin")?.value.trim() || "";
  const initialSetup = adminPinNeedsSetup();
  if (!/^\d{6,8}$/.test(nextPin)) {
    showToast("새 PIN은 숫자 6~8자리로 설정해 주세요");
    return;
  }
  if (nextPin !== confirmPin) {
    showToast("새 PIN 확인이 맞지 않습니다");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (adminApprovalReady() && client?.rpc) {
    try {
      await client.rpc("tn_admin_set_security_pin", {
        target_current_pin: initialSetup ? "" : currentPin,
        target_new_pin: nextPin,
      });
      adminLockSettings.pinConfigured = true;
      adminLockSettings.pinHash = "";
      adminLockSettings.legacyPin = "";
    } catch {
      showToast(initialSetup ? "PIN 설정에 실패했습니다" : "현재 PIN을 확인해 주세요");
      return;
    }
  } else {
    if (!initialSetup && !(await verifyAdminPin(currentPin))) {
      showToast("현재 PIN을 확인해 주세요");
      return;
    }
    adminLockSettings.pinHash = await createAdminPinHash(nextPin);
    adminLockSettings.legacyPin = "";
    adminLockSettings.pinConfigured = false;
  }
  saveSnapshot();
  lockAdminNow();
  $("#adminSecurityPanel")?.querySelectorAll("input[type='password']").forEach((input) => {
    input.value = "";
  });
  renderAll();
  showToast("관리자 PIN 변경 완료");
}

function saveSnapshot() {
  if (state.snapshotStorageUnavailable || adminSnapshotSaveQueued) return false;
  adminSnapshotSaveQueued = true;
  const write = () => {
    adminSnapshotSaveHandle = 0;
    adminSnapshotSaveQueued = false;
    writeSnapshotNow();
  };
  if (typeof window.requestIdleCallback === "function") {
    adminSnapshotSaveHandle = window.requestIdleCallback(write, { timeout: 1000 });
  } else {
    adminSnapshotSaveHandle = window.setTimeout(write, 120);
  }
  return true;
}

function updateAdminSaveState(message = "") {
  const target = $("#adminSaveState");
  if (!target) return;
  const text = String(message || "");
  if (/실패|오류|확인 필요|저장 중|불러오|취소/.test(text)) return;
  let label = "";
  if (/서버 저장 완료|서버에 저장|DB 반영 완료/.test(text)) label = "서버 저장 완료";
  else if (/로컬 저장 완료|임시 저장/.test(text)) label = "이 기기에 저장";
  else if (/저장 완료|반영 완료|처리 완료|등록 완료|수정 완료/.test(text)) label = "처리 완료";
  if (!label) return;
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  target.textContent = `${label} · ${time} · 새로고침 후에도 서버 값을 다시 확인하세요.`;
  target.dataset.tone = label === "서버 저장 완료" ? "server" : "saved";
}

function setView(view, options = {}) {
  if (!operationsAccessReady()) {
    renderOperationsLoginGate();
    return;
  }
  if (view === "makeup") view = "schedule";
  if (
    state.view === "members"
    && view !== "members"
    && dirtyMemberInlineForms().length
    && !options.discardMemberChanges
  ) {
    if (!window.confirm("저장하지 않은 회원 변경사항이 있습니다. 변경을 버리고 이동할까요?")) return;
    dirtyMemberInlineForms().forEach((form) => setMemberInlineDirtyState(form, false));
  }
  if (!$(`#${view}View`)) view = "dashboard";
  if (!operationsViewAllowed(view)) {
    view = operationsRole() === "coach" ? "schedule" : "dashboard";
    showToast("현재 계정에서 사용할 수 없는 메뉴입니다.");
  }
  if (!options.skipLock && !requestAdminUnlock(view)) return;
  const previousView = state.view;
  const enteringSchedule = view === "schedule" && previousView !== "schedule";
  closeCleanMemberInlineEditor(view);
  state.view = view;
  if (view === "schedule" && (enteringSchedule || !scheduleSessionInitialized)) resetScheduleEntryState();
  $$(".nav-item[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $("#adminMoreMenuButton")?.classList.toggle("is-active", adminLayoutSettings.moreMenus.includes(view));
  setAdminMoreMenuOpen(false);
  $$(".view").forEach((section) => section.classList.remove("is-active"));
  $(`#${view}View`).classList.add("is-active");
  closeAdminMenu();
  const titles = {
    dashboard: "대시보드",
    members: operationsRole() === "coach" ? "회원 찾기" : "회원관리",
    schedule: operationsRole() === "coach" ? "레슨표" : "레슨시간표",
    billing: "결제/정산",
    reports: "경영 리포트",
    notes: operationsRole() === "coach" ? "수업 완료" : "기록/차감 확인",
    issues: operationsRole() === "coach" ? "오류 접수" : "개선·오류 접수",
    settings: "운영 설정",
  };
  $("#viewTitle").textContent = titles[view];
  const reuseRenderedView = canReuseAdminView(view);
  if (enteringSchedule && !reuseRenderedView) {
    const grid = $("#scheduleGrid");
    if (grid) {
      grid.hidden = false;
      grid.className = "schedule-sheet schedule-loading-state";
      grid.innerHTML = '<div class="schedule-loading-message" role="status"><span class="schedule-loading-spinner" aria-hidden="true"></span><strong>시간표 불러오는 중</strong><small>이번 주 수업을 정리하고 있습니다.</small></div>';
    }
    window.requestAnimationFrame(() => {
      if (state.view === "schedule") renderAdminView(view);
    });
  } else if (!reuseRenderedView) {
    renderAdminView(view);
  }
  void ensureAdminViewData(view);
  if (
    previousView === "schedule"
    && view !== "schedule"
    && state.liveScheduleLoaded
    && !adminWeekIsLoaded(adminScheduleWeek(0))
  ) {
    void refreshAdminLiveSchedule({ force: true });
  }
  if (view === "billing" && !serverPaymentSyncState.loading) {
    loadServerPaymentsIntoBilling({ force: !serverPaymentSyncState.directLoaded });
  }
  if (enteringSchedule && state.liveScheduleLoaded && !state.liveScheduleLoading) {
    refreshAdminLiveSchedule().catch(() => false);
  }
}

async function invokeAdminAccountControl(body, button, successMessage) {
  if (!adminApprovalReady() || operationsRole() !== "admin" || !window.TennisNoteDataClient?.invokeFunction) {
    showToast("관리자 로그인 후 사용할 수 있습니다.");
    return null;
  }
  if (button) button.disabled = true;
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("tennisnote-admin-users", { body });
    if (!result?.ok) throw new Error(result?.code || "server_error");
    await syncAdminLiveData();
    showToast(successMessage);
    return result;
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    showToast(adminAccountControlErrorMessage(code));
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}

async function switchGroupPayer(groupAccountId) {
  const account = groupAccounts.find((item) => item.id === groupAccountId);
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (linkedMembers.length < 2 || account.paymentMode === "separate") return;
  const currentIndex = linkedMembers.findIndex((member) => member.name === account.nextPayer);
  const nextMember = linkedMembers[(currentIndex + 1) % linkedMembers.length];
  if (account.serverAccount && window.TennisNoteDataClient?.rpc) {
    try {
      await window.TennisNoteDataClient.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: account.paymentMode,
        target_next_payer_user_id: nextMember.userId,
      });
      await syncAdminLiveData();
      showToast(`다음 결제 담당 ${nextMember.name}`);
    } catch (error) {
      showToast(`다음 결제자 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
    return;
  }
  account.nextPayer = nextMember.name;
  saveSnapshot();
  renderMembers();
  showToast(`다음 결제 담당 ${account.nextPayer}`);
}

async function reviewHoldingRequest(requestId, status) {
  const shared = loadSharedData();
  const request = (shared.holdingRequests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "pending") return;
  const client = window.TennisNoteDataClient;
  const isLive = request.source === "server";
  try {
    if (isLive && client?.rpc && client.getSession?.()?.access_token) {
      await client.rpc("tn_review_holding_request", {
        target_request_id: request.id,
        target_status: status,
        target_admin_note: status === "approved" ? "관리자 승인" : "관리자 반려",
        target_evidence_retention_days: Number(holdingPolicySettings.evidenceRetentionDays) || 30,
        target_personal_max_days: Number(holdingPolicySettings.personalMaxDays) || 7,
        target_injury_max_days: Number(holdingPolicySettings.injuryMaxDays) || 28,
        target_injury_evidence_required: holdingPolicySettings.evidenceRequired !== false,
      });
    }
  } catch {
    showToast("서버 홀딩 처리 실패 · 관리자 로그인과 DB 적용을 확인해 주세요");
    return;
  }
  request.status = status;
  request.reviewedAt = new Date().toISOString();
  saveSharedData(shared);
  renderHoldingRequestAdminList();
  showToast(status === "approved" ? "홀딩 승인 및 회원권 기간 연장 완료" : "홀딩 요청 반려 완료");
}

async function viewHoldingEvidence(requestId) {
  const request = (loadSharedData().holdingRequests || []).find((item) => item.id === requestId);
  if (!request?.evidencePath) {
    showToast(request?.evidenceLabel ? "데모 증빙 첨부 상태입니다" : "첨부된 증빙이 없습니다");
    return;
  }
  try {
    const blob = await window.TennisNoteDataClient.downloadObject("tennisnote-private-holding-evidence", request.evidencePath);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    showToast("증빙을 열 수 없습니다 · 관리자 권한을 확인해 주세요");
  }
}

async function deleteHoldingEvidence(requestId) {
  const shared = loadSharedData();
  const request = (shared.holdingRequests || []).find((item) => item.id === requestId);
  if (!request?.evidencePath) return;
  const confirmed = window.confirm("부상 증빙 원본을 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.");
  if (!confirmed) return;
  try {
    await window.TennisNoteDataClient.deleteObject("tennisnote-private-holding-evidence", request.evidencePath);
    await window.TennisNoteDataClient.updateRows("tn_holding_requests", { id: request.id }, {
      evidence_object_path: "",
      evidence_status: "purged",
      evidence_deleted_at: new Date().toISOString(),
    });
    request.evidencePath = "";
    request.evidenceLabel = "원본 삭제 완료";
    saveSharedData(shared);
    renderHoldingRequestAdminList();
    showToast("부상 증빙 원본 삭제 완료");
  } catch {
    showToast("증빙 삭제 실패 · 관리자 권한을 확인해 주세요");
  }
}

async function reviewAccountDeletionRequest(requestId, status) {
  const request = (state.accountDeletionRequests || []).find((item) => item.id === requestId);
  const client = window.TennisNoteDataClient;
  if (!request || !client?.rpc || !client?.invokeFunction) return;
  if (accountDeletionExecutionInFlight.has(requestId)) return;
  if (
    status === "completed"
    && request.status !== "reviewing"
    && request.status !== "failed"
    && !accountDeletionProcessingIsStale(request)
  ) {
    showToast("현재 삭제 작업이 끝나거나 16분 재시도 시간이 지난 뒤 다시 시도해 주세요");
    return;
  }
  if (status === "completed" && !window.confirm("이 작업은 회원의 로그인 계정과 개인 이용 데이터를 실제로 삭제하며 되돌릴 수 없습니다. 정산·환불·잔여 수업을 확인한 뒤 실행할까요?")) return;
  accountDeletionExecutionInFlight.add(requestId);
  if (status === "completed") {
    request.status = "processing";
    request.executionStartedAt = new Date().toISOString();
  }
  renderAccountDeletionAdminList();
  try {
    if (status === "completed") {
      await client.invokeFunction("tennisnote-account-deletion", {
        body: { action: "complete", requestId },
      });
      showToast("회원 계정과 개인 이용 데이터 삭제 완료");
      return;
    }
    await client.rpc("tn_review_account_deletion", {
      target_request_id: requestId,
      target_status: status,
      target_admin_note: "관리자 검토 시작",
      target_retained_data_summary: "",
    });
    showToast("회원 탈퇴 요청 검토 시작");
  } catch (error) {
    const code = String(error?.payload?.code || error?.message || "").toLowerCase();
    if (Number(error?.status) === 404 || code.includes("function failed: 404") || code.includes("function_not_found")) {
      showToast("계정 삭제 서버 기능이 아직 배포되지 않았습니다. 서버 배포를 완료한 뒤 다시 실행해 주세요");
      return;
    }
    if (code.includes("execution_in_progress") || code.includes("lease_mismatch")) {
      showToast("다른 관리자 화면에서 삭제를 처리 중입니다. 잠시 후 상태를 다시 확인해 주세요");
      return;
    }
    if (code.includes("storage_cleanup")) {
      showToast("사진·동영상 원본 삭제를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요");
      return;
    }
    if (code.includes("coach_makeup")) {
      showToast("코치에게 배정된 미처리 보강권을 다른 코치로 옮긴 뒤 다시 시도해 주세요");
      return;
    }
    if (code.includes("active_ticket")) showToast("잔여 수업이 있는 회원권을 먼저 환불·종료해 주세요");
    else if (code.includes("future_lesson")) showToast("예정된 수업을 먼저 취소하거나 정리해 주세요");
    else if (code.includes("refund_review")) showToast("진행 중인 환불 처리를 먼저 완료해 주세요");
    else if (code.includes("payment_review")) showToast("확인 중인 결제를 먼저 정리해 주세요");
    else if (code.includes("transfer_review")) showToast("진행 중인 회원권 양도 요청을 먼저 정리해 주세요");
    else if (code.includes("coach_schedule")) showToast("코치의 예정 수업을 다른 코치에게 재배정한 뒤 삭제해 주세요");
    else if (code.includes("admin_role")) showToast("관리자 계정은 권한을 인계하고 일반 회원으로 변경한 뒤 삭제해 주세요");
    else if (code.includes("merged_profile")) showToast("이미 기존 회원에게 병합된 가입 프로필은 별도로 삭제하지 않습니다");
    else if (code.includes("apple_reauthentication")) showToast("회원이 Apple로 다시 로그인한 뒤 삭제 처리를 재시도해 주세요");
    else if (code.includes("self_admin")) showToast("현재 로그인한 관리자 계정은 직접 삭제할 수 없습니다");
    else if (code.includes("apple_revoke_config")) showToast("Apple 연결 해제 서버 설정을 확인한 뒤 다시 시도해 주세요");
    else showToast("삭제 처리를 완료하지 못했습니다 · 상태를 보존했으므로 다시 시도할 수 있습니다");
  } finally {
    accountDeletionExecutionInFlight.delete(requestId);
    await loadServerAccountDeletionRequests();
  }
}

function scheduleSheetPasteFilterButtons(rows = []) {
  const allCount = rows.length;
  const readyCount = rows.filter((row) => !row.issues.length).length;
  const issueCount = allCount - readyCount;
  const filters = [
    { key: "all", label: "전체", count: allCount },
    { key: "issue", label: "확인 필요", count: issueCount },
    { key: "ready", label: "등록 가능", count: readyCount },
  ];
  return `
    <div class="schedule-sheet-paste-filters" role="group" aria-label="붙여넣기 미리보기 필터">
      ${filters.map((filter) => `
        <button class="segment ${state.scheduleSheetPasteFilter === filter.key ? "is-active" : ""}" type="button" data-schedule-sheet-filter="${filter.key}">
          <span>${filter.label}</span><strong>${filter.count}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function scheduleSheetPasteSelectedRowSet() {
  return new Set((state.selectedScheduleSheetPasteRowNumbers || []).map(String));
}

function scheduleSheetPasteVisibleRows(rows = state.scheduleSheetPasteRows || []) {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (
      state.scheduleSheetPasteFilter === "ready"
        ? !row.issues.length
        : state.scheduleSheetPasteFilter === "issue"
          ? row.issues.length
          : true
    ));
}

function scheduleSheetPasteBulkControls(rows = state.scheduleSheetPasteRows || [], visibleRows = scheduleSheetPasteVisibleRows(rows)) {
  const selectedCount = scheduleSheetPasteSelectedRowSet().size;
  const coachOptions = scheduleSheetCoachOptions()
    .map((coach) => ({ value: coach.id, label: scheduleCoachDisplayName(coach.name) }));
  return `
    <div class="schedule-sheet-paste-bulk" aria-label="선택 행 일괄 적용">
      <span><strong>${selectedCount}</strong>행 선택</span>
      <select id="scheduleSheetBulkCoach" aria-label="선택 행 코치">
        <option value="">코치 유지</option>
        ${scheduleSheetSelectOptions(coachOptions)}
      </select>
      <select id="scheduleSheetBulkSource" aria-label="선택 행 수업종류">
        <option value="">수업종류 유지</option>
        ${scheduleSheetSelectOptions(scheduleSheetSourceOptions())}
      </select>
      <select id="scheduleSheetBulkDuration" aria-label="선택 행 수업시간">
        <option value="">수업시간 유지</option>
        ${scheduleSheetSelectOptions([20, 30, 40, 60].map((minutes) => ({ value: minutes, label: `${minutes}분` })))}
      </select>
      <button class="primary-button" type="button" data-apply-schedule-sheet-bulk ${selectedCount ? "" : "disabled"}>선택 행 적용</button>
      <button class="ghost-button" type="button" data-select-visible-schedule-sheet-rows ${visibleRows.length ? "" : "disabled"}>현재 목록 선택</button>
      <button class="ghost-button" type="button" data-clear-schedule-sheet-selection ${selectedCount ? "" : "disabled"}>선택 해제</button>
    </div>
  `;
}

function confirmAdminManualOverride(candidate, warnings = []) {
  const warningText = warnings.length
    ? warnings.map((warning) => `• ${warning}`).join("\n")
    : "• 감지된 정책 충돌 없음";
  return window.confirm(
    `관리자 강제 수동 처리로 저장할까요?\n\n${candidate.day} ${candidate.time} · ${getLessonMembersLabel(candidate)}\n${warningText}\n\n사유: ${adminManualOverrideReason()}\n\n회원·코치 앱의 제한은 바뀌지 않으며 이 처리만 감사 기록에 남습니다.`,
  );
}

async function submitSubstituteAssignments(event) {
  event.preventDefault();
  const lessonIds = [...new Set((state.selectedSubstituteLessonIds || []).map(String))];
  const coachRoleId = $("#substituteCoach")?.value || "";
  const settlementMode = $("#substituteSettlementMode")?.value || "actual_coach";
  const hourlyAmount = settlementMode === "hourly" ? Number($("#substituteHourlyAmount")?.value || 0) : null;
  const message = $("#substituteFormMessage");
  if (!lessonIds.length || !coachRoleId || (settlementMode === "hourly" && hourlyAmount <= 0)) {
    if (message) message.textContent = "수업, 실제 코치, 정산 방식을 확인해 주세요.";
    return;
  }
  const button = $("#saveSubstituteAssignments");
  if (button) button.disabled = true;
  try {
    const payload = {
      target_lesson_ids: lessonIds,
      target_substitute_coach_role_id: coachRoleId,
      target_settlement_mode: settlementMode,
      target_hourly_amount: hourlyAmount,
      target_reason: $("#substituteReason")?.value.trim() || null,
    };
    const expectedRevisions = Object.fromEntries(lessonIds.map((lessonId) => {
      const lesson = lessons.find((item) => String(item.serverLessonId) === String(lessonId));
      return [lessonId, lesson?.serverRevision ?? null];
    }));
    if (!state.substituteOperationKey) {
      state.substituteOperationKey = createAdminOperationKey("substitute-assign");
    }
    const result = await guardedRpcWithFallback(
      "tn_admin_assign_lesson_substitutes_guarded",
      {
        ...payload,
        target_expected_revisions: expectedRevisions,
        target_operation_key: state.substituteOperationKey,
      },
      "tn_admin_assign_lesson_substitutes",
      payload,
    );
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#substituteModal");
    closeSubstituteModal();
    if (state.scheduleBulkMode) {
      state.selectedScheduleLessonIds = [];
      state.scheduleBulkOperationKey = "";
      state.scheduleBulkMode = false;
    }
    renderAll();
    showToast(`${Number(result?.assignedCount ?? result?.assigned_count ?? lessonIds.length)}개 수업 대타 지정 완료`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    if (raw.includes("lesson_concurrent_update")) {
      await syncAdminLiveData();
    }
    const messages = {
      lesson_concurrent_update: "다른 화면에서 수업이 먼저 변경되었습니다. 최신 시간표를 불러왔으니 다시 선택해 주세요.",
      lesson_expected_revision_required: "수업의 최신 상태를 확인할 수 없습니다. 시간표를 새로고침해 주세요.",
      substitute_admin_required: "관리자 계정에서만 대타를 지정할 수 있습니다.",
      substitute_lesson_not_found: "선택한 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.",
      substitute_coach_not_available: "선택한 코치가 해당 지점에서 수업 가능한 상태가 아닙니다.",
      substitute_same_coach: "원 담당 코치와 다른 코치를 선택해 주세요.",
      substitute_lesson_closed: "완료되거나 취소된 수업은 대타로 변경할 수 없습니다.",
      substitute_settlement_mode_invalid: "대타 정산 방식을 다시 선택해 주세요.",
      operation_key_reused_with_different_payload: "선택 내용이 변경되었습니다. 창을 닫았다가 다시 열어 주세요.",
    };
    const matched = Object.entries(messages).find(([code]) => raw.includes(code))?.[1];
    if (message) message.textContent = isMissingRpcError(error, "tn_admin_assign_lesson_substitutes_guarded")
      ? "대타 운영 DB 보호 기능을 확인해 주세요."
      : matched || "대타 지정에 실패했습니다. 수업 상태와 코치 지점을 확인해 주세요.";
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function cancelSubstituteAssignments() {
  const lessonIds = [...new Set((state.selectedSubstituteLessonIds || []).map(String))];
  if (!lessonIds.length) {
    $("#substituteFormMessage").textContent = "취소할 대타 수업을 선택해 주세요.";
    return;
  }
  if (!window.confirm(`${lessonIds.length}개 수업의 대타 지정을 취소하고 원 담당 코치로 복원할까요?`)) return;
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_cancel_lesson_substitutes", {
      target_lesson_ids: lessonIds,
      target_reason: $("#substituteReason")?.value.trim() || "관리자 대타 지정 취소",
    });
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#substituteModal");
    closeSubstituteModal();
    renderAll();
    showToast(`${Number(result?.restoredCount ?? result?.restored_count ?? 0)}개 수업 원 담당 코치 복원 완료`);
  } catch {
    $("#substituteFormMessage").textContent = "대타 취소에 실패했습니다. 지정 상태를 새로고침해 확인해 주세요.";
  }
}

function setOneDayBookingMessage(message = "", tone = "") {
  const target = $("#oneDayBookingMessage");
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${tone}`;
}

async function saveOneDayBooking(event) {
  event.preventDefault();
  const values = oneDayBookingFormValues();
  const coach = coaches.find((item) => item.id === values.coachId);
  if (!values.guestName || !values.bookingDate || !values.time || !coach?.serverRoleId || !coach.branchId) {
    setOneDayBookingMessage("이름, 코치, 날짜와 시간을 확인해 주세요.", "danger");
    return;
  }
  const previewMessage = $("#oneDayBookingMessage")?.textContent || "";
  if (previewMessage.includes("겹칩니다") || previewMessage.includes("근무 시간")) return;
  const button = $("#saveOneDayBookingButton");
  button.disabled = true;
  setOneDayBookingMessage("원데이 예약을 서버에 저장하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_save_one_day_booking", {
      target_booking_id: values.bookingId,
      target_branch_id: coach.branchId,
      target_coach_role_id: coach.serverRoleId,
      target_booking_date: values.bookingDate,
      target_start_time: values.time,
      target_duration_minutes: values.durationMinutes,
      target_guest_name: values.guestName,
      target_guest_phone: values.guestPhone || null,
      target_note: values.note || null,
      target_status: values.status,
    });
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#oneDayBookingModal");
    closeOneDayBookingModal();
    setView("schedule");
    showToast("원데이 예약 저장 완료 · 가입 후 자동 연결 준비");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    const message = raw.includes("one_day_lesson_time_conflict") || raw.includes("one_day_booking_time_conflict")
      ? "같은 코치의 수업 또는 원데이 예약과 시간이 겹칩니다."
      : raw.includes("approved_branch_coach_required")
        ? "승인된 담당 코치를 선택해 주세요."
        : raw.includes("one_day_guest_name_required")
          ? "이름을 두 글자 이상 입력해 주세요."
          : raw.includes("PGRST202") || raw.includes("tn_admin_save_one_day_booking")
            ? "원데이 예약 DB 기능을 먼저 적용해 주세요."
            : "원데이 예약 저장에 실패했습니다. 입력값을 다시 확인해 주세요.";
    setOneDayBookingMessage(message, "danger");
  } finally {
    button.disabled = false;
  }
}

async function deleteOneDayBooking() {
  const booking = oneDayBookingForId(state.editingOneDayBookingId);
  if (!booking || !window.confirm(`${booking.member} 원데이 예약을 삭제할까요?`)) return;
  const button = $("#deleteOneDayBookingButton");
  button.disabled = true;
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_archive_one_day_booking", {
      target_booking_id: booking.serverOneDayBookingId,
    });
    const synced = await syncAdminLiveData(true);
    if (!synced) throw new Error("one_day_refresh_failed");
    if (oneDayBookingForId(booking.serverOneDayBookingId)) {
      throw new Error("one_day_archive_not_confirmed");
    }
    window.TennisNoteInputGuard?.markSaved?.("#oneDayBookingModal");
    closeOneDayBookingModal();
    showToast("원데이 예약 삭제 완료");
  } catch (error) {
    const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
    const message = raw.includes("server_request_timeout")
      ? "서버 응답이 지연되었습니다. 새로고침 후 삭제 여부를 확인해 주세요."
      : raw.includes("one_day_archive_not_confirmed") || raw.includes("one_day_refresh_failed")
        ? "삭제 결과를 서버에서 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요."
        : "원데이 예약 삭제에 실패했습니다.";
    setOneDayBookingMessage(message, "danger");
  } finally {
    button.disabled = false;
  }
}

async function guardedRpcWithFallback(guardedName, guardedPayload, fallbackName, fallbackPayload) {
  try {
    return await window.TennisNoteDataClient.rpc(guardedName, guardedPayload);
  } catch (error) {
    if (!isMissingRpcError(error, guardedName)) throw error;
    return window.TennisNoteDataClient.rpc(fallbackName, fallbackPayload);
  }
}

function applyAdminCommentDraft(keywordSelector, commentSelector) {
  const keywordInput = $(keywordSelector);
  const commentInput = $(commentSelector);
  const generator = window.TennisNoteCommentDraft;
  if (!keywordInput || !commentInput || !generator?.generate) {
    showToast("코멘트 초안 기능을 불러오지 못했습니다.");
    return;
  }
  const result = generator.generate(keywordInput.value);
  if (!result.ok) {
    showToast(result.message);
    keywordInput.focus();
    return;
  }
  commentInput.value = result.comment;
  commentInput.dispatchEvent(new Event("input", { bubbles: true }));
  commentInput.focus();
  showToast("세부 코멘트 초안을 만들었습니다. 내용을 확인한 뒤 저장해 주세요.");
}

function handleModeAction(action) {
  const routeByAction = [
    { keyword: "회원", view: "members" },
    { keyword: "결제", view: "billing" },
    { keyword: "시간", view: "schedule" },
    { keyword: "리포트", view: "dashboard" },
    { keyword: "수업", view: "schedule" },
    { keyword: "출석", view: "notes" },
    { keyword: "메모", view: "notes" },
    { keyword: "보강", view: "schedule" },
    { keyword: "예약", view: "schedule" },
    { keyword: "잔수", view: "members" },
    { keyword: "알림", view: "dashboard" },
  ];
  const route = routeByAction.find((item) => action.includes(item.keyword));
  if (route) setView(route.view);
  billingLogs.unshift(`${action} 버튼 실행`);
  renderAll();
  showToast(`${action} 실행`);
}

function saveRackettimeList() {
  billingLogs.unshift("운영 목록 저장 완료");
  renderAll();
  showToast("운영 목록 저장 완료");
}

function importGuideRows() {
  return [
    ["항목", "내용"],
    ["양식 버전", importWorkbookVersion],
    ["이관월", defaultMonthlyImportMonth()],
    ["지점명", activeOperationBranchName()],
    ["명단적용", "이 명단 기준 전환"],
    ["입력", "회원DB의 앞쪽 입력 열만 한 줄씩 작성합니다."],
    ["자동 처리", "오른쪽 자동 열은 비워도 연락처·회원권·횟수로 자동 계산합니다."],
    ["시간표", "이 양식은 회원 명단만 등록합니다. 시간표는 관리자 화면에서 직접 설정합니다."],
  ];
}

function importCodeRows(allCoaches = coaches) {
  const coachRows = operationBranchCoaches(allCoaches)
    .filter((coach) => (
      coach.id !== "coach-machine"
      && coach.status === "active"
      && coach.coachMode === "approved"
      && coach.serverRoleId
    ))
    .map((coach) => ["담당코치", scheduleCoachDisplayName(coach.name), "", ""]);
  const productRows = membershipProductsForActiveOperationProfile()
    .filter((product) => product.status === "sale" && product.serverProductId)
    .map((product) => ["회원권명", product.title, "판매중", product.serverProductId]);
  return [
    ["구분", "사용값", "상태", "코드"],
    ["회원상태", "수강중", "", "active"],
    ["회원상태", "휴회", "", "paused"],
    ["회원상태", "만료회원", "", "historical"],
    ["회원상태", "가입대기", "", "pending"],
    ["적용방식", "현재 회원권 갱신", "", "update_current"],
    ["적용방식", "새 회원권", "", "new_ticket"],
    ["적용방식", "회원정보만", "", "member_only"],
    ["레슨방식", "평일", "", "weekday"],
    ["레슨방식", "주말", "", "weekend"],
    ["레슨종류", "1:1", "", "one_on_one"],
    ["레슨종류", "1:2", "", "one_on_two"],
    ["결제수단", "카드", "", "card"],
    ["결제수단", "현금", "", "cash"],
    ["결제수단", "계좌이체", "", "bank_transfer"],
    ["결제상태", "결제완료", "", "paid"],
    ["결제상태", "결제대기", "", "pending"],
    ["결제상태", "해당없음", "", "not_applicable"],
    ...coachRows,
    ...productRows,
  ];
}

function importServerIssueMessage(issue = {}) {
  const rowLabel = issue.rowNumber && issue.rowNumber !== "-" ? `${issue.rowNumber}행` : "파일";
  const fieldLabel = issue.field ? ` ${importServerFieldLabels[issue.field] || issue.field}` : "";
  return `${rowLabel}${fieldLabel}: ${importServerIssueLabels[issue.code] || issue.code || "확인 필요"}`;
}

async function performAdminLiveDataSync(options = {}) {
  if (adminLocalPreviewMode) return false;
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !operationsAccessReady()) return false;
  const fullAdminAccess = operationsRole() === "admin";
  const wasLoaded = state.liveScheduleLoaded;
  Object.assign(state, {
    liveScheduleLoading: true,
    liveScheduleMessage: "실서버 회원·코치·시간표를 불러오는 중",
  });
  try {
    const lessonWindow = adminLiveLessonWindow();
    const rosterParameters = {
        target_branch_id: activeOperationBranchId() || null,
        target_lesson_from: lessonWindow.from,
        target_lesson_to: lessonWindow.to,
      };
    const operationalRosterPromise = fullAdminAccess
      ? client.rpc("tn_admin_operational_roster_core", rosterParameters)
        .catch((coreError) => {
          if (!isMissingRpcError(coreError, "tn_admin_operational_roster_core")) {
            console.warn("[Tennis Note] core operational roster unavailable; using full-source fallback", coreError);
            return null;
          }
          console.warn("[Tennis Note] core operational roster missing; using compatible roster", coreError);
          return client.rpc("tn_admin_operational_roster", rosterParameters);
        })
        .then((response) => (Array.isArray(response) ? response[0] : response) || null)
        .catch((error) => {
          console.warn("[Tennis Note] operational roster unavailable; using full-source fallback", error);
          return null;
        })
      : Promise.resolve(null);
    const rosterRows = (key, fallback) => operationalRosterPromise
      .then((payload) => Array.isArray(payload?.[key]) ? payload[key] : fallback());
    const adminSettingsPromise = loadAdminStartupSettingsFromServer();
    const [serverBranches, serverUsers, serverCoachRoles, serverCoachAvailability, serverAuthLinks, serverAuthSwitches, serverSettlementTerms, serverProducts, serverTickets, ticketParticipants, lessonParticipants, serverLessons, serverRegularScheduleRules, serverOneDayBookings, serverEnrollments, serverChangeRequests, serverMakeupEntitlements, serverLessonRecords, serverCurriculumRefs, serverJournalEntries, serverMediaFiles, serverPayments, serverGroupAccounts, serverGroupMembers, serverGroupTicketLinks, serverMemberDatabaseRecords, serverMemberMembershipRecords, serverSubstituteAssignments, serverSettlementTickets] = await Promise.all([
      client.selectRows("tn_branches", { select: "id,name,status,open_start,open_end", order: "created_at.asc", limit: 100 }).catch(() => []),
      rosterRows("users", () => (client.selectAllRows || client.selectRows)("tn_user_directory_safe", { select: "id,name,nickname,phone,birth_year,neighborhood,gender,profile_photo_url,dominant_hand,backhand_style,tennis_started_on,self_ntrp,coach_ntrp,tennis_goal,play_style_memo,role,member_kind,status,auth_user_id,merged_into_user_id,merged_at,permanently_deleted_at", order: "created_at.asc", limit: 500, pageSize: 500, maxRows: 10000 })),
      client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,job_title,employment_status,employment_started_on,employment_ended_on,archived_at,deleted_at,settlement_type,settlement_rate,hourly_rate,settlement_basis,settlement_calculation_mode,settlement_effective_from,availability_revision,schedule_lane_order", limit: 100 })
        .catch(() => client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,settlement_type,settlement_rate,hourly_rate", limit: 100 })),
      client.selectRows("tn_coach_availability", { select: "id,coach_role_id,day_of_week,start_time,end_time,availability_type,note", limit: 1000 }).catch(() => []),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.authLinks || []) : Promise.resolve([]),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.authSwitches || []) : Promise.resolve([]),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.coachSettlementTerms || []) : Promise.resolve([]),
      client.selectRows("tn_membership_products", { select: "id,branch_id,product_code,name,lesson_minutes,frequency_per_week,total_sessions,group_size,group_deduction_policy,product_kind,is_coupon,is_active,schedule_scope,term_weeks,validity_days,grace_days,card_price,cash_price,settlement_base_price,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,policy_settings,display_order", limit: 300 })
        .catch(() => client.selectRows("tn_membership_products", { select: "id,branch_id,product_code,name,lesson_minutes,frequency_per_week,total_sessions,group_size,product_kind,is_coupon,is_active,schedule_scope,term_weeks,validity_days,grace_days,card_price,cash_price,settlement_base_price,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,policy_settings,display_order", limit: 300 })),
      rosterRows("tickets", () => (client.selectAllRows || client.selectRows)("tn_member_tickets", {
        select: "id,user_id,product_id,branch_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,purchased_price,updated_at",
        order: "id.asc",
        limit: 500,
        pageSize: 500,
        maxRows: 20000,
      })),
      rosterRows("ticketParticipants", () => (client.selectAllRows || client.selectRows)("tn_ticket_participants", {
        select: "ticket_id,user_id,participant_order",
        order: "ticket_id.asc,user_id.asc",
        limit: 500,
        pageSize: 500,
        maxRows: 20000,
      })),
      rosterRows("lessonParticipants", () => client.selectRows("tn_lesson_participants", { select: "lesson_id,user_id,ticket_id", limit: 1000 })),
      client.selectRows("tn_lessons", {
        select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,group_account_id,lesson_date,start_time,duration_minutes,status,lesson_source,schedule_v2_kind,revision,updated_at",
        filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "lesson_date.asc,start_time.asc",
        limit: 2000,
      })
        .catch(() => client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,group_account_id,lesson_date,start_time,duration_minutes,status,lesson_source,updated_at",
          filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
          order: "lesson_date.asc,start_time.asc",
          limit: 2000,
        })
          .catch(() => client.selectRows("tn_lessons", {
            select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source,updated_at",
            filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
            order: "lesson_date.asc,start_time.asc",
            limit: 2000,
          }))),
      fullAdminAccess ? client.selectRows("tn_regular_schedule_rules", {
        select: "id,ticket_id,coach_role_id,day_of_week,start_time,duration_minutes,effective_start_on,effective_end_on,status,updated_at",
        filters: { status: "active" },
        order: "ticket_id.asc,day_of_week.asc,start_time.asc",
        limit: 1000,
      }).catch(() => []) : Promise.resolve([]),
      fullAdminAccess ? client.selectRows("tn_one_day_bookings", {
        select: "id,branch_id,coach_role_id,booking_date,start_time,duration_minutes,guest_name,guest_phone,note,status,linked_user_id,booking_source,payment_status,payment_method,payment_amount,created_at",
        filters: { booking_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "booking_date.asc,start_time.asc",
        limit: 1000,
      }).catch(() => client.selectRows("tn_one_day_bookings", {
        select: "id,branch_id,coach_role_id,booking_date,start_time,duration_minutes,guest_name,guest_phone,note,status,linked_user_id,created_at",
        filters: { booking_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "booking_date.asc,start_time.asc",
        limit: 1000,
      }).catch(() => [])) : Promise.resolve([]),
      fullAdminAccess ? rosterRows("enrollments", () => client.selectRows("tn_member_enrollments", { select: "id,user_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,submitted_at,approved_at", limit: 500 }).catch(() => [])) : Promise.resolve([]),
      rosterRows("changeRequests", () => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_by,decided_at,created_at,updated_at",
        limit: 500,
      }).catch(() => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_by,decided_at,created_at",
        limit: 500,
      }).catch(() => []))),
      rosterRows("makeupEntitlements", () => client.selectRows("tn_makeup_entitlements", { select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at", limit: 500 }).catch(() => [])),
      // The initial screen only needs records inside the operational window. Complete
      // history is loaded once when the administrator opens 결제/정산.
      rosterRows("lessonRecords", () => Promise.resolve(adminLiveDataState.lessonRecords || [])),
      Promise.resolve(adminLiveDataState.curriculumRefs || []),
      Promise.resolve(adminLiveDataState.journalEntries || []),
      Promise.resolve(adminLiveDataState.mediaFiles || []),
      fullAdminAccess ? rosterRows("operationalPayments", () => client.selectRows("tn_payments", { select: "id,user_id,branch_id,provider,provider_payment_id,product_id,ticket_id,one_day_booking_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,bank_account_snapshot,depositor_name_snapshot,deposit_due_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at", order: "created_at.desc", limit: 500 }).catch(() => [])) : Promise.resolve([]),
      rosterRows("groupAccounts", () => client.selectRows("tn_group_accounts", { select: "id,branch_id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required", limit: 200 }).catch(() => [])),
      rosterRows("groupMembers", () => client.selectRows("tn_group_account_members", { select: "group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay", limit: 500 }).catch(() => [])),
      rosterRows("groupTicketLinks", () => (client.selectAllRows || client.selectRows).call(client, "tn_group_ticket_links", { select: "group_account_id,user_id,ticket_id,status", pageSize: 500 }).catch(() => [])),
      fullAdminAccess ? rosterRows("memberDatabaseRecords", () => Promise.resolve(adminLiveDataState.memberDatabaseRecords || [])) : Promise.resolve([]),
      fullAdminAccess ? rosterRows("memberMembershipRecords", () => Promise.resolve(adminLiveDataState.memberMembershipRecords || [])) : Promise.resolve([]),
      rosterRows("substituteAssignments", () => Promise.resolve(adminLiveDataState.substituteAssignments || [])),
      // Complete inactive-ticket history is a settlement-only dependency.
      Promise.resolve([]),
    ]);

    if (options.abortIfDirty && adminHasUnsavedChanges()) {
      Object.assign(state, {
        liveScheduleLoading: false,
        liveScheduleMessage: "작성 중인 변경사항을 보호하기 위해 서버 새로고침을 미뤘습니다.",
      });
      return false;
    }

    const usersById = new Map((serverUsers || []).map((user) => [user.id, user]));
    const authLinksByUserId = new Map();
    (serverAuthLinks || []).forEach((link) => {
      const links = authLinksByUserId.get(link.user_id) || [];
      links.push(link);
      authLinksByUserId.set(link.user_id, links);
    });
    const productsById = new Map((serverProducts || []).map((product) => [product.id, product]));
    const ticketParticipantIdsByTicketId = new Map();
    (ticketParticipants || []).forEach((participant) => {
      const ids = ticketParticipantIdsByTicketId.get(participant.ticket_id) || [];
      ids.push(participant.user_id);
      ticketParticipantIdsByTicketId.set(participant.ticket_id, ids);
    });
    const firstLessonByTicketId = new Map();
    (serverLessons || []).forEach((lesson) => {
      if (
        lesson.member_ticket_id
        && lesson.status !== "cancelled"
        && lesson.lesson_date
        && !firstLessonByTicketId.has(lesson.member_ticket_id)
      ) {
        firstLessonByTicketId.set(lesson.member_ticket_id, lesson);
      }
    });
    const memberRecordByUserId = new Map((serverMemberDatabaseRecords || []).map((record) => [record.user_id, record]));
    const memberRecordByTicketId = new Map((serverMemberDatabaseRecords || [])
      .filter((record) => record.current_ticket_id)
      .map((record) => [record.current_ticket_id, record]));
    const membershipRecordByTicketId = new Map((serverMemberMembershipRecords || [])
      .filter((record) => record.ticket_id)
      .map((record) => [record.ticket_id, record]));
    const { coachIdByRole, pendingAuthSwitchByUserId } = applyServerCoachSnapshot({
      serverUsers: serverUsers || [],
      serverCoachRoles: serverCoachRoles || [],
      serverCoachAvailability: serverCoachAvailability || [],
      serverAuthLinks: serverAuthLinks || [],
      serverAuthSwitches: serverAuthSwitches || [],
      serverSettlementTerms: serverSettlementTerms || [],
    });

    const mappedTickets = (serverTickets || []).map((ticket) => {
      const product = productsById.get(ticket.product_id) || {};
      const memberRecord = membershipRecordByTicketId.get(ticket.id)
        || memberRecordByTicketId.get(ticket.id)
        || null;
      const productGroupSize = Number(product.group_size) || 1;
      const rawParticipantUserIds = liveTicketParticipantIds(ticket, ticketParticipantIdsByTicketId);
      const participantUserIds = product.id && productGroupSize === 1
        ? [ticket.user_id].filter(Boolean)
        : rawParticipantUserIds;
      const memberNames = participantUserIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      return {
        id: ticket.id,
        serverTicketId: ticket.id,
        serverUserId: ticket.user_id,
        productId: ticket.product_id,
        participantUserIds,
        branchId: ticket.branch_id,
        coachRoleId: ticket.coach_role_id,
        member: memberNames.join("&") || usersById.get(ticket.user_id)?.name || "회원 확인 필요",
        coachId: coachIdByRole.get(ticket.coach_role_id) || "",
        product: product.name || `${product.lesson_minutes || 20}분 회원권`,
        weeklyCount: Number(memberRecord?.lesson_frequency_per_week || product.frequency_per_week) || 1,
        total: Number(ticket.total_sessions) || 0,
        used: Number(ticket.used_sessions) || 0,
        remaining: Number(ticket.remaining_sessions) || 0,
        purchased: ticket.starts_on,
        expires: ticket.expires_on,
        amount: Number(ticket.purchased_price) || 0,
        lessonKind: product.id
          ? (productGroupSize === 2 ? "2대1" : liveTicketLessonKind(product))
          : memberRecord?.lesson_type === "one_on_two" ? "2대1" : "개인",
        lessonTypeCode: product.id
          ? (productGroupSize === 2 ? "one_on_two" : "one_on_one")
          : memberRecord?.lesson_type || "one_on_one",
        lessonDays: Array.isArray(memberRecord?.lesson_days) ? memberRecord.lesson_days.map(Number) : [],
        actualLessonStart: memberRecord?.lesson_start_on || ticket.starts_on,
        groupSize: productGroupSize,
        durationMinutes: Number(product.lesson_minutes) || 20,
        maxSessionsPerDay: Number(product.max_sessions_per_day) || 0,
        maxSessionsPerWeek: Number(product.max_sessions_per_week) || 0,
        maxBookingDaysPerWeek: Number(product.max_booking_days_per_week) || 0,
        productKind: product.product_kind || "regular",
        scheduleScope: memberRecord?.lesson_schedule_scope || liveTicketScheduleScope(product, ticket, firstLessonByTicketId),
        status: ticket.status,
        serverUpdatedAt: ticket.updated_at || "",
        memberRecord,
      };
    });

    const activeTickets = mappedTickets.filter((ticket) => isCurrentMemberTicket(ticket));
    const settlementTicketContext = {
      products: serverProducts || [],
      users: serverUsers || [],
      coachIdByRole,
    };
    const mappedSettlementTickets = serverSettlementTickets?.length
      ? mapAdminSettlementTicketRows(serverSettlementTickets, settlementTicketContext)
      : adminLiveDataState.settlementTickets?.length
        ? adminLiveDataState.settlementTickets
        : mapAdminSettlementTicketRows(serverTickets || [], settlementTicketContext);
    const activeTicketIds = new Set(activeTickets.map((ticket) => ticket.serverTicketId));
    replaceArray(tickets, activeTickets);
    replaceArray(expiredTickets, mappedTickets
      .filter((ticket) => !activeTicketIds.has(ticket.serverTicketId))
      .map((ticket) => ({
        ...ticket,
        statusLabel: memberTicketStatusLabel(ticket),
      })));

    const ticketsByParticipantUserId = new Map();
    mappedTickets.forEach((ticket) => {
      ticket.participantUserIds.forEach((userId) => {
        const rows = ticketsByParticipantUserId.get(userId) || [];
        rows.push(ticket);
        ticketsByParticipantUserId.set(userId, rows);
      });
    });
    const paymentsByUserId = new Map();
    (serverPayments || []).forEach((payment) => {
      const rows = paymentsByUserId.get(payment.user_id) || [];
      rows.push(payment);
      paymentsByUserId.set(payment.user_id, rows);
    });
    const enrollmentByUserId = new Map();
    (serverEnrollments || [])
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))
      .forEach((enrollment) => {
        if (!enrollmentByUserId.has(enrollment.user_id)) enrollmentByUserId.set(enrollment.user_id, enrollment);
      });
    const memberUserGroups = (serverUsers || [])
      .filter((user) => !user.merged_into_user_id)
      .filter((user) => !user.permanently_deleted_at)
      .filter((user) => (
        user.role === "member"
        || (ticketsByParticipantUserId.get(user.id) || []).some((ticket) => isCurrentMemberTicket(ticket))
      ))
      .map((user) => ({
        name: user.name || "이름 확인 필요",
        userGroup: [user],
      }));
    const currentMembers = [...members];
    let nextMemberId = Math.max(1000, ...currentMembers.map((member) => Number(member.id) || 0)) + 1;
    const mappedMembers = memberUserGroups.map(({ name, userGroup }) => {
      const userIds = userGroup.map((user) => user.id);
      const memberTickets = [...new Map(
        userIds
          .flatMap((userId) => ticketsByParticipantUserId.get(userId) || [])
          .map((ticket) => [ticket.id, ticket]),
      ).values()];
      const activeTicket = memberTickets.find((ticket) => isCurrentMemberTicket(ticket)) || null;
      const pendingTicket = memberTickets.find((ticket) => ticket.status === "pending_payment") || null;
      const memberPayments = userIds.flatMap((userId) => paymentsByUserId.get(userId) || []);
      const unlinkedVerifiedPayments = memberPayments.filter((payment) => (
        payment.status === "verified" && !payment.ticket_id && !payment.one_day_booking_id
      ));
      const actionableUnlinkedPayment = unlinkedVerifiedPayments
        .filter((payment) => payment.provider !== "google_sheet_history")
        .sort((left, right) => String(right.verified_at || right.paid_at || right.created_at || "")
          .localeCompare(String(left.verified_at || left.paid_at || left.created_at || "")))[0] || null;
      const displayTicket = activeTicket || pendingTicket || memberTickets
        .slice()
        .sort((left, right) => String(right.expires || "").localeCompare(String(left.expires || "")))[0] || null;
      const preferredUser = userGroup.find((user) => user.role === "admin") || userGroup[0];
      const memberRecord = memberRecordByUserId.get(preferredUser.id) || null;
      const enrollment = userIds.map((userId) => enrollmentByUserId.get(userId)).find(Boolean) || null;
      const enrollmentBranchId = productsById.get(enrollment?.requested_product_id)?.branch_id || "";
      const paymentBranchId = productsById.get(actionableUnlinkedPayment?.product_id)?.branch_id || "";
      const existing = currentMembers.find((member) => (
        member.serverUserId === preferredUser.id
        || (member.serverUserIds?.length === 1 && member.serverUserIds[0] === preferredUser.id)
      ));
      const currentMemberKind = String(preferredUser.member_kind || "journal_only");
      const authLinks = userIds.flatMap((userId) => authLinksByUserId.get(userId) || []);
      const authProviders = authProvidersFromLinks(authLinks);
      const authSwitch = userIds.map((userId) => pendingAuthSwitchByUserId.get(userId)).find(Boolean) || null;
      const authLinked = userGroup.some((user) => Boolean(user.auth_user_id)) || authLinks.length > 0;
      const serverStatus = String(preferredUser.status || "active");
      const status = ["inactive", "archived"].includes(serverStatus)
        ? "inactive"
        : activeTicket
          ? "active"
          : pendingTicket
            ? "pending"
          : actionableUnlinkedPayment
            ? "pending"
          : memberRecord?.record_status === "pending"
            ? "pending"
          : currentMemberKind === "lesson_pending" || ["submitted", "needs_update"].includes(String(enrollment?.status || ""))
            ? "pending"
            : currentMemberKind === "journal_only"
              ? "journal"
              : "expired";
	      return {
	        id: existing?.id || nextMemberId++,
	        name,
        nickname: preferredUser.nickname || "",
        status,
        memberKind: currentMemberKind,
        statusLabel: status === "inactive" ? "삭제회원" : status === "pending" ? "가입서·결제대기" : status === "journal" ? "운동노트 회원" : status === "active" ? "수강중" : "만료회원",
        serverStatus,
        coach: displayTicket
          ? getCoachName(displayTicket.coachId)
          : getCoachName(coachIdByRole.get(memberRecord?.coach_role_id) || "") || "미배정",
        regularTime: memberRecord?.lesson_days?.length ? memberRecord.lesson_days.map((day) => memberManagementDayLabel(Number(day))).join(" · ") : "시간표에서 확인",
        remaining: memberRecord?.remaining_sessions ?? activeTicket?.remaining ?? 0,
        lessonType: memberRecord ? memberManagementLessonTypeLabel(memberRecord.lesson_type) : displayTicket?.product || "회원권 없음",
        source: memberRecord?.source_name || (enrollment ? "앱 수강 가입서" : "Supabase 실데이터"),
        note: memberRecord?.admin_note || (actionableUnlinkedPayment
          ? "결제 완료 · 회원권 발급 필요"
          : status === "active"
            ? "실서버 회원권 연결"
            : status === "journal"
              ? "운동노트만 이용 중"
              : status === "pending"
                ? "가입서 제출 완료 · 결제 확인 필요"
                : "회원권 등록 또는 연장 확인 필요"),
        photoUrl: preferredUser.profile_photo_url || existing?.photoUrl || "",
        authRole: preferredUser.role || "member",
        authLinked,
        authProviders,
        authLinks,
        authSwitch,
        authLastSignInAt: authLinks.map((link) => link.last_sign_in_at).filter(Boolean).sort().at(-1) || "",
        serverUserId: preferredUser.id,
        serverUserIds: userIds,
        branchId: memberRecord?.branch_id || displayTicket?.branchId || enrollmentBranchId || paymentBranchId || "",
        branchIds: [...new Set([
          memberRecord?.branch_id,
          ...memberTickets.map((ticket) => ticket.branchId),
          enrollmentBranchId,
          paymentBranchId,
        ].filter(Boolean).map(String))],
        phone: preferredUser.phone || enrollment?.phone || "",
        birthYear: preferredUser.birth_year || enrollment?.birth_year || "",
        neighborhood: preferredUser.neighborhood || enrollment?.neighborhood || "",
        gender: preferredUser.gender || enrollment?.gender || "",
        dominantHand: preferredUser.dominant_hand || "",
        backhandStyle: preferredUser.backhand_style || "",
        tennisStartedOn: preferredUser.tennis_started_on || "",
        selfNtrp: preferredUser.self_ntrp ?? "",
        coachNtrp: preferredUser.coach_ntrp ?? "",
        tennisGoal: preferredUser.tennis_goal || "",
        playStyleMemo: preferredUser.play_style_memo || "",
        enrollment,
        memberRecord,
        unlinkedVerifiedPayment: actionableUnlinkedPayment,
      };
    });
    replaceArray(members, mappedMembers);

    const participantIdsByLesson = new Map();
    (lessonParticipants || []).forEach((participant) => {
      const ids = participantIdsByLesson.get(participant.lesson_id) || [];
      ids.push(participant.user_id);
      participantIdsByLesson.set(participant.lesson_id, ids);
    });
    const mappedTicketById = new Map(mappedTickets.map((ticket) => [ticket.id, ticket]));
    const lessonRecordByLessonId = new Map((serverLessonRecords || []).map((record) => [record.lesson_id, record]));
    const activeSubstituteByLessonId = new Map((serverSubstituteAssignments || [])
      .filter((assignment) => assignment.status === "assigned")
      .map((assignment) => [assignment.lesson_id, assignment]));
    const slotCounts = new Map();
    let mappedLessons = (serverLessons || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const participantIds = participantIdsByLesson.get(lesson.id) || [];
        const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
        const ticket = mappedTicketById.get(lesson.member_ticket_id);
        const lessonRecord = lessonRecordByLessonId.get(lesson.id);
        const slotKey = `${lesson.lesson_date}-${String(lesson.start_time || "").slice(0, 5)}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const sourceLabel = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "대타"
              : ticket?.lessonKind || "개인";
        return {
          id: lesson.id,
          serverLessonId: lesson.id,
          serverStatus: lesson.status,
          serverRevision: Number(lesson.revision) || null,
          serverUpdatedAt: lesson.updated_at || "",
          serverParticipantUserIds: participantIds,
          branchId: lesson.branch_id,
          ticketId: lesson.member_ticket_id,
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          substituteAssignment: activeSubstituteByLessonId.get(lesson.id) || null,
          day: scheduleDays[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          lessonDate: lesson.lesson_date,
          time: String(lesson.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(lesson.coach_role_id) || "",
          originalCoachId: coachIdByRole.get(lesson.original_coach_role_id) || "",
          member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
          type: sourceLabel,
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketRemaining: Number(ticket?.remaining) || 0,
          ticketProduct: ticket?.product || "회원권 확인 필요",
          status: liveLessonStatus(lesson.status),
          makeup: lesson.lesson_source === "makeup",
          lessonSource: lesson.schedule_v2_kind || lesson.lesson_source || "regular",
          scheduleV2Kind: lesson.schedule_v2_kind || "",
          deductedSessions: lessonRecord ? Number(lessonRecord.deducted_sessions) || 0 : null,
          completedAt: lessonRecord?.completed_at || "",
        };
      })
      .sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));

    const mappedOneDayBookings = (serverOneDayBookings || [])
      .filter((booking) => !["cancelled", "archived"].includes(booking.status))
      .map((booking) => {
        const slotKey = `${booking.booking_date}-${String(booking.start_time || "").slice(0, 5)}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const date = new Date(`${booking.booking_date}T00:00:00`);
        const dayIndex = date.getDay();
        return {
          id: `one-day-${booking.id}`,
          serverOneDayBookingId: booking.id,
          serverStatus: booking.status,
          oneDayBooking: true,
          branchId: booking.branch_id,
          ticketId: "",
          coachRoleId: booking.coach_role_id,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          lessonDate: booking.booking_date,
          time: String(booking.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(booking.coach_role_id) || "",
          member: booking.guest_name || "원데이 방문자",
          guestPhone: booking.guest_phone || "",
          linkedUserId: booking.linked_user_id || "",
          oneDayNote: booking.note || "",
          oneDayBookingSource: booking.booking_source || "walk_in",
          oneDayPaymentStatus: booking.payment_status || "unpaid",
          oneDayPaymentMethod: booking.payment_method || "",
          oneDayPaymentAmount: Math.max(0, Number(booking.payment_amount) || 0),
          type: "원데이",
          durationMinutes: Number(booking.duration_minutes) || 20,
          status: liveLessonStatus(booking.status),
          makeup: false,
          lessonSource: "one_day",
        };
      });
    mappedLessons.push(...mappedOneDayBookings);
    mappedLessons.sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));

    const serverLessonById = new Map((serverLessons || []).map((lesson) => [lesson.id, lesson]));
    const mappedMakeupEntitlements = (serverMakeupEntitlements || []).map((entitlement) => {
      const sourceLesson = serverLessonById.get(entitlement.source_lesson_id) || {};
      const bookedLesson = serverLessonById.get(entitlement.booked_lesson_id) || {};
      const participantIds = participantIdsByLesson.get(entitlement.source_lesson_id) || [];
      const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      const ticket = mappedTicketById.get(entitlement.ticket_id) || {};
      return {
        id: entitlement.id,
        sourceLessonId: entitlement.source_lesson_id,
        bookedLessonId: entitlement.booked_lesson_id || "",
        ticketId: entitlement.ticket_id,
        branchId: sourceLesson.branch_id || ticket.branchId || "",
        coachId: coachIdByRole.get(entitlement.coach_role_id) || "",
        memberNames,
        member: memberNames.join("&") || ticket.member || "회원 확인 필요",
        durationMinutes: Number(entitlement.duration_minutes) || ticket.durationMinutes || 20,
        status: entitlement.status,
        reason: entitlement.reason || "회원 사전 불참",
        originalDate: sourceLesson.lesson_date || "",
        originalTime: String(sourceLesson.start_time || "").slice(0, 5),
        originalLabel: `${sourceLesson.lesson_date || "기존일"} ${String(sourceLesson.start_time || "").slice(0, 5)}`.trim(),
        bookedDate: bookedLesson.lesson_date || "",
        bookedTime: String(bookedLesson.start_time || "").slice(0, 5),
      };
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const releasedRegularMakeupSlots = mappedMakeupEntitlements
      .flatMap((entitlement) => {
        const sourceLesson = serverLessonById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return [];
        if (!entitlement.originalDate || !entitlement.originalTime) return [];
        const releasedInterval = {
          start: timeToMinutes(entitlement.originalTime),
          end: timeToMinutes(entitlement.originalTime) + entitlement.durationMinutes,
        };
        const occupyingLesson = mappedLessons.find((lesson) => (
          lesson.lessonDate === entitlement.originalDate
          && lesson.coachId === entitlement.coachId
          && intervalsOverlap(releasedInterval, lessonInterval(lesson))
        ));
        if (occupyingLesson) {
          occupyingLesson.releasedOriginMember = entitlement.member;
          occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
          return [];
        }
        const slotKey = `${entitlement.originalDate}-${entitlement.originalTime}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const historicalReleasedSlot = entitlement.originalDate < todayIso;
        return [{
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          historicalReleasedSlot,
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          serverStatus: "available",
          branchId: entitlement.branchId,
          ticketId: entitlement.ticketId,
          day: scheduleDays[new Date(`${entitlement.originalDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${entitlement.originalDate}T00:00:00`).getDay() - 1],
          lessonDate: entitlement.originalDate,
          time: entitlement.originalTime,
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: entitlement.coachId,
          member: entitlement.member,
          memberNames: entitlement.memberNames,
          releasedOriginalMember: entitlement.member,
          type: historicalReleasedSlot ? "정규 · 불참 · 차감 없음" : "정규 · 불참 · 보강·원데이 가능",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          makeup: true,
          lessonSource: "makeup",
        }];
      });
    mappedLessons.push(...releasedRegularMakeupSlots);
    mappedLessons.sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));
    replaceArray(state.makeupEntitlements, mappedMakeupEntitlements);

    const mappedEntitlementRequests = mappedMakeupEntitlements.map((item) => ({
      id: `entitlement-${item.id}`,
      entitlementId: item.id,
      sourceLessonId: item.sourceLessonId,
      branchId: item.branchId,
      makeupType: "entitlement",
      member: item.member,
      original: `${item.originalLabel} ${getCoachName(item.coachId)}`.trim(),
      requested: item.status === "booked" ? `${item.bookedDate} ${item.bookedTime}`.trim() : "회원 시간 선택 대기",
      policy: "직원 불참 처리",
      reason: item.reason,
      status: item.status === "open" ? "requested" : item.status === "booked" ? "approved" : "rejected",
      statusLabel: item.status === "open" ? "보강선택필요" : item.status === "booked" ? "보강예약완료" : "종료",
    }));

    const mappedChangeRequests = (serverChangeRequests || []).map((request) => {
      const lesson = serverLessonById.get(request.lesson_id) || {};
      const coachId = coachIdByRole.get(lesson.coach_role_id) || "";
      const statusLabel = request.status === "approved" || request.status === "auto_approved"
        ? "승인완료"
        : request.status === "rejected"
          ? "거절"
          : request.policy_window === "coach_approval_within_24h"
            ? "담당 코치·관리자 승인 필요"
            : "승인대기";
      const originalDate = request.original_lesson_date || lesson.lesson_date || "";
      const originalTime = String(request.original_start_time || lesson.start_time || "").slice(0, 5);
      const policySnapshot = request.policy_snapshot && typeof request.policy_snapshot === "object" ? request.policy_snapshot : null;
      return {
        id: request.id,
        serverRequestId: request.id,
        lessonId: request.lesson_id,
        branchId: lesson.branch_id || "",
        member: usersById.get(request.requester_user_id)?.name || "회원 확인 필요",
        original: `${originalDate || "기존일"} ${originalTime} ${getCoachName(coachId)}`,
        requested: `${request.requested_lesson_date || "변경일"} ${String(request.requested_start_time || "").slice(0, 5)}`,
        policy: adminLessonChangePolicyText(request),
        policySnapshot,
        reason: request.reason === "정책상 사유 없음" ? "사유 없음" : request.reason || "",
        requestedAtLabel: adminLessonChangeRequestedAt(request.created_at || request.updated_at),
        remainingTime: adminLessonChangeRemaining(originalDate, originalTime),
        status: request.status,
        statusLabel,
        createdAt: request.created_at || request.updated_at || "",
      };
    });
    replaceArray(makeupRequests, mappedEntitlementRequests.concat(mappedChangeRequests));

    const mappedLessonNotes = (serverLessonRecords || []).map((record) => {
      const lesson = serverLessonById.get(record.lesson_id) || {};
      const ticket = mappedTicketById.get(lesson.member_ticket_id);
      const participantIds = participantIdsByLesson.get(record.lesson_id) || ticket?.participantUserIds || [];
      const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      return {
        id: record.id,
        serverRecordId: record.id,
        serverLessonId: record.lesson_id,
        coachRoleId: record.coach_role_id,
        member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
        lesson: `${lesson.lesson_date || "수업일"} ${String(lesson.start_time || "").slice(0, 5)} ${getCoachName(coachIdByRole.get(record.coach_role_id) || "")}`,
        reflection: record.coach_comment || "코치 코멘트 없음",
        next: record.next_curriculum_ref_id ? "다음 커리큘럼 등록됨" : "다음 커리큘럼 미등록",
        nextCurriculumRefId: record.next_curriculum_ref_id || "",
        completedAt: record.completed_at || "",
        status: "confirmed",
        statusLabel: "확인완료",
        deductedSessions: Number(record.deducted_sessions) || 0,
      };
    });
    replaceArray(lessonNotes, mappedLessonNotes);

    const mappedPayments = (serverPayments || []).map((payment) => billingRowFromServerPayment({
      ...payment,
      member: usersById.get(payment.user_id)?.name || "회원 확인 필요",
    }));
    replaceArray(billings, mappedPayments);
    replaceArray(billingLogs, [`서버 결제 ${mappedPayments.length}건 동기화`]);
    const groupMembersByAccount = new Map();
    (serverGroupMembers || []).forEach((member) => {
      const list = groupMembersByAccount.get(member.group_account_id) || [];
      list.push(member);
      groupMembersByAccount.set(member.group_account_id, list);
    });
    const groupTicketIdsByAccount = new Map();
    (serverGroupTicketLinks || []).forEach((link) => {
      const list = groupTicketIdsByAccount.get(link.group_account_id) || [];
      if (link.ticket_id && !list.includes(link.ticket_id)) list.push(link.ticket_id);
      groupTicketIdsByAccount.set(link.group_account_id, list);
    });
    replaceArray(groupAccounts, (serverGroupAccounts || []).map((account) => {
      const accountMembers = (groupMembersByAccount.get(account.id) || [])
        .sort((left, right) => Number(left.participant_order || 0) - Number(right.participant_order || 0));
      const linkedLesson = (serverLessons || []).find((lesson) => lesson.group_account_id === account.id)
        || (serverLessons || []).find((lesson) => (groupTicketIdsByAccount.get(account.id) || []).includes(lesson.member_ticket_id));
      return {
        id: account.id,
        serverAccount: true,
        name: account.display_name || accountMembers.map((member) => member.display_name || usersById.get(member.user_id)?.name).filter(Boolean).join(" · "),
        coachId: coachIdByRole.get(account.coach_role_id) || "",
        schedule: linkedLesson ? `${linkedLesson.lesson_date} ${String(linkedLesson.start_time || "").slice(0, 5)}` : "시간표 미등록",
        paymentMode: account.payment_mode || "representative",
        nextPayer: usersById.get(account.next_payer_user_id)?.name || accountMembers.find((member) => member.user_id === account.next_payer_user_id)?.display_name || "미지정",
        nextPayerUserId: account.next_payer_user_id || "",
        scheduleSyncRequired: account.schedule_sync_required !== false,
        ticketIds: groupTicketIdsByAccount.get(account.id) || [],
        members: accountMembers.map((member) => ({
          userId: member.user_id,
          name: member.display_name || usersById.get(member.user_id)?.name || "회원",
          appStatus: member.app_status || "not_joined",
          canManageSchedule: Boolean(member.can_manage_schedule),
          canPay: Boolean(member.can_pay),
        })),
      };
    }));
    Object.assign(serverPaymentSyncState, {
      loaded: true,
      directLoaded: false,
      loading: false,
      lastLoadedAt: Date.now(),
      message: `서버 결제 ${mappedPayments.length}건 확인`,
      tone: "good",
    });

    const keepLoadedSchedule = shouldProtectLoadedSchedule(serverLessons, mappedLessons);
    if (keepLoadedSchedule) {
      mappedLessons = lessons.map((lesson) => ({ ...lesson }));
      billingLogs.unshift("시간표 보호: 비어 있거나 불완전한 서버 응답으로 기존 시간표를 덮어쓰지 않았습니다.");
    }

    Object.assign(adminLiveDataState, {
      branches: serverBranches || [],
      lessons: mappedLessons,
      users: serverUsers || [],
      coachRoles: serverCoachRoles || [],
      authLinks: serverAuthLinks || [],
      authSwitches: serverAuthSwitches || [],
      coachSettlementTerms: serverSettlementTerms || [],
      tickets: mappedTickets,
      settlementTickets: mappedSettlementTickets,
      products: serverProducts || [],
      participantRows: lessonParticipants || [],
      changeRequests: serverChangeRequests || [],
      makeupEntitlements: mappedMakeupEntitlements,
      lessonRecords: serverLessonRecords || [],
      curriculumRefs: serverCurriculumRefs || [],
      journalEntries: serverJournalEntries || [],
      mediaFiles: serverMediaFiles || [],
      payments: serverPayments || [],
      groupAccounts: serverGroupAccounts || [],
      groupMembers: serverGroupMembers || [],
      groupTicketLinks: serverGroupTicketLinks || [],
      memberDatabaseRecords: serverMemberDatabaseRecords || [],
      memberMembershipRecords: serverMemberMembershipRecords || [],
      regularScheduleRules: serverRegularScheduleRules || [],
      substituteAssignments: serverSubstituteAssignments || [],
      lessonWindow,
    });
    // Keep the confirmed directory page visible while the full operational
    // snapshot refreshes. Clearing it here briefly exposed the legacy local
    // member array and made the list jump from the current roster to 1,000+
    // imported rows before the directory RPC completed.
    invalidateMemberSearchIndex({ preserveDirectory: true });
    saveScheduleSafetySnapshot(lessons, keepLoadedSchedule ? "protected-refresh" : "before-server-refresh");
    replaceArray(lessons, mappedLessons);
    saveScheduleSafetySnapshot(lessons, keepLoadedSchedule ? "protected-refresh" : "server-refresh");
    refreshMembershipProductDraftsFromServer(serverProducts || []);
    if (!wasLoaded) state.activeAdminWeekIndex = 0;
    Object.assign(state, {
      liveScheduleLoaded: true,
      liveScheduleLoading: false,
      liveScheduleMessage: keepLoadedSchedule
        ? `시간표 보호 모드: 기존 ${mappedLessons.length}건 유지`
        : `실서버 시간표 ${mappedLessons.length}건 동기화`,
    });
    await adminSettingsPromise;
    adminLazyDataState.delete("records-support");
    adminLazyDataState.delete("settlement-support");
    if (state.view === "notes") {
      await loadAdminDataOnce("records-support", loadAdminRecordsSupportData);
    }
    if (state.view === "billing") {
      void loadAdminDataOnce("settlement-support", loadAdminSettlementSupportData).then((changed) => {
        if (changed && state.view === "billing") renderAdminView("billing");
      });
    }
    syncAdminScheduleWeek();
    if (!mappedMembers.some((member) => member.id === state.selectedMemberId)) {
      state.selectedMemberId = null;
    }
    renderAll();
    void adminOperationalRevisionWatcher?.check?.();
    window.dispatchEvent(new CustomEvent("tennisnote:admin-live-data", {
      detail: { source: "server-sync", branchId: activeOperationBranchId() },
    }));
    if (state.view === "members" && fullAdminAccess) {
      void loadAdminMemberDirectoryPage({ force: true, preserveList: true });
    }
    scheduleAdminOperationalCacheWrite();
    adminLiveScheduleLastRefreshAt = Date.now();
    return true;
  } catch (error) {
    Object.assign(state, {
      liveScheduleLoaded: wasLoaded,
      liveScheduleLoading: false,
      liveScheduleMessage: `실서버 시간표 확인 실패: ${error?.message || "server_error"}`,
    });
    renderDataTools();
    return false;
  }
}

function cancelAdminInitialLiveSync() {
  if (!adminInitialLiveSyncHandle) return;
  if (adminInitialLiveSyncKind === "idle" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(adminInitialLiveSyncHandle);
  } else {
    window.clearTimeout(adminInitialLiveSyncHandle);
  }
  adminInitialLiveSyncHandle = 0;
  adminInitialLiveSyncKind = "";
}

async function signInAdminWithPassword(event) {
  event?.preventDefault();
  const client = window.TennisNoteDataClient;
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  const password = String($("#operationsLoginPassword")?.value || "");
  if (!client?.signInWithPassword || !client.readiness?.().ready) {
    blockServerPreview("관리자 로그인 연결을 먼저 확인해 주세요.");
    return;
  }
  if (!email || !password) {
    blockServerPreview("관리자 이메일과 비밀번호를 입력해 주세요.");
    return;
  }
  const remember = $("#operationsRememberLogin")?.checked !== false;
  localStorage.setItem(operationsRememberStorageKey, remember ? "true" : "false");
  client.setSessionPersistence?.(remember);
  const button = $("#operationsPasswordLoginForm button[type=submit]");
  if (button) button.disabled = true;
  Object.assign(adminImportAuthState, { loading: true, message: "관리자 계정을 확인하고 있습니다." });
  renderOperationsLoginGate();
  try {
    await client.signInWithPassword(email, password);
    if ($("#operationsLoginPassword")) $("#operationsLoginPassword").value = "";
    await refreshAdminImportAuthState();
  } catch (error) {
    Object.assign(adminImportAuthState, { loading: false, user: null, profile: null, message: "관리자 이메일 또는 비밀번호를 확인해 주세요." });
    renderOperationsLoginGate();
  } finally {
    if (button) button.disabled = false;
  }
}

async function sendAdminPasswordReset() {
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  if (!email) {
    blockServerPreview("먼저 관리자 이메일을 입력해 주세요.");
    return;
  }
  const button = $("#sendAdminPasswordResetButton");
  if (button) button.disabled = true;
  try {
    const adminResetRedirect = `${window.location.origin}${window.location.pathname}`;
    await window.TennisNoteDataClient.sendPasswordResetEmail(email, adminResetRedirect);
    blockServerPreview("비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 직접 비밀번호를 설정해 주세요.");
  } catch (error) {
    blockServerPreview("비밀번호 재설정 메일을 보내지 못했습니다. 이메일 주소와 메일 설정을 확인해 주세요.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function createAdminEmailAccount() {
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  const password = String($("#operationsLoginPassword")?.value || "");
  if (!email || !password) {
    blockServerPreview("이메일과 새 비밀번호를 입력해 주세요.");
    return;
  }
  const button = $("#createAdminEmailAccountButton");
  if (button) button.disabled = true;
  try {
    await window.TennisNoteDataClient.signUpWithPassword(email, password);
    if ($("#operationsLoginPassword")) $("#operationsLoginPassword").value = "";
    blockServerPreview("가입 요청을 완료했습니다. Gmail 인증 후 기존 관리자에게 권한 승인을 받아 주세요.");
  } catch (error) {
    blockServerPreview("계정 생성에 실패했습니다. 이미 가입된 이메일인지와 비밀번호 조건을 확인해 주세요.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function approveAdminPendingUser(userId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) return;
  const role = document.querySelector(`[data-admin-pending-role="${userId}"]`)?.value || "member";
  const displayName = document.querySelector(`[data-admin-pending-display="${userId}"]`)?.value || "";
  Object.assign(adminPendingUsersState, { loading: true, message: "신규 가입자 승인 중입니다." });
  renderAdminPendingUsers();
  try {
    await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "approve_user", userId, role, displayName },
    });
    showToast(role === "coach" ? "코치 권한 승인 완료" : "회원 승인 완료");
    await refreshAdminPendingUsers();
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      message: `승인 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
    renderAdminPendingUsers();
  }
}

async function holdAdminPendingUser(userId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) return;
  Object.assign(adminPendingUsersState, { loading: true, message: "신규 가입자 보류 처리 중입니다." });
  renderAdminPendingUsers();
  try {
    await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "hold_user", userId },
    });
    showToast("신규 가입자 보류 처리 완료");
    await refreshAdminPendingUsers();
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      message: `보류 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
    renderAdminPendingUsers();
  }
}

function exportRowsByDataset(includePrivate = false) {
  return {
    members: {
      label: "회원",
      rows: [
        ["회원명", "상태", "담당코치", "정규시간", "회원권", "잔여횟수", ...(includePrivate ? ["연락처"] : [])],
        ...members.map((member) => [
          member.name,
          member.statusLabel,
          member.coach,
          member.regularTime,
          member.lessonType,
          member.remaining,
          ...(includePrivate ? [member.phone || ""] : []),
        ]),
      ],
    },
    tickets: {
      label: "회원권",
      rows: [
        ["회원명", "상품", "총횟수", "사용횟수", "잔여횟수", "만료일", "수업구분"],
        ...tickets.map((ticket) => [ticket.member, ticket.product, ticket.total, ticket.used, ticket.remaining, ticket.expires, ticket.lessonKind || "개인"]),
      ],
    },
    lessons: {
      label: "레슨시간표",
      rows: [
        ["요일", "시간", "회원명", "담당코치", "수업분", "상태", "보강여부"],
        ...lessons.map((lesson) => [lesson.day, lesson.time, lesson.member, getCoachName(lesson.coachId), lesson.durationMinutes, getLessonStatusLabel(lesson), lesson.makeup ? "보강" : "정규"]),
      ],
    },
    weeklySchedule: {
      label: "현재 주간 레슨표",
      rows: adminWeeklyScheduleExportRows(),
    },
    payments: {
      label: "결제정산",
      rows: [
        ["회원명", "항목", "금액", "수단", "상태"],
        ...billings.map((billing) => [billing.member, billing.item, billing.amount, paymentMethodLabel(billing.method), billing.statusLabel]),
      ],
    },
    products: {
      label: "상품가격",
      rows: [
        ["상품명", "구분", "수업형식", "횟수", "현금가격", "카드가격", "사용기간", "유예기간", "할인가능"],
        ...membershipProductDrafts.map((product) => [product.title, product.group, product.format, product.tickets, product.cashAmount, product.cardAmount, product.validityDays, product.graceDays, product.discountEnabled ? "가능" : "불가"]),
      ],
    },
    coaches: {
      label: "코치근무",
      rows: [
        ["코치명", "상태", "권한", "근무시간", "정산방식"],
        ...coaches.filter((coach) => coach.id !== "coach-machine").map((coach) => {
          const rule = settlementRuleFor(coach.name);
          return [coach.name, coach.status, coachModeLabel(coach), getCoachAvailabilitySummary(coach.id), rule.method === "hourly" ? `시급 ${rule.hourly}` : `비율 ${Math.round(rule.ratio * 100)}%`];
        }),
      ],
    },
  };
}

function noticeStoragePublicUrl(objectPath = "") {
  const baseUrl = String(window.TennisNoteDataClient?.loadConfig?.()?.supabaseUrl || "").replace(/\/$/, "");
  const encodedPath = String(objectPath).split("/").map((part) => encodeURIComponent(part)).join("/");
  return baseUrl && encodedPath
    ? `${baseUrl}/storage/v1/object/public/${noticeMediaBucket}/${encodedPath}`
    : "";
}

function setAdminMoreMenuOpen(open) {
  const menu = $("#adminMoreMenu");
  const button = $("#adminMoreMenuButton");
  const hasItems = Boolean(menu?.querySelector('.nav-item[data-view]:not([hidden])'));
  adminMoreMenuOpen = Boolean(open && hasItems);
  if (menu) menu.hidden = !adminMoreMenuOpen;
  if (button) {
    button.hidden = !hasItems;
    button.classList.toggle("is-open", adminMoreMenuOpen);
    button.setAttribute("aria-expanded", String(adminMoreMenuOpen));
  }
}

function setAdminMenuPlacement(itemId, placement) {
  if (!adminMenuDefinitions.some((item) => item.id === itemId) || itemId === "dashboard") return;
  const moreMenus = new Set(adminLayoutSettings.moreMenus);
  if (placement === "more") moreMenus.add(itemId);
  else moreMenus.delete(itemId);
  adminLayoutSettings.moreMenus = adminLayoutSettings.menuOrder.filter((id) => moreMenus.has(id));
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

async function recoverAdminConnection() {
  if (adminConnectionRecoveryPromise) return adminConnectionRecoveryPromise;
  adminConnectionRecoveryPromise = (async () => {
    const client = window.TennisNoteDataClient;
    if (!client?.readiness?.().ready || client.isOnline?.() === false) return false;
    let deferredLiveSync = false;
    renderAdminConnectivityStatus(true, "서버 연결과 로그인 상태를 다시 확인하고 있습니다.", "recovering", 0);
    try {
      await client.ensureSession?.();
      if (client.getSession?.()?.access_token) {
        restoreCachedOperationsIdentity();
        const verified = await refreshAdminImportAuthState({ syncLiveData: false });
        if (verified && operationsAccessReady()) {
          if (adminHasUnsavedChanges()) {
            deferredLiveSync = true;
            renderAdminConnectivityStatus(
              true,
              "작성 중인 변경사항이 있어 서버 자료 새로고침을 저장 뒤로 미뤘습니다.",
              "warning",
              0,
            );
          } else {
            await syncAdminLiveData(true, { abortIfDirty: true });
            if (operationsRole() === "admin") await refreshAdminPendingUsers();
          }
        }
      }
      await loadSupabaseLiveStatus();
      if (deferredLiveSync) {
        renderAdminConnectivityStatus(
          true,
          "서버 연결은 복구됐습니다. 작성 중인 내용을 저장하면 최신 운영 자료를 다시 확인합니다.",
          "warning",
          0,
        );
      } else {
        renderAdminConnectivityStatus(true, "서버 연결 복구 완료 · 최신 운영 자료를 확인했습니다.", "online", 3000);
      }
      return true;
    } catch (error) {
      renderAdminConnectivityStatus(
        true,
        "서버 연결을 아직 복구하지 못했습니다. 로그인은 유지되며 다시 연결되면 자동 재시도합니다.",
        "warning",
        0,
      );
      return false;
    }
  })().finally(() => {
    adminConnectionRecoveryPromise = null;
  });
  return adminConnectionRecoveryPromise;
}

function installAdminConnectivityStatus() {
  renderAdminConnectivityStatus(false);
  window.addEventListener("offline", () => renderAdminConnectivityStatus(false));
  window.addEventListener("online", () => {
    void recoverAdminConnection();
  });
  const recoverStaleSession = () => {
    if (
      document.hidden
      || window.TennisNoteDataClient?.isOnline?.() === false
      || !window.TennisNoteDataClient?.getSession?.()?.access_token
      || (operationsAccessReady() && Date.now() - adminAuthLastVerifiedAt < ADMIN_AUTH_RECHECK_STALE_MS)
    ) return;
    void recoverAdminConnection();
  };
  window.addEventListener("focus", recoverStaleSession);
  document.addEventListener("visibilitychange", recoverStaleSession);
}
