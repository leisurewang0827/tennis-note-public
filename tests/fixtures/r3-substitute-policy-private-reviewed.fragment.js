const r3SubstituteDecisionUi = { preview: null, context: null, scope: null, recipient: "", operationKey: "", busy: false, message: "" };

function r3SubstituteDecisionCandidate(context, decision, scope = r3SubstituteDecisionUi.scope) {
  if (!decision || effectiveSettlementPreview.context !== context
    || !effectiveSettlementPreviewContextIsCurrent(context) || effectiveSettlementPreview.loading
    || !scope || scope.branchId !== activeOperationBranchId()
    || String(scope.settlementMonth || "").slice(0, 7) !== state.billingMonth
    || ![decision.originalCoachRoleId, decision.actualCoachRoleId].includes(scope.coachRoleId)) return null;
  const matches = effectiveSettlementPreview.results
    .filter((entry) => entry.coach.serverRoleId === scope.coachRoleId)
    .flatMap((entry) => (entry.candidates || [])
    .filter((candidate) => entry.coach.serverRoleId === candidate.coachRoleId
      && candidate.coachRoleId === scope.coachRoleId && candidate.settlementMonth === scope.settlementMonth
      && candidate.id === decision.assignmentId && candidate.branchId === decision.branchId
      && candidate.branchId === scope.branchId
      && candidate.branchId === activeOperationBranchId()
      && String(candidate.serviceDate || "").slice(0, 7) === state.billingMonth
      && candidate.lessonId === decision.lessonId
      && Number(candidate.lessonRevision) === Number(decision.lessonRevision)
      && candidate.sourceFingerprint === decision.sourceFingerprint
      && candidate.originalCoachRoleId === decision.originalCoachRoleId
      && candidate.actualCoachRoleId === decision.actualCoachRoleId));
  return matches.length === 1 ? matches[0] : null;
}

function r3SubstituteDecisionCandidates(coach) {
  const entries = effectiveSettlementPreview.results.filter((item) => item.coach.serverRoleId === coach.serverRoleId);
  return entries.length === 1 && entries[0].errorCode === "settlement_hold_substitute_manual_approval_required"
    && effectiveSettlementPreviewContextIsCurrent(effectiveSettlementPreview.context)
    ? entries[0].candidates || [] : [];
}

function validatedR3SubstituteDecisionCandidates(value, scope) {
  if (value?.branchId !== scope.branchId || value?.coachRoleId !== scope.coachRoleId
    || String(value?.settlementMonth || "").slice(0, 10) !== scope.settlementMonth
    || !Array.isArray(value?.candidates) || value.candidates.length > 500) {
    throw new Error("settlement_substitute_candidate_scope_mismatch");
  }
  const seen = new Set();
  for (const item of value.candidates) {
    if (!/^[0-9a-f-]{36}$/i.test(String(item?.id || "")) || seen.has(item.id)
      || item.branchId !== scope.branchId
      || !/^[0-9a-f-]{36}$/i.test(String(item.lessonId || ""))
      || !Number.isSafeInteger(Number(item.lessonRevision))
      || (item.coachRoleId != null && item.coachRoleId !== scope.coachRoleId)
      || (item.settlementMonth != null && item.settlementMonth !== scope.settlementMonth)
      || String(item.serviceDate || "").slice(0, 7) !== scope.settlementMonth.slice(0, 7)
      || ![item.originalCoachRoleId, item.actualCoachRoleId].includes(scope.coachRoleId)
      || !/^[0-9a-f]{64}$/.test(String(item.sourceFingerprint || ""))) {
      throw new Error("settlement_substitute_candidate_scope_mismatch");
    }
    seen.add(item.id);
  }
  return value.candidates.map((item) => ({ ...item,
    coachRoleId: scope.coachRoleId, settlementMonth: scope.settlementMonth,
  }));
}

