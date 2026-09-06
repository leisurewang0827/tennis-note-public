// 정산 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderVisibleMemberSettlement() {
  const target = $("#memberDetailSettlementValue");
  if (!target || !state.viewingMemberDetailId) return;
  const member = findMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
  if (!member) return;
  const summary = coachMemberSettlementSummary(member);
  target.textContent = summary.label;
  target.dataset.linked = String(summary.linked);
}

function appendCoachSettlementReconciliationSummary(summary, label, value, detail, className = "") {
  const item = document.createElement("div");
  if (className) item.className = className;
  const labelNode = document.createElement("span");
  const valueNode = document.createElement("strong");
  const detailNode = document.createElement("small");
  labelNode.textContent = label;
  valueNode.textContent = value;
  detailNode.textContent = detail;
  item.append(labelNode, valueNode, detailNode);
  summary.appendChild(item);
}

function renderCoachSettlementReconciliationSummary(summary, payload, uiState, payloadIsExact) {
  const snapshot = payload.snapshot || null;
  const confirmation = payload.confirmation || null;
  const reconciliation = payload.reconciliation || null;
  summary.innerHTML = "";
  summary.hidden = !payloadIsExact || !snapshot || !confirmation;
  if (!payloadIsExact || !snapshot || !confirmation) return;
  const month = String(payload.scope?.settlementMonth || "").slice(0, 7);
  const [year, monthNumber] = month.split("-");
  appendCoachSettlementReconciliationSummary(summary, "확정 월", year && monthNumber ? `${Number(year)}년 ${Number(monthNumber)}월` : "월 확인 필요", `${Number(snapshot.revision) || 0}차 계산본`);
  appendCoachSettlementReconciliationSummary(summary, "정산 진행", `${Number(snapshot.totals?.settledSessions) || 0}회`, `${Number(snapshot.totals?.settledMinutes) || 0}분`);
  appendCoachSettlementReconciliationSummary(summary, "확정 정산액", formatCoachWon(snapshot.totals?.totalSettlementAmount), `관리자 확인 ${coachSettlementReconciliationTimeLabel(confirmation.confirmedAt)}`);
  if (uiState === "DISPUTED" && reconciliation?.reason) {
    appendCoachSettlementReconciliationSummary(summary, "이의 사유", String(reconciliation.reason), `응답 ${coachSettlementReconciliationTimeLabel(reconciliation.respondedAt)}`, "coach-settlement-reconciliation-summary-reason");
  } else if (uiState === "ACKNOWLEDGED") {
    appendCoachSettlementReconciliationSummary(summary, "코치 응답", "확인했습니다", coachSettlementReconciliationTimeLabel(reconciliation?.respondedAt), "coach-settlement-reconciliation-summary-response");
  }
}

function renderCoachSettlementReconciliation() {
  const section = $("#coachSettlementReconciliation");
  if (!section) return;
  const uiState = String(state.coachSettlementReconciliationUiState || "EMPTY").toUpperCase();
  const payload = state.coachSettlementReconciliation || {};
  const payloadIsExact = coachSettlementReconciliationPayloadIsExact(payload);
  const busy = state.coachSettlementReconciliationLoading || state.coachSettlementReconciliationSubmitting;
  const monthInput = $("#coachSettlementMonth");
  if (monthInput) monthInput.disabled = busy;
  section.dataset.state = uiState;
  section.setAttribute("aria-busy", String(busy));
  const badge = $("#coachSettlementReconciliationStateBadge");
  if (badge) badge.textContent = coachSettlementReconciliationStateLabel(uiState);
  const message = $("#coachSettlementReconciliationMessage");
  if (message) message.textContent = state.coachSettlementReconciliationMessage || coachSettlementReconciliationDefaultMessage(uiState);
  const summary = $("#coachSettlementReconciliationSummary");
  if (summary) renderCoachSettlementReconciliationSummary(summary, payload, uiState, payloadIsExact);

  const canRespond = uiState === "PENDING" && payloadIsExact && !payload.reconciliation;
  const form = $("#coachSettlementReconciliationForm");
  if (form) {
    form.hidden = !canRespond;
    form.querySelectorAll('input[name="coachSettlementReconciliationChoice"]').forEach((input) => {
      input.checked = input.value === state.coachSettlementReconciliationChoice;
      input.disabled = busy;
    });
  }
  const reasonField = $("#coachSettlementReconciliationReasonField");
  if (reasonField) reasonField.hidden = !canRespond || state.coachSettlementReconciliationChoice !== "disputed";
  const reasonInput = $("#coachSettlementReconciliationReason");
  if (reasonInput) {
    if (reasonInput.value !== state.coachSettlementReconciliationReason) reasonInput.value = state.coachSettlementReconciliationReason;
    reasonInput.disabled = busy;
  }
  const validation = $("#coachSettlementReconciliationValidation");
  if (validation) {
    validation.hidden = !state.coachSettlementReconciliationValidation;
    validation.textContent = state.coachSettlementReconciliationValidation;
  }
  const submit = $("#coachSettlementReconciliationSubmit");
  if (submit) {
    const reasonError = state.coachSettlementReconciliationChoice === "disputed"
      ? coachSettlementReconciliationReasonError(state.coachSettlementReconciliationReason)
      : "";
    submit.textContent = state.coachSettlementReconciliationSubmitting ? "응답 저장 중" : "응답 저장";
    submit.disabled = !canRespond
      || busy
      || !["acknowledged", "disputed"].includes(state.coachSettlementReconciliationChoice)
      || Boolean(reasonError);
  }
  const retry = $("#coachSettlementReconciliationRetry");
  if (retry) {
    retry.hidden = !["STALE", "CONFLICT", "ERROR"].includes(uiState);
    retry.disabled = busy;
  }
}

