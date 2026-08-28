// 결제·정산 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function closeOnsitePaymentModal() {
  $("#onsitePaymentModal")?.setAttribute("hidden", "");
}

function openOnsitePaymentModal() {
  if (!adminApprovalReady() && !adminLocalPreviewMode) {
    showToast("관리자 권한으로 로그인해 주세요.");
    return;
  }
  const memberSelect = $("#onsitePaymentMember");
  const eligibleMembers = operationBranchMembers()
    .filter((member) => memberServerUserIds(member).length)
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "ko"));
  memberSelect.innerHTML = eligibleMembers.length
    ? eligibleMembers.map((member) => `<option value="${escapeHtml(memberServerUserIds(member)[0])}">${escapeHtml(member.name)}</option>`).join("")
    : '<option value="">연결된 회원 없음</option>';
  const productSelect = $("#onsitePaymentProduct");
  const products = onsitePaymentProducts();
  productSelect.innerHTML = products.length
    ? products.map(({ draft, server }) => `<option value="${escapeHtml(server.id)}">${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`).join("")
    : '<option value="">판매 중인 회원권 없음</option>';
  $("#onsitePaymentDate").value = adminLocalDateKey(new Date());
  $("#onsitePaymentStartDate").value = "";
  $("#onsitePaymentMessage").textContent = "";
  syncOnsitePaymentSourceTickets();
  $("#onsitePaymentModal")?.removeAttribute("hidden");
  window.setTimeout(() => memberSelect?.focus(), 0);
}

function closeRefundModal() {
  $("#refundModal")?.setAttribute("hidden", "");
  $("#refundForm")?.reset();
  Object.assign(refundFlowState, {
    paymentId: "",
    itemSnapshot: null,
    preview: null,
    loading: false,
    submitting: false,
    reconcileRequired: false,
    manualTransferPending: false,
    manualPreviewChanged: false,
    previewNeedsConfirmation: false,
    idempotencyKey: "",
    message: "",
    tone: "neutral",
  });
}

async function openRefundModal(item) {
  if (!(await ensureAdminPaymentCancelReady(item))) return;
  if (!item?.providerPaymentId) {
    showToast("서버 결제번호가 필요합니다");
    return;
  }
  Object.assign(refundFlowState, {
    paymentId: String(item.providerPaymentId || ""),
    itemSnapshot: { ...item },
    preview: null,
    loading: true,
    submitting: false,
    reconcileRequired: item.status === "refund_reconcile",
    manualTransferPending: item.status === "refund_manual_pending",
    manualPreviewChanged: false,
    previewNeedsConfirmation: false,
    idempotencyKey: newRefundIdempotencyKey(),
    message: "",
    tone: "neutral",
  });
  $("#refundModal")?.removeAttribute("hidden");
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-preview", {
      body: { paymentId: refundFlowState.paymentId },
    });
    if (result?.status === "already_refunded") {
      billingLogs.unshift(`${item.member} 환불은 이미 완료된 결제입니다.`);
      await loadServerPaymentsIntoBilling({ silent: true });
      closeRefundModal();
      showToast("이미 환불 완료된 결제입니다");
      return;
    }
    refundFlowState.preview = result?.preview || null;
    refundFlowState.manualPreviewChanged = refundFlowState.manualTransferPending && result?.previewChanged === true;
    refundFlowState.message = refundFlowState.reconcileRequired
      ? "취소 결과를 확인한 뒤 내부 기록을 다시 맞춰 주세요."
      : refundFlowState.manualPreviewChanged
        ? `접수 후 이용 횟수 또는 환불액이 바뀌었습니다. 송금하지 말고 환불 접수를 취소한 뒤 ${money.format(numericValue(result?.preview?.refundAmount))}원으로 다시 접수하세요.`
      : refundFlowState.manualTransferPending
        ? "실제 송금을 확인한 뒤 관리자 PIN, 송금 확인 메모, 송금완료 문구를 입력하세요."
        : isManualCashRefundItem(item)
          ? "계산값을 확인해 환불을 접수하세요. 이 단계에서는 실제 송금과 이용권 환불이 실행되지 않습니다."
          : "계산값을 확인한 뒤 관리자 PIN과 확인 문구를 입력하세요.";
    if (refundFlowState.manualPreviewChanged) refundFlowState.tone = "danger";
  } catch (error) {
    const code = error?.payload?.code || "refund_preview_failed";
    refundFlowState.message = refundErrorText(code);
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.loading = false;
    renderRefundModal();
  }
}

