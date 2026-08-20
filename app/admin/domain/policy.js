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
  const cardPrice = Math.round(cashPrice * 1.1);
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
    productScope: ["all", "regular", "coupon", "one_day"].includes(policy.productScope) ? policy.productScope : "all",
    campaignType: ["general", "new_member", "returning", "referral"].includes(policy.campaignType) ? policy.campaignType : "general",
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

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function couponPolicyTemplate({ id, lessonMinutes, groupSize, sessions }) {
  const lessonType = groupSize === 2 ? "2대1" : "1대1";
  const validityDays = sessions * 14;
  return {
    id,
    group: "쿠폰제",
    name: `${lessonType} ${lessonMinutes}분 쿠폰 ${sessions}회`,
    title: `${lessonType} ${lessonMinutes}분 쿠폰 ${sessions}회`,
    detail: "고정시간 없이 담당 코치의 가능한 시간에 예약",
    format: `${lessonType} · ${lessonMinutes}분`,
    sessions: `${sessions}회`,
    rule: `${sessions}회는 ${sessions * 2}주 사용 · 개인 사정 유예 2주 · 시간표는 2대1 팀에 자동 연동`,
    listAmount: 0,
    amount: 0,
    settlementBase: 0,
    tickets: sessions,
    cardAmount: 0,
    cashAmount: 0,
    validityDays,
    graceDays: 14,
    lessonMinutes,
    groupSize,
    groupDeductionPolicy: "shared_once",
    productKind: "pass",
    discountEnabled: true,
    coachDiscountAllowed: true,
    coach: "선택 코치 전용",
    flow: groupSize === 2 ? "2대1 팀 연결 → 결제방식 선택 → 공동 시간표 예약" : "코치 선택 → 결제 → 가능한 시간 예약",
    mode: "pass",
    discount: sessions === 10 ? "10회권은 5회권보다 회당가 할인 필수" : "기준 회당가",
    badge: `${sessions}회`,
    status: "hidden",
  };
}

function operationsRole() {
  if (adminLocalPreviewMode) return "admin";
  return String(adminImportAuthState.profile?.role || "");
}

function adminOperationalCacheKey() {
  const userId = adminImportAuthState.user?.id || adminImportAuthState.profile?.id || "";
  const role = operationsRole();
  return userId && role ? `${userId}:${role}` : "";
}

async function readAdminOperationalCache() {
  const key = adminOperationalCacheKey();
  if (!key) return null;
  const database = await openAdminOperationalCache();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(adminOperationalCacheStoreName, "readonly")
        .objectStore(adminOperationalCacheStoreName)
        .get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("indexeddb_read_failed"));
    });
  } finally {
    database.close();
  }
}

async function writeAdminOperationalCache() {
  const key = adminOperationalCacheKey();
  if (!key || !state.liveScheduleLoaded) return false;
  const snapshot = {
    savedAt: Date.now(),
    coaches,
    members,
    lessons,
    makeupRequests,
    tickets,
    expiredTickets,
    billings,
    billingLogs: billingLogs.slice(0, 100),
    groupAccounts,
    lessonNotes,
  };
  const database = await openAdminOperationalCache();
  try {
    await new Promise((resolve, reject) => {
      const request = database
        .transaction(adminOperationalCacheStoreName, "readwrite")
        .objectStore(adminOperationalCacheStoreName)
        .put(snapshot, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("indexeddb_write_failed"));
    });
    return true;
  } finally {
    database.close();
  }
}

async function clearAdminOperationalCache() {
  const key = adminOperationalCacheKey();
  if (!key) return;
  try {
    const database = await openAdminOperationalCache();
    try {
      await new Promise((resolve, reject) => {
        const request = database
          .transaction(adminOperationalCacheStoreName, "readwrite")
          .objectStore(adminOperationalCacheStoreName)
          .delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error("indexeddb_delete_failed"));
      });
    } finally {
      database.close();
    }
  } catch {
    // A cache cleanup failure must not block logout.
  }
}

function defaultAdminLayoutSettings() {
  return {
    menuOrder: [...adminDefaultMenuOrder],
    moreMenus: [...adminDefaultMoreMenus],
    hiddenMenus: [],
    groupOrder: adminDashboardGroupDefinitions.map((item) => item.id),
    hiddenGroups: [],
    widgetOrder: Object.fromEntries(
      Object.entries(adminDashboardWidgetDefinitions).map(([group, items]) => [group, items.map((item) => item.id)]),
    ),
    hiddenWidgets: [],
    reportWidgetOrder: adminReportWidgetDefinitions.map((item) => item.id),
    hiddenReportWidgets: [],
    reportWidgetSizes: Object.fromEntries(adminReportWidgetDefinitions.map((item) => [item.id, item.defaultSize || "two"])),
    reportWidgetFilters: Object.fromEntries(adminReportWidgetDefinitions.map((item) => [item.id, "all"])),
  };
}

