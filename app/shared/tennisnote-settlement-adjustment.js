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
    for (const key of ["totalSettlementAmount", "ownSettlementAmount", "substituteSettlementAmount", "substituteSessionCount", "revenueAmount", "settledSessions", "settledMinutes", "paymentCount"]) {
      if (!Number.isSafeInteger(value.totals?.[key]) || value.totals[key] < 0) throw new Error("settlement_total_invalid");
    }
    if (value.totals.ownSettlementAmount + value.totals.substituteSettlementAmount !== value.totals.totalSettlementAmount) {
      throw new Error("settlement_split_total_mismatch");
    }
    const policyV2 = value.sourceManifest?.substituteContractVersion === "r3_substitute_policy_v2";
    if (!policyV2 && value.sourceManifest?.substituteContractVersion !== "r3_substitute_safe_v1"
      && value.lines.some((line) => line.lineKind === "substitute_session")) {
      throw new Error("settlement_substitute_contract_unknown");
    }
    if (policyV2 && (!Number.isSafeInteger(value.totals?.branchSubstituteExpenseAmount)
      || value.totals.branchSubstituteExpenseAmount < 0
      || value.totals.branchSubstituteExpenseAmount > value.totals.substituteSettlementAmount)) {
      throw new Error("settlement_branch_expense_total_invalid");
    }
    const lineIndexes = new Set();
    const contributions = new Set();
    const physicalSources = new Map();
    const split = { own_payment: 0, substitute_session: 0 };
    let branchExpense = 0;
    for (const line of value.lines) {
      if (!Number.isSafeInteger(line.lineIndex) || line.lineIndex <= 0 || lineIndexes.has(line.lineIndex)
        || !Object.hasOwn(split, line.lineKind)
        || !Number.isSafeInteger(line.settlementAmount) || line.settlementAmount < 0) {
        throw new Error("settlement_line_scope_mismatch");
      }
      lineIndexes.add(line.lineIndex);
      for (const key of ["settledSessions", "settledMinutes", "totalSessions", "netAmount"]) {
        if (!Number.isSafeInteger(line[key]) || line[key] < 0) throw new Error("settlement_line_scope_mismatch");
      }
      if (line.lineKind === "substitute_session" && (!line.sourceLessonId || !line.sourceSessionId || !line.sourceSubstituteAssignmentId)) {
        throw new Error("settlement_substitute_source_missing");
      }
      if (line.lineKind === "substitute_session") {
        const components = line.calculationComponents;
        const key = components?.physicalKey;
        // Server UUID/date/time keys are bounded; never normalize distinct source handles.
        if (typeof key !== "string" || !key || key.length > 512 || key !== key.trim()
          || /[\u0000-\u001f\u007f]/.test(key) || !Array.isArray(components.contributions)) {
          throw new Error("settlement_substitute_physical_key_invalid");
        }
        const source = physicalSources.get(key) || {
          lessonId: line.sourceLessonId, assignmentId: line.sourceSubstituteAssignmentId,
          payable: false, nonPayable: false,
        };
        if (source.lessonId !== line.sourceLessonId || source.assignmentId !== line.sourceSubstituteAssignmentId) {
          throw new Error("settlement_substitute_physical_source_conflict");
        }
        const exactSession = policyV2
          ? (value.sourceManifest.sessions || []).filter((item) => item.id === line.sourceSessionId)
          : [];
        if (policyV2 && (exactSession.length !== 1 || exactSession[0].lessonId !== line.sourceLessonId
          || exactSession[0].substituteAssignmentId !== line.sourceSubstituteAssignmentId
          || exactSession[0].accountingClass !== components.accountingClass)) {
          throw new Error("settlement_substitute_accounting_source_mismatch");
        }
        const excludedLesson = policyV2 && components.nonPayableDecision === true;
        if (excludedLesson) {
          const session = exactSession[0];
          const expectedReason = session.substitutePolicy === "none" ? "explicit_no_settlement"
            : session.substitutePolicy === "originalCoach" ? "recipient_original_coach" : null;
          const expectedClass = session.substitutePolicy === "none" ? "explicit_no_settlement"
            : session.substitutePolicy === "originalCoach" ? "original_coach_settlement" : null;
          // 서버의 정확한 override 계약: none은 수령자 없음, actual_coach는 원코치 귀속 가능.
          // 모드와 정책이 모순되면 0원 근거로 표시하지 않는다.
          const expectedMode = session.substitutePolicy === "none" ? "none"
            : session.substitutePolicy === "originalCoach" ? "actual_coach" : null;
          const expectedKey = [session.groupAccountId || session.lessonId, session.coachRoleId,
            session.lessonDate, session.startTime].join("|");
          if (!expectedReason || session.outcome !== "completed"
            || session.coachRoleId !== scope.coachRoleId
            || session.substituteSettlementMode !== expectedMode
            || session.recipientCoachRoleId === scope.coachRoleId
            || (session.substitutePolicy === "none" && session.recipientCoachRoleId !== null)
            || (session.substitutePolicy === "originalCoach"
              && (!session.originalCoachRoleId || session.recipientCoachRoleId !== session.originalCoachRoleId))
            || components.accountingClass !== expectedClass || key !== expectedKey
            || (components.nonPayableReason !== expectedReason
              && !(components.duplicateSharedTime === true && components.nonPayableReason == null))) {
            throw new Error("settlement_substitute_nonpayable_reason_invalid");
          }
        }
        if (components.duplicateSharedTime === true || excludedLesson) {
          if (line.settlementAmount !== 0 || line.settledSessions !== 0 || line.settledMinutes !== 0
            || components.contributions.length !== 0) {
            throw new Error("settlement_substitute_duplicate_trace_invalid");
          }
          if (excludedLesson) source.nonPayable = true;
        } else {
          if (line.settledSessions <= 0 || components.contributions.length === 0
            || components.contributions.some((item) => !item || item.sessionId !== line.sourceSessionId
              || item.lessonId !== line.sourceLessonId || item.substituteAssignmentId !== line.sourceSubstituteAssignmentId)) {
            throw new Error("settlement_substitute_payable_source_invalid");
          }
          source.payable = true; // A valid occurrence can have a legitimate zero-won payout.
          if (policyV2 && components.accountingClass === "branch_substitute_expense") {
            branchExpense += line.settlementAmount;
          }
        }
        physicalSources.set(key, source);
      }
      for (const item of line.calculationComponents?.contributions || []) {
        const key = item.sessionId ? `session:${item.sessionId}` : item.paymentId ? `payment:${item.paymentId}` : "";
        if (!key || contributions.has(key)) throw new Error("settlement_contribution_duplicate_or_missing");
        contributions.add(key);
      }
      split[line.lineKind] += line.settlementAmount;
    }
    if ([...physicalSources.values()].some((source) => source.payable === source.nonPayable
      || (!source.payable && !policyV2))) {
      throw new Error("settlement_substitute_duplicate_trace_orphan");
    }
    if ([...physicalSources.values()].filter((source) => source.payable).length !== value.totals.substituteSessionCount) {
      throw new Error("settlement_substitute_physical_count_mismatch");
    }
    if (policyV2 && branchExpense !== value.totals.branchSubstituteExpenseAmount) {
      throw new Error("settlement_branch_expense_total_mismatch");
    }
    if (split.own_payment !== value.totals.ownSettlementAmount || split.substitute_session !== value.totals.substituteSettlementAmount) {
      throw new Error("settlement_split_line_mismatch");
    }
    if (value.lines.reduce((sum, line) => sum + Number(line.settlementAmount), 0) !== value.totals.totalSettlementAmount) {
      throw new Error("settlement_line_total_mismatch");
    }
    const ticketById = new Map(value.sourceManifest.tickets.map((ticket) => [ticket.id, ticket]));
    if (ticketById.size !== value.sourceManifest.tickets.length || ticketById.has(undefined) || ticketById.has(null)) {
      throw new Error("settlement_ticket_source_ambiguous");
    }
    return {
      ...value, coachRoleId: scope.coachRoleId, branchId: scope.branchId,
      confirmationReady: value.confirmationReady === true,
      month: scope.settlementMonth.slice(0, 7), ruleType: "effective_periods",
      estimatedSettlement: value.totals.totalSettlementAmount,
      ownSettlement: value.totals.ownSettlementAmount,
      substituteSettlement: value.totals.substituteSettlementAmount,
      branchSubstituteExpense: policyV2 ? value.totals.branchSubstituteExpenseAmount : 0,
      substituteSessionCount: value.totals.substituteSessionCount,
      revenueAmount: value.totals.revenueAmount, settledSessions: value.totals.settledSessions,
      paymentCount: value.totals.paymentCount, settledMinutes: value.totals.settledMinutes,
      rows: value.lines.map((line) => {
        const ticket = ticketById.get(line.sourceTicketId);
        const session = policyV2 ? (value.sourceManifest.sessions || []).find((item) => item.id === line.sourceSessionId) : null;
        if (!ticket || !Number.isSafeInteger(line.settlementAmount) || line.settlementAmount < 0) {
          throw new Error("settlement_line_scope_mismatch");
        }
        if (line.lineKind === "own_payment" && ticket.coachRoleId !== scope.coachRoleId) {
          throw new Error("settlement_line_scope_mismatch");
        }
        if (line.lineKind === "substitute_session") {
          const exact = (value.sourceManifest.assignments || []).filter((item) => item.id === line.sourceSubstituteAssignmentId);
          if (exact.length !== 1
            || exact[0].lessonId !== line.sourceLessonId || exact[0].branchId !== scope.branchId
            || exact[0].substituteCoachRoleId !== scope.coachRoleId || exact[0].originalCoachRoleId !== ticket.coachRoleId
            || !["assigned", "completed"].includes(exact[0].status)
            || (policyV2
              ? !["actual_coach", "hourly", "none"].includes(exact[0].settlementMode)
                || !session || session.substituteSettlementMode !== exact[0].settlementMode
                || (line.calculationComponents?.nonPayableDecision === true
                  ? session.recipientCoachRoleId === scope.coachRoleId
                  : session.recipientCoachRoleId !== scope.coachRoleId)
              : exact[0].settlementMode !== "actual_coach")) {
            throw new Error("settlement_substitute_source_mismatch");
          }
        }
        return { ticketId: ticket.id, userId: ticket.userId, coachRoleId: scope.coachRoleId,
          lineKind: line.lineKind, sourceLessonId: line.sourceLessonId,
          sourceSessionId: line.sourceSessionId, sourceSubstituteAssignmentId: line.sourceSubstituteAssignmentId,
          sourceIds: line.sourceIds,
          estimatedSettlement: line.settlementAmount, settledSessions: line.settledSessions,
          settledMinutes: line.settledMinutes, totalSessions: line.totalSessions,
          amount: line.netAmount, memberName: "회원권별 계산 근거", productName: "적용일별 정산",
          method: line.lineKind === "substitute_session"
            ? line.calculationComponents?.accountingClass === "branch_substitute_expense"
              ? "대타 · 지점 별도 비용 · 적용일별 조건"
              : line.calculationComponents?.nonPayableDecision === true
                ? (line.calculationComponents?.nonPayableReason === "recipient_original_coach"
                  || (line.calculationComponents?.nonPayableReason == null && session?.substitutePolicy === "originalCoach"))
                  ? "대타 · 원코치 귀속 · 0원 근거"
                  : "대타 · 지급 제외 · 0원 근거"
                : "대타 · 실제 진행 코치 · 적용일별 조건"
            : line.sourcePaymentId ? "결제 근거 보존" : "미입금 포함 · 시간제",
          calculationComponents: line.calculationComponents };
      }),
    };
  }

  function effectiveError(error) {
    const code = String(error?.payload?.message || error?.message || "");
    if (/lock timeout|lock_not_available|55P03/.test(code)) return "정산 근거가 변경 중입니다. 잠시 후 다시 확인해 주세요. 이번 계산은 확정하지 않았습니다.";
    if (code.includes("settlement_hold_substitute_")) return "대타 확인 필요: 배정·적용기간·지급 기준 또는 승인 근거를 확인해 주세요. 임의 금액은 계산하지 않았습니다.";
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