async function previewR3SubstituteDecision(assignmentId, coachRoleId) {
  if (r3SubstituteDecisionUi.busy || effectiveSettlementPreview.loading || !adminApprovalReady() || !coachRoleId) return;
  const context = effectiveSettlementPreview.context;
  if (!effectiveSettlementPreviewContextIsCurrent(context)) return;
  const matches = effectiveSettlementPreview.results
    .filter((entry) => entry.coach.serverRoleId === coachRoleId)
    .flatMap((entry) => (entry.candidates || [])
    .filter((item) => item.id === assignmentId && entry.coach.serverRoleId === item.coachRoleId));
  const candidate = matches.length === 1 ? { ...matches[0] } : null;
  if (!candidate || candidate.branchId !== activeOperationBranchId()
    || ![candidate.originalCoachRoleId, candidate.actualCoachRoleId].includes(coachRoleId)
    || String(candidate.settlementMonth || "").slice(0, 7) !== state.billingMonth
    || String(candidate.serviceDate || "").slice(0, 7) !== state.billingMonth) return;
  const scope = Object.freeze({ branchId: candidate.branchId, coachRoleId,
    settlementMonth: candidate.settlementMonth });
  r3SubstituteDecisionUi.preview = null;
  r3SubstituteDecisionUi.context = context;
  r3SubstituteDecisionUi.scope = scope;
  r3SubstituteDecisionUi.recipient = "";
  r3SubstituteDecisionUi.operationKey = "";
  r3SubstituteDecisionUi.busy = true;
  r3SubstituteDecisionUi.message = "대타 귀속 근거를 확인하고 있습니다.";
  renderEffectiveSettlementPreview();
  try {
    if (!adminApprovalReady() || r3SubstituteDecisionUi.scope !== scope
      || effectiveSettlementPreview.context !== context || !effectiveSettlementPreviewContextIsCurrent(context)) return;
    const value = await context.client.rpc("tn_admin_preview_substitute_policy_decision", {
      target_branch_id: candidate.branchId, target_assignment_id: assignmentId,
    });
    if (r3SubstituteDecisionUi.scope !== scope || !adminApprovalReady()
      || effectiveSettlementPreview.context !== context || !effectiveSettlementPreviewContextIsCurrent(context)
      || value.branchId !== candidate.branchId
      || value.assignmentId !== assignmentId || value.lessonId !== candidate.lessonId
      || Number(value.lessonRevision) !== Number(candidate.lessonRevision)
      || value.sourceFingerprint !== candidate.sourceFingerprint
      || value.originalCoachRoleId !== candidate.originalCoachRoleId
      || value.actualCoachRoleId !== candidate.actualCoachRoleId
      || !r3SubstituteDecisionCandidate(context, value, scope)) return;
    r3SubstituteDecisionUi.preview = value;
    r3SubstituteDecisionUi.context = context;
    r3SubstituteDecisionUi.recipient = "";
    r3SubstituteDecisionUi.operationKey = "";
    r3SubstituteDecisionUi.message = value.decisionEnabled ? "원 담당 A와 실제 대타 B 중 귀속을 확인해 주세요."
      : "대타 귀속 승인 기능은 현재 OFF입니다. 운영 게이트 확인 전 저장할 수 없습니다.";
  } catch (error) {
    if (effectiveSettlementPreview.context === context && effectiveSettlementPreviewContextIsCurrent(context))
      r3SubstituteDecisionUi.message = window.TennisNoteSettlementAdjustment.effectiveError(error);
  } finally {
    r3SubstituteDecisionUi.busy = false;
    if (effectiveSettlementPreview.context === context && effectiveSettlementPreviewContextIsCurrent(context))
      renderEffectiveSettlementPreview();
  }
}

async function confirmR3SubstituteDecision(coachRoleId, assignmentId) {
  const decision = r3SubstituteDecisionUi.preview;
  const context = r3SubstituteDecisionUi.context;
  const recipient = r3SubstituteDecisionUi.recipient;
  const scope = r3SubstituteDecisionUi.scope;
  if (r3SubstituteDecisionUi.busy || !adminApprovalReady() || !decision?.decisionEnabled || decision.chosenRecipient
    || !scope || scope.coachRoleId !== coachRoleId || decision.assignmentId !== assignmentId
    || !["originalCoach", "actualCoach"].includes(recipient)
    || !r3SubstituteDecisionCandidate(context, decision)) return;
  const operationKey = r3SubstituteDecisionUi.operationKey || createAdminOperationKey("r3-substitute-decision");
  r3SubstituteDecisionUi.operationKey = operationKey;
  r3SubstituteDecisionUi.busy = true;
  renderEffectiveSettlementPreview();
  try {
    if (!adminApprovalReady() || r3SubstituteDecisionUi.scope !== scope
      || r3SubstituteDecisionUi.preview !== decision || r3SubstituteDecisionUi.context !== context
      || r3SubstituteDecisionUi.recipient !== recipient || r3SubstituteDecisionUi.operationKey !== operationKey
      || !r3SubstituteDecisionCandidate(context, decision)) return;
    const result = await context.client.rpc("tn_admin_confirm_substitute_policy_decision", {
      target_branch_id: decision.branchId, target_assignment_id: decision.assignmentId,
      expected_lesson_revision: decision.lessonRevision, expected_source_fingerprint: decision.sourceFingerprint,
      target_chosen_recipient: recipient,
      target_operation_key: operationKey,
    });
    if (r3SubstituteDecisionUi.scope !== scope
      || effectiveSettlementPreview.context !== context || !effectiveSettlementPreviewContextIsCurrent(context)
      || result?.ok !== true) return;
    r3SubstituteDecisionUi.preview = null;
    r3SubstituteDecisionUi.context = null;
    r3SubstituteDecisionUi.scope = null;
    r3SubstituteDecisionUi.recipient = "";
    r3SubstituteDecisionUi.operationKey = "";
    r3SubstituteDecisionUi.message = "대타 귀속을 기록했습니다. 서버 정산을 다시 확인합니다.";
    void refreshEffectiveSettlementPreview(effectiveSettlementPreviewSignature());
  } catch (error) {
    if (effectiveSettlementPreview.context === context && effectiveSettlementPreviewContextIsCurrent(context))
      r3SubstituteDecisionUi.message = window.TennisNoteSettlementAdjustment.effectiveError(error);
  } finally {
    r3SubstituteDecisionUi.busy = false;
    if (effectiveSettlementPreview.context === context && effectiveSettlementPreviewContextIsCurrent(context))
      renderEffectiveSettlementPreview();
  }
}