function normalizeAdminLayoutSettings(value = {}) {
  const defaults = defaultAdminLayoutSettings();
  const requiredMenus = adminMenuDefinitions.filter((item) => item.required).map((item) => item.id);
  const requiredWidgets = Object.values(adminDashboardWidgetDefinitions)
    .flat()
    .filter((item) => item.required)
    .map((item) => item.id);
  const requiredGroups = adminDashboardGroupDefinitions.filter((item) => item.required).map((item) => item.id);
  const requiredReportWidgets = adminReportWidgetDefinitions.filter((item) => item.required).map((item) => item.id);
  return {
    menuOrder: normalizeLayoutOrder(value.menuOrder ?? defaults.menuOrder, adminMenuDefinitions),
    moreMenus: [...new Set((Array.isArray(value.moreMenus) ? value.moreMenus : defaults.moreMenus)
      .filter((id) => defaults.menuOrder.includes(id) && id !== "dashboard"))],
    hiddenMenus: [...new Set((Array.isArray(value.hiddenMenus) ? value.hiddenMenus : [])
      .filter((id) => !requiredMenus.includes(id) && defaults.menuOrder.includes(id)))],
    groupOrder: normalizeLayoutOrder(value.groupOrder, adminDashboardGroupDefinitions),
    hiddenGroups: [...new Set((Array.isArray(value.hiddenGroups) ? value.hiddenGroups : [])
      .filter((id) => !requiredGroups.includes(id) && defaults.groupOrder.includes(id)))],
    widgetOrder: Object.fromEntries(
      Object.entries(adminDashboardWidgetDefinitions).map(([group, items]) => [
        group,
        normalizeLayoutOrder(value.widgetOrder?.[group], items),
      ]),
    ),
    hiddenWidgets: [...new Set((Array.isArray(value.hiddenWidgets) ? value.hiddenWidgets : [])
      .filter((id) => !requiredWidgets.includes(id)))],
    reportWidgetOrder: normalizeLayoutOrder(value.reportWidgetOrder, adminReportWidgetDefinitions),
    hiddenReportWidgets: [...new Set((Array.isArray(value.hiddenReportWidgets) ? value.hiddenReportWidgets : [])
      .filter((id) => !requiredReportWidgets.includes(id) && adminReportWidgetDefinitions.some((item) => item.id === id)))],
    reportWidgetSizes: Object.fromEntries(adminReportWidgetDefinitions.map((item) => {
      const size = value.reportWidgetSizes?.[item.id];
      return [item.id, adminReportWidgetSizeOptions.some((option) => option.id === size) ? size : defaults.reportWidgetSizes[item.id]];
    })),
    reportWidgetFilters: Object.fromEntries(adminReportWidgetDefinitions.map((item) => {
      const filter = value.reportWidgetFilters?.[item.id];
      return [item.id, adminReportWidgetFilterOptions.some((option) => option.id === filter) ? filter : defaults.reportWidgetFilters[item.id]];
    })),
  };
}

function normalizeAdminLockSettings(source = {}) {
  const timeoutMinutes = numericValue(source.timeoutMinutes, defaultAdminLockSettings.timeoutMinutes);
  const allowedViews = adminLockViewOptions.map((item) => item.id);
  const lockedViews = Array.isArray(source.lockedViews)
    ? source.lockedViews.filter((view) => allowedViews.includes(view))
    : defaultAdminLockSettings.lockedViews;
  const pinHash = typeof source.pinHash === "string" ? source.pinHash : defaultAdminLockSettings.pinHash;
  const legacyPin = typeof source.pin === "string" ? source.pin : typeof source.legacyPin === "string" ? source.legacyPin : defaultAdminLockSettings.legacyPin;
  const usesLegacyDemoPin = legacyPin === legacyDefaultAdminPin || legacyDefaultAdminPinHashes.has(pinHash);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaultAdminLockSettings.enabled,
    pinHash: usesLegacyDemoPin ? "" : pinHash,
    legacyPin: usesLegacyDemoPin ? "" : legacyPin,
    pinConfigured: usesLegacyDemoPin ? false : source.pinConfigured === true || Boolean(pinHash || legacyPin),
    timeoutMinutes: Math.min(Math.max(timeoutMinutes, 1), 120),
    lockedViews: [...new Set(lockedViews)],
    pastAbsenceRequirePinEveryTime: source.pastAbsenceRequirePinEveryTime !== false,
  };
}