function renderCoachSettlement() {
  const monthInput = $("#coachSettlementMonth");
  if (monthInput && monthInput.value !== coachSettlementMonth()) monthInput.value = coachSettlementMonth();
  const settlement = state.coachSettlement || {};
  const status = $("#coachSettlementStatus");
  if (status) {
    status.hidden = !state.coachSettlementLoading && !state.coachSettlementError;
    status.dataset.tone = state.coachSettlementError ? "danger" : "wait";
    status.textContent = state.coachSettlementError || (state.coachSettlementLoading ? "정산 자료를 불러오는 중입니다." : "");
  }
  const retryButton = $("#refreshCoachSettlement");
  if (retryButton) retryButton.hidden = !state.coachSettlementError;
  if ($("#coachRevenueAmount")) $("#coachRevenueAmount").textContent = formatCoachWon(settlement.revenueAmount);
  if ($("#coachRevenueCount")) {
    const refundedAmount = Number(settlement.refundedAmount) || 0;
    $("#coachRevenueCount").textContent = `결제 ${Number(settlement.paymentCount) || 0}건${refundedAmount ? ` · 환불 조정 ${formatCoachWon(refundedAmount)}` : ""}`;
  }
  if ($("#coachSettledSessions")) $("#coachSettledSessions").textContent = `${Number(settlement.settledSessions) || 0}회`;
  if ($("#coachEstimatedSettlement")) $("#coachEstimatedSettlement").textContent = formatCoachWon(settlement.estimatedSettlement);
  if ($("#coachSettlementRule")) {
    const substitute = Number(settlement.substituteSettlement) || 0;
    $("#coachSettlementRule").textContent = settlement.ruleType
      ? `${coachSettlementRuleLabel(settlement)}${substitute ? ` · 대타 ${formatCoachWon(substitute)}` : ""}`
      : "정산 규칙 확인 중";
  }
  const compactAmount = $("#coachSettlementCompactAmount");
  const compactMeta = $("#coachSettlementCompactMeta");
  if (compactAmount) {
    compactAmount.textContent = state.coachSettlementLoading
      ? "확인 중"
      : state.coachSettlementError
        ? "다시 확인"
        : formatCoachWon(settlement.estimatedSettlement);
  }
  if (compactMeta) {
    compactMeta.textContent = state.coachSettlementError
      ? "정산 자료를 불러오지 못했습니다. 눌러서 다시 시도하세요."
      : state.coachSettlementLoading
        ? "정산 자료를 불러오는 중입니다."
        : `결제 ${Number(settlement.paymentCount) || 0}건 · 수업 ${Number(settlement.settledSessions) || 0}회${Number(settlement.refundedAmount) ? ` · 환불 ${formatCoachWon(settlement.refundedAmount)}` : ""}`;
  }
  const rows = Array.isArray(settlement.rows) ? settlement.rows : [];
  const rowsTarget = $("#coachSettlementRows");
  if (rowsTarget) {
    rowsTarget.innerHTML = rows.length
      ? rows.map((row) => `
        <article>
          <div>
            <strong>${escapeHtml(row.memberName || "회원")}</strong>
            <span>${escapeHtml(row.productName || "회원권")} · ${escapeHtml(String(row.method || "결제수단 미입력"))}${Number(row.refundedAmount) ? ` · 환불 ${formatCoachWon(row.refundedAmount)} 조정` : ""}</span>
          </div>
          <div>
            <b>${formatCoachWon(row.estimatedSettlement)}</b>
            <small>매출 ${formatCoachWon(row.amount)}${Number(row.grossAmount) > Number(row.amount) ? ` (원결제 ${formatCoachWon(row.grossAmount)})` : ""} · 정산 ${Number(row.settledSessions) || 0}/${Number(row.totalSessions) || 0}회</small>
          </div>
        </article>`).join("")
      : coachEmptyState({
        title: state.coachSettlementLoading ? "정산 자료를 확인하고 있습니다." : "선택한 달의 내 담당 결제가 없습니다.",
        description: "관리자 결제 귀속과 회원권 담당 코치를 확인해 주세요.",
      });
  }
  renderVisibleMemberSettlement();
  renderCoachSettlementReconciliation();
}
