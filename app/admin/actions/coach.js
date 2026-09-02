// 코치 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function setCoachWorkBlocks(coachId, workBlocks, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  if (!coach) return;
  coach.workBlocks = workBlocks.map((block, index) => ({
    id: block.id || `${coachId}-preset-${index}`,
    days: block.days,
    start: block.start,
    end: block.end,
    label: block.label || "근무",
  }));
  const detail = getCoachAvailabilityDetail(coachId);
  coach.availableDays = detail.days;
  coach.availableStart = detail.start;
  coach.availableEnd = detail.end;
}

async function setCoachApproval(coachId, nextStatus, button) {
  const coach = coaches.find((item) => item.id === coachId);
  if (!coach?.serverRoleId) {
    showToast("실서버 코치 권한 정보를 다시 불러와 주세요.");
    return;
  }
  const disabling = nextStatus === "disabled";
  if (disabling && !window.confirm(`${coach.name}의 코치 승인을 해제할까요?\n\n회원 계정과 과거 수업·정산 기록은 유지되고 코치 모드만 중지됩니다.`)) return;
  const result = await invokeAdminAccountControl({
    action: "set_coach_status",
    coachRoleId: coach.serverRoleId,
    status: nextStatus,
  }, button, disabling ? "코치 승인을 해제했습니다." : "코치 승인을 다시 완료했습니다.");
  if (result && !disabling) {
    const refreshedCoach = coaches.find((item) => item.serverRoleId === coach.serverRoleId);
    if (refreshedCoach) openCoachStaffModal(coachStaffEditKey(refreshedCoach));
  }
}

function applyServerCoachSnapshot({
  serverUsers = [],
  serverCoachRoles = [],
  serverCoachAvailability = [],
  serverAuthLinks = [],
  serverAuthSwitches = [],
  serverSettlementTerms = [],
} = {}) {
  const usersById = new Map(serverUsers.map((user) => [user.id, user]));
  const authLinksByUserId = new Map();
  serverAuthLinks.forEach((link) => {
    const links = authLinksByUserId.get(link.user_id) || [];
    links.push(link);
    authLinksByUserId.set(link.user_id, links);
  });
  const availabilityByRoleId = new Map();
  serverCoachAvailability.forEach((availability) => {
    const rows = availabilityByRoleId.get(availability.coach_role_id) || [];
    rows.push(availability);
    availabilityByRoleId.set(availability.coach_role_id, rows);
  });
  const pendingAuthSwitchByUserId = new Map(
    serverAuthSwitches
      .filter((item) => item.status === "pending")
      .map((item) => [item.user_id, item]),
  );
  const settlementTermByCoachRoleId = new Map();
  serverSettlementTerms.forEach((term) => {
    if (!settlementTermByCoachRoleId.has(term.coach_role_id)) {
      settlementTermByCoachRoleId.set(term.coach_role_id, term);
    }
  });
  const coachIdByRole = new Map();
  const orderedCoachRoles = [...serverCoachRoles].sort((left, right) => {
    const score = (role) => {
      const user = usersById.get(role.user_id) || {};
      const links = authLinksByUserId.get(role.user_id) || [];
      return Number(role.employment_status === "active") * 4
        + Number(role.status === "approved") * 2
        + Number(Boolean(user.auth_user_id || links.length));
    };
    return score(left) - score(right);
  });
  orderedCoachRoles.forEach((role, index) => {
    const coach = mergeServerCoachRole(role, index);
    const coachUser = usersById.get(role.user_id) || {};
    const authLinks = authLinksByUserId.get(role.user_id) || [];
    coach.accountLinked = Boolean(coachUser.auth_user_id || authLinks.length);
    coach.account = coach.accountLinked ? (coachUser.name || role.display_name || "가입 완료") : "회원가입 전";
    coach.phone = coachUser.phone || "";
    const coachPhone = normalizedMemberPhone(coach.phone);
    const coachName = normalizedCoachLinkName(coachUser.name || role.display_name);
    const loginCandidates = !coach.accountLinked && coachPhone && coachName
      ? serverUsers.filter((candidate) => {
        if (candidate.id === role.user_id || candidate.status !== "active" || candidate.merged_into_user_id) return false;
        const candidateLinks = authLinksByUserId.get(candidate.id) || [];
        return candidate.role === "member"
          && Boolean(candidate.auth_user_id || candidateLinks.length)
          && normalizedMemberPhone(candidate.phone) === coachPhone
          && normalizedCoachLinkName(candidate.name) === coachName;
      })
      : [];
    coach.loginCandidateUserId = loginCandidates.length === 1 ? loginCandidates[0].id : "";
    coach.loginCandidateCount = loginCandidates.length;
    coach.photoUrl = coachUser.profile_photo_url || coach.photoUrl || "";
    coach.serverUserId = role.user_id;
    coach.role = role.job_title || coach.role || "레슨";
    coach.bio = role.bio || "";
    coach.employmentStatus = role.employment_status || (role.status === "disabled" ? "ended" : "active");
    coach.employmentStartedOn = role.employment_started_on || "";
    coach.employmentEndedOn = role.employment_ended_on || "";
    coach.archivedAt = role.archived_at || "";
    coach.deletedAt = role.deleted_at || "";
    coach.authProviders = authProvidersFromLinks(authLinks);
    coach.authSwitch = pendingAuthSwitchByUserId.get(role.user_id) || null;
    coach.lastSignInAt = authLinks.map((link) => link.last_sign_in_at).filter(Boolean).sort().at(-1) || "";
    coach.approvalStatus = role.status || "pending";
    const availabilityRows = availabilityByRoleId.get(role.id) || [];
    coach.workBlocks = coachBlocksFromAvailability(availabilityRows, "available");
    coach.breakBlocks = coachBlocksFromAvailability(availabilityRows, "blocked");
    coachIdByRole.set(role.id, coach.id);
  });
  const liveCoachIds = new Set(coachIdByRole.values());
  replaceArray(coaches, coaches.filter((coach) => liveCoachIds.has(coach.id)));
  const savedSettlementRules = [...coachSettlementRules];
  replaceArray(coachSettlementRules, coaches.map((coach) => {
    const term = settlementTermByCoachRoleId.get(coach.serverRoleId);
    const savedRule = savedSettlementRules.find((rule) => rule.coach === coach.name);
    const baseRule = defaultCoachSettlementRule(coach, savedRule);
    const roleRate = Number(coach.settlementRate) > 1 ? Number(coach.settlementRate) / 100 : Number(coach.settlementRate);
    return {
      ...baseRule,
      method: term?.settlement_type || coach.settlementType || baseRule.method,
      ratio: term?.settlement_type === "ratio" ? Number(term.coach_rate) : (coach.settlementType === "ratio" ? roleRate : 0),
      hourly: term?.settlement_type === "hourly" ? Number(term.hourly_rate) : (coach.settlementType === "hourly" ? Number(coach.hourlyRate) : 0),
      cardBase: term?.settlement_basis === "actual_paid_inc_vat" ? "paid" : "cash",
      calculationMode: term?.settlement_calculation_mode || coach.settlementCalculationMode || baseRule.calculationMode,
      substitute: term?.substitute_policy || baseRule.substitute,
      effectiveFrom: term?.effective_from || baseRule.effectiveFrom,
      serverRoleId: coach.serverRoleId,
    };
  }));
  return { coachIdByRole, pendingAuthSwitchByUserId };
}

