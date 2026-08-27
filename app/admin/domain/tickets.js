// 이용권(ticket) 판정·표시 문구를 만드는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다
// (기본값 이음매를 거친 함수 포함). app.js 에서 본문 그대로 옮겨왔고
// 전역 함수 선언이라 호출부는 예전과 같다.

function getCoachName(coachId, allCoaches = coaches) {
  return allCoaches.find((coach) => coach.id === coachId)?.name || "미배정";
}

function ticketHasFutureRegularLesson(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  return allLessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    if (["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson))) return false;
    return lessonSourceValue(lesson) === "regular";
  });
}

function ticketFutureRegularScheduleCoverage(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const anchors = new Map();
  allLessons.forEach((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket?.id || "")) return;
    if (!lesson.lessonDate || lesson.lessonDate < today) return;
    if (["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson))) return;
    if (lessonSourceValue(lesson) !== "regular") return;
    const key = [lesson.day || "", lesson.time || "", lessonScheduleCoachId(lesson) || ""].join("|");
    const units = Math.max(1, Math.ceil((Number(lesson.durationMinutes) || baseMinutes) / baseMinutes));
    anchors.set(key, Math.max(anchors.get(key) || 0, units));
  });
  return [...anchors.values()].reduce((sum, units) => sum + units, 0);
}

function ticketHasUpcomingLesson(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  return allLessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    return !["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson));
  });
}

function normalizeMemberManagementTicketPayload(payload = null) {
  if (!payload?.productId) return payload;
  const total = Number(payload.totalSessions);
  const used = Number(payload.usedSessions);
  if (Number.isFinite(total) && Number.isFinite(used)) {
    payload.remainingSessions = Math.max(0, total - used);
  }
  if (Number(payload.remainingSessions) <= 0) {
    payload.ticketStatus = "expired";
    payload.recordStatus = "historical";
  } else if (!payload.ticketStatus) {
    payload.ticketStatus = "active";
    payload.recordStatus = "active";
  }
  return payload;
}

function memberTicketOwnershipLabel(ticket, member, allLiveData = adminLiveDataState) {
  const ownerUserId = String(ticket?.serverUserId || "");
  if (!ownerUserId) return "";
  const ownUserIds = new Set(memberServerUserIds(member).map(String));
  if (ownUserIds.has(ownerUserId)) return "본인권";
  const ownerName = (allLiveData.users || []).find((user) => String(user.id || "") === ownerUserId)?.name || "";
  return ownerName ? `파트너권 · ${ownerName}` : "파트너권";
}

function memberPossibleDuplicateTicketIds(managedTickets = []) {
  const ticketsByFingerprint = new Map();
  managedTickets.forEach((ticket) => {
    const fingerprint = memberTicketDuplicateFingerprint(ticket);
    if (!fingerprint) return;
    const grouped = ticketsByFingerprint.get(fingerprint) || [];
    grouped.push(ticket);
    ticketsByFingerprint.set(fingerprint, grouped);
  });
  return new Set([...ticketsByFingerprint.values()]
    .filter((grouped) => grouped.length > 1)
    .flatMap((grouped) => grouped.map((ticket) => String(ticket.serverTicketId || ""))));
}

function memberTicketCoachLabel(member, ticket, allLiveData = adminLiveDataState) {
  if (!ticket) return member.coach || "미배정";
  const coachRole = (allLiveData.coachRoles || []).find((role) => role.id === ticket.coachRoleId);
  if (coachRole?.display_name) return coachRole.display_name;
  return getCoachName(ticket.coachId) || member.coach || "미배정";
}

function memberInlineTicketDefinitionChanged(form) {
  if (!form?.dataset.ticketId) return false;
  return String(form.elements.productId?.value || "") !== String(form.dataset.initialProductId || "")
    || String(form.elements.coachRoleId?.value || "") !== String(form.dataset.initialCoachRoleId || "");
}

function memberOwnsTicket(ticket, member, allLiveData = adminLiveDataState) {
  if (!ticket || !member) return false;
  const userIds = memberServerUserIds(member);
  if (userIds.length) return userIds.includes(ticket.serverUserId);
  const ownerName = (allLiveData.users || []).find((user) => user.id === ticket.serverUserId)?.name;
  return ownerName === member.name;
}

function memberTicketLessonSetupError(error) {
  const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
  if (raw.includes("group_partner_required")) return "2대1 수업은 파트너를 선택해주세요";
  if (raw.includes("partner_must_be_different")) return "대표 회원과 다른 파트너를 선택해주세요";
  if (raw.includes("partner_not_found")) return "선택한 파트너 정보를 다시 확인해주세요";
  if (raw.includes("lesson_duration_conflict")) return "변경한 수업 시간이 다른 수업과 겹칩니다. 시간표를 먼저 조정해주세요";
  if (raw.includes("admin_role_required")) return "관리자 권한으로 로그인해주세요";
  return "수업 설정 저장에 실패했습니다";
}

function onsitePaymentTicketLabel(ticket) {
  const coach = getCoachName(ticket.coachId || "") || "코치 미배정";
  const period = [ticket.purchased, ticket.expires].filter(Boolean).join("~");
  return `${ticket.product || "회원권"} · ${coach} · 잔여 ${Number(ticket.remaining) || 0}회${period ? ` · ${period}` : ""}`;
}

function getTicketWeeklyUnitLimit(ticket) {
  const weeklyCount = Math.max(1, getTicketWeeklyCount(ticket));
  const explicitWeeklyLimit = Number(ticket?.maxSessionsPerWeek) || 0;
  const dailyLimit = Number(ticket?.maxSessionsPerDay) || 0;
  return Math.max(weeklyCount, explicitWeeklyLimit || dailyLimit || weeklyCount);
}

function getTicketLessonKind(ticket) {
  if (!ticket) return "";
  if (ticket.lessonKind) return ticket.lessonKind;
  if (ticket.product?.includes("2대1")) return "2대1";
  if (ticket.product?.includes("그룹")) return "그룹";
  return "개인";
}

function getTicketScheduleScope(ticket) {
  return ["weekday", "weekend", "mixed"].includes(ticket?.scheduleScope) ? ticket.scheduleScope : "weekday";
}

function getTicketScheduleDays(ticket, allScheduleDays = scheduleDays) {
  const scope = getTicketScheduleScope(ticket);
  if (scope === "mixed") return [...scheduleDays];
  return scope === "weekend" ? allScheduleDays.slice(5) : allScheduleDays.slice(0, 5);
}

function ticketAllowsScheduleDay(ticket, day) {
  return getTicketScheduleDays(ticket).includes(day);
}

function ticketUsageLabel(ticket) {
  const total = Math.max(0, Number(ticket?.total) || 0);
  const used = Math.max(0, Number(ticket?.used) || 0);
  const remaining = Math.max(0, Number(ticket?.remaining) || 0);
  return `총 ${total} / 소진 ${used} / 잔여 ${remaining}`;
}

