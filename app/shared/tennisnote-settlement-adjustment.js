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

  global.TennisNoteSettlementAdjustment = Object.freeze({
    paymentAmounts,
    isIncluded,
  });
})(window);
