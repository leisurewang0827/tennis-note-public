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
  memberLessonChangeOperationKey: "",
  memberLessonChangeOperationSignature: "",
  memberChangeCompactSelection: false,
  memberScheduleModeTouched: false,
  memberScheduleFullView: false,
  activeJournalMonth: localDateKey().slice(0, 7),
  selectedJournalDate: localDateKey(),
  journalCalendarViewMode: "month",
  selectedLessonDetailId: "",
  selectedLessonDetailSegmentIds: [],
  memberSameDayAbsences: [],
  selectedSameDayAbsenceLessonId: "",
  sameDayAbsencePolicy: null,
  sameDayAbsenceOperationKey: "",
  sameDayAbsenceSubmitting: false,
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
    settingsAppliedAt: "",
    methodAvailability: [],
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
    paymentErrorCode: "",
    paymentErrorMessage: "",
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
  publicMembershipProducts: [],
  publicMembershipProductStatus: "loading",
  membershipPricingQuotes: {},
  liveTickets: [],
  pendingPurchaseSchedules: [],
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
  serverChangePolicySnapshot: null,
  serverChangeBlockedReason: "",
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

const brandSplashStartedAt = performance.now();
// The splash should confirm that the app opened, not hold the member on a
// blank screen while optional network requests finish.
const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;
let appToastTimer = 0;

function memberViewportGeometry() {
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(1, Math.round(window.innerHeight || viewport?.height || 1));
  const rawHeight = Math.max(1, Math.round(viewport?.height || layoutHeight));
  const rawOffsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
  const offsetTop = Math.min(rawOffsetTop, Math.max(0, layoutHeight - 1));
  const height = Math.max(1, Math.min(rawHeight, layoutHeight - offsetTop));
  return { height, offsetTop };
}

function stabilizeMemberVisualViewport() {
  syncMemberVisualViewport();
  window.requestAnimationFrame(syncMemberVisualViewport);
  window.setTimeout(syncMemberVisualViewport, 240);
}

syncMemberVisualViewport();
window.addEventListener("resize", syncMemberVisualViewport, { passive: true });
window.addEventListener("pageshow", stabilizeMemberVisualViewport, { passive: true });
window.addEventListener("orientationchange", stabilizeMemberVisualViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncMemberVisualViewport, { passive: true });
window.visualViewport?.addEventListener("scroll", syncMemberVisualViewport, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") stabilizeMemberVisualViewport();
});
document.addEventListener("tennisnote:sheet-opened", stabilizeMemberVisualViewport);
document.addEventListener("tennisnote:sheet-closed", stabilizeMemberVisualViewport);

const times = makeMemberTimeRange("18:40", "21:20");
const onboardingIntentStartValues = new Set(["join", "one-day", "membership", "renew"]);
const onboardingIntentSourceValues = new Set(["direct", "onsite_qr", "kakao_channel", "naver_place"]);
let onboardingIntentApplying = false;
let onboardingIntentRecordedKey = "";
let publicPurchaseDirectoryCache = null;
let publicPurchaseDirectoryLoad = { key: "", status: "idle", error: "" };

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

function isDirectPurchaseMembershipProduct(product = {}) {
  const mode = String(product.mode || "").toLowerCase();
  const productKind = String(product.productKind || "").toLowerCase();
  const status = String(product.status || "").toLowerCase();
  return productKind !== "consult"
    && status !== "consult"
    && !["renewal", "add"].includes(mode);
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
let oauthLoginInFlightProvider = "";
let emailAuthMode = "login";
let emailPasswordRecoveryPending = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
let identityPhoneVerification = {
  phone: "",
  status: "unverified",
  source: "",
};
let identityAuthCapabilities = {
  status: "unknown",
  providers: {
    phone: null,
    email: null,
    apple: null,
    kakao: null,
    naver: null,
    google: false,
  },
  errorCode: "",
  checkedAt: 0,
};
let identityAuthCapabilityPromise = null;
let identityPhoneRequestInFlight = false;

const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";

let deferredPwaInstallPrompt = null;

let pushListenersReady = false;
let pushProfileId = "";
let pushPrimerTimer = null;
let pushPrimerAttempts = 0;

let bankNotificationBridgePluginCache = null;
let bankNotificationBridgeState = null;

let memberNativeAppInfo = null;

let nativeBackListenerReady = false;

function memberAvailableSlotIdentity(lesson = {}) {
  const coachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
  const lessonDate = String(lesson.lessonDate || memberScheduleDateForDay(lesson.day) || "");
  const time = String(lesson.time || lesson.startTime || "").slice(0, 5);
  const ticketId = String(lesson.ticketId || lesson.member_ticket_id || "");
  const duration = Number(lesson.durationMinutes) || 0;
  return `${coachRoleId}|${lessonDate}|${time}|${ticketId}|${duration}`;
}

function memberUniqueAvailableSlots(slots = []) {
  const unique = new Map();
  slots.forEach((slot) => {
    const key = memberAvailableSlotIdentity(slot);
    if (!unique.has(key)) unique.set(key, slot);
  });
  return [...unique.values()];
}

function memberTicketRefundHeld(ticketId = "") {
  return Boolean((state.liveTickets || []).find((ticket) => (
    String(ticket.id || "") === String(ticketId || "") && ticket.refundHoldId
  )));
}

function memberChangePolicySnapshot(candidate = null) {
  return candidate?.policySnapshot && typeof candidate.policySnapshot === "object"
    ? candidate.policySnapshot
    : state.serverChangePolicySnapshot && typeof state.serverChangePolicySnapshot === "object"
      ? state.serverChangePolicySnapshot
      : null;
}

function memberChangeCutoffHours(snapshot = null) {
  return Math.min(168, Math.max(1, Number(snapshot?.cutoffHours) || 24));
}

function memberChangeReasonMode(source = null, selected = null) {
  if (source?.makeupEntitlementId || source?.couponBooking || source?.regularInitialBooking) return "none";
  return memberChangePolicySnapshot(selected)?.reasonMode || "required";
}

function renderMemberChangeReasonControl(source = null, selected = null) {
  const field = $("#changeReasonField");
  const input = $("#changeReason");
  if (!field || !input) return;
  const mode = memberChangeReasonMode(source, selected);
  field.hidden = mode === "none";
  input.required = mode === "required";
  input.disabled = mode === "none";
  const title = field.querySelector("span");
  if (title) title.textContent = mode === "required" ? "3. 변경 사유" : "3. 변경 사유 (선택)";
  input.placeholder = mode === "required" ? "담당 코치가 확인할 수 있게 입력해 주세요" : "필요한 경우에만 입력해 주세요";
}

function memberChangeBlockedMessage(code = "", snapshot = null) {
  const hours = memberChangeCutoffHours(snapshot);
  return {
    member_change_disabled: "회원 앱에서 수업을 변경할 수 없습니다. 담당 코치에게 문의해 주세요.",
    group_member_change_blocked: "그룹수업은 앱에서 변경할 수 없습니다. 담당 코치에게 문의해 주세요.",
    member_change_within_cutoff_blocked: `수업까지 ${hours}시간 미만 남아 앱에서 변경할 수 없습니다. 담당 코치에게 문의해 주세요.`,
  }[code] || "현재 회원 앱에서 이 수업을 변경할 수 없습니다.";
}

function latestPreviousMembershipTicket() {
  return [...(state.liveTickets || []), ...(state.expiredTickets || [])]
    .filter((ticket) => ["active", "paused", "expired"].includes(String(ticket.status || "").toLowerCase()))
    .sort((left, right) => String(right.expiresOn || right.createdAt || "").localeCompare(String(left.expiresOn || left.createdAt || "")))[0] || null;
}

function purchaseDirectoryContext(product = purchaseFlowProduct()) {
  const sourceTicket = purchaseFlowSourceTicket();
  const branchId = String(product?.branchId || sourceTicket?.branchId || sourceTicket?.branch_id || "");
  const week = purchaseScheduleWeek();
  const rangeStart = new Date(`${week.startDate}T12:00:00`);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + memberScheduleWorkspaceDays);
  const from = localDateKey(rangeStart);
  const to = localDateKey(rangeEnd);
  return {
    branchId,
    from,
    to,
    key: `${branchId}:${from}:${to}`,
  };
}

