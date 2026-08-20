// 오늘 할 일 목록의 탭과 펼침 상태를 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function todayTaskTab() {
  return ["lessons", "makeup", "records"].includes(state.todayTaskTab) ? state.todayTaskTab : "lessons";
}

function isTodayTaskExpanded(tab) {
  return Boolean(state.expandedTodayTasks?.[tab]);
}

function todayTaskVisibleItems(items, tab) {
  return isTodayTaskExpanded(tab) ? items : items.slice(0, 3);
}

function todayTaskToggleButton(items, tab) {
  if (items.length <= 3) return "";
  return `
    <button class="small-button task-more-button" type="button" data-toggle-task-list="${tab}">
      ${isTodayTaskExpanded(tab) ? "접기" : `전체 보기 ${items.length}개`}
    </button>`;
}

function coachQuickAddOperationKey(prefix = "coach-add") {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 120);
}

function coachQuickAddTicketAvailability(ticket = {}) {
  const targetDate = state.coachQuickAdd?.date || localDateKey();
  if (String(ticket.coachRoleId || "") !== String(state.coachQuickAdd?.coachRoleId || "")) {
    return { visible: false, available: false, reason: "" };
  }
  if (!["regular", "group"].includes(ticket.productKind)) {
    return { visible: false, available: false, reason: "" };
  }
  if (ticket.status !== "active") {
    return { visible: true, available: false, reason: ticket.status === "paused" ? "일시정지" : "사용 불가" };
  }
  if (Number(ticket.remainingSessions) <= 0) {
    return { visible: true, available: false, reason: "잔여 횟수 없음" };
  }
  if (ticket.startsOn && targetDate < ticket.startsOn) {
    return { visible: true, available: false, reason: `${ticket.startsOn}부터 사용 가능` };
  }
  if (ticket.expiresOn && targetDate > ticket.expiresOn) {
    return { visible: true, available: false, reason: "이용기간 만료" };
  }
  return { visible: true, available: true, reason: "" };
}

function coachQuickAddTicketChoices() {
  const workspace = scheduleV2CoachWorkspace();
  return (workspace?.tickets || []).map((ticket) => ({
    ticket,
    availability: coachQuickAddTicketAvailability(ticket),
  })).filter((choice) => choice.availability.visible);
}

function coachQuickAddTickets() {
  return coachQuickAddTicketChoices()
    .filter((choice) => choice.availability.available)
    .map((choice) => choice.ticket);
}

function coachQuickAddTicketLabel(ticket = {}) {
  const workspace = scheduleV2CoachWorkspace();
  const memberMap = new Map((workspace?.members || []).map((member) => [member.id, member.name || "회원"]));
  const names = (ticket.participantUserIds || [ticket.ownerUserId]).map((userId) => memberMap.get(userId)).filter(Boolean);
  return `${names.join(" · ") || "회원"} · ${ticket.productName || "회원권"} · 잔여 ${Number(ticket.remainingSessions) || 0}회`;
}
