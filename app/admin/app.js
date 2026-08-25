const adminQuery = new URLSearchParams(window.location.search);
const adminDemoMode = adminQuery.get("demoAdmin") === "1";
const adminLocalPreviewMode = adminDemoMode && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const adminBrandSplashStartedAt = performance.now();
let adminBrandSplashHideScheduled = false;

const state = {
  view: "dashboard",
  memberFilter: "active",
  memberSearch: "",
  memberCoachFilter: "all",
  memberTicketFilter: "all",
  memberTicketGridFilter: "all",
  scheduleFilter: "all",
  scheduleView: "week",
  scheduleCoachFilter: "all",
  scheduleMemberSearch: "",
  scheduleSearchLastAutoJump: "",
  scheduleAssignmentTicketId: "",
  scheduleAssignmentLessonSource: "regular",
  scheduleAssignmentSearch: "",
  scheduleAssignmentFilter: "all",
  editingBreakRuleId: "",
  billingFilter: "action",
  billingMonth: "",
  managementReportMonth: "",
  billingPage: 0,
  settlementPage: 0,
  rechargePage: 0,
  discountView: "policies",
  discountSearch: "",
  discountStatusFilter: "all",
  membershipSettingsSection: "products",
  membershipProductSearch: "",
  membershipProductStatusFilter: "all",
  membershipProductPage: 0,
  selectedMemberId: null,
  inlineMemberId: null,
  inlineMemberTicketId: "",
  activeMode: "admin",
  editingLessonId: null,
  editingOneDayBookingId: null,
  releasedAbsenceEntitlementId: "",
  pinnedLessonDay: "",
  pinnedLessonTime: "",
  pinnedLessonRepeatSlots: [],
  lessonSourceTouched: false,
  lessonWriteInFlight: false,
  lessonWriteStartedAt: 0,
  lessonOperationKey: "",
  quickLessonEntry: false,
  quickLessonEdit: false,
  releasedSlotQuickEntry: false,
  quickLessonDetailsExpanded: false,
  lessonQuickAction: "schedule",
  quickLessonReturnSlot: null,
  substituteOperationKey: "",
  activeAdminWeekIndex: 0,
  adminTaskPage: 0,
  memberStatusPage: 0,
  memberListPage: 0,
  noticeEditingId: "",
  lessonPolicySearch: "",
  selectedScheduleDay: "",
  settingsTab: "operation",
  recordFilter: "pending",
  recordCoachFilter: "all",
  recordPendingType: "all",
  recordSearch: "",
  recordPage: 0,
  selectedMemberIds: [],
  selectedMembershipProductIds: [],
  activeMembershipProductId: "",
  selectedSubstituteLessonIds: [],
  scheduleBulkMode: false,
  scheduleEditMode: false,
  scheduleOpenSlotMode: false,
  selectedScheduleLessonIds: [],
  selectedScheduleOpenSlots: [],
  scheduleBulkOperationKey: "",
  scheduleBulkAnchorLessonId: "",
  scheduleOpenSlotAnchorKey: "",
  scheduleBulkDrag: null,
  scheduleBulkSuppressClick: false,
  scheduleLessonClipboard: null,
  scheduleSheetPasteOpen: false,
  scheduleSheetPasteRows: [],
  scheduleSheetPasteFilter: "all",
  selectedScheduleSheetPasteRowNumbers: [],
  coachStaffListFilter: "active",
  communityChannel: "홈",
  accountDeletionRequests: [],
  liveScheduleLoaded: false,
  liveScheduleLoading: false,
  liveScheduleMessage: "실서버 시간표 확인 전",
  makeupEntitlements: [],
};

// Keep the last confirmed server schedule locally. A failed or unexpectedly empty
// refresh must never make an already loaded timetable look deleted.
const lessonPolicies = lessonPolicyDefaults.map((policy, index) => normalizeLessonPolicy(policy, index));

const coaches = [
  { id: "coach-no", name: "노 코치", role: "레슨", status: "active", account: "김서준 회원", coachMode: "approved", availability: "split", photoUrl: "" },
  { id: "coach-kang", name: "강 코치", role: "레슨", status: "active", account: "강 코치", coachMode: "approved", availability: "weekday-pm", photoUrl: "" },
  { id: "coach-hwang", name: "황 코치", role: "레슨/보강", status: "active", account: "미연결", coachMode: "pending", availability: "weekday-am", photoUrl: "" },
  { id: "coach-park", name: "박창준 코치", role: "주말 레슨", status: "active", account: "박창준", coachMode: "approved", availability: "weekend", photoUrl: "" },
  { id: "coach-machine", name: "무인", role: "볼머신", status: "inactive", account: "시스템", coachMode: "disabled", availability: "full", photoUrl: "" },
];

const members = [
  {
    id: 1,
    name: "김서준",
    status: "active",
    memberKind: "lesson_member",
    statusLabel: "수강중",
    coach: "노 코치",
    regularTime: "월/수 20:00",
    remaining: 8,
    lessonType: "주 2회 개인 20분",
    source: "고객 관리 DB",
    note: "수요일 결석 예정. 보강 가능 시간 확인 필요",
    photoUrl: "",
  },
  {
    id: 2,
    name: "이하린",
    status: "active",
    memberKind: "lesson_member",
    statusLabel: "수강중",
    coach: "강 코치",
    regularTime: "화/목 19:20",
    remaining: 1,
    lessonType: "주 2회 그룹 20분",
    source: "고객 관리 DB",
    note: "잔여횟수 부족. 연장 결제요청 필요",
    photoUrl: "",
  },
  {
    id: 3,
    name: "박민재",
    status: "active",
    memberKind: "lesson_member",
    statusLabel: "수강중",
    coach: "황 코치",
    regularTime: "토 09:00",
    remaining: 4,
    lessonType: "주 1회 개인 30분",
    source: "수강증",
    note: "백핸드 리듬 단계 진행 중",
    photoUrl: "",
  },
  {
    id: 4,
    name: "최유나",
    status: "expired",
    memberKind: "former_lesson_member",
    statusLabel: "만료회원",
    coach: "강 코치",
    regularTime: "재등록 미정",
    remaining: 0,
    lessonType: "주 1회 개인 20분",
    source: "고객 관리 DB",
    note: "회원권 만료 후 재등록 미정. 상담/대기 관리는 별도 메뉴로 분리 예정",
    photoUrl: "",
  },
  {
    id: 5,
    name: "운동노트 체험회원",
    status: "journal",
    memberKind: "journal_only",
    statusLabel: "운동노트 회원",
    coach: "미배정",
    regularTime: "상담 전",
    remaining: 0,
    lessonType: "회원권 없음",
    source: "소셜 로그인 자동 생성",
    note: "운동 기록만 이용 중이며 회원권을 구매하면 수강 가입서를 받습니다.",
    photoUrl: "",
    authRole: "member",
  },
  {
    id: 6,
    name: "신규 수강 신청",
    status: "pending",
    memberKind: "lesson_pending",
    statusLabel: "가입서·결제대기",
    coach: "미배정",
    regularTime: "희망시간 확인",
    remaining: 0,
    lessonType: "첫 회원권 결제 전",
    source: "앱 수강 가입서",
    note: "가입서 제출 완료. 결제가 끝나면 수강회원으로 자동 전환됩니다.",
    photoUrl: "",
    authRole: "member",
    enrollment: {
      status: "submitted",
      applicant_name: "신규 수강 신청",
      phone: "입력 완료",
      birth_year: "확인 완료",
      experience_level: "beginner",
      lesson_goal: "기본기부터 배우기",
      preferred_schedule: "평일 저녁",
      group_size: 1,
    },
  },
];