function purchaseDirectoryForCurrentProduct(product = purchaseFlowProduct()) {
  const context = purchaseDirectoryContext(product);
  if (!memberPurchaseDirectoryCache || memberPurchaseDirectoryCache.key !== context.key) return null;
  return memberPurchaseDirectoryCache.directory || null;
}

function normalizePurchaseDirectoryCoach(coach = {}, coachIndex = 0) {
  const availability = Array.isArray(coach.availability) ? coach.availability : [];
  const workBlocks = availability
    .filter((block) => String(block.type || "available") === "available")
    .map((block, blockIndex) => ({
      id: `${coach.roleId || coach.id || "coach"}-purchase-${blockIndex}`,
      days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
      start: String(block.startTime || "").slice(0, 5),
      end: String(block.endTime || "").slice(0, 5),
      label: "근무",
    }))
    .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
  const blockedBlocks = availability
    .filter((block) => String(block.type || "") === "blocked")
    .map((block, blockIndex) => ({
      id: `${coach.roleId || coach.id || "coach"}-purchase-blocked-${blockIndex}`,
      days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
      start: String(block.startTime || "").slice(0, 5),
      end: String(block.endTime || "").slice(0, 5),
      label: block.note || "브레이크·상담",
    }))
    .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
  const serverLaneOrder = Number(coach.laneOrder);
  const laneOrder = Number.isFinite(serverLaneOrder) ? serverLaneOrder : 1000 + coachIndex;
  return normalizeMemberCoach({
    id: coach.roleId || coach.id,
    serverRoleId: coach.roleId || coach.id,
    roleId: coach.roleId || coach.id,
    branchId: coach.branchId || "",
    name: coach.name || "이름 없음",
    status: "approved",
    employmentStatus: "active",
    laneOrder,
    scheduleLaneOrder: laneOrder,
    workBlocks,
    blockedBlocks,
  });
}

function purchaseDirectoryCoaches(product = purchaseFlowProduct()) {
  const directory = purchaseDirectoryForCurrentProduct(product);
  return (directory?.coaches || []).map(normalizePurchaseDirectoryCoach);
}

function purchaseSchedulePolicy(product = purchaseFlowProduct()) {
  const fallback = loadAdminSchedulePolicy();
  const directory = purchaseDirectoryForCurrentProduct(product);
  if (!directory) return fallback;
  const breakRules = (directory.breakRules || []).map((rule, ruleIndex) => ({
    id: rule.id || `purchase-break-${ruleIndex}`,
    days: [days[Number(rule.dayOfWeek) === 0 ? 6 : Number(rule.dayOfWeek) - 1]].filter(Boolean),
    start: String(rule.startTime || "").slice(0, 5),
    end: String(rule.endTime || "").slice(0, 5),
    label: rule.label || "브레이크타임",
  })).filter((rule) => rule.days.length && minutesFromTime(rule.start) < minutesFromTime(rule.end));
  return {
    ...fallback,
    openStart: String(directory.openStart || fallback.openStart || "06:40").slice(0, 5),
    openEnd: String(directory.openEnd || fallback.openEnd || "22:00").slice(0, 5),
    breakRules,
    coaches: purchaseDirectoryCoaches(product),
  };
}

