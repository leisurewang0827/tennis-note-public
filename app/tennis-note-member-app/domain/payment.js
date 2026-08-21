// 결제 수단·상태·오류 문구를 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function paymentRequestDisplay(request = {}) {
  const text = `${request.method || ""} ${request.status || ""}`;
  if (text.includes("설정")) {
    return {
      period: "결제창 연결 전 요청",
      status: "설정 필요",
      note: "관리자 결제 설정 후 실제 결제창을 다시 연결합니다.",
      tone: "alert",
    };
  }
  if (text.includes("실패") || text.includes("오류")) {
    return {
      period: "결제 재확인 필요",
      status: "확인 필요",
      note: request.status || "결제가 끝나지 않아 관리자 확인이 필요합니다.",
      tone: "alert",
    };
  }
  if (text.includes("서버 검증") || text.includes("PortOne 결제창")) {
    return {
      period: "결제 완료 접수 · 이용권 충전 대기",
      status: "검증 대기",
      note: "관리자 화면에 접수됐고, 서버 검증 후 이용권이 충전됩니다.",
      tone: "wait",
    };
  }
  if (text.includes("상담")) {
    return {
      period: "상담 후 이용권 확정",
      status: "상담 대기",
      note: request.status || "관리자가 시간과 코치를 확인합니다.",
      tone: "wait",
    };
  }
  return {
    period: "관리자 확인 후 이용권 시작",
    status: "확인 대기",
    note: request.status || "결제 확인 후 이용권이 충전됩니다.",
    tone: "wait",
  };
}

function preloadPortOneSdk() {
  if (!isPaymentGatewayReady(normalizeSelectedPaymentMethod())) return;
  loadPortOneSdk().catch(() => {});
}

function paymentMethodIdList(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => paymentMethodDefinitions.some((method) => method.id === item)))];
}

function discountCouponStatus(coupon = {}) {
  const status = String(coupon.status || "issued").toLowerCase();
  if (status === "issued") return { label: "사용 가능", tone: "done" };
  if (status === "reserved") return { label: "결제 진행 중", tone: "wait" };
  if (status === "used") return { label: "사용 완료", tone: "muted" };
  if (status === "expired") return { label: "기간 만료", tone: "muted" };
  return { label: "사용 불가", tone: "muted" };
}

function discountCouponValueLabel(coupon = {}) {
  return coupon.discountType === "amount"
    ? `${Number(coupon.discountValue || 0).toLocaleString("ko-KR")}원 할인`
    : `${Number(coupon.discountValue || 0)}% 할인`;
}

function allowedPaymentMethodIds(config = paymentGatewayConfig()) {
  if (config.mode !== "multi") {
    return config.bankTransfer?.enabled ? [...defaultAllowedPaymentMethods, "bank_transfer"] : [...defaultAllowedPaymentMethods];
  }
  const configured = paymentMethodIdList(config.allowedMethods);
  return configured.length ? configured : [...defaultAllowedPaymentMethods];
}

function isPaymentMethodAllowed(methodId, config = paymentGatewayConfig()) {
  return allowedPaymentMethodIds(config).includes(String(methodId || "").toLowerCase());
}

function paymentMethodIdForRequest(methodId = state.selectedPaymentMethod, config = paymentGatewayConfig()) {
  if (config.mode !== "multi") {
    return methodId === "bank_transfer" && config.bankTransfer?.enabled ? "bank_transfer" : "tosspay";
  }
  const allowedMethods = allowedPaymentMethodIds(config);
  return allowedMethods.includes(methodId) ? methodId : allowedMethods[0] || "tosspay";
}

function isPaymentGatewayReady(methodId = state.selectedPaymentMethod, config = paymentGatewayConfig()) {
  if (!isPaymentMethodAllowed(methodId, config)) return false;
  if (methodId === "bank_transfer") return config.bankTransfer?.enabled === true;
  const channelReady = Boolean(config.storeId && config.channels?.[methodId]);
  if (methodId !== "naverpay") return channelReady;
  return channelReady && Boolean(config.naverPayCategoryType && config.naverPayCategoryId);
}