const scheduleSettings = {
  openStart: "06:40",
  openEnd: "22:00",
  breakRules: [{ id: "weekday-midday", days: ["월", "화", "수", "목", "금"], start: "13:00", end: "17:00", label: "수업 없음" }],
  breakFavorites: [],
  lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
  lessonColorRules: [],
  coachWorkPolicyVersion: 2,
  memberScheduleRequestOnly: true,
  adminTuningMode: false,
};

const scheduleTimes = [
  ...makeTimeRange(scheduleSettings.openStart, scheduleSettings.openEnd),
];

const lessons = [
  { id: 1, day: "월", time: "18:40", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "개인", durationMinutes: 20, status: "scheduled" },
  { id: 2, day: "월", time: "19:00", courtId: "court-2", coachId: "coach-kang", member: "빈자리", type: "보강 가능", durationMinutes: 20, status: "available" },
  { id: 3, day: "월", time: "19:20", courtId: "court-1", coachId: "coach-hwang", member: "박민재", type: "개인", durationMinutes: 30, status: "confirmed" },
  { id: 4, day: "화", time: "07:00", courtId: "court-1", coachId: "coach-kang", member: "이하린", type: "그룹", durationMinutes: 20, status: "scheduled" },
  { id: 10, day: "화", time: "07:20", courtId: "court-1", coachId: "coach-kang", member: "최유나", type: "개인", durationMinutes: 30, status: "scheduled" },
  { id: 11, day: "화", time: "07:50", courtId: "court-2", coachId: "coach-no", member: "빈자리", type: "보강 가능", durationMinutes: 20, status: "available" },
  { id: 12, day: "화", time: "07:20", courtId: "court-2", coachId: "coach-no", member: "김서준", type: "개인", durationMinutes: 20, status: "scheduled" },
  { id: 5, day: "수", time: "20:00", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "보강 요청", durationMinutes: 20, status: "pending", makeup: true },
  { id: 6, day: "목", time: "19:20", courtId: "court-1", coachId: "coach-kang", member: "이하린", type: "보강", durationMinutes: 30, status: "scheduled", makeup: true },
  { id: 7, day: "금", time: "18:40", courtId: "court-3", coachId: "coach-hwang", member: "보강대기", type: "보강 요청", durationMinutes: 30, status: "pending", makeup: true },
  { id: 8, day: "토", time: "09:00", courtId: "court-1", coachId: "coach-park", member: "박민재", type: "개인", durationMinutes: 30, status: "scheduled" },
  { id: 9, day: "일", time: "08:00", courtId: "court-1", coachId: "coach-machine", member: "빈자리", type: "볼머신", durationMinutes: 20, status: "available" },
];

const adminScheduleWeeks = [
  { label: "7월 1주차", range: "7/1~7/7", note: "현재 등록된 정규 수업과 보강 요청" },
  {
    label: "7월 2주차",
    range: "7/8~7/14",
    note: "다음 주 변경 요청과 코치별 수업 겹침 확인",
    lessons: [
      { id: "admin-week-2-1", day: "월", time: "18:40", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "개인", durationMinutes: 20, status: "scheduled" },
      { id: "admin-week-2-2", day: "월", time: "18:40", courtId: "court-2", coachId: "coach-kang", member: "이하린&최유나", type: "그룹", durationMinutes: 20, status: "scheduled" },
      { id: "admin-week-2-3", day: "화", time: "19:20", courtId: "court-1", coachId: "coach-no", member: "빈자리", type: "보강 가능", durationMinutes: 20, status: "available" },
      { id: "admin-week-2-4", day: "수", time: "20:00", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "수업 변경 요청", durationMinutes: 20, status: "pending", makeup: true },
      { id: "admin-week-2-5", day: "금", time: "18:40", courtId: "court-2", coachId: "coach-hwang", member: "보강대기", type: "보강 요청", durationMinutes: 30, status: "pending", makeup: true },
    ],
  },
  {
    label: "7월 3주차",
    range: "7/15~7/21",
    note: "승인된 변경 수업과 만료 예정 회원 확인",
    lessons: [
      { id: "admin-week-3-1", day: "월", time: "18:40", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "개인", durationMinutes: 20, status: "scheduled" },
      { id: "admin-week-3-2", day: "수", time: "20:00", courtId: "court-1", coachId: "coach-no", member: "김서준", type: "개인", durationMinutes: 20, status: "scheduled" },
      { id: "admin-week-3-3", day: "목", time: "19:40", courtId: "court-2", coachId: "coach-kang", member: "이하린", type: "보강", durationMinutes: 30, status: "scheduled", makeup: true },
      { id: "admin-week-3-4", day: "토", time: "09:00", courtId: "court-1", coachId: "coach-park", member: "박민재", type: "개인", durationMinutes: 30, status: "scheduled" },
      { id: "admin-week-3-5", day: "토", time: "09:00", courtId: "court-2", coachId: "coach-no", member: "윤서준", type: "개인", durationMinutes: 20, status: "scheduled" },
    ],
  },
];

refreshAdminScheduleWeekLabels();

const makeupRequests = [
  {
    id: 1,
    member: "김서준",
    original: "수 20:00 노 코치",
    requested: "월 19:00 강 코치",
    policy: "기준시간 이상",
    status: "requested",
    statusLabel: "승인대기",
  },
  {
    id: 2,
    member: "이하린",
    original: "목 19:20 강 코치",
    requested: "금 18:40 황 코치",
    policy: "기준시간 미만",
    status: "coach_required",
    statusLabel: "코치승인필요",
  },
];

