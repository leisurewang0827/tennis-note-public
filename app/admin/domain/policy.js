// 정책·상품·할인 값 판정을 하는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function couponProductFamilyKey(product = {}) {
  const title = `${product.title || ""} ${product.format || ""}`;
  const lessonMinutes = Number(product.lessonMinutes) || (title.includes("30") ? 30 : 20);
  const groupSize = Number(product.groupSize) || (title.includes("2대1") || title.includes("2:1") ? 2 : 1);
  return `${lessonMinutes}:${groupSize}`;
}

function couponProductSaleIssue(product = {}) {
  if (product.productKind !== "coupon" && product.mode !== "pass" && product.mode !== "coupon") return "";
  const sessions = Number(product.tickets);
  if (!Number.isInteger(sessions) || sessions <= 0) return "쿠폰 충전 횟수를 1회 이상 입력해 주세요.";
  if (Number(product.validityDays) <= 0) return "쿠폰 사용기간을 1일 이상 입력해 주세요.";
  if (Number(product.cashAmount) <= 0) return "현금가격을 입력해 주세요.";
  return "";
}

function membershipProductWithOperationalLimits(product = {}) {
  const titleFrequency = String(product.title || product.name || "").match(/주\s*(\d+)\s*회/);
  const inferredFrequency = Math.max(
    1,
    Math.min(
      7,
      Number(titleFrequency?.[1])
        || (product.productKind === "coupon"
          ? Math.min(2, Number(product.tickets) || 1)
          : Math.ceil((Number(product.tickets) || 4) / 4)),
    ),
  );
  const frequencyPerWeek = Math.max(1, Number(product.frequencyPerWeek) || inferredFrequency);
  const maxSessionsPerWeek = Math.max(
    frequencyPerWeek,
    Number(product.maxSessionsPerWeek) || frequencyPerWeek,
  );
  return {
    ...product,
    frequencyPerWeek,
    maxSessionsPerDay: Math.max(1, Number(product.maxSessionsPerDay) || frequencyPerWeek),
    maxSessionsPerWeek,
    maxBookingDaysPerWeek: Math.max(
      1,
      Math.min(maxSessionsPerWeek, Number(product.maxBookingDaysPerWeek) || frequencyPerWeek),
    ),
  };
}

function membershipProductServerSavePayload(nextProduct, serverProduct) {
  const serverKind = nextProduct.productKind === "coupon" ? "coupon" : "regular";
  const cashPrice = Math.max(0, Number(nextProduct.cashAmount) || 0);
  const cardPrice = Math.max(0, Number(nextProduct.cardAmount) || cashPrice);
  return {
    id: serverProduct.id,
    name: nextProduct.title,
    totalSessions: Math.max(1, Number(nextProduct.tickets) || 1),
    cashPrice,
    cardPrice,
    settlementBasePrice: cashPrice,
    validityDays: Math.max(1, Number(nextProduct.validityDays) || 1),
    graceDays: Math.max(0, Number(nextProduct.graceDays) || 0),
    lessonMinutes: Math.max(10, Number(nextProduct.lessonMinutes) || 20),
    groupSize: Math.max(1, Math.min(2, Number(nextProduct.groupSize) || 1)),
    frequencyPerWeek: Math.max(1, Number(nextProduct.frequencyPerWeek) || 1),
    maxSessionsPerDay: Math.max(1, Number(nextProduct.maxSessionsPerDay) || 1),
    maxSessionsPerWeek: Math.max(1, Number(nextProduct.maxSessionsPerWeek) || 1),
    maxBookingDaysPerWeek: Math.max(1, Number(nextProduct.maxBookingDaysPerWeek) || 1),
    scheduleScope: ["weekday", "weekend", "mixed"].includes(nextProduct.scheduleScope) ? nextProduct.scheduleScope : "weekday",
    productKind: serverKind,
    discountEnabled: nextProduct.discountEnabled === true,
    coachDiscountAllowed: nextProduct.coachDiscountAllowed === true,
    displayOrder: Math.max(0, Number(nextProduct.sortOrder) || 0),
    status: nextProduct.status,
    countLabel: nextProduct.sessions || `${nextProduct.tickets}회`,
    purchaseExperience: nextProduct.purchaseExperience || "",
    firstLessonOfferEnabled: nextProduct.firstLessonOfferEnabled === true,
    firstLessonOfferPrice: Math.max(0, Number(nextProduct.firstLessonOfferPrice) || 0),
  };
}

