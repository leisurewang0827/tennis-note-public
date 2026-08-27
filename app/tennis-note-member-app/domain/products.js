// 회원권 상품과 구매 금액을 다루는 순수 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function normalizeProduct(product = {}, fallback = {}) {
  const merged = { ...fallback, ...product };
  const cleanText = (value = "") => String(value)
    .replaceAll("횟수권", "쿠폰제")
    .replaceAll("쿠폰권", "쿠폰제")
    .replaceAll("쿠폰 수업권", "쿠폰제");
  const title = cleanText(merged.title || merged.name || "회원권");
  const amount = numericValue(merged.amount, numericValue(fallback.amount));
  const listAmount = numericValue(merged.listAmount, numericValue(fallback.listAmount));
  const settlementBase = numericValue(merged.settlementBase, amount);
  const tickets = numericValue(merged.tickets, numericValue(fallback.tickets));
  const mode = merged.mode === "coupon" ? "pass" : merged.mode || fallback.mode || "fixed";
  const productKind = merged.productKind || (mode === "group" ? "group" : mode === "pass" ? "pass" : mode === "renewal" || mode === "add" ? "consult" : "regular");
  return {
    ...merged,
    id: merged.id || `product-${Date.now()}`,
    group: cleanText(merged.group || fallback.group || "회원권"),
    title,
    name: cleanText(merged.name || title),
    detail: cleanText(merged.detail || merged.format || fallback.detail || "관리자 설정 회원권"),
    format: cleanText(merged.format || fallback.format || merged.detail || "회원권"),
    listAmount,
    amount,
    settlementBase,
    tickets,
    cardAmount: numericValue(merged.cardAmount, numericValue(fallback.cardAmount, listAmount || amount)),
    cashAmount: numericValue(merged.cashAmount, numericValue(fallback.cashAmount, settlementBase || amount)),
    validityDays: numericValue(merged.validityDays, numericValue(fallback.validityDays, mode === "pass" ? 60 : 35)),
    graceDays: numericValue(merged.graceDays, numericValue(fallback.graceDays, mode === "pass" ? 7 : 14)),
    lessonMinutes: numericValue(merged.lessonMinutes, numericValue(fallback.lessonMinutes, 20)),
    frequencyPerWeek: numericValue(merged.frequencyPerWeek, numericValue(fallback.frequencyPerWeek, 1)),
    maxSessionsPerDay: numericValue(merged.maxSessionsPerDay, numericValue(fallback.maxSessionsPerDay, 0)),
    maxSessionsPerWeek: numericValue(merged.maxSessionsPerWeek, numericValue(fallback.maxSessionsPerWeek, 0)),
    maxBookingDaysPerWeek: numericValue(merged.maxBookingDaysPerWeek, numericValue(fallback.maxBookingDaysPerWeek, 0)),
    makeupAnchorMinutes: (() => {
      const configured = Object.prototype.hasOwnProperty.call(merged, "makeupAnchorMinutes")
        ? merged.makeupAnchorMinutes
        : Object.prototype.hasOwnProperty.call(merged, "makeup_anchor_minutes")
          ? merged.makeup_anchor_minutes
          : Object.prototype.hasOwnProperty.call(fallback, "makeupAnchorMinutes")
            ? fallback.makeupAnchorMinutes
            : Object.prototype.hasOwnProperty.call(fallback, "makeup_anchor_minutes")
              ? fallback.makeup_anchor_minutes
              : 40;
      if (configured === null || String(configured).toLowerCase() === "unlimited") return null;
      return Math.min(100, Math.max(0, numericValue(configured, 40)));
    })(),
    purchaseExperience: merged.purchaseExperience || fallback.purchaseExperience || "",
    firstLessonOfferEnabled: merged.firstLessonOfferEnabled ?? fallback.firstLessonOfferEnabled ?? false,
    firstLessonOfferPrice: numericValue(
      merged.firstLessonOfferPrice,
      numericValue(fallback.firstLessonOfferPrice, 15000),
    ),
    coachSaleAvailability: merged.coachSaleAvailability && typeof merged.coachSaleAvailability === "object"
      ? { ...merged.coachSaleAvailability }
      : fallback.coachSaleAvailability && typeof fallback.coachSaleAvailability === "object" ? { ...fallback.coachSaleAvailability } : {},
    coachSaleMode: String(merged.coachSaleMode || fallback.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active",
    productKind,
    discountEnabled: merged.discountEnabled ?? fallback.discountEnabled ?? true,
    coachDiscountAllowed: merged.coachDiscountAllowed ?? fallback.coachDiscountAllowed ?? false,
    coach: merged.coach || fallback.coach || "선택 코치 전용",
    flow: cleanText(merged.flow || fallback.flow || "시간 선택 → 회원권 선택 → 결제"),
    mode,
    discount: cleanText(merged.discount || fallback.discount || "관리자 설정 기준 적용"),
    badge: cleanText(merged.badge || fallback.badge || "회원권"),
    rule: cleanText(merged.rule || fallback.rule || "코치별 회원권으로 관리합니다."),
    status: merged.status || fallback.status || "sale",
  };
}

