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
// 비공개 원본의 확정 이력 검증기. 금액 재계산·확정·응답·지급은 하지 않습니다.
function adminHistoryScopeMatches(value, scope = adminSettlementHistoryScope()) {
  const received = value?.scope || {};
  return String(received.branchId || "") === scope.branchId
    && String(received.coachRoleId || "") === scope.coachRoleId
    && String(received.settlementMonth || "").slice(0, 10) === scope.settlementMonth;
}

function adminHistoryPayloadIsExact(value, scope = adminSettlementHistoryScope()) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !adminHistoryScopeMatches(value, scope)) return false;
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
    && ["r3_monthly_settlement_v1", "r3_effective_settlement_v2"].includes(String(snapshot.calculationVersion || ""))
    && /^[0-9a-f]{64}$/i.test(String(snapshot.sourceFingerprint || ""))
    && displayedTotalsAreExact
    && confirmation.confirmationId
    && String(confirmation.status || "").toLowerCase() === "confirmed"
    && String(confirmation.confirmationVersion || "") === "r3_monthly_settlement_confirmation_v1"
    && !Number.isNaN(Date.parse(String(confirmation.confirmedAt || "")))
  );
  if (!exactSnapshot) return false;
  if (remoteState === "PENDING") return reconciliation == null;
  const responseReason = normalizeAdminHistoryReason(reconciliation?.reason || "");
  const responseIsExact = remoteState === "ACKNOWLEDGED"
    ? !responseReason
    : !adminHistoryReasonError(responseReason);
  return Boolean(
    reconciliation?.reconciliationId
    && String(reconciliation.status || "").toUpperCase() === remoteState
    && String(reconciliation.responseVersion || "") === "r3_monthly_settlement_coach_reconciliation_v1"
    && !Number.isNaN(Date.parse(String(reconciliation.respondedAt || "")))
    && responseIsExact
  );
}

function adminHistoryReasonError(value = "") {
  const reason = normalizeAdminHistoryReason(value);
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

function normalizeAdminHistoryReason(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function adminSettlementHistoryScope() {
  return { branchId: String(activeOperationBranchId() || ""), coachRoleId: String(adminSettlementHistory.coachRoleId || ""), settlementMonth: `${state.billingMonth}-01` };
}

function adminSettlementHistoryCoaches() {
  const branchId = activeOperationBranchId();
  const entries = operationBranchCoaches().filter((coach) => coach.serverRoleId && coach.branchId === branchId && coach.status !== "inactive");
  if (new Set(entries.map((coach) => String(coach.serverRoleId))).size !== entries.length) return [];
  return entries;
}

function adminSettlementHistoryScopeKey(scope = adminSettlementHistoryScope()) {
  return [scope.branchId, scope.coachRoleId, scope.settlementMonth].join(":");
}

function adminSettlementHistoryPayloadIsExact(value, scope) {
  if (value?.ok !== true || !adminHistoryScopeMatches(value, scope)) return false;
  if (value.state === "EMPTY") return value.snapshot == null && value.confirmation == null && value.reconciliation == null;
  // 계산만 된 스냅샷은 확정 이력으로 표시하지 않습니다.
  if (value.state === "CALCULATED") return value.confirmation == null && value.reconciliation == null;
  if (value.state !== "CONFIRMED") return false;
  const responseState = value.reconciliation == null ? "PENDING" : String(value.reconciliation.status || "").toUpperCase();
  return adminHistoryPayloadIsExact({ ...value, state: responseState }, scope);
}