async function confirmRefundFromModal() {
  const item = refundFlowPaymentItem();
  const preview = refundFlowState.preview;
  if (!item || !preview || refundFlowState.submitting) return;
  const manualTransferConfirmation = refundFlowState.manualTransferPending;
  const inputs = await verifyRefundAdminInputs({
    requireReason: !manualTransferConfirmation,
    requireTransferReference: manualTransferConfirmation,
  });
  if (!inputs) return;
  refundFlowState.submitting = true;
  const manualCashRefund = isManualCashRefundItem(item);
  refundFlowState.message = manualTransferConfirmation
    ? "송금 완료 증빙과 내부 이용권 반영을 처리하고 있습니다."
    : manualCashRefund
      ? "현금·계좌이체 환불을 접수하고 이용권 사용을 잠그고 있습니다."
    : "PortOne 환불과 내부 이용권 반영을 처리하고 있습니다.";
  refundFlowState.tone = "neutral";
  renderRefundModal();
  try {
    const result = manualTransferConfirmation
      ? await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-manual-confirm", {
          body: {
            paymentId: refundFlowState.paymentId,
            expectedRefundAmount: numericValue(preview.refundAmount),
            confirmation: "송금완료",
            transferReference: inputs.transferReference,
          },
        })
      : await window.TennisNoteDataClient.invokeFunction("portone-payment/refund", {
          body: {
            paymentId: refundFlowState.paymentId,
            expectedRefundAmount: numericValue(preview.refundAmount),
            expectedUsedSessions: numericValue(preview.usedSessions),
            reason: inputs.reason,
            confirmation: "환불",
            acceptPolicyFallback: Boolean($("#acceptRefundPolicyFallback")?.checked),
            idempotencyKey: refundFlowState.idempotencyKey,
          },
        });
    if (result?.ok) {
      const manualPending = result.status === "manual_transfer_pending";
      billingLogs.unshift(manualPending
        ? `${item.member} 현금 환불 접수: ${money.format(numericValue(result.refundAmount || preview.refundAmount))}원 · 실제 송금 대기`
        : `${item.member} 환불 완료: ${money.format(numericValue(result.refundAmount || preview.refundAmount))}원`);
      closeRefundModal();
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast(manualPending
        ? "환불 접수됨 · 실제 송금 후 송금완료를 확인하세요"
        : manualCashRefund
          ? "송금 확인과 이용권 환불 반영 완료"
          : "환불과 이용권 반영 완료");
      return;
    }
    if (result?.code === "reconcile_required") {
      refundFlowState.reconcileRequired = true;
      refundFlowState.message = refundErrorText(result.code);
      refundFlowState.tone = "danger";
    } else {
      if (!applyRefundPreviewChange(result?.code, result?.preview)) {
        refundFlowState.message = refundErrorText(result?.code);
        refundFlowState.tone = "danger";
        if (result?.preview) refundFlowState.preview = result.preview;
      }
    }
  } catch (error) {
    const code = error?.payload?.code || "refund_failed";
    if (code === "reconcile_required") refundFlowState.reconcileRequired = true;
    if (!applyRefundPreviewChange(code, error?.payload?.preview)) {
      if (error?.payload?.preview) refundFlowState.preview = error.payload.preview;
      refundFlowState.message = refundErrorText(code);
      refundFlowState.tone = "danger";
    }
  } finally {
    refundFlowState.submitting = false;
    renderRefundModal();
  }
}

async function reconcileRefundFromModal() {
  const item = refundFlowPaymentItem();
  if (!item || refundFlowState.submitting) return;
  const inputs = await verifyRefundAdminInputs({ requireReason: false });
  if (!inputs) return;
  refundFlowState.submitting = true;
  refundFlowState.message = "PG 취소 결과와 내부 기록을 다시 확인하고 있습니다.";
  refundFlowState.tone = "neutral";
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-reconcile", {
      body: { paymentId: refundFlowState.paymentId },
    });
    if (result?.ok) {
      billingLogs.unshift(`${item.member} 환불 상태 동기화 완료`);
      closeRefundModal();
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast("환불 상태 동기화 완료");
      return;
    }
    refundFlowState.message = refundErrorText(result?.code);
    refundFlowState.tone = "danger";
  } catch (error) {
    refundFlowState.message = refundErrorText(error?.payload?.code || "reconcile_failed");
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.submitting = false;
    renderRefundModal();
  }
}