function getTicketOptionLabel(ticket) {
  return `${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function linkedTicketForBilling(item = {}) {
  return [...tickets, ...expiredTickets].find((ticket) => (
    String(ticket.serverTicketId || ticket.id || "") === String(item.ticketId || "")
  )) || null;
}

function ticketReviewLinkContext(allLiveData = adminLiveDataState) {
  const activeLinks = (allLiveData.groupTicketLinks || []).filter((link) => (
    ["active", "linked"].includes(String(link.status || "active").toLowerCase())
    && link.group_account_id
  ));
  const byAccount = new Map();
  const accountIdsByTicket = new Map();
  activeLinks.forEach((link) => {
    const accountId = String(link.group_account_id);
    const account = byAccount.get(accountId) || { userIds: new Set(), ticketIds: new Set() };
    if (link.user_id) account.userIds.add(String(link.user_id));
    if (link.ticket_id) {
      const ticketId = String(link.ticket_id);
      account.ticketIds.add(ticketId);
      const accountIds = accountIdsByTicket.get(ticketId) || new Set();
      accountIds.add(accountId);
      accountIdsByTicket.set(ticketId, accountIds);
    }
    byAccount.set(accountId, account);
  });
  return { byAccount, accountIdsByTicket };
}

function liveTicketParticipantIds(ticket, ticketParticipants = []) {
  if (ticketParticipants instanceof Map) {
    return [...new Set([
      ticket.user_id,
      ...(ticketParticipants.get(ticket.id) || []),
    ].filter(Boolean))];
  }
  return [...new Set([
    ticket.user_id,
    ...ticketParticipants.filter((item) => item.ticket_id === ticket.id).map((item) => item.user_id),
  ].filter(Boolean))];
}

function liveTicketLessonKind(product = {}) {
  return Number(product.group_size) === 2 ? "2대1" : "개인";
}

function managementReportTicketIsActive(ticket = {}, today = adminLocalDateKey(new Date())) {
  if (["expired", "cancelled", "inactive"].includes(String(ticket.status || "").toLowerCase())) return false;
  if (Number(ticket.remaining) <= 0) return false;
  if (ticket.starts && ticket.starts > today) return false;
  return !ticket.expires || ticket.expires >= today;
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function operationBranchTickets(source = tickets) {
  return source.filter((ticket) => matchesActiveOperationBranch(ticket.branchId));
}

function membershipProductsForActiveOperationProfile() {
  const branchId = activeOperationBranchId();
  if (!branchId) return membershipProductDrafts;
  return membershipProductDrafts.filter((product) => !product.branchId || String(product.branchId) === branchId);
}

function normalizeMembershipProduct(product = {}, fallback = {}) {
  const merged = { ...fallback, ...product };
  const title = String(merged.title || merged.name || "회원권").replaceAll("횟수권", "쿠폰제");
  const amount = numericValue(merged.amount, numericValue(fallback.amount));
  const listAmount = numericValue(merged.listAmount, numericValue(fallback.listAmount));
  const settlementBase = numericValue(
    merged.settlementBase,
    numericValue(merged.cashAmount, amount),
  );
  const tickets = numericValue(merged.tickets, numericValue(fallback.tickets));
  const cashAmount = numericValue(merged.cashAmount, numericValue(fallback.cashAmount, settlementBase || amount));
  const cardAmount = numericValue(merged.cardAmount, numericValue(fallback.cardAmount, cashAmount));
  const validityDays = numericValue(merged.validityDays, numericValue(fallback.validityDays, merged.mode === "fixed" ? 30 : 60));
  const graceDays = numericValue(merged.graceDays, numericValue(fallback.graceDays, merged.mode === "fixed" ? 14 : 7));
  const rawProductKind = merged.productKind || (merged.mode === "coupon" || merged.mode === "pass" ? "coupon" : "regular");
  const productKind = ["coupon", "pass"].includes(rawProductKind) ? "coupon" : "regular";
  return {
    ...merged,
    id: merged.id || `product-${Date.now()}`,
    group: String(merged.group || fallback.group || "회원권").replaceAll("횟수권", "쿠폰제"),
    title,
    name: String(merged.name || title).replaceAll("횟수권", "쿠폰제"),
    detail: String(merged.detail || merged.format || fallback.detail || "관리자 설정 회원권").replaceAll("횟수권", "쿠폰제"),
    format: merged.format || fallback.format || "회원권",
    sessions: merged.sessions || `${tickets || 0}회`,
    rule: merged.rule || fallback.rule || "코치별 회원권으로 관리합니다.",
    listAmount,
    amount,
    settlementBase,
    tickets,
    cardAmount,
    cashAmount,
    validityDays,
    graceDays,
    maxSessionsPerDay: numericValue(merged.maxSessionsPerDay, numericValue(fallback.maxSessionsPerDay, 0)),
    maxSessionsPerWeek: numericValue(merged.maxSessionsPerWeek, numericValue(fallback.maxSessionsPerWeek, 0)),
    maxBookingDaysPerWeek: numericValue(merged.maxBookingDaysPerWeek, numericValue(fallback.maxBookingDaysPerWeek, 0)),
    purchaseExperience: merged.purchaseExperience || fallback.purchaseExperience || "",
    firstLessonOfferEnabled: merged.firstLessonOfferEnabled ?? fallback.firstLessonOfferEnabled ?? false,
    firstLessonOfferPrice: numericValue(
      merged.firstLessonOfferPrice,
      numericValue(fallback.firstLessonOfferPrice, 15000),
    ),
    threeMonthDiscountRate: Math.max(0, Math.min(90, Number(merged.threeMonthDiscountRate ?? fallback.threeMonthDiscountRate ?? 10))),
    threeMonthPriceMode: ["automatic", "manual"].includes(String(merged.threeMonthPriceMode || fallback.threeMonthPriceMode || "automatic"))
      ? String(merged.threeMonthPriceMode || fallback.threeMonthPriceMode || "automatic")
      : "automatic",
    coachSaleAvailability: merged.coachSaleAvailability && typeof merged.coachSaleAvailability === "object"
      ? { ...merged.coachSaleAvailability }
      : fallback.coachSaleAvailability && typeof fallback.coachSaleAvailability === "object" ? { ...fallback.coachSaleAvailability } : {},
    coachSaleMode: String(merged.coachSaleMode || fallback.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active",
    groupDeductionPolicy: merged.groupDeductionPolicy
      || merged.group_deduction_policy
      || fallback.groupDeductionPolicy
      || fallback.group_deduction_policy
      || "shared_once",
    productKind,
    discountEnabled: merged.discountEnabled ?? fallback.discountEnabled ?? true,
    coachDiscountAllowed: merged.coachDiscountAllowed ?? fallback.coachDiscountAllowed ?? false,
    coach: merged.coach || fallback.coach || "선택 코치 전용",
    flow: merged.flow || fallback.flow || "시간 선택 → 회원권 선택 → 결제",
    mode: productKind === "coupon" ? "pass" : "fixed",
    discount: merged.discount || fallback.discount || "관리자 설정 기준 적용",
    badge: merged.badge || fallback.badge || "회원권",
    status: merged.status || fallback.status || "sale",
  };
}

function membershipProductDraftFromServer(product = {}) {
  const productKind = product.product_kind === "coupon" || product.is_coupon ? "coupon" : "regular";
  const scheduleScope = ["weekday", "weekend", "mixed"].includes(product.schedule_scope) ? product.schedule_scope : "weekday";
  const groupSize = Number(product.group_size) || 1;
  const lessonMinutes = Number(product.lesson_minutes) || 20;
  const tickets = Number(product.total_sessions) || 1;
  const cashAmount = Number(product.cash_price) || Number(product.base_price) || 0;
  const cardAmount = Number(product.card_price) || cashAmount;
  const savedStatus = product.policy_settings?.adminSaleStatus;
  const status = ["sale", "consult", "hidden"].includes(savedStatus)
    ? savedStatus
    : product.is_active === false ? "hidden" : "sale";
  return normalizeMembershipProduct({
    id: product.product_code || `server-${product.id}`,
    serverProductId: product.id,
    serverProductCode: product.product_code || "",
    purchaseExperience: product.policy_settings?.purchaseExperience || (String(product.product_code || "").startsWith("one-day-") ? "one_day" : ""),
    firstLessonOfferEnabled: product.policy_settings?.firstLessonOfferEnabled === true,
    firstLessonOfferPrice: Number(product.policy_settings?.firstLessonOfferPrice) || 15000,
    threeMonthDiscountRate: Number(product.policy_settings?.threeMonthDiscountRate ?? 10),
    threeMonthPriceMode: product.policy_settings?.threeMonthPriceMode || "automatic",
    coachSaleAvailability: product.policy_settings?.coachSaleAvailability || {},
    coachSaleMode: product.policy_settings?.coachSaleMode === "selected" ? "selected" : "all_active",
    branchId: product.branch_id || "",
    branchName: operationBranchOptions().find((branch) => branch.id === String(product.branch_id || ""))?.name || "",
    group: `${scheduleScope === "mixed" ? "혼합" : scheduleScope === "weekend" ? "주말" : "평일"} ${productKind === "coupon" ? "쿠폰제" : "정규권"}`,
    title: product.name || "회원권",
    name: product.name || "회원권",
    format: `${groupSize === 2 ? "2대1" : "1대1"} · ${lessonMinutes}분`,
    sessions: product.policy_settings?.countLabel || `${tickets}회`,
    tickets,
    amount: cashAmount,
    listAmount: cardAmount,
    cardAmount,
    cashAmount,
    settlementBase: Number(product.settlement_base_price) || cashAmount,
    validityDays: Number(product.validity_days) || 1,
    graceDays: Number(product.grace_days) || 0,
    lessonMinutes,
    groupSize,
    frequencyPerWeek: Number(product.frequency_per_week) || 0,
    scheduleScope,
    termWeeks: Number(product.term_weeks) || 0,
    maxSessionsPerDay: Number(product.max_sessions_per_day) || 0,
    maxSessionsPerWeek: Number(product.max_sessions_per_week) || 0,
    maxBookingDaysPerWeek: Number(product.max_booking_days_per_week) || 0,
    productKind,
    isCoupon: Boolean(product.is_coupon),
    discountEnabled: product.discount_enabled !== false,
    coachDiscountAllowed: product.coach_discount_allowed === true,
    sortOrder: Number(product.display_order) || 0,
    mode: productKind === "coupon" ? "pass" : groupSize === 2 ? "group" : "fixed",
    status,
    rule: "실서버 회원권 상품과 회원 등록 화면에 함께 반영됩니다.",
  });
}

function membershipProductsForMemberApp() {
  return membershipProductDrafts.map((product) => {
    const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
    return {
      id: normalized.id,
      productCode: normalized.serverProductCode || normalized.productCode || normalized.id,
      purchaseExperience: normalized.purchaseExperience || "",
      firstLessonOfferEnabled: normalized.firstLessonOfferEnabled === true,
      firstLessonOfferPrice: normalized.firstLessonOfferPrice,
      threeMonthDiscountRate: normalized.threeMonthDiscountRate,
      threeMonthPriceMode: normalized.threeMonthPriceMode,
      coachSaleAvailability: normalized.coachSaleAvailability,
      group: normalized.group,
      title: normalized.title,
      name: normalized.name,
      detail: normalized.detail,
      listAmount: normalized.listAmount,
      amount: normalized.status === "consult" ? 0 : normalized.amount,
      settlementBase: normalized.settlementBase,
      tickets: normalized.tickets,
      cardAmount: normalized.cardAmount,
      cashAmount: normalized.cashAmount,
      validityDays: normalized.validityDays,
      graceDays: normalized.graceDays,
      lessonMinutes: normalized.lessonMinutes,
      groupSize: normalized.groupSize,
      frequencyPerWeek: normalized.frequencyPerWeek,
      scheduleScope: normalized.scheduleScope,
      termWeeks: normalized.termWeeks,
      maxSessionsPerDay: normalized.maxSessionsPerDay,
      maxSessionsPerWeek: normalized.maxSessionsPerWeek,
      maxBookingDaysPerWeek: normalized.maxBookingDaysPerWeek,
      productKind: normalized.productKind,
      discountEnabled: normalized.discountEnabled,
      coachDiscountAllowed: normalized.coachDiscountAllowed,
      coach: normalized.coach,
      flow: normalized.flow,
      mode: normalized.mode,
      discount: normalized.discount,
      badge: normalized.badge,
      status: normalized.status,
      rule: normalized.rule,
      sessions: normalized.sessions,
      sortOrder: normalized.sortOrder,
    };
  });
}

function membershipProductForTicket(ticket = {}) {
  const label = `${ticket.product || ""} ${ticket.lessonKind || ""}`;
  const isPass = label.includes("횟수") || label.includes("쿠폰");
  const productId = label.includes("2대1") || label.includes("그룹")
    ? "group-20"
    : isPass
      ? (label.includes("30분") ? "coupon-30" : "coupon-20")
      : label.includes("30분")
        ? "fixed-30"
        : "fixed-20";
  return normalizeMembershipProduct(
    membershipProductDrafts.find((product) => product.id === productId),
    membershipProductDefaults.find((product) => product.id === productId),
  );
}

function selectedProductIdSet() {
  return new Set((state.selectedMembershipProductIds || []).map(String));
}

function getTicketByLesson(lesson) {
  if (!lesson) return null;
  if (lesson.ticketId) {
    return [...tickets, ...expiredTickets]
      .find((item) => String(item.id) === String(lesson.ticketId));
  }
  const coachMatches = tickets.filter((item) => (
    ticketBelongsToMember(item, lesson.member)
    && item.coachId === lesson.coachId
  ));
  const productMatches = coachMatches.filter((item) => item.product?.includes(lesson.type));
  if (productMatches.length === 1) return productMatches[0];
  if (!productMatches.length && coachMatches.length === 1) return coachMatches[0];
  return null;
}

function isRegularScheduleTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || Number(ticket.remaining) <= 0) return false;
  if (ticket.status && ticket.status !== "active") return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  if (ticket.expires && ticket.expires < today) return false;
  const productKind = ticket.productKind || membershipProductForTicket(ticket).productKind;
  if (["pass", "coupon"].includes(String(productKind).toLowerCase()) || String(ticket.product || "").includes("쿠폰")) return false;
  return true;
}

function unassignedRegularTickets() {
  const ticketById = new Map();
  [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)].forEach((ticket) => {
    const ticketId = String(ticket?.id || ticket?.serverTicketId || "");
    if (ticketId && !ticketById.has(ticketId)) ticketById.set(ticketId, ticket);
  });
  const regularTickets = [...ticketById.values()].filter((ticket) => isSchedulableRegularTicket(ticket));
  const candidates = regularTickets
    .filter((ticket) => ticketRemainingRegularScheduleCount(ticket) > 0)
    .sort((left, right) => ticketParticipantNames(right).length - ticketParticipantNames(left).length);
  const selected = [];

  candidates.forEach((ticket) => {
    const participantNames = ticketParticipantNames(ticket).sort();
    const startsOn = ticket.starts || ticket.purchased || "";
    const contextKey = [ticket.coachId || "", ticket.product || "", startsOn, ticket.expires || ""].join("::");
    const assignedAliasExists = regularTickets.some((other) => {
      if (other === ticket || ticketNeedsRegularSchedule(other)) return false;
      const otherStartsOn = other.starts || other.purchased || "";
      const otherContextKey = [other.coachId || "", other.product || "", otherStartsOn, other.expires || ""].join("::");
      const otherParticipantNames = ticketParticipantNames(other);
      return otherContextKey === contextKey
        && participantNames.length > 0
        && participantNames.every((name) => otherParticipantNames.includes(name));
    });
    if (assignedAliasExists) return;
    const duplicate = selected.some((item) => (
      item.contextKey === contextKey
      && participantNames.length > 0
      && participantNames.every((name) => item.participantNames.includes(name))
    ));
    if (!duplicate) selected.push({ ticket, participantNames, contextKey });
  });

  return selected.map((item) => item.ticket);
}

function currentScheduleAssignmentTicket() {
  return scheduleTicketById(state.scheduleAssignmentTicketId);
}

function nextScheduleAssignmentTicket(currentTicketId = state.scheduleAssignmentTicketId, respectUiFilters = true) {
  const current = scheduleTicketById(currentTicketId);
  const candidates = scheduleAssignmentQueueCandidates({ respectUiFilters, excludeTicketId: currentTicketId });
  if (!candidates.length) return null;
  if (!current?.coachId) return candidates[0];
  return candidates.find((ticket) => String(ticket.coachId || "") === String(current.coachId)) || candidates[0];
}

function advanceScheduleTicketAssignment({
  currentTicketId = state.scheduleAssignmentTicketId,
  respectUiFilters = true,
  render = true,
  notify = true,
} = {}) {
  const next = nextScheduleAssignmentTicket(currentTicketId, respectUiFilters);
  if (!next) {
    clearScheduleTicketAssignment(false);
    if (render) renderSchedule();
    if (notify) showToast(respectUiFilters ? "현재 조건의 다음 회원이 없습니다." : "정규시간 배정 대기열을 모두 처리했습니다.");
    return null;
  }
  if (!respectUiFilters) {
    state.scheduleAssignmentSearch = "";
    state.scheduleAssignmentFilter = "all";
  }
  state.scheduleAssignmentTicketId = String(next.id || "");
  state.scheduleAssignmentLessonSource = "regular";
  state.scheduleCoachFilter = "all";
  if (render) renderSchedule();
  if (notify) showToast(`${ticketParticipantNames(next).join(" & ") || next.member} 회원의 빈 시간을 선택하세요.`);
  return next;
}

function clearScheduleTicketAssignment(render = true) {
  state.scheduleAssignmentTicketId = "";
  state.scheduleAssignmentLessonSource = "regular";
  if (render) renderSchedule();
}

function beginScheduleTicketAssignment(ticketId, lessonSource = "regular") {
  const ticket = scheduleTicketById(ticketId);
  if (!ticket) {
    showToast("회원권 정보를 다시 불러와 주세요.");
    return false;
  }
  state.scheduleAssignmentTicketId = String(ticket.id || "");
  state.scheduleAssignmentLessonSource = normalizeLessonSource(lessonSource);
  state.scheduleView = "week";
  state.scheduleCoachFilter = "all";
  const focusDate = [ticketScheduleStartDate(ticket), adminLocalDateKey(new Date())].sort().at(-1);
  state.scheduleOpenSlotMode = false;
  state.selectedScheduleOpenSlots = [];
  state.scheduleOpenSlotAnchorKey = "";
  setView("schedule");
  state.activeAdminWeekIndex = Math.min(
    Math.max(adminWeekOffsetForDate(focusDate), adminScheduleMinWeekOffset),
    adminScheduleMaxWeekOffset,
  );
  const focusDay = scheduleDays[(new Date(`${focusDate}T12:00:00`).getDay() + 6) % 7];
  if (focusDay) state.selectedScheduleDay = focusDay;
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
  showToast(`${ticketParticipantNames(ticket).join(" & ") || ticket.member} 회원의 빈 시간을 선택하세요.`);
  return true;
}

function isActiveCouponTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  if (ticket.expires && ticket.expires < today) return false;
  const productKind = String(ticket.productKind || membershipProductForTicket(ticket).productKind || "").toLowerCase();
  return productKind === "pass" || productKind === "coupon" || String(ticket.product || "").includes("쿠폰");
}

function couponTicketsWithoutUpcomingLesson() {
  const candidates = operationBranchTickets()
    .filter((ticket) => isActiveCouponTicket(ticket) && !ticketHasUpcomingLesson(ticket))
    .sort((left, right) => String(left.expires || "9999-12-31").localeCompare(String(right.expires || "9999-12-31")));
  const seen = new Set();
  return candidates.filter((ticket) => {
    const participantIds = ticketParticipantUserIds(ticket).sort();
    const participantNames = ticketParticipantNames(ticket).sort();
    const participantsKey = participantIds.length ? participantIds.join("&") : participantNames.join("&");
    const key = [participantsKey || ticket.id, ticket.coachId || "", ticket.product || "", ticket.expires || ""].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function memberDirectoryTickets(member) {
  const operationalTickets = memberOperationalTickets(member);
  const memberUserIds = new Set(memberServerUserIds(member).map(String));
  const ownedTickets = operationalTickets.filter((ticket) => (
    !ticketUsesPerParticipantGroupOwnership(ticket)
    || memberUserIds.has(String(ticket.serverUserId || ""))
    || memberHasActiveGroupTicketLink(member, ticket)
  ));
  return ownedTickets.length ? ownedTickets : operationalTickets;
}

function allTicketsForMember(memberReference) {
  const memberKey = memberReference && typeof memberReference === "object"
    ? String(memberReference.serverUserId || memberReference.id || memberReference.name || "")
    : String(memberReference || "");
  const branchKey = activeOperationBranchId();
  const cacheKey = `all|${branchKey}|${memberKey}`;
  const cached = memberKey ? memberTicketsIndex.get(cacheKey) : null;
  if (cached) return cached;
  const ticketById = new Map();
  [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)].forEach((ticket) => {
    const ticketId = String(ticket.serverTicketId || ticket.id || "");
    if (ticketId && !ticketById.has(ticketId)) ticketById.set(ticketId, ticket);
  });
  const matches = [...ticketById.values()]
    .filter((ticket) => ticketBelongsToMember(ticket, memberReference))
    .sort((left, right) => ticketPriorityForMember(right, memberReference) - ticketPriorityForMember(left, memberReference));
  if (memberKey) memberTicketsIndex.set(cacheKey, matches);
  return matches;
}

function memberCurrentTicket(member) {
  return memberCurrentTickets(member)[0] || null;
}

function memberCurrentTickets(member) {
  return memberTicketGroups(member).current;
}

function memberUpcomingTickets(member) {
  return memberTicketGroups(member).upcoming;
}

function memberTicketHistory(member) {
  return memberTicketGroups(member).history;
}

function memberOperationalTickets(member) {
  const currentAndUpcoming = [...memberCurrentTickets(member), ...memberUpcomingTickets(member)]
    .filter((ticket) => ticket?.status !== "voided");
  if (currentAndUpcoming.length) return currentAndUpcoming;
  return memberTicketHistory(member).filter((ticket) => ticket?.status !== "voided");
}

function groupAccountForMemberTicket(member, ticket) {
  if (!member || !ticket) return null;
  const ticketId = String(ticket.serverTicketId || ticket.id || "");
  const memberUserIds = new Set(memberServerUserIds(member).map(String));
  const names = new Set([...splitMemberNames(member.name), ...splitMemberNames(ticket.member)]);
  return groupAccounts.find((account) => (
    (account.ticketIds || []).some((id) => String(id) === ticketId)
    || (account.members || []).some((item) => memberUserIds.has(String(item.userId || "")))
    || (account.members || []).some((item) => names.has(item.name))
  )) || null;
}

function memberTicketKind(member) {
  const ticket = memberCurrentTicket(member);
  return ticket ? membershipProductForTicket(ticket).productKind : "none";
}

function memberHasTicketKind(member, productKind) {
  const groups = memberTicketGroups(member);
  const relevantTickets = state.memberFilter === "expired"
    ? groups.history
    : [...groups.current, ...groups.upcoming];
  return relevantTickets.some((ticket) => membershipProductForTicket(ticket).productKind === productKind);
}

function memberManagementProducts(sourceTicket = null) {
  const sourceGroupSize = Number(sourceTicket?.groupSize) || 1;
  const branchId = sourceTicket?.branchId || activeOperationBranchId();
  return (adminLiveDataState.products || [])
    .filter((product) => product.is_active !== false
      && (!branchId || product.branch_id === branchId)
      && (!sourceTicket || Number(product.group_size || 1) === sourceGroupSize))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function memberMembershipLinkTargets(sourceMember, query = "") {
  if (!sourceMember?.serverUserId || !sourceMember.authLinked) return [];
  const keyword = normalizedMemberLinkSearch(query);
  const keywordDigits = normalizedMemberPhone(query);
  const sourceName = normalizedMemberLinkSearch(sourceMember.name);
  const sourcePhone = normalizedMemberPhone(sourceMember.phone);
  const candidates = members.filter((candidate) => {
    if (!candidate?.serverUserId || candidate.serverUserId === sourceMember.serverUserId || candidate.authLinked) return false;
    const status = memberListStatus(candidate);
    if (["journal", "inactive"].includes(status)) return false;
    const hasMembershipRecord = memberManagementTickets(candidate).length > 0
      || !["journal_only", "lesson_pending"].includes(candidate.memberKind);
    if (!hasMembershipRecord) return false;
    if (!keyword) return true;
    const fields = [candidate.name, candidate.nickname].map(normalizedMemberLinkSearch);
    const phone = normalizedMemberPhone(candidate.phone);
    return fields.some((value) => value.includes(keyword))
      || (keywordDigits.length >= 4 && phone.includes(keywordDigits));
  }).map((candidate) => {
    const candidateName = normalizedMemberLinkSearch(candidate.name);
    const candidatePhone = normalizedMemberPhone(candidate.phone);
    const score = (sourcePhone.length >= 9 && sourcePhone === candidatePhone ? 100 : 0)
      + (sourceName && sourceName === candidateName ? 50 : 0)
      + (sourceMember.birthYear && sourceMember.birthYear === candidate.birthYear ? 20 : 0);
    return { ...candidate, score };
  }).sort((left, right) => right.score - left.score || String(left.name || "").localeCompare(String(right.name || ""), "ko"));
  const strongMatches = candidates.filter((candidate) => candidate.score >= 100);
  return candidates.map((candidate) => ({
    ...candidate,
    recommended: candidate.score >= 100 && strongMatches.length === 1,
  }));
}

function memberMembershipTargetLabel(candidate = {}) {
  const phoneLast4 = normalizedMemberPhone(candidate.phone).slice(-4);
  const ticket = memberCurrentTicket(candidate) || memberManagementTickets(candidate)[0] || null;
  const ticketLabel = ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "기존 회원 DB";
  return `${candidate.name || "회원"}${phoneLast4 ? ` · ${phoneLast4}` : ""} · ${ticketLabel}${candidate.recommended ? " · 추천" : ""}`;
}

function memberManagementTicketMatchesPayload(serverTicket, payload, { verifyPayment = true } = {}) {
  if (!serverTicket || !payload) return false;
  const ticketMatches = String(serverTicket.productId || "") === String(payload.productId || "")
    && Number(serverTicket.total) === Number(payload.totalSessions)
    && Number(serverTicket.used) === Number(payload.usedSessions)
    && Number(serverTicket.remaining) === Number(payload.remainingSessions)
    && String(serverTicket.purchased || "") === String(payload.startsOn || "")
    && String(serverTicket.expires || "") === String(payload.expiresOn || "")
    && String(serverTicket.status || "").toLowerCase() === String(payload.ticketStatus || "active").toLowerCase();
  if (!ticketMatches) return false;
  return !verifyPayment || memberPaymentRecordMatchesPayload(serverTicket.memberRecord, payload);
}

function memberTicketDisplayLabel(member, ticket = memberCurrentTicket(member)) {
  if (!ticket) return member?.directoryRow?.product_name || "미등록";
  return getTicketDisplayProduct(ticket) || ticket.product || "회원권";
}

function memberTicketPartnerUserId(ticket, member) {
  if (!ticket || !member) return "";
  const memberUserIds = memberServerUserIds(member);
  const participantUserIds = ticketParticipantUserIds(ticket);
  if (memberUserIds.length) {
    const participantPartner = participantUserIds.find((userId) => !memberUserIds.includes(userId));
    if (participantPartner) return participantPartner;
    const groupLink = (adminLiveDataState.groupTicketLinks || []).find((link) => (
      link.ticket_id === ticket.serverTicketId
      || (memberUserIds.includes(link.user_id) && link.ticket_id === ticket.serverTicketId)
    ));
    if (groupLink) {
      const groupPartner = (adminLiveDataState.groupMembers || []).find((row) => (
        row.group_account_id === groupLink.group_account_id
        && !memberUserIds.includes(row.user_id)
      ));
      if (groupPartner?.user_id) return groupPartner.user_id;
    }
    return "";
  }
  const partnerName = ticketPartnerNames(ticket, member)[0];
  return (adminLiveDataState.users || []).find((user) => user.name === partnerName)?.id || "";
}

function onsitePaymentProducts() {
  return membershipProductsForActiveOperationProfile()
    .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
    .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled");
}

function onsitePaymentSourceTickets(userId = $("#onsitePaymentMember")?.value || "") {
  const member = operationBranchMembers().find((item) => memberServerUserIds(item).includes(userId));
  if (!member) return [];
  return memberManagementTickets(member).filter((ticket) => (
    ticket?.serverTicketId
    && !["refunded", "voided", "cancelled", "canceled"].includes(String(ticket.status || ""))
  ));
}

function memberInlineProductSearchTokens(value = "") {
  return String(value || "")
    .toLocaleLowerCase("ko-KR")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function closeMemberInlineProductResults(form) {
  const input = form?.querySelector("[data-member-product-search]");
  const results = form?.querySelector("[data-member-product-results]");
  if (input) input.setAttribute("aria-expanded", "false");
  if (results) results.hidden = true;
}

function memberInlineProductsMatchExceptDuration(currentProduct, candidateProduct) {
  if (!currentProduct || !candidateProduct) return false;
  if (String(currentProduct.product_kind || "regular") !== String(candidateProduct.product_kind || "regular")) return false;
  if (Number(currentProduct.group_size || 1) !== Number(candidateProduct.group_size || 1)) return false;
  if (memberManagementProductWeeklyFrequency(currentProduct) !== memberManagementProductWeeklyFrequency(candidateProduct)) return false;
  if (memberManagementProductScheduleScope(currentProduct) !== memberManagementProductScheduleScope(candidateProduct)) return false;
  if (memberManagementProductIsCoupon(currentProduct) !== memberManagementProductIsCoupon(candidateProduct)) return false;
  return ["total_sessions", "term_weeks", "validity_days", "grace_days"].every((key) => {
    const currentValue = Number(currentProduct[key] || 0);
    return !currentValue || Number(candidateProduct[key] || 0) === currentValue;
  });
}

function scheduleClipboardTicket() {
  return scheduleTicketById(state.scheduleLessonClipboard?.ticketId);
}

function getLessonTicketOptionLabel(ticket) {
  const memberNames = ticketParticipantNames(ticket).join(" & ") || ticket.member || "회원";
  return `${memberNames} · ${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function scheduleTicketById(ticketId) {
  return [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)]
    .find((item) => String(item.id) === String(ticketId || "")) || null;
}

function getEligibleTickets(memberReference, coachId, lessonDate = lessonTicketEligibilityDate()) {
  const editingTicket = getTicketByLesson(getCurrentEditingLesson());
  const editingTicketId = editingTicket?.id || "";
  const sourceTickets = adminManualOverrideEnabled()
    ? [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)].filter((ticket, index, source) => (
      source.findIndex((item) => String(item.id) === String(ticket.id)) === index
      && ticketBelongsToMember(ticket, memberReference)
    ))
    : allTicketsForMember(memberReference);
  const eligibleTickets = sourceTickets.filter((ticket) => adminManualOverrideEnabled() || (
    ticket.coachId === coachId
    && (ticket.remaining > 0 || ticket.id === editingTicketId)
    && lessonTicketCanBeSelected(ticket, lessonDate)
  ));
  // Existing lessons are already bound to a server ticket. Keep that identity
  // while editing instead of rediscovering it from display names or coach lanes.
  if (editingTicket && !eligibleTickets.some((ticket) => String(ticket.id) === String(editingTicket.id))) {
    eligibleTickets.unshift(editingTicket);
  }
  return eligibleTickets;
}