function isOneDayMembershipProduct(product = {}) {
  const productCode = String(product.productCode || product.serverProductCode || product.product_code || product.id || "").toLowerCase();
  const productKind = String(product.productKind || product.product_kind || "").toLowerCase();
  const mode = String(product.mode || "").toLowerCase();
  const tickets = numericValue(product.tickets, numericValue(product.total_sessions));
  const label = `${product.title || ""} ${product.name || ""} ${product.group || ""}`;
  return productCode.startsWith("one-day-")
    || product.purchaseExperience === "one_day"
    || ((["coupon", "pass"].includes(productKind) || mode === "pass") && tickets === 1 && /원데이|1회\s*(체험|레슨)|체험\s*1회/.test(label));
}

function formatWon(value) {
  const number = numericValue(value);
  return number ? `${number.toLocaleString("ko-KR")}원` : "상담";
}

function productUsagePills(product) {
  const pills = [];
  if (product.frequencyPerWeek) pills.push(`주 ${product.frequencyPerWeek}회`);
  if (product.lessonMinutes) pills.push(`${product.lessonMinutes}분`);
  if (product.tickets) pills.push(`${product.tickets}회`);
  if (pills.length < 3 && product.validityDays) pills.push(`사용 ${product.validityDays}일`);
  if (!pills.length) pills.push("상담");
  return pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("");
}

function productOperationNote(product) {
  if (product.status === "consult" || !product.amount) return "관리자 확인 후 회원권, 담당 코치, 시간을 확정합니다.";
  if (product.productKind === "pass" || product.mode === "pass") return "고정 시간이 없는 쿠폰제라 예약할 때마다 가능한 시간에서 1회씩 차감됩니다.";
  if (product.productKind === "group" || product.mode === "group") return "동반 회원을 하나의 회원권으로 묶고 시간표에는 두 이름을 함께 표시합니다.";
  return "고정 시간은 잔여 2회부터 재등록 안내가 가고, 미결제 시 다음 주차부터 시간이 열립니다.";
}

function productPriceRows(product) {
  if (product.status === "consult" || !product.amount) {
    return `
      <div class="product-price-panel consult">
        <strong>상담 후 확정</strong>
        <small>${escapeHtml(product.flow)}</small>
      </div>`;
  }
  const quote = membershipPricingQuote(product);
  if (isOneDayMembershipProduct(product) && product.firstLessonOfferEnabled) {
    const offerPrice = quote?.eligible
      ? numericValue(quote.finalAmount, product.firstLessonOfferPrice)
      : numericValue(product.firstLessonOfferPrice, 15000);
    const offerLabel = quote?.eligible
      ? "신규 첫 수업 적용"
      : quote
        ? "신규 혜택 적용 대상 아님"
        : "로그인 후 신규 자격 확인";
    return `
      <div class="product-price-panel one-day-offer ${quote?.eligible ? "is-eligible" : ""}">
        <div><span>첫 수업 1회</span><strong>${formatWon(offerPrice)}</strong></div>
        <div><span>정상가</span><b>카드 ${formatWon(product.cardAmount || product.listAmount)} · 현금 ${formatWon(product.cashAmount || product.amount)}</b></div>
        <small>${escapeHtml(offerLabel)} · 최초 1회만</small>
      </div>`;
  }
  return `
    <div class="product-price-panel">
      <div><span>카드 결제</span><strong>${formatWon(product.cardAmount || product.listAmount)}</strong></div>
      <div><span>계좌이체</span><b>${formatWon(product.cashAmount || product.amount)}</b></div>
    </div>`;
}