function savedMembershipProductMatches(result, allLiveData = adminLiveDataState) {
  if (!result?.serverId || !result.expected) return false;
  const saved = (allLiveData.products || []).find((item) => String(item.id) === String(result.serverId));
  const expected = result.expected;
  return Boolean(saved
    && saved.name === expected.title
    && Number(saved.total_sessions) === Number(expected.tickets)
    && Number(saved.lesson_minutes) === Number(expected.lessonMinutes)
    && Number(saved.group_size) === Number(expected.groupSize)
    && Number(saved.validity_days) === Number(expected.validityDays)
    && saved.schedule_scope === expected.scheduleScope
    && saved.product_kind === result.expectedKind
    && Number(saved.card_price) === Number(expected.cardAmount)
    && Number(saved.cash_price) === Number(expected.cashAmount)
    && String(saved.policy_settings?.adminSaleStatus || "") === String(expected.status)
    && String(saved.policy_settings?.purchaseExperience || "") === String(expected.purchaseExperience || "")
    && Boolean(saved.policy_settings?.firstLessonOfferEnabled) === Boolean(expected.firstLessonOfferEnabled)
    && Number(saved.policy_settings?.firstLessonOfferPrice || 0) === Number(expected.firstLessonOfferPrice || 0));
}

function serverMembershipProductForDraft(product = {}, allLiveData = adminLiveDataState) {
  const serverProducts = allLiveData.products || [];
  const idMatch = serverProducts.find((item) => item.id === product.serverProductId);
  if (idMatch) return idMatch;
  const codeMatch = serverProducts.find((item) => item.product_code && item.product_code === product.id);
  if (codeMatch) return codeMatch;
  const nameMatches = serverProducts.filter((item) => (
    item.name === (product.title || product.name)
    && (!product.branchId || String(item.branch_id || "") === String(product.branchId))
  ));
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function normalizeLessonPolicy(policy = {}, index = 0) {
  const status = policy.status === "inactive" ? "inactive" : "active";
  const rawOrder = Number(policy.order);
  return {
    id: String(policy.id || `lesson-policy-${Date.now()}-${index}`),
    title: String(policy.title || "새 수업 정책").trim() || "새 수업 정책",
    detail: String(policy.detail || "정책 내용을 입력해 주세요.").trim() || "정책 내용을 입력해 주세요.",
    category: String(policy.category || "기타").trim() || "기타",
    status,
    order: Number.isFinite(rawOrder) ? rawOrder : index,
    systemKey: String(policy.systemKey || ""),
  };
}

function lessonPolicyPayload(allLessonPolicies = lessonPolicies) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: allLessonPolicies.map((policy, index) => ({
      ...normalizeLessonPolicy(policy, index),
      order: index,
    })),
  };
}

function normalizePolicyVersion(policy = {}) {
  const sections = Array.isArray(policy.sections) ? policy.sections : [];
  return {
    id: policy.id || `policy-${Date.now()}`,
    title: policy.title || "운영 정책 버전",
    status: policy.status === "draft" || policy.status === "archived" ? policy.status : "active",
    effectiveFrom: policy.effectiveFrom || new Date().toISOString().slice(0, 10),
    source: policy.source || "관리자 설정",
    summary: policy.summary || "회원권 구매 시점의 운영정책을 함께 저장합니다.",
    sections: sections.map((section, index) => {
      const sectionId = section.id || `section-${index + 1}`;
      const savedRules = Array.isArray(section.rules) ? section.rules.filter(Boolean) : [];
      const hasLegacyRefundRule = sectionId === "refund"
        && savedRules.some((rule) => /할인 전 정상가|첫 달 예약금|부가세 제외 현금 기준가/.test(rule));
      return {
        id: sectionId,
        title: section.title || "정책 항목",
        rules: hasLegacyRefundRule ? [...refundPolicyRuleDefaults] : savedRules,
      };
    }),
    ticketSnapshot: {
      policyVersionId: policy.ticketSnapshot?.policyVersionId || policy.id || "policy-current",
      snapshotTiming: policy.ticketSnapshot?.snapshotTiming || "payment_confirmed",
      fields: Array.isArray(policy.ticketSnapshot?.fields)
        ? policy.ticketSnapshot.fields
        : ["product", "price", "validity", "makeup", "refund"],
    },
  };
}

function activePolicyVersion(allPolicyVersions = policyVersions) {
  return allPolicyVersions.find((policy) => policy.status === "active") || allPolicyVersions[0];
}

function policyVersionPayload(allPolicyVersions = policyVersions) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: allPolicyVersions.map((policy) => normalizePolicyVersion(policy)),
  };
}

function policyVersionEditorSectionMarkup(section = {}, options = {}) {
  const sectionId = section.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const rules = Array.isArray(section.rules) ? section.rules.join("\n") : "";
  return `
    <article class="policy-section-editor" data-policy-section-editor data-section-id="${escapeHtml(sectionId)}">
      <div class="policy-section-editor-heading">
        <strong>${options.isNew ? "새 정책 항목" : escapeHtml(section.title || "정책 항목")}</strong>
        <button class="icon-button" type="button" title="항목 삭제" aria-label="정책 항목 삭제" data-remove-policy-section>×</button>
      </div>
      <label>
        <small>항목명</small>
        <input type="text" maxlength="50" value="${escapeHtml(section.title || "")}" data-policy-section-field="title" />
      </label>
      <label>
        <small>정책 내용 <span>한 줄에 한 항목씩 입력</span></small>
        <textarea rows="4" maxlength="1600" data-policy-section-field="rules">${escapeHtml(rules)}</textarea>
      </label>
    </article>`;
}