function findFirstMemberWithCoachTicket(coachId) {
  const ticket = [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)]
    .find((item) => (
      item.coachId === coachId
      && item.remaining > 0
      && lessonTicketCanBeSelected(item)
    ));
  if (!ticket) return "";
  const branchMembers = operationBranchMembers();
  const owner = branchMembers.find((member) => memberServerUserIds(member).includes(ticket.serverUserId));
  return owner?.name || branchMembers.find((member) => ticketBelongsToMember(ticket, member))?.name || ticketParticipantNames(ticket)[0] || "";
}

function findFirstTicketForMember(memberReference) {
  return allTicketsForMember(memberReference)
    .find((ticket) => ticket.remaining > 0 && lessonTicketCanBeSelected(ticket));
}

function getActiveTicketForMember(memberReference) {
  return allTicketsForMember(memberReference)
    .find((ticket) => ticketCanBeUsedOnLessonDate(ticket))
    || allTicketsForMember(memberReference).find((ticket) => lessonTicketCanBeSelected(ticket))
    || ticketsForMember(memberReference)[0]
    || allTicketsForMember(memberReference)[0];
}

function getExpiredTicketsForMember(memberName) {
  const member = memberName && typeof memberName === "object" ? memberName : null;
  const displayName = member ? member.name : memberName;
  if (!displayName) return [];
  return expiredTickets.filter((ticket) => ticketBelongsToMember(ticket, member || displayName));
}