function serializableAdminLockSettings() {
  const payload = {
    enabled: adminLockSettings.enabled,
    pinHash: adminLockSettings.pinHash,
    pinConfigured: adminLockSettings.pinConfigured,
    timeoutMinutes: adminLockSettings.timeoutMinutes,
    lockedViews: [...adminLockSettings.lockedViews],
    pastAbsenceRequirePinEveryTime: adminLockSettings.pastAbsenceRequirePinEveryTime,
  };
  if (!payload.pinHash && adminLockSettings.legacyPin) payload.pin = adminLockSettings.legacyPin;
  return payload;
}

function normalizeOperationProfile(profile = {}, index = 0) {
  const fallbackId = `operation-profile-${index + 1}`;
  const fallbackBranch = defaultOperationBranch();
  const branchId = String(profile.branchId || profile.branch_id || fallbackBranch?.id || "");
  const branch = operationBranchOptions().find((item) => item.id === branchId);
  return {
    id: String(profile.id || fallbackId),
    name: String(profile.name || `운영 프로필 ${index + 1}`).trim() || `운영 프로필 ${index + 1}`,
    branchId,
    branchName: String(profile.branchName || profile.branch_name || branch?.name || fallbackBranch?.name || ""),
    scheduleSettings: {
      ...currentOperationScheduleSettings(),
      ...(profile.scheduleSettings || {}),
      breakRules: cloneOperationProfileValue(Array.isArray(profile.scheduleSettings?.breakRules) ? profile.scheduleSettings.breakRules : []),
      breakFavorites: cloneOperationProfileValue(Array.isArray(profile.scheduleSettings?.breakFavorites) ? profile.scheduleSettings.breakFavorites : []),
      lessonColors: {
        ...scheduleSettings.lessonColors,
        ...(profile.scheduleSettings?.lessonColors || {}),
      },
      lessonColorRules: cloneOperationProfileValue(Array.isArray(profile.scheduleSettings?.lessonColorRules) ? profile.scheduleSettings.lessonColorRules : []),
      adminTuningMode: profile.scheduleSettings?.adminTuningMode === true,
      memberScheduleRequestOnly: profile.scheduleSettings?.memberScheduleRequestOnly !== false,
    },
    coaches: cloneOperationProfileValue(Array.isArray(profile.coaches) ? profile.coaches : []),
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
}

function replaceOperationProfileBranchMap(value = {}) {
  Object.keys(activeOperationProfileIdsByBranch).forEach((branchId) => {
    delete activeOperationProfileIdsByBranch[branchId];
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  Object.entries(value).forEach(([branchId, profileId]) => {
    const normalizedBranchId = String(branchId || "");
    const normalizedProfileId = String(profileId || "");
    if (normalizedBranchId && normalizedProfileId) {
      activeOperationProfileIdsByBranch[normalizedBranchId] = normalizedProfileId;
    }
  });
}

function activeOperationProfile() {
  ensureOperationProfiles();
  return operationProfiles.find((profile) => profile.id === activeOperationProfileId) || operationProfiles[0];
}

function activeOperationBranchId() {
  return String(activeOperationProfile()?.branchId || "");
}

function activeOperationBranchName() {
  const profile = activeOperationProfile();
  return operationBranchOptions().find((branch) => branch.id === profile.branchId)?.name
    || profile.branchName
    || "전체 지점";
}

function matchesActiveOperationBranch(branchId = "") {
  const activeBranchId = activeOperationBranchId();
  if (!activeBranchId) return true;
  const normalizedBranchId = String(branchId || "");
  return normalizedBranchId
    ? normalizedBranchId === activeBranchId
    : operationBranchAllowsLegacyRows();
}

function memberOperationBranchIds(member = {}) {
  const userIds = new Set(memberServerUserIds(member));
  const relatedTicketBranches = [...tickets, ...expiredTickets]
    .filter((ticket) => (
      ticketBelongsToMember(ticket, member)
      || ticketParticipantUserIds(ticket).some((userId) => userIds.has(userId))
    ))
    .map((ticket) => ticket.branchId);
  return [...new Set([
    ...(Array.isArray(member.branchIds) ? member.branchIds : []),
    member.branchId,
    member.memberRecord?.branch_id,
    ...relatedTicketBranches,
  ].filter(Boolean).map(String))];
}

function defaultBranchSalesConfig() {
  return {
    features: {
      threeMonth: true,
      oneDay: true,
      coupons: true,
      newMemberBenefit: false,
      returningMemberBenefit: false,
      referralBenefit: false,
      bankNotificationEvidence: false,
    },
    paymentMethods: {
      tosspay: { enabled: true, title: "토스페이", displayOrder: 10, priceBasis: "card", couponAllowed: true },
      bank_transfer: { enabled: true, title: "계좌이체", displayOrder: 20, priceBasis: "cash", couponAllowed: true },
      card: { enabled: false, title: "카드", displayOrder: 30, priceBasis: "card", couponAllowed: true },
      kakaopay: { enabled: false, title: "카카오페이", displayOrder: 40, priceBasis: "card", couponAllowed: true },
      naverpay: { enabled: false, title: "네이버페이", displayOrder: 50, priceBasis: "card", couponAllowed: true },
      onsite_cash: { enabled: true, title: "현장 현금", displayOrder: 60, priceBasis: "cash", couponAllowed: false, adminOnly: true },
    },
    benefits: {
      newMember: { enabled: false, title: "신규회원 할인", discountType: "percent", discountValue: 5, expiresDays: 30 },
      returningMember: { enabled: false, title: "다시 시작 할인", discountType: "percent", discountValue: 5, expiresDays: 30, inactiveDays: 90 },
      referral: { enabled: false, title: "친구추천 할인", discountType: "percent", discountValue: 5, expiresDays: 30 },
    },
  };
}

function normalizeBranchSalesConfig(value = {}) {
  const defaults = defaultBranchSalesConfig();
  const source = value && typeof value === "object" ? value : {};
  const features = { ...defaults.features, ...(source.features || {}) };
  const paymentMethods = Object.fromEntries(Object.entries(defaults.paymentMethods).map(([id, method]) => {
    const next = { ...method, ...(source.paymentMethods?.[id] || {}) };
    next.priceBasis = ["bank_transfer", "onsite_cash"].includes(id) ? "cash" : "card";
    next.displayOrder = Math.max(1, Math.min(999, Number(next.displayOrder || method.displayOrder)));
    return [id, next];
  }));
  const benefits = Object.fromEntries(Object.entries(defaults.benefits).map(([id, benefit]) => [
    id,
    { ...benefit, ...(source.benefits?.[id] || {}) },
  ]));
  features.newMemberBenefit = benefits.newMember.enabled === true;
  features.returningMemberBenefit = benefits.returningMember.enabled === true;
  features.referralBenefit = benefits.referral.enabled === true;
  return { features, paymentMethods, benefits };
}

function refundPolicyEstimate(settings = refundPolicySettings) {
  const policy = normalizeRefundPolicySettings(settings);
  const product = normalizeMembershipProduct(membershipProductDrafts[0] || membershipProductDefaults[0], membershipProductDefaults[0]);
  const paidAmount = product.cardAmount;
  const undiscountedAmount = product.listAmount || product.cardAmount;
  const totalSessions = Math.max(1, numericValue(product.tickets, 4));
  const usedSessions = Math.min(1, totalSessions);
  const perSession = Math.round(undiscountedAmount / totalSessions);
  const usedDeduction = perSession * usedSessions;
  const penaltyAmount = Math.round(undiscountedAmount * (policy.penaltyRate / 100));
  const reservationFee = policy.reservationFee;
  const totalDeduction = penaltyAmount + usedDeduction + reservationFee;
  return {
    product,
    paidAmount,
    undiscountedAmount,
    totalSessions,
    usedSessions,
    perSession,
    usedDeduction,
    penaltyAmount,
    reservationFee,
    totalDeduction,
    refundAmount: Math.max(0, paidAmount - totalDeduction),
  };
}

function reflectHoldingPolicyInActiveVersion() {
  const policy = activePolicyVersion();
  if (!policy) return;
  let section = policy.sections.find((item) => item.id === "holding");
  if (!section) {
    section = { id: "holding", title: "홀딩", rules: [] };
    policy.sections.push(section);
  }
  section.rules = [
    `4주권 개인 사유 홀딩은 1회 최대 ${holdingPolicySettings.fourWeekPersonalMaxDays}일`,
    `3개월권 개인 사유 홀딩은 합계 최대 ${holdingPolicySettings.threeMonthPersonalMaxDays}일`,
    "쿠폰제는 개인 사유 홀딩 없음",
    `부상·입원 홀딩은 증빙 확인 후 최대 ${holdingPolicySettings.injuryMaxDays}일`,
    `부상 증빙 원본은 관리자만 확인하고 ${holdingPolicySettings.evidenceRetentionDays}일 후 삭제`,
    `긴급 사유는 ${holdingPolicySettings.emergencyRetroactiveDays}일 이내 소급 신청 가능`,
  ];
}

function ticketPolicySnapshot(product = {}, policy = activePolicyVersion()) {
  const normalizedProduct = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
  const normalizedPolicy = normalizePolicyVersion(policy);
  return {
    policyVersionId: normalizedPolicy.id,
    policyTitle: normalizedPolicy.title,
    effectiveFrom: normalizedPolicy.effectiveFrom,
    product: {
      id: normalizedProduct.id,
      title: normalizedProduct.title,
      cardAmount: normalizedProduct.cardAmount,
      cashAmount: normalizedProduct.cashAmount,
      settlementBase: normalizedProduct.settlementBase,
      tickets: normalizedProduct.tickets,
      validityDays: normalizedProduct.validityDays,
      graceDays: normalizedProduct.graceDays,
      productKind: normalizedProduct.productKind,
    },
    sections: normalizedPolicy.sections,
    refundPolicy: normalizeRefundPolicySettings(refundPolicySettings),
    holdingPolicy: { ...holdingPolicySettings },
    createdAt: new Date().toISOString(),
  };
}

async function copyPolicyVersion(policyId) {
  const source = policyVersions.find((policy) => policy.id === policyId) || activePolicyVersion();
  if (!source) return;
  const nextId = `policy-draft-${Date.now()}`;
  const copy = normalizePolicyVersion({
    ...source,
    id: nextId,
    title: `${source.title} 수정본`,
    status: "draft",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    source: "관리자 복사본",
    ticketSnapshot: {
      ...source.ticketSnapshot,
      policyVersionId: nextId,
    },
  });
  policyVersions.unshift(copy);
  await persistPolicyVersions("새 정책 수정본을 만들었습니다");
  openPolicyVersionEditor(nextId);
}

async function activatePolicyVersion(policyId) {
  const target = policyVersions.find((policy) => policy.id === policyId);
  if (!target) return;
  policyVersions.forEach((policy) => {
    policy.status = policy.id === policyId ? "active" : "archived";
  });
  await persistPolicyVersions("새 판매분에 적용할 정책을 변경했습니다");
}

function discountPolicyFromServer(row = {}, issueRows = []) {
  const related = issueRows.filter((issue) => String(issue.policy_id) === String(row.id));
  return normalizeDiscountPolicy({
    id: row.id,
    title: row.name,
    target: row.target_label,
    productScope: row.product_scope || "all",
    campaignType: row.campaign_type || "general",
    type: row.discount_type,
    value: row.discount_value,
    payment: discountPaymentFromServer[row.payment_scope] || "카드/현금",
    coachPermission: discountCoachPermissionFromServer[row.coach_permission] || "관리자만 사용",
    coachQuota: row.coach_issue_quota,
    expiresDays: row.expires_days,
    burden: discountBurdenFromServer[row.burden_party] || "센터 부담",
    status: discountStatusFromServer[row.status] || "검토",
    issued: related.length,
    used: related.filter((issue) => issue.status === "used").length,
    branchId: row.branch_id,
    serverUpdatedAt: row.updated_at,
  });
}

function uniqueOperationProfileName(candidate, excludedId = "") {
  const base = String(candidate || "").trim() || "새 운영 프로필";
  const existing = new Set(
    operationProfiles
      .filter((profile) => profile.id !== excludedId)
      .map((profile) => profile.name),
  );
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

async function activateOperationProfile(profileId) {
  const target = operationProfiles.find((profile) => profile.id === profileId);
  if (!target || target.id === activeOperationProfileId) return true;
  const backup = operationProfileWorkspaceBackup();
  activeOperationProfileId = target.id;
  markOperationProfileActiveForBranch(target);
  applyOperationProfile(target);
  resetOperationBranchViewState();
  return persistOperationProfileWorkspace(backup, `${target.name} 프로필을 적용했습니다.`);
}

async function copyPolicyGuide(guideId) {
  const guide = policyGuideTemplates.find((item) => item.id === guideId);
  if (!guide) return;
  try {
    await navigator.clipboard.writeText(guide.copy);
    showToast(`${guide.title} 안내문을 복사했습니다`);
  } catch {
    showToast("복사 권한을 확인해주세요");
  }

}

function branchSalesSettingsDirty() {
  return JSON.stringify(normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig))
    !== JSON.stringify(normalizeBranchSalesConfig(branchSalesSettingsState.appliedConfig));
}
