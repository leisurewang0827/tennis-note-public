// payment 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function nativeBankNotificationBridgePlugin() {
  if (nativeAppPlatform() !== "android") return null;
  if (bankNotificationBridgePluginCache) return bankNotificationBridgePluginCache;
  bankNotificationBridgePluginCache = window.Capacitor?.Plugins?.BankNotificationBridge
    || window.Capacitor?.registerPlugin?.("BankNotificationBridge")
    || null;
  return bankNotificationBridgePluginCache;
}

function loadPortOneSdk() {
  if (window.__TENNIS_NOTE_PORTONE_TEST_SDK__?.requestPayment) {
    return Promise.resolve(window.__TENNIS_NOTE_PORTONE_TEST_SDK__);
  }
  if (!portOneSdkPromise) {
    portOneSdkPromise = import("https://cdn.portone.io/v2/browser-sdk.esm.js")
      .then((sdk) => {
        if (!sdk?.requestPayment) throw new Error("portone_sdk_invalid");
        return sdk;
      })
      .catch((error) => {
        portOneSdkPromise = null;
        throw error;
      });
  }
  return portOneSdkPromise;
}

function clearPaymentRedirectParams() {
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function completePreparedPayment() {
  const context = preparedPaymentContext;
  if (!context) return;
  const { product, paymentId, sdk } = context;
  const methodId = paymentMethodIdForRequest(context.methodId);
  let preparedPayment = context.preparedPayment || null;
  const method = paymentMethodDefinition(methodId);
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const button = $("#openPreparedPaymentButton");
  const message = $("#paymentConfirmationMessage");
  if (button) button.disabled = true;
  if (message) message.textContent = "결제 요청을 준비하는 중입니다.";

  try {
    if (!preparedPayment) {
      preparedPayment = await prepareServerPayment(product, paymentId, methodId);
      context.preparedPayment = preparedPayment;
    }
    if (message) message.textContent = "결제창을 여는 중입니다.";
    const response = await sdk.requestPayment(portOnePaymentRequest({
      paymentId,
      productId: product.id,
      orderName: product.title,
      totalAmount: paymentAmount,
      methodId,
    }));

    if (response?.code) {
      await reconcileRejectedServerPayment(response?.paymentId || paymentId);
      await syncMemberTicketsFromServer();
      createPaymentRecord(product, {
        paymentId,
        method: `${method.label} 결제 실패`,
        status: response.message || "결제가 완료되지 않았습니다.",
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 실패 · 다시 시도 필요`, tone: "alert" });
    } else {
      const paidPaymentId = response?.paymentId || paymentId;
      let verifiedStatus = "결제 완료 · 서버 검증 후 회원권 충전 대기";
      try {
        const verification = await verifyServerPayment(paidPaymentId);
        if (verification?.ok) {
          verifiedStatus = verification.status === "verified"
            ? "서버 검증 완료 · 이용권 충전 확인 필요"
            : "서버 검증 확인 · 관리자 확인 필요";
        }
      } catch (error) {
        verifiedStatus = `결제 완료 · 서버 검증 대기 · ${paymentServerErrorMessage(error)}`;
      }
      createPaymentRecord(product, {
        paymentId: paidPaymentId,
        serverPaymentId: preparedPayment?.localPaymentId || "",
        method: method.label,
        status: verifiedStatus,
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 완료 접수 · 검증 후 회원권 충전`, tone: "wait" });
      const flow = purchaseFlowState();
      flow.open = true;
      flow.step = 4;
      flow.completionStatus = "결제가 접수되었습니다";
    }
  } catch (error) {
    if (preparedPayment?.localPaymentId) {
      await reconcileRejectedServerPayment(paymentId).catch(() => undefined);
      await syncMemberDiscountCouponsFromServer().catch(() => false);
    }
    const serverCode = error?.payload?.code || error?.message || "server_error";
    if (["membership_enrollment_required", "group_enrollment_required", "group_partner_required"].includes(serverCode)) {
      closePaymentConfirmationModal();
      await syncMemberEnrollmentFromServer();
      openMemberEnrollmentModal(product.id, "2대1 동반 회원 정보를 포함해 수강 가입서를 확인해 주세요.");
      return;
    }
    if (serverCode === "login_required") {
      closePaymentConfirmationModal();
      markTicketSyncLoginNeeded();
      state.pendingPaymentCheckStatus = { tone: "alert", text: "서버 로그인 후 결제할 수 있습니다. 간편 로그인으로 다시 접속해 주세요." };
      state.ticketHistory.unshift({ text: `${product.title} 결제 전 서버 로그인 필요`, tone: "alert" });
      renderAll();
      setView("shopView");
      return;
    }
    const detail = paymentServerErrorMessage(error);
    createPaymentRecord(product, {
      paymentId,
      method: "결제창 오류",
      status: `결제창을 열지 못했습니다. ${detail}`,
    });
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창을 열지 못했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${product.title} 결제창 오류 · ${detail}`, tone: "alert" });
  }

  closePaymentConfirmationModal();
  await Promise.allSettled([syncMemberTicketsFromServer(), syncMemberDiscountCouponsFromServer()]);
  renderAll();
  setView("shopView");
}
