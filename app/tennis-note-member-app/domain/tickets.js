// 이용권의 상태·제목·범위를 정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function isActiveRegularLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.refundHoldId || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "regular";
}

function isPausedRegularLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.refundHoldId || ticket.status !== "paused" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "regular";
}

function memberTicketCompactLabel(ticket = {}) {
  const title = ticket.title || ticket.productName || "회원권";
  return `${title} · ${memberCoachShortName(memberTicketLessonCoach(ticket.id))}`;
}

function ticketCountFromTitle(title = "") {
  const match = `${title}`.match(/(\d+)\s*회/);
  return match ? Number(match[1]) : 0;
}

function isActiveCouponLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.refundHoldId || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "coupon" || String(ticket.title || "").includes("쿠폰");
}

function liveTicketStatusInfo(status = "") {
  const key = String(status || "").toLowerCase();
  if (key === "active") return { label: "정상 이용중", tone: "done" };
  if (key === "paused") return { label: "휴회 · 복귀 시간 선택 가능", tone: "wait" };
  if (key === "pending_payment") return { label: "결제 확인 대기", tone: "wait" };
  if (key === "expired") return { label: "만료", tone: "wait" };
  if (["cancelled", "canceled", "refunded"].includes(key)) return { label: "취소", tone: "alert" };
  return { label: key || "상태 확인중", tone: "wait" };
}

function liveTicketProductTitle(row = {}) {
  const product = Array.isArray(row.tn_membership_products)
    ? row.tn_membership_products[0]
    : row.tn_membership_products || {};
  const lessonMinutes = Number(row.lesson_minutes || product.lesson_minutes || 20);
  const productKind = String(row.product_kind || product.product_kind || "");
  const fallbackTitle = `${lessonMinutes}분 ${productKind === "coupon" ? "쿠폰제" : "회원권"}`;
  const readableTitle = (value = "") => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/[?\uFFFD遺荑좏룿]/u.test(text)) return "";
    return /[가-힣A-Za-z0-9]/.test(text) ? text : "";
  };
  const productTitle = readableTitle(product.name);
  if (productTitle) return productTitle;
  const rowTitle = readableTitle(row.product_name);
  if (rowTitle) return rowTitle;
  return fallbackTitle;
}

function liveTicketScheduleScope(row = {}, product = {}) {
  const configuredScope = row.schedule_scope || product.schedule_scope || "";
  const productCode = String(row.product_code || product.product_code || "");
  if (productCode.startsWith("admin-ticket-")) return configuredScope;

  const productName = String(row.product_name || product.name || "");
  if (productName.includes("주말")) return "weekend";
  if (productName.includes("평일")) return "weekday";
  return configuredScope;
}

function normalizeLiveTicket(row = {}) {
  const product = Array.isArray(row.tn_membership_products)
    ? row.tn_membership_products[0]
    : row.tn_membership_products || {};
  const payment = Array.isArray(row.tn_payments)
    ? row.tn_payments[0]
    : row.tn_payments || {};
  const total = Math.max(0, Number(row.total_sessions ?? product.total_sessions ?? 0));
  const used = Math.max(0, Number(row.used_sessions ?? 0));
  const remainingValue = row.remaining_sessions ?? Math.max(0, total - used);
  const remaining = Math.max(0, Number(remainingValue));
  const refundHoldId = row.refund_hold_refund_id || "";
  const statusInfo = refundHoldId
    ? { label: "환불 접수 · 송금 대기", tone: "alert" }
    : liveTicketStatusInfo(row.status);
  const configuredAnchorMinutes = row.makeup_anchor_minutes !== undefined
    ? row.makeup_anchor_minutes
    : product.makeup_anchor_minutes;
  return {
    id: row.id || "",
    branchId: row.branch_id || "",
    coachRoleId: row.coach_role_id || "",
    groupAccountId: row.shared_group_account_id || row.group_account_id || "",
    productId: row.product_id || product.id || "",
    productKind: row.product_kind || product.product_kind || "",
    lessonMinutes: Number(row.lesson_minutes || product.lesson_minutes || 20),
    frequencyPerWeek: Math.max(1, Number(row.frequency_per_week || product.frequency_per_week || 1)),
    groupSize: Number(row.group_size || product.group_size || 1),
    scheduleScope: liveTicketScheduleScope(row, product),
    maxSessionsPerDay: Number(row.max_sessions_per_day || product.max_sessions_per_day || 0),
    maxSessionsPerWeek: Number(row.max_sessions_per_week || product.max_sessions_per_week || 0),
    maxBookingDaysPerWeek: Number(row.max_booking_days_per_week || product.max_booking_days_per_week || 0),
    makeupAnchorMinutes: configuredAnchorMinutes === null
      ? null
      : numericValue(configuredAnchorMinutes, 40),
    productValidityDays: Math.max(0, Number(row.validity_days || product.validity_days || 0)),
    productGraceDays: Math.max(0, Number(row.grace_days || product.grace_days || 0)),
    title: liveTicketProductTitle({ ...row, tn_membership_products: product }),
    status: row.status || "",
    statusLabel: statusInfo.label,
    tone: statusInfo.tone,
    total,
    used,
    remaining,
    startsOn: row.starts_on || "",
    expiresOn: row.expires_on || "",
    createdAt: row.created_at || "",
    sourcePaymentId: row.source_payment_id || "",
    refundHoldId,
    refundHoldAt: row.refund_hold_at || "",
    paymentId: payment.id || row.source_payment_id || "",
    providerPaymentId: payment.provider_payment_id || row.provider_payment_id || "",
    paymentStatus: payment.status || "",
    paymentAmount: Number(payment.final_amount || payment.amount || 0),
    paymentMethod: payment.method || "card",
    refundedAmount: Number(payment.refunded_amount || 0),
    refundStatus: payment.refund_status || "none",
    refundReason: payment.refund_reason || "",
    refundBreakdown: payment.refund_breakdown && typeof payment.refund_breakdown === "object" ? payment.refund_breakdown : {},
    refundedAt: payment.refunded_at || "",
    sharedGroupTicket: Boolean(row.shared_group_ticket),
  };
}