function addCoachStaffBlock(type) {
  const draft = coachStaffEditorState.draft;
  if (!draft) return;
  const title = type === "break" ? "Break" : "Work";
  const days = $$(`[data-coach-staff-${type}-day]:checked`).map((input) => input.value);
  const start = $(`#coachStaff${title}Start`)?.value || "";
  const end = $(`#coachStaff${title}End`)?.value || "";
  const label = $(`#coachStaff${title}Label`)?.value.trim() || (type === "break" ? "브레이크" : "근무");
  if (!days.length || !start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
    coachStaffEditorState.message = "요일과 시작·종료 시간을 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  const target = type === "break" ? draft.breakBlocks : draft.workBlocks;
  const editingId = coachStaffEditorState.editingBlockType === type
    ? coachStaffEditorState.editingBlockId
    : "";
  const nextBlock = { id: editingId || `${type}-${Date.now()}`, days, start, end, label };
  if (editingId) {
    const index = target.findIndex((block) => block.id === editingId);
    if (index >= 0) target.splice(index, 1, nextBlock);
    else target.push(nextBlock);
  } else {
    target.push(nextBlock);
  }
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "변경사항이 있습니다. 아래 저장을 눌러 서버에 반영하세요.";
  renderCoachStaffModal();
}

function cancelCoachStaffBlockEdit(allCoachStaffEditorState = coachStaffEditorState) {
  allCoachStaffEditorState.editingBlockType = "";
  allCoachStaffEditorState.editingBlockId = "";
  allCoachStaffEditorState.message = "";
  renderCoachStaffModal();
}

function removeCoachStaffBlock(type, blockId, allCoachStaffEditorState = coachStaffEditorState) {
  const draft = allCoachStaffEditorState.draft;
  if (!draft) return;
  if (type === "break") draft.breakBlocks = draft.breakBlocks.filter((block) => block.id !== blockId);
  else draft.workBlocks = draft.workBlocks.filter((block) => block.id !== blockId);
  if (allCoachStaffEditorState.editingBlockId === blockId) {
    allCoachStaffEditorState.editingBlockType = "";
    allCoachStaffEditorState.editingBlockId = "";
  }
  allCoachStaffEditorState.message = "삭제할 시간이 표시에서 빠졌습니다. 아래 저장을 눌러 서버에 반영하세요.";
  renderCoachStaffModal();
}

async function saveCoachStaff() {
  if (coachStaffEditorState.saving) return;
  readCoachStaffPanel();
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft || !adminApprovalReady() || !client?.rpc) {
    coachStaffEditorState.message = "관리자 로그인과 서버 연결을 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (!draft.name || (coachStaffEditorState.mode === "create" && !draft.phone)) {
    coachStaffEditorState.message = "이름과 휴대전화를 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  const branchId = activeOperationBranchId();
  if (!branchId || String(draft.branchId || "") !== branchId) {
    coachStaffEditorState.message = "현재 운영 지점과 코치 소속 지점을 다시 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (draft.settlement.method === "ratio" && (draft.settlement.ratio < 0 || draft.settlement.ratio > 100)) {
    coachStaffEditorState.message = "정산 비율은 0~100 사이로 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (draft.settlement.method === "hourly" && draft.settlement.hourly <= 0) {
    coachStaffEditorState.message = "시급을 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.settlement.effectiveFrom || "")) {
    coachStaffEditorState.message = "정산 적용 시작일을 확인해주세요.";
    coachStaffEditorState.settlementDetailsOpen = true;
    renderCoachStaffModal();
    return;
  }
  const button = $("#saveCoachStaffButton");
  coachStaffEditorState.saving = true;
  if (button) { button.disabled = true; button.textContent = "저장 중"; }
  try {
    const result = await client.rpc("tn_admin_save_coach_staff_v2", {
      target_record: coachStaffPayload(draft),
      expected_revision: draft.coachRoleId ? Number(draft.availabilityRevision) || 0 : null,
    });
    const coachRoleId = result?.coachRoleId || result?.coach_role_id || draft.coachRoleId;
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => (
      coach.serverRoleId === coachRoleId
      && String(coach.branchId || "") === branchId
    )) || coaches.find((coach) => (
      coach.name === draft.name
      && String(coach.branchId || "") === branchId
    ));
    if (!coachStaffServerMatches(saved, draft)) {
      throw new Error("coach_staff_server_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") {
      await loadLiveSchedulePolicyFromServer();
    }
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    showToast("코치·직원 정보가 서버에 저장되었습니다.");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    coachStaffEditorState.message = raw.includes("tn_admin_save_coach_staff_v2") || raw.includes("PGRST202")
      ? "코치·직원 통합 DB 기능을 먼저 적용해주세요."
      : raw.includes("coach_staff_revision_conflict")
        ? "다른 화면에서 코치 정보가 먼저 수정되었습니다. 최신 내용을 다시 불러온 뒤 다시 수정해주세요."
      : raw.includes("server_verification")
        ? "저장은 요청됐지만 서버 재확인에 실패했습니다. 새로고침 후 확인해주세요."
        : `저장 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  } finally {
    coachStaffEditorState.saving = false;
    const current = $("#saveCoachStaffButton");
    if (current) { current.disabled = false; current.textContent = "저장"; }
  }
}

async function setCoachStaffState(targetState) {
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft?.coachRoleId || !client?.rpc || operationsRole() !== "admin") return;
  const labels = { approved: "코치 승인", disabled: "승인 해제", ended: "근무 종료", archived: "목록에서 숨기기(보관)", restored: "근무 복원" };
  if (!window.confirm(`${draft.name} 코치를 ${labels[targetState] || targetState} 처리할까요?`)) return;
  try {
    await client.rpc("tn_admin_set_coach_staff_state", {
      target_coach_role_id: draft.coachRoleId,
      target_state: targetState,
      target_effective_on: new Date().toISOString().slice(0, 10),
    });
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => coach.serverRoleId === draft.coachRoleId);
    const expectedApproval = ["approved", "restored"].includes(targetState) ? "approved" : "disabled";
    const expectedEmployment = targetState === "ended"
      ? "ended"
      : targetState === "archived"
        ? "archived"
        : "active";
    if (
      !saved
      || saved.approvalStatus !== expectedApproval
      || (saved.employmentStatus || "active") !== expectedEmployment
    ) {
      throw new Error("coach_staff_state_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") await loadLiveSchedulePolicyFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    const completion = targetState === "archived"
      ? "보관했습니다. 근무 중 목록에서 숨겨지고 종료·보관에서 복원할 수 있습니다."
      : targetState === "ended"
        ? "근무 종료했습니다. 신규 수업 배정에서 제외됩니다."
        : targetState === "restored"
          ? "근무 중으로 복원했습니다."
          : `${labels[targetState] || "상태 변경"} 완료`;
    showToast(completion);
  } catch (error) {
    coachStaffEditorState.message = `상태 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  }
}

async function deleteCoachStaff() {
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft?.coachRoleId || !client?.rpc || operationsRole() !== "admin") return;
  if (!window.confirm(`${draft.name} 코치를 삭제할까요?\n현재 앱과 시간표에서는 제외하고 과거 수업·정산 기록은 보존합니다.`)) return;
  try {
    const result = await client.rpc("tn_admin_delete_coach_staff", {
      target_coach_role_id: draft.coachRoleId,
    });
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => coach.serverRoleId === draft.coachRoleId);
    if (!saved?.deletedAt || saved.approvalStatus !== "disabled") {
      throw new Error("coach_staff_delete_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") await loadLiveSchedulePolicyFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    const futureCount = Number(result?.futureLessonCount) || 0;
    showToast(futureCount
      ? `코치를 삭제했습니다. 남은 예정 수업 ${futureCount}건은 재배정이 필요합니다.`
      : "코치를 삭제했습니다.");
  } catch (error) {
    coachStaffEditorState.message = `코치 삭제 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  }
}

async function saveCoachLaneOrder() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || !coachLaneOrderEditorState.confirmed || !coachLaneOrderEditorState.revision) return;
  coachLaneOrderEditorState.saving = true;
  coachLaneOrderEditorState.message = "시간표 열 순서를 저장하는 중입니다.";
  renderCoachLaneOrderEditor();
  try {
    const saved = await client.rpc("tn_admin_save_coach_schedule_lane_order", {
      target_branch_id: branchId,
      target_role_ids: coachLaneOrderEditorState.roleIds,
      target_expected_revision: coachLaneOrderEditorState.revision,
      target_reason: "운영 설정 시간표 열 순서 변경",
    });
    if (!saved?.saved || !Array.isArray(saved.after)) throw new Error("coach_lane_order_save_verification_failed");
    const savedOrder = saved.after.map((item) => String(item.roleId));
    if (savedOrder.join("|") !== coachLaneOrderEditorState.roleIds.join("|")) {
      throw new Error("coach_lane_order_server_mismatch");
    }
    await refreshCoachStaffData();
    coachLaneOrderEditorState.roleIds = savedOrder;
    coachLaneOrderEditorState.baselineRoleIds = [...savedOrder];
    coachLaneOrderEditorState.revision = String(saved.revision || "");
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = "서버 저장 완료. 회원·코치·관리자 시간표에 같은 순서가 적용됩니다.";
    scheduleAdminOperationalCacheWrite();
    saveSnapshot();
    renderCoaches();
    showToast("시간표 열 순서를 저장했습니다.");
  } catch (error) {
    const raw = `${error?.message || ""} ${error?.payload?.message || ""}`;
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = /coach_lane_order_revision_conflict/i.test(raw)
      ? "다른 관리자가 먼저 변경했습니다. 서버 확인을 다시 눌러주세요."
      : `순서 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`;
  } finally {
    coachLaneOrderEditorState.saving = false;
    renderCoachLaneOrderEditor();
  }
}

async function reconcileCoachLogin(coachKey) {
  const coach = coachForStaffEditKey(coachKey);
  const client = window.TennisNoteDataClient;
  if (!coach?.serverRoleId || !coach.loginCandidateUserId || !client?.rpc || operationsRole() !== "admin") {
    showToast("코치 계정을 정확히 식별하지 못했습니다. 목록을 새로고침한 뒤 다시 확인해주세요.");
    return;
  }
  if (!window.confirm(`${coach.name} 코치의 가입 계정을 연결할까요?`)) return;
  try {
    await client.rpc("tn_admin_reconcile_coach_login", {
      target_coach_role_id: coach.serverRoleId,
      source_signup_user_id: coach.loginCandidateUserId,
      target_reason: "관리자 코치 가입 계정 연결",
    });
    await refreshCoachStaffData();
    const saved = coaches.find((item) => item.serverRoleId === coach.serverRoleId);
    if (!saved?.accountLinked) throw new Error("coach_login_reconciliation_verification_failed");
    renderCoaches();
    showToast(`${coach.name} 코치 계정 연결 완료`);
  } catch (error) {
    showToast(`코치 계정 연결 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}