function isCouponLessonTicket(ticket) {
  if (!ticket) return false;
  const productKind = String(ticket.productKind || membershipProductForTicket(ticket).productKind || "").toLowerCase();
  return ["pass", "coupon"].includes(productKind) || String(ticket.product || "").includes("쿠폰");
}

function allowedLessonSourcesForTicket(ticket = getSelectedTicket()) {
  if (!ticket) return [];
  return isCouponLessonTicket(ticket)
    ? ["coupon", "makeup"]
    : ["regular", "makeup"];
}

function suggestedLessonSourceForTicket(ticket = getSelectedTicket()) {
  if (!ticket) return "regular";
  return isCouponLessonTicket(ticket) ? "coupon" : "regular";
}

function settlementRecordProgressByTicket(indexes = {}) {
  const ticketById = indexes.ticketById || new Map();
  const assignmentByLesson = indexes.assignmentByLesson || new Map();
  const progressByTicket = new Map();
  (adminLiveDataState.lessonRecords || []).forEach((record) => {
    const linkedLesson = Array.isArray(record.tn_lessons) ? record.tn_lessons[0] : record.tn_lessons || {};
    const ticketId = String(record.deducted_ticket_id || linkedLesson.member_ticket_id || "");
    const ticket = ticketById.get(ticketId);
    if (!ticketId || !ticket) return;
    const sessions = Math.max(0, Number(record.deducted_sessions) || 0);
    if (!sessions) return;
    const coachRoleId = String(record.coach_role_id || "");
    const durationMinutes = Math.max(0, Number(linkedLesson.duration_minutes || ticket.durationMinutes) || 0);
    const progress = progressByTicket.get(ticketId) || {
      recordedSessions: 0,
      byCoachRole: new Map(),
      substituteGroups: new Map(),
    };
    progress.recordedSessions += sessions;
    const coachProgress = progress.byCoachRole.get(coachRoleId) || { sessions: 0, minutes: 0 };
    coachProgress.sessions += sessions;
    coachProgress.minutes += sessions * durationMinutes;
    progress.byCoachRole.set(coachRoleId, coachProgress);

    const originalCoachRoleId = String(ticket.coachRoleId || "");
    if (coachRoleId && originalCoachRoleId && coachRoleId !== originalCoachRoleId) {
      const assignment = assignmentByLesson.get(String(record.lesson_id || ""));
      const mode = assignment?.settlement_mode || "actual_coach";
      const hourlyAmount = mode === "hourly" ? Math.max(0, Number(assignment?.hourly_amount) || 0) : 0;
      const key = `${coachRoleId}|${mode}|${hourlyAmount}`;
      const substitute = progress.substituteGroups.get(key) || {
        coachRoleId,
        mode,
        hourlyAmount,
        sessions: 0,
        minutes: 0,
      };
      substitute.sessions += sessions;
      substitute.minutes += sessions * durationMinutes;
      progress.substituteGroups.set(key, substitute);
    }
    progressByTicket.set(ticketId, progress);
  });
  return progressByTicket;
}

