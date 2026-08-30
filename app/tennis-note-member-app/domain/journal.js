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

function selectJournalDate(dateValue) {
  if (!dateValue) return;
  state.selectedJournalDate = dateValue;
  state.activeJournalMonth = dateValue.slice(0, 7);
  renderJournalCalendar();
  saveSnapshot();
}

function changeJournalMonth(delta) {
  const selectedDate = state.selectedJournalDate || localDateKey();
  const monthValue = state.activeJournalMonth || selectedDate.slice(0, 7);
  const [yearText, monthText] = monthValue.split("-");
  const nextMonth = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  const nextMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  state.activeJournalMonth = nextMonthValue;
  if (!selectedDate.startsWith(nextMonthValue)) state.selectedJournalDate = `${nextMonthValue}-01`;
  renderJournalCalendar();
  saveSnapshot();
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
