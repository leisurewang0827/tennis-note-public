const adminQuery = new URLSearchParams(window.location.search);
const adminDemoMode = adminQuery.get("demoAdmin") === "1";
const adminLocalPreviewMode = adminDemoMode && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const adminBrandSplashStartedAt = performance.now();
const adminBrandSplashMinimumDuration = 250;
let adminBrandSplashHideScheduled = false;

function hideAdminBrandSplash() {
  const splash = document.querySelector("#adminBrandSplash");
  if (!splash || splash.hidden || adminBrandSplashHideScheduled) return;
  adminBrandSplashHideScheduled = true;
  const elapsed = performance.now() - adminBrandSplashStartedAt;
  const delay = Math.max(0, adminBrandSplashMinimumDuration - elapsed);
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
    }, 240);
  }, delay);
}

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

function saveScheduleSafetySnapshot(source = lessons, reason = "refresh") {
  const today = new Date();
  const rangeStart = new Date(today);
  const rangeEnd = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 14);
  rangeEnd.setDate(rangeEnd.getDate() + 63);
  const startDate = rangeStart.toISOString().slice(0, 10);
  const endDate = rangeEnd.toISOString().slice(0, 10);
  const savedLessons = persistentScheduleLessons(source)
    .filter((lesson) => !lesson.lessonDate || (lesson.lessonDate >= startDate && lesson.lessonDate <= endDate))
    .sort((left, right) => `${left.lessonDate || ""}T${left.time || ""}`.localeCompare(`${right.lessonDate || ""}T${right.time || ""}`))
    .slice(0, scheduleSafetySnapshotLimit);
  if (!savedLessons.length) return;
  try {
    localStorage.setItem(scheduleSafetySnapshotKey, JSON.stringify({
      version: adminSnapshotVersion,
      savedAt: new Date().toISOString(),
      reason,
      lessons: savedLessons,
    }));
  } catch {
    // Storage is a secondary safety net. The Supabase schedule remains canonical.
  }
}

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

function refreshAdminScheduleWeekLabels() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  adminScheduleWeeks.forEach((week, offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    Object.assign(week, {
      label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
      range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      note: offset === 0 ? "이번 주 실시간 수업과 변경 요청" : "다음 주 실시간 수업과 변경 요청",
      startDate: adminLocalDateKey(start),
      endDate: adminLocalDateKey(end),
    });
  });
}

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

function syncAdminScheduleWeek() {
  const week = activeAdminWeek();
  if (state.liveScheduleLoaded) {
    // Live lessons stay as one canonical collection. Rendering applies the week filter.
    // Replacing this array with only one week made other live lessons appear deleted.
    return;
  }
  for (let index = lessons.length - 1; index >= 0; index -= 1) {
    if (`${lessons[index].id}`.startsWith("admin-week-")) lessons.splice(index, 1);
  }
  (week.lessons || []).forEach((lesson) => {
    lessons.push({ ...lesson });
  });
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

function initializeOperationsSessionPersistence() {
  const remember = $("#operationsRememberLogin");
  let savedRemember = null;
  try {
    savedRemember = localStorage.getItem(operationsRememberStorageKey);
  } catch (error) {
    savedRemember = null;
  }
  const shouldRemember = savedRemember === null ? true : savedRemember === "true";
  if (savedRemember === null) {
    try {
      localStorage.setItem(operationsRememberStorageKey, "true");
    } catch (error) {
      // The checked UI still provides the safe default when storage is unavailable.
    }
  }
  window.TennisNoteDataClient?.setSessionPersistence?.(shouldRemember);
  if (remember) {
    remember.checked = shouldRemember;
    remember.dataset.ready = "true";
  }
  return shouldRemember;
}

function operationsProfileCacheStores() {
  return window.TennisNoteDataClient?.sessionPersistence?.() === "session"
    ? [sessionStorage]
    : [localStorage, sessionStorage];
}

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

function writeCachedOperationsIdentity(user, profile) {
  if (!user?.id || !["admin", "coach"].includes(profile?.role)) return false;
  const cached = {
    user: { id: user.id },
    profile: {
      id: profile.id || "",
      name: profile.name || "",
      role: profile.role,
    },
  };
  const activeStorage = operationsProfileCacheStores()[0];
  try {
    activeStorage.setItem(operationsProfileCacheStorageKey, JSON.stringify(cached));
    [localStorage, sessionStorage]
      .filter((storage) => storage !== activeStorage)
      .forEach((storage) => storage.removeItem(operationsProfileCacheStorageKey));
    return true;
  } catch (error) {
    return false;
  }
}

function clearCachedOperationsIdentity() {
  [localStorage, sessionStorage].forEach((storage) => {
    try {
      storage.removeItem(operationsProfileCacheStorageKey);
    } catch (error) {
      // Clearing either available store is sufficient.
    }
  });
}

function restoreCachedOperationsIdentity() {
  const session = window.TennisNoteDataClient?.getSession?.();
  if (!session?.access_token || adminImportAuthState.profile) return false;
  const cached = readCachedOperationsIdentity();
  if (!cached) return false;
  Object.assign(adminImportAuthState, {
    loading: true,
    loaded: true,
    user: cached.user,
    profile: cached.profile,
    message: "저장된 로그인으로 운영 화면을 복원하고 있습니다.",
  });
  return true;
}

function operationsRole() {
  if (adminLocalPreviewMode) return "admin";
  return String(adminImportAuthState.profile?.role || "");
}

function operationsAccessReady() {
  if (adminLocalPreviewMode) return true;
  return Boolean(
    window.TennisNoteDataClient?.getSession?.()?.access_token
    && ["admin", "coach"].includes(operationsRole()),
  );
}

function operationsViewAllowed(view) {
  return operationsRole() === "admin" || coachOperationsViews.has(view);
}

function applyOperationsRolePermissions() {
  const role = operationsRole();
  document.body.dataset.operationsRole = role || "signed-out";
  if (role === "coach" && state.memberFilter === "inactive") state.memberFilter = "active";
  $$(".nav-item[data-view]").forEach((button) => {
    if (!button.dataset.adminLabel) button.dataset.adminLabel = button.textContent.trim();
    const coachLabels = {
      members: "회원 찾기",
      schedule: "레슨표",
      notes: "수업 완료",
      issues: "오류 접수",
    };
    button.textContent = role === "coach"
      ? coachLabels[button.dataset.view] || button.dataset.adminLabel
      : button.dataset.adminLabel;
    button.hidden = role === "coach" && !coachOperationsViews.has(button.dataset.view);
  });
  const surfaceLabel = $(".admin-surface-label");
  if (surfaceLabel) surfaceLabel.textContent = role === "coach" ? "코치 운영" : "관리자 웹 전용";
  $$('[data-admin-only-member-filter]').forEach((button) => {
    button.hidden = role === "coach";
  });
  ["openDataToolsButton", "exportMembersButton", "addMemberButton", "adminPendingUsersPanel"].forEach((id) => {
    const element = $(`#${id}`);
    if (element) element.hidden = role === "coach";
  });
  applyAdminLayoutSettings();
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

function openAdminOperationalCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const request = window.indexedDB.open(adminOperationalCacheDbName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(adminOperationalCacheStoreName)) {
        database.createObjectStore(adminOperationalCacheStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
  });
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

async function restoreAdminOperationalCache() {
  try {
    const snapshot = await readAdminOperationalCache();
    if (!snapshot?.savedAt || Date.now() - Number(snapshot.savedAt) > adminOperationalCacheMaxAgeMs) return false;
    [
      [coaches, snapshot.coaches],
      [members, snapshot.members],
      [lessons, snapshot.lessons],
      [makeupRequests, snapshot.makeupRequests],
      [tickets, snapshot.tickets],
      [expiredTickets, snapshot.expiredTickets],
      [billings, snapshot.billings],
      [billingLogs, snapshot.billingLogs],
      [groupAccounts, snapshot.groupAccounts],
      [lessonNotes, snapshot.lessonNotes],
    ].forEach(([target, source]) => replaceArray(target, Array.isArray(source) ? source : []));
    invalidateMemberSearchIndex();
    Object.assign(state, {
      liveScheduleLoaded: false,
      liveScheduleLoading: true,
      liveScheduleMessage: "최근 데이터를 먼저 표시하고 최신 서버 데이터를 확인하는 중",
    });
    return true;
  } catch (error) {
    console.warn("[Tennis Note] administrator cache restore skipped", error?.message || "cache_error");
    return false;
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

function applyAdminMemberDetail(member, payload) {
  const user = payload?.user || {};
  const enrollment = payload?.enrollment || {};
  const ticket = payload?.ticket || null;
  const product = payload?.product || {};
  const coach = payload?.coach || {};
  if (!member || !user.id) return;
  Object.assign(member, {
    name: user.name || member.name,
    nickname: user.nickname || member.nickname || "",
    phone: user.phone || enrollment.phone || member.phone || "",
    birthYear: user.birth_year || enrollment.birth_year || member.birthYear || "",
    neighborhood: user.neighborhood || enrollment.neighborhood || member.neighborhood || "",
    gender: user.gender || enrollment.gender || member.gender || "",
    photoUrl: user.profile_photo_url || member.photoUrl || "",
    dominantHand: user.dominant_hand || member.dominantHand || "",
    backhandStyle: user.backhand_style || member.backhandStyle || "",
    tennisStartedOn: user.tennis_started_on || member.tennisStartedOn || "",
    selfNtrp: user.self_ntrp || member.selfNtrp || "",
    coachNtrp: user.coach_ntrp || member.coachNtrp || "",
    tennisGoal: user.tennis_goal || enrollment.lesson_goal || member.tennisGoal || "",
    playStyleMemo: user.play_style_memo || member.playStyleMemo || "",
    coach: coach.display_name || member.coach || "",
    authLinked: Boolean(user.auth_user_id || payload?.authLinks?.length),
    enrollment,
    serverDetail: payload,
  });
  const databaseRecord = payload?.databaseRecord || null;
  if (databaseRecord?.user_id) {
    const records = adminLiveDataState.memberDatabaseRecords || [];
    const recordIndex = records.findIndex((item) => String(item.user_id) === String(databaseRecord.user_id));
    if (recordIndex >= 0) records[recordIndex] = databaseRecord;
    else records.push(databaseRecord);
  }
  const ticketItems = Array.isArray(payload?.ticketItems) ? payload.ticketItems : [];
  const membershipRecord = payload?.membershipRecord || null;
  const membershipRecords = [membershipRecord, ...ticketItems.map((item) => item?.membershipRecord)].filter((record) => record?.ticket_id);
  membershipRecords.forEach((record) => {
    const records = adminLiveDataState.memberMembershipRecords || [];
    const recordIndex = records.findIndex((item) => String(item.ticket_id) === String(record.ticket_id));
    if (recordIndex >= 0) records[recordIndex] = record;
    else records.push(record);
  });
  const resolvedTicketItems = ticketItems.length
    ? ticketItems
    : ticket
      ? [{ ticket, product, coach, membershipRecord }]
      : [];
  resolvedTicketItems.forEach((item) => {
    const itemTicket = item?.ticket;
    if (!itemTicket?.id) return;
    const mappedTicket = tickets.find((candidate) => candidate.serverTicketId === itemTicket.id);
    if (!mappedTicket) return;
    const itemProduct = item?.product || {};
    const itemCoach = item?.coach || {};
    const ticketRecord = item?.membershipRecord || databaseRecord;
    Object.assign(mappedTicket, {
      total: Number(itemTicket.total_sessions) || 0,
      used: Number(itemTicket.used_sessions) || 0,
      remaining: Number(itemTicket.remaining_sessions) || 0,
      purchased: itemTicket.starts_on || mappedTicket.purchased,
      expires: itemTicket.expires_on || mappedTicket.expires,
      status: itemTicket.status || mappedTicket.status,
      product: itemProduct.name || mappedTicket.product,
      productId: itemTicket.product_id || mappedTicket.productId,
      coachRoleId: itemTicket.coach_role_id || mappedTicket.coachRoleId,
      coachId: itemCoach.id || mappedTicket.coachId,
      scheduleScope: ticketRecord?.lesson_schedule_scope || mappedTicket.scheduleScope,
      weeklyCount: Number(ticketRecord?.lesson_frequency_per_week) || mappedTicket.weeklyCount,
      lessonTypeCode: ticketRecord?.lesson_type || mappedTicket.lessonTypeCode,
      serverUpdatedAt: itemTicket.updated_at || mappedTicket.serverUpdatedAt || "",
    });
  });
}

async function loadAdminMemberDetail(member, { force = false, renderResult = true } = {}) {
  const userId = String(member?.serverUserId || "");
  if (!userId || operationsRole() !== "admin" || !window.TennisNoteDataClient?.rpc) return false;
  const current = adminMemberDetailCache.get(userId);
  if (!force && current?.status === "loaded") return true;
  if (!force && current?.promise) return current.promise;

  const requestId = Number(current?.requestId || 0) + 1;
  const entry = { status: "loading", error: "", data: null, requestId, promise: null };
  entry.promise = window.TennisNoteDataClient.rpc("tn_admin_member_detail", {
    target_user_id: userId,
  }).then((response) => {
    const latest = adminMemberDetailCache.get(userId);
    if (latest?.requestId !== requestId) return false;
    const payload = Array.isArray(response) ? response[0] : response;
    applyAdminMemberDetail(member, payload);
    Object.assign(latest, { status: "loaded", error: "", data: payload, promise: null });
    if (renderResult && state.view === "members" && state.selectedMemberId === member.id) {
      renderMembers({ preserveList: true });
    }
    return true;
  }).catch((error) => {
    const latest = adminMemberDetailCache.get(userId);
    if (latest?.requestId !== requestId) return false;
    Object.assign(latest, {
      status: "failed",
      error: String(error?.message || error || "member_detail_failed"),
      promise: null,
    });
    if (renderResult && state.view === "members" && state.selectedMemberId === member.id) {
      renderMembers({ preserveList: true });
    }
    return false;
  });
  adminMemberDetailCache.set(userId, entry);
  if (force && current?.status === "failed" && state.view === "members" && state.selectedMemberId === member.id) {
    renderMembers({ preserveList: true });
  }
  return entry.promise;
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

async function loadAdminMemberDirectoryPage({ force = false, render = true, preserveList = false } = {}) {
  if (operationsRole() !== "admin" || !window.TennisNoteDataClient?.rpc) return false;
  const signature = adminMemberDirectorySignature();
  if (!force && adminMemberDirectoryState.loaded && adminMemberDirectoryState.signature === signature) return false;

  const requestId = adminMemberDirectoryState.requestId + 1;
  Object.assign(adminMemberDirectoryState, {
    loading: true,
    error: "",
    counts: preserveList ? adminMemberDirectoryState.counts : null,
    preserveCountsWhileLoading: Boolean(preserveList && adminMemberDirectoryState.counts),
    requestId,
  });
  if (render && state.view === "members") {
    renderMembers({ preserveList });
    rememberAdminViewRender("members");
  }
  try {
    const query = JSON.parse(signature);
    const response = await window.TennisNoteDataClient.rpc("tn_admin_member_directory_page", {
      target_branch_id: query.branchId,
      target_status: query.status,
      target_search: query.search,
      target_coach_role_id: query.coachRoleId,
      target_product_kind: query.productKind,
      target_page: query.page,
      target_page_size: query.pageSize,
    });
    if (requestId !== adminMemberDirectoryState.requestId) return false;
    const payload = Array.isArray(response) ? response[0] : response;
    const directoryRows = Array.isArray(payload?.rows) ? payload.rows : [];
    directoryRows.forEach((row) => memberFromAdminDirectoryRow(row));
    Object.assign(adminMemberDirectoryState, {
      loading: false,
      loaded: true,
      error: "",
      signature,
      rows: directoryRows,
      total: Number(payload?.total) || 0,
      counts: payload?.counts && typeof payload.counts === "object"
        ? payload.counts
        : adminMemberDirectoryState.counts,
      preserveCountsWhileLoading: false,
    });
    if (render && state.view === "members") {
      renderMembers();
      rememberAdminViewRender("members");
    }
    return true;
  } catch (error) {
    if (requestId !== adminMemberDirectoryState.requestId) return false;
    Object.assign(adminMemberDirectoryState, {
      loading: false,
      loaded: false,
      error: String(error?.message || error || "member_directory_page_failed"),
      signature: "",
      counts: null,
      preserveCountsWhileLoading: false,
    });
    console.warn("[Tennis Note] member directory server paging unavailable; using local fallback", error);
    if (render && state.view === "members") {
      renderMembers();
      rememberAdminViewRender("members");
    }
    return false;
  }
}

function loadAdminDataOnce(key, loader) {
  const existing = adminLazyDataState.get(key);
  if (existing?.status === "loaded") return Promise.resolve(false);
  if (existing?.promise) return existing.promise;

  const entry = { status: "loading", promise: null };
  entry.promise = Promise.resolve()
    .then(loader)
    .then(() => {
      entry.status = "loaded";
      entry.promise = null;
      return true;
    })
    .catch((error) => {
      entry.status = "failed";
      entry.promise = null;
      console.warn(`[Tennis Note] ${key} lazy load failed`, error);
      return false;
    });
  adminLazyDataState.set(key, entry);
  return entry.promise;
}

function ensureAdminViewData(view = state.view, settingsTab = state.settingsTab) {
  if (!operationsAccessReady()) return Promise.resolve([]);
  const jobs = [];

  if (view === "members") {
    jobs.push(
      loadAdminDataOnce("member-requests", () => Promise.all([
        loadServerHoldingRequests(),
        loadServerAccountDeletionRequests(),
        loadMemberManagementPolicyFromServer(),
        loadMemberEditorModeFromServer(),
      ])),
    );
    jobs.push(loadAdminMemberDirectoryPage());
  }

  if (view === "settings") {
    if (settingsTab === "membership") {
      const branchKey = activeOperationBranchId() || "unselected";
      jobs.push(
        loadAdminDataOnce(`membership-policy:${branchKey}`, () => Promise.all([
          loadServerHoldingPolicy(),
          loadRefundPolicySettingsFromServer(),
          loadPolicyVersionsFromServer(),
          loadLessonPoliciesFromServer(),
          loadDiscountPoliciesFromServer(),
        ])),
      );
    }
    if (settingsTab === "notifications") {
      jobs.push(
        loadAdminDataOnce("notification-operations", async () => {
          await loadNotificationPolicyFromServer();
          await loadNotificationDeliveryStatus();
        }),
      );
    }
    if (settingsTab === "coach") {
      jobs.push(loadAdminDataOnce("coach-staff-detail", refreshCoachStaffData));
    }
  }

  if (view === "notes") {
    jobs.push(loadAdminDataOnce("records-support", loadAdminRecordsSupportData));
  }

  if (view === "reports") {
    jobs.push(loadAdminDriveReportSnapshot());
  }

  if (!jobs.length) return Promise.resolve([]);
  return Promise.all(jobs).then((results) => {
    if (view !== state.view || !results.some(Boolean)) return results;
    if (view === "members") {
      // The directory loader renders its own rows. Rebuilding the full inline
      // member sheet here made every menu visit render the same list twice.
      renderHoldingRequestAdminList();
      renderAccountDeletionAdminList();
    } else {
      renderAdminView(view);
    }
    return results;
  });
}

async function loadAdminRecordsSupportData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  const [curriculumRefs, journalEntries, mediaFiles, lessonRecords, participantRecords] = await Promise.all([
    client.selectRows("tn_curriculum_refs", {
      select: "id,level_label,skill_label,title,notion_url,status",
      filters: { status: "active" },
      order: "level_label.asc",
      limit: 500,
    }).catch(() => []),
    client.selectRows("tn_journal_entries", {
      select: "id,user_id,lesson_id,entry_date,entry_type,practice_type,body,created_at,updated_at",
      order: "entry_date.desc",
      limit: 500,
    }).catch(() => []),
    client.selectRows("tn_media_files", {
      select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
      order: "created_at.desc",
      limit: 1000,
    }).catch(() => []),
    client.selectRows("tn_lesson_records", {
      select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
      order: "completed_at.desc",
      limit: 500,
    }).catch(() => adminLiveDataState.lessonRecords || []),
    client.selectRows("tn_lesson_participant_records_v2", {
      select: "id,lesson_id,user_id,ticket_id,coach_role_id,outcome,record_status,deduction_requested,deducted_sessions,technique,strength,improvement,next_goal,coach_comment,feedback_keywords,next_curriculum_ref_id,member_journal_id,warning_codes,revision,finalized_at,created_at,updated_at",
      order: "updated_at.desc",
      limit: 2000,
    }).catch(() => adminLiveDataState.participantRecords || []),
  ]);
  Object.assign(adminLiveDataState, {
    curriculumRefs,
    journalEntries,
    mediaFiles,
    lessonRecords,
    participantRecords,
  });
  const loadedLessonById = new Map(
    lessons.filter((lesson) => lesson.serverLessonId).map((lesson) => [lesson.serverLessonId, lesson]),
  );
  replaceArray(lessonNotes, (lessonRecords || []).map((record) => {
    const lesson = loadedLessonById.get(record.lesson_id);
    const coachName = lesson?.coachId
      ? getCoachName(lesson.coachId)
      : coachNameForRoleId(record.coach_role_id);
    const completedDate = String(record.completed_at || "").slice(0, 10);
    return {
      id: record.id,
      serverRecordId: record.id,
      serverLessonId: record.lesson_id,
      coachRoleId: record.coach_role_id,
      member: lesson?.member || "회원 확인 필요",
      lesson: lesson
        ? `${lesson.lessonDate || completedDate} ${lesson.time || ""} ${coachName}`.trim()
        : `${completedDate || "완료일 미확인"} ${coachName}`.trim(),
      reflection: record.coach_comment || "코치 코멘트 없음",
      next: record.next_curriculum_ref_id ? "다음 커리큘럼 등록됨" : "다음 커리큘럼 미등록",
      nextCurriculumRefId: record.next_curriculum_ref_id || "",
      completedAt: record.completed_at || "",
      status: "confirmed",
      statusLabel: "확인완료",
      deductedSessions: Number(record.deducted_sessions) || 0,
    };
  }));
  return true;
}

function ensureAdminToolData(tool) {
  if (tool !== "data") return Promise.resolve([]);
  return Promise.all([
    loadAdminDataOnce("supabase-status", loadSupabaseLiveStatus),
    loadAdminDataOnce("auth-provider-status", loadAuthProviderStatus),
  ]).then((results) => {
    renderSupabaseLiveStatus();
    renderAuthProviderStatus();
    return results;
  });
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

function ensureCoachSettlementRule(coach) {
  const index = coachSettlementRules.findIndex((rule) => rule.coach === coach?.name);
  if (index >= 0) return index;
  coachSettlementRules.push(defaultCoachSettlementRule(coach));
  return coachSettlementRules.length - 1;
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

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: Array.isArray(shared.lessonLogs) ? shared.lessonLogs : [],
      feedbackRequests: Array.isArray(shared.feedbackRequests) ? shared.feedbackRequests : [],
      ntrpRequests: Array.isArray(shared.ntrpRequests) ? shared.ntrpRequests : [],
      paymentRequests: Array.isArray(shared.paymentRequests) ? shared.paymentRequests : [],
      makeupRequests: Array.isArray(shared.makeupRequests) ? shared.makeupRequests : [],
      holdingRequests: Array.isArray(shared.holdingRequests) ? shared.holdingRequests : [],
      notices: Array.isArray(shared.notices) ? shared.notices : [defaultPopupNotice],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], paymentRequests: [], makeupRequests: [], holdingRequests: [], notices: [defaultPopupNotice], noticeSource: "" };
  }
}

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

function saveSharedData(shared) {
  localStorage.setItem(sharedStorageKey, JSON.stringify(shared));
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

async function createAdminPinHash(value) {
  const pin = `${value || ""}`.trim();
  const text = `${adminPinHashVersion}:${pin}`;
  try {
    if (window.crypto?.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return `sha256:${hex}`;
    }
  } catch {
    // Local demo fallback only. Live service should verify admin auth on the server.
  }
  return fallbackAdminPinHash(pin);
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

function resetAdminSecurityDraft() {
  adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  adminSecurityModeOverride = "";
  adminSecuritySaveState.status = "idle";
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

function applyAdminSecurityMode(mode) {
  const preset = adminSecurityPresets[mode];
  if (!preset) {
    adminSecurityModeOverride = "custom";
    adminSecuritySaveState.status = "idle";
    renderAdminSecurity();
    return;
  }
  adminSecurityModeOverride = mode;
  adminSecurityDraft = {
    enabled: preset.enabled,
    timeoutMinutes: preset.timeoutMinutes,
    lockedViews: [...preset.lockedViews],
    pastAbsenceRequirePinEveryTime: preset.pastAbsenceRequirePinEveryTime,
  };
  adminSecuritySaveState.status = "idle";
  renderAdminSecurity();
}

async function loadAdminSecuritySettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !adminApprovalReady()) return false;
  try {
    const value = await client.rpc("tn_admin_security_settings");
    if (!value || typeof value !== "object") return false;
    const normalized = normalizeAdminLockSettings(value);
    Object.assign(adminLockSettings, adminSecurityConfigPayload(normalized), { pinConfigured: normalized.pinConfigured });
    adminLockSettings.pinHash = "";
    adminLockSettings.legacyPin = "";
    resetAdminSecurityDraft();
    adminSecuritySaveState = { status: "saved", savedAt: value.updatedAt || "" };
    return true;
  } catch {
    return false;
  }
}

async function saveAdminSecuritySettings() {
  const client = window.TennisNoteDataClient;
  const button = $("#saveAdminSecurityButton");
  if (!adminApprovalReady() || !client?.rpc) {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("관리자 로그인 후 보안 설정을 저장할 수 있습니다.");
    return false;
  }
  const draft = currentAdminSecurityDraft();
  if (draft.enabled && adminPinNeedsSetup()) {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("운영 PIN을 먼저 설정해 주세요.");
    return false;
  }
  const value = { ...adminSecurityConfigPayload(draft), updatedAt: new Date().toISOString() };
  if (button) button.disabled = true;
  adminSecuritySaveState.status = "saving";
  renderAdminSecurity();
  try {
    await client.rpc("tn_admin_save_security_settings_v2", {
      target_enabled: value.enabled,
      target_timeout_minutes: value.timeoutMinutes,
      target_locked_views: value.lockedViews,
      target_past_absence_require_pin_every_time: value.pastAbsenceRequirePinEveryTime,
    });
    Object.assign(adminLockSettings, value);
    resetAdminSecurityDraft();
    adminSecuritySaveState = { status: "saved", savedAt: new Date().toISOString() };
    saveSnapshot();
    renderAll();
    showToast("보안 설정을 서버에 저장했습니다.");
    return true;
  } catch {
    adminSecuritySaveState.status = "blocked";
    renderAdminSecurity();
    showToast("보안 설정 저장에 실패했습니다. 연결과 관리자 권한을 확인해 주세요.");
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

function adminPinNeedsSetup() {
  const pinHash = `${adminLockSettings.pinHash || ""}`.trim();
  const legacyPin = `${adminLockSettings.legacyPin || ""}`.trim();
  return (!pinHash && !legacyPin && !adminLockSettings.pinConfigured) || legacyPin === legacyDefaultAdminPin || legacyDefaultAdminPinHashes.has(pinHash);
}

async function verifyAdminPin(value) {
  const pin = `${value || ""}`.trim();
  if (!pin || adminPinNeedsSetup()) return false;
  if (adminLockSettings.pinHash) {
    const hash = await createAdminPinHash(pin);
    return hash === adminLockSettings.pinHash || fallbackAdminPinHash(pin) === adminLockSettings.pinHash;
  }
  const legacyPin = `${adminLockSettings.legacyPin || ""}`.trim();
  if (adminLockSettings.pinConfigured && !legacyPin) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !adminApprovalReady()) return false;
    try {
      return Boolean(await client.rpc("tn_admin_verify_security_pin", { target_pin: pin }));
    } catch {
      return false;
    }
  }
  const ok = pin === legacyPin;
  if (ok) {
    adminLockSettings.pinHash = await createAdminPinHash(pin);
    adminLockSettings.legacyPin = "";
    saveSnapshot();
  }
  return ok;
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

function closeAdminLockModal() {
  $("#adminLockModal")?.setAttribute("hidden", "");
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = null;
  const form = $("#adminLockForm");
  if (form) form.reset();
}

async function confirmAdminUnlock() {
  if (adminPinNeedsSetup()) {
    closeAdminLockModal();
    state.settingsTab = "security";
    setView("settings", { skipLock: true });
    renderSettingsTabs();
    showToast("관리자 PIN을 먼저 설정해 주세요");
    return;
  }
  const input = $("#adminPinInput");
  const value = input?.value.trim() || "";
  if (!(await verifyAdminPin(value))) {
    adminLockSession.error = "PIN이 맞지 않습니다.";
    renderAdminLockModal();
    setTimeout(() => $("#adminPinInput")?.focus(), 0);
    return;
  }
  const oneTimeAction = adminLockSession.pendingAction;
  if (oneTimeAction) {
    adminLockSession.oneTimeGrant = oneTimeAction;
    setTimeout(() => {
      if (adminLockSession.oneTimeGrant === oneTimeAction) adminLockSession.oneTimeGrant = "";
    }, 5000);
  } else {
    adminLockSession.unlockedUntil = Date.now() + adminLockSettings.timeoutMinutes * 60000;
  }
  const targetView = adminLockSession.pendingView;
  const callback = adminLockSession.afterUnlock;
  closeAdminLockModal();
  renderAdminSecurity();
  showToast(oneTimeAction ? "관리자 확인 완료" : `관리자 잠금 해제 · ${adminLockSettings.timeoutMinutes}분 유지`);
  if (callback) callback();
  else if (targetView) setView(targetView, { skipLock: true });
}

async function changeAdminPin() {
  const currentPin = $("#adminCurrentPin")?.value.trim() || "";
  const nextPin = $("#adminNewPin")?.value.trim() || "";
  const confirmPin = $("#adminConfirmPin")?.value.trim() || "";
  const initialSetup = adminPinNeedsSetup();
  if (!/^\d{6,8}$/.test(nextPin)) {
    showToast("새 PIN은 숫자 6~8자리로 설정해 주세요");
    return;
  }
  if (nextPin !== confirmPin) {
    showToast("새 PIN 확인이 맞지 않습니다");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (adminApprovalReady() && client?.rpc) {
    try {
      await client.rpc("tn_admin_set_security_pin", {
        target_current_pin: initialSetup ? "" : currentPin,
        target_new_pin: nextPin,
      });
      adminLockSettings.pinConfigured = true;
      adminLockSettings.pinHash = "";
      adminLockSettings.legacyPin = "";
    } catch {
      showToast(initialSetup ? "PIN 설정에 실패했습니다" : "현재 PIN을 확인해 주세요");
      return;
    }
  } else {
    if (!initialSetup && !(await verifyAdminPin(currentPin))) {
      showToast("현재 PIN을 확인해 주세요");
      return;
    }
    adminLockSettings.pinHash = await createAdminPinHash(nextPin);
    adminLockSettings.legacyPin = "";
    adminLockSettings.pinConfigured = false;
  }
  saveSnapshot();
  lockAdminNow();
  $("#adminSecurityPanel")?.querySelectorAll("input[type='password']").forEach((input) => {
    input.value = "";
  });
  renderAll();
  showToast("관리자 PIN 변경 완료");
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

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) {
      normalizeDemoData();
      reflectLessonPoliciesInActiveVersion();
      saveSnapshot();
      return;
    }
    if (snapshot.state) {
      const { courtCount, ...restoredState } = snapshot.state;
      Object.assign(state, restoredState);
      state.view = "dashboard";
      state.memberSearch = "";
      state.selectedMemberId = null;
      state.inlineMemberId = null;
      state.inlineMemberTicketId = "";
      state.liveScheduleLoaded = false;
      state.liveScheduleLoading = false;
      state.liveScheduleMessage = "실서버 시간표 재확인 중";
    }
    replaceArray(coaches, snapshot.coaches);
    replaceArray(members, snapshot.members);
    replaceArray(lessons, snapshot.lessons);
    replaceArray(makeupRequests, snapshot.makeupRequests);
    replaceArray(tickets, snapshot.tickets);
    replaceArray(groupAccounts, snapshot.groupAccounts);
    replaceArray(billings, snapshot.billings);
    replaceArray(billingLogs, snapshot.billingLogs);
    replaceArray(lessonNotes, snapshot.lessonNotes);
    const savedDiscountPolicies = Array.isArray(snapshot.discountPolicies) && snapshot.discountPolicies.length
      ? snapshot.discountPolicies
      : discountPolicyDefaults.map((policy) => ({ ...policy, issued: 0, used: 0 }));
    replaceArray(discountPolicies, savedDiscountPolicies.map((policy) => normalizeDiscountPolicy(policy)));
    replaceArray(discountIssueLogs, Array.isArray(snapshot.discountIssueLogs) ? snapshot.discountIssueLogs : []);
    const savedPolicyVersions = Array.isArray(snapshot.policyVersions) && snapshot.policyVersions.length
      ? snapshot.policyVersions
      : policyVersionDefaults;
    replaceArray(policyVersions, savedPolicyVersions.map((policy) => normalizePolicyVersion(policy)));
    const savedLessonPolicies = Array.isArray(snapshot.lessonPolicies)
      ? snapshot.lessonPolicies
      : lessonPolicyDefaults;
    replaceArray(lessonPolicies, savedLessonPolicies.map((policy, index) => normalizeLessonPolicy(policy, index)));
    if (snapshot.refundPolicySettings) Object.assign(refundPolicySettings, normalizeRefundPolicySettings(snapshot.refundPolicySettings));
    if (snapshot.holdingPolicySettings) Object.assign(holdingPolicySettings, snapshot.holdingPolicySettings);
    if (snapshot.notificationPolicySettings) Object.assign(notificationPolicySettings, normalizeNotificationPolicy(snapshot.notificationPolicySettings));
    if (snapshot.newCoachSettlementSettings) Object.assign(newCoachSettlementSettings, snapshot.newCoachSettlementSettings);
    replaceArray(coachSettlementRules, snapshot.coachSettlementRules);
    replaceArray(
      deletedMembershipProductIds,
      Array.isArray(snapshot.deletedMembershipProductIds) ? snapshot.deletedMembershipProductIds : [],
    );
    refreshMembershipProductDrafts(snapshot.membershipProductDrafts || snapshot.membershipProducts);
    if (snapshot.scheduleSettings) {
      scheduleSettings.openStart = snapshot.scheduleSettings.openStart || scheduleSettings.openStart;
      scheduleSettings.openEnd = snapshot.scheduleSettings.openEnd || scheduleSettings.openEnd;
      replaceArray(scheduleSettings.breakRules, snapshot.scheduleSettings.breakRules);
      replaceArray(scheduleSettings.breakFavorites, snapshot.scheduleSettings.breakFavorites || []);
      scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(snapshot.scheduleSettings.lessonColors || {}) };
      scheduleSettings.lessonColorRules = Array.isArray(snapshot.scheduleSettings.lessonColorRules) ? snapshot.scheduleSettings.lessonColorRules : [];
      scheduleSettings.memberScheduleRequestOnly = snapshot.scheduleSettings.memberScheduleRequestOnly !== false;
      scheduleSettings.adminTuningMode = snapshot.scheduleSettings.adminTuningMode === true;
    }
    replaceArray(
      operationProfiles,
      Array.isArray(snapshot.operationProfiles)
        ? snapshot.operationProfiles.map((profile, index) => normalizeOperationProfile(profile, index))
        : [],
    );
    activeOperationProfileId = snapshot.activeOperationProfileId || "";
    replaceOperationProfileBranchMap(snapshot.activeOperationProfileIdsByBranch);
    ensureOperationProfiles();
    Object.assign(adminLockSettings, normalizeAdminLockSettings(snapshot.adminLockSettings));
    const storedPolicyVersion = Number(snapshot.scheduleSettings?.coachWorkPolicyVersion) || 0;
    if (storedPolicyVersion < 2) applySchedulePreset("clubhouse-current");
    scheduleSettings.coachWorkPolicyVersion = 2;
    normalizeDemoData();
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function writeSnapshotNow() {
  if (state.snapshotStorageUnavailable) return false;
  const {
    accountDeletionRequests,
    makeupEntitlements,
    scheduleSheetPasteRows,
    selectedMemberIds,
    selectedMembershipProductIds,
    selectedSubstituteLessonIds,
    selectedScheduleLessonIds,
    selectedScheduleOpenSlots,
    ...persistedState
  } = state;
  const snapshot = {
    version: adminSnapshotVersion,
    cacheMode: "settings-only",
    state: {
      ...persistedState,
      snapshotStorageUnavailable: false,
      liveScheduleLoaded: false,
      liveScheduleLoading: false,
      liveScheduleMessage: "실서버 시간표 재확인 중",
    },
    discountPolicies,
    policyVersions,
    lessonPolicies,
    refundPolicySettings,
    holdingPolicySettings,
    notificationPolicySettings,
    newCoachSettlementSettings,
    membershipProductDrafts,
    deletedMembershipProductIds,
    membershipProducts: membershipProductsForMemberApp(),
    scheduleSettings,
    operationProfiles,
    activeOperationProfileId,
    activeOperationProfileIdsByBranch,
    adminLockSettings: serializableAdminLockSettings(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    // Remove only the replaceable admin caches. Authentication and user
    // preferences stored under other keys must remain intact.
    localStorage.removeItem(storageKey);
    localStorage.removeItem(scheduleSafetySnapshotKey);
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      state.snapshotStorageUnavailable = false;
      return true;
    } catch {
      // The local snapshot is a convenience cache only. A full browser storage
      // must never disable the live Supabase schedule connection or server saves.
      state.snapshotStorageUnavailable = true;
    }
    console.warn("Admin snapshot was not saved", error?.name || "storage_error");
    return false;
  }
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

function saveSnapshot() {
  if (state.snapshotStorageUnavailable || adminSnapshotSaveQueued) return false;
  adminSnapshotSaveQueued = true;
  const write = () => {
    adminSnapshotSaveHandle = 0;
    adminSnapshotSaveQueued = false;
    writeSnapshotNow();
  };
  if (typeof window.requestIdleCallback === "function") {
    adminSnapshotSaveHandle = window.requestIdleCallback(write, { timeout: 1000 });
  } else {
    adminSnapshotSaveHandle = window.setTimeout(write, 120);
  }
  return true;
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

function createOperationProfile(name = "기본 운영", source = null) {
  const base = source || {
    scheduleSettings: currentOperationScheduleSettings(),
    coaches: currentOperationCoachPolicies(),
  };
  return normalizeOperationProfile({
    id: `operation-profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    branchId: base.branchId || "",
    branchName: base.branchName || "",
    scheduleSettings: cloneOperationProfileValue(base.scheduleSettings),
    coaches: cloneOperationProfileValue(base.coaches),
    updatedAt: new Date().toISOString(),
  }, operationProfiles.length);
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

function markOperationProfileActiveForBranch(profile) {
  const branchId = String(profile?.branchId || "");
  if (!branchId || !profile?.id) return;
  activeOperationProfileIdsByBranch[branchId] = String(profile.id);
}

function removeOperationProfileFromBranchMap(profileId, branchId = "") {
  const normalizedProfileId = String(profileId || "");
  const normalizedBranchId = String(branchId || "");
  Object.entries(activeOperationProfileIdsByBranch).forEach(([mappedBranchId, mappedProfileId]) => {
    if (
      String(mappedProfileId) === normalizedProfileId
      && (!normalizedBranchId || mappedBranchId === normalizedBranchId)
    ) {
      delete activeOperationProfileIdsByBranch[mappedBranchId];
    }
  });
}

function ensureOperationProfiles() {
  if (!operationProfiles.length) {
    operationProfiles.push(createOperationProfile("기본 운영"));
  }
  if (!operationProfiles.some((profile) => profile.id === activeOperationProfileId)) {
    activeOperationProfileId = operationProfiles[0].id;
  }
  const fallbackBranch = defaultOperationBranch();
  if (fallbackBranch) {
    operationProfiles.forEach((profile) => {
      if (profile.branchId) return;
      profile.branchId = fallbackBranch.id;
      profile.branchName = fallbackBranch.name;
    });
  }
  Object.entries(activeOperationProfileIdsByBranch).forEach(([branchId, profileId]) => {
    const profile = operationProfiles.find((item) => (
      String(item.id) === String(profileId)
      && String(item.branchId || "") === String(branchId)
    ));
    if (!profile) delete activeOperationProfileIdsByBranch[branchId];
  });
  const globalActiveProfile = operationProfiles.find((profile) => profile.id === activeOperationProfileId);
  [...new Set(operationProfiles.map((profile) => String(profile.branchId || "")).filter(Boolean))]
    .forEach((branchId) => {
      if (activeOperationProfileIdsByBranch[branchId]) return;
      const fallbackProfile = String(globalActiveProfile?.branchId || "") === branchId
        ? globalActiveProfile
        : operationProfiles.find((profile) => String(profile.branchId || "") === branchId);
      if (fallbackProfile) activeOperationProfileIdsByBranch[branchId] = fallbackProfile.id;
    });
}

function activeOperationProfile() {
  ensureOperationProfiles();
  return operationProfiles.find((profile) => profile.id === activeOperationProfileId) || operationProfiles[0];
}

function updateActiveOperationProfileFromCurrent() {
  const profile = activeOperationProfile();
  profile.scheduleSettings = currentOperationScheduleSettings();
  profile.coaches = currentOperationCoachPolicies();
  profile.updatedAt = new Date().toISOString();
  return profile;
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

function resetOperationBranchViewState() {
  state.selectedMemberId = null;
  state.selectedMemberIds = [];
  state.selectedScheduleLessonIds = [];
  state.selectedScheduleOpenSlots = [];
  state.selectedMembershipProductIds = [];
  state.memberCoachFilter = "all";
  state.scheduleCoachFilter = "all";
  state.memberListPage = 0;
  state.memberStatusPage = 0;
  state.adminTaskPage = 0;
}

function membershipProductsForActiveOperationProfile() {
  const branchId = activeOperationBranchId();
  if (!branchId) return membershipProductDrafts;
  return membershipProductDrafts.filter((product) => !product.branchId || String(product.branchId) === branchId);
}

function applyOperationProfile(profile) {
  const normalized = normalizeOperationProfile(profile);
  scheduleSettings.openStart = normalized.scheduleSettings.openStart || scheduleSettings.openStart;
  scheduleSettings.openEnd = normalized.scheduleSettings.openEnd || scheduleSettings.openEnd;
  replaceArray(scheduleSettings.breakRules, normalized.scheduleSettings.breakRules);
  replaceArray(scheduleSettings.breakFavorites, normalized.scheduleSettings.breakFavorites);
  scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...normalized.scheduleSettings.lessonColors };
  scheduleSettings.lessonColorRules = cloneOperationProfileValue(normalized.scheduleSettings.lessonColorRules);
  scheduleSettings.coachWorkPolicyVersion = Number(normalized.scheduleSettings.coachWorkPolicyVersion) || 2;
  scheduleSettings.memberScheduleRequestOnly = normalized.scheduleSettings.memberScheduleRequestOnly !== false;
  scheduleSettings.adminTuningMode = normalized.scheduleSettings.adminTuningMode === true;
  coaches.forEach((coach) => {
    if (normalized.branchId && coach.branchId && String(coach.branchId) !== String(normalized.branchId)) return;
    const policy = normalized.coaches.find((item) => (
      (!item.branchId || !coach.branchId || String(item.branchId) === String(coach.branchId))
      && ((item.serverRoleId && item.serverRoleId === coach.serverRoleId)
      || item.id === coach.id
      || item.name === coach.name)
    ));
    if (!policy) return;
    coach.color = policy.color || coach.color;
    coach.availableDays = cloneOperationProfileValue(Array.isArray(policy.availableDays) ? policy.availableDays : []);
    coach.availableStart = policy.availableStart || "";
    coach.availableEnd = policy.availableEnd || "";
    coach.workBlocks = cloneOperationProfileValue(Array.isArray(policy.workBlocks) ? policy.workBlocks : []);
    coach.breakBlocks = cloneOperationProfileValue(Array.isArray(policy.breakBlocks) ? policy.breakBlocks : []);
  });
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

function restoreOperationProfileWorkspace(backup) {
  replaceArray(operationProfiles, backup.profiles);
  activeOperationProfileId = backup.activeId;
  replaceOperationProfileBranchMap(backup.activeIdsByBranch);
  applyOperationProfile({
    id: backup.activeId,
    name: "복원",
    scheduleSettings: backup.scheduleSettings,
    coaches: backup.coaches,
  });
}

async function persistOperationProfileWorkspace(backup, successMessage) {
  saveSnapshot();
  const synced = await syncLiveSchedulePolicyToServer();
  if (synced !== "server") {
    restoreOperationProfileWorkspace(backup);
    if (synced === "conflict") await loadLiveSchedulePolicyFromServer();
    saveSnapshot();
    renderAll();
    showToast(synced === "conflict"
      ? "다른 화면에서 설정이 변경되어 최신 운영 프로필을 다시 불러왔습니다."
      : "서버 저장에 실패해 이전 운영 프로필로 되돌렸습니다.");
    return false;
  }
  saveSnapshot();
  renderAll();
  showToast(successMessage);
  return true;
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

async function syncLiveSchedulePolicyToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token) return "local";
  const value = liveSchedulePolicyPayload();
  try {
    if (!liveSchedulePolicyServerUpdatedAt) {
      const existing = await client.selectRows("tn_admin_settings", {
        select: "key,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      });
      if (existing?.length) return "conflict";
      const inserted = await client.insertRows("tn_admin_settings", {
        key: liveSchedulePolicyKey,
        value,
      });
      liveSchedulePolicyServerUpdatedAt = inserted?.[0]?.updated_at || "";
      return "server";
    }
    const nextUpdatedAt = new Date().toISOString();
    const updated = await client.updateRows("tn_admin_settings", {
      key: liveSchedulePolicyKey,
      updated_at: liveSchedulePolicyServerUpdatedAt,
    }, {
      value,
      updated_at: nextUpdatedAt,
    });
    if (!updated?.length) {
      return "conflict";
    }
    liveSchedulePolicyServerUpdatedAt = updated[0]?.updated_at || nextUpdatedAt;
    return "server";
  } catch (error) {
    return "blocked";
  }
}

async function liveSchedulePolicyRevisionIsCurrent() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  const rows = await client.selectRows("tn_admin_settings", {
    select: "key,updated_at",
    filters: { key: liveSchedulePolicyKey },
    limit: 1,
  });
  if (!rows?.length) return !liveSchedulePolicyServerUpdatedAt;
  if (!liveSchedulePolicyServerUpdatedAt) return false;
  return String(rows[0].updated_at || "") === String(liveSchedulePolicyServerUpdatedAt);
}

async function recoverLiveSchedulePolicySave(status, rollback) {
  if (status === "server") return true;
  if (typeof rollback === "function") rollback();
  if (status === "conflict") await loadLiveSchedulePolicyFromServer();
  saveSnapshot();
  renderAll();
  showToast(status === "conflict"
    ? "다른 화면에서 설정이 변경되어 최신 내용을 다시 불러왔습니다."
    : "서버 저장에 실패해 이전 설정으로 되돌렸습니다.");
  return false;
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

function liveNoticeClient() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token) return null;
  return client;
}

function liveNoticeReadClient() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return null;
  return client;
}

async function syncPopupNoticeFromServer() {
  const client = liveNoticeReadClient();
  if (!client?.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_notice_popups", {
      select: "id,title,body,audience,priority,status,starts_on,ends_on,show_once_per_day,display_order,image_url,image_storage_path,image_alt,action_label,action_url,created_at,updated_at",
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
      renderNoticePopupSettings();
      renderDashboardNoticeSummary();
      return true;
    }
    shared.notices = notices.slice(0, 100);
    shared.noticeSource = "server";
    saveSharedData(shared);
    renderNoticePopupSettings();
    renderDashboardNoticeSummary();
    return true;
  } catch (error) {
    return false;
  }
}

async function savePopupNoticeToServer(notice) {
  const client = liveNoticeClient();
  if (!client?.insertRows || !client?.updateRows) return "local";
  const payload = appNoticeToDbRow(notice);
  try {
    if (client.rpc) {
      try {
        const result = await client.rpc("tn_admin_save_notice_popup_v2", {
          target_notice_id: isUuid(notice.id) ? notice.id : null,
          target_title: payload.title,
          target_body: payload.body,
          target_audience: payload.audience,
          target_priority: payload.priority,
          target_status: payload.status,
          target_starts_on: payload.starts_on,
          target_ends_on: payload.ends_on,
          target_show_once_per_day: payload.show_once_per_day,
          target_display_order: payload.display_order,
          target_image_url: payload.image_url,
          target_image_storage_path: payload.image_storage_path,
          target_image_alt: payload.image_alt,
          target_action_label: payload.action_label,
          target_action_url: payload.action_url,
        });
        const savedRow = Array.isArray(result) ? result[0] : result;
        if (savedRow?.id) {
          writePopupNotice(noticeRowToAppNotice(savedRow));
          return "server";
        }
      } catch (rpcError) {
        const message = String(rpcError?.message || rpcError || "");
        if (!message.includes("tn_admin_save_notice_popup_v2") && !message.includes("PGRST202")) return "blocked";
      }
    }
    let rows = [];
    if (isUuid(notice.id)) {
      rows = await client.updateRows("tn_notice_popups", { id: notice.id }, payload);
    }
    if (!rows?.length) {
      rows = await client.insertRows("tn_notice_popups", payload);
    }
    if (rows?.[0]) writePopupNotice(noticeRowToAppNotice(rows[0]));
    return "server";
  } catch (error) {
    return "blocked";
  }
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

function resetNoticeDismissals() {
  [
    "tennis-note-member-live-v1",
    "tennis-note-coach-live-v1",
    "tennis-note-member-demo-v1",
    "tennis-note-coach-demo-v1",
  ].forEach((key) => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(key) || "null");
      if (!snapshot?.state) return;
      snapshot.state.noticeHiddenDate = "";
      snapshot.state.noticeHiddenId = "";
      snapshot.state.noticeHiddenIds = [];
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      localStorage.removeItem(key);
    }
  });
}

const authUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAuthUuid(value = "") {
  return authUuidPattern.test(String(value).trim());
}

function paymentGatewayConfig() {
  try {
    return JSON.parse(localStorage.getItem(paymentConfigKey) || "{}") || {};
  } catch {
    localStorage.removeItem(paymentConfigKey);
    return {};
  }
}

function isPaymentGatewayReady() {
  const config = paymentGatewayConfig();
  return Boolean(config.storeId && config.channelKey);
}

function savePaymentGatewayConfig() {
  const storeId = $("#paymentStoreId")?.value.trim() || "";
  const channelKey = $("#paymentChannelKey")?.value.trim() || "";
  const nextConfig = {
    provider: "portone",
    storeId,
    channelKey,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(paymentConfigKey, JSON.stringify(nextConfig));
  renderServiceReadiness();
  showToast(storeId && channelKey ? "결제 연결값 저장 완료" : "결제 연결값 임시 저장 완료");
}

function clearPaymentGatewayConfig() {
  localStorage.removeItem(paymentConfigKey);
  renderServiceReadiness();
  showToast("결제 연결값 삭제 완료");
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

function refreshMembershipProductDrafts(source = []) {
  const savedProducts = Array.isArray(source) ? source : [];
  const deletedIds = new Set(deletedMembershipProductIds);
  const normalizedDefaults = membershipProductDefaults.map((defaultProduct) =>
    normalizeMembershipProduct(savedProducts.find((product) => product.id === defaultProduct.id), defaultProduct))
    .filter((product) => !deletedIds.has(product.id));
  normalizedDefaults
    .filter((product) => ["coupon-20", "coupon-30"].includes(product.id))
    .forEach((product) => {
      product.status = "hidden";
      product.rule = "기존 4회 쿠폰은 신규 판매에서 제외합니다.";
    });
  normalizedDefaults
    .filter((product) => product.id === "group-20")
    .forEach((product) => {
      product.status = "hidden";
      product.rule = "기존 8회 그룹권은 과거 이용 내역에서만 유지합니다.";
    });
  const extraProducts = savedProducts
    .filter((product) => product.id
      && !deletedIds.has(product.id)
      && !membershipProductDefaults.some((defaultProduct) => defaultProduct.id === product.id))
    .map((product) => normalizeMembershipProduct(product));
  replaceArray(membershipProductDrafts, [...normalizedDefaults, ...extraProducts]);
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

function refreshMembershipProductDraftsFromServer(source = []) {
  const products = (Array.isArray(source) ? source : [])
    .filter((product) => !String(product.product_code || "").startsWith("admin-ticket-"))
    .filter((product) => !String(product.product_code || "").startsWith("deleted-product-history-"))
    .map(membershipProductDraftFromServer)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || String(left.title || "").localeCompare(String(right.title || ""), "ko"));
  if (products.length) replaceArray(membershipProductDrafts, products);
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

async function loadServerPaymentsIntoBilling(options = {}) {
  const silent = Boolean(options.silent);
  const force = Boolean(options.force);
  if (
    !force
    && serverPaymentSyncState.loaded
    && serverPaymentSyncState.directLoaded
    && Date.now() - serverPaymentSyncState.lastLoadedAt < SERVER_PAYMENT_REFRESH_STALE_MS
  ) {
    return true;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !client.readiness?.().ready) {
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.message = "Supabase 연결값이 없어 서버 결제 기록을 불러올 수 없습니다.";
    serverPaymentSyncState.tone = "danger";
    renderBilling();
    if (!silent) showToast("Supabase 연결값 확인 필요");
    return;
  }

  serverPaymentSyncState.loading = true;
  serverPaymentSyncState.message = "서버 결제 기록을 불러오는 중입니다.";
  serverPaymentSyncState.tone = "neutral";
  renderBilling();

  try {
    const readPayments = (select) => (client.selectAllRows || client.selectRows).call(client, "tn_payments", {
      select,
      order: "created_at.desc",
      limit: 500,
      pageSize: 500,
      maxRows: 5000,
    });
    let rows = [];
    try {
      rows = await readPayments("id,branch_id,provider,provider_payment_id,product_id,ticket_id,revenue_month,revenue_month_source,revenue_attribution_status,revenue_exclusion_reason,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at,tn_users(name)");
    } catch (error) {
      try {
        rows = await readPayments("id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at,tn_users(name)");
      } catch (legacyJoinError) {
        try {
          rows = await readPayments("id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at");
        } catch (refundSchemaError) {
          rows = await readPayments("id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at");
        }
      }
    }
    const { added, updated, removed } = replaceServerPaymentRows(Array.isArray(rows) ? rows : []);
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.directLoaded = true;
    serverPaymentSyncState.lastLoadedAt = Date.now();
    serverPaymentSyncState.message = `서버 결제 ${rows.length}건 확인 · 새로 추가 ${added}건 · 갱신 ${updated}건 · 정리 ${removed}건`;
    serverPaymentSyncState.tone = "good";
    billingLogs.unshift(serverPaymentSyncState.message);
    renderAll();
    if (!silent) showToast("서버 결제 기록 불러오기 완료");
  } catch (error) {
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.message = `서버 결제 불러오기 실패: ${error?.message || "권한 또는 연결 확인 필요"}`;
    serverPaymentSyncState.tone = "danger";
    billingLogs.unshift(serverPaymentSyncState.message);
    renderAll();
    if (!silent) showToast("서버 결제 기록 확인 필요");
  } finally {
    serverPaymentSyncState.loading = false;
    renderBilling();
    saveSnapshot();
  }
}

function syncSharedPaymentRequests() {
  if (!adminDemoMode) return;
  const shared = loadSharedData();
  const incomingRequests = shared.paymentRequests || [];
  let added = 0;
  incomingRequests.forEach((request) => {
    const paymentId = request.paymentId || `${request.member}-${request.productId}-${request.requestedAt}`;
    if (!paymentId || billings.some((billing) => billing.providerPaymentId === paymentId)) return;
    const { status, statusLabel } = billingStatusFromSharedPayment(request);
    billings.unshift({
      member: request.member || "회원앱 요청",
      item: request.productTitle || request.productId || "회원권 구매",
      amount: moneyFromLabel(request.amountLabel),
      method: request.method || "회원앱",
      status,
      statusLabel,
      providerPaymentId: paymentId,
      requestedAt: request.requestedAt || new Date().toISOString(),
      source: "회원앱",
    });
    added += 1;
  });
  if (added) billingLogs.unshift(`회원앱 결제 요청 ${added}건 관리자 결제/정산 화면으로 가져옴`);
}

async function updateMembershipProductSetting(productId, options = {}) {
  const refreshAfterSave = options.refreshAfterSave !== false;
  const card = document.querySelector(`[data-product-card="${productId}"]`);
  const product = membershipProductDrafts.find((item) => item.id === productId);
  if (!card || !product) return;
  const fieldElement = (field) => card.querySelector(`[data-product-field="${field}"]`);
  const readField = (field) => fieldElement(field)?.value.trim() || "";
  const ticketValue = numericValue(readField("tickets"), product.tickets);
  const nextProduct = membershipProductWithOperationalLimits(normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || (fieldElement("tickets") ? `${ticketValue}회` : product.sessions),
    settlementBase: undefined,
    tickets: ticketValue,
    cardAmount: numericValue(readField("cardAmount"), product.cardAmount),
    cashAmount: numericValue(readField("cashAmount"), product.cashAmount),
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
    firstLessonOfferEnabled: fieldElement("firstLessonOfferEnabled")
      ? readField("firstLessonOfferEnabled") === "yes"
      : product.firstLessonOfferEnabled,
    firstLessonOfferPrice: fieldElement("firstLessonOfferPrice")
      ? numericValue(readField("firstLessonOfferPrice"), product.firstLessonOfferPrice)
      : product.firstLessonOfferPrice,
    status: readField("status") || product.status,
  }, membershipProductDefaults.find((item) => item.id === product.id)));

  const settlementBase = numericValue(nextProduct.settlementBase, nextProduct.cashAmount);

  const requiredFields = [
    { key: "title", label: "상품명", value: nextProduct.title },
    { key: "sessions", label: "횟수 표기", value: String(nextProduct.sessions || "").trim() },
    { key: "cashAmount", label: "현금가격", value: Number(nextProduct.cashAmount) },
    { key: "cardAmount", label: "카드가격", value: Number(nextProduct.cardAmount) },
    { key: "validityDays", label: "사용기간", value: Number(nextProduct.validityDays) },
    { key: "tickets", label: "충전 횟수", value: Number(nextProduct.tickets) },
    { key: "frequencyPerWeek", label: "주 횟수", value: Number(nextProduct.frequencyPerWeek) },
    { key: "maxSessionsPerDay", label: "하루 최대 사용 회차", value: Number(nextProduct.maxSessionsPerDay) },
    { key: "maxSessionsPerWeek", label: "주간 최대 사용 회차", value: Number(nextProduct.maxSessionsPerWeek) },
    { key: "maxBookingDaysPerWeek", label: "주간 예약 가능 일수", value: Number(nextProduct.maxBookingDaysPerWeek) },
  ];
  const missingRequired = requiredFields.filter((field) => Number(field.value) <= 0 || String(field.value).trim() === "");
  if (missingRequired.length > 0) {
    const firstMissing = requiredFields.find((field) => Number(field.value) <= 0 || String(field.value).trim() === "");
    if (firstMissing) showToast(`${firstMissing.label}를 확인해 주세요.`);
    return;
  }
  if (![20, 30, 40].includes(Number(nextProduct.lessonMinutes))) {
    showToast("수업 시간은 20분, 30분 또는 40분으로 설정해 주세요.");
    return;
  }
  if (Number(nextProduct.maxSessionsPerDay) > Number(nextProduct.maxSessionsPerWeek)) {
    showToast("하루 최대 사용 회차는 주간 최대 사용 회차보다 클 수 없습니다.");
    return;
  }
  if (Number(nextProduct.maxBookingDaysPerWeek) > Number(nextProduct.maxSessionsPerWeek)) {
    showToast("주간 예약 가능 일수는 주간 최대 사용 회차보다 클 수 없습니다.");
    return;
  }
  if (nextProduct.firstLessonOfferEnabled === true
    && (!Number(nextProduct.firstLessonOfferPrice)
      || Number(nextProduct.firstLessonOfferPrice) >= Number(nextProduct.cardAmount))) {
    showToast("첫 수업가는 1원 이상, 카드 정상가보다 낮게 입력해 주세요.");
    return;
  }
  const saleIssue = couponProductSaleIssue(nextProduct);
  if (saleIssue && nextProduct.status === "sale") nextProduct.status = "hidden";
  const client = window.TennisNoteDataClient;
  const serverProduct = serverMembershipProductForDraft(product);
  const branchId = activeOperationBranchId();
  const saveButton = card.querySelector("[data-save-product-setting]");
  if (!client?.rpc || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 회원권 상품을 저장해 주세요.");
    return;
  }
  if (!serverProduct?.id) {
    showToast("실서버 상품을 찾지 못했습니다. 새로고침 후 다시 저장해 주세요.");
    return;
  }
  if (!branchId || String(serverProduct.branch_id || "") !== branchId) {
    showToast("현재 운영 지점의 회원권 상품만 수정할 수 있습니다.");
    return;
  }
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중";
  }
  try {
    const serverKind = nextProduct.productKind === "coupon" ? "coupon" : "regular";
    await client.rpc("tn_admin_bulk_membership_product_action", {
      target_branch_id: branchId,
      target_action: "save",
      target_products: [membershipProductServerSavePayload(nextProduct, serverProduct)],
      target_reason: "관리자 회원권 상품 행 저장",
    });
    if (!refreshAfterSave) {
      return {
        productId,
        serverId: serverProduct.id,
        expected: nextProduct,
        expectedKind: serverKind,
        expectedSettlementBase: settlementBase,
      };
    }
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => item.id === serverProduct.id);
    if (!saved
      || String(saved.branch_id || "") !== branchId
      || saved.name !== nextProduct.title
      || Number(saved.total_sessions) !== Number(nextProduct.tickets)
      || Number(saved.lesson_minutes) !== Number(nextProduct.lessonMinutes)
      || Number(saved.group_size) !== Number(nextProduct.groupSize)
      || Number(saved.max_sessions_per_day || 0) !== Number(nextProduct.maxSessionsPerDay || 0)
      || Number(saved.max_sessions_per_week || 0) !== Number(nextProduct.maxSessionsPerWeek || 0)
      || Number(saved.max_booking_days_per_week || 0) !== Number(nextProduct.maxBookingDaysPerWeek || 0)
      || saved.schedule_scope !== nextProduct.scheduleScope
      || saved.product_kind !== serverKind
      || String(saved.policy_settings?.adminSaleStatus || "") !== String(nextProduct.status)
      || String(saved.policy_settings?.purchaseExperience || "") !== String(nextProduct.purchaseExperience || "")
      || Boolean(saved.policy_settings?.firstLessonOfferEnabled) !== Boolean(nextProduct.firstLessonOfferEnabled)
      || Number(saved.policy_settings?.firstLessonOfferPrice || 0) !== Number(nextProduct.firstLessonOfferPrice || 0)
      || Boolean(saved.is_active) !== (nextProduct.status !== "hidden")
      || Number(saved.card_price) !== Number(nextProduct.cardAmount)
      || Number(saved.cash_price) !== Number(nextProduct.cashAmount)
      || Number(saved.settlement_base_price) !== Number(settlementBase)) {
      throw new Error("membership_product_write_not_confirmed");
    }
    saveSnapshot();
    renderServiceReadiness();
    showToast(saleIssue ? `${saleIssue} 판매 상태는 숨김으로 저장했습니다.` : "회원권 상품이 회원 등록 화면까지 반영됐습니다.");
    return true;
  } catch (error) {
    const raw = `${error?.message || ""}`;
    showToast(raw.includes("admin_live_refresh_failed_after_write")
      ? "상품은 저장됐지만 다시 불러오지 못했습니다. 새로고침해 주세요."
      : "회원권 상품 저장에 실패했습니다. 서버 연결과 관리자 권한을 확인해 주세요.");
    return false;
  } finally {
    if (saveButton?.isConnected) {
      saveButton.disabled = false;
      saveButton.textContent = "저장";
    }
  }
}

function setProductInlineDirtyState(form, dirty = true) {
  if (!form) return;
  form.dataset.dirty = dirty ? "true" : "false";
  form.classList.toggle("is-dirty", dirty);
  form.classList.remove("is-save-error", "is-save-success");
  const message = form.querySelector(".product-inline-message");
  if (message) message.textContent = dirty ? "변경됨" : "";
  const saveAllButton = $("#saveVisibleProductRows");
  if (saveAllButton) {
    saveAllButton.hidden = !document.querySelector('[data-product-inline-form][data-dirty="true"]');
  }
}

async function saveVisibleProductRows() {
  const forms = [...document.querySelectorAll('[data-product-inline-form][data-dirty="true"]')];
  const button = $("#saveVisibleProductRows");
  if (operationsRole() !== "admin" || !forms.length) {
    showToast(forms.length ? "관리자 로그인 후 저장해 주세요." : "변경된 상품이 없습니다.");
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = `저장 중 0/${forms.length}`;
  }
  const results = [];
  let failed = 0;
  for (let index = 0; index < forms.length; index += 1) {
    const form = forms[index];
    const result = await updateMembershipProductSetting(form.dataset.productInlineForm, { refreshAfterSave: false });
    if (result) results.push({ form, result });
    else {
      failed += 1;
      form.classList.add("is-save-error");
      const message = form.querySelector(".product-inline-message");
      if (message) message.textContent = "저장 실패";
    }
    if (button) button.textContent = `저장 중 ${index + 1}/${forms.length}`;
  }
  if (results.length) {
    const synced = await syncAdminLiveData();
    if (!synced) {
      failed += results.length;
      results.forEach(({ form }) => {
        form.classList.add("is-save-error");
        const message = form.querySelector(".product-inline-message");
        if (message) message.textContent = "서버 재확인 실패";
      });
    } else {
      results.forEach(({ form, result }) => {
        if (!savedMembershipProductMatches(result)) {
          failed += 1;
          form.classList.add("is-save-error");
          const message = form.querySelector(".product-inline-message");
          if (message) message.textContent = "저장 확인 필요";
          return;
        }
        setProductInlineDirtyState(form, false);
        form.classList.add("is-save-success");
        const message = form.querySelector(".product-inline-message");
        if (message) message.textContent = "저장 완료";
      });
    }
  }
  if (!failed) {
    renderServiceReadiness();
    showToast(`${forms.length}개 상품 저장·서버 확인 완료`);
  } else {
    showToast(`${forms.length - failed}개 저장 완료 · ${failed}개 확인 필요`);
  }
  if (button?.isConnected) {
    button.disabled = false;
    button.textContent = "현재 페이지 전체 저장";
    button.hidden = !document.querySelector('[data-product-inline-form][data-dirty="true"]');
  }
}

async function createMembershipProductSetting(options = {}) {
  const oneDay = options.preset === "one_day";
  const client = window.TennisNoteDataClient;
  if (!client?.insertRows || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 새 회원권을 만들 수 있습니다.");
    return;
  }
  const branchId = activeOperationBranchId() || defaultOperationBranch()?.id || null;
  if (!branchId) {
    showToast("지점 정보를 찾지 못했습니다. 서버 데이터를 새로고침해 주세요.");
    return;
  }
  const button = $(oneDay ? "#addOneDayProductButton" : "#addMembershipProductButton");
  if (button) {
    button.disabled = true;
    button.textContent = "만드는 중";
  }
  try {
    const productCode = `${oneDay ? "one-day" : "custom"}-${Date.now()}`;
    const rows = await client.insertRows("tn_membership_products", {
      branch_id: branchId,
      product_code: productCode,
      name: oneDay ? "원데이 1회권" : "새 회원권",
      lesson_minutes: 20,
      frequency_per_week: 1,
      max_sessions_per_day: 1,
      max_sessions_per_week: 1,
      max_booking_days_per_week: 1,
      total_sessions: oneDay ? 1 : 4,
      group_size: 1,
      product_kind: oneDay ? "coupon" : "regular",
      is_coupon: oneDay,
      is_active: false,
      schedule_scope: oneDay ? "mixed" : "weekday",
      term_weeks: 0,
      validity_days: oneDay ? 30 : 35,
      grace_days: oneDay ? 0 : 7,
      base_price: oneDay ? 40000 : 0,
      card_price: oneDay ? 44000 : 0,
      cash_price: oneDay ? 40000 : 0,
      settlement_base_price: oneDay ? 40000 : 0,
      discount_enabled: true,
      coach_discount_allowed: false,
      display_order: Math.max(0, ...membershipProductsForActiveOperationProfile().map((item) => Number(item.sortOrder) || 0)) + 10,
      policy_settings: {
        adminSaleStatus: "hidden",
        countLabel: oneDay ? "1회" : "4회",
        ...(oneDay ? {
          purchaseExperience: "one_day",
          firstLessonOfferEnabled: true,
          firstLessonOfferPrice: 15000,
        } : {}),
      },
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("membership_product_create_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const created = membershipProductDrafts.find((item) => item.serverProductCode === productCode || item.id === productCode);
    state.membershipProductSearch = "";
    state.membershipProductStatusFilter = "all";
    state.activeMembershipProductId = created ? String(created.id) : "";
    renderServiceReadiness();
    const card = created ? document.querySelector(`[data-product-card="${CSS.escape(created.id)}"]`) : null;
    if (card) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      card.querySelector('[data-product-field="title"]')?.focus();
    }
    showToast(oneDay
      ? "원데이 1회권 초안을 만들었습니다. 카드 44,000원·현금 40,000원·첫 수업 15,000원을 확인한 뒤 판매 상태를 변경해 주세요."
      : "새 회원권을 만들었습니다. 내용을 입력한 뒤 판매 상태를 변경해 주세요.");
  } catch {
    showToast("새 회원권 생성에 실패했습니다. 관리자 권한과 서버 연결을 확인해 주세요.");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = oneDay ? "원데이 1회권" : "새 회원권";
    }
  }
}

async function moveMembershipProductSetting(productId, direction) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 회원권 순서를 변경할 수 있습니다.");
    return;
  }
  const visibleProducts = membershipProductsForActiveOperationProfile();
  const currentIndex = visibleProducts.findIndex((item) => item.id === productId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleProducts.length) return;
  const nextOrder = [...visibleProducts];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  const serverProducts = nextOrder.map((item) => serverMembershipProductForDraft(item));
  if (serverProducts.some((item) => !item?.id)) {
    showToast("상품 정보를 다시 불러온 뒤 순서를 변경해 주세요.");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !operationsAccessReady()) {
    showToast("서버 연결 후 순서를 변경해 주세요.");
    return;
  }
  const previousDraftOrder = membershipProductDrafts.map((item) => ({ ...item }));
  const branchPositions = membershipProductDrafts
    .map((item, index) => visibleProducts.includes(item) ? index : -1)
    .filter((index) => index >= 0);
  branchPositions.forEach((position, index) => {
    membershipProductDrafts[position] = nextOrder[index];
    membershipProductDrafts[position].sortOrder = (index + 1) * 10;
  });
  renderServiceReadiness();
  try {
    await client.rpc("tn_admin_reorder_membership_products", {
      target_branch_id: serverProducts[0].branch_id,
      target_product_ids: serverProducts.map((item) => item.id),
    });
    const savedOrder = new Map(serverProducts.map((item, index) => [String(item.id), (index + 1) * 10]));
    (adminLiveDataState.products || []).forEach((item) => {
      if (savedOrder.has(String(item.id))) item.display_order = savedOrder.get(String(item.id));
    });
    saveSnapshot();
    showToast("회원권 순서를 변경했습니다.");
  } catch {
    replaceArray(membershipProductDrafts, previousDraftOrder);
    renderServiceReadiness();
    showToast("회원권 순서 변경에 실패했습니다. 서버 권한을 확인해 주세요.");
  }
}

async function updateMembershipProductQuickStatus(productId, nextStatus, control) {
  const allowedStatus = membershipProductStatusOptions.some((option) => option.id === nextStatus);
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  const serverProduct = serverMembershipProductForDraft(product);
  const previousStatus = normalizeMembershipProduct(product || {}).status;
  if (!allowedStatus || !product || !serverProduct?.id) {
    if (control) control.value = previousStatus;
    showToast("상품 정보를 다시 불러온 뒤 판매 상태를 변경해 주세요.");
    return false;
  }
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    if (control) control.value = previousStatus;
    showToast("관리자 로그인 후 판매 상태를 변경해 주세요.");
    return false;
  }
  if (String(serverProduct.branch_id || "") !== String(activeOperationBranchId() || "")) {
    if (control) control.value = previousStatus;
    showToast("현재 지점의 상품만 변경할 수 있습니다.");
    return false;
  }
  if (control) control.disabled = true;
  try {
    const rows = await window.TennisNoteDataClient.updateRows("tn_membership_products", {
      id: serverProduct.id,
      branch_id: serverProduct.branch_id,
    }, {
      is_active: nextStatus !== "hidden",
      policy_settings: {
        ...(serverProduct.policy_settings || {}),
        adminSaleStatus: nextStatus,
      },
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("membership_product_status_write_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => String(item.id) === String(serverProduct.id));
    if (!saved
      || Boolean(saved.is_active) !== (nextStatus !== "hidden")
      || String(saved.policy_settings?.adminSaleStatus || "") !== nextStatus) {
      throw new Error("membership_product_status_write_not_confirmed");
    }
    renderServiceReadiness();
    showToast(`판매 상태를 ${membershipProductStatusOptions.find((option) => option.id === nextStatus)?.label || nextStatus}(으)로 변경했습니다.`);
    return true;
  } catch {
    if (control?.isConnected) {
      control.value = previousStatus;
      control.disabled = false;
    }
    showToast("판매 상태 저장에 실패했습니다. 서버 상태를 다시 확인해 주세요.");
    return false;
  }
}

async function forceDeleteMembershipProductSetting(productId) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 회원권 상품을 강제 삭제할 수 있습니다.");
    return;
  }
  const product = membershipProductDrafts.find((item) => item.id === productId);
  if (!product) return;
  const reason = "관리자 회원권 상품 강제 삭제";
  if (!window.confirm(
    `회원권 상품을 강제 삭제할까요?\n\n${product.title || product.name}\n\n기존 회원권은 삭제 상품 기록으로 연결되고 결제 증빙은 유지됩니다.`,
  )) return;

  const serverProduct = serverMembershipProductForDraft(product);
  try {
    if (serverProduct?.id) {
      const branchId = activeOperationBranchId();
      if (!branchId || String(serverProduct.branch_id || "") !== branchId) {
        throw new Error("membership_product_branch_mismatch");
      }
      const client = window.TennisNoteDataClient;
      if (!client?.rpc || !operationsAccessReady()) throw new Error("admin_live_connection_required");
      await client.rpc("tn_admin_force_delete_membership_product", {
        target_product_id: serverProduct.id,
        target_reason: reason,
      });
    }
    if (!deletedMembershipProductIds.includes(product.id)) deletedMembershipProductIds.push(product.id);
    const index = membershipProductDrafts.findIndex((item) => item.id === product.id);
    if (index >= 0) membershipProductDrafts.splice(index, 1);
    if (String(state.activeMembershipProductId) === String(product.id)) state.activeMembershipProductId = "";
    saveSnapshot();
    if (serverProduct?.id) {
      const serverIndex = (adminLiveDataState.products || [])
        .findIndex((item) => String(item.id) === String(serverProduct.id));
      if (serverIndex >= 0) adminLiveDataState.products.splice(serverIndex, 1);
    }
    renderServiceReadiness();
    showToast("회원권 상품 강제 삭제 완료");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    showToast(raw.includes("tn_admin_force_delete_membership_product") || raw.includes("PGRST202")
        ? "회원권 강제 삭제 DB 패치를 먼저 적용해 주세요."
        : "회원권 상품 강제 삭제에 실패했습니다.");
  }
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
  const nextProduct = membershipProductWithOperationalLimits(normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || `${ticketValue}회`,
    tickets: ticketValue,
    cardAmount: numericValue(readField("cardAmount"), product.cardAmount),
    cashAmount: numericValue(readField("cashAmount"), product.cashAmount),
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

async function runProductBulkAction(forcedAction = "") {
  const selected = membershipProductsForActiveOperationProfile().filter((product) => selectedProductIdSet().has(String(product.id)));
  const action = forcedAction || $("#productBulkAction")?.value || "";
  if (!selected.length || !action) {
    showToast("회원권 상품과 일괄 작업을 선택해 주세요.");
    return;
  }
  const labels = {
    save: "선택 저장",
    delete: "선택 삭제",
    sale: "판매중",
    hidden: "숨김",
    consult: "상담",
  };
  const label = labels[action] || $("#productBulkAction")?.selectedOptions?.[0]?.textContent || "일괄 작업";
  if (!window.confirm(`${selected.length}개 상품을 '${label}' 처리할까요?`)) return;
  const button = action === "save"
    ? $("#saveSelectedProducts")
    : action === "delete"
      ? $("#deleteSelectedProducts")
      : $("#runProductBulkAction");
  if (button) button.disabled = true;
  try {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || operationsRole() !== "admin" || !operationsAccessReady()) throw new Error("admin_required");
    const branchId = activeOperationBranchId();
    if (!branchId) throw new Error("active_branch_required");
    const payload = action === "save"
      ? selected.map(membershipProductBulkSavePayload)
      : selected.map((product) => {
        const serverProduct = serverMembershipProductForDraft(product);
        if (!serverProduct?.id || String(serverProduct.branch_id || "") !== branchId) {
          throw new Error("membership_product_server_mapping_required");
        }
        return { id: serverProduct.id };
      });
    await client.rpc("tn_admin_bulk_membership_product_action", {
      target_branch_id: branchId,
      target_action: action,
      target_products: payload,
      target_reason: action === "delete" ? "관리자 회원권 상품 선택 삭제" : `관리자 회원권 상품 ${label}`,
    });
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const savedIds = new Set((adminLiveDataState.products || []).map((product) => String(product.id)));
    if (action === "delete" && payload.some((item) => savedIds.has(String(item.id)))) {
      throw new Error("membership_product_delete_not_confirmed");
    }
    if (action === "save") {
      payload.forEach((item) => {
        const saved = (adminLiveDataState.products || []).find((product) => String(product.id) === String(item.id));
        if (!saved
          || saved.name !== item.name
          || Number(saved.total_sessions) !== item.totalSessions
          || Number(saved.lesson_minutes) !== item.lessonMinutes
          || Number(saved.group_size) !== item.groupSize
          || String(saved.policy_settings?.adminSaleStatus || "") !== item.status) {
          throw new Error("membership_product_bulk_save_not_confirmed");
        }
      });
    }
    if (["sale", "hidden", "consult"].includes(action)) {
      payload.forEach((item) => {
        const saved = (adminLiveDataState.products || []).find((product) => String(product.id) === String(item.id));
        if (!saved || String(saved.policy_settings?.adminSaleStatus || "") !== action) {
          throw new Error("membership_product_status_write_not_confirmed");
        }
      });
    }
    state.selectedMembershipProductIds = [];
    saveSnapshot();
    renderServiceReadiness();
    showToast(`${selected.length}개 상품 ${label}·서버 확인 완료`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    showToast(raw.includes("membership_product_invalid")
      ? "선택한 상품의 필수값과 횟수·기간·가격을 확인해 주세요."
      : raw.includes("PGRST202") || raw.includes("tn_admin_bulk_membership_product_action")
        ? "회원권 다중 작업 DB 기능을 먼저 적용해 주세요."
        : "회원권 상품 다중 작업에 실패했습니다. 서버에서 변경되지 않았습니다.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function loadLiveSchedulePolicyFromServer(preloadedRow = undefined) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  try {
    const rows = preloadedRow === undefined
      ? await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      })
      : preloadedRow ? [preloadedRow] : [];
    if (!rows?.length) {
      liveSchedulePolicyServerUpdatedAt = "";
      return false;
    }
    liveSchedulePolicyServerUpdatedAt = rows[0]?.updated_at || "";
    const value = rows?.[0]?.value;
    if (!value || typeof value !== "object") return false;
    const serverSettings = value.scheduleSettings || {};
    if (serverSettings.openStart) scheduleSettings.openStart = serverSettings.openStart;
    if (serverSettings.openEnd) scheduleSettings.openEnd = serverSettings.openEnd;
    if (Array.isArray(serverSettings.breakRules)) replaceArray(scheduleSettings.breakRules, serverSettings.breakRules);
    if (Array.isArray(serverSettings.breakFavorites)) replaceArray(scheduleSettings.breakFavorites, serverSettings.breakFavorites);
    scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(serverSettings.lessonColors || {}) };
    scheduleSettings.lessonColorRules = Array.isArray(serverSettings.lessonColorRules) ? serverSettings.lessonColorRules : scheduleSettings.lessonColorRules;
    scheduleSettings.coachWorkPolicyVersion = Number(serverSettings.coachWorkPolicyVersion) || 2;
    scheduleSettings.memberScheduleRequestOnly = serverSettings.memberScheduleRequestOnly !== false;
    scheduleSettings.adminTuningMode = serverSettings.adminTuningMode === true;
    const useProfileCoachTemplate = !state.liveScheduleLoaded;
    (Array.isArray(value.coaches) ? value.coaches : []).forEach((serverCoach) => {
      const coach = coaches.find((item) => (
        (!serverCoach.branchId || !item.branchId || String(item.branchId) === String(serverCoach.branchId))
        && ((serverCoach.serverRoleId && item.serverRoleId === serverCoach.serverRoleId)
        || item.id === serverCoach.id
        || item.name === serverCoach.name)
      ));
      if (!coach) return;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.workBlocks)) coach.workBlocks = serverCoach.workBlocks;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.breakBlocks)) coach.breakBlocks = serverCoach.breakBlocks;
      if (useProfileCoachTemplate && Array.isArray(serverCoach.availableDays)) coach.availableDays = serverCoach.availableDays;
      if (useProfileCoachTemplate && serverCoach.availableStart) coach.availableStart = serverCoach.availableStart;
      if (useProfileCoachTemplate && serverCoach.availableEnd) coach.availableEnd = serverCoach.availableEnd;
      if (serverCoach.color) coach.color = serverCoach.color;
    });
    replaceArray(
      operationProfiles,
      Array.isArray(value.operationProfiles)
        ? value.operationProfiles.map((profile, index) => normalizeOperationProfile(profile, index))
        : [],
    );
    activeOperationProfileId = value.activeOperationProfileId || "";
    replaceOperationProfileBranchMap(value.activeOperationProfileIdsByBranch);
    ensureOperationProfiles();
    updateActiveOperationProfileFromCurrent();
    localStorage.setItem(storageKey, JSON.stringify({
      ...(JSON.parse(localStorage.getItem(storageKey) || "{}")),
      coaches,
      scheduleSettings,
      operationProfiles,
      activeOperationProfileId,
      activeOperationProfileIdsByBranch,
    }));
    return true;
  } catch {
    return false;
  }
}

async function saveLiveSchedulePolicy() {
  const client = window.TennisNoteDataClient;
  const button = $("#saveLiveSchedulePolicyButton");
  if (!adminApprovalReady() || !client?.rpc) {
    showToast("관리자 로그인 후 근무·브레이크를 저장할 수 있습니다.");
    return;
  }
  const branchId = activeOperationBranchId();
  if (!branchId) {
    showToast("운영 프로필에서 지점을 먼저 선택해주세요.");
    return;
  }
  const serverCoaches = operationBranchCoaches().filter((coach) => (
    coach.serverRoleId && String(coach.branchId || "") === branchId
  ));
  if (!serverCoaches.length) {
    showToast(`${activeOperationBranchName()}에 등록된 코치를 먼저 확인해주세요.`);
    return;
  }
  try {
    if (!(await liveSchedulePolicyRevisionIsCurrent())) {
      await loadLiveSchedulePolicyFromServer();
      renderAll();
      saveSnapshot();
      showToast("다른 화면에서 설정이 변경되어 최신 내용을 다시 불러왔습니다.");
      return;
    }
  } catch (error) {
    showToast("최신 운영 설정을 확인하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.");
    return;
  }
  const targetCoaches = serverCoaches.map((coach) => {
    const targetedBreaks = (scheduleSettings.breakRules || [])
      .filter((rule) => breakRuleCoachRoleIds(rule).includes(coach.serverRoleId))
      .map((rule) => ({
        days: (rule.days || []).map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: rule.start,
        endTime: rule.end,
        label: rule.label || "브레이크",
        availabilityType: "blocked",
      }));
    const blocks = (coach.status || "active") === "active" ? [
      ...normalizeCoachWorkBlocks(coach).map((block) => ({
        days: block.days.map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: block.start,
        endTime: block.end,
        label: block.label || "근무",
        availabilityType: "available",
      })),
      ...normalizeCoachBreakBlocks(coach).map((block) => ({
        days: block.days.map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: block.start,
        endTime: block.end,
        label: block.label || "브레이크",
        availabilityType: "blocked",
      })),
      ...targetedBreaks,
    ] : [];
    const uniqueBlocks = [...new Map(blocks.map((block) => [`${block.availabilityType}|${block.days.join(",")}|${block.startTime}|${block.endTime}|${block.label}`, block])).values()];
    return { coachRoleId: coach.serverRoleId, workBlocks: uniqueBlocks };
  });
  const targetBreakRules = (scheduleSettings.breakRules || []).filter((rule) => !breakRuleCoachRoleIds(rule).length).map((rule) => ({
    days: (rule.days || []).map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
    startTime: rule.start,
    endTime: rule.end,
    label: rule.label || "브레이크타임",
  }));

  if (button) {
    button.disabled = true;
    button.textContent = "저장 중";
  }
  try {
    const result = await client.rpc("tn_admin_replace_schedule_policy", {
      target_branch_id: branchId,
      target_coaches: targetCoaches,
      target_break_rules: targetBreakRules,
    });
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "server" || snapshotStatus === "conflict") {
      await loadLiveSchedulePolicyFromServer();
    }
    renderSchedule();
    renderScheduleSettings();
    saveSnapshot();
    billingLogs.unshift(`근무·브레이크 서버 저장: 근무 ${result?.availabilityCount || 0}개 · 브레이크 ${result?.breakCount || 0}개`);
    if (snapshotStatus === "server") {
      showToast("근무시간과 브레이크 저장 완료");
    } else if (snapshotStatus === "conflict") {
      billingLogs.unshift("다른 화면의 운영 설정과 충돌해 최신 설정을 다시 불러옴");
      showToast("근무시간은 저장됐지만 표시 설정이 충돌해 최신 내용을 다시 불러왔습니다.");
    } else {
      billingLogs.unshift("앱 시간표 표시 설정 동기화 재시도 필요");
      showToast("근무시간은 저장됐습니다. 앱 표시 동기화를 다시 시도해 주세요.");
    }
  } catch (error) {
    showToast(`근무·브레이크 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "근무·브레이크 저장";
    }
  }
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

async function syncRefundPolicySettingsToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || adminImportAuthState.profile?.role !== "admin") {
    return "local";
  }
  const value = {
    ...normalizeRefundPolicySettings(refundPolicySettings),
    updatedAt: new Date().toISOString(),
  };
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: "refund_policy" }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) {
      await client.insertRows("tn_admin_settings", { key: "refund_policy", value });
    }
    return "server";
  } catch {
    return "blocked";
  }
}

async function loadRefundPolicySettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: "refund_policy" },
      limit: 1,
    });
    if (!rows?.[0]?.value) return false;
    Object.assign(refundPolicySettings, normalizeRefundPolicySettings(rows[0].value));
    reflectRefundPolicyInActiveVersion();
    saveSnapshot();
    renderRefundPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
}

async function saveRefundPolicySettings() {
  Object.assign(refundPolicySettings, normalizeRefundPolicySettings({
    penaltyRate: $("#refundPenaltyRate")?.value,
    reservationFee: $("#refundReservationFee")?.value,
    memo: $("#refundPolicyMemo")?.value,
  }));
  reflectRefundPolicyInActiveVersion();
  const syncTarget = await syncRefundPolicySettingsToServer();
  const policySyncTarget = await syncPolicyVersionsToServer();
  billingLogs.unshift(`환불정책 저장: 할인 전 원가 기준 위약금 ${refundPolicySettings.penaltyRate}%`);
  saveSnapshot();
  renderRefundPolicySettings();
  renderPolicyVersionSettings();
  showToast(syncTarget === "server" && policySyncTarget !== "blocked" ? "환불정책 서버 저장 완료" : syncTarget === "blocked" || policySyncTarget === "blocked" ? "로컬 저장 완료 · 서버 저장 확인 필요" : "환불정책 로컬 저장 완료");
}

async function resetRefundPolicySettings() {
  Object.assign(refundPolicySettings, normalizeRefundPolicySettings());
  reflectRefundPolicyInActiveVersion();
  const syncTarget = await syncRefundPolicySettingsToServer();
  const policySyncTarget = await syncPolicyVersionsToServer();
  billingLogs.unshift("환불정책 기본값 복원");
  saveSnapshot();
  renderRefundPolicySettings();
  renderPolicyVersionSettings();
  showToast(syncTarget === "blocked" || policySyncTarget === "blocked" ? "기본값 복원 완료 · 서버 저장 확인 필요" : "환불정책 기본값 복원 완료");
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

async function syncLessonPoliciesToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || !adminApprovalReady()) return "local";
  const value = lessonPolicyPayload();
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: lessonPolicySettingsKey }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) await client.insertRows("tn_admin_settings", { key: lessonPolicySettingsKey, value });
    return "server";
  } catch {
    return "blocked";
  }
}

async function persistLessonPolicies(message, allLessonPolicies = lessonPolicies) {
  allLessonPolicies.forEach((policy, index) => {
    policy.order = index;
  });
  reflectLessonPoliciesInActiveVersion();
  saveSnapshot();
  renderLessonPolicySettings();
  renderPolicyVersionSettings();
  const target = await syncLessonPoliciesToServer();
  showToast(target === "server" ? `${message} · 서버 저장 완료` : target === "blocked" ? `${message} · 서버 저장 확인 필요` : `${message} · 로컬 저장 완료`);
}

async function createLessonPolicy() {
  const policy = normalizeLessonPolicy({
    id: `lesson-policy-${Date.now()}`,
    title: "새 수업 정책",
    detail: "정책 내용을 입력해 주세요.",
    category: "기타",
    status: "active",
  }, lessonPolicies.length);
  lessonPolicies.push(policy);
  state.lessonPolicySearch = "";
  await persistLessonPolicies("새 수업 정책을 추가했습니다");
  window.setTimeout(() => {
    const row = $$('[data-lesson-policy-id]').find((item) => item.dataset.lessonPolicyId === policy.id);
    if (!row) return;
    row.open = true;
    row.querySelector('[data-lesson-policy-field="title"]')?.select();
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 0);
}

async function saveLessonPolicy(policyId) {
  const policy = lessonPolicies.find((item) => item.id === policyId);
  const row = $$('[data-lesson-policy-id]').find((item) => item.dataset.lessonPolicyId === policyId);
  if (!policy || !row) return;
  const field = (name) => row.querySelector(`[data-lesson-policy-field="${name}"]`);
  const title = field("title")?.value.trim() || "";
  const detail = field("detail")?.value.trim() || "";
  if (title.length < 2) {
    showToast("정책명을 2자 이상 입력해 주세요.");
    field("title")?.focus();
    return;
  }
  if (detail.length < 4) {
    showToast("정책 내용을 4자 이상 입력해 주세요.");
    field("detail")?.focus();
    return;
  }
  Object.assign(policy, normalizeLessonPolicy({
    ...policy,
    title,
    detail,
    category: field("category")?.value,
    status: field("status")?.value,
  }, lessonPolicies.indexOf(policy)));
  await persistLessonPolicies("수업 정책을 수정했습니다");
}

async function deleteLessonPolicy(policyId) {
  const policyIndex = lessonPolicies.findIndex((item) => item.id === policyId);
  if (policyIndex < 0) return;
  if (!window.confirm(`'${lessonPolicies[policyIndex].title}' 정책을 삭제할까요?`)) return;
  lessonPolicies.splice(policyIndex, 1);
  await persistLessonPolicies("수업 정책을 삭제했습니다");
}

async function moveLessonPolicy(policyId, direction, allLessonPolicies = lessonPolicies) {
  const currentIndex = allLessonPolicies.findIndex((item) => item.id === policyId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= allLessonPolicies.length) return;
  const [policy] = allLessonPolicies.splice(currentIndex, 1);
  allLessonPolicies.splice(nextIndex, 0, policy);
  await persistLessonPolicies("수업 정책 순서를 변경했습니다");
}

async function loadLessonPoliciesFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: lessonPolicySettingsKey },
      limit: 1,
    });
    const items = rows?.[0]?.value?.items;
    if (!Array.isArray(items)) return false;
    replaceArray(lessonPolicies, items.map((policy, index) => normalizeLessonPolicy(policy, index)));
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
    renderLessonPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
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

async function syncPolicyVersionsToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || !adminApprovalReady()) return "local";
  const value = policyVersionPayload();
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: policyVersionSettingsKey }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) await client.insertRows("tn_admin_settings", { key: policyVersionSettingsKey, value });
    return "server";
  } catch {
    return "blocked";
  }
}

async function persistPolicyVersions(message) {
  reflectHoldingPolicyInActiveVersion();
  reflectRefundPolicyInActiveVersion();
  reflectLessonPoliciesInActiveVersion();
  saveSnapshot();
  renderPolicyVersionSettings();
  const target = await syncPolicyVersionsToServer();
  showToast(target === "server" ? `${message} · 서버 저장 완료` : target === "blocked" ? `${message} · 서버 저장 확인 필요` : `${message} · 로컬 저장 완료`);
}

async function loadPolicyVersionsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: policyVersionSettingsKey },
      limit: 1,
    });
    const items = rows?.[0]?.value?.items;
    if (!Array.isArray(items) || !items.length) return false;
    const nextPolicies = items.map((policy) => normalizePolicyVersion(policy));
    const activeIndex = Math.max(0, nextPolicies.findIndex((policy) => policy.status === "active"));
    nextPolicies.forEach((policy, index) => {
      if (policy.status === "active" && index !== activeIndex) policy.status = "archived";
    });
    nextPolicies[activeIndex].status = "active";
    replaceArray(policyVersions, nextPolicies);
    reflectHoldingPolicyInActiveVersion();
    reflectRefundPolicyInActiveVersion();
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
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

async function deletePolicyVersion(policyId) {
  const policyIndex = policyVersions.findIndex((policy) => policy.id === policyId);
  if (policyIndex < 0) return;
  if (policyVersions.length <= 1) {
    showToast("마지막 정책은 삭제할 수 없습니다. 새 정책을 만든 뒤 삭제해 주세요.");
    return;
  }
  const policy = policyVersions[policyIndex];
  if (!window.confirm(`'${policy.title}' 정책을 삭제할까요? 기존 회원권에 저장된 구매 당시 정책은 유지됩니다.`)) return;
  const wasActive = policy.status === "active";
  policyVersions.splice(policyIndex, 1);
  if (wasActive) {
    policyVersions.forEach((item, index) => {
      item.status = index === 0 ? "active" : "archived";
    });
  }
  await persistPolicyVersions(wasActive ? "정책을 삭제하고 남은 최신 정책을 적용했습니다" : "정책을 삭제했습니다");
}

function openPolicyVersionEditor(policyId) {
  const policy = policyVersions.find((item) => item.id === policyId);
  const modal = $("#policyVersionEditorModal");
  const target = $("#policyVersionEditorContent");
  if (!policy || !modal || !target) return;
  policyVersionEditorState.policyId = policy.id;
  const managedSectionIds = new Set(["lesson-operation", "holding", "refund"]);
  const editableSections = policy.sections.filter((section) => !managedSectionIds.has(section.id));
  const managedSections = policy.sections.filter((section) => managedSectionIds.has(section.id));
  $("#policyVersionEditorTitle").textContent = policy.status === "active" ? "적용 정책 수정" : "정책 수정";
  target.innerHTML = `
    <div class="policy-version-editor-grid">
      <label>
        <small>정책명</small>
        <input type="text" maxlength="80" value="${escapeHtml(policy.title)}" data-policy-version-field="title" />
      </label>
      <label>
        <small>적용 시작일</small>
        <input type="date" value="${escapeHtml(policy.effectiveFrom)}" data-policy-version-field="effectiveFrom" />
      </label>
      <label>
        <small>작성 기준</small>
        <input type="text" maxlength="80" value="${escapeHtml(policy.source)}" data-policy-version-field="source" />
      </label>
      <label class="policy-version-summary-field">
        <small>정책 요약</small>
        <textarea rows="2" maxlength="300" data-policy-version-field="summary">${escapeHtml(policy.summary)}</textarea>
      </label>
    </div>
    <section class="policy-managed-section-list">
      <div>
        <strong>별도 설정에서 관리</strong>
        <span>수업·홀딩·환불 수치는 각 설정에서 수정하면 적용 정책에도 반영됩니다.</span>
      </div>
      <div class="policy-managed-section-chips">
        ${managedSections.map((section) => `<span>${escapeHtml(section.title)} ${section.rules.length}개</span>`).join("") || "<span>연결된 별도 설정 없음</span>"}
      </div>
    </section>
    <div class="policy-section-editor-toolbar">
      <div>
        <strong>추가 정책 항목</strong>
        <span>보강, 양도, 코치 변경처럼 안내에 포함할 내용을 관리합니다.</span>
      </div>
      <button class="ghost-button" type="button" id="addPolicyVersionSection">항목 추가</button>
    </div>
    <div id="policyVersionSectionEditors" class="policy-section-editor-list">
      ${editableSections.map((section) => policyVersionEditorSectionMarkup(section)).join("")}
    </div>`;
  modal.removeAttribute("hidden");
  setTimeout(() => target.querySelector("input")?.focus(), 0);
}

function closePolicyVersionEditor() {
  policyVersionEditorState.policyId = "";
  $("#policyVersionEditorModal")?.setAttribute("hidden", "");
}

function addPolicyVersionSectionEditor() {
  const target = $("#policyVersionSectionEditors");
  if (!target) return;
  target.insertAdjacentHTML("beforeend", policyVersionEditorSectionMarkup({}, { isNew: true }));
  target.lastElementChild?.querySelector("input")?.focus();
}

async function savePolicyVersionEditor() {
  const policy = policyVersions.find((item) => item.id === policyVersionEditorState.policyId);
  const target = $("#policyVersionEditorContent");
  if (!policy || !target) return;
  const field = (name) => target.querySelector(`[data-policy-version-field="${name}"]`);
  const title = field("title")?.value.trim() || "";
  const source = field("source")?.value.trim() || "";
  const summary = field("summary")?.value.trim() || "";
  if (title.length < 2 || summary.length < 4) {
    showToast("정책명은 2자, 정책 요약은 4자 이상 입력해 주세요.");
    (title.length < 2 ? field("title") : field("summary"))?.focus();
    return;
  }
  const editedSections = [...target.querySelectorAll("[data-policy-section-editor]")].map((row, index) => ({
    id: row.dataset.sectionId || `custom-${Date.now()}-${index}`,
    title: row.querySelector('[data-policy-section-field="title"]')?.value.trim() || "",
    rules: (row.querySelector('[data-policy-section-field="rules"]')?.value || "").split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean),
  }));
  const invalidSection = editedSections.find((section) => section.title.length < 2 || !section.rules.length);
  if (invalidSection) {
    showToast("정책 항목명과 한 개 이상의 정책 내용을 입력해 주세요.");
    return;
  }
  const managedSectionIds = new Set(["lesson-operation", "holding", "refund"]);
  const editedById = new Map(editedSections.map((section) => [section.id, section]));
  const originalIds = new Set(policy.sections.map((section) => section.id));
  const nextSections = policy.sections.map((section) => (
    managedSectionIds.has(section.id) ? section : editedById.get(section.id)
  )).filter(Boolean);
  editedSections.forEach((section) => {
    if (!originalIds.has(section.id)) nextSections.push(section);
  });
  Object.assign(policy, {
    title,
    effectiveFrom: field("effectiveFrom")?.value || new Date().toISOString().slice(0, 10),
    source: source || "관리자 설정",
    summary,
    sections: nextSections,
  });
  closePolicyVersionEditor();
  await persistPolicyVersions("정책을 수정했습니다");
}

function showPolicySnapshotPreview(policyId) {
  const policy = policyVersions.find((item) => item.id === policyId) || activePolicyVersion();
  const product = membershipProductDrafts[0] || membershipProductDefaults[0];
  const snapshot = ticketPolicySnapshot(product, policy);
  discountIssueLogs.unshift({
    id: `policy-snapshot-log-${Date.now()}`,
    text: `${snapshot.policyTitle} 스냅샷 확인: ${snapshot.product.title}`,
    at: new Date().toLocaleDateString("ko-KR"),
  });
  saveSnapshot();
  renderScheduleSettings();
  showToast("회원권 구매 시 저장될 정책 스냅샷을 확인했습니다");
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

async function loadDiscountPoliciesFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.selectRows || !branchId || !adminApprovalReady()) return false;
  const [rows, issues] = await Promise.all([
    client.selectRows("tn_discount_policies", {
      select: "id,branch_id,name,target_label,discount_type,discount_value,payment_scope,coach_permission,coach_issue_quota,expires_days,burden_party,status,updated_at",
      filters: { branch_id: branchId },
      order: "created_at.desc",
      limit: 200,
    }),
    client.selectRows("tn_discount_issues", {
      select: "policy_id,status",
      filters: { branch_id: branchId },
      limit: 1000,
    }).catch(() => []),
  ]);
  replaceArray(discountPolicies, (rows || []).map((row) => discountPolicyFromServer(row, issues || [])));
  saveSnapshot();
  if (state.view === "settings" && state.settingsTab === "membership") renderServiceReadiness();
  return true;
}

async function createDiscountPolicy() {
  const title = $("#discountTitleInput")?.value.trim() || "";
  if (!title) {
    showToast("할인권 이름을 입력해주세요");
    return;
  }
  if (!adminApprovalReady() || !window.TennisNoteDataClient?.insertRows || !activeOperationBranchId()) {
    showToast("관리자 로그인과 운영 지점을 확인해 주세요");
    return;
  }
  const policy = normalizeDiscountPolicy({
    title,
    target: $("#discountTargetInput")?.value.trim() || "전체 회원권",
    type: $("#discountTypeInput")?.value || "percent",
    value: $("#discountValueInput")?.value,
    payment: $("#discountPaymentInput")?.value || "카드/현금",
    coachPermission: $("#discountCoachPermissionInput")?.value || "코치별 지급 수량 안에서 사용",
    coachQuota: $("#discountQuotaInput")?.value,
    expiresDays: $("#discountExpiresInput")?.value,
    burden: $("#discountBurdenInput")?.value || "센터 부담",
    status: "사용",
    branchId: activeOperationBranchId(),
  });
  try {
    const inserted = await window.TennisNoteDataClient.insertRows("tn_discount_policies", discountPolicyServerPayload(policy));
    if (!inserted?.[0]?.id) throw new Error("discount_policy_write_not_confirmed");
    await loadDiscountPoliciesFromServer();
    discountIssueLogs.unshift({ id: `discount-log-${Date.now()}`, text: `${policy.title} 생성`, at: new Date().toLocaleDateString("ko-KR") });
    showToast("할인권을 서버에 생성했습니다");
  } catch (error) {
    showToast(`할인권 생성 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

async function updateDiscountPolicy(policyId) {
  const card = document.querySelector(`[data-discount-card="${policyId}"]`);
  const policy = discountPolicies.find((item) => item.id === policyId);
  if (!card || !policy) return;
  const readField = (field) => card.querySelector(`[data-discount-field="${field}"]`)?.value.trim() || "";
  const nextPolicy = normalizeDiscountPolicy({
    ...policy,
    title: readField("title") || policy.title,
    target: readField("target") || policy.target,
    type: readField("type") || policy.type,
    value: readField("value") || policy.value,
    payment: readField("payment") || policy.payment,
    coachPermission: readField("coachPermission") || policy.coachPermission,
    coachQuota: readField("coachQuota") || policy.coachQuota,
    expiresDays: readField("expiresDays") || policy.expiresDays,
    burden: readField("burden") || policy.burden,
    status: readField("status") || policy.status,
  });
  if (!adminApprovalReady() || !window.TennisNoteDataClient?.updateRows || !policy.serverUpdatedAt) {
    showToast("할인권 서버 정보를 새로고침한 뒤 다시 저장해 주세요");
    return;
  }
  try {
    const updated = await window.TennisNoteDataClient.updateRows("tn_discount_policies", {
      id: policy.id,
      branch_id: activeOperationBranchId(),
      updated_at: policy.serverUpdatedAt,
    }, discountPolicyServerPayload(nextPolicy));
    if (!updated?.length) throw new Error("discount_policy_revision_conflict");
    await loadDiscountPoliciesFromServer();
    showToast("할인권을 서버에 저장했습니다");
  } catch (error) {
    await loadDiscountPoliciesFromServer().catch(() => false);
    showToast(String(error?.message || "").includes("revision_conflict")
      ? "다른 관리자가 먼저 수정했습니다. 최신 값을 불러왔습니다."
      : `할인권 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

async function archiveDiscountPolicy(policyId) {
  const policy = discountPolicies.find((item) => item.id === policyId);
  const client = window.TennisNoteDataClient;
  if (!policy || !adminApprovalReady() || !client?.updateRows || !policy.serverUpdatedAt) return;
  if (!window.confirm(`${policy.title} 할인권을 보관할까요?\n기존 발급·사용 이력은 유지됩니다.`)) return;
  try {
    const updated = await client.updateRows("tn_discount_policies", {
      id: policy.id,
      branch_id: activeOperationBranchId(),
      updated_at: policy.serverUpdatedAt,
    }, { status: "archived" });
    if (!updated?.length) throw new Error("discount_policy_revision_conflict");
    await loadDiscountPoliciesFromServer();
    showToast("할인권을 보관했습니다");
  } catch (error) {
    await loadDiscountPoliciesFromServer().catch(() => false);
    showToast(`할인권 보관 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

function showToast(message) {
  let toast = $("#actionToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "actionToast";
    toast.className = "action-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  updateAdminSaveState(message);
}

function updateAdminSaveState(message = "") {
  const target = $("#adminSaveState");
  if (!target) return;
  const text = String(message || "");
  if (/실패|오류|확인 필요|저장 중|불러오|취소/.test(text)) return;
  let label = "";
  if (/서버 저장 완료|서버에 저장|DB 반영 완료/.test(text)) label = "서버 저장 완료";
  else if (/로컬 저장 완료|임시 저장/.test(text)) label = "이 기기에 저장";
  else if (/저장 완료|반영 완료|처리 완료|등록 완료|수정 완료/.test(text)) label = "처리 완료";
  if (!label) return;
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  target.textContent = `${label} · ${time} · 새로고침 후에도 서버 값을 다시 확인하세요.`;
  target.dataset.tone = label === "서버 저장 완료" ? "server" : "saved";
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

function setCoachWorkBlocks(coachId, workBlocks, allCoaches = coaches) {
  const coach = allCoaches.find((item) => item.id === coachId);
  if (!coach) return;
  coach.workBlocks = workBlocks.map((block, index) => ({
    id: block.id || `${coachId}-preset-${index}`,
    days: block.days,
    start: block.start,
    end: block.end,
    label: block.label || "근무",
  }));
  const detail = getCoachAvailabilityDetail(coachId);
  coach.availableDays = detail.days;
  coach.availableStart = detail.start;
  coach.availableEnd = detail.end;
}

function applySchedulePreset(preset) {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  if (preset === "weekday-split" || preset === "clubhouse-current") {
    scheduleSettings.openStart = "06:40";
    scheduleSettings.openEnd = "22:00";
    setCoachWorkBlocks("coach-no", [
      { id: "coach-no-weekday-am", days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" },
      { id: "coach-no-weekday-pm", days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" },
    ]);
    setCoachWorkBlocks("coach-hwang", [{ id: "coach-hwang-weekday-am", days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" }]);
    setCoachWorkBlocks("coach-kang", [{ id: "coach-kang-weekday-pm", days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" }]);
    setCoachWorkBlocks("coach-park", [{ id: "coach-park-weekend", days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }]);
    scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => rule.id !== "preset-weekday-midday");
    upsertBreakRule("weekday-midday", weekdays, "13:00", "17:00", "수업 없음");
    scheduleSettings.coachWorkPolicyVersion = 2;
    return "현재 운영 시간표 반영 완료";
  }
  if (preset === "evening-buffer") {
    upsertBreakRule("preset-evening-buffer", weekdays, "20:00", "20:20", "상담/정리 브레이크");
    return "20시 20분 브레이크 반영 완료";
  }
  if (preset === "clear-breaks") {
    scheduleSettings.breakRules = [];
    return "브레이크타임 초기화 완료";
  }
  return "시간표 설정을 확인해주세요";
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

function focusQuickLessonReturnSlot(slot = null) {
  if (!slot) return;
  const buttons = [...document.querySelectorAll('.admin-duration-add[data-quick-lesson-entry="true"]')]
    .filter((button) => !button.disabled && button.offsetParent !== null);
  const sameLane = buttons
    .filter((button) => button.dataset.addLessonDay === slot.day
      && button.dataset.addLessonCoach === slot.coachId)
    .sort((left, right) => timeToMinutes(left.dataset.addLessonTime) - timeToMinutes(right.dataset.addLessonTime));
  const target = sameLane.find((button) => button.dataset.addLessonTime === slot.time)
    || sameLane.find((button) => timeToMinutes(button.dataset.addLessonTime) > timeToMinutes(slot.time))
    || sameLane[0];
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
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

function openAdminToolsModal(tool, options = {}) {
  const config = adminToolConfig[tool];
  if (!config) return;
  if (!options.skipLock && !requestAdminUnlock(config.lockView, () => openAdminToolsModal(tool, { skipLock: true }))) return;
  const modal = $("#adminToolsModal");
  if (!modal) return;
  $("#adminToolsModalTitle").textContent = config.title;
  $$('[data-admin-tool-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.adminToolPanel !== tool;
  });
  modal.removeAttribute("hidden");
  setTimeout(() => modal.querySelector("input, select, button:not(#closeAdminToolsModal)")?.focus(), 0);
  void ensureAdminToolData(tool);
}

function closeAdminToolsModal() {
  $("#adminToolsModal")?.setAttribute("hidden", "");
}

function toggleAdminMenu(force) {
  const open = typeof force === "boolean"
    ? force
    : !document.body.classList.contains("admin-menu-open");
  document.body.classList.toggle("admin-menu-open", open);
  $("#adminMenuButton")?.setAttribute("aria-expanded", String(open));
  const backdrop = $("#adminMenuBackdrop");
  if (backdrop) backdrop.hidden = !open;
}

function closeAdminMenu() {
  toggleAdminMenu(false);
}

function closeCleanMemberInlineEditor(nextView) {
  if (state.view !== "members" || nextView === "members" || !state.inlineMemberId) return;
  const openEditor = document.querySelector(".member-inline-editor--compact");
  if (openEditor?.dataset.dirty === "true") return;
  state.inlineMemberId = null;
  state.inlineMemberTicketId = "";
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

function setView(view, options = {}) {
  if (!operationsAccessReady()) {
    renderOperationsLoginGate();
    return;
  }
  if (view === "makeup") view = "schedule";
  if (
    state.view === "members"
    && view !== "members"
    && dirtyMemberInlineForms().length
    && !options.discardMemberChanges
  ) {
    if (!window.confirm("저장하지 않은 회원 변경사항이 있습니다. 변경을 버리고 이동할까요?")) return;
    dirtyMemberInlineForms().forEach((form) => setMemberInlineDirtyState(form, false));
  }
  if (!$(`#${view}View`)) view = "dashboard";
  if (!operationsViewAllowed(view)) {
    view = operationsRole() === "coach" ? "schedule" : "dashboard";
    showToast("현재 계정에서 사용할 수 없는 메뉴입니다.");
  }
  if (!options.skipLock && !requestAdminUnlock(view)) return;
  const previousView = state.view;
  const enteringSchedule = view === "schedule" && previousView !== "schedule";
  closeCleanMemberInlineEditor(view);
  state.view = view;
  if (view === "schedule" && (enteringSchedule || !scheduleSessionInitialized)) resetScheduleEntryState();
  $$(".nav-item[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $("#adminMoreMenuButton")?.classList.toggle("is-active", adminLayoutSettings.moreMenus.includes(view));
  setAdminMoreMenuOpen(false);
  $$(".view").forEach((section) => section.classList.remove("is-active"));
  $(`#${view}View`).classList.add("is-active");
  closeAdminMenu();
  const titles = {
    dashboard: "대시보드",
    members: operationsRole() === "coach" ? "회원 찾기" : "회원관리",
    schedule: operationsRole() === "coach" ? "레슨표" : "레슨시간표",
    billing: "결제/정산",
    reports: "경영 리포트",
    notes: operationsRole() === "coach" ? "수업 완료" : "기록/차감 확인",
    issues: operationsRole() === "coach" ? "오류 접수" : "개선·오류 접수",
    settings: "운영 설정",
  };
  $("#viewTitle").textContent = titles[view];
  const reuseRenderedView = canReuseAdminView(view);
  if (enteringSchedule && !reuseRenderedView) {
    const grid = $("#scheduleGrid");
    if (grid) {
      grid.hidden = false;
      grid.className = "schedule-sheet schedule-loading-state";
      grid.innerHTML = '<div class="schedule-loading-message" role="status"><span class="schedule-loading-spinner" aria-hidden="true"></span><strong>시간표 불러오는 중</strong><small>이번 주 수업을 정리하고 있습니다.</small></div>';
    }
    window.requestAnimationFrame(() => {
      if (state.view === "schedule") renderAdminView(view);
    });
  } else if (!reuseRenderedView) {
    renderAdminView(view);
  }
  void ensureAdminViewData(view);
  if (
    previousView === "schedule"
    && view !== "schedule"
    && state.liveScheduleLoaded
    && !adminWeekIsLoaded(adminScheduleWeek(0))
  ) {
    void refreshAdminLiveSchedule({ force: true });
  }
  if (view === "billing" && !serverPaymentSyncState.loading) {
    loadServerPaymentsIntoBilling({ force: !serverPaymentSyncState.directLoaded });
  }
  if (enteringSchedule && state.liveScheduleLoaded && !state.liveScheduleLoading) {
    refreshAdminLiveSchedule().catch(() => false);
  }
}

function openSettingsWorkspace(tab) {
  if (!requestAdminUnlock("settings", () => openSettingsWorkspace(tab))) return;
  state.settingsTab = tab;
  setView("settings", { skipLock: true });
  renderSettingsTabs();
  void ensureAdminViewData("settings", tab);
  $("#settingsView")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

async function saveGroupDeductionPolicy(productId, control) {
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  const serverProduct = serverMembershipProductForDraft(product);
  const policy = control?.value || "";
  if (!product || !serverProduct?.id || !["per_participant", "shared_once", "representative_only"].includes(policy)) {
    showToast("1:2 차감 방식을 다시 선택해 주세요.");
    return;
  }
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 로그인 후 차감 방식을 저장해 주세요.");
    return;
  }
  control.disabled = true;
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_set_group_deduction_policy", {
      target_product_id: serverProduct.id,
      target_policy: policy,
    });
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => String(item.id) === String(serverProduct.id));
    if (!saved || String(saved.group_deduction_policy || "shared_once") !== policy) {
      throw new Error("group_deduction_policy_write_not_confirmed");
    }
    renderServiceReadiness();
    showToast("1:2 차감 방식을 저장했습니다.");
  } catch {
    control.disabled = false;
    showToast("차감 방식을 저장하지 못했습니다. 서버 기능 적용 여부를 확인해 주세요.");
  }
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

async function invokeAdminAccountControl(body, button, successMessage) {
  if (!adminApprovalReady() || operationsRole() !== "admin" || !window.TennisNoteDataClient?.invokeFunction) {
    showToast("관리자 로그인 후 사용할 수 있습니다.");
    return null;
  }
  if (button) button.disabled = true;
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("tennisnote-admin-users", { body });
    if (!result?.ok) throw new Error(result?.code || "server_error");
    await syncAdminLiveData();
    showToast(successMessage);
    return result;
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    showToast(adminAccountControlErrorMessage(code));
    return null;
  } finally {
    if (button) button.disabled = false;
  }
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

async function cancelAuthProviderSwitch(userId, switchId, button) {
  if (!window.confirm("로그인 수단 변경 대기를 취소할까요? 현재 로그인은 그대로 유지됩니다.")) return;
  await invokeAdminAccountControl({
    action: "cancel_auth_provider_switch",
    userId,
    switchId,
  }, button, "로그인 수단 변경 대기를 취소했습니다.");
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

async function setCoachApproval(coachId, nextStatus, button) {
  const coach = coaches.find((item) => item.id === coachId);
  if (!coach?.serverRoleId) {
    showToast("실서버 코치 권한 정보를 다시 불러와 주세요.");
    return;
  }
  const disabling = nextStatus === "disabled";
  if (disabling && !window.confirm(`${coach.name}의 코치 승인을 해제할까요?\n\n회원 계정과 과거 수업·정산 기록은 유지되고 코치 모드만 중지됩니다.`)) return;
  const result = await invokeAdminAccountControl({
    action: "set_coach_status",
    coachRoleId: coach.serverRoleId,
    status: nextStatus,
  }, button, disabling ? "코치 승인을 해제했습니다." : "코치 승인을 다시 완료했습니다.");
  if (result && !disabling) {
    const refreshedCoach = coaches.find((item) => item.serverRoleId === coach.serverRoleId);
    if (refreshedCoach) openCoachStaffModal(refreshedCoach.id);
  }
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

async function setGroupPaymentMode(groupAccountId, mode) {
  const account = groupAccounts.find((item) => item.id === groupAccountId);
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (mode !== "representative" && linkedMembers.length < 2) {
    showToast("두 회원이 모두 앱에 연결된 뒤 사용할 수 있습니다");
    return;
  }
  if (account.serverAccount && window.TennisNoteDataClient?.rpc) {
    const nextPayer = linkedMembers.find((member) => member.name === account.nextPayer) || linkedMembers[0];
    try {
      await window.TennisNoteDataClient.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: mode,
        target_next_payer_user_id: mode === "separate" ? null : nextPayer?.userId || account.nextPayerUserId || null,
      });
      await syncAdminLiveData();
      showToast(`${groupPaymentModeLabel(mode)}로 변경 완료`);
    } catch (error) {
      showToast(`결제 방식 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
    return;
  }
  account.paymentMode = mode;
  if (mode !== "separate" && !linkedMembers.some((member) => member.name === account.nextPayer)) {
    account.nextPayer = linkedMembers[0]?.name || account.nextPayer;
  }
  saveSnapshot();
  renderMembers();
  showToast(`${groupPaymentModeLabel(mode)}로 변경 완료`);
}

async function switchGroupPayer(groupAccountId) {
  const account = groupAccounts.find((item) => item.id === groupAccountId);
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (linkedMembers.length < 2 || account.paymentMode === "separate") return;
  const currentIndex = linkedMembers.findIndex((member) => member.name === account.nextPayer);
  const nextMember = linkedMembers[(currentIndex + 1) % linkedMembers.length];
  if (account.serverAccount && window.TennisNoteDataClient?.rpc) {
    try {
      await window.TennisNoteDataClient.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: account.paymentMode,
        target_next_payer_user_id: nextMember.userId,
      });
      await syncAdminLiveData();
      showToast(`다음 결제 담당 ${nextMember.name}`);
    } catch (error) {
      showToast(`다음 결제자 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
    return;
  }
  account.nextPayer = nextMember.name;
  saveSnapshot();
  renderMembers();
  showToast(`다음 결제 담당 ${account.nextPayer}`);
}

async function reviewHoldingRequest(requestId, status) {
  const shared = loadSharedData();
  const request = (shared.holdingRequests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "pending") return;
  const client = window.TennisNoteDataClient;
  const isLive = request.source === "server";
  try {
    if (isLive && client?.rpc && client.getSession?.()?.access_token) {
      await client.rpc("tn_review_holding_request", {
        target_request_id: request.id,
        target_status: status,
        target_admin_note: status === "approved" ? "관리자 승인" : "관리자 반려",
        target_evidence_retention_days: Number(holdingPolicySettings.evidenceRetentionDays) || 30,
        target_personal_max_days: Number(holdingPolicySettings.personalMaxDays) || 7,
        target_injury_max_days: Number(holdingPolicySettings.injuryMaxDays) || 28,
        target_injury_evidence_required: holdingPolicySettings.evidenceRequired !== false,
      });
    }
  } catch {
    showToast("서버 홀딩 처리 실패 · 관리자 로그인과 DB 적용을 확인해 주세요");
    return;
  }
  request.status = status;
  request.reviewedAt = new Date().toISOString();
  saveSharedData(shared);
  renderHoldingRequestAdminList();
  showToast(status === "approved" ? "홀딩 승인 및 회원권 기간 연장 완료" : "홀딩 요청 반려 완료");
}

async function viewHoldingEvidence(requestId) {
  const request = (loadSharedData().holdingRequests || []).find((item) => item.id === requestId);
  if (!request?.evidencePath) {
    showToast(request?.evidenceLabel ? "데모 증빙 첨부 상태입니다" : "첨부된 증빙이 없습니다");
    return;
  }
  try {
    const blob = await window.TennisNoteDataClient.downloadObject("tennisnote-private-holding-evidence", request.evidencePath);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    showToast("증빙을 열 수 없습니다 · 관리자 권한을 확인해 주세요");
  }
}

async function deleteHoldingEvidence(requestId) {
  const shared = loadSharedData();
  const request = (shared.holdingRequests || []).find((item) => item.id === requestId);
  if (!request?.evidencePath) return;
  const confirmed = window.confirm("부상 증빙 원본을 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.");
  if (!confirmed) return;
  try {
    await window.TennisNoteDataClient.deleteObject("tennisnote-private-holding-evidence", request.evidencePath);
    await window.TennisNoteDataClient.updateRows("tn_holding_requests", { id: request.id }, {
      evidence_object_path: "",
      evidence_status: "purged",
      evidence_deleted_at: new Date().toISOString(),
    });
    request.evidencePath = "";
    request.evidenceLabel = "원본 삭제 완료";
    saveSharedData(shared);
    renderHoldingRequestAdminList();
    showToast("부상 증빙 원본 삭제 완료");
  } catch {
    showToast("증빙 삭제 실패 · 관리자 권한을 확인해 주세요");
  }
}

async function loadServerHoldingRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_holding_requests", {
      select: "id,user_id,ticket_id,request_type,requested_start_on,requested_end_on,reason_summary,evidence_object_path,evidence_status,status,reviewed_at,created_at",
      limit: 100,
    });
    const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const userNames = {};
    await Promise.all(userIds.map(async (userId) => {
      const users = await client.selectRows("tn_users", { select: "id,name", filters: { id: userId }, limit: 1 }).catch(() => []);
      userNames[userId] = users?.[0]?.name || "회원";
    }));
    const shared = loadSharedData();
    const demoRequests = (shared.holdingRequests || []).filter((request) => request.source !== "server");
    const liveRequests = (rows || []).map((row) => ({
      id: row.id,
      member: userNames[row.user_id] || "회원",
      ticketId: row.ticket_id,
      ticketTitle: "회원권",
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
    shared.holdingRequests = [...liveRequests, ...demoRequests];
    saveSharedData(shared);
    renderHoldingRequestAdminList();
    return true;
  } catch {
    return false;
  }
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

async function loadServerAccountDeletionRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "*",
      limit: 100,
    });
    const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const userNames = {};
    await Promise.all(userIds.map(async (userId) => {
      const users = await client.selectRows("tn_users", { select: "id,name", filters: { id: userId }, limit: 1 }).catch(() => []);
      userNames[userId] = users?.[0]?.name || "회원";
    }));
    state.accountDeletionRequests = (rows || [])
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        member: userNames[row.user_id] || "회원",
        status: row.status || "pending",
        reason: row.reason_summary || "",
        adminNote: row.admin_note || "",
        retainedDataSummary: row.retained_data_summary || "",
        executionAttempts: Number(row.execution_attempts || 0),
        lastErrorCode: row.last_error_code || "",
        appleRevokeStatus: row.apple_revoke_status || "not_applicable",
        authDeleteStatus: row.auth_delete_status || "pending",
        requestedAt: row.requested_at || "",
        reviewedAt: row.reviewed_at || "",
        executionStartedAt: row.execution_started_at || "",
        completedAt: row.completed_at || "",
        createdAt: row.created_at || "",
      }))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    renderAccountDeletionAdminList();
    return true;
  } catch {
    state.accountDeletionRequests = [];
    renderAccountDeletionAdminList();
    return false;
  }
}

async function reviewAccountDeletionRequest(requestId, status) {
  const request = (state.accountDeletionRequests || []).find((item) => item.id === requestId);
  const client = window.TennisNoteDataClient;
  if (!request || !client?.rpc || !client?.invokeFunction) return;
  if (accountDeletionExecutionInFlight.has(requestId)) return;
  if (
    status === "completed"
    && request.status !== "reviewing"
    && request.status !== "failed"
    && !accountDeletionProcessingIsStale(request)
  ) {
    showToast("현재 삭제 작업이 끝나거나 16분 재시도 시간이 지난 뒤 다시 시도해 주세요");
    return;
  }
  if (status === "completed" && !window.confirm("이 작업은 회원의 로그인 계정과 개인 이용 데이터를 실제로 삭제하며 되돌릴 수 없습니다. 정산·환불·잔여 수업을 확인한 뒤 실행할까요?")) return;
  accountDeletionExecutionInFlight.add(requestId);
  if (status === "completed") {
    request.status = "processing";
    request.executionStartedAt = new Date().toISOString();
  }
  renderAccountDeletionAdminList();
  try {
    if (status === "completed") {
      await client.invokeFunction("tennisnote-account-deletion", {
        body: { action: "complete", requestId },
      });
      showToast("회원 계정과 개인 이용 데이터 삭제 완료");
      return;
    }
    await client.rpc("tn_review_account_deletion", {
      target_request_id: requestId,
      target_status: status,
      target_admin_note: "관리자 검토 시작",
      target_retained_data_summary: "",
    });
    showToast("회원 탈퇴 요청 검토 시작");
  } catch (error) {
    const code = String(error?.payload?.code || error?.message || "").toLowerCase();
    if (Number(error?.status) === 404 || code.includes("function failed: 404") || code.includes("function_not_found")) {
      showToast("계정 삭제 서버 기능이 아직 배포되지 않았습니다. 서버 배포를 완료한 뒤 다시 실행해 주세요");
      return;
    }
    if (code.includes("execution_in_progress") || code.includes("lease_mismatch")) {
      showToast("다른 관리자 화면에서 삭제를 처리 중입니다. 잠시 후 상태를 다시 확인해 주세요");
      return;
    }
    if (code.includes("storage_cleanup")) {
      showToast("사진·동영상 원본 삭제를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요");
      return;
    }
    if (code.includes("coach_makeup")) {
      showToast("코치에게 배정된 미처리 보강권을 다른 코치로 옮긴 뒤 다시 시도해 주세요");
      return;
    }
    if (code.includes("active_ticket")) showToast("잔여 수업이 있는 회원권을 먼저 환불·종료해 주세요");
    else if (code.includes("future_lesson")) showToast("예정된 수업을 먼저 취소하거나 정리해 주세요");
    else if (code.includes("refund_review")) showToast("진행 중인 환불 처리를 먼저 완료해 주세요");
    else if (code.includes("payment_review")) showToast("확인 중인 결제를 먼저 정리해 주세요");
    else if (code.includes("transfer_review")) showToast("진행 중인 회원권 양도 요청을 먼저 정리해 주세요");
    else if (code.includes("coach_schedule")) showToast("코치의 예정 수업을 다른 코치에게 재배정한 뒤 삭제해 주세요");
    else if (code.includes("admin_role")) showToast("관리자 계정은 권한을 인계하고 일반 회원으로 변경한 뒤 삭제해 주세요");
    else if (code.includes("merged_profile")) showToast("이미 기존 회원에게 병합된 가입 프로필은 별도로 삭제하지 않습니다");
    else if (code.includes("apple_reauthentication")) showToast("회원이 Apple로 다시 로그인한 뒤 삭제 처리를 재시도해 주세요");
    else if (code.includes("self_admin")) showToast("현재 로그인한 관리자 계정은 직접 삭제할 수 없습니다");
    else if (code.includes("apple_revoke_config")) showToast("Apple 연결 해제 서버 설정을 확인한 뒤 다시 시도해 주세요");
    else showToast("삭제 처리를 완료하지 못했습니다 · 상태를 보존했으므로 다시 시도할 수 있습니다");
  } finally {
    accountDeletionExecutionInFlight.delete(requestId);
    await loadServerAccountDeletionRequests();
  }
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

function syncMemberTicketExtensionPreview(form) {
  const input = form?.elements?.extendedExpiresOn;
  const output = form?.querySelector("[data-member-ticket-extension-result]");
  if (!input || !output) return;
  output.textContent = input.value ? memberDetailDateLabel(input.value) : "날짜 선택";
  [...form.querySelectorAll("[data-ticket-extension-days]")].forEach((button) => {
    const expected = addMemberManagementDays(form.dataset.currentExpiresOn, Number(button.dataset.ticketExtensionDays));
    button.classList.toggle("is-active", expected === input.value);
  });
}

function applyMemberTicketExtensionPreset(button) {
  const form = button?.closest("#memberManagementForm");
  if (!form?.elements?.extendedExpiresOn) return;
  form.elements.extendedExpiresOn.value = addMemberManagementDays(
    form.dataset.currentExpiresOn,
    Number(button.dataset.ticketExtensionDays),
  );
  syncMemberTicketExtensionPreview(form);
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

async function loadMemberLinkCandidates(member, query = memberManagementModalState.linkQuery || "") {
  if (!member?.serverUserId || operationsRole() !== "admin") return;
  const inputGuardWasDirty = Boolean(
    window.TennisNoteInputGuard?.isDirty?.("#memberManagementModal"),
  );
  memberManagementModalState.linkQuery = String(query || "").trim();
  memberManagementModalState.linkCandidatesLoading = true;
  memberManagementModalState.linkCandidatesLoadedFor = member.serverUserId;
  renderMemberManagementModal();
  if (!inputGuardWasDirty) {
    window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  }
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_member_link_candidates", {
      target_user_id: member.serverUserId,
      target_query: memberManagementModalState.linkQuery || null,
    });
    if (memberManagementModalState.memberId !== member.id || memberManagementModalState.action !== "app_link") return;
    memberManagementModalState.linkCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    memberManagementModalState.linkCandidates = [];
  } finally {
    memberManagementModalState.linkCandidatesLoading = false;
    if (memberManagementModalState.memberId === member.id && memberManagementModalState.action === "app_link") {
      const inputGuardWasDirtyAfterRequest = Boolean(
        window.TennisNoteInputGuard?.isDirty?.("#memberManagementModal"),
      );
      renderMemberManagementModal();
      if (!inputGuardWasDirtyAfterRequest) {
        window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
      }
    }
  }
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

async function loadMemberTicketForceDeletePreview(ticketId) {
  const client = window.TennisNoteDataClient;
  if (!ticketId || !client?.rpc || memberManagementModalState.action !== "force_delete") return;
  memberManagementModalState.forceDeletePreviewLoading = true;
  memberManagementModalState.forceDeletePreview = null;
  memberManagementModalState.forceDeletePreviewError = "";
  renderMemberManagementModal();
  try {
    const result = await client.rpc("tn_admin_member_ticket_force_delete_preview", {
      target_ticket_id: ticketId,
    });
    if (memberManagementModalState.action !== "force_delete" || memberManagementModalState.ticketId !== ticketId) return;
    const preview = normalizedRpcResult(result);
    if (!preview?.ok || preview.ticketId !== ticketId) throw new Error("force_delete_preview_not_confirmed");
    memberManagementModalState.forceDeletePreview = preview;
  } catch (error) {
    if (memberManagementModalState.action !== "force_delete" || memberManagementModalState.ticketId !== ticketId) return;
    memberManagementModalState.forceDeletePreviewError = memberManagementErrorText(error);
  } finally {
    if (memberManagementModalState.action === "force_delete" && memberManagementModalState.ticketId === ticketId) {
      memberManagementModalState.forceDeletePreviewLoading = false;
      renderMemberManagementModal();
      window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    }
  }
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

async function loadMemberTicketFutureClosePreview(memberUserId) {
  const client = window.TennisNoteDataClient;
  if (!memberUserId || !client?.rpc || memberManagementModalState.action !== "close") return;
  memberManagementModalState.closePreviewLoading = true;
  memberManagementModalState.closePreview = null;
  memberManagementModalState.closePreviewError = "";
  renderMemberManagementModal();
  try {
    const result = await client.rpc("tn_admin_preview_member_ticket_and_future_lessons_close", {
      target_user_id: memberUserId,
    });
    if (memberManagementModalState.action !== "close") return;
    const preview = normalizedRpcResult(result);
    if (!preview?.ok || preview.userId !== memberUserId) throw new Error("member_close_preview_not_confirmed");
    memberManagementModalState.closePreview = preview;
  } catch (error) {
    if (memberManagementModalState.action !== "close") return;
    memberManagementModalState.closePreviewError = memberManagementErrorText(error);
  } finally {
    if (memberManagementModalState.action === "close") {
      memberManagementModalState.closePreviewLoading = false;
      renderMemberManagementModal();
      window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    }
  }
}

function setMemberCreateStep(step) {
  const form = $("#memberManagementForm");
  if (!form || memberManagementModalState.action !== "create") return;
  const nextStep = step === 2 ? 2 : 1;
  memberManagementModalState.createStep = nextStep;
  [...form.querySelectorAll("[data-member-create-panel]")].forEach((panel) => {
    panel.hidden = Number(panel.dataset.memberCreatePanel) !== nextStep;
  });
  [...form.querySelectorAll("[data-member-create-step-indicator]")].forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.memberCreateStepIndicator);
    indicator.classList.toggle("is-active", indicatorStep === nextStep);
    indicator.classList.toggle("is-done", indicatorStep < nextStep);
  });
  const previous = form.querySelector("[data-member-create-previous]");
  const next = form.querySelector("[data-member-create-next]");
  const submit = form.querySelector("[data-member-create-submit]");
  if (previous) previous.hidden = nextStep === 1;
  if (next) next.hidden = nextStep === 2;
  if (submit) submit.hidden = nextStep !== 2;
  const heading = form.querySelector(`[data-member-create-panel="${nextStep}"] input, [data-member-create-panel="${nextStep}"] select`);
  window.setTimeout(() => heading?.focus(), 0);
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

async function openMemberManagementModal(member, action, ticketId = "") {
  if (["profile", "app_link"].includes(action)) ticketId = "";
  const targetUserId = member?.serverUserId || "";
  const initialTicket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === ticketId) || null;
  if (!targetUserId || !memberManagementActionAllowed(action, initialTicket)) {
    showToast("이 작업을 처리할 권한이 없습니다.");
    return;
  }
  const refreshed = await syncAdminLiveData();
  if (!refreshed) {
    showToast("최신 회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  const refreshedMember = members.find((item) => memberServerUserIds(item).includes(targetUserId));
  const refreshedTicket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === ticketId) || null;
  if (!refreshedMember || !memberManagementActionAllowed(action, refreshedTicket)) {
    showToast("회원 또는 회원권 상태가 변경됐습니다. 회원 목록에서 다시 확인해 주세요.");
    return;
  }
  Object.assign(memberManagementModalState, {
    memberId: refreshedMember.id,
    action,
    ticketId,
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: ["link_existing", "app_link"].includes(action) ? refreshedMember.name || "" : "",
    forceDeletePreview: null,
    forceDeletePreviewLoading: action === "force_delete",
    forceDeletePreviewError: "",
    closePreview: null,
    closePreviewLoading: action === "close",
    closePreviewError: "",
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
  syncMemberCreateSchedule($("#memberManagementForm"));
  window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  if (action === "app_link") loadMemberLinkCandidates(refreshedMember);
  if (action === "force_delete") loadMemberTicketForceDeletePreview(ticketId);
  if (action === "close") loadMemberTicketFutureClosePreview(refreshedMember.serverUserId);
  setTimeout(() => $("#memberManagementForm input, #memberManagementForm select")?.focus(), 0);
}

async function openManualMemberModal() {
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 계정으로 로그인해야 회원을 추가할 수 있습니다.");
    return;
  }
  const refreshed = await syncAdminLiveData();
  if (!refreshed) {
    showToast("최신 회원권과 코치 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  Object.assign(memberManagementModalState, {
    memberId: null,
    action: "create",
    ticketId: "",
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: "",
    createStep: 1,
    forceDeletePreview: null,
    forceDeletePreviewLoading: false,
    forceDeletePreviewError: "",
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
  syncMemberCreateSchedule($("#memberManagementForm"));
  setMemberCreateStep(1);
  window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  setTimeout(() => $("#memberManagementForm input[name='memberName']")?.focus(), 0);
}

function closeMemberManagementModal() {
  $("#memberManagementModal")?.setAttribute("hidden", "");
  Object.assign(memberManagementModalState, {
    memberId: null,
    action: "",
    ticketId: "",
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: "",
    createStep: 1,
    forceDeletePreview: null,
    forceDeletePreviewLoading: false,
    forceDeletePreviewError: "",
  });
  const target = $("#memberManagementModalContent");
  if (target) target.innerHTML = "";
}

function applyMemberManagementProductDefaults(form, allLiveData = adminLiveDataState) {
  const product = (allLiveData.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || !form) return;
  const total = Number(product.total_sessions) || 1;
  const start = memberManagementDate(form.elements.startsOn?.value);
  const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
  form.elements.totalSessions.value = total;
  form.elements.usedSessions.value = 0;
  form.elements.remainingSessions.value = total;
  form.elements.expiresOn.value = addMemberManagementDays(start, validityDays - 1);
  if (form.elements.paymentAmount) form.elements.paymentAmount.value = Number(product.cash_price || product.card_price || 0);
  const productScope = memberManagementProductScheduleScope(product);
  if (form.elements.scheduleScope) {
    form.elements.scheduleScope.value = productScope;
  }
  if (form.elements.weeklyFrequency) form.elements.weeklyFrequency.value = memberManagementProductWeeklyFrequency(product);
  if (form.elements.lessonType) form.elements.lessonType.value = Number(product.group_size || 1) === 2 ? "one_on_two" : "one_on_one";
  syncMemberManagementScopeFields(form);
  syncManualMemberPartnerField(form);
  syncMemberCreateSchedule(form, product);
}

function syncManualMemberPartnerField(form) {
  if (!form?.elements?.partnerUserId) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const groupProduct = form.elements.lessonType
    ? form.elements.lessonType.value === "one_on_two"
    : Number(product?.group_size || 1) === 2;
  const field = form.querySelector("[data-manual-member-partner-field]");
  const partnerMode = form.elements.partnerMode?.value || "existing";
  const createNewPartner = groupProduct && partnerMode === "new" && Boolean(form.elements.partnerName);
  const newFields = form.querySelector("[data-manual-new-partner]");
  const existingFields = form.querySelector("[data-manual-existing-partner]");
  if (newFields) newFields.hidden = !createNewPartner;
  if (existingFields) existingFields.hidden = !groupProduct || createNewPartner;
  form.elements.partnerUserId.disabled = !groupProduct || createNewPartner;
  form.elements.partnerUserId.required = groupProduct && !createNewPartner;
  if (form.elements.partnerSearch) form.elements.partnerSearch.disabled = !groupProduct || createNewPartner;
  if (form.elements.partnerName) {
    form.elements.partnerName.disabled = !createNewPartner;
    form.elements.partnerName.required = createNewPartner;
  }
  ["partnerPhone", "partnerBirthYear", "partnerGender"].forEach((name) => {
    if (form.elements[name]) form.elements[name].disabled = !createNewPartner;
  });
  if (!groupProduct || createNewPartner) form.elements.partnerUserId.value = "";
  field?.classList.toggle("is-disabled", !groupProduct);
  if (field) field.hidden = !groupProduct;
  filterManualMemberPartnerOptions(form);
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

function syncMemberManagementScopeFields(form) {
  if (!form?.elements?.scheduleScope) return;
  const scope = form.elements.scheduleScope.value;
  const frequency = form.elements.weeklyFrequency;
  if (frequency) {
    const threeTimes = Array.from(frequency.options || []).find((option) => option.value === "3");
    if (threeTimes) threeTimes.disabled = scope === "weekend";
    if (scope === "weekend" && Number(frequency.value) > 2) frequency.value = "2";
  }
  form.querySelectorAll('input[name="lessonDays"]').forEach((input) => {
    const day = Number(input.value);
    const allowed = scope === "mixed" || (scope === "weekend" ? [0, 6].includes(day) : day >= 1 && day <= 5);
    input.disabled = !allowed;
    if (!allowed) input.checked = false;
    input.closest(".member-lesson-day-option")?.classList.toggle("is-disabled", !allowed);
  });
}

function syncMemberManagementProductForMethod(form, allLiveData = adminLiveDataState) {
  if (!form?.elements?.productId || !form.elements.scheduleScope || !form.elements.weeklyFrequency || !form.elements.lessonType) return;
  const groupSize = form.elements.lessonType.value === "one_on_two" ? 2 : 1;
  const currentProduct = (allLiveData.products || []).find((item) => item.id === form.elements.productId.value);
  if (currentProduct?.product_kind === "coupon" || currentProduct?.is_coupon === true) return;
  const matchingProduct = memberManagementProducts().find((item) => (
    (!currentProduct?.branch_id || item.branch_id === currentProduct.branch_id)
    && memberManagementProductScheduleScope(item) === form.elements.scheduleScope.value
    && Number(item.frequency_per_week || 1) === Number(form.elements.weeklyFrequency.value)
    && Number(item.group_size || 1) === groupSize
  ));
  if (matchingProduct) form.elements.productId.value = matchingProduct.id;
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

async function submitMemberManagementForm(event) {
  event.preventDefault();
  const form = event.target;
  const member = members.find((item) => item.id === memberManagementModalState.memberId);
  const action = memberManagementModalState.action;
  const isCreate = action === "create";
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === memberManagementModalState.ticketId) || null;
  const client = window.TennisNoteDataClient;
  const message = $("#memberManagementMessage");
  const submit = form.querySelector("button[type='submit']");
  if ((!isCreate && !member?.serverUserId) || !client?.rpc || !memberManagementActionAllowed(action, ticket)) {
    if (message) message.textContent = "현재 계정에는 이 작업 권한이 없습니다.";
    return;
  }
  if (action === "force_delete" && !memberManagementModalState.forceDeletePreview?.ok) {
    if (message) message.textContent = memberManagementModalState.forceDeletePreviewError || "삭제 영향을 먼저 확인해 주세요.";
    return;
  }
  if (action === "close" && !memberManagementModalState.closePreview?.ok) {
    if (message) message.textContent = memberManagementModalState.closePreviewError || "종료할 회원권과 미래 수업을 먼저 확인해 주세요.";
    return;
  }
  if (!validateRequiredMemberProfile(form, message)) return;

  syncMemberManagementBalance(form);
  const reason = action === "close"
    ? String(form.elements.closeReason?.value || "").trim()
    : automaticMemberManagementReason(action);
  const managementPayload = action === "extend"
    ? {
      userId: member?.serverUserId || null,
      ticketId: ticket?.serverTicketId || null,
      expiresOn: form.elements.extendedExpiresOn?.value || null,
    }
    : ["create", "assign", "profile", "correct"].includes(action)
      ? memberManagementDatabasePayload(form, isCreate ? null : member, ticket, reason)
      : null;
  const selectedManagementProduct = (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  if (managementPayload && ["create", "assign", "correct"].includes(action)) {
    normalizeMemberManagementTicketPayload(managementPayload);
  }
  const createRegularSchedules = isCreate ? memberInlineScheduleValues(form) : [];
  if (managementPayload && action === "profile") {
    // Profile, note, and partner edits must never recalculate or replace a fixed schedule.
    managementPayload.preserveExistingSchedule = true;
  }
  const statusAction = form.elements.memberStatusAction?.value || "keep";

  if (form.elements.lessonType) {
    const total = memberManagementNullableNumber(form.elements.totalSessions);
    const used = memberManagementNullableNumber(form.elements.usedSessions);
    const remaining = memberManagementNullableNumber(form.elements.remainingSessions);
    if (total !== null && used !== null && used > total) {
      if (message) message.textContent = "소진 회차는 총 회차보다 클 수 없습니다.";
      return;
    }
    if ([total, used, remaining].every((value) => value !== null) && used + remaining !== total) {
      if (message) message.textContent = "잔여 회차 자동 계산값을 확인해 주세요.";
      return;
    }
    const activeRecord = isCreate || action === "assign" || form.elements.recordStatus?.value === "active";
    const selectedProduct = selectedManagementProduct;
    const couponProduct = selectedProduct?.is_coupon === true || selectedProduct?.product_kind === "coupon";
    const requiredLessonDays = Math.max(1, Number(form.elements.weeklyFrequency?.value) || 1);
    const selectedLessonDays = memberManagementSelectedDays(form);
    const createsWithoutSchedule = form.elements.createWithoutSchedule?.value === "true";
    if (isCreate && activeRecord && !createsWithoutSchedule && memberManagementProductSupportsRegularSchedule(selectedProduct)) {
      const completeSchedule = memberInlineScheduleIsComplete(form, createRegularSchedules);
      const uniqueScheduleCount = new Set(createRegularSchedules.map((slot) => `${slot.dayOfWeek}:${slot.startTime}`)).size;
      const scope = memberManagementProductScheduleScope(selectedProduct);
      if (!completeSchedule || createRegularSchedules.length !== requiredLessonDays) {
        if (message) message.textContent = `주 ${requiredLessonDays}회 정규 요일과 시간을 모두 선택해 주세요.`;
        return;
      }
      if (uniqueScheduleCount !== createRegularSchedules.length) {
        if (message) message.textContent = "같은 요일과 시간을 중복 선택할 수 없습니다.";
        return;
      }
      if (createRegularSchedules.some((slot) => !memberScheduleDayAllowed(scope, slot.dayOfWeek))) {
        if (message) message.textContent = "회원권의 평일·주말 이용 범위에 맞는 요일을 선택해 주세요.";
        return;
      }
      managementPayload.lessonDays = createRegularSchedules.map((slot) => slot.dayOfWeek);
    } else if (!isCreate && activeRecord && !createsWithoutSchedule && !couponProduct && (selectedLessonDays.length < 1 || selectedLessonDays.length > requiredLessonDays)) {
      if (message) message.textContent = `주 ${requiredLessonDays}회 회원권은 레슨 요일을 1개부터 ${requiredLessonDays}개까지 선택해 주세요. 같은 날 연속 수업도 가능합니다.`;
      return;
    }
    if (form.elements.lessonType.value === "one_on_two") {
      const newPartner = isCreate && form.elements.partnerMode?.value === "new";
      if (newPartner && String(form.elements.partnerName?.value || "").trim().length < 2) {
        if (message) message.textContent = "같이 등록할 파트너 실명을 두 글자 이상 입력해 주세요.";
        return;
      }
      if (!newPartner && !form.elements.partnerUserId?.value) {
        if (message) message.textContent = "기존 회원 중 연결할 1:2 파트너를 선택해 주세요.";
        return;
      }
    }
    const paymentAmount = memberManagementNullableNumber(form.elements.paymentAmount) || 0;
    const paymentDate = form.elements.paymentDate?.value || "";
    const paymentMethod = form.elements.paymentMethod?.value || "";
    const paymentRecordState = form.elements.paymentRecordState?.value || memberPaymentRecordState({
      payment_recorded_on: paymentDate,
      payment_method: paymentMethod,
      payment_amount: paymentAmount,
    });
    if (paymentRecordState === "complete" && (paymentAmount <= 0 || !paymentDate || !paymentMethod)) {
      if (message) message.textContent = "결제 완료는 결제일자, 결제수단, 1원 이상의 결제금액을 모두 입력해 주세요.";
      return;
    }
    if (paymentRecordState === "unentered" && (paymentAmount > 0 || paymentDate || paymentMethod)) {
      if (message) message.textContent = "결제값을 입력했다면 결제 구분을 결제 완료로 바꿔 주세요.";
      return;
    }
    normalizeMemberManagementPaymentPayload(managementPayload);
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = "처리 중";
  }
  if (message) message.textContent = "";

  try {
    let result = null;
    let linkedSourceSignupUserId = "";
    let linkedTargetMemberUserId = "";
    if (isCreate) {
      const createOperationKey = form.dataset.createOperationKey || createMemberChangeBatchId();
      form.dataset.createOperationKey = createOperationKey;
      result = await client.rpc("tn_admin_create_member_and_regular_schedule", {
        target_record: managementPayload,
        target_schedules: managementPayload.createWithoutSchedule ? [] : createRegularSchedules,
        target_operation_key: createOperationKey,
      });
      state.memberFilter = "active";
    } else if (action === "assign") {
      const existingPaymentId = managementPayload?.existingPaymentId || "";
      const assignmentRequestId = form.dataset.assignmentRequestId || createMemberChangeBatchId();
      form.dataset.assignmentRequestId = assignmentRequestId;
      const assignmentPayload = existingPaymentId
        ? { ...managementPayload, assignmentRequestId, paymentAmount: 0, paymentDate: null, paymentMethod: null }
        : { ...managementPayload, assignmentRequestId };
      result = await client.rpc("tn_admin_assign_member_database_ticket", {
        target_record: assignmentPayload,
      });
      if (existingPaymentId) {
        const linkedPayment = await client.rpc("tn_admin_link_existing_payment_to_ticket", {
          target_payment_id: existingPaymentId,
          target_ticket_id: result?.ticketId || result?.ticket_id,
        });
        if (!linkedPayment?.ok) throw new Error(linkedPayment?.code || "existing_payment_link_failed");
      }
      state.memberFilter = "active";
    } else if (action === "link_existing") {
      linkedTargetMemberUserId = form.elements.targetMembershipUserId?.value || "";
      if (!linkedTargetMemberUserId) throw new Error("membership_link_target_required");
      result = await client.rpc("tn_admin_replace_member_login", {
        target_member_user_id: linkedTargetMemberUserId,
        source_signup_user_id: member.serverUserId,
        target_reason: reason,
      });
    } else if (action === "profile") {
      const birthYearValue = String(form.elements.memberBirthYear?.value || "").trim();
      const selfNtrpValue = String(form.elements.memberSelfNtrp?.value || "").trim();
      const coachNtrpValue = String(form.elements.memberCoachNtrp?.value || "").trim();
      result = await client.rpc("tn_admin_update_member_profile_full", {
        target_user_id: member.serverUserId,
        target_name: form.elements.memberName.value.trim(),
        target_nickname: form.elements.memberNickname.value.trim(),
        target_phone: form.elements.memberPhone.value.trim(),
        target_birth_year: birthYearValue ? Number(birthYearValue) : null,
        target_neighborhood: form.elements.memberNeighborhood.value.trim(),
        target_gender: form.elements.memberGender.value || null,
        target_dominant_hand: form.elements.memberDominantHand.value || null,
        target_backhand_style: form.elements.memberBackhandStyle.value || null,
        target_tennis_started_on: form.elements.memberTennisStartedOn.value || null,
        target_self_ntrp: selfNtrpValue ? Number(selfNtrpValue) : null,
        target_coach_ntrp: coachNtrpValue ? Number(coachNtrpValue) : null,
        target_tennis_goal: form.elements.memberTennisGoal.value.trim(),
        target_play_style_memo: form.elements.memberPlayStyleMemo.value.trim(),
      });
    } else if (action === "app_link") {
      const sourceSignupUserId = form.elements.sourceSignupUserId?.value || "";
      if (!sourceSignupUserId) throw new Error("source_signup_not_linked");
      linkedSourceSignupUserId = sourceSignupUserId;
      result = await client.rpc("tn_admin_replace_member_login", {
        target_member_user_id: member.serverUserId,
        source_signup_user_id: sourceSignupUserId,
        target_reason: reason,
      });
    } else if (action === "extend") {
      const nextExpiresOn = form.elements.extendedExpiresOn?.value || "";
      if (!ticket?.serverTicketId || !nextExpiresOn || nextExpiresOn <= String(ticket.expires || "")) {
        throw new Error("member_ticket_extension_date_must_increase");
      }
      let expectedUpdatedAt = String(ticket.serverUpdatedAt || "");
      if (!expectedUpdatedAt) {
        const revisionResponse = await client.rpc("tn_admin_member_ticket_revision", {
          target_ticket_id: ticket.serverTicketId,
        });
        expectedUpdatedAt = String(revisionResponse?.updatedAt || revisionResponse?.updated_at || "");
      }
      if (!expectedUpdatedAt) throw new Error("member_ticket_expected_updated_at_required");
      result = await client.rpc("tn_admin_extend_member_ticket_period", {
        target_ticket_id: ticket.serverTicketId,
        target_expires_on: nextExpiresOn,
        target_expected_updated_at: expectedUpdatedAt,
        target_reason: reason,
      });
      window.TennisNoteScheduleRevision?.notify?.(ticket.branchId);
    } else if (action === "correct") {
      result = operationsRole() === "admin"
        ? await client.rpc("tn_admin_update_member_record_with_payment", {
          target_record: managementPayload,
        })
        : await client.rpc("tn_update_member_ticket_lifecycle", {
          target_ticket_id: ticket.serverTicketId,
          target_total_sessions: Number(form.elements.totalSessions.value),
          target_used_sessions: Number(form.elements.usedSessions.value),
          target_remaining_sessions: Number(form.elements.remainingSessions.value),
          target_starts_on: form.elements.startsOn.value,
          target_expires_on: form.elements.expiresOn.value,
          target_schedule_scope: form.elements.scheduleScope.value,
          target_status: form.elements.ticketStatus.value,
          target_reason: reason,
        });
    } else if (action === "expire") {
      result = await client.rpc("tn_expire_member_ticket", {
        target_ticket_id: ticket.serverTicketId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "close") {
      result = await client.rpc("tn_admin_close_member_ticket_and_future_lessons", {
        target_user_id: member.serverUserId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "force_delete") {
      result = await client.rpc("tn_admin_force_delete_member_ticket", {
        target_ticket_id: ticket.serverTicketId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "permanent_delete") {
      result = await client.rpc("tn_admin_permanently_delete_inactive_member", {
        target_user_id: member.serverUserId,
      });
      state.memberFilter = "inactive";
      state.selectedMemberId = null;
    } else if (action === "reenroll") {
      result = await client.rpc("tn_reenroll_member_database_ticket", {
        target_source_ticket_id: ticket.serverTicketId,
        target_product_id: form.elements.productId.value,
        target_coach_role_id: form.elements.coachRoleId.value,
        target_total_sessions: Number(form.elements.totalSessions.value),
        target_used_sessions: Number(form.elements.usedSessions.value),
        target_remaining_sessions: Number(form.elements.remainingSessions.value),
        target_starts_on: form.elements.startsOn.value,
        target_expires_on: form.elements.expiresOn.value,
        target_purchased_price: Number(form.elements.purchasedPrice.value),
        target_reason: reason,
      });
      state.memberFilter = "active";
    } else if (["deactivate", "restore"].includes(action)) {
      result = await client.rpc("tn_set_member_operational_status", {
        target_user_id: member.serverUserId,
        target_status: action === "deactivate" ? "inactive" : "active",
        target_reason: reason,
      });
      state.memberFilter = action === "deactivate" ? "inactive" : "expired";
    }

    window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    closeMemberManagementModal();

    const requiresFullRefresh = ["create", "assign", "close", "force_delete", "permanent_delete"].includes(action);
    const synced = requiresFullRefresh
      ? await syncAdminLiveData(true)
      : await loadAdminMemberDetail(member, { force: true, renderResult: false });
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    if (linkedSourceSignupUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(member.serverUserId));
      if (!linkedMember?.authLinked) throw new Error("member_login_link_not_confirmed");
    }
    if (linkedTargetMemberUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(linkedTargetMemberUserId));
      if (!linkedMember?.authLinked) throw new Error("member_login_link_not_confirmed");
    }
    const verificationError = memberManagementWriteVerification(action, managementPayload, result, statusAction);
    if (verificationError) throw new Error(verificationError);
    const normalizedResult = normalizedRpcResult(result);
    if (action === "link_existing" && linkedTargetMemberUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(linkedTargetMemberUserId));
      state.selectedMemberId = linkedMember?.id || null;
      state.memberFilter = linkedMember ? memberListStatus(linkedMember) : "active";
    } else if ((isCreate || action === "assign") && normalizedResult.userId) {
      state.selectedMemberId = members.find((item) => item.serverUserId === normalizedResult.userId)?.id || null;
    } else if (member?.serverUserId) {
      const refreshedMember = members.find((item) => memberServerUserIds(item).includes(member.serverUserId));
      if (refreshedMember) {
        state.selectedMemberId = refreshedMember.id;
        state.memberFilter = memberListStatus(refreshedMember);
      }
    }
    $$("[data-member-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.memberFilter === state.memberFilter));
    renderMembers();
    if (isCreate) {
      const createdTicketId = normalizedResult.ticketId || result?.ticket_id || "";
      const createdTicket = tickets.find((item) => item.serverTicketId === createdTicketId);
      if (normalizedResult.scheduleCreated) {
        state.scheduleEditMode = false;
        showToast("회원·회원권·정규시간표 등록 완료");
      } else if (normalizedResult.scheduleDeferred && memberManagementProductSupportsRegularSchedule(selectedManagementProduct)) {
        state.pinnedLessonTicketId = createdTicket?.id || "";
        state.scheduleEditMode = true;
        setView("schedule");
        showToast("회원권 등록 완료 · 시간표에서 첫 수업을 선택해 주세요.");
      } else {
        showToast("회원·회원권 등록 완료");
      }
    } else {
      showToast(`${memberManagementActionLabel(action)} 완료`);
    }
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    if (message) message.textContent = memberManagementModalState.message;
    showToast(memberManagementModalState.message);
    if (submit) {
      submit.disabled = false;
      submit.textContent = action === "profile"
        ? "기본정보 저장"
        : action === "app_link"
          ? "앱 계정 연결"
          : `${memberManagementActionLabel(action)} 확정`;
    }
  }
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

async function loadMemberEditorModeFromServer() {
  if (operationsRole() === "admin" && isAdminUnlocked() && !memberAdminEditEnabled) {
    memberAdminEditEnabled = true;
    memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
  }
  renderMemberEditorModeBar();
  return true;
}

function setMemberAdminEditEnabled(enabled) {
  memberAdminEditEnabled = Boolean(enabled);
  memberAdminEditExpiresAt = memberAdminEditEnabled ? Date.now() + memberAdminEditTimeoutMs : 0;
  state.inlineMemberId = null;
  state.inlineMemberTicketId = "";
  renderMembers();
  showToast(memberAdminEditEnabled ? "회원 수정 잠금을 해제했습니다." : "회원 수정을 잠갔습니다.");
}

function openMemberInlineEditor(memberId, ticketId = "") {
  memberAdminEditEnabled = true;
  memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
  state.inlineMemberId = Number(memberId);
  state.inlineMemberTicketId = String(ticketId || "");
  renderMembers();
  window.setTimeout(() => {
    const form = document.querySelector(`[data-member-inline-form="${Number(memberId)}"][data-ticket-id="${CSS.escape(String(ticketId || ""))}"]`);
    form?.querySelector("input, select")?.focus();
  }, 0);
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

function createMemberChangeBatchId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
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

function restoreFailedMemberInlineDrafts(drafts = []) {
  drafts.forEach((draft) => {
    const ticketSelector = draft.ticketId
      ? `[data-ticket-id="${CSS.escape(draft.ticketId)}"]`
      : '[data-ticket-id=""]';
    const form = document.querySelector(`[data-member-inline-form="${draft.memberId}"]${ticketSelector}`)
      || document.querySelector(`[data-member-inline-form="${draft.memberId}"]`);
    if (!form) return;
    if (form.elements.productId && draft.values.productId !== undefined) {
      form.elements.productId.value = draft.values.productId;
      syncMemberQuickEditorProduct(form);
    }
    memberInlineDraftFieldNames.forEach((name) => {
      if (name === "productId" || draft.values[name] === undefined || !form.elements[name]) return;
      form.elements[name].value = draft.values[name];
    });
    syncMemberQuickEditorSchedule(form);
    if (form.elements.totalSessions && form.elements.usedSessions) syncMemberManagementBalance(form);
    setMemberInlineDirtyState(form, true);
    form.classList.add("is-save-error");
    const message = form.querySelector(".member-inline-message");
    if (message) message.textContent = "저장하지 못한 입력값을 유지했습니다. 오류를 확인한 뒤 다시 저장해 주세요.";
    updateMemberInlineToolbar();
  });
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

async function loadMemberManagementPolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  try {
    const result = await client.rpc("tn_member_management_policy", {});
    Object.assign(memberManagementPolicy, normalizeMemberManagementPolicy(result || {}));
    renderMemberManagementPolicySettings();
    return true;
  } catch {
    Object.assign(memberManagementPolicy, defaultMemberManagementPolicy);
    renderMemberManagementPolicySettings();
    return false;
  }
}

async function saveMemberManagementPolicySettings() {
  if (!adminApprovalReady()) {
    showToast("관리자 계정으로 로그인해 주세요");
    return;
  }
  const target = $("#memberManagementPolicySettings");
  const policy = {};
  target?.querySelectorAll("[data-member-policy]").forEach((input) => {
    policy[input.dataset.memberPolicy] = input.checked;
  });
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_save_member_management_policy", {
      target_policy: policy,
    });
    Object.assign(memberManagementPolicy, normalizeMemberManagementPolicy(result || policy));
    renderMemberManagementPolicySettings();
    renderMembers();
    showToast("회원관리 권한 저장 완료");
  } catch {
    showToast("권한 저장 실패 · 관리자 권한과 DB 적용을 확인해 주세요");
  }
}

function applyNotificationOverview(payload = {}, source = "server") {
  Object.assign(notificationDeliveryState, normalizeNotificationOverview(payload, source));
  renderNotificationPolicySettings();
  renderDashboardNoticeSummary();
}

async function loadNotificationPolicyFromServer() {
  const client = liveNoticeClient();
  if (!client?.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: notificationPolicyKey },
      limit: 1,
    });
    if (rows?.[0]?.value) {
      Object.assign(notificationPolicySettings, normalizeNotificationPolicy({
        ...rows[0].value,
        updatedAt: rows[0].value.updatedAt || rows[0].updated_at,
      }));
      saveSnapshot();
    }
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return true;
  } catch {
    return false;
  }
}

async function loadNotificationDeliveryStatus() {
  const client = liveNoticeClient();
  if (!client?.selectRows) {
    Object.assign(notificationDeliveryState, {
      status: "offline",
      message: "관리자 로그인 후 확인",
      checkedAt: "",
    });
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return false;
  }

  try {
    if (client.rpc) {
      try {
        const overview = await client.rpc("tn_admin_notification_overview", {});
        if (overview && typeof overview === "object") {
          applyNotificationOverview(Array.isArray(overview) ? overview[0] || {} : overview, "server");
          return true;
        }
      } catch (rpcError) {
        const message = String(rpcError?.message || rpcError || "");
        if (!message.includes("tn_admin_notification_overview") && !message.includes("PGRST202")) throw rpcError;
      }
    }

    const rows = await client.selectRows("tn_notifications", {
      select: "id,template_key,title,status,scheduled_at,sent_at,created_at,last_error",
      limit: 200,
    });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const appRows = Array.isArray(rows) ? rows : [];
    const recent = [...appRows]
      .sort((a, b) => String(b.sent_at || b.scheduled_at || b.created_at || "").localeCompare(String(a.sent_at || a.scheduled_at || a.created_at || "")))
      .slice(0, 8);
    applyNotificationOverview({
      queued: appRows.filter((row) => row.status === "queued").length,
      sentToday: appRows.filter((row) => (
        row.status === "sent"
        && row.sent_at
        && new Date(row.sent_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === today
      )).length,
      failed: appRows.filter((row) => row.status === "failed" && new Date(row.created_at || 0).getTime() >= sevenDaysAgo).length,
      activeDevices: null,
      recent,
      generatedAt: new Date().toISOString(),
    }, "fallback");
    return true;
  } catch {
    Object.assign(notificationDeliveryState, {
      status: "blocked",
      message: "서버 권한 또는 알림 패치 확인 필요",
      checkedAt: new Date().toISOString(),
    });
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return false;
  }
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

async function saveNotificationPolicySettings() {
  const policy = readNotificationPolicyForm();
  Object.assign(notificationPolicySettings, policy);
  saveSnapshot();
  const client = liveNoticeClient();
  let result = "local";

  if (client?.rpc) {
    try {
      const saved = await client.rpc("tn_admin_save_notification_policy", { target_policy: policy });
      Object.assign(notificationPolicySettings, normalizeNotificationPolicy(Array.isArray(saved) ? saved[0] || policy : saved || policy));
      result = "server";
    } catch (rpcError) {
      const message = String(rpcError?.message || rpcError || "");
      if (!message.includes("tn_admin_save_notification_policy") && !message.includes("PGRST202")) result = "blocked";
    }
  }

  if (result === "local" && client?.insertRows && client?.updateRows) {
    try {
      const updated = await client.updateRows("tn_admin_settings", { key: notificationPolicyKey }, {
        value: policy,
        updated_at: new Date().toISOString(),
      });
      if (!updated?.length) await client.insertRows("tn_admin_settings", { key: notificationPolicyKey, value: policy });
      result = "server";
    } catch {
      result = "blocked";
    }
  }

  if (result === "blocked") {
    Object.assign(notificationDeliveryState, {
      status: "blocked",
      message: "알림 설정 서버 미반영",
      checkedAt: new Date().toISOString(),
    });
  } else if (result === "local") {
    Object.assign(notificationDeliveryState, {
      status: "offline",
      message: "로컬 설정 · 관리자 로그인 필요",
      checkedAt: new Date().toISOString(),
    });
  }

  saveSnapshot();
  renderNotificationPolicySettings();
  renderDashboardNoticeSummary();
  if (result === "server") {
    showToast("자동 알림 설정을 서버에 저장했습니다");
    await loadNotificationDeliveryStatus();
    return;
  }
  showToast(result === "blocked" ? "로컬 저장 완료 · 서버 알림 패치 확인 필요" : "자동 알림 설정 저장 완료");
}

function exportVisibleMembers(allMembers = members) {
  const visibleMembers = filteredMembers();
  const bodyRows = visibleMembers.flatMap((member) => {
    const memberTickets = memberOperationalTickets(member);
    return (memberTickets.length ? memberTickets : [null]).map((ticket) => {
      const record = memberDatabaseRecord(member, ticket);
      const payment = ticket ? null : latestMemberPayment(member);
      return [
        member.name,
        member.phone || "",
        member.birthYear || "",
        member.neighborhood || "",
        memberGenderLabel(member.gender),
        ticket?.coach || member.coach,
        memberManagementLessonMethodLabel(record, ticket),
        memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
        memberManagementLessonDaysLabel(record, ticket),
        record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || "",
        record?.total_sessions ?? ticket?.total ?? "",
        record?.used_sessions ?? ticket?.used ?? "",
        record?.remaining_sessions ?? ticket?.remaining ?? "",
        record?.payment_recorded_on || payment?.paidAt || payment?.verifiedAt || "",
        record ? paymentMethodLabel(record.payment_method) : paymentMethodLabel(payment?.method),
        record?.payment_amount ?? payment?.finalAmount ?? payment?.amount ?? "",
        record ? record.admin_note || "" : member.note || "",
      ];
    });
  });
  const rows = [["이름", "전화번호", "출생년도", "거주동", "성별", "레슨강사", "레슨방식", "레슨종류", "레슨요일", "레슨시작일", "총회차", "소진회차", "잔여회차", "결제일자", "결제수단", "결제금액", "비고"], ...bodyRows];
  downloadRowsAsCsv(`tennis-note-allMembers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast(`${visibleMembers.length}명 · 회원권 ${bodyRows.length}행을 내보냈습니다`);
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

function memberInlineScheduleIsComplete(form, schedules = memberInlineScheduleValues(form)) {
  const product = (adminLiveDataState.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || String(product.product_kind || "regular") !== "regular") return false;
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const requiredCount = memberRegularScheduleFrequency(product, ticket);
  return schedules.length === requiredCount
    && schedules.every((slot) => memberScheduleDayOrder.includes(slot.dayOfWeek) && /^\d{2}:\d{2}$/.test(slot.startTime));
}

function syncMemberInlineFutureScheduleChoice(form) {
  if (!form?.dataset.ticketId || !form.elements.applyToFutureSchedule) return;
  const schedules = memberInlineScheduleValues(form);
  if (memberInlineTicketDefinitionChanged(form) && memberInlineScheduleIsComplete(form, schedules)) {
    form.elements.applyToFutureSchedule.value = "true";
  }
}

function keepMemberInlineScheduleSeparate(form) {
  if (!form?.elements.applyToFutureSchedule) return;
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

async function assignMemberTicketCoach(button) {
  const ticketId = button?.dataset.saveTicketCoach || "";
  const ticket = tickets.find((item) => item.serverTicketId === ticketId);
  const select = button?.closest(".member-coach-assignment")?.querySelector("[data-ticket-coach-select]");
  const coachRoleId = select?.value || null;
  const client = window.TennisNoteDataClient;
  if (!ticket || !select || !client?.rpc || !adminApprovalReady()) {
    showToast("관리자 로그인과 이용권 정보를 확인해주세요");
    return;
  }

  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "저장 중";
  try {
    await client.rpc("tn_admin_assign_ticket_coach", {
      target_ticket_id: ticketId,
      target_coach_role_id: coachRoleId,
    });
    await syncAdminLiveData();
    const coach = coaches.find((item) => item.serverRoleId === coachRoleId);
    showToast(coach ? `${coach.name} 담당 코치 지정 완료` : "담당 코치 미배정 처리 완료");
  } catch (error) {
    const message = String(error?.message || "");
    showToast(message.includes("approved_branch_coach_required") ? "같은 지점의 승인 코치를 선택해주세요" : "담당 코치 저장에 실패했습니다");
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
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

function syncMemberTicketPartnerField(setup) {
  const groupSize = Number(setup?.querySelector("[data-ticket-group-size]")?.value || 1);
  const partnerField = setup?.querySelector("[data-ticket-partner-field]");
  const partnerSearch = setup?.querySelector("[data-ticket-partner-search]");
  const partnerSelect = setup?.querySelector("[data-ticket-partner-user]");
  if (!partnerField || !partnerSearch || !partnerSelect) return;
  const enabled = groupSize === 2 && setup.dataset.ticketOwnerView === "true" && adminApprovalReady();
  partnerField.hidden = groupSize !== 2;
  partnerSearch.disabled = !enabled;
  partnerSelect.disabled = !enabled;
  if (groupSize !== 2) partnerSearch.value = "";
  filterMemberTicketPartnerOptions(setup);
}

async function saveMemberTicketLessonSetup(button) {
  const ticketId = button?.dataset.saveTicketLessonSetup || "";
  const setup = button?.closest("[data-ticket-lesson-setup]");
  const groupSize = Number(setup?.querySelector("[data-ticket-group-size]")?.value || 1);
  const durationMinutes = Number(setup?.querySelector("[data-ticket-duration-minutes]")?.value || 20);
  const partnerUserId = groupSize === 2
    ? setup?.querySelector("[data-ticket-partner-user]")?.value || ""
    : null;
  const client = window.TennisNoteDataClient;
  if (!ticketId || !setup || setup.dataset.ticketOwnerView !== "true" || !client?.rpc || !adminApprovalReady()) {
    showToast("관리자 로그인과 이용권 정보를 확인해주세요");
    return;
  }
  if (groupSize === 2 && !partnerUserId) {
    showToast("2대1 수업은 파트너를 선택해주세요");
    return;
  }

  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "저장 중";
  try {
    await client.rpc("tn_admin_update_ticket_lesson_setup", {
      target_ticket_id: ticketId,
      target_group_size: groupSize,
      target_lesson_minutes: durationMinutes,
      target_partner_user_id: partnerUserId || null,
    });
    await syncAdminLiveData();
    showToast(`${groupSize === 2 ? "2대1 그룹" : "개인 1대1"} · ${durationMinutes}분 설정 완료`);
  } catch (error) {
    showToast(memberTicketLessonSetupError(error));
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
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

function syncOnsitePaymentSourceTickets(options = {}) {
  const select = $("#onsitePaymentSourceTicket");
  if (!select) return;
  const previousValue = select.value;
  const sourceTickets = onsitePaymentSourceTickets();
  select.innerHTML = `
    <option value="">첫 회원권 등록</option>
    ${sourceTickets.map((ticket) => `<option value="${escapeHtml(ticket.serverTicketId)}">기존 회원권 연장 · ${escapeHtml(onsitePaymentTicketLabel(ticket))}</option>`).join("")}`;
  if (options.preserveEmpty && previousValue === "") select.value = "";
  else if (sourceTickets.some((ticket) => ticket.serverTicketId === previousValue)) select.value = previousValue;
  else select.value = sourceTickets[0]?.serverTicketId || "";
  const selectedTicket = sourceTickets.find((ticket) => ticket.serverTicketId === select.value) || null;
  if ($("#onsitePaymentTitle")) $("#onsitePaymentTitle").textContent = selectedTicket ? "회원권 연장·결제 등록" : "첫 회원권·결제 등록";
  const submitButton = $("#onsitePaymentForm button[type='submit']");
  if (submitButton) submitButton.textContent = selectedTicket ? "연장과 결제 함께 저장" : "회원권과 결제 함께 저장";
  const matchingProduct = onsitePaymentProducts().find(({ server }) => String(server.id) === String(selectedTicket?.productId || ""));
  if (matchingProduct && $("#onsitePaymentProduct")) $("#onsitePaymentProduct").value = String(matchingProduct.server.id);
  syncOnsitePaymentCoaches();
  updateOnsitePaymentAmount();
  syncOnsitePaymentScheduleChoice();
}

function syncOnsitePaymentCoaches() {
  const select = $("#onsitePaymentCoach");
  if (!select) return;
  const sourceTicket = onsitePaymentSourceTickets().find((ticket) => ticket.serverTicketId === $("#onsitePaymentSourceTicket")?.value) || null;
  const selectedProduct = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const productBranchId = String(selectedProduct?.server?.branch_id || activeOperationBranchId() || "");
  const activeCoaches = operationBranchCoaches()
    .filter((coach) => coach.status === "active" && coach.serverRoleId)
    .filter((coach) => !productBranchId || !coach.branchId || String(coach.branchId) === productBranchId);
  const sourceCoachRoleId = String(sourceTicket?.coachRoleId || "");
  const previousValue = select.value;
  select.innerHTML = activeCoaches.length
    ? activeCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}">${escapeHtml(coach.name)}</option>`).join("")
    : '<option value="">승인된 담당 코치 없음</option>';
  const preferredValue = sourceCoachRoleId || previousValue;
  if (activeCoaches.some((coach) => String(coach.serverRoleId) === preferredValue)) select.value = preferredValue;
  select.disabled = Boolean(sourceTicket);
}

function syncOnsitePaymentScheduleChoice() {
  const ticket = onsitePaymentSourceTickets().find((item) => item.serverTicketId === $("#onsitePaymentSourceTicket")?.value);
  const product = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const checkbox = $("#onsitePaymentKeepSchedule");
  if (!checkbox) return;
  if (!ticket) {
    checkbox.disabled = true;
    checkbox.checked = false;
    return;
  }
  const compatible = Boolean(ticket && product
    && String(ticket.productKind || "regular") === "regular"
    && String(product.server.product_kind || "regular") === "regular"
    && Number(ticket.groupSize || 1) === Number(product.server.group_size || 1));
  checkbox.disabled = !compatible;
  if (!compatible) checkbox.checked = false;
}

function updateOnsitePaymentAmount() {
  const product = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const method = $("#onsitePaymentMethod")?.value || "bank_transfer";
  const amount = Number(method === "card" ? product?.server?.card_price : product?.server?.cash_price) || 0;
  if ($("#onsitePaymentAmount")) $("#onsitePaymentAmount").value = String(Math.max(0, Math.round(amount)));
}

function closeOnsitePaymentModal() {
  $("#onsitePaymentModal")?.setAttribute("hidden", "");
}

function openOnsitePaymentModal() {
  if (!adminApprovalReady() && !adminLocalPreviewMode) {
    showToast("관리자 권한으로 로그인해 주세요.");
    return;
  }
  const memberSelect = $("#onsitePaymentMember");
  const eligibleMembers = operationBranchMembers()
    .filter((member) => memberServerUserIds(member).length)
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "ko"));
  memberSelect.innerHTML = eligibleMembers.length
    ? eligibleMembers.map((member) => `<option value="${escapeHtml(memberServerUserIds(member)[0])}">${escapeHtml(member.name)}</option>`).join("")
    : '<option value="">연결된 회원 없음</option>';
  const productSelect = $("#onsitePaymentProduct");
  const products = onsitePaymentProducts();
  productSelect.innerHTML = products.length
    ? products.map(({ draft, server }) => `<option value="${escapeHtml(server.id)}">${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`).join("")
    : '<option value="">판매 중인 회원권 없음</option>';
  $("#onsitePaymentDate").value = adminLocalDateKey(new Date());
  $("#onsitePaymentStartDate").value = "";
  $("#onsitePaymentMessage").textContent = "";
  syncOnsitePaymentSourceTickets();
  $("#onsitePaymentModal")?.removeAttribute("hidden");
  window.setTimeout(() => memberSelect?.focus(), 0);
}

async function submitOnsitePayment(event) {
  event.preventDefault();
  const userId = $("#onsitePaymentMember")?.value || "";
  const sourceTicketId = $("#onsitePaymentSourceTicket")?.value || "";
  const productId = $("#onsitePaymentProduct")?.value || "";
  const coachRoleId = $("#onsitePaymentCoach")?.value || "";
  const paymentMethod = $("#onsitePaymentMethod")?.value || "";
  const paymentDate = $("#onsitePaymentDate")?.value || "";
  const paymentAmount = Number($("#onsitePaymentAmount")?.value);
  if (!userId || !productId || !coachRoleId || !paymentDate || !Number.isInteger(paymentAmount) || paymentAmount <= 0) {
    $("#onsitePaymentMessage").textContent = "회원, 회원권 상품, 담당 코치, 결제일, 실제 결제금액을 확인해 주세요.";
    return;
  }
  const submit = event.submitter || $("#onsitePaymentForm button[type='submit']");
  submit.disabled = true;
  $("#onsitePaymentMessage").textContent = "현장결제와 회원권을 서버에 저장하고 있습니다.";
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_record_onsite_payment_v3", {
      target_user_id: userId,
      target_source_ticket_id: sourceTicketId || null,
      target_product_id: productId,
      target_coach_role_id: coachRoleId,
      target_payment_method: paymentMethod,
      target_payment_date: paymentDate,
      target_payment_amount: paymentAmount,
      target_starts_on: $("#onsitePaymentStartDate")?.value || null,
      target_keep_schedule: Boolean($("#onsitePaymentKeepSchedule")?.checked),
      target_operation_key: createAdminOperationKey("onsite-payment"),
    });
    if (!result?.ok) throw new Error(result?.error || "onsite_payment_not_saved");
    await syncAdminLiveData(true);
    await loadServerPaymentsIntoBilling({ silent: true });
    closeOnsitePaymentModal();
    renderBilling();
    showToast("현장결제 기록과 회원권 발급이 저장됐습니다.");
  } catch (error) {
    const raw = String(error?.message || error?.payload?.message || "");
    $("#onsitePaymentMessage").textContent = raw.includes("source_ticket_not_found")
      ? "선택한 기존 회원권을 찾지 못했습니다. 첫 회원권 등록 또는 다른 회원권을 선택해 주세요."
      : raw.includes("onsite_payment_group_partner_required")
        ? "2대1 첫 등록은 파트너 연결이 필요합니다. 회원관리에서 파트너를 먼저 연결해 주세요."
      : raw.includes("onsite_payment_schedule_incompatible")
        ? "상품 형태가 달라 기존 고정시간을 이어갈 수 없습니다. 고정시간 연장을 끄고 다시 저장해 주세요."
      : raw.includes("operation_key_reused_with_different_payload")
        ? "저장 내용이 변경됐습니다. 결제창을 닫았다가 다시 열어 주세요."
      : "저장하지 못했습니다. 회원·상품·권한을 확인해 주세요.";
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

function syncMemberBulkRenewalFields() {
  const action = $("#memberBulkAction")?.value || "";
  const fields = $("#memberBulkRenewalFields");
  if (!fields) return;
  fields.hidden = action !== "reenroll";
  if (fields.hidden) return;

  const productSelect = $("#memberBulkRenewalProduct");
  if (productSelect) {
    const previousValue = productSelect.value;
    const products = membershipProductsForActiveOperationProfile()
      .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
      .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled");
    productSelect.innerHTML = products.length
      ? products.map(({ draft, server }) => `<option value="${escapeHtml(server.id)}">${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`).join("")
      : '<option value="">판매 중인 회원권 없음</option>';
    if (products.some(({ server }) => String(server.id) === previousValue)) productSelect.value = previousValue;
  }
  const paymentDate = $("#memberBulkRenewalPaymentDate");
  if (paymentDate && !paymentDate.value) paymentDate.value = adminLocalDateKey(new Date());
}

async function runMemberBulkAction() {
  const selectedMembers = members.filter((member) => selectedMemberIdSet().has(Number(member.id)) && memberServerUserIds(member).length);
  const selectedUserIds = [...new Set(selectedMembers.flatMap(memberServerUserIds))];
  const action = $("#memberBulkAction")?.value || "";
  if (!selectedMembers.length || !action) {
    showToast("회원과 일괄 작업을 선택해 주세요.");
    return;
  }
  const actionLabel = $("#memberBulkAction")?.selectedOptions?.[0]?.textContent || "일괄 작업";
  if (!window.confirm(`${selectedMembers.length}명에게 '${actionLabel}' 작업을 적용할까요?`)) return;
  const button = $("#runMemberBulkAction");
  if (button) button.disabled = true;
  try {
    if (action === "permanent_delete") {
      const eligibleMembers = selectedMembers.filter((member) => (
        member.serverUserId
        && memberListStatus(member) === "inactive"
        && member.authRole !== "admin"
      ));
      if (eligibleMembers.length !== selectedMembers.length) {
        throw new Error("permanent_delete_inactive_members_only");
      }
      const failedMemberIds = [];
      for (const member of eligibleMembers) {
        try {
          await window.TennisNoteDataClient.rpc("tn_admin_permanently_delete_inactive_member", {
            target_user_id: member.serverUserId,
          });
        } catch (error) {
          failedMemberIds.push(Number(member.id));
        }
      }
      await syncAdminLiveData(true);
      const deletedServerIds = new Set(eligibleMembers
        .filter((member) => !failedMemberIds.includes(Number(member.id)))
        .map((member) => String(member.serverUserId)));
      const unconfirmedIds = members
        .filter((member) => deletedServerIds.has(String(member.serverUserId)))
        .map((member) => Number(member.id));
      const remainingIds = [...new Set([...failedMemberIds, ...unconfirmedIds])];
      state.selectedMemberIds = remainingIds;
      renderMembers();
      if (remainingIds.length) {
        showToast(`${eligibleMembers.length - remainingIds.length}명 영구 삭제 · ${remainingIds.length}명 확인 필요`);
      } else {
        showToast(`${eligibleMembers.length}명 영구 삭제 완료`);
      }
      return;
    }
    if (action === "reenroll") {
      const productId = $("#memberBulkRenewalProduct")?.value || "";
      const paymentMethod = $("#memberBulkRenewalPaymentMethod")?.value || "";
      const paymentDate = $("#memberBulkRenewalPaymentDate")?.value || "";
      const startsOn = $("#memberBulkRenewalStartDate")?.value || null;
      const keepSchedule = Boolean($("#memberBulkRenewalKeepSchedule")?.checked);
      if (!productId || !["card", "bank_transfer"].includes(paymentMethod) || !paymentDate) {
        throw new Error("bulk_reenrollment_fields_required");
      }
      let processedCount = 0;
      const failedRows = [];
      for (const [batchIndex, userIds] of chunkedValues(selectedUserIds).entries()) {
        const result = await window.TennisNoteDataClient.rpc("tn_admin_bulk_reenroll_members", {
          target_user_ids: userIds,
          target_product_id: productId,
          target_payment_method: paymentMethod,
          target_payment_date: paymentDate,
          target_starts_on: startsOn,
          target_keep_schedule: keepSchedule,
          target_operation_key: `${createAdminOperationKey("member-bulk-reenroll")}-${batchIndex + 1}`,
        });
        processedCount += Number(result?.processedCount ?? result?.processed_count ?? 0);
        if (Array.isArray(result?.failed)) failedRows.push(...result.failed);
      }
      const resultNode = $("#memberBulkRenewalResult");
      if (resultNode) {
        resultNode.classList.toggle("is-error", Boolean(failedRows.length));
        resultNode.textContent = failedRows.length
          ? `${processedCount}명 완료 · ${failedRows.length}명 확인 필요: ${failedRows.map((row) => row.name || row.reason || "확인 필요").join(", ")}`
          : `${processedCount}명 재등록과 회원권 연장이 완료되었습니다.`;
      }
      await syncAdminLiveData(true);
      state.selectedMemberIds = failedRows.length
        ? members.filter((member) => failedRows.some((row) => String(row.userId || row.user_id) === String(member.serverUserId))).map((member) => Number(member.id))
        : [];
      renderMembers();
      showToast(failedRows.length ? `${processedCount}명 완료 · ${failedRows.length}명 확인 필요` : `${processedCount}명 일괄 재등록 완료`);
      return;
    }
    let processedCount = 0;
    let ticketCount = 0;
    let pendingMemberCount = 0;
    let skippedCount = 0;
    for (const userIds of chunkedValues(selectedUserIds)) {
      const result = await window.TennisNoteDataClient.rpc("tn_admin_bulk_member_action", {
        target_user_ids: userIds,
        target_action: action,
        target_coach_role_id: action === "assign_coach" ? ($("#memberBulkCoach")?.value || null) : null,
        target_reason: `관리자 회원 목록 · ${actionLabel}`,
      });
      processedCount += Number(result?.processedCount ?? result?.processed_count ?? 0);
      ticketCount += Number(result?.ticketCount ?? result?.ticket_count ?? 0);
      pendingMemberCount += Number(result?.pendingMemberCount ?? result?.pending_member_count ?? 0);
      skippedCount += Number(result?.skippedCount ?? result?.skipped_count ?? 0);
    }
    if (!processedCount) throw new Error("bulk_member_no_changes");
    await syncAdminLiveData();
    state.selectedMemberIds = [];
    renderMembers();
    if (action === "expire_tickets") {
      const details = [
        ticketCount ? `회원권 ${ticketCount}건` : "회원권 없음",
        pendingMemberCount ? `가입대기 ${pendingMemberCount}명` : "",
        skippedCount ? `확인 필요 ${skippedCount}명` : "",
      ].filter(Boolean).join(" · ");
      showToast(`${processedCount}명 만료회원 전환 완료 · ${details}`);
    } else {
      showToast(`${processedCount}명 일괄 처리 완료${skippedCount ? ` · ${skippedCount}명 확인 필요` : ""}`);
    }
  } catch (error) {
    const message = `${error?.message || ""}`;
    showToast(message.includes("tn_admin_bulk_member_action") || message.includes("PGRST202")
      ? "회원 일괄 처리 DB 패치를 먼저 적용해 주세요."
      : message.includes("bulk_member_no_changes")
        ? "변경된 회원이 없습니다. 회원 연결 상태를 확인해 주세요."
      : message.includes("permanent_delete_inactive_members_only")
        ? "삭제회원만 영구 삭제할 수 있습니다. 선택한 회원 상태를 확인해 주세요."
      : "회원 일괄 처리에 실패했습니다. 권한과 회원 상태를 확인해 주세요.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
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

function positionMemberQuickEditPopover() {
  const popover = $("#memberQuickEditPopover");
  const anchor = document.querySelector(`[data-open-member-inline="${state.inlineMemberId || ""}"]`);
  if (!popover || popover.hidden || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  const maxLeft = Math.max(margin, window.innerWidth - popover.offsetWidth - margin);
  popover.style.left = `${Math.min(maxLeft, Math.max(margin, rect.right + 8))}px`;
  popover.style.top = `${Math.min(
    Math.max(margin, window.innerHeight - popover.offsetHeight - margin),
    Math.max(margin, rect.top - 12),
  )}px`;
}

function syncMemberQuickEditorProduct(form) {
  if (!form?.classList.contains("member-inline-editor--compact")) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const groupSize = Number(product?.group_size || 1);
  const groupProduct = Boolean(product) && groupSize === 2;
  const partnerField = form.querySelector("[data-member-quick-partner]");
  const partnerEmpty = form.querySelector("[data-member-quick-partner-empty]");
  if (form.elements.partnerUserId) {
    form.elements.partnerUserId.disabled = !groupProduct;
    form.elements.partnerUserId.required = groupProduct;
  }
  if (form.elements.partnerSearch) form.elements.partnerSearch.disabled = !groupProduct;
  const partnerSearchFields = form.querySelector("[data-manual-existing-partner]");
  if (partnerSearchFields) partnerSearchFields.hidden = !groupProduct;
  if (partnerField) partnerField.hidden = false;
  if (partnerEmpty) partnerEmpty.hidden = groupProduct;
  if (!groupProduct && form.elements.partnerSearch) form.elements.partnerSearch.value = "";
  filterManualMemberPartnerOptions(form);
  syncMemberQuickEditorSchedule(form, product);
  if (!product) return;
  form.elements.lessonType.value = groupProduct ? "one_on_two" : "one_on_one";
  const productScope = memberManagementProductScheduleScope(product);
  form.elements.scheduleScope.value = productScope;
  form.elements.weeklyFrequency.value = memberManagementProductWeeklyFrequency(product);
}

function syncMemberQuickEditorSchedule(form, product = null) {
  const panel = form?.querySelector("[data-member-inline-schedule]");
  if (!panel) return;
  const selectedProduct = product || (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  const regularProduct = memberManagementProductSupportsRegularSchedule(selectedProduct);
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const frequency = memberRegularScheduleFrequency(selectedProduct, ticket);
  const scope = memberManagementProductScheduleScope(selectedProduct || {});
  panel.hidden = !regularProduct;
  panel.dataset.productKind = selectedProduct?.product_kind || "";
  let invalidScope = false;
  panel.querySelectorAll("[data-member-schedule-row]").forEach((row, offset) => {
    const enabled = regularProduct && offset < frequency;
    row.hidden = !enabled;
    const dayInput = row.querySelector(`input[name="scheduleDay${offset + 1}"]`);
    const timeInput = row.querySelector(`select[name="scheduleTime${offset + 1}"]`);
    if (dayInput) dayInput.disabled = !enabled;
    if (timeInput) timeInput.disabled = !enabled;
    const selectedDay = Number(dayInput?.value);
    row.querySelectorAll("[data-member-schedule-day]").forEach((button) => {
      const day = Number(button.dataset.memberScheduleDay);
      const selected = String(day) === String(dayInput?.value);
      const allowed = memberScheduleDayAllowed(scope, day);
      button.disabled = !enabled || (!allowed && !selected);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.classList.toggle("is-out-of-scope", selected && !allowed);
    });
    if (enabled && dayInput?.value !== "" && !memberScheduleDayAllowed(scope, selectedDay)) invalidScope = true;
  });
  const warning = panel.querySelector("[data-member-schedule-warning]");
  if (warning) warning.textContent = invalidScope
    ? "회원권의 평일·주말 범위와 기존 요일이 다릅니다. 저장 전 새 요일을 선택해 주세요."
    : "";
}

function syncMemberCreateSchedule(form, product = null) {
  const panel = form?.querySelector("[data-member-create-schedule]");
  if (!panel || !form.elements.createWithoutSchedule) return;
  const selectedProduct = product || (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  const regularProduct = memberManagementProductSupportsRegularSchedule(selectedProduct);
  const scheduleLater = regularProduct && Boolean(form.elements.createScheduleLater?.checked);
  syncMemberQuickEditorSchedule(form, selectedProduct);
  panel.hidden = !regularProduct;
  panel.classList.toggle("is-deferred", scheduleLater);
  form.elements.createWithoutSchedule.value = regularProduct && !scheduleLater ? "false" : "true";
  if (form.elements.createScheduleLater) form.elements.createScheduleLater.disabled = !regularProduct;
  if (!regularProduct) return;
  panel.querySelectorAll("[data-member-schedule-row]").forEach((row) => {
    if (row.hidden) return;
    row.querySelectorAll("input[name^='scheduleDay'], select[name^='scheduleTime'], [data-member-schedule-day]")
      .forEach((control) => { control.disabled = scheduleLater; });
  });
  const warning = panel.querySelector("[data-member-schedule-warning]");
  if (warning && scheduleLater) warning.textContent = "회원과 회원권만 저장한 뒤 시간표에서 정규시간을 설정합니다.";
}

function updateMemberInlineToolbar() {
  const dirtyCount = dirtyMemberInlineForms().length;
  const saveAllButton = $("#saveVisibleMemberRows");
  if (saveAllButton) {
    saveAllButton.hidden = !memberAdminEditEnabled || dirtyCount === 0;
    if (!saveAllButton.disabled) saveAllButton.textContent = `변경 ${dirtyCount}건 저장`;
  }
  const stateTarget = $("#memberEditorModeSaveState");
  if (stateTarget) stateTarget.textContent = !memberAdminEditEnabled
    ? "잠김"
    : dirtyCount ? `저장 대기 ${dirtyCount}건` : "저장 완료";
  const changedButton = $("#showChangedMemberRows");
  const failedButton = $("#showFailedMemberRows");
  if (changedButton) changedButton.hidden = !memberAdminEditEnabled;
  if (failedButton) failedButton.hidden = !memberAdminEditEnabled
    || !document.querySelector("[data-member-inline-form].is-save-error");
  applyMemberInlineRowFilter();
}

function setMemberInlineDirtyState(form, dirty = true) {
  if (!form) return;
  if (dirty) touchMemberAdminEditSession();
  form.dataset.dirty = dirty ? "true" : "false";
  form.classList.toggle("is-dirty", dirty);
  if (dirty) form.classList.remove("is-save-error", "is-save-success");
  const message = form.querySelector(".member-inline-message");
  if (dirty && message && !message.classList.contains("is-error")) {
    message.textContent = "변경됨";
    message.classList.remove("is-success");
  }
  updateMemberInlineToolbar();
}

function applyMemberInlineRowFilter() {
  document.querySelectorAll("[data-member-inline-form]").forEach((form) => {
    const row = form.closest("tr");
    if (!row) return;
    const visible = memberInlineRowFilter === "all"
      || (memberInlineRowFilter === "changed" && form.dataset.dirty === "true")
      || (memberInlineRowFilter === "failed" && form.classList.contains("is-save-error"));
    row.hidden = !visible;
  });
  $("#showChangedMemberRows")?.classList.toggle("is-active", memberInlineRowFilter === "changed");
  $("#showFailedMemberRows")?.classList.toggle("is-active", memberInlineRowFilter === "failed");
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

async function submitMemberInlineEditor(form, options = {}) {
  const refreshAfterSave = options.refreshAfterSave !== false;
  const member = members.find((item) => item.id === Number(form.dataset.memberInlineForm));
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form.dataset.ticketId);
  const message = form.querySelector(".member-inline-message");
  const submit = form.querySelector("button[type='submit']");
  if (!member?.serverUserId || operationsRole() !== "admin") return;
  if (!validateRequiredMemberProfile(form, message)) {
    form.classList.add("is-save-error");
    return false;
  }
  syncMemberQuickEditorProduct(form);
  syncMemberInlineProductCancellation(form);
  const selectedProduct = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  if (ticket || selectedProduct) syncMemberManagementBalance(form);
  const total = selectedProduct ? memberManagementNullableNumber(form.elements.totalSessions) : null;
  const used = selectedProduct ? memberManagementNullableNumber(form.elements.usedSessions) : null;
  if (selectedProduct && (total === null || used === null || total <= 0 || used < 0 || used > total)) {
    message.textContent = "총 회차와 소진 회차를 확인해 주세요.";
    message.classList.add("is-error");
    return;
  }
  if (selectedProduct && (!form.elements.startsOn?.value || !form.elements.expiresOn?.value
    || form.elements.startsOn.value > form.elements.expiresOn.value)) {
    message.textContent = "회원권 시작일과 만료일을 확인해 주세요.";
    message.classList.add("is-error");
    return false;
  }
  if (Number(selectedProduct?.group_size || 1) === 2 && !form.elements.partnerUserId?.value) {
    message.textContent = "2대1 회원권은 파트너를 선택해 주세요.";
    message.classList.add("is-error");
    form.classList.add("is-save-error");
    return false;
  }
  const paymentAmount = memberManagementNullableNumber(form.elements.paymentAmount) || 0;
  const paymentDate = form.elements.paymentDate?.value || "";
  const paymentMethod = form.elements.paymentMethod?.value || "";
  const paymentRecordState = form.elements.paymentRecordState?.value || memberPaymentRecordState({
    payment_recorded_on: paymentDate,
    payment_method: paymentMethod,
    payment_amount: paymentAmount,
  });
  if (paymentRecordState === "complete" && (paymentAmount <= 0 || !paymentDate || !paymentMethod)) {
    message.textContent = "결제 완료는 결제일자, 결제수단, 1원 이상의 결제금액을 모두 입력해 주세요.";
    message.classList.add("is-error");
    return false;
  }
  if (paymentRecordState === "unentered" && (paymentAmount > 0 || paymentDate || paymentMethod)) {
    message.textContent = "결제값을 입력했다면 결제 구분을 결제 완료로 바꿔 주세요.";
    message.classList.add("is-error");
    return false;
  }
  const regularSchedules = memberInlineScheduleValues(form);
  const scheduleSlotsChanged = Boolean(ticket && selectedProduct
    && String(selectedProduct.product_kind || "regular") === "regular")
    && memberInlineScheduleChanged(form, regularSchedules);
  const ticketDefinitionChanged = memberInlineTicketDefinitionChanged(form);
  const applyFutureRequested = form.elements.applyToFutureSchedule?.value === "true";
  const scheduleReplacementRequested = Boolean(ticket && selectedProduct
    && String(selectedProduct.product_kind || "regular") === "regular"
    && applyFutureRequested
    && (scheduleSlotsChanged || ticketDefinitionChanged));
  if (scheduleReplacementRequested) {
    const scheduleScope = memberManagementProductScheduleScope(selectedProduct);
    const requiredScheduleCount = memberRegularScheduleFrequency(selectedProduct, ticket);
    const invalidSchedule = regularSchedules.find((slot) => (
      !memberScheduleDayOrder.includes(slot.dayOfWeek)
      || !/^\d{2}:\d{2}$/.test(slot.startTime)
      || !memberScheduleDayAllowed(scheduleScope, slot.dayOfWeek)
    ));
    const duplicateSchedule = new Set(regularSchedules.map((slot) => `${slot.dayOfWeek}:${slot.startTime}`)).size !== regularSchedules.length;
    if (invalidSchedule || duplicateSchedule || regularSchedules.length !== requiredScheduleCount) {
      message.textContent = duplicateSchedule
        ? "같은 요일·시간을 두 번 선택할 수 없습니다."
        : invalidSchedule
          ? "회원권 범위에 맞는 요일과 시간을 확인해 주세요."
          : `정규시간을 직접 바꾸려면 ${requiredScheduleCount}개를 모두 선택해 주세요. 시간표에서 등록할 예정이면 모두 비운 채 저장할 수 있습니다.`;
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
    if (!form.elements.coachRoleId?.value) {
      message.textContent = "시간표를 변경하려면 담당 코치를 먼저 선택해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
  }
  const reason = "관리자 회원표 수정";
  const payload = memberManagementDatabasePayload(form, member, ticket, reason);
  normalizeMemberManagementTicketPayload(payload);
  normalizeMemberManagementPaymentPayload(payload);
  if (ticket && !form.elements.productId?.value) {
    payload.productId = ticket.productId || null;
    payload.ticketStatus = "expired";
    payload.recordStatus = "historical";
    payload.usedSessions = Number(payload.totalSessions) || 0;
    payload.remainingSessions = 0;
  }
  if (selectedProduct) {
    const selectedGroupSize = Number(selectedProduct.group_size || 1);
    payload.lessonType = selectedGroupSize === 2 ? "one_on_two" : "one_on_one";
    payload.partnerUserId = selectedGroupSize === 2
      ? form.elements.partnerUserId?.value || null
      : null;
    const selectedProductScope = memberManagementProductScheduleScope(selectedProduct);
    payload.scheduleScope = selectedProductScope;
    payload.weeklyFrequency = memberManagementProductWeeklyFrequency(
      selectedProduct,
      memberRegularScheduleFrequency(selectedProduct, ticket),
    );
  }
  if (scheduleReplacementRequested) payload.lessonDays = regularSchedules.map((slot) => slot.dayOfWeek);
  payload.preserveExistingSchedule = true;
  payload.applyToFutureSchedule = scheduleReplacementRequested;
  payload.changeBatchId = form.dataset.changeBatchId || createMemberChangeBatchId();
  payload.changeSource = "admin_web";
  payload.allowOverlap = form.dataset.allowTicketOverlap === "true";
  payload.allowExactDuplicate = form.dataset.allowExactTicketDuplicate === "true";
  if (ticket && !payload.expectedTicketUpdatedAt) {
    message.textContent = "최신 회원권 정보를 확인하는 중입니다.";
    message.classList.remove("is-error");
    const revisionResponse = await window.TennisNoteDataClient.rpc("tn_admin_member_ticket_revision", {
      target_ticket_id: ticket.serverTicketId,
    }).catch(() => null);
    const revision = String(revisionResponse?.updatedAt || revisionResponse?.updated_at || "");
    if (!revision) {
      message.textContent = "최신 회원권 정보를 확인하지 못했습니다. 새로고침 후 다시 저장해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
    payload.expectedTicketUpdatedAt = revision;
    ticket.serverUpdatedAt = revision;
    if (form.elements.expectedTicketUpdatedAt) form.elements.expectedTicketUpdatedAt.value = revision;
  }
  if (!options.skipConfirmation) {
    const scopeText = payload.applyToFutureSchedule ? "미래 정규시간 다시 만들기" : "회원권만 저장 · 기존 시간표 유지";
    if (!window.confirm(`${memberInlineChangeSummary(form)}\n적용 범위: ${scopeText}\n서버에 저장할까요?`)) return false;
  }
  submit.disabled = true;
  submit.textContent = "저장 중";
  message.textContent = "서버에 저장하고 확인하는 중입니다.";
  message.classList.remove("is-error", "is-success");
  let saveResult = null;
  try {
    if (ticket) {
      saveResult = scheduleReplacementRequested
        ? await window.TennisNoteDataClient.rpc("tn_admin_update_member_record_and_regular_schedule", {
          target_record: payload,
          target_schedules: regularSchedules,
          target_operation_key: createAdminOperationKey("member-schedule"),
        })
        : await window.TennisNoteDataClient.rpc("tn_admin_update_member_record_with_payment", {
          target_record: payload,
        });
    } else if (payload.productId) {
      const product = (adminLiveDataState.products || []).find((item) => item.id === payload.productId);
      if (!product) throw new Error("membership_product_not_found");
      const startsOn = payload.startsOn || adminLocalDateKey(new Date());
      const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
      payload.startsOn = startsOn;
      payload.expiresOn = payload.expiresOn || addMemberManagementDays(startsOn, validityDays - 1);
      payload.totalSessions = Number(payload.totalSessions) || Number(product.total_sessions) || 1;
      payload.usedSessions = Number(payload.usedSessions) || 0;
      payload.remainingSessions = Math.max(0, payload.totalSessions - payload.usedSessions);
      const productScope = memberManagementProductScheduleScope(product);
      payload.scheduleScope = productScope;
      payload.weeklyFrequency = memberManagementProductWeeklyFrequency(product);
      payload.lessonType = Number(product.group_size || 1) === 2 ? "one_on_two" : "one_on_one";
      payload.recordStatus = payload.remainingSessions === 0 ? "historical" : "active";
      payload.ticketStatus = payload.remainingSessions === 0 ? "expired" : "active";
      saveResult = await window.TennisNoteDataClient.rpc("tn_admin_assign_member_database_ticket_resolving_stale", {
        target_record: payload,
      });
    } else {
      await window.TennisNoteDataClient.rpc("tn_admin_update_member_profile_full", {
        target_user_id: member.serverUserId,
        target_name: payload.name,
        target_nickname: payload.nickname || "",
        target_phone: payload.phone || "",
        target_birth_year: payload.birthYear,
        target_neighborhood: payload.neighborhood || "",
        target_gender: payload.gender,
        target_dominant_hand: payload.dominantHand,
        target_backhand_style: payload.backhandStyle,
        target_tennis_started_on: payload.tennisStartedOn,
        target_self_ntrp: payload.selfNtrp,
        target_coach_ntrp: payload.coachNtrp,
        target_tennis_goal: payload.tennisGoal || "",
        target_play_style_memo: payload.playStyleMemo || "",
      });
    }
    if (!refreshAfterSave) {
      message.textContent = "저장됨";
      message.classList.add("is-success");
      form.classList.remove("is-dirty", "is-save-error");
      form.classList.add("is-save-success");
      form.dataset.dirty = "false";
      submit.disabled = false;
      submit.textContent = ticket ? "이 회원권 저장" : "새 회원권 등록";
      return {
        ok: true,
        ticketId: String(saveResult?.ticketId || saveResult?.ticket_id || ticket?.serverTicketId || ""),
        ticketUpdatedAt: String(saveResult?.ticketUpdatedAt || saveResult?.ticket_updated_at || ""),
      };
    }
    const synced = await syncAdminLiveData(true);
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    await refreshScheduleAfterMemberTicketSave();
    const refreshedMember = members.find((item) => item.serverUserId === member.serverUserId);
    const savedTicketId = String(saveResult?.ticketId || saveResult?.ticket_id || ticket?.serverTicketId || "");
    const refreshed = savedTicketId
      ? [...tickets, ...expiredTickets].find((item) => String(item.serverTicketId || "") === savedTicketId)
      : refreshedMember ? memberCurrentTicket(refreshedMember) : null;
    if (!refreshedMember || refreshedMember.name !== payload.name) {
      throw new Error("member_inline_profile_write_not_confirmed");
    }
    if ((ticket || payload.productId) && !memberManagementTicketMatchesPayload(refreshed, payload)) {
      throw new Error("member_inline_write_not_confirmed");
    }
    if (scheduleReplacementRequested && refreshedMember) {
      const refreshedSlots = memberRegularScheduleSlots(refreshedMember, refreshed)
        .slice(0, regularSchedules.length)
        .map((slot) => ({ dayOfWeek: Number(slot.dayOfWeek), startTime: String(slot.startTime || "").slice(0, 5) }));
      const expectedSlots = [...regularSchedules].sort((left, right) => (
        memberScheduleDayOrder.indexOf(left.dayOfWeek) - memberScheduleDayOrder.indexOf(right.dayOfWeek)
        || left.startTime.localeCompare(right.startTime)
      ));
      if (JSON.stringify(refreshedSlots) !== JSON.stringify(expectedSlots)) {
        throw new Error("member_schedule_write_not_confirmed");
      }
    }
    message.textContent = payload.ticketStatus === "expired"
      ? "서버 저장 완료 · 만료회원 반영 확인"
      : payload.productId ? "서버 저장 완료 · 수강중 반영 확인" : "기본정보 서버 저장 완료";
    message.classList.add("is-success");
    form.classList.remove("is-dirty", "is-save-error");
    form.classList.add("is-save-success");
    form.dataset.dirty = "false";
    showToast(`${member.name} 회원권 저장 완료`);
    renderMembers();
    return true;
  } catch (error) {
    const raw = String(error?.message || error?.payload?.message || "");
    if (ticket?.serverTicketId && payload.changeBatchId) {
      const safeErrorCode = [
        "member_ticket_revision_conflict",
        "member_ticket_expected_updated_at_required",
        "ticket_not_found",
        "active_product_required",
        "group_partner_required",
        "member_active_ticket_exists",
      ].find((code) => raw.includes(code)) || "member_inline_save_failed";
      void window.TennisNoteDataClient.rpc("tn_admin_log_member_inline_failure", {
        target_ticket_id: ticket.serverTicketId,
        target_change_batch_id: payload.changeBatchId,
        target_error_code: safeErrorCode,
      }).catch(() => false);
    }
    if (raw.includes("member_ticket_revision_conflict")) {
      message.textContent = "다른 사용자가 먼저 수정했습니다. 입력값은 유지했습니다. 서버 최신값을 확인한 뒤 다시 저장해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      updateMemberInlineToolbar();
      submit.disabled = false;
      submit.textContent = "다시 저장";
      return false;
    }
    if (raw.includes("member_ticket_overlap_confirmation_required") || raw.includes("member_ticket_exact_duplicate")) {
      submit.disabled = false;
      submit.textContent = ticket ? "이 회원권 저장" : "회원권 등록";
      const exactDuplicate = raw.includes("member_ticket_exact_duplicate");
      const confirmed = window.confirm(exactDuplicate
        ? "같은 코치·상품·기간·참여자의 회원권이 이미 있습니다. 그래도 별도 회원권으로 등록할까요?"
        : "같은 코치·상품·수업 유형의 회원권 기간이 겹칩니다. 그래도 별도 회원권으로 등록할까요?");
      if (!confirmed) {
        message.textContent = exactDuplicate ? "중복 등록을 취소했습니다." : "겹침 등록을 취소했습니다.";
        message.classList.add("is-error");
        return false;
      }
      if (exactDuplicate) form.dataset.allowExactTicketDuplicate = "true";
      else form.dataset.allowTicketOverlap = "true";
      return submitMemberInlineEditor(form, { ...options, skipConfirmation: true });
    }
    if (raw.includes("member_active_ticket_exists") || raw.includes("member_verified_pending_ticket_exists")) {
      const synced = await syncAdminLiveData(true).catch(() => false);
      if (synced) {
        state.inlineMemberId = member.id;
        state.inlineMemberTicketId = String(ticket?.serverTicketId || "");
        renderMembers();
        showToast(raw.includes("member_verified_pending_ticket_exists")
          ? "결제가 확인된 대기 회원권이 있습니다. 결제/정산에서 연결 상태를 확인해 주세요."
          : "사용 중인 회원권이 있습니다. 표시된 회원권을 수정하거나 만료 처리해 주세요.");
        return false;
      }
    }
    message.textContent = memberManagementErrorText(error);
    message.classList.add("is-error");
    form.classList.add("is-save-error");
    updateMemberInlineToolbar();
    submit.disabled = false;
    submit.textContent = "다시 저장";
    return false;
  }
}

async function saveVisibleMemberRows() {
  const allForms = [...document.querySelectorAll("[data-member-inline-form]")];
  const forms = allForms.filter((form) => form.dataset.dirty === "true");
  const button = $("#saveVisibleMemberRows");
  if (operationsRole() !== "admin") return;
  if (!forms.length) {
    showToast("변경된 행이 없습니다.");
    return;
  }
  const summaries = forms.slice(0, 8).map((form) => memberInlineChangeSummary(form));
  const extra = forms.length > summaries.length ? `\n외 ${forms.length - summaries.length}건` : "";
  if (!window.confirm(`현재 페이지 회원권 ${forms.length}건의 변경사항을 저장합니다.\n\n${summaries.join("\n")}${extra}\n\n실패한 행은 입력값을 유지합니다.`)) return;
  const changeBatchId = createMemberChangeBatchId();
  forms.forEach((form) => {
    form.dataset.changeBatchId = changeBatchId;
  });
  if (button) {
    button.disabled = true;
    button.textContent = `저장 중 0/${forms.length}`;
  }
  let saved = 0;
  let failed = 0;
  const failedDrafts = [];
  const groupedForms = new Map();
  forms.forEach((form) => {
    const key = form.dataset.ticketId ? `ticket:${form.dataset.ticketId}` : `member:${form.dataset.memberInlineForm}`;
    if (!groupedForms.has(key)) groupedForms.set(key, []);
    groupedForms.get(key).push(form);
  });
  const formGroups = [...groupedForms.values()];
  const propagateTicketRevision = (ticketId, updatedAt) => {
    if (!ticketId || !updatedAt) return;
    document.querySelectorAll(`[data-member-inline-form][data-ticket-id="${CSS.escape(ticketId)}"]`).forEach((targetForm) => {
      if (targetForm.elements.expectedTicketUpdatedAt) targetForm.elements.expectedTicketUpdatedAt.value = updatedAt;
    });
  };
  let nextGroupIndex = 0;
  const saveNextGroup = async () => {
    while (nextGroupIndex < formGroups.length) {
      const group = formGroups[nextGroupIndex];
      nextGroupIndex += 1;
      for (const form of group) {
        const draft = memberInlineDraft(form);
        const result = await submitMemberInlineEditor(form, {
          refreshAfterSave: false,
          skipConfirmation: true,
        });
        if (result) {
          saved += 1;
          propagateTicketRevision(result.ticketId, result.ticketUpdatedAt);
        } else {
          failed += 1;
          failedDrafts.push(draft);
        }
        if (button) button.textContent = `저장 중 ${saved + failed}/${forms.length}`;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, formGroups.length) }, () => saveNextGroup()));
    if (saved) {
      const synced = await syncAdminLiveData(true);
      if (!synced) throw new Error("admin_live_refresh_failed_after_write");
      await loadAdminMemberDirectoryPage({ force: true, render: false });
      renderMembers();
      await refreshScheduleAfterMemberTicketSave();
    }
    if (!failed) {
      if (!saved) renderMembers();
      showToast(`${saved}명 현재 페이지 저장 완료`);
    } else {
      restoreFailedMemberInlineDrafts(failedDrafts);
      showToast(`${saved}명 저장 완료 · ${failed}명 실패 행만 다시 확인해 주세요.`);
    }
  } catch {
    showToast(`${saved}명 저장 완료 · 서버 재조회에 실패했습니다. 저장 결과를 다시 확인해 주세요.`);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      updateMemberInlineToolbar();
    }
  }
}

async function refreshScheduleAfterMemberTicketSave() {
  adminLiveScheduleLastRefreshAt = 0;
  if (state.view !== "schedule") return true;
  const refreshed = await refreshAdminLiveSchedule({ force: true });
  if (refreshed) renderSchedule();
  return refreshed;
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

function focusScheduleLessonCard(lessonId) {
  if (!lessonId) return;
  window.requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("[data-schedule-lesson-id]")]
      .find((item) => String(item.dataset.scheduleLessonId) === String(lessonId));
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    card.classList.add("is-search-target");
    window.setTimeout(() => card.classList.remove("is-search-target"), 2200);
  });
}

function jumpToScheduleSearchResult(date, day, lessonId = "") {
  if (date) state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(date), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  if (day) state.selectedScheduleDay = day;
  state.scheduleView = "week";
  renderSchedule();
  saveSnapshot();
  focusScheduleLessonCard(lessonId);
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

function toggleScheduleBulkMode(force) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 여러 수업을 한 번에 수정할 수 있습니다.");
    return;
  }
  state.scheduleBulkMode = typeof force === "boolean" ? force : !state.scheduleBulkMode;
  if (!state.scheduleBulkMode) {
    state.selectedScheduleLessonIds = [];
    state.scheduleBulkOperationKey = "";
  }
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

function toggleScheduleOpenSlotMode(force) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 빈칸을 여러 개 선택할 수 있습니다.");
    return;
  }
  state.scheduleOpenSlotMode = typeof force === "boolean" ? force : !state.scheduleOpenSlotMode;
  if (state.scheduleOpenSlotMode) {
    state.scheduleBulkMode = false;
    state.selectedScheduleLessonIds = [];
  } else {
    state.selectedScheduleOpenSlots = [];
    state.scheduleOpenSlotAnchorKey = "";
  }
  renderSchedule();
}

function setScheduleOpenSlotSelection(key, selectedValue) {
  const slot = parseScheduleOpenSlotKey(key);
  if (!slot.day || !slot.time || !slot.coachId) return false;
  if (!canAddLessonAt(slot.day, slot.time, 20, slot.coachId)) {
    showToast("수업을 추가할 수 있는 빈 시간만 선택할 수 있습니다.");
    return false;
  }
  const selected = selectedScheduleOpenSlotKeys();
  if (selectedValue) selected.add(key);
  else selected.delete(key);
  state.selectedScheduleOpenSlots = [...selected].map(parseScheduleOpenSlotKey);
  return true;
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

function toggleScheduleOpenSlotSelection(key, range = false) {
  if (range && selectScheduleOpenSlotRange(key)) {
    renderSchedule();
    return;
  }
  const selected = selectedScheduleOpenSlotKeys();
  const nextSelected = !selected.has(String(key));
  if (!setScheduleOpenSlotSelection(key, nextSelected)) return;
  state.scheduleOpenSlotAnchorKey = String(key);
  renderSchedule();
}

function visibleScheduleLessonSelectionIds() {
  return [...document.querySelectorAll("[data-select-schedule-lesson]")]
    .map((button) => String(button.dataset.selectScheduleLesson || ""))
    .filter(Boolean);
}

function setScheduleLessonSelection(lessonId, selectedValue) {
  const lesson = lessons.find((item) => String(item.serverLessonId) === String(lessonId));
  if (!scheduleBulkEligible(lesson)) {
    showToast("예정된 실제 수업만 다중 수정할 수 있습니다.");
    return false;
  }
  const selected = selectedScheduleLessonIdSet();
  if (selectedValue) selected.add(String(lessonId));
  else selected.delete(String(lessonId));
  state.selectedScheduleLessonIds = [...selected];
  state.scheduleBulkOperationKey = "";
  const button = document.querySelector(`[data-select-schedule-lesson="${CSS.escape(String(lessonId))}"]`);
  button?.setAttribute("aria-pressed", String(selectedValue));
  return true;
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

function toggleScheduleLessonSelection(lessonId, range = false) {
  if (range && selectScheduleLessonRange(lessonId)) {
    renderSchedule();
    return;
  }
  const selected = selectedScheduleLessonIdSet();
  const nextSelected = !selected.has(String(lessonId));
  if (!setScheduleLessonSelection(lessonId, nextSelected)) return;
  state.scheduleBulkAnchorLessonId = String(lessonId);
  renderSchedule();
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

function openLessonModalFromSelectedOpenSlots() {
  const slots = sortedSelectedScheduleOpenSlots();
  if (!slots.length) return;
  if (slots.length > 3) {
    showToast("정규 반복 수업은 한 번에 최대 3칸까지 선택할 수 있습니다.");
    return;
  }
  const coachIds = new Set(slots.map((slot) => slot.coachId));
  if (coachIds.size > 1) {
    showToast("같은 코치의 빈칸만 한 번에 등록할 수 있습니다.");
    return;
  }
  const first = slots[0];
  const clipboard = state.scheduleLessonClipboard;
  const clipboardDefaults = clipboard
    ? scheduleClipboardDefaultsForSlot(first.day, first.time, first.coachId)
    : {};
  if (clipboard) {
    const blockedSlot = slots.find((slot) => !scheduleClipboardCanPaste(slot.day, slot.time, slot.coachId));
    if (blockedSlot) {
      showToast(`${blockedSlot.day} ${blockedSlot.time}에는 복사한 수업을 붙여넣을 수 없습니다.`);
      return;
    }
  }
  state.scheduleOpenSlotMode = false;
  state.selectedScheduleOpenSlots = [];
  state.scheduleOpenSlotAnchorKey = "";
  openLessonModal({
    day: first.day,
    time: first.time,
    coachId: first.coachId,
    quickEntry: true,
    repeatSlots: slots,
    ...clipboardDefaults,
  });
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

function findScheduleSheetTicket(memberName, coachId, lessonSource, durationMinutes, lessonDate = "") {
  return getEligibleTickets(memberName, coachId, lessonDate)
    .filter((ticket) => ticketMatchesLessonSource(ticket, lessonSource))
    .find((ticket) => Number(getTicketDurationMinutes(ticket)) === Number(durationMinutes))
    || getEligibleTickets(memberName, coachId, lessonDate)
      .find((ticket) => ticketMatchesLessonSource(ticket, lessonSource))
    || null;
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

function validateScheduleSheetRows(rows) {
  const seen = new Map();
  return rows.map((row) => {
    const next = { ...row, issues: scheduleSheetBaseIssues(row) };
    const source = normalizeScheduleSheetLessonSource(row.lessonSourceLabel || row.lessonSource);
    const ticket = findScheduleSheetTicket(
      row.memberName,
      row.coachId,
      source,
      row.durationMinutes,
      adminWeekDateForDay(row.day),
    );
    next.lessonSource = source;
    next.ticketId = ticket?.id || "";
    if (!ticket) next.issues.push("회원권 확인");
    else if (!ticketAllowsScheduleDay(ticket, row.day)) next.issues.push("평일/주말 확인");
    const candidate = scheduleSheetRowCandidate(next);
    const duplicateKey = scheduleSheetRowKey(next);
    if (seen.has(duplicateKey)) next.issues.push("붙여넣기 중복");
    else seen.set(duplicateKey, true);
    if (candidate && !adminManualOverrideEnabled()) {
      const conflict = getLessonConflict(candidate);
      if (conflict) next.issues.push("시간 겹침");
      const exactDuplicate = getAdminManualExactDuplicate(candidate);
      if (exactDuplicate) next.issues.push("이미 등록됨");
    }
    next.issues = [...new Set(next.issues)];
    return next;
  });
}

function parseScheduleSheetPaste(text) {
  const rawLines = String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) return [];
  const firstCells = rawLines[0].split(rawLines[0].includes("\t") ? "\t" : ",").map(normalizeScheduleSheetCell);
  const hasHeader = firstCells.some((cell) => ["요일", "시간", "코치", "회원"].includes(cell));
  const lines = hasHeader ? rawLines.slice(1) : rawLines;
  const parsedRows = lines.map((line, index) => {
    const cells = line.split(line.includes("\t") ? "\t" : ",").map(normalizeScheduleSheetCell);
    const [dayCell, timeCell, coachCell, memberCell, sourceCell, minutesCell] = cells;
    const day = normalizeScheduleSheetDay(dayCell);
    const coach = findScheduleSheetCoach(coachCell);
    const source = normalizeScheduleSheetLessonSource(sourceCell);
    const durationMinutes = Number(minutesCell || 20);
    const issues = [];
    if (!day) issues.push("요일 확인");
    if (!/^\d{1,2}:\d{2}$/u.test(timeCell || "")) issues.push("시간 확인");
    if (!coach) issues.push("코치 확인");
    if (!memberCell) issues.push("회원 확인");
    if (![20, 30, 40, 60].includes(durationMinutes)) issues.push("분 확인");
    return {
      rowNumber: index + 1 + (hasHeader ? 1 : 0),
      day,
      time: timeCell || "",
      coachId: coach?.id || "",
      coachName: coach?.name || coachCell || "",
      memberName: memberCell || "",
      lessonSource: source,
      lessonSourceLabel: sourceCell || "정규",
      durationMinutes: [20, 30, 40, 60].includes(durationMinutes) ? durationMinutes : 20,
      issues,
    };
  });
  return validateScheduleSheetRows(parsedRows);
}

function scheduleSheetPasteFilterButtons(rows = []) {
  const allCount = rows.length;
  const readyCount = rows.filter((row) => !row.issues.length).length;
  const issueCount = allCount - readyCount;
  const filters = [
    { key: "all", label: "전체", count: allCount },
    { key: "issue", label: "확인 필요", count: issueCount },
    { key: "ready", label: "등록 가능", count: readyCount },
  ];
  return `
    <div class="schedule-sheet-paste-filters" role="group" aria-label="붙여넣기 미리보기 필터">
      ${filters.map((filter) => `
        <button class="segment ${state.scheduleSheetPasteFilter === filter.key ? "is-active" : ""}" type="button" data-schedule-sheet-filter="${filter.key}">
          <span>${filter.label}</span><strong>${filter.count}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function scheduleSheetPasteSelectedRowSet() {
  return new Set((state.selectedScheduleSheetPasteRowNumbers || []).map(String));
}

function scheduleSheetPasteVisibleRows(rows = state.scheduleSheetPasteRows || []) {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (
      state.scheduleSheetPasteFilter === "ready"
        ? !row.issues.length
        : state.scheduleSheetPasteFilter === "issue"
          ? row.issues.length
          : true
    ));
}

function pruneScheduleSheetPasteSelection(rows = state.scheduleSheetPasteRows || []) {
  const available = new Set(rows.map((row, index) => scheduleSheetPasteRowSelectionKey(row, index)));
  state.selectedScheduleSheetPasteRowNumbers = (state.selectedScheduleSheetPasteRowNumbers || [])
    .map(String)
    .filter((rowNumber) => available.has(rowNumber));
}

function scheduleSheetPasteBulkControls(rows = state.scheduleSheetPasteRows || [], visibleRows = scheduleSheetPasteVisibleRows(rows)) {
  const selectedCount = scheduleSheetPasteSelectedRowSet().size;
  const coachOptions = scheduleSheetCoachOptions()
    .map((coach) => ({ value: coach.id, label: scheduleCoachDisplayName(coach.name) }));
  return `
    <div class="schedule-sheet-paste-bulk" aria-label="선택 행 일괄 적용">
      <span><strong>${selectedCount}</strong>행 선택</span>
      <select id="scheduleSheetBulkCoach" aria-label="선택 행 코치">
        <option value="">코치 유지</option>
        ${scheduleSheetSelectOptions(coachOptions)}
      </select>
      <select id="scheduleSheetBulkSource" aria-label="선택 행 수업종류">
        <option value="">수업종류 유지</option>
        ${scheduleSheetSelectOptions(scheduleSheetSourceOptions())}
      </select>
      <select id="scheduleSheetBulkDuration" aria-label="선택 행 수업시간">
        <option value="">수업시간 유지</option>
        ${scheduleSheetSelectOptions([20, 30, 40, 60].map((minutes) => ({ value: minutes, label: `${minutes}분` })))}
      </select>
      <button class="primary-button" type="button" data-apply-schedule-sheet-bulk ${selectedCount ? "" : "disabled"}>선택 행 적용</button>
      <button class="ghost-button" type="button" data-select-visible-schedule-sheet-rows ${visibleRows.length ? "" : "disabled"}>현재 목록 선택</button>
      <button class="ghost-button" type="button" data-clear-schedule-sheet-selection ${selectedCount ? "" : "disabled"}>선택 해제</button>
    </div>
  `;
}

function toggleScheduleSheetPasteRowSelection(rowNumber, checked) {
  const selected = scheduleSheetPasteSelectedRowSet();
  const key = String(rowNumber || "");
  if (!key) return;
  if (checked) selected.add(key);
  else selected.delete(key);
  state.selectedScheduleSheetPasteRowNumbers = [...selected];
  renderScheduleSheetPastePreview();
}

function selectVisibleScheduleSheetPasteRows() {
  const selected = scheduleSheetPasteSelectedRowSet();
  scheduleSheetPasteVisibleRows().forEach(({ row, index }) => {
    selected.add(scheduleSheetPasteRowSelectionKey(row, index));
  });
  state.selectedScheduleSheetPasteRowNumbers = [...selected];
  renderScheduleSheetPastePreview();
}

function clearScheduleSheetPasteSelection() {
  state.selectedScheduleSheetPasteRowNumbers = [];
  renderScheduleSheetPastePreview();
}

function applyScheduleSheetPasteBulkUpdate() {
  const selected = scheduleSheetPasteSelectedRowSet();
  if (!selected.size) {
    showToast("먼저 적용할 줄을 선택해 주세요.");
    return;
  }
  const coachId = $("#scheduleSheetBulkCoach")?.value || "";
  const lessonSource = $("#scheduleSheetBulkSource")?.value || "";
  const durationMinutes = Number($("#scheduleSheetBulkDuration")?.value || 0);
  if (!coachId && !lessonSource && !durationMinutes) {
    showToast("바꿀 코치, 수업종류 또는 수업시간을 선택해 주세요.");
    return;
  }
  const coach = coachId
    ? scheduleSheetCoachOptions().find((item) => String(item.id) === String(coachId))
    : null;
  const rows = (state.scheduleSheetPasteRows || []).map((row, index) => {
    if (!selected.has(scheduleSheetPasteRowSelectionKey(row, index))) return row;
    const next = { ...row };
    if (coachId) {
      next.coachId = coach?.id || "";
      next.coachName = coach?.name || "";
    }
    if (lessonSource) {
      next.lessonSource = normalizeLessonSource(lessonSource);
      next.lessonSourceLabel = lessonSourceLabel(next.lessonSource);
    }
    if (durationMinutes) next.durationMinutes = durationMinutes;
    return next;
  });
  state.scheduleSheetPasteRows = validateScheduleSheetRows(rows);
  renderScheduleSheetPastePreview();
  showToast(`선택한 ${selected.size}줄을 다시 검증했습니다.`);
}

function updateScheduleSheetPasteRow(index, field, value) {
  const rowIndex = Number(index);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (state.scheduleSheetPasteRows || []).length) return;
  const rows = state.scheduleSheetPasteRows.map((row, currentIndex) => {
    if (currentIndex !== rowIndex) return row;
    const next = { ...row };
    if (field === "durationMinutes") next.durationMinutes = Number(value) || 20;
    else if (field === "coachId") {
      const coach = scheduleSheetCoachOptions().find((item) => String(item.id) === String(value));
      next.coachId = coach?.id || "";
      next.coachName = coach?.name || "";
    } else if (field === "lessonSource") {
      next.lessonSource = normalizeLessonSource(value);
      next.lessonSourceLabel = lessonSourceLabel(next.lessonSource);
    } else {
      next[field] = normalizeScheduleSheetCell(value);
    }
    return next;
  });
  state.scheduleSheetPasteRows = validateScheduleSheetRows(rows);
  renderScheduleSheetPastePreview();
}

function removeScheduleSheetPasteRow(index) {
  const rowIndex = Number(index);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (state.scheduleSheetPasteRows || []).length) return;
  state.scheduleSheetPasteRows = validateScheduleSheetRows(state.scheduleSheetPasteRows.filter((_, currentIndex) => currentIndex !== rowIndex));
  pruneScheduleSheetPasteSelection();
  renderScheduleSheetPastePreview();
}

function clearScheduleSheetPasteIssueRows() {
  const rows = state.scheduleSheetPasteRows || [];
  const readyRows = rows.filter((row) => !row.issues.length);
  if (readyRows.length === rows.length) return;
  state.scheduleSheetPasteRows = validateScheduleSheetRows(readyRows);
  state.scheduleSheetPasteFilter = "all";
  pruneScheduleSheetPasteSelection();
  renderScheduleSheetPastePreview();
}

function openScheduleSheetPastePanel() {
  state.scheduleSheetPasteOpen = true;
  renderScheduleSheetPastePreview();
  $("#scheduleSheetPasteInput")?.focus();
}

function closeScheduleSheetPastePanel() {
  state.scheduleSheetPasteOpen = false;
  renderScheduleSheetPastePreview();
}

function previewScheduleSheetPaste() {
  const rows = parseScheduleSheetPaste($("#scheduleSheetPasteInput")?.value || "");
  state.scheduleSheetPasteRows = rows;
  state.selectedScheduleSheetPasteRowNumbers = [];
  renderScheduleSheetPastePreview(rows);
}

function clearScheduleSheetPaste() {
  state.scheduleSheetPasteRows = [];
  state.selectedScheduleSheetPasteRowNumbers = [];
  if ($("#scheduleSheetPasteInput")) $("#scheduleSheetPasteInput").value = "";
  renderScheduleSheetPastePreview([]);
}

function groupScheduleSheetCandidates(rows = []) {
  const readyRows = rows.filter((row) => !row.issues.length);
  const grouped = new Map();
  readyRows.forEach((row) => {
    const candidate = scheduleSheetRowCandidate(row);
    if (!candidate) return;
    const key = `${candidate.ticketId}|${candidate.coachId}|${candidate.lessonSource}|${candidate.durationMinutes}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidate);
  });
  return [...grouped.values()];
}

async function submitScheduleSheetPaste() {
  const rows = state.scheduleSheetPasteRows?.length
    ? validateScheduleSheetRows(state.scheduleSheetPasteRows)
    : parseScheduleSheetPaste($("#scheduleSheetPasteInput")?.value || "");
  state.scheduleSheetPasteRows = rows;
  renderScheduleSheetPastePreview(rows);
  const groups = groupScheduleSheetCandidates(rows);
  if (!groups.length) {
    showToast("저장 가능한 줄이 없습니다. 미리보기의 확인 필요 항목을 먼저 고쳐 주세요.");
    return;
  }
  if (!window.confirm(`${groups.reduce((sum, group) => sum + group.length, 0)}개 수업을 서버에 등록할까요?`)) return;
  const saveButton = $("#saveScheduleSheetPaste");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중";
  }
  saveScheduleSafetySnapshot(lessons, "before-sheet-paste-write");
  const savedGroups = [];
  try {
    for (const group of groups) {
      state.lessonOperationKey = createAdminOperationKey("lesson-sheet-paste");
      await saveLiveAdminLessonSet(group);
      savedGroups.push(group);
    }
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_sheet_paste");
    state.scheduleSheetPasteRows = [];
    state.selectedScheduleSheetPasteRowNumbers = [];
    if ($("#scheduleSheetPasteInput")) $("#scheduleSheetPasteInput").value = "";
    renderScheduleSheetPastePreview([]);
    renderAll();
    showToast(`표 붙여넣기 등록 완료 · ${savedGroups.reduce((sum, group) => sum + group.length, 0)}개 수업`);
  } catch (error) {
    await syncAdminLiveData().catch(() => false);
    renderScheduleSheetPastePreview(rows);
    showToast(`표 붙여넣기 저장 실패: ${error?.payload?.message || error?.message || "서버 확인 필요"}`);
  } finally {
    state.lessonOperationKey = "";
    if (saveButton) {
      saveButton.textContent = "확인한 줄 일괄 등록";
      renderScheduleSheetPastePreview(state.scheduleSheetPasteRows);
    }
  }
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

async function submitScheduleBulkShift(minuteDelta) {
  const selected = selectedScheduleLessons();
  if (!selected.length) return;
  if (!window.TennisNoteDataClient?.rpc || !adminApprovalReady()) {
    showToast("관리자 로그인과 서버 연결을 확인해 주세요.");
    return;
  }
  if (!window.confirm(`${selected.length}개 수업을 ${Math.abs(minuteDelta)}분 ${minuteDelta < 0 ? "앞으로" : "뒤로"} 이동할까요?`)) return;
  const expectedRevisions = Object.fromEntries(selected.map((lesson) => [
    String(lesson.serverLessonId),
    lesson.serverRevision ?? null,
  ]));
  if (!state.scheduleBulkOperationKey) {
    state.scheduleBulkOperationKey = createAdminOperationKey("lesson-bulk-shift");
  }
  $$("[data-shift-schedule-lessons]").forEach((button) => {
    button.disabled = true;
  });
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_shift_lessons_guarded", {
      target_lesson_ids: selected.map((lesson) => lesson.serverLessonId),
      target_minute_delta: minuteDelta,
      target_expected_revisions: expectedRevisions,
      target_operation_key: state.scheduleBulkOperationKey,
    });
    await syncAdminLiveData();
    state.selectedScheduleLessonIds = [];
    state.scheduleBulkOperationKey = "";
    state.scheduleBulkMode = false;
    renderAll();
    showToast(`${Number(result?.shiftedCount ?? result?.shifted_count ?? selected.length)}개 수업 시간을 변경했습니다.`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    if (raw.includes("lesson_concurrent_update")) {
      await syncAdminLiveData();
      state.selectedScheduleLessonIds = [];
      state.scheduleBulkOperationKey = "";
      renderAll();
    }
    showToast(isMissingRpcError(error, "tn_admin_shift_lessons_guarded")
      ? "운영 DB에 다중 시간 변경 기능을 먼저 적용해야 합니다."
      : scheduleBulkErrorMessage(error));
  } finally {
    renderScheduleBulkToolbar();
  }
}

function openSelectedScheduleSubstitute() {
  const selected = selectedScheduleLessons();
  if (!selected.length) return;
  const dates = new Set(selected.map((lesson) => lesson.lessonDate));
  if (dates.size !== 1) {
    showToast("대타 지정은 같은 날짜의 수업끼리 선택해 주세요.");
    return;
  }
  openSubstituteModal(selected[0]);
  state.selectedSubstituteLessonIds = selected.map((lesson) => String(lesson.serverLessonId));
  renderSubstituteLessonList();
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

function syncLessonRepeatPreviewPanel(markup = "") {
  const panel = $("#lessonRepeatPreviewPanel");
  if (!panel) return;
  panel.hidden = !markup;
  panel.innerHTML = markup || "";
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

function refreshLessonExtraTimeOptions() {
  $$("[data-lesson-slot-time]").forEach((select) => {
    const day = select.closest(".lesson-repeat-slot")?.querySelector("[data-lesson-slot-day]")?.value || "";
    const options = getTimeOptionsForLessonSlot(day);
    const currentValue = select.value;
    fillSelect(select, options);
    select.value = options.some((option) => option.value === currentValue) ? currentValue : "";
  });
}

function refreshLessonTimeOptions(keepValue = "") {
  const day = $("#lessonDay").value;
  const pinnedTime = !state.editingLessonId
    && state.pinnedLessonDay === day
    && state.pinnedLessonTime
    ? state.pinnedLessonTime
    : "";
  const currentValue = pinnedTime || keepValue || $("#lessonTime").value;
  const durationMinutes = getLessonDurationFromSelectedTicket();
  const pastCorrection = isPastLessonCorrectionMode({ day, time: currentValue, durationMinutes });
  const sourceTimes = pastCorrection || adminManualOverrideEnabled()
    ? getScheduleTimeOptions()
    : getCoachTimeOptions($("#lessonCoach").value, day, durationMinutes);
  if (pinnedTime && !sourceTimes.includes(pinnedTime)) sourceTimes.unshift(pinnedTime);
  const timeOptions = sourceTimes.map((time) => ({ value: time, label: time }));
  const fallbackOptions = timeOptions.length ? timeOptions : [{ value: "", label: "가능 시간 없음" }];
  fillSelect($("#lessonTime"), fallbackOptions);
  $("#lessonTime").value = fallbackOptions.some((option) => option.value === currentValue) ? currentValue : fallbackOptions[0].value;
  refreshLessonExtraTimeOptions();
}

function refreshLessonDayOptions() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const regularScheduleMode = isRegularScheduleSetup(ticket);
  const scheduleCount = requiredRegularScheduleCount(ticket);
  const availableDays = adminManualOverrideEnabled() ? scheduleDays : ticket ? getTicketScheduleDays(ticket) : scheduleDays;
  const pinnedDay = !state.editingLessonId ? state.pinnedLessonDay : "";
  const selectableDays = pinnedDay && !availableDays.includes(pinnedDay)
    ? [pinnedDay, ...availableDays]
    : availableDays;
  const target = $("#lessonRepeatSlots");
  const previousSlots = $$("[data-lesson-slot-day]").map((daySelect) => {
    const row = daySelect.closest(".lesson-repeat-slot");
    return {
      day: daySelect.value,
      time: row?.querySelector("[data-lesson-slot-time]")?.value || "",
    };
  });
  const repeatDefaults = Array.isArray(state.pinnedLessonRepeatSlots) ? state.pinnedLessonRepeatSlots : [];
  target.innerHTML = "";
  target.hidden = !regularScheduleMode;
  const previousPrimaryDay = $("#lessonDay").value;
  fillSelect($("#lessonDay"), selectableDays.map((day) => ({ value: day, label: `${day}요일` })));
  const primaryDayToKeep = pinnedDay || previousPrimaryDay;
  $("#lessonDay").value = selectableDays.includes(primaryDayToKeep) ? primaryDayToKeep : selectableDays[0] || "";
  const primaryDay = $("#lessonDay").value;
  for (let index = 2; index <= 7; index += 1) {
    const isActive = index <= scheduleCount;
    const previous = previousSlots[index - 2] || repeatDefaults[index - 1] || {};
    const selectedDay = previous.day && availableDays.includes(previous.day) ? previous.day : "";
    const row = document.createElement("label");
    row.className = "form-field lesson-repeat-slot";
    row.innerHTML = `
      <span>요일/시간 ${index}</span>
      <div class="lesson-inline-selects">
        <select data-lesson-slot-day></select>
        <select data-lesson-slot-time></select>
      </div>
    `;
    const daySelect = row.querySelector("[data-lesson-slot-day]");
    const timeSelect = row.querySelector("[data-lesson-slot-time]");
    fillSelect(daySelect, [{ value: "", label: "요일 선택" }, ...availableDays.map((day) => ({ value: day, label: `${day}요일` }))]);
    daySelect.value = selectedDay;
    fillSelect(timeSelect, getTimeOptionsForLessonSlot(selectedDay));
    if ([...timeSelect.options].some((option) => option.value === previous.time)) timeSelect.value = previous.time;
    daySelect.disabled = !isActive;
    timeSelect.disabled = !isActive;
    row.classList.toggle("is-disabled", !isActive);
    row.hidden = !isActive;
    row.setAttribute("aria-hidden", isActive ? "false" : "true");
    target.appendChild(row);
    daySelect.addEventListener("change", () => {
      fillSelect(timeSelect, getTimeOptionsForLessonSlot(daySelect.value));
      timeSelect.value = "";
      renderLessonPreview();
    });
    timeSelect.addEventListener("change", renderLessonPreview);
  }
}

function applyLessonRepeatSlotDefaults(slots = []) {
  if (!Array.isArray(slots) || slots.length <= 1) return;
  slots.slice(1, 7).forEach((slot, index) => {
    const row = $$(".lesson-repeat-slot")[index];
    if (!row || row.classList.contains("is-disabled")) return;
    const daySelect = row.querySelector("[data-lesson-slot-day]");
    const timeSelect = row.querySelector("[data-lesson-slot-time]");
    if (!daySelect || !timeSelect) return;
    if ([...daySelect.options].some((option) => option.value === slot.day)) {
      daySelect.value = slot.day;
    }
    fillSelect(timeSelect, getTimeOptionsForLessonSlot(daySelect.value));
    if ([...timeSelect.options].some((option) => option.value === slot.time)) {
      timeSelect.value = slot.time;
    }
  });
}

function refreshLessonDurationOptions() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const durationMinutes = getTicketDurationMinutes(ticket);
  const previousDuration = $("#lessonDuration").value;
  const ticketDurations = [...new Set([durationMinutes, durationMinutes * 2])]
    .filter((minutes) => [20, 30, 40, 60].includes(minutes));
  const options = adminManualOverrideEnabled()
    ? [20, 30, 40, 60].map((minutes) => ({ value: String(minutes), label: `${minutes}분${minutes === durationMinutes ? " · 회원권 기준" : ""}` }))
    : ticketDurations.map((minutes) => ({
        value: String(minutes),
        label: `${minutes}분 · ${Math.max(1, Math.ceil(minutes / durationMinutes))}회 사용`,
      }));
  fillSelect($("#lessonDuration"), options);
  $("#lessonDuration").value = options.some((item) => item.value === previousDuration)
    ? previousDuration
    : String(durationMinutes);
  renderLessonDurationQuickButtons();
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

function ensureMemberHasCoachTicket() {
  const memberSelect = $("#lessonMember");
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(selectedLessonMemberReference(), coachId).length) return;
  const fallbackMember = findFirstMemberWithCoachTicket(coachId);
  if (fallbackMember) memberSelect.value = fallbackMember;
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

function refreshLessonMemberOptions(keepValue = "", editingLesson = null) {
  const search = $("#lessonMemberSearch").value.trim();
  const keyword = search.toLowerCase();
  const currentValue = keepValue || $("#lessonMember").value;
  const allOptions = getSelectableMembers(search);
  const exactMember = search
    ? allOptions.find((member) => memberSearchValues(member)
      .some((value) => String(value || "").trim().toLowerCase() === keyword))
    : null;
  const options = allOptions.slice(0, search ? 80 : 30);
  if (exactMember && !options.some((member) => member.name === exactMember.name)) options.unshift(exactMember);
  const currentMember = members.find((member) => member.name === currentValue);
  const currentMatchesSearch = currentMember && (!keyword || memberSearchValues(currentMember)
    .some((value) => String(value || "").toLowerCase().includes(keyword)));
  if (!search && currentMember && !options.some((member) => member.name === currentValue)) options.unshift(currentMember);
  const editingParticipantLabel = editingLesson ? getLessonParticipantNames(editingLesson).join(" & ") : "";
  const editingTicket = editingLesson ? getTicketByLesson(editingLesson) : null;
  if (!options.length) {
    fillSelect($("#lessonMember"), [{ value: "", label: search ? "검색 결과 없음" : "선택 가능한 회원 없음" }]);
    $("#lessonMember").value = "";
    return;
  }
  fillSelect(
    $("#lessonMember"),
    [
      { value: "", label: "회원 검색 또는 선택" },
      ...options.map((member) => ({
      value: member.name,
      memberUserId: member.serverUserId || memberServerUserIds(member)[0] || "",
      label: editingParticipantLabel && member.name === currentValue
        ? `현재 수업 · ${editingParticipantLabel}${editingTicket ? ` · ${getTicketOptionLabel(editingTicket)}` : ""}`
        : getMemberOptionLabel(member),
      })),
    ],
  );
  const selectedName = exactMember?.name
    || (currentMatchesSearch && options.some((member) => member.name === currentValue) ? currentValue : "");
  $("#lessonMember").value = selectedName;
}

function ensureLessonMemberOption(memberName, label = "") {
  const select = $("#lessonMember");
  const value = String(memberName || "").trim();
  if (!select || !value || [...select.options].some((option) => option.value === value)) return false;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label || `${value} · 회원권 확인`;
  select.prepend(option);
  select.value = value;
  return true;
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

function syncSameDayRegularAdjustmentPanel(candidate = getLessonFormCandidate()) {
  const panel = $("#lessonSameDayAdjustmentPanel");
  const select = $("#lessonSameDayAdjustmentSource");
  const guide = $("#lessonSameDayAdjustmentGuide");
  const button = $("#moveSameDayRegularLessonButton");
  if (!panel || !select || !guide || !button) return;
  const context = sameDayRegularAdjustmentContext(candidate);
  panel.hidden = !context || !context.memberName;
  if (panel.hidden) {
    select.innerHTML = "";
    return;
  }
  const options = context.sourceLessons.map((lesson) => ({
    value: String(lesson.id),
    label: `${lesson.time} · ${getLessonMembersLabel(lesson)} · ${getCoachName(lesson.coachId)}`,
  }));
  fillSelect(select, options.length ? options : [{ value: "", label: "같은 날 옮길 정규수업 없음" }]);
  button.disabled = !options.length;
  guide.textContent = options.length
    ? `${context.memberName} 회원의 기존 정규수업을 선택한 ${candidate.time} 시간으로 옮깁니다. 회차는 추가 차감하지 않습니다.`
    : `${context.memberName} 회원의 같은 날짜 정규수업을 찾지 못했습니다. 보강 예약이라면 등록 구분을 보강으로 유지하세요.`;
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

function openAdminMakeupEntitlements() {
  return (state.makeupEntitlements || []).filter((item) => item.status === "open");
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

function syncMakeupEntitlementIdentityLock() {
  const locked = Boolean(selectedAdminMakeupEntitlement());
  ["#lessonMemberSearch", "#lessonMember", "#lessonTicket", "#lessonCoach"].forEach((selector) => {
    const field = $(selector);
    if (field) field.disabled = locked;
  });
  if (locked && $("#lessonTicketHint")) {
    $("#lessonTicketHint").textContent = "선택한 보강 대기의 회원·회원권·담당 코치는 변경할 수 없습니다. 요일과 시간은 직접 선택할 수 있습니다.";
  } else {
    renderLessonTicketHint();
  }
}

function refreshLessonMakeupEntitlementOptions() {
  const field = $("#lessonMakeupEntitlementField");
  const select = $("#lessonMakeupEntitlement");
  if (!field || !select) return;
  const shouldShow = normalizeLessonSource($("#lessonSource")?.value) === "makeup" && !state.editingLessonId;
  field.hidden = !shouldShow;
  if (!shouldShow) {
    select.innerHTML = "";
    syncMakeupEntitlementIdentityLock();
    return;
  }
  const previous = select.value;
  const options = matchingAdminMakeupEntitlements();
  select.innerHTML = [
    '<option value="">보강 대기 없음 · 관리자 직접 입력</option>',
    ...options.map((item) => `<option value="${item.id}">${item.member} · ${item.originalLabel} · ${item.durationMinutes}분</option>`),
  ].join("");
  if (options.some((item) => item.id === previous)) select.value = previous;
  else if (options.length === 1) select.value = options[0].id;
  applySelectedAdminMakeupEntitlement();
  syncMakeupEntitlementIdentityLock();
}

function applySelectedAdminMakeupEntitlement() {
  const entitlement = selectedAdminMakeupEntitlement();
  if (!entitlement) {
    syncMakeupEntitlementIdentityLock();
    return;
  }
  if ([...$("#lessonTicket").options].some((option) => option.value === entitlement.ticketId)) {
    $("#lessonTicket").value = entitlement.ticketId;
  }
  if ([...$("#lessonCoach").options].some((option) => option.value === entitlement.coachId)) {
    $("#lessonCoach").value = entitlement.coachId;
  }
  $("#lessonDuration").value = String(entitlement.durationMinutes);
  syncLessonSourceOptions();
  refreshLessonDurationOptions();
  refreshLessonTimeOptions($("#lessonTime").value);
  renderLessonTicketHint();
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

function syncLessonSourceOptions() {
  const select = $("#lessonSource");
  if (!select) return;
  const ticket = getSelectedTicket();
  const editingLesson = getCurrentEditingLesson();
  const pastCorrection = isPastLessonCorrectionMode(getLessonFormCandidate());
  const allowed = new Set(adminManualOverrideEnabled()
    ? ["regular", "makeup", "coupon", "coach_change"]
    : allowedLessonSourcesForTicket(ticket));
  // Walk-in lessons do not require a member ticket, so keep this choice available.
  allowed.add("one_day");
  // Keep coupon lessons visible for manual registration; submission still verifies a coupon ticket.
  allowed.add("coupon");
  if (pastCorrection) allowed.add("admin");
  if (editingLesson?.lessonSource === "coach_change") allowed.add("coach_change");
  [...select.options].forEach((option) => {
    option.hidden = !allowed.has(option.value);
    option.disabled = !allowed.has(option.value);
  });
  const currentSource = normalizeLessonSource(select.value);
  if (!allowed.has(currentSource)) {
    select.value = state.releasedAbsenceEntitlementId ? "makeup" : suggestedLessonSourceForTicket(ticket);
    state.lessonSourceTouched = false;
  }
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

function syncLessonSourceFromTicket(force = false) {
  const select = $("#lessonSource");
  if (!select || (!force && state.lessonSourceTouched)) return;
  select.value = state.releasedAbsenceEntitlementId ? "makeup" : suggestedLessonSourceForTicket();
  syncLessonSourceOptions();
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

function syncAdminForceDeleteLessonButton(candidate = getLessonFormCandidate()) {
  const button = $("#deleteLessonButton");
  if (!button) return null;
  const targetLesson = adminForceDeleteLessonTarget(candidate);
  const available = operationsRole() === "admin" && Boolean(targetLesson);
  button.hidden = !available;
  button.textContent = "관리자 강제 삭제";
  button.dataset.forceDeleteLessonId = available ? String(targetLesson.id) : "";
  button.title = available
    ? `${getLessonMembersLabel(targetLesson)} · ${targetLesson.day} ${targetLesson.time} 수업을 강제 삭제합니다.`
    : "삭제할 기존 수업이 없습니다.";
  return targetLesson;
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

function syncLessonTypeFromForm() {
  $("#lessonType").value = getLessonTypeFromForm();
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

function refreshLessonTicketOptions() {
  const memberReference = selectedLessonMemberReference();
  const coachId = $("#lessonCoach").value;
  const previousTicketId = $("#lessonTicket").value;
  const eligible = getEligibleTickets(memberReference, coachId);
  fillSelect(
    $("#lessonTicket"),
    eligible.length
      ? eligible.map((ticket) => ({ value: ticket.id, label: getLessonTicketOptionLabel(ticket) }))
      : [{ value: "", label: "해당 코치 회원권 없음" }],
  );
  if (eligible.some((ticket) => String(ticket.id) === String(previousTicketId))) {
    $("#lessonTicket").value = String(previousTicketId);
  }
  syncLessonSourceOptions();
  refreshLessonDurationOptions();
  refreshLessonDayOptions();
  syncLessonTypeFromForm();
  renderLessonTicketHint();
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

function setLessonFormMessage(message, tone = "") {
  const target = $("#lessonFormMessage");
  target.textContent = message;
  target.className = `form-message ${tone}`;
}

function clearLessonSaveResultPanel() {
  const target = $("#lessonSaveResultPanel");
  if (!target) return;
  target.hidden = true;
  target.className = "lesson-save-result-panel";
  target.innerHTML = "";
}

function showLessonSaveResultPanel({
  status = "saving",
  title = "서버 저장 확인",
  message = "",
  expectedCount = 0,
  confirmedCount = 0,
  missingRows = [],
  recoverySteps = [],
} = {}) {
  const target = $("#lessonSaveResultPanel");
  if (!target) return;
  const safeMissingRows = Array.isArray(missingRows) ? missingRows : [];
  const safeRecoverySteps = Array.isArray(recoverySteps) ? recoverySteps.filter(Boolean) : [];
  const statusClass = status === "danger" ? "is-danger" : status === "good" ? "is-good" : "is-saving";
  const missingMarkup = safeMissingRows.length
    ? `<ul class="lesson-save-result-missing">${safeMissingRows.slice(0, 5).map((item) => `<li>${escapeHtml(`${item.day || item.lessonDate || ""} ${item.time || ""}`.trim())}</li>`).join("")}</ul>`
    : "";
  const recoveryMarkup = safeRecoverySteps.length
    ? `<ol class="lesson-save-result-recovery">${safeRecoverySteps.slice(0, 4).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
    : "";
  target.hidden = false;
  target.className = `lesson-save-result-panel ${statusClass}`;
  target.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    <div class="lesson-save-result-grid">
      <span class="lesson-save-result-item"><span>저장 요청</span><b>${expectedCount || 0}건</b></span>
      <span class="lesson-save-result-item"><span>시간표 확인</span><b>${confirmedCount || 0}건</b></span>
      <span class="lesson-save-result-item"><span>미확인</span><b>${safeMissingRows.length}건</b></span>
    </div>
    ${missingMarkup}
    ${recoveryMarkup}
  `;
}

function setLessonSubmitEnabled(enabled) {
  const button = $("#saveLessonButton");
  if (button) button.disabled = !enabled;
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

function syncAdminManualOverrideUi(warnings = []) {
  const panel = $("#lessonAdminOverridePanel");
  const details = $("#lessonAdminOverrideDetails");
  const list = $("#lessonAdminOverrideWarnings");
  if (!panel || !details || !list) return;
  const available = adminManualOverrideAvailable();
  const enabled = adminManualOverrideEnabled();
  panel.hidden = !available;
  details.hidden = !enabled;
  list.innerHTML = (warnings.length ? warnings : ["감지된 정책 충돌은 없지만 강제 처리 사실은 기록됩니다."])
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
}

function confirmAdminManualOverride(candidate, warnings = []) {
  const warningText = warnings.length
    ? warnings.map((warning) => `• ${warning}`).join("\n")
    : "• 감지된 정책 충돌 없음";
  return window.confirm(
    `관리자 강제 수동 처리로 저장할까요?\n\n${candidate.day} ${candidate.time} · ${getLessonMembersLabel(candidate)}\n${warningText}\n\n사유: ${adminManualOverrideReason()}\n\n회원·코치 앱의 제한은 바뀌지 않으며 이 처리만 감사 기록에 남습니다.`,
  );
}

function pastLessonCorrectionMode() {
  return document.querySelector('input[name="lessonPastCorrectionMode"]:checked')?.value === "absence"
    ? "absence"
    : "complete";
}

function syncPastLessonCorrectionUi(candidate = getLessonFormCandidate()) {
  const panel = $("#lessonPastCorrectionPanel");
  const repeatSlots = $("#lessonRepeatSlots");
  const sourceSelect = $("#lessonSource");
  const adminOption = sourceSelect?.querySelector('option[value="admin"]');
  const editingLesson = getCurrentEditingLesson();
  const pastCorrection = isPastLessonCorrectionMode(candidate);
  const correctionMode = pastLessonCorrectionMode();
  const absenceMode = pastCorrection && correctionMode === "absence";
  const commentField = $("#lessonPastCommentField");
  const commentInput = $("#lessonPastCoachComment");

  if (panel) panel.hidden = !pastCorrection;
  if (commentField) commentField.hidden = absenceMode;
  if (commentInput) commentInput.required = pastCorrection && !absenceMode;
  if (repeatSlots) repeatSlots.hidden = pastCorrection;
  if (adminOption) adminOption.hidden = !pastCorrection;
  syncLessonSourceOptions();

  if (pastCorrection && !editingLesson && normalizeLessonSource(sourceSelect?.value) === "regular") {
    sourceSelect.value = "admin";
    state.lessonSourceTouched = true;
    refreshLessonMakeupEntitlementOptions();
  } else if (!pastCorrection && normalizeLessonSource(sourceSelect?.value) === "admin") {
    sourceSelect.value = suggestedLessonSourceForTicket();
    state.lessonSourceTouched = false;
    refreshLessonMakeupEntitlementOptions();
  }

  if (pastCorrection) {
    $("#lessonModalTitle").textContent = absenceMode ? "지난 수업 사전 불참 보정" : editingLesson ? "지난 수업 완료 처리" : "과거 수업 보정";
    $("#saveLessonButton").textContent = absenceMode ? "불참 보정·차감 안 함" : "완료 반영·횟수 차감";
  } else if ($("#lessonModalTitle") && $("#saveLessonButton")) {
    const completedCorrection = isCompletedLessonCorrectionMode();
    $("#lessonModalTitle").textContent = completedCorrection ? "완료 수업 정정" : editingLesson ? "수업 수정" : "수업 추가";
    $("#saveLessonButton").textContent = completedCorrection ? "완료 이력 수정" : editingLesson ? "수정 저장" : "시간표에 추가";
  }
  return pastCorrection;
}

function syncQuickLessonEntryUi(candidate = getLessonFormCandidate()) {
  const modal = $("#lessonModal");
  const summary = $("#lessonQuickSummary");
  if (!modal || !summary) return;
  const quickMode = state.quickLessonEntry || state.quickLessonEdit;
  const ticket = getSelectedTicket();
  const source = normalizeLessonSource($("#lessonSource")?.value);
  const requiredCount = source === "regular" && !state.quickLessonEntry
    ? Math.max(1, Math.min(3, getTicketWeeklyCount(ticket)))
    : 1;
  const expanded = quickMode && state.quickLessonDetailsExpanded;
  modal.classList.toggle("is-quick-entry", state.quickLessonEntry);
  modal.classList.toggle("is-quick-edit", state.quickLessonEdit);
  modal.classList.toggle("is-quick-expanded", expanded);
  summary.hidden = !quickMode;
  const quickSourcePanel = $("#lessonQuickSourcePanel");
  if (quickSourcePanel) {
    quickSourcePanel.hidden = !state.quickLessonEntry;
    [...quickSourcePanel.querySelectorAll("[data-lesson-quick-source]")].forEach((button) => {
      const active = button.dataset.lessonQuickSource === source;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  const editingLesson = state.quickLessonEdit ? getCurrentEditingLesson() : null;
  const completedCorrection = isCompletedLessonCorrectionMode();
  const pastAbsenceCorrection = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && normalizeLessonSource(editingLesson.lessonSource) === "regular"
    && operationsRole() === "admin"
    && isPastLessonCorrectionMode(candidate)
  );
  const canMarkAbsent = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && normalizeLessonSource(editingLesson.lessonSource) === "regular"
    && operationsRole() === "admin"
  );
  const canCompleteLesson = Boolean(
    state.quickLessonEdit
    && editingLesson?.serverLessonId
    && lessonStatusValue(editingLesson) === "scheduled"
    && isPastLessonCorrectionMode(candidate)
  );
  if (!canMarkAbsent && state.lessonQuickAction === "absence") state.lessonQuickAction = "schedule";
  if (!canCompleteLesson && state.lessonQuickAction === "record") state.lessonQuickAction = "schedule";
  const absenceFocus = canMarkAbsent && state.lessonQuickAction === "absence";
  const detailsFocus = state.lessonQuickAction === "details";
  if (absenceFocus || detailsFocus) {
    state.quickLessonDetailsExpanded = true;
    modal.classList.add("is-quick-expanded");
  }
  modal.classList.toggle("is-absence-focus", absenceFocus);
  const quickActions = $("#lessonQuickActions");
  if (quickActions) {
    quickActions.hidden = !state.quickLessonEdit || completedCorrection;
    [...quickActions.querySelectorAll("[data-lesson-quick-action]")].forEach((button) => {
      const action = button.dataset.lessonQuickAction;
      button.hidden = false;
      button.disabled = (action === "absence" && !canMarkAbsent)
        || (action === "record" && !canCompleteLesson);
      if (button.disabled) {
        button.title = action === "record"
          ? "수업 시작 시간이 지난 뒤 사용할 수 있습니다."
          : "정규 예정 수업에서 사용할 수 있습니다.";
      } else {
        button.removeAttribute("title");
      }
      button.classList.toggle("is-active", action === state.lessonQuickAction);
      button.setAttribute("aria-pressed", String(action === state.lessonQuickAction));
    });
  }
  if ($("#lessonStatusGuide")) {
    $("#lessonStatusGuide").hidden = !state.quickLessonEdit || completedCorrection;
  }
  if ($("#lessonQuickLabel")) $("#lessonQuickLabel").textContent = state.quickLessonEdit ? "수정 대상" : "선택 시간";
  const scheduleLabel = state.quickLessonEdit && editingLesson
    ? `${getLessonMembersLabel(editingLesson)} · ${editingLesson.day}요일 ${adminScheduleDateLabel(editingLesson.day)} · ${editingLesson.time}`
    : candidate?.day && candidate?.time
      ? `${candidate.day}요일 ${adminScheduleDateLabel(candidate.day)} · ${candidate.time} · ${scheduleCoachDisplayName(getCoachName(candidate.coachId))}`
      : "요일과 시간을 선택해 주세요.";
  if ($("#lessonQuickSchedule")) $("#lessonQuickSchedule").textContent = scheduleLabel;
  if ($("#lessonQuickGuide")) {
    const quickTicketSummary = ticket
      ? `${getTicketDisplayProduct(ticket) || "회원권"} · ${ticketUsageLabel(ticket)} · ${lessonSourceLabel(source)}`
      : "";
    $("#lessonQuickGuide").textContent = state.quickLessonEdit
      ? absenceFocus
        ? "이 수업만 불참으로 바꾸며 횟수는 차감하지 않습니다."
        : completedCorrection
        ? "완료 기록과 피드백은 유지됩니다. 잘못된 코치·요일·시간·수업시간만 바로잡으세요."
        : "요일·시간·코치·수업 길이를 바꾸고 아래에서 적용 범위를 선택하세요."
      : state.quickLessonEntry
        ? quickTicketSummary
          ? source === "regular"
            ? `${quickTicketSummary} · 이 시간을 기준으로 남은 회차까지 자동 등록`
            : `${quickTicketSummary} · 이번 수업 1회만 등록`
          : "회원 이름을 검색하면 회원권과 파트너가 자동으로 연결됩니다."
      : requiredCount > 1
        ? `주 ${requiredCount}회 회원권은 나머지 요일과 시간을 모두 선택해야 합니다.`
        : quickTicketSummary || "회원 검색 후 회원권을 확인하고 저장하세요.";
  }
  if (absenceFocus && pastAbsenceCorrection && $("#lessonQuickGuide")) {
    $("#lessonQuickGuide").textContent = "지난 정규수업을 불참·차감 없음으로 보정하고 보강 신청을 엽니다.";
  }
  const absenceButton = quickActions?.querySelector('[data-lesson-quick-action="absence"]');
  if (absenceButton) {
    absenceButton.textContent = pastAbsenceCorrection ? "지난 불참 보정" : "불참 처리";
  }
  const markAbsentButton = $("#markLessonAbsentButton");
  if (markAbsentButton) {
    markAbsentButton.textContent = pastAbsenceCorrection ? "불참·차감 없음으로 보정" : "불참 처리·보강 열기";
  }
  const toggle = $("#toggleLessonQuickDetails");
  if (toggle) {
    toggle.hidden = state.quickLessonEdit || completedCorrection;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "간단히 보기" : "추가 설정";
  }
  syncLessonEditScopeUi();
}

function pushLessonModalHistoryState() {
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteAdminModal === "lessonModal") return;
  history.pushState({ ...historyState, tennisNoteAdminModal: "lessonModal" }, "", window.location.href);
}

function clearLessonModalHistoryState() {
  const historyState = typeof history.state === "object" && history.state ? { ...history.state } : {};
  if (historyState.tennisNoteAdminModal !== "lessonModal") return;
  delete historyState.tennisNoteAdminModal;
  history.replaceState(historyState, "", window.location.href);
}

function openLessonModal(defaults = {}) {
  if (!$("#oneDayBookingModal")?.hidden) closeOneDayBookingModal();
  const absenceButton = $("#markLessonAbsentButton");
  if (absenceButton) {
    absenceButton.disabled = false;
    absenceButton.textContent = "불참 처리·보강 열기";
  }
  state.editingLessonId = defaults.editingLessonId || null;
  $("#lessonModal").dataset.tnInputGuard = state.editingLessonId
    ? `admin-lesson-${state.editingLessonId}`
    : "admin-lesson-new";
  state.quickLessonEntry = Boolean(!state.editingLessonId && defaults.quickEntry);
  state.quickLessonEdit = Boolean(state.editingLessonId && defaults.quickEdit);
  state.releasedSlotQuickEntry = Boolean(!state.editingLessonId && defaults.releasedSlot);
  state.quickLessonDetailsExpanded = false;
  state.lessonQuickAction = "schedule";
  state.quickLessonReturnSlot = state.quickLessonEntry
    ? { day: defaults.day || "", time: defaults.time || "", coachId: defaults.coachId || "" }
    : null;
  state.lessonOperationKey = createAdminOperationKey(
    state.editingLessonId ? "lesson-edit" : "lesson-create",
  );
  state.releasedAbsenceEntitlementId = state.editingLessonId ? "" : defaults.entitlementId || "";
  state.pinnedLessonDay = state.editingLessonId ? "" : defaults.day || "";
  state.pinnedLessonTime = state.editingLessonId ? "" : defaults.time || "";
  state.pinnedLessonRepeatSlots = !state.editingLessonId && Array.isArray(defaults.repeatSlots) ? defaults.repeatSlots : [];
  const restoreEntitlement = state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
  state.pinnedLessonTicketId = state.editingLessonId ? "" : defaults.ticketId || restoreEntitlement?.ticketId || "";
  state.lessonSourceTouched = false;
  clearLessonSaveResultPanel();
  const hasPinnedScheduleSlot = Boolean(!state.editingLessonId && defaults.day && defaults.time && defaults.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const defaultCorrectionMode = document.querySelector('input[name="lessonPastCorrectionMode"][value="complete"]');
  if (defaultCorrectionMode) defaultCorrectionMode.checked = true;
  const completedCorrection = Boolean(
    editingLesson
    && lessonStatusValue(editingLesson) === "completed"
    && operationsRole() === "admin"
  );
  if (completedCorrection) state.quickLessonDetailsExpanded = true;
  const editingMemberName = getEditingLessonMemberName(editingLesson);
  const requestedMemberName = defaults.memberName || restoreEntitlement?.memberNames?.[0] || "";
  const initialMemberName = editingMemberName || requestedMemberName;
  ["#lessonMemberSearch", "#lessonMember", "#lessonTicket", "#lessonCoach"].forEach((selector) => {
    if ($(selector)) $(selector).disabled = false;
  });
  $("#lessonMemberSearch").value = "";
  refreshLessonMemberOptions(initialMemberName, editingLesson);
  if (initialMemberName && [...$("#lessonMember").options].some((option) => option.value === initialMemberName)) {
    $("#lessonMember").value = initialMemberName;
  } else if (initialMemberName && !editingLesson) {
    const matchingTicket = ticketsForMember(initialMemberName).find((ticket) => String(ticket.id) === String(state.pinnedLessonTicketId))
      || ticketsForMember(initialMemberName)[0];
    ensureLessonMemberOption(
      initialMemberName,
      matchingTicket
        ? `${ticketParticipantNames(matchingTicket).join(" & ") || initialMemberName} · ${getTicketDisplayProduct(matchingTicket)} · ${ticketUsageLabel(matchingTicket)}`
        : `${initialMemberName} · 회원권 확인`,
    );
  }
  fillSelect(
    $("#lessonCoach"),
    coaches
      .filter((coach) => coach.status === "active")
      .map((coach) => ({ value: coach.id, label: `${coach.name} · ${coach.role} · ${getCoachAvailabilityLabel(coach.id)}` })),
  );
  fillSelect(
    $("#lessonCourt"),
    getCourtOptions(),
  );
  fillSelect(
    $("#lessonDay"),
    scheduleDays.map((day) => ({ value: day, label: `${day}요일` })),
  );
  if (!editingLesson && !defaults.day && [...$("#lessonDay").options].some((option) => option.value === currentScheduleDay())) {
    $("#lessonDay").value = currentScheduleDay();
  }
  fillSelect(
    $("#lessonTime"),
    getScheduleTimeOptions().map((time) => ({ value: time, label: time })),
  );
  $("#lessonRepeatSlots").innerHTML = "";
  $("#lessonRepeatSlots").hidden = false;
  if ($("#lessonAdminOverride")) {
    $("#lessonAdminOverride").checked = completedCorrection || scheduleSettings.adminTuningMode === true;
  }
  $("#lessonPastCoachComment").value = "";
  $("#lessonPastCommentKeywords").value = "";
  $("#lessonType").value = "개인";
  $("#lessonSource").value = "regular";
  $("#lessonDuration").value = "20";
  if (editingLesson) {
    if (editingMemberName) $("#lessonMember").value = editingMemberName;
    $("#lessonCoach").value = editingLesson.coachId;
    $("#lessonCourt").value = editingLesson.courtId;
    $("#lessonDay").value = editingLesson.day;
    $("#lessonTime").value = editingLesson.time;
    $("#lessonType").value = editingLesson.type;
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource);
    $("#lessonDuration").value = String(editingLesson.durationMinutes);
  }
  if (defaults.day) $("#lessonDay").value = defaults.day;
  if (defaults.time) $("#lessonTime").value = defaults.time;
  if (defaults.courtId) $("#lessonCourt").value = defaults.courtId;
  if (defaults.coachId) $("#lessonCoach").value = defaults.coachId;
  if (!editingLesson && defaults.lessonType) $("#lessonType").value = defaults.lessonType;
  if (!editingLesson && defaults.durationMinutes) $("#lessonDuration").value = String(defaults.durationMinutes);
  if (!editingLesson && !defaults.coachId) alignCoachToSelectedMemberTicket();
  refreshLessonTicketOptions();
  if (!editingLesson && defaults.ticketId && [...$("#lessonTicket").options].some((option) => String(option.value) === String(defaults.ticketId))) {
    $("#lessonTicket").value = String(defaults.ticketId);
  }
  if (editingLesson) {
    const editingTicket = getTicketByLesson(editingLesson);
    if (editingTicket && [...$("#lessonTicket").options].some((option) => option.value === editingTicket.id)) {
      $("#lessonTicket").value = editingTicket.id;
    }
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource);
    state.lessonSourceTouched = true;
  } else {
    syncLessonSourceFromTicket(true);
  }
  if (completedCorrection) {
    $("#lessonMember").disabled = true;
    $("#lessonTicket").disabled = true;
  }
  if (!editingLesson && defaults.lessonSource) {
    $("#lessonSource").value = normalizeLessonSource(defaults.lessonSource);
    state.lessonSourceTouched = true;
    const matchingTicket = alignTicketToLessonSource(defaults.ticketId);
    if (matchingTicket && String(matchingTicket.id) === String(defaults.ticketId || "")) {
      state.pinnedLessonTicketId = String(defaults.ticketId);
    }
  }
  if (!editingLesson && restoreEntitlement) {
    $("#lessonSource").value = "makeup";
    state.lessonSourceTouched = true;
    alignTicketToLessonSource();
  }
  refreshLessonTimeOptions($("#lessonTime").value);
  if (!editingLesson && !hasPinnedScheduleSlot) autoAssignOpenLessonSlot();
  if (!editingLesson && !hasPinnedScheduleSlot && isPastLessonCorrectionMode(getLessonFormCandidate())) {
    const currentDayIndex = Math.max(0, scheduleDays.indexOf($("#lessonDay").value));
    for (const nextDay of scheduleDays.slice(currentDayIndex + 1)) {
      $("#lessonDay").value = nextDay;
      refreshLessonTimeOptions("");
      autoAssignOpenLessonSlot();
      if (!isPastLessonCorrectionMode(getLessonFormCandidate())) break;
    }
  }
  refreshLessonDurationOptions();
  if (!editingLesson && defaults.durationMinutes && [...$("#lessonDuration").options].some((option) => option.value === String(defaults.durationMinutes))) {
    $("#lessonDuration").value = String(defaults.durationMinutes);
  }
  refreshLessonTimeOptions(hasPinnedScheduleSlot ? defaults.time : $("#lessonTime").value);
  if (hasPinnedScheduleSlot) {
    $("#lessonCoach").value = defaults.coachId;
    $("#lessonDay").value = defaults.day;
    $("#lessonCourt").value = defaults.courtId || $("#lessonCourt").value;
    refreshLessonTimeOptions(defaults.time);
  }
  if (state.releasedSlotQuickEntry && isPastLessonCorrectionMode(getLessonFormCandidate())) {
    if ($("#lessonAdminOverride")) $("#lessonAdminOverride").checked = true;
    if ($("#lessonPastCoachComment") && !$("#lessonPastCoachComment").value.trim()) {
      $("#lessonPastCoachComment").value = "관리자 확인 실제 보강 수업";
    }
  }
  refreshLessonDayOptions();
  if (!editingLesson && defaults.ticketId && [...$("#lessonTicket").options]
    .some((option) => String(option.value) === String(defaults.ticketId))) {
    $("#lessonTicket").value = String(defaults.ticketId);
    state.pinnedLessonTicketId = String(defaults.ticketId);
    refreshLessonDurationOptions();
    refreshLessonDayOptions();
    refreshLessonTimeOptions(hasPinnedScheduleSlot ? defaults.time : $("#lessonTime").value);
  }
  if (!editingLesson && Array.isArray(defaults.repeatSlots) && defaults.repeatSlots.length > 1) {
    applyLessonRepeatSlotDefaults(defaults.repeatSlots);
  }
  syncLessonTypeFromForm();
  renderCurrentLessonMembers(editingLesson);
  renderLessonExpiredTickets();
  $("#lessonModalTitle").textContent = completedCorrection ? "완료 수업 정정" : editingLesson ? "수업 수정" : "수업 추가";
  $("#saveLessonButton").textContent = completedCorrection ? "완료 이력 수정" : editingLesson ? "수정 저장" : "시간표에 추가";
  const editScopePanel = $("#lessonEditScopePanel");
  if (editScopePanel) {
    const canEditSeries = Boolean(editingLesson?.serverLessonId
      && editingLesson.serverStatus === "scheduled"
      && normalizeLessonSource(editingLesson.lessonSource) === "regular");
    editScopePanel.hidden = !canEditSeries;
    const singleScope = editScopePanel.querySelector('input[name="lessonEditScope"][value="single"]');
    if (singleScope) singleScope.checked = true;
    const resetStartInput = $("#lessonResetStartOn");
    if (resetStartInput) {
      resetStartInput.value = editingLesson?.lessonDate || adminWeekDateForDay(editingLesson?.day) || "";
      resetStartInput.min = adminLocalDateKey(new Date());
    }
  }
  const substituteButton = $("#openLessonSubstituteButton");
  if (substituteButton) {
    substituteButton.hidden = !(editingLesson?.serverLessonId && operationsRole() === "admin");
  }
  syncAdminForceDeleteLessonButton();
  const absencePanel = $("#lessonAbsencePanel");
  if (absencePanel) {
    absencePanel.hidden = !(
      editingLesson?.serverLessonId
      && editingLesson.serverStatus === "scheduled"
      && normalizeLessonSource(editingLesson.lessonSource) === "regular"
      && operationsRole() === "admin"
    );
  }
  if ($("#lessonAbsenceReason")) $("#lessonAbsenceReason").value = "";
  refreshLessonMakeupEntitlementOptions();
  if (restoreEntitlement && [...$("#lessonMakeupEntitlement").options].some((option) => option.value === restoreEntitlement.id)) {
    $("#lessonMakeupEntitlement").value = restoreEntitlement.id;
    applySelectedAdminMakeupEntitlement();
  }
  renderLessonAbsenceRestorePanel();
  $("#lessonModal").hidden = false;
  if (!editingLesson && defaults.ticketId) {
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  }
  pushLessonModalHistoryState();
  renderLessonPreview();
  syncLessonEditScopeUi();
  (state.quickLessonEntry ? $("#lessonMemberSearch") : state.quickLessonEdit ? $("#lessonTime") : $("#lessonMember"))?.focus();
}

function openAdminMakeupBooking(entitlement) {
  if (!entitlement || entitlement.status !== "open") return;
  setView("schedule");
  openLessonModal();
  $("#lessonMemberSearch").value = entitlement.memberNames[0] || entitlement.member;
  refreshLessonMemberOptions(entitlement.memberNames[0] || entitlement.member);
  const memberOption = entitlement.memberNames.find((name) => [...$("#lessonMember").options].some((option) => option.value === name));
  if (memberOption) $("#lessonMember").value = memberOption;
  if ([...$("#lessonCoach").options].some((option) => option.value === entitlement.coachId)) {
    $("#lessonCoach").value = entitlement.coachId;
  }
  refreshLessonTicketOptions();
  $("#lessonSource").value = "makeup";
  state.lessonSourceTouched = true;
  refreshLessonMakeupEntitlementOptions();
  $("#lessonMakeupEntitlement").value = entitlement.id;
  applySelectedAdminMakeupEntitlement();
  renderLessonPreview();
}

function submitLessonFormWithoutNativeValidation() {
  return addLessonFromForm({ preventDefault() {} });
}

async function markEditingLessonAbsentForMakeup() {
  const lesson = lessons.find((item) => item.id === state.editingLessonId);
  const reason = $("#lessonAbsenceReason")?.value.trim() || "";
  if (!lesson?.serverLessonId || lessonStatusValue(lesson) !== "scheduled" || lessonSourceValue(lesson) !== "regular") {
    setLessonFormMessage("예정 상태의 정규수업만 불참 처리할 수 있습니다.", "danger");
    return;
  }
  if (isPastLessonCorrectionMode(getLessonFormCandidate())) {
    const absenceCorrectionMode = document.querySelector('input[name="lessonPastCorrectionMode"][value="absence"]');
    if (absenceCorrectionMode) absenceCorrectionMode.checked = true;
    if (!window.confirm(
      `${lesson.member} ${lesson.day} ${lesson.time} 지난 정규수업을 불참으로 보정할까요?\n\n`
      + "횟수는 차감하지 않고 보강 신청을 열며, 시간표 기록은 불참 상태로 보존합니다.",
    )) return;
    renderLessonPreview();
    await submitLessonFormWithoutNativeValidation();
    return;
  }
  if (reason.length < 2) {
    setLessonFormMessage("불참 사유를 2자 이상 입력해 주세요.", "danger");
    $("#lessonAbsenceReason")?.focus();
    return;
  }
  if (!window.confirm(`${lesson.member} ${lesson.day} ${lesson.time} 정규수업을 불참 처리할까요?\n\n횟수는 지금 차감되지 않습니다. 원래 시간은 보강 전용으로 열리고 회원에게 보강 시간 선택 안내가 전달됩니다.`)) return;
  const button = $("#markLessonAbsentButton");
  if (button) {
    button.disabled = true;
    button.textContent = "처리 중";
  }
  setLessonFormMessage("불참 처리와 보강 대기를 생성하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_mark_lesson_absent_for_makeup", {
      target_lesson_id: lesson.serverLessonId,
      target_reason: reason,
    });
    billingLogs.unshift(`${lesson.member} ${lesson.day} ${lesson.time} 불참 처리 · 보강 선택 대기`);
    lesson.serverStatus = "cancelled";
    lesson.status = "cancelled";
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
    closeLessonModal();
    renderSchedule();
    showToast("불참 처리 완료 · 빈자리 공개 및 보강 안내 생성");
    void syncAdminLiveData(true).then((synced) => {
      if (synced && state.view === "schedule") renderSchedule();
    });
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const message = code.includes("absence_reason_required")
      ? "불참 사유를 2자 이상 입력해 주세요."
      : code.includes("absence_lesson_already_started")
        ? "이미 시작한 수업은 사전 불참으로 처리할 수 없습니다."
      : code.includes("absence_lesson_not_scheduled")
        ? "예정 상태가 아닌 수업입니다. 시간표를 새로고침해 주세요."
        : code.includes("absence_regular_lesson_required")
          ? "정규수업만 불참 처리할 수 있습니다."
          : code.includes("absence_coach_or_admin_required")
            ? "관리자 또는 담당 코치만 불참 처리할 수 있습니다."
            : "불참 처리에 실패했습니다. 수업 상태를 다시 확인해 주세요.";
    setLessonFormMessage(message, "danger");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "불참 처리·보강 열기";
    }
  }
}

function closeLessonModal(options = {}) {
  const fromHistory = options?.fromHistory === true;
  const clearHistory = options?.clearHistory === true;
  const quickReturnSlot = state.quickLessonReturnSlot;
  $("#lessonModal").hidden = true;
  $("#lessonModal").classList.remove("is-quick-entry", "is-quick-edit", "is-quick-expanded", "is-absence-focus");
  state.editingLessonId = null;
  state.quickLessonEntry = false;
  state.quickLessonEdit = false;
  state.releasedSlotQuickEntry = false;
  state.quickLessonDetailsExpanded = false;
  state.lessonQuickAction = "schedule";
  state.quickLessonReturnSlot = null;
  state.lessonOperationKey = "";
  state.releasedAbsenceEntitlementId = "";
  state.pinnedLessonTicketId = "";
  state.pinnedLessonDay = "";
  state.pinnedLessonTime = "";
  state.pinnedLessonRepeatSlots = [];
  setLessonFormMessage("");
  clearLessonSaveResultPanel();
  if (quickReturnSlot) window.requestAnimationFrame(() => focusQuickLessonReturnSlot(quickReturnSlot));
  if (clearHistory) {
    clearLessonModalHistoryState();
  } else if (!fromHistory && history.state?.tennisNoteAdminModal === "lessonModal") {
    history.back();
  }
}

function syncSubstituteSettlementFields() {
  const hourly = $("#substituteSettlementMode")?.value === "hourly";
  if ($("#substituteHourlyField")) $("#substituteHourlyField").hidden = !hourly;
  if ($("#substituteHourlyAmount")) $("#substituteHourlyAmount").required = hourly;
}

function openSubstituteModal(defaultLesson = null) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 대타 코치를 지정할 수 있습니다.");
    return;
  }
  const date = defaultLesson?.lessonDate || adminLocalDateKey(new Date());
  state.substituteOperationKey = createAdminOperationKey("substitute-assign");
  $("#substituteDate").value = date;
  state.selectedSubstituteLessonIds = defaultLesson?.serverLessonId ? [String(defaultLesson.serverLessonId)] : [];
  const activeCoaches = operationBranchCoaches().filter((coach) => coach.status === "active" && coach.serverRoleId);
  $("#substituteCoach").innerHTML = `<option value="">코치 선택</option>${activeCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}">${escapeHtml(coach.name)}</option>`).join("")}`;
  $("#substituteSettlementMode").value = "actual_coach";
  $("#substituteHourlyAmount").value = "";
  $("#substituteReason").value = "";
  $("#substituteFormMessage").textContent = "";
  syncSubstituteSettlementFields();
  renderSubstituteLessonList();
  $("#substituteModal").hidden = false;
}

function closeSubstituteModal() {
  if ($("#substituteModal")) $("#substituteModal").hidden = true;
  state.selectedSubstituteLessonIds = [];
  state.substituteOperationKey = "";
}

async function submitSubstituteAssignments(event) {
  event.preventDefault();
  const lessonIds = [...new Set((state.selectedSubstituteLessonIds || []).map(String))];
  const coachRoleId = $("#substituteCoach")?.value || "";
  const settlementMode = $("#substituteSettlementMode")?.value || "actual_coach";
  const hourlyAmount = settlementMode === "hourly" ? Number($("#substituteHourlyAmount")?.value || 0) : null;
  const message = $("#substituteFormMessage");
  if (!lessonIds.length || !coachRoleId || (settlementMode === "hourly" && hourlyAmount <= 0)) {
    if (message) message.textContent = "수업, 실제 코치, 정산 방식을 확인해 주세요.";
    return;
  }
  const button = $("#saveSubstituteAssignments");
  if (button) button.disabled = true;
  try {
    const payload = {
      target_lesson_ids: lessonIds,
      target_substitute_coach_role_id: coachRoleId,
      target_settlement_mode: settlementMode,
      target_hourly_amount: hourlyAmount,
      target_reason: $("#substituteReason")?.value.trim() || null,
    };
    const expectedRevisions = Object.fromEntries(lessonIds.map((lessonId) => {
      const lesson = lessons.find((item) => String(item.serverLessonId) === String(lessonId));
      return [lessonId, lesson?.serverRevision ?? null];
    }));
    if (!state.substituteOperationKey) {
      state.substituteOperationKey = createAdminOperationKey("substitute-assign");
    }
    const result = await guardedRpcWithFallback(
      "tn_admin_assign_lesson_substitutes_guarded",
      {
        ...payload,
        target_expected_revisions: expectedRevisions,
        target_operation_key: state.substituteOperationKey,
      },
      "tn_admin_assign_lesson_substitutes",
      payload,
    );
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#substituteModal");
    closeSubstituteModal();
    if (state.scheduleBulkMode) {
      state.selectedScheduleLessonIds = [];
      state.scheduleBulkOperationKey = "";
      state.scheduleBulkMode = false;
    }
    renderAll();
    showToast(`${Number(result?.assignedCount ?? result?.assigned_count ?? lessonIds.length)}개 수업 대타 지정 완료`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    if (raw.includes("lesson_concurrent_update")) {
      await syncAdminLiveData();
    }
    const messages = {
      lesson_concurrent_update: "다른 화면에서 수업이 먼저 변경되었습니다. 최신 시간표를 불러왔으니 다시 선택해 주세요.",
      lesson_expected_revision_required: "수업의 최신 상태를 확인할 수 없습니다. 시간표를 새로고침해 주세요.",
      substitute_admin_required: "관리자 계정에서만 대타를 지정할 수 있습니다.",
      substitute_lesson_not_found: "선택한 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.",
      substitute_coach_not_available: "선택한 코치가 해당 지점에서 수업 가능한 상태가 아닙니다.",
      substitute_same_coach: "원 담당 코치와 다른 코치를 선택해 주세요.",
      substitute_lesson_closed: "완료되거나 취소된 수업은 대타로 변경할 수 없습니다.",
      substitute_settlement_mode_invalid: "대타 정산 방식을 다시 선택해 주세요.",
      operation_key_reused_with_different_payload: "선택 내용이 변경되었습니다. 창을 닫았다가 다시 열어 주세요.",
    };
    const matched = Object.entries(messages).find(([code]) => raw.includes(code))?.[1];
    if (message) message.textContent = isMissingRpcError(error, "tn_admin_assign_lesson_substitutes_guarded")
      ? "대타 운영 DB 보호 기능을 확인해 주세요."
      : matched || "대타 지정에 실패했습니다. 수업 상태와 코치 지점을 확인해 주세요.";
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function cancelSubstituteAssignments() {
  const lessonIds = [...new Set((state.selectedSubstituteLessonIds || []).map(String))];
  if (!lessonIds.length) {
    $("#substituteFormMessage").textContent = "취소할 대타 수업을 선택해 주세요.";
    return;
  }
  if (!window.confirm(`${lessonIds.length}개 수업의 대타 지정을 취소하고 원 담당 코치로 복원할까요?`)) return;
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_cancel_lesson_substitutes", {
      target_lesson_ids: lessonIds,
      target_reason: $("#substituteReason")?.value.trim() || "관리자 대타 지정 취소",
    });
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#substituteModal");
    closeSubstituteModal();
    renderAll();
    showToast(`${Number(result?.restoredCount ?? result?.restored_count ?? 0)}개 수업 원 담당 코치 복원 완료`);
  } catch {
    $("#substituteFormMessage").textContent = "대타 취소에 실패했습니다. 지정 상태를 새로고침해 확인해 주세요.";
  }
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

function setOneDayBookingMessage(message = "", tone = "") {
  const target = $("#oneDayBookingMessage");
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${tone}`;
}

function oneDayDateForDefaults(defaults = {}) {
  if (defaults.bookingDate) return defaults.bookingDate;
  if (defaults.day) return adminWeekDateForDay(defaults.day);
  const selectedDay = state.selectedScheduleDay || currentScheduleDay();
  return adminWeekDateForDay(selectedDay) || adminLocalDateKey(new Date());
}

function openOneDayBookingModal(defaults = {}) {
  if (!$("#lessonModal")?.hidden) closeLessonModal({ fromHistory: true, clearHistory: true });
  const editingBooking = defaults.bookingId ? oneDayBookingForId(defaults.bookingId) : null;
  state.editingOneDayBookingId = editingBooking?.serverOneDayBookingId || null;
  fillSelect(
    $("#oneDayCoach"),
    coaches
      .filter((coach) => coach.status === "active" && coach.serverRoleId)
      .map((coach) => ({ value: coach.id, label: `${coach.name} · ${coach.role}` })),
  );
  fillSelect($("#oneDayTime"), getScheduleTimeOptions().map((time) => ({ value: time, label: time })));
  $("#oneDayGuestName").value = editingBooking?.member || defaults.guestName || "";
  $("#oneDayGuestPhone").value = editingBooking?.guestPhone || "";
  $("#oneDayDate").value = editingBooking?.lessonDate || oneDayDateForDefaults(defaults);
  $("#oneDayTime").value = editingBooking?.time || defaults.time || getScheduleTimeOptions()[0] || "";
  $("#oneDayDuration").value = String(editingBooking?.durationMinutes || defaults.durationMinutes || 20);
  $("#oneDayStatus").value = editingBooking?.serverStatus || "reserved";
  $("#oneDayNote").value = editingBooking?.oneDayNote || "";
  if (editingBooking?.coachId || defaults.coachId) $("#oneDayCoach").value = editingBooking?.coachId || defaults.coachId;
  $("#oneDayBookingModalTitle").textContent = editingBooking ? "원데이 예약 수정" : "원데이 예약";
  $("#saveOneDayBookingButton").textContent = editingBooking ? "원데이 예약 저장" : "원데이 예약 저장";
  $("#deleteOneDayBookingButton").hidden = !editingBooking;
  $("#oneDayBookingModal").hidden = false;
  renderOneDayBookingPreview();
  $("#oneDayGuestName").focus();
}

function closeOneDayBookingModal() {
  $("#oneDayBookingModal").hidden = true;
  state.editingOneDayBookingId = null;
  setOneDayBookingMessage("");
}

async function saveOneDayBooking(event) {
  event.preventDefault();
  const values = oneDayBookingFormValues();
  const coach = coaches.find((item) => item.id === values.coachId);
  if (!values.guestName || !values.bookingDate || !values.time || !coach?.serverRoleId || !coach.branchId) {
    setOneDayBookingMessage("이름, 코치, 날짜와 시간을 확인해 주세요.", "danger");
    return;
  }
  const previewMessage = $("#oneDayBookingMessage")?.textContent || "";
  if (previewMessage.includes("겹칩니다") || previewMessage.includes("근무 시간")) return;
  const button = $("#saveOneDayBookingButton");
  button.disabled = true;
  setOneDayBookingMessage("원데이 예약을 서버에 저장하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_save_one_day_booking", {
      target_booking_id: values.bookingId,
      target_branch_id: coach.branchId,
      target_coach_role_id: coach.serverRoleId,
      target_booking_date: values.bookingDate,
      target_start_time: values.time,
      target_duration_minutes: values.durationMinutes,
      target_guest_name: values.guestName,
      target_guest_phone: values.guestPhone || null,
      target_note: values.note || null,
      target_status: values.status,
    });
    await syncAdminLiveData();
    window.TennisNoteInputGuard?.markSaved?.("#oneDayBookingModal");
    closeOneDayBookingModal();
    setView("schedule");
    showToast("원데이 예약 저장 완료 · 가입 후 자동 연결 준비");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    const message = raw.includes("one_day_lesson_time_conflict") || raw.includes("one_day_booking_time_conflict")
      ? "같은 코치의 수업 또는 원데이 예약과 시간이 겹칩니다."
      : raw.includes("approved_branch_coach_required")
        ? "승인된 담당 코치를 선택해 주세요."
        : raw.includes("one_day_guest_name_required")
          ? "이름을 두 글자 이상 입력해 주세요."
          : raw.includes("PGRST202") || raw.includes("tn_admin_save_one_day_booking")
            ? "원데이 예약 DB 기능을 먼저 적용해 주세요."
            : "원데이 예약 저장에 실패했습니다. 입력값을 다시 확인해 주세요.";
    setOneDayBookingMessage(message, "danger");
  } finally {
    button.disabled = false;
  }
}

async function deleteOneDayBooking() {
  const booking = oneDayBookingForId(state.editingOneDayBookingId);
  if (!booking || !window.confirm(`${booking.member} 원데이 예약을 삭제할까요?`)) return;
  const button = $("#deleteOneDayBookingButton");
  button.disabled = true;
  try {
    await window.TennisNoteDataClient.rpc("tn_admin_archive_one_day_booking", {
      target_booking_id: booking.serverOneDayBookingId,
    });
    const synced = await syncAdminLiveData(true);
    if (!synced) throw new Error("one_day_refresh_failed");
    if (oneDayBookingForId(booking.serverOneDayBookingId)) {
      throw new Error("one_day_archive_not_confirmed");
    }
    window.TennisNoteInputGuard?.markSaved?.("#oneDayBookingModal");
    closeOneDayBookingModal();
    showToast("원데이 예약 삭제 완료");
  } catch (error) {
    const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
    const message = raw.includes("server_request_timeout")
      ? "서버 응답이 지연되었습니다. 새로고침 후 삭제 여부를 확인해 주세요."
      : raw.includes("one_day_archive_not_confirmed") || raw.includes("one_day_refresh_failed")
        ? "삭제 결과를 서버에서 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요."
        : "원데이 예약 삭제에 실패했습니다.";
    setOneDayBookingMessage(message, "danger");
  } finally {
    button.disabled = false;
  }
}

function releasedAbsenceEntitlement() {
  return state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
}

async function restoreAbsentLessonFromModal() {
  const entitlement = releasedAbsenceEntitlement();
  if (!entitlement) return;
  const cancelBookedMakeup = entitlement.status === "booked";
  const confirmation = cancelBookedMakeup
    ? `${entitlement.member} 회원의 원래 정규수업을 복원할까요?\n\n이미 잡힌 보강 ${entitlement.bookedDate} ${entitlement.bookedTime} 수업은 취소되고, ${entitlement.originalLabel} 정규수업이 다시 확정됩니다.`
    : `${entitlement.member} 회원의 ${entitlement.originalLabel} 정규수업을 다시 살릴까요?\n\n불참 처리와 보강 대기는 취소됩니다.`;
  if (!window.confirm(confirmation)) return;
  const button = $("#restoreAbsentLessonButton");
  if (button) {
    button.disabled = true;
    button.textContent = "복원 중";
  }
  setLessonFormMessage("불참 처리를 되돌리고 원래 정규수업을 복원하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_restore_absent_lesson", {
      target_entitlement_id: entitlement.id,
      target_reason: "회원 참석 재확인",
      target_cancel_booked_makeup: cancelBookedMakeup,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
    closeLessonModal();
    await syncAdminLiveData();
    setView("schedule");
    showToast("원래 정규수업 복원 완료");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const messages = {
      absence_original_slot_occupied: "원래 시간에 다른 수업이 있어 복원할 수 없습니다. 먼저 해당 수업을 이동해 주세요.",
      absence_original_lesson_already_started: "이미 지난 정규수업은 참석으로 되돌릴 수 없습니다.",
      absence_booked_makeup_locked: "이미 시작하거나 완료된 보강이 있어 원래 수업으로 되돌릴 수 없습니다.",
      absence_restore_coach_or_admin_required: "관리자 또는 담당 코치만 원래 수업을 복원할 수 있습니다.",
    };
    setLessonFormMessage(Object.entries(messages).find(([key]) => code.includes(key))?.[1] || "원래 정규수업 복원에 실패했습니다. 시간표를 새로고침해 주세요.", "danger");
    if (button) {
      button.disabled = false;
      button.textContent = "원래 정규수업 복원";
    }
  }
}

function createAdminOperationKey(prefix = "operation") {
  const randomPart = window.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}:${randomPart}`.replace(/[^A-Za-z0-9:_-]/g, "-");
}

async function guardedRpcWithFallback(guardedName, guardedPayload, fallbackName, fallbackPayload) {
  try {
    return await window.TennisNoteDataClient.rpc(guardedName, guardedPayload);
  } catch (error) {
    if (!isMissingRpcError(error, guardedName)) throw error;
    return window.TennisNoteDataClient.rpc(fallbackName, fallbackPayload);
  }
}

async function saveLiveAdminLesson(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !branchId || !lessonDate || !participantUserIds.length) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_participant_user_ids: participantUserIds,
    target_update_regular_rule: !editingLesson
      && !state.quickLessonEntry
      && liveLessonSource(candidate) === "regular",
  };
  if (adminManualOverrideEnabled()) {
    return client.rpc("tn_admin_force_save_lesson", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
      target_makeup_entitlement_id: entitlement?.id || null,
    });
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-save");
  }
  return guardedRpcWithFallback(
    "tn_admin_save_lesson_guarded",
    {
      ...payload,
      target_expected_revision: editingLesson?.serverRevision ?? null,
      target_operation_key: state.lessonOperationKey,
    },
    "tn_admin_save_lesson",
    payload,
  );
}

async function saveLiveAdminRegularScheduleAnchor(candidate) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate || !candidate.time) {
    throw new Error("정규수업의 회원권·코치·날짜 연결을 확인해 주세요.");
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("regular-anchor");
  }
  return client.rpc("tn_admin_add_regular_schedule_anchor", {
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_anchor_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    operation_key: state.lessonOperationKey,
  });
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

function syncLessonEditScopeUi() {
  const panel = $("#lessonEditScopePanel");
  if (!panel || panel.hidden || !state.editingLessonId) return;
  const scope = selectedLessonEditScope();
  const count = scope === "series" || scope === "reset"
    ? Math.max(1, matchingRegularLessonSeries().length)
    : 1;
  const impact = $("#lessonEditScopeImpact");
  const saveButton = $("#saveLessonButton");
  const resetStartField = $("#lessonResetStartField");
  const resetStartInput = $("#lessonResetStartOn");

  if (resetStartField) resetStartField.hidden = scope !== "reset";
  if (resetStartInput) resetStartInput.required = scope === "reset";

  if (impact) {
    impact.textContent = scope === "reset"
      ? `완료된 수업은 보존하고 예정된 정규수업 ${count}건을 새 시작일부터 다시 만듭니다.`
      : scope === "series"
      ? `선택한 날짜부터 같은 정규시간 ${count}건을 함께 변경합니다. 완료된 수업은 유지됩니다.`
      : "선택한 수업 1건만 변경하고 나머지 정규일정은 유지합니다.";
  }
  if (saveButton && !isCompletedLessonCorrectionMode()) {
    saveButton.textContent = scope === "reset"
      ? "정규 일정 다시 설정"
      : scope === "series"
        ? "이후 정규일정 저장"
        : "이번 수업만 저장";
  }
}

async function saveLiveAdminRegularLessonSeries(candidate) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!editingLesson?.serverLessonId || !ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate) {
    throw new Error("수정할 정규수업과 회원권·코치 연결을 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson.serverLessonId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_coach_role_id: coach.serverRoleId,
    target_duration_minutes: candidate.durationMinutes,
  };
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-series");
  }
  return guardedRpcWithFallback(
    "tn_admin_reschedule_regular_lesson_series_guarded",
    {
      ...payload,
      target_expected_revision: editingLesson.serverRevision ?? null,
      target_operation_key: state.lessonOperationKey,
    },
    "tn_admin_reschedule_regular_lesson_series",
    payload,
  );
}

async function resetLiveAdminRegularSchedule(candidate) {
  const client = window.TennisNoteDataClient;
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = getCurrentEditingLesson();
  const startDate = $("#lessonResetStartOn")?.value || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!editingLesson?.serverLessonId || !coach?.serverRoleId || !startDate) {
    throw new Error("새 시작일과 정규수업·코치 연결을 확인해 주세요.");
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-schedule-reset");
  }
  return client.rpc("tn_admin_reset_regular_schedule_guarded", {
    target_lesson_id: editingLesson.serverLessonId,
    target_lesson_date: startDate,
    target_start_time: candidate.time,
    target_coach_role_id: coach.serverRoleId,
    target_duration_minutes: candidate.durationMinutes,
    target_expected_revision: editingLesson.serverRevision ?? null,
    target_operation_key: state.lessonOperationKey,
  });
}

async function saveLivePastLessonCorrection(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = getCurrentEditingLesson();
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  const correctionReason = adminPastCorrectionReason();
  const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인 확인이 필요합니다.");
  }
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !branchId || !lessonDate || !participantUserIds.length) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_coach_comment: coachComment,
    target_correction_reason: correctionReason,
    target_makeup_entitlement_id: entitlement?.id || null,
    target_participant_user_ids: participantUserIds,
  };
  if (adminManualOverrideEnabled()) {
    return client.rpc("tn_admin_force_record_past_lesson", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
    });
  }
  return client.rpc("tn_admin_record_past_lesson", payload);
}

async function saveLiveCompletedLessonCorrection(candidate) {
  const client = window.TennisNoteDataClient;
  const editingLesson = getCurrentEditingLesson();
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인 확인이 필요합니다.");
  }
  if (!editingLesson?.serverLessonId || !coach?.serverRoleId || !lessonDate || !candidate.time) {
    throw new Error("완료 수업·코치·날짜 연결을 확인해 주세요.");
  }
  return client.rpc("tn_admin_correct_completed_lesson", {
    target_lesson_id: editingLesson.serverLessonId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_override_reason: "관리자 완료 수업 정정",
  });
}

async function saveLiveMakeupEntitlement(candidate, entitlement) {
  const client = window.TennisNoteDataClient;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!entitlement?.id || !lessonDate || !candidate.time) throw new Error("보강 대기와 예약 시간을 확인해 주세요.");
  return client.rpc("tn_book_makeup_entitlement", {
    target_entitlement_id: entitlement.id,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_reason: "관리자 수동 보강 예약",
  });
}

async function saveLiveAdminLessonSet(candidates = []) {
  const client = window.TennisNoteDataClient;
  const primary = candidates[0];
  const ticket = scheduleTicketById(primary?.ticketId);
  const coach = coaches.find((item) => item.id === primary?.coachId);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!primary || !ticket?.serverTicketId || !coach?.serverRoleId || !branchId) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const targetSchedules = candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminLessonDateForCandidate(candidate.day),
    startTime: candidate.time,
    durationMinutes: candidate.durationMinutes,
  }));
  if (targetSchedules.some((schedule) => !schedule.lessonDate || !schedule.startTime)) {
    throw new Error("저장할 수업 날짜와 시간을 확인해 주세요.");
  }
  const payload = {
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_schedules: targetSchedules,
    target_lesson_source: liveLessonSource(primary),
    target_participant_user_ids: participantUserIds,
  };
  let result;
  if (adminManualOverrideEnabled()) {
    result = await client.rpc("tn_admin_force_save_lesson_set", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
    });
  } else {
    if (!state.lessonOperationKey) {
      state.lessonOperationKey = createAdminOperationKey("lesson-set");
    }
    result = await guardedRpcWithFallback(
      "tn_admin_save_lesson_set_guarded",
      {
        ...payload,
        target_operation_key: state.lessonOperationKey,
      },
      "tn_admin_save_lesson_set",
      payload,
    );
  }
  const savedCount = Number(result?.scheduleCount || 0);
  if (!result?.ok || savedCount < candidates.length) {
    throw new Error(`live_lesson_write_not_confirmed: 저장 요청 ${savedCount}/${candidates.length}건 확인`);
  }
  return result;
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

async function addLessonFromForm(event) {
  event.preventDefault();
  if (state.lessonWriteInFlight) {
    const writeAge = Date.now() - Number(state.lessonWriteStartedAt || 0);
    if (writeAge < 35_000) {
      setLessonFormMessage("이전 저장을 확인하는 중입니다. 최대 30초 안에 결과를 안내합니다.", "neutral");
      return;
    }
    state.lessonWriteInFlight = false;
    state.lessonWriteStartedAt = 0;
    setLessonSubmitEnabled(true);
    setLessonFormMessage("이전 요청의 응답이 늦어 최신 시간표를 다시 확인합니다. 중복 저장은 서버에서 차단됩니다.", "neutral");
    await syncAdminLiveData(true);
  }
  refreshLessonTicketOptions();
  let candidate = getLessonFormCandidate();
  const pastCorrection = syncPastLessonCorrectionUi(candidate);
  candidate = getLessonFormCandidate();
  const selectedEntitlement = selectedAdminMakeupEntitlement();
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const manualOverride = adminManualOverrideEnabled();
  if (!ticket) {
    setLessonFormMessage("선택한 코치의 회원권이 없어 수업을 추가할 수 없습니다.", "danger");
    return;
  }
  if (isCompletedLessonCorrectionMode()) {
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    const endTimestamp = adminLessonEndTimestamp(candidate);
    if (exactDuplicate) {
      setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있어 중복 저장할 수 없습니다.", "danger");
      return;
    }
    if (!Number.isFinite(endTimestamp) || endTimestamp > Date.now()) {
      setLessonFormMessage("완료 수업은 이미 끝난 날짜와 시간으로만 정정할 수 있습니다.", "danger");
      return;
    }
    const warnings = getAdminManualOverrideWarnings(candidate, ticket, false);
    if (!window.confirm(
      `${getLessonMembersLabel(getCurrentEditingLesson())} 완료 수업을 정정할까요?\n\n`
      + `${candidate.day} ${candidate.time} · ${scheduleCoachDisplayName(getCoachName(candidate.coachId))} · ${candidate.durationMinutes}분\n`
      + `완료 피드백은 유지되고, 회차 차감은 수업시간 차이만큼 자동 조정됩니다.\n`
      + `${warnings.length ? `정책 예외 ${warnings.length}건은 감사 기록에 남습니다.` : "정책 충돌은 없습니다."}`,
    )) return;
    setLessonSubmitEnabled(false);
    setLessonFormMessage("완료 기록과 회원권 회차를 함께 정정하고 있습니다.");
    try {
      const result = await saveLiveCompletedLessonCorrection(candidate);
      const synced = await syncAdminLiveData();
      if (!synced) throw new Error("admin_live_refresh_failed_after_completed_correction");
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      const delta = Number(result?.deductionDelta) || 0;
      showToast(`완료 수업 정정 완료${delta ? ` · 회차 ${delta > 0 ? "+" : ""}${delta}` : " · 회차 유지"}`);
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      const messages = {
        completed_correction_admin_required: "관리자 계정으로만 완료 수업을 정정할 수 있습니다.",
        completed_correction_completed_lesson_required: "완료 상태가 아닌 수업입니다. 시간표를 새로고침해 주세요.",
        completed_correction_record_required: "코치 피드백과 차감 기록을 찾지 못했습니다. 기록/차감 확인에서 먼저 확인해 주세요.",
        completed_correction_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있습니다.",
        completed_correction_future_time: "완료 수업은 이미 끝난 날짜와 시간으로만 정정할 수 있습니다.",
        completed_correction_ticket_balance_insufficient: "수업시간 증가분을 차감할 잔여 횟수가 부족합니다.",
        completed_correction_ticket_count_inconsistent: "회원권 사용 횟수와 완료 기록이 맞지 않아 자동 정정을 중단했습니다.",
        completed_correction_regular_ticket_required: "쿠폰 회원권은 정규수업으로 바꿀 수 없습니다.",
        completed_correction_coupon_ticket_required: "쿠폰수업은 쿠폰 회원권에만 연결할 수 있습니다.",
        admin_live_refresh_failed_after_completed_correction: "정정은 저장됐지만 최신 시간표를 다시 불러오지 못했습니다. 중복 저장하지 말고 새로고침해 주세요.",
      };
      const message = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1]
        || error?.message
        || "완료 수업 정정에 실패했습니다.";
      setLessonFormMessage(message, "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  if (pastCorrection) {
    const correctionReason = adminPastCorrectionReason();
    const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
    const absenceMode = pastLessonCorrectionMode() === "absence";
    if (absenceMode) {
      const editingLesson = getCurrentEditingLesson();
      const ticket = getSelectedTicket();
      if (editingLesson?.serverLessonId && normalizeLessonSource(editingLesson.lessonSource) !== "regular") {
        setLessonFormMessage("정규수업만 사전 불참으로 보정할 수 있습니다.", "danger");
        return;
      }
      if (!editingLesson?.serverLessonId && (!ticket?.serverTicketId || isCouponLessonTicket(ticket))) {
        setLessonFormMessage("불참 회원의 정규 회원권을 선택해 주세요.", "danger");
        return;
      }
      if (correctionReason.length < 5) {
        setLessonFormMessage("보정 사유를 5자 이상 입력해 주세요.", "danger");
        return;
      }
      if (!consumeAdminActionGrant("past_absence_correction")
        && !requestAdminActionUnlock("past_absence_correction", "지난 수업 사전 불참 보정", submitLessonFormWithoutNativeValidation)) {
        if (adminPinNeedsSetup()) setLessonFormMessage("운영 설정의 보안/잠금에서 관리자 PIN을 먼저 설정해 주세요.", "danger");
        return;
      }
      setLessonSubmitEnabled(false);
      setLessonFormMessage("사전 불참으로 보정하고 횟수와 보강 상태를 확인하고 있습니다.");
      try {
        const result = await saveLivePastLessonAbsenceCorrection();
        const restoredSessions = Number(result?.restoredSessions) || 0;
        const occupyingLessonCount = Number(result?.occupyingLessonCount) || 0;
        window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
        closeLessonModal();
        await syncAdminLiveData();
        setView("schedule");
        const resultParts = ["사전 불참 보정 완료"];
        if (restoredSessions > 0) resultParts.push(`${restoredSessions}회 복원`);
        else resultParts.push("횟수 차감 없음");
        resultParts.push("보강 신청 가능");
        if (occupyingLessonCount > 0) resultParts.push("실제 수업 유지");
        showToast(resultParts.join(" · "));
      } catch (error) {
        const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
        const messages = {
          past_absence_admin_required: "관리자 계정으로만 지난 수업을 보정할 수 있습니다.",
          past_absence_reason_too_short: "보정 사유를 5자 이상 입력해 주세요.",
          past_absence_lesson_not_found: "보정할 지난 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.",
          past_absence_slot_required: "불참 회원권·코치·날짜·시간을 모두 확인해 주세요.",
          past_absence_ticket_missing: "불참 회원의 정규 회원권을 선택해 주세요.",
          past_absence_regular_ticket_required: "쿠폰권이 아닌 정규 회원권을 선택해 주세요.",
          past_absence_duration_invalid: "수업 시간은 20·30·40·60분 중에서 선택해 주세요.",
          past_absence_regular_lesson_required: "정규수업만 사전 불참으로 보정할 수 있습니다.",
          past_absence_lesson_not_started: "아직 시작하지 않은 수업은 일반 불참 처리 기능을 사용해 주세요.",
          past_absence_makeup_already_booked: "이미 이 수업의 보강이 예약되어 있습니다. 보강 예약을 먼저 확인해 주세요.",
          past_absence_status_invalid: "현재 수업 상태는 사전 불참으로 보정할 수 없습니다.",
        };
        const matched = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1];
        setLessonFormMessage(matched || "사전 불참 보정에 실패했습니다. 새로고침 후 다시 시도해 주세요.", "danger");
        setLessonSubmitEnabled(true);
      }
      return;
    }
    const sourceRequiresEntitlement = candidate.lessonSource === "makeup" && !state.editingLessonId;
    const sourceInvalid = !state.editingLessonId && candidate.lessonSource === "regular";
    const conflict = getPastLessonCorrectionConflict(candidate);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    if (coachComment.length < 5) {
      setLessonFormMessage("실제 수업 코멘트를 5자 이상 입력해 주세요.", "danger");
      return;
    }
    if (manualOverride) {
      if (exactDuplicate) {
        setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다. 기존 수업을 수정해 주세요.", "danger");
        return;
      }
      const warnings = getAdminManualOverrideWarnings(candidate, ticket, true);
      if (!confirmAdminManualOverride(candidate, warnings)) return;
    } else {
      if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) {
        setLessonFormMessage("선택한 수업 종류에 맞는 회원권이 없습니다.", "danger");
        return;
      }
      if (sourceInvalid) {
        setLessonFormMessage("새 과거 수업은 보강·쿠폰수업 또는 과거수업 보정으로 등록해 주세요.", "danger");
        return;
      }
      if (sourceRequiresEntitlement && !selectedEntitlement) {
        setLessonFormMessage("보강 대기를 선택하거나 수업 종류를 과거수업 보정으로 바꿔 주세요.", "danger");
        return;
      }
      if (conflict) {
        setLessonFormMessage(conflict.message, "danger");
        return;
      }
    }

    setLessonSubmitEnabled(false);
    setLessonFormMessage("과거 수업 완료 기록과 회원권 차감을 함께 반영하고 있습니다.");
    try {
      const result = await saveLivePastLessonCorrection(candidate, selectedEntitlement);
      const deductedSessions = Number(result?.deductedSessions) || 1;
      const remainingSessions = Number(result?.remainingSessions);
      billingLogs.unshift(`${candidate.member} ${candidate.day} ${candidate.time} 과거 수업 보정 · ${deductedSessions}회 차감`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      await syncAdminLiveData();
      showToast(manualOverride
        ? `관리자 강제 처리 완료 · ${deductedSessions}회 차감 · 감사 기록 저장`
        : `과거 수업 반영 완료 · ${deductedSessions}회 차감${Number.isFinite(remainingSessions) ? ` · 잔여 ${remainingSessions}회` : ""}`);
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      const occupiedConflict = errorText.includes("target_time_occupied")
        || errorText.includes("coach_time_occupied")
        || errorText.includes("admin_manual_exact_duplicate");
      if (errorText.includes("lesson_concurrent_update") || occupiedConflict) {
        const conflictDate = candidates?.[0]?.lessonDate || "";
        if (conflictDate) {
          state.activeAdminWeekIndex = Math.min(
            Math.max(adminWeekOffsetForDate(conflictDate), adminScheduleMinWeekOffset),
            adminScheduleMaxWeekOffset,
          );
        }
        await syncAdminLiveData(true);
      }
      const messages = {
        past_lesson_admin_required: "관리자 계정으로만 과거 수업을 보정할 수 있습니다.",
        past_lesson_not_finished: "아직 끝나지 않은 수업은 과거 완료로 처리할 수 없습니다.",
        past_lesson_reason_too_short: "보정 사유를 5자 이상 입력해 주세요.",
        lesson_complete_comment_too_short: "수업 코멘트를 구체적으로 5자 이상 입력해 주세요.",
        lesson_complete_comment_too_generic: "수업 코멘트에 실제 진행 내용과 다음 연습 포인트를 적어 주세요.",
        lesson_complete_comment_recent_duplicate: "최근 코멘트와 같은 내용입니다. 이번 수업 내용을 구체적으로 적어 주세요.",
        past_lesson_duplicate: "같은 회원권·날짜·시간의 수업 기록이 이미 있습니다.",
        past_lesson_coach_time_occupied: "선택한 코치의 기존 수업과 시간이 겹칩니다.",
        past_lesson_date_outside_ticket: "회원권 시작일과 만료일 안의 날짜만 보정할 수 있습니다.",
        past_lesson_ticket_balance_insufficient: "차감할 수 있는 잔여 횟수가 없습니다. 회원권 횟수를 먼저 확인해 주세요.",
        past_lesson_entitlement_required: "불참 처리에서 생성된 보강 대기를 선택해 주세요.",
        past_lesson_entitlement_unavailable: "선택한 보강 대기가 이미 처리됐거나 회원권과 맞지 않습니다.",
        past_lesson_existing_status_invalid: "예정 상태인 지난 수업만 완료 처리할 수 있습니다. 완료 기록은 정정 삭제 후 다시 등록해 주세요.",
        released_regular_slot_makeup_only: "불참으로 비워진 정규 자리는 보강 수업으로 선택해 주세요.",
        admin_manual_override_reason_required: "강제 처리 사유를 5자 이상 입력해 주세요.",
        admin_manual_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다.",
        admin_manual_past_lesson_not_finished: "아직 끝나지 않은 수업은 완료 처리할 수 없습니다.",
        admin_manual_lesson_already_completed: "이미 완료 기록이 있는 수업입니다. 완료 기록을 정정 삭제한 뒤 다시 등록해 주세요.",
      };
      const matchedMessage = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1];
      setLessonFormMessage(matchedMessage || error?.message || "과거 수업 반영에 실패했습니다. 시간표를 새로고침한 뒤 다시 확인해 주세요.", "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  const restorableRegularSlot = getRestorableReleasedRegularSlot(candidate);
  if (!manualOverride && restorableRegularSlot) {
    state.releasedAbsenceEntitlementId = restorableRegularSlot.entitlementId || "";
    await restoreAbsentLessonFromModal();
    return;
  }
  if (!manualOverride) {
    if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) {
      setLessonFormMessage("선택한 수업 종류에 맞는 회원권이 없습니다.", "danger");
      return;
    }
    const conflict = getLessonConflict(candidate);
    if (conflict) {
      setLessonFormMessage(conflict.message, "danger");
      return;
    }
  }

  const regularScheduleValidation = getRegularScheduleValidation(ticket);
  if (!manualOverride && !regularScheduleValidation.valid) {
    setLessonFormMessage(regularScheduleValidation.message, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const selectedSchedules = state.editingLessonId
    ? [{ day: candidate.day, time: candidate.time, lessonDate: candidate.lessonDate }]
    : getSelectedLessonSchedules();
  const scheduleIssueMessage = regularScheduleSaveCheckMessage(ticket, candidate, regularScheduleValidation);
  if (!manualOverride && scheduleIssueMessage) {
    setLessonFormMessage(scheduleIssueMessage, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const scheduleScopeMismatch = selectedSchedules.find((schedule) => !ticketAllowsScheduleDay(ticket, schedule.day));
  if (!manualOverride && scheduleScopeMismatch) {
    setLessonFormMessage(`${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))}은 ${scheduleScopeMismatch.day}요일에 등록할 수 없습니다.`, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const internalConflict = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes);
  if (internalConflict) {
    setLessonFormMessage(internalConflict.message, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const candidates = selectedSchedules.map((schedule, index) => getLessonFormCandidate({
    id: state.editingLessonId || Date.now() + index,
    day: schedule.day,
    time: schedule.time,
    ...(schedule.lessonDate ? { lessonDate: schedule.lessonDate } : {}),
    courtId: getAvailableCourtId(schedule.day, schedule.time, candidate.durationMinutes),
  }));
  const blockingConflict = candidates
    .map((item) => ({ item, conflict: getLessonConflict(item) }))
    .find((result) => result.conflict);
  if (!manualOverride && blockingConflict) {
    setLessonFormMessage(`${blockingConflict.item.day}요일 ${blockingConflict.item.time}: ${blockingConflict.conflict.message}`, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  if (manualOverride) {
    const exactDuplicate = candidates.map((candidate) => getAdminManualExactDuplicate(candidate)).find(Boolean);
    if (exactDuplicate) {
      setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요.", "danger");
      return;
    }
    const warnings = [...new Set(candidates.flatMap((item) => getAdminManualOverrideWarnings(item, ticket, false)))];
    if (!confirmAdminManualOverride(candidate, warnings)) return;
  }

  if (state.liveScheduleLoaded) {
    const wasEditing = Boolean(state.editingLessonId);
    const assignmentTicketId = state.scheduleAssignmentTicketId;
    const assignmentLessonSource = state.scheduleAssignmentLessonSource;
    state.lessonWriteInFlight = true;
    state.lessonWriteStartedAt = Date.now();
    setLessonSubmitEnabled(false);
    saveScheduleSafetySnapshot(lessons, "before-lesson-write");
    setLessonFormMessage("실서버 시간표에 저장 중입니다.");
    showLessonSaveResultPanel({
      status: "saving",
      title: "서버 저장 중",
      message: "저장 후 시간표 재조회까지 확인합니다.",
      expectedCount: candidates.length,
      confirmedCount: 0,
      missingRows: [],
    });
    try {
      let writeResult = null;
      if (selectedEntitlement && candidates.length !== 1) throw new Error("보강 대기 한 건은 한 시간만 예약할 수 있습니다.");
      if (selectedEntitlement && manualOverride) writeResult = await saveLiveAdminLesson(candidates[0], selectedEntitlement);
      else if (selectedEntitlement) writeResult = await saveLiveMakeupEntitlement(candidates[0], selectedEntitlement);
      else if (wasEditing && selectedLessonEditScope() === "reset") writeResult = await resetLiveAdminRegularSchedule(candidates[0]);
      else if (wasEditing && selectedLessonEditScope() === "series") writeResult = await saveLiveAdminRegularLessonSeries(candidates[0]);
      else if (wasEditing) writeResult = await saveLiveAdminLesson(candidates[0]);
      else if (state.quickLessonEntry) {
        writeResult = liveLessonSource(candidates[0]) === "regular"
          ? await saveLiveAdminRegularScheduleAnchor(candidates[0])
          : await saveLiveAdminLesson(candidates[0]);
      } else {
        const scheduleProtectionMessage = !manualOverride
          ? regularScheduleProtectionMessage(ticket, candidates)
          : "";
        if (scheduleProtectionMessage) {
          setLessonSubmitEnabled(true);
          setLessonFormMessage(scheduleProtectionMessage, "danger");
          clearLessonSaveResultPanel();
          return;
        }
        writeResult = await saveLiveAdminLessonSet(candidates);
      }
      const verificationCandidates = selectedLessonEditScope() === "reset"
        ? [{ ...candidates[0], lessonDate: $("#lessonResetStartOn")?.value || "" }]
        : candidates;
      const synced = await syncAdminLiveData();
      if (!synced) throw new Error("admin_live_refresh_failed_after_write");
      const verificationDetails = liveLessonWriteVerificationDetails(ticket, verificationCandidates);
      const writeVerificationError = liveLessonWriteVerification(ticket, verificationCandidates);
      if (writeVerificationError) throw new Error(writeVerificationError);
      const missingAnchorCount = Number(writeResult?.missingAnchorCount) || 0;
      const assignmentCompleted = assignmentTicketId && String(ticket.id) === String(assignmentTicketId)
        && (assignmentLessonSource !== "regular" || missingAnchorCount === 0);
      const nextAssignmentTicket = assignmentCompleted
        ? advanceScheduleTicketAssignment({ currentTicketId: assignmentTicketId, respectUiFilters: false, render: false, notify: false })
        : null;
      showLessonSaveResultPanel({
        status: "good",
        title: "서버 저장 확인 완료",
        message: "저장 요청과 시간표 반영을 모두 확인했습니다.",
        expectedCount: candidates.length,
        confirmedCount: verificationDetails.expectedLessons.length,
        missingRows: [],
      });
      billingLogs.unshift(`${candidate.member} ${selectedSchedules.map((item) => `${item.day} ${item.time}`).join(", ")} 실서버 수업 저장`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      showToast(nextAssignmentTicket
        ? `저장 완료 · 다음 ${ticketParticipantNames(nextAssignmentTicket).join(" & ") || nextAssignmentTicket.member} 회원을 배정하세요.`
        : assignmentCompleted
          ? "저장 완료 · 정규시간 배정 대기열을 모두 처리했습니다."
          : missingAnchorCount > 0
        ? `정규시간 저장 완료 · 다른 요일/시간 ${missingAnchorCount}개를 추가해 주세요.`
        : manualOverride
          ? "관리자 강제 처리 완료 · 감사 기록 저장"
          : selectedEntitlement ? "보강 예약 완료" : wasEditing ? "수업 수정 완료" : "수업 추가 완료");
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      if (errorText.includes("lesson_concurrent_update")) {
        await syncAdminLiveData();
      }
      const messages = {
        released_regular_slot_makeup_only: "불참으로 비워진 정규자리에는 보강수업만 등록할 수 있습니다.",
        makeup_entitlement_not_found: "연결할 보강 대기를 찾지 못했습니다. 시간표를 새로고침해 주세요.",
        makeup_entitlement_not_open: "이미 예약되거나 종료된 보강 대기입니다. 시간표를 새로고침해 주세요.",
        makeup_source_lesson_invalid: "원래 불참 수업 상태가 변경됐습니다. 회원의 보강 대기를 다시 확인해 주세요.",
        makeup_booking_forbidden: "이 보강을 예약할 권한이 없습니다.",
        target_time_must_be_future: "일반 보강 예약은 아직 시작하지 않은 시간만 가능합니다. 지난 수업은 과거수업 보정을 사용해 주세요.",
        active_ticket_required: "사용 가능한 잔여 회원권이 없습니다.",
        target_date_outside_ticket: "회원권 사용기간 안의 날짜를 선택해 주세요.",
        lesson_date_outside_ticket: "회원권 사용기간 안의 날짜를 선택해 주세요.",
        schedule_scope_mismatch: "평일권과 주말권의 이용 가능 요일을 확인해 주세요.",
        coach_not_working: "담당 코치의 근무시간 안에서 선택해 주세요.",
        target_time_blocked: "브레이크타임 또는 수업 제한 시간입니다.",
        no_nearby_coach_lesson: "보강 가능 범위 밖의 시간입니다. 인접 수업과의 간격을 확인해 주세요.",
        target_time_occupied: "서버에 이미 등록된 수업이 있습니다. 해당 주차를 최신 상태로 열었습니다.",
        coach_time_occupied: "서버에 이미 등록된 수업이 있습니다. 해당 주차를 최신 상태로 열었습니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과했습니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과했습니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과했습니다.",
        lesson_duration_ticket_mismatch: "회원권의 수업시간과 선택한 수업시간이 맞지 않습니다.",
        regular_schedule_pending_change_exists: "처리 중인 수업 변경 요청이 있어 정규시간을 교체할 수 없습니다. 요청을 먼저 처리해 주세요.",
        regular_schedule_count_mismatch: `이 회원권은 주 ${ticket.weeklyCount}회이므로 요일/시간 ${ticket.weeklyCount}개를 모두 선택해 주세요.`,
        regular_schedule_anchor_outside_ticket: "회원권 기간 안의 아직 시작하지 않은 날짜를 선택해 주세요.",
        regular_schedule_anchor_limit_reached: "필요한 정규시간이 이미 모두 등록되어 있습니다. 기존 수업 카드를 눌러 시간을 수정해 주세요.",
        regular_ticket_required: "정규권 회원만 미래 정규일정을 자동 등록할 수 있습니다.",
        regular_schedule_exists_edit_existing: "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.",
        regular_schedule_time_invalid: "회원권 기간 안의 아직 시작하지 않은 시간만 정규시간으로 저장할 수 있습니다.",
        regular_series_lesson_required: "예정된 정규수업만 전체 일정으로 수정할 수 있습니다.",
        regular_series_conflict: "변경할 전체 일정 중 다른 수업과 겹치는 시간이 있습니다.",
        regular_series_outside_ticket: "변경하면 회원권 기간을 벗어나는 수업이 생깁니다. 선택일만 수정하거나 회원권 기간을 먼저 확인해 주세요.",
        regular_schedule_rule_not_found: "연결된 정규 일정 규칙을 찾지 못했습니다. 기존 수업을 새로고침한 뒤 다시 시도해 주세요.",
        regular_reset_start_date_invalid: "오늘 이후의 새 시작일을 선택해 주세요.",
        regular_reset_outside_ticket: "회원권 사용기간 안에서 새 시작일을 선택해 주세요.",
        lesson_concurrent_update: "다른 화면에서 이 수업이 먼저 수정되었습니다. 최신 시간표를 불러왔으니 다시 확인해 주세요.",
        lesson_expected_revision_required: "수업의 최신 상태를 확인할 수 없습니다. 시간표를 새로고침한 뒤 다시 수정해 주세요.",
        operation_key_reused_with_different_payload: "저장 내용이 변경되었습니다. 창을 닫았다가 다시 열어 저장해 주세요.",
        admin_manual_override_reason_required: "강제 처리 사유를 5자 이상 입력해 주세요.",
        admin_manual_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있습니다. 해당 주차에서 기존 수업을 수정해 주세요.",
        admin_manual_ticket_required: "연결할 회원권을 찾지 못했습니다.",
        admin_live_refresh_failed_after_write: "저장 후 서버 시간표를 다시 불러오지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
        live_lesson_write_not_confirmed: "서버 저장 결과를 시간표에서 다시 확인하지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
      };
      const message = liveLessonWriteFailureMessage(errorText)
        || Object.entries(messages).find(([code]) => errorText.includes(code))?.[1]
        || error?.message
        || "실서버 수업 저장에 실패했습니다.";
      setLessonFormMessage(message, "danger");
      const verificationDetails = liveLessonWriteVerificationDetails(ticket, candidates);
      const isWriteConfirmFailure = errorText.includes("live_lesson_write_not_confirmed")
        || errorText.includes("admin_live_refresh_failed_after_write");
      showLessonSaveResultPanel({
        status: "danger",
        title: isWriteConfirmFailure ? "서버 반영 확인 필요" : "저장 실패",
        message,
        expectedCount: candidates.length,
        confirmedCount: Math.max(0, verificationDetails.expectedLessons.length - verificationDetails.missing.length),
        missingRows: verificationDetails.missing,
        recoverySteps: lessonSaveRecoverySteps(isWriteConfirmFailure),
      });
      setLessonSubmitEnabled(true);
    } finally {
      state.lessonWriteInFlight = false;
      state.lessonWriteStartedAt = 0;
    }
    return;
  }

  if (!adminDemoMode) {
    setLessonFormMessage("실서버 시간표 연결을 확인하기 전에는 수업을 저장할 수 없습니다. 새로고침 후 다시 시도해 주세요.", "danger");
    setLessonSubmitEnabled(true);
    return;
  }

  const existingIndex = lessons.findIndex((lesson) => lesson.id === state.editingLessonId);
  if (existingIndex >= 0) {
    lessons.splice(existingIndex, 1, candidates[0]);
    billingLogs.unshift(`${candidate.member} ${candidate.day} ${candidate.time} ${lessonTypeLabel(candidate)} 수업 수정`);
  } else {
    lessons.push(...candidates);
    billingLogs.unshift(`${candidate.member} ${selectedSchedules.map((item) => `${item.day} ${item.time}`).join(", ")} ${lessonTypeLabel(candidate)} 수업 추가`);
  }
  lessons.sort((a, b) => scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || timeToMinutes(a.time) - timeToMinutes(b.time));
  if (state.scheduleAssignmentTicketId && String(ticket.id) === String(state.scheduleAssignmentTicketId)) {
    clearScheduleTicketAssignment(false);
  }
  window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  closeLessonModal();
  setView("schedule");
  renderAll();
}

function openEditLessonModal(lessonId, allLessons = lessons) {
  const parsedId = Number.isNaN(Number(lessonId)) ? lessonId : Number(lessonId);
  const lesson = allLessons.find((item) => item.id === parsedId);
  if (!lesson) return;
  openLessonModal({ editingLessonId: parsedId, quickEdit: true });
}

async function deleteEditingLesson() {
  if (operationsRole() !== "admin") {
    setLessonFormMessage("관리자만 수업을 강제 삭제할 수 있습니다.", "danger");
    return;
  }
  const lesson = adminForceDeleteLessonTarget();
  if (!lesson) {
    setLessonFormMessage("현재 조건에서 삭제할 기존 수업이 없습니다.", "danger");
    return;
  }
  if (state.liveScheduleLoaded && lesson.serverLessonId) {
    const confirmationMessage = `${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 수업을 강제 삭제할까요?\n\n완료·불참·보강·과거 수업도 제거하며 차감 횟수는 복원합니다. 삭제 사실은 감사 기록에 남습니다.`;
    if (!window.confirm(confirmationMessage)) return;
    setLessonSubmitEnabled(false);
    setLessonFormMessage("차감 횟수를 복원하고 수업을 강제 삭제하는 중입니다.");
    try {
      const result = await window.TennisNoteDataClient.rpc("tn_admin_force_delete_lesson", {
        target_lesson_id: lesson.serverLessonId,
        target_reason: "관리자 수업 강제 삭제",
      });
      const restoredSessions = Number(result?.restoredSessions || 0);
      billingLogs.unshift(`${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 강제 삭제 · ${restoredSessions}회 복원`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      await syncAdminLiveData();
      showToast(`수업 강제 삭제 완료 · ${restoredSessions}회 복원`);
    } catch (error) {
      const message = `${error?.payload?.message || ""} ${error?.message || ""}`;
      const friendlyMessage = message.includes("lesson_correction_ticket_inconsistent")
        ? "회원권 횟수와 완료 기록이 맞지 않아 자동 복원을 중단했습니다. 관리자 데이터 확인이 필요합니다."
        : message.includes("tn_admin_force_delete_lesson") || message.includes("PGRST202")
            ? "강제 삭제 DB 기능을 먼저 적용해 주세요."
            : "실서버 수업 강제 삭제에 실패했습니다.";
      setLessonFormMessage(friendlyMessage, "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  const index = lessons.findIndex((item) => item.id === lesson.id);
  if (index >= 0) lessons.splice(index, 1);
  billingLogs.unshift(`${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 강제 삭제`);
  window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  closeLessonModal();
  setView("schedule");
  renderAll();
}

function pendingLessonChangeApprovals() {
  return operationBranchMakeupRequests()
    .filter((request) => request.makeupType !== "entitlement" && request.serverRequestId && request.status === "pending")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

async function reviewAdminLessonChangeRequest(requestId, decision, button) {
  const request = makeupRequests.find((item) => String(item.serverRequestId || item.id) === String(requestId || ""));
  if (!request || request.status !== "pending") {
    showToast("이미 처리되었거나 요청을 찾을 수 없습니다. 시간표를 새로고침해 주세요.");
    return;
  }
  if (decision === "rejected" && !window.confirm(`${request.member}님의 변경 요청을 거절할까요? 운영 정책에 따라 원래 수업이 차감 처리될 수 있습니다.`)) return;
  const originalLabel = button?.textContent || "처리";
  if (button) {
    button.disabled = true;
    button.textContent = "처리 중";
  }
  try {
    await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
      target_request_id: request.serverRequestId,
      target_decision: decision,
      target_note: decision === "rejected" ? "관리자 승인 불가" : null,
    });
    await syncAdminLiveData();
    renderAdminView("schedule");
    showToast(decision === "approved" ? "수업 변경을 승인했습니다." : "수업 변경 요청을 거절했습니다.");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const messages = {
      request_not_pending: "다른 사용자가 먼저 처리했습니다. 새로고침합니다.",
      effective_coach_or_admin_required: "현재 담당 코치 또는 관리자만 처리할 수 있습니다.",
      target_time_occupied: "요청한 시간에 다른 수업이 생겼습니다. 회원에게 새 시간을 요청해 주세요.",
      target_effective_coach_unavailable: "현재 담당 코치가 요청한 시간에 근무하지 않습니다.",
    };
    const key = Object.keys(messages).find((candidate) => code.includes(candidate));
    showToast(messages[key] || `변경 요청 처리 실패: ${code}`);
    await syncAdminLiveData();
    renderAdminView("schedule");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
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

function adminPaymentCancelReady() {
  const client = window.TennisNoteDataClient;
  return Boolean(client?.readiness?.().ready && client.getSession?.()?.access_token && adminImportAuthState.profile?.role === "admin");
}

function adminPaymentCancelBlockedMessage() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return "Supabase 연결값 설정 후 결제취소를 사용할 수 있습니다.";
  if (!client.getSession?.()?.access_token) return "관리자 로그인 후 결제취소할 수 있습니다.";
  if (adminImportAuthState.loading) return "관리자 권한을 확인하는 중입니다.";
  if (adminImportAuthState.user && adminImportAuthState.profile?.role !== "admin") return "관리자 권한 계정만 결제취소할 수 있습니다.";
  return "관리자 권한 확인 후 결제취소할 수 있습니다.";
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
    const label = isStaleReadyPayment(item) ? "상태 확인" : "결제 확인";
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

async function verifyBillingPaymentItem(item) {
  if (!item?.providerPaymentId) {
    billingLogs.unshift(`${item?.member || "회원"} ${item?.item || "결제"} 서버검증 실패: paymentId 없음`);
    renderAll();
    showToast("paymentId가 없어 서버 검증을 실행할 수 없습니다");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member} ${item.item} 서버검증 실패: Supabase 연결값 없음`);
    renderAll();
    showToast("Supabase 연결값 확인 필요");
    return;
  }

  item.statusLabel = "서버검증중";
  billingLogs.unshift(`${item.member} ${item.item} 서버검증 실행: ${item.providerPaymentId}`);
  renderAll();

  try {
    const result = await client.invokeFunction("portone-payment/verify", {
      body: { paymentId: item.providerPaymentId },
    });
    if (result?.ok) {
      item.status = result.status === "verified" || result.status === "already_verified" ? "paid" : "check";
      item.statusLabel = result.chargedTicket ? "검증/충전완료" : "서버검증완료";
      billingLogs.unshift(`${item.member} ${item.item} 서버검증 완료: ${result.status}`);
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast("서버 결제 검증 완료");
    } else if (result?.code === "payment_not_paid") {
      item.status = "server_ready";
      item.statusLabel = "결제대기";
      billingLogs.unshift(`${item.member} ${item.item} 아직 Toss 결제 완료 전: ${result.portoneStatus || "pending"}`);
      showToast("아직 결제 완료 전입니다");
    } else {
      item.status = "check";
      item.statusLabel = "검증확인필요";
      billingLogs.unshift(`${item.member} ${item.item} 서버검증 확인 필요: ${result?.code || "unknown"}`);
      showToast("서버 검증 확인 필요");
    }
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    if (code === "payment_not_paid") {
      item.status = "server_ready";
      item.statusLabel = "결제대기";
      billingLogs.unshift(`${item.member} ${item.item} 아직 Toss 결제 완료 전`);
      showToast("아직 결제 완료 전입니다");
    } else {
      item.status = "check";
      item.statusLabel = "검증실패";
      billingLogs.unshift(`${item.member} ${item.item} 서버검증 실패: ${code}`);
      showToast("서버 검증 실패");
    }
  }
  renderAll();
}

async function ensureAdminPaymentCancelReady(item = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: Supabase 연결값 없음`);
    renderAll();
    showToast("Supabase 연결 후 결제취소 가능");
    return false;
  }
  if (!client.getSession?.()?.access_token) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: 관리자 로그인 필요`);
    renderAll();
    showToast("관리자 로그인 후 결제취소 가능");
    return false;
  }
  if (!adminPaymentCancelReady()) {
    await refreshAdminImportAuthState();
  }
  if (!adminPaymentCancelReady()) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: 관리자 권한 확인 필요`);
    renderAll();
    showToast("관리자 권한 계정만 결제취소 가능");
    return false;
  }
  return true;
}

function newRefundIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `refund:${value}`;
}

function closeRefundModal() {
  $("#refundModal")?.setAttribute("hidden", "");
  $("#refundForm")?.reset();
  Object.assign(refundFlowState, {
    itemIndex: -1,
    preview: null,
    loading: false,
    submitting: false,
    reconcileRequired: false,
    idempotencyKey: "",
    message: "",
    tone: "neutral",
  });
}

async function openRefundModal(item, itemIndex) {
  if (!(await ensureAdminPaymentCancelReady(item))) return;
  if (!item?.providerPaymentId) {
    showToast("서버 결제번호가 필요합니다");
    return;
  }
  Object.assign(refundFlowState, {
    itemIndex,
    preview: null,
    loading: true,
    submitting: false,
    reconcileRequired: item.status === "refund_reconcile",
    idempotencyKey: newRefundIdempotencyKey(),
    message: "",
    tone: "neutral",
  });
  $("#refundModal")?.removeAttribute("hidden");
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-preview", {
      body: { paymentId: item.providerPaymentId },
    });
    if (result?.status === "already_refunded") {
      billingLogs.unshift(`${item.member} 환불은 이미 완료된 결제입니다.`);
      await loadServerPaymentsIntoBilling({ silent: true });
      closeRefundModal();
      showToast("이미 환불 완료된 결제입니다");
      return;
    }
    refundFlowState.preview = result?.preview || null;
    refundFlowState.message = refundFlowState.reconcileRequired ? "PG 취소 결과를 확인한 뒤 내부 기록을 다시 맞춰 주세요." : "계산값을 확인한 뒤 관리자 PIN과 확인 문구를 입력하세요.";
  } catch (error) {
    const code = error?.payload?.code || "refund_preview_failed";
    refundFlowState.message = refundErrorText(code);
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.loading = false;
    renderRefundModal();
  }
}

async function verifyRefundAdminInputs({ requireReason = true } = {}) {
  const reason = $("#refundReason")?.value.trim() || "";
  const confirmation = $("#refundConfirmationText")?.value.trim() || "";
  const pin = $("#refundAdminPin")?.value.trim() || "";
  if (requireReason && reason.length < 2) {
    refundFlowState.message = "환불 사유를 2자 이상 입력해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (confirmation !== "환불") {
    refundFlowState.message = "최종 확인란에 환불을 입력해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (adminPinNeedsSetup()) {
    refundFlowState.message = "먼저 설정의 보안/잠금에서 관리자 PIN을 설정해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (!(await verifyAdminPin(pin))) {
    refundFlowState.message = "관리자 PIN이 맞지 않습니다.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  if (refundFlowState.preview?.requiresPolicyFallbackConfirmation && !$("#acceptRefundPolicyFallback")?.checked) {
    refundFlowState.message = "현재 정책 기준 계산 확인란을 체크해 주세요.";
    refundFlowState.tone = "danger";
    renderRefundModal();
    return null;
  }
  return { reason, confirmation };
}

async function confirmRefundFromModal() {
  const item = billings[refundFlowState.itemIndex];
  const preview = refundFlowState.preview;
  if (!item || !preview || refundFlowState.submitting) return;
  const inputs = await verifyRefundAdminInputs();
  if (!inputs) return;
  refundFlowState.submitting = true;
  refundFlowState.message = "PortOne 환불과 내부 이용권 반영을 처리하고 있습니다.";
  refundFlowState.tone = "neutral";
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund", {
      body: {
        paymentId: item.providerPaymentId,
        expectedRefundAmount: numericValue(preview.refundAmount),
        expectedUsedSessions: numericValue(preview.usedSessions),
        reason: inputs.reason,
        confirmation: inputs.confirmation,
        acceptPolicyFallback: Boolean($("#acceptRefundPolicyFallback")?.checked),
        idempotencyKey: refundFlowState.idempotencyKey,
      },
    });
    if (result?.ok) {
      billingLogs.unshift(`${item.member} 환불 완료: ${money.format(numericValue(result.refundAmount || preview.refundAmount))}원`);
      closeRefundModal();
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast("환불과 이용권 반영 완료");
      return;
    }
    if (result?.code === "reconcile_required") {
      refundFlowState.reconcileRequired = true;
      refundFlowState.message = refundErrorText(result.code);
      refundFlowState.tone = "danger";
    } else {
      refundFlowState.message = refundErrorText(result?.code);
      refundFlowState.tone = "danger";
      if (result?.preview) refundFlowState.preview = result.preview;
    }
  } catch (error) {
    const code = error?.payload?.code || "refund_failed";
    if (code === "reconcile_required") refundFlowState.reconcileRequired = true;
    if (error?.payload?.preview) refundFlowState.preview = error.payload.preview;
    refundFlowState.message = refundErrorText(code);
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.submitting = false;
    renderRefundModal();
  }
}

async function reconcileRefundFromModal() {
  const item = billings[refundFlowState.itemIndex];
  if (!item || refundFlowState.submitting) return;
  const inputs = await verifyRefundAdminInputs({ requireReason: false });
  if (!inputs) return;
  refundFlowState.submitting = true;
  refundFlowState.message = "PG 취소 결과와 내부 기록을 다시 확인하고 있습니다.";
  refundFlowState.tone = "neutral";
  renderRefundModal();
  try {
    const result = await window.TennisNoteDataClient.invokeFunction("portone-payment/refund-reconcile", {
      body: { paymentId: item.providerPaymentId },
    });
    if (result?.ok) {
      billingLogs.unshift(`${item.member} 환불 상태 동기화 완료`);
      closeRefundModal();
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast("환불 상태 동기화 완료");
      return;
    }
    refundFlowState.message = refundErrorText(result?.code);
    refundFlowState.tone = "danger";
  } catch (error) {
    refundFlowState.message = refundErrorText(error?.payload?.code || "reconcile_failed");
    refundFlowState.tone = "danger";
  } finally {
    refundFlowState.submitting = false;
    renderRefundModal();
  }
}

function newPaymentCancelIdempotencyKey() {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cancel:${value}`;
}

function closePaymentCancelModal() {
  if (paymentCancelFlowState.submitting) return;
  $("#paymentCancelModal")?.setAttribute("hidden", "");
  $("#paymentCancelForm")?.reset();
  Object.assign(paymentCancelFlowState, {
    itemIndex: -1,
    submitting: false,
    idempotencyKey: "",
    message: "",
    tone: "neutral",
  });
}

async function openPaymentCancelModal(item, itemIndex = billings.indexOf(item)) {
  const serverBacked = Boolean(item?.serverPaymentId);
  const localPending = item && ["check", "unverified", "failed"].includes(item.status) && !serverBacked;
  if (!item?.providerPaymentId) {
    billingLogs.unshift(`${item?.member || "회원"} ${item?.item || "결제"} 취소 실패: paymentId 없음`);
    renderAll();
    showToast("paymentId가 없어 결제취소를 실행할 수 없습니다");
    return;
  }
  if (!localPending && !["paid", "server_ready", "failed", "cancel_reconcile"].includes(item.status)) {
    showToast("취소 가능한 상태가 아닙니다");
    return;
  }
  if (!(await ensureAdminPaymentCancelReady(item))) return;
  Object.assign(paymentCancelFlowState, {
    itemIndex,
    submitting: false,
    idempotencyKey: newPaymentCancelIdempotencyKey(),
    message: "대상과 금액을 확인하고 취소 사유와 최종 확인 문구를 입력하세요.",
    tone: "neutral",
  });
  $("#paymentCancelForm")?.reset();
  if (!item || !["paid", "cancel_reconcile"].includes(item.status)) {
    if ($("#paymentCancelReason")) $("#paymentCancelReason").value = "결제 전 대기건 정리";
  }
  $("#paymentCancelModal")?.removeAttribute("hidden");
  renderPaymentCancelModal();
  $("#paymentCancelReason")?.focus();
}

async function confirmPaymentCancelFromModal() {
  const item = billings[paymentCancelFlowState.itemIndex];
  if (!item || paymentCancelFlowState.submitting) return;
  const reason = $("#paymentCancelReason")?.value.trim() || "";
  const confirmation = $("#paymentCancelConfirmationText")?.value.trim() || "";
  const expectedConfirmation = paymentCancelConfirmationPhrase(item);
  if (reason.length < 2) {
    paymentCancelFlowState.message = "결제취소 사유를 2자 이상 입력해 주세요.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  if (confirmation !== expectedConfirmation) {
    paymentCancelFlowState.message = `최종 확인란에 ${expectedConfirmation}를 입력해 주세요.`;
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  await executeBillingPaymentCancellation(item, reason);
}

async function executeBillingPaymentCancellation(item, reason) {
  const serverBacked = Boolean(item?.serverPaymentId);
  const localPending = item && ["check", "unverified", "failed"].includes(item.status) && !serverBacked;
  const actionLabel = ["paid", "cancel_reconcile"].includes(item.status) ? "실제 결제취소" : "결제 전 대기취소";
  const cancelAmount = paymentFullCancelAmount(item);
  if (paymentCancelInFlight.has(item.providerPaymentId)) {
    paymentCancelFlowState.message = "같은 결제의 취소 요청이 이미 처리 중입니다.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  if (localPending) {
    item.status = "cancelled";
    item.statusLabel = "대기취소";
    item.refundReason = reason;
    item.refundedAt = new Date().toISOString();
    billingLogs.unshift(`${item.member} ${item.item} 대기건 정리: ${reason}`);
    saveSnapshot();
    closePaymentCancelModal();
    renderAll();
    showToast("결제 대기건 정리 완료");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: Supabase 연결값 없음`);
    paymentCancelFlowState.message = "Supabase 연결값을 확인해 주세요.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }

  paymentCancelFlowState.submitting = true;
  paymentCancelFlowState.message = "PortOne 결제취소와 연결 회원권 비활성화를 처리하고 있습니다.";
  paymentCancelFlowState.tone = "neutral";
  item.statusLabel = "취소처리중";
  billingLogs.unshift(`${item.member} ${item.item} ${actionLabel} 요청`);
  paymentCancelInFlight.add(item.providerPaymentId);
  renderPaymentCancelModal();
  renderAll();

  try {
    const result = await client.invokeFunction("portone-payment/cancel", {
      body: {
        paymentId: item.providerPaymentId,
        amount: cancelAmount,
        reason,
        idempotencyKey: paymentCancelFlowState.idempotencyKey,
      },
    });
    if (result?.ok) {
      item.status = "cancelled";
      item.statusLabel = result.localOnly ? "대기취소" : "결제취소";
      const alreadyCancelled = result?.status === "already_cancelled";
      billingLogs.unshift(`${item.member} ${item.item} 취소 완료: ${alreadyCancelled ? "이미 취소된 결제" : result.localOnly ? "대기건 정리" : "PortOne 취소"}`);
      await loadServerPaymentsIntoBilling({ silent: true, force: true });
      paymentCancelFlowState.submitting = false;
      closePaymentCancelModal();
      showToast(alreadyCancelled ? "이미 취소 완료된 결제입니다" : result.localOnly ? "대기 결제 정리 완료" : "결제 취소 완료");
    } else {
      item.statusLabel = "취소확인필요";
      billingLogs.unshift(`${item.member} ${item.item} 취소 확인 필요: ${result?.code || "unknown"}`);
      paymentCancelFlowState.message = refundErrorText(result?.code || "provider_cancel_failed");
      paymentCancelFlowState.tone = "danger";
    }
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    item.statusLabel = "취소실패";
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: ${code}`);
    paymentCancelFlowState.message = refundErrorText(code);
    paymentCancelFlowState.tone = "danger";
  } finally {
    paymentCancelInFlight.delete(item.providerPaymentId);
    paymentCancelFlowState.submitting = false;
  }
  renderPaymentCancelModal();
  renderAll();
}

async function cancelBillingPaymentItem(item, itemIndex = billings.indexOf(item)) {
  await openPaymentCancelModal(item, itemIndex);
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

function closeLessonRecordModal() {
  const modal = $("#lessonRecordModal");
  if (modal) modal.hidden = true;
  Object.assign(lessonRecordEditorState, { lessonId: "", journalId: "", saving: false });
  $("#lessonRecordForm")?.reset();
  if ($("#lessonRecordMessage")) $("#lessonRecordMessage").textContent = "";
}

function updateLessonRecordCurriculumLink() {
  const selectedId = $("#lessonRecordCurriculum")?.value || "";
  const curriculum = adminCurriculumChoices().find((item) => item.value === selectedId);
  const link = $("#lessonRecordCurriculumLink");
  if (!link) return;
  link.hidden = selectedLessonRecordOutcome().startsWith("no_show") || !curriculum?.notionUrl;
  link.href = curriculum?.notionUrl || "#";
}

function selectedLessonRecordOutcome() {
  return document.querySelector('input[name="lessonRecordOutcome"]:checked')?.value || "completed_deduct";
}

function syncLessonRecordOutcomeUi() {
  const value = selectedLessonRecordOutcome();
  const noShow = value.startsWith("no_show");
  const deduct = value.endsWith("_deduct");
  const comment = $("#lessonRecordComment");
  const curriculum = $("#lessonRecordCurriculum");
  $("#lessonRecordCommentLabel").textContent = noShow ? "노쇼 사유" : "코치 코멘트";
  comment.placeholder = noShow ? "예: 연락 없이 불참" : "이번 수업에서 확인한 내용과 다음 연습 포인트를 5자 이상 작성해 주세요.";
  comment.minLength = noShow ? 2 : 5;
  curriculum.required = !noShow;
  curriculum.closest("label").hidden = noShow;
  $("#lessonRecordCurriculumLink").hidden = noShow || !$("#lessonRecordCurriculumLink").href;
  $("#saveLessonRecordButton").textContent = `${noShow ? "노쇼" : "완료"} 저장 · ${deduct ? "횟수 차감" : "차감 없음"}`;
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

async function ensureAdminCurriculumRef(choiceValue) {
  if (!String(choiceValue).startsWith("catalog:")) return choiceValue;
  const code = String(choiceValue).slice("catalog:".length);
  const step = (window.TennisNoteCurriculumCatalog?.steps || []).find((item) => item.id === code);
  if (!step) throw new Error("curriculum_choice_not_found");
  return window.TennisNoteDataClient.rpc("tn_ensure_curriculum_ref", {
    target_code: step.id,
    target_level: `${step.trackTitle || step.category || "커리큘럼"} · ${step.stageLabel || step.level || "단계"}`,
    target_title: step.title,
    target_notion_url: step.notionUrl || "",
  });
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

function openLessonRecordModal(lessonId) {
  const lesson = lessons.find((item) => item.serverLessonId === lessonId);
  const reviewableStatuses = new Set(["scheduled", "pending_change", "completed", "no_show"]);
  if (!lesson || !reviewableStatuses.has(String(lesson.serverStatus || ""))) {
    showToast("처리할 수업을 새로고침 후 다시 선택해 주세요.");
    return;
  }
  const ownRoleIds = currentOperationsCoachRoleIds();
  if (operationsRole() === "coach" && !ownRoleIds.has(lesson.coachRoleId)) {
    showToast("본인 담당 수업만 처리할 수 있습니다.");
    return;
  }
  const scheduleV2 = window.TennisNoteScheduleV2Admin;
  if (scheduleV2?.openLesson) {
    setView("schedule", { skipLock: true });
    void scheduleV2.openLesson({
      lessonId,
      lessonDate: lesson.lessonDate,
      mode: "outcome",
    }).then((opened) => {
      if (!opened && lesson.serverStatus === "scheduled") openLegacyLessonRecordModal(lessonId);
      else if (!opened) showToast("V2 기록에서 수업을 찾지 못했습니다. 새로고침 후 다시 선택해 주세요.");
    }).catch(() => {
      if (lesson.serverStatus === "scheduled") openLegacyLessonRecordModal(lessonId);
      else showToast("완료 기록을 불러오지 못했습니다. 새로고침 후 다시 선택해 주세요.");
    });
    return;
  }
  openLegacyLessonRecordModal(lessonId);
}

function openLegacyLessonRecordModal(lessonId) {
  const lesson = lessons.find((item) => item.serverLessonId === lessonId);
  if (!lesson || lesson.serverStatus !== "scheduled") {
    showToast("처리할 수업을 새로고침 후 다시 선택해 주세요.");
    return;
  }
  const ownRoleIds = currentOperationsCoachRoleIds();
  if (operationsRole() === "coach" && !ownRoleIds.has(lesson.coachRoleId)) {
    showToast("본인 담당 수업만 처리할 수 있습니다.");
    return;
  }
  const journal = (adminLiveDataState.journalEntries || [])
    .filter((entry) => entry.lesson_id === lessonId)
    .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")))[0] || null;
  const mediaCount = journal
    ? (adminLiveDataState.mediaFiles || []).filter((media) => media.journal_entry_id === journal.id).length
    : 0;
  Object.assign(lessonRecordEditorState, { lessonId, journalId: journal?.id || "", saving: false });
  $("#lessonRecordContext").innerHTML = `
    <strong>${escapeHtml(lesson.member)} · ${escapeHtml(lesson.lessonDate)} ${escapeHtml(lesson.time)}</strong>
    <span>${escapeHtml(getCoachName(lesson.coachId))} · ${escapeHtml(lesson.type)} ${Number(lesson.durationMinutes) || 20}분 · 잔여 ${Number(lesson.ticketRemaining) || 0}회</span>
    <p>${journal ? escapeHtml(journalBodySummary(journal.body)) : "회원 운동일지 미작성 · 코치 기록만으로 완료할 수 있습니다."}</p>
    ${mediaCount ? `<button class="ghost-button" type="button" data-open-journal-media="${escapeHtml(journal.id)}">사진·영상 ${mediaCount}개 보기</button>` : ""}`;
  const select = $("#lessonRecordCurriculum");
  const choices = adminCurriculumChoices();
  if ($("#lessonRecordCurriculumSearch")) $("#lessonRecordCurriculumSearch").value = "";
  if ($("#lessonRecordCurriculumSuggestions")) $("#lessonRecordCurriculumSuggestions").hidden = true;
  select.innerHTML = `<option value="">다음 커리큘럼 선택</option>${choices.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}`;
  $("#lessonRecordComment").value = "";
  const defaultOutcome = document.querySelector('input[name="lessonRecordOutcome"][value="completed_deduct"]');
  if (defaultOutcome) defaultOutcome.checked = true;
  $("#lessonRecordMessage").textContent = choices.length ? "" : "연결된 커리큘럼이 없습니다.";
  $("#lessonRecordModal").hidden = false;
  syncLessonRecordOutcomeUi();
  updateLessonRecordCurriculumLink();
  $("#lessonRecordComment").focus();
}

function applyAdminCommentDraft(keywordSelector, commentSelector) {
  const keywordInput = $(keywordSelector);
  const commentInput = $(commentSelector);
  const generator = window.TennisNoteCommentDraft;
  if (!keywordInput || !commentInput || !generator?.generate) {
    showToast("코멘트 초안 기능을 불러오지 못했습니다.");
    return;
  }
  const result = generator.generate(keywordInput.value);
  if (!result.ok) {
    showToast(result.message);
    keywordInput.focus();
    return;
  }
  commentInput.value = result.comment;
  commentInput.dispatchEvent(new Event("input", { bubbles: true }));
  commentInput.focus();
  showToast("세부 코멘트 초안을 만들었습니다. 내용을 확인한 뒤 저장해 주세요.");
}

async function saveLessonRecord(event) {
  event.preventDefault();
  if (lessonRecordEditorState.saving) return;
  const comment = $("#lessonRecordComment").value.trim();
  const curriculumId = $("#lessonRecordCurriculum").value;
  const outcomeValue = selectedLessonRecordOutcome();
  const noShow = outcomeValue.startsWith("no_show");
  const deduct = outcomeValue.endsWith("_deduct");
  const message = $("#lessonRecordMessage");
  if (comment.length < (noShow ? 2 : 5) || (!noShow && !curriculumId)) {
    message.textContent = comment.length < (noShow ? 2 : 5)
      ? noShow ? "노쇼 사유를 2자 이상 작성해 주세요." : "코치 코멘트를 5자 이상 작성해 주세요."
      : "다음 커리큘럼을 선택해 주세요.";
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !operationsAccessReady()) {
    message.textContent = "대표 관리자 계정 로그인 상태를 확인해 주세요.";
    return;
  }
  lessonRecordEditorState.saving = true;
  const button = $("#saveLessonRecordButton");
  button.disabled = true;
  button.textContent = "서버 저장 중";
  message.textContent = "";
  try {
    const curriculumRefId = noShow ? null : await ensureAdminCurriculumRef(curriculumId);
    const result = await client.rpc("tn_process_lesson_outcome", {
      target_lesson_id: lessonRecordEditorState.lessonId,
      target_outcome: noShow ? "no_show" : "completed",
      target_deduct: deduct,
      target_note: comment,
      target_next_curriculum_ref_id: curriculumRefId,
      target_member_journal_id: lessonRecordEditorState.journalId || null,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonRecordModal");
    closeLessonRecordModal();
    state.recordFilter = "done";
    await syncAdminLiveData();
    setView("notes", { skipLock: true });
    showToast(result?.idempotent ? "이미 처리된 수업을 확인했습니다." : `${noShow ? "노쇼" : "수업 완료"} 처리와 ${deduct ? "횟수 차감" : "미차감 기록"}이 저장됐습니다.`);
  } catch (error) {
    message.textContent = lessonRecordErrorMessage(error);
  } finally {
    lessonRecordEditorState.saving = false;
    button.disabled = false;
    syncLessonRecordOutcomeUi();
  }
}

async function openJournalMedia(journalId) {
  const files = (adminLiveDataState.mediaFiles || []).filter((media) => media.journal_entry_id === journalId);
  if (!files.length) {
    showToast("첨부된 사진이나 영상이 없습니다.");
    return;
  }
  const preview = window.open("", "_blank");
  try {
    const blob = await window.TennisNoteDataClient.downloadObject("tennisnote-journal-media", files[0].storage_path);
    const url = URL.createObjectURL(blob);
    if (preview) preview.location.href = url;
    else window.open(url, "_blank");
    if (files.length > 1) showToast(`첫 첨부를 열었습니다. 전체 ${files.length}개입니다.`);
  } catch {
    preview?.close();
    showToast("첨부파일을 불러오지 못했습니다.");
  }
}

function handleModeAction(action) {
  const routeByAction = [
    { keyword: "회원", view: "members" },
    { keyword: "결제", view: "billing" },
    { keyword: "시간", view: "schedule" },
    { keyword: "리포트", view: "dashboard" },
    { keyword: "수업", view: "schedule" },
    { keyword: "출석", view: "notes" },
    { keyword: "메모", view: "notes" },
    { keyword: "보강", view: "schedule" },
    { keyword: "예약", view: "schedule" },
    { keyword: "잔수", view: "members" },
    { keyword: "알림", view: "dashboard" },
  ];
  const route = routeByAction.find((item) => action.includes(item.keyword));
  if (route) setView(route.view);
  billingLogs.unshift(`${action} 버튼 실행`);
  renderAll();
  showToast(`${action} 실행`);
}

function saveRackettimeList() {
  billingLogs.unshift("운영 목록 저장 완료");
  renderAll();
  showToast("운영 목록 저장 완료");
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

function ensureXlsxLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibraryPromise) return xlsxLibraryPromise;

  const sources = [
    "../shared/vendor/xlsx.full.min.js?v=0.18.5",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  ];
  xlsxLibraryPromise = new Promise((resolve, reject) => {
    const loadSource = (index) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      if (index >= sources.length) {
        reject(new Error("xlsx_module_load_failed"));
        return;
      }
      const script = document.createElement("script");
      script.src = sources[index];
      script.async = true;
      script.dataset.tennisnoteOptionalModule = "xlsx";
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else {
          script.remove();
          loadSource(index + 1);
        }
      };
      script.onerror = () => {
        script.remove();
        loadSource(index + 1);
      };
      document.head.append(script);
    };
    loadSource(0);
  }).catch((error) => {
    xlsxLibraryPromise = null;
    throw error;
  });
  return xlsxLibraryPromise;
}

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

function importGuideRows() {
  return [
    ["항목", "내용"],
    ["양식 버전", importWorkbookVersion],
    ["이관월", defaultMonthlyImportMonth()],
    ["지점명", activeOperationBranchName()],
    ["명단적용", "이 명단 기준 전환"],
    ["입력", "회원DB의 앞쪽 입력 열만 한 줄씩 작성합니다."],
    ["자동 처리", "오른쪽 자동 열은 비워도 연락처·회원권·횟수로 자동 계산합니다."],
    ["시간표", "이 양식은 회원 명단만 등록합니다. 시간표는 관리자 화면에서 직접 설정합니다."],
  ];
}

function importCodeRows(allCoaches = coaches) {
  const coachRows = operationBranchCoaches(allCoaches)
    .filter((coach) => (
      coach.id !== "coach-machine"
      && coach.status === "active"
      && coach.coachMode === "approved"
      && coach.serverRoleId
    ))
    .map((coach) => ["담당코치", scheduleCoachDisplayName(coach.name), "", ""]);
  const productRows = membershipProductsForActiveOperationProfile()
    .filter((product) => product.status === "sale" && product.serverProductId)
    .map((product) => ["회원권명", product.title, "판매중", product.serverProductId]);
  return [
    ["구분", "사용값", "상태", "코드"],
    ["회원상태", "수강중", "", "active"],
    ["회원상태", "휴회", "", "paused"],
    ["회원상태", "만료회원", "", "historical"],
    ["회원상태", "가입대기", "", "pending"],
    ["적용방식", "현재 회원권 갱신", "", "update_current"],
    ["적용방식", "새 회원권", "", "new_ticket"],
    ["적용방식", "회원정보만", "", "member_only"],
    ["레슨방식", "평일", "", "weekday"],
    ["레슨방식", "주말", "", "weekend"],
    ["레슨종류", "1:1", "", "one_on_one"],
    ["레슨종류", "1:2", "", "one_on_two"],
    ["결제수단", "카드", "", "card"],
    ["결제수단", "현금", "", "cash"],
    ["결제수단", "계좌이체", "", "bank_transfer"],
    ["결제상태", "결제완료", "", "paid"],
    ["결제상태", "결제대기", "", "pending"],
    ["결제상태", "해당없음", "", "not_applicable"],
    ...coachRows,
    ...productRows,
  ];
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

function setDataImportState(nextState) {
  Object.assign(dataImportState, nextState);
  renderDataTools();
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

async function handleDataImportFile(file) {
  if (!file) return;
  setDataImportState({
    fileName: file.name,
    fileType: file.name.split(".").pop()?.toLowerCase() || "",
    status: "checking",
    message: "파일을 읽고 검증하는 중입니다.",
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
  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let rows = [];
    let workbookPayload = null;
    if (extension === "xlsx" || extension === "xls") {
      const workbook = completeMonthlyImportWorkbook(await readWorkbookFile(file));
      if (supportedImportWorkbookVersions.has(workbook.schemaVersion)) {
        const result = validateMonthlyImportWorkbook(workbook, file.name);
        setDataImportState({
          ...result,
          fileName: file.name,
          fileType: extension,
          rawRows: [],
          serverStatus: "idle",
          serverMessage: "서버 검증 대기 중입니다.",
          serverPreview: null,
          status: result.errorRows ? "error" : result.reviewRows ? "review" : "ready",
          message: result.errorRows
            ? "오류 행을 수정해야 실제 DB 반영이 가능합니다."
            : result.reviewRows
              ? "검토대기·결제검토 행을 모두 정리한 뒤 다시 업로드하세요."
              : result.scheduleRowCount
                ? "회원DB와 시간표 검증 통과. 서버 미리보기를 실행하세요."
                : "회원DB 검증 통과. 기존 서버 시간표는 그대로 보존됩니다.",
        });
        return;
      }
      rows = workbook.legacyRows || [];
    } else {
      const text = await readTextFile(file);
      rows = parseDelimitedRows(text, extension === "tsv" ? "\t" : ",");
    }
    const result = validateImportRows(rows, file.name);
    setDataImportState({
      ...result,
      fileName: file.name,
      fileType: extension,
      rawRows: rows,
      schemaVersion: "1.0",
      workbookPayload,
      memberRowCount: result.rowCount,
      scheduleRowCount: 0,
      serverStatus: "idle",
      serverMessage: "서버 검증 대기 중입니다.",
      serverPreview: null,
      status: result.errorRows ? "error" : result.reviewRows ? "review" : "ready",
      message: result.errorRows
        ? "오류 행을 수정해야 실제 DB 반영이 가능합니다."
        : result.reviewRows
          ? "확인 필요 행을 검토한 뒤 반영할 수 있습니다."
          : "검증 통과. 서버 연결 후 실제 DB 반영 대상으로 넘길 수 있습니다.",
    });
  } catch (error) {
    setDataImportState({
      fileName: file.name,
      fileType: file.name.split(".").pop()?.toLowerCase() || "",
      status: "error",
      message: error.message || "파일을 읽지 못했습니다.",
      columns: [],
      rowCount: 0,
      readyRows: 0,
      reviewRows: 0,
      errorRows: 1,
      issues: [{ rowNumber: "-", level: "error", message: error.message || "파일 읽기 실패" }],
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

function importServerIssueMessage(issue = {}) {
  const rowLabel = issue.rowNumber && issue.rowNumber !== "-" ? `${issue.rowNumber}행` : "파일";
  const fieldLabel = issue.field ? ` ${importServerFieldLabels[issue.field] || issue.field}` : "";
  return `${rowLabel}${fieldLabel}: ${importServerIssueLabels[issue.code] || issue.code || "확인 필요"}`;
}

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

function applyServerCoachSnapshot({
  serverUsers = [],
  serverCoachRoles = [],
  serverCoachAvailability = [],
  serverAuthLinks = [],
  serverAuthSwitches = [],
  serverSettlementTerms = [],
} = {}) {
  const usersById = new Map(serverUsers.map((user) => [user.id, user]));
  const authLinksByUserId = new Map();
  serverAuthLinks.forEach((link) => {
    const links = authLinksByUserId.get(link.user_id) || [];
    links.push(link);
    authLinksByUserId.set(link.user_id, links);
  });
  const availabilityByRoleId = new Map();
  serverCoachAvailability.forEach((availability) => {
    const rows = availabilityByRoleId.get(availability.coach_role_id) || [];
    rows.push(availability);
    availabilityByRoleId.set(availability.coach_role_id, rows);
  });
  const pendingAuthSwitchByUserId = new Map(
    serverAuthSwitches
      .filter((item) => item.status === "pending")
      .map((item) => [item.user_id, item]),
  );
  const settlementTermByCoachRoleId = new Map();
  serverSettlementTerms.forEach((term) => {
    if (!settlementTermByCoachRoleId.has(term.coach_role_id)) {
      settlementTermByCoachRoleId.set(term.coach_role_id, term);
    }
  });
  const coachIdByRole = new Map();
  const orderedCoachRoles = [...serverCoachRoles].sort((left, right) => {
    const score = (role) => {
      const user = usersById.get(role.user_id) || {};
      const links = authLinksByUserId.get(role.user_id) || [];
      return Number(role.employment_status === "active") * 4
        + Number(role.status === "approved") * 2
        + Number(Boolean(user.auth_user_id || links.length));
    };
    return score(left) - score(right);
  });
  orderedCoachRoles.forEach((role, index) => {
    const coach = mergeServerCoachRole(role, index);
    const coachUser = usersById.get(role.user_id) || {};
    const authLinks = authLinksByUserId.get(role.user_id) || [];
    coach.accountLinked = Boolean(coachUser.auth_user_id || authLinks.length);
    coach.account = coach.accountLinked ? (coachUser.name || role.display_name || "가입 완료") : "회원가입 전";
    coach.phone = coachUser.phone || "";
    const coachPhone = normalizedMemberPhone(coach.phone);
    const coachName = normalizedCoachLinkName(coachUser.name || role.display_name);
    const loginCandidates = !coach.accountLinked && coachPhone && coachName
      ? serverUsers.filter((candidate) => {
        if (candidate.id === role.user_id || candidate.status !== "active" || candidate.merged_into_user_id) return false;
        const candidateLinks = authLinksByUserId.get(candidate.id) || [];
        return candidate.role === "member"
          && Boolean(candidate.auth_user_id || candidateLinks.length)
          && normalizedMemberPhone(candidate.phone) === coachPhone
          && normalizedCoachLinkName(candidate.name) === coachName;
      })
      : [];
    coach.loginCandidateUserId = loginCandidates.length === 1 ? loginCandidates[0].id : "";
    coach.loginCandidateCount = loginCandidates.length;
    coach.photoUrl = coachUser.profile_photo_url || coach.photoUrl || "";
    coach.serverUserId = role.user_id;
    coach.role = role.job_title || coach.role || "레슨";
    coach.bio = role.bio || "";
    coach.employmentStatus = role.employment_status || (role.status === "disabled" ? "ended" : "active");
    coach.employmentStartedOn = role.employment_started_on || "";
    coach.employmentEndedOn = role.employment_ended_on || "";
    coach.archivedAt = role.archived_at || "";
    coach.deletedAt = role.deleted_at || "";
    coach.authProviders = authProvidersFromLinks(authLinks);
    coach.authSwitch = pendingAuthSwitchByUserId.get(role.user_id) || null;
    coach.lastSignInAt = authLinks.map((link) => link.last_sign_in_at).filter(Boolean).sort().at(-1) || "";
    coach.approvalStatus = role.status || "pending";
    const availabilityRows = availabilityByRoleId.get(role.id) || [];
    coach.workBlocks = coachBlocksFromAvailability(availabilityRows, "available");
    coach.breakBlocks = coachBlocksFromAvailability(availabilityRows, "blocked");
    coachIdByRole.set(role.id, coach.id);
  });
  const liveCoachIds = new Set(coachIdByRole.values());
  replaceArray(coaches, coaches.filter((coach) => liveCoachIds.has(coach.id)));
  const savedSettlementRules = [...coachSettlementRules];
  replaceArray(coachSettlementRules, coaches.map((coach) => {
    const term = settlementTermByCoachRoleId.get(coach.serverRoleId);
    const savedRule = savedSettlementRules.find((rule) => rule.coach === coach.name);
    const baseRule = defaultCoachSettlementRule(coach, savedRule);
    const roleRate = Number(coach.settlementRate) > 1 ? Number(coach.settlementRate) / 100 : Number(coach.settlementRate);
    return {
      ...baseRule,
      method: term?.settlement_type || coach.settlementType || baseRule.method,
      ratio: term?.settlement_type === "ratio" ? Number(term.coach_rate) : (coach.settlementType === "ratio" ? roleRate : 0),
      hourly: term?.settlement_type === "hourly" ? Number(term.hourly_rate) : (coach.settlementType === "hourly" ? Number(coach.hourlyRate) : 0),
      cardBase: term?.settlement_basis === "actual_paid_inc_vat" ? "paid" : "cash",
      substitute: term?.substitute_policy || baseRule.substitute,
      effectiveFrom: term?.effective_from || baseRule.effectiveFrom,
      serverRoleId: coach.serverRoleId,
    };
  }));
  return { coachIdByRole, pendingAuthSwitchByUserId };
}

async function refreshCoachStaffData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !operationsAccessReady()) return false;
  const serverCoachRoles = await client.selectRows("tn_coach_roles", {
    select: "id,user_id,branch_id,display_name,bio,color,status,job_title,employment_status,employment_started_on,employment_ended_on,archived_at,deleted_at,settlement_type,settlement_rate,hourly_rate,settlement_basis,settlement_effective_from,availability_revision,schedule_lane_order",
    limit: 100,
  }).catch(() => client.selectRows("tn_coach_roles", {
    select: "id,user_id,branch_id,display_name,bio,color,status,settlement_type,settlement_rate,hourly_rate",
    limit: 100,
  }));
  const roleIds = serverCoachRoles.map((role) => role.id).filter(Boolean);
  const userIds = serverCoachRoles.map((role) => role.user_id).filter(Boolean);
  const [serverCoachAvailability, coachUsers, serverSettlementTerms] = await Promise.all([
    roleIds.length ? client.selectRows("tn_coach_availability", {
      select: "id,coach_role_id,day_of_week,start_time,end_time,availability_type,note",
      filters: { coach_role_id: { in: roleIds } },
      limit: 1000,
    }).catch(() => []) : [],
    userIds.length ? client.selectRows("tn_user_directory_safe", {
      select: "id,name,phone,profile_photo_url,role,status,auth_user_id,merged_into_user_id",
      filters: { id: { in: userIds } },
      limit: 200,
    }).catch(() => []) : [],
    roleIds.length ? client.selectRows("tn_coach_settlement_terms", {
      select: "id,coach_role_id,settlement_type,coach_rate,hourly_rate,settlement_basis,substitute_policy,effective_from,effective_to,status",
      filters: { coach_role_id: { in: roleIds } },
      order: "effective_from.desc",
      limit: 500,
    }).catch(() => []) : [],
  ]);
  const candidatePhones = [...new Set(coachUsers.map((user) => normalizedMemberPhone(user.phone)).filter(Boolean))];
  const candidateUsers = candidatePhones.length ? await client.selectRows("tn_user_directory_safe", {
    select: "id,name,phone,profile_photo_url,role,status,auth_user_id,merged_into_user_id",
    filters: { phone: { in: candidatePhones } },
    limit: 500,
  }).catch(() => []) : [];
  const serverUsers = [...new Map([...coachUsers, ...candidateUsers].map((user) => [user.id, user])).values()];
  const relatedUserIds = serverUsers.map((user) => user.id).filter(Boolean);
  const [serverAuthLinks, serverAuthSwitches] = await Promise.all([
    relatedUserIds.length ? client.selectRows("tn_user_auth_links", {
      select: "id,user_id,provider,last_sign_in_at,is_primary",
      filters: { user_id: { in: relatedUserIds } },
      limit: 500,
    }).catch(() => []) : [],
    userIds.length ? client.selectRows("tn_auth_provider_switches", {
      select: "id,user_id,from_provider,to_provider,status,expires_at,created_at,completed_at",
      filters: { user_id: { in: userIds } },
      order: "created_at.desc",
      limit: 500,
    }).catch(() => []) : [],
  ]);
  applyServerCoachSnapshot({
    serverUsers,
    serverCoachRoles,
    serverCoachAvailability,
    serverAuthLinks,
    serverAuthSwitches,
    serverSettlementTerms,
  });
  scheduleAdminOperationalCacheWrite();
  return true;
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

async function ensureActiveAdminWeekLoaded() {
  if (!state.liveScheduleLoaded || state.liveScheduleLoading || activeAdminWeekIsLoaded()) return false;
  Object.assign(state, {
    liveScheduleLoading: true,
    liveScheduleMessage: "선택한 주의 시간표를 불러오는 중",
  });
  renderSchedule();
  return refreshAdminLiveSchedule({ force: true });
}

async function performAdminLiveDataSync(options = {}) {
  if (adminLocalPreviewMode) return false;
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !operationsAccessReady()) return false;
  const fullAdminAccess = operationsRole() === "admin";
  const wasLoaded = state.liveScheduleLoaded;
  Object.assign(state, {
    liveScheduleLoading: true,
    liveScheduleMessage: "실서버 회원·코치·시간표를 불러오는 중",
  });
  try {
    const lessonWindow = adminLiveLessonWindow();
    const rosterParameters = {
        target_branch_id: activeOperationBranchId() || null,
        target_lesson_from: lessonWindow.from,
        target_lesson_to: lessonWindow.to,
      };
    const operationalRosterPromise = fullAdminAccess
      ? client.rpc("tn_admin_operational_roster_core", rosterParameters)
        .catch((coreError) => {
          if (!isMissingRpcError(coreError, "tn_admin_operational_roster_core")) {
            console.warn("[Tennis Note] core operational roster unavailable; using full-source fallback", coreError);
            return null;
          }
          console.warn("[Tennis Note] core operational roster missing; using compatible roster", coreError);
          return client.rpc("tn_admin_operational_roster", rosterParameters);
        })
        .then((response) => (Array.isArray(response) ? response[0] : response) || null)
        .catch((error) => {
          console.warn("[Tennis Note] operational roster unavailable; using full-source fallback", error);
          return null;
        })
      : Promise.resolve(null);
    const rosterRows = (key, fallback) => operationalRosterPromise
      .then((payload) => Array.isArray(payload?.[key]) ? payload[key] : fallback());
    const adminSettingsPromise = loadAdminStartupSettingsFromServer();
    const [serverBranches, serverUsers, serverCoachRoles, serverCoachAvailability, serverAuthLinks, serverAuthSwitches, serverSettlementTerms, serverProducts, serverTickets, ticketParticipants, lessonParticipants, serverLessons, serverRegularScheduleRules, serverOneDayBookings, serverEnrollments, serverChangeRequests, serverMakeupEntitlements, serverLessonRecords, serverCurriculumRefs, serverJournalEntries, serverMediaFiles, serverPayments, serverGroupAccounts, serverGroupMembers, serverGroupTicketLinks, serverMemberDatabaseRecords, serverMemberMembershipRecords, serverSubstituteAssignments] = await Promise.all([
      client.selectRows("tn_branches", { select: "id,name,status,open_start,open_end", order: "created_at.asc", limit: 100 }).catch(() => []),
      rosterRows("users", () => (client.selectAllRows || client.selectRows)("tn_user_directory_safe", { select: "id,name,nickname,phone,birth_year,neighborhood,gender,profile_photo_url,dominant_hand,backhand_style,tennis_started_on,self_ntrp,coach_ntrp,tennis_goal,play_style_memo,role,member_kind,status,auth_user_id,merged_into_user_id,merged_at,permanently_deleted_at", order: "created_at.asc", limit: 500, pageSize: 500, maxRows: 10000 })),
      client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,job_title,employment_status,employment_started_on,employment_ended_on,archived_at,deleted_at,settlement_type,settlement_rate,hourly_rate,settlement_basis,settlement_effective_from,availability_revision,schedule_lane_order", limit: 100 })
        .catch(() => client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,settlement_type,settlement_rate,hourly_rate", limit: 100 })),
      client.selectRows("tn_coach_availability", { select: "id,coach_role_id,day_of_week,start_time,end_time,availability_type,note", limit: 1000 }).catch(() => []),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.authLinks || []) : Promise.resolve([]),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.authSwitches || []) : Promise.resolve([]),
      fullAdminAccess ? Promise.resolve(adminLiveDataState.coachSettlementTerms || []) : Promise.resolve([]),
      client.selectRows("tn_membership_products", { select: "id,branch_id,product_code,name,lesson_minutes,frequency_per_week,total_sessions,group_size,group_deduction_policy,product_kind,is_coupon,is_active,schedule_scope,term_weeks,validity_days,grace_days,card_price,cash_price,settlement_base_price,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,policy_settings,display_order", limit: 300 })
        .catch(() => client.selectRows("tn_membership_products", { select: "id,branch_id,product_code,name,lesson_minutes,frequency_per_week,total_sessions,group_size,product_kind,is_coupon,is_active,schedule_scope,term_weeks,validity_days,grace_days,card_price,cash_price,settlement_base_price,discount_enabled,coach_discount_allowed,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,policy_settings,display_order", limit: 300 })),
      rosterRows("tickets", () => (client.selectAllRows || client.selectRows)("tn_member_tickets", {
        select: "id,user_id,product_id,branch_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,purchased_price,updated_at",
        order: "id.asc",
        limit: 500,
        pageSize: 500,
        maxRows: 20000,
      })),
      rosterRows("ticketParticipants", () => (client.selectAllRows || client.selectRows)("tn_ticket_participants", {
        select: "ticket_id,user_id,participant_order",
        order: "ticket_id.asc,user_id.asc",
        limit: 500,
        pageSize: 500,
        maxRows: 20000,
      })),
      rosterRows("lessonParticipants", () => client.selectRows("tn_lesson_participants", { select: "lesson_id,user_id,ticket_id", limit: 1000 })),
      client.selectRows("tn_lessons", {
        select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,group_account_id,lesson_date,start_time,duration_minutes,status,lesson_source,schedule_v2_kind,revision,updated_at",
        filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "lesson_date.asc,start_time.asc",
        limit: 2000,
      })
        .catch(() => client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,group_account_id,lesson_date,start_time,duration_minutes,status,lesson_source,updated_at",
          filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
          order: "lesson_date.asc,start_time.asc",
          limit: 2000,
        })
          .catch(() => client.selectRows("tn_lessons", {
            select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source,updated_at",
            filters: { lesson_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
            order: "lesson_date.asc,start_time.asc",
            limit: 2000,
          }))),
      fullAdminAccess ? client.selectRows("tn_regular_schedule_rules", {
        select: "id,ticket_id,coach_role_id,day_of_week,start_time,duration_minutes,effective_start_on,effective_end_on,status,updated_at",
        filters: { status: "active" },
        order: "ticket_id.asc,day_of_week.asc,start_time.asc",
        limit: 1000,
      }).catch(() => []) : Promise.resolve([]),
      fullAdminAccess ? client.selectRows("tn_one_day_bookings", {
        select: "id,branch_id,coach_role_id,booking_date,start_time,duration_minutes,guest_name,guest_phone,note,status,linked_user_id,booking_source,payment_status,payment_method,payment_amount,created_at",
        filters: { booking_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "booking_date.asc,start_time.asc",
        limit: 1000,
      }).catch(() => client.selectRows("tn_one_day_bookings", {
        select: "id,branch_id,coach_role_id,booking_date,start_time,duration_minutes,guest_name,guest_phone,note,status,linked_user_id,created_at",
        filters: { booking_date: { gte: lessonWindow.from, lte: lessonWindow.to } },
        order: "booking_date.asc,start_time.asc",
        limit: 1000,
      }).catch(() => [])) : Promise.resolve([]),
      fullAdminAccess ? rosterRows("enrollments", () => client.selectRows("tn_member_enrollments", { select: "id,user_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,submitted_at,approved_at", limit: 500 }).catch(() => [])) : Promise.resolve([]),
      rosterRows("changeRequests", () => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_by,decided_at,created_at,updated_at",
        limit: 500,
      }).catch(() => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_by,decided_at,created_at",
        limit: 500,
      }).catch(() => []))),
      rosterRows("makeupEntitlements", () => client.selectRows("tn_makeup_entitlements", { select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at", limit: 500 }).catch(() => [])),
      rosterRows("lessonRecords", () => (client.selectAllRows || client.selectRows).call(client, "tn_lesson_records", {
        select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_ticket_id,deducted_sessions,completed_at,tn_lessons(member_ticket_id,duration_minutes)",
        order: "id.asc",
        limit: 500,
        pageSize: 500,
        maxRows: 20000,
      }).catch(() => client.selectRows("tn_lesson_records", {
        select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
        limit: 500,
      }).catch(() => []))),
      Promise.resolve(adminLiveDataState.curriculumRefs || []),
      Promise.resolve(adminLiveDataState.journalEntries || []),
      Promise.resolve(adminLiveDataState.mediaFiles || []),
      fullAdminAccess ? rosterRows("operationalPayments", () => client.selectRows("tn_payments", { select: "id,user_id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at", order: "created_at.desc", limit: 500 }).catch(() => [])) : Promise.resolve([]),
      rosterRows("groupAccounts", () => client.selectRows("tn_group_accounts", { select: "id,branch_id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required", limit: 200 }).catch(() => [])),
      rosterRows("groupMembers", () => client.selectRows("tn_group_account_members", { select: "group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay", limit: 500 }).catch(() => [])),
      rosterRows("groupTicketLinks", () => client.selectRows("tn_group_ticket_links", { select: "group_account_id,user_id,ticket_id,status", limit: 500 }).catch(() => [])),
      fullAdminAccess ? rosterRows("memberDatabaseRecords", () => Promise.resolve(adminLiveDataState.memberDatabaseRecords || [])) : Promise.resolve([]),
      fullAdminAccess ? rosterRows("memberMembershipRecords", () => Promise.resolve(adminLiveDataState.memberMembershipRecords || [])) : Promise.resolve([]),
      rosterRows("substituteAssignments", () => client.selectRows("tn_lesson_substitute_assignments", {
        select: "id,lesson_id,branch_id,original_coach_role_id,substitute_coach_role_id,settlement_mode,hourly_amount,status,reason,assigned_at,ended_at",
        order: "assigned_at.desc",
        limit: 1000,
      }).catch(() => [])),
    ]);

    if (options.abortIfDirty && adminHasUnsavedChanges()) {
      Object.assign(state, {
        liveScheduleLoading: false,
        liveScheduleMessage: "작성 중인 변경사항을 보호하기 위해 서버 새로고침을 미뤘습니다.",
      });
      return false;
    }

    const usersById = new Map((serverUsers || []).map((user) => [user.id, user]));
    const authLinksByUserId = new Map();
    (serverAuthLinks || []).forEach((link) => {
      const links = authLinksByUserId.get(link.user_id) || [];
      links.push(link);
      authLinksByUserId.set(link.user_id, links);
    });
    const productsById = new Map((serverProducts || []).map((product) => [product.id, product]));
    const ticketParticipantIdsByTicketId = new Map();
    (ticketParticipants || []).forEach((participant) => {
      const ids = ticketParticipantIdsByTicketId.get(participant.ticket_id) || [];
      ids.push(participant.user_id);
      ticketParticipantIdsByTicketId.set(participant.ticket_id, ids);
    });
    const firstLessonByTicketId = new Map();
    (serverLessons || []).forEach((lesson) => {
      if (
        lesson.member_ticket_id
        && lesson.status !== "cancelled"
        && lesson.lesson_date
        && !firstLessonByTicketId.has(lesson.member_ticket_id)
      ) {
        firstLessonByTicketId.set(lesson.member_ticket_id, lesson);
      }
    });
    const memberRecordByUserId = new Map((serverMemberDatabaseRecords || []).map((record) => [record.user_id, record]));
    const memberRecordByTicketId = new Map((serverMemberDatabaseRecords || [])
      .filter((record) => record.current_ticket_id)
      .map((record) => [record.current_ticket_id, record]));
    const membershipRecordByTicketId = new Map((serverMemberMembershipRecords || [])
      .filter((record) => record.ticket_id)
      .map((record) => [record.ticket_id, record]));
    const { coachIdByRole, pendingAuthSwitchByUserId } = applyServerCoachSnapshot({
      serverUsers: serverUsers || [],
      serverCoachRoles: serverCoachRoles || [],
      serverCoachAvailability: serverCoachAvailability || [],
      serverAuthLinks: serverAuthLinks || [],
      serverAuthSwitches: serverAuthSwitches || [],
      serverSettlementTerms: serverSettlementTerms || [],
    });

    const mappedTickets = (serverTickets || []).map((ticket) => {
      const product = productsById.get(ticket.product_id) || {};
      const memberRecord = membershipRecordByTicketId.get(ticket.id)
        || memberRecordByTicketId.get(ticket.id)
        || null;
      const productGroupSize = Number(product.group_size) || 1;
      const rawParticipantUserIds = liveTicketParticipantIds(ticket, ticketParticipantIdsByTicketId);
      const participantUserIds = product.id && productGroupSize === 1
        ? [ticket.user_id].filter(Boolean)
        : rawParticipantUserIds;
      const memberNames = participantUserIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      return {
        id: ticket.id,
        serverTicketId: ticket.id,
        serverUserId: ticket.user_id,
        productId: ticket.product_id,
        participantUserIds,
        branchId: ticket.branch_id,
        coachRoleId: ticket.coach_role_id,
        member: memberNames.join("&") || usersById.get(ticket.user_id)?.name || "회원 확인 필요",
        coachId: coachIdByRole.get(ticket.coach_role_id) || "",
        product: product.name || `${product.lesson_minutes || 20}분 회원권`,
        weeklyCount: Number(memberRecord?.lesson_frequency_per_week || product.frequency_per_week) || 1,
        total: Number(ticket.total_sessions) || 0,
        used: Number(ticket.used_sessions) || 0,
        remaining: Number(ticket.remaining_sessions) || 0,
        purchased: ticket.starts_on,
        expires: ticket.expires_on,
        amount: Number(ticket.purchased_price) || 0,
        lessonKind: product.id
          ? (productGroupSize === 2 ? "2대1" : liveTicketLessonKind(product))
          : memberRecord?.lesson_type === "one_on_two" ? "2대1" : "개인",
        lessonTypeCode: product.id
          ? (productGroupSize === 2 ? "one_on_two" : "one_on_one")
          : memberRecord?.lesson_type || "one_on_one",
        lessonDays: Array.isArray(memberRecord?.lesson_days) ? memberRecord.lesson_days.map(Number) : [],
        actualLessonStart: memberRecord?.lesson_start_on || ticket.starts_on,
        groupSize: productGroupSize,
        durationMinutes: Number(product.lesson_minutes) || 20,
        maxSessionsPerDay: Number(product.max_sessions_per_day) || 0,
        maxSessionsPerWeek: Number(product.max_sessions_per_week) || 0,
        maxBookingDaysPerWeek: Number(product.max_booking_days_per_week) || 0,
        productKind: product.product_kind || "regular",
        scheduleScope: memberRecord?.lesson_schedule_scope || liveTicketScheduleScope(product, ticket, firstLessonByTicketId),
        status: ticket.status,
        serverUpdatedAt: ticket.updated_at || "",
        memberRecord,
      };
    });

    const activeTickets = mappedTickets.filter((ticket) => isCurrentMemberTicket(ticket));
    const activeTicketIds = new Set(activeTickets.map((ticket) => ticket.serverTicketId));
    replaceArray(tickets, activeTickets);
    replaceArray(expiredTickets, mappedTickets
      .filter((ticket) => !activeTicketIds.has(ticket.serverTicketId))
      .map((ticket) => ({
        ...ticket,
        statusLabel: memberTicketStatusLabel(ticket),
      })));

    const ticketsByParticipantUserId = new Map();
    mappedTickets.forEach((ticket) => {
      ticket.participantUserIds.forEach((userId) => {
        const rows = ticketsByParticipantUserId.get(userId) || [];
        rows.push(ticket);
        ticketsByParticipantUserId.set(userId, rows);
      });
    });
    const paymentsByUserId = new Map();
    (serverPayments || []).forEach((payment) => {
      const rows = paymentsByUserId.get(payment.user_id) || [];
      rows.push(payment);
      paymentsByUserId.set(payment.user_id, rows);
    });
    const enrollmentByUserId = new Map();
    (serverEnrollments || [])
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))
      .forEach((enrollment) => {
        if (!enrollmentByUserId.has(enrollment.user_id)) enrollmentByUserId.set(enrollment.user_id, enrollment);
      });
    const memberUserGroups = (serverUsers || [])
      .filter((user) => !user.merged_into_user_id)
      .filter((user) => !user.permanently_deleted_at)
      .filter((user) => (
        user.role === "member"
        || (ticketsByParticipantUserId.get(user.id) || []).some((ticket) => isCurrentMemberTicket(ticket))
      ))
      .map((user) => ({
        name: user.name || "이름 확인 필요",
        userGroup: [user],
      }));
    const currentMembers = [...members];
    let nextMemberId = Math.max(1000, ...currentMembers.map((member) => Number(member.id) || 0)) + 1;
    const mappedMembers = memberUserGroups.map(({ name, userGroup }) => {
      const userIds = userGroup.map((user) => user.id);
      const memberTickets = [...new Map(
        userIds
          .flatMap((userId) => ticketsByParticipantUserId.get(userId) || [])
          .map((ticket) => [ticket.id, ticket]),
      ).values()];
      const activeTicket = memberTickets.find((ticket) => isCurrentMemberTicket(ticket)) || null;
      const pendingTicket = memberTickets.find((ticket) => ticket.status === "pending_payment") || null;
      const memberPayments = userIds.flatMap((userId) => paymentsByUserId.get(userId) || []);
      const unlinkedVerifiedPayments = memberPayments.filter((payment) => (
        payment.status === "verified" && !payment.ticket_id
      ));
      const actionableUnlinkedPayment = unlinkedVerifiedPayments
        .filter((payment) => payment.provider !== "google_sheet_history")
        .sort((left, right) => String(right.verified_at || right.paid_at || right.created_at || "")
          .localeCompare(String(left.verified_at || left.paid_at || left.created_at || "")))[0] || null;
      const displayTicket = activeTicket || pendingTicket || memberTickets
        .slice()
        .sort((left, right) => String(right.expires || "").localeCompare(String(left.expires || "")))[0] || null;
      const preferredUser = userGroup.find((user) => user.role === "admin") || userGroup[0];
      const memberRecord = memberRecordByUserId.get(preferredUser.id) || null;
      const enrollment = userIds.map((userId) => enrollmentByUserId.get(userId)).find(Boolean) || null;
      const enrollmentBranchId = productsById.get(enrollment?.requested_product_id)?.branch_id || "";
      const paymentBranchId = productsById.get(actionableUnlinkedPayment?.product_id)?.branch_id || "";
      const existing = currentMembers.find((member) => (
        member.serverUserId === preferredUser.id
        || (member.serverUserIds?.length === 1 && member.serverUserIds[0] === preferredUser.id)
      ));
      const currentMemberKind = String(preferredUser.member_kind || "journal_only");
      const authLinks = userIds.flatMap((userId) => authLinksByUserId.get(userId) || []);
      const authProviders = authProvidersFromLinks(authLinks);
      const authSwitch = userIds.map((userId) => pendingAuthSwitchByUserId.get(userId)).find(Boolean) || null;
      const authLinked = userGroup.some((user) => Boolean(user.auth_user_id)) || authLinks.length > 0;
      const serverStatus = String(preferredUser.status || "active");
      const status = ["inactive", "archived"].includes(serverStatus)
        ? "inactive"
        : activeTicket
          ? "active"
          : pendingTicket
            ? "pending"
          : actionableUnlinkedPayment
            ? "pending"
          : memberRecord?.record_status === "pending"
            ? "pending"
          : currentMemberKind === "lesson_pending" || ["submitted", "needs_update"].includes(String(enrollment?.status || ""))
            ? "pending"
            : currentMemberKind === "journal_only"
              ? "journal"
              : "expired";
	      return {
	        id: existing?.id || nextMemberId++,
	        name,
        nickname: preferredUser.nickname || "",
        status,
        memberKind: currentMemberKind,
        statusLabel: status === "inactive" ? "삭제회원" : status === "pending" ? "가입서·결제대기" : status === "journal" ? "운동노트 회원" : status === "active" ? "수강중" : "만료회원",
        serverStatus,
        coach: displayTicket
          ? getCoachName(displayTicket.coachId)
          : getCoachName(coachIdByRole.get(memberRecord?.coach_role_id) || "") || "미배정",
        regularTime: memberRecord?.lesson_days?.length ? memberRecord.lesson_days.map((day) => memberManagementDayLabel(Number(day))).join(" · ") : "시간표에서 확인",
        remaining: memberRecord?.remaining_sessions ?? activeTicket?.remaining ?? 0,
        lessonType: memberRecord ? memberManagementLessonTypeLabel(memberRecord.lesson_type) : displayTicket?.product || "회원권 없음",
        source: memberRecord?.source_name || (enrollment ? "앱 수강 가입서" : "Supabase 실데이터"),
        note: memberRecord?.admin_note || (actionableUnlinkedPayment
          ? "결제 완료 · 회원권 발급 필요"
          : status === "active"
            ? "실서버 회원권 연결"
            : status === "journal"
              ? "운동노트만 이용 중"
              : status === "pending"
                ? "가입서 제출 완료 · 결제 확인 필요"
                : "회원권 등록 또는 연장 확인 필요"),
        photoUrl: preferredUser.profile_photo_url || existing?.photoUrl || "",
        authRole: preferredUser.role || "member",
        authLinked,
        authProviders,
        authLinks,
        authSwitch,
        authLastSignInAt: authLinks.map((link) => link.last_sign_in_at).filter(Boolean).sort().at(-1) || "",
        serverUserId: preferredUser.id,
        serverUserIds: userIds,
        branchId: memberRecord?.branch_id || displayTicket?.branchId || enrollmentBranchId || paymentBranchId || "",
        branchIds: [...new Set([
          memberRecord?.branch_id,
          ...memberTickets.map((ticket) => ticket.branchId),
          enrollmentBranchId,
          paymentBranchId,
        ].filter(Boolean).map(String))],
        phone: preferredUser.phone || enrollment?.phone || "",
        birthYear: preferredUser.birth_year || enrollment?.birth_year || "",
        neighborhood: preferredUser.neighborhood || enrollment?.neighborhood || "",
        gender: preferredUser.gender || enrollment?.gender || "",
        dominantHand: preferredUser.dominant_hand || "",
        backhandStyle: preferredUser.backhand_style || "",
        tennisStartedOn: preferredUser.tennis_started_on || "",
        selfNtrp: preferredUser.self_ntrp ?? "",
        coachNtrp: preferredUser.coach_ntrp ?? "",
        tennisGoal: preferredUser.tennis_goal || "",
        playStyleMemo: preferredUser.play_style_memo || "",
        enrollment,
        memberRecord,
        unlinkedVerifiedPayment: actionableUnlinkedPayment,
      };
    });
    replaceArray(members, mappedMembers);

    const participantIdsByLesson = new Map();
    (lessonParticipants || []).forEach((participant) => {
      const ids = participantIdsByLesson.get(participant.lesson_id) || [];
      ids.push(participant.user_id);
      participantIdsByLesson.set(participant.lesson_id, ids);
    });
    const mappedTicketById = new Map(mappedTickets.map((ticket) => [ticket.id, ticket]));
    const lessonRecordByLessonId = new Map((serverLessonRecords || []).map((record) => [record.lesson_id, record]));
    const activeSubstituteByLessonId = new Map((serverSubstituteAssignments || [])
      .filter((assignment) => assignment.status === "assigned")
      .map((assignment) => [assignment.lesson_id, assignment]));
    const slotCounts = new Map();
    let mappedLessons = (serverLessons || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const participantIds = participantIdsByLesson.get(lesson.id) || [];
        const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
        const ticket = mappedTicketById.get(lesson.member_ticket_id);
        const lessonRecord = lessonRecordByLessonId.get(lesson.id);
        const slotKey = `${lesson.lesson_date}-${String(lesson.start_time || "").slice(0, 5)}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const sourceLabel = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "대타"
              : ticket?.lessonKind || "개인";
        return {
          id: lesson.id,
          serverLessonId: lesson.id,
          serverStatus: lesson.status,
          serverRevision: Number(lesson.revision) || null,
          serverUpdatedAt: lesson.updated_at || "",
          serverParticipantUserIds: participantIds,
          branchId: lesson.branch_id,
          ticketId: lesson.member_ticket_id,
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          substituteAssignment: activeSubstituteByLessonId.get(lesson.id) || null,
          day: scheduleDays[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          lessonDate: lesson.lesson_date,
          time: String(lesson.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(lesson.coach_role_id) || "",
          originalCoachId: coachIdByRole.get(lesson.original_coach_role_id) || "",
          member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
          type: sourceLabel,
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketRemaining: Number(ticket?.remaining) || 0,
          ticketProduct: ticket?.product || "회원권 확인 필요",
          status: liveLessonStatus(lesson.status),
          makeup: lesson.lesson_source === "makeup",
          lessonSource: lesson.schedule_v2_kind || lesson.lesson_source || "regular",
          scheduleV2Kind: lesson.schedule_v2_kind || "",
          deductedSessions: lessonRecord ? Number(lessonRecord.deducted_sessions) || 0 : null,
          completedAt: lessonRecord?.completed_at || "",
        };
      })
      .sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));

    const mappedOneDayBookings = (serverOneDayBookings || [])
      .filter((booking) => !["cancelled", "archived"].includes(booking.status))
      .map((booking) => {
        const slotKey = `${booking.booking_date}-${String(booking.start_time || "").slice(0, 5)}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const date = new Date(`${booking.booking_date}T00:00:00`);
        const dayIndex = date.getDay();
        return {
          id: `one-day-${booking.id}`,
          serverOneDayBookingId: booking.id,
          serverStatus: booking.status,
          oneDayBooking: true,
          branchId: booking.branch_id,
          ticketId: "",
          coachRoleId: booking.coach_role_id,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          lessonDate: booking.booking_date,
          time: String(booking.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(booking.coach_role_id) || "",
          member: booking.guest_name || "원데이 방문자",
          guestPhone: booking.guest_phone || "",
          linkedUserId: booking.linked_user_id || "",
          oneDayNote: booking.note || "",
          oneDayBookingSource: booking.booking_source || "walk_in",
          oneDayPaymentStatus: booking.payment_status || "unpaid",
          oneDayPaymentMethod: booking.payment_method || "",
          oneDayPaymentAmount: Math.max(0, Number(booking.payment_amount) || 0),
          type: "원데이",
          durationMinutes: Number(booking.duration_minutes) || 20,
          status: liveLessonStatus(booking.status),
          makeup: false,
          lessonSource: "one_day",
        };
      });
    mappedLessons.push(...mappedOneDayBookings);
    mappedLessons.sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));

    const serverLessonById = new Map((serverLessons || []).map((lesson) => [lesson.id, lesson]));
    const mappedMakeupEntitlements = (serverMakeupEntitlements || []).map((entitlement) => {
      const sourceLesson = serverLessonById.get(entitlement.source_lesson_id) || {};
      const bookedLesson = serverLessonById.get(entitlement.booked_lesson_id) || {};
      const participantIds = participantIdsByLesson.get(entitlement.source_lesson_id) || [];
      const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      const ticket = mappedTicketById.get(entitlement.ticket_id) || {};
      return {
        id: entitlement.id,
        sourceLessonId: entitlement.source_lesson_id,
        bookedLessonId: entitlement.booked_lesson_id || "",
        ticketId: entitlement.ticket_id,
        branchId: sourceLesson.branch_id || ticket.branchId || "",
        coachId: coachIdByRole.get(entitlement.coach_role_id) || "",
        memberNames,
        member: memberNames.join("&") || ticket.member || "회원 확인 필요",
        durationMinutes: Number(entitlement.duration_minutes) || ticket.durationMinutes || 20,
        status: entitlement.status,
        reason: entitlement.reason || "회원 사전 불참",
        originalDate: sourceLesson.lesson_date || "",
        originalTime: String(sourceLesson.start_time || "").slice(0, 5),
        originalLabel: `${sourceLesson.lesson_date || "기존일"} ${String(sourceLesson.start_time || "").slice(0, 5)}`.trim(),
        bookedDate: bookedLesson.lesson_date || "",
        bookedTime: String(bookedLesson.start_time || "").slice(0, 5),
      };
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const releasedRegularMakeupSlots = mappedMakeupEntitlements
      .flatMap((entitlement) => {
        const sourceLesson = serverLessonById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return [];
        if (!entitlement.originalDate || !entitlement.originalTime) return [];
        const releasedInterval = {
          start: timeToMinutes(entitlement.originalTime),
          end: timeToMinutes(entitlement.originalTime) + entitlement.durationMinutes,
        };
        const occupyingLesson = mappedLessons.find((lesson) => (
          lesson.lessonDate === entitlement.originalDate
          && lesson.coachId === entitlement.coachId
          && intervalsOverlap(releasedInterval, lessonInterval(lesson))
        ));
        if (occupyingLesson) {
          occupyingLesson.releasedOriginMember = entitlement.member;
          occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
          return [];
        }
        const slotKey = `${entitlement.originalDate}-${entitlement.originalTime}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        const historicalReleasedSlot = entitlement.originalDate < todayIso;
        return [{
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          historicalReleasedSlot,
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          serverStatus: "available",
          branchId: entitlement.branchId,
          ticketId: entitlement.ticketId,
          day: scheduleDays[new Date(`${entitlement.originalDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${entitlement.originalDate}T00:00:00`).getDay() - 1],
          lessonDate: entitlement.originalDate,
          time: entitlement.originalTime,
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: entitlement.coachId,
          member: entitlement.member,
          memberNames: entitlement.memberNames,
          releasedOriginalMember: entitlement.member,
          type: historicalReleasedSlot ? "정규 · 불참 · 차감 없음" : "정규 · 불참 · 보강·원데이 가능",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          makeup: true,
          lessonSource: "makeup",
        }];
      });
    mappedLessons.push(...releasedRegularMakeupSlots);
    mappedLessons.sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));
    replaceArray(state.makeupEntitlements, mappedMakeupEntitlements);

    const mappedEntitlementRequests = mappedMakeupEntitlements.map((item) => ({
      id: `entitlement-${item.id}`,
      entitlementId: item.id,
      sourceLessonId: item.sourceLessonId,
      branchId: item.branchId,
      makeupType: "entitlement",
      member: item.member,
      original: `${item.originalLabel} ${getCoachName(item.coachId)}`.trim(),
      requested: item.status === "booked" ? `${item.bookedDate} ${item.bookedTime}`.trim() : "회원 시간 선택 대기",
      policy: "직원 불참 처리",
      reason: item.reason,
      status: item.status === "open" ? "requested" : item.status === "booked" ? "approved" : "rejected",
      statusLabel: item.status === "open" ? "보강선택필요" : item.status === "booked" ? "보강예약완료" : "종료",
    }));

    const mappedChangeRequests = (serverChangeRequests || []).map((request) => {
      const lesson = serverLessonById.get(request.lesson_id) || {};
      const coachId = coachIdByRole.get(lesson.coach_role_id) || "";
      const statusLabel = request.status === "approved" || request.status === "auto_approved"
        ? "승인완료"
        : request.status === "rejected"
          ? "거절"
          : request.policy_window === "coach_approval_within_24h"
            ? "담당 코치·관리자 승인 필요"
            : "승인대기";
      return {
        id: request.id,
        serverRequestId: request.id,
        lessonId: request.lesson_id,
        branchId: lesson.branch_id || "",
        member: usersById.get(request.requester_user_id)?.name || "회원 확인 필요",
        original: `${request.original_lesson_date || lesson.lesson_date || "기존일"} ${String(request.original_start_time || lesson.start_time || "").slice(0, 5)} ${getCoachName(coachId)}`,
        requested: `${request.requested_lesson_date || "변경일"} ${String(request.requested_start_time || "").slice(0, 5)}`,
        policy: request.policy_window === "coach_approval_within_24h" ? "24시간 이내" : "24시간 전",
        reason: request.reason || "",
        status: request.status,
        statusLabel,
        createdAt: request.created_at || request.updated_at || "",
      };
    });
    replaceArray(makeupRequests, mappedEntitlementRequests.concat(mappedChangeRequests));

    const mappedLessonNotes = (serverLessonRecords || []).map((record) => {
      const lesson = serverLessonById.get(record.lesson_id) || {};
      const ticket = mappedTicketById.get(lesson.member_ticket_id);
      const participantIds = participantIdsByLesson.get(record.lesson_id) || ticket?.participantUserIds || [];
      const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
      return {
        id: record.id,
        serverRecordId: record.id,
        serverLessonId: record.lesson_id,
        coachRoleId: record.coach_role_id,
        member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
        lesson: `${lesson.lesson_date || "수업일"} ${String(lesson.start_time || "").slice(0, 5)} ${getCoachName(coachIdByRole.get(record.coach_role_id) || "")}`,
        reflection: record.coach_comment || "코치 코멘트 없음",
        next: record.next_curriculum_ref_id ? "다음 커리큘럼 등록됨" : "다음 커리큘럼 미등록",
        nextCurriculumRefId: record.next_curriculum_ref_id || "",
        completedAt: record.completed_at || "",
        status: "confirmed",
        statusLabel: "확인완료",
        deductedSessions: Number(record.deducted_sessions) || 0,
      };
    });
    replaceArray(lessonNotes, mappedLessonNotes);

    const mappedPayments = (serverPayments || []).map((payment) => billingRowFromServerPayment({
      ...payment,
      member: usersById.get(payment.user_id)?.name || "회원 확인 필요",
    }));
    replaceArray(billings, mappedPayments);
    replaceArray(billingLogs, [`서버 결제 ${mappedPayments.length}건 동기화`]);
    const groupMembersByAccount = new Map();
    (serverGroupMembers || []).forEach((member) => {
      const list = groupMembersByAccount.get(member.group_account_id) || [];
      list.push(member);
      groupMembersByAccount.set(member.group_account_id, list);
    });
    const groupTicketIdsByAccount = new Map();
    (serverGroupTicketLinks || []).forEach((link) => {
      const list = groupTicketIdsByAccount.get(link.group_account_id) || [];
      if (link.ticket_id && !list.includes(link.ticket_id)) list.push(link.ticket_id);
      groupTicketIdsByAccount.set(link.group_account_id, list);
    });
    replaceArray(groupAccounts, (serverGroupAccounts || []).map((account) => {
      const accountMembers = (groupMembersByAccount.get(account.id) || [])
        .sort((left, right) => Number(left.participant_order || 0) - Number(right.participant_order || 0));
      const linkedLesson = (serverLessons || []).find((lesson) => lesson.group_account_id === account.id)
        || (serverLessons || []).find((lesson) => (groupTicketIdsByAccount.get(account.id) || []).includes(lesson.member_ticket_id));
      return {
        id: account.id,
        serverAccount: true,
        name: account.display_name || accountMembers.map((member) => member.display_name || usersById.get(member.user_id)?.name).filter(Boolean).join(" · "),
        coachId: coachIdByRole.get(account.coach_role_id) || "",
        schedule: linkedLesson ? `${linkedLesson.lesson_date} ${String(linkedLesson.start_time || "").slice(0, 5)}` : "시간표 미등록",
        paymentMode: account.payment_mode || "representative",
        nextPayer: usersById.get(account.next_payer_user_id)?.name || accountMembers.find((member) => member.user_id === account.next_payer_user_id)?.display_name || "미지정",
        nextPayerUserId: account.next_payer_user_id || "",
        scheduleSyncRequired: account.schedule_sync_required !== false,
        ticketIds: groupTicketIdsByAccount.get(account.id) || [],
        members: accountMembers.map((member) => ({
          userId: member.user_id,
          name: member.display_name || usersById.get(member.user_id)?.name || "회원",
          appStatus: member.app_status || "not_joined",
          canManageSchedule: Boolean(member.can_manage_schedule),
          canPay: Boolean(member.can_pay),
        })),
      };
    }));
    Object.assign(serverPaymentSyncState, {
      loaded: true,
      directLoaded: false,
      loading: false,
      lastLoadedAt: Date.now(),
      message: `서버 결제 ${mappedPayments.length}건 확인`,
      tone: "good",
    });

    const keepLoadedSchedule = shouldProtectLoadedSchedule(serverLessons, mappedLessons);
    if (keepLoadedSchedule) {
      mappedLessons = lessons.map((lesson) => ({ ...lesson }));
      billingLogs.unshift("시간표 보호: 비어 있거나 불완전한 서버 응답으로 기존 시간표를 덮어쓰지 않았습니다.");
    }

    Object.assign(adminLiveDataState, {
      branches: serverBranches || [],
      lessons: mappedLessons,
      users: serverUsers || [],
      coachRoles: serverCoachRoles || [],
      authLinks: serverAuthLinks || [],
      authSwitches: serverAuthSwitches || [],
      coachSettlementTerms: serverSettlementTerms || [],
      tickets: mappedTickets,
      products: serverProducts || [],
      participantRows: lessonParticipants || [],
      changeRequests: serverChangeRequests || [],
      makeupEntitlements: mappedMakeupEntitlements,
      lessonRecords: serverLessonRecords || [],
      curriculumRefs: serverCurriculumRefs || [],
      journalEntries: serverJournalEntries || [],
      mediaFiles: serverMediaFiles || [],
      payments: serverPayments || [],
      groupAccounts: serverGroupAccounts || [],
      groupMembers: serverGroupMembers || [],
      groupTicketLinks: serverGroupTicketLinks || [],
      memberDatabaseRecords: serverMemberDatabaseRecords || [],
      memberMembershipRecords: serverMemberMembershipRecords || [],
      regularScheduleRules: serverRegularScheduleRules || [],
      substituteAssignments: serverSubstituteAssignments || [],
      lessonWindow,
    });
    // Keep the confirmed directory page visible while the full operational
    // snapshot refreshes. Clearing it here briefly exposed the legacy local
    // member array and made the list jump from the current roster to 1,000+
    // imported rows before the directory RPC completed.
    invalidateMemberSearchIndex({ preserveDirectory: true });
    saveScheduleSafetySnapshot(lessons, keepLoadedSchedule ? "protected-refresh" : "before-server-refresh");
    replaceArray(lessons, mappedLessons);
    saveScheduleSafetySnapshot(lessons, keepLoadedSchedule ? "protected-refresh" : "server-refresh");
    refreshMembershipProductDraftsFromServer(serverProducts || []);
    if (!wasLoaded) state.activeAdminWeekIndex = 0;
    Object.assign(state, {
      liveScheduleLoaded: true,
      liveScheduleLoading: false,
      liveScheduleMessage: keepLoadedSchedule
        ? `시간표 보호 모드: 기존 ${mappedLessons.length}건 유지`
        : `실서버 시간표 ${mappedLessons.length}건 동기화`,
    });
    await adminSettingsPromise;
    adminLazyDataState.delete("records-support");
    if (state.view === "notes") {
      await loadAdminDataOnce("records-support", loadAdminRecordsSupportData);
    }
    syncAdminScheduleWeek();
    if (!mappedMembers.some((member) => member.id === state.selectedMemberId)) {
      state.selectedMemberId = null;
    }
    renderAll();
    void adminOperationalRevisionWatcher?.check?.();
    window.dispatchEvent(new CustomEvent("tennisnote:admin-live-data", {
      detail: { source: "server-sync", branchId: activeOperationBranchId() },
    }));
    if (state.view === "members" && fullAdminAccess) {
      void loadAdminMemberDirectoryPage({ force: true, preserveList: true });
    }
    scheduleAdminOperationalCacheWrite();
    adminLiveScheduleLastRefreshAt = Date.now();
    return true;
  } catch (error) {
    Object.assign(state, {
      liveScheduleLoaded: wasLoaded,
      liveScheduleLoading: false,
      liveScheduleMessage: `실서버 시간표 확인 실패: ${error?.message || "server_error"}`,
    });
    renderDataTools();
    return false;
  }
}

async function syncAdminLiveData(requireFresh = false, options = {}) {
  if (adminLiveSyncPromise) {
    if (!requireFresh) return adminLiveSyncPromise;
    await adminLiveSyncPromise;
    return syncAdminLiveData(false, options);
  }
  adminLiveSyncPromise = performAdminLiveDataSync(options);
  try {
    return await adminLiveSyncPromise;
  } finally {
    adminLiveSyncPromise = null;
  }
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

function cancelAdminInitialLiveSync() {
  if (!adminInitialLiveSyncHandle) return;
  if (adminInitialLiveSyncKind === "idle" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(adminInitialLiveSyncHandle);
  } else {
    window.clearTimeout(adminInitialLiveSyncHandle);
  }
  adminInitialLiveSyncHandle = 0;
  adminInitialLiveSyncKind = "";
}

async function refreshAdminImportAuthState(options = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) {
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: "Supabase 연결값을 먼저 설정해야 관리자 로그인을 확인할 수 있습니다.",
    });
    renderOperationsLoginGate();
    renderDataTools();
    return;
  }

  const session = client.getSession?.();
  if (!session?.access_token) {
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: "관리자 로그인 후 서버 검증을 실행할 수 있습니다.",
    });
    renderOperationsLoginGate();
    renderDataTools();
    return;
  }

  Object.assign(adminImportAuthState, {
    loading: true,
    loaded: true,
    message: "로그인 권한 확인 중입니다.",
  });
  renderOperationsLoginGate();
  renderDataTools();

  try {
    const result = await client.selectCurrentProfile();
    const profile = result.profile || null;
    const role = profile?.role || "";
    if (!result.user && !client.getSession?.()?.access_token) {
      throw new Error("admin_session_expired");
    }
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: result.user || null,
      profile,
      message: role === "admin"
        ? `${profile.name || "관리자"} 관리자 계정으로 로그인했습니다.`
        : role === "coach"
          ? `${profile.name || "코치"} 코치 계정으로 로그인했습니다.`
          : role
            ? "이 계정에는 운영 화면 권한이 없습니다."
            : "로그인은 되었지만 운영 권한 연결이 필요합니다.",
    });
    adminAuthLastVerifiedAt = Date.now();
    writeCachedOperationsIdentity(result.user, profile);
    renderOperationsLoginGate();
    hideAdminBrandSplash();
    if (["admin", "coach"].includes(role)) {
      if (role === "coach" && !operationsViewAllowed(state.view)) state.view = "schedule";
      const restoredFromCache = await restoreAdminOperationalCache();
      setView(state.view, { skipLock: true });
      if (options.syncLiveData !== false) {
        if (restoredFromCache) {
          scheduleAdminInitialLiveSync();
        } else {
          await syncAdminLiveData();
          setView(state.view, { skipLock: true });
        }
      }
    }
    return ["admin", "coach"].includes(role);
  } catch (error) {
    const storedSession = client.getSession?.();
    const cachedIdentity = adminImportAuthState.profile
      ? { user: adminImportAuthState.user, profile: adminImportAuthState.profile }
      : readCachedOperationsIdentity();
    const canKeepAccess = Boolean(
      storedSession?.access_token
      && cachedIdentity?.user?.id
      && ["admin", "coach"].includes(cachedIdentity?.profile?.role)
      && (client.isTransientConnectionError?.(error) || client.isOnline?.() === false),
    );
    if (canKeepAccess) {
      Object.assign(adminImportAuthState, {
        loading: false,
        loaded: true,
        user: cachedIdentity.user,
        profile: cachedIdentity.profile,
        message: "서버 연결이 불안정합니다. 로그인은 유지되며 연결되면 자동으로 다시 확인합니다.",
      });
      renderOperationsLoginGate();
      renderAdminConnectivityStatus(true, "서버 연결이 불안정합니다. 로그인은 유지되며 자동으로 다시 확인합니다.", "warning", 0);
      renderDataTools();
      return false;
    }
    if (!storedSession?.access_token) clearCachedOperationsIdentity();
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: storedSession?.access_token
        ? "운영 권한을 확인하지 못했습니다. 다시 확인해 주세요."
        : "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    });
    renderOperationsLoginGate();
    return false;
  } finally {
    renderDataTools();
  }
}

function startAdminImportLogin(provider) {
  const client = window.TennisNoteDataClient;
  if (!client?.signInWithOAuth || !client.readiness?.().ready) {
    blockServerPreview("Supabase 연결값을 먼저 설정해야 로그인할 수 있습니다.");
    return;
  }
  const remember = $("#operationsRememberLogin")?.checked !== false;
  localStorage.setItem(operationsRememberStorageKey, remember ? "true" : "false");
  client.setSessionPersistence?.(remember);
  client.signInWithOAuth(provider, { redirectTo: window.location.href });
}

async function signInAdminWithPassword(event) {
  event?.preventDefault();
  const client = window.TennisNoteDataClient;
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  const password = String($("#operationsLoginPassword")?.value || "");
  if (!client?.signInWithPassword || !client.readiness?.().ready) {
    blockServerPreview("관리자 로그인 연결을 먼저 확인해 주세요.");
    return;
  }
  if (!email || !password) {
    blockServerPreview("관리자 이메일과 비밀번호를 입력해 주세요.");
    return;
  }
  const remember = $("#operationsRememberLogin")?.checked !== false;
  localStorage.setItem(operationsRememberStorageKey, remember ? "true" : "false");
  client.setSessionPersistence?.(remember);
  const button = $("#operationsPasswordLoginForm button[type=submit]");
  if (button) button.disabled = true;
  Object.assign(adminImportAuthState, { loading: true, message: "관리자 계정을 확인하고 있습니다." });
  renderOperationsLoginGate();
  try {
    await client.signInWithPassword(email, password);
    if ($("#operationsLoginPassword")) $("#operationsLoginPassword").value = "";
    await refreshAdminImportAuthState();
  } catch (error) {
    Object.assign(adminImportAuthState, { loading: false, user: null, profile: null, message: "관리자 이메일 또는 비밀번호를 확인해 주세요." });
    renderOperationsLoginGate();
  } finally {
    if (button) button.disabled = false;
  }
}

async function sendAdminPasswordReset() {
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  if (!email) {
    blockServerPreview("먼저 관리자 이메일을 입력해 주세요.");
    return;
  }
  const button = $("#sendAdminPasswordResetButton");
  if (button) button.disabled = true;
  try {
    const adminResetRedirect = `${window.location.origin}${window.location.pathname}`;
    await window.TennisNoteDataClient.sendPasswordResetEmail(email, adminResetRedirect);
    blockServerPreview("비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 직접 비밀번호를 설정해 주세요.");
  } catch (error) {
    blockServerPreview("비밀번호 재설정 메일을 보내지 못했습니다. 이메일 주소와 메일 설정을 확인해 주세요.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function createAdminEmailAccount() {
  const email = String($("#operationsLoginEmail")?.value || "").trim();
  const password = String($("#operationsLoginPassword")?.value || "");
  if (!email || !password) {
    blockServerPreview("이메일과 새 비밀번호를 입력해 주세요.");
    return;
  }
  const button = $("#createAdminEmailAccountButton");
  if (button) button.disabled = true;
  try {
    await window.TennisNoteDataClient.signUpWithPassword(email, password);
    if ($("#operationsLoginPassword")) $("#operationsLoginPassword").value = "";
    blockServerPreview("가입 요청을 완료했습니다. Gmail 인증 후 기존 관리자에게 권한 승인을 받아 주세요.");
  } catch (error) {
    blockServerPreview("계정 생성에 실패했습니다. 이미 가입된 이메일인지와 비밀번호 조건을 확인해 주세요.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function signOutAdminImport() {
  const client = window.TennisNoteDataClient;
  cancelAdminInitialLiveSync();
  await clearAdminOperationalCache();
  if (client?.signOut) await client.signOut();
  clearCachedOperationsIdentity();
  Object.assign(adminImportAuthState, {
    loading: false,
    loaded: true,
    user: null,
    profile: null,
    message: "로그아웃되었습니다. 서버 검증은 관리자 로그인 후 가능합니다.",
  });
  localStorage.removeItem(storageKey);
  renderOperationsLoginGate();
  renderDataTools();
  showToast("관리자 로그인 해제");
}

function adminApprovalReady() {
  return Boolean(window.TennisNoteDataClient?.readiness?.().ready && window.TennisNoteDataClient?.getSession?.()?.access_token && adminImportAuthState.profile?.role === "admin");
}

async function refreshAdminPendingUsers() {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "Supabase 연결값을 먼저 설정해야 신규 가입자를 확인할 수 있습니다.",
    });
    renderAdminPendingUsers();
    return;
  }
  if (!client.getSession?.()?.access_token) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "관리자 로그인 후 신규 가입자를 확인할 수 있습니다.",
    });
    renderAdminPendingUsers();
    return;
  }
  if (adminImportAuthState.profile?.role !== "admin") {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "관리자 권한 계정으로 로그인해야 승인 처리가 가능합니다.",
    });
    renderAdminPendingUsers();
    return;
  }

  Object.assign(adminPendingUsersState, {
    loading: true,
    loaded: true,
    message: "신규 가입자 확인 중입니다.",
  });
  renderAdminPendingUsers();

  try {
    const result = await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "list_pending" },
    });
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: Array.isArray(result.users) ? result.users : [],
      message: "신규 가입자 확인 완료",
    });
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: `신규 가입자 확인 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
  }
  renderAdminPendingUsers();
}

async function approveAdminPendingUser(userId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) return;
  const role = document.querySelector(`[data-admin-pending-role="${userId}"]`)?.value || "member";
  const displayName = document.querySelector(`[data-admin-pending-display="${userId}"]`)?.value || "";
  Object.assign(adminPendingUsersState, { loading: true, message: "신규 가입자 승인 중입니다." });
  renderAdminPendingUsers();
  try {
    await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "approve_user", userId, role, displayName },
    });
    showToast(role === "coach" ? "코치 권한 승인 완료" : "회원 승인 완료");
    await refreshAdminPendingUsers();
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      message: `승인 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
    renderAdminPendingUsers();
  }
}

async function holdAdminPendingUser(userId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) return;
  Object.assign(adminPendingUsersState, { loading: true, message: "신규 가입자 보류 처리 중입니다." });
  renderAdminPendingUsers();
  try {
    await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "hold_user", userId },
    });
    showToast("신규 가입자 보류 처리 완료");
    await refreshAdminPendingUsers();
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      message: `보류 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
    renderAdminPendingUsers();
  }
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

async function previewDataImportOnServer() {
  if (dataImportState.status !== "ready") {
    showToast("오류 없는 파일만 서버 검증할 수 있습니다.");
    return;
  }
  if (!hasDataImportPayload()) {
    showToast("서버로 보낼 업로드 데이터가 없습니다.");
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) {
    blockServerPreview("서버 검증 연결 코드가 아직 준비되지 않았습니다.");
    return;
  }
  if (!client.readiness?.().ready) {
    blockServerPreview("Supabase 연결값을 먼저 설정해야 서버 검증이 가능합니다.");
    return;
  }
  if (!client.getSession?.()?.access_token) {
    blockServerPreview("관리자 로그인 후 서버 검증을 실행할 수 있습니다.");
    return;
  }

  setDataImportState({
    serverStatus: "checking",
    serverMessage: "서버에서 관리자 권한과 업로드 행을 다시 검증하는 중입니다.",
    serverPreview: null,
  });

  try {
    const response = await client.invokeFunction("tennisnote-admin-import", {
      headers: { "x-tennisnote-import-mode": "preview" },
      body: dataImportRequestBody("preview"),
    });
    const summary = response.summary || {};
    const status = serverPreviewStatus(summary);
    setDataImportState({
      serverStatus: status,
      serverMessage: serverPreviewMessage(status, summary),
      serverPreview: summary,
    });
    showToast(status === "ready" ? "서버 검증 완료" : "서버 검증 결과 확인 필요");
  } catch (error) {
    const payload = error.payload || {};
    const message = payload.code === "missing_admin_token" || error.status === 401
      ? "관리자 로그인 정보가 필요합니다."
      : payload.code === "admin_role_required" || error.status === 403
        ? "관리자 권한 계정만 서버 검증할 수 있습니다."
        : payload.code || error.message || "서버 검증에 실패했습니다.";
    setDataImportState({
      serverStatus: "error",
      serverMessage: message,
      serverPreview: payload.summary || null,
    });
    showToast("서버 검증 실패");
  }
}

async function commitDataImportOnServer() {
  const summary = dataImportState.serverPreview || {};
  if (dataImportState.status !== "ready" || dataImportState.serverStatus !== "ready") {
    showToast("로컬·서버 검증을 모두 통과한 파일만 반영할 수 있습니다.");
    return;
  }
  if (Number(summary.errorRows || 0) > 0 || Number(summary.reviewRows || 0) > 0) {
    showToast("오류 또는 확인 필요 행을 먼저 정리하세요.");
    return;
  }
  if (!hasDataImportPayload()) {
    showToast("반영할 업로드 데이터가 없습니다.");
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    blockServerPreview("관리자 로그인 후 DB 반영을 실행할 수 있습니다.", summary);
    return;
  }

  const approved = window.confirm(
    `${dataImportState.readyRows}개 행을 실제 DB에 반영합니다.\n\n` +
    "반영 전 데이터 내보내기로 백업했는지 확인하세요. 계속할까요?",
  );
  if (!approved) return;

  setDataImportState({
    serverStatus: "checking",
    serverMessage: "검증된 업로드 행을 DB에 반영하는 중입니다. 창을 닫지 마세요.",
    serverPreview: summary,
  });

  try {
    const response = await client.invokeFunction("tennisnote-admin-import", {
      headers: { "x-tennisnote-import-mode": "commit" },
      body: {
        ...dataImportRequestBody("commit"),
        confirm: "IMPORT_APPROVED",
      },
    });
    if (!response?.writesToDatabase || response?.code !== "import_committed") {
      throw Object.assign(new Error(response?.code || "import_commit_not_confirmed"), { payload: response });
    }
    let refreshedFromServer = false;
    try {
      await syncAdminLiveData(true);
      await loadAdminMemberDirectoryPage({ force: true, render: false });
      refreshedFromServer = true;
    } catch (refreshError) {
      console.warn("[Tennis Note] import committed but post-import refresh failed", refreshError);
    }
    const importResult = response.result || {};
    const importedMembers = Number(importResult.memberCount || importResult.member_count || dataImportState.memberRowCount || 0);
    const importedSchedules = Number(importResult.scheduleCount || importResult.schedule_count || dataImportState.scheduleRowCount || 0);
    setDataImportState({
      serverStatus: "committed",
      serverMessage: `DB 반영 완료. 회원 ${importedMembers}명, 시간표 ${importedSchedules}건을 처리했습니다. ${
        refreshedFromServer ? "서버 재조회까지 완료했습니다." : "서버 재조회 버튼으로 결과를 확인하세요."
      }`,
      serverPreview: { ...summary, importResult },
    });
    billingLogs.unshift(`엑셀 DB 반영 완료: ${dataImportState.fileName} ${dataImportState.readyRows}행`);
    saveSnapshot();
    showToast("DB 반영 완료");
  } catch (error) {
    const payload = error?.payload || {};
    const message = payload.code === "commit_disabled"
      ? "운영 DB 반영 기능이 아직 잠겨 있습니다. 최종 승인 후 서버 설정을 켜야 합니다."
      : payload.code === "preview_not_clear"
        ? "서버 재검증에서 확인할 행이 발견되어 반영하지 않았습니다."
        : payload.code || error?.message || "DB 반영에 실패했습니다.";
    setDataImportState({
      serverStatus: "error",
      serverMessage: message,
      serverPreview: payload.summary || summary,
    });
    showToast("DB 반영 실패");
  }
}

function exportRowsByDataset(includePrivate = false) {
  return {
    members: {
      label: "회원",
      rows: [
        ["회원명", "상태", "담당코치", "정규시간", "회원권", "잔여횟수", ...(includePrivate ? ["연락처"] : [])],
        ...members.map((member) => [
          member.name,
          member.statusLabel,
          member.coach,
          member.regularTime,
          member.lessonType,
          member.remaining,
          ...(includePrivate ? [member.phone || ""] : []),
        ]),
      ],
    },
    tickets: {
      label: "회원권",
      rows: [
        ["회원명", "상품", "총횟수", "사용횟수", "잔여횟수", "만료일", "수업구분"],
        ...tickets.map((ticket) => [ticket.member, ticket.product, ticket.total, ticket.used, ticket.remaining, ticket.expires, ticket.lessonKind || "개인"]),
      ],
    },
    lessons: {
      label: "레슨시간표",
      rows: [
        ["요일", "시간", "회원명", "담당코치", "수업분", "상태", "보강여부"],
        ...lessons.map((lesson) => [lesson.day, lesson.time, lesson.member, getCoachName(lesson.coachId), lesson.durationMinutes, getLessonStatusLabel(lesson), lesson.makeup ? "보강" : "정규"]),
      ],
    },
    weeklySchedule: {
      label: "현재 주간 레슨표",
      rows: adminWeeklyScheduleExportRows(),
    },
    payments: {
      label: "결제정산",
      rows: [
        ["회원명", "항목", "금액", "수단", "상태"],
        ...billings.map((billing) => [billing.member, billing.item, billing.amount, paymentMethodLabel(billing.method), billing.statusLabel]),
      ],
    },
    products: {
      label: "상품가격",
      rows: [
        ["상품명", "구분", "수업형식", "횟수", "현금가격", "카드가격", "사용기간", "유예기간", "할인가능"],
        ...membershipProductDrafts.map((product) => [product.title, product.group, product.format, product.tickets, product.cashAmount, product.cardAmount, product.validityDays, product.graceDays, product.discountEnabled ? "가능" : "불가"]),
      ],
    },
    coaches: {
      label: "코치근무",
      rows: [
        ["코치명", "상태", "권한", "근무시간", "정산방식"],
        ...coaches.filter((coach) => coach.id !== "coach-machine").map((coach) => {
          const rule = settlementRuleFor(coach.name);
          return [coach.name, coach.status, coachModeLabel(coach), getCoachAvailabilitySummary(coach.id), rule.method === "hourly" ? `시급 ${rule.hourly}` : `비율 ${Math.round(rule.ratio * 100)}%`];
        }),
      ],
    },
  };
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

async function loadAdminDriveReportSnapshot({ force = false } = {}) {
  state.managementReportMonth = /^\d{4}-\d{2}$/.test(state.managementReportMonth)
    ? state.managementReportMonth
    : adminLocalDateKey(new Date()).slice(0, 7);
  const period = state.managementReportMonth;
  const branchId = activeOperationBranchId();
  const currentKey = `${branchId}:${period}`;
  const loadedKey = `${adminDriveReportState.branchId}:${adminDriveReportState.period}`;

  if (adminDemoMode) {
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status: "not_configured",
      period,
      branchId,
      snapshot: null,
      message: "데모에서는 Drive 서버를 호출하지 않습니다.",
    });
    return false;
  }
  if (!force && adminDriveReportState.loaded && currentKey === loadedKey) return false;
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready || operationsRole() !== "admin" || !branchId) {
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status: "not_configured",
      period,
      branchId,
      snapshot: null,
      message: "관리자 로그인과 현재 지점 연결을 확인해 주세요.",
    });
    if (state.view === "reports") renderReports();
    return false;
  }

  const requestSerial = ++adminDriveReportRequestSerial;
  Object.assign(adminDriveReportState, {
    loading: true,
    loaded: false,
    status: "loading",
    period,
    branchId,
    snapshot: null,
    message: "Drive 집계 셀 확인 중",
  });
  if (state.view === "reports") renderReports();
  try {
    const response = await client.invokeFunction("tennisnote-drive-report-snapshot", {
      body: { period, branchId },
    });
    if (requestSerial !== adminDriveReportRequestSerial) return false;
    const status = ["fresh", "stale", "provisional"].includes(response?.status)
      ? response.status
      : "error";
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status,
      snapshot: response?.ok ? response : null,
      message: response?.ok ? "Drive 읽기 전용 집계 확인 완료" : "Drive 응답 계약을 확인해 주세요.",
    });
    return true;
  } catch (error) {
    if (requestSerial !== adminDriveReportRequestSerial) return false;
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      snapshot: null,
      ...adminDriveReportErrorState(error),
    });
    return true;
  } finally {
    if (requestSerial === adminDriveReportRequestSerial && state.view === "reports") renderReports();
  }
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

function syncCoachStaffSettlementFieldVisibility(method) {
  $$('[data-settlement-mode-field="ratio"]').forEach((element) => {
    element.classList.toggle("is-hidden", method !== "ratio");
  });
  $$('[data-settlement-mode-field="hourly"]').forEach((element) => {
    element.classList.toggle("is-hidden", method !== "hourly");
  });
}

function openCoachStaffModal(coachId = "") {
  if (operationsRole() !== "admin") {
    showToast("관리자만 코치·직원 정보를 수정할 수 있습니다.");
    return;
  }
  const coach = operationBranchCoaches().find((item) => item.id === coachId) || null;
  coachStaffEditorState.coachId = coach?.id || "";
  coachStaffEditorState.mode = coach ? "edit" : "create";
  coachStaffEditorState.tab = "basic";
  coachStaffEditorState.draft = coachStaffDraftFrom(coach);
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "";
  renderCoachStaffModal();
  window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
}

function closeCoachStaffModal() {
  const modal = $("#coachStaffModal");
  if (modal) modal.hidden = true;
  coachStaffEditorState.draft = null;
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "";
}

function addCoachStaffBlock(type) {
  const draft = coachStaffEditorState.draft;
  if (!draft) return;
  const title = type === "break" ? "Break" : "Work";
  const days = $$(`[data-coach-staff-${type}-day]:checked`).map((input) => input.value);
  const start = $(`#coachStaff${title}Start`)?.value || "";
  const end = $(`#coachStaff${title}End`)?.value || "";
  const label = $(`#coachStaff${title}Label`)?.value.trim() || (type === "break" ? "브레이크" : "근무");
  if (!days.length || !start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
    coachStaffEditorState.message = "요일과 시작·종료 시간을 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  const target = type === "break" ? draft.breakBlocks : draft.workBlocks;
  const editingId = coachStaffEditorState.editingBlockType === type
    ? coachStaffEditorState.editingBlockId
    : "";
  const nextBlock = { id: editingId || `${type}-${Date.now()}`, days, start, end, label };
  if (editingId) {
    const index = target.findIndex((block) => block.id === editingId);
    if (index >= 0) target.splice(index, 1, nextBlock);
    else target.push(nextBlock);
  } else {
    target.push(nextBlock);
  }
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "변경사항이 있습니다. 아래 저장을 눌러 서버에 반영하세요.";
  renderCoachStaffModal();
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

function cancelCoachStaffBlockEdit(allCoachStaffEditorState = coachStaffEditorState) {
  allCoachStaffEditorState.editingBlockType = "";
  allCoachStaffEditorState.editingBlockId = "";
  allCoachStaffEditorState.message = "";
  renderCoachStaffModal();
}

function removeCoachStaffBlock(type, blockId, allCoachStaffEditorState = coachStaffEditorState) {
  const draft = allCoachStaffEditorState.draft;
  if (!draft) return;
  if (type === "break") draft.breakBlocks = draft.breakBlocks.filter((block) => block.id !== blockId);
  else draft.workBlocks = draft.workBlocks.filter((block) => block.id !== blockId);
  if (allCoachStaffEditorState.editingBlockId === blockId) {
    allCoachStaffEditorState.editingBlockType = "";
    allCoachStaffEditorState.editingBlockId = "";
  }
  allCoachStaffEditorState.message = "삭제할 시간이 표시에서 빠졌습니다. 아래 저장을 눌러 서버에 반영하세요.";
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

async function saveCoachStaff() {
  readCoachStaffPanel();
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft || !adminApprovalReady() || !client?.rpc) {
    coachStaffEditorState.message = "관리자 로그인과 서버 연결을 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (!draft.name || (coachStaffEditorState.mode === "create" && !draft.phone)) {
    coachStaffEditorState.message = "이름과 휴대전화를 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  const branchId = activeOperationBranchId();
  if (!branchId || String(draft.branchId || "") !== branchId) {
    coachStaffEditorState.message = "현재 운영 지점과 코치 소속 지점을 다시 확인해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (draft.settlement.method === "ratio" && (draft.settlement.ratio < 0 || draft.settlement.ratio > 100)) {
    coachStaffEditorState.message = "정산 비율은 0~100 사이로 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  if (draft.settlement.method === "hourly" && draft.settlement.hourly <= 0) {
    coachStaffEditorState.message = "시급을 입력해주세요.";
    renderCoachStaffModal();
    return;
  }
  const button = $("#saveCoachStaffButton");
  if (button) { button.disabled = true; button.textContent = "저장 중"; }
  try {
    const result = await client.rpc("tn_admin_save_coach_staff_v2", {
      target_record: coachStaffPayload(draft),
      expected_revision: draft.coachRoleId ? Number(draft.availabilityRevision) || 0 : null,
    });
    const coachRoleId = result?.coachRoleId || result?.coach_role_id || draft.coachRoleId;
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => (
      coach.serverRoleId === coachRoleId
      && String(coach.branchId || "") === branchId
    )) || coaches.find((coach) => (
      coach.name === draft.name
      && String(coach.branchId || "") === branchId
    ));
    if (!coachStaffServerMatches(saved, draft)) {
      throw new Error("coach_staff_server_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") {
      await loadLiveSchedulePolicyFromServer();
    }
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    showToast("코치·직원 정보가 서버에 저장되었습니다.");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    coachStaffEditorState.message = raw.includes("tn_admin_save_coach_staff_v2") || raw.includes("PGRST202")
      ? "코치·직원 통합 DB 기능을 먼저 적용해주세요."
      : raw.includes("coach_staff_revision_conflict")
        ? "다른 화면에서 코치 정보가 먼저 수정되었습니다. 최신 내용을 다시 불러온 뒤 다시 수정해주세요."
      : raw.includes("server_verification")
        ? "저장은 요청됐지만 서버 재확인에 실패했습니다. 새로고침 후 확인해주세요."
        : `저장 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  } finally {
    const current = $("#saveCoachStaffButton");
    if (current) { current.disabled = false; current.textContent = "저장"; }
  }
}

async function setCoachStaffState(targetState) {
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft?.coachRoleId || !client?.rpc || operationsRole() !== "admin") return;
  const labels = { approved: "코치 승인", disabled: "승인 해제", ended: "근무 종료", archived: "목록에서 숨기기(보관)", restored: "근무 복원" };
  if (!window.confirm(`${draft.name} 코치를 ${labels[targetState] || targetState} 처리할까요?`)) return;
  try {
    await client.rpc("tn_admin_set_coach_staff_state", {
      target_coach_role_id: draft.coachRoleId,
      target_state: targetState,
      target_effective_on: new Date().toISOString().slice(0, 10),
    });
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => coach.serverRoleId === draft.coachRoleId);
    const expectedApproval = ["approved", "restored"].includes(targetState) ? "approved" : "disabled";
    const expectedEmployment = targetState === "ended"
      ? "ended"
      : targetState === "archived"
        ? "archived"
        : "active";
    if (
      !saved
      || saved.approvalStatus !== expectedApproval
      || (saved.employmentStatus || "active") !== expectedEmployment
    ) {
      throw new Error("coach_staff_state_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") await loadLiveSchedulePolicyFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    const completion = targetState === "archived"
      ? "보관했습니다. 근무 중 목록에서 숨겨지고 종료·보관에서 복원할 수 있습니다."
      : targetState === "ended"
        ? "근무 종료했습니다. 신규 수업 배정에서 제외됩니다."
        : targetState === "restored"
          ? "근무 중으로 복원했습니다."
          : `${labels[targetState] || "상태 변경"} 완료`;
    showToast(completion);
  } catch (error) {
    coachStaffEditorState.message = `상태 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  }
}

async function deleteCoachStaff() {
  const draft = coachStaffEditorState.draft;
  const client = window.TennisNoteDataClient;
  if (!draft?.coachRoleId || !client?.rpc || operationsRole() !== "admin") return;
  if (!window.confirm(`${draft.name} 코치를 삭제할까요?\n현재 앱과 시간표에서는 제외하고 과거 수업·정산 기록은 보존합니다.`)) return;
  try {
    const result = await client.rpc("tn_admin_delete_coach_staff", {
      target_coach_role_id: draft.coachRoleId,
    });
    await refreshCoachStaffData();
    const saved = coaches.find((coach) => coach.serverRoleId === draft.coachRoleId);
    if (!saved?.deletedAt || saved.approvalStatus !== "disabled") {
      throw new Error("coach_staff_delete_verification_failed");
    }
    updateActiveOperationProfileFromCurrent();
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "conflict") await loadLiveSchedulePolicyFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
    closeCoachStaffModal();
    renderCoaches();
    if (state.view === "schedule") renderSchedule();
    const futureCount = Number(result?.futureLessonCount) || 0;
    showToast(futureCount
      ? `코치를 삭제했습니다. 남은 예정 수업 ${futureCount}건은 재배정이 필요합니다.`
      : "코치를 삭제했습니다.");
  } catch (error) {
    coachStaffEditorState.message = `코치 삭제 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  }
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

function ensureCoachLaneOrderEditorState() {
  const currentRoleIds = scheduleLaneActiveCoaches().map((coach) => String(coach.serverRoleId));
  if (!coachLaneOrderEditorState.roleIds.length
    || !sameCoachRoleSet(coachLaneOrderEditorState.roleIds, currentRoleIds)) {
    coachLaneOrderEditorState.roleIds = currentRoleIds;
    coachLaneOrderEditorState.baselineRoleIds = [...currentRoleIds];
    coachLaneOrderEditorState.revision = "";
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = "";
  }
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

async function previewCoachLaneOrder() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || operationsRole() !== "admin") return;
  coachLaneOrderEditorState.loading = true;
  coachLaneOrderEditorState.message = "서버의 현재 순서를 확인하는 중입니다.";
  renderCoachLaneOrderEditor();
  try {
    const preview = await client.rpc("tn_admin_preview_coach_schedule_lane_order", {
      target_branch_id: branchId,
      target_role_ids: coachLaneOrderEditorState.roleIds,
    });
    coachLaneOrderEditorState.revision = String(preview?.revision || "");
    coachLaneOrderEditorState.confirmed = Boolean(coachLaneOrderEditorState.revision);
    coachLaneOrderEditorState.message = preview?.changed
      ? "서버 확인 완료. 순서 저장을 누르면 모든 시간표에 적용됩니다."
      : "현재 서버 순서와 같습니다.";
  } catch (error) {
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = /tn_admin_preview_coach_schedule_lane_order|PGRST202|42883|schema cache/i.test(`${error?.message || ""} ${error?.payload?.message || ""}`)
      ? "시간표 열 순서 DB 기능을 먼저 적용해주세요."
      : `서버 확인 실패: ${error?.payload?.code || error?.message || "server_error"}`;
  } finally {
    coachLaneOrderEditorState.loading = false;
    renderCoachLaneOrderEditor();
  }
}

async function saveCoachLaneOrder() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || !coachLaneOrderEditorState.confirmed || !coachLaneOrderEditorState.revision) return;
  coachLaneOrderEditorState.saving = true;
  coachLaneOrderEditorState.message = "시간표 열 순서를 저장하는 중입니다.";
  renderCoachLaneOrderEditor();
  try {
    const saved = await client.rpc("tn_admin_save_coach_schedule_lane_order", {
      target_branch_id: branchId,
      target_role_ids: coachLaneOrderEditorState.roleIds,
      target_expected_revision: coachLaneOrderEditorState.revision,
      target_reason: "운영 설정 시간표 열 순서 변경",
    });
    if (!saved?.saved || !Array.isArray(saved.after)) throw new Error("coach_lane_order_save_verification_failed");
    const savedOrder = saved.after.map((item) => String(item.roleId));
    if (savedOrder.join("|") !== coachLaneOrderEditorState.roleIds.join("|")) {
      throw new Error("coach_lane_order_server_mismatch");
    }
    await refreshCoachStaffData();
    coachLaneOrderEditorState.roleIds = savedOrder;
    coachLaneOrderEditorState.baselineRoleIds = [...savedOrder];
    coachLaneOrderEditorState.revision = String(saved.revision || "");
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = "서버 저장 완료. 회원·코치·관리자 시간표에 같은 순서가 적용됩니다.";
    scheduleAdminOperationalCacheWrite();
    saveSnapshot();
    renderCoaches();
    showToast("시간표 열 순서를 저장했습니다.");
  } catch (error) {
    const raw = `${error?.message || ""} ${error?.payload?.message || ""}`;
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = /coach_lane_order_revision_conflict/i.test(raw)
      ? "다른 관리자가 먼저 변경했습니다. 서버 확인을 다시 눌러주세요."
      : `순서 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`;
  } finally {
    coachLaneOrderEditorState.saving = false;
    renderCoachLaneOrderEditor();
  }
}

async function reconcileCoachLogin(coachId) {
  const coach = coaches.find((item) => item.id === coachId);
  const client = window.TennisNoteDataClient;
  if (!coach?.serverRoleId || !coach.loginCandidateUserId || !client?.rpc || operationsRole() !== "admin") return;
  if (!window.confirm(`${coach.name} 코치의 가입 계정을 연결할까요?`)) return;
  try {
    await client.rpc("tn_admin_reconcile_coach_login", {
      target_coach_role_id: coach.serverRoleId,
      source_signup_user_id: coach.loginCandidateUserId,
      target_reason: "관리자 코치 가입 계정 연결",
    });
    await refreshCoachStaffData();
    const saved = coaches.find((item) => item.serverRoleId === coach.serverRoleId);
    if (!saved?.accountLinked) throw new Error("coach_login_reconciliation_verification_failed");
    renderCoaches();
    showToast(`${coach.name} 코치 계정 연결 완료`);
  } catch (error) {
    showToast(`코치 계정 연결 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
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

async function saveLivePastLessonAbsenceCorrection() {
  const client = window.TennisNoteDataClient;
  const editingLesson = getCurrentEditingLesson();
  const candidate = getLessonFormCandidate();
  const ticket = getSelectedTicket();
  const coach = coaches.find((item) => item.id === candidate.coachId || item.serverRoleId === candidate.coachId);
  const lessonDate = adminWeekDateForDay(candidate.day);
  const correctionReason = adminPastCorrectionReason();
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인이 필요합니다.");
  }
  if (!editingLesson?.serverLessonId && (!ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate || !candidate.time)) {
    throw new Error("past_absence_slot_required");
  }
  return client.rpc("tn_admin_record_past_regular_absence", {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_ticket_id: ticket?.serverTicketId || null,
    target_coach_role_id: coach?.serverRoleId || null,
    target_lesson_date: lessonDate || null,
    target_start_time: candidate.time || null,
    target_duration_minutes: Number(candidate.durationMinutes) || 20,
    target_reason: correctionReason,
  });
}

function editBreakRule(ruleId) {
  if (!scheduleSettings.breakRules.some((rule) => rule.id === ruleId)) return;
  state.editingBreakRuleId = ruleId;
  renderScheduleSettings();
  $("#breakStartInput")?.focus();
}

function loadBreakFavorite(favoriteId) {
  const favorite = scheduleSettings.breakFavorites.find((item) => item.id === favoriteId);
  if (!favorite) return;
  state.editingBreakRuleId = "";
  $$('[data-break-day]').forEach((input) => { input.checked = favorite.days.includes(input.value); });
  const coachRoleIds = Array.isArray(favorite.coachRoleIds) ? favorite.coachRoleIds : [];
  $$('[data-break-coach]').forEach((input) => { input.checked = !coachRoleIds.length || coachRoleIds.includes(input.value); });
  if ($("#breakStartInput")) $("#breakStartInput").value = favorite.start;
  if ($("#breakEndInput")) $("#breakEndInput").value = favorite.end;
  if ($("#breakLabelInput")) $("#breakLabelInput").value = favorite.label || "브레이크";
  if ($("#applyBreakRuleButton")) $("#applyBreakRuleButton").textContent = "브레이크 추가";
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

async function saveHoldingPolicySettings() {
  holdingPolicySettings.personalMaxDays = Math.max(0, Number($("#holdingPersonalMaxDays")?.value) || 7);
  holdingPolicySettings.fourWeekPersonalMaxDays = holdingPolicySettings.personalMaxDays;
  holdingPolicySettings.threeMonthPersonalMaxDays = Math.max(0, Number($("#holdingThreeMonthPersonalMaxDays")?.value) || 14);
  holdingPolicySettings.couponPersonalMaxDays = 0;
  holdingPolicySettings.injuryMaxDays = Math.max(1, Number($("#holdingInjuryMaxDays")?.value) || 30);
  holdingPolicySettings.emergencyRetroactiveDays = Math.max(0, Number($("#holdingEmergencyRetroactiveDays")?.value) || 3);
  holdingPolicySettings.evidenceRetentionDays = Math.max(1, Number($("#holdingEvidenceRetentionDays")?.value) || 30);
  holdingPolicySettings.evidenceRequired = $("#holdingEvidenceRequired")?.checked !== false;
  reflectHoldingPolicyInActiveVersion();
  saveSnapshot();
  const client = window.TennisNoteDataClient;
  let serverSaveFailed = false;
  if (client?.readiness?.().ready && client.getSession?.()?.access_token) {
    try {
      const value = { ...holdingPolicySettings, updatedAt: new Date().toISOString() };
      const updated = await client.updateRows("tn_admin_settings", { key: holdingPolicyKey }, { value, updated_at: new Date().toISOString() });
      if (!updated?.length) await client.insertRows("tn_admin_settings", { key: holdingPolicyKey, value });
    } catch {
      serverSaveFailed = true;
    }
  }
  if (await syncPolicyVersionsToServer() === "blocked") serverSaveFailed = true;
  renderHoldingPolicySettings();
  renderPolicyVersionSettings();
  showToast(serverSaveFailed ? "로컬 저장 완료 · 서버 정책 저장은 관리자 권한 확인 필요" : "홀딩 정책 저장 완료");
}

async function loadServerHoldingPolicy() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", { select: "key,value", filters: { key: holdingPolicyKey }, limit: 1 });
    if (rows?.[0]?.value) Object.assign(holdingPolicySettings, rows[0].value);
    reflectHoldingPolicyInActiveVersion();
    saveSnapshot();
    renderHoldingPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
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

function resetNoticeImageDraft() {
  if (noticeImageDraftUrl) URL.revokeObjectURL(noticeImageDraftUrl);
  noticeImageDraftFile = null;
  noticeImageDraftUrl = "";
  noticeImageRemoveRequested = false;
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

function noticeStoragePublicUrl(objectPath = "") {
  const baseUrl = String(window.TennisNoteDataClient?.loadConfig?.()?.supabaseUrl || "").replace(/\/$/, "");
  const encodedPath = String(objectPath).split("/").map((part) => encodeURIComponent(part)).join("/");
  return baseUrl && encodedPath
    ? `${baseUrl}/storage/v1/object/public/${noticeMediaBucket}/${encodedPath}`
    : "";
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

async function deleteNoticeStorageObject(objectPath = "") {
  const client = liveNoticeClient();
  if (!objectPath || !client?.deleteObject) return false;
  try {
    await client.deleteObject(noticeMediaBucket, objectPath);
    return true;
  } catch {
    return false;
  }
}

async function saveNoticePopupSettings(statusOverride = "") {
  const rawTitle = $("#noticeTitleInput")?.value.trim() || "";
  const rawBody = $("#noticeBodyInput")?.value.trim() || "";
  const startDate = $("#noticeStartDateInput")?.value || "";
  const endDate = $("#noticeEndDateInput")?.value || "";
  if (rawTitle.length < 2) {
    showToast("공지 제목을 2자 이상 입력해주세요");
    $("#noticeTitleInput")?.focus();
    return;
  }
  if (rawBody.length < 5) {
    showToast("공지 내용을 5자 이상 입력해주세요");
    $("#noticeBodyInput")?.focus();
    return;
  }
  if (startDate && endDate && endDate < startDate) {
    showToast("공지 종료일은 시작일보다 빠를 수 없습니다");
    return;
  }
  const actionUrl = $("#noticeActionUrlInput")?.value.trim() || "";
  if (actionUrl) {
    try {
      const parsed = new URL(actionUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol");
    } catch {
      showToast("버튼 연결 주소는 http:// 또는 https:// 주소로 입력해주세요");
      $("#noticeActionUrlInput")?.focus();
      return;
    }
  }
  const previousNotice = editingPopupNotice();
  let draftNotice = readNoticePopupForm(statusOverride);
  let uploadedPath = "";
  try {
    const uploadResult = await uploadNoticeDraftImage(draftNotice);
    draftNotice = uploadResult.notice;
    uploadedPath = uploadResult.uploadedPath;
  } catch (error) {
    showToast(error?.message || "공지 이미지를 업로드하지 못했습니다");
    return;
  }
  const liveResult = await savePopupNoticeToServer(draftNotice);
  if (liveResult === "blocked") {
    if (uploadedPath) await deleteNoticeStorageObject(uploadedPath);
    renderNoticePopupSettings();
    renderDashboardNoticeSummary();
    showToast("공지 서버 반영 실패 · 관리자 권한과 SQL 적용을 확인해주세요");
    return;
  }
  const notice = liveResult === "server" ? editingPopupNotice() : writePopupNotice(draftNotice);
  if (liveResult === "server" && previousNotice.imageStoragePath && previousNotice.imageStoragePath !== notice.imageStoragePath) {
    await deleteNoticeStorageObject(previousNotice.imageStoragePath);
  }
  resetNoticeImageDraft();
  resetNoticeDismissals();
  billingLogs.unshift(`공지사항 팝업 ${notice.status === "active" ? "반영" : "끄기"} · ${notice.title}`);
  renderNoticePopupSettings();
  renderDashboardNoticeSummary();
  if (liveResult === "server") {
    showToast(notice.status === "active" ? "공지사항 팝업 DB 반영 완료" : "공지사항 팝업 DB 끄기 완료");
    return;
  }
  showToast(notice.status === "active" ? "공지사항 팝업 반영 완료" : "공지사항 팝업 끄기 완료");
}

function startNewPopupNotice() {
  resetNoticeImageDraft();
  const newNotice = normalizePopupNotice({
    ...defaultPopupNotice,
    id: `notice-new-${Date.now()}`,
    title: "",
    body: "",
    status: "active",
    displayOrder: (popupNotices().length + 1) * 10,
    updatedAt: "",
  });
  state.noticeEditingId = newNotice.id;
  state.noticeDraft = newNotice;
  renderNoticePopupSettings();
  $("#noticeTitleInput")?.focus();
  showToast("새 공지를 작성할 수 있습니다");
}

function editPopupNotice(noticeId = "") {
  if (!popupNotices().some((notice) => notice.id === noticeId)) return;
  resetNoticeImageDraft();
  state.noticeDraft = null;
  state.noticeEditingId = noticeId;
  renderNoticePopupSettings();
  $("#noticeTitleInput")?.focus();
}

async function movePopupNotice(noticeId = "", direction = "down") {
  const notices = popupNotices();
  const fromIndex = notices.findIndex((notice) => notice.id === noticeId);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= notices.length) return;
  [notices[fromIndex], notices[toIndex]] = [notices[toIndex], notices[fromIndex]];
  const reordered = notices.map((notice, index) => normalizePopupNotice({ ...notice, displayOrder: (index + 1) * 10 }));
  const client = liveNoticeClient();
  if (client?.rpc && reordered.every((notice) => isUuid(notice.id))) {
    try {
      await client.rpc("tn_admin_reorder_notice_popups", { target_notice_ids: reordered.map((notice) => notice.id) });
    } catch {
      showToast("공지 순서를 저장하지 못했습니다");
      await syncPopupNoticeFromServer();
      return;
    }
  }
  const shared = loadSharedData();
  shared.notices = reordered;
  saveSharedData(shared);
  renderNoticePopupSettings();
  resetNoticeDismissals();
  showToast("공지 표시 순서를 변경했습니다");
}

async function deletePopupNotice(noticeId = "") {
  const notice = popupNotices().find((item) => item.id === noticeId);
  if (!notice) return;
  if (!window.confirm(`\"${notice.title || "새 공지"}\" 공지를 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
  const client = liveNoticeClient();
  if (isUuid(notice.id) && client?.rpc) {
    try {
      await client.rpc("tn_admin_delete_notice_popup", { target_notice_id: notice.id });
    } catch {
      showToast("공지 삭제 실패 · 관리자 권한을 확인해주세요");
      return;
    }
  } else if (isUuid(notice.id) && client) {
    showToast("공지 삭제 기능 SQL 적용이 필요합니다");
    return;
  }
  if (notice.imageStoragePath && isUuid(notice.id)) await deleteNoticeStorageObject(notice.imageStoragePath);
  const shared = loadSharedData();
  shared.notices = (shared.notices || []).filter((item) => item.id !== notice.id);
  saveSharedData(shared);
  resetNoticeImageDraft();
  state.noticeDraft = null;
  state.noticeEditingId = popupNotices()[0]?.id || "";
  renderNoticePopupSettings();
  renderDashboardNoticeSummary();
  resetNoticeDismissals();
  showToast("공지를 삭제했습니다");
}

function persistAdminLayoutLocal() {
  localStorage.setItem(adminLayoutLocalKey, JSON.stringify(adminLayoutSettings));
}

function setAdminMoreMenuOpen(open) {
  const menu = $("#adminMoreMenu");
  const button = $("#adminMoreMenuButton");
  const hasItems = Boolean(menu?.querySelector('.nav-item[data-view]:not([hidden])'));
  adminMoreMenuOpen = Boolean(open && hasItems);
  if (menu) menu.hidden = !adminMoreMenuOpen;
  if (button) {
    button.hidden = !hasItems;
    button.classList.toggle("is-open", adminMoreMenuOpen);
    button.setAttribute("aria-expanded", String(adminMoreMenuOpen));
  }
}

function applyAdminLayoutSettings() {
  const nav = $(".nav-list");
  if (nav) {
    const primaryMenu = $("#adminPrimaryMenu");
    const moreMenu = $("#adminMoreMenu");
    adminLayoutSettings.menuOrder.forEach((view) => {
      const button = nav.querySelector(`[data-view="${view}"]`);
      const destination = adminLayoutSettings.moreMenus.includes(view) ? moreMenu : primaryMenu;
      if (button && destination) destination.append(button);
    });
    adminMenuDefinitions.forEach((item) => {
      const button = nav.querySelector(`[data-view="${item.id}"]`);
      if (button) button.hidden = adminLayoutSettings.hiddenMenus.includes(item.id) || !operationsViewAllowed(item.id);
    });
    const activeIsMore = adminLayoutSettings.moreMenus.includes(state.view);
    $("#adminMoreMenuButton")?.classList.toggle("is-active", activeIsMore);
    setAdminMoreMenuOpen(adminMoreMenuOpen || activeIsMore);
  }

  const dashboard = $("#dashboardView");
  if (!dashboard) return;
  dashboard.classList.add("dashboard-layout-customizable");
  adminLayoutSettings.groupOrder.forEach((groupId, index) => {
    const group = dashboard.querySelector(`[data-dashboard-group="${groupId}"]`);
    if (!group) return;
    group.style.order = String(index);
    group.hidden = adminLayoutSettings.hiddenGroups.includes(groupId);
  });
  Object.entries(adminLayoutSettings.widgetOrder).forEach(([groupId, widgetOrder]) => {
    const group = dashboard.querySelector(`[data-dashboard-group="${groupId}"]`);
    if (!group) return;
    widgetOrder.forEach((widgetId) => {
      const widget = group.querySelector(`[data-dashboard-widget="${widgetId}"]`);
      if (widget) group.append(widget);
    });
  });
  Object.values(adminDashboardWidgetDefinitions).flat().forEach((item) => {
    const widget = dashboard.querySelector(`[data-dashboard-widget="${item.id}"]`);
    if (widget) widget.hidden = adminLayoutSettings.hiddenWidgets.includes(item.id);
  });

  const reportView = $("#reportsView");
  if (reportView) {
    reportView.classList.add("report-layout-customizable");
    adminLayoutSettings.reportWidgetOrder.forEach((widgetId, index) => {
      const widget = reportView.querySelector(`[data-report-widget="${widgetId}"]`);
      if (!widget) return;
      widget.style.order = String(index + 1);
      widget.hidden = adminLayoutSettings.hiddenReportWidgets.includes(widgetId);
      widget.dataset.reportSize = adminLayoutSettings.reportWidgetSizes[widgetId] || "two";
      widget.dataset.reportFilter = adminLayoutSettings.reportWidgetFilters[widgetId] || "all";
    });
  }
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

function applyAdminLayoutPreset(presetId) {
  const preset = adminLayoutPresets[presetId];
  if (!preset) return;
  adminLayoutSettings.menuOrder = [...preset.menuOrder];
  adminLayoutSettings.moreMenus = [...preset.moreMenus];
  adminLayoutSettings.hiddenMenus = [];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

function setAdminMenuPlacement(itemId, placement) {
  if (!adminMenuDefinitions.some((item) => item.id === itemId) || itemId === "dashboard") return;
  const moreMenus = new Set(adminLayoutSettings.moreMenus);
  if (placement === "more") moreMenus.add(itemId);
  else moreMenus.delete(itemId);
  adminLayoutSettings.moreMenus = adminLayoutSettings.menuOrder.filter((id) => moreMenus.has(id));
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

function setAdminReportWidgetOption(kind, itemId, value) {
  if (!adminReportWidgetDefinitions.some((item) => item.id === itemId)) return;
  const options = kind === "size" ? adminReportWidgetSizeOptions : adminReportWidgetFilterOptions;
  if (!options.some((option) => option.id === value)) return;
  const key = kind === "size" ? "reportWidgetSizes" : "reportWidgetFilters";
  adminLayoutSettings[key][itemId] = value;
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
  if (kind === "filter") renderReports();
}

function setAdminLayoutVisibility(kind, itemId, visible) {
  const key = kind === "menu"
    ? "hiddenMenus"
    : kind === "group"
      ? "hiddenGroups"
      : kind === "reportWidget"
        ? "hiddenReportWidgets"
        : "hiddenWidgets";
  const definitions = kind === "menu"
    ? adminMenuDefinitions
    : kind === "group"
      ? adminDashboardGroupDefinitions
      : kind === "reportWidget"
        ? adminReportWidgetDefinitions
        : Object.values(adminDashboardWidgetDefinitions).flat();
  if (definitions.find((item) => item.id === itemId)?.required) return;
  const hidden = new Set(adminLayoutSettings[key]);
  if (visible) hidden.delete(itemId);
  else hidden.add(itemId);
  adminLayoutSettings[key] = [...hidden];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

async function loadAdminLayoutSettingsFromServer(preloadedRow = undefined) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  try {
    const rows = preloadedRow === undefined
      ? await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: adminLayoutSettingKey },
        limit: 1,
      })
      : preloadedRow ? [preloadedRow] : [];
    if (!rows?.length) {
      adminLayoutServerUpdatedAt = "";
      return false;
    }
    adminLayoutServerUpdatedAt = rows[0].updated_at || "";
    adminLayoutSettings = normalizeAdminLayoutSettings(rows[0].value || {});
    adminLayoutSaveState = "server";
    persistAdminLayoutLocal();
    renderAdminLayoutSettings();
    return true;
  } catch {
    return false;
  }
}

async function loadAdminStartupSettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  let rows = [];
  try {
    rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: { in: [liveSchedulePolicyKey, adminLayoutSettingKey] } },
      limit: 2,
    });
  } catch {
    return Promise.all([
      loadLiveSchedulePolicyFromServer(),
      loadAdminLayoutSettingsFromServer(),
      loadAdminSecuritySettingsFromServer(),
    ]);
  }
  const rowByKey = new Map((rows || []).map((row) => [row.key, row]));
  return Promise.all([
    loadLiveSchedulePolicyFromServer(rowByKey.get(liveSchedulePolicyKey) || null),
    loadAdminLayoutSettingsFromServer(rowByKey.get(adminLayoutSettingKey) || null),
    loadAdminSecuritySettingsFromServer(),
  ]);
}

async function saveAdminLayoutSettings() {
  const client = window.TennisNoteDataClient;
  if (!client?.insertRows || !client?.updateRows || !adminApprovalReady()) {
    showToast("관리자 로그인 후 화면 구성을 저장할 수 있습니다.");
    return;
  }
  adminLayoutSaveState = "saving";
  renderAdminLayoutSettings();
  try {
    if (!adminLayoutServerUpdatedAt) {
      const existing = await client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: adminLayoutSettingKey },
        limit: 1,
      });
      if (existing?.length) {
        adminLayoutServerUpdatedAt = existing[0].updated_at || "";
        throw new Error("admin_layout_revision_conflict");
      }
      const inserted = await client.insertRows("tn_admin_settings", {
        key: adminLayoutSettingKey,
        value: adminLayoutSettings,
      });
      adminLayoutServerUpdatedAt = inserted?.[0]?.updated_at || "";
    } else {
      const nextUpdatedAt = new Date().toISOString();
      const updated = await client.updateRows("tn_admin_settings", {
        key: adminLayoutSettingKey,
        updated_at: adminLayoutServerUpdatedAt,
      }, {
        value: adminLayoutSettings,
        updated_at: nextUpdatedAt,
      });
      if (!updated?.length) throw new Error("admin_layout_revision_conflict");
      adminLayoutServerUpdatedAt = updated[0]?.updated_at || nextUpdatedAt;
    }
    adminLayoutSaveState = "server";
    persistAdminLayoutLocal();
    showToast("메뉴와 대시보드 구성을 저장했습니다.");
  } catch (error) {
    if (String(error?.message || "").includes("revision_conflict")) {
      adminLayoutSaveState = "conflict";
      await loadAdminLayoutSettingsFromServer();
      showToast("다른 화면에서 구성이 변경되어 최신 배치를 불러왔습니다.");
    } else {
      adminLayoutSaveState = "local";
      showToast(`화면 구성 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
  } finally {
    renderAdminLayoutSettings();
  }
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

async function loadSupabasePublicSummary(client) {
  try {
    const rows = await client.selectRows(supabasePublicSummaryTable, {
      select: "key,label,table_name,row_count,status,detail,updated_at",
      limit: 50,
    });
    return rows
      .slice()
      .sort((left, right) => `${left.key}`.localeCompare(`${right.key}`))
      .map((row) => ({
        id: row.key,
        table: row.table_name,
        title: row.label,
        count: Number(row.row_count) || 0,
        status: row.status || "ready",
        label: `${Number(row.row_count) || 0}건`,
        detail: row.detail || "공개 가능한 샘플 상태 요약입니다.",
        publicSummary: true,
      }));
  } catch (error) {
    return [];
  }
}

async function loadSupabaseLiveStatus() {
  const client = window.TennisNoteDataClient;
  const target = $("#supabaseLiveStatus");
  if (!client || !target) return;

  const readiness = client.readiness();
  if (!readiness.ready) {
    supabaseLiveState.loaded = true;
    supabaseLiveState.loading = false;
    supabaseLiveState.message = "로컬 브라우저 설정이 아직 없습니다.";
    supabaseLiveState.items = supabaseLiveTables.map((item) => ({ ...item, title: item.label, status: "setup", label: "설정 필요", detail: "config.local.js 또는 localStorage 연결값 필요" }));
    renderSupabaseLiveStatus();
    return;
  }

  supabaseLiveState.loading = true;
  supabaseLiveState.message = "Supabase 읽기 확인 중";
  renderSupabaseLiveStatus();

  const summaryItems = await loadSupabasePublicSummary(client);
  const items = await Promise.all(
    supabaseLiveTables.map(async (item) => {
      try {
        const count = await client.countRows(item.table);
        return {
          ...item,
          title: item.label,
          count,
          status: count > 0 ? "ready" : "empty",
          label: count > 0 ? `${count}건` : "0건",
          detail: count > 0 ? "읽기 연결 확인" : "테이블은 연결됐고 아직 데이터가 없습니다.",
        };
      } catch (error) {
        return {
          ...item,
          status: "blocked",
          label: permissionMessage(error),
          detail: item.private ? "RLS 정책상 로그인/역할 연결 후 읽을 수 있습니다." : "설정 또는 권한을 확인해야 합니다.",
        };
      }
    }),
  );

  supabaseLiveState.loading = false;
  supabaseLiveState.loaded = true;
  if (summaryItems.length) {
    const summaryByTable = new Map(summaryItems.map((item) => [item.table, item]));
    const liveByTable = new Map(items.map((item) => [item.table, item]));
    const configuredItems = supabaseLiveTables.map((item) => summaryByTable.get(item.table) || liveByTable.get(item.table) || { ...item, title: item.label, status: "setup", label: "확인 전", detail: "직접 읽기 확인이 필요합니다." });
    const extraSummaryItems = summaryItems.filter((item) => !supabaseLiveTables.some((configured) => configured.table === item.table));
    supabaseLiveState.items = [...configuredItems, ...extraSummaryItems];
    supabaseLiveState.message = "Supabase 샘플 요약 + 신규 테이블 직접 확인 완료";
  } else {
    supabaseLiveState.items = items;
    supabaseLiveState.message = "Supabase 읽기 확인 완료";
  }
  renderSupabaseLiveStatus();
}

async function loadAuthProviderStatus() {
  const client = window.TennisNoteDataClient;
  const target = $("#authProviderStatus");
  if (!client || !target) return;
  const readiness = client.readiness();
  if (!readiness.ready) {
    authProviderState.loaded = true;
    authProviderState.loading = false;
    authProviderState.message = "로컬 브라우저 설정이 아직 없습니다.";
    authProviderState.items = authProviderItems();
    renderAuthProviderStatus();
    return;
  }

  authProviderState.loading = true;
  authProviderState.message = "로그인 제공자 확인 중";
  renderAuthProviderStatus();
  try {
    const settings = await client.getAuthSettings();
    authProviderState.items = authProviderItems(settings);
    authProviderState.message = "로그인 제공자 확인 완료";
  } catch (error) {
    authProviderState.items = authProviderItems();
    authProviderState.message = "로그인 제공자 확인 실패";
  } finally {
    authProviderState.loading = false;
    authProviderState.loaded = true;
    renderAuthProviderStatus();
  }
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

function resetScheduleEntryState() {
  // The saved browser snapshot may contain a coach-only or pending-only view.
  // A first visit must always start from the full weekly timetable instead.
  state.scheduleView = "week";
  state.scheduleFilter = "all";
  state.scheduleCoachFilter = "all";
  state.activeAdminWeekIndex = 0;
  state.selectedScheduleDay = currentScheduleDay();
  scheduleSessionInitialized = true;
}

async function refreshAdminLiveSchedule(options = {}) {
  const force = options.force === true;
  if (
    adminLiveScheduleRefreshInFlight
    || document.hidden
    || adminHasUnsavedChanges()
    || !adminLiveRefreshViews.has(state.view)
    || !operationsAccessReady()
    || !$("#lessonModal")?.hidden
    || !$("#memberManagementModal")?.hidden
    || (!force && Date.now() - adminLiveScheduleLastRefreshAt < ADMIN_LIVE_REFRESH_STALE_MS)
  ) return false;

  adminLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncAdminLiveData(false, { abortIfDirty: true });
    if (synced) adminLiveScheduleLastRefreshAt = Date.now();
    return synced;
  } finally {
    adminLiveScheduleRefreshInFlight = false;
  }
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

async function recoverAdminConnection() {
  if (adminConnectionRecoveryPromise) return adminConnectionRecoveryPromise;
  adminConnectionRecoveryPromise = (async () => {
    const client = window.TennisNoteDataClient;
    if (!client?.readiness?.().ready || client.isOnline?.() === false) return false;
    let deferredLiveSync = false;
    renderAdminConnectivityStatus(true, "서버 연결과 로그인 상태를 다시 확인하고 있습니다.", "recovering", 0);
    try {
      await client.ensureSession?.();
      if (client.getSession?.()?.access_token) {
        restoreCachedOperationsIdentity();
        const verified = await refreshAdminImportAuthState({ syncLiveData: false });
        if (verified && operationsAccessReady()) {
          if (adminHasUnsavedChanges()) {
            deferredLiveSync = true;
            renderAdminConnectivityStatus(
              true,
              "작성 중인 변경사항이 있어 서버 자료 새로고침을 저장 뒤로 미뤘습니다.",
              "warning",
              0,
            );
          } else {
            await syncAdminLiveData(true, { abortIfDirty: true });
            if (operationsRole() === "admin") await refreshAdminPendingUsers();
          }
        }
      }
      await loadSupabaseLiveStatus();
      if (deferredLiveSync) {
        renderAdminConnectivityStatus(
          true,
          "서버 연결은 복구됐습니다. 작성 중인 내용을 저장하면 최신 운영 자료를 다시 확인합니다.",
          "warning",
          0,
        );
      } else {
        renderAdminConnectivityStatus(true, "서버 연결 복구 완료 · 최신 운영 자료를 확인했습니다.", "online", 3000);
      }
      return true;
    } catch (error) {
      renderAdminConnectivityStatus(
        true,
        "서버 연결을 아직 복구하지 못했습니다. 로그인은 유지되며 다시 연결되면 자동 재시도합니다.",
        "warning",
        0,
      );
      return false;
    }
  })().finally(() => {
    adminConnectionRecoveryPromise = null;
  });
  return adminConnectionRecoveryPromise;
}

function installAdminConnectivityStatus() {
  renderAdminConnectivityStatus(false);
  window.addEventListener("offline", () => renderAdminConnectivityStatus(false));
  window.addEventListener("online", () => {
    void recoverAdminConnection();
  });
  const recoverStaleSession = () => {
    if (
      document.hidden
      || window.TennisNoteDataClient?.isOnline?.() === false
      || !window.TennisNoteDataClient?.getSession?.()?.access_token
      || (operationsAccessReady() && Date.now() - adminAuthLastVerifiedAt < ADMIN_AUTH_RECHECK_STALE_MS)
    ) return;
    void recoverAdminConnection();
  };
  window.addEventListener("focus", recoverStaleSession);
  document.addEventListener("visibilitychange", recoverStaleSession);
}

async function bootstrapAdminOperationsSession() {
  const client = window.TennisNoteDataClient;
  try {
    await client?.consumeOAuthRedirect?.();
  } catch (error) {
    const canRetry = client?.isTransientConnectionError?.(error) || client?.isOnline?.() === false;
    adminImportAuthState.message = canRetry
      ? "네이버 로그인 확인 중 서버 연결이 끊겼습니다. 연결되면 자동으로 이어갑니다."
      : "네이버 로그인 완료 정보를 확인하지 못했습니다. 다시 로그인해 주세요.";
  }
  restoreCachedOperationsIdentity();
  if (client?.getSession?.()?.access_token) {
    adminImportAuthState.loading = true;
    adminImportAuthState.message = "로그인 상태를 확인하고 있습니다.";
  }
  renderOperationsLoginGate();
  try {
    const verified = await refreshAdminImportAuthState();
    if (verified && operationsRole() === "admin") await refreshAdminPendingUsers();
  } finally {
    hideAdminBrandSplash();
  }
}

let scheduleV2IntegrityPreviewState = {
  branchId: "",
  ticketIds: [],
  plannedLessonCount: 0,
  plannedUnits: 0,
};

function resetScheduleV2IntegrityPreview() {
  scheduleV2IntegrityPreviewState = {
    branchId: "",
    ticketIds: [],
    plannedLessonCount: 0,
    plannedUnits: 0,
  };
  const applyButton = $("#scheduleV2IntegrityApplyButton");
  if (applyButton) applyButton.disabled = true;
}

async function previewScheduleV2Integrity() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !client.getSession?.()?.access_token || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 점검할 수 있습니다.");
    return false;
  }
  if (!branchId) {
    showToast("먼저 운영 지점을 선택해 주세요.");
    return false;
  }
  resetScheduleV2IntegrityPreview();
  const checkButton = $("#scheduleV2IntegrityButton");
  const summary = $("#scheduleV2IntegritySummary");
  const list = $("#scheduleV2IntegrityList");
  if (checkButton) checkButton.disabled = true;
  if (summary) summary.textContent = "확인 중";
  if (list) list.textContent = "회원권과 미래 시간표를 서버에서 확인하고 있습니다.";
  try {
    const result = await client.rpc("tn_admin_reconcile_future_regular_schedules", {
      target_branch_id: branchId,
      target_ticket_ids: null,
      target_operation_key: `future-regular-preview-${Date.now()}`,
      target_dry_run: true,
    });
    const rows = Array.isArray(result?.results) ? result.results : [];
    const eligibleRows = rows.filter((row) => (
      row?.eligible === true
      && Number(row.createdCount) > 0
      && Number(row.remainingUnassignedUnits) === 0
      && Number(row.conflictCount) === 0
    ));
    scheduleV2IntegrityPreviewState = {
      branchId,
      ticketIds: eligibleRows.map((row) => String(row.ticketId || "")).filter(Boolean),
      plannedLessonCount: eligibleRows.reduce((sum, row) => sum + Number(row.createdCount || 0), 0),
      plannedUnits: eligibleRows.reduce((sum, row) => sum + Number(row.createdUnits || 0), 0),
    };
    renderScheduleV2IntegrityResult(result, eligibleRows);
    return true;
  } catch (error) {
    if (summary) summary.textContent = "점검 실패";
    if (list) list.textContent = "서버 점검에 실패했습니다. 로그인과 연결 상태를 확인한 뒤 다시 시도해 주세요.";
    resetScheduleV2IntegrityPreview();
    return false;
  } finally {
    if (checkButton) checkButton.disabled = false;
  }
}

async function applyScheduleV2IntegrityPreview() {
  const client = window.TennisNoteDataClient;
  const preview = scheduleV2IntegrityPreviewState;
  if (!client?.rpc || operationsRole() !== "admin" || !preview.ticketIds.length) return false;
  if (preview.branchId !== activeOperationBranchId()) {
    resetScheduleV2IntegrityPreview();
    showToast("운영 지점이 바뀌었습니다. 다시 점검해 주세요.");
    return false;
  }
  const approved = window.confirm(
    `확정 가능한 회원권 ${preview.ticketIds.length}개의 미래 수업 ${preview.plannedLessonCount}건을 생성할까요?\n\n요일·시간 누락과 충돌 항목은 변경하지 않습니다.`,
  );
  if (!approved) return false;
  const applyButton = $("#scheduleV2IntegrityApplyButton");
  if (applyButton) applyButton.disabled = true;
  try {
    const result = await client.rpc("tn_admin_reconcile_future_regular_schedules", {
      target_branch_id: preview.branchId,
      target_ticket_ids: preview.ticketIds,
      target_operation_key: `future-regular-apply-${Date.now()}`,
      target_dry_run: false,
    });
    if (!result?.ok || Number(result.remainingUnassignedUnits) !== 0) {
      throw new Error("future_regular_reconcile_incomplete");
    }
    await syncAdminLiveData(true, { abortIfDirty: true });
    showToast(`미래 수업 ${Number(result.createdCount) || 0}건을 생성했습니다.`);
    await previewScheduleV2Integrity();
    return true;
  } catch (error) {
    showToast("미래 수업을 생성하지 못했습니다. 데이터는 서버에서 다시 확인해 주세요.");
    await previewScheduleV2Integrity();
    return false;
  }
}

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
