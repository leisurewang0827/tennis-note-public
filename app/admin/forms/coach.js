// 코치 입력 폼의 항목과 표시를 서로 맞추는 함수들.
//
// 선택지 목록을 다시 채우고 필드를 보이거나 숨긴다. 서버는 부르지 않는다.
// 관리자에서 sync*/refresh* 는 대부분 서버가 아니라 이 일을 한다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function ensureCoachSettlementRule(coach) {
  const index = coachSettlementRules.findIndex((rule) => rule.coach === coach?.name);
  if (index >= 0) return index;
  coachSettlementRules.push(defaultCoachSettlementRule(coach));
  return coachSettlementRules.length - 1;
}

function syncOnsitePaymentCoaches() {
  const select = $("#onsitePaymentCoach");
  if (!select) return;
  const sourceTicket = onsitePaymentSourceTickets().find((ticket) => ticket.serverTicketId === $("#onsitePaymentSourceTicket")?.value) || null;
  const selectedProduct = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const productBranchId = String(selectedProduct?.server?.branch_id || activeOperationBranchId() || "");
  const activeCoaches = operationBranchCoaches()
    .filter((coach) => coach.status === "active" && coach.serverRoleId)
    .filter((coach) => !productBranchId || !coach.branchId || String(coach.branchId) === productBranchId);
  const sourceCoachRoleId = String(sourceTicket?.coachRoleId || "");
  const previousValue = select.value;
  select.innerHTML = activeCoaches.length
    ? activeCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}">${escapeHtml(coach.name)}</option>`).join("")
    : '<option value="">승인된 담당 코치 없음</option>';
  const preferredValue = sourceCoachRoleId || previousValue;
  if (activeCoaches.some((coach) => String(coach.serverRoleId) === preferredValue)) select.value = preferredValue;
  select.disabled = Boolean(sourceTicket);
}

function syncSubstituteSettlementFields() {
  const hourly = $("#substituteSettlementMode")?.value === "hourly";
  if ($("#substituteHourlyField")) $("#substituteHourlyField").hidden = !hourly;
  if ($("#substituteHourlyAmount")) $("#substituteHourlyAmount").required = hourly;
}

function syncCoachStaffSettlementFieldVisibility(method) {
  const root = $("#coachStaffModalContent") || document;
  [...root.querySelectorAll('[data-settlement-mode-field="ratio"]')].forEach((element) => {
    element.classList.toggle("is-hidden", method !== "ratio");
  });
  [...root.querySelectorAll('[data-settlement-mode-field="hourly"]')].forEach((element) => {
    element.classList.toggle("is-hidden", method !== "hourly");
  });
}

function ensureCoachLaneOrderEditorState() {
  const currentRoleIds = scheduleLaneActiveCoaches().map((coach) => String(coach.serverRoleId));
  if (!coachLaneOrderEditorState.roleIds.length
    || !sameCoachRoleSet(coachLaneOrderEditorState.roleIds, currentRoleIds)) {
    coachLaneOrderEditorState.roleIds = currentRoleIds;
    coachLaneOrderEditorState.baselineRoleIds = [...currentRoleIds];
    coachLaneOrderEditorState.revision = "";
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = "";
  }
}