function purchaseOccupancyLessons(product = purchaseFlowProduct()) {
  const directory = purchaseDirectoryForCurrentProduct(product);
  if (!directory) return state.liveLessons || [];
  return (directory.occupancy || []).map((occupied, index) => ({
    id: `purchase-occupancy-${index}-${occupied.lessonDate || ""}-${occupied.startTime || ""}-${occupied.coachRoleId || ""}`,
    lessonDate: String(occupied.lessonDate || ""),
    time: String(occupied.startTime || "").slice(0, 5),
    coachRoleId: String(occupied.coachRoleId || ""),
    coach_role_id: String(occupied.coachRoleId || ""),
    durationMinutes: Math.max(10, Number(occupied.durationMinutes) || 20),
    status: "occupied",
    serverStatus: "occupied",
  }));
}

function purchaseProductAllowsCoach(product = {}, coachRoleId = "") {
  const roleId = String(coachRoleId || "");
  if (!roleId) return false;
  const coachSaleMode = String(product.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active";
  if (coachSaleMode === "all_active") return true;
  return product.coachSaleAvailability?.[roleId] === true;
}

function purchaseProductFrequency(product = {}) {
  return Math.max(1, Number(product.frequencyPerWeek || product.frequency_per_week) || 1);
}

function purchaseWeekStartDate(dateKey = "") {
  const value = new Date(`${dateKey || localDateKey()}T12:00:00`);
  if (Number.isNaN(value.getTime())) return purchaseWeekStartDate(localDateKey());
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return localDateKey(value);
}

function purchaseWeekDates(weekStart = "") {
  const start = new Date(`${purchaseWeekStartDate(weekStart)}T12:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return localDateKey(value);
  });
}

function purchaseScheduleScopeDates(product = purchaseFlowProduct(), weekStart = purchaseFlowState().scheduleWeekStart) {
  const scopes = purchaseProductScheduleScopes(product || {});
  return purchaseWeekDates(weekStart).filter((dateKey) => {
    const weekend = ["토", "일"].includes(purchaseDateDay(dateKey));
    return scopes.has(weekend ? "weekend" : "weekday");
  });
}

function purchaseScheduleSelectionWeek(schedules = purchaseSelectedSchedules()) {
  return schedules.length ? purchaseWeekStartDate(schedules[0].lessonDate) : "";
}

function purchaseEarliestScheduleWeekStart(coachRoleId = "", product = purchaseFlowProduct()) {
  const targetCoachRoleId = String(coachRoleId || "");
  const firstAvailable = purchaseAvailableScheduleSlots(product).find((slot) => (
    !targetCoachRoleId || String(slot.coachRoleId) === targetCoachRoleId
  ));
  return purchaseWeekStartDate(firstAvailable?.lessonDate || purchaseAvailabilityRange().start);
}

function alignPurchaseScheduleWeekToAvailability(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const selectedWeek = purchaseScheduleSelectionWeek(purchaseSelectedSchedules(product));
  if (selectedWeek) {
    const changed = flow.scheduleWeekStart !== selectedWeek;
    flow.scheduleWeekStart = selectedWeek;
    return changed;
  }
  if (!product || purchaseScheduleAvailabilityState() !== "ready") return false;
  const coachRoleId = String(flow.coachRoleId || "");
  const currentWeek = purchaseWeekStartDate(flow.scheduleWeekStart || purchaseAvailabilityRange().start);
  const matchingSlots = purchaseAvailableScheduleSlots(product).filter((slot) => (
    !coachRoleId || String(slot.coachRoleId) === coachRoleId
  ));
  const currentWeekHasSlot = matchingSlots.some((slot) => purchaseWeekStartDate(slot.lessonDate) === currentWeek);
  const nextWeek = currentWeekHasSlot
    ? currentWeek
    : purchaseWeekStartDate(matchingSlots[0]?.lessonDate || purchaseAvailabilityRange().start);
  const changed = flow.scheduleWeekStart !== nextWeek;
  flow.scheduleWeekStart = nextWeek;
  return changed;
}

function purchaseScheduleKey(schedule = {}) {
  return `${schedule.lessonDate || ""}:${String(schedule.startTime || schedule.time || "").slice(0, 5)}:${schedule.coachRoleId || ""}`;
}

function purchaseSchedulesAvailableNow(product = purchaseFlowProduct()) {
  const selectedSchedules = purchaseSelectedSchedules(product);
  if (!selectedSchedules.length || purchaseScheduleAvailabilityState() !== "ready") return false;
  const availableKeys = new Set(purchaseAvailableScheduleSlots(product).map((slot) => purchaseScheduleKey({
    lessonDate: slot.lessonDate,
    startTime: slot.time,
    coachRoleId: slot.coachRoleId,
  })));
  return selectedSchedules.every((schedule) => availableKeys.has(purchaseScheduleKey(schedule)));
}

function reconcilePurchaseSchedulesAfterRefresh(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  if (!product || !flow.preferredSchedules.length || purchaseScheduleAvailabilityState() !== "ready") return 0;
  const availableSlots = purchaseAvailableScheduleSlots(product);
  const availableKeys = new Set(availableSlots.map((slot) => purchaseScheduleKey({
    lessonDate: slot.lessonDate,
    startTime: slot.time,
    coachRoleId: slot.coachRoleId,
  })));
  const previous = [...flow.preferredSchedules];
  flow.preferredSchedules = previous.filter((schedule) => availableKeys.has(purchaseScheduleKey(schedule)));
  const removedCount = previous.length - flow.preferredSchedules.length;
  if (!removedCount) return 0;
  const selectedCoachSlots = availableSlots.filter((slot) => String(slot.coachRoleId) === String(flow.coachRoleId || ""));
  const firstAvailable = selectedCoachSlots[0] || availableSlots[0] || null;
  if (!flow.preferredSchedules.length && firstAvailable) {
    flow.scheduleWeekStart = purchaseWeekStartDate(firstAvailable.lessonDate);
  }
  syncLegacyPurchaseScheduleFields();
  saveSnapshot();
  return removedCount;
}

function purchaseCoachSelectionHtml(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const status = purchaseScheduleAvailabilityState();
  if (status === "loading") return '<p class="purchase-availability-state" role="status">선생님과 가능한 시간을 확인하고 있습니다.</p>';
  if (status === "error" || status === "coach_error") return '<p class="purchase-availability-state is-error" role="status">선생님 정보를 불러오지 못했습니다. 다시 확인해 주세요.</p>';
  const slots = purchaseAvailableScheduleSlots(product);
  const sourceTicket = purchaseFlowSourceTicket();
  const sourceCoachId = flow.purchasePurpose === "renew_same" ? String(sourceTicket?.coachRoleId || "") : "";
  const coaches = purchaseCoachOptions().filter((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    const productAllowed = purchaseProductAllowsCoach(product, roleId);
    return productAllowed && (!sourceCoachId || roleId === sourceCoachId);
  });
  const selectedCoach = coaches.find((coach) => (
    String(coach.serverRoleId || coach.roleId || coach.id || "") === String(flow.coachRoleId || sourceCoachId)
  ));
  if (selectedCoach) {
    const roleId = String(selectedCoach.serverRoleId || selectedCoach.roleId || selectedCoach.id || "");
    const first = slots.find((slot) => String(slot.coachRoleId) === roleId);
    return `<article class="purchase-selected-coach">
      <div><span>선택한 선생님</span><strong>${escapeHtml(memberCoachShortName(selectedCoach.name || flow.coachName || "담당 코치"))} 코치</strong><small>${first ? `가장 빠른 ${escapeHtml(purchaseDateLabel(first.lessonDate))} ${escapeHtml(first.time)}` : "현재 가능한 시간 없음"}</small></div>
      ${sourceCoachId ? "" : '<button class="small-button" type="button" data-clear-purchase-coach>다시 선택</button>'}
    </article>`;
  }
  return `<div class="purchase-coach-filter-grid" role="group" aria-label="선생님 선택">
    ${coaches.map((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    const first = slots.find((slot) => String(slot.coachRoleId) === roleId);
    return `<button class="purchase-coach-filter ${first ? "" : "is-unavailable"}" type="button"
      data-purchase-coach-filter="${escapeHtml(roleId)}" data-purchase-coach-filter-name="${escapeHtml(coach.name || "담당 코치")}" ${first ? "" : "disabled"}
      aria-pressed="false"><strong>${escapeHtml(memberCoachShortName(coach.name || "담당 코치"))} 코치</strong><small>${first ? `가장 빠른 ${escapeHtml(purchaseDateLabel(first.lessonDate))} ${escapeHtml(first.time)}` : "현재 가능한 시간 없음"}</small></button>`;
  }).join("")}
  </div>`;
}

function purchaseSchedulePickerCoach() {
  const flow = purchaseFlowState();
  const sourceTicket = purchaseFlowSourceTicket();
  const coachRoleId = String(flow.coachRoleId || (flow.purchasePurpose === "renew_same" ? sourceTicket?.coachRoleId : "") || "");
  return purchaseCoachOptions().find((coach) => (
    String(coach.serverRoleId || coach.roleId || coach.id || "") === coachRoleId
  )) || null;
}

function purchaseScheduleCellState(product, coach, dateKey, time, availableKeys, selectedKeys) {
  const coachRoleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
  const key = purchaseScheduleKey({ lessonDate: dateKey, startTime: time, coachRoleId });
  const selected = selectedKeys.has(key);
  const durationMinutes = Math.max(10, Number(product?.lessonMinutes) || 20);
  const lessonTime = new Date(`${dateKey}T${time}:00`).getTime();
  const day = purchaseDateDay(dateKey);
  const policy = purchaseSchedulePolicy(product);
  const operation = purchaseScheduleOperationForDate(dateKey);
  const working = isMemberCoachWorking(coach, day, time, durationMinutes);
  const closed = lessonTime <= Date.now()
    || !purchaseOperationAllowsSlot(operation, time, durationMinutes)
    || memberBreakRuleOverlaps(policy, day, time, durationMinutes)
    || !working;
  if (selected) return availableKeys.has(key) ? "selected" : "conflict";
  if (closed) return "off";
  if (availableKeys.has(key)) return "available";
  if (purchaseHasCoachLessonAtDate(purchaseOccupancyLessons(product), dateKey, time, coach, durationMinutes, policy)) return "busy";
  return "off";
}

function purchaseSchedulePickerGridHtml(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const coach = purchaseSchedulePickerCoach();
  if (!product || !coach) return '<p class="purchase-availability-state">코치를 먼저 선택해 주세요.</p>';
  const weekStart = flow.scheduleWeekStart || purchaseWeekStartDate(purchaseAvailabilityRange().start);
  const dateKeys = purchaseScheduleScopeDates(product, weekStart);
  const durationMinutes = Math.max(10, Number(product.lessonMinutes) || 20);
  const coachRoleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
  const slots = purchaseAvailableScheduleSlots(product).filter((slot) => (
    String(slot.coachRoleId) === coachRoleId && dateKeys.includes(slot.lessonDate)
  ));
  const availableKeys = new Set(slots.map((slot) => purchaseScheduleKey({
    lessonDate: slot.lessonDate,
    startTime: slot.time,
    coachRoleId: slot.coachRoleId,
  })));
  const selectedSchedules = purchaseSelectedSchedules(product);
  const selectedKeys = new Set(selectedSchedules.map((schedule) => purchaseScheduleKey(schedule)));
  const times = [...new Set(dateKeys.flatMap((dateKey) => (
    memberCoachBookableTimes(coach, purchaseDateDay(dateKey), durationMinutes)
  )))].sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
  const visibleTimes = flow.scheduleAvailableOnly
    ? times.filter((time) => dateKeys.some((dateKey) => {
      const stateName = purchaseScheduleCellState(product, coach, dateKey, time, availableKeys, selectedKeys);
      return ["available", "selected", "conflict"].includes(stateName);
    }))
    : times;
  if (!visibleTimes.length) return '<p class="purchase-availability-state">이 주에는 선택 가능한 시간이 없습니다.</p>';
  const columns = `64px repeat(${Math.max(1, dateKeys.length)}, minmax(82px, 1fr))`;
  const header = `<div class="purchase-timetable-row is-header" style="grid-template-columns:${columns}">
    <span class="purchase-timetable-time">시간</span>
    ${dateKeys.map((dateKey) => `<strong><span>${escapeHtml(purchaseDateDay(dateKey))}</span><small>${escapeHtml(purchaseDateLabel(dateKey).split("(")[0])}</small></strong>`).join("")}
  </div>`;
  const rows = visibleTimes.map((time) => `<div class="purchase-timetable-row" style="grid-template-columns:${columns}">
    <span class="purchase-timetable-time">${escapeHtml(time)}</span>
    ${dateKeys.map((dateKey) => {
    const cellState = purchaseScheduleCellState(product, coach, dateKey, time, availableKeys, selectedKeys);
    const selectedSchedule = selectedSchedules.find((schedule) => purchaseScheduleKey(schedule) === purchaseScheduleKey({ lessonDate: dateKey, startTime: time, coachRoleId }));
    const slot = slots.find((candidate) => candidate.lessonDate === dateKey && candidate.time === time) || selectedSchedule;
    if (["available", "selected", "conflict"].includes(cellState) && slot) {
      const label = cellState === "selected" ? "선택" : cellState === "conflict" ? "다시 선택" : "가능";
      return `<button type="button" class="purchase-timetable-cell is-${cellState}" data-purchase-slot="${escapeHtml(slot.id || `selected-${dateKey}-${time}`)}"
        data-purchase-slot-date="${escapeHtml(dateKey)}" data-purchase-slot-day="${escapeHtml(purchaseDateDay(dateKey))}"
        data-purchase-slot-time="${escapeHtml(time)}" data-purchase-slot-coach="${escapeHtml(coachRoleId)}"
        data-purchase-slot-coach-name="${escapeHtml(coach.name || flow.coachName || "담당 코치")}" aria-pressed="${cellState === "selected"}">${label}</button>`;
    }
    if (cellState === "busy") return '<span class="purchase-timetable-cell is-busy">예약됨</span>';
    return '<span class="purchase-timetable-cell is-off" aria-label="선택 불가">-</span>';
  }).join("")}
  </div>`).join("");
  return `<div class="purchase-timetable" role="grid" aria-label="${escapeHtml(memberCoachShortName(coach.name || "담당 코치"))} 코치 주간 시간표">${header}${rows}</div>`;
}

function renderPurchaseScheduleSheet() {
  const sheet = $("#purchaseScheduleSheet");
  if (!sheet) return;
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  const coach = purchaseSchedulePickerCoach();
  const range = purchaseAvailabilityRange();
  const selectedSchedules = purchaseSelectedSchedules(product);
  const requiredCount = purchaseRequiredScheduleCount(product);
  const flexibleCoupon = purchaseUsesFlexibleCouponSchedule(product, flow);
  const selectedWeek = purchaseScheduleSelectionWeek(selectedSchedules);
  if (!flow.scheduleWeekStart) flow.scheduleWeekStart = selectedWeek || purchaseWeekStartDate(range.start);
  const weekDates = purchaseWeekDates(flow.scheduleWeekStart);
  const previousWeek = new Date(`${flow.scheduleWeekStart}T12:00:00`);
  previousWeek.setDate(previousWeek.getDate() - 7);
  const nextWeek = new Date(`${flow.scheduleWeekStart}T12:00:00`);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const previousAllowed = purchaseWeekDates(localDateKey(previousWeek)).some((dateKey) => dateKey >= range.start && dateKey <= range.end);
  const nextAllowed = purchaseWeekDates(localDateKey(nextWeek)).some((dateKey) => dateKey >= range.start && dateKey <= range.end);
  if ($("#purchaseScheduleSheetCoachOptions")) $("#purchaseScheduleSheetCoachOptions").innerHTML = flexibleCoupon
    ? purchaseFlexibleCouponCoachSelectionHtml(product)
    : purchaseCoachSelectionHtml(product);
  if ($("#purchaseScheduleSheetTitle")) {
    $("#purchaseScheduleSheetTitle").textContent = flexibleCoupon
      ? "담당 코치 선택"
      : coach || flow.coachName
      ? `${memberCoachShortName(coach?.name || flow.coachName)} 코치 시간표`
      : "선생님·시간 선택";
  }
  if ($("#purchaseScheduleSheetProgress")) $("#purchaseScheduleSheetProgress").hidden = flexibleCoupon;
  const weekbar = sheet.querySelector(".purchase-schedule-weekbar");
  if (weekbar) weekbar.hidden = flexibleCoupon;
  if ($("#purchaseScheduleSheetGrid")) $("#purchaseScheduleSheetGrid").hidden = flexibleCoupon;
  if ($("#purchaseScheduleSheetWeek")) $("#purchaseScheduleSheetWeek").textContent = `${purchaseDateLabel(weekDates[0])} - ${purchaseDateLabel(weekDates[6])}`;
  if ($("#purchaseScheduleSheetProgress")) $("#purchaseScheduleSheetProgress").textContent = flexibleCoupon ? "" : `${selectedSchedules.length}/${requiredCount} 선택`;
  if ($("#purchaseScheduleSheetGrid")) $("#purchaseScheduleSheetGrid").innerHTML = flexibleCoupon ? "" : purchaseSchedulePickerGridHtml(product);
  if ($("#purchaseSchedulePreviousWeek")) $("#purchaseSchedulePreviousWeek").disabled = !previousAllowed;
  if ($("#purchaseScheduleNextWeek")) $("#purchaseScheduleNextWeek").disabled = !nextAllowed;
  const availableToggle = $("#purchaseScheduleAvailableOnly");
  if (availableToggle) {
    availableToggle.classList.toggle("is-selected", flow.scheduleAvailableOnly);
    availableToggle.setAttribute("aria-pressed", String(flow.scheduleAvailableOnly));
  }
  const scheduleReady = flexibleCoupon
    ? purchaseFlexibleCouponCoachIsReady(product)
    : selectedSchedules.length === requiredCount && purchaseSchedulesAvailableNow(product);
  const summary = $("#purchaseScheduleSheetSummary");
  if (summary) summary.textContent = flexibleCoupon
    ? scheduleReady ? "결제 후 원하는 시간을 예약합니다." : "담당 코치를 선택하면 완료할 수 있어요."
    : selectedSchedules.length
    ? selectedSchedules.map((schedule) => `${purchaseDateLabel(schedule.lessonDate)} ${schedule.startTime}`).join(" · ")
    : "담당 코치와 시간을 선택하면 완료할 수 있어요.";
  const completeButton = $("#completePurchaseScheduleSelection");
  if (completeButton) {
    completeButton.disabled = !scheduleReady;
    completeButton.setAttribute("aria-disabled", String(!scheduleReady));
    completeButton.setAttribute("aria-describedby", "purchaseScheduleSheetSummary");
  }
}

function openPurchaseScheduleSheet() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  const selectedSchedules = purchaseSelectedSchedules();
  const range = purchaseAvailabilityRange();
  flow.scheduleWeekStart = purchaseScheduleSelectionWeek(selectedSchedules) || flow.scheduleWeekStart || purchaseWeekStartDate(range.start);
  if (!purchaseUsesFlexibleCouponSchedule(product, flow) && alignPurchaseScheduleWeekToAvailability(product)) saveSnapshot();
  renderPurchaseScheduleSheet();
  openAppSheet("purchaseScheduleSheet", { initialFocus: purchaseUsesFlexibleCouponSchedule(product, flow) ? "[data-purchase-coach-filter], [data-close-purchase-schedule]" : "#purchaseScheduleAvailableOnly" });
}

function movePurchaseSchedulePickerWeek(offset = 0) {
  const flow = purchaseFlowState();
  const value = new Date(`${flow.scheduleWeekStart || purchaseWeekStartDate(purchaseAvailabilityRange().start)}T12:00:00`);
  value.setDate(value.getDate() + Number(offset || 0) * 7);
  flow.scheduleWeekStart = purchaseWeekStartDate(localDateKey(value));
  saveSnapshot();
  renderPurchaseScheduleSheet();
}

function completePurchaseScheduleSelection() {
  const product = purchaseFlowProduct();
  if (purchaseUsesFlexibleCouponSchedule(product)) {
    if (!purchaseFlexibleCouponCoachIsReady(product)) {
      showToast("담당 코치를 선택해 주세요.");
      return;
    }
    clearPurchaseSchedules();
    purchaseFlowState().scheduleMode = "flex";
    saveSnapshot();
    closeAppSheet("purchaseScheduleSheet");
    renderMembershipPurchaseFlow();
    return;
  }
  const selectedSchedules = purchaseSelectedSchedules(product);
  const requiredCount = purchaseRequiredScheduleCount(product);
  if (selectedSchedules.length !== requiredCount) {
    showToast(`시간 ${requiredCount}개를 모두 선택해 주세요.`);
    return;
  }
  if (!purchaseSchedulesAvailableNow(product)) {
    showToast("선택한 시간 중 예약할 수 없는 시간이 있습니다. 다시 선택해 주세요.");
    renderPurchaseScheduleSheet();
    return;
  }
  closeAppSheet("purchaseScheduleSheet");
  renderMembershipPurchaseFlow();
}

function purchaseMatchingProducts(products = membershipProducts(), sourceTicket = purchaseFlowSourceTicket()) {
  const flow = purchaseFlowState();
  const familyProducts = distinctMembershipProductsForFamily(flow.familyId, products).filter((product) => {
    const weekendOnlyThirtyMinute = Number(product.lessonMinutes || 0) === 30
      && membershipProductFacet(product, "scheduleScope") === "weekend";
    return !weekendOnlyThirtyMinute
      || (flow.purchasePurpose === "renew_same" && flow.scheduleMode === "keep");
  });
  const renewing = flow.purchasePurpose === "renew_same" && Boolean(sourceTicket);
  if (renewing || ["coupon", "one-day"].includes(flow.familyId)) return familyProducts;
  return familyProducts.filter((product) => {
    const scope = membershipProductFacet(product, "scheduleScope");
    return purchaseProductFrequency(product) === flow.productFrequency
      && (scope === flow.productScheduleScope || scope === "mixed");
  });
}

function purchaseSimpleProductFiltersHtml() {
  const flow = purchaseFlowState();
  if (["coupon", "one-day"].includes(flow.familyId)
    || (flow.purchasePurpose === "renew_same" && purchaseFlowSourceTicket())) return "";
  const products = distinctMembershipProductsForFamily(flow.familyId, membershipProducts());
  const frequencyAvailable = (frequency) => products.some((product) => purchaseProductFrequency(product) === frequency);
  const scopeAvailable = (scope) => products.some((product) => {
    const productScope = membershipProductFacet(product, "scheduleScope");
    return productScope === scope || productScope === "mixed";
  });
  return `
    <div class="purchase-simple-filters">
      <div><span>주 횟수</span><div role="group" aria-label="주 수업 횟수">
        ${[1, 2, 3].map((frequency) => {
          const available = frequencyAvailable(frequency);
          return `<button type="button" data-purchase-frequency="${frequency}" aria-pressed="${flow.productFrequency === frequency}" class="${flow.productFrequency === frequency ? "is-selected" : ""}" ${available ? "" : 'disabled aria-disabled="true" title="이 요일 조건으로 판매하는 상품이 없습니다"'}>주 ${frequency}회</button>`;
        }).join("")}
      </div></div>
      <div><span>수업 요일</span><div role="group" aria-label="평일 또는 주말">
        ${[["weekday", "평일"], ["weekend", "주말"]].map(([scope, label]) => {
          const available = scopeAvailable(scope);
          return `<button type="button" data-purchase-scope="${scope}" aria-pressed="${flow.productScheduleScope === scope}" class="${flow.productScheduleScope === scope ? "is-selected" : ""}" ${available ? "" : 'disabled aria-disabled="true" title="이 주 횟수로 판매하는 상품이 없습니다"'}>${label}</button>`;
        }).join("")}
      </div></div>
    </div>`;
}

function renderPurchaseProductSheet() {
  const options = $("#purchaseProductSheetOptions");
  if (options) options.innerHTML = purchaseStepOneHtml();
}

function openPurchaseProductSheet() {
  renderPurchaseProductSheet();
  openAppSheet("purchaseProductSheet", { initialFocus: "[data-purchase-family]" });
}

function purchaseContinueReason() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  if (membershipPurchasePaymentInFlight) return "중복 주문 없이 결제 상태를 확인하고 있습니다.";
  if (!["renew_same", "add_coach", "new_purchase", "one_day"].includes(flow.purchasePurpose)) {
    return "연장 또는 새 이용권을 선택해 주세요.";
  }
  if (!product) return "상품을 선택해 주세요.";
  if (flow.purchasePurpose === "renew_same" && purchaseFlowSourceTicket() && flow.scheduleMode === "keep") {
    return isPaymentGatewayReady(normalizeSelectedPaymentMethod())
      ? "선택 내용을 확인한 뒤 결제할 수 있습니다."
      : "토스페이 결제를 준비하고 있습니다. 잠시 후 다시 확인해 주세요.";
  }
  const availabilityState = purchaseScheduleAvailabilityState();
  if (availabilityState === "loading") return "선생님과 가능한 시간을 최신 시간표에서 확인하고 있습니다.";
  if (availabilityState === "error" || availabilityState === "coach_error") return "선생님·시간 정보를 다시 불러온 뒤 결제할 수 있습니다.";
  if (!flow.coachRoleId) return "선생님을 선택해 주세요.";
  if (purchaseUsesFlexibleCouponSchedule(product, flow)) {
    return purchaseFlexibleCouponCoachIsReady(product)
      ? "결제 후 시간표에서 원하는 시간을 예약할 수 있습니다."
      : "선택한 담당 코치를 다시 확인해 주세요.";
  }
  const schedules = purchaseSelectedSchedules(product);
  const requiredCount = purchaseRequiredScheduleCount(product);
  if (schedules.length !== requiredCount) return `요일·시간을 ${requiredCount}개 선택해 주세요.`;
  if (!purchaseSchedulesAvailableNow(product)) return "선택한 시간이 바뀌었습니다. 최신 가능한 시간을 다시 선택해 주세요.";
  if (!isPaymentGatewayReady(normalizeSelectedPaymentMethod())) return "토스페이 결제를 준비하고 있습니다. 잠시 후 다시 확인해 주세요.";
  return "선택 내용을 확인한 뒤 결제할 수 있습니다.";
}

function purchaseSlotInsideAnchorWindow(scheduleLessons, product, lessonDate, time, coach, policy) {
  const configuredGap = Object.prototype.hasOwnProperty.call(product, "makeupAnchorMinutes")
    ? product.makeupAnchorMinutes
    : policy.makeupAnchorGapMinutes ?? 40;
  if (configuredGap === null || String(configuredGap).toLowerCase() === "unlimited") return true;
  const gapMinutes = Math.min(100, Math.max(0, Number(configuredGap) || 0));
  const coachRoleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
  const anchors = scheduleLessons.filter((lesson) => {
    if (String(lesson.lessonDate || "") !== String(lessonDate || "")) return false;
    const lessonStatus = String(lesson.serverStatus || lesson.status || "").toLowerCase();
    if (["cancelled", "canceled", "absence", "absent", "makeup_due", "available"].includes(lessonStatus)) return false;
    const lessonCoachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || memberLessonCoach(lesson, policy).id || "");
    return lessonCoachRoleId === coachRoleId;
  });
  if (!anchors.length) return false;
  const slotStart = minutesFromTime(time);
  const slotEnd = slotStart + Math.max(1, numericValue(product.lessonMinutes, 20));
  return anchors.some((lesson) => {
    const anchorStart = minutesFromTime(lesson.time);
    const anchorEnd = anchorStart + lessonDuration(lesson);
    const gapAfterAnchor = slotStart >= anchorEnd ? slotStart - anchorEnd : Number.POSITIVE_INFINITY;
    const gapBeforeAnchor = slotEnd <= anchorStart ? anchorStart - slotEnd : Number.POSITIVE_INFINITY;
    return gapAfterAnchor <= gapMinutes || gapBeforeAnchor <= gapMinutes;
  });
}

let portOneSdkPromise = null;
let preparedPaymentContext = null;
let membershipPurchasePaymentInFlight = false;
let membershipPurchaseEntryInFlight = false;
let bankTransferAccountNumberForCopy = "";
let bankTransferPaymentIdForCancel = "";

const pendingPaymentCancelInFlight = new Set();

let memberScheduleV2WorkspaceCache = null;
let memberScheduleV2RequestSequence = 0;
let memberChangeCandidateRequestSequence = 0;
let memberPurchaseDirectoryCache = null;
let memberPurchaseDirectoryRequestSequence = 0;
let memberPurchaseDirectoryLoad = { key: "", status: "idle", error: "" };
let memberPurchaseDataPromise = null;
let memberPurchaseDataLoaded = false;
let memberHoldingDataPromise = null;

async function ensureMembershipPurchaseData({ force = false } = {}) {
  if (state.dataMode !== "live" || !state.member?.profileId) return true;
  if (memberPurchaseDataLoaded && !force) return true;
  if (memberPurchaseDataPromise) return memberPurchaseDataPromise;
  memberPurchaseDataPromise = Promise.allSettled([
    syncLiveMembershipProductsFromServer(),
    syncMemberPaymentOptionsFromServer(),
    syncMemberDiscountCouponsFromServer(),
    syncMemberEnrollmentFromServer(),
  ]).then((results) => {
    const requiredReady = results[0]?.status === "fulfilled" && results[1]?.status === "fulfilled";
    memberPurchaseDataLoaded = requiredReady;
    renderProducts();
    return requiredReady;
  }).finally(() => {
    memberPurchaseDataPromise = null;
  });
  return memberPurchaseDataPromise;
}

async function ensureMemberHoldingData() {
  if (state.dataMode !== "live" || !state.member?.profileId) return true;
  if (memberHoldingDataPromise) return memberHoldingDataPromise;
  memberHoldingDataPromise = Promise.allSettled([
    syncMemberHoldingPolicyFromServer(),
    syncMemberHoldingRequestsFromServer(),
  ]).then((results) => {
    updateHoldingEvidenceFields();
    renderCurrentTicketPanel();
    return results.every((result) => result.status === "fulfilled");
  }).finally(() => {
    memberHoldingDataPromise = null;
  });
  return memberHoldingDataPromise;
}

function scheduleV2FeedbackWasRevised(record = {}) {
  const finalizedAt = Date.parse(String(record.finalizedAt || record.finalized_at || ""));
  const updatedAt = Date.parse(String(record.updatedAt || record.updated_at || ""));
  return Number.isFinite(finalizedAt) && Number.isFinite(updatedAt) && updatedAt > finalizedAt + 1000;
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
function clearPurchasePaymentError() {
  const flow = purchaseFlowState();
  flow.paymentErrorCode = "";
  flow.paymentErrorMessage = "";
}

function refundHeldLiveTickets() {
  return (state.liveTickets || [])
    .filter((ticket) => Boolean(ticket.refundHoldId))
    .sort((left, right) => String(right.refundHoldAt || right.createdAt || "")
      .localeCompare(String(left.refundHoldAt || left.createdAt || "")));
}

const journalActivityStatuses = [
  { key: "scheduled", label: () => memberStatusLabel("lesson", "scheduled", "예정") },
  { key: "completed", label: () => memberStatusLabel("lesson", "completed", "완료") },
  { key: "absent", label: () => memberStatusLabel("lesson", "absent", "불참") },
  { key: "no_show", label: () => memberStatusLabel("lesson", "no_show", "노쇼") },
  { key: "makeup_booked", label: () => memberStatusLabel("lesson", "makeup_booked", "보강 예약") },
];

let activeAppSheetId = "";
let activeAppModalId = "";
let appModalReturnFocus = null;
let appSheetScrollLock = null;

let memberHelpCategory = "all";
let memberHelpQuery = "";

function bindEvents() {
  bindDelegatedEvents();
  bindAccountEvents();
  bindMakeupEvents();
  bindJournalEvents();
  bindProfileEvents();
  bindScheduleEvents();
  bindHomeEvents();
}

// Keep the first paint and background refresh focused on the screen the member
// can actually see. The remaining screens are rendered when their menu opens.
let memberLiveScheduleRefreshTimer = 0;
let memberLiveScheduleRefreshInFlight = false;
let memberLiveScheduleRefreshQueued = false;
let memberLiveScheduleLastRefreshAt = 0;
let memberConnectivityHideTimer = 0;
let memberScheduleRevisionWatcher = null;
async function initApp() {
  registerPwaServiceWorker();
  window.TennisNoteModeTransition?.warm("../tennis-note-coach-app/index.html?v=1.0.473");
  void refreshMemberRuntimeDiagnostics();
  registerPwaInstallPrompt();
  purgeLegacyDemoStorage();
  captureOnboardingIntent();
  restoreSnapshot();
  initializeJournalNavigationForLaunch();
  renderOnboardingEntryIntro();
  renderPublicProductPreview();
  renderRecentLoginBadge();
  window.TennisNoteModeTransition?.consume("member", { splashSelector: "#brandSplash" });
  bindEvents();
  installOAuthReturnStatusReset();
  void installNativeBackNavigation();
  installMemberConnectivityStatus();
  installMemberLiveScheduleRefresh();
  installMemberScheduleRevisionWatcher();
  renderActiveMemberView();
  const client = window.TennisNoteDataClient;
  void syncPublicMembershipProductsFromServer();
  const hasStoredSession = Boolean(client?.getSession?.()?.access_token);
  const oauthReturnPending = Boolean(
    new URLSearchParams(window.location.search || "").get("code")
    || new URLSearchParams(window.location.search || "").get("error")
    || window.location.hash.includes("access_token=")
  );
  const isModeTransition = Boolean(sessionStorage.getItem("tennis-note-member-mode-transition"));
  sessionStorage.removeItem("tennis-note-member-mode-transition");
  const canOpenRestoredMember = Boolean(hasStoredSession && state.member);
  if (canOpenRestoredMember && !emailPasswordRecoveryPending) {
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
    else if (status && oauthReturnPending) status.textContent = oauthLoginErrorMessage(error);
  }
  setMemberSessionRestoring(false);
  if (emailPasswordRecoveryPending) {
    $("#appScreen").hidden = true;
    $("#loginScreen").hidden = false;
    return;
  }
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
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.473",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-member-runtime-version",
  window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__.version,
);
void initApp();
