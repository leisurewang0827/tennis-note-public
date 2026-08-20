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
const brandSplashMinimumDuration = 150;
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

function showToast(message) {
  let toast = document.querySelector("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = String(message || "");
  toast.classList.add("is-visible");
  window.clearTimeout(appToastTimer);
  appToastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function hideBrandSplash() {
  window.__tennisNoteBootReady?.();
  const splash = document.querySelector("#brandSplash");
  if (!splash) return;
  const elapsed = performance.now() - brandSplashStartedAt;
  const delay = Math.max(0, brandSplashMinimumDuration - elapsed);
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
    }, 240);
  }, delay);
}

const days = ["월", "화", "수", "목", "금", "토", "일"];
const times = makeMemberTimeRange("18:40", "21:20");
const listPageSize = 5;
const memberScheduleCoachLaneWidth = 64;
const journalMediaBucket = "tennisnote-journal-media";
const serverJournalSchema = "tennisnote-mobile-journal-v1";
const memberEnrollmentFormVersion = "2026-07-15-v1";
const identityTermsVersion = "2026-08-13-v1";
const identityPrivacyVersion = "2026-07-19-v2";
const memberEnrollmentLegacyDefaults = {
  lessonGoal: "미수집",
  preferredSchedule: "시간표에서 선택",
};

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

const memberScheduleMinWeekOffset = -104;
const memberScheduleMaxWeekOffset = 156;
const memberScheduleWorkspaceDays = 31;

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

const paymentConfigKey = "tennis-note-payment-config";
const adminStorageKey = "tennis-note-admin-demo-v1";
const liveSchedulePolicyKey = "app_schedule_policy";
const holdingPolicyKey = "holding_policy";

function readAdminProducts() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    const source = snapshot?.membershipProducts || snapshot?.membershipProductDrafts;
    if (!Array.isArray(source) || !source.length) return [];
    return source
      .map((product) => normalizeProduct(product, defaultProducts.find((item) => item.id === product.id)));
  } catch {
    return [];
  }
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

const membershipFilterDefinitions = [
  {
    key: "scheduleScope",
    label: "이용 요일",
    options: [
      ["all", "전체"],
      ["weekday", "평일"],
      ["weekend", "주말"],
      ["mixed", "혼합"],
    ],
  },
  {
    key: "productKind",
    label: "회원권",
    options: [
      ["all", "전체"],
      ["regular", "정규권"],
      ["coupon", "쿠폰제"],
      ["consult", "상담"],
    ],
  },
  {
    key: "groupSize",
    label: "수업",
    options: [
      ["all", "전체"],
      ["1", "1대1"],
      ["2", "2대1"],
    ],
  },
  {
    key: "lessonMinutes",
    label: "시간",
    options: [
      ["all", "전체"],
      ["20", "20분"],
      ["30", "30분"],
      ["40", "40분"],
    ],
  },
];

const membershipPresetDefinitions = [
  {
    id: "four-week",
    label: "4주",
    description: "가볍게 시작·재등록",
    filters: { scheduleScope: "all", productKind: "regular", groupSize: "all", lessonMinutes: "all" },
  },
  {
    id: "three-month",
    label: "3개월 10% 할인",
    description: "12주 등록·보강 21일",
    filters: { scheduleScope: "all", productKind: "regular", groupSize: "all", lessonMinutes: "all" },
  },
  {
    id: "coupon",
    label: "쿠폰 레슨",
    description: "담당 코치의 빈 시간 예약",
    filters: { scheduleScope: "all", productKind: "coupon", groupSize: "1", lessonMinutes: "all" },
  },
  {
    id: "one-day",
    label: "원데이 1회",
    description: "한 번 체험·단회 레슨",
    filters: { scheduleScope: "mixed", productKind: "coupon", groupSize: "1", lessonMinutes: "all" },
  },
];

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

const registrationFlows = [
  { title: "운동노트 회원", detail: "간편 로그인만 하면 회원권 없이도 운동 기록을 바로 남길 수 있습니다.", steps: ["간편 로그인", "운동 기록", "사진·영상", "계속 이용"] },
  { title: "첫 회원권 구매", detail: "처음 유료 레슨을 구매할 때만 수강 가입서를 작성하고 결제로 이어집니다.", steps: ["회원권 선택", "수강 가입서", "결제", "수강 시작"] },
  { title: "재등록", detail: "현재 가입서가 유효한 회원은 다시 작성하지 않고 기존 시간과 회원권을 연장합니다.", steps: ["잔여 2회 알림", "기존 시간 보호", "결제", "연장"] },
  { title: "2대1 공동관리", detail: "한 명이 가입서와 결제를 진행해도 파트너 일정이 함께 연결됩니다.", steps: ["파트너 입력", "공동 시간표", "대표 결제", "앱 추가 연결"] },
];

const legacyCurriculumSteps = [
  {
    id: "FH-01",
    title: "포핸드 연결 안정화",
    focus: "라켓면 고정, 전진 스텝, 짧은 공 처리",
    next: "다음 수업은 짧은 공 접근 후 크로스 방향 컨트롤을 진행합니다.",
    notionSource: "Notion · 입문/초급 포핸드 DB",
    notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed",
  },
  {
    id: "FT-02",
    title: "풋워크와 회복 스텝",
    focus: "첫 발 반응, 중심 회복, 다음 공 준비",
    next: "다음 수업 전에는 타구 후 제자리 회복을 영상으로 확인합니다.",
    notionSource: "Notion · 풋워크/기초 움직임 DB",
    notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7",
  },
  {
    id: "BH-R1",
    title: "백핸드 리턴 준비",
    focus: "스플릿 스텝, 어깨 회전, 임팩트 전 준비",
    next: "다음 수업은 백핸드 리턴 타이밍과 낮은 공 처리를 진행합니다.",
    notionSource: "Notion · 리턴/백핸드 DB",
    notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8",
  },
];

const legacyCurriculumSkillTracks = [
  {
    title: "포핸드",
    summary: "가장 많이 쓰는 스트로크라 입문 이후에도 방향, 깊이, 전술 전환으로 계속 확장합니다.",
    currentLevel: "초급",
    progress: "4/8",
    activeStepId: "FH-01",
    steps: [
      { level: "입문", id: "FH-01", title: "제자리 컨트롤", goal: "느린 공을 안정적으로 넘기기", practice: "라켓면 고정, 리듬 만들기", completion: "10구 이상 랠리 연결", notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed" },
      { level: "초급", id: "FH-C01", title: "크로스 기본 코스", goal: "크로스 방향으로 안정적인 랠리", practice: "대각선 감각, 타점 유지", completion: "크로스 8구 이상 연결", notionUrl: "https://app.notion.com/p/305b107df4808088b673df964a164020" },
      { level: "중급", id: "FH-T03", title: "공격 전환", goal: "짧은 공을 보고 앞으로 들어가기", practice: "어프로치, 마무리 스윙", completion: "짧은 공 처리 후 회복", notionUrl: "https://app.notion.com/p/317b107df48080afa274f62eecce42a7" },
    ],
  },
  {
    title: "백핸드",
    summary: "포핸드보다 늦게 올라오는 경우가 많아 별도 단계로 천천히 추적합니다.",
    currentLevel: "입문",
    progress: "2/6",
    activeStepId: "BH-R1",
    steps: [
      { level: "입문", id: "BH-01", title: "기본 준비 자세", goal: "백핸드 준비와 라켓면 안정", practice: "어깨 회전, 짧은 스윙", completion: "천천히 오는 공 넘기기", notionUrl: "https://app.notion.com/p/38ab107df480817cbeb6f953d1d24d9d" },
      { level: "입문", id: "BH-R1", title: "전진 타점 적용", goal: "백핸드 준비와 임팩트 안정", practice: "스플릿 스텝, 어깨 회전", completion: "느린 리턴 랠리 시작", notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8" },
      { level: "초급", id: "BH-02", title: "짧은 스윙 연결", goal: "백핸드 랠리 연결", practice: "짧은 스윙, 회복 스텝", completion: "백핸드 6구 이상 연결", notionUrl: "https://app.notion.com/p/38ab107df48081a9bab8db0ecc082980" },
    ],
  },
  {
    title: "풋워크",
    summary: "기술을 잘 쳐도 움직임이 늦으면 무너지기 때문에 별도 진행도로 봅니다.",
    currentLevel: "입문",
    progress: "3/5",
    activeStepId: "ST-01",
    steps: [
      { level: "입문", id: "ST-01", title: "풋워크 입문", goal: "첫 발과 준비 자세 만들기", practice: "스플릿 스텝, 레디 포지션", completion: "타구 후 제자리 회복", notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7" },
      { level: "입문", id: "ST-PHOTO", title: "레디 포지션", goal: "기본 준비 자세 확인", practice: "정면/측면 자세 체크", completion: "상체와 라켓 위치 안정", notionUrl: "https://app.notion.com/p/38ab107df4808179ac38c384f5d6ba8d" },
      { level: "초급", id: "ST-VIDEO", title: "스플릿 스텝 기본", goal: "공 없이 첫 발 반응 만들기", practice: "스플릿 스텝, 첫 발", completion: "5회 반복 촬영 확인", notionUrl: "https://app.notion.com/p/38ab107df480817fbcb4fdd7f2da8d91" },
    ],
  },
  {
    title: "발리/네트플레이",
    summary: "처음부터 많이 하지 않아도, 게임을 시작하면 따로 열리는 기술 영역입니다.",
    currentLevel: "시작 전",
    progress: "0/5",
    activeStepId: "",
    steps: [
      { level: "입문", id: "NV-01", title: "네트플레이 이해", goal: "네트 앞 역할 이해", practice: "기본 위치, 라켓면", completion: "네트 앞 준비 자세 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
      { level: "입문", id: "NV-02", title: "기본 발리 안정", goal: "짧은 동작으로 공 막기", practice: "포핸드/백핸드 발리", completion: "느린 발리 연결", notionUrl: "https://app.notion.com/p/317b107df48080b3a731d449f1690f97" },
      { level: "초급", id: "NV-03", title: "어프로치 & 첫 발리", goal: "앞으로 들어가 첫 발리 연결", practice: "어프로치, 파트너 위치 확인", completion: "첫 발리 후 다음 공 준비", notionUrl: "https://app.notion.com/p/317b107df48081959b99c3cf91fb4f23" },
    ],
  },
  {
    title: "서브/리턴",
    summary: "실내 수업에서는 가볍게 보고, 야외 게임으로 이어질 때 확장합니다.",
    currentLevel: "입문",
    progress: "1/4",
    activeStepId: "SV-01",
    steps: [
      { level: "입문", id: "SV-01", title: "서브 기본 루틴", goal: "토스와 리듬 안정", practice: "토스 위치, 임팩트 밸런스", completion: "세컨드 서브 안정", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
      { level: "입문", id: "RT-01", title: "리턴 첫 발", goal: "서브에 맞춰 빠르게 준비", practice: "스플릿 스텝, 블록 리턴", completion: "느린 서브 리턴 성공", notionUrl: "https://app.notion.com/p/317b107df480808989b8c5588935e05f" },
      { level: "초급", id: "SV-R1", title: "서브 후 첫 공 준비", goal: "서브 뒤 멈추지 않기", practice: "착지 후 스플릿 스텝", completion: "첫 공 준비 자세 유지", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
    ],
  },
  {
    title: "게임 운영/복식",
    summary: "기술이 어느 정도 연결되면 포인트 흐름과 복식 위치를 따로 관리합니다.",
    currentLevel: "시작 전",
    progress: "0/6",
    activeStepId: "",
    steps: [
      { level: "입문", id: "GM-01", title: "성장 로드맵", goal: "지금 필요한 기술 찾기", practice: "목표별 커리큘럼 선택", completion: "다음 목표 설명 가능", notionUrl: "https://app.notion.com/p/317b107df480803baf48c4b5e18b2573" },
      { level: "초급", id: "TC-01", title: "중립 → 공격", goal: "유리한 공에서 공격 전환", practice: "크로스 후 다운더라인", completion: "패턴 3구 연결", notionUrl: "https://app.notion.com/p/317b107df48080aab3b9ca696dd655e6" },
      { level: "중급", id: "DB-01", title: "복식 기본 위치", goal: "전위/후위 역할 이해", practice: "자리 전환, 커버 범위", completion: "기본 포지션 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
    ],
  },
];

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

const storageKey = "tennis-note-member-live-v1";
const sharedStorageKey = "tennis-note-shared-live-v1";
const appModePreferenceKey = "tennis-note-app-mode";
const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];
let coachModeNavigationStarted = false;

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") console.warn("임시 저장 실패", error);
    return false;
  }
}

function purgeLegacyDemoStorage() {
  legacyDemoStorageKeys.forEach((key) => localStorage.removeItem(key));
}
const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";

const ntrpReferences = [
  {
    id: "poster",
    title: "내가 만든 NTRP 포스터",
    detail: "테니스클럽하우스 NTRP 테니스 자가 레벨 측정 포스터 기준",
    image: "./assets/ntrp-poster.jpg",
    path: "C:\\Users\\user\\Documents\\자료정리\\다이너스티주식회사\\테니스클럽하우스\\커리큘럼\\2024-03-26_테니스클럽하우스_NTRP_테니스게임레벨_안내.jpg",
  },
  {
    id: "usta",
    title: "USTA 공식 NTRP 기준",
    detail: "공식 기준은 길어서 앱에서는 1.5~4.0 핵심만 가볍게 요약합니다.",
    url: "https://www.usta.com/content/dam/usta/pdfs/10013_experience_player_ntrp_characteristics1%20%282%29.pdf",
  },
];

const ntrpQuickLevels = [
  { level: "1.5", label: "입문", detail: "스트로크를 배우는 중" },
  { level: "2.0", label: "초급", detail: "타점과 위치 선정이 아직 불안정" },
  { level: "2.5", label: "초급+", detail: "느린 랠리와 기본 게임 가능" },
  { level: "3.0", label: "중급 입문", detail: "중간 속도 랠리 가능, 조절은 불안정" },
  { level: "3.5", label: "중급", detail: "방향 조절과 전술 시도" },
  { level: "4.0", label: "상급 입문", detail: "안정적 경기 운영 가능" },
];

const ntrpSurveyQuestions = [
  {
    id: "rally",
    title: "베이스라인 랠리 유지",
    options: [
      { score: 1.5, label: "아직 공을 넘기는 것 자체를 연습 중" },
      { score: 2.0, label: "천천히 치면 몇 번은 넘기지만 타점이 자주 흔들림" },
      { score: 2.5, label: "비슷한 수준과 베이스라인 랠리를 천천히 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 랠리를 이어가지만 깊이/방향/속도 조절은 불안정" },
      { score: 3.5, label: "랠리가 가능하고 방향 조절을 시도할 수 있음" },
      { score: 4.0, label: "대부분의 샷이 안정적이고 방향/길이 조절이 가능" },
    ],
  },
  {
    id: "forehand",
    title: "포핸드 안정성",
    options: [
      { score: 1.5, label: "공을 맞혀 넘기는 것을 연습 중" },
      { score: 2.0, label: "폼은 배우고 있지만 방향과 타점이 자주 흔들림" },
      { score: 2.5, label: "천천히 오는 공은 포핸드로 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 공을 비교적 꾸준히 치지만 깊이/방향 조절은 부족" },
      { score: 3.5, label: "포핸드 방향 조절과 공격 전환을 시도할 수 있음" },
      { score: 4.0, label: "포핸드로 깊이, 방향, 속도 조절이 가능하고 기회볼을 만들 수 있음" },
    ],
  },
  {
    id: "backhand",
    title: "백핸드 안정성",
    options: [
      { score: 1.5, label: "백핸드 자세를 배우는 중" },
      { score: 2.0, label: "백핸드를 피하거나 라켓면이 자주 열림" },
      { score: 2.5, label: "천천히 오는 공은 백핸드로 넘길 수 있음" },
      { score: 3.0, label: "중간 속도 백핸드 랠리가 가능하지만 공격/방향 조절은 불안정" },
      { score: 3.5, label: "백핸드 크로스와 다운더라인을 구분해 시도할 수 있음" },
      { score: 4.0, label: "백핸드에서도 깊이와 방향 조절이 가능하고 수비에서 회복할 수 있음" },
    ],
  },
  {
    id: "serve",
    title: "서브",
    options: [
      { score: 1.5, label: "서브 동작을 배우는 중" },
      { score: 2.0, label: "토스와 임팩트가 일정하지 않음" },
      { score: 2.5, label: "천천히 넣는 서브는 가능하지만 세컨서브가 불안함" },
      { score: 3.0, label: "서브를 넣고 랠리를 시작할 수 있음" },
      { score: 3.5, label: "서브 방향과 첫 볼 연결을 의식함" },
      { score: 4.0, label: "안정적인 세컨서브와 포인트 시작 능력이 있음" },
    ],
  },
  {
    id: "return",
    title: "리턴",
    options: [
      { score: 1.5, label: "서브를 받아 넘기는 감각을 배우는 중" },
      { score: 2.0, label: "느린 서브는 받아보지만 준비가 늦고 실수가 많음" },
      { score: 2.5, label: "느린 서브를 리턴해서 랠리를 시작할 수 있음" },
      { score: 3.0, label: "중간 속도 서브 리턴은 가능하지만 방향 조절이 부족" },
      { score: 3.5, label: "리턴 방향을 선택하고 다음 공 준비를 의식함" },
      { score: 4.0, label: "상대 서브에 따라 블록/공격 리턴을 구분할 수 있음" },
    ],
  },
  {
    id: "net",
    title: "네트플레이와 발리",
    options: [
      { score: 1.5, label: "네트 앞 플레이가 아직 낯섦" },
      { score: 2.0, label: "발리 자세를 배우지만 공이 뜨거나 라켓면이 흔들림" },
      { score: 2.5, label: "쉬운 발리는 넘길 수 있지만 위치 선정이 부족" },
      { score: 3.0, label: "발리 시도는 가능하지만 낮은 공/빠른 공에 약함" },
      { score: 3.5, label: "어프로치 후 발리, 로브 대응을 시도할 수 있음" },
      { score: 4.0, label: "발리, 로브, 오버헤드를 상황에 맞게 사용할 수 있음" },
    ],
  },
  {
    id: "game",
    title: "경기 이해",
    options: [
      { score: 1.5, label: "룰과 위치를 배우는 중" },
      { score: 2.0, label: "단식/복식 위치 선정이 아직 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임을 시도할 수 있음" },
      { score: 3.0, label: "복식에서 전위/후위 위치를 이해하고 포인트를 진행함" },
      { score: 3.5, label: "기회볼, 로브, 어프로치 등 선택을 시작함" },
      { score: 4.0, label: "포인트 패턴과 약점 공략을 생각하며 경기함" },
    ],
  },
  {
    id: "movement",
    title: "움직임과 회복",
    options: [
      { score: 1.5, label: "공 위치를 따라가는 감각을 잡는 중" },
      { score: 2.0, label: "공에 늦게 도착하거나 준비 동작이 자주 늦음" },
      { score: 2.5, label: "천천히 오는 공은 준비해서 칠 수 있음" },
      { score: 3.0, label: "중간 속도 공에 반응하지만 회복 스텝이 자주 늦음" },
      { score: 3.5, label: "타구 후 다음 위치로 회복하려고 움직임" },
      { score: 4.0, label: "코트 포지션을 선택하고 다음 공을 준비함" },
    ],
  },
  {
    id: "control",
    title: "방향/깊이/속도 조절",
    options: [
      { score: 1.5, label: "공을 코트 안에 넣는 것이 우선" },
      { score: 2.0, label: "방향을 의도해도 결과가 자주 벗어남" },
      { score: 2.5, label: "천천히 치면 코스 선택을 조금 시도할 수 있음" },
      { score: 3.0, label: "중간 속도에서 방향/깊이/속도 조절이 아직 일정하지 않음" },
      { score: 3.5, label: "방향 조절과 깊이 조절을 의식적으로 시도함" },
      { score: 4.0, label: "상황에 따라 깊이, 방향, 속도를 바꿔 포인트를 만들 수 있음" },
    ],
  },
  {
    id: "doubles",
    title: "복식 위치와 팀플레이",
    options: [
      { score: 1.5, label: "복식 위치와 룰이 아직 어렵다" },
      { score: 2.0, label: "단식/복식 기본 위치 선정이 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임에 참여할 수 있음" },
      { score: 3.0, label: "전위/후위 역할을 이해하고 한 명 앞, 한 명 뒤 형태로 플레이함" },
      { score: 3.5, label: "포칭, 로브 커버, 파트너 위치를 조금씩 의식함" },
      { score: 4.0, label: "팀플레이가 보이고 찬스볼 마무리와 수비 전환이 가능함" },
    ],
  },
];

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: shared.lessonLogs || [],
      feedbackRequests: shared.feedbackRequests || [],
      ntrpRequests: shared.ntrpRequests || [],
      paymentRequests: shared.paymentRequests || [],
      makeupRequests: shared.makeupRequests || [],
      holdingRequests: shared.holdingRequests || [],
      notices: shared.notices || [],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    localStorage.removeItem(sharedStorageKey);
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], paymentRequests: [], makeupRequests: [], holdingRequests: [], notices: [], noticeSource: "" };
  }
}

async function syncLiveNotices() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_notice_popups", {
      select: "id,title,body,audience,priority,status,starts_on,ends_on,show_once_per_day,display_order,image_url,image_alt,action_label,action_url,created_at,updated_at",
      limit: 100,
    });
    const notices = (rows || [])
      .map((row) => noticeRowToAppNotice(row))
      .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const shared = loadSharedData();
    if (!notices.length) {
      shared.notices = [];
      shared.noticeSource = "server";
      saveSharedData(shared);
      return true;
    }
    shared.notices = notices.slice(0, 100);
    shared.noticeSource = "server";
    saveSharedData(shared);
    return true;
  } catch (error) {
    return false;
  }
}

