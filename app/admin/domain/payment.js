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
  const bankState = String(row.bank_transfer_state || row.bankTransferState || "").toLowerCase();
  const refundStatus = String(row.refund_status || "").toLowerCase();
  const refundMode = String(row.refund_breakdown?.mode || "").toLowerCase();
  if (refundStatus === "processing" && refundMode === "manual_bank_transfer_pending") {
    return { status: "refund_manual_pending", statusLabel: "환불송금대기" };
  }
  if (refundStatus === "processing") return { status: "refund_processing", statusLabel: "환불처리중" };
  if (refundStatus === "reconcile_required" && refundMode === "full_pg_cancel") return { status: "cancel_reconcile", statusLabel: "취소동기화필요" };
  if (refundStatus === "reconcile_required") return { status: "refund_reconcile", statusLabel: "환불동기화필요" };
  if (refundStatus === "failed" && status === "verified") return { status: "paid", statusLabel: "환불재확인" };
  if (bankState === "confirming") return { status: "unverified", statusLabel: "입금처리중" };
  if (bankState === "confirmation_failed") return { status: "paid", statusLabel: "회원권처리실패" };
  if (bankState === "confirmed") return { status: "paid", statusLabel: "입금확인완료" };
  if (bankState === "expired") return { status: "failed", statusLabel: "입금기한만료" };
  if (bankState === "cancelled") return { status: "cancelled", statusLabel: "입금신청취소" };
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
    purchaseIntentKey: row.purchase_intent_key || row.purchaseIntentKey || "",
    purchaseGroupKey: row.purchase_group_key || row.purchaseGroupKey || "",
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
    provider: row.provider || "",
    status,
    statusLabel,
    providerPaymentId,
    serverPaymentId: row.id || "",
    branchId: row.branch_id || row.branchId || "",
    productId: row.product_id || row.productId || "",
    ticketId: row.ticket_id || row.ticketId || "",
    oneDayBookingId: row.one_day_booking_id || row.oneDayBookingId || "",
    revenueMonth: row.revenue_month || row.revenueMonth || "",
    revenueMonthSource: row.revenue_month_source || row.revenueMonthSource || "",
    revenueAttributionStatus: row.revenue_attribution_status || row.revenueAttributionStatus || "included",
    revenueExclusionReason: row.revenue_exclusion_reason || row.revenueExclusionReason || "",
    serverStatus: row.status || "",
    requestedAt: row.created_at || row.createdAt || "",
    paidAt: row.paid_at || row.paidAt || "",
    verifiedAt: row.verified_at || row.verifiedAt || "",
    depositDueAt: row.deposit_due_at || row.depositDueAt || "",
    depositorName: row.depositor_name_snapshot || row.depositorName || "",
    bankAccountSnapshot: row.bank_account_snapshot || row.bankAccountSnapshot || {},
    bankTransferState: row.bank_transfer_state || row.bankTransferState || "",
    bankTransferErrorCode: row.bank_transfer_error_code || row.bankTransferErrorCode || "",
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

function settlementAdjustedPaymentForBilling(billing = {}) {
  const adjustment = window.TennisNoteSettlementAdjustment;
  const source = {
    ...billing,
    settlementBaseAmount: settlementBaseAmountForBilling(billing),
  };
  if (adjustment?.paymentAmounts) return adjustment.paymentAmounts(source);
  const grossAmount = Math.max(0, Number(billing.finalAmount || billing.amount) || 0);
  return {
    grossAmount,
    refundedAmount: 0,
    netAmount: grossAmount,
    originalSettlementBase: settlementBaseAmountForBilling(billing),
    settlementBase: settlementBaseAmountForBilling(billing),
    refundAdjusted: false,
  };
}

