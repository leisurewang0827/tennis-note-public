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
  memberTableView: "simple",
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
    statusLabel: "앱가입",
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
  memberPaymentProjections: [],
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
  baseCounts: null,
  preserveCountsWhileLoading: false,
  requestId: 0,
};
const adminMemberIdentityReviewState = {
  loading: false,
  loaded: false,
  error: "",
  count: null,
  promise: null,
};
const adminMemberDetailCache = new Map();
let adminUserNameIndex = null;
let memberSearchRenderTimer = 0;
let adminLiveSyncPromise = null;
let adminInitialLiveSyncHandle = 0;
let adminInitialLiveSyncKind = "";

async function loadAdminMemberIdentityReviewCount({ force = false } = {}) {
  if (operationsRole() !== "admin" || !window.TennisNoteDataClient?.rpc) return false;
  if (!force && adminMemberIdentityReviewState.loaded) return true;
  if (!force && adminMemberIdentityReviewState.promise) return adminMemberIdentityReviewState.promise;
  adminMemberIdentityReviewState.loading = true;
  adminMemberIdentityReviewState.error = "";
  adminMemberIdentityReviewState.promise = window.TennisNoteDataClient.rpc(
    "tn_admin_member_identity_reconciliation_page",
    {
      target_branch_id: activeOperationBranchId() || null,
      target_search: "",
      target_page: 0,
      target_page_size: 1,
    },
  ).then((response) => {
    const payload = Array.isArray(response) ? response[0] : response;
    const count = Math.max(0, Number(payload?.counts?.app_link ?? payload?.total) || 0);
    Object.assign(adminMemberIdentityReviewState, {
      loading: false,
      loaded: true,
      error: "",
      count,
      promise: null,
    });
    adminMemberDirectoryState.counts = {
      ...(adminMemberDirectoryState.baseCounts || adminMemberDirectoryState.counts || {}),
      app_link: count,
    };
    if (state.view === "members") renderMemberStatusCounts();
    return true;
  }).catch((error) => {
    Object.assign(adminMemberIdentityReviewState, {
      loading: false,
      loaded: false,
      error: String(error?.message || error || "member_identity_review_failed"),
      count: null,
      promise: null,
    });
    if (state.view === "members") renderMemberStatusCounts();
    return false;
  });
  return adminMemberIdentityReviewState.promise;
}

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

const branchSalesEffectiveOptionsState = {
  status: "idle",
  branchId: "",
  settingsVersion: 0,
  settingsAppliedAt: "",
  methodAvailability: [],
  message: "",
};

async function loadBranchSalesEffectiveOptionsFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.invokeFunction || !branchId || !adminApprovalReady()) return false;
  branchSalesEffectiveOptionsState.status = "loading";
  branchSalesEffectiveOptionsState.branchId = branchId;
  renderBranchSalesSetup();
  try {
    const response = await client.invokeFunction("portone-payment/options", { body: { branchId } });
    branchSalesEffectiveOptionsState.status = "loaded";
    branchSalesEffectiveOptionsState.settingsVersion = Math.max(0, Number(response?.settingsVersion) || 0);
    branchSalesEffectiveOptionsState.settingsAppliedAt = String(response?.settingsAppliedAt || "");
    branchSalesEffectiveOptionsState.methodAvailability = Array.isArray(response?.methodAvailability) ? response.methodAvailability : [];
    branchSalesEffectiveOptionsState.message = "";
    renderBranchSalesSetup();
    return true;
  } catch (error) {
    branchSalesEffectiveOptionsState.status = "failed";
    branchSalesEffectiveOptionsState.message = String(error?.payload?.code || error?.message || "server_error");
    renderBranchSalesSetup();
    return false;
  }
}

let adminViewRenderRevision = 0;
const adminViewRenderCache = new Map();

function dashboardOperationalDataReady() {
  if (adminDemoMode || state.liveScheduleLoaded) return true;
  return [coaches, members, lessons, makeupRequests, tickets, expiredTickets, billings, billingLogs, groupAccounts, lessonNotes]
    .some((items) => Array.isArray(items) && items.length > 0);
}