const tickets = [
  { id: "ticket-seojun-no", member: "김서준", coachId: "coach-no", product: "노 코치 주 2회 개인 20분", weeklyCount: 2, total: 10, used: 2, remaining: 8, expires: "2026-07-18" },
  { id: "ticket-seojun-no-pair-a", member: "김서준&이하린", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 3, remaining: 5, expires: "2026-07-25", lessonKind: "2대1" },
  { id: "ticket-seojun-no-pair-b", member: "김서준&최유나", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 1, remaining: 7, expires: "2026-08-01", lessonKind: "2대1" },
  { id: "ticket-harin-kang", member: "이하린&최유나", coachId: "coach-kang", product: "강 코치 주 2회 그룹 20분", weeklyCount: 2, total: 8, used: 7, remaining: 1, expires: "2026-07-04", lessonKind: "그룹" },
  { id: "ticket-minjae-hwang", member: "박민재", coachId: "coach-park", product: "박창준 코치 주 1회 개인 30분", weeklyCount: 1, total: 4, used: 0, remaining: 4, expires: "2026-07-22" },
];

const expiredTickets = [
  { member: "김서준", product: "노 코치 주 2회 개인 20분", weeklyCount: 2, total: 8, used: 8, remaining: 0, purchased: "2026-06-01", expires: "2026-06-30", statusLabel: "만료" },
  { member: "이하린&최유나", product: "강 코치 주 2회 그룹 20분", weeklyCount: 2, total: 8, used: 8, remaining: 0, purchased: "2026-06-03", expires: "2026-07-01", statusLabel: "만료" },
  { member: "박민재", product: "박창준 코치 주 1회 개인 30분", weeklyCount: 1, total: 4, used: 4, remaining: 0, purchased: "2026-05-25", expires: "2026-06-24", statusLabel: "만료" },
  { member: "김서준", product: "노 코치 주 1회 개인 20분", weeklyCount: 1, total: 4, used: 4, remaining: 0, purchased: "2026-05-01", expires: "2026-05-31", statusLabel: "만료" },
  { member: "최유나", product: "강 코치 주 1회 개인 20분", weeklyCount: 1, total: 4, used: 4, remaining: 0, purchased: "2026-05-10", expires: "2026-06-09", statusLabel: "만료" },
];

const billings = [
  { member: "이하린", item: "7월 수업 연장", amount: 180000, method: "결제요청", status: "draft", statusLabel: "작성중" },
  { member: "김서준", item: "주 2회 개인 20분", amount: 325000, method: "카드", status: "paid", statusLabel: "결제완료" },
  { member: "박민재", item: "주 1회 개인 30분", amount: 198000, method: "현금입금", status: "check", statusLabel: "확인필요" },
];

const billingLogs = [
  "결제 요청/확인/충전은 관리자 확인 후 처리하는 프로토타입입니다.",
];

const groupAccounts = [
  {
    id: "group-account-demo-1",
    name: "최유나 · 이하린",
    coachId: "coach-kang",
    schedule: "월 19:00",
    paymentMode: "representative",
    nextPayer: "최유나",
    scheduleSyncRequired: true,
    members: [
      { name: "최유나", appStatus: "linked", canManageSchedule: true, canPay: true },
      { name: "이하린", appStatus: "not_joined", canManageSchedule: false, canPay: false },
    ],
  },
];

const serverPaymentSyncState = {
  loading: false,
  loaded: false,
  directLoaded: false,
  lastLoadedAt: 0,
  message: "서버 결제 기록을 아직 불러오지 않았습니다.",
  tone: "neutral",
};
const paymentCancelInFlight = new Set();

const paymentCancelFlowState = {
  itemIndex: -1,
  submitting: false,
  idempotencyKey: "",
  message: "",
  tone: "neutral",
};

const refundFlowState = {
  paymentId: "",
  itemSnapshot: null,
  preview: null,
  loading: false,
  submitting: false,
  reconcileRequired: false,
  manualTransferPending: false,
  manualPreviewChanged: false,
  previewNeedsConfirmation: false,
  idempotencyKey: "",
  message: "",
  tone: "neutral",
};

