// 결제를 요청하고 취소하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function cancelBankTransferRequest() {
  const paymentId = bankTransferPaymentIdForCancel;
  const client = window.TennisNoteDataClient;
  if (!paymentId || !client?.invokeFunction || !client.getSession?.()?.access_token) {
    showToast("취소할 입금 신청을 찾지 못했습니다.");
    return;
  }
  if (!window.confirm("입금 전 신청을 취소할까요? 이미 입금했다면 먼저 관리자에게 문의해 주세요.")) return;
  try {
    await client.invokeFunction("portone-payment/cancel-pending", {
      body: { paymentId, reason: "회원 계좌이체 신청 취소" },
    });
    bankTransferPaymentIdForCancel = "";
    await syncMemberDiscountCouponsFromServer();
    closeAppSheet("bankTransferInstructionsSheet");
    state.pendingPaymentCheckStatus = { tone: "done", text: "계좌이체 신청을 취소했습니다." };
    renderAll();
    showToast("입금 신청을 취소했습니다.");
  } catch (error) {
    showToast(paymentServerErrorMessage(error));
  }
}

function requestProduct(productId) {
  const product = membershipProducts().find((item) => item.id === productId);
  if (!product) return;
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: product.amount ? `${product.amount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: product.amount ? "결제 링크/입금 확인 대기" : "관리자 상담 필요",
    status: product.amount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`,
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: `local_${Date.now()}_${product.id}`,
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
  state.ticketHistory.unshift({ text: `${product.title} 구매 요청 생성 · ${product.coach}`, tone: product.amount ? "wait" : "done" });
  renderAll();
  setView("shopView");
}

function createPaymentRecord(product, overrides = {}) {
  const methodId = overrides.methodId || state.selectedPaymentMethod;
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: paymentAmount ? `${paymentAmount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: overrides.method || (paymentAmount ? "결제 확인 대기" : "관리자 상담 필요"),
    status: overrides.status || (paymentAmount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`),
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: overrides.paymentId || "",
    serverPaymentId: overrides.serverPaymentId || "",
    bankTransferAccount: overrides.bankTransferAccount || null,
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
}

