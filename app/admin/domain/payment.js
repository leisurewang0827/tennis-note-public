// 결제·정산 값 판정을 하는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function usesHourlySettlementDefault(coach, existingRule = null) {
  const text = `${coach?.role || ""} ${coach?.availability || ""}`;
  return existingRule?.method === "hourly" || coach?.availability === "weekend" || /주말|대타|보강/.test(text);
}

function billingStatusFromSharedPayment(request = {}) {
  if (String(request.method || "").includes("PortOne 설정 필요")) {
    return { status: "draft", statusLabel: "결제설정대기" };
  }
  if (String(request.method || "").includes("관리자 상담") || String(request.amountLabel || "") === "무료") {
    return { status: "draft", statusLabel: "상담요청" };
  }
  if (String(request.status || "").includes("서버 검증")) {
    return { status: "unverified", statusLabel: "서버검증대기" };
  }
  return { status: "check", statusLabel: "결제확인대기" };
}

function billingStatusFromServerPayment(row = {}) {
  const status = String(row.status || "").toLowerCase();
  const refundStatus = String(row.refund_status || "").toLowerCase();
  const refundMode = String(row.refund_breakdown?.mode || "").toLowerCase();
  if (refundStatus === "processing") return { status: "refund_processing", statusLabel: "환불처리중" };
  if (refundStatus === "reconcile_required" && refundMode === "full_pg_cancel") return { status: "cancel_reconcile", statusLabel: "취소동기화필요" };
  if (refundStatus === "reconcile_required") return { status: "refund_reconcile", statusLabel: "환불동기화필요" };
  if (refundStatus === "failed" && status === "verified") return { status: "paid", statusLabel: "환불재확인" };
  if (status === "ready") return { status: "server_ready", statusLabel: "결제준비" };
  if (status === "paid_unverified") return { status: "unverified", statusLabel: "서버검증대기" };
  if (status === "verified") return { status: "paid", statusLabel: "검증완료" };
  if (status === "failed") return { status: "failed", statusLabel: "결제실패" };
  if (status === "cancelled") return { status: "cancelled", statusLabel: "결제취소" };
  if (status === "refunded") return { status: "refunded", statusLabel: "환불완료" };
  return { status: "check", statusLabel: "확인필요" };
}