function closePaymentCancelModal() {
  if (paymentCancelFlowState.submitting) return;
  $("#paymentCancelModal")?.setAttribute("hidden", "");
  $("#paymentCancelForm")?.reset();
  Object.assign(paymentCancelFlowState, {
    itemIndex: -1,
    submitting: false,
    idempotencyKey: "",
    message: "",
    tone: "neutral",
  });
}

async function openPaymentCancelModal(item, itemIndex = billings.indexOf(item)) {
  const serverBacked = Boolean(item?.serverPaymentId);
  const localPending = item && ["check", "unverified", "failed"].includes(item.status) && !serverBacked;
  if (!item?.providerPaymentId) {
    billingLogs.unshift(`${item?.member || "회원"} ${item?.item || "결제"} 취소 실패: paymentId 없음`);
    renderAll();
    showToast("paymentId가 없어 결제취소를 실행할 수 없습니다");
    return;
  }
  if (!localPending && !["paid", "server_ready", "failed", "cancel_reconcile"].includes(item.status)) {
    showToast("취소 가능한 상태가 아닙니다");
    return;
  }
  if (!(await ensureAdminPaymentCancelReady(item))) return;
  Object.assign(paymentCancelFlowState, {
    itemIndex,
    submitting: false,
    idempotencyKey: newPaymentCancelIdempotencyKey(),
    message: "대상과 금액을 확인하고 취소 사유와 최종 확인 문구를 입력하세요.",
    tone: "neutral",
  });
  $("#paymentCancelForm")?.reset();
  if (!item || !["paid", "cancel_reconcile"].includes(item.status)) {
    if ($("#paymentCancelReason")) $("#paymentCancelReason").value = "결제 전 대기건 정리";
  }
  $("#paymentCancelModal")?.removeAttribute("hidden");
  renderPaymentCancelModal();
  $("#paymentCancelReason")?.focus();
}

async function confirmPaymentCancelFromModal() {
  const item = billings[paymentCancelFlowState.itemIndex];
  if (!item || paymentCancelFlowState.submitting) return;
  const reason = $("#paymentCancelReason")?.value.trim() || "";
  const confirmation = $("#paymentCancelConfirmationText")?.value.trim() || "";
  const expectedConfirmation = paymentCancelConfirmationPhrase(item);
  if (reason.length < 2) {
    paymentCancelFlowState.message = "결제취소 사유를 2자 이상 입력해 주세요.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  if (confirmation !== expectedConfirmation) {
    paymentCancelFlowState.message = `최종 확인란에 ${expectedConfirmation}를 입력해 주세요.`;
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  await executeBillingPaymentCancellation(item, reason);
}

function openBillingMemberReview(item = {}, billingIndex = billings.indexOf(item)) {
  const context = billingMemberTicketContext(item);
  const member = context.member;
  if (!member) {
    showToast("연결할 회원을 회원관리에서 먼저 확인해 주세요");
    return;
  }
  if (context.ticket) {
    const openInline = () => {
      if (!memberAdminEditEnabled) {
        memberAdminEditEnabled = true;
        memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
      }
      state.billingInlineIndex = state.billingInlineIndex === billingIndex ? null : billingIndex;
      renderBilling();
      if (state.billingInlineIndex === billingIndex) {
        document.querySelector(`[data-billing-inline-index="${billingIndex}"]`)?.scrollIntoView({ block: "nearest" });
      }
    };
    if (memberAdminEditEnabled || isAdminUnlocked()) {
      openInline();
      return;
    }
    if (adminPinNeedsSetup()) {
      state.settingsTab = "security";
      showToast("운영 설정의 보안·잠금에서 관리자 PIN을 먼저 설정해 주세요.");
      return;
    }
    adminLockSession.pendingView = "";
    adminLockSession.pendingAction = "member_admin_edit";
    adminLockSession.pendingLabel = "결제·회원권 한 줄 수정";
    adminLockSession.error = "";
    adminLockSession.afterUnlock = openInline;
    renderAdminLockModal();
    $("#adminLockModal")?.removeAttribute("hidden");
    setTimeout(() => $("#adminPinInput")?.focus(), 0);
    return;
  }
  state.selectedMemberId = member.id;
  setView("members", { skipLock: true });
  renderMembers();
  void loadAdminMemberDetail(member, { force: true });
  showToast(`${member.name} 회원권·결제 연결을 확인해 주세요`);
}
