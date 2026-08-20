// tickets 관련 폼 항목·표시를 맞추는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function recalculateThreeMonthProductPrice(productId) {
  const card = document.querySelector(`[data-product-card="${CSS.escape(String(productId || ""))}"]`);
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  if (!card || !product) return;
  const baseProduct = membershipProductsForActiveOperationProfile().find((candidate) => (
    String(candidate.id) !== String(product.id)
    && candidate.productKind === "regular"
    && String(candidate.scheduleScope) === String(product.scheduleScope)
    && Number(candidate.groupSize) === Number(product.groupSize)
    && Number(candidate.lessonMinutes) === Number(product.lessonMinutes)
    && Number(candidate.frequencyPerWeek) === Number(product.frequencyPerWeek)
    && Number(candidate.termWeeks || 0) < 12
    && Number(candidate.validityDays || 0) < 84
  ));
  if (!baseProduct) {
    showToast("같은 조건의 4주 상품을 찾지 못했습니다. 가격을 직접 입력해 주세요.");
    return;
  }
  const rateInput = card.querySelector('[data-product-field="threeMonthDiscountRate"]');
  const modeInput = card.querySelector('[data-product-field="threeMonthPriceMode"]');
  const rate = Math.max(0, Math.min(90, Number(rateInput?.value) || 10));
  const multiplier = 1 - rate / 100;
  const cashInput = card.querySelector('[data-product-field="cashAmount"]');
  const cardInput = card.querySelector('[data-product-field="cardAmount"]');
  const cashPrice = Math.round(Number(baseProduct.cashAmount || 0) * 3 * multiplier);
  const cardPrice = Math.round(cashPrice * 1.1);
  if (cashInput) cashInput.value = String(cashPrice);
  if (cardInput) cardInput.value = String(cardPrice);
  if (modeInput) modeInput.value = "automatic";
  card.dataset.dirty = "true";
  showToast(`4주 현금가에 ${rate}% 할인을 적용하고 카드가는 10%를 더해 계산했습니다.`);
}

function membershipProductBulkSavePayload(product) {
  const card = document.querySelector(`[data-product-card="${CSS.escape(String(product.id))}"]`);
  const serverProduct = serverMembershipProductForDraft(product);
  if (!card || !serverProduct?.id) throw new Error("membership_product_visible_mapping_required");
  const fieldElement = (field) => card.querySelector(`[data-product-field="${field}"]`);
  const readField = (field) => fieldElement(field)?.value.trim() || "";
  const ticketValue = numericValue(readField("tickets"), product.tickets);
  const cashAmount = numericValue(readField("cashAmount"), product.cashAmount);
  const nextProduct = membershipProductWithOperationalLimits(normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || `${ticketValue}회`,
    tickets: ticketValue,
    cardAmount: Math.round(cashAmount * 1.1),
    cashAmount,
    validityDays: numericValue(readField("validityDays"), product.validityDays),
    graceDays: numericValue(readField("graceDays"), product.graceDays),
    lessonMinutes: numericValue(readField("lessonMinutes"), product.lessonMinutes),
    groupSize: numericValue(readField("groupSize"), product.groupSize),
    frequencyPerWeek: numericValue(readField("frequencyPerWeek"), product.frequencyPerWeek),
    maxSessionsPerDay: numericValue(readField("maxSessionsPerDay"), product.maxSessionsPerDay),
    maxSessionsPerWeek: numericValue(readField("maxSessionsPerWeek"), product.maxSessionsPerWeek),
    maxBookingDaysPerWeek: numericValue(readField("maxBookingDaysPerWeek"), product.maxBookingDaysPerWeek),
    scheduleScope: readField("scheduleScope") || product.scheduleScope,
    productKind: readField("productKind") || product.productKind,
    discountEnabled: fieldElement("discountEnabled")
      ? readField("discountEnabled") === "yes"
      : product.discountEnabled,
    coachDiscountAllowed: fieldElement("coachDiscountAllowed")
      ? readField("coachDiscountAllowed") === "yes"
      : product.coachDiscountAllowed,
    status: readField("status") || product.status,
  }, membershipProductDefaults.find((item) => item.id === product.id)));
  if (!nextProduct.title
    || Number(nextProduct.tickets) <= 0
    || Number(nextProduct.validityDays) <= 0
    || ![20, 30, 40].includes(Number(nextProduct.lessonMinutes))
    || ![1, 2].includes(Number(nextProduct.groupSize))
    || Number(nextProduct.frequencyPerWeek) <= 0
    || Number(nextProduct.maxSessionsPerDay) <= 0
    || Number(nextProduct.maxSessionsPerWeek) <= 0
    || Number(nextProduct.maxBookingDaysPerWeek) <= 0
    || Number(nextProduct.maxSessionsPerDay) > Number(nextProduct.maxSessionsPerWeek)
    || Number(nextProduct.maxBookingDaysPerWeek) > Number(nextProduct.maxSessionsPerWeek)) {
    throw new Error(`membership_product_invalid:${nextProduct.title || product.title || "회원권"}`);
  }
  const saleIssue = couponProductSaleIssue(nextProduct);
  if (saleIssue && nextProduct.status === "sale") {
    throw new Error(`membership_product_invalid:${nextProduct.title}:${saleIssue}`);
  }
  return membershipProductServerSavePayload(nextProduct, serverProduct);
}

