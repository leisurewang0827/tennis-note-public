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

const brandSplashStartedAt = performance.now();
// The splash should confirm that the app opened, not hold the member on a
// blank screen while optional network requests finish.
const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;
let appToastTimer = 0;

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

let portOneSdkPromise = null;
let preparedPaymentContext = null;
let bankTransferAccountNumberForCopy = "";
let bankTransferPaymentIdForCancel = "";

const pendingPaymentCancelInFlight = new Set();

let memberScheduleV2WorkspaceCache = null;
let memberScheduleV2RequestSequence = 0;
let memberChangeCandidateRequestSequence = 0;

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
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
  void refreshMemberRuntimeDiagnostics();
  registerPwaInstallPrompt();
  purgeLegacyDemoStorage();
  restoreSnapshot();
  window.TennisNoteModeTransition?.consume("member", { splashSelector: "#brandSplash" });
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
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.374",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-member-runtime-version",
  window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__.version,
);
void initApp();
