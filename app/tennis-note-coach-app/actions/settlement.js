// 관리자 확정 정산에 대한 코치 응답을 처리하는 함수들.
//
// exact scope와 operation key를 유지하고 RPC 응답 뒤 서버 상태를 다시 읽는다.

function resetCoachSettlementReconciliation() {
  state.coachSettlementReconciliationRequestId += 1;
  state.coachSettlementReconciliation = null;
  state.coachSettlementReconciliationUiState = "EMPTY";
  state.coachSettlementReconciliationLoading = false;
  state.coachSettlementReconciliationSubmitting = false;
  state.coachSettlementReconciliationMessage = "";
  state.coachSettlementReconciliationValidation = "";
  state.coachSettlementReconciliationChoice = "";
  state.coachSettlementReconciliationReason = "";
  state.coachSettlementReconciliationOperation = null;
}

function coachSettlementReconciliationOperationKey(expected, targetStatus, targetReason) {
  const signature = [
    expected.confirmationId,
    expected.snapshotId,
    expected.revision,
    expected.sourceFingerprint,
    targetStatus,
    targetReason,
  ].join(":");
  if (state.coachSettlementReconciliationOperation?.signature !== signature) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.coachSettlementReconciliationOperation = {
      signature,
      key: `settlement-coach-response:${expected.confirmationId}:${random}`.slice(0, 120),
    };
  }
  return state.coachSettlementReconciliationOperation.key;
}

function finishCoachSettlementReconciliation(readback, recoveredAfterResponseLoss = false) {
  state.coachSettlementReconciliation = readback;
  state.coachSettlementReconciliationUiState = String(readback.state || "").toUpperCase();
  state.coachSettlementReconciliationMessage = recoveredAfterResponseLoss
    ? "응답이 끊겼지만 서버 기록을 다시 읽어 완료 상태를 확인했습니다."
    : state.coachSettlementReconciliationUiState === "DISPUTED"
      ? "이의 사유를 관리자에게 전달했습니다."
      : "관리자 확정 정산을 확인했다고 응답했습니다.";
  state.coachSettlementReconciliationValidation = "";
  state.coachSettlementReconciliationChoice = "";
  state.coachSettlementReconciliationReason = "";
  state.coachSettlementReconciliationOperation = null;
}

