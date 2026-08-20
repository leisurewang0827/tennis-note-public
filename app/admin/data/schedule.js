// 서버(Supabase)에서 시간표 데이터를 가져오는 함수들.
//
// 서버에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function syncLiveSchedulePolicyToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token) return "local";
  const value = liveSchedulePolicyPayload();
  try {
    if (!liveSchedulePolicyServerUpdatedAt) {
      const existing = await client.selectRows("tn_admin_settings", {
        select: "key,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      });
      if (existing?.length) return "conflict";
      const inserted = await client.insertRows("tn_admin_settings", {
        key: liveSchedulePolicyKey,
        value,
      });
      liveSchedulePolicyServerUpdatedAt = inserted?.[0]?.updated_at || "";
      return "server";
    }
    const nextUpdatedAt = new Date().toISOString();
    const updated = await client.updateRows("tn_admin_settings", {
      key: liveSchedulePolicyKey,
      updated_at: liveSchedulePolicyServerUpdatedAt,
    }, {
      value,
      updated_at: nextUpdatedAt,
    });
    if (!updated?.length) {
      return "conflict";
    }
    liveSchedulePolicyServerUpdatedAt = updated[0]?.updated_at || nextUpdatedAt;
    return "server";
  } catch (error) {
    return "blocked";
  }
}

async function loadLiveSchedulePolicyFromServer(preloadedRow = undefined) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  try {
    const rows = preloadedRow === undefined
      ? await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      })
      : preloadedRow ? [preloadedRow] : [];
    if (!rows?.length) {
      liveSchedulePolicyServerUpdatedAt = "";
      return false;
    }
    liveSchedulePolicyServerUpdatedAt = rows[0]?.updated_at || "";
    const value = rows?.[0]?.value;
    if (!value || typeof value !== "object") return false;
    const serverSettings = value.scheduleSettings || {};
    if (serverSettings.openStart) scheduleSettings.openStart = serverSettings.openStart;
    if (serverSettings.openEnd) scheduleSettings.openEnd = serverSettings.openEnd;
    if (Array.isArray(serverSettings.breakRules)) replaceArray(scheduleSettings.breakRules, serverSettings.breakRules);
    if (Array.isArray(serverSettings.breakFavorites)) replaceArray(scheduleSettings.breakFavorites, serverSettings.breakFavorites);
    scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(serverSettings.lessonColors || {}) };
    scheduleSettings.lessonColorRules = Array.isArray(serverSettings.lessonColorRules) ? serverSettings.lessonColorRules : scheduleSettings.lessonColorRules;
    scheduleSettings.coachWorkPolicyVersion = Number(serverSettings.coachWorkPolicyVersion) || 2;
    scheduleSettings.memberScheduleRequestOnly = serverSettings.memberScheduleRequestOnly !== false;
    scheduleSettings.adminTuningMode = serverSettings.adminTuningMode === true;
    const useProfileCoachTemplate = !state.liveScheduleLoaded;
    (Array.isArray(value.coaches) ? value.coaches : []).forEach((serverCoach) => {
      const coach = coaches.find((item) => (
        (!serverCoach.branchId || !item.branchId || String(item.branchId) === String(serverCoach.branchId))
        && ((serverCoach.serverRoleId && item.serverRoleId === serverCoach.serverRoleId)
        || item.id === serverCoach.id
        || item.name === serverCoach.name)
      ));
      if (!coach) return;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.workBlocks)) coach.workBlocks = serverCoach.workBlocks;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.breakBlocks)) coach.breakBlocks = serverCoach.breakBlocks;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.availableDays)) coach.availableDays = serverCoach.availableDays;
      if (useProfileCoachTemplate && serverCoach.availableStart) coach.availableStart = serverCoach.availableStart;
      if (useProfileCoachTemplate && serverCoach.availableEnd) coach.availableEnd = serverCoach.availableEnd;
      if (serverCoach.color) coach.color = serverCoach.color;
    });
    replaceArray(
      operationProfiles,
      Array.isArray(value.operationProfiles)
        ? value.operationProfiles.map((profile, index) => normalizeOperationProfile(profile, index))
        : [],
    );
    activeOperationProfileId = value.activeOperationProfileId || "";
    replaceOperationProfileBranchMap(value.activeOperationProfileIdsByBranch);
    ensureOperationProfiles();
    updateActiveOperationProfileFromCurrent();
    localStorage.setItem(storageKey, JSON.stringify({
      ...(JSON.parse(localStorage.getItem(storageKey) || "{}")),
      coaches,
      scheduleSettings,
      operationProfiles,
      activeOperationProfileId,
      activeOperationProfileIdsByBranch,
    }));
    return true;
  } catch {
    return false;
  }
}

async function syncLessonPoliciesToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || !adminApprovalReady()) return "local";
  const value = lessonPolicyPayload();
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: lessonPolicySettingsKey }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) await client.insertRows("tn_admin_settings", { key: lessonPolicySettingsKey, value });
    return "server";
  } catch {
    return "blocked";
  }
}

async function loadLessonPoliciesFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: lessonPolicySettingsKey },
      limit: 1,
    });
    const items = rows?.[0]?.value?.items;
    if (!Array.isArray(items)) return false;
    replaceArray(lessonPolicies, items.map((policy, index) => normalizeLessonPolicy(policy, index)));
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
    renderLessonPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
}

async function previewScheduleV2Integrity() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !client.getSession?.()?.access_token || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 점검할 수 있습니다.");
    return false;
  }
  if (!branchId) {
    showToast("먼저 운영 지점을 선택해 주세요.");
    return false;
  }
  resetScheduleV2IntegrityPreview();
  const checkButton = $("#scheduleV2IntegrityButton");
  const summary = $("#scheduleV2IntegritySummary");
  const list = $("#scheduleV2IntegrityList");
  if (checkButton) checkButton.disabled = true;
  if (summary) summary.textContent = "확인 중";
  if (list) list.textContent = "회원권과 미래 시간표를 서버에서 확인하고 있습니다.";
  try {
    const result = await client.rpc("tn_admin_reconcile_future_regular_schedules", {
      target_branch_id: branchId,
      target_ticket_ids: null,
      target_operation_key: `future-regular-preview-${Date.now()}`,
      target_dry_run: true,
    });
    const rows = Array.isArray(result?.results) ? result.results : [];
    const eligibleRows = rows.filter((row) => (
      row?.eligible === true
      && Number(row.createdCount) > 0
      && Number(row.remainingUnassignedUnits) === 0
      && Number(row.conflictCount) === 0
    ));
    scheduleV2IntegrityPreviewState = {
      branchId,
      ticketIds: eligibleRows.map((row) => String(row.ticketId || "")).filter(Boolean),
      plannedLessonCount: eligibleRows.reduce((sum, row) => sum + Number(row.createdCount || 0), 0),
      plannedUnits: eligibleRows.reduce((sum, row) => sum + Number(row.createdUnits || 0), 0),
    };
    renderScheduleV2IntegrityResult(result, eligibleRows);
    return true;
  } catch (error) {
    if (summary) summary.textContent = "점검 실패";
    if (list) list.textContent = "서버 점검에 실패했습니다. 로그인과 연결 상태를 확인한 뒤 다시 시도해 주세요.";
    resetScheduleV2IntegrityPreview();
    return false;
  } finally {
    if (checkButton) checkButton.disabled = false;
  }
}
