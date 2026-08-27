// 서버(Supabase)에서 운영 설정 데이터를 가져오는 함수들.
//
// 서버에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function loadAdminSecuritySettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !adminApprovalReady()) return false;
  try {
    const value = await client.rpc("tn_admin_security_settings");
    if (!value || typeof value !== "object") return false;
    const normalized = normalizeAdminLockSettings(value);
    Object.assign(adminLockSettings, adminSecurityConfigPayload(normalized), { pinConfigured: normalized.pinConfigured });
    adminLockSettings.pinHash = "";
    adminLockSettings.legacyPin = "";
    resetAdminSecurityDraft();
    adminSecuritySaveState = { status: "saved", savedAt: value.updatedAt || "" };
    return true;
  } catch {
    return false;
  }
}

async function loadBranchSalesSettingsFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || !adminApprovalReady()) return false;
  branchSalesSettingsState.status = "loading";
  branchSalesSettingsState.branchId = branchId;
  renderBranchSalesSetup();
  try {
    const response = await client.rpc("tn_admin_get_branch_sales_settings", { target_branch_id: branchId });
    applyBranchSalesSettingsResponse(response);
    renderBranchSalesSetup();
    return true;
  } catch (error) {
    branchSalesSettingsState.status = "failed";
    branchSalesSettingsState.message = error?.payload?.code || error?.message || "server_error";
    renderBranchSalesSetup();
    return false;
  }
}

async function syncPolicyVersionsToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || !adminApprovalReady()) return "local";
  const value = policyVersionPayload();
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: policyVersionSettingsKey }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) await client.insertRows("tn_admin_settings", { key: policyVersionSettingsKey, value });
    return "server";
  } catch {
    return "blocked";
  }
}

async function loadPolicyVersionsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: policyVersionSettingsKey },
      limit: 1,
    });
    const items = rows?.[0]?.value?.items;
    if (!Array.isArray(items) || !items.length) return false;
    const nextPolicies = items.map((policy) => normalizePolicyVersion(policy));
    const activeIndex = Math.max(0, nextPolicies.findIndex((policy) => policy.status === "active"));
    nextPolicies.forEach((policy, index) => {
      if (policy.status === "active" && index !== activeIndex) policy.status = "archived";
    });
    nextPolicies[activeIndex].status = "active";
    replaceArray(policyVersions, nextPolicies);
    reflectHoldingPolicyInActiveVersion();
    reflectRefundPolicyInActiveVersion();
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
}

async function loadServerHoldingPolicy() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", { select: "key,value", filters: { key: holdingPolicyKey }, limit: 1 });
    if (rows?.[0]?.value) Object.assign(holdingPolicySettings, rows[0].value);
    reflectHoldingPolicyInActiveVersion();
    saveSnapshot();
    renderHoldingPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
}

async function loadAdminLayoutSettingsFromServer(preloadedRow = undefined) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  try {
    const rows = preloadedRow === undefined
      ? await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: adminLayoutSettingKey },
        limit: 1,
      })
      : preloadedRow ? [preloadedRow] : [];
    if (!rows?.length) {
      adminLayoutServerUpdatedAt = "";
      return false;
    }
    adminLayoutServerUpdatedAt = rows[0].updated_at || "";
    adminLayoutSettings = normalizeAdminLayoutSettings(rows[0].value || {});
    adminLayoutSaveState = "server";
    persistAdminLayoutLocal();
    renderAdminLayoutSettings();
    return true;
  } catch {
    return false;
  }
}

async function loadAdminStartupSettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  let rows = [];
  try {
    rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: { in: [liveSchedulePolicyKey, adminLayoutSettingKey] } },
      limit: 2,
    });
  } catch {
    return Promise.all([
      loadLiveSchedulePolicyFromServer(),
      loadAdminLayoutSettingsFromServer(),
      loadAdminSecuritySettingsFromServer(),
    ]);
  }
  const rowByKey = new Map((rows || []).map((row) => [row.key, row]));
  return Promise.all([
    loadLiveSchedulePolicyFromServer(rowByKey.get(liveSchedulePolicyKey) || null),
    loadAdminLayoutSettingsFromServer(rowByKey.get(adminLayoutSettingKey) || null),
    loadAdminSecuritySettingsFromServer(),
  ]);
}

async function loadAuthProviderStatus() {
  const client = window.TennisNoteDataClient;
  const target = $("#authProviderStatus");
  if (!client || !target) return;
  const readiness = client.readiness();
  if (!readiness.ready) {
    authProviderState.loaded = true;
    authProviderState.loading = false;
    authProviderState.message = "로컬 브라우저 설정이 아직 없습니다.";
    authProviderState.items = authProviderItems();
    renderAuthProviderStatus();
    return;
  }

  authProviderState.loading = true;
  authProviderState.message = "로그인 제공자 확인 중";
  renderAuthProviderStatus();
  try {
    const settings = await client.getAuthSettings();
    authProviderState.items = authProviderItems(settings);
    authProviderState.message = "로그인 제공자 확인 완료";
  } catch (error) {
    authProviderState.items = authProviderItems();
    authProviderState.message = "로그인 제공자 확인 실패";
  } finally {
    authProviderState.loading = false;
    authProviderState.loaded = true;
    renderAuthProviderStatus();
  }
}

async function loadBranchSalesEffectiveOptionsFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.invokeFunction || !branchId || !adminApprovalReady()) return false;
  branchSalesEffectiveOptionsState.status = "loading";
  branchSalesEffectiveOptionsState.branchId = branchId;
  renderBranchSalesSetup();
  try {
    const response = await client.invokeFunction("portone-payment/options", { body: { branchId } });
    branchSalesEffectiveOptionsState.status = "loaded";
    branchSalesEffectiveOptionsState.settingsVersion = Math.max(0, Number(response?.settingsVersion) || 0);
    branchSalesEffectiveOptionsState.settingsAppliedAt = String(response?.settingsAppliedAt || "");
    branchSalesEffectiveOptionsState.methodAvailability = Array.isArray(response?.methodAvailability) ? response.methodAvailability : [];
    branchSalesEffectiveOptionsState.message = "";
    renderBranchSalesSetup();
    return true;
  } catch (error) {
    branchSalesEffectiveOptionsState.status = "failed";
    branchSalesEffectiveOptionsState.message = String(error?.payload?.code || error?.message || "server_error");
    renderBranchSalesSetup();
    return false;
  }
}
