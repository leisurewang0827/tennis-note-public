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
  if ($("#coachRevenueCount")) $("#coachRevenueCount").textContent = `결제 ${Number(settlement.paymentCount) || 0}건`;
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
        : `결제 ${Number(settlement.paymentCount) || 0}건 · 수업 ${Number(settlement.settledSessions) || 0}회`;
  }
  const rows = Array.isArray(settlement.rows) ? settlement.rows : [];
  const rowsTarget = $("#coachSettlementRows");
  if (rowsTarget) {
    rowsTarget.innerHTML = rows.length
      ? rows.map((row) => `
        <article>
          <div>
            <strong>${escapeHtml(row.memberName || "회원")}</strong>
            <span>${escapeHtml(row.productName || "회원권")} · ${escapeHtml(String(row.method || "결제수단 미입력"))}</span>
          </div>
          <div>
            <b>${formatCoachWon(row.estimatedSettlement)}</b>
            <small>매출 ${formatCoachWon(row.amount)} · 정산 ${Number(row.settledSessions) || 0}/${Number(row.totalSessions) || 0}회</small>
          </div>
        </article>`).join("")
      : coachEmptyState({
        title: state.coachSettlementLoading ? "정산 자료를 확인하고 있습니다." : "선택한 달의 내 담당 결제가 없습니다.",
        description: "관리자 결제 귀속과 회원권 담당 코치를 확인해 주세요.",
      });
  }
  renderVisibleMemberSettlement();
  renderCoachSettlementHistory();
}

// Existing own-scope detail; canonical32c response form, no financial writes.
function renderCoachSettlementHistory() {
  const section = $("#coachSettlementReconciliation");
  if (!section) return;
  if (!coachSettlementReconciliationContinuation() || (coachSettlementHistory.continuationIsCurrent && !coachSettlementHistory.continuationIsCurrent()) || $("#coachSettlementModal")?.hidden !== false) resetCoachSettlementHistory();
  const uiState = String(coachSettlementHistory.coachSettlementReconciliationUiState || "EMPTY").toUpperCase();
  const payload = coachSettlementHistory.coachSettlementReconciliation || {};
  const snapshot = payload.snapshot || null;
  const confirmation = payload.confirmation || null;
  const reconciliation = payload.reconciliation || null;
  const payloadIsExact = coachSettlementReconciliationPayloadIsExact(payload);
  const busy = coachSettlementHistory.coachSettlementReconciliationLoading || coachSettlementHistory.coachSettlementReconciliationSubmitting;
  bindCoachManualSettlementLedgerPublic();
  section.dataset.state = uiState;
  section.setAttribute("aria-busy", String(busy));
  const badge = $("#coachSettlementReconciliationStateBadge");
  if (badge) badge.textContent = coachSettlementReconciliationStateLabel(uiState);
  const message = $("#coachSettlementReconciliationMessage");
  if (message) message.textContent = coachSettlementHistory.coachSettlementReconciliationMessage || coachSettlementReconciliationDefaultMessage(uiState);

  const summary = $("#coachSettlementReconciliationSummary");
  if (summary) {
    summary.innerHTML = "";
    summary.hidden = !payloadIsExact || !snapshot || !confirmation;
    if (payloadIsExact && snapshot && confirmation) {
      const appendSummary = (label, value, detail, className = "") => {
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
      };
      const month = String(payload.scope?.settlementMonth || "").slice(0, 7);
      const [year, monthNumber] = month.split("-");
      appendSummary("확정 월", year && monthNumber ? `${Number(year)}년 ${Number(monthNumber)}월` : "월 확인 필요", `${Number(snapshot.revision) || 0}차 계산본 · ${snapshot.calculationVersion === "r3_effective_settlement_v2" ? "적용일별 v2" : "기존 v1"}`);
      appendSummary("정산 진행", `${Number(snapshot.totals?.settledSessions) || 0}회`, `${Number(snapshot.totals?.settledMinutes) || 0}분`);
      appendSummary("확정 정산액", formatCoachWon(snapshot.totals?.totalSettlementAmount), `관리자 확인 ${coachSettlementReconciliationTimeLabel(confirmation.confirmedAt)}`);
      if (uiState === "DISPUTED" && reconciliation?.reason) {
        appendSummary("이의 사유", String(reconciliation.reason), `응답 ${coachSettlementReconciliationTimeLabel(reconciliation.respondedAt)}`, "coach-settlement-reconciliation-summary-reason");
      } else if (uiState === "ACKNOWLEDGED") {
        appendSummary("코치 응답", "확인했습니다", coachSettlementReconciliationTimeLabel(reconciliation?.respondedAt), "coach-settlement-reconciliation-summary-response");
      }
    }
  }

  const form = $("#coachSettlementReconciliationForm");
  const canRespond = uiState === "PENDING"
    && payloadIsExact
    && !payload.reconciliation
    && Boolean(coachSettlementReconciliationContinuation());
  if (form) {
    form.hidden = !canRespond;
    form.querySelectorAll('input[name="coachSettlementReconciliationChoice"]').forEach((input) => {
      input.checked = input.value === coachSettlementHistory.coachSettlementReconciliationChoice;
      input.disabled = busy;
    });
  }
  const reasonField = $("#coachSettlementReconciliationReasonField");
  if (reasonField) reasonField.hidden = !canRespond || coachSettlementHistory.coachSettlementReconciliationChoice !== "disputed";
  const reasonInput = $("#coachSettlementReconciliationReason");
  if (reasonInput) {
    if (reasonInput.value !== coachSettlementHistory.coachSettlementReconciliationReason) reasonInput.value = coachSettlementHistory.coachSettlementReconciliationReason;
    reasonInput.disabled = busy;
  }
  const validation = $("#coachSettlementReconciliationValidation");
  if (validation) {
    validation.hidden = !coachSettlementHistory.coachSettlementReconciliationValidation;
    validation.textContent = coachSettlementHistory.coachSettlementReconciliationValidation;
  }
  const submit = $("#coachSettlementReconciliationSubmit");
  if (submit) {
    const reasonError = coachSettlementHistory.coachSettlementReconciliationChoice === "disputed"
      ? coachSettlementReconciliationReasonError(coachSettlementHistory.coachSettlementReconciliationReason)
      : "";
    submit.textContent = coachSettlementHistory.coachSettlementReconciliationSubmitting ? "응답 저장 중" : "응답 저장";
    submit.disabled = !canRespond
      || busy
      || !["acknowledged", "disputed"].includes(coachSettlementHistory.coachSettlementReconciliationChoice)
      || Boolean(reasonError);
  }

  const retry = $("#coachSettlementReconciliationRetry");
  if (retry) {
    retry.hidden = !["STALE", "CONFLICT", "ERROR"].includes(uiState);
    retry.disabled = busy;
  }
}

