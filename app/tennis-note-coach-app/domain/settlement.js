// 코치 정산 금액을 계산하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachSettlementMonth() {
  const fallback = localDateKey().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(String(state.settlementMonth || ""))) state.settlementMonth = fallback;
  return state.settlementMonth;
}

function coachSettlementRuleLabel(settlement = {}) {
  if (settlement.ruleType === "hourly") return `시급 ${formatCoachWon(settlement.hourlyRate)}`;
  const rate = Math.round((Number(settlement.ruleRate) || 0) * 100);
  const basis = settlement.settlementBasis === "actual_paid_inc_vat" ? "실결제" : "정산 기준가";
  const calculation = settlement.calculationMode === "monthly_payment" ? "월 결제액" : "진행 횟수";
  return `${calculation} · ${basis}의 ${rate}%`;
}

function normalizedCoachSettlementMemberName(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function coachSettlementRowsForMember(member = {}) {
  const settlementRows = Array.isArray(state.coachSettlement?.rows) ? state.coachSettlement.rows : [];
  const memberNames = member.isGroupDisplay
    ? [member.groupMemberName, member.displayName]
    : [member.displayName, member.name];
  const normalizedNames = new Set(memberNames.map(normalizedCoachSettlementMemberName).filter(Boolean));
  if (!normalizedNames.size) return [];
  return settlementRows.filter((row) => normalizedNames.has(normalizedCoachSettlementMemberName(row.memberName)));
}

function coachMemberSettlementSummary(member = {}) {
  const rows = coachSettlementRowsForMember(member);
  if (!rows.length) {
    return {
      linked: false,
      sessions: 0,
      amount: 0,
      label: state.coachSettlementLoading ? "정산 확인 중" : "정산 연결 확인 필요",
    };
  }
  const sessions = rows.reduce((sum, row) => sum + (Number(row.settledSessions) || 0), 0);
  const amount = rows.reduce((sum, row) => sum + (Number(row.estimatedSettlement) || 0), 0);
  return {
    linked: true,
    sessions,
    amount,
    label: `${sessions}회 · ${formatCoachWon(amount)}`,
  };
}

function coachSettlementReconciliationScope() {
  return {
    branchId: String(state.coach?.branchId || "").trim(),
    coachRoleId: String(state.coach?.coachRoleId || "").trim(),
    settlementMonth: `${coachSettlementMonth()}-01`,
  };
}

function coachSettlementReconciliationScopeSignature(scope = coachSettlementReconciliationScope()) {
  return [scope.branchId, scope.coachRoleId, scope.settlementMonth].join(":");
}

function coachSettlementReconciliationScopeMatches(value, scope = coachSettlementReconciliationScope()) {
  const received = value?.scope || {};
  return String(received.branchId || "") === scope.branchId
    && String(received.coachRoleId || "") === scope.coachRoleId
    && String(received.settlementMonth || "").slice(0, 10) === scope.settlementMonth;
}

function normalizeCoachSettlementReconciliationReason(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function coachSettlementReconciliationReasonError(value = "") {
  const reason = normalizeCoachSettlementReconciliationReason(value);
  const length = Array.from(reason).length;
  if (length < 2 || length > 240) return "이의 사유를 2~240자로 입력해 주세요.";
  if (
    /[<>\u0000-\u001F\u007F]/.test(reason)
    || reason.includes("@")
    || /(?:https?:\/\/|www\.|javascript:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.test(reason)
    || /\d(?:[\s().+\-]*\d){6,}/.test(reason)
  ) return "개인정보나 연락처·링크를 제외하고 확인할 항목만 적어 주세요.";
  return "";
}

function coachSettlementReconciliationPayloadIsExact(value, scope = coachSettlementReconciliationScope()) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !coachSettlementReconciliationScopeMatches(value, scope)) return false;
  const remoteState = String(value.state || "").toUpperCase();
  if (remoteState === "EMPTY") {
    return value.snapshot == null && value.confirmation == null && value.reconciliation == null;
  }
  if (!["PENDING", "ACKNOWLEDGED", "DISPUTED"].includes(remoteState)) return false;
  const snapshot = value.snapshot || {};
  const confirmation = value.confirmation || {};
  const reconciliation = value.reconciliation;
  const totals = snapshot.totals || {};
  const displayedTotalsAreExact = [
    totals.settledSessions,
    totals.settledMinutes,
    totals.totalSettlementAmount,
  ].every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0);
  const exactSnapshot = Boolean(
    snapshot.snapshotId
    && Number.isInteger(snapshot.revision)
    && snapshot.revision > 0
    && String(snapshot.status || "").toLowerCase() === "calculated"
    && String(snapshot.calculationVersion || "") === "r3_monthly_settlement_v1"
    && /^[0-9a-f]{64}$/i.test(String(snapshot.sourceFingerprint || ""))
    && displayedTotalsAreExact
    && confirmation.confirmationId
    && String(confirmation.status || "").toLowerCase() === "confirmed"
    && String(confirmation.confirmationVersion || "") === "r3_monthly_settlement_confirmation_v1"
    && !Number.isNaN(Date.parse(String(confirmation.confirmedAt || "")))
  );
  if (!exactSnapshot) return false;
  if (remoteState === "PENDING") return reconciliation == null;
  const responseReason = normalizeCoachSettlementReconciliationReason(reconciliation?.reason || "");
  const responseIsExact = remoteState === "ACKNOWLEDGED"
    ? !responseReason
    : !coachSettlementReconciliationReasonError(responseReason);
  return Boolean(
    reconciliation?.reconciliationId
    && String(reconciliation.status || "").toUpperCase() === remoteState
    && String(reconciliation.responseVersion || "") === "r3_monthly_settlement_coach_reconciliation_v1"
    && !Number.isNaN(Date.parse(String(reconciliation.respondedAt || "")))
    && responseIsExact
  );
}