const membershipProductDefaults = [
  {
    id: "fixed-20-w1",
    group: "고정 수업권",
    name: "평일 개인 20분 주1회 4회",
    title: "평일 개인 20분 주1회 4회",
    detail: "20분 레슨 + 20분 개인연습 · 주1회 고정시간",
    format: "20분 레슨 + 20분 볼머신",
    sessions: "4회",
    rule: "코치 1명 기준 사용, 결제 전까지 기존 시간 보호",
    listAmount: 165000,
    amount: 150000,
    settlementBase: 150000,
    tickets: 4,
    cardAmount: 165000,
    cashAmount: 150000,
    validityDays: 35,
    graceDays: 14,
    productKind: "regular",
    discountEnabled: true,
    coachDiscountAllowed: false,
    coach: "선택한 시간에 가능한 코치",
    flow: "신규: 시간 선택 → 20분 주1회권 선택 → 가능 코치 확정",
    mode: "fixed",
    discount: "카드가/현금가 분리 · 정산은 현금가 기준",
    badge: "주1회",
    status: "sale",
  },
  {
    id: "fixed-30-w1",
    group: "고정 수업권",
    name: "평일 개인 30분 주1회 4회",
    title: "평일 개인 30분 주1회 4회",
    detail: "30분 레슨 + 30분 개인연습 · 주1회 고정시간",
    format: "30분 레슨 + 30분 볼머신",
    sessions: "4회",
    rule: "코치 1명 기준 사용, 결제 전까지 기존 시간 보호",
    listAmount: 198000,
    amount: 180000,
    settlementBase: 180000,
    tickets: 4,
    cardAmount: 198000,
    cashAmount: 180000,
    validityDays: 35,
    graceDays: 14,
    productKind: "regular",
    discountEnabled: true,
    coachDiscountAllowed: false,
    coach: "선택한 시간에 가능한 코치",
    flow: "신규: 시간 선택 → 30분 주1회권 선택 → 가능 코치 확정",
    mode: "fixed",
    discount: "카드가/현금가 분리 · 정산은 현금가 기준",
    badge: "주1회",
    status: "sale",
  },
  {
    id: "fixed-20",
    group: "고정 수업권",
    name: "평일 개인 20분 주2회 10회",
    title: "평일 개인 20분 주2회 10회",
    detail: "20분 레슨 + 20분 개인연습 · 주2회 고정시간",
    format: "20분 레슨 + 20분 볼머신",
    sessions: "10회",
    rule: "코치 1명 기준 사용, 40분은 20분권 2회 연속 사용",
    listAmount: 358000,
    amount: 325000,
    settlementBase: 325000,
    tickets: 10,
    cardAmount: 358000,
    cashAmount: 325000,
    validityDays: 30,
    graceDays: 14,
    productKind: "regular",
    discountEnabled: true,
    coachDiscountAllowed: false,
    coach: "선택한 시간에 가능한 코치",
    flow: "신규: 시간 선택 → 20분 주2회권 선택 → 가능 코치 확정",
    mode: "fixed",
    discount: "카드가/현금가 분리 · 정산은 현금가 기준",
    badge: "주2회",
    status: "sale",
  },
  {
    id: "fixed-30",
    group: "고정 수업권",
    name: "평일 개인 30분 주2회 10회",
    title: "평일 개인 30분 주2회 10회",
    detail: "30분 레슨 + 30분 개인연습 · 주2회 고정시간",
    format: "30분 레슨 + 30분 볼머신",
    sessions: "10회",
    rule: "코치 1명 기준 사용, 60분은 30분권 2회 연속 사용",
    listAmount: 427000,
    amount: 388000,
    settlementBase: 388000,
    tickets: 10,
    cardAmount: 427000,
    cashAmount: 388000,
    validityDays: 30,
    graceDays: 14,
    productKind: "regular",
    discountEnabled: true,
    coachDiscountAllowed: false,
    coach: "선택한 시간에 가능한 코치",
    flow: "신규: 시간 선택 → 30분 주2회권 선택 → 가능 코치 확정",
    mode: "fixed",
    discount: "카드가/현금가 분리 · 정산은 현금가 기준",
    badge: "주2회",
    status: "sale",
  },
  {
    id: "coupon-20",
    group: "쿠폰제",
    name: "20분 쿠폰제",
    title: "20분 쿠폰제",
    detail: "고정시간 없이 가능한 시간마다 예약 · 선택 코치 전용",
    format: "자유 예약",
    sessions: "4회",
    rule: "회원이 가능한 시간에서 선택, 코치 근무 가능 시간과 충돌 검사",
    listAmount: 200000,
    amount: 180000,
    settlementBase: 180000,
    tickets: 4,
    cardAmount: 200000,
    cashAmount: 180000,
    validityDays: 60,
    graceDays: 7,
    productKind: "pass",
    discountEnabled: true,
    coachDiscountAllowed: true,
    coach: "선택 코치 전용",
    flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감",
    mode: "pass",
    discount: "코치 할인권 사용 가능",
    badge: "유동 예약",
    status: "sale",
  },
  {
    id: "coupon-30",
    group: "쿠폰제",
    name: "30분 쿠폰제",
    title: "30분 쿠폰제",
    detail: "매번 원하는 시간에 예약하는 쿠폰제 · 선택 코치 전용",
    format: "자유 예약",
    sessions: "4회",
    rule: "회원이 가능한 시간에서 선택, 코치 근무 가능 시간과 충돌 검사",
    listAmount: 220000,
    amount: 198000,
    settlementBase: 198000,
    tickets: 4,
    cardAmount: 220000,
    cashAmount: 198000,
    validityDays: 60,
    graceDays: 7,
    productKind: "pass",
    discountEnabled: true,
    coachDiscountAllowed: true,
    coach: "선택 코치 전용",
    flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감",
    mode: "pass",
    discount: "이벤트 할인 가능",
    badge: "유동 예약",
    status: "sale",
  },
  {
    id: "group-20",
    group: "그룹 수업권",
    name: "2대1 20분 그룹권",
    title: "2대1 20분 그룹권",
    detail: "동반 회원 2명이 같은 시간에 함께 쓰는 그룹 수업권",
    format: "동반 회원",
    sessions: "8회",
    rule: "회원권 참여자에 2명을 묶고 시간표에는 이름을 위아래로 표시",
    listAmount: 198000,
    amount: 180000,
    settlementBase: 180000,
    tickets: 8,
    cardAmount: 198000,
    cashAmount: 180000,
    validityDays: 60,
    graceDays: 7,
    productKind: "group",
    discountEnabled: true,
    coachDiscountAllowed: false,
    coach: "선택 코치 전용",
    flow: "그룹: 대표 회원 선택 → 동반 회원 연결 → 같은 시간 확정",
    mode: "group",
    discount: "파트너 변경은 관리자 확인 필요",
    badge: "2대1",
    status: "sale",
  },
];

membershipProductDefaults
  .filter((product) => ["coupon-20", "coupon-30"].includes(product.id))
  .forEach((product) => {
    product.status = "hidden";
    product.rule = "기존 4회 쿠폰은 신규 판매에서 제외합니다.";
  });

const legacyGroupMembershipProduct = membershipProductDefaults.find((product) => product.id === "group-20");
if (legacyGroupMembershipProduct) {
  legacyGroupMembershipProduct.status = "hidden";
  legacyGroupMembershipProduct.rule = "기존 8회 그룹권은 과거 이용 내역에서만 유지합니다.";
}

membershipProductDefaults.push(
  ...[20, 30].flatMap((lessonMinutes) => [1, 2].flatMap((groupSize) => [5, 10].map((sessions) =>
    couponPolicyTemplate({
      id: `coupon-${lessonMinutes}-${groupSize}to1-${sessions}`,
      lessonMinutes,
      groupSize,
      sessions,
    })))),
);

const finalizedMembershipProducts = window.TennisNoteProductCatalog?.createCatalog?.() || [];
if (finalizedMembershipProducts.length) {
  membershipProductDefaults.splice(0, membershipProductDefaults.length, ...finalizedMembershipProducts);
}

const membershipProductDrafts = membershipProductDefaults.map((product) => ({ ...product }));
const deletedMembershipProductIds = [];

const discountPolicies = discountPolicyDefaults.map((policy) => ({ ...policy, issued: 0, used: 0 }));
const discountIssueLogs = [
  { id: "discount-log-1", text: "신규 10% 할인권 샘플 준비", at: "2026-07-10" },
];

const policyVersions = policyVersionDefaults.map((policy) => normalizePolicyVersion(policy));

const refundPolicySettings = {
  penaltyRate: 10,
  calculationBasis: "undiscounted_original_price",
  contractBasis: "sessions",
  reservationFee: 30000,
  reservationFeeFirstMonthOnly: true,
  usedSessionBasis: "undiscounted_per_session",
  consumerDisputeFallbackAdminOnly: true,
  memo: "회원 사유 환불은 실납부액에서 할인 전 원가의 10%, 사용 회차의 할인 전 금액, 첫 수업 월 예약금 3만원을 차감합니다.",
};

const holdingPolicySettings = {
  personalMaxDays: 7,
  fourWeekPersonalMaxDays: 7,
  threeMonthPersonalMaxDays: 14,
  couponPersonalMaxDays: 0,
  injuryMaxDays: 30,
  emergencyRetroactiveDays: 3,
  evidenceRequired: true,
  evidenceRetentionDays: 30,
};

const notificationPolicySettings = { ...notificationPolicyDefaults };
const notificationDeliveryState = {
  status: "idle",
  queued: 0,
  processing: 0,
  sentToday: 0,
  failed: 0,
  noDevice: 0,
  activeDevices: null,
  activeAndroidDevices: null,
  activeIosDevices: null,
  recent: [],
  checkedAt: "",
  message: "서버 현황 확인 전",
};