function monthlyImportProductDefaults(ticketName = "") {
  const normalizedName = normalizeImportHeader(ticketName);
  const product = membershipProductsForActiveOperationProfile().find((item) => (
    normalizeImportHeader(item.title || item.name || "") === normalizedName
  ));
  const scheduleScope = String(product?.scheduleScope || product?.schedule_scope || "").toLowerCase();
  const groupSize = Number(product?.groupSize || product?.group_size || 0);
  const productText = `${ticketName} ${product?.productKind || product?.product_kind || ""}`;
  return {
    lessonWay: scheduleScope === "weekend" || /주말/.test(productText) ? "주말" : "평일",
    lessonType: groupSize === 2 || /(2대1|2:1|1:2|그룹)/.test(productText) ? "1:2" : "1:1",
  };
}

function liveTicketScheduleScope(product = {}, ticket = {}, lessons = []) {
  const configuredScope = ["weekday", "weekend", "mixed"].includes(product.schedule_scope) ? product.schedule_scope : "weekday";
  const productCode = String(product.product_code || "");
  if (productCode.startsWith("admin-ticket-")) return configuredScope;

  const productName = String(product.name || "");
  if (productName.includes("주말")) return "weekend";
  if (productName.includes("평일")) return "weekday";

  const existingLesson = lessons instanceof Map
    ? lessons.get(ticket.id)
    : lessons.find((lesson) => (
      lesson.member_ticket_id === ticket.id
      && lesson.status !== "cancelled"
      && lesson.lesson_date
    ));
  if (existingLesson) {
    const lessonDay = new Date(`${existingLesson.lesson_date}T12:00:00`).getDay();
    return [0, 6].includes(lessonDay) ? "weekend" : "weekday";
  }
  return configuredScope;
}