function membershipProductFamilyId(product = {}) {
  if (isOneDayMembershipProduct(product)) return "one-day";
  const productKind = membershipProductFacet(product, "productKind");
  if (productKind === "coupon") return "coupon";
  const termWeeks = Number(product.termWeeks || product.term_weeks) || 0;
  const validityDays = Number(product.validityDays || product.validity_days) || 0;
  return termWeeks >= 12 || validityDays >= 84 || /3개월|12주/.test(`${product.title || ""} ${product.name || ""}`)
    ? "three-month"
    : "four-week";
}

function membershipProductFamilyDefinition(productOrId = "") {
  const requestedId = typeof productOrId === "string" ? productOrId : membershipProductFamilyId(productOrId);
  const aliases = {
    "weekday-coupon": "coupon",
    "weekend-coupon": "coupon",
    "weekday-regular": "four-week",
    "weekend-regular": "four-week",
    group: "four-week",
  };
  const familyId = aliases[requestedId] || requestedId;
  return membershipPresetDefinitions.find((family) => family.id === familyId) || membershipPresetDefinitions[0];
}

function membershipProductsForFamily(familyId, products = membershipProducts()) {
  return products.filter((product) => membershipProductFamilyId(product) === familyId);
}

function membershipProductRecommendationScore(product = {}, sourceTicket = null) {
  let score = Math.max(0, 1000 - Number(product.displayOrder || product.sortOrder || 1000));
  if (product.status === "sale") score += 500;
  if (Number(product.lessonMinutes) === 20) score += 80;
  if ([8, 10].includes(Number(product.tickets))) score += 60;
  if (sourceTicket && String(sourceTicket.productId || "") === String(product.id || "")) score += 10000;
  if (sourceTicket && Number(sourceTicket.groupSize || 1) === Number(product.groupSize || 1)) score += 400;
  if (sourceTicket && Number(sourceTicket.lessonMinutes || 20) === Number(product.lessonMinutes || 20)) score += 300;
  return score;
}

function couponProductOfferKey(product = {}) {
  return [
    Number(product.tickets) || 0,
    Number(product.lessonMinutes) || 0,
    Number(product.groupSize) || 1,
    Number(product.cardAmount || product.listAmount || product.amount) || 0,
    Number(product.cashAmount || product.settlementBase || product.amount) || 0,
  ].join(":");
}

