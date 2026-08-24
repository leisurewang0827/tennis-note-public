// 값 변환·판정만 하는 순수 함수들.
//
// 여기 함수는 전역 변수도, 다른 함수도, DOM 도, 서버도 참조하지 않는다.
// 인자만 보고 값을 돌려주므로 tests/admin-values.test.js 로 검증된다.
// 새로 넣을 때도 그 조건을 지킬 것. 전역이 필요해지면 여기 두지 말 것.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같다.

function adminLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function cloneOperationProfileValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function lessonUnitLabel(durationMinutes) {
  if (durationMinutes === 20) return "20분권 1회";
  if (durationMinutes === 30) return "30분권 1회";
  if (durationMinutes === 40) return "20분권 2회 연속";
  if (durationMinutes === 60) return "30분권 2회 연속";
  return "관리자 확인 필요";
}

function isDeductedLesson(lesson) {
  const status = lesson?.serverStatus || lesson?.status || "";
  if (Number.isFinite(Number(lesson?.deductedSessions))) return Number(lesson.deductedSessions) > 0;
  return ["completed", "no_show"].includes(status) || (!lesson?.serverStatus && lesson?.status === "confirmed");
}

function scheduleCoachDisplayName(name = "") {
  return String(name || "미배정").replace(/\s*코치\s*$/, "").trim() || "미배정";
}

function lessonRawStatusValue(lesson = {}) {
  return String(lesson.serverStatus || lesson.server_status || lesson.status || "").toLowerCase();
}

