// 회원권 구매 흐름의 단계·시간 선택을 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberGroupPaymentModeLabel(mode = "representative") {
  if (mode === "alternate") return "결제자를 번갈아 지정";
  if (mode === "separate") return "각자 회원권 결제";
  return "대표회원이 두 사람 함께 결제";
}

function isGroupMembershipProduct(product = {}) {
  return Number(product.groupSize || 1) === 2
    || product.productKind === "group"
    || product.mode === "group"
    || `${product.title || ""} ${product.detail || ""}`.includes("2대1");
}

function purchaseFlowProduct() {
  const flow = purchaseFlowState();
  return membershipProducts().find((product) => (
    String(product.id || "") === String(flow.productId || "")
    && isDirectPurchaseMembershipProduct(product)
  )) || null;
}

function purchaseProductDisplayTitle(product = {}) {
  const title = String(product.title || "회원권");
  if (membershipProductFamilyId(product) !== "coupon") return title;
  return title.replace(/(^|\s)(평일|주말)(?=\s|$)/g, " ").replace(/\s{2,}/g, " ").trim() || "쿠폰 레슨";
}

function couponEquivalentProducts(product = {}) {
  if (membershipProductFamilyId(product) !== "coupon") return [product];
  const offerKey = couponProductOfferKey(product);
  return membershipProductsForFamily("coupon").filter((candidate) => couponProductOfferKey(candidate) === offerKey);
}

function purchaseProductScheduleScopes(product = {}) {
  const products = membershipProductFamilyId(product) === "coupon" ? couponEquivalentProducts(product) : [product];
  const scopes = new Set();
  products.forEach((candidate) => {
    const scope = membershipProductFacet(candidate, "scheduleScope");
    if (scope === "mixed") {
      scopes.add("weekday");
      scopes.add("weekend");
    } else {
      scopes.add(scope);
    }
  });
  return scopes;
}

function purchaseProductForScheduleSlot(product = {}, slot = {}) {
  if (membershipProductFamilyId(product) !== "coupon") return product;
  const targetScope = ["토", "일"].includes(slot.day) ? "weekend" : "weekday";
  const equivalents = couponEquivalentProducts(product);
  return equivalents.find((candidate) => membershipProductFacet(candidate, "scheduleScope") === "mixed")
    || equivalents.find((candidate) => membershipProductFacet(candidate, "scheduleScope") === targetScope)
    || null;
}

function purchaseDateDay(dateKey = "") {
  const value = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  return days[value.getDay() === 0 ? 6 : value.getDay() - 1] || "";
}

function purchaseDateLabel(dateKey = "") {
  const [, month, date] = String(dateKey).split("-");
  const day = purchaseDateDay(dateKey);
  return month && date ? `${Number(month)}/${Number(date)}(${day})` : day;
}

function purchaseEffectiveStartDate() {
  const sourceTicket = purchaseFlowSourceTicket();
  if (purchaseFlowState().purchasePurpose !== "renew_same" || !sourceTicket?.expiresOn) return localDateKey();
  const nextDate = new Date(`${sourceTicket.expiresOn}T12:00:00`);
  if (Number.isNaN(nextDate.getTime())) return localDateKey();
  nextDate.setDate(nextDate.getDate() + 1);
  return [localDateKey(), localDateKey(nextDate)].sort().at(-1) || localDateKey();
}

function purchaseScheduleWeek() {
  return memberScheduleWeekForOffset(memberWeekOffsetForDate(purchaseEffectiveStartDate()));
}

function purchaseOperationAllowsSlot(operation, time, durationMinutes) {
  if (!operation) return true;
  const mode = String(operation.mode || "normal");
  if (mode === "closed") return false;
  if (mode !== "shortened") return true;
  const start = String(operation.startTime || operation.start_time || "").slice(0, 5);
  const end = String(operation.endTime || operation.end_time || "").slice(0, 5);
  if (!start || !end) return false;
  return minutesFromTime(time) >= minutesFromTime(start)
    && minutesFromTime(time) + durationMinutes <= minutesFromTime(end);
}

function purchaseHasCoachLessonAtDate(scheduleLessons, lessonDate, time, coach, durationMinutes, policy) {
  const slotStart = minutesFromTime(time);
  const slotEnd = slotStart + durationMinutes;
  return scheduleLessons.some((lesson) => {
    if (lesson.status === "available" || String(lesson.lessonDate || "") !== lessonDate) return false;
    const lessonStatus = String(lesson.serverStatus || lesson.status || "").toLowerCase();
    if (["cancelled", "canceled", "absence", "absent", "makeup_due"].includes(lessonStatus)) return false;
    const lessonCoachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || memberLessonCoach(lesson, policy).id || "");
    const coachRoleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    if (lessonCoachRoleId !== coachRoleId) return false;
    const lessonStart = minutesFromTime(lesson.time);
    const lessonEnd = lessonStart + lessonDuration(lesson);
    return slotStart < lessonEnd && slotEnd > lessonStart;
  });
}