async function syncMemberNotificationsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_notifications", {
      select: "id,user_id,channel,template_key,title,body,payload,scheduled_at,sent_at,status,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const notifications = (rows || [])
      .filter((row) => row.channel === "app")
      .map((row) => normalizeLiveNotification(row))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const previousKey = state.lastLiveNotificationKey;
    state.liveNotifications = notifications;
    const latest = notifications[0];
    const latestKey = latest ? `${latest.id}:${latest.status}` : "";
    if (latest && latestKey !== state.lastLiveNotificationKey) {
      state.lastLiveNotificationKey = latestKey;
      state.ticketHistory.unshift({ text: `${latest.title} · ${latest.body}`, tone: latest.tone });
    }
    return {
      ok: true,
      newNotification: previousKey && latest && latestKey !== previousKey ? latest : null,
    };
  } catch {
    return false;
  }
}

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

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) return;
    if (snapshot.state) Object.assign(state, snapshot.state);
    if (Array.isArray(snapshot.lessons)) lessons.splice(0, lessons.length, ...snapshot.lessons);
    const visibleLessons = lessons.filter((lesson) => !["무인", "볼머신"].some((word) => `${lesson.coach} ${lesson.type}`.includes(word)));
    lessons.splice(0, lessons.length, ...visibleLessons);
    state.lessonLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    state.practiceLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    if (!Array.isArray(state.expiredTickets)) state.expiredTickets = [];
    if (!Array.isArray(state.liveMembershipProducts)) state.liveMembershipProducts = [];
    if (!state.livePaymentOptions || typeof state.livePaymentOptions !== "object") {
      state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, features: { threeMonth: true, oneDay: true, coupons: true } };
    }
    state.livePaymentOptions.allowedMethods = paymentMethodIdList(state.livePaymentOptions.allowedMethods || ["tosspay"]);
    state.livePaymentOptions.bankTransferEnabled = state.livePaymentOptions.bankTransferEnabled === true;
    if (!Array.isArray(state.livePaymentOptions.paymentMethods)) state.livePaymentOptions.paymentMethods = [];
    state.livePaymentOptions.settingsVersion = Math.max(0, Number(state.livePaymentOptions.settingsVersion) || 0);
    state.livePaymentOptions.features = { threeMonth: true, oneDay: true, coupons: true, ...(state.livePaymentOptions.features || {}) };
    if (!Array.isArray(state.discountCoupons)) state.discountCoupons = [];
    state.membershipPricingQuotes = {};
    if (!Array.isArray(state.liveTickets)) state.liveTickets = [];
    if (!state.memberEnrollment || typeof state.memberEnrollment !== "object") state.memberEnrollment = null;
    state.pendingPurchaseProductId = String(state.pendingPurchaseProductId || "");
    state.purchaseFlow = {
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
      ...(state.purchaseFlow && typeof state.purchaseFlow === "object" ? state.purchaseFlow : {}),
    };
    state.purchaseFlow.step = Math.min(4, Math.max(1, Number(state.purchaseFlow.step) || 1));
    if (!Array.isArray(state.purchaseFlow.preferredSchedules)) state.purchaseFlow.preferredSchedules = [];
    if (["weekday-coupon", "weekend-coupon"].includes(state.purchaseFlow.familyId)) state.purchaseFlow.familyId = "coupon";
    if (["weekday-coupon", "weekend-coupon"].includes(state.membershipSelectedFamilyId)) state.membershipSelectedFamilyId = "coupon";
    state.selectedLessonDetailId = String(state.selectedLessonDetailId || "");
    if (!["card", "tosspay", "bank_transfer", "naverpay", "kakaopay"].includes(state.selectedPaymentMethod)) state.selectedPaymentMethod = "tosspay";
    state.selectedPaymentMethod = normalizeSelectedPaymentMethod();
    if (!state.pushNotifications || typeof state.pushNotifications !== "object") {
      state.pushNotifications = {
        permission: "unknown",
        status: "checking",
        detail: "수업 일정과 회원권 만료를 알려드립니다.",
      };
    }
    if (!state.ticketSyncStatus || typeof state.ticketSyncStatus !== "object") {
      state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
    }
    if (state.pendingPaymentCheckStatus && typeof state.pendingPaymentCheckStatus !== "object") {
      state.pendingPaymentCheckStatus = null;
    }
    state.lastLiveTicketKey = state.lastLiveTicketKey || "";
    state.lastReadFeedbackId = String(state.lastReadFeedbackId || "");
    state.lessonLogPage = Number(state.lessonLogPage) || 0;
    state.ticketHistoryPage = Number(state.ticketHistoryPage) || 0;
    state.expiredTicketPage = Number(state.expiredTicketPage) || 0;
    state.practiceLogPage = Number(state.practiceLogPage) || 0;
    syncConfirmationsFromCoach();
    syncPracticeFeedbackFromCoach();
  } catch {
    localStorage.removeItem(storageKey);
  }
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

function saveSnapshot() {
  const serialized = JSON.stringify({ state, lessons }, (key, value) => {
    if (key === "photoDataUrl" && typeof value === "string" && value.startsWith("data:")) return "";
    if (key === "url" && typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"))) return "";
    return value;
  });
  if (safeLocalStorageSet(storageKey, serialized)) return;
  localStorage.removeItem(storageKey);
  const compact = {
    state: {
      dataMode: state.dataMode,
      member: state.member,
      profile: { ...state.profile, photoDataUrl: "" },
      coachModeAllowed: state.coachModeAllowed,
      selectedPaymentMethod: state.selectedPaymentMethod,
      pendingPurchaseProductId: state.pendingPurchaseProductId,
      purchaseFlow: state.purchaseFlow,
    },
    lessons: [],
  };
  safeLocalStorageSet(storageKey, JSON.stringify(compact));
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

function updatePwaInstallButtons() {
  const canInstall = Boolean(deferredPwaInstallPrompt) && !isStandalonePwa();
  $$("[data-install-pwa]").forEach((button) => {
    button.hidden = !canInstall;
  });
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

const pushDeviceStorageKey = "tennis-note-push-device-id";
const pushPreferenceStorageKey = "tennis-note-push-enabled-v1";
const pushPrimerDeferredStorageKey = "tennis-note-push-primer-deferred-at-v1";
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

const bankNotificationDeviceStorageKey = "tennis-note-bank-notification-device-v1";
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

function bankNotificationDevicePublicId() {
  let value = String(localStorage.getItem(bankNotificationDeviceStorageKey) || "").trim();
  if (value.length >= 16) return value;
  value = `tn-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  localStorage.setItem(bankNotificationDeviceStorageKey, value);
  return value;
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

async function connectBankNotificationBridge() {
  if (!bankNotificationAdminAllowed()) return;
  const client = window.TennisNoteDataClient;
  const plugin = nativeBankNotificationBridgePlugin();
  if (!client?.invokeFunction || !client.getSession?.()?.access_token || !plugin?.getStatus) {
    showToast("관리자 로그인과 Android 앱 연결을 확인해 주세요.");
    return;
  }
  const currentStatus = await plugin.getStatus().catch(() => ({}));
  const repairRequired = currentStatus.repairRequired === true
    || currentStatus.remoteDisabled === true
    || String(currentStatus.lastError || "").includes("repair_required")
    || String(currentStatus.lastError || "").includes("feature_disabled")
    || String(currentStatus.lastError || "").includes("device_unauthorized");
  if (currentStatus.configured === true && currentStatus.permissionGranted !== true && !repairRequired) {
    await plugin.openNotificationAccessSettings?.();
    await refreshBankNotificationBridge();
    return;
  }
  if (currentStatus.configured === true && currentStatus.permissionGranted === true && !repairRequired) {
    await plugin.flush?.();
    await refreshBankNotificationBridge();
    showToast("입금 알림 연결 상태를 확인했습니다.");
    return;
  }
  const branchId = String(currentLiveTicket()?.branchId || "");
  try {
    const paired = await client.invokeFunction("portone-payment/bank-notification-pair", {
      body: {
        ...(branchId ? { branchId } : {}),
        devicePublicId: bankNotificationDevicePublicId(),
        deviceName: `관리자 Android ${memberNativeAppInfo?.version || ""}`.trim(),
      },
    });
    await plugin.configure({
      branchId: paired.branchId,
      deviceToken: paired.deviceToken,
      ingestUrl: paired.ingestUrl,
      heartbeatUrl: paired.heartbeatUrl,
      allowedPackages: paired.allowedPackages || [],
      accountRevision: Number(paired.accountRevision || 1),
    });
    await plugin.flush?.();
    bankNotificationBridgeState = await plugin.getStatus();
    renderBankNotificationBridge();
    if (bankNotificationBridgeState.permissionGranted !== true) {
      await plugin.openNotificationAccessSettings?.();
      showToast("알림 접근에서 Tennis Note를 허용한 뒤 앱으로 돌아와 주세요.");
    } else showToast("이 기기의 입금 알림을 연결했습니다.");
  } catch (error) {
    const code = error?.payload?.code || error?.message || "pair_failed";
    const messages = {
      bank_notification_feature_disabled: "관리자 웹에서 Android 입금 알림 확인을 먼저 켜 주세요.",
      bank_transfer_account_not_ready: "관리자 웹에서 사용할 입금 계좌를 먼저 저장해 주세요.",
      bank_notification_bank_not_supported: "현재 우리은행과 카카오뱅크 알림만 연결할 수 있습니다.",
    };
    showToast(messages[code] || `입금 알림 연결 실패: ${code}`);
    await refreshBankNotificationBridge();
  }
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

function installOAuthReturnStatusReset() {
  const reset = () => {
    window.setTimeout(() => {
      const status = $("#memberEmailLoginStatus");
      if (
        document.hidden
        || !status?.textContent.includes("로그인 화면을 여는 중")
        || !$("#appScreen")?.hidden
        || window.location.hash.includes("access_token=")
        || window.TennisNoteDataClient?.getSession?.()?.access_token
      ) return;
      status.textContent = "로그인이 취소되었습니다. 다시 로그인 수단을 선택해주세요.";
    }, 500);
  };
  window.addEventListener("focus", reset);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reset();
  });
}

function currentPushDeviceId() {
  let deviceId = localStorage.getItem(pushDeviceStorageKey) || "";
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeLocalStorageSet(pushDeviceStorageKey, deviceId);
  }
  return deviceId;
}

function pushPreferenceEnabled() {
  return localStorage.getItem(pushPreferenceStorageKey) !== "false";
}

function setPushNotificationState(permission, status, detail) {
  state.pushNotifications = { permission, status, detail };
  renderPushNotificationSettings();
  saveSnapshot();
}

function pushPrimerWasRecentlyDeferred() {
  const deferredAt = Number(localStorage.getItem(pushPrimerDeferredStorageKey) || 0);
  return deferredAt > 0 && Date.now() - deferredAt < 7 * 24 * 60 * 60 * 1000;
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

function deferNativePushPrimer() {
  safeLocalStorageSet(pushPrimerDeferredStorageKey, String(Date.now()));
  pushPrimerAttempts = 0;
  closeAppModal("pushPrimerModal");
}

async function enableNativePushFromPrimer() {
  localStorage.removeItem(pushPrimerDeferredStorageKey);
  closeAppModal("pushPrimerModal");
  setPushPreferenceEnabled(true);
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  try {
    await syncNativePushRegistration(null, true);
  } catch {
    setPushNotificationState("unknown", "알림 연결 실패", "네트워크와 휴대폰 알림 설정을 확인한 뒤 내 정보에서 다시 시도해 주세요.");
  }
}

function openAccountDeletionModal() {
  const client = window.TennisNoteDataClient;
  if (!state.member?.profileId || !client?.getSession?.()?.access_token) {
    showToast("로그인한 회원만 탈퇴 요청을 접수할 수 있습니다");
    return;
  }
  $("#accountDeletionForm")?.reset();
  if ($("#accountDeletionMessage")) $("#accountDeletionMessage").textContent = "요청 접수 후 관리자가 처리 상태를 확인합니다.";
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = false;
}

function closeAccountDeletionModal() {
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = true;
}

async function submitAccountDeletionRequest(event) {
  event?.preventDefault?.();
  const message = $("#accountDeletionMessage");
  if (!$("#accountDeletionConfirm")?.checked) {
    if (message) message.textContent = "탈퇴 및 알림 중단 확인에 체크해 주세요.";
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token || !state.member?.profileId) {
    if (message) message.textContent = "회원 로그인과 서버 연결을 확인해 주세요.";
    return;
  }

  try {
    await client.rpc("tn_request_account_deletion", {
      target_reason: $("#accountDeletionReason")?.value?.trim() || "",
    });
    await syncMemberAccountDeletionRequestFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#accountDeletionModal");
    closeAccountDeletionModal();
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("회원 탈퇴 및 데이터 삭제 요청이 접수되었습니다");
  } catch {
    if (message) message.textContent = "요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

async function cancelAccountDeletionRequest() {
  const request = state.accountDeletionRequest;
  const client = window.TennisNoteDataClient;
  if (!request?.id || request.status !== "pending" || !client?.rpc) return;
  if (!window.confirm("회원 탈퇴 및 데이터 삭제 요청을 취소할까요?")) return;
  try {
    await client.rpc("tn_cancel_account_deletion", { target_request_id: request.id });
    await syncMemberAccountDeletionRequestFromServer();
    await syncNativePushRegistration(null, false).catch(() => false);
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("탈퇴 요청을 취소했습니다");
  } catch {
    showToast("검토가 시작된 요청은 앱에서 취소할 수 없습니다");
  }
}

async function registerPushToken(tokenValue, platform = nativeAppPlatform()) {
  const client = window.TennisNoteDataClient;
  if (accountDeletionBlocksNotifications(state.accountDeletionRequest?.status)) return false;
  if (!["android", "ios"].includes(platform)) return false;
  if (!tokenValue || !pushProfileId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  await client.rpc("tn_register_push_device", {
    target_platform: platform,
    target_device_id: currentPushDeviceId(),
    target_push_token: tokenValue,
  });
  setPushPreferenceEnabled(true);
  setPushNotificationState("granted", "앱 알림 켜짐", "수업 하루 전·30분 전과 회원권 안내를 잠금화면으로 알려드립니다.");
  return true;
}

async function authorizeMemberNotificationAction(data = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectCurrentProfile || !client?.selectRows || !client.getSession?.()?.access_token) {
    showToast("로그인 후 알림 내용을 확인해 주세요.");
    return false;
  }

  try {
    const current = await client.selectCurrentProfile();
    const currentProfileId = String(current?.profile?.id || "");
    if (!currentProfileId || currentProfileId !== String(state.member?.profileId || "")) {
      const restored = await applySupabaseMemberSession(false);
      if (!restored || currentProfileId !== String(state.member?.profileId || "")) {
        showToast("회원 연결을 다시 확인한 뒤 알림을 열어 주세요.");
        return false;
      }
    }

    const lessonId = String(data.lessonId || data.lesson_id || "").trim();
    if (lessonId) {
      const [legacyParticipants, participantRecords] = await Promise.all([
        client.selectRows("tn_lesson_participants", {
          select: "lesson_id,user_id,ticket_id",
          filters: { lesson_id: lessonId, user_id: currentProfileId },
          limit: 1,
        }).catch(() => []),
        client.selectRows("tn_lesson_participant_records_v2", {
          select: "id,lesson_id,user_id,member_ticket_id",
          filters: { lesson_id: lessonId, user_id: currentProfileId },
          limit: 1,
        }).catch(() => []),
      ]);
      if (!legacyParticipants?.length && !participantRecords?.length) {
        showToast("현재 계정에서 확인할 수 없는 수업입니다.");
        return false;
      }
    }

    const participantRecordId = String(
      data.participantRecordId || data.participant_record_id || data.lessonRecordId || data.lesson_record_id || "",
    ).trim();
    if (participantRecordId) {
      const records = await client.selectRows("tn_lesson_participant_records_v2", {
        select: "id,user_id,lesson_id",
        filters: { id: participantRecordId, user_id: currentProfileId },
        limit: 1,
      }).catch(() => []);
      if (!records?.length) {
        showToast("현재 계정에서 확인할 수 없는 피드백입니다.");
        return false;
      }
    }

    const ticketId = String(data.ticketId || data.ticket_id || "").trim();
    if (ticketId) {
      const ticketsSynced = await syncMemberTicketsFromServer(current.profile).catch(() => false);
      if (!ticketsSynced) {
        showToast("회원권 정보를 새로 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (!(state.liveTickets || []).some((ticket) => String(ticket.id || "") === ticketId)) {
        showToast("현재 계정에서 확인할 수 없는 회원권입니다.");
        return false;
      }
    }
    return true;
  } catch {
    showToast("알림 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return false;
  }
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

function openMemberNotificationTarget(data = {}, route = "home") {
  const lesson = memberNotificationLesson(data);
  if (route === "schedule" && lesson) {
    state.selectedMemberScheduleTicketId = String(memberLessonTicketId(lesson) || "");
    state.selectedScheduleDay = lesson.day || state.selectedScheduleDay;
    state.memberScheduleMode = "mine";
    state.memberScheduleFullView = false;
    renderSchedule();
    openLessonDetailSheet(lesson.id);
    return true;
  }
  if (["feedback", "journal"].includes(route)) {
    const entry = memberNotificationJournalEntry(data);
    if (entry) {
      openJournalDetail(entry.id);
      return true;
    }
  }
  if (route === "membership") {
    const ticketId = String(data.ticketId || data.ticket_id || "").trim();
    const ticketCard = $$('[data-member-ticket-id]').find((item) => item.dataset.memberTicketId === ticketId);
    if (ticketCard) {
      window.setTimeout(() => ticketCard.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
      return true;
    }
  }
  if ((route === "schedule" || ["feedback", "journal"].includes(route)) && !lesson) {
    showToast("알림에 연결된 수업을 찾지 못했습니다. 최신 일정을 다시 확인해 주세요.");
  }
  jumpToTop();
  return false;
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

async function syncNativePushRegistration(profile = null, requestPermission = false) {
  const plugin = nativePushPlugin();
  const platform = nativeAppPlatform();
  const profileId = profile?.id || state.member?.profileId || "";
  pushProfileId = profileId;

  if (accountDeletionBlocksNotifications(state.accountDeletionRequest?.status)) {
    // The deletion-request RPC already disabled every currently enabled
    // device. Do not touch updated_at here because cancellation uses that
    // request-time marker to restore only devices disabled by the request.
    pushProfileId = "";
    setPushNotificationState("disabled", "탈퇴 요청으로 알림 중지", "계정 삭제 요청을 처리하는 동안 새 기기 알림을 등록하지 않습니다.");
    return false;
  }

  if (!["android", "ios"].includes(platform) || !plugin) {
    setPushNotificationState(
      "unavailable",
      "설치 앱에서 사용 가능",
      "휴대폰에 설치한 Tennis Note 앱에서 수업·회원권 알림을 켤 수 있습니다.",
    );
    return false;
  }
  if (!profileId || !window.TennisNoteDataClient?.getSession?.()?.access_token) {
    setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
    return false;
  }
  if (!pushPreferenceEnabled()) {
    setPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
    return false;
  }

  await bindNativePushListeners(plugin);
  if (platform === "android") {
    await plugin.createChannel({
      id: "lesson-reminders",
      name: "수업·회원권 알림",
      description: "수업 일정과 회원권 만료 알림",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }

  let permission = await plugin.checkPermissions();
  if (requestPermission && ["prompt", "prompt-with-rationale"].includes(permission.receive)) {
    permission = await plugin.requestPermissions();
  }
  if (permission.receive === "denied") {
    setPushNotificationState("denied", "휴대폰 알림이 꺼져 있음", "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.");
    return false;
  }
  if (permission.receive !== "granted") {
    setPushNotificationState("prompt", "알림 허용 필요", "알림 허용을 누르면 하루 전과 30분 전에 알려드립니다.");
    return false;
  }

  setPushNotificationState("granted", "앱 알림 연결 중", "기기 알림 토큰을 안전하게 등록하고 있습니다.");
  await plugin.register();
  return true;
}

async function disableNativePushForLogout() {
  const client = window.TennisNoteDataClient;
  if (client?.getSession?.()?.access_token && client?.rpc) {
    await client.rpc("tn_disable_push_device", {
      target_device_id: currentPushDeviceId(),
    }).catch(() => null);
  }
  // The server-side device record above is the authoritative push opt-out.
  // Calling the Android plugin's unregister method without an initialized
  // Firebase app terminates the whole native process instead of rejecting.
  // Keep the native registration intact and let the next signed-in session
  // refresh it after Firebase is available.
  pushProfileId = "";
  setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
}

async function disableNativePushForMember() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    setPushNotificationState("unknown", "알림 끄기 실패", "로그인과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    return false;
  }
  await client.rpc("tn_disable_push_device", {
    target_device_id: currentPushDeviceId(),
  });
  setPushPreferenceEnabled(false);
  setPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
  return true;
}

function loadAdminSchedulePolicy() {
  const fallback = defaultMemberCoachPolicy();
  let resolved = fallback;
  try {
    const snapshot = readAdminSnapshot();
    if (snapshot) {
      const scheduleSettings = snapshot.scheduleSettings || {};
      const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
      const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches)
        ? snapshot.coaches
        : fallback.coaches;
      resolved = {
        openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
        openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
        breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
        lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
        lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
        memberScheduleRequestOnly: scheduleSettings.memberScheduleRequestOnly !== false,
        requireMakeupDayAnchor: scheduleSettings.requireMakeupDayAnchor
          ?? scheduleSettings.require_makeup_day_anchor
          ?? fallback.requireMakeupDayAnchor,
        makeupAnchorGapMinutes: (() => {
          const configured = scheduleSettings.makeupAnchorGapMinutes
            ?? scheduleSettings.makeup_anchor_gap_minutes
            ?? fallback.makeupAnchorGapMinutes;
          if (configured === null || String(configured).toLowerCase() === "unlimited") return null;
          return Math.min(100, Math.max(0, Number(configured) || 0));
        })(),
        coaches: savedCoaches
        .filter((coach) => (
          (coach.status || "active") === "active"
          && (coach.employmentStatus || "active") === "active"
          && !coach.archivedAt
          && !coach.deletedAt
        ))
        .map(normalizeMemberCoach),
      };
    }
  } catch {
    localStorage.removeItem(adminStorageKey);
  }
  const workspace = memberScheduleV2WorkspaceCache?.workspace;
  if (!workspace?.coaches?.length) return resolved;
  const serverCoaches = workspace.coaches.map((coach, coachIndex) => {
    const serverLaneOrder = Number(coach.laneOrder);
    const laneOrder = Number.isFinite(serverLaneOrder) && serverLaneOrder !== 1000
      ? serverLaneOrder
      : 1000 + coachIndex;
    const workBlocks = (coach.availability || [])
      .filter((block) => block.type === "available")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-${blockIndex}`,
        days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: "근무",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    const blockedBlocks = (coach.availability || [])
      .filter((block) => block.type === "blocked")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-blocked-${blockIndex}`,
        days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: block.note || "브레이크·상담",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    return normalizeMemberCoach({
      id: coach.roleId,
      serverRoleId: coach.roleId,
      roleId: coach.roleId,
      name: coach.name || "이름 없음",
      status: "active",
      laneOrder,
      scheduleLaneOrder: laneOrder,
      workBlocks,
      blockedBlocks,
    });
  });
  return {
    ...resolved,
    coaches: serverCoaches,
  };
}

function readAdminSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(adminStorageKey) || "null");
  } catch {
    localStorage.removeItem(adminStorageKey);
    return null;
  }
}

async function syncLiveSchedulePolicy(branchId = "") {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const [rows, coachRows] = await Promise.all([
      client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      }),
      client.selectRows("tn_coach_roles", {
        select: "id,branch_id,display_name,status,employment_status,archived_at,deleted_at",
        limit: 100,
      }),
    ]);
    return writeLiveSchedulePolicySnapshot(
      filterSchedulePolicyByLiveCoachRoles(rows?.[0]?.value, coachRows),
      branchId,
    );
  } catch (error) {
    return false;
  }
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

function openNtrpReference(referenceId) {
  const item = ntrpReferences.find((reference) => reference.id === referenceId);
  if (!item) return;
  const isPoster = Boolean(item.image);
  $("#ntrpReferenceContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${item.title}</h2>
      <span>${item.detail}</span>
    </div>
    ${
      isPoster
        ? `<img class="ntrp-modal-image" src="${item.image}" alt="${item.title}" />`
        : `<div class="ntrp-official-summary">
            ${ntrpQuickLevels
              .map(
                (level) => `
                  <article>
                    <strong>NTRP ${level.level}</strong>
                    <span>${level.label}</span>
                    <small>${level.detail}</small>
                  </article>`,
              )
              .join("")}
            <a class="small-button" href="${item.url}" target="_blank" rel="noreferrer">공식 PDF 열기</a>
          </div>`
    }`;
  $("#ntrpReferenceModal").hidden = false;
}

function closeNtrpReference() {
  $("#ntrpReferenceModal").hidden = true;
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

function updateChangeRequestAvailability(availableLessons = memberAvailableSlotsForSelectedLesson(), loadState = activeMemberScheduleLoadState()) {
  const sourceLessons = currentScheduledLessonsForChange();
  const hasSourceLesson = sourceLessons.length > 0;
  const hasAvailableSlot = availableLessons.length > 0;
  const source = sourceLessons.find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const isRegularInitialBooking = Boolean(source?.regularInitialBooking);
  const requiredCount = Math.max(1, Number(source?.frequencyPerWeek) || 1);
  const regularSelectionComplete = !isRegularInitialBooking
    || state.regularInitialSelections.length === requiredCount;
  const canSubmit = hasSourceLesson && hasAvailableSlot && regularSelectionComplete;
  const emptyState = $("#changeRequestEmptyState");
  const reason = $("#changeReason");
  const requestButton = $("#requestMakeup");
  const sourceSelect = $("#absenceLesson");
  const slotSelect = $("#makeupSlot");

  if (sourceSelect) sourceSelect.disabled = !hasSourceLesson;
  if (slotSelect) slotSelect.disabled = !hasAvailableSlot;
  if (reason) reason.disabled = !canSubmit;
  if (requestButton) {
    requestButton.disabled = !canSubmit;
    requestButton.setAttribute("aria-disabled", String(!canSubmit));
  }
  if (emptyState) {
    emptyState.hidden = canSubmit || (isRegularInitialBooking && hasAvailableSlot);
    emptyState.textContent = loadState === "loading"
      ? "선택한 주의 시간표를 확인하고 있습니다."
      : loadState === "error"
        ? "시간표를 불러오지 못했습니다. 다시 확인해 주세요."
        : !hasSourceLesson
      ? "예약하거나 변경할 수업이 없습니다. 이용권을 구매했다면 고객지원으로 문의해 주세요."
      : "현재 변경 가능한 시간이 없습니다. 다른 주를 확인하거나 고객지원으로 문의해 주세요.";
  }
  $("#changeRequestModal")?.classList.toggle("is-unavailable", !canSubmit);
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

function memberHoldingPolicy() {
  const fallback = {
    personalMaxDays: 7,
    fourWeekPersonalMaxDays: 7,
    threeMonthPersonalMaxDays: 14,
    couponPersonalMaxDays: 0,
    injuryMaxDays: 30,
    emergencyRetroactiveDays: 3,
    evidenceRequired: true,
    evidenceRetentionDays: 30,
  };
  let saved = fallback;
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    saved = { ...fallback, ...(state.holdingPolicySettings || {}), ...(snapshot?.holdingPolicySettings || {}) };
  } catch {
    saved = fallback;
  }
  const ticketTitle = String(currentHoldingTicket()?.title || "");
  const personalMaxDays = /쿠폰/.test(ticketTitle)
    ? Number(saved.couponPersonalMaxDays) || 0
    : /3개월|12주/.test(ticketTitle)
      ? Number(saved.threeMonthPersonalMaxDays) || 14
      : Number(saved.fourWeekPersonalMaxDays ?? saved.personalMaxDays) || 7;
  return { ...saved, personalMaxDays };
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

function updateHoldingEvidenceFields() {
  const injury = $("#holdingRequestType")?.value === "injury";
  if ($("#holdingEvidenceFields")) $("#holdingEvidenceFields").hidden = !injury;
  if (!injury) {
    if ($("#holdingEvidenceFile")) $("#holdingEvidenceFile").value = "";
    if ($("#holdingSensitiveConsent")) $("#holdingSensitiveConsent").checked = false;
  }
  const policy = memberHoldingPolicy();
  const personalOption = $("#holdingRequestType option[value='personal']");
  if (personalOption) personalOption.disabled = Number(policy.personalMaxDays) <= 0;
  if (!injury && Number(policy.personalMaxDays) <= 0) {
    $("#holdingRequestType").value = "injury";
    return updateHoldingEvidenceFields();
  }
  if ($("#holdingPolicySummary")) {
    $("#holdingPolicySummary").textContent = injury
      ? `부상 홀딩 최대 ${policy.injuryMaxDays}일 · 증빙 확인 필요`
      : `개인 사유 홀딩 최대 ${policy.personalMaxDays}일`;
  }
}

function openHoldingRequestModal(ticketId = "") {
  state.selectedHoldingTicketId = ticketId || currentLiveTicket()?.id || "";
  if (!currentHoldingTicket()) return;
  const today = new Date();
  $("#holdingRequestForm")?.reset();
  $("#holdingStartDate").value = today.toISOString().slice(0, 10);
  $("#holdingEndDate").value = new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  $("#holdingRequestMessage").textContent = "승인되면 해당 기간만큼 회원권 종료일이 연장됩니다.";
  updateHoldingEvidenceFields();
  $("#holdingRequestModal").hidden = false;
}

function closeHoldingRequestModal() {
  $("#holdingRequestModal").hidden = true;
}

async function submitHoldingRequest(event) {
  event.preventDefault();
  const ticket = currentHoldingTicket();
  if (!ticket) return;
  const requestType = $("#holdingRequestType").value;
  const startDate = $("#holdingStartDate").value;
  const endDate = $("#holdingEndDate").value;
  const reason = $("#holdingReason").value.trim();
  const file = $("#holdingEvidenceFile").files?.[0] || null;
  const consent = $("#holdingSensitiveConsent").checked;
  const policy = memberHoldingPolicy();
  const days = holdingRequestDays(startDate, endDate);
  const maxDays = requestType === "injury" ? Number(policy.injuryMaxDays) : Number(policy.personalMaxDays);
  if (requestType === "personal" && maxDays <= 0) {
    message.textContent = "쿠폰제는 개인 사유 홀딩을 제공하지 않습니다. 부상·입원은 증빙과 함께 신청할 수 있습니다.";
    return;
  }
  const message = $("#holdingRequestMessage");
  if (!days || days > maxDays) {
    message.textContent = `${requestType === "injury" ? "부상" : "개인 사유"} 홀딩은 최대 ${maxDays}일까지 신청할 수 있습니다.`;
    return;
  }
  if (requestType === "injury" && policy.evidenceRequired && !file) {
    message.textContent = "부상 홀딩은 진단서 또는 진료확인서를 첨부해 주세요.";
    return;
  }
  const allowedEvidenceTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (file && !allowedEvidenceTypes.includes(file.type)) {
    message.textContent = "PDF·JPG·PNG·WEBP 파일만 첨부할 수 있습니다.";
    return;
  }
  if (file && file.size > 5 * 1024 * 1024) {
    message.textContent = "첨부파일은 5MB 이하만 가능합니다.";
    return;
  }
  if (requestType === "injury" && !consent) {
    message.textContent = "건강정보 처리 안내를 확인하고 동의해 주세요.";
    return;
  }
  if (requestType === "personal" && memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.type === "personal" && request.status === "approved")) {
    message.textContent = "이 회원권은 개인 사유 홀딩을 이미 사용했습니다.";
    return;
  }
  if (memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.status === "pending")) {
    message.textContent = "이미 검토 중인 홀딩 요청이 있습니다.";
    return;
  }

  const requestId = globalThis.crypto?.randomUUID?.() || `holding-${Date.now()}`;
  const client = window.TennisNoteDataClient;
  let evidencePath = "";
  const isLive = !ticket.id.startsWith("demo-") && state.member?.profileId && client?.getSession?.()?.access_token;
  try {
    if (isLive && requestType === "injury" && file) {
      evidencePath = `${state.member.profileId}/${requestId}/${safeHoldingFileName(file.name)}`;
      await client.uploadObject("tennisnote-private-holding-evidence", evidencePath, file);
    }
    if (isLive) {
      await client.insertRows("tn_holding_requests", {
        id: requestId,
        branch_id: ticket.branchId,
        user_id: state.member.profileId,
        ticket_id: ticket.id,
        request_type: requestType,
        requested_start_on: startDate,
        requested_end_on: endDate,
        reason_summary: reason,
        evidence_object_path: evidencePath,
        evidence_status: requestType === "injury" ? "uploaded" : "not_required",
        sensitive_consent_at: requestType === "injury" ? new Date().toISOString() : null,
        evidence_purge_due_at: requestType === "injury" ? new Date(Date.now() + Number(policy.evidenceRetentionDays) * 86400000).toISOString() : null,
      });
    }
  } catch {
    if (evidencePath && client?.deleteObject) {
      await client.deleteObject("tennisnote-private-holding-evidence", evidencePath).catch(() => {});
    }
    message.textContent = "서버 신청을 저장하지 못했습니다. 관리자에게 문의해 주세요.";
    return;
  }

  const shared = loadSharedData();
  shared.holdingRequests = shared.holdingRequests || [];
  shared.holdingRequests.unshift({
    id: requestId,
    member: state.member?.name || state.profile.name,
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    type: requestType,
    typeLabel: requestType === "injury" ? "부상·입원" : "개인 사유",
    startDate,
    endDate,
    days,
    reason,
    evidencePath: isLive ? evidencePath : "",
    evidenceLabel: requestType === "injury" ? "증빙 첨부" : "증빙 없음",
    status: "pending",
    source: isLive ? "server" : "demo",
    createdAt: new Date().toISOString(),
  });
  saveSharedData(shared);
  state.ticketHistory.unshift({ text: `홀딩 신청 · ${startDate}~${endDate} · 관리자 검토중`, tone: "wait" });
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#holdingRequestModal");
  closeHoldingRequestModal();
  state.selectedHoldingTicketId = "";
  renderCurrentTicketPanel();
}

async function setMemberGroupPaymentMode(mode) {
  const account = state.groupAccount;
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (mode !== "representative" && linkedMembers.length < 2) return;
  let nextPayer = linkedMembers.find((member) => member.name === account.nextPayer) || linkedMembers[0];
  if (mode === "alternate") {
    const currentIndex = linkedMembers.findIndex((member) => member.name === account.nextPayer);
    nextPayer = linkedMembers[(currentIndex + 1) % linkedMembers.length] || nextPayer;
  }
  const client = window.TennisNoteDataClient;
  if (!account.demoOnly && client?.rpc) {
    try {
      await client.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: mode,
        target_next_payer_user_id: mode === "separate" ? null : nextPayer?.userId || null,
      });
    } catch {
      state.ticketHistory.unshift({ text: "2대1 결제방식 변경 실패 · 관리자 확인 필요", tone: "alert" });
      renderGroupAccountPanel();
      return;
    }
  }
  account.paymentMode = mode;
  account.nextPayer = nextPayer?.name || account.nextPayer;
  account.nextPayerUserId = nextPayer?.userId || account.nextPayerUserId;
  state.ticketHistory.unshift({ text: `2대1 결제방식 변경 · ${memberGroupPaymentModeLabel(mode)}`, tone: "done" });
  saveSnapshot();
  renderGroupAccountPanel();
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

function updateEnrollmentPartnerFields(product = null) {
  const selectedProduct = product || membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const isGroup = isGroupMembershipProduct(selectedProduct || {});
  const fields = $("#enrollmentPartnerFields");
  if (fields) fields.hidden = !isGroup;
  ["#enrollmentPartnerName", "#enrollmentPartnerPhone"].forEach((selector) => {
    const input = $(selector);
    if (input) input.required = isGroup;
  });
}

function openMemberEnrollmentModal(productId, message = "") {
  const product = membershipProducts().find((item) => item.id === productId);
  const modal = $("#memberEnrollmentModal");
  if (!product || !modal) return;
  state.pendingPurchaseProductId = productId;
  const enrollment = state.memberEnrollment || {};
  const productSummary = $("#memberEnrollmentProduct");
  if (productSummary) {
    productSummary.innerHTML = `
      <span>선택 회원권</span>
      <strong>${escapeHtml(product.title)}</strong>
      <small>${escapeHtml(product.detail)} · ${formatWon(onlinePaymentAmount(product))}</small>`;
  }
  setEnrollmentInputValue("#enrollmentName", enrollment.applicant_name || state.member?.name || state.profile.name || "");
  setEnrollmentInputValue("#enrollmentPhone", enrollment.phone || state.profile.phone || "");
  setEnrollmentInputValue("#enrollmentBirthYear", enrollment.birth_year || state.member?.birthYear || "");
  setEnrollmentInputValue("#enrollmentNeighborhood", enrollment.neighborhood || state.member?.neighborhood || "");
  setEnrollmentInputValue("#enrollmentGender", enrollment.gender || state.member?.gender || "");
  setEnrollmentInputValue("#enrollmentExperience", enrollment.experience_level || "beginner");
  setEnrollmentInputValue("#enrollmentPartnerName", enrollment.partner_name || "");
  setEnrollmentInputValue("#enrollmentPartnerPhone", enrollment.partner_phone || "");
  setEnrollmentInputValue("#enrollmentPartnerBirthYear", enrollment.partner_birth_year || "");
  setEnrollmentInputValue("#enrollmentPartnerNeighborhood", enrollment.partner_neighborhood || "");
  setEnrollmentInputValue("#enrollmentPartnerGender", enrollment.partner_gender || "");
  if ($("#enrollmentPrivacyConsent")) $("#enrollmentPrivacyConsent").checked = false;
  if ($("#enrollmentTermsConsent")) $("#enrollmentTermsConsent").checked = false;
  const maxBirthYear = new Date().getFullYear() - 5;
  if ($("#enrollmentBirthYear")) $("#enrollmentBirthYear").max = String(maxBirthYear);
  if ($("#enrollmentPartnerBirthYear")) $("#enrollmentPartnerBirthYear").max = String(maxBirthYear);
  if ($("#memberEnrollmentMessage")) $("#memberEnrollmentMessage").textContent = message;
  if ($("#memberEnrollmentOptionalDetails")) $("#memberEnrollmentOptionalDetails").open = false;
  updateEnrollmentPartnerFields(product);
  modal.hidden = false;
  window.setTimeout(() => $("#enrollmentName")?.focus(), 40);
}

function closeMemberEnrollmentModal() {
  const modal = $("#memberEnrollmentModal");
  if (modal) modal.hidden = true;
}

async function syncMemberEnrollmentFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.readiness?.().ready || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_member_enrollments", {
      select: "id,user_id,branch_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,partner_birth_year,partner_neighborhood,partner_gender,submitted_at,approved_at,updated_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.memberEnrollment = (rows || [])
      .filter((row) => row.form_version === memberEnrollmentFormVersion)
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))[0] || null;
    return true;
  } catch {
    state.memberEnrollment = null;
    return false;
  }
}