const memberPaymentRecordStates = new Set(["unentered", "complete", "transfer_zero", "incomplete"]);

function memberManagementPaymentStateFromValues({ paymentDate = "", paymentMethod = "", paymentAmount = 0 } = {}) {
  const date = String(paymentDate || "").trim();
  const method = normalizeMemberPaymentMethod(paymentMethod);
  const amount = Number(paymentAmount) || 0;
  if (amount === 0 && method === "membershiptransfer") return "transfer_zero";
  if (amount > 0 && date && method) return "complete";
  if (amount > 0 || date || method) return "incomplete";
  return "unentered";
}

function memberManagementPaymentAmountForMethod(product = null, method = "") {
  const normalized = normalizeMemberPaymentMethod(method);
  if (normalized === "card" || normalized === "tosspay") return Math.max(0, Number(product?.card_price) || 0);
  if (["banktransfer", "cash"].includes(normalized)) return Math.max(0, Number(product?.cash_price) || Number(product?.base_price) || 0);
  return 0;
}

function memberPaymentProjectionRow(member = null, ticket = null) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  const userIds = memberServerUserIds(member).map(String);
  if (!ticketId || !userIds.length) return null;
  return (adminLiveDataState.memberPaymentProjections || [])
    .filter((projection) => (
      String(projection.ticket_id || projection.ticketId || "") === ticketId
      && userIds.includes(String(projection.user_id || projection.userId || ""))
    ))
    .sort((left, right) => String(right.projection_updated_at || "")
      .localeCompare(String(left.projection_updated_at || "")))[0] || null;
}

function memberTicketLinkedPayment(member = null, ticket = null) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  const userIds = memberServerUserIds(member).map(String);
  if (!ticketId || !userIds.length) return null;
  return (adminLiveDataState.payments || [])
    .filter((payment) => (
      String(payment.ticket_id || payment.ticketId || "") === ticketId
      && userIds.includes(String(payment.user_id || payment.userId || ""))
    ))
    .sort((left, right) => {
      const statusScore = (payment) => payment.status === "verified" ? 2 : payment.status === "pending" ? 1 : 0;
      const scoreDelta = statusScore(right) - statusScore(left);
      if (scoreDelta) return scoreDelta;
      return String(right.verified_at || right.paid_at || right.created_at || "")
        .localeCompare(String(left.verified_at || left.paid_at || left.created_at || ""));
    })[0] || null;
}

