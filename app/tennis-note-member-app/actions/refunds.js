const memberRefundRequestFlow = {
  ticket: null,
  preview: null,
  request: null,
  loading: false,
  submitting: false,
  operationKey: "",
  message: "",
  tone: "neutral",
};

function memberRefundRequestForTicket(ticketId) {
  return (state.refundRequests || []).find((request) => String(request.ticketId || "") === String(ticketId || "")) || null;
}

function memberRefundRequestStatus(status = "") {
  const labels = {
    submitted: ["접수 완료", "관리자가 결제와 이용 횟수를 확인합니다."],
    reviewing: ["검토 중", "관리자가 환불 정책과 계산값을 확인하고 있습니다."],
    approved: ["승인됨", "관리자가 결제수단에 맞는 환불 처리를 준비합니다."],
    executing: ["처리 중", "PG 취소 또는 계좌이체 송금 확인을 진행하고 있습니다."],
    completed: ["환불 완료", "환불과 회원권 반영이 완료되었습니다."],
    rejected: ["요청 반려", "관리자 안내를 확인해 주세요."],
    failed: ["처리 확인 필요", "환불은 자동 재실행되지 않습니다. 관리자 확인이 필요합니다."],
  };
  const [label, detail] = labels[String(status || "")] || ["상태 확인", "최신 요청 상태를 확인해 주세요."];
  return { label, detail };
}

function memberRefundErrorText(code = "") {
  const labels = {
    member_login_required: "회원 로그인 후 이용해 주세요.",
    payment_not_owned: "내 결제와 회원권 연결을 확인하지 못했습니다.",
    payment_not_refundable: "현재 환불을 요청할 수 없는 결제 상태입니다.",
    refund_reason_required: "환불 요청 사유를 2자 이상 입력해 주세요.",
    refund_preview_changed: "이용 횟수 또는 계산 금액이 바뀌었습니다. 최신 계산값을 다시 확인해 주세요.",
    ticket_usage_changed: "회원권 이용 횟수가 바뀌었습니다. 최신 계산값을 다시 확인해 주세요.",
    policy_fallback_confirmation_required: "현재 정책 기준 계산 확인이 필요합니다.",
    nothing_to_refund: "계산된 환불 예상액이 없어 요청할 수 없습니다.",
    refund_request_submit_failed: "환불 요청을 접수하지 못했습니다. 결제 상태를 다시 확인해 주세요.",
  };
  return labels[code] || "환불 요청 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.";
}

function newMemberRefundOperationKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `member-refund:${value}`;
}

function renderMemberRefundRequestSheet() {
  const target = $("#memberRefundRequestContent");
  const form = $("#memberRefundRequestForm");
  const reason = $("#memberRefundRequestReason");
  const fallback = $("#memberRefundPolicyFallback");
  const submit = $("#submitMemberRefundRequest");
  const message = $("#memberRefundRequestMessage");
  if (!target || !form) return;
  const request = memberRefundRequestFlow.request;
  if (memberRefundRequestFlow.loading) {
    target.innerHTML = '<p class="member-refund-loading" role="status">결제와 회원권의 최신 환불 예상액을 확인하고 있습니다.</p>';
  } else if (request) {
    const status = memberRefundRequestStatus(request.status);
    target.innerHTML = `<article class="member-refund-status-card" data-status="${escapeHtml(request.status || "submitted")}">
      <span>환불 요청 상태</span><strong>${escapeHtml(status.label)}</strong><p>${escapeHtml(status.detail)}</p>
      ${request.expectedRefundAmount ? `<small>접수 당시 예상 환불액 ${Number(request.expectedRefundAmount).toLocaleString("ko-KR")}원</small>` : ""}
      ${request.rejectionReason ? `<small class="is-danger">반려 사유: ${escapeHtml(request.rejectionReason)}</small>` : ""}
    </article>`;
  } else if (memberRefundRequestFlow.preview) {
    const preview = memberRefundRequestFlow.preview;
    target.innerHTML = `<article class="member-refund-preview">
      <div><span>${escapeHtml(preview.productName || "회원권")}</span><strong>예상 환불액 ${Number(preview.refundAmount || 0).toLocaleString("ko-KR")}원</strong></div>
      <dl><div><dt>결제금액</dt><dd>${Number(preview.paidAmount || 0).toLocaleString("ko-KR")}원</dd></div><div><dt>사용 회차</dt><dd>총 ${Number(preview.totalSessions || 0)}회 중 ${Number(preview.usedSessions || 0)}회</dd></div><div><dt>사용·위약금 등 차감</dt><dd>-${(Number(preview.usedAmount || 0) + Number(preview.penaltyAmount || 0) + Number(preview.reservationFee || 0)).toLocaleString("ko-KR")}원</dd></div></dl>
      <p>요청 접수만으로 결제 취소나 계좌 송금, 회원권 변경은 실행되지 않습니다. 관리자가 최신 이용 내역과 정책을 다시 확인한 뒤 처리합니다.</p>
    </article>`;
  } else {
    target.innerHTML = '<p class="member-refund-loading is-danger">환불 예상액을 불러오지 못했습니다.</p>';
  }
  const editable = Boolean(memberRefundRequestFlow.preview && !request && !memberRefundRequestFlow.loading);
  if (reason) reason.disabled = !editable || memberRefundRequestFlow.submitting;
  if (fallback) {
    fallback.closest("label").hidden = !memberRefundRequestFlow.preview?.requiresPolicyFallbackConfirmation || !editable;
    fallback.disabled = !editable || memberRefundRequestFlow.submitting;
  }
  if (submit) {
    submit.hidden = !editable;
    submit.disabled = !editable || memberRefundRequestFlow.submitting;
    submit.textContent = memberRefundRequestFlow.submitting ? "접수 중" : "환불 요청 접수";
  }
  if (message) {
    message.textContent = memberRefundRequestFlow.message || "";
    message.className = `form-message ${memberRefundRequestFlow.tone === "danger" ? "danger" : memberRefundRequestFlow.tone === "good" ? "good" : ""}`;
  }
}