const adminImportAuthState = {
  loading: false,
  loaded: false,
  user: null,
  profile: null,
  message: "관리자 로그인 상태 확인 전입니다.",
};

const adminDriveReportState = {
  loading: false,
  loaded: false,
  status: "idle",
  period: "",
  branchId: "",
  snapshot: null,
  message: "Drive 연결 전",
};
let adminDriveReportRequestSerial = 0;

const coachOperationsViews = new Set(["members", "schedule", "notes", "issues"]);
let adminAuthLastVerifiedAt = 0;
let adminConnectionRecoveryPromise = null;

const adminPendingUsersState = {
  loading: false,
  loaded: false,
  items: [],
  message: "관리자 로그인 후 신규 가입자를 확인합니다.",
};

const adminLiveDataState = {
  branches: [],
  lessons: [],
  users: [],
  coachRoles: [],
  authLinks: [],
  authSwitches: [],
  coachSettlementTerms: [],
  tickets: [],
  settlementTickets: [],
  products: [],
  participantRows: [],
  participantRecords: [],
  lessonRecords: [],
  makeupEntitlements: [],
  curriculumRefs: [],
  journalEntries: [],
  mediaFiles: [],
  groupAccounts: [],
  groupMembers: [],
  groupTicketLinks: [],
  memberDatabaseRecords: [],
  memberMembershipRecords: [],
  regularScheduleRules: [],
  substituteAssignments: [],
};

let adminOperationalCacheWriteHandle = 0;
let adminOperationalCacheWriteQueued = false;

const adminLazyDataState = new Map();
const memberSearchIndex = new Map();
const memberTicketsIndex = new Map();
const ticketParticipantNamesIndex = new Map();
const adminMemberDirectoryState = {
  loading: false,
  loaded: false,
  error: "",
  signature: "",
  rows: [],
  total: 0,
  counts: null,
  preserveCountsWhileLoading: false,
  requestId: 0,
};
const adminMemberDetailCache = new Map();
let adminUserNameIndex = null;
let memberSearchRenderTimer = 0;
let adminLiveSyncPromise = null;
let adminInitialLiveSyncHandle = 0;
let adminInitialLiveSyncKind = "";

const lessonRecordEditorState = {
  lessonId: "",
  journalId: "",
  saving: false,
};

const coachSettlementRules = [
  { coach: "노 코치", method: "ratio", ratio: 0.5, hourly: 0, cardBase: "cash", calculationMode: "session_progress", substitute: "actualCoach" },
  { coach: "강 코치", method: "ratio", ratio: 0.6, hourly: 0, cardBase: "cash", calculationMode: "session_progress", substitute: "actualCoach" },
  { coach: "황 코치", method: "hourly", ratio: 0, hourly: 35000, cardBase: "cash", substitute: "actualCoach" },
  { coach: "박창준 코치", method: "hourly", ratio: 0, hourly: 40000, cardBase: "cash", substitute: "actualCoach" },
];

const newCoachSettlementSettings = {
  regularRatio: 50,
  weekendHourly: 35000,
  substituteHourly: 35000,
  cardBase: "cash",
  substitute: "actualCoach",
  confirmation: "completedWithComment",
};

const communityPosts = [
  {
    channel: "레슨후기",
    type: "노트",
    title: "포핸드 타점이 늦을 때 코치님 피드백 모음",
    body: "오늘 수업노트에서 많이 나온 내용을 익명 피드로 묶어 보여주는 화면 예시입니다.",
    likes: 12,
    comments: 5,
  },
  {
    channel: "보강매칭",
    type: "매칭",
    title: "오늘 19:00 빈자리 보강 가능",
    body: "빈 시간대를 빠르게 확인하고, 조건이 맞는 회원에게 노출합니다.",
    likes: 7,
    comments: 3,
  },
  {
    channel: "동호회",
    type: "투표",
    title: "이번 주 토요 모임 복식 파트너 선호",
    body: "Blind의 투표글 느낌을 참고해서 동호회 운영자가 빠르게 의견을 받을 수 있습니다.",
    likes: 18,
    comments: 11,
  },
];

const lessonNotes = [
  {
    id: 1,
    member: "박민재",
    lesson: "토 09:00 백핸드 리듬",
    reflection: "타점이 늦어져서 준비 동작을 더 빨리 하고 싶음",
    next: "백핸드 준비 자세와 리듬 반복",
    status: "pending",
    statusLabel: "코치확인대기",
  },
  {
    id: 2,
    member: "김서준",
    lesson: "월 18:40 포핸드 연결",
    reflection: "짧은 공 처리에서 손목이 흔들림",
    next: "전진 스텝과 라켓면 고정",
    status: "confirmed",
    statusLabel: "확인완료",
  },
];

const operationProfiles = [];
let activeOperationProfileId = "";
const activeOperationProfileIdsByBranch = {};
let liveSchedulePolicyServerUpdatedAt = "";
const memberManagementPolicy = { ...defaultMemberManagementPolicy };
let memberAdminEditEnabled = false;
let memberAdminEditExpiresAt = 0;
let memberInlineRowFilter = "all";
const memberManagementModalState = {
  memberId: null,
  action: "",
  ticketId: "",
  createStep: 1,
  message: "",
  linkCandidates: [],
  linkCandidatesLoading: false,
  linkCandidatesLoadedFor: "",
  linkQuery: "",
  forceDeletePreview: null,
  forceDeletePreviewLoading: false,
  forceDeletePreviewError: "",
  closePreview: null,
  closePreviewLoading: false,
  closePreviewError: "",
};
let adminLayoutSettings = (() => {
  try {
    return normalizeAdminLayoutSettings(JSON.parse(localStorage.getItem(adminLayoutLocalKey) || "{}"));
  } catch {
    return defaultAdminLayoutSettings();
  }
})();
let adminLayoutServerUpdatedAt = "";
let adminLayoutSaveState = "local";
let adminMoreMenuOpen = false;
const legacyDefaultAdminPinHashes = new Set([
  "sha256:978bb3994627910cf4f1e9625928d86e9e0528bd13fba23620399a4ae7098249",
  "fnv1a:526e18f3",
]);
const adminLockSettings = { ...defaultAdminLockSettings, lockedViews: [...defaultAdminLockSettings.lockedViews] };
let adminSecurityDraft = null;
let adminSecurityModeOverride = "";
let adminSecuritySaveState = { status: "idle", savedAt: "" };
let noticeImageDraftFile = null;
let noticeImageDraftUrl = "";
let noticeImageRemoveRequested = false;
const supportedImportWorkbookVersions = new Set(["2.0", importWorkbookVersion]);
const dataImportState = {
  schemaVersion: "",
  fileName: "",
  fileType: "",
  status: "idle",
  message: "아직 선택된 파일이 없습니다.",
  columns: [],
  rowCount: 0,
  readyRows: 0,
  reviewRows: 0,
  errorRows: 0,
  issues: [],
  rawRows: [],
  workbookPayload: null,
  memberRowCount: 0,
  scheduleRowCount: 0,
  serverStatus: "idle",
  serverMessage: "",
  serverPreview: null,
};