function paymentEnvironment(item = {}) {
  const haystack = [
    item.environment,
    item.providerPaymentId,
    item.item,
    item.source,
    item.serverStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("test") || haystack.includes("readiness") || haystack.includes("browser_prepare")
    ? "테스트"
    : "실결제";
}

function paymentEnvironmentBadge(item = {}) {
  const label = paymentEnvironment(item);
  return badge(label === "테스트" ? "neutral" : "ready", label);
}

function paymentSourceText(item = {}) {
  const source = item.source || "관리자";
  const status = item.serverStatus ? ` · 서버상태 ${item.serverStatus}` : "";
  return `${source}${status}`;
}

function billingRowFromServerPayment(row = {}) {
  const providerPaymentId = row.provider_payment_id || row.providerPaymentId || row.id || "";
  const { status, statusLabel } = billingStatusFromServerPayment(row);
  const memberName = row.tn_users?.name || row.user?.name || row.member || "서버 결제";
  const amount = Number(row.final_amount || row.finalAmount || row.amount || 0);
  const isTest = paymentEnvironment({
    providerPaymentId,
    item: row.productTitle || row.item || "",
    source: row.source || "",
    serverStatus: row.status,
  }) === "테스트";
  return {
    member: memberName,
    serverUserId: row.user_id || row.userId || "",
    item: isTest ? "브라우저 연결 테스트" : row.productTitle || row.item || "회원앱 결제",
    amount,
    originalAmount: Number(row.original_amount || row.originalAmount || amount || 0),
    settlementBaseAmount: Number(row.settlement_base_amount ?? row.settlementBaseAmount ?? 0) || 0,
    discountAmount: Number(row.discount_amount || row.discountAmount || 0),
    finalAmount: Number(row.final_amount || row.finalAmount || amount || 0),
    method: row.method || row.provider || "portone",
    status,
    statusLabel,
    providerPaymentId,
    serverPaymentId: row.id || "",
    branchId: row.branch_id || row.branchId || "",
    productId: row.product_id || row.productId || "",
    ticketId: row.ticket_id || row.ticketId || "",
    revenueMonth: row.revenue_month || row.revenueMonth || "",
    revenueMonthSource: row.revenue_month_source || row.revenueMonthSource || "",
    revenueAttributionStatus: row.revenue_attribution_status || row.revenueAttributionStatus || "included",
    revenueExclusionReason: row.revenue_exclusion_reason || row.revenueExclusionReason || "",
    serverStatus: row.status || "",
    requestedAt: row.created_at || row.createdAt || "",
    paidAt: row.paid_at || row.paidAt || "",
    verifiedAt: row.verified_at || row.verifiedAt || "",
    refundedAmount: Number(row.refunded_amount || row.refundedAmount || 0),
    refundStatus: row.refund_status || row.refundStatus || "none",
    refundReason: row.refund_reason || row.refundReason || "",
    refundBreakdown: row.refund_breakdown || row.refundBreakdown || {},
    refundedAt: row.refunded_at || row.refundedAt || "",
    source: "Supabase 결제",
    environment: isTest ? "테스트" : "실결제",
  };
}

function normalizeRefundPolicySettings(settings = {}) {
  const defaultMemo = "회원 사유 환불은 실납부액에서 할인 전 원가의 10%, 사용 회차의 할인 전 금액, 첫 수업 월 예약금 3만원을 차감합니다.";
  const savedMemo = String(settings.memo || "").trim();
  return {
    penaltyRate: Math.min(10, Math.max(0, numericValue(settings.penaltyRate, 10))),
    calculationBasis: "undiscounted_original_price",
    contractBasis: "sessions",
    reservationFee: Math.max(0, numericValue(settings.reservationFee, 30000)),
    reservationFeeFirstMonthOnly: settings.reservationFeeFirstMonthOnly !== false,
    usedSessionBasis: "undiscounted_per_session",
    consumerDisputeFallbackAdminOnly: settings.consumerDisputeFallbackAdminOnly !== false,
    memo: savedMemo || defaultMemo,
  };
}

function badge(status, label) {
  const map = {
    active: "good",
    expired: "neutral",
    waitlist: "neutral",
    attention: "danger",
    setup: "warn",
    ready: "good",
    blocked: "danger",
    scheduled: "neutral",
    available: "good",
    pending: "warn",
    server_ready: "warn",
    unverified: "warn",
    requested: "warn",
    coach_required: "danger",
    confirmed: "good",
    paid: "good",
    check: "warn",
    draft: "neutral",
    failed: "danger",
    cancelled: "neutral",
    refunded: "neutral",
    good: "good",
    warn: "warn",
    danger: "danger",
    neutral: "neutral",
  };
  return `<span class="badge ${map[status] || "neutral"}">${label}</span>`;
}

function normalizeMemberPaymentMethod(method = "") {
  const normalized = String(method || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["bank", "banktransfer", "transfer"].includes(normalized)) return "banktransfer";
  return normalized;
}

function memberUnlinkedVerifiedPayment(member = null, allLiveData = adminLiveDataState) {
  const userIds = member?.serverUserIds?.length
    ? member.serverUserIds
    : member?.serverUserId
      ? [member.serverUserId]
      : [];
  if (!userIds.length) return null;
  return (allLiveData.payments || [])
    .filter((payment) => (
      userIds.includes(payment.user_id)
      && payment.status === "verified"
      && !payment.ticket_id
      && payment.provider !== "google_sheet_history"
    ))
    .sort((left, right) => String(right.verified_at || right.paid_at || right.created_at || "")
      .localeCompare(String(left.verified_at || left.paid_at || left.created_at || "")))[0] || null;
}

function groupPaymentModeLabel(mode = "representative") {
  if (mode === "alternate") return "결제자 번갈아 지정";
  if (mode === "separate") return "각자 결제";
  return "한 명이 두 사람 함께 결제";
}

function vatExclusiveSettlementAmount(amount) {
  return Math.max(0, Math.round((Number(amount) || 0) * 10 / 11));
}

function settlementBaseAmountForBilling(billing = {}) {
  const explicitBase = Number(billing.settlementBaseAmount) || 0;
  if (explicitBase > 0) return explicitBase;
  const paidAmount = Number(billing.finalAmount || billing.amount) || 0;
  const method = String(billing.method || "").toLowerCase();
  return method.includes("card") ? vatExclusiveSettlementAmount(paidAmount) : paidAmount;
}

function paymentFullCancelAmount(item = {}) {
  return Math.max(0, Number(item.finalAmount || item.amount || 0));
}

function paymentCreatedAtMs(item = {}) {
  const candidates = [item.createdAt, item.created_at, item.requestedAt, item.paidAt, item.verifiedAt];
  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(String(value));
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function paymentAuditDateTimeLabel(value = "") {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refundErrorText(code = "") {
  const labels = {
    login_required: "관리자 로그인이 필요합니다.",
    admin_role_required: "관리자 권한 계정만 환불할 수 있습니다.",
    payment_not_found: "결제 기록을 찾지 못했습니다.",
    payment_not_verified: "서버 검증이 끝난 결제만 환불할 수 있습니다.",
    linked_ticket_not_found: "결제와 연결된 이용권을 찾지 못했습니다.",
    refund_preview_changed: "결제 또는 이용 횟수가 바뀌었습니다. 새 계산값을 확인해 주세요.",
    ticket_usage_changed: "이용 횟수가 바뀌었습니다. 새 계산값을 확인해 주세요.",
    policy_fallback_confirmation_required: "현재 정책 기준 계산 확인이 필요합니다.",
    refund_confirmation_required: "최종 확인란에 환불을 입력해 주세요.",
    refund_reason_required: "환불 사유를 입력해 주세요.",
    refund_in_progress: "같은 결제의 환불이 이미 처리 중입니다.",
    reconcile_required: "PG 취소 결과와 내부 기록을 다시 맞춰야 합니다.",
    provider_amount_mismatch: "PG 결제금액과 서버 결제금액이 달라 환불을 중단했습니다.",
    provider_cancel_failed: "PG 환불 요청에 실패했습니다. 결제 상태를 확인해 주세요.",
    nothing_to_refund: "계산된 환불액이 0원이라 자동 환불할 수 없습니다.",
  };
  return labels[code] || "환불 처리 상태를 확인해 주세요.";
}

function paymentCancelConfirmationPhrase(item = {}) {
  return ["paid", "cancel_reconcile"].includes(item.status) ? "전액취소" : "대기취소";
}

function importPaymentStatus(value = "") {
  const normalized = String(value).replace(/\s+/g, "").toLowerCase();
  if (["결제완료", "완료", "paid", "verified"].includes(normalized)) return "paid";
  if (["결제대기", "미결제", "pending", "pending_payment"].includes(normalized)) return "pending";
  if (["해당없음", "없음", "not_applicable", "none"].includes(normalized)) return "not_applicable";
  return "";
}