async function syncMemberRefundRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) return false;
  try {
    const result = await client.invokeFunction("portone-payment/refund-request-member-list", { body: {} });
    state.refundRequests = Array.isArray(result?.requests) ? result.requests : [];
    return true;
  } catch {
    return false;
  }
}

async function openMemberRefundRequest(ticketId) {
  const ticket = (state.liveTickets || []).find((item) => String(item.id || "") === String(ticketId || ""));
  if (!ticket?.providerPaymentId || ticket.paymentStatus !== "verified") {
    showToast("환불 가능한 결제와 회원권 연결을 확인해 주세요.");
    return;
  }
  const currentRequest = memberRefundRequestForTicket(ticket.id);
  Object.assign(memberRefundRequestFlow, {
    ticket,
    preview: null,
    request: currentRequest,
    loading: !currentRequest,
    submitting: false,
    operationKey: newMemberRefundOperationKey(),
    message: "",
    tone: "neutral",
  });
  $("#memberRefundRequestReason").value = "";
  $("#memberRefundPolicyFallback").checked = false;
  openAppSheet("memberRefundRequestSheet", { initialFocus: "#memberRefundRequestReason, [data-close-member-refund-request]" });
  renderMemberRefundRequestSheet();
  if (currentRequest) return;
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-request-preview", {
      body: { paymentId: ticket.providerPaymentId },
    });
    memberRefundRequestFlow.preview = result?.preview || null;
    memberRefundRequestFlow.message = "예상 금액과 정책을 확인하고 요청 사유를 입력해 주세요.";
  } catch (error) {
    memberRefundRequestFlow.message = memberRefundErrorText(error?.payload?.code || error?.message);
    memberRefundRequestFlow.tone = "danger";
  } finally {
    memberRefundRequestFlow.loading = false;
    renderMemberRefundRequestSheet();
  }
}

async function submitMemberRefundRequest() {
  const ticket = memberRefundRequestFlow.ticket;
  const preview = memberRefundRequestFlow.preview;
  const reason = $("#memberRefundRequestReason")?.value.trim() || "";
  if (!ticket || !preview || memberRefundRequestFlow.submitting) return;
  if (reason.length < 2) {
    memberRefundRequestFlow.message = memberRefundErrorText("refund_reason_required");
    memberRefundRequestFlow.tone = "danger";
    renderMemberRefundRequestSheet();
    return;
  }
  if (preview.requiresPolicyFallbackConfirmation && !$("#memberRefundPolicyFallback")?.checked) {
    memberRefundRequestFlow.message = memberRefundErrorText("policy_fallback_confirmation_required");
    memberRefundRequestFlow.tone = "danger";
    renderMemberRefundRequestSheet();
    return;
  }
  memberRefundRequestFlow.submitting = true;
  memberRefundRequestFlow.message = "환불 요청을 안전하게 접수하고 있습니다.";
  memberRefundRequestFlow.tone = "neutral";
  renderMemberRefundRequestSheet();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-request-submit", {
      body: {
        paymentId: ticket.providerPaymentId,
        operationKey: memberRefundRequestFlow.operationKey,
        reason,
        expectedRefundAmount: Number(preview.refundAmount || 0),
        expectedUsedSessions: Number(preview.usedSessions || 0),
        acceptPolicyFallback: Boolean($("#memberRefundPolicyFallback")?.checked),
      },
    });
    memberRefundRequestFlow.request = { ...result.request, ticketId: ticket.id, expectedRefundAmount: preview.refundAmount };
    state.refundRequests = [memberRefundRequestFlow.request, ...(state.refundRequests || []).filter((item) => String(item.ticketId || "") !== String(ticket.id))];
    memberRefundRequestFlow.message = "환불 요청이 접수되었습니다. 실제 환불은 관리자 확인 뒤 진행됩니다.";
    memberRefundRequestFlow.tone = "good";
    renderProducts();
  } catch (error) {
    const code = error?.payload?.code || error?.message || "refund_request_submit_failed";
    memberRefundRequestFlow.message = memberRefundErrorText(code);
    memberRefundRequestFlow.tone = "danger";
    if (["refund_preview_changed", "ticket_usage_changed"].includes(code)) memberRefundRequestFlow.preview = null;
  } finally {
    memberRefundRequestFlow.submitting = false;
    renderMemberRefundRequestSheet();
  }
}
