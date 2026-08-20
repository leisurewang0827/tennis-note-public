// 결제 준비·검증과 결제 관련 서버 조회 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function setMemberGroupPaymentMode(mode) {
  const account = state.groupAccount;
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (mode !== "representative" && linkedMembers.length < 2) return;
  let nextPayer = linkedMembers.find((member) => member.name === account.nextPayer) || linkedMembers[0];
  if (mode === "alternate") {
    const currentIndex = linkedMembers.findIndex((member) => member.name === account.nextPayer);
    nextPayer = linkedMembers[(currentIndex + 1) % linkedMembers.length] || nextPayer;
  }
  const client = window.TennisNoteDataClient;
  if (!account.demoOnly && client?.rpc) {
    try {
      await client.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: mode,
        target_next_payer_user_id: mode === "separate" ? null : nextPayer?.userId || null,
      });
    } catch {
      state.ticketHistory.unshift({ text: "2대1 결제방식 변경 실패 · 관리자 확인 필요", tone: "alert" });
      renderGroupAccountPanel();
      return;
    }
  }
  account.paymentMode = mode;
  account.nextPayer = nextPayer?.name || account.nextPayer;
  account.nextPayerUserId = nextPayer?.userId || account.nextPayerUserId;
  state.ticketHistory.unshift({ text: `2대1 결제방식 변경 · ${memberGroupPaymentModeLabel(mode)}`, tone: "done" });
  saveSnapshot();
  renderGroupAccountPanel();
}

async function syncMemberPaymentOptionsFromServer(targetBranchId = "") {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) return false;
  const branchId = targetBranchId || currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId || null;
  try {
    const options = await client.invokeFunction("portone-payment/options", { body: { branchId } });
    state.livePaymentOptions = {
      allowedMethods: paymentMethodIdList(options?.allowedMethods || ["tosspay"]),
      bankTransferEnabled: options?.bankTransferEnabled === true,
      paymentMethods: Array.isArray(options?.paymentMethods) ? options.paymentMethods : [],
      settingsVersion: Math.max(0, Number(options?.settingsVersion) || 0),
      features: { threeMonth: true, oneDay: true, coupons: true, ...(options?.features || {}) },
    };
    normalizeSelectedPaymentMethod();
    return true;
  } catch {
    state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, features: { threeMonth: true, oneDay: true, coupons: true } };
    normalizeSelectedPaymentMethod();
    return false;
  }
}

async function syncMemberDiscountCouponsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) return false;
  const branchId = currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId || state.liveMembershipProducts?.[0]?.branchId || null;
  try {
    const response = await client.invokeFunction("portone-payment/coupon-wallet", { body: { branchId } });
    state.discountCoupons = Array.isArray(response?.coupons) ? response.coupons : [];
    renderDiscountCouponWallet();
    return true;
  } catch {
    state.discountCoupons = [];
    renderDiscountCouponWallet();
    return false;
  }
}

async function syncMembershipPricingQuotesFromServer(products = state.liveMembershipProducts) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    state.membershipPricingQuotes = {};
    return false;
  }
  const targets = (products || []).filter((product) => (
    isOneDayMembershipProduct(product) && product.firstLessonOfferEnabled === true
  ));
  const entries = await Promise.all(targets.map(async (product) => {
    try {
      const quote = await client.invokeFunction("portone-payment/quote", {
        body: {
          branchId: product.branchId || null,
          productId: product.id,
          productKey: product.productCode || product.id,
        },
      });
      return [String(product.id), quote?.ok ? quote : null];
    } catch {
      return [String(product.id), null];
    }
  }));
  state.membershipPricingQuotes = Object.fromEntries(entries.filter(([, quote]) => quote));
  return true;
}

async function prepareServerPayment(product, paymentId, methodId = state.selectedPaymentMethod) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const enforcedMethodId = paymentMethodIdForRequest(methodId);
  if (!isPaymentGatewayReady(enforcedMethodId)) throw new Error("payment_channel_not_ready");
  const purchaseFlow = purchaseFlowState();
  return client.invokeFunction("portone-payment/prepare", {
    body: {
      paymentId,
      branchId: product.branchId || null,
      productKey: product.id,
      productTitle: product.title,
      amount: paymentAmount,
      originalAmount: product.cardAmount || product.listAmount || paymentAmount,
      cashPrice: product.cashAmount || product.settlementBase || paymentAmount,
      settlementBaseAmount: product.settlementBase || product.cashAmount || paymentAmount,
      finalAmount: paymentAmount,
      priceType: enforcedMethodId === "bank_transfer" ? "cash" : "card",
      totalSessions: product.tickets || 1,
      lessonMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      machineMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      productKind: product.productKind === "pass" || product.mode === "coupon" || product.mode === "pass" ? "coupon" : product.mode === "add" ? "add" : product.mode === "renewal" ? "renewal" : "regular",
      groupSize: Number(product.groupSize) || (product.title.includes("2대1") || product.detail.includes("2대1") || product.detail.includes("2:1") ? 2 : 1),
      validityDays: Number(product.validityDays) || 35,
      graceDays: Number(product.graceDays) || 0,
      method: enforcedMethodId,
      groupAccountId: Number(product.groupSize) === 2 ? state.groupAccount?.id || null : null,
      coachRoleId: purchaseFlow.productId === product.id ? purchaseFlow.coachRoleId || null : null,
      preferredDate: purchaseFlow.productId === product.id ? purchaseFlow.preferredDate || null : null,
      preferredDay: purchaseFlow.productId === product.id ? purchaseFlow.preferredDay || null : null,
      preferredTime: purchaseFlow.productId === product.id ? purchaseFlow.preferredTime || null : null,
      preferredSchedules: purchaseFlow.productId === product.id
        ? purchaseSelectedSchedules(product).map((schedule) => ({
          lessonDate: schedule.lessonDate,
          day: schedule.day,
          startTime: schedule.startTime,
          durationMinutes: schedule.durationMinutes,
          coachRoleId: schedule.coachRoleId,
        }))
        : [],
      scheduleMode: purchaseFlow.productId === product.id ? purchaseFlow.scheduleMode || "change" : "change",
      renewalSourceTicketId: purchaseFlow.productId === product.id ? purchaseFlow.renewalTicketId || null : null,
      purchasePurpose: purchaseFlow.productId === product.id ? purchaseFlow.purchasePurpose || "new_purchase" : "new_purchase",
      discountIssueId: purchaseFlow.productId === product.id ? purchaseFlow.discountIssueId || null : null,
    },
  });
}

async function verifyServerPayment(paymentId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  return client.invokeFunction("portone-payment/verify", {
    body: { paymentId },
  });
}

async function reconcileRejectedServerPayment(paymentId) {
  if (!paymentId) return;
  try {
    await verifyServerPayment(paymentId);
  } catch {
    // Terminal provider states are persisted before the server returns a verification error.
  }
}
