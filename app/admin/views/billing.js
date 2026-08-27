// 정산 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderCoachSettlementPreview() {
  if (!["billing", "settings"].includes(state.view)) return;
  const previewRows = $("#coachSettlementPreviewRows");
  if (previewRows) {
    const ticketById = new Map();
    [...tickets, ...expiredTickets, ...(adminLiveDataState.settlementTickets || [])].forEach((ticket) => {
      if (ticket.id) ticketById.set(String(ticket.id), ticket);
      if (ticket.serverTicketId) ticketById.set(String(ticket.serverTicketId), ticket);
    });
    const completedLessonsByTicket = new Map();
    (adminLiveDataState.lessons || []).forEach((lesson) => {
      if (lesson.serverStatus !== "completed" || !lesson.ticketId) return;
      const key = String(lesson.ticketId);
      const rows = completedLessonsByTicket.get(key) || [];
      rows.push(lesson);
      completedLessonsByTicket.set(key, rows);
    });
    const assignmentByLesson = new Map();
    (adminLiveDataState.substituteAssignments || []).forEach((assignment) => {
      if (!assignment.lesson_id || !["assigned", "completed"].includes(assignment.status)) return;
      assignmentByLesson.set(String(assignment.lesson_id), assignment);
    });
    const recordProgressByTicket = settlementRecordProgressByTicket({ ticketById, assignmentByLesson });
    const monthBillings = billings
      .filter((billing) => billing.status === "paid" && billingMatchesMonth(billing, state.billingMonth));
    const settlementIndexes = {
        ticketById,
        completedLessonsByTicket,
        assignmentByLesson,
        recordProgressByTicket,
      };
    const billedTicketIds = new Set(monthBillings.map((billing) => String(billing.ticketId || "")).filter(Boolean));
    const liveSettlementRows = monthBillings
      .flatMap((billing) => settlementRowsForBilling(billing, settlementIndexes));
    liveSettlementRows.push(...settlementOrphanSubstituteRows(settlementIndexes, billedTicketIds));
    const previewItems = adminDemoMode ? coachSettlementPreview : liveSettlementRows;
    const settlementSummary = $("#coachSettlementSummary");
    if (settlementSummary) {
      const summaries = new Map();
      const countedSessionKeys = new Set();
      previewItems.forEach((item) => {
        const coach = item.linkedTicket === false ? "회원권 미연결" : settlementCoachNameFor(item);
        const current = summaries.get(coach) || {
          coach,
          paidAmount: 0,
          completedLessons: 0,
          settlementAmount: 0,
          issueCount: 0,
        };
        current.paidAmount += Number(item.summaryPaidAmount ?? item.paidAmount) || 0;
        if (!item.sessionKey || !countedSessionKeys.has(item.sessionKey)) {
          current.completedLessons += Number(item.lessonCount) || 0;
          if (item.sessionKey) countedSessionKeys.add(item.sessionKey);
        }
        current.settlementAmount += settlementAmountFor(item);
        if (item.linkedTicket === false) current.issueCount += 1;
        summaries.set(coach, current);
      });
      settlementSummary.innerHTML = [...summaries.values()]
        .sort((left, right) => left.coach === "회원권 미연결" ? -1 : right.settlementAmount - left.settlementAmount)
        .map((item) => `
          <article>
            <span>${escapeHtml(item.coach)}</span>
            <strong>${money.format(item.settlementAmount)}원</strong>
            <small>완료 ${item.completedLessons}회 · 결제 ${money.format(item.paidAmount)}원${item.issueCount ? ` · 연결 확인 ${item.issueCount}건` : ""}</small>
          </article>`)
        .join("") || '<article><span>정산 내역</span><strong>0원</strong><small>선택한 달의 결제 내역이 없습니다.</small></article>';
    }
    state.settlementPage = normalizeDashboardPage(previewItems.length, state.settlementPage, billingPageSize);
    const visiblePreviewItems = previewItems.slice(
      state.settlementPage * billingPageSize,
      (state.settlementPage + 1) * billingPageSize,
    );
    previewRows.innerHTML = visiblePreviewItems
      .map((item) => {
        const settlementCoach = settlementCoachNameFor(item);
        const rule = settlementRuleFor(settlementCoach);
        const transferred = item.coach !== item.actualCoach;
        const ruleLabel = item.substituteSettlementMode === "none"
          ? "정산 없음"
          : item.substituteHourlyRate
          ? `대타 시급 ${money.format(item.substituteHourlyRate)}원`
          : rule.method === "hourly" ? `시급 ${money.format(rule.hourly)}원` : `${Math.round(rule.ratio * 10)}:${10 - Math.round(rule.ratio * 10)}`;
        return `
          <tr>
            <td><strong>${item.member}</strong><br><small>${item.lessonCount}/${item.totalLessons || item.lessonCount}회 완료</small></td>
            <td class="${item.linkedTicket === false ? "payment-link-warning" : ""}">${item.coach}${item.linkedTicket === false ? "<br><small>회원권 연결 후 정산 가능</small>" : transferred ? `<br><small>대타 ${item.actualCoach} · 정산 ${settlementCoach}</small>` : "<br><small>담당 코치 진행</small>"}</td>
            <td>${money.format(item.paidAmount)}원<br><small>${item.paymentMethod} · ${item.discount}</small></td>
            <td><strong>${money.format(item.settlementBase)}원</strong><br><small>${item.paymentMethod === "카드" ? "부가세 제외 현금가" : "실결제 기준"}</small></td>
            <td>${ruleLabel}<br><small>${transferred ? "대타 이관 적용" : "기본 정산"}</small></td>
            <td><strong>${money.format(settlementAmountFor(item))}원</strong></td>
          </tr>`;
      })
      .join("") || '<tr><td colspan="6" class="empty-text">실제 결제 내역이 없습니다.</td></tr>';
    renderDashboardPager(
      "#coachSettlementPreviewPager",
      previewItems.length,
      state.settlementPage,
      "settlement",
      billingPageSize,
    );
  }

}