async function handlePaymentRedirectResult() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("paymentId") || "";
  if (!paymentId) return false;
  const errorCode = params.get("code") || "";
  const message = params.get("message") || params.get("pgMessage") || "";
  clearPaymentRedirectParams();
  if (errorCode) {
    await reconcileRejectedServerPayment(paymentId);
    await syncMemberTicketsFromServer();
    state.pendingPaymentCheckStatus = { tone: "alert", text: message || "결제가 완료되지 않았습니다." };
    state.ticketHistory.unshift({ text: message || `결제 미완료 · ${errorCode}`, tone: "alert" });
    renderAll();
    setView("shopView");
    return true;
  }
  try {
    const verification = await verifyServerPayment(paymentId);
    state.pendingPaymentCheckStatus = verification?.ok
      ? { tone: "done", text: "결제 검증이 끝났습니다. 회원권 상태를 확인합니다." }
      : { tone: "wait", text: "결제 접수 후 서버 검증을 기다리는 중입니다." };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 서버 검증 완료", tone: verification?.ok ? "done" : "wait" });
    const flow = purchaseFlowState();
    flow.open = true;
    flow.step = 4;
    flow.completionStatus = verification?.ok ? "결제가 확인되었습니다" : "결제가 접수되었습니다";
  } catch (error) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제 검증 확인 필요 · ${paymentServerErrorMessage(error)}` };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 관리자 검증 확인 필요", tone: "alert" });
  }
  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
  return true;
}

async function cancelPendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || null;
  const paymentId = ticket?.providerPaymentId || "";
  if (!ticket || !paymentId) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "취소할 결제 대기 기록을 찾지 못했습니다." };
    renderAll();
    setView("shopView");
    return;
  }
  if (pendingPaymentCancelInFlight.has(paymentId)) return;
  if (!window.confirm(`${ticket.title || "회원권"} 결제 대기를 취소할까요?\n실제 결제가 완료된 회원권은 취소되지 않습니다.`)) return;

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "로그인 상태를 확인한 뒤 다시 시도해 주세요." };
    renderAll();
    return;
  }

  pendingPaymentCancelInFlight.add(paymentId);
  state.pendingPaymentCheckStatus = { tone: "wait", text: "결제 대기건을 취소하는 중입니다." };
  renderAll();
  try {
    const result = await client.invokeFunction("portone-payment/cancel-pending", {
      body: { paymentId, reason: "회원 결제 대기 취소" },
    });
    if (!result?.ok) throw Object.assign(new Error(result?.code || "pending_payment_cancel_failed"), { payload: result });
    state.pendingPaymentCheckStatus = { tone: "done", text: "결제 대기건을 취소했습니다." };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제 대기 취소`, tone: "done" });
  } catch (error) {
    const detail = paymentServerErrorMessage(error);
    state.pendingPaymentCheckStatus = { tone: "alert", text: detail };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제 대기 취소 실패 · ${detail}`, tone: "alert" });
  } finally {
    pendingPaymentCancelInFlight.delete(paymentId);
  }

  await Promise.allSettled([syncMemberTicketsFromServer(), syncMemberDiscountCouponsFromServer()]);
  renderAll();
  setView("shopView");
}

function applyPurchaseScheduleSlot(selectedSlot = {}) {
  const flow = purchaseFlowState();
  const selectedProduct = purchaseProductForScheduleSlot(purchaseFlowProduct() || {}, selectedSlot);
  if (!selectedProduct) {
    showToast("선택한 날짜에 사용할 수 있는 쿠폰 상품을 확인하지 못했습니다.");
    return false;
  }
  flow.productId = selectedProduct.id;
  const selectedCoachRoleId = String(selectedSlot.coachRoleId || "");
  if (flow.coachRoleId && String(flow.coachRoleId) !== selectedCoachRoleId) clearPurchaseSchedules();
  flow.coachRoleId = selectedCoachRoleId;
  flow.coachName = selectedSlot.coachName || "";
  const nextSchedule = {
    lessonDate: selectedSlot.lessonDate || "",
    day: selectedSlot.day || purchaseDateDay(selectedSlot.lessonDate || ""),
    startTime: selectedSlot.time || "",
    coachRoleId: selectedCoachRoleId,
    coachName: selectedSlot.coachName || "",
    durationMinutes: Math.max(10, Number(selectedProduct.lessonMinutes) || 20),
  };
  reconcilePurchaseSchedulesAfterRefresh(selectedProduct);
  const requiredCount = purchaseRequiredScheduleCount(selectedProduct);
  const selectedWeek = purchaseScheduleSelectionWeek(flow.preferredSchedules);
  const nextWeek = purchaseWeekStartDate(nextSchedule.lessonDate);
  if (requiredCount > 1 && selectedWeek && selectedWeek !== nextWeek) {
    showToast("주 1·2·3회 시간은 같은 시작 주에서 선택해 주세요.");
    return false;
  }
  flow.scheduleWeekStart = nextWeek;
  const existingIndex = flow.preferredSchedules.findIndex((schedule) => purchaseScheduleKey(schedule) === purchaseScheduleKey(nextSchedule));
  if (existingIndex >= 0) {
    flow.preferredSchedules.splice(existingIndex, 1);
  } else {
    if (flow.preferredSchedules.length >= requiredCount) {
      if (requiredCount === 1) flow.preferredSchedules = [nextSchedule];
      else {
        showToast(`주 ${requiredCount}회 상품은 시간 ${requiredCount}개만 선택할 수 있습니다. 선택 초기화 후 다시 골라주세요.`);
        return false;
      }
    } else {
      flow.preferredSchedules.push(nextSchedule);
    }
  }
  syncLegacyPurchaseScheduleFields();
  saveSnapshot();
  renderMembershipPurchaseFlow();
  if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
  return true;
}

function completeMembershipPurchaseFlow(message = "결제가 접수되었습니다") {
  const flow = purchaseFlowState();
  flow.open = true;
  flow.step = 4;
  flow.completionStatus = message;
  saveSnapshot();
  renderMembershipPurchaseFlow();
}