function coachSettlementReconciliationErrorContract(error) {
  const raw = String(error?.payload?.message || error?.payload?.code || error?.message || "").toLowerCase();
  if (raw.includes("reason_length") || raw.includes("reason_sensitive") || raw.includes("acknowledgement_reason")) {
    return {
      state: "PENDING",
      message: "이의 사유를 안전한 내용으로 수정한 뒤 다시 저장해 주세요.",
      validation: raw.includes("reason_sensitive")
        ? "개인정보나 연락처·링크를 제외하고 확인할 항목만 적어 주세요."
        : "이의 사유를 2~240자로 입력해 주세요.",
    };
  }
  if (raw.includes("stale") || raw.includes("revision") || raw.includes("source_mismatch") || raw.includes("source_fingerprint")) {
    return {
      state: "STALE",
      message: "관리자 확정 계산본이 변경되었습니다. 최신 상태를 다시 확인해 주세요.",
      validation: "",
    };
  }
  if (
    raw.includes("conflict")
    || raw.includes("operation_key_reused")
    || raw.includes("scope_mismatch")
    || raw.includes("already")
  ) {
    return {
      state: "CONFLICT",
      message: "다른 화면의 응답과 상태가 겹쳤습니다. 서버 상태를 다시 확인해 주세요.",
      validation: "",
    };
  }
  if (raw.includes("approved_coach_scope_required") || raw.includes("authentication_required") || raw.includes("forbidden")) {
    return {
      state: "ERROR",
      message: "현재 담당 코치 권한과 지점을 확인할 수 없습니다. 다시 로그인한 뒤 확인해 주세요.",
      validation: "",
    };
  }
  if (raw.includes("pgrst202") || raw.includes("tn_coach_monthly_settlement_reconciliation")) {
    return {
      state: "ERROR",
      message: "코치 정산 확인 기능을 업데이트하는 중입니다. 잠시 후 다시 확인해 주세요.",
      validation: "",
    };
  }
  return {
    state: "ERROR",
    message: "확정 정산 상태를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    validation: "",
  };
}

function coachSettlementReconciliationStateLabel(value = state.coachSettlementReconciliationUiState) {
  return ({
    EMPTY: "확정 대기",
    LOADING: "확인 중",
    PENDING: "응답 대기",
    ACKNOWLEDGED: "확인 완료",
    DISPUTED: "이의 접수",
    STALE: "다시 확인 필요",
    CONFLICT: "상태 확인 필요",
    ERROR: "불러오기 실패",
  })[String(value || "").toUpperCase()] || "확정 대기";
}

function coachSettlementReconciliationTimeLabel(value = "") {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "시각 확인 필요"
    : new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
}

function coachSettlementReconciliationDefaultMessage(uiState) {
  return ({
    EMPTY: "관리자가 이 월의 정산을 확정하면 여기에서 응답할 수 있습니다.",
    LOADING: "관리자가 확정한 월 정산을 확인하고 있습니다.",
    PENDING: "관리자 확정 계산본입니다. 월·횟수·정산액을 확인한 뒤 한 번만 응답해 주세요.",
    ACKNOWLEDGED: "관리자 확정 정산을 확인했다고 응답했습니다.",
    DISPUTED: "이의 사유를 관리자에게 전달했습니다.",
    STALE: "관리자 확정 계산본이 변경되었습니다. 최신 상태를 다시 확인해 주세요.",
    CONFLICT: "다른 화면의 응답과 상태가 겹쳤습니다. 서버 상태를 다시 확인해 주세요.",
    ERROR: "확정 정산 상태를 불러오지 못했습니다. 다시 확인해 주세요.",
  })[uiState] || "관리자 확정 정산을 확인하고 있습니다.";
}

function coachSettlementReconciliationResponseMatches(value, expected, targetStatus, targetReason, scope) {
  if (!coachSettlementReconciliationPayloadIsExact(value, scope)) return false;
  const snapshot = value.snapshot || {};
  const confirmation = value.confirmation || {};
  const reconciliation = value.reconciliation || {};
  return String(value.state || "").toUpperCase() === targetStatus.toUpperCase()
    && String(snapshot.snapshotId || "") === String(expected.snapshotId || "")
    && Number(snapshot.revision || 0) === Number(expected.revision || 0)
    && String(snapshot.sourceFingerprint || "") === String(expected.sourceFingerprint || "")
    && String(confirmation.confirmationId || "") === String(expected.confirmationId || "")
    && String(reconciliation.status || "").toLowerCase() === targetStatus
    && normalizeCoachSettlementReconciliationReason(reconciliation.reason || "") === targetReason;
}