async function submitCoachSettlementReconciliation() {
  if (state.coachSettlementReconciliationSubmitting || state.coachSettlementReconciliationLoading) return false;
  const scope = coachSettlementReconciliationScope();
  const payload = state.coachSettlementReconciliation;
  const targetStatus = String(state.coachSettlementReconciliationChoice || "");
  const targetReason = targetStatus === "disputed"
    ? normalizeCoachSettlementReconciliationReason(state.coachSettlementReconciliationReason)
    : "";
  if (
    state.coachSettlementReconciliationUiState !== "PENDING"
    || !coachSettlementReconciliationPayloadIsExact(payload, scope)
    || payload.reconciliation
  ) return false;
  if (!["acknowledged", "disputed"].includes(targetStatus)) {
    state.coachSettlementReconciliationValidation = "확인 또는 이의 중 하나를 선택해 주세요.";
    renderCoachSettlementReconciliation();
    return false;
  }
  const reasonError = targetStatus === "disputed" ? coachSettlementReconciliationReasonError(targetReason) : "";
  if (reasonError) {
    state.coachSettlementReconciliationValidation = reasonError;
    renderCoachSettlementReconciliation();
    $("#coachSettlementReconciliationReason")?.focus();
    return false;
  }
  const expected = {
    confirmationId: payload.confirmation.confirmationId,
    snapshotId: payload.snapshot.snapshotId,
    revision: Number(payload.snapshot.revision),
    sourceFingerprint: payload.snapshot.sourceFingerprint,
  };
  const operationKey = coachSettlementReconciliationOperationKey(expected, targetStatus, targetReason);
  const submitRequestId = ++state.coachSettlementReconciliationRequestId;
  const submitScopeSignature = coachSettlementReconciliationScopeSignature(scope);
  const submitIsCurrent = () => submitRequestId === state.coachSettlementReconciliationRequestId
    && submitScopeSignature === coachSettlementReconciliationScopeSignature();
  state.coachSettlementReconciliationSubmitting = true;
  state.coachSettlementReconciliationMessage = "확정 계산본과 담당 범위를 서버에서 다시 확인하고 있습니다.";
  state.coachSettlementReconciliationValidation = "";
  renderCoachSettlementReconciliation();
  try {
    const rawResponse = await window.TennisNoteDataClient.rpc("tn_coach_respond_monthly_settlement_confirmation", {
      target_confirmation_id: expected.confirmationId,
      target_snapshot_id: expected.snapshotId,
      target_branch_id: scope.branchId,
      target_coach_role_id: scope.coachRoleId,
      target_month: scope.settlementMonth,
      expected_snapshot_revision: expected.revision,
      expected_source_fingerprint: expected.sourceFingerprint,
      target_status: targetStatus,
      target_reason: targetReason || null,
      target_operation_key: operationKey,
    });
    const response = Array.isArray(rawResponse) ? rawResponse[0] || null : rawResponse;
    if (!submitIsCurrent()) return false;
    if (!coachSettlementReconciliationResponseMatches(response, expected, targetStatus, targetReason, scope)) {
      throw new Error("settlement_reconciliation_response_mismatch");
    }
    const rawReadback = await readCoachSettlementReconciliation(scope);
    const readback = Array.isArray(rawReadback) ? rawReadback[0] || null : rawReadback;
    if (!submitIsCurrent()) return false;
    if (!coachSettlementReconciliationResponseMatches(readback, expected, targetStatus, targetReason, scope)) {
      throw new Error("settlement_reconciliation_readback_mismatch");
    }
    finishCoachSettlementReconciliation(readback, false);
    return true;
  } catch (error) {
    if (!submitIsCurrent()) return false;
    let recovered = null;
    try {
      const rawRecovered = await readCoachSettlementReconciliation(scope);
      recovered = Array.isArray(rawRecovered) ? rawRecovered[0] || null : rawRecovered;
    } catch (_) {
      recovered = null;
    }
    if (!submitIsCurrent()) return false;
    if (coachSettlementReconciliationResponseMatches(recovered, expected, targetStatus, targetReason, scope)) {
      finishCoachSettlementReconciliation(recovered, true);
      return true;
    }
    if (
      recovered
      && coachSettlementReconciliationPayloadIsExact(recovered, scope)
      && ["ACKNOWLEDGED", "DISPUTED"].includes(String(recovered.state || "").toUpperCase())
    ) {
      state.coachSettlementReconciliation = recovered;
      state.coachSettlementReconciliationUiState = "CONFLICT";
      state.coachSettlementReconciliationMessage = "다른 화면에서 이미 응답했습니다. 서버에 저장된 상태를 다시 확인해 주세요.";
      state.coachSettlementReconciliationValidation = "";
      state.coachSettlementReconciliationChoice = "";
      state.coachSettlementReconciliationReason = "";
      state.coachSettlementReconciliationOperation = null;
      return false;
    }
    if (recovered && coachSettlementReconciliationPayloadIsExact(recovered, scope)) {
      state.coachSettlementReconciliation = recovered;
    }
    const contract = coachSettlementReconciliationErrorContract(error);
    state.coachSettlementReconciliationUiState = contract.state;
    state.coachSettlementReconciliationMessage = contract.message;
    state.coachSettlementReconciliationValidation = contract.validation;
    return false;
  } finally {
    if (submitIsCurrent()) {
      state.coachSettlementReconciliationSubmitting = false;
      renderCoachSettlementReconciliation();
      saveSnapshot();
    }
  }
}
