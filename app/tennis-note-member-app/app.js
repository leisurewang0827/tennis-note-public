const state = {
  member: null,
  dataMode: "live",
  liveProfileId: "",
  memberEnrollment: null,
  pendingPurchaseProductId: "",
  profile: {
    name: "",
    nickname: "",
    phone: "",
    birthYear: "",
    neighborhood: "",
    gender: "",
    profileCompletedAt: "",
    termsConsentVersion: "",
    termsConsentedAt: "",
    privacyConsentVersion: "",
    privacyConsentedAt: "",
    marketingPushConsent: false,
    marketingSmsConsent: false,
    marketingEmailConsent: false,
    suggestedNickname: "",
    branch: "",
    mainCoach: "",
    ticket: "현재 이용권 없음",
    photoDataUrl: "",
    hand: "",
    backhand: "",
    startedAt: "",
    goal: "",
    styleMemo: "",
    selfNtrp: "",
    coachNtrp: "측정 전",
    ntrpCheckRequested: false,
  },
  coachModeAllowed: false,
  remaining: 0,
  demoPresentationVersion: 0,
  activeMemberWeekIndex: 0,
  selectedScheduleDay: "",
  scheduleTimeRange: "lesson",
  memberScheduleMode: "mine",
  selectedMemberScheduleTicketId: "",
  selectedMemberChangeSourceId: "",
  editingChangeRequestId: "",
  memberChangeCompactSelection: false,
  memberScheduleModeTouched: false,
  memberScheduleFullView: false,
  activeJournalMonth: "2026-07",
  selectedJournalDate: "2026-07-03",
  selectedLessonDetailId: "",
  journalSearchQuery: "",
  curriculumQuery: "",
  curriculumFilter: "all",
  lessonLogPage: 0,
  ticketHistoryPage: 0,
  expiredTicketPage: 0,
  practiceLogPage: 0,
  makeupRequests: [],
  lessonLogs: [],
  practiceLogs: [],
  paymentRequests: [],
  selectedPaymentMethod: "tosspay",
  livePaymentOptions: {
    allowedMethods: ["tosspay"],
    bankTransferEnabled: false,
    paymentMethods: [],
    settingsVersion: 0,
    features: { threeMonth: true, oneDay: true, coupons: true },
  },
  discountCoupons: [],
  purchaseFlow: {
    open: false,
    step: 1,
    familyId: "weekday-regular",
    productId: "",
    renewalTicketId: "",
    scheduleMode: "keep",
    coachRoleId: "",
    coachName: "",
    preferredDate: "",
    preferredDay: "",
    preferredTime: "",
    preferredSchedules: [],
    discountIssueId: "",
    discountSelectionMode: "auto",
    completionStatus: "",
  },
  membershipFilters: {
    scheduleScope: "weekday",
    productKind: "regular",
    groupSize: "1",
    lessonMinutes: "20",
  },
  membershipSelectedFamilyId: "weekday-regular",
  liveMembershipProducts: [],
  membershipPricingQuotes: {},
  liveTickets: [],
  liveLessons: [],
  liveLessonsLoaded: false,
  scheduleV2WorkspaceLoaded: false,
  scheduleV2SyncStatus: "idle",
  scheduleV2TargetKey: "",
  scheduleV2LoadedKey: "",
  scheduleV2SyncError: "",
  scheduleV2SyncErrorCode: "",
  scheduleV2Integrity: null,
  scheduleV2LastSyncedAt: "",
  serverChangeCandidates: [],
  serverChangeCandidateStatus: "idle",
  serverChangeCandidateKey: "",
  serverChangeCandidateError: "",
  serverChangeCandidateExclusions: {},
  serverChangeAnchorGapMinutes: 40,
  liveMakeupEntitlements: [],
  liveReleasedMakeupSlots: [],
  scheduleOperationDays: [],
  regularInitialSelections: [],
  regularInitialOperationKey: "",
  groupAccount: null,
  selectedHoldingTicketId: "",
  holdingPolicySettings: {
    personalMaxDays: 7,
    fourWeekPersonalMaxDays: 7,
    threeMonthPersonalMaxDays: 14,
    couponPersonalMaxDays: 0,
    injuryMaxDays: 30,
    emergencyRetroactiveDays: 3,
    evidenceRequired: true,
    evidenceRetentionDays: 30,
  },
  liveNotifications: [],
  pushNotifications: {
    permission: "unknown",
    status: "checking",
    detail: "수업 일정과 회원권 만료를 알려드립니다.",
  },
  accountDeletionRequest: null,
  ticketSyncStatus: { tone: "wait", text: "로그인 후 회원권을 확인합니다" },
  pendingPaymentCheckStatus: null,
  lastLiveTicketKey: "",
  lastLiveNotificationKey: "",
  lastReadFeedbackId: "",
  expiredTickets: [],
  noticeHiddenDate: "",
  noticeHiddenId: "",
  noticeHiddenIds: [],
  ticketHistory: [],
};

function memberEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${options.title || "표시할 내용이 없습니다."}</p>`;
}

function memberStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || String(value || "");
}

const brandSplashStartedAt = performance.now();
// The splash should confirm that the app opened, not hold the member on a
// blank screen while optional network requests finish.
const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;
let appToastTimer = 0;

function syncMemberVisualViewport() {
  const viewport = window.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || 1));
  const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
  document.documentElement.style.setProperty("--tn-visual-viewport-height", `${height}px`);
  document.documentElement.style.setProperty("--tn-visual-viewport-offset-top", `${offsetTop}px`);
  document.documentElement.style.setProperty("--tn-sheet-viewport-height", `${Math.round(height * 0.86)}px`);
}

syncMemberVisualViewport();
window.addEventListener("resize", syncMemberVisualViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncMemberVisualViewport, { passive: true });
window.visualViewport?.addEventListener("scroll", syncMemberVisualViewport, { passive: true });

const times = makeMemberTimeRange("18:40", "21:20");
const lessons = [];

const memberScheduleWeeks = [
  { label: "7월 1주차", range: "7/1~7/6", note: "이번 주 정규 수업과 변경 가능 시간" },
  {
    label: "7월 2주차",
    range: "7/8~7/13",
    note: "다음 주 정규 수업과 변경 가능 시간",
    lessons: [
      { id: "member-w2-mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w2-wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w2-tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
      { id: "member-w2-thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
      { id: "member-w2-fri-1900", day: "금", time: "19:00", coach: "강 코치", member: "이하린&최유나", type: "정규", status: "occupied" },
      { id: "member-w2-sat-1840", day: "토", time: "18:40", coach: "황 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    ],
  },
  {
    label: "7월 3주차",
    range: "7/15~7/20",
    note: "변경 요청이 반영된 주차 예시",
    lessons: [
      { id: "member-w3-mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w3-wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w3-thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "김서준", type: "수업 변경 요청", status: "requested", policy: "coach" },
      { id: "member-w3-tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
      { id: "member-w3-fri-2050", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규", status: "occupied" },
      { id: "member-w3-sat-2020", day: "토", time: "20:20", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    ],
  },
];

refreshMemberScheduleWeekLabels();

const notices = [];

const defaultProducts = [
  { id: "fixed-20-w1", group: "고정 수업권", title: "평일 개인 20분 주1회 4회", detail: "20분 레슨 + 20분 개인연습 · 주1회 고정시간", listAmount: 165000, amount: 150000, settlementBase: 150000, tickets: 4, cardAmount: 165000, cashAmount: 150000, validityDays: 35, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 20분 주1회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주1회" },
  { id: "fixed-30-w1", group: "고정 수업권", title: "평일 개인 30분 주1회 4회", detail: "30분 레슨 + 30분 개인연습 · 주1회 고정시간", listAmount: 198000, amount: 180000, settlementBase: 180000, tickets: 4, cardAmount: 198000, cashAmount: 180000, validityDays: 35, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 30분 주1회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주1회" },
  { id: "fixed-20", group: "고정 수업권", title: "평일 개인 20분 주2회 10회", detail: "20분 레슨 + 20분 개인연습 · 주2회 고정시간", listAmount: 358000, amount: 325000, settlementBase: 325000, tickets: 10, cardAmount: 358000, cashAmount: 325000, validityDays: 30, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 20분 주2회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주2회" },
  { id: "fixed-30", group: "고정 수업권", title: "평일 개인 30분 주2회 10회", detail: "30분 레슨 + 30분 개인연습 · 주2회 고정시간", listAmount: 427000, amount: 388000, settlementBase: 388000, tickets: 10, cardAmount: 427000, cashAmount: 388000, validityDays: 30, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 30분 주2회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주2회" },
  { id: "coupon-20", group: "쿠폰제", title: "20분 쿠폰제", detail: "고정시간 없이 가능한 시간마다 예약 · 선택 코치 전용", listAmount: 200000, amount: 180000, settlementBase: 180000, tickets: 4, cardAmount: 200000, cashAmount: 180000, validityDays: 60, graceDays: 7, productKind: "pass", coachDiscountAllowed: true, coach: "선택 코치 전용", flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감", mode: "coupon", discount: "코치 할인권 사용 가능", badge: "유동 예약", rule: "고정 시간이 없는 쿠폰제이며 선택 코치 근무시간 안에서 예약합니다." },
  { id: "coupon-30", group: "쿠폰제", title: "30분 쿠폰제", detail: "매번 원하는 시간에 예약하는 쿠폰제 · 선택 코치 전용", listAmount: 220000, amount: 198000, settlementBase: 198000, tickets: 4, cardAmount: 220000, cashAmount: 198000, validityDays: 60, graceDays: 7, productKind: "pass", coachDiscountAllowed: true, coach: "선택 코치 전용", flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감", mode: "coupon", discount: "이벤트 할인 가능", badge: "유동 예약", rule: "고정 시간이 없는 쿠폰제이며 선택 코치 근무시간 안에서 예약합니다." },
  { id: "group-20", group: "그룹 수업권", title: "평일 2대1 20분 8회", detail: "동반 회원 2명이 같은 시간에 함께 쓰는 그룹 수업권", listAmount: 198000, amount: 180000, settlementBase: 180000, tickets: 8, cardAmount: 198000, cashAmount: 180000, validityDays: 60, graceDays: 7, coach: "선택 코치 전용", flow: "그룹: 대표 회원 선택 → 동반 회원 연결 → 같은 시간 확정", mode: "group", discount: "파트너 변경은 관리자 확인 필요", badge: "2대1" },
  { id: "renewal", group: "재등록", title: "기존 시간 재등록", detail: "잔여 2회 이하부터 결제 안내 · 결제 전까지 기존 시간 보호", listAmount: 0, amount: 0, settlementBase: 0, tickets: 0, coach: "현재 담당 코치", flow: "재등록: 기존 시간 유지 → 회원권 연장 → 결제 확인", mode: "renewal", discount: "만료 후 미결제면 다음 주차부터 시간 오픈", badge: "연장" },
  { id: "extra-coach", group: "추가/변경", title: "새 코치 회원권 추가", detail: "다른 코치에게 배우려면 코치별 회원권을 별도 구매", listAmount: 0, amount: 0, settlementBase: 0, tickets: 0, coach: "새 코치 선택", flow: "추가: 새 시간 선택 → 새 코치권 결제 → 별도 횟수 관리", mode: "add", discount: "중간 코치 변경은 관리자 승인 후 잔여횟수 이전", badge: "코치별 관리" },
];

defaultProducts
  .filter((product) => ["coupon-20", "coupon-30"].includes(product.id))
  .forEach((product) => {
    product.status = "hidden";
    product.rule = "기존 4회 쿠폰은 신규 판매에서 제외합니다.";
  });

const legacyGroupProduct = defaultProducts.find((product) => product.id === "group-20");
if (legacyGroupProduct) {
  legacyGroupProduct.status = "hidden";
  legacyGroupProduct.rule = "기존 8회 그룹권은 과거 이용 내역에서만 유지합니다.";
}

defaultProducts.push(
  ...[20, 30].flatMap((lessonMinutes) => [1, 2].flatMap((groupSize) => [5, 10].map((sessions) =>
    memberCouponPolicyTemplate({
      id: `coupon-${lessonMinutes}-${groupSize}to1-${sessions}`,
      lessonMinutes,
      groupSize,
      sessions,
    })))),
);

const finalizedMemberProducts = window.TennisNoteProductCatalog?.createCatalog?.() || [];
if (finalizedMemberProducts.length) {
  const consultProducts = defaultProducts.filter((product) => ["renewal", "add"].includes(product.mode));
  defaultProducts.splice(0, defaultProducts.length, ...finalizedMemberProducts, ...consultProducts);
}

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

const curriculumCatalog = window.TennisNoteCurriculumCatalog || {
  sources: {},
  levels: [],
  tracks: [],
  fundamentals: [],
  steps: legacyCurriculumSteps,
  aliases: {},
};
const curriculumSteps = curriculumCatalog.steps?.length ? curriculumCatalog.steps : legacyCurriculumSteps;
const curriculumSkillTracks = curriculumCatalog.tracks?.length
  ? [
      {
        id: "FOUNDATION",
        title: "기초 움직임과 서브",
        category: "기초",
        summary: "모든 기술의 바탕이 되는 풋워크와 실외 서브 기초입니다.",
        currentLevel: "입문",
        progress: `0/${curriculumCatalog.fundamentals.length}`,
        activeStepId: "",
        notionUrl: curriculumCatalog.sources?.skillGuide || curriculumCatalog.sources?.detailedGuide,
        steps: curriculumCatalog.fundamentals.map((step) => ({
          ...step,
          goal: step.focus,
          practice: step.mission,
          completion: step.checklist,
        })),
      },
      ...curriculumCatalog.tracks.map((track) => ({
        ...track,
        currentLevel: track.lessons[0]?.level || "입문",
        progress: `0/${track.lessons.length}`,
        activeStepId: "",
        steps: track.lessons.map((step) => ({
          ...step,
          goal: step.focus,
          practice: step.mission,
          completion: step.checklist,
        })),
      })),
    ]
  : legacyCurriculumSkillTracks;

let coachModeNavigationStarted = false;

const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";

function pushPaymentRequestToShared(request) {
  const shared = loadSharedData();
  const paymentId = request.paymentId || `local_${Date.now()}_${request.productId}`;
  const nextRequest = {
    ...request,
    paymentId,
    member: state.profile.name,
    phone: state.profile.phone,
    requestedAt: new Date().toISOString(),
    source: "member-app",
  };
  shared.paymentRequests = [
    nextRequest,
    ...(shared.paymentRequests || []).filter((item) => item.paymentId !== paymentId),
  ].slice(0, 30);
  saveSharedData(shared);
}

function latestCurriculumLog() {
  return state.lessonLogs.find((log) => log.nextCurriculumId || log.curriculum?.id) || state.lessonLogs[0] || null;
}

function syncConfirmationsFromCoach() {
  const shared = loadSharedData();
  state.lessonLogs.forEach((log) => {
    const sharedLog = shared.lessonLogs.find((item) => item.id === log.id);
    if (!sharedLog) return;
    const wasConfirmed = log.status === "confirmed";
    log.status = sharedLog.status;
    log.coachComment = sharedLog.coachComment || log.coachComment || "";
    log.nextCurriculumId = sharedLog.nextCurriculumId || log.nextCurriculumId || log.curriculum?.id;
    log.curriculum = curriculumById(log.nextCurriculumId, log.curriculum);
    log.memberVisibleSummary = sharedLog.memberVisibleSummary || log.memberVisibleSummary || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    if (!wasConfirmed && log.status === "confirmed" && !log.ticketDeducted && state.remaining > 0) {
      state.remaining -= 1;
      log.ticketDeducted = true;
      state.ticketHistory.unshift({ text: `${lessonReviewTitle(log)} · 1회 차감`, tone: "done" });
      if (state.remaining === 2) {
        state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
      }
    }
  });
}

function syncPracticeFeedbackFromCoach() {
  const shared = loadSharedData();
  state.practiceLogs.forEach((log) => {
    const sharedRequest = shared.feedbackRequests.find((item) => item.id === log.id);
    if (!sharedRequest) return;
    log.feedbackStatus = sharedRequest.status;
    log.coachFeedback = sharedRequest.coachFeedback || log.coachFeedback || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
  });
}

function ensureDemoPresentation() {
  if (state.demoPresentationVersion === 6) return;
  state.demoPresentationVersion = 6;
  state.remaining = 6;
  state.lessonLogs = [
    {
      id: "demo-log-1",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 4,
      content: "포핸드 연결, 짧은 공 전진 스텝",
      selfMemo: "타점이 늦어질 때 준비가 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "BH-R1",
      coachComment: "준비 자세는 좋아졌고, 전진할 때 라켓면만 더 고정하면 됩니다.",
      memberVisibleSummary: "다음 수업: 백핸드 리턴 준비",
      ticketDeducted: true,
      mediaNames: ["포핸드-레슨영상.mp4"],
      submittedAt: "2026-07-01T10:00:00.000Z",
      journalDate: "2026-07-01",
    },
    {
      id: "demo-log-2",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 5,
      content: "백핸드 리턴 타이밍",
      selfMemo: "스플릿 스텝 후 어깨 회전이 늦었습니다.",
      status: "coach_pending",
      curriculum: curriculumSteps[1],
      nextCurriculumId: "BH-R1",
      coachComment: "",
      memberVisibleSummary: "",
      ticketDeducted: false,
      mediaNames: ["백핸드-리턴.jpg"],
      submittedAt: "2026-07-03T10:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "demo-log-3",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 3,
      content: "포핸드 크로스 코스와 회복 스텝",
      selfMemo: "크로스 방향은 좋아졌지만 회복이 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[2],
      nextCurriculumId: "FH-C01",
      coachComment: "방향은 안정됐고, 타구 후 첫 발 회복만 더 빠르게 가져가면 됩니다.",
      memberVisibleSummary: "다음 수업: 포핸드 크로스 반복",
      ticketDeducted: true,
      mediaNames: ["포핸드-크로스.jpg"],
      submittedAt: "2026-06-28T10:00:00.000Z",
      journalDate: "2026-06-28",
    },
    {
      id: "demo-log-4",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 2,
      content: "풋워크 입문, 스플릿 스텝",
      selfMemo: "공을 기다릴 때 발이 멈추는 습관이 있었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[3],
      nextCurriculumId: "ST-01",
      coachComment: "공이 오기 전 작게 뛰는 리듬은 좋아졌습니다.",
      memberVisibleSummary: "다음 수업: 첫 발 반응",
      ticketDeducted: true,
      mediaNames: ["풋워크-스플릿.mp4"],
      submittedAt: "2026-06-25T10:00:00.000Z",
      journalDate: "2026-06-25",
    },
    {
      id: "demo-log-5",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 1,
      content: "기본 준비 자세와 포핸드 제자리 컨트롤",
      selfMemo: "라켓면을 오래 유지하는 게 어려웠습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "FH-01",
      coachComment: "손목을 쓰기보다 어깨 회전으로 보내는 감각을 유지하세요.",
      memberVisibleSummary: "다음 수업: 포핸드 연결",
      ticketDeducted: true,
      mediaNames: ["기본자세-demo.jpg"],
      submittedAt: "2026-06-21T10:00:00.000Z",
      journalDate: "2026-06-21",
    },
    {
      id: "demo-log-6",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 0,
      content: "체험 레슨, 레벨 체크와 목표 설정",
      selfMemo: "랠리가 길어질수록 자세가 무너졌습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "GM-01",
      coachComment: "기본기는 충분히 시작 가능하고, 포핸드 안정화부터 진행하면 좋겠습니다.",
      memberVisibleSummary: "다음 수업: 등록 후 포핸드 기본",
      ticketDeducted: true,
      mediaNames: ["체험레슨-demo.jpg"],
      submittedAt: "2026-06-18T10:00:00.000Z",
      journalDate: "2026-06-18",
    },
  ];
  state.practiceLogs = [
    {
      id: "practice-demo-1",
      date: "2026. 7. 2.",
      type: "레슨복습",
      memo: "포핸드 전진 스텝 30분, 짧은 공 접근 연습",
      next: "라켓면 고정 후 크로스 방향으로 보내기",
      mediaNames: ["포핸드-전진스텝.mp4"],
      feedbackQuestion: "전진할 때 타점이 늦는지 봐주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고, 마지막 스텝만 조금 늦습니다.",
      submittedAt: "2026-07-02T11:00:00.000Z",
      journalDate: "2026-07-02",
    },
    {
      id: "practice-demo-2",
      date: "2026. 7. 3.",
      type: "랠리 및 게임",
      memo: "친구와 랠리 40분, 백핸드 리턴 타이밍 확인",
      next: "리턴 후 첫 발 회복 연습",
      mediaNames: ["랠리-백핸드.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-07-03T12:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "practice-demo-3",
      date: "2026. 6. 30.",
      type: "개인연습",
      memo: "포핸드 크로스 20분, 준비 자세 반복",
      next: "타구 후 회복 스텝",
      mediaNames: ["포핸드-크로스-복습.mp4"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-30T12:00:00.000Z",
      journalDate: "2026-06-30",
    },
    {
      id: "practice-demo-4",
      date: "2026. 6. 27.",
      type: "랠리 및 게임",
      memo: "친구와 랠리, 짧은 공 접근 연습",
      next: "짧은 공에서 라켓면 고정",
      mediaNames: ["짧은공-접근.jpg"],
      feedbackQuestion: "앞으로 들어갈 때 스윙이 커지는지 확인해주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고 마지막 스텝을 더 작게 가져가면 안정됩니다.",
      submittedAt: "2026-06-27T12:00:00.000Z",
      journalDate: "2026-06-27",
    },
    {
      id: "practice-demo-5",
      date: "2026. 6. 23.",
      type: "개인연습",
      memo: "백핸드 준비 자세와 어깨 회전 연습",
      next: "스플릿 스텝 후 어깨 먼저 돌리기",
      mediaNames: ["백핸드-준비자세.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-23T12:00:00.000Z",
      journalDate: "2026-06-23",
    },
    {
      id: "practice-demo-6",
      date: "2026. 6. 19.",
      type: "기타",
      memo: "서브 토스 위치 확인과 루틴 연습",
      next: "토스 높이 일정하게 맞추기",
      mediaNames: ["서브-토스.jpg"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-19T12:00:00.000Z",
      journalDate: "2026-06-19",
    },
  ];
  state.ticketHistory = [
    { text: "7/3 수업기록 제출 · 피드백 대기", tone: "wait" },
    { text: "7/1 4회차 수업 완료 · 1회 차감", tone: "done" },
    { text: "잔여 6회 · 정상 이용중", tone: "done" },
  ];
  if (!state.makeupRequests.length) {
    state.makeupRequests = [
      {
        absence: "수 20:00 기존 수업",
        makeup: "금 19:00 수업 변경 희망 · 강 코치",
        reason: "회사 일정",
        policy: "24시간 이전 요청이라 자동 변경됩니다.",
        status: "자동 변경 완료",
      },
    ];
  }
}

function currentMemberName() {
  return normalizeMemberName(state.member?.name || state.profile?.name || "");
}

function ensureScheduleBaseline() {
  if (state.dataMode === "live") return;
  const baseline = [
    { id: "mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "mon-1900", day: "월", time: "19:00", coach: "강 코치", member: "최유나&이하린", type: "정규", status: "occupied" },
    { id: "mon-1900-no", day: "월", time: "19:00", coach: "노 코치", member: "윤서준", type: "정규", status: "occupied" },
    { id: "tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "fri-1900", day: "금", time: "19:00", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "sat-2020", day: "토", time: "20:20", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "thu-2020", day: "목", time: "20:20", coach: "강 코치", member: "박민재", type: "정규", status: "occupied" },
    { id: "fri-2050", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규", status: "occupied" },
    { id: "sat-1840", day: "토", time: "18:40", coach: "황 코치", member: "임현우", type: "정규", status: "occupied" },
  ];
  baseline.forEach((item) => {
    const existing = lessons.find((lesson) => lesson.id === item.id);
    if (existing) {
      if (existing.type.includes("보강") || existing.type.includes("변경")) existing.type = "수업 변경 가능";
      existing.policy = existing.policy || item.policy;
      if (!existing.status && existing.member && !isCurrentMemberName(existing.member)) existing.status = "occupied";
      return;
    }
    lessons.push(item);
  });
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

let deferredPwaInstallPrompt = null;

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function promptPwaInstall() {
  if (!deferredPwaInstallPrompt) return;
  deferredPwaInstallPrompt.prompt();
  await deferredPwaInstallPrompt.userChoice.catch(() => null);
  deferredPwaInstallPrompt = null;
  updatePwaInstallButtons();
}

function registerPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPwaInstallPrompt = event;
    updatePwaInstallButtons();
  });
  window.addEventListener("appinstalled", () => {
    deferredPwaInstallPrompt = null;
    updatePwaInstallButtons();
  });
  updatePwaInstallButtons();
}

function registerPwaServiceWorker() {
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.371",
    remoteAppUrl: "https://tennisnote-app.pages.dev/",
  });
}

let pushListenersReady = false;
let pushProfileId = "";
let pushPrimerTimer = null;
let pushPrimerAttempts = 0;

function nativePushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function nativeAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

let bankNotificationBridgePluginCache = null;
let bankNotificationBridgeState = null;

function bankNotificationAdminAllowed() {
  return nativeAppPlatform() === "android"
    && ["admin", "owner", "manager"].includes(String(state.member?.role || ""));
}

function nativeBankNotificationBridgePlugin() {
  if (nativeAppPlatform() !== "android") return null;
  if (bankNotificationBridgePluginCache) return bankNotificationBridgePluginCache;
  bankNotificationBridgePluginCache = window.Capacitor?.Plugins?.BankNotificationBridge
    || window.Capacitor?.registerPlugin?.("BankNotificationBridge")
    || null;
  return bankNotificationBridgePluginCache;
}

async function refreshBankNotificationBridge() {
  if (!bankNotificationAdminAllowed()) {
    bankNotificationBridgeState = null;
    renderBankNotificationBridge();
    return false;
  }
  const plugin = nativeBankNotificationBridgePlugin();
  if (!plugin?.getStatus) {
    bankNotificationBridgeState = { configured: false, permissionGranted: false, lastError: "plugin_unavailable" };
    renderBankNotificationBridge();
    return false;
  }
  try {
    bankNotificationBridgeState = await plugin.getStatus();
  } catch (error) {
    bankNotificationBridgeState = { configured: false, permissionGranted: false, lastError: error?.message || "status_failed" };
  }
  renderBankNotificationBridge();
  return bankNotificationBridgeState?.configured === true;
}

let memberNativeAppInfo = null;

async function refreshMemberRuntimeDiagnostics() {
  const platform = nativeAppPlatform();
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (platform !== "web" && appPlugin?.getInfo) {
    try {
      const info = await appPlugin.getInfo();
      memberNativeAppInfo = {
        platform,
        version: String(info?.version || ""),
        build: String(info?.build || ""),
      };
    } catch {
      memberNativeAppInfo = { platform, version: "", build: "" };
    }
  }
  renderMemberRuntimeDiagnostics();
}

let nativeBackListenerReady = false;

function blurActiveFormControl() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches("input, textarea, select")) return false;
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const keyboardVisible = Boolean(viewport && layoutHeight - viewport.height - viewport.offsetTop > 96);
  active.blur();
  return keyboardVisible;
}

async function installNativeBackNavigation() {
  if (nativeBackListenerReady || nativeAppPlatform() !== "android") return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  nativeBackListenerReady = true;
  await appPlugin.addListener("backButton", async () => {
    if (blurActiveFormControl()) return;
    if (!$("#noticeDialog")?.hidden) {
      closeNotice(false);
      return;
    }
    if (closeVisibleAppModal()) return;
    if (closeVisibleAppSheet(false, { immediate: true })) return;
    if (!$("#kakaoInquiryModal")?.hidden) {
      closeKakaoInquiryModal();
      return;
    }
    if (!$("#memberEnrollmentModal")?.hidden) {
      closeMemberEnrollmentModal();
      return;
    }
    if (!$("#appScreen")?.hidden && activeMemberViewId() !== "homeView") {
      setView("homeView", { replaceHistory: true });
      return;
    }
    const minimized = await appPlugin.minimizeApp?.().then(() => true).catch(() => false);
    if (!minimized) await appPlugin.exitApp?.().catch(() => undefined);
  });
}

function setPushNotificationState(permission, status, detail) {
  state.pushNotifications = { permission, status, detail };
  renderPushNotificationSettings();
  saveSnapshot();
}

function canShowNativePushPrimer() {
  const platform = nativeAppPlatform();
  return ["android", "ios"].includes(platform)
    && !$("#appScreen")?.hidden
    && Boolean(state.member?.profileId)
    && pushPreferenceEnabled()
    && state.pushNotifications?.permission === "prompt"
    && !pushPrimerWasRecentlyDeferred()
    && !activeAppModalId
    && !activeAppSheetId
    && $("#noticeDialog")?.hidden !== false
    && $("#kakaoInquiryModal")?.hidden !== false
    && $("#memberEnrollmentModal")?.hidden !== false;
}

function scheduleNativePushPrimer(delay = 1400) {
  if (pushPrimerTimer || pushPrimerWasRecentlyDeferred()) return;
  pushPrimerTimer = window.setTimeout(() => {
    pushPrimerTimer = null;
    if (canShowNativePushPrimer()) {
      pushPrimerAttempts = 0;
      openAppModal("pushPrimerModal", "#enablePushFromPrimer");
      return;
    }
    if (state.pushNotifications?.permission === "prompt" && pushPrimerAttempts < 4) {
      pushPrimerAttempts += 1;
      scheduleNativePushPrimer(3000);
    }
  }, delay);
}

function memberNotificationLesson(data = {}) {
  const lessonId = String(data.lessonId || data.lesson_id || "").trim();
  if (!lessonId) return null;
  return memberScheduleOptions().find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || (state.liveLessons || []).find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || null;
}

async function bindNativePushListeners(plugin) {
  if (pushListenersReady) return;
  await plugin.addListener("registration", async (token) => {
    try {
      await registerPushToken(token?.value || "", nativeAppPlatform());
    } catch {
      setPushNotificationState("granted", "알림 연결 확인 필요", "앱 로그인과 서버 설정을 확인한 뒤 다시 연결해 주세요.");
    }
  });
  await plugin.addListener("registrationError", () => {
    setPushNotificationState("unknown", "알림 등록 실패", "휴대폰 알림 설정과 네트워크를 확인한 뒤 다시 시도해 주세요.");
  });
  await plugin.addListener("pushNotificationReceived", async () => {
    await syncMemberNotificationsFromServer().catch(() => false);
    showNoticeIfNeeded();
  });
  await plugin.addListener("pushNotificationActionPerformed", async (action) => {
    const data = nativeNotificationData(action);
    if (!(await authorizeMemberNotificationAction(data))) return;
    const route = memberNotificationRoute(data);
    const viewId = route === "membership"
      ? "shopView"
      : route === "schedule"
        ? "scheduleView"
        : ["feedback", "journal"].includes(route)
          ? "lessonLogView"
          : "homeView";
    await Promise.allSettled([
      syncMemberNotificationsFromServer(),
      ["schedule", "feedback", "journal"].includes(route) ? syncMemberLessonsFromServer() : Promise.resolve(false),
      route === "membership" ? syncMemberTicketsFromServer() : Promise.resolve(false),
      ["feedback", "journal"].includes(route) ? syncMemberJournalEntriesFromServer() : Promise.resolve(false),
    ]);
    renderAll();
    setView(viewId);
    openMemberNotificationTarget(data, route);
  });
  pushListenersReady = true;
}

function adminMemberScheduleLessons() {
  const snapshot = readAdminSnapshot();
  if (!snapshot || !Array.isArray(snapshot.lessons)) return [];
  return snapshot.lessons
    .map((lesson) => normalizeAdminLessonForMember(lesson, snapshot))
    .filter(Boolean);
}

function memberScheduleLaneOrder(coach = {}) {
  const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
  const workspaceCoaches = memberScheduleV2WorkspaceCache?.workspace?.coaches || [];
  const index = workspaceCoaches.findIndex((item) => String(item.roleId || "") === roleId);
  const serverCoach = index >= 0 ? workspaceCoaches[index] : null;
  if (Number.isFinite(Number(serverCoach?.laneOrder)) && Number(serverCoach.laneOrder) !== 1000) {
    return Number(serverCoach.laneOrder);
  }
  if (index >= 0) return 1000 + index;
  return Number(coach.laneOrder ?? coach.scheduleLaneOrder ?? memberCoachOrder(coach.id));
}

function memberScheduleCoachTickets() {
  const visibleStates = new Set(["current", "upcoming", "paused"]);
  return (state.liveTickets || []).filter((ticket) => {
    const derived = window.TennisNoteTicketState?.derive?.(ticket)
      || String(ticket.status || "").toLowerCase();
    return visibleStates.has(derived) && String(ticket.coachRoleId || "").trim();
  });
}

function memberDayCoaches(day, policy, scheduleLessons = []) {
  const working = policy.coaches.filter((coach) => (
    memberCoachMatchesAssignment(coach)
    && (coach.workBlocks || []).some((block) => block.days.includes(day))
  ));
  const lessonCoaches = scheduleLessons
    .filter((lesson) => (
      lesson.day === day
      && lesson.status !== "available"
      && isOwnMemberScheduleLesson(lesson)
    ))
    .map((lesson) => memberLessonCoach(lesson, policy));
  const unique = working
    .concat(lessonCoaches)
    .filter((coach) => memberCoachMatchesAssignment(coach))
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index)
    .map((coach) => ({ ...coach, laneOrder: memberScheduleLaneOrder(coach) }));
  return window.TennisNoteScheduleLanes?.sortByLaneOrder?.(unique)
    || unique.sort((a, b) => Number(a.laneOrder) - Number(b.laneOrder));
}

function activeTicketScheduleScope() {
  const ticket = currentLiveTicket();
  if (ticket?.scheduleScope) return ticket.scheduleScope;
  const title = `${ticket?.title || state.profile?.ticket || ""}`;
  return title.includes("주말") ? "weekend" : "weekday";
}

function sourceLessonScheduleScope(sourceLesson = {}) {
  const ticketId = sourceLesson.member_ticket_id || sourceLesson.ticketId || "";
  const ticket = (state.liveTickets || []).find((item) => item.id === ticketId);
  return ticket?.scheduleScope || activeTicketScheduleScope();
}

function memberOpenMakeupEntitlements() {
  return (state.liveMakeupEntitlements || []).filter((item) => item.status === "open");
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

function memberCandidateEmptyReason(source = null) {
  if (!source?.couponBooking) {
    return "담당 코치, 운영시간, 회원권 규칙에 맞는 빈 시간이 없습니다.";
  }
  const period = memberCouponPeriodInfo(source);
  const week = activeMemberWeek();
  const exclusions = state.serverChangeCandidateExclusions || {};
  if (period?.startsOn && week.endDate < period.startsOn) {
    return `이 회원권은 ${memberReadableDate(period.startsOn)}부터 사용할 수 있습니다.`;
  }
  if (period?.expiresOn && week.startDate > period.expiresOn) {
    return `이 회원권은 ${memberReadableDate(period.expiresOn)}에 만료되어 선택한 주에는 예약할 수 없습니다.`;
  }
  if (period?.expiresOn && Number(exclusions.ticket_period) > 0) {
    const mismatch = period.isShorterThanProduct
      ? ` 상품 기본 ${period.expectedDays}일보다 짧게 등록되어 관리자 확인이 필요합니다.`
      : "";
    return `회원권은 ${memberReadableDate(period.expiresOn)}까지입니다. 이용기간 안에 담당 코치의 예약 가능한 시간이 없습니다.${mismatch}`;
  }
  if (Number(exclusions.occupied) > 0) {
    return "이용기간 안의 담당 코치 시간이 이미 예약되었습니다. 다른 주를 확인해 주세요.";
  }
  return "이용기간 안에 담당 코치의 예약 가능한 시간이 없습니다.";
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
        status: "paused_resume_booking",
        lessonSource: "regular",
        durationMinutes: Number(ticket.lessonMinutes) || 20,
        isOwnLesson: true,
      };
    });
}

function memberReleasedMakeupSlot(lessonDate, time, coachRoleId, durationMinutes) {
  return (state.liveReleasedMakeupSlots || []).find((slot) => (
    slot.lessonDate === lessonDate
    && slot.time === time
    && slot.coachRoleId === coachRoleId
    && Number(slot.durationMinutes) === Number(durationMinutes)
  ));
}

function memberScheduleOptions() {
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedId = state.selectedMemberChangeSourceId || $("#absenceLesson")?.value;
  const sourceLessons = memberMakeupDueLessons().concat(
    scheduleLessons.filter((lesson) => isOwnMemberScheduleLesson(lesson) && lesson.status === "scheduled"),
    loadedFutureScheduledLessonsForChange(),
    memberBookableCouponTickets(),
    memberBookableRegularTickets(),
    memberBookablePausedTickets(),
  );
  const selectedLesson = sourceLessons.find((lesson) => lesson.id === selectedId) || null;
  const candidateState = memberChangeCandidateLoadState(selectedLesson);
  const generated = memberHasPendingPaymentOnly()
    ? []
    : candidateState === "ready"
      ? state.serverChangeCandidates.filter(memberChangeCandidateInActiveWeek)
      : ["loading", "error"].includes(candidateState)
        ? []
        : memberChangeUsesServerCandidates(selectedLesson) && candidateState !== "fallback"
          ? []
          : generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson);
  const assignedCoachIds = memberAssignedCoachRoleIds();
  const initialCoachSelection = Boolean(selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId);
  const visibleGenerated = generated.filter((lesson) => {
    if (lesson.status !== "available") return true;
    const roleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
    return Boolean(roleId) && (initialCoachSelection || assignedCoachIds.has(roleId));
  });
  return scheduleLessons.concat(visibleGenerated);
}

function memberHasActiveLiveTicket() {
  return (state.liveTickets || []).some((ticket) =>
    String(ticket.status || "").toLowerCase() === "active" && Number(ticket.remaining) > 0);
}

function memberHasPendingPaymentOnly() {
  const hasPendingTicket = (state.liveTickets || []).some((ticket) =>
    String(ticket?.status || "").toLowerCase() === "pending_payment");
  return state.dataMode === "live"
    && hasPendingTicket
    && !memberHasActiveLiveTicket()
    && memberOpenMakeupEntitlements().length === 0;
}

function memberAvailableSlotsForSelectedLesson() {
  const selectedId = state.selectedMemberChangeSourceId || $("#absenceLesson")?.value;
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedLesson = scheduleLessons.find((lesson) => lesson.id === selectedId) || currentScheduledLessonsForChange().find((lesson) => lesson.id === selectedId);
  const candidateState = memberChangeCandidateLoadState(selectedLesson);
  const generated = candidateState === "ready"
    ? state.serverChangeCandidates
    : memberChangeUsesServerCandidates(selectedLesson) && candidateState !== "fallback"
      ? []
      : generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson);
  const options = scheduleLessons.concat(generated);
  const selectedCoachId = selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId
    ? ""
    : selectedLesson ? memberLessonCoach(selectedLesson, loadAdminSchedulePolicy()).id : "";
  const assignedCoachIds = memberAssignedCoachRoleIds();
  const initialCoachSelection = Boolean(selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId);
  return options.filter((lesson) => {
    if (lesson.status !== "available") return false;
    const lessonCoachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
    if (!lessonCoachRoleId || (!initialCoachSelection && !assignedCoachIds.has(lessonCoachRoleId))) return false;
    if (!selectedCoachId) return true;
    return memberLessonCoach(lesson, loadAdminSchedulePolicy()).id === selectedCoachId;
  });
}

function memberLessons() {
  const current = memberScheduleLessons().filter((lesson) => isOwnMemberScheduleLesson(lesson) && ["scheduled", "requested"].includes(lesson.status));
  if (current.length || state.liveLessonsLoaded || state.dataMode === "live") return current;
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && ["scheduled", "requested"].includes(lesson.status));
}

function currentScheduledLessonsForChange() {
  const dueLessons = memberMakeupDueLessons();
  const fromSchedule = memberScheduleLessons().filter((lesson) => isOwnMemberScheduleLesson(lesson) && lesson.status === "scheduled");
  const futureLessons = loadedFutureScheduledLessonsForChange();
  const couponTickets = memberBookableCouponTickets();
  const regularTickets = memberBookableRegularTickets();
  const pausedTickets = memberBookablePausedTickets();
  const editingRequest = state.makeupRequests.find((request) => (
    String(request.serverRequestId || request.id || "") === String(state.editingChangeRequestId || "")
    && request.rawStatus === "pending"
  ));
  const editablePendingLesson = editingRequest
    ? memberScheduleLessons().find((lesson) => (
      isOwnMemberScheduleLesson(lesson)
      && String(lesson.serverLessonId || "") === String(editingRequest.lessonId || "")
    ))
    : null;
  const editablePending = editablePendingLesson ? [{ ...editablePendingLesson, status: "scheduled", editingChangeRequest: true }] : [];
  if (dueLessons.length || fromSchedule.length || futureLessons.length || couponTickets.length || regularTickets.length || pausedTickets.length || editablePending.length || state.liveLessonsLoaded || state.dataMode === "live") {
    const seen = new Set();
    return editablePending.concat(dueLessons, fromSchedule, futureLessons, couponTickets, regularTickets, pausedTickets).filter((lesson) => {
      const key = String(lesson.id || lesson.serverLessonId || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
}

function loadedFutureScheduledLessonsForChange(today = localDateKey()) {
  return (state.liveLessons || [])
    .filter((lesson) => (
      isOwnMemberScheduleLesson(lesson)
      && lesson.status === "scheduled"
      && lesson.lessonDate
      && lesson.lessonDate >= today
    ))
    .sort((a, b) => `${a.lessonDate} ${a.time || ""}`.localeCompare(`${b.lessonDate} ${b.time || ""}`));
}

function activeMemberWeek() {
  const offset = Math.min(
    Math.max(Number(state.activeMemberWeekIndex) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  state.activeMemberWeekIndex = offset;
  return memberScheduleWeekForOffset(offset);
}

function memberScheduleLessons() {
  const liveLessons = (state.liveLessons || []).filter((lesson) => {
    const week = activeMemberWeek();
    if (!lesson.lessonDate || !week.startDate || !week.endDate) return true;
    return lesson.lessonDate >= week.startDate && lesson.lessonDate <= week.endDate;
  });
  if (state.dataMode === "live" || state.liveLessonsLoaded || liveLessons.length || state.liveLessons?.length) return liveLessons;
  const adminLessons = adminMemberScheduleLessons();
  if (state.activeMemberWeekIndex === 0 && adminLessons.length) {
    return adminLessons.map((adminLesson) => lessons.find((stored) => stored.id === adminLesson.id) || adminLesson);
  }
  const weekLessons = activeMemberWeek().lessons || [];
  if (!weekLessons.length && state.activeMemberWeekIndex !== 0) return [];
  const storedWeekIds = new Set(weekLessons.map((lesson) => lesson.id));
  const mergedWeekLessons = weekLessons.map((lesson) => lessons.find((stored) => stored.id === lesson.id) || lesson);
  return lessons.filter((lesson) => !storedWeekIds.has(lesson.id)).concat(mergedWeekLessons);
}

function ensureMemberScheduleLesson(lessonId) {
  let lesson = lessons.find((item) => item.id === lessonId);
  if (lesson) return lesson;
  const weekLesson = memberMakeupDueLessons().find((item) => item.id === lessonId)
    || currentScheduledLessonsForChange().find((item) => item.id === lessonId)
    || memberScheduleOptions().find((item) => item.id === lessonId);
  if (!weekLesson) return null;
  lesson = { ...weekLesson };
  lessons.push(lesson);
  return lesson;
}

function upcomingMemberLessons(limit = 2, ticketId = "") {
  if (state.dataMode === "live" || state.liveLessonsLoaded) {
    const today = localDateKey();
    const now = new Date();
    return (state.liveLessons || [])
      .filter((lesson) => {
        const isMine = isOwnMemberScheduleLesson(lesson);
        return isMine
          && lesson.status === "scheduled"
          && lesson.lessonDate
          && lesson.lessonDate >= today
          && memberLessonPriority(lesson, now).group < 2
          && (!ticketId || memberLessonTicketId(lesson) === String(ticketId));
      })
      .sort((left, right) => compareMemberLessonsByNearest(left, right, now))
      .slice(0, limit);
  }
  const dayOrder = new Map(days.map((day, index) => [day, index]));
  return memberLessons()
    .filter((lesson) => lesson.status === "scheduled")
    .sort((a, b) => {
      const dayDiff = (dayOrder.get(a.day) ?? 99) - (dayOrder.get(b.day) ?? 99);
      return dayDiff || minutesFromTime(a.time) - minutesFromTime(b.time);
    })
    .slice(0, limit);
}

function memberScheduleTicketOptions() {
  const byId = new Map();
  [...currentLiveTickets(), ...upcomingLiveTickets()].forEach((ticket) => {
    if (ticket?.id) byId.set(String(ticket.id), ticket);
  });
  (state.liveLessons || []).filter(isOwnMemberScheduleLesson).forEach((lesson) => {
    const ticketId = memberLessonTicketId(lesson);
    const ticket = (state.liveTickets || []).find((item) => String(item.id) === ticketId);
    if (ticketId && ticket) byId.set(ticketId, ticket);
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

function memberApprovedChangeForLesson(lesson = {}) {
  const lessonId = String(lesson.serverLessonId || lesson.id || "");
  return (state.makeupRequests || []).find((request) => (
    String(request.lessonId || "") === lessonId
    && ["approved", "auto_approved"].includes(request.rawStatus)
    && request.originalDate
    && request.targetDate
  )) || null;
}

function memberHomeUpcomingLessonsMarkup(upcoming = []) {
  if (!upcoming.length) return "";
  const ticketMap = new Map(memberScheduleTicketOptions().map((ticket) => [String(ticket.id), ticket]));
  // The top card already shows the nearest lesson. Only expand this section
  // when the member actually needs to distinguish two or more tickets.
  if (ticketMap.size <= 1) return "";
  const groups = new Map();
  upcoming.forEach((lesson) => {
    const ticketId = memberLessonTicketId(lesson) || "unlinked";
    if (!groups.has(ticketId)) groups.set(ticketId, []);
    groups.get(ticketId).push(lesson);
  });
  return [...groups.entries()].map(([ticketId, ticketLessons]) => {
    const ticket = ticketMap.get(ticketId) || { id: ticketId, title: "회원권" };
    return `
      <section class="home-ticket-lessons">
        <div><strong>${escapeHtml(memberTicketCompactLabel(ticket))}</strong><small>잔여 ${Math.max(0, Number(ticket.remaining) || 0)}회</small></div>
        ${ticketLessons.slice(0, 3).map((lesson) => {
          const change = memberLessonChangeContext(lesson);
          const round = memberScheduleRoundLabel(lesson, true);
          return `
            <button type="button" data-home-change-lesson="${escapeHtml(lesson.id)}" data-home-ticket-id="${escapeHtml(ticketId)}">
              <span>${escapeHtml(round || "예정")}</span>
              <strong>${escapeHtml(lessonDateTimeLabel(lesson))}</strong>
              ${change
                ? `<small class="home-lesson-change"><b>시간 변경</b><i>${escapeHtml(change.original)} → ${escapeHtml(change.current)}</i></small>`
                : `<small>${escapeHtml(memberCoachShortName(lesson.coach || "담당 코치"))}</small>`}
            </button>`;
        }).join("")}
        <div class="home-ticket-lesson-actions">
          <button type="button" data-home-ticket-schedule="${escapeHtml(ticketId)}">전체 일정</button>
          <button type="button" data-home-ticket-availability="${escapeHtml(ticketId)}">변경·보강</button>
        </div>
      </section>`;
  }).join("");
}

function latestMemberFeedbackLog() {
  return [...state.lessonLogs]
    .filter((log) => log.status === "confirmed" && (log.coachComment || log.memberVisibleSummary || log.ticketDeducted))
    .sort((left, right) => String(right.submittedAt || right.journalDate || "").localeCompare(String(left.submittedAt || left.journalDate || "")))[0] || null;
}

function pendingMemberFeedbackLog() {
  return [...state.lessonLogs]
    .filter((log) => ["coach_pending", "uploading", "server_error"].includes(log.status))
    .sort((left, right) => String(right.submittedAt || right.journalDate || "").localeCompare(String(left.submittedAt || left.journalDate || "")))[0] || null;
}

function lessonReviewTitle(log) {
  const lesson = [...(state.liveLessons || []), ...lessons].find((item) => (
    String(item.id || item.serverLessonId || "") === String(log?.lessonId || log?.serverLessonId || "")
  ));
  const dateValue = log?.journalDate || lesson?.lessonDate || String(log?.submittedAt || "").slice(0, 10);
  const time = lesson?.time || String(log?.lessonLabel || "").match(/(?:[01]\d|2[0-3]):[0-5]\d/)?.[0] || "";
  const dateLabel = compactLessonDateLabel(dateValue, lesson?.day || String(log?.lessonLabel || "").split(" ")[0]);
  if (dateLabel) return `${dateLabel}${time ? ` ${time}` : ""} 피드백`;
  if (Number(log?.round) > 0) return `${Number(log.round)}회차 피드백`;
  return "수업 피드백";
}

function memberScheduleRoundLabel(lesson, isMine) {
  if (!isMine) return "";
  const total = Math.max(0, Number(lesson.ticketTotalSessions) || 0);
  const used = Math.max(0, Number(lesson.ticketUsedSessions) || 0);
  const completed = ["completed", "no_show"].includes(String(lesson.serverStatus || "").toLowerCase());
  const ticketId = memberLessonTicketId(lesson);
  const futureLessons = (state.liveLessons || [])
    .filter((item) => (
      isOwnMemberScheduleLesson(item)
      && item.status === "scheduled"
      && memberLessonTicketId(item) === ticketId
    ))
    .sort((left, right) => `${left.lessonDate || ""}T${left.time || ""}`.localeCompare(`${right.lessonDate || ""}T${right.time || ""}`));
  const futureIndex = futureLessons.findIndex((item) => String(item.id) === String(lesson.id));
  const nextRound = used + Math.max(0, futureIndex) + 1;
  const round = total ? Math.min(total, completed ? Math.max(1, used) : nextRound) : 0;
  return `${round}/${total}회차`;
}

function syncNtrpResultFromCoach() {
  const shared = loadSharedData();
  const request = shared.ntrpRequests.find((item) => isCurrentMemberName(item.member));
  if (!request) return;
  state.profile.ntrpCheckRequested = request.status !== "측정 완료";
  state.profile.selfNtrp = request.selfNtrp || state.profile.selfNtrp;
  state.profile.coachNtrp = request.coachNtrp || state.profile.coachNtrp || "측정 전";
  state.profile.ntrpSurvey = request.surveyAnswers || state.profile.ntrpSurvey || {};
}

function selectedMemberScheduleDay() {
  if (!days.includes(state.selectedScheduleDay)) state.selectedScheduleDay = currentMemberScheduleDay();
  return state.selectedScheduleDay;
}

function memberScheduleOperationDay(day) {
  const date = memberWeekDateForDay(day);
  return (state.scheduleOperationDays || []).find((operation) => operation.date === date) || null;
}

function mergeMemberScheduleWindows(windows) {
  return windows
    .map((window) => ({ ...window, startMinutes: minutesFromTime(window.start), endMinutes: minutesFromTime(window.end) }))
    .filter((window) => window.startMinutes < window.endMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .reduce((merged, window) => {
      const previous = merged.at(-1);
      if (!previous || window.startMinutes > previous.endMinutes) {
        merged.push({ ...window });
      } else {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = `${String(Math.floor(previous.endMinutes / 60)).padStart(2, "0")}:${String(previous.endMinutes % 60).padStart(2, "0")}`;
      }
      return merged;
    }, []);
}

function memberOperatingWindows(day, policy) {
  const merged = mergeMemberScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
  const breaks = (policy.breakRules || [])
    .filter((rule) => rule.days?.includes(day))
    .map((rule) => ({ start: minutesFromTime(rule.start), end: minutesFromTime(rule.end), label: rule.label || "수업 없음" }));
  return merged.flatMap((window) => {
    let pieces = [{ start: window.startMinutes, end: window.endMinutes }];
    breaks.forEach((rule) => {
      pieces = pieces.flatMap((piece) => {
        if (rule.end <= piece.start || rule.start >= piece.end) return [piece];
        return [
          piece.start < rule.start ? { start: piece.start, end: rule.start } : null,
          rule.end < piece.end ? { start: rule.end, end: piece.end } : null,
        ].filter(Boolean);
      });
    });
    return pieces;
  }).map((window) => ({
    start: `${String(Math.floor(window.start / 60)).padStart(2, "0")}:${String(window.start % 60).padStart(2, "0")}`,
    end: `${String(Math.floor(window.end / 60)).padStart(2, "0")}:${String(window.end % 60).padStart(2, "0")}`,
    startMinutes: window.start,
    endMinutes: window.end,
  }));
}

function memberMobileScheduleSegments(day, policy, baseLessons, scheduleLessons = []) {
  const candidateWindows = scheduleLessons
    .filter((lesson) => lesson.day === day && lesson.status === "available")
    .map((lesson) => ({
      start: lesson.time,
      end: timeFromMinutes(minutesFromTime(lesson.time) + Math.max(10, lessonDuration(lesson))),
    }));
  if (state.memberScheduleMode === "availability") {
    const focusWindows = scheduleLessons
      .filter((lesson) => (
        lesson.day === day
        && (lesson.status === "available" || isOwnMemberScheduleLesson(lesson))
      ))
      .map((lesson) => {
        const start = Math.max(0, minutesFromTime(lesson.time) - 20);
        const end = Math.min(24 * 60, minutesFromTime(lesson.time) + lessonDuration(lesson) + 20);
        return { start: timeFromMinutes(start), end: timeFromMinutes(end) };
      });
    const compactWindows = mergeMemberScheduleWindows(focusWindows);
    if (compactWindows.length) return compactWindows;
  }
  const windows = mergeMemberScheduleWindows([
    ...memberOperatingWindows(day, policy),
    ...candidateWindows,
  ]);
  const range = "all";
  if (range === "morning") return windows.filter((window) => window.startMinutes < minutesFromTime("17:00"));
  if (range === "evening") return windows.filter((window) => window.endMinutes > minutesFromTime("17:00"));
  if (range === "all") return windows;
  const focusLesson = baseLessons.find((lesson) => lesson.day === day && isOwnMemberScheduleLesson(lesson))
    || baseLessons.find((lesson) => lesson.day === day && lesson.status === "available");
  const fallbackWindow = windows.length ? (days.indexOf(day) < 5 ? windows.at(-1) : windows[0]) : null;
  const focusMinutes = focusLesson ? minutesFromTime(focusLesson.time) : fallbackWindow?.startMinutes;
  const matching = windows.find((window) => focusMinutes >= window.startMinutes && focusMinutes < window.endMinutes) || fallbackWindow;
  if (!matching) return [];

  const windowMinutes = 90;
  const preferredStart = Math.floor((focusMinutes - 40) / 10) * 10;
  const latestStart = Math.max(matching.startMinutes, matching.endMinutes - windowMinutes);
  const startMinutes = Math.min(Math.max(preferredStart, matching.startMinutes), latestStart);
  const endMinutes = Math.min(matching.endMinutes, startMinutes + windowMinutes);
  const timeText = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return [{
    start: timeText(startMinutes),
    end: timeText(endMinutes),
    startMinutes,
    endMinutes,
  }];
}

function memberBookingSourceTicket(source = {}) {
  const ticketId = memberLessonTicketId(source);
  return (state.liveTickets || []).find((ticket) => String(ticket.id) === String(ticketId)) || null;
}

function memberChangeTimetableIsPending(source = null) {
  if (!memberChangeUsesServerCandidates(source)) return false;
  const loadState = memberChangeCandidateUiState(source);
  return loadState === "loading"
    || loadState === "error"
    || (loadState === "ready" && state.serverChangeCandidates.length === 0);
}

function memberDesktopScheduleBackgroundRuns(policy, day, coach, scheduleTimeList) {
  return scheduleTimeList.reduce((runs, time, timeIndex) => {
    const breakRule = memberBreakRuleForSlot(policy, day, time);
    const isWorking = !breakRule && isMemberCoachWorking(coach, day, time, 10);
    const state = breakRule ? "blocked" : isWorking ? "base" : "off";
    const label = breakRule ? (breakRule.label || "브레이크") : state === "off" ? "근무외" : "";
    const previous = runs.at(-1);
    if (previous && previous.state === state && previous.label === label) {
      previous.span += 1;
      return runs;
    }
    runs.push({ state, label, startIndex: timeIndex, span: 1 });
    return runs;
  }, []);
}

function memberChangeUsesServerCandidates(source = null) {
  const ticketId = source?.member_ticket_id || source?.ticketId || "";
  return Boolean(
    state.dataMode === "live"
    && (source?.serverLessonId || (source?.couponBooking && ticketId))
    && !source?.makeupEntitlementId
    && !source?.regularInitialBooking,
  );
}

function memberChangeCandidateLoadState(source = null) {
  if (!memberChangeUsesServerCandidates(source)) return "fallback";
  const key = memberChangeCandidateKey(source);
  if (state.serverChangeCandidateKey !== key) return "idle";
  return state.serverChangeCandidateStatus || "idle";
}

function syncMakeupRequestsFromCoach() {
  const shared = loadSharedData();
  shared.makeupRequests.forEach((sharedRequest) => {
    const existing = state.makeupRequests.find((request) => request.id === sharedRequest.id);
    if (!existing) return;
    if (sharedRequest.status === "승인 완료") existing.status = "코치 승인 완료";
    else if (sharedRequest.status === "거절") existing.status = "코치 거절";
    else existing.status = sharedRequest.status || existing.status;
  });
}

function filteredMemberCurriculumTracks() {
  const query = String(state.curriculumQuery || "").trim().toLowerCase();
  const filter = state.curriculumFilter || "all";
  return curriculumSkillTracks
    .map((track) => {
      const matchesTrack = !query || `${track.id || ""} ${track.title} ${track.category || ""} ${track.summary || ""}`.toLowerCase().includes(query);
      const steps = track.steps.filter((step) => {
        const matchesFilter = memberCurriculumMatchesFilter(filter, step.category || track.category);
        const text = `${step.id} ${step.title} ${step.level || ""} ${step.focus || ""} ${step.guide || ""}`.toLowerCase();
        return matchesFilter && (matchesTrack || !query || text.includes(query));
      });
      return { ...track, steps };
    })
    .filter((track) => track.steps.length > 0);
}

function curriculumYoutubeVideoId(value = "") {
  try {
    const url = new URL(String(value || "").trim(), window.location.origin);
    const host = url.hostname.replace(/^www\./u, "").toLowerCase();
    let candidate = "";
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      candidate = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/u)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/u.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function playCurriculumVideo(button) {
  const videoId = String(button?.dataset?.playCurriculumVideo || "");
  if (!/^[A-Za-z0-9_-]{11}$/u.test(videoId)) return;
  const item = button.closest(".curriculum-video-item");
  if (!item) return;
  const title = String(button.dataset.curriculumVideoTitle || "커리큘럼 영상");
  const iframe = document.createElement("iframe");
  iframe.className = "curriculum-video-frame";
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  const fallback = document.createElement("a");
  fallback.className = "curriculum-video-fallback";
  fallback.href = `https://www.youtube.com/watch?v=${videoId}`;
  fallback.target = "_blank";
  fallback.rel = "noreferrer";
  fallback.textContent = "YouTube에서 보기";
  item.replaceChildren(iframe, fallback);
}

