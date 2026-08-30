// 운동노트와 첨부 미디어를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function mediaItemsFromInput(input) {
  return [...(input?.files || [])].map((file) => ({
    name: file.name,
    type: file.type || "",
    url: URL.createObjectURL(file),
  }));
}

function mediaItemsFromNames(names = []) {
  return names.map((name) => {
    const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(name);
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    return {
      name,
      type: isVideo ? "video/demo" : isImage ? "image/demo" : "",
      url: "",
    };
  });
}

function normalizeMediaItems(log) {
  if (Array.isArray(log.mediaItems) && log.mediaItems.length) return log.mediaItems;
  return mediaItemsFromNames(log.mediaNames || []);
}

function journalMediaType(file = {}) {
  if (String(file.type || "").startsWith("video/")) return "video";
  return "image";
}

function safeJournalObjectName(file = {}, index = 0) {
  const extension = String(file.name || "media.bin").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const uniqueId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
  return `${uniqueId}.${extension}`;
}

function serverJournalBody(log = {}) {
  return JSON.stringify({
    schema: serverJournalSchema,
    clientLogId: log.id,
    lessonId: log.lessonId,
    lessonLabel: log.lessonLabel,
    round: log.round,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculum?.id || log.nextCurriculumId || "FH-01",
    nextCurriculumId: log.nextCurriculumId || log.curriculum?.id || "FH-01",
    mediaNames: log.mediaNames || [],
    submittedAt: log.submittedAt,
  });
}

function journalActivityLessonStatus(lesson) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  const status = String(lesson.serverStatus || lesson.status || "scheduled").toLowerCase();
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup_booked";
  if (status === "no_show") return "no_show";
  if (["absence", "absent"].includes(status)) return "absent";
  if (["completed", "confirmed"].includes(status)) return "completed";
  if (["scheduled", "pending_change", "requested"].includes(status)) return "scheduled";
  return "";
}

function journalMatchesSearch(entry, rawQuery) {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query) return true;
  return [entry.kind, entry.dateLabel, entry.title, entry.subtitle, entry.body, entry.note, entry.next, ...(entry.mediaNames || [])]
    .some((value) => `${value || ""}`.toLowerCase().includes(query));
}

