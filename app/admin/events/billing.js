// 정산 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindBillingEvents() {
  $("#openOnsitePaymentButton")?.addEventListener("click", openOnsitePaymentModal);
  $$("[data-close-onsite-payment]").forEach((button) => button.addEventListener("click", closeOnsitePaymentModal));
  $("#onsitePaymentModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeOnsitePaymentModal();
  });
  $("#onsitePaymentSourceTicket")?.addEventListener("change", () => syncOnsitePaymentSourceTickets({ preserveEmpty: true }));
  $("#onsitePaymentProduct")?.addEventListener("change", () => {
    syncOnsitePaymentCoaches();
    updateOnsitePaymentAmount();
    syncOnsitePaymentScheduleChoice();
  });
  $("#onsitePaymentMethod")?.addEventListener("change", updateOnsitePaymentAmount);
  $("#onsitePaymentForm")?.addEventListener("submit", submitOnsitePayment);
  $("#billingMonthFilter")?.addEventListener("change", (event) => {
    state.billingMonth = event.target.value || adminLocalDateKey(new Date()).slice(0, 7);
    state.billingPage = 0;
    state.settlementPage = 0;
    renderBilling();
    renderCoachSettlementPreview();
    saveSnapshot();
  });
  $("#refundForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmRefundFromModal();
  });
  $("#paymentCancelForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmPaymentCancelFromModal();
  });
  $("#closePaymentCancelModal")?.addEventListener("click", closePaymentCancelModal);
  $("#dismissPaymentCancelModal")?.addEventListener("click", closePaymentCancelModal);
  $("#paymentCancelModal")?.addEventListener("click", (event) => {
    if (event.target.id === "paymentCancelModal") closePaymentCancelModal();
  });
  $("#closeRefundModal")?.addEventListener("click", closeRefundModal);
  $("#cancelRefundModal")?.addEventListener("click", closeRefundModal);
  $("#cancelManualRefundRequest")?.addEventListener("click", cancelManualRefundRequestFromModal);
  $("#retryRefundReconcile")?.addEventListener("click", reconcileRefundFromModal);
  $("#refundModal")?.addEventListener("click", (event) => {
    if (event.target.id === "refundModal") closeRefundModal();
  });
  $("#downloadSettlementButton")?.addEventListener("click", downloadSettlementCsv);
}