function currentLiveTicket() {
  return currentLiveTickets()[0] || null;
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function membershipProducts() {
  const features = state.livePaymentOptions?.features || {};
  const featureEnabled = (product) => {
    const familyId = membershipProductFamilyId(product);
    if (familyId === "three-month") return features.threeMonth !== false;
    if (familyId === "one-day") return features.oneDay !== false;
    if (familyId === "coupon") return features.coupons !== false;
    return true;
  };
  if (state.dataMode === "live") {
    return state.liveMembershipProducts.filter((product) => product.status !== "hidden" && featureEnabled(product));
  }
  if (state.liveMembershipProducts.length) {
    return state.liveMembershipProducts.filter((product) => product.status !== "hidden" && featureEnabled(product));
  }
  const adminProducts = readAdminProducts();
  const mergedProducts = defaultProducts.map((defaultProduct) =>
    normalizeProduct(adminProducts.find((product) => product.id === defaultProduct.id), defaultProduct));
  const extraProducts = adminProducts.filter((product) => !defaultProducts.some((defaultProduct) => defaultProduct.id === product.id));
  return [...mergedProducts, ...extraProducts]
    .map((product) => ["coupon-20", "coupon-30", "group-20"].includes(product.id)
      ? { ...product, status: "hidden" }
      : product)
    .filter((product) => product.status !== "hidden" && featureEnabled(product));
}

function activeMembershipPresetId() {
  state.membershipSelectedFamilyId = membershipProductFamilyDefinition(state.membershipSelectedFamilyId).id;
  if (membershipPresetDefinitions.some((preset) => preset.id === state.membershipSelectedFamilyId)) {
    return state.membershipSelectedFamilyId;
  }
  return membershipPresetDefinitions.find(({ filters }) => (
    Object.entries(filters).every(([key, value]) => value === "all" || (state.membershipFilters[key] || "all") === value)
  ))?.id || "";
}

function matchesMembershipFilters(product, exceptKey = "") {
  return membershipFilterDefinitions.every(({ key }) => {
    if (key === exceptKey) return true;
    const selected = state.membershipFilters[key] || "all";
    return selected === "all" || membershipProductFacet(product, key) === selected;
  });
}

function filteredMembershipProducts(products = membershipProducts()) {
  if (["coupon", "one-day"].includes(state.membershipSelectedFamilyId)) {
    return membershipProductsForFamily(state.membershipSelectedFamilyId, products);
  }
  return products.filter((product) => matchesMembershipFilters(product));
}

function normalizeMembershipFilters(products) {
  for (let pass = 0; pass < membershipFilterDefinitions.length; pass += 1) {
    let changed = false;
    membershipFilterDefinitions.forEach(({ key }) => {
      const selected = state.membershipFilters[key] || "all";
      if (selected === "all") return;
      const isAvailable = products.some((product) =>
        membershipProductFacet(product, key) === selected && matchesMembershipFilters(product, key));
      if (!isAvailable) {
        state.membershipFilters[key] = "all";
        changed = true;
      }
    });
    if (!changed) break;
  }
}

function membershipPricingQuote(product = {}) {
  const productId = String(product.id || "");
  if (!productId || !state.membershipPricingQuotes || typeof state.membershipPricingQuotes !== "object") return null;
  return state.membershipPricingQuotes[productId] || null;
}

function activeTicketScheduleScope() {
  const selectedTicketId = String(state.selectedMemberScheduleTicketId || "");
  const ticket = currentLiveTickets().find((item) => String(item.id || "") === selectedTicketId)
    || currentLiveTicket();
  if (ticket?.scheduleScope) return ticket.scheduleScope;
  const title = `${ticket?.title || state.profile?.ticket || ""}`;
  return title.includes("주말") ? "weekend" : "weekday";
}

function memberBookableCouponTickets() {
  const policy = loadAdminSchedulePolicy();
  return (state.liveTickets || [])
    .filter((ticket) => isActiveCouponLiveTicket(ticket))
    .map((ticket) => {
      const coach = policy.coaches.find((item) => (
        String(item.serverRoleId || item.roleId || item.id || "") === String(ticket.coachRoleId || "")
      ));
      return {
        id: `coupon-ticket-${ticket.id}`,
        couponBooking: true,
        member_ticket_id: ticket.id,
        ticketId: ticket.id,
        coach_role_id: ticket.coachRoleId,
        coachRoleId: ticket.coachRoleId,
        lessonDate: "",
        day: "",
        time: "",
        coach: coach?.name || "담당 코치",
        member: currentMemberName(),
        type: `쿠폰 ${Number(ticket.lessonMinutes) || 20}분`,
        ticketTitle: ticket.title || "쿠폰제 회원권",
        remaining: Number(ticket.remaining) || 0,
        startsOn: ticket.startsOn || "",
        expiresOn: ticket.expiresOn || "",
        productValidityDays: Math.max(0, Number(ticket.productValidityDays) || 0),
        productGraceDays: Math.max(0, Number(ticket.productGraceDays) || 0),
        status: "coupon_booking",
        lessonSource: "coupon",
        durationMinutes: Number(ticket.lessonMinutes) || 20,
        makeupAnchorMinutes: Number.isFinite(Number(ticket.makeupAnchorMinutes))
          ? Math.min(100, Math.max(0, Number(ticket.makeupAnchorMinutes)))
          : 40,
        isOwnLesson: true,
      };
    });
}

function memberBookableRegularTickets() {
  const policy = loadAdminSchedulePolicy();
  return (state.liveTickets || [])
    .filter((ticket) => isActiveRegularLiveTicket(ticket) && !liveTicketHasUpcomingLesson(ticket))
    .map((ticket) => {
      const coach = policy.coaches.find((item) => (
        String(item.serverRoleId || item.id) === String(ticket.coachRoleId)
      ));
      return {
        id: `regular-ticket-${ticket.id}`,
        regularInitialBooking: true,
        member_ticket_id: ticket.id,
        ticketId: ticket.id,
        coach_role_id: ticket.coachRoleId,
        coachRoleId: ticket.coachRoleId,
        coach: coach?.name || "코치 자동 배정",
        member: currentMemberName(),
        type: "첫 정규시간 설정",
        ticketTitle: ticket.title || "정규 회원권",
        remaining: Number(ticket.remaining) || 0,
        startsOn: ticket.startsOn || "",
        expiresOn: ticket.expiresOn || "",
        frequencyPerWeek: Math.max(1, Number(ticket.frequencyPerWeek) || 1),
        scheduleScope: ticket.scheduleScope || "weekday",
        makeupAnchorMinutes: ticket.makeupAnchorMinutes,
        status: "regular_initial_booking",
        lessonSource: "regular",
        durationMinutes: Number(ticket.lessonMinutes) || 20,
        isOwnLesson: true,
      };
    });
}

function memberBookablePausedTickets() {
  const policy = loadAdminSchedulePolicy();
  return (state.liveTickets || [])
    .filter((ticket) => isPausedRegularLiveTicket(ticket))
    .map((ticket) => {
      const coach = policy.coaches.find((item) => (
        String(item.serverRoleId || item.id) === String(ticket.coachRoleId)
      ));
      return {
        id: `paused-ticket-${ticket.id}`,
        regularInitialBooking: true,
        resumePausedTicket: true,
        member_ticket_id: ticket.id,
        ticketId: ticket.id,
        coach_role_id: ticket.coachRoleId,
        coachRoleId: ticket.coachRoleId,
        coach: coach?.name || "코치 자동 배정",
        member: currentMemberName(),
        type: "휴회 복귀 시간 선택",
        ticketTitle: ticket.title || "정규 회원권",
        remaining: Number(ticket.remaining) || 0,
        startsOn: ticket.startsOn || "",
        expiresOn: ticket.expiresOn || "",
        frequencyPerWeek: Math.max(1, Number(ticket.frequencyPerWeek) || 1),
        scheduleScope: ticket.scheduleScope || "weekday",
        makeupAnchorMinutes: ticket.makeupAnchorMinutes,
        status: "paused_resume_booking",
        lessonSource: "regular",
        durationMinutes: Number(ticket.lessonMinutes) || 20,
        isOwnLesson: true,
      };
    });
}

function memberHasActiveLiveTicket() {
  return (state.liveTickets || []).some((ticket) =>
    !ticket.refundHoldId
    && String(ticket.status || "").toLowerCase() === "active"
    && Number(ticket.remaining) > 0);
}

function memberScheduleTicketOptions() {
  const byId = new Map();
  [...currentLiveTickets(), ...upcomingLiveTickets()].forEach((ticket) => {
    if (ticket?.id) byId.set(String(ticket.id), ticket);
  });
  (state.liveLessons || []).filter(isOwnMemberScheduleLesson).forEach((lesson) => {
    const ticketId = memberLessonTicketId(lesson);
    const ticket = (state.liveTickets || []).find((item) => String(item.id) === ticketId);
    if (ticketId && ticket && !ticket.refundHoldId) byId.set(ticketId, ticket);
  });
  return [...byId.values()];
}

function memberTicketLessonCoach(ticketId = "") {
  return (state.liveLessons || [])
    .filter((lesson) => isOwnMemberScheduleLesson(lesson) && memberLessonTicketId(lesson) === String(ticketId))
    .sort((left, right) => `${left.lessonDate || ""}T${left.time || ""}`.localeCompare(`${right.lessonDate || ""}T${right.time || ""}`))[0]?.coach
    || "담당 코치";
}

function ensureMemberScheduleTicketSelection(preferredTicketId = "") {
  const options = memberScheduleTicketOptions();
  const preferred = String(preferredTicketId || state.selectedMemberScheduleTicketId || "");
  if (options.some((ticket) => String(ticket.id) === preferred)) {
    state.selectedMemberScheduleTicketId = preferred;
    return preferred;
  }
  state.selectedMemberScheduleTicketId = String(options[0]?.id || "");
  return state.selectedMemberScheduleTicketId;
}

function memberBookingSourceTicket(source = {}) {
  const ticketId = memberLessonTicketId(source);
  return (state.liveTickets || []).find((ticket) => String(ticket.id) === String(ticketId)) || null;
}

function currentHoldingTicket(ticketId = state.selectedHoldingTicketId) {
  const liveTicket = currentLiveTickets().find((ticket) => String(ticket.id) === String(ticketId || ""))
    || currentLiveTicket();
  if (liveTicket) return liveTicket;
  if (state.member && state.ticketSyncStatus?.tone === "demo") {
    return {
      id: "demo-ticket-holding",
      branchId: "demo-branch",
      title: state.profile.ticket || "정기권",
      status: "active",
      total: 10,
      remaining: state.remaining,
      used: Math.max(0, 10 - state.remaining),
      startsOn: "2026-07-01",
      expiresOn: "2026-07-31",
      statusLabel: "데모 이용중",
    };
  }
  return null;
}

function memberEnrollmentAllowsProduct(product = {}) {
  if (["lesson_member", "former_lesson_member"].includes(memberKind())) return true;
  const enrollment = state.memberEnrollment;
  if (!enrollment || enrollment.form_version !== memberEnrollmentFormVersion) return false;
  if (!["submitted", "approved"].includes(String(enrollment.status || ""))) return false;
  if (isGroupMembershipProduct(product)) {
    return Number(enrollment.group_size || 1) === 2
      && Boolean(String(enrollment.partner_name || "").trim())
      && Boolean(String(enrollment.partner_phone || "").trim());
  }
  return true;
}

function purchaseFlowSourceTicket() {
  const flow = purchaseFlowState();
  return (state.liveTickets || []).find((ticket) => String(ticket.id || "") === String(flow.renewalTicketId || "")) || null;
}

function purchaseTicketLesson(ticket = {}) {
  return (state.liveLessons || []).find((lesson) => (
    String(lesson.ticketId || lesson.memberTicketId || lesson.member_ticket_id || "") === String(ticket.id || "")
    && !["cancelled", "canceled", "absent"].includes(String(lesson.status || "").toLowerCase())
  )) || null;
}

function memberPurchaseLifecycle() {
  if (currentLiveTickets().length) return "active";
  return latestPreviousMembershipTicket() ? "returning" : "new";
}

function selectPurchasePurpose(purpose = "") {
  const flow = purchaseFlowState();
  flow.showMoreSlots = false;
  flow.showAllProducts = false;
  const activeTickets = currentLiveTickets();
  if (purpose === "renew_same") {
    const sourceTicket = activeTickets.find((ticket) => String(ticket.id) === String(flow.renewalTicketId)) || activeTickets[0] || null;
    if (!sourceTicket) return;
    const lesson = purchaseTicketLesson(sourceTicket);
    flow.purchasePurpose = "renew_same";
    flow.renewalTicketId = sourceTicket.id || "";
    flow.scheduleMode = "keep";
    flow.coachRoleId = sourceTicket.coachRoleId || "";
    flow.coachName = sourceTicket.coach || memberScheduleTicketCoachName(sourceTicket) || "";
    flow.preferredDate = lesson?.lessonDate || "";
    flow.preferredDay = lesson?.day || "";
    flow.preferredTime = lesson?.time || "";
    flow.preferredSchedules = [];
    const matchingProduct = membershipProducts().find((product) => String(product.id) === String(sourceTicket.productId || ""))
      || recommendedMembershipProducts(membershipProducts(), membershipProductFamilyId(sourceTicket), sourceTicket)[0];
    if (matchingProduct) {
      flow.productId = matchingProduct.id;
      flow.familyId = membershipProductFamilyId(matchingProduct);
      flow.scheduleMode = purchaseUsesFlexibleCouponSchedule(matchingProduct, flow) ? "flex" : "keep";
      flow.productFrequency = purchaseProductFrequency(matchingProduct);
      if (["weekday", "weekend"].includes(membershipProductFacet(matchingProduct, "scheduleScope"))) {
        flow.productScheduleScope = membershipProductFacet(matchingProduct, "scheduleScope");
      }
    }
  } else if (purpose === "add_coach") {
    flow.purchasePurpose = "add_coach";
    flow.renewalTicketId = "";
    flow.scheduleMode = "change";
    flow.coachRoleId = "";
    flow.coachName = "";
    clearPurchaseSchedules();
  }
  saveSnapshot();
  renderMembershipPurchaseFlow();
  void refreshPurchaseScheduleAvailability();
}

function selectPurchaseFamily(familyId = "") {
  const family = membershipProductFamilyDefinition(familyId);
  const flow = purchaseFlowState();
  flow.familyId = family.id;
  if (family.id === "one-day") flow.purchasePurpose = "one_day";
  else if (flow.purchasePurpose === "one_day") flow.purchasePurpose = currentLiveTickets().length ? "add_coach" : "new_purchase";
  flow.productId = "";
  flow.showAllProducts = false;
  flow.discountIssueId = "";
  flow.discountSelectionMode = "auto";
  clearPurchasePaymentError();
  const keepingRenewal = flow.purchasePurpose === "renew_same" && Boolean(purchaseFlowSourceTicket());
  if (!keepingRenewal) {
    flow.coachRoleId = "";
    flow.coachName = "";
    clearPurchaseSchedules();
  }
  flow.showMoreSlots = false;
  state.membershipFilters = { ...family.filters };
  state.membershipSelectedFamilyId = family.id;
  saveSnapshot();
  if (flow.open) renderMembershipPurchaseFlow();
  else renderProducts();
}

function selectPurchaseProduct(productId = "") {
  const product = membershipProducts().find((item) => (
    String(item.id || "") === String(productId || "")
    && isDirectPurchaseMembershipProduct(item)
  ));
  if (!product) return;
  const flow = purchaseFlowState();
  const productChanged = String(flow.productId || "") !== String(product.id || "");
  if (productChanged) {
    flow.showMoreSlots = false;
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
    clearPurchasePaymentError();
  }
  flow.productId = product.id;
  flow.familyId = membershipProductFamilyId(product);
  flow.productFrequency = purchaseProductFrequency(product);
  if (["weekday", "weekend"].includes(membershipProductFacet(product, "scheduleScope"))) {
    flow.productScheduleScope = membershipProductFacet(product, "scheduleScope");
  }
  if (flow.familyId === "one-day") {
    flow.purchasePurpose = "one_day";
    flow.renewalTicketId = "";
    flow.scheduleMode = "change";
  } else if (flow.purchasePurpose === "one_day") {
    flow.purchasePurpose = currentLiveTickets().length ? "add_coach" : "new_purchase";
  }
  if (purchaseUsesFlexibleCouponSchedule(product, flow)) {
    flow.scheduleMode = "flex";
    clearPurchaseSchedules();
  } else if (flow.purchasePurpose !== "renew_same" || !flow.renewalTicketId) {
    flow.scheduleMode = "change";
  }
  if (productChanged && !flow.renewalTicketId) {
    flow.coachRoleId = "";
    flow.coachName = "";
    clearPurchaseSchedules();
  }
  if (!flow.open) {
    openMembershipPurchaseFlow("", product.id);
    return;
  }
  saveSnapshot();
  renderMembershipPurchaseFlow();
  void refreshPurchaseScheduleAvailability();
  if (productChanged && product.branchId) {
    void syncMemberPaymentOptionsFromServer(product.branchId).then(() => renderMembershipPurchaseFlow());
  }
}

function availableDiscountCoupons() {
  return (state.discountCoupons || []).filter((coupon) => discountCouponStatus(coupon).label === "사용 가능");
}

function liveTicketHasUpcomingLesson(ticket, today = localDateKey()) {
  return (state.liveLessons || []).some((lesson) => {
    if (String(lesson.member_ticket_id || lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    const status = lesson.serverStatus || lesson.status || "scheduled";
    return !["cancelled", "completed", "confirmed", "no_show"].includes(status);
  });
}

async function checkPendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || currentLiveTicket();
  const paymentId = ticket?.providerPaymentId || "";
  if (!ticket || !paymentId) {
    state.ticketSyncStatus = { tone: "alert", text: "결제 기록 연결 확인 필요 · 새 결제 전 관리자 화면 확인" };
    state.pendingPaymentCheckStatus = { tone: "alert", text: "결제 기록을 찾지 못했습니다. 새 결제 전 관리자 화면을 먼저 확인해주세요." };
    state.ticketHistory.unshift({ text: "대기 회원권의 결제 기록을 아직 찾지 못했습니다.", tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }

  state.ticketSyncStatus = { tone: "wait", text: "결제 상태 서버 확인 중" };
  state.pendingPaymentCheckStatus = { tone: "wait", text: "결제 상태를 확인하는 중입니다." };
  renderProducts();
  try {
    const verification = await verifyServerPayment(paymentId);
    if (verification?.ok) {
      state.pendingPaymentCheckStatus = { tone: "done", text: "서버 검증이 완료되었습니다. 회원권 상태를 새로 확인합니다." };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제 검증 완료 · 회원권 활성화 확인`, tone: "done" });
    } else if (verification?.code === "payment_not_paid") {
      state.pendingPaymentCheckStatus = { tone: "wait", text: "아직 결제 완료 전입니다. 결제창에서 결제를 마친 뒤 다시 눌러주세요." };
      state.ticketHistory.unshift({ text: `${ticket.title} 아직 결제 완료 전 · 결제 완료 후 다시 확인`, tone: "wait" });
      state.ticketSyncStatus = { tone: "wait", text: "아직 결제 완료 전 · 결제창 완료 후 다시 확인" };
    } else {
      state.pendingPaymentCheckStatus = { tone: "alert", text: `결제 확인이 필요합니다. ${verification?.code || "서버 응답을 확인해주세요."}` };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제 확인 필요 · ${verification?.code || "서버 응답 확인"}`, tone: "alert" });
      state.ticketSyncStatus = { tone: "alert", text: "결제 확인 필요 · 관리자 확인" };
    }
  } catch (error) {
    const code = paymentServerErrorMessage(error);
    const isNotPaid = code === "payment_not_paid";
    state.ticketHistory.unshift({
      text: isNotPaid
        ? `${ticket.title} 아직 결제 완료 전 · 결제 후 다시 확인`
        : `${ticket.title} 결제 검증 실패 · ${code}`,
      tone: isNotPaid ? "wait" : "alert",
    });
    state.pendingPaymentCheckStatus = {
      tone: isNotPaid ? "wait" : "alert",
      text: isNotPaid ? "아직 결제 완료 전입니다. 결제창에서 결제를 마친 뒤 다시 확인해주세요." : `결제 검증 실패: ${code}`,
    };
    state.ticketSyncStatus = {
      tone: isNotPaid ? "wait" : "alert",
      text: isNotPaid ? "아직 결제 완료 전 · 결제 후 다시 확인" : `결제 검증 실패 · ${code}`,
    };
  }
  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

async function resumePendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || currentLiveTicket();
  const paymentId = ticket?.providerPaymentId || "";
  const amount = Number(ticket?.paymentAmount || 0);
  const methodId = String(ticket?.paymentMethod || "").toLowerCase();
  if (ticket && (!isPaymentMethodAllowed(methodId) || !isPaymentGatewayReady(methodId))) {
    state.pendingPaymentCheckStatus = {
      tone: "alert",
      text: "기존 결제 대기건은 재개할 수 없습니다. 토스페이로 새 결제를 시작해 주세요.",
    };
    state.ticketHistory.unshift({ text: `${ticket.title || "회원권"} 기존 결제 대기 재개 차단 · 토스페이 신규 결제 필요`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }
  if (!ticket || !paymentId || !amount || !isPaymentGatewayReady(methodId)) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "기존 결제창을 열 결제 기록이나 결제 설정을 확인해주세요." };
    renderAll();
    setView("shopView");
    return;
  }

  try {
    const PortOne = await loadPortOneSdk();
    const response = await PortOne.requestPayment(portOnePaymentRequest({
      paymentId,
      productId: ticket.productId,
      orderName: ticket.title,
      totalAmount: amount,
      methodId,
    }));

    if (response?.code) {
      await reconcileRejectedServerPayment(response?.paymentId || paymentId);
      await syncMemberTicketsFromServer();
      const providerError = { payload: { code: response.code, message: response.message }, message: response.message };
      const detail = paymentServerErrorMessage(providerError);
      reportPaymentProviderError(providerError, "payment_resume_response");
      state.pendingPaymentCheckStatus = { tone: "alert", text: detail };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제창 종료 · 결제 미완료`, tone: "alert" });
    } else {
      state.pendingPaymentCheckStatus = { tone: "wait", text: "결제창 완료 접수 · 서버 검증을 확인합니다." };
      await checkPendingTicketPayment(ticketId);
      return;
    }
  } catch (error) {
    const detail = paymentServerErrorMessage(error);
    reportPaymentProviderError(error, "payment_resume_open");
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창을 열지 못했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제창 열기 실패`, tone: "alert" });
  }

  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

async function startProductPayment(productId, options = {}) {
  const product = membershipProducts().find((item) => item.id === productId);
  if (!product) return;
  const methodId = normalizeSelectedPaymentMethod();
  const paymentAmount = purchasePaymentAmount(product, methodId);
  if (!paymentAmount || product.status === "consult") {
    requestProduct(productId);
    const flow = purchaseFlowState();
    flow.productId = product.id;
    flow.open = true;
    flow.step = 4;
    flow.completionStatus = "상담 요청이 접수되었습니다";
    saveSnapshot();
    renderProducts();
    return;
  }

  const method = paymentMethodDefinition(methodId);
  if (!options.skipEnrollmentGate && state.member && !memberEnrollmentAllowsProduct(product)) {
    openMemberEnrollmentModal(productId);
    return;
  }
  if (!hasLiveMemberSession()) {
    markTicketSyncLoginNeeded();
    state.pendingPaymentCheckStatus = { tone: "alert", text: "서버 로그인 후 결제할 수 있습니다. 간편 로그인으로 다시 접속해주세요." };
    state.ticketHistory.unshift({ text: `${product.title} 결제 전 서버 로그인 필요`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }
  const pricingQuote = membershipPricingQuote(product);
  const paymentId = pricingQuote?.eligible && pricingQuote?.reservedPaymentId
    ? String(pricingQuote.reservedPaymentId)
    : createProviderPaymentId(product.id);
  if (!isPaymentGatewayReady(methodId)) {
    createPaymentRecord(product, {
      paymentId,
      method: `${method.label} 설정 필요`,
      status: `${product.flow} · 결제 채널 연결 후 결제 가능`,
    });
    state.ticketHistory.unshift({ text: `${product.title} 결제 준비 · ${method.label} 연결 필요`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }
  if (methodId === "naverpay" && paymentAmount < 100) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "네이버페이는 100원 이상부터 결제할 수 있습니다." };
    renderAll();
    setView("shopView");
    return;
  }

  if (methodId === "bank_transfer") {
    clearPurchasePaymentError();
    try {
      const prepared = await prepareServerPayment(product, paymentId, methodId);
      const effectivePaymentId = String(prepared?.paymentId || paymentId);
      createPaymentRecord(product, {
        paymentId: effectivePaymentId,
        serverPaymentId: prepared?.localPaymentId || "",
        methodId,
        method: method.label,
        status: "입금 확인 대기",
        bankTransferAccount: prepared?.bankTransferAccount || null,
      });
      state.pendingPaymentCheckStatus = {
        tone: "wait",
        text: prepared?.reusedPurchaseIntent
          ? "진행 중인 계좌이체 요청을 다시 열었습니다. 같은 요청은 한 건으로 관리됩니다."
          : "계좌이체 신청이 접수되었습니다. 입금 확인 후 회원권이 발급됩니다.",
      };
      state.ticketHistory.unshift({ text: `${product.title} 계좌이체 신청 · 입금 확인 대기`, tone: "wait" });
      completeMembershipPurchaseFlow("계좌이체 신청이 접수되었습니다");
      await Promise.allSettled([syncMemberPendingPurchaseSchedulesFromServer(), syncMemberDiscountCouponsFromServer()]);
      saveSnapshot();
      renderAll();
      setView("shopView");
      openBankTransferInstructions(prepared, product, paymentAmount);
    } catch (error) {
      const flow = purchaseFlowState();
      const serverCode = String(error?.payload?.code || error?.message || "bank_transfer_request_failed");
      const detail = paymentServerErrorMessage(error);
      flow.paymentErrorCode = serverCode;
      if (serverCode === "bank_transfer_account_not_ready") {
        await syncMemberPaymentOptionsFromServer(product.branchId).catch(() => false);
        state.selectedPaymentMethod = "tosspay";
        normalizeSelectedPaymentMethod();
        flow.paymentErrorMessage = "현재 계좌이체를 사용할 수 없어 토스페이로 변경했습니다. 선택한 상품·시간·쿠폰은 유지됩니다.";
      } else if (serverCode === "bank_transfer_account_lookup_failed") {
        flow.paymentErrorMessage = "입금 계좌를 확인하지 못했습니다. 선택 내용은 유지했으며 다시 확인할 수 있습니다.";
      } else {
        flow.paymentErrorMessage = `계좌이체 신청에 실패했습니다. ${detail}`;
      }
      state.pendingPaymentCheckStatus = { tone: "alert", text: flow.paymentErrorMessage };
      state.ticketHistory.unshift({ text: `${product.title} 계좌이체 신청 실패 · ${detail}`, tone: "alert" });
      saveSnapshot();
      renderAll();
      setView("shopView");
    }
    return;
  }

  try {
    const sdk = await loadPortOneSdk();
    openPaymentConfirmationModal({ product, paymentId, preparedPayment: null, methodId, sdk });
  } catch (error) {
    const detail = paymentServerErrorMessage(error);
    reportPaymentProviderError(error, "payment_sdk_load");
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창 준비에 실패했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${product.title} 결제창 준비 실패 · ${detail}`, tone: "alert" });
    renderAll();
    setView("shopView");
  }
}

function startCouponBooking(ticketId) {
  state.selectedMemberScheduleTicketId = String(ticketId || "");
  const sourceId = `coupon-ticket-${ticketId}`;
  void openMemberChangeTimetable(sourceId);
}

function rawCurrentLiveTickets() {
  if (!Array.isArray(state.liveTickets) || !state.liveTickets.length) return [];
  const usableTickets = window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(state.liveTickets).current
    : state.liveTickets.filter((ticket) => ["active", "paused"].includes(String(ticket.status || "").toLowerCase()));
  if (!usableTickets.length) return [];
  return [...usableTickets].filter((ticket) => !ticket.refundHoldId).sort((a, b) => {
    const priority = liveTicketPriority(a) - liveTicketPriority(b);
    if (priority) return priority;
    const sharedGroupPriority = Number(Boolean(b.sharedGroupTicket && Number(b.groupSize) === 2))
      - Number(Boolean(a.sharedGroupTicket && Number(a.groupSize) === 2));
    if (sharedGroupPriority) return sharedGroupPriority;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function canonicalCurrentLiveTickets(ticketList = []) {
  return ticketList.reduce((result, ticket) => {
    const planKey = liveTicketRenewalPlanKey(ticket);
    const existingIndex = planKey ? result.findIndex((candidate) => (
      liveTicketRenewalPlanKey(candidate) === planKey
      && liveTicketDateRangesOverlap(candidate, ticket)
    )) : -1;
    if (existingIndex < 0) result.push(ticket);
    else result[existingIndex] = preferredRenewalOverlapTicket(result[existingIndex], ticket);
    return result;
  }, []);
}

function liveTicketAggregate(ticketList = currentLiveTickets()) {
  const tickets = Array.isArray(ticketList) ? ticketList : [];
  return tickets.reduce((summary, ticket) => ({
    count: summary.count + 1,
    total: summary.total + Math.max(0, Number(ticket?.total) || 0),
    used: summary.used + Math.max(0, Number(ticket?.used) || 0),
    remaining: summary.remaining + Math.max(0, Number(ticket?.remaining) || 0),
  }), { count: 0, total: 0, used: 0, remaining: 0 });
}

function liveTicketRenewalPlanKey(ticket = {}) {
  const productId = String(ticket.productId || "");
  const coachRoleId = String(ticket.coachRoleId || "");
  if (!productId || !coachRoleId) return "";
  return [productId, coachRoleId, String(ticket.groupAccountId || "")].join("|");
}

function liveTicketDateRangesOverlap(left = {}, right = {}) {
  if (!left.startsOn || !left.expiresOn || !right.startsOn || !right.expiresOn) return false;
  return left.startsOn <= right.expiresOn && right.startsOn <= left.expiresOn;
}

function currentLiveTicketOverlapCount() {
  const rawTickets = rawCurrentLiveTickets();
  return Math.max(0, rawTickets.length - canonicalCurrentLiveTickets(rawTickets).length);
}

function preferredRenewalOverlapTicket(left = {}, right = {}) {
  const leftReferences = liveTicketLessonReferenceCount(left);
  const rightReferences = liveTicketLessonReferenceCount(right);
  if (leftReferences !== rightReferences) return leftReferences > rightReferences ? left : right;
  const leftUsed = Math.max(0, Number(left.used) || 0);
  const rightUsed = Math.max(0, Number(right.used) || 0);
  if (leftUsed !== rightUsed) return leftUsed > rightUsed ? left : right;
  const startOrder = String(left.startsOn || "").localeCompare(String(right.startsOn || ""));
  if (startOrder) return startOrder < 0 ? left : right;
  return String(left.createdAt || "").localeCompare(String(right.createdAt || "")) <= 0 ? left : right;
}

function liveTicketForLesson(lesson = null) {
  const ticketId = lesson ? memberLessonTicketId(lesson) : "";
  if (!ticketId) return null;
  return (state.liveTickets || []).find((ticket) => String(ticket.id || "") === ticketId) || null;
}

function liveTicketLessonReferenceCount(ticket = {}) {
  const ticketId = String(ticket.id || "");
  if (!ticketId) return 0;
  return (state.lessons || []).filter((lesson) => memberLessonTicketId(lesson) === ticketId).length;
}