let adminSnapshotSaveHandle = 0;
let adminSnapshotSaveQueued = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function popupNoticeDisplayState(notice = {}, todayKey = adminLocalDateKey()) {
  const status = String(notice.status || "disabled").toLowerCase();
  const startsOn = String(notice.startDate || notice.startsOn || "").slice(0, 10);
  const endsOn = String(notice.endDate || notice.endsOn || "").slice(0, 10);
  const today = String(todayKey || adminLocalDateKey()).slice(0, 10);
  if (status === "archived") return { key: "archived", label: "보관됨", tone: "neutral", visible: false };
  if (status !== "active") return { key: "disabled", label: "꺼짐", tone: "neutral", visible: false };
  if (startsOn && startsOn > today) return { key: "scheduled", label: "노출 예정", tone: "neutral", visible: false };
  if (endsOn && endsOn < today) return { key: "ended", label: "기간 종료", tone: "neutral", visible: false };
  return { key: "visible", label: "현재 노출", tone: "ready", visible: true };
}

const authUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let branchPaymentAccount = null;
let branchPaymentAccountStatus = "idle";
const branchSalesSettingsState = {
  status: "idle",
  branchId: "",
  version: 0,
  appliedAt: "",
  appliedConfig: defaultBranchSalesConfig(),
  draftConfig: defaultBranchSalesConfig(),
  message: "",
};

let adminViewRenderRevision = 0;
const adminViewRenderCache = new Map();

const memberPaymentRecordStates = new Set(["unentered", "complete", "transfer_zero", "incomplete"]);

function memberTicketLinkedPayment(ticket = null) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  if (!ticketId) return null;
  return (adminLiveDataState.payments || [])
    .filter((payment) => String(payment.ticket_id || payment.ticketId || "") === ticketId)
    .sort((left, right) => {
      const statusScore = (payment) => payment.status === "verified" ? 2 : payment.status === "pending" ? 1 : 0;
      const scoreDelta = statusScore(right) - statusScore(left);
      if (scoreDelta) return scoreDelta;
      return String(right.verified_at || right.paid_at || right.created_at || "")
        .localeCompare(String(left.verified_at || left.paid_at || left.created_at || ""));
    })[0] || null;
}

function memberTicketPaymentProjection(member = null, ticket = null) {
  const payment = memberTicketLinkedPayment(ticket);
  if (payment) {
    return {
      payment,
      protected: payment.status === "verified",
      payment_record_state: payment.status === "verified" ? "complete" : "incomplete",
      payment_recorded_on: String(payment.paid_at || payment.verified_at || payment.created_at || "").slice(0, 10),
      payment_method: payment.method || payment.provider || "",
      payment_amount: Number(payment.final_amount ?? payment.amount ?? 0),
    };
  }
  const record = memberDatabaseRecord(member, ticket);
  return record ? { ...record, payment: null, protected: false } : null;
}

function memberPaymentInitialSnapshot(projection = null) {
  return encodeURIComponent(JSON.stringify({
    state: memberPaymentRecordState(projection),
    date: String(projection?.payment_recorded_on || ""),
    method: normalizeMemberPaymentMethod(projection?.payment_method || ""),
    amount: Number(projection?.payment_amount || 0),
  }));
}

function memberInlinePaymentChanged(form) {
  const encoded = String(form?.dataset?.initialPayment || "");
  if (!encoded) return true;
  let initial = null;
  try {
    initial = JSON.parse(decodeURIComponent(encoded));
  } catch {
    return true;
  }
  const current = {
    state: String(form.elements.paymentRecordState?.value || memberPaymentRecordState({
      payment_recorded_on: form.elements.paymentDate?.value || "",
      payment_method: form.elements.paymentMethod?.value || "",
      payment_amount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
    })),
    date: String(form.elements.paymentDate?.value || ""),
    method: normalizeMemberPaymentMethod(form.elements.paymentMethod?.value || ""),
    amount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
  };
  return initial.state !== current.state
    || initial.date !== current.date
    || initial.method !== current.method
    || Number(initial.amount || 0) !== Number(current.amount || 0);
}

const accountDeletionExecutionInFlight = new Set();
let accountDeletionRetryTimer = 0;

async function refreshMemberAuthManagement(member) {
  const client = window.TennisNoteDataClient;
  const userIds = memberServerUserIds(member);
  if (!member?.serverUserId || !userIds.length || !client?.selectRows || operationsRole() !== "admin") return false;
  try {
    const [links, switches] = await Promise.all([
      client.selectRows("tn_user_auth_links", {
        select: "id,user_id,provider,last_sign_in_at,is_primary",
        filters: { user_id: { in: userIds } },
        order: "is_primary.desc,linked_at.desc",
        limit: 20,
      }),
      client.selectRows("tn_auth_provider_switches", {
        select: "id,user_id,from_provider,to_provider,status,expires_at,created_at,completed_at",
        filters: { user_id: { in: userIds } },
        order: "created_at.desc",
        limit: 20,
      }),
    ]);
    member.authLinks = Array.isArray(links) ? links : [];
    member.authProviders = authProvidersFromLinks(member.authLinks);
    member.authSwitch = (Array.isArray(switches) ? switches : [])
      .find((request) => pendingAuthSwitch({ authSwitch: request })) || null;
    member.authLinked = Boolean(member.authLinked || member.authLinks.length);
    member.authLastSignInAt = member.authLinks
      .map((link) => link.last_sign_in_at)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
    member.authManagementLoadFailed = false;
    return true;
  } catch (error) {
    console.warn("[Tennis Note] member auth management unavailable", error);
    member.authManagementLoadFailed = true;
    return false;
  }
}

function memberManagementTicketPeriodReview(product, startsOn = "", expiresOn = "") {
  const expectedDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const start = new Date(`${memberManagementDate(startsOn)}T00:00:00`);
  const end = new Date(`${memberManagementDate(expiresOn)}T00:00:00`);
  const actualDays = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start
    ? 0
    : Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return {
    expectedDays,
    actualDays,
    isShorter: Boolean(actualDays && actualDays < expectedDays),
  };
}

window.addEventListener("beforeunload", (event) => {
  if (!dirtyMemberInlineForms().length) return;
  event.preventDefault();
  event.returnValue = "";
});