function isCurrentMemberTicket(ticket, today = adminLocalDateKey(new Date())) {
  const state = window.TennisNoteTicketState?.derive(ticket, today);
  if (state) return ["current", "paused"].includes(state);
  if (!ticket || !["active", "paused"].includes(ticket.status)) return false;
  if (Number(ticket.remaining) <= 0) return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  return !ticket.expires || ticket.expires >= today;
}

function memberTicketGroups(member) {
  const memberTickets = allTicketsForMember(member);
  if (window.TennisNoteTicketState?.split) return window.TennisNoteTicketState.split(memberTickets);
  return {
    current: memberTickets.filter((ticket) => isCurrentMemberTicket(ticket)),
    upcoming: [],
    history: memberTickets.filter((ticket) => !isCurrentMemberTicket(ticket)),
  };
}

function memberTicketStatusLabel(ticket) {
  if (window.TennisNoteTicketState?.label) return window.TennisNoteTicketState.label(ticket);
  return ({
    active: "사용 중",
    paused: "일시정지",
    pending_payment: "결제 대기",
    expired: "만료",
    refunded: "환불 완료",
    voided: "삭제 처리",
  })[ticket?.status] || "상태 확인";
}

function memberManagementTickets(member) {
  const byId = new Map();
  [...tickets, ...expiredTickets].forEach((ticket) => {
    if (ticket?.serverTicketId && ticketBelongsToMember(ticket, member)) {
      byId.set(ticket.serverTicketId, ticket);
    }
  });
  if (window.TennisNoteTicketState?.sort) return window.TennisNoteTicketState.sort([...byId.values()]);
  const statusPriority = { active: 0, paused: 1, pending_payment: 2, expired: 3, refunded: 4, voided: 5 };
  return [...byId.values()].sort((left, right) => (
    (statusPriority[left.status] ?? 9) - (statusPriority[right.status] ?? 9)
    || String(right.expires || "").localeCompare(String(left.expires || ""))
  ));
}

function filterMemberTicketPartnerOptions(setup) {
  const partnerSearch = setup?.querySelector("[data-ticket-partner-search]");
  const partnerSelect = setup?.querySelector("[data-ticket-partner-user]");
  const result = setup?.querySelector("[data-ticket-partner-result]");
  if (!partnerSearch || !partnerSelect || !result) return;

  const query = normalizedPartnerSearchValue(partnerSearch.value);
  let matchCount = 0;
  Array.from(partnerSelect.options).forEach((option) => {
    if (!option.value) {
      option.hidden = false;
      option.disabled = false;
      return;
    }
    const searchValue = normalizedPartnerSearchValue(option.dataset.partnerSearch || option.textContent);
    const matches = !query || searchValue.includes(query);
    option.hidden = !matches;
    option.disabled = !matches;
    if (matches) matchCount += 1;
  });

  result.hidden = !query;
  result.textContent = matchCount ? `${matchCount}명 찾음` : "검색 결과가 없습니다";
}

function memberInlineProductSearchMatches(option, tokens = []) {
  const searchable = String(option?.dataset?.search || option?.textContent || "")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return tokens.every((token) => searchable.includes(token));
}

function selectMemberInlineProductSearchResult(button) {
  const form = button?.closest("[data-member-inline-form]");
  const select = form?.elements?.productId;
  const input = form?.querySelector("[data-member-product-search]");
  if (!form || !select || !button?.dataset.selectMemberProduct) return;
  select.value = button.dataset.selectMemberProduct;
  if (input) input.value = "";
  filterMemberInlineProductOptions(form);
  closeMemberInlineProductResults(form);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.focus();
}