function billingIncludedInCoachSettlement(billing = {}) {
  const adjustment = window.TennisNoteSettlementAdjustment;
  if (adjustment?.isIncluded) return adjustment.isIncluded(billing);
  return billing.status === "paid";
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
    manual_refund_request_failed: "현금 환불 접수를 저장하지 못했습니다. 결제 상태를 다시 확인해 주세요.",
    manual_refund_cancel_confirmation_required: "환불 접수를 취소하려면 최종 확인란에 접수취소를 입력해 주세요.",
    manual_transfer_confirmation_required: "실제 송금 후 최종 확인란에 송금완료를 입력해 주세요.",
    manual_transfer_reference_required: "은행명·끝 4자리 또는 이체확인번호를 입력해 주세요.",
    manual_transfer_reference_contains_account_number: "전체 계좌번호는 저장할 수 없습니다. 끝 4자리만 입력해 주세요.",
    manual_refund_not_awaiting_transfer: "송금 대기 중인 현금 환불이 아닙니다. 결제 상태를 새로고침해 주세요.",
    manual_refund_bank_transfer_only: "현금·계좌이체 결제만 수동 송금 완료 처리할 수 있습니다.",
    reconcile_required: "PG 취소 결과와 내부 기록을 다시 맞춰야 합니다.",
    provider_amount_mismatch: "PG 결제금액과 서버 결제금액이 달라 환불을 중단했습니다.",
    provider_cancel_failed: "PG 환불 요청에 실패했습니다. 결제 상태를 확인해 주세요.",
    bank_transfer_use_refund_flow: "계좌이체는 PG 취소가 아니라 환불 계산에서 처리해 주세요.",
    bank_transfer_deposit_late_confirmation_required: "입금기한이 지났습니다. 취소 대신 실제 입금 여부를 확인해 주세요.",
    payment_already_processed: "이미 입금 확인 또는 취소 처리가 시작된 결제입니다. 최신 상태를 다시 확인해 주세요.",
    pending_payment_cancel_failed: "입금 대기 취소 상태를 저장하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.",
    linked_one_day_booking_not_found: "결제와 연결된 원데이 예약을 찾지 못했습니다.",
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

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function isPaymentGatewayReady() {
  const config = paymentGatewayConfig();
  return Boolean(config.storeId && config.channelKey);
}

function replaceServerPaymentRows(rows = []) {
  const mapped = rows.map((row) => billingRowFromServerPayment(row));
  const serverIds = new Set(mapped.map((item) => item.serverPaymentId).filter(Boolean));
  const providerIds = new Set(mapped.map((item) => item.providerPaymentId).filter(Boolean));
  const previousServerRows = billings.filter((item) => item.serverPaymentId);
  const previousKeys = new Set(previousServerRows
    .flatMap((item) => [item.serverPaymentId, item.providerPaymentId])
    .filter(Boolean));
  const preservedLocalRows = billings.filter((item) => (
    !item.serverPaymentId
    && (!item.providerPaymentId || !providerIds.has(item.providerPaymentId))
  ));
  replaceArray(billings, [...mapped, ...preservedLocalRows]);
  return {
    added: mapped.filter((item) => !previousKeys.has(item.serverPaymentId) && !previousKeys.has(item.providerPaymentId)).length,
    updated: mapped.filter((item) => previousKeys.has(item.serverPaymentId) || previousKeys.has(item.providerPaymentId)).length,
    removed: previousServerRows.filter((item) => (
      !serverIds.has(item.serverPaymentId) && !providerIds.has(item.providerPaymentId)
    )).length,
  };
}

function reflectRefundPolicyInActiveVersion() {
  const policy = activePolicyVersion();
  if (!policy) return;
  let section = policy.sections.find((item) => item.id === "refund");
  if (!section) {
    section = { id: "refund", title: "환불", rules: [] };
    policy.sections.push(section);
  }
  const settings = normalizeRefundPolicySettings(refundPolicySettings);
  section.rules = [
    `회원 사유 환불은 실납부액에서 할인 전 원가의 ${settings.penaltyRate}% 위약금을 차감`,
    "사용한 수업은 할인 전 회차 금액으로 차감",
    settings.reservationFee > 0 ? `첫 수업을 진행한 달에는 예약금 ${money.format(settings.reservationFee)}원을 추가 차감` : "별도 예약금 차감 없음",
    "분쟁이 생긴 경우에만 관리자가 소비자분쟁해결기준 검토 절차를 별도로 진행",
  ];
}

function memberPaymentRecordState(record = null) {
  const explicitState = String(record?.payment_record_state || "").trim();
  if (memberPaymentRecordStates.has(explicitState)) return explicitState;
  const amount = Number(record?.payment_amount) || 0;
  const date = String(record?.payment_recorded_on || "").trim();
  const method = String(record?.payment_method || "").trim();
  if (amount === 0 && method === "membership_transfer") return "transfer_zero";
  if (amount > 0 && date && method) return "complete";
  if (amount > 0 || date || method) return "incomplete";
  return "unentered";
}

function memberPaymentRecordStateLabel(state = "") {
  return ({
    unentered: "미입력",
    complete: "결제 완료",
    transfer_zero: "양도 · 0원",
    incomplete: "확인 필요",
  })[state] || "미입력";
}

function memberPaymentRecordMatchesPayload(record = null, payload = null) {
  if (!record || !payload) return false;
  return memberPaymentRecordState(record) === String(payload.paymentRecordState || "unentered")
    && String(record.payment_recorded_on || "") === String(payload.paymentDate || "")
    && normalizeMemberPaymentMethod(record.payment_method) === normalizeMemberPaymentMethod(payload.paymentMethod)
    && Number(record.payment_amount || 0) === Number(payload.paymentAmount || 0);
}

function isStaleReadyPayment(item = {}) {
  if (item.status !== "server_ready") return false;
  const createdAt = paymentCreatedAtMs(item);
  return Boolean(createdAt && Date.now() - createdAt > staleReadyPaymentMs);
}

function chargeStatusForPayment(item = {}) {
  if (item.status === "refund_manual_pending") return { label: "환불 송금 대기", tone: "warn", detail: "현금 환불이 접수됐습니다. 실제 송금 확인 전까지 이용권 사용과 원데이 예약이 잠시 정지됩니다." };
  if (item.status === "refund_processing") return { label: "환불 처리중", tone: "warn", detail: "PortOne 취소와 내부 회원권 반영이 진행 중입니다." };
  if (item.status === "refund_reconcile") return { label: "동기화 필요", tone: "danger", detail: "PG 취소 결과와 내부 결제·회원권 상태를 다시 맞춰야 합니다." };
  if (item.status === "paid" && item.oneDayBookingId) return { label: "원데이 예약완료", tone: "good", detail: "결제 확인 후 선택한 코치와 시간으로 한 번만 예약됐습니다." };
  if (item.status === "paid" && item.ticketId) return { label: "회원권 충전완료", tone: "good", detail: "결제검증 후 연결 회원권이 활성화됩니다." };
  if (item.status === "paid" && isHistoricalImportedPayment(item)) return { label: "이관 결제 기록", tone: "neutral", detail: "기존 장부에서 보존한 결제 증빙이며 현재 회원권 자동 연결 대상이 아닙니다." };
  if (item.status === "paid") return { label: "회원권 연결 확인", tone: "warn", detail: "결제는 확인됐지만 연결된 회원권 ID가 없습니다." };
  if (isStaleReadyPayment(item)) return { label: "오래된 결제 대기", tone: "warn", detail: "결제창 생성 후 1시간 이상 완료 확인이 없습니다. PortOne 상태 확인 전에는 취소하거나 회원권을 변경하지 않습니다." };
  if (item.status === "server_ready") return String(item.method || "").toLowerCase() === "bank_transfer"
    ? { label: "입금 확인 대기", tone: "neutral", detail: "회원의 계좌이체 신청입니다. 실제 입금 확인 후에만 회원권이 생성됩니다." }
    : { label: "결제 전 대기", tone: "neutral", detail: "회원이 토스페이를 완료하면 서버검증 후 자동 충전됩니다." };
  if (item.status === "unverified") return { label: "서버검증 대기", tone: "warn", detail: "결제창 완료 후 서버 검증이 필요합니다." };
  if (item.status === "cancelled") return { label: "취소/환불완료", tone: "neutral", detail: "결제가 취소됐고 연결 회원권은 충전되지 않거나 환불 처리됩니다." };
  if (item.status === "refunded") return { label: "환불완료", tone: "neutral", detail: "환불 완료 항목은 현재 이용권으로 보지 않습니다." };
  if (item.status === "failed") return { label: "충전 중단", tone: "danger", detail: "결제 실패 항목은 회원권을 충전하지 않습니다." };
  return { label: "확인 필요", tone: "warn", detail: "관리자 확인 후 회원권 상태를 맞춰야 합니다." };
}

function memberManagementPaymentStateFromValues({ paymentDate = "", paymentMethod = "", paymentAmount = 0 } = {}) {
  const date = String(paymentDate || "").trim();
  const method = normalizeMemberPaymentMethod(paymentMethod);
  const amount = Number(paymentAmount) || 0;
  if (amount === 0 && method === "membershiptransfer") return "transfer_zero";
  if (amount > 0 && date && method) return "complete";
  if (amount > 0 || date || method) return "incomplete";
  return "unentered";
}

function memberManagementPaymentAmountForMethod(product = null, method = "") {
  const normalized = normalizeMemberPaymentMethod(method);
  if (normalized === "card" || normalized === "tosspay") return Math.max(0, Number(product?.card_price) || 0);
  if (["banktransfer", "cash"].includes(normalized)) return Math.max(0, Number(product?.cash_price) || Number(product?.base_price) || 0);
  return 0;
}

function memberPaymentProjectionRow(member = null, ticket = null) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  const userIds = memberServerUserIds(member).map(String);
  if (!ticketId || !userIds.length) return null;
  return (adminLiveDataState.memberPaymentProjections || [])
    .filter((projection) => (
      String(projection.ticket_id || projection.ticketId || "") === ticketId
      && userIds.includes(String(projection.user_id || projection.userId || ""))
    ))
    .sort((left, right) => String(right.projection_updated_at || "")
      .localeCompare(String(left.projection_updated_at || "")))[0] || null;
}