function memberTicketPaymentProjection(member = null, ticket = null) {
  const serverProjection = memberPaymentProjectionRow(member, ticket);
  if (serverProjection) {
    const payment = (adminLiveDataState.payments || []).find((candidate) => (
      String(candidate.id || candidate.serverPaymentId || "") === String(serverProjection.payment_id || "")
    )) || memberTicketLinkedPayment(member, ticket);
    return {
      ...serverProjection,
      protected: Boolean(serverProjection.payment_protected),
      payment: payment || (serverProjection.payment_id ? {
        id: serverProjection.payment_id,
        status: serverProjection.payment_status || "",
      } : null),
      payment_provider: payment?.provider || "",
      provider_payment_id: payment?.provider_payment_id || "",
    };
  }
  const payment = memberTicketLinkedPayment(member, ticket);
  if (payment) {
    return {
      payment,
      protected: payment.status === "verified",
      payment_record_state: payment.status === "verified" ? "complete" : "incomplete",
      payment_recorded_on: String(payment.paid_at || payment.verified_at || payment.created_at || "").slice(0, 10),
      payment_method: payment.method || payment.provider || "",
      payment_amount: Number(payment.final_amount ?? payment.amount ?? 0),
      payment_provider: payment.provider || "",
      provider_payment_id: payment.provider_payment_id || "",
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
const accountDeletionRequestState = {
  loaded: false,
  loading: false,
  error: "",
};
const accountDeletionServerState = {
  status: "idle",
  code: "",
  contractVersion: "",
  appleRevokeReady: null,
  tokenEncryptionReady: null,
};

function accountDeletionServerReady() {
  return accountDeletionServerState.status === "ready";
}

function accountDeletionServerStatusCopy() {
  const status = accountDeletionServerState.status;
  if (status === "ready") {
    const appleReady = accountDeletionServerState.appleRevokeReady !== false
      && accountDeletionServerState.tokenEncryptionReady !== false;
    return {
      title: appleReady ? "삭제 서버 준비됨" : "일반 계정 삭제 준비됨",
      detail: appleReady
        ? "서버와 DB 안전 계약을 확인했습니다."
        : "Apple 로그인 탈퇴는 서버 비밀설정을 추가로 확인해야 합니다.",
      tone: "is-ready",
    };
  }
  if (status === "checking" || status === "idle") {
    return { title: "삭제 서버 확인 중", detail: "실행 전에 서버와 DB 안전 계약을 확인합니다.", tone: "is-checking" };
  }
  if (status === "unavailable") {
    return { title: "삭제 서버 미배포", detail: "회원 데이터는 그대로 보존됩니다. 서버 기능을 배포한 뒤 다시 확인해 주세요.", tone: "is-blocked" };
  }
  if (status === "misconfigured") {
    return { title: "삭제 서버 설정 확인 필요", detail: "서버 비밀설정이 준비될 때까지 삭제 실행을 차단했습니다.", tone: "is-blocked" };
  }
  if (status === "contract_error") {
    return { title: "DB 안전 계약 불일치", detail: "운영 DB migration을 확인하기 전에는 삭제할 수 없습니다.", tone: "is-blocked" };
  }
  if (status === "unauthorized") {
    return { title: "관리자 로그인 확인 필요", detail: "관리자 권한을 다시 확인한 뒤 재시도해 주세요.", tone: "is-blocked" };
  }
  return { title: "삭제 서버 확인 실패", detail: "네트워크 상태를 확인한 뒤 다시 확인해 주세요.", tone: "is-blocked" };
}

function renderAccountDeletionServerStatus() {
  const target = $("#accountDeletionServerStatus");
  if (!target) return;
  const copy = accountDeletionServerStatusCopy();
  target.className = `account-deletion-server-status ${copy.tone}`;
  target.innerHTML = `
    <div><strong>${escapeHtml(copy.title)}</strong><span>${escapeHtml(copy.detail)}</span></div>
    <button class="ghost-button" type="button" data-retry-account-deletion-readiness ${accountDeletionServerState.status === "checking" ? "disabled aria-busy=\"true\"" : ""}>다시 확인</button>`;
}

async function checkAccountDeletionServerReadiness({ force = false } = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    Object.assign(accountDeletionServerState, { status: "unauthorized", code: "login_required" });
    renderAccountDeletionServerStatus();
    renderAccountDeletionAdminList();
    return false;
  }
  if (!force && accountDeletionServerReady()) return true;
  if (accountDeletionServerState.status === "checking") return false;
  Object.assign(accountDeletionServerState, { status: "checking", code: "" });
  renderAccountDeletionServerStatus();
  renderAccountDeletionAdminList();
  try {
    const payload = await client.invokeFunction("tennisnote-account-deletion", {
      body: { action: "readiness" },
    });
    if (payload?.ok !== true || payload?.code !== "ready") throw new Error("account_deletion_readiness_invalid");
    Object.assign(accountDeletionServerState, {
      status: "ready",
      code: "ready",
      contractVersion: String(payload.contractVersion || ""),
      appleRevokeReady: payload.appleRevokeReady !== false,
      tokenEncryptionReady: payload.tokenEncryptionReady !== false,
    });
    return true;
  } catch (error) {
    const code = String(error?.payload?.code || error?.message || "").toLowerCase();
    const status = Number(error?.status) || 0;
    accountDeletionServerState.code = code || `http_${status || "unknown"}`;
    accountDeletionServerState.status = status === 404 || code.includes("function_not_found")
      ? "unavailable"
      : status === 401 || status === 403 || code.includes("login_required") || code.includes("admin_required")
        ? "unauthorized"
        : status === 503 || code.includes("server_config")
          ? "misconfigured"
          : code.includes("db_contract")
            ? "contract_error"
            : "error";
    return false;
  } finally {
    renderAccountDeletionServerStatus();
    renderAccountDeletionAdminList();
  }
}

const manualMemberPartnerSearchState = new WeakMap();

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

async function openSimpleMemberRegistrationHub() {
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 계정으로 로그인해야 회원을 등록할 수 있습니다.");
    return;
  }
  state.memberFilter = "journal";
  state.memberSearch = "";
  state.memberCoachFilter = "all";
  state.memberTicketFilter = "all";
  state.memberTicketGridFilter = "all";
  state.memberListPage = 0;
  setView("members", { skipLock: true });
  $$('[data-member-filter]').forEach((button) => {
    button.classList.toggle("is-active", button.dataset.memberFilter === "journal");
  });
  await loadAdminMemberDirectoryPage({ force: true, render: true, preserveList: false });
  const search = $("#memberListSearch");
  if (search) {
    search.value = "";
    search.placeholder = "앱 가입 이름 또는 휴대전화 뒤 4자리";
    search.focus();
  }
  showToast("앱 가입 회원을 먼저 검색하세요. 없을 때만 직접 신규 등록을 사용합니다.");
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

function syncMemberManagementPaymentFields(form, options = {}) {
  if (!form?.elements?.paymentRecordState || !form.elements.paymentAmount) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const method = form.elements.paymentMethod?.value || "";
  const overridden = form.dataset.paymentAmountOverride === "true";
  if (options.forcePrice === true && !overridden) {
    form.elements.paymentAmount.value = memberManagementPaymentAmountForMethod(product, method);
  }
  const values = {
    paymentDate: form.elements.paymentDate?.value || "",
    paymentMethod: method,
    paymentAmount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
  };
  const state = memberManagementPaymentStateFromValues(values);
  form.elements.paymentRecordState.value = state;
  const stateLabel = form.querySelector("[data-member-payment-derived-state]");
  if (stateLabel) stateLabel.textContent = memberPaymentRecordStateLabel(state);
  const missing = [];
  if (state === "incomplete") {
    if (!values.paymentDate) missing.push("결제일");
    if (!values.paymentMethod) missing.push("결제수단");
    if (values.paymentAmount <= 0) missing.push("결제금액");
  }
  const missingLabel = form.querySelector("[data-member-payment-missing]");
  if (missingLabel) missingLabel.textContent = missing.length ? `${missing.join(" · ")} 입력 필요` : state === "complete" ? "입력 완료 · 결제 완료로 자동 처리" : "세 항목을 모두 비우면 미결제";
  syncMemberRegistrationSummary(form);
}

function enableMemberManagementPaymentOverride(form) {
  if (!form?.elements?.paymentAmount || form.elements.paymentAmount.disabled) return;
  form.dataset.paymentAmountOverride = "true";
  form.elements.paymentAmount.readOnly = false;
  form.elements.paymentAmount.removeAttribute("aria-readonly");
  const field = form.querySelector("[data-payment-override-reason]");
  const reason = form.elements.paymentOverrideReason;
  if (field) field.hidden = false;
  if (reason) {
    reason.disabled = false;
    reason.required = true;
    reason.focus();
  }
}

function syncMemberRegistrationSummary(form) {
  const summary = form?.querySelector("[data-member-registration-summary]");
  if (!summary) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const coach = memberManagementCoachRoles({ branchId: product?.branch_id })
    .find((item) => item.id === form.elements.coachRoleId?.value);
  const partnerSelect = form.elements.partnerUserId;
  const partnerName = partnerSelect && !partnerSelect.disabled ? partnerSelect.selectedOptions?.[0]?.textContent?.trim() : "";
  const isGroup = Number(product?.group_size || 1) === 2;
  const schedules = memberInlineScheduleValues(form).map((slot) => `${memberManagementDayLabel(slot.dayOfWeek)} ${slot.startTime}`);
  const paymentState = memberManagementPaymentStateFromValues({
    paymentDate: form.elements.paymentDate?.value || "",
    paymentMethod: form.elements.paymentMethod?.value || "",
    paymentAmount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
  });
  const primaryName = form.elements.memberName?.value?.trim()
    || members.find((item) => item.id === memberManagementModalState.memberId)?.name
    || "회원";
  summary.innerHTML = `<strong>최종 확인</strong><dl>
    <div><dt>회원</dt><dd>${escapeHtml(isGroup && partnerName ? `${primaryName} · ${partnerName}` : primaryName)}</dd></div>
    <div><dt>회원권</dt><dd>${escapeHtml(product?.name || "선택 필요")}${isGroup ? " · 그룹 2명 연결" : ""}</dd></div>
    <div><dt>코치·일정</dt><dd>${escapeHtml(coach?.display_name || "코치 선택 필요")}${schedules.length ? ` · ${escapeHtml(schedules.join(" / "))}` : " · 시간 선택 필요"}</dd></div>
    <div><dt>기간</dt><dd>${escapeHtml(form.elements.startsOn?.value || "시작일 필요")} ~ ${escapeHtml(form.elements.expiresOn?.value || "자동 계산")}</dd></div>
    <div><dt>결제</dt><dd>${escapeHtml(memberPaymentRecordStateLabel(paymentState))}${paymentState === "complete" ? ` · ${escapeHtml(paymentMethodLabel(form.elements.paymentMethod?.value || ""))} ${money.format(Number(form.elements.paymentAmount?.value) || 0)}원` : ""}</dd></div>
  </dl><small>수정할 항목이 있으면 위 입력칸에서 바로 바꾼 뒤 확정하세요.</small>`;
}

function renderMemberTableViewMode() {
  const simple = state.memberTableView !== "detail";
  const table = $("#memberDirectoryTable");
  table?.classList.toggle("is-simple", simple);
  table?.classList.toggle("is-detail", !simple);
  const button = $("#toggleMemberTableView");
  if (button) {
    button.textContent = simple ? "상세 보기" : "간단 보기";
    button.setAttribute("aria-pressed", String(simple));
    button.title = simple
      ? "코치·기간·결제일 등 운영 상세 열까지 펼칩니다."
      : "회원·앱 연결·회원권·횟수·결제·정산·처리만 표시합니다.";
  }
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

function memberTicketPaymentStatusMarkup(paymentGrid) {
  return `<span class="member-payment-status is-${escapeHtml(paymentGrid.tone || "neutral")}" title="${escapeHtml(paymentGrid.detail || "")}">
    <strong>${escapeHtml(paymentGrid.label || "결제 확인")}</strong>
    <small>${escapeHtml(paymentGrid.method || "미입력")}</small>
  </span>`;
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

function billingOperationalMonthMatches(item, month) {
  if (!month) return true;
  return billingEffectiveDate(item).slice(0, 7) === month;
}

function billingAttemptGroupKey(item = {}) {
  const groupable = ["draft", "check", "unverified", "failed", "server_ready"].includes(String(item.status || ""));
  if (!groupable) return item.serverPaymentId || item.providerPaymentId
    ? `payment:${item.serverPaymentId || item.providerPaymentId}`
    : item;
  if (item.purchaseIntentKey) return `intent:${item.purchaseIntentKey}`;
  const requestedDay = String(item.requestedAt || item.createdAt || "").slice(0, 10) || billingEffectiveDate(item);
  return [
    "legacy-attempt",
    item.serverUserId || item.member || "member",
    item.productId || item.item || "product",
    String(item.method || "").toLowerCase(),
    Number(item.finalAmount || item.amount || 0),
    requestedDay,
  ].join("|");
}

function groupedBillingAttempts(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const key = billingAttemptGroupKey(item);
    const attempts = groups.get(key) || [];
    attempts.push(item);
    groups.set(key, attempts);
  });
  return [...groups.values()]
    .map((attempts) => {
      attempts.sort((left, right) => paymentCreatedAtMs(right) - paymentCreatedAtMs(left));
      return { primary: attempts[0], attempts, attemptCount: attempts.length };
    })
    .sort((left, right) => paymentCreatedAtMs(right.primary) - paymentCreatedAtMs(left.primary));
}

function billingAttemptSummary(entry = {}) {
  const count = Number(entry.attemptCount || 0);
  const latest = entry.primary || {};
  const latestDisplay = paymentDisplayStatus(latest);
  const latestSummary = `최근 ${paymentMethodLabel(latest.method)} · ${latestDisplay.label || latest.statusLabel || "상태 확인"}`;
  return count > 1 ? `${latestSummary} · 동일 요청 ${count}회` : latestSummary;
}

function billingAttemptHistoryMarkup(entry = {}) {
  if (Number(entry.attemptCount || 0) <= 1) return "";
  const rows = (entry.attempts || []).map((attempt) => {
    const display = paymentDisplayStatus(attempt);
    const date = paymentAuditDateTimeLabel(attempt.requestedAt || attempt.createdAt) || "시각 확인 필요";
    return `<li>${escapeHtml(date)} · ${escapeHtml(paymentMethodLabel(attempt.method))} · ${escapeHtml(display.label)}</li>`;
  }).join("");
  return `<details class="payment-attempt-details"><summary>${escapeHtml(billingAttemptSummary(entry))}</summary><ul>${rows}</ul></details>`;
}

function paymentPendingMoreActions(item, index) {
  const action = paymentCancelButtonFor(index, "대기취소");
  return action ? `<details class="payment-row-more"><summary>기타</summary>${action}</details>` : "";
}

function paymentApprovedMoreActions(item, index) {
  const actions = `${paymentFullCancelButtonFor(item, index)}${paymentRefundButtonFor(item, index)}`;
  return actions ? `<details class="payment-row-more"><summary>취소·환불</summary>${actions}</details>` : "";
}

function paymentApprovalDisplay(item = {}) {
  const method = String(item.method || "").toLowerCase();
  if (item.approvalPending) return { tone: "neutral", label: "승인 처리중", detail: "서버에서 결제와 회원권을 다시 확인하고 있습니다." };
  if (item.status === "paid" && paymentRequiresTicketRepair(item)) {
    return { tone: "warn", label: "연결 확인", detail: "결제는 확인됐지만 회원권 연결을 확인해야 합니다." };
  }
  if (item.status === "paid") {
    return { tone: "good", label: "승인 완료", detail: item.oneDayBookingId ? "원데이 예약 연결됨" : item.ticketId ? "회원권 연결됨" : "이관 결제 보존" };
  }
  if (item.status === "server_ready" && method === "bank_transfer") {
    return { tone: "warn", label: "입금 확인 필요", detail: "실제 입금액을 확인한 뒤 한 번만 승인하세요." };
  }
  if (["check", "unverified"].includes(item.status)) {
    return { tone: "warn", label: "결제 확인 필요", detail: "결제사 상태를 확인하면 회원권까지 함께 연결됩니다." };
  }
  if (item.status === "server_ready") return { tone: "neutral", label: "결제 대기", detail: "회원 결제가 완료됐는지 확인합니다." };
  if (["cancelled", "refunded"].includes(item.status)) return { tone: "neutral", label: "취소·환불", detail: "현재 회원권 승인 대상이 아닙니다." };
  if (item.status === "failed") return { tone: "danger", label: "결제 실패", detail: "회원권을 생성하거나 연결하지 않습니다." };
  return { tone: "neutral", label: "확인 대기", detail: "결제 상태를 먼저 확인해 주세요." };
}

function paymentConfirmationMarkup(item = {}) {
  const paidAt = paymentAuditDateTimeLabel(item.verifiedAt || item.paidAt);
  if (item.status === "paid") return `${badge("good", "결제 확인됨")}${paidAt ? `<br><small>${escapeHtml(paidAt)}</small>` : ""}`;
  if (item.status === "server_ready" && String(item.method || "").toLowerCase() === "bank_transfer") {
    const depositor = item.depositorName ? ` · ${escapeHtml(item.depositorName)}` : "";
    return `${badge("warn", "직접 입금 확인")}${depositor ? `<br><small>${depositor}</small>` : ""}`;
  }
  if (["check", "unverified"].includes(item.status)) return badge("warn", "결제사 확인 필요");
  if (item.status === "server_ready") return badge("neutral", "결제 전");
  if (item.status === "failed") return badge("danger", "실패");
  if (["cancelled", "refunded"].includes(item.status)) return badge("neutral", "취소·환불 완료");
  return badge("neutral", "확인 대기");
}

function settlementRuleSummary(rule = {}) {
  if (rule.method === "hourly") return `시간제 ${money.format(Number(rule.hourly) || 0)}원/시간`;
  const rate = Math.round((Number(rule.ratio) || 0) * 10000) / 100;
  return rule.calculationMode === "monthly_payment"
    ? `월 결제금액 × ${rate}%`
    : `진행 횟수 × ${rate}%`;
}

function billingSettlementApprovalMarkup(item = {}) {
  if (item.status !== "paid") return '<span class="billing-settlement-pending">승인 후 자동계산</span>';
  if (paymentRequiresTicketRepair(item)) return '<span class="payment-link-warning">회원권 연결 후 계산</span>';
  const rows = settlementRowsForBilling(item);
  const amount = rows.reduce((sum, row) => sum + settlementAmountFor(row), 0);
  const coachNames = [...new Set(rows.map((row) => settlementCoachNameFor(row)).filter(Boolean))];
  const summaries = [...new Set(rows.map((row) => settlementRuleSummary(settlementRuleFor(settlementCoachNameFor(row)))))]
    .filter(Boolean);
  return `<strong>${money.format(amount)}원</strong><br><small>${escapeHtml(coachNames.join(" · ") || "코치 확인 필요")}${summaries.length ? ` · ${escapeHtml(summaries.join(" / "))}` : ""}</small>`;
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

function openBillingMemberReview(item = {}) {
  const userId = String(item.serverUserId || "");
  const member = members.find((candidate) => memberServerUserIds(candidate).includes(userId))
    || members.find((candidate) => String(candidate.name || "") === String(item.member || ""));
  if (!member) {
    showToast("연결할 회원을 회원관리에서 먼저 확인해 주세요");
    return;
  }
  state.selectedMemberId = member.id;
  setView("members", { skipLock: true });
  renderMembers();
  void loadAdminMemberDetail(member, { force: true });
  showToast(`${member.name} 회원권·결제 연결을 확인해 주세요`);
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

function branchSalesEffectiveOptionsMarkup() {
  const status = branchSalesEffectiveOptionsState;
  if (status.status === "loading" || status.status === "idle") {
    return '<section class="branch-sales-effective-status is-loading" role="status"><strong>회원앱 실제 노출 확인 중</strong><span>서버 운영 허용과 계좌 준비 상태를 확인합니다.</span></section>';
  }
  if (status.status === "failed") {
    return `<section class="branch-sales-effective-status is-error" role="alert"><strong>회원앱 실제 노출을 확인하지 못했습니다</strong><span>${escapeHtml(status.message || "server_error")}</span></section>`;
  }
  const applied = normalizeBranchSalesConfig(branchSalesSettingsState.appliedConfig);
  const availability = Array.isArray(status.methodAvailability) ? status.methodAvailability : [];
  const labels = {
    available: "회원앱 사용 중",
    branch_disabled: "관리자 설정 꺼짐",
    server_not_allowed: "서버 운영 미허용",
    bank_account_not_ready: "입금 계좌 미준비",
  };
  const items = availability.map((method) => {
    const id = String(method.id || "");
    const title = applied.paymentMethods[id]?.title || id;
    const reason = String(method.reason || "server_not_allowed");
    return `<li class="${method.available === true ? "is-ready" : "is-blocked"}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(labels[reason] || reason)}</span></li>`;
  }).join("");
  const appliedAt = status.settingsAppliedAt ? bankNotificationDateTime(status.settingsAppliedAt) : "적용 기록 없음";
  return `
    <section class="branch-sales-effective-status" role="status">
      <div><strong>회원앱 실제 노출</strong><span>서버 설정 v${Number(status.settingsVersion || 0)} · 마지막 적용 ${escapeHtml(appliedAt)}</span></div>
      ${items ? `<ul>${items}</ul>` : '<span>서버 진단 정보가 아직 적용되지 않았습니다.</span>'}
    </section>`;
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