function journalDateLabel(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "선택한 날짜";
  return parsed.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function selectedNextText(log) {
  const step = curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum);
  return step?.title ? `다음: ${step.title}` : "";
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function membershipPassRecords() {
  const groupedRequests = [];
  const groupedRequestIndex = new Map();
  (state.paymentRequests || []).forEach((request) => {
    const display = paymentRequestDisplay(request);
    const canGroup = display.tone === "alert" && request.cancellable !== true;
    const groupKey = canGroup
      ? `${request.productId || request.productTitle || "결제"}|${display.status}`
      : request.paymentId || request.serverPaymentId || `${request.productTitle}-${groupedRequests.length}`;
    if (canGroup && groupedRequestIndex.has(groupKey)) {
      groupedRequests[groupedRequestIndex.get(groupKey)].attemptCount += 1;
      return;
    }
    groupedRequestIndex.set(groupKey, groupedRequests.length);
    groupedRequests.push({ request, display, attemptCount: 1 });
  });
  const pendingPasses = groupedRequests.map(({ request, display, attemptCount }) => {
    const groupedAttemptNote = attemptCount > 1 ? ` · 이전 동일 시도 ${attemptCount - 1}건 묶음` : "";
    return {
      id: request.paymentId || request.productId || `pending-${request.productTitle}`,
      title: request.productTitle,
      period: display.period,
      total: ticketCountFromTitle(request.productTitle),
      used: 0,
      coach: request.coach || "상담 후 배정",
      paid: request.amountLabel || "금액 확인",
      status: display.status,
      note: `${display.note || ""}${groupedAttemptNote}`,
      tone: display.tone,
      paymentId: request.paymentId || "",
      productId: request.productId || "",
      cancellable: request.cancellable === true && Boolean(request.paymentId),
    };
  });
  const heldPasses = refundHeldLiveTickets().map((ticket) => ({
    id: `refund-held-${ticket.id}`,
    title: ticket.title || "환불 접수된 이용권",
    period: ticket.refundHoldAt ? `${formatDateTimeLabel(ticket.refundHoldAt)} 접수` : "관리자 송금 대기",
    total: ticket.total || 0,
    used: ticket.used || 0,
    remaining: ticket.remaining || 0,
    unavailable: true,
    coach: state.profile.mainCoach || "담당 코치",
    paid: ticket.paymentAmount ? `결제 ${ticket.paymentAmount.toLocaleString("ko-KR")}원` : "결제금액 확인",
    status: "환불 송금 대기",
    note: "송금 완료 또는 접수취소 전까지 이용권 사용이 잠시 정지됩니다.",
    tone: "alert",
  }));
  const refundedPasses = (state.liveTickets || [])
    .filter((ticket) => ["refunded", "cancelled", "canceled"].includes(String(ticket.status || "").toLowerCase()))
    .map((ticket) => {
      const breakdown = ticket.refundBreakdown || {};
      const refundAmount = Number(ticket.refundedAmount || breakdown.refundAmount || 0);
      const usedAmount = Number(breakdown.usedAmount || 0);
      const penaltyAmount = Number(breakdown.penaltyAmount || 0);
      const detailParts = [];
      if (refundAmount) detailParts.push(`환불 ${refundAmount.toLocaleString("ko-KR")}원`);
      if (usedAmount) detailParts.push(`사용 회차 차감 ${usedAmount.toLocaleString("ko-KR")}원`);
      if (penaltyAmount) detailParts.push(`위약금 ${penaltyAmount.toLocaleString("ko-KR")}원`);
      if (ticket.refundReason) detailParts.push(`사유 ${ticket.refundReason}`);
      return {
        id: `refunded-${ticket.id}`,
        title: ticket.title || "환불된 이용권",
        period: ticket.refundedAt ? `${formatDateTimeLabel(ticket.refundedAt)} 환불 완료` : ticket.expiresOn ? `${ticket.startsOn || "시작일 확인"} ~ ${ticket.expiresOn}` : "서버 환불 처리 완료",
        total: ticket.total || 0,
        used: ticket.used || 0,
        remaining: 0,
        unavailable: true,
        coach: state.profile.mainCoach || "담당 코치",
        paid: ticket.paymentAmount ? `결제 ${ticket.paymentAmount.toLocaleString("ko-KR")}원` : "결제금액 확인",
        status: ticket.status === "refunded" ? "환불완료" : "취소완료",
        note: detailParts.join(" · ") || "결제취소 후 이용권 비활성화",
        tone: "alert",
      };
    });
  return [...pendingPasses, ...heldPasses, ...refundedPasses, ...(state.expiredTickets || [])];
}

function selectedJournalEntries() {
  const selectedDate = state.selectedJournalDate || localDateKey();
  const query = state.journalSearchQuery || "";
  return journalEntries().filter((entry) => entry.dateValue === selectedDate && journalMatchesSearch(entry, query));
}

function normalizeJournalNavigationDate(dateValue = "") {
  const value = String(dateValue || "").trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return localDateKey(date) === value ? value : "";
}

const journalMonthPickerMinYear = 2000;
const journalMonthPickerMaxYear = 2100;

function normalizeJournalMonthValue(monthValue = "") {
  const value = String(monthValue || "").trim();
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < journalMonthPickerMinYear || year > journalMonthPickerMaxYear || month < 1 || month > 12) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function requestedJournalNavigationDate() {
  const params = new URLSearchParams(window.location.search || "");
  return normalizeJournalNavigationDate(params.get("journalDate") || params.get("journal_date") || "");
}

function applyJournalNavigationDate(dateValue, options = {}) {
  const normalizedDate = normalizeJournalNavigationDate(dateValue);
  if (!normalizedDate) return false;
  const monthValue = normalizedDate.slice(0, 7);
  const changed = state.selectedJournalDate !== normalizedDate || state.activeJournalMonth !== monthValue;
  state.selectedJournalDate = normalizedDate;
  state.activeJournalMonth = monthValue;
  if (options.render !== false) renderJournalCalendar();
  if (changed && options.persist !== false) saveSnapshot();
  return changed;
}

function initializeJournalNavigationForLaunch() {
  const requestedDate = requestedJournalNavigationDate();
  const targetDate = requestedDate || localDateKey();
  state.journalCalendarViewMode = "month";
  applyJournalNavigationDate(targetDate, { render: false, persist: false });
  return { date: targetDate, mode: state.journalCalendarViewMode, source: requestedDate ? "deep-link" : "cold-launch" };
}

function selectJournalDate(dateValue) {
  applyJournalNavigationDate(dateValue);
}

function returnJournalToToday() {
  const todayValue = localDateKey();
  const changed = applyJournalNavigationDate(todayValue);
  if (!changed) renderJournalCalendar();
  return changed;
}

function applyJournalMonthNavigation(monthValue, options = {}) {
  const normalizedMonth = normalizeJournalMonthValue(monthValue);
  if (!normalizedMonth) return false;
  const selectedDate = normalizeJournalNavigationDate(state.selectedJournalDate) || localDateKey();
  const nextDate = selectedDate.startsWith(normalizedMonth) ? selectedDate : `${normalizedMonth}-01`;
  const changed = state.activeJournalMonth !== normalizedMonth || state.selectedJournalDate !== nextDate;
  state.activeJournalMonth = normalizedMonth;
  state.selectedJournalDate = nextDate;
  if (options.render !== false) renderJournalCalendar();
  if (changed && options.persist !== false) saveSnapshot();
  return changed;
}

function setJournalMonthPickerStatus(message = "", tone = "") {
  const status = $("#journalMonthPickerStatus");
  if (!status) return;
  status.textContent = String(message || "");
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function prepareJournalMonthPicker(monthValue = "") {
  const normalizedMonth = normalizeJournalMonthValue(monthValue)
    || normalizeJournalMonthValue(state.activeJournalMonth)
    || localDateKey().slice(0, 7);
  const [yearValue, monthNumber] = normalizedMonth.split("-");
  const yearSelect = $("#journalMonthPickerYear");
  const monthSelect = $("#journalMonthPickerMonth");
  if (!yearSelect || !monthSelect) return normalizedMonth;
  if (!yearSelect.options.length) {
    yearSelect.innerHTML = Array.from(
      { length: journalMonthPickerMaxYear - journalMonthPickerMinYear + 1 },
      (_, index) => {
        const year = journalMonthPickerMinYear + index;
        return `<option value="${year}">${year}년</option>`;
      },
    ).join("");
  }
  if (!monthSelect.options.length) {
    monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `<option value="${month}">${index + 1}월</option>`;
    }).join("");
  }
  yearSelect.value = yearValue;
  monthSelect.value = monthNumber;
  setJournalMonthPickerStatus();
  return normalizedMonth;
}