window.setInterval(() => {
  if (memberAdminEditEnabled && Date.now() >= memberAdminEditExpiresAt) {
    if (dirtyMemberInlineForms().length) {
      memberAdminEditExpiresAt = Date.now() + 2 * 60 * 1000;
      showToast("미저장 변경사항이 있어 자동 잠금을 2분 연장했습니다. 저장하거나 편집을 종료해 주세요.");
      return;
    }
    setMemberAdminEditEnabled(false);
    showToast("15분 동안 사용하지 않아 회원표 편집을 잠갔습니다.");
  }
}, 30000);

function memberTicketPaymentGrid(member, ticket) {
  const projection = ticket ? memberTicketPaymentProjection(member, ticket) : null;
  const stateValue = memberPaymentRecordState(projection);
  if (!projection || stateValue === "unentered") {
    return { state: stateValue, date: "-", method: "미입력", amount: "-" };
  }
  return {
    state: stateValue,
    date: projection.payment_recorded_on ? memberDetailDateLabel(projection.payment_recorded_on) : "미입력",
    method: stateValue === "transfer_zero" ? "양도" : paymentMethodLabel(projection.payment_method || ""),
    amount: `${money.format(Number(projection.payment_amount || 0))}원`,
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
  if (payment.state === "incomplete") reasons.push("결제 확인 필요");
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

function adminLessonChangePolicyText(request = {}) {
  const snapshot = request.policySnapshot || request.policy_snapshot || null;
  const hours = Math.min(168, Math.max(1, Number(snapshot?.cutoffHours) || 24));
  if (snapshot?.isGroup) return "그룹 전체 · 담당 코치 승인";
  if (snapshot?.outcome === "auto" || request.policy_window === "auto_before_24h") return `${hours}시간 이상 · 바로 변경`;
  return `${hours}시간 미만 · 담당 코치 승인`;
}

function adminLessonChangeRequestedAt(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "신청 시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function adminLessonChangeRemaining(originalDate = "", originalTime = "") {
  const date = new Date(`${originalDate}T${String(originalTime || "").slice(0, 5)}:00+09:00`);
  if (Number.isNaN(date.getTime())) return "남은 시간 확인 필요";
  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "원래 수업 시작 시각 경과";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}시간 ${minutes}분 남음` : `${Math.max(1, minutes)}분 남음`;
}

function oneDayBookingForBilling(billing = {}) {
  const bookingId = String(billing.oneDayBookingId || "");
  if (!bookingId) return null;
  return lessons.find((lesson) => (
    lesson.oneDayBooking
    && String(lesson.serverOneDayBookingId || "") === bookingId
  )) || null;
}

function isManualCashRefundItem(item = {}) {
  return ["bank_transfer", "cash", "account_transfer", "transfer"].includes(String(item.method || "").trim().toLowerCase());
}

function paymentOwnerHasHistoricalRecord(item = {}) {
  const userId = String(item.serverUserId || "");
  if (!userId) return false;
  return (adminLiveDataState.memberDatabaseRecords || []).some((record) => (
    String(record.user_id || record.userId || "") === userId
    && String(record.record_status || record.recordStatus || "").toLowerCase() === "historical"
    && !String(record.current_ticket_id || record.currentTicketId || "")
  ));
}

function paymentRequiresTicketRepair(item = {}) {
  return item.status === "paid"
    && !item.ticketId
    && !item.oneDayBookingId
    && !isHistoricalImportedPayment(item);
}

function refundFlowPaymentItem() {
  const paymentId = String(refundFlowState.paymentId || "");
  if (!paymentId) return refundFlowState.itemSnapshot || null;
  return billings.find((item) => String(item.providerPaymentId || "") === paymentId)
    || refundFlowState.itemSnapshot
    || null;
}

function applyRefundPreviewChange(code, preview) {
  if (!preview || !["refund_preview_changed", "ticket_usage_changed"].includes(code)) return false;
  refundFlowState.preview = preview;
  refundFlowState.previewNeedsConfirmation = true;
  refundFlowState.idempotencyKey = newRefundIdempotencyKey();
  refundFlowState.message = `최신 계산값 ${money.format(numericValue(preview.refundAmount))}원으로 바뀌었습니다. 대상과 금액을 확인한 뒤 다시 접수하세요.`;
  refundFlowState.tone = "danger";
  return true;
}

async function cancelManualRefundRequestFromModal() {
  const item = refundFlowPaymentItem();
  if (!item || !refundFlowState.manualTransferPending || refundFlowState.submitting) return;
  const pin = $("#refundAdminPin")?.value.trim() || "";
  if (adminPinNeedsSetup() || !(await verifyAdminPin(pin))) {
    refundFlowState.message = adminPinNeedsSetup()
      ? "먼저 설정의 보안/잠금에서 관리자 PIN을 설정해 주세요."
      : "관리자 PIN이 맞지 않습니다.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return;
  }
  refundFlowState.submitting = true;
  refundFlowState.message = "실제 송금 전 환불 접수를 취소하고 있습니다.";
  refundFlowState.tone = "neutral";
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-manual-cancel", {
      body: { paymentId: refundFlowState.paymentId, confirmation: "접수취소" },
    });
    if (result?.ok) {
      billingLogs.unshift(`${item.member} 현금 환불 접수 취소 · 결제와 이용권 유지`);
      closeRefundModal();
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast("환불 접수 취소됨 · 결제와 이용권은 유지됩니다");
      return;
    }
    refundFlowState.message = refundErrorText(result?.code);
    refundFlowState.tone = "danger";
  } catch (error) {
    refundFlowState.message = refundErrorText(error?.payload?.code || "manual_refund_cancel_failed");
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.submitting = false;
    renderRefundModal();
  }
}

function lessonParticipantTargets(lesson, context) {
  const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
    ? lesson.serverParticipantUserIds.map(String).filter(Boolean)
    : [];
  if (!participantUserIds.length) return [];
  return participantUserIds.map((userId) => ({
    userId,
    name: context?.userNameById.get(userId) || lesson.member || "회원 확인 필요",
  }));
}

function completedLessonRecordIssues(context) {
  const legacyLessonIds = new Set((adminLiveDataState.lessonRecords || []).map((record) => String(record.lesson_id || "")));
  const participantRecordsByLessonId = context?.participantRecordsByLessonId || new Map();
  const ownRoleIds = currentOperationsCoachRoleIds();
  return lessons
    .filter((lesson) => (
      lesson.serverLessonId
      && !lesson.oneDayBooking
      && ["completed", "no_show"].includes(String(lesson.serverStatus || ""))
      && !legacyLessonIds.has(String(lesson.serverLessonId))
      && (operationsRole() === "admin" || ownRoleIds.has(lesson.coachRoleId))
    ))
    .flatMap((lesson) => {
      const lessonRecords = participantRecordsByLessonId.get(String(lesson.serverLessonId)) || [];
      const targets = lessonParticipantTargets(lesson, context);
      const missingTargets = targets.length
        ? targets.filter((target) => !lessonRecords.some((record) => String(record.user_id || "") === target.userId))
        : lessonRecords.length ? [] : [{ userId: "", name: lesson.member || "회원 확인 필요" }];
      return missingTargets.map((target) => ({
        id: `completed-record-missing-${lesson.serverLessonId}-${target.userId || "all"}`,
        group: "issue",
        source: "수업 기록 오류",
        branchId: lesson.branchId || "",
        member: target.name,
        title: `${lesson.lessonDate || "수업일"} ${lesson.time || ""} · ${getCoachName(lesson.coachId)}`.trim(),
        detail: `${lesson.type || "수업"} ${lesson.durationMinutes || 20}분 · 수업 상태 ${lesson.serverStatus === "no_show" ? "노쇼" : "완료"}`,
        subDetail: "해당 참여자의 최종 수업 기록이 없습니다. 수업 상세에서 기록 상태를 확인해 주세요.",
        statusLabel: "완료 기록 누락",
        actionLabel: "기록 확인",
        lessonId: lesson.serverLessonId,
        serverLessonId: lesson.serverLessonId,
        coachId: lesson.coachId || "",
        coachRoleId: lesson.coachRoleId || "",
        actionable: true,
        priority: "urgent",
        urgentReason: "수업 완료 상태와 참여자 최종 기록이 일치하지 않습니다.",
        sortAt: `${lesson.lessonDate || ""}T${lesson.time || "00:00"}:00`,
      }));
    });
}

let xlsxLibraryPromise = null;

function notificationDeliveryStatusLabel(row = {}) {
  const status = String(row.status || "queued").toLowerCase();
  const lastError = String(row.last_error || row.lastError || "");
  if (lastError.startsWith("no_active_push_device")) return "기기 없음";
  if (status === "sent" && lastError) return "일부 기기 오류";
  if (status === "sent") return "발송 성공";
  if (["queued", "processing"].includes(status) && lastError) return "재시도 예정";
  if (["queued", "processing"].includes(status)) return "발송 예정";
  if (status === "failed") return "실제 오류";
  if (status === "cancelled") return "발송 취소";
  return "상태 확인";
}

let adminLiveScheduleRefreshTimer = 0;
let adminLiveScheduleRefreshInFlight = false;
let adminLiveScheduleLastRefreshAt = 0;
let adminOperationalRevisionWatcher = null;
let scheduleSessionInitialized = false;
const adminLiveRefreshViews = new Set(["dashboard", "members", "schedule", "billing", "reports", "notes"]);
function bindEvents() {
  // 화면별 등록 함수로 나눴다. 각 파일은 app/admin/events/ 에 있다.
  bindDelegatedEvents();
  bindCommonEvents();
  bindMembersEvents();
  bindScheduleEvents();
  bindBillingEvents();
  bindNotesEvents();
  bindReportsEvents();
  bindDataEvents();
  bindSettingsEvents();

}

let adminConnectivityHideTimer = 0;

let scheduleV2IntegrityPreviewState = {
  branchId: "",
  ticketIds: [],
  plannedLessonCount: 0,
  plannedUnits: 0,
};

window.TennisNoteAdminScheduleV2Bridge = {
  snapshot: scheduleV2AdminBridgeSnapshot,
  saveOneDayBooking: async ({
    bookingId = null,
    coachRoleId,
    bookingDate,
    startTime,
    durationMinutes = 20,
    guestName,
    selectedUserId = "",
    note = "",
    bookingSource = "walk_in",
    paymentStatus = "unpaid",
    paymentMethod = "",
    paymentAmount = 0,
  } = {}) => {
    const dataClient = window.TennisNoteDataClient;
    if (!dataClient?.rpc) throw new Error("admin_data_client_unavailable");
    const normalizedUserId = String(selectedUserId || "");
    const linkedMember = normalizedUserId
      ? operationBranchMembers().find((member) => memberServerUserIds(member).includes(normalizedUserId)) || null
      : null;
    const resolvedName = String(linkedMember?.name || guestName || "").trim();
    const resolvedPhone = linkedMember ? String(linkedMember.phone || "").trim() : "";
    return dataClient.rpc("tn_admin_save_one_day_booking_v2", {
      target_booking_id: bookingId || null,
      target_branch_id: activeOperationBranchId(),
      target_coach_role_id: coachRoleId,
      target_booking_date: bookingDate,
      target_start_time: startTime,
      target_duration_minutes: Number(durationMinutes) || 20,
      target_guest_name: resolvedName,
      target_guest_phone: resolvedPhone || null,
      target_note: String(note || "").trim() || null,
      target_status: "reserved",
      target_booking_source: String(bookingSource || "walk_in"),
      target_payment_status: String(paymentStatus || "unpaid"),
      target_payment_method: String(paymentMethod || "").trim() || null,
      target_payment_amount: Math.max(0, Number(paymentAmount) || 0),
    });
  },
  archiveOneDayBooking: (bookingId) => {
    const dataClient = window.TennisNoteDataClient;
    if (!dataClient?.rpc) throw new Error("admin_data_client_unavailable");
    return dataClient.rpc("tn_admin_archive_one_day_booking", {
      target_booking_id: bookingId,
    });
  },
  refresh: async ({ allowWhileDirty = false } = {}) => {
    const refreshed = await syncAdminLiveData(true, { abortIfDirty: !allowWhileDirty });
    if (refreshed) {
      window.dispatchEvent(new CustomEvent("tennisnote:admin-live-data", {
        detail: { source: "v2-refresh", branchId: activeOperationBranchId() },
      }));
    }
    return refreshed;
  },
  rpc: (name, parameters = {}) => window.TennisNoteDataClient?.rpc?.(name, parameters),
};

restoreSnapshot();
window.TennisNoteReleaseUpdater?.start({
  manifestUrl: "../release.json",
  shouldDeferUpdate: adminHasUnsavedChanges,
});
prepareAdminLiveMode();
resetScheduleEntryState();
initializeOperationsSessionPersistence();
restoreCachedOperationsIdentity();
renderOperationsLoginGate();
organizeAdminTools();
bindEvents();
installAdminConnectivityStatus();
installAdminLiveScheduleRefresh();
installAdminOperationalRevisionWatcher();
renderAll();
const adminDemoView = adminQuery.get("demoView");
if (
  adminLocalPreviewMode
  && ["dashboard", "members", "schedule", "billing", "notes", "issues", "settings"].includes(adminDemoView)
) {
  window.setTimeout(() => setView(adminDemoView, { skipLock: true }), 0);
}
let adminScheduleResizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(adminScheduleResizeTimer);
  adminScheduleResizeTimer = window.setTimeout(() => {
    if (state.view === "schedule") renderSchedule();
  }, 120);
});
syncPopupNoticeFromServer();
void bootstrapAdminOperationsSession();