function filteredMembershipProducts() {
  const keyword = String(state.membershipProductSearch || "").trim().toLowerCase();
  const status = membershipProductStatusOptions.some((option) => option.id === state.membershipProductStatusFilter)
    ? state.membershipProductStatusFilter
    : "all";
  state.membershipProductStatusFilter = status;
  return membershipProductsForActiveOperationProfile().filter((product) => {
    const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
    const searchText = [
      normalized.title,
      normalized.group,
      normalized.productKind,
      normalized.scheduleScope,
      normalized.sessions,
      `${normalized.tickets}회`,
      `${normalized.lessonMinutes}분`,
    ].join(" ").toLowerCase();
    return (!keyword || searchText.includes(keyword))
      && (status === "all" || normalized.status === status);
  });
}

function memberTicketPlanValue(ticket = {}, key = "") {
  const values = {
    product: ticket.productId || ticket.product_id || "",
    coach: ticket.coachRoleId || ticket.coach_role_id || "",
    starts: ticket.starts || ticket.startsOn || ticket.starts_on || ticket.purchased || "",
    expires: ticket.expires || ticket.expiresOn || ticket.expires_on || "",
  };
  return String(values[key] || "");
}

function memberTicketsUseSameRenewalPlan(left = {}, right = {}) {
  const leftProduct = memberTicketPlanValue(left, "product");
  const rightProduct = memberTicketPlanValue(right, "product");
  const leftCoach = memberTicketPlanValue(left, "coach");
  const rightCoach = memberTicketPlanValue(right, "coach");
  return Boolean(leftProduct && rightProduct && leftCoach && rightCoach)
    && leftProduct === rightProduct
    && leftCoach === rightCoach;
}