function billingOperationalMonthMatches(item, month) {
  if (!month) return true;
  return billingEffectiveDate(item).slice(0, 7) === month;
}

function billingAttemptGroupKey(item = {}) {
  const groupable = ["draft", "check", "unverified", "failed", "server_ready"].includes(String(item.status || ""));
  if (!groupable) return item.serverPaymentId || item.providerPaymentId
    ? `payment:${item.serverPaymentId || item.providerPaymentId}`
    : item;
  if (item.purchaseIntentKey) return `intent:${item.purchaseIntentKey}`;
  const requestedDay = String(item.requestedAt || item.createdAt || "").slice(0, 10) || billingEffectiveDate(item);
  return [
    "legacy-attempt",
    item.serverUserId || item.member || "member",
    item.productId || item.item || "product",
    String(item.method || "").toLowerCase(),
    Number(item.finalAmount || item.amount || 0),
    requestedDay,
  ].join("|");
}

function groupedBillingAttempts(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const key = billingAttemptGroupKey(item);
    const attempts = groups.get(key) || [];
    attempts.push(item);
    groups.set(key, attempts);
  });
  return [...groups.values()]
    .map((attempts) => {
      attempts.sort((left, right) => paymentCreatedAtMs(right) - paymentCreatedAtMs(left));
      return { primary: attempts[0], attempts, attemptCount: attempts.length };
    })
    .sort((left, right) => paymentCreatedAtMs(right.primary) - paymentCreatedAtMs(left.primary));
}