function normalizeDiscountPolicy(policy = {}) {
  const type = policy.type === "amount" ? "amount" : "percent";
  return {
    id: policy.id || `discount-${Date.now()}`,
    title: policy.title || "새 할인권",
    type,
    value: numericValue(policy.value, type === "percent" ? 10 : 10000),
    target: policy.target || "전체 회원권",
    payment: policy.payment || "카드/현금",
    issueRule: policy.issueRule || "관리자 발급",
    coachPermission: policy.coachPermission || "코치별 지급 수량 안에서 사용",
    coachQuota: numericValue(policy.coachQuota, 0),
    burden: policy.burden || "센터 부담",
    expiresDays: numericValue(policy.expiresDays, 30),
    status: policy.status || "사용",
    issued: numericValue(policy.issued, 0),
    used: numericValue(policy.used, 0),
    branchId: policy.branchId || policy.branch_id || "",
    serverUpdatedAt: policy.serverUpdatedAt || policy.updated_at || "",
  };
}

function discountAvailableCount(policy = {}) {
  return Math.max(0, numericValue(policy.issued, 0) - numericValue(policy.used, 0));
}

function normalizeMemberManagementPolicy(settings = {}) {
  return {
    coachCanCorrectTicket: settings.coachCanCorrectTicket === true,
    coachCanExpireTicket: settings.coachCanExpireTicket === true,
    coachCanReenroll: settings.coachCanReenroll === true,
    requireAdminPin: settings.requireAdminPin !== false,
  };
}

function memberManagementProductWeeklyFrequency(product, fallback = 1) {
  if (memberManagementProductIsCoupon(product)) return 1;
  const configured = Number(product?.frequency_per_week || fallback || 1);
  const scope = memberManagementProductScheduleScope(product);
  return Math.max(1, Math.min(scope === "weekend" ? 2 : 3, configured));
}

function productSettingFieldLabel(label, required = false, conditional = "") {
  const badge = required ? "필수" : conditional || "선택";
  const tone = required ? "is-required" : conditional ? "is-conditional" : "is-optional";
  return `<span class="member-field-label">${escapeHtml(label)}<em class="${tone}">${escapeHtml(badge)}</em></span>`;
}

function syncMemberManagementBalance(form) {
  if (!form?.elements?.totalSessions || !form.elements.usedSessions || !form.elements.remainingSessions) return;
  const total = Math.max(0, Number(form.elements.totalSessions.value) || 0);
  const used = Math.max(0, Number(form.elements.usedSessions.value) || 0);
  form.elements.remainingSessions.value = Math.max(0, total - used);
}

function normalizeNotificationPolicy(settings = {}) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
  };
  return {
    lessonDayBeforeEnabled: settings.lessonDayBeforeEnabled !== false,
    lesson30MinutesEnabled: settings.lesson30MinutesEnabled !== false,
    couponNextBookingEnabled: settings.couponNextBookingEnabled !== false,
    ticketLowRemainingEnabled: settings.ticketLowRemainingEnabled !== false,
    lowRemainingThreshold: clamp(settings.lowRemainingThreshold, 1, 5, 2),
    ticketExpiryEnabled: settings.ticketExpiryEnabled !== false,
    expiryDaysBefore: clamp(settings.expiryDaysBefore, 1, 30, 7),
    ticketExpiredEnabled: settings.ticketExpiredEnabled !== false,
    coachFeedbackReminderEnabled: settings.coachFeedbackReminderEnabled !== false,
    coachFeedbackReminderMinutes: clamp(settings.coachFeedbackReminderMinutes, 10, 1440, 30),
    coachFeedbackAdminEscalationEnabled: settings.coachFeedbackAdminEscalationEnabled !== false,
    coachFeedbackAdminEscalationHours: clamp(settings.coachFeedbackAdminEscalationHours, 1, 168, 24),
    memberFeedbackReadyEnabled: settings.memberFeedbackReadyEnabled !== false,
    scheduleRequestStaffEnabled: settings.scheduleRequestStaffEnabled !== false,
    updatedAt: settings.updatedAt || settings.updated_at || "",
  };
}

function syncMemberInlineProductCancellation(form) {
  if (!form?.elements.ticketStatus || !form.elements.productId) return;
  const cancelled = !form.elements.productId.value;
  form.elements.ticketStatus.value = cancelled ? "expired" : "active";
  if (!cancelled) return;
  form.elements.usedSessions.value = form.elements.totalSessions.value || 0;
  syncMemberManagementBalance(form);
}