function memberTicketDateRangesOverlap(left = {}, right = {}) {
  const leftStart = memberTicketPlanValue(left, "starts");
  const leftEnd = memberTicketPlanValue(left, "expires");
  const rightStart = memberTicketPlanValue(right, "starts");
  const rightEnd = memberTicketPlanValue(right, "expires");
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function memberRenewalOverlapTicketIds(managedTickets = []) {
  const result = new Set();
  managedTickets.forEach((ticket, index) => {
    managedTickets.slice(index + 1).forEach((candidate) => {
      if (!memberTicketsUseSameRenewalPlan(ticket, candidate)
        || !memberTicketDateRangesOverlap(ticket, candidate)) return;
      [ticket, candidate].forEach((item) => {
        const ticketId = String(item.serverTicketId || item.id || "");
        if (ticketId) result.add(ticketId);
      });
    });
  });
  return result;
}

function memberRenewalOverlapForPayload(member, payload = {}) {
  return memberOperationalTickets(member).find((ticket) => (
    memberTicketsUseSameRenewalPlan(ticket, payload)
    && memberTicketDateRangesOverlap(ticket, payload)
  )) || null;
}

function memberHasActiveGroupTicketLink(member, ticket) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  if (!ticketId) return false;
  const memberUserIds = new Set(memberServerUserIds(member).map(String));
  return (adminLiveDataState.groupTicketLinks || []).some((link) => (
    ["active", "linked"].includes(String(link.status || "active").toLowerCase())
    && String(link.ticket_id || "") === ticketId
    && memberUserIds.has(String(link.user_id || ""))
  ));
}

function memberTicketLessonRows(member, ticket = null, candidateLessons = null) {
  const memberLessons = Array.isArray(candidateLessons) ? candidateLessons : memberLessonRows(member);
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  if (!ticketId) return memberLessons;
  return memberLessons.filter((lesson) => (
    String(lesson.ticketId || lesson.serverTicketId || "") === ticketId
  ));
}

function memberTicketLifecyclePositionLabel(member, ticket) {
  if (!ticket) return "회원권";
  const groups = memberTicketGroups(member);
  const ticketId = String(ticket.serverTicketId || ticket.id || "");
  const currentIndex = groups.current.findIndex((item) => String(item.serverTicketId || item.id || "") === ticketId);
  if (currentIndex >= 0) {
    return groups.current.length > 1
      ? `현재 회원권 ${currentIndex + 1}/${groups.current.length}`
      : "현재 회원권";
  }
  const upcomingIndex = groups.upcoming.findIndex((item) => String(item.serverTicketId || item.id || "") === ticketId);
  if (upcomingIndex >= 0) {
    return groups.upcoming.length > 1
      ? `다음 회원권 ${upcomingIndex + 1}/${groups.upcoming.length}`
      : "다음 회원권";
  }
  return "지난 회원권";
}

function ticketScheduleStartDate(ticket, fallback = adminLocalDateKey(new Date())) {
  return String(ticket?.actualLessonStart || ticket?.starts || ticket?.purchased || fallback).slice(0, 10);
}

function ticketScheduleEndDate(ticket) {
  return String(ticket?.expires || "9999-12-31").slice(0, 10);
}

function isSchedulableRegularTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || !["active", "paused"].includes(String(ticket.status || "active"))) return false;
  if (Number(ticket.remaining) <= 0 || ticketScheduleEndDate(ticket) < today) return false;
  const productKind = ticket.productKind || membershipProductForTicket(ticket).productKind;
  return !["pass", "coupon"].includes(String(productKind).toLowerCase())
    && !String(ticket.product || "").includes("쿠폰");
}

function ticketCanBeScheduledOnOrAfterDate(ticket, day, requestedDate = "") {
  return isSchedulableRegularTicket(ticket)
    && Boolean(firstEligibleScheduleDateForTicket(ticket, day, requestedDate));
}

function firstEligibleScheduleDateForTicket(ticket, day, requestedDate = "") {
  if (!ticket || !scheduleDays.includes(day) || !ticketAllowsScheduleDay(ticket, day)) return "";
  const today = adminLocalDateKey(new Date());
  const baseDate = [requestedDate, ticketScheduleStartDate(ticket), today]
    .filter(Boolean)
    .sort()
    .at(-1);
  const targetDay = ({ 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 })[day];
  const candidate = new Date(`${baseDate}T12:00:00`);
  if (!Number.isFinite(candidate.getTime())) return "";
  candidate.setDate(candidate.getDate() + ((targetDay - candidate.getDay() + 7) % 7));
  const candidateDate = adminLocalDateKey(candidate);
  return candidateDate <= ticketScheduleEndDate(ticket) ? candidateDate : "";
}

function mapAdminSettlementTicketRows(rows = [], context = {}) {
  const productsById = new Map((context.products || adminLiveDataState.products || [])
    .map((product) => [product.id, product]));
  const usersById = new Map((context.users || adminLiveDataState.users || [])
    .map((user) => [user.id, user]));
  const coachIdByRole = context.coachIdByRole instanceof Map
    ? context.coachIdByRole
    : new Map(coaches
      .filter((coach) => coach.serverRoleId)
      .map((coach) => [coach.serverRoleId, coach.id]));
  return rows.map((ticket) => {
    const product = productsById.get(ticket.product_id) || {};
    return {
      id: ticket.id,
      serverTicketId: ticket.id,
      serverUserId: ticket.user_id,
      productId: ticket.product_id,
      branchId: ticket.branch_id,
      coachRoleId: ticket.coach_role_id,
      member: usersById.get(ticket.user_id)?.name || "대타 수업",
      coachId: coachIdByRole.get(ticket.coach_role_id) || "",
      total: Number(ticket.total_sessions) || 0,
      used: Number(ticket.used_sessions) || 0,
      remaining: Number(ticket.remaining_sessions) || 0,
      durationMinutes: Number(product.lesson_minutes) || 20,
      status: ticket.status,
    };
  });
}

