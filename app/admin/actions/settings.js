// 운영 설정 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function initializeOperationsSessionPersistence() {
  const remember = $("#operationsRememberLogin");
  let savedRemember = null;
  try {
    savedRemember = localStorage.getItem(operationsRememberStorageKey);
  } catch (error) {
    savedRemember = null;
  }
  const shouldRemember = savedRemember === null ? true : savedRemember === "true";
  if (savedRemember === null) {
    try {
      localStorage.setItem(operationsRememberStorageKey, "true");
    } catch (error) {
      // The checked UI still provides the safe default when storage is unavailable.
    }
  }
  window.TennisNoteDataClient?.setSessionPersistence?.(shouldRemember);
  if (remember) {
    remember.checked = shouldRemember;
    remember.dataset.ready = "true";
  }
  return shouldRemember;
}

function operationsProfileCacheStores() {
  return window.TennisNoteDataClient?.sessionPersistence?.() === "session"
    ? [sessionStorage]
    : [localStorage, sessionStorage];
}

function applyOperationsRolePermissions() {
  const role = operationsRole();
  document.body.dataset.operationsRole = role || "signed-out";
  if (role === "coach" && ["journal", "app_link", "deletion", "inactive"].includes(state.memberFilter)) state.memberFilter = "active";
  $$(".nav-item[data-view]").forEach((button) => {
    if (!button.dataset.adminLabel) button.dataset.adminLabel = button.textContent.trim();
    const coachLabels = {
      members: "회원 찾기",
      schedule: "레슨표",
      notes: "수업 완료",
      issues: "오류 접수",
    };
    button.textContent = role === "coach"
      ? coachLabels[button.dataset.view] || button.dataset.adminLabel
      : button.dataset.adminLabel;
    button.hidden = role === "coach" && !coachOperationsViews.has(button.dataset.view);
  });
  const surfaceLabel = $(".admin-surface-label");
  if (surfaceLabel) surfaceLabel.textContent = role === "coach" ? "코치 운영" : "관리자 웹 전용";
  $$('[data-admin-only-member-filter]').forEach((button) => {
    button.hidden = role === "coach";
  });
  ["openDataToolsButton", "exportMembersButton", "addMemberButton", "openSingleSheetPreviewButton", "adminPendingUsersPanel"].forEach((id) => {
    const element = $(`#${id}`);
    if (element) element.hidden = role === "coach";
  });
  applyAdminLayoutSettings();
}

async function restoreAdminOperationalCache() {
  try {
    const snapshot = await readAdminOperationalCache();
    if (!snapshot?.savedAt || Date.now() - Number(snapshot.savedAt) > adminOperationalCacheMaxAgeMs) return false;
    [
      [coaches, snapshot.coaches],
      [members, snapshot.members],
      [lessons, snapshot.lessons],
      [makeupRequests, snapshot.makeupRequests],
      [tickets, snapshot.tickets],
      [expiredTickets, snapshot.expiredTickets],
      [billings, snapshot.billings],
      [billingLogs, snapshot.billingLogs],
      [groupAccounts, snapshot.groupAccounts],
      [lessonNotes, snapshot.lessonNotes],
    ].forEach(([target, source]) => replaceArray(target, Array.isArray(source) ? source : []));
    adminLiveDataState.memberPaymentProjections = Array.isArray(snapshot.memberPaymentProjections)
      ? snapshot.memberPaymentProjections
      : [];
    invalidateMemberSearchIndex();
    Object.assign(state, {
      liveScheduleLoaded: false,
      liveScheduleLoading: true,
      liveScheduleMessage: "최근 데이터를 먼저 표시하고 최신 서버 데이터를 확인하는 중",
    });
    return true;
  } catch (error) {
    console.warn("[Tennis Note] administrator cache restore skipped", error?.message || "cache_error");
    return false;
  }
}