function openJournalMonthPicker() {
  const sheet = $("#journalMonthPickerSheet");
  if (!sheet || (!sheet.hidden && activeAppSheetId === sheet.id)) return false;
  prepareJournalMonthPicker();
  $("#journalMonthPickerButton")?.setAttribute("aria-expanded", "true");
  openAppSheet(sheet.id, { initialFocus: "#journalMonthPickerYear" });
  return true;
}

function closeJournalMonthPicker(fromHistory = false) {
  $("#journalMonthPickerButton")?.setAttribute("aria-expanded", "false");
  return closeAppSheet("journalMonthPickerSheet", fromHistory);
}

function applyJournalMonthPicker() {
  const yearValue = $("#journalMonthPickerYear")?.value || "";
  const monthValue = $("#journalMonthPickerMonth")?.value || "";
  const normalizedMonth = normalizeJournalMonthValue(`${yearValue}-${monthValue}`);
  if (!normalizedMonth) {
    setJournalMonthPickerStatus("선택한 연·월을 다시 확인해 주세요.", "error");
    $("#journalMonthPickerYear")?.focus({ preventScroll: true });
    return false;
  }
  const changed = applyJournalMonthNavigation(normalizedMonth);
  closeJournalMonthPicker();
  return changed;
}

function changeJournalMonth(delta) {
  const selectedDate = state.selectedJournalDate || localDateKey();
  const monthValue = state.activeJournalMonth || selectedDate.slice(0, 7);
  const [yearText, monthText] = monthValue.split("-");
  const nextMonth = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  const nextMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  applyJournalMonthNavigation(nextMonthValue);
}