function requestMemberInlineProductDuration(form, targetMinutes) {
  const select = form?.elements?.productId;
  const input = form?.querySelector("[data-member-product-search]");
  const message = form?.querySelector(".member-inline-message");
  if (!form || !select || ![20, 30].includes(Number(targetMinutes))) return;
  const currentProduct = (adminLiveDataState.products || [])
    .find((item) => String(item.id || "") === String(select.value || ""));
  const setGuidance = (value) => {
    if (!message) return;
    message.textContent = value;
    message.classList.remove("is-error", "is-success");
  };
  if (Number(currentProduct?.lesson_minutes || 0) === Number(targetMinutes)) {
    setGuidance(`이미 ${targetMinutes}분 회원권입니다. 시간표에서 해당 수업 길이만 ${targetMinutes}분으로 저장해 주세요.`);
    syncMemberInlineDurationShortcuts(form, currentProduct);
    return;
  }
  const selectableProductIds = new Set([...select.options].map((option) => String(option.value || "")).filter(Boolean));
  const candidates = (adminLiveDataState.products || []).filter((product) => (
    selectableProductIds.has(String(product.id || ""))
    && Number(product.lesson_minutes || 0) === Number(targetMinutes)
    && memberInlineProductsMatchExceptDuration(currentProduct, product)
  ));
  if (candidates.length !== 1) {
    if (input) {
      input.value = `${targetMinutes}분`;
      filterMemberInlineProductOptions(form);
      input.focus();
    }
    setGuidance(candidates.length
      ? `${targetMinutes}분 회원권이 ${candidates.length}개입니다. 검색 결과에서 정확한 회원권을 선택해 주세요.`
      : `조건이 같은 ${targetMinutes}분 회원권을 자동으로 찾지 못했습니다. 검색 결과에서 직접 선택해 주세요.`);
    return;
  }
  select.value = String(candidates[0].id);
  if (input) input.value = "";
  filterMemberInlineProductOptions(form);
  closeMemberInlineProductResults(form);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  setGuidance(`${targetMinutes}분 회원권을 선택했습니다. 저장하면 기존 시간표는 유지됩니다.`);
  select.focus();
}

function syncMemberInlineProductChangeNote(form, selectedProduct = null) {
  const note = form?.querySelector("[data-member-product-change-note]");
  if (!note) return;
  const initialProduct = (adminLiveDataState.products || [])
    .find((item) => String(item.id || "") === String(form.dataset.initialProductId || ""));
  const product = selectedProduct || (adminLiveDataState.products || [])
    .find((item) => String(item.id || "") === String(form.elements.productId?.value || ""));
  const changed = Boolean(initialProduct && product && initialProduct.id !== product.id);
  note.hidden = !changed;
  if (!changed) {
    note.textContent = "";
    return;
  }
  const fromMinutes = Number(initialProduct.lesson_minutes || 0);
  const toMinutes = Number(product.lesson_minutes || 0);
  const durationText = fromMinutes && toMinutes && fromMinutes !== toMinutes
    ? `${fromMinutes}분 → ${toMinutes}분 · `
    : "";
  note.textContent = `${durationText}회원권만 먼저 저장하면 기존 시간표는 유지됩니다.`;
}

function getLessonDurationFromSelectedTicket() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  return getTicketDurationMinutes(ticket);
}

function lessonTicketEligibilityDate() {
  const day = $("#lessonDay")?.value || "";
  return (day ? adminLessonDateForCandidate(day) : "") || adminLocalDateKey(new Date());
}

function alignCoachToSelectedMemberTicket() {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(memberReference, coachId).length) return;
  const ticket = findFirstTicketForMember(memberReference);
  if (ticket) $("#lessonCoach").value = ticket.coachId;
}

function alignTicketToLessonSource(preferredTicketId = state.pinnedLessonTicketId) {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  const source = normalizeLessonSource($("#lessonSource").value);
  const eligible = getEligibleTickets(memberReference, coachId);
  const matchingTicket = eligible.find((ticket) => (
    String(ticket.id) === String(preferredTicketId || "")
    && ticketMatchesLessonSource(ticket, source)
  )) || eligible.find((ticket) => ticketMatchesLessonSource(ticket, source));
  if (matchingTicket) $("#lessonTicket").value = matchingTicket.id;
  return matchingTicket || null;
}

function getSelectedTicket() {
  return scheduleTicketById($("#lessonTicket").value);
}