async function submitMemberEnrollment(event) {
  event.preventDefault();
  const product = membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const message = $("#memberEnrollmentMessage");
  if (!product || !message) return;
  const isGroup = isGroupMembershipProduct(product);
  const birthYear = Number($("#enrollmentBirthYear")?.value || 0);
  const partnerBirthYear = Number($("#enrollmentPartnerBirthYear")?.value || 0) || null;
  const maxBirthYear = new Date().getFullYear() - 5;
  const payload = {
    target_product_id: product.id,
    target_form_version: memberEnrollmentFormVersion,
    target_applicant_name: $("#enrollmentName")?.value.trim() || "",
    target_phone: $("#enrollmentPhone")?.value.trim() || "",
    target_birth_year: birthYear,
    target_neighborhood: $("#enrollmentNeighborhood")?.value.trim() || "",
    target_gender: $("#enrollmentGender")?.value || "",
    target_experience_level: $("#enrollmentExperience")?.value || "beginner",
    target_lesson_goal: memberEnrollmentLegacyDefaults.lessonGoal,
    target_preferred_schedule: memberEnrollmentLegacyDefaults.preferredSchedule,
    target_partner_name: isGroup ? $("#enrollmentPartnerName")?.value.trim() || "" : "",
    target_partner_phone: isGroup ? $("#enrollmentPartnerPhone")?.value.trim() || "" : "",
    target_partner_birth_year: isGroup ? partnerBirthYear : null,
    target_partner_neighborhood: isGroup ? $("#enrollmentPartnerNeighborhood")?.value.trim() || "" : "",
    target_partner_gender: isGroup ? $("#enrollmentPartnerGender")?.value || "" : "",
    target_privacy_consent: Boolean($("#enrollmentPrivacyConsent")?.checked),
    target_terms_consent: Boolean($("#enrollmentTermsConsent")?.checked),
  };
  if (!payload.target_applicant_name || payload.target_phone.replace(/\D/g, "").length < 9) {
    message.textContent = "이름과 연락처를 확인해 주세요.";
    return;
  }
  if (birthYear < 1900 || birthYear > maxBirthYear) {
    message.textContent = "출생연도를 확인해 주세요.";
    return;
  }
  if (isGroup && (!payload.target_partner_name || payload.target_partner_phone.replace(/\D/g, "").length < 9)) {
    message.textContent = "2대1 파트너 이름과 연락처를 입력해 주세요.";
    return;
  }
  if (!payload.target_privacy_consent || !payload.target_terms_consent) {
    message.textContent = "필수 안내 두 가지를 확인하고 동의해 주세요.";
    return;
  }

  const submitButton = $("#memberEnrollmentForm button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  message.textContent = "가입서를 안전하게 저장하는 중입니다.";
  try {
    const client = window.TennisNoteDataClient;
    if (hasLiveMemberSession() && client?.rpc) {
      await client.rpc("tn_submit_member_enrollment", payload);
      if (state.member) state.member.memberKind = state.member.memberKind === "lesson_member" ? "lesson_member" : "lesson_pending";
      await syncMemberEnrollmentFromServer();
    } else {
      state.memberEnrollment = {
        id: `demo-enrollment-${Date.now()}`,
        user_id: state.member?.profileId || "demo-member",
        requested_product_id: product.id,
        form_version: memberEnrollmentFormVersion,
        status: "submitted",
        applicant_name: payload.target_applicant_name,
        phone: payload.target_phone,
        birth_year: payload.target_birth_year,
        neighborhood: payload.target_neighborhood,
        gender: payload.target_gender,
        experience_level: payload.target_experience_level,
        lesson_goal: payload.target_lesson_goal,
        preferred_schedule: payload.target_preferred_schedule,
        group_size: isGroup ? 2 : 1,
        partner_name: payload.target_partner_name,
        partner_phone: payload.target_partner_phone,
        submitted_at: new Date().toISOString(),
      };
      if (state.member) state.member.memberKind = "lesson_pending";
    }
    state.profile.name = payload.target_applicant_name;
    state.profile.phone = payload.target_phone;
    state.ticketHistory.unshift({ text: `${product.title} 수강 가입서 제출 완료`, tone: "done" });
    saveSnapshot();
    renderAll();
    window.TennisNoteInputGuard?.markSaved?.("#memberEnrollmentModal");
    closeMemberEnrollmentModal();
    if (hasLiveMemberSession()) {
      await startProductPayment(product.id, { skipEnrollmentGate: true });
    } else {
      state.pendingPaymentCheckStatus = { tone: "done", text: "데모 가입서 제출 완료 · 실제 로그인 후 결제로 이어집니다." };
      renderAll();
      setView("shopView");
    }
  } catch (error) {
    message.textContent = memberEnrollmentErrorMessage(error);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

const membershipPurchaseSteps = ["상품", "코치·시간", "결제"];

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

function openMembershipPurchaseFlow(renewalTicketId = "", productId = "") {
  const flow = purchaseFlowState();
  const sourceTicket = (state.liveTickets || []).find((ticket) => String(ticket.id || "") === String(renewalTicketId || "")) || null;
  const products = membershipProducts();
  const exactProduct = products.find((product) => String(product.id || "") === String(productId || sourceTicket?.productId || "")) || null;
  const inferredSourceFamilyId = sourceTicket ? membershipProductFamilyId({
    title: sourceTicket.title || "",
    group: sourceTicket.group || "",
    productKind: sourceTicket.productKind || "regular",
    mode: sourceTicket.productKind === "coupon" ? "pass" : "fixed",
    groupSize: sourceTicket.groupSize || 1,
    lessonMinutes: sourceTicket.lessonMinutes || 20,
    scheduleScope: sourceTicket.scheduleScope || (/주말/.test(sourceTicket.title || "") ? "weekend" : "weekday"),
  }) : "";
  const matchingProduct = exactProduct
    || (sourceTicket ? recommendedMembershipProducts(products, inferredSourceFamilyId, sourceTicket)[0] : null)
    || null;
  const lesson = sourceTicket ? purchaseTicketLesson(sourceTicket) : null;
  flow.open = true;
  flow.renewalTicketId = sourceTicket?.id || "";
  flow.productId = matchingProduct?.id || "";
  flow.familyId = matchingProduct ? membershipProductFamilyId(matchingProduct) : activeMembershipPresetId() || "four-week";
  flow.step = 1;
  flow.purchasePurpose = sourceTicket ? "renew_same" : (state.liveTickets || []).length ? "" : "new_purchase";
  flow.showMoreSlots = false;
  flow.scheduleMode = sourceTicket && matchingProduct && membershipProductFacet(matchingProduct, "productKind") !== "coupon" ? "keep" : "change";
  flow.coachRoleId = sourceTicket?.coachRoleId || "";
  flow.coachName = sourceTicket?.coach || memberScheduleTicketCoachName(sourceTicket || {}) || "";
  flow.preferredDate = lesson?.lessonDate || "";
  flow.preferredDay = lesson?.day || "";
  flow.preferredTime = lesson?.time || "";
  flow.preferredSchedules = [];
  flow.discountIssueId = "";
  flow.discountSelectionMode = "auto";
  flow.completionStatus = "";
  state.membershipFilters = { ...membershipProductFamilyDefinition(flow.familyId).filters };
  state.membershipSelectedFamilyId = flow.familyId;
  saveSnapshot();
  renderMembershipPurchaseFlow();
  void refreshPurchaseScheduleAvailability();
  window.requestAnimationFrame(() => $("#membershipPurchaseFlow")?.scrollIntoView({ block: "start" }));
}

function closeMembershipPurchaseFlow(options = {}) {
  const flow = purchaseFlowState();
  flow.open = false;
  flow.step = 1;
  flow.completionStatus = "";
  saveSnapshot();
  renderProducts();
  const showCurrentMembership = options.showCurrentMembership === true;
  if (showCurrentMembership && $("#currentMembershipDetails")) $("#currentMembershipDetails").open = true;
  window.requestAnimationFrame(() => {
    const target = showCurrentMembership ? $("#currentMembershipDetails") : $("#membershipProductBrowser");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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

const paymentMethodDefinitions = [
  { id: "card", label: "카드", shortLabel: "카드", payMethod: "CARD", detail: "신용·체크카드 결제" },
  { id: "tosspay", label: "토스페이", shortLabel: "토스페이", payMethod: "EASY_PAY", detail: "토스페이 바로 결제" },
  { id: "bank_transfer", label: "계좌이체", shortLabel: "계좌이체", payMethod: "BANK_TRANSFER", detail: "현금가 · 입금 확인 후 회원권 발급" },
  { id: "naverpay", label: "네이버페이", shortLabel: "네이버페이", payMethod: "EASY_PAY", detail: "네이버페이 바로 결제" },
  { id: "kakaopay", label: "카카오페이", shortLabel: "카카오페이", payMethod: "EASY_PAY", detail: "카카오페이 바로 결제" },
];
const defaultPaymentOperatingMode = "tosspay_only";
const defaultAllowedPaymentMethods = ["tosspay"];
let portOneSdkPromise = null;
let preparedPaymentContext = null;
let bankTransferAccountNumberForCopy = "";
let bankTransferPaymentIdForCancel = "";

function openBankTransferInstructions(preparedPayment = {}, product = {}, amount = 0) {
  const account = preparedPayment?.bankTransferAccount || {};
  bankTransferAccountNumberForCopy = String(account.accountNumber || "");
  bankTransferPaymentIdForCancel = String(preparedPayment?.paymentId || "");
  if ($("#bankTransferProductName")) $("#bankTransferProductName").textContent = product.title || "회원권";
  if ($("#bankTransferAmount")) $("#bankTransferAmount").textContent = formatWon(Number(preparedPayment?.amount || amount || 0));
  if ($("#bankTransferBankName")) $("#bankTransferBankName").textContent = account.bankName || "관리자 확인 필요";
  if ($("#bankTransferAccountNumber")) $("#bankTransferAccountNumber").textContent = bankTransferAccountNumberForCopy || "관리자 확인 필요";
  if ($("#bankTransferAccountHolder")) $("#bankTransferAccountHolder").textContent = account.accountHolder || "관리자 확인 필요";
  if ($("#bankTransferDepositorName")) $("#bankTransferDepositorName").textContent = preparedPayment?.depositorName || state.profile?.name || "신청자명";
  if ($("#bankTransferDepositDueAt")) {
    const dueAt = new Date(preparedPayment?.depositDueAt || "");
    $("#bankTransferDepositDueAt").textContent = Number.isFinite(dueAt.getTime())
      ? dueAt.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : `${Number(account.depositDeadlineHours || 24)}시간 이내`;
  }
  if ($("#bankTransferCustomInstructions")) {
    $("#bankTransferCustomInstructions").textContent = account.instructions || "신청자 이름으로 입금해 주세요.";
  }
  openAppSheet("bankTransferInstructionsSheet", { initialFocus: "#copyBankTransferAccountButton" });
}

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

async function cancelBankTransferRequest() {
  const paymentId = bankTransferPaymentIdForCancel;
  const client = window.TennisNoteDataClient;
  if (!paymentId || !client?.invokeFunction || !client.getSession?.()?.access_token) {
    showToast("취소할 입금 신청을 찾지 못했습니다.");
    return;
  }
  if (!window.confirm("입금 전 신청을 취소할까요? 이미 입금했다면 먼저 관리자에게 문의해 주세요.")) return;
  try {
    await client.invokeFunction("portone-payment/cancel-pending", {
      body: { paymentId, reason: "회원 계좌이체 신청 취소" },
    });
    bankTransferPaymentIdForCancel = "";
    await syncMemberDiscountCouponsFromServer();
    closeAppSheet("bankTransferInstructionsSheet");
    state.pendingPaymentCheckStatus = { tone: "done", text: "계좌이체 신청을 취소했습니다." };
    renderAll();
    showToast("입금 신청을 취소했습니다.");
  } catch (error) {
    showToast(paymentServerErrorMessage(error));
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

async function syncMemberPaymentOptionsFromServer(targetBranchId = "") {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) return false;
  const branchId = targetBranchId || currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId || null;
  try {
    const options = await client.invokeFunction("portone-payment/options", { body: { branchId } });
    state.livePaymentOptions = {
      allowedMethods: paymentMethodIdList(options?.allowedMethods || ["tosspay"]),
      bankTransferEnabled: options?.bankTransferEnabled === true,
      paymentMethods: Array.isArray(options?.paymentMethods) ? options.paymentMethods : [],
      settingsVersion: Math.max(0, Number(options?.settingsVersion) || 0),
      features: { threeMonth: true, oneDay: true, coupons: true, ...(options?.features || {}) },
    };
    normalizeSelectedPaymentMethod();
    return true;
  } catch {
    state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, features: { threeMonth: true, oneDay: true, coupons: true } };
    normalizeSelectedPaymentMethod();
    return false;
  }
}

async function syncMemberDiscountCouponsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) return false;
  const branchId = currentLiveTicket()?.branchId || upcomingLiveTickets()[0]?.branchId || state.liveMembershipProducts?.[0]?.branchId || null;
  try {
    const response = await client.invokeFunction("portone-payment/coupon-wallet", { body: { branchId } });
    state.discountCoupons = Array.isArray(response?.coupons) ? response.coupons : [];
    renderDiscountCouponWallet();
    return true;
  } catch {
    state.discountCoupons = [];
    renderDiscountCouponWallet();
    return false;
  }
}

function availableDiscountCoupons() {
  return (state.discountCoupons || []).filter((coupon) => discountCouponStatus(coupon).label === "사용 가능");
}

function paymentGatewayConfig() {
  const localConfig = (() => {
    try {
      return JSON.parse(localStorage.getItem(paymentConfigKey) || "{}");
    } catch {
      localStorage.removeItem(paymentConfigKey);
      return {};
    }
  })();
  const browserConfig = window.TENNIS_NOTE_PAYMENT_CONFIG || {};
  const liveOptions = state.livePaymentOptions || {};
  const requestedMode = String(browserConfig.mode || localConfig.mode || defaultPaymentOperatingMode).trim().toLowerCase();
  const mode = requestedMode === "multi" ? "multi" : defaultPaymentOperatingMode;
  return {
    provider: "portone",
    mode,
    allowedMethods: paymentMethodIdList(liveOptions.allowedMethods?.length
      ? liveOptions.allowedMethods
      : browserConfig.allowedMethods || localConfig.allowedMethods || defaultAllowedPaymentMethods),
    storeId: browserConfig.storeId || localConfig.storeId || "",
    naverPayCategoryType: browserConfig.naverPayCategoryType || localConfig.naverPayCategoryType || "",
    naverPayCategoryId: browserConfig.naverPayCategoryId || localConfig.naverPayCategoryId || "",
    bankTransfer: {
      enabled: liveOptions.bankTransferEnabled === true
        || browserConfig.bankTransfer?.enabled === true
        || localConfig.bankTransfer?.enabled === true,
    },
    channels: {
      card: browserConfig.channels?.card || browserConfig.channelKey || localConfig.channels?.card || localConfig.channelKey || "",
      tosspay: browserConfig.channels?.tosspay || browserConfig.tossPayChannelKey || localConfig.channels?.tosspay || localConfig.tossPayChannelKey || "",
      naverpay: browserConfig.channels?.naverpay || browserConfig.naverPayChannelKey || localConfig.channels?.naverpay || localConfig.naverPayChannelKey || "",
      kakaopay: browserConfig.channels?.kakaopay || browserConfig.kakaoPayChannelKey || localConfig.channels?.kakaopay || localConfig.kakaoPayChannelKey || "",
    },
  };
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

async function syncMemberChangeCandidates(source = null) {
  if (!memberChangeUsesServerCandidates(source)) {
    state.serverChangeCandidateStatus = "fallback";
    state.serverChangeCandidateKey = "";
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "";
    state.serverChangeCandidateExclusions = {};
    state.serverChangeAnchorGapMinutes = 40;
    return false;
  }
  // A pending request keeps its source lesson scheduled. Use the same local
  // slot preview while editing and let the update RPC perform the final,
  // locked server validation before it changes the held target.
  if (state.editingChangeRequestId) {
    state.serverChangeCandidateStatus = "fallback";
    state.serverChangeCandidateKey = memberChangeCandidateKey(source);
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "";
    state.serverChangeCandidateExclusions = {};
    state.serverChangeAnchorGapMinutes = 40;
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
  const week = { ...activeMemberWeek() };
  const range = memberChangeCandidateRange(source, week);
  const key = memberChangeCandidateKey(source, week);
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    state.serverChangeCandidateStatus = "error";
    state.serverChangeCandidateKey = key;
    state.serverChangeCandidates = [];
    state.serverChangeCandidateError = "로그인 연결을 다시 확인한 뒤 가능한 시간을 조회해 주세요.";
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
  const requestId = ++memberChangeCandidateRequestSequence;
  state.serverChangeCandidateStatus = "loading";
  state.serverChangeCandidateKey = key;
  state.serverChangeCandidates = [];
  state.serverChangeCandidateError = "";
  state.serverChangeCandidateExclusions = {};
  state.serverChangeAnchorGapMinutes = 40;
  renderSelects();
  renderAvailableSlots();
  renderSchedule();
  try {
    const ticketId = source.member_ticket_id || source.ticketId || "";
    const candidateArgs = source.couponBooking
      ? {
        target_ticket_id: ticketId,
        target_from: range.from,
        target_to: range.to,
      }
      : {
        target_lesson_id: source.serverLessonId,
        target_from: range.from,
        target_to: range.to,
      };
    let result;
    if (source.couponBooking) {
      result = await client.rpc("tn_member_coupon_candidates", candidateArgs, { timeoutMs: 12_000 });
    } else {
      try {
        result = await client.rpc("tn_member_change_candidates_v2", candidateArgs, { timeoutMs: 12_000 });
      } catch (error) {
        const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
        if (!/tn_member_change_candidates_v2|PGRST202|42883|schema cache/i.test(errorText)) throw error;
        result = await client.rpc("tn_member_change_candidates", candidateArgs, { timeoutMs: 12_000 });
      }
    }
    if (requestId !== memberChangeCandidateRequestSequence || memberChangeCandidateKey(source) !== key) return false;
    if (!result || !Array.isArray(result.candidates)) {
      state.serverChangeCandidateStatus = source.couponBooking ? "error" : "fallback";
      state.serverChangeCandidateError = source.couponBooking
        ? "쿠폰 예약 가능 시간을 서버에서 확인하지 못했습니다. 다시 확인해 주세요."
        : "";
      renderSelects();
      renderAvailableSlots();
      renderSchedule();
      return false;
    }
    const reportedGap = result.anchorGapMinutes ?? result.anchorRule?.gapMinutes;
    state.serverChangeAnchorGapMinutes = reportedGap === null ? null : Math.max(0, Number(reportedGap) || 40);
    const mappedCandidates = result.candidates.map((candidate) => mapServerMemberChangeCandidate(candidate, source));
    state.serverChangeCandidates = mappedCandidates;
    state.serverChangeCandidateExclusions = result.exclusionSummary && typeof result.exclusionSummary === "object"
      ? result.exclusionSummary
      : {};
    state.serverChangeCandidateStatus = "ready";
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return true;
  } catch (error) {
    if (requestId !== memberChangeCandidateRequestSequence) return false;
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (/tn_member_(change|coupon)_candidates|PGRST202|42883|schema cache/i.test(errorText)) {
      state.serverChangeCandidateStatus = source.couponBooking ? "error" : "fallback";
      state.serverChangeCandidateError = source.couponBooking
        ? "쿠폰 예약 가능 시간을 서버에서 확인하지 못했습니다. 다시 확인해 주세요."
        : "";
      renderSelects();
      renderAvailableSlots();
      renderSchedule();
      return false;
    }
    const failure = memberChangeCandidateFailure(errorText);
    state.serverChangeCandidateStatus = "error";
    state.serverChangeCandidateError = failure.message;
    state.scheduleV2SyncErrorCode = failure.code;
    renderSelects();
    renderAvailableSlots();
    renderSchedule();
    return false;
  }
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

function applyScheduleV2MemberWorkspace(workspace = {}, releasedMakeupSlots = [], oneDaySlots = []) {
  if (!workspace?.actorUserId || !Array.isArray(workspace.lessons)) return false;
  state.scheduleOperationDays = Array.isArray(workspace.operationDays) ? workspace.operationDays : [];
  const ticketsById = new Map((workspace.tickets || []).map((ticket) => [ticket.id, ticket]));
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const mappedLessons = workspace.lessons.map((lesson) => {
    const isOwnLesson = lesson.isOwnLesson === true;
    const ticket = ticketsById.get(lesson.memberTicketId) || {};
    const laneCoach = coachesById.get(lesson.coachRoleId) || {};
    const substitute = lesson.substitute && lesson.substitute.coachRoleId ? lesson.substitute : null;
    const lessonDate = String(lesson.lessonDate || "");
    const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
    const lessonKind = String(lesson.scheduleKind || "regular");
    const participantRecord = lesson.participantRecord && typeof lesson.participantRecord === "object"
      ? lesson.participantRecord
      : null;
    const ownStatus = scheduleV2MemberOutcomeStatus(participantRecord, lesson.status);
    return {
      ...lesson,
      serverStatus: isOwnLesson ? ownStatus : lesson.status,
      serverLessonId: lesson.id,
      serverRevision: Number(lesson.revision) || 0,
      lessonDate,
      day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
      time: String(lesson.startTime || "").slice(0, 5),
      coach: substitute?.coachName || laneCoach.name || "담당 코치",
      coachRoleId: lesson.coachRoleId,
      coach_role_id: lesson.coachRoleId,
      originalCoachRoleId: substitute ? lesson.coachRoleId : "",
      originalCoach: substitute ? (laneCoach.name || "담당 코치") : "",
      isSubstitute: Boolean(substitute),
      member: isOwnLesson ? currentMemberName() : "",
      type: `${scheduleV2MemberLessonKind(lessonKind)} ${Number(lesson.durationMinutes) || 20}분`,
      lessonSource: lessonKind,
      durationMinutes: Number(lesson.durationMinutes) || 20,
      ticketId: ticket.id || lesson.memberTicketId || "",
      ticketTotalSessions: Number(ticket.totalSessions) || 0,
      ticketUsedSessions: Number(ticket.usedSessions) || 0,
      ticketRemainingSessions: Number(ticket.remainingSessions) || 0,
      ticketLessonMinutes: Number(ticket.lessonMinutes) || Number(lesson.durationMinutes) || 20,
      participantRecord,
      recordStatus: participantRecord?.recordStatus || "",
      outcome: participantRecord?.outcome || "",
      deductedSessions: Number(participantRecord?.deductedSessions) || 0,
      coachComment: participantRecord?.coachComment || "",
      status: isOwnLesson
        ? ownStatus === "pending_change" ? "requested" : ownStatus
        : "occupied",
      isOwnLesson,
      scheduleV2: true,
    };
  });

  state.liveMakeupEntitlements = (workspace.makeupEntitlements || []).map((entitlement) => {
    const sourceLesson = workspace.lessons.find((lesson) => lesson.id === entitlement.sourceLessonId) || {};
    const lessonDate = String(sourceLesson.lessonDate || "");
    const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
    return {
      id: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      ticketId: entitlement.ticketId,
      coachRoleId: entitlement.coachRoleId,
      coach: coachesById.get(entitlement.coachRoleId)?.name || "담당 코치",
      lessonDate,
      day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
      time: String(sourceLesson.startTime || "").slice(0, 5),
      durationMinutes: Number(entitlement.durationMinutes) || Number(sourceLesson.durationMinutes) || 20,
      status: entitlement.status,
      reason: entitlement.reason || "회원 불참",
      markedAt: entitlement.markedAt || "",
      bookedLessonId: entitlement.bookedLessonId || "",
      bookedAt: entitlement.bookedAt || "",
    };
  });
  state.liveReleasedMakeupSlots = (releasedMakeupSlots || []).map((slot) => ({
    id: slot.slot_id,
    coachRoleId: slot.coach_role_id,
    lessonDate: slot.lesson_date,
    time: String(slot.start_time || "").slice(0, 5),
    durationMinutes: Number(slot.duration_minutes) || 20,
  }));
  const oneDayOccupancy = (oneDaySlots || []).map((slot) => {
    const lessonDate = String(slot.booking_date || "");
    const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
    return {
      id: `one-day-${slot.id}`,
      oneDayBooking: true,
      serverOneDayBookingId: slot.id,
      lessonDate,
      day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
      time: String(slot.start_time || "").slice(0, 5),
      coach: coachesById.get(slot.coach_role_id)?.name || "담당 코치",
      coachRoleId: slot.coach_role_id,
      coach_role_id: slot.coach_role_id,
      member: "",
      type: "원데이 예약",
      lessonSource: "one_day",
      durationMinutes: Number(slot.duration_minutes) || 20,
      status: "occupied",
      isOwnLesson: false,
    };
  });
  const retainedLessons = (state.liveLessons || []).filter((lesson) => (
    lesson.lessonDate
    && (lesson.lessonDate < workspace.from || lesson.lessonDate > workspace.to)
  ));
  state.liveLessons = [...retainedLessons, ...mappedLessons, ...oneDayOccupancy]
    .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
  mergeScheduleV2MemberRecords(mappedLessons);
  state.liveLessonsLoaded = true;
  state.scheduleV2WorkspaceLoaded = true;
  state.scheduleV2SyncError = "";
  state.scheduleV2SyncErrorCode = "";
  state.scheduleV2LastSyncedAt = new Date().toISOString();
  renderMemberRuntimeDiagnostics();
  void memberScheduleRevisionWatcher?.check?.();
  return true;
}

async function syncMemberScheduleV2(profile = null, options = {}) {
  const client = window.TennisNoteDataClient;
  const requestId = options.requestId || ++memberScheduleV2RequestSequence;
  const context = memberScheduleV2Context(profile, options.week || activeMemberWeek());
  const { profileId, week, workspaceEndDate, key: cacheKey } = context;
  if (!client?.rpc || !client.getSession?.()?.access_token || !profileId) return false;
  const cached = memberScheduleV2WorkspaceCache;
  if (!options.force && cached?.key === cacheKey && Date.now() - cached.loadedAt < 10_000) {
    if (requestId !== memberScheduleV2RequestSequence) return false;
    const identityIssue = memberScheduleIdentityIssue(cached.workspace, cached.integrity, profileId);
    if (identityIssue) return rejectMemberScheduleIdentity(identityIssue, cached.integrity);
    state.scheduleV2Integrity = cached.integrity || null;
    const applied = applyScheduleV2MemberWorkspace(cached.workspace, cached.releasedMakeupSlots, cached.oneDaySlots);
    if (applied) state.scheduleV2LoadedKey = cacheKey;
    return applied;
  }
  try {
    const [workspace, releasedMakeupSlots, oneDaySlots, integrity] = await Promise.all([
      client.rpc("tn_schedule_v2_member_workspace", {
        target_from: week.startDate,
        target_to: workspaceEndDate,
      }),
      client.rpc("tn_member_released_makeup_slots", {}).catch(() => []),
      client.rpc("tn_member_one_day_schedule_slots", {}).catch(() => []),
      client.rpc("tn_current_member_schedule_integrity", {}).catch(() => null),
    ]);
    if (requestId !== memberScheduleV2RequestSequence) return false;
    if (!workspace?.actorUserId || !Array.isArray(workspace.lessons)) return false;
    const branchIds = [...new Set((workspace.branches || []).map((branch) => branch.id).filter(Boolean))];
    const operationDays = (await Promise.all(branchIds.map((branchId) => (
      client.rpc("tn_schedule_v2_operation_days_between", {
        target_branch_id: branchId,
        target_from: week.startDate,
        target_to: workspaceEndDate,
      }).catch(() => [])
    )))).flat();
    if (requestId !== memberScheduleV2RequestSequence) return false;
    workspace.operationDays = operationDays;
    state.scheduleOperationDays = operationDays;
    const identityIssue = memberScheduleIdentityIssue(workspace, integrity, profileId);
    if (identityIssue) return rejectMemberScheduleIdentity(identityIssue, integrity);
    memberScheduleV2WorkspaceCache = {
      key: cacheKey,
      loadedAt: Date.now(),
      workspace,
      releasedMakeupSlots: Array.isArray(releasedMakeupSlots) ? releasedMakeupSlots : [],
      oneDaySlots: Array.isArray(oneDaySlots) ? oneDaySlots : [],
      integrity,
    };
    state.scheduleV2Integrity = integrity || null;
    const applied = applyScheduleV2MemberWorkspace(
      workspace,
      memberScheduleV2WorkspaceCache.releasedMakeupSlots,
      memberScheduleV2WorkspaceCache.oneDaySlots,
    );
    if (applied) state.scheduleV2LoadedKey = cacheKey;
    return applied;
  } catch (error) {
    const text = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_schedule_v2_member_workspace|PGRST202|42883|schema cache/i.test(text)) {
      console.warn("Tennis Note Schedule V2 member feed failed; using the compatible feed.", error);
    }
    return false;
  }
}

async function syncMemberLessonsFromServer(profile = null, options = {}) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.rpc || !client.getSession?.()?.access_token || !profileId) return false;
  const requestId = options.requestId || ++memberScheduleV2RequestSequence;
  if (await syncMemberScheduleV2(profile, { ...options, requestId })) return true;
  if (requestId !== memberScheduleV2RequestSequence) return false;
  if (state.scheduleV2SyncErrorCode && state.scheduleV2SyncErrorCode !== "member_schedule_load_failed") {
    state.liveLessonsLoaded = true;
    renderMemberRuntimeDiagnostics();
    return false;
  }
  if (!state.scheduleV2WorkspaceLoaded) {
    state.liveLessons = [];
    state.liveMakeupEntitlements = [];
    state.liveReleasedMakeupSlots = [];
  }
  state.liveLessonsLoaded = true;
  state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
  state.scheduleV2SyncErrorCode = "member_schedule_load_failed";
  renderMemberRuntimeDiagnostics();
  return false;
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
async function syncLegacyMemberLessonsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    if (await syncMemberScheduleV2(profile)) return true;
    const participants = await client.selectRows("tn_lesson_participants", {
      select: "lesson_id,ticket_id,user_id",
      filters: { user_id: profileId },
      limit: 100,
    });
    const ownLessonIds = new Set((participants || []).map((item) => item.lesson_id));
    const [scheduleRows, coachRoles, makeupEntitlementRows, releasedMakeupSlots, oneDaySlots] = await Promise.all([
      client.selectRows("tn_lessons", {
        select: "id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source",
        limit: 1000,
      }),
      client.selectRows("tn_coach_roles", {
        select: "id,display_name,color,status",
        filters: { status: "approved" },
        limit: 50,
      }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", {
        select: "id,source_lesson_id,ticket_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at",
        limit: 100,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_member_released_makeup_slots", {}).catch(() => [])
        : Promise.resolve([]),
      client.rpc
        ? client.rpc("tn_member_one_day_schedule_slots", {}).catch(() => [])
        : Promise.resolve([]),
    ]);
    const loadedLessonIds = new Set((scheduleRows || []).map((lesson) => lesson.id));
    const missingOwnLessonIds = [...ownLessonIds].filter((lessonId) => !loadedLessonIds.has(lessonId));
    const missingOwnLessonRows = missingOwnLessonIds.length
      ? await Promise.all(missingOwnLessonIds.map((lessonId) =>
        client.selectRows("tn_lessons", {
          select: "id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source",
          filters: { id: lessonId },
          limit: 1,
        }).catch(() => [])))
      : [];
    const rows = [...(scheduleRows || []), ...missingOwnLessonRows.flat()]
      .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
    const coachNames = new Map((coachRoles || []).map((coach) => [coach.id, coach.display_name]));
    const lessonsById = new Map((rows || []).map((lesson) => [lesson.id, lesson]));
    const memberName = currentMemberName();
    state.liveMakeupEntitlements = (makeupEntitlementRows || [])
      .filter((entitlement) => ownLessonIds.has(entitlement.source_lesson_id))
      .map((entitlement) => {
        const sourceLesson = lessonsById.get(entitlement.source_lesson_id) || {};
        const lessonDate = sourceLesson.lesson_date || "";
        const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
        return {
          id: entitlement.id,
          sourceLessonId: entitlement.source_lesson_id,
          ticketId: entitlement.ticket_id,
          coachRoleId: entitlement.coach_role_id,
          coach: coachNames.get(entitlement.coach_role_id) || "담당 코치",
          lessonDate,
          day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
          time: String(sourceLesson.start_time || "").slice(0, 5),
          durationMinutes: Number(entitlement.duration_minutes) || Number(sourceLesson.duration_minutes) || 20,
          status: entitlement.status,
          reason: entitlement.reason || "회원 불참",
          markedAt: entitlement.marked_at || "",
          bookedLessonId: entitlement.booked_lesson_id || "",
          bookedAt: entitlement.booked_at || "",
        };
      });
    state.liveReleasedMakeupSlots = (releasedMakeupSlots || []).map((slot) => ({
      id: slot.slot_id,
      coachRoleId: slot.coach_role_id,
      lessonDate: slot.lesson_date,
      time: String(slot.start_time || "").slice(0, 5),
      durationMinutes: Number(slot.duration_minutes) || 20,
    }));
    const mappedLessons = (rows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const isOwnLesson = ownLessonIds.has(lesson.id);
        const ticket = (state.liveTickets || []).find((item) => item.id === lesson.member_ticket_id) || {};
        const lessonSource = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "코치변경"
              : "정규";
        const visibleStatus = isOwnLesson
          ? lesson.status === "pending_change" ? "requested" : lesson.status
          : "occupied";
        return {
          ...lesson,
          serverStatus: lesson.status,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: days[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: coachNames.get(lesson.coach_role_id) || "담당 코치",
          originalCoachRoleId: lesson.original_coach_role_id || "",
          member: isOwnLesson ? memberName : "",
          type: `${lessonSource} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketTotalSessions: Number(ticket.total) || 0,
          ticketUsedSessions: Number(ticket.used) || 0,
          ticketRemainingSessions: Number(ticket.remaining) || 0,
          ticketLessonMinutes: Number(ticket.lessonMinutes) || Number(lesson.duration_minutes) || 20,
          status: visibleStatus,
          isOwnLesson,
        };
      });
    const oneDayOccupancy = (oneDaySlots || []).map((slot) => {
      const lessonDate = slot.booking_date || "";
      const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
      return {
        id: `one-day-${slot.id}`,
        oneDayBooking: true,
        serverOneDayBookingId: slot.id,
        lessonDate,
        day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
        time: String(slot.start_time || "").slice(0, 5),
        coach: coachNames.get(slot.coach_role_id) || "담당 코치",
        coach_role_id: slot.coach_role_id,
        member: "",
        type: "원데이 예약",
        lessonSource: "one_day",
        durationMinutes: Number(slot.duration_minutes) || 20,
        status: "occupied",
        isOwnLesson: false,
      };
    });
    state.liveLessons = [...mappedLessons, ...oneDayOccupancy];
    state.liveLessonsLoaded = true;
    return true;
  } catch {
    state.liveLessons = [];
    state.liveMakeupEntitlements = [];
    state.liveReleasedMakeupSlots = [];
    state.liveLessonsLoaded = state.dataMode === "live";
    return false;
  }
}

async function syncMemberChangeRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    } catch {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    }
    const statusLabel = {
      pending: "변경 확인 중",
      approved: "변경 완료",
      rejected: "변경되지 않았습니다",
      auto_approved: "변경 완료",
      cancelled: "변경 요청 취소",
    };
    state.makeupRequests = (rows || [])
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((row) => {
        const sourceLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === row.lesson_id) || {};
        const originalDate = row.original_lesson_date || sourceLesson.lessonDate || "";
        const originalTime = String(row.original_start_time || sourceLesson.time || "").slice(0, 5);
        const targetDate = row.requested_lesson_date || "";
        const targetTime = String(row.requested_start_time || "").slice(0, 5);
        return {
          id: row.id,
          serverRequestId: row.id,
          lessonId: row.lesson_id,
          originalDate,
          originalTime,
          targetDate,
          targetTime,
          absence: `${compactLessonDateLabel(originalDate)} ${originalTime}`.trim(),
          makeup: `${compactLessonDateLabel(targetDate)} ${targetTime}`.trim(),
          reason: row.reason || "이유 미입력",
          policy: row.policy_window === "auto_before_24h" ? policyDetail("auto") : policyDetail("coach"),
          status: statusLabel[row.status] || row.status,
          rawStatus: row.status,
          editable: row.status === "pending",
          cancelable: ["pending", "approved", "auto_approved"].includes(row.status),
          cancelKind: "change",
          createdAt: row.created_at || "",
          source: "server",
        };
      });
    return true;
  } catch {
    return false;
  }
}

function liveLessonForJournal(log = {}) {
  const targetDate = log.journalDate || "";
  const targetTime = String(log.lessonLabel || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
  const candidates = state.liveLessons.filter((lesson) => lesson.isOwnLesson && lesson.status === "scheduled");
  return candidates.find((lesson) => lesson.id === log.lessonId)
    || candidates.find((lesson) => lesson.lessonDate === targetDate && lesson.time === targetTime)
    || candidates.find((lesson) => lesson.lessonDate === targetDate)
    || null;
}

async function syncMemberJournalEntriesFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.downloadObject || !profileId) return false;
  try {
    const [journalRows, mediaRows, recordRows, curriculumRows, lessonChartRows] = await Promise.all([
      client.selectRows("tn_journal_entries", {
        select: "id,user_id,lesson_id,entry_date,entry_type,body,created_at,updated_at",
        filters: { user_id: profileId },
        limit: 100,
      }),
      client.selectRows("tn_media_files", {
        select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
        filters: { owner_user_id: profileId },
        limit: 200,
      }),
      client.selectRows("tn_lesson_records", {
        select: "lesson_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_curriculum_refs", {
        select: "id,skill_label,title,notion_url,status",
        filters: { status: "active" },
        limit: 200,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_member_lesson_chart", {
          target_user_id: profileId,
          target_limit: 50,
        }).catch(() => [])
        : Promise.resolve([]),
    ]);
    const ownLessonIds = new Set(state.liveLessons.filter((lesson) => lesson.isOwnLesson).map((lesson) => lesson.id));
    const recordsByLesson = new Map((recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .map((record) => [record.lesson_id, record]));
    const curriculaById = new Map((curriculumRows || []).map((curriculum) => [curriculum.id, curriculum]));

    for (const row of (journalRows || []).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))) {
      const payload = parseServerJournalBody(row.body);
      if (!payload) continue;
      const rowsForJournal = (mediaRows || [])
        .filter((media) => media.journal_entry_id === row.id)
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      const mediaItems = await Promise.all(rowsForJournal.map((media, index) => (
        downloadServerMediaItem(client, media, payload.mediaNames?.[index] || `첨부 ${index + 1}`)
      )));
      const record = recordsByLesson.get(row.lesson_id);
      const recordCurriculum = curriculaById.get(record?.next_curriculum_ref_id);
      const nextCurriculumId = recordCurriculum?.skill_label || payload.nextCurriculumId || payload.curriculumId;
      const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
      const log = {
        id: payload.clientLogId || `server-journal-${row.id}`,
        serverJournalId: row.id,
        serverLessonId: row.lesson_id || "",
        lessonId: payload.lessonId || "",
        lessonLabel: payload.lessonLabel || "서버 수업기록",
        round: Number(payload.round) || lessonRound(),
        journalDate: row.entry_date,
        content: payload.content || "수업 내용 미입력",
        selfMemo: payload.selfMemo || "자기 운동 일지 미입력",
        mediaNames: payload.mediaNames || mediaItems.map((item) => item.name),
        mediaItems,
        status: record ? "confirmed" : "coach_pending",
        curriculum,
        nextCurriculumId: nextCurriculumId || curriculum.id,
        coachComment: record?.coach_comment || "",
        memberVisibleSummary: record ? `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}` : "",
        ticketDeducted: Boolean(record && Number(record.deducted_sessions) > 0),
        submittedAt: payload.submittedAt || row.created_at,
      };
      const existingIndex = state.lessonLogs.findIndex((item) => (
        item.serverJournalId === row.id
        || item.id === log.id
        || (row.lesson_id && String(item.serverLessonId || "") === String(row.lesson_id))
      ));
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = { ...state.lessonLogs[existingIndex], ...log };
      else state.lessonLogs.unshift(log);
    }

    const existingChartLessonIds = new Set(state.lessonLogs
      .map((item) => String(item.serverLessonId || ""))
      .filter(Boolean));
    const chartLogs = (Array.isArray(lessonChartRows) ? lessonChartRows : [])
      .filter((record) => record.lessonId && !existingChartLessonIds.has(String(record.lessonId)))
      .map((record, index) => {
        existingChartLessonIds.add(String(record.lessonId));
        const nextCurriculumId = record.nextCurriculumSkillLabel || "";
        const curriculum = nextCurriculumId ? curriculumById(nextCurriculumId, curriculumSteps[0]) : null;
        const outcomeLabel = {
          completed: "수업 완료",
          no_show: "노쇼",
          absence: "불참",
          cancelled: "취소",
          holiday: "휴무",
        }[String(record.outcome || "").toLowerCase()] || "수업 기록";
        const lessonType = scheduleV2MemberLessonKind(record.scheduleKind || "regular");
        return {
          id: `member-chart-${record.id || record.lessonId}`,
          serverJournalId: "",
          serverLessonId: record.lessonId,
          lessonId: `server-${record.lessonId}`,
          lessonLabel: `${record.startTime || ""} · ${record.coachName || "담당 코치"} · ${lessonType}`.replace(/^ · /, ""),
          round: Math.max(1, (Array.isArray(lessonChartRows) ? lessonChartRows.length : 1) - index),
          journalDate: record.lessonDate || String(record.finalizedAt || record.updatedAt || "").slice(0, 10),
          content: [record.technique, record.strength, record.improvement].filter(Boolean).join(" · ") || outcomeLabel,
          selfMemo: "회원 운동일지 미작성",
          mediaNames: [],
          mediaItems: [],
          status: "confirmed",
          curriculum,
          nextCurriculumId,
          coachComment: record.coachComment || "",
          memberVisibleSummary: record.nextGoal
            ? `다음 수업 목표: ${record.nextGoal}`
            : record.nextCurriculumTitle
              ? `다음 수업: ${record.nextCurriculumTitle}`
              : "",
          ticketDeducted: Number(record.deductedSessions) > 0,
          deductedSessions: Number(record.deductedSessions) || 0,
          participantOutcome: record.outcome || "completed",
          submittedAt: record.finalizedAt || record.updatedAt || "",
        };
      });
    if (chartLogs.length) state.lessonLogs = [...chartLogs, ...state.lessonLogs];

    const existingRecordLessonIds = new Set(state.lessonLogs
      .map((item) => item.serverLessonId)
      .filter(Boolean));
    const recordOnlyLogs = (recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .sort((left, right) => String(left.completed_at || "").localeCompare(String(right.completed_at || "")))
      .map((record, index) => ({ record, round: index + 1 }))
      .filter(({ record }) => !existingRecordLessonIds.has(record.lesson_id))
      .map(({ record, round }) => {
        const lesson = state.liveLessons.find((item) => item.id === record.lesson_id || item.serverLessonId === record.lesson_id) || {};
        const recordCurriculum = curriculaById.get(record.next_curriculum_ref_id);
        const nextCurriculumId = recordCurriculum?.skill_label || "FH-01";
        const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
        return {
          id: `server-record-${record.lesson_id}`,
          serverJournalId: "",
          serverLessonId: record.lesson_id,
          lessonId: lesson.id || `server-${record.lesson_id}`,
          lessonLabel: `${lesson.day || lesson.lessonDate || "수업"} ${lesson.time || ""} · ${lesson.type || "레슨"}`.trim(),
          round,
          journalDate: lesson.lessonDate || String(record.completed_at || "").slice(0, 10),
          content: "회원 운동일지 미작성 · 코치 수업기록",
          selfMemo: "운동일지 미작성",
          mediaNames: [],
          mediaItems: [],
          status: "confirmed",
          curriculum,
          nextCurriculumId,
          coachComment: record.coach_comment || "",
          memberVisibleSummary: `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}`,
          ticketDeducted: Number(record.deducted_sessions) > 0,
          submittedAt: record.completed_at,
        };
      })
      .reverse();
    if (recordOnlyLogs.length) state.lessonLogs = [...recordOnlyLogs, ...state.lessonLogs];
    return true;
  } catch (error) {
    console.warn("Tennis Note member journal sync failed", error);
    return false;
  }
}

async function persistLessonJournalToServer(log, files = []) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!profileId || !client?.insertRows || !client?.uploadObject || !client.getSession?.()?.access_token) return false;
  const liveLesson = liveLessonForJournal(log);
  const inserted = await client.insertRows("tn_journal_entries", {
    user_id: profileId,
    lesson_id: liveLesson?.id || null,
    entry_date: log.journalDate,
    entry_type: "lesson",
    practice_type: null,
    body: serverJournalBody(log),
  });
  const journal = inserted?.[0];
  if (!journal?.id) throw new Error("journal_insert_failed");

  const uploadedPaths = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storagePath = `${profileId}/${journal.id}/${safeJournalObjectName(file, index)}`;
      await client.uploadObject(journalMediaBucket, storagePath, file);
      uploadedPaths.push(storagePath);
      await client.insertRows("tn_media_files", {
        owner_user_id: profileId,
        journal_entry_id: journal.id,
        storage_path: storagePath,
        media_type: journalMediaType(file),
      });
    }
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((storagePath) => client.deleteObject(journalMediaBucket, storagePath)));
    await client.deleteRows?.("tn_journal_entries", { id: journal.id }).catch(() => {});
    throw error;
  }

  log.serverJournalId = journal.id;
  log.serverLessonId = liveLesson?.id || "";
  return true;
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

function showNoticeIfNeeded() {
  const today = localDateKey();
  const activeNotices = activeNoticesForApp("member");
  const hiddenToday = new Set(state.noticeHiddenDate === today
    ? [...(Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : []), state.noticeHiddenId].filter(Boolean)
    : []);
  const notice = activeNotices.find((item) => !noticeSessionSeenIds.has(item.id) && !(item.showOncePerDay && hiddenToday.has(item.id)));
  if (!notice) {
    setNoticeDialogOpen(false);
    return;
  }
  const noticeIndex = activeNotices.findIndex((item) => item.id === notice.id);
  $("#noticeEyebrow").textContent = notice.source === "coupon-booking" ? "회원권 알림" : "공지사항";
  $("#noticeTitle").textContent = notice.title;
  $("#noticeBody").textContent = notice.body;
  $("#noticeMeta").textContent = `${noticeMetaText(notice)} · ${noticeIndex + 1}/${activeNotices.length}`;
  const noticeImage = $("#noticeImage");
  noticeImage.hidden = !notice.imageUrl;
  noticeImage.src = notice.imageUrl || "";
  noticeImage.alt = notice.imageAlt || notice.title;
  const noticeAction = $("#noticeAction");
  const safeActionUrl = /^https?:\/\//i.test(notice.actionUrl) ? notice.actionUrl : "";
  const actionRoute = notice.actionRoute === "schedule" ? "schedule" : "";
  const hasAction = Boolean(safeActionUrl || actionRoute);
  noticeAction.hidden = !hasAction;
  noticeAction.href = safeActionUrl || "#";
  noticeAction.dataset.route = actionRoute;
  noticeAction.target = safeActionUrl ? "_blank" : "_self";
  noticeAction.textContent = notice.actionLabel || "자세히 보기";
  $("#noticeDialog").dataset.noticeId = notice.id;
  setNoticeDialogOpen(true);
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

function closeNotice(hideToday = false) {
  const noticeId = $("#noticeDialog")?.dataset.noticeId || "";
  if (noticeId) noticeSessionSeenIds.add(noticeId);
  if (hideToday) {
    const today = localDateKey();
    const previousIds = state.noticeHiddenDate === today && Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : [];
    state.noticeHiddenDate = today;
    state.noticeHiddenId = noticeId;
    state.noticeHiddenIds = [...new Set([...previousIds, noticeId].filter(Boolean))];
  }
  setNoticeDialogOpen(false);
  saveSnapshot();
  window.setTimeout(showNoticeIfNeeded, 0);
}

function savePracticeLog() {
  const mediaItems = mediaItemsFromInput($("#practiceMedia"));
  const mediaNames = mediaItems.map((file) => file.name);
  const requestFeedback = $("#requestCoachFeedback")?.checked;
  const journalDate = $("#journalDate")?.value || localDateKey();
  const log = {
    id: `practice-${Date.now()}`,
    date: new Date(`${journalDate}T00:00:00`).toLocaleDateString("ko-KR"),
    journalDate,
    type: $("#practiceType").value,
    memo: $("#practiceMemo").value.trim() || "운동 기록 미입력",
    next: $("#practiceNext").value.trim() || "다음 연습 계획 미입력",
    mediaNames,
    mediaItems,
    feedbackQuestion: $("#feedbackQuestion")?.value.trim() || "",
    feedbackStatus: requestFeedback ? "코치 피드백 요청" : "개인 기록",
    coachFeedback: "",
    submittedAt: new Date().toISOString(),
  };
  state.practiceLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  if (requestFeedback) pushPracticeFeedbackToShared(log);
  renderAll();
}

function requestProduct(productId) {
  const product = membershipProducts().find((item) => item.id === productId);
  if (!product) return;
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: product.amount ? `${product.amount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: product.amount ? "결제 링크/입금 확인 대기" : "관리자 상담 필요",
    status: product.amount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`,
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: `local_${Date.now()}_${product.id}`,
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
  state.ticketHistory.unshift({ text: `${product.title} 구매 요청 생성 · ${product.coach}`, tone: product.amount ? "wait" : "done" });
  renderAll();
  setView("shopView");
}

function createPaymentRecord(product, overrides = {}) {
  const methodId = overrides.methodId || state.selectedPaymentMethod;
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: paymentAmount ? `${paymentAmount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: overrides.method || (paymentAmount ? "결제 확인 대기" : "관리자 상담 필요"),
    status: overrides.status || (paymentAmount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`),
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: overrides.paymentId || "",
    serverPaymentId: overrides.serverPaymentId || "",
    bankTransferAccount: overrides.bankTransferAccount || null,
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
}

function hasLiveMemberSession() {
  const client = window.TennisNoteDataClient;
  return Boolean(client?.readiness?.().ready && client.getSession?.()?.access_token);
}

function markTicketSyncLoginNeeded() {
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    if (hasLiveMemberSession()) {
      state.ticketSyncStatus = {
        tone: "alert",
        text: "서버 회원 연결 확인 필요 · 관리자 승인/회원권 확인",
      };
      return;
    }
    state.ticketSyncStatus = {
      tone: "wait",
      text: "서버 로그인 필요 · 간편 로그인 후 실제 회원권 확인",
    };
    return;
  }
  state.ticketSyncStatus = { tone: "alert", text: "실사용 데이터 연결 설정이 필요합니다" };
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

async function syncMemberGroupAccountFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const ownRows = await client.selectRows("tn_group_account_members", {
      select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
      filters: { user_id: profileId },
      limit: 20,
    });
    const activeGroupAccountId = currentLiveTicket()?.groupAccountId || "";
    const ownMembership = (ownRows || []).find((row) => row.group_account_id === activeGroupAccountId) || ownRows?.[0];
    if (!ownMembership?.group_account_id) {
      state.groupAccount = null;
      return true;
    }
    const [accountRows, memberRows] = await Promise.all([
      client.selectRows("tn_group_accounts", {
        select: "id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required",
        filters: { id: ownMembership.group_account_id },
        limit: 1,
      }),
      client.selectRows("tn_group_account_members", {
        select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
        filters: { group_account_id: ownMembership.group_account_id },
        limit: 2,
      }),
    ]);
    const account = accountRows?.[0];
    if (!account) {
      state.groupAccount = null;
      return true;
    }
    let coachName = "담당 코치";
    if (account.coach_role_id) {
      const coachRows = await client.selectRows("tn_coach_roles", {
        select: "id,display_name",
        filters: { id: account.coach_role_id },
        limit: 1,
      }).catch(() => []);
      coachName = coachRows?.[0]?.display_name || coachName;
    }
    const members = [...(memberRows || [])]
      .sort((a, b) => Number(a.participant_order) - Number(b.participant_order))
      .map((member, index) => ({
        userId: member.user_id,
        name: member.display_name || `회원 ${index + 1}`,
        appStatus: member.app_status || "not_joined",
        canManageSchedule: member.can_manage_schedule === true,
        canPay: member.can_pay === true,
      }));
    state.groupAccount = {
      id: account.id,
      demoOnly: false,
      name: account.display_name || members.map((member) => member.name).join(" · "),
      schedule: "공동 시간표",
      coach: coachName,
      paymentMode: account.payment_mode || "representative",
      nextPayerUserId: account.next_payer_user_id || "",
      nextPayer: members.find((member) => member.userId === account.next_payer_user_id)?.name || members[0]?.name || "대표회원",
      scheduleSyncRequired: account.schedule_sync_required !== false,
      members,
    };
    return true;
  } catch {
    state.groupAccount = null;
    return false;
  }
}

async function syncMemberHoldingRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_holding_requests", {
      select: "id,ticket_id,request_type,requested_start_on,requested_end_on,reason_summary,evidence_object_path,evidence_status,status,reviewed_at,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const shared = loadSharedData();
    const otherMembers = (shared.holdingRequests || []).filter((request) => request.member !== (state.member?.name || state.profile.name));
    const ownRequests = (rows || []).map((row) => ({
      id: row.id,
      member: state.member?.name || state.profile.name,
      ticketId: row.ticket_id,
      ticketTitle: state.profile.ticket || "회원권",
      type: row.request_type,
      typeLabel: row.request_type === "injury" ? "부상·입원" : "개인 사유",
      startDate: row.requested_start_on,
      endDate: row.requested_end_on,
      days: holdingRequestDays(row.requested_start_on, row.requested_end_on),
      reason: row.reason_summary || "",
      evidencePath: row.evidence_object_path || "",
      evidenceLabel: row.request_type === "injury" ? "증빙 첨부" : "증빙 없음",
      status: row.status || "pending",
      source: "server",
      reviewedAt: row.reviewed_at || "",
      createdAt: row.created_at || "",
    }));
    shared.holdingRequests = [...ownRequests, ...otherMembers];
    saveSharedData(shared);
    return true;
  } catch {
    return false;
  }
}

async function syncMemberAccountDeletionRequestFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "*",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.accountDeletionRequest = (rows || [])
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0] || null;
    renderAccountDeletionSettings();
    return true;
  } catch {
    state.accountDeletionRequest = null;
    renderAccountDeletionSettings();
    return false;
  }
}

async function syncMemberHoldingPolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: holdingPolicyKey },
      limit: 1,
    });
    if (rows?.[0]?.value) state.holdingPolicySettings = { ...state.holdingPolicySettings, ...rows[0].value };
    return true;
  } catch {
    return false;
  }
}

async function syncLiveMembershipProductsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_membership_products", {
      select: "id,branch_id,product_code,name,lesson_minutes,machine_minutes,frequency_per_week,total_sessions,group_size,schedule_scope,term_weeks,card_price,cash_price,settlement_base_price,validity_days,grace_days,product_kind,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,is_active,policy_settings,display_order",
      filters: { is_active: true },
      limit: 500,
    });
    const products = (rows || [])
      .filter((row) => numericValue(row.card_price) > 0)
      .sort((left, right) => numericValue(left.display_order, 999) - numericValue(right.display_order, 999))
      .map(membershipProductFromServer);
    state.liveMembershipProducts = products;
    await syncMembershipPricingQuotesFromServer(products);
    return products.length > 0;
  } catch {
    if (state.dataMode === "live") {
      state.liveMembershipProducts = [];
      state.membershipPricingQuotes = {};
    }
    return false;
  }
}

async function syncMembershipPricingQuotesFromServer(products = state.liveMembershipProducts) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    state.membershipPricingQuotes = {};
    return false;
  }
  const targets = (products || []).filter((product) => (
    isOneDayMembershipProduct(product) && product.firstLessonOfferEnabled === true
  ));
  const entries = await Promise.all(targets.map(async (product) => {
    try {
      const quote = await client.invokeFunction("portone-payment/quote", {
        body: {
          branchId: product.branchId || null,
          productId: product.id,
          productKey: product.productCode || product.id,
        },
      });
      return [String(product.id), quote?.ok ? quote : null];
    } catch {
      return [String(product.id), null];
    }
  }));
  state.membershipPricingQuotes = Object.fromEntries(entries.filter(([, quote]) => quote));
  return true;
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

async function syncMemberTicketsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;

  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,frequency_per_week,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,validity_days,grace_days)",
        filters: { user_id: profileId },
        limit: 20,
      });
    } catch {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
        filters: { user_id: profileId },
        limit: 20,
      });
    }

    const sharedLinks = await client.selectRows("tn_group_ticket_links", {
      select: "group_account_id,ticket_id,status",
      filters: { user_id: profileId },
      limit: 20,
    }).catch(() => []);
    const activeSharedLinks = (sharedLinks || [])
      .filter((link) => !["pending_payment", "expired", "refunded"].includes(String(link.status || "").toLowerCase()));
    const sharedTicketIds = new Set(activeSharedLinks
      .map((link) => link.ticket_id)
      .filter(Boolean));
    const sharedAccountIdByTicketId = new Map(activeSharedLinks
      .filter((link) => link.ticket_id && link.group_account_id)
      .map((link) => [link.ticket_id, link.group_account_id]));
    const ownedTicketIds = new Set((rows || []).map((row) => row.id));
    const sharedTicketRows = await Promise.all(activeSharedLinks
      .filter((link) => link.ticket_id && !ownedTicketIds.has(link.ticket_id))
      .map(async (link) => {
        try {
          return await client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,frequency_per_week,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,validity_days,grace_days)",
            filters: { id: link.ticket_id },
            limit: 1,
          });
        } catch {
          return client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
            filters: { id: link.ticket_id },
            limit: 1,
          }).catch(() => []);
        }
      }));
    rows = [...(rows || []), ...sharedTicketRows.flat()]
      .filter((row) => String(row.status || "").toLowerCase() !== "pending_payment")
      .map((row) => ({
        ...row,
        shared_group_ticket: sharedTicketIds.has(row.id),
        shared_group_account_id: sharedAccountIdByTicketId.get(row.id) || "",
      }));

    rows = await attachLiveTicketProducts(client, rows || []);
    rows = await attachLiveTicketPayments(client, rows || []);
    state.liveTickets = Array.isArray(rows) ? rows.map(normalizeLiveTicket) : [];
    const paymentRequestsChanged = reconcileVerifiedPaymentRequests();
    const ticket = currentLiveTicket() || upcomingLiveTickets()[0] || null;
    if (!ticket) {
      state.remaining = 0;
      state.profile.ticket = "현재 이용권 없음";
      state.ticketSyncStatus = { tone: "wait", text: "현재 이용 가능한 회원권 없음 · 결제 또는 관리자 충전 필요" };
      return true;
    }

    if (ticket.total) {
      state.remaining = ticket.remaining;
      state.profile.ticket = `${ticket.title} · 총 ${ticket.total}회`;
    }
    if (currentLiveTickets().length && state.member) state.member.memberKind = "lesson_member";
    const derivedStatusLabel = window.TennisNoteTicketState?.label?.(ticket) || ticket.statusLabel;
    state.ticketSyncStatus = {
      tone: ticket.tone,
      text: `${derivedStatusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
    };
    const syncKey = `${ticket.id}:${ticket.status}:${ticket.remaining}:${ticket.total}`;
    if (syncKey !== state.lastLiveTicketKey) {
      state.lastLiveTicketKey = syncKey;
      state.ticketHistory.unshift({
        text: `${ticket.title} · ${derivedStatusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
        tone: ticket.tone,
      });
    }
    if (paymentRequestsChanged) saveSnapshot();
    return true;
  } catch {
    state.liveTickets = [];
    state.remaining = 0;
    state.profile.ticket = "회원권 확인 필요";
    state.ticketSyncStatus = { tone: "alert", text: "서버 회원권 확인 실패 · 다시 로그인하거나 관리자에게 문의해주세요" };
    return false;
  }
}

async function prepareServerPayment(product, paymentId, methodId = state.selectedPaymentMethod) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  const paymentAmount = purchasePaymentAmount(product, methodId);
  const enforcedMethodId = paymentMethodIdForRequest(methodId);
  if (!isPaymentGatewayReady(enforcedMethodId)) throw new Error("payment_channel_not_ready");
  const purchaseFlow = purchaseFlowState();
  return client.invokeFunction("portone-payment/prepare", {
    body: {
      paymentId,
      branchId: product.branchId || null,
      productKey: product.id,
      productTitle: product.title,
      amount: paymentAmount,
      originalAmount: product.cardAmount || product.listAmount || paymentAmount,
      cashPrice: product.cashAmount || product.settlementBase || paymentAmount,
      settlementBaseAmount: product.settlementBase || product.cashAmount || paymentAmount,
      finalAmount: paymentAmount,
      priceType: enforcedMethodId === "bank_transfer" ? "cash" : "card",
      totalSessions: product.tickets || 1,
      lessonMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      machineMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      productKind: product.productKind === "pass" || product.mode === "coupon" || product.mode === "pass" ? "coupon" : product.mode === "add" ? "add" : product.mode === "renewal" ? "renewal" : "regular",
      groupSize: Number(product.groupSize) || (product.title.includes("2대1") || product.detail.includes("2대1") || product.detail.includes("2:1") ? 2 : 1),
      validityDays: Number(product.validityDays) || 35,
      graceDays: Number(product.graceDays) || 0,
      method: enforcedMethodId,
      groupAccountId: Number(product.groupSize) === 2 ? state.groupAccount?.id || null : null,
      coachRoleId: purchaseFlow.productId === product.id ? purchaseFlow.coachRoleId || null : null,
      preferredDate: purchaseFlow.productId === product.id ? purchaseFlow.preferredDate || null : null,
      preferredDay: purchaseFlow.productId === product.id ? purchaseFlow.preferredDay || null : null,
      preferredTime: purchaseFlow.productId === product.id ? purchaseFlow.preferredTime || null : null,
      preferredSchedules: purchaseFlow.productId === product.id
        ? purchaseSelectedSchedules(product).map((schedule) => ({
          lessonDate: schedule.lessonDate,
          day: schedule.day,
          startTime: schedule.startTime,
          durationMinutes: schedule.durationMinutes,
          coachRoleId: schedule.coachRoleId,
        }))
        : [],
      scheduleMode: purchaseFlow.productId === product.id ? purchaseFlow.scheduleMode || "change" : "change",
      renewalSourceTicketId: purchaseFlow.productId === product.id ? purchaseFlow.renewalTicketId || null : null,
      purchasePurpose: purchaseFlow.productId === product.id ? purchaseFlow.purchasePurpose || "new_purchase" : "new_purchase",
      discountIssueId: purchaseFlow.productId === product.id ? purchaseFlow.discountIssueId || null : null,
    },
  });
}

async function verifyServerPayment(paymentId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  return client.invokeFunction("portone-payment/verify", {
    body: { paymentId },
  });
}

function clearPaymentRedirectParams() {
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function handlePaymentRedirectResult() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("paymentId") || "";
  if (!paymentId) return false;
  const errorCode = params.get("code") || "";
  const message = params.get("message") || params.get("pgMessage") || "";
  clearPaymentRedirectParams();
  if (errorCode) {
    await reconcileRejectedServerPayment(paymentId);
    await syncMemberTicketsFromServer();
    state.pendingPaymentCheckStatus = { tone: "alert", text: message || "결제가 완료되지 않았습니다." };
    state.ticketHistory.unshift({ text: message || `결제 미완료 · ${errorCode}`, tone: "alert" });
    renderAll();
    setView("shopView");
    return true;
  }
  try {
    const verification = await verifyServerPayment(paymentId);
    state.pendingPaymentCheckStatus = verification?.ok
      ? { tone: "done", text: "결제 검증이 끝났습니다. 회원권 상태를 확인합니다." }
      : { tone: "wait", text: "결제 접수 후 서버 검증을 기다리는 중입니다." };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 서버 검증 완료", tone: verification?.ok ? "done" : "wait" });
    const flow = purchaseFlowState();
    flow.open = true;
    flow.step = 4;
    flow.completionStatus = verification?.ok ? "결제가 확인되었습니다" : "결제가 접수되었습니다";
  } catch (error) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제 검증 확인 필요 · ${paymentServerErrorMessage(error)}` };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 관리자 검증 확인 필요", tone: "alert" });
  }
  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
  return true;
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

async function cancelPendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || null;
  const paymentId = ticket?.providerPaymentId || "";
  if (!ticket || !paymentId) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "취소할 결제 대기 기록을 찾지 못했습니다." };
    renderAll();
    setView("shopView");
    return;
  }
  if (pendingPaymentCancelInFlight.has(paymentId)) return;
  if (!window.confirm(`${ticket.title || "회원권"} 결제 대기를 취소할까요?\n실제 결제가 완료된 회원권은 취소되지 않습니다.`)) return;

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "로그인 상태를 확인한 뒤 다시 시도해 주세요." };
    renderAll();
    return;
  }

  pendingPaymentCancelInFlight.add(paymentId);
  state.pendingPaymentCheckStatus = { tone: "wait", text: "결제 대기건을 취소하는 중입니다." };
  renderAll();
  try {
    const result = await client.invokeFunction("portone-payment/cancel-pending", {
      body: { paymentId, reason: "회원 결제 대기 취소" },
    });
    if (!result?.ok) throw Object.assign(new Error(result?.code || "pending_payment_cancel_failed"), { payload: result });
    state.pendingPaymentCheckStatus = { tone: "done", text: "결제 대기건을 취소했습니다." };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제 대기 취소`, tone: "done" });
  } catch (error) {
    const detail = paymentServerErrorMessage(error);
    state.pendingPaymentCheckStatus = { tone: "alert", text: detail };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제 대기 취소 실패 · ${detail}`, tone: "alert" });
  } finally {
    pendingPaymentCancelInFlight.delete(paymentId);
  }

  await Promise.allSettled([syncMemberTicketsFromServer(), syncMemberDiscountCouponsFromServer()]);
  renderAll();
  setView("shopView");
}

function closePaymentConfirmationModal() {
  closeAppModal("paymentConfirmationModal");
  preparedPaymentContext = null;
}

function openPaymentConfirmationModal({ product, paymentId, preparedPayment, methodId, sdk }) {
  const enforcedMethodId = paymentMethodIdForRequest(methodId);
  preparedPaymentContext = { product, paymentId, preparedPayment, methodId: enforcedMethodId, sdk };
  const modal = $("#paymentConfirmationModal");
  if (!modal) return;
  const amount = purchasePaymentAmount(product, enforcedMethodId);
  const method = paymentMethodDefinition(enforcedMethodId);
  $("#paymentConfirmationProduct").textContent = product.title;
  $("#paymentConfirmationAmount").textContent = `${amount.toLocaleString("ko-KR")}원`;
  $("#paymentConfirmationMethod").textContent = method.label;
  $("#paymentConfirmationMessage").textContent = "결제창에서 결제 정보를 확인한 뒤 최종 결제를 완료합니다.";
  const button = $("#openPreparedPaymentButton");
  if (button) {
    button.disabled = false;
    button.textContent = `${amount.toLocaleString("ko-KR")}원 결제창 열기`;
  }
  openAppModal("paymentConfirmationModal", "#openPreparedPaymentButton");
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

function lockAppSheetBackground() {
  if (appSheetScrollLock) return;
  const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
  appSheetScrollLock = {
    scrollY,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLeft: document.body.style.left,
    bodyRight: document.body.style.right,
    bodyWidth: document.body.style.width,
    htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
  };
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.documentElement.style.overscrollBehavior = "none";
}

function unlockAppSheetBackground() {
  if (!appSheetScrollLock) return;
  const saved = appSheetScrollLock;
  appSheetScrollLock = null;
  document.body.style.position = saved.bodyPosition;
  document.body.style.top = saved.bodyTop;
  document.body.style.left = saved.bodyLeft;
  document.body.style.right = saved.bodyRight;
  document.body.style.width = saved.bodyWidth;
  document.documentElement.style.overscrollBehavior = saved.htmlOverscrollBehavior;
  window.scrollTo({ top: saved.scrollY, left: 0, behavior: "auto" });
}

function refreshAppSheetState() {
  const sheetOpen = Boolean(activeAppSheetId);
  document.body.classList.toggle("sheet-open", sheetOpen);
  if (sheetOpen) lockAppSheetBackground();
  else unlockAppSheetBackground();
}

function openAppSheet(sheetId, options = {}) {
  const target = $(`#${sheetId}`);
  if (!target) return;
  if (activeAppSheetId && activeAppSheetId !== sheetId) {
    closeAppSheet(activeAppSheetId, true, { restoreFocus: false, immediate: true });
  }
  activeAppSheetId = sheetId;
  if (window.TennisNoteBottomSheet?.open?.(target, options)) return;
  target.hidden = false;
  refreshAppSheetState();
  if (options.history !== false) {
    const historyState = typeof history.state === "object" && history.state ? history.state : {};
    if (historyState.tennisNoteSheet !== sheetId) {
      history.pushState({ ...historyState, tennisNoteSheet: sheetId }, "", window.location.href);
    }
  }
}

function closeAppSheet(sheetId, fromHistory = false, options = {}) {
  const target = $(`#${sheetId}`);
  if (!target) return false;
  if (activeAppSheetId === sheetId) activeAppSheetId = "";
  if (window.TennisNoteBottomSheet?.close?.(target, { ...options, fromHistory })) return true;
  target.hidden = true;
  refreshAppSheetState();
  if (!fromHistory && history.state?.tennisNoteSheet === sheetId) history.back();
  return true;
}

function closeVisibleAppSheet(fromHistory = false, options = {}) {
  const trackedSheet = activeAppSheetId ? $(`#${activeAppSheetId}`) : null;
  const visibleSheet = trackedSheet && !trackedSheet.hidden
    ? trackedSheet
    : document.querySelector(".app-bottom-sheet:not([hidden])");
  if (!visibleSheet?.id) return false;
  closeAppSheet(visibleSheet.id, fromHistory, options);
  return true;
}

function refreshAppModalState() {
  const modalOpen = Boolean(activeAppModalId);
  document.body.classList.toggle("modal-open", modalOpen);
  const tabbar = $(".tabbar");
  if (tabbar) {
    if (modalOpen) tabbar.setAttribute("aria-hidden", "true");
    else tabbar.removeAttribute("aria-hidden");
  }
}

function openAppModal(modalId, focusSelector = "") {
  const target = $(`#${modalId}`);
  if (!target) return;
  if (activeAppModalId && activeAppModalId !== modalId) closeAppModal(activeAppModalId, true);
  appModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  target.hidden = false;
  activeAppModalId = modalId;
  refreshAppModalState();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteModal !== modalId) {
    history.pushState({ ...historyState, tennisNoteModal: modalId }, "", window.location.href);
  }
  window.setTimeout(() => {
    const preferred = focusSelector ? target.querySelector(focusSelector) : null;
    const focusTarget = preferred && !preferred.disabled ? preferred : focusableElements(target)[0];
    focusTarget?.focus({ preventScroll: true });
  }, 40);
}

function closeAppModal(modalId, fromHistory = false) {
  const target = $(`#${modalId}`);
  if (!target) return;
  target.hidden = true;
  if (activeAppModalId === modalId) activeAppModalId = "";
  refreshAppModalState();
  if (!fromHistory && history.state?.tennisNoteModal === modalId) {
    history.back();
    return;
  }
  appModalReturnFocus?.focus?.({ preventScroll: true });
  appModalReturnFocus = null;
}

function closeVisibleAppModal(fromHistory = false) {
  const trackedModal = activeAppModalId ? $(`#${activeAppModalId}`) : null;
  const visibleModal = trackedModal && !trackedModal.hidden
    ? trackedModal
    : document.querySelector(".change-request-modal:not([hidden]), .modal:not([hidden])");
  if (!visibleModal?.id) return false;
  closeAppModal(visibleModal.id, fromHistory);
  return true;
}

function openJournalComposer(dateValue = "") {
  const selectedDate = dateValue || state.selectedJournalDate || $("#journalDate")?.value || localDateKey();
  selectJournalDate(selectedDate);
  if ($("#journalDate")) $("#journalDate").value = selectedDate;
  if ($("#journalComposerDateLabel")) $("#journalComposerDateLabel").textContent = journalDateLabel(selectedDate);
  renderJournalMode();
  const initialFocus = $("#journalMode")?.value === "lesson" ? "#todayLessonContent" : "#practiceMemo";
  openAppSheet("journalComposerSheet", { initialFocus });
}

function openProfileEditor(focusNtrp = false) {
  openAppSheet("profileEditorSheet", {
    initialFocus: focusNtrp ? "#profileSelfNtrp" : "",
  });
}

function openMembershipDetails(detailsId) {
  const target = $(`#${detailsId}`);
  if (!target) return;
  target.open = true;
  let ancestor = target.parentElement?.closest("details");
  while (ancestor) {
    ancestor.open = true;
    ancestor = ancestor.parentElement?.closest("details");
  }
  window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function openJournalDetail(id) {
  const entry = journalEntries().find((item) => item.id === id);
  if (!entry) return;
  const curriculumBlock = entry.curriculumStep
    ? `
      <section class="journal-curriculum-card">
        <span>다음 수업 커리큘럼</span>
        <strong>${entry.curriculumStep.id} · ${entry.curriculumStep.title}</strong>
        <p>${entry.curriculumStep.focus}</p>
        <a class="small-button notion-link" href="${entry.curriculumStep.notionUrl || "https://www.notion.so/"}" target="_blank" rel="noreferrer">노션에서 자세히 보기</a>
      </section>`
    : "";
  const attendanceBlock = entry.kind === "레슨"
    ? `<div class="journal-lesson-result"><span>${{
      completed: "수업 완료",
      no_show: "노쇼",
      absence: "불참",
      cancelled: "취소",
      holiday: "휴무",
    }[String(entry.outcome || "").toLowerCase()] || "수업 기록"}</span><strong>${Number(entry.deductedSessions) > 0 ? `${Number(entry.deductedSessions)}회 차감` : "차감 없음"}</strong></div>`
    : "";
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${entry.title}</h2>
      <span>${entry.subtitle || entry.dateLabel}</span>
    </div>
    <article class="journal-detail-card">
      ${attendanceBlock}
      <section class="journal-feedback-block member-note">
        <strong>내 기록</strong>
        <p>${entry.body || "작성한 기록이 없습니다."}</p>
      </section>
      ${entry.mediaItems?.length ? `<strong>첨부</strong>${renderMediaPreview(entry.mediaItems)}` : ""}
      <section class="journal-feedback-block coach-note">
        <strong>코치 피드백</strong>
        <p>${entry.note || "코치 피드백을 기다리고 있습니다."}</p>
      </section>
      ${entry.next ? `<section class="journal-feedback-block next-note"><strong>다음 수업</strong><p>${entry.next}</p></section>` : ""}
      ${curriculumBlock}
    </article>`;
  $("#journalDetailModal").hidden = false;
}

function openJournalDay(day) {
  const monthValue = state.activeJournalMonth || new Date().toISOString().slice(0, 7);
  const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
  const entries = journalEntries().filter((item) => item.dateValue === dateValue);
  if (!entries.length) return;
  if (entries.length === 1) {
    openJournalDetail(entries[0].id);
    return;
  }
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${day}일 운동 기록</h2>
      <span>하루에 작성한 기록을 모두 확인합니다.</span>
    </div>
    <div class="journal-entry-list">
      ${entries
        .map(
          (entry) => `
            <button class="journal-entry-button" type="button" data-open-journal-detail="${entry.id}">
              <strong>${entry.kind}</strong>
              <span>${entry.title}</span>
              <small>${entry.subtitle}</small>
            </button>`,
        )
        .join("")}
    </div>`;
  $("#journalDetailModal").hidden = false;
}

function closeJournalDetail() {
  $("#journalDetailModal").hidden = true;
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

function memberModeOverrideActive() {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (requestedMode === "member") sessionStorage.setItem(appModePreferenceKey, "member");
  return requestedMode === "member" || sessionStorage.getItem(appModePreferenceKey) === "member";
}

function shouldOpenCoachModeByDefault() {
  return canUseCoachMode() && !memberModeOverrideActive();
}

function updateCoachModeAccess() {
  const button = $("#coachModeButton");
  if (!button) return;
  button.hidden = !canUseCoachMode();
  renderBankNotificationBridge();
}

function openCoachMode() {
  if (!canUseCoachMode()) return;
  coachModeNavigationStarted = true;
  sessionStorage.setItem(appModePreferenceKey, "coach");
  sessionStorage.setItem("tennis-note-coach-mode-entry", "member-profile");
  saveSnapshot();
  const params = new URLSearchParams({ v: "1.0.371" });
  window.location.href = `../tennis-note-coach-app/index.html?${params.toString()}`;
}

function applyRequestedMemberView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (requestedView && $(`#${requestedView}`)) setView(requestedView);
}

const memberHelpEntries = [
  {
    id: "change-lesson",
    category: "schedule",
    question: "수업 시간을 바꾸고 싶어요",
    answer: "시간표의 ‘시간 바꾸기’에서 기존 수업과 가능한 시간을 선택하세요. 자동 변경 또는 코치 확인 필요 여부가 신청 전에 표시됩니다.",
    action: "schedule",
    actionLabel: "시간표 보기",
  },
  {
    id: "makeup-lesson",
    category: "schedule",
    question: "불참한 수업의 보강은 어떻게 잡나요?",
    answer: "불참 처리로 보강 권리가 생기면 홈과 시간표에 ‘보강 시간 선택’이 표시됩니다. 가능한 시간 한 곳을 고르면 예약됩니다.",
    action: "schedule",
    actionLabel: "보강 시간 보기",
  },
  {
    id: "coupon-booking",
    category: "schedule",
    question: "쿠폰 수업은 어디서 예약하나요?",
    answer: "사용 가능한 쿠폰이 있으면 시간표의 ‘변경·보강·예약’에서 담당 코치의 가능한 시간만 확인할 수 있습니다.",
    action: "schedule",
    actionLabel: "쿠폰 시간 보기",
  },
  {
    id: "multiple-tickets",
    category: "ticket",
    question: "회원권이 두 개 이상이면 어떻게 보이나요?",
    answer: "회원권 화면에 상품과 담당 코치별로 각각 표시됩니다. 수업을 예약하거나 완료할 때 연결된 회원권에서만 횟수가 차감됩니다.",
    action: "shop",
    actionLabel: "회원권 보기",
  },
  {
    id: "pending-payment",
    category: "ticket",
    question: "결제했는데 결제 확인 중으로 나와요",
    answer: "결제 검증과 회원권 발급이 끝나면 자동으로 바뀝니다. 잠시 뒤 회원권 화면에서 다시 확인하고 계속되면 카카오로 문의해 주세요.",
    action: "shop",
    actionLabel: "결제 상태 보기",
  },
  {
    id: "cancel-refund",
    category: "ticket",
    question: "결제 취소나 환불은 어떻게 하나요?",
    answer: "이미 사용한 횟수와 환불 규칙을 확인해야 하므로 카카오 문의에서 회원 이름과 결제일을 알려주세요.",
    action: "support",
    actionLabel: "카카오 문의",
  },
  {
    id: "notifications",
    category: "app",
    question: "수업과 피드백 알림을 받고 싶어요",
    answer: "내 정보의 앱 알림에서 알림을 켜세요. 휴대전화 설정에서 테니스노트 알림도 허용되어 있어야 합니다.",
    action: "notification",
    actionLabel: "알림 설정 보기",
  },
  {
    id: "latest-version",
    category: "app",
    question: "화면이 다른 사람과 다르거나 업데이트가 안 돼요",
    answer: "내 정보의 앱 새로고침을 누르면 로그인은 유지한 채 최신 화면을 다시 확인합니다.",
    action: "refresh",
    actionLabel: "앱 새로고침",
  },
];

let memberHelpCategory = "all";
let memberHelpQuery = "";

function filteredMemberHelpEntries() {
  const query = memberHelpQuery.trim().toLowerCase();
  return memberHelpEntries.filter((entry) => (
    (memberHelpCategory === "all" || entry.category === memberHelpCategory)
    && (!query || `${entry.question} ${entry.answer}`.toLowerCase().includes(query))
  ));
}

function openMemberHelpModal() {
  memberHelpCategory = "all";
  memberHelpQuery = "";
  if ($("#memberHelpSearch")) $("#memberHelpSearch").value = "";
  renderMemberHelp();
  openAppModal("memberHelpModal", "#memberHelpSearch");
}

function closeMemberHelpModal() {
  closeAppModal("memberHelpModal");
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

function openKakaoInquiryModal(context = "support") {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  const oneDay = context === "one-day";
  if ($("#kakaoInquiryTitle")) $("#kakaoInquiryTitle").textContent = oneDay ? "원데이 레슨 문의" : "카카오로 문의하기";
  const description = modal.querySelector(".support-modal-card > p:not(.eyebrow)");
  if (description) {
    description.textContent = oneDay
      ? "희망 날짜, 시간, 레슨 경험을 남기면 가능한 코치와 결제 방법을 안내합니다."
      : "수업 변경, 회원권, 결제 관련 내용을 남겨주시면 운영시간에 순서대로 답변드립니다.";
  }
  modal.hidden = false;
  $("#kakaoChannelLink")?.focus();
}

function closeKakaoInquiryModal() {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  modal.hidden = true;
  $("#openKakaoInquiryButton")?.focus();
}

function handleHomeAction(action) {
  const viewMap = {
    "lesson-log": "lessonLogView",
    curriculum: "curriculumView",
    makeup: "scheduleView",
    ticket: "shopView",
    shop: "shopView",
  };
  const viewId = viewMap[action];
  if (!viewId) return;
  if (action === "makeup") {
    const makeupSource = memberMakeupDueLessons()[0];
    const couponSource = memberBookableCouponTickets()[0];
    if (makeupSource) openMemberChangeTimetable(makeupSource.id);
    else if (couponSource) startCouponBooking(couponSource.ticketId);
    else openMemberChangeTimetable("");
    return;
  }
  navigateMemberView(viewId);
  if (action === "curriculum") {
    renderCurriculum();
    requestAnimationFrame(() => $("#curriculumGuide")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return;
  }
  jumpToTop();
}

function handleSummaryAction(action) {
  if (action === "schedule") {
    navigateMemberView("scheduleView");
    jumpToTop();
    return;
  }
  if (action === "shop") {
    navigateMemberView("shopView");
    jumpToTop();
    return;
  }
  if (action === "change" || action === "makeup") {
    const firstDue = memberMakeupDueLessons()[0];
    const firstCoupon = memberBookableCouponTickets()[0];
    if (firstDue) openMemberChangeTimetable(firstDue.id);
    else if (firstCoupon) startCouponBooking(firstCoupon.ticketId);
    else openMemberChangeTimetable("");
    return;
  }
  if (action === "comments") {
    const latest = latestMemberFeedbackLog() || state.lessonLogs[0];
    if (latest) {
      if (latest.status === "confirmed") {
        state.lastReadFeedbackId = latest.id;
        saveSnapshot();
        renderMemberHomeOverview();
      }
      openJournalDetail(latest.id);
      return;
    }
    setView("lessonLogView");
    jumpToTop();
  }
}

function selectedLessonDetail() {
  return memberScheduleOptions().find((lesson) => lesson.id === state.selectedLessonDetailId)
    || memberMakeupDueLessons().find((lesson) => lesson.id === state.selectedLessonDetailId)
    || (state.liveLessons || []).find((lesson) => lesson.id === state.selectedLessonDetailId)
    || null;
}

function openLessonDetailSheet(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId)
    || memberMakeupDueLessons().find((item) => item.id === lessonId)
    || (state.liveLessons || []).find((item) => item.id === lessonId);
  if (!lesson || !isOwnMemberScheduleLesson(lesson)) return;
  state.selectedLessonDetailId = lesson.id;
  renderLessonDetailSheet(lesson);
  openAppSheet("lessonDetailSheet");
}

function closeLessonDetailForAction() {
  closeAppSheet("lessonDetailSheet", true, { restoreFocus: false, immediate: true });
  if (history.state?.tennisNoteSheet === "lessonDetailSheet") {
    const nextState = { ...history.state };
    delete nextState.tennisNoteSheet;
    history.replaceState(nextState, "", window.location.href);
  }
}

function handleScheduleClick(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId);
  if (!lesson) return;
  if (isOwnMemberScheduleLesson(lesson)) {
    openLessonDetailSheet(lesson.id);
    return;
  }
  if (lesson.status === "available") {
    const initialSource = regularInitialSourceLesson();
    if (initialSource) {
      toggleRegularInitialScheduleSlot(lesson.id);
      return;
    }
    const firstRegular = currentScheduledLessonsForChange().find((item) => (
      item.id === state.selectedMemberChangeSourceId
    ));
    if (!firstRegular) {
      showToast("변경할 기존 수업을 먼저 선택해 주세요.");
      document.querySelector("#memberInlineChangeSource")?.focus();
      return;
    }
    $("#absenceLesson").value = firstRegular.id;
    renderSelects();
    $("#makeupSlot").value = lesson.id;
    state.memberChangeCompactSelection = true;
    $("#changeRequestModal")?.classList.add("is-inline-confirmation");
    renderAvailableSlots();
    renderChangeModalSummary();
    openAppModal("changeRequestModal", "#requestMakeup");
  }
}

function toggleRegularInitialScheduleSlot(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId && item.status === "available");
  const source = regularInitialSourceLesson();
  if (!lesson || !source) return;
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
    if (differentCoachSelected) {
      selected.splice(0, selected.length);
      showToast("첫 정규시간은 같은 코치로 선택합니다.");
    }
    if (selected.length >= requiredCount) selected.shift();
    selected.push(lessonId);
  }
  state.regularInitialSelections = selected;
  renderSchedule();
  saveSnapshot();
}

function confirmRegularInitialSchedule() {
  const source = regularInitialSourceLesson();
  if (!source) return;
  const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
  if (state.regularInitialSelections.length !== requiredCount) {
    showToast(`${requiredCount}개의 시간을 선택해 주세요.`);
    return;
  }
  renderSelects();
  $("#absenceLesson").value = source.id;
  renderSelects();
  $("#makeupSlot").value = state.regularInitialSelections[0];
  renderAvailableSlots();
  requestMakeup();
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

async function cancelMemberScheduleRequest(kind, id) {
  if (!id || !window.TennisNoteDataClient?.rpc) return;
  const label = kind === "makeup" ? "보강 예약" : "수업 변경 요청";
  if (!window.confirm(`${label}을 취소하고 원래 상태로 되돌릴까요?`)) return;
  try {
    await window.TennisNoteDataClient.rpc(
      kind === "makeup" ? "tn_cancel_my_makeup_booking" : "tn_cancel_my_lesson_change_request",
      kind === "makeup" ? { target_entitlement_id: id } : { target_request_id: id },
    );
    await syncMemberLessonsFromServer();
    await syncMemberChangeRequestsFromServer();
    renderAll();
    showToast(`${label}을 취소했습니다.`);
  } catch (error) {
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    const message = errorText.includes("original_time_occupied")
      ? "원래 수업 시간에 다른 수업이 들어와 자동 복원이 어렵습니다. 카카오채널로 문의해 주세요."
      : errorText.includes("already_started") || errorText.includes("not_cancelable")
        ? "이미 시작했거나 처리된 수업은 앱에서 취소할 수 없습니다."
        : "취소하지 못했습니다. 새로고침 후 다시 시도해 주세요.";
    showToast(message);
  }
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

async function openChangeRequestModal(preferredLessonId = "", options = {}) {
  if (!options.editing) state.editingChangeRequestId = "";
  state.memberChangeCompactSelection = false;
  $("#changeRequestModal")?.classList.remove("is-inline-confirmation");
  const sourceId = await prepareChangeRequestSource(preferredLessonId);
  renderSelects();
  if (sourceId && [...$("#absenceLesson").options].some((option) => option.value === sourceId)) {
    $("#absenceLesson").value = sourceId;
    state.selectedMemberChangeSourceId = sourceId;
  }
  renderSelects();
  renderAvailableSlots();
  renderChangeModalSummary();
  openAppModal("changeRequestModal", "#absenceLesson");
  const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  await syncMemberChangeCandidates(source);
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

async function openMemberChangeTimetable(preferredLessonId = "") {
  state.memberScheduleMode = "availability";
  state.memberScheduleModeTouched = true;
  state.memberScheduleFullView = true;
  if (preferredLessonId) {
    state.selectedMemberChangeSourceId = preferredLessonId;
    const preferredSource = currentScheduledLessonsForChange().find((lesson) => lesson.id === preferredLessonId);
    if (preferredSource) ensureMemberScheduleTicketSelection(memberLessonTicketId(preferredSource));
  }
  setView("scheduleView");
  renderSchedule();
  const preparedSourceId = await prepareChangeRequestSource(preferredLessonId || state.selectedMemberChangeSourceId);
  const sources = memberInlineChangeSources();
  if (preparedSourceId && sources.some((lesson) => lesson.id === preparedSourceId)) {
    state.selectedMemberChangeSourceId = preparedSourceId;
  }
  if (!sources.some((lesson) => lesson.id === state.selectedMemberChangeSourceId)) {
    state.selectedMemberChangeSourceId = "";
  }
  renderSchedule();
  renderSelects();
  const source = sources.find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
  await syncMemberChangeCandidates(source);
  jumpToTop();
}

function closeChangeRequestModal() {
  state.regularInitialSelections = [];
  state.regularInitialOperationKey = "";
  state.memberChangeCompactSelection = false;
  state.editingChangeRequestId = "";
  $("#changeRequestModal")?.classList.remove("is-inline-confirmation");
  closeAppModal("changeRequestModal");
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

function openChangeHistoryModal() {
  renderRequests();
  $("#changeHistoryModal").hidden = false;
}

function closeChangeHistoryModal() {
  $("#changeHistoryModal").hidden = true;
}

async function saveJournal() {
  const button = $("#saveJournal");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = "서버에 저장 중";
  }
  if (($("#journalMode")?.value || "lesson") === "lesson") {
    let saved = false;
    try {
      saved = await submitLessonLog();
    } finally {
      if (button) button.disabled = false;
      renderJournalMode();
    }
    if (saved) {
      window.TennisNoteInputGuard?.markSaved?.("#journalComposerSheet");
      closeAppSheet("journalComposerSheet");
    }
    return;
  }
  savePracticeLog();
  if (button) button.disabled = false;
  renderJournalMode();
  window.TennisNoteInputGuard?.markSaved?.("#journalComposerSheet");
  closeAppSheet("journalComposerSheet");
}

function handleProfilePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.profile.photoDataUrl = String(reader.result || "");
    renderProfile();
    saveSnapshot();
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  state.profile.photoDataUrl = "";
  if ($("#profilePhotoInput")) $("#profilePhotoInput").value = "";
  renderProfile();
  saveSnapshot();
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

async function checkNicknameAvailability(inputId, statusId) {
  const nickname = normalizeIdentityText($(`#${inputId}`)?.value || "");
  if (nickname.length < 2 || nickname.length > 20) {
    setNicknameStatus(statusId, "닉네임은 2~20자로 입력해 주세요.", "unavailable");
    return false;
  }
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) {
    setNicknameStatus(statusId, "실사용 로그인 후 중복을 확인할 수 있습니다.", "unavailable");
    return false;
  }
  setNicknameStatus(statusId, "중복 여부를 확인하고 있습니다.");
  try {
    const rawResult = await client.rpc("tn_check_nickname_available", { target_nickname: nickname });
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (result?.available) {
      setNicknameStatus(statusId, "사용할 수 있는 닉네임입니다.", "available");
      return true;
    }
    setNicknameStatus(statusId, identityErrorMessage(result?.reason || "nickname_already_taken"), "unavailable");
    return false;
  } catch (error) {
    setNicknameStatus(statusId, identityErrorMessage(error), "unavailable");
    return false;
  }
}

function applySavedIdentity(profile = {}) {
  state.profile.name = normalizeIdentityText(profile.name || state.profile.name);
  state.profile.nickname = normalizeIdentityText(profile.nickname || state.profile.nickname);
  state.profile.phone = normalizeIdentityPhone(profile.phone || state.profile.phone);
  state.profile.birthYear = profile.birth_year || state.profile.birthYear || "";
  state.profile.neighborhood = normalizeIdentityText(profile.neighborhood || state.profile.neighborhood || "");
  state.profile.gender = profile.gender || state.profile.gender || "";
  state.profile.profileCompletedAt = profile.profile_completed_at || state.profile.profileCompletedAt || new Date().toISOString();
  state.profile.privacyConsentVersion = profile.privacy_consent_version || state.profile.privacyConsentVersion || identityPrivacyVersion;
  state.profile.privacyConsentedAt = profile.privacy_consented_at || state.profile.privacyConsentedAt || new Date().toISOString();
  if (state.member) {
    state.member.name = state.profile.name;
    state.member.nickname = state.profile.nickname;
  }
}

function applyConsentPreferences(preferences = {}) {
  state.profile.termsConsentVersion = preferences.termsVersion || state.profile.termsConsentVersion || "";
  state.profile.termsConsentedAt = preferences.termsConsentedAt || state.profile.termsConsentedAt || "";
  state.profile.privacyConsentVersion = preferences.privacyVersion || state.profile.privacyConsentVersion || "";
  state.profile.privacyConsentedAt = preferences.privacyConsentedAt || state.profile.privacyConsentedAt || "";
  state.profile.marketingPushConsent = preferences.marketingPush === true;
  state.profile.marketingSmsConsent = preferences.marketingSms === true;
  state.profile.marketingEmailConsent = preferences.marketingEmail === true;
}

async function loadIdentityConsentPreferences() {
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) return {};
  const rawResult = await retryTransientNetwork(() => client.rpc("tn_my_consent_preferences"));
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  applyConsentPreferences(result || {});
  return result || {};
}

async function persistConsentPreferences({ marketingPush, marketingSms, marketingEmail }) {
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) {
    applyConsentPreferences({
      termsVersion: identityTermsVersion,
      termsConsentedAt: new Date().toISOString(),
      privacyVersion: identityPrivacyVersion,
      privacyConsentedAt: new Date().toISOString(),
      marketingPush,
      marketingSms,
      marketingEmail,
    });
    return { ok: true, offlinePreview: true };
  }
  const rawResult = await retryTransientNetwork(() => client.rpc("tn_save_my_consent_preferences", {
    target_terms_version: identityTermsVersion,
    target_privacy_version: identityPrivacyVersion,
    target_terms_consent: true,
    target_privacy_consent: true,
    target_marketing_push: marketingPush === true,
    target_marketing_sms: marketingSms === true,
    target_marketing_email: marketingEmail === true,
  }));
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  if (!result?.ok) throw new Error("consent_update_not_confirmed");
  applyConsentPreferences(result);
  return result;
}

async function persistIdentityProfile({ realName, nickname, phone, birthYear, neighborhood, gender }) {
  const normalizedRealName = normalizeIdentityText(realName);
  const normalizedNickname = normalizeIdentityText(nickname);
  const normalizedPhone = normalizeIdentityPhone(phone);
  const normalizedBirthYear = Number(birthYear) || 0;
  const normalizedNeighborhood = normalizeIdentityText(neighborhood);
  const normalizedGender = String(gender || "");
  if (!normalizedRealName || normalizedRealName.length > 40) throw new Error("real_name_invalid");
  if (normalizedNickname.length < 2 || normalizedNickname.length > 20) throw new Error("nickname_invalid");
  if (!/^01[0-9]{8,9}$/u.test(normalizedPhone)) throw new Error("phone_invalid");
  if (normalizedBirthYear < 1900 || normalizedBirthYear > new Date().getFullYear()) throw new Error("birth_year_invalid");
  if (!["female", "male", "other", "prefer_not"].includes(normalizedGender)) throw new Error("gender_invalid");

  const client = window.TennisNoteDataClient;
  if (hasLiveMemberSession() && client?.rpc) {
    const rawResult = await retryTransientNetwork(() => client.rpc("tn_update_my_identity_profile_v2", {
      target_real_name: normalizedRealName,
      target_nickname: normalizedNickname,
      target_phone: normalizedPhone,
      target_birth_year: normalizedBirthYear,
      target_neighborhood: normalizedNeighborhood,
      target_gender: normalizedGender,
      target_privacy_version: identityPrivacyVersion,
    }));
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (!result?.ok || !result?.profile) throw new Error("identity_profile_update_not_confirmed");
    applySavedIdentity(result.profile);
    return result;
  }

  const profile = {
    name: normalizedRealName,
    nickname: normalizedNickname,
    phone: normalizedPhone,
    birth_year: normalizedBirthYear,
    neighborhood: normalizedNeighborhood,
    gender: normalizedGender,
    profile_completed_at: new Date().toISOString(),
    privacy_consent_version: identityPrivacyVersion,
    privacy_consented_at: new Date().toISOString(),
  };
  applySavedIdentity(profile);
  return { ok: true, profile, linkStatus: "offline_preview" };
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

function syncIdentitySetupModal(user = null) {
  const modal = $("#identitySetupModal");
  if (!modal) return;
  if (!hasLiveMemberSession() || identityProfileComplete()) {
    modal.hidden = true;
    document.body.classList.remove("identity-setup-required");
    return;
  }
  state.profile.suggestedNickname = state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  populateIdentitySetup(user);
  modal.hidden = false;
  document.body.classList.add("identity-setup-required");
  window.setTimeout(() => $("#identityRealName")?.focus(), 40);
}

async function submitIdentitySetup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#identitySetupMessage");
  if (!$("#identityTermsConsent")?.checked) {
    if (message) message.textContent = "서비스 이용약관 동의가 필요합니다.";
    return;
  }
  if (!$("#identityPrivacyConsent")?.checked) {
    if (message) message.textContent = "개인정보 처리방침 동의가 필요합니다.";
    return;
  }
  button.disabled = true;
  if (message) message.textContent = "가입 정보를 안전하게 저장하고 있습니다.";
  try {
    await persistConsentPreferences({
      marketingPush: $("#identityMarketingPush")?.checked === true,
      marketingSms: $("#identityMarketingSms")?.checked === true,
      marketingEmail: $("#identityMarketingEmail")?.checked === true,
    });
    const result = await persistIdentityProfile({
      realName: $("#identityRealName")?.value,
      nickname: $("#identityNickname")?.value,
      phone: $("#identityPhone")?.value,
      birthYear: $("#identityBirthYear")?.value,
      neighborhood: $("#identityNeighborhood")?.value,
      gender: $("#identityGender")?.value,
    });
    $("#identitySetupModal").hidden = true;
    document.body.classList.remove("identity-setup-required");
    if (result?.linkStatus === "linked") {
      const restored = await applySupabaseMemberSession(false);
      if (!restored) throw new Error("auto_link_session_refresh_failed");
      showToast("가입 완료 · 기존 회원권과 앱 계정이 바로 연결되었습니다.");
      return;
    }
    renderAll();
    saveSnapshot();
    if (result?.linkStatus === "admin_review_required") {
      showToast("가입 완료. 기존 회원 정보는 관리자 확인 후 연결됩니다.");
      return;
    }
    showToast("가입 정보가 저장되었습니다.");
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    if (message) message.textContent = errorMessage;
    setNicknameStatus("identityNicknameStatus", errorMessage, "unavailable");
  } finally {
    button.disabled = false;
  }
}

async function updateMemberProfileOnServer(values = {}) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.updateRows || !profileId) return { skipped: true };
  try {
    const rows = await client.updateRows("tn_users", { id: profileId }, {
      ...values,
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("profile_update_not_confirmed");
    return { ok: true, profile: rows[0] };
  } catch (error) {
    return { ok: false, error };
  }
}

async function saveProfileInfo() {
  try {
    await persistIdentityProfile({
      realName: $("#profileRealNameInput")?.value,
      nickname: $("#profileNicknameInput")?.value,
      phone: $("#profilePhoneInput")?.value,
      birthYear: state.profile.birthYear || state.member?.birthYear,
      neighborhood: state.profile.neighborhood || state.member?.neighborhood,
      gender: state.profile.gender || state.member?.gender,
    });
    setNicknameStatus("profileNicknameStatus", "실명과 닉네임을 확인했습니다.", "available");
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    setNicknameStatus("profileNicknameStatus", errorMessage, "unavailable");
    showToast(errorMessage);
    return;
  }
  state.profile.hand = $("#profileHand")?.value || state.profile.hand;
  state.profile.backhand = $("#profileBackhand")?.value || state.profile.backhand;
  state.profile.startedAt = $("#profileStartedAt")?.value || "";
  state.profile.goal = $("#profileGoal")?.value.trim() || "";
  state.profile.styleMemo = $("#profileStyleMemo")?.value.trim() || "";
  state.profile.selfNtrp = $("#profileSelfNtrp")?.value || state.profile.selfNtrp;
  state.profile.ntrpSurvey = collectNtrpSurvey().answers;
  const serverResult = await updateMemberProfileOnServer({
    profile_photo_url: state.profile.photoDataUrl || null,
    dominant_hand: state.profile.hand || null,
    backhand_style: state.profile.backhand || null,
    tennis_started_on: state.profile.startedAt || null,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
    self_ntrp: Number(state.profile.selfNtrp) || null,
    ntrp_survey: state.profile.ntrpSurvey || {},
  });
  if (serverResult.ok === false) {
    state.ticketHistory.unshift({ text: "내 정보 서버 저장 실패 · 연결 확인 필요", tone: "alert" });
    renderProfile();
    renderTickets();
    saveSnapshot();
    showToast("서버 저장에 실패했습니다. 다시 시도해주세요.");
    return;
  }
  state.ticketHistory.unshift({ text: "내 정보와 테니스 스타일 저장 완료", tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#profileEditorSheet");
  closeAppSheet("profileEditorSheet");
}

async function requestNtrpCheck() {
  const survey = collectNtrpSurvey();
  state.profile.ntrpCheckRequested = true;
  state.profile.ntrpSurvey = survey.answers;
  state.profile.selfNtrp = survey.level;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  const requestedAt = new Date().toISOString();
  const serverResult = await updateMemberProfileOnServer({
    self_ntrp: Number(survey.level),
    ntrp_survey: survey.answers,
    ntrp_requested_at: requestedAt,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
  });
  exportNtrpRequest(survey);
  state.ticketHistory.unshift({
    text: serverResult.ok === false ? "수준 확인 요청 전송 실패 · 다시 시도 필요" : "코치에게 수준 확인 요청 완료",
    tone: serverResult.ok === false ? "alert" : "wait",
  });
  renderProfile();
  renderTickets();
  saveSnapshot();
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

function activateLiveMemberProfile(profileId) {
  const nextProfileId = String(profileId || "");
  const previousProfileId = String(state.liveProfileId || state.member?.profileId || "");
  const sameProfile = Boolean(nextProfileId && previousProfileId === nextProfileId);

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  state.demoPresentationVersion = 0;
  if (sameProfile) return;
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.coachModeAllowed = false;
  state.remaining = 0;
  state.profile = {
    ...state.profile,
    name: "",
    nickname: "",
    phone: "",
    profileCompletedAt: "",
    privacyConsentVersion: "",
    privacyConsentedAt: "",
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
  };
  state.makeupRequests = [];
  state.lessonLogs = [];
  state.practiceLogs = [];
  state.paymentRequests = [];
  state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, features: { threeMonth: true, oneDay: true, coupons: true } };
  state.discountCoupons = [];
  state.expiredTickets = [];
  state.ticketHistory = [];
  state.liveMembershipProducts = [];
  state.liveTickets = [];
  memberScheduleV2WorkspaceCache = null;
  state.liveLessons = [];
  state.liveLessonsLoaded = false;
  state.groupAccount = null;
  state.liveNotifications = [];
  state.accountDeletionRequest = null;
  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  state.pendingPaymentCheckStatus = null;
  state.lastLiveTicketKey = "";
  state.lastLiveNotificationKey = "";
  state.activeJournalMonth = localDateKey().slice(0, 7);
  state.selectedJournalDate = localDateKey();
  lessons.splice(0, lessons.length);
  localStorage.removeItem(sharedStorageKey);
}

function openAppFromSession(showNotice = false) {
  if (!state.member) return;
  $("#loginScreen").hidden = true;
  $("#appScreen").hidden = false;
  document.body.dataset.screen = "app";
  renderPendingApprovalGate();
  updateCoachModeAccess();
  void refreshBankNotificationBridge();
  applyRequestedMemberView();
  setView(activeMemberViewId(), { replaceHistory: true });
  jumpToTop();
  if (showNotice && !isApprovalPending()) showNoticeAfterLiveSync();
}

async function applySupabaseMemberSession(showNotice = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  await client.consumeOAuthRedirect?.();
  const session = await client.ensureSession?.() || client.getSession?.();
  if (!session?.access_token) return false;
  try {
    const current = await client.selectCurrentProfile();
    if (current?.profileBootstrapError?.code === "auth_profile_mapping_ambiguous") {
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "로그인 계정이 여러 회원 정보에 연결되어 있습니다. 관리자에게 회원 연결 확인을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (["auth_profile_mapping_stale", "auth_profile_identity_context_invalid"].includes(current?.profileBootstrapError?.code)) {
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "회원 연결 상태를 안전하게 확인하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 연결 확인을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (current?.profileBootstrapError?.code === "member_login_provider_locked") {
      const providerLabels = {
        "custom:naver": "네이버",
        "custom:kakao": "카카오",
        apple: "Apple",
        email: "이메일",
        existing: "기존",
      };
      const expectedProvider = providerLabels[current.profileBootstrapError.expectedProvider] || "처음 선택한";
      await client.signOut?.();
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = `이 회원정보는 ${expectedProvider} 로그인에 연결되어 있습니다. ${expectedProvider} 로그인을 이용해 주세요.`;
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (["verified_phone_member_ambiguous", "auth_switch_phone_ambiguous"].includes(current?.profileBootstrapError?.code)) {
      await client.signOut?.();
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "같은 휴대전화 정보의 회원 DB가 여러 개입니다. 관리자에게 계정 연결을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    const { user, profile, coachRole } = current;
    activateLiveMemberProfile(profile?.id);
    const displayName = profile?.name || state.profile?.name || "가입 확인 중";
    state.member = {
      provider: session.provider || "Supabase",
      name: displayName,
      nickname: profile?.nickname || "",
      profileId: profile?.id || "",
      authUserId: user?.id || "",
      role: profile?.role || "member",
      memberKind: profile?.member_kind || "journal_only",
      status: profile?.status || "active",
      birthYear: profile?.birth_year || "",
      neighborhood: profile?.neighborhood || "",
      gender: profile?.gender || "",
      coachApproved: coachRole?.status === "approved",
    };
    state.coachModeAllowed = state.member.coachApproved;
    if (shouldOpenCoachModeByDefault()) {
      openCoachMode();
      return true;
    }
    state.profile.name = profile?.name || "가입 확인 중";
    state.profile.nickname = profile?.nickname || "";
    state.profile.phone = profile?.phone || "";
    state.profile.birthYear = profile?.birth_year || "";
    state.profile.neighborhood = profile?.neighborhood || "";
    state.profile.gender = profile?.gender || "";
    state.profile.profileCompletedAt = profile?.profile_completed_at || "";
    state.profile.termsConsentVersion = "";
    state.profile.termsConsentedAt = "";
    state.profile.privacyConsentVersion = profile?.privacy_consent_version || "";
    state.profile.privacyConsentedAt = profile?.privacy_consented_at || "";
    state.profile.marketingPushConsent = false;
    state.profile.marketingSmsConsent = false;
    state.profile.marketingEmailConsent = false;
    state.profile.suggestedNickname = suggestedNicknameFromUser(user);
    if (profile?.profile_photo_url) state.profile.photoDataUrl = profile.profile_photo_url;
    if (profile?.dominant_hand) state.profile.hand = profile.dominant_hand;
    if (profile?.backhand_style) state.profile.backhand = profile.backhand_style;
    if (profile?.tennis_started_on) state.profile.startedAt = profile.tennis_started_on;
    if (profile?.self_ntrp) state.profile.selfNtrp = String(profile.self_ntrp);
    if (profile?.coach_ntrp) state.profile.coachNtrp = String(profile.coach_ntrp);
    if (profile?.tennis_goal) state.profile.goal = profile.tennis_goal;
    if (profile?.play_style_memo) state.profile.styleMemo = profile.play_style_memo;
    if (profile?.ntrp_survey && typeof profile.ntrp_survey === "object") state.profile.ntrpSurvey = profile.ntrp_survey;
    state.profile.ntrpCheckRequested = Boolean(profile?.ntrp_requested_at && !profile?.coach_ntrp);
    openAppFromSession(false);
    renderAll();
    try {
      await loadIdentityConsentPreferences();
    } catch (consentError) {
      console.warn("[TennisNote] consent preferences could not be loaded", consentError?.message || consentError);
    }
    syncIdentitySetupModal(user);
    saveSnapshot();
    setMemberSessionRestoring(false);

    await Promise.allSettled([
      syncLiveMembershipProductsFromServer(),
      syncMemberPaymentOptionsFromServer(),
      syncMemberDiscountCouponsFromServer(),
      syncMemberEnrollmentFromServer(profile),
      syncMemberTicketsFromServer(profile),
      syncMemberLessonsFromServer(profile),
      syncMemberChangeRequestsFromServer(profile),
      syncMemberJournalEntriesFromServer(profile),
      syncMemberHoldingPolicyFromServer(),
      syncMemberHoldingRequestsFromServer(profile),
      syncMemberAccountDeletionRequestFromServer(profile),
      syncMemberGroupAccountFromServer(profile),
      syncMemberNotificationsFromServer(profile),
      syncNativePushRegistration(profile, false),
    ]);
    await syncLiveSchedulePolicy(currentLiveTicket()?.branchId || "");
    renderAll();
    if (showNotice && !isApprovalPending()) showNoticeAfterLiveSync();
    scheduleNativePushPrimer();
    saveSnapshot();
    return true;
  } catch (error) {
    const status = $("#memberEmailLoginStatus");
    const code = error?.payload?.code || error?.message || "";
    if (status && code === "verified_phone_member_ambiguous") {
      status.textContent = "같은 휴대전화 정보의 회원 DB가 여러 개입니다. 관리자에게 계정 연결을 요청해 주세요.";
    } else if (status && code) {
      status.textContent = "회원정보 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
    return false;
  }
}

async function login(provider) {
  const client = window.TennisNoteDataClient;
  const status = $("#memberEmailLoginStatus");
  if (client?.readiness?.().ready) {
    try {
      if (status) status.textContent = `${provider} 로그인 화면을 여는 중입니다.`;
      await client.signInWithOAuth(provider);
      return;
    } catch (error) {
      if (status) status.textContent = `${provider} 로그인을 열지 못했습니다. 잠시 후 다시 시도해주세요.`;
      return;
    }
  }
  if (status) status.textContent = "실사용 로그인 연결 설정을 확인해 주세요.";
}

async function syncAppleLoginAvailability() {
  const buttons = $$('[data-login-provider="Apple"]');
  if (!buttons.length) return;
  let ready = true;
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    try {
      const settings = await client.getAuthSettings();
      ready = Boolean(settings?.external?.apple);
    } catch {
      // A temporary settings lookup failure must not hide the compliant login option.
      ready = true;
    }
  }
  buttons.forEach((button) => {
    const label = button.querySelector("[data-apple-login-label]");
    button.disabled = !ready;
    button.classList.toggle("is-preparing", !ready);
    const buttonLabel = ready ? button.dataset.readyLabel : "Apple 로그인 설정 중";
    if (label) label.textContent = buttonLabel;
    button.setAttribute("aria-label", buttonLabel);
  });
}

async function handleOAuthResult(event) {
  const status = $("#memberEmailLoginStatus");
  const provider = event?.detail?.provider || "간편";
  if (event?.detail?.ok) {
    event.preventDefault();
    if (status) status.textContent = `${provider} 로그인 정보를 확인하고 있습니다.`;
    setMemberSessionRestoring(true);
    try {
      const opened = await applySupabaseMemberSession(true);
      if (!opened) throw new Error("oauth_profile_bootstrap_failed");
      if (status) status.textContent = "";
    } catch (error) {
      if (status) status.textContent = `${provider} 로그인 후 회원정보를 열지 못했습니다. 다시 시도해주세요.`;
    } finally {
      setMemberSessionRestoring(false);
    }
    return;
  }
  if (!status) return;
  status.textContent = event?.detail?.cancelled
    ? `${provider} 로그인이 취소되었습니다.`
    : `${provider} 로그인을 완료하지 못했습니다. 다시 시도해주세요.`;
}

async function loginWithEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const status = $("#memberEmailLoginStatus");
  submitButton.disabled = true;
  status.textContent = "로그인 확인 중";
  try {
    const client = window.TennisNoteDataClient;
    await client.signInWithPassword($("#memberLoginEmail").value, $("#memberLoginPassword").value);
    const opened = await applySupabaseMemberSession(true);
    if (!opened) throw new Error("profile_bootstrap_failed");
    form.reset();
    status.textContent = "";
  } catch (error) {
    status.textContent = emailLoginErrorMessage(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  await disableNativePushForLogout();
  try {
    await window.TennisNoteDataClient?.signOut?.();
  } catch {
    state.ticketHistory.unshift({ text: "외부 로그인 해제 확인 필요 · 앱에서는 로그아웃 처리", tone: "wait" });
  }
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.liveTickets = [];
  state.liveLessons = [];
  state.liveMakeupEntitlements = [];
  state.liveReleasedMakeupSlots = [];
  state.ticketSyncStatus = { tone: "wait", text: "로그인 후 실제 회원권을 확인합니다" };
  state.lastLiveTicketKey = "";
  sessionStorage.removeItem(appModePreferenceKey);
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  $("#appScreen").hidden = true;
  $("#loginScreen").hidden = false;
  if ($("#identitySetupModal")) $("#identitySetupModal").hidden = true;
  document.body.classList.remove("identity-setup-required");
  delete document.body.dataset.screen;
  document.body.classList.remove("member-pending-approval");
  if ($("#pendingApprovalGate")) $("#pendingApprovalGate").hidden = true;
  updateCoachModeAccess();
  jumpToTop();
  saveSnapshot();
}

async function submitMemberLessonChange(client, args) {
  try {
    return await client.rpc("tn_submit_lesson_change_request_v2", args);
  } catch (error) {
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_submit_lesson_change_request_v2|PGRST202|42883|schema cache/i.test(errorText)) throw error;
    return client.rpc("tn_submit_lesson_change_request", args);
  }
}

async function requestMakeup() {
  if ($("#requestMakeup")?.disabled) {
    showToast("현재 변경할 수 있는 수업 시간이 없습니다.");
    return;
  }
  const absence = ensureMemberScheduleLesson($("#absenceLesson").value);
  const makeup = ensureMemberScheduleLesson($("#makeupSlot").value);
  if (!absence || !makeup) return;

  const originalDay = absence.day;
  const originalTime = absence.time;
  const originalCoach = absence.coach;
  const isMakeupEntitlement = Boolean(absence.makeupEntitlementId);
  const isCouponBooking = Boolean(absence.couponBooking);
  const isRegularInitialBooking = Boolean(absence.regularInitialBooking);
  const isPausedResumeBooking = Boolean(absence.resumePausedTicket);
  const reason = isPausedResumeBooking
    ? "휴회 복귀 정규시간 설정"
    : isRegularInitialBooking
    ? "회원 첫 정규시간 설정"
    : isMakeupEntitlement ? "불참 처리 후 보강 예약" : isCouponBooking ? "쿠폰 수업 예약" : $("#changeReason")?.value.trim() || (state.memberChangeCompactSelection ? "시간표에서 시간 변경" : "");
  if (!isMakeupEntitlement && !isCouponBooking && !isRegularInitialBooking && reason.length < 2) {
    showToast("변경 이유를 2자 이상 입력해주세요.");
    $("#changeReason")?.focus();
    return;
  }
  const client = window.TennisNoteDataClient;
  const liveRequest = Boolean(state.member?.profileId && (
    absence.serverLessonId
    || absence.makeupEntitlementId
    || ((isCouponBooking || isRegularInitialBooking) && absence.ticketId)
  ) && client?.rpc);
  if (state.dataMode === "live" && !liveRequest) {
    showToast("실제 수업 연결을 다시 확인한 뒤 요청해주세요.");
    return;
  }

  if (liveRequest) {
    const button = $("#requestMakeup");
    if (button) {
      button.disabled = true;
      button.textContent = isMakeupEntitlement || isCouponBooking ? "예약 중" : "요청 중";
    }
    try {
      const targetDate = makeup.lessonDate || memberScheduleDateForDay(makeup.day);
      if (!targetDate) throw new Error("target_lesson_date_required");
      const changeDirection = memberChangeDirection(absence, makeup);
      const regularSchedules = state.regularInitialSelections
        .map((id) => memberScheduleOptions().find((lesson) => lesson.id === id))
        .filter(Boolean)
        .map((lesson) => ({
          lessonDate: lesson.lessonDate || memberScheduleDateForDay(lesson.day),
          startTime: lesson.time,
          durationMinutes: Number(lesson.durationMinutes) || Number(absence.durationMinutes) || 20,
          coachRoleId: lesson.coachRoleId || "",
        }));
      if (isRegularInitialBooking && regularSchedules.length !== Math.max(1, Number(absence.frequencyPerWeek) || 1)) {
        throw new Error("regular_schedule_count_mismatch");
      }
      if (isRegularInitialBooking && !state.regularInitialOperationKey) {
        state.regularInitialOperationKey = `member_regular_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
      }
      const editingRequestId = state.editingChangeRequestId;
      const result = isRegularInitialBooking
        ? isPausedResumeBooking
          ? await client.rpc("tn_resume_paused_regular_schedule", {
              target_ticket_id: absence.ticketId,
              target_schedules: regularSchedules,
              target_operation_key: state.regularInitialOperationKey,
            })
          : await client.rpc("tn_book_initial_regular_schedule", {
              target_ticket_id: absence.ticketId,
              target_schedules: regularSchedules,
              target_operation_key: state.regularInitialOperationKey,
            })
        : isMakeupEntitlement
        ? await client.rpc("tn_book_makeup_entitlement", {
            target_entitlement_id: absence.makeupEntitlementId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
          })
        : isCouponBooking
          ? await client.rpc("tn_book_coupon_lesson", {
              target_ticket_id: absence.ticketId,
              target_lesson_date: targetDate,
              target_start_time: makeup.time,
            })
          : editingRequestId
            ? await client.rpc("tn_update_my_lesson_change_request", {
              target_request_id: editingRequestId,
              target_lesson_date: targetDate,
              target_start_time: makeup.time,
              target_reason: reason,
            })
          : await submitMemberLessonChange(client, {
            target_lesson_id: absence.serverLessonId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
          });
      await syncMemberLessonsFromServer();
      if (isPausedResumeBooking) await syncMemberTicketsFromServer();
      if (!isMakeupEntitlement) await syncMemberChangeRequestsFromServer();
      state.ticketHistory.unshift({
        text: isRegularInitialBooking
          ? `${absence.ticketTitle} · ${isPausedResumeBooking ? "휴회 복귀 및 정규시간 설정 완료" : "정규시간 설정 완료"}`
          : isMakeupEntitlement
          ? `${originalDay} ${originalTime} 불참 수업 → ${makeup.day} ${makeup.time} 보강 예약 완료`
          : isCouponBooking
            ? `${absence.ticketTitle} → ${makeup.day} ${makeup.time} 쿠폰 예약 완료`
            : `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} ${editingRequestId ? "요청 수정" : changeDirection === "advance" ? "앞당기기" : "변경"} ${result?.status === "auto_approved" ? "완료" : "담당 코치·관리자 승인 대기"}`,
        tone: isRegularInitialBooking || isMakeupEntitlement || isCouponBooking || result?.status === "auto_approved" ? "done" : "wait",
      });
      if ($("#changeReason")) $("#changeReason").value = "";
      window.TennisNoteInputGuard?.markSaved?.("#changeRequestModal");
      closeChangeRequestModal();
      renderAll();
      saveSnapshot();
      showToast(isRegularInitialBooking
        ? isPausedResumeBooking ? "휴회를 마치고 정규 수업시간을 설정했습니다." : "정규 수업시간이 설정되었습니다."
        : isMakeupEntitlement
        ? "보강 예약이 완료되었습니다."
        : isCouponBooking
          ? "쿠폰 수업 예약이 완료되었습니다."
          : editingRequestId
            ? "수업 변경 요청을 수정했습니다. 담당 코치 또는 관리자가 확인합니다."
          : result?.status === "auto_approved"
            ? changeDirection === "advance" ? "수업을 앞당겼습니다." : "수업 시간이 변경되었습니다."
            : changeDirection === "advance" ? "담당 코치·관리자에게 수업 앞당기기 요청을 보냈습니다." : "담당 코치·관리자에게 변경 요청을 보냈습니다.");
    } catch (error) {
      let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
      if (typeof code === "string" && code.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(code);
          code = parsed.message || parsed.code || code;
        } catch {
          // Keep the original server message when it is not valid JSON.
        }
      }
      const messages = {
        regular_schedule_count_mismatch: "회원권의 주 횟수만큼 시간을 선택해주세요.",
        initial_regular_schedule_already_exists: "이미 정규시간이 설정된 회원권입니다. 수업 변경을 이용해주세요.",
        regular_ticket_required: "사용 가능한 정규 회원권을 다시 확인해주세요.",
        regular_schedule_day_duplicate: "같은 요일은 한 번만 선택할 수 있습니다.",
        regular_schedule_single_coach_required: "주간 정규시간은 같은 코치로 선택해주세요.",
        coach_role_required: "선택한 시간의 코치를 확인할 수 없습니다. 다시 선택해주세요.",
        coach_role_inactive: "담당 코치가 현재 근무 중이 아닙니다. 관리자에게 문의해주세요.",
        change_reason_required: "변경 이유를 2자 이상 입력해주세요.",
        lesson_already_started: "이미 시작한 수업은 변경할 수 없습니다.",
        target_time_must_be_future: "이미 지난 시간으로는 변경할 수 없습니다.",
        same_lesson_time: "현재 수업과 다른 시간을 선택해주세요.",
        no_nearby_coach_lesson: "담당 코치의 기존 수업과 40분 이내인 시간만 신청할 수 있습니다.",
        target_time_occupied: "방금 다른 수업이 배정된 시간입니다. 다른 시간을 선택해주세요.",
        target_time_blocked: "브레이크 또는 운영 중지 시간입니다.",
        coach_not_working: "담당 코치의 근무시간이 아닙니다.",
        schedule_scope_mismatch: "평일권은 평일, 주말권은 주말 시간만 변경할 수 있습니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과합니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과합니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과합니다.",
        target_date_outside_ticket: "회원권 사용기간 밖의 날짜입니다.",
        coupon_booking_forbidden: "이 쿠폰을 예약할 권한이 없습니다.",
        coupon_ticket_required: "사용 가능한 쿠폰 회원권을 확인해 주세요.",
        coupon_product_required: "선택한 회원권은 쿠폰 예약 상품이 아닙니다.",
        ticket_balance_insufficient: "쿠폰 잔여 횟수가 부족합니다.",
        makeup_entitlement_not_found: "보강 대상 수업을 찾을 수 없습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_entitlement_not_open: "이미 예약되었거나 종료된 보강입니다.",
        makeup_source_lesson_invalid: "원래 수업 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_booking_forbidden: "이 보강을 예약할 권한이 없습니다.",
        active_ticket_required: "사용 가능한 회원권 횟수를 확인해 주세요.",
      };
      showToast(messages[code] || `${isMakeupEntitlement ? "보강 예약" : "수업 변경 요청"} 실패: ${code}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = memberChangeSubmitLabel(absence, makeup);
      }
    }
    return;
  }

  absence.status = "available";
  absence.member = "";
  absence.type = "수업 변경 가능";
  absence.policy = "auto";
  makeup.status = "requested";
  makeup.member = currentMemberName();
  const needsApproval = makeup.policy === "coach";
  const request = {
    id: `makeup-${Date.now()}`,
    absence: `${originalDay} ${originalTime} 기존 수업`,
    makeup: `${makeup.day} ${makeup.time} 수업 변경 희망 · ${makeup.coach}`,
    reason,
    policy: policyDetail(makeup.policy),
    status: needsApproval ? "코치 승인 대기 · 당일 취소 차감" : "자동 변경 완료",
  };
  state.makeupRequests.unshift(request);
  pushMakeupRequestToShared(request);
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} 수업 변경 요청 접수`, tone: "wait" });
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} ${originalCoach} 시간 비움 · 다른 회원 수업변경 신청 가능`, tone: "done" });
  if ($("#changeReason")) $("#changeReason").value = "";
  window.TennisNoteInputGuard?.markSaved?.("#changeRequestModal");
  closeChangeRequestModal();
  renderAll();
}

async function submitLessonLog() {
  const lesson = memberScheduleLessons().find((item) => item.id === $("#logLesson").value);
  if (!lesson) return false;

  const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
  const mediaInput = $("#lessonMedia");
  const files = [...(mediaInput?.files || [])];
  const mediaItems = mediaItemsFromInput(mediaInput);
  const mediaNames = mediaItems.map((file) => file.name);
  const journalDate = $("#journalDate")?.value || localDateKey();
  const hasLiveSession = Boolean(state.member?.profileId && window.TennisNoteDataClient?.getSession?.()?.access_token);
  const log = {
    id: `member-log-${Date.now()}`,
    lessonId: lesson.id,
    lessonLabel: `${lesson.day} ${lesson.time} · ${lesson.coach}`,
    round: lessonRound(),
    journalDate,
    content: $("#todayLessonContent").value.trim() || "수업 내용 미입력",
    selfMemo: $("#selfWorkoutMemo").value.trim() || "자기 운동 일지 미입력",
    mediaNames,
    mediaItems,
    status: hasLiveSession ? "uploading" : "coach_pending",
    curriculum,
    nextCurriculumId: curriculum.id,
    coachComment: "",
    memberVisibleSummary: "",
    ticketDeducted: false,
    submittedAt: new Date().toISOString(),
  };
  state.lessonLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  renderAll();

  if (hasLiveSession) {
    try {
      await persistLessonJournalToServer(log, files);
      log.status = "coach_pending";
      state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 운동일지 · 서버 저장 완료`, tone: "done" });
    } catch {
      log.status = "server_error";
      state.ticketHistory.unshift({ text: "운동일지 서버 저장 실패 · 네트워크와 저장공간을 확인해 주세요.", tone: "alert" });
      renderAll();
      return false;
    }
  }

  pushLessonLogToShared(log);
  state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 수업기록 제출 · 코멘트/커리큘럼 작성 대기`, tone: "wait" });
  if (mediaInput) mediaInput.value = "";
  renderAll();
  return true;
}

function confirmLatestLesson() {
  let pendingLog = state.lessonLogs.find((log) => log.status === "coach_pending");
  if (!pendingLog) {
    const fallbackLesson = memberScheduleLessons().find((item) => isCurrentMemberName(item.member) && item.status === "scheduled");
    if (!fallbackLesson || state.remaining <= 0) return;
    const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
    pendingLog = {
      id: `coach-only-${Date.now()}`,
      lessonId: fallbackLesson.id,
      lessonLabel: `${fallbackLesson.day} ${fallbackLesson.time} · ${fallbackLesson.coach}`,
      round: lessonRound(),
      content: "회원 운동일지 미작성 · 코치 코멘트와 다음 커리큘럼으로 출석 확인",
      selfMemo: "회원에게는 운동일지 작성 안내만 표시하고, 미작성 상태여도 코치 코멘트와 다음 커리큘럼 등록으로 횟수 체크합니다.",
      status: "coach_pending",
      curriculum,
      nextCurriculumId: curriculum.id,
      coachComment: "출석 확인 완료. 회원 운동일지 미작성 상태지만 코치 코멘트로 수업을 확인했습니다.",
      memberVisibleSummary: curriculum.next,
      ticketDeducted: false,
      submittedAt: new Date().toISOString(),
    };
    state.lessonLogs.unshift(pendingLog);
  }
  if (state.remaining <= 0) return;

  const lesson = ensureMemberScheduleLesson(pendingLog.lessonId);
  pendingLog.status = "confirmed";
  if (lesson) lesson.status = "completed";
  state.remaining -= 1;
  state.ticketHistory.unshift({
    text: `${lessonReviewTitle(pendingLog)} · 1회 차감`,
    tone: "done",
  });
  if (state.remaining === 2) {
    state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
  }
  renderAll();
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
const MEMBER_LIVE_REFRESH_STALE_MS = 20_000;

async function refreshMemberLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  const force = options.force === true;
  if (memberLiveScheduleRefreshInFlight) {
    if (force) memberLiveScheduleRefreshQueued = true;
    return false;
  }
  if (
    document.hidden
    || state.dataMode !== "live"
    || !state.member?.profileId
    || !client?.readiness?.().ready
    || !client?.getSession?.()?.access_token
    || (!force && Date.now() - memberLiveScheduleLastRefreshAt < MEMBER_LIVE_REFRESH_STALE_MS)
  ) return false;

  memberLiveScheduleRefreshInFlight = true;
  try {
    await syncMemberTicketsFromServer();
    const [lessonsSynced, requestsSynced, notificationResult] = await Promise.all([
      syncMemberLessonsFromServer(null, { force }),
      syncMemberChangeRequestsFromServer(),
      syncMemberNotificationsFromServer(),
      syncMemberPaymentOptionsFromServer(),
      syncMemberDiscountCouponsFromServer(),
    ]);
    if (options.render !== false) renderActiveMemberView();
    if (notificationResult?.newNotification) {
      showToast(`${notificationResult.newNotification.title} · 시간표에서 확인해 주세요.`);
    }
    memberLiveScheduleLastRefreshAt = Date.now();
    return Boolean(lessonsSynced || requestsSynced || notificationResult?.ok);
  } finally {
    memberLiveScheduleRefreshInFlight = false;
    if (memberLiveScheduleRefreshQueued) {
      memberLiveScheduleRefreshQueued = false;
      queueMicrotask(() => {
        void refreshMemberLiveSchedule({ force: true, render: options.render !== false });
      });
    }
  }
}

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

function openLocalCurriculumPreview() {
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
  const previewRequested = new URLSearchParams(window.location.search).get("curriculumPreview") === "1";
  if (!localHost || !previewRequested) return false;
  state.dataMode = "demo";
  state.member = {
    provider: "local-preview",
    name: "커리큘럼 미리보기",
    nickname: "미리보기",
    profileId: "local-curriculum-preview",
    role: "member",
    memberKind: "lesson_member",
    status: "active",
    coachApproved: false,
  };
  state.profile = {
    ...state.profile,
    name: "커리큘럼 미리보기",
    nickname: "미리보기",
    branch: "테클하",
    mainCoach: "담당 코치",
    ticket: "커리큘럼 화면 검증",
  };
  ensureDemoPresentation();
  renderAll();
  openAppFromSession(false);
  setView("curriculumView");
  return true;
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