async function saveAdminSecuritySettings() {
  const client = window.TennisNoteDataClient;
  const button = $("#saveAdminSecurityButton");
  if (!adminApprovalReady() || !client?.rpc) {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("관리자 로그인 후 보안 설정을 저장할 수 있습니다.");
    return false;
  }
  const draft = currentAdminSecurityDraft();
  if (draft.enabled && adminPinNeedsSetup()) {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("운영 PIN을 먼저 설정해 주세요.");
    return false;
  }
  const value = { ...adminSecurityConfigPayload(draft), updatedAt: new Date().toISOString() };
  if (button) button.disabled = true;
  adminSecuritySaveState.status = "saving";
  renderAdminSecurity();
  try {
    await client.rpc("tn_admin_save_security_settings_v2", {
      target_enabled: value.enabled,
      target_timeout_minutes: value.timeoutMinutes,
      target_locked_views: value.lockedViews,
      target_past_absence_require_pin_every_time: value.pastAbsenceRequirePinEveryTime,
    });
    Object.assign(adminLockSettings, value);
    resetAdminSecurityDraft();
    adminSecuritySaveState = { status: "saved", savedAt: new Date().toISOString() };
    saveSnapshot();
    renderAll();
    showToast("보안 설정을 서버에 저장했습니다.");
    return true;
  } catch {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("보안 설정 저장에 실패했습니다. 연결과 관리자 권한을 확인해 주세요.");
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

function createOperationProfile(name = "기본 운영", source = null) {
  const base = source || {
    scheduleSettings: currentOperationScheduleSettings(),
    coaches: currentOperationCoachPolicies(),
  };
  return normalizeOperationProfile({
    id: `operation-profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    branchId: base.branchId || "",
    branchName: base.branchName || "",
    scheduleSettings: cloneOperationProfileValue(base.scheduleSettings),
    coaches: cloneOperationProfileValue(base.coaches),
    updatedAt: new Date().toISOString(),
  }, operationProfiles.length);
}

function markOperationProfileActiveForBranch(profile) {
  const branchId = String(profile?.branchId || "");
  if (!branchId || !profile?.id) return;
  activeOperationProfileIdsByBranch[branchId] = String(profile.id);
}

function removeOperationProfileFromBranchMap(profileId, branchId = "") {
  const normalizedProfileId = String(profileId || "");
  const normalizedBranchId = String(branchId || "");
  Object.entries(activeOperationProfileIdsByBranch).forEach(([mappedBranchId, mappedProfileId]) => {
    if (
      String(mappedProfileId) === normalizedProfileId
      && (!normalizedBranchId || mappedBranchId === normalizedBranchId)
    ) {
      delete activeOperationProfileIdsByBranch[mappedBranchId];
    }
  });
}

function updateActiveOperationProfileFromCurrent() {
  const profile = activeOperationProfile();
  profile.scheduleSettings = currentOperationScheduleSettings();
  profile.coaches = currentOperationCoachPolicies();
  profile.updatedAt = new Date().toISOString();
  return profile;
}

function resetOperationBranchViewState() {
  state.selectedMemberId = null;
  state.selectedMemberIds = [];
  state.selectedScheduleLessonIds = [];
  state.selectedScheduleOpenSlots = [];
  state.selectedMembershipProductIds = [];
  state.memberCoachFilter = "all";
  state.scheduleCoachFilter = "all";
  state.memberListPage = 0;
  state.memberStatusPage = 0;
  state.adminTaskPage = 0;
}

function applyOperationProfile(profile) {
  const normalized = normalizeOperationProfile(profile);
  scheduleSettings.openStart = normalized.scheduleSettings.openStart || scheduleSettings.openStart;
  scheduleSettings.openEnd = normalized.scheduleSettings.openEnd || scheduleSettings.openEnd;
  replaceArray(scheduleSettings.breakRules, normalized.scheduleSettings.breakRules);
  replaceArray(scheduleSettings.breakFavorites, normalized.scheduleSettings.breakFavorites);
  scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...normalized.scheduleSettings.lessonColors };
  scheduleSettings.lessonColorRules = cloneOperationProfileValue(normalized.scheduleSettings.lessonColorRules);
  scheduleSettings.coachWorkPolicyVersion = Number(normalized.scheduleSettings.coachWorkPolicyVersion) || 2;
  scheduleSettings.memberScheduleRequestOnly = normalized.scheduleSettings.memberScheduleRequestOnly !== false;
  scheduleSettings.adminTuningMode = normalized.scheduleSettings.adminTuningMode === true;
  coaches.forEach((coach) => {
    if (normalized.branchId && coach.branchId && String(coach.branchId) !== String(normalized.branchId)) return;
    const policy = normalized.coaches.find((item) => (
      (!item.branchId || !coach.branchId || String(item.branchId) === String(coach.branchId))
      && ((item.serverRoleId && item.serverRoleId === coach.serverRoleId)
      || item.id === coach.id
      || item.name === coach.name)
    ));
    if (!policy) return;
    coach.color = policy.color || coach.color;
    coach.availableDays = cloneOperationProfileValue(Array.isArray(policy.availableDays) ? policy.availableDays : []);
    coach.availableStart = policy.availableStart || "";
    coach.availableEnd = policy.availableEnd || "";
    coach.workBlocks = cloneOperationProfileValue(Array.isArray(policy.workBlocks) ? policy.workBlocks : []);
    coach.breakBlocks = cloneOperationProfileValue(Array.isArray(policy.breakBlocks) ? policy.breakBlocks : []);
  });
}

function restoreOperationProfileWorkspace(backup) {
  replaceArray(operationProfiles, backup.profiles);
  activeOperationProfileId = backup.activeId;
  replaceOperationProfileBranchMap(backup.activeIdsByBranch);
  applyOperationProfile({
    id: backup.activeId,
    name: "복원",
    scheduleSettings: backup.scheduleSettings,
    coaches: backup.coaches,
  });
}

function applyBranchSalesSettingsResponse(response = {}) {
  const value = Array.isArray(response) ? response[0] || {} : response || {};
  branchSalesSettingsState.status = "loaded";
  branchSalesSettingsState.branchId = String(value.branchId || value.branch_id || activeOperationBranchId() || "");
  branchSalesSettingsState.version = Number(value.version || 0);
  branchSalesSettingsState.appliedAt = String(value.appliedAt || value.applied_at || "");
  branchSalesSettingsState.appliedConfig = normalizeBranchSalesConfig(value.appliedConfig || value.applied_config || {});
  branchSalesSettingsState.draftConfig = normalizeBranchSalesConfig(value.draftConfig || value.draft_config || value.appliedConfig || value.applied_config || {});
  branchSalesSettingsState.message = "";
}

async function deletePolicyVersion(policyId) {
  const policyIndex = policyVersions.findIndex((policy) => policy.id === policyId);
  if (policyIndex < 0) return;
  if (policyVersions.length <= 1) {
    showToast("마지막 정책은 삭제할 수 없습니다. 새 정책을 만든 뒤 삭제해 주세요.");
    return;
  }
  const policy = policyVersions[policyIndex];
  if (!window.confirm(`'${policy.title}' 정책을 삭제할까요? 기존 회원권에 저장된 구매 당시 정책은 유지됩니다.`)) return;
  const wasActive = policy.status === "active";
  policyVersions.splice(policyIndex, 1);
  if (wasActive) {
    policyVersions.forEach((item, index) => {
      item.status = index === 0 ? "active" : "archived";
    });
  }
  await persistPolicyVersions(wasActive ? "정책을 삭제하고 남은 최신 정책을 적용했습니다" : "정책을 삭제했습니다");
}

function addPolicyVersionSectionEditor() {
  const target = $("#policyVersionSectionEditors");
  if (!target) return;
  target.insertAdjacentHTML("beforeend", policyVersionEditorSectionMarkup({}, { isNew: true }));
  target.lastElementChild?.querySelector("input")?.focus();
}

async function savePolicyVersionEditor() {
  const policy = policyVersions.find((item) => item.id === policyVersionEditorState.policyId);
  const target = $("#policyVersionEditorContent");
  if (!policy || !target) return;
  const field = (name) => target.querySelector(`[data-policy-version-field="${name}"]`);
  const title = field("title")?.value.trim() || "";
  const source = field("source")?.value.trim() || "";
  const summary = field("summary")?.value.trim() || "";
  if (title.length < 2 || summary.length < 4) {
    showToast("정책명은 2자, 정책 요약은 4자 이상 입력해 주세요.");
    (title.length < 2 ? field("title") : field("summary"))?.focus();
    return;
  }
  const editedSections = [...target.querySelectorAll("[data-policy-section-editor]")].map((row, index) => ({
    id: row.dataset.sectionId || `custom-${Date.now()}-${index}`,
    title: row.querySelector('[data-policy-section-field="title"]')?.value.trim() || "",
    rules: (row.querySelector('[data-policy-section-field="rules"]')?.value || "").split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean),
  }));
  const invalidSection = editedSections.find((section) => section.title.length < 2 || !section.rules.length);
  if (invalidSection) {
    showToast("정책 항목명과 한 개 이상의 정책 내용을 입력해 주세요.");
    return;
  }
  const managedSectionIds = new Set(["lesson-operation", "holding", "refund"]);
  const editedById = new Map(editedSections.map((section) => [section.id, section]));
  const originalIds = new Set(policy.sections.map((section) => section.id));
  const nextSections = policy.sections.map((section) => (
    managedSectionIds.has(section.id) ? section : editedById.get(section.id)
  )).filter(Boolean);
  editedSections.forEach((section) => {
    if (!originalIds.has(section.id)) nextSections.push(section);
  });
  Object.assign(policy, {
    title,
    effectiveFrom: field("effectiveFrom")?.value || new Date().toISOString().slice(0, 10),
    source: source || "관리자 설정",
    summary,
    sections: nextSections,
  });
  closePolicyVersionEditor();
  await persistPolicyVersions("정책을 수정했습니다");
}

async function saveGroupDeductionPolicy(productId, control) {
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  const serverProduct = serverMembershipProductForDraft(product);
  const policy = control?.value || "";
  if (!product || !serverProduct?.id || !["per_participant", "shared_once", "representative_only"].includes(policy)) {
    showToast("1:2 차감 방식을 다시 선택해 주세요.");
    return;
  }
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 로그인 후 차감 방식을 저장해 주세요.");
    return;
  }
  control.disabled = true;
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_set_group_deduction_policy", {
      target_product_id: serverProduct.id,
      target_policy: policy,
    });
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => String(item.id) === String(serverProduct.id));
    if (!saved || String(saved.group_deduction_policy || "shared_once") !== policy) {
      throw new Error("group_deduction_policy_write_not_confirmed");
    }
    renderServiceReadiness();
    showToast("1:2 차감 방식을 저장했습니다.");
  } catch {
    control.disabled = false;
    showToast("차감 방식을 저장하지 못했습니다. 서버 기능 적용 여부를 확인해 주세요.");
  }
}

async function cancelAuthProviderSwitch(userId, switchId, button) {
  if (!window.confirm("로그인 수단 변경 대기를 취소할까요? 현재 로그인은 그대로 유지됩니다.")) return;
  await invokeAdminAccountControl({
    action: "cancel_auth_provider_switch",
    userId,
    switchId,
  }, button, "로그인 수단 변경 대기를 취소했습니다.");
}

function createAdminOperationKey(prefix = "operation") {
  const randomPart = window.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}:${randomPart}`.replace(/[^A-Za-z0-9:_-]/g, "-");
}

function adminApprovalReady() {
  return Boolean(window.TennisNoteDataClient?.readiness?.().ready && window.TennisNoteDataClient?.getSession?.()?.access_token && adminImportAuthState.profile?.role === "admin");
}

async function saveHoldingPolicySettings() {
  holdingPolicySettings.personalMaxDays = Math.max(0, Number($("#holdingPersonalMaxDays")?.value) || 7);
  holdingPolicySettings.fourWeekPersonalMaxDays = holdingPolicySettings.personalMaxDays;
  holdingPolicySettings.threeMonthPersonalMaxDays = Math.max(0, Number($("#holdingThreeMonthPersonalMaxDays")?.value) || 14);
  holdingPolicySettings.couponPersonalMaxDays = 0;
  holdingPolicySettings.injuryMaxDays = Math.max(1, Number($("#holdingInjuryMaxDays")?.value) || 30);
  holdingPolicySettings.emergencyRetroactiveDays = Math.max(0, Number($("#holdingEmergencyRetroactiveDays")?.value) || 3);
  holdingPolicySettings.evidenceRetentionDays = Math.max(1, Number($("#holdingEvidenceRetentionDays")?.value) || 30);
  holdingPolicySettings.evidenceRequired = $("#holdingEvidenceRequired")?.checked !== false;
  reflectHoldingPolicyInActiveVersion();
  saveSnapshot();
  const client = window.TennisNoteDataClient;
  let serverSaveFailed = false;
  if (client?.readiness?.().ready && client.getSession?.()?.access_token) {
    try {
      const value = { ...holdingPolicySettings, updatedAt: new Date().toISOString() };
      const updated = await client.updateRows("tn_admin_settings", { key: holdingPolicyKey }, { value, updated_at: new Date().toISOString() });
      if (!updated?.length) await client.insertRows("tn_admin_settings", { key: holdingPolicyKey, value });
    } catch {
      serverSaveFailed = true;
    }
  }
  if (await syncPolicyVersionsToServer() === "blocked") serverSaveFailed = true;
  renderHoldingPolicySettings();
  renderPolicyVersionSettings();
  showToast(serverSaveFailed ? "로컬 저장 완료 · 서버 정책 저장은 관리자 권한 확인 필요" : "홀딩 정책 저장 완료");
}

async function saveBranchSalesSettings(apply = false) {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || !adminApprovalReady() || branchSalesSettingsState.status === "failed") {
    showToast("관리자 로그인과 판매 설정 서버를 확인해 주세요");
    return false;
  }
  const config = branchSalesConfigFromForm();
  const enabledMemberMethods = Object.entries(config.paymentMethods).filter(([id, method]) => id !== "onsite_cash" && method.enabled === true);
  if (!enabledMemberMethods.length) {
    showToast("회원이 사용할 결제수단을 하나 이상 켜 주세요");
    return false;
  }
  const invalidMethod = enabledMemberMethods.find(([, method]) => !String(method.title || "").trim());
  const invalidBenefit = Object.values(config.benefits).find((benefit) => benefit.enabled && (!String(benefit.title || "").trim() || Number(benefit.discountValue) < 1 || Number(benefit.discountValue) > 100));
  if (invalidMethod || invalidBenefit) {
    showToast("결제수단 이름과 혜택 이름·할인율을 확인해 주세요");
    return false;
  }
  if (apply && config.paymentMethods.bank_transfer?.enabled === true) {
    const bankEnabled = $("#salesBranchBankTransferEnabled")?.checked === true;
    if (!bankEnabled) {
      showToast("계좌이체를 사용하려면 입금 계좌의 회원앱 사용을 켜 주세요");
      $("#salesBranchBankTransferEnabled")?.focus();
      return false;
    }
    const accountSaved = await saveBranchPaymentAccount({ silent: true });
    if (!accountSaved) return false;
  }
  const button = $(apply ? "#applyBranchSalesSettingsButton" : "#saveBranchSalesDraftButton");
  if (button) button.disabled = true;
  try {
    const response = await client.rpc("tn_admin_save_branch_sales_settings", {
      target_branch_id: branchId,
      target_config: config,
      target_apply: apply,
      target_expected_version: branchSalesSettingsState.version || null,
    });
    applyBranchSalesSettingsResponse(response);
    if (apply) await loadBranchSalesEffectiveOptionsFromServer();
    renderBranchSalesSetup();
    showToast(apply ? "새 설정을 회원앱에 적용했습니다" : "초안을 저장했습니다. 적용 전까지 회원앱은 바뀌지 않습니다");
    return true;
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    if (String(code).includes("revision_conflict")) await loadBranchSalesSettingsFromServer();
    showToast(String(code).includes("revision_conflict") ? "다른 화면에서 변경되어 최신 설정을 다시 불렀습니다" : `판매 설정 저장 실패: ${code}`);
    return false;
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

function applyAdminLayoutSettings() {
  const nav = $(".nav-list");
  if (nav) {
    const primaryMenu = $("#adminPrimaryMenu");
    const moreMenu = $("#adminMoreMenu");
    adminLayoutSettings.menuOrder.forEach((view) => {
      const button = nav.querySelector(`[data-view="${view}"]`);
      const destination = adminLayoutSettings.moreMenus.includes(view) ? moreMenu : primaryMenu;
      if (button && destination) destination.append(button);
    });
    adminMenuDefinitions.forEach((item) => {
      const button = nav.querySelector(`[data-view="${item.id}"]`);
      if (button) button.hidden = adminLayoutSettings.hiddenMenus.includes(item.id) || !operationsViewAllowed(item.id);
    });
    const activeIsMore = adminLayoutSettings.moreMenus.includes(state.view);
    $("#adminMoreMenuButton")?.classList.toggle("is-active", activeIsMore);
    setAdminMoreMenuOpen(adminMoreMenuOpen || activeIsMore);
  }

  const dashboard = $("#dashboardView");
  if (!dashboard) return;
  dashboard.classList.add("dashboard-layout-customizable");
  adminLayoutSettings.groupOrder.forEach((groupId, index) => {
    const group = dashboard.querySelector(`[data-dashboard-group="${groupId}"]`);
    if (!group) return;
    group.style.order = String(index);
    group.hidden = adminLayoutSettings.hiddenGroups.includes(groupId);
  });
  Object.entries(adminLayoutSettings.widgetOrder).forEach(([groupId, widgetOrder]) => {
    const group = dashboard.querySelector(`[data-dashboard-group="${groupId}"]`);
    if (!group) return;
    widgetOrder.forEach((widgetId) => {
      const widget = group.querySelector(`[data-dashboard-widget="${widgetId}"]`);
      if (widget) group.append(widget);
    });
  });
  Object.values(adminDashboardWidgetDefinitions).flat().forEach((item) => {
    const widget = dashboard.querySelector(`[data-dashboard-widget="${item.id}"]`);
    if (widget) widget.hidden = adminLayoutSettings.hiddenWidgets.includes(item.id);
  });

  const reportView = $("#reportsView");
  if (reportView) {
    reportView.classList.add("report-layout-customizable");
    adminLayoutSettings.reportWidgetOrder.forEach((widgetId, index) => {
      const widget = reportView.querySelector(`[data-report-widget="${widgetId}"]`);
      if (!widget) return;
      widget.style.order = String(index + 1);
      widget.hidden = adminLayoutSettings.hiddenReportWidgets.includes(widgetId);
      widget.dataset.reportSize = adminLayoutSettings.reportWidgetSizes[widgetId] || "two";
      widget.dataset.reportFilter = adminLayoutSettings.reportWidgetFilters[widgetId] || "all";
    });
  }
}

function applyAdminLayoutPreset(presetId) {
  const preset = adminLayoutPresets[presetId];
  if (!preset) return;
  adminLayoutSettings.menuOrder = [...preset.menuOrder];
  adminLayoutSettings.moreMenus = [...preset.moreMenus];
  adminLayoutSettings.hiddenMenus = [];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

function setAdminLayoutVisibility(kind, itemId, visible) {
  const key = kind === "menu"
    ? "hiddenMenus"
    : kind === "group"
      ? "hiddenGroups"
      : kind === "reportWidget"
        ? "hiddenReportWidgets"
        : "hiddenWidgets";
  const definitions = kind === "menu"
    ? adminMenuDefinitions
    : kind === "group"
      ? adminDashboardGroupDefinitions
      : kind === "reportWidget"
        ? adminReportWidgetDefinitions
        : Object.values(adminDashboardWidgetDefinitions).flat();
  if (definitions.find((item) => item.id === itemId)?.required) return;
  const hidden = new Set(adminLayoutSettings[key]);
  if (visible) hidden.delete(itemId);
  else hidden.add(itemId);
  adminLayoutSettings[key] = [...hidden];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

async function saveAdminLayoutSettings() {
  const client = window.TennisNoteDataClient;
  if (!client?.insertRows || !client?.updateRows || !adminApprovalReady()) {
    showToast("관리자 로그인 후 화면 구성을 저장할 수 있습니다.");
    return;
  }
  adminLayoutSaveState = "saving";
  renderAdminLayoutSettings();
  try {
    if (!adminLayoutServerUpdatedAt) {
      const existing = await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: adminLayoutSettingKey },
        limit: 1,
      });
      if (existing?.length) {
        adminLayoutServerUpdatedAt = existing[0].updated_at || "";
        throw new Error("admin_layout_revision_conflict");
      }
      const inserted = await client.insertRows("tn_admin_settings", {
        key: adminLayoutSettingKey,
        value: adminLayoutSettings,
      });
      adminLayoutServerUpdatedAt = inserted?.[0]?.updated_at || "";
    } else {
      const nextUpdatedAt = new Date().toISOString();
      const updated = await client.updateRows("tn_admin_settings", {
        key: adminLayoutSettingKey,
        updated_at: adminLayoutServerUpdatedAt,
      }, {
        value: adminLayoutSettings,
        updated_at: nextUpdatedAt,
      });
      if (!updated?.length) throw new Error("admin_layout_revision_conflict");
      adminLayoutServerUpdatedAt = updated[0]?.updated_at || nextUpdatedAt;
    }
    adminLayoutSaveState = "server";
    persistAdminLayoutLocal();
    showToast("메뉴와 대시보드 구성을 저장했습니다.");
  } catch (error) {
    if (String(error?.message || "").includes("revision_conflict")) {
      adminLayoutSaveState = "conflict";
      await loadAdminLayoutSettingsFromServer();
      showToast("다른 화면에서 구성이 변경되어 최신 배치를 불러왔습니다.");
    } else {
      adminLayoutSaveState = "local";
      showToast(`화면 구성 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
  } finally {
    renderAdminLayoutSettings();
  }
}

async function bootstrapAdminOperationsSession() {
  const client = window.TennisNoteDataClient;
  try {
    await client?.consumeOAuthRedirect?.();
  } catch (error) {
    const canRetry = client?.isTransientConnectionError?.(error) || client?.isOnline?.() === false;
    adminImportAuthState.message = canRetry
      ? "네이버 로그인 확인 중 서버 연결이 끊겼습니다. 연결되면 자동으로 이어갑니다."
      : "네이버 로그인 완료 정보를 확인하지 못했습니다. 다시 로그인해 주세요.";
  }
  restoreCachedOperationsIdentity();
  if (client?.getSession?.()?.access_token) {
    adminImportAuthState.loading = true;
    adminImportAuthState.message = "로그인 상태를 확인하고 있습니다.";
  }
  renderOperationsLoginGate();
  try {
    const verified = await refreshAdminImportAuthState();
    if (verified && operationsRole() === "admin") await refreshAdminPendingUsers();
  } finally {
    hideAdminBrandSplash();
  }
}