function purchaseRequiredScheduleCount(product = purchaseFlowProduct()) {
  if (!product || membershipProductFacet(product, "productKind") === "coupon") return 1;
  return Math.max(1, Number(product.frequencyPerWeek) || 1);
}

function purchaseSelectedSchedules(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const durationMinutes = Math.max(10, Number(product?.lessonMinutes) || 20);
  const coachRoleId = String(flow.coachRoleId || "");
  return flow.preferredSchedules
    .filter((schedule) => !coachRoleId || String(schedule.coachRoleId) === coachRoleId)
    .map((schedule) => ({ ...schedule, durationMinutes }));
}

function clearPurchaseSchedules() {
  const flow = purchaseFlowState();
  flow.preferredSchedules = [];
  flow.preferredDate = "";
  flow.preferredDay = "";
  flow.preferredTime = "";
}

function syncLegacyPurchaseScheduleFields() {
  const flow = purchaseFlowState();
  const first = flow.preferredSchedules[0] || null;
  flow.preferredDate = first?.lessonDate || "";
  flow.preferredDay = first?.day || purchaseDateDay(first?.lessonDate || "");
  flow.preferredTime = first?.startTime || "";
}

function purchaseProductCard(product = {}, selected = false) {
  const family = membershipProductFamilyDefinition(product);
  const paymentMethod = paymentMethodDefinition(normalizeSelectedPaymentMethod());
  const amount = purchasePaymentAmount(product, paymentMethod.id);
  const validityLabel = Number(product.validityDays || 0) > 0 ? `사용 ${Number(product.validityDays)}일` : "";
  return `
    <button class="purchase-product-option ${selected ? "is-selected" : ""}" type="button" data-purchase-product="${escapeHtml(product.id || "")}" aria-pressed="${selected}">
      <span>${escapeHtml(family.label)} · ${escapeHtml(product.badge || `${product.tickets || 0}회`)}</span>
      <strong>${escapeHtml(purchaseProductDisplayTitle(product))}</strong>
      ${validityLabel ? `<small>${escapeHtml(validityLabel)}</small>` : ""}
      <b>${escapeHtml(paymentMethod.shortLabel)} ${escapeHtml(formatWon(amount))}</b>
    </button>`;
}

function purchaseFamilyOptionsHtml(products = membershipProducts(), selectedFamilyId = purchaseFlowState().familyId) {
  const flow = purchaseFlowState();
  const sourceTicket = purchaseFlowSourceTicket();
  const sourceFamilyId = sourceTicket ? membershipProductFamilyId(sourceTicket) : "";
  const visibleFamilies = flow.purchasePurpose === "renew_same" && sourceTicket
    ? membershipPresetDefinitions.filter((family) => (
      sourceFamilyId === "coupon" ? family.id === "coupon" : ["four-week", "three-month"].includes(family.id)
    ))
    : membershipPresetDefinitions;
  return visibleFamilies.map((family) => {
    const count = distinctMembershipProductsForFamily(family.id, products).length;
    const selected = family.id === selectedFamilyId;
    const readyLabel = family.id === "three-month" ? "10% 할인" : `${count}개`;
    return `
      <button class="purchase-family-option ${selected ? "is-selected" : ""} ${count ? "" : "is-unavailable"}" type="button" data-purchase-family="${family.id}" aria-pressed="${selected}">
        <strong>${family.label}</strong><b>${count ? readyLabel : "준비 중"}</b>
      </button>`;
  }).join("");
}

function purchaseStepOneHtml() {
  const flow = purchaseFlowState();
  const products = membershipProducts();
  const sourceTicket = purchaseFlowSourceTicket();
  const matchingProducts = purchaseMatchingProducts(products, sourceTicket)
    .sort((left, right) => Number(left.displayOrder || 999) - Number(right.displayOrder || 999)
      || purchaseProductDisplayTitle(left).localeCompare(purchaseProductDisplayTitle(right), "ko"));
  const renewing = flow.purchasePurpose === "renew_same" && Boolean(sourceTicket);
  return `
    <div class="purchase-family-grid" role="group" aria-label="수업 형태">${purchaseFamilyOptionsHtml(products, flow.familyId)}</div>
    ${purchaseSimpleProductFiltersHtml()}
    <div class="purchase-product-options">
      <div><strong>${renewing ? "연장 기간" : "상품"}</strong><span>${matchingProducts.length}개</span></div>
      ${matchingProducts.length
    ? matchingProducts.map((product) => purchaseProductCard(product, String(product.id) === String(flow.productId))).join("")
    : purchaseEmptyFamilyHtml(flow.familyId)}
    </div>`;
}

