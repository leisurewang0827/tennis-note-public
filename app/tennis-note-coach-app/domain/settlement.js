// 코치 정산 금액을 계산하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

// Session-only choice: never restored from a persisted coach snapshot.
let coachSettlementSelection = null;

function coachSettlementCurrentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
}

function selectCoachSettlementMonth(value) {
  const currentMonth = coachSettlementCurrentMonth();
  coachSettlementSelection = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""))
    ? { month: value, currentMonth, coachRoleId: state.coach?.coachRoleId || "" }
    : null;
  return coachSettlementMonth();
}

function coachSettlementMonth() {
  const currentMonth = coachSettlementCurrentMonth();
  const choice = coachSettlementSelection;
  if (choice && (choice.currentMonth !== currentMonth || choice.coachRoleId !== (state.coach?.coachRoleId || ""))) coachSettlementSelection = null;
  state.settlementMonth = coachSettlementSelection?.month || currentMonth;
  return state.settlementMonth;
}

function coachSettlementRuleLabel(settlement = {}) {
  if (settlement.ruleType === "hourly") return `시급 ${formatCoachWon(settlement.hourlyRate)}`;
  const rate = Math.round((Number(settlement.ruleRate) || 0) * 100);
  const basis = settlement.settlementBasis === "actual_paid_inc_vat" ? "실결제" : "정산 기준가";
  const calculation = settlement.calculationMode === "monthly_payment" ? "월 결제액" : "진행 횟수";
  return `${calculation} · ${basis}의 ${rate}%`;
}

function normalizedCoachSettlementMemberName(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function coachSettlementRowsForMember(member = {}) {
  const settlementRows = Array.isArray(state.coachSettlement?.rows) ? state.coachSettlement.rows : [];
  const memberNames = member.isGroupDisplay
    ? [member.groupMemberName, member.displayName]
    : [member.displayName, member.name];
  const normalizedNames = new Set(memberNames.map(normalizedCoachSettlementMemberName).filter(Boolean));
  if (!normalizedNames.size) return [];
  return settlementRows.filter((row) => normalizedNames.has(normalizedCoachSettlementMemberName(row.memberName)));
}

function coachMemberSettlementSummary(member = {}) {
  const rows = coachSettlementRowsForMember(member);
  if (!rows.length) {
    return {
      linked: false,
      sessions: 0,
      amount: 0,
      label: state.coachSettlementLoading ? "정산 확인 중" : "정산 연결 확인 필요",
    };
  }
  const sessions = rows.reduce((sum, row) => sum + (Number(row.settledSessions) || 0), 0);
  const amount = rows.reduce((sum, row) => sum + (Number(row.estimatedSettlement) || 0), 0);
  return {
    linked: true,
    sessions,
    amount,
    label: `${sessions}회 · ${formatCoachWon(amount)}`,
  };
}