function billingAttemptSummary(entry = {}) {
  const count = Number(entry.attemptCount || 0);
  const latest = entry.primary || {};
  const latestDisplay = paymentDisplayStatus(latest);
  const latestSummary = `최근 ${paymentMethodLabel(latest.method)} · ${latestDisplay.label || latest.statusLabel || "상태 확인"}`;
  return count > 1 ? `${latestSummary} · 동일 요청 ${count}회` : latestSummary;
}

function paymentApprovalDisplay(item = {}) {
  const method = String(item.method || "").toLowerCase();
  const depositDueAt = Date.parse(String(item.depositDueAt || ""));
  const bankDepositExpired = method === "bank_transfer" && Number.isFinite(depositDueAt) && Date.now() > depositDueAt;
  if (item.approvalPending) return { tone: "neutral", label: "승인 처리중", detail: "서버에서 결제와 회원권을 다시 확인하고 있습니다." };
  if (item.bankTransferState === "confirming") return { tone: "warn", label: "입금 처리중", detail: "서버에서 입금과 회원권을 한 번만 처리하고 있습니다. 잠시 후 새로고침해 주세요." };
  if (item.bankTransferState === "confirmation_failed") return { tone: "danger", label: "회원권 처리 실패", detail: "입금은 확인됐지만 회원권 처리가 끝나지 않았습니다. 같은 결제에서 다시 처리해 주세요." };
  if (item.status === "paid" && paymentRequiresTicketRepair(item)) {
    return { tone: "danger", label: "회원권 처리 실패", detail: "결제는 확인됐지만 회원권 처리가 끝나지 않았습니다. 다시 처리해 주세요." };
  }
  if (item.status === "paid") {
    return { tone: "good", label: "승인 완료", detail: item.oneDayBookingId ? "원데이 예약 연결됨" : item.ticketId ? "회원권 연결됨" : "이관 결제 보존" };
  }
  if (item.status === "server_ready" && bankDepositExpired) {
    return { tone: "danger", label: "입금기한 지남", detail: "입금 여부를 직접 확인하세요. 확인 전에는 회원권을 만들지 않습니다." };
  }
  if (item.status === "server_ready" && method === "bank_transfer") {
    return { tone: "warn", label: "입금 확인 필요", detail: "실제 입금액을 확인한 뒤 한 번만 승인하세요." };
  }
  if (["check", "unverified"].includes(item.status)) {
    return { tone: "warn", label: "결제 확인 필요", detail: "결제사 상태를 확인하면 회원권까지 함께 연결됩니다." };
  }
  if (item.status === "server_ready") return { tone: "neutral", label: "결제 대기", detail: "회원 결제가 완료됐는지 확인합니다." };
  if (["cancelled", "refunded"].includes(item.status)) return { tone: "neutral", label: "취소·환불", detail: "현재 회원권 승인 대상이 아닙니다." };
  if (item.status === "failed") return { tone: "danger", label: "결제 실패", detail: "회원권을 생성하거나 연결하지 않습니다." };
  return { tone: "neutral", label: "확인 대기", detail: "결제 상태를 먼저 확인해 주세요." };
}