function memberCurriculumLibraryMarkup(active) {
  const tracks = filteredMemberCurriculumTracks();
  const query = String(state.curriculumQuery || "").trim();
  if (!tracks.length) return "<p class='empty-text curriculum-empty'>조건에 맞는 커리큘럼이 없습니다.</p>";
  return tracks
    .map((track) => {
      const activeIndex = track.steps.findIndex((step) => step.id === active.id);
      const activeInTrack = activeIndex >= 0;
      const progressLabel = activeInTrack ? `${activeIndex + 1}/${track.steps.length}` : `${track.steps.length}단계`;
      return `
        <details class="curriculum-category curriculum-track" ${activeInTrack || query ? "open" : ""}>
          <summary class="curriculum-category-heading">
            <div>
              <strong>${escapeHtml(track.title)}</strong>
            </div>
            <b>${progressLabel}</b>
          </summary>
          <div class="curriculum-track-actions">
            <span>${escapeHtml(track.category || "기초")} · ${track.steps.length}개 단계</span>
          </div>
          <div class="curriculum-step-list">
            ${track.steps
              .map(
                (step) => `
                  <details class="curriculum-step ${step.id === active.id ? "is-current" : ""}">
                    <summary>
                      <span>${escapeHtml(step.stageLabel || step.level || "단계")} · ${escapeHtml(step.id)}</span>
                      <strong>${escapeHtml(step.title)}</strong>
                    </summary>
                    <div class="curriculum-step-details">
                      <p><b>오늘 할 일</b>${escapeHtml(step.goal || step.guide || step.focus || step.title)}</p>
                      ${curriculumThreeStepsMarkup(step)}
                      ${curriculumSupportMarkup(step)}
                      ${step.environmentNote ? `<small class="curriculum-environment-note">${escapeHtml(step.environmentNote)}</small>` : ""}
                      ${curriculumResourceLinks(step)}
                    </div>
                  </details>`,
              )
              .join("")}
          </div>
        </details>`;
    })
    .join("");
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

function memberHoldingRequests(ticketId = state.selectedHoldingTicketId) {
  const shared = loadSharedData();
  const memberName = state.member?.name || state.profile.name;
  return (shared.holdingRequests || []).filter((request) => (
    request.member === memberName
    && (!ticketId || String(request.ticketId || "") === String(ticketId))
  ));
}

function membershipTicketCard(ticket = {}, options = {}) {
  const currentTicketIds = options.currentTicketIds || new Set();
  const compact = Boolean(options.compact);
  const totalSessions = Math.max(0, Number(ticket.total || 0));
  const remainingSessions = Math.max(0, Number(ticket.remaining || 0));
  const usedSessions = Math.max(0, Number(ticket.used ?? totalSessions - remainingSessions));
  const progress = totalSessions ? Math.min(100, Math.max(0, (usedSessions / totalSessions) * 100)) : 0;
  const derivedState = window.TennisNoteTicketState?.derive?.(ticket) || ticket.status || "current";
  const isPendingTicket = derivedState === "pending_payment";
  const isUpcomingTicket = derivedState === "upcoming";
  const isCurrentTicket = currentTicketIds.has(String(ticket.id || "")) || String(ticket.id || "").startsWith("demo-");
  const isLowTicket = isCurrentTicket && remainingSessions <= 2;
  const statusLabel = window.TennisNoteTicketState?.label?.(ticket)
    || (isPendingTicket ? "결제 대기" : isUpcomingTicket ? "시작 예정" : ticket.statusLabel || "사용 중");
  const ticketPeriod = ticket.expiresOn
    ? `${ticket.startsOn || "시작일 확인"} ~ ${ticket.expiresOn}`
    : "이용 기간 확인 중";
  const holding = isCurrentTicket ? memberHoldingRequests(ticket.id)[0] : null;
  const pendingPaymentId = ticket.providerPaymentId || "";
  const canResumePayment = pendingPaymentId && Number(ticket.paymentAmount || 0) > 0;
  const isCancellingPendingPayment = Boolean(pendingPaymentId && pendingPaymentCancelInFlight.has(pendingPaymentId));
  const pendingPaymentActions = isPendingTicket
    ? `<div class="membership-pending-actions">
        <button class="small-button" type="button" data-resume-pending-ticket="${escapeHtml(ticket.id)}" ${canResumePayment ? "" : "disabled"}>결제 계속</button>
        <button class="small-button" type="button" data-check-pending-ticket="${escapeHtml(ticket.id)}" ${pendingPaymentId ? "" : "disabled"}>상태 확인</button>
        <button class="small-button danger-button" type="button" data-cancel-pending-ticket="${escapeHtml(ticket.id)}" ${pendingPaymentId && !isCancellingPendingPayment ? "" : "disabled"}>${isCancellingPendingPayment ? "취소 중" : "대기 취소"}</button>
      </div>`
    : "";
  const holdingAction = isCurrentTicket && !isPendingTicket
    ? `<button class="membership-status-note" type="button" data-open-holding-request="${escapeHtml(ticket.id)}">${holding ? `이용 보류 · ${escapeHtml(holdingStatusLabel(holding.status))}` : "기간 보류 신청"}</button>`
    : "";
  return `
    <article class="membership-ticket-unit ${compact ? "is-compact" : ""}" data-member-ticket-id="${escapeHtml(ticket.id || "")}" ${options.primary ? "data-primary-member-ticket" : ""}>
      <div class="membership-primary-card ${isPendingTicket || isUpcomingTicket ? "is-pending" : ""} ${isLowTicket ? "is-low" : ""}">
        <div class="membership-primary-head">
          <span>${isUpcomingTicket || isPendingTicket ? "다음 회원권" : "현재 회원권"}</span>
          <small>${escapeHtml(statusLabel)}</small>
        </div>
        <strong>${escapeHtml(ticket.title || "회원권")}</strong>
        <div class="membership-remaining-row">
          <span>남은 횟수</span>
          <b>${remainingSessions}<em>회</em></b>
        </div>
        ${compact ? "" : `<div class="membership-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${totalSessions || 1}" aria-valuenow="${usedSessions}" aria-label="회원권 사용 진행률"><span style="width: ${progress}%"></span></div>`}
        <small class="membership-period">${escapeHtml(ticketPeriod)}${compact ? "" : ` · 총 ${totalSessions} / 사용 ${usedSessions}`}</small>
      </div>
      ${pendingPaymentActions}
      ${holdingAction}
    </article>`;
}

function linkMemberGroupPartner() {
  if (state.groupAccount && !state.groupAccount.demoOnly) {
    state.ticketHistory.unshift({ text: "파트너 앱 연결 요청 · 관리자 확인 필요", tone: "wait" });
    saveSnapshot();
    renderGroupAccountPanel();
    return;
  }
  const partner = state.groupAccount?.members?.find((member) => member.appStatus !== "linked");
  if (!partner) return;
  partner.appStatus = "linked";
  partner.canManageSchedule = true;
  saveSnapshot();
  renderGroupAccountPanel();
}

function memberKind() {
  return String(state.member?.memberKind || "journal_only");
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

function memberEnrollmentStatusInfo() {
  if (memberKind() === "lesson_member" || currentLiveTicket()?.status === "active") {
    return { tone: "done", title: "수강회원", detail: "가입서와 결제가 연결되어 시간표와 회원권을 이용 중입니다." };
  }
  if (memberKind() === "former_lesson_member") {
    return { tone: "done", title: "기존 수강회원", detail: "재등록할 때 기존 가입서를 다시 작성하지 않고 결제로 이어집니다." };
  }
  if (["submitted", "approved"].includes(String(state.memberEnrollment?.status || ""))) {
    return { tone: "wait", title: "가입서 제출 완료", detail: "선택한 회원권을 결제하면 수강회원으로 자동 전환됩니다." };
  }
  return { tone: "journal", title: "운동노트 회원", detail: "운동 기록은 바로 사용할 수 있고, 첫 회원권 결제 때 수강 가입서를 작성합니다." };
}

function setEnrollmentInputValue(selector, value = "") {
  const input = $(selector);
  if (input) input.value = value ?? "";
}

function purchaseFlowState() {
  if (!state.purchaseFlow || typeof state.purchaseFlow !== "object") {
    state.purchaseFlow = {
      open: false,
      step: 1,
      familyId: "four-week",
      productId: "",
      renewalTicketId: "",
      purchasePurpose: "",
      showMoreSlots: false,
      scheduleMode: "keep",
      coachRoleId: "",
      coachName: "",
      preferredDate: "",
      preferredDay: "",
      preferredTime: "",
      preferredSchedules: [],
      discountIssueId: "",
      discountSelectionMode: "auto",
      completionStatus: "",
    };
  }
  state.purchaseFlow.familyId = membershipProductFamilyDefinition(state.purchaseFlow.familyId).id;
  state.purchaseFlow.purchasePurpose = String(state.purchaseFlow.purchasePurpose || "");
  state.purchaseFlow.showMoreSlots = state.purchaseFlow.showMoreSlots === true;
  state.purchaseFlow.preferredDate = String(state.purchaseFlow.preferredDate || "");
  state.purchaseFlow.preferredSchedules = Array.isArray(state.purchaseFlow.preferredSchedules)
    ? state.purchaseFlow.preferredSchedules
      .filter((schedule) => schedule && typeof schedule === "object")
      .map((schedule) => ({
        lessonDate: String(schedule.lessonDate || schedule.lesson_date || ""),
        day: String(schedule.day || schedule.preferredDay || ""),
        startTime: String(schedule.startTime || schedule.preferredTime || "").slice(0, 5),
        coachRoleId: String(schedule.coachRoleId || schedule.coach_role_id || ""),
        coachName: String(schedule.coachName || ""),
        durationMinutes: Math.max(10, Number(schedule.durationMinutes) || 20),
      }))
      .filter((schedule) => schedule.lessonDate && schedule.startTime && schedule.coachRoleId)
    : [];
  state.purchaseFlow.discountIssueId = String(state.purchaseFlow.discountIssueId || "");
  state.purchaseFlow.discountSelectionMode = state.purchaseFlow.discountSelectionMode === "manual" ? "manual" : "auto";
  return state.purchaseFlow;
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

function purchaseCoachOptions() {
  if (state.dataMode === "live") {
    const workspaceCoaches = memberScheduleV2WorkspaceCache?.workspace?.coaches;
    if (!Array.isArray(workspaceCoaches) || !workspaceCoaches.length) return [];
  }
  const policy = loadAdminSchedulePolicy();
  return (policy.coaches || [])
    .filter((coach) => ["active", "approved"].includes(String(coach.status || "active").toLowerCase()))
    .filter((coach) => String(coach.employmentStatus || coach.employment_status || "active").toLowerCase() === "active")
    .filter((coach) => !coach.archivedAt && !coach.archived_at && !coach.deletedAt && !coach.deleted_at)
    .sort((left, right) => memberScheduleLaneOrder(left) - memberScheduleLaneOrder(right));
}

function purchaseAvailabilityRange() {
  const today = purchaseEffectiveStartDate();
  const workspace = memberScheduleV2WorkspaceCache?.workspace || {};
  const start = [today, String(workspace.from || "")].filter(Boolean).sort().at(-1) || today;
  const defaultEndDate = new Date(`${start}T12:00:00`);
  defaultEndDate.setDate(defaultEndDate.getDate() + 20);
  const defaultEnd = localDateKey(defaultEndDate);
  const end = workspace.to && String(workspace.to) < defaultEnd ? String(workspace.to) : defaultEnd;
  return { start, end };
}

function purchaseScheduleOperationForDate(dateKey = "") {
  return (state.scheduleOperationDays || []).find((operation) => String(operation.date || "") === dateKey) || null;
}

function purchaseScheduleAvailabilityState() {
  if (state.dataMode !== "live" || !state.member?.profileId) return "ready";
  if (state.scheduleV2SyncStatus === "error") return "error";
  if (!state.scheduleV2WorkspaceLoaded || !memberScheduleV2WorkspaceCache?.workspace) return "loading";
  if (!Array.isArray(memberScheduleV2WorkspaceCache.workspace.coaches)
    || !memberScheduleV2WorkspaceCache.workspace.coaches.length) return "coach_error";
  return "ready";
}

function purchaseAvailableScheduleSlots(product = purchaseFlowProduct()) {
  if (!product || purchaseScheduleAvailabilityState() !== "ready") return [];
  const policy = loadAdminSchedulePolicy();
  const sourceTicket = purchaseFlowSourceTicket();
  const durationMinutes = Math.max(10, Number(product.lessonMinutes) || 20);
  const scopes = purchaseProductScheduleScopes(product);
  const scheduleLessons = state.liveLessons || [];
  const { start, end } = purchaseAvailabilityRange();
  const now = Date.now();
  const sourceCoachId = purchaseFlowState().purchasePurpose === "renew_same"
    ? String(sourceTicket?.coachRoleId || "")
    : "";
  const coachSaleAvailability = product.coachSaleAvailability || {};
  const coachSaleMode = String(product.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active";
  const coaches = purchaseCoachOptions().filter((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    if (coachSaleMode === "selected" ? coachSaleAvailability[roleId] !== true : coachSaleAvailability[roleId] === false) return false;
    if (!sourceCoachId) return true;
    return roleId === sourceCoachId;
  });
  const slots = [];
  for (let dateKey = start; dateKey <= end;) {
    const day = purchaseDateDay(dateKey);
    const dateScope = ["토", "일"].includes(day) ? "weekend" : "weekday";
    const operation = purchaseScheduleOperationForDate(dateKey);
    if (scopes.has(dateScope) && operation?.mode !== "closed") {
      coaches.forEach((coach) => {
        memberCoachBookableTimes(coach, day, durationMinutes).forEach((time) => {
          if (new Date(`${dateKey}T${time}:00`).getTime() <= now) return;
          if (!purchaseOperationAllowsSlot(operation, time, durationMinutes)) return;
          if (memberBreakRuleOverlaps(policy, day, time, durationMinutes)) return;
          if (!isMemberCoachWorking(coach, day, time, durationMinutes)) return;
          if (purchaseHasCoachLessonAtDate(scheduleLessons, dateKey, time, coach, durationMinutes, policy)) return;
          const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
          if (!roleId) return;
          slots.push({
            id: `purchase-slot-${dateKey}-${time}-${roleId}`,
            lessonDate: dateKey,
            day,
            time,
            coachRoleId: roleId,
            coachName: coach.name || "담당 코치",
          });
        });
      });
    }
    const next = new Date(`${dateKey}T12:00:00`);
    next.setDate(next.getDate() + 1);
    dateKey = localDateKey(next);
  }
  return slots.sort((left, right) => (
    `${left.lessonDate} ${left.time}`.localeCompare(`${right.lessonDate} ${right.time}`)
    || left.coachName.localeCompare(right.coachName, "ko")
  ));
}

function purchaseScheduleSlotGroupsHtml(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const status = purchaseScheduleAvailabilityState();
  if (status === "loading") return '<p class="purchase-availability-state" role="status">실제 시간표에서 가능한 시간을 확인하고 있습니다.</p>';
  if (status === "error") return '<p class="purchase-availability-state is-error" role="status">시간표를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>';
  if (status === "coach_error") return '<p class="purchase-availability-state is-error" role="status">운영 중인 선생님 정보를 확인하지 못했습니다. 임시 선생님을 대신 표시하지 않으며, 새로고침 후 다시 확인해 주세요.</p>';
  const slots = purchaseAvailableScheduleSlots(product);
  const coachSaleAvailability = product?.coachSaleAvailability || {};
  const coachSaleMode = String(product?.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active";
  const coachOptions = purchaseCoachOptions().filter((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    return coachSaleMode === "selected" ? coachSaleAvailability[roleId] === true : coachSaleAvailability[roleId] !== false;
  });
  const sourceTicket = purchaseFlowSourceTicket();
  const sourceCoachId = flow.purchasePurpose === "renew_same" ? String(sourceTicket?.coachRoleId || "") : "";
  const visibleCoaches = sourceCoachId
    ? coachOptions.filter((coach) => String(coach.serverRoleId || coach.roleId || coach.id || "") === sourceCoachId)
    : coachOptions;
  const selectedCoach = visibleCoaches.find((coach) => (
    String(coach.serverRoleId || coach.roleId || coach.id || "") === String(flow.coachRoleId || sourceCoachId)
  ));
  const selectedCoachSlots = selectedCoach
    ? slots.filter((slot) => String(slot.coachRoleId) === String(flow.coachRoleId || sourceCoachId))
    : [];
  const coachSelector = sourceCoachId ? "" : flow.coachRoleId && selectedCoach
    ? `<article class="purchase-selected-coach">
        <div><span>선택한 선생님</span><strong>${escapeHtml(memberCoachShortName(selectedCoach.name || flow.coachName || "담당 코치"))} 코치</strong><small>${selectedCoachSlots[0] ? `가장 빠른 ${escapeHtml(purchaseDateLabel(selectedCoachSlots[0].lessonDate))} ${escapeHtml(selectedCoachSlots[0].time)}` : "가능한 시간을 확인해 주세요"}</small></div>
        <button class="small-button" type="button" data-clear-purchase-coach>다시 선택</button>
      </article>`
    : `<div class="purchase-coach-filter-grid" role="group" aria-label="선생님 선택">
      ${visibleCoaches.map((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    const coachSlots = slots.filter((slot) => String(slot.coachRoleId) === roleId);
    const first = coachSlots[0];
    const selected = roleId === String(flow.coachRoleId || "");
    return `<button class="purchase-coach-filter ${selected ? "is-selected" : ""} ${first ? "" : "is-unavailable"}" type="button"
        data-purchase-coach-filter="${escapeHtml(roleId)}" data-purchase-coach-filter-name="${escapeHtml(coach.name || "담당 코치")}" ${first ? "" : "disabled"}
        aria-pressed="${selected}"><strong>${escapeHtml(memberCoachShortName(coach.name || "담당 코치"))} 코치</strong><small>${first ? `가장 빠른 ${escapeHtml(purchaseDateLabel(first.lessonDate))} ${escapeHtml(first.time)}` : "현재 가능한 시간 없음"}</small></button>`;
  }).join("")}
    </div>`;
  const activeCoachRoleId = String(flow.coachRoleId || sourceCoachId || "");
  const matchingSlots = activeCoachRoleId
    ? slots.filter((slot) => String(slot.coachRoleId) === activeCoachRoleId)
    : [];
  const visibleLimit = flow.showMoreSlots ? 12 : 6;
  const visibleSlots = matchingSlots.slice(0, visibleLimit);
  const requiredCount = purchaseRequiredScheduleCount(product);
  const selectedSchedules = purchaseSelectedSchedules(product);
  const slotButtons = visibleSlots.map((slot) => {
    const selected = selectedSchedules.some((schedule) => (
      String(schedule.coachRoleId) === String(slot.coachRoleId)
      && schedule.lessonDate === slot.lessonDate
      && schedule.startTime === slot.time
    ));
    return `<button class="purchase-slot-card ${selected ? "is-selected" : ""}" type="button"
      data-purchase-slot="${escapeHtml(slot.id)}" data-purchase-slot-date="${escapeHtml(slot.lessonDate)}"
      data-purchase-slot-day="${escapeHtml(slot.day)}" data-purchase-slot-time="${escapeHtml(slot.time)}"
      data-purchase-slot-coach="${escapeHtml(slot.coachRoleId)}" data-purchase-slot-coach-name="${escapeHtml(slot.coachName)}"
      aria-pressed="${selected}"><strong>${escapeHtml(purchaseDateLabel(slot.lessonDate))}</strong><span>${escapeHtml(slot.time)}</span></button>`;
  }).join("");
  return `<div class="purchase-slot-groups">
    ${coachSelector}
    ${activeCoachRoleId ? `<div class="purchase-schedule-count" role="status"><strong>${selectedSchedules.length}/${requiredCount}개 선택</strong><span>${requiredCount > 1 ? `주 ${requiredCount}회 수업 시간을 모두 골라주세요.` : "수업 시간 하나를 골라주세요."}</span></div>` : ""}
    ${activeCoachRoleId
    ? `<div class="purchase-slot-card-grid" role="group" aria-label="선택한 선생님의 가능한 시간">${slotButtons || '<p class="purchase-availability-state" role="status">선택한 선생님의 가능한 빈 시간이 없습니다.</p>'}</div>`
    : '<p class="purchase-availability-state purchase-coach-first" role="status">선생님을 선택하면 그 선생님의 가능한 시간만 보여드립니다.</p>'}
    ${matchingSlots.length > visibleSlots.length ? `<button class="small-button purchase-show-more-slots" type="button" data-purchase-show-more-slots>다른 시간 ${Math.min(6, matchingSlots.length - visibleSlots.length)}개 더 보기</button>` : ""}
  </div>`;
}

function memberPurchaseLifecycle() {
  const allTickets = [...(state.liveTickets || []), ...(state.expiredTickets || [])];
  const hasActiveTicket = allTickets.some((ticket) => !["expired", "refunded", "cancelled"].includes(String(ticket.status || "").toLowerCase()));
  if (hasActiveTicket) return "active";
  return allTickets.some((ticket) => Boolean(ticket?.id || ticket?.title)) ? "returning" : "new";
}

function purchasePurposeOptionsHtml() {
  const flow = purchaseFlowState();
  const activeTickets = (state.liveTickets || []).filter((ticket) => !["expired", "refunded", "cancelled"].includes(String(ticket.status || "").toLowerCase()));
  if (!activeTickets.length) {
    flow.purchasePurpose = membershipProductFamilyId(purchaseFlowProduct() || {}) === "one-day" ? "one_day" : "new_purchase";
    const returning = memberPurchaseLifecycle() === "returning";
    return `<input type="hidden" value="new_purchase" /><p class="purchase-policy-note"><strong>${returning ? "재등록" : "신규 등록"}</strong> · ${returning ? "상품·선생님·시간을 다시 선택합니다. 이전 이용권 기록은 그대로 보관됩니다." : "모든 활성 코치의 실제 가능한 시간을 확인할 수 있습니다."}</p>`;
  }
  const renewing = flow.purchasePurpose === "renew_same";
  const selectedTicket = purchaseFlowSourceTicket() || activeTickets[0] || null;
  const lesson = purchaseTicketLesson(selectedTicket || {});
  const coachName = selectedTicket?.coach || memberScheduleTicketCoachName(selectedTicket || {}) || "담당 코치";
  const scheduleLabel = lesson ? `${lesson.day || ""} ${lesson.time || ""}`.trim() : "기존 정규시간";
  return `
    <section class="purchase-purpose-section" aria-label="구매 목적">
      <div class="purchase-purpose-toggle" role="group" aria-label="연장 또는 새 선생님 추가">
        <button class="purchase-choice ${renewing ? "is-selected" : ""}" type="button" data-purchase-purpose="renew_same" aria-pressed="${renewing}"><strong>연장</strong><small>선생님·시간 유지</small></button>
        <button class="purchase-choice ${flow.purchasePurpose === "add_coach" ? "is-selected" : ""}" type="button" data-purchase-purpose="add_coach" aria-pressed="${flow.purchasePurpose === "add_coach"}"><strong>새 이용권</strong><small>다른 선생님 선택</small></button>
      </div>
      ${renewing && selectedTicket ? `<article class="purchase-renewal-summary">
        <div><span>연장 대상</span><strong>${escapeHtml(memberTicketCompactLabel(selectedTicket))}</strong><small>${escapeHtml(memberCoachShortName(coachName))} 코치 · ${escapeHtml(scheduleLabel)}</small></div>
        <button class="small-button" type="button" data-purchase-schedule-mode="${flow.scheduleMode === "change" ? "keep" : "change"}">${flow.scheduleMode === "change" ? "기존 시간 유지" : "시간만 변경"}</button>
      </article>
      ${activeTickets.length > 1 ? `<label class="purchase-renewal-ticket-field"><span>다른 이용권 선택</span><select id="purchaseRenewalTicket" aria-label="연장할 이용권 선택">${activeTickets.map((ticket) => `<option value="${escapeHtml(ticket.id || "")}" ${String(ticket.id) === String(flow.renewalTicketId) ? "selected" : ""}>${escapeHtml(memberTicketCompactLabel(ticket))} · ${escapeHtml(memberCoachShortName(ticket.coach || "담당 코치"))} 코치</option>`).join("")}</select></label>` : ""}` : '<p class="purchase-policy-note">새 선생님을 먼저 선택한 뒤 그 선생님의 가능한 시간만 고릅니다. 기존 이용권은 그대로 유지됩니다.</p>'}
    </section>`;
}

function purchaseEmptyFamilyHtml(familyId = "") {
  const family = membershipProductFamilyDefinition(familyId);
  if (family.id === "one-day") {
    return `
      <div class="empty-state compact purchase-family-empty">
        <strong>원데이 1회권 판매 준비 중</strong>
        <span>가격이 등록되면 이 화면에서 바로 결제할 수 있습니다. 지금은 가능한 코치와 시간을 먼저 문의해 주세요.</span>
        <button class="small-button" type="button" data-open-one-day-inquiry>원데이 문의</button>
      </div>`;
  }
  return memberEmptyState({ title: `${family.label} 판매 준비 중`, reason: "상품이 등록되면 이 화면에서 바로 선택할 수 있습니다.", compact: true });
}

function purchaseStepTwoHtml() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  if (!product) return memberEmptyState({ title: "상품을 먼저 선택해 주세요", reason: "이전 단계에서 회원권을 골라주세요.", compact: true });
  const sourceTicket = purchaseFlowSourceTicket();
  const coupon = membershipProductFacet(product, "productKind") === "coupon";
  const selectedCoachName = flow.coachName || sourceTicket?.coach || state.profile.mainCoach || "";
  const fixedRenewal = Boolean(sourceTicket && !coupon);
  if (fixedRenewal && flow.scheduleMode === "keep") {
    return "";
  }
  const availabilityTitle = fixedRenewal
    ? `${memberCoachShortName(selectedCoachName || "담당 코치")} 코치의 변경할 시간을 고르세요`
    : flow.coachRoleId ? `${memberCoachShortName(flow.coachName || "선택한 선생님")} 코치의 시간을 고르세요` : "선생님을 먼저 고르세요";
  const availabilityDetail = coupon
    ? "쿠폰 가격은 평일·주말이 같고, 선택한 코치와 실제 빈 시간으로만 구분합니다."
    : fixedRenewal
      ? "선생님은 그대로 두고 시간만 변경합니다."
      : "선생님을 선택하면 다른 선생님의 시간은 숨기고 실제 빈 시간만 보여드립니다.";
  const selectedSchedules = purchaseSelectedSchedules(product);
  const selectedSummary = selectedSchedules.length
    ? `<div class="purchase-selected-schedule-list" aria-label="선택한 수업 시간">${selectedSchedules.map((schedule, index) => `<span><b>${index + 1}</b>${escapeHtml(purchaseDateLabel(schedule.lessonDate))} ${escapeHtml(schedule.startTime)}</span>`).join("")}</div>`
    : "";
  return `
    <div class="purchase-step-intro"><strong>${availabilityTitle}</strong><span>${availabilityDetail}</span></div>
    ${selectedSummary}
    <section class="purchase-choice-section purchase-actual-slots" aria-label="실제 예약 가능한 시간">
      ${purchaseScheduleSlotGroupsHtml(product)}
    </section>
    <p class="purchase-policy-note">표시된 시간은 현재 시간표 기준입니다. 결제 확인과 최종 등록 사이에 다른 예약이 생기면 관리자 확인 후 가장 가까운 시간으로 안내합니다.</p>`;
}

function selectPurchasePurpose(purpose = "") {
  const flow = purchaseFlowState();
  flow.showMoreSlots = false;
  const activeTickets = (state.liveTickets || []).filter((ticket) => !["expired", "refunded", "cancelled"].includes(String(ticket.status || "").toLowerCase()));
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
  else if (flow.purchasePurpose === "one_day") flow.purchasePurpose = (state.liveTickets || []).length ? "" : "new_purchase";
  flow.productId = "";
  flow.discountIssueId = "";
  flow.discountSelectionMode = "auto";
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
  const product = membershipProducts().find((item) => String(item.id || "") === String(productId || ""));
  if (!product) return;
  const flow = purchaseFlowState();
  const productChanged = String(flow.productId || "") !== String(product.id || "");
  if (productChanged) {
    flow.showMoreSlots = false;
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
  }
  flow.productId = product.id;
  flow.familyId = membershipProductFamilyId(product);
  if (flow.familyId === "one-day") {
    flow.purchasePurpose = "one_day";
    flow.renewalTicketId = "";
    flow.scheduleMode = "change";
  } else if (flow.purchasePurpose === "one_day") {
    flow.purchasePurpose = (state.liveTickets || []).length ? "" : "new_purchase";
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
  if (productChanged && product.branchId) {
    void syncMemberPaymentOptionsFromServer(product.branchId).then(() => renderMembershipPurchaseFlow());
  }
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

async function refreshPurchaseScheduleAvailability() {
  if (state.dataMode !== "live" || !state.member?.profileId) return true;
  await syncMemberScheduleV2(null, { force: false, week: purchaseScheduleWeek() }).catch(() => false);
  const flow = purchaseFlowState();
  if (flow.open && flow.step !== 4) renderMembershipPurchaseFlow();
  return purchaseScheduleAvailabilityState() === "ready";
}

function normalizePage(type, total) {
  const key = pageStateKey(type);
  const maxPage = pageCount(total) - 1;
  state[key] = Math.min(Math.max(Number(state[key]) || 0, 0), maxPage);
  return state[key];
}

function membershipPassRecords() {
  const groupedRequests = [];
  const groupedRequestIndex = new Map();
  (state.paymentRequests || []).forEach((request) => {
    const display = paymentRequestDisplay(request);
    const canGroup = display.tone === "alert";
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
    };
  });
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
  return [...pendingPasses, ...refundedPasses, ...(state.expiredTickets || [])];
}

let portOneSdkPromise = null;
let preparedPaymentContext = null;
let bankTransferAccountNumberForCopy = "";
let bankTransferPaymentIdForCancel = "";

async function copyBankTransferAccountNumber() {
  if (!bankTransferAccountNumberForCopy) {
    showToast("복사할 계좌번호를 찾지 못했습니다.");
    return;
  }
  try {
    await navigator.clipboard.writeText(bankTransferAccountNumberForCopy);
    showToast("계좌번호를 복사했습니다.");
  } catch {
    showToast("계좌번호를 길게 눌러 복사해 주세요.");
  }
}

const pendingPaymentCancelInFlight = new Set();

function loadPortOneSdk() {
  if (window.__TENNIS_NOTE_PORTONE_TEST_SDK__?.requestPayment) {
    return Promise.resolve(window.__TENNIS_NOTE_PORTONE_TEST_SDK__);
  }
  if (!portOneSdkPromise) {
    portOneSdkPromise = import("https://cdn.portone.io/v2/browser-sdk.esm.js")
      .then((sdk) => {
        if (!sdk?.requestPayment) throw new Error("portone_sdk_invalid");
        return sdk;
      })
      .catch((error) => {
        portOneSdkPromise = null;
        throw error;
      });
  }
  return portOneSdkPromise;
}

function availableDiscountCoupons() {
  return (state.discountCoupons || []).filter((coupon) => discountCouponStatus(coupon).label === "사용 가능");
}

let memberScheduleV2WorkspaceCache = null;
let memberScheduleV2RequestSequence = 0;
let memberChangeCandidateRequestSequence = 0;

function rejectMemberScheduleIdentity(issue, integrity = null) {
  state.scheduleV2SyncStatus = "error";
  state.scheduleV2SyncErrorCode = issue?.code || "member_schedule_identity_error";
  state.scheduleV2SyncError = issue?.message || "회원 연결을 확인해야 시간표를 불러올 수 있습니다.";
  state.scheduleV2Integrity = integrity;
  state.liveLessonsLoaded = true;
  renderMemberRuntimeDiagnostics();
  return false;
}

function memberScheduleV2Context(profile = null, week = activeMemberWeek()) {
  const profileId = profile?.id || state.member?.profileId || "";
  const workspaceStart = new Date(`${week.startDate}T12:00:00`);
  const workspaceEnd = new Date(
    workspaceStart.getFullYear(),
    workspaceStart.getMonth(),
    workspaceStart.getDate() + memberScheduleWorkspaceDays,
  );
  const workspaceEndDate = localDateKey(workspaceEnd);
  return {
    profileId,
    week,
    workspaceEndDate,
    key: `${profileId}:${week.startDate}:${workspaceEndDate}`,
  };
}

function activeMemberScheduleLoadState() {
  if (state.dataMode !== "live" || !state.member?.profileId) return "ready";
  const activeKey = memberScheduleV2Context().key;
  if (state.scheduleV2TargetKey === activeKey && state.scheduleV2SyncStatus === "loading") return "loading";
  if (state.scheduleV2TargetKey === activeKey && state.scheduleV2SyncStatus === "error") return "error";
  if (state.scheduleV2LoadedKey === activeKey) return "ready";
  return state.scheduleV2WorkspaceLoaded ? "ready" : "loading";
}

function mapServerMemberChangeCandidate(candidate = {}, source = null) {
  const lessonDate = String(candidate.lessonDate || "");
  const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
  const time = String(candidate.startTime || "").slice(0, 5);
  const coachRoleId = candidate.coachRoleId || source?.coachRoleId || source?.coach_role_id || "";
  const rawAnchorGap = candidate.anchorGapMinutes !== undefined
    ? candidate.anchorGapMinutes
    : state.serverChangeAnchorGapMinutes;
  return {
    id: `server-change-slot-${source?.serverLessonId || "lesson"}-${lessonDate}-${time}`,
    day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
    time,
    coach: source?.coach || "담당 코치",
    coachRoleId,
    coach_role_id: coachRoleId,
    lessonDate,
    member: "",
    type: source?.couponBooking ? "쿠폰 예약 가능" : "수업 변경 신청가능",
    status: "available",
    policy: candidate.policy || "coach",
    anchorGapMinutes: rawAnchorGap === null ? null : Math.max(0, Number(rawAnchorGap) || 40),
    generated: true,
    authoritativeCandidate: true,
    couponBooking: Boolean(source?.couponBooking),
    durationMinutes: Number(candidate.durationMinutes) || lessonDuration(source),
    member_ticket_id: source?.member_ticket_id || source?.ticketId || "",
    ticketId: source?.member_ticket_id || source?.ticketId || "",
  };
}

function mergeScheduleV2MemberRecords(mappedLessons = []) {
  mappedLessons
    .filter((lesson) => {
      const record = lesson.participantRecord;
      if (!lesson.isOwnLesson || record?.recordStatus !== "final") return false;
      return Boolean(record.coachComment) || ["completed", "no_show"].includes(record.outcome);
    })
    .forEach((lesson) => {
      const record = lesson.participantRecord;
      const existingIndex = state.lessonLogs.findIndex((log) => (
        String(log.serverLessonId || "") === String(lesson.serverLessonId || "")
      ));
      const existing = existingIndex >= 0 ? state.lessonLogs[existingIndex] : {};
      const nextCurriculumId = record.nextCurriculumSkillLabel || existing.nextCurriculumId || "FH-01";
      const curriculum = curriculumById(nextCurriculumId, existing.curriculum || curriculumSteps[0]);
      const outcomeText = record.outcome === "no_show" ? "노쇼 처리" : "코치 수업기록";
      const log = {
        ...existing,
        id: existing.id || `schedule-v2-record-${lesson.serverLessonId}`,
        serverJournalId: existing.serverJournalId || "",
        serverLessonId: lesson.serverLessonId,
        lessonId: existing.lessonId || lesson.id,
        lessonLabel: existing.lessonLabel || `${lesson.day} ${lesson.time} · ${lesson.coach}`,
        round: Number(existing.round) || Math.max(1, Number(lesson.ticketUsedSessions) || lessonRound()),
        journalDate: existing.journalDate || lesson.lessonDate,
        content: existing.content || `회원 운동일지 미작성 · ${outcomeText}`,
        selfMemo: existing.selfMemo || "회원 운동일지 미작성",
        mediaNames: existing.mediaNames || [],
        mediaItems: existing.mediaItems || [],
        status: "confirmed",
        curriculum,
        nextCurriculumId,
        coachComment: record.coachComment || existing.coachComment || "",
        memberVisibleSummary: record.nextGoal
          ? `다음 수업 목표: ${record.nextGoal}`
          : record.nextCurriculumTitle
            ? `다음 수업: ${record.nextCurriculumTitle}`
            : existing.memberVisibleSummary || "",
        ticketDeducted: Number(record.deductedSessions) > 0,
        participantOutcome: record.outcome,
        submittedAt: record.finalizedAt || existing.submittedAt || `${lesson.lessonDate}T${lesson.time}:00`,
      };
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = log;
      else state.lessonLogs.unshift(log);
    });
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
function liveLessonForJournal(log = {}) {
  const targetDate = log.journalDate || "";
  const targetTime = String(log.lessonLabel || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
  const candidates = state.liveLessons.filter((lesson) => lesson.isOwnLesson && lesson.status === "scheduled");
  return candidates.find((lesson) => lesson.id === log.lessonId)
    || candidates.find((lesson) => lesson.lessonDate === targetDate && lesson.time === targetTime)
    || candidates.find((lesson) => lesson.lessonDate === targetDate)
    || null;
}

function paymentMethodDefinition(methodId = state.selectedPaymentMethod) {
  const base = paymentMethodDefinitions.find((method) => method.id === methodId)
    || paymentMethodDefinitions.find((method) => method.id === "tosspay")
    || paymentMethodDefinitions[0];
  const configured = (state.livePaymentOptions?.paymentMethods || []).find((method) => method.id === base.id) || {};
  return {
    ...base,
    label: String(configured.title || base.label),
    shortLabel: String(configured.title || base.shortLabel),
    displayOrder: Number(configured.displayOrder || 999),
    priceBasis: String(configured.priceBasis || (base.id === "bank_transfer" ? "cash" : "card")),
    couponAllowed: configured.couponAllowed !== false,
  };
}

function normalizeSelectedPaymentMethod() {
  const config = paymentGatewayConfig();
  const enforcedMethodId = paymentMethodIdForRequest(state.selectedPaymentMethod, config);
  if (isPaymentGatewayReady(enforcedMethodId, config)) {
    state.selectedPaymentMethod = enforcedMethodId;
    return state.selectedPaymentMethod;
  }
  const readyMethodId = allowedPaymentMethodIds(config).find((methodId) => isPaymentGatewayReady(methodId, config));
  state.selectedPaymentMethod = readyMethodId || enforcedMethodId || "tosspay";
  return state.selectedPaymentMethod;
}

function selectPaymentMethod(methodId) {
  if (!paymentMethodDefinitions.some((method) => method.id === methodId)
    || !isPaymentMethodAllowed(methodId)
    || !isPaymentGatewayReady(methodId)) return;
  const flow = purchaseFlowState();
  if (state.selectedPaymentMethod !== methodId) {
    flow.discountIssueId = "";
    flow.discountSelectionMode = "auto";
  }
  state.selectedPaymentMethod = methodId;
  saveSnapshot();
  if (purchaseFlowState().open) renderMembershipPurchaseFlow();
  else renderProducts();
}

function paymentRedirectUrl() {
  if (nativeAppPlatform() !== "web") return "com.tennisclubhouse.tennisnote://payment";
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

function portOnePaymentRequest({ paymentId, productId, orderName, totalAmount, methodId = state.selectedPaymentMethod }) {
  const config = paymentGatewayConfig();
  const enforcedMethodId = paymentMethodIdForRequest(methodId, config);
  const method = paymentMethodDefinition(enforcedMethodId);
  const channelKey = config.channels?.[method.id] || "";
  if (!isPaymentMethodAllowed(method.id, config) || !config.storeId || !channelKey) {
    throw new Error("payment_channel_not_ready");
  }
  const request = {
    storeId: config.storeId,
    channelKey,
    paymentId,
    orderName,
    totalAmount,
    currency: "CURRENCY_KRW",
    payMethod: method.payMethod,
    locale: "KO_KR",
    customer: {
      fullName: state.profile.name,
      phoneNumber: state.profile.phone,
    },
    redirectUrl: paymentRedirectUrl(),
  };
  if (method.id === "naverpay") {
    request.windowType = { pc: "POPUP", mobile: "REDIRECTION" };
    request.bypass = {
      naverpay: {
        productItems: [{
          categoryType: config.naverPayCategoryType,
          categoryId: config.naverPayCategoryId,
          uid: String(productId || paymentId),
          name: orderName,
          count: 1,
        }],
      },
    };
  }
  if (method.id === "kakaopay") request.windowType = { pc: "IFRAME", mobile: "REDIRECTION" };
  if (nativeAppPlatform() !== "web") request.appScheme = "com.tennisclubhouse.tennisnote://";
  return request;
}

function setNoticeDialogOpen(open) {
  const dialog = $("#noticeDialog");
  if (!dialog) return;
  if (open) {
    if (dialog.hidden) {
      noticePreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    dialog.hidden = false;
    document.body.classList.add("notice-open");
    window.requestAnimationFrame(() => {
      if (!dialog.hidden) $("#noticeClose")?.focus({ preventScroll: true });
    });
    return;
  }
  dialog.hidden = true;
  document.body.classList.remove("notice-open");
  if (noticePreviousFocus?.isConnected) noticePreviousFocus.focus({ preventScroll: true });
  noticePreviousFocus = null;
}

function liveTicketHasUpcomingLesson(ticket, today = localDateKey()) {
  return (state.liveLessons || []).some((lesson) => {
    if (String(lesson.member_ticket_id || lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    const status = lesson.serverStatus || lesson.status || "scheduled";
    return !["cancelled", "completed", "confirmed", "no_show"].includes(status);
  });
}

function couponBookingPopupNotices() {
  if (state.dataMode !== "live" || !state.liveLessonsLoaded) return [];
  return (state.liveTickets || [])
    .filter((ticket) => isActiveCouponLiveTicket(ticket) && !liveTicketHasUpcomingLesson(ticket))
    .map((ticket) => ({
      id: `coupon-next-booking-${ticket.id}`,
      title: "다음 수업을 예약해 주세요",
      body: `${ticket.title || "쿠폰제 회원권"}이 ${Number(ticket.remaining) || 0}회 남아 있습니다. 시간표에서 다음 수업을 선택해 주세요.`,
      audience: "member",
      priority: "important",
      status: "active",
      showOncePerDay: true,
      source: "coupon-booking",
      actionLabel: "시간표 보기",
      actionRoute: "schedule",
      startDate: "",
      endDate: "",
      imageUrl: "",
      imageAlt: "",
    }));
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

function reconcileVerifiedPaymentRequests() {
  const completedPaymentIds = new Set();
  (state.liveTickets || [])
    .filter((ticket) => String(ticket.status || "").toLowerCase() === "active")
    .forEach((ticket) => {
      [ticket.paymentId, ticket.providerPaymentId, ticket.sourcePaymentId].filter(Boolean).forEach((id) => completedPaymentIds.add(String(id)));
    });
  if (!completedPaymentIds.size) return false;

  const isCompletedRequest = (request = {}) => [request.paymentId, request.serverPaymentId]
    .filter(Boolean)
    .some((id) => completedPaymentIds.has(String(id)));
  const beforeCount = state.paymentRequests.length;
  state.paymentRequests = state.paymentRequests.filter((request) => !isCompletedRequest(request));

  const shared = loadSharedData();
  const sharedRequests = Array.isArray(shared.paymentRequests) ? shared.paymentRequests : [];
  const nextSharedRequests = sharedRequests.filter((request) => !isCompletedRequest(request));
  if (nextSharedRequests.length !== sharedRequests.length) {
    shared.paymentRequests = nextSharedRequests;
    saveSharedData(shared);
  }
  return beforeCount !== state.paymentRequests.length;
}

function clearPaymentRedirectParams() {
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
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
      state.pendingPaymentCheckStatus = { tone: "alert", text: response.message || "결제가 완료되지 않았습니다." };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제창 종료 · 결제 미완료`, tone: "alert" });
    } else {
      state.pendingPaymentCheckStatus = { tone: "wait", text: "결제창 완료 접수 · 서버 검증을 확인합니다." };
      await checkPendingTicketPayment(ticketId);
      return;
    }
  } catch (error) {
    const detail = paymentServerErrorMessage(error);
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창을 열지 못했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제창 열기 실패`, tone: "alert" });
  }

  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

async function completePreparedPayment() {
  const context = preparedPaymentContext;
  if (!context) return;
  const { product, paymentId, sdk } = context;
  const methodId = paymentMethodIdForRequest(context.methodId);
  let preparedPayment = context.preparedPayment || null;
  const method = paymentMethodDefinition(methodId);
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const button = $("#openPreparedPaymentButton");
  const message = $("#paymentConfirmationMessage");
  if (button) button.disabled = true;
  if (message) message.textContent = "결제 요청을 준비하는 중입니다.";

  try {
    if (!preparedPayment) {
      preparedPayment = await prepareServerPayment(product, paymentId, methodId);
      context.preparedPayment = preparedPayment;
    }
    if (message) message.textContent = "결제창을 여는 중입니다.";
    const response = await sdk.requestPayment(portOnePaymentRequest({
      paymentId,
      productId: product.id,
      orderName: product.title,
      totalAmount: paymentAmount,
      methodId,
    }));

    if (response?.code) {
      await reconcileRejectedServerPayment(response?.paymentId || paymentId);
      await syncMemberTicketsFromServer();
      createPaymentRecord(product, {
        paymentId,
        method: `${method.label} 결제 실패`,
        status: response.message || "결제가 완료되지 않았습니다.",
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 실패 · 다시 시도 필요`, tone: "alert" });
    } else {
      const paidPaymentId = response?.paymentId || paymentId;
      let verifiedStatus = "결제 완료 · 서버 검증 후 회원권 충전 대기";
      try {
        const verification = await verifyServerPayment(paidPaymentId);
        if (verification?.ok) {
          verifiedStatus = verification.status === "verified"
            ? "서버 검증 완료 · 이용권 충전 확인 필요"
            : "서버 검증 확인 · 관리자 확인 필요";
        }
      } catch (error) {
        verifiedStatus = `결제 완료 · 서버 검증 대기 · ${paymentServerErrorMessage(error)}`;
      }
      createPaymentRecord(product, {
        paymentId: paidPaymentId,
        serverPaymentId: preparedPayment?.localPaymentId || "",
        method: method.label,
        status: verifiedStatus,
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 완료 접수 · 검증 후 회원권 충전`, tone: "wait" });
      const flow = purchaseFlowState();
      flow.open = true;
      flow.step = 4;
      flow.completionStatus = "결제가 접수되었습니다";
    }
  } catch (error) {
    if (preparedPayment?.localPaymentId) {
      await reconcileRejectedServerPayment(paymentId).catch(() => undefined);
      await syncMemberDiscountCouponsFromServer().catch(() => false);
    }
    const serverCode = error?.payload?.code || error?.message || "server_error";
    if (["membership_enrollment_required", "group_enrollment_required", "group_partner_required"].includes(serverCode)) {
      closePaymentConfirmationModal();
      await syncMemberEnrollmentFromServer();
      openMemberEnrollmentModal(product.id, "2대1 동반 회원 정보를 포함해 수강 가입서를 확인해 주세요.");
      return;
    }
    if (serverCode === "login_required") {
      closePaymentConfirmationModal();
      markTicketSyncLoginNeeded();
      state.pendingPaymentCheckStatus = { tone: "alert", text: "서버 로그인 후 결제할 수 있습니다. 간편 로그인으로 다시 접속해 주세요." };
      state.ticketHistory.unshift({ text: `${product.title} 결제 전 서버 로그인 필요`, tone: "alert" });
      renderAll();
      setView("shopView");
      return;
    }
    const detail = paymentServerErrorMessage(error);
    createPaymentRecord(product, {
      paymentId,
      method: "결제창 오류",
      status: `결제창을 열지 못했습니다. ${detail}`,
    });
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창을 열지 못했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${product.title} 결제창 오류 · ${detail}`, tone: "alert" });
  }

  closePaymentConfirmationModal();
  await Promise.allSettled([syncMemberTicketsFromServer(), syncMemberDiscountCouponsFromServer()]);
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
    try {
      const prepared = await prepareServerPayment(product, paymentId, methodId);
      createPaymentRecord(product, {
        paymentId,
        serverPaymentId: prepared?.localPaymentId || "",
        methodId,
        method: method.label,
        status: "입금 확인 대기",
        bankTransferAccount: prepared?.bankTransferAccount || null,
      });
      state.pendingPaymentCheckStatus = { tone: "wait", text: "계좌이체 신청이 접수되었습니다. 입금 확인 후 회원권이 발급됩니다." };
      state.ticketHistory.unshift({ text: `${product.title} 계좌이체 신청 · 입금 확인 대기`, tone: "wait" });
      completeMembershipPurchaseFlow("계좌이체 신청이 접수되었습니다");
      await syncMemberDiscountCouponsFromServer();
      saveSnapshot();
      renderAll();
      setView("shopView");
      openBankTransferInstructions(prepared, product, paymentAmount);
    } catch (error) {
      const detail = paymentServerErrorMessage(error);
      state.pendingPaymentCheckStatus = { tone: "alert", text: `계좌이체 신청에 실패했습니다. ${detail}` };
      state.ticketHistory.unshift({ text: `${product.title} 계좌이체 신청 실패 · ${detail}`, tone: "alert" });
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
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제창 준비에 실패했습니다. ${detail}` };
    state.ticketHistory.unshift({ text: `${product.title} 결제창 준비 실패 · ${detail}`, tone: "alert" });
    renderAll();
    setView("shopView");
  }
}

const journalActivityStatuses = [
  { key: "scheduled", label: () => memberStatusLabel("lesson", "scheduled", "예정") },
  { key: "completed", label: () => memberStatusLabel("lesson", "completed", "완료") },
  { key: "absent", label: () => memberStatusLabel("lesson", "absent", "불참") },
  { key: "no_show", label: () => memberStatusLabel("lesson", "no_show", "노쇼") },
  { key: "makeup_booked", label: () => memberStatusLabel("lesson", "makeup_booked", "보강 예약") },
];

function journalActivityItems() {
  const monthValue = state.activeJournalMonth || (state.selectedJournalDate || localDateKey()).slice(0, 7);
  const sourceLessons = state.liveLessonsLoaded ? state.liveLessons : memberScheduleLessons();
  const seenLessons = new Set();
  const lessonItems = sourceLessons
    .filter((lesson) => isOwnMemberScheduleLesson(lesson))
    .map((lesson) => {
      const id = String(lesson.serverLessonId || lesson.id || "");
      const dateValue = lesson.lessonDate || memberScheduleDateForDay(lesson.day);
      const status = journalActivityLessonStatus(lesson);
      return { id, dateValue, status };
    })
    .filter((item) => {
      if (!item.id || seenLessons.has(item.id) || !item.status || !item.dateValue?.startsWith(monthValue)) return false;
      seenLessons.add(item.id);
      return true;
    });

  const absenceItems = (state.liveMakeupEntitlements || [])
    .filter((entitlement) => (
      entitlement.lessonDate?.startsWith(monthValue)
      && !seenLessons.has(String(entitlement.sourceLessonId || ""))
    ))
    .map((entitlement) => ({
      id: `absence-${entitlement.id}`,
      dateValue: entitlement.lessonDate,
      status: "absent",
    }));

  return [...lessonItems, ...absenceItems];
}

function focusJournalActivity(status) {
  const today = localDateKey();
  const matches = journalActivityItems()
    .filter((item) => item.status === status)
    .sort((left, right) => {
      const leftFuture = left.dateValue >= today ? 0 : 1;
      const rightFuture = right.dateValue >= today ? 0 : 1;
      return leftFuture - rightFuture || left.dateValue.localeCompare(right.dateValue);
    });
  if (!matches.length) return;
  const calendarDisclosure = $("#journalCalendarDisclosure");
  if (calendarDisclosure) {
    calendarDisclosure.open = true;
    calendarDisclosure.dataset.userToggled = "true";
  }
  selectJournalDate(matches[0].dateValue);
  $("#journalSelectedDayPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function journalEntries() {
  const lessonEntries = state.lessonLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      serverLessonId: log.serverLessonId || "",
      lessonId: log.lessonId || "",
      kind: "레슨",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: lessonReviewTitle(log),
      subtitle: log.lessonLabel,
      body: log.selfMemo,
      note: log.coachComment || "코치 피드백 대기",
      next: log.memberVisibleSummary || selectedNextText(log),
      outcome: log.participantOutcome || "",
      deductedSessions: Number(log.deductedSessions) || (log.ticketDeducted ? 1 : 0),
      curriculumStep: curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum),
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  const practiceEntries = state.practiceLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      kind: "개인운동",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: `${log.type} 기록`,
      subtitle: log.date,
      body: log.memo,
      note: log.coachFeedback || log.feedbackStatus || "개인 기록",
      next: log.next,
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  return [...lessonEntries, ...practiceEntries];
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

let activeAppSheetId = "";
let activeAppModalId = "";
let appModalReturnFocus = null;
let appSheetScrollLock = null;

function openProfileEditor(focusNtrp = false) {
  openAppSheet("profileEditorSheet", {
    initialFocus: focusNtrp ? "#profileSelfNtrp" : "",
  });
}

function setView(viewId, options = {}) {
  if (!viewId || !$(`#${viewId}`)) return;
  if (viewId === "scheduleView" && !state.memberScheduleModeTouched) {
    state.memberScheduleMode = "mine";
    state.memberScheduleFullView = false;
  }
  document.body.dataset.activeMemberView = viewId;
  document.body.classList.toggle(
    "purchase-flow-open",
    viewId === "shopView" && Boolean(purchaseFlowState().open),
  );
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  const screenTitles = {
    homeView: "오늘",
    scheduleView: "시간표",
    lessonLogView: "운동일지",
    curriculumView: "커리큘럼",
    shopView: "회원권",
    profileView: "내 정보",
  };
  if ($("#memberScreenTitle")) $("#memberScreenTitle").textContent = screenTitles[viewId] || "Tennis Note";
  renderActiveMemberView(viewId);
  jumpToTop();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  const nextState = { ...historyState, tennisNoteMode: "member", tennisNoteView: viewId };
  delete nextState.tennisNoteModal;
  delete nextState.tennisNoteSheet;
  if (options.pushHistory && historyState.tennisNoteView !== viewId) history.pushState(nextState, "", window.location.href);
  else if (!historyState.tennisNoteView || options.replaceHistory) history.replaceState(nextState, "", window.location.href);
}

function navigateMemberView(viewId) {
  setView(viewId, { pushHistory: true });
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function memberApprovalStatus() {
  return state.member?.status || state.member?.approvalStatus || "active";
}

function isApprovalPending() {
  return ["inactive", "archived"].includes(memberApprovalStatus());
}

function canUseCoachMode() {
  return state.member?.coachApproved === true && !isApprovalPending();
}

function shouldOpenCoachModeByDefault() {
  return canUseCoachMode() && !memberModeOverrideActive();
}

let memberHelpCategory = "all";
let memberHelpQuery = "";

function filteredMemberHelpEntries() {
  const query = memberHelpQuery.trim().toLowerCase();
  return memberHelpEntries.filter((entry) => (
    (memberHelpCategory === "all" || entry.category === memberHelpCategory)
    && (!query || `${entry.question} ${entry.answer}`.toLowerCase().includes(query))
  ));
}

function runMemberHelpAction(action) {
  closeMemberHelpModal();
  window.setTimeout(() => {
    if (action === "schedule" || action === "shop") {
      navigateMemberView(action === "schedule" ? "scheduleView" : "shopView");
      jumpToTop();
      return;
    }
    if (action === "notification") {
      navigateMemberView("profileView");
      $("#pushNotificationButton")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (action === "refresh") {
      $("#memberRefreshButton")?.click();
      return;
    }
    if (action === "support") openKakaoInquiryModal();
  }, 80);
}

function selectedLessonDetail() {
  return memberScheduleOptions().find((lesson) => lesson.id === state.selectedLessonDetailId)
    || memberMakeupDueLessons().find((lesson) => lesson.id === state.selectedLessonDetailId)
    || (state.liveLessons || []).find((lesson) => lesson.id === state.selectedLessonDetailId)
    || null;
}

function selectAvailableSlot(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId && item.status === "available");
  if (!lesson) return;
  const source = currentScheduledLessonsForChange().find((item) => item.id === $("#absenceLesson")?.value);
  if (source?.regularInitialBooking) {
    const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
    const selected = [...state.regularInitialSelections];
    const existingIndex = selected.indexOf(lessonId);
    if (existingIndex >= 0) {
      selected.splice(existingIndex, 1);
    } else {
      const differentCoachSelected = selected.some((id) => {
        const selectedLesson = memberScheduleOptions().find((item) => item.id === id);
        return String(selectedLesson?.coachRoleId || "") !== String(lesson.coachRoleId || "");
      });
      if (differentCoachSelected) selected.splice(0, selected.length);
      if (selected.length >= requiredCount) selected.shift();
      selected.push(lessonId);
    }
    state.regularInitialSelections = selected;
  }
  $("#makeupSlot").value = lesson.id;
  renderAvailableSlots();
  openChangeRequestModal();
}

async function refreshSelectedMemberScheduleWeek() {
  if (state.dataMode !== "live" || !state.member?.profileId) {
    renderSelectedMemberScheduleWeek();
    return false;
  }
  const requestId = ++memberScheduleV2RequestSequence;
  const week = { ...activeMemberWeek() };
  const context = memberScheduleV2Context(state.profile, week);
  memberScheduleV2WorkspaceCache = null;
  state.scheduleV2SyncStatus = "loading";
  state.scheduleV2TargetKey = context.key;
  state.scheduleV2SyncError = "";
  state.scheduleV2SyncErrorCode = "";
  renderSelectedMemberScheduleWeek();
  try {
    const synced = await syncMemberLessonsFromServer(state.profile, { force: true, requestId, week });
    if (requestId !== memberScheduleV2RequestSequence || memberScheduleV2Context().key !== context.key) return false;
    state.scheduleV2SyncStatus = synced ? "ready" : "error";
    if (synced) state.scheduleV2LoadedKey = context.key;
    renderSelectedMemberScheduleWeek();
    if (state.memberScheduleMode === "availability" || !$("#changeRequestModal")?.hidden) {
      const source = currentScheduledLessonsForChange().find((lesson) => (
        lesson.id === (state.selectedMemberChangeSourceId || $("#absenceLesson")?.value)
      ));
      if (synced || source?.couponBooking) await syncMemberChangeCandidates(source);
    }
    saveSnapshot();
    return synced;
  } catch (_error) {
    if (requestId !== memberScheduleV2RequestSequence) return false;
    state.scheduleV2SyncStatus = "error";
    state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
    renderSelectedMemberScheduleWeek();
    const source = currentScheduledLessonsForChange().find((lesson) => (
      lesson.id === (state.selectedMemberChangeSourceId || $("#absenceLesson")?.value)
    ));
    if (source?.couponBooking && (state.memberScheduleMode === "availability" || !$("#changeRequestModal")?.hidden)) {
      await syncMemberChangeCandidates(source);
      renderSelectedMemberScheduleWeek();
    }
    return false;
  }
}

function changeMemberWeek(delta) {
  state.activeMemberWeekIndex = Math.min(
    Math.max((Number(state.activeMemberWeekIndex) || 0) + delta, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  refreshSelectedMemberScheduleWeek();
}

function selectMemberWeekOffset(offset) {
  state.activeMemberWeekIndex = Math.min(
    Math.max(Number(offset) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
}

function changeMemberMonth(delta) {
  const currentStart = new Date(`${activeMemberWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.activeMemberWeekIndex = Math.min(
    Math.max(memberWeekOffsetForDate(target), memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
}

function selectMemberMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeMemberWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.activeMemberWeekIndex = Math.min(
    Math.max(memberWeekOffsetForDate(target), memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
}

function changeMemberScheduleTimeRange(range) {
  state.scheduleTimeRange = range || "lesson";
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
  saveSnapshot();
}

async function prepareChangeRequestSource(preferredLessonId = "") {
  let sources = currentScheduledLessonsForChange();
  let futureLessons = loadedFutureScheduledLessonsForChange();
  const alreadyAvailableSource = sources.find((lesson) => lesson.id === preferredLessonId);
  if (alreadyAvailableSource?.couponBooking) return alreadyAvailableSource.id;
  const hasFalseInitialSource = sources.some((lesson) => lesson.regularInitialBooking) && !futureLessons.length;
  const preferredSourceMissing = Boolean(preferredLessonId) && !sources.some((lesson) => lesson.id === preferredLessonId);
  const workspaceNeedsRefresh = !memberScheduleV2WorkspaceCache?.workspace
    || !state.scheduleV2WorkspaceLoaded
    || activeMemberScheduleLoadState() !== "ready"
    || hasFalseInitialSource
    || preferredSourceMissing;
  if (workspaceNeedsRefresh && state.dataMode === "live" && state.member?.profileId) {
    memberScheduleV2WorkspaceCache = null;
    await syncMemberScheduleV2(state.profile, { force: true });
    sources = currentScheduledLessonsForChange();
    futureLessons = loadedFutureScheduledLessonsForChange();
  }

  const selectedSourceId = preferredLessonId || $("#absenceLesson")?.value || "";
  if (!selectedSourceId) return "";
  const selectedSource = sources.find((lesson) => lesson.id === selectedSourceId);
  if (selectedSource && !selectedSource.regularInitialBooking) return selectedSource.id;

  const preferredFuture = futureLessons.find((lesson) => lesson.id === selectedSourceId);
  const nextFuture = preferredFuture;
  if (!nextFuture) return selectedSource?.id || "";
  return nextFuture.id;
}

function startCouponBooking(ticketId) {
  state.selectedMemberScheduleTicketId = String(ticketId || "");
  const sourceId = `coupon-ticket-${ticketId}`;
  void openMemberChangeTimetable(sourceId);
}

async function changeMemberScheduleMode(mode) {
  state.memberScheduleMode = ["availability", "flex"].includes(mode) ? "availability" : "mine";
  state.memberScheduleModeTouched = true;
  state.memberScheduleFullView = state.memberScheduleMode === "availability";
  if (state.memberScheduleMode === "availability") {
    renderSchedule();
    const preferredSourceId = await prepareChangeRequestSource(state.selectedMemberChangeSourceId);
    const sources = memberInlineChangeSources();
    if (preferredSourceId && sources.some((lesson) => lesson.id === preferredSourceId)) {
      state.selectedMemberChangeSourceId = preferredSourceId;
    }
    if (!sources.some((lesson) => lesson.id === state.selectedMemberChangeSourceId)) {
      state.selectedMemberChangeSourceId = "";
    }
  }
  renderSchedule();
  renderSelects();
  if (state.memberScheduleMode === "availability") {
    const source = memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
    await syncMemberChangeCandidates(source);
  }
  saveSnapshot();
}

async function editMemberChangeRequest(requestId) {
  const request = state.makeupRequests.find((item) => (
    String(item.serverRequestId || item.id || "") === String(requestId || "")
    && item.rawStatus === "pending"
  ));
  if (!request) {
    showToast("수정할 승인 대기 요청을 찾지 못했습니다. 새로고침 후 다시 확인해 주세요.");
    return;
  }
  state.editingChangeRequestId = request.serverRequestId;
  const source = memberScheduleLessons().find((lesson) => (
    isOwnMemberScheduleLesson(lesson)
    && String(lesson.serverLessonId || "") === String(request.lessonId || "")
  ));
  if (!source) {
    state.editingChangeRequestId = "";
    showToast("원래 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.");
    return;
  }
  closeAppModal("requestHistoryModal");
  if ($("#changeReason")) $("#changeReason").value = request.reason || "";
  await openChangeRequestModal(source.id, { editing: true });
}

function identityProfileComplete() {
  const name = normalizeIdentityText(state.profile?.name || "");
  const nickname = normalizeIdentityText(state.profile?.nickname || "");
  const phone = normalizeIdentityPhone(state.profile?.phone || "");
  const birthYear = Number(state.profile?.birthYear) || 0;
  const gender = String(state.profile?.gender || "");
  return Boolean(
    name
      && name !== "가입 확인 중"
      && nickname.length >= 2
      && phone.length >= 10
      && birthYear >= 1900
      && birthYear <= new Date().getFullYear()
      && ["female", "male", "other", "prefer_not"].includes(gender)
      && state.profile?.profileCompletedAt
      && state.profile?.privacyConsentVersion === identityPrivacyVersion,
  );
}

function setNicknameStatus(targetId, message, tone = "") {
  const target = $(`#${targetId}`);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-available", tone === "available");
  target.classList.toggle("is-unavailable", tone === "unavailable");
}

function populateIdentitySetup(user = null) {
  const realName = state.profile.name === "가입 확인 중" ? "" : state.profile.name || "";
  const suggestedNickname = state.profile.nickname || state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  if ($("#identityRealName")) $("#identityRealName").value = realName;
  if ($("#identityNickname")) $("#identityNickname").value = suggestedNickname;
  if ($("#identityPhone")) $("#identityPhone").value = formatIdentityPhone(state.profile.phone || "");
  if ($("#identityBirthYear")) $("#identityBirthYear").value = state.profile.birthYear || state.member?.birthYear || "";
  if ($("#identityNeighborhood")) $("#identityNeighborhood").value = state.profile.neighborhood || state.member?.neighborhood || "";
  if ($("#identityGender")) $("#identityGender").value = state.profile.gender || state.member?.gender || "";
  if ($("#identityTermsConsent")) {
    $("#identityTermsConsent").checked = state.profile.termsConsentVersion === identityTermsVersion;
  }
  if ($("#identityPrivacyConsent")) {
    $("#identityPrivacyConsent").checked = state.profile.privacyConsentVersion === identityPrivacyVersion;
  }
  if ($("#identityMarketingPush")) $("#identityMarketingPush").checked = state.profile.marketingPushConsent === true;
  if ($("#identityMarketingSms")) $("#identityMarketingSms").checked = state.profile.marketingSmsConsent === true;
  if ($("#identityMarketingEmail")) $("#identityMarketingEmail").checked = state.profile.marketingEmailConsent === true;
  setNicknameStatus("identityNicknameStatus", "닉네임은 모든 회원 사이에서 중복될 수 없습니다.");
  if ($("#identitySetupMessage")) $("#identitySetupMessage").textContent = "";
}

function collectNtrpSurvey() {
  const answers = {};
  const scores = ntrpSurveyQuestions.map((question) => {
    const selected = document.querySelector(`input[name="ntrp-${question.id}"]:checked`);
    const score = Number(selected?.value || 2.5);
    answers[question.id] = score;
    return score;
  });
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const rounded = Math.round(average * 2) / 2;
  return { answers, level: String(Math.max(1.5, Math.min(4, rounded)).toFixed(1)), average };
}

function calculateNtrpFromSurvey() {
  const survey = collectNtrpSurvey();
  state.profile.selfNtrp = survey.level;
  state.profile.ntrpSurvey = survey.answers;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  state.ticketHistory.unshift({ text: `질문 기준 내 테니스 수준 ${survey.level} 계산 완료`, tone: "done" });
  renderProfile();
  renderTickets();
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

function bindEvents() {
  bindDelegatedEvents();
  bindAccountEvents();
  bindMakeupEvents();
  bindJournalEvents();
  bindProfileEvents();
  bindScheduleEvents();
  bindHomeEvents();
}

function changePagedList(type, pageIndex) {
  if (type === "lesson") {
    state.lessonLogPage = pageIndex;
    normalizePage("lesson", state.lessonLogs.length);
    renderLessonLogs();
  }
  if (type === "ticket") {
    state.ticketHistoryPage = pageIndex;
    normalizePage("ticket", state.lessonLogs.length);
    renderTickets();
  }
  if (type === "expired") {
    state.expiredTicketPage = pageIndex;
    normalizePage("expired", membershipPassRecords().length);
    renderProducts();
  }
  if (type === "practice") {
    state.practiceLogPage = pageIndex;
    normalizePage("practice", state.practiceLogs.length);
    renderPracticeLogs();
  }
  saveSnapshot();
}

function setMemberSessionRestoring(restoring) {
  const indicator = $("#memberSessionRestoring");
  document.body.classList.toggle("member-session-restoring", restoring);
  if (indicator) indicator.hidden = !restoring;
}

async function retryTransientNetwork(operation, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function activeMemberViewId() {
  return $(".view.is-active")?.id || "homeView";
}

// Keep the first paint and background refresh focused on the screen the member
// can actually see. The remaining screens are rendered when their menu opens.
let memberLiveScheduleRefreshTimer = 0;
let memberLiveScheduleRefreshInFlight = false;
let memberLiveScheduleRefreshQueued = false;
let memberLiveScheduleLastRefreshAt = 0;
let memberConnectivityHideTimer = 0;
let memberScheduleRevisionWatcher = null;
function installMemberLiveScheduleRefresh() {
  if (memberLiveScheduleRefreshTimer) return;
  const refresh = () => refreshMemberLiveSchedule().catch(() => false);
  const forceRefresh = () => refreshMemberLiveSchedule({ force: true }).catch(() => false);
  window.addEventListener("focus", forceRefresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) forceRefresh();
  });
  memberLiveScheduleRefreshTimer = window.setInterval(refresh, 60_000);
}

function memberRevisionBranchId() {
  const currentBranchId = currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId;
  if (currentBranchId) return currentBranchId;
  return [...(state.liveTickets || [])]
    .filter((ticket) => ticket.branchId)
    .sort((left, right) => String(right.expiresOn || "").localeCompare(String(left.expiresOn || "")))[0]
    ?.branchId || "";
}

function installMemberScheduleRevisionWatcher() {
  if (memberScheduleRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  memberScheduleRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: memberRevisionBranchId,
    active: () => !$("#appScreen")?.hidden,
    onChange: async () => {
      memberScheduleV2WorkspaceCache = null;
      memberLiveScheduleLastRefreshAt = 0;
      await refreshMemberLiveSchedule({ force: true, render: true });
    },
  });
}

function installMemberConnectivityStatus() {
  renderMemberConnectivityStatus(false);
  window.addEventListener("offline", () => renderMemberConnectivityStatus(false));
  window.addEventListener("online", () => {
    memberScheduleV2WorkspaceCache = null;
    memberLiveScheduleLastRefreshAt = 0;
    void refreshMemberLiveSchedule({ force: true, render: true }).finally(() => {
      renderMemberConnectivityStatus(true);
    });
  });
}

async function initApp() {
  registerPwaServiceWorker();
  void refreshMemberRuntimeDiagnostics();
  registerPwaInstallPrompt();
  purgeLegacyDemoStorage();
  restoreSnapshot();
  bindEvents();
  installOAuthReturnStatusReset();
  void installNativeBackNavigation();
  installMemberConnectivityStatus();
  installMemberLiveScheduleRefresh();
  installMemberScheduleRevisionWatcher();
  renderActiveMemberView();
  const client = window.TennisNoteDataClient;
  const hasStoredSession = Boolean(client?.getSession?.()?.access_token);
  const oauthReturnPending = Boolean(
    new URLSearchParams(window.location.search || "").get("code")
    || new URLSearchParams(window.location.search || "").get("error")
    || window.location.hash.includes("access_token=")
  );
  const isModeTransition = Boolean(sessionStorage.getItem("tennis-note-member-mode-transition"));
  sessionStorage.removeItem("tennis-note-member-mode-transition");
  const canOpenRestoredMember = Boolean(hasStoredSession && state.member);
  if (canOpenRestoredMember) {
    openAppFromSession(false);
    setMemberSessionRestoring(false);
  } else {
    setMemberSessionRestoring(hasStoredSession || isModeTransition || oauthReturnPending);
  }
  hideBrandSplash();

  if (openLocalCurriculumPreview()) {
    setMemberSessionRestoring(false);
    return;
  }

  // These improve data freshness but must not delay opening the member screen.
  void (async () => {
    await syncLiveSchedulePolicy(currentLiveTicket()?.branchId || "");
    renderActiveMemberView();
  })().catch(() => {});
  void syncAppleLoginAvailability();
  let openedFromSupabase = false;
  try {
    openedFromSupabase = await applySupabaseMemberSession(true);
  } catch (error) {
    const status = $("#memberEmailLoginStatus");
    if (status && isTransientNetworkError(error)) status.textContent = identityErrorMessage(error);
  }
  setMemberSessionRestoring(false);
  if (coachModeNavigationStarted) return;
  await handlePaymentRedirectResult();
  if (!openedFromSupabase && state.member) {
    const needsRealSession = client?.readiness?.().ready;
    const hasRealSession = Boolean(client?.getSession?.()?.access_token);
    if (needsRealSession && !hasRealSession) {
      state.member = null;
      state.coachModeAllowed = false;
      updateCoachModeAccess();
      saveSnapshot();
      $("#loginScreen").hidden = false;
      return;
    }
    markTicketSyncLoginNeeded();
    openAppFromSession(true);
    renderAll();
  } else if (!openedFromSupabase) {
    $("#appScreen").hidden = true;
    $("#loginScreen").hidden = false;
  }
}

window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__ = Object.freeze({
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.371",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-member-runtime-version",
  window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__.version,
);
void initApp();