function isReleasedRegularMakeupSlot(lesson) {
  return Boolean(lesson?.releasedMakeupSlot);
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function lessonScheduleCoachId(lesson = {}) {
  return lesson.originalCoachId || lesson.coachId || "";
}

function compactDashboardPageIndexes(pageCount, currentPage) {
  const lastPage = pageCount - 1;
  const indexes = new Set([0, lastPage]);
  const rangeStart = currentPage <= 3 ? 0 : Math.max(0, currentPage - 2);
  const rangeEnd = currentPage >= lastPage - 3 ? lastPage : Math.min(lastPage, currentPage + 2);

  for (let index = rangeStart; index <= rangeEnd; index += 1) indexes.add(index);

  const sortedIndexes = [...indexes].sort((left, right) => left - right);
  return sortedIndexes.flatMap((index, itemIndex) => {
    const previousIndex = sortedIndexes[itemIndex - 1];
    return itemIndex > 0 && index - previousIndex > 1 ? ["ellipsis", index] : [index];
  });
}

function splitMemberNames(value = "") {
  return [...new Set(String(value || "")
    .split(/[&·]/)
    .map((name) => name.trim())
    .filter(Boolean))];
}

function memberServerUserIds(member) {
  if (!member || typeof member !== "object") return [];
  return [...new Set((Array.isArray(member.serverUserIds) ? member.serverUserIds : [member.serverUserId]).filter(Boolean))];
}

function ticketParticipantUserIds(ticket) {
  if (!ticket) return [];
  return [...new Set([
    ...(Array.isArray(ticket.participantUserIds) ? ticket.participantUserIds : []),
    ticket.serverUserId,
  ].filter(Boolean))];
}

function getTicketDurationMinutes(ticket) {
  const explicit = Number(ticket?.durationMinutes);
  if ([20, 30, 40].includes(explicit)) return explicit;
  const product = ticket?.product || "";
  if (product.includes("40")) return 40;
  if (product.includes("30")) return 30;
  return 20;
}

function getTicketWeeklyCount(ticket) {
  if (Number(ticket?.weeklyCount) > 0) return Number(ticket.weeklyCount);
  const product = ticket?.product || "";
  const match = product.match(/주\s*(\d+)회/);
  return match ? Number(match[1]) : 1;
}

function getTicketDisplayProduct(ticket) {
  return (ticket?.product || "")
    .replace(/^[^\s]+ 코치\s*/, "")
    .replace(/\s*\d+분.*$/, "")
    .trim();
}

function normalizeLessonSource(value) {
  return ["regular", "makeup", "coupon", "coach_change", "admin", "one_day"].includes(value) ? value : "regular";
}

function paymentMethodLabel(method = "") {
  const value = String(method || "").trim();
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labels = {
    card: "카드",
    tosspay: "토스페이",
    naverpay: "네이버페이",
    kakaopay: "카카오페이",
    easypay: "간편결제",
    transfer: "계좌이체",
    banktransfer: "계좌이체",
    cash: "현금",
    bank: "계좌이체",
    manual: "관리자 입력",
    membershiptransfer: "회원권 양도",
    legacy: "기존 기록",
    virtualaccount: "가상계좌",
    mobile: "휴대폰결제",
  };
  return labels[normalized] || value.replaceAll("결제청구", "결제요청").replaceAll("청구서", "결제요청");
}

function isHistoricalImportedPayment(item = {}) {
  const providerPaymentId = String(item.providerPaymentId || "").toLowerCase();
  const provider = String(item.provider || "").toLowerCase();
  const method = String(item.method || "").toLowerCase();
  const requestedAt = Date.parse(String(item.requestedAt || ""));
  const verifiedAt = Date.parse(String(item.verifiedAt || item.paidAt || ""));
  const historicalMemberEvidence = paymentOwnerHasHistoricalRecord(item);
  const preservedManualEvidence = provider === "admin_manual"
    && (!item.productId || historicalMemberEvidence)
    && Number.isFinite(requestedAt)
    && Number.isFinite(verifiedAt)
    && requestedAt - verifiedAt >= 24 * 60 * 60 * 1000;
  return providerPaymentId.startsWith("sheet_")
    || providerPaymentId.startsWith("legacy_")
    || providerPaymentId.startsWith("import_")
    || provider === "google_sheet_history"
    || method.includes("legacy")
    || method.includes("기존 기록")
    || preservedManualEvidence;
}

function pendingRecordType(record = {}) {
  if (record.pendingType) return record.pendingType;
  if (record.actionView === "billing" || record.source === "결제 오류") return "payment";
  if (record.actionView === "schedule" || String(record.source || "").includes("보강")) return "makeup";
  if (String(record.source || "").includes("피드")) return "feedback";
  return "lesson";
}

function recordTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function lessonEndTimestamp(lesson) {
  if (!lesson?.lessonDate || !lesson?.time) return 0;
  const start = new Date(`${lesson.lessonDate}T${lesson.time}:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return start.getTime() + (Number(lesson.durationMinutes) || 20) * 60 * 1000;
}

function journalBodySummary(body = "") {
  const text = String(body || "").trim();
  if (!text) return "작성 내용 없음";
  try {
    const parsed = JSON.parse(text);
    return parsed.content || parsed.selfMemo || parsed.memo || text;
  } catch {
    return text;
  }
}

function participantOutcomeLabel(outcome = "completed") {
  return ({
    completed: "수업 완료",
    no_show: "노쇼",
    absence: "불참",
    cancelled: "취소",
    holiday: "휴무",
  })[outcome] || "수업 처리";
}

function isExpectedPersonalGroupTicketSet(ticketIds, linkContext) {
  if (ticketIds.length < 2) return false;
  let sharedAccountIds = null;
  ticketIds.forEach((ticketId) => {
    const accountIds = linkContext.accountIdsByTicket.get(String(ticketId)) || new Set();
    sharedAccountIds = sharedAccountIds === null
      ? new Set(accountIds)
      : new Set([...sharedAccountIds].filter((accountId) => accountIds.has(accountId)));
  });
  return [...(sharedAccountIds || [])].some((accountId) => {
    const account = linkContext.byAccount.get(accountId);
    return account?.userIds.size >= 2 && account?.ticketIds.size >= 2;
  });
}

function memberTicketDuplicateFingerprint(ticket) {
  if (!ticket?.serverTicketId || !ticket?.serverUserId) return "";
  const participants = ticketParticipantUserIds(ticket).map(String).sort().join(",");
  return [
    ticket.serverUserId,
    ticket.productId || ticket.product || "",
    ticket.coachRoleId || ticket.coachId || "",
    ticket.lessonTypeCode || ticket.groupSize || "",
    ticket.actualLessonStart || ticket.purchased || "",
    ticket.expires || "",
    participants,
  ].map((value) => String(value || "")).join("|");
}

function sortAdminRecords(records = []) {
  const priorityScore = { urgent: 3, high: 2, normal: 1 };
  return [...records].sort((left, right) => {
    const priorityDifference = (priorityScore[right.priority] || 0) - (priorityScore[left.priority] || 0);
    if (priorityDifference) return priorityDifference;
    return recordTimestamp(right.sortAt) - recordTimestamp(left.sortAt);
  });
}
