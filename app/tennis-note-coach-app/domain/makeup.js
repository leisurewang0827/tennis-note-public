// 보강 요청과 보강권을 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function pendingMakeupRequests() {
  return state.makeupRequests.filter((request) => request.status === "승인 대기");
}

function ownPendingMakeupRequests() {
  return pendingMakeupRequests().filter(makeupRequestBelongsToCurrentCoach);
}

function ownOpenMakeupEntitlements() {
  return (state.makeupEntitlements || []).filter((item) => (
    item.status === "open"
    && makeupRequestBelongsToCurrentCoach(item)
  ));
}

function getMakeupLinkedLog(member) {
  return state.lessonLogs.find((log) => log.member === member && log.status !== "확인 완료") || state.lessonLogs.find((log) => log.member === member);
}

function coachMakeupEntitlementSnapshot(entitlement = {}) {
  return [
    entitlement.id,
    entitlement.status,
    entitlement.branchId,
    entitlement.coachRoleId,
    entitlement.ticketId,
    entitlement.sourceLessonId,
    Number(entitlement.durationMinutes) || 0,
    entitlement.updatedAt,
  ].map((value) => String(value || "")).join("|");
}

function coachMakeupEntitlementBookingGuard(entitlement, expectedSnapshot = "") {
  if (!entitlement?.id) return { ok: false, code: "missing", message: "보강권을 다시 선택해 주세요." };
  if (entitlement.bookingContract !== "legacy_exact") {
    return { ok: false, code: "read_only_contract", message: "이 보강 대기는 회원의 시간 선택을 기다리고 있습니다." };
  }
  if (entitlement.status !== "open") {
    return { ok: false, code: "not_open", message: "이미 예약되었거나 종료된 보강권입니다. 목록을 새로고침해 주세요." };
  }
  const workspace = scheduleV2CoachWorkspace();
  const branchId = String(workspace?.branchId || state.coach?.branchId || "");
  const roleId = currentCoachRoleId();
  if (!branchId || String(entitlement.branchId || "") !== branchId) {
    return { ok: false, code: "branch_mismatch", message: "현재 지점의 보강권이 아닙니다." };
  }
  if (!roleId || String(entitlement.coachRoleId || "") !== roleId) {
    return { ok: false, code: "coach_mismatch", message: "현재 로그인한 코치의 보강권이 아닙니다." };
  }
  const ticket = (workspace?.tickets || []).find((item) => String(item.id || "") === String(entitlement.ticketId || ""));
  if (!ticket || String(ticket.coachRoleId || "") !== roleId || ticket.status !== "active") {
    return { ok: false, code: "ticket_mismatch", message: "보강권과 연결된 회원권을 확인할 수 없습니다." };
  }
  const participantIds = (ticket.participantUserIds || [ticket.ownerUserId]).filter(Boolean);
  if (!participantIds.length || Number(ticket.remainingSessions) <= 0) {
    return { ok: false, code: "ticket_unavailable", message: "회원권 참여자 또는 잔여 횟수를 확인해 주세요." };
  }
  const sourceLesson = (workspace?.lessons || []).find((lesson) => String(lesson.id || "") === String(entitlement.sourceLessonId || ""));
  if (!sourceLesson || sourceLesson.status !== "cancelled") {
    return { ok: false, code: "source_mismatch", message: "보강권의 원래 수업 상태가 변경되었습니다." };
  }
  const snapshot = coachMakeupEntitlementSnapshot(entitlement);
  if (expectedSnapshot && expectedSnapshot !== snapshot) {
    return { ok: false, code: "stale", message: "보강권 상태가 변경되었습니다. 최신 목록에서 다시 선택해 주세요." };
  }
  return { ok: true, entitlement, ticket, participantIds, sourceLesson, snapshot };
}

function activeCoachMakeupBookingEntitlement() {
  return (state.makeupEntitlements || []).find((item) => (
    String(item.id || "") === String(state.bookingMakeupEntitlementId || "")
  )) || null;
}