function paymentTicketFinalizeRecoveryCode(value = "") {
  const code = String(value || "").toLowerCase();
  if (code.includes("payment_purchase_context_missing")) return "payment_purchase_context_missing";
  if (code.includes("renewal_source") || code.includes("source_ticket_not_found") || code.includes("exact_source")) return "renewal_source_ticket_missing";
  if (code.includes("product_mismatch") || code.includes("active_product_required") || code.includes("renewal_product")) return "payment_product_mismatch";
  if (code.includes("ticket_already_linked") || code.includes("ticket_conflict") || code.includes("payment_already_linked")) return "payment_ticket_link_conflict";
  if (code.includes("lesson_minutes") || code.includes("42703")) return "ticket_projection_contract_error";
  if (code.includes("login") || code.includes("admin_role_required") || code.includes("permission")) return "admin_session_or_permission_required";
  if (code.includes("timeout") || code.includes("network") || code.includes("fetch")) return "payment_reconcile_network_error";
  return "verified_payment_ticket_finalize_unknown";
}

function paymentTicketFinalizeRecoveryMessage(value = "") {
  const code = paymentTicketFinalizeRecoveryCode(value);
  if (code === "payment_purchase_context_missing") return "결제 준비 정보가 없어 자동 처리할 수 없습니다. 회원권 연결 대상을 확인해 주세요.";
  if (code === "renewal_source_ticket_missing") return "연장할 기존 회원권을 찾지 못했습니다. 회원과 기존 회원권을 확인해 주세요.";
  if (code === "payment_product_mismatch") return "결제 상품과 회원권 상품이 일치하지 않습니다. 상품을 확인해 주세요.";
  if (code === "payment_ticket_link_conflict") return "다른 결제 또는 회원권 연결과 충돌했습니다. 이력에서 기존 연결을 확인해 주세요.";
  if (code === "ticket_projection_contract_error") return "회원권 처리 규칙을 서버에서 다시 확인해야 합니다. 같은 오류가 계속되면 오류접수를 남겨 주세요.";
  if (code === "admin_session_or_permission_required") return "관리자 로그인이 만료됐거나 권한이 없습니다. 다시 로그인해 주세요.";
  if (code === "payment_reconcile_network_error") return "서버 응답을 확인하지 못했습니다. 같은 결제에서 다시 처리해 주세요.";
  return "회원권 처리를 완료하지 못했습니다. 결제는 유지되며 같은 항목에서 다시 시도할 수 있습니다.";
}

function bankTransferConfirmationMessage(value = "") {
  const code = String(value || "").toLowerCase();
  if (code.includes("bank_transfer_confirmation_in_progress")) return "다른 화면에서 입금과 회원권을 처리 중입니다. 잠시 후 새로고침해 주세요.";
  if (code.includes("bank_transfer_amount_mismatch")) return "신청 금액과 확인 금액이 다릅니다. 실제 입금액을 다시 확인해 주세요.";
  if (code.includes("bank_transfer_deposit_late_confirmation_required")) return "입금기한이 지났습니다. 실제 입금을 직접 확인한 뒤 다시 승인해 주세요.";
  if (code.includes("bank_transfer_source_event_conflict")) return "입금 알림과 결제 신청이 일치하지 않습니다. 관리자 확인 항목에서 비교해 주세요.";
  if (code.includes("payment_id_terminal") || code.includes("payment_already_processed")) return "이미 취소되었거나 처리된 결제입니다. 최신 상태를 다시 확인해 주세요.";
  return "입금 승인 상태를 확인하지 못했습니다. 회원권은 추가되지 않았으며 같은 결제에서 다시 확인할 수 있습니다.";
}

function settlementRuleSummary(rule = {}) {
  if (rule.method === "hourly") return `시간제 ${money.format(Number(rule.hourly) || 0)}원/시간`;
  const rate = Math.round((Number(rule.ratio) || 0) * 10000) / 100;
  return rule.calculationMode === "monthly_payment"
    ? `월 결제금액 × ${rate}%`
    : `진행 횟수 × ${rate}%`;
}