function coachManualSettlementLedgerIdentityKey() {
  return JSON.stringify([String(state.liveProfileId || ""), String(state.coach?.authUserId || ""),
    window.TennisNoteDataClient?.getSession?.()?.access_token || "", coachSettlementHistory.coachSettlementReconciliationRequestId,
    coachSettlementReconciliationScopeSignature()]);
}
function coachManualSettlementLedgerReady() {
  const scope = coachSettlementReconciliationScope();
  return Boolean(coachSettlementHistory.continuationIsCurrent?.() && $("#coachSettlementModal")?.hidden === false
    && !coachSettlementHistory.coachSettlementReconciliationLoading
    && coachSettlementReconciliationPayloadIsExact(coachSettlementHistory.coachSettlementReconciliation, scope)
    && coachSettlementHistory.coachSettlementReconciliation?.confirmation?.status === "confirmed");
}
function bindCoachManualSettlementLedgerPublic() {
  const parent = $("#coachSettlementReconciliation"), ledger = window.TennisNoteManualSettlementLedger;
  if (!parent || !ledger) return null;
  const ready = coachManualSettlementLedgerReady();
  if (!ready && !parent.querySelector('[data-manual-ledger="coach"]')) return null;
  const controller = ledger.bindExisting(parent, {
    role: "coach", ready: coachManualSettlementLedgerReady,
    payload: () => coachSettlementHistory.coachSettlementReconciliation,
    currentScope: coachSettlementReconciliationScope, identityKey: coachManualSettlementLedgerIdentityKey,
    rpc: (name, payload) => {
      if (!coachManualSettlementLedgerReady() || name !== "tn_coach_monthly_settlement_payment_state") throw Error("ledger_scope_identity_denied");
      return window.TennisNoteDataClient.rpc(name, payload);
    },
  });
  const host = parent.querySelector('[data-manual-ledger="coach"]');
  if (host) host.hidden = !ready;
  return controller;
}