function createProviderPaymentId(productId = "") {
  const timestamp = Date.now().toString(36);
  const productToken = String(productId || "product").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "product";
  const randomToken = String(globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
  return `tn_${timestamp}_${productToken}_${randomToken}`.slice(0, 50);
}

function paymentServerErrorMessage(error) {
  const code = error?.payload?.code || error?.message || "server_error";
  const labels = {
    group_next_payer_required: "이번 결제 담당 회원의 로그인이 필요합니다.",
    group_partner_required: "2대1 동반 회원 정보를 확인해주세요.",
    group_enrollment_required: "2대1 수강 가입서를 먼저 작성해주세요.",
    group_partner_duplicate_phone_review: "동반 회원 연락처를 관리자가 확인해야 합니다.",
    group_payment_not_allowed: "이 계정은 공동 회원권 결제 권한이 없습니다.",
    group_account_not_available: "선택한 2대1 공동 회원권을 확인할 수 없습니다. 회원권을 다시 선택해 주세요.",
    membership_enrollment_required: "수강 가입서를 먼저 확인해 주세요.",
    first_lesson_offer_not_available: "신규 첫 수업 혜택 대상이 아닙니다. 현재 정상가를 다시 확인해 주세요.",
    first_lesson_offer_reserved: "이전에 준비한 첫 수업 결제를 다시 열어 주세요.",
    product_price_mismatch: "상품 가격이 변경되었습니다. 회원권 화면을 새로고침한 뒤 다시 확인해 주세요.",
    payment_not_found: "결제 기록을 찾지 못했습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
    payment_not_owned: "본인의 결제 대기건만 취소할 수 있습니다.",
    payment_already_processed: "이미 결제 처리된 건은 회원이 직접 취소할 수 없습니다. 관리자에게 문의해 주세요.",
    provider_status_check_failed: "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    pending_payment_cancel_failed: "결제 대기건을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    bank_transfer_account_not_ready: "센터의 입금 계좌가 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.",
    bank_transfer_account_lookup_failed: "입금 계좌를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    discount_coupon_not_available: "이 쿠폰은 이미 사용되었거나 사용할 수 없습니다.",
    discount_coupon_expired: "쿠폰 사용기간이 만료되었습니다.",
    discount_coupon_branch_mismatch: "선택한 지점에서 사용할 수 없는 쿠폰입니다.",
    discount_coupon_product_mismatch: "선택한 상품에는 사용할 수 없는 쿠폰입니다.",
    discount_coupon_payment_method_mismatch: "선택한 결제 방법에는 이 쿠폰을 사용할 수 없습니다.",
    discount_coupon_not_stackable_with_first_lesson: "신규 첫 수업 혜택과 할인 쿠폰은 함께 사용할 수 없습니다.",
    discount_coupon_already_reserved: "다른 결제에서 사용 중인 쿠폰입니다. 쿠폰함을 새로고침해 주세요.",
    discount_coupon_zero_amount_not_supported: "전액 할인 쿠폰은 관리자 확인 결제가 필요합니다.",
    purchase_schedule_count_mismatch: "상품의 주당 횟수만큼 수업 시간을 선택해 주세요.",
    purchase_schedule_single_coach_required: "한 회원권은 같은 선생님의 시간으로 선택해 주세요.",
    purchase_schedule_duplicate: "같은 수업 시간이 중복 선택되었습니다.",
    purchase_schedule_weekly_duplicate: "같은 요일과 시간은 한 번만 선택할 수 있습니다.",
    purchase_schedule_same_week_required: "주 1·2·3회 수업은 같은 주 안에서 선택해 주세요.",
    purchase_weekend_30m_not_available: "30분 수업은 평일 시간표에서 선택해 주세요.",
    purchase_slot_anchor_required: "선택한 선생님의 기존 수업과 가까운 시간만 신청할 수 있습니다.",
    purchase_slot_outside_anchor_window: "기존 수업 전후 40분 안의 시간을 선택해 주세요.",
  };
  return labels[code] || code;
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function pushPaymentRequestToShared(request) {
  const shared = loadSharedData();
  const paymentId = request.paymentId || `local_${Date.now()}_${request.productId}`;
  const nextRequest = {
    ...request,
    paymentId,
    member: state.profile.name,
    phone: state.profile.phone,
    requestedAt: new Date().toISOString(),
    source: "member-app",
  };
  shared.paymentRequests = [
    nextRequest,
    ...(shared.paymentRequests || []).filter((item) => item.paymentId !== paymentId),
  ].slice(0, 30);
  saveSharedData(shared);
}

async function refreshBankNotificationBridge() {
  if (!bankNotificationAdminAllowed()) {
    bankNotificationBridgeState = null;
    renderBankNotificationBridge();
    return false;
  }
  const plugin = nativeBankNotificationBridgePlugin();
  if (!plugin?.getStatus) {
    bankNotificationBridgeState = { configured: false, permissionGranted: false, lastError: "plugin_unavailable" };
    renderBankNotificationBridge();
    return false;
  }
  try {
    bankNotificationBridgeState = await plugin.getStatus();
  } catch (error) {
    bankNotificationBridgeState = { configured: false, permissionGranted: false, lastError: error?.message || "status_failed" };
  }
  renderBankNotificationBridge();
  return bankNotificationBridgeState?.configured === true;
}

function memberHasPendingPaymentOnly() {
  const hasPendingTicket = (state.liveTickets || []).some((ticket) =>
    String(ticket?.status || "").toLowerCase() === "pending_payment");
  return state.dataMode === "live"
    && hasPendingTicket
    && !memberHasActiveLiveTicket()
    && memberOpenMakeupEntitlements().length === 0;
}

async function copyBankTransferAccountNumber() {
  if (!bankTransferAccountNumberForCopy) {
    showToast("복사할 계좌번호를 찾지 못했습니다.");
    return;
  }
  try {
    await navigator.clipboard.writeText(bankTransferAccountNumberForCopy);
    showToast("계좌번호를 복사했습니다.");
  } catch {
    showToast("계좌번호를 길게 눌러 복사해 주세요.");
  }
}

function normalizeSelectedPaymentMethod() {
  const config = paymentGatewayConfig();
  const enforcedMethodId = paymentMethodIdForRequest(state.selectedPaymentMethod, config);
  if (isPaymentGatewayReady(enforcedMethodId, config)) {
    state.selectedPaymentMethod = enforcedMethodId;
    return state.selectedPaymentMethod;
  }
  const readyMethodId = allowedPaymentMethodIds(config).find((methodId) => isPaymentGatewayReady(methodId, config));
  state.selectedPaymentMethod = readyMethodId || enforcedMethodId || "tosspay";
  return state.selectedPaymentMethod;
}

function selectPaymentMethod(methodId) {
  if (!paymentMethodDefinitions.some((method) => method.id === methodId)
    || !isPaymentMethodAllowed(methodId)
    || !isPaymentGatewayReady(methodId)) return;
  const flow = purchaseFlowState();
  if (state.selectedPaymentMethod !== methodId) {
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
  }
  state.selectedPaymentMethod = methodId;
  clearPurchasePaymentError();
  saveSnapshot();
  if (purchaseFlowState().open) renderMembershipPurchaseFlow();
  else renderProducts();
}

function portOnePaymentRequest({ paymentId, productId, orderName, totalAmount, methodId = state.selectedPaymentMethod }) {
  const config = paymentGatewayConfig();
  const enforcedMethodId = paymentMethodIdForRequest(methodId, config);
  const method = paymentMethodDefinition(enforcedMethodId);
  const channelKey = config.channels?.[method.id] || "";
  if (!isPaymentMethodAllowed(method.id, config) || !config.storeId || !channelKey) {
    throw new Error("payment_channel_not_ready");
  }
  const request = {
    storeId: config.storeId,
    channelKey,
    paymentId,
    orderName,
    totalAmount,
    currency: "CURRENCY_KRW",
    payMethod: method.payMethod,
    locale: "KO_KR",
    customer: {
      fullName: state.profile.name,
      phoneNumber: state.profile.phone,
    },
    redirectUrl: paymentRedirectUrl(),
  };
  if (method.id === "naverpay") {
    request.windowType = { pc: "POPUP", mobile: "REDIRECTION" };
    request.bypass = {
      naverpay: {
        productItems: [{
          categoryType: config.naverPayCategoryType,
          categoryId: config.naverPayCategoryId,
          uid: String(productId || paymentId),
          name: orderName,
          count: 1,
        }],
      },
    };
  }
  if (method.id === "kakaopay") request.windowType = { pc: "IFRAME", mobile: "REDIRECTION" };
  if (nativeAppPlatform() !== "web") request.appScheme = "com.tennisclubhouse.tennisnote://";
  return request;
}

function reconcileVerifiedPaymentRequests() {
  const completedPaymentIds = new Set();
  (state.liveTickets || [])
    .filter((ticket) => String(ticket.status || "").toLowerCase() === "active")
    .forEach((ticket) => {
      [ticket.paymentId, ticket.providerPaymentId, ticket.sourcePaymentId].filter(Boolean).forEach((id) => completedPaymentIds.add(String(id)));
    });
  if (!completedPaymentIds.size) return false;

  const isCompletedRequest = (request = {}) => [request.paymentId, request.serverPaymentId]
    .filter(Boolean)
    .some((id) => completedPaymentIds.has(String(id)));
  const beforeCount = state.paymentRequests.length;
  state.paymentRequests = state.paymentRequests.filter((request) => !isCompletedRequest(request));

  const shared = loadSharedData();
  const sharedRequests = Array.isArray(shared.paymentRequests) ? shared.paymentRequests : [];
  const nextSharedRequests = sharedRequests.filter((request) => !isCompletedRequest(request));
  if (nextSharedRequests.length !== sharedRequests.length) {
    shared.paymentRequests = nextSharedRequests;
    saveSharedData(shared);
  }
  return beforeCount !== state.paymentRequests.length;
}