function renderEffectiveSettlementPreview() {
  const rows = $("#coachSettlementPreviewRows");
  const summary = $("#coachSettlementSummary");
  if (!rows) return;
  const current = effectiveSettlementPreview;
  if ((current.context || current.results.length) && !effectiveSettlementPreviewContextIsCurrent(current.context)) {
    Object.assign(r3SubstituteDecisionUi, { preview: null, context: null, scope: null, recipient: "", operationKey: "", message: "" });
    invalidateEffectiveSettlementPreview();
  }
  if (current.error) {
    rows.innerHTML = `<tr><td colspan="6">${escapeHtmlText(current.error)}</td></tr>`;
    if (summary) summary.textContent = "정산 조회 권한과 범위를 다시 확인해 주세요.";
    renderDashboardPager("#coachSettlementPreviewPager", 0, 0, "settlement", billingPageSize);
    return;
  }
  if (current.loading) {
    rows.innerHTML = '<tr><td colspan="6">적용일별 서버 계산을 확인하고 있습니다.</td></tr>';
    if (summary) summary.textContent = "정산 확인 중";
    return;
  }
  if (summary) summary.innerHTML = current.results.map((entry) => `<article>
    <span>${escapeHtmlText(entry.coach.name)}</span>
    <strong>${entry.error ? "확인 필요" : `${money.format(entry.value.estimatedSettlement)}원`}</strong>
<small>${escapeHtmlText(entry.error || `${entry.value.sourceEvidenceLabel && entry.value.settledMinutes === 0 ? "수업 횟수·분은 금액 계산에 사용하지 않음" : `실제 진행 ${entry.value.settledMinutes}분`} · 결제 ${entry.value.paymentCount}건 · 본수업 ${money.format(entry.value.ownSettlement)}원 / 대타 ${money.format(entry.value.substituteSettlement)}원${entry.value.branchSubstituteExpense ? ` · 지점 대타비 ${money.format(entry.value.branchSubstituteExpense)}원` : ""}${entry.value.sourceEvidenceLabel ? ` · ${entry.value.sourceEvidenceLabel}` : ""}${entry.value.sourceHoldLabel ? ` · ${entry.value.sourceHoldLabel}` : entry.value.confirmationReady ? "" : " · 새 계산 미리보기 / 기존 확정 내역 유지"}`)}</small>
  </article>`).join("") || "계산할 코치가 없습니다.";
  const items = current.results.flatMap((entry) => entry.error ? [{ ...entry, row: null }]
    : entry.value.rows.map((row) => ({ ...entry, row })));
  state.settlementPage = normalizeDashboardPage(items.length, state.settlementPage, billingPageSize);
  rows.innerHTML = items.slice(state.settlementPage * billingPageSize, (state.settlementPage + 1) * billingPageSize)
    .map(({ coach, row, error, errorCode, candidateLoadError }) => {
      if (error) {
        const candidates = errorCode === "settlement_hold_substitute_manual_approval_required"
          ? r3SubstituteDecisionCandidates(coach) : [];
        const actions = candidates.map((assignment, index) =>
          `<button type="button" data-r3-policy-preview="${escapeHtmlText(assignment.id)}" data-r3-policy-coach="${escapeHtmlText(coach.serverRoleId)}" ${r3SubstituteDecisionUi.busy ? "disabled" : ""}>대타 귀속 근거 ${index + 1} 확인</button>`).join(" ");
        const decision = r3SubstituteDecisionUi.preview;
        const chooser = decision && r3SubstituteDecisionUi.scope?.coachRoleId === coach.serverRoleId
          && r3SubstituteDecisionCandidate(current.context, decision)
          && candidates.some((assignment) => assignment.id === decision.assignmentId)
          ? `<label>대타 정산 귀속 <select data-r3-policy-recipient data-r3-policy-coach="${escapeHtmlText(coach.serverRoleId)}" data-r3-policy-assignment="${escapeHtmlText(decision.assignmentId)}" ${decision.decisionEnabled && !decision.chosenRecipient && !r3SubstituteDecisionUi.busy ? "" : "disabled"}>
              <option value="">선택</option><option value="originalCoach" ${r3SubstituteDecisionUi.recipient === "originalCoach" ? "selected" : ""}>A 원 담당 코치</option>
              <option value="actualCoach" ${r3SubstituteDecisionUi.recipient === "actualCoach" ? "selected" : ""}>B 실제 대타 코치</option></select></label>
              <button type="button" data-r3-policy-confirm data-r3-policy-coach="${escapeHtmlText(coach.serverRoleId)}" data-r3-policy-assignment="${escapeHtmlText(decision.assignmentId)}" ${decision.decisionEnabled && !decision.chosenRecipient && r3SubstituteDecisionUi.recipient && !r3SubstituteDecisionUi.busy ? "" : "disabled"}>귀속 확인 저장</button>` : "";
        return `<tr><td colspan="6">${escapeHtmlText(coach.name)} · ${escapeHtmlText(error)} ${actions} ${chooser}
          ${candidateLoadError ? `<small>${escapeHtmlText(candidateLoadError)}</small>` : ""}
          <small role="status">${escapeHtmlText(r3SubstituteDecisionUi.message)}</small></td></tr>`;
      }
      const exactTicket = [...tickets, ...expiredTickets, ...(adminLiveDataState.settlementTickets || [])]
        .find((ticket) => String(ticket.serverTicketId || ticket.id) === row.ticketId);
      return `<tr><td>${escapeHtmlText(exactTicket?.member || "회원권 근거 확인")}</td>
        <td>${escapeHtmlText(coach.name)}</td><td>${money.format(row.amount)}원</td>
        <td>${escapeHtmlText(row.method)}<br><small>${Number(row.settledSessions)}회 · 실제 ${Number(row.settledMinutes)}분</small></td>
        <td>날짜별 조건 · 월 최종 반올림</td><td>${money.format(row.estimatedSettlement)}원</td></tr>`;
    }).join("") || '<tr><td colspan="6">선택한 달의 계산 근거가 없습니다.</td></tr>';
  rows.querySelectorAll("[data-r3-policy-preview]").forEach((button) => button.addEventListener("click", () => {
    if (button.isConnected === false) return;
    void previewR3SubstituteDecision(button.dataset.r3PolicyPreview, button.dataset.r3PolicyCoach);
  }));
  rows.querySelectorAll("[data-r3-policy-recipient]").forEach((select) => select.addEventListener("change", (event) => {
    const scope = r3SubstituteDecisionUi.scope;
    if (select.isConnected === false || r3SubstituteDecisionUi.busy || !scope
      || select.dataset.r3PolicyCoach !== scope.coachRoleId
      || select.dataset.r3PolicyAssignment !== r3SubstituteDecisionUi.preview?.assignmentId
      || !r3SubstituteDecisionCandidate(r3SubstituteDecisionUi.context, r3SubstituteDecisionUi.preview)
      || !["", "originalCoach", "actualCoach"].includes(event.target.value)
      || r3SubstituteDecisionUi.recipient === event.target.value) return;
    r3SubstituteDecisionUi.recipient = event.target.value;
    r3SubstituteDecisionUi.operationKey = "";
    renderEffectiveSettlementPreview();
  }));
  rows.querySelectorAll("[data-r3-policy-confirm]").forEach((button) => button.addEventListener("click", () => {
    if (button.isConnected === false) return;
    void confirmR3SubstituteDecision(button.dataset.r3PolicyCoach, button.dataset.r3PolicyAssignment);
  }));
  renderDashboardPager("#coachSettlementPreviewPager", items.length, state.settlementPage, "settlement", billingPageSize);
}