function memberTicketPaymentGrid(member, ticket) {
  const projection = ticket ? memberTicketPaymentProjection(member, ticket) : null;
  const stateValue = memberPaymentRecordState(projection);
  if (!projection || stateValue === "unentered") {
    return {
      state: stateValue,
      date: "-",
      method: "미입력",
      amount: "-",
      label: "결제 미등록",
      detail: "연결된 결제 기록이 없습니다.",
      tone: "neutral",
      needsReview: false,
    };
  }
  const rawPayment = projection.payment || {};
  const provider = String(projection.payment_provider || rawPayment.provider || "").toLowerCase();
  const methodValue = String(projection.payment_method || rawPayment.method || "").toLowerCase();
  const paymentStatus = String(projection.payment_status || rawPayment.status || "").toLowerCase();
  const projectionSource = String(projection.projection_source || "");
  const linkedToTicket = ["exact_ticket_payment", "source_payment"].includes(projectionSource)
    || String(rawPayment.ticket_id || rawPayment.ticketId || "") === String(ticket?.serverTicketId || ticket?.id || "");
  const tossPayment = methodValue === "tosspay";
  const portonePayment = provider === "portone";
  const bankPayment = provider === "bank_transfer" || ["bank", "bank_transfer", "transfer"].includes(methodValue);
  let label = stateValue === "transfer_zero" ? "양도 완료" : "결제 완료";
  let detail = stateValue === "transfer_zero" ? "결제 없이 양도된 회원권입니다." : "결제 기록이 회원권에 연결되어 있습니다.";
  let tone = stateValue === "incomplete" ? "warning" : "success";
  let needsReview = stateValue === "incomplete";

  if (tossPayment) {
    if (paymentStatus === "verified" && linkedToTicket) {
      label = "토스 완료";
      detail = "토스 결제가 서버에서 확인됐고 이 회원권에 연결됐습니다.";
      tone = "success";
      needsReview = false;
    } else if (paymentStatus === "verified") {
      label = "토스 연결 확인";
      detail = "토스 결제는 확인됐지만 이 회원권 연결을 확인해야 합니다.";
      tone = "warning";
      needsReview = true;
    } else if (["ready", "pending"].includes(paymentStatus)) {
      label = "토스 결제대기";
      detail = "결제창은 생성됐지만 토스 결제 완료가 확인되지 않았습니다.";
      tone = "warning";
      needsReview = true;
    } else if (paymentStatus === "failed") {
      label = "토스 실패";
      detail = "토스 결제가 완료되지 않았습니다. 새 결제 요청 여부를 확인하세요.";
      tone = "danger";
      needsReview = true;
    } else if (paymentStatus === "cancelled") {
      label = "토스 취소";
      detail = "토스 결제가 취소됐습니다.";
      tone = "neutral";
      needsReview = false;
    } else {
      label = "토스 확인 필요";
      detail = "토스 결제 상태를 결제관리에서 다시 확인하세요.";
      tone = "warning";
      needsReview = true;
    }
  } else if (portonePayment) {
    if (paymentStatus === "verified" && linkedToTicket) {
      label = "카드 완료";
      detail = "PG 카드 결제가 서버에서 확인됐고 이 회원권에 연결됐습니다.";
      tone = "success";
      needsReview = false;
    } else if (["ready", "pending"].includes(paymentStatus)) {
      label = "카드 결제대기";
      detail = "PG 결제창은 생성됐지만 결제 완료가 확인되지 않았습니다.";
      tone = "warning";
      needsReview = true;
    } else if (paymentStatus === "failed") {
      label = "카드 실패";
      detail = "PG 카드 결제가 완료되지 않았습니다.";
      tone = "danger";
      needsReview = true;
    } else if (paymentStatus === "cancelled") {
      label = "카드 취소";
      detail = "PG 카드 결제가 취소됐습니다.";
      tone = "neutral";
      needsReview = false;
    } else {
      label = "카드 확인 필요";
      detail = "PG 카드 결제 상태 또는 회원권 연결을 확인하세요.";
      tone = "warning";
      needsReview = true;
    }
  } else if (bankPayment) {
    if (paymentStatus === "verified" || stateValue === "complete") {
      label = "입금 확인";
      detail = "계좌 입금이 확인됐고 회원권에 반영됐습니다.";
      tone = "success";
      needsReview = false;
    } else if (["ready", "pending"].includes(paymentStatus)) {
      label = "입금 대기";
      detail = "입금자명과 금액을 확인한 뒤 입금 확인을 진행하세요.";
      tone = "warning";
      needsReview = true;
    }
  } else if (provider === "google_sheet_history") {
    label = "이관 결제";
    detail = "과거 구글시트 결제 근거를 보존한 기록입니다.";
    tone = "success";
    needsReview = false;
  } else if (provider === "admin_manual" && (paymentStatus === "verified" || stateValue === "complete")) {
    label = "현장 확인";
    detail = "관리자가 확인해 등록한 결제입니다.";
    tone = "success";
    needsReview = false;
  } else if (stateValue === "incomplete") {
    label = "결제 확인 필요";
    detail = "결제일·수단·금액 또는 회원권 연결이 완전하지 않습니다.";
  }
  return {
    state: stateValue,
    date: projection.payment_recorded_on ? memberDetailDateLabel(projection.payment_recorded_on) : "미입력",
    method: stateValue === "transfer_zero" ? "양도" : paymentMethodLabel(projection.payment_method || ""),
    amount: `${money.format(Number(projection.payment_amount || 0))}원`,
    label,
    detail,
    tone,
    needsReview,
  };
}

function memberTicketScheduleScopeLabel(ticket) {
  const scope = String(ticket?.scheduleScope || "").toLowerCase();
  if (scope === "weekday") return "평일";
  if (scope === "weekend") return "주말";
  if (scope === "mixed") return "혼합";
  return "연결 확인";
}

function memberTicketPartnerLabel(member, ticket) {
  if (!ticket || Number(ticket.groupSize || 1) !== 2) return "-";
  const partnerId = memberTicketPartnerUserId(ticket, member);
  return (adminLiveDataState.users || []).find((user) => user.id === partnerId)?.name || "연결 확인";
}

function memberTicketSettlementGridLabel(ticket) {
  if (!ticket) return "-";
  const review = ticket.policySnapshot?.admin_grid_price_review;
  if (review?.required === true) return "가격 확인";
  const amount = Number(ticket.settlementBasePrice || 0);
  return amount > 0 ? `${money.format(amount)}원 기준` : "기존 정산 유지";
}

function memberTicketGridReviewReasons(member, ticket) {
  if (!ticket) return ["회원권 없음"];
  const reasons = [];
  const payment = memberTicketPaymentGrid(member, ticket);
  if (!ticket.productId || !ticket.scheduleScope) reasons.push("상품 연결 오류");
  if (!ticket.serverUserId && !member?.serverUserId) reasons.push("회원 연결 오류");
  if (payment.needsReview) reasons.push(payment.label || "결제 확인 필요");
  if (ticket.policySnapshot?.admin_grid_price_review?.required === true) reasons.push("가격 차이 확인");
  if (Number(ticket.used || 0) + Number(ticket.remaining || 0) !== Number(ticket.total || 0)) reasons.push("횟수 불일치");
  if (Number(ticket.groupSize || 1) === 2 && !memberTicketPartnerUserId(ticket, member)) reasons.push("파트너 연결 오류");
  return reasons;
}

function memberTicketGridMatches(member, ticket) {
  const filter = String(state.memberTicketGridFilter || "all");
  if (filter === "all") return true;
  const stateCode = String(window.TennisNoteTicketState?.derive(ticket) || ticket?.status || "");
  if (filter === "review") return memberTicketGridReviewReasons(member, ticket).length > 0;
  if (filter === "active") return stateCode === "current" || ticket?.status === "active";
  if (filter === "pending_payment") return ticket?.status === "pending_payment" || memberTicketPaymentGrid(member, ticket).state === "incomplete";
  if (filter === "expiring") {
    const today = adminLocalDateKey(new Date());
    const cutoff = addMemberManagementDays(today, 14);
    return Boolean(ticket?.expires && ticket.expires >= today && ticket.expires <= cutoff);
  }
  if (filter === "link_error") return memberTicketGridReviewReasons(member, ticket).some((reason) => reason.includes("연결"));
  return true;
}
