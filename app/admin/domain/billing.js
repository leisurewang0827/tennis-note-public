// 결제·정산 값 계산. 순수 함수만 둔다.
// app.js 에서 본문 그대로 옮겨왔다. adminLocalDateKey 는 values.js 에 있다.

function billingEffectiveDate(item = {}) {
  const candidates = [
    item.paidAt,
    item.paid_at,
    item.verifiedAt,
    item.verified_at,
    item.requestedAt,
    item.requested_at,
    item.createdAt,
    item.created_at,
  ];
  for (const value of candidates) {
    const text = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return adminLocalDateKey(new Date(parsed));
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  }
  return "";
}

function billingMatchesMonth(item, month) {
  if (!month) return true;
  return billingIncludedInRevenue(item) && billingEffectiveMonth(item) === month;
}


function billingIncludedInRevenue(item = {}) {
  return String(item.revenueAttributionStatus || item.revenue_attribution_status || "included") === "included";
}

function billingEffectiveMonth(item = {}) {
  const revenueMonth = String(item.revenueMonth || item.revenue_month || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(revenueMonth) ? revenueMonth : billingEffectiveDate(item).slice(0, 7);
}

function monthlySettlementMonthStart() {
  return /^\d{4}-\d{2}$/.test(String(state.billingMonth || ""))
    ? `${state.billingMonth}-01`
    : "";
}

function monthlySettlementEligibleCoaches() {
  const seen = new Set();
  return operationBranchCoaches()
    .filter((coach) => coach && coach.status === "active" && coach.serverRoleId)
    .filter((coach) => {
      const roleId = String(coach.serverRoleId || "");
      if (!roleId || seen.has(roleId)) return false;
      seen.add(roleId);
      return true;
    });
}

function monthlySettlementScope() {
  return {
    branchId: String(activeOperationBranchId() || ""),
    coachRoleId: String(monthlySettlementConfirmationState.coachRoleId || ""),
    settlementMonth: monthlySettlementMonthStart(),
  };
}

function monthlySettlementScopeSignature(scope = monthlySettlementScope()) {
  return [scope.branchId, scope.coachRoleId, scope.settlementMonth].join(":");
}

function monthlySettlementPayloadScope(value = {}) {
  return value?.scope || {};
}

function monthlySettlementScopeMatches(value, scope = monthlySettlementScope()) {
  const received = monthlySettlementPayloadScope(value);
  return String(received.branchId || "") === scope.branchId
    && String(received.coachRoleId || "") === scope.coachRoleId
    && String(received.settlementMonth || "").slice(0, 10) === scope.settlementMonth;
}

function monthlySettlementPreviewHasSources(preview = {}) {
  const totals = preview?.totals || {};
  return [
    totals.paymentCount,
    totals.ticketCount,
    totals.lessonCount,
    totals.sessionCount,
    Array.isArray(preview?.lines) ? preview.lines.length : 0,
  ].some((value) => Number(value || 0) > 0);
}

function monthlySettlementSnapshotFrom(value = {}) {
  if (value?.snapshot && typeof value.snapshot === "object") return value.snapshot;
  if (value?.snapshotId) return value;
  return null;
}

function monthlySettlementSnapshotMatchesPreview(snapshot, preview, scope = monthlySettlementScope()) {
  if (!snapshot || !preview) return false;
  return monthlySettlementScopeMatches({ scope: snapshot.scope || preview.scope }, scope)
    && String(snapshot.sourceFingerprint || "") === String(preview.sourceFingerprint || "")
    && Number(snapshot.revision || 0) > 0;
}

function monthlySettlementErrorContract(error) {
  const raw = String(
    error?.payload?.message
    || error?.payload?.code
    || error?.message
    || "monthly_settlement_unknown_error",
  ).toLowerCase();
  if (raw.includes("stale") || raw.includes("source_mismatch") || raw.includes("fingerprint")) {
    return {
      status: "STALE",
      tone: "warn",
      message: "원천 기록이 변경되었습니다. 최신 계산 결과를 다시 확인해 주세요.",
      errorCode: "settlement_source_stale",
    };
  }
  if (
    raw.includes("conflict")
    || raw.includes("operation_key_reused")
    || raw.includes("scope_mismatch")
    || raw.includes("branch_mismatch")
    || raw.includes("already_exists")
  ) {
    return {
      status: "CONFLICT",
      tone: "warn",
      message: "다른 확인 작업과 상태가 겹쳤습니다. 서버 상태를 다시 불러와 확인해 주세요.",
      errorCode: "settlement_confirmation_conflict",
    };
  }
  if (raw.includes("admin_role_required") || raw.includes("authentication_required") || raw.includes("forbidden")) {
    return {
      status: "ERROR",
      tone: "danger",
      message: "관리자 권한을 다시 확인한 뒤 시도해 주세요.",
      errorCode: "settlement_confirmation_forbidden",
    };
  }
  if (raw.includes("busy") || raw.includes("55p03")) {
    return {
      status: "CONFLICT",
      tone: "warn",
      message: "정산 원천을 다른 작업이 확인 중입니다. 잠시 후 다시 불러와 주세요.",
      errorCode: "settlement_source_busy",
    };
  }
  return {
    status: "ERROR",
    tone: "danger",
    message: "월 정산 확인 상태를 불러오지 못했습니다. 입력은 유지되며 다시 시도할 수 있습니다.",
    errorCode: "settlement_confirmation_error",
  };
}

function monthlySettlementStateLabel(status = monthlySettlementConfirmationState.status) {
  return ({
    EMPTY: "확인 전",
    LOADING: "불러오는 중",
    READY: "확인 가능",
    STALE: "다시 계산 필요",
    CONFLICT: "상태 확인 필요",
    CONFIRMED: "확인됨",
    ERROR: "불러오기 실패",
  })[status] || "확인 전";
}

function monthlySettlementConfirmedReadbackMatches(value, expected, scope) {
  const snapshot = monthlySettlementSnapshotFrom(value);
  return String(value?.state || "").toUpperCase() === "CONFIRMED"
    && monthlySettlementScopeMatches(value, scope)
    && String(snapshot?.snapshotId || "") === String(expected?.snapshotId || "")
    && Number(snapshot?.revision || 0) === Number(expected?.revision || 0)
    && String(snapshot?.sourceFingerprint || "") === String(expected?.sourceFingerprint || "")
    && String(value?.confirmation?.status || "") === "confirmed";
}