function purchasePaymentMethodOptionsHtml() {
  const selectedMethodId = normalizeSelectedPaymentMethod();
  const readyMethods = paymentMethodDefinitions
    .map((method) => paymentMethodDefinition(method.id))
    .filter((method) => isPaymentGatewayReady(method.id))
    .sort((left, right) => Number(left.displayOrder || 999) - Number(right.displayOrder || 999));
  const methodOptions = readyMethods.map((method) => {
    const selected = method.id === selectedMethodId;
    const amount = purchasePaymentAmount(purchaseFlowProduct() || {}, method.id);
    return `<button class="payment-method-option ${selected ? "is-selected" : ""}" type="button" data-select-payment-method="${method.id}" aria-pressed="${selected}"><strong>${method.label} · ${escapeHtml(formatWon(amount))}</strong><small>${method.detail}</small></button>`;
  }).join("");
  const bankUnavailable = !readyMethods.some((method) => method.id === "bank_transfer")
    ? '<p class="payment-method-unavailable-note" role="status">현재 계좌이체를 사용할 수 없습니다.</p>'
    : "";
  if (readyMethods.length) return `${methodOptions}${bankUnavailable}`;
  return '<p class="payment-method-unavailable" role="status">온라인 결제를 준비하고 있습니다. 지금은 센터에 문의해 주세요.</p>';
}

function purchaseStepThreeHtml() {
  const product = purchaseFlowProduct();
  if (!product) return memberEmptyState({ title: "선택한 상품을 찾을 수 없습니다", reason: "상품 단계로 돌아가 다시 선택해 주세요.", compact: true });
  const method = paymentMethodDefinition(normalizeSelectedPaymentMethod());
  const flow = purchaseFlowState();
  const coupons = purchaseDiscountCoupons(product, method.id);
  if (flow.discountIssueId && !coupons.some((coupon) => String(coupon.id) === String(flow.discountIssueId))) {
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
  }
  const discountQuote = ensureBestPurchaseDiscountCoupon(product, method.id);
  const amount = purchasePaymentAmount(product, method.id);
  const automaticOffer = membershipPricingQuote(product)?.eligible === true;
  const paymentError = flow.paymentErrorMessage
    ? `<div class="purchase-payment-error" role="alert"><span>${escapeHtml(flow.paymentErrorMessage)}</span>${flow.paymentErrorCode === "bank_transfer_account_lookup_failed" ? '<button class="small-button" type="button" data-retry-bank-transfer>다시 확인</button>' : ""}</div>`
    : "";
  const couponControl = automaticOffer
    ? '<p class="purchase-coupon-note">신규 첫 수업 15,000원 혜택이 자동 적용되어 다른 쿠폰과 중복되지 않습니다.</p>'
    : coupons.length
      ? `<label class="purchase-coupon-select"><span>할인 쿠폰${flow.discountSelectionMode === "auto" && discountQuote ? " · 최대 할인 자동 적용" : ""}</span><select data-select-discount-coupon><option value="">적용 안 함</option>${coupons.map((coupon) => `<option value="${escapeHtml(coupon.id)}" ${String(coupon.id) === String(flow.discountIssueId) ? "selected" : ""}>${escapeHtml(coupon.name)} · ${escapeHtml(discountCouponValueLabel(coupon))}</option>`).join("")}</select></label>`
      : '<p class="purchase-coupon-note">현재 적용 가능한 할인 쿠폰이 없습니다.</p>';
  return `
    <button class="purchase-payment-summary" type="button" data-open-purchase-payment-method aria-haspopup="dialog">
      <span><small>결제 방법</small><strong>${escapeHtml(method.label)}</strong></span>
      <b>${escapeHtml(formatWon(amount))}</b>
      <em>변경</em>
    </button>
    ${couponControl}
    ${discountQuote ? `<p class="purchase-discount-result"><span>쿠폰 할인</span><strong>-${escapeHtml(formatWon(discountQuote.discountAmount))}</strong></p>` : ""}
    ${paymentError}
    <p class="purchase-policy-note">결제가 확인된 뒤 회원권이 생성됩니다.</p>`;
}

