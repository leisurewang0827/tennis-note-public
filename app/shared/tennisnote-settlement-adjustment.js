(function attachTennisNoteSettlementAdjustment(global) {
  "use strict";

  function money(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function normalized(value) {
    return String(value || "").trim().toLowerCase();
  }

  function paymentAmounts(payment = {}) {
    const grossAmount = money(payment.finalAmount ?? payment.final_amount ?? payment.amount);
    const refundedAmount = Math.min(
      grossAmount,
      money(payment.refundedAmount ?? payment.refunded_amount),
    );
    const netAmount = Math.max(0, grossAmount - refundedAmount);
    const originalSettlementBase = money(
      payment.settlementBaseAmount
        ?? payment.settlement_base_amount
        ?? payment.settlementBase
        ?? grossAmount,
    );
    const settlementBase = grossAmount > 0
      ? Math.round(originalSettlementBase * netAmount / grossAmount)
      : 0;
    return {
      grossAmount,
      refundedAmount,
      netAmount,
      originalSettlementBase,
      settlementBase,
      refundAdjusted: refundedAmount > 0,
    };
  }

  function isIncluded(payment = {}) {
    const status = normalized(payment.serverStatus || payment.status);
    const refundStatus = normalized(payment.refundStatus || payment.refund_status);
    if (["processing", "reconcile_required"].includes(refundStatus)) return false;
    const amounts = paymentAmounts(payment);
    return ["paid", "verified", "refunded"].includes(status) && amounts.netAmount > 0;
  }

  // Projection only: formulas and rounding belong to the server calculator.
  function effectiveProjection(value, scope) {
    if (!value?.ok || value.calculationVersion !== "r3_effective_settlement_v2"
      || value.scope?.branchId !== scope.branchId || value.scope?.coachRoleId !== scope.coachRoleId
      || value.scope?.settlementMonth !== scope.settlementMonth
      || !/^[0-9a-f]{64}$/.test(value.sourceFingerprint || "")
      || !Array.isArray(value.lines) || !Array.isArray(value.sourceManifest?.tickets)) {
      throw new Error("settlement_scope_or_version_mismatch");
    }
    for (const key of ["totalSettlementAmount", "revenueAmount", "settledSessions", "settledMinutes", "paymentCount"]) {
      if (!Number.isSafeInteger(value.totals?.[key]) || value.totals[key] < 0) throw new Error("settlement_total_invalid");
    }
    if (value.lines.reduce((sum, line) => sum + Number(line.settlementAmount), 0) !== value.totals.totalSettlementAmount) {
      throw new Error("settlement_line_total_mismatch");
    }
    const ticketById = new Map(value.sourceManifest.tickets.map((ticket) => [ticket.id, ticket]));
    return {
      ...value, coachRoleId: scope.coachRoleId, branchId: scope.branchId,
      confirmationReady: value.confirmationReady === true,
      month: scope.settlementMonth.slice(0, 7), ruleType: "effective_periods",
      estimatedSettlement: value.totals.totalSettlementAmount,
      revenueAmount: value.totals.revenueAmount, settledSessions: value.totals.settledSessions,
      paymentCount: value.totals.paymentCount, settledMinutes: value.totals.settledMinutes,
      rows: value.lines.map((line) => {
        const ticket = ticketById.get(line.sourceTicketId);
        if (!ticket || !Number.isSafeInteger(line.settlementAmount) || line.settlementAmount < 0) {
          throw new Error("settlement_line_scope_mismatch");
        }
        return { ticketId: ticket.id, userId: ticket.userId, coachRoleId: scope.coachRoleId,
          estimatedSettlement: line.settlementAmount, settledSessions: line.settledSessions,
          settledMinutes: line.settledMinutes, totalSessions: line.totalSessions,
          amount: line.netAmount, memberName: "회원권별 계산 근거", productName: "적용일별 정산",
          method: line.sourcePaymentId ? "결제 근거 보존" : "미입금 포함 · 시간제",
          calculationComponents: line.calculationComponents };
      }),
    };
  }

  function effectiveError(error) {
    const code = String(error?.payload?.message || error?.message || "");
    if (/lock timeout|lock_not_available|55P03/.test(code)) return "정산 근거가 변경 중입니다. 잠시 후 다시 확인해 주세요. 이번 계산은 확정하지 않았습니다.";
    if (code.includes("settlement_hold_")) return "확인 필요: 구매·수업·적용기간 또는 환불 조정 근거를 확인해 주세요. 임의 금액은 계산하지 않았습니다.";
    if (/scope|forbidden|authentication/.test(code)) return "현재 지점과 코치 권한을 다시 확인해 주세요.";
    return "정산 자료를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.";
  }

  global.TennisNoteSettlementAdjustment = Object.freeze({
    paymentAmounts,
    isIncluded,
    effectiveProjection,
    effectiveError,
  });
})(window);
