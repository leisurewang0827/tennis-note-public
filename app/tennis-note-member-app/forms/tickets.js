// tickets 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function membershipProductFromServer(row = {}) {
  const productKind = String(row.product_kind || "regular");
  const mode = productKind === "coupon" ? "pass" : productKind === "group" ? "group" : "fixed";
  const sessions = numericValue(row.total_sessions);
  const lessonMinutes = numericValue(row.lesson_minutes, 20);
  const groupSize = numericValue(row.group_size, 1);
  const frequency = numericValue(row.frequency_per_week);
  const group = productKind === "coupon" ? "쿠폰제" : groupSize === 2 ? "2대1 정기권" : "정기권";
  const couponValidityWeeks = window.TennisNoteProductCatalog?.policy?.coupon?.validityWeeksBySessions || {};
  const oneDay = isOneDayMembershipProduct(row);
  const savedStatus = row.policy_settings?.adminSaleStatus;
  const status = ["sale", "consult", "hidden"].includes(savedStatus)
    ? savedStatus
    : productKind === "coupon" && !oneDay && ![5, 10, 15, 20].includes(sessions)
      ? "hidden"
      : row.is_active === false ? "hidden" : "sale";
  return normalizeProduct({
    id: row.id,
    branchId: row.branch_id || "",
    productCode: row.product_code || "",
    purchaseExperience: row.policy_settings?.purchaseExperience || (oneDay ? "one_day" : ""),
    firstLessonOfferEnabled: row.policy_settings?.firstLessonOfferEnabled === true,
    firstLessonOfferPrice: numericValue(row.policy_settings?.firstLessonOfferPrice, 15000),
    coachSaleAvailability: row.policy_settings?.coachSaleAvailability || {},
    coachSaleMode: row.policy_settings?.coachSaleMode === "selected" ? "selected" : "all_active",
    group,
    title: row.name || `${lessonMinutes}분 회원권`,
    name: row.name,
    detail: `${lessonMinutes}분 레슨${numericValue(row.machine_minutes) ? ` + ${numericValue(row.machine_minutes)}분 개인연습` : ""}`,
    format: groupSize === 2 ? "2대1" : "1대1",
    listAmount: numericValue(row.card_price),
    amount: numericValue(row.card_price),
    cardAmount: numericValue(row.card_price),
    cashAmount: numericValue(row.cash_price),
    settlementBase: numericValue(row.settlement_base_price, numericValue(row.cash_price)),
    tickets: sessions,
    validityDays: numericValue(row.validity_days, productKind === "coupon" ? Number(couponValidityWeeks[sessions] || 0) * 7 : 35),
    graceDays: numericValue(row.grace_days),
    lessonMinutes,
    groupSize,
    frequencyPerWeek: frequency,
    maxSessionsPerDay: numericValue(row.max_sessions_per_day),
    maxSessionsPerWeek: numericValue(row.max_sessions_per_week),
    maxBookingDaysPerWeek: numericValue(row.max_booking_days_per_week),
    makeupAnchorMinutes: row.makeup_anchor_minutes === null
      ? null
      : numericValue(row.makeup_anchor_minutes, 40),
    scheduleScope: ["weekday", "weekend", "mixed"].includes(row.schedule_scope) ? row.schedule_scope : "weekday",
    termWeeks: numericValue(row.term_weeks),
    productKind,
    discountEnabled: row.discount_enabled !== false,
    coachDiscountAllowed: Boolean(row.coach_discount_allowed),
    coach: "선택한 코치 전용",
    flow: productKind === "coupon" ? "날짜 선택 → 코치 가능시간 확인 → 결제" : "시간 선택 → 코치 확정 → 결제",
    mode,
    discount: row.discount_enabled === false ? "할인 적용 불가" : "관리자 할인 정책 적용",
    badge: productKind === "coupon" ? `${sessions}회` : frequency ? `주 ${frequency}회` : `${sessions}회`,
    rule: productKind === "coupon" ? "선택한 코치의 가능 시간에 예약합니다." : "담당 코치와 고정 시간을 연결합니다.",
    status,
  });
}

function memberScheduleCoachTickets() {
  const visibleStates = new Set(["current", "upcoming", "paused"]);
  return (state.liveTickets || []).filter((ticket) => {
    const derived = window.TennisNoteTicketState?.derive?.(ticket)
      || String(ticket.status || "").toLowerCase();
    return visibleStates.has(derived) && String(ticket.coachRoleId || "").trim();
  });
}

function movePurchaseStep(direction = 1) {
  const flow = purchaseFlowState();
  if (direction > 0 && !purchaseStepCanContinue()) return;
  flow.step = Math.min(3, Math.max(1, flow.step + direction));
  saveSnapshot();
  renderMembershipPurchaseFlow();
  if (flow.step === 2) void refreshPurchaseScheduleAvailability();
  window.requestAnimationFrame(() => $("#membershipPurchaseFlow")?.scrollIntoView({ block: "start" }));
}

function liveTicketPriority(ticket = {}) {
  const derivedState = window.TennisNoteTicketState?.derive(ticket);
  if (derivedState) return window.TennisNoteTicketState.rank(ticket);
  if (ticket.status === "active") return 0;
  if (ticket.status === "pending_payment") return 1;
  if (ticket.status === "paused") return 2;
  if (["expired", "cancelled", "canceled", "refunded"].includes(String(ticket.status || "").toLowerCase())) return 4;
  return 3;
}

function currentLiveTickets() {
  if (!Array.isArray(state.liveTickets) || !state.liveTickets.length) return [];
  const usableTickets = window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(state.liveTickets).current
    : state.liveTickets.filter((ticket) => ["active", "paused"].includes(String(ticket.status || "").toLowerCase()));
  if (!usableTickets.length) return [];
  return [...usableTickets].sort((a, b) => {
    const priority = liveTicketPriority(a) - liveTicketPriority(b);
    if (priority) return priority;
    const sharedGroupPriority = Number(Boolean(b.sharedGroupTicket && Number(b.groupSize) === 2))
      - Number(Boolean(a.sharedGroupTicket && Number(a.groupSize) === 2));
    if (sharedGroupPriority) return sharedGroupPriority;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function upcomingLiveTickets() {
  if (!Array.isArray(state.liveTickets) || !state.liveTickets.length) return [];
  return window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(state.liveTickets).upcoming
    : state.liveTickets.filter((ticket) => ticket.status === "pending_payment");
}