function purchaseStepFourHtml() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  return `
    <article class="purchase-complete-card" role="status">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(flow.completionStatus || "결제 결과를 확인하고 있습니다")}</strong>
      <p>${escapeHtml(product ? purchaseProductDisplayTitle(product) : "선택 회원권")} · 회원권은 결제 검증 뒤 한 번만 생성되거나 연장됩니다.</p>
      <div>
        <button class="primary-button" type="button" data-open-current-membership>내 회원권 확인</button>
        <button class="small-button" type="button" data-view="scheduleView">시간표 보기</button>
      </div>
    </article>`;
}

function purchaseStepCanContinue() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  const purposeReady = ["renew_same", "add_coach", "new_purchase", "one_day"].includes(flow.purchasePurpose);
  if (!purposeReady || !product || !isPaymentGatewayReady(normalizeSelectedPaymentMethod())) return false;
  if (flow.purchasePurpose === "renew_same" && purchaseFlowSourceTicket() && flow.scheduleMode === "keep") return true;
  const schedules = purchaseSelectedSchedules(product);
  const requiredCount = purchaseRequiredScheduleCount(product);
  const selectedWeeks = new Set(schedules.map((schedule) => purchaseWeekStartDate(schedule.lessonDate)));
  return Boolean(
    flow.coachRoleId
    && schedules.length === requiredCount
    && selectedWeeks.size === 1
    && purchaseSchedulesAvailableNow(product)
    && schedules.every((schedule) => (
      schedule.lessonDate
      && schedule.day
      && schedule.startTime
      && String(schedule.coachRoleId) === String(flow.coachRoleId)
    ))
  );
}

function purchaseSinglePageHtml() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  const sourceTicket = purchaseFlowSourceTicket();
  const keepRenewalSchedule = Boolean(
    product
    && sourceTicket
    && flow.purchasePurpose === "renew_same"
    && flow.scheduleMode === "keep"
    && membershipProductFacet(product, "productKind") !== "coupon"
  );
  const lesson = sourceTicket ? purchaseTicketLesson(sourceTicket) : null;
  const selectedSchedules = purchaseSelectedSchedules(product);
  const selectedCoachName = flow.coachName || sourceTicket?.coach || memberScheduleTicketCoachName(sourceTicket || {}) || "";
  const scheduleSummary = keepRenewalSchedule
    ? `${memberCoachShortName(selectedCoachName || "담당 코치")} 코치 · ${lesson ? `${lesson.day || ""} ${lesson.time || ""}`.trim() : "기존 시간 유지"}`
    : selectedSchedules.length
      ? `${memberCoachShortName(selectedCoachName || "선택한 코치")} 코치 · ${selectedSchedules.map((schedule) => `${schedule.day} ${schedule.startTime}`).join(" · ")}`
      : "선생님과 시간을 선택해 주세요";
  return `
    ${purchasePurposeOptionsHtml()}
    <section class="purchase-selection-summary" aria-label="결제 선택 내용">
      <button class="purchase-selection-row" type="button" data-open-purchase-product aria-haspopup="dialog">
        <span><small>상품</small><strong>${escapeHtml(product ? purchaseProductDisplayTitle(product) : "상품을 선택해 주세요")}</strong></span><em>변경</em>
      </button>
      ${product ? `<button class="purchase-selection-row" type="button" ${keepRenewalSchedule ? "data-edit-purchase-renewal-schedule" : "data-open-purchase-schedule"} aria-haspopup="dialog">
        <span><small>선생님·시간</small><strong>${escapeHtml(scheduleSummary)}</strong></span><em>변경</em>
      </button>
      <div class="purchase-selection-payment">${purchaseStepThreeHtml()}</div>` : ""}
    </section>`;
}

function selectPurchaseRenewalTicket(ticketId = "") {
  const flow = purchaseFlowState();
  flow.renewalTicketId = ticketId;
  selectPurchasePurpose("renew_same");
}

async function submitMembershipPurchaseFlow() {
  if (membershipPurchasePaymentInFlight) return;
  const product = purchaseFlowProduct();
  if (!product || !purchaseStepCanContinue()) return;
  membershipPurchasePaymentInFlight = true;
  renderMembershipPurchaseFlow();
  try {
    if (state.dataMode === "live") {
      const ready = await refreshPurchaseScheduleAvailability();
      if (!ready || !purchaseStepCanContinue()) {
        showToast("최신 시간표에서 가능한 시간을 다시 확인해 주세요.");
        return;
      }
    }
    await startProductPayment(product.id);
  } finally {
    membershipPurchasePaymentInFlight = false;
    if (purchaseFlowState().open) renderMembershipPurchaseFlow();
  }
}