function renderPaymentAdminGateStatus() {
  const target = $("#paymentAdminGateStatus");
  if (!target) return;
  const ready = adminPaymentCancelReady();
  const tone = ready ? "good" : adminImportAuthState.loading ? "neutral" : "warn";
  target.innerHTML = `
    <article class="payment-admin-gate-card ${tone}">
      <div>
        <strong>${ready ? "결제취소·환불 가능" : "결제취소·환불 잠금"}</strong>
        <span>${escapeHtml(ready ? "관리자 로그인과 권한이 확인되어 결제취소와 환불 계산을 진행할 수 있습니다." : adminPaymentCancelBlockedMessage())}</span>
      </div>
      ${badge(tone, ready ? "관리자 확인됨" : "관리자 확인 필요")}
    </article>`;
}

function renderBilling() {
  syncSharedPaymentRequests();
  state.billingFilter = ["action", "verifying", "done", "refund"].includes(state.billingFilter) ? state.billingFilter : "action";
  state.billingMonth = /^\d{4}-\d{2}$/.test(state.billingMonth)
    ? state.billingMonth
    : adminLocalDateKey(new Date()).slice(0, 7);
  const branchBillings = operationBranchBillings();
  const operationalMonthBillings = branchBillings.filter((item) => billingOperationalMonthMatches(item, state.billingMonth));
  const revenueMonthBillings = branchBillings.filter((item) => billingMatchesMonth(item, state.billingMonth));
  const groupedOperationalBillings = groupedBillingAttempts(operationalMonthBillings);
  const billingGroups = { action: [], verifying: [], done: [], refund: [] };
  groupedOperationalBillings.forEach((entry) => billingGroups[billingFilterGroup(entry.primary)]?.push(entry));
  const rechargeTargets = operationBranchTickets().filter((ticket) => ticket.remaining <= 1);
  const monthPaidBillings = revenueMonthBillings.filter((item) => item.status === "paid");
  const monthPaidAmount = monthPaidBillings.reduce((sum, item) => sum + Number(item.finalAmount || item.amount || 0), 0);
  const actualPaidBillings = branchBillings.filter((item) => (
    item.status === "paid"
    && billingIncludedInRevenue(item)
    && billingEffectiveDate(item).slice(0, 7) === state.billingMonth
  ));
  const excludedDuplicateBillings = branchBillings.filter((item) => (
    String(item.revenueAttributionStatus || "") === "duplicate_excluded"
    && (billingEffectiveMonth(item) === state.billingMonth || billingEffectiveDate(item).slice(0, 7) === state.billingMonth)
  ));
  const excludedCohortBillings = branchBillings.filter((item) => (
    String(item.revenueAttributionStatus || "") === "cohort_excluded"
    && (billingEffectiveMonth(item) === state.billingMonth || billingEffectiveDate(item).slice(0, 7) === state.billingMonth)
  ));
  const actualPaidAmount = actualPaidBillings.reduce((sum, item) => sum + Number(item.finalAmount || item.amount || 0), 0);

  $("#billingRequestCount").textContent = `${billingGroups.action.length}건`;
  $("#billingCheckCount").textContent = `${billingGroups.verifying.length}건`;
  $("#ticketRechargeCount").textContent = `${rechargeTargets.length}명`;
  if ($("#billingMonthFilter")) $("#billingMonthFilter").value = state.billingMonth;
  if ($("#billingMonthTotalLabel")) $("#billingMonthTotalLabel").textContent = billingMonthLabel(state.billingMonth);
  if ($("#billingMonthPaidAmount")) $("#billingMonthPaidAmount").textContent = `${money.format(monthPaidAmount)}원`;
  if ($("#billingMonthPaidCount")) $("#billingMonthPaidCount").textContent = `매출 귀속 ${monthPaidBillings.length}건`;
  if ($("#billingActualPaidSummary")) {
    const exclusionLabels = [
      excludedDuplicateBillings.length ? `중복 근거 ${excludedDuplicateBillings.length}건` : "",
      excludedCohortBillings.length ? `확정 코호트 외 ${excludedCohortBillings.length}건` : "",
    ].filter(Boolean);
    $("#billingActualPaidSummary").textContent = `실제 결제일 기준 ${actualPaidBillings.length}건 · ${money.format(actualPaidAmount)}원${exclusionLabels.length ? ` · ${exclusionLabels.join(" · ")} 제외` : ""}`;
  }
  renderPaymentAdminGateStatus();
  renderPaymentChargeAudit();
  $$('[data-billing-count]').forEach((count) => {
    count.textContent = String(billingGroups[count.dataset.billingCount]?.length || 0);
  });
  $$('[data-billing-filter]').forEach((button) => button.classList.toggle("is-active", button.dataset.billingFilter === state.billingFilter));

  const syncTarget = $("#serverPaymentSyncStatus");
  if (syncTarget) {
    syncTarget.innerHTML = `
      <div class="payment-sync-card ${serverPaymentSyncState.tone}">
        <span>${serverPaymentSyncState.message}</span>
        ${badge(serverPaymentSyncState.tone, serverPaymentSyncState.loading ? "불러오는 중" : serverPaymentSyncState.loaded ? "확인됨" : "대기")}
      </div>`;
  }

  const filteredBillings = billingGroups[state.billingFilter] || [];
  state.billingPage = normalizeDashboardPage(filteredBillings.length, state.billingPage, billingPageSize);
  const visibleBillings = filteredBillings.slice(
    state.billingPage * billingPageSize,
    (state.billingPage + 1) * billingPageSize,
  );
  $("#billingRows").innerHTML = visibleBillings.length ? visibleBillings
    .map(
      (entry) => {
        const item = entry.primary;
        const index = billings.indexOf(item);
        const approval = paymentApprovalDisplay(item);
        return `
        <tr class="payment-sheet-row ${approval.tone}">
          <td>${badge(approval.tone, approval.label)}<br><small>${escapeHtml(approval.detail)}</small></td>
          <td><strong>${escapeHtml(item.member || "회원")}</strong><br><small>${paymentEnvironmentBadge(item)}</small></td>
          <td>${billingMembershipDetail(item)}${billingAttemptHistoryMarkup(entry)}<details class="payment-source-details"><summary>원본·시도 이력</summary><span>${escapeHtml(item.item || "결제")}${item.providerPaymentId ? ` · ${escapeHtml(item.providerPaymentId)}` : ""}${item.source ? ` · ${escapeHtml(paymentSourceText(item))}` : ""}</span></details></td>
          <td><strong>${money.format(item.amount)}원</strong><br><small>${escapeHtml(paymentMethodLabel(item.method))} · ${escapeHtml(billingEffectiveDate(item) || "일자 미입력")}</small>${item.discountTitle ? `<br><small>${escapeHtml(item.discountTitle)} · ${money.format(item.discountAmount || 0)}원 할인</small>` : ""}</td>
          <td>${paymentConfirmationMarkup(item)}${paymentCancellationAuditDetail(item) ? `<br><small>${escapeHtml(paymentCancellationAuditDetail(item))}</small>` : ""}</td>
          <td class="payment-sheet-approval">${paymentActionFor(item, index)}</td>
          <td class="billing-settlement-cell">${billingSettlementApprovalMarkup(item)}</td>
        </tr>`;
      },
    )
    .join("") : '<tr><td colspan="7" class="empty-text">선택한 달과 상태의 결제 내역이 없습니다.</td></tr>';
  renderDashboardPager("#billingPager", filteredBillings.length, state.billingPage, "billing", billingPageSize);

  state.rechargePage = normalizeDashboardPage(rechargeTargets.length, state.rechargePage, billingPageSize);
  const visibleRechargeTargets = rechargeTargets.slice(
    state.rechargePage * billingPageSize,
    (state.rechargePage + 1) * billingPageSize,
  );
  $("#rechargeRows").innerHTML = visibleRechargeTargets.length ? visibleRechargeTargets
    .map(
      (ticket, index) => `
        <tr>
          <td>${ticket.member}</td>
          <td>${ticket.product}</td>
          <td><strong>${ticket.remaining}회</strong></td>
          <td>${ticket.remaining === 0 ? "즉시 충전 필요" : "다음 수업 전 안내"}</td>
          <td><button class="small-button" type="button" data-renew-ticket="${escapeHtml(ticket.serverTicketId || "")}" data-renew-member="${escapeHtml(ticket.member)}">연장 등록</button></td>
        </tr>`,
    )
    .join("") : '<tr><td colspan="5" class="empty-text">연장 확인이 필요한 회원권이 없습니다.</td></tr>';
  renderDashboardPager("#rechargePager", rechargeTargets.length, state.rechargePage, "recharge", billingPageSize);

  const serverCancellationLogs = operationalMonthBillings
    .map(paymentCancellationAuditLog)
    .filter(Boolean);
  $("#billingLog").innerHTML = [...new Set([...serverCancellationLogs, ...billingLogs])]
    .slice(0, 20)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderPaymentChargeAudit() {
  const target = $("#paymentChargeAudit");
  if (!target) return;
  const tracked = groupedBillingAttempts(billings
    .filter((item) => item.providerPaymentId || item.source === "Supabase 결제"))
    .slice(0, 6);
  target.innerHTML = tracked.length
    ? tracked.map((entry) => {
        const item = entry.primary;
        const status = chargeStatusForPayment(item);
        return `
          <article class="payment-charge-card ${status.tone}">
            <div>
              <span>${escapeHtml(item.member)}</span>
              <strong>${escapeHtml(item.item)}</strong>
              <small>${escapeHtml(status.detail)}</small>
              ${entry.attemptCount > 1 ? `<small class="payment-attempt-summary">${escapeHtml(billingAttemptSummary(entry))}</small>` : ""}
              ${item.ticketId ? `<small>회원권 ${escapeHtml(String(item.ticketId).slice(0, 8))}</small>` : ""}
            </div>
            ${badge(status.tone, status.label)}
          </article>`;
      }).join("")
    : "<p class='empty-text'>서버 결제 기록을 불러오면 회원권 충전 상태가 표시됩니다.</p>";
}

function renderRefundModal() {
  const target = $("#refundModalContent");
  const fallback = $("#refundFallbackConfirmation");
  const message = $("#refundFormMessage");
  const confirmButton = $("#confirmRefundButton");
  const reconcileButton = $("#retryRefundReconcile");
  const cancelManualRequestButton = $("#cancelManualRefundRequest");
  const reasonField = $("#refundReasonField");
  const transferReferenceField = $("#refundTransferReferenceField");
  const item = refundFlowPaymentItem() || {};
  const manualCashRefund = isManualCashRefundItem(item);
  if (!target) return;
  if (refundFlowState.loading) {
    target.innerHTML = `<div class="refund-loading">결제와 이용권 기록을 확인하고 있습니다.</div>`;
  } else if (!refundFlowState.preview) {
    target.innerHTML = `<div class="refund-loading">${escapeHtml(refundFlowState.message || "환불 계산값을 불러오지 못했습니다.")}</div>`;
  } else {
    const preview = refundFlowState.preview;
    const policySource = preview.policySnapshotSource === "current_policy_fallback" ? "현재 정책 기준" : "구매 당시 정책";
    target.innerHTML = `
      <div class="refund-target-summary">
        <div>
          <strong>${escapeHtml(preview.memberName || "회원")} · ${escapeHtml(preview.productName || "회원권")}</strong>
          <span>총 ${numericValue(preview.totalSessions)}회 중 ${numericValue(preview.usedSessions)}회 사용 · 잔여 ${numericValue(preview.remainingSessions)}회</span>
          <small>결제번호 ${escapeHtml(preview.paymentId || "확인 필요")} · ${escapeHtml(policySource)}</small>
        </div>
        ${badge(preview.requiresPolicyFallbackConfirmation ? "warn" : "good", policySource)}
      </div>
      <div class="refund-amount-grid">
        <div><span>실제 결제금액</span><strong>${money.format(numericValue(preview.paidAmount))}원</strong></div>
        <div><span>할인 전 기준금액</span><strong>${money.format(numericValue(preview.originalAmount, preview.paidAmount))}원</strong></div>
        <div><span>사용 회차 차감</span><strong>-${money.format(numericValue(preview.usedAmount))}원</strong></div>
        <div><span>위약금 ${numericValue(preview.penaltyRate)}%</span><strong>-${money.format(numericValue(preview.penaltyAmount))}원</strong></div>
        ${numericValue(preview.reservationFee) ? `<div><span>첫 수업 월 예약금</span><strong>-${money.format(numericValue(preview.reservationFee))}원</strong></div>` : ""}
        <div class="refund-total"><span>최종 환불액</span><strong>${money.format(numericValue(preview.refundAmount))}원</strong></div>
      </div>
      <p class="refund-policy-line">실납부액 - 할인 전 사용 회차 - 할인 전 원가의 위약금 - 첫 수업 월 예약금 · 환불 완료 시 연결 이용권의 잔여 횟수는 0회가 됩니다.</p>
      ${manualCashRefund ? `<div class="refund-fallback-confirmation"><strong>${refundFlowState.manualTransferPending ? "환불 접수됨" : "현금·계좌이체 환불"}</strong><span>${refundFlowState.manualTransferPending ? "실제 송금을 완료한 뒤에만 송금완료를 확인하세요. 그 전에는 이용권 사용이 잠시 정지되고 원데이 자리는 반환됩니다." : "이 버튼은 돈을 자동 송금하지 않습니다. 접수 즉시 이용권 사용을 잠그고, 직접 송금 후 별도로 완료 확인해야 합니다."}</span></div>` : ""}`;
  }
  if (fallback) {
    fallback.hidden = !refundFlowState.preview?.requiresPolicyFallbackConfirmation;
  }
  if (message) {
    message.textContent = refundFlowState.message || "";
    message.className = `form-message ${refundFlowState.tone === "danger" ? "danger" : refundFlowState.tone === "good" ? "good" : ""}`;
  }
  if (confirmButton) {
    confirmButton.disabled = refundFlowState.loading || refundFlowState.submitting || !refundFlowState.preview || refundFlowState.reconcileRequired || refundFlowState.manualPreviewChanged;
    confirmButton.hidden = refundFlowState.reconcileRequired;
    confirmButton.textContent = refundFlowState.submitting
      ? "처리중"
      : refundFlowState.previewNeedsConfirmation
        ? `${money.format(numericValue(refundFlowState.preview?.refundAmount))}원으로 다시 접수`
      : refundFlowState.manualTransferPending
        ? "송금 완료 확인"
        : manualCashRefund
          ? "환불 접수"
          : "환불 확정";
  }
  if (reconcileButton) {
    reconcileButton.hidden = !refundFlowState.reconcileRequired;
    reconcileButton.disabled = refundFlowState.submitting;
  }
  if (cancelManualRequestButton) {
    cancelManualRequestButton.hidden = !refundFlowState.manualTransferPending || refundFlowState.reconcileRequired;
    cancelManualRequestButton.disabled = refundFlowState.submitting;
  }
  if (reasonField) reasonField.hidden = refundFlowState.manualTransferPending;
  if (transferReferenceField) transferReferenceField.hidden = !refundFlowState.manualTransferPending;
}

function renderPaymentCancelModal() {
  const item = billings[paymentCancelFlowState.itemIndex];
  const target = $("#paymentCancelModalContent");
  const message = $("#paymentCancelFormMessage");
  const submitButton = $("#confirmPaymentCancelButton");
  const help = $("#paymentCancelConfirmationHelp");
  const title = $("#paymentCancelModalTitle");
  if (!target || !item) return;
  const isPaid = ["paid", "cancel_reconcile"].includes(item.status);
  const amount = paymentFullCancelAmount(item);
  const phrase = paymentCancelConfirmationPhrase(item);
  if (title) title.textContent = isPaid ? "PG 전액 결제취소" : "결제 대기건 취소";
  target.innerHTML = `
    <div class="refund-target-summary">
      <div>
        <strong>${escapeHtml(item.member || "회원")} · ${escapeHtml(item.item || "결제")}</strong>
        <span>${escapeHtml(paymentMethodLabel(item.method))} · ${escapeHtml(item.statusLabel || item.status || "상태 확인")}</span>
        <small>취소 대상 금액 ${money.format(amount)}원</small>
      </div>
      ${badge(isPaid ? "danger" : "warn", isPaid ? "실제 PG 승인" : "결제 전 대기")}
    </div>
    <p class="payment-cancel-warning">${isPaid ? "일반 환불 계산과 별도로 PG 승인금액 전체를 취소하고 연결 회원권을 비활성화합니다." : "결제가 완료되지 않은 대기 기록을 취소합니다. 실제 결제 여부가 불명확하면 먼저 상태 확인을 실행하세요."}</p>`;
  if (help) help.textContent = `${isPaid ? "실제 PG 승인 전체를 취소" : "결제 대기 기록을 취소"}하려면 ${phrase}를 입력하세요.`;
  if ($("#paymentCancelConfirmationText")) $("#paymentCancelConfirmationText").placeholder = phrase;
  if (message) {
    message.textContent = paymentCancelFlowState.message || "";
    message.className = `form-message ${paymentCancelFlowState.tone === "danger" ? "danger" : paymentCancelFlowState.tone === "good" ? "good" : ""}`;
  }
  if (submitButton) {
    submitButton.disabled = paymentCancelFlowState.submitting;
    submitButton.textContent = paymentCancelFlowState.submitting ? "취소 처리 중" : `${phrase} 실행`;
  }
  [$("#closePaymentCancelModal"), $("#dismissPaymentCancelModal")].forEach((button) => {
    if (button) button.disabled = paymentCancelFlowState.submitting;
  });
}

function renderRefundPolicySettings() {
  if (state.view !== "settings") return;
  const target = $("#refundPolicySettings");
  if (!target) return;
  const settings = normalizeRefundPolicySettings(refundPolicySettings);
  target.innerHTML = `
    <article class="refund-policy-summary">
      <div>
        <strong>기존 운영 환불 기준</strong>
        <span>할인 전 사용 회차 · 위약금 ${settings.penaltyRate}% · 첫 수업 월 예약금 차감</span>
      </div>
      ${badge("ready", `위약금 ${settings.penaltyRate}%`)}
    </article>
    <div class="refund-policy-grid">
      <label>
        <small>회원 사유 위약금</small>
        <input id="refundPenaltyRate" type="number" min="0" max="10" step="1" value="${settings.penaltyRate}" />
        <small>할인 전 원가의 비율(최대 10%)</small>
      </label>
      <label>
        <small>첫 수업 월 예약금</small>
        <input id="refundReservationFee" type="number" min="0" step="1000" value="${settings.reservationFee}" />
        <small>첫 수업이 속한 달에만 차감</small>
      </label>
      <label class="refund-policy-memo">
        <small>관리자 메모</small>
        <textarea id="refundPolicyMemo" rows="2">${escapeHtml(settings.memo)}</textarea>
      </label>
    </div>
    <div class="discount-action-row">
      <button class="small-button" type="button" id="saveRefundPolicyButton">환불정책 저장</button>
      <button class="ghost-button" type="button" id="resetRefundPolicyButton">기본값 복원</button>
    </div>
    <details class="policy-history-disclosure">
      <summary>분쟁 발생 시 관리자 검토 기준</summary>
      <p class="setting-help">일반 환불 화면에는 노출하지 않고, 분쟁이 생긴 경우에만 관련 법령과 소비자분쟁해결기준을 확인합니다.</p>
    </details>`;
}

function renderPaymentSetup() {
  const target = $("#paymentSetupPanel");
  if (!target) return;
  const config = paymentGatewayConfig();
  const ready = isPaymentGatewayReady();
  const bankAccount = branchPaymentAccount || {};
  const bankReady = branchPaymentAccountStatus === "loaded"
    && bankAccount.is_enabled === true
    && Boolean(bankAccount.bank_name && bankAccount.account_number && bankAccount.account_holder);
  target.innerHTML = `
    <article class="payment-setup-card ${ready ? "ready" : "setup"}">
      <div class="payment-setup-summary">
        <div>
          <strong>${ready ? "결제창 연결값 준비됨" : "결제창 연결값 대기"}</strong>
          <span>${ready ? "회원앱 결제 버튼이 PortOne 결제창을 열 수 있습니다. 서버 검증과 웹훅은 다음 단계입니다." : "Store ID와 Channel Key를 입력하면 같은 브라우저의 회원앱 결제 버튼이 연결됩니다."}</span>
        </div>
        ${badge(ready ? "ready" : "pending", ready ? "결제창 준비" : "설정 대기")}
      </div>
      <div class="product-setting-fields payment-setting-fields">
        <label>
          <small>PortOne Store ID</small>
          <input id="paymentStoreId" type="text" autocomplete="off" placeholder="store-..." value="${escapeHtml(config.storeId || "")}" />
        </label>
        <label>
          <small>Channel Key</small>
          <input id="paymentChannelKey" type="text" autocomplete="off" placeholder="channel-key" value="${escapeHtml(config.channelKey || "")}" />
        </label>
      </div>
      <div class="payment-server-checklist">
        <div>
          <b>관리자 화면에 입력</b>
          <span>Store ID, Channel Key</span>
        </div>
        <div>
          <b>서버 환경값으로만 보관</b>
          <span>API Secret, Webhook Secret</span>
        </div>
        <div>
          <b>다음 검증</b>
          <span>결제창 열기 → 서버 검증 → 웹훅으로 회원권 충전</span>
        </div>
      </div>
      <div class="payment-setup-actions">
        <button class="small-button" type="button" id="savePaymentConfigButton">저장</button>
        <button class="ghost-button" type="button" id="clearPaymentConfigButton">삭제</button>
      </div>
      <small>이 값은 이 브라우저의 로컬 저장소에만 저장됩니다. Git 커밋에는 포함되지 않습니다.</small>
    </article>
    <article class="payment-setup-card branch-bank-account-card ${bankReady ? "ready" : "setup"}">
      <div class="payment-setup-summary">
        <div>
          <strong>계좌이체 입금 계좌</strong>
          <span>${branchPaymentAccountStatus === "loading"
            ? "서버 설정을 불러오는 중입니다."
            : branchPaymentAccountStatus === "failed"
              ? "계좌 설정 테이블 또는 관리자 권한을 확인해 주세요."
              : bankReady
                ? "결제 대기건을 정상 생성한 회원에게만 이 계좌가 표시됩니다."
                : "계좌를 저장하고 사용을 켜야 회원앱에서 계좌이체를 선택할 수 있습니다."}</span>
        </div>
        ${badge(bankReady ? "ready" : "pending", bankReady ? "사용 중" : "사용 전")}
      </div>
      <div class="product-setting-fields payment-setting-fields branch-bank-account-fields">
        <label><small>은행명</small><input id="branchBankName" type="text" maxlength="40" autocomplete="off" value="${escapeHtml(bankAccount.bank_name || "")}" placeholder="예: 우리은행" /></label>
        <label><small>계좌번호</small><input id="branchBankAccountNumber" type="text" maxlength="32" inputmode="numeric" autocomplete="off" value="${escapeHtml(bankAccount.account_number || "")}" placeholder="숫자와 하이픈만 입력" /></label>
        <label><small>예금주</small><input id="branchBankAccountHolder" type="text" maxlength="60" autocomplete="off" value="${escapeHtml(bankAccount.account_holder || "")}" /></label>
        <label><small>입금기한</small><select id="branchBankDepositDeadlineHours"><option value="12" ${Number(bankAccount.deposit_deadline_hours || 24) === 12 ? "selected" : ""}>12시간</option><option value="24" ${Number(bankAccount.deposit_deadline_hours || 24) === 24 ? "selected" : ""}>24시간</option><option value="48" ${Number(bankAccount.deposit_deadline_hours || 24) === 48 ? "selected" : ""}>48시간</option><option value="72" ${Number(bankAccount.deposit_deadline_hours || 24) === 72 ? "selected" : ""}>72시간</option></select></label>
        <label class="branch-bank-account-toggle"><small>회원앱 사용</small><span><input id="branchBankTransferEnabled" type="checkbox" ${bankAccount.is_enabled === true ? "checked" : ""} /> 계좌이체 선택 허용</span></label>
        <label class="branch-bank-account-instructions"><small>입금 안내</small><textarea id="branchBankTransferInstructions" rows="2" maxlength="300" placeholder="예: 신청자 이름으로 입금해 주세요.">${escapeHtml(bankAccount.transfer_instructions || "")}</textarea></label>
      </div>
      ${bankNotificationStatusMarkup()}
      <div class="payment-setup-actions">
        <small>금액·입금자·기한이 한 주문과 정확히 일치할 때만 자동 확인합니다. 일부·초과·지연·중복 후보는 관리자 확인 후 회원권을 1회만 발급합니다.</small>
        <button class="small-button" type="button" id="saveBranchPaymentAccountButton">계좌 저장</button>
      </div>
    </article>`;
}

function billingAttemptHistoryMarkup(entry = {}) {
  if (Number(entry.attemptCount || 0) <= 1) return "";
  const rows = (entry.attempts || []).map((attempt) => {
    const display = paymentDisplayStatus(attempt);
    const date = paymentAuditDateTimeLabel(attempt.requestedAt || attempt.createdAt) || "시각 확인 필요";
    return `<li>${escapeHtml(date)} · ${escapeHtml(paymentMethodLabel(attempt.method))} · ${escapeHtml(display.label)}</li>`;
  }).join("");
  return `<details class="payment-attempt-details"><summary>${escapeHtml(billingAttemptSummary(entry))}</summary><ul>${rows}</ul></details>`;
}

function paymentPendingMoreActions(item, index) {
  const action = paymentCancelButtonFor(index, "대기취소");
  return action ? `<details class="payment-row-more"><summary>기타</summary>${action}</details>` : "";
}

function paymentApprovedMoreActions(item, index) {
  const actions = `${paymentFullCancelButtonFor(item, index)}${paymentRefundButtonFor(item, index)}`;
  return actions ? `<details class="payment-row-more"><summary>취소·환불</summary>${actions}</details>` : "";
}

function paymentConfirmationMarkup(item = {}) {
  const paidAt = paymentAuditDateTimeLabel(item.verifiedAt || item.paidAt);
  if (item.status === "paid") return `${badge("good", "결제 확인됨")}${paidAt ? `<br><small>${escapeHtml(paidAt)}</small>` : ""}`;
  if (item.status === "server_ready" && String(item.method || "").toLowerCase() === "bank_transfer") {
    const depositor = item.depositorName ? ` · ${escapeHtml(item.depositorName)}` : "";
    return `${badge("warn", "직접 입금 확인")}${depositor ? `<br><small>${depositor}</small>` : ""}`;
  }
  if (["check", "unverified"].includes(item.status)) return badge("warn", "결제사 확인 필요");
  if (item.status === "server_ready") return badge("neutral", "결제 전");
  if (item.status === "failed") return badge("danger", "실패");
  if (["cancelled", "refunded"].includes(item.status)) return badge("neutral", "취소·환불 완료");
  return badge("neutral", "확인 대기");
}

function billingSettlementApprovalMarkup(item = {}) {
  if (item.status !== "paid") return '<span class="billing-settlement-pending">승인 후 자동계산</span>';
  if (paymentRequiresTicketRepair(item)) return '<span class="payment-link-warning">회원권 연결 후 계산</span>';
  const rows = settlementRowsForBilling(item);
  const amount = rows.reduce((sum, row) => sum + settlementAmountFor(row), 0);
  const coachNames = [...new Set(rows.map((row) => settlementCoachNameFor(row)).filter(Boolean))];
  const summaries = [...new Set(rows.map((row) => settlementRuleSummary(settlementRuleFor(settlementCoachNameFor(row)))))]
    .filter(Boolean);
  return `<strong>${money.format(amount)}원</strong><br><small>${escapeHtml(coachNames.join(" · ") || "코치 확인 필요")}${summaries.length ? ` · ${escapeHtml(summaries.join(" / "))}` : ""}</small>`;
}

function memberTicketPaymentStatusMarkup(paymentGrid) {
  return `<span class="member-payment-status is-${escapeHtml(paymentGrid.tone || "neutral")}" title="${escapeHtml(paymentGrid.detail || "")}">
    <strong>${escapeHtml(paymentGrid.label || "결제 확인")}</strong>
    <small>${escapeHtml(paymentGrid.method || "미입력")}</small>
  </span>`;
}
