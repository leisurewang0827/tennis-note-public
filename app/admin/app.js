const adminQuery = new URLSearchParams(window.location.search);
const adminDemoMode = adminQuery.get("demoAdmin") === "1";
const adminLocalPreviewMode = adminDemoMode && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const adminBrandSplashStartedAt = performance.now();
const adminBrandSplashMinimumDuration = 250;
let adminBrandSplashHideScheduled = false;

const state = {
  view: "dashboard",
  memberFilter: "active",
  memberSearch: "",
  memberCoachFilter: "all",
  memberTicketFilter: "all",
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

function adminEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${escapeHtml(options.title || "표시할 내용이 없습니다.")}</p>`;
}

function adminStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || value || "";
}

// Keep the last confirmed server schedule locally. A failed or unexpectedly empty
// refresh must never make an already loaded timetable look deleted.
const scheduleSafetySnapshotKey = "tennis-note-admin-schedule-safety-v1";
const adminSnapshotVersion = 2;
const scheduleSafetySnapshotLimit = 500;

function shouldProtectLoadedSchedule(serverLessons, nextLessons) {
  const current = persistentScheduleLessons();
  const next = persistentScheduleLessons(nextLessons);
  if (!state.liveScheduleLoaded || !current.length) return false;

  // A normal action can replace a few future rows, but it must not erase the full
  // timetable just because a request returned an empty or incomplete lesson list.
  if (!Array.isArray(serverLessons) || !serverLessons.length) return true;
  return next.length === 0;
}

const policyGuideTemplates = [
  {
    id: "makeup",
    title: "수업 변경",
    summary: "24시간 전 자동 변경, 24시간 이내 코치 승인",
    copy: "수업 24시간 전까지는 앱에서 직접 변경할 수 있습니다. 24시간 이내 요청은 코치 승인 대상이며, 미승인 또는 당일 취소는 이용권이 차감될 수 있습니다.",
  },
  {
    id: "holding",
    title: "회원권 홀딩",
    summary: "개인 사유와 부상 사유를 분리해 관리",
    copy: "개인 사유 홀딩은 정해진 횟수와 기간 안에서 신청하며, 부상 홀딩은 진단서 등 증빙 확인 후 승인합니다. 승인된 기간만큼 회원권 만료일을 연장합니다.",
  },
  {
    id: "refund",
    title: "환불",
    summary: "실결제액과 사용 회차를 기준으로 관리자 확정",
    copy: "환불액은 실제 납부액에서 사용한 수업 금액과 관련 규정에 따른 공제액을 반영해 계산합니다. 최종 금액은 결제와 이용 기록을 대조한 뒤 관리자가 확정합니다.",
  },
];

const lessonPolicyDefaults = [
  {
    id: "lesson-change-before",
    title: "24시간 전 변경",
    detail: "회원이 가능한 시간으로 바로 변경",
    category: "수업 변경",
    status: "active",
    systemKey: "change_before_24h",
  },
  {
    id: "lesson-change-within",
    title: "24시간 이내 변경",
    detail: "코치 승인 필요 · 당일 취소는 차감",
    category: "수업 변경",
    status: "active",
    systemKey: "change_within_24h",
  },
  {
    id: "lesson-completion",
    title: "수업 완료 처리",
    detail: "코치 코멘트와 다음 커리큘럼 등록 후 차감",
    category: "수업 처리",
    status: "active",
    systemKey: "lesson_completion",
  },
  {
    id: "lesson-duration",
    title: "수업 단위",
    detail: "20분·30분, 40분·60분은 연속 회차 사용",
    category: "수업 단위",
    status: "active",
    systemKey: "lesson_duration",
  },
];

const lessonPolicies = lessonPolicyDefaults.map((policy, index) => normalizeLessonPolicy(policy, index));

const fixedCourtCount = 4;
const coachSlotWidth = 64;
const timeColumnWidth = 64;
const mobileCoachSlotWidth = 92;
const dashboardPageSize = 5;
const memberListPageSize = 10;
const membershipProductPageSize = 10;
const billingPageSize = 15;

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

const scheduleDays = ["월", "화", "수", "목", "금", "토", "일"];
const scheduleBlockMinutes = 10;
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

function getVisibleScheduleTimes() {
  return makeTimeRange(scheduleSettings.openStart, scheduleSettings.openEnd)
    .filter((time) => scheduleDays.some((day) => adminTimeVisibleForDay(day, time)));
}

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

const adminScheduleMinWeekOffset = -104;
const adminScheduleMaxWeekOffset = 156;

refreshAdminScheduleWeekLabels();

const makeupRequests = [
  {
    id: 1,
    member: "김서준",
    original: "수 20:00 노 코치",
    requested: "월 19:00 강 코치",
    policy: "24시간 전",
    status: "requested",
    statusLabel: "승인대기",
  },
  {
    id: 2,
    member: "이하린",
    original: "목 19:20 강 코치",
    requested: "금 18:40 황 코치",
    policy: "24시간 이내",
    status: "coach_required",
    statusLabel: "코치승인필요",
  },
];

function adminScheduleWeek(offset = 0) {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  const template = offset >= 0 ? (adminScheduleWeeks[offset] || {}) : {};
  return {
    ...template,
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    note: template.note || (offset === 0 ? "이번 주 실시간 수업과 변경 요청" : "선택한 주의 실시간 수업과 변경 요청"),
    startDate: adminLocalDateKey(start),
    endDate: adminLocalDateKey(end),
  };
}

function activeAdminWeek() {
  const offset = Math.min(Math.max(Number(state.activeAdminWeekIndex) || 0, adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  state.activeAdminWeekIndex = offset;
  return adminScheduleWeek(offset);
}

function selectedAdminScheduleDay() {
  if (!scheduleDays.includes(state.selectedScheduleDay)) state.selectedScheduleDay = currentScheduleDay();
  return state.selectedScheduleDay;
}

function adminScheduleDateLabel(day) {
  const value = adminWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function isAdminMobileSchedule() {
  return window.matchMedia?.("(max-width: 760px)").matches ?? window.innerWidth <= 760;
}

function adminTimeVisibleForDay(day, time) {
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + scheduleBlockMinutes;
  const hasLesson = lessons.some((lesson) => {
    if (lesson.day !== day || isLessonCancelled(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
    const lessonStart = timeToMinutes(lesson.time);
    return slotStart < lessonStart + (Number(lesson.durationMinutes) || 20) && slotEnd > lessonStart;
  });
  if (hasLesson) return true;
  return getScheduleCoachLanes(day)
    .filter((coach) => coach.id !== "coach-machine")
    .some((coach) => isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes));
}

function goToAdminScheduleToday() {
  state.activeAdminWeekIndex = 0;
  state.selectedScheduleDay = currentScheduleDay();
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function changeAdminWeek(delta) {
  state.activeAdminWeekIndex = Math.min(
    Math.max((Number(state.activeAdminWeekIndex) || 0) + delta, adminScheduleMinWeekOffset),
    adminScheduleMaxWeekOffset,
  );
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function changeAdminMonth(delta) {
  const currentStart = new Date(`${activeAdminWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(target), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function selectAdminMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeAdminWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(target), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function adminScheduleMonthValue(week = activeAdminWeek(), allMembers = members) {
  return String(week.startDate || "").slice(0, 7);
}

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
const SERVER_PAYMENT_REFRESH_STALE_MS = 120_000;
const paymentCancelInFlight = new Set();

const paymentCancelFlowState = {
  itemIndex: -1,
  submitting: false,
  idempotencyKey: "",
  message: "",
  tone: "neutral",
};

const refundFlowState = {
  itemIndex: -1,
  preview: null,
  loading: false,
  submitting: false,
  reconcileRequired: false,
  idempotencyKey: "",
  message: "",
  tone: "neutral",
};

const operationMetrics = [
  { label: "예약", value: "2회", compare: "전일 1회", tone: "good" },
  { label: "방문자", value: "7명", compare: "전일 14명", tone: "warn" },
  { label: "신규 예약자", value: "6명", compare: "전월 0명", tone: "good" },
  { label: "재방문 예약자", value: "13명", compare: "전월 0명", tone: "good" },
  { label: "주간 누적 매출", value: "20,000원", compare: "지난 주 대비 91%", tone: "warn" },
  { label: "즐겨찾기", value: "149명", compare: "관심 회원", tone: "neutral" },
];

const reportMetrics = [
  { label: "활성 회원", value: "86명", detail: "회원 관리 기준", tone: "" },
  { label: "이번 달 수업", value: "312개", detail: "레슨 시간표 기준", tone: "calm" },
  { label: "출석 처리율", value: "91%", detail: "미처리 28건", tone: "warning" },
  { label: "코치별 정산", value: "4명", detail: "현금/카드 구분", tone: "accent" },
];

const benchmarks = [
  {
    name: "CourtReserve",
    role: "관리자 프로그램 기준",
    takeaway: "예약, 레슨, 멤버십, 결제, 모바일앱을 한 운영판에서 묶는다.",
  },
  {
    name: "Mindbody",
    role: "스케줄/결제 운영 기준",
    takeaway: "직원 관리, 결제, 리포트 흐름을 사업 관리 관점으로 정리한다.",
  },
  {
    name: "Club Automation",
    role: "대형 센터 운영 기준",
    takeaway: "회원권, 리포트, 마케팅, 결제 데이터를 한 곳에서 관리한다.",
  },
  {
    name: "예약형 앱",
    role: "국내 회원 앱 기준",
    takeaway: "예약 확인, 알림, 간단 결제처럼 회원이 자주 쓰는 흐름을 단순하게 둔다.",
  },
  {
    name: "스매시",
    role: "국내 모바일 UX 기준",
    takeaway: "날짜, 조건 필터와 강한 행동 버튼을 레슨/예약 화면에 적용한다.",
  },
];

const notificationPlan = [
  { title: "수업 하루 전", detail: "수업 시작 24시간 전 앱 푸시" },
  { title: "수업 30분 전", detail: "잠금화면 앱 푸시" },
  { title: "재등록 안내", detail: "잔여 2회와 만료 7일 전 안내" },
  { title: "만료 안내", detail: "회원권 만료일 오전 9시 안내" },
];

const serviceReadinessItems = [
  {
    title: "Supabase DB",
    status: "ready",
    label: "초안 완료",
    detail: "회원, 코치, 회원권, 레슨, 변경요청, 결제, 할인권, 알림 테이블 초안을 만들었습니다.",
    next: "RLS 권한과 실제 연결",
  },
  {
    title: "코치 권한",
    status: "setup",
    label: "관리자 부여형",
    detail: "관리자가 이름·휴대전화를 사전 등록하고, 확인된 번호로 로그인하면 코치 모드가 연결됩니다.",
    next: "회원 검색 후 코치 역할 부여",
  },
  {
    title: "결제",
    status: "pending",
    label: "서버 검증 전",
    detail: "회원앱 결제 UI는 있으나 PortOne 검증과 웹훅 연결 후 회원권 충전해야 합니다.",
    next: "Store ID, Channel Key, 검증 서버",
  },
  {
    title: "알림",
    status: "ready",
    label: "구조 완료",
    detail: "레슨 하루 전·30분 전과 잔여횟수·만료 알림을 DB 대기열과 앱 푸시로 연결했습니다.",
    next: "실기기 발송 검증",
  },
  {
    title: "기존 DB 이전",
    status: "draft",
    label: "마지막 전 단계",
    detail: "구글시트 레슨관리표와 고객 DB를 학습한 뒤 Supabase로 정리 이전합니다.",
    next: "가격 확정 전 데이터 매핑",
  },
];

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

const membershipProductStatusOptions = [
  { id: "sale", label: "판매중" },
  { id: "consult", label: "상담" },
  { id: "hidden", label: "숨김" },
];

const discountPolicyDefaults = [
  {
    id: "new-member-10",
    title: "신규 10% 할인권",
    type: "percent",
    value: 10,
    target: "정기권/쿠폰제",
    payment: "카드/현금",
    issueRule: "관리자 발급",
    coachPermission: "코치별 지급 수량 안에서 사용",
    coachQuota: 5,
    burden: "센터 부담",
    expiresDays: 30,
    status: "사용",
  },
  {
    id: "renewal-5",
    title: "재등록 5% 할인권",
    type: "percent",
    value: 5,
    target: "정기권",
    payment: "카드/현금",
    issueRule: "관리자 발급",
    coachPermission: "요청만 가능",
    coachQuota: 0,
    burden: "센터 부담",
    expiresDays: 14,
    status: "사용",
  },
  {
    id: "coach-referral",
    title: "코치 추천 할인권",
    type: "amount",
    value: 10000,
    target: "쿠폰제",
    payment: "현금 우선",
    issueRule: "관리자 승인",
    coachPermission: "코치가 요청하면 관리자 승인",
    coachQuota: 3,
    burden: "센터/코치 협의",
    expiresDays: 30,
    status: "검토",
  },
];

const discountPolicies = discountPolicyDefaults.map((policy) => ({ ...policy, issued: 0, used: 0 }));
const discountIssueLogs = [
  { id: "discount-log-1", text: "신규 10% 할인권 샘플 준비", at: "2026-07-10" },
];

const refundPolicyRuleDefaults = [
  "회원 사유 환불은 실납부액에서 할인 전 원가의 10% 위약금을 차감",
  "사용한 수업은 할인 전 회당 금액으로 차감",
  "첫 수업이 속한 달에는 예약금 30,000원을 추가 차감",
  "분쟁이 생긴 경우에만 관리자가 소비자분쟁해결기준 검토 절차를 별도로 진행",
];

const policyVersionDefaults = [
  {
    id: "policy-2026-07-google-drive",
    title: "2026년 7월 기존 운영 기준",
    status: "active",
    effectiveFrom: "2026-07-01",
    source: "Google Drive DB 운영정책",
    summary: "구매 시점의 보강, 홀딩, 환불, 코치변경 규칙을 회원권에 스냅샷으로 저장합니다.",
    sections: [
      {
        id: "makeup",
        title: "보강/수업변경",
        rules: [
          "24시간 전 변경은 자동 승인",
          "24시간 이내 변경은 코치 승인 필요",
          "코치가 승인하지 않아도 당일 취소는 회원권 차감",
          "보강은 담당 코치의 기존 수업 시작 전후 40분 안에서만 신청 가능",
          "평일권은 평일, 주말권은 주말에만 신청 가능하며 관리자는 예외 처리 가능",
          "4주권 주1회는 주2회, 주2회는 주3회, 주3회는 주5회까지 보강 포함 사용",
          "3개월권은 보강 포함 15주 안에서 같은 날 최대 2회 사용",
        ],
      },
      {
        id: "holding",
        title: "홀딩/시간오픈",
        rules: [
          "4주 정규권 개인 사유 홀딩은 1회 최대 7일",
          "3개월 정규권 개인 사유 홀딩은 합계 최대 14일",
          "쿠폰제는 개인 사유 홀딩 없음",
          "부상·입원 홀딩은 증빙 확인 후 최대 30일, 추가 증빙으로 연장 검토",
          "부상 증빙 원본은 관리자만 확인하고 심사 후 보관기간에 맞춰 삭제",
          "원칙적으로 사전 신청하며 응급 사유는 3일 이내 소급 신청 가능",
          "재등록 알림 후 미결제 시 남은 2회 이후 주차부터 시간 오픈",
        ],
      },
      {
        id: "refund",
        title: "환불",
        rules: [...refundPolicyRuleDefaults],
      },
      {
        id: "transfer",
        title: "양도",
        rules: [
          "유료 회원권은 1회에 한해 잔여 전체만 양도 가능",
          "남은 기간과 평일·주말·수업시간·담당 코치 조건은 그대로 유지",
          "이벤트·무료 지급권은 양도 불가",
          "양수인 본인확인과 관리자 승인이 필요하며 재양도는 불가",
        ],
      },
      {
        id: "coach-change",
        title: "코치변경/대타",
        rules: [
          "회원권은 기본적으로 담당 코치 기준으로 사용",
          "코치 변경은 관리자 승인 후 새 코치 회원권 또는 이전 처리",
          "대타 수업은 실제 처리 코치가 기록/차감하고 정산 이관 기록을 남김",
        ],
      },
    ],
    ticketSnapshot: {
      policyVersionId: "policy-2026-07-google-drive",
      snapshotTiming: "payment_confirmed",
      fields: ["product", "price", "validity", "grace", "makeup", "refund", "holding", "coach_change"],
    },
  },
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

const notificationPolicyDefaults = {
  lessonDayBeforeEnabled: true,
  lesson30MinutesEnabled: true,
  couponNextBookingEnabled: true,
  ticketLowRemainingEnabled: true,
  lowRemainingThreshold: 2,
  ticketExpiryEnabled: true,
  expiryDaysBefore: 7,
  ticketExpiredEnabled: true,
  coachFeedbackReminderEnabled: true,
  coachFeedbackReminderMinutes: 30,
  coachFeedbackAdminEscalationEnabled: true,
  coachFeedbackAdminEscalationHours: 24,
  memberFeedbackReadyEnabled: true,
  scheduleRequestStaffEnabled: true,
  updatedAt: "",
};
const notificationPolicySettings = { ...notificationPolicyDefaults };
const notificationDeliveryState = {
  status: "idle",
  queued: 0,
  sentToday: 0,
  failed: 0,
  activeDevices: null,
  recent: [],
  checkedAt: "",
  message: "서버 현황 확인 전",
};

const coachRegistrationFlow = [
  { step: "1", title: "코치 사전 등록", detail: "관리자가 이름과 휴대전화를 먼저 등록합니다." },
  { step: "2", title: "근무·정산 설정", detail: "요일, 가능 시간, 정산 방식과 적용일을 설정합니다." },
  { step: "3", title: "본인 로그인", detail: "코치가 같은 번호가 확인된 카카오·네이버 계정으로 로그인합니다." },
  { step: "4", title: "코치모드 연결", detail: "번호가 정확히 일치할 때만 통합앱에 코치모드가 열립니다." },
];

const supabaseLiveTables = [
  { id: "branches", table: "tn_branches", label: "지점", private: false },
  { id: "products", table: "tn_membership_products", label: "회원권 상품", private: false },
  { id: "coaches", table: "tn_coach_roles", label: "코치 권한", private: true },
  { id: "lessons", table: "tn_lessons", label: "수업 일정", private: true },
  { id: "tickets", table: "tn_member_tickets", label: "회원권 보유", private: true },
  { id: "payments", table: "tn_payments", label: "결제", private: true },
  { id: "discount-policies", table: "tn_discount_policies", label: "할인권 정책", private: true },
  { id: "discount-issues", table: "tn_discount_issues", label: "할인권 발급", private: true },
  { id: "discount-redemptions", table: "tn_discount_redemptions", label: "할인권 사용", private: true },
  { id: "policy-versions", table: "tn_policy_versions", label: "운영 정책 버전", private: true },
  { id: "ticket-policy-snapshots", table: "tn_ticket_policy_snapshots", label: "회원권 정책 스냅샷", private: true },
  { id: "notice-popups", table: "tn_notice_popups", label: "공지 팝업", private: true },
];

const supabasePublicSummaryTable = "tn_app_readiness_snapshots";

const supabaseLiveState = {
  loading: false,
  loaded: false,
  items: [],
  message: "아직 확인 전입니다.",
};

const authProviderState = {
  loading: false,
  loaded: false,
  items: [],
  message: "아직 확인 전입니다.",
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
const operationsRememberStorageKey = "tennis-note-operations-remember-login";
const operationsProfileCacheStorageKey = "tennis-note-operations-profile-cache";
const ADMIN_AUTH_RECHECK_STALE_MS = 5 * 60 * 1000;
let adminAuthLastVerifiedAt = 0;
let adminConnectionRecoveryPromise = null;

function readCachedOperationsIdentity() {
  for (const storage of operationsProfileCacheStores()) {
    try {
      const cached = JSON.parse(storage.getItem(operationsProfileCacheStorageKey) || "null");
      if (cached?.user?.id && ["admin", "coach"].includes(cached?.profile?.role)) return cached;
    } catch (error) {
      try {
        storage.removeItem(operationsProfileCacheStorageKey);
      } catch (storageError) {
        // Continue to the next available storage area.
      }
    }
  }
  return null;
}

function operationsRole() {
  if (adminLocalPreviewMode) return "admin";
  return String(adminImportAuthState.profile?.role || "");
}

function operationsViewAllowed(view) {
  return operationsRole() === "admin" || coachOperationsViews.has(view);
}

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

const adminOperationalCacheDbName = "tennis-note-admin-operational-cache";
const adminOperationalCacheStoreName = "snapshots";
const adminOperationalCacheMaxAgeMs = 12 * 60 * 60 * 1000;

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

let adminOperationalCacheWriteHandle = 0;
let adminOperationalCacheWriteQueued = false;

function scheduleAdminOperationalCacheWrite() {
  if (adminOperationalCacheWriteQueued) return;
  adminOperationalCacheWriteQueued = true;
  const write = () => {
    adminOperationalCacheWriteHandle = 0;
    adminOperationalCacheWriteQueued = false;
    void writeAdminOperationalCache().catch((error) => {
      console.warn("[Tennis Note] administrator cache write skipped", error?.message || "cache_error");
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    adminOperationalCacheWriteHandle = window.requestIdleCallback(write, { timeout: 1500 });
    return;
  }
  adminOperationalCacheWriteHandle = window.setTimeout(write, 250);
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

function invalidateMemberSearchIndex({ preserveDirectory = false } = {}) {
  memberSearchIndex.clear();
  memberTicketsIndex.clear();
  ticketParticipantNamesIndex.clear();
  if (!preserveDirectory) {
    adminMemberDirectoryState.loaded = false;
    adminMemberDirectoryState.signature = "";
    adminMemberDirectoryState.rows = [];
    adminMemberDirectoryState.counts = null;
    adminMemberDirectoryState.preserveCountsWhileLoading = false;
  }
  adminMemberDetailCache.clear();
  adminUserNameIndex = null;
}

function adminMemberDetailEntry(member) {
  const userId = String(member?.serverUserId || "");
  return userId ? adminMemberDetailCache.get(userId) || null : null;
}

function adminMemberDirectoryCoachRoleId() {
  if (state.memberCoachFilter === "all") return null;
  return operationBranchCoaches().find((coach) => coach.name === state.memberCoachFilter)?.serverRoleId || null;
}

function adminMemberDirectorySignature() {
  return JSON.stringify({
    branchId: activeOperationBranchId() || null,
    status: state.memberFilter || "active",
    search: String(state.memberSearch || "").trim(),
    coachRoleId: adminMemberDirectoryCoachRoleId(),
    productKind: state.memberTicketFilter === "all" ? null : state.memberTicketFilter,
    page: Number(state.memberListPage) || 0,
    pageSize: memberListPageSize,
  });
}

function memberFromAdminDirectoryRow(row, sourceMembers = members) {
  const userId = String(row?.user_id || "");
  if (!userId) return null;
  const existing = sourceMembers.find((member) => String(member.serverUserId || "") === userId);
  if (existing) {
    existing.directoryRow = row;
    return existing;
  }
  const nextId = Math.max(1000, ...sourceMembers.map((member) => Number(member.id) || 0)) + 1;
  const status = String(row.directory_status || "expired");
  const member = {
    id: nextId,
    name: row.name || "회원",
    status,
    statusLabel: status === "active" ? "수강중" : status === "pending" ? "가입대기" : status === "journal" ? "운동노트 회원" : status === "inactive" ? "삭제회원" : "만료회원",
    memberKind: status === "journal" ? "journal_only" : status === "pending" ? "lesson_pending" : status === "active" ? "lesson_member" : "former_lesson_member",
    serverStatus: row.user_status || "active",
    serverUserId: userId,
    serverUserIds: [userId],
    branchId: row.branch_id || "",
    branchIds: row.branch_id ? [String(row.branch_id)] : [],
    phone: row.phone || "",
    photoUrl: row.profile_photo_url || "",
    coach: row.coach_name || "미배정",
    lessonType: row.product_name || "회원권 없음",
    remaining: Number(row.remaining_sessions) || 0,
    authLinked: Boolean(row.auth_user_id),
    authRole: row.user_role || "member",
    directoryRow: row,
    source: "Supabase 회원 목록",
    note: "",
  };
  members.push(member);
  return member;
}

const lessonRecordEditorState = {
  lessonId: "",
  journalId: "",
  saving: false,
};

const modeSummaries = {
  admin: {
    title: "관리자 운영판",
    subtitle: "전체 운영 흐름을 한눈에 보고 바로 처리합니다.",
    actions: ["회원 추가", "결제 등록", "시간표 조정", "리포트 확인"],
    metrics: ["오늘 수업 9개", "출석 대기 2건", "결제 대기 2건"],
  },
  coach: {
    title: "코치 전용 간단 화면",
    subtitle: "본인 수업, 출석 처리, 회원 메모만 빠르게 봅니다.",
    actions: ["내 수업 보기", "출석 처리", "회원 메모", "보강 요청 확인"],
    metrics: ["오늘 담당 2개", "확인 대기 1건", "메모 필요 1명"],
  },
  member: {
    title: "회원 앱 1차 화면",
    subtitle: "내 수업과 알림을 단순하게 확인하는 화면입니다.",
    actions: ["내 수업", "예약/변경 요청", "잔여 횟수", "알림"],
    metrics: ["다음 수업 6/30 07:00", "잔여 4회", "알림 1건"],
  },
};

const coachPreview = [
  { time: "06:40", title: "20분 슬롯", detail: "김서준 · 출석 대기" },
  { time: "07:00", title: "20분 슬롯", detail: "이하린 · 출석 대기" },
  { time: "08:00", title: "회원 메모", detail: "보강 일정 확인 필요" },
];

const memberAppPreview = [
  { label: "내 수업", value: "내일 07:00" },
  { label: "잔여 횟수", value: "4회" },
  { label: "변경 요청", value: "관리자 승인 대기" },
  { label: "알림", value: "수업 전 안내 예정" },
];

const settlements = [
  { date: "2026-06-22", sales: 53000, fee: 2073, net: 50927 },
  { date: "2026-06-15", sales: 187000, fee: 6686, net: 180314 },
  { date: "2026-06-09", sales: 41000, fee: 1374, net: 39626 },
];

const coachSettlementRules = [
  { coach: "노 코치", method: "ratio", ratio: 0.5, hourly: 0, cardBase: "cash", substitute: "actualCoach" },
  { coach: "강 코치", method: "ratio", ratio: 0.6, hourly: 0, cardBase: "cash", substitute: "actualCoach" },
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

function defaultCoachSettlementRule(coach, existingRule = null) {
  const hourlyCoach = usesHourlySettlementDefault(coach, existingRule);
  const substituteCoach = /대타|보강/.test(`${coach?.role || ""}`);
  return {
    coach: coach?.name || "새 코치",
    method: hourlyCoach ? "hourly" : "ratio",
    ratio: hourlyCoach ? 0 : newCoachSettlementSettings.regularRatio / 100,
    hourly: hourlyCoach ? (substituteCoach ? newCoachSettlementSettings.substituteHourly : newCoachSettlementSettings.weekendHourly) : 0,
    cardBase: newCoachSettlementSettings.cardBase,
    substitute: newCoachSettlementSettings.substitute,
    effectiveFrom: existingRule?.effectiveFrom || new Date().toISOString().slice(0, 10),
    serverRoleId: coach?.serverRoleId || existingRule?.serverRoleId || "",
  };
}

const coachSettlementPreview = [
  {
    member: "김서준",
    product: "주2회 개인 20분",
    paymentMethod: "카드",
    paidAmount: 165000,
    settlementBase: 150000,
    coach: "노 코치",
    actualCoach: "노 코치",
    minutes: 20,
    lessonCount: 4,
    totalLessons: 10,
    discount: "신규 10%",
  },
  {
    member: "최유나&이하린",
    product: "주2회 2대1 20분",
    paymentMethod: "현금",
    paidAmount: 180000,
    settlementBase: 180000,
    coach: "강 코치",
    actualCoach: "강 코치",
    minutes: 20,
    lessonCount: 8,
    totalLessons: 8,
    discount: "코치 할인권",
  },
  {
    member: "박민재",
    product: "대타 30분",
    paymentMethod: "카드",
    paidAmount: 198000,
    settlementBase: 180000,
    coach: "노 코치",
    actualCoach: "황 코치",
    minutes: 30,
    lessonCount: 1,
    totalLessons: 1,
    discount: "대타 이관",
  },
];

const racketMembers = [
  { name: "예약회원 A", reservations: 6, total: 200000, lastVisit: "2026.06.19", action: "테니스노트 회원권 전환 검토" },
  { name: "예약회원 B", reservations: 3, total: 27000, lastVisit: "2026.05.21", action: "결제 이력 확인" },
  { name: "예약회원 C", reservations: 9, total: 76000, lastVisit: "2026.04.21", action: "재방문 지표 반영" },
];

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

const storageKey = "tennis-note-admin-demo-v1";
const sharedStorageKey = "tennis-note-shared-demo-v1";
const paymentConfigKey = "tennis-note-payment-config";
const liveSchedulePolicyKey = "app_schedule_policy";
const operationProfiles = [];
let activeOperationProfileId = "";
const activeOperationProfileIdsByBranch = {};
let liveSchedulePolicyServerUpdatedAt = "";
const adminSecuritySettingsKey = "admin_security_v1";
const holdingPolicyKey = "holding_policy";
const notificationPolicyKey = "notification_policy_v1";
const lessonPolicySettingsKey = "lesson_policy_rules_v1";
const policyVersionSettingsKey = "membership_policy_versions_v1";
const policyVersionEditorState = {
  policyId: "",
};
const defaultMemberManagementPolicy = {
  coachCanCorrectTicket: false,
  coachCanExpireTicket: false,
  coachCanReenroll: false,
  requireAdminPin: true,
};
const memberManagementPolicy = { ...defaultMemberManagementPolicy };
let memberAdminEditEnabled = false;
let memberAdminEditExpiresAt = 0;
const memberAdminEditTimeoutMs = 15 * 60 * 1000;
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
const coachStaffEditorState = {
  coachId: "",
  mode: "edit",
  tab: "basic",
  draft: null,
  workBlocks: [],
  breakBlocks: [],
  editingBlockType: "",
  editingBlockId: "",
  message: "",
};
const coachLaneOrderEditorState = {
  roleIds: [],
  baselineRoleIds: [],
  revision: "",
  confirmed: false,
  loading: false,
  saving: false,
  message: "",
};
const adminLayoutSettingKey = "tennisnote_admin_layout_v1";
const adminLayoutLocalKey = "tennis-note-admin-layout-v1";
const adminMenuDefinitions = [
  { id: "dashboard", label: "대시보드", required: true },
  { id: "members", label: "회원관리" },
  { id: "schedule", label: "레슨시간표" },
  { id: "billing", label: "결제/정산" },
  { id: "reports", label: "경영 리포트" },
  { id: "notes", label: "기록/차감 확인" },
  { id: "issues", label: "개선·오류 접수" },
  { id: "settings", label: "운영 설정", required: true },
];
const adminDefaultMenuOrder = ["dashboard", "schedule", "members", "billing", "reports", "notes", "issues", "settings"];
const adminDefaultMoreMenus = ["reports", "notes", "issues", "settings"];
const adminLayoutPresets = {
  owner: {
    label: "대표",
    detail: "경영 리포트와 결제를 주 메뉴에서 바로 확인합니다.",
    menuOrder: ["dashboard", "reports", "billing", "schedule", "members", "notes", "issues", "settings"],
    moreMenus: ["notes", "issues", "settings"],
  },
  operations: {
    label: "운영",
    detail: "시간표·회원·결제를 먼저 두고 나머지는 더보기에 모읍니다.",
    menuOrder: [...adminDefaultMenuOrder],
    moreMenus: [...adminDefaultMoreMenus],
  },
  simple: {
    label: "간단 보기",
    detail: "대시보드·시간표·회원만 남겨 처음 쓰는 직원도 쉽게 찾습니다.",
    menuOrder: [...adminDefaultMenuOrder],
    moreMenus: ["billing", "reports", "notes", "issues", "settings"],
  },
};
const adminDashboardGroupDefinitions = [
  { id: "metrics", label: "핵심 운영 수치" },
  { id: "operations", label: "오늘 처리·회원·코치", required: true },
  { id: "lessons", label: "오늘 레슨" },
  { id: "insights", label: "공지·운영 요약" },
];
const adminDashboardWidgetDefinitions = {
  operations: [
    { id: "tasks", label: "오늘 처리할 일", required: true },
    { id: "members", label: "회원 현황" },
    { id: "coaches", label: "코치 업무" },
  ],
  insights: [
    { id: "notices", label: "공지·알림" },
    { id: "reports", label: "운영 요약" },
  ],
};
const adminReportWidgetDefinitions = [
  { id: "summary", label: "경영 핵심 수치", required: true, defaultSize: "full" },
  { id: "members", label: "회원 흐름", defaultSize: "two" },
  { id: "quality", label: "피드백·출석", defaultSize: "two" },
  { id: "finance", label: "재무 자료 상태", required: true, defaultSize: "full" },
  { id: "sources", label: "리포트 개발 순서", defaultSize: "full" },
];
const adminReportWidgetSizeOptions = [
  { id: "one", label: "1칸" },
  { id: "two", label: "2칸" },
  { id: "full", label: "전체" },
];
const adminReportWidgetFilterOptions = [
  { id: "all", label: "전체" },
  { id: "attention", label: "확인 필요만" },
];

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
const adminPinHashVersion = "tn-admin-lock-v1";
const legacyDefaultAdminPin = "0000";
const legacyDefaultAdminPinHashes = new Set([
  "sha256:978bb3994627910cf4f1e9625928d86e9e0528bd13fba23620399a4ae7098249",
  "fnv1a:526e18f3",
]);
const defaultAdminLockSettings = {
  enabled: false,
  pinHash: "",
  legacyPin: "",
  pinConfigured: false,
  timeoutMinutes: 30,
  lockedViews: [],
  pastAbsenceRequirePinEveryTime: false,
};
const adminLockSettings = { ...defaultAdminLockSettings, lockedViews: [...defaultAdminLockSettings.lockedViews] };
let adminSecurityDraft = null;
let adminSecurityModeOverride = "";
let adminSecuritySaveState = { status: "idle", savedAt: "" };
const adminLockSession = {
  unlockedUntil: 0,
  pendingView: "",
  pendingAction: "",
  pendingLabel: "",
  oneTimeGrant: "",
  error: "",
  afterUnlock: null,
};
const adminLockViewOptions = [
  { id: "schedule", label: "레슨시간표", detail: "수업 추가, 변경, 삭제, 상태 보정" },
  { id: "billing", label: "결제/정산", detail: "결제 확인, 수동 충전, 코치 정산" },
  { id: "data", label: "엑셀·백업", detail: "엑셀 업로드, 전체 내보내기, 백업" },
  { id: "settings", label: "운영 설정", detail: "수업 정책, 회원권 규정, 관리자 보안" },
  { id: "notes", label: "기록/차감 확인", detail: "수업 완료, 횟수 차감, 코치 코멘트" },
  { id: "members", label: "회원관리", detail: "회원 상세, 회원권 상태, NTRP" },
  { id: "issues", label: "개선·오류 접수", detail: "접수 상태 변경과 운영 오류 기록" },
];
const adminSecurityPresets = {
  transition: {
    label: "과도기 운영",
    detail: "로그인은 유지하고 추가 PIN 없이 운영합니다.",
    enabled: false,
    timeoutMinutes: 30,
    lockedViews: [],
    pastAbsenceRequirePinEveryTime: false,
  },
  protected: {
    label: "중요 메뉴 보호",
    detail: "결제·데이터·운영 설정만 PIN으로 보호합니다.",
    enabled: true,
    timeoutMinutes: 15,
    lockedViews: ["billing", "data", "settings"],
    pastAbsenceRequirePinEveryTime: true,
  },
};
const defaultPopupNotice = {
  id: "notice-new",
  title: "새 공지",
  body: "공지 내용을 입력해 주세요.",
  audience: "all",
  status: "disabled",
  priority: "normal",
  startDate: "",
  endDate: "",
  showOncePerDay: true,
  displayOrder: 10,
  imageUrl: "",
  imageStoragePath: "",
  imageAlt: "",
  actionLabel: "",
  actionUrl: "",
  updatedAt: "",
  updatedBy: "admin",
};
const noticeMediaBucket = "tennisnote-notice-media";
let noticeImageDraftFile = null;
let noticeImageDraftUrl = "";
let noticeImageRemoveRequested = false;
const importTemplateColumns = [
  "구분",
  "회원명",
  "연락처",
  "동반회원명",
  "동반연락처",
  "상태",
  "담당코치",
  "회원권명",
  "수업분",
  "주횟수",
  "총횟수",
  "사용횟수",
  "잔여횟수",
  "결제일",
  "결제수단",
  "결제금액",
  "정규요일1",
  "정규시간1",
  "정규요일2",
  "정규시간2",
  "메모",
];
const importWorkbookVersion = "2.1";
const supportedImportWorkbookVersions = new Set(["2.0", importWorkbookVersion]);
const importGuideSheetName = "작성안내";
const importMemberSheetName = "회원DB";
const importScheduleSheetName = "정규시간표";
const importReviewSheetName = "검토대기";
const importPaymentReviewSheetName = "결제검토";
const importVisibleMemberColumns = [
  "회원명",
  "연락처",
  "출생연도",
  "거주동",
  "성별",
  "회원상태",
  "담당코치",
  "회원권명",
  "레슨시작일",
  "총횟수",
  "소진횟수",
  "결제일",
  "결제수단",
  "결제금액",
  "파트너연락처",
  "비고",
];
const importAutomaticMemberColumns = [
  "원본번호",
  "지점명",
  "적용방식",
  "레슨방식",
  "레슨종류",
  "파트너원본번호",
  "만료일",
  "잔여횟수",
  "결제상태",
];
const importMemberColumns = [...importVisibleMemberColumns, ...importAutomaticMemberColumns];
const importScheduleColumns = [
  "시간표원본번호",
  "회원원본번호",
  "수업일",
  "시작시간",
  "수업분",
  "상태",
  "메모",
];
const requiredImportMemberColumns = [
  "원본번호",
  "회원명",
  "연락처",
  "출생연도",
  "성별",
  "회원상태",
  "담당코치",
];
const requiredActiveImportMemberColumns = [
  "회원권명",
  "레슨방식",
  "레슨종류",
  "레슨시작일",
  "총횟수",
  "소진횟수",
  "잔여횟수",
];
const requiredImportColumns = ["회원명", "담당코치", "회원권명", "총횟수", "사용횟수", "잔여횟수"];
const numericImportColumns = ["수업분", "주횟수", "총횟수", "사용횟수", "잔여횟수", "결제금액"];
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

function operationalSharedData() {
  const shared = loadSharedData();
  if (adminDemoMode) return shared;
  return {
    ...shared,
    lessonLogs: [],
    feedbackRequests: [],
    ntrpRequests: [],
    paymentRequests: [],
    makeupRequests: [],
    holdingRequests: shared.holdingRequests.filter((item) => item.source === "server"),
  };
}

function prepareAdminLiveMode() {
  if (adminDemoMode) return;
  [coaches, members, lessons, makeupRequests, tickets, expiredTickets, billings, billingLogs, groupAccounts, lessonNotes]
    .forEach((items) => replaceArray(items, []));
  Object.assign(state, {
    selectedMemberId: null,
    liveScheduleLoaded: false,
    liveScheduleLoading: true,
    liveScheduleMessage: "관리자 로그인 후 실데이터를 불러옵니다.",
  });
}

function fallbackAdminPinHash(value) {
  const text = `${adminPinHashVersion}:${value || ""}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
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

function currentAdminSecurityDraft() {
  if (!adminSecurityDraft) adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  return adminSecurityDraft;
}

function adminSecurityIsDirty() {
  const draft = currentAdminSecurityDraft();
  const saved = adminSecurityConfigPayload();
  return draft.enabled !== saved.enabled
    || draft.timeoutMinutes !== saved.timeoutMinutes
    || draft.pastAbsenceRequirePinEveryTime !== saved.pastAbsenceRequirePinEveryTime
    || draft.lockedViews.length !== saved.lockedViews.length
    || draft.lockedViews.some((view) => !saved.lockedViews.includes(view));
}

function adminSecurityMode(source = currentAdminSecurityDraft()) {
  if (adminSecurityModeOverride === "custom") return "custom";
  const payload = adminSecurityConfigPayload(source);
  return Object.entries(adminSecurityPresets).find(([, preset]) => (
    payload.enabled === preset.enabled
    && payload.timeoutMinutes === preset.timeoutMinutes
    && payload.pastAbsenceRequirePinEveryTime === preset.pastAbsenceRequirePinEveryTime
    && payload.lockedViews.length === preset.lockedViews.length
    && payload.lockedViews.every((view) => preset.lockedViews.includes(view))
  ))?.[0] || "custom";
}

function adminPinNeedsSetup() {
  const pinHash = `${adminLockSettings.pinHash || ""}`.trim();
  const legacyPin = `${adminLockSettings.legacyPin || ""}`.trim();
  return (!pinHash && !legacyPin && !adminLockSettings.pinConfigured) || legacyPin === legacyDefaultAdminPin || legacyDefaultAdminPinHashes.has(pinHash);
}

function adminLockViewName(view) {
  return adminLockViewOptions.find((item) => item.id === view)?.label || "관리자 영역";
}

function isAdminLockActive() {
  return Boolean(adminLockSettings.enabled);
}

function isAdminViewLocked(view) {
  return isAdminLockActive() && !adminPinNeedsSetup() && adminLockSettings.lockedViews.includes(view);
}

function isAdminUnlocked() {
  return !isAdminLockActive() || Date.now() < Number(adminLockSession.unlockedUntil || 0);
}

function adminUnlockRemainingText() {
  if (!isAdminUnlocked() || !adminLockSettings.enabled) return "잠김";
  const remainingMs = Math.max(0, Number(adminLockSession.unlockedUntil || 0) - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${minutes}분 남음`;
}

function lockAdminNow() {
  adminLockSession.unlockedUntil = 0;
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.oneTimeGrant = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = null;
  if (isAdminViewLocked(state.view)) setView("dashboard", { skipLock: true });
}

function consumeAdminActionGrant(action) {
  if (!action || adminLockSession.oneTimeGrant !== action) return false;
  adminLockSession.oneTimeGrant = "";
  return true;
}

function requestAdminActionUnlock(action, label, afterUnlock) {
  if (!isAdminLockActive() || !adminLockSettings.pastAbsenceRequirePinEveryTime) return true;
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("보안/잠금에서 관리자 PIN을 먼저 설정해 주세요");
    return false;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = action;
  adminLockSession.pendingLabel = label;
  adminLockSession.error = "";
  adminLockSession.afterUnlock = typeof afterUnlock === "function" ? afterUnlock : null;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
  return false;
}

function requestAdminUnlock(view, afterUnlock = null) {
  if (!isAdminLockActive() || !adminLockSettings.lockedViews.includes(view)) return true;
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    if (view === "settings") return true;
    setView("settings", { skipLock: true });
    renderSettingsTabs();
    showToast("먼저 보안/잠금에서 관리자 PIN을 설정해 주세요");
    return false;
  }
  if (!isAdminViewLocked(view) || isAdminUnlocked()) return true;
  adminLockSession.pendingView = view;
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = typeof afterUnlock === "function" ? afterUnlock : null;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
  return false;
}

function avatarMarkup(person, className = "") {
  const photoUrl = person?.photoUrl?.trim();
  const name = person?.name || person?.member || "";
  return `<span class="profile-avatar ${className} ${photoUrl ? "has-photo" : "is-empty"}" aria-label="${escapeHtml(photoUrl ? `${name} 프로필 사진` : "기본 프로필 이미지")}">
    <span class="profile-avatar-placeholder" aria-hidden="true"></span>
    ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)} 프로필 사진" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('is-empty');this.remove()" />` : ""}
  </span>`;
}

function inferCoachIdForMember(memberName) {
  const member = members.find((item) => item.name === memberName);
  if (!member) return coaches.find((coach) => coach.status === "active")?.id || "coach-no";
  return coaches.find((coach) => member.coach.includes(coach.name.replace(" 코치", "")))?.id || coaches.find((coach) => coach.name === member.coach)?.id || "coach-no";
}

function normalizeDemoData() {
  if (state.scheduleFilter === "available") state.scheduleFilter = "all";
  if (state.view === "rackettime" || state.view === "community") state.view = "dashboard";
  if (state.view === "tickets") state.view = "members";
  if (state.view === "makeup") state.view = "schedule";
  if (state.view === "import" || state.view === "data") state.view = "members";
  if (!["operation", "membership", "notifications", "coach", "layout", "security"].includes(state.settingsTab)) state.settingsTab = "operation";
  if (!["active", "expiring", "expired", "pending", "inactive"].includes(state.memberFilter)) state.memberFilter = "active";
  if (!coaches.some((coach) => coach.id === "coach-park")) {
    coaches.push({ id: "coach-park", name: "박창준 코치", role: "주말 레슨", status: "active", account: "박창준", coachMode: "approved", availability: "weekend", photoUrl: "" });
  }
  coaches.forEach((coach) => {
    if (coach.id === "coach-machine") coach.status = "inactive";
    if (typeof coach.photoUrl !== "string") coach.photoUrl = "";
    if (!coach.availability) coach.availability = coach.id === "coach-hwang" ? "weekday-am" : coach.id === "coach-kang" ? "weekday-pm" : coach.id === "coach-park" ? "weekend" : "split";
    const availability = getCoachAvailabilityDefaults(coach);
    if (!Array.isArray(coach.availableDays) || !coach.availableDays.length) coach.availableDays = availability.days;
    if (!coach.availableStart) coach.availableStart = availability.start;
    if (!coach.availableEnd) coach.availableEnd = availability.end;
    normalizeCoachWorkBlocks(coach);
    ensureCoachSettlementRule(coach);
  });
  members.forEach((member) => {
    if (typeof member.photoUrl !== "string") member.photoUrl = "";
  });
  for (let index = lessons.length - 1; index >= 0; index -= 1) {
    if (lessons[index].status === "available" || lessons[index].coachId === "coach-machine") lessons.splice(index, 1);
  }
  lessons.forEach((lesson) => {
    if (lesson.day === "토" || lesson.day === "일") lesson.coachId = "coach-park";
  });
  scheduleWeeks.forEach((week) => {
    week.lessons?.forEach((lesson) => {
      if (lesson.day === "토" || lesson.day === "일") lesson.coachId = "coach-park";
    });
  });
  lessons.forEach((lesson, index) => {
    if (!lesson.courtId) lesson.courtId = `court-${(index % fixedCourtCount) + 1}`;
  });
  tickets.forEach((ticket, index) => {
    if (!ticket.id) ticket.id = `ticket-${ticket.member}-${index}`.replace(/\s+/g, "-");
    if (!ticket.coachId) ticket.coachId = inferCoachIdForMember(ticket.member);
    if (ticket.member === "박민재" && ticket.product?.includes("황 코치 주 1회 개인 30분")) {
      ticket.coachId = "coach-park";
      ticket.product = "박창준 코치 주 1회 개인 30분";
    }
    if (!ticket.weeklyCount) ticket.weeklyCount = getTicketWeeklyCount(ticket);
    delete ticket.partner;
    delete ticket.groupPartner;
  });
  billings.forEach((billing) => {
    if (billing.method === "청구서") billing.method = "결제요청";
    if (billing.note?.includes("청구")) billing.note = billing.note.replaceAll("청구", "결제요청");
  });
  [
    { id: "ticket-seojun-no-pair-a", member: "김서준&이하린", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 3, remaining: 5, expires: "2026-07-25", lessonKind: "2대1" },
    { id: "ticket-seojun-no-pair-b", member: "김서준&최유나", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 1, remaining: 7, expires: "2026-08-01", lessonKind: "2대1" },
    { id: "ticket-harin-kang", member: "이하린&최유나", coachId: "coach-kang", product: "강 코치 주 2회 그룹 20분", weeklyCount: 2, total: 8, used: 7, remaining: 1, expires: "2026-07-04", lessonKind: "그룹" },
  ].forEach((requiredTicket) => {
    const ticket = tickets.find((item) => item.id === requiredTicket.id);
    if (ticket) Object.assign(ticket, requiredTicket);
    else tickets.push(requiredTicket);
  });
  tickets.forEach((ticket) => {
    if (!ticket.member.includes("&") || members.some((member) => member.name === ticket.member)) return;
    members.push({
      id: Date.now() + members.length,
      name: ticket.member,
      status: "active",
      statusLabel: "수강중",
      coach: getCoachName(ticket.coachId),
      regularTime: "팀 수업",
      remaining: ticket.remaining,
      lessonType: ticket.product,
      source: "수강권",
      note: "2대1/그룹 수업용 팀 회원",
      photoUrl: "",
    });
  });
  lessons.forEach((lesson) => {
    if (lesson.partner) {
      lesson.member = `${lesson.member}&${lesson.partner}`;
      delete lesson.partner;
      delete lesson.partnerLinked;
      delete lesson.partnerNotification;
    }
    if (lesson.member === "이하린" && lesson.type?.includes("그룹")) {
      lesson.member = "이하린&최유나";
      lesson.ticketId = "ticket-harin-kang";
    }
    if (lesson.id === 5) Object.assign(lesson, { type: "보강 요청", status: "pending", makeup: true });
    if (lesson.id === 6) Object.assign(lesson, { type: "보강", status: "scheduled", makeup: true });
    if (lesson.id === 7) Object.assign(lesson, { type: "보강 요청", status: "pending", makeup: true });
  });
  lessons.forEach((lesson) => {
    if (!lesson.ticketId) {
      const ticket = getTicketByLesson(lesson);
      if (ticket) lesson.ticketId = ticket.id;
    }
    if (lesson.ticketId) {
      const ticket = tickets.find((item) => item.id === lesson.ticketId);
      if (ticket?.member?.includes("&")) lesson.member = ticket.member;
    }
  });
  scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => !["break-weekday-a", "break-weekday-b"].includes(rule.id));
}

let adminSnapshotSaveHandle = 0;
let adminSnapshotSaveQueued = false;

function flushSnapshotSave() {
  if (adminSnapshotSaveHandle) {
    if (typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(adminSnapshotSaveHandle);
    } else {
      window.clearTimeout(adminSnapshotSaveHandle);
    }
  }
  adminSnapshotSaveHandle = 0;
  adminSnapshotSaveQueued = false;
  return writeSnapshotNow();
}

function currentOperationCoachPolicies(allCoaches = coaches) {
  return allCoaches.map((coach) => ({
    id: coach.id,
    serverRoleId: coach.serverRoleId || "",
    branchId: coach.branchId || "",
    name: coach.name,
    status: coach.status || "active",
    employmentStatus: coach.employmentStatus || "active",
    archivedAt: coach.archivedAt || "",
    deletedAt: coach.deletedAt || "",
    color: coach.color || "",
    availableDays: cloneOperationProfileValue(Array.isArray(coach.availableDays) ? coach.availableDays : []),
    availableStart: coach.availableStart || "",
    availableEnd: coach.availableEnd || "",
    workBlocks: cloneOperationProfileValue((coach.status || "active") === "active" ? normalizeCoachWorkBlocks(coach) : []),
    breakBlocks: cloneOperationProfileValue((coach.status || "active") === "active" ? normalizeCoachBreakBlocks(coach) : []),
  }));
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

function operationBranchTickets(source = tickets) {
  return source.filter((ticket) => matchesActiveOperationBranch(ticket.branchId));
}

function operationBranchLessons(source = lessons) {
  return source.filter((lesson) => matchesActiveOperationBranch(lesson.branchId));
}

function operationBranchCoaches(source = coaches) {
  return source.filter((coach) => matchesActiveOperationBranch(coach.branchId));
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

function operationBranchMembers(source = members) {
  const activeBranchId = activeOperationBranchId();
  if (!activeBranchId) return source;
  return source.filter((member) => {
    const branchIds = memberOperationBranchIds(member);
    return branchIds.length
      ? branchIds.includes(activeBranchId)
      : operationBranchAllowsLegacyRows();
  });
}

function operationBranchMakeupRequests(source = makeupRequests) {
  return source.filter((request) => {
    if (request.branchId) return matchesActiveOperationBranch(request.branchId);
    const lesson = lessons.find((item) => String(item.serverLessonId || item.id) === String(request.lessonId || request.sourceLessonId || ""));
    return lesson ? matchesActiveOperationBranch(lesson.branchId) : operationBranchAllowsLegacyRows();
  });
}

function operationBranchBillings(source = billings) {
  return source.filter((billing) => {
    if (billing.branchId) {
      if (matchesActiveOperationBranch(billing.branchId)) return true;
      if (billing.serverPaymentId && operationBranchAllowsLegacyRows()) return true;
      return false;
    }
    const ticket = [...tickets, ...expiredTickets].find((item) => (
      String(item.serverTicketId || item.id) === String(billing.ticketId || "")
    ));
    if (ticket) return matchesActiveOperationBranch(ticket.branchId);
    const product = (adminLiveDataState.products || []).find((item) => (
      String(item.id) === String(billing.productId || "")
    ));
    if (product?.branch_id) return matchesActiveOperationBranch(product.branch_id);
    const member = members.find((item) => (
      (billing.serverUserId && memberServerUserIds(item).includes(billing.serverUserId))
      || item.name === billing.member
    ));
    return member ? operationBranchMembers([member]).length > 0 : operationBranchAllowsLegacyRows();
  });
}

function operationBranchRecords(source = []) {
  const lessonsById = new Map();
  lessons.forEach((lesson) => {
    if (lesson.id) lessonsById.set(String(lesson.id), lesson);
    if (lesson.serverLessonId) lessonsById.set(String(lesson.serverLessonId), lesson);
  });
  const allowedMemberNames = new Set(operationBranchMembers(members).map((member) => member.name));
  return source.filter((record) => {
    if (record.branchId) return matchesActiveOperationBranch(record.branchId);
    const lessonId = record.serverLessonId || record.lessonId;
    const lesson = lessonId ? lessonsById.get(String(lessonId)) : null;
    if (lesson) return matchesActiveOperationBranch(lesson.branchId);
    const memberNames = splitMemberNames(record.member || "");
    if (memberNames.length) {
      return memberNames.some((name) => allowedMemberNames.has(name));
    }
    return operationBranchAllowsLegacyRows();
  });
}

function membershipProductsForActiveOperationProfile() {
  const branchId = activeOperationBranchId();
  if (!branchId) return membershipProductDrafts;
  return membershipProductDrafts.filter((product) => !product.branchId || String(product.branchId) === branchId);
}

function operationProfileWorkspaceBackup() {
  ensureOperationProfiles();
  updateActiveOperationProfileFromCurrent();
  return {
    profiles: cloneOperationProfileValue(operationProfiles),
    activeId: activeOperationProfileId,
    activeIdsByBranch: cloneOperationProfileValue(activeOperationProfileIdsByBranch),
    scheduleSettings: currentOperationScheduleSettings(),
    coaches: currentOperationCoachPolicies(),
  };
}

function liveSchedulePolicyPayload() {
  ensureOperationProfiles();
  updateActiveOperationProfileFromCurrent();
  return {
    version: 5,
    updatedAt: new Date().toISOString(),
    activeOperationProfileId,
    activeOperationProfileIdsByBranch: cloneOperationProfileValue(activeOperationProfileIdsByBranch),
    operationProfiles: cloneOperationProfileValue(operationProfiles),
    scheduleSettings: {
      openStart: scheduleSettings.openStart,
      openEnd: scheduleSettings.openEnd,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : [],
      breakFavorites: Array.isArray(scheduleSettings.breakFavorites) ? scheduleSettings.breakFavorites : [],
      lessonColors: scheduleSettings.lessonColors,
      lessonColorRules: scheduleSettings.lessonColorRules,
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
      memberScheduleRequestOnly: scheduleSettings.memberScheduleRequestOnly !== false,
      adminTuningMode: scheduleSettings.adminTuningMode === true,
    },
    coaches: coaches.map((coach) => ({
      id: coach.id,
      serverRoleId: coach.serverRoleId || "",
      branchId: coach.branchId || "",
      name: coach.name,
      status: coach.status || "active",
      employmentStatus: coach.employmentStatus || "active",
      archivedAt: coach.archivedAt || "",
      deletedAt: coach.deletedAt || "",
      color: coach.color || "",
      availableDays: Array.isArray(coach.availableDays) ? coach.availableDays : [],
      availableStart: coach.availableStart || "",
      availableEnd: coach.availableEnd || "",
      workBlocks: (coach.status || "active") === "active" ? normalizeCoachWorkBlocks(coach) : [],
      breakBlocks: (coach.status || "active") === "active" ? normalizeCoachBreakBlocks(coach) : [],
    })),
  };
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = new Intl.NumberFormat("ko-KR");

function normalizePopupNotice(notice = {}) {
  const fallback = defaultPopupNotice;
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status)
    ? notice.status
    : fallback.status;
  return {
    ...fallback,
    ...notice,
    id: notice.id || fallback.id,
    title: String(notice.title || fallback.title).trim(),
    body: String(notice.body || fallback.body).trim(),
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : fallback.audience,
    status: normalizedStatus,
    priority: ["normal", "important", "urgent"].includes(notice.priority) ? notice.priority : fallback.priority,
    startDate: notice.startDate || "",
    endDate: notice.endDate || "",
    showOncePerDay: notice.showOncePerDay !== false,
    displayOrder: Math.max(0, Number(notice.displayOrder ?? notice.display_order) || fallback.displayOrder),
    imageUrl: String(notice.imageUrl || notice.image_url || "").trim(),
    imageStoragePath: String(notice.imageStoragePath || notice.image_storage_path || "").trim(),
    imageAlt: String(notice.imageAlt || notice.image_alt || "").trim(),
    actionLabel: String(notice.actionLabel || notice.action_label || "").trim(),
    actionUrl: String(notice.actionUrl || notice.action_url || "").trim(),
    updatedAt: notice.updatedAt || new Date().toISOString(),
    updatedBy: notice.updatedBy || "admin",
  };
}

function noticeRowToAppNotice(row = {}) {
  return normalizePopupNotice({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    priority: row.priority,
    startDate: row.starts_on || "",
    endDate: row.ends_on || "",
    showOncePerDay: row.show_once_per_day !== false,
    displayOrder: row.display_order,
    imageUrl: row.image_url || "",
    imageStoragePath: row.image_storage_path || "",
    imageAlt: row.image_alt || "",
    actionLabel: row.action_label || "",
    actionUrl: row.action_url || "",
    updatedAt: row.updated_at || row.created_at || "",
    updatedBy: "server",
  });
}

function appNoticeToDbRow(notice = {}) {
  const normalized = normalizePopupNotice(notice);
  return {
    title: normalized.title,
    body: normalized.body,
    audience: normalized.audience,
    priority: normalized.priority,
    status: normalized.status,
    starts_on: normalized.startDate || null,
    ends_on: normalized.endDate || null,
    show_once_per_day: normalized.showOncePerDay !== false,
    display_order: normalized.displayOrder,
    image_url: normalized.imageUrl || null,
    image_storage_path: normalized.imageStoragePath || null,
    image_alt: normalized.imageAlt || null,
    action_label: normalized.actionLabel || null,
    action_url: normalized.actionUrl || null,
  };
}

function popupNotices() {
  const shared = loadSharedData();
  return (Array.isArray(shared.notices) ? shared.notices : [])
    .map((notice) => normalizePopupNotice(notice))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function currentPopupNotice() {
  const savedNotices = popupNotices();
  return savedNotices.find((notice) => notice.status === "active")
    || savedNotices.find((notice) => notice.status === "disabled")
    || defaultPopupNotice;
}

function editingPopupNotice() {
  const selectedId = state.noticeEditingId || "";
  if (state.noticeDraft?.id === selectedId) return normalizePopupNotice(state.noticeDraft);
  return popupNotices().find((notice) => notice.id === selectedId)
    || currentPopupNotice();
}

function writePopupNotice(notice) {
  const shared = loadSharedData();
  const normalized = normalizePopupNotice({
    ...notice,
    updatedAt: new Date().toISOString(),
    updatedBy: "admin",
  });
  const previous = (shared.notices || []).filter((item) => item.id !== normalized.id);
  shared.notices = [normalized, ...previous]
    .map((item) => normalizePopupNotice(item))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 100);
  saveSharedData(shared);
  state.noticeDraft = null;
  state.noticeEditingId = normalized.id;
  return normalized;
}

const authUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAuthUuid(value = "") {
  return authUuidPattern.test(String(value).trim());
}

let branchPaymentAccount = null;
let branchPaymentAccountStatus = "idle";
const bankNotificationStatusState = {
  status: "idle",
  devices: [],
  reviewEvents: [],
  accountHistory: [],
  message: "",
};

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

const branchSalesSettingsState = {
  status: "idle",
  branchId: "",
  version: 0,
  appliedAt: "",
  appliedConfig: defaultBranchSalesConfig(),
  draftConfig: defaultBranchSalesConfig(),
  message: "",
};

function isPaymentGatewayReady() {
  const config = paymentGatewayConfig();
  return Boolean(config.storeId && config.channelKey);
}

function normalizeMembershipProduct(product = {}, fallback = {}) {
  const merged = { ...fallback, ...product };
  const title = String(merged.title || merged.name || "회원권").replaceAll("횟수권", "쿠폰제");
  const amount = numericValue(merged.amount, numericValue(fallback.amount));
  const listAmount = numericValue(merged.listAmount, numericValue(fallback.listAmount));
  const settlementBase = numericValue(
    merged.settlementBase,
    numericValue(merged.cashAmount, amount),
  );
  const tickets = numericValue(merged.tickets, numericValue(fallback.tickets));
  const cashAmount = numericValue(merged.cashAmount, numericValue(fallback.cashAmount, settlementBase || amount));
  const cardAmount = numericValue(merged.cardAmount, numericValue(fallback.cardAmount, cashAmount));
  const validityDays = numericValue(merged.validityDays, numericValue(fallback.validityDays, merged.mode === "fixed" ? 30 : 60));
  const graceDays = numericValue(merged.graceDays, numericValue(fallback.graceDays, merged.mode === "fixed" ? 14 : 7));
  const rawProductKind = merged.productKind || (merged.mode === "coupon" || merged.mode === "pass" ? "coupon" : "regular");
  const productKind = ["coupon", "pass"].includes(rawProductKind) ? "coupon" : "regular";
  return {
    ...merged,
    id: merged.id || `product-${Date.now()}`,
    group: String(merged.group || fallback.group || "회원권").replaceAll("횟수권", "쿠폰제"),
    title,
    name: String(merged.name || title).replaceAll("횟수권", "쿠폰제"),
    detail: String(merged.detail || merged.format || fallback.detail || "관리자 설정 회원권").replaceAll("횟수권", "쿠폰제"),
    format: merged.format || fallback.format || "회원권",
    sessions: merged.sessions || `${tickets || 0}회`,
    rule: merged.rule || fallback.rule || "코치별 회원권으로 관리합니다.",
    listAmount,
    amount,
    settlementBase,
    tickets,
    cardAmount,
    cashAmount,
    validityDays,
    graceDays,
    maxSessionsPerDay: numericValue(merged.maxSessionsPerDay, numericValue(fallback.maxSessionsPerDay, 0)),
    maxSessionsPerWeek: numericValue(merged.maxSessionsPerWeek, numericValue(fallback.maxSessionsPerWeek, 0)),
    maxBookingDaysPerWeek: numericValue(merged.maxBookingDaysPerWeek, numericValue(fallback.maxBookingDaysPerWeek, 0)),
    purchaseExperience: merged.purchaseExperience || fallback.purchaseExperience || "",
    firstLessonOfferEnabled: merged.firstLessonOfferEnabled ?? fallback.firstLessonOfferEnabled ?? false,
    firstLessonOfferPrice: numericValue(
      merged.firstLessonOfferPrice,
      numericValue(fallback.firstLessonOfferPrice, 15000),
    ),
    threeMonthDiscountRate: Math.max(0, Math.min(90, Number(merged.threeMonthDiscountRate ?? fallback.threeMonthDiscountRate ?? 10))),
    threeMonthPriceMode: ["automatic", "manual"].includes(String(merged.threeMonthPriceMode || fallback.threeMonthPriceMode || "automatic"))
      ? String(merged.threeMonthPriceMode || fallback.threeMonthPriceMode || "automatic")
      : "automatic",
    coachSaleAvailability: merged.coachSaleAvailability && typeof merged.coachSaleAvailability === "object"
      ? { ...merged.coachSaleAvailability }
      : fallback.coachSaleAvailability && typeof fallback.coachSaleAvailability === "object" ? { ...fallback.coachSaleAvailability } : {},
    coachSaleMode: String(merged.coachSaleMode || fallback.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active",
    groupDeductionPolicy: merged.groupDeductionPolicy
      || merged.group_deduction_policy
      || fallback.groupDeductionPolicy
      || fallback.group_deduction_policy
      || "shared_once",
    productKind,
    discountEnabled: merged.discountEnabled ?? fallback.discountEnabled ?? true,
    coachDiscountAllowed: merged.coachDiscountAllowed ?? fallback.coachDiscountAllowed ?? false,
    coach: merged.coach || fallback.coach || "선택 코치 전용",
    flow: merged.flow || fallback.flow || "시간 선택 → 회원권 선택 → 결제",
    mode: productKind === "coupon" ? "pass" : "fixed",
    discount: merged.discount || fallback.discount || "관리자 설정 기준 적용",
    badge: merged.badge || fallback.badge || "회원권",
    status: merged.status || fallback.status || "sale",
  };
}

function membershipProductDraftFromServer(product = {}) {
  const productKind = product.product_kind === "coupon" || product.is_coupon ? "coupon" : "regular";
  const scheduleScope = ["weekday", "weekend", "mixed"].includes(product.schedule_scope) ? product.schedule_scope : "weekday";
  const groupSize = Number(product.group_size) || 1;
  const lessonMinutes = Number(product.lesson_minutes) || 20;
  const tickets = Number(product.total_sessions) || 1;
  const cashAmount = Number(product.cash_price) || Number(product.base_price) || 0;
  const cardAmount = Number(product.card_price) || cashAmount;
  const savedStatus = product.policy_settings?.adminSaleStatus;
  const status = ["sale", "consult", "hidden"].includes(savedStatus)
    ? savedStatus
    : product.is_active === false ? "hidden" : "sale";
  return normalizeMembershipProduct({
    id: product.product_code || `server-${product.id}`,
    serverProductId: product.id,
    serverProductCode: product.product_code || "",
    purchaseExperience: product.policy_settings?.purchaseExperience || (String(product.product_code || "").startsWith("one-day-") ? "one_day" : ""),
    firstLessonOfferEnabled: product.policy_settings?.firstLessonOfferEnabled === true,
    firstLessonOfferPrice: Number(product.policy_settings?.firstLessonOfferPrice) || 15000,
    threeMonthDiscountRate: Number(product.policy_settings?.threeMonthDiscountRate ?? 10),
    threeMonthPriceMode: product.policy_settings?.threeMonthPriceMode || "automatic",
    coachSaleAvailability: product.policy_settings?.coachSaleAvailability || {},
    coachSaleMode: product.policy_settings?.coachSaleMode === "selected" ? "selected" : "all_active",
    branchId: product.branch_id || "",
    branchName: operationBranchOptions().find((branch) => branch.id === String(product.branch_id || ""))?.name || "",
    group: `${scheduleScope === "mixed" ? "혼합" : scheduleScope === "weekend" ? "주말" : "평일"} ${productKind === "coupon" ? "쿠폰제" : "정규권"}`,
    title: product.name || "회원권",
    name: product.name || "회원권",
    format: `${groupSize === 2 ? "2대1" : "1대1"} · ${lessonMinutes}분`,
    sessions: product.policy_settings?.countLabel || `${tickets}회`,
    tickets,
    amount: cashAmount,
    listAmount: cardAmount,
    cardAmount,
    cashAmount,
    settlementBase: Number(product.settlement_base_price) || cashAmount,
    validityDays: Number(product.validity_days) || 1,
    graceDays: Number(product.grace_days) || 0,
    lessonMinutes,
    groupSize,
    frequencyPerWeek: Number(product.frequency_per_week) || 0,
    scheduleScope,
    termWeeks: Number(product.term_weeks) || 0,
    maxSessionsPerDay: Number(product.max_sessions_per_day) || 0,
    maxSessionsPerWeek: Number(product.max_sessions_per_week) || 0,
    maxBookingDaysPerWeek: Number(product.max_booking_days_per_week) || 0,
    productKind,
    isCoupon: Boolean(product.is_coupon),
    discountEnabled: product.discount_enabled !== false,
    coachDiscountAllowed: product.coach_discount_allowed === true,
    sortOrder: Number(product.display_order) || 0,
    mode: productKind === "coupon" ? "pass" : groupSize === 2 ? "group" : "fixed",
    status,
    rule: "실서버 회원권 상품과 회원 등록 화면에 함께 반영됩니다.",
  });
}

function membershipProductsForMemberApp() {
  return membershipProductDrafts.map((product) => {
    const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
    return {
      id: normalized.id,
      productCode: normalized.serverProductCode || normalized.productCode || normalized.id,
      purchaseExperience: normalized.purchaseExperience || "",
      firstLessonOfferEnabled: normalized.firstLessonOfferEnabled === true,
      firstLessonOfferPrice: normalized.firstLessonOfferPrice,
      threeMonthDiscountRate: normalized.threeMonthDiscountRate,
      threeMonthPriceMode: normalized.threeMonthPriceMode,
      coachSaleAvailability: normalized.coachSaleAvailability,
      group: normalized.group,
      title: normalized.title,
      name: normalized.name,
      detail: normalized.detail,
      listAmount: normalized.listAmount,
      amount: normalized.status === "consult" ? 0 : normalized.amount,
      settlementBase: normalized.settlementBase,
      tickets: normalized.tickets,
      cardAmount: normalized.cardAmount,
      cashAmount: normalized.cashAmount,
      validityDays: normalized.validityDays,
      graceDays: normalized.graceDays,
      lessonMinutes: normalized.lessonMinutes,
      groupSize: normalized.groupSize,
      frequencyPerWeek: normalized.frequencyPerWeek,
      scheduleScope: normalized.scheduleScope,
      termWeeks: normalized.termWeeks,
      maxSessionsPerDay: normalized.maxSessionsPerDay,
      maxSessionsPerWeek: normalized.maxSessionsPerWeek,
      maxBookingDaysPerWeek: normalized.maxBookingDaysPerWeek,
      productKind: normalized.productKind,
      discountEnabled: normalized.discountEnabled,
      coachDiscountAllowed: normalized.coachDiscountAllowed,
      coach: normalized.coach,
      flow: normalized.flow,
      mode: normalized.mode,
      discount: normalized.discount,
      badge: normalized.badge,
      status: normalized.status,
      rule: normalized.rule,
      sessions: normalized.sessions,
      sortOrder: normalized.sortOrder,
    };
  });
}

function membershipProductForTicket(ticket = {}) {
  const label = `${ticket.product || ""} ${ticket.lessonKind || ""}`;
  const isPass = label.includes("횟수") || label.includes("쿠폰");
  const productId = label.includes("2대1") || label.includes("그룹")
    ? "group-20"
    : isPass
      ? (label.includes("30분") ? "coupon-30" : "coupon-20")
      : label.includes("30분")
        ? "fixed-30"
        : "fixed-20";
  return normalizeMembershipProduct(
    membershipProductDrafts.find((product) => product.id === productId),
    membershipProductDefaults.find((product) => product.id === productId),
  );
}

function replaceServerPaymentRows(rows = []) {
  const mapped = rows.map((row) => billingRowFromServerPayment(row));
  const serverIds = new Set(mapped.map((item) => item.serverPaymentId).filter(Boolean));
  const providerIds = new Set(mapped.map((item) => item.providerPaymentId).filter(Boolean));
  const previousServerRows = billings.filter((item) => item.serverPaymentId);
  const previousKeys = new Set(previousServerRows
    .flatMap((item) => [item.serverPaymentId, item.providerPaymentId])
    .filter(Boolean));
  const preservedLocalRows = billings.filter((item) => (
    !item.serverPaymentId
    && (!item.providerPaymentId || !providerIds.has(item.providerPaymentId))
  ));
  replaceArray(billings, [...mapped, ...preservedLocalRows]);
  return {
    added: mapped.filter((item) => !previousKeys.has(item.serverPaymentId) && !previousKeys.has(item.providerPaymentId)).length,
    updated: mapped.filter((item) => previousKeys.has(item.serverPaymentId) || previousKeys.has(item.providerPaymentId)).length,
    removed: previousServerRows.filter((item) => (
      !serverIds.has(item.serverPaymentId) && !providerIds.has(item.providerPaymentId)
    )).length,
  };
}

function recalculateThreeMonthProductPrice(productId) {
  const card = document.querySelector(`[data-product-card="${CSS.escape(String(productId || ""))}"]`);
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  if (!card || !product) return;
  const baseProduct = membershipProductsForActiveOperationProfile().find((candidate) => (
    String(candidate.id) !== String(product.id)
    && candidate.productKind === "regular"
    && String(candidate.scheduleScope) === String(product.scheduleScope)
    && Number(candidate.groupSize) === Number(product.groupSize)
    && Number(candidate.lessonMinutes) === Number(product.lessonMinutes)
    && Number(candidate.frequencyPerWeek) === Number(product.frequencyPerWeek)
    && Number(candidate.termWeeks || 0) < 12
    && Number(candidate.validityDays || 0) < 84
  ));
  if (!baseProduct) {
    showToast("같은 조건의 4주 상품을 찾지 못했습니다. 가격을 직접 입력해 주세요.");
    return;
  }
  const rateInput = card.querySelector('[data-product-field="threeMonthDiscountRate"]');
  const modeInput = card.querySelector('[data-product-field="threeMonthPriceMode"]');
  const rate = Math.max(0, Math.min(90, Number(rateInput?.value) || 10));
  const multiplier = 1 - rate / 100;
  const cashInput = card.querySelector('[data-product-field="cashAmount"]');
  const cardInput = card.querySelector('[data-product-field="cardAmount"]');
  const cashPrice = Math.round(Number(baseProduct.cashAmount || 0) * 3 * multiplier);
  const cardPrice = Math.round(cashPrice * 1.1);
  if (cashInput) cashInput.value = String(cashPrice);
  if (cardInput) cardInput.value = String(cardPrice);
  if (modeInput) modeInput.value = "automatic";
  card.dataset.dirty = "true";
  showToast(`4주 현금가에 ${rate}% 할인을 적용하고 카드가는 10%를 더해 계산했습니다.`);
}

function selectedProductIdSet() {
  return new Set((state.selectedMembershipProductIds || []).map(String));
}

function membershipProductBulkSavePayload(product) {
  const card = document.querySelector(`[data-product-card="${CSS.escape(String(product.id))}"]`);
  const serverProduct = serverMembershipProductForDraft(product);
  if (!card || !serverProduct?.id) throw new Error("membership_product_visible_mapping_required");
  const fieldElement = (field) => card.querySelector(`[data-product-field="${field}"]`);
  const readField = (field) => fieldElement(field)?.value.trim() || "";
  const ticketValue = numericValue(readField("tickets"), product.tickets);
  const cashAmount = numericValue(readField("cashAmount"), product.cashAmount);
  const nextProduct = membershipProductWithOperationalLimits(normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || `${ticketValue}회`,
    tickets: ticketValue,
    cardAmount: Math.round(cashAmount * 1.1),
    cashAmount,
    validityDays: numericValue(readField("validityDays"), product.validityDays),
    graceDays: numericValue(readField("graceDays"), product.graceDays),
    lessonMinutes: numericValue(readField("lessonMinutes"), product.lessonMinutes),
    groupSize: numericValue(readField("groupSize"), product.groupSize),
    frequencyPerWeek: numericValue(readField("frequencyPerWeek"), product.frequencyPerWeek),
    maxSessionsPerDay: numericValue(readField("maxSessionsPerDay"), product.maxSessionsPerDay),
    maxSessionsPerWeek: numericValue(readField("maxSessionsPerWeek"), product.maxSessionsPerWeek),
    maxBookingDaysPerWeek: numericValue(readField("maxBookingDaysPerWeek"), product.maxBookingDaysPerWeek),
    scheduleScope: readField("scheduleScope") || product.scheduleScope,
    productKind: readField("productKind") || product.productKind,
    discountEnabled: fieldElement("discountEnabled")
      ? readField("discountEnabled") === "yes"
      : product.discountEnabled,
    coachDiscountAllowed: fieldElement("coachDiscountAllowed")
      ? readField("coachDiscountAllowed") === "yes"
      : product.coachDiscountAllowed,
    status: readField("status") || product.status,
  }, membershipProductDefaults.find((item) => item.id === product.id)));
  if (!nextProduct.title
    || Number(nextProduct.tickets) <= 0
    || Number(nextProduct.validityDays) <= 0
    || ![20, 30, 40].includes(Number(nextProduct.lessonMinutes))
    || ![1, 2].includes(Number(nextProduct.groupSize))
    || Number(nextProduct.frequencyPerWeek) <= 0
    || Number(nextProduct.maxSessionsPerDay) <= 0
    || Number(nextProduct.maxSessionsPerWeek) <= 0
    || Number(nextProduct.maxBookingDaysPerWeek) <= 0
    || Number(nextProduct.maxSessionsPerDay) > Number(nextProduct.maxSessionsPerWeek)
    || Number(nextProduct.maxBookingDaysPerWeek) > Number(nextProduct.maxSessionsPerWeek)) {
    throw new Error(`membership_product_invalid:${nextProduct.title || product.title || "회원권"}`);
  }
  const saleIssue = couponProductSaleIssue(nextProduct);
  if (saleIssue && nextProduct.status === "sale") {
    throw new Error(`membership_product_invalid:${nextProduct.title}:${saleIssue}`);
  }
  return membershipProductServerSavePayload(nextProduct, serverProduct);
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

function reflectRefundPolicyInActiveVersion() {
  const policy = activePolicyVersion();
  if (!policy) return;
  let section = policy.sections.find((item) => item.id === "refund");
  if (!section) {
    section = { id: "refund", title: "환불", rules: [] };
    policy.sections.push(section);
  }
  const settings = normalizeRefundPolicySettings(refundPolicySettings);
  section.rules = [
    `회원 사유 환불은 실납부액에서 할인 전 원가의 ${settings.penaltyRate}% 위약금을 차감`,
    "사용한 수업은 할인 전 회차 금액으로 차감",
    settings.reservationFee > 0 ? `첫 수업을 진행한 달에는 예약금 ${money.format(settings.reservationFee)}원을 추가 차감` : "별도 예약금 차감 없음",
    "분쟁이 생긴 경우에만 관리자가 소비자분쟁해결기준 검토 절차를 별도로 진행",
  ];
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

async function moveLessonPolicy(policyId, direction, allLessonPolicies = lessonPolicies) {
  const currentIndex = allLessonPolicies.findIndex((item) => item.id === policyId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= allLessonPolicies.length) return;
  const [policy] = allLessonPolicies.splice(currentIndex, 1);
  allLessonPolicies.splice(nextIndex, 0, policy);
  await persistLessonPolicies("수업 정책 순서를 변경했습니다");
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

async function copyPolicyVersion(policyId, allPolicyVersions = policyVersions) {
  const source = allPolicyVersions.find((policy) => policy.id === policyId) || activePolicyVersion();
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
  allPolicyVersions.unshift(copy);
  await persistPolicyVersions("새 정책 수정본을 만들었습니다");
  openPolicyVersionEditor(nextId);
}

async function activatePolicyVersion(policyId, allPolicyVersions = policyVersions) {
  const target = allPolicyVersions.find((policy) => policy.id === policyId);
  if (!target) return;
  allPolicyVersions.forEach((policy) => {
    policy.status = policy.id === policyId ? "active" : "archived";
  });
  await persistPolicyVersions("새 판매분에 적용할 정책을 변경했습니다");
}

const discountStatusToServer = { "사용": "active", "검토": "review", "중지": "disabled", "보관": "archived" };
const discountStatusFromServer = { active: "사용", review: "검토", disabled: "중지", archived: "보관" };
const discountPaymentToServer = { "카드/현금": "card_cash", "카드": "card_only", "현금": "cash_only" };
const discountPaymentFromServer = { card_cash: "카드/현금", card_only: "카드", cash_only: "현금" };
const discountCoachPermissionToServer = {
  "코치별 지급 수량 안에서 사용": "coach_quota",
  "요청만 가능": "request_only",
  "관리자만 사용": "admin_only",
};
const discountCoachPermissionFromServer = {
  coach_quota: "코치별 지급 수량 안에서 사용",
  request_only: "요청만 가능",
  admin_only: "관리자만 사용",
};
const discountBurdenToServer = { "센터 부담": "branch", "코치 부담": "coach", "공동 부담": "shared" };
const discountBurdenFromServer = { branch: "센터 부담", coach: "코치 부담", shared: "공동 부담" };

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

function discountPolicyServerPayload(policy = {}) {
  const normalized = normalizeDiscountPolicy(policy);
  return {
    branch_id: normalized.branchId || activeOperationBranchId(),
    name: normalized.title,
    target_label: normalized.target,
    product_scope: normalized.productScope,
    campaign_type: normalized.campaignType,
    discount_type: normalized.type,
    discount_value: normalized.value,
    payment_scope: discountPaymentToServer[normalized.payment] || "card_cash",
    coach_permission: discountCoachPermissionToServer[normalized.coachPermission] || "admin_only",
    coach_issue_quota: normalized.coachQuota,
    expires_days: normalized.expiresDays,
    burden_party: discountBurdenToServer[normalized.burden] || "branch",
    status: discountStatusToServer[normalized.status] || "review",
  };
}

function discountIssueEligibleMembers(query = "") {
  const keyword = String(query || "").trim().toLowerCase();
  return members
    .filter((member) => member.serverUserId && !["admin", "coach"].includes(String(member.authRole || "").toLowerCase()))
    .filter((member) => !keyword || `${member.name || ""} ${member.phone || ""}`.toLowerCase().includes(keyword))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function renderDiscountIssueControls() {
  const policySelect = $("#discountIssuePolicy");
  const memberSelect = $("#discountIssueMember");
  const referralSelect = $("#discountIssueReferralMember");
  if (!policySelect || !memberSelect || !referralSelect) return;
  const previousPolicy = policySelect.value;
  const previousMember = memberSelect.value;
  const previousReferral = referralSelect.value;
  const policies = discountPolicies.filter((policy) => normalizeDiscountPolicy(policy).status === "사용");
  policySelect.innerHTML = policies.length
    ? policies.map((policy) => `<option value="${escapeHtml(policy.id)}">${escapeHtml(policy.title)} · ${escapeHtml(policy.type === "percent" ? `${policy.value}%` : `${money.format(policy.value)}원`)}</option>`).join("")
    : '<option value="">사용 가능한 정책 없음</option>';
  if (policies.some((policy) => String(policy.id) === previousPolicy)) policySelect.value = previousPolicy;

  const visibleMembers = discountIssueEligibleMembers($("#discountIssueMemberSearch")?.value || "");
  const memberOptions = visibleMembers.map((member) => `<option value="${escapeHtml(member.serverUserId)}">${escapeHtml(member.name || "회원")} · ${escapeHtml(maskMemberPhone(member.phone || ""))}</option>`).join("");
  memberSelect.innerHTML = memberOptions || '<option value="">검색 결과 없음</option>';
  if (visibleMembers.some((member) => String(member.serverUserId) === previousMember)) memberSelect.value = previousMember;

  const allMembers = discountIssueEligibleMembers();
  referralSelect.innerHTML = `<option value="">선택 안 함</option>${allMembers
    .filter((member) => String(member.serverUserId) !== String(memberSelect.value || ""))
    .map((member) => `<option value="${escapeHtml(member.serverUserId)}">${escapeHtml(member.name || "회원")} · ${escapeHtml(maskMemberPhone(member.phone || ""))}</option>`).join("")}`;
  if (allMembers.some((member) => String(member.serverUserId) === previousReferral) && previousReferral !== memberSelect.value) {
    referralSelect.value = previousReferral;
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function defaultCoachWorkBlocks(coach) {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  if (coach?.id === "coach-no" || coach?.availability === "split") {
    return [
      { id: `${coach.id}-weekday-am`, days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" },
      { id: `${coach.id}-weekday-pm`, days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" },
    ];
  }
  if (coach?.id === "coach-kang" || coach?.availability === "weekday-pm") {
    return [{ id: `${coach.id}-weekday-pm`, days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" }];
  }
  if (coach?.id === "coach-hwang" || coach?.availability === "weekday-am") {
    return [{ id: `${coach.id}-weekday-am`, days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" }];
  }
  if (coach?.id === "coach-park" || coach?.availability === "weekend") {
    return [{ id: `${coach.id}-weekend`, days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }];
  }
  return [{ id: `${coach?.id || "coach"}-all`, days: scheduleDays, start: scheduleSettings.openStart, end: scheduleSettings.openEnd, label: "전체" }];
}

function normalizeCoachWorkBlocks(coach) {
  if (!coach) return [];
  if (!Array.isArray(coach.workBlocks)) {
    coach.workBlocks = defaultCoachWorkBlocks(coach);
  }
  coach.workBlocks = coach.workBlocks
    .map((block, index) => ({
      id: block.id || `${coach.id}-block-${index}-${Date.now()}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || scheduleSettings.openStart,
      end: block.end || scheduleSettings.openEnd,
      label: block.label || "근무",
    }))
    .filter((block) => timeToMinutes(block.start) < timeToMinutes(block.end))
    .sort((left, right) => {
      const leftDay = Math.min(...left.days.map((day) => scheduleDays.indexOf(day)).filter((index) => index >= 0));
      const rightDay = Math.min(...right.days.map((day) => scheduleDays.indexOf(day)).filter((index) => index >= 0));
      return leftDay - rightDay
        || timeToMinutes(left.start) - timeToMinutes(right.start)
        || timeToMinutes(left.end) - timeToMinutes(right.end);
    });
  return coach.workBlocks;
}

function normalizeCoachBreakBlocks(coach) {
  if (!coach) return [];
  if (!Array.isArray(coach.breakBlocks)) coach.breakBlocks = [];
  coach.breakBlocks = coach.breakBlocks
    .map((block, index) => ({
      id: block.id || `${coach.id}-break-${index}-${Date.now()}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || scheduleSettings.openStart,
      end: block.end || scheduleSettings.openEnd,
      label: block.label || "브레이크",
    }))
    .filter((block) => timeToMinutes(block.start) < timeToMinutes(block.end));
  return coach.breakBlocks;
}

function getCoachBreakOverlapping(coachId, day, time, durationMinutes = 20, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  if (!coach) return null;
  const start = timeToMinutes(time);
  const end = start + Number(durationMinutes || 20);
  return normalizeCoachBreakBlocks(coach).find((block) => (
    block.days.includes(day)
    && start < timeToMinutes(block.end)
    && end > timeToMinutes(block.start)
  )) || null;
}

function getCoachAvailabilityDefaults(coach) {
  const availability = coach?.availability || "full";
  if (availability === "weekday-am") return { days: scheduleDays.slice(0, 5), start: "06:40", end: "13:00" };
  if (availability === "weekday-pm") return { days: scheduleDays.slice(0, 5), start: "17:00", end: "22:00" };
  if (availability === "weekend") return { days: scheduleDays.slice(5), start: "09:00", end: "15:00" };
  if (availability === "split") return { days: scheduleDays.slice(0, 5), start: "06:40", end: "22:00" };
  return { days: scheduleDays, start: scheduleSettings.openStart, end: scheduleSettings.openEnd };
}

function getCoachAvailabilityDetail(coachId, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  const blocks = normalizeCoachWorkBlocks(coach);
  if (blocks.length) {
    const starts = blocks.map((block) => timeToMinutes(block.start));
    const ends = blocks.map((block) => timeToMinutes(block.end));
    return {
      days: [...new Set(blocks.flatMap((block) => block.days))],
      start: minutesToTime(Math.min(...starts)),
      end: minutesToTime(Math.max(...ends)),
    };
  }
  const defaults = getCoachAvailabilityDefaults(coach);
  return {
    days: Array.isArray(coach?.availableDays) && coach.availableDays.length ? coach.availableDays : defaults.days,
    start: coach?.availableStart || defaults.start,
    end: coach?.availableEnd || defaults.end,
  };
}

function getCoachAvailabilitySummary(coachId, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  const blocks = normalizeCoachWorkBlocks(coach);
  if (blocks.length) {
    return blocks.map((block) => `${block.days.join("")} ${block.start}~${block.end}`).join(" / ");
  }
  const detail = getCoachAvailabilityDetail(coachId);
  return `${detail.days.join(", ")} ${detail.start}~${detail.end}`;
}

function scheduleCoachSummaryForDay(day) {
  const dayCoaches = getScheduleCoachLanes(day).filter((coach) => coach.id !== "coach-machine");
  if (!dayCoaches.length) return "운영 없음";
  return dayCoaches
    .map((coach) => {
      const blocks = normalizeCoachWorkBlocks(coach)
        .filter((block) => block.days.includes(day))
        .map((block) => `${block.start}~${block.end}`)
        .join(", ");
      return `${coach.name.replace(" 코치", "")} ${blocks || "등록수업"}`;
    })
    .join(" / ");
}

function isCoachAvailableForSlot(coachId, day, time, durationMinutes = 20, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  const blocks = normalizeCoachWorkBlocks(coach);
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  return !getCoachBreakOverlapping(coachId, day, time, durationMinutes)
    && blocks.some((block) => block.days.includes(day) && start >= timeToMinutes(block.start) && end <= timeToMinutes(block.end));
}

function getCoachTimeOptions(coachId, day, durationMinutes = 20) {
  return getScheduleTimeOptions().filter((time) => isCoachAvailableForSlot(coachId, day, time, durationMinutes));
}

function getCourtOptions() {
  return Array.from({ length: fixedCourtCount }, (_, index) => {
    const id = `court-${index + 1}`;
    return { value: id, label: `${index + 1}번 코트` };
  });
}

function getTicketByLesson(lesson) {
  if (!lesson) return null;
  if (lesson.ticketId) {
    return [...tickets, ...expiredTickets]
      .find((item) => String(item.id) === String(lesson.ticketId));
  }
  const coachMatches = tickets.filter((item) => (
    ticketBelongsToMember(item, lesson.member)
    && item.coachId === lesson.coachId
  ));
  const productMatches = coachMatches.filter((item) => item.product?.includes(lesson.type));
  if (productMatches.length === 1) return productMatches[0];
  if (!productMatches.length && coachMatches.length === 1) return coachMatches[0];
  return null;
}

function lessonRoundRange(lesson, ticket, allLessons = lessons) {
  const ticketStartsOn = String(ticket?.starts || ticket?.purchased || "").slice(0, 10);
  const ticketLessons = allLessons
    .filter((item) => {
      if (!isBookedLesson(item) || isLessonCancelled(item) || isLessonAvailable(item)) return false;
      if (getTicketByLesson(item)?.id !== ticket.id) return false;
      const lessonDate = String(item?.lessonDate || "").slice(0, 10);
      return !ticketStartsOn || !lessonDate || lessonDate >= ticketStartsOn;
    })
    .sort((left, right) => lessonRoundSortKey(left).localeCompare(lessonRoundSortKey(right)));
  const targetKey = lessonRoundSortKey(lesson);
  const targetUnits = lessonTicketUnits(lesson, ticket);
  const deductedLessons = ticketLessons.filter(isDeductedLesson);
  let firstRound;

  if (isDeductedLesson(lesson)) {
    const visibleDeductedUnits = deductedLessons.reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    const importedUsedBaseline = Math.max(0, Number(ticket.used) - visibleDeductedUnits);
    const previousUnits = deductedLessons
      .filter((item) => lessonRoundSortKey(item).localeCompare(targetKey) < 0)
      .reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    firstRound = importedUsedBaseline + previousUnits + 1;
  } else {
    const previousReservedUnits = ticketLessons
      .filter((item) => !isDeductedLesson(item) && lessonRoundSortKey(item).localeCompare(targetKey) < 0)
      .reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    firstRound = Number(ticket.used) + previousReservedUnits + 1;
  }

  return { first: firstRound, last: firstRound + targetUnits - 1 };
}

function getLessonRoundLabel(lesson) {
  if (lesson?.oneDayBooking) return "원데이";
  if (isReleasedRegularMakeupSlot(lesson)) return "정규 · 불참";
  if (!isBookedLesson(lesson)) return "";
  const ticket = getTicketByLesson(lesson);
  if (!ticket) return "회차 확인";
  const range = lessonRoundRange(lesson, ticket);
  const round = range.first === range.last ? `${range.first}` : `${range.first}~${range.last}`;
  return `${round}/${ticket.total}회차`;
}

function lessonVisualKind(lesson, allScheduleSettings = scheduleSettings) {
  const source = lessonSourceValue(lesson);
  const status = lessonStatusValue(lesson);
  if (["no_show", "cancelled_late"].includes(status)) return "noShow";
  if (lesson?.oneDayBooking) return "coupon";
  if (isReleasedRegularMakeupSlot(lesson)) return "released";
  if (isMakeupLesson(lesson)) return "makeup";
  if (source === "coupon" || source === "one_day") return "coupon";
  const customRule = (allScheduleSettings.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${source}`.includes(rule.match));
  if (customRule) return customRule.id;
  if (Number(lesson.durationMinutes) === 30) return "regular30";
  const ticket = getTicketByLesson(lesson);
  const productKind = ticket ? membershipProductForTicket(ticket).productKind : "regular";
  return ["pass", "coupon"].includes(productKind) ? "coupon" : "regular";
}

function lessonColorStyle(lesson, allScheduleSettings = scheduleSettings) {
  const kind = lessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const customColor = (allScheduleSettings.lessonColorRules || []).find((rule) => rule.id === kind)?.color;
  const saved = customColor || allScheduleSettings.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function findLesson(day, time) {
  return operationBranchLessons().find((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function findLessons(day, time) {
  return operationBranchLessons().filter((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function isSameDateRegularLessonAdjustment(candidate = {}, releasedRegularSlot = null) {
  const editingLesson = getCurrentEditingLesson();
  if (
    operationsRole() !== "admin"
    || selectedLessonEditScope() !== "single"
    || !editingLesson?.serverLessonId
    || !isLessonEditableScheduled(editingLesson)
    || lessonSourceValue(editingLesson) !== "regular"
    || normalizeLessonSource(candidate.lessonSource) !== "regular"
  ) return false;
  const sourceDate = editingLesson.lessonDate || adminWeekDateForDay(editingLesson.day);
  const targetDate = candidate.lessonDate || adminWeekDateForDay(candidate.day);
  return Boolean(
    sourceDate
    && targetDate
    && sourceDate === targetDate
    && String(editingLesson.id) !== String(releasedRegularSlot?.id || "")
  );
}

function getLessonConflict(candidate) {
  if (!candidate.day || !candidate.time) return { lesson: null, message: "선택 가능한 수업 시간이 없습니다." };
  const candidateInterval = lessonInterval(candidate);
  const breakRule = getCoachBreakOverlapping(candidate.coachId, candidate.day, candidate.time, candidate.durationMinutes)
    || getBreakRuleOverlapping(candidate.day, candidate.time, candidate.durationMinutes, candidate.coachId);
  if (breakRule) {
    return { lesson: null, message: `${candidate.day} ${breakRule.start}~${breakRule.end} ${breakRule.label || "브레이크타임"}과 겹칩니다.` };
  }
  if (!isCoachAvailableForSlot(candidate.coachId, candidate.day, candidate.time, candidate.durationMinutes)) {
    return { lesson: null, message: `${getCoachName(candidate.coachId)} 수업 가능 시간이 아닙니다.` };
  }
  const replacementTicket = !state.editingLessonId
    && normalizeLessonSource(candidate.lessonSource) === "regular"
    ? tickets.find((ticket) => String(ticket.id) === String(candidate.ticketId) && ticket.productKind === "regular")
    : null;
  const allOverlappingBooked = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .filter((lesson) => (
      String(lesson.id) !== String(candidate.id)
      && !(
        replacementTicket
        && String(lesson.ticketId || "") === String(replacementTicket.id)
        && lessonSourceValue(lesson) === "regular"
        && lessonStatusValue(lesson) === "scheduled"
      )
    ));
  const releasedRegularSlot = allOverlappingBooked.find((lesson) => (
    isReleasedRegularMakeupSlot(lesson) && lesson.coachId === candidate.coachId
  ));
  const restoresReleasedRegularSlot = Boolean(
    releasedRegularSlot
    && normalizeLessonSource(candidate.lessonSource) === "regular"
    && String(releasedRegularSlot.ticketId || "") === String(candidate.ticketId || "")
  );
  const adjustsRegularLessonOnSameDate = isSameDateRegularLessonAdjustment(candidate, releasedRegularSlot);
  if (
    releasedRegularSlot
    && normalizeLessonSource(candidate.lessonSource) !== "makeup"
    && !restoresReleasedRegularSlot
    && !adjustsRegularLessonOnSameDate
  ) {
    return {
      lesson: releasedRegularSlot,
      message: "불참으로 비워진 정규자리입니다. 보강 또는 기존 정규수업의 같은 날 시간조정만 가능합니다.",
    };
  }
  const overlappingBooked = allOverlappingBooked.filter((lesson) => !isReleasedRegularMakeupSlot(lesson));
  const coachConflict = overlappingBooked.find((lesson) => lesson.coachId === candidate.coachId);
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}가 같은 시간에 이미 수업 중입니다.` };
  }
  const courtConflict = overlappingBooked.find((lesson) => lesson.courtId === candidate.courtId);
  const usedCourtIds = new Set(overlappingBooked.map((lesson) => lesson.courtId).filter(Boolean));
  const availableCourt = getCourtOptions().find((court) => !usedCourtIds.has(court.value));
  if (courtConflict && !availableCourt) {
    return { lesson: courtConflict, message: `${getCourtLabel(candidate.courtId)}가 같은 시간에 이미 사용 중입니다.` };
  }
  if (overlappingBooked.length >= fixedCourtCount) {
    return { lesson: overlappingBooked[0], message: `현재 코트 ${fixedCourtCount}개가 모두 사용 중입니다.` };
  }
  return null;
}

function getRestorableReleasedRegularSlot(candidate) {
  if (
    state.editingLessonId
    || normalizeLessonSource(candidate?.lessonSource) !== "regular"
    || !candidate?.ticketId
  ) return null;
  return getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .find((lesson) => (
      isReleasedRegularMakeupSlot(lesson)
      && lesson.coachId === candidate.coachId
      && String(lesson.ticketId || "") === String(candidate.ticketId)
    )) || null;
}

function getOverlappingBookedLessons(day, time, durationMinutes = 20) {
  const interval = {
    start: timeToMinutes(time),
    end: timeToMinutes(time) + durationMinutes,
  };
  const targetDate = state.liveScheduleLoaded ? adminWeekDateForDay(day) : "";
  return operationBranchLessons().filter((lesson) => (
    lesson.day === day
    && (!targetDate || !lesson.lessonDate || lesson.lessonDate === targetDate)
    && isBookedLesson(lesson)
    && intervalsOverlap(interval, lessonInterval(lesson))
  ));
}

function getAvailableCourtId(day, time, durationMinutes = 20) {
  const usedCourts = new Set(getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson))
    .map((lesson) => lesson.courtId));
  return getCourtOptions().find((court) => !usedCourts.has(court.value))?.value || getCourtOptions()[0]?.value || "court-1";
}

function getAvailableCoachesForSlot(day, time, durationMinutes = 20) {
  const usedCoachIds = new Set(getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson))
    .map((lesson) => lesson.coachId));
  return operationBranchCoaches().filter((coach) => (
    coach.status === "active" &&
    !usedCoachIds.has(coach.id) &&
    !getCoachBreakOverlapping(coach.id, day, time, durationMinutes) &&
    !getBreakRuleOverlapping(day, time, durationMinutes, coach.id) &&
    isCoachAvailableForSlot(coach.id, day, time, durationMinutes)
  ));
}

function getAvailableCoachId(day, time, durationMinutes = 20, preferredCoachId = "") {
  const availableCoaches = getAvailableCoachesForSlot(day, time, durationMinutes);
  if (preferredCoachId && availableCoaches.some((coach) => coach.id === preferredCoachId)) return preferredCoachId;
  return availableCoaches[0]?.id
    || operationBranchCoaches().find((coach) => coach.status === "active")?.id
    || "coach-no";
}

function hasCourtCapacity(day, time, durationMinutes = 20) {
  return getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson)).length < fixedCourtCount;
}

function canAddLessonAt(day, time, durationMinutes = 20, preferredCoachId = "") {
  if (!hasCourtCapacity(day, time, durationMinutes)) return false;
  if (preferredCoachId) return getAvailableCoachesForSlot(day, time, durationMinutes).some((coach) => coach.id === preferredCoachId);
  return getAvailableCoachesForSlot(day, time, durationMinutes).length > 0;
}

function lessonAddAttrs(day, time, durationMinutes = 20, preferredCoachId = "") {
  const coachId = getAvailableCoachId(day, time, durationMinutes, preferredCoachId);
  const coachLabel = scheduleCoachDisplayName(getCoachName(coachId)) || "코치 미정";
  const ariaLabel = escapeHtml(`${day}요일 ${time} ${coachLabel} 수업 추가`);
  return `data-add-lesson-day="${day}" data-add-lesson-time="${time}" data-add-lesson-court="${getAvailableCourtId(day, time, durationMinutes)}" data-add-lesson-coach="${coachId}" data-quick-lesson-entry="true" aria-label="${ariaLabel}"`;
}

function moveScheduleAddButtonFocus(button, key) {
  const current = scheduleAddButtonGridPosition(button);
  if (!current) return false;
  const candidates = [...document.querySelectorAll('.admin-duration-add[data-quick-lesson-entry="true"]')]
    .filter((candidate) => candidate !== button && !candidate.disabled && candidate.offsetParent !== null)
    .map((candidate) => ({ button: candidate, position: scheduleAddButtonGridPosition(candidate) }))
    .filter((candidate) => candidate.position);
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const direction = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
  const aligned = candidates.filter(({ position }) => (
    vertical
      ? position.column === current.column && Math.sign(position.row - current.row) === direction
      : position.row === current.row && Math.sign(position.column - current.column) === direction
  ));
  aligned.sort((left, right) => {
    const leftDistance = vertical
      ? Math.abs(left.position.row - current.row)
      : Math.abs(left.position.column - current.column);
    const rightDistance = vertical
      ? Math.abs(right.position.row - current.row)
      : Math.abs(right.position.column - current.column);
    return leftDistance - rightDistance;
  });
  if (!aligned.length) return false;
  aligned[0].button.focus({ preventScroll: true });
  aligned[0].button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function getScheduleTimeOptions() {
  return getVisibleScheduleTimes();
}

function findLessonStartingInBlock(day, blockStart, blockEnd) {
  return operationBranchLessons().find((lesson) => {
    const starts = timeToMinutes(lesson.time);
    return lesson.day === day && lessonMatchesActiveScheduleWeek(lesson, day) && starts > blockStart && starts < blockEnd;
  });
}

function getScheduleCoachLanes(day = "") {
  const preferredOrder = ["coach-no", "coach-kang", "coach-hwang", "coach-park", "coach-machine"];
  const activeCoaches = operationBranchCoaches().filter((coach) => coach.status === "active");
  const orderedCoaches = preferredOrder.map((coachId) => activeCoaches.find((coach) => coach.id === coachId)).filter(Boolean);
  const extraCoaches = activeCoaches.filter((coach) => !preferredOrder.includes(coach.id));
  const lanes = orderedCoaches.concat(extraCoaches);
  if (!day) return lanes;
  return lanes.filter((coach) => (
    normalizeCoachWorkBlocks(coach).some((block) => block.days.includes(day)) ||
    operationBranchLessons().some((lesson) => lesson.day === day && lessonScheduleCoachId(lesson) === coach.id && lessonMatchesActiveScheduleWeek(lesson, day) && isBookedLesson(lesson))
  ));
}

function findStartingLessonForCoach(day, time, coachId) {
  return operationBranchLessons().find((lesson) => lesson.day === day && lesson.time === time && lessonScheduleCoachId(lesson) === coachId && lessonMatchesActiveScheduleWeek(lesson, day) && isBookedLesson(lesson));
}

function findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coachId) {
  return operationBranchLessons().find((lesson) => {
    const starts = timeToMinutes(lesson.time);
    return lesson.day === day && lessonScheduleCoachId(lesson) === coachId && lessonMatchesActiveScheduleWeek(lesson, day) && starts > blockStart && starts < blockEnd;
  });
}

function findOccupyingLessonForCoach(day, time, coachId) {
  const current = timeToMinutes(time);
  return operationBranchLessons().find((lesson) => {
    if (lesson.day !== day || lesson.time === time || lessonScheduleCoachId(lesson) !== coachId || !lessonMatchesActiveScheduleWeek(lesson, day) || !isBookedLesson(lesson)) return false;
    const starts = timeToMinutes(lesson.time);
    const ends = starts + lesson.durationMinutes;
    return current > starts && current < ends;
  });
}

function findOccupyingLesson(day, time) {
  const current = timeToMinutes(time);
  return operationBranchLessons().find((lesson) => {
    if (lesson.day !== day || lesson.time === time || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
    const starts = timeToMinutes(lesson.time);
    const ends = starts + lesson.durationMinutes;
    return current > starts && current < ends;
  });
}

const adminToolConfig = {
  data: { title: "엑셀 가져오기·내보내기", lockView: "data" },
  coach: { title: "코치·직원 관리", lockView: "settings" },
  schedule: { title: "시간표 설정", lockView: "settings" },
  notice: { title: "공지·알림 관리", lockView: "settings" },
  products: { title: "회원권·할인 설정", lockView: "billing" },
};

function moveAdminToolPanel(selector, targetId) {
  const panel = $(selector);
  const target = $(`#${targetId}`);
  if (!panel || !target) return;
  panel.removeAttribute("data-settings-panel");
  panel.removeAttribute("hidden");
  panel.querySelector(":scope > .setting-help")?.remove();
  target.append(panel);
}

function organizeAdminTools() {
  if (document.body.dataset.adminToolsOrganized === "true") return;
  document.body.dataset.adminToolsOrganized = "true";

  moveAdminToolPanel("#dataView .data-import-panel", "dataToolsModalContent");
  moveAdminToolPanel("#dataView .data-export-panel", "dataToolsModalContent");
  $("#settingsView .service-readiness-panel")?.remove();
  $("#settingsView .payment-setup-panel")?.remove();
  $("#dataToolsModalContent .import-step-grid")?.remove();
  $("#dataView")?.remove();

  [".access-policy-panel", ".coach-role-flow-panel", ".policy-guide-panel"].forEach((selector) => {
    $(`#settingsView ${selector}`)?.remove();
  });
  $$('#settingsView [data-settings-panel="live"]').forEach((panel) => panel.remove());

  [".policy-version-panel", ".holding-policy-panel", ".refund-policy-panel"].forEach((selector) => {
    const panel = $(`#settingsView ${selector}`);
    if (panel) panel.dataset.settingsPanel = "membership";
  });
  $$('[data-admin-tool-panel]').forEach((panel) => panel.setAttribute("hidden", ""));
}

let adminViewRenderRevision = 0;
const adminViewRenderCache = new Map();

function adminViewUiSignature(view) {
  const common = [operationsRole(), activeOperationBranchId()];
  if (view === "members") {
    return JSON.stringify(common.concat([
      state.memberFilter,
      state.memberSearch,
      state.memberCoachFilter,
      state.memberTicketFilter,
      state.memberListPage,
      state.inlineMemberId,
      state.inlineMemberTicketId,
      memberAdminEditEnabled,
      adminMemberDirectoryState.signature,
      adminMemberDirectoryState.requestId,
      adminMemberDirectoryState.loading,
    ]));
  }
  if (view === "schedule") {
    return JSON.stringify(common.concat([
      state.scheduleView,
      state.scheduleFilter,
      state.scheduleCoachFilter,
      state.scheduleMemberSearch,
      state.activeAdminWeekIndex,
      state.selectedScheduleDay,
      state.scheduleEditMode,
      state.scheduleOpenSlotMode,
      state.liveScheduleLoaded,
      state.liveScheduleLoading,
    ]));
  }
  if (view === "billing") {
    return JSON.stringify(common.concat([
      state.billingFilter,
      state.billingMonth,
      state.billingPage,
      state.settlementPage,
      state.rechargePage,
    ]));
  }
  if (view === "reports") {
    return JSON.stringify(common.concat([state.managementReportMonth]));
  }
  if (view === "notes") {
    return JSON.stringify(common.concat([
      state.recordFilter,
      state.recordCoachFilter,
      state.recordPendingType,
      state.recordSearch,
      state.recordPage,
    ]));
  }
  if (view === "settings") {
    return JSON.stringify(common.concat([
      state.settingsTab,
      state.membershipSettingsSection,
      state.membershipProductSearch,
      state.membershipProductStatusFilter,
      state.membershipProductPage,
    ]));
  }
  return JSON.stringify(common.concat([
    state.adminTaskPage,
    state.memberStatusPage,
  ]));
}

function canReuseAdminView(view) {
  const cached = adminViewRenderCache.get(view);
  return Boolean(
    cached
    && cached.revision === adminViewRenderRevision
    && cached.signature === adminViewUiSignature(view)
  );
}

function rememberAdminViewRender(view) {
  adminViewRenderCache.set(view, {
    revision: adminViewRenderRevision,
    signature: adminViewUiSignature(view),
  });
}

function getSearchText() {
  return ($("#globalSearch").value || "").trim().toLowerCase();
}

function matchesSearch(values) {
  const query = getSearchText();
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query);
}

function globalSearchItems(allMembers = members) {
  const branchMembers = operationBranchMembers();
  const branchCoaches = operationBranchCoaches();
  const branchLessons = operationBranchLessons();
  const branchMakeups = operationBranchMakeupRequests();
  const branchBillings = operationBranchBillings();
  const branchTickets = operationBranchTickets();
  const navigationItems = [
    { kind: "메뉴", title: "대시보드", detail: "오늘 수업과 운영 처리 현황", view: "dashboard" },
    { kind: "메뉴", title: "회원관리", detail: "수강중·승인대기·만료 회원", view: "allMembers" },
    { kind: "메뉴", title: "레슨시간표", detail: "코치별 수업과 보강·변경 요청", view: "schedule" },
    { kind: "메뉴", title: "결제/정산", detail: "결제 상태와 코치 정산", view: "billing" },
    { kind: "메뉴", title: "경영 리포트", detail: "매출·회원·수업 품질과 장부 자료 상태", view: "reports" },
    { kind: "메뉴", title: "기록/차감 확인", detail: "수업 코멘트·커리큘럼·횟수 처리", view: "notes" },
    { kind: "메뉴", title: "운영 설정", detail: "수업 정책·회원권 규정·관리자 보안", view: "settings" },
  ];
  const memberItems = branchMembers.map((member) => ({
    kind: "회원",
    title: member.name,
    detail: `${memberStatusLabel(member)} · ${member.coach} · ${member.regularTime} · ${member.lessonType}`,
    view: "allMembers",
    memberId: member.id,
  }));
  const coachItems = branchCoaches.map((coach) => ({
    kind: "코치",
    title: coach.name,
    detail: `${coach.role} · ${coachModeLabel(coach)} · ${coach.status === "active" ? "운영중" : "사용중지"}`,
    view: "allMembers",
  }));
  const lessonItems = branchLessons.map((lesson) => ({
    kind: "수업",
    title: `${lesson.day}요일 ${lesson.time} · ${lesson.member}`,
    detail: `${getCoachName(lesson.coachId)} · ${lessonTypeLabel(lesson)} · ${getLessonStatusLabel(lesson)}`,
    view: "schedule",
  }));
  const makeupItems = branchMakeups.map((request) => ({
    kind: "변경요청",
    title: request.member,
    detail: `${request.original} → ${request.requested} · ${request.statusLabel}`,
    view: "schedule",
  }));
  const billingItems = branchBillings.map((billing) => ({
    kind: "결제",
    title: billing.member,
    detail: `${billing.item} · ${billing.method} · ${billing.status}`,
    view: "billing",
  }));
  const ticketItems = branchTickets.map((ticket) => {
    const member = branchMembers.find((item) => item.name === ticket.member);
    return {
      kind: "회원권",
      title: ticket.member,
      detail: `${getTicketDisplayProduct(ticket)} · 잔여 ${ticket.remaining}회 · ${ticket.expires || "만료일 미정"}`,
      view: "allMembers",
      memberId: member?.id,
    };
  });

  return [...navigationItems, ...memberItems, ...coachItems, ...lessonItems, ...makeupItems, ...billingItems, ...ticketItems];
}

function getGlobalSearchResults(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return globalSearchItems()
    .filter((item) => [item.kind, item.title, item.detail].join(" ").toLowerCase().includes(normalized))
    .slice(0, 12);
}

function clearGlobalSearch() {
  const input = $("#globalSearch");
  if (input) input.value = "";
  renderGlobalSearchResults();
}

function adminTodayLessonRows() {
  if (adminDemoMode) return operationBranchLessons();
  const today = adminLocalDateKey(new Date());
  return operationBranchLessons().filter((lesson) => lesson.lessonDate === today);
}

function billingNeedsAdminAction(item = {}) {
  if (["draft", "check", "unverified", "refund_processing", "refund_reconcile"].includes(item.status)) return true;
  if (item.status === "server_ready") return isStaleReadyPayment(item);
  return item.status === "paid" && !item.ticketId && !isHistoricalImportedPayment(item);
}

function dashboardOperationalMembers() {
  return operationBranchMembers().filter((member) => {
    const status = memberListStatus(member);
    return ["active", "expiring", "pending"].includes(status) || memberRemainingCount(member) > 0;
  });
}

function isRegularScheduleTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || Number(ticket.remaining) <= 0) return false;
  if (ticket.status && ticket.status !== "active") return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  if (ticket.expires && ticket.expires < today) return false;
  const productKind = ticket.productKind || membershipProductForTicket(ticket).productKind;
  if (["pass", "coupon"].includes(String(productKind).toLowerCase()) || String(ticket.product || "").includes("쿠폰")) return false;
  return true;
}

function isCurrentMemberTicket(ticket, today = adminLocalDateKey(new Date())) {
  const state = window.TennisNoteTicketState?.derive(ticket, today);
  if (state) return ["current", "paused"].includes(state);
  if (!ticket || !["active", "paused"].includes(ticket.status)) return false;
  if (Number(ticket.remaining) <= 0) return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  return !ticket.expires || ticket.expires >= today;
}

function ticketRegularScheduleAssignmentProgress(ticket, today = adminLocalDateKey(new Date())) {
  const requiredCount = Math.min(
    getTicketWeeklyCount(ticket),
    Math.max(0, Number(ticket?.remaining) || 0),
  );
  const assignedCount = Math.min(requiredCount, ticketFutureRegularScheduleCoverage(ticket, today));
  return {
    requiredCount,
    assignedCount,
    remainingCount: Math.max(0, requiredCount - assignedCount),
    state: assignedCount > 0 ? "partial" : "unassigned",
  };
}

function ticketRemainingRegularScheduleCount(ticket, today = adminLocalDateKey(new Date())) {
  return ticketRegularScheduleAssignmentProgress(ticket, today).remainingCount;
}

function ticketNeedsRegularSchedule(ticket, today = adminLocalDateKey(new Date())) {
  return isRegularScheduleTicket(ticket, today) && ticketRemainingRegularScheduleCount(ticket, today) > 0;
}

function unassignedRegularTickets() {
  const regularTickets = operationBranchTickets().filter((ticket) => isRegularScheduleTicket(ticket));
  const candidates = regularTickets
    .filter((ticket) => ticketNeedsRegularSchedule(ticket))
    .sort((left, right) => ticketParticipantNames(right).length - ticketParticipantNames(left).length);
  const selected = [];

  candidates.forEach((ticket) => {
    const participantNames = ticketParticipantNames(ticket).sort();
    const startsOn = ticket.starts || ticket.purchased || "";
    const contextKey = [ticket.coachId || "", ticket.product || "", startsOn, ticket.expires || ""].join("::");
    const assignedAliasExists = regularTickets.some((other) => {
      if (other === ticket || ticketNeedsRegularSchedule(other)) return false;
      const otherStartsOn = other.starts || other.purchased || "";
      const otherContextKey = [other.coachId || "", other.product || "", otherStartsOn, other.expires || ""].join("::");
      const otherParticipantNames = ticketParticipantNames(other);
      return otherContextKey === contextKey
        && participantNames.length > 0
        && participantNames.every((name) => otherParticipantNames.includes(name));
    });
    if (assignedAliasExists) return;
    const duplicate = selected.some((item) => (
      item.contextKey === contextKey
      && participantNames.length > 0
      && participantNames.every((name) => item.participantNames.includes(name))
    ));
    if (!duplicate) selected.push({ ticket, participantNames, contextKey });
  });

  return selected.map((item) => item.ticket);
}

function currentScheduleAssignmentTicket() {
  return scheduleTicketById(state.scheduleAssignmentTicketId);
}

function scheduleAssignmentQueueCandidates({ respectUiFilters = true, excludeTicketId = "" } = {}) {
  const query = respectUiFilters ? normalizedScheduleMemberSearch(state.scheduleAssignmentSearch) : "";
  const filter = respectUiFilters ? state.scheduleAssignmentFilter : "all";
  return unassignedRegularTickets()
    .filter((ticket) => String(ticket.id || "") !== String(excludeTicketId || ""))
    .filter((ticket) => {
      const progress = ticketRegularScheduleAssignmentProgress(ticket);
      if (filter !== "all" && progress.state !== filter) return false;
      if (!query) return true;
      const searchValue = normalizedScheduleMemberSearch([
        ...ticketParticipantNames(ticket),
        getCoachName(ticket.coachId),
        getTicketDisplayProduct(ticket),
      ].join(" "));
      return searchValue.includes(query);
    })
    .sort((left, right) => {
      const leftProgress = ticketRegularScheduleAssignmentProgress(left);
      const rightProgress = ticketRegularScheduleAssignmentProgress(right);
      const stateOrder = Number(leftProgress.state !== "partial") - Number(rightProgress.state !== "partial");
      if (stateOrder) return stateOrder;
      const coachOrder = String(getCoachName(left.coachId) || "").localeCompare(String(getCoachName(right.coachId) || ""), "ko");
      if (coachOrder) return coachOrder;
      return ticketParticipantNames(left).join(" & ").localeCompare(ticketParticipantNames(right).join(" & "), "ko");
    });
}

function nextScheduleAssignmentTicket(currentTicketId = state.scheduleAssignmentTicketId, respectUiFilters = true) {
  const current = scheduleTicketById(currentTicketId);
  const candidates = scheduleAssignmentQueueCandidates({ respectUiFilters, excludeTicketId: currentTicketId });
  if (!candidates.length) return null;
  if (!current?.coachId) return candidates[0];
  return candidates.find((ticket) => String(ticket.coachId || "") === String(current.coachId)) || candidates[0];
}

function advanceScheduleTicketAssignment({
  currentTicketId = state.scheduleAssignmentTicketId,
  respectUiFilters = true,
  render = true,
  notify = true,
} = {}) {
  const next = nextScheduleAssignmentTicket(currentTicketId, respectUiFilters);
  if (!next) {
    clearScheduleTicketAssignment(false);
    if (render) renderSchedule();
    if (notify) showToast(respectUiFilters ? "현재 조건의 다음 회원이 없습니다." : "정규시간 배정 대기열을 모두 처리했습니다.");
    return null;
  }
  if (!respectUiFilters) {
    state.scheduleAssignmentSearch = "";
    state.scheduleAssignmentFilter = "all";
  }
  state.scheduleAssignmentTicketId = String(next.id || "");
  state.scheduleAssignmentLessonSource = "regular";
  state.scheduleCoachFilter = "all";
  if (render) renderSchedule();
  if (notify) showToast(`${ticketParticipantNames(next).join(" & ") || next.member} 회원의 빈 시간을 선택하세요.`);
  return next;
}

function scheduleAssignmentRemainingCount(ticket = currentScheduleAssignmentTicket()) {
  if (!ticket) return 0;
  return state.scheduleAssignmentLessonSource === "regular"
    ? ticketRemainingRegularScheduleCount(ticket)
    : 1;
}

function clearScheduleTicketAssignment(render = true) {
  state.scheduleAssignmentTicketId = "";
  state.scheduleAssignmentLessonSource = "regular";
  if (render) renderSchedule();
}

function beginScheduleTicketAssignment(ticketId, lessonSource = "regular") {
  const ticket = scheduleTicketById(ticketId);
  if (!ticket) {
    showToast("회원권 정보를 다시 불러와 주세요.");
    return false;
  }
  state.scheduleAssignmentTicketId = String(ticket.id || "");
  state.scheduleAssignmentLessonSource = normalizeLessonSource(lessonSource);
  state.scheduleView = "week";
  state.scheduleCoachFilter = "all";
  state.scheduleOpenSlotMode = false;
  state.selectedScheduleOpenSlots = [];
  state.scheduleOpenSlotAnchorKey = "";
  setView("schedule");
  showToast(`${ticketParticipantNames(ticket).join(" & ") || ticket.member} 회원의 빈 시간을 선택하세요.`);
  return true;
}

function scheduleAssignmentAllowsCoach(coachId) {
  const ticket = currentScheduleAssignmentTicket();
  return !ticket?.coachId || String(ticket.coachId) === String(coachId || "");
}

function scheduleAssignmentDefaultsForSlot(day, time, coachId) {
  const ticket = currentScheduleAssignmentTicket();
  if (!ticket) return {};
  if (!scheduleAssignmentAllowsCoach(coachId)) {
    return { blockedMessage: `${scheduleCoachDisplayName(getCoachName(ticket.coachId))} 담당 시간에서 선택해 주세요.` };
  }
  return {
    memberName: ticketParticipantNames(ticket)[0] || splitMemberNames(ticket.member)[0] || "",
    ticketId: ticket.id,
    coachId: ticket.coachId || coachId,
    lessonSource: state.scheduleAssignmentLessonSource || "regular",
    durationMinutes: getTicketDurationMinutes(ticket),
    day,
    time,
  };
}

function isActiveCouponTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  if (ticket.expires && ticket.expires < today) return false;
  const productKind = String(ticket.productKind || membershipProductForTicket(ticket).productKind || "").toLowerCase();
  return productKind === "pass" || productKind === "coupon" || String(ticket.product || "").includes("쿠폰");
}

function couponTicketsWithoutUpcomingLesson() {
  const candidates = operationBranchTickets()
    .filter((ticket) => isActiveCouponTicket(ticket) && !ticketHasUpcomingLesson(ticket))
    .sort((left, right) => String(left.expires || "9999-12-31").localeCompare(String(right.expires || "9999-12-31")));
  const seen = new Set();
  return candidates.filter((ticket) => {
    const participantIds = ticketParticipantUserIds(ticket).sort();
    const participantNames = ticketParticipantNames(ticket).sort();
    const participantsKey = participantIds.length ? participantIds.join("&") : participantNames.join("&");
    const key = [participantsKey || ticket.id, ticket.coachId || "", ticket.product || "", ticket.expires || ""].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAdminTasks() {
  const shared = operationalSharedData();
  const pendingLessonLogs = shared.lessonLogs.filter((log) => log.status !== "confirmed");
  const pendingFeedbacks = shared.feedbackRequests.filter((item) => item.status !== "코치 답변 완료");
  const branchTickets = operationBranchTickets();
  const branchBillings = operationBranchBillings();
  const lowTickets = branchTickets.filter((ticket) => ticket.remaining <= 2);
  const paymentChecks = branchBillings.filter((item) => item.status === "check" || item.status === "unverified");
  const draftBillings = branchBillings.filter((item) => item.status === "draft");
  const paymentDataErrors = branchBillings.filter((item) => item.status === "paid" && !item.ticketId && !isHistoricalImportedPayment(item));
  const urgentMakeups = operationBranchMakeupRequests()
    .filter((item) => item.status === "coach_required" || item.status === "requested")
    .concat(shared.makeupRequests.filter((item) => item.status === "승인 대기"));
  const unassignedTickets = unassignedRegularTickets();
  const couponNoBookingTickets = couponTicketsWithoutUpcomingLesson();

  const tasks = [
    ...paymentDataErrors.map((item) => ({
      type: "결제오류",
      title: `${item.member} 회원권 연결 누락`,
      detail: `${item.item} · ${money.format(item.amount)}원 · 서버 결제 확인 필요`,
      tone: "danger",
      action: "결제 확인",
      view: "billing",
      dueAt: item.verifiedAt || item.paidAt || item.requestedAt || "",
    })),
    ...unassignedTickets.map((ticket) => ({
      type: "긴급",
      title: `${ticketParticipantNames(ticket).join(" & ") || ticket.member} 정규시간 미배정`,
      detail: `${ticket.product} · ${getCoachName(ticket.coachId) || "담당 코치 미배정"}`,
      tone: "danger",
      action: "시간표 배정",
      view: "schedule",
      scheduleTicketId: ticket.id,
    })),
    ...couponNoBookingTickets.map((ticket) => ({
      type: "쿠폰 일정",
      title: `${ticketParticipantNames(ticket).join(" & ") || ticket.member} 다음 일정 미예약`,
      detail: `${ticket.product} · 잔여 ${ticket.remaining}회${ticket.expires ? ` · ${ticket.expires}까지` : ""}`,
      tone: "warn",
      action: "일정 예약",
      view: "schedule",
      scheduleTicketId: ticket.id,
      scheduleLessonSource: "coupon",
    })),
    ...urgentMakeups.map((item) => ({
      type: "보강",
      title: `${item.member} 보강 승인`,
      detail: `${item.original || item.absence} -> ${item.requested || item.makeup}`,
      tone: item.status === "coach_required" ? "danger" : "warn",
      action: "보강 요청 검토",
      view: "schedule",
      dueAt: item.requested || item.makeup || "",
    })),
    ...pendingLessonLogs.map((log) => ({
      type: "수업기록",
      title: `${log.member || "회원"} 코치 확인`,
      detail: `${log.lessonLabel || log.lesson || "수업기록"} · 다음 커리큘럼 등록 필요`,
      tone: "warn",
      action: "기록/차감",
      view: "notes",
    })),
    ...pendingFeedbacks.map((item) => ({
      type: "운동노트",
      title: `${item.member || "회원"} 원격 피드백`,
      detail: item.question || item.memo || "사진/영상 코멘트 요청",
      tone: "warn",
      action: "피드백 확인",
      view: "notes",
    })),
    ...lowTickets.map((ticket) => ({
      type: "횟수",
      title: `${ticket.member} 잔여 ${ticket.remaining}회`,
      detail: `${ticket.product} · 재등록/충전 안내`,
      tone: ticket.remaining <= 1 ? "danger" : "warn",
      action: "회원권 확인",
      view: "members",
    })),
    ...paymentChecks.map((item) => ({
      type: "결제확인",
      title: `${item.member} 결제 확인`,
      detail: `${item.item} · ${money.format(item.amount)}원`,
      tone: "warn",
      action: "결제 확인",
      view: "billing",
      dueAt: item.requestedAt || "",
    })),
    ...draftBillings.map((item) => ({
      type: "결제요청",
      title: `${item.member} 결제요청 발송`,
      detail: `${item.item} · ${money.format(item.amount)}원`,
      tone: "neutral",
      action: "결제 요청",
      view: "billing",
      dueAt: item.requestedAt || "",
    })),
  ];
  const priorityByType = {
    결제오류: 0,
    긴급: 1,
    보강: 2,
    결제확인: 3,
    횟수: 4,
    "쿠폰 일정": 4,
    수업기록: 5,
    운동노트: 6,
    결제요청: 7,
  };
  return tasks
    .map((task, index) => ({ ...task, originalIndex: index }))
    .sort((left, right) => {
      const priorityDifference = (priorityByType[left.type] ?? 99) - (priorityByType[right.type] ?? 99);
      if (priorityDifference) return priorityDifference;
      const latestDifference = recordTimestamp(right.dueAt) - recordTimestamp(left.dueAt);
      return latestDifference || left.originalIndex - right.originalIndex;
    });
}

function memberStatusLabel(member) {
  const status = memberListStatus(member);
  if (status === "inactive") return "삭제회원";
  if (status === "pending") return memberRegistrationStage(member)?.label || "가입 대기";
  if (status === "journal") return "운동노트 회원";
  return status === "expired" ? "만료회원" : "수강중";
}

function memberStatusBadge(member) {
  return badge(memberListStatus(member), memberStatusLabel(member));
}

function ticketParticipantNames(ticket) {
  if (!ticket) return [];
  const ticketKey = String(ticket.serverTicketId || ticket.id || "");
  const cached = ticketKey ? ticketParticipantNamesIndex.get(ticketKey) : null;
  if (cached) return cached;
  if (!adminUserNameIndex) {
    adminUserNameIndex = new Map((adminLiveDataState.users || []).map((user) => [user.id, user.name]));
  }
  const namesById = ticketParticipantUserIds(ticket)
    .map((userId) => adminUserNameIndex.get(userId))
    .filter(Boolean);
  const names = [...new Set([...namesById, ...splitMemberNames(ticket.member)])];
  if (ticketKey) ticketParticipantNamesIndex.set(ticketKey, names);
  return names;
}

function ticketBelongsToMember(ticket, memberReference) {
  if (!ticket || !memberReference) return false;
  const memberRecords = memberRecordsForReference(memberReference);
  const memberUserIds = [...new Set(memberRecords.flatMap(memberServerUserIds))];
  const participantUserIds = ticketParticipantUserIds(ticket);
  if (memberUserIds.length && participantUserIds.length) {
    return participantUserIds.some((userId) => memberUserIds.includes(userId));
  }
  const memberNames = memberRecords.length
    ? memberRecords.map((member) => member.name)
    : splitMemberNames(memberReference);
  const participantNames = ticketParticipantNames(ticket);
  return participantNames.some((name) => memberNames.includes(name));
}

function ticketIsSharedGroup(ticket) {
  if (!ticket) return false;
  const configuredAsGroup = Number(ticket.groupSize) === 2 || ticket.lessonKind === "2대1";
  return configuredAsGroup && Math.max(ticketParticipantUserIds(ticket).length, ticketParticipantNames(ticket).length) >= 2;
}

function ticketUsesPerParticipantGroupOwnership(ticket, allLiveData = adminLiveDataState) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  if (!ticketId || !ticketIsSharedGroup(ticket)) return false;
  const activeLinks = (allLiveData.groupTicketLinks || []).filter((link) => (
    ["active", "linked"].includes(String(link.status || "active").toLowerCase())
    && String(link.ticket_id || "") === ticketId
    && link.group_account_id
  ));
  if (!activeLinks.length) return false;
  return activeLinks.some((link) => {
    const accountTicketIds = new Set((allLiveData.groupTicketLinks || [])
      .filter((candidate) => (
        ["active", "linked"].includes(String(candidate.status || "active").toLowerCase())
        && String(candidate.group_account_id || "") === String(link.group_account_id)
      ))
      .map((candidate) => String(candidate.ticket_id || ""))
      .filter(Boolean));
    return accountTicketIds.size > 1;
  });
}

function memberDirectoryTickets(member) {
  const operationalTickets = memberOperationalTickets(member);
  const memberUserIds = new Set(memberServerUserIds(member).map(String));
  const ownedTickets = operationalTickets.filter((ticket) => (
    !ticketUsesPerParticipantGroupOwnership(ticket)
    || memberUserIds.has(String(ticket.serverUserId || ""))
  ));
  return ownedTickets.length ? ownedTickets : operationalTickets;
}

function ticketPartnerNames(ticket, memberReference, allLiveData = adminLiveDataState) {
  const memberRecords = memberRecordsForReference(memberReference);
  const memberUserIds = [...new Set(memberRecords.flatMap(memberServerUserIds))];
  const memberNames = memberRecords.length
    ? memberRecords.map((member) => member.name)
    : splitMemberNames(memberReference);
  const partnerNamesById = ticketParticipantUserIds(ticket)
    .filter((userId) => !memberUserIds.includes(userId))
    .map((userId) => (allLiveData.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set([
    ...partnerNamesById,
    ...ticketParticipantNames(ticket).filter((name) => !memberNames.includes(name)),
  ])];
}

function ticketPriorityForMember(ticket, memberReference) {
  const memberUserIds = memberRecordsForReference(memberReference).flatMap(memberServerUserIds);
  const derivedState = window.TennisNoteTicketState?.derive(ticket) || "";
  const stateScore = ({ current: 5000, paused: 4000, upcoming: 3000, pending_payment: 2000 })[derivedState] || 0;
  let score = stateScore;
  if (ticket.remaining > 0) score += 1000;
  if (ticketIsSharedGroup(ticket)) score += 500;
  score += ticketParticipantUserIds(ticket).length * 20;
  if (memberUserIds.includes(ticket.serverUserId)) score += 10;
  if (ticket.status === "active") score += 5;
  return score;
}

function ticketsForMember(memberReference) {
  const memberKey = memberReference && typeof memberReference === "object"
    ? String(memberReference.serverUserId || memberReference.id || memberReference.name || "")
    : String(memberReference || "");
  const branchKey = activeOperationBranchId();
  const cacheKey = `current|${branchKey}|${memberKey}`;
  const cached = memberKey ? memberTicketsIndex.get(cacheKey) : null;
  if (cached) return cached;
  const matches = operationBranchTickets()
    .filter((ticket) => ticketBelongsToMember(ticket, memberReference))
    .sort((left, right) => ticketPriorityForMember(right, memberReference) - ticketPriorityForMember(left, memberReference));
  if (memberKey) memberTicketsIndex.set(cacheKey, matches);
  return matches;
}

function allTicketsForMember(memberReference) {
  const memberKey = memberReference && typeof memberReference === "object"
    ? String(memberReference.serverUserId || memberReference.id || memberReference.name || "")
    : String(memberReference || "");
  const branchKey = activeOperationBranchId();
  const cacheKey = `all|${branchKey}|${memberKey}`;
  const cached = memberKey ? memberTicketsIndex.get(cacheKey) : null;
  if (cached) return cached;
  const ticketById = new Map();
  [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)].forEach((ticket) => {
    const ticketId = String(ticket.serverTicketId || ticket.id || "");
    if (ticketId && !ticketById.has(ticketId)) ticketById.set(ticketId, ticket);
  });
  const matches = [...ticketById.values()]
    .filter((ticket) => ticketBelongsToMember(ticket, memberReference))
    .sort((left, right) => ticketPriorityForMember(right, memberReference) - ticketPriorityForMember(left, memberReference));
  if (memberKey) memberTicketsIndex.set(cacheKey, matches);
  return matches;
}

function memberPartnerNames(member) {
  return [...new Set(ticketsForMember(member).flatMap((ticket) => (
    ticketIsSharedGroup(ticket) ? ticketPartnerNames(ticket, member) : []
  )))];
}

const memberManagementDayLabels = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

function memberManagementDayLabel(day) {
  return memberManagementDayLabels[Number(day)] || "";
}

const memberPaymentRecordStates = new Set(["unentered", "complete", "transfer_zero", "incomplete"]);

function memberPaymentRecordState(record = null) {
  const explicitState = String(record?.payment_record_state || "").trim();
  if (memberPaymentRecordStates.has(explicitState)) return explicitState;
  const amount = Number(record?.payment_amount) || 0;
  const date = String(record?.payment_recorded_on || "").trim();
  const method = String(record?.payment_method || "").trim();
  if (amount === 0 && method === "membership_transfer") return "transfer_zero";
  if (amount > 0 && date && method) return "complete";
  if (amount > 0 || date || method) return "incomplete";
  return "unentered";
}

function memberPaymentRecordStateLabel(state = "") {
  return ({
    unentered: "미입력",
    complete: "결제 완료",
    transfer_zero: "양도 · 0원",
    incomplete: "확인 필요",
  })[state] || "미입력";
}

function memberPaymentRecordStateOptions(record = null) {
  const state = memberPaymentRecordState(record);
  return [
    ["unentered", "미입력"],
    ["complete", "결제 완료"],
    ["transfer_zero", "양도 · 0원"],
    ...(state === "incomplete" ? [["incomplete", "확인 필요 · 기존값 유지"]] : []),
  ].map(([value, label]) => `<option value="${value}" ${state === value ? "selected" : ""}>${label}</option>`).join("");
}

function normalizeMemberManagementPaymentPayload(payload = null) {
  if (!payload) return payload;
  const inferredState = memberPaymentRecordState({
    payment_record_state: payload.paymentRecordState,
    payment_recorded_on: payload.paymentDate,
    payment_method: payload.paymentMethod,
    payment_amount: payload.paymentAmount,
  });
  payload.paymentRecordState = inferredState;
  if (inferredState === "transfer_zero") {
    payload.paymentAmount = 0;
    payload.paymentMethod = "membership_transfer";
  } else if (inferredState === "unentered") {
    payload.paymentDate = null;
    payload.paymentMethod = null;
    payload.paymentAmount = 0;
  }
  return payload;
}

function memberPaymentRecordMatchesPayload(record = null, payload = null) {
  if (!record || !payload) return false;
  return memberPaymentRecordState(record) === String(payload.paymentRecordState || "unentered")
    && String(record.payment_recorded_on || "") === String(payload.paymentDate || "")
    && normalizeMemberPaymentMethod(record.payment_method) === normalizeMemberPaymentMethod(payload.paymentMethod)
    && Number(record.payment_amount || 0) === Number(payload.paymentAmount || 0);
}

function memberSearchValues(member) {
  const memberTickets = ticketsForMember(member);
  const ticket = memberTickets[0] || null;
  const record = memberDatabaseRecord(member, ticket);
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);
  return [
    member.name,
    member.phone,
    member.birthYear,
    member.neighborhood,
    memberGenderLabel(member.gender),
    member.coach,
    member.regularTime,
    member.lessonType,
    memberManagementLessonMethodLabel(record, ticket),
    memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
    memberManagementLessonDaysLabel(record, ticket),
    record?.lesson_start_on,
    record?.payment_recorded_on,
    paymentMethodLabel(record?.payment_method),
    record?.payment_amount,
    record?.admin_note,
    unlinkedPayment?.amount,
    unlinkedPayment?.method,
    ...memberPartnerNames(member),
    ...memberTickets.flatMap((ticket) => [ticket.member, ticket.product]),
  ];
}

function normalizedMemberSearchText(member) {
  const memberId = String(member?.serverUserId || member?.id || "");
  const cached = memberSearchIndex.get(memberId);
  if (cached) return cached;
  const value = memberSearchValues(member)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .join("\n");
  memberSearchIndex.set(memberId, value);
  return value;
}

function memberCurrentTicket(member) {
  return memberCurrentTickets(member)[0] || null;
}

function memberTicketGroups(member) {
  const memberTickets = allTicketsForMember(member);
  if (window.TennisNoteTicketState?.split) return window.TennisNoteTicketState.split(memberTickets);
  return {
    current: memberTickets.filter((ticket) => isCurrentMemberTicket(ticket)),
    upcoming: [],
    history: memberTickets.filter((ticket) => !isCurrentMemberTicket(ticket)),
  };
}

function memberCurrentTickets(member) {
  return memberTicketGroups(member).current;
}

function memberUpcomingTickets(member) {
  return memberTicketGroups(member).upcoming;
}

function memberTicketHistory(member) {
  return memberTicketGroups(member).history;
}

function memberOperationalTickets(member) {
  const currentAndUpcoming = [...memberCurrentTickets(member), ...memberUpcomingTickets(member)]
    .filter((ticket) => ticket?.status !== "voided");
  if (currentAndUpcoming.length) return currentAndUpcoming;
  return memberTicketHistory(member).filter((ticket) => ticket?.status !== "voided");
}

function memberDirectoryDisplayName(member, ticket = memberCurrentTicket(member)) {
  if (!member) return "회원";
  if (ticketIsSharedGroup(ticket)) {
    const participantNames = ticketParticipantNames(ticket);
    if (participantNames.length > 1) return participantNames.join(" & ");
  }
  return member.name;
}

function memberDirectoryUnitKey(member) {
  const ticket = memberCurrentTicket(member);
  if (ticketIsSharedGroup(ticket)) return `group:${ticket.serverTicketId || ticket.id}`;
  return `member:${member.serverUserId || member.id}`;
}

function dedupeMembersByLessonUnit(memberList) {
  const units = new Map();
  memberList.forEach((member) => {
    const key = memberDirectoryUnitKey(member);
    const current = units.get(key);
    const ticket = memberCurrentTicket(member);
    const isTicketOwner = memberServerUserIds(member).includes(ticket?.serverUserId);
    if (!current || isTicketOwner) units.set(key, member);
  });
  return [...units.values()];
}

function memberRemainingCount(member) {
  const currentTickets = memberCurrentTickets(member);
  if (currentTickets.length) {
    return Math.min(...currentTickets.map((ticket) => Math.max(0, Number(ticket.remaining) || 0)));
  }
  return Math.max(0, Number(member.remaining) || 0);
}

const authProviderChoices = [
  { value: "custom:naver", label: "네이버" },
  { value: "custom:kakao", label: "카카오" },
  { value: "apple", label: "Apple" },
  { value: "email", label: "이메일" },
];

function memberAuthStatusMarkup(member = {}) {
  const connection = memberAuthConnection(member);
  const label = connection.linked
    ? (connection.providers.map(authProviderLabel).filter(Boolean).join(" · ") || "연결됨")
    : "미연결";
  const detail = connection.linked
    ? `${connection.detail}${member.authLastSignInAt ? ` · 최근 로그인 ${notificationDateTimeLabel(member.authLastSignInAt)}` : ""}`
    : "회원이 앱에서 로그인하면 자동으로 연결 상태가 표시됩니다.";
  if (!connection.linked && operationsRole() === "admin" && member.id) {
    return `<button class="member-auth-link-action" type="button"
      data-open-member-management="app_link"
      data-member-management-member-id="${member.id}"
      title="${escapeHtml(detail)}">
        <span class="member-auth-status is-unlinked">${escapeHtml(label)}</span>
        <small>앱 연결</small>
      </button>`;
  }
  return `<span class="member-auth-status ${connection.linked ? "is-linked" : "is-unlinked"}" title="${escapeHtml(detail)}">${escapeHtml(label)}</span>`;
}

function memberRegistrationStage(member = {}) {
  const ticket = memberCurrentTicket(member);
  const record = member.memberRecord || null;
  const enrollmentStatus = String(member.enrollment?.status || "");
  const hasEnrollment = Boolean(member.enrollment);
  const hasVerifiedPayment = Boolean(member.unlinkedVerifiedPayment);

  if (ticket && ["active", "paused"].includes(String(ticket.status || "")) && Number(ticket.remaining) > 0) {
    return {
      code: "completed",
      label: "등록 완료",
      detail: "회원권과 수업 정보가 연결되어 있습니다.",
      action: "",
      actionLabel: "",
    };
  }
  if (member.authLinked && hasEnrollment && !record) {
    return {
      code: "link_required",
      label: "연결 필요",
      detail: "앱 가입 정보와 기존 수강 DB를 확인해 연결해 주세요.",
      action: "link_existing",
      actionLabel: "기존 회원 연결",
    };
  }
  if (hasVerifiedPayment) {
    return {
      code: "pending",
      label: "가입 대기",
      detail: "결제는 확인됐으며 회원권 발급이 필요합니다.",
      action: "assign",
      actionLabel: "회원권 발급",
    };
  }
  if (record || hasEnrollment || ["submitted", "needs_update", "approved"].includes(enrollmentStatus)) {
    return {
      code: "pending",
      label: "가입 대기",
      detail: record ? "회원권·코치·수업시간을 등록해 주세요." : "가입서를 확인하고 기존 회원 연결 여부를 결정해 주세요.",
      action: record ? "assign" : "link_existing",
      actionLabel: record ? "회원권 등록" : "기존 회원 확인",
    };
  }
  return null;
}

async function copyMemberAuthSql(memberId, mode) {
  const member = members.find((item) => item.id === Number(memberId));
  if (!member) return;
  const role = document.querySelector(`[data-auth-link-role="${member.id}"]`)?.value || defaultAuthRoleForMember(member);
  const provider = document.querySelector(`[data-auth-link-provider="${member.id}"]`)?.value || "";
  if (mode === "candidate") {
    await copyTextToClipboard(buildAuthCandidateSql(member, role));
    showToast("후보 조회 SQL 복사 완료");
    return;
  }
  if (!provider) {
    showToast("연결할 로그인 수단을 선택해 주세요");
    return;
  }
  const authUserId = document.querySelector(`[data-auth-link-auth="${member.id}"]`)?.value.trim() || "";
  const tnUserId = document.querySelector(`[data-auth-link-profile="${member.id}"]`)?.value.trim() || "";
  if (!isAuthUuid(authUserId)) {
    showToast("Auth 사용자 UUID를 확인해 주세요");
    return;
  }
  if (!isAuthUuid(tnUserId)) {
    showToast("회원 DB UUID를 확인해 주세요");
    return;
  }
  await copyTextToClipboard(buildAuthLinkSql(member, { authUserId, tnUserId, role, provider }));
  showToast("로그인 연결 SQL 복사 완료");
}

async function prepareAuthProviderSwitch(userId, button) {
  const fromProvider = document.querySelector(`[data-auth-switch-from="${userId}"]`)?.value || "";
  const targetProvider = document.querySelector(`[data-auth-switch-target="${userId}"]`)?.value || "";
  if (!fromProvider || !targetProvider) {
    showToast("현재 로그인과 변경할 로그인을 선택해 주세요.");
    return;
  }
  const message = `${authProviderLabel(fromProvider)} 로그인을 ${authProviderLabel(targetProvider)} 로그인으로 변경 준비할까요?\n\n회원이 24시간 안에 새 수단으로 로그인하면 기존 연결이 자동 해제됩니다.`;
  if (!window.confirm(message)) return;
  await invokeAdminAccountControl({
    action: "prepare_auth_provider_switch",
    userId,
    fromProvider,
    targetProvider,
  }, button, `${authProviderLabel(targetProvider)} 로그인 변경 대기를 시작했습니다.`);
}

async function unlinkAuthProvider(userId, provider, button) {
  const label = authProviderLabel(provider) || provider;
  if (!window.confirm(`${label} 로그인 연결을 해제할까요?\n\n다른 로그인 수단은 유지되고 과거 회원·수업 기록은 삭제되지 않습니다.`)) return;
  await invokeAdminAccountControl({
    action: "unlink_auth_provider",
    userId,
    provider,
  }, button, `${label} 로그인 연결을 해제했습니다.`);
}

function groupAccountForMemberTicket(member, ticket) {
  if (!member || !ticket) return null;
  const ticketId = String(ticket.serverTicketId || ticket.id || "");
  const memberUserIds = new Set(memberServerUserIds(member).map(String));
  const names = new Set([...splitMemberNames(member.name), ...splitMemberNames(ticket.member)]);
  return groupAccounts.find((account) => (
    (account.ticketIds || []).some((id) => String(id) === ticketId)
    || (account.members || []).some((item) => memberUserIds.has(String(item.userId || "")))
    || (account.members || []).some((item) => names.has(item.name))
  )) || null;
}

const ACCOUNT_DELETION_STALE_MS = 16 * 60 * 1000;
const accountDeletionExecutionInFlight = new Set();
let accountDeletionRetryTimer = 0;

function accountDeletionProcessingIsStale(request, now = Date.now()) {
  if (request?.status !== "processing") return false;
  const startedAt = Date.parse(request.executionStartedAt || "");
  return Number.isFinite(startedAt) && startedAt + ACCOUNT_DELETION_STALE_MS <= now;
}

function scheduleAccountDeletionRetryRefresh(requests) {
  if (accountDeletionRetryTimer) window.clearTimeout(accountDeletionRetryTimer);
  accountDeletionRetryTimer = 0;
  const now = Date.now();
  const nextRetryAt = (requests || [])
    .filter((request) => request.status === "processing")
    .map((request) => Date.parse(request.executionStartedAt || "") + ACCOUNT_DELETION_STALE_MS)
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((left, right) => left - right)[0];
  if (!nextRetryAt) return;
  accountDeletionRetryTimer = window.setTimeout(() => {
    accountDeletionRetryTimer = 0;
    loadServerAccountDeletionRequests();
  }, Math.max(250, nextRetryAt - now + 250));
}

function accountDeletionActionButton(request) {
  if (accountDeletionExecutionInFlight.has(request.id)) {
    return `<button class="small-button" type="button" disabled aria-busy="true">삭제 처리 중</button>`;
  }
  if (request.status === "pending") {
    return `<button class="small-button" type="button" data-review-account-deletion="reviewing" data-account-deletion-id="${escapeHtml(request.id)}">검토 시작</button>`;
  }
  if (request.status === "reviewing") {
    return `<button class="small-button danger-button" type="button" data-review-account-deletion="completed" data-account-deletion-id="${escapeHtml(request.id)}">계정 삭제 실행</button>`;
  }
  if (request.status === "failed" || accountDeletionProcessingIsStale(request)) {
    return `<button class="small-button danger-button" type="button" data-review-account-deletion="completed" data-account-deletion-id="${escapeHtml(request.id)}">삭제 다시 시도</button>`;
  }
  if (request.status === "processing") {
    return `<button class="small-button" type="button" disabled>삭제 처리 중</button>`;
  }
  return "";
}

function memberTicketKind(member) {
  const ticket = memberCurrentTicket(member);
  return ticket ? membershipProductForTicket(ticket).productKind : "none";
}

function memberHasTicketKind(member, productKind) {
  const groups = memberTicketGroups(member);
  const relevantTickets = state.memberFilter === "expired"
    ? groups.history
    : [...groups.current, ...groups.upcoming];
  return relevantTickets.some((ticket) => membershipProductForTicket(ticket).productKind === productKind);
}

function memberCoachNames(member, allCoaches = coaches) {
  const ticketCoachNames = [...memberCurrentTickets(member), ...memberUpcomingTickets(member)]
    .map((ticket) => allCoaches.find((coach) => (
      String(coach.serverRoleId || "") === String(ticket.coachRoleId || "")
      || String(coach.id || "") === String(ticket.coachId || "")
    ))?.name)
    .filter(Boolean);
  return [...new Set([member.coach, ...ticketCoachNames].filter(Boolean))];
}

function filteredMembers() {
  const localSearch = String(state.memberSearch || "").trim().toLowerCase();
  const globalSearch = String($("#globalSearch")?.value || "").trim();
  const matchingMembers = operationBranchMembers().filter((member) => {
    if (memberListStatus(member) === "journal") return false;
    const statusMatch = memberMatchesStatusFilter(member, state.memberFilter);
    const coachMatch = state.memberCoachFilter === "all" || memberCoachNames(member).includes(state.memberCoachFilter);
    const ticketMatch = state.memberTicketFilter === "all" || memberHasTicketKind(member, state.memberTicketFilter);
    const searchValues = globalSearch ? memberSearchValues(member) : [];
    const localMatch = !localSearch || normalizedMemberSearchText(member).includes(localSearch);
    return statusMatch
      && coachMatch
      && ticketMatch
      && localMatch
      && matchesSearch([...searchValues, memberStatusLabel(member)]);
  });
  return matchingMembers;
}

function memberIsExpiring(member) {
  return memberListStatus(member) === "active"
    && memberCurrentTickets(member).some((ticket) => Math.max(0, Number(ticket.remaining) || 0) <= 2);
}

function memberMatchesStatusFilter(member, filter) {
  return filter === "expiring"
    ? memberIsExpiring(member)
    : memberListStatus(member) === filter;
}

const memberFilterCopy = {
  active: { summary: "명 수강중", empty: "수강중인 회원이 없습니다." },
  expiring: { summary: "명 만료임박", empty: "잔여 2회 이하 회원이 없습니다." },
  pending: { summary: "명 가입서·결제대기", empty: "가입서·결제 대기 회원이 없습니다." },
  expired: { summary: "명 만료", empty: "만료된 회원이 없습니다." },
  inactive: { summary: "명 삭제", empty: "삭제 처리된 회원이 없습니다." },
};

function memberStatusCounts() {
  return operationBranchMembers().reduce((counts, member) => {
    const status = memberListStatus(member);
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    if (memberIsExpiring(member)) counts.expiring += 1;
    return counts;
  }, { active: 0, expiring: 0, expired: 0, pending: 0, inactive: 0 });
}

function currentOperationsCoachRoleIds() {
  const profileId = adminImportAuthState.profile?.id || "";
  return new Set((adminLiveDataState.coachRoles || [])
    .filter((role) => role.user_id === profileId && role.status === "approved")
    .map((role) => role.id));
}

function currentOperationsCoachIds(allCoaches = coaches) {
  const roleIds = currentOperationsCoachRoleIds();
  return new Set(allCoaches
    .filter((coach) => roleIds.has(coach.serverRoleId))
    .map((coach) => coach.id));
}

function recordBelongsToCurrentCoach(record = {}, allMembers = members) {
  if (operationsRole() !== "coach") return true;
  const coachIds = currentOperationsCoachIds();
  if (record.coachId) return coachIds.has(record.coachId);
  const memberNames = splitMemberNames(record.member || "");
  if (!memberNames.length) return false;
  return allMembers.some((member) => (
    memberNames.includes(member.name)
    && coachIds.has(member.coachId)
  ));
}

function memberManagementActionAllowed(action, ticket = null) {
  const role = operationsRole();
  if (role === "admin") return true;
  if (role !== "coach" || !ticket?.serverTicketId) return false;
  const policyAllows = action === "correct"
    ? memberManagementPolicy.coachCanCorrectTicket
    : action === "expire"
      ? memberManagementPolicy.coachCanExpireTicket
      : action === "reenroll" && memberManagementPolicy.coachCanReenroll;
  return Boolean(policyAllows && currentOperationsCoachRoleIds().has(ticket.coachRoleId));
}

function memberTicketStatusLabel(ticket) {
  if (window.TennisNoteTicketState?.label) return window.TennisNoteTicketState.label(ticket);
  return ({
    active: "사용 중",
    paused: "일시정지",
    pending_payment: "결제 대기",
    expired: "만료",
    refunded: "환불 완료",
    voided: "삭제 처리",
  })[ticket?.status] || "상태 확인";
}

function memberManagementTickets(member) {
  const byId = new Map();
  [...tickets, ...expiredTickets].forEach((ticket) => {
    if (ticket?.serverTicketId && ticketBelongsToMember(ticket, member)) {
      byId.set(ticket.serverTicketId, ticket);
    }
  });
  if (window.TennisNoteTicketState?.sort) return window.TennisNoteTicketState.sort([...byId.values()]);
  const statusPriority = { active: 0, paused: 1, pending_payment: 2, expired: 3, refunded: 4, voided: 5 };
  return [...byId.values()].sort((left, right) => (
    (statusPriority[left.status] ?? 9) - (statusPriority[right.status] ?? 9)
    || String(right.expires || "").localeCompare(String(left.expires || ""))
  ));
}

function memberTicketListMarkup(member) {
  const grouped = window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(memberManagementTickets(member))
    : { current: memberManagementTickets(member).filter((ticket) => isCurrentMemberTicket(ticket)), upcoming: [] };
  const managedTickets = [...grouped.current, ...grouped.upcoming].filter((ticket) => ticket.status !== "voided");
  if (!managedTickets.length) return '<span class="member-table-muted">미등록</span>';
  const possibleDuplicateIds = memberPossibleDuplicateTicketIds(managedTickets);
  return `<div class="member-ticket-summary-list" aria-label="${escapeHtml(member.name)} 회원권 ${managedTickets.length}개">
    ${managedTickets.map((ticket, index) => {
      const ticketId = String(ticket.serverTicketId || ticket.id || "");
      const ownershipLabel = managedTickets.length > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
      const possibleDuplicate = possibleDuplicateIds.has(String(ticket.serverTicketId || ""));
      const sequenceLabel = managedTickets.length > 1 ? `회원권 ${index + 1}/${managedTickets.length}` : "";
      const periodLabel = [ticket.actualLessonStart || ticket.purchased, ticket.expires].filter(Boolean).map(memberDetailDateLabel).join("~");
      const contextLabel = [sequenceLabel, ownershipLabel, possibleDuplicate ? "중복 가능" : ""].filter(Boolean).join(" · ");
      return `
      <button class="member-ticket-summary-button member-ticket-summary-line ${possibleDuplicate ? "is-possible-duplicate" : ""}" type="button" data-select-member="${member.id}" data-member-ticket="${escapeHtml(ticketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} ${escapeHtml(contextLabel)} ${escapeHtml(memberTicketStatusLabel(ticket))} 확인">
        ${contextLabel ? `<span class="member-ticket-context-label">${escapeHtml(contextLabel)}</span>` : ""}
        <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
        <small>${escapeHtml(memberTicketStatusLabel(ticket))} · ${escapeHtml(ticketUsageLabel(ticket))}${periodLabel ? ` · ${escapeHtml(periodLabel)}` : ""}</small>
      </button>`;
    }).join("")}
  </div>`;
}

function memberPaymentOverviewMarkup(member) {
  const managedTickets = memberManagementTickets(member).filter((ticket) => ticket.status !== "voided");
  const paymentRows = managedTickets.map((ticket) => {
    const record = memberDatabaseRecord(member, ticket);
    const paymentState = memberPaymentRecordState(record);
    if (!record || paymentState === "unentered") return null;
    if (paymentState === "transfer_zero") {
      const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "양도일 미입력";
      return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>양도 · 0원</small></span>`;
    }
    const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "일자 미입력";
    const method = record.payment_method ? paymentMethodLabel(record.payment_method) : "수단 미입력";
    const amount = Number.isFinite(Number(record.payment_amount)) ? `${money.format(Number(record.payment_amount))}원` : "금액 미입력";
    const reviewLabel = paymentState === "incomplete" ? "확인 필요 · " : "";
    return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${reviewLabel}${method} · ${amount}`)}</small></span>`;
  }).filter(Boolean);
  if (paymentRows.length) return paymentRows.slice(0, 3).join("") + (paymentRows.length > 3 ? `<small>외 ${paymentRows.length - 3}건</small>` : "");
  const recentPayment = latestMemberPayment(member);
  if (!recentPayment) return '<span class="member-table-muted">미입력</span>';
  const date = memberDetailDateLabel(recentPayment.paidAt || recentPayment.verifiedAt || recentPayment.requestedAt);
  const amount = money.format(recentPayment.finalAmount || recentPayment.amount || 0);
  return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${paymentMethodLabel(recentPayment.method)} · ${amount}원`)}</small></span>`;
}

function memberTicketRowMarkup(member, ticket, position = 1, count = 1, possibleDuplicate = false) {
  if (!ticket) return '<span class="member-table-muted">회원권 없음</span>';
  const ownershipLabel = count > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
  const context = [count > 1 ? `회원권 ${position}/${count}` : "", ownershipLabel, possibleDuplicate ? "중복 가능" : ""].filter(Boolean).join(" · ");
  const period = [ticket.actualLessonStart || ticket.purchased, ticket.expires]
    .filter(Boolean)
    .map(memberDetailDateLabel)
    .join("~");
  return `<span class="member-ticket-row-summary">
    ${context ? `<small>${escapeHtml(context)}</small>` : ""}
    <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
    <span>${escapeHtml(memberTicketStatusLabel(ticket))}${period ? ` · ${escapeHtml(period)}` : ""}</span>
  </span>`;
}

function memberTicketPaymentMarkup(member, ticket) {
  if (!ticket) return '<span class="member-table-muted">미입력</span>';
  const record = memberDatabaseRecord(member, ticket);
  const paymentState = memberPaymentRecordState(record);
  if (!record || paymentState === "unentered") {
    return '<span class="member-table-muted">미입력</span>';
  }
  if (paymentState === "transfer_zero") {
    const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "양도일 미입력";
    return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>양도 · 0원</small></span>`;
  }
  const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "일자 미입력";
  const method = record.payment_method ? paymentMethodLabel(record.payment_method) : "수단 미입력";
  const amount = Number.isFinite(Number(record.payment_amount)) ? `${money.format(Number(record.payment_amount))}원` : "금액 미입력";
  const reviewLabel = paymentState === "incomplete" ? "확인 필요 · " : "";
  return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${reviewLabel}${method} · ${amount}`)}</small></span>`;
}

function memberManagementProducts(sourceTicket = null, allLiveData = adminLiveDataState) {
  const sourceGroupSize = Number(sourceTicket?.groupSize) || 1;
  const branchId = sourceTicket?.branchId || activeOperationBranchId();
  return (allLiveData.products || [])
    .filter((product) => product.is_active !== false
      && (!branchId || product.branch_id === branchId)
      && (!sourceTicket || Number(product.group_size || 1) === sourceGroupSize))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function memberManagementCoachRoles(sourceTicket = null, allLiveData = adminLiveDataState) {
  const ownRoleIds = currentOperationsCoachRoleIds();
  const branchId = sourceTicket?.branchId || activeOperationBranchId();
  return (allLiveData.coachRoles || [])
    .filter((role) => role.status === "approved"
      && !["ended", "archived"].includes(role.employment_status)
      && !role.archived_at
      && (!branchId || role.branch_id === branchId)
      && (operationsRole() === "admin" || ownRoleIds.has(role.id)))
    .sort((left, right) => String(left.display_name || "").localeCompare(String(right.display_name || ""), "ko"));
}

function memberManagementLessonDaysMarkup(selectedDays = [], scheduleScope = "weekday") {
  const selected = new Set((selectedDays || []).map(Number));
  return Object.entries(memberManagementDayLabels).map(([day, label]) => {
    const dayNumber = Number(day);
    const scopeAllowed = scheduleScope === "mixed"
      || (scheduleScope === "weekend" ? [0, 6].includes(dayNumber) : dayNumber >= 1 && dayNumber <= 5);
    return `<label class="member-lesson-day-option ${scopeAllowed ? "" : "is-disabled"}">
      <input name="lessonDays" type="checkbox" value="${dayNumber}" ${selected.has(dayNumber) ? "checked" : ""} ${scopeAllowed ? "" : "disabled"} />
      <span>${label}</span>
    </label>`;
  }).join("");
}

function memberManagementDatabaseFields({
  member,
  ticket,
  record,
  product,
  coachRoles,
  coachRoleId,
  partnerOptions,
  existingPayment = null,
  isCreate = false,
  isAssign = false,
  includeTicketStatus = false,
}) {
  const couponProduct = memberManagementProductIsCoupon(product);
  const productScheduleScope = memberManagementProductScheduleScope(product);
  const scheduleScope = (isAssign ? productScheduleScope : record?.lesson_schedule_scope || ticket?.scheduleScope) || productScheduleScope;
  const weeklyFrequency = couponProduct
    ? 1
    : Number((isAssign ? product?.frequency_per_week : record?.lesson_frequency_per_week || ticket?.weeklyCount) || product?.frequency_per_week || 1);
  const lessonType = (isAssign ? "" : record?.lesson_type || ticket?.lessonTypeCode) || (Number(product?.group_size || 1) === 2 ? "one_on_two" : "one_on_one");
  const lessonDays = isAssign ? [] : Array.isArray(record?.lesson_days) ? record.lesson_days : ticket?.lessonDays || [];
  const hasTicket = Boolean(ticket?.serverTicketId || isCreate || isAssign);
  const totalSessions = isAssign ? Number(product?.total_sessions || 1) : record?.total_sessions ?? ticket?.total ?? (isCreate ? Number(product?.total_sessions || 1) : null);
  const usedSessions = isAssign ? 0 : record?.used_sessions ?? ticket?.used ?? (isCreate ? 0 : null);
  const remainingSessions = isAssign ? Number(product?.total_sessions || 1) : record?.remaining_sessions ?? ticket?.remaining ?? (isCreate ? Number(product?.total_sessions || 1) : null);
  const startsOn = isAssign ? adminLocalDateKey(new Date()) : record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || (isCreate ? adminLocalDateKey(new Date()) : "");
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const expiresOn = ticket?.expires || (isCreate || isAssign ? addMemberManagementDays(startsOn, validityDays - 1) : "");
  const existingPaymentDate = String(existingPayment?.paid_at || existingPayment?.verified_at || existingPayment?.created_at || "").slice(0, 10);
  const paymentDate = isAssign ? existingPaymentDate : record?.payment_recorded_on || "";
  const paymentMethod = isAssign ? existingPayment?.method || "" : record?.payment_method || "";
  const paymentAmount = isAssign
    ? Number(existingPayment?.final_amount ?? existingPayment?.amount ?? product?.cash_price ?? product?.card_price ?? 0)
    : record?.payment_amount ?? (isCreate ? 0 : "");
  const paymentRecordState = isAssign && existingPayment
    ? "complete"
    : record
      ? memberPaymentRecordState(record)
      : "unentered";
  const note = record ? record.admin_note || "" : member?.note || "";
  const partnerUserId = ticket && member ? memberTicketPartnerUserId(ticket, member) : "";
  const recordStatus = record?.record_status || (ticket?.status === "expired" ? "historical" : hasTicket ? "active" : "pending");
  const ticketStatus = ["active", "paused", "pending_payment", "expired"].includes(ticket?.status) ? ticket.status : "active";
  return `
    <input name="recordStatus" type="hidden" value="${escapeHtml(recordStatus)}" />
    ${isAssign && existingPayment ? `<input name="existingPaymentId" type="hidden" value="${escapeHtml(existingPayment.id)}" />
      <div class="member-management-warning"><strong>기존 결제 기록 연결</strong><span>${escapeHtml(paymentMethodLabel(existingPayment.method))} · ${money.format(Number(existingPayment.final_amount ?? existingPayment.amount ?? 0))}원 · 회원권 발급 후 같은 결제 기록에 연결됩니다.</span></div>` : ""}
    <div class="member-management-form-grid member-database-fields">
      <label class="form-field">${memberManagementFieldLabel("레슨강사", true)}<select name="coachRoleId" required>
        ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
      </select></label>
      ${couponProduct ? `<input name="scheduleScope" type="hidden" value="${escapeHtml(scheduleScope)}" />` : `<label class="form-field">${memberManagementFieldLabel("레슨방식", true)}<select name="scheduleScope" required>
        <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일</option>
        <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말</option>
        <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
      </select></label>`}
      ${couponProduct ? '<input name="weeklyFrequency" type="hidden" value="1" />' : `<label class="form-field">${memberManagementFieldLabel("주당 횟수", true)}<select name="weeklyFrequency" required>
        ${[1, 2, 3].map((frequency) => `<option value="${frequency}" ${frequency === weeklyFrequency ? "selected" : ""} ${scheduleScope === "weekend" && frequency === 3 ? "disabled" : ""}>주 ${frequency}회</option>`).join("")}
      </select></label>`}
      <label class="form-field">${memberManagementFieldLabel("레슨종류", true)}<select name="lessonType" required>
        <option value="one_on_one" ${lessonType === "one_on_one" ? "selected" : ""}>1:1</option>
        <option value="one_on_two" ${lessonType === "one_on_two" ? "selected" : ""}>1:2</option>
      </select></label>
      ${couponProduct ? '<input name="lessonDays" type="hidden" value="" />' : `<label class="form-field span-2 member-lesson-days-field">${memberManagementFieldLabel("레슨요일", true)}<span class="member-lesson-day-options" data-member-lesson-days>${memberManagementLessonDaysMarkup(lessonDays, scheduleScope)}</span><small>주간 회차 안에서 요일을 나누거나 같은 날 연속으로 사용할 수 있습니다.</small></label>`}
      <label class="form-field">${memberManagementFieldLabel("레슨시작일", hasTicket)}<input name="startsOn" type="date" value="${escapeHtml(startsOn)}" ${hasTicket ? "required" : ""} /></label>
      ${hasTicket ? `<label class="form-field">${memberManagementFieldLabel("회원권 만료일", true)}<input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" required /></label>` : ""}
      <label class="form-field">${memberManagementFieldLabel("총 회차", hasTicket)}<input name="totalSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(totalSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field">${memberManagementFieldLabel("소진 회차", hasTicket)}<input name="usedSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(usedSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field">${memberManagementFieldLabel("잔여 회차", hasTicket)}<input name="remainingSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(remainingSessions))}" readonly aria-readonly="true" ${hasTicket ? "required" : ""} /><small>총 회차 - 소진 회차로 자동 계산</small></label>
      ${includeTicketStatus && ticket ? `<label class="form-field"><span>회원권 상태</span><select name="ticketStatus" required>
        <option value="active" ${ticketStatus === "active" ? "selected" : ""}>사용 중</option>
        <option value="paused" ${ticketStatus === "paused" ? "selected" : ""}>일시정지</option>
        ${ticketStatus === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
        <option value="expired" ${ticketStatus === "expired" ? "selected" : ""}>만료</option>
      </select></label>` : ""}
      <label class="form-field">${memberManagementFieldLabel("결제 구분")}<select name="paymentRecordState">${memberPaymentRecordStateOptions({
        payment_record_state: paymentRecordState,
        payment_recorded_on: paymentDate,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
      })}</select></label>
      <label class="form-field">${memberManagementFieldLabel("결제일자")}<input name="paymentDate" type="date" value="${escapeHtml(paymentDate)}" /></label>
      <label class="form-field">${memberManagementFieldLabel("결제수단")}<select name="paymentMethod">
        <option value="" ${paymentMethod ? "" : "selected"}>미입력</option>
        <option value="card" ${paymentMethod === "card" ? "selected" : ""}>카드</option>
        <option value="bank" ${["bank", "bank_transfer", "transfer"].includes(paymentMethod) ? "selected" : ""}>계좌이체</option>
        <option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>현금</option>
        <option value="manual" ${paymentMethod === "manual" ? "selected" : ""}>관리자 입력</option>
        ${paymentMethod && !["card", "bank", "bank_transfer", "transfer", "cash", "manual"].includes(paymentMethod) ? `<option value="${escapeHtml(paymentMethod)}" selected>${escapeHtml(paymentMethodLabel(paymentMethod))}</option>` : ""}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("결제금액")}<input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(paymentAmount))}" /></label>
      <label class="form-field span-2">${memberManagementFieldLabel("비고")}<textarea name="note" rows="3" maxlength="500">${escapeHtml(note)}</textarea></label>
      <div class="form-field span-2 member-partner-editor ${lessonType === "one_on_two" ? "" : "is-disabled"}" data-manual-member-partner-field>
        ${memberManagementFieldLabel("1:2 파트너", lessonType === "one_on_two")}
        ${isCreate ? `<div class="member-partner-mode" role="radiogroup" aria-label="파트너 등록 방법">
          <label><input name="partnerMode" type="radio" value="new" checked />새 파트너 같이 등록</label>
          <label><input name="partnerMode" type="radio" value="existing" />기존 회원 연결</label>
        </div>
        <div class="member-partner-new-fields" data-manual-new-partner>
          <label class="form-field">${memberManagementFieldLabel("파트너 실명", true)}<input name="partnerName" type="text" minlength="2" maxlength="40" autocomplete="off" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 휴대전화")}<input name="partnerPhone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 출생연도")}<input name="partnerBirthYear" type="number" min="1900" max="2100" step="1" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 성별")}<select name="partnerGender"><option value="">미입력</option><option value="female">여성</option><option value="male">남성</option><option value="other">기타</option><option value="prefer_not">응답 안 함</option></select></label>
        </div>` : ""}
        <div class="member-partner-existing-fields" data-manual-existing-partner data-current-member-user-id="${escapeHtml(member?.serverUserId || "")}" ${isCreate ? "hidden" : ""}>
          <input name="partnerSearch" type="search" autocomplete="off" placeholder="이름 또는 전화번호 검색" data-manual-member-partner-search />
          <div class="member-partner-search-results" data-manual-member-partner-results aria-live="polite"></div>
          <select name="partnerUserId" ${lessonType === "one_on_two" && !isCreate ? "required" : "disabled"}>
            <option value="">파트너 선택</option>
            ${partnerOptions.filter((user) => user.id !== member?.serverUserId).map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "회원")}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>`;
}

function memberCreateScheduleMarkup(product) {
  const regularProduct = memberManagementProductSupportsRegularSchedule(product);
  const frequency = memberManagementProductWeeklyFrequency(product);
  const scope = memberManagementProductScheduleScope(product);
  const rows = Array.from({ length: 3 }, (_, offset) => {
    const index = offset + 1;
    const dayButtons = memberScheduleDayOrder.map((day) => {
      const allowed = memberScheduleDayAllowed(scope, day);
      return `<button type="button" class="member-inline-day-chip" data-member-schedule-day="${day}" aria-pressed="false" ${allowed ? "" : "disabled"}>${memberManagementDayLabel(day)}</button>`;
    }).join("");
    return `<div class="member-inline-schedule-row" data-member-schedule-row="${index}" ${index > frequency ? "hidden" : ""}>
      <span class="member-inline-schedule-index">정규 ${index}</span>
      <input type="hidden" name="scheduleDay${index}" value="" ${index > frequency ? "disabled" : ""} />
      <div class="member-inline-day-tabs" role="group" aria-label="정규 ${index} 요일">${dayButtons}</div>
      <select name="scheduleTime${index}" aria-label="정규 ${index} 시간" ${index > frequency ? "disabled" : ""}>
        <option value="">시간 선택</option>
        ${getScheduleTimeOptions().map((time) => `<option value="${time}">${time}</option>`).join("")}
      </select>
    </div>`;
  }).join("");
  return `<section class="member-inline-schedule member-create-schedule" data-member-inline-schedule data-member-create-schedule data-product-kind="${escapeHtml(product?.product_kind || "")}" ${regularProduct ? "" : "hidden"}>
    <div class="member-inline-schedule-heading"><strong>정규 요일·시간</strong><span>회원 저장과 동시에 시간표에 생성됩니다.</span></div>
    ${rows}
    <label class="member-create-schedule-later"><input name="createScheduleLater" type="checkbox" /> 시간표는 나중에 설정</label>
    <p class="member-inline-schedule-warning" data-member-schedule-warning></p>
  </section>`;
}

function memberSimpleTicketFields(product, coachRoles, coachRoleId, partnerOptions) {
  const total = Number(product?.total_sessions || 1);
  const startsOn = adminLocalDateKey(new Date());
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const isGroup = Number(product?.group_size || 1) === 2;
  const scheduleScope = memberManagementProductScheduleScope(product);
  return `
    <input name="createWithoutSchedule" type="hidden" value="${memberManagementProductSupportsRegularSchedule(product) ? "false" : "true"}" />
    <input name="recordStatus" type="hidden" value="active" />
    <input name="scheduleScope" type="hidden" value="${escapeHtml(scheduleScope)}" />
    <input name="weeklyFrequency" type="hidden" value="${memberManagementProductWeeklyFrequency(product)}" />
    <input name="lessonType" type="hidden" value="${isGroup ? "one_on_two" : "one_on_one"}" />
    <input name="startsOn" type="hidden" value="${escapeHtml(startsOn)}" />
    <input name="expiresOn" type="hidden" value="${escapeHtml(addMemberManagementDays(startsOn, validityDays - 1))}" />
    <input name="usedSessions" type="hidden" value="0" />
    <input name="remainingSessions" type="hidden" value="${total}" />
    <input name="note" type="hidden" value="" />
    <div class="member-management-form-grid member-simple-ticket-fields">
      <label class="form-field span-2">${memberManagementFieldLabel("회원권", true)}<select name="productId" required>
        ${memberManagementProducts().map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")}</option>`).join("")}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("담당 코치", true)}<select name="coachRoleId" required>
        ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("총 횟수", true)}<input name="totalSessions" type="number" min="1" step="1" value="${total}" required /></label>
      <label class="form-field">${memberManagementFieldLabel("결제일")}<input name="paymentDate" type="date" value="${startsOn}" /></label>
      <label class="form-field">${memberManagementFieldLabel("결제수단")}<select name="paymentMethod">
        <option value="">미입력</option>
        <option value="card">카드</option>
        <option value="bank_transfer">계좌이체</option>
        <option value="cash">현금</option>
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("결제금액")}<input name="paymentAmount" type="number" min="0" step="1" value="0" /></label>
      <div class="form-field span-2 member-partner-editor ${isGroup ? "" : "is-disabled"}" data-manual-member-partner-field ${isGroup ? "" : "hidden"}>
        ${memberManagementFieldLabel("1:2 파트너", isGroup)}
        <div class="member-partner-mode" role="radiogroup" aria-label="파트너 등록 방법">
          <label><input name="partnerMode" type="radio" value="new" checked /> 새 파트너 같이 등록</label>
          <label><input name="partnerMode" type="radio" value="existing" /> 기존 회원 연결</label>
        </div>
        <div class="member-partner-new-fields" data-manual-new-partner>
          <label class="form-field">${memberManagementFieldLabel("파트너 이름", true)}<input name="partnerName" type="text" minlength="2" maxlength="40" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 휴대전화")}<input name="partnerPhone" type="tel" inputmode="tel" maxlength="20" /></label>
          <input name="partnerBirthYear" type="hidden" value="" />
          <input name="partnerGender" type="hidden" value="" />
        </div>
        <div class="member-partner-existing-fields" data-manual-existing-partner hidden>
          <input name="partnerSearch" type="search" autocomplete="off" placeholder="파트너 이름 검색" data-manual-member-partner-search />
          <div class="member-partner-search-results" data-manual-member-partner-results aria-live="polite"></div>
          <select name="partnerUserId" disabled>
            <option value="">파트너 선택</option>
            ${partnerOptions.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || "회원")}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
    ${memberCreateScheduleMarkup(product)}`;
}

function manualMemberPartnerOptions(allLiveData = adminLiveDataState) {
  const activeBranchId = activeOperationBranchId();
  const allowedUserIds = activeBranchId
    ? new Set(operationBranchMembers().flatMap((member) => memberServerUserIds(member)))
    : null;
  return (allLiveData.users || [])
    .filter((user) => (
      user.role === "member"
      && user.status === "active"
      && (!allowedUserIds || allowedUserIds.has(String(user.id || "")))
    ))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function memberMembershipLinkTargets(sourceMember, query = "", allMembers = members) {
  if (!sourceMember?.serverUserId || !sourceMember.authLinked) return [];
  const keyword = normalizedMemberLinkSearch(query);
  const keywordDigits = normalizedMemberPhone(query);
  const sourceName = normalizedMemberLinkSearch(sourceMember.name);
  const sourcePhone = normalizedMemberPhone(sourceMember.phone);
  const candidates = allMembers.filter((candidate) => {
    if (!candidate?.serverUserId || candidate.serverUserId === sourceMember.serverUserId || candidate.authLinked) return false;
    const status = memberListStatus(candidate);
    if (["journal", "inactive"].includes(status)) return false;
    const hasMembershipRecord = memberManagementTickets(candidate).length > 0
      || !["journal_only", "lesson_pending"].includes(candidate.memberKind);
    if (!hasMembershipRecord) return false;
    if (!keyword) return true;
    const fields = [candidate.name, candidate.nickname].map(normalizedMemberLinkSearch);
    const phone = normalizedMemberPhone(candidate.phone);
    return fields.some((value) => value.includes(keyword))
      || (keywordDigits.length >= 4 && phone.includes(keywordDigits));
  }).map((candidate) => {
    const candidateName = normalizedMemberLinkSearch(candidate.name);
    const candidatePhone = normalizedMemberPhone(candidate.phone);
    const score = (sourcePhone.length >= 9 && sourcePhone === candidatePhone ? 100 : 0)
      + (sourceName && sourceName === candidateName ? 50 : 0)
      + (sourceMember.birthYear && sourceMember.birthYear === candidate.birthYear ? 20 : 0);
    return { ...candidate, score };
  }).sort((left, right) => right.score - left.score || String(left.name || "").localeCompare(String(right.name || ""), "ko"));
  const strongMatches = candidates.filter((candidate) => candidate.score >= 100);
  return candidates.map((candidate) => ({
    ...candidate,
    recommended: candidate.score >= 100 && strongMatches.length === 1,
  }));
}

function memberMembershipTargetLabel(candidate = {}) {
  const phoneLast4 = normalizedMemberPhone(candidate.phone).slice(-4);
  const ticket = memberCurrentTicket(candidate) || memberManagementTickets(candidate)[0] || null;
  const ticketLabel = ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "기존 회원 DB";
  return `${candidate.name || "회원"}${phoneLast4 ? ` · ${phoneLast4}` : ""} · ${ticketLabel}${candidate.recommended ? " · 추천" : ""}`;
}

function memberTicketForceDeletePreviewMarkup() {
  if (memberManagementModalState.forceDeletePreviewLoading) {
    return `<div class="member-ticket-delete-preview is-loading" role="status">
      <strong>삭제 영향 확인 중</strong>
      <span>연결 수업·결제·엑셀 이관 기록을 서버에서 확인하고 있습니다.</span>
    </div>`;
  }
  if (memberManagementModalState.forceDeletePreviewError) {
    return `<div class="member-ticket-delete-preview is-error" role="alert">
      <strong>삭제 준비를 확인하지 못했습니다.</strong>
      <span>${escapeHtml(memberManagementModalState.forceDeletePreviewError)}</span>
    </div>`;
  }
  const preview = memberManagementModalState.forceDeletePreview;
  if (!preview?.ok) return "";
  const linkedLessons = Math.max(0, Number(preview.linkedLessons) || 0);
  const completedLessons = Math.max(0, Number(preview.completedLessons) || 0);
  const preservedPayments = Math.max(0, Number(preview.preservedPayments) || 0);
  const importedRows = Math.max(0, Number(preview.importedRows) || 0);
  const relationshipLinks = Math.max(0, Number(preview.participantLinks) || 0)
    + Math.max(0, Number(preview.groupLinks) || 0);
  return `<div class="member-ticket-delete-preview is-ready" role="status">
    <strong>삭제 전 영향 확인 완료</strong>
    <span>연결 수업 ${linkedLessons}건${completedLessons ? ` · 완료 ${completedLessons}건 회차 복원` : ""}</span>
    <span>결제 증빙 ${preservedPayments}건 보존 · 참여 연결 ${relationshipLinks}건 정리</span>
    ${importedRows ? `<span>엑셀 이관 연결 ${importedRows}건은 감사기록에 개수를 남기고 정리</span>` : ""}
  </div>`;
}

function memberTicketFutureClosePreviewMarkup() {
  if (memberManagementModalState.closePreviewLoading) {
    return `<div class="member-ticket-delete-preview is-loading" role="status">
      <strong>종료할 회원권과 미래 수업 확인 중</strong>
      <span>회원권·파트너·미래 수업·보존할 결제 기록을 서버에서 확인하고 있습니다.</span>
    </div>`;
  }
  if (memberManagementModalState.closePreviewError) {
    return `<div class="member-ticket-delete-preview is-error" role="alert">
      <strong>종료 준비를 확인하지 못했습니다.</strong>
      <span>${escapeHtml(memberManagementModalState.closePreviewError)}</span>
    </div>`;
  }
  const preview = memberManagementModalState.closePreview;
  if (!preview?.ok) return "";
  const previewTickets = Array.isArray(preview.tickets) ? preview.tickets : [];
  return `<div class="member-ticket-delete-preview is-ready member-ticket-close-preview" role="status">
    <strong>회원권과 미래 수업을 모두 종료할까요?</strong>
    <span>남은 횟수는 소멸되고, 오늘 이후 예정 수업은 취소됩니다.</span>
    <span>회원은 만료회원으로 보존되며, 결제·환불·감사 기록은 유지됩니다.</span>
    <dl>
      <div><dt>회원명</dt><dd>${escapeHtml(preview.memberName || "회원")}</dd></div>
      <div><dt>종료 회원권</dt><dd>${Math.max(0, Number(preview.ticketCount) || 0)}개</dd></div>
      <div><dt>취소 예정 수업</dt><dd>${Math.max(0, Number(preview.futureLessonCount) || 0)}건</dd></div>
      <div><dt>1:2 파트너</dt><dd>${preview.hasPartner ? `${Math.max(1, Number(preview.partnerCount) || 0)}명 연결 종료` : "해당 없음"}</dd></div>
    </dl>
    ${previewTickets.map((ticket) => `<div class="member-ticket-close-preview-row">
      <strong>${escapeHtml(ticket.productName || "회원권")}</strong>
      <span>총 ${Number(ticket.totalSessions) || 0} · 사용 ${Number(ticket.usedSessions) || 0} · 잔여 ${Number(ticket.remainingSessions) || 0}</span>
    </div>`).join("")}
  </div>`;
}

function memberCreateStepIsValid(step) {
  const panel = $(`#memberManagementForm [data-member-create-panel="${step}"]`);
  if (!panel) return true;
  const controls = [...panel.querySelectorAll("input, select, textarea")].filter((control) => !control.disabled);
  const invalid = controls.find((control) => !control.checkValidity());
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
}

function filterManualMemberPartnerOptions(form) {
  if (!form?.elements?.partnerUserId) return;
  const select = form.elements.partnerUserId;
  const currentValue = select.value;
  const keyword = String(form.elements.partnerSearch?.value || "").trim().toLowerCase();
  const currentMemberUserId = form.querySelector("[data-manual-existing-partner]")?.dataset.currentMemberUserId || "";
  const options = manualMemberPartnerOptions().filter((user) => user.id !== currentMemberUserId && (
    !keyword
    || [user.name, user.nickname, user.phone].some((value) => String(value || "").toLowerCase().includes(keyword))
  ));
  select.innerHTML = [
    `<option value="">${keyword && !options.length ? "검색 결과 없음" : "파트너 선택"}</option>`,
    ...options.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || "회원")}${user.phone ? ` · ${escapeHtml(maskMemberPhone(user.phone))}` : ""}</option>`),
  ].join("");
  if (options.some((user) => String(user.id) === String(currentValue))) select.value = currentValue;
  const results = form.querySelector("[data-manual-member-partner-results]");
  if (results) {
    const visible = keyword ? options.slice(0, 8) : [];
    results.innerHTML = keyword
      ? visible.length
        ? visible.map((user) => `<button type="button" class="member-partner-result-button ${String(user.id) === String(select.value) ? "is-selected" : ""}" data-select-manual-member-partner="${escapeHtml(user.id)}"><strong>${escapeHtml(user.name || "회원")}</strong><span>${escapeHtml(maskMemberPhone(user.phone))}</span></button>`).join("")
        : '<p class="member-partner-no-result">검색 결과가 없습니다.</p>'
      : "";
    results.hidden = !keyword;
  }
}

function memberManagementSelectedDays(form) {
  return [...form.querySelectorAll('input[name="lessonDays"]:checked:not(:disabled)')]
    .map((input) => Number(input.value))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function memberManagementTicketMatchesPayload(serverTicket, payload, { verifyPayment = true } = {}) {
  if (!serverTicket || !payload) return false;
  const ticketMatches = String(serverTicket.productId || "") === String(payload.productId || "")
    && Number(serverTicket.total) === Number(payload.totalSessions)
    && Number(serverTicket.used) === Number(payload.usedSessions)
    && Number(serverTicket.remaining) === Number(payload.remainingSessions)
    && String(serverTicket.purchased || "") === String(payload.startsOn || "")
    && String(serverTicket.expires || "") === String(payload.expiresOn || "")
    && String(serverTicket.status || "").toLowerCase() === String(payload.ticketStatus || "active").toLowerCase();
  if (!ticketMatches) return false;
  return !verifyPayment || memberPaymentRecordMatchesPayload(serverTicket.memberRecord, payload);
}

function memberManagementWriteVerification(action, payload, result, statusAction = "keep") {
  const normalizedResult = normalizedRpcResult(result);
  const userId = normalizedResult.userId || payload?.userId || "";
  const ticketId = normalizedResult.ticketId || payload?.ticketId || "";
  const serverUser = (adminLiveDataState.users || []).find((user) => user.id === userId);
  const serverTicket = (adminLiveDataState.tickets || []).find((ticket) => ticket.serverTicketId === ticketId);

  if (action === "create") {
    if (!serverUser || !memberManagementTicketMatchesPayload(serverTicket, payload)) {
      return "member_management_write_not_confirmed:create";
    }
    if (payload?.lessonType === "one_on_two") {
      const partnerUserId = normalizedResult.partnerUserId || payload?.partnerUserId || "";
      const partnerUser = (adminLiveDataState.users || []).find((user) => user.id === partnerUserId);
      const participantIds = serverTicket.participantUserIds || [];
      if (!partnerUser || !partnerUserId || !participantIds.includes(userId) || !participantIds.includes(partnerUserId)) {
        return "member_management_write_not_confirmed:create_partner";
      }
    }
    return "";
  }
  if (action === "assign") {
    return serverUser && memberManagementTicketMatchesPayload(serverTicket, payload)
      ? ""
      : "member_management_write_not_confirmed:assign";
  }
  if (action === "link_existing") {
    return serverUser?.auth_user_id ? "" : "member_management_write_not_confirmed:link_existing";
  }
  if (action === "app_link") {
    return serverUser?.auth_user_id ? "" : "member_management_write_not_confirmed:app_link";
  }
  if (action === "profile") {
    if (!serverUser) return "member_management_write_not_confirmed:profile_user";
    if (serverUser.name !== payload?.name
      || String(serverUser.nickname || "") !== String(payload?.nickname || "")
      || normalizedMemberPhone(serverUser.phone) !== normalizedMemberPhone(payload?.phone)) {
      return "member_management_write_not_confirmed:profile_fields";
    }
    if (statusAction === "deactivate" && serverUser.status !== "inactive") return "member_management_write_not_confirmed:deactivate";
    if (statusAction === "restore" && serverUser.status !== "active") return "member_management_write_not_confirmed:restore";
    if (payload?.lessonType === "one_on_two") {
      const requiredParticipantIds = [payload?.userId, payload?.partnerUserId].filter(Boolean);
      const futureLessons = lessons.filter((lesson) => (
        lesson.ticketId === ticketId
        && ["scheduled", "pending_change"].includes(lesson.serverStatus)
        && lesson.lessonDate >= adminLocalDateKey(new Date())
      ));
      if (!serverTicket || requiredParticipantIds.some((id) => !serverTicket.participantUserIds?.includes(id))) {
        return "member_management_write_not_confirmed:partner";
      }
      if (futureLessons.some((lesson) => requiredParticipantIds.some((id) => !lesson.serverParticipantUserIds?.includes(id)))) {
        return "member_management_write_not_confirmed:partner_schedule";
      }
    }
    return "";
  }
  if (action === "correct") {
    const ticketValuesSaved = memberManagementTicketMatchesPayload(serverTicket, payload);
    if (!ticketValuesSaved) return "member_management_write_not_confirmed:ticket";
    if (payload?.lessonType === "one_on_two") {
      const requiredParticipantIds = [payload?.userId, payload?.partnerUserId].filter(Boolean);
      const futureLessons = lessons.filter((lesson) => (
        lesson.ticketId === ticketId
        && ["scheduled", "pending_change"].includes(lesson.serverStatus)
        && lesson.lessonDate >= adminLocalDateKey(new Date())
      ));
      if (requiredParticipantIds.some((id) => !serverTicket.participantUserIds?.includes(id))) {
        return "member_management_write_not_confirmed:partner";
      }
      if (futureLessons.some((lesson) => requiredParticipantIds.some((id) => !lesson.serverParticipantUserIds?.includes(id)))) {
        return "member_management_write_not_confirmed:partner_schedule";
      }
    }
    return "";
  }
  if (action === "extend") {
    return serverTicket?.expires === payload?.expiresOn ? "" : "member_management_write_not_confirmed:extend";
  }
  if (action === "expire") return serverTicket?.status === "expired" ? "" : "member_management_write_not_confirmed:expire";
  if (action === "close") {
    const refreshedMember = members.find((item) => memberServerUserIds(item).includes(userId));
    if (!serverUser || serverUser.status !== "active" || serverUser.member_kind !== "former_lesson_member") {
      return "member_management_write_not_confirmed:close_member";
    }
    if (!refreshedMember || memberListStatus(refreshedMember) !== "expired") {
      return "member_management_write_not_confirmed:close_status";
    }
    if (memberManagementTickets(refreshedMember).some((item) => (
      ["active", "paused", "pending_payment"].includes(item.status) || Number(item.remaining) > 0
    ))) {
      return "member_management_write_not_confirmed:close_ticket";
    }
    return "";
  }
  if (action === "force_delete") return serverTicket ? "member_management_write_not_confirmed:force_delete" : "";
  if (action === "permanent_delete") return !serverUser || serverUser.permanently_deleted_at ? "" : "member_management_write_not_confirmed:permanent_delete";
  if (action === "reenroll") return serverTicket && ["active", "paused"].includes(serverTicket.status) ? "" : "member_management_write_not_confirmed:reenroll";
  if (action === "deactivate") return serverUser?.status === "inactive" ? "" : "member_management_write_not_confirmed:deactivate";
  if (action === "restore") return serverUser?.status === "active" ? "" : "member_management_write_not_confirmed:restore";
  return "";
}

function memberManagementDatabasePayload(form, member, ticket, reason, allLiveData = adminLiveDataState) {
  const record = memberDatabaseRecord(member, ticket);
  const hasControl = (name) => Boolean(form.elements.namedItem(name));
  const product = (allLiveData.products || []).find((item) => item.id === (form.elements.productId?.value || ticket?.productId));
  const ticketCancelledFromInlineEditor = Boolean(ticket && hasControl("productId") && !form.elements.productId.value);
  const ticketStatus = ticketCancelledFromInlineEditor
    ? "expired"
    : form.elements.ticketStatus?.value || ticket?.status || (ticket ? "active" : "");
  const recordStatus = ticketStatus === "expired"
    ? "historical"
    : form.elements.recordStatus?.value || record?.record_status || (ticket || form.elements.productId ? "active" : "pending");
  return {
    userId: member?.serverUserId || null,
    ticketId: ticket?.serverTicketId || null,
    productId: form.elements.productId?.value || ticket?.productId || null,
    branchId: record?.branch_id || ticket?.branchId || product?.branch_id || null,
    name: form.elements.memberName?.value.trim() || member?.name || "",
    nickname: hasControl("memberNickname") ? form.elements.memberNickname.value.trim() : member?.nickname || "",
    phone: hasControl("memberPhone") ? form.elements.memberPhone.value.trim() : member?.phone || "",
    birthYear: hasControl("memberBirthYear") ? memberManagementNullableNumber(form.elements.memberBirthYear) : member?.birthYear || null,
    neighborhood: hasControl("memberNeighborhood") ? form.elements.memberNeighborhood.value.trim() : member?.neighborhood || "",
    gender: hasControl("memberGender") ? form.elements.memberGender.value || null : member?.gender || null,
    dominantHand: hasControl("memberDominantHand") ? form.elements.memberDominantHand.value || null : member?.dominantHand || null,
    backhandStyle: hasControl("memberBackhandStyle") ? form.elements.memberBackhandStyle.value || null : member?.backhandStyle || null,
    tennisStartedOn: hasControl("memberTennisStartedOn") ? form.elements.memberTennisStartedOn.value || null : member?.tennisStartedOn || null,
    selfNtrp: hasControl("memberSelfNtrp") ? memberManagementNullableNumber(form.elements.memberSelfNtrp) : member?.selfNtrp || null,
    coachNtrp: hasControl("memberCoachNtrp") ? memberManagementNullableNumber(form.elements.memberCoachNtrp) : member?.coachNtrp || null,
    tennisGoal: hasControl("memberTennisGoal") ? form.elements.memberTennisGoal.value.trim() : member?.tennisGoal || "",
    playStyleMemo: hasControl("memberPlayStyleMemo") ? form.elements.memberPlayStyleMemo.value.trim() : member?.playStyleMemo || "",
    coachRoleId: form.elements.coachRoleId?.value || record?.coach_role_id || ticket?.coachRoleId || null,
    scheduleScope: form.elements.scheduleScope?.value || record?.lesson_schedule_scope || ticket?.scheduleScope || null,
    weeklyFrequency: hasControl("weeklyFrequency")
      ? memberManagementNullableNumber(form.elements.weeklyFrequency)
      : record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? null,
    lessonType: form.elements.lessonType?.value || record?.lesson_type || ticket?.lessonTypeCode || "one_on_one",
    lessonDays: hasControl("lessonDays")
      ? memberManagementSelectedDays(form)
      : record?.lesson_days || ticket?.lessonDays || [],
    startsOn: form.elements.startsOn?.value || record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || null,
    expiresOn: form.elements.expiresOn?.value || ticket?.expires || null,
    totalSessions: hasControl("totalSessions") ? memberManagementNullableNumber(form.elements.totalSessions) : record?.total_sessions ?? ticket?.total ?? null,
    usedSessions: hasControl("usedSessions") ? memberManagementNullableNumber(form.elements.usedSessions) : record?.used_sessions ?? ticket?.used ?? null,
    remainingSessions: hasControl("remainingSessions") ? memberManagementNullableNumber(form.elements.remainingSessions) : record?.remaining_sessions ?? ticket?.remaining ?? null,
    paymentDate: hasControl("paymentDate") ? form.elements.paymentDate.value || null : record?.payment_recorded_on || null,
    paymentMethod: hasControl("paymentMethod") ? form.elements.paymentMethod.value || null : record?.payment_method || null,
    paymentAmount: hasControl("paymentAmount") ? memberManagementNullableNumber(form.elements.paymentAmount) : record?.payment_amount ?? null,
    paymentRecordState: hasControl("paymentRecordState")
      ? form.elements.paymentRecordState.value || null
      : memberPaymentRecordState(record),
    existingPaymentId: hasControl("existingPaymentId") ? form.elements.existingPaymentId.value || null : null,
    note: hasControl("note") ? form.elements.note.value.trim() || null : record?.admin_note || null,
    partnerUserId: hasControl("partnerUserId")
      ? form.elements.partnerUserId.disabled ? null : form.elements.partnerUserId.value || null
      : memberTicketPartnerUserId(ticket, member) || null,
    partnerMode: hasControl("partnerMode") ? form.elements.partnerMode.value : null,
    partnerName: hasControl("partnerName") ? form.elements.partnerName.value.trim() : null,
    partnerPhone: hasControl("partnerPhone") ? form.elements.partnerPhone.value.trim() : null,
    partnerBirthYear: hasControl("partnerBirthYear") ? memberManagementNullableNumber(form.elements.partnerBirthYear) : null,
    partnerGender: hasControl("partnerGender") ? form.elements.partnerGender.value || null : null,
    ticketStatus: ticketStatus || null,
    recordStatus,
    reason,
    expectedTicketUpdatedAt: hasControl("expectedTicketUpdatedAt")
      ? form.elements.expectedTicketUpdatedAt.value || ticket?.serverUpdatedAt || null
      : ticket?.serverUpdatedAt || null,
    applyToFutureSchedule: hasControl("applyToFutureSchedule")
      ? form.elements.applyToFutureSchedule.value === "true"
      : false,
    changeBatchId: form.dataset.changeBatchId || null,
    changeSource: "admin_web",
    createWithoutSchedule: hasControl("createWithoutSchedule")
      ? form.elements.createWithoutSchedule.value === "true"
      : true,
  };
}

function validateRequiredMemberProfile(form, message = null) {
  const phone = form.elements.memberPhone;
  const birthYear = form.elements.memberBirthYear;
  const neighborhood = form.elements.memberNeighborhood;
  if (!phone && !birthYear && !neighborhood) return true;
  const currentYear = new Date().getFullYear();
  const phoneDigits = String(phone?.value || "").replace(/\D/g, "");
  const birthValue = Number(birthYear?.value || 0);
  const neighborhoodValue = String(neighborhood?.value || "").trim();
  let invalidControl = null;
  let errorText = "";
  if (phone && ((phone.required && !phoneDigits) || (phoneDigits && phoneDigits.length < 8))) {
    invalidControl = phone;
    errorText = "휴대전화 번호를 입력해 주세요.";
  } else if (birthYear && String(birthYear.value || "").trim() && (!Number.isInteger(birthValue) || birthValue < 1900 || birthValue > currentYear)) {
    invalidControl = birthYear;
    errorText = "출생연도를 네 자리로 입력해 주세요.";
  } else if (neighborhood?.required && !neighborhoodValue) {
    invalidControl = neighborhood;
    errorText = "거주동을 입력해 주세요.";
  }
  if (!invalidControl) return true;
  if (message) {
    message.textContent = errorText;
    message.classList?.add("is-error");
  }
  invalidControl.focus();
  return false;
}

function memberEditorAuditIssues(member, ticket = memberCurrentTicket(member)) {
  const issues = [];
  const status = memberListStatus(member);
  if (["active", "expiring"].includes(status) && !ticket) issues.push("사용 중 회원권 없음");
  if (!member.coach && ticket) issues.push("담당 코치 없음");
  if (ticket) {
    const total = Number(ticket.total);
    const used = Number(ticket.used);
    const remaining = Number(ticket.remaining);
    if (![total, used, remaining].every(Number.isFinite) || total < 0 || used < 0 || remaining < 0) {
      issues.push("회차 숫자 확인");
    } else if (used + remaining !== total) {
      issues.push("총·소진·잔여 불일치");
    }
    if (!ticket.productId) issues.push("상품 연결 없음");
    if (ticket.lessonTypeCode === "one_on_two" && memberServerUserIds(member).length < 2
      && !memberTicketPartnerUserId(ticket, member)) issues.push("1:2 파트너 없음");
    if (["active", "paused"].includes(ticket.status) && ticket.expires
      && ticket.expires < adminLocalDateKey(new Date())) issues.push("만료일 경과");
  }
  return issues;
}

function requestMemberInlineEditor(memberId, ticketId = "") {
  if (operationsRole() !== "admin") return;
  const openEditor = () => openMemberInlineEditor(memberId, ticketId);
  if (memberAdminEditEnabled || isAdminUnlocked()) {
    openEditor();
    return;
  }
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("운영 설정의 보안·잠금에서 관리자 PIN을 먼저 설정해 주세요.");
    return;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "member_admin_edit";
  adminLockSession.pendingLabel = "회원 바로 수정";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = openEditor;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
}

function touchMemberAdminEditSession() {
  if (!memberAdminEditEnabled) return;
  if (Date.now() >= memberAdminEditExpiresAt) {
    setMemberAdminEditEnabled(false);
    showToast("개인정보 보호를 위해 회원표 편집이 자동 잠금되었습니다.");
    return;
  }
  memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
}

function dirtyMemberInlineForms() {
  return [...document.querySelectorAll('[data-member-inline-form][data-dirty="true"]')];
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

function memberInlineInitialValue(control) {
  if (control instanceof HTMLSelectElement) {
    return control.querySelector("option[selected]")?.value ?? control.options[0]?.value ?? "";
  }
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    return String(control.defaultChecked);
  }
  return String(control.defaultValue ?? "");
}

function memberInlineChangeSummary(form, allMembers = members) {
  const member = allMembers.find((item) => item.id === Number(form?.dataset.memberInlineForm));
  const ticket = [...tickets, ...expiredTickets]
    .find((item) => String(item.serverTicketId || "") === String(form?.dataset.ticketId || ""));
  const labels = {
    memberName: "이름",
    memberPhone: "연락처",
    memberBirthYear: "출생연도",
    memberNeighborhood: "거주동",
    memberGender: "성별",
    productId: "회원권",
    coachRoleId: "담당 코치",
    partnerUserId: "파트너",
    startsOn: "시작일",
    expiresOn: "만료일",
    totalSessions: "총 횟수",
    usedSessions: "소진 횟수",
    paymentRecordState: "결제 구분",
    paymentDate: "결제일",
    paymentMethod: "결제수단",
    paymentAmount: "결제금액",
    note: "비고",
    scheduleDay1: "정규시간",
    scheduleDay2: "정규시간",
    scheduleDay3: "정규시간",
    scheduleTime1: "정규시간",
    scheduleTime2: "정규시간",
    scheduleTime3: "정규시간",
  };
  const changed = [...(form?.elements || [])]
    .filter((control) => control.name && labels[control.name] && String(control.value) !== memberInlineInitialValue(control))
    .map((control) => labels[control.name]);
  const ticketLabel = ticket ? ` · ${getTicketDisplayProduct(ticket) || ticket.product || "회원권"}` : "";
  return `${member?.name || "회원"}${ticketLabel}: ${[...new Set(changed)].join(", ") || "입력값"}`;
}

const memberInlineDraftFieldNames = [
  "memberName",
  "memberPhone",
  "memberBirthYear",
  "memberNeighborhood",
  "memberGender",
  "productId",
  "coachRoleId",
  "partnerUserId",
  "startsOn",
  "expiresOn",
  "totalSessions",
  "usedSessions",
  "paymentRecordState",
  "paymentDate",
  "paymentMethod",
  "paymentAmount",
  "note",
  "applyToFutureSchedule",
  "scheduleDay1",
  "scheduleDay2",
  "scheduleDay3",
  "scheduleTime1",
  "scheduleTime2",
  "scheduleTime3",
];

function memberInlineDraft(form) {
  return {
    memberId: Number(form?.dataset.memberInlineForm) || 0,
    ticketId: String(form?.dataset.ticketId || ""),
    values: Object.fromEntries(memberInlineDraftFieldNames
      .map((name) => [name, form?.elements?.[name]?.value])
      .filter(([, value]) => value !== undefined)),
  };
}

function requestMemberAdminEdit() {
  if (operationsRole() !== "admin") return;
  if (memberAdminEditEnabled) {
    if (dirtyMemberInlineForms().length && !window.confirm("저장하지 않은 변경사항을 버리고 회원표 편집을 종료할까요?")) return;
    setMemberAdminEditEnabled(false);
    return;
  }
  if (isAdminUnlocked()) {
    setMemberAdminEditEnabled(true);
    return;
  }
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("운영 설정의 보안·잠금에서 관리자 PIN을 먼저 설정해 주세요.");
    return;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "member_admin_edit";
  adminLockSession.pendingLabel = "회원표 바로 편집";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = () => setMemberAdminEditEnabled(true);
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
}

function readNotificationPolicyForm() {
  return normalizeNotificationPolicy({
    lessonDayBeforeEnabled: $("#notifyLessonDayBefore")?.checked !== false,
    lesson30MinutesEnabled: $("#notifyLesson30Minutes")?.checked !== false,
    couponNextBookingEnabled: $("#notifyCouponNextBooking")?.checked !== false,
    ticketLowRemainingEnabled: $("#notifyTicketLowRemaining")?.checked !== false,
    lowRemainingThreshold: $("#notifyLowRemainingThreshold")?.value,
    ticketExpiryEnabled: $("#notifyTicketExpiry")?.checked !== false,
    expiryDaysBefore: $("#notifyExpiryDaysBefore")?.value,
    ticketExpiredEnabled: $("#notifyTicketExpired")?.checked !== false,
    coachFeedbackReminderEnabled: $("#notifyCoachFeedbackReminder")?.checked !== false,
    coachFeedbackReminderMinutes: $("#notifyCoachFeedbackReminderMinutes")?.value,
    coachFeedbackAdminEscalationEnabled: $("#notifyCoachFeedbackEscalation")?.checked !== false,
    coachFeedbackAdminEscalationHours: $("#notifyCoachFeedbackEscalationHours")?.value,
    memberFeedbackReadyEnabled: $("#notifyMemberFeedbackReady")?.checked !== false,
    scheduleRequestStaffEnabled: $("#notifyScheduleRequestStaff")?.checked !== false,
    updatedAt: new Date().toISOString(),
  });
}

function memberTicketDisplayLabel(member, ticket = memberCurrentTicket(member)) {
  if (!ticket) return member?.directoryRow?.product_name || "미등록";
  return getTicketDisplayProduct(ticket) || ticket.product || "회원권";
}

function memberUsageDisplayLabel(member, ticket = memberCurrentTicket(member)) {
  if (ticket) return ticketUsageLabel(ticket);
  const row = member?.directoryRow;
  if (!row || row.total_sessions == null) return "-";
  const total = Number(row.total_sessions) || 0;
  const used = Number(row.used_sessions) || 0;
  const remaining = Number(row.remaining_sessions) || 0;
  return `총 ${total} / 소진 ${used} / 잔여 ${remaining}`;
}

function memberLessonRows(member) {
  const memberName = String(member?.name || "").trim();
  const serverUserIds = memberServerUserIds(member);
  return operationBranchLessons().filter((lesson) => {
    if (lesson.status === "cancelled") return false;
    const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
      ? lesson.serverParticipantUserIds.filter(Boolean)
      : [];
    if (serverUserIds.length && participantUserIds.length) {
      return participantUserIds.some((userId) => serverUserIds.includes(userId));
    }
    return splitMemberNames(lesson.member).includes(memberName);
  });
}

function memberScheduleSummary(member, ticket = memberCurrentTicket(member)) {
  if (!ticket) return "미배정";
  const product = membershipProductForTicket(ticket);
  const memberLessons = memberLessonRows(member);
  const today = adminLocalDateKey(new Date());
  const upcoming = memberLessons
    .filter((lesson) => !lesson.lessonDate || lesson.lessonDate >= today)
    .sort((left, right) => `${left.lessonDate || "9999-12-31"}T${left.time || "23:59"}`.localeCompare(`${right.lessonDate || "9999-12-31"}T${right.time || "23:59"}`));
  if (["pass", "coupon"].includes(product.productKind) || ["pass", "coupon"].includes(ticket.productKind)) {
    const nextLesson = upcoming[0];
    if (!nextLesson) return "쿠폰 · 다음 일정 없음";
    const dateLabel = nextLesson.lessonDate ? memberDetailDateLabel(nextLesson.lessonDate) : nextLesson.day;
    return `쿠폰 · 다음 ${dateLabel} ${nextLesson.time}`;
  }
  const regularLessons = memberLessons.filter((lesson) => !lesson.makeup && lesson.lessonSource !== "makeup");
  const scheduleLabels = [...new Set(regularLessons.map((lesson) => `${lesson.day} ${lesson.time}`))];
  if (scheduleLabels.length) return scheduleLabels.slice(0, 3).join(" · ");
  const record = memberDatabaseRecord(member, ticket);
  if (record?.lesson_days?.length || ticket?.lessonDays?.length) return memberManagementLessonDaysLabel(record, ticket);
  if (member.regularTime && member.regularTime !== "시간표에서 확인") return member.regularTime;
  return "미배정";
}

function memberScheduleOverviewMarkup(member) {
  const memberTickets = memberOperationalTickets(member);
  if (!memberTickets.length) return '<span class="member-table-muted">미배정</span>';
  return memberTickets.slice(0, 3).map((ticket) => `
    <span class="member-ticket-summary-line">
      <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
      <small>${escapeHtml(memberScheduleSummary(member, ticket))}</small>
    </span>`).join("")
    + (memberTickets.length > 3 ? `<small>외 ${memberTickets.length - 3}건</small>` : "");
}

function memberUsageOverviewMarkup(member) {
  const memberTickets = memberOperationalTickets(member);
  if (!memberTickets.length) return '<span class="member-table-muted">-</span>';
  return memberTickets.slice(0, 3).map((ticket) => `
    <span class="member-ticket-summary-line">
      <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
      <small>${escapeHtml(ticketUsageLabel(ticket))}</small>
    </span>`).join("")
    + (memberTickets.length > 3 ? `<small>외 ${memberTickets.length - 3}건</small>` : "");
}

const memberScheduleDayOrder = [1, 2, 3, 4, 5, 6, 0];

function memberScheduleDayAllowed(scope, day) {
  if (day === "" || day === null || day === undefined) return false;
  const value = Number(day);
  if (scope === "mixed") return memberScheduleDayOrder.includes(value);
  return scope === "weekend" ? [0, 6].includes(value) : value >= 1 && value <= 5;
}

function memberRegularScheduleSlots(member, ticket) {
  if (!ticket?.serverTicketId) return [];
  const rules = (adminLiveDataState.regularScheduleRules || [])
    .filter((rule) => String(rule.ticket_id || "") === String(ticket.serverTicketId)
      && rule.status === "active")
    .map((rule) => ({
      dayOfWeek: Number(rule.day_of_week),
      startTime: String(rule.start_time || "").slice(0, 5),
    }));
  const lessonSlots = memberLessonRows(member)
    .filter((lesson) => String(lesson.ticketId || "") === String(ticket.serverTicketId)
      && normalizeLessonSource(lesson.lessonSource) === "regular"
      && ["scheduled", "pending_change"].includes(lessonStatusValue(lesson)))
    .map((lesson) => ({
      dayOfWeek: lesson.lessonDate
        ? new Date(`${lesson.lessonDate}T12:00:00`).getDay()
        : ({ 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, 일: 0 }[lesson.day]),
      startTime: String(lesson.time || "").slice(0, 5),
    }));
  const record = memberDatabaseRecord(member, ticket);
  const dayOnlySlots = (record?.lesson_days || ticket.lessonDays || [])
    .map((day) => ({ dayOfWeek: Number(day), startTime: "" }));
  const source = rules.length ? rules : lessonSlots.length ? lessonSlots : dayOnlySlots;
  return [...new Map(source
    .filter((slot) => memberScheduleDayOrder.includes(slot.dayOfWeek))
    .map((slot) => [`${slot.dayOfWeek}:${slot.startTime}`, slot])).values()]
    .sort((left, right) => (
      memberScheduleDayOrder.indexOf(left.dayOfWeek) - memberScheduleDayOrder.indexOf(right.dayOfWeek)
      || left.startTime.localeCompare(right.startTime)
    ));
}

function memberInlineScheduleMarkup(member, ticket, product) {
  const productKind = String(product?.product_kind || ticket?.productKind || "regular");
  const frequency = memberRegularScheduleFrequency(product, ticket);
  const scope = memberManagementProductScheduleScope(product || ticket || {});
  const slots = memberRegularScheduleSlots(member, ticket);
  const maxRows = Math.max(3, frequency);
  const rows = Array.from({ length: maxRows }, (_, offset) => {
    const index = offset + 1;
    const slot = slots[offset] || { dayOfWeek: "", startTime: "" };
    const dayButtons = memberScheduleDayOrder.map((day) => {
      const allowed = memberScheduleDayAllowed(scope, day);
      const selected = Number(slot.dayOfWeek) === day;
      return `<button type="button" class="member-inline-day-chip ${selected ? "is-selected" : ""}" data-member-schedule-day="${day}" aria-pressed="${selected ? "true" : "false"}" ${allowed || selected ? "" : "disabled"}>${memberManagementDayLabel(day)}</button>`;
    }).join("");
    const currentTime = String(slot.startTime || "").slice(0, 5);
    const timeValues = [...new Set([currentTime, ...getScheduleTimeOptions()].filter(Boolean))];
    return `<div class="member-inline-schedule-row" data-member-schedule-row="${index}" ${index > frequency ? "hidden" : ""}>
      <span class="member-inline-schedule-index">정규 ${index}</span>
      <input type="hidden" name="scheduleDay${index}" value="${escapeHtml(memberManagementValue(slot.dayOfWeek))}" ${index > frequency ? "disabled" : ""} />
      <div class="member-inline-day-tabs" role="group" aria-label="정규 ${index} 요일">${dayButtons}</div>
      <select name="scheduleTime${index}" aria-label="정규 ${index} 시간" ${index > frequency ? "disabled" : ""}>
        <option value="">시간 선택</option>
        ${timeValues.map((time) => `<option value="${time}" ${time === currentTime ? "selected" : ""}>${time}</option>`).join("")}
      </select>
    </div>`;
  }).join("");
  return `<section class="member-inline-schedule" data-member-inline-schedule data-product-kind="${escapeHtml(productKind)}" ${productKind !== "regular" ? "hidden" : ""}>
    <div class="member-inline-schedule-heading"><strong>정규 요일·시간</strong><span>선택사항 · 시간표에서 등록하면 자동 연결</span><button class="ghost-button member-inline-schedule-separate" type="button" data-member-schedule-separate>기존 시간표 유지</button></div>
    ${rows}
    <p class="member-inline-schedule-warning" data-member-schedule-warning></p>
  </section>`;
}

function memberInlineCoachChanged(form) {
  if (!form?.dataset.ticketId) return false;
  return String(form.elements.coachRoleId?.value || "") !== String(form.dataset.initialCoachRoleId || "");
}

function memberInlineScheduleIsComplete(form, schedules = memberInlineScheduleValues(form)) {
  const product = (adminLiveDataState.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || String(product.product_kind || "regular") !== "regular") return false;
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const requiredCount = memberRegularScheduleFrequency(product, ticket);
  return schedules.length === requiredCount
    && schedules.every((slot) => memberScheduleDayOrder.includes(slot.dayOfWeek) && /^\d{2}:\d{2}$/.test(slot.startTime));
}

function keepMemberInlineScheduleSeparate(form) {
  if (!form?.elements.applyToFutureSchedule) return;
  if (memberInlineCoachChanged(form)) {
    const message = form.querySelector(".member-inline-message");
    if (message) {
      message.textContent = "코치 변경은 기존 시간표를 그대로 둘 수 없습니다. 새 코치의 가능한 요일·시간을 선택해 함께 저장해 주세요.";
      message.classList.add("is-error");
      message.classList.remove("is-success");
    }
    return;
  }
  form.elements.applyToFutureSchedule.value = "false";
  const message = form.querySelector(".member-inline-message");
  if (message) {
    message.textContent = "회원권 정보만 저장하고 기존 시간표는 유지합니다.";
    message.classList.remove("is-error", "is-success");
  }
  setMemberInlineDirtyState(form);
}

function memberRemarkLabel(member) {
  const records = memberOperationalTickets(member)
    .map((ticket) => memberDatabaseRecord(member, ticket))
    .filter(Boolean);
  const payment = latestMemberPayment(member);
  const parts = [];
  const notes = [...new Set([
    ...records.map((record) => String(record.admin_note || "").trim()),
    String(member.note || "").trim(),
  ].filter((note) => note && !["실서버 회원권 연결", "회원권 등록 또는 연장 확인 필요", "운동노트만 이용 중", "가입서 제출 완료 · 결제 확인 필요"].includes(note)))];
  parts.push(...notes);
  if (Number(payment?.discountAmount || 0) > 0) parts.push(`할인 ${money.format(Number(payment.discountAmount))}원`);
  return parts.join(" · ") || "-";
}

function latestMemberPayment(member) {
  const record = memberManagementTickets(member)
    .map((ticket) => memberDatabaseRecord(member, ticket))
    .filter((item) => item && (item.payment_recorded_on || item.payment_method || Number(item.payment_amount) > 0))
    .sort((left, right) => String(right.payment_recorded_on || "").localeCompare(String(left.payment_recorded_on || "")))[0] || null;
  if (record) {
    return {
      memberDatabaseRecord: true,
      paidAt: record.payment_recorded_on || "",
      method: record.payment_method || "",
      amount: record.payment_amount ?? 0,
      finalAmount: record.payment_amount ?? 0,
    };
  }
  const rows = billings.filter((billing) => {
    const matchesMember = member.serverUserId && billing.serverUserId
      ? member.serverUserId === billing.serverUserId
      : billing.member === member.name;
    return matchesMember && !["draft", "failed"].includes(billing.status);
  });
  const liveRows = rows.filter((billing) => billing.environment !== "테스트");
  return (liveRows.length ? liveRows : rows)
    .sort((left, right) => {
      const leftAt = new Date(left.paidAt || left.verifiedAt || left.requestedAt || 0).getTime() || 0;
      const rightAt = new Date(right.paidAt || right.verifiedAt || right.requestedAt || 0).getTime() || 0;
      return rightAt - leftAt;
    })[0] || null;
}

function memberTicketPartnerUserId(ticket, member, allLiveData = adminLiveDataState) {

  if (!ticket || !member) return "";
  const memberUserIds = memberServerUserIds(member);
  const participantUserIds = ticketParticipantUserIds(ticket);
  if (memberUserIds.length) {
    const participantPartner = participantUserIds.find((userId) => !memberUserIds.includes(userId));
    if (participantPartner) return participantPartner;
    const groupLink = (allLiveData.groupTicketLinks || []).find((link) => (
      link.ticket_id === ticket.serverTicketId
      || (memberUserIds.includes(link.user_id) && link.ticket_id === ticket.serverTicketId)
    ));
    if (groupLink) {
      const groupPartner = (allLiveData.groupMembers || []).find((row) => (
        row.group_account_id === groupLink.group_account_id
        && !memberUserIds.includes(row.user_id)
      ));
      if (groupPartner?.user_id) return groupPartner.user_id;
    }
    return "";
  }
  const partnerName = ticketPartnerNames(ticket, member)[0];
  return (allLiveData.users || []).find((user) => user.name === partnerName)?.id || "";
}

function filterMemberTicketPartnerOptions(setup) {
  const partnerSearch = setup?.querySelector("[data-ticket-partner-search]");
  const partnerSelect = setup?.querySelector("[data-ticket-partner-user]");
  const result = setup?.querySelector("[data-ticket-partner-result]");
  if (!partnerSearch || !partnerSelect || !result) return;

  const query = normalizedPartnerSearchValue(partnerSearch.value);
  let matchCount = 0;
  Array.from(partnerSelect.options).forEach((option) => {
    if (!option.value) {
      option.hidden = false;
      option.disabled = false;
      return;
    }
    const searchValue = normalizedPartnerSearchValue(option.dataset.partnerSearch || option.textContent);
    const matches = !query || searchValue.includes(query);
    option.hidden = !matches;
    option.disabled = !matches;
    if (matches) matchCount += 1;
  });

  result.hidden = !query;
  result.textContent = matchCount ? `${matchCount}명 찾음` : "검색 결과가 없습니다";
}

function selectedMemberIdSet() {
  return new Set((state.selectedMemberIds || []).map(Number));
}

function onsitePaymentProducts() {
  return membershipProductsForActiveOperationProfile()
    .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
    .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled");
}

function onsitePaymentSourceTickets(userId = $("#onsitePaymentMember")?.value || "") {
  const member = operationBranchMembers().find((item) => memberServerUserIds(item).includes(userId));
  if (!member) return [];
  return memberManagementTickets(member).filter((ticket) => (
    ticket?.serverTicketId
    && !["refunded", "voided", "cancelled", "canceled"].includes(String(ticket.status || ""))
  ));
}

function memberQuickEditorMarkup(member, ticket, options = {}) {
  if (!memberAdminEditEnabled || operationsRole() !== "admin") return "";
  const embedded = options.embedded === true;
  const ticketPosition = Number(options.ticketPosition || 0);
  const ticketCount = Number(options.ticketCount || 0);
  const record = memberDatabaseRecord(member, ticket);
  const coachRoles = memberManagementCoachRoles(ticket || {});
  const partnerUserId = ticket ? memberTicketPartnerUserId(ticket, member) : "";
  const partnerOptions = manualMemberPartnerOptions()
    .filter((user) => user.id !== member.serverUserId)
    .map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "회원")}</option>`)
    .join("");
  const total = Number(record?.total_sessions ?? ticket?.total ?? 0);
  const used = Number(record?.used_sessions ?? ticket?.used ?? 0);
  const remaining = Math.max(0, total - used);
  const startsOn = memberManagementDate(record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased)
    || adminLocalDateKey(new Date());
  const expiresOn = memberManagementDate(ticket?.expires);
  const paymentRecordState = memberPaymentRecordState(record);
  const currentProduct = (adminLiveDataState.products || []).find((item) => item.id === ticket?.productId);
  const activeProductOptions = membershipProductsForActiveOperationProfile()
    .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
    .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled")
    .map(({ draft, server }) => `<option value="${escapeHtml(server.id)}" data-group-size="${Number(server.group_size || 1)}" data-product-kind="${escapeHtml(server.product_kind || "regular")}" data-frequency="${Number(server.frequency_per_week || 1)}" data-scope="${escapeHtml(memberManagementProductScheduleScope(server))}" data-duration="${Number(server.lesson_minutes || 20)}" ${server.id === ticket?.productId ? "selected" : ""}>${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`)
    .join("");
  const currentProductIncluded = Boolean(ticket?.productId)
    && activeProductOptions.includes(`value="${escapeHtml(ticket.productId)}"`);
  const currentProductOption = currentProduct && !currentProductIncluded
    ? `<option value="${escapeHtml(currentProduct.id)}" data-group-size="${Number(currentProduct.group_size || ticket?.groupSize || 1)}" data-product-kind="${escapeHtml(currentProduct.product_kind || ticket?.productKind || "regular")}" data-frequency="${Number(currentProduct.frequency_per_week || ticket?.weeklyCount || 1)}" data-scope="${escapeHtml(memberManagementProductScheduleScope(currentProduct))}" data-duration="${Number(currentProduct.lesson_minutes || ticket?.durationMinutes || 20)}" selected>현재 · ${escapeHtml(getTicketDisplayProduct(ticket) || currentProduct.name || "기존 회원권")}</option>`
    : "";
  const productOptions = currentProductOption + activeProductOptions;
  const isGroup = Number(currentProduct?.group_size || record?.lesson_group_size || ticket?.groupSize || 1) === 2;
  const ticketOwnershipLabel = ticket && ticketCount > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
  const possibleDuplicate = Boolean(ticket?.serverTicketId)
    && memberPossibleDuplicateTicketIds(memberOperationalTickets(member)).has(String(ticket.serverTicketId));
  const ticketContextLabel = [
    ticket ? (ticketCount > 1 ? `회원권 ${ticketPosition}/${ticketCount}` : "회원권") : "새 회원권",
    ticketOwnershipLabel,
    possibleDuplicate ? "중복 가능" : "",
  ].filter(Boolean).join(" · ");
  const initialSchedule = memberRegularScheduleSlots(member, ticket)
    .slice(0, memberRegularScheduleFrequency(currentProduct, ticket))
    .map((slot) => ({ dayOfWeek: Number(slot.dayOfWeek), startTime: String(slot.startTime || "").slice(0, 5) }));
  const memberProfileFields = embedded && ticket
    ? `<input name="memberName" type="hidden" value="${escapeHtml(member.name || "")}" />
       <input name="memberPhone" type="hidden" value="${escapeHtml(member.phone || "")}" />
       <input name="memberBirthYear" type="hidden" value="${escapeHtml(memberManagementValue(member.birthYear))}" />
       <input name="memberNeighborhood" type="hidden" value="${escapeHtml(member.neighborhood || "")}" />
       <input name="memberGender" type="hidden" value="${escapeHtml(member.gender || "")}" />`
    : `<label><span>이름</span><input name="memberName" value="${escapeHtml(member.name || "")}" required /></label>
       <label><span>연락처 · 필수</span><input name="memberPhone" inputmode="tel" value="${escapeHtml(member.phone || "")}" required /></label>
       <label><span>출생연도 · 필수</span><input name="memberBirthYear" type="number" min="1900" max="2100" value="${escapeHtml(memberManagementValue(member.birthYear))}" required /></label>
       <label><span>거주동 · 필수</span><input name="memberNeighborhood" value="${escapeHtml(member.neighborhood || "")}" required /></label>
       <label><span>성별</span><select name="memberGender">
         <option value="" ${member.gender ? "" : "selected"}>미입력</option>
         <option value="female" ${member.gender === "female" ? "selected" : ""}>여성</option>
         <option value="male" ${member.gender === "male" ? "selected" : ""}>남성</option>
         <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
         <option value="prefer_not" ${member.gender === "prefer_not" ? "selected" : ""}>응답 안 함</option>
       </select></label>`;
  return `
        <form class="member-inline-editor member-inline-editor--compact ${embedded && ticket ? "member-inline-editor--ticket-only" : ""}" data-member-inline-form="${member.id}" data-ticket-id="${escapeHtml(ticket?.serverTicketId || "")}" data-initial-product-id="${escapeHtml(ticket?.productId || "")}" data-initial-coach-role-id="${escapeHtml(record?.coach_role_id || ticket?.coachRoleId || "")}" data-initial-schedule="${escapeHtml(encodeURIComponent(JSON.stringify(initialSchedule)))}">
          <div class="member-inline-editor-heading" ${embedded ? "hidden" : ""}>
            <div><strong>${escapeHtml(member.name)} 빠른 편집</strong><span>저장하면 서버와 시간표에 바로 반영됩니다.</span></div>
            <button class="icon-button" type="button" data-close-member-inline aria-label="빠른 수정 닫기" title="닫기">×</button>
          </div>
          ${embedded ? `<div class="member-inline-ticket-context ${possibleDuplicate ? "is-possible-duplicate" : ""}">
            <strong>${escapeHtml(ticketContextLabel)}</strong>
            <span>${escapeHtml(ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "회원권 미등록")}${ticket ? ` · ${escapeHtml(memberTicketStatusLabel(ticket))}` : ""}</span>
          </div>` : ""}
          <input name="scheduleScope" type="hidden" value="${escapeHtml(record?.lesson_schedule_scope || ticket?.scheduleScope || "weekday")}" />
          <input name="lessonType" type="hidden" value="${escapeHtml(record?.lesson_type || ticket?.lessonTypeCode || "one_on_one")}" />
          <input name="weeklyFrequency" type="hidden" value="${memberManagementProductWeeklyFrequency(currentProduct, record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? 1)}" />
          <input name="recordStatus" type="hidden" value="${escapeHtml(record?.record_status || (ticket ? "active" : "pending"))}" />
          <input name="expectedTicketUpdatedAt" type="hidden" value="${escapeHtml(ticket?.serverUpdatedAt || "")}" />
          ${embedded && ticket ? `<p class="member-inline-profile-hint"><strong>${escapeHtml(member.name)}</strong><span>회원 기본정보는 이름을 눌러 수정합니다. 아래에서는 선택한 회원권만 바뀝니다.</span></p>` : ""}
          <div class="member-inline-compact-grid">
            ${memberProfileFields}
            <label class="member-inline-product"><span>회원권</span><select name="productId">
              <option value="">${ticket ? "회원권 취소·만료" : "미등록"}</option>${productOptions}
            </select></label>
            <label class="member-inline-coach"><span>담당 코치</span><select name="coachRoleId">
              <option value="">미배정</option>
              ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === (record?.coach_role_id || ticket?.coachRoleId) ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
            </select></label>
            <label class="member-inline-partner" data-member-quick-partner data-manual-member-partner-field><span>파트너</span><span class="member-inline-partner-empty" data-member-quick-partner-empty ${isGroup ? "hidden" : ""}>1:1 · 해당 없음</span><span class="member-inline-partner-search" data-manual-existing-partner data-current-member-user-id="${escapeHtml(member.serverUserId || "")}" ${isGroup ? "" : "hidden"}>
              <input name="partnerSearch" type="search" autocomplete="off" placeholder="이름 검색" data-manual-member-partner-search ${isGroup ? "" : "disabled"} />
              <span class="member-partner-search-results" data-manual-member-partner-results aria-live="polite" hidden></span>
              <select name="partnerUserId" ${isGroup ? "required" : "disabled"}>
                <option value="">파트너 선택</option>${partnerOptions}
              </select>
            </span></label>
            <label class="member-inline-start-date"><span>시작일</span><input name="startsOn" type="date" value="${escapeHtml(startsOn)}" /></label>
            <label class="member-inline-end-date"><span>만료일</span><input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" /></label>
            <label class="member-inline-count"><span>총</span><input name="totalSessions" type="number" min="0" step="1" value="${total}" ${ticket ? "" : "disabled"} /></label>
            <label class="member-inline-count"><span>소진</span><input name="usedSessions" type="number" min="0" step="1" value="${used}" ${ticket ? "" : "disabled"} /></label>
            <label class="member-inline-count"><span>잔여</span><input name="remainingSessions" type="number" min="0" step="1" value="${remaining}" readonly aria-readonly="true" /></label>
            ${ticket ? `<label class="member-inline-status"><span>회원권 상태</span><select name="ticketStatus">
              <option value="active" ${ticket.status === "active" ? "selected" : ""}>사용 중</option>
              <option value="paused" ${ticket.status === "paused" ? "selected" : ""}>일시정지</option>
              ${ticket.status === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
              <option value="expired" ${ticket.status === "expired" ? "selected" : ""}>만료</option>
            </select></label>` : ""}
            <label class="member-inline-payment-state"><span>결제 구분</span><select name="paymentRecordState">${memberPaymentRecordStateOptions({
              payment_record_state: paymentRecordState,
              payment_recorded_on: record?.payment_recorded_on,
              payment_method: record?.payment_method,
              payment_amount: record?.payment_amount,
            })}</select></label>
            <label class="member-inline-payment-date"><span>결제일</span><input name="paymentDate" type="date" value="${escapeHtml(record?.payment_recorded_on || "")}" /></label>
            <label class="member-inline-payment-method"><span>결제수단</span><select name="paymentMethod">
              <option value="">미입력</option>
              <option value="card" ${record?.payment_method === "card" ? "selected" : ""}>카드</option>
              <option value="bank_transfer" ${["bank", "bank_transfer", "transfer"].includes(record?.payment_method) ? "selected" : ""}>계좌이체</option>
              <option value="cash" ${record?.payment_method === "cash" ? "selected" : ""}>현금</option>
            </select></label>
            <label class="member-inline-payment-amount"><span>결제금액</span><input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(record?.payment_amount ?? ""))}" /></label>
            <label class="member-inline-note"><span>비고</span><input name="note" value="${escapeHtml(record?.admin_note || member.note || "")}" /></label>
            <div class="member-inline-compact-actions">
              <label class="member-inline-schedule-scope"><span>시간표 반영</span><select name="applyToFutureSchedule">
                <option value="false">회원권만 저장 · 기존 시간표 유지</option>
                <option value="true">미래 정규시간 다시 만들기</option>
              </select></label>
              <button class="primary-button member-inline-save" type="submit">${ticket ? "이 회원권 저장" : "새 회원권 등록"}</button>
              ${embedded ? '<button class="ghost-button member-inline-cancel" type="button" data-close-member-inline>취소</button>' : ""}
              ${operationsRole() === "admin" && ticket && ticket.status !== "voided"
                ? `<button class="danger-button member-inline-force-delete" type="button" data-open-member-management="force_delete" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(ticketContextLabel)} 삭제">이 회원권 삭제</button>`
                : ""}
              ${memberListStatus(member) === "inactive" && member.authRole !== "admin" && member.serverUserId
                ? `<button class="danger-button member-row-permanent-delete" type="button" data-open-member-management="permanent_delete" data-member-management-member-id="${member.id}">영구 삭제</button>`
                : ""}
            </div>
          </div>
          ${ticket ? memberInlineScheduleMarkup(member, ticket, currentProduct) : ""}
          <div class="member-inline-editor-actions">
            <p class="member-inline-message" aria-live="polite"></p>
          </div>
        </form>`;
}

function memberInlineEditorMarkup(member, ticket) {
  if (operationsRole() !== "admin") return "";
  const record = memberDatabaseRecord(member, ticket);
  const coachRoles = memberManagementCoachRoles(ticket || {});
  const startsOn = memberManagementDate(record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased);
  const expiresOn = memberManagementDate(ticket?.expires);
  const total = Number(record?.total_sessions ?? ticket?.total ?? 0);
  const used = Number(record?.used_sessions ?? ticket?.used ?? 0);
  const remaining = Math.max(0, total - used);
  const paymentMethod = record?.payment_method || "";
  const paymentDate = record?.payment_recorded_on || "";
  const paymentAmount = record?.payment_amount ?? "";
  const scheduleScope = record?.lesson_schedule_scope || ticket?.scheduleScope || "";
  const lessonType = record?.lesson_type || ticket?.lessonTypeCode || "one_on_one";
  const weeklyFrequency = Number(record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? 1);
  const required = "";
  return `
    <tr class="member-inline-editor-row" data-inline-editor-member="${member.id}">
      <td colspan="9">
        <form class="member-inline-editor" data-member-inline-form="${member.id}" data-ticket-id="${escapeHtml(ticket?.serverTicketId || "")}">
          <div class="member-inline-editor-heading">
            <div><strong>${escapeHtml(member.name)} 행 편집</strong><span>${escapeHtml(ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "기본정보만 저장")}</span></div>
            <button class="icon-button" type="button" data-close-member-inline aria-label="빠른 수정 닫기" title="닫기">×</button>
          </div>
          <div class="member-inline-editor-grid member-inline-editor-grid--profile">
            <label><span>이름</span><input name="memberName" value="${escapeHtml(member.name || "")}" required /></label>
            <label><span>연락처 · 필수</span><input name="memberPhone" inputmode="tel" value="${escapeHtml(member.phone || "")}" required /></label>
            <label><span>출생연도 · 필수</span><input name="memberBirthYear" type="number" min="1900" max="2100" value="${escapeHtml(memberManagementValue(member.birthYear))}" required /></label>
            <label><span>거주동 · 필수</span><input name="memberNeighborhood" value="${escapeHtml(member.neighborhood || "")}" required /></label>
            <label><span>성별</span><select name="memberGender">
              <option value="">미입력</option>
              <option value="female" ${member.gender === "female" ? "selected" : ""}>여</option>
              <option value="male" ${member.gender === "male" ? "selected" : ""}>남</option>
              <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
            </select></label>
            <label><span>담당 코치</span><select name="coachRoleId" ${required}>
              <option value="">미배정</option>
              ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === (record?.coach_role_id || ticket?.coachRoleId) ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
            </select></label>
            <label><span>레슨 방식</span><select name="scheduleScope" ${ticket ? "" : "disabled"}>
              <option value="">미입력</option>
              <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일</option>
              <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말</option>
              <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
            </select></label>
            <label><span>레슨 종류</span><select name="lessonType" ${ticket ? "" : "disabled"}>
              <option value="one_on_one" ${lessonType !== "one_on_two" ? "selected" : ""}>개인 1:1</option>
              <option value="one_on_two" ${lessonType === "one_on_two" ? "selected" : ""}>그룹 1:2</option>
            </select></label>
            <label><span>주 횟수</span><input name="weeklyFrequency" type="number" min="1" max="7" value="${weeklyFrequency}" ${ticket ? "" : "disabled"} /></label>
          </div>
          ${ticket ? `<div class="member-inline-editor-grid member-inline-editor-grid--ticket">
            <label><span>시작일</span><input name="startsOn" type="date" value="${escapeHtml(startsOn)}" required /></label>
            <label><span>만료일</span><input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" required /></label>
            <label><span>총</span><input name="totalSessions" type="number" min="0" step="1" value="${total}" required /></label>
            <label><span>소진</span><input name="usedSessions" type="number" min="0" step="1" value="${used}" required /></label>
            <label><span>잔여</span><input name="remainingSessions" type="number" min="0" step="1" value="${remaining}" readonly aria-readonly="true" /></label>
            <label><span>결제수단</span><select name="paymentMethod" ${required}>
              <option value="">미입력</option>
              <option value="card" ${paymentMethod === "card" ? "selected" : ""}>카드</option>
              <option value="bank_transfer" ${["bank", "bank_transfer", "transfer"].includes(paymentMethod) ? "selected" : ""}>계좌이체</option>
              <option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>현금</option>
              <option value="manual" ${paymentMethod === "manual" ? "selected" : ""}>관리자 입력</option>
            </select></label>
            <label><span>결제일</span><input name="paymentDate" type="date" value="${escapeHtml(paymentDate)}" ${required} /></label>
            <label><span>금액</span><input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(paymentAmount))}" /></label>
            <label class="member-inline-note"><span>비고</span><input name="note" value="${escapeHtml(record?.admin_note || member.note || "")}" /></label>
          </div>` : ""}
          <div class="member-inline-editor-actions">
            ${ticket ? "" : '<span>회원권은 저장 후 ‘회원권 등록’에서 연결합니다.</span>'}
            ${ticket ? "" : `<button class="ghost-button" type="button" data-inline-member-management="${member.id}" data-inline-member-ticket="">회원권 등록</button>`}
            ${operationsRole() === "admin" && ticket && ticket.status !== "voided"
              ? `<button class="danger-button member-inline-force-delete" type="button" data-open-member-management="force_delete" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} 강제 삭제">강제 삭제</button>`
              : ""}
            <button class="primary-button member-inline-save" type="submit">저장</button>
          </div>
          <p class="member-inline-message" aria-live="polite">행의 변경값을 서버에 저장합니다. 기존 시간표는 유지됩니다.</p>
        </form>
      </td>
    </tr>`;
}

function scheduleLessonMatches(lesson) {
  return matchesSearch([lesson.member, getCoachName(lesson.coachId), getCourtLabel(lesson.courtId), lesson.day, lesson.type])
    && scheduleLessonMatchesMemberSearch(lesson);
}

function scheduleLessonMatchesMemberSearch(lesson) {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword) return true;
  return normalizedScheduleMemberSearch(getLessonMembersLabel(lesson)).includes(keyword);
}

function scheduleMemberSearchMatches() {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword) return [];
  return operationBranchLessons()
    .filter((lesson) => lesson.status !== "cancelled" && scheduleLessonMatchesMemberSearch(lesson))
    .sort((left, right) => `${left.lessonDate || "9999-12-31"} ${left.time || ""}`.localeCompare(`${right.lessonDate || "9999-12-31"} ${right.time || ""}`));
}

function autoJumpToExactScheduleMember() {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword || keyword === state.scheduleSearchLastAutoJump) return;
  const exactMatches = scheduleMemberSearchMatches().filter((lesson) => (
    splitMemberNames(getLessonMembersLabel(lesson))
      .some((name) => normalizedScheduleMemberSearch(name) === keyword)
  ));
  if (!exactMatches.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const target = exactMatches.find((lesson) => lessonMatchesActiveScheduleWeek(lesson, lesson.day))
    || exactMatches.find((lesson) => !lesson.lessonDate || lesson.lessonDate >= today)
    || exactMatches[exactMatches.length - 1];
  state.scheduleSearchLastAutoJump = keyword;
  jumpToScheduleSearchResult(target.lessonDate, target.day, target.id);
}

function lessonMatchesActiveScheduleWeek(lesson, day = lesson?.day) {
  if (!state.liveScheduleLoaded) return true;
  const targetDate = adminWeekDateForDay(day);
  return !targetDate || !lesson?.lessonDate || lesson.lessonDate === targetDate;
}

function lessonActionAttrs(lesson) {
  if (lesson?.oneDayBooking) {
    return `data-edit-one-day-booking-id="${lesson.serverOneDayBookingId || lesson.id}"`;
  }
  if (isReleasedRegularMakeupSlot(lesson)) {
    return [
      'data-open-released-makeup-slot="true"',
      `data-released-slot-day="${lesson.day}"`,
      `data-released-slot-time="${lesson.time}"`,
      `data-released-slot-coach="${lesson.coachId}"`,
      `data-released-slot-court="${lesson.courtId || "court-1"}"`,
      `data-released-slot-historical="${lesson.historicalReleasedSlot ? "true" : "false"}"`,
    ].join(" ");
  }
  if (state.scheduleBulkMode && scheduleBulkEligible(lesson)) {
    const selected = selectedScheduleLessonIdSet().has(String(lesson.serverLessonId));
    return `data-select-schedule-lesson="${lesson.serverLessonId}" aria-pressed="${selected}"`;
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function selectedScheduleLessonIdSet() {
  return new Set((state.selectedScheduleLessonIds || []).map(String));
}

function selectedScheduleLessons(allLessons = lessons) {
  const selected = selectedScheduleLessonIdSet();
  return allLessons.filter((lesson) => (
    selected.has(String(lesson.serverLessonId || ""))
    && scheduleBulkEligible(lesson)
  ));
}

function scheduleBulkPreviewText(selected = []) {
  if (!selected.length) return "수업을 선택하면 상태와 처리 가능 여부를 먼저 확인합니다.";
  const statusCounts = selected.reduce((map, lesson) => {
    const label = getLessonStatusLabel(lesson);
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());
  const sourceCounts = selected.reduce((map, lesson) => {
    const sourceLabel = lessonTypeLabel(lesson).replace(/\s*수업\s*$/, "") || "수업";
    map.set(sourceLabel, (map.get(sourceLabel) || 0) + 1);
    return map;
  }, new Map());
  const coaches = [...new Set(selected.map((lesson) => scheduleCoachDisplayName(getCoachName(lesson.coachId))))];
  const dates = [...new Set(selected.map((lesson) => lesson.lessonDate).filter(Boolean))];
  const minutes = selected.reduce((sum, lesson) => sum + (Number(lesson.durationMinutes) || 20), 0);
  const statusSummary = [...statusCounts].map(([label, count]) => `${label} ${count}`).join(" · ");
  const sourceSummary = [...sourceCounts].map(([label, count]) => `${label} ${count}`).join(" · ");
  const coachSummary = coaches.length > 1 ? `${coaches[0]} 외 ${coaches.length - 1}명` : (coaches[0] || "코치 미배정");
  const substituteReady = dates.length === 1 ? "대타 가능" : "대타는 같은 날짜만";
  return `${statusSummary} / ${sourceSummary} / ${coachSummary} / ${minutes}분 / ${substituteReady}`;
}

function clearScheduleBulkSelection(closeMode = false) {
  state.selectedScheduleLessonIds = [];
  state.scheduleBulkOperationKey = "";
  if (closeMode) state.scheduleBulkMode = false;
  renderSchedule();
}

function selectedScheduleOpenSlotKeys() {
  return new Set((state.selectedScheduleOpenSlots || []).map(scheduleOpenSlotKey));
}

function visibleScheduleOpenSlotKeys() {
  return [...document.querySelectorAll("[data-select-schedule-slot]")]
    .map((button) => String(button.dataset.selectScheduleSlot || ""))
    .filter(Boolean);
}

function selectScheduleOpenSlotRange(key) {
  const orderedKeys = visibleScheduleOpenSlotKeys();
  const startIndex = orderedKeys.indexOf(String(state.scheduleOpenSlotAnchorKey || ""));
  const endIndex = orderedKeys.indexOf(String(key || ""));
  if (startIndex < 0 || endIndex < 0) return false;
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  orderedKeys.slice(from, to + 1).forEach((item) => setScheduleOpenSlotSelection(item, true));
  return true;
}

function visibleScheduleLessonSelectionIds() {
  return [...document.querySelectorAll("[data-select-schedule-lesson]")]
    .map((button) => String(button.dataset.selectScheduleLesson || ""))
    .filter(Boolean);
}

function selectScheduleLessonRange(lessonId) {
  const orderedIds = visibleScheduleLessonSelectionIds();
  const startIndex = orderedIds.indexOf(String(state.scheduleBulkAnchorLessonId || ""));
  const endIndex = orderedIds.indexOf(String(lessonId || ""));
  if (startIndex < 0 || endIndex < 0) return false;
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  orderedIds.slice(from, to + 1).forEach((id) => setScheduleLessonSelection(id, true));
  state.scheduleBulkOperationKey = "";
  return true;
}

function beginScheduleBulkDrag(event, button) {
  if (!state.scheduleBulkMode || event.pointerType === "touch" || event.button !== 0) return;
  const lessonId = String(button.dataset.selectScheduleLesson || "");
  if (!lessonId) return;
  event.preventDefault();
  if (event.shiftKey && selectScheduleLessonRange(lessonId)) {
    state.scheduleBulkSuppressClick = true;
    renderSchedule();
    window.setTimeout(() => {
      state.scheduleBulkSuppressClick = false;
    }, 0);
    return;
  }
  const selecting = !selectedScheduleLessonIdSet().has(lessonId);
  state.scheduleBulkDrag = { selecting, touched: new Set([lessonId]) };
  state.scheduleBulkAnchorLessonId = lessonId;
  setScheduleLessonSelection(lessonId, selecting);
  renderScheduleBulkToolbar();
}

function continueScheduleBulkDrag(event, button) {
  const drag = state.scheduleBulkDrag;
  if (!drag || event.pointerType === "touch" || !(event.buttons & 1)) return;
  const lessonId = String(button.dataset.selectScheduleLesson || "");
  if (!lessonId || drag.touched.has(lessonId)) return;
  drag.touched.add(lessonId);
  setScheduleLessonSelection(lessonId, drag.selecting);
  renderScheduleBulkToolbar();
}

function endScheduleBulkDrag() {
  if (!state.scheduleBulkDrag) return;
  state.scheduleBulkDrag = null;
  state.scheduleBulkSuppressClick = true;
  renderSchedule();
  window.setTimeout(() => {
    state.scheduleBulkSuppressClick = false;
  }, 0);
}

function scheduleClipboardTicket() {
  return scheduleTicketById(state.scheduleLessonClipboard?.ticketId);
}

function scheduleClipboardCanPaste(day, time, coachId) {
  const clipboard = state.scheduleLessonClipboard;
  const ticket = scheduleClipboardTicket();
  if (!clipboard || !ticket || ticket.remaining <= 0) return false;
  if (String(ticket.coachId || clipboard.coachId) !== String(coachId || "")) return false;
  return canAddLessonAt(day, time, clipboard.durationMinutes, coachId);
}

function sortedSelectedScheduleOpenSlots() {
  return (state.selectedScheduleOpenSlots || [])
    .slice()
    .sort((left, right) => {
      const dayDelta = scheduleDays.indexOf(left.day) - scheduleDays.indexOf(right.day);
      if (dayDelta) return dayDelta;
      return timeToMinutes(left.time) - timeToMinutes(right.time);
    });
}

function scheduleOpenSlotPreviewText(selected = []) {
  if (!state.scheduleOpenSlotMode) return "";
  if (!selected.length) {
    return state.scheduleLessonClipboard
      ? "붙여넣을 빈 시간을 선택하세요. 같은 코치와 사용 가능한 회원권만 저장 단계로 이동합니다."
      : "주2회·주3회 정규권 시간을 먼저 찍고 회원을 선택하세요.";
  }
  const clipboard = state.scheduleLessonClipboard;
  const days = [...new Set(selected.map((slot) => slot.day).filter(Boolean))];
  const coaches = [...new Set(selected.map((slot) => scheduleCoachDisplayName(getCoachName(slot.coachId))))];
  const first = selected[0] || {};
  const last = selected[selected.length - 1] || first;
  const range = selected.length === 1
    ? `${first.day} ${first.time}`
    : `${first.day} ${first.time}~${last.day} ${last.time}`;
  const coachSummary = coaches.length > 1
    ? `${coaches[0]} 외 ${coaches.length - 1}명`
    : (coaches[0] || "코치 미지정");
  if (clipboard) {
    const readyCount = selected.filter((slot) => scheduleClipboardCanPaste(slot.day, slot.time, slot.coachId)).length;
    const blockedCount = selected.length - readyCount;
    const blockedText = blockedCount ? ` · 불가 ${blockedCount}칸` : "";
    return `${selected.length}칸 선택 · 붙여넣기 가능 ${readyCount}칸${blockedText} · ${coachSummary} · ${range}`;
  }
  const repeatHint = selected.length > 3
    ? "정규 반복 등록은 최대 3칸까지"
    : days.length > 1
      ? "요일별 반복 등록 준비"
      : "같은 요일 연속 시간 등록 준비";
  return `${selected.length}칸 선택 · ${coachSummary} · ${range} · ${repeatHint}`;
}

function copySelectedScheduleLesson() {
  const selected = selectedScheduleLessons();
  if (selected.length !== 1) {
    showToast("복사할 수업 한 개만 선택해 주세요.");
    return;
  }
  const lesson = selected[0];
  const ticket = getTicketByLesson(lesson);
  if (!ticket || Number(ticket.remaining) <= 0) {
    showToast("사용 가능한 회원권이 연결된 수업만 복사할 수 있습니다.");
    return;
  }
  state.scheduleLessonClipboard = {
    lessonId: lesson.serverLessonId,
    memberName: getEditingLessonMemberName(lesson) || getLessonParticipantNames(lesson)[0] || splitMemberNames(lesson.member)[0] || "",
    memberLabel: getLessonMembersLabel(lesson),
    ticketId: ticket.id,
    coachId: ticket.coachId || lesson.coachId,
    durationMinutes: Number(lesson.durationMinutes) || getTicketDurationMinutes(ticket),
    lessonType: lesson.type || getTicketLessonKind(ticket),
    lessonSource: normalizeLessonSource(lesson.lessonSource),
  };
  state.scheduleBulkMode = false;
  state.selectedScheduleLessonIds = [];
  state.scheduleBulkAnchorLessonId = "";
  state.scheduleBulkOperationKey = "";
  renderSchedule();
  showToast("수업을 복사했습니다. 같은 코치의 빈 시간을 선택해 확인 후 저장하세요.");
}

function clearScheduleLessonClipboard() {
  state.scheduleLessonClipboard = null;
  renderSchedule();
  showToast("수업 복사를 종료했습니다.");
}

function scheduleSheetRowCandidate(row) {
  if (!row?.ticketId || !row.day || !row.time || !row.coachId) return null;
  const ticket = scheduleTicketById(row.ticketId);
  const participantNames = ticketParticipantNames(ticket);
  return {
    id: `sheet-${row.rowNumber}`,
    day: row.day,
    time: row.time,
    courtId: getAvailableCourtId(row.day, row.time, row.durationMinutes),
    coachId: row.coachId,
    member: participantNames.length ? participantNames.join("&") : row.memberName,
    ticketId: row.ticketId,
    type: getTicketLessonKind(ticket) || row.lessonSourceLabel || "개인",
    lessonSource: row.lessonSource,
    durationMinutes: row.durationMinutes,
    status: "scheduled",
  };
}

function scheduleClipboardDefaults(button) {
  return scheduleClipboardDefaultsForSlot(
    button.dataset.addLessonDay,
    button.dataset.addLessonTime,
    button.dataset.addLessonCoach,
  );
}

function scheduleClipboardDefaultsForSlot(day, time, coachId) {
  const clipboard = state.scheduleLessonClipboard;
  if (!clipboard || !scheduleClipboardCanPaste(day, time, coachId)) return {};
  return {
    memberName: clipboard.memberName,
    ticketId: clipboard.ticketId,
    durationMinutes: clipboard.durationMinutes,
    lessonType: clipboard.lessonType,
    lessonSource: clipboard.lessonSource,
    pastedLesson: true,
  };
}

function scheduleFilterMatches(lesson) {
  return (
    state.scheduleFilter === "all" ||
    (state.scheduleFilter === "available" && isLessonAvailable(lesson)) ||
    (state.scheduleFilter === "pending" && isPendingScheduleLesson(lesson))
  );
}

function scheduleTimeHasFilteredLesson(time) {
  if (state.scheduleFilter === "all") return true;
  return scheduleDays.some((day) =>
    operationBranchLessons().some((lesson) => {
      if (!scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
      const start = timeToMinutes(lesson.time);
      const end = start + lesson.durationMinutes;
      const slot = timeToMinutes(time);
      return lesson.day === day && slot >= start && slot < end;
    }),
  );
}

function lessonOverlapsScheduleSlot(lesson, day, time) {
  if (lesson.day !== day || isLessonCancelled(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + scheduleBlockMinutes;
  const lessonStart = timeToMinutes(lesson.time);
  const lessonEnd = lessonStart + (Number(lesson.durationMinutes) || 20);
  return slotStart < lessonEnd && slotEnd > lessonStart;
}

function coachScheduleVisibleTimes(day, visibleCoaches) {
  const coachIds = new Set(visibleCoaches.map((coach) => coach.id));
  return makeTimeRange(scheduleSettings.openStart, scheduleSettings.openEnd).filter((time) => {
    const matchingLesson = lessons.some((lesson) => (
      coachIds.has(lesson.coachId)
      && lessonOverlapsScheduleSlot(lesson, day, time)
      && scheduleFilterMatches(lesson)
      && scheduleLessonMatches(lesson)
    ));
    if (state.scheduleFilter !== "all") return matchingLesson;
    return matchingLesson || visibleCoaches.some((coach) => isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes));
  });
}

function getAdminDurationSlotState(day, time, coach, laneLessons = null, availability = null) {
  if (coach.id?.startsWith("closed-")) {
    return {
      className: "is-closed",
      occupyingLesson: null,
      working: false,
      breakRule: null,
      canAdd: false,
      pasteReady: false,
    };
  }
  const candidateLessons = Array.isArray(laneLessons)
    ? laneLessons
    : operationBranchLessons().filter((lesson) => lessonScheduleCoachId(lesson) === coach.id);
  const occupyingLesson = candidateLessons.find((lesson) => lessonOverlapsScheduleSlot(lesson, day, time));
  const breakRule = getCoachBreakOverlapping(coach.id, day, time, 10) || getBreakRuleOverlapping(day, time, 10, coach.id);
  const working = !breakRule && isCoachAvailableForSlot(coach.id, day, time, 10);
  const canAdd = !occupyingLesson
    && working
    && (availability
      ? availability.hasCourtCapacity && availability.coachIds.has(coach.id)
      : canAddLessonAt(day, time, 20, coach.id));
  return {
    className: occupyingLesson ? "is-occupied" : breakRule ? "is-break" : working ? "is-open" : "is-closed",
    occupyingLesson,
    working,
    breakRule,
    canAdd,
    pasteReady: canAdd && scheduleClipboardCanPaste(day, time, coach.id),
  };
}

function buildAdminDurationSlotStateIndex(displayDays, visibleTimes, lanes, laneLessons, scheduleLessons) {
  const stateIndex = new Map();
  const activeCoaches = operationBranchCoaches()
    .filter((coach) => coach.status === "active");
  const bookedLessonsByDay = new Map(displayDays.map((day) => [day, []]));

  scheduleLessons.forEach((lesson) => {
    if (
      !bookedLessonsByDay.has(lesson.day)
      || !isBookedLesson(lesson)
      || isReleasedRegularMakeupSlot(lesson)
      || !lessonMatchesActiveScheduleWeek(lesson, lesson.day)
    ) return;
    bookedLessonsByDay.get(lesson.day).push(lesson);
  });

  displayDays.forEach((day) => {
    visibleTimes.forEach((time) => {
      const interval = {
        start: timeToMinutes(time),
        end: timeToMinutes(time) + 20,
      };
      const overlappingBooked = bookedLessonsByDay.get(day)
        .filter((lesson) => intervalsOverlap(interval, lessonInterval(lesson)));
      const usedCoachIds = new Set(overlappingBooked.map((lesson) => lessonScheduleCoachId(lesson)));
      const hasCourtCapacity = overlappingBooked.length < fixedCourtCount;
      const availableCoachIds = new Set(activeCoaches
        .filter((coach) => (
          !usedCoachIds.has(coach.id)
          && !getCoachBreakOverlapping(coach.id, day, time, 20)
          && !getBreakRuleOverlapping(day, time, 20, coach.id)
          && isCoachAvailableForSlot(coach.id, day, time, 20)
        ))
        .map((coach) => coach.id));

      lanes.forEach(({ day: laneDay, coach }, laneIndex) => {
        if (laneDay !== day) return;
        if (coach.id?.startsWith("closed-")) {
          stateIndex.set(`${laneIndex}|${time}`, {
            className: "is-closed",
            occupyingLesson: null,
            working: false,
            breakRule: null,
            canAdd: false,
            pasteReady: false,
          });
          return;
        }
        const occupyingLesson = laneLessons[laneIndex]
          .find((lesson) => lessonOverlapsScheduleSlot(lesson, day, time));
        const breakRule = getCoachBreakOverlapping(coach.id, day, time, 10)
          || getBreakRuleOverlapping(day, time, 10, coach.id);
        const working = !breakRule && isCoachAvailableForSlot(coach.id, day, time, 10);
        const canAdd = !occupyingLesson
          && working
          && hasCourtCapacity
          && availableCoachIds.has(coach.id);
        stateIndex.set(`${laneIndex}|${time}`, {
          className: occupyingLesson ? "is-occupied" : breakRule ? "is-break" : working ? "is-open" : "is-closed",
          occupyingLesson,
          working,
          breakRule,
          canAdd,
          pasteReady: canAdd && scheduleClipboardCanPaste(day, time, coach.id),
        });
      });
    });
  });

  return stateIndex;
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => {
    const memberUserId = option.memberUserId
      ? ` data-member-user-id="${escapeHtml(String(option.memberUserId))}"`
      : "";
    return `<option value="${option.value}"${memberUserId}>${option.label}</option>`;
  }).join("");
}

function isRegularScheduleSetup(ticket) {
  return Boolean(
    ticket
    && !state.editingLessonId
    && !state.quickLessonEntry
    && normalizeLessonSource($("#lessonSource")?.value) === "regular"
    && !isPastLessonCorrectionMode(getLessonFormCandidate())
  );
}

function requiredRegularScheduleCount(ticket) {
  if (!isRegularScheduleSetup(ticket)) return 1;
  const weeklyUnits = Math.max(1, getTicketWeeklyCount(ticket));
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const selectedMinutes = Math.max(baseMinutes, Number($("#lessonDuration")?.value) || baseMinutes);
  const unitsPerLesson = Math.max(1, Math.ceil(selectedMinutes / baseMinutes));
  return Math.max(1, Math.min(7, Math.ceil(weeklyUnits / unitsPerLesson)));
}

function getLessonScheduleSlots() {
  const primaryDay = $("#lessonDay").value;
  const primaryTime = $("#lessonTime").value;
  if (isPastLessonCorrectionMode({
    day: primaryDay,
    time: primaryTime,
    durationMinutes: Number($("#lessonDuration").value) || 20,
  })) {
    return [{ day: primaryDay, time: primaryTime }];
  }
  const extraSchedules = $$("[data-lesson-slot-day]")
    .filter((daySelect) => !daySelect.disabled)
    .map((daySelect) => {
      const row = daySelect.closest(".lesson-repeat-slot");
      const timeSelect = row?.querySelector("[data-lesson-slot-time]");
      return { day: daySelect.value, time: timeSelect?.value || "" };
    });
  return [{ day: primaryDay, time: primaryTime }].concat(extraSchedules);
}

function getRegularScheduleValidation(ticket) {
  const editingExistingLesson = Boolean(state.editingLessonId);
  const requiredCount = editingExistingLesson ? 1 : requiredRegularScheduleCount(ticket);
  const slots = getLessonScheduleSlots().slice(0, requiredCount);
  const incompleteSlots = slots.filter((slot) => !slot.day || !slot.time);
  const weeklyUnits = Math.max(1, getTicketWeeklyCount(ticket));
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const selectedMinutes = Math.max(baseMinutes, Number($("#lessonDuration")?.value) || baseMinutes);
  const unitsPerLesson = Math.max(1, Math.ceil(selectedMinutes / baseMinutes));
  const allocatedUnits = requiredCount * unitsPerLesson;
  const weeklyUnitLimit = getTicketWeeklyUnitLimit(ticket);
  const allocationMismatch = !editingExistingLesson
    && !state.quickLessonEntry
    && (allocatedUnits < weeklyUnits || allocatedUnits > weeklyUnitLimit);
  const missingSlotNumbers = slots
    .map((slot, index) => (!slot.day || !slot.time ? index + 1 : null))
    .filter(Boolean);
  return {
    requiredCount,
    slots,
    isRequired: requiredCount > 1,
    incompleteSlots,
    duplicateDay: "",
    weeklyUnits,
    weeklyUnitLimit,
    unitsPerLesson,
    allocatedUnits,
    allocationMismatch,
    valid: incompleteSlots.length === 0 && !allocationMismatch && slots.length === requiredCount,
    message: incompleteSlots.length
      ? `주 ${weeklyUnits}회 이용권입니다. 일정 ${missingSlotNumbers.join(", ")}의 요일과 시간을 선택해 주세요.`
      : allocationMismatch
        ? `${selectedMinutes}분 수업은 ${unitsPerLesson}회분을 사용합니다. 이 회원권은 주 ${weeklyUnits}~${weeklyUnitLimit}회분까지 배정할 수 있습니다.`
        : "",
  };
}

function regularScheduleSlotIssue(slot, index, ticket, candidate, validation) {
  if (!slot?.day || !slot?.time) return "요일/시간 선택 필요";
  if (validation.duplicateDay && validation.duplicateDay === slot.day) return "요일 중복";
  if (ticket && !ticketAllowsScheduleDay(ticket, slot.day)) return "이 회원권에서 선택할 수 없는 요일";
  const internalConflict = getInternalScheduleConflict(validation.slots, candidate.durationMinutes);
  if (internalConflict && internalConflict.day === slot.day) return internalConflict.message;
  const exactDuplicate = getAdminManualExactDuplicate(getLessonFormCandidate({ day: slot.day, time: slot.time }));
  if (exactDuplicate) return "이미 같은 회원권·날짜·시간의 수업이 있습니다";
  const conflict = getLessonConflict(getLessonFormCandidate({ day: slot.day, time: slot.time }));
  if (conflict) return conflict.message;
  return "";
}

function regularScheduleIssueRows(ticket, candidate, validation) {
  const requiredCount = validation.requiredCount || 1;
  const slots = Array.from({ length: requiredCount }, (_, index) => validation.slots[index] || { day: "", time: "" });
  return slots.map((slot, index) => {
    const issue = regularScheduleSlotIssue(slot, index, ticket, candidate, validation);
    return {
      index: index + 1,
      slot,
      issue,
      label: slot.day && slot.time
        ? `${slot.day} ${slot.time}~${minutesToTime(timeToMinutes(slot.time) + candidate.durationMinutes)}`
        : "미선택",
    };
  });
}

function regularScheduleSaveCheckMessage(ticket, candidate, validation) {
  const issueRows = regularScheduleIssueRows(ticket, candidate, validation).filter((row) => row.issue);
  if (!issueRows.length) return "";
  return issueRows
    .slice(0, 3)
    .map((row) => `${row.index}번 ${row.label}: ${row.issue}`)
    .join(" / ");
}

function getSelectedLessonSchedules() {
  return getLessonScheduleSlots().filter((item) => item.day && item.time);
}

function getSelectedLessonDays() {
  return getSelectedLessonSchedules().map((item) => item.day);
}

function getLessonTicketOptionLabel(ticket) {
  const memberNames = ticketParticipantNames(ticket).join(" & ") || ticket.member || "회원";
  return `${memberNames} · ${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function scheduleTicketById(ticketId) {
  return [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)]
    .find((item) => String(item.id) === String(ticketId || "")) || null;
}

function adminManualOverrideAvailable() {
  return state.liveScheduleLoaded && operationsRole() === "admin";
}

function adminManualOverrideEnabled() {
  return adminManualOverrideAvailable() && Boolean($("#lessonAdminOverride")?.checked);
}

function getLessonDurationFromSelectedTicket() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  return getTicketDurationMinutes(ticket);
}

function getTimeOptionsForLessonSlot(day) {
  if (!day) return [{ value: "", label: "시간 선택" }];
  const coachId = $("#lessonCoach").value;
  const durationMinutes = getLessonDurationFromSelectedTicket();
  const sourceTimes = adminManualOverrideEnabled()
    ? getScheduleTimeOptions()
    : getCoachTimeOptions(coachId, day, durationMinutes);
  const timeOptions = sourceTimes.map((time) => ({ value: time, label: time }));
  return timeOptions.length ? timeOptions : [{ value: "", label: "가능 시간 없음" }];
}

function selectedLessonMemberReference() {
  const select = $("#lessonMember");
  const selectedUserId = select?.selectedOptions?.[0]?.dataset?.memberUserId || "";
  if (selectedUserId) {
    const exactMember = members.find((member) => memberServerUserIds(member).includes(selectedUserId));
    if (exactMember) return exactMember;
  }
  return select?.value || "";
}

function lessonTicketEligibilityDate() {
  const day = $("#lessonDay")?.value || "";
  return (day ? adminLessonDateForCandidate(day) : "") || adminLocalDateKey(new Date());
}

function ticketCanBeUsedOnLessonDate(ticket, lessonDate = lessonTicketEligibilityDate()) {
  const ticketState = window.TennisNoteTicketState?.derive(ticket, lessonDate) || "";
  if (ticketState) return ["current", "paused"].includes(ticketState);
  return isCurrentMemberTicket(ticket, lessonDate);
}

function getEligibleTickets(memberReference, coachId, lessonDate = lessonTicketEligibilityDate()) {
  const editingTicket = getTicketByLesson(getCurrentEditingLesson());
  const editingTicketId = editingTicket?.id || "";
  const sourceTickets = adminManualOverrideEnabled()
    ? [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)].filter((ticket, index, source) => (
      source.findIndex((item) => String(item.id) === String(ticket.id)) === index
      && ticketBelongsToMember(ticket, memberReference)
    ))
    : allTicketsForMember(memberReference);
  const eligibleTickets = sourceTickets.filter((ticket) => adminManualOverrideEnabled() || (
    ticket.coachId === coachId
    && (ticket.remaining > 0 || ticket.id === editingTicketId)
    && ticketCanBeUsedOnLessonDate(ticket, lessonDate)
  ));
  // Existing lessons are already bound to a server ticket. Keep that identity
  // while editing instead of rediscovering it from display names or coach lanes.
  if (editingTicket && !eligibleTickets.some((ticket) => String(ticket.id) === String(editingTicket.id))) {
    eligibleTickets.unshift(editingTicket);
  }
  return eligibleTickets;
}

function findFirstMemberWithCoachTicket(coachId) {
  const ticket = [...operationBranchTickets(), ...operationBranchTickets(expiredTickets)]
    .find((item) => (
      item.coachId === coachId
      && item.remaining > 0
      && ticketCanBeUsedOnLessonDate(item)
    ));
  if (!ticket) return "";
  const branchMembers = operationBranchMembers();
  const owner = branchMembers.find((member) => memberServerUserIds(member).includes(ticket.serverUserId));
  return owner?.name || branchMembers.find((member) => ticketBelongsToMember(ticket, member))?.name || ticketParticipantNames(ticket)[0] || "";
}

function findFirstTicketForMember(memberReference) {
  return allTicketsForMember(memberReference)
    .find((ticket) => ticket.remaining > 0 && ticketCanBeUsedOnLessonDate(ticket));
}

function getActiveTicketForMember(memberReference) {
  return allTicketsForMember(memberReference)
    .find((ticket) => ticketCanBeUsedOnLessonDate(ticket))
    || ticketsForMember(memberReference)[0]
    || allTicketsForMember(memberReference)[0];
}

function alignCoachToSelectedMemberTicket() {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(memberReference, coachId).length) return;
  const ticket = findFirstTicketForMember(memberReference);
  if (ticket) $("#lessonCoach").value = ticket.coachId;
}

function getSelectableMembers(search = "", allMembers = members) {
  const keyword = search.trim().toLowerCase();
  const matchingMembers = allMembers.filter((member) => {
    const status = memberListStatus(member);
    const usableOnSelectedDate = allTicketsForMember(member)
      .some((ticket) => ticket.remaining > 0 && ticketCanBeUsedOnLessonDate(ticket));
    if (!adminManualOverrideEnabled() && status === "inactive") return false;
    if (!adminManualOverrideEnabled() && status === "expired" && !usableOnSelectedDate) return false;
    return !keyword || memberSearchValues(member)
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  return dedupeMembersByLessonUnit(matchingMembers);
}

function getMemberOptionLabel(member) {
  const ticket = getActiveTicketForMember(member);
  if (!ticket) return `${member.name} · 회원권 없음`;
  const displayName = memberDirectoryDisplayName(member, ticket);
  return `${displayName} · ${getTicketDisplayProduct(ticket)} · 총 ${ticket.total}회 · 잔여 ${ticket.remaining}회`;
}

function getExpiredTicketsForMember(memberName) {
  const member = memberName && typeof memberName === "object" ? memberName : null;
  const displayName = member ? member.name : memberName;
  if (!displayName) return [];
  return expiredTickets.filter((ticket) => ticketBelongsToMember(ticket, member || displayName));
}

function sameDayRegularAdjustmentContext(candidate = getLessonFormCandidate()) {
  if (operationsRole() !== "admin" || state.editingLessonId || !state.quickLessonEntry) return null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const releasedSlot = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .find((lesson) => lesson.coachId === candidate.coachId && isReleasedRegularMakeupSlot(lesson));
  if (!lessonDate || !releasedSlot) return null;
  const memberName = $("#lessonMember")?.value || "";
  const sourceLessons = memberName ? lessons.filter((lesson) => (
    lesson.serverLessonId
    && lessonSourceValue(lesson) === "regular"
    && isLessonEditableScheduled(lesson)
    && String(lesson.id) !== String(releasedSlot.id)
    && (lesson.lessonDate || adminWeekDateForDay(lesson.day)) === lessonDate
    && getLessonParticipantNames(lesson).includes(memberName)
  )).sort((left, right) => String(left.time || "").localeCompare(String(right.time || ""))) : [];
  return { lessonDate, releasedSlot, memberName, sourceLessons };
}

async function moveSameDayRegularLessonToSelectedSlot() {
  const targetCandidate = getLessonFormCandidate();
  const context = sameDayRegularAdjustmentContext(targetCandidate);
  const sourceLessonId = $("#lessonSameDayAdjustmentSource")?.value || "";
  const sourceLesson = context?.sourceLessons.find((lesson) => String(lesson.id) === sourceLessonId);
  const sourceTicket = getTicketByLesson(sourceLesson);
  if (!context || !sourceLesson || !sourceTicket) {
    setLessonFormMessage("같은 날짜에 옮길 기존 정규수업을 선택해 주세요.", "danger");
    return;
  }
  const sourceDate = sourceLesson.lessonDate || adminWeekDateForDay(sourceLesson.day);
  if (sourceDate !== context.lessonDate) {
    setLessonFormMessage("당일 시간조정은 같은 날짜 안에서만 가능합니다.", "danger");
    return;
  }

  const target = {
    day: targetCandidate.day,
    time: targetCandidate.time,
    coachId: targetCandidate.coachId,
    courtId: targetCandidate.courtId,
  };
  state.editingLessonId = sourceLesson.id;
  state.quickLessonEntry = false;
  state.quickLessonEdit = true;
  state.quickLessonDetailsExpanded = false;
  state.releasedAbsenceEntitlementId = "";
  state.pinnedLessonTicketId = "";
  state.pinnedLessonRepeatSlots = [];
  state.lessonSourceTouched = true;
  state.lessonOperationKey = createAdminOperationKey("same-day-regular-adjustment");
  $("#lessonRepeatSlots").innerHTML = "";
  const memberName = getLessonParticipantNames(sourceLesson)[0] || context.memberName;
  $("#lessonMemberSearch").value = memberName;
  refreshLessonMemberOptions(memberName, sourceLesson);
  $("#lessonMember").value = memberName;
  $("#lessonCoach").value = target.coachId;
  refreshLessonTicketOptions();
  $("#lessonTicket").value = sourceTicket.id;
  $("#lessonSource").value = "regular";
  $("#lessonDuration").value = String(sourceLesson.durationMinutes || 20);
  $("#lessonDay").value = target.day;
  $("#lessonTime").value = target.time;
  $("#lessonCourt").value = target.courtId;
  const singleScope = document.querySelector('input[name="lessonEditScope"][value="single"]');
  if (singleScope) singleScope.checked = true;
  renderLessonPreview();
  await addLessonFromForm({ preventDefault() {} });
}

function isTwoOnOneLessonType() {
  const selectedTicket = getSelectedTicket();
  return getTicketLessonKind(selectedTicket) === "2대1";
}

function getLessonTypeFromForm() {
  const ticket = getSelectedTicket();
  const ticketKind = getTicketLessonKind(ticket);
  if (ticketKind) return ticketKind;
  return "개인";
}

function matchingAdminMakeupEntitlements(memberName = $("#lessonMember")?.value, coachId = $("#lessonCoach")?.value) {
  return openAdminMakeupEntitlements().filter((item) => {
    const memberMatches = !memberName || item.memberNames.includes(memberName) || item.member === memberName;
    const coachMatches = !coachId || item.coachId === coachId;
    return memberMatches && coachMatches;
  });
}

function selectedAdminMakeupEntitlement() {
  const entitlementId = $("#lessonMakeupEntitlement")?.value || "";
  return openAdminMakeupEntitlements().find((item) => item.id === entitlementId) || null;
}

function isCouponLessonTicket(ticket) {
  if (!ticket) return false;
  const productKind = String(ticket.productKind || membershipProductForTicket(ticket).productKind || "").toLowerCase();
  return ["pass", "coupon"].includes(productKind) || String(ticket.product || "").includes("쿠폰");
}

function allowedLessonSourcesForTicket(ticket = getSelectedTicket()) {
  if (!ticket) return [];
  return isCouponLessonTicket(ticket)
    ? ["coupon", "makeup"]
    : ["regular", "makeup"];
}

function suggestedLessonSourceForTicket(ticket = getSelectedTicket()) {
  if (!ticket) return "regular";
  return isCouponLessonTicket(ticket) ? "coupon" : "regular";
}

function ticketMatchesLessonSource(ticket, source = $("#lessonSource")?.value) {
  if (!ticket) return false;
  const normalizedSource = normalizeLessonSource(source);
  if (["admin", "coach_change", "makeup"].includes(normalizedSource)) return true;
  return allowedLessonSourcesForTicket(ticket).includes(normalizedSource);
}

function alignTicketToLessonSource(preferredTicketId = state.pinnedLessonTicketId) {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  const source = normalizeLessonSource($("#lessonSource").value);
  const eligible = getEligibleTickets(memberReference, coachId);
  const matchingTicket = eligible.find((ticket) => (
    String(ticket.id) === String(preferredTicketId || "")
    && ticketMatchesLessonSource(ticket, source)
  )) || eligible.find((ticket) => ticketMatchesLessonSource(ticket, source));
  if (matchingTicket) $("#lessonTicket").value = matchingTicket.id;
  return matchingTicket || null;
}

function getSelectedTicket() {
  return scheduleTicketById($("#lessonTicket").value);
}

function getCurrentEditingLesson() {
  return state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
}

function adminForceDeleteLessonTarget(candidate = getLessonFormCandidate()) {
  const editingLesson = getCurrentEditingLesson();
  if (editingLesson) return editingLesson;
  if (operationsRole() !== "admin" || !candidate?.day || !candidate?.time) return null;
  const exactDuplicate = getAdminManualExactDuplicate(candidate);
  if (exactDuplicate) return exactDuplicate;
  const conflict = isPastLessonCorrectionMode(candidate)
    ? getPastLessonCorrectionConflict(candidate)
    : getLessonConflict(candidate);
  return conflict?.lesson || null;
}

function getEditingLessonMemberName(lesson, allMembers = members) {
  if (!lesson) return "";
  const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
    ? lesson.serverParticipantUserIds.filter(Boolean)
    : [];
  const participantNames = getLessonParticipantNames(lesson);
  const currentTicket = getTicketByLesson(lesson);
  const matchingMembers = allMembers.filter((member) => {
    const matchesParticipantId = participantUserIds.length
      && memberServerUserIds(member).some((userId) => participantUserIds.includes(userId));
    const matchesParticipantName = participantNames.includes(member.name);
    return (matchesParticipantId || matchesParticipantName)
      && (!currentTicket || ticketBelongsToMember(currentTicket, member));
  });
  const ticketOwner = matchingMembers.find((member) => memberServerUserIds(member).includes(currentTicket?.serverUserId));
  return ticketOwner?.name
    || matchingMembers[0]?.name
    || participantNames.find((name) => allMembers.some((member) => member.name === name))
    || "";
}

function autoAssignOpenLessonSlot() {
  const durationMinutes = Number($("#lessonDuration").value);
  const day = $("#lessonDay").value;
  const time = $("#lessonTime").value;
  if (!day || !time) return;
  const pinnedTicket = tickets.find((ticket) => String(ticket.id) === String(state.pinnedLessonTicketId || ""));
  if (pinnedTicket) {
    const pinnedMemberName = ticketParticipantNames(pinnedTicket)[0] || splitMemberNames(pinnedTicket.member)[0] || "";
    if (pinnedMemberName && [...$("#lessonMember").options].some((option) => option.value === pinnedMemberName)) {
      $("#lessonMember").value = pinnedMemberName;
    }
    if ([...$("#lessonCoach").options].some((option) => option.value === pinnedTicket.coachId)) {
      $("#lessonCoach").value = pinnedTicket.coachId;
    }
    $("#lessonCourt").value = getAvailableCourtId(day, time, durationMinutes);
    return;
  }
  $("#lessonCoach").value = getAvailableCoachId(day, time, durationMinutes, $("#lessonCoach").value);
  $("#lessonCourt").value = getAvailableCourtId(day, time, durationMinutes);
  ensureMemberHasCoachTicket();
}

function getLessonFormCandidate(overrides = {}) {
  const day = overrides.day || $("#lessonDay").value;
  const durationMinutes = Number($("#lessonDuration").value);
  const selectedTicket = getSelectedTicket();
  const participantNames = ticketParticipantNames(selectedTicket);
  syncLessonTypeFromForm();
  return {
    id: state.editingLessonId || Date.now(),
    day,
    lessonDate: overrides.lessonDate || adminLessonDateForCandidate(day),
    time: $("#lessonTime").value,
    courtId: $("#lessonCourt").value,
    coachId: $("#lessonCoach").value,
    member: participantNames.length ? participantNames.join("&") : $("#lessonMember").value,
    ticketId: selectedTicket?.id || "",
    type: getLessonTypeFromForm(),
    lessonSource: normalizeLessonSource($("#lessonSource").value),
    durationMinutes,
    status: $("#lessonType").value === "보강 가능" ? "available" : "scheduled",
    ...overrides,
  };
}

function clearLessonSaveResultPanel() {
  const target = $("#lessonSaveResultPanel");
  if (!target) return;
  target.hidden = true;
  target.className = "lesson-save-result-panel";
  target.innerHTML = "";
}

function adminLessonEndTimestamp(candidate = {}) {
  const lessonDate = adminWeekDateForDay(candidate.day || $("#lessonDay")?.value);
  const lessonTime = candidate.time || $("#lessonTime")?.value;
  const durationMinutes = Number(candidate.durationMinutes || $("#lessonDuration")?.value) || 20;
  if (!lessonDate || !lessonTime) return Number.NaN;
  const startTimestamp = new Date(`${lessonDate}T${lessonTime}:00`).getTime();
  return startTimestamp + durationMinutes * 60 * 1000;
}

function isPastLessonCorrectionMode(candidate = {}) {
  if (!state.liveScheduleLoaded || operationsRole() !== "admin") return false;
  const editingLesson = getCurrentEditingLesson();
  if (editingLesson && !["scheduled", "completed", "no_show", "cancelled"].includes(lessonStatusValue(editingLesson))) {
    return false;
  }
  const endTimestamp = adminLessonEndTimestamp(candidate);
  return Number.isFinite(endTimestamp) && endTimestamp <= Date.now();
}

function isCompletedLessonCorrectionMode() {
  const editingLesson = getCurrentEditingLesson();
  const correctingAsAbsence = document.querySelector('input[name="lessonPastCorrectionMode"]:checked')?.value === "absence";
  return Boolean(
    state.liveScheduleLoaded
    && operationsRole() === "admin"
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "completed"
    && !correctingAsAbsence
  );
}

function getPastLessonCorrectionConflict(candidate, allLessons = lessons) {
  const lessonDate = adminWeekDateForDay(candidate.day);
  const duplicate = allLessons.find((lesson) => (
    lesson.id !== candidate.id
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed"].includes(lessonStatusValue(lesson))
  ));
  if (duplicate) {
    return { lesson: duplicate, message: "같은 회원권·날짜·시간의 수업 기록이 이미 있습니다." };
  }

  const overlappingLessons = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes);
  const releasedRegularSlot = overlappingLessons.find((lesson) => (
    lesson.id !== candidate.id
    && isReleasedRegularMakeupSlot(lesson)
    && lesson.coachId === candidate.coachId
  ));
  if (
    releasedRegularSlot
    && candidate.lessonSource !== "makeup"
    && !isSameDateRegularLessonAdjustment(candidate, releasedRegularSlot)
  ) {
    return {
      lesson: releasedRegularSlot,
      message: "불참으로 비워진 정규 자리는 보강 또는 기존 정규수업의 같은 날 시간조정만 가능합니다.",
    };
  }

  const coachConflict = overlappingLessons
    .find((lesson) => (
      lesson.id !== candidate.id
      && !isReleasedRegularMakeupSlot(lesson)
      && lesson.coachId === candidate.coachId
      && ["scheduled", "pending_change", "completed"].includes(lessonStatusValue(lesson))
    ));
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}의 기존 수업과 시간이 겹칩니다.` };
  }
  return null;
}

function getAdminManualExactDuplicate(candidate, allLessons = lessons) {
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  return allLessons.find((lesson) => (
    String(lesson.id) !== String(candidate.id)
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed", "no_show"].includes(lessonStatusValue(lesson))
  )) || null;
}

function getAdminManualOverrideWarnings(candidate, ticket, pastCorrection = false) {
  const warnings = [];
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const addWarning = (message) => {
    if (message && !warnings.includes(message)) warnings.push(message);
  };
  if (!ticket) return ["연결할 회원권이 없어 저장할 수 없습니다."];
  if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) addWarning("회원권 종류와 선택한 수업 종류가 다릅니다.");
  if (!["active", "paused"].includes(ticket.status)) addWarning(`회원권 상태가 ${memberTicketStatusLabel(ticket)}입니다.`);
  if (lessonDate && (lessonDate < (ticket.purchased || "") || lessonDate > (ticket.expires || "9999-12-31"))) {
    addWarning("회원권 사용기간 밖의 날짜입니다.");
  }
  if (!ticketAllowsScheduleDay(ticket, candidate.day)) addWarning(`${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))} 범위 밖의 요일입니다.`);
  const ticketDuration = getTicketDurationMinutes(ticket);
  if (![ticketDuration, ticketDuration * 2].includes(candidate.durationMinutes)) addWarning("회원권 기준과 수업 시간이 다릅니다.");
  if (candidate.lessonSource === "makeup" && !state.editingLessonId && !selectedAdminMakeupEntitlement()) {
    addWarning("연결된 보강 대기 없이 보강수업을 직접 등록합니다.");
  }
  if (pastCorrection && !state.editingLessonId && candidate.lessonSource === "regular") {
    addWarning("새 과거 수업을 정규수업으로 직접 등록합니다.");
  }
  if (pastCorrection && Number(ticket.remaining) <= 0) addWarning("잔여 횟수가 없어 완료 기록만 남고 차감은 0회가 될 수 있습니다.");
  const conflict = pastCorrection ? getPastLessonCorrectionConflict(candidate) : getLessonConflict(candidate);
  if (conflict && !getAdminManualExactDuplicate(candidate)) addWarning(conflict.message);
  return warnings;
}

function pastLessonCorrectionMode() {
  return document.querySelector('input[name="lessonPastCorrectionMode"]:checked')?.value === "absence"
    ? "absence"
    : "complete";
}

function oneDayBookingFormValues() {
  return {
    bookingId: state.editingOneDayBookingId || null,
    guestName: $("#oneDayGuestName")?.value.trim() || "",
    guestPhone: $("#oneDayGuestPhone")?.value.trim() || "",
    coachId: $("#oneDayCoach")?.value || "",
    bookingDate: $("#oneDayDate")?.value || "",
    time: $("#oneDayTime")?.value || "",
    durationMinutes: Number($("#oneDayDuration")?.value || 20),
    status: $("#oneDayStatus")?.value || "reserved",
    note: $("#oneDayNote")?.value.trim() || "",
  };
}

function oneDayDateForDefaults(defaults = {}) {
  if (defaults.bookingDate) return defaults.bookingDate;
  if (defaults.day) return adminWeekDateForDay(defaults.day);
  const selectedDay = state.selectedScheduleDay || currentScheduleDay();
  return adminWeekDateForDay(selectedDay) || adminLocalDateKey(new Date());
}

function releasedAbsenceEntitlement() {
  return state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
}

function selectedLessonEditScope() {
  const value = document.querySelector('input[name="lessonEditScope"]:checked')?.value;
  return value === "series" || value === "reset" ? value : "single";
}

function matchingRegularLessonSeries(editingLesson = getCurrentEditingLesson(), allLessons = lessons) {
  if (!editingLesson) return [];
  const sourceDate = editingLesson.lessonDate || adminWeekDateForDay(editingLesson.day);
  return allLessons.filter((lesson) => (
    String(lesson.ticketId || lesson.serverTicketId || "") === String(editingLesson.ticketId || editingLesson.serverTicketId || "")
    && normalizeLessonSource(lesson.lessonSource) === "regular"
    && lessonStatusValue(lesson) === "scheduled"
    && (lesson.lessonDate || adminWeekDateForDay(lesson.day)) >= sourceDate
    && lesson.day === editingLesson.day
    && lesson.time === editingLesson.time
  ));
}

function expectedLiveLessonRows(ticket, candidates = []) {
  return candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminWeekDateForDay(candidate.day),
    day: candidate.day,
    time: candidate.time,
    durationMinutes: Number(candidate.durationMinutes),
    lessonSource: liveLessonSource(candidate),
    ticketId: ticket?.serverTicketId || "",
  }));
}

function liveLessonWriteVerificationDetails(ticket, candidates = []) {
  const ticketId = ticket?.serverTicketId || "";
  const requiredParticipantIds = ticket?.participantUserIds || [];
  const expectedLessons = expectedLiveLessonRows(ticket, candidates)
    .map((item) => ({ ...item, ticketId }));
  const missing = expectedLessons.filter((expected) => !liveLessonExistsAfterWrite(expected, requiredParticipantIds));
  return { expectedLessons, missing };
}

function liveLessonWriteVerification(ticket, candidates = []) {
  const details = liveLessonWriteVerificationDetails(ticket, candidates);
  if (!details.missing.length) return "";
  const missingLabel = details.missing
    .slice(0, 3)
    .map((item) => `${item.day || item.lessonDate} ${item.time}`)
    .join(", ");
  return `live_lesson_write_not_confirmed: ${missingLabel} 시간표 반영 확인 실패`;
}

function regularScheduleProtectionMessage(ticket, candidates = []) {
  if (ticket?.productKind !== "regular" || liveLessonSource(candidates[0]) !== "regular") return "";
  const targetSchedules = candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminLessonDateForCandidate(candidate.day),
    startTime: candidate.time,
  }));
  const existing = existingFutureRegularLessons(ticket.serverTicketId, targetSchedules);
  if (!existing.length) return "";
  return "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.";
}

function pendingLessonChangeApprovals() {
  return operationBranchMakeupRequests()
    .filter((request) => request.makeupType !== "entitlement" && request.serverRequestId && request.status === "pending")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

function settlementRuleFor(coachName) {
  return coachSettlementRules.find((rule) => rule.coach === coachName) || coachSettlementRules[0];
}

function settlementCoachNameFor(item) {
  if (item.forceActualCoach && item.actualCoach) return item.actualCoach;
  if (!item.actualCoach || item.actualCoach === item.coach) return item.coach;
  const actualRule = settlementRuleFor(item.actualCoach);
  if (actualRule.substitute === "originalCoach") return item.coach;
  return item.actualCoach;
}

function settlementAmountFor(item) {
  if (item.linkedTicket === false) return 0;
  if (Number.isFinite(Number(item.fixedSettlementAmount))) return Math.max(0, Math.round(Number(item.fixedSettlementAmount)));
  const settlementCoach = settlementCoachNameFor(item);
  const rule = settlementRuleFor(settlementCoach);
  const completedLessons = Math.max(0, Number(item.lessonCount) || 0);
  if (!completedLessons || !rule) return 0;
  if (rule.method === "hourly") {
    const minutes = Math.max(0, Number(item.minutes || item.durationMinutes) || 0);
    const hourlyRate = Math.max(0, Number(rule.hourly) || 0);
    if (!minutes || !hourlyRate) return 0;
    return Math.round((minutes / 60) * hourlyRate * completedLessons);
  }
  const totalLessons = Math.max(completedLessons, Number(item.totalLessons) || completedLessons);
  const baseAmount = Number(rule.cardBase === "paid" ? item.paidAmount : item.settlementBase) || 0;
  const perLessonBase = baseAmount / totalLessons;
  return Math.round(perLessonBase * completedLessons * (Number(rule.ratio) || 0));
}

function settlementRecordProgressByTicket(indexes = {}) {
  const ticketById = indexes.ticketById || new Map();
  const assignmentByLesson = indexes.assignmentByLesson || new Map();
  const progressByTicket = new Map();
  (adminLiveDataState.lessonRecords || []).forEach((record) => {
    const linkedLesson = Array.isArray(record.tn_lessons) ? record.tn_lessons[0] : record.tn_lessons || {};
    const ticketId = String(record.deducted_ticket_id || linkedLesson.member_ticket_id || "");
    const ticket = ticketById.get(ticketId);
    if (!ticketId || !ticket) return;
    const sessions = Math.max(0, Number(record.deducted_sessions) || 0);
    if (!sessions) return;
    const coachRoleId = String(record.coach_role_id || "");
    const durationMinutes = Math.max(0, Number(linkedLesson.duration_minutes || ticket.durationMinutes) || 0);
    const progress = progressByTicket.get(ticketId) || {
      recordedSessions: 0,
      byCoachRole: new Map(),
      substituteGroups: new Map(),
    };
    progress.recordedSessions += sessions;
    const coachProgress = progress.byCoachRole.get(coachRoleId) || { sessions: 0, minutes: 0 };
    coachProgress.sessions += sessions;
    coachProgress.minutes += sessions * durationMinutes;
    progress.byCoachRole.set(coachRoleId, coachProgress);

    const originalCoachRoleId = String(ticket.coachRoleId || "");
    if (coachRoleId && originalCoachRoleId && coachRoleId !== originalCoachRoleId) {
      const assignment = assignmentByLesson.get(String(record.lesson_id || ""));
      const mode = assignment?.settlement_mode || "actual_coach";
      const hourlyAmount = mode === "hourly" ? Math.max(0, Number(assignment?.hourly_amount) || 0) : 0;
      const key = `${coachRoleId}|${mode}|${hourlyAmount}`;
      const substitute = progress.substituteGroups.get(key) || {
        coachRoleId,
        mode,
        hourlyAmount,
        sessions: 0,
        minutes: 0,
      };
      substitute.sessions += sessions;
      substitute.minutes += sessions * durationMinutes;
      progress.substituteGroups.set(key, substitute);
    }
    progressByTicket.set(ticketId, progress);
  });
  return progressByTicket;
}

function settlementRowsForBilling(billing, indexes = {}) {
  const ticket = indexes.ticketById?.get(String(billing.ticketId || ""))
    || [...tickets, ...expiredTickets].find((item) => item.serverTicketId === billing.ticketId || item.id === billing.ticketId)
    || {};
  const ticketId = ticket.serverTicketId || ticket.id;
  const base = {
    member: billing.member,
    coach: ticketId ? getCoachName(ticket.coachId || "") : "회원권 미연결",
    linkedTicket: Boolean(ticketId),
    paidAmount: Number(billing.finalAmount || billing.amount) || 0,
    settlementBase: settlementBaseAmountForBilling(billing),
    paymentMethod: String(billing.method || "").toLowerCase().includes("card") ? "카드" : "현금",
    discount: Number(billing.discountAmount) > 0 ? `할인 ${money.format(billing.discountAmount)}원` : "할인 없음",
    totalLessons: Number(ticket.total) || 0,
    minutes: Number(ticket.durationMinutes) || 20,
  };
  if (indexes.recordProgressByTicket) {
    if (!ticketId) return [{ ...base, actualCoach: base.coach, lessonCount: 0, summaryPaidAmount: base.paidAmount }];
    const progress = indexes.recordProgressByTicket.get(String(ticketId)) || {
      recordedSessions: 0,
      byCoachRole: new Map(),
      substituteGroups: new Map(),
    };
    const originalCoachRoleId = String(ticket.coachRoleId || "");
    const originalProgress = progress.byCoachRole.get(originalCoachRoleId) || { sessions: 0, minutes: 0 };
    const fallbackSessions = Math.max(0, (Number(ticket.used) || 0) - (Number(progress.recordedSessions) || 0));
    const lessonCount = Math.min(
      Math.max(0, Number(ticket.total) || 0),
      Math.max(0, Number(originalProgress.sessions) || 0) + fallbackSessions,
    );
    const originalMinutes = Math.max(0, Number(originalProgress.minutes) || 0)
      + fallbackSessions * Math.max(0, Number(base.minutes) || 0);
    const originalRule = settlementRuleFor(base.coach);
    const ownRow = {
      ...base,
      actualCoach: base.coach,
      lessonCount,
      minutes: lessonCount ? originalMinutes / lessonCount : base.minutes,
      sessionKey: `${ticketId}|${originalCoachRoleId}|own`,
      summaryPaidAmount: base.paidAmount,
      fixedSettlementAmount: originalRule?.method === "hourly"
        ? Math.round(originalMinutes / 60 * Math.max(0, Number(originalRule.hourly) || 0))
        : undefined,
    };
    const substituteRows = [...progress.substituteGroups.values()].map((substitute) => {
      const actualCoach = coachNameForRoleId(substitute.coachRoleId);
      const actualRule = settlementRuleFor(actualCoach);
      const fixedSettlementAmount = substitute.mode === "none"
        ? 0
        : substitute.mode === "hourly"
          ? Math.round(substitute.minutes / 60 * substitute.hourlyAmount)
          : actualRule?.method === "hourly"
            ? Math.round(substitute.minutes / 60 * Math.max(0, Number(actualRule.hourly) || 0))
            : undefined;
      return {
        ...base,
        actualCoach,
        forceActualCoach: true,
        lessonCount: substitute.sessions,
        minutes: substitute.sessions ? substitute.minutes / substitute.sessions : base.minutes,
        sessionKey: `${ticketId}|${substitute.coachRoleId}|${substitute.mode}|${substitute.hourlyAmount}`,
        summaryPaidAmount: 0,
        fixedSettlementAmount,
        substituteHourlyRate: substitute.mode === "hourly" ? substitute.hourlyAmount : 0,
        substituteSettlementMode: substitute.mode,
      };
    });
    return [ownRow, ...substituteRows];
  }
  const completedLessons = indexes.completedLessonsByTicket?.get(String(ticketId || ""))
    || (adminLiveDataState.lessons || []).filter((lesson) => (
      String(lesson.ticketId || "") === String(ticketId || "")
      && lesson.serverStatus === "completed"
    ));
  if (!completedLessons.length) return [{ ...base, actualCoach: base.coach, lessonCount: Number(ticket.used) || 0 }];

  const assignments = adminLiveDataState.substituteAssignments || [];
  const grouped = new Map();
  completedLessons.forEach((lesson) => {
    const assignment = indexes.assignmentByLesson?.get(String(lesson.serverLessonId || ""))
      || assignments.find((item) => (
        String(item.lesson_id) === String(lesson.serverLessonId)
        && ["assigned", "completed"].includes(item.status)
      ));
    const actualCoach = assignment
      ? coachNameForRoleId(assignment.substitute_coach_role_id)
      : getCoachName(lesson.coachId || ticket.coachId || "");
    const mode = assignment?.settlement_mode || "actual_coach";
    const key = `${actualCoach}|${mode}|${assignment?.hourly_amount || 0}`;
    const row = grouped.get(key) || {
      ...base,
      actualCoach,
      forceActualCoach: Boolean(assignment),
      lessonCount: 0,
      fixedSettlementAmount: ["hourly", "none"].includes(mode) ? 0 : undefined,
      substituteHourlyRate: mode === "hourly" ? Number(assignment?.hourly_amount || 0) : 0,
      substituteSettlementMode: mode,
    };
    row.lessonCount += 1;
    if (mode === "hourly") {
      row.fixedSettlementAmount += Math.round((Number(lesson.durationMinutes || base.minutes) / 60) * Number(assignment.hourly_amount || 0));
    }
    grouped.set(key, row);
  });
  const missingCompleted = Math.max(0, (Number(ticket.used) || 0) - completedLessons.length);
  if (missingCompleted) {
    const key = `${base.coach}|actual_coach|0`;
    const row = grouped.get(key) || { ...base, actualCoach: base.coach, lessonCount: 0 };
    row.lessonCount += missingCompleted;
    grouped.set(key, row);
  }
  return [...grouped.values()];
}

function settlementOrphanSubstituteRows(indexes = {}, billedTicketIds = new Set()) {
  const rows = [];
  (indexes.recordProgressByTicket || new Map()).forEach((progress, ticketId) => {
    if (billedTicketIds.has(String(ticketId)) || !progress?.substituteGroups?.size) return;
    const ticket = indexes.ticketById?.get(String(ticketId));
    if (!ticket) return;
    const syntheticBilling = {
      member: ticket.member || "대타 수업",
      ticketId,
      amount: 0,
      finalAmount: 0,
      method: "cash",
    };
    rows.push(...settlementRowsForBilling(syntheticBilling, indexes).slice(1));
  });
  return rows;
}
function paymentCancelButtonFor(index, label = "결제취소") {
  const item = billings[index] || {};
  const context = `${item.member || "회원"} · ${item.item || "결제"} · ${label}`;
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-cancel-payment="${index}" aria-label="${escapeHtml(context)}" title="${escapeHtml(context)}">${label}</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentFullCancelButtonFor(item, index) {
  const amount = paymentFullCancelAmount(item);
  if (String(item?.method || "").toLowerCase() === "bank_transfer") return "";
  const context = `${item?.member || "회원"} · ${item?.item || "결제"} · PG 전액 결제취소 ${money.format(amount)}원`;
  if (!item?.providerPaymentId || amount <= 0) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="서버 결제번호와 결제금액이 필요합니다.">PG 전액 결제취소</button>`;
  }
  if (paymentCancelInFlight.has(item.providerPaymentId)) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}">취소 처리 중</button>`;
  }
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-cancel-payment="${index}" aria-label="${escapeHtml(context)}" title="테스트·오결제·당일 미사용 결제를 PG에서 전액 취소합니다.">PG 전액 결제취소</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentRefundButtonFor(item, index) {
  const context = `${item?.member || "회원"} · ${item?.item || "결제"} · 환불 계산`;
  if (!item?.providerPaymentId) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="서버 결제번호가 필요합니다.">환불 계산</button>`;
  }
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-refund-payment="${index}" aria-label="${escapeHtml(context)}" title="${escapeHtml(context)}">환불 계산</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

const staleReadyPaymentMs = 60 * 60 * 1000;

function isStaleReadyPayment(item = {}) {
  if (item.status !== "server_ready") return false;
  const createdAt = paymentCreatedAtMs(item);
  return Boolean(createdAt && Date.now() - createdAt > staleReadyPaymentMs);
}

function paymentDisplayStatus(item = {}) {
  if (isStaleReadyPayment(item)) {
    return {
      status: "warn",
      label: "오래된 결제 대기",
      detail: "결제창 생성 후 1시간 이상 완료 확인이 없습니다. 자동 취소하지 말고 결제 상태를 확인하세요.",
    };
  }
  return {
    status: item.status,
    label: item.statusLabel,
    detail: "",
  };
}

function billingFilterGroup(item = {}) {
  if (["cancelled", "refunded", "refund_processing", "refund_reconcile", "cancel_reconcile"].includes(item.status)) return "refund";
  if (isStaleReadyPayment(item)) return "action";
  if (["server_ready", "unverified"].includes(item.status)) return "verifying";
  if (item.status === "paid") return "done";
  return "action";
}

function paymentCancellationAuditDetail(item = {}) {
  if (!["cancelled", "refunded"].includes(item.status)) return "";
  const amount = Number(item.refundedAmount || (item.status === "cancelled" ? paymentFullCancelAmount(item) : 0));
  const parts = [];
  if (amount > 0) parts.push(`${money.format(amount)}원`);
  if (item.refundReason) parts.push(`사유: ${item.refundReason}`);
  const completedAt = paymentAuditDateTimeLabel(item.refundedAt);
  if (completedAt) parts.push(completedAt);
  return parts.join(" · ");
}

function paymentCancellationAuditLog(item = {}) {
  const detail = paymentCancellationAuditDetail(item);
  if (!detail) return "";
  return `${item.member || "회원"} · ${item.item || "결제"} · ${item.status === "refunded" ? "환불" : "PG 전액취소"} · ${detail}`;
}

function paymentActionFor(item, index) {
  const context = (label) => `aria-label="${escapeHtml(`${item.member || "회원"} · ${item.item || "결제"} · ${label}`)}" title="${escapeHtml(`${item.member || "회원"} · ${item.item || "결제"} · ${label}`)}"`;
  if (item.status === "check") return item.providerPaymentId
    ? `<button class="small-button" type="button" data-review-payment="${index}" ${context("서버 확인")}>서버 확인</button>${paymentCancelButtonFor(index, "대기취소")}`
    : '<button class="small-button" type="button" disabled>서버 결제번호 없음</button>';
  if (item.status === "unverified") return `<button class="small-button" type="button" data-review-payment="${index}" ${context("서버 연결 확인")}>서버 연결 확인</button>${paymentCancelButtonFor(index, "대기취소")}`;
  if (item.status === "failed") return `<button class="small-button" type="button" data-failed-payment="${index}" ${context("실패 확인")}>실패 확인</button>${paymentCancelButtonFor(index, "대기취소")}`;
  if (item.status === "draft") return '<button class="small-button" type="button" disabled>회원 결제 대기</button>';
  if (item.status === "server_ready") {
    const label = String(item.method || "") === "bank_transfer"
      ? "입금 확인"
      : isStaleReadyPayment(item) ? "상태 확인" : "결제 확인";
    return `<button class="small-button" type="button" data-server-ready-payment="${index}" ${context(label)}>${label}</button>${paymentCancelButtonFor(index, "대기취소")}`;
  }
  if (item.status === "paid") return `<button class="small-button" type="button" data-paid-payment="${index}" ${context("결제 완료 상세")}>완료됨</button>${paymentFullCancelButtonFor(item, index)}${paymentRefundButtonFor(item, index)}`;
  if (item.status === "refund_processing") return `<button class="small-button" type="button" disabled>환불처리중</button>`;
  if (item.status === "cancel_reconcile") return paymentCancelButtonFor(index, "취소 상태 맞추기");
  if (item.status === "refund_reconcile") return `<button class="small-button danger-action" type="button" data-refund-payment="${index}" ${context("환불 동기화 확인")}>동기화 확인</button>`;
  if (item.status === "cancelled") return `<button class="small-button" type="button" disabled>취소완료</button>`;
  if (item.status === "refunded") return `<button class="small-button" type="button" disabled>환불완료</button>`;
  return "";
}

function chargeStatusForPayment(item = {}) {
  if (item.status === "refund_processing") return { label: "환불 처리중", tone: "warn", detail: "PortOne 취소와 내부 회원권 반영이 진행 중입니다." };
  if (item.status === "refund_reconcile") return { label: "동기화 필요", tone: "danger", detail: "PG 취소 결과와 내부 결제·회원권 상태를 다시 맞춰야 합니다." };
  if (item.status === "paid" && item.oneDayBookingId) return { label: "원데이 예약완료", tone: "good", detail: "결제 확인 후 선택한 코치와 시간으로 한 번만 예약됐습니다." };
  if (item.status === "paid" && item.ticketId) return { label: "회원권 충전완료", tone: "good", detail: "결제검증 후 연결 회원권이 활성화됩니다." };
  if (item.status === "paid" && isHistoricalImportedPayment(item)) return { label: "이관 결제 기록", tone: "neutral", detail: "기존 장부에서 보존한 결제 증빙이며 현재 회원권 자동 연결 대상이 아닙니다." };
  if (item.status === "paid") return { label: "회원권 연결 확인", tone: "warn", detail: "결제는 확인됐지만 연결된 회원권 ID가 없습니다." };
  if (isStaleReadyPayment(item)) return { label: "오래된 결제 대기", tone: "warn", detail: "결제창 생성 후 1시간 이상 완료 확인이 없습니다. PortOne 상태 확인 전에는 취소하거나 회원권을 변경하지 않습니다." };
  if (item.status === "server_ready") return { label: "결제 전 대기", tone: "neutral", detail: "회원이 Toss 결제를 완료하면 서버검증 후 자동 충전됩니다." };
  if (item.status === "unverified") return { label: "서버검증 대기", tone: "warn", detail: "결제창 완료 후 서버 검증이 필요합니다." };
  if (item.status === "cancelled") return { label: "취소/환불완료", tone: "neutral", detail: "결제가 취소됐고 연결 회원권은 충전되지 않거나 환불 처리됩니다." };
  if (item.status === "refunded") return { label: "환불완료", tone: "neutral", detail: "환불 완료 항목은 현재 이용권으로 보지 않습니다." };
  if (item.status === "failed") return { label: "충전 중단", tone: "danger", detail: "결제 실패 항목은 회원권을 충전하지 않습니다." };
  return { label: "확인 필요", tone: "warn", detail: "관리자 확인 후 회원권 상태를 맞춰야 합니다." };
}

function newRefundIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `refund:${value}`;
}

function newPaymentCancelIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cancel:${value}`;
}

function buildAdminRecordContext() {
  const ticketCoachByMember = new Map();
  [...tickets, ...expiredTickets].forEach((ticket) => {
    String(ticket.member || "").split("&").map((name) => name.trim()).filter(Boolean).forEach((name) => {
      if (!ticketCoachByMember.has(name) && ticket.coachId) ticketCoachByMember.set(name, ticket.coachId);
    });
  });
  const memberCoachByName = new Map(members.map((member) => [member.name, member.coachId || ""]));
  const userNameById = new Map((adminLiveDataState.users || []).map((user) => [String(user.id), user.name]));
  const mediaCountByJournalId = new Map();
  (adminLiveDataState.mediaFiles || []).forEach((media) => {
    const key = String(media.journal_entry_id || "");
    if (!key) return;
    mediaCountByJournalId.set(key, (mediaCountByJournalId.get(key) || 0) + 1);
  });
  const lessonRecordByLessonId = new Map(
    (adminLiveDataState.lessonRecords || [])
      .filter((record) => record.lesson_id)
      .map((record) => [String(record.lesson_id), record]),
  );
  const lessonById = new Map();
  lessons.forEach((lesson) => {
    if (lesson.id) lessonById.set(String(lesson.id), lesson);
    if (lesson.serverLessonId) lessonById.set(String(lesson.serverLessonId), lesson);
  });
  const curriculumById = new Map(
    (adminLiveDataState.curriculumRefs || [])
      .filter((curriculum) => curriculum.id)
      .map((curriculum) => [String(curriculum.id), curriculum]),
  );
  const participantRecordsByLessonId = new Map();
  (adminLiveDataState.participantRecords || []).forEach((record) => {
    const lessonId = String(record.lesson_id || "");
    if (!lessonId) return;
    const rows = participantRecordsByLessonId.get(lessonId) || [];
    rows.push(record);
    participantRecordsByLessonId.set(lessonId, rows);
  });
  return {
    ticketCoachByMember,
    memberCoachByName,
    userNameById,
    mediaCountByJournalId,
    lessonRecordByLessonId,
    lessonById,
    curriculumById,
    participantRecordsByLessonId,
  };
}

function pendingLessonRecords() {
  const completedLessonIds = new Set((adminLiveDataState.lessonRecords || []).map((record) => record.lesson_id));
  const participantRecordLessonIds = new Set(
    (adminLiveDataState.participantRecords || []).map((record) => String(record.lesson_id || "")).filter(Boolean),
  );
  const now = Date.now();
  const ownRoleIds = currentOperationsCoachRoleIds();
  return lessons
    .filter((lesson) => {
      const endedAt = lessonEndTimestamp(lesson);
      return (
        lesson.serverLessonId
        && !lesson.oneDayBooking
        && lesson.serverStatus === "scheduled"
        && endedAt > 0
        && endedAt <= now
        && !completedLessonIds.has(lesson.serverLessonId)
        && !participantRecordLessonIds.has(String(lesson.serverLessonId))
        && (operationsRole() === "admin" || ownRoleIds.has(lesson.coachRoleId))
      );
    })
    .map(pendingLessonRecord);
}

function urgentOperationsRecords() {
  const paymentRecords = billings
    .filter((item) => item.status === "paid" && !item.ticketId && !isHistoricalImportedPayment(item))
    .map((item) => ({
      id: `urgent-payment-${item.serverPaymentId || item.providerPaymentId || item.member}`,
      group: "pending",
      source: "결제 오류",
      member: item.member || "회원 확인 필요",
      title: `${item.item || "회원권 결제"} 연결 누락`,
      detail: `${money.format(Number(item.amount) || 0)}원 결제 후 회원권이 발급되지 않았습니다.`,
      subDetail: "결제 확인 후 회원권 연결이 필요합니다.",
      statusLabel: "긴급",
      actionLabel: "결제 확인",
      actionView: "billing",
      priority: "urgent",
      urgentReason: "결제 완료와 회원권 데이터가 일치하지 않습니다.",
      sortAt: item.verifiedAt || item.paidAt || item.requestedAt || "",
    }));
  const makeupRecords = makeupRequests
    .filter((item) => ["coach_required", "requested", "pending"].includes(item.status))
    .map((item) => ({
      id: `urgent-makeup-${item.id}`,
      group: "pending",
      source: "긴급 보강·변경",
      member: item.member || "회원 확인 필요",
      title: `${item.original || item.absence || "기존 수업"} 변경 요청`,
      detail: `${item.requested || item.makeup || "변경 시간 확인 필요"} · ${item.reason || "사유 미입력"}`,
      subDetail: item.policy || item.statusLabel || "승인 여부 확인 필요",
      statusLabel: "긴급",
      actionLabel: "시간표 확인",
      actionView: "schedule",
      priority: "urgent",
      urgentReason: item.policy === "24시간 이내" || item.status === "coach_required"
        ? "24시간 이내 수업에 영향을 주는 승인 요청입니다."
        : "접수된 보강·변경 요청을 확인해야 합니다.",
      sortAt: item.createdAt || item.requestedAt || item.requested || "",
    }));
  return paymentRecords.concat(makeupRecords);
}

function ticketReviewState(ticket) {
  return window.TennisNoteTicketState?.derive(ticket) || ticket?.status || "unknown";
}

function ticketReviewMember(userId) {
  const normalizedUserId = String(userId || "");
  if (!normalizedUserId) return null;
  return operationBranchMembers().find((member) => (
    memberServerUserIds(member).some((memberUserId) => String(memberUserId) === normalizedUserId)
  )) || null;
}

function ticketIntegrityReviewRecords() {
  if (operationsRole() !== "admin" || !state.liveScheduleLoaded) return [];
  const relevantStates = new Set(["current", "upcoming", "paused", "pending_payment"]);
  const linkContext = ticketReviewLinkContext();
  const records = [];

  operationBranchMembers().forEach((member) => {
    const ticketsByFingerprint = new Map();
    memberManagementTickets(member)
      .filter((ticket) => relevantStates.has(ticketReviewState(ticket)))
      .forEach((ticket) => {
        const fingerprint = memberTicketDuplicateFingerprint(ticket);
        if (!fingerprint) return;
        const grouped = ticketsByFingerprint.get(fingerprint) || [];
        grouped.push(ticket);
        ticketsByFingerprint.set(fingerprint, grouped);
      });
    [...ticketsByFingerprint.values()].forEach((grouped, index) => {
      if (grouped.length < 2) return;
      const ticketIds = grouped.map((ticket) => String(ticket.serverTicketId || "")).filter(Boolean);
      if (isExpectedPersonalGroupTicketSet(ticketIds, linkContext)) return;
      const ticket = grouped[0];
      const period = [ticket.actualLessonStart || ticket.purchased, ticket.expires].filter(Boolean).join("~");
      records.push({
        id: `ticket-overlap-${member.id}-${index}`,
        group: "issue",
        source: "회원권 점검",
        member: member.name || "회원 확인 필요",
        title: "회원권 중복 가능",
        detail: `${getTicketDisplayProduct(ticket) || ticket.product || "회원권"} · ${getCoachName(ticket.coachId)}`,
        subDetail: `${period || "기간 확인 필요"} · 자동 삭제하지 않았습니다. 두 회원권을 비교해 주세요.`,
        statusLabel: "확인 필요",
        actionLabel: "회원권 확인",
        memberId: member.id,
        ticketId: ticket.serverTicketId || "",
        priority: "urgent",
        urgentReason: "상품·코치·수업 유형·기간·참여자가 같은 회원권이 둘 이상입니다.",
        sortAt: ticket.serverUpdatedAt || ticket.expires || "",
      });
    });
  });

  linkContext.byAccount.forEach((account, accountId) => {
    if (account.userIds.size >= 2 && account.ticketIds.size >= 1) return;
    const accountRow = (adminLiveDataState.groupAccounts || []).find((item) => String(item.id || "") === accountId);
    const firstUserId = [...account.userIds][0] || "";
    const member = ticketReviewMember(firstUserId);
    const firstTicketId = [...account.ticketIds][0] || "";
    const ticket = (adminLiveDataState.tickets || []).find((item) => String(item.serverTicketId || item.id || "") === firstTicketId);
    records.push({
      id: `group-account-incomplete-${accountId}`,
      group: "issue",
      source: "1:2 연결 점검",
      member: member?.name || accountRow?.display_name || "1:2 회원 확인 필요",
      title: "파트너 연결 미완성",
      detail: `참여 회원 ${account.userIds.size}명 · 연결 회원권 ${account.ticketIds.size}개`,
      subDetail: "파트너 또는 회원권 연결을 확인해야 1:2 차감이 안전하게 처리됩니다.",
      statusLabel: "확인 필요",
      actionLabel: member ? "회원권 확인" : "운영 설정 확인",
      memberId: member?.id || null,
      ticketId: ticket?.serverTicketId || firstTicketId,
      actionView: member ? "" : "settings",
      priority: "urgent",
      urgentReason: "1:2 계정의 회원 또는 회원권 연결 수가 부족합니다.",
      sortAt: ticket?.serverUpdatedAt || "",
    });
  });

  const linkedTicketIds = new Set(linkContext.accountIdsByTicket.keys());
  (adminLiveDataState.tickets || [])
    .filter((ticket) => Number(ticket.groupSize || 1) === 2)
    .filter((ticket) => relevantStates.has(ticketReviewState(ticket)))
    .filter((ticket) => !linkedTicketIds.has(String(ticket.serverTicketId || ticket.id || "")))
    .forEach((ticket) => {
      const member = ticketReviewMember(ticket.serverUserId);
      records.push({
        id: `group-ticket-unlinked-${ticket.serverTicketId || ticket.id}`,
        group: "issue",
        source: "1:2 연결 점검",
        member: member?.name || ticket.member || "회원 확인 필요",
        title: "1:2 회원권 연결 없음",
        detail: `${getTicketDisplayProduct(ticket) || ticket.product || "1:2 회원권"} · ${getCoachName(ticket.coachId)}`,
        subDetail: "회원권은 유지하고 파트너 계정 연결만 확인해 주세요.",
        statusLabel: "확인 필요",
        actionLabel: member ? "회원권 확인" : "회원관리 확인",
        memberId: member?.id || null,
        ticketId: ticket.serverTicketId || "",
        actionView: member ? "" : "members",
        priority: "urgent",
        urgentReason: "사용 중인 1:2 회원권이 파트너 계정과 연결되지 않았습니다.",
        sortAt: ticket.serverUpdatedAt || ticket.expires || "",
      });
    });

  return records;
}

function adminRecordGroups(allLiveData = adminLiveDataState) {
  const shared = operationalSharedData();
  const context = buildAdminRecordContext();
  const participantRecords = (allLiveData.participantRecords || []).map((record) => (
    participantLessonRecord(record, context)
  ));
  const participantRecordLessonIds = new Set(
    (allLiveData.participantRecords || []).map((record) => String(record.lesson_id || "")).filter(Boolean),
  );
  const records = [
    ...urgentOperationsRecords(),
    ...pendingLessonRecords(),
    ...lessonNotes
      .filter((note) => !participantRecordLessonIds.has(String(note.serverLessonId || "")))
      .map(legacyNoteRecord),
    ...participantRecords,
    ...shared.lessonLogs.map(lessonLogRecord),
    ...shared.feedbackRequests.map(feedbackRecord),
    ...(allLiveData.journalEntries || []).map((entry) => memberJournalRecord(entry, context)),
    ...ticketIntegrityReviewRecords(),
  ];
  const normalizedRecords = operationBranchRecords(records).map((record) => withRecordCoach(
    {
      ...record,
      pendingType: pendingRecordType(record),
    },
    record,
    context,
  ));
  const roleFilteredRecords = operationsRole() === "coach"
    ? normalizedRecords.filter((record) => (
      record.pendingType !== "payment"
      && recordBelongsToCurrentCoach(record)
    ))
    : normalizedRecords;
  return {
    pending: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "pending")),
    feedback: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "feedback")),
    done: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "done")),
    issue: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "issue")),
  };
}

function selectedLessonRecordOutcome() {
  return document.querySelector('input[name="lessonRecordOutcome"]:checked')?.value || "completed_deduct";
}

function adminCurriculumChoices() {
  const refs = (adminLiveDataState.curriculumRefs || []).filter((item) => item.status === "active");
  const catalogSteps = window.TennisNoteCurriculumCatalog?.steps || [];
  const choices = catalogSteps.map((step) => {
    const ref = refs.find((item) => item.skill_label === step.id || item.title === step.title);
    return {
      value: ref?.id || `catalog:${step.id}`,
      label: `${step.trackTitle || step.category || step.level || "커리큘럼"} · ${step.title}`,
      notionUrl: step.notionUrl || ref?.notion_url || "",
      step,
    };
  });
  refs.forEach((ref) => {
    if (choices.some((item) => item.value === ref.id || item.step?.id === ref.skill_label)) return;
    choices.push({
      value: ref.id,
      label: `${ref.level_label || "커리큘럼"} · ${ref.title}`,
      notionUrl: ref.notion_url || "",
      step: null,
    });
  });
  return choices;
}

function rankedAdminCurriculumChoices(choices, query) {
  if (!query) return choices;
  const search = window.TennisNoteCurriculumSearch;
  if (!search?.search) {
    const normalizedQuery = String(query).trim().toLocaleLowerCase("ko-KR");
    return choices.filter((item) => `${item.value} ${item.label}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  }
  const byValue = new Map(choices.map((choice) => [choice.value, choice]));
  return search.search(choices.map(searchableAdminCurriculumChoice), query, { limit: 24 })
    .map((result) => byValue.get(result.step.__choiceValue))
    .filter(Boolean);
}

function filterLessonRecordCurriculumOptions() {
  const select = $("#lessonRecordCurriculum");
  if (!select) return;
  const selectedValue = select.value;
  const query = String($("#lessonRecordCurriculumSearch")?.value || "").trim();
  const choices = adminCurriculumChoices();
  const filtered = rankedAdminCurriculumChoices(choices, query);
  const selectedChoice = choices.find((item) => item.value === selectedValue);
  const visibleChoices = selectedChoice && !filtered.some((item) => item.value === selectedChoice.value)
    ? [selectedChoice, ...filtered]
    : filtered;
  select.innerHTML = `<option value="">${query && !filtered.length ? "검색 결과 없음" : "다음 커리큘럼 선택"}</option>${visibleChoices.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}`;
  if (selectedChoice) select.value = selectedValue;
  renderLessonRecordCurriculumSuggestions(filtered, query);
  updateLessonRecordCurriculumLink();
}

function downloadSettlementCsv() {
  const rows = [["정산일", "총매출", "수수료", "최종정산액"]].concat(settlements.map((item) => [item.date, item.sales, item.fee, item.net]));
  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tennis-note-settlement-demo.csv";
  link.click();
  URL.revokeObjectURL(url);
  billingLogs.unshift("코치 정산 CSV 다운로드 생성");
  renderAll();
  showToast("엑셀 다운로드 준비 완료");
}

function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadRowsAsCsv(filename, rows) {
  downloadTextFile(filename, `\ufeff${rowsToCsv(rows)}`, "text/csv;charset=utf-8");
}

let xlsxLibraryPromise = null;

async function downloadWorkbook(filename, sheets) {
  try {
    await ensureXlsxLibrary();
  } catch {
    const firstSheet = sheets[0];
    downloadRowsAsCsv(filename.replace(/\.xlsx$/i, ".csv"), firstSheet.rows);
    showToast("엑셀 모듈을 불러오지 못해 CSV로 저장했습니다");
    return;
  }
  const workbook = window.XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = window.XLSX.utils.aoa_to_sheet(sheet.rows);
    if (Array.isArray(sheet.columns)) worksheet["!cols"] = sheet.columns;
    if (sheet.autoFilter) worksheet["!autofilter"] = { ref: sheet.autoFilter };
    window.XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  window.XLSX.writeFile(workbook, filename);
}

async function downloadImportTemplate() {
  await downloadWorkbook("tennis-note-monthly-import-simple-v2.1.xlsx", [
    {
      name: importMemberSheetName,
      rows: [importMemberColumns],
      columns: importMemberColumns.map((_, index) => ({
        wch: index < importVisibleMemberColumns.length ? ([7, 15].includes(index) ? 30 : 14) : 12,
        hidden: index >= importVisibleMemberColumns.length,
      })),
      autoFilter: "A1:Y1",
    },
    { name: "작성안내", rows: importGuideRows(), columns: [{ wch: 14 }, { wch: 72 }] },
    { name: "선택값", rows: importCodeRows(), columns: [{ wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 40 }] },
  ]);
  billingLogs.unshift(`월별 데이터 이관 양식 ${importWorkbookVersion} 다운로드`);
  renderAll();
  showToast("엑셀 양식 다운로드 완료");
}

function adminWeeklyScheduleExportRows() {
  const week = activeAdminWeek();
  const rows = [
    ["주차", "기간", "날짜", "요일", "시간", "종료", "회원명", "회차", "수업구분", "상태", "담당코치", "실수업코치", "수업분", "메모"],
  ];
  const weekLessons = lessons
    .filter((lesson) => lesson.day && lesson.time && !isLessonCancelled(lesson) && lessonMatchesActiveScheduleWeek(lesson, lesson.day))
    .sort((left, right) => {
      const dayDiff = scheduleDays.indexOf(left.day) - scheduleDays.indexOf(right.day);
      if (dayDiff) return dayDiff;
      const timeDiff = timeToMinutes(left.time) - timeToMinutes(right.time);
      if (timeDiff) return timeDiff;
      return String(lessonScheduleCoachLabel(left)).localeCompare(String(lessonScheduleCoachLabel(right)), "ko");
    });
  weekLessons.forEach((lesson) => {
    const start = timeToMinutes(lesson.time);
    const duration = Number(lesson.durationMinutes) || 20;
    const scheduleCoachId = lessonScheduleCoachId(lesson);
    rows.push([
      week.label || "",
      week.range || "",
      lesson.lessonDate || adminWeekDateForDay(lesson.day),
      lesson.day,
      lesson.time,
      minutesToTime(start + duration),
      getLessonMembersLabel(lesson),
      getLessonRoundLabel(lesson) || "",
      lesson.oneDayBooking ? "원데이" : isMakeupLesson(lesson) ? "보강" : lesson.type || "정규",
      getLessonStatusLabel(lesson),
      scheduleCoachDisplayName(getCoachName(scheduleCoachId)),
      scheduleCoachDisplayName(getCoachName(lesson.coachId || scheduleCoachId)),
      duration,
      scheduleLessonExceptionLabel(lesson) || lesson.changeNote || "",
    ]);
  });
  if (rows.length === 1) {
    rows.push([week.label || "", week.range || "", "", "", "", "", "현재 주차에 내보낼 수업이 없습니다.", "", "", "", "", "", "", ""]);
  }
  return rows;
}

function monthlyImportProductDefaults(ticketName = "") {
  const normalizedName = normalizeImportHeader(ticketName);
  const product = membershipProductsForActiveOperationProfile().find((item) => (
    normalizeImportHeader(item.title || item.name || "") === normalizedName
  ));
  const scheduleScope = String(product?.scheduleScope || product?.schedule_scope || "").toLowerCase();
  const groupSize = Number(product?.groupSize || product?.group_size || 0);
  const productText = `${ticketName} ${product?.productKind || product?.product_kind || ""}`;
  return {
    lessonWay: scheduleScope === "weekend" || /주말/.test(productText) ? "주말" : "평일",
    lessonType: groupSize === 2 || /(2대1|2:1|1:2|그룹)/.test(productText) ? "1:2" : "1:1",
  };
}

function completeMonthlyImportWorkbook(workbookPayload) {
  const rawRows = workbookPayload?.members?.rows || [];
  if (!rawRows.length) return workbookPayload;
  const guide = importGuideMetadata(workbookPayload?.guide?.rows || []);
  const branchName = String(guide[normalizeImportHeader("지점명")] || activeOperationBranchName() || "").trim();
  const inputHeaders = rawRows[0].map((header) => String(header ?? "").trim());
  const headers = [...inputHeaders];
  importMemberColumns.forEach((column) => {
    if (!headers.some((header) => normalizeImportHeader(header) === normalizeImportHeader(column))) headers.push(column);
  });
  const headerIndex = new Map(headers.map((header, index) => [normalizeImportHeader(header), index]));
  const sourceIndex = new Map(inputHeaders.map((header, index) => [normalizeImportHeader(header), index]));
  const rows = rawRows.slice(1).map((row) => {
    const next = headers.map((header) => {
      const source = sourceIndex.get(normalizeImportHeader(header));
      return source === undefined ? "" : row[source] ?? "";
    });
    const get = (column) => String(next[headerIndex.get(normalizeImportHeader(column))] ?? "").trim();
    const setDefault = (column, value) => {
      const index = headerIndex.get(normalizeImportHeader(column));
      if (index !== undefined && !String(next[index] ?? "").trim()) next[index] = value;
    };
    const phone = get("연락처").replace(/[^0-9]/g, "");
    const partnerPhone = get("파트너연락처").replace(/[^0-9]/g, "");
    const memberStatus = importMemberStatus(get("회원상태"));
    const total = normalizedImportNumber(get("총횟수"));
    const used = normalizedImportNumber(get("소진횟수"));
    const amount = normalizedImportNumber(get("결제금액")) || 0;
    const productDefaults = monthlyImportProductDefaults(get("회원권명"));
    setDefault("원본번호", phone);
    setDefault("지점명", branchName);
    setDefault("적용방식", "현재 회원권 갱신");
    setDefault("레슨방식", productDefaults.lessonWay);
    setDefault("레슨종류", productDefaults.lessonType);
    setDefault("파트너원본번호", partnerPhone);
    if (total !== null && used !== null) setDefault("잔여횟수", Math.max(0, total - used));
    setDefault("결제상태", amount > 0
      ? "결제완료"
      : ["active", "paused"].includes(memberStatus) ? "결제대기" : "해당없음");
    return next;
  });
  return {
    ...workbookPayload,
    members: { ...workbookPayload.members, rows: [headers, ...rows] },
  };
}

function validateMonthlyImportWorkbook(workbookPayload, sourceName = "") {
  const memberRows = workbookPayload?.members?.rows || [];
  const scheduleRows = workbookPayload?.schedules?.rows || [];
  const reviewSheetRows = importRowsAsObjects(workbookPayload?.reviews?.rows || []);
  const paymentReviewSheetRows = importRowsAsObjects(workbookPayload?.paymentReviews?.rows || []);
  const guide = importGuideMetadata(workbookPayload?.guide?.rows || []);
  const importMonth = String(guide[normalizeImportHeader("이관월")] || "").trim();
  const finalizeRoster = normalizeImportHeader(guide[normalizeImportHeader("명단적용")] || "") === normalizeImportHeader("이 명단 기준 전환");
  const workbookBranchName = String(guide[normalizeImportHeader("지점명")] || "").trim();
  const currentBranchName = activeOperationBranchName();
  const importBranchId = activeOperationBranchId() || defaultOperationBranch()?.id || "";
  const memberHeaders = (memberRows[0] || []).map((header) => normalizeImportHeader(header));
  const scheduleHeaders = (scheduleRows[0] || []).map((header) => normalizeImportHeader(header));
  const workbookSchemaVersion = String(workbookPayload?.schemaVersion || "2.0");
  const expectedMemberColumns = workbookSchemaVersion === "2.0"
    ? importMemberColumns.filter((column) => column !== "결제상태")
    : importMemberColumns;
  const missingMemberHeaders = expectedMemberColumns
    .map((column) => normalizeImportHeader(column))
    .filter((column) => !memberHeaders.includes(column));
  const missingScheduleHeaders = importScheduleColumns
    .map((column) => normalizeImportHeader(column))
    .filter((column) => scheduleRows.length && !scheduleHeaders.includes(column));
  const memberObjects = importRowsAsObjects(memberRows);
  const scheduleObjects = importRowsAsObjects(scheduleRows);
  const issues = [
    ...missingMemberHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `회원DB 필수 컬럼 누락: ${column}` })),
    ...missingScheduleHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `정규시간표 필수 컬럼 누락: ${column}` })),
  ];
  const sourceNumbers = new Set();
  const phoneNumbers = new Set();
  const scheduleSourceNumbers = new Set();
  const scheduleSlots = new Set();
  let errorRows = 0;
  let reviewRows = 0;
  if (!importBranchId) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "현재 운영 지점을 먼저 선택하세요." });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(importMonth)) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "작성안내의 이관월을 YYYY-MM 형식으로 입력하세요." });
  }
  if (!workbookBranchName) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "작성안내의 지점명을 입력하세요." });
  } else if (currentBranchName && normalizeImportHeader(workbookBranchName) !== normalizeImportHeader(currentBranchName)) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: `양식 지점(${workbookBranchName})과 현재 운영 지점(${currentBranchName})이 다릅니다.` });
  }
  if (reviewSheetRows.length) {
    reviewRows += reviewSheetRows.length;
    issues.push({
      rowNumber: importReviewSheetName,
      level: "review",
      message: `검토대기 ${reviewSheetRows.length}행을 정리해 회원DB로 옮기거나 제외 근거를 남겨야 합니다.`,
    });
  }
  if (paymentReviewSheetRows.length) {
    reviewRows += paymentReviewSheetRows.length;
    issues.push({
      rowNumber: importPaymentReviewSheetName,
      level: "review",
      message: `결제검토 ${paymentReviewSheetRows.length}행을 정리해야 실제 반영할 수 있습니다.`,
    });
  }
  const liveImportCoachNames = (adminLiveDataState.coachRoles || [])
    .filter((role) => (
      role?.id
      && role.status === "approved"
      && !["ended", "archived"].includes(role.employment_status)
      && !role.archived_at
      && (!importBranchId || String(role.branch_id || "") === String(importBranchId))
    ))
    .map((role) => normalizeImportHeader(role.display_name || role.name || role.coach_name || ""))
    .filter(Boolean);

  memberObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    const sourceNumber = importCell(values, "원본번호");
    const phone = importCell(values, "연락처").replace(/[^0-9]/g, "");
    const status = importMemberStatus(importCell(values, "회원상태"));
    const rowBranchName = importCell(values, "지점명");
    requiredImportMemberColumns.forEach((column) => {
      if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
    });
    if (sourceNumber && sourceNumbers.has(sourceNumber)) rowIssues.push("원본번호 중복");
    if (sourceNumber) sourceNumbers.add(sourceNumber);
    if (phone && phoneNumbers.has(phone)) rowIssues.push("연락처 중복");
    if (phone) phoneNumbers.add(phone);
    if (phone.length < 10 || phone.length > 11) rowIssues.push("연락처 형식 오류");
    const birthYear = normalizedImportNumber(importCell(values, "출생연도"));
    if (!birthYear || birthYear < 1900 || birthYear > 2100) rowIssues.push("출생연도 오류");
    if (!status) rowIssues.push("회원상태 선택 오류");
    if (
      rowBranchName
      && workbookBranchName
      && normalizeImportHeader(rowBranchName) !== normalizeImportHeader(workbookBranchName)
    ) {
      rowIssues.push("작성안내 지점명과 회원 행 지점명이 다름");
    }
    if (["active", "paused"].includes(status)) {
      requiredActiveImportMemberColumns.forEach((column) => {
        if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
      });
    }
    ["총횟수", "소진횟수", "잔여횟수", "결제금액"].forEach((column) => {
      const value = importCell(values, column);
      if (value && normalizedImportNumber(value) === null) rowIssues.push(`${column} 숫자 오류`);
    });
    const total = normalizedImportNumber(importCell(values, "총횟수"));
    const used = normalizedImportNumber(importCell(values, "소진횟수"));
    const remaining = normalizedImportNumber(importCell(values, "잔여횟수"));
    if ([total, used, remaining].every((value) => value !== null) && total - used !== remaining) {
      rowIssues.push("총횟수-소진횟수와 잔여횟수 불일치");
    }
    const amount = normalizedImportNumber(importCell(values, "결제금액")) || 0;
    const paymentStatus = importPaymentStatus(importCell(values, "결제상태"));
    if (workbookPayload.schemaVersion === "2.1" && !paymentStatus) rowIssues.push("결제상태 선택 오류");
    if (paymentStatus === "paid" && (amount <= 0 || !importCell(values, "결제일") || !importCell(values, "결제수단"))) {
      rowIssues.push("결제완료는 결제일·결제수단·결제금액 필요");
    }
    if (["pending", "not_applicable"].includes(paymentStatus) && amount > 0) rowIssues.push("결제대기·해당없음은 결제금액을 비워야 함");
    if (workbookPayload.schemaVersion === "2.0" && amount > 0 && (!importCell(values, "결제일") || !importCell(values, "결제수단"))) {
      rowIssues.push("결제금액이 있으면 결제일·결제수단 필요");
    }
    const lessonType = importCell(values, "레슨종류");
    const partnerSourceNumber = importCell(values, "파트너원본번호");
    const partnerPhone = importCell(values, "파트너연락처").replace(/[^0-9]/g, "");
    if (["active", "paused"].includes(status) && ["1:2", "2대1"].includes(lessonType) && (!partnerSourceNumber || partnerPhone.length < 10)) {
      rowIssues.push("1:2 파트너 정보 필요");
    }
    const coachName = importCell(values, "담당코치");
    if (
      coachName
      && liveImportCoachNames.length
      && !liveImportCoachNames.some((name) => (
        name.includes(normalizeImportHeader(coachName))
        || normalizeImportHeader(coachName).includes(name)
      ))
    ) {
      rowIssues.push("등록되지 않은 코치명 확인 필요");
    }
    if (rowIssues.length) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "error", message }));
    }
  });

  scheduleObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    ["시간표원본번호", "회원원본번호", "수업일", "시작시간", "수업분", "상태"].forEach((column) => {
      if (!importCell(values, column)) rowIssues.push(`${column} 없음`);
    });
    const memberSourceNumber = importCell(values, "회원원본번호");
    const scheduleSourceNumber = importCell(values, "시간표원본번호");
    const lessonDate = importCell(values, "수업일");
    const startTime = importCell(values, "시작시간");
    const scheduleStatus = importCell(values, "상태");
    if (memberSourceNumber && !sourceNumbers.has(memberSourceNumber)) rowIssues.push("회원DB에 없는 회원원본번호");
    if (scheduleSourceNumber && scheduleSourceNumbers.has(scheduleSourceNumber)) rowIssues.push("시간표원본번호 중복");
    if (scheduleSourceNumber) scheduleSourceNumbers.add(scheduleSourceNumber);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) rowIssues.push("수업일 형식 오류");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) rowIssues.push("시작시간 형식 오류");
    if (![20, 30, 40, 60].includes(normalizedImportNumber(importCell(values, "수업분")))) rowIssues.push("수업분은 20·30·40·60만 가능");
    if (scheduleStatus !== "예정") rowIssues.push("신규 시간표 상태는 예정만 가능");
    const scheduleSlot = `${memberSourceNumber}::${lessonDate}::${startTime}`;
    if (memberSourceNumber && lessonDate && startTime && scheduleSlots.has(scheduleSlot)) rowIssues.push("같은 회원의 같은 시간표가 중복됨");
    if (memberSourceNumber && lessonDate && startTime) scheduleSlots.add(scheduleSlot);
    if (rowIssues.length) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber: `${importScheduleSheetName} ${rowNumber}`, level: "error", message }));
    }
  });

  if (!memberObjects.length) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "회원DB에 입력된 회원이 없습니다." });
  }
  if (!scheduleObjects.length) {
    issues.push({ rowNumber: "-", level: "info", message: "정규시간표가 비어 있어 기존 서버 시간표를 그대로 보존합니다." });
  }

  const sourceMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(importMonth) ? importMonth : "invalid-month";
  return {
    sourceName,
    schemaVersion: workbookSchemaVersion,
    columns: memberHeaders,
    rowCount: memberObjects.length + scheduleObjects.length,
    memberRowCount: memberObjects.length,
    scheduleRowCount: scheduleObjects.length,
    readyRows: Math.max(0, memberObjects.length + scheduleObjects.length - errorRows),
    reviewRows,
    errorRows: errorRows + (missingMemberHeaders.length || missingScheduleHeaders.length ? 1 : 0),
    issues,
    workbookPayload: {
      schemaVersion: workbookSchemaVersion,
      sourceName,
      targetBranchId: importBranchId,
      importMonth: sourceMonth,
      finalizeRoster,
      effectiveOn: `${sourceMonth}-01`,
      branchName: workbookBranchName,
      sourceSheetId: `tennisnote-monthly-workbook:${importBranchId || "unassigned"}:${sourceMonth}`,
      sourceTabName: sourceMonth,
      members: { columns: memberHeaders, rows: memberRows.slice(1) },
      schedules: { columns: scheduleHeaders, rows: scheduleRows.slice(1) },
      reviews: {
        columns: (workbookPayload?.reviews?.rows?.[0] || []).map((header) => normalizeImportHeader(header)),
        rows: workbookPayload?.reviews?.rows?.slice(1) || [],
      },
      paymentReviews: {
        columns: (workbookPayload?.paymentReviews?.rows?.[0] || []).map((header) => normalizeImportHeader(header)),
        rows: workbookPayload?.paymentReviews?.rows?.slice(1) || [],
      },
    },
  };
}

function validateImportRows(rawRows, sourceName = "") {
  const headerRow = rawRows[0] || [];
  const headers = headerRow.map((header) => normalizeImportHeader(header));
  const requiredHeaders = importTemplateColumns.map((column) => normalizeImportHeader(column));
  const missingHeaders = requiredHeaders.filter((column) => !headers.includes(column));
  const rowObjects = rawRows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, index) => ({ rowNumber: index + 2, values: rowObjectFromHeaders(headers, row) }));
  const issues = missingHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `필수 컬럼 누락: ${column}` }));
  let errorRows = 0;
  let reviewRows = 0;

  rowObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    requiredImportColumns.forEach((column) => {
      if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
    });
    numericImportColumns.forEach((column) => {
      const value = importCell(values, normalizeImportHeader(column));
      if (!isNumericImportValue(value)) rowIssues.push(`${column} 숫자 오류`);
    });
    const total = Number(importCell(values, "총횟수").replaceAll(",", ""));
    const used = Number(importCell(values, "사용횟수").replaceAll(",", ""));
    const remaining = Number(importCell(values, "잔여횟수").replaceAll(",", ""));
    if ([total, used, remaining].every(Number.isFinite) && total - used !== remaining) {
      rowIssues.push("총횟수-사용횟수와 잔여횟수 불일치");
    }
    const coachName = importCell(values, "담당코치");
    if (coachName && !coaches.some((coach) => coach.name.includes(coachName) || coachName.includes(coach.name.replace("코치", "").trim()))) {
      rowIssues.push("등록되지 않은 코치명 확인 필요");
    }
    if (rowIssues.some((issue) => issue.includes("없음") || issue.includes("숫자 오류") || issue.includes("불일치"))) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "error", message }));
    } else if (rowIssues.length) {
      reviewRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "review", message }));
    }
  });

  return {
    sourceName,
    columns: headers,
    rowCount: rowObjects.length,
    readyRows: Math.max(0, rowObjects.length - errorRows - reviewRows),
    reviewRows,
    errorRows: errorRows + (missingHeaders.length ? rowObjects.length || 1 : 0),
    issues,
  };
}

async function readWorkbookFile(file) {
  await ensureXlsxLibrary();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = window.XLSX.read(reader.result, { type: "array" });
      const sheets = Object.fromEntries(workbook.SheetNames.map((sheetName) => [
        sheetName,
        window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }),
      ]));
      if (sheets[importMemberSheetName]) {
        const guideVersion = importGuideMetadata(sheets[importGuideSheetName] || [])[normalizeImportHeader("양식 버전")];
        resolve({
          schemaVersion: String(guideVersion || "2.0"),
          guide: { name: importGuideSheetName, rows: sheets[importGuideSheetName] || [] },
          members: { name: importMemberSheetName, rows: sheets[importMemberSheetName] },
          schedules: { name: importScheduleSheetName, rows: sheets[importScheduleSheetName] || [importScheduleColumns] },
          reviews: { name: importReviewSheetName, rows: sheets[importReviewSheetName] || [] },
          paymentReviews: { name: importPaymentReviewSheetName, rows: sheets[importPaymentReviewSheetName] || [] },
        });
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      resolve({ schemaVersion: "1.0", legacyRows: sheets[firstSheetName] || [] });
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function clearDataImportResult() {
  const input = $("#dataImportFile");
  if (input) input.value = "";
  setDataImportState({
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
    schemaVersion: "",
    workbookPayload: null,
    memberRowCount: 0,
    scheduleRowCount: 0,
    serverStatus: "idle",
    serverMessage: "",
    serverPreview: null,
  });
}

const importServerIssueLabels = {
  no_rows: "가져올 행이 없습니다.",
  no_member_rows: "회원DB에 가져올 회원이 없습니다.",
  required_value_missing: "필수값이 비어 있습니다.",
  numeric_value_invalid: "숫자로 입력해야 하는 값이 맞지 않습니다.",
  ticket_balance_mismatch: "총횟수, 사용횟수, 잔여횟수가 맞지 않습니다.",
  time_format_review: "수업 시간 형식 확인이 필요합니다.",
  unknown_coach_name: "등록된 코치명과 맞는지 확인이 필요합니다.",
  possible_duplicate_ticket_row: "같은 회원/코치/회원권 조합이 중복될 수 있습니다.",
  group_partner_required: "2대1 회원권은 동반 회원 이름과 연락처가 필요합니다.",
  group_partner_same_phone: "대표 회원과 동반 회원의 연락처가 같습니다.",
  source_number_duplicate: "원본번호가 중복됐습니다.",
  source_number_missing: "원본번호가 없습니다.",
  source_member_not_found: "시간표의 회원원본번호를 회원DB에서 찾을 수 없습니다.",
  product_not_found: "판매중 회원권 상품과 정확히 일치하지 않습니다.",
  target_branch_required: "현재 운영 지점을 먼저 선택해야 합니다.",
  branch_mismatch: "현재 운영 지점에 속한 코치와 회원권만 사용할 수 있습니다.",
  schedule_status_invalid: "새 시간표의 상태는 예정만 사용할 수 있습니다.",
  schedule_slot_duplicate: "같은 회원의 같은 날짜·시간 수업이 중복됐습니다.",
  schedule_preserved: "시간표 입력이 없어 기존 서버 시간표를 보존합니다.",
  schedule_group_manual_review: "1:2 시간표는 두 회원의 회원권 연결을 확인해야 합니다.",
  review_sheet_not_empty: "검토대기 시트의 행을 정리해야 합니다.",
  payment_review_sheet_not_empty: "결제검토 시트의 행을 정리해야 합니다.",
  import_month_invalid: "작성안내의 이관월을 YYYY-MM 형식으로 입력해야 합니다.",
  workbook_branch_name_required: "작성안내의 지점명을 입력해야 합니다.",
  workbook_branch_mismatch: "작성안내의 지점과 현재 운영 지점이 다릅니다.",
};

const importServerFieldLabels = {
  memberName: "회원명",
  phone: "연락처",
  partnerName: "동반회원명",
  partnerPhone: "동반연락처",
  coachName: "담당코치",
  ticketName: "회원권명",
  totalSessions: "총횟수",
  usedSessions: "사용횟수",
  remainingSessions: "잔여횟수",
  paymentAmount: "결제금액",
  targetBranchId: "운영 지점",
  scheduleSourceNumber: "시간표원본번호",
  memberSourceNumber: "회원원본번호",
  lessonDate: "수업일",
  startTime: "시작시간",
  durationMinutes: "수업분",
  status: "상태",
  regularTime1: "정규시간1",
  regularTime2: "정규시간2",
};

function dataImportServerTone() {
  if (["ready", "committed"].includes(dataImportState.serverStatus)) return "good";
  if (dataImportState.serverStatus === "review") return "warn";
  if (dataImportState.serverStatus === "error") return "danger";
  if (dataImportState.serverStatus === "checking") return "neutral";
  return "";
}

function adminImportAuthTone() {
  if (adminImportAuthState.loading) return "neutral";
  if (adminImportAuthState.profile?.role === "admin") return "good";
  if (adminImportAuthState.user) return "warn";
  return "danger";
}

function adminImportAuthBadgeText() {
  if (adminImportAuthState.loading) return "확인중";
  if (adminImportAuthState.profile?.role === "admin") return "관리자";
  if (adminImportAuthState.user) return "권한 확인";
  return "로그인 필요";
}

function liveTicketScheduleScope(product = {}, ticket = {}, lessons = []) {
  const configuredScope = ["weekday", "weekend", "mixed"].includes(product.schedule_scope) ? product.schedule_scope : "weekday";
  const productCode = String(product.product_code || "");
  if (productCode.startsWith("admin-ticket-")) return configuredScope;

  const productName = String(product.name || "");
  if (productName.includes("주말")) return "weekend";
  if (productName.includes("평일")) return "weekday";

  const existingLesson = lessons instanceof Map
    ? lessons.get(ticket.id)
    : lessons.find((lesson) => (
      lesson.member_ticket_id === ticket.id
      && lesson.status !== "cancelled"
      && lesson.lesson_date
    ));
  if (existingLesson) {
    const lessonDay = new Date(`${existingLesson.lesson_date}T12:00:00`).getDay();
    return [0, 6].includes(lessonDay) ? "weekend" : "weekday";
  }
  return configuredScope;
}

function adminWeekDateForDay(day, allScheduleDays = scheduleDays) {
  const week = activeAdminWeek();
  const dayIndex = allScheduleDays.indexOf(day);
  if (!week.startDate || dayIndex < 0) return "";
  const date = new Date(`${week.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return adminLocalDateKey(date);
}

function adminLessonDateForCandidate(day) {
  const editingLesson = getCurrentEditingLesson();
  if (
    editingLesson?.lessonDate
    && selectedLessonEditScope() === "single"
    && day === editingLesson.day
  ) {
    return editingLesson.lessonDate;
  }
  return adminWeekDateForDay(day);
}

function adminLiveLessonWindow() {
  const targetWeek = state.view === "schedule" ? activeAdminWeek() : adminScheduleWeek(0);
  const today = adminLocalDateKey(new Date());
  const targetStart = targetWeek.startDate || today;
  const targetEnd = targetWeek.endDate || shiftedAdminDateKey(targetStart, 6);
  return {
    from: shiftedAdminDateKey(targetStart, -7),
    to: shiftedAdminDateKey(targetEnd, 7),
  };
}

function activeAdminWeekIsLoaded() {
  return adminWeekIsLoaded(activeAdminWeek());
}

function scheduleAdminInitialLiveSync() {
  if (adminInitialLiveSyncHandle || adminLiveSyncPromise) return;
  const run = async () => {
    adminInitialLiveSyncHandle = 0;
    adminInitialLiveSyncKind = "";
    await syncAdminLiveData(false, { abortIfDirty: true });
  };
  if (typeof window.requestIdleCallback === "function") {
    adminInitialLiveSyncKind = "idle";
    adminInitialLiveSyncHandle = window.requestIdleCallback(run, { timeout: 800 });
    return;
  }
  adminInitialLiveSyncKind = "timer";
  adminInitialLiveSyncHandle = window.setTimeout(run, 120);
}

function hasDataImportPayload() {
  if (supportedImportWorkbookVersions.has(dataImportState.schemaVersion)) {
    return Boolean(dataImportState.workbookPayload?.members?.rows?.length > 1);
  }
  return Array.isArray(dataImportState.rawRows) && dataImportState.rawRows.length > 0;
}

function dataImportRequestBody(mode) {
  const common = {
    mode,
    sourceName: dataImportState.fileName,
    knownCoaches: knownCoachNamesForImport(),
  };
  if (supportedImportWorkbookVersions.has(dataImportState.schemaVersion)) {
    return { ...common, workbook: dataImportState.workbookPayload };
  }
  return { ...common, rows: dataImportState.rawRows };
}

function blockServerPreview(message, serverPreview = null) {
  setDataImportState({
    serverStatus: "error",
    serverMessage: message,
    serverPreview,
  });
  showToast(message);
}

function selectedExportSheets() {
  const includePrivate = $("#dataExportPrivateFields")?.checked || false;
  const dataset = $("#dataExportDataset")?.value || "all";
  const allRows = exportRowsByDataset(includePrivate);
  if (dataset === "all") return Object.values(allRows).map((item) => ({ name: item.label, rows: item.rows }));
  const selected = allRows[dataset] || allRows.members;
  return [{ name: selected.label, rows: selected.rows }];
}

async function downloadDataExport() {
  const format = $("#dataExportFormat")?.value || "xlsx";
  const dataset = $("#dataExportDataset")?.value || "all";
  const sheets = selectedExportSheets();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const payload = Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet.rows]));
    downloadTextFile(`tennis-note-${dataset}-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  } else if (format === "csv") {
    const rows = dataset === "all"
      ? sheets.flatMap((sheet) => [[sheet.name], ...sheet.rows, []])
      : sheets[0].rows;
    downloadRowsAsCsv(`tennis-note-${dataset}-${stamp}.csv`, rows);
  } else {
    await downloadWorkbook(`tennis-note-${dataset}-${stamp}.xlsx`, sheets);
  }
  billingLogs.unshift(`데이터 내보내기 생성: ${dataset} ${format}`);
  renderAll();
  showToast("데이터 내보내기 완료");
}

function downloadSafeBackup() {
  const payload = {
    createdAt: new Date().toISOString(),
    note: "Demo backup without raw private source files.",
    counts: {
      members: members.length,
      tickets: tickets.length,
      lessons: lessons.length,
      payments: billings.length,
      products: membershipProductDrafts.length,
      coaches: coaches.filter((coach) => coach.id !== "coach-machine").length,
    },
    data: Object.fromEntries(Object.entries(exportRowsByDataset(false)).map(([key, value]) => [key, value.rows])),
  };
  downloadTextFile(`tennis-note-safe-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  billingLogs.unshift("안전 백업 JSON 다운로드 생성");
  renderAll();
  showToast("안전 백업 다운로드 완료");
}

function writeCommunityPost() {
  if (!$("#communityFeed")) return;
  const channel = state.communityChannel === "홈" ? "레슨후기" : state.communityChannel;
  communityPosts.unshift({
    channel,
    type: "공지",
    title: `${channel} 새 글 초안`,
    body: "관리자가 데모에서 작성한 게시글입니다. 실제 버전에서는 사진, 공지 팝업, 댓글 기능과 연결합니다.",
    likes: 0,
    comments: 0,
  });
  state.communityChannel = channel;
  $$(".channel-pill[data-community-channel]").forEach((button) => button.classList.toggle("is-active", button.dataset.communityChannel === channel));
  renderCommunity();
  saveSnapshot();
  showToast("커뮤니티 글쓰기 완료");
}

function managementReportVisibleItems(widgetId, items = []) {
  return adminLayoutSettings.reportWidgetFilters?.[widgetId] === "attention"
    ? items.filter((item) => item.needsAttention === true)
    : items;
}

function managementDriveReportStatusInfo() {
  const status = adminDriveReportState.status;
  if (adminDriveReportState.loading || status === "loading") {
    return { label: "Drive 확인 중", detail: "집계 셀을 읽고 있습니다.", tone: "neutral", pillTone: "" };
  }
  if (status === "fresh") {
    return { label: "최신 자료", detail: "읽기 전용 집계 정상", tone: "ready", pillTone: "ready" };
  }
  if (status === "stale") {
    return { label: "갱신 지연", detail: "원본 갱신시각을 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "provisional") {
    return { label: "검증 필요", detail: "미입력·작성 중·수식 오류를 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "not_configured") {
    return { label: "Drive 연결 전", detail: "서버의 읽기 전용 연결값을 설정해야 합니다.", tone: "neutral", pillTone: "" };
  }
  if (status === "unavailable") {
    return { label: "선택 월 자료 없음", detail: "해당 지점·월의 집계 셀 설정을 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "error") {
    return { label: "Drive 읽기 실패", detail: adminDriveReportState.message || "연결과 원본 권한을 확인해 주세요.", tone: "warning", pillTone: "danger" };
  }
  return { label: "Drive 연결 전", detail: "Drive 확인을 누르면 읽기 전용 집계 상태를 확인합니다.", tone: "neutral", pillTone: "" };
}

function managementDriveReportMetric(id) {
  const value = Number(adminDriveReportState.snapshot?.metrics?.[id]);
  return Number.isFinite(value) ? value : null;
}

function managementDriveSourceDetail() {
  const source = adminDriveReportState.snapshot?.source || {};
  const updatedAt = source.updatedAt ? new Date(source.updatedAt) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(updatedAt)
    : "갱신시각 없음";
  const closeLabels = { closed: "마감", review: "검토 중", draft: "작성 중", error: "오류" };
  const closeLabel = closeLabels[source.closeStatus] || "마감상태 없음";
  const issueCount = Number(source.qualityIssueCount) || 0;
  return `${updatedLabel} · ${closeLabel}${issueCount ? ` · 품질 이슈 ${issueCount}건` : ""}`;
}

function managementDriveFinanceRows() {
  const statusInfo = managementDriveReportStatusInfo();
  const totalCost = managementDriveReportMetric("totalCost");
  const operatingProfit = managementDriveReportMetric("operatingProfit");
  const debtBalance = managementDriveReportMetric("debtBalance");
  const startupCost = managementDriveReportMetric("startupCost");
  const hasSnapshot = Boolean(adminDriveReportState.snapshot && ["fresh", "stale", "provisional"].includes(adminDriveReportState.status));
  return [
    {
      label: "Drive 원본 상태",
      value: statusInfo.label,
      detail: hasSnapshot ? managementDriveSourceDetail() : statusInfo.detail,
      tone: statusInfo.tone,
      needsAttention: adminDriveReportState.status !== "fresh",
    },
    {
      label: "비용·영업이익",
      value: totalCost !== null && operatingProfit !== null
        ? `비용 ${money.format(totalCost)}원 · 이익 ${money.format(operatingProfit)}원`
        : statusInfo.label,
      detail: hasSnapshot ? "Google Sheets 집계 셀 · 원본 행 비저장" : "장부 원본을 DB에 저장하지 않는 읽기 전용 집계",
      tone: totalCost !== null && operatingProfit !== null ? statusInfo.tone : "neutral",
      needsAttention: adminDriveReportState.status !== "fresh",
    },
    {
      label: "대출·창업비",
      value: debtBalance !== null && startupCost !== null
        ? `대출 ${money.format(debtBalance)}원 · 창업비 ${money.format(startupCost)}원`
        : statusInfo.label,
      detail: hasSnapshot ? "대표 관리자에게만 노출되는 집계값" : "관리자 권한의 서버 어댑터 연결 필요",
      tone: debtBalance !== null && startupCost !== null ? statusInfo.tone : "neutral",
      needsAttention: adminDriveReportState.status !== "fresh",
    },
  ];
}

function coachSettlementRule(coach) {
  const rule = coachSettlementRules.find((item) => (
    item.serverRoleId === coach?.serverRoleId || item.coach === coach?.name
  ));
  return rule || defaultCoachSettlementRule(coach);
}

function coachSettlementSummary(coach) {
  const rule = coachSettlementRule(coach);
  if (rule.method === "hourly") return `시급 ${money.format(Number(rule.hourly) || 0)}원`;
  return `비율 ${Math.round((Number(rule.ratio) || 0) * 100)}%`;
}

function coachStaffDraftFrom(coach) {
  const source = coach || {};
  const settlement = coachSettlementRule(source);
  return {
    coachId: source.id || "",
    coachRoleId: source.serverRoleId || "",
    availabilityRevision: Number(source.availabilityRevision) || 0,
    branchId: source.branchId || activeOperationBranchId() || defaultOperationBranch()?.id || "",
    name: source.name || "",
    phone: source.phone || "",
    jobTitle: source.role || "레슨",
    bio: source.bio || "",
    color: source.color || "#157a5b",
    approvalStatus: source.approvalStatus || (source.coachMode === "approved" ? "approved" : "pending"),
    employmentStatus: source.employmentStatus || "active",
    employmentStartedOn: source.employmentStartedOn || new Date().toISOString().slice(0, 10),
    employmentEndedOn: source.employmentEndedOn || "",
    accountLinked: Boolean(source.accountLinked),
    accountDetail: coachAccountDetail(source),
    workBlocks: coach ? normalizeCoachWorkBlocks(source).map((block) => ({ ...block, days: [...block.days] })) : [],
    breakBlocks: coach ? normalizeCoachBreakBlocks(source).map((block) => ({ ...block, days: [...block.days] })) : [],
    settlement: {
      method: settlement.method || "ratio",
      ratio: Math.round((Number(settlement.ratio) || 0) * 100),
      hourly: Number(settlement.hourly) || 0,
      basis: settlement.cardBase === "paid" ? "actual_paid_inc_vat" : "cash_ex_vat",
      substitute: settlement.substitute || "actualCoach",
      effectiveFrom: settlement.effectiveFrom || new Date().toISOString().slice(0, 10),
    },
  };
}

function readCoachStaffPanel() {
  const draft = coachStaffEditorState.draft;
  if (!draft) return;
  if (coachStaffEditorState.tab === "basic") {
    draft.name = $("#coachStaffName")?.value.trim() || "";
    draft.phone = $("#coachStaffPhone")?.value.trim() || "";
    draft.jobTitle = $("#coachStaffJobTitle")?.value.trim() || "레슨";
    draft.bio = $("#coachStaffBio")?.value.trim() || "";
    draft.color = $("#coachStaffColor")?.value || "#157a5b";
    draft.approvalStatus = $("#coachStaffApprovalStatus")?.value || "pending";
    draft.employmentStartedOn = $("#coachStaffEmploymentStartedOn")?.value || "";
  }
  if (coachStaffEditorState.tab === "settlement") {
    draft.settlement.method = $("#coachStaffSettlementMethod")?.value || "ratio";
    draft.settlement.ratio = numericValue($("#coachStaffSettlementRatio")?.value, draft.settlement.ratio);
    draft.settlement.hourly = numericValue($("#coachStaffSettlementHourly")?.value, draft.settlement.hourly);
    draft.settlement.basis = $("#coachStaffSettlementBasis")?.value || "cash_ex_vat";
    draft.settlement.substitute = $("#coachStaffSettlementSubstitute")?.value || "actualCoach";
    draft.settlement.effectiveFrom = $("#coachStaffSettlementEffectiveFrom")?.value || new Date().toISOString().slice(0, 10);
  }
}

function beginCoachStaffBlockEdit(type, blockId, allCoachStaffEditorState = coachStaffEditorState) {
  const draft = allCoachStaffEditorState.draft;
  const target = type === "break" ? draft?.breakBlocks : draft?.workBlocks;
  if (!target?.some((block) => block.id === blockId)) return;
  allCoachStaffEditorState.editingBlockType = type;
  allCoachStaffEditorState.editingBlockId = blockId;
  allCoachStaffEditorState.message = "요일과 시간을 수정한 뒤 수정 적용을 눌러주세요.";
  renderCoachStaffModal();
}

function coachStaffServerMatches(saved, draft) {
  if (!saved || saved.name !== draft.name || saved.approvalStatus !== draft.approvalStatus) return false;
  if (normalizedMemberPhone(saved.phone) !== normalizedMemberPhone(draft.phone)) return false;
  if ((saved.role || "레슨") !== (draft.jobTitle || "레슨")) return false;
  if ((saved.bio || "") !== (draft.bio || "")) return false;
  if ((saved.employmentStatus || "active") !== (draft.employmentStatus || "active")) return false;
  if (coachBlockSignature(normalizeCoachWorkBlocks(saved)) !== coachBlockSignature(draft.workBlocks)) return false;
  if (coachBlockSignature(normalizeCoachBreakBlocks(saved)) !== coachBlockSignature(draft.breakBlocks)) return false;
  const settlement = coachSettlementRule(saved);
  if (settlement.method !== draft.settlement.method) return false;
  if ((settlement.effectiveFrom || "") !== (draft.settlement.effectiveFrom || "")) return false;
  if (draft.settlement.method === "ratio" && Math.round((Number(settlement.ratio) || 0) * 100) !== Number(draft.settlement.ratio)) return false;
  if (draft.settlement.method === "hourly" && Number(settlement.hourly) !== Number(draft.settlement.hourly)) return false;
  return true;
}

function scheduleLaneActiveCoaches() {
  const active = operationBranchCoaches().filter((coach) => (
    coach.serverRoleId
    && !coach.deletedAt
    && !coach.archivedAt
    && (coach.employmentStatus || "active") === "active"
    && ["active", "approved"].includes(coach.status || coach.approvalStatus || "active")
  ));
  return active.sort((left, right) => (
      Number(left.scheduleLaneOrder || 1000) - Number(right.scheduleLaneOrder || 1000)
      || String(left.name || "").localeCompare(String(right.name || ""), "ko")
    ));
}

function coachLaneOrderItems() {
  const byRoleId = new Map(scheduleLaneActiveCoaches().map((coach) => [String(coach.serverRoleId), coach]));
  return coachLaneOrderEditorState.roleIds.map((roleId) => byRoleId.get(String(roleId))).filter(Boolean);
}

function coachLaneOrderPreviewText(day, time) {
  const names = coachLaneOrderItems()
    .filter((coach) => coachWorksAtPreviewTime(coach, day, time))
    .map((coach) => String(coach.name || "코치").replace(/\s*코치$/u, ""));
  return names.length ? names.join(" | ") : "근무 코치 없음";
}

function moveCoachLaneOrder(roleId, direction) {
  ensureCoachLaneOrderEditorState();
  const index = coachLaneOrderEditorState.roleIds.indexOf(String(roleId));
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= coachLaneOrderEditorState.roleIds.length) return;
  const next = [...coachLaneOrderEditorState.roleIds];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  coachLaneOrderEditorState.roleIds = next;
  coachLaneOrderEditorState.confirmed = false;
  coachLaneOrderEditorState.revision = "";
  coachLaneOrderEditorState.message = "미리보기를 확인한 뒤 서버 확인을 눌러주세요.";
  renderCoachLaneOrderEditor();
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

function editBreakRule(ruleId) {
  if (!scheduleSettings.breakRules.some((rule) => rule.id === ruleId)) return;
  state.editingBreakRuleId = ruleId;
  renderScheduleSettings();
  $("#breakStartInput")?.focus();
}

function clearBreakRuleEditor() {
  state.editingBreakRuleId = "";
  $$('[data-break-day]').forEach((input) => { input.checked = false; });
  $$('[data-break-coach]').forEach((input) => { input.checked = true; });
  if ($("#breakLabelInput")) $("#breakLabelInput").value = "브레이크";
  const applyButton = $("#applyBreakRuleButton");
  if (applyButton) applyButton.textContent = "브레이크 추가";
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

function readNoticePopupForm(statusOverride = "") {
  const baseNotice = editingPopupNotice();
  const actionUrl = $("#noticeActionUrlInput")?.value.trim() || "";
  return normalizePopupNotice({
    ...baseNotice,
    id: $("#noticePopupSettings")?.dataset.noticeId || baseNotice.id,
    title: $("#noticeTitleInput")?.value.trim() || defaultPopupNotice.title,
    body: $("#noticeBodyInput")?.value.trim() || defaultPopupNotice.body,
    audience: $("#noticeAudienceInput")?.value || "all",
    status: statusOverride || $("#noticeStatusInput")?.value || "active",
    priority: $("#noticePriorityInput")?.value || "normal",
    startDate: $("#noticeStartDateInput")?.value || "",
    endDate: $("#noticeEndDateInput")?.value || "",
    showOncePerDay: $("#noticeOncePerDayInput")?.checked !== false,
    displayOrder: baseNotice.displayOrder || ((popupNotices().length + 1) * 10),
    imageUrl: noticeImageRemoveRequested ? "" : baseNotice.imageUrl,
    imageStoragePath: noticeImageRemoveRequested ? "" : baseNotice.imageStoragePath,
    imageAlt: $("#noticeImageAltInput")?.value.trim() || "",
    actionLabel: actionUrl ? ($("#noticeActionLabelInput")?.value.trim() || "자세히 보기") : "",
    actionUrl,
  });
}

function selectNoticeImage(file) {
  if (!file) return;
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    showToast("JPG, PNG, WebP 이미지만 첨부할 수 있습니다");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("공지 이미지는 5MB 이하로 첨부해주세요");
    return;
  }
  resetNoticeImageDraft();
  noticeImageDraftFile = file;
  noticeImageDraftUrl = URL.createObjectURL(file);
  renderNoticePopupSettings();
}

async function uploadNoticeDraftImage(notice) {
  if (!noticeImageDraftFile) return { notice, uploadedPath: "" };
  const client = liveNoticeClient();
  if (!client?.uploadObject) throw new Error("관리자 로그인 후 이미지를 첨부할 수 있습니다");
  const current = await client.selectCurrentProfile?.();
  const authUser = current?.user || await client.getAuthUser?.();
  const ownerId = current?.profile?.id || authUser?.id;
  if (!ownerId) throw new Error("관리자 계정을 확인할 수 없습니다");
  const objectPath = `${ownerId}/${safeNoticeFileName(noticeImageDraftFile.name)}`;
  await client.uploadObject(noticeMediaBucket, objectPath, noticeImageDraftFile);
  const imageUrl = noticeStoragePublicUrl(objectPath);
  if (!imageUrl) {
    await client.deleteObject?.(noticeMediaBucket, objectPath).catch(() => {});
    throw new Error("공지 이미지 주소를 만들 수 없습니다");
  }
  return {
    notice: normalizePopupNotice({ ...notice, imageUrl, imageStoragePath: objectPath }),
    uploadedPath: objectPath,
  };
}

function editPopupNotice(noticeId = "") {
  if (!popupNotices().some((notice) => notice.id === noticeId)) return;
  resetNoticeImageDraft();
  state.noticeDraft = null;
  state.noticeEditingId = noticeId;
  renderNoticePopupSettings();
  $("#noticeTitleInput")?.focus();
}

function branchSalesSettingsDirty() {
  return JSON.stringify(normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig))
    !== JSON.stringify(normalizeBranchSalesConfig(branchSalesSettingsState.appliedConfig));
}

function branchSalesConfigFromForm() {
  const panel = $("#branchSalesSetupPanel");
  const next = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  if (!panel) return next;
  panel.querySelectorAll("[data-sales-feature]").forEach((input) => {
    next.features[input.dataset.salesFeature] = input.checked === true;
  });
  panel.querySelectorAll("[data-sales-payment-method][data-sales-field]").forEach((input) => {
    const method = next.paymentMethods[input.dataset.salesPaymentMethod];
    if (!method) return;
    const field = input.dataset.salesField;
    method[field] = input.type === "checkbox" ? input.checked === true : input.type === "number" ? Number(input.value || 0) : input.value.trim();
  });
  panel.querySelectorAll("[data-sales-benefit][data-sales-field]").forEach((input) => {
    const benefit = next.benefits[input.dataset.salesBenefit];
    if (!benefit) return;
    const field = input.dataset.salesField;
    benefit[field] = input.type === "checkbox" ? input.checked === true : input.type === "number" ? Number(input.value || 0) : input.value.trim();
  });
  next.features.newMemberBenefit = next.benefits.newMember.enabled === true;
  next.features.returningMemberBenefit = next.benefits.returningMember.enabled === true;
  next.features.referralBenefit = next.benefits.referral.enabled === true;
  return normalizeBranchSalesConfig(next);
}

function branchSalesPreviewMarkup() {
  const config = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  const methods = Object.entries(config.paymentMethods)
    .filter(([id, method]) => id !== "onsite_cash" && method.enabled === true)
    .sort((left, right) => Number(left[1].displayOrder) - Number(right[1].displayOrder));
  const products = membershipProductsForActiveOperationProfile()
    .map((product) => normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id)))
    .filter((product) => product.status === "sale")
    .filter((product) => config.features.oneDay || product.purchaseExperience !== "one_day")
    .filter((product) => config.features.threeMonth || Number(product.termWeeks) < 12)
    .slice(0, 3);
  const benefit = Object.values(config.benefits).find((item) => item.enabled === true);
  return `
    <div class="branch-sales-phone" aria-label="회원앱 390픽셀 미리보기">
      <div class="branch-sales-phone-head"><small>회원권</small><strong>${escapeHtml(activeOperationBranchName())}</strong></div>
      <div class="branch-sales-phone-body">
        <strong>${products[0] ? "원하는 수업을 선택하세요" : "판매 상품을 준비 중입니다"}</strong>
        ${products.map((product, index) => `<button type="button" tabindex="-1" class="branch-sales-preview-product ${index === 0 ? "is-selected" : ""}"><span>${escapeHtml(product.title)}</span><b>${money.format(Number(product.cashAmount || product.cardAmount || 0))}원~</b></button>`).join("")}
        ${benefit ? `<span class="branch-sales-preview-benefit">${escapeHtml(benefit.title)} · ${Number(benefit.discountValue || 0)}% 자동 확인</span>` : ""}
        <div class="branch-sales-preview-methods">${methods.map(([, method], index) => `<span class="${index === 0 ? "is-selected" : ""}">${escapeHtml(method.title)}</span>`).join("") || "<span>결제수단 준비 중</span>"}</div>
        <button type="button" tabindex="-1" class="branch-sales-preview-pay">결제하기</button>
      </div>
    </div>`;
}

function renderBranchSalesPreview() {
  const target = $("#branchSalesMemberPreview");
  if (target) target.innerHTML = branchSalesPreviewMarkup();
  const status = $("#branchSalesDraftStatus");
  if (status) status.textContent = branchSalesSettingsDirty() ? "적용 전 변경 있음" : "현재 앱과 동일";
}

function branchSalesPaymentMethodMarkup(id, method) {
  const labels = {
    tosspay: "승인된 토스 간편결제",
    bank_transfer: "입금 확인 후 회원권 생성",
    card: "일반 카드 PG 승인 후 사용",
    kakaopay: "카카오페이 승인 후 사용",
    naverpay: "네이버페이 승인 후 사용",
  };
  return `
    <article class="branch-sales-method-card">
      <label class="branch-sales-toggle"><input type="checkbox" data-sales-payment-method="${id}" data-sales-field="enabled" ${method.enabled ? "checked" : ""} /><span>${escapeHtml(method.title)}</span></label>
      <small>${labels[id]} · ${method.priceBasis === "cash" ? "현금가" : "카드가"}</small>
      <div class="branch-sales-inline-fields">
        <label><span>앱 표기</span><input type="text" maxlength="30" value="${escapeHtml(method.title)}" data-sales-payment-method="${id}" data-sales-field="title" /></label>
        <label><span>순서</span><input type="number" min="1" max="999" value="${Number(method.displayOrder || 10)}" data-sales-payment-method="${id}" data-sales-field="displayOrder" /></label>
        <label class="branch-sales-check"><input type="checkbox" data-sales-payment-method="${id}" data-sales-field="couponAllowed" ${method.couponAllowed !== false ? "checked" : ""} /> 쿠폰 허용</label>
      </div>
    </article>`;
}

function branchSalesBenefitMarkup(id, benefit) {
  const descriptions = {
    newMember: "처음 등록하는 회원",
    returningMember: `${Number(benefit.inactiveDays || 90)}일 이상 쉬고 돌아온 회원`,
    referral: "추천 관계가 확인된 두 회원",
  };
  return `
    <article class="branch-sales-benefit-card">
      <label class="branch-sales-toggle"><input type="checkbox" data-sales-benefit="${id}" data-sales-field="enabled" ${benefit.enabled ? "checked" : ""} /><span>${escapeHtml(benefit.title)}</span></label>
      <small>${descriptions[id]}</small>
      <div class="branch-sales-inline-fields">
        <label><span>쿠폰 이름</span><input type="text" maxlength="40" value="${escapeHtml(benefit.title)}" data-sales-benefit="${id}" data-sales-field="title" /></label>
        <label><span>할인율</span><input type="number" min="1" max="100" value="${Number(benefit.discountValue || 5)}" data-sales-benefit="${id}" data-sales-field="discountValue" /></label>
        <label><span>사용기한</span><input type="number" min="1" max="365" value="${Number(benefit.expiresDays || 30)}" data-sales-benefit="${id}" data-sales-field="expiresDays" /></label>
        ${id === "returningMember" ? `<label><span>미이용 일수</span><input type="number" min="30" max="730" value="${Number(benefit.inactiveDays || 90)}" data-sales-benefit="${id}" data-sales-field="inactiveDays" /></label>` : ""}
      </div>
    </article>`;
}

function bankNotificationDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function bankNotificationStatusMarkup() {
  if (bankNotificationStatusState.status === "loading") {
    return '<p class="empty-text">입금 알림 기기 상태를 확인하는 중입니다.</p>';
  }
  if (bankNotificationStatusState.status === "failed") {
    return `<p class="branch-sales-error">알림 상태를 불러오지 못했습니다. (${escapeHtml(bankNotificationStatusState.message)})</p>`;
  }
  const devices = bankNotificationStatusState.devices || [];
  const reviewEvents = bankNotificationStatusState.reviewEvents || [];
  const history = bankNotificationStatusState.accountHistory || [];
  const currentRevision = Number(branchPaymentAccount?.revision || 0);
  const deviceMarkup = devices.length
    ? devices.slice(0, 4).map((device) => {
        const online = device.status === "active"
          && Date.now() - Date.parse(device.lastHeartbeatAt || "") < 15 * 60 * 1000;
        const revisionMatches = Number(device.accountRevision || 0) === currentRevision;
        return `<li><span><strong>${escapeHtml(device.deviceName || "관리자 Android")}</strong><small>마지막 연결 ${escapeHtml(bankNotificationDateTime(device.lastHeartbeatAt))}</small></span><span class="bank-device-actions">${badge(online && revisionMatches ? "ready" : "pending", !revisionMatches ? "다시 연결 필요" : online ? "연결됨" : "연결 확인")}${device.status === "active" ? `<button class="ghost-button" type="button" data-revoke-bank-device="${escapeHtml(device.id || "")}">연결 해제</button>` : ""}</span></li>`;
      }).join("")
    : '<li class="empty-text">연결된 Android 관리기기가 없습니다. 관리자 계정으로 앱에서 연결해 주세요.</li>';
  const reviewMarkup = reviewEvents.length
    ? reviewEvents.slice(0, 5).map((event) => `<li><span><strong>${money.format(Number(event.amount || 0))}원 · ${escapeHtml(event.depositorHint || "입금자 미확인")}</strong><small>${escapeHtml(bankNotificationDateTime(event.receivedAt))}</small></span>${badge("pending", ({ partial: "일부 입금", overpaid: "초과 입금", late: "기한 지남", ambiguous: "중복 후보", rejected: "해석 실패", disabled: "자동확인 꺼짐" })[event.status] || "확인 필요")}</li>`).join("")
    : '<li class="empty-text">직접 확인할 입금 알림이 없습니다.</li>';
  const actionLabels = { created: "등록", updated: "변경", retired: "사용 중지", reactivated: "다시 사용", migration_snapshot: "기존 설정" };
  const historyMarkup = history.length
    ? history.slice(0, 5).map((entry) => {
        const digits = String(entry.account_number || "").replace(/[^0-9]/g, "");
        return `<li><span><strong>v${Number(entry.revision || 0)} · ${escapeHtml(entry.bank_name || "은행")} · 끝 ${escapeHtml(digits.slice(-4) || "----")}</strong><small>${escapeHtml(bankNotificationDateTime(entry.created_at))} · 입금기한 ${Number(entry.deposit_deadline_hours || 24)}시간</small></span>${badge(entry.is_enabled ? "ready" : "neutral", actionLabels[entry.action] || "변경")}</li>`;
      }).join("")
    : '<li class="empty-text">계좌 변경이력은 새 DB 업데이트 적용 후 기록됩니다.</li>';
  return `
    <div class="bank-notification-status-grid">
      <section><h4>알림 기기</h4><ul>${deviceMarkup}</ul></section>
      <section><h4>확인 필요</h4><ul>${reviewMarkup}</ul></section>
      <section><h4>계좌 변경이력</h4><ul>${historyMarkup}</ul></section>
    </div>`;
}

function renderBranchSalesSetup() {
  const target = $("#branchSalesSetupPanel");
  if (!target) return;
  const branchId = activeOperationBranchId();
  if (!branchId) {
    target.innerHTML = '<p class="empty-text">운영 지점을 먼저 선택해 주세요.</p>';
    return;
  }
  if (branchSalesSettingsState.status === "loading") {
    target.innerHTML = '<p class="empty-text">회원 판매 설정을 불러오는 중입니다.</p>';
    return;
  }
  const config = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  const account = branchPaymentAccount || {};
  const activeCoaches = coaches.filter((coach) => coach.status === "active" && coach.serverRoleId);
  const failed = branchSalesSettingsState.status === "failed";
  target.innerHTML = `
    <div class="panel-heading compact-heading branch-sales-heading">
      <div><p class="eyebrow">초보자 빠른 설정</p><h2>회원 판매 5단계</h2><span>기존 상품·시간표·쿠폰·결제를 한곳에서 설정합니다.</span></div>
      <span id="branchSalesDraftStatus" class="source-pill">${failed ? "서버 설정 필요" : branchSalesSettingsDirty() ? "적용 전 변경 있음" : "현재 앱과 동일"}</span>
    </div>
    ${failed ? `<p class="branch-sales-error" role="alert">설정 기능을 불러오지 못했습니다. DB 업데이트와 관리자 권한을 확인한 뒤 다시 시도해 주세요. (${escapeHtml(branchSalesSettingsState.message)})</p>` : ""}
    <div class="branch-sales-steps ${failed ? "is-disabled" : ""}">
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>1</b><span><strong>상품</strong><small>판매할 종류만 켭니다</small></span></div><div class="branch-sales-toggle-grid">
        <label><input type="checkbox" data-sales-feature="threeMonth" ${config.features.threeMonth ? "checked" : ""} /> 3개월</label>
        <label><input type="checkbox" data-sales-feature="oneDay" ${config.features.oneDay ? "checked" : ""} /> 원데이</label>
        <label><input type="checkbox" data-sales-feature="coupons" ${config.features.coupons ? "checked" : ""} /> 쿠폰</label>
        <label><input type="checkbox" data-sales-feature="bankNotificationEvidence" ${config.features.bankNotificationEvidence ? "checked" : ""} /> Android 입금 알림 확인</label>
      </div><small>가격·주 1/2회·평일/주말은 아래 기존 상품 편집에서 그대로 관리합니다.</small></section>
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>2</b><span><strong>코치·시간</strong><small>실제 시간표와 연결</small></span></div><p><strong>활동 코치 ${activeCoaches.length}명</strong> · ${activeCoaches.map((coach) => escapeHtml(coach.name)).join(" · ") || "연결된 코치 없음"}</p><small>모든 코치 또는 선택 코치는 상품별 상세에서 정합니다. 앱에는 서버에 연결되고 빈 시간이 있는 코치만 예약 가능으로 표시됩니다.</small></section>
      <section class="branch-sales-step branch-sales-payment-step"><div class="branch-sales-step-title"><b>3</b><span><strong>결제</strong><small>수단별 이름·노출·쿠폰</small></span></div><div class="branch-sales-method-grid">${["tosspay", "bank_transfer", "card", "kakaopay", "naverpay"].map((id) => branchSalesPaymentMethodMarkup(id, config.paymentMethods[id])).join("")}</div>
        <details class="branch-sales-bank-details" ${account.is_enabled ? "open" : ""}><summary>계좌이체 입금 계좌</summary><div class="branch-sales-bank-grid">
          <label><span>은행</span><input id="salesBranchBankName" type="text" maxlength="40" value="${escapeHtml(account.bank_name || "")}" placeholder="예: 우리은행" /></label>
          <label><span>계좌번호</span><input id="salesBranchBankAccountNumber" type="text" maxlength="32" inputmode="numeric" value="${escapeHtml(account.account_number || "")}" /></label>
          <label><span>예금주</span><input id="salesBranchBankAccountHolder" type="text" maxlength="60" value="${escapeHtml(account.account_holder || "")}" /></label>
          <label><span>입금기한</span><select id="salesBranchBankDepositDeadlineHours"><option value="12" ${Number(account.deposit_deadline_hours || 24) === 12 ? "selected" : ""}>12시간</option><option value="24" ${Number(account.deposit_deadline_hours || 24) === 24 ? "selected" : ""}>24시간</option><option value="48" ${Number(account.deposit_deadline_hours || 24) === 48 ? "selected" : ""}>48시간</option><option value="72" ${Number(account.deposit_deadline_hours || 24) === 72 ? "selected" : ""}>72시간</option></select></label>
          <label class="branch-sales-check"><input id="salesBranchBankTransferEnabled" type="checkbox" ${account.is_enabled ? "checked" : ""} /> 회원앱 사용</label>
          <label class="branch-sales-bank-note"><span>입금 안내</span><input id="salesBranchBankTransferInstructions" type="text" maxlength="300" value="${escapeHtml(account.transfer_instructions || "")}" placeholder="신청자 이름으로 입금해 주세요" /></label>
          <button id="saveSalesBranchPaymentAccountButton" class="small-button" type="button">계좌 저장</button>
        </div><small>계좌는 주문할 때 복사되어 이후 계좌를 바꿔도 기존 주문은 그대로 유지됩니다. 정확히 일치한 Android 입금 알림만 자동 확인하고, 나머지는 관리자 검토로 남깁니다.</small>${bankNotificationStatusMarkup()}</details>
      </section>
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>4</b><span><strong>혜택·쿠폰</strong><small>대상별 이름·할인율</small></span></div><div class="branch-sales-benefit-grid">${Object.entries(config.benefits).map(([id, benefit]) => branchSalesBenefitMarkup(id, benefit)).join("")}</div><small>혜택은 켠 뒤에도 대상 판정과 중복 방지를 서버에서 다시 확인합니다.</small></section>
      <section class="branch-sales-step branch-sales-preview-step"><div class="branch-sales-step-title"><b>5</b><span><strong>미리보기·적용</strong><small>390px 회원 화면 기준</small></span></div><div id="branchSalesMemberPreview">${branchSalesPreviewMarkup()}</div><div class="branch-sales-actions"><button id="saveBranchSalesDraftButton" class="secondary-button" type="button" ${failed ? "disabled" : ""}>초안 저장</button><button id="applyBranchSalesSettingsButton" class="primary-button" type="button" ${failed ? "disabled" : ""}>회원앱에 적용</button></div><small>초안 저장만으로는 앱이 바뀌지 않습니다. 적용 후 새 주문부터 새 설정과 가격이 고정됩니다.</small></section>
    </div>`;
}

function adminLayoutRowMarkup(item, kind, index, count, group = "") {
  const hiddenList = kind === "menu"
    ? adminLayoutSettings.hiddenMenus
    : kind === "group"
      ? adminLayoutSettings.hiddenGroups
      : kind === "reportWidget"
        ? adminLayoutSettings.hiddenReportWidgets
        : adminLayoutSettings.hiddenWidgets;
  return `
    <div class="admin-layout-row ${kind === "reportWidget" ? "has-report-options" : ""}">
      <label>
        <input type="checkbox" data-admin-layout-visible="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" ${hiddenList.includes(item.id) ? "" : "checked"} ${item.required ? "disabled" : ""} />
        <span>${escapeHtml(item.label)}</span>
      </label>
      <div class="admin-layout-row-actions">
        ${kind === "menu" && item.id !== "dashboard" ? `
          <button class="small-button admin-menu-placement-button" type="button" data-admin-menu-placement="${adminLayoutSettings.moreMenus.includes(item.id) ? "primary" : "more"}" data-admin-layout-id="${item.id}">${adminLayoutSettings.moreMenus.includes(item.id) ? "주 메뉴로" : "더보기로"}</button>
        ` : ""}
        ${kind === "reportWidget" ? `
          <label class="admin-layout-option">
            <span>폭</span>
            <select data-admin-report-widget-size="${item.id}" aria-label="${escapeHtml(item.label)} 폭">
              ${adminReportWidgetSizeOptions.map((option) => `<option value="${option.id}" ${adminLayoutSettings.reportWidgetSizes[item.id] === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
          <label class="admin-layout-option">
            <span>표시</span>
            <select data-admin-report-widget-filter="${item.id}" aria-label="${escapeHtml(item.label)} 표시 기준">
              ${adminReportWidgetFilterOptions.map((option) => `<option value="${option.id}" ${adminLayoutSettings.reportWidgetFilters[item.id] === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        <button class="icon-button" type="button" aria-label="위로 이동" title="위로 이동" data-move-admin-layout="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-button" type="button" aria-label="아래로 이동" title="아래로 이동" data-move-admin-layout="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" data-direction="1" ${index === count - 1 ? "disabled" : ""}>↓</button>
      </div>
    </div>`;
}

function moveAdminLayoutItem(kind, itemId, direction, group = "") {
  const order = kind === "menu"
    ? adminLayoutSettings.menuOrder
    : kind === "group"
      ? adminLayoutSettings.groupOrder
      : kind === "reportWidget"
        ? adminLayoutSettings.reportWidgetOrder
        : adminLayoutSettings.widgetOrder[group];
  if (!order) return;
  const index = order.indexOf(itemId);
  const nextIndex = index + Number(direction);
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

function adminLayoutPresetId() {
  return Object.entries(adminLayoutPresets).find(([, preset]) => (
    preset.menuOrder.length === adminLayoutSettings.menuOrder.length
    && preset.menuOrder.every((id, index) => adminLayoutSettings.menuOrder[index] === id)
    && preset.moreMenus.length === adminLayoutSettings.moreMenus.length
    && preset.moreMenus.every((id) => adminLayoutSettings.moreMenus.includes(id))
    && adminLayoutSettings.hiddenMenus.length === 0
  ))?.[0] || "custom";
}

function filteredMembershipProducts() {
  const keyword = String(state.membershipProductSearch || "").trim().toLowerCase();
  const status = membershipProductStatusOptions.some((option) => option.id === state.membershipProductStatusFilter)
    ? state.membershipProductStatusFilter
    : "all";
  state.membershipProductStatusFilter = status;
  return membershipProductsForActiveOperationProfile().filter((product) => {
    const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
    const searchText = [
      normalized.title,
      normalized.group,
      normalized.productKind,
      normalized.scheduleScope,
      normalized.sessions,
      `${normalized.tickets}회`,
      `${normalized.lessonMinutes}분`,
    ].join(" ").toLowerCase();
    return (!keyword || searchText.includes(keyword))
      && (status === "all" || normalized.status === status);
  });
}

let adminLiveScheduleRefreshTimer = 0;
let adminLiveScheduleRefreshInFlight = false;
let adminLiveScheduleLastRefreshAt = 0;
let adminOperationalRevisionWatcher = null;
let scheduleSessionInitialized = false;
const adminLiveRefreshViews = new Set(["dashboard", "members", "schedule", "billing", "reports", "notes"]);
const ADMIN_LIVE_REFRESH_INTERVAL_MS = 300_000;
const ADMIN_LIVE_REFRESH_STALE_MS = 120_000;

function adminHasUnsavedChanges() {
  if (document.querySelector('[data-dirty="true"]')) return true;
  const inputGuard = window.TennisNoteInputGuard;
  if (!inputGuard?.isDirty) return false;
  return [...document.querySelectorAll("[data-tn-input-guard]")].some((root) => (
    !root.hidden
    && root.getAttribute("aria-hidden") !== "true"
    && inputGuard.isDirty(root)
  ));
}

function installAdminLiveScheduleRefresh() {
  if (adminLiveScheduleRefreshTimer) return;
  const refresh = () => refreshAdminLiveSchedule().catch(() => false);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  renderCustomLessonColorRules();
  adminLiveScheduleRefreshTimer = window.setInterval(refresh, ADMIN_LIVE_REFRESH_INTERVAL_MS);
}

function installAdminOperationalRevisionWatcher() {
  if (adminOperationalRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  adminOperationalRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: () => activeOperationBranchId() || "",
    active: () => !document.hidden
      && operationsAccessReady()
      && adminLiveRefreshViews.has(state.view)
      && state.view !== "schedule",
    onChange: async () => {
      adminLiveScheduleLastRefreshAt = 0;
      await refreshAdminLiveSchedule({ force: true });
    },
  });
}

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

function scheduleV2AdminBridgeSnapshot() {
  const branchTickets = operationBranchTickets([...tickets, ...expiredTickets]);
  const branchTicketIds = new Set(branchTickets.map((ticket) => String(ticket.serverTicketId || ticket.id || "")));
  const branchLessonIds = new Set(operationBranchLessons().map((lesson) => String(lesson.serverLessonId || lesson.id || "")));
  return {
    branchId: activeOperationBranchId(),
    branchName: activeOperationBranchName(),
    role: operationsRole(),
    accessReady: operationsAccessReady(),
    liveLoaded: state.liveScheduleLoaded,
    liveLoading: state.liveScheduleLoading,
    liveMessage: state.liveScheduleMessage,
    week: { ...activeAdminWeek() },
    coaches: operationBranchCoaches().map((coach) => ({
      id: coach.id,
      roleId: coach.serverRoleId || "",
      name: coach.name,
      color: coach.color || "",
      status: coach.status,
      workBlocks: normalizeCoachWorkBlocks(coach).map((block) => ({ ...block, days: [...block.days] })),
      breakBlocks: normalizeCoachBreakBlocks(coach).map((block) => ({ ...block, days: [...block.days] })),
    })),
    members: operationBranchMembers().map((member) => ({
      id: member.id,
      userId: member.serverUserId || "",
      userIds: [...(member.serverUserIds || [])],
      name: member.name,
      status: member.status,
      phoneLast4: String(member.phone || "").replace(/\D/g, "").slice(-4),
      birthYear: member.birthYear || "",
    })),
    tickets: branchTickets.map((ticket) => ({
      id: ticket.serverTicketId || ticket.id || "",
      ownerUserId: ticket.serverUserId || "",
      participantUserIds: [...(ticket.participantUserIds || [])],
      coachRoleId: ticket.coachRoleId || "",
      productId: ticket.productId || "",
      productName: ticket.product || "회원권",
      productKind: ticket.productKind || "regular",
      groupSize: Number(ticket.groupSize) || 1,
      lessonMinutes: Number(ticket.durationMinutes) || 20,
      frequencyPerWeek: Number(ticket.weeklyCount) || 1,
      totalSessions: Number(ticket.total) || 0,
      usedSessions: Number(ticket.used) || 0,
      remainingSessions: Number(ticket.remaining) || 0,
      startsOn: ticket.purchased || "",
      expiresOn: ticket.expires || "",
      status: ticket.status || "",
    })),
    lessons: operationBranchLessons().map((lesson) => ({
      id: lesson.serverLessonId || lesson.id || "",
      revision: Number(lesson.serverRevision) || null,
      coachRoleId: lesson.coachRoleId || "",
      originalCoachRoleId: lesson.originalCoachRoleId || "",
      lessonDate: lesson.lessonDate || "",
      startTime: lesson.time || "",
      durationMinutes: Number(lesson.durationMinutes) || 20,
      status: (isLessonCancelled(lesson) || isReleasedRegularMakeupSlot(lesson))
        ? "cancelled"
        : lesson.serverStatus || lesson.status || "scheduled",
      scheduleKind: lesson.scheduleV2Kind || normalizeLessonSource(lesson.lessonSource) || "regular",
      memberLabel: lesson.member || "회원 확인 필요",
      oneDayBooking: Boolean(lesson.oneDayBooking),
      oneDayBookingId: lesson.serverOneDayBookingId || "",
      linkedUserId: lesson.linkedUserId || "",
      guestPhoneLast4: String(lesson.guestPhone || "").replace(/\D/g, "").slice(-4),
      note: lesson.oneDayNote || "",
      oneDayBookingSource: lesson.oneDayBookingSource || "walk_in",
      oneDayPaymentStatus: lesson.oneDayPaymentStatus || "unpaid",
      oneDayPaymentMethod: lesson.oneDayPaymentMethod || "",
      oneDayPaymentAmount: Math.max(0, Number(lesson.oneDayPaymentAmount) || 0),
    })),
    participantRows: (adminLiveDataState.participantRows || [])
      .filter((row) => branchLessonIds.has(String(row.lesson_id || "")))
      .map((row) => ({ lessonId: row.lesson_id, userId: row.user_id, ticketId: row.ticket_id })),
    products: (adminLiveDataState.products || [])
      .filter((product) => !product.branch_id || matchesActiveOperationBranch(product.branch_id))
      .map((product) => ({ ...product })),
    ticketIds: [...branchTicketIds],
  };
}

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