const journalCalendarWeekdays = ["월", "화", "수", "목", "금", "토", "일"];

function normalizeJournalCalendarViewMode(mode = "") {
  return String(mode || "").toLowerCase() === "week" ? "week" : "month";
}

function journalWeekDateValues(dateValue = "") {
  const normalizedDate = normalizeJournalNavigationDate(dateValue) || localDateKey();
  const anchor = new Date(`${normalizedDate}T12:00:00`);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  anchor.setDate(anchor.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(anchor);
    value.setDate(anchor.getDate() + index);
    return localDateKey(value);
  });
}

function journalWeekRangeLabel(dateValues = []) {
  const first = normalizeJournalNavigationDate(dateValues[0]);
  const last = normalizeJournalNavigationDate(dateValues.at(-1));
  if (!first || !last) return "";
  const [firstYear, firstMonth, firstDay] = first.split("-").map(Number);
  const [lastYear, lastMonth, lastDay] = last.split("-").map(Number);
  if (firstYear === lastYear && firstMonth === lastMonth) return `${firstYear}년 ${firstMonth}월 ${firstDay}일~${lastDay}일`;
  if (firstYear === lastYear) return `${firstYear}년 ${firstMonth}월 ${firstDay}일~${lastMonth}월 ${lastDay}일`;
  return `${firstYear}년 ${firstMonth}월 ${firstDay}일~${lastYear}년 ${lastMonth}월 ${lastDay}일`;
}

function setJournalCalendarViewMode(mode = "month") {
  const normalizedMode = normalizeJournalCalendarViewMode(mode);
  const changed = normalizeJournalCalendarViewMode(state.journalCalendarViewMode) !== normalizedMode;
  state.journalCalendarViewMode = normalizedMode;
  renderJournalCalendar();
  return changed;
}

function changeJournalWeek(delta) {
  const selectedDate = normalizeJournalNavigationDate(state.selectedJournalDate) || localDateKey();
  const nextDate = new Date(`${selectedDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + (Number(delta) || 0) * 7);
  applyJournalNavigationDate(localDateKey(nextDate));
}

function changeJournalCalendarPeriod(delta) {
  if (normalizeJournalCalendarViewMode(state.journalCalendarViewMode) === "week") {
    changeJournalWeek(delta);
    return;
  }
  changeJournalMonth(delta);
}

function exportNtrpRequest(survey) {
  const shared = loadSharedData();
  const payload = {
    id: "ntrp-kimseojun",
    member: currentMemberName(),
    selfNtrp: survey.level,
    coachNtrp: state.profile.coachNtrp || "측정 전",
    status: "측정 요청",
    requestedAt: new Date().toISOString(),
    surveyAnswers: survey.answers,
    style: `${state.profile.hand} · ${state.profile.backhand}`,
    goal: state.profile.goal || "",
    memo: state.profile.styleMemo || "",
    references: ntrpReferences,
  };
  const index = shared.ntrpRequests.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.ntrpRequests[index] = { ...shared.ntrpRequests[index], ...payload };
  else shared.ntrpRequests.unshift(payload);
  saveSharedData(shared);
}
