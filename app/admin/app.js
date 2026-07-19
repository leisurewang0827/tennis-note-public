const adminQuery = new URLSearchParams(window.location.search);
const adminDemoMode = adminQuery.get("demoAdmin") === "1";
const adminBrandSplashStartedAt = performance.now();
const adminBrandSplashMinimumDuration = 1800;

function hideAdminBrandSplash() {
  const splash = document.querySelector("#adminBrandSplash");
  if (!splash) return;
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
  billingFilter: "action",
  discountView: "policies",
  discountSearch: "",
  discountStatusFilter: "all",
  selectedMemberId: 1,
  activeMode: "admin",
  editingLessonId: null,
  editingOneDayBookingId: null,
  releasedAbsenceEntitlementId: "",
  lessonSourceTouched: false,
  activeAdminWeekIndex: 0,
  adminTaskPage: 0,
  memberStatusPage: 0,
  memberListPage: 0,
  noticeEditingId: "",
  lessonPolicySearch: "",
  selectedScheduleDay: "",
  settingsTab: "operation",
  recordFilter: "pending",
  communityChannel: "홈",
  accountDeletionRequests: [],
  liveScheduleLoaded: false,
  liveScheduleLoading: false,
  liveScheduleMessage: "실서버 시간표 확인 전",
  makeupEntitlements: [],
};

// Keep the last confirmed server schedule locally. A failed or unexpectedly empty
// refresh must never make an already loaded timetable look deleted.
const scheduleSafetySnapshotKey = "tennis-note-admin-schedule-safety-v1";

function persistentScheduleLessons(source = lessons) {
  return (Array.isArray(source) ? source : []).filter((lesson) => (
    lesson?.serverLessonId || lesson?.serverOneDayBookingId
  ));
}

function saveScheduleSafetySnapshot(source = lessons, reason = "refresh") {
  const savedLessons = persistentScheduleLessons(source);
  if (!savedLessons.length) return;
  try {
    localStorage.setItem(scheduleSafetySnapshotKey, JSON.stringify({
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
  lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
  lessonColorRules: [],
  coachWorkPolicyVersion: 2,
};

function makeTimeRange(startTime, endTime, stepMinutes = scheduleBlockMinutes) {
  const times = [];
  for (let current = timeToMinutes(startTime); current <= timeToMinutes(endTime); current += stepMinutes) {
    times.push(minutesToTime(current));
  }
  return times;
}

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

function adminLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

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

function currentScheduleDay() {
  const dayIndex = new Date().getDay();
  return scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1];
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
    if (lesson.day !== day || lesson.status === "cancelled" || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
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
}

function changeAdminWeek(delta) {
  state.activeAdminWeekIndex = Math.min(
    Math.max((Number(state.activeAdminWeekIndex) || 0) + delta, adminScheduleMinWeekOffset),
    adminScheduleMaxWeekOffset,
  );
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
}

function adminWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const dayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
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
}

function adminScheduleMonthValue(week = activeAdminWeek()) {
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
  message: "서버 결제 기록을 아직 불러오지 않았습니다.",
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

const coachOperationsViews = new Set(["members", "schedule", "notes"]);
const operationsRememberStorageKey = "tennis-note-operations-remember-login";

function operationsRole() {
  return String(adminImportAuthState.profile?.role || "");
}

function operationsAccessReady() {
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
    button.hidden = role === "coach" && !coachOperationsViews.has(button.dataset.view);
  });
  $$('[data-admin-only-member-filter]').forEach((button) => {
    button.hidden = role === "coach";
  });
  ["openDataToolsButton", "exportMembersButton", "addMemberButton", "adminPendingUsersPanel"].forEach((id) => {
    const element = $(`#${id}`);
    if (element) element.hidden = role === "coach";
  });
}

function renderOperationsLoginGate() {
  const gate = $("#operationsLoginGate");
  const shell = $("#adminAppShell");
  if (!gate || !shell) return;
  const ready = operationsAccessReady();
  gate.hidden = ready;
  shell.hidden = !ready;
  const message = $("#operationsLoginMessage");
  const logout = $("#operationsLogoutButton");
  const role = operationsRole();
  if (message) {
    message.textContent = ready
      ? `${adminImportAuthState.profile?.name || "사용자"} 계정으로 로그인했습니다.`
      : adminImportAuthState.user && !["admin", "coach"].includes(role)
        ? "이 계정에는 운영 화면 권한이 없습니다."
        : adminImportAuthState.message || "관리자 또는 코치 계정으로 로그인해 주세요.";
  }
  if (logout) logout.hidden = !adminImportAuthState.user;
  const remember = $("#operationsRememberLogin");
  if (remember && !remember.dataset.ready) {
    remember.checked = localStorage.getItem(operationsRememberStorageKey) === "true";
    remember.dataset.ready = "true";
  }
  applyOperationsRolePermissions();
}

const adminPendingUsersState = {
  loading: false,
  loaded: false,
  items: [],
  message: "관리자 로그인 후 신규 가입자를 확인합니다.",
};

const adminLiveDataState = {
  lessons: [],
  users: [],
  coachRoles: [],
  authLinks: [],
  authSwitches: [],
  coachSettlementTerms: [],
  tickets: [],
  products: [],
  participantRows: [],
  makeupEntitlements: [],
  memberDatabaseRecords: [],
  memberMembershipRecords: [],
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

function usesHourlySettlementDefault(coach, existingRule = null) {
  const text = `${coach?.role || ""} ${coach?.availability || ""}`;
  return existingRule?.method === "hourly" || coach?.availability === "weekend" || /주말|대타|보강/.test(text);
}

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
const memberManagementModalState = {
  memberId: null,
  action: "",
  ticketId: "",
  message: "",
  linkCandidates: [],
  linkCandidatesLoading: false,
  linkCandidatesLoadedFor: "",
};
const coachStaffEditorState = {
  coachId: "",
  mode: "edit",
  tab: "basic",
  draft: null,
  workBlocks: [],
  breakBlocks: [],
  message: "",
};
const adminPinHashVersion = "tn-admin-lock-v1";
const legacyDefaultAdminPin = "0000";
const legacyDefaultAdminPinHashes = new Set([
  "sha256:978bb3994627910cf4f1e9625928d86e9e0528bd13fba23620399a4ae7098249",
  "fnv1a:526e18f3",
]);
const defaultAdminLockSettings = {
  enabled: true,
  pinHash: "",
  legacyPin: "",
  pinConfigured: false,
  timeoutMinutes: 10,
  lockedViews: ["billing", "data", "settings"],
};
const adminLockSettings = { ...defaultAdminLockSettings, lockedViews: [...defaultAdminLockSettings.lockedViews] };
let adminSecurityDraft = null;
let adminSecuritySaveState = { status: "idle", savedAt: "" };
const adminLockSession = {
  unlockedUntil: 0,
  pendingView: "",
  error: "",
  afterUnlock: null,
};
const adminLockViewOptions = [
  { id: "billing", label: "결제/정산", detail: "결제 확인, 수동 충전, 코치 정산" },
  { id: "data", label: "엑셀·백업", detail: "엑셀 업로드, 전체 내보내기, 백업" },
  { id: "settings", label: "운영 설정", detail: "수업 정책, 회원권 규정, 관리자 보안" },
  { id: "notes", label: "기록/차감 확인", detail: "수업 완료, 횟수 차감, 코치 코멘트" },
  { id: "members", label: "회원관리", detail: "회원 상세, 회원권 상태, NTRP" },
];
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
const requiredImportColumns = ["회원명", "담당코치", "회원권명", "총횟수", "사용횟수", "잔여횟수"];
const numericImportColumns = ["수업분", "주횟수", "총횟수", "사용횟수", "잔여횟수", "결제금액"];
const dataImportState = {
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

function replaceArray(target, source) {
  if (Array.isArray(source)) target.splice(0, target.length, ...source);
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
  };
}

function serializableAdminLockSettings() {
  const payload = {
    enabled: adminLockSettings.enabled,
    pinHash: adminLockSettings.pinHash,
    pinConfigured: adminLockSettings.pinConfigured,
    timeoutMinutes: adminLockSettings.timeoutMinutes,
    lockedViews: [...adminLockSettings.lockedViews],
  };
  if (!payload.pinHash && adminLockSettings.legacyPin) payload.pin = adminLockSettings.legacyPin;
  return payload;
}

function adminSecurityConfigPayload(source = adminLockSettings) {
  return {
    enabled: Boolean(source.enabled),
    timeoutMinutes: Math.min(Math.max(numericValue(source.timeoutMinutes, 10), 1), 120),
    lockedViews: [...new Set(Array.isArray(source.lockedViews) ? source.lockedViews : [])],
  };
}

function currentAdminSecurityDraft() {
  if (!adminSecurityDraft) adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  return adminSecurityDraft;
}

function resetAdminSecurityDraft() {
  adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  adminSecuritySaveState.status = "idle";
}

function adminSecurityIsDirty() {
  const draft = currentAdminSecurityDraft();
  const saved = adminSecurityConfigPayload();
  return draft.enabled !== saved.enabled
    || draft.timeoutMinutes !== saved.timeoutMinutes
    || draft.lockedViews.length !== saved.lockedViews.length
    || draft.lockedViews.some((view) => !saved.lockedViews.includes(view));
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
  const value = { ...adminSecurityConfigPayload(draft), updatedAt: new Date().toISOString() };
  if (button) button.disabled = true;
  adminSecuritySaveState.status = "saving";
  renderAdminSecurity();
  try {
    await client.rpc("tn_admin_save_security_settings", {
      target_enabled: value.enabled,
      target_timeout_minutes: value.timeoutMinutes,
      target_locked_views: value.lockedViews,
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
  adminLockSession.error = "";
  adminLockSession.afterUnlock = null;
  if (isAdminViewLocked(state.view)) setView("dashboard", { skipLock: true });
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
  adminLockSession.error = "";
  adminLockSession.afterUnlock = typeof afterUnlock === "function" ? afterUnlock : null;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
  return false;
}

function renderAdminLockModal() {
  const message = $("#adminLockMessage");
  const error = $("#adminPinError");
  const input = $("#adminPinInput");
  if (message) {
    message.textContent = `${adminLockViewName(adminLockSession.pendingView)} 화면은 관리자 PIN 확인 후 열 수 있습니다.`;
  }
  if (error) error.textContent = adminLockSession.error || "";
  if (input && !adminLockSession.error) input.value = "";
}

function closeAdminLockModal() {
  $("#adminLockModal")?.setAttribute("hidden", "");
  adminLockSession.pendingView = "";
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
  adminLockSession.unlockedUntil = Date.now() + adminLockSettings.timeoutMinutes * 60000;
  const targetView = adminLockSession.pendingView;
  const callback = adminLockSession.afterUnlock;
  closeAdminLockModal();
  renderAdminSecurity();
  showToast(`관리자 잠금 해제 · ${adminLockSettings.timeoutMinutes}분 유지`);
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
  if (state.view === "reports") state.view = "dashboard";
  if (state.view === "import" || state.view === "data") state.view = "members";
  if (!["operation", "membership", "notifications", "coach", "security"].includes(state.settingsTab)) state.settingsTab = "operation";
  if (!["active", "expiring", "expired", "pending", "journal", "inactive"].includes(state.memberFilter)) state.memberFilter = "active";
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
      scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(snapshot.scheduleSettings.lessonColors || {}) };
      scheduleSettings.lessonColorRules = Array.isArray(snapshot.scheduleSettings.lessonColorRules) ? snapshot.scheduleSettings.lessonColorRules : [];
    }
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

function saveSnapshot() {
  if (state.snapshotStorageUnavailable) return false;
  const snapshot = {
    state,
    coaches,
    members,
    lessons,
    makeupRequests,
    tickets,
    groupAccounts,
    billings,
    billingLogs,
    lessonNotes,
    discountPolicies,
    discountIssueLogs,
    policyVersions,
    lessonPolicies,
    refundPolicySettings,
    holdingPolicySettings,
    notificationPolicySettings,
    newCoachSettlementSettings,
    coachSettlementRules,
    membershipProductDrafts,
    deletedMembershipProductIds,
    membershipProducts: membershipProductsForMemberApp(),
    scheduleSettings,
    adminLockSettings: serializableAdminLockSettings(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    // The local snapshot is a convenience cache only. A full browser storage
    // must never disable the live Supabase schedule connection or save locally.
    state.snapshotStorageUnavailable = true;
    console.warn("Admin snapshot was not saved", error?.name || "storage_error");
    return false;
  }
}

function liveSchedulePolicyPayload() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    scheduleSettings: {
      openStart: scheduleSettings.openStart,
      openEnd: scheduleSettings.openEnd,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : [],
      lessonColors: scheduleSettings.lessonColors,
      lessonColorRules: scheduleSettings.lessonColorRules,
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
    },
    coaches: coaches.map((coach) => ({
      id: coach.id,
      serverRoleId: coach.serverRoleId || "",
      name: coach.name,
      status: coach.status || "active",
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
    const updated = await client.updateRows("tn_admin_settings", { key: liveSchedulePolicyKey }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) {
      await client.insertRows("tn_admin_settings", {
        key: liveSchedulePolicyKey,
        value,
      });
    }
    return "server";
  } catch (error) {
    return "blocked";
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = new Intl.NumberFormat("ko-KR");

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

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

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function sqlLiteral(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
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
  const settlementBase = numericValue(merged.settlementBase, amount);
  const tickets = numericValue(merged.tickets, numericValue(fallback.tickets));
  const cardAmount = numericValue(merged.cardAmount, numericValue(fallback.cardAmount, listAmount || amount));
  const cashAmount = numericValue(merged.cashAmount, numericValue(fallback.cashAmount, settlementBase || amount));
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

function moneyFromLabel(label = "") {
  const number = Number(String(label).replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function billingStatusFromSharedPayment(request = {}) {
  if (String(request.method || "").includes("PortOne 설정 필요")) {
    return { status: "draft", statusLabel: "결제설정대기" };
  }
  if (String(request.method || "").includes("관리자 상담") || String(request.amountLabel || "") === "무료") {
    return { status: "draft", statusLabel: "상담요청" };
  }
  if (String(request.status || "").includes("서버 검증")) {
    return { status: "unverified", statusLabel: "서버검증대기" };
  }
  return { status: "check", statusLabel: "결제확인대기" };
}

function billingStatusFromServerPayment(row = {}) {
  const status = String(row.status || "").toLowerCase();
  const refundStatus = String(row.refund_status || "").toLowerCase();
  if (refundStatus === "processing") return { status: "refund_processing", statusLabel: "환불처리중" };
  if (refundStatus === "reconcile_required") return { status: "refund_reconcile", statusLabel: "환불동기화필요" };
  if (refundStatus === "failed" && status === "verified") return { status: "paid", statusLabel: "환불재확인" };
  if (status === "ready") return { status: "server_ready", statusLabel: "결제준비" };
  if (status === "paid_unverified") return { status: "unverified", statusLabel: "서버검증대기" };
  if (status === "verified") return { status: "paid", statusLabel: "검증완료" };
  if (status === "failed") return { status: "failed", statusLabel: "결제실패" };
  if (status === "cancelled") return { status: "cancelled", statusLabel: "결제취소" };
  if (status === "refunded") return { status: "refunded", statusLabel: "환불완료" };
  return { status: "check", statusLabel: "확인필요" };
}

function paymentEnvironment(item = {}) {
  const haystack = [
    item.environment,
    item.providerPaymentId,
    item.item,
    item.source,
    item.serverStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("test") || haystack.includes("readiness") || haystack.includes("browser_prepare")
    ? "테스트"
    : "실결제";
}

function paymentEnvironmentBadge(item = {}) {
  const label = paymentEnvironment(item);
  return badge(label === "테스트" ? "neutral" : "ready", label);
}

function paymentSourceText(item = {}) {
  const source = item.source || "관리자";
  const status = item.serverStatus ? ` · 서버상태 ${item.serverStatus}` : "";
  return `${source}${status}`;
}

function billingRowFromServerPayment(row = {}) {
  const providerPaymentId = row.provider_payment_id || row.providerPaymentId || row.id || "";
  const { status, statusLabel } = billingStatusFromServerPayment(row);
  const memberName = row.tn_users?.name || row.user?.name || row.member || "서버 결제";
  const amount = Number(row.final_amount || row.finalAmount || row.amount || 0);
  const isTest = paymentEnvironment({
    providerPaymentId,
    item: row.productTitle || row.item || "",
    source: row.source || "",
    serverStatus: row.status,
  }) === "테스트";
  return {
    member: memberName,
    serverUserId: row.user_id || row.userId || "",
    item: isTest ? "브라우저 연결 테스트" : row.productTitle || row.item || "회원앱 결제",
    amount,
    originalAmount: Number(row.original_amount || row.originalAmount || amount || 0),
    settlementBaseAmount: Number(row.settlement_base_amount || row.settlementBaseAmount || amount || 0),
    discountAmount: Number(row.discount_amount || row.discountAmount || 0),
    finalAmount: Number(row.final_amount || row.finalAmount || amount || 0),
    method: row.method || row.provider || "portone",
    status,
    statusLabel,
    providerPaymentId,
    serverPaymentId: row.id || "",
    productId: row.product_id || row.productId || "",
    ticketId: row.ticket_id || row.ticketId || "",
    serverStatus: row.status || "",
    requestedAt: row.created_at || row.createdAt || "",
    paidAt: row.paid_at || row.paidAt || "",
    verifiedAt: row.verified_at || row.verifiedAt || "",
    refundedAmount: Number(row.refunded_amount || row.refundedAmount || 0),
    refundStatus: row.refund_status || row.refundStatus || "none",
    refundReason: row.refund_reason || row.refundReason || "",
    refundBreakdown: row.refund_breakdown || row.refundBreakdown || {},
    refundedAt: row.refunded_at || row.refundedAt || "",
    source: "Supabase 결제",
    environment: isTest ? "테스트" : "실결제",
  };
}

function mergeServerPaymentRows(rows = []) {
  let added = 0;
  let updated = 0;
  rows.forEach((row) => {
    const next = billingRowFromServerPayment(row);
    const existing = billings.find((item) =>
      (next.providerPaymentId && item.providerPaymentId === next.providerPaymentId) ||
      (next.serverPaymentId && item.serverPaymentId === next.serverPaymentId)
    );
    if (existing) {
      Object.assign(existing, { ...existing, ...next });
      updated += 1;
    } else {
      billings.unshift(next);
      added += 1;
    }
  });
  return { added, updated };
}

async function loadServerPaymentsIntoBilling(options = {}) {
  const silent = Boolean(options.silent);
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
    let rows = [];
    try {
      rows = await client.selectRows("tn_payments", {
        select: "id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at,tn_users(name)",
        limit: 30,
      });
    } catch (error) {
      try {
        rows = await client.selectRows("tn_payments", {
          select: "id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at",
          limit: 30,
        });
      } catch (refundSchemaError) {
        rows = await client.selectRows("tn_payments", {
          select: "id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at",
          limit: 30,
        });
      }
    }
    const { added, updated } = mergeServerPaymentRows(Array.isArray(rows) ? rows : []);
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.message = `서버 결제 ${rows.length}건 확인 · 새로 추가 ${added}건 · 갱신 ${updated}건`;
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
  if (Number(product.cardAmount) <= 0 || Number(product.cashAmount) <= 0) return "카드·계좌이체 가격을 모두 입력해야 판매할 수 있습니다.";
  return "";
}

async function updateMembershipProductSetting(productId) {
  const card = document.querySelector(`[data-product-card="${productId}"]`);
  const product = membershipProductDrafts.find((item) => item.id === productId);
  if (!card || !product) return;
  const readField = (field) => card.querySelector(`[data-product-field="${field}"]`)?.value.trim() || "";
  const nextProduct = normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || product.sessions,
    settlementBase: numericValue(readField("settlementBase"), product.settlementBase),
    tickets: numericValue(readField("tickets"), product.tickets),
    cardAmount: numericValue(readField("cardAmount"), product.cardAmount),
    cashAmount: numericValue(readField("cashAmount"), product.cashAmount),
    validityDays: numericValue(readField("validityDays"), product.validityDays),
    graceDays: numericValue(readField("graceDays"), product.graceDays),
    lessonMinutes: numericValue(readField("lessonMinutes"), product.lessonMinutes),
    groupSize: numericValue(readField("groupSize"), product.groupSize),
    frequencyPerWeek: numericValue(readField("frequencyPerWeek"), product.frequencyPerWeek),
    scheduleScope: readField("scheduleScope") || product.scheduleScope,
    productKind: readField("productKind") || product.productKind,
    discountEnabled: readField("discountEnabled") === "yes",
    coachDiscountAllowed: readField("coachDiscountAllowed") === "yes",
    status: readField("status") || product.status,
  }, membershipProductDefaults.find((item) => item.id === product.id));
  if (![20, 30, 40].includes(Number(nextProduct.lessonMinutes))) {
    showToast("수업 시간은 20분, 30분 또는 40분으로 설정해 주세요.");
    return;
  }
  const saleIssue = couponProductSaleIssue(nextProduct);
  if (saleIssue && nextProduct.status === "sale") nextProduct.status = "hidden";
  const client = window.TennisNoteDataClient;
  const serverProduct = serverMembershipProductForDraft(product);
  const saveButton = card.querySelector("[data-save-product-setting]");
  if (!client?.updateRows || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 회원권 상품을 저장해 주세요.");
    return;
  }
  if (!serverProduct?.id) {
    showToast("실서버 상품을 찾지 못했습니다. 새로고침 후 다시 저장해 주세요.");
    return;
  }
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중";
  }
  try {
    const serverKind = nextProduct.productKind === "coupon" ? "coupon" : "regular";
    const updatedRows = await client.updateRows("tn_membership_products", { id: serverProduct.id }, {
      name: nextProduct.title,
      total_sessions: Math.max(1, Number(nextProduct.tickets) || 1),
      base_price: Math.max(0, Number(nextProduct.cashAmount) || 0),
      card_price: Math.max(0, Number(nextProduct.cardAmount) || 0),
      cash_price: Math.max(0, Number(nextProduct.cashAmount) || 0),
      settlement_base_price: Math.max(0, Number(nextProduct.settlementBase) || 0),
      validity_days: Math.max(1, Number(nextProduct.validityDays) || 1),
      grace_days: Math.max(0, Number(nextProduct.graceDays) || 0),
      lesson_minutes: Math.max(10, Number(nextProduct.lessonMinutes) || 20),
      group_size: Math.max(1, Math.min(2, Number(nextProduct.groupSize) || 1)),
      frequency_per_week: Math.max(0, Number(nextProduct.frequencyPerWeek) || 0),
      schedule_scope: ["weekday", "weekend", "mixed"].includes(nextProduct.scheduleScope) ? nextProduct.scheduleScope : "weekday",
      product_kind: serverKind,
      is_coupon: serverKind === "coupon",
      discount_enabled: nextProduct.discountEnabled === true,
      coach_discount_allowed: nextProduct.coachDiscountAllowed === true,
      display_order: Math.max(0, Number(nextProduct.sortOrder) || 0),
      is_active: nextProduct.status !== "hidden",
      policy_settings: {
        ...(serverProduct.policy_settings || {}),
        adminSaleStatus: nextProduct.status,
        countLabel: nextProduct.sessions,
      },
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(updatedRows) || updatedRows.length !== 1) throw new Error("membership_product_write_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => item.id === serverProduct.id);
    if (!saved
      || saved.name !== nextProduct.title
      || Number(saved.total_sessions) !== Number(nextProduct.tickets)
      || Number(saved.lesson_minutes) !== Number(nextProduct.lessonMinutes)
      || Number(saved.group_size) !== Number(nextProduct.groupSize)
      || saved.schedule_scope !== nextProduct.scheduleScope
      || saved.product_kind !== serverKind
      || Number(saved.card_price) !== Number(nextProduct.cardAmount)
      || Number(saved.cash_price) !== Number(nextProduct.cashAmount)
      || Number(saved.settlement_base_price) !== Number(nextProduct.settlementBase)) {
      throw new Error("membership_product_write_not_confirmed");
    }
    saveSnapshot();
    renderServiceReadiness();
    showToast(saleIssue ? `${saleIssue} 판매 상태는 숨김으로 저장했습니다.` : "회원권 상품이 회원 등록 화면까지 반영됐습니다.");
  } catch (error) {
    const raw = `${error?.message || ""}`;
    showToast(raw.includes("admin_live_refresh_failed_after_write")
      ? "상품은 저장됐지만 다시 불러오지 못했습니다. 새로고침해 주세요."
      : "회원권 상품 저장에 실패했습니다. 서버 연결과 관리자 권한을 확인해 주세요.");
  } finally {
    if (saveButton?.isConnected) {
      saveButton.disabled = false;
      saveButton.textContent = "저장";
    }
  }
}

async function createMembershipProductSetting() {
  const client = window.TennisNoteDataClient;
  if (!client?.insertRows || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 새 회원권을 만들 수 있습니다.");
    return;
  }
  const branchId = (adminLiveDataState.products || []).find((item) => item.branch_id)?.branch_id
    || (adminLiveDataState.coachRoles || []).find((item) => item.branch_id)?.branch_id
    || null;
  if (!branchId) {
    showToast("지점 정보를 찾지 못했습니다. 서버 데이터를 새로고침해 주세요.");
    return;
  }
  const button = $("#addMembershipProductButton");
  if (button) {
    button.disabled = true;
    button.textContent = "만드는 중";
  }
  try {
    const productCode = `custom-${Date.now()}`;
    const rows = await client.insertRows("tn_membership_products", {
      branch_id: branchId,
      product_code: productCode,
      name: "새 회원권",
      lesson_minutes: 20,
      frequency_per_week: 1,
      total_sessions: 4,
      group_size: 1,
      product_kind: "regular",
      is_coupon: false,
      is_active: false,
      schedule_scope: "weekday",
      term_weeks: 0,
      validity_days: 35,
      grace_days: 7,
      base_price: 0,
      card_price: 0,
      cash_price: 0,
      settlement_base_price: 0,
      discount_enabled: true,
      coach_discount_allowed: false,
      display_order: Math.max(0, ...membershipProductDrafts.map((item) => Number(item.sortOrder) || 0)) + 10,
      policy_settings: { adminSaleStatus: "hidden", countLabel: "4회" },
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("membership_product_create_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const created = membershipProductDrafts.find((item) => item.serverProductCode === productCode || item.id === productCode);
    renderServiceReadiness();
    const card = created ? document.querySelector(`[data-product-card="${CSS.escape(created.id)}"]`) : null;
    if (card) {
      card.open = true;
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      card.querySelector('[data-product-field="title"]')?.focus();
    }
    showToast("새 회원권을 만들었습니다. 내용을 입력한 뒤 판매 상태를 변경해 주세요.");
  } catch {
    showToast("새 회원권 생성에 실패했습니다. 관리자 권한과 서버 연결을 확인해 주세요.");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = "새 회원권";
    }
  }
}

async function moveMembershipProductSetting(productId, direction) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 회원권 순서를 변경할 수 있습니다.");
    return;
  }
  const currentIndex = membershipProductDrafts.findIndex((item) => item.id === productId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= membershipProductDrafts.length) return;
  const nextOrder = [...membershipProductDrafts];
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
  try {
    await client.rpc("tn_admin_reorder_membership_products", {
      target_branch_id: serverProducts[0].branch_id,
      target_product_ids: serverProducts.map((item) => item.id),
    });
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const savedOrder = (adminLiveDataState.products || [])
      .filter((item) => serverProducts.some((serverProduct) => serverProduct.id === item.id))
      .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0))
      .map((item) => item.id);
    if (savedOrder.join("|") !== serverProducts.map((item) => item.id).join("|")) {
      throw new Error("membership_product_reorder_not_confirmed");
    }
    renderServiceReadiness();
    showToast("회원권 순서를 변경했습니다.");
  } catch {
    showToast("회원권 순서 변경에 실패했습니다. 서버 권한을 확인해 주세요.");
  }
}

function serverMembershipProductForDraft(product = {}) {
  const serverProducts = adminLiveDataState.products || [];
  const idMatch = serverProducts.find((item) => item.id === product.serverProductId);
  if (idMatch) return idMatch;
  const codeMatch = serverProducts.find((item) => item.product_code && item.product_code === product.id);
  if (codeMatch) return codeMatch;
  const nameMatches = serverProducts.filter((item) => item.name === (product.title || product.name));
  return nameMatches.length === 1 ? nameMatches[0] : null;
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
    saveSnapshot();
    if (serverProduct?.id) await syncAdminLiveData();
    renderServiceReadiness();
    showToast("회원권 상품 강제 삭제 완료");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    showToast(raw.includes("tn_admin_force_delete_membership_product") || raw.includes("PGRST202")
        ? "회원권 강제 삭제 DB 패치를 먼저 적용해 주세요."
        : "회원권 상품 강제 삭제에 실패했습니다.");
  }
}

function normalizeRefundPolicySettings(settings = {}) {
  const defaultMemo = "회원 사유 환불은 실납부액에서 할인 전 원가의 10%, 사용 회차의 할인 전 금액, 첫 수업 월 예약금 3만원을 차감합니다.";
  const savedMemo = String(settings.memo || "").trim();
  return {
    penaltyRate: Math.min(10, Math.max(0, numericValue(settings.penaltyRate, 10))),
    calculationBasis: "undiscounted_original_price",
    contractBasis: "sessions",
    reservationFee: Math.max(0, numericValue(settings.reservationFee, 30000)),
    reservationFeeFirstMonthOnly: settings.reservationFeeFirstMonthOnly !== false,
    usedSessionBasis: "undiscounted_per_session",
    consumerDisputeFallbackAdminOnly: settings.consumerDisputeFallbackAdminOnly !== false,
    memo: savedMemo || defaultMemo,
  };
}

async function loadLiveSchedulePolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !adminApprovalReady()) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: liveSchedulePolicyKey },
      limit: 1,
    });
    const value = rows?.[0]?.value;
    if (!value || typeof value !== "object") return false;
    const serverSettings = value.scheduleSettings || {};
    if (serverSettings.openStart) scheduleSettings.openStart = serverSettings.openStart;
    if (serverSettings.openEnd) scheduleSettings.openEnd = serverSettings.openEnd;
    if (Array.isArray(serverSettings.breakRules)) replaceArray(scheduleSettings.breakRules, serverSettings.breakRules);
    scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(serverSettings.lessonColors || {}) };
    scheduleSettings.lessonColorRules = Array.isArray(serverSettings.lessonColorRules) ? serverSettings.lessonColorRules : scheduleSettings.lessonColorRules;
    scheduleSettings.coachWorkPolicyVersion = Number(serverSettings.coachWorkPolicyVersion) || 2;
    (Array.isArray(value.coaches) ? value.coaches : []).forEach((serverCoach) => {
      const coach = coaches.find((item) => (
        (serverCoach.serverRoleId && item.serverRoleId === serverCoach.serverRoleId)
        || item.id === serverCoach.id
        || item.name === serverCoach.name
      ));
      if (!coach) return;
      if (Array.isArray(serverCoach.workBlocks)) coach.workBlocks = serverCoach.workBlocks;
      if (Array.isArray(serverCoach.breakBlocks)) coach.breakBlocks = serverCoach.breakBlocks;
      if (Array.isArray(serverCoach.availableDays)) coach.availableDays = serverCoach.availableDays;
      if (serverCoach.availableStart) coach.availableStart = serverCoach.availableStart;
      if (serverCoach.availableEnd) coach.availableEnd = serverCoach.availableEnd;
      if (serverCoach.color) coach.color = serverCoach.color;
    });
    localStorage.setItem(storageKey, JSON.stringify({
      ...(JSON.parse(localStorage.getItem(storageKey) || "{}")),
      coaches,
      scheduleSettings,
    }));
    return true;
  } catch {
    return false;
  }
}

function postgresDayOfWeek(day) {
  return { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }[day];
}

function dayLabelForPostgres(day) {
  return { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" }[Number(day)] || "";
}

function coachBlocksFromAvailability(rows = [], type = "available") {
  const grouped = new Map();
  rows.filter((item) => item.availability_type === type).forEach((item) => {
    const start = String(item.start_time || "").slice(0, 5);
    const end = String(item.end_time || "").slice(0, 5);
    const label = item.note || (type === "blocked" ? "브레이크" : "근무");
    const key = `${start}|${end}|${label}`;
    const group = grouped.get(key) || { id: item.id, days: [], start, end, label };
    const day = dayLabelForPostgres(item.day_of_week);
    if (day && !group.days.includes(day)) group.days.push(day);
    grouped.set(key, group);
  });
  return [...grouped.values()].map((block) => ({
    ...block,
    days: scheduleDays.filter((day) => block.days.includes(day)),
  }));
}

async function saveLiveSchedulePolicy() {
  const client = window.TennisNoteDataClient;
  const button = $("#saveLiveSchedulePolicyButton");
  if (!adminApprovalReady() || !client?.rpc) {
    showToast("관리자 로그인 후 근무·브레이크를 저장할 수 있습니다.");
    return;
  }
  const serverCoaches = coaches.filter((coach) => coach.serverRoleId);
  if (!serverCoaches.length) {
    showToast("먼저 실제 코치를 등록해주세요.");
    return;
  }
  const branchId = serverCoaches.find((coach) => coach.branchId)?.branchId || null;
  const targetCoaches = serverCoaches.map((coach) => ({
    coachRoleId: coach.serverRoleId,
    workBlocks: (coach.status || "active") === "active" ? [
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
    ] : [],
  }));
  const targetBreakRules = (scheduleSettings.breakRules || []).map((rule) => ({
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
    billingLogs.unshift(`근무·브레이크 서버 저장: 근무 ${result?.availabilityCount || 0}개 · 브레이크 ${result?.breakCount || 0}개`);
    if (snapshotStatus === "server") {
      showToast("근무시간과 브레이크 저장 완료");
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

function lessonPolicyPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: lessonPolicies.map((policy, index) => ({
      ...normalizeLessonPolicy(policy, index),
      order: index,
    })),
  };
}

function reflectLessonPoliciesInActiveVersion() {
  const policy = activePolicyVersion();
  if (!policy) return;
  const rules = lessonPolicies
    .filter((item) => item.status === "active")
    .map((item) => `${item.title}: ${item.detail}`);
  const sectionIndex = policy.sections.findIndex((section) => section.id === "lesson-operation");
  if (!rules.length) {
    if (sectionIndex >= 0) policy.sections.splice(sectionIndex, 1);
    return;
  }
  const nextSection = { id: "lesson-operation", title: "수업 운영", rules };
  if (sectionIndex >= 0) policy.sections.splice(sectionIndex, 1, nextSection);
  else policy.sections.unshift(nextSection);
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

async function persistLessonPolicies(message) {
  lessonPolicies.forEach((policy, index) => {
    policy.order = index;
  });
  reflectLessonPoliciesInActiveVersion();
  saveSnapshot();
  renderLessonPolicySettings();
  renderPolicyVersionSettings();
  const target = await syncLessonPoliciesToServer();
  showToast(target === "server" ? `${message} · 서버 저장 완료` : target === "blocked" ? `${message} · 서버 저장 확인 필요` : `${message} · 로컬 저장 완료`);
}

function renderLessonPolicySettings() {
  const target = $("#lessonPolicyList");
  if (!target) return;
  const search = String(state.lessonPolicySearch || "").trim().toLowerCase();
  const visible = lessonPolicies.filter((policy) => (
    !search || `${policy.title} ${policy.detail} ${policy.category}`.toLowerCase().includes(search)
  ));
  const count = $("#lessonPolicyCount");
  if (count) count.textContent = `${lessonPolicies.filter((item) => item.status === "active").length}/${lessonPolicies.length}개 사용`;
  const searchInput = $("#lessonPolicySearch");
  if (searchInput && searchInput.value !== state.lessonPolicySearch) searchInput.value = state.lessonPolicySearch || "";
  target.innerHTML = visible.length ? visible.map((rawPolicy) => {
    const policyIndex = lessonPolicies.findIndex((item) => item.id === rawPolicy.id);
    const policy = normalizeLessonPolicy(rawPolicy, policyIndex);
    return `
      <details class="lesson-policy-row ${policy.status}" data-lesson-policy-id="${escapeHtml(policy.id)}">
        <summary>
          <span class="lesson-policy-order">${String(policyIndex + 1).padStart(2, "0")}</span>
          <span class="lesson-policy-summary">
            <strong>${escapeHtml(policy.title)}</strong>
            <small>${escapeHtml(policy.category)} · ${escapeHtml(policy.detail)}</small>
          </span>
          ${badge(policy.status === "active" ? "ready" : "neutral", policy.status === "active" ? "사용" : "중지")}
        </summary>
        <div class="lesson-policy-edit-grid">
          <label>
            <small>정책명</small>
            <input type="text" maxlength="60" value="${escapeHtml(policy.title)}" data-lesson-policy-field="title" />
          </label>
          <label>
            <small>분류</small>
            <select data-lesson-policy-field="category">
              ${["수업 변경", "수업 처리", "수업 단위", "출석·차감", "기타"].map((category) => `<option ${policy.category === category ? "selected" : ""}>${category}</option>`).join("")}
            </select>
          </label>
          <label>
            <small>상태</small>
            <select data-lesson-policy-field="status">
              <option value="active" ${policy.status === "active" ? "selected" : ""}>사용</option>
              <option value="inactive" ${policy.status === "inactive" ? "selected" : ""}>중지</option>
            </select>
          </label>
          <label class="lesson-policy-detail-field">
            <small>정책 내용</small>
            <textarea rows="2" maxlength="300" data-lesson-policy-field="detail">${escapeHtml(policy.detail)}</textarea>
          </label>
        </div>
        <div class="lesson-policy-actions">
          <div>
            <button class="icon-button" type="button" title="위로 이동" aria-label="${escapeHtml(policy.title)} 위로 이동" data-move-lesson-policy="${escapeHtml(policy.id)}" data-direction="up" ${policyIndex === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-button" type="button" title="아래로 이동" aria-label="${escapeHtml(policy.title)} 아래로 이동" data-move-lesson-policy="${escapeHtml(policy.id)}" data-direction="down" ${policyIndex === lessonPolicies.length - 1 ? "disabled" : ""}>↓</button>
          </div>
          <div>
            <button class="ghost-button danger-button" type="button" data-delete-lesson-policy="${escapeHtml(policy.id)}">삭제</button>
            <button class="small-button" type="button" data-save-lesson-policy="${escapeHtml(policy.id)}">저장</button>
          </div>
        </div>
      </details>`;
  }).join("") : `<p class="empty-text">${search ? "검색된 수업 정책이 없습니다." : "등록된 수업 정책이 없습니다. 새 정책을 추가해 주세요."}</p>`;
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

async function moveLessonPolicy(policyId, direction) {
  const currentIndex = lessonPolicies.findIndex((item) => item.id === policyId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= lessonPolicies.length) return;
  const [policy] = lessonPolicies.splice(currentIndex, 1);
  lessonPolicies.splice(nextIndex, 0, policy);
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

function activePolicyVersion() {
  return policyVersions.find((policy) => policy.status === "active") || policyVersions[0];
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

function policyVersionPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: policyVersions.map((policy) => normalizePolicyVersion(policy)),
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
  };
}

function discountAvailableCount(policy = {}) {
  return Math.max(0, numericValue(policy.issued, 0) - numericValue(policy.used, 0));
}

function discountAmountForBilling(policy = {}, billing = {}) {
  const base = numericValue(billing.originalAmount, numericValue(billing.amount));
  if (policy.type === "amount") return Math.min(base, numericValue(policy.value));
  return Math.min(base, Math.round(base * (numericValue(policy.value) / 100)));
}

function createDiscountPolicy() {
  const title = $("#discountTitleInput")?.value.trim() || "";
  if (!title) {
    showToast("할인권 이름을 입력해주세요");
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
  });
  discountPolicies.unshift(policy);
  discountIssueLogs.unshift({ id: `discount-log-${Date.now()}`, text: `${policy.title} 생성`, at: new Date().toLocaleDateString("ko-KR") });
  saveSnapshot();
  renderServiceReadiness();
  showToast("할인권 생성 완료");
}

function updateDiscountPolicy(policyId) {
  const card = document.querySelector(`[data-discount-card="${policyId}"]`);
  const policy = discountPolicies.find((item) => item.id === policyId);
  if (!card || !policy) return;
  const readField = (field) => card.querySelector(`[data-discount-field="${field}"]`)?.value.trim() || "";
  Object.assign(policy, normalizeDiscountPolicy({
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
  }));
  saveSnapshot();
  renderServiceReadiness();
  showToast("할인권 저장 완료");
}

function issueDiscountPolicy(policyId) {
  const policy = discountPolicies.find((item) => item.id === policyId);
  if (!policy) return;
  if (policy.status !== "사용") {
    showToast("사용 상태인 할인권만 지급할 수 있습니다");
    return;
  }
  if (policy.coachQuota > 0 && policy.issued >= policy.coachQuota) {
    showToast("코치 지급 수량을 모두 사용했습니다");
    return;
  }
  policy.issued += 1;
  const coachName = coaches.find((coach) => coach.coachMode === "approved")?.name || "코치";
  discountIssueLogs.unshift({ id: `discount-log-${Date.now()}`, text: `${coachName}에게 ${policy.title} 1장 지급`, at: new Date().toLocaleDateString("ko-KR") });
  billingLogs.unshift(`${policy.title} 코치 지급 처리`);
  saveSnapshot();
  renderAll();
  showToast("할인권 지급 완료");
}

function applyDiscountPolicy(policyId) {
  const policy = discountPolicies.find((item) => item.id === policyId);
  if (!policy) return;
  if (policy.status !== "사용") {
    showToast("사용 상태인 할인권만 적용할 수 있습니다");
    return;
  }
  if (discountAvailableCount(policy) <= 0) {
    showToast("먼저 할인권을 지급해주세요");
    return;
  }
  let billing = billings.find((item) => item.status !== "paid");
  if (!billing) {
    const target = tickets.find((ticket) => ticket.remaining <= 1) || tickets[0];
    const product = membershipProductForTicket(target);
    billing = {
      member: target.member,
      item: `${product.title} 결제`,
      amount: product.amount,
      method: "결제요청",
      status: "draft",
      statusLabel: "작성중",
    };
    billings.unshift(billing);
  }
  const originalAmount = numericValue(billing.originalAmount, numericValue(billing.amount));
  const discountAmount = discountAmountForBilling(policy, { ...billing, originalAmount });
  billing.originalAmount = originalAmount;
  billing.discountPolicyId = policy.id;
  billing.discountTitle = policy.title;
  billing.discountAmount = discountAmount;
  billing.amount = Math.max(0, originalAmount - discountAmount);
  billing.method = paymentMethodLabel(billing.method || "결제요청");
  policy.used += 1;
  discountIssueLogs.unshift({ id: `discount-log-${Date.now()}`, text: `${billing.member} ${policy.title} 사용 · ${money.format(discountAmount)}원 할인`, at: new Date().toLocaleDateString("ko-KR") });
  billingLogs.unshift(`${billing.member} ${policy.title} 적용: ${money.format(originalAmount)}원 → ${money.format(billing.amount)}원`);
  saveSnapshot();
  renderAll();
  showToast("할인권 사용 처리 완료");
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

function getCoachName(coachId) {
  return coaches.find((coach) => coach.id === coachId)?.name || "미배정";
}

function getCoachAvailabilityLabel(coachId) {
  const labels = {
    full: "하루종일",
    split: "오전+저녁",
    "weekday-am": "평일 오전",
    "weekday-pm": "평일 오후",
    weekend: "주말 전담",
  };
  const coach = coaches.find((item) => item.id === coachId);
  return labels[coach?.availability] || "시간 협의";
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

function getCoachBreakOverlapping(coachId, day, time, durationMinutes = 20) {
  const coach = coaches.find((item) => item.id === coachId);
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

function getCoachAvailabilityDetail(coachId) {
  const coach = coaches.find((item) => item.id === coachId);
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

function getCoachAvailabilitySummary(coachId) {
  const coach = coaches.find((item) => item.id === coachId);
  const blocks = normalizeCoachWorkBlocks(coach);
  if (blocks.length) {
    return blocks.map((block) => `${block.days.join("")} ${block.start}~${block.end}`).join(" / ");
  }
  const detail = getCoachAvailabilityDetail(coachId);
  return `${detail.days.join(", ")} ${detail.start}~${detail.end}`;
}

function scheduleBreakSummaryForDay(day) {
  const rules = scheduleSettings.breakRules.filter((rule) => rule.days?.includes(day));
  if (!rules.length) return "브레이크 없음";
  return rules.map((rule) => `${rule.label || "브레이크"} ${rule.start}~${rule.end}`).join(" / ");
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

function renderSchedulePolicyPreview() {
  const target = $("#schedulePolicyPreview");
  if (!target) return;
  const compactDays = ["월", "화", "토"];
  target.innerHTML = `
    <article>
      <strong>표시 기준</strong>
      <span>회원앱/코치앱 기본은 수업근처만 표시합니다. 오전·오후·저녁·전체는 필요할 때 눌러 확인합니다.</span>
    </article>
    <article>
      <strong>운영 시간</strong>
      <span>${scheduleSettings.openStart}~${scheduleSettings.openEnd} · 10분 단위 표시 · 20/30분 수업 전체 시간으로 충돌 검사</span>
    </article>
    ${compactDays
      .map((day) => `
        <article>
          <strong>${day}요일</strong>
          <span>${scheduleCoachSummaryForDay(day)}</span>
          <small>${scheduleBreakSummaryForDay(day)}</small>
        </article>`)
      .join("")}`;
}

function setCoachWorkBlocks(coachId, workBlocks) {
  const coach = coaches.find((item) => item.id === coachId);
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

function upsertBreakRule(id, days, start, end, label = "브레이크") {
  scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => rule.id !== id);
  scheduleSettings.breakRules.push({ id, days, start, end, label });
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

function isCoachAvailableForSlot(coachId, day, time, durationMinutes = 20) {
  const coach = coaches.find((item) => item.id === coachId);
  const blocks = normalizeCoachWorkBlocks(coach);
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  return !getCoachBreakOverlapping(coachId, day, time, durationMinutes)
    && blocks.some((block) => block.days.includes(day) && start >= timeToMinutes(block.start) && end <= timeToMinutes(block.end));
}

function getCoachTimeOptions(coachId, day, durationMinutes = 20) {
  return getScheduleTimeOptions().filter((time) => isCoachAvailableForSlot(coachId, day, time, durationMinutes));
}

function getCourtLabel(courtId) {
  return courtId?.replace("court-", "코트 ") || "코트 미정";
}

function getCourtOptions() {
  return Array.from({ length: fixedCourtCount }, (_, index) => {
    const id = `court-${index + 1}`;
    return { value: id, label: `${index + 1}번 코트` };
  });
}

function getCoachToneClass(coachId) {
  const toneByCoach = {
    "coach-no": "coach-tone-green",
    "coach-kang": "coach-tone-blue",
    "coach-hwang": "coach-tone-amber",
    "coach-machine": "coach-tone-slate",
  };
  return toneByCoach[coachId] || "coach-tone-red";
}

function lessonUnitLabel(durationMinutes) {
  if (durationMinutes === 20) return "20분권 1회";
  if (durationMinutes === 30) return "30분권 1회";
  if (durationMinutes === 40) return "20분권 2회 연속";
  if (durationMinutes === 60) return "30분권 2회 연속";
  return "관리자 확인 필요";
}

function lessonTypeLabel(lesson) {
  return `${lesson.type} ${lesson.durationMinutes}분 · ${lessonUnitLabel(lesson.durationMinutes)}`;
}

function getTicketByLesson(lesson) {
  if (!lesson) return null;
  if (lesson.ticketId) return tickets.find((item) => item.id === lesson.ticketId);
  return tickets.find((item) => item.member === lesson.member && item.coachId === lesson.coachId && item.product?.includes(lesson.type)) ||
    tickets.find((item) => item.member === lesson.member && item.coachId === lesson.coachId);
}

function lessonTicketUnits(lesson, ticket) {
  const lessonMinutes = Math.max(1, Number(lesson?.durationMinutes) || 20);
  const ticketMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  return Math.max(1, Math.ceil(lessonMinutes / ticketMinutes));
}

function lessonRoundSortKey(lesson) {
  const dayIndex = Math.max(0, scheduleDays.indexOf(lesson?.day));
  const dateKey = lesson?.lessonDate || `9999-12-${String(dayIndex + 1).padStart(2, "0")}`;
  const timeKey = String(lesson?.time || "00:00").padStart(5, "0");
  return `${dateKey}T${timeKey}:${String(lesson?.id || "")}`;
}

function isDeductedLesson(lesson) {
  const status = lesson?.serverStatus || lesson?.status || "";
  return ["completed", "no_show"].includes(status) || (!lesson?.serverStatus && lesson?.status === "confirmed");
}

function lessonRoundRange(lesson, ticket) {
  const ticketLessons = lessons
    .filter((item) => {
      if (!isBookedLesson(item) || ["cancelled", "available"].includes(item?.serverStatus || item?.status)) return false;
      return getTicketByLesson(item)?.id === ticket.id;
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
  if (isReleasedRegularMakeupSlot(lesson)) return "";
  if (!isBookedLesson(lesson)) return "";
  const ticket = getTicketByLesson(lesson);
  if (!ticket) return "회차 확인";
  const range = lessonRoundRange(lesson, ticket);
  const round = range.first === range.last ? `${range.first}` : `${range.first}~${range.last}`;
  return `${round}/${ticket.total}회차`;
}

function isMakeupLesson(lesson) {
  return lesson.lessonSource === "makeup" || lesson.type?.includes("보강") || lesson.type?.includes("대리") || lesson.makeup === true;
}

function isReleasedRegularMakeupSlot(lesson) {
  return Boolean(lesson?.releasedMakeupSlot);
}

function getLessonStatusLabel(lesson) {
  if (lesson?.oneDayBooking) {
    if (lesson.serverStatus === "completed") return "원데이 완료";
    if (lesson.serverStatus === "checked_in") return "방문";
    return "원데이 예약";
  }
  if (isReleasedRegularMakeupSlot(lesson)) return "정규자리 · 보강 가능";
  if (lesson.serverStatus === "completed" || lesson.status === "completed") return "완료";
  if (lesson.serverStatus === "no_show" || lesson.status === "no_show") return "당일 취소";
  if (lesson.status === "available") return "보강 가능";
  if (isMakeupLesson(lesson) && lesson.status === "pending") return "보강접수중";
  if (isMakeupLesson(lesson)) return "보강";
  if (lesson.status === "pending") return "승인 필요";
  if (lesson.status === "confirmed") return "확정";
  return "예정";
}

function getLessonStateClass(lesson) {
  if (isReleasedRegularMakeupSlot(lesson)) return "status-released-makeup";
  if (isMakeupLesson(lesson) && lesson.status === "pending") return "status-makeup-pending";
  if (isMakeupLesson(lesson)) return "status-makeup";
  if (lesson.status === "pending") return "status-pending";
  return "";
}

function lessonVisualKind(lesson) {
  if (["no_show", "cancelled_late"].includes(String(lesson?.serverStatus || lesson?.status || "").toLowerCase())) return "noShow";
  if (lesson?.oneDayBooking) return "coupon";
  if (isReleasedRegularMakeupSlot(lesson)) return "released";
  if (isMakeupLesson(lesson)) return "makeup";
  if (lesson.lessonSource === "coupon") return "coupon";
  const customRule = (scheduleSettings.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  if (customRule) return customRule.id;
  if (Number(lesson.durationMinutes) === 30) return "regular30";
  const ticket = getTicketByLesson(lesson);
  const productKind = ticket ? membershipProductForTicket(ticket).productKind : "regular";
  return ["pass", "coupon"].includes(productKind) ? "coupon" : "regular";
}

function lessonColorStyle(lesson) {
  const kind = lessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const customColor = (scheduleSettings.lessonColorRules || []).find((rule) => rule.id === kind)?.color;
  const saved = customColor || scheduleSettings.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function durationTone(lesson) {
  if (isReleasedRegularMakeupSlot(lesson)) return "available";
  if (lesson.status === "available") return "available";
  if (isMakeupLesson(lesson)) return "makeup";
  if (lesson.durationMinutes === 40 || lesson.durationMinutes === 60) return "stacked";
  if (lesson.durationMinutes >= 30) return "half";
  return "short";
}

function durationBadge(lesson) {
  const stackedLabel = lesson.durationMinutes === 40 ? "20분x2" : lesson.durationMinutes === 60 ? "30분x2" : `${lesson.durationMinutes}분`;
  return `<b class="duration-pill ${durationTone(lesson)}">${stackedLabel}</b>`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function findLesson(day, time) {
  return lessons.find((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function findLessons(day, time) {
  return lessons.filter((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function isBookedLesson(lesson) {
  return lesson.status !== "available" || isReleasedRegularMakeupSlot(lesson);
}

function lessonInterval(lesson) {
  const start = timeToMinutes(lesson.time);
  return {
    start,
    end: start + lesson.durationMinutes,
  };
}

function intervalsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function getLessonConflict(candidate) {
  if (!candidate.day || !candidate.time) return { lesson: null, message: "선택 가능한 수업 시간이 없습니다." };
  const candidateInterval = lessonInterval(candidate);
  const breakRule = getBreakRuleOverlapping(candidate.day, candidate.time, candidate.durationMinutes);
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
      lesson.id !== candidate.id
      && !(
        replacementTicket
        && String(lesson.ticketId || "") === String(replacementTicket.id)
        && normalizeLessonSource(lesson.lessonSource) === "regular"
        && lesson.serverStatus === "scheduled"
      )
    ));
  const releasedRegularSlot = allOverlappingBooked.find((lesson) => (
    isReleasedRegularMakeupSlot(lesson) && lesson.coachId === candidate.coachId
  ));
  if (releasedRegularSlot && normalizeLessonSource(candidate.lessonSource) !== "makeup") {
    return {
      lesson: releasedRegularSlot,
      message: "불참으로 비워진 정규자리입니다. 이 시간에는 보강수업만 등록할 수 있습니다.",
    };
  }
  const overlappingBooked = allOverlappingBooked.filter((lesson) => !isReleasedRegularMakeupSlot(lesson));
  const coachConflict = overlappingBooked.find((lesson) => lesson.coachId === candidate.coachId);
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}가 같은 시간에 이미 수업 중입니다.` };
  }
  const courtConflict = overlappingBooked.find((lesson) => lesson.courtId === candidate.courtId);
  if (courtConflict) {
    return { lesson: courtConflict, message: `${getCourtLabel(candidate.courtId)}가 같은 시간에 이미 사용 중입니다.` };
  }
  if (overlappingBooked.length >= fixedCourtCount) {
    return { lesson: overlappingBooked[0], message: `현재 코트 ${fixedCourtCount}개가 모두 사용 중입니다.` };
  }
  return null;
}

function getOverlappingBookedLessons(day, time, durationMinutes = 20) {
  const interval = {
    start: timeToMinutes(time),
    end: timeToMinutes(time) + durationMinutes,
  };
  const targetDate = state.liveScheduleLoaded ? adminWeekDateForDay(day) : "";
  return lessons.filter((lesson) => (
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
  if (isBreakOverlapping(day, time, durationMinutes)) return [];
  const usedCoachIds = new Set(getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson))
    .map((lesson) => lesson.coachId));
  return coaches.filter((coach) => (
    coach.status === "active" &&
    !usedCoachIds.has(coach.id) &&
    isCoachAvailableForSlot(coach.id, day, time, durationMinutes)
  ));
}

function getAvailableCoachId(day, time, durationMinutes = 20, preferredCoachId = "") {
  const availableCoaches = getAvailableCoachesForSlot(day, time, durationMinutes);
  if (preferredCoachId && availableCoaches.some((coach) => coach.id === preferredCoachId)) return preferredCoachId;
  return availableCoaches[0]?.id
    || coaches.find((coach) => coach.status === "active")?.id
    || "coach-no";
}

function hasCourtCapacity(day, time, durationMinutes = 20) {
  return getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson)).length < fixedCourtCount;
}

function canAddLessonAt(day, time, durationMinutes = 20, preferredCoachId = "") {
  if (isBreakOverlapping(day, time, durationMinutes)) return false;
  if (!hasCourtCapacity(day, time, durationMinutes)) return false;
  if (preferredCoachId) return getAvailableCoachesForSlot(day, time, durationMinutes).some((coach) => coach.id === preferredCoachId);
  return getAvailableCoachesForSlot(day, time, durationMinutes).length > 0;
}

function getBreakRuleForSlot(day, time) {
  const current = timeToMinutes(time);
  return scheduleSettings.breakRules.find((rule) => {
    if (!rule.days?.includes(day)) return false;
    return current >= timeToMinutes(rule.start) && current < timeToMinutes(rule.end);
  });
}

function getBreakRuleOverlapping(day, time, durationMinutes = 20) {
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  return scheduleSettings.breakRules.find((rule) => {
    if (!rule.days?.includes(day)) return false;
    const ruleStart = timeToMinutes(rule.start);
    const ruleEnd = timeToMinutes(rule.end);
    return start < ruleEnd && ruleStart < end;
  });
}

function isBreakSlot(day, time) {
  return Boolean(getBreakRuleForSlot(day, time));
}

function isBreakOverlapping(day, time, durationMinutes = 20) {
  return Boolean(getBreakRuleOverlapping(day, time, durationMinutes));
}

function lessonAddAttrs(day, time, durationMinutes = 20, preferredCoachId = "") {
  const coachId = getAvailableCoachId(day, time, durationMinutes, preferredCoachId);
  return `data-add-lesson-day="${day}" data-add-lesson-time="${time}" data-add-lesson-court="${getAvailableCourtId(day, time, durationMinutes)}" data-add-lesson-coach="${coachId}"`;
}

function getScheduleTimeOptions() {
  return getVisibleScheduleTimes();
}

function findLessonStartingInBlock(day, blockStart, blockEnd) {
  return lessons.find((lesson) => {
    const starts = timeToMinutes(lesson.time);
    return lesson.day === day && lessonMatchesActiveScheduleWeek(lesson, day) && starts > blockStart && starts < blockEnd;
  });
}

function getScheduleCoachLanes(day = "") {
  const preferredOrder = ["coach-no", "coach-kang", "coach-hwang", "coach-park", "coach-machine"];
  const activeCoaches = coaches.filter((coach) => coach.status === "active");
  const orderedCoaches = preferredOrder.map((coachId) => activeCoaches.find((coach) => coach.id === coachId)).filter(Boolean);
  const extraCoaches = activeCoaches.filter((coach) => !preferredOrder.includes(coach.id));
  const lanes = orderedCoaches.concat(extraCoaches);
  if (!day) return lanes;
  return lanes.filter((coach) => (
    normalizeCoachWorkBlocks(coach).some((block) => block.days.includes(day)) ||
    lessons.some((lesson) => lesson.day === day && lesson.coachId === coach.id && lessonMatchesActiveScheduleWeek(lesson, day) && isBookedLesson(lesson))
  ));
}

function findStartingLessonForCoach(day, time, coachId) {
  return lessons.find((lesson) => lesson.day === day && lesson.time === time && lesson.coachId === coachId && lessonMatchesActiveScheduleWeek(lesson, day) && isBookedLesson(lesson));
}

function findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coachId) {
  return lessons.find((lesson) => {
    const starts = timeToMinutes(lesson.time);
    return lesson.day === day && lesson.coachId === coachId && lessonMatchesActiveScheduleWeek(lesson, day) && starts > blockStart && starts < blockEnd;
  });
}

function findOccupyingLessonForCoach(day, time, coachId) {
  const current = timeToMinutes(time);
  return lessons.find((lesson) => {
    if (lesson.day !== day || lesson.time === time || lesson.coachId !== coachId || !lessonMatchesActiveScheduleWeek(lesson, day) || !isBookedLesson(lesson)) return false;
    const starts = timeToMinutes(lesson.time);
    const ends = starts + lesson.durationMinutes;
    return current > starts && current < ends;
  });
}

function findOccupyingLesson(day, time) {
  const current = timeToMinutes(time);
  return lessons.find((lesson) => {
    if (lesson.day !== day || lesson.time === time || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
    const starts = timeToMinutes(lesson.time);
    const ends = starts + lesson.durationMinutes;
    return current > starts && current < ends;
  });
}

function badge(status, label) {
  const map = {
    active: "good",
    expired: "neutral",
    waitlist: "neutral",
    attention: "danger",
    setup: "warn",
    ready: "good",
    blocked: "danger",
    scheduled: "neutral",
    available: "good",
    pending: "warn",
    server_ready: "warn",
    unverified: "warn",
    requested: "warn",
    coach_required: "danger",
    confirmed: "good",
    paid: "good",
    check: "warn",
    draft: "neutral",
    failed: "danger",
    cancelled: "neutral",
    refunded: "neutral",
    good: "good",
    warn: "warn",
    danger: "danger",
    neutral: "neutral",
  };
  return `<span class="badge ${map[status] || "neutral"}">${label}</span>`;
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
}

function closeAdminToolsModal() {
  $("#adminToolsModal")?.setAttribute("hidden", "");
}

function setView(view, options = {}) {
  if (!operationsAccessReady()) {
    renderOperationsLoginGate();
    return;
  }
  if (view === "makeup") view = "schedule";
  if (view === "reports") view = "dashboard";
  if (!$(`#${view}View`)) view = "dashboard";
  if (!operationsViewAllowed(view)) {
    view = operationsRole() === "coach" ? "schedule" : "dashboard";
    showToast("현재 계정에서 사용할 수 없는 메뉴입니다.");
  }
  if (!options.skipLock && !requestAdminUnlock(view)) return;
  const enteringSchedule = view === "schedule" && state.view !== "schedule";
  state.view = view;
  if (view === "schedule" && (enteringSchedule || !scheduleSessionInitialized)) resetScheduleEntryState();
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.remove("is-active"));
  $(`#${view}View`).classList.add("is-active");
  const titles = {
    dashboard: "대시보드",
    members: "회원관리",
    schedule: "레슨시간표",
    billing: "결제/정산",
    notes: "기록/차감 확인",
    settings: "운영 설정",
  };
  $("#viewTitle").textContent = titles[view];
  if (enteringSchedule) renderSchedule();
  if (view === "billing" && !serverPaymentSyncState.loading) {
    loadServerPaymentsIntoBilling();
  }
  if (enteringSchedule && state.liveScheduleLoaded && !state.liveScheduleLoading) {
    refreshAdminLiveSchedule({ render: false })
      .then((synced) => {
        if (synced && state.view === "schedule") renderSchedule();
      })
      .catch(() => false);
  }
}

function openSettingsWorkspace(tab) {
  if (!requestAdminUnlock("settings", () => openSettingsWorkspace(tab))) return;
  state.settingsTab = tab;
  setView("settings", { skipLock: true });
  renderSettingsTabs();
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

function globalSearchItems() {
  const navigationItems = [
    { kind: "메뉴", title: "대시보드", detail: "오늘 수업과 운영 처리 현황", view: "dashboard" },
    { kind: "메뉴", title: "회원관리", detail: "수강중·승인대기·만료 회원", view: "members" },
    { kind: "메뉴", title: "레슨시간표", detail: "코치별 수업과 보강·변경 요청", view: "schedule" },
    { kind: "메뉴", title: "결제/정산", detail: "결제 상태와 코치 정산", view: "billing" },
    { kind: "메뉴", title: "기록/차감 확인", detail: "수업 코멘트·커리큘럼·횟수 처리", view: "notes" },
    { kind: "메뉴", title: "운영 설정", detail: "수업 정책·회원권 규정·관리자 보안", view: "settings" },
  ];
  const memberItems = members.map((member) => ({
    kind: "회원",
    title: member.name,
    detail: `${memberStatusLabel(member)} · ${member.coach} · ${member.regularTime} · ${member.lessonType}`,
    view: "members",
    memberId: member.id,
  }));
  const coachItems = coaches.map((coach) => ({
    kind: "코치",
    title: coach.name,
    detail: `${coach.role} · ${coachModeLabel(coach)} · ${coach.status === "active" ? "운영중" : "사용중지"}`,
    view: "members",
  }));
  const lessonItems = lessons.map((lesson) => ({
    kind: "수업",
    title: `${lesson.day}요일 ${lesson.time} · ${lesson.member}`,
    detail: `${getCoachName(lesson.coachId)} · ${lessonTypeLabel(lesson)} · ${getLessonStatusLabel(lesson)}`,
    view: "schedule",
  }));
  const makeupItems = makeupRequests.map((request) => ({
    kind: "변경요청",
    title: request.member,
    detail: `${request.original} → ${request.requested} · ${request.statusLabel}`,
    view: "schedule",
  }));
  const billingItems = billings.map((billing) => ({
    kind: "결제",
    title: billing.member,
    detail: `${billing.item} · ${billing.method} · ${billing.status}`,
    view: "billing",
  }));
  const ticketItems = tickets.map((ticket) => {
    const member = members.find((item) => item.name === ticket.member);
    return {
      kind: "회원권",
      title: ticket.member,
      detail: `${getTicketDisplayProduct(ticket)} · 잔여 ${ticket.remaining}회 · ${ticket.expires || "만료일 미정"}`,
      view: "members",
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

function renderGlobalSearchResults() {
  const input = $("#globalSearch");
  const target = $("#globalSearchResults");
  if (!input || !target) return;
  const query = input.value.trim();
  input.setAttribute("aria-expanded", query ? "true" : "false");
  target.hidden = !query;
  if (!query) {
    target.innerHTML = "";
    return;
  }

  const results = getGlobalSearchResults(query);
  target.innerHTML = results.length
    ? results
        .map(
          (item) => `
            <button class="global-search-result" type="button" role="option" data-global-search-result data-search-view="${item.view}" ${item.memberId ? `data-search-member-id="${item.memberId}"` : ""} ${item.settingsTab ? `data-search-settings-tab="${item.settingsTab}"` : ""}>
              <span>${escapeHtml(item.kind)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </button>`,
        )
        .join("")
    : `<div class="global-search-empty" role="status">
        <strong>검색 결과가 없습니다.</strong>
        <span>이름, 코치, 요일·시간 또는 상태를 다시 확인해 주세요.</span>
      </div>`;
}

function clearGlobalSearch() {
  const input = $("#globalSearch");
  if (input) input.value = "";
  renderGlobalSearchResults();
}

function adminTodayLessonRows() {
  if (adminDemoMode) return lessons;
  const today = adminLocalDateKey(new Date());
  return lessons.filter((lesson) => lesson.lessonDate === today);
}

function renderMetrics() {
  const recordGroups = adminRecordGroups();
  const todayLessonCount = adminTodayLessonRows().length;
  const pendingScheduleCount = lessons.filter((lesson) => isPendingScheduleLesson(lesson)).length;
  $("#metricLessons").textContent = todayLessonCount;
  $("#metricMakeups").textContent = makeupRequests.filter((item) => ["pending", "requested", "coach_required"].includes(item.status)).length;
  $("#metricNotes").textContent = recordGroups.pending.length + recordGroups.feedback.length + recordGroups.issue.length;
  $("#metricBilling").textContent = billings.filter((item) => item.status !== "paid").length;
  if ($("#scheduleMetricToday")) $("#scheduleMetricToday").textContent = `${todayLessonCount}회`;
  if ($("#scheduleMetricPending")) $("#scheduleMetricPending").textContent = `${pendingScheduleCount}건`;
}

function renderCourtControls() {
  const label = $("#courtCountLabel");
  if (label) label.textContent = fixedCourtCount;
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

function ticketHasFutureRegularLesson(ticket, today = adminLocalDateKey(new Date())) {
  return lessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    const status = lesson.serverStatus || lesson.status || "scheduled";
    if (["available", "cancelled", "completed", "no_show"].includes(status)) return false;
    return normalizeLessonSource(lesson.lessonSource) === "regular";
  });
}

function ticketNeedsRegularSchedule(ticket, today = adminLocalDateKey(new Date())) {
  return isRegularScheduleTicket(ticket, today) && !ticketHasFutureRegularLesson(ticket, today);
}

function unassignedRegularTickets() {
  const regularTickets = tickets.filter((ticket) => isRegularScheduleTicket(ticket));
  const candidates = regularTickets
    .filter((ticket) => !ticketHasFutureRegularLesson(ticket))
    .sort((left, right) => ticketParticipantNames(right).length - ticketParticipantNames(left).length);
  const selected = [];

  candidates.forEach((ticket) => {
    const participantNames = ticketParticipantNames(ticket).sort();
    const startsOn = ticket.starts || ticket.purchased || "";
    const contextKey = [ticket.coachId || "", ticket.product || "", startsOn, ticket.expires || ""].join("::");
    const assignedAliasExists = regularTickets.some((other) => {
      if (other === ticket || !ticketHasFutureRegularLesson(other)) return false;
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

function isActiveCouponTicket(ticket, today = adminLocalDateKey(new Date())) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  const startsOn = ticket.starts || ticket.purchased || "";
  if (startsOn && startsOn > today) return false;
  if (ticket.expires && ticket.expires < today) return false;
  const productKind = String(ticket.productKind || membershipProductForTicket(ticket).productKind || "").toLowerCase();
  return productKind === "pass" || productKind === "coupon" || String(ticket.product || "").includes("쿠폰");
}

function ticketHasUpcomingLesson(ticket, today = adminLocalDateKey(new Date())) {
  return lessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    const status = lesson.serverStatus || lesson.status || "scheduled";
    return !["available", "cancelled", "completed", "no_show", "confirmed"].includes(status);
  });
}

function couponTicketsWithoutUpcomingLesson() {
  const candidates = tickets
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

function renderDashboard() {
  $("#todayLessons").innerHTML = adminTodayLessonRows()
    .slice(0, 5)
    .map(
      (lesson) => `
        <article class="lesson-item duration-${durationTone(lesson)}">
          <div class="time-chip">${lesson.time}</div>
          <div>
            <strong>${lesson.member}</strong>
            <span>${lesson.day}요일 · ${getCoachName(lesson.coachId)} · ${lessonTypeLabel(lesson)}</span>
          </div>
          ${durationBadge(lesson)}
          ${badge(lesson.status, getLessonStatusLabel(lesson))}
        </article>`,
    )
    .join("");

  const pendingMakeupCount = makeupRequests.filter((item) => ["pending", "requested", "coach_required"].includes(item.status)).length;
  const lowTicketCount = tickets.filter((ticket) => ticket.remaining <= 2).length;
  const pendingRecordCount = adminRecordGroups().pending.length + adminRecordGroups().issue.length;
  const pendingPaymentCount = billings.filter((item) => !["paid", "cancelled", "refunded"].includes(item.status)).length;
  const unassignedRegularCount = unassignedRegularTickets().length;
  const couponNoBookingCount = couponTicketsWithoutUpcomingLesson().length;
  const reportTarget = $("#dashboardReportSummary");
  if (reportTarget) {
    const recordGroups = adminRecordGroups();
    const liveReportMetrics = [
      { label: "활성 회원", value: `${members.filter((member) => member.status === "active").length}명`, detail: "실서버 회원권 기준", tone: "" },
      { label: "현재 주 수업", value: `${lessons.length}개`, detail: "실서버 레슨표 기준", tone: "calm" },
      { label: "완료 기록", value: `${recordGroups.done.length}건`, detail: `확인 필요 ${recordGroups.pending.length + recordGroups.issue.length}건`, tone: "warning" },
      { label: "활성 코치", value: `${coaches.filter((coach) => coach.status === "active").length}명`, detail: "승인된 코치 권한 기준", tone: "accent" },
    ];
    reportTarget.innerHTML = (adminDemoMode ? reportMetrics.slice(0, 4) : liveReportMetrics)
      .map(
        (item) => `
          <article>
            <span>${item.label}</span>
            <strong>${item.value}</strong>
            <small>${item.detail}</small>
          </article>`,
      )
      .join("");
  }
  renderDashboardNoticeSummary();
}

function renderDashboardNoticeSummary() {
  const target = $("#dashboardNoticeSummary");
  if (!target) return;
  const notice = currentPopupNotice();
  const lessonAlerts = [
    notificationPolicySettings.lessonDayBeforeEnabled,
    notificationPolicySettings.lesson30MinutesEnabled,
  ].filter(Boolean).length;
  const membershipAlerts = [
    notificationPolicySettings.couponNextBookingEnabled,
    notificationPolicySettings.ticketLowRemainingEnabled,
    notificationPolicySettings.ticketExpiryEnabled,
    notificationPolicySettings.ticketExpiredEnabled,
  ].filter(Boolean).length;
  const deliveryReady = ["ready", "limited"].includes(notificationDeliveryState.status);
  const deliveryLabel = deliveryReady
    ? `대기 ${notificationDeliveryState.queued} · 오류 ${notificationDeliveryState.failed}`
    : notificationDeliveryState.message;

  target.innerHTML = `
    <div class="dashboard-notification-summary-row">
      <div>
        <span>공지 팝업</span>
        <strong>${notice.status === "active" ? "노출중" : "꺼짐"}</strong>
        <small>${escapeHtml(notice.status === "active" ? notice.title : "현재 노출 공지 없음")}</small>
      </div>
      ${badge(notice.status === "active" ? "ready" : "neutral", notice.status === "active" ? "ON" : "OFF")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>수업 알림</span>
        <strong>${lessonAlerts}/2 켜짐</strong>
        <small>하루 전 · 30분 전</small>
      </div>
      ${badge(lessonAlerts === 2 ? "ready" : lessonAlerts ? "pending" : "neutral", lessonAlerts ? "사용" : "꺼짐")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>회원권 알림</span>
        <strong>${membershipAlerts}/4 켜짐</strong>
        <small>쿠폰 미예약 · 잔여 ${notificationPolicySettings.lowRemainingThreshold}회 · 만료 ${notificationPolicySettings.expiryDaysBefore}일 전 · 만료일</small>
      </div>
      ${badge(membershipAlerts === 4 ? "ready" : membershipAlerts ? "pending" : "neutral", membershipAlerts ? "사용" : "꺼짐")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>발송 현황</span>
        <strong>${escapeHtml(deliveryLabel)}</strong>
        <small>${notificationDeliveryState.sentToday ? `오늘 ${notificationDeliveryState.sentToday}건 발송` : notificationDeliveryState.message}</small>
      </div>
      ${badge(notificationDeliveryState.failed ? "danger" : deliveryReady ? "ready" : "pending", notificationDeliveryState.failed ? "확인" : deliveryReady ? "정상" : "대기")}
    </div>`;
}

function getAdminTasks() {
  const shared = operationalSharedData();
  const pendingLessonLogs = shared.lessonLogs.filter((log) => log.status !== "confirmed");
  const pendingFeedbacks = shared.feedbackRequests.filter((item) => item.status !== "코치 답변 완료");
  const lowTickets = tickets.filter((ticket) => ticket.remaining <= 2);
  const paymentChecks = billings.filter((item) => item.status === "check" || item.status === "unverified");
  const draftBillings = billings.filter((item) => item.status === "draft");
  const paymentDataErrors = billings.filter((item) => item.status === "paid" && !item.ticketId && !isHistoricalImportedPayment(item));
  const urgentMakeups = makeupRequests
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
      action: "시간표 확인",
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
      action: "회원관리",
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
      const deadlineDifference = String(left.dueAt || "9999-12-31").localeCompare(String(right.dueAt || "9999-12-31"));
      return deadlineDifference || left.originalIndex - right.originalIndex;
    });
}

function normalizeDashboardPage(total, page, pageSize = dashboardPageSize) {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  return Math.min(Math.max(Number(page) || 0, 0), lastPage);
}

function renderDashboardPager(selector, total, page, kind, pageSize = dashboardPageSize) {
  const target = $(selector);
  if (!target) return;
  const pageCount = Math.ceil(total / pageSize);
  target.hidden = pageCount <= 1;
  target.innerHTML = pageCount <= 1
    ? ""
    : Array.from(
        { length: pageCount },
        (_, index) => `<button class="dashboard-page-number ${index === page ? "is-current" : ""}" type="button" data-dashboard-page="${kind}" data-dashboard-page-index="${index}" aria-label="${index + 1}페이지" ${index === page ? 'aria-current="page"' : ""}>${index + 1}</button>`,
      ).join("");
}

function renderAdminOperations() {
  const taskList = $("#adminTaskList");
  if (!taskList) return;

  const allTasks = getAdminTasks();
  state.adminTaskPage = normalizeDashboardPage(allTasks.length, state.adminTaskPage);
  const tasks = allTasks.slice(state.adminTaskPage * dashboardPageSize, (state.adminTaskPage + 1) * dashboardPageSize);
  taskList.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
        <article class="ops-card ${task.tone}">
          <div>
            <span>${task.type}</span>
            <strong>${task.title}</strong>
            <small>${task.detail}</small>
          </div>
          <button class="small-button" type="button" data-jump="${task.view}" ${task.scheduleTicketId ? `data-schedule-ticket-id="${escapeHtml(String(task.scheduleTicketId))}"` : ""} ${task.scheduleLessonSource ? `data-schedule-lesson-source="${escapeHtml(task.scheduleLessonSource)}"` : ""}>${task.action}</button>
        </article>`,
        )
        .join("")
    : '<p class="empty-text">지금 바로 처리할 일이 없습니다.</p>';

  renderDashboardPager("#adminTaskPager", allTasks.length, state.adminTaskPage, "tasks");

  state.memberStatusPage = normalizeDashboardPage(members.length, state.memberStatusPage);
  const visibleMembers = members.slice(state.memberStatusPage * dashboardPageSize, (state.memberStatusPage + 1) * dashboardPageSize);
  $("#memberStatusCards").innerHTML = visibleMembers
    .map((member) => {
      const remaining = memberRemainingCount(member);
      const listStatus = memberListStatus(member);
      const tone = ["expired", "journal"].includes(listStatus) ? "neutral" : listStatus === "pending" ? "warn" : remaining <= 1 ? "danger" : remaining <= 2 ? "warn" : "good";
      return `
        <article class="status-card ${tone}">
          <div class="profile-line">
            ${avatarMarkup(member)}
            <div>
              <span>${member.statusLabel}</span>
              <strong>${member.name}</strong>
              <small>${member.coach} · ${member.regularTime}</small>
            </div>
          </div>
          <b>잔여 ${remaining}회</b>
        </article>`;
    })
    .join("");
  renderDashboardPager("#memberStatusPager", members.length, state.memberStatusPage, "members");

  const shared = operationalSharedData();
  const pendingNotes = lessonNotes.filter((note) => note.status === "pending").length + shared.lessonLogs.filter((log) => log.status !== "confirmed").length;
  const feedbacks = shared.feedbackRequests.filter((item) => item.status !== "코치 답변 완료").length;
  const coachLoads = coaches
    .filter((coach) => coach.status === "active")
    .map((coach) => {
      const lessonsForCoach = adminTodayLessonRows().filter((lesson) => getCoachName(lesson.coachId) === coach.name && lesson.status !== "available").length;
      return { coach, lessonsForCoach };
    });

  $("#coachWorkCards").innerHTML =
    coachLoads
      .map(
        ({ coach, lessonsForCoach }) => `
      <article class="work-summary-card">
        <div class="profile-line">
          ${avatarMarkup(coach)}
          <div>
            <span>${coach.role}</span>
            <strong>${coach.name}</strong>
            <small>오늘 수업 ${lessonsForCoach}건</small>
          </div>
        </div>
        <b>${coach.coachMode === "approved" ? "코치모드 사용" : coach.coachMode === "pending" ? "권한 미부여" : "앱 제외"}</b>
      </article>`,
      )
      .join("") +
    `<article class="work-summary-card warn">
      <span>확인 대기</span>
      <strong>${pendingNotes + feedbacks}건</strong>
      <small>수업기록 ${pendingNotes} · 운동노트 ${feedbacks}</small>
      <b>코치 처리 필요</b>
    </article>`;
}
function renderModePanel() {
  const mode = modeSummaries[state.activeMode] || modeSummaries.admin;
  $("#modePanel").innerHTML = `
    <div>
      <p class="eyebrow">${state.activeMode === "member" ? "Member App" : "Operations Mode"}</p>
      <h2>${mode.title}</h2>
      <p class="mode-copy">${mode.subtitle}</p>
    </div>
    <div class="mode-grid">
      ${mode.metrics
        .map(
          (item) => `
            <div class="mode-stat">
              <span>${item}</span>
            </div>`,
        )
        .join("")}
    </div>
    <div class="mode-actions">
      ${mode.actions.map((item) => `<button class="small-button" type="button" data-mode-action="${item}">${item}</button>`).join("")}
    </div>
  `;
}

function memberListStatus(member) {
  if (member.serverStatus === "inactive" || member.serverStatus === "archived" || member.status === "inactive") return "inactive";
  // A legacy profile may still say journal_only after a ticket is issued.
  // The live ticket-derived status is the source of truth for member lists.
  if (member.status === "active") return "active";
  if (member.status === "expired") return "expired";
  if (member.status === "pending" || member.memberKind === "lesson_pending") return "pending";
  if (member.status === "journal" || member.memberKind === "journal_only") return "journal";
  return "active";
}

function memberStatusLabel(member) {
  const status = memberListStatus(member);
  if (status === "inactive") return "삭제회원";
  if (status === "pending") return "가입서·결제대기";
  if (status === "journal") return "운동노트 회원";
  return status === "expired" ? "만료회원" : "수강중";
}

function memberStatusBadge(member) {
  return badge(memberListStatus(member), memberStatusLabel(member));
}

function splitMemberNames(value = "") {
  return [...new Set(String(value || "")
    .split(/[&·]/)
    .map((name) => name.trim())
    .filter(Boolean))];
}

function memberServerUserIds(member) {
  if (!member || typeof member !== "object") return [];
  return [...new Set((Array.isArray(member.serverUserIds) ? member.serverUserIds : [member.serverUserId]).filter(Boolean))];
}

function memberRecordsForReference(memberReference) {
  if (memberReference && typeof memberReference === "object") return [memberReference];
  const names = splitMemberNames(memberReference);
  return members.filter((member) => names.includes(member.name));
}

function ticketParticipantUserIds(ticket) {
  if (!ticket) return [];
  return [...new Set([
    ...(Array.isArray(ticket.participantUserIds) ? ticket.participantUserIds : []),
    ticket.serverUserId,
  ].filter(Boolean))];
}

function ticketParticipantNames(ticket) {
  if (!ticket) return [];
  const namesById = ticketParticipantUserIds(ticket)
    .map((userId) => (adminLiveDataState.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set([...namesById, ...splitMemberNames(ticket.member)])];
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

function ticketPartnerNames(ticket, memberReference) {
  const memberRecords = memberRecordsForReference(memberReference);
  const memberUserIds = [...new Set(memberRecords.flatMap(memberServerUserIds))];
  const memberNames = memberRecords.length
    ? memberRecords.map((member) => member.name)
    : splitMemberNames(memberReference);
  const partnerNamesById = ticketParticipantUserIds(ticket)
    .filter((userId) => !memberUserIds.includes(userId))
    .map((userId) => (adminLiveDataState.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set([
    ...partnerNamesById,
    ...ticketParticipantNames(ticket).filter((name) => !memberNames.includes(name)),
  ])];
}

function ticketPriorityForMember(ticket, memberReference) {
  const memberUserIds = memberRecordsForReference(memberReference).flatMap(memberServerUserIds);
  let score = 0;
  if (ticket.remaining > 0) score += 1000;
  if (ticketIsSharedGroup(ticket)) score += 500;
  score += ticketParticipantUserIds(ticket).length * 20;
  if (memberUserIds.includes(ticket.serverUserId)) score += 10;
  if (ticket.status === "active") score += 5;
  return score;
}

function ticketsForMember(memberReference) {
  return tickets
    .filter((ticket) => ticketBelongsToMember(ticket, memberReference))
    .sort((left, right) => ticketPriorityForMember(right, memberReference) - ticketPriorityForMember(left, memberReference));
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

function memberDatabaseRecord(member = null, ticket = null) {
  const records = adminLiveDataState.memberDatabaseRecords || [];
  const membershipRecords = adminLiveDataState.memberMembershipRecords || [];
  const ticketId = ticket?.serverTicketId || ticket?.id || "";
  if (ticketId) {
    return membershipRecords.find((record) => record.ticket_id === ticketId)
      || records.find((record) => record.current_ticket_id === ticketId)
      || null;
  }
  if (member?.memberRecord) return member.memberRecord;
  const userRecord = records.find((record) => record.user_id === member?.serverUserId);
  if (userRecord) return userRecord;
  return null;
}

function memberUnlinkedVerifiedPayment(member = null) {
  const userIds = member?.serverUserIds?.length
    ? member.serverUserIds
    : member?.serverUserId
      ? [member.serverUserId]
      : [];
  if (!userIds.length) return null;
  return (adminLiveDataState.payments || [])
    .filter((payment) => (
      userIds.includes(payment.user_id)
      && payment.status === "verified"
      && !payment.ticket_id
      && payment.provider !== "google_sheet_history"
    ))
    .sort((left, right) => String(right.verified_at || right.paid_at || right.created_at || "")
      .localeCompare(String(left.verified_at || left.paid_at || left.created_at || "")))[0] || null;
}

function memberManagementLessonTypeLabel(value = "") {
  return value === "one_on_two" ? "1:2" : value === "one_on_one" ? "1:1" : "미입력";
}

function memberManagementLessonMethodLabel(record = null, ticket = null) {
  const scope = record?.lesson_schedule_scope || ticket?.scheduleScope || "";
  const frequency = Number(record?.lesson_frequency_per_week || ticket?.weeklyCount || 0);
  if (!scope || !frequency) return "미입력";
  const scopeLabel = scope === "mixed" ? "혼합" : scope === "weekend" ? "주말" : "평일";
  return `${scopeLabel} 주${frequency}회`;
}

function memberManagementLessonDaysLabel(record = null, ticket = null) {
  const days = Array.isArray(record?.lesson_days)
    ? record.lesson_days
    : Array.isArray(ticket?.lessonDays)
      ? ticket.lessonDays
      : [];
  const labels = [...new Set(days.map(memberManagementDayLabel).filter(Boolean))];
  return labels.length ? labels.join(" · ") : "미입력";
}

function memberManagementRecordNumber(value) {
  return value === null || value === undefined || value === "" ? "미입력" : Number(value).toLocaleString("ko-KR");
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

function memberCurrentTicket(member) {
  return ticketsForMember(member)[0];
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
  const ticket = memberCurrentTicket(member);
  return ticket?.remaining ?? member.remaining ?? 0;
}

function defaultAuthRoleForMember(member) {
  return ["member", "coach", "admin"].includes(member.authRole) ? member.authRole : "member";
}

function buildAuthCandidateSql(member, role = "member") {
  const clauses = [`name ilike '%' || ${sqlLiteral(member.name)} || '%'`];
  if (role) clauses.push(`role = ${sqlLiteral(role)}`);
  return `-- 1. Find the Tennis Note profile row.
select
  u.id,
  u.name,
  u.role,
  u.status,
  u.auth_user_id is not null as direct_linked,
  count(l.id)::integer as provider_links
from public.tn_users
left join public.tn_user_auth_links l on l.user_id = u.id
where ${clauses.map((clause) => clause.replace(/\bname\b/g, "u.name").replace(/\brole\b/g, "u.role")).join(" and ")}
group by u.id, u.name, u.role, u.status, u.auth_user_id, u.created_at
order by u.created_at desc
limit 20;`;
}

function buildAuthLinkSql(member, { authUserId, tnUserId, role, provider }) {
  return `-- Tennis Note auth role link SQL
-- Review in Supabase SQL Editor before running.
-- Do not commit real auth UUIDs or private member data.

${buildAuthCandidateSql(member, role)}

-- 2. Link the signed-in Supabase Auth user to the selected Tennis Note profile.
update public.tn_users
set
  auth_user_id = coalesce(auth_user_id, ${sqlLiteral(authUserId)}::uuid),
  role = ${sqlLiteral(role)},
  status = 'active',
  updated_at = now()
where id = ${sqlLiteral(tnUserId)}::uuid
returning id, name, role, status, auth_user_id is not null as direct_linked;

-- 3. Add this provider as a login method without overwriting another provider.
insert into public.tn_user_auth_links (
  user_id,
  auth_user_id,
  provider,
  email_kind,
  is_primary,
  linked_by_user_id,
  linked_at,
  created_at,
  updated_at
)
values (
  ${sqlLiteral(tnUserId)}::uuid,
  ${sqlLiteral(authUserId)}::uuid,
  ${sqlLiteral(provider || "supabase")},
  'unknown',
  false,
  ${sqlLiteral(tnUserId)}::uuid,
  now(),
  now(),
  now()
)
on conflict (auth_user_id) do update
set
  user_id = excluded.user_id,
  provider = excluded.provider,
  updated_at = now()
returning user_id, provider, auth_user_id is not null as linked;

-- 4. Verify that this auth user reaches exactly one profile.
select u.id, u.name, u.role, u.status, l.provider, l.auth_user_id is not null as linked
from public.tn_users
join public.tn_user_auth_links l on l.user_id = u.id
where l.auth_user_id = ${sqlLiteral(authUserId)}::uuid;`;
}

function normalizedAuthProvider(provider = "") {
  const value = String(provider || "").toLowerCase();
  if (["naver", "custom:naver"].includes(value)) return "custom:naver";
  if (["kakao", "custom:kakao"].includes(value)) return "custom:kakao";
  if (["direct", "supabase", "email"].includes(value)) return "email";
  if (value === "apple") return value;
  return value;
}

function authProviderLabel(provider = "") {
  return {
    "custom:naver": "네이버",
    "custom:kakao": "카카오",
    apple: "Apple",
    email: "이메일",
  }[normalizedAuthProvider(provider)] || "";
}

const authProviderChoices = [
  { value: "custom:naver", label: "네이버" },
  { value: "custom:kakao", label: "카카오" },
  { value: "apple", label: "Apple" },
  { value: "email", label: "이메일" },
];

function authProviderList(entity = {}) {
  return [...new Set((entity.authProviders || []).map(normalizedAuthProvider).filter(Boolean))];
}

function authProvidersFromLinks(links = []) {
  return [...new Set([...links]
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)))
    .map((link) => link.provider)
    .filter(Boolean))];
}

function pendingAuthSwitch(entity = {}) {
  const request = entity.authSwitch;
  if (!request || request.status !== "pending") return null;
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) return null;
  return request;
}

function authSwitchExpiryLabel(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "24시간 안에 로그인";
  return `${date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지`;
}

function renderAuthProviderManagement(entity = {}, compact = false) {
  const userId = entity.serverUserId || "";
  const providers = authProviderList(entity);
  const request = pendingAuthSwitch(entity);
  const canManage = Boolean(userId) && operationsRole() === "admin";
  const canUnlink = canManage && providers.length > 1;
  const availableTargets = authProviderChoices.filter((item) => !providers.includes(item.value));
  const chips = providers.length
    ? providers.map((provider) => `
        <span class="auth-provider-chip">
          ${escapeHtml(authProviderLabel(provider) || provider)}
          <button type="button" data-unlink-auth-provider="${escapeHtml(provider)}" data-auth-user-id="${escapeHtml(userId)}" ${canUnlink ? "" : "disabled"} title="${canUnlink ? "이 로그인 수단 연결 해제" : "다른 로그인 수단을 먼저 연결해야 합니다"}" aria-label="${escapeHtml(authProviderLabel(provider) || provider)} 연결 해제">×</button>
        </span>`).join("")
    : `<span class="auth-provider-empty">로그인 수단 미연결</span>`;

  if (!userId) {
    return `<div class="auth-provider-manager ${compact ? "compact" : ""}"><div class="auth-provider-chip-list">${chips}</div><small>회원가입이 완료되면 로그인 수단을 관리할 수 있습니다.</small></div>`;
  }

  if (request) {
    return `
      <div class="auth-provider-manager ${compact ? "compact" : ""}">
        <div class="auth-provider-chip-list">${chips}</div>
        <div class="auth-switch-pending">
          <div>
            <strong>${escapeHtml(authProviderLabel(request.from_provider))} → ${escapeHtml(authProviderLabel(request.to_provider))} 변경 대기</strong>
            <span>${escapeHtml(authSwitchExpiryLabel(request.expires_at))} 새 수단으로 로그인하면 기존 연결이 자동 해제됩니다.</span>
          </div>
          <button class="ghost-button" type="button" data-cancel-auth-switch="${escapeHtml(request.id)}" data-auth-user-id="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>취소</button>
        </div>
      </div>`;
  }

  return `
    <div class="auth-provider-manager ${compact ? "compact" : ""}">
      <div class="auth-provider-chip-list">${chips}</div>
      ${providers.length && availableTargets.length ? `
        <div class="auth-switch-form">
          <label>
            <span>현재</span>
            <select data-auth-switch-from="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>
              ${providers.map((provider, index) => `<option value="${escapeHtml(provider)}" ${index === 0 ? "selected" : ""}>${escapeHtml(authProviderLabel(provider) || provider)}</option>`).join("")}
            </select>
          </label>
          <span class="auth-switch-arrow">→</span>
          <label>
            <span>변경</span>
            <select data-auth-switch-target="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>
              ${availableTargets.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
          <button class="small-button" type="button" data-prepare-auth-switch="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>변경 준비</button>
        </div>
        <small>새 수단 로그인 성공 전까지 현재 로그인은 유지됩니다.</small>` : `<small>${providers.length ? "연결된 수단 옆 × 버튼은 대체 로그인 수단이 있을 때만 사용할 수 있습니다." : "첫 로그인 연결 후 수단 변경이 가능합니다."}</small>`}
    </div>`;
}

function memberAuthConnection(member = {}) {
  const providers = [...new Set((member.authProviders || [])
    .map(normalizedAuthProvider)
    .filter(Boolean))];
  const labels = providers.map(authProviderLabel).filter(Boolean);
  const linked = Boolean(member.authLinked);
  return {
    linked,
    provider: providers[0] || "",
    providers,
    summary: linked ? (labels.length ? `${labels.join(" · ")} 연결` : "로그인 계정 연결됨") : "앱 가입 전",
    detail: linked ? (labels.length ? `로그인 수단: ${labels.join(", ")}` : "로그인 계정은 연결됐으며 수단 정보는 확인 중입니다.") : "로그인 수단 미연결",
  };
}

function renderMemberAuthLinkCard(member) {
  const role = defaultAuthRoleForMember(member);
  const connection = memberAuthConnection(member);
  return `
    <section class="member-auth-link-card">
      <div>
        <strong>${escapeHtml(connection.summary)}</strong>
        <span>${escapeHtml(connection.detail)}</span>
      </div>
      ${renderAuthProviderManagement(member)}
      <details class="auth-link-technical-tools">
        <summary>수동 연결 도구</summary>
        <div class="auth-link-technical-grid">
          <label>
            <small>Auth 사용자 UUID</small>
            <input type="text" data-auth-link-auth="${member.id}" placeholder="Authentication > Users에서 복사" spellcheck="false" />
          </label>
          <label>
            <small>회원 DB UUID</small>
            <input type="text" data-auth-link-profile="${member.id}" placeholder="후보 조회 SQL 결과의 id" spellcheck="false" />
          </label>
          <label>
            <small>권한</small>
            <select data-auth-link-role="${member.id}">
              <option value="member" ${role === "member" ? "selected" : ""}>회원</option>
              <option value="coach" ${role === "coach" ? "selected" : ""}>코치</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>관리자</option>
            </select>
          </label>
          <label>
            <small>연결할 로그인 수단</small>
            <select data-auth-link-provider="${member.id}">
              <option value="">선택하세요</option>
              ${authProviderChoices.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="auth-link-actions">
          <button class="ghost-button" type="button" data-copy-auth-link="candidate" data-auth-member-id="${member.id}">후보 조회 SQL 복사</button>
          <button class="small-button" type="button" data-copy-auth-link="link" data-auth-member-id="${member.id}">연결 SQL 복사</button>
        </div>
      </details>
  </section>`;
}

function renderMemberApprovalCard(member) {
  if (memberListStatus(member) !== "pending") return "";
  return `
    <section class="member-approval-card">
      <div>
        <strong>가입서 제출 · 결제 대기</strong>
        <span>운동노트는 이미 사용할 수 있습니다. 결제가 검증되면 수강회원으로 자동 전환됩니다.</span>
      </div>
      <div class="auth-link-actions">
        <button class="primary-button" type="button" data-jump="billing">결제 상태 확인</button>
      </div>
    </section>`;
}

function renderMemberEnrollmentDetails(member) {
  const enrollment = member.enrollment;
  if (!enrollment) return "";
  const levelLabels = { first: "처음 시작", beginner: "입문·초급", intermediate: "중급", advanced: "상급" };
  return `
    <details class="member-admin-more">
      <summary>수강 가입서 자세히 보기</summary>
      <dl class="member-db-grid member-db-grid-compact">
        <div><dt>테니스 경험</dt><dd>${escapeHtml(levelLabels[enrollment.experience_level] || enrollment.experience_level || "미입력")}</dd></div>
        ${Number(enrollment.group_size || 1) === 2 ? `<div><dt>2대1 파트너</dt><dd>${escapeHtml(enrollment.partner_name || "확인 필요")}</dd></div>` : ""}
      </dl>
    </details>`;
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

function adminAccountControlErrorMessage(code = "") {
  return {
    active_admin_role_required: "관리자 계정으로 로그인해 주세요.",
    invalid_user_id: "회원 계정 정보를 다시 불러와 주세요.",
    invalid_coach_role_id: "코치 권한 정보를 다시 불러와 주세요.",
    coach_role_not_found: "코치 권한을 찾지 못했습니다.",
    verified_member_phone_required_for_switch: "회원 휴대전화 번호를 먼저 정확히 등록해 주세요.",
    current_login_provider_required: "현재 연결된 로그인 수단이 없습니다.",
    different_target_provider_required: "현재와 다른 로그인 수단을 선택해 주세요.",
    source_provider_link_not_found: "해제할 기존 로그인 수단을 찾지 못했습니다.",
    target_provider_already_linked: "이미 연결된 로그인 수단입니다.",
    replacement_login_required_before_unlink: "다른 로그인 수단을 먼저 연결해야 기존 수단을 해제할 수 있습니다.",
    auth_provider_link_not_found: "해제할 로그인 연결을 찾지 못했습니다.",
    pending_auth_switch_not_found: "변경 대기가 이미 끝났습니다. 새로고침 후 확인해 주세요.",
  }[code] || `처리하지 못했습니다: ${code || "server_error"}`;
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

function groupPaymentModeLabel(mode = "representative") {
  if (mode === "alternate") return "결제자 번갈아 지정";
  if (mode === "separate") return "각자 결제";
  return "한 명이 두 사람 함께 결제";
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

function renderMemberGroupAccountSettings(member, ticket) {
  if (!ticketIsSharedGroup(ticket)) return "";
  const account = groupAccountForMemberTicket(member, ticket);
  if (!account) return "";
  const linkedMembers = (account.members || []).filter((item) => item.appStatus === "linked");
  return `
    <details class="member-admin-more member-group-account-details">
      <summary>2대1 결제·앱 관리 · ${escapeHtml(groupPaymentModeLabel(account.paymentMode))}</summary>
      <article class="group-account-admin-card member-group-account-card" data-group-account="${escapeHtml(account.id)}">
        <div class="group-account-members">
          ${(account.members || []).map((item) => `
            <div>
              <span>${escapeHtml(item.name)}</span>
              <strong>${item.appStatus === "linked" ? "앱 연결" : "앱 미가입"}</strong>
              <small>${item.canManageSchedule ? "일정관리 가능" : "연결 회원이 대신 관리"}</small>
            </div>`).join("")}
        </div>
        <div class="group-payment-mode">
          <span>현재 결제 방식</span>
          <strong>${escapeHtml(groupPaymentModeLabel(account.paymentMode))}</strong>
          <small>${account.paymentMode === "separate" ? "각자 결제" : `다음 결제 담당 ${escapeHtml(account.nextPayer || "미지정")}`}</small>
        </div>
        <div class="group-account-actions">
          <button class="small-button ${account.paymentMode === "representative" ? "is-active" : ""}" type="button" data-group-payment-mode="representative" data-group-account-id="${escapeHtml(account.id)}">함께 결제</button>
          <button class="small-button ${account.paymentMode === "alternate" ? "is-active" : ""}" type="button" data-group-payment-mode="alternate" data-group-account-id="${escapeHtml(account.id)}" ${linkedMembers.length < 2 ? "disabled" : ""}>번갈아 결제</button>
          <button class="small-button ${account.paymentMode === "separate" ? "is-active" : ""}" type="button" data-group-payment-mode="separate" data-group-account-id="${escapeHtml(account.id)}" ${linkedMembers.length < 2 ? "disabled" : ""}>각자 결제</button>
          <button class="ghost-button" type="button" data-switch-group-payer="${escapeHtml(account.id)}" ${linkedMembers.length < 2 || account.paymentMode === "separate" ? "disabled" : ""}>다음 결제자 변경</button>
        </div>
      </article>
    </details>`;
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

function holdingRequestDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function renderHoldingRequestAdminList() {
  const target = $("#holdingRequestAdminList");
  if (!target) return;
  const requests = loadSharedData().holdingRequests || [];
  const panel = target.closest("details");
  if (panel && requests.some((request) => request.status === "pending")) panel.open = true;
  target.innerHTML = requests.length
    ? requests.map((request) => `
      <article class="holding-admin-row ${escapeHtml(request.status || "pending")}">
        <div class="holding-admin-main">
          <strong>${escapeHtml(request.member || "회원")}</strong>
          <span>${escapeHtml(request.typeLabel || (request.type === "injury" ? "부상·입원" : "개인 사유"))} · ${escapeHtml(request.startDate)}~${escapeHtml(request.endDate)} · ${Number(request.days) || "-"}일</span>
          <small>${escapeHtml(request.ticketTitle || "회원권")} · ${request.type === "injury" ? "민감정보 상세 비공개" : escapeHtml(request.reason || "사유 미입력")}</small>
        </div>
        <div class="holding-admin-status">
          ${badge(request.status === "approved" ? "ready" : request.status === "rejected" ? "danger" : "pending", request.status === "approved" ? "승인" : request.status === "rejected" ? "반려" : "검토중")}
          ${request.type === "injury" ? `<button class="ghost-button" type="button" data-view-holding-evidence="${escapeHtml(request.id)}">증빙 확인</button>` : ""}
          ${request.evidencePath && request.status !== "pending" ? `<button class="ghost-button" type="button" data-delete-holding-evidence="${escapeHtml(request.id)}">원본 삭제</button>` : ""}
        </div>
        <div class="holding-admin-actions">
          <button class="small-button" type="button" data-review-holding="approved" data-holding-request-id="${escapeHtml(request.id)}" ${request.status !== "pending" ? "disabled" : ""}>승인</button>
          <button class="small-button danger-button" type="button" data-review-holding="rejected" data-holding-request-id="${escapeHtml(request.id)}" ${request.status !== "pending" ? "disabled" : ""}>반려</button>
        </div>
      </article>`).join("")
    : `<p class="empty-text">접수된 홀딩 요청이 없습니다.</p>`;
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

function accountDeletionStatusLabel(status) {
  if (status === "reviewing") return "검토중";
  if (status === "completed") return "처리완료";
  if (status === "cancelled") return "취소";
  return "접수";
}

function accountDeletionDateTime(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "접수 시각 미확인" : date.toLocaleString("ko-KR");
}

function renderAccountDeletionAdminList() {
  const target = $("#accountDeletionAdminList");
  if (!target) return;
  const requests = state.accountDeletionRequests || [];
  const panel = target.closest("details");
  if (panel && requests.some((request) => request.status === "pending" || request.status === "reviewing")) panel.open = true;
  target.innerHTML = requests.length
    ? requests.map((request) => `
      <article class="holding-admin-row ${escapeHtml(request.status || "pending")}">
        <div class="holding-admin-main">
          <strong>${escapeHtml(request.member || "회원")}</strong>
          <span>${escapeHtml(accountDeletionStatusLabel(request.status))} · ${escapeHtml(accountDeletionDateTime(request.requestedAt || request.createdAt))}</span>
          <small>${escapeHtml(request.reason || "사유 미입력")} ${request.retainedDataSummary ? `· 보관: ${escapeHtml(request.retainedDataSummary)}` : ""}</small>
        </div>
        <div class="holding-admin-status">
          ${badge(request.status === "completed" ? "ready" : request.status === "cancelled" ? "danger" : "pending", accountDeletionStatusLabel(request.status))}
        </div>
        <div class="holding-admin-actions">
          ${request.status === "pending" ? `<button class="small-button" type="button" data-review-account-deletion="reviewing" data-account-deletion-id="${escapeHtml(request.id)}">검토 시작</button>` : ""}
          ${request.status === "reviewing" ? `<button class="small-button danger-button" type="button" data-review-account-deletion="completed" data-account-deletion-id="${escapeHtml(request.id)}">삭제 처리 완료</button>` : ""}
        </div>
      </article>`).join("")
    : `<p class="empty-text">접수된 회원 탈퇴 요청이 없습니다.</p>`;
}

async function loadServerAccountDeletionRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "id,user_id,status,reason_summary,admin_note,retained_data_summary,requested_at,reviewed_at,completed_at,cancelled_at,created_at",
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
        requestedAt: row.requested_at || "",
        reviewedAt: row.reviewed_at || "",
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
  if (!request || !client?.rpc) return;
  if (status === "completed" && !window.confirm("정산·환불·잔여 수업과 법정 보관 대상을 확인하고 삭제 처리를 완료할까요?")) return;
  try {
    await client.rpc("tn_review_account_deletion", {
      target_request_id: requestId,
      target_status: status,
      target_admin_note: status === "completed" ? "관리자 삭제 처리 완료" : "관리자 검토 시작",
      target_retained_data_summary: status === "completed" ? "결제·환불 등 법정 보관 대상만 분리 보관" : "",
    });
    await loadServerAccountDeletionRequests();
    showToast(status === "completed" ? "회원 탈퇴 및 데이터 삭제 처리 완료" : "회원 탈퇴 요청 검토 시작");
  } catch {
    showToast("탈퇴 요청 처리 실패 · 관리자 권한과 DB 적용을 확인해 주세요");
  }
}

function memberTicketKind(member) {
  const ticket = memberCurrentTicket(member);
  return ticket ? membershipProductForTicket(ticket).productKind : "none";
}

function filteredMembers() {
  const localSearch = String(state.memberSearch || "").trim().toLowerCase();
  const matchingMembers = members.filter((member) => {
    const listStatus = memberListStatus(member);
    const statusMatch = state.memberFilter === "expiring"
        ? listStatus === "active" && memberRemainingCount(member) <= 2
        : listStatus === state.memberFilter;
    const coachMatch = state.memberCoachFilter === "all" || member.coach === state.memberCoachFilter;
    const ticketMatch = state.memberTicketFilter === "all" || memberTicketKind(member) === state.memberTicketFilter;
    const searchValues = memberSearchValues(member);
    const localMatch = !localSearch || searchValues
      .some((value) => String(value || "").toLowerCase().includes(localSearch));
    return statusMatch
      && coachMatch
      && ticketMatch
      && localMatch
      && matchesSearch([...searchValues, memberStatusLabel(member)]);
  });
  return matchingMembers;
}

const memberFilterCopy = {
  active: { summary: "명 수강중", empty: "수강중인 회원이 없습니다." },
  expiring: { summary: "명 만료임박", empty: "잔여 2회 이하 회원이 없습니다." },
  pending: { summary: "명 가입서·결제대기", empty: "가입서·결제 대기 회원이 없습니다." },
  journal: { summary: "명 운동노트 이용", empty: "운동노트만 이용하는 회원이 없습니다." },
  expired: { summary: "명 만료", empty: "만료된 회원이 없습니다." },
  inactive: { summary: "명 삭제", empty: "삭제 처리된 회원이 없습니다." },
};

function renderMemberFilterSections() {
  const filter = state.memberFilter || "active";
  const role = operationsRole();
  $$(".segment[data-member-filter]").forEach((button) => {
    const isActive = button.dataset.memberFilter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  $$('[data-member-scope]').forEach((section) => {
    const scopes = String(section.dataset.memberScope || "").split(/\s+/).filter(Boolean);
    const roleAllowed = !section.hasAttribute("data-member-admin-only") || role === "admin";
    section.hidden = !roleAllowed || !scopes.includes(filter);
  });
}

function normalizeMemberManagementPolicy(settings = {}) {
  return {
    coachCanCorrectTicket: settings.coachCanCorrectTicket === true,
    coachCanExpireTicket: settings.coachCanExpireTicket === true,
    coachCanReenroll: settings.coachCanReenroll === true,
    requireAdminPin: settings.requireAdminPin !== false,
  };
}

function currentOperationsCoachRoleIds() {
  const profileId = adminImportAuthState.profile?.id || "";
  return new Set((adminLiveDataState.coachRoles || [])
    .filter((role) => role.user_id === profileId && role.status === "approved")
    .map((role) => role.id));
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
  const statusPriority = { active: 0, paused: 1, pending_payment: 2, expired: 3, refunded: 4, voided: 5 };
  return [...byId.values()].sort((left, right) => (
    (statusPriority[left.status] ?? 9) - (statusPriority[right.status] ?? 9)
    || String(right.expires || "").localeCompare(String(left.expires || ""))
  ));
}

function renderMemberManagementControls(member) {
  if (!member?.serverUserId || !operationsAccessReady()) return "";
  const status = memberListStatus(member);
  const managedTickets = memberManagementTickets(member);
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);

  const ticketRows = managedTickets.map((ticket) => {
    const actions = [];
    const editable = !["refunded", "voided"].includes(ticket.status);
    if (status !== "inactive" && editable && memberManagementActionAllowed("correct", ticket)) {
      actions.push({ action: "correct", label: "수정", tone: "ghost-button" });
    }
    if (status !== "inactive" && ["active", "paused", "pending_payment"].includes(ticket.status)
      && memberManagementActionAllowed("expire", ticket)) {
      actions.push({ action: "expire", label: "만료", tone: "ghost-button" });
    }
    if (status !== "inactive" && ["expired", "refunded"].includes(ticket.status)
      && memberManagementActionAllowed("reenroll", ticket)) {
      actions.push({ action: "reenroll", label: "재등록", tone: "primary-button" });
    }
    if (operationsRole() === "admin" && ticket.status !== "voided") {
      actions.push({ action: "force_delete", label: "강제 삭제", tone: "danger-button" });
    }
    return `
      <div class="member-ticket-management-row" data-managed-ticket="${escapeHtml(ticket.serverTicketId)}">
        <div class="member-ticket-management-main">
          <span class="member-ticket-status status-${escapeHtml(ticket.status || "unknown")}">${escapeHtml(memberTicketStatusLabel(ticket))}</span>
          <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
          <small>${escapeHtml(ticketUsageLabel(ticket))} · ${escapeHtml(memberDetailDateLabel(ticket.purchased))}~${escapeHtml(memberDetailDateLabel(ticket.expires))}</small>
        </div>
        <div class="member-management-actions">
          ${actions.length ? `
            <select class="member-ticket-action-select" data-member-ticket-action="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} 관리 작업">
              ${actions.map((item) => `<option value="${item.action}">${item.label}</option>`).join("")}
            </select>
            <button class="small-button" type="button" data-manage-member-ticket="${escapeHtml(ticket.serverTicketId)}">관리</button>` : '<span class="member-ticket-no-action">변경 불가</span>'}
        </div>
      </div>`;
  }).join("");

  if (!ticketRows && operationsRole() !== "admin") return "";
  return `
    <div class="member-management-controls">
      <div class="member-ticket-management-heading">
        <div>
          <strong>회원권 관리</strong>
        </div>
        <small>${operationsRole() === "coach" ? "허용된 본인 담당 회원권만 처리할 수 있습니다." : "회원권별 작업을 고른 뒤 관리 버튼을 누릅니다."}</small>
      </div>
      <div class="member-ticket-management-list">
        ${ticketRows || '<p class="member-more-empty">등록된 회원권이 없습니다.</p>'}
      </div>
      ${operationsRole() === "admin" && !managedTickets.some((ticket) => ["active", "paused", "pending_payment"].includes(ticket.status))
        ? `<button class="primary-button member-ticket-assign-button" type="button" data-open-member-management="assign">${unlinkedPayment ? "결제 연결·회원권 발급" : "판매중 회원권 등록"}</button>`
        : ""}
    </div>`;
}

function memberManagementActionLabel(action) {
  return ({
    create: "회원 수동 추가",
    assign: "회원권 등록",
    profile: "회원 정보·앱 연결",
    correct: "회원권 숫자·기간 수정",
    expire: "회원권 만료 처리",
    force_delete: "회원권 강제 삭제",
    permanent_delete: "회원 영구 삭제",
    reenroll: "다시 수강 등록",
    deactivate: "회원 삭제 처리",
    restore: "회원 복원",
  })[action] || "회원 관리";
}

function memberManagementDate(value = "") {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : adminLocalDateKey(new Date());
}

function addMemberManagementDays(value, days) {
  const date = new Date(`${memberManagementDate(value)}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return adminLocalDateKey(date);
}

function memberManagementProducts(sourceTicket = null) {
  const sourceGroupSize = Number(sourceTicket?.groupSize) || 1;
  return (adminLiveDataState.products || [])
    .filter((product) => product.is_active !== false
      && (!sourceTicket?.branchId || product.branch_id === sourceTicket.branchId)
      && (!sourceTicket || Number(product.group_size || 1) === sourceGroupSize))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function memberManagementCoachRoles(sourceTicket = null) {
  const ownRoleIds = currentOperationsCoachRoleIds();
  return (adminLiveDataState.coachRoles || [])
    .filter((role) => role.status === "approved"
      && (!sourceTicket?.branchId || role.branch_id === sourceTicket.branchId)
      && (operationsRole() === "admin" || ownRoleIds.has(role.id)))
    .sort((left, right) => String(left.display_name || "").localeCompare(String(right.display_name || ""), "ko"));
}

function memberManagementScheduleScopeLabel(scope) {
  if (scope === "mixed") return "혼합 (월~일)";
  return scope === "weekend" ? "주말 (토·일)" : "평일 (월~금)";
}

function memberManagementProductScheduleScope(product) {
  const name = String(product?.name || "");
  if (name.includes("주말")) return "weekend";
  if (name.includes("평일")) return "weekday";
  return ["weekday", "weekend", "mixed"].includes(product?.schedule_scope) ? product.schedule_scope : "weekday";
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

function memberManagementValue(value) {
  return value === null || value === undefined ? "" : String(value);
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
  const productScheduleScope = memberManagementProductScheduleScope(product);
  const scheduleScope = (isAssign ? productScheduleScope : record?.lesson_schedule_scope || ticket?.scheduleScope) || productScheduleScope;
  const weeklyFrequency = Number((isAssign ? product?.frequency_per_week : record?.lesson_frequency_per_week || ticket?.weeklyCount) || product?.frequency_per_week || 1);
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
  const note = record ? record.admin_note || "" : member?.note || "";
  const partnerUserId = ticket && member ? memberTicketPartnerUserId(ticket, member) : "";
  const recordStatus = record?.record_status || (ticket?.status === "expired" ? "historical" : hasTicket ? "active" : "pending");
  const ticketStatus = ["active", "paused", "pending_payment", "expired"].includes(ticket?.status) ? ticket.status : "active";
  return `
    <input name="recordStatus" type="hidden" value="${escapeHtml(recordStatus)}" />
    ${isAssign && existingPayment ? `<input name="existingPaymentId" type="hidden" value="${escapeHtml(existingPayment.id)}" />
      <div class="member-management-warning"><strong>기존 결제 기록 연결</strong><span>${escapeHtml(paymentMethodLabel(existingPayment.method))} · ${money.format(Number(existingPayment.final_amount ?? existingPayment.amount ?? 0))}원 · 회원권 발급 후 같은 결제 기록에 연결됩니다.</span></div>` : ""}
    <div class="member-management-form-grid member-database-fields">
      <label class="form-field"><span>레슨강사</span><select name="coachRoleId" required>
        ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
      </select></label>
      <label class="form-field"><span>레슨방식</span><select name="scheduleScope" required>
        <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일</option>
        <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말</option>
        <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
      </select></label>
      <label class="form-field"><span>주당 횟수</span><select name="weeklyFrequency" required>
        ${[1, 2, 3].map((frequency) => `<option value="${frequency}" ${frequency === weeklyFrequency ? "selected" : ""} ${scheduleScope === "weekend" && frequency === 3 ? "disabled" : ""}>주 ${frequency}회</option>`).join("")}
      </select></label>
      <label class="form-field"><span>레슨종류</span><select name="lessonType" required>
        <option value="one_on_one" ${lessonType === "one_on_one" ? "selected" : ""}>1:1</option>
        <option value="one_on_two" ${lessonType === "one_on_two" ? "selected" : ""}>1:2</option>
      </select></label>
      <label class="form-field span-2 member-lesson-days-field"><span>레슨요일</span><span class="member-lesson-day-options" data-member-lesson-days>${memberManagementLessonDaysMarkup(lessonDays, scheduleScope)}</span></label>
      <label class="form-field"><span>레슨시작일</span><input name="startsOn" type="date" value="${escapeHtml(startsOn)}" ${hasTicket ? "required" : ""} /></label>
      ${hasTicket ? `<label class="form-field"><span>회원권 만료일</span><input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" required /></label>` : ""}
      <label class="form-field"><span>총 회차</span><input name="totalSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(totalSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field"><span>소진 회차</span><input name="usedSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(usedSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field"><span>잔여 회차</span><input name="remainingSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(remainingSessions))}" readonly aria-readonly="true" ${hasTicket ? "required" : ""} /><small>총 회차 - 소진 회차로 자동 계산</small></label>
      ${includeTicketStatus && ticket ? `<label class="form-field"><span>회원권 상태</span><select name="ticketStatus" required>
        <option value="active" ${ticketStatus === "active" ? "selected" : ""}>사용 중</option>
        <option value="paused" ${ticketStatus === "paused" ? "selected" : ""}>일시정지</option>
        ${ticketStatus === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
        <option value="expired" ${ticketStatus === "expired" ? "selected" : ""}>만료</option>
      </select></label>` : ""}
      <label class="form-field"><span>결제일자</span><input name="paymentDate" type="date" value="${escapeHtml(paymentDate)}" /></label>
      <label class="form-field"><span>결제수단</span><select name="paymentMethod">
        <option value="" ${paymentMethod ? "" : "selected"}>미입력</option>
        <option value="card" ${paymentMethod === "card" ? "selected" : ""}>카드</option>
        <option value="bank" ${["bank", "bank_transfer", "transfer"].includes(paymentMethod) ? "selected" : ""}>계좌이체</option>
        <option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>현금</option>
        <option value="manual" ${paymentMethod === "manual" ? "selected" : ""}>관리자 입력</option>
        ${paymentMethod && !["card", "bank", "bank_transfer", "transfer", "cash", "manual"].includes(paymentMethod) ? `<option value="${escapeHtml(paymentMethod)}" selected>${escapeHtml(paymentMethodLabel(paymentMethod))}</option>` : ""}
      </select></label>
      <label class="form-field"><span>결제금액</span><input name="paymentAmount" type="number" min="0" step="1000" value="${escapeHtml(memberManagementValue(paymentAmount))}" /></label>
      <label class="form-field span-2"><span>비고</span><textarea name="note" rows="3" maxlength="500">${escapeHtml(note)}</textarea></label>
      <label class="form-field span-2 ${lessonType === "one_on_two" ? "" : "is-disabled"}" data-manual-member-partner-field><span>1:2 파트너</span><select name="partnerUserId" ${lessonType === "one_on_two" ? "required" : "disabled"}>
        <option value="">파트너 선택</option>
        ${partnerOptions.filter((user) => user.id !== member?.serverUserId).map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "회원")}</option>`).join("")}
      </select></label>
    </div>`;
}

function manualMemberPartnerOptions() {
  return (adminLiveDataState.users || [])
    .filter((user) => user.role === "member" && user.status === "active")
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function memberManualProfileFields(member = {}) {
  const dominantHand = member.dominantHand || "";
  const backhandStyle = member.backhandStyle || "";
  return `
    <label class="form-field span-2"><span>실명</span><input name="memberName" type="text" minlength="2" maxlength="40" value="${escapeHtml(member.name || "")}" autocomplete="name" required /></label>
    <label class="form-field"><span>닉네임</span><input name="memberNickname" type="text" minlength="2" maxlength="16" value="${escapeHtml(member.nickname || "")}" placeholder="선택 입력" /></label>
    <label class="form-field"><span>휴대전화</span><input name="memberPhone" type="tel" inputmode="tel" maxlength="20" value="${escapeHtml(member.phone || "")}" placeholder="010-0000-0000" /></label>
    <label class="form-field"><span>출생연도</span><input name="memberBirthYear" type="number" min="1900" max="2100" step="1" value="${escapeHtml(String(member.birthYear || ""))}" placeholder="예: 1990" /></label>
    <label class="form-field"><span>거주동</span><input name="memberNeighborhood" type="text" maxlength="40" value="${escapeHtml(member.neighborhood || "")}" placeholder="예: 군자동" /></label>
    <label class="form-field"><span>성별</span><select name="memberGender">
      <option value="" ${member.gender ? "" : "selected"}>미입력</option>
      <option value="female" ${member.gender === "female" ? "selected" : ""}>여성</option>
      <option value="male" ${member.gender === "male" ? "selected" : ""}>남성</option>
      <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
      <option value="prefer_not" ${member.gender === "prefer_not" ? "selected" : ""}>응답 안 함</option>
    </select></label>
    <label class="form-field"><span>주사용 손</span><select name="memberDominantHand">
      <option value="" ${dominantHand ? "" : "selected"}>미입력</option>
      <option value="right" ${dominantHand === "right" ? "selected" : ""}>오른손</option>
      <option value="left" ${dominantHand === "left" ? "selected" : ""}>왼손</option>
      <option value="ambidextrous" ${dominantHand === "ambidextrous" ? "selected" : ""}>양손</option>
    </select></label>
    <label class="form-field"><span>백핸드</span><select name="memberBackhandStyle">
      <option value="" ${backhandStyle ? "" : "selected"}>미입력</option>
      <option value="two_handed" ${backhandStyle === "two_handed" ? "selected" : ""}>투핸드</option>
      <option value="one_handed" ${backhandStyle === "one_handed" ? "selected" : ""}>원핸드</option>
    </select></label>
    <label class="form-field"><span>테니스 시작일</span><input name="memberTennisStartedOn" type="date" value="${escapeHtml(member.tennisStartedOn || "")}" /></label>
    <label class="form-field"><span>자가 NTRP</span><input name="memberSelfNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.selfNtrp || ""))}" /></label>
    <label class="form-field"><span>코치 측정 NTRP</span><input name="memberCoachNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.coachNtrp || ""))}" /></label>
    <label class="form-field span-2"><span>테니스 목표</span><textarea name="memberTennisGoal" rows="2" maxlength="1000" placeholder="선택 입력">${escapeHtml(member.tennisGoal || "")}</textarea></label>
    <label class="form-field span-2"><span>플레이 스타일·관리 메모</span><textarea name="memberPlayStyleMemo" rows="2" maxlength="2000" placeholder="선택 입력">${escapeHtml(member.playStyleMemo || "")}</textarea></label>`;
}

function automaticMemberManagementReason(action) {
  return {
    create: "관리자 수동 회원 등록",
    assign: "관리자 기존 회원 회원권 등록",
    profile: "관리자 회원 정보 수정",
    correct: "관리자 회원권 수동 조정",
    expire: "관리자 회원권 만료 처리",
    force_delete: "관리자 잘못된 회원권 강제 삭제",
    permanent_delete: "관리자 삭제회원 영구 삭제",
    reenroll: "관리자 회원 재등록",
    deactivate: "관리자 회원 운영 삭제",
    restore: "관리자 회원 복원",
  }[action] || "관리자 수동 처리";
}

function memberLinkCandidateLabel(candidate = {}) {
  const providers = (candidate.providers || []).map(authProviderLabel).filter(Boolean).join("·") || "로그인";
  const matches = (candidate.matchedFields || []).map((field) => ({
    phone: "전화번호",
    name: "이름",
    birth_year: "출생연도",
  })[field] || field).join("+");
  const last4 = candidate.phoneLast4 ? ` · 전화 끝 ${candidate.phoneLast4}` : "";
  const recommended = candidate.recommended ? " · 추천" : "";
  return `${candidate.name || "가입자"} · ${providers}${last4}${matches ? ` · ${matches} 일치` : ""}${recommended}`;
}

async function loadMemberLinkCandidates(member) {
  if (!member?.serverUserId || operationsRole() !== "admin" || member.authLinked) return;
  memberManagementModalState.linkCandidatesLoading = true;
  memberManagementModalState.linkCandidatesLoadedFor = member.serverUserId;
  renderMemberManagementModal();
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_member_link_candidates", {
      target_user_id: member.serverUserId,
    });
    if (memberManagementModalState.memberId !== member.id || memberManagementModalState.action !== "profile") return;
    memberManagementModalState.linkCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    memberManagementModalState.linkCandidates = [];
  } finally {
    memberManagementModalState.linkCandidatesLoading = false;
    if (memberManagementModalState.memberId === member.id && memberManagementModalState.action === "profile") {
      renderMemberManagementModal();
    }
  }
}

function renderMemberManagementModal() {
  const target = $("#memberManagementModalContent");
  if (!target) return;
  const action = memberManagementModalState.action;
  const isCreate = action === "create";
  const member = isCreate
    ? { id: null, name: "새 회원", serverUserId: "manual-create" }
    : members.find((item) => item.id === memberManagementModalState.memberId);
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === memberManagementModalState.ticketId) || null;
  if (!member || !action) {
    target.innerHTML = "";
    return;
  }

  const record = memberDatabaseRecord(isCreate ? null : member, ticket);
  const products = ["assign", "reenroll"].includes(action)
    ? memberManagementProducts(ticket)
    : isCreate
      ? memberManagementProducts()
      : [];
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);
  const product = products.find((item) => item.id === ticket?.productId)
    || products.find((item) => item.id === unlinkedPayment?.product_id)
    || (adminLiveDataState.products || []).find((item) => item.id === ticket?.productId)
    || products[0]
    || null;
  const coachRoles = ["profile", "correct", "assign", "reenroll"].includes(action)
    ? memberManagementCoachRoles(ticket || { branchId: record?.branch_id })
    : isCreate
      ? memberManagementCoachRoles({ branchId: product?.branch_id })
      : [];
  const currentCoachRoleId = record?.coach_role_id || ticket?.coachRoleId || "";
  const coachRoleId = coachRoles.some((role) => role.id === currentCoachRoleId) ? currentCoachRoleId : coachRoles[0]?.id || "";
  const scheduleScope = record?.lesson_schedule_scope || ticket?.scheduleScope || product?.schedule_scope || "weekday";
  const partnerOptions = ["profile", "correct", "assign"].includes(action) || isCreate ? manualMemberPartnerOptions() : [];
  const groupProduct = (record?.lesson_type || ticket?.lessonTypeCode) === "one_on_two" || Number(product?.group_size || 1) === 2;
  const today = adminLocalDateKey(new Date());
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const defaultTotal = action === "reenroll" ? Number(product?.total_sessions || ticket?.total || 0) : Number(record?.total_sessions ?? ticket?.total ?? 0);
  const defaultUsed = action === "reenroll" ? 0 : Number(record?.used_sessions ?? ticket?.used ?? 0);
  const defaultRemaining = action === "reenroll" ? defaultTotal : Number(record?.remaining_sessions ?? ticket?.remaining ?? 0);
  const defaultStartsOn = action === "reenroll" ? today : memberManagementDate(record?.lesson_start_on || ticket?.purchased);
  const defaultExpiresOn = action === "reenroll" ? addMemberManagementDays(today, validityDays - 1) : memberManagementDate(ticket?.expires);
  const ticketStatus = ["active", "paused", "pending_payment", "expired"].includes(ticket?.status) ? ticket.status : "expired";
  const destructive = ["expire", "force_delete", "deactivate", "permanent_delete"].includes(action);
  let actionFields = "";

  if (action === "profile") {
    const connection = memberAuthConnection(member);
    const candidates = memberManagementModalState.linkCandidates || [];
    const recommended = candidates.find((candidate) => candidate.recommended)?.userId || "";
    const linkControl = connection.linked
      ? `<div class="member-link-status is-linked"><strong>앱 계정 연결됨</strong><span>${escapeHtml(connection.summary)}</span></div>`
      : memberManagementModalState.linkCandidatesLoading
        ? '<div class="member-link-status"><strong>가입 계정 찾는 중</strong><span>전화번호와 실명 기준으로 확인하고 있습니다.</span></div>'
        : candidates.length
          ? `<label class="form-field span-2"><span>연결할 앱 가입 계정</span><select name="sourceSignupUserId">
              <option value="">이번에는 연결하지 않음</option>
              ${candidates.map((candidate) => `<option value="${escapeHtml(candidate.userId)}" ${candidate.userId === recommended ? "selected" : ""}>${escapeHtml(memberLinkCandidateLabel(candidate))}</option>`).join("")}
            </select><small>선택하면 기존 회원권·시간표는 유지하고 로그인 계정과 운동노트만 이 회원에게 연결합니다.</small></label>`
          : '<div class="member-link-status"><strong>일치하는 가입 계정 없음</strong><span>회원이 앱에서 가입한 뒤 다시 열면 후보가 표시됩니다.</span></div>';
    const status = memberListStatus(member);
    const statusOptions = status === "inactive"
      ? '<option value="keep">삭제 상태 유지</option><option value="restore">회원 복원</option>'
      : member.authRole === "admin"
        ? '<option value="keep">현재 상태 유지</option>'
        : '<option value="keep">현재 상태 유지</option><option value="deactivate">회원 삭제 (복구 가능)</option>';
    actionFields = `
      <div class="member-management-form-grid">
        ${memberManualProfileFields(member)}
        ${linkControl}
        <label class="form-field span-2"><span>회원 상태</span><select name="memberStatusAction">${statusOptions}</select></label>
      </div>
      ${record || ticket ? memberManagementDatabaseFields({
        member,
        ticket,
        record,
        product,
        coachRoles,
        coachRoleId,
        partnerOptions,
        includeTicketStatus: Boolean(ticket),
      }) : ""}
      <p class="member-management-rule">같은 이름만으로는 자동 연결하지 않습니다. 전화번호가 같은 한 명만 추천하며 관리자가 최종 확인합니다.</p>`;
  } else if (isCreate) {
    actionFields = products.length && coachRoles.length ? `
      <div class="member-management-form-grid">
        ${memberManualProfileFields()}
        <label class="form-field span-2"><span>회원권</span><select name="productId" required>
          ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")} · ${memberManagementScheduleScopeLabel(memberManagementProductScheduleScope(item))}</option>`).join("")}
        </select></label>
      </div>
      ${memberManagementDatabaseFields({ member, ticket: null, record: null, product, coachRoles, coachRoleId, partnerOptions, isCreate: true })}
      <p class="member-management-rule">저장하면 실서버 회원과 회원권이 함께 생성되어 기존 회원과 동일하게 수정·만료·시간표 등록을 할 수 있습니다.</p>` : `<p class="form-message danger">사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "assign") {
    actionFields = products.length && coachRoles.length ? `
      <div class="member-management-form-grid">
        <label class="form-field span-2"><span>판매중 회원권</span><select name="productId" required>
          ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")} · ${memberManagementScheduleScopeLabel(memberManagementProductScheduleScope(item))}</option>`).join("")}
        </select></label>
      </div>
      ${memberManagementDatabaseFields({ member, ticket: null, record, product, coachRoles, coachRoleId, partnerOptions, existingPayment: unlinkedPayment, isAssign: true })}
      <p class="member-management-rule">판매 중인 상품을 선택하면 기간과 회차가 자동 입력됩니다. 저장 후 시간표에서 정규 수업을 등록합니다.</p>` : `<p class="form-message danger">사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "correct") {
    actionFields = operationsRole() === "admin" ? `
      ${memberManagementDatabaseFields({ member, ticket, record, product, coachRoles, coachRoleId, partnerOptions, includeTicketStatus: true })}
      <p class="member-management-rule">레슨 방식·종류·요일·횟수·결제 메모를 한 번에 수정합니다. 기존 결제 증빙은 변경하지 않습니다.</p>` : `
      <div class="member-management-form-grid">
        <label class="form-field"><span>총횟수</span><input name="totalSessions" type="number" min="1" step="1" value="${defaultTotal}" required /></label>
        <label class="form-field"><span>소진횟수</span><input name="usedSessions" type="number" min="0" step="1" value="${defaultUsed}" required /></label>
        <label class="form-field"><span>잔여횟수</span><input name="remainingSessions" type="number" min="0" step="1" value="${defaultRemaining}" readonly aria-readonly="true" required /><small>자동 계산</small></label>
        <label class="form-field"><span>시작일</span><input name="startsOn" type="date" value="${defaultStartsOn}" required /></label>
        <label class="form-field"><span>만료일</span><input name="expiresOn" type="date" value="${defaultExpiresOn}" required /></label>
        <label class="form-field"><span>이용 구분</span><select name="scheduleScope" required>
          <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일권 (월~금)</option>
          <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말권 (토·일)</option>
          <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합권 (월~일)</option>
        </select></label>
        <label class="form-field"><span>회원권 상태</span><select name="ticketStatus" ${operationsRole() === "admin" ? "" : "disabled"} required>
          <option value="active" ${ticketStatus === "active" ? "selected" : ""}>사용 중</option>
          <option value="paused" ${ticketStatus === "paused" ? "selected" : ""}>일시정지</option>
          ${ticketStatus === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
          <option value="expired" ${ticketStatus === "expired" ? "selected" : ""}>만료</option>
        </select></label>
      </div>
      <p class="member-management-rule">총횟수는 소진횟수와 잔여횟수의 합이어야 합니다. 상태·기간·횟수·평일/주말 변경은 미래 시간표에도 함께 반영됩니다.</p>`;
  } else if (action === "reenroll") {
    actionFields = products.length && coachRoles.length ? `
      <div class="member-management-form-grid">
        <label class="form-field span-2"><span>새 회원권</span><select name="productId" required>
          ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")}</option>`).join("")}
        </select></label>
        <label class="form-field span-2"><span>담당 코치</span><select name="coachRoleId" required>
          ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
        </select></label>
        <label class="form-field"><span>총횟수</span><input name="totalSessions" type="number" min="1" step="1" value="${defaultTotal}" required /></label>
        <label class="form-field"><span>소진횟수</span><input name="usedSessions" type="number" min="0" step="1" value="0" required /></label>
        <label class="form-field"><span>잔여횟수</span><input name="remainingSessions" type="number" min="0" step="1" value="${defaultRemaining}" readonly aria-readonly="true" required /><small>자동 계산</small></label>
        <label class="form-field"><span>시작일</span><input name="startsOn" type="date" value="${defaultStartsOn}" required /></label>
        <label class="form-field"><span>만료일</span><input name="expiresOn" type="date" value="${defaultExpiresOn}" required /></label>
        <label class="form-field"><span>등록 금액</span><input name="purchasedPrice" type="number" min="0" step="1000" value="${Number(product?.cash_price || product?.card_price || ticket?.amount || 0)}" required /></label>
      </div>
      <p class="member-management-rule">과거 회원권은 그대로 보관하고 새 회원권을 만듭니다. 2대1 파트너도 함께 연결됩니다.</p>` : `<p class="form-message danger">같은 지점·수업형태의 사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "expire") {
    actionFields = `<div class="member-management-warning"><strong>남은 횟수는 이력으로 보존됩니다.</strong><span>앞으로 예정된 수업은 취소되고 회원은 만료회원으로 이동합니다.</span></div>`;
  } else if (action === "force_delete") {
    actionFields = `<div class="member-management-warning danger"><strong>회원권과 연결 수업을 강제 삭제합니다.</strong><span>완료 수업의 차감 횟수는 복원한 뒤 수업·회원권 행을 제거합니다. 결제·환불 증빙과 감사 기록은 분리 보존합니다.</span></div>`;
  } else if (action === "deactivate") {
    actionFields = `<div class="member-management-warning danger"><strong>운영 목록에서 삭제합니다.</strong><span>결제·수업·감사 기록은 보존되며 삭제회원 탭에서 다시 복원할 수 있습니다.</span></div>`;
  } else if (action === "permanent_delete") {
    actionFields = `<div class="member-management-warning danger"><strong>삭제회원 목록에서 완전히 제거합니다.</strong><span>개인정보와 앱 연결은 삭제하고 결제·환불·감사 증빙은 익명 상태로 보존합니다. 이 작업은 되돌릴 수 없습니다.</span></div>`;
  } else if (action === "restore") {
    actionFields = `<div class="member-management-warning"><strong>회원 계정을 운영 목록으로 복원합니다.</strong><span>과거 회원권은 자동으로 되살리지 않으며, 복원 후 다시 수강 등록할 수 있습니다.</span></div>`;
  }

  target.innerHTML = `
    <div class="member-management-summary">
      <span>${escapeHtml(member.name)}</span>
      <strong>${memberManagementActionLabel(action)}</strong>
      <small>${ticket ? `${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product)} · ${ticketUsageLabel(ticket)}` : isCreate ? "실서버 회원·회원권 동시 등록" : memberStatusLabel(member)}</small>
    </div>
    <form id="memberManagementForm" class="member-management-form">
      ${actionFields}
      <div id="memberManagementMessage" class="form-message danger" role="status">${escapeHtml(memberManagementModalState.message || "")}</div>
      <div class="modal-actions">
        <button class="ghost-button" type="button" data-close-member-management>취소</button>
        <button class="${destructive ? "danger-button" : "primary-button"}" type="submit" ${(["assign", "reenroll"].includes(action) || isCreate) && (!products.length || !coachRoles.length) ? "disabled" : ""}>${memberManagementActionLabel(action)} 확정</button>
      </div>
    </form>`;
}

function openMemberManagementModal(member, action, ticketId = "") {
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === ticketId) || null;
  if (!member?.serverUserId || !memberManagementActionAllowed(action, ticket)) {
    showToast("이 작업을 처리할 권한이 없습니다.");
    return;
  }
  Object.assign(memberManagementModalState, {
    memberId: member.id,
    action,
    ticketId,
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
  if (action === "profile" && !member.authLinked) loadMemberLinkCandidates(member);
  setTimeout(() => $("#memberManagementForm input, #memberManagementForm select")?.focus(), 0);
}

function openManualMemberModal() {
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 계정으로 로그인해야 회원을 추가할 수 있습니다.");
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
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
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
  });
  const target = $("#memberManagementModalContent");
  if (target) target.innerHTML = "";
}

function applyMemberManagementProductDefaults(form) {
  const product = (adminLiveDataState.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || !form) return;
  const total = Number(product.total_sessions) || 1;
  const start = memberManagementDate(form.elements.startsOn?.value);
  const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
  form.elements.totalSessions.value = total;
  form.elements.usedSessions.value = 0;
  form.elements.remainingSessions.value = total;
  form.elements.expiresOn.value = addMemberManagementDays(start, validityDays - 1);
  if (form.elements.paymentAmount) form.elements.paymentAmount.value = Number(product.cash_price || product.card_price || 0);
  if (form.elements.scheduleScope) form.elements.scheduleScope.value = memberManagementProductScheduleScope(product);
  if (form.elements.weeklyFrequency) form.elements.weeklyFrequency.value = Number(product.frequency_per_week) || 1;
  if (form.elements.lessonType) form.elements.lessonType.value = Number(product.group_size || 1) === 2 ? "one_on_two" : "one_on_one";
  syncMemberManagementScopeFields(form);
  syncManualMemberPartnerField(form);
}

function syncMemberManagementBalance(form) {
  if (!form?.elements?.totalSessions || !form.elements.usedSessions || !form.elements.remainingSessions) return;
  const total = Math.max(0, Number(form.elements.totalSessions.value) || 0);
  const used = Math.max(0, Number(form.elements.usedSessions.value) || 0);
  form.elements.remainingSessions.value = Math.max(0, total - used);
}

function syncManualMemberPartnerField(form) {
  if (!form?.elements?.partnerUserId) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const groupProduct = form.elements.lessonType
    ? form.elements.lessonType.value === "one_on_two"
    : Number(product?.group_size || 1) === 2;
  const field = form.querySelector("[data-manual-member-partner-field]");
  form.elements.partnerUserId.disabled = !groupProduct;
  form.elements.partnerUserId.required = groupProduct;
  if (form.elements.partnerSearch) form.elements.partnerSearch.disabled = !groupProduct;
  if (!groupProduct) form.elements.partnerUserId.value = "";
  field?.classList.toggle("is-disabled", !groupProduct);
  filterManualMemberPartnerOptions(form);
}

function maskMemberPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return "연락처 확인 필요";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function filterManualMemberPartnerOptions(form) {
  if (!form?.elements?.partnerUserId) return;
  const select = form.elements.partnerUserId;
  const currentValue = select.value;
  const keyword = String(form.elements.partnerSearch?.value || "").trim().toLowerCase();
  const options = manualMemberPartnerOptions().filter((user) => (
    !keyword
    || [user.name, user.nickname, user.phone].some((value) => String(value || "").toLowerCase().includes(keyword))
  ));
  select.innerHTML = [
    `<option value="">${keyword && !options.length ? "검색 결과 없음" : "파트너 선택"}</option>`,
    ...options.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || "회원")}${user.phone ? ` · ${escapeHtml(maskMemberPhone(user.phone))}` : ""}</option>`),
  ].join("");
  if (options.some((user) => String(user.id) === String(currentValue))) select.value = currentValue;
}

function syncMemberManagementScopeFields(form) {
  if (!form?.elements?.scheduleScope) return;
  const scope = form.elements.scheduleScope.value;
  const frequency = form.elements.weeklyFrequency;
  if (frequency) {
    const threeTimes = [...frequency.options].find((option) => option.value === "3");
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

function syncMemberManagementProductForMethod(form) {
  if (!form?.elements?.productId || !form.elements.scheduleScope || !form.elements.weeklyFrequency || !form.elements.lessonType) return;
  const groupSize = form.elements.lessonType.value === "one_on_two" ? 2 : 1;
  const currentProduct = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId.value);
  const matchingProduct = memberManagementProducts().find((item) => (
    (!currentProduct?.branch_id || item.branch_id === currentProduct.branch_id)
    && item.schedule_scope === form.elements.scheduleScope.value
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

function memberManagementNullableNumber(input) {
  const value = String(input?.value || "").trim();
  return value === "" ? null : Number(value);
}

function memberManagementErrorText(error) {
  const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
  if (raw.includes("admin_live_refresh_failed_after_write")) return "서버 저장은 요청됐지만 결과를 다시 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.";
  if (raw.includes("member_management_write_not_confirmed")) return "서버에서 변경 결과를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.";
  if (raw.includes("payment_product_mismatch")) return "기존 결제에 연결된 회원권과 선택한 회원권이 다릅니다. 결제 회원권을 선택해 주세요.";
  if (raw.includes("payment_already_linked")) return "이 결제는 이미 다른 회원권에 연결되어 있습니다.";
  if (raw.includes("payment_member_mismatch")) return "기존 결제 회원과 발급 대상 회원이 맞지 않습니다.";
  if (raw.includes("payment_not_verified")) return "확인 완료된 결제만 회원권에 연결할 수 있습니다.";
  if (raw.includes("existing_payment_link_failed")) return "회원권은 발급됐지만 기존 결제 연결을 확인하지 못했습니다. 새로고침 후 결제/정산에서 확인해 주세요.";
  if (raw.includes("member_ticket_management_forbidden") || raw.includes("admin_role_required")) return "현재 계정에는 이 작업 권한이 없습니다.";
  if (raw.includes("force_delete_reason_required")) return "강제 삭제 사유를 5자 이상 입력해 주세요.";
  if (raw.includes("management_reason_required")) return "변경 사유를 두 글자 이상 입력해 주세요.";
  if (raw.includes("ticket_balance_invalid")) return "총횟수는 소진횟수와 잔여횟수를 더한 값이어야 합니다.";
  if (raw.includes("ticket_date_range_invalid")) return "시작일과 만료일 순서를 확인해 주세요.";
  if (raw.includes("source_ticket_still_active") || raw.includes("active_ticket_already_exists")) return "현재 사용 중인 동일 회원권이 있어 재등록할 수 없습니다.";
  if (raw.includes("member_inactive_restore_first")) return "삭제회원은 먼저 회원 복원을 해 주세요.";
  if (raw.includes("group_ticket_requires_two_participants")) return "2대1 회원권의 파트너 연결을 먼저 확인해 주세요.";
  if (raw.includes("group_partner_required")) return "2대1 회원권은 파트너를 선택해야 합니다.";
  if (raw.includes("member_phone_already_exists")) return "같은 휴대전화 번호의 회원이 이미 있습니다. 기존 회원을 검색해 주세요.";
  if (raw.includes("member_name_required")) return "회원 이름을 두 글자 이상 입력해 주세요.";
  if (raw.includes("invalid_schedule_scope")) return "평일, 주말 또는 혼합을 선택해 주세요.";
  if (raw.includes("invalid_ticket_status")) return "회원권 상태를 다시 선택해 주세요.";
  if (raw.includes("active_ticket_requires_remaining_sessions")) return "사용 중 또는 일시정지 상태는 잔여 횟수가 1회 이상이어야 합니다.";
  if (raw.includes("active_ticket_date_expired")) return "이미 지난 만료일로는 회원권을 사용 중 상태로 바꿀 수 없습니다.";
  if (raw.includes("pending_payment_status_locked")) return "결제 대기 회원권 상태는 결제 확인 절차에서만 변경할 수 있습니다.";
  if (raw.includes("voided_ticket_locked") || raw.includes("ticket_already_voided")) return "이미 삭제 처리된 회원권은 수정할 수 없습니다.";
  if (raw.includes("ticket_has_verified_payment")) return "결제가 확인된 회원권은 삭제 대신 만료 또는 환불 처리를 사용해 주세요.";
  if (raw.includes("admin_account_cannot_be_deactivated_here")) return "관리자 계정은 회원관리에서 삭제할 수 없습니다.";
  if (raw.includes("approved_branch_coach_required")) return "같은 지점의 승인 코치를 선택해 주세요.";
  if (raw.includes("ticket_not_found") || raw.includes("product_not_found")) return "회원권 정보가 변경됐습니다. 새로고침 후 다시 선택해 주세요.";
  if (raw.includes("refunded_ticket_locked")) return "환불 완료 회원권은 수정할 수 없습니다.";
  if (raw.includes("target_member_already_linked")) return "이미 다른 앱 계정이 연결된 회원입니다.";
  if (raw.includes("source_signup_not_linked") || raw.includes("signup_profile_not_found")) return "가입 계정이 변경됐습니다. 새로고침 후 다시 선택해 주세요.";
  if (raw.includes("source_signup_has_operational_data")) return "선택한 가입 계정에 별도 회원권이나 수업이 있어 자동 병합할 수 없습니다. 관리자 검토가 필요합니다.";
  if (raw.includes("nickname_already_taken") || raw.includes("uq_tn_users_normalized_nickname")) return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (raw.includes("nickname_length_invalid")) return "닉네임은 2~16자로 입력해 주세요.";
  if (raw.includes("member_phone_invalid")) return "휴대전화 번호를 확인해 주세요.";
  if (raw.includes("member_birth_year_invalid")) return "출생연도를 확인해 주세요.";
  if (raw.includes("invalid_weekly_frequency")) return "평일은 주 1~3회, 주말은 주 1~2회로 선택해 주세요.";
  if (raw.includes("invalid_lesson_type")) return "레슨 종류를 1:1 또는 1:2로 선택해 주세요.";
  if (raw.includes("invalid_lesson_day") || raw.includes("lesson_days_must_be_array")) return "평일·주말 구분에 맞는 레슨 요일을 선택해 주세요.";
  if (raw.includes("lesson_method_product_mismatch")) return "레슨 방식과 종류에 맞는 회원권 상품을 선택해 주세요.";
  if (raw.includes("active_member_ticket_required")) return "수강중 회원은 활성 회원권과 1회 이상의 잔여 회차가 필요합니다.";
  if (raw.includes("member_required") || raw.includes("member_not_found")) return "회원 정보를 다시 불러온 뒤 수정해 주세요.";
  if (raw.includes("terminal_ticket_locked")) return "환불 또는 강제삭제가 끝난 회원권은 수정할 수 없습니다.";
  if (raw.includes("invalid_member_database_status")) return "회원 상태를 다시 확인해 주세요.";
  if (raw.includes("active_product_required")) return "사용 가능한 회원권 상품을 선택해 주세요.";
  if (raw.includes("member_active_ticket_exists")) return "이미 사용 중이거나 결제 대기 중인 회원권이 있습니다.";
  if (raw.includes("ticket_price_invalid")) return "결제금액은 0원 이상으로 입력해 주세요.";
  if (raw.includes("separate_group_structure_requires_team_edit")) return "1:2 팀의 종류·파트너 변경은 팀 설정에서 함께 처리해 주세요.";
  return "처리에 실패했습니다. 입력값과 서버 적용 상태를 확인해 주세요.";
}

function normalizedMemberPhone(value = "") {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizedCoachLinkName(value = "") {
  return String(value || "")
    .trim()
    .replace(/(?:코치|coach)\s*$/iu, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizedRpcResult(result) {
  return Array.isArray(result) ? result[0] || {} : result || {};
}

function memberManagementWriteVerification(action, payload, result, statusAction = "keep") {
  const normalizedResult = normalizedRpcResult(result);
  const userId = normalizedResult.userId || payload?.userId || "";
  const ticketId = normalizedResult.ticketId || payload?.ticketId || "";
  const serverUser = (adminLiveDataState.users || []).find((user) => user.id === userId);
  const serverTicket = (adminLiveDataState.tickets || []).find((ticket) => ticket.serverTicketId === ticketId);

  if (action === "create") {
    return serverUser && serverTicket && serverTicket.productId === payload?.productId ? "" : "member_management_write_not_confirmed:create";
  }
  if (action === "assign") {
    return serverUser && serverTicket && serverTicket.productId === payload?.productId ? "" : "member_management_write_not_confirmed:assign";
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
    const ticketValuesSaved = serverTicket
      && Number(serverTicket.total) === Number(payload?.totalSessions)
      && Number(serverTicket.used) === Number(payload?.usedSessions)
      && Number(serverTicket.remaining) === Number(payload?.remainingSessions)
      && serverTicket.status === payload?.ticketStatus;
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
  if (action === "expire") return serverTicket?.status === "expired" ? "" : "member_management_write_not_confirmed:expire";
  if (action === "force_delete") return serverTicket ? "member_management_write_not_confirmed:force_delete" : "";
  if (action === "permanent_delete") return !serverUser || serverUser.permanently_deleted_at ? "" : "member_management_write_not_confirmed:permanent_delete";
  if (action === "reenroll") return serverTicket && ["active", "paused"].includes(serverTicket.status) ? "" : "member_management_write_not_confirmed:reenroll";
  if (action === "deactivate") return serverUser?.status === "inactive" ? "" : "member_management_write_not_confirmed:deactivate";
  if (action === "restore") return serverUser?.status === "active" ? "" : "member_management_write_not_confirmed:restore";
  return "";
}

function memberManagementDatabasePayload(form, member, ticket, reason) {
  const record = memberDatabaseRecord(member, ticket);
  const hasControl = (name) => Boolean(form.elements.namedItem(name));
  const product = (adminLiveDataState.products || []).find((item) => item.id === (form.elements.productId?.value || ticket?.productId));
  const ticketStatus = form.elements.ticketStatus?.value || ticket?.status || (ticket ? "active" : "");
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
    existingPaymentId: hasControl("existingPaymentId") ? form.elements.existingPaymentId.value || null : null,
    note: hasControl("note") ? form.elements.note.value.trim() || null : record?.admin_note || null,
    partnerUserId: hasControl("partnerUserId")
      ? form.elements.partnerUserId.disabled ? null : form.elements.partnerUserId.value || null
      : memberTicketPartnerUserId(ticket, member) || null,
    ticketStatus: ticketStatus || null,
    recordStatus,
    reason,
  };
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

  syncMemberManagementBalance(form);
  const reason = automaticMemberManagementReason(action);
  const managementPayload = ["create", "assign", "profile", "correct"].includes(action)
    ? memberManagementDatabasePayload(form, isCreate ? null : member, ticket, reason)
    : null;
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
    const selectedProduct = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
    const couponProduct = selectedProduct?.is_coupon === true || selectedProduct?.product_kind === "coupon";
    const requiredLessonDays = Math.max(1, Number(form.elements.weeklyFrequency?.value) || 1);
    const selectedLessonDays = memberManagementSelectedDays(form);
    if (activeRecord && !couponProduct && selectedLessonDays.length !== requiredLessonDays) {
      if (message) message.textContent = `주 ${requiredLessonDays}회 회원권은 레슨 요일을 ${requiredLessonDays}개 직접 선택해 주세요.`;
      return;
    }
    if (form.elements.lessonType.value === "one_on_two" && !form.elements.partnerUserId?.value) {
      if (message) message.textContent = "1:2 레슨 파트너를 선택해 주세요.";
      return;
    }
    const paymentAmount = memberManagementNullableNumber(form.elements.paymentAmount) || 0;
    if (paymentAmount > 0 && (!form.elements.paymentDate?.value || !form.elements.paymentMethod?.value)) {
      if (message) message.textContent = "결제금액이 있으면 결제일자와 결제수단도 입력해 주세요.";
      return;
    }
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = "처리 중";
  }
  if (message) message.textContent = "";

  try {
    let result = null;
    if (isCreate) {
      result = await client.rpc("tn_admin_create_member_database_record", {
        target_record: managementPayload,
      });
      state.memberFilter = "active";
    } else if (action === "assign") {
      const existingPaymentId = managementPayload?.existingPaymentId || "";
      const assignmentPayload = existingPaymentId
        ? { ...managementPayload, paymentAmount: 0, paymentDate: null, paymentMethod: null }
        : managementPayload;
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
    } else if (action === "profile") {
      if (memberDatabaseRecord(member, ticket) || ticket) {
        result = await client.rpc("tn_admin_update_member_database_record_preserving_schedule", {
          target_record: managementPayload,
        });
      } else {
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
      }
      const sourceSignupUserId = form.elements.sourceSignupUserId?.value || "";
      if (sourceSignupUserId) {
        result = await client.rpc("tn_admin_merge_member_login", {
          target_member_user_id: member.serverUserId,
          source_signup_user_id: sourceSignupUserId,
          target_reason: reason,
        });
      }
      if (["deactivate", "restore"].includes(statusAction)) {
        await client.rpc("tn_set_member_operational_status", {
          target_user_id: member.serverUserId,
          target_status: statusAction === "deactivate" ? "inactive" : "active",
          target_reason: reason,
        });
        state.memberFilter = statusAction === "deactivate" ? "inactive" : "expired";
      }
    } else if (action === "correct") {
      result = operationsRole() === "admin"
        ? await client.rpc("tn_admin_update_member_database_record_preserving_schedule", {
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

    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const verificationError = memberManagementWriteVerification(action, managementPayload, result, statusAction);
    if (verificationError) throw new Error(verificationError);
    closeMemberManagementModal();
    const normalizedResult = normalizedRpcResult(result);
    if ((isCreate || action === "assign") && normalizedResult.userId) {
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
    showToast(`${memberManagementActionLabel(action)} 완료`);
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    if (message) message.textContent = memberManagementModalState.message;
    showToast(memberManagementModalState.message);
    if (submit) {
      submit.disabled = false;
      submit.textContent = `${memberManagementActionLabel(action)} 확정`;
    }
  }
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

function renderMemberManagementPolicySettings() {
  const target = $("#memberManagementPolicySettings");
  if (!target) return;
  target.innerHTML = `
    <div class="member-management-policy-grid">
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanCorrectTicket" ${memberManagementPolicy.coachCanCorrectTicket ? "checked" : ""} /><span>코치가 본인 담당 회원권 숫자·기간 수정</span></label>
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanExpireTicket" ${memberManagementPolicy.coachCanExpireTicket ? "checked" : ""} /><span>코치가 본인 담당 회원권 만료 처리</span></label>
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanReenroll" ${memberManagementPolicy.coachCanReenroll ? "checked" : ""} /><span>코치가 본인 담당 만료회원 재등록</span></label>
    </div>
    <div class="data-action-row">
      <button id="saveMemberManagementPolicy" class="primary-button" type="button" ${adminApprovalReady() ? "" : "disabled"}>권한 저장</button>
    </div>
    <small>회원 삭제·복원은 항상 관리자만 가능합니다. 관리자는 추가 PIN이나 사유 입력 없이 처리하며, 계정·시각·이전 값은 자동으로 감사 이력에 남습니다.</small>`;
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
    updatedAt: settings.updatedAt || settings.updated_at || "",
  };
}

function notificationTemplateLabel(templateKey = "") {
  return ({
    lesson_day_before: "수업 하루 전",
    lesson_30_minutes_before: "수업 30분 전",
    coupon_next_booking: "쿠폰 다음 일정",
    ticket_low_remaining: "잔여횟수",
    ticket_expiring: "만료 임박",
    ticket_expired: "만료일",
    payment_cancelled: "결제취소",
    payment_refunded: "환불",
  })[templateKey] || "앱 알림";
}

function normalizeNotificationOverview(payload = {}, source = "server") {
  const recent = Array.isArray(payload.recent) ? payload.recent : [];
  return {
    status: source === "server" ? "ready" : "limited",
    queued: Number(payload.queued) || 0,
    sentToday: Number(payload.sentToday ?? payload.sent_today) || 0,
    failed: Number(payload.failed) || 0,
    activeDevices: payload.activeDevices === null || payload.activeDevices === undefined
      ? null
      : Number(payload.activeDevices),
    recent,
    checkedAt: payload.generatedAt || payload.generated_at || new Date().toISOString(),
    message: source === "server" ? "실서버 발송 현황" : "기본 발송 현황",
  };
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

function exportVisibleMembers() {
  const visibleMembers = filteredMembers();
  const rows = [["이름", "전화번호", "출생년도", "거주동", "성별", "레슨강사", "레슨방식", "레슨종류", "레슨요일", "레슨시작일", "총회차", "소진회차", "잔여회차", "결제일자", "결제수단", "결제금액", "비고"]].concat(visibleMembers.map((member) => {
    const ticket = memberCurrentTicket(member);
    const record = memberDatabaseRecord(member, ticket);
    const payment = record ? null : latestMemberPayment(member);
    return [
      member.name,
      member.phone || "",
      member.birthYear || "",
      member.neighborhood || "",
      memberGenderLabel(member.gender),
      member.coach,
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
  }));
  downloadRowsAsCsv(`tennis-note-members-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast(`${visibleMembers.length}명 회원 목록을 내보냈습니다`);
}

function memberDetailDateLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "없음";
  const date = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("ko-KR");
}

function memberGenderLabel(value = "") {
  const labels = { female: "여", male: "남", other: "기타", prefer_not: "미응답" };
  return labels[value] || value || "미입력";
}

function memberLessonPlanLabel(member, ticket) {
  const record = memberDatabaseRecord(member, ticket);
  if (!ticket && !record) return member.lessonType || "회원권 없음";
  return [
    memberManagementLessonMethodLabel(record, ticket),
    memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
    ticket?.durationMinutes ? `${ticket.durationMinutes}분` : "",
  ].filter(Boolean).join(" · ");
}

function memberTicketDisplayLabel(member, ticket = memberCurrentTicket(member)) {
  if (!ticket) return "미등록";
  return getTicketDisplayProduct(ticket) || ticket.product || "회원권";
}

function memberLessonRows(member) {
  const memberName = String(member?.name || "").trim();
  const serverUserIds = memberServerUserIds(member);
  return lessons.filter((lesson) => {
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

function memberScheduleSummary(member) {
  const ticket = memberCurrentTicket(member);
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

function memberRemarkLabel(member) {
  const ticket = memberCurrentTicket(member);
  const record = memberDatabaseRecord(member, ticket);
  const payment = latestMemberPayment(member);
  const parts = [];
  const note = String(record?.admin_note || member.note || "").trim();
  if (note && !["실서버 회원권 연결", "회원권 등록 또는 연장 확인 필요", "운동노트만 이용 중", "가입서 제출 완료 · 결제 확인 필요"].includes(note)) {
    parts.push(note);
  }
  if (Number(payment?.discountAmount || 0) > 0) parts.push(`할인 ${money.format(Number(payment.discountAmount))}원`);
  return parts.join(" · ") || "-";
}

function latestMemberPayment(member) {
  const record = memberDatabaseRecord(member, memberCurrentTicket(member));
  if (record && (record.payment_recorded_on || record.payment_method || Number(record.payment_amount) > 0)) {
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

function renderMemberCoachAssignment(ticket) {
  if (!ticket?.serverTicketId) return "";
  const ticketCoach = coaches.find((coach) => coach.id === ticket.coachId);
  const branchCoaches = coaches.filter((coach) =>
    coach.serverRoleId &&
    coach.status === "active" &&
    (!ticket.branchId || !coach.branchId || coach.branchId === ticket.branchId)
  );
  return `
    <div class="member-coach-assignment">
      <label>
        <span>담당 코치 지정</span>
        <select data-ticket-coach-select="${escapeHtml(ticket.serverTicketId)}" ${adminApprovalReady() ? "" : "disabled"}>
          <option value="">미배정</option>
          ${branchCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}" ${coach.serverRoleId === ticketCoach?.serverRoleId ? "selected" : ""}>${escapeHtml(coach.name)}</option>`).join("")}
        </select>
      </label>
      <button class="primary-button" type="button" data-save-ticket-coach="${escapeHtml(ticket.serverTicketId)}" ${adminApprovalReady() ? "" : "disabled"}>저장</button>
      <small>${adminApprovalReady() ? "이 이용권으로 신청 가능한 코치를 지정합니다." : "관리자 로그인 후 변경할 수 있습니다."}</small>
    </div>`;
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

function memberOwnsTicket(ticket, member) {
  if (!ticket || !member) return false;
  const userIds = memberServerUserIds(member);
  if (userIds.length) return userIds.includes(ticket.serverUserId);
  const ownerName = (adminLiveDataState.users || []).find((user) => user.id === ticket.serverUserId)?.name;
  return ownerName === member.name;
}

function memberTicketPartnerUserId(ticket, member) {
  if (!ticket || !member) return "";
  const memberUserIds = memberServerUserIds(member);
  const participantUserIds = ticketParticipantUserIds(ticket);
  if (memberUserIds.length) {
    const participantPartner = participantUserIds.find((userId) => !memberUserIds.includes(userId));
    if (participantPartner) return participantPartner;
    const groupLink = (adminLiveDataState.groupTicketLinks || []).find((link) => (
      link.ticket_id === ticket.serverTicketId
      || (memberUserIds.includes(link.user_id) && link.ticket_id === ticket.serverTicketId)
    ));
    if (groupLink) {
      const groupPartner = (adminLiveDataState.groupMembers || []).find((row) => (
        row.group_account_id === groupLink.group_account_id
        && !memberUserIds.includes(row.user_id)
      ));
      if (groupPartner?.user_id) return groupPartner.user_id;
    }
    return "";
  }
  const partnerName = ticketPartnerNames(ticket, member)[0];
  return (adminLiveDataState.users || []).find((user) => user.name === partnerName)?.id || "";
}

function renderMemberTicketLessonSetup(member, ticket) {
  if (!ticket?.serverTicketId) return "";
  const groupSize = Number(ticket.groupSize) === 2 || ticket.lessonKind === "2대1" ? 2 : 1;
  const durationMinutes = getTicketDurationMinutes(ticket);
  const owner = (adminLiveDataState.users || []).find((user) => user.id === ticket.serverUserId);
  const selectedIsOwner = memberOwnsTicket(ticket, member);
  const partnerUserId = memberTicketPartnerUserId(ticket, member);
  const partner = (adminLiveDataState.users || []).find((user) => user.id === partnerUserId);
  const candidates = selectedIsOwner
    ? (adminLiveDataState.users || [])
      .filter((user) => user.id !== ticket.serverUserId && (user.status === "active" || user.id === partnerUserId))
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"))
    : [partner].filter(Boolean);
  const editable = adminApprovalReady() && selectedIsOwner;
  const partnerName = partner?.name || ticketPartnerNames(ticket, member)[0] || "확인 필요";
  const relationshipLabel = groupSize === 2
    ? `파트너 ${partnerName}${selectedIsOwner ? "" : " · 대표 이용권 연결"}`
    : `대표 회원 ${owner?.name || member.name || "확인 필요"}`;
  return `
    <div class="member-ticket-lesson-setup" data-ticket-lesson-setup="${escapeHtml(ticket.serverTicketId)}" data-ticket-owner-view="${selectedIsOwner ? "true" : "false"}">
      <div class="member-ticket-lesson-setup-heading">
        <strong>수업 설정</strong>
        <span>${escapeHtml(relationshipLabel)}</span>
      </div>
      <div class="member-ticket-lesson-setup-fields">
        <label>
          <span>수업 형태</span>
          <select data-ticket-group-size ${editable ? "" : "disabled"}>
            <option value="1" ${groupSize === 1 ? "selected" : ""}>개인 1대1</option>
            <option value="2" ${groupSize === 2 ? "selected" : ""}>2대1 그룹</option>
          </select>
        </label>
        <label>
          <span>수업 시간</span>
          <select data-ticket-duration-minutes ${editable ? "" : "disabled"}>
            ${[20, 30, 40].map((minutes) => `<option value="${minutes}" ${durationMinutes === minutes ? "selected" : ""}>${minutes}분</option>`).join("")}
          </select>
        </label>
        <label class="member-ticket-partner-field" data-ticket-partner-field ${groupSize === 2 ? "" : "hidden"}>
          <span>파트너</span>
          <div class="member-ticket-partner-control">
            <input type="search" data-ticket-partner-search placeholder="이름 또는 연락처 검색" autocomplete="off" ${editable && groupSize === 2 ? "" : "disabled"}>
            <select data-ticket-partner-user ${editable && groupSize === 2 ? "" : "disabled"}>
              <option value="">파트너 선택</option>
              ${candidates.map((user) => `<option value="${escapeHtml(user.id)}" data-partner-search="${escapeHtml(`${user.name || ""} ${user.phone || ""}`.trim())}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "이름 확인 필요")}${user.phone ? ` · ${escapeHtml(user.phone)}` : ""}</option>`).join("")}
            </select>
            <small class="member-ticket-partner-result" data-ticket-partner-result aria-live="polite" hidden></small>
          </div>
        </label>
        <button class="primary-button" type="button" data-save-ticket-lesson-setup="${escapeHtml(ticket.serverTicketId)}" ${editable ? "" : "disabled"}>${selectedIsOwner ? "저장" : "대표 회원에서 수정"}</button>
      </div>
      <small>${editable
        ? "저장하면 2대1 팀, 두 회원 정보와 예정된 시간표가 함께 연결됩니다. 완료된 수업은 유지됩니다."
        : selectedIsOwner
          ? "관리자 로그인 후 변경할 수 있습니다."
          : `${escapeHtml(owner?.name || "대표 회원")} 이용권에 연결된 그룹입니다. 파트너 변경은 대표 회원 상세에서 진행해주세요.`}</small>
    </div>`;
}

function normalizedPartnerSearchValue(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s-]+/g, "");
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

function memberTicketLessonSetupError(error) {
  const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
  if (raw.includes("group_partner_required")) return "2대1 수업은 파트너를 선택해주세요";
  if (raw.includes("partner_must_be_different")) return "대표 회원과 다른 파트너를 선택해주세요";
  if (raw.includes("partner_not_found")) return "선택한 파트너 정보를 다시 확인해주세요";
  if (raw.includes("lesson_duration_conflict")) return "변경한 수업 시간이 다른 수업과 겹칩니다. 시간표를 먼저 조정해주세요";
  if (raw.includes("admin_role_required")) return "관리자 권한으로 로그인해주세요";
  return "수업 설정 저장에 실패했습니다";
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

function renderMembers() {
  const coachFilter = $("#memberCoachFilter");
  if (coachFilter) {
    const coachNames = [...new Set(members.map((member) => member.coach).filter(Boolean))];
    coachFilter.innerHTML = `<option value="all">전체 코치</option>${coachNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
    coachFilter.value = coachNames.includes(state.memberCoachFilter) ? state.memberCoachFilter : "all";
    state.memberCoachFilter = coachFilter.value;
  }
  if ($("#memberListSearch") && $("#memberListSearch").value !== state.memberSearch) $("#memberListSearch").value = state.memberSearch || "";
  if ($("#memberTicketFilter")) $("#memberTicketFilter").value = state.memberTicketFilter || "all";

  const filtered = filteredMembers();
  const filterCopy = memberFilterCopy[state.memberFilter] || memberFilterCopy.active;
  if ($("#memberFilterSummary")) $("#memberFilterSummary").textContent = `${filtered.length}${filterCopy.summary}`;
  renderMemberFilterSections();

  const selectedIndex = filtered.findIndex((member) => member.id === state.selectedMemberId);
  if (selectedIndex >= 0) state.memberListPage = Math.floor(selectedIndex / memberListPageSize);
  state.memberListPage = normalizeDashboardPage(filtered.length, state.memberListPage, memberListPageSize);
  const visibleMembers = filtered.slice(
    state.memberListPage * memberListPageSize,
    (state.memberListPage + 1) * memberListPageSize,
  );
  renderDashboardPager("#memberListPager", filtered.length, state.memberListPage, "member-directory", memberListPageSize);

  $("#memberRows").innerHTML = visibleMembers.length ? visibleMembers
    .map((member) => {
      const ticket = memberCurrentTicket(member);
      return `
        <tr class="${member.id === state.selectedMemberId ? "is-selected" : ""}" data-member-id="${member.id}">
          <td>
            <button class="member-link-button" type="button" data-select-member="${member.id}">
              ${avatarMarkup(member, "small")}
              <span>${escapeHtml(member.name)}</span>
            </button>
          </td>
          <td>${escapeHtml(member.coach || "미배정")}</td>
          <td><strong class="member-table-primary">${escapeHtml(memberTicketDisplayLabel(member, ticket))}</strong></td>
          <td>${escapeHtml(memberScheduleSummary(member))}</td>
          <td>${ticket ? ticketUsageLabel(ticket) : "-"}</td>
          <td>${memberStatusBadge(member)}</td>
          <td class="member-table-note">${escapeHtml(memberRemarkLabel(member))}</td>
        </tr>`;
    })
    .join("") : `<tr><td colspan="7" class="empty-text">${filterCopy.empty}</td></tr>`;

  const detailPanel = $("#memberDetail");
  const detailLayout = detailPanel?.closest(".member-directory-layout");
  const selected = visibleMembers.find((member) => member.id === state.selectedMemberId);
  detailPanel.hidden = !selected;
  detailLayout?.classList.toggle("is-detail-open", Boolean(selected));
  if (!selected) {
    state.selectedMemberId = null;
    detailPanel.innerHTML = "";
  }
  if (selected) {
    const selectedStatus = memberListStatus(selected);
    const selectedRecordCandidate = memberDatabaseRecord(selected, null);
    const selectedTicket = memberCurrentTicket(selected)
      || expiredTickets.find((ticket) => ticket.serverTicketId === selectedRecordCandidate?.current_ticket_id)
      || expiredTickets.find((ticket) => ticketBelongsToMember(ticket, selected))
      || null;
    const selectedRecord = memberDatabaseRecord(selected, selectedTicket);
    const enrollment = selected.enrollment || {};
    const recentPayment = latestMemberPayment(selected);
    const ticketName = selectedTicket
      ? getTicketDisplayProduct(selectedTicket) || selectedTicket.product
      : selectedStatus === "expired" ? "현재 회원권 없음" : selected.lessonType || "회원권 없음";
    const hasRecordedPayment = Boolean(selectedRecord && (
      selectedRecord.payment_recorded_on
      || selectedRecord.payment_method
      || Number(selectedRecord.payment_amount) > 0
    ));
    const paymentDate = selectedRecord
      ? selectedRecord.payment_recorded_on ? memberDetailDateLabel(selectedRecord.payment_recorded_on) : "미입력"
      : recentPayment ? memberDetailDateLabel(recentPayment.paidAt || recentPayment.verifiedAt || recentPayment.requestedAt) : "없음";
    const paymentSummary = selectedRecord
      ? hasRecordedPayment
        ? `${selectedRecord.payment_method ? paymentMethodLabel(selectedRecord.payment_method) : "미입력"} · ${money.format(Number(selectedRecord.payment_amount) || 0)}원`
        : "미입력"
      : recentPayment
        ? `${paymentMethodLabel(recentPayment.method)} · ${money.format(recentPayment.finalAmount || recentPayment.amount || 0)}원`
        : "결제 이력 없음";
    const lessonStart = selectedTicket
      ? selectedRecord?.lesson_start_on || selectedTicket.actualLessonStart || selectedTicket.purchased || ""
      : "";
    const totalSessions = selectedTicket ? selectedRecord?.total_sessions ?? selectedTicket.total : null;
    const usedSessions = selectedTicket ? selectedRecord?.used_sessions ?? selectedTicket.used : null;
    const remainingSessions = selectedTicket ? selectedRecord?.remaining_sessions ?? selectedTicket.remaining : null;
    detailPanel.innerHTML = `
      <div class="detail-header member-db-header">
        <div class="profile-line large">
          ${avatarMarkup(selected, "large")}
          <div>
            <h2>${escapeHtml(selected.name)}</h2>
            <span>회원 기본정보</span>
          </div>
        </div>
        <div class="member-detail-header-actions">
          ${memberStatusBadge(selected)}
          ${operationsRole() === "admin" ? `<button class="small-button" type="button" data-open-member-management="profile" data-member-management-ticket="${escapeHtml(selectedTicket?.serverTicketId || "")}">수정</button>` : ""}
          ${operationsRole() === "admin" && selectedStatus !== "inactive" && selected.authRole !== "admin"
            ? '<button class="ghost-button danger-button" type="button" data-open-member-management="deactivate">회원 삭제</button>'
            : ""}
          ${operationsRole() === "admin" && selectedStatus === "inactive" && selected.authRole !== "admin"
            ? '<button class="ghost-button danger-button" type="button" data-open-member-management="permanent_delete">영구 삭제</button>'
            : ""}
          <button class="icon-button" type="button" data-close-member-detail aria-label="회원 상세 닫기" title="닫기">×</button>
        </div>
      </div>
      <section class="member-db-section">
        <h3>기본 정보</h3>
        <dl class="member-db-grid">
          <div><dt>연락처</dt><dd>${escapeHtml(selected.phone || enrollment.phone || "미입력")}</dd></div>
          <div><dt>출생연도</dt><dd>${escapeHtml(String(selected.birthYear || enrollment.birth_year || "미입력"))}</dd></div>
          <div><dt>거주동</dt><dd>${escapeHtml(selected.neighborhood || enrollment.neighborhood || "미입력")}</dd></div>
          <div><dt>성별</dt><dd>${escapeHtml(memberGenderLabel(selected.gender || enrollment.gender))}</dd></div>
          <div><dt>주사용 손</dt><dd>${escapeHtml(({ right: "오른손", left: "왼손", ambidextrous: "양손" })[selected.dominantHand] || "미입력")}</dd></div>
          <div><dt>백핸드</dt><dd>${escapeHtml(({ two_handed: "투핸드", one_handed: "원핸드" })[selected.backhandStyle] || "미입력")}</dd></div>
          <div><dt>테니스 시작일</dt><dd>${escapeHtml(selected.tennisStartedOn || "미입력")}</dd></div>
          <div><dt>자가/코치 NTRP</dt><dd>${escapeHtml(`${selected.selfNtrp || "-"} / ${selected.coachNtrp || "-"}`)}</dd></div>
          <div class="wide"><dt>테니스 목표</dt><dd>${escapeHtml(selected.tennisGoal || "미입력")}</dd></div>
          <div class="wide"><dt>플레이 스타일·관리 메모</dt><dd>${escapeHtml(selected.playStyleMemo || "미입력")}</dd></div>
        </dl>
      </section>
      <section class="member-db-section">
        <h3>수업·회원권</h3>
        <dl class="member-db-grid">
          <div><dt>담당 코치</dt><dd>${escapeHtml(selected.coach || "미배정")}</dd></div>
          <div><dt>레슨 방식</dt><dd>${escapeHtml(memberManagementLessonMethodLabel(selectedRecord, selectedTicket))}</dd></div>
          <div><dt>레슨 종류</dt><dd>${escapeHtml(memberManagementLessonTypeLabel(selectedRecord?.lesson_type || selectedTicket?.lessonTypeCode))}</dd></div>
          <div><dt>레슨 요일</dt><dd>${escapeHtml(memberManagementLessonDaysLabel(selectedRecord, selectedTicket))}</dd></div>
          <div class="wide"><dt>회원권</dt><dd>${escapeHtml(ticketName)}</dd></div>
          <div><dt>레슨 시작일</dt><dd>${escapeHtml(memberDetailDateLabel(lessonStart))}</dd></div>
          <div><dt>만료일</dt><dd>${selectedTicket ? escapeHtml(memberDetailDateLabel(selectedTicket.expires)) : "없음"}</dd></div>
          <div><dt>총 회차</dt><dd>${selectedTicket ? escapeHtml(memberManagementRecordNumber(totalSessions)) : "-"}</dd></div>
          <div><dt>소진 회차</dt><dd>${selectedTicket ? escapeHtml(memberManagementRecordNumber(usedSessions)) : "-"}</dd></div>
          <div><dt>잔여 회차</dt><dd class="member-remaining-value">${selectedTicket ? escapeHtml(memberManagementRecordNumber(remainingSessions)) : "-"}</dd></div>
        </dl>
        ${renderMemberCoachAssignment(selectedTicket)}
        ${renderMemberTicketLessonSetup(selected, selectedTicket)}
        ${renderMemberGroupAccountSettings(selected, selectedTicket)}
        ${renderMemberManagementControls(selected)}
      </section>
      <section class="member-db-section">
        <h3>결제·비고</h3>
        <dl class="member-db-grid">
          <div><dt>결제일자</dt><dd>${escapeHtml(paymentDate)}</dd></div>
          <div><dt>결제수단·금액</dt><dd>${escapeHtml(paymentSummary)}</dd></div>
          <div class="wide"><dt>비고</dt><dd>${escapeHtml(selectedRecord ? selectedRecord.admin_note || "없음" : selected.note || "없음")}</dd></div>
        </dl>
      </section>
      ${renderMemberApprovalCard(selected)}
      ${renderMemberEnrollmentDetails(selected)}
      <details class="member-admin-more member-technical-details">
        <summary>앱 계정 관리 · ${escapeHtml(memberAuthConnection(selected).summary)}</summary>
        ${renderMemberAuthLinkCard(selected)}
      </details>
    `;
  }
}

function scheduleLessonMatches(lesson) {
  return matchesSearch([lesson.member, getCoachName(lesson.coachId), getCourtLabel(lesson.courtId), lesson.day, lesson.type]);
}

function lessonMatchesActiveScheduleWeek(lesson, day = lesson?.day) {
  if (!state.liveScheduleLoaded) return true;
  const targetDate = adminWeekDateForDay(day);
  return !targetDate || !lesson?.lessonDate || lesson.lessonDate === targetDate;
}

function getLessonMembersLabel(lesson) {
  if (isReleasedRegularMakeupSlot(lesson)) return "정규자리";
  return lesson.member;
}

function scheduleMemberLinesMarkup(value = "") {
  const label = String(value || "회원").trim() || "회원";
  const names = splitMemberNames(label);
  const lines = names.length ? names : [label];
  return `<span class="schedule-member-lines" aria-label="${escapeHtml(label)}">${lines.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</span>`;
}

function getLessonMembersMarkup(lesson) {
  return scheduleMemberLinesMarkup(getLessonMembersLabel(lesson));
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
      `data-released-slot-entitlement="${lesson.entitlementId || ""}"`,
    ].join(" ");
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function isPendingScheduleLesson(lesson) {
  return lesson.status === "pending";
}

function scheduleFilterMatches(lesson) {
  return (
    state.scheduleFilter === "all" ||
    (state.scheduleFilter === "available" && lesson.status === "available") ||
    (state.scheduleFilter === "pending" && isPendingScheduleLesson(lesson))
  );
}

function scheduleTimeHasFilteredLesson(time) {
  if (state.scheduleFilter === "all") return true;
  return scheduleDays.some((day) =>
    lessons.some((lesson) => {
      if (!scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
      const start = timeToMinutes(lesson.time);
      const end = start + lesson.durationMinutes;
      const slot = timeToMinutes(time);
      return lesson.day === day && slot >= start && slot < end;
    }),
  );
}

function renderScheduleLessonCell(lesson, day, time, extraClass = "") {
  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell lesson-slot ${lesson.status} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${extraClass} ${isDimmed ? "is-dimmed" : ""}" title="${day} ${time}">
      <button class="slot-lesson-main ${getCoachToneClass(lesson.coachId)} ${getLessonStateClass(lesson)}" type="button" ${lessonActionAttrs(lesson)}>
        <strong>${getLessonMembersMarkup(lesson)}</strong>
        <span>${getCoachName(lesson.coachId)}</span>
        <small>${getLessonRoundLabel(lesson)} · ${lessonTypeLabel(lesson)}</small>
        ${durationBadge(lesson)}
      </button>
      ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderMultiScheduleCell(day, time, startingLessons) {
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell multi-cell" title="${day} ${time}">
      ${startingLessons
        .map((lesson) => {
          const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
          return `
            <button class="multi-lesson ${lesson.status} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
              <strong>${getLessonMembersMarkup(lesson)}</strong>
              <span>${getCoachName(lesson.coachId)}</span>
              <small>${getLessonRoundLabel(lesson)} · ${lesson.durationMinutes}분</small>
            </button>`;
        })
        .join("")}
      ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderSplitSegment(kind, lesson, label, extraClass = "", addSlot = null) {
  if (!lesson) {
    const addAttrs = addSlot ? lessonAddAttrs(addSlot.day, addSlot.time) : "";
    return `
      <button class="split-segment empty ${extraClass}" type="button" ${addAttrs}>
        <strong>${label}</strong>
        <small>예약 가능</small>
      </button>`;
  }

  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  return `
    <button class="split-segment ${kind} ${lesson.status} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${extraClass} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${label}</strong>
      <span>${getLessonMembersMarkup(lesson)}</span>
      <small>${getCoachName(lesson.coachId)} · ${getLessonRoundLabel(lesson)} · ${lessonTypeLabel(lesson)}</small>
      ${durationBadge(lesson)}
    </button>`;
}

function renderContinuationSegment(label, detail, addSlot) {
  return `
    <button class="split-segment continuation" type="button" ${lessonAddAttrs(addSlot.day, addSlot.time)}>
      <strong>${label}</strong>
      <small>${detail}</small>
    </button>`;
}

function renderCoachLaneLessonCard(lesson, label = "") {
  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  return `
    <button class="coach-lane-card lesson ${lesson.status} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span>${label || getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${getLessonRoundLabel(lesson)} · ${lesson.durationMinutes}분</small>
    </button>`;
}

function renderCoachLaneAddCard(day, time, coach, label = "수업 추가", detail = "") {
  const blockedBreak = getCoachBreakOverlapping(coach.id, day, time, 20) || getBreakRuleOverlapping(day, time, 20);
  if (blockedBreak) {
    return `
      <div class="coach-lane-card unavailable" data-coach-lane="${coach.id}">
        <strong>${getCoachName(coach.id)}</strong>
        <span>${blockedBreak.label || "브레이크"}</span>
        <small>${blockedBreak.start}~${blockedBreak.end}</small>
      </div>`;
  }

  if (!isCoachAvailableForSlot(coach.id, day, time, 20)) {
    return renderCoachLaneClosedCard(coach, "근무외", time);
  }

  if (!hasCourtCapacity(day, time, 20)) {
    return `
      <div class="coach-lane-card disabled" data-coach-lane="${coach.id}">
        <strong>${getCoachName(coach.id)}</strong>
        <span>코트 만석</span>
        <small>${time}</small>
      </div>`;
  }

  return `
    <div class="coach-lane-add-actions" data-coach-lane="${coach.id}">
      <button class="coach-lane-card empty ${getCoachToneClass(coach.id)}" type="button" ${lessonAddAttrs(day, time, 20, coach.id)}>
        <strong>${getCoachName(coach.id)}</strong>
        <span>${label}</span>
        <small>${detail || time}</small>
      </button>
      <button class="coach-lane-one-day" type="button" data-add-one-day-day="${day}" data-add-one-day-time="${time}" data-add-one-day-coach="${coach.id}">원데이</button>
    </div>`;
}

function renderCoachLaneClosedCard(coach, label = "근무외", detail = "") {
  return `
    <div class="coach-lane-card unavailable is-closed" data-coach-lane="${coach.id}" aria-label="${escapeHtml(getCoachName(coach.id))} ${escapeHtml(label)} ${escapeHtml(detail)}"></div>`;
}

function renderCoachLaneSpillCard(day, time, coach, occupyingLesson, blockEnd) {
  const lessonEnd = timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes;
  const occupiedEnd = Math.min(lessonEnd, blockEnd);
  const availableStart = minutesToTime(occupiedEnd);
  const canContinue = blockEnd - occupiedEnd > 0;

  if (canContinue) {
    return `
      <div class="coach-lane-stack" data-coach-lane="${coach.id}">
        <button class="coach-lane-card spill ${getLessonStateClass(occupyingLesson)} ${getCoachToneClass(occupyingLesson.coachId)}" type="button" ${lessonActionAttrs(occupyingLesson)}>
          <strong>${getLessonMembersMarkup(occupyingLesson)}</strong>
          <span>${time}~${availableStart} 사용중</span>
          <small>${getLessonStatusLabel(occupyingLesson)} · ${getLessonRoundLabel(occupyingLesson)} · ${occupyingLesson.durationMinutes}분</small>
        </button>
        ${renderCoachLaneAddCard(day, availableStart, coach, "이어서 신청", `${availableStart}부터`)}
      </div>`;
  }

  return `
    <button class="coach-lane-card spill ${getLessonStateClass(occupyingLesson)} ${getCoachToneClass(occupyingLesson.coachId)}" type="button" data-coach-lane="${coach.id}" ${lessonActionAttrs(occupyingLesson)}>
      <strong>${getLessonMembersMarkup(occupyingLesson)}</strong>
      <span>${getCoachName(occupyingLesson.coachId)}</span>
      <small>${getLessonStatusLabel(occupyingLesson)} · ${time}~${availableStart} 사용중</small>
    </button>`;
}

function renderCoachLane(day, time, coach) {
  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const startingLesson = findStartingLessonForCoach(day, time, coach.id);
  const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
  const startingInBlock = findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coach.id);

  if (startingLesson) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneLessonCard(startingLesson)}</div>`;
  }

  if (occupyingLesson) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneSpillCard(day, time, coach, occupyingLesson, blockEnd)}</div>`;
  }

  if (!isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes)) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneClosedCard(coach, "근무외", time)}</div>`;
  }

  if (startingInBlock) {
    return `
      <div class="coach-lane" data-coach-lane="${coach.id}">
        <div class="coach-lane-stack">
          ${renderCoachLaneAddCard(day, time, coach, "수업 추가", `${time}~${startingInBlock.time}`)}
          ${renderCoachLaneLessonCard(startingInBlock, `${startingInBlock.time} 시작`)}
        </div>
      </div>`;
  }

  return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneAddCard(day, time, coach)}</div>`;
}

function renderUniformCoachScheduleCell(day, time) {
  const lanes = getScheduleCoachLanes(day);
  if (!lanes.length) {
    const breakRule = getBreakRuleForSlot(day, time);
    return `
      <div class="sheet-cell schedule-break-cell" title="${day} ${time}">
        <strong>${breakRule?.label || "브레이크"}</strong>
        <small>근무 코치 없음</small>
      </div>`;
  }
  const laneCount = Math.max(lanes.length, 1);
  const laneSlots = lanes
    .map((coach) => {
      const startingLesson = findStartingLessonForCoach(day, time, coach.id);
      const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
      if (startingLesson) return renderUniformScheduleLine("start", startingLesson);
      if (occupyingLesson) return `<div class="schedule-stack-placeholder is-occupied" data-coach-lane="${coach.id}" aria-hidden="true"></div>`;
      const blockedBreak = getCoachBreakOverlapping(coach.id, day, time, 20) || getBreakRuleOverlapping(day, time, 20);
      if (blockedBreak) {
        return `<div class="schedule-coach-slot is-closed is-break" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} ${escapeHtml(blockedBreak.label || "브레이크")}"></div>`;
      }
      if (!isCoachAvailableForSlot(coach.id, day, time, 20)) {
        return `<div class="schedule-coach-slot is-closed" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} 근무 외"></div>`;
      }
      if (canAddLessonAt(day, time, 20, coach.id)) {
        return `<button class="schedule-stack-add" type="button" data-coach-lane="${coach.id}" ${lessonAddAttrs(day, time, 20, coach.id)}>+ 수업 추가</button>`;
      }
      return `<div class="schedule-coach-slot is-full" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} 신청 불가"></div>`;
    })
    .join("");

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines" style="--visible-lane-count: ${laneCount}">
        ${laneSlots}
      </div>
    </div>`;
}

function renderUniformScheduleLine(kind, lesson, timeLabel = "") {
  const lessonSlotsForCard = Math.max(1, Math.ceil(lesson.durationMinutes / scheduleBlockMinutes));
  const scheduleRowHeight = isAdminMobileSchedule() && state.scheduleView !== "coach" ? 60 : 68;
  const lessonCardHeight = lessonSlotsForCard * scheduleRowHeight + Math.max(0, lessonSlotsForCard - 1) * 3 - 8;
  const isCardDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const roundLabel = getLessonRoundLabel(lesson) || "회차 확인";
  const detailLabel = isReleasedRegularMakeupSlot(lesson)
    ? `보강만 등록 · ${lesson.durationMinutes}분`
    : `${getLessonStatusLabel(lesson)} · ${roundLabel}`;
  return `
    <button class="schedule-stack-line ${kind} lesson-kind-${lessonVisualKind(lesson)} ${lesson.status} ${getLessonStateClass(lesson)} ${isCardDimmed ? "is-dimmed" : ""}" style="--lesson-height:${lessonCardHeight}px;${lessonColorStyle(lesson)}" type="button" ${lessonActionAttrs(lesson)}>
      ${timeLabel ? `<span class="stack-time">${timeLabel}</span>` : ""}
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${detailLabel}</small>
    </button>`;
}

function renderFixedCoachScheduleCell(day, time) {
  return renderUniformCoachScheduleCell(day, time);

  const breakRule = getBreakRuleForSlot(day, time);
  if (breakRule) {
    return `
      <div class="sheet-cell schedule-break-cell" title="${day} ${time}">
        <strong>${breakRule.label || "브레이크"}</strong>
        <small>${breakRule.start}~${breakRule.end}</small>
      </div>`;
  }

  const scheduleLanes = getScheduleCoachLanes();
  const startingLessonsByCoach = scheduleLanes.map((coach) => findStartingLessonForCoach(day, time, coach.id));
  const occupyingLessonsByCoach = scheduleLanes.map((coach) => findOccupyingLessonForCoach(day, time, coach.id));
  const lastVisibleCoachIndex = Math.max(
    startingLessonsByCoach.findLastIndex(Boolean),
    occupyingLessonsByCoach.findLastIndex(Boolean),
  );
  const scheduleOpenCoachId = getAvailableCoachId(day, time);
  const scheduleAddLine = canAddLessonAt(day, time, 20, scheduleOpenCoachId)
    ? `<button class="schedule-stack-add" type="button" ${lessonAddAttrs(day, time, 20, scheduleOpenCoachId)}>+ 수업 추가</button>`
    : `<div class="schedule-stack-full">신청불가</div>`;

  if (lastVisibleCoachIndex < 0) {
    return `
      <div class="sheet-cell schedule-stack-cell is-empty" title="${day} ${time}">
        ${scheduleAddLine}
      </div>`;
  }

  const visibleLaneCount = Math.max(lastVisibleCoachIndex + 1, 1);
  const laneSlots = scheduleLanes
    .slice(0, visibleLaneCount)
    .map((coach, index) => {
      const startingLesson = startingLessonsByCoach[index];
      if (startingLesson) return renderScheduleStackLine("start", startingLesson, `${time} 시작`);
      return `<div class="schedule-stack-placeholder" data-coach-lane="${coach.id}" aria-hidden="true"></div>`;
    })
    .join("");

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines" style="--visible-lane-count: ${visibleLaneCount}">
        ${laneSlots}
      </div>
      ${scheduleAddLine}
    </div>`;

  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const lanes = getScheduleCoachLanes();
  const activeLines = lanes
    .map((coach) => {
      const startingLesson = findStartingLessonForCoach(day, time, coach.id);
      const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
      const startingInBlock = findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coach.id);
      if (startingLesson) return renderScheduleStackLine("start", startingLesson, `${time} 시작`);
      if (occupyingLesson) {
        const occupiedEnd = Math.min(timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes, blockEnd);
        return renderScheduleStackLine("spill", occupyingLesson, `${time}~${minutesToTime(occupiedEnd)} 사용중`);
      }
      if (startingInBlock) return renderScheduleStackLine("start", startingInBlock, `${startingInBlock.time} 시작`);
      return "";
    })
    .filter(Boolean);

  const openCoachId = getAvailableCoachId(day, time);
  const addLine = canAddLessonAt(day, time, 20, openCoachId)
    ? `<button class="schedule-stack-add" type="button" ${lessonAddAttrs(day, time, 20, openCoachId)}>+ 수업 추가</button>`
    : `<div class="schedule-stack-full">신청불가</div>`;

  if (!activeLines.length) {
    return `
      <div class="sheet-cell schedule-stack-cell is-empty" title="${day} ${time}">
        ${addLine}
      </div>`;
  }

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines">
        ${activeLines.join("")}
      </div>
      ${addLine}
    </div>`;
}

function renderScheduleStackLine(kind, lesson, timeLabel) {
  const lessonSlotsForCard = Math.max(1, Math.ceil(lesson.durationMinutes / scheduleBlockMinutes));
  const lessonCardHeight = lessonSlotsForCard * 52 + (lessonSlotsForCard - 1);
  const isCardDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const roundLabel = getLessonRoundLabel(lesson) || "회차 확인";
  return `
    <button class="schedule-stack-line ${kind} ${lesson.status} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)} ${isCardDimmed ? "is-dimmed" : ""}" style="--lesson-height: ${lessonCardHeight}px" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${roundLabel}</small>
    </button>`;

  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const kindLabel = kind === "spill" ? "걸침" : `${lesson.durationMinutes}분`;
  return `
    <button class="schedule-stack-line ${kind} ${lesson.status} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <span class="stack-time">${timeLabel}</span>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${kindLabel} · ${getLessonRoundLabel(lesson) || "빈자리"}</small>
    </button>`;
}

function renderSplitLessonWithAdd(day, time, lesson, label, extraClass = "") {
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="split-parallel ${extraClass}">
      ${renderSplitSegment("occupied", lesson, label)}
      ${canAdd ? `<button class="split-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderSplitStartWithOverlap(day, time, lesson, label, extraClass = "") {
  return `
    <div class="split-parallel ${extraClass}">
      <div class="overlap-note ${getCoachToneClass(lesson.coachId)}">
        <strong>10분 겹침</strong>
        <small>다른 코트 가능</small>
      </div>
      ${renderSplitSegment("starts", lesson, label)}
    </div>`;
}

function renderOverlapScheduleCell(day, time, occupyingLesson, startingLessons) {
  const blockEnd = timeToMinutes(time) + scheduleBlockMinutes;
  const occupiedEnd = Math.min(timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes, blockEnd);
  const occupiedLabel = `${time}~${minutesToTime(occupiedEnd)} 겹침`;
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell overlap-cell" title="${day} ${time}">
      <div class="overlap-strip ${getCoachToneClass(occupyingLesson.coachId)}">
        <button class="overlap-lesson" type="button" ${lessonActionAttrs(occupyingLesson)}>
          <strong>${occupiedLabel}</strong>
          <span>${getCoachName(occupyingLesson.coachId)} · ${getLessonMembersLabel(occupyingLesson)}</span>
        </button>
        <small>${getLessonRoundLabel(occupyingLesson)} · 30분 수업 일부 사용중</small>
      </div>
      <div class="overlap-starts">
        ${startingLessons
          .map((lesson) => {
            const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
            return `
              <button class="multi-lesson ${lesson.status} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
                <strong>${getLessonMembersMarkup(lesson)}</strong>
                <span>${getCoachName(lesson.coachId)}</span>
                <small>${getLessonRoundLabel(lesson)} · ${lesson.durationMinutes}분</small>
              </button>`;
          })
          .join("")}
        ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
      </div>
    </div>`;
}

function renderSplitScheduleCell(day, time, previousLesson, nextLesson) {
  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const previousEnd = Math.min(timeToMinutes(previousLesson.time) + previousLesson.durationMinutes, blockEnd);

  if (previousEnd >= blockEnd && !nextLesson) {
    const searchMatch = scheduleLessonMatches(previousLesson);
    const canAdd = hasCourtCapacity(day, time);
    return `
      <div class="sheet-cell split-parallel-full duration-${durationTone(previousLesson)} ${searchMatch ? "" : "is-dimmed"}" title="${day} ${time}">
        <button class="split-segment occupied ${getCoachToneClass(previousLesson.coachId)}" type="button" ${lessonActionAttrs(previousLesson)}>
          <strong>사용중</strong>
          <span>${getLessonMembersMarkup(previousLesson)}</span>
          <small>${getCoachName(previousLesson.coachId)} · ${getLessonRoundLabel(previousLesson)} · ${lessonTypeLabel(previousLesson)}</small>
          ${durationBadge(previousLesson)}
        </button>
        ${canAdd ? `<button class="split-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
      </div>`;
  }

  const availableStart = minutesToTime(previousEnd);
  const remainingMinutes = blockEnd - previousEnd;
  return `
    <div class="sheet-cell split-cell" title="${day} ${time}">
      ${renderSplitLessonWithAdd(day, time, previousLesson, `${time}~${availableStart} 사용중`, "top")}
      ${
        nextLesson
          ? renderSplitStartWithOverlap(day, time, nextLesson, `${nextLesson.time} 시작`, "bottom")
          : remainingMinutes >= 20
            ? renderSplitSegment("empty", null, `${availableStart} 이후`, "bottom", { day, time: availableStart })
            : renderContinuationSegment(`${availableStart} 이어서 신청`, "10분 경계 시작 가능", { day, time: availableStart })
      }
    </div>`;
}

function renderScheduleCell(day, time) {
  return renderFixedCoachScheduleCell(day, time);

  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const startingLessons = findLessons(day, time);
  const occupyingLesson = findOccupyingLesson(day, time);
  const startingInBlock = findLessonStartingInBlock(day, blockStart, blockEnd);
  if (startingLessons.length >= 1 && occupyingLesson) return renderOverlapScheduleCell(day, time, occupyingLesson, startingLessons);
  if (startingLessons.length >= 1) return renderMultiScheduleCell(day, time, startingLessons);
  if (occupyingLesson) return renderSplitScheduleCell(day, time, occupyingLesson, startingInBlock);

  if (startingInBlock) {
    return `
      <div class="sheet-cell split-cell" title="${day} ${time}">
        ${renderSplitSegment("empty", null, `${time}~${startingInBlock.time} 가능`, "top", { day, time })}
        ${renderSplitSegment("starts", startingInBlock, `${startingInBlock.time} 시작`, "bottom")}
      </div>`;
  }

  return `
    <button class="sheet-cell empty addable-cell" type="button" ${lessonAddAttrs(day, time)}>
      <span>+</span>
      <small>수업 추가</small>
    </button>`;
}

function lessonOverlapsScheduleSlot(lesson, day, time) {
  if (lesson.day !== day || lesson.status === "cancelled" || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
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

function renderCoachDayBaseCell(day, time, coach, row, column) {
  const breakRule = getBreakRuleForSlot(day, time);
  const occupyingLesson = lessons.find((lesson) => lesson.coachId === coach.id && lessonOverlapsScheduleSlot(lesson, day, time));
  const working = isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes);
  const className = breakRule ? "is-break" : working ? "is-open" : "is-closed";
  const label = breakRule ? (breakRule.label || "브레이크") : working ? "수업 추가" : "근무외";
  const canAdd = working && !occupyingLesson && canAddLessonAt(day, time, 20, coach.id);
  const content = canAdd
    ? `<button type="button" ${lessonAddAttrs(day, time, 20, coach.id)}><span>+</span><small>${label}</small></button>`
    : `<span>${occupyingLesson ? "" : label}</span>`;
  return `<div class="coach-day-cell ${className} ${occupyingLesson ? "is-occupied" : ""}" style="grid-row:${row};grid-column:${column};" title="${day} ${time} · ${coach.name}">${content}</div>`;
}

function renderCoachDayLessonCard(lesson, visibleTimes, column) {
  const startIndex = visibleTimes.indexOf(lesson.time);
  if (startIndex < 0 || !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson)) return "";
  const start = timeToMinutes(lesson.time);
  const end = start + (Number(lesson.durationMinutes) || 20);
  const rowSpan = Math.max(1, visibleTimes.filter((time) => {
    const value = timeToMinutes(time);
    return value >= start && value < end;
  }).length);
  const memberLabel = isReleasedRegularMakeupSlot(lesson)
    ? "수업 신청 가능"
    : lesson.status === "available" ? "보강 가능" : getLessonMembersLabel(lesson);
  const statusLabel = isReleasedRegularMakeupSlot(lesson)
    ? `${lesson.durationMinutes}분`
    : lesson.status === "available" ? `${lesson.durationMinutes}분 신청 가능` : `${getLessonStatusLabel(lesson)} · ${lesson.durationMinutes}분`;
  return `
    <button class="coach-day-lesson ${lesson.status} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)}" style="grid-row:${startIndex + 2} / span ${rowSpan};grid-column:${column};" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${scheduleMemberLinesMarkup(memberLabel)}</strong>
      <span>${escapeHtml(statusLabel)}</span>
      <small>${lesson.time}~${minutesToTime(end)}</small>
    </button>`;
}

function renderCoachDaySchedule(day) {
  const target = $("#coachScheduleGrid");
  if (!target) return;
  const dayCoaches = getScheduleCoachLanes(day).filter((coach) => coach.id !== "coach-machine");
  if (state.scheduleCoachFilter !== "all" && !dayCoaches.some((coach) => coach.id === state.scheduleCoachFilter)) {
    state.scheduleCoachFilter = "all";
  }
  const visibleCoaches = state.scheduleCoachFilter === "all"
    ? dayCoaches
    : dayCoaches.filter((coach) => coach.id === state.scheduleCoachFilter);
  const visibleTimes = coachScheduleVisibleTimes(day, visibleCoaches);
  const picker = $("#adminScheduleCoachPicker");
  if (picker) {
    picker.innerHTML = `
      <button class="coach-filter-button ${state.scheduleCoachFilter === "all" ? "is-active" : ""}" type="button" data-select-schedule-coach="all">전체 코치</button>
      ${dayCoaches.map((coach) => `<button class="coach-filter-button ${getCoachToneClass(coach.id)} ${state.scheduleCoachFilter === coach.id ? "is-active" : ""}" type="button" data-select-schedule-coach="${coach.id}">${escapeHtml(coach.name)}</button>`).join("")}`;
  }

  if (!visibleCoaches.length || !visibleTimes.length) {
    target.style.gridTemplateColumns = "1fr";
    target.innerHTML = '<p class="coach-schedule-empty">선택한 조건에 표시할 코치 일정이 없습니다.</p>';
    return;
  }

  target.style.gridTemplateColumns = `68px repeat(${visibleCoaches.length}, minmax(154px, 1fr))`;
  const headers = `<div class="coach-day-corner">시간</div>${visibleCoaches.map((coach) => {
    const workLabel = normalizeCoachWorkBlocks(coach)
      .filter((block) => block.days.includes(day))
      .map((block) => `${block.start}~${block.end}`)
      .join(" · ") || "근무 없음";
    return `<div class="coach-day-header ${getCoachToneClass(coach.id)}"><strong>${escapeHtml(coach.name)}</strong><span>${escapeHtml(workLabel)}</span></div>`;
  }).join("")}`;
  const baseCells = visibleTimes.map((time, timeIndex) => {
    const row = timeIndex + 2;
    const minor = timeToMinutes(time) % 20 !== 0;
    return `<div class="coach-day-time ${minor ? "is-minor" : ""}" style="grid-row:${row};grid-column:1;">${time}</div>${visibleCoaches.map((coach, coachIndex) => renderCoachDayBaseCell(day, time, coach, row, coachIndex + 2)).join("")}`;
  }).join("");
  const lessonCards = visibleCoaches.map((coach, coachIndex) => lessons
    .filter((lesson) => lesson.day === day && lesson.coachId === coach.id && lesson.status !== "cancelled" && lessonMatchesActiveScheduleWeek(lesson, day))
    .map((lesson) => renderCoachDayLessonCard(lesson, visibleTimes, coachIndex + 2))
    .join("")).join("");
  target.innerHTML = headers + baseCells + lessonCards;
}

function renderSchedule() {
  syncAdminScheduleWeek();
  const activeWeek = activeAdminWeek();
  if ($("#adminWeekTitle")) $("#adminWeekTitle").textContent = `${activeWeek.label} 레슨관리표`;
  if ($("#adminWeekNote")) $("#adminWeekNote").textContent = `${activeWeek.range} · ${state.liveScheduleLoaded ? state.liveScheduleMessage : activeWeek.note}`;
  if ($("#adminWeekSwitcher")) {
    $("#adminWeekSwitcher").innerHTML = `
      <button class="ghost-button" type="button" data-change-admin-week="-1" ${state.activeAdminWeekIndex <= adminScheduleMinWeekOffset ? "disabled" : ""}>이전 주</button>
      <div class="schedule-period-summary">
        <div class="schedule-month-controls">
          <button class="ghost-button" type="button" data-go-admin-today>오늘</button>
          <button class="ghost-button" type="button" data-change-admin-month="-1">이전 달</button>
          <input class="schedule-month-input" type="month" value="${adminScheduleMonthValue(activeWeek)}" data-admin-month aria-label="이동할 달">
          <button class="ghost-button" type="button" data-change-admin-month="1">다음 달</button>
        </div>
        <strong>${activeWeek.label}</strong>
        <span>${activeWeek.range} · ${state.liveScheduleLoaded ? "실시간 모든 코치 시간표" : "모든 코치 시간표"}</span>
      </div>
      <button class="ghost-button" type="button" data-change-admin-week="1" ${state.activeAdminWeekIndex >= adminScheduleMaxWeekOffset ? "disabled" : ""}>다음 주</button>
    `;
  }
  state.scheduleView = state.scheduleView === "coach" ? "coach" : "week";
  state.scheduleFilter = state.scheduleFilter === "pending" ? "pending" : "all";
  const coachDayView = state.scheduleView === "coach";
  const mobileDayView = !coachDayView && isAdminMobileSchedule();
  const selectedDay = selectedAdminScheduleDay();
  const displayDays = mobileDayView ? [selectedDay] : scheduleDays;
  $$('[data-schedule-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleView === state.scheduleView));
  $$(".segment[data-schedule-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleFilter === state.scheduleFilter));
  if ($("#adminScheduleDayPicker")) {
    $("#adminScheduleDayPicker").classList.toggle("is-visible", coachDayView || mobileDayView);
    $("#adminScheduleDayPicker").innerHTML = scheduleDays.map((day) => `
      <button class="schedule-day-button ${day === selectedDay ? "is-active" : ""}" type="button" data-select-admin-day="${day}">
        <strong>${day}</strong><span>${adminScheduleDateLabel(day)}</span>
      </button>`).join("");
  }
  if ($("#adminScheduleCoachPicker")) $("#adminScheduleCoachPicker").hidden = !coachDayView;
  $("#scheduleGrid").hidden = coachDayView;
  $("#coachScheduleGrid").hidden = !coachDayView;
  if (coachDayView) {
    renderCoachDaySchedule(selectedDay);
    return;
  }
  const visibleTimes = getVisibleScheduleTimes()
    .filter(scheduleTimeHasFilteredLesson)
    .filter((time) => !mobileDayView || adminTimeVisibleForDay(selectedDay, time));
  const dayCoachMap = new Map(displayDays.map((day) => [day, getScheduleCoachLanes(day)]));
  const dayWidths = displayDays.map((day) => {
    if (mobileDayView) return 0;
    const dayLaneCount = Math.max(1, dayCoachMap.get(day)?.length || 0);
    return dayLaneCount * coachSlotWidth + Math.max(0, dayLaneCount - 1) * 3 + 11;
  });
  const mobileCoachCount = Math.max(1, dayCoachMap.get(selectedDay)?.length || 0);
  const mobileCoachOverflow = mobileDayView && mobileCoachCount >= 4;
  const mobileDayWidth = mobileCoachCount * mobileCoachSlotWidth + Math.max(0, mobileCoachCount - 1) * 3 + 8;
  $("#scheduleGrid").classList.toggle("is-mobile-day", mobileDayView);
  $("#scheduleGrid").classList.toggle("has-coach-overflow", mobileCoachOverflow);
  $("#scheduleGrid").style.gridTemplateColumns = mobileDayView
    ? `52px ${mobileCoachOverflow ? `${mobileDayWidth}px` : "minmax(0, 1fr)"}`
    : `${timeColumnWidth}px ${dayWidths.map((width) => `${width}px`).join(" ")}`;

  const header = ["<div class=\"sheet-head time-head\">시간</div>"]
    .concat(displayDays.map((day) => {
      const dayCoaches = dayCoachMap.get(day) || [];
      const displayCoaches = dayCoaches.length ? dayCoaches : [{ name: "운영없음" }];
      return `
        <div class="sheet-head admin-day-head" style="--admin-coach-count:${displayCoaches.length};">
          <strong class="admin-day-label">${day} · ${adminScheduleDateLabel(day)}</strong>
          <div class="admin-coach-head-row">
            ${displayCoaches.map((coach) => `<span>${escapeHtml(coach.name.replace(/\s*코치$/, ""))}</span>`).join("")}
          </div>
        </div>`;
    }))
    .join("");

  const body = visibleTimes.length
    ? visibleTimes
    .map((time) => {
      const cells = displayDays
        .map((day) => {
          return renderScheduleCell(day, time);
        })
        .join("");
      return `<div class="sheet-time">${time}</div>${cells}`;
    })
    .join("")
    : `<div class="sheet-time">-</div><div class="sheet-cell schedule-stack-cell is-empty" style="grid-column: span ${displayDays.length};">확인 필요한 시간이 없습니다.</div>`;

  $("#scheduleGrid").innerHTML = header + body;
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
}

function getTicketDurationMinutes(ticket) {
  const explicit = Number(ticket?.durationMinutes);
  if ([20, 30, 40].includes(explicit)) return explicit;
  const product = ticket?.product || "";
  if (product.includes("40")) return 40;
  if (product.includes("30")) return 30;
  return 20;
}

function getTicketWeeklyCount(ticket) {
  if (Number(ticket?.weeklyCount) > 0) return Number(ticket.weeklyCount);
  const product = ticket?.product || "";
  const match = product.match(/주\s*(\d+)회/);
  return match ? Number(match[1]) : 1;
}

function isRegularScheduleSetup(ticket) {
  return Boolean(
    ticket
    && !state.editingLessonId
    && normalizeLessonSource($("#lessonSource")?.value) === "regular"
    && !isPastLessonCorrectionMode(getLessonFormCandidate())
  );
}

function requiredRegularScheduleCount(ticket) {
  return isRegularScheduleSetup(ticket) ? Math.max(1, Math.min(3, getTicketWeeklyCount(ticket))) : 1;
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
  const requiredCount = requiredRegularScheduleCount(ticket);
  const slots = getLessonScheduleSlots().slice(0, requiredCount);
  const incompleteSlots = slots.filter((slot) => !slot.day || !slot.time);
  const selectedDays = slots.filter((slot) => slot.day).map((slot) => slot.day);
  const duplicateDay = selectedDays.find((day, index) => selectedDays.indexOf(day) !== index) || "";
  const missingSlotNumbers = slots
    .map((slot, index) => (!slot.day || !slot.time ? index + 1 : null))
    .filter(Boolean);
  return {
    requiredCount,
    slots,
    isRequired: requiredCount > 1,
    incompleteSlots,
    duplicateDay,
    valid: incompleteSlots.length === 0 && !duplicateDay && slots.length === requiredCount,
    message: incompleteSlots.length
      ? `주 ${requiredCount}회 회원권입니다. 요일/시간 ${missingSlotNumbers.join(", ")}을(를) 모두 직접 선택해 주세요.`
      : duplicateDay
        ? `주 ${requiredCount}회 정규 수업은 서로 다른 요일로 선택해 주세요.`
        : "",
  };
}

function getSelectedLessonSchedules() {
  return getLessonScheduleSlots().filter((item) => item.day && item.time);
}

function getSelectedLessonDays() {
  return getSelectedLessonSchedules().map((item) => item.day);
}

function getInternalScheduleConflict(schedules, durationMinutes) {
  for (let leftIndex = 0; leftIndex < schedules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < schedules.length; rightIndex += 1) {
      const left = schedules[leftIndex];
      const right = schedules[rightIndex];
      if (left.day !== right.day || !left.time || !right.time) continue;
      if (intervalsOverlap(
        { start: timeToMinutes(left.time), end: timeToMinutes(left.time) + durationMinutes },
        { start: timeToMinutes(right.time), end: timeToMinutes(right.time) + durationMinutes },
      )) {
        return { day: left.day, time: left.time, message: `${left.day}요일 안에서 시간이 서로 겹칩니다.` };
      }
    }
  }
  return null;
}

function getTicketLessonKind(ticket) {
  if (!ticket) return "";
  if (ticket.lessonKind) return ticket.lessonKind;
  if (ticket.product?.includes("2대1")) return "2대1";
  if (ticket.product?.includes("그룹")) return "그룹";
  return "개인";
}

function getTicketDisplayProduct(ticket) {
  return (ticket?.product || "")
    .replace(/^[^\s]+ 코치\s*/, "")
    .replace(/\s*\d+분.*$/, "")
    .trim();
}

function getTicketScheduleScope(ticket) {
  return ["weekday", "weekend", "mixed"].includes(ticket?.scheduleScope) ? ticket.scheduleScope : "weekday";
}

function getTicketScheduleDays(ticket) {
  const scope = getTicketScheduleScope(ticket);
  if (scope === "mixed") return [...scheduleDays];
  return scope === "weekend" ? scheduleDays.slice(5) : scheduleDays.slice(0, 5);
}

function ticketAllowsScheduleDay(ticket, day) {
  return getTicketScheduleDays(ticket).includes(day);
}

function ticketUsageLabel(ticket) {
  const total = Math.max(0, Number(ticket?.total) || 0);
  const used = Math.max(0, Number(ticket?.used) || 0);
  const remaining = Math.max(0, Number(ticket?.remaining) || 0);
  return `총 ${total} / 소진 ${used} / 잔여 ${remaining}`;
}

function getTicketOptionLabel(ticket) {
  return `${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function getLessonTicketOptionLabel(ticket) {
  const memberNames = ticketParticipantNames(ticket).join(" & ") || ticket.member || "회원";
  return `${memberNames} · ${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function scheduleTicketById(ticketId) {
  return [...tickets, ...expiredTickets].find((item) => String(item.id) === String(ticketId || "")) || null;
}

function adminManualOverrideAvailable() {
  return state.liveScheduleLoaded && operationsRole() === "admin";
}

function adminManualOverrideEnabled() {
  return adminManualOverrideAvailable() && Boolean($("#lessonAdminOverride")?.checked);
}

function adminManualOverrideReason() {
  return "관리자 수동 예외 처리";
}

function adminPastCorrectionReason() {
  return "관리자 과거 수업 보정";
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
  const currentValue = keepValue || $("#lessonTime").value;
  const durationMinutes = getLessonDurationFromSelectedTicket();
  const day = $("#lessonDay").value;
  const pastCorrection = isPastLessonCorrectionMode({ day, time: currentValue, durationMinutes });
  const sourceTimes = pastCorrection || adminManualOverrideEnabled()
    ? getScheduleTimeOptions()
    : getCoachTimeOptions($("#lessonCoach").value, day, durationMinutes);
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
  const target = $("#lessonRepeatSlots");
  const previousSlots = $$("[data-lesson-slot-day]").map((daySelect) => {
    const row = daySelect.closest(".lesson-repeat-slot");
    return {
      day: daySelect.value,
      time: row?.querySelector("[data-lesson-slot-time]")?.value || "",
    };
  });
  target.innerHTML = "";
  target.hidden = !regularScheduleMode;
  const previousPrimaryDay = $("#lessonDay").value;
  fillSelect($("#lessonDay"), availableDays.map((day) => ({ value: day, label: `${day}요일` })));
  $("#lessonDay").value = availableDays.includes(previousPrimaryDay) ? previousPrimaryDay : availableDays[0] || "";
  const primaryDay = $("#lessonDay").value;
  for (let index = 2; index <= 3; index += 1) {
    const isActive = index <= scheduleCount;
    const previous = previousSlots[index - 2] || {};
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
    target.appendChild(row);
    daySelect.addEventListener("change", () => {
      fillSelect(timeSelect, getTimeOptionsForLessonSlot(daySelect.value));
      timeSelect.value = "";
      renderLessonPreview();
    });
    timeSelect.addEventListener("change", renderLessonPreview);
  }
}

function refreshLessonDurationOptions() {
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const durationMinutes = getTicketDurationMinutes(ticket);
  const previousDuration = $("#lessonDuration").value;
  const options = adminManualOverrideEnabled()
    ? [20, 30, 40, 60].map((minutes) => ({ value: String(minutes), label: `${minutes}분${minutes === durationMinutes ? " · 회원권 기준" : ""}` }))
    : [{ value: String(durationMinutes), label: `${durationMinutes}분권 1회` }];
  fillSelect($("#lessonDuration"), options);
  $("#lessonDuration").value = options.some((item) => item.value === previousDuration)
    ? previousDuration
    : String(durationMinutes);
}

function getEligibleTickets(memberName, coachId) {
  const editingTicketId = getTicketByLesson(getCurrentEditingLesson())?.id || "";
  const sourceTickets = adminManualOverrideEnabled()
    ? [...tickets, ...expiredTickets].filter((ticket, index, source) => (
      source.findIndex((item) => String(item.id) === String(ticket.id)) === index
      && ticketParticipantNames(ticket).includes(memberName)
    ))
    : ticketsForMember(memberName);
  return sourceTickets.filter((ticket) => adminManualOverrideEnabled() || (
    ticket.coachId === coachId
    && (ticket.remaining > 0 || ticket.id === editingTicketId)
  ));
}

function findFirstMemberWithCoachTicket(coachId) {
  const ticket = tickets.find((item) => item.coachId === coachId && item.remaining > 0);
  if (!ticket) return "";
  const owner = members.find((member) => memberServerUserIds(member).includes(ticket.serverUserId));
  return owner?.name || members.find((member) => ticketBelongsToMember(ticket, member))?.name || ticketParticipantNames(ticket)[0] || "";
}

function findFirstTicketForMember(memberName) {
  return ticketsForMember(memberName).find((ticket) => ticket.remaining > 0);
}

function getActiveTicketForMember(memberName) {
  return ticketsForMember(memberName)[0];
}

function syncMemberRemainingFromTicket(memberName) {
  memberRecordsForReference(memberName).forEach((member) => {
    const ticket = getActiveTicketForMember(member);
    if (ticket) member.remaining = ticket.remaining;
  });
}

function alignCoachToSelectedMemberTicket() {
  const memberName = $("#lessonMember").value;
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(memberName, coachId).length) return;
  const ticket = findFirstTicketForMember(memberName);
  if (ticket) $("#lessonCoach").value = ticket.coachId;
}

function ensureMemberHasCoachTicket() {
  const memberSelect = $("#lessonMember");
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(memberSelect.value, coachId).length) return;
  const fallbackMember = findFirstMemberWithCoachTicket(coachId);
  if (fallbackMember) memberSelect.value = fallbackMember;
}

function getSelectableMembers(search = "") {
  const keyword = search.trim().toLowerCase();
  const matchingMembers = members.filter((member) => {
    if (!adminManualOverrideEnabled() && ["expired", "inactive"].includes(memberListStatus(member))) return false;
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
  const options = getSelectableMembers(search);
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
    options.map((member) => ({
      value: member.name,
      label: editingParticipantLabel && member.name === currentValue
        ? `현재 수업 · ${editingParticipantLabel}${editingTicket ? ` · ${getTicketOptionLabel(editingTicket)}` : ""}`
        : getMemberOptionLabel(member),
    })),
  );
  const exactMatch = search
    ? options.find((member) => memberSearchValues(member)
      .some((value) => String(value || "").trim().toLowerCase() === keyword))
    : null;
  const selectedName = exactMatch?.name
    || (currentMatchesSearch && options.some((member) => member.name === currentValue) ? currentValue : "")
    || options[0].name;
  $("#lessonMember").value = selectedName;
}

function getExpiredTicketsForMember(memberName) {
  const member = memberName && typeof memberName === "object" ? memberName : null;
  const displayName = member ? member.name : memberName;
  if (!displayName) return [];
  return expiredTickets.filter((ticket) => ticketBelongsToMember(ticket, member || displayName));
}

function renderLessonExpiredTickets() {
  const target = $("#lessonExpiredTickets");
  if (!target) return;
  const memberName = $("#lessonMember").value;
  const history = getExpiredTicketsForMember(memberName)
    .filter((ticket) => ["expired", "refunded", "voided"].includes(ticket.status));
  target.innerHTML = `
    <strong>만료 회원권 이력</strong>
    ${
      history.length
        ? `<ul>${history.map((ticket) => `<li>${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)} · ${ticket.purchased}~${ticket.expires}</li>`).join("")}</ul>`
        : `<span>${memberName || "선택 회원"}의 만료 이력이 없습니다.</span>`
    }
  `;
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

function normalizeLessonSource(value) {
  return ["regular", "makeup", "coupon", "coach_change", "admin", "one_day"].includes(value) ? value : "regular";
}

function lessonSourceLabel(value) {
  return {
    regular: "정규수업",
    makeup: "보강",
    coupon: "쿠폰수업",
    one_day: "원데이",
    coach_change: "코치변경",
    admin: "과거수업 보정",
  }[normalizeLessonSource(value)];
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

function alignTicketToLessonSource() {
  const memberName = $("#lessonMember").value;
  const coachId = $("#lessonCoach").value;
  const source = normalizeLessonSource($("#lessonSource").value);
  const matchingTicket = getEligibleTickets(memberName, coachId).find((ticket) => ticketMatchesLessonSource(ticket, source));
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

function renderLessonTicketHint() {
  const target = $("#lessonTicketHint");
  if (!target) return;
  renderCurrentLessonMembers();
  const memberName = $("#lessonMember")?.value || "";
  const ticket = getSelectedTicket();
  if (!memberName) {
    target.textContent = "회원 이름을 검색해 주세요.";
    return;
  }
  if (!ticket) {
    target.textContent = `${memberName} 회원에게 현재 코치로 사용할 수 있는 회원권이 없습니다.`;
    return;
  }
  const sourceLabels = isCouponLessonTicket(ticket) ? "쿠폰수업 · 보강" : "정규수업 · 보강";
  target.textContent = `${ticketParticipantNames(ticket).join(" & ") || memberName} · ${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)} · 선택 가능: ${sourceLabels}`;
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

function getLessonParticipantNames(lesson) {
  if (!lesson) return [];
  const namesById = (Array.isArray(lesson.serverParticipantUserIds) ? lesson.serverParticipantUserIds : [])
    .map((userId) => (adminLiveDataState.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set(namesById.length ? namesById : splitMemberNames(lesson.member))];
}

function getEditingLessonMemberName(lesson) {
  if (!lesson) return "";
  const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
    ? lesson.serverParticipantUserIds.filter(Boolean)
    : [];
  const participantNames = getLessonParticipantNames(lesson);
  const currentTicket = getTicketByLesson(lesson);
  const matchingMembers = members.filter((member) => {
    const matchesParticipantId = participantUserIds.length
      && memberServerUserIds(member).some((userId) => participantUserIds.includes(userId));
    const matchesParticipantName = participantNames.includes(member.name);
    return (matchesParticipantId || matchesParticipantName)
      && (!currentTicket || ticketBelongsToMember(currentTicket, member));
  });
  const ticketOwner = matchingMembers.find((member) => memberServerUserIds(member).includes(currentTicket?.serverUserId));
  return ticketOwner?.name
    || matchingMembers[0]?.name
    || participantNames.find((name) => members.some((member) => member.name === name))
    || "";
}

function renderCurrentLessonMembers(lesson = null) {
  const target = $("#lessonCurrentMembers");
  if (!target) return;
  const selectedTicket = getSelectedTicket();
  const participantNames = lesson
    ? getLessonParticipantNames(lesson)
    : ticketParticipantNames(selectedTicket);
  target.hidden = !participantNames.length;
  target.innerHTML = participantNames.length
    ? `<span class="lesson-participant-heading">${participantNames.length === 2 ? "2대1 참가자" : "수업 참가자"}</span><span class="lesson-participant-list">${participantNames.map((name, index) => `<span class="lesson-participant-row"><small>참가자 ${index + 1}</small><strong>${escapeHtml(name)}</strong></span>`).join("")}</span>`
    : "";
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
  const memberName = $("#lessonMember").value;
  const coachId = $("#lessonCoach").value;
  const previousTicketId = $("#lessonTicket").value;
  const eligible = getEligibleTickets(memberName, coachId);
  fillSelect(
    $("#lessonTicket"),
    eligible.length
      ? eligible.map((ticket) => ({ value: ticket.id, label: getLessonTicketOptionLabel(ticket) }))
      : [{ value: "", label: "해당 코치 회원권 없음" }],
  );
  if (eligible.some((ticket) => ticket.id === previousTicketId)) $("#lessonTicket").value = previousTicketId;
  syncLessonSourceOptions();
  refreshLessonDurationOptions();
  refreshLessonDayOptions();
  syncLessonTypeFromForm();
  renderLessonTicketHint();
}

function getLessonFormCandidate(overrides = {}) {
  const durationMinutes = Number($("#lessonDuration").value);
  const selectedTicket = getSelectedTicket();
  const participantNames = ticketParticipantNames(selectedTicket);
  syncLessonTypeFromForm();
  return {
    id: state.editingLessonId || Date.now(),
    day: $("#lessonDay").value,
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
  if (editingLesson && editingLesson.serverStatus !== "scheduled") return false;
  const endTimestamp = adminLessonEndTimestamp(candidate);
  return Number.isFinite(endTimestamp) && endTimestamp <= Date.now();
}

function getPastLessonCorrectionConflict(candidate) {
  const lessonDate = adminWeekDateForDay(candidate.day);
  const duplicate = lessons.find((lesson) => (
    lesson.id !== candidate.id
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed"].includes(lesson.serverStatus || lesson.status)
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
  if (releasedRegularSlot && candidate.lessonSource !== "makeup") {
    return { lesson: releasedRegularSlot, message: "불참으로 비워진 정규 자리는 보강 수업으로만 반영할 수 있습니다." };
  }

  const coachConflict = overlappingLessons
    .find((lesson) => (
      lesson.id !== candidate.id
      && !isReleasedRegularMakeupSlot(lesson)
      && lesson.coachId === candidate.coachId
      && ["scheduled", "pending_change", "completed"].includes(lesson.serverStatus || lesson.status)
    ));
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}의 기존 수업과 시간이 겹칩니다.` };
  }
  return null;
}

function getAdminManualExactDuplicate(candidate) {
  const lessonDate = adminWeekDateForDay(candidate.day);
  return lessons.find((lesson) => (
    lesson.id !== candidate.id
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed", "no_show"].includes(lesson.serverStatus || lesson.status)
  )) || null;
}

function getAdminManualOverrideWarnings(candidate, ticket, pastCorrection = false) {
  const warnings = [];
  const lessonDate = adminWeekDateForDay(candidate.day);
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

function syncPastLessonCorrectionUi(candidate = getLessonFormCandidate()) {
  const panel = $("#lessonPastCorrectionPanel");
  const repeatSlots = $("#lessonRepeatSlots");
  const sourceSelect = $("#lessonSource");
  const adminOption = sourceSelect?.querySelector('option[value="admin"]');
  const editingLesson = getCurrentEditingLesson();
  const pastCorrection = isPastLessonCorrectionMode(candidate);

  if (panel) panel.hidden = !pastCorrection;
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
    $("#lessonModalTitle").textContent = editingLesson ? "지난 수업 완료 처리" : "과거 수업 보정";
    $("#saveLessonButton").textContent = "완료 반영·횟수 차감";
  } else if ($("#lessonModalTitle") && $("#saveLessonButton")) {
    $("#lessonModalTitle").textContent = editingLesson ? "수업 수정" : "수업 추가";
    $("#saveLessonButton").textContent = editingLesson ? "수정 저장" : "시간표에 추가";
  }
  return pastCorrection;
}

function renderLessonPreview() {
  if (!$("#lessonPreview")) return;
  let candidate = getLessonFormCandidate();
  const pastCorrection = syncPastLessonCorrectionUi(candidate);
  candidate = getLessonFormCandidate();
  syncAdminForceDeleteLessonButton(candidate);
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const manualOverride = adminManualOverrideEnabled();
  const sourceTicketMismatch = ticket && !ticketMatchesLessonSource(ticket, candidate.lessonSource);
  if (!candidate.time) {
    syncAdminManualOverrideUi(["선택할 수업 시간이 없습니다."]);
    $("#lessonPreview").innerHTML = `
      <strong>선택 가능한 시간이 없습니다.</strong>
      <span>${getCoachName(candidate.coachId)}의 근무 가능 시간을 확인해주세요.</span>
    `;
    setLessonFormMessage("코치 가능 시간 밖이라 수업을 추가할 수 없습니다.", "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const start = timeToMinutes(candidate.time);
  const end = start + candidate.durationMinutes;
  if (pastCorrection) {
    const correctionReason = adminPastCorrectionReason();
    const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
    const selectedEntitlement = selectedAdminMakeupEntitlement();
    const sourceRequiresEntitlement = candidate.lessonSource === "makeup" && !state.editingLessonId;
    const sourceInvalid = !state.editingLessonId && candidate.lessonSource === "regular";
    const conflict = getPastLessonCorrectionConflict(candidate);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    const ticketDateMismatch = ticket && (
      adminWeekDateForDay(candidate.day) < (ticket.purchased || "")
      || adminWeekDateForDay(candidate.day) > (ticket.expires || "9999-12-31")
    );
    const overrideWarnings = getAdminManualOverrideWarnings(candidate, ticket, true);
    const overrideReasonMissing = false;
    const normalMessage = !ticket || sourceTicketMismatch
      ? "선택한 수업 종류에 맞는 회원권이 없습니다."
      : sourceInvalid
        ? "새 과거 수업은 보강·쿠폰수업 또는 과거수업 보정으로 등록해 주세요."
        : sourceRequiresEntitlement && !selectedEntitlement
          ? "불참 처리에서 생성된 보강 대기를 선택해 주세요. 보강 대기가 없으면 과거수업 보정을 선택하세요."
          : ticketDateMismatch
            ? "회원권 시작일과 만료일 안의 날짜만 보정할 수 있습니다."
            : coachComment.length < 10
                ? "실제 수업 코멘트를 10자 이상 입력해 주세요."
                : conflict
                  ? conflict.message
                  : "저장 즉시 완료 처리되고 회원권 횟수가 차감됩니다.";
    const normalBlocked = Boolean(
      !ticket
      || sourceTicketMismatch
      || sourceInvalid
      || (sourceRequiresEntitlement && !selectedEntitlement)
      || ticketDateMismatch
      || coachComment.length < 10
      || conflict
    );
    const blocked = manualOverride
      ? Boolean(!ticket || exactDuplicate || coachComment.length < 10 || overrideReasonMissing)
      : normalBlocked;
    const message = manualOverride
      ? exactDuplicate
        ? "같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다. 기존 수업을 수정해 주세요."
        : overrideReasonMissing
          ? "강제 처리 사유를 5자 이상 입력해 주세요."
          : coachComment.length < 10
            ? "실제 수업 코멘트를 10자 이상 입력해 주세요."
            : `정책 충돌 ${overrideWarnings.length}건을 우회해 완료 처리하고 감사 기록을 남깁니다.`
      : normalMessage;
    $("#lessonPreview").innerHTML = `
      <strong>${candidate.day} ${candidate.time}~${minutesToTime(end)} · 과거 수업 완료 반영</strong>
      <span>${lessonSourceLabel(candidate.lessonSource)} · ${getLessonMembersLabel(candidate)} · ${getCoachName(candidate.coachId)} · ${candidate.durationMinutes}분</span>
    `;
    setLessonFormMessage(message, blocked ? "danger" : "good");
    setLessonSubmitEnabled(!blocked);
    syncAdminManualOverrideUi(overrideWarnings);
    return;
  }
  const regularScheduleValidation = getRegularScheduleValidation(ticket);
  const selectedSchedules = getSelectedLessonSchedules();
  const scheduleScopeMismatch = ticket && selectedSchedules.some((schedule) => !ticketAllowsScheduleDay(ticket, schedule.day));
  const conflict = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes) || selectedSchedules
    .map((schedule) => getLessonConflict(getLessonFormCandidate({ day: schedule.day, time: schedule.time })))
    .find(Boolean);
  const scheduleCandidates = selectedSchedules.map((schedule) => getLessonFormCandidate({ day: schedule.day, time: schedule.time }));
  const exactDuplicate = scheduleCandidates.map(getAdminManualExactDuplicate).find(Boolean);
  const overrideWarnings = scheduleCandidates.flatMap((item) => getAdminManualOverrideWarnings(item, ticket, false));
  const uniqueOverrideWarnings = [...new Set(overrideWarnings)];
  const overrideReasonMissing = false;
  const internalDuplicate = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes);
  const scheduleLabel = selectedSchedules
    .map((schedule) => `${schedule.day} ${schedule.time}~${minutesToTime(timeToMinutes(schedule.time) + candidate.durationMinutes)}`)
    .join(", ");
  $("#lessonPreview").innerHTML = `
    <strong>${scheduleLabel || `${candidate.day} ${candidate.time}~${minutesToTime(end)}`}</strong>
    <span>${lessonSourceLabel(candidate.lessonSource)} · ${getLessonMembersLabel(candidate)} · ${getCoachName(candidate.coachId)} · ${getLessonRoundLabel(candidate)} · ${lessonTypeLabel(candidate)}</span>
  `;
  const normalBlocked = Boolean(!ticket || sourceTicketMismatch || !regularScheduleValidation.valid || scheduleScopeMismatch || conflict);
  const overrideBlocked = Boolean(!ticket || exactDuplicate || internalDuplicate || overrideReasonMissing);
  setLessonFormMessage(
    manualOverride
      ? exactDuplicate
        ? "같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요."
        : internalDuplicate
          ? internalDuplicate.message
          : overrideReasonMissing
            ? "강제 처리 사유를 5자 이상 입력해 주세요."
            : `정책 충돌 ${uniqueOverrideWarnings.length}건을 우회해 저장하고 감사 기록을 남깁니다.`
      : !ticket || sourceTicketMismatch
      ? "선택한 수업 종류에 맞는 회원권이 없습니다. 회원권 또는 수업 종류를 확인해 주세요."
      : !regularScheduleValidation.valid
        ? regularScheduleValidation.message
      : scheduleScopeMismatch
        ? `${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))}에서 이용할 수 없는 요일입니다.`
      : conflict
        ? conflict.message
        : "추가 가능한 시간입니다.",
    manualOverride ? overrideBlocked ? "danger" : "good" : normalBlocked ? "danger" : "good",
  );
  setLessonSubmitEnabled(manualOverride ? !overrideBlocked : !normalBlocked);
  syncAdminManualOverrideUi(uniqueOverrideWarnings);
}

function openLessonModal(defaults = {}) {
  state.editingLessonId = defaults.editingLessonId || null;
  state.releasedAbsenceEntitlementId = state.editingLessonId ? "" : defaults.entitlementId || "";
  const restoreEntitlement = state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
  state.pinnedLessonTicketId = state.editingLessonId ? "" : defaults.ticketId || restoreEntitlement?.ticketId || "";
  state.lessonSourceTouched = false;
  const hasPinnedScheduleSlot = Boolean(!state.editingLessonId && defaults.day && defaults.time && defaults.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
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
  if ($("#lessonAdminOverride")) $("#lessonAdminOverride").checked = false;
  $("#lessonPastCoachComment").value = "";
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
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource || liveLessonSource(editingLesson));
    $("#lessonDuration").value = String(editingLesson.durationMinutes);
  }
  if (defaults.day) $("#lessonDay").value = defaults.day;
  if (defaults.time) $("#lessonTime").value = defaults.time;
  if (defaults.courtId) $("#lessonCourt").value = defaults.courtId;
  if (defaults.coachId) $("#lessonCoach").value = defaults.coachId;
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
    $("#lessonSource").value = normalizeLessonSource(editingLesson.lessonSource || liveLessonSource(editingLesson));
    state.lessonSourceTouched = true;
  } else {
    syncLessonSourceFromTicket(true);
  }
  if (!editingLesson && defaults.lessonSource) {
    $("#lessonSource").value = normalizeLessonSource(defaults.lessonSource);
    state.lessonSourceTouched = true;
    alignTicketToLessonSource();
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
  refreshLessonTimeOptions(hasPinnedScheduleSlot ? defaults.time : $("#lessonTime").value);
  if (hasPinnedScheduleSlot) {
    $("#lessonCoach").value = defaults.coachId;
    $("#lessonDay").value = defaults.day;
    $("#lessonCourt").value = defaults.courtId || $("#lessonCourt").value;
    refreshLessonTimeOptions(defaults.time);
  }
  refreshLessonDayOptions();
  syncLessonTypeFromForm();
  renderCurrentLessonMembers(editingLesson);
  renderLessonExpiredTickets();
  $("#lessonModalTitle").textContent = editingLesson ? "수업 수정" : "수업 추가";
  $("#saveLessonButton").textContent = editingLesson ? "수정 저장" : "시간표에 추가";
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
  renderLessonPreview();
  $("#lessonMember").focus();
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

async function markEditingLessonAbsentForMakeup() {
  const lesson = lessons.find((item) => item.id === state.editingLessonId);
  const reason = $("#lessonAbsenceReason")?.value.trim() || "";
  if (!lesson?.serverLessonId || lesson.serverStatus !== "scheduled" || normalizeLessonSource(lesson.lessonSource) !== "regular") {
    setLessonFormMessage("예정 상태의 정규수업만 불참 처리할 수 있습니다.", "danger");
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
    closeLessonModal();
    await syncAdminLiveData();
    setView("schedule");
    showToast("불참 처리 완료 · 빈자리 공개 및 보강 안내 생성");
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
    if (button) {
      button.disabled = false;
      button.textContent = "불참 처리·보강 열기";
    }
  }
}

function closeLessonModal() {
  $("#lessonModal").hidden = true;
  state.editingLessonId = null;
  state.releasedAbsenceEntitlementId = "";
  state.pinnedLessonTicketId = "";
  setLessonFormMessage("");
}

function oneDayBookingForId(bookingId) {
  return lessons.find((lesson) => lesson.oneDayBooking && String(lesson.serverOneDayBookingId) === String(bookingId)) || null;
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

function renderOneDayBookingPreview() {
  const values = oneDayBookingFormValues();
  const target = $("#oneDayBookingPreview");
  const coach = coaches.find((item) => item.id === values.coachId);
  if (!target) return;
  if (!values.bookingDate || !values.time || !values.coachId) {
    target.innerHTML = "<strong>원데이 예약 시간 선택</strong><span>이름, 코치, 날짜와 시간을 입력해 주세요.</span>";
    setOneDayBookingMessage("");
    return;
  }
  const candidateStart = timeToMinutes(values.time);
  const candidateEnd = candidateStart + values.durationMinutes;
  const conflict = lessons.find((lesson) => {
    if (String(lesson.serverOneDayBookingId || "") === String(values.bookingId || "")) return false;
    if (lesson.lessonDate !== values.bookingDate || lesson.coachId !== values.coachId) return false;
    if (["cancelled", "archived"].includes(lesson.serverStatus || "")) return false;
    const lessonStart = timeToMinutes(lesson.time);
    const lessonEnd = lessonStart + Number(lesson.durationMinutes || 20);
    return candidateStart < lessonEnd && candidateEnd > lessonStart;
  });
  target.innerHTML = `
    <strong>${escapeHtml(values.bookingDate)} ${escapeHtml(values.time)}~${escapeHtml(minutesToTime(candidateEnd))}</strong>
    <span>${escapeHtml(values.guestName || "원데이 방문자")} · ${escapeHtml(getCoachName(values.coachId))} · ${values.durationMinutes}분</span>
  `;
  if (conflict) {
    setOneDayBookingMessage(`${conflict.member} 예약과 시간이 겹칩니다. 다른 시간을 선택해 주세요.`, "danger");
  } else if (!isCoachAvailableForSlot(values.coachId, scheduleDays[new Date(`${values.bookingDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${values.bookingDate}T00:00:00`).getDay() - 1], values.time, values.durationMinutes)) {
    setOneDayBookingMessage(`${coach?.name || "선택한 코치"}의 근무 시간 또는 브레이크를 확인해 주세요.`, "danger");
  } else {
    setOneDayBookingMessage("회원가입 전 원데이 예약으로 저장됩니다. 가입 후 자동 연결됩니다.", "good");
  }
}

function openOneDayBookingModal(defaults = {}) {
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
    await syncAdminLiveData();
    closeOneDayBookingModal();
    showToast("원데이 예약 삭제 완료");
  } catch (error) {
    setOneDayBookingMessage("원데이 예약 삭제에 실패했습니다.", "danger");
  } finally {
    button.disabled = false;
  }
}

function releasedAbsenceEntitlement() {
  return state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
}

function renderLessonAbsenceRestorePanel() {
  const panel = $("#lessonAbsenceRestorePanel");
  const entitlement = releasedAbsenceEntitlement();
  if (!panel) return;
  panel.hidden = !(entitlement && ["open", "booked"].includes(entitlement.status) && operationsRole() === "admin");
  if (panel.hidden) return;
  const bookedNote = entitlement.status === "booked"
    ? ` · 예약된 보강 ${entitlement.bookedDate} ${entitlement.bookedTime}도 취소됩니다.`
    : "";
  $("#lessonAbsenceRestoreSummary").textContent = `${entitlement.member} · ${entitlement.originalLabel} · ${entitlement.reason}${bookedNote}`;
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

function liveLessonSource(candidate = {}) {
  if (candidate.lessonSource) return normalizeLessonSource(candidate.lessonSource);
  if (`${candidate.type || ""}`.includes("보강")) return "makeup";
  if (`${candidate.type || ""}`.includes("대타")) return "coach_change";
  return normalizeLessonSource($("#lessonSource")?.value);
}

async function saveLiveAdminLesson(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const lessonDate = adminWeekDateForDay(candidate.day);
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
    target_update_regular_rule: !editingLesson && liveLessonSource(candidate) === "regular",
  };
  if (adminManualOverrideEnabled()) {
    return client.rpc("tn_admin_force_save_lesson", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
      target_makeup_entitlement_id: entitlement?.id || null,
    });
  }
  return client.rpc("tn_admin_save_lesson", payload);
}

async function saveLivePastLessonCorrection(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = getCurrentEditingLesson();
  const lessonDate = adminWeekDateForDay(candidate.day);
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

async function saveLiveMakeupEntitlement(candidate, entitlement) {
  const client = window.TennisNoteDataClient;
  const lessonDate = adminWeekDateForDay(candidate.day);
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
    lessonDate: adminWeekDateForDay(candidate.day),
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
    result = await client.rpc("tn_admin_save_lesson_set", payload);
  }
  if (!result?.ok || Number(result.scheduleCount || 0) < candidates.length) {
    throw new Error("live_lesson_write_not_confirmed");
  }
  return result;
}

function liveLessonWriteVerification(ticket, candidates = []) {
  const ticketId = ticket?.serverTicketId || "";
  const requiredParticipantIds = ticket?.participantUserIds || [];
  const expectedLessons = candidates.map((candidate) => ({
    lessonDate: adminWeekDateForDay(candidate.day),
    time: candidate.time,
    durationMinutes: Number(candidate.durationMinutes),
    lessonSource: liveLessonSource(candidate),
  }));
  const missing = expectedLessons.find((expected) => !lessons.some((lesson) => (
    lesson.ticketId === ticketId
    && lesson.lessonDate === expected.lessonDate
    && lesson.time === expected.time
    && Number(lesson.durationMinutes) === expected.durationMinutes
    && lesson.lessonSource === expected.lessonSource
    && ["scheduled", "pending_change"].includes(lesson.serverStatus)
    && requiredParticipantIds.every((id) => lesson.serverParticipantUserIds?.includes(id))
  )));
  return missing ? "live_lesson_write_not_confirmed" : "";
}

function existingFutureRegularLessons(ticketId, targetSchedules = []) {
  const replaceFromDate = targetSchedules.map((item) => item.lessonDate).filter(Boolean).sort()[0] || "";
  if (!replaceFromDate) return [];
  return lessons.filter((lesson) => (
    String(lesson.ticketId || "") === String(ticketId || "")
    && normalizeLessonSource(lesson.lessonSource) === "regular"
    && lesson.serverStatus === "scheduled"
    && lesson.lessonDate >= replaceFromDate
  ));
}

function regularScheduleProtectionMessage(ticket, candidates = []) {
  if (ticket?.productKind !== "regular" || liveLessonSource(candidates[0]) !== "regular") return "";
  const targetSchedules = candidates.map((candidate) => ({
    lessonDate: adminWeekDateForDay(candidate.day),
    startTime: candidate.time,
  }));
  const existing = existingFutureRegularLessons(ticket.serverTicketId, targetSchedules);
  if (!existing.length) return "";
  return "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.";
}

async function addLessonFromForm(event) {
  event.preventDefault();
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
  if (pastCorrection) {
    const correctionReason = adminPastCorrectionReason();
    const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
    const sourceRequiresEntitlement = candidate.lessonSource === "makeup" && !state.editingLessonId;
    const sourceInvalid = !state.editingLessonId && candidate.lessonSource === "regular";
    const conflict = getPastLessonCorrectionConflict(candidate);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    if (coachComment.length < 10) {
      setLessonFormMessage("실제 수업 코멘트를 10자 이상 입력해 주세요.", "danger");
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
      closeLessonModal();
      setView("schedule");
      await syncAdminLiveData();
      showToast(manualOverride
        ? `관리자 강제 처리 완료 · ${deductedSessions}회 차감 · 감사 기록 저장`
        : `과거 수업 반영 완료 · ${deductedSessions}회 차감${Number.isFinite(remainingSessions) ? ` · 잔여 ${remainingSessions}회` : ""}`);
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      const messages = {
        past_lesson_admin_required: "관리자 계정으로만 과거 수업을 보정할 수 있습니다.",
        past_lesson_not_finished: "아직 끝나지 않은 수업은 과거 완료로 처리할 수 없습니다.",
        past_lesson_reason_too_short: "보정 사유를 5자 이상 입력해 주세요.",
        lesson_complete_comment_too_short: "수업 코멘트를 구체적으로 10자 이상 입력해 주세요.",
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
  const selectedSchedules = state.editingLessonId ? [{ day: candidate.day, time: candidate.time }] : getSelectedLessonSchedules();
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
    const exactDuplicate = candidates.map(getAdminManualExactDuplicate).find(Boolean);
    if (exactDuplicate) {
      setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요.", "danger");
      return;
    }
    const warnings = [...new Set(candidates.flatMap((item) => getAdminManualOverrideWarnings(item, ticket, false)))];
    if (!confirmAdminManualOverride(candidate, warnings)) return;
  }

  if (state.liveScheduleLoaded) {
    const wasEditing = Boolean(state.editingLessonId);
    setLessonSubmitEnabled(false);
    setLessonFormMessage("실서버 시간표에 저장 중입니다.");
    try {
      if (selectedEntitlement && candidates.length !== 1) throw new Error("보강 대기 한 건은 한 시간만 예약할 수 있습니다.");
      if (selectedEntitlement && manualOverride) await saveLiveAdminLesson(candidates[0], selectedEntitlement);
      else if (selectedEntitlement) await saveLiveMakeupEntitlement(candidates[0], selectedEntitlement);
      else if (wasEditing) await saveLiveAdminLesson(candidates[0]);
      else {
        const scheduleProtectionMessage = !manualOverride
          ? regularScheduleProtectionMessage(ticket, candidates)
          : "";
        if (scheduleProtectionMessage) {
          setLessonSubmitEnabled(true);
          setLessonFormMessage(scheduleProtectionMessage, "danger");
          return;
        }
        await saveLiveAdminLessonSet(candidates);
      }
      const synced = await syncAdminLiveData();
      if (!synced) throw new Error("admin_live_refresh_failed_after_write");
      const writeVerificationError = liveLessonWriteVerification(ticket, candidates);
      if (writeVerificationError) throw new Error(writeVerificationError);
      billingLogs.unshift(`${candidate.member} ${selectedSchedules.map((item) => `${item.day} ${item.time}`).join(", ")} 실서버 수업 저장`);
      closeLessonModal();
      setView("schedule");
      showToast(manualOverride
        ? "관리자 강제 처리 완료 · 감사 기록 저장"
        : selectedEntitlement ? "보강 예약 완료" : wasEditing ? "수업 수정 완료" : "수업 추가 완료");
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
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
        target_time_occupied: "담당 코치의 해당 시간이 이미 사용 중입니다.",
        coach_time_occupied: "담당 코치의 해당 시간이 이미 사용 중입니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과했습니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과했습니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과했습니다.",
        lesson_duration_ticket_mismatch: "회원권의 수업시간과 선택한 수업시간이 맞지 않습니다.",
        regular_schedule_pending_change_exists: "처리 중인 수업 변경 요청이 있어 정규시간을 교체할 수 없습니다. 요청을 먼저 처리해 주세요.",
        regular_schedule_count_mismatch: `이 회원권은 주 ${ticket.weeklyCount}회이므로 요일/시간 ${ticket.weeklyCount}개를 모두 선택해 주세요.`,
        regular_schedule_exists_edit_existing: "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.",
        regular_schedule_time_invalid: "회원권 기간 안의 아직 시작하지 않은 시간만 정규시간으로 저장할 수 있습니다.",
        admin_manual_override_reason_required: "강제 처리 사유를 5자 이상 입력해 주세요.",
        admin_manual_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요.",
        admin_manual_ticket_required: "연결할 회원권을 찾지 못했습니다.",
        admin_live_refresh_failed_after_write: "저장 후 서버 시간표를 다시 불러오지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
        live_lesson_write_not_confirmed: "서버 저장 결과를 시간표에서 다시 확인하지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
      };
      const message = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1]
        || error?.message
        || "실서버 수업 저장에 실패했습니다.";
      setLessonFormMessage(message, "danger");
      setLessonSubmitEnabled(true);
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
  closeLessonModal();
  setView("schedule");
  renderAll();
}

function openEditLessonModal(lessonId) {
  const parsedId = Number.isNaN(Number(lessonId)) ? lessonId : Number(lessonId);
  const lesson = lessons.find((item) => item.id === parsedId);
  if (!lesson) return;
  openLessonModal({ editingLessonId: parsedId });
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
  closeLessonModal();
  setView("schedule");
  renderAll();
}

function renderMakeups() {
  const target = $("#makeupRows");
  if (!target) return;
  target.innerHTML = makeupRequests
    .map(
      (item) => `
        <tr>
          <td>${item.member}</td>
          <td>${item.original}</td>
          <td>${item.requested}</td>
          <td>${item.policy}</td>
          <td>${badge(item.status, item.statusLabel)}</td>
          <td>
            ${item.makeupType === "entitlement"
              ? `<button class="small-button" type="button" data-book-entitlement="${item.entitlementId}" ${item.status === "approved" ? "disabled" : ""}>${item.status === "approved" ? "예약완료" : "시간표에서 예약"}</button>`
              : `<button class="small-button" type="button" data-approve-makeup="${item.id}">${item.status === "approved" ? "완료됨" : "승인"}</button>`}
          </td>
        </tr>`,
    )
    .join("");
}

function renderTickets() {
  const target = $("#ticketRows");
  if (!target) return;
  target.innerHTML = expiredTickets.length
    ? expiredTickets
    .map(
      (ticket) => `
        <tr>
          <td>${ticket.member}</td>
          <td>${getTicketDisplayProduct(ticket)} 총 ${ticket.total}회<br><small>잔여 ${ticket.remaining}회</small></td>
          <td>${ticket.total}회</td>
          <td>${ticket.used}회</td>
          <td><strong>${ticket.remaining}회</strong></td>
          <td>${ticket.purchased}~${ticket.expires}<br><small>${ticket.statusLabel}</small></td>
        </tr>`,
    )
    .join("")
    : `<tr><td colspan="6">만료된 회원권 이력이 없습니다.</td></tr>`;
}

function settlementRuleFor(coachName) {
  return coachSettlementRules.find((rule) => rule.coach === coachName) || coachSettlementRules[0];
}

function settlementCoachNameFor(item) {
  if (!item.actualCoach || item.actualCoach === item.coach) return item.coach;
  const actualRule = settlementRuleFor(item.actualCoach);
  if (actualRule.substitute === "originalCoach") return item.coach;
  return item.actualCoach;
}

function settlementAmountFor(item) {
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

function renderCoachSettlementPreview() {
  const previewRows = $("#coachSettlementPreviewRows");
  if (previewRows) {
    const liveSettlementRows = billings
      .filter((billing) => billing.status === "paid")
      .map((billing) => {
        const ticket = tickets.find((item) => item.serverTicketId === billing.ticketId || item.id === billing.ticketId) || {};
        const coachName = getCoachName(ticket.coachId || "");
        return {
          member: billing.member,
          coach: coachName,
          actualCoach: coachName,
          paidAmount: Number(billing.finalAmount || billing.amount) || 0,
          settlementBase: Number(billing.settlementBaseAmount || billing.finalAmount || billing.amount) || 0,
          paymentMethod: String(billing.method || "").toLowerCase().includes("card") ? "카드" : "현금",
          discount: Number(billing.discountAmount) > 0 ? `할인 ${money.format(billing.discountAmount)}원` : "할인 없음",
          lessonCount: Number(ticket.used) || 0,
          totalLessons: Number(ticket.total) || 0,
          minutes: Number(ticket.durationMinutes) || 20,
        };
      });
    const previewItems = adminDemoMode ? coachSettlementPreview : liveSettlementRows;
    previewRows.innerHTML = previewItems
      .map((item) => {
        const settlementCoach = settlementCoachNameFor(item);
        const rule = settlementRuleFor(settlementCoach);
        const transferred = item.coach !== item.actualCoach;
        const ruleLabel = rule.method === "hourly" ? `시급 ${money.format(rule.hourly)}원` : `${Math.round(rule.ratio * 10)}:${10 - Math.round(rule.ratio * 10)}`;
        return `
          <tr>
            <td><strong>${item.member}</strong><br><small>${item.lessonCount}/${item.totalLessons || item.lessonCount}회 완료</small></td>
            <td>${item.coach}${transferred ? `<br><small>대타 ${item.actualCoach} · 정산 ${settlementCoach}</small>` : "<br><small>담당 코치 진행</small>"}</td>
            <td>${money.format(item.paidAmount)}원<br><small>${item.paymentMethod} · ${item.discount}</small></td>
            <td><strong>${money.format(item.settlementBase)}원</strong><br><small>${item.paymentMethod === "카드" ? "부가세 제외 현금가" : "실결제 기준"}</small></td>
            <td>${ruleLabel}<br><small>${transferred ? "대타 이관 적용" : "기본 정산"}</small></td>
            <td><strong>${money.format(settlementAmountFor(item))}원</strong></td>
          </tr>`;
      })
      .join("") || '<tr><td colspan="6" class="empty-text">실제 결제 내역이 없습니다.</td></tr>';
  }

}

function paymentMethodLabel(method = "") {
  const value = String(method || "").trim();
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labels = {
    card: "카드",
    tosspay: "토스페이",
    naverpay: "네이버페이",
    kakaopay: "카카오페이",
    easypay: "간편결제",
    transfer: "계좌이체",
    banktransfer: "계좌이체",
    cash: "현금",
    bank: "계좌이체",
    manual: "관리자 입력",
    legacy: "기존 기록",
    virtualaccount: "가상계좌",
    mobile: "휴대폰결제",
  };
  return labels[normalized] || value.replaceAll("결제청구", "결제요청").replaceAll("청구서", "결제요청");
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
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-cancel-payment="${index}">${label}</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentRefundButtonFor(item, index) {
  if (!item?.providerPaymentId) {
    return `<button class="small-button danger-action" type="button" disabled title="서버 결제번호가 필요합니다.">환불 계산</button>`;
  }
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-refund-payment="${index}">환불 계산</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function renderPaymentAdminGateStatus() {
  const target = $("#paymentAdminGateStatus");
  if (!target) return;
  const ready = adminPaymentCancelReady();
  const tone = ready ? "good" : adminImportAuthState.loading ? "neutral" : "warn";
  target.innerHTML = `
    <article class="payment-admin-gate-card ${tone}">
      <div>
        <strong>${ready ? "결제취소·환불 가능" : "결제취소·환불 잠금"}</strong>
        <span>${escapeHtml(ready ? "관리자 로그인과 권한이 확인되어 결제취소와 환불 계산을 진행할 수 있습니다." : adminPaymentCancelBlockedMessage())}</span>
      </div>
      ${badge(tone, ready ? "관리자 확인됨" : "관리자 확인 필요")}
    </article>`;
}

function billingFilterGroup(item = {}) {
  if (["cancelled", "refunded", "refund_processing", "refund_reconcile"].includes(item.status)) return "refund";
  if (["server_ready", "unverified"].includes(item.status)) return "verifying";
  if (item.status === "paid") return "done";
  return "action";
}

function renderBilling() {
  syncSharedPaymentRequests();
  state.billingFilter = ["action", "verifying", "done", "refund"].includes(state.billingFilter) ? state.billingFilter : "action";
  const pendingRequests = billings.filter((item) => item.status === "draft");
  const pendingChecks = billings.filter((item) => item.status === "check" || item.status === "unverified");
  const rechargeTargets = tickets.filter((ticket) => ticket.remaining <= 1);

  $("#billingRequestCount").textContent = `${pendingRequests.length}건`;
  $("#billingCheckCount").textContent = `${pendingChecks.length}건`;
  $("#ticketRechargeCount").textContent = `${rechargeTargets.length}명`;
  renderPaymentAdminGateStatus();
  renderPaymentChargeAudit();
  $$('[data-billing-count]').forEach((count) => {
    count.textContent = String(billings.filter((item) => billingFilterGroup(item) === count.dataset.billingCount).length);
  });
  $$('[data-billing-filter]').forEach((button) => button.classList.toggle("is-active", button.dataset.billingFilter === state.billingFilter));

  const syncTarget = $("#serverPaymentSyncStatus");
  if (syncTarget) {
    syncTarget.innerHTML = `
      <div class="payment-sync-card ${serverPaymentSyncState.tone}">
        <span>${serverPaymentSyncState.message}</span>
        ${badge(serverPaymentSyncState.tone, serverPaymentSyncState.loading ? "불러오는 중" : serverPaymentSyncState.loaded ? "확인됨" : "대기")}
      </div>`;
  }

  const visibleBillings = billings.filter((item) => billingFilterGroup(item) === state.billingFilter);
  $("#billingRows").innerHTML = visibleBillings.length ? visibleBillings
    .map(
      (item) => {
        const index = billings.indexOf(item);
        return `
        <tr>
          <td>${item.member}<br><small>${paymentEnvironmentBadge(item)}</small></td>
          <td>${item.item}${item.providerPaymentId ? `<br><small>${item.providerPaymentId}</small>` : ""}${item.source ? `<br><small>${paymentSourceText(item)}</small>` : ""}</td>
          <td>${money.format(item.amount)}원${item.discountTitle ? `<br><small>${escapeHtml(item.discountTitle)} · ${money.format(item.discountAmount || 0)}원 할인${item.originalAmount ? ` · 원가 ${money.format(item.originalAmount)}원` : ""}</small>` : ""}</td>
          <td>${paymentMethodLabel(item.method)}</td>
          <td>${badge(item.status, item.statusLabel)}</td>
          <td>
            ${paymentActionFor(item, index)}
          </td>
        </tr>`;
      },
    )
    .join("") : '<tr><td colspan="6" class="empty-text">선택한 상태의 결제 내역이 없습니다.</td></tr>';

  $("#rechargeRows").innerHTML = rechargeTargets.length ? rechargeTargets
    .map(
      (ticket, index) => `
        <tr>
          <td>${ticket.member}</td>
          <td>${ticket.product}</td>
          <td><strong>${ticket.remaining}회</strong></td>
          <td>${ticket.remaining === 0 ? "즉시 충전 필요" : "다음 수업 전 안내"}</td>
          <td><button class="small-button" type="button" data-renew-ticket="${escapeHtml(ticket.serverTicketId || "")}" data-renew-member="${escapeHtml(ticket.member)}">연장 등록</button></td>
        </tr>`,
    )
    .join("") : '<tr><td colspan="5" class="empty-text">연장 확인이 필요한 회원권이 없습니다.</td></tr>';

  $("#billingLog").innerHTML = billingLogs
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function paymentActionFor(item, index) {
  if (item.status === "check") return item.providerPaymentId
    ? `<button class="small-button" type="button" data-review-payment="${index}">서버 확인</button>${paymentCancelButtonFor(index, "대기취소")}`
    : '<button class="small-button" type="button" disabled>서버 결제번호 없음</button>';
  if (item.status === "unverified") return `<button class="small-button" type="button" data-review-payment="${index}">서버 연결 확인</button><button class="small-button danger-action" type="button" data-cancel-payment="${index}">대기취소</button>`;
  if (item.status === "failed") return `<button class="small-button" type="button" data-failed-payment="${index}">실패 확인</button><button class="small-button danger-action" type="button" data-cancel-payment="${index}">대기취소</button>`;
  if (item.status === "draft") return '<button class="small-button" type="button" disabled>회원 결제 대기</button>';
  if (item.status === "server_ready") return `<button class="small-button" type="button" data-server-ready-payment="${index}">결제 확인</button>${paymentCancelButtonFor(index, "대기취소")}`;
  if (item.status === "unverified") return `<button class="small-button" type="button" data-review-payment="${index}">서버 연결 확인</button>`;
  if (item.status === "paid") return `<button class="small-button" type="button" data-paid-payment="${index}">완료됨</button>${paymentRefundButtonFor(item, index)}`;
  if (item.status === "refund_processing") return `<button class="small-button" type="button" disabled>환불처리중</button>`;
  if (item.status === "refund_reconcile") return `<button class="small-button danger-action" type="button" data-refund-payment="${index}">동기화 확인</button>`;
  if (item.status === "failed") return `<button class="small-button" type="button" data-failed-payment="${index}">실패 확인</button>`;
  if (item.status === "cancelled") return `<button class="small-button" type="button" disabled>취소완료</button>`;
  if (item.status === "refunded") return `<button class="small-button" type="button" disabled>환불완료</button>`;
  return "";
}

function isHistoricalImportedPayment(item = {}) {
  const providerPaymentId = String(item.providerPaymentId || "").toLowerCase();
  const method = String(item.method || "").toLowerCase();
  return providerPaymentId.startsWith("sheet_")
    || providerPaymentId.startsWith("legacy_")
    || providerPaymentId.startsWith("import_")
    || method.includes("legacy")
    || method.includes("기존 기록");
}

function chargeStatusForPayment(item = {}) {
  if (item.status === "refund_processing") return { label: "환불 처리중", tone: "warn", detail: "PortOne 취소와 내부 회원권 반영이 진행 중입니다." };
  if (item.status === "refund_reconcile") return { label: "동기화 필요", tone: "danger", detail: "PG 취소 결과와 내부 결제·회원권 상태를 다시 맞춰야 합니다." };
  if (item.status === "paid" && item.ticketId) return { label: "회원권 충전완료", tone: "good", detail: "결제검증 후 연결 회원권이 활성화됩니다." };
  if (item.status === "paid" && isHistoricalImportedPayment(item)) return { label: "이관 결제 기록", tone: "neutral", detail: "기존 장부에서 보존한 결제 증빙이며 현재 회원권 자동 연결 대상이 아닙니다." };
  if (item.status === "paid") return { label: "회원권 연결 확인", tone: "warn", detail: "결제는 확인됐지만 연결된 회원권 ID가 없습니다." };
  if (item.status === "server_ready") return { label: "결제 전 대기", tone: "neutral", detail: "회원이 Toss 결제를 완료하면 서버검증 후 자동 충전됩니다." };
  if (item.status === "unverified") return { label: "서버검증 대기", tone: "warn", detail: "결제창 완료 후 서버 검증이 필요합니다." };
  if (item.status === "cancelled") return { label: "취소/환불완료", tone: "neutral", detail: "결제가 취소됐고 연결 회원권은 충전되지 않거나 환불 처리됩니다." };
  if (item.status === "refunded") return { label: "환불완료", tone: "neutral", detail: "환불 완료 항목은 현재 이용권으로 보지 않습니다." };
  if (item.status === "failed") return { label: "충전 중단", tone: "danger", detail: "결제 실패 항목은 회원권을 충전하지 않습니다." };
  return { label: "확인 필요", tone: "warn", detail: "관리자 확인 후 회원권 상태를 맞춰야 합니다." };
}

function renderPaymentChargeAudit() {
  const target = $("#paymentChargeAudit");
  if (!target) return;
  const tracked = billings
    .filter((item) => item.providerPaymentId || item.source === "Supabase 결제")
    .slice(0, 6);
  target.innerHTML = tracked.length
    ? tracked.map((item) => {
        const status = chargeStatusForPayment(item);
        return `
          <article class="payment-charge-card ${status.tone}">
            <div>
              <span>${escapeHtml(item.member)}</span>
              <strong>${escapeHtml(item.item)}</strong>
              <small>${escapeHtml(status.detail)}</small>
              ${item.ticketId ? `<small>회원권 ${escapeHtml(String(item.ticketId).slice(0, 8))}</small>` : ""}
            </div>
            ${badge(status.tone, status.label)}
          </article>`;
      }).join("")
    : "<p class='empty-text'>서버 결제 기록을 불러오면 회원권 충전 상태가 표시됩니다.</p>";
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

function refundErrorText(code = "") {
  const labels = {
    login_required: "관리자 로그인이 필요합니다.",
    admin_role_required: "관리자 권한 계정만 환불할 수 있습니다.",
    payment_not_found: "결제 기록을 찾지 못했습니다.",
    payment_not_verified: "서버 검증이 끝난 결제만 환불할 수 있습니다.",
    linked_ticket_not_found: "결제와 연결된 이용권을 찾지 못했습니다.",
    refund_preview_changed: "결제 또는 이용 횟수가 바뀌었습니다. 새 계산값을 확인해 주세요.",
    ticket_usage_changed: "이용 횟수가 바뀌었습니다. 새 계산값을 확인해 주세요.",
    policy_fallback_confirmation_required: "현재 정책 기준 계산 확인이 필요합니다.",
    refund_confirmation_required: "최종 확인란에 환불을 입력해 주세요.",
    refund_reason_required: "환불 사유를 입력해 주세요.",
    refund_in_progress: "같은 결제의 환불이 이미 처리 중입니다.",
    reconcile_required: "PG 취소 결과와 내부 기록을 다시 맞춰야 합니다.",
    provider_amount_mismatch: "PG 결제금액과 서버 결제금액이 달라 환불을 중단했습니다.",
    provider_cancel_failed: "PG 환불 요청에 실패했습니다. 결제 상태를 확인해 주세요.",
    nothing_to_refund: "계산된 환불액이 0원이라 자동 환불할 수 없습니다.",
  };
  return labels[code] || "환불 처리 상태를 확인해 주세요.";
}

function renderRefundModal() {
  const target = $("#refundModalContent");
  const fallback = $("#refundFallbackConfirmation");
  const message = $("#refundFormMessage");
  const confirmButton = $("#confirmRefundButton");
  const reconcileButton = $("#retryRefundReconcile");
  if (!target) return;
  if (refundFlowState.loading) {
    target.innerHTML = `<div class="refund-loading">결제와 이용권 기록을 확인하고 있습니다.</div>`;
  } else if (!refundFlowState.preview) {
    target.innerHTML = `<div class="refund-loading">${escapeHtml(refundFlowState.message || "환불 계산값을 불러오지 못했습니다.")}</div>`;
  } else {
    const preview = refundFlowState.preview;
    const policySource = preview.policySnapshotSource === "current_policy_fallback" ? "현재 정책 기준" : "구매 당시 정책";
    target.innerHTML = `
      <div class="refund-target-summary">
        <div>
          <strong>${escapeHtml(preview.memberName || "회원")} · ${escapeHtml(preview.productName || "회원권")}</strong>
          <span>총 ${numericValue(preview.totalSessions)}회 중 ${numericValue(preview.usedSessions)}회 사용 · 잔여 ${numericValue(preview.remainingSessions)}회</span>
          <small>결제번호 ${escapeHtml(preview.paymentId || "확인 필요")} · ${escapeHtml(policySource)}</small>
        </div>
        ${badge(preview.requiresPolicyFallbackConfirmation ? "warn" : "good", policySource)}
      </div>
      <div class="refund-amount-grid">
        <div><span>실제 결제금액</span><strong>${money.format(numericValue(preview.paidAmount))}원</strong></div>
        <div><span>할인 전 기준금액</span><strong>${money.format(numericValue(preview.originalAmount, preview.paidAmount))}원</strong></div>
        <div><span>사용 회차 차감</span><strong>-${money.format(numericValue(preview.usedAmount))}원</strong></div>
        <div><span>위약금 ${numericValue(preview.penaltyRate)}%</span><strong>-${money.format(numericValue(preview.penaltyAmount))}원</strong></div>
        ${numericValue(preview.reservationFee) ? `<div><span>첫 수업 월 예약금</span><strong>-${money.format(numericValue(preview.reservationFee))}원</strong></div>` : ""}
        <div class="refund-total"><span>최종 환불액</span><strong>${money.format(numericValue(preview.refundAmount))}원</strong></div>
      </div>
      <p class="refund-policy-line">실납부액 - 할인 전 사용 회차 - 할인 전 원가의 위약금 - 첫 수업 월 예약금 · 환불 완료 시 연결 이용권의 잔여 횟수는 0회가 됩니다.</p>`;
  }
  if (fallback) {
    fallback.hidden = !refundFlowState.preview?.requiresPolicyFallbackConfirmation;
  }
  if (message) {
    message.textContent = refundFlowState.message || "";
    message.className = `form-message ${refundFlowState.tone === "danger" ? "danger" : refundFlowState.tone === "good" ? "good" : ""}`;
  }
  if (confirmButton) {
    confirmButton.disabled = refundFlowState.loading || refundFlowState.submitting || !refundFlowState.preview || refundFlowState.reconcileRequired;
    confirmButton.hidden = refundFlowState.reconcileRequired;
    confirmButton.textContent = refundFlowState.submitting ? "환불 처리중" : "환불 확정";
  }
  if (reconcileButton) {
    reconcileButton.hidden = !refundFlowState.reconcileRequired;
    reconcileButton.disabled = refundFlowState.submitting;
  }
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

async function cancelBillingPaymentItem(item) {
  if (item && ["check", "unverified", "failed"].includes(item.status)) {
    item.status = "cancelled";
    item.statusLabel = "대기취소";
    billingLogs.unshift(`${item.member} ${item.item} 대기건 정리: ${item.providerPaymentId || "paymentId 없음"}`);
    saveSnapshot();
    renderAll();
    showToast("결제 대기건 정리 완료");
    return;
  }
  if (!item?.providerPaymentId) {
    billingLogs.unshift(`${item?.member || "회원"} ${item?.item || "결제"} 취소 실패: paymentId 없음`);
    renderAll();
    showToast("paymentId가 없어 결제취소를 실행할 수 없습니다");
    return;
  }
  if (!["paid", "server_ready"].includes(item.status)) {
    showToast("취소 가능한 상태가 아닙니다");
    return;
  }
  if (!(await ensureAdminPaymentCancelReady(item))) return;
  const actionLabel = item.status === "paid" ? "실제 결제취소" : "결제 전 대기취소";
  const ok = window.confirm(`${item.member} ${item.item} ${money.format(item.amount)}원 ${actionLabel}를 진행할까요?`);
  if (!ok) {
    billingLogs.unshift(`${item.member} ${item.item} ${actionLabel} 실행 안 함`);
    renderAll();
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: Supabase 연결값 없음`);
    renderAll();
    showToast("Supabase 연결값 확인 필요");
    return;
  }

  item.statusLabel = "취소처리중";
  billingLogs.unshift(`${item.member} ${item.item} ${actionLabel} 요청: ${item.providerPaymentId}`);
  renderAll();

  try {
    const result = await client.invokeFunction("portone-payment/cancel", {
      body: {
        paymentId: item.providerPaymentId,
        amount: item.amount,
        reason: item.status === "paid" ? "관리자 테스트 결제 취소" : "결제 전 대기건 정리",
      },
    });
    if (result?.ok) {
      item.status = "cancelled";
      item.statusLabel = result.localOnly ? "대기취소" : "결제취소";
      billingLogs.unshift(`${item.member} ${item.item} 취소 완료: ${result.localOnly ? "대기건 정리" : "PortOne 취소"}`);
      await loadServerPaymentsIntoBilling({ silent: true });
      showToast(result.localOnly ? "대기 결제 정리 완료" : "결제 취소 완료");
    } else {
      item.status = "check";
      item.statusLabel = "취소확인필요";
      billingLogs.unshift(`${item.member} ${item.item} 취소 확인 필요: ${result?.code || "unknown"}`);
      showToast("취소 확인 필요");
    }
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    item.status = "check";
    item.statusLabel = "취소실패";
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: ${code}`);
    showToast("결제 취소 실패");
  }
  renderAll();
}

function recordStatusBadge(record) {
  const statusTone = {
    pending: "pending",
    feedback: "requested",
    done: "confirmed",
    issue: "attention",
  };
  return badge(statusTone[record.group] || "neutral", record.statusLabel);
}

function legacyNoteRecord(note) {
  const done = note.status === "confirmed";
  return {
    id: `legacy-note-${note.id}`,
    group: done ? "done" : "pending",
    source: "관리자 샘플",
    member: note.member,
    title: note.lesson,
    detail: note.reflection,
    subDetail: note.next,
    statusLabel: done ? "차감 확인됨" : "코치 확인 필요",
    actionLabel: done ? "완료" : "코치앱 처리 필요",
  };
}

function lessonLogRecord(log) {
  const done = log.status === "confirmed";
  const hasIssue = done && (!log.coachComment || !(log.nextCurriculumId || log.curriculumId || log.curriculum?.id));
  return {
    id: log.id || `lesson-log-${log.member}-${log.submittedAt || Date.now()}`,
    group: hasIssue ? "issue" : done ? "done" : "pending",
    source: "회원/코치 기록",
    member: log.member || "회원",
    title: log.lessonLabel || log.lesson || `${log.date || ""} 수업`,
    detail: log.content || log.selfMemo || "회원 운동일지 또는 코치 완료 처리 확인",
    subDetail: log.coachComment ? `코치 코멘트: ${log.coachComment}` : "코치 코멘트 미등록",
    statusLabel: hasIssue ? "기록 보완 필요" : done ? "차감 완료" : "차감 대기",
    actionLabel: hasIssue ? "관리자 확인" : done ? "완료" : "코치앱 처리",
  };
}

function feedbackRecord(request) {
  const done = request.status === "코치 답변 완료";
  return {
    id: request.id || `feedback-${request.member}-${request.date || Date.now()}`,
    group: done ? "done" : "feedback",
    source: "운동노트 피드백",
    member: request.member || "회원",
    title: `${request.date || "날짜 미정"} 사진/영상 피드백`,
    detail: request.question || request.memo || "코치 코멘트 요청",
    subDetail: request.coachFeedback ? `답변: ${request.coachFeedback}` : "코치 답변 대기",
    statusLabel: done ? "답변 완료" : "피드백 대기",
    actionLabel: done ? "완료" : "코치앱 답변",
  };
}

function adminRecordGroups() {
  const shared = operationalSharedData();
  const records = [
    ...lessonNotes.map(legacyNoteRecord),
    ...shared.lessonLogs.map(lessonLogRecord),
    ...shared.feedbackRequests.map(feedbackRecord),
  ];
  return {
    pending: records.filter((record) => record.group === "pending"),
    feedback: records.filter((record) => record.group === "feedback"),
    done: records.filter((record) => record.group === "done"),
    issue: records.filter((record) => record.group === "issue"),
  };
}

function renderNotes() {
  const target = $("#recordAuditRows");
  if (!target) return;
  const groups = adminRecordGroups();
  const activeFilter = ["pending", "feedback", "done", "issue"].includes(state.recordFilter) ? state.recordFilter : "pending";
  state.recordFilter = activeFilter;

  $("#recordPendingCount").textContent = `${groups.pending.length}건`;
  $("#recordFeedbackCount").textContent = `${groups.feedback.length}건`;
  $("#recordDoneCount").textContent = `${groups.done.length}건`;
  $("#recordIssueCount").textContent = `${groups.issue.length}건`;
  $$("[data-record-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.recordFilter === activeFilter));

  target.innerHTML = groups[activeFilter]
    .map(
      (record) => `
        <article class="record-audit-card ${record.group}">
          <div>
            <span>${escapeHtml(record.source)}</span>
            <strong>${escapeHtml(record.member)} · ${escapeHtml(record.title)}</strong>
            <p>${escapeHtml(record.detail)}</p>
            <small>${escapeHtml(record.subDetail)}</small>
          </div>
          <aside>
            ${recordStatusBadge(record)}
            <b>${escapeHtml(record.actionLabel)}</b>
          </aside>
        </article>`,
    )
    .join("") || "<p class='empty-text'>해당 상태의 기록이 없습니다.</p>";
}

function renderRackettime() {
  if (!$("#racketMetricCards") || !$("#settlementRows") || !$("#racketMemberRows")) return;
  $("#racketMetricCards").innerHTML = operationMetrics
    .map(
      (item) => `
        <article class="operation-card ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.compare}</small>
        </article>`,
    )
    .join("");

  $("#settlementRows").innerHTML = settlements
    .map(
      (item) => `
        <tr>
          <td>${item.date}</td>
          <td>${money.format(item.sales)}원</td>
          <td>-${money.format(item.fee)}원</td>
          <td><strong>${money.format(item.net)}원</strong></td>
        </tr>`,
    )
    .join("");

  $("#racketMemberRows").innerHTML = racketMembers
    .map(
      (member) => `
        <tr>
          <td>${member.name}</td>
          <td>${member.reservations}회</td>
          <td>${money.format(member.total)}원</td>
          <td>${member.lastVisit}</td>
          <td>${member.action}</td>
        </tr>`,
    )
    .join("");
}

function renderCommunity() {
  if (!$("#communityFeed") || !$("#hotTopics")) return;
  const filteredPosts = state.communityChannel === "홈" ? communityPosts : communityPosts.filter((post) => post.channel === state.communityChannel);
  $("#communityFeed").innerHTML = filteredPosts.length ? filteredPosts
    .map(
      (post) => `
        <article class="post-card">
          <div class="post-meta">
            <span>${post.channel}</span>
            <b>${post.type}</b>
          </div>
          <h2>${post.title}</h2>
          <p>${post.body}</p>
          <div class="post-actions">
            <span>좋아요 ${post.likes}</span>
            <span>댓글 ${post.comments}</span>
          </div>
        </article>`,
    )
    .join("") : `<p class="empty-text">${state.communityChannel} 채널에 새 글을 작성해보세요.</p>`;

  $("#hotTopics").innerHTML = [
    "보강 가능한 빈 시간대",
    "초보 회원이 자주 묻는 질문",
    "이번 주 동호회 참가 명단",
    "개인 연습 이용 후기",
  ]
    .map((topic) => `<li>${topic}</li>`)
    .join("");
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

function csvCell(value = "") {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
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

function downloadWorkbook(filename, sheets) {
  if (!window.XLSX) {
    const firstSheet = sheets[0];
    downloadRowsAsCsv(filename.replace(/\.xlsx$/i, ".csv"), firstSheet.rows);
    showToast("엑셀 모듈을 불러오지 못해 CSV로 저장했습니다");
    return;
  }
  const workbook = window.XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = window.XLSX.utils.aoa_to_sheet(sheet.rows);
    window.XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  window.XLSX.writeFile(workbook, filename);
}

function importSampleRows() {
  return [
    ["회원", "홍길동", "010-0000-0000", "", "", "수강중", "노코치", "주2회 개인 20분", 20, 2, 8, 2, 6, "2026-07-10", "카드", 165000, "월", "18:40", "수", "19:20", "신규 등록 예시"],
    ["회원", "김테니스", "010-1111-1111", "이파트너", "010-2222-2222", "수강중", "강코치", "주1회 2대1 20분", 20, 1, 8, 0, 8, "2026-07-10", "현금", 150000, "토", "09:00", "", "", "2대1 공동 시간표 예시"],
  ];
}

function importGuideRows() {
  return [
    ["항목", "내용"],
    ["입력 방식", "업로드양식 시트에 한 회원권 또는 한 정규시간 기준으로 한 줄씩 입력합니다."],
    ["필수 컬럼", requiredImportColumns.join(", ")],
    ["횟수 검증", "총횟수 - 사용횟수 = 잔여횟수로 맞아야 합니다."],
    ["코치명", "관리자 대시보드에 등록된 코치명과 맞아야 합니다."],
    ["2대1/그룹", "대표 회원은 회원명/연락처에, 파트너는 동반회원명/동반연락처에 각각 입력합니다."],
    ["정규요일/시간", "주2회 이상이면 정규요일1/정규시간1, 정규요일2/정규시간2를 함께 입력합니다."],
    ["민감정보", "연락처는 실제 서비스에서 관리자 권한으로만 저장하고 내보내기 이력에 남깁니다."],
    ["실제 반영", "파일 업로드 후 검증 결과를 확인하고, 서버 검증이 통과한 행만 DB에 반영합니다."],
  ];
}

function downloadImportTemplate() {
  downloadWorkbook("tennis-note-import-template.xlsx", [
    { name: "업로드양식", rows: [importTemplateColumns] },
    { name: "작성예시", rows: [importTemplateColumns, ...importSampleRows()] },
    { name: "작성가이드", rows: importGuideRows() },
  ]);
  billingLogs.unshift("데이터 가져오기 통합 양식 다운로드");
  renderAll();
  showToast("엑셀 양식 다운로드 완료");
}

function parseDelimitedRows(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeImportHeader(value = "") {
  return String(value).replace(/\s+/g, "").trim();
}

function rowObjectFromHeaders(headers, row) {
  return headers.reduce((acc, header, index) => {
    acc[header] = row[index] ?? "";
    return acc;
  }, {});
}

function importCell(row, column) {
  return String(row[column] ?? "").trim();
}

function isNumericImportValue(value) {
  if (String(value ?? "").trim() === "") return true;
  return Number.isFinite(Number(String(value).replaceAll(",", "")));
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

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function readWorkbookFile(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      reject(new Error("엑셀 해석 모듈을 불러오지 못했습니다. CSV로 저장해 다시 올려주세요."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = window.XLSX.read(reader.result, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      resolve(window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }));
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
    serverStatus: "idle",
    serverMessage: "",
    serverPreview: null,
  });
  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let rows = [];
    if (extension === "xlsx" || extension === "xls") {
      rows = await readWorkbookFile(file);
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
    serverStatus: "idle",
    serverMessage: "",
    serverPreview: null,
  });
}

const importServerIssueLabels = {
  no_rows: "가져올 행이 없습니다.",
  required_value_missing: "필수값이 비어 있습니다.",
  numeric_value_invalid: "숫자로 입력해야 하는 값이 맞지 않습니다.",
  ticket_balance_mismatch: "총횟수, 사용횟수, 잔여횟수가 맞지 않습니다.",
  time_format_review: "수업 시간 형식 확인이 필요합니다.",
  unknown_coach_name: "등록된 코치명과 맞는지 확인이 필요합니다.",
  possible_duplicate_ticket_row: "같은 회원/코치/회원권 조합이 중복될 수 있습니다.",
  group_partner_required: "2대1 회원권은 동반 회원 이름과 연락처가 필요합니다.",
  group_partner_same_phone: "대표 회원과 동반 회원의 연락처가 같습니다.",
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

function preferredLocalCoachId(displayName = "") {
  const value = displayName.trim().toLowerCase().replace(/\s+/g, " ");
  if (value.includes("노황규") || value.includes("노 코치") || value === "no coach" || value === "coach no") return "coach-no";
  if (value.includes("강정훈") || value.includes("강 코치") || value === "kang coach" || value === "coach kang") return "coach-kang";
  if (value.includes("황유미") || value.includes("황 코치") || value === "hwang coach" || value === "coach hwang") return "coach-hwang";
  if (value.includes("박창준") || value === "park coach" || value === "coach park") return "coach-park";
  return "";
}

function mergeServerCoachRole(role, index) {
  const preferredId = preferredLocalCoachId(role.display_name || "");
  let coach = coaches.find((item) => item.serverRoleId === role.id)
    || coaches.find((item) => preferredId && item.id === preferredId)
    || coaches.find((item) => item.name === role.display_name);
  if (!coach) {
    const availabilityByCoach = {
      "coach-no": "split",
      "coach-kang": "weekday-pm",
      "coach-hwang": "weekday-am",
      "coach-park": "weekend",
    };
    coach = {
      id: preferredId || `coach-live-${index + 1}`,
      name: role.display_name || `코치 ${index + 1}`,
      role: "레슨",
      status: "active",
      account: "Supabase 연결",
      coachMode: "approved",
      availability: availabilityByCoach[preferredId] || "full",
      photoUrl: "",
    };
    coaches.push(coach);
  }
  Object.assign(coach, {
    serverRoleId: role.id,
    branchId: role.branch_id,
    status: role.status === "approved" ? "active" : "inactive",
    coachMode: role.status === "approved" ? "approved" : "disabled",
    color: role.color || coach.color || "",
    settlementType: role.settlement_type || "ratio",
    settlementRate: Number(role.settlement_rate) || 0,
    hourlyRate: Number(role.hourly_rate) || 0,
  });
  return coach;
}

function liveTicketParticipantIds(ticket, ticketParticipants = []) {
  return [...new Set([
    ticket.user_id,
    ...ticketParticipants.filter((item) => item.ticket_id === ticket.id).map((item) => item.user_id),
  ].filter(Boolean))];
}

function liveTicketLessonKind(product = {}) {
  return Number(product.group_size) === 2 ? "2대1" : "개인";
}

function liveTicketScheduleScope(product = {}, ticket = {}, lessons = []) {
  const configuredScope = ["weekday", "weekend", "mixed"].includes(product.schedule_scope) ? product.schedule_scope : "weekday";
  const productCode = String(product.product_code || "");
  if (productCode.startsWith("admin-ticket-")) return configuredScope;

  const productName = String(product.name || "");
  if (productName.includes("주말")) return "weekend";
  if (productName.includes("평일")) return "weekday";

  const existingLesson = lessons.find((lesson) => (
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

function liveLessonStatus(status = "scheduled") {
  if (status === "pending_change") return "pending";
  if (["completed", "no_show"].includes(status)) return "confirmed";
  return "scheduled";
}

function adminWeekDateForDay(day) {
  const week = activeAdminWeek();
  const dayIndex = scheduleDays.indexOf(day);
  if (!week.startDate || dayIndex < 0) return "";
  const date = new Date(`${week.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return adminLocalDateKey(date);
}

async function syncAdminLiveData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !operationsAccessReady()) return false;
  const fullAdminAccess = operationsRole() === "admin";
  const wasLoaded = state.liveScheduleLoaded;
  Object.assign(state, {
    liveScheduleLoading: true,
    liveScheduleMessage: "실서버 회원·코치·시간표를 불러오는 중",
  });
  try {
    const [serverUsers, serverCoachRoles, serverCoachAvailability, serverAuthLinks, serverAuthSwitches, serverSettlementTerms, serverProducts, serverTickets, ticketParticipants, lessonParticipants, serverLessons, serverOneDayBookings, serverEnrollments, serverChangeRequests, serverMakeupEntitlements, serverLessonRecords, serverPayments, serverGroupAccounts, serverGroupMembers, serverGroupTicketLinks, serverMemberDatabaseRecords, serverMemberMembershipRecords] = await Promise.all([
      client.selectRows("tn_users", { select: "id,name,nickname,phone,birth_year,neighborhood,gender,profile_photo_url,dominant_hand,backhand_style,tennis_started_on,self_ntrp,coach_ntrp,tennis_goal,play_style_memo,role,member_kind,status,auth_user_id,merged_into_user_id,merged_at,permanently_deleted_at", limit: 500 }),
      client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,job_title,employment_status,employment_started_on,employment_ended_on,archived_at,settlement_type,settlement_rate,hourly_rate,settlement_basis,settlement_effective_from", limit: 100 })
        .catch(() => client.selectRows("tn_coach_roles", { select: "id,user_id,branch_id,display_name,bio,color,status,settlement_type,settlement_rate,hourly_rate", limit: 100 })),
      client.selectRows("tn_coach_availability", { select: "id,coach_role_id,day_of_week,start_time,end_time,availability_type,note", limit: 1000 }).catch(() => []),
      fullAdminAccess ? client.selectRows("tn_user_auth_links", { select: "id,user_id,provider,last_sign_in_at,is_primary", limit: 500 }).catch(() => []) : Promise.resolve([]),
      fullAdminAccess ? client.selectRows("tn_auth_provider_switches", { select: "id,user_id,from_provider,to_provider,status,expires_at,created_at,completed_at", order: "created_at.desc", limit: 500 }).catch(() => []) : Promise.resolve([]),
      fullAdminAccess ? client.selectRows("tn_coach_settlement_terms", { select: "id,coach_role_id,settlement_type,coach_rate,hourly_rate,settlement_basis,substitute_policy,effective_from,effective_to,status", order: "effective_from.desc", limit: 500 }).catch(() => []) : Promise.resolve([]),
      client.selectRows("tn_membership_products", { select: "id,branch_id,product_code,name,lesson_minutes,frequency_per_week,total_sessions,group_size,product_kind,is_coupon,is_active,schedule_scope,term_weeks,validity_days,grace_days,card_price,cash_price,settlement_base_price,discount_enabled,coach_discount_allowed,policy_settings,display_order", limit: 300 }),
      client.selectRows("tn_member_tickets", { select: "id,user_id,product_id,branch_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,purchased_price", limit: 500 }),
      client.selectRows("tn_ticket_participants", { select: "ticket_id,user_id,participant_order", limit: 500 }),
      client.selectRows("tn_lesson_participants", { select: "lesson_id,user_id,ticket_id", limit: 1000 }),
      client.selectRows("tn_lessons", { select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,group_account_id,lesson_date,start_time,duration_minutes,status,lesson_source", limit: 1000 })
        .catch(() => client.selectRows("tn_lessons", { select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source", limit: 1000 })),
      fullAdminAccess ? client.selectRows("tn_one_day_bookings", { select: "id,branch_id,coach_role_id,booking_date,start_time,duration_minutes,guest_name,guest_phone,note,status,linked_user_id,created_at", limit: 1000 }).catch(() => []) : Promise.resolve([]),
      client.selectRows("tn_member_enrollments", { select: "id,user_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,submitted_at,approved_at", limit: 500 }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", { select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,created_at", limit: 500 }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", { select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at", limit: 500 }).catch(() => []),
      client.selectRows("tn_lesson_records", { select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at", limit: 500 }).catch(() => []),
      fullAdminAccess ? client.selectRows("tn_payments", { select: "id,user_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at", limit: 500 }).catch(() => []) : Promise.resolve([]),
      client.selectRows("tn_group_accounts", { select: "id,branch_id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required", limit: 200 }).catch(() => []),
      client.selectRows("tn_group_account_members", { select: "group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay", limit: 500 }).catch(() => []),
      client.selectRows("tn_group_ticket_links", { select: "group_account_id,user_id,ticket_id,status", limit: 500 }).catch(() => []),
      fullAdminAccess ? client.selectRows("tn_member_database_records", {
        select: "id,user_id,current_ticket_id,branch_id,coach_role_id,record_status,lesson_schedule_scope,lesson_frequency_per_week,lesson_type,lesson_days,lesson_start_on,total_sessions,used_sessions,remaining_sessions,payment_recorded_on,payment_method,payment_amount,admin_note,source_name,source_sheet_id,source_tab_name,source_row_number,last_updated_via",
        limit: 1000,
      }).catch(() => []) : Promise.resolve([]),
      fullAdminAccess ? client.selectRows("tn_member_membership_records", {
        select: "id,user_id,ticket_id,branch_id,coach_role_id,record_status,lesson_schedule_scope,lesson_frequency_per_week,lesson_type,lesson_minutes,lesson_days,lesson_start_on,total_sessions,used_sessions,remaining_sessions,payment_recorded_on,payment_method,payment_amount,admin_note,source_name,source_sheet_id,source_tab_name,source_row_number,last_updated_via",
        limit: 2000,
      }).catch(() => []) : Promise.resolve([]),
    ]);

    const usersById = new Map((serverUsers || []).map((user) => [user.id, user]));
    const authLinksByUserId = new Map();
    (serverAuthLinks || []).forEach((link) => {
      const links = authLinksByUserId.get(link.user_id) || [];
      links.push(link);
      authLinksByUserId.set(link.user_id, links);
    });
    const productsById = new Map((serverProducts || []).map((product) => [product.id, product]));
    const memberRecordByUserId = new Map((serverMemberDatabaseRecords || []).map((record) => [record.user_id, record]));
    const memberRecordByTicketId = new Map((serverMemberDatabaseRecords || [])
      .filter((record) => record.current_ticket_id)
      .map((record) => [record.current_ticket_id, record]));
    const membershipRecordByTicketId = new Map((serverMemberMembershipRecords || [])
      .filter((record) => record.ticket_id)
      .map((record) => [record.ticket_id, record]));
    const coachIdByRole = new Map();
    (serverCoachRoles || []).forEach((role, index) => {
      const coach = mergeServerCoachRole(role, index);
      const coachUser = usersById.get(role.user_id) || {};
      const authLinks = authLinksByUserId.get(role.user_id) || [];
      coach.accountLinked = Boolean(coachUser.auth_user_id || authLinks.length);
      coach.account = coach.accountLinked ? (coachUser.name || role.display_name || "가입 완료") : "회원가입 전";
      coach.phone = coachUser.phone || "";
      const coachPhone = normalizedMemberPhone(coach.phone);
      const coachName = normalizedCoachLinkName(coachUser.name || role.display_name);
      const loginCandidates = !coach.accountLinked && coachPhone && coachName
        ? (serverUsers || []).filter((candidate) => {
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
      coach.authProviders = authProvidersFromLinks(authLinks);
      coach.authSwitch = (serverAuthSwitches || []).find((item) => item.user_id === role.user_id && item.status === "pending") || null;
      coach.lastSignInAt = authLinks.map((link) => link.last_sign_in_at).filter(Boolean).sort().at(-1) || "";
      coach.approvalStatus = role.status || "pending";
      const availabilityRows = (serverCoachAvailability || []).filter((item) => item.coach_role_id === role.id);
      coach.workBlocks = coachBlocksFromAvailability(availabilityRows, "available");
      coach.breakBlocks = coachBlocksFromAvailability(availabilityRows, "blocked");
      coachIdByRole.set(role.id, coach.id);
    });
    const liveCoachIds = new Set(coachIdByRole.values());
    replaceArray(coaches, coaches.filter((coach) => liveCoachIds.has(coach.id)));
    const savedSettlementRules = [...coachSettlementRules];
    replaceArray(coachSettlementRules, coaches.map((coach) => {
      const term = (serverSettlementTerms || []).find((item) => item.coach_role_id === coach.serverRoleId);
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

    const mappedTickets = (serverTickets || []).map((ticket) => {
      const product = productsById.get(ticket.product_id) || {};
      const memberRecord = membershipRecordByTicketId.get(ticket.id)
        || memberRecordByTicketId.get(ticket.id)
        || null;
      const participantUserIds = liveTicketParticipantIds(ticket, ticketParticipants || []);
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
        lessonKind: memberRecord?.lesson_type === "one_on_two" ? "2대1" : liveTicketLessonKind(product),
        lessonTypeCode: memberRecord?.lesson_type || (Number(product.group_size) === 2 ? "one_on_two" : "one_on_one"),
        lessonDays: Array.isArray(memberRecord?.lesson_days) ? memberRecord.lesson_days.map(Number) : [],
        actualLessonStart: memberRecord?.lesson_start_on || ticket.starts_on,
        groupSize: Number(product.group_size) || 1,
        durationMinutes: Number(product.lesson_minutes) || 20,
        productKind: product.product_kind || "regular",
        scheduleScope: memberRecord?.lesson_schedule_scope || liveTicketScheduleScope(product, ticket, serverLessons || []),
        status: ticket.status,
        memberRecord,
      };
    });

    const activeTickets = mappedTickets.filter((ticket) => ["active", "paused"].includes(ticket.status) && ticket.remaining > 0);
    const activeTicketIds = new Set(activeTickets.map((ticket) => ticket.serverTicketId));
    replaceArray(tickets, activeTickets);
    replaceArray(expiredTickets, mappedTickets
      .filter((ticket) => !activeTicketIds.has(ticket.serverTicketId))
      .map((ticket) => ({
        ...ticket,
        statusLabel: memberTicketStatusLabel(ticket),
      })));

    const relevantUserIds = new Set([
      ...mappedTickets.flatMap((ticket) => ticket.participantUserIds),
      ...(serverMemberDatabaseRecords || []).map((record) => record.user_id),
      ...(serverPayments || []).map((payment) => payment.user_id),
    ].filter(Boolean));
    const enrollmentByUserId = new Map();
    (serverEnrollments || [])
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))
      .forEach((enrollment) => {
        if (!enrollmentByUserId.has(enrollment.user_id)) enrollmentByUserId.set(enrollment.user_id, enrollment);
      });
    const memberUserGroups = (serverUsers || [])
      .filter((user) => !user.merged_into_user_id)
      .filter((user) => !user.permanently_deleted_at)
      .filter((user) => relevantUserIds.has(user.id) || ["member", "admin"].includes(user.role))
      .map((user) => ({
        name: user.name || "이름 확인 필요",
        userGroup: [user],
      }));
    const currentMembers = [...members];
    let nextMemberId = Math.max(1000, ...currentMembers.map((member) => Number(member.id) || 0)) + 1;
    const mappedMembers = memberUserGroups.map(({ name, userGroup }) => {
      const userIds = userGroup.map((user) => user.id);
      const memberTickets = mappedTickets.filter((ticket) => ticket.participantUserIds.some((id) => userIds.includes(id)));
      const activeTicket = memberTickets.find((ticket) => ["active", "paused"].includes(ticket.status) && ticket.remaining > 0) || null;
      const pendingTicket = memberTickets.find((ticket) => ticket.status === "pending_payment") || null;
      const memberPayments = (serverPayments || []).filter((payment) => userIds.includes(payment.user_id));
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
      const existing = currentMembers.find((member) => (
        member.serverUserId === preferredUser.id
        || (member.serverUserIds?.length === 1 && member.serverUserIds[0] === preferredUser.id)
      ));
      const currentMemberKind = String(preferredUser.member_kind || "journal_only");
      const authLinks = userIds.flatMap((userId) => authLinksByUserId.get(userId) || []);
      const authProviders = authProvidersFromLinks(authLinks);
      const authSwitch = (serverAuthSwitches || []).find((item) => userIds.includes(item.user_id) && item.status === "pending") || null;
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
    const slotCounts = new Map();
    let mappedLessons = (serverLessons || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const participantIds = participantIdsByLesson.get(lesson.id) || [];
        const memberNames = participantIds.map((id) => usersById.get(id)?.name).filter(Boolean);
        const ticket = mappedTicketById.get(lesson.member_ticket_id);
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
          serverParticipantUserIds: participantIds,
          branchId: lesson.branch_id,
          ticketId: lesson.member_ticket_id,
          day: scheduleDays[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          lessonDate: lesson.lesson_date,
          time: String(lesson.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(lesson.coach_role_id) || "",
          member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
          type: sourceLabel,
          durationMinutes: Number(lesson.duration_minutes) || 20,
          status: liveLessonStatus(lesson.status),
          makeup: lesson.lesson_source === "makeup",
          lessonSource: lesson.lesson_source || "regular",
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
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          lessonDate: booking.booking_date,
          time: String(booking.start_time || "").slice(0, 5),
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: coachIdByRole.get(booking.coach_role_id) || "",
          member: booking.guest_name || "원데이 방문자",
          guestPhone: booking.guest_phone || "",
          oneDayNote: booking.note || "",
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
      .filter((entitlement) => {
        const sourceLesson = serverLessonById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return false;
        if (!entitlement.originalDate || !entitlement.originalTime || entitlement.originalDate < todayIso) return false;
        const releasedInterval = {
          start: timeToMinutes(entitlement.originalTime),
          end: timeToMinutes(entitlement.originalTime) + entitlement.durationMinutes,
        };
        return !mappedLessons.some((lesson) => (
          lesson.lessonDate === entitlement.originalDate
          && lesson.coachId === entitlement.coachId
          && intervalsOverlap(releasedInterval, lessonInterval(lesson))
        ));
      })
      .map((entitlement) => {
        const slotKey = `${entitlement.originalDate}-${entitlement.originalTime}`;
        const slotCount = (slotCounts.get(slotKey) || 0) + 1;
        slotCounts.set(slotKey, slotCount);
        return {
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          serverStatus: "cancelled",
          branchId: entitlement.branchId,
          ticketId: entitlement.ticketId,
          day: scheduleDays[new Date(`${entitlement.originalDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${entitlement.originalDate}T00:00:00`).getDay() - 1],
          lessonDate: entitlement.originalDate,
          time: entitlement.originalTime,
          courtId: `court-${Math.min(slotCount, fixedCourtCount)}`,
          coachId: entitlement.coachId,
          member: "수업 신청 가능",
          type: "수업 신청 가능",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          makeup: true,
          lessonSource: "makeup",
        };
      });
    mappedLessons.push(...releasedRegularMakeupSlots);
    mappedLessons.sort((left, right) => left.lessonDate.localeCompare(right.lessonDate) || timeToMinutes(left.time) - timeToMinutes(right.time));
    replaceArray(state.makeupEntitlements, mappedMakeupEntitlements);

    const mappedEntitlementRequests = mappedMakeupEntitlements.map((item) => ({
      id: `entitlement-${item.id}`,
      entitlementId: item.id,
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
            ? "코치승인필요"
            : "승인대기";
      return {
        id: request.id,
        serverRequestId: request.id,
        lessonId: request.lesson_id,
        member: usersById.get(request.requester_user_id)?.name || "회원 확인 필요",
        original: `${lesson.lesson_date || "기존일"} ${String(lesson.start_time || "").slice(0, 5)} ${getCoachName(coachId)}`,
        requested: `${request.requested_lesson_date || "변경일"} ${String(request.requested_start_time || "").slice(0, 5)}`,
        policy: request.policy_window === "coach_approval_within_24h" ? "24시간 이내" : "24시간 전",
        reason: request.reason || "",
        status: request.status,
        statusLabel,
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
        member: memberNames.join("&") || ticket?.member || "회원 확인 필요",
        lesson: `${lesson.lesson_date || "수업일"} ${String(lesson.start_time || "").slice(0, 5)} ${getCoachName(coachIdByRole.get(record.coach_role_id) || "")}`,
        reflection: record.coach_comment || "코치 코멘트 없음",
        next: record.next_curriculum_ref_id ? "다음 커리큘럼 등록됨" : "다음 커리큘럼 미등록",
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
      loading: false,
      message: `서버 결제 ${mappedPayments.length}건 확인`,
      tone: "good",
    });

    const keepLoadedSchedule = shouldProtectLoadedSchedule(serverLessons, mappedLessons);
    if (keepLoadedSchedule) {
      mappedLessons = lessons.map((lesson) => ({ ...lesson }));
      billingLogs.unshift("시간표 보호: 비어 있거나 불완전한 서버 응답으로 기존 시간표를 덮어쓰지 않았습니다.");
    }

    Object.assign(adminLiveDataState, {
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
      payments: serverPayments || [],
      groupAccounts: serverGroupAccounts || [],
      groupMembers: serverGroupMembers || [],
      groupTicketLinks: serverGroupTicketLinks || [],
      memberDatabaseRecords: serverMemberDatabaseRecords || [],
      memberMembershipRecords: serverMemberMembershipRecords || [],
    });
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
    await loadLiveSchedulePolicyFromServer();
    await loadRefundPolicySettingsFromServer();
    await loadServerHoldingPolicy();
    await loadPolicyVersionsFromServer();
    await loadLessonPoliciesFromServer();
    await loadMemberManagementPolicyFromServer();
    await loadAdminSecuritySettingsFromServer();
    syncAdminScheduleWeek();
    if (!mappedMembers.some((member) => member.id === state.selectedMemberId)) {
      state.selectedMemberId = null;
    }
    renderAll();
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

async function refreshAdminImportAuthState() {
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
  renderDataTools();

  try {
    const result = await client.selectCurrentProfile();
    const profile = result.profile || null;
    const role = profile?.role || "";
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
    renderOperationsLoginGate();
    if (["admin", "coach"].includes(role)) {
      if (role === "coach" && !operationsViewAllowed(state.view)) state.view = "schedule";
      await syncAdminLiveData();
      setView(state.view, { skipLock: true });
    }
  } catch (error) {
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: "로그인 세션 확인에 실패했습니다. 다시 로그인해 주세요.",
    });
    renderOperationsLoginGate();
  }
  renderDataTools();
}

function startAdminImportLogin(provider) {
  const client = window.TennisNoteDataClient;
  if (!client?.signInWithOAuth || !client.readiness?.().ready) {
    blockServerPreview("Supabase 연결값을 먼저 설정해야 로그인할 수 있습니다.");
    return;
  }
  const remember = $("#operationsRememberLogin")?.checked === true;
  localStorage.setItem(operationsRememberStorageKey, remember ? "true" : "false");
  client.setSessionPersistence?.(remember);
  client.signInWithOAuth(provider, { redirectTo: window.location.href });
}

async function signOutAdminImport() {
  const client = window.TennisNoteDataClient;
  if (client?.signOut) await client.signOut();
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

function renderAdminPendingUsers() {
  const target = $("#adminPendingUsersPanel");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const canApprove = adminApprovalReady();
  const items = adminPendingUsersState.items.slice(0, 12);
  if (!adminPendingUsersState.loading && canApprove && !items.length) {
    target.innerHTML = `
      <section class="admin-pending-compact">
        <div><strong>가입 계정 관리</strong><span>${escapeHtml(adminPendingUsersState.message || "처리할 가입 계정이 없습니다.")}</span></div>
        <button class="ghost-button" type="button" data-admin-users-action="refresh">새로고침</button>
      </section>`;
    return;
  }
  target.innerHTML = `
    <section class="admin-pending-card">
      <div class="panel-heading compact-heading">
        <div>
          <h3>가입 계정 관리</h3>
        </div>
        <div class="data-action-row compact">
          <button class="ghost-button" type="button" data-admin-users-action="refresh" ${adminPendingUsersState.loading ? "disabled" : ""}>새로고침</button>
        </div>
      </div>
      <div class="data-status-card ${canApprove ? "good" : readiness?.ready ? "warn" : "neutral"}">
        <div>
          <strong>${adminPendingUsersState.loading ? "확인 중" : adminPendingUsersState.message}</strong>
          <span>보류된 가입 계정과 코치 권한을 여기서 처리합니다.</span>
        </div>
        ${badge(canApprove ? "ready" : "pending", canApprove ? "승인 가능" : "로그인 필요")}
      </div>
      <div class="admin-pending-list">
        ${
          items.length
            ? items
                .map((user) => {
                  const id = escapeHtml(String(user.id || ""));
                  const name = escapeHtml(String(user.name || "이름 없음"));
                  return `
                    <article class="admin-pending-row">
                      <div>
                        <strong>${name}</strong>
                        <span>${escapeHtml(String(user.role || "member"))} · ${escapeHtml(String(user.status || "pending"))}</span>
                        <small>${escapeHtml(String(user.created_at || "").slice(0, 10) || "가입일 확인 전")}</small>
                      </div>
                      <label>
                        <small>권한</small>
                        <select data-admin-pending-role="${id}" ${canApprove ? "" : "disabled"}>
                          <option value="member" ${user.role === "member" ? "selected" : ""}>회원</option>
                          <option value="coach" ${user.role === "coach" ? "selected" : ""}>코치</option>
                          <option value="admin" ${user.role === "admin" ? "selected" : ""}>관리자</option>
                        </select>
                      </label>
                      <label>
                        <small>코치 표시명</small>
                        <input data-admin-pending-display="${id}" value="${name}" ${canApprove ? "" : "disabled"} />
                      </label>
                      <div class="admin-pending-actions">
                        <button class="small-button" type="button" data-admin-approve-user="${id}" ${canApprove ? "" : "disabled"}>승인</button>
                        <button class="ghost-button" type="button" data-admin-hold-user="${id}" ${canApprove ? "" : "disabled"}>보류</button>
                      </div>
                    </article>`;
                })
                .join("")
            : `<p class="empty-text">${adminPendingUsersState.loading ? "불러오는 중입니다." : "정리할 이전·보류 계정이 없습니다."}</p>`
        }
      </div>
    </section>`;
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

function renderDataImportAuthStatus() {
  const target = $("#dataImportAuthStatus");
  if (!target) return;
  const tone = adminImportAuthTone();
  const hasSession = Boolean(window.TennisNoteDataClient?.getSession?.()?.access_token);
  target.innerHTML = `
    <div class="data-status-card ${tone}">
      <div>
        <strong>관리자 로그인 상태</strong>
        <span>${escapeHtml(adminImportAuthState.message)}</span>
      </div>
      ${badge(tone, adminImportAuthBadgeText())}
    </div>
    <div class="data-action-row">
      <button class="ghost-button" type="button" data-admin-login-provider="카카오">카카오 로그인</button>
      <button class="ghost-button" type="button" data-admin-login-provider="네이버">네이버 로그인</button>
      <button class="ghost-button" type="button" data-admin-auth-action="refresh">상태 새로고침</button>
      ${hasSession ? '<button class="ghost-button" type="button" data-admin-auth-action="logout">로그아웃</button>' : ""}
    </div>`;
}

function knownCoachNamesForImport() {
  return coaches.map((coach) => coach.name).filter(Boolean);
}

function serverPreviewStatus(summary = {}) {
  if (Number(summary.errorRows || 0) > 0) return "error";
  if (Number(summary.reviewRows || 0) > 0) return "review";
  return "ready";
}

function serverPreviewMessage(status, summary = {}) {
  if (status === "ready") return `서버 검증 통과. ${summary.readyRows || 0}행이 실제 반영 후보입니다.`;
  if (status === "review") return `서버 확인 필요. ${summary.reviewRows || 0}행을 확인한 뒤 진행하세요.`;
  return `서버 검증 오류. ${summary.errorRows || 0}행을 수정해야 합니다.`;
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
  if (!Array.isArray(dataImportState.rawRows) || !dataImportState.rawRows.length) {
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
      body: {
        mode: "preview",
        sourceName: dataImportState.fileName,
        rows: dataImportState.rawRows,
        knownCoaches: knownCoachNamesForImport(),
      },
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
  if (!Array.isArray(dataImportState.rawRows) || !dataImportState.rawRows.length) {
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
        mode: "commit",
        confirm: "IMPORT_APPROVED",
        sourceName: dataImportState.fileName,
        rows: dataImportState.rawRows,
        knownCoaches: knownCoachNamesForImport(),
      },
    });
    if (!response?.writesToDatabase || response?.code !== "import_committed") {
      throw Object.assign(new Error(response?.code || "import_commit_not_confirmed"), { payload: response });
    }
    setDataImportState({
      serverStatus: "committed",
      serverMessage: `DB 반영 완료. ${dataImportState.readyRows}개 행의 처리 결과를 확인하세요.`,
      serverPreview: { ...summary, importResult: response.result || {} },
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
        ["상품명", "구분", "수업형식", "횟수", "카드가격", "현금가격", "정산기준", "사용기간", "유예기간", "할인가능"],
        ...membershipProductDrafts.map((product) => [product.title, product.group, product.format, product.tickets, product.cardAmount, product.cashAmount, product.settlementBase, product.validityDays, product.graceDays, product.discountEnabled ? "가능" : "불가"]),
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

function downloadDataExport() {
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
    downloadWorkbook(`tennis-note-${dataset}-${stamp}.xlsx`, sheets);
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

function renderDataTools() {
  renderDataImportAuthStatus();
  renderAdminPendingUsers();

  const importTarget = $("#dataImportStatus");
  if (importTarget) {
    const tone = dataImportState.status === "ready" ? "good" : dataImportState.status === "review" ? "warn" : dataImportState.status === "error" ? "danger" : "neutral";
    const issues = dataImportState.issues.slice(0, 8);
    const serverPreview = dataImportState.serverPreview || {};
    const serverTone = dataImportServerTone();
    const serverIssues = Array.isArray(serverPreview.issues) ? serverPreview.issues.slice(0, 6) : [];
    const plannedOperations = Object.entries(serverPreview.plannedOperations || {})
      .filter(([, count]) => Number(count) > 0)
      .slice(0, 6);
    const serverCard = dataImportState.serverStatus !== "idle" ? `
      <div class="data-status-card ${serverTone}">
        <div>
          <strong>서버 검증 결과</strong>
          <span>${escapeHtml(dataImportState.serverMessage || "서버 검증 대기 중입니다.")}</span>
        </div>
        ${badge(serverTone || "neutral", dataImportState.serverStatus === "checking" ? "처리중" : dataImportState.serverStatus === "committed" ? "반영 완료" : dataImportState.serverStatus === "ready" ? "통과" : dataImportState.serverStatus === "review" ? "확인 필요" : "오류")}
      </div>
      ${plannedOperations.length ? `
        <div class="data-export-sheet-list">
          ${plannedOperations.map(([name, count]) => `<span>${escapeHtml(name)} ${count}</span>`).join("")}
        </div>` : ""}
      ${serverIssues.length ? `
        <div class="data-issue-list">
          ${serverIssues.map((issue) => `<p class="${issue.severity || "review"}">${escapeHtml(importServerIssueMessage(issue))}</p>`).join("")}
        </div>` : ""}
    ` : "";
    importTarget.innerHTML = `
      <div class="data-status-card ${tone}">
        <div>
          <strong>${dataImportState.fileName || "업로드 대기"}</strong>
          <span>${dataImportState.message}</span>
        </div>
        ${badge(tone, dataImportState.status === "idle" ? "대기" : dataImportState.status === "checking" ? "검증중" : dataImportState.status === "ready" ? "반영 가능" : dataImportState.status === "review" ? "확인 필요" : "오류")}
      </div>
      <div class="data-summary-grid">
        <article><span>전체 행</span><strong>${dataImportState.rowCount}</strong></article>
        <article><span>반영 가능</span><strong>${dataImportState.readyRows}</strong></article>
        <article><span>확인 필요</span><strong>${dataImportState.reviewRows}</strong></article>
        <article><span>오류</span><strong>${dataImportState.errorRows}</strong></article>
      </div>
      <div class="data-issue-list">
        ${issues.length ? issues.map((issue) => `<p class="${issue.level}"><b>${issue.rowNumber}행</b> ${escapeHtml(issue.message)}</p>`).join("") : "<p>검증 이슈가 없습니다.</p>"}
      </div>
      ${serverCard}`;
  }

  const commitButton = $("#dataImportCommitButton");
  if (commitButton) {
    commitButton.disabled = dataImportState.status !== "ready" || dataImportState.serverStatus === "checking";
    commitButton.textContent = dataImportState.serverStatus === "checking"
      ? "검증 중"
      : dataImportState.serverStatus === "ready"
        ? "다시 검증"
        : "파일 검증";
  }

  const applyButton = $("#dataImportApplyButton");
  if (applyButton) {
    applyButton.disabled = dataImportState.status !== "ready" || dataImportState.serverStatus !== "ready";
    applyButton.textContent = dataImportState.serverStatus === "checking"
      ? "처리 중"
      : dataImportState.serverStatus === "committed"
        ? "DB 반영 완료"
        : "검증 결과 DB 반영";
  }

  const exportPreview = $("#dataExportPreview");
  if (exportPreview) {
    const dataset = $("#dataExportDataset")?.value || "all";
    const sheets = selectedExportSheets();
    const totalRows = sheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0);
    exportPreview.innerHTML = `
      <div class="data-status-card good">
        <div>
          <strong>${dataset === "all" ? "전체 운영 데이터" : sheets[0].name}</strong>
          <span>${sheets.length}개 시트, ${totalRows}개 행을 내려받습니다.</span>
        </div>
        ${badge("ready", "준비")}
      </div>
      <div class="data-export-sheet-list">
        ${sheets.map((sheet) => `<span>${escapeHtml(sheet.name)} ${Math.max(0, sheet.rows.length - 1)}행</span>`).join("")}
      </div>`;
  }
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

function renderReports() {
  if (!$("#reportMetrics") || !$("#benchmarkCards") || !$("#notificationPlan") || !$("#coachPreview")) return;
  $("#reportMetrics").innerHTML = reportMetrics
    .map(
      (item) => `
        <article class="metric-card ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.detail}</small>
        </article>`,
    )
    .join("");

  $("#benchmarkCards").innerHTML = benchmarks
    .map(
      (item) => `
        <article class="benchmark-card">
          <strong>${item.name}</strong>
          <span>${item.role}</span>
          <p>${item.takeaway}</p>
        </article>`,
    )
    .join("");

  $("#notificationPlan").innerHTML = notificationPlan
    .map(
      (item) => `
        <li>
          <strong>${item.title}</strong>
          <span>${item.detail}</span>
        </li>`,
    )
    .join("");

  $("#coachPreview").innerHTML = coachPreview
    .map(
      (item) => `
        <article class="preview-item">
          <span>${item.time}</span>
          <strong>${item.title}</strong>
          <small>${item.detail}</small>
        </article>`,
    )
    .join("");

  $("#memberAppPreview").innerHTML = memberAppPreview
    .map(
      (item) => `
        <div class="mobile-row">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>`,
    )
    .join("");
}

function coachModeLabel(coach) {
  const mode = coach.coachMode || "pending";
  if (mode === "approved") return "사용 중";
  if (mode === "disabled") return "사용 중지";
  return "등록 확인";
}

function coachModeTone(coach) {
  const mode = coach.coachMode || "pending";
  if (mode === "approved") return "good";
  if (mode === "disabled") return "danger";
  return "warn";
}

function coachSignupLabel(coach) {
  return coach.accountLinked ? "회원가입 완료" : "회원가입 전";
}

function coachSignupTone(coach) {
  return coach.accountLinked ? "good" : "neutral";
}

function coachApprovalLabel(coach) {
  const status = coach.approvalStatus || coach.coachMode || "pending";
  if (status === "approved" || status === "active") return "코치 승인 완료";
  if (status === "disabled" || status === "inactive") return "코치 사용 중지";
  return "코치 승인 대기";
}

function coachApprovalTone(coach) {
  const status = coach.approvalStatus || coach.coachMode || "pending";
  if (status === "approved" || status === "active") return "good";
  if (status === "disabled" || status === "inactive") return "danger";
  return "warn";
}

function coachAccountDetail(coach) {
  if (!coach.accountLinked) return "가입 후 같은 휴대전화 번호로 자동 연결됩니다.";
  const providerLabels = {
    kakao: "카카오",
    "custom:kakao": "카카오",
    naver: "네이버",
    "custom:naver": "네이버",
    apple: "Apple",
    email: "이메일",
  };
  const providers = (coach.authProviders || []).map((provider) => providerLabels[provider] || "소셜");
  return providers.length ? `${providers.join(", ")} 로그인 연결` : "로그인 계정 연결 완료";
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

function coachEmploymentLabel(coach) {
  if (coach.employmentStatus === "archived") return "보관";
  if (coach.employmentStatus === "ended") return "근무 종료";
  return "근무 중";
}

function coachStaffDraftFrom(coach) {
  const source = coach || {};
  const settlement = coachSettlementRule(source);
  return {
    coachId: source.id || "",
    coachRoleId: source.serverRoleId || "",
    branchId: source.branchId || coaches.find((item) => item.branchId)?.branchId || "",
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

function coachBlockListMarkup(blocks, type) {
  const title = type === "break" ? "브레이크" : "근무";
  return blocks.length
    ? blocks.map((block) => `
      <div class="coach-staff-block-row">
        <div>
          <strong>${escapeHtml(block.days.join("·"))} ${escapeHtml(block.start)}~${escapeHtml(block.end)}</strong>
          <span>${escapeHtml(block.label || title)}</span>
        </div>
        <button class="icon-button" type="button" aria-label="${title} 삭제" title="${title} 삭제" data-remove-coach-staff-block="${escapeHtml(block.id)}" data-coach-staff-block-type="${type}">×</button>
      </div>`).join("")
    : `<p class="empty-text">등록된 ${title} 시간이 없습니다.</p>`;
}

function coachStaffDayInputs(type) {
  return scheduleDays.map((day) => `
    <label><input type="checkbox" value="${day}" data-coach-staff-${type}-day />${day}</label>`).join("");
}

function renderCoachStaffBasicTab(draft) {
  return `
    <div class="coach-staff-form-grid">
      <label class="form-field"><span>이름</span><input id="coachStaffName" value="${escapeHtml(draft.name)}" maxlength="40" required /></label>
      <label class="form-field"><span>휴대전화</span><input id="coachStaffPhone" value="${escapeHtml(draft.phone)}" inputmode="tel" placeholder="010-0000-0000" ${coachStaffEditorState.mode === "create" ? "required" : ""} /></label>
      <label class="form-field"><span>직책</span><input id="coachStaffJobTitle" value="${escapeHtml(draft.jobTitle)}" maxlength="40" /></label>
      <label class="form-field"><span>코치 승인</span>
        <select id="coachStaffApprovalStatus">
          <option value="pending" ${draft.approvalStatus === "pending" ? "selected" : ""}>승인 대기</option>
          <option value="approved" ${draft.approvalStatus === "approved" ? "selected" : ""}>승인</option>
          <option value="disabled" ${draft.approvalStatus === "disabled" ? "selected" : ""}>사용 중지</option>
        </select>
      </label>
      <label class="form-field"><span>근무 시작일</span><input id="coachStaffEmploymentStartedOn" type="date" value="${escapeHtml(draft.employmentStartedOn)}" /></label>
      <label class="form-field"><span>표시 색상</span><input id="coachStaffColor" type="color" value="${escapeHtml(draft.color)}" /></label>
      <label class="form-field coach-staff-wide"><span>소개</span><textarea id="coachStaffBio" rows="3" maxlength="500">${escapeHtml(draft.bio)}</textarea></label>
    </div>
    <div class="coach-staff-account-summary">
      <strong>${draft.accountLinked ? "계정 연결 완료" : "계정 연결 전"}</strong>
      <span>${escapeHtml(draft.accountDetail)}</span>
    </div>`;
}

function renderCoachStaffWorkTab(draft) {
  return `
    <section class="coach-staff-block-section">
      <h3>근무시간</h3>
      <div class="coach-staff-block-list">${coachBlockListMarkup(draft.workBlocks, "work")}</div>
      <div class="coach-staff-block-add">
        <div class="coach-day-grid compact">${coachStaffDayInputs("work")}</div>
        <label><span>시작</span><input id="coachStaffWorkStart" type="time" step="600" value="06:40" /></label>
        <label><span>종료</span><input id="coachStaffWorkEnd" type="time" step="600" value="07:00" /></label>
        <label><span>표시명</span><input id="coachStaffWorkLabel" value="근무" maxlength="30" /></label>
        <button class="small-button" type="button" data-add-coach-staff-block="work">근무 추가</button>
      </div>
    </section>
    <section class="coach-staff-block-section is-break">
      <h3>브레이크</h3>
      <div class="coach-staff-block-list">${coachBlockListMarkup(draft.breakBlocks, "break")}</div>
      <div class="coach-staff-block-add">
        <div class="coach-day-grid compact">${coachStaffDayInputs("break")}</div>
        <label><span>시작</span><input id="coachStaffBreakStart" type="time" step="600" value="13:00" /></label>
        <label><span>종료</span><input id="coachStaffBreakEnd" type="time" step="600" value="13:20" /></label>
        <label><span>표시명</span><input id="coachStaffBreakLabel" value="브레이크" maxlength="30" /></label>
        <button class="small-button" type="button" data-add-coach-staff-block="break">브레이크 추가</button>
      </div>
    </section>`;
}

function renderCoachStaffSettlementTab(draft) {
  const settlement = draft.settlement;
  const ratio = settlement.method === "ratio";
  return `
    <div class="coach-staff-form-grid">
      <label class="form-field"><span>정산 방식</span>
        <select id="coachStaffSettlementMethod">
          <option value="ratio" ${ratio ? "selected" : ""}>비율</option>
          <option value="hourly" ${!ratio ? "selected" : ""}>시급</option>
        </select>
      </label>
      <label class="form-field ${ratio ? "" : "is-hidden"}" data-settlement-mode-field="ratio"><span>코치 비율(%)</span><input id="coachStaffSettlementRatio" type="number" min="0" max="100" step="1" value="${settlement.ratio}" /></label>
      <label class="form-field ${ratio ? "is-hidden" : ""}" data-settlement-mode-field="hourly"><span>시급</span><input id="coachStaffSettlementHourly" type="number" min="0" step="1000" value="${settlement.hourly}" /></label>
      <label class="form-field"><span>정산 기준</span>
        <select id="coachStaffSettlementBasis">
          <option value="cash_ex_vat" ${settlement.basis === "cash_ex_vat" ? "selected" : ""}>현금가·부가세 제외</option>
          <option value="actual_paid_inc_vat" ${settlement.basis === "actual_paid_inc_vat" ? "selected" : ""}>실제 결제금액</option>
        </select>
      </label>
      <label class="form-field"><span>대타 기준</span>
        <select id="coachStaffSettlementSubstitute">
          <option value="actualCoach" ${settlement.substitute === "actualCoach" ? "selected" : ""}>실제 진행 코치</option>
          <option value="originalCoach" ${settlement.substitute === "originalCoach" ? "selected" : ""}>담당 코치</option>
          <option value="manual" ${settlement.substitute === "manual" ? "selected" : ""}>관리자 확인</option>
        </select>
      </label>
      <label class="form-field"><span>적용일</span><input id="coachStaffSettlementEffectiveFrom" type="date" value="${escapeHtml(settlement.effectiveFrom)}" required /></label>
    </div>
    <p class="coach-staff-inline-note">적용일 이전에 확정된 정산은 바뀌지 않습니다.</p>`;
}

function syncCoachStaffSettlementFieldVisibility(method) {
  $$('[data-settlement-mode-field="ratio"]').forEach((element) => {
    element.classList.toggle("is-hidden", method !== "ratio");
  });
  $$('[data-settlement-mode-field="hourly"]').forEach((element) => {
    element.classList.toggle("is-hidden", method !== "hourly");
  });
}

function renderCoachStaffModal() {
  const modal = $("#coachStaffModal");
  const content = $("#coachStaffModalContent");
  const draft = coachStaffEditorState.draft;
  if (!modal || !content || !draft) return;
  if (coachStaffEditorState.tab === "settlement" && operationsRole() !== "admin") coachStaffEditorState.tab = "basic";
  $$("[data-coach-staff-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.coachStaffTab === coachStaffEditorState.tab);
    button.hidden = button.dataset.coachStaffTab === "settlement" && operationsRole() !== "admin";
  });
  $("#coachStaffModalTitle").textContent = coachStaffEditorState.mode === "create" ? "코치·직원 추가" : draft.name;
  content.innerHTML = coachStaffEditorState.tab === "work"
    ? renderCoachStaffWorkTab(draft)
    : coachStaffEditorState.tab === "settlement"
      ? renderCoachStaffSettlementTab(draft)
      : renderCoachStaffBasicTab(draft);
  const actions = $("#coachStaffMoreActions");
  if (actions) {
    const existing = Boolean(draft.coachRoleId);
    actions.innerHTML = existing ? `
      <button type="button" data-coach-staff-state="${draft.approvalStatus === "approved" ? "disabled" : "approved"}">${draft.approvalStatus === "approved" ? "코치 승인 해제" : "코치 승인"}</button>
      <button type="button" data-coach-staff-state="${draft.employmentStatus === "active" ? "ended" : "restored"}">${draft.employmentStatus === "active" ? "근무 종료" : "근무 복원"}</button>
      ${draft.employmentStatus === "archived" ? "" : '<button type="button" data-coach-staff-state="archived">보관</button>'}
    ` : "";
    $("#coachStaffMoreMenu").hidden = !existing || operationsRole() !== "admin";
  }
  $("#coachStaffMessage").textContent = coachStaffEditorState.message || "";
  modal.hidden = false;
}

function openCoachStaffModal(coachId = "") {
  if (operationsRole() !== "admin") {
    showToast("관리자만 코치·직원 정보를 수정할 수 있습니다.");
    return;
  }
  const coach = coaches.find((item) => item.id === coachId) || null;
  coachStaffEditorState.coachId = coach?.id || "";
  coachStaffEditorState.mode = coach ? "edit" : "create";
  coachStaffEditorState.tab = "basic";
  coachStaffEditorState.draft = coachStaffDraftFrom(coach);
  coachStaffEditorState.message = "";
  renderCoachStaffModal();
}

function closeCoachStaffModal() {
  const modal = $("#coachStaffModal");
  if (modal) modal.hidden = true;
  coachStaffEditorState.draft = null;
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
  target.push({ id: `${type}-${Date.now()}`, days, start, end, label });
  coachStaffEditorState.message = "";
  renderCoachStaffModal();
}

function removeCoachStaffBlock(type, blockId) {
  const draft = coachStaffEditorState.draft;
  if (!draft) return;
  if (type === "break") draft.breakBlocks = draft.breakBlocks.filter((block) => block.id !== blockId);
  else draft.workBlocks = draft.workBlocks.filter((block) => block.id !== blockId);
  renderCoachStaffModal();
}

function coachStaffPayload(draft) {
  const availabilityBlocks = [
    ...draft.workBlocks.map((block) => ({
      days: block.days.map(postgresDayOfWeek).filter(Number.isInteger),
      startTime: block.start,
      endTime: block.end,
      label: block.label || "근무",
      availabilityType: "available",
    })),
    ...draft.breakBlocks.map((block) => ({
      days: block.days.map(postgresDayOfWeek).filter(Number.isInteger),
      startTime: block.start,
      endTime: block.end,
      label: block.label || "브레이크",
      availabilityType: "blocked",
    })),
  ];
  return {
    coachRoleId: draft.coachRoleId || null,
    branchId: draft.branchId || null,
    name: draft.name,
    phone: draft.phone,
    jobTitle: draft.jobTitle,
    bio: draft.bio,
    color: draft.color,
    approvalStatus: draft.approvalStatus,
    employmentStatus: draft.employmentStatus,
    employmentStartedOn: draft.employmentStartedOn || null,
    employmentEndedOn: draft.employmentEndedOn || null,
    availabilityBlocks,
    settlement: {
      method: draft.settlement.method,
      ratio: draft.settlement.method === "ratio" ? draft.settlement.ratio / 100 : null,
      hourly: draft.settlement.method === "hourly" ? draft.settlement.hourly : null,
      basis: draft.settlement.basis,
      substitute: draft.settlement.substitute,
      effectiveFrom: draft.settlement.effectiveFrom,
    },
  };
}

function coachBlockSignature(blocks = []) {
  return blocks
    .flatMap((block) => (block.days || []).map((day) => `${day}|${block.start}|${block.end}|${block.label || ""}`))
    .sort()
    .join(";");
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
    const result = await client.rpc("tn_admin_save_coach_staff", { target_record: coachStaffPayload(draft) });
    const coachRoleId = result?.coachRoleId || result?.coach_role_id || draft.coachRoleId;
    await syncAdminLiveData();
    const saved = coaches.find((coach) => coach.serverRoleId === coachRoleId)
      || coaches.find((coach) => coach.name === draft.name);
    if (!coachStaffServerMatches(saved, draft)) {
      throw new Error("coach_staff_server_verification_failed");
    }
    closeCoachStaffModal();
    renderCoaches();
    renderSchedule();
    showToast("코치·직원 정보가 서버에 저장되었습니다.");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    coachStaffEditorState.message = raw.includes("tn_admin_save_coach_staff") || raw.includes("PGRST202")
      ? "코치·직원 통합 DB 기능을 먼저 적용해주세요."
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
  const labels = { approved: "코치 승인", disabled: "승인 해제", ended: "근무 종료", archived: "보관", restored: "근무 복원" };
  if (!window.confirm(`${draft.name} 코치를 ${labels[targetState] || targetState} 처리할까요?`)) return;
  try {
    await client.rpc("tn_admin_set_coach_staff_state", {
      target_coach_role_id: draft.coachRoleId,
      target_state: targetState,
      target_effective_on: new Date().toISOString().slice(0, 10),
    });
    await syncAdminLiveData();
    const saved = coaches.find((coach) => coach.serverRoleId === draft.coachRoleId);
    const expectedApproval = ["approved", "restored"].includes(targetState) ? "approved" : "disabled";
    if (!saved || saved.approvalStatus !== expectedApproval) throw new Error("coach_staff_state_verification_failed");
    closeCoachStaffModal();
    renderCoaches();
    renderSchedule();
    showToast(`${labels[targetState] || "상태 변경"} 완료`);
  } catch (error) {
    coachStaffEditorState.message = `상태 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    renderCoachStaffModal();
  }
}

function renderCoaches() {
  const signedUpCount = coaches.filter((coach) => coach.accountLinked).length;
  const approvedCount = coaches.filter((coach) => ["approved", "active"].includes(coach.approvalStatus || coach.coachMode)).length;
  const target = $("#coachRows");
  if (!target) return;
  target.innerHTML = `
    <div class="coach-status-summary">
      <strong>코치 ${coaches.length}명</strong>
      <span>회원가입 ${signedUpCount}명</span>
      <span>승인 완료 ${approvedCount}명</span>
    </div>` + coaches
    .map(
      (coach) => {
        const breakCount = normalizeCoachBreakBlocks(coach).length;
        return `
        <article class="coach-row" data-coach-row="${coach.id}">
          <div class="coach-identity">
            ${avatarMarkup(coach, "large")}
            <div><strong>${escapeHtml(coach.name)}</strong><span>${escapeHtml(coach.role || "레슨")} · ${coachEmploymentLabel(coach)}</span></div>
          </div>
          <div class="coach-list-summary">
            <div class="coach-auth-badges">
              ${badge(coachSignupTone(coach), coachSignupLabel(coach))}
              ${badge(coachApprovalTone(coach), coachApprovalLabel(coach))}
              ${operationsRole() === "admin" && coach.loginCandidateUserId ? `<button class="small-button" type="button" data-reconcile-coach-login="${escapeHtml(coach.id)}">가입 계정 연결</button>` : ""}
              ${operationsRole() === "admin" && !coach.accountLinked && coach.loginCandidateCount > 1 ? badge("warn", "연결 후보 확인 필요") : ""}
            </div>
            <span>${escapeHtml(getCoachAvailabilitySummary(coach.id))}${breakCount ? ` · 브레이크 ${breakCount}개` : ""}</span>
            <span>${operationsRole() === "admin" ? coachSettlementSummary(coach) : "정산 정보 비공개"}</span>
          </div>
          <button class="icon-button coach-row-edit" type="button" aria-label="${escapeHtml(coach.name)} 편집" title="편집" data-edit-coach-staff="${coach.id}">···</button>
        </article>`;
      },
    )
    .join("");
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
    await syncAdminLiveData();
    const saved = coaches.find((item) => item.serverRoleId === coach.serverRoleId);
    if (!saved?.accountLinked) throw new Error("coach_login_reconciliation_verification_failed");
    renderCoaches();
    showToast(`${coach.name} 코치 계정 연결 완료`);
  } catch (error) {
    showToast(`코치 계정 연결 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

function renderCustomLessonColorRules() {
  const target = $("#customLessonColorRules");
  if (!target) return;
  target.innerHTML = (scheduleSettings.lessonColorRules || []).map((rule) => `
    <label class="custom-lesson-color-rule">
      <input type="text" value="${escapeHtml(rule.label || "추가 표시")}" data-custom-lesson-label="${rule.id}" aria-label="표시 이름" />
      <input type="text" value="${escapeHtml(rule.match || "")}" data-custom-lesson-match="${rule.id}" placeholder="수업 종류 문구" aria-label="적용 문구" />
      <input type="color" value="${rule.color || "#64748b"}" data-custom-lesson-color="${rule.id}" aria-label="표시 색상" />
      <button class="small-button danger" type="button" data-delete-lesson-color-rule="${rule.id}">삭제</button>
    </label>`).join("");
}

function renderScheduleSettings() {
  const openStartInput = $("#openStartInput");
  const openEndInput = $("#openEndInput");
  if (!openStartInput || !openEndInput) return;
  openStartInput.value = scheduleSettings.openStart;
  openEndInput.value = scheduleSettings.openEnd;
  ["regular", "regular30", "makeup", "coupon", "noShow"].forEach((kind) => {
    const input = $(`[data-lesson-color="${kind}"]`);
    if (input) input.value = scheduleSettings.lessonColors[kind];
  });
  renderSchedulePolicyPreview();
  renderPolicyVersionSettings();
  renderLessonPolicySettings();
  renderPolicyGuide();
  $("#breakRuleList").innerHTML = scheduleSettings.breakRules.length
    ? scheduleSettings.breakRules
      .map(
        (rule) => `
        <div class="break-rule-row">
          <strong>${rule.label || "브레이크"}</strong>
          <span>${rule.days.join(", ")} · ${rule.start}~${rule.end}</span>
          <button class="small-button" type="button" data-remove-break-rule="${rule.id}">삭제</button>
        </div>`,
      )
      .join("")
    : `<p class="empty-text">등록된 브레이크타임이 없습니다.</p>`;
}

function renderPolicyGuide() {
  const target = $("#policyGuideCards");
  if (!target) return;
  target.innerHTML = policyGuideTemplates.map((guide) => `
    <article class="policy-guide-card">
      <div>
        <strong>${escapeHtml(guide.title)}</strong>
        <span>${escapeHtml(guide.summary)}</span>
      </div>
      <p>${escapeHtml(guide.copy)}</p>
      <button class="ghost-button" type="button" data-copy-policy-guide="${guide.id}">안내문 복사</button>
    </article>`).join("");
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

function renderPolicyVersionSettings() {
  const target = $("#policyVersionCards");
  if (!target) return;
  const active = activePolicyVersion();
  target.innerHTML = `
    <div class="policy-version-toolbar">
      <div>
        <strong>운영 정책 ${policyVersions.length}개</strong>
        <span>현재 적용본과 이전 정책을 한 번에 관리합니다.</span>
      </div>
      <button class="primary-button" type="button" data-copy-policy-version="${escapeHtml(active?.id || "")}">새 정책</button>
    </div>
    <div class="policy-version-rows">
      ${policyVersions.map((policy) => {
        const normalized = normalizePolicyVersion(policy);
        const statusLabel = normalized.status === "active" ? "적용중" : normalized.status === "draft" ? "수정본" : "보관";
        const statusTone = normalized.status === "active" ? "ready" : normalized.status === "draft" ? "pending" : "neutral";
        return `
          <article class="policy-version-row ${normalized.status}">
            <div class="policy-version-row-main">
              <div>
                <strong>${escapeHtml(normalized.title)}</strong>
                ${badge(statusTone, statusLabel)}
              </div>
              <span>${escapeHtml(normalized.effectiveFrom)} · ${escapeHtml(normalized.source)} · ${normalized.sections.length}개 항목</span>
              <small>${escapeHtml(normalized.summary)}</small>
            </div>
            <div class="policy-version-row-actions">
              <button class="ghost-button" type="button" data-preview-policy-snapshot="${escapeHtml(normalized.id)}">확인</button>
              <button class="ghost-button" type="button" data-edit-policy-version="${escapeHtml(normalized.id)}">수정</button>
              <button class="small-button" type="button" data-activate-policy-version="${escapeHtml(normalized.id)}" ${normalized.status === "active" ? "disabled" : ""}>적용</button>
              <button class="ghost-button danger-button" type="button" data-delete-policy-version="${escapeHtml(normalized.id)}" ${policyVersions.length <= 1 ? "disabled" : ""}>삭제</button>
            </div>
          </article>`;
      }).join("")}
    </div>
    <p class="policy-version-footnote">정책을 수정해도 이미 구매한 회원권에 저장된 구매 당시 정책은 바뀌지 않습니다.</p>`;
}

function renderRefundPolicySettings() {
  const target = $("#refundPolicySettings");
  if (!target) return;
  const settings = normalizeRefundPolicySettings(refundPolicySettings);
  target.innerHTML = `
    <article class="refund-policy-summary">
      <div>
        <strong>기존 운영 환불 기준</strong>
        <span>할인 전 사용 회차 · 위약금 ${settings.penaltyRate}% · 첫 수업 월 예약금 차감</span>
      </div>
      ${badge("ready", `위약금 ${settings.penaltyRate}%`)}
    </article>
    <div class="refund-policy-grid">
      <label>
        <small>회원 사유 위약금</small>
        <input id="refundPenaltyRate" type="number" min="0" max="10" step="1" value="${settings.penaltyRate}" />
        <small>할인 전 원가의 비율(최대 10%)</small>
      </label>
      <label>
        <small>첫 수업 월 예약금</small>
        <input id="refundReservationFee" type="number" min="0" step="1000" value="${settings.reservationFee}" />
        <small>첫 수업이 속한 달에만 차감</small>
      </label>
      <label class="refund-policy-memo">
        <small>관리자 메모</small>
        <textarea id="refundPolicyMemo" rows="2">${escapeHtml(settings.memo)}</textarea>
      </label>
    </div>
    <div class="discount-action-row">
      <button class="small-button" type="button" id="saveRefundPolicyButton">환불정책 저장</button>
      <button class="ghost-button" type="button" id="resetRefundPolicyButton">기본값 복원</button>
    </div>
    <details class="policy-history-disclosure">
      <summary>분쟁 발생 시 관리자 검토 기준</summary>
      <p class="setting-help">일반 환불 화면에는 노출하지 않고, 분쟁이 생긴 경우에만 관련 법령과 소비자분쟁해결기준을 확인합니다.</p>
    </details>`;
}

function renderHoldingPolicySettings() {
  const target = $("#holdingPolicySettings");
  if (!target) return;
  target.innerHTML = `
    <div class="holding-policy-grid">
      <label><small>4주권 개인 홀딩</small><input id="holdingPersonalMaxDays" type="number" min="0" max="30" value="${Number(holdingPolicySettings.fourWeekPersonalMaxDays ?? holdingPolicySettings.personalMaxDays) || 7}" /></label>
      <label><small>3개월권 개인 홀딩</small><input id="holdingThreeMonthPersonalMaxDays" type="number" min="0" max="60" value="${Number(holdingPolicySettings.threeMonthPersonalMaxDays) || 14}" /></label>
      <label><small>부상·입원 최대일</small><input id="holdingInjuryMaxDays" type="number" min="1" max="180" value="${Number(holdingPolicySettings.injuryMaxDays) || 30}" /></label>
      <label><small>응급 소급 신청</small><input id="holdingEmergencyRetroactiveDays" type="number" min="0" max="7" value="${Number(holdingPolicySettings.emergencyRetroactiveDays) || 3}" /></label>
      <label><small>증빙 원본 보관일</small><input id="holdingEvidenceRetentionDays" type="number" min="1" max="90" value="${Number(holdingPolicySettings.evidenceRetentionDays) || 30}" /></label>
      <label class="holding-policy-toggle"><input id="holdingEvidenceRequired" type="checkbox" ${holdingPolicySettings.evidenceRequired !== false ? "checked" : ""} /><span>부상 홀딩 증빙 필수</span></label>
    </div>
    <div class="holding-policy-note">
      <strong>현재 기준</strong>
      <span>4주권 ${Number(holdingPolicySettings.fourWeekPersonalMaxDays ?? holdingPolicySettings.personalMaxDays) || 7}일 · 3개월권 ${Number(holdingPolicySettings.threeMonthPersonalMaxDays) || 14}일 · 쿠폰 개인 홀딩 없음 · 부상 ${Number(holdingPolicySettings.injuryMaxDays) || 30}일</span>
    </div>
    <button class="small-button" type="button" id="saveHoldingPolicy">홀딩 정책 저장</button>`;
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

function renderNoticePopupSettings() {
  const target = $("#noticePopupSettings");
  if (!target) return;
  const notices = popupNotices();
  const notice = editingPopupNotice();
  if (!state.noticeEditingId) state.noticeEditingId = notice.id;
  target.dataset.noticeId = notice.id || "notice-new";
  const audienceLabel = { all: "회원+코치", member: "회원만", coach: "코치만" }[notice.audience] || "회원+코치";
  const statusLabel = notice.status === "active" ? "노출중" : notice.status === "archived" ? "지난 공지" : "꺼짐";
  const previewUrl = noticeImageRemoveRequested ? "" : (noticeImageDraftUrl || notice.imageUrl || "");
  target.innerHTML = `
    <section class="notice-list-section" aria-label="등록 공지 목록">
      <div class="notice-list-heading">
        <div>
          <strong>등록 공지 ${notices.length}건</strong>
          <span>위에서부터 회원·코치 앱에 순서대로 표시됩니다.</span>
        </div>
        <button class="small-button" type="button" id="newNoticePopupButton">새 공지</button>
      </div>
      <div class="notice-list">
        ${notices.length ? notices.map((item, index) => {
          const itemAudience = { all: "회원+코치", member: "회원", coach: "코치" }[item.audience] || "회원+코치";
          const itemStatus = item.status === "active" ? "노출중" : item.status === "archived" ? "지난 공지" : "꺼짐";
          return `
            <div class="notice-list-row ${item.id === notice.id ? "selected" : ""}">
              <span class="notice-order-number">${index + 1}</span>
              <button class="notice-list-main" type="button" data-edit-notice="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(itemAudience)} · ${escapeHtml(itemStatus)}${item.imageUrl ? " · 이미지" : ""}</span>
              </button>
              <div class="notice-list-actions">
                <button class="icon-button" type="button" data-move-notice="${escapeHtml(item.id)}" data-direction="up" title="위로 이동" aria-label="${escapeHtml(item.title)} 위로 이동" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="icon-button" type="button" data-move-notice="${escapeHtml(item.id)}" data-direction="down" title="아래로 이동" aria-label="${escapeHtml(item.title)} 아래로 이동" ${index === notices.length - 1 ? "disabled" : ""}>↓</button>
                <button class="ghost-button" type="button" data-edit-notice="${escapeHtml(item.id)}">수정</button>
                <button class="danger-text-button" type="button" data-delete-notice="${escapeHtml(item.id)}">삭제</button>
              </div>
            </div>`;
        }).join("") : '<p class="empty-text">등록된 공지가 없습니다. 새 공지를 만들어주세요.</p>'}
      </div>
    </section>
    <article class="notice-control-summary ${notice.status === "active" ? "active" : "disabled"}">
      <div>
        <p class="eyebrow">${isUuid(notice.id) ? "공지 수정" : "새 공지"}</p>
        <strong>${escapeHtml(notice.title)}</strong>
        <span>${escapeHtml(notice.body)}</span>
      </div>
      ${badge(notice.status === "active" ? "ready" : "neutral", statusLabel)}
    </article>
    <div class="notice-control-grid">
      <label>
        <small>공지 제목</small>
        <input id="noticeTitleInput" type="text" maxlength="80" value="${escapeHtml(notice.title)}" />
      </label>
      <label>
        <small>노출 대상</small>
        <select id="noticeAudienceInput">
          <option value="all" ${notice.audience === "all" ? "selected" : ""}>회원+코치</option>
          <option value="member" ${notice.audience === "member" ? "selected" : ""}>회원만</option>
          <option value="coach" ${notice.audience === "coach" ? "selected" : ""}>코치만</option>
        </select>
      </label>
      <label>
        <small>상태</small>
        <select id="noticeStatusInput">
          <option value="active" ${notice.status === "active" ? "selected" : ""}>노출</option>
          <option value="disabled" ${notice.status === "disabled" ? "selected" : ""}>끄기</option>
          <option value="archived" ${notice.status === "archived" ? "selected" : ""}>지난 공지</option>
        </select>
      </label>
      <label>
        <small>중요도</small>
        <select id="noticePriorityInput">
          <option value="normal" ${notice.priority === "normal" ? "selected" : ""}>일반</option>
          <option value="important" ${notice.priority === "important" ? "selected" : ""}>중요</option>
          <option value="urgent" ${notice.priority === "urgent" ? "selected" : ""}>긴급</option>
        </select>
      </label>
      <label>
        <small>시작일</small>
        <input id="noticeStartDateInput" type="date" value="${escapeHtml(notice.startDate)}" />
      </label>
      <label>
        <small>종료일</small>
        <input id="noticeEndDateInput" type="date" value="${escapeHtml(notice.endDate)}" />
      </label>
      <label class="notice-body-field">
        <small>공지 내용</small>
        <textarea id="noticeBodyInput" rows="4" maxlength="1000">${escapeHtml(notice.body)}</textarea>
      </label>
      <div class="notice-image-field">
        <div class="notice-field-heading">
          <div>
            <small>대표 이미지</small>
            <span>JPG, PNG, WebP · 최대 5MB</span>
          </div>
          ${previewUrl ? '<button class="danger-text-button" type="button" id="removeNoticeImageButton">이미지 삭제</button>' : ""}
        </div>
        ${previewUrl
          ? `<img class="notice-image-preview" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(notice.imageAlt || notice.title || "공지 이미지")}" />`
          : '<div class="notice-image-empty">첨부된 이미지 없음</div>'}
        <input id="noticeImageInput" type="file" accept="image/jpeg,image/png,image/webp" />
        <label>
          <small>이미지 설명</small>
          <input id="noticeImageAltInput" type="text" maxlength="120" value="${escapeHtml(notice.imageAlt)}" placeholder="이미지 내용을 짧게 설명" />
        </label>
      </div>
      <div class="notice-action-fields">
        <label>
          <small>버튼 이름</small>
          <input id="noticeActionLabelInput" type="text" maxlength="30" value="${escapeHtml(notice.actionLabel)}" placeholder="예: 자세히 보기" />
        </label>
        <label>
          <small>버튼 연결 주소</small>
          <input id="noticeActionUrlInput" type="url" maxlength="500" value="${escapeHtml(notice.actionUrl)}" placeholder="https://..." />
        </label>
      </div>
      <label class="toggle-row notice-once-row">
        <input id="noticeOncePerDayInput" type="checkbox" ${notice.showOncePerDay ? "checked" : ""} />
        <span>확인한 사용자는 오늘 하루 다시 보이지 않게 하기</span>
      </label>
    </div>
    <div class="notice-control-footer">
      <span>현재 대상: ${audienceLabel} · ${isUuid(notice.id) && notice.updatedAt ? `마지막 수정 ${new Date(notice.updatedAt).toLocaleString("ko-KR")}` : "아직 저장되지 않음"}</span>
      <div class="data-action-row">
        <button class="small-button" type="button" id="saveNoticePopupButton">저장하고 반영</button>
        <button class="ghost-button" type="button" id="disableNoticePopupButton">공지 끄기</button>
        <button class="ghost-button" type="button" id="resetNoticeDismissalsButton">테스트 다시 보이기</button>
      </div>
    </div>`;
}

function notificationDateTimeLabel(value = "") {
  if (!value) return "기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "기록 없음";
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderNotificationPolicySettings() {
  const target = $("#notificationPolicySettings");
  if (!target) return;
  const policy = normalizeNotificationPolicy(notificationPolicySettings);
  const stateTone = notificationDeliveryState.failed
    ? "danger"
    : ["ready", "limited"].includes(notificationDeliveryState.status)
      ? "ready"
      : "pending";
  const stateLabel = notificationDeliveryState.failed
    ? "오류 확인"
    : notificationDeliveryState.status === "ready"
      ? "서버 연결"
      : notificationDeliveryState.status === "limited"
        ? "기본 확인"
        : "확인 필요";
  const recentRows = (notificationDeliveryState.recent || []).slice(0, 8);

  target.innerHTML = `
    <div class="notification-rule-list">
      <div class="notification-rule-row">
        <input id="notifyLessonDayBefore" type="checkbox" role="switch" aria-label="수업 하루 전 알림" ${policy.lessonDayBeforeEnabled ? "checked" : ""} />
        <span><strong>수업 하루 전</strong><small>수업 시작 24시간 전</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyLesson30Minutes" type="checkbox" role="switch" aria-label="수업 30분 전 알림" ${policy.lesson30MinutesEnabled ? "checked" : ""} />
        <span><strong>수업 30분 전</strong><small>잠금화면 푸시</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyCouponNextBooking" type="checkbox" role="switch" aria-label="쿠폰 다음 일정 알림" ${policy.couponNextBookingEnabled ? "checked" : ""} />
        <span><strong>쿠폰 다음 일정</strong><small>예정 수업이 없으면 주 1회 안내</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketLowRemaining" type="checkbox" role="switch" aria-label="잔여횟수 알림" ${policy.ticketLowRemainingEnabled ? "checked" : ""} />
        <span><strong>잔여횟수</strong><small>재등록 안내</small></span>
        <span class="notification-inline-control"><input id="notifyLowRemainingThreshold" type="number" min="1" max="5" aria-label="잔여횟수 알림 기준" value="${policy.lowRemainingThreshold}" /><b>회</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketExpiry" type="checkbox" role="switch" aria-label="회원권 만료 임박 알림" ${policy.ticketExpiryEnabled ? "checked" : ""} />
        <span><strong>만료 임박</strong><small>오전 9시 발송</small></span>
        <span class="notification-inline-control"><input id="notifyExpiryDaysBefore" type="number" min="1" max="30" aria-label="만료 임박 알림 기준일" value="${policy.expiryDaysBefore}" /><b>일 전</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketExpired" type="checkbox" role="switch" aria-label="회원권 만료일 알림" ${policy.ticketExpiredEnabled ? "checked" : ""} />
        <span><strong>만료일</strong><small>사용기간 종료 안내</small></span>
      </div>
    </div>
    <div class="notification-delivery-metrics">
      <div><span>발송 대기</span><strong>${notificationDeliveryState.queued}</strong></div>
      <div><span>오늘 발송</span><strong>${notificationDeliveryState.sentToday}</strong></div>
      <div class="${notificationDeliveryState.failed ? "has-error" : ""}"><span>최근 오류</span><strong>${notificationDeliveryState.failed}</strong></div>
      <div><span>연결 기기</span><strong>${notificationDeliveryState.activeDevices ?? "-"}</strong></div>
    </div>
    <div class="notification-control-footer">
      <span>${escapeHtml(notificationDeliveryState.message)} · ${notificationDateTimeLabel(notificationDeliveryState.checkedAt)}</span>
      ${badge(stateTone, stateLabel)}
    </div>
    <div class="data-action-row notification-action-row">
      <button class="small-button" type="button" id="saveNotificationPolicyButton">알림 설정 저장</button>
      <button class="ghost-button" type="button" id="refreshNotificationStatusButton">발송 현황 새로고침</button>
    </div>
    <details class="notification-history">
      <summary>최근 알림 ${recentRows.length}건</summary>
      <div class="notification-history-list">
        ${recentRows.length
          ? recentRows.map((row) => `
            <div>
              <span>${escapeHtml(notificationTemplateLabel(row.template_key || row.templateKey))}</span>
              <strong>${escapeHtml(row.title || "앱 알림")}</strong>
              <small>${escapeHtml(row.status || "queued")} · ${notificationDateTimeLabel(row.sent_at || row.sentAt || row.scheduled_at || row.scheduledAt)}</small>
            </div>`).join("")
          : '<p class="empty-text">아직 발송 기록이 없습니다.</p>'}
      </div>
    </details>`;
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

function safeNoticeFileName(fileName = "notice-image") {
  const extension = String(fileName).split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
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

function renderPaymentSetup() {
  const target = $("#paymentSetupPanel");
  if (!target) return;
  const config = paymentGatewayConfig();
  const ready = isPaymentGatewayReady();
  target.innerHTML = `
    <article class="payment-setup-card ${ready ? "ready" : "setup"}">
      <div class="payment-setup-summary">
        <div>
          <strong>${ready ? "결제창 연결값 준비됨" : "결제창 연결값 대기"}</strong>
          <span>${ready ? "회원앱 결제 버튼이 PortOne 결제창을 열 수 있습니다. 서버 검증과 웹훅은 다음 단계입니다." : "Store ID와 Channel Key를 입력하면 같은 브라우저의 회원앱 결제 버튼이 연결됩니다."}</span>
        </div>
        ${badge(ready ? "ready" : "pending", ready ? "결제창 준비" : "설정 대기")}
      </div>
      <div class="product-setting-fields payment-setting-fields">
        <label>
          <small>PortOne Store ID</small>
          <input id="paymentStoreId" type="text" autocomplete="off" placeholder="store-..." value="${escapeHtml(config.storeId || "")}" />
        </label>
        <label>
          <small>Channel Key</small>
          <input id="paymentChannelKey" type="text" autocomplete="off" placeholder="channel-key" value="${escapeHtml(config.channelKey || "")}" />
        </label>
      </div>
      <div class="payment-server-checklist">
        <div>
          <b>관리자 화면에 입력</b>
          <span>Store ID, Channel Key</span>
        </div>
        <div>
          <b>서버 환경값으로만 보관</b>
          <span>API Secret, Webhook Secret</span>
        </div>
        <div>
          <b>다음 검증</b>
          <span>결제창 열기 → 서버 검증 → 웹훅으로 회원권 충전</span>
        </div>
      </div>
      <div class="payment-setup-actions">
        <button class="small-button" type="button" id="savePaymentConfigButton">저장</button>
        <button class="ghost-button" type="button" id="clearPaymentConfigButton">삭제</button>
      </div>
      <small>이 값은 이 브라우저의 로컬 저장소에만 저장됩니다. Git 커밋에는 포함되지 않습니다.</small>
    </article>`;
}

function renderSettingsTabs() {
  const active = ["operation", "membership", "notifications", "coach", "security"].includes(state.settingsTab) ? state.settingsTab : "operation";
  state.settingsTab = active;
  $("#settingsView .settings-grid")?.setAttribute("data-active-tab", active);
  $$("[data-settings-tab]").forEach((button) => {
    const selected = button.dataset.settingsTab === active;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  $$("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== active;
  });
}

function renderAdminSecurity() {
  $$(".nav-item").forEach((button) => {
    const view = button.dataset.view || "";
    const locked = isAdminViewLocked(view);
    button.classList.toggle("is-locked", locked);
    button.classList.toggle("is-unlocked", locked && isAdminUnlocked());
    if (locked) button.title = isAdminUnlocked() ? `잠금 해제됨 · ${adminUnlockRemainingText()}` : "관리자 PIN 필요";
    else button.removeAttribute("title");
  });

  const target = $("#adminSecurityPanel");
  if (!target) return;
  const draft = currentAdminSecurityDraft();
  const lockedLabels = draft.lockedViews.map(adminLockViewName);
  const pinSetupRequired = adminPinNeedsSetup();
  target.innerHTML = `
    <div class="admin-security-summary ${draft.enabled ? "is-on" : "is-off"}">
      <div>
        <h2>관리자 보안</h2>
        <span>${adminSecurityIsDirty() ? "저장 전 변경사항 있음" : draft.enabled ? `잠금 사용 중 · ${lockedLabels.length ? lockedLabels.join(", ") : "잠금 대상 없음"}` : "잠금 사용 안 함"}</span>
      </div>
      ${badge(adminSecuritySaveState.status === "blocked" ? "danger" : draft.enabled ? "warn" : "neutral", adminSecuritySaveState.status === "saving" ? "저장 중" : adminSecuritySaveState.status === "blocked" ? "저장 실패" : adminSecurityIsDirty() ? "저장 필요" : draft.enabled ? adminUnlockRemainingText() : "꺼짐")}
    </div>
    <section class="admin-security-grid">
      <article class="admin-security-card">
        <strong>잠금 사용</strong>
        <label class="toggle-row">
          <input id="adminLockEnabled" type="checkbox" ${draft.enabled ? "checked" : ""} />
          <span>공용 PC에서 중요한 메뉴는 관리자 PIN 입력 후 접근</span>
        </label>
        <label class="field-row">
          <span>잠금 해제 유지시간</span>
          <select id="adminLockTimeout">
            ${[3, 5, 10, 15, 30, 60].map((minute) => `<option value="${minute}" ${draft.timeoutMinutes === minute ? "selected" : ""}>${minute}분</option>`).join("")}
          </select>
        </label>
        <div class="data-action-row">
          <button class="ghost-button" type="button" id="adminLockNowButton">지금 다시 잠그기</button>
        </div>
      </article>
      <article class="admin-security-card">
        <strong>잠금 대상 메뉴</strong>
        <div class="admin-lock-target-list">
          ${adminLockViewOptions
            .map(
              (item) => `
                <label class="admin-lock-target">
                  <input type="checkbox" value="${item.id}" data-admin-lock-view ${draft.lockedViews.includes(item.id) ? "checked" : ""} />
                  <span>
                    <b>${item.label}</b>
                  </span>
                </label>`,
            )
            .join("")}
        </div>
      </article>
      <article class="admin-security-card admin-pin-card">
        <strong>PIN 변경</strong>
        <p>숫자 6~8자리 PIN을 설정합니다.</p>
        <div class="admin-pin-grid">
          <label>
            <small>현재 PIN</small>
            <input id="adminCurrentPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" />
          </label>
          <label>
            <small>새 PIN</small>
            <input id="adminNewPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" />
          </label>
          <label>
            <small>새 PIN 확인</small>
            <input id="adminConfirmPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" />
          </label>
        </div>
        <div class="data-action-row">
          <button class="primary-button" type="button" id="changeAdminPinButton">PIN 변경</button>
        </div>
      </article>
      <footer class="admin-security-actions">
        <span>${adminSecuritySaveState.status === "saved" && adminSecuritySaveState.savedAt ? `서버 저장 완료 · ${new Date(adminSecuritySaveState.savedAt).toLocaleString("ko-KR")}` : "잠금 대상과 유지시간은 저장해야 적용됩니다."}</span>
        <div>
          <button class="ghost-button" type="button" id="resetAdminSecurityButton" ${adminSecurityIsDirty() && adminSecuritySaveState.status !== "saving" ? "" : "disabled"}>변경 취소</button>
          <button class="primary-button" type="button" id="saveAdminSecurityButton" ${adminSecurityIsDirty() && adminSecuritySaveState.status !== "saving" ? "" : "disabled"}>보안 설정 저장</button>
        </div>
      </footer>
    </section>`;
  if (pinSetupRequired) {
    target.querySelector("#adminCurrentPin")?.closest("label")?.setAttribute("hidden", "");
    const summary = target.querySelector(".admin-security-summary span");
    const summaryBadge = target.querySelector(".admin-security-summary .badge");
    const title = target.querySelector(".admin-pin-card strong");
    const description = target.querySelector(".admin-pin-card p");
    const button = target.querySelector("#changeAdminPinButton");
    if (summary) summary.textContent = "새 관리자 PIN 설정 필요";
    if (summaryBadge) {
      summaryBadge.className = "badge danger";
      summaryBadge.textContent = "PIN 설정 필요";
    }
    if (title) title.textContent = "PIN 최초 설정";
    if (description) description.textContent = "숫자 6~8자리 PIN을 설정하세요.";
    if (button) button.textContent = "PIN 설정 완료";
  }
}

function renderServiceReadiness() {
  const dataClientReadiness = window.TennisNoteDataClient?.readiness?.();
  const paymentReady = isPaymentGatewayReady();
  const readinessCards = $("#serviceReadinessCards");
  if (readinessCards) {
    readinessCards.innerHTML = serviceReadinessItems
      .map(
        (item) => {
          const isSupabaseItem = item.title === "Supabase DB";
          const isPaymentItem = item.title === "결제";
          const status = isSupabaseItem && dataClientReadiness?.ready ? "ready" : isPaymentItem && paymentReady ? "setup" : item.status;
          const label = isSupabaseItem && dataClientReadiness?.ready ? "연결값 준비" : isPaymentItem && paymentReady ? "결제창 준비" : item.label;
          const detail = isSupabaseItem && dataClientReadiness
            ? `${item.detail} 현재 앱 모드: ${dataClientReadiness.mode === "supabase" ? "Supabase 연결 가능" : "로컬 데모"}.`
            : isPaymentItem && paymentReady
              ? "Store ID와 Channel Key는 로컬에 저장되어 회원앱 결제창 연결을 테스트할 수 있습니다. 회원권 자동 충전은 서버 검증과 웹훅 연결 후 처리합니다."
            : item.detail;
          const next = isPaymentItem && paymentReady ? "PortOne 서버 검증/웹훅" : item.next;
          return `
        <article class="readiness-card">
          <div>
            <strong>${item.title}</strong>
            ${badge(status, label)}
          </div>
          <p>${detail}</p>
          <small>다음: ${next}</small>
        </article>`;
        },
      )
      .join("");
  }

  renderPaymentSetup();

  const productCards = $("#productSettingCards");
  if (productCards) {
    productCards.innerHTML = membershipProductDrafts
      .map(
        (product) => {
          const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
          return `
        <details class="product-setting-card product-setting-form" data-product-card="${normalized.id}">
          <summary class="product-setting-header">
            <div>
              <strong>${escapeHtml(normalized.title)}</strong>
              <small>${escapeHtml(normalized.group)} · ${normalized.tickets}회 · ${normalized.validityDays}일</small>
            </div>
            <div class="product-setting-summary-meta">
              <b>${money.format(normalized.cardAmount)}원</b>
              <span>${membershipProductStatusOptions.find((option) => option.id === normalized.status)?.label || "판매중"}</span>
            </div>
          </summary>
          <div class="product-setting-fields">
            <label>
              <small>상품명</small>
              <input type="text" data-product-field="title" value="${escapeHtml(normalized.title)}" />
            </label>
            <label>
              <small>횟수 표기</small>
              <input type="text" data-product-field="sessions" value="${escapeHtml(normalized.sessions)}" />
            </label>
            <label>
              <small>카드가격</small>
              <input type="number" min="0" step="1000" data-product-field="cardAmount" value="${normalized.cardAmount}" />
            </label>
            <label>
              <small>현금가격</small>
              <input type="number" min="0" step="1000" data-product-field="cashAmount" value="${normalized.cashAmount}" />
            </label>
            <label>
              <small>정산가격</small>
              <input type="number" min="0" step="1000" data-product-field="settlementBase" value="${normalized.settlementBase}" />
            </label>
            <label>
              <small>사용기간(일)</small>
              <input type="number" min="1" step="1" data-product-field="validityDays" value="${normalized.validityDays}" />
            </label>
            <label>
              <small>유예기간(일)</small>
              <input type="number" min="0" step="1" data-product-field="graceDays" value="${normalized.graceDays}" />
            </label>
            <label>
              <small>충전 횟수</small>
              <input type="number" min="0" step="1" data-product-field="tickets" value="${normalized.tickets}" />
            </label>
            <label>
              <small>레슨 방식</small>
              <select data-product-field="scheduleScope">
                <option value="weekday" ${normalized.scheduleScope === "weekday" ? "selected" : ""}>평일</option>
                <option value="weekend" ${normalized.scheduleScope === "weekend" ? "selected" : ""}>주말</option>
                <option value="mixed" ${normalized.scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
              </select>
            </label>
            <label>
              <small>수업 시간</small>
              <select data-product-field="lessonMinutes">
                ${[20, 30, 40].map((minute) => `<option value="${minute}" ${Number(normalized.lessonMinutes) === minute ? "selected" : ""}>${minute}분</option>`).join("")}
              </select>
            </label>
            <label>
              <small>종류</small>
              <select data-product-field="groupSize">
                <option value="1" ${Number(normalized.groupSize) === 1 ? "selected" : ""}>개인 1:1</option>
                <option value="2" ${Number(normalized.groupSize) === 2 ? "selected" : ""}>그룹 2:1</option>
              </select>
            </label>
            <label>
              <small>주 횟수</small>
              <input type="number" min="0" max="7" step="1" data-product-field="frequencyPerWeek" value="${normalized.frequencyPerWeek}" />
            </label>
            <label>
              <small>권종</small>
              <select data-product-field="productKind">
                <option value="regular" ${normalized.productKind === "regular" ? "selected" : ""}>정규권</option>
                <option value="coupon" ${normalized.productKind === "coupon" ? "selected" : ""}>쿠폰제</option>
              </select>
            </label>
            <label>
              <small>할인 가능</small>
              <select data-product-field="discountEnabled">
                <option value="yes" ${normalized.discountEnabled ? "selected" : ""}>가능</option>
                <option value="no" ${!normalized.discountEnabled ? "selected" : ""}>불가</option>
              </select>
            </label>
            <label>
              <small>코치 할인권</small>
              <select data-product-field="coachDiscountAllowed">
                <option value="yes" ${normalized.coachDiscountAllowed ? "selected" : ""}>사용 가능</option>
                <option value="no" ${!normalized.coachDiscountAllowed ? "selected" : ""}>관리자만</option>
              </select>
            </label>
            <label>
              <small>판매 상태</small>
              <select data-product-field="status">
                ${membershipProductStatusOptions.map((option) => `<option value="${option.id}" ${option.id === normalized.status ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </label>
          </div>
          <p>${escapeHtml(normalized.rule)}</p>
          <small>회원앱 표시: 카드 ${money.format(normalized.cardAmount)}원 · 현금 ${money.format(normalized.cashAmount)}원 · ${normalized.tickets}회 · ${normalized.validityDays}일 + 유예 ${normalized.graceDays}일</small>
          <div class="product-setting-actions">
            <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="up" aria-label="위로 이동" title="위로 이동">↑</button>
            <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="down" aria-label="아래로 이동" title="아래로 이동">↓</button>
            <button class="small-button" type="button" data-save-product-setting="${normalized.id}">저장</button>
            <button class="ghost-button danger-button" type="button" data-force-delete-product-setting="${normalized.id}">강제 삭제</button>
          </div>
        </details>`;
        },
      )
      .join("");
  }

  const discountCards = $("#discountPolicyCards");
  if (discountCards) {
    state.discountView = state.discountView === "history" ? "history" : "policies";
    state.discountStatusFilter = ["all", "사용", "검토", "중지"].includes(state.discountStatusFilter) ? state.discountStatusFilter : "all";
    $$('[data-discount-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.discountView === state.discountView));
    if ($("#discountPolicySearch") && $("#discountPolicySearch").value !== state.discountSearch) $("#discountPolicySearch").value = state.discountSearch || "";
    if ($("#discountPolicyStatusFilter")) {
      $("#discountPolicyStatusFilter").value = state.discountStatusFilter;
      $("#discountPolicyStatusFilter").disabled = state.discountView === "history";
    }
    const discountSearch = String(state.discountSearch || "").trim().toLowerCase();
    if (state.discountView === "history") {
      const visibleLogs = discountIssueLogs.filter((log) => !discountSearch || `${log.at} ${log.text}`.toLowerCase().includes(discountSearch));
      discountCards.innerHTML = `
        <article class="discount-policy-card discount-history-card">
          <div><strong>발급·사용 내역</strong><span class="status-badge ready">${visibleLogs.length}건</span></div>
          <div class="discount-history-list">
            ${visibleLogs.length ? visibleLogs.map((log) => `<div><time>${escapeHtml(log.at)}</time><span>${escapeHtml(log.text)}</span></div>`).join("") : '<p class="empty-text">검색된 할인권 처리 내역이 없습니다.</p>'}
          </div>
        </article>`;
    } else {
      const visiblePolicies = discountPolicies.filter((policy) => {
      const normalized = normalizeDiscountPolicy(policy);
      const searchMatch = !discountSearch || `${normalized.title} ${normalized.target} ${normalized.payment}`.toLowerCase().includes(discountSearch);
      const statusMatch = state.discountStatusFilter === "all" || normalized.status === state.discountStatusFilter;
      return searchMatch && statusMatch;
    });
    discountCards.innerHTML = `
      <details class="discount-policy-card discount-create-card">
        <summary>
          <strong>새 할인권 만들기</strong>
          <span class="status-badge pending">관리자 생성</span>
        </summary>
        <div class="discount-create-grid">
          <label><small>이름</small><input id="discountTitleInput" type="text" placeholder="예: 주말 신규 15% 할인권" /></label>
          <label><small>대상</small><input id="discountTargetInput" type="text" value="쿠폰제/정기권" /></label>
          <label><small>방식</small><select id="discountTypeInput"><option value="percent">할인율</option><option value="amount">할인금액</option></select></label>
          <label><small>값</small><input id="discountValueInput" type="number" min="0" value="10" /></label>
          <label><small>결제수단</small><input id="discountPaymentInput" type="text" value="카드/현금" /></label>
          <label><small>코치권한</small><select id="discountCoachPermissionInput"><option>코치별 지급 수량 안에서 사용</option><option>요청만 가능</option><option>관리자만 사용</option></select></label>
          <label><small>코치 지급수량</small><input id="discountQuotaInput" type="number" min="0" value="5" /></label>
          <label><small>유효기간(일)</small><input id="discountExpiresInput" type="number" min="1" value="30" /></label>
          <label><small>부담</small><input id="discountBurdenInput" type="text" value="센터 부담" /></label>
        </div>
        <button class="small-button" type="button" id="createDiscountPolicy">할인권 생성</button>
      </details>
      ${visiblePolicies
      .map((policy) => {
        const normalized = normalizeDiscountPolicy(policy);
        const available = discountAvailableCount(normalized);
        const issuedText = `${normalized.issued}장 지급 · ${normalized.used}장 사용 · ${available}장 남음`;
        const valueLabel = normalized.type === "percent" ? `${normalized.value}%` : `${money.format(normalized.value)}원`;
        return `
        <details class="discount-policy-card" data-discount-card="${normalized.id}">
          <summary>
            <div><strong>${escapeHtml(normalized.title)}</strong><small>${valueLabel} · ${available}장 남음</small></div>
            ${badge(normalized.status === "사용" ? "ready" : "pending", normalized.status)}
          </summary>
          <div class="discount-create-grid">
            <label><small>이름</small><input data-discount-field="title" type="text" value="${escapeHtml(normalized.title)}" /></label>
            <label><small>대상</small><input data-discount-field="target" type="text" value="${escapeHtml(normalized.target)}" /></label>
            <label><small>방식</small><select data-discount-field="type"><option value="percent" ${normalized.type === "percent" ? "selected" : ""}>할인율</option><option value="amount" ${normalized.type === "amount" ? "selected" : ""}>할인금액</option></select></label>
            <label><small>값</small><input data-discount-field="value" type="number" min="0" value="${normalized.value}" /></label>
            <label><small>결제수단</small><input data-discount-field="payment" type="text" value="${escapeHtml(normalized.payment)}" /></label>
            <label><small>코치권한</small><select data-discount-field="coachPermission"><option ${normalized.coachPermission === "코치별 지급 수량 안에서 사용" ? "selected" : ""}>코치별 지급 수량 안에서 사용</option><option ${normalized.coachPermission === "요청만 가능" ? "selected" : ""}>요청만 가능</option><option ${normalized.coachPermission === "관리자만 사용" ? "selected" : ""}>관리자만 사용</option></select></label>
            <label><small>코치 지급수량</small><input data-discount-field="coachQuota" type="number" min="0" value="${normalized.coachQuota}" /></label>
            <label><small>유효기간(일)</small><input data-discount-field="expiresDays" type="number" min="1" value="${normalized.expiresDays}" /></label>
            <label><small>부담</small><input data-discount-field="burden" type="text" value="${escapeHtml(normalized.burden)}" /></label>
            <label><small>상태</small><select data-discount-field="status"><option ${normalized.status === "사용" ? "selected" : ""}>사용</option><option ${normalized.status === "검토" ? "selected" : ""}>검토</option><option ${normalized.status === "중지" ? "selected" : ""}>중지</option></select></label>
          </div>
          <dl>
            <div><dt>할인</dt><dd>${valueLabel}</dd></div>
            <div><dt>대상</dt><dd>${escapeHtml(normalized.target)}</dd></div>
            <div><dt>발급/사용</dt><dd>${normalized.issued}/${normalized.used}장</dd></div>
            <div><dt>남은 수량</dt><dd>${available}장</dd></div>
            <div><dt>유효기간</dt><dd>발급 후 ${normalized.expiresDays}일</dd></div>
            <div><dt>코치 한도</dt><dd>${normalized.coachQuota || 0}장</dd></div>
          </dl>
          <p>${escapeHtml(issuedText)}</p>
          <div class="discount-action-row">
            <button class="small-button" type="button" data-save-discount-policy="${normalized.id}">저장</button>
            <button class="ghost-button" type="button" data-issue-discount-policy="${normalized.id}">코치에게 1장 지급</button>
            <button class="ghost-button" type="button" data-apply-discount-policy="${normalized.id}">결제에 사용처리</button>
          </div>
        </details>`;
      })
      .join("") || '<p class="empty-text">조건에 맞는 할인권 정책이 없습니다.</p>'}`;
    }
  }

  const roleFlow = $("#coachRoleFlow");
  if (roleFlow) {
    roleFlow.innerHTML = coachRegistrationFlow
      .map(
        (item) => `
        <article class="role-flow-item">
          <b>${item.step}</b>
          <div>
            <strong>${item.title}</strong>
            <span>${item.detail}</span>
          </div>
        </article>`,
      )
      .join("");
  }
}

function permissionMessage(error) {
  const message = error?.message || "";
  if (error?.status === 401 || error?.status === 403 || message.includes("permission denied") || message.includes("JWT")) {
    return "권한 필요";
  }
  return "확인 실패";
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

function renderSupabaseLiveStatus() {
  const target = $("#supabaseLiveStatus");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const items = supabaseLiveState.items.length
    ? supabaseLiveState.items
    : supabaseLiveTables.map((item) => ({ ...item, title: item.label, status: "setup", label: readiness?.ready ? "확인 전" : "설정 필요", detail: readiness?.ready ? "새로고침을 눌러 실제 읽기를 확인합니다." : "브라우저용 로컬 설정 파일이 필요합니다." }));

  target.innerHTML = `
    <article class="supabase-live-summary ${readiness?.ready ? "is-ready" : "is-setup"}">
      <strong>${readiness?.ready ? "앱 연결값 준비됨" : "앱 연결값 없음"}</strong>
      <span>${supabaseLiveState.loading ? "확인 중" : supabaseLiveState.message}</span>
    </article>
    ${items
      .map(
        (item) => `
      <article class="supabase-live-card ${item.status}">
        <div>
          <strong>${item.title || item.label}</strong>
          ${badge(item.status === "empty" ? "draft" : item.status === "blocked" ? "attention" : item.status, item.label)}
        </div>
        <p>${item.table}</p>
        <small>${item.detail}</small>
      </article>`,
      )
      .join("")}
  `;
}

function authProviderItems(settings = {}) {
  const external = settings.external || {};
  return [
    {
      id: "kakao",
      title: "Kakao",
      status: external.kakao ? "ready" : "setup",
      label: external.kakao ? "켜짐" : "설정 필요",
      detail: external.kakao ? "통합앱 카카오 로그인 연결 가능" : "Supabase Authentication > Providers에서 Kakao를 켜야 합니다.",
    },
    {
      id: "naver",
      title: "Naver",
      status: external.naver ? "ready" : "setup",
      label: external.naver ? "켜짐" : "설정 필요",
      detail: external.naver ? "통합앱 네이버 로그인 연결 가능" : "Supabase Authentication > Providers에서 Naver를 켜야 합니다.",
    },
    {
      id: "role-link",
      title: "역할 연결",
      status: "setup",
      label: "사용자 로그인 후",
      detail: "로그인한 사용자 UUID를 tn_users.auth_user_id에 연결하면 회원/코치 권한이 열립니다.",
    },
  ];
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

function renderAuthProviderStatus() {
  const target = $("#authProviderStatus");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const items = authProviderState.items.length ? authProviderState.items : authProviderItems();
  target.innerHTML = `
    <article class="supabase-live-summary ${readiness?.ready ? "is-ready" : "is-setup"}">
      <strong>${readiness?.ready ? "Auth 확인 가능" : "앱 연결값 없음"}</strong>
      <span>${authProviderState.loading ? "확인 중" : authProviderState.message}</span>
    </article>
    ${items
      .map(
        (item) => `
      <article class="supabase-live-card ${item.status}">
        <div>
          <strong>${item.title}</strong>
          ${badge(item.status === "setup" ? "draft" : item.status, item.label)}
        </div>
        <p>${item.id}</p>
        <small>${item.detail}</small>
      </article>`,
      )
      .join("")}
  `;
}

function renderAll() {
  renderMetrics();
  renderCourtControls();
  renderDashboard();
  renderAdminOperations();
  renderMembers();
  renderHoldingRequestAdminList();
  renderAccountDeletionAdminList();
  renderSchedule();
  renderMakeups();
  renderTickets();
  renderBilling();
  renderNotes();
  renderCommunity();
  renderRackettime();
  renderReports();
  renderCoaches();
  renderScheduleSettings();
  renderRefundPolicySettings();
  renderHoldingPolicySettings();
  renderNoticePopupSettings();
  renderNotificationPolicySettings();
  renderMemberManagementPolicySettings();
  renderSettingsTabs();
  renderAdminSecurity();
  renderServiceReadiness();
  renderSupabaseLiveStatus();
  renderAuthProviderStatus();
  renderCoachSettlementPreview();
  renderDataTools();
  renderGlobalSearchResults();
  saveSnapshot();
}

let adminLiveScheduleRefreshTimer = 0;
let adminLiveScheduleRefreshInFlight = false;
let scheduleSessionInitialized = false;

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
  if (
    adminLiveScheduleRefreshInFlight
    || document.hidden
    || state.view !== "schedule"
    || !operationsAccessReady()
    || !$("#lessonModal")?.hidden
  ) return false;

  adminLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncAdminLiveData();
    if (synced && options.render !== false) renderSchedule();
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
  adminLiveScheduleRefreshTimer = window.setInterval(refresh, 20_000);
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-dashboard-page]");
    if (!pageButton) return;
    const page = Number(pageButton.dataset.dashboardPageIndex) || 0;
    if (pageButton.dataset.dashboardPage === "member-directory") {
      state.memberListPage = page;
      state.selectedMemberId = null;
      renderMembers();
      saveSnapshot();
      return;
    }
    if (pageButton.dataset.dashboardPage === "tasks") state.adminTaskPage = page;
    if (pageButton.dataset.dashboardPage === "members") state.memberStatusPage = page;
    renderAdminOperations();
    saveSnapshot();
  });
  document.addEventListener("click", (event) => {
    const buttonId = event.target.closest("button")?.id || "";
    const settingsTabsByButton = {
      openScheduleSettingsButton: "operation",
      openNoticeSettingsButton: "notifications",
      openProductSettingsButton: "membership",
    };
    if (buttonId === "openDataToolsButton") openAdminToolsModal("data");
    if (settingsTabsByButton[buttonId]) openSettingsWorkspace(settingsTabsByButton[buttonId]);
  });
  document.addEventListener("click", async (event) => {
    const reconcileButton = event.target.closest("[data-reconcile-coach-login]");
    if (reconcileButton) {
      await reconcileCoachLogin(reconcileButton.dataset.reconcileCoachLogin);
      return;
    }
    if (event.target.closest("#addCoachStaffButton")) {
      openCoachStaffModal();
      return;
    }
    const editButton = event.target.closest("[data-edit-coach-staff]");
    if (editButton) {
      openCoachStaffModal(editButton.dataset.editCoachStaff);
      return;
    }
    const tabButton = event.target.closest("[data-coach-staff-tab]");
    if (tabButton) {
      readCoachStaffPanel();
      coachStaffEditorState.tab = tabButton.dataset.coachStaffTab;
      coachStaffEditorState.message = "";
      renderCoachStaffModal();
      return;
    }
    const addBlockButton = event.target.closest("[data-add-coach-staff-block]");
    if (addBlockButton) {
      addCoachStaffBlock(addBlockButton.dataset.addCoachStaffBlock);
      return;
    }
    const removeBlockButton = event.target.closest("[data-remove-coach-staff-block]");
    if (removeBlockButton) {
      removeCoachStaffBlock(removeBlockButton.dataset.coachStaffBlockType, removeBlockButton.dataset.removeCoachStaffBlock);
      return;
    }
    const stateButton = event.target.closest("[data-coach-staff-state]");
    if (stateButton) {
      await setCoachStaffState(stateButton.dataset.coachStaffState);
      return;
    }
    if (event.target.closest("#closeCoachStaffModal, #cancelCoachStaffModal")) closeCoachStaffModal();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id !== "coachStaffSettlementMethod" || !coachStaffEditorState.draft) return;
    coachStaffEditorState.draft.settlement.method = event.target.value;
    syncCoachStaffSettlementFieldVisibility(event.target.value);
  });
  $("#coachStaffForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCoachStaff();
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-jump]");
    if (!button) return;
    if (button.dataset.scheduleTicketId) {
      const ticket = tickets.find((item) => String(item.id) === String(button.dataset.scheduleTicketId));
      if (!ticket) {
        showToast("회원권 정보를 다시 불러와 주세요");
        return;
      }
      const memberName = ticketParticipantNames(ticket)[0] || splitMemberNames(ticket.member)[0] || "";
      setView("schedule");
      openLessonModal({
        memberName,
        coachId: ticket.coachId,
        ticketId: ticket.id,
        lessonSource: button.dataset.scheduleLessonSource || normalizeLessonSource(ticket.productKind === "pass" || ticket.productKind === "coupon" ? "coupon" : "regular"),
      });
      return;
    }
    setView(button.dataset.jump);
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-settings-tab]");
    if (!button) return;
    state.settingsTab = button.dataset.settingsTab || "operation";
    renderSettingsTabs();
    saveSnapshot();
  });
  document.addEventListener("click", async (event) => {
    if (event.target.closest("#addLessonPolicyButton")) {
      await createLessonPolicy();
      return;
    }
    const saveLessonPolicyButton = event.target.closest("[data-save-lesson-policy]");
    if (saveLessonPolicyButton) {
      await saveLessonPolicy(saveLessonPolicyButton.dataset.saveLessonPolicy);
      return;
    }
    const deleteLessonPolicyButton = event.target.closest("[data-delete-lesson-policy]");
    if (deleteLessonPolicyButton) {
      await deleteLessonPolicy(deleteLessonPolicyButton.dataset.deleteLessonPolicy);
      return;
    }
    const moveLessonPolicyButton = event.target.closest("[data-move-lesson-policy]");
    if (moveLessonPolicyButton) {
      await moveLessonPolicy(moveLessonPolicyButton.dataset.moveLessonPolicy, moveLessonPolicyButton.dataset.direction);
      return;
    }
    if (event.target.closest("#saveHoldingPolicy")) {
      await saveHoldingPolicySettings();
      return;
    }
    if (event.target.closest("#saveMemberManagementPolicy")) {
      await saveMemberManagementPolicySettings();
      return;
    }
    const reviewButton = event.target.closest("[data-review-holding]");
    if (reviewButton) {
      await reviewHoldingRequest(reviewButton.dataset.holdingRequestId, reviewButton.dataset.reviewHolding);
      return;
    }
    const accountDeletionButton = event.target.closest("[data-review-account-deletion]");
    if (accountDeletionButton) {
      await reviewAccountDeletionRequest(accountDeletionButton.dataset.accountDeletionId, accountDeletionButton.dataset.reviewAccountDeletion);
      return;
    }
    const evidenceButton = event.target.closest("[data-view-holding-evidence]");
    if (evidenceButton) {
      await viewHoldingEvidence(evidenceButton.dataset.viewHoldingEvidence);
      return;
    }
    const deleteEvidenceButton = event.target.closest("[data-delete-holding-evidence]");
    if (deleteEvidenceButton) await deleteHoldingEvidence(deleteEvidenceButton.dataset.deleteHoldingEvidence);
  });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "lessonPolicySearch") return;
    state.lessonPolicySearch = event.target.value;
    renderLessonPolicySettings();
    saveSnapshot();
  });
  $("#adminLockForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmAdminUnlock();
  });
  $("#refundForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmRefundFromModal();
  });
  $("#closeRefundModal")?.addEventListener("click", closeRefundModal);
  $("#cancelRefundModal")?.addEventListener("click", closeRefundModal);
  $("#retryRefundReconcile")?.addEventListener("click", reconcileRefundFromModal);
  $("#refundModal")?.addEventListener("click", (event) => {
    if (event.target.id === "refundModal") closeRefundModal();
  });
  $("#closeAdminLockModal")?.addEventListener("click", closeAdminLockModal);
  $("#cancelAdminLockModal")?.addEventListener("click", closeAdminLockModal);
  $("#adminLockModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminLockModal") closeAdminLockModal();
  });
  $("#closeAdminToolsModal")?.addEventListener("click", closeAdminToolsModal);
  $("#adminToolsModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminToolsModal") closeAdminToolsModal();
  });
  $("#closePolicyVersionEditor")?.addEventListener("click", closePolicyVersionEditor);
  $("#cancelPolicyVersionEditor")?.addEventListener("click", closePolicyVersionEditor);
  $("#savePolicyVersionEditor")?.addEventListener("click", savePolicyVersionEditor);
  $("#policyVersionEditorModal")?.addEventListener("click", (event) => {
    if (event.target.id === "policyVersionEditorModal") closePolicyVersionEditor();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "adminLockEnabled") {
      currentAdminSecurityDraft().enabled = event.target.checked;
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
      return;
    }
    if (event.target.id === "adminLockTimeout") {
      currentAdminSecurityDraft().timeoutMinutes = numericValue(event.target.value, 10);
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
      return;
    }
    if (event.target.matches("[data-admin-lock-view]")) {
      currentAdminSecurityDraft().lockedViews = $$("[data-admin-lock-view]:checked").map((input) => input.value);
      adminSecuritySaveState.status = "idle";
      renderAdminSecurity();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.id === "adminLockNowButton") {
      lockAdminNow();
      renderAll();
      showToast("관리자 메뉴를 다시 잠갔습니다");
      return;
    }
    if (event.target.id === "saveAdminSecurityButton") {
      saveAdminSecuritySettings();
      return;
    }
    if (event.target.id === "resetAdminSecurityButton") {
      resetAdminSecurityDraft();
      renderAdminSecurity();
      showToast("저장 전 보안 설정 변경을 취소했습니다");
      return;
    }
    if (event.target.id === "changeAdminPinButton") {
      changeAdminPin();
    }
  });
  document.addEventListener("click", (event) => {
    const oneDaySlotButton = event.target.closest("[data-add-one-day-day]");
    if (oneDaySlotButton) {
      event.stopPropagation();
      openOneDayBookingModal({
        day: oneDaySlotButton.dataset.addOneDayDay,
        time: oneDaySlotButton.dataset.addOneDayTime,
        coachId: oneDaySlotButton.dataset.addOneDayCoach,
      });
      return;
    }
    const releasedSlotButton = event.target.closest("[data-open-released-makeup-slot]");
    if (releasedSlotButton) {
      event.stopPropagation();
      openLessonModal({
        day: releasedSlotButton.dataset.releasedSlotDay,
        time: releasedSlotButton.dataset.releasedSlotTime,
        courtId: releasedSlotButton.dataset.releasedSlotCourt,
        coachId: releasedSlotButton.dataset.releasedSlotCoach,
        entitlementId: releasedSlotButton.dataset.releasedSlotEntitlement,
        lessonSource: "makeup",
      });
      return;
    }
    const slotButton = event.target.closest("[data-add-lesson-day]");
    if (!slotButton) return;
    event.stopPropagation();
    openLessonModal({
      day: slotButton.dataset.addLessonDay,
      time: slotButton.dataset.addLessonTime,
      courtId: slotButton.dataset.addLessonCourt,
      coachId: slotButton.dataset.addLessonCoach,
    });
  });
  document.addEventListener("click", (event) => {
    const oneDayBookingButton = event.target.closest("[data-edit-one-day-booking-id]");
    if (oneDayBookingButton) {
      openOneDayBookingModal({ bookingId: oneDayBookingButton.dataset.editOneDayBookingId });
      return;
    }
    const lessonButton = event.target.closest("[data-edit-lesson-id]");
    if (!lessonButton) return;
    openEditLessonModal(lessonButton.dataset.editLessonId);
  });
  $("#adminWeekSwitcher")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-go-admin-today]")) {
      goToAdminScheduleToday();
      return;
    }
    const monthButton = event.target.closest("[data-change-admin-month]");
    if (monthButton) {
      changeAdminMonth(Number(monthButton.dataset.changeAdminMonth));
      return;
    }
    const button = event.target.closest("[data-change-admin-week]");
    if (button) changeAdminWeek(Number(button.dataset.changeAdminWeek));
  });
  $("#adminWeekSwitcher")?.addEventListener("change", (event) => {
    if (event.target.matches("[data-admin-month]")) selectAdminMonth(event.target.value);
  });
  $("#adminScheduleDayPicker")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-admin-day]");
    if (!button) return;
    state.selectedScheduleDay = button.dataset.selectAdminDay;
    renderSchedule();
    saveSnapshot();
  });
  document.addEventListener("click", (event) => {
    const scheduleViewButton = event.target.closest("[data-schedule-view]");
    if (scheduleViewButton) {
      state.scheduleView = scheduleViewButton.dataset.scheduleView;
      renderSchedule();
      saveSnapshot();
      return;
    }
    const coachFilterButton = event.target.closest("[data-select-schedule-coach]");
    if (coachFilterButton) {
      state.scheduleCoachFilter = coachFilterButton.dataset.selectScheduleCoach || "all";
      renderSchedule();
      saveSnapshot();
    }
  });
  $("#globalSearch").addEventListener("input", () => {
    renderGlobalSearchResults();
    if (state.view === "members") renderMembers();
    if (state.view === "schedule") renderSchedule();
  });
  $("#globalSearch").addEventListener("focus", renderGlobalSearchResults);
  $("#globalSearch").addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    clearGlobalSearch();
    event.currentTarget.blur();
  });
  $("#globalSearchResults").addEventListener("click", (event) => {
    const resultButton = event.target.closest("[data-global-search-result]");
    if (!resultButton) return;
    if (resultButton.dataset.searchMemberId) state.selectedMemberId = Number(resultButton.dataset.searchMemberId);
    if (resultButton.dataset.searchSettingsTab) state.settingsTab = resultButton.dataset.searchSettingsTab;
    clearGlobalSearch();
    renderAll();
    setView(resultButton.dataset.searchView || "dashboard");
  });
  document.addEventListener("click", (event) => {
    const searchShell = event.target.closest(".global-search-shell");
    if (searchShell) return;
    const results = $("#globalSearchResults");
    if (results) results.hidden = true;
    $("#globalSearch")?.setAttribute("aria-expanded", "false");
  });
  $("#addMemberButton").addEventListener("click", openManualMemberModal);
  $("#exportMembersButton")?.addEventListener("click", exportVisibleMembers);
  $("#memberListSearch")?.addEventListener("input", (event) => {
    state.memberSearch = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
  });
  $("#memberCoachFilter")?.addEventListener("change", (event) => {
    state.memberCoachFilter = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    saveSnapshot();
  });
  $("#memberTicketFilter")?.addEventListener("change", (event) => {
    state.memberTicketFilter = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    saveSnapshot();
  });
  $("#openLessonModal").addEventListener("click", openLessonModal);
  $("#saveScheduleList").addEventListener("click", async () => {
    if (state.liveScheduleLoaded) {
      await saveLiveSchedulePolicy();
      return;
    }
    billingLogs.unshift(`레슨시간표 목록 저장 완료: ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
    renderAll();
    showToast("레슨시간표 저장 완료");
  });
  $("#saveLiveSchedulePolicyButton")?.addEventListener("click", saveLiveSchedulePolicy);
  $("#closeLessonModal").addEventListener("click", closeLessonModal);
  $("#cancelLessonModal").addEventListener("click", closeLessonModal);
  $("#closeOneDayBookingModal")?.addEventListener("click", closeOneDayBookingModal);
  $("#cancelOneDayBookingModal")?.addEventListener("click", closeOneDayBookingModal);
  $("#oneDayBookingForm")?.addEventListener("submit", saveOneDayBooking);
  $("#deleteOneDayBookingButton")?.addEventListener("click", deleteOneDayBooking);
  $("#lessonForm").addEventListener("submit", addLessonFromForm);
  $("#deleteLessonButton").addEventListener("click", deleteEditingLesson);
  $("#markLessonAbsentButton")?.addEventListener("click", markEditingLessonAbsentForMakeup);
  $("#restoreAbsentLessonButton")?.addEventListener("click", restoreAbsentLessonFromModal);
  $("#saveRackettimeButton")?.addEventListener("click", saveRackettimeList);
  $("#downloadSettlementButton")?.addEventListener("click", downloadSettlementCsv);
  $("#downloadImportTemplateButton")?.addEventListener("click", downloadImportTemplate);
  $("#dataImportFile")?.addEventListener("change", (event) => handleDataImportFile(event.target.files?.[0]));
  $("#clearDataImportButton")?.addEventListener("click", clearDataImportResult);
  $("#dataImportCommitButton")?.addEventListener("click", previewDataImportOnServer);
  $("#dataImportApplyButton")?.addEventListener("click", commitDataImportOnServer);
  document.addEventListener("click", (event) => {
    const loginButton = event.target.closest("[data-admin-login-provider]");
    if (loginButton) startAdminImportLogin(loginButton.dataset.adminLoginProvider);

    const authButton = event.target.closest("[data-admin-auth-action]");
    if (authButton?.dataset.adminAuthAction === "refresh") refreshAdminImportAuthState().then(refreshAdminPendingUsers);
    if (authButton?.dataset.adminAuthAction === "logout") signOutAdminImport();

    const adminUsersAction = event.target.closest("[data-admin-users-action]");
    if (adminUsersAction?.dataset.adminUsersAction === "refresh") refreshAdminPendingUsers();

    const adminApproveButton = event.target.closest("[data-admin-approve-user]");
    if (adminApproveButton) approveAdminPendingUser(adminApproveButton.dataset.adminApproveUser);

    const adminHoldButton = event.target.closest("[data-admin-hold-user]");
    if (adminHoldButton) holdAdminPendingUser(adminHoldButton.dataset.adminHoldUser);
  });
  $("#downloadDataExportButton")?.addEventListener("click", downloadDataExport);
  $("#downloadSafeBackupButton")?.addEventListener("click", downloadSafeBackup);
  ["#dataExportDataset", "#dataExportFormat", "#dataExportPrivateFields"].forEach((selector) => {
    $(selector)?.addEventListener("change", renderDataTools);
  });
  $("#writeCommunityButton")?.addEventListener("click", writeCommunityPost);
  $("#applyBreakRuleButton").addEventListener("click", () => {
    const selectedDays = $$("[data-break-day]:checked").map((input) => input.value);
    const start = $("#breakStartInput").value;
    const end = $("#breakEndInput").value;
    const label = $("#breakLabelInput")?.value.trim() || "브레이크";
    if (!selectedDays.length || !start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
      showToast("요일과 시간을 확인해주세요");
      return;
    }
    scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => {
      const sameTime = rule.start === start && rule.end === end;
      const overlapDay = rule.days.some((day) => selectedDays.includes(day));
      return !(sameTime && overlapDay);
    });
    scheduleSettings.breakRules.push({ id: `break-${Date.now()}`, days: selectedDays, start, end, label });
    renderAll();
    showToast("브레이크타임 등록 완료");
  });
  ["#openStartInput", "#openEndInput"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      scheduleSettings.openStart = $("#openStartInput").value || scheduleSettings.openStart;
      scheduleSettings.openEnd = $("#openEndInput").value || scheduleSettings.openEnd;
      renderAll();
      showToast("운영시간 반영 완료");
    });
  });
  $$('[data-lesson-color]').forEach((input) => {
    input.addEventListener("change", async () => {
      scheduleSettings.lessonColors[input.dataset.lessonColor] = input.value;
      renderSchedule();
      saveSnapshot();
      await syncLiveSchedulePolicyToServer();
      showToast("시간표 색상 저장 완료");
    });
  });
  $("#lessonMemberSearch").addEventListener("input", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    refreshLessonMemberOptions();
    alignCoachToSelectedMemberTicket();
    refreshLessonTicketOptions();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    renderLessonExpiredTickets();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#lessonMember").addEventListener("change", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    alignCoachToSelectedMemberTicket();
    refreshLessonTicketOptions();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    renderLessonExpiredTickets();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#lessonCoach").addEventListener("change", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    if (!state.editingLessonId) ensureMemberHasCoachTicket();
    refreshLessonTicketOptions();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  ["#lessonDay", "#lessonDuration"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      // Day and duration only change slot availability. Rebuilding ticket options
      // here silently selected a different ticket after an unavailable-slot warning.
      // Ticket identity is changed only by member, coach, ticket, or source actions.
      refreshLessonTimeOptions($("#lessonTime").value);
      renderLessonPreview();
    });
  });
  $("#addLessonColorRuleButton")?.addEventListener("click", () => {
    const index = scheduleSettings.lessonColorRules.length + 1;
    scheduleSettings.lessonColorRules.push({ id: `custom-${Date.now()}`, label: `추가 표시 ${index}`, match: `추가 표시 ${index}`, color: "#64748b" });
    renderCustomLessonColorRules();
    saveSnapshot();
  });
  $("#customLessonColorRules")?.addEventListener("change", async (event) => {
    const id = event.target.dataset.customLessonLabel || event.target.dataset.customLessonMatch || event.target.dataset.customLessonColor;
    const rule = scheduleSettings.lessonColorRules.find((item) => item.id === id);
    if (!rule) return;
    if (event.target.dataset.customLessonLabel) rule.label = event.target.value.trim() || rule.label;
    if (event.target.dataset.customLessonMatch) rule.match = event.target.value.trim();
    if (event.target.dataset.customLessonColor) rule.color = event.target.value;
    renderSchedule();
    saveSnapshot();
    await syncLiveSchedulePolicyToServer();
    showToast("추가 표시 종류 저장 완료");
  });
  $("#customLessonColorRules")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-lesson-color-rule]");
    if (!button) return;
    scheduleSettings.lessonColorRules = scheduleSettings.lessonColorRules.filter((rule) => rule.id !== button.dataset.deleteLessonColorRule);
    renderCustomLessonColorRules();
    saveSnapshot();
    await syncLiveSchedulePolicyToServer();
  });
  $("#lessonTime").addEventListener("change", () => {
    refreshLessonExtraTimeOptions();
    renderLessonPreview();
  });
  $("#lessonType").addEventListener("change", () => {
    syncLessonTypeFromForm();
    renderLessonPreview();
  });
  $("#lessonTicket").addEventListener("change", () => {
    state.pinnedLessonTicketId = $("#lessonTicket").value || "";
    state.lessonSourceTouched = false;
    syncLessonSourceFromTicket(true);
    refreshLessonDurationOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonDayOptions();
    syncLessonTypeFromForm();
    renderLessonTicketHint();
    renderLessonPreview();
  });
  $("#lessonSource").addEventListener("change", () => {
    if ($("#lessonSource").value === "one_day") {
      const defaults = {
        day: $("#lessonDay")?.value || "",
        time: $("#lessonTime")?.value || "",
        coachId: $("#lessonCoach")?.value || "",
      };
      closeLessonModal();
      openOneDayBookingModal(defaults);
      return;
    }
    state.lessonSourceTouched = true;
    alignTicketToLessonSource();
    syncLessonSourceOptions();
    refreshLessonDurationOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonDayOptions();
    syncLessonTypeFromForm();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#lessonMakeupEntitlement")?.addEventListener("change", () => {
    applySelectedAdminMakeupEntitlement();
    syncMakeupEntitlementIdentityLock();
    renderLessonPreview();
  });
  ["#lessonPastCoachComment"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderLessonPreview);
  });
  $("#lessonAdminOverride")?.addEventListener("change", () => {
    const currentMember = $("#lessonMember")?.value || "";
    refreshLessonMemberOptions(currentMember, getCurrentEditingLesson());
    if (currentMember && [...$("#lessonMember").options].some((option) => option.value === currentMember)) {
      $("#lessonMember").value = currentMember;
    }
    refreshLessonTicketOptions();
    syncLessonSourceOptions();
    refreshLessonDurationOptions();
    refreshLessonDayOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  ["#lessonCourt"].forEach((selector) => {
    $(selector).addEventListener("change", renderLessonPreview);
  });
  $("#lessonModal").addEventListener("click", (event) => {
    if (event.target.id === "lessonModal") closeLessonModal();
  });
  $("#oneDayBookingModal")?.addEventListener("click", (event) => {
    if (event.target.id === "oneDayBookingModal") closeOneDayBookingModal();
  });
  ["#oneDayGuestName", "#oneDayGuestPhone", "#oneDayCoach", "#oneDayDate", "#oneDayTime", "#oneDayDuration", "#oneDayStatus", "#oneDayNote"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderOneDayBookingPreview);
    $(selector)?.addEventListener("change", renderOneDayBookingPreview);
  });
  $("#coachStaffModal")?.addEventListener("click", (event) => {
    if (event.target.id === "coachStaffModal") closeCoachStaffModal();
  });
  $("#memberManagementModal")?.addEventListener("click", (event) => {
    if (event.target.id === "memberManagementModal") closeMemberManagementModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#lessonModal").hidden) closeLessonModal();
    if (event.key === "Escape" && !$("#oneDayBookingModal")?.hidden) closeOneDayBookingModal();
    if (event.key === "Escape" && !$("#coachStaffModal")?.hidden) closeCoachStaffModal();
    if (event.key === "Escape" && !$("#refundModal").hidden) closeRefundModal();
    if (event.key === "Escape" && !$("#adminLockModal").hidden) closeAdminLockModal();
    if (event.key === "Escape" && !$("#adminToolsModal").hidden) closeAdminToolsModal();
    if (event.key === "Escape" && !$("#memberManagementModal")?.hidden) closeMemberManagementModal();
    if (event.key === "Escape" && !$("#policyVersionEditorModal")?.hidden) closePolicyVersionEditor();
  });

  $$(".segment[data-member-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.memberFilter = button.dataset.memberFilter;
      state.memberListPage = 0;
      state.selectedMemberId = null;
      renderMembers();
      if (state.memberFilter === "pending" && operationsRole() === "admin" && !adminPendingUsersState.loaded && !adminPendingUsersState.loading) {
        refreshAdminPendingUsers();
      }
      saveSnapshot();
    });
  });

  $$(".segment[data-schedule-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scheduleFilter = button.dataset.scheduleFilter;
      $$(".segment[data-schedule-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderSchedule();
    });
  });
  document.addEventListener("click", (event) => {
    const billingFilterButton = event.target.closest("[data-billing-filter]");
    if (billingFilterButton) {
      state.billingFilter = billingFilterButton.dataset.billingFilter || "action";
      renderBilling();
      saveSnapshot();
      return;
    }
    const discountViewButton = event.target.closest("[data-discount-view]");
    if (discountViewButton) {
      state.discountView = discountViewButton.dataset.discountView || "policies";
      renderServiceReadiness();
      saveSnapshot();
      return;
    }
    const policyGuideButton = event.target.closest("[data-copy-policy-guide]");
    if (policyGuideButton) copyPolicyGuide(policyGuideButton.dataset.copyPolicyGuide);
  });
  $("#discountPolicySearch")?.addEventListener("input", (event) => {
    state.discountSearch = event.target.value;
    renderServiceReadiness();
  });
  $("#discountPolicyStatusFilter")?.addEventListener("change", (event) => {
    state.discountStatusFilter = event.target.value;
    renderServiceReadiness();
    saveSnapshot();
  });
  $$(".segment[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMode = button.dataset.mode;
      $$(".segment[data-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderModePanel();
      saveSnapshot();
    });
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("#noticeImageInput")) {
      selectNoticeImage(event.target.files?.[0]);
      return;
    }
    if (event.target.closest("[data-ticket-group-size]")) {
      syncMemberTicketPartnerField(event.target.closest("[data-ticket-lesson-setup]"));
      return;
    }
    if (event.target.matches("#memberManagementForm select[name='productId']")) {
      applyMemberManagementProductDefaults(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm select[name='scheduleScope'], #memberManagementForm select[name='weeklyFrequency'], #memberManagementForm select[name='lessonType']")) {
      syncMemberManagementScopeFields(event.target.form);
      syncManualMemberPartnerField(event.target.form);
      syncMemberManagementProductForMethod(event.target.form);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#memberManagementForm input[name='totalSessions'], #memberManagementForm input[name='usedSessions']")) {
      syncMemberManagementBalance(event.target.form);
      return;
    }
    if (event.target.matches("[data-ticket-partner-search]")) {
      filterMemberTicketPartnerOptions(event.target.closest("[data-ticket-lesson-setup]"));
      return;
    }
    if (event.target.matches("[data-manual-member-partner-search]")) {
      filterManualMemberPartnerOptions(event.target.form);
      return;
    }
    if (event.target.matches("#memberManagementForm input[name='memberName']")) {
      const label = event.target.form?.querySelector("[data-manual-primary-member]");
      if (label) label.textContent = event.target.value.trim() || "새 회원";
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.id === "memberManagementForm") await submitMemberManagementForm(event);
  });

  document.addEventListener("click", async (event) => {
    const memberButton = event.target.closest("[data-select-member]");
    if (memberButton) {
      state.selectedMemberId = Number(memberButton.dataset.selectMember);
      renderMembers();
    }

    if (event.target.closest("[data-close-member-detail]")) {
      state.selectedMemberId = null;
      renderMembers();
      return;
    }

    const ticketManageButton = event.target.closest("[data-manage-member-ticket]");
    if (ticketManageButton) {
      const ticketId = ticketManageButton.dataset.manageMemberTicket || "";
      const action = document.querySelector(`[data-member-ticket-action="${CSS.escape(ticketId)}"]`)?.value || "correct";
      const member = members.find((item) => item.id === state.selectedMemberId);
      openMemberManagementModal(member, action, ticketId);
      return;
    }

    const memberManagementButton = event.target.closest("[data-open-member-management]");
    if (memberManagementButton) {
      const member = members.find((item) => item.id === state.selectedMemberId);
      openMemberManagementModal(
        member,
        memberManagementButton.dataset.openMemberManagement,
        memberManagementButton.dataset.memberManagementTicket || "",
      );
      return;
    }

    if (event.target.closest("[data-close-member-management]")) {
      closeMemberManagementModal();
      return;
    }

    const saveTicketCoachButton = event.target.closest("[data-save-ticket-coach]");
    if (saveTicketCoachButton) {
      await assignMemberTicketCoach(saveTicketCoachButton);
      return;
    }

    const saveTicketLessonSetupButton = event.target.closest("[data-save-ticket-lesson-setup]");
    if (saveTicketLessonSetupButton) {
      await saveMemberTicketLessonSetup(saveTicketLessonSetupButton);
      return;
    }

    const groupPaymentModeButton = event.target.closest("[data-group-payment-mode]");
    if (groupPaymentModeButton) {
      await setGroupPaymentMode(groupPaymentModeButton.dataset.groupAccountId, groupPaymentModeButton.dataset.groupPaymentMode);
    }

    const switchGroupPayerButton = event.target.closest("[data-switch-group-payer]");
    if (switchGroupPayerButton) {
      await switchGroupPayer(switchGroupPayerButton.dataset.switchGroupPayer);
    }

    const approvePendingMemberButton = event.target.closest("[data-approve-pending-member]");
    if (approvePendingMemberButton) {
      const member = members.find((item) => item.id === Number(approvePendingMemberButton.dataset.approvePendingMember));
      if (member) {
        const role = document.querySelector(`[data-pending-member-role="${member.id}"]`)?.value || "member";
        const coach = document.querySelector(`[data-pending-member-coach="${member.id}"]`)?.value || "미배정";
        member.status = "active";
        member.statusLabel = "수강중";
        member.authRole = role;
        member.coach = coach;
        member.source = "소셜 로그인 승인";
        member.note = "신규 로그인 회원 승인 완료";
        renderAll();
        showToast("회원 승인 완료");
      }
    }

    const holdPendingMemberButton = event.target.closest("[data-hold-pending-member]");
    if (holdPendingMemberButton) {
      const member = members.find((item) => item.id === Number(holdPendingMemberButton.dataset.holdPendingMember));
      if (member) {
        member.status = "expired";
        member.statusLabel = "보류";
        member.note = "신규 가입 보류 처리됨";
        renderAll();
        showToast("신규 가입 보류 처리 완료");
      }
    }

    const authLinkButton = event.target.closest("[data-copy-auth-link]");
    if (authLinkButton) {
      await copyMemberAuthSql(authLinkButton.dataset.authMemberId, authLinkButton.dataset.copyAuthLink);
      return;
    }

    const prepareAuthSwitchButton = event.target.closest("[data-prepare-auth-switch]");
    if (prepareAuthSwitchButton) {
      await prepareAuthProviderSwitch(prepareAuthSwitchButton.dataset.prepareAuthSwitch, prepareAuthSwitchButton);
      return;
    }

    const cancelAuthSwitchButton = event.target.closest("[data-cancel-auth-switch]");
    if (cancelAuthSwitchButton) {
      await cancelAuthProviderSwitch(cancelAuthSwitchButton.dataset.authUserId, cancelAuthSwitchButton.dataset.cancelAuthSwitch, cancelAuthSwitchButton);
      return;
    }

    const unlinkAuthProviderButton = event.target.closest("[data-unlink-auth-provider]");
    if (unlinkAuthProviderButton) {
      await unlinkAuthProvider(unlinkAuthProviderButton.dataset.authUserId, unlinkAuthProviderButton.dataset.unlinkAuthProvider, unlinkAuthProviderButton);
      return;
    }

    const coachStatusButton = event.target.closest("[data-set-coach-status]");
    if (coachStatusButton) {
      await setCoachApproval(coachStatusButton.dataset.setCoachStatus, coachStatusButton.dataset.coachStatus, coachStatusButton);
      return;
    }

    const bookEntitlementButton = event.target.closest("[data-book-entitlement]");
    if (bookEntitlementButton) {
      const entitlement = openAdminMakeupEntitlements().find((item) => item.id === bookEntitlementButton.dataset.bookEntitlement);
      if (!entitlement) {
        showToast("연결할 보강 대기를 찾지 못했습니다. 새로고침 후 다시 확인해 주세요.");
        return;
      }
      openAdminMakeupBooking(entitlement);
      return;
    }

    const makeupButton = event.target.closest("[data-approve-makeup]");
    if (makeupButton) {
      const request = makeupRequests.find((item) => String(item.id) === String(makeupButton.dataset.approveMakeup));
      if (!request) return;
      if (request.status === "approved") {
        showToast("이미 승인된 보강입니다");
        return;
      }
      request.status = "approved";
      request.statusLabel = "승인완료";
      const pendingMakeupLesson = lessons.find((lesson) => lesson.member === request.member && isMakeupLesson(lesson) && lesson.status === "pending") ||
        lessons.find((lesson) => lesson.member === "보강대기" && isMakeupLesson(lesson) && lesson.status === "pending");
      if (pendingMakeupLesson) {
        pendingMakeupLesson.member = request.member;
        pendingMakeupLesson.type = "보강";
        pendingMakeupLesson.status = "scheduled";
        pendingMakeupLesson.makeup = true;
      }
      billingLogs.unshift(`${request.member} 보강 요청 승인`);
      renderAll();
      showToast("보강 승인 완료");
    }

    const noteButton = event.target.closest("[data-confirm-note]");
    if (noteButton) {
      const note = lessonNotes.find((item) => String(item.id) === String(noteButton.dataset.confirmNote));
      if (!note) return;
      if (note.status === "confirmed") {
        showToast("이미 확인된 기록입니다");
        return;
      }
      note.status = "confirmed";
      note.statusLabel = "확인완료";
      const ticket = getActiveTicketForMember(note.member);
      if (ticket && ticket.remaining > 0) {
        ticket.used += 1;
        ticket.remaining -= 1;
      }
      syncMemberRemainingFromTicket(note.member);
      billingLogs.unshift(`${note.member} 기록/차감 확인 및 1회 차감`);
      renderAll();
      showToast("기록/차감 확인 완료");
    }

    const syncServerPaymentsButton = event.target.closest("#syncServerPaymentsButton");
    if (syncServerPaymentsButton) {
      await loadServerPaymentsIntoBilling();
      return;
    }

    const serverReadyPaymentButton = event.target.closest("[data-server-ready-payment]");
    if (serverReadyPaymentButton) {
      const item = billings[Number(serverReadyPaymentButton.dataset.serverReadyPayment)];
      await verifyBillingPaymentItem(item);
      return;
    }

    const reviewPaymentButton = event.target.closest("[data-review-payment]");
    if (reviewPaymentButton) {
      const item = billings[Number(reviewPaymentButton.dataset.reviewPayment)];
      await verifyBillingPaymentItem(item);
      return;
    }

    const paidPaymentButton = event.target.closest("[data-paid-payment]");
    if (paidPaymentButton) {
      const item = billings[Number(paidPaymentButton.dataset.paidPayment)];
      showToast(`${item.member} 결제는 이미 완료됐습니다`);
    }

    const refundPaymentButton = event.target.closest("[data-refund-payment]");
    if (refundPaymentButton) {
      const itemIndex = Number(refundPaymentButton.dataset.refundPayment);
      const item = billings[itemIndex];
      await openRefundModal(item, itemIndex);
      return;
    }

    const cancelPaymentButton = event.target.closest("[data-cancel-payment]");
    if (cancelPaymentButton) {
      const item = billings[Number(cancelPaymentButton.dataset.cancelPayment)];
      await cancelBillingPaymentItem(item);
      return;
    }

    const failedPaymentButton = event.target.closest("[data-failed-payment]");
    if (failedPaymentButton) {
      const item = billings[Number(failedPaymentButton.dataset.failedPayment)];
      billingLogs.unshift(`${item.member} 결제 실패 확인: ${item.providerPaymentId || item.item}`);
      renderAll();
      showToast("결제 실패 항목을 확인했습니다");
    }

    const renewTicketButton = event.target.closest("[data-renew-ticket]");
    if (renewTicketButton) {
      const ticketId = renewTicketButton.dataset.renewTicket || "";
      const memberName = renewTicketButton.dataset.renewMember || "";
      const ticket = [...tickets, ...expiredTickets].find((item) => String(item.serverTicketId || "") === ticketId);
      const participantIds = new Set(ticketParticipantUserIds(ticket).map(String));
      const member = members.find((item) => item.name === memberName || memberServerUserIds(item).some((id) => participantIds.has(String(id))));
      if (!member || !ticketId) {
        showToast("회원권 정보를 다시 불러와 주세요.");
        return;
      }
      openMemberManagementModal(member, "reenroll", ticketId);
      return;
    }

    const saveProductSettingButton = event.target.closest("[data-save-product-setting]");
    if (saveProductSettingButton) {
      await updateMembershipProductSetting(saveProductSettingButton.dataset.saveProductSetting);
      return;
    }

    if (event.target.closest("#addMembershipProductButton")) {
      await createMembershipProductSetting();
      return;
    }

    const moveProductButton = event.target.closest("[data-move-product-setting]");
    if (moveProductButton) {
      await moveMembershipProductSetting(
        moveProductButton.dataset.moveProductSetting,
        moveProductButton.dataset.moveDirection,
      );
      return;
    }

    const forceDeleteProductButton = event.target.closest("[data-force-delete-product-setting]");
    if (forceDeleteProductButton) {
      await forceDeleteMembershipProductSetting(forceDeleteProductButton.dataset.forceDeleteProductSetting);
      return;
    }

    const createDiscountButton = event.target.closest("#createDiscountPolicy");
    if (createDiscountButton) {
      createDiscountPolicy();
    }

    const saveDiscountButton = event.target.closest("[data-save-discount-policy]");
    if (saveDiscountButton) {
      updateDiscountPolicy(saveDiscountButton.dataset.saveDiscountPolicy);
    }

    const issueDiscountButton = event.target.closest("[data-issue-discount-policy]");
    if (issueDiscountButton) {
      issueDiscountPolicy(issueDiscountButton.dataset.issueDiscountPolicy);
    }

    const applyDiscountButton = event.target.closest("[data-apply-discount-policy]");
    if (applyDiscountButton) {
      applyDiscountPolicy(applyDiscountButton.dataset.applyDiscountPolicy);
    }

    const copyPolicyVersionButton = event.target.closest("[data-copy-policy-version]");
    if (copyPolicyVersionButton) {
      await copyPolicyVersion(copyPolicyVersionButton.dataset.copyPolicyVersion);
      return;
    }

    const editPolicyVersionButton = event.target.closest("[data-edit-policy-version]");
    if (editPolicyVersionButton) {
      openPolicyVersionEditor(editPolicyVersionButton.dataset.editPolicyVersion);
      return;
    }

    const activatePolicyVersionButton = event.target.closest("[data-activate-policy-version]");
    if (activatePolicyVersionButton) {
      await activatePolicyVersion(activatePolicyVersionButton.dataset.activatePolicyVersion);
      return;
    }

    const deletePolicyVersionButton = event.target.closest("[data-delete-policy-version]");
    if (deletePolicyVersionButton) {
      await deletePolicyVersion(deletePolicyVersionButton.dataset.deletePolicyVersion);
      return;
    }

    if (event.target.closest("#addPolicyVersionSection")) {
      addPolicyVersionSectionEditor();
      return;
    }

    const removePolicySectionButton = event.target.closest("[data-remove-policy-section]");
    if (removePolicySectionButton) {
      removePolicySectionButton.closest("[data-policy-section-editor]")?.remove();
      return;
    }

    const previewPolicySnapshotButton = event.target.closest("[data-preview-policy-snapshot]");
    if (previewPolicySnapshotButton) {
      showPolicySnapshotPreview(previewPolicySnapshotButton.dataset.previewPolicySnapshot);
    }

    if (event.target.closest("#saveRefundPolicyButton")) {
      await saveRefundPolicySettings();
    }

    if (event.target.closest("#resetRefundPolicyButton")) {
      await resetRefundPolicySettings();
    }

    const savePaymentConfigButton = event.target.closest("#savePaymentConfigButton");
    if (savePaymentConfigButton) {
      savePaymentGatewayConfig();
    }

    const clearPaymentConfigButton = event.target.closest("#clearPaymentConfigButton");
    if (clearPaymentConfigButton) {
      clearPaymentGatewayConfig();
    }

    const editNoticeButton = event.target.closest("[data-edit-notice]");
    if (editNoticeButton) {
      editPopupNotice(editNoticeButton.dataset.editNotice);
      return;
    }

    const moveNoticeButton = event.target.closest("[data-move-notice]");
    if (moveNoticeButton) {
      await movePopupNotice(moveNoticeButton.dataset.moveNotice, moveNoticeButton.dataset.direction);
      return;
    }

    const deleteNoticeButton = event.target.closest("[data-delete-notice]");
    if (deleteNoticeButton) {
      await deletePopupNotice(deleteNoticeButton.dataset.deleteNotice);
      return;
    }

    const removeNoticeImageButton = event.target.closest("#removeNoticeImageButton");
    if (removeNoticeImageButton) {
      if (noticeImageDraftUrl) URL.revokeObjectURL(noticeImageDraftUrl);
      noticeImageDraftFile = null;
      noticeImageDraftUrl = "";
      noticeImageRemoveRequested = true;
      renderNoticePopupSettings();
      showToast("저장하면 공지 이미지가 삭제됩니다");
      return;
    }

    const saveNoticePopupButton = event.target.closest("#saveNoticePopupButton");
    if (saveNoticePopupButton) {
      await saveNoticePopupSettings();
      return;
    }

    const disableNoticePopupButton = event.target.closest("#disableNoticePopupButton");
    if (disableNoticePopupButton) {
      await saveNoticePopupSettings("disabled");
      return;
    }

    const newNoticePopupButton = event.target.closest("#newNoticePopupButton");
    if (newNoticePopupButton) {
      startNewPopupNotice();
      return;
    }

    const saveNotificationPolicyButton = event.target.closest("#saveNotificationPolicyButton");
    if (saveNotificationPolicyButton) {
      await saveNotificationPolicySettings();
    }

    const refreshNotificationStatusButton = event.target.closest("#refreshNotificationStatusButton");
    if (refreshNotificationStatusButton) {
      await loadNotificationDeliveryStatus();
      showToast("알림 발송 현황을 확인했습니다");
    }

    const resetNoticeDismissalsButton = event.target.closest("#resetNoticeDismissalsButton");
    if (resetNoticeDismissalsButton) {
      resetNoticeDismissals();
      showToast("회원/코치 앱에서 공지를 다시 볼 수 있게 초기화했습니다");
    }

    const modeActionButton = event.target.closest("[data-mode-action]");
    if (modeActionButton) {
      handleModeAction(modeActionButton.dataset.modeAction);
    }

    const racketTabButton = event.target.closest("[data-racket-tab]");
    if (racketTabButton) {
      state.racketTab = racketTabButton.dataset.racketTab;
      $$(".segment[data-racket-tab]").forEach((item) => item.classList.toggle("is-active", item === racketTabButton));
      billingLogs.unshift(`운영 ${state.racketTab} 탭 확인`);
      saveSnapshot();
      showToast(`${state.racketTab} 탭 열림`);
    }

    const communityChannelButton = event.target.closest("[data-community-channel]");
    if (communityChannelButton) {
      state.communityChannel = communityChannelButton.dataset.communityChannel;
      $$(".channel-pill[data-community-channel]").forEach((item) => item.classList.toggle("is-active", item === communityChannelButton));
      renderCommunity();
      saveSnapshot();
      showToast(`${state.communityChannel} 채널 열림`);
    }

    const recordFilterButton = event.target.closest("[data-record-filter]");
    if (recordFilterButton) {
      state.recordFilter = recordFilterButton.dataset.recordFilter;
      renderNotes();
      saveSnapshot();
      return;
    }

    const schedulePresetButton = event.target.closest("[data-schedule-preset]");
    if (schedulePresetButton) {
      const message = applySchedulePreset(schedulePresetButton.dataset.schedulePreset);
      renderAll();
      showToast(message);
      return;
    }

    const removeBreakRuleButton = event.target.closest("[data-remove-break-rule]");
    if (removeBreakRuleButton) {
      scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => rule.id !== removeBreakRuleButton.dataset.removeBreakRule);
      renderAll();
      showToast("브레이크타임 삭제 완료");
    }

  });

  const refreshSupabaseStatus = $("#refreshSupabaseStatus");
  if (refreshSupabaseStatus) {
    refreshSupabaseStatus.addEventListener("click", () => {
      loadSupabaseLiveStatus();
      showToast("Supabase 읽기 상태 확인");
    });
  }

  const refreshAuthStatus = $("#refreshAuthStatus");
  if (refreshAuthStatus) {
    refreshAuthStatus.addEventListener("click", () => {
      loadAuthProviderStatus();
      showToast("로그인 제공자 상태 확인");
    });
  }
}

restoreSnapshot();
prepareAdminLiveMode();
resetScheduleEntryState();
window.TennisNoteDataClient?.consumeOAuthRedirect?.();
renderOperationsLoginGate();
organizeAdminTools();
bindEvents();
installAdminLiveScheduleRefresh();
renderAll();
let adminScheduleResizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(adminScheduleResizeTimer);
  adminScheduleResizeTimer = window.setTimeout(() => {
    if (state.view === "schedule") renderSchedule();
  }, 120);
});
syncPopupNoticeFromServer();
loadNotificationPolicyFromServer().then(loadNotificationDeliveryStatus);
loadSupabaseLiveStatus();
loadServerHoldingRequests();
loadServerAccountDeletionRequests();
Promise.all([loadServerHoldingPolicy(), loadRefundPolicySettingsFromServer()])
  .then(loadPolicyVersionsFromServer)
  .then(loadLessonPoliciesFromServer);
loadAuthProviderStatus();
refreshAdminImportAuthState().then(refreshAdminPendingUsers);
hideAdminBrandSplash();