function distinctMembershipProductsForFamily(familyId, products = membershipProducts()) {
  const familyProducts = membershipProductsForFamily(familyId, products).filter(isDirectPurchaseMembershipProduct);
  if (familyId !== "coupon") return familyProducts;
  const seen = new Set();
  return familyProducts.filter((product) => {
    const key = couponProductOfferKey(product);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recommendedMembershipProducts(products = membershipProducts(), familyId = "", sourceTicket = null) {
  const familyProducts = familyId ? distinctMembershipProductsForFamily(familyId, products) : products;
  return [...familyProducts]
    .sort((left, right) => membershipProductRecommendationScore(right, sourceTicket) - membershipProductRecommendationScore(left, sourceTicket))
    .slice(0, 3);
}

function membershipProductFacet(product, key) {
  const title = `${product.title || ""} ${product.group || ""}`;
  if (key === "scheduleScope") {
    if (["weekday", "weekend", "mixed"].includes(product.scheduleScope)) return product.scheduleScope;
    if (title.includes("주말")) return "weekend";
    if (title.includes("혼합")) return "mixed";
    return "weekday";
  }
  if (key === "productKind") {
    if (product.status === "consult" || product.productKind === "consult") return "consult";
    if (["coupon", "pass"].includes(product.productKind) || product.mode === "pass") return "coupon";
    return "regular";
  }
  if (key === "groupSize") {
    return String(Number(product.groupSize) || (/2대1|2:1/.test(title) ? 2 : 1));
  }
  if (key === "lessonMinutes") {
    const titleMinutes = title.match(/(20|30|40)분/)?.[1];
    return String(Number(product.lessonMinutes) || Number(titleMinutes) || 20);
  }
  return "";
}

function onlinePaymentAmount(product = {}) {
  const quote = membershipPricingQuote(product);
  if (quote && Number(quote.finalAmount) > 0) return numericValue(quote.finalAmount);
  return numericValue(product.cardAmount, numericValue(product.listAmount, numericValue(product.amount)));
}

function purchasePaymentBaseAmount(product = {}, methodId = state.selectedPaymentMethod) {
  const quote = membershipPricingQuote(product);
  if (quote?.eligible === true && Number(quote.finalAmount) > 0) return numericValue(quote.finalAmount);
  if (String(methodId) === "bank_transfer") {
    return numericValue(product.cashAmount, numericValue(product.settlementBase, numericValue(product.amount)));
  }
  return onlinePaymentAmount(product);
}

function discountCouponMatchesPayment(coupon = {}, methodId = state.selectedPaymentMethod) {
  const scope = String(coupon.paymentScope || "card_cash");
  if (scope === "cash_only") return String(methodId) === "bank_transfer";
  if (scope === "card_only") return String(methodId) !== "bank_transfer";
  return true;
}

function purchaseDiscountCoupons(product = {}, methodId = state.selectedPaymentMethod) {
  if (paymentMethodDefinition(methodId).couponAllowed === false) return [];
  if (product.discountEnabled === false || membershipPricingQuote(product)?.eligible === true) return [];
  const productScope = isOneDayMembershipProduct(product)
    ? "one_day"
    : ["coupon", "pass"].includes(String(product.productKind || "").toLowerCase()) ? "coupon" : "regular";
  return availableDiscountCoupons().filter((coupon) => (
    (!product.branchId || !coupon.branchId || String(coupon.branchId) === String(product.branchId))
    && (!coupon.productScope || coupon.productScope === "all" || coupon.productScope === productScope)
    && discountCouponMatchesPayment(coupon, methodId)
  ));
}

function purchaseCouponQuote(coupon = {}, product = {}, methodId = state.selectedPaymentMethod) {
  if (!coupon?.id) return null;
  const originalAmount = purchasePaymentBaseAmount(product, methodId);
  const discountAmount = coupon.discountType === "amount"
    ? Math.round(Number(coupon.discountValue || 0))
    : Math.round(originalAmount * Math.min(100, Math.max(0, Number(coupon.discountValue || 0))) / 100);
  const finalAmount = originalAmount - Math.min(originalAmount, discountAmount);
  if (!Number.isFinite(finalAmount) || finalAmount < 100) return null;
  return { coupon, originalAmount, discountAmount: originalAmount - finalAmount, finalAmount };
}

function bestPurchaseDiscountCoupon(product = {}, methodId = state.selectedPaymentMethod) {
  return purchaseDiscountCoupons(product, methodId)
    .map((coupon) => purchaseCouponQuote(coupon, product, methodId))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.discountAmount !== left.discountAmount) return right.discountAmount - left.discountAmount;
      const leftExpiresAt = left.coupon.expiresAt ? new Date(left.coupon.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightExpiresAt = right.coupon.expiresAt ? new Date(right.coupon.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftExpiresAt !== rightExpiresAt) return leftExpiresAt - rightExpiresAt;
      return String(left.coupon.id || "").localeCompare(String(right.coupon.id || ""));
    })[0] || null;
}

function ensureBestPurchaseDiscountCoupon(product = {}, methodId = state.selectedPaymentMethod) {
  const flow = purchaseFlowState();
  const coupons = purchaseDiscountCoupons(product, methodId);
  if (flow.discountIssueId && !coupons.some((coupon) => String(coupon.id) === String(flow.discountIssueId))) {
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
  }
  if (flow.discountSelectionMode === "manual") return purchaseDiscountQuote(product, methodId);
  const bestQuote = bestPurchaseDiscountCoupon(product, methodId);
  flow.discountIssueId = bestQuote?.coupon?.id || "";
  return bestQuote;
}

function purchaseDiscountQuote(product = {}, methodId = state.selectedPaymentMethod) {
  const flow = purchaseFlowState();
  if (String(flow.productId || "") !== String(product.id || "") || !flow.discountIssueId) return null;
  const coupon = purchaseDiscountCoupons(product, methodId)
    .find((item) => String(item.id || "") === String(flow.discountIssueId));
  return purchaseCouponQuote(coupon, product, methodId);
}

function purchasePaymentAmount(product = {}, methodId = state.selectedPaymentMethod) {
  return purchaseDiscountQuote(product, methodId)?.finalAmount || purchasePaymentBaseAmount(product, methodId);
}
