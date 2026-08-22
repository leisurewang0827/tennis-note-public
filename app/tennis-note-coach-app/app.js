const state = {
  coach: null,
  dataMode: "live",
  liveProfileId: "",
  coachAccessMessage: "",
  coachAccessTone: "wait",
  dashboardVersion: 5,
  editingMakeupId: null,
  coachQuickAdd: null,
  writingLessonId: null,
  memberFilter: "all",
  memberQuery: "",
  memberCoachFilter: "all",
  memberTicketFilter: "all",
  memberPage: 0,
  revealedMemberContactKey: "",
  viewingMemberDetailId: "",
  viewingMemberGroupName: "",
  todayTaskTab: "lessons",
  recordStatusFilter: "pending",
  expandedTodayTasks: {},
  liveLessons: [],
  releasedMakeupSlots: [],
  scheduleOperationDays: [],
  liveLessonsLoaded: false,
  scheduleV2WorkspaceLoaded: false,
  scheduleV2SyncError: "",
  liveMembersLoaded: false,
  scheduleFilter: "mine",
  selectedFullScheduleDay: "",
  curriculumFilter: "all",
  curriculumQuery: "",
  favoriteCurriculums: ["FH-01"],
  viewingCurriculumId: null,
  noticeHiddenDate: "",
  noticeHiddenId: "",
  noticeHiddenIds: [],
  todayLessons: [],
  makeupRequests: [],
  makeupEntitlements: [],
  feedbackRequests: [],
  ntrpRequests: [],
  lessonLogs: [],
  lessonChartDrafts: {},
  members: [],
  branchPermissions: {
    branch: "어린이대공원점",
    schedule: "같은 지점 전체 시간표 공유",
    memberRecords: "같은 지점 회원정보와 수업기록 열람",
    finance: "결제/전체매출/환불은 관리자만",
  },
  proxySettlements: [],
  settlementMonth: "",
  coachSettlement: null,
  coachSettlementLoading: false,
  coachSettlementError: "",
  coachProfiles: {
    "노 코치": {
      intro: "입문 회원이 테니스를 어렵게 느끼지 않도록 기본 자세와 랠리 연결을 차근차근 잡아드립니다.",
      specialty: "입문/초급 랠리 안정화",
      lessonStyle: "쉬운 설명, 반복 루틴, 영상 피드백",
      availableMemo: "평일 저녁 중심",
      memberMessage: "처음이어도 괜찮습니다. 편하게 질문해주세요.",
    },
    "강 코치": {
      intro: "게임을 즐길 수 있도록 풋워크와 실전 연결을 중심으로 수업합니다.",
      specialty: "풋워크, 랠리, 게임 운영",
      lessonStyle: "실전 상황 중심",
      availableMemo: "평일 오후/저녁",
      memberMessage: "목표에 맞춰 수업 강도를 조절해드릴게요.",
    },
    "황 코치": {
      intro: "주말반과 보강 수업에서 빠르게 감을 찾을 수 있도록 핵심만 정리합니다.",
      specialty: "주말반, 보강, 자세 교정",
      lessonStyle: "짧고 명확한 교정",
      availableMemo: "주말 및 대타 가능",
      memberMessage: "수업 전 불편한 부분을 알려주시면 바로 반영하겠습니다.",
    },
  },
  expiredMembers: [],
};

let coachSchedulePreferenceTouched = false;

function coachEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${escapeHtml(options.title || "표시할 내용이 없습니다.")}</p>`;
}

function coachStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || value || "";
}

const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;
let coachOfflineFlushPromise = null;
let coachSyncUiState = "idle";
let coachSyncStatusTimer = 0;
let appToastTimer = 0;

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

const brandSplashStartedAt = performance.now();
const brandSplashMinimumDuration = 150;

function hideCoachBrandSplash() {
  const splash = document.querySelector("#coachBrandSplash");
  if (!splash) return;
  const delay = Math.max(0, brandSplashMinimumDuration - (performance.now() - brandSplashStartedAt));
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
      window.TennisNoteModeTransition?.finish("coach", {
        view: document.body.dataset.activeView || "todayView",
      });
    }, 220);
  }, delay);
}

const legacyCurriculumSteps = [
  {
    id: "FH-01",
    title: "포핸드 연결 안정화",
    level: "초급",
    category: "포핸드",
    focus: "라켓면 고정, 전진 스텝, 짧은 공 처리",
    guide: "다음 수업은 짧은 공 접근 후 크로스 방향 컨트롤을 진행합니다.",
    checklist: "라켓면이 흔들리는지, 전진 스텝 후 몸이 열리는지 확인",
    mission: "짧은 공 10구 중 6구 이상 안정적으로 넘기기",
    notionSource: "Notion · 입문/초급 포핸드 DB",
    notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed",
  },
  {
    id: "BH-R1",
    title: "백핸드 리턴 준비",
    level: "입문",
    category: "백핸드",
    focus: "스플릿 스텝, 어깨 회전, 임팩트 전 준비",
    guide: "다음 수업은 백핸드 리턴 타이밍과 낮은 공 처리를 진행합니다.",
    checklist: "스플릿 스텝 후 어깨가 먼저 돌아가는지 확인",
    mission: "느린 리턴 공을 6구 이상 같은 방향으로 연결",
    notionSource: "Notion · 리턴/백핸드 DB",
    notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8",
  },
  {
    id: "SV-01",
    title: "서브 기본 루틴",
    level: "입문",
    category: "서브",
    focus: "토스 위치, 리듬, 임팩트 후 밸런스",
    guide: "다음 수업은 토스 안정화와 세컨드 서브 루틴을 진행합니다.",
    checklist: "토스 위치, 임팩트 후 밸런스, 마무리 발 위치 확인",
    mission: "토스 10회 중 7회 이상 같은 위치로 올리기",
    notionSource: "Notion · 서브 루틴 DB",
    notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf",
  },
];

const curriculumCatalog = window.TennisNoteCurriculumCatalog || {
  sources: {},
  tracks: [],
  fundamentals: [],
  steps: legacyCurriculumSteps,
  aliases: {},
};
const curriculumSteps = curriculumCatalog.steps?.length ? curriculumCatalog.steps : legacyCurriculumSteps;

const storageKey = "tennis-note-coach-live-v1";
const sharedStorageKey = "tennis-note-shared-live-v1";
const appModePreferenceKey = "tennis-note-app-mode";
const coachPushDeviceStorageKey = "tennis-note-push-device-id";
const coachPushPreferenceStorageKey = "tennis-note-push-enabled-v1";
const coachPushPrimerDeferredStorageKey = "tennis-note-coach-push-primer-deferred-at-v1";
const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];
let coachPushListenersReady = false;
let coachPushProfileId = "";
let coachPushPrimerTimer = 0;
let coachPushPrimerAttempts = 0;
let coachPushUiState = {
  permission: "unknown",
  status: "앱 알림 확인 중",
  detail: "수업 일정과 처리할 기록을 알려드립니다.",
};

function purgeLegacyDemoStorage() {
  legacyDemoStorageKeys.forEach((key) => localStorage.removeItem(key));
}
const adminStorageKey = "tennis-note-admin-demo-v1";
const liveSchedulePolicyKey = "app_schedule_policy";
const serverJournalSchema = "tennisnote-mobile-journal-v1";
const journalMediaBucket = "tennisnote-journal-media";
const coachScheduleLaneWidth = 64;
const defaultCoachNotice = {
  id: "notice-coach-default",
  title: "코치 공지",
  body: "관리자 대시보드에서 등록한 공지가 이곳에 표시됩니다.",
  audience: "coach",
  status: "disabled",
  priority: "normal",
  showOncePerDay: true,
};
const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";
const memberPageSize = 10;
const ntrpLevels = ["측정 전", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0"];
const scheduleDays = ["월", "화", "수", "목", "금", "토", "일"];
const scheduleBlockMinutes = 10;
function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function buildScheduleWeeks() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  return [0, 1, 2].map((offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    return {
      label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
      range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      startDate: localDateKey(start),
      endDate: localDateKey(end),
    };
  });
}

const scheduleWeeks = buildScheduleWeeks();
const coachScheduleMinWeekOffset = -104;
const coachScheduleMaxWeekOffset = 156;

function scheduleWeek(offset = 0) {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  return {
    ...(offset >= 0 ? scheduleWeeks[offset] || {} : {}),
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}

function activeWeekIndex() {
  const offset = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(Number(state.selectedWeekIndex) || 0, coachScheduleMaxWeekOffset),
  );
  state.selectedWeekIndex = offset;
  return offset;
}

function activeScheduleWeek() {
  return scheduleWeek(activeWeekIndex());
}

function coachScheduleV2SyncRange(week = activeScheduleWeek(), today = new Date()) {
  const feedbackCutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const todayKey = localDateKey(today);
  const cutoffKey = localDateKey(feedbackCutoff);
  const candidateFrom = week.startDate > cutoffKey ? cutoffKey : week.startDate;
  const candidateTo = week.endDate < todayKey ? todayKey : week.endDate;
  const spanDays = Math.round((
    new Date(`${candidateTo}T12:00:00`) - new Date(`${candidateFrom}T12:00:00`)
  ) / 86_400_000);
  if (spanDays <= 31) return { startDate: candidateFrom, endDate: candidateTo };
  return { startDate: week.startDate, endDate: week.endDate };
}

function weekLessons() {
  const week = activeWeekIndex();
  if (state.liveLessonsLoaded || state.dataMode === "live") {
    const selectedWeek = activeScheduleWeek();
    return [...state.liveLessons, ...(state.releasedMakeupSlots || [])].filter((lesson) => (
      !lesson.lessonDate
      || (lesson.lessonDate >= selectedWeek.startDate && lesson.lessonDate <= selectedWeek.endDate)
    ));
  }
  const adminLessons = adminLessonsForCoachApp();
  const baseLessons = adminLessons.length
    ? adminLessons.map((lesson) => {
        const stored = state.todayLessons.find((item) => item.id === lesson.id);
        return stored ? { ...lesson, ...stored, coach: lesson.coach, ticket: lesson.ticket, type: lesson.type } : lesson;
      })
    : state.todayLessons;
  if (week === 0) return baseLessons;
  if (week === 1) {
    return [
      ...baseLessons.filter((lesson) => !["lesson-1", "lesson-4"].includes(lesson.id)),
      { id: "week2-change-1", day: "화", time: "18:50", coach: "노 코치", member: "김서준", type: "시간변경", ticket: "개인레슨 10회", status: "변경 완료", remaining: 7, task: "수요일 20:00에서 변경됨", changeNote: "변경 완료" },
      { id: "week2-request-1", day: "금", time: "19:00", coach: "강 코치", member: "이하린", type: "변경요청", ticket: "개인레슨 8회", status: "승인 대기", remaining: 2, task: "기준시간 이내 요청", changeNote: "승인 필요" },
    { id: "week2-change-2", day: "토", time: "20:20", coach: "박창준 코치", member: "임현우", type: "시간변경", ticket: "주말반 8회", status: "변경 완료", remaining: 3, task: "코치 일정 변경", changeNote: "코치 변경" },
    ];
  }
  if (week === 2) {
    return [
      ...baseLessons,
      { id: "week3-request-1", day: "목", time: "19:40", coach: "노 코치", member: "오윤정", type: "변경요청", ticket: "주2회 12회", status: "승인 대기", remaining: 10, task: "회원 요청", changeNote: "승인 필요" },
    ];
  }
  return [];
}

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: shared.lessonLogs || [],
      feedbackRequests: shared.feedbackRequests || [],
      ntrpRequests: shared.ntrpRequests || [],
      makeupRequests: shared.makeupRequests || [],
      notices: shared.notices || [],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    localStorage.removeItem(sharedStorageKey);
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], makeupRequests: [], notices: [], noticeSource: "" };
  }
}

function saveSharedData(shared) {
  localStorage.setItem(sharedStorageKey, JSON.stringify(shared));
}

function normalizeAppNotice(notice = {}) {
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status) ? notice.status : "active";
  return {
    ...defaultCoachNotice,
    ...notice,
    id: notice.id || defaultCoachNotice.id,
    title: notice.title || defaultCoachNotice.title,
    body: notice.body || defaultCoachNotice.body,
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : "coach",
    status: normalizedStatus,
    priority: notice.priority || "normal",
    startDate: notice.startDate || "",
    endDate: notice.endDate || "",
    showOncePerDay: notice.showOncePerDay !== false,
    displayOrder: Math.max(0, Number(notice.displayOrder ?? notice.display_order) || 10),
    imageUrl: String(notice.imageUrl || notice.image_url || "").trim(),
    imageAlt: String(notice.imageAlt || notice.image_alt || "").trim(),
    actionLabel: String(notice.actionLabel || notice.action_label || "").trim(),
    actionUrl: String(notice.actionUrl || notice.action_url || "").trim(),
    updatedAt: notice.updatedAt || "",
  };
}

function activeNoticesForApp(audience = "coach") {
  const today = localDateKey();
  const shared = loadSharedData();
  const source = shared.noticeSource === "server" ? shared.notices : (shared.notices?.length ? shared.notices : [defaultCoachNotice]);
  return source
    .map((notice) => normalizeAppNotice(notice))
    .filter((notice) => (
      notice.status === "active"
      && ["all", audience].includes(notice.audience)
      && (!notice.startDate || notice.startDate <= today)
      && (!notice.endDate || notice.endDate >= today)
    ))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function noticeMetaText(notice = {}) {
  const audienceLabel = notice.audience === "coach" ? "코치용" : notice.audience === "member" ? "회원용" : "회원/코치 공통";
  const priorityLabel = notice.priority === "urgent" ? "긴급" : notice.priority === "important" ? "중요" : "일반";
  return `${audienceLabel} · ${priorityLabel}`;
}

function noticeRowToAppNotice(row = {}) {
  return normalizeAppNotice({
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
    imageAlt: row.image_alt || "",
    actionLabel: row.action_label || "",
    actionUrl: row.action_url || "",
    updatedAt: row.updated_at || row.created_at || "",
  });
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

function parseServerJournalBody(body = "") {
  try {
    const payload = JSON.parse(body || "{}");
    return payload?.schema === serverJournalSchema ? payload : null;
  } catch {
    return null;
  }
}

function serverLessonStatusLabel(status = "") {
  return {
    scheduled: "예정",
    pending_change: "변경 요청",
    completed: "완료",
    cancelled: "취소",
    no_show: "노쇼",
  }[status] || status || "예정";
}

let coachScheduleV2WorkspaceCache = null;
let coachScheduleV2RequestSequence = 0;

function scheduleV2CoachWorkspace() {
  return coachScheduleV2WorkspaceCache?.workspace || null;
}

function scheduleV2LessonKindLabel(kind = "") {
  return {
    regular: "정규",
    makeup: "보강",
    coupon: "쿠폰",
    one_day: "원데이",
    correction: "관리자 보정",
  }[String(kind || "").toLowerCase()] || "수업";
}

function scheduleV2CoachLesson(lesson = {}, workspace = {}) {
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const ticketsById = new Map((workspace.tickets || []).map((ticket) => [ticket.id, ticket]));
  const participants = Array.isArray(lesson.participants) ? lesson.participants : [];
  const primaryTicket = ticketsById.get(participants[0]?.ticketId) || {};
  const laneCoach = coachesById.get(lesson.coachRoleId) || {};
  const substitute = lesson.substitute && lesson.substitute.coachRoleId ? lesson.substitute : null;
  const lessonDate = String(lesson.lessonDate || "");
  const dayIndex = lessonDate ? new Date(`${lessonDate}T00:00:00`).getDay() : 1;
  const durationMinutes = Math.max(10, Number(lesson.durationMinutes) || 20);
  const kind = String(lesson.scheduleKind || "regular");
  const participantDeductions = participants.map((participant) => Number(participant.deductedSessions) || 0);
  const deductedSessions = participantDeductions.length ? Math.max(...participantDeductions) : 0;
  const permissions = lesson.permissions && typeof lesson.permissions === "object" ? lesson.permissions : {};
  return {
    id: `server-${lesson.id}`,
    serverLessonId: lesson.id,
    serverRevision: Number(lesson.revision) || 0,
    lessonDate,
    day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
    time: String(lesson.startTime || "").slice(0, 5),
    coach: substitute?.coachName || laneCoach.name || "담당 코치",
    coachRoleId: lesson.coachRoleId,
    originalCoachRoleId: substitute ? lesson.coachRoleId : "",
    originalCoach: substitute ? (laneCoach.name || "담당 코치") : "",
    isSubstitute: Boolean(substitute),
    substituteCoachRoleId: substitute?.coachRoleId || "",
    substituteSettlementMode: substitute?.settlementMode || "",
    member: participants.map((participant) => participant.name).filter(Boolean).join("&") || "회원",
    memberUserIds: participants.map((participant) => participant.userId).filter(Boolean),
    v2Participants: participants.map((participant) => {
      const ticket = ticketsById.get(participant.ticketId) || {};
      return {
        userId: participant.userId,
        ticketId: participant.ticketId,
        name: participant.name || "회원",
        recordStatus: participant.recordStatus || "",
        outcome: participant.outcome || "",
        deductedSessions: Number(participant.deductedSessions) || 0,
        coachComment: participant.coachComment || "",
        nextCurriculumRefId: participant.nextCurriculumRefId || "",
        nextCurriculumId: participant.nextCurriculumSkillLabel || "",
        nextCurriculumTitle: participant.nextCurriculumTitle || "",
        finalizedAt: participant.finalizedAt || "",
        updatedAt: participant.updatedAt || "",
        ticketName: ticket.productName || `${scheduleV2LessonKindLabel(kind)} 회원권`,
        totalSessions: Number(ticket.totalSessions) || 0,
        usedSessions: Number(ticket.usedSessions) || 0,
        remainingSessions: Number(ticket.remainingSessions) || 0,
      };
    }),
    v2Permissions: {
      canProcess: permissions.canProcess === true,
      canEdit: permissions.canEdit === true,
      isOwnLane: permissions.isOwnLane === true,
      isSubstitute: permissions.isSubstitute === true,
    },
    type: `${scheduleV2LessonKindLabel(kind)} ${durationMinutes}분`,
    lessonSource: kind,
    durationMinutes,
    ticketLessonMinutes: Number(primaryTicket.lessonMinutes) || durationMinutes,
    ticketId: primaryTicket.id || participants[0]?.ticketId || "",
    totalSessions: Number(primaryTicket.totalSessions) || 0,
    usedSessions: Number(primaryTicket.usedSessions) || 0,
    ticket: primaryTicket.productName || `${scheduleV2LessonKindLabel(kind)} 회원권`,
    status: serverLessonStatusLabel(lesson.status),
    serverStatus: lesson.status,
    remaining: Number(primaryTicket.remainingSessions) || 0,
    deductedSessions,
    task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
  };
}

function scheduleV2CoachParticipantResults(lesson = {}) {
  return (lesson.v2Participants || []).map((participant) => ({
    userId: participant.userId,
    ticketId: participant.ticketId,
    name: participant.name,
    ticketName: participant.ticketName,
    totalSessions: participant.totalSessions,
    usedSessions: participant.usedSessions,
    remainingSessions: participant.remainingSessions,
    recordStatus: participant.recordStatus || "",
    coachComment: participant.coachComment || "",
    nextCurriculumId: canonicalCurriculumId(participant.nextCurriculumId),
    finalizedAt: participant.finalizedAt || "",
    updatedAt: participant.updatedAt || "",
    serverCoachComment: participant.coachComment || "",
    serverNextCurriculumId: canonicalCurriculumId(participant.nextCurriculumId),
  }));
}

function mergeScheduleV2CoachParticipantDraft(serverDraft = {}, localDraft = {}, fallback = {}) {
  const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);
  const useFallback = fallback.useFallback === true;
  const hasLocalComment = hasOwn(localDraft, "coachComment") || useFallback;
  const hasLocalCurriculum = hasOwn(localDraft, "nextCurriculumId") || useFallback;
  const localComment = hasOwn(localDraft, "coachComment")
    ? localDraft.coachComment || ""
    : useFallback ? fallback.coachComment || "" : "";
  const localCurriculumId = hasOwn(localDraft, "nextCurriculumId")
    ? localDraft.nextCurriculumId || ""
    : useFallback ? fallback.nextCurriculumId || "" : "";
  const hasPreviousServerComment = hasOwn(localDraft, "serverCoachComment")
    || (useFallback && fallback.hasServerCoachComment === true);
  const hasPreviousServerCurriculum = hasOwn(localDraft, "serverNextCurriculumId")
    || (useFallback && fallback.hasServerNextCurriculumId === true);
  const previousServerComment = hasOwn(localDraft, "serverCoachComment")
    ? localDraft.serverCoachComment || ""
    : useFallback ? fallback.serverCoachComment || "" : "";
  const previousServerCurriculumId = hasOwn(localDraft, "serverNextCurriculumId")
    ? localDraft.serverNextCurriculumId || ""
    : useFallback ? fallback.serverNextCurriculumId || "" : "";
  const serverComment = serverDraft.coachComment || "";
  const serverCurriculumId = canonicalCurriculumId(serverDraft.nextCurriculumId);
  const localCommentChanged = localDraft.localCoachCommentDirty === true
    || (useFallback && fallback.localCoachCommentDirty === true)
    || (hasLocalComment && (
      hasPreviousServerComment
        ? localComment !== previousServerComment
        : Boolean(localComment)
    ));
  const localCurriculumChanged = localDraft.localNextCurriculumDirty === true
    || (useFallback && fallback.localNextCurriculumDirty === true)
    || (hasLocalCurriculum && (
      hasPreviousServerCurriculum
        ? localCurriculumId !== previousServerCurriculumId
        : Boolean(localCurriculumId)
    ));
  const preserveLocalComment = localCommentChanged && localComment !== serverComment;
  const preserveLocalCurriculum = localCurriculumChanged && localCurriculumId !== serverCurriculumId;
  return {
    ...localDraft,
    ...serverDraft,
    coachComment: preserveLocalComment ? localComment : serverComment,
    nextCurriculumId: preserveLocalCurriculum ? localCurriculumId : serverCurriculumId,
    serverCoachComment: serverComment,
    serverNextCurriculumId: serverCurriculumId,
    localCoachCommentDirty: preserveLocalComment,
    localNextCurriculumDirty: preserveLocalCurriculum,
  };
}

function scheduleV2CoachOneDayLesson(booking = {}, workspace = {}) {
  const coach = (workspace.coaches || []).find((item) => item.roleId === booking.coach_role_id) || {};
  const lessonDate = String(booking.booking_date || "");
  const dayIndex = lessonDate ? new Date(`${lessonDate}T00:00:00`).getDay() : 1;
  return {
    id: `one-day-${booking.id}`,
    serverOneDayBookingId: booking.id,
    oneDayBooking: true,
    lessonDate,
    day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
    time: String(booking.start_time || "").slice(0, 5),
    coach: coach.name || "담당 코치",
    coachRoleId: booking.coach_role_id,
    member: booking.guest_name || "원데이",
    memberUserIds: [],
    type: `원데이 ${Number(booking.duration_minutes) || 20}분`,
    lessonSource: "one_day",
    durationMinutes: Number(booking.duration_minutes) || 20,
    ticketLessonMinutes: Number(booking.duration_minutes) || 20,
    ticketId: "",
    totalSessions: 0,
    usedSessions: 0,
    ticket: "원데이",
    status: booking.status === "completed" ? "원데이 완료" : booking.status === "checked_in" ? "방문" : "원데이 예약",
    serverStatus: booking.status,
    remaining: 0,
    task: "원데이 예약",
  };
}

function coachRosterTicketState(ticket = {}, today = localDateKey()) {
  const status = String(ticket.status || "").toLowerCase();
  const startsOn = String(ticket.startsOn || "");
  const expiresOn = String(ticket.expiresOn || "");
  const remaining = Number(ticket.remainingSessions || 0);
  if (["refunded", "cancelled", "voided"].includes(status)) return "expired";
  if (status === "pending_payment" || (startsOn && startsOn > today)) return "paused_pending";
  if (status === "paused") return "paused_pending";
  if (status === "expired" || remaining <= 0 || (expiresOn && expiresOn < today)) return "expired";
  const expiringBoundary = new Date(`${today}T12:00:00`);
  expiringBoundary.setDate(expiringBoundary.getDate() + 14);
  const expiringOn = localDateKey(expiringBoundary);
  if ((expiresOn && expiresOn <= expiringOn) || remaining <= 2) return "expiring";
  return "active";
}

function lessonChangePolicySnapshot(request = {}) {
  return request.policy_snapshot && typeof request.policy_snapshot === "object"
    ? request.policy_snapshot
    : request.policySnapshot && typeof request.policySnapshot === "object" ? request.policySnapshot : null;
}

function lessonChangePolicyText(request = {}) {
  const snapshot = lessonChangePolicySnapshot(request);
  const hours = Math.min(168, Math.max(1, Number(snapshot?.cutoffHours) || 24));
  if (snapshot?.isGroup) return "그룹 전체 · 담당 코치 승인";
  if (snapshot?.outcome === "auto" || request.policy_window === "auto_before_24h") {
    return `${hours}시간 이상 남아 자동 변경`;
  }
  return `${hours}시간 미만 · 담당 코치 승인`;
}

function lessonChangeRequestedAtText(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "신청 시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function lessonChangeRemainingText(originalDate = "", originalTime = "") {
  const lessonAt = new Date(`${originalDate}T${String(originalTime || "").slice(0, 5)}:00+09:00`);
  if (Number.isNaN(lessonAt.getTime())) return "남은 시간 확인 필요";
  const seconds = Math.floor((lessonAt.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "원래 수업 시작 시각 경과";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}시간 ${minutes}분 남음` : `${Math.max(1, minutes)}분 남음`;
}

function applyScheduleV2CoachWorkspace(workspace = {}, oneDayRows = [], roster = null, legacyChangeRequests = []) {
  if (!workspace?.branchId || !Array.isArray(workspace.lessons)) return false;
  const cancelledLessonIds = new Set(
    workspace.lessons
      .filter((lesson) => String(lesson.status || "").toLowerCase() === "cancelled")
      .map((lesson) => String(lesson.id || "").trim())
      .filter(Boolean),
  );
  if (cancelledLessonIds.size) {
    state.lessonLogs = state.lessonLogs.filter((log) => !cancelledLessonIds.has(String(log.serverLessonId || "")));
  }
  state.scheduleOperationDays = Array.isArray(workspace.operationDays) ? workspace.operationDays : [];
  const tickets = Array.isArray(roster?.tickets)
    ? roster.tickets
    : Array.isArray(workspace.tickets) ? workspace.tickets : [];
  const members = Array.isArray(roster?.members)
    ? roster.members
    : Array.isArray(workspace.members) ? workspace.members : [];
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const ticketsByUserId = new Map();
  tickets.forEach((ticket) => {
    (ticket.participantUserIds || [ticket.ownerUserId]).filter(Boolean).forEach((userId) => {
      const current = ticketsByUserId.get(userId) || [];
      current.push(ticket);
      ticketsByUserId.set(userId, current);
    });
  });

  const mappedLessons = workspace.lessons
    .filter((lesson) => lesson.status !== "cancelled")
    .map((lesson) => scheduleV2CoachLesson(lesson, workspace));
  const mappedOneDay = (oneDayRows || [])
    .filter((booking) => ["reserved", "checked_in", "completed"].includes(booking.status))
    .map((booking) => scheduleV2CoachOneDayLesson(booking, workspace));
  const retainedLessons = (state.liveLessons || []).filter((lesson) => (
    lesson.lessonDate
    && (lesson.lessonDate < workspace.from || lesson.lessonDate > workspace.to)
  ));
  state.liveLessons = [...retainedLessons, ...mappedLessons, ...mappedOneDay]
    .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);

  const rawLessonsById = new Map((workspace.lessons || []).map((lesson) => [lesson.id, lesson]));
  const coachesByRoleId = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  state.makeupEntitlements = (workspace.makeupEntitlements || []).map((entitlement) => {
    const sourceLesson = rawLessonsById.get(entitlement.sourceLessonId) || {};
    const bookedLesson = rawLessonsById.get(entitlement.bookedLessonId) || {};
    return {
      id: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      bookedLessonId: entitlement.bookedLessonId || "",
      ticketId: entitlement.ticketId,
      coachRoleId: entitlement.coachRoleId,
      coach: coachesByRoleId.get(entitlement.coachRoleId)?.name || "담당 코치",
      member: entitlement.memberName || "회원",
      durationMinutes: Number(entitlement.durationMinutes) || 20,
      status: entitlement.status,
      reason: entitlement.reason || "회원 사전 불참",
      originalDate: sourceLesson.lessonDate || "",
      originalTime: String(sourceLesson.startTime || "").slice(0, 5),
      original: `${sourceLesson.lessonDate || "기존일"} ${String(sourceLesson.startTime || "").slice(0, 5)}`.trim(),
      bookedDate: bookedLesson.lessonDate || "",
      bookedTime: String(bookedLesson.startTime || "").slice(0, 5),
    };
  });
  const todayIso = localDateKey();
  state.releasedMakeupSlots = state.makeupEntitlements.flatMap((entitlement) => {
    if (!entitlement.originalDate || !entitlement.originalTime) return [];
    const releasedStart = minutesFromTime(entitlement.originalTime);
    const releasedEnd = releasedStart + entitlement.durationMinutes;
    const occupyingLesson = state.liveLessons.find((lesson) => {
      if (lesson.lessonDate !== entitlement.originalDate || lesson.coachRoleId !== entitlement.coachRoleId) return false;
      const lessonStart = minutesFromTime(lesson.time);
      return releasedStart < lessonStart + lessonDuration(lesson) && lessonStart < releasedEnd;
    });
    if (occupyingLesson) {
      occupyingLesson.releasedOriginMember = entitlement.member;
      occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
      return [];
    }
    const dayIndex = new Date(`${entitlement.originalDate}T00:00:00`).getDay();
    const historicalReleasedSlot = entitlement.originalDate < todayIso;
    return [{
      id: `released-${entitlement.id}`,
      releasedMakeupSlot: true,
      historicalReleasedSlot,
      lessonDate: entitlement.originalDate,
      day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
      time: entitlement.originalTime,
      coach: entitlement.coach,
      coachRoleId: entitlement.coachRoleId,
      member: entitlement.member,
      releasedOriginalMember: entitlement.member,
      entitlementId: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      type: historicalReleasedSlot
        ? `정규 · 불참 · 차감 없음 ${entitlement.durationMinutes}분`
        : `정규 · 불참 · 보강·원데이 가능 ${entitlement.durationMinutes}분`,
      lessonSource: "makeup",
      durationMinutes: entitlement.durationMinutes,
      status: "available",
      task: "보강 가능",
    }];
  });

  const latestLessonByUserId = new Map();
  [...mappedLessons]
    .sort((left, right) => `${right.lessonDate || ""} ${right.time || ""}`.localeCompare(`${left.lessonDate || ""} ${left.time || ""}`))
    .forEach((lesson) => {
      (lesson.memberUserIds || []).forEach((userId) => {
        if (!latestLessonByUserId.has(userId)) latestLessonByUserId.set(userId, lesson);
      });
    });
  const ticketStateRank = { expiring: 0, active: 1, paused_pending: 2, expired: 3 };
  const memberRows = members.map((member) => {
    const memberTickets = [...(ticketsByUserId.get(member.id) || [])].sort((left, right) => (
      (ticketStateRank[coachRosterTicketState(left, todayIso)] ?? 9) - (ticketStateRank[coachRosterTicketState(right, todayIso)] ?? 9)
      || String(right.startsOn || "").localeCompare(String(left.startsOn || ""))
    ));
    const ticket = memberTickets[0] || {};
    const coach = (workspace.coaches || []).find((item) => item.roleId === ticket.coachRoleId) || {};
    const latestLesson = latestLessonByUserId.get(member.id);
    const statusCategory = memberTickets.length ? coachRosterTicketState(ticket, todayIso) : "expired";
    const statusLabel = {
      active: "수강중",
      expiring: "만료 임박",
      paused_pending: ticket.status === "paused" ? "휴회" : ticket.status === "pending_payment" ? "결제 대기" : "시작 예정",
      expired: "만료",
    }[statusCategory] || "확인 필요";
    return {
      id: member.id,
      serverUserId: member.id,
      name: member.name || "이름 확인 필요",
      photoUrl: member.photoUrl || "",
      coach: coach.name || "담당 코치 미지정",
      ticket: ticket.productName || `${Number(ticket.totalSessions) || 0}회 회원권`,
      total: Number(ticket.totalSessions) || 0,
      used: Number(ticket.usedSessions) || 0,
      remaining: Number(ticket.remainingSessions) || 0,
      status: statusLabel,
      statusCategory,
      memberTickets,
      ticketCount: memberTickets.length,
      lastLesson: latestLesson ? `${latestLesson.day} ${latestLesson.time}` : "최근 수업 없음",
      expiredAt: ticket.expiresOn || "",
      phone: member.phone || "",
      birthYear: member.birthYear || "",
      neighborhood: member.neighborhood || "",
      gender: member.gender || "",
      selfNtrp: member.selfNtrp ? String(member.selfNtrp) : "-",
      coachNtrp: member.coachNtrp ? String(member.coachNtrp) : "측정 전",
      ntrpRequest: member.ntrpRequestedAt ? (member.coachNtrp ? "완료" : "요청") : "미요청",
      ntrpSurvey: member.ntrpSurvey || {},
      ntrpGoal: member.tennisGoal || "",
      ntrpMemo: member.playStyleMemo || "",
    };
  });
  state.members = memberRows.filter((member) => member.statusCategory !== "expired");
  state.expiredMembers = memberRows.filter((member) => member.statusCategory === "expired");

  const membersById = new Map(members.map((member) => [member.id, member]));
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const scheduleV2Requests = (workspace.requests || []).map((request) => {
    const participant = Array.isArray(request.participants) ? request.participants[0] : null;
    const member = membersById.get(participant?.userId || request.requester_user_id) || {};
    return {
      id: request.id,
      serverRequestId: request.id,
      serverRequestV2: true,
      member: member.name || "회원",
      original: "기존 수업",
      requested: `${request.lesson_date || ""} ${String(request.start_time || "").slice(0, 5)}`.trim(),
      reason: request.note || "이유 미입력",
      policy: "운영 정책에 따른 승인 요청",
      status: "승인 대기",
      coach: coachesById.get(request.coach_role_id)?.name || "담당 코치",
      coachRoleId: request.coach_role_id || "",
      source: "schedule_v2",
      canReview: workspace.actor?.isAdmin === true || request.coach_role_id === workspace.actor?.coachRoleId,
    };
  });
  const requestStatusLabel = {
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "거절",
    auto_approved: "자동 변경 완료",
    cancelled: "회원 취소",
  };
  const legacyRequests = (legacyChangeRequests || [])
    .map((request) => {
      const lesson = state.liveLessons.find((item) => String(item.serverLessonId || "") === String(request.lesson_id || ""));
      if (!lesson || !lessonAssignedToCurrentCoachForTasks(lesson)) return null;
      const originalDate = request.original_lesson_date || lesson.lessonDate || "";
      const originalTime = String(request.original_start_time || lesson.time || "").slice(0, 5);
      return {
        id: request.id,
        serverRequestId: request.id,
        member: lesson.member || "회원",
        original: `${originalDate} ${originalTime}`.trim() || "기존 수업",
        requested: `${request.requested_lesson_date || ""} ${String(request.requested_start_time || "").slice(0, 5)}`.trim(),
        reason: request.reason === "정책상 사유 없음" ? "사유 없음" : request.reason || "이유 미입력",
        policy: lessonChangePolicyText(request),
        policySnapshot: lessonChangePolicySnapshot(request),
        requestedAt: lessonChangeRequestedAtText(request.created_at),
        remainingTime: lessonChangeRemainingText(originalDate, originalTime),
        status: requestStatusLabel[request.status] || request.status,
        coach: lesson.coach || "담당 코치",
        coachRoleId: lesson.coachRoleId || "",
        source: "server",
        canReview: request.status === "pending",
      };
    })
    .filter(Boolean);
  state.makeupRequests = [...legacyRequests, ...scheduleV2Requests];

  const today = localDateKey();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoff = localDateKey(cutoffDate);
  mappedLessons
    .filter((lesson) => (
      lesson.lessonDate >= cutoff
      && lesson.lessonDate <= today
      && lesson.v2Permissions?.canProcess
      && lesson.v2Participants?.length
      && lesson.v2Participants.every((participant) => participant.recordStatus === "final")
    ))
    .forEach((lesson) => {
      const participantResults = scheduleV2CoachParticipantResults(lesson);
      const primaryResult = participantResults[0] || {};
      const completedAt = participantResults
        .map((result) => result.finalizedAt || result.updatedAt || "")
        .filter(Boolean)
        .sort((left, right) => String(right).localeCompare(String(left)))[0] || "";
      const existingLog = state.lessonLogs.find((log) => log.serverLessonId === lesson.serverLessonId);
      const completedFields = {
        serverLessonId: lesson.serverLessonId,
        member: lesson.member,
        lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
        coachComment: primaryResult.coachComment || "",
        nextCurriculumId: primaryResult.nextCurriculumId || "",
        participantResults,
        serverCoachComment: primaryResult.coachComment || "",
        serverNextCurriculumId: primaryResult.nextCurriculumId || "",
        localCoachCommentDirty: false,
        localNextCurriculumDirty: false,
        status: "확인 완료",
        curriculumRegistered: Boolean(primaryResult.nextCurriculumId),
        ticketDeducted: lesson.deductedSessions > 0,
        completedAt,
      };
      if (existingLog) Object.assign(existingLog, completedFields);
      else state.lessonLogs.unshift({
        id: `schedule-v2-completed-${lesson.serverLessonId}`,
        serverJournalId: "",
        content: "관리자 또는 코치가 수업 피드백을 완료했습니다.",
        selfMemo: "서버에 저장된 참여자별 완료 피드백입니다.",
        mediaNames: [],
        mediaItems: [],
        curriculumId: primaryResult.nextCurriculumId || "",
        validationMessage: "",
        ...completedFields,
      });
    });
  mappedLessons
    .filter((lesson) => (
      lesson.serverStatus === "scheduled"
      && lesson.lessonDate >= cutoff
      && lesson.lessonDate <= today
      && lesson.v2Permissions?.canProcess
      && !lesson.v2Participants?.every((participant) => participant.recordStatus === "final")
    ))
    .forEach((lesson) => {
      const serverParticipantDrafts = scheduleV2CoachParticipantResults(lesson);
      const hasServerFeedbackDraft = serverParticipantDrafts.some((result) => (
        result.recordStatus === "draft"
        || Boolean(result.coachComment)
        || Boolean(result.nextCurriculumId)
      ));
      const existingLog = state.lessonLogs.find((log) => log.serverLessonId === lesson.serverLessonId);
      if (existingLog) {
        const existingParticipantDrafts = Array.isArray(existingLog.participantResults)
          ? existingLog.participantResults
          : [];
        const localDrafts = new Map(existingParticipantDrafts.map((result) => [
          `${result.userId || ""}:${result.ticketId || ""}`,
          result,
        ]));
        const shouldUseParticipantDrafts = hasServerFeedbackDraft
          || existingParticipantDrafts.length > 0
          || serverParticipantDrafts.length > 1;
        if (shouldUseParticipantDrafts) {
          existingLog.participantResults = serverParticipantDrafts.map((serverDraft, index) => {
            const localDraft = localDrafts.get(`${serverDraft.userId}:${serverDraft.ticketId}`) || {};
            return mergeScheduleV2CoachParticipantDraft(serverDraft, localDraft, {
              useFallback: index === 0,
              coachComment: existingLog.coachComment || "",
              nextCurriculumId: existingLog.nextCurriculumId || "",
              hasServerCoachComment: Object.prototype.hasOwnProperty.call(existingLog, "serverCoachComment"),
              hasServerNextCurriculumId: Object.prototype.hasOwnProperty.call(existingLog, "serverNextCurriculumId"),
              serverCoachComment: existingLog.serverCoachComment || "",
              serverNextCurriculumId: existingLog.serverNextCurriculumId || "",
              localCoachCommentDirty: existingLog.localCoachCommentDirty === true,
              localNextCurriculumDirty: existingLog.localNextCurriculumDirty === true,
            });
          });
          const primaryDraft = existingLog.participantResults[0] || {};
          existingLog.coachComment = primaryDraft.coachComment || "";
          existingLog.nextCurriculumId = primaryDraft.nextCurriculumId || "";
          existingLog.serverCoachComment = primaryDraft.serverCoachComment || "";
          existingLog.serverNextCurriculumId = primaryDraft.serverNextCurriculumId || "";
          existingLog.localCoachCommentDirty = primaryDraft.localCoachCommentDirty === true;
          existingLog.localNextCurriculumDirty = primaryDraft.localNextCurriculumDirty === true;
        } else {
          const primaryDraft = mergeScheduleV2CoachParticipantDraft(serverParticipantDrafts[0] || {}, {}, {
            useFallback: true,
            coachComment: existingLog.coachComment || "",
            nextCurriculumId: existingLog.nextCurriculumId || "",
            hasServerCoachComment: Object.prototype.hasOwnProperty.call(existingLog, "serverCoachComment"),
            hasServerNextCurriculumId: Object.prototype.hasOwnProperty.call(existingLog, "serverNextCurriculumId"),
            serverCoachComment: existingLog.serverCoachComment || "",
            serverNextCurriculumId: existingLog.serverNextCurriculumId || "",
            localCoachCommentDirty: existingLog.localCoachCommentDirty === true,
            localNextCurriculumDirty: existingLog.localNextCurriculumDirty === true,
          });
          existingLog.coachComment = primaryDraft.coachComment || "";
          existingLog.nextCurriculumId = primaryDraft.nextCurriculumId || "";
          existingLog.serverCoachComment = primaryDraft.serverCoachComment || "";
          existingLog.serverNextCurriculumId = primaryDraft.serverNextCurriculumId || "";
          existingLog.localCoachCommentDirty = primaryDraft.localCoachCommentDirty === true;
          existingLog.localNextCurriculumDirty = primaryDraft.localNextCurriculumDirty === true;
        }
        existingLog.member = lesson.member;
        existingLog.lesson = `${lesson.day} ${lesson.time} · ${lesson.type}`;
        if (existingLog.status === "확인 완료") existingLog.status = "확인 대기";
        existingLog.curriculumRegistered = false;
        existingLog.ticketDeducted = false;
        existingLog.serverDeducted = false;
        existingLog.serverDeductionIdempotent = false;
        existingLog.deductedSessions = Number(lesson.deductedSessions) || 0;
        existingLog.completedAt = "";
        existingLog.memberVisibleSummary = "";
        return;
      }
      const primaryDraft = serverParticipantDrafts[0] || {};
      const serverDraftFields = hasServerFeedbackDraft
        ? { participantResults: serverParticipantDrafts }
        : {};
      state.lessonLogs.unshift({
        id: `schedule-v2-lesson-${lesson.serverLessonId}`,
        serverJournalId: "",
        serverLessonId: lesson.serverLessonId,
        member: lesson.member,
        lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
        content: "회원 운동일지 미작성 · 코치 기록으로 수업 완료 가능",
        selfMemo: "코치 코멘트와 다음 커리큘럼을 등록하면 정확한 회원권으로 차감됩니다.",
        mediaNames: [],
        mediaItems: [],
        curriculumId: "FH-01",
        nextCurriculumId: hasServerFeedbackDraft ? (primaryDraft.nextCurriculumId || "") : "FH-01",
        coachComment: hasServerFeedbackDraft ? (primaryDraft.coachComment || "") : "",
        serverCoachComment: primaryDraft.coachComment || "",
        serverNextCurriculumId: primaryDraft.nextCurriculumId || "",
        localCoachCommentDirty: false,
        localNextCurriculumDirty: false,
        ...serverDraftFields,
        validationMessage: "",
        status: "확인 대기",
        curriculumRegistered: false,
      });
    });
  state.liveMembersLoaded = true;
  state.liveLessonsLoaded = true;
  state.scheduleV2WorkspaceLoaded = true;
  state.scheduleV2SyncError = "";
  void coachScheduleRevisionWatcher?.check?.();
  return true;
}

async function syncCoachScheduleV2(options = {}) {
  const client = window.TennisNoteDataClient;
  const requestId = ++coachScheduleV2RequestSequence;
  const branchId = state.coach?.branchId || "";
  if (!client?.rpc || !client.getSession?.()?.access_token || !branchId) return false;
  const week = activeScheduleWeek();
  const syncRange = coachScheduleV2SyncRange(week);
  const cacheKey = `${branchId}:${syncRange.startDate}:${syncRange.endDate}`;
  const cached = coachScheduleV2WorkspaceCache;
  if (!options.force && cached?.key === cacheKey && Date.now() - cached.loadedAt < 10_000) {
    return applyScheduleV2CoachWorkspace(cached.workspace, cached.oneDayRows, cached.roster, cached.legacyChangeRequests);
  }
  try {
    const [workspace, oneDayRows, roster, operationDays, legacyChangeRequests] = await Promise.all([
      client.rpc("tn_schedule_v2_coach_workspace", {
        target_branch_id: branchId,
        target_from: syncRange.startDate,
        target_to: syncRange.endDate,
      }),
      client.rpc("tn_visible_one_day_bookings", {}).catch(() => []),
      client.rpc("tn_schedule_v2_coach_member_roster", {
        target_branch_id: branchId,
      }).catch(() => null),
      client.rpc("tn_schedule_v2_operation_days_between", {
        target_branch_id: branchId,
        target_from: week.startDate,
        target_to: week.endDate,
      }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at,updated_at",
        filters: { status: "pending" },
        order: "created_at.desc",
        limit: 300,
      }).catch(() => client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at",
        filters: { status: "pending" },
        order: "created_at.desc",
        limit: 300,
      }).catch(() => [])),
    ]);
    if (requestId !== coachScheduleV2RequestSequence) return false;
    if (!workspace?.branchId || !Array.isArray(workspace.lessons)) return false;
    workspace.operationDays = Array.isArray(operationDays) ? operationDays : [];
    coachScheduleV2WorkspaceCache = {
      key: cacheKey,
      loadedAt: Date.now(),
      workspace,
      oneDayRows: Array.isArray(oneDayRows) ? oneDayRows : [],
      roster,
      legacyChangeRequests: Array.isArray(legacyChangeRequests) ? legacyChangeRequests : [],
    };
    return applyScheduleV2CoachWorkspace(
      workspace,
      coachScheduleV2WorkspaceCache.oneDayRows,
      roster,
      coachScheduleV2WorkspaceCache.legacyChangeRequests,
    );
  } catch (error) {
    const text = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_schedule_v2_coach_workspace|PGRST202|42883|schema cache/i.test(text)) {
      console.warn("Tennis Note Schedule V2 coach feed failed; using the compatible feed.", error);
    }
    return false;
  }
}

async function syncCoachSchedulePreview() {
  if (await syncCoachScheduleV2()) {
    state.scheduleV2SyncError = "";
    return true;
  }
  return false;
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
async function syncLegacyCoachSchedulePreview() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  if (await syncCoachScheduleV2()) return true;
  const selectedWeek = activeScheduleWeek();
  const payload = await client.rpc("tn_coach_schedule_feed", {
    target_start_date: selectedWeek.startDate,
    target_end_date: selectedWeek.endDate,
  });
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.lessons)
      ? payload.lessons
      : [];
  if (!rows.length) return false;
  const oneDayLessons = state.liveLessons.filter((lesson) => lesson.oneDayBooking);
  state.liveLessons = [
    ...rows
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const dayIndex = new Date(`${lesson.lesson_date}T00:00:00`).getDay();
        const participantIds = Array.isArray(lesson.participant_user_ids) ? lesson.participant_user_ids : [];
        const memberNames = Array.isArray(lesson.participant_names) ? lesson.participant_names : [];
        const groupSize = Number(lesson.product_group_size) || participantIds.length || 1;
        return {
          id: lesson.id,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: lesson.coach_name || "담당 코치",
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          originalCoach: lesson.original_coach_name || "",
          isSubstitute: Boolean(lesson.original_coach_role_id && lesson.original_coach_role_id !== lesson.coach_role_id),
          member: memberNames.join("&") || "회원",
          memberUserIds: participantIds,
          type: `${groupSize > 1 ? "2대1" : "개인"} ${Number(lesson.duration_minutes) || 20}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketLessonMinutes: Number(lesson.product_lesson_minutes) || Number(lesson.duration_minutes) || 20,
          ticketId: lesson.member_ticket_id || "",
          totalSessions: Number(lesson.ticket_total_sessions) || 0,
          usedSessions: Number(lesson.ticket_used_sessions) || 0,
          ticket: `${groupSize > 1 ? "2대1" : "개인"} ${lesson.ticket_total_sessions || ""}회`.replace("  회", ""),
          status: serverLessonStatusLabel(lesson.status),
          serverStatus: lesson.status,
          remaining: Number(lesson.ticket_remaining_sessions) || 0,
          task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
        };
      }),
    ...oneDayLessons,
  ];
  state.liveLessonsLoaded = true;
  return true;
}

async function syncCoachLessonsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc) return false;
  const activeSession = client.ensureSession
    ? await client.ensureSession().catch(() => client.getSession?.())
    : client.getSession?.();
  if (!activeSession?.access_token || !state.coach?.branchId) return false;
  if (await syncCoachScheduleV2({ force: true })) return true;
  // Keep the last confirmed schedule and member cache during a transient read
  // failure. The visible error and retry action explain that it may be stale.
  state.liveLessonsLoaded = true;
  state.liveMembersLoaded = true;
  state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
  return false;
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
async function syncLegacyCoachLessonsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  try {
    const activeSession = client.ensureSession
      ? await client.ensureSession().catch(() => client.getSession?.())
      : client.getSession?.();
    if (!activeSession?.access_token) return false;
    const currentProfile = client.selectCurrentProfile
      ? await client.selectCurrentProfile().catch(() => null)
      : null;
    if (state.coach?.branchId && await syncCoachScheduleV2()) return true;
    const scheduleRangeStart = new Date();
    scheduleRangeStart.setDate(scheduleRangeStart.getDate() - 31);
    const scheduleRangeEnd = new Date();
    scheduleRangeEnd.setDate(scheduleRangeEnd.getDate() + 370);
    let scheduleFeedError = null;
    const [scheduleFeedPayload, scheduleRows, participantRows, userRows, coachRows, ticketRows, productRows, recordRows, changeRequestRows, makeupEntitlementRows, oneDayBookingRows] = await Promise.all([
      client.rpc
        ? client.rpc("tn_coach_schedule_feed", {
          target_start_date: localDateKey(scheduleRangeStart),
          target_end_date: localDateKey(scheduleRangeEnd),
        }).catch((error) => {
          scheduleFeedError = error;
          return [];
        })
        : Promise.resolve([]),
      client.selectRows("tn_lessons", {
        select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
        limit: 1000,
      }).catch((error) => {
        console.warn("Tennis Note coach full schedule read failed; retrying with the signed-in coach scope.", error);
        return [];
      }),
      client.selectRows("tn_lesson_participants", {
        select: "lesson_id,user_id,ticket_id",
        limit: 2000,
      }).catch(() => []),
      client.selectRows("tn_user_directory_safe", { select: "id,name,phone,birth_year,neighborhood,gender,role,member_kind,status,profile_photo_url,self_ntrp,coach_ntrp,ntrp_requested_at,ntrp_survey,tennis_goal,play_style_memo", limit: 1000 }).catch(() => []),
      client.selectRows("tn_coach_roles", { select: "id,display_name,color,status,employment_status,archived_at,deleted_at", limit: 100 }).catch(() => []),
      client.selectRows("tn_member_tickets", { select: "id,user_id,product_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,created_at", limit: 1000 }).catch(() => []),
      client.selectRows("tn_membership_products", { select: "id,name,group_size,lesson_minutes", limit: 200 }).catch(() => []),
      client.selectRows("tn_lesson_records", { select: "lesson_id,deducted_sessions,completed_at", limit: 1000 }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,policy_snapshot,policy_revision,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at,updated_at",
        limit: 300,
      }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", {
        select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at",
        limit: 300,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_visible_one_day_bookings", {}).catch(() => [])
        : Promise.resolve([]),
    ]);
    let scheduleFeedRows = Array.isArray(scheduleFeedPayload)
      ? scheduleFeedPayload
      : Array.isArray(scheduleFeedPayload?.lessons)
        ? scheduleFeedPayload.lessons
        : [];
    if (!scheduleFeedRows.length && currentProfile?.coachRole?.id && client.rpc) {
      scheduleFeedRows = await client.rpc("tn_coach_schedule_feed", {
        target_start_date: localDateKey(scheduleRangeStart),
        target_end_date: localDateKey(scheduleRangeEnd),
      }).then((payload) => (
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.lessons)
            ? payload.lessons
            : []
      )).catch((error) => {
        scheduleFeedError = error;
        return [];
      });
    }
    if (scheduleFeedError && !scheduleFeedRows.length) {
      console.warn("Tennis Note coach schedule feed failed after profile confirmation.", scheduleFeedError);
    }
    const currentCoachRoleId = currentProfile?.coachRole?.id || "";
    const currentCoachRows = currentCoachRoleId
      ? (await Promise.all([
        client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
          filters: { coach_role_id: currentCoachRoleId },
          limit: 1000,
        }).catch(() => []),
        client.selectRows("tn_lessons", {
          select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
          filters: { original_coach_role_id: currentCoachRoleId },
          limit: 1000,
        }).catch(() => []),
      ])).flat()
      : [];
    const directLessonRows = [...(scheduleRows || []), ...currentCoachRows]
      .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
    const lessonRows = Array.isArray(scheduleFeedRows) && scheduleFeedRows.length
      ? scheduleFeedRows
      : directLessonRows;
    const usersById = new Map((userRows || []).map((user) => [user.id, user.name]));
    const coachesById = new Map((coachRows || [])
      .filter((coach) => (
        coach.status === "approved"
        && (coach.employment_status || "active") === "active"
        && !coach.archived_at
        && !coach.deleted_at
      ))
      .map((coach) => [coach.id, coach]));
    if (currentProfile?.coachRole?.id && !coachesById.has(currentProfile.coachRole.id)) {
      coachesById.set(currentProfile.coachRole.id, currentProfile.coachRole);
    }
    const ticketsById = new Map((ticketRows || []).map((ticket) => [ticket.id, ticket]));
    const productsById = new Map((productRows || []).map((product) => [product.id, product]));
    const participantIdsByLesson = new Map();
    (participantRows || []).forEach((participant) => {
      if (!participantIdsByLesson.has(participant.lesson_id)) participantIdsByLesson.set(participant.lesson_id, []);
      participantIdsByLesson.get(participant.lesson_id).push(participant.user_id);
    });
    const recordsByLessonId = new Map((recordRows || []).map((record) => [record.lesson_id, record]));
    const completedLessonIds = new Set(recordsByLessonId.keys());

    const mappedLessons = (lessonRows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const feedParticipantIds = Array.isArray(lesson.participant_user_ids) ? lesson.participant_user_ids : [];
        const feedParticipantNames = Array.isArray(lesson.participant_names) ? lesson.participant_names : [];
        const participantIds = feedParticipantIds.length ? feedParticipantIds : (participantIdsByLesson.get(lesson.id) || []);
        const memberNames = feedParticipantNames.length
          ? feedParticipantNames
          : participantIds.map((userId) => usersById.get(userId)).filter(Boolean);
        const ticket = ticketsById.get(lesson.member_ticket_id) || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(lesson.coach_role_id) || {};
        const originalCoach = coachesById.get(lesson.original_coach_role_id) || {};
        const isSubstitute = Boolean(lesson.original_coach_role_id && lesson.original_coach_role_id !== lesson.coach_role_id);
        const lessonRecord = recordsByLessonId.get(lesson.id);
        const lessonKind = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "코치변경"
              : "정규";
        const dayIndex = new Date(`${lesson.lesson_date}T00:00:00`).getDay();
        return {
          id: `server-${lesson.id}`,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: lesson.coach_name || coach.display_name || "담당 코치",
          coachRoleId: lesson.coach_role_id,
          originalCoachRoleId: lesson.original_coach_role_id || "",
          originalCoach: lesson.original_coach_name || originalCoach.display_name || "",
          isSubstitute,
          member: memberNames.join("&") || "회원",
          memberUserIds: participantIds,
          type: `${lessonKind} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketLessonMinutes: Number(lesson.product_lesson_minutes) || Number(product.lesson_minutes) || Number(lesson.duration_minutes) || 20,
          ticketId: lesson.member_ticket_id || "",
          totalSessions: Number(lesson.ticket_total_sessions ?? ticket.total_sessions) || 0,
          usedSessions: Number(lesson.ticket_used_sessions ?? ticket.used_sessions) || 0,
          ticket: `${Number(lesson.product_group_size ?? product.group_size) > 1 || participantIds.length > 1 ? "2대1" : "개인"} ${lesson.ticket_total_sessions ?? ticket.total_sessions ?? ""}회`.replace("  회", ""),
          status: serverLessonStatusLabel(lesson.status),
          serverStatus: lesson.status,
          remaining: Number(lesson.ticket_remaining_sessions ?? ticket.remaining_sessions) || 0,
          deductedSessions: lessonRecord ? Number(lessonRecord.deducted_sessions) || 0 : null,
          completedAt: lessonRecord?.completed_at || "",
          task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
        };
      });
    const oneDayLessons = (oneDayBookingRows || [])
      .filter((booking) => ["reserved", "checked_in", "completed"].includes(booking.status))
      .map((booking) => {
        const dayIndex = new Date(`${booking.booking_date}T00:00:00`).getDay();
        const coach = coachesById.get(booking.coach_role_id) || {};
        const bookingStatus = booking.status === "completed"
          ? "원데이 완료"
          : booking.status === "checked_in"
            ? "방문"
            : "원데이 예약";
        return {
          id: `one-day-${booking.id}`,
          serverOneDayBookingId: booking.id,
          oneDayBooking: true,
          lessonDate: booking.booking_date,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: String(booking.start_time || "").slice(0, 5),
          coach: coach.display_name || "담당 코치",
          coachRoleId: booking.coach_role_id,
          member: booking.guest_name || "원데이",
          memberUserIds: [],
          type: `원데이 ${booking.duration_minutes}분`,
          lessonSource: "one_day",
          durationMinutes: Number(booking.duration_minutes) || 20,
          ticketLessonMinutes: Number(booking.duration_minutes) || 20,
          ticketId: "",
          totalSessions: 0,
          usedSessions: 0,
          ticket: "원데이",
          status: bookingStatus,
          serverStatus: booking.status,
          remaining: 0,
          task: "원데이 예약",
        };
      });
    state.liveLessons = [...mappedLessons, ...oneDayLessons];

    const lessonRowsById = new Map((lessonRows || []).map((lesson) => [lesson.id, lesson]));
    state.makeupEntitlements = (makeupEntitlementRows || []).map((entitlement) => {
      const sourceLesson = lessonRowsById.get(entitlement.source_lesson_id) || {};
      const participantIds = participantIdsByLesson.get(entitlement.source_lesson_id) || [];
      const memberNames = participantIds.map((userId) => usersById.get(userId)).filter(Boolean);
      const coach = coachesById.get(entitlement.coach_role_id) || {};
      const bookedLesson = lessonRowsById.get(entitlement.booked_lesson_id) || {};
      return {
        id: entitlement.id,
        sourceLessonId: entitlement.source_lesson_id,
        bookedLessonId: entitlement.booked_lesson_id || "",
        ticketId: entitlement.ticket_id,
        coachRoleId: entitlement.coach_role_id,
        coach: coach.display_name || "담당 코치",
        member: memberNames.join("&") || "회원",
        durationMinutes: Number(entitlement.duration_minutes) || 20,
        status: entitlement.status,
        reason: entitlement.reason || "회원 사전 불참",
        originalDate: sourceLesson.lesson_date || "",
        originalTime: String(sourceLesson.start_time || "").slice(0, 5),
        original: `${sourceLesson.lesson_date || "기존일"} ${String(sourceLesson.start_time || "").slice(0, 5)}`.trim(),
        bookedDate: bookedLesson.lesson_date || "",
        bookedTime: String(bookedLesson.start_time || "").slice(0, 5),
      };
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    state.releasedMakeupSlots = state.makeupEntitlements
      .flatMap((entitlement) => {
        const sourceLesson = lessonRowsById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return [];
        if (!entitlement.originalDate || !entitlement.originalTime) return [];
        const releasedStart = minutesFromTime(entitlement.originalTime);
        const releasedEnd = releasedStart + entitlement.durationMinutes;
        const occupyingLesson = state.liveLessons.find((lesson) => {
          if (lesson.lessonDate !== entitlement.originalDate || lesson.coachRoleId !== entitlement.coachRoleId) return false;
          const lessonStart = minutesFromTime(lesson.time);
          return releasedStart < lessonStart + lessonDuration(lesson) && lessonStart < releasedEnd;
        });
        if (occupyingLesson) {
          occupyingLesson.releasedOriginMember = entitlement.member;
          occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
          return [];
        }
        const dayIndex = new Date(`${entitlement.originalDate}T00:00:00`).getDay();
        const historicalReleasedSlot = entitlement.originalDate < todayIso;
        return [{
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          historicalReleasedSlot,
          lessonDate: entitlement.originalDate,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: entitlement.originalTime,
          coach: entitlement.coach,
          coachRoleId: entitlement.coachRoleId,
          member: entitlement.member,
          releasedOriginalMember: entitlement.member,
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          type: historicalReleasedSlot
            ? `정규 · 불참 · 차감 없음 ${entitlement.durationMinutes}분`
            : `정규 · 불참 · 보강·원데이 가능 ${entitlement.durationMinutes}분`,
          lessonSource: "makeup",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          task: "보강 가능",
        }];
      });

    const ticketIdsByUser = new Map();
    (ticketRows || []).forEach((ticket) => {
      if (!ticket.user_id) return;
      const ids = ticketIdsByUser.get(ticket.user_id) || [];
      ids.push(ticket.id);
      ticketIdsByUser.set(ticket.user_id, ids);
    });
    (participantRows || []).forEach((participant) => {
      if (!participant.user_id || !participant.ticket_id) return;
      const ids = ticketIdsByUser.get(participant.user_id) || [];
      if (!ids.includes(participant.ticket_id)) ids.push(participant.ticket_id);
      ticketIdsByUser.set(participant.user_id, ids);
    });

    const latestLessonByUser = new Map();
    [...state.liveLessons]
      .sort((left, right) => `${right.lessonDate || ""} ${right.time || ""}`.localeCompare(`${left.lessonDate || ""} ${left.time || ""}`))
      .forEach((lesson) => {
        (lesson.memberUserIds || []).forEach((userId) => {
          if (!latestLessonByUser.has(userId)) latestLessonByUser.set(userId, lesson);
        });
      });

    const ticketRank = { active: 0, paused: 1, pending_payment: 2, expired: 3, refunded: 4 };
    const memberRows = (userRows || [])
      .filter((user) => ticketIdsByUser.has(user.id))
      .map((user) => {
        const userTickets = (ticketIdsByUser.get(user.id) || [])
          .map((ticketId) => ticketsById.get(ticketId))
          .filter(Boolean)
          .sort((left, right) => {
            const rank = (ticketRank[left.status] ?? 9) - (ticketRank[right.status] ?? 9);
            return rank || String(right.created_at || "").localeCompare(String(left.created_at || ""));
          });
        const ticketGroups = window.TennisNoteTicketState?.split
          ? window.TennisNoteTicketState.split(userTickets)
          : { current: userTickets.filter((item) => ["active", "paused"].includes(item.status)), upcoming: [] };
        const ticket = ticketGroups.current[0] || ticketGroups.upcoming[0] || userTickets[0] || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(ticket.coach_role_id) || {};
        const latestLesson = latestLessonByUser.get(user.id);
        const isActive = ticketGroups.current.length > 0;
        return {
          id: user.id,
          serverUserId: user.id,
          name: user.name || "이름 확인 필요",
          photoUrl: user.profile_photo_url || "",
          coach: coach.display_name || "담당 코치 미지정",
          ticket: product.name || `${ticket.total_sessions || 0}회 회원권`,
          total: Number(ticket.total_sessions) || 0,
          used: Number(ticket.used_sessions) || 0,
          remaining: Number(ticket.remaining_sessions) || 0,
          status: isActive ? "수강중" : "회원권 마감",
          lastLesson: latestLesson ? `${latestLesson.day} ${latestLesson.time}` : "최근 수업 없음",
          expiredAt: ticket.expires_on || "",
          phone: user.phone || "",
          birthYear: user.birth_year || "",
          neighborhood: user.neighborhood || "",
          gender: user.gender || "",
          selfNtrp: user.self_ntrp ? String(user.self_ntrp) : "-",
          coachNtrp: user.coach_ntrp ? String(user.coach_ntrp) : "측정 전",
          ntrpRequest: user.ntrp_requested_at ? (user.coach_ntrp ? "완료" : "요청") : "미요청",
          ntrpSurvey: user.ntrp_survey || {},
          ntrpGoal: user.tennis_goal || "",
          ntrpMemo: user.play_style_memo || "",
        };
      });
    state.members = memberRows.filter((member) => member.status === "수강중");
    state.expiredMembers = memberRows.filter((member) => member.status !== "수강중");
    state.liveMembersLoaded = true;
    state.liveLessonsLoaded = true;

    const requestStatusLabel = {
      pending: "승인 대기",
      approved: "승인 완료",
      rejected: "거절",
      auto_approved: "자동 변경 완료",
      cancelled: "회원 취소",
    };
    state.makeupRequests = (changeRequestRows || [])
      .filter((request) => request.status === "pending")
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((request) => {
        const lesson = state.liveLessons.find((item) => item.serverLessonId === request.lesson_id) || {};
        if (!lessonAssignedToCurrentCoachForTasks(lesson)) return null;
        const originalDate = request.original_lesson_date || lesson.lessonDate || "";
        const originalTime = String(request.original_start_time || lesson.time || "").slice(0, 5);
        return {
          id: request.id,
          serverRequestId: request.id,
          member: usersById.get(request.requester_user_id) || lesson.member || "회원",
          original: `${originalDate} ${originalTime}`.trim() || "기존 수업",
          requested: `${request.requested_lesson_date || ""} ${String(request.requested_start_time || "").slice(0, 5)}`.trim(),
          reason: request.reason === "정책상 사유 없음" ? "사유 없음" : request.reason || "이유 미입력",
          policy: lessonChangePolicyText(request),
          policySnapshot: lessonChangePolicySnapshot(request),
          requestedAt: lessonChangeRequestedAtText(request.created_at),
          remainingTime: lessonChangeRemainingText(originalDate, originalTime),
          status: requestStatusLabel[request.status] || request.status,
          coach: lesson.coach || "담당 코치",
          source: "server",
          canReview: true,
        };
      })
      .filter(Boolean);

    const today = localDateKey();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoff = localDateKey(cutoffDate);
    state.liveLessons
      .filter((lesson) => lesson.serverStatus === "scheduled" && lesson.lessonDate >= cutoff && lesson.lessonDate <= today && !completedLessonIds.has(lesson.serverLessonId))
      .forEach((lesson) => {
        if (state.lessonLogs.some((log) => log.serverLessonId === lesson.serverLessonId)) return;
        state.lessonLogs.unshift({
          id: `server-lesson-${lesson.serverLessonId}`,
          serverJournalId: "",
          serverLessonId: lesson.serverLessonId,
          member: lesson.member,
          lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
          content: "회원 운동일지 미작성 · 코치 기록으로 수업 완료 가능",
          selfMemo: "회원 일지와 관계없이 코치 코멘트와 다음 커리큘럼을 등록하면 횟수가 차감됩니다.",
          mediaNames: [],
          mediaItems: [],
          curriculumId: "FH-01",
          nextCurriculumId: "FH-01",
          coachComment: "",
          validationMessage: "",
          status: "확인 대기",
          curriculumRegistered: false,
        });
      });
    return true;
  } catch (error) {
    console.warn("Tennis Note coach lesson sync failed", error);
    // Keep the last confirmed schedule visible during transient network or permission failures.
    return false;
  }
}

async function downloadCoachJournalMedia(client, row, displayName) {
  const blob = await client.downloadObject(journalMediaBucket, row.storage_path);
  return {
    name: displayName || "첨부파일",
    type: row.media_type === "video" ? (blob.type || "video/mp4") : (blob.type || "image/jpeg"),
    url: URL.createObjectURL(blob),
    storagePath: row.storage_path,
  };
}

async function syncCoachJournalEntriesFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const [journalRows, recordRows, userRows, mediaRows] = await Promise.all([
      client.selectRows("tn_journal_entries", {
        select: "id,user_id,lesson_id,entry_date,entry_type,body,created_at,updated_at",
        limit: 100,
      }),
      client.selectRows("tn_lesson_records", {
        select: "lesson_id,coach_comment,deducted_sessions,completed_at",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_users", {
        select: "id,name",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_media_files", {
        select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
        limit: 300,
      }).catch(() => []),
    ]);
    const recordsByLesson = new Map((recordRows || []).map((record) => [record.lesson_id, record]));
    const namesByUser = new Map((userRows || []).map((user) => [user.id, user.name]));
    for (const row of (journalRows || []).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))) {
      const payload = parseServerJournalBody(row.body);
      if (!payload) continue;
      const record = recordsByLesson.get(row.lesson_id);
      const mediaForJournal = (mediaRows || [])
        .filter((media) => media.journal_entry_id === row.id)
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      const mediaItems = (await Promise.all(mediaForJournal.map((media, index) => (
        downloadCoachJournalMedia(client, media, payload.mediaNames?.[index] || `첨부 ${index + 1}`).catch(() => null)
      )))).filter(Boolean);
      const serverLog = {
        id: payload.clientLogId || `server-journal-${row.id}`,
        serverJournalId: row.id,
        serverLessonId: row.lesson_id || "",
        member: namesByUser.get(row.user_id) || "회원",
        lesson: payload.lessonLabel || `${row.entry_date} 서버 수업기록`,
        content: payload.content || "수업 내용 미입력",
        selfMemo: payload.selfMemo || "자기 운동 일지 미입력",
        mediaNames: payload.mediaNames || [],
        mediaItems,
        curriculumId: payload.curriculumId || "FH-01",
        nextCurriculumId: payload.nextCurriculumId || payload.curriculumId || "FH-01",
        coachComment: record?.coach_comment || "",
        validationMessage: "",
        status: record ? "확인 완료" : "확인 대기",
        curriculumRegistered: Boolean(record),
        completedAt: record?.completed_at || "",
      };
      const existingIndex = state.lessonLogs.findIndex((log) => log.serverJournalId === row.id || log.id === serverLog.id || (row.lesson_id && log.serverLessonId === row.lesson_id));
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = { ...state.lessonLogs[existingIndex], ...serverLog };
      else state.lessonLogs.unshift(serverLog);
    }
    return true;
  } catch {
    return false;
  }
}

async function liveCurriculumRefId(step = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return null;
  try {
    if (client.rpc && client.getSession?.()?.access_token) {
      const ensuredId = await client.rpc("tn_ensure_curriculum_ref", {
        target_code: step.id,
        target_level: `${step.trackTitle || step.category || "커리큘럼"} · ${step.stageLabel || step.level || "단계"}`,
        target_title: step.title,
        target_notion_url: curriculumNotionUrl(step),
      });
      if (ensuredId) return ensuredId;
    }
    const rows = await client.selectRows("tn_curriculum_refs", {
      select: "id,title,skill_label,status",
      filters: { status: "active" },
      limit: 100,
    });
    const matched = (rows || []).find((row) => row.skill_label === step.id || row.title === step.title);
    return matched?.id || null;
  } catch {
    return null;
  }
}

async function showNoticeAfterLiveSync() {
  await syncLiveNotices();
  showNoticeIfNeeded();
}

function importMemberLessonLogs() {
  const shared = loadSharedData();
  shared.lessonLogs.forEach((sharedLog) => {
    const existing = state.lessonLogs.find((log) => log.id === sharedLog.id);
    const mappedStatus = sharedLog.status === "confirmed" ? "확인 완료" : "확인 대기";
    if (existing) {
      existing.content = sharedLog.content;
      existing.selfMemo = sharedLog.selfMemo;
      existing.curriculumId = sharedLog.curriculumId;
      existing.nextCurriculumId = sharedLog.nextCurriculumId || sharedLog.curriculumId;
      existing.coachComment = sharedLog.coachComment || existing.coachComment || "";
      existing.status = mappedStatus;
      existing.completedAt = sharedLog.confirmedAt || existing.completedAt || "";
      return;
    }
    state.lessonLogs.unshift({
      id: sharedLog.id,
      member: sharedLog.member || "김서준",
      lesson: sharedLog.lessonLabel,
      content: sharedLog.content,
      selfMemo: sharedLog.selfMemo,
      curriculumId: sharedLog.curriculumId,
      nextCurriculumId: sharedLog.nextCurriculumId || sharedLog.curriculumId,
      coachComment: sharedLog.coachComment || "",
      validationMessage: "",
      status: mappedStatus,
      completedAt: sharedLog.confirmedAt || "",
    });
  });
}
function importPracticeFeedbackRequests() {
  const shared = loadSharedData();
  shared.feedbackRequests.forEach((request) => {
    const existing = state.feedbackRequests.find((item) => item.id === request.id);
    if (existing) {
      Object.assign(existing, request);
      return;
    }
    state.feedbackRequests.unshift({ ...request, validationMessage: "" });
  });
}

function importMakeupRequests() {
  const shared = loadSharedData();
  shared.makeupRequests.forEach((request) => {
    const existing = state.makeupRequests.find((item) => item.id === request.id);
    const payload = {
      id: request.id,
      member: request.member || "회원",
      original: request.original || "기존 수업",
      requested: request.requested || "희망 시간",
      reason: request.reason || "",
      policy: request.policy || "",
      status: request.status === "자동 변경 완료" ? "승인 완료" : request.status || "승인 대기",
    };
    if (existing) Object.assign(existing, payload);
    else state.makeupRequests.unshift(payload);
  });
}

function importNtrpRequests() {
  const shared = loadSharedData();
  state.ntrpRequests = shared.ntrpRequests || [];
  state.ntrpRequests.forEach((request) => {
    const member = state.members.find((item) => item.name === request.member);
    if (!member) return;
    member.selfNtrp = request.selfNtrp;
    member.coachNtrp = request.coachNtrp || member.coachNtrp || "측정 전";
    member.ntrpRequest = request.status === "측정 완료" ? "완료" : "요청";
    member.ntrpSurvey = request.surveyAnswers || {};
    member.ntrpGoal = request.goal || "";
    member.ntrpMemo = request.memo || "";
  });
}

function exportNtrpResult(request) {
  const shared = loadSharedData();
  const index = shared.ntrpRequests.findIndex((item) => item.id === request.id);
  const payload = {
    ...request,
    status: "측정 완료",
    answeredAt: new Date().toISOString(),
  };
  if (index >= 0) shared.ntrpRequests[index] = { ...shared.ntrpRequests[index], ...payload };
  else shared.ntrpRequests.unshift(payload);
  saveSharedData(shared);
}

function exportPracticeFeedback(request) {
  const shared = loadSharedData();
  const index = shared.feedbackRequests.findIndex((item) => item.id === request.id);
  const payload = {
    ...request,
    status: "코치 답변 완료",
    answeredAt: new Date().toISOString(),
  };
  if (index >= 0) shared.feedbackRequests[index] = { ...shared.feedbackRequests[index], ...payload };
  else shared.feedbackRequests.unshift(payload);
  saveSharedData(shared);
}

function exportConfirmedLog(log) {
  const shared = loadSharedData();
  const index = shared.lessonLogs.findIndex((item) => item.id === log.id);
  const nextStep = selectedCurriculum(log.nextCurriculumId);
  const payload = {
    id: log.id,
    member: log.member,
    lessonLabel: log.lesson,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculumId,
    nextCurriculumId: log.nextCurriculumId,
    coachComment: log.coachComment,
    memberVisibleSummary: `다음 수업 등록 완료: ${nextStep.id} · ${nextStep.title}`,
    curriculumRegistered: true,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  };
  if (index >= 0) shared.lessonLogs[index] = { ...shared.lessonLogs[index], ...payload };
  else shared.lessonLogs.unshift(payload);
  saveSharedData(shared);
}

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) return;
    if (snapshot.state) Object.assign(state, snapshot.state);
    if (state.dataMode === "live") {
      if (!Array.isArray(state.liveLessons)) state.liveLessons = [];
      if (!Array.isArray(state.releasedMakeupSlots)) state.releasedMakeupSlots = [];
      if (!Array.isArray(state.members)) state.members = [];
      return;
    }
    ensureTodayLessonDashboard();
    ensureMemberLists();
    ensureCoachDemoConsistency();
    importMemberLessonLogs();
    importPracticeFeedbackRequests();
    importMakeupRequests();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function resetCoachScheduleLaunchView() {
  if (coachSchedulePreferenceTouched) return;
  state.scheduleFilter = "mine";
  state.selectedFullScheduleDay = currentCoachScheduleDay();
}

function ensureTodayLessonDashboard() {
  if (state.dataMode === "live") return;
  if (Number(state.dashboardVersion) >= 5 && state.todayLessons.length >= 8 && state.todayLessons.every((lesson) => lesson.day && lesson.ticket && lesson.task && lesson.coach)) return;
  state.dashboardVersion = 6;
  state.todayLessons = [
    { id: "lesson-1", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규 20분", ticket: "개인레슨 10회", status: "예정", remaining: 8, task: "수업 후 코멘트/다음 커리큘럼" },
    { id: "lesson-2", day: "월", time: "19:00", coach: "강 코치", member: "최유나&이하린", type: "정규 30분", ticket: "2대1 8회", status: "예정", remaining: 6, task: "파트너 출석 같이 확인" },
    { id: "lesson-2b", day: "월", time: "19:00", coach: "노 코치", member: "윤서준", type: "정규 20분", ticket: "개인레슨 8회", status: "예정", remaining: 3, task: "동시간 수업 확인" },
    { id: "lesson-3", day: "화", time: "19:40", coach: "노 코치", member: "오윤정", type: "정규 20분", ticket: "주2회 12회", status: "예정", remaining: 11, task: "요일/시간 고정 확인" },
    { id: "lesson-4", day: "수", time: "20:00", coach: "황 코치", member: "이하린", type: "정규 20분", ticket: "개인레슨 8회", status: "예정", remaining: 2, task: "재등록 안내 필요" },
    { id: "lesson-5", day: "목", time: "20:20", coach: "강 코치", member: "박민재", type: "보강 30분", ticket: "개인레슨 10회", status: "승인됨", remaining: 5, task: "보강 수업 처리" },
    { id: "lesson-6", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규 30분", ticket: "주1회 8회", status: "예정", remaining: 7, task: "수업 후 영상 피드백 확인" },
    { id: "lesson-7", day: "토", time: "18:40", coach: "박창준 코치", member: "임현우", type: "정규 30분", ticket: "주말반 8회", status: "예정", remaining: 4, task: "주말반 커리큘럼 확인" },
  ];
}

function ensureCoachDemoConsistency() {
  if (state.dataMode === "live") return;
  state.todayLessons.forEach((lesson) => {
    if (shortCoachName(lesson.coach) === "박창준") lesson.coach = "박창준 코치";
    if ((lesson.day === "토" || lesson.day === "일") && lesson.member === "박민재") lesson.coach = "박창준 코치";
    if (lesson.member === "박민재" && lesson.ticket?.includes("황")) {
      lesson.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.members?.forEach((member) => {
    if (member.name === "박민재" && member.ticket?.includes("황")) {
      member.coach = "박창준 코치";
      member.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.expiredMembers?.forEach((member) => {
    if (member.name === "박민재" && member.ticket?.includes("황")) {
      member.coach = "박창준 코치";
      member.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.dashboardVersion = 6;
}

function ensureMemberLists() {
  if (state.dataMode === "live") {
    if (!Array.isArray(state.members)) state.members = [];
    if (!Array.isArray(state.expiredMembers)) state.expiredMembers = [];
    if (!Array.isArray(state.proxySettlements)) state.proxySettlements = [];
    if (!state.coachProfiles) state.coachProfiles = {};
    return;
  }
  if (!state.branchPermissions) {
    state.branchPermissions = {
      branch: "어린이대공원점",
      schedule: "같은 지점 전체 시간표 공유",
      memberRecords: "같은 지점 회원정보와 수업기록 열람",
      finance: "결제/전체매출/환불은 관리자만",
    };
  }
  if (!Array.isArray(state.proxySettlements) || !state.proxySettlements.length) {
    state.proxySettlements = [
      { id: "proxy-1", originalCoach: "노 코치", actualCoach: "황 코치", member: "박민재", lesson: "목 20:20 대타 30분", base: 180000, amount: 35000, status: "정산 이관 대기" },
      { id: "proxy-2", originalCoach: "강 코치", actualCoach: "노 코치", member: "최유나&이하린", lesson: "월 19:00 대타 20분", base: 180000, amount: 90000, status: "관리자 확인 필요" },
    ];
  }
  if (!Array.isArray(state.members) || !state.members.length) {
    state.members = [
      { id: "member-1", name: "김서준", coach: "노 코치", ticket: "개인레슨 10회", remaining: 8, status: "수강중", lastLesson: "월 18:40", selfNtrp: "2.5", coachNtrp: "측정 전", ntrpRequest: "요청" },
      { id: "member-2", name: "윤서준", coach: "노 코치", ticket: "개인레슨 8회", remaining: 3, status: "수강중", lastLesson: "월 19:00", selfNtrp: "3.0", coachNtrp: "2.5", ntrpRequest: "완료" },
      { id: "member-3", name: "최유나&이하린", coach: "강 코치", ticket: "2대1 8회", remaining: 6, status: "수강중", lastLesson: "월 19:00", selfNtrp: "2.0", coachNtrp: "측정 전", ntrpRequest: "미요청" },
      { id: "member-4", name: "이하린", coach: "황 코치", ticket: "개인레슨 8회", remaining: 2, status: "수강중", lastLesson: "수 20:00", selfNtrp: "3.0", coachNtrp: "3.0", ntrpRequest: "완료" },
    ];
  }
  if (!Array.isArray(state.expiredMembers) || !state.expiredMembers.length) {
    state.expiredMembers = [
      { id: "expired-1", name: "박준영", coach: "노 코치", ticket: "개인레슨 8회", expiredAt: "2026-06-18", used: "8/8", note: "연장 안내 필요" },
      { id: "expired-2", name: "정다은", coach: "강 코치", ticket: "그룹레슨 8회", expiredAt: "2026-06-24", used: "8/8", note: "7월 재등록 미정" },
      { id: "expired-3", name: "한지호", coach: "황 코치", ticket: "주말반 4회", expiredAt: "2026-06-29", used: "4/4", note: "주말 시간 재문의" },
    ];
  }
  if (!state.coachProfiles) {
    state.coachProfiles = {};
  }
  approvedCoachesFromAdmin().forEach((coach) => {
    if (!state.coachProfiles[coach.name]) {
      state.coachProfiles[coach.name] = {
        intro: "회원에게 보여줄 코치 소개를 입력해주세요.",
        specialty: coach.role || "레슨",
        lessonStyle: "회원 수준에 맞춘 맞춤 수업",
        availableMemo: "관리자 설정 가능 시간 기준",
        memberMessage: "수업 전 궁금한 점을 편하게 남겨주세요.",
      };
    }
  });
}

function compactCoachSnapshotState() {
  const compactMember = (member) => {
    const compact = { ...member };
    if (String(compact.photoUrl || "").startsWith("data:")) delete compact.photoUrl;
    if (String(compact.profilePhotoUrl || "").startsWith("data:")) delete compact.profilePhotoUrl;
    return compact;
  };
  const snapshotState = {
    ...state,
    coach: state.coach ? { ...state.coach } : null,
    coachSettlement: null,
    coachSettlementLoading: false,
    coachSettlementError: "",
    members: (state.members || []).map(compactMember),
    expiredMembers: (state.expiredMembers || []).map(compactMember),
    coachProfiles: Object.fromEntries(
      Object.entries(state.coachProfiles || {}).map(([name, profile]) => [name, { ...profile }]),
    ),
  };
  const activePhoto = String(snapshotState.coach?.profilePhotoUrl || "");
  if (activePhoto) {
    Object.values(snapshotState.coachProfiles).forEach((profile) => {
      if (profile.photo === activePhoto) delete profile.photo;
    });
  }
  return snapshotState;
}

function saveSnapshot() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ state: compactCoachSnapshotState() }));
    return true;
  } catch (error) {
    console.warn("Tennis Note coach snapshot save skipped", error?.name || error);
    return false;
  }
}

function approvedCoachesFromAdmin() {
  try {
    const snapshot = readAdminSnapshot();
    const adminCoaches = Array.isArray(snapshot?.coaches) ? snapshot.coaches : [];
    const approved = adminCoaches
      .filter((coach) => (
        coach.status === "active"
        && coach.coachMode === "approved"
        && (coach.employmentStatus || "active") === "active"
        && !coach.archivedAt
        && !coach.deletedAt
        && coach.name !== "무인"
      ))
      .map((coach) => ({ id: coach.id, name: coach.name, role: coach.role || "레슨" }));
    if (approved.length) return approved;
  } catch {
    return [];
  }
  return [
    { id: "coach-no", name: "노 코치", role: "레슨" },
    { id: "coach-kang", name: "강 코치", role: "레슨" },
    { id: "coach-hwang", name: "황 코치", role: "레슨/보강" },
  ];
}

function exportMakeupRequest(request) {
  const shared = loadSharedData();
  const payload = {
    id: request.id,
    member: request.member,
    original: request.original,
    requested: request.requested,
    reason: request.reason || "",
    policy: request.policy || "",
    status: request.status,
    answeredAt: new Date().toISOString(),
    source: "coach-app",
  };
  const index = shared.makeupRequests.findIndex((item) => item.id === request.id);
  if (index >= 0) shared.makeupRequests[index] = { ...shared.makeupRequests[index], ...payload };
  else shared.makeupRequests.unshift(payload);
  saveSharedData(shared);
}

function readAdminSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(adminStorageKey) || "null");
  } catch {
    localStorage.removeItem(adminStorageKey);
    return null;
  }
}

function resolveLiveSchedulePolicyForBranch(value = {}, branchId = "") {
  const normalizedBranchId = String(branchId || "");
  const profiles = Array.isArray(value.operationProfiles) ? value.operationProfiles : [];
  const activeProfile = profiles.find((item) => String(item?.id || "") === String(value.activeOperationProfileId || ""));
  const branchActiveProfileId = String(value.activeOperationProfileIdsByBranch?.[normalizedBranchId] || "");
  const branchActiveProfile = profiles.find((item) => (
    String(item?.id || "") === branchActiveProfileId
    && String(item?.branchId || item?.branch_id || "") === normalizedBranchId
  ));
  const profile = normalizedBranchId
    ? (branchActiveProfile
      || (String(activeProfile?.branchId || activeProfile?.branch_id || "") === normalizedBranchId
      ? activeProfile
      : profiles.find((item) => String(item?.branchId || item?.branch_id || "") === normalizedBranchId)))
    : activeProfile;
  if (!profile) {
    return {
      scheduleSettings: value.scheduleSettings || {},
      coaches: Array.isArray(value.coaches) ? value.coaches : [],
      branchId: normalizedBranchId,
    };
  }
  const profileBranchId = String(profile.branchId || profile.branch_id || normalizedBranchId);
  const sourceCoaches = Array.isArray(profile.coaches) && profile.coaches.length
    ? profile.coaches
    : Array.isArray(value.coaches) ? value.coaches : [];
  const hasExplicitCoachBranches = sourceCoaches.some((coach) => Boolean(coach?.branchId));
  return {
    scheduleSettings: {
      ...(value.scheduleSettings || {}),
      ...(profile.scheduleSettings || {}),
    },
    coaches: sourceCoaches.filter((coach) => (
      !profileBranchId
      || (!hasExplicitCoachBranches && !coach?.branchId)
      || String(coach.branchId) === profileBranchId
    )),
    branchId: profileBranchId,
  };
}

function filterSchedulePolicyByLiveCoachRoles(value = {}, coachRows = []) {
  const activeRoles = (coachRows || []).filter((role) => (
    role.status === "approved"
    && (role.employment_status || "active") === "active"
    && !role.archived_at
    && !role.deleted_at
  ));
  const activeIds = new Set(activeRoles.map((role) => String(role.id)));
  const activeNames = new Set(activeRoles.map((role) => String(role.display_name || "").trim()).filter(Boolean));
  const filterCoaches = (coaches = []) => (Array.isArray(coaches) ? coaches : [])
    .filter((coach) => (
      coach.serverRoleId
        ? activeIds.has(String(coach.serverRoleId))
        : activeNames.has(String(coach.name || "").trim())
    ))
    .map((coach) => ({
      ...coach,
      status: "active",
      employmentStatus: "active",
      archivedAt: "",
      deletedAt: "",
    }));
  return {
    ...(value || {}),
    coaches: filterCoaches(value?.coaches),
    operationProfiles: Array.isArray(value?.operationProfiles)
      ? value.operationProfiles.map((profile) => ({
        ...profile,
        coaches: filterCoaches(profile?.coaches),
      }))
      : [],
  };
}

function writeLiveSchedulePolicySnapshot(value = {}, branchId = "") {
  if (!value || typeof value !== "object") return false;
  const existing = readAdminSnapshot() || {};
  const resolved = resolveLiveSchedulePolicyForBranch(value, branchId);
  const scheduleSettings = resolved.scheduleSettings;
  const coaches = resolved.coaches;
  if (!scheduleSettings.openStart && !scheduleSettings.openEnd && !coaches.length) return false;
  localStorage.setItem(adminStorageKey, JSON.stringify({
    ...existing,
    scheduleSettings: {
      ...(existing.scheduleSettings || {}),
      ...scheduleSettings,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : existing.scheduleSettings?.breakRules || [],
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
    },
    coaches,
    operationPolicyBranchId: resolved.branchId || "",
  }));
  return true;
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

function adminCoachNameForCoachApp(lesson, snapshot) {
  const coach = (snapshot?.coaches || []).find((item) => item.id === lesson.coachId);
  return coach?.name || lesson.coach || "미지정 코치";
}

function adminTicketForMember(memberName, snapshot) {
  const ticket = (snapshot?.tickets || []).find((item) => item.member === memberName || `${item.member || ""}`.includes(memberName));
  return ticket || {};
}

function normalizeAdminLessonForCoachApp(lesson, snapshot) {
  const coach = adminCoachNameForCoachApp(lesson, snapshot);
  const rawText = `${lesson.type || ""} ${lesson.status || ""} ${coach}`;
  if (/무인|볼머신/.test(rawText)) return null;
  const member = lesson.member === "빈자리" || lesson.member === "보강대기" ? "" : lesson.member || "";
  if (!member && lesson.status === "available") return null;
  const duration = Number(lesson.durationMinutes) || 20;
  const ticket = adminTicketForMember(member, snapshot);
  const pending = lesson.status === "pending" || /요청|접수/.test(rawText);
  const ticketLabel = coach.includes("박창준") && member === "박민재"
    ? "박창준 코치 주 1회 개인 30분"
    : ticket.product || ticket.lessonKind || "회원권 연결";
  return {
    id: `admin-${lesson.id}`,
    day: lesson.day,
    time: lesson.time,
    coach,
    member: member || "변경요청",
    type: pending ? "변경요청" : `${lesson.makeup ? "보강" : "정규"} ${duration}분`,
    ticket: ticketLabel,
    status: pending ? "승인 대기" : lesson.status === "confirmed" ? "확인됨" : "예정",
    lessonSource: lesson.lessonSource || (lesson.makeup ? "makeup" : "regular"),
    remaining: Number(ticket.remaining ?? ticket.total ?? 8),
    task: pending ? "보강/변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
    changeNote: pending ? "승인 필요" : "",
  };
}

function adminLessonsForCoachApp() {
  const snapshot = readAdminSnapshot();
  if (!snapshot || !Array.isArray(snapshot.lessons)) return [];
  return snapshot.lessons
    .map((lesson) => normalizeAdminLessonForCoachApp(lesson, snapshot))
    .filter(Boolean);
}

function ensureCoachLessonRecord(id) {
  let lesson = state.todayLessons.find((item) => item.id === id);
  if (lesson) return lesson;
  const source = weekLessons().find((item) => item.id === id);
  if (!source) return null;
  lesson = { ...source };
  state.todayLessons.push(lesson);
  return lesson;
}

function makeCoachTimeRange(startTime, endTime, stepMinutes = scheduleBlockMinutes) {
  const result = [];
  for (let current = minutesFromTime(startTime); current <= minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function defaultCoachSchedulePolicy() {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  return {
    openStart: "06:40",
    openEnd: "22:00",
    allowCoachLockedTimeOverride: true,
    allowCoachHolidayOverride: false,
    breakRules: [{ id: "weekday-midday", days: weekdays, start: "13:00", end: "17:00", label: "수업 없음" }],
    lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
    coaches: [
      {
        id: "coach-no",
        name: "노 코치",
        status: "active",
        workBlocks: [
          { id: "coach-no-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" },
          { id: "coach-no-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" },
        ],
      },
      {
        id: "coach-hwang",
        name: "황 코치",
        status: "active",
        workBlocks: [{ id: "coach-hwang-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" }],
      },
      {
        id: "coach-kang",
        name: "강 코치",
        status: "active",
        workBlocks: [{ id: "coach-kang-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" }],
      },
      {
        id: "coach-park",
        name: "박창준 코치",
        status: "active",
        workBlocks: [{ id: "coach-park-weekend", days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }],
      },
    ],
  };
}

function coachKeyFromName(name = "") {
  if (name.includes("노")) return "coach-no";
  if (name.includes("강")) return "coach-kang";
  if (name.includes("황")) return "coach-hwang";
  if (name.includes("박")) return "coach-park";
  return "";
}

function defaultWorkBlocksForCoach(coach) {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  if (coach.id === "coach-no" || coach.availability === "split") {
    return [
      { id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" },
      { id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" },
    ];
  }
  if (coach.id === "coach-hwang" || coach.availability === "weekday-am") {
    return [{ id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" }];
  }
  if (coach.id === "coach-kang" || coach.availability === "weekday-pm") {
    return [{ id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" }];
  }
  if (coach.id === "coach-park" || coach.availability === "weekend") {
    return [{ id: `${coach.id}-weekend`, days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }];
  }
  return [{ id: `${coach.id || "coach"}-all`, days: scheduleDays, start: "06:40", end: "22:00", label: "전체" }];
}

function normalizeCoachPolicyItem(coach) {
  const normalized = { ...coach };
  normalized.id = normalized.id || coachKeyFromName(normalized.name) || `coach-${normalized.name || Date.now()}`;
  normalized.name = normalized.name || "이름 없음";
  normalized.status = normalized.status || "active";
  normalized.workBlocks = Array.isArray(normalized.workBlocks) && normalized.workBlocks.length
    ? normalized.workBlocks
    : defaultWorkBlocksForCoach(normalized);
  normalized.workBlocks = normalized.workBlocks
    .map((block, index) => ({
      id: block.id || `${normalized.id}-block-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "근무",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  if (!normalized.workBlocks.length) normalized.workBlocks = defaultWorkBlocksForCoach(normalized);
  normalized.blockedBlocks = (Array.isArray(normalized.blockedBlocks) ? normalized.blockedBlocks : [])
    .map((block, index) => ({
      id: block.id || `${normalized.id}-blocked-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : scheduleDays,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "브레이크·상담",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  return normalized;
}

function loadCoachSchedulePolicy() {
  const fallback = defaultCoachSchedulePolicy();
  let resolved = fallback;
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    if (snapshot) {
      const scheduleSettings = snapshot.scheduleSettings || {};
      const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
      const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches) ? snapshot.coaches : fallback.coaches;
      resolved = {
        openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
        openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
        breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
        lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
        lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
        coaches: savedCoaches
          .filter((coach) => (
            (coach.status || "active") === "active"
            && (coach.employmentStatus || "active") === "active"
            && !coach.archivedAt
            && !coach.deletedAt
            && coach.name !== "무인"
          ))
          .map(normalizeCoachPolicyItem),
      };
    }
  } catch {
    localStorage.removeItem(adminStorageKey);
  }
  const workspace = scheduleV2CoachWorkspace();
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
        days: [scheduleDays[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: "근무",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    const blockedBlocks = (coach.availability || [])
      .filter((block) => block.type === "blocked")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-blocked-${blockIndex}`,
        days: [scheduleDays[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: block.note || "브레이크·상담",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    return {
      id: coach.roleId,
      roleId: coach.roleId,
      name: coach.name || "이름 없음",
      status: "active",
      laneOrder,
      sortIndex: laneOrder,
      workBlocks,
      blockedBlocks,
    };
  });
  return {
    ...resolved,
    allowCoachLockedTimeOverride: workspace.policy?.allow_coach_locked_time_override !== false,
    allowCoachHolidayOverride: workspace.policy?.allow_coach_holiday_override === true,
    allowCrossCoachMemberEdit: workspace.policy?.allow_cross_coach_member_edit === true,
    coachSingleAddMode: workspace.policy?.coach_single_add_mode || "approval",
    coaches: serverCoaches,
  };
}

function coachOrder(id = "") {
  const order = ["coach-no", "coach-hwang", "coach-kang", "coach-park"];
  const index = order.indexOf(id);
  return index >= 0 ? index : order.length;
}

function shortCoachName(name = "") {
  return name.replace(" 코치", "").replace("코치", "").trim();
}

function canonicalCoachName(name = "") {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const rawShort = shortCoachName(raw);
  const matched = approvedCoachesFromAdmin().find((coach) => coach.name === raw || shortCoachName(coach.name) === rawShort);
  return shortCoachName(matched?.name || raw);
}

function coachFromLesson(lesson, policy) {
  const scheduleCoachName = lesson.isSubstitute && lesson.originalCoach
    ? lesson.originalCoach
    : lesson.coach;
  const roleId = String(lesson.originalCoachRoleId || lesson.coachRoleId || "");
  const key = coachKeyFromName(scheduleCoachName);
  return policy.coaches.find((coach) => String(coach.roleId || coach.id) === roleId)
    || policy.coaches.find((coach) => coach.id === key)
    || policy.coaches.find((coach) => coach.name === scheduleCoachName)
    || normalizeCoachPolicyItem({ id: key || scheduleCoachName, name: scheduleCoachName || "미지정 코치" });
}

function coachScheduleCardCoachLabel(lesson = {}) {
  const actualCoach = shortCoachName(lesson.coach || "");
  return lesson.isSubstitute ? `대타 ${actualCoach || "확인"}` : actualCoach;
}

function dayCoachesForSchedule(day, policy, lessons = [], filter = state.scheduleFilter || "all") {
  const currentRoleId = currentCoachRoleId();
  const currentName = currentCoachName();
  const working = policy.coaches.filter((coach) => {
    if (!(coach.workBlocks || []).some((block) => block.days.includes(day))) return false;
    if (filter !== "mine") return true;
    const roleMatches = currentRoleId && String(coach.roleId || coach.id || "") === currentRoleId;
    return Boolean(roleMatches || canonicalCoachName(coach.name) === currentName);
  });
  const lessonCoaches = lessons
    .filter((lesson) => lesson.day === day)
    .map((lesson) => coachFromLesson(lesson, policy));
  const unique = working
    .concat(lessonCoaches)
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index);
  return window.TennisNoteScheduleLanes?.sortByLaneOrder?.(unique)
    || unique.sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.sortIndex)) ? Number(a.sortIndex) : coachOrder(a.id);
      const bOrder = Number.isFinite(Number(b.sortIndex)) ? Number(b.sortIndex) : coachOrder(b.id);
      return aOrder - bOrder;
    });
}

function scheduleRuleForSlot(rules, day, time, durationMinutes = scheduleBlockMinutes) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (rules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    return start < minutesFromTime(rule.end) && end > minutesFromTime(rule.start);
  });
}

function breakRuleForSlot(policy, day, time, durationMinutes = scheduleBlockMinutes) {
  return scheduleRuleForSlot(policy.breakRules, day, time, durationMinutes);
}

function coachBlockedRuleForSlot(coach, day, time, durationMinutes = scheduleBlockMinutes) {
  return scheduleRuleForSlot(coach.blockedBlocks, day, time, durationMinutes);
}

function coachClosureForSlot(day, time, durationMinutes = scheduleBlockMinutes) {
  const date = coachWeekDateForDay(day);
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (scheduleV2CoachWorkspace()?.closures || []).find((closure) => {
    if (String(closure.date || "") !== date) return false;
    if (closure.allDay) return true;
    return start < minutesFromTime(String(closure.endTime || "").slice(0, 5))
      && end > minutesFromTime(String(closure.startTime || "").slice(0, 5));
  });
}

function coachSlotAccess(coach, day, time, durationMinutes = scheduleBlockMinutes, policy = loadCoachSchedulePolicy()) {
  const currentRoleId = currentCoachRoleId();
  const laneRoleId = String(coach.roleId || coach.id || "");
  if (!currentRoleId || laneRoleId !== currentRoleId) return { allowed: false, reason: "other_coach" };
  const closure = coachClosureForSlot(day, time, durationMinutes);
  if (closure && policy.allowCoachHolidayOverride !== true) return { allowed: false, reason: "holiday_locked", closure };
  const breakRule = breakRuleForSlot(policy, day, time, durationMinutes);
  const blockedRule = coachBlockedRuleForSlot(coach, day, time, durationMinutes);
  const working = isPolicyCoachWorking(coach, day, time, durationMinutes);
  const lockedRule = blockedRule || breakRule;
  if (lockedRule && policy.allowCoachLockedTimeOverride !== false) {
    return { allowed: true, reason: "locked_time_override", lockedRule, closure, working };
  }
  if (!working || lockedRule) return { allowed: false, reason: working ? "blocked_time" : "outside_working_hours", lockedRule, closure, working };
  return { allowed: true, reason: closure ? "holiday_override" : "available", closure, working };
}

function isPolicyCoachWorking(coach, day, time, durationMinutes = scheduleBlockMinutes) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (coach.workBlocks || []).some((block) => {
    if (!block.days.includes(day)) return false;
    return start >= minutesFromTime(block.start) && end <= minutesFromTime(block.end);
  });
}

function coachScheduleTimes(policy = loadCoachSchedulePolicy()) {
  const range = "all";
  const allStart = policy.openStart;
  const allEnd = policy.openEnd;
  if (range === "morning") return makeCoachTimeRange(allStart, "12:00");
  if (range === "afternoon") return makeCoachTimeRange("12:00", "17:00");
  if (range === "evening") return makeCoachTimeRange("17:00", allEnd);
  if (range === "all") return makeCoachTimeRange(allStart, allEnd);
  const lessons = weekLessons().filter((lesson) => lesson.status !== "available");
  if (!lessons.length) return makeCoachTimeRange("17:00", allEnd);
  const starts = lessons.map((lesson) => minutesFromTime(lesson.time));
  const ends = lessons.map((lesson) => minutesFromTime(lesson.time) + lessonDuration(lesson));
  const start = Math.max(minutesFromTime(allStart), Math.floor((Math.min(...starts) - 30) / 10) * 10);
  const end = Math.min(minutesFromTime(allEnd), Math.ceil((Math.max(...ends) + 30) / 10) * 10);
  const startText = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const endText = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return makeCoachTimeRange(startText, endText);
}

function scheduleTimeRangeOptions() {
  return [
    { id: "lesson", label: "추천" },
    { id: "morning", label: "오전" },
    { id: "evening", label: "저녁" },
    { id: "all", label: "전체" },
  ];
}

function coachColorClass(name) {
  if (name.includes("노")) return "coach-color-no";
  if (name.includes("강")) return "coach-color-kang";
  if (name.includes("황")) return "coach-color-hwang";
  if (name.includes("박")) return "coach-color-park";
  return "coach-color-default";
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function personPhotoUrl(person = {}) {
  return String(person.profilePhotoUrl || person.photoUrl || person.photo || "").trim();
}

function personAvatarInnerMarkup(person = {}) {
  const name = person.name || person.displayName || "사용자";
  const photoUrl = personPhotoUrl(person);
  return `
    <span class="person-avatar-placeholder" aria-hidden="true"></span>
    ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)} 프로필 사진" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('is-empty');this.remove()" />` : ""}`;
}

function personAvatarMarkup(person = {}, size = "tiny") {
  const name = person.name || person.displayName || "사용자";
  const hasPhoto = Boolean(personPhotoUrl(person));
  return `<span class="person-avatar ${size} ${hasPhoto ? "has-photo" : "is-empty"}" aria-label="${escapeHtml(hasPhoto ? `${name} 프로필 사진` : "기본 프로필 이미지")}">${personAvatarInnerMarkup(person)}</span>`;
}

function renderPersonAvatar(target, person = {}, size = "small", baseClass = "") {
  if (!target) return;
  const hasPhoto = Boolean(personPhotoUrl(person));
  const name = person.name || person.displayName || "사용자";
  target.className = `${baseClass} person-avatar ${size} ${hasPhoto ? "has-photo" : "is-empty"}`.trim();
  target.setAttribute("aria-label", hasPhoto ? `${name} 프로필 사진` : "기본 프로필 이미지");
  target.innerHTML = personAvatarInnerMarkup(person);
}

function registerPwaServiceWorker() {
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.392",
    remoteAppUrl: "https://tennisnote-app.pages.dev/tennis-note-coach-app/",
  });
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function openCoachApp(showFromLogin = false) {
  if (!state.coach) return;
  setCoachAccessMessage("");
  $("#coachLoginLabel").textContent = `${state.coach.provider} 로그인 유지`;
  $("#coachName").textContent = state.coach.name;
  renderPersonAvatar($("#coachTopAvatar"), state.coach, "small");
  $("#coachLoginScreen").hidden = true;
  $("#coachAppScreen").hidden = false;
  document.body.dataset.screen = "coach-app";
  jumpToTop();
  const requestedView = new URLSearchParams(window.location.search).get("view");
  setView(showFromLogin ? "todayView" : requestedView || document.body.dataset.activeView || "todayView", { replaceHistory: true });
  window.setTimeout(showNoticeAfterLiveSync, 0);
}

function canUseCoachAppProfile(profile, coachRole) {
  return Boolean(profile?.id && coachRole?.status === "approved");
}

function memberModeUrl(openProfile = false, memberMode = true) {
  const params = new URLSearchParams({ v: "1.0.392" });
  if (memberMode) params.set("mode", "member");
  if (openProfile) params.set("view", "profileView");
  return `../tennis-note-member-app/index.html?${params.toString()}`;
}

function returnToMemberEntry(openProfile = false, rememberMemberMode = true) {
  state.coach = null;
  if (rememberMemberMode) sessionStorage.setItem(appModePreferenceKey, "member");
  else sessionStorage.removeItem(appModePreferenceKey);
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  saveSnapshot();
  window.location.replace(memberModeUrl(openProfile, rememberMemberMode));
}

function setCoachAccessMessage(message, tone = "wait") {
  state.coachAccessMessage = message || "";
  state.coachAccessTone = tone;
  const target = $("#coachAccessMessage");
  if (!target) return;
  target.hidden = !state.coachAccessMessage;
  target.textContent = state.coachAccessMessage;
  target.dataset.tone = tone;
}

function renderCoachAccessMessage() {
  setCoachAccessMessage(state.coachAccessMessage, state.coachAccessTone || "wait");
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
  if (!state.coach) {
    setNoticeDialogOpen(false);
    return;
  }
  const today = localDateKey();
  const activeNotices = activeNoticesForApp("coach");
  const hiddenToday = new Set(state.noticeHiddenDate === today
    ? [...(Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : []), state.noticeHiddenId].filter(Boolean)
    : []);
  const notice = activeNotices.find((item) => !noticeSessionSeenIds.has(item.id) && !(item.showOncePerDay && hiddenToday.has(item.id)));
  if (!notice) {
    setNoticeDialogOpen(false);
    return;
  }
  const noticeIndex = activeNotices.findIndex((item) => item.id === notice.id);
  $("#noticeTitle").textContent = notice.title;
  $("#noticeBody").textContent = notice.body;
  $("#noticeMeta").textContent = `${noticeMetaText(notice)} · ${noticeIndex + 1}/${activeNotices.length}`;
  const noticeImage = $("#noticeImage");
  noticeImage.hidden = !notice.imageUrl;
  noticeImage.src = notice.imageUrl || "";
  noticeImage.alt = notice.imageAlt || notice.title;
  const noticeAction = $("#noticeAction");
  const safeActionUrl = /^https?:\/\//i.test(notice.actionUrl) ? notice.actionUrl : "";
  const hasAction = Boolean(safeActionUrl);
  noticeAction.hidden = !hasAction;
  noticeAction.href = hasAction ? safeActionUrl : "#";
  noticeAction.textContent = notice.actionLabel || "자세히 보기";
  $("#noticeDialog").dataset.noticeId = notice.id;
  setNoticeDialogOpen(true);
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

function activateLiveCoachProfile(profileId) {
  const nextProfileId = String(profileId || "");
  const profileChanged = state.liveProfileId !== nextProfileId;

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  if (!profileChanged) return;

  state.coach = null;
  state.todayLessons = [];
  state.makeupRequests = [];
  state.feedbackRequests = [];
  state.ntrpRequests = [];
  state.lessonLogs = [];
  state.members = [];
  state.expiredMembers = [];
  state.proxySettlements = [];
  state.coachSettlement = null;
  state.coachSettlementError = "";
  state.coachSettlementLoading = false;
  state.liveLessons = [];
  state.releasedMakeupSlots = [];
  state.scheduleOperationDays = [];
  state.liveLessonsLoaded = false;
  state.liveMembersLoaded = false;
  coachScheduleV2WorkspaceCache = null;
  state.viewingMemberDetailId = "";
  state.viewingMemberGroupName = "";
  state.writingLessonId = null;
  state.editingMakeupId = null;
  localStorage.removeItem(sharedStorageKey);
}

async function applySupabaseCoachSession(showFromLogin = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  await client.consumeOAuthRedirect?.();
  const session = await client.ensureSession?.() || client.getSession?.();
  if (!session?.access_token) return false;
  try {
    const { user, profile, coachRole } = await client.selectCurrentProfile();
    if (!profile || !canUseCoachAppProfile(profile, coachRole)) {
      state.coach = null;
      $("#coachAppScreen").hidden = true;
      $("#coachLoginScreen").hidden = false;
      setCoachAccessMessage("관리자 승인 후 코치앱을 사용할 수 있습니다. 회원앱은 계속 사용할 수 있습니다.", "alert");
      saveSnapshot();
      return true;
    }
    activateLiveCoachProfile(profile.id);
    const displayName = profile?.name || user?.user_metadata?.name || user?.email || state.selectedCoachName || approvedCoachesFromAdmin()[0]?.name || "코치";
    state.coach = {
      provider: session.provider || "Supabase",
      name: displayName,
      profilePhotoUrl: profile?.profile_photo_url || user?.user_metadata?.picture || user?.user_metadata?.avatar_url || "",
      authUserId: user?.id || "",
      coachRoleId: coachRole?.id || "",
      role: profile?.role || "coach",
      branchId: coachRole?.branch_id || "",
    };
    state.selectedCoachName = displayName;
    renderAll();
    openCoachApp(showFromLogin);
    saveSnapshot();
    void (async () => {
      if (await syncCoachSchedulePreview().catch(() => false)) {
        renderAll();
        saveSnapshot();
      }
      await syncLiveSchedulePolicy(state.coach.branchId);
      await Promise.allSettled([
        syncCoachLessonsFromServer(),
        syncCoachJournalEntriesFromServer(),
        syncCoachSettlementFromServer(),
        syncNativeCoachPushRegistration(profile),
      ]);
      renderAll();
      saveSnapshot();
    })();
    return true;
  } catch (error) {
    return false;
  }
}

function openUserMode(event) {
  event?.preventDefault?.();
  sessionStorage.setItem(appModePreferenceKey, "member");
  sessionStorage.setItem("tennis-note-member-mode-transition", String(Date.now()));
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  saveSnapshot();
  const url = new URL(memberModeUrl(true), window.location.href).href;
  if (!window.TennisNoteModeTransition?.navigate(url, {
    from: "coach",
    to: "member",
    sourceView: document.body.dataset.activeView || "coachProfileView",
    targetView: "profileView",
    label: "회원 화면을 여는 중",
  })) window.location.replace(url);
}

async function logoutCoach() {
  await disableNativeCoachPushForLogout();
  await window.TennisNoteDataClient?.signOut?.();
  returnToMemberEntry(false, false);
}

let activeCoachModalId = "";
let coachModalReturnFocus = null;
let nativeCoachBackListenerReady = false;

function nativeCoachAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function nativeCoachPushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function currentCoachPushDeviceId() {
  let deviceId = localStorage.getItem(coachPushDeviceStorageKey) || "";
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem(coachPushDeviceStorageKey, deviceId);
    } catch {
      return deviceId;
    }
  }
  return deviceId;
}

function coachPushPreferenceEnabled() {
  return localStorage.getItem(coachPushPreferenceStorageKey) !== "false";
}

function setCoachPushPreferenceEnabled(enabled) {
  try {
    localStorage.setItem(coachPushPreferenceStorageKey, enabled ? "true" : "false");
  } catch {
    // The server device state remains authoritative when browser storage is unavailable.
  }
}

function setCoachPushNotificationState(permission, status, detail) {
  coachPushUiState = { permission, status, detail };
  renderCoachPushNotificationSettings();
}

function renderCoachPushNotificationSettings() {
  const card = $(".coach-push-settings-card");
  const status = $("#coachPushNotificationStatus");
  const detail = $("#coachPushNotificationDetail");
  const button = $("#coachPushNotificationButton");
  if (!card || !status || !detail || !button) return;
  const permission = coachPushUiState.permission || "unknown";
  card.classList.toggle("is-enabled", permission === "granted");
  card.classList.toggle("is-denied", permission === "denied");
  status.textContent = coachPushUiState.status || "앱 알림 확인 중";
  detail.textContent = coachPushUiState.detail || "수업 일정과 처리할 기록을 알려드립니다.";
  button.textContent = permission === "granted"
    ? "알림 끄기"
    : permission === "denied"
      ? "설정 확인"
      : "알림 켜기";
}

function coachPushPrimerWasRecentlyDeferred() {
  const deferredAt = Number(localStorage.getItem(coachPushPrimerDeferredStorageKey) || 0);
  return deferredAt > 0 && Date.now() - deferredAt < 7 * 24 * 60 * 60 * 1000;
}

function canShowNativeCoachPushPrimer() {
  return ["android", "ios"].includes(nativeCoachAppPlatform())
    && !$("#coachAppScreen")?.hidden
    && Boolean(state.liveProfileId)
    && coachPushPreferenceEnabled()
    && coachPushUiState.permission === "prompt"
    && !coachPushPrimerWasRecentlyDeferred()
    && !activeCoachModalId
    && $("#noticeDialog")?.hidden !== false;
}

function scheduleNativeCoachPushPrimer(delay = 1400) {
  if (coachPushPrimerTimer || coachPushPrimerWasRecentlyDeferred()) return;
  coachPushPrimerTimer = window.setTimeout(() => {
    coachPushPrimerTimer = 0;
    if (canShowNativeCoachPushPrimer()) {
      coachPushPrimerAttempts = 0;
      openCoachModal("coachPushPrimerModal");
      return;
    }
    if (coachPushUiState.permission === "prompt" && coachPushPrimerAttempts < 4) {
      coachPushPrimerAttempts += 1;
      scheduleNativeCoachPushPrimer(3000);
    }
  }, delay);
}

function deferNativeCoachPushPrimer() {
  try {
    localStorage.setItem(coachPushPrimerDeferredStorageKey, String(Date.now()));
  } catch {
    // Closing the primer is still enough for the current session.
  }
  coachPushPrimerAttempts = 0;
  closeCoachModal("coachPushPrimerModal");
}

async function registerCoachPushToken(tokenValue, platform = nativeCoachAppPlatform()) {
  const client = window.TennisNoteDataClient;
  if (!tokenValue || !coachPushProfileId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  await client.rpc("tn_register_push_device", {
    target_platform: platform,
    target_device_id: currentCoachPushDeviceId(),
    target_push_token: tokenValue,
  });
  return true;
}

function coachNotificationData(action = {}) {
  const data = action?.notification?.data;
  return data && typeof data === "object" ? data : {};
}

function coachNotificationRoute(data = {}) {
  const route = String(data.route || "").trim().toLowerCase();
  return ["today", "dashboard", "schedule", "feedback", "member", "membership"].includes(route) ? route : "today";
}

async function authorizeCoachNotificationAction(data = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectCurrentProfile || !client.getSession?.()?.access_token) {
    showToast("로그인 후 알림 내용을 확인해 주세요.");
    return false;
  }
  try {
    const current = await client.selectCurrentProfile();
    if (
      !canUseCoachAppProfile(current?.profile, current?.coachRole)
      || String(current?.profile?.id || "") !== String(state.liveProfileId || "")
      || String(current?.coachRole?.id || "") !== currentCoachRoleId()
    ) {
      showToast("현재 코치 계정에서 확인할 수 없는 알림입니다.");
      return false;
    }

    const lessonId = String(data.lessonId || data.lesson_id || "").trim();
    const requestId = String(data.requestId || data.request_id || "").trim();
    if (lessonId || requestId) {
      const lessonsSynced = await syncCoachLessonsFromServer().catch(() => false);
      if (!lessonsSynced) {
        showToast("수업 정보를 새로 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (lessonId) {
        const lesson = (state.liveLessons || []).find((item) => (
          String(item.serverLessonId || item.id || "") === lessonId
        ));
        if (!lesson || !lessonAssignedToCurrentCoachForTasks(lesson)) {
          showToast("현재 코치에게 배정된 수업이 아닙니다.");
          return false;
        }
      }
      if (requestId) {
        const request = (state.makeupRequests || []).find((item) => (
          String(item.serverRequestId || item.id || "") === requestId
        ));
        const canOpenRequest = request && (
          current?.profile?.role === "admin"
          || String(request.coachRoleId || "") === currentCoachRoleId()
        );
        if (!canOpenRequest) {
          showToast("현재 코치에게 배정된 요청이 아닙니다.");
          return false;
        }
      }
    }
    return true;
  } catch {
    showToast("알림 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return false;
  }
}

function coachNotificationLesson(data = {}) {
  const lessonId = String(data.lessonId || data.lesson_id || "").trim();
  if (!lessonId) return null;
  return [...(state.liveLessons || []), ...(state.todayLessons || []), ...weekLessons()].find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || null;
}

function openCoachNotificationTarget(data = {}, route = "today") {
  const requestId = String(data.requestId || data.request_id || "").trim();
  if (requestId) {
    const request = (state.makeupRequests || []).find((item) => (
      String(item.serverRequestId || item.id || "") === requestId
    ));
    if (request) {
      openMakeupApprovalModal(request.id);
      return true;
    }
  }

  const lesson = coachNotificationLesson(data);
  if (lesson) {
    const templateKey = String(data.templateKey || data.template_key || "").trim();
    if (route === "feedback" || templateKey === "coach_feedback_missing") {
      openLessonRecordWriter(lesson.id);
      return true;
    }
    if (route === "schedule") state.selectedFullScheduleDay = lesson.day || state.selectedFullScheduleDay;
    openLessonEditor(lesson.id);
    return true;
  }

  if (requestId || String(data.lessonId || data.lesson_id || "").trim()) {
    showToast("알림에 연결된 수업이나 요청을 찾지 못했습니다. 최신 레슨표를 다시 확인해 주세요.");
  }
  jumpToTop();
  return false;
}

async function bindNativeCoachPushListeners(plugin) {
  if (coachPushListenersReady) return;
  await plugin.addListener("registration", async (token) => {
    await registerCoachPushToken(token?.value || "", nativeCoachAppPlatform()).catch(() => false);
  });
  await plugin.addListener("registrationError", () => {
    showToast("앱 알림 연결을 확인해 주세요.");
  });
  await plugin.addListener("pushNotificationReceived", async () => {
    await syncLiveNotices().catch(() => false);
  });
  await plugin.addListener("pushNotificationActionPerformed", async (action) => {
    const data = coachNotificationData(action);
    if (!(await authorizeCoachNotificationAction(data))) return;
    const route = coachNotificationRoute(data);
    const viewId = route === "schedule"
      ? "fullScheduleView"
      : ["member", "membership"].includes(route)
        ? "membersView"
        : "todayView";
    await Promise.allSettled([
      syncLiveNotices(),
      ["today", "dashboard", "schedule", "feedback"].includes(route)
        ? syncCoachLessonsFromServer()
        : Promise.resolve(false),
      route === "feedback" ? syncCoachJournalEntriesFromServer() : Promise.resolve(false),
    ]);
    renderAll();
    setView(viewId);
    openCoachNotificationTarget(data, route);
  });
  coachPushListenersReady = true;
}

async function syncNativeCoachPushRegistration(profile = null, requestPermission = false) {
  const plugin = nativeCoachPushPlugin();
  const platform = nativeCoachAppPlatform();
  coachPushProfileId = profile?.id || state.liveProfileId || "";
  if (!plugin || !["android", "ios"].includes(platform)) {
    setCoachPushNotificationState("unavailable", "설치 앱에서 사용 가능", "휴대폰에 설치한 Tennis Note 앱에서 수업 알림을 켤 수 있습니다.");
    return false;
  }
  if (!coachPushProfileId || !window.TennisNoteDataClient?.getSession?.()?.access_token) {
    setCoachPushNotificationState("unknown", "로그인 후 알림 설정", "코치 로그인 후 기기 알림을 연결할 수 있습니다.");
    return false;
  }
  if (!coachPushPreferenceEnabled()) {
    setCoachPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
    return false;
  }
  await bindNativeCoachPushListeners(plugin);
  if (platform === "android") {
    await plugin.createChannel?.({
      id: "lesson-reminders",
      name: "수업·회원권 알림",
      description: "수업 일정과 처리할 기록 알림",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  let permission = await plugin.checkPermissions?.().catch(() => null);
  if (requestPermission && ["prompt", "prompt-with-rationale"].includes(permission?.receive)) {
    permission = await plugin.requestPermissions?.().catch(() => permission);
  }
  if (permission?.receive === "denied") {
    setCoachPushNotificationState("denied", "휴대폰 알림이 꺼져 있음", "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.");
    return false;
  }
  if (permission?.receive !== "granted") {
    setCoachPushNotificationState("prompt", "알림 허용 필요", "알림 켜기를 누르면 다음 수업과 미처리 기록을 알려드립니다.");
    scheduleNativeCoachPushPrimer();
    return false;
  }
  setCoachPushNotificationState("granted", "앱 알림 연결됨", "내 수업 변경과 처리할 기록을 이 기기로 알려드립니다.");
  await plugin.register();
  return true;
}

async function enableNativeCoachPush() {
  try {
    localStorage.removeItem(coachPushPrimerDeferredStorageKey);
  } catch {
    // Continue with the native permission request.
  }
  setCoachPushPreferenceEnabled(true);
  closeCoachModal("coachPushPrimerModal");
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  await syncNativeCoachPushRegistration(null, true).catch(() => {
    setCoachPushNotificationState("unknown", "알림 연결 실패", "네트워크와 휴대폰 알림 설정을 확인한 뒤 다시 시도해 주세요.");
  });
}

async function disableNativeCoachPush() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    setCoachPushNotificationState("unknown", "알림 끄기 실패", "로그인과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    return false;
  }
  await client.rpc("tn_disable_push_device", {
    target_device_id: currentCoachPushDeviceId(),
  });
  setCoachPushPreferenceEnabled(false);
  setCoachPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
  return true;
}

async function toggleNativeCoachPush() {
  if (coachPushUiState.permission === "granted" && coachPushPreferenceEnabled()) {
    await disableNativeCoachPush().catch(() => {
      setCoachPushNotificationState("unknown", "알림 끄기 실패", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    });
    return;
  }
  if (coachPushUiState.permission === "denied") {
    showToast("휴대폰 설정에서 Tennis Note 알림을 허용한 뒤 다시 눌러 주세요.");
    return;
  }
  await enableNativeCoachPush();
}

async function disableNativeCoachPushForLogout() {
  const client = window.TennisNoteDataClient;
  if (client?.getSession?.()?.access_token && client?.rpc) {
    await client.rpc("tn_disable_push_device", {
      target_device_id: currentCoachPushDeviceId(),
    }).catch(() => null);
  }
  coachPushProfileId = "";
  setCoachPushNotificationState("unknown", "로그인 후 알림 설정", "코치 로그인 후 기기 알림을 연결할 수 있습니다.");
}

function blurActiveCoachFormControl() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches("input, textarea, select")) return false;
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const keyboardVisible = Boolean(viewport && layoutHeight - viewport.height - viewport.offsetTop > 96);
  active.blur();
  return keyboardVisible;
}

async function installNativeCoachBackNavigation() {
  if (nativeCoachBackListenerReady || nativeCoachAppPlatform() !== "android") return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  nativeCoachBackListenerReady = true;
  await appPlugin.addListener("backButton", async () => {
    if (blurActiveCoachFormControl()) return;
    if (!$("#noticeDialog")?.hidden) {
      closeNotice(false);
      return;
    }
    if (activeCoachModalId) {
      closeCoachModal(activeCoachModalId);
      return;
    }
    const activeView = $(".view.is-active")?.id || "todayView";
    if (!$("#coachAppScreen")?.hidden && activeView !== "todayView") {
      setView("todayView", { replaceHistory: true });
      return;
    }
    if (!$("#coachAppScreen")?.hidden) {
      openUserMode();
      return;
    }
    const minimized = await appPlugin.minimizeApp?.().then(() => true).catch(() => false);
    if (!minimized) await appPlugin.exitApp?.().catch(() => undefined);
  });
}

function coachFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function refreshCoachModalState() {
  const modalOpen = Boolean(activeCoachModalId);
  document.body.classList.toggle("modal-open", modalOpen);
  const tabbar = $(".tabbar");
  if (tabbar) {
    if (modalOpen) tabbar.setAttribute("aria-hidden", "true");
    else tabbar.removeAttribute("aria-hidden");
  }
}

function openCoachModal(modalId) {
  const modal = $(`#${modalId}`);
  if (!modal) return;
  if (activeCoachModalId && activeCoachModalId !== modalId) closeCoachModal(activeCoachModalId, true);
  coachModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  activeCoachModalId = modalId;
  refreshCoachModalState();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteModal !== modalId) {
    history.pushState({ ...historyState, tennisNoteMode: "coach", tennisNoteModal: modalId }, "", window.location.href);
  }
  window.setTimeout(() => coachFocusableElements(modal)[0]?.focus({ preventScroll: true }), 40);
}

function closeCoachModal(modalId, fromHistory = false) {
  const modal = $(`#${modalId}`);
  if (!modal) return;
  modal.hidden = true;
  if (activeCoachModalId === modalId) activeCoachModalId = "";
  refreshCoachModalState();
  if (!fromHistory && history.state?.tennisNoteModal === modalId) {
    history.back();
    return;
  }
  coachModalReturnFocus?.focus?.({ preventScroll: true });
  coachModalReturnFocus = null;
}

function setView(viewId, options = {}) {
  if (!viewId || !$("#" + viewId)) return;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  const profileButton = $("#coachProfileButton");
  if (profileButton) {
    const profileActive = viewId === "coachProfileView";
    profileButton.classList.toggle("is-active", profileActive);
    profileButton.setAttribute("aria-pressed", String(profileActive));
  }
  const screenTitles = {
    todayView: "오늘",
    fullScheduleView: "레슨표",
    membersView: "회원",
    curriculumView: "커리큘럼",
    coachProfileView: "내 정보",
  };
  if ($("#coachScreenTitle")) $("#coachScreenTitle").textContent = screenTitles[viewId] || "코치 모드";
  document.body.dataset.activeView = viewId;
  jumpToTop();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  const nextState = { ...historyState, tennisNoteMode: "coach", tennisNoteView: viewId };
  delete nextState.tennisNoteModal;
  if (options.pushHistory && historyState.tennisNoteView !== viewId) history.pushState(nextState, "", window.location.href);
  else if (!historyState.tennisNoteView || options.replaceHistory) history.replaceState(nextState, "", window.location.href);
}

function navigateCoachView(viewId) {
  setView(viewId, { pushHistory: true });
}

function renderSummary() {
  const ownLessons = ownTodayLessons();
  const regularCount = ownLessons.filter((lesson) => !isMakeupLesson(lesson)).length;
  const makeupLessonCount = ownLessons.filter(isMakeupLesson).length;
  const makeupPendingCount = ownPendingMakeupRequests().length + ownOpenMakeupEntitlements().length;
  const pendingLessonLogs = ownPendingLessonLogs().length;
  const pendingFeedback = ownPendingFeedbackRequests().length;
  const pendingRecordTotal = pendingLessonLogs + pendingFeedback;
  const pendingSyncCount = coachPendingSyncLogs().length;
  $("#todayLessonCount").textContent = `${ownLessons.length}개`;
  if ($("#todayLessonSummaryNote")) $("#todayLessonSummaryNote").textContent = ownLessons.length ? `정규 ${regularCount} · 보강 ${makeupLessonCount}` : "오늘 수업 없음";
  $("#makeupPendingCount").textContent = `${makeupPendingCount}건`;
  if ($("#makeupSummaryNote")) $("#makeupSummaryNote").textContent = makeupPendingCount ? `처리 대기 ${makeupPendingCount}건` : "대기 없음";
  $("#logPendingCount").textContent = `${pendingRecordTotal}건`;
  if ($("#recordSummaryNote")) {
    $("#recordSummaryNote").textContent = pendingSyncCount
      ? `동기화 대기 ${pendingSyncCount}건`
      : pendingRecordTotal
        ? `완료 처리 ${pendingRecordTotal}건`
        : "처리 없음";
  }
  if ($("#recordRequiredNote")) {
    $("#recordRequiredNote").textContent = pendingRecordTotal
      ? `미처리 ${pendingRecordTotal}건 · 완료할 수업을 선택해 처리하세요.`
      : "오늘 처리할 기록이 없습니다.";
  }
}

function renderCoachModeList() {
  if (!state.coach) {
    if ($("#coachModeList")) {
      $("#coachModeList").innerHTML = "";
      $("#coachModeList").hidden = true;
    }
    return;
  }
  const coaches = approvedCoachesFromAdmin();
  const markup = coaches
    .map(
      (coach) => `
        <button class="coach-mode-chip ${canonicalCoachName(state.coach?.name || state.selectedCoachName) === canonicalCoachName(coach.name) ? "is-active" : ""}" type="button" data-select-coach-mode="${coach.name}">
          <strong>${coach.name}</strong>
          <span>${coach.role} · 코치모드 생성됨</span>
        </button>`,
    )
    .join("");
  if ($("#coachModeList")) {
    $("#coachModeList").hidden = true;
    $("#coachModeList").innerHTML = markup;
  }
}

function requestCoach(request) {
  if (request.coach) return request.coach;
  const exactMember = state.members.find((member) => member.name === request.member);
  if (exactMember?.coach) return exactMember.coach;
  const groupedMember = state.members.find((member) => member.name.includes(request.member));
  if (groupedMember?.coach) return groupedMember.coach;
  const requested = String(request.requested || "");
  return requested.includes("강") ? "강 코치" : requested.includes("황") ? "황 코치" : "노 코치";
}

function currentCoachName() {
  return canonicalCoachName(state.coach?.name || state.selectedCoachName || approvedCoachesFromAdmin()[0]?.name || "노 코치");
}

function currentCoachRoleId() {
  return String(state.coach?.coachRoleId || "").trim();
}

function lessonBelongsToCurrentCoach(lesson = {}) {
  const roleId = currentCoachRoleId();
  const lessonRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
  if (roleId && lessonRoleId) return roleId === lessonRoleId;
  return canonicalCoachName(lesson.coach) === currentCoachName();
}

function lessonAssignedToCurrentCoachForTasks(lesson = {}) {
  const roleId = currentCoachRoleId();
  const lessonRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
  const substituteRoleId = String(lesson.substituteCoachRoleId || lesson.substitute_coach_role_id || "").trim();
  if (lesson.isSubstitute || substituteRoleId) {
    if (roleId && substituteRoleId) return roleId === substituteRoleId;
    return canonicalCoachName(lesson.coach) === currentCoachName();
  }
  if (roleId && lessonRoleId) return roleId === lessonRoleId;
  return lessonBelongsToCurrentCoach(lesson);
}

function ownTodayLessons() {
  const currentLessons = state.liveLessonsLoaded || state.dataMode === "live"
    ? weekLessons().filter((lesson) => lesson.lessonDate === localDateKey())
    : weekLessons();
  return currentLessons.filter((lesson) => (
    lessonAssignedToCurrentCoachForTasks(lesson)
    && !lesson.releasedMakeupSlot
    && lesson.status !== "available"
  ));
}

function isMakeupLesson(lesson) {
  return `${lesson.type || ""} ${lesson.status || ""}`.includes("보강");
}

function pendingMakeupRequests() {
  return state.makeupRequests.filter((request) => request.status === "승인 대기");
}

function ownPendingMakeupRequests() {
  return pendingMakeupRequests().filter((request) => canonicalCoachName(requestCoach(request)) === currentCoachName());
}

function ownOpenMakeupEntitlements() {
  return (state.makeupEntitlements || []).filter((item) => (
    item.status === "open"
    && canonicalCoachName(item.coach) === currentCoachName()
  ));
}

function memberForLesson(lesson) {
  const names = String(lesson?.member || "")
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
  return (
    state.members.find((member) => member.name === lesson?.member) ||
    state.members.find((member) => names.includes(member.name)) ||
    state.members.find((member) => names.some((name) => member.name.includes(name))) ||
    null
  );
}

function recentLogForLesson(lesson) {
  const names = String(lesson?.member || "")
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
  return state.lessonLogs.find((log) => log.member === lesson?.member || names.includes(log.member) || names.some((name) => log.member.includes(name)));
}

function completionParticipantsForLesson(lesson) {
  const v2Participants = Array.isArray(lesson?.v2Participants) ? lesson.v2Participants : [];
  if (v2Participants.length) return v2Participants;
  return [{
    userId: lesson?.memberUserIds?.[0] || "",
    ticketId: lesson?.ticketId || "",
    name: lesson?.member || "회원",
    ticketName: lesson?.ticket || "회원권",
    totalSessions: Number(lesson?.totalSessions) || 0,
    usedSessions: Number(lesson?.usedSessions) || 0,
    remainingSessions: Number(lesson?.remaining) || 0,
  }];
}

function recentLogForParticipant(participant, lesson) {
  const exact = state.lessonLogs.find((log) => (
    Array.isArray(log.participantResults)
    && log.participantResults.some((result) => (
      String(result.userId || "") === String(participant.userId || "")
      && String(result.ticketId || "") === String(participant.ticketId || "")
    ))
  ));
  if (exact) return exact;
  const byName = state.lessonLogs.find((log) => recordMemberNames(log.member).includes(participant.name));
  return byName || recentLogForLesson(lesson);
}

function participantLogResult(log, participant) {
  const exact = Array.isArray(log?.participantResults)
    ? log.participantResults.find((result) => (
      String(result.userId || "") === String(participant.userId || "")
      && String(result.ticketId || "") === String(participant.ticketId || "")
    ))
    : null;
  return exact || null;
}

function completionDraftResultsForLog(log) {
  if (Array.isArray(log?.participantResults) && log.participantResults.length) return log.participantResults;
  return [{
    userId: "",
    ticketId: "",
    name: log?.member || "회원",
    ticketName: "",
    totalSessions: 0,
    usedSessions: 0,
    remainingSessions: 0,
    coachComment: log?.coachComment || "",
    nextCurriculumId: log?.nextCurriculumId || log?.curriculumId || "",
  }];
}

function canProcessLesson(lesson) {
  if (!lesson) return false;
  if (!lessonAssignedToCurrentCoachForTasks(lesson)) return false;
  if (lesson.v2Permissions) return lesson.v2Permissions.canProcess === true;
  return true;
}

function lessonOutcomeWindowOpen(lesson, now = new Date()) {
  if (!lesson) return false;
  const lessonDate = String(lesson.lessonDate || lesson.lesson_date || "").trim();
  const lessonTime = String(lesson.time || lesson.startTime || lesson.start_time || "").slice(0, 5);
  const strictLiveLesson = Boolean(state.dataMode === "live" || state.liveProfileId || lesson.serverLessonId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate) || !/^\d{2}:\d{2}$/.test(lessonTime)) {
    return !strictLiveLesson;
  }
  const today = localDateKey(now);
  if (lessonDate < today) return true;
  if (lessonDate > today) return false;
  const startMinutes = minutesFromTime(lessonTime);
  if (!Number.isFinite(startMinutes)) return !strictLiveLesson;
  const durationMinutes = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= startMinutes + durationMinutes;
}

function lessonOutcomeGuardMessage() {
  return "수업 종료 후 피드백 완료와 회원권 횟수 차감을 처리할 수 있습니다.";
}

function transferredTodayLessons() {
  const currentLessons = state.liveLessonsLoaded || state.dataMode === "live"
    ? weekLessons().filter((lesson) => lesson.lessonDate === localDateKey())
    : weekLessons();
  return currentLessons.filter((lesson) => (
    lesson.isSubstitute
    && canonicalCoachName(lesson.originalCoach) === currentCoachName()
    && canonicalCoachName(lesson.coach) !== currentCoachName()
    && !lesson.releasedMakeupSlot
  ));
}

function canRescheduleLesson(lesson) {
  if (!lesson) return false;
  if (!lessonAssignedToCurrentCoachForTasks(lesson)) return false;
  if (lesson.v2Permissions && lesson.v2Permissions.canEdit !== true) return false;
  if (lesson.serverStatus) return lesson.serverStatus === "scheduled";
  return !["완료", "취소", "노쇼", "변경 요청"].includes(lesson.status);
}

function canMarkRegularLessonAbsent(lesson) {
  return canRescheduleLesson(lesson) && String(lesson.lessonSource || lesson.lesson_source || "regular") === "regular";
}

function recordMemberNames(value = "") {
  return String(value)
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
}

function lessonForRecord(record = {}) {
  if (record.serverLessonId) {
    const serverLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === record.serverLessonId);
    return serverLesson || null;
  }
  const names = recordMemberNames(record.member);
  return weekLessons().find((lesson) => {
    const lessonNames = recordMemberNames(lesson.member);
    if (!names.some((name) => lessonNames.includes(name))) return false;
    const lessonLabel = String(record.lesson || "");
    return (!lesson.day || lessonLabel.includes(lesson.day)) && (!lesson.time || lessonLabel.includes(lesson.time));
  }) || null;
}

function coachRecordLessonMeta(record = {}) {
  const lesson = lessonForRecord(record);
  if (!lesson) {
    return {
      schedule: String(record.lesson || "수업 시간 확인 필요"),
      round: "회차 확인 필요",
      ticket: "회원권 확인 필요",
    };
  }
  const date = String(lesson.lessonDate || "");
  const [, month, day] = date.split("-");
  const dateLabel = month && day
    ? `${Number(month)}/${Number(day)}(${lesson.day || ""})`
    : lesson.day || "날짜 확인";
  const round = coachScheduleRoundLabel(lesson);
  return {
    schedule: `${dateLabel} ${lesson.time || "시간 확인"}`.trim(),
    round: round === "0/0회차" ? "회차 미연결" : round,
    ticket: String(lesson.ticket || lesson.type || "회원권 확인 필요"),
  };
}

function coachRecordLessonMetaMarkup(record = {}) {
  const meta = coachRecordLessonMeta(record);
  return `
    <div class="record-lesson-meta" aria-label="처리할 수업 정보">
      <b>${escapeHtml(meta.schedule)}</b>
      <span>${escapeHtml(meta.round)}</span>
      <small>${escapeHtml(meta.ticket)}</small>
    </div>`;
}

function memberForRecord(record = {}) {
  const names = recordMemberNames(record.member);
  return state.members.find((member) => names.includes(member.name))
    || state.members.find((member) => names.some((name) => member.name.includes(name) || name.includes(member.name)))
    || null;
}

function recordBelongsToCurrentCoach(record = {}) {
  const lesson = lessonForRecord(record);
  if (lesson) return lessonAssignedToCurrentCoachForTasks(lesson) && canProcessLesson(lesson);
  if (record.serverLessonId) return false;
  const member = memberForRecord(record);
  return Boolean(member?.coach && canonicalCoachName(member.coach) === currentCoachName());
}

function feedbackBelongsToCurrentCoach(request = {}) {
  const lessonId = String(request.lessonId || request.lesson_id || request.serverLessonId || "").trim();
  if (lessonId) {
    const lesson = [...(state.liveLessons || []), ...(state.todayLessons || [])].find((item) => (
      String(item.serverLessonId || item.id || "") === lessonId
    ));
    return Boolean(lesson && lessonAssignedToCurrentCoachForTasks(lesson) && canProcessLesson(lesson));
  }
  const targetCoachRoleId = String(
    request.coachRoleId || request.coach_role_id || request.targetCoachRoleId || request.target_coach_role_id || "",
  ).trim();
  if (targetCoachRoleId && currentCoachRoleId()) return targetCoachRoleId === currentCoachRoleId();
  if (state.dataMode === "live" || state.liveProfileId) return false;
  return canonicalCoachName(requestCoach(request)) === currentCoachName();
}

function ownPendingLessonLogs() {
  return state.lessonLogs.filter((log) => {
    if (log.status === "확인 완료" || !recordBelongsToCurrentCoach(log)) return false;
    const lesson = lessonForRecord(log);
    return lesson ? lessonOutcomeWindowOpen(lesson) : !(state.dataMode === "live" || state.liveProfileId);
  });
}

function ownPendingFeedbackRequests() {
  return state.feedbackRequests.filter((request) => request.status !== "코치 답변 완료" && feedbackBelongsToCurrentCoach(request));
}

const completedFeedbackVisibilityMs = 24 * 60 * 60 * 1000;

function completedFeedbackTimestamp(item = {}) {
  return item.completedAt
    || item.completed_at
    || item.confirmedAt
    || item.answeredAt
    || item.updatedAt
    || item.updated_at
    || "";
}

function completedFeedbackVisibleForOneDay(item = {}, now = Date.now()) {
  const completedAt = Date.parse(completedFeedbackTimestamp(item));
  if (!Number.isFinite(completedAt)) return state.dataMode !== "live" && !state.liveProfileId;
  const elapsed = now - completedAt;
  return elapsed >= 0 && elapsed < completedFeedbackVisibilityMs;
}

function ownCompletedLessonLogs() {
  return state.lessonLogs.filter((log) => (
    log.status === "확인 완료"
    && recordBelongsToCurrentCoach(log)
    && completedFeedbackVisibleForOneDay(log)
  ));
}

function ownCompletedFeedbackRequests() {
  return state.feedbackRequests.filter((request) => (
    request.status === "코치 답변 완료"
    && feedbackBelongsToCurrentCoach(request)
    && completedFeedbackVisibleForOneDay(request)
  ));
}

function coachRecordStatusFilter() {
  return state.recordStatusFilter === "completed" ? "completed" : "pending";
}

function lessonPermissionText(lesson) {
  if (canRescheduleLesson(lesson)) return "내 수업이라 일정 수정과 완료 처리가 가능합니다.";
  if (canProcessLesson(lesson)) return "내 수업 완료 처리와 피드백 작성이 가능합니다.";
  return "다른 코치 수업은 같은 지점 공유용으로 확인만 가능합니다.";
}

function pendingRecordTotal() {
  return ownPendingLessonLogs().length + ownPendingFeedbackRequests().length;
}

function todayTaskTab() {
  return ["lessons", "makeup", "records"].includes(state.todayTaskTab) ? state.todayTaskTab : "lessons";
}

function isTodayTaskExpanded(tab) {
  return Boolean(state.expandedTodayTasks?.[tab]);
}

function todayTaskVisibleItems(items, tab) {
  return isTodayTaskExpanded(tab) ? items : items.slice(0, 3);
}

function todayTaskToggleButton(items, tab) {
  if (items.length <= 3) return "";
  return `
    <button class="small-button task-more-button" type="button" data-toggle-task-list="${tab}">
      ${isTodayTaskExpanded(tab) ? "접기" : `전체 보기 ${items.length}개`}
    </button>`;
}

function renderTodayTaskTabs({ lessonCount, makeupCount, recordCount }) {
  const active = todayTaskTab();
  const tabs = [
    { id: "lessons", label: "오늘 내 수업", count: lessonCount },
    { id: "makeup", label: "내 승인·보강", count: makeupCount },
    { id: "records", label: "내 미처리", count: recordCount },
  ];
  return `
    <div class="today-task-tabs" role="tablist" aria-label="오늘 처리 일정 구분">
      ${tabs
        .map(
          (tab) => `
            <button class="today-task-tab ${active === tab.id ? "is-active" : ""}" type="button" role="tab" aria-selected="${active === tab.id}" data-today-task-tab="${tab.id}">
              <span>${tab.label}</span>
              <b>${tab.count}</b>
            </button>`,
        )
        .join("")}
    </div>`;
}

function openTodayTaskTab(tab, shouldScroll = true) {
  state.todayTaskTab = ["lessons", "makeup", "records"].includes(tab) ? tab : "lessons";
  setView("todayView");
  renderAll();
  if (shouldScroll) {
    requestAnimationFrame(() => {
      document.querySelector("#todayView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function toggleTodayTaskList(tab) {
  state.expandedTodayTasks = {
    ...(state.expandedTodayTasks || {}),
    [tab]: !isTodayTaskExpanded(tab),
  };
  renderAll();
}

function minutesFromTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function lessonDuration(lesson) {
  const text = `${lesson.type || ""} ${lesson.ticket || ""}`;
  const matched = text.match(/(\d+)\s*분/);
  return matched ? Number(matched[1]) : 20;
}

function todayLessonPriority(lesson = {}, now = new Date()) {
  const start = minutesFromTime(String(lesson.time || ""));
  const current = now.getHours() * 60 + now.getMinutes();
  if (!Number.isFinite(start)) return { group: 3, distance: Number.MAX_SAFE_INTEGER, start: Number.MAX_SAFE_INTEGER };
  const end = start + Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  if (start <= current && current < end) return { group: 0, distance: 0, start };
  if (start > current) return { group: 1, distance: start - current, start };
  return { group: 2, distance: current - end, start: -start };
}

function compareTodayLessonsByNearest(left, right, now = new Date()) {
  const leftPriority = todayLessonPriority(left, now);
  const rightPriority = todayLessonPriority(right, now);
  return leftPriority.group - rightPriority.group
    || leftPriority.distance - rightPriority.distance
    || leftPriority.start - rightPriority.start;
}

function lessonCreditUnits(lesson = {}) {
  const duration = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const ticketUnit = Math.max(1, Number(lesson.ticketLessonMinutes) || duration);
  return Math.max(1, Math.ceil(duration / ticketUnit));
}

function lessonDurationUsageLabel(lesson = {}) {
  const duration = Math.max(1, Number(lesson.durationMinutes) || lessonDuration(lesson));
  const units = lessonCreditUnits(lesson);
  return `${duration}분${units > 1 ? ` · ${units}회 사용` : ""}`;
}

function coachScheduleRoundLabel(lesson = {}) {
  const ticketTotal = Number(lesson.totalSessions) || Number(String(lesson.ticket || "").match(/(\d+)\s*회/)?.[1]) || 0;
  const used = Math.max(0, Number(lesson.usedSessions) || Math.max(0, ticketTotal - (Number(lesson.remaining) || 0)));
  const completed = Number(lesson.deductedSessions) > 0;
  const round = ticketTotal ? Math.min(ticketTotal, completed ? Math.max(1, used) : used + 1) : 0;
  return `${round}/${ticketTotal}회차`;
}

function coachScheduleExceptionLabel(lesson = {}) {
  if (lesson.releasedOriginLabel) return lesson.releasedOriginLabel;
  const context = `${lesson.lessonSource || ""} ${lesson.type || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`;
  let detail = "";
  if ((lesson.originalCoachRoleId && lesson.coachRoleId && lesson.originalCoachRoleId !== lesson.coachRoleId) || /대타/.test(context)) detail = "대타";
  else if (/코치\s*변경/.test(context)) detail = "코치 변경";
  else if (/시간\s*변경|변경\s*완료/.test(context)) detail = "시간 변경";
  const cardState = coachLessonCardState(lesson);
  const stateLabel = cardState.id === "scheduled" ? "" : cardState.label;
  return stateLabel ? `${stateLabel}${detail ? ` · ${detail}` : ""}` : detail;
}

function coachLessonCardState(lesson = {}, now = new Date()) {
  const status = String(lesson.serverStatus || lesson.status || "").toLowerCase();
  const participants = Array.isArray(lesson.v2Participants) ? lesson.v2Participants : [];
  const finalParticipants = participants.filter((participant) => String(participant.recordStatus || "") === "final");
  const incompleteCount = Math.max(0, participants.length - finalParticipants.length);
  const outcomes = finalParticipants.map((participant) => String(participant.outcome || "completed").toLowerCase());
  const deducted = Number(lesson.deductedSessions) > 0
    || finalParticipants.some((participant) => Number(participant.deductedSessions) > 0);
  if (/pending_change|변경 요청/.test(status)) {
    return { id: "approval", label: "승인 대기", className: "record-approval", needsFeedback: false };
  }
  if (outcomes.includes("no_show") || status === "no_show" || status === "노쇼") {
    return { id: "no_show", label: `노쇼 · ${deducted ? "1회 차감" : "차감 없음"}`, className: "record-problem outcome-no-show", needsFeedback: false };
  }
  if (outcomes.includes("absence") || status === "absent" || status === "불참") {
    return { id: "absence", label: `불참 · ${deducted ? "1회 차감" : "차감 없음"}`, className: "record-neutral outcome-absence", needsFeedback: false };
  }
  if (lessonOutcomeWindowOpen(lesson, now) && ((!participants.length && !["cancelled", "취소"].includes(status)) || incompleteCount > 0)) {
    const label = participants.length > 1
      ? `${participants.length}명 중 ${incompleteCount}명 미작성`
      : "피드백 필요";
    return { id: "feedback_pending", label, className: "record-problem", needsFeedback: true };
  }
  if (participants.length && finalParticipants.length === participants.length) {
    return { id: "feedback_complete", label: "피드백 완료", className: "record-complete", needsFeedback: false };
  }
  return { id: "scheduled", label: "예정", className: "record-planned", needsFeedback: false };
}

function coachLessonStateClass(lesson = {}) {
  return coachLessonCardState(lesson).className;
}

function coachLessonVisualKind(lesson = {}) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  if (lesson.releasedMakeupSlot || lesson.status === "available") return "released";
  if (["no_show", "cancelled_late"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase())) return "noShow";
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup";
  if (source === "one_day") return "coupon";
  if (source === "coupon" || String(lesson.type || "").includes("쿠폰")) return "coupon";
  if (lessonDuration(lesson) === 30) return "regular30";
  return "regular";
}

function coachScheduleLessonActionAttrs(lesson = {}) {
  if (lesson.oneDayBooking) {
    return `disabled aria-label="${lesson.member || "원데이"} 원데이 예약"`;
  }
  if (!canProcessLesson(lesson) && !canRescheduleLesson(lesson)) {
    return `disabled aria-label="${lesson.member || "회원"} 다른 코치 수업 읽기 전용"`;
  }
  if (lesson.releasedMakeupSlot) {
    if (lesson.historicalReleasedSlot) {
      return `disabled aria-label="${lesson.member || "회원"} 과거 정규 불참 기록"`;
    }
    return `data-restore-absence-id="${lesson.entitlementId || ""}" aria-label="${lesson.member || "회원"} 정규수업 복원"`;
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function coachLessonColorStyle(lesson, policy) {
  const kind = coachLessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const changed = ["makeup", "coupon"].includes(kind);
  const fallback = { regular: "#2f6fc4", regular30: "#2f6fc4", makeup: "#7357ad", coupon: "#7357ad", noShow: "#7357ad" };
  const custom = (policy?.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  const saved = changed
    ? policy?.lessonColors?.changed || ""
    : custom?.color || policy?.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function currentCoachProfile() {
  ensureMemberLists();
  const name = currentCoachName();
  return state.coachProfiles[name] || state.coachProfiles["노 코치"] || {};
}

function coachSettlementMonth() {
  const fallback = localDateKey().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(String(state.settlementMonth || ""))) state.settlementMonth = fallback;
  return state.settlementMonth;
}

function formatCoachWon(value) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.round(Number(value) || 0)))}원`;
}

function coachSettlementRuleLabel(settlement = {}) {
  if (settlement.ruleType === "hourly") return `시급 ${formatCoachWon(settlement.hourlyRate)}`;
  const rate = Math.round((Number(settlement.ruleRate) || 0) * 100);
  const basis = settlement.settlementBasis === "actual_paid_inc_vat" ? "실결제" : "정산 기준가";
  const calculation = settlement.calculationMode === "monthly_payment" ? "월 결제액" : "진행 횟수";
  return `${calculation} · ${basis}의 ${rate}%`;
}

function normalizedCoachSettlementMemberName(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function coachSettlementRowsForMember(member = {}) {
  const settlementRows = Array.isArray(state.coachSettlement?.rows) ? state.coachSettlement.rows : [];
  const memberNames = member.isGroupDisplay
    ? [member.groupMemberName, member.displayName]
    : [member.displayName, member.name];
  const normalizedNames = new Set(memberNames.map(normalizedCoachSettlementMemberName).filter(Boolean));
  if (!normalizedNames.size) return [];
  return settlementRows.filter((row) => normalizedNames.has(normalizedCoachSettlementMemberName(row.memberName)));
}

function coachMemberSettlementSummary(member = {}) {
  const rows = coachSettlementRowsForMember(member);
  if (!rows.length) {
    return {
      linked: false,
      sessions: 0,
      amount: 0,
      label: state.coachSettlementLoading ? "정산 확인 중" : "정산 연결 확인 필요",
    };
  }
  const sessions = rows.reduce((sum, row) => sum + (Number(row.settledSessions) || 0), 0);
  const amount = rows.reduce((sum, row) => sum + (Number(row.estimatedSettlement) || 0), 0);
  return {
    linked: true,
    sessions,
    amount,
    label: `${sessions}회 · ${formatCoachWon(amount)}`,
  };
}

function renderVisibleMemberSettlement() {
  const target = $("#memberDetailSettlementValue");
  if (!target || !state.viewingMemberDetailId) return;
  const member = findMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
  if (!member) return;
  const summary = coachMemberSettlementSummary(member);
  target.textContent = summary.label;
  target.dataset.linked = String(summary.linked);
}

function renderCoachSettlement() {
  const monthInput = $("#coachSettlementMonth");
  if (monthInput && monthInput.value !== coachSettlementMonth()) monthInput.value = coachSettlementMonth();
  const settlement = state.coachSettlement || {};
  const status = $("#coachSettlementStatus");
  if (status) {
    status.hidden = !state.coachSettlementLoading && !state.coachSettlementError;
    status.dataset.tone = state.coachSettlementError ? "danger" : "wait";
    status.textContent = state.coachSettlementError || (state.coachSettlementLoading ? "정산 자료를 불러오는 중입니다." : "");
  }
  const retryButton = $("#refreshCoachSettlement");
  if (retryButton) retryButton.hidden = !state.coachSettlementError;
  if ($("#coachRevenueAmount")) $("#coachRevenueAmount").textContent = formatCoachWon(settlement.revenueAmount);
  if ($("#coachRevenueCount")) $("#coachRevenueCount").textContent = `결제 ${Number(settlement.paymentCount) || 0}건`;
  if ($("#coachSettledSessions")) $("#coachSettledSessions").textContent = `${Number(settlement.settledSessions) || 0}회`;
  if ($("#coachEstimatedSettlement")) $("#coachEstimatedSettlement").textContent = formatCoachWon(settlement.estimatedSettlement);
  if ($("#coachSettlementRule")) {
    const substitute = Number(settlement.substituteSettlement) || 0;
    $("#coachSettlementRule").textContent = settlement.ruleType
      ? `${coachSettlementRuleLabel(settlement)}${substitute ? ` · 대타 ${formatCoachWon(substitute)}` : ""}`
      : "정산 규칙 확인 중";
  }
  const compactAmount = $("#coachSettlementCompactAmount");
  const compactMeta = $("#coachSettlementCompactMeta");
  if (compactAmount) {
    compactAmount.textContent = state.coachSettlementLoading
      ? "확인 중"
      : state.coachSettlementError
        ? "다시 확인"
        : formatCoachWon(settlement.estimatedSettlement);
  }
  if (compactMeta) {
    compactMeta.textContent = state.coachSettlementError
      ? "정산 자료를 불러오지 못했습니다. 눌러서 다시 시도하세요."
      : state.coachSettlementLoading
        ? "정산 자료를 불러오는 중입니다."
        : `결제 ${Number(settlement.paymentCount) || 0}건 · 수업 ${Number(settlement.settledSessions) || 0}회`;
  }
  const rows = Array.isArray(settlement.rows) ? settlement.rows : [];
  const rowsTarget = $("#coachSettlementRows");
  if (rowsTarget) {
    rowsTarget.innerHTML = rows.length
      ? rows.map((row) => `
        <article>
          <div>
            <strong>${escapeHtml(row.memberName || "회원")}</strong>
            <span>${escapeHtml(row.productName || "회원권")} · ${escapeHtml(String(row.method || "결제수단 미입력"))}</span>
          </div>
          <div>
            <b>${formatCoachWon(row.estimatedSettlement)}</b>
            <small>매출 ${formatCoachWon(row.amount)} · 정산 ${Number(row.settledSessions) || 0}/${Number(row.totalSessions) || 0}회</small>
          </div>
        </article>`).join("")
      : coachEmptyState({
        title: state.coachSettlementLoading ? "정산 자료를 확인하고 있습니다." : "선택한 달의 내 담당 결제가 없습니다.",
        description: "관리자 결제 귀속과 회원권 담당 코치를 확인해 주세요.",
      });
  }
  renderVisibleMemberSettlement();
}

function openCoachSettlement() {
  if (document.body.dataset.activeView !== "membersView") setView("membersView", { pushHistory: true });
  renderCoachSettlement();
  openCoachModal("coachSettlementModal");
}

function closeCoachSettlementModal() {
  closeCoachModal("coachSettlementModal");
}

async function syncCoachSettlementFromServer() {
  const client = window.TennisNoteDataClient;
  if (!state.coach?.coachRoleId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  state.coachSettlementLoading = true;
  state.coachSettlementError = "";
  renderCoachSettlement();
  try {
    const result = await client.rpc("tn_coach_own_settlement", {
      target_month: `${coachSettlementMonth()}-01`,
    });
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("coach_settlement_payload_invalid");
    state.coachSettlement = result;
    return true;
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    state.coachSettlementError = raw.includes("tn_coach_own_settlement") || raw.includes("PGRST202")
      ? "코치 정산 기능을 업데이트하는 중입니다. 잠시 후 다시 확인해 주세요."
      : "정산 자료를 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";
    return false;
  } finally {
    state.coachSettlementLoading = false;
    renderCoachSettlement();
    saveSnapshot();
  }
}

function renderCoachProfile() {
  const name = currentCoachName();
  const profile = currentCoachProfile();
  const badge = $("#coachProfileBadge");
  const profilePerson = { name, profilePhotoUrl: state.coach?.profilePhotoUrl || profile.photo || "" };
  renderPersonAvatar(badge, profilePerson, "large", "coach-profile-badge");
  renderPersonAvatar($("#coachTopAvatar"), profilePerson, "small");
  if ($("#coachProfileName")) $("#coachProfileName").textContent = name;
  if ($("#coachProfileSummary")) $("#coachProfileSummary").textContent = profile.specialty;
  if ($("#coachIntro")) $("#coachIntro").value = profile.intro || "";
  if ($("#coachSpecialty")) $("#coachSpecialty").value = profile.specialty || "";
  if ($("#coachLessonStyle")) $("#coachLessonStyle").value = profile.lessonStyle || "";
  if ($("#coachAvailableMemo")) $("#coachAvailableMemo").value = profile.availableMemo || "";
  if ($("#coachMemberMessage")) $("#coachMemberMessage").value = profile.memberMessage || "";
  renderCoachSettlement();
}

function renderTodayLessons() {
  const schedulePolicy = loadCoachSchedulePolicy();
  const pendingMakeups = state.makeupRequests.filter((request) => request.status === "승인 대기");
  const ownLessons = [...ownTodayLessons()].sort(compareTodayLessonsByNearest);
  const transferredLessons = transferredTodayLessons();
  const ownMakeups = pendingMakeups.filter((request) => canonicalCoachName(requestCoach(request)) === currentCoachName());
  const ownAbsenceMakeups = ownOpenMakeupEntitlements();
  const ownMakeupTasks = [
    ...ownMakeups.map((request) => ({ ...request, taskKind: "approval" })),
    ...ownAbsenceMakeups.map((item) => ({ ...item, taskKind: "absence", requested: "회원 시간 선택 대기" })),
  ];
  const pendingRecordCount = ownPendingLessonLogs().length + ownPendingFeedbackRequests().length;
  const lessonTimes = [...new Set(ownLessons.map((lesson) => lesson.time))].sort((a, b) => a.localeCompare(b));
  const activeTab = todayTaskTab();
  const visibleLessonTimes = todayTaskVisibleItems(lessonTimes, "lessons");
  const visibleMakeups = todayTaskVisibleItems(ownMakeupTasks, "makeup");
  $("#todayLessons").innerHTML = `
    ${renderTodayTaskTabs({ lessonCount: ownLessons.length, makeupCount: ownMakeupTasks.length, recordCount: pendingRecordCount })}
    ${
      activeTab === "lessons"
        ? `<section class="today-task-section" aria-label="오늘 레슨 스케줄 확인">
            <div class="today-task-title"><strong>오늘 수업</strong></div>
            <div class="today-vertical-board" aria-label="오늘 내 수업 세로 시간표">
              ${lessonTimes.length
                ? visibleLessonTimes
                    .map((time) => {
                      const lessons = ownLessons.filter((lesson) => lesson.time === time);
                      return `
                        <section class="today-time-row">
                          <div class="today-time">${time}</div>
                          <div class="today-time-stack">
                            ${lessons
                              .map(
                                (lesson) => `
                                  <button class="board-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${coachColorClass(lesson.coach)} ${coachLessonStateClass(lesson)} ${lesson.remaining <= 2 ? "needs-renewal" : ""}" style="${coachLessonColorStyle(lesson, schedulePolicy)}" type="button" data-edit-lesson-id="${lesson.id}">
                                    <strong>${lesson.member}</strong>
                                    <span>${recentLogForLesson(lesson)?.nextCurriculumId ? `오늘 목표 · ${escapeHtml(selectedCurriculum(recentLogForLesson(lesson).nextCurriculumId).title)}` : `${lesson.type} · ${lessonDurationUsageLabel(lesson)}`}${lesson.isSubstitute ? ` · 대타 · 원 담당 ${lesson.originalCoach || "확인"}` : ""}</span>
                                    <small class="schedule-card-note">${escapeHtml(coachLessonCardState(lesson).label)}</small>
                                  </button>`,
                              )
                              .join("") || "<p class='empty-text'>이 시간에 확정된 레슨은 없습니다.</p>"}
                          </div>
                        </section>`;
                    })
                    .join("")
                : coachEmptyState({
                    title: "오늘 예정된 수업이 없습니다",
                    reason: "담당 수업이 등록되면 시간순으로 표시됩니다.",
                    action: { label: "전체 레슨표 보기", view: "fullScheduleView" },
                    compact: true,
                  })}
            </div>
            ${transferredLessons.length ? `
              <div class="substitute-transfer-list" aria-label="대타 코치 처리 일정">
                ${transferredLessons.map((lesson) => `
                  <article>
                    <strong>${lesson.time} · ${lesson.member}</strong>
                    <span>대타선생님 ${lesson.coach} 처리 일정</span>
                  </article>`).join("")}
              </div>` : ""}
            ${todayTaskToggleButton(lessonTimes, "lessons")}
          </section>`
        : ""
    }
    ${
      activeTab === "makeup"
        ? `<section class="today-task-section" aria-label="보강신청 확인">
            <div class="today-task-title"><strong>보강·변경 요청</strong></div>
            <div class="makeup-alert-list">
              ${ownMakeupTasks.length
                ? visibleMakeups
                    .map(
                      (request) => request.taskKind === "absence"
                        ? `<article class="makeup-alert-card makeup-awaiting-slot">
                            <b>${request.member}</b>
                            <span>${request.original} 불참 처리</span>
                            <small>회원 시간 선택 대기</small>
                          </article>`
                        : `<button class="makeup-alert-card" type="button" data-open-makeup-detail="${request.id}">
                            <b>${request.member}</b>
                            <span>${request.original} → ${request.requested}</span>
                            <small>승인 대기</small>
                          </button>`,
                    )
                    .join("")
                : coachEmptyState({
                    title: "확인할 보강·변경 요청이 없습니다",
                    reason: "새 요청이 접수되면 회원과 요청 시간이 여기에 표시됩니다.",
                    action: { label: "전체 레슨표 보기", view: "fullScheduleView", primary: false },
                    compact: true,
                  })}
            </div>
            ${todayTaskToggleButton(ownMakeupTasks, "makeup")}
          </section>`
        : ""
    }`;
}

function lessonChartParticipantKey(participant = {}, index = 0) {
  return `${participant.userId || participant.name || "member"}:${participant.ticketId || index}`;
}

function lessonChartDraftFor(lesson = {}, participant = {}, index = 0) {
  const lessonDrafts = state.lessonChartDrafts?.[lesson.id] || {};
  return lessonDrafts[lessonChartParticipantKey(participant, index)] || null;
}

function lessonChartParticipantDefaults(lesson, participant, index) {
  const recentLog = recentLogForParticipant(participant, lesson);
  const recentResult = participantLogResult(recentLog, participant);
  const localDraft = lessonChartDraftFor(lesson, participant, index);
  const serverDraft = String(participant.recordStatus || participant.record_status || "") === "draft" ? participant : null;
  const todayGoalId = recentResult?.nextCurriculumId || recentLog?.nextCurriculumId || recentLog?.curriculumId || "";
  const nextCurriculumId = localDraft?.nextCurriculumId
    ?? serverDraft?.nextCurriculumSkillLabel
    ?? serverDraft?.next_curriculum_skill_label
    ?? "";
  const comment = localDraft?.coachComment ?? serverDraft?.coachComment ?? serverDraft?.coach_comment ?? "";
  return {
    comment,
    nextCurriculumId,
    todayGoalId,
    todayGoal: todayGoalId ? selectedCurriculum(todayGoalId)?.title || "선택 안 됨" : "선택 안 됨",
  };
}

function lessonChartFinalized(lesson = {}) {
  const participants = completionParticipantsForLesson(lesson);
  if (participants.length && participants.every((participant) => String(participant.recordStatus || participant.record_status || "") === "final")) return true;
  return ["completed", "no_show", "cancelled"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase());
}

function renderScheduleEditPanel() {
  const lesson = ensureCoachLessonRecord(state.editingLessonId);
  if (!lesson) {
    return `<section class="schedule-edit-panel is-empty"><strong>레슨 카드를 누르면 오늘 레슨을 바로 수정할 수 있습니다.</strong></section>`;
  }
  const canProcess = canProcessLesson(lesson);
  const canFinalize = canProcess && lessonOutcomeWindowOpen(lesson);
  const canReschedule = canRescheduleLesson(lesson);
  const finalized = lessonChartFinalized(lesson);
  const completionParticipants = completionParticipantsForLesson(lesson);
  const participantTabs = completionParticipants.length > 1
    ? `<div class="lesson-chart-member-tabs" role="tablist" aria-label="그룹 회원 선택">${completionParticipants.map((participant, index) => `<button type="button" role="tab" class="${index === 0 ? "is-active" : ""}" aria-selected="${index === 0}" data-lesson-participant-tab="${escapeHtml(lessonChartParticipantKey(participant, index))}">${escapeHtml(participant.name || `회원 ${index + 1}`)}</button>`).join("")}</div>`
    : "";
  const participantCompletionFields = completionParticipants.map((participant, index) => {
    const key = lessonChartParticipantKey(participant, index);
    const defaults = lessonChartParticipantDefaults(lesson, participant, index);
    const total = Number(participant.totalSessions) || Number(lesson.totalSessions) || 0;
    const used = Number(participant.usedSessions) || Math.max(0, total - (Number(participant.remainingSessions) || Number(lesson.remaining) || 0));
    const remaining = Number(participant.remainingSessions) || Number(lesson.remaining) || 0;
    const finalComment = participant.coachComment || participant.coach_comment || "";
    const finalCurriculumId = participant.nextCurriculumId || participant.nextCurriculumSkillLabel || participant.next_curriculum_skill_label || "";
    const finalCurriculumTitle = participant.nextCurriculumTitle || participant.next_curriculum_title || (finalCurriculumId ? selectedCurriculum(finalCurriculumId)?.title : "");
    if (finalized) {
      const outcome = String(participant.outcome || "completed").toLowerCase();
      const outcomeLabel = outcome === "no_show" ? "노쇼" : outcome === "absence" ? "불참" : "완료";
      const deducted = Number(participant.deductedSessions ?? participant.deducted_sessions) || 0;
      const feedbackEditing = outcome === "completed" && lesson.feedbackRevisionKey === key;
      return `
        <section class="lesson-participant-completion-card lesson-chart-participant is-final ${feedbackEditing ? "is-feedback-editing" : ""}" data-lesson-participant-panel="${escapeHtml(key)}" data-feedback-revision-row="${escapeHtml(key)}" data-user-id="${escapeHtml(participant.userId)}" data-record-updated-at="${escapeHtml(participant.updatedAt || "")}" ${index === 0 ? "" : "hidden"}>
          ${completionParticipants.length > 1 ? `<strong class="lesson-chart-participant-name">${escapeHtml(participant.name || "회원")}</strong>` : ""}
          <div class="lesson-chart-result-line"><b>${escapeHtml(outcomeLabel)}</b><span>${deducted ? `${deducted}회 차감` : "차감 없음"} · 잔여 ${remaining}회</span></div>
          ${outcome === "completed" && feedbackEditing ? `
            <label class="lesson-required-field">
              <span>코치 피드백 <small>횟수는 변경되지 않음</small></span>
              <textarea data-feedback-revision-comment rows="5" maxlength="500">${escapeHtml(finalComment)}</textarea>
              <small class="lesson-comment-count">5자 이상</small>
            </label>
            <label class="lesson-required-field">
              <span>다음 목표 <small>필수</small></span>
              <input data-curriculum-option-search type="search" value="${escapeHtml(finalCurriculumId && finalCurriculumTitle ? `${finalCurriculumId} · ${finalCurriculumTitle}` : "")}" placeholder="동작·증상·목표·코드 검색" aria-label="${escapeHtml(participant.name || "회원")} 다음 목표 검색" />
              <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
              <select data-feedback-revision-curriculum>
                <option value="">검색·선택</option>
                ${curriculumOptions(finalCurriculumId)}
              </select>
            </label>
            <div class="actions lesson-feedback-revision-actions"><button class="approve-button" type="button" data-save-final-feedback="${escapeHtml(lesson.id)}">피드백 저장</button><button class="small-button" type="button" data-cancel-final-feedback="${escapeHtml(lesson.id)}">취소</button></div>
          ` : outcome === "completed" ? `<div class="lesson-chart-readonly"><span>코치 피드백</span><p>${escapeHtml(finalComment || "등록된 피드백이 없습니다.")}</p></div><div class="lesson-chart-readonly"><span>다음 목표</span><strong>${escapeHtml(finalCurriculumTitle || "선택 안 됨")}</strong>${finalCurriculumId ? `<small>${escapeHtml(finalCurriculumId)}</small>` : ""}</div><button class="small-button" type="button" data-edit-final-feedback="${escapeHtml(key)}">피드백 수정</button>` : ""}
          <button class="small-button lesson-chart-history-toggle" type="button" data-toggle-lesson-history="${escapeHtml(key)}">지난 기록 보기</button>
          <div class="lesson-chart-history" data-lesson-history-panel="${escapeHtml(key)}" hidden>${participant.userId ? coachMemberChartPanelMarkup(participant.userId, participant.name || "회원", 5) : '<p class="member-chart-state">연결된 회원 기록이 없습니다.</p>'}</div>
        </section>`;
    }
    return `
      <section class="lesson-participant-completion-card lesson-chart-participant" data-modal-participant-row="${escapeHtml(lesson.id)}" data-lesson-participant-panel="${escapeHtml(key)}" data-user-id="${escapeHtml(participant.userId)}" data-ticket-id="${escapeHtml(participant.ticketId)}" data-participant-name="${escapeHtml(participant.name || "회원")}" data-ticket-name="${escapeHtml(participant.ticketName || lesson.ticket || "회원권")}" data-total-sessions="${total}" data-used-sessions="${used}" data-remaining-sessions="${remaining}" ${index === 0 ? "" : "hidden"}>
        ${completionParticipants.length > 1 ? `<strong class="lesson-chart-participant-name">${escapeHtml(participant.name || "회원")}</strong>` : ""}
        <div class="lesson-chart-goal"><span>오늘 목표</span><strong>${escapeHtml(defaults.todayGoal)}</strong></div>
        <button class="small-button lesson-chart-history-toggle" type="button" data-toggle-lesson-history="${escapeHtml(key)}">지난 기록 보기</button>
        <div class="lesson-chart-history" data-lesson-history-panel="${escapeHtml(key)}" hidden>${participant.userId ? coachMemberChartPanelMarkup(participant.userId, participant.name || "회원", 5) : '<p class="member-chart-state">연결된 회원 기록이 없습니다.</p>'}</div>
        <label class="lesson-required-field">
          <span>메모 <small>${canFinalize ? "완료 시 회원에게 공개" : "코치만 보는 임시 메모"}</small></span>
          <textarea data-modal-coach-comment="${escapeHtml(lesson.id)}" rows="5" placeholder="수업 내용이나 피드백을 입력하세요" ${canProcess ? "" : "disabled"}>${escapeHtml(defaults.comment)}</textarea>
          <details class="lesson-ai-draft">
            <summary>AI</summary>
            <div class="tn-comment-draft-tools">
              <input data-modal-comment-keywords="${escapeHtml(lesson.id)}" type="text" maxlength="160" placeholder="허리 회전, 타점, 리듬" ${canProcess ? "" : "disabled"} />
              <button type="button" data-generate-modal-comment="${escapeHtml(lesson.id)}" ${canProcess ? "" : "disabled"}>초안 만들기</button>
            </div>
          </details>
          <small class="lesson-comment-count" data-modal-comment-count="${escapeHtml(lesson.id)}">0/5자</small>
        </label>
        <label class="lesson-required-field">
          <span>다음 목표 <small>${canFinalize ? "필수" : "미리 선택 가능"}</small></span>
          <input data-curriculum-option-search type="search" placeholder="동작·증상·목표·코드 검색" aria-label="${escapeHtml(participant.name || "회원")} 다음 목표 검색" ${canProcess ? "" : "disabled"} />
          <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
          <select data-modal-next-curriculum="${escapeHtml(lesson.id)}" ${canProcess ? "" : "disabled"}>
            <option value="">검색·선택</option>
            ${curriculumOptions(defaults.nextCurriculumId)}
          </select>
        </label>
      </section>`;
  }).join("");
  const scheduleEditDraft = lesson.scheduleEditDraft || {};
  const selectedEditDay = scheduleEditDraft.day || lesson.day;
  const selectedEditTime = scheduleEditDraft.time || lesson.time;
  const dayOptions = ["월", "화", "수", "목", "금", "토", "일"].map((day) => `<option value="${day}" ${selectedEditDay === day ? "selected" : ""}>${day}요일</option>`).join("");
  const schedulePolicy = loadCoachSchedulePolicy();
  const latestStartMinutes = Math.max(
    minutesFromTime(schedulePolicy.openStart),
    minutesFromTime(schedulePolicy.openEnd) - lessonDuration(lesson),
  );
  const latestStart = `${String(Math.floor(latestStartMinutes / 60)).padStart(2, "0")}:${String(latestStartMinutes % 60).padStart(2, "0")}`;
  const availableTimes = makeCoachTimeRange(schedulePolicy.openStart, latestStart);
  if (!availableTimes.includes(selectedEditTime)) availableTimes.push(selectedEditTime);
  availableTimes.sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
  const timeOptions = availableTimes
    .map((time) => `<option value="${time}" ${selectedEditTime === time ? "selected" : ""}>${time}</option>`)
    .join("");
  return `
    <section class="schedule-edit-panel lesson-action-panel">
      <div class="wide lesson-modal-head">
        <div>
          <strong>${lesson.member}</strong>
          <span>${lesson.day} ${lesson.time} · ${lessonDuration(lesson)}분${completionParticipants.length === 1 ? ` · 잔여 ${Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0}회` : ""}</span>
        </div>
        <b class="${finalized || canFinalize ? "can-process" : "read-only"}">${finalized ? "완료" : canFinalize ? "처리 필요" : canProcess ? "예정" : "보기 전용"}</b>
      </div>
      ${canFinalize && !finalized && completionParticipants.length === 1 ? `<p class="lesson-chart-deduction-preview wide">완료 시 잔여 ${Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0}회 → ${Math.max(0, (Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0) - 1)}회</p>` : ""}
      ${participantTabs}
      <div class="lesson-participant-completion-list wide">${participantCompletionFields}</div>
      ${lesson.validationMessage ? `<p class="validation-text wide">${lesson.validationMessage}</p>` : ""}
      ${!finalized && (canReschedule || (canProcess && lesson.serverLessonId))
        ? `<details class="lesson-secondary-panel lesson-other-actions wide">
            <summary>다른 처리</summary>
            ${canReschedule ? `
            <div class="lesson-edit-mini">
              <strong>일정 변경</strong>
              <div class="lesson-edit-grid">
                <label>
                  <span>요일</span>
                  <select id="editLessonDay">${dayOptions}</select>
                </label>
                <label>
                  <span>시간</span>
                  <select id="editLessonTime">${timeOptions}</select>
                </label>
                <label class="wide">
                  <span>변경 사유</span>
                  <input id="editLessonReason" type="text" maxlength="200" value="${escapeHtml(scheduleEditDraft.reason || "")}" placeholder="회원에게 안내할 변경 사유" />
                </label>
              </div>
              <p class="permission-note">근무시간 안의 브레이크 시간은 코치가 직접 변경할 수 있습니다. 회원 직접 신청은 계속 제한됩니다.</p>
              <button class="small-button" type="button" data-save-schedule-edit="${lesson.id}">일정 변경 저장</button>
            </div>
            ${canMarkRegularLessonAbsent(lesson) && lesson.serverLessonId
              ? `<div class="lesson-edit-mini lesson-absence-mini">
                  <strong>정규수업 불참</strong>
                  <div class="lesson-edit-grid">
                    <label class="wide">
                      <span>불참 사유</span>
                      <input id="coachAbsenceReason" type="text" minlength="2" maxlength="200" placeholder="예: 회원 사전 연락" />
                    </label>
                  </div>
                  <div class="actions">
                    <button class="reject-button" type="button" data-process-attendance="${lesson.id}" data-outcome="absence" data-deduct="false">불참 · 차감 없음</button>
                    <button class="small-button" type="button" data-process-attendance="${lesson.id}" data-outcome="absence" data-deduct="true">불참 · 횟수 차감</button>
                  </div>
                </div>` : ""}` : ""}
            ${canProcess && lesson.serverLessonId ? `
            <div class="lesson-edit-mini lesson-absence-mini">
              <strong>노쇼</strong>
              <div class="lesson-edit-grid">
                <label class="wide">
                  <span>노쇼 사유</span>
                  <input id="coachNoShowReason" type="text" minlength="2" maxlength="200" placeholder="예: 연락 없이 불참" />
                </label>
              </div>
              <div class="actions">
                <button class="reject-button" type="button" data-process-attendance="${lesson.id}" data-outcome="no_show" data-deduct="true">노쇼 · 차감</button>
                <button class="small-button" type="button" data-process-attendance="${lesson.id}" data-outcome="no_show" data-deduct="false">노쇼 · 차감 없음</button>
              </div>
            </div>` : ""}
          </details>`
        : ""}
      <div class="actions lesson-completion-actions wide">
        ${!finalized && canProcess ? canFinalize
          ? `<button class="approve-button" type="button" data-complete-lesson-from-modal="${lesson.id}" disabled>저장하고 완료</button>`
          : `<button class="approve-button" type="button" data-save-lesson-draft="${lesson.id}">저장</button>` : ""}
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
      ${canProcess
        ? canFinalize ? "" : `<p class="permission-note wide">${lessonOutcomeGuardMessage()}</p>`
        : `<p class="permission-note wide">${lessonPermissionText(lesson)}</p>`}
    </section>`;
}

function renderMakeupApprovalPanel() {
  const request = state.makeupRequests.find((item) => item.id === state.editingMakeupId);
  if (!request) {
    return `
      <section class="schedule-edit-panel is-empty">
        <strong>확인할 수업 변경 요청이 없습니다.</strong>
        <div class="actions">
          <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
        </div>
      </section>`;
  }
  const linkedLog = getMakeupLinkedLog(request.member);
  const canReview = !request.serverRequestV2 || request.canReview;
  const rejectionWarning = "거절하면 원래 수업을 그대로 유지하며 회원권은 차감하지 않습니다. 거절 사유는 처리 결과로 남습니다.";
  return `
    <section class="schedule-edit-panel makeup-detail-panel">
      <div class="wide">
        <strong>${request.member} 수업 변경 승인</strong>
        <span>${request.original} → ${request.requested}</span>
      </div>
      <article class="modal-info-card">
        <span>현재 상태</span>
        <strong>${request.status}</strong>
        <small>${requestCoach(request)} 담당 · ${request.policy}</small>
      </article>
      <article class="modal-info-card">
        <span>변경 사유</span>
        <strong>${escapeHtml(request.reason || "이유 미입력")}</strong>
        <small>${escapeHtml(request.requestedAt || "신청 시각 확인 필요")} · ${escapeHtml(request.remainingTime || "남은 시간 확인 필요")}</small>
      </article>
      <article class="modal-info-card">
        <span>연결 기록</span>
        <strong>${linkedLog ? linkedLog.lesson : "연결된 회원기록 없음"}</strong>
        <small>${linkedLog ? linkedLog.status : "승인 후 기록/차감 확인이 가능합니다."}</small>
      </article>
      <p class="permission-note wide">${rejectionWarning}</p>
      <div class="actions wide">
        ${linkedLog ? `<button class="small-button" type="button" data-open-linked-log="${request.id}">회원기록 보기</button>` : ""}
        ${canReview ? `<button class="approve-button" type="button" data-approve-makeup="${request.id}" ${request.reviewing ? "disabled" : ""}>${request.reviewing ? "처리 중" : "승인"}</button>
        <button class="reject-button" type="button" data-reject-makeup="${request.id}" ${request.reviewing ? "disabled" : ""}>거절</button>` : '<span class="permission-note">담당 코치 또는 관리자만 처리할 수 있습니다.</span>'}
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function recordableCoachLessons() {
  const lessons = ownTodayLessons();
  if (lessons.length || state.dataMode === "live") return lessons;
  return state.todayLessons;
}

function lessonRecordOptions(selectedId) {
  const lessons = recordableCoachLessons();
  return lessons
    .map((lesson) => `<option value="${lesson.id}" ${lesson.id === selectedId ? "selected" : ""}>${lesson.day} ${lesson.time} · ${lesson.member} · ${lesson.type}</option>`)
    .join("");
}

function renderLessonRecordWritePanel() {
  const lessons = recordableCoachLessons();
  const lesson = ensureCoachLessonRecord(state.writingLessonId) || lessons[0];
  if (!lesson) {
    return `
      <section class="schedule-edit-panel is-empty">
        ${coachEmptyState({
          title: "작성할 수업이 없습니다",
          reason: "오늘 담당 수업이 등록된 뒤 기록과 차감을 처리할 수 있습니다.",
          action: { label: "오늘 일정 보기", view: "todayView", primary: false },
          compact: true,
        })}
        <div class="actions">
          <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
        </div>
      </section>`;
  }
  return `
    <section class="schedule-edit-panel record-write-panel">
      <div class="wide">
        <strong>기록/차감 작성</strong>
        <span>수업 후 코멘트, 다음 커리큘럼, 회원권 차감을 코치가 직접 처리합니다.</span>
      </div>
      <label class="wide">
        <span>완료 처리할 수업</span>
        <select id="recordLessonSelect">${lessonRecordOptions(lesson.id)}</select>
      </label>
      <label class="wide">
        <span>오늘 레슨 내용</span>
        <textarea id="recordLessonContent" rows="3">${lesson.member} ${lesson.type} 수업 진행</textarea>
      </label>
      <label class="wide">
        <span>회원 운동노트/메모</span>
        <textarea id="recordSelfMemo" rows="3">회원 운동노트 미작성 · 코치가 기록/차감 메모를 먼저 작성했습니다.</textarea>
      </label>
      <label class="wide">
        <span>코치 코멘트</span>
        <textarea id="recordCoachComment" rows="3">오늘 레슨 확인 완료. 다음 시간에는 이어서 보완합니다.</textarea>
      </label>
      <label class="wide">
        <span>다음 커리큘럼 <small>필수</small></span>
        <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="다음 커리큘럼 검색" />
        <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
        <select id="recordNextCurriculum">${curriculumOptions(curriculumSteps[0]?.id)}</select>
      </label>
      <div class="actions wide">
        <button class="approve-button" type="button" data-save-lesson-record>저장하기</button>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function currentCoachScheduleDay() {
  const dayIndex = new Date().getDay();
  return scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1];
}

function selectedCoachScheduleDay() {
  if (!scheduleDays.includes(state.selectedFullScheduleDay)) state.selectedFullScheduleDay = currentCoachScheduleDay();
  return state.selectedFullScheduleDay;
}

function coachWeekDateForDay(day) {
  const week = activeScheduleWeek();
  const dayIndex = scheduleDays.indexOf(day);
  if (!week?.startDate || dayIndex < 0) return "";
  const value = new Date(`${week.startDate}T00:00:00`);
  value.setDate(value.getDate() + dayIndex);
  return localDateKey(value);
}

function coachScheduleDateLabel(day) {
  const value = coachWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function coachScheduleOperationDay(day) {
  const date = coachWeekDateForDay(day);
  return (state.scheduleOperationDays || []).find((operation) => operation.date === date) || null;
}

function renderCoachScheduleOperationNotice(day) {
  const operation = coachScheduleOperationDay(day);
  if (!operation) return "";
  const mode = String(operation.mode || "");
  const label = operation.label || "운영 안내";
  const detail = mode === "closed"
    ? "수업 등록은 관리자만 가능합니다."
    : mode === "shortened"
      ? `${operation.startTime || "-"}~${operation.endTime || "-"}만 운영합니다.`
      : "공휴일에도 정상 운영합니다.";
  const title = mode === "closed" ? "휴무" : mode === "shortened" ? "단축 운영" : "정상 운영";
  return `<p class="coach-operation-notice is-${escapeHtml(mode || "normal")}" role="status"><strong>${title}</strong><span>${escapeHtml(label)} · ${escapeHtml(detail)}</span></p>`;
}

function makeCoachStartTimes(startTime, endTime, stepMinutes = scheduleBlockMinutes) {
  const result = [];
  for (let current = minutesFromTime(startTime); current < minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function mergeCoachScheduleWindows(windows) {
  return windows
    .map((window) => ({ ...window, startMinutes: minutesFromTime(window.start), endMinutes: minutesFromTime(window.end) }))
    .filter((window) => window.startMinutes < window.endMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .reduce((merged, window) => {
      const previous = merged.at(-1);
      if (!previous || window.startMinutes > previous.endMinutes) merged.push({ ...window });
      else {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = `${String(Math.floor(previous.endMinutes / 60)).padStart(2, "0")}:${String(previous.endMinutes % 60).padStart(2, "0")}`;
      }
      return merged;
    }, []);
}

function coachOperatingWindows(day, policy) {
  return mergeCoachScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
}

function coachCanAddToSlot(coach, day, time, durationMinutes = scheduleBlockMinutes, policy = loadCoachSchedulePolicy()) {
  return coachSlotAccess(coach, day, time, durationMinutes, policy).allowed;
}

function coachQuickAddSlotMarkup({ coach, day, time, className, label, style = "", policy = loadCoachSchedulePolicy() }) {
  const access = coachSlotAccess(coach, day, time, scheduleBlockMinutes, policy);
  const canAdd = access.allowed;
  const lockedOverride = access.reason === "locked_time_override";
  const date = coachWeekDateForDay(day);
  const overrideClass = canAdd && lockedOverride ? " locked-override" : "";
  const content = canAdd ? `<span aria-hidden="true">+</span><small>${lockedOverride ? "수동" : ""}</small>` : (label ? `<span>${escapeHtml(label)}</span>` : "");
  const styleAttr = style ? ` style="${style}"` : "";
  if (!canAdd) return `<div class="${className}${overrideClass}"${styleAttr} aria-label="${day}요일 ${time} ${escapeHtml(shortCoachName(coach.name))} ${label || "빈 시간"}">${content}</div>`;
  return `<button class="${className} coach-add-slot${overrideClass}"${styleAttr} type="button" data-coach-add-lesson data-date="${date}" data-day="${day}" data-time="${time}" data-coach-role-id="${escapeHtml(coach.roleId || coach.id)}" aria-label="${day}요일 ${time} ${escapeHtml(shortCoachName(coach.name))} ${lockedOverride ? "브레이크·상담 시간 수동 등록" : "수업 추가"}">${content}</button>`;
}

function coachMobileScheduleSegments(day, policy, scheduleLessons) {
  const windows = coachOperatingWindows(day, policy);
  const range = "all";
  if (range === "morning") return windows.filter((window) => window.startMinutes < minutesFromTime("17:00"));
  if (range === "evening") return windows.filter((window) => window.endMinutes > minutesFromTime("17:00"));
  if (range === "all") return windows;
  const focusLesson = scheduleLessons.find((lesson) => lesson.day === day && canonicalCoachName(lesson.coach) === currentCoachName())
    || scheduleLessons.find((lesson) => lesson.day === day);
  const fallbackWindow = windows.length ? (scheduleDays.indexOf(day) < 5 ? windows.at(-1) : windows[0]) : null;
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

function coachLockedTimesForDay(day, policy) {
  if (policy.allowCoachLockedTimeOverride === false) return [];
  const currentRoleId = currentCoachRoleId();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id || "") === currentRoleId);
  if (!coach || !(coach.workBlocks || []).some((block) => block.days.includes(day))) return [];
  const rules = [...(policy.breakRules || []), ...(coach.blockedBlocks || [])]
    .filter((rule) => Array.isArray(rule.days) && rule.days.includes(day));
  const seen = new Set();
  return rules.flatMap((rule) => makeCoachStartTimes(rule.start, rule.end)
    .filter((time) => coachSlotAccess(coach, day, time, scheduleBlockMinutes, policy).allowed)
    .map((time) => ({ time, label: rule.label || "브레이크·상담" })))
    .filter((item) => {
      if (seen.has(item.time)) return false;
      seen.add(item.time);
      return true;
    });
}

function renderCoachMobileLockedTimeControl(day, policy) {
  const times = coachLockedTimesForDay(day, policy);
  if (!times.length) return "";
  const currentRoleId = currentCoachRoleId();
  return `
    <div class="coach-mobile-locked-add">
      <label>
        <span>브레이크·상담 시간</span>
        <select data-coach-locked-time-select aria-label="브레이크·상담 시간 선택">
          ${times.map((item) => `<option value="${item.time}">${item.time} · ${escapeHtml(item.label)}</option>`).join("")}
        </select>
      </label>
      <button class="small-button" type="button" data-coach-add-locked-time data-date="${coachWeekDateForDay(day)}" data-day="${day}" data-coach-role-id="${escapeHtml(currentRoleId)}">+ 수동 등록</button>
    </div>`;
}

function renderCoachMobileSegment(day, segment, policy, scheduleLessons) {
  const times = makeCoachStartTimes(segment.start, segment.end);
  const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
  const coaches = dayCoachesForSchedule(day, policy, dayLessons).filter((coach) => {
    const worksHere = (coach.workBlocks || []).some((block) => block.days.includes(day)
      && minutesFromTime(block.start) < segment.endMinutes
      && minutesFromTime(block.end) > segment.startMinutes);
    const hasLesson = dayLessons.some((lesson) => coachFromLesson(lesson, policy).id === coach.id
      && minutesFromTime(lesson.time) < segment.endMinutes
      && minutesFromTime(lesson.time) + lessonDuration(lesson) > segment.startMinutes);
    return worksHere || hasLesson;
  });
  if (!times.length || !coaches.length) return `<p class="coach-mobile-empty">이 시간대에 운영하는 코치가 없습니다.</p>`;
  return `
    <section class="coach-mobile-segment">
      <div class="coach-mobile-segment-title"><strong>${segment.start}~${segment.end}</strong><span>${coaches.length}명 · 레슨 ${dayLessons.length}개</span></div>
      <div class="coach-mobile-lane-board" style="--coach-count:${coaches.length}; --slot-count:${times.length};">
        <div class="coach-mobile-lane-head time">시간</div>
        ${coaches.map((coach) => `<div class="coach-mobile-lane-head ${coachColorClass(coach.name)}">${escapeHtml(shortCoachName(coach.name))}</div>`).join("")}
        <div class="coach-mobile-time-rail">${times.map((time) => `<span>${time}</span>`).join("")}</div>
        ${coaches.map((coach) => {
          const coachLessons = dayLessons.filter((lesson) => coachFromLesson(lesson, policy).id === coach.id);
          return `
            <div class="coach-mobile-coach-lane">
              ${times.map((time, index) => {
                const working = isPolicyCoachWorking(coach, day, time, scheduleBlockMinutes);
                const breakRule = breakRuleForSlot(policy, day, time);
                const blockedRule = coachBlockedRuleForSlot(coach, day, time);
                const closure = coachClosureForSlot(day, time);
                const lockedRule = blockedRule || breakRule;
                return coachQuickAddSlotMarkup({
                  coach,
                  day,
                  time,
                  policy,
                  className: `coach-mobile-slot ${closure || lockedRule ? "blocked" : working ? "available" : "off"}`,
                  label: closure?.label || lockedRule?.label || (working ? "빈 시간" : "근무 외"),
                  style: `grid-row:${index + 1};`,
                });
              }).join("")}
              ${coachLessons.filter((lesson) => minutesFromTime(lesson.time) >= segment.startMinutes && minutesFromTime(lesson.time) < segment.endMinutes).map((lesson) => {
                const startIndex = times.indexOf(lesson.time);
                if (startIndex < 0) return "";
                const span = Math.max(1, Math.ceil(lessonDuration(lesson) / scheduleBlockMinutes));
                const memberLabel = formatScheduleMemberName(lesson.member || "회원");
                const note = coachScheduleExceptionLabel(lesson);
                const laneCoach = coachFromLesson(lesson, policy);
                const roundOrState = lesson.releasedMakeupSlot ? "정규 · 불참" : coachScheduleRoundLabel(lesson);
                const cardNote = lesson.releasedMakeupSlot
                  ? (lesson.historicalReleasedSlot ? "차감 없음" : "차감 없음 · 보강·원데이 가능")
                  : (note || "-");
                return `<button class="coach-mobile-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${lesson.releasedMakeupSlot ? "released-makeup-slot" : ""} ${coachColorClass(laneCoach.name)} ${coachLessonStateClass(lesson)}" type="button" ${coachScheduleLessonActionAttrs(lesson)} style="${coachLessonColorStyle(lesson, policy)};grid-row:${startIndex + 1} / span ${span};"><strong>${memberLabel}</strong><span>${escapeHtml(roundOrState)}</span><span>${escapeHtml(coachScheduleCardCoachLabel(lesson))}</span><small class="schedule-card-note ${cardNote ? "" : "is-empty"}">${escapeHtml(cardNote)}</small></button>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderCoachMineEmptyState(policy, scheduleLessons) {
  if (state.scheduleFilter !== "mine") return "";
  const selectedDay = selectedCoachScheduleDay();
  const currentRoleId = currentCoachRoleId();
  const currentName = currentCoachName();
  const currentCoach = policy.coaches.find((coach) => (
    String(coach.roleId || coach.id || "") === currentRoleId
    || canonicalCoachName(coach.name) === currentName
  ));
  const worksOnSelectedDay = Boolean(currentCoach?.workBlocks?.some((block) => block.days.includes(selectedDay)));
  const lessonsOnSelectedDay = scheduleLessons.filter((lesson) => lesson.day === selectedDay);
  if (worksOnSelectedDay || lessonsOnSelectedDay.length) return "";

  const nextLessonDay = scheduleDays.find((day) => scheduleLessons.some((lesson) => lesson.day === day));
  const nextLessonCount = nextLessonDay
    ? scheduleLessons.filter((lesson) => lesson.day === nextLessonDay).length
    : 0;
  return `
    <section class="tn-empty-state coach-schedule-filter-empty" role="status">
      <strong>${selectedDay}요일에는 내 수업이 없습니다</strong>
      <p>지점의 다른 코치 수업은 전체 시간표에서 확인할 수 있습니다.</p>
      <div class="actions">
        <button class="primary-button" type="button" data-coach-schedule-show-all>전체 시간표 보기</button>
        ${nextLessonDay ? `<button class="small-button" type="button" data-coach-schedule-jump-day="${nextLessonDay}">${nextLessonDay}요일 내 수업 ${nextLessonCount}건</button>` : ""}
      </div>
    </section>`;
}

function renderCoachMobileSchedule(policy, scheduleLessons) {
  const selectedDay = selectedCoachScheduleDay();
  const mineEmptyState = renderCoachMineEmptyState(policy, scheduleLessons);
  const segments = coachMobileScheduleSegments(selectedDay, policy, scheduleLessons);
  return `
    <div class="coach-mobile-schedule">
      <div class="coach-mobile-day-strip" aria-label="날짜 선택">
        ${scheduleDays.map((day) => `<button class="coach-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-coach-schedule-day="${day}"><strong>${day}</strong><span>${coachScheduleDateLabel(day)}</span></button>`).join("")}
      </div>
      ${renderCoachScheduleOperationNotice(selectedDay)}
      ${renderCoachMobileLockedTimeControl(selectedDay, policy)}
      ${mineEmptyState || (segments.length
        ? segments.map((segment, index) => `${index > 0 ? `<div class="coach-mobile-break"><strong>${segments[index - 1].end}~${segment.start}</strong><span>수업 없음</span></div>` : ""}${renderCoachMobileSegment(selectedDay, segment, policy, scheduleLessons)}`).join("")
        : `<p class="coach-mobile-empty">${selectedDay}요일은 현재 등록된 운영시간이 없습니다.</p>`)}
    </div>`;
}

function renderFullSchedule() {
  if (!$("#fullScheduleBoard")) return;
  if (state.scheduleV2SyncError && !state.scheduleV2WorkspaceLoaded) {
    $("#fullScheduleBoard").innerHTML = `
      <section class="tn-empty-state" role="alert">
        <strong>시간표를 불러오지 못했습니다</strong>
        <p>${escapeHtml(state.scheduleV2SyncError)}</p>
        <button id="retryCoachScheduleV2" class="primary-button" type="button">다시 불러오기</button>
      </section>`;
    $("#retryCoachScheduleV2")?.addEventListener("click", () => {
      state.scheduleV2SyncError = "";
      state.liveLessonsLoaded = false;
      renderFullSchedule();
      void syncCoachLessonsFromServer().then(() => renderAll());
    });
    return;
  }
  ensureMemberLists();
  const policy = loadCoachSchedulePolicy();
  const weekIndex = activeWeekIndex();
  const week = activeScheduleWeek();
  const scheduleFilter = state.scheduleFilter || "mine";
  const lessonsForWeek = filterFullScheduleLessons(weekLessons(), scheduleFilter);
  const scheduleContent = scheduleFilter === "makeupChange"
    ? renderCoachRequestTimeline(lessonsForWeek)
    : renderCoachMobileSchedule(policy, lessonsForWeek);
  const scheduleGuide = scheduleFilter === "makeupChange"
    ? "승인할 요청, 시간을 정할 보강, 처리 완료 내역을 날짜·시간순으로 확인합니다."
    : "요일을 고른 뒤 빈칸은 수업 등록, 수업 카드는 변경·완료·피드백 처리에 사용합니다.";
  $("#fullScheduleBoard").innerHTML = `
    <div class="coach-week-calendar">
      <div class="coach-week-controls">
        <button class="small-button schedule-week-arrow" type="button" data-change-week="-1" ${weekIndex <= coachScheduleMinWeekOffset ? "disabled" : ""} aria-label="이전 주" title="이전 주">&lt;</button>
        <div class="schedule-period-summary">
          <strong>${week.label}</strong>
          <span>${week.range} · ${fullScheduleFilterLabel(scheduleFilter)} · 관리자 근무시간 기준</span>
        </div>
        <button class="small-button schedule-week-arrow" type="button" data-change-week="1" ${weekIndex >= coachScheduleMaxWeekOffset ? "disabled" : ""} aria-label="다음 주" title="다음 주">&gt;</button>
      </div>
      <div class="schedule-filter-row" aria-label="전체 레슨표 필터">
        ${fullScheduleFilterOptions()
          .map(
            (filter) => `
              <button class="schedule-filter ${scheduleFilter === filter.id ? "is-active" : ""}" type="button" data-schedule-filter="${filter.id}">
                ${filter.label}
              </button>`,
          )
          .join("")}
      </div>
    </div>
    <p class="coach-day-schedule-guide">${scheduleGuide}</p>
    ${scheduleContent}`;
}

function fullScheduleFilterOptions() {
  return [
    { id: "mine", label: "내 수업" },
    { id: "feedback", label: "피드백 필요" },
    { id: "makeupChange", label: "변경·보강" },
    { id: "all", label: "전체 시간표" },
  ];
}

function fullScheduleFilterLabel(filter) {
  return fullScheduleFilterOptions().find((item) => item.id === filter)?.label || "전체";
}

function filterFullScheduleLessons(lessons, filter) {
  if (filter === "mine") return lessons.filter((lesson) => (
    canonicalCoachName(lesson.coach) === currentCoachName()
    || canonicalCoachName(lesson.originalCoach) === currentCoachName()
  ));
  if (filter === "feedback") return lessons.filter((lesson) => (
    lessonAssignedToCurrentCoachForTasks(lesson)
    && coachLessonCardState(lesson).needsFeedback
  ));
  if (filter === "makeupChange")
    return lessons.filter((lesson) =>
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("보강") ||
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("변경") ||
      `${lesson.status || ""}`.includes("승인 대기"),
    );
  return lessons;
}

function coachRequestTimelineState(lesson = {}) {
  const context = `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`;
  if (/승인 대기|승인 필요|pending_change/.test(context)) return { id: "approval", label: "승인 필요", order: 0 };
  if (lesson.releasedMakeupSlot || /시간 선택 대기|보강 가능/.test(context)) return { id: "slot", label: "시간 선택", order: 1 };
  if (/변경/.test(context)) return { id: "changed", label: "변경 완료", order: 2 };
  return { id: "booked", label: "보강 확정", order: 3 };
}

function coachRequestTimelineDate(lesson = {}) {
  return String(lesson.lessonDate || coachWeekDateForDay(lesson.day) || "");
}

function renderCoachRequestTimeline(scheduleLessons = []) {
  const items = [...scheduleLessons]
    .map((lesson) => ({ lesson, state: coachRequestTimelineState(lesson), date: coachRequestTimelineDate(lesson) }))
    .sort((left, right) => (
      left.state.order - right.state.order
      || `${left.date} ${left.lesson.time || ""}`.localeCompare(`${right.date} ${right.lesson.time || ""}`)
    ));
  if (!items.length) {
    return coachEmptyState({
      title: "확인할 변경·보강이 없습니다",
      reason: "새 요청이나 시간을 정할 보강이 생기면 날짜순으로 표시됩니다.",
      compact: true,
    });
  }
  const groups = [
    { id: "approval", title: "승인할 요청" },
    { id: "slot", title: "시간을 정할 보강" },
    { id: "changed", title: "변경 완료" },
    { id: "booked", title: "보강 확정" },
  ];
  return `<div class="coach-request-timeline">
    ${groups.map((group) => {
      const groupItems = items.filter((item) => item.state.id === group.id);
      if (!groupItems.length) return "";
      return `<section class="coach-request-group" aria-label="${group.title}">
        <div class="coach-request-group-title"><strong>${group.title}</strong><span>${groupItems.length}건</span></div>
        <div class="coach-request-list">
          ${groupItems.map(({ lesson, state: itemState, date }) => `
            <button class="coach-request-row ${itemState.id}" type="button" ${coachScheduleLessonActionAttrs(lesson)}>
              <time>${escapeHtml(date || lesson.day || "날짜 확인")} · ${escapeHtml(lesson.time || "시간 확인")}</time>
              <strong>${escapeHtml(lesson.member || "회원")}</strong>
              <span>${escapeHtml(lesson.coach || "담당 코치")} · ${escapeHtml(lesson.type || "수업")}</span>
              <b>${itemState.label}</b>
            </button>`).join("")}
        </div>
      </section>`;
    }).join("")}
  </div>`;
}

function formatScheduleMemberName(name) {
  const label = String(name || "회원").trim() || "회원";
  const lines = label
    .split(/[&·]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return `<span class="schedule-member-lines" aria-label="${escapeHtml(label)}">${(lines.length ? lines : [label]).map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</span>`;
}

function memberFilter() {
  return ["all", "active", "attention", "expiring", "paused_pending", "expired"].includes(state.memberFilter)
    ? state.memberFilter
    : "all";
}

function memberQuery() {
  return (state.memberQuery || "").trim().toLowerCase();
}

function memberContactFor(member) {
  if (member.groupMemberName && member.groupPhones?.[member.groupMemberName]) return member.groupPhones[member.groupMemberName];
  return member.phone || "";
}

function maskPhone(phone) {
  if (!phone) return "연락처 미입력";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 7) return "연락처 확인 필요";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function memberDetailKey(member) {
  return `${memberFilter()}:${member.sourceMemberId || member.id}:${member.groupMemberName || member.name}`;
}

function memberSearchValues(member) {
  return [
    member.name,
    member.displayName,
    member.groupMemberName,
    member.coach,
    member.ticket,
    member.lastLesson,
    member.expiredAt,
    member.status,
    member.note,
    member.selfNtrp,
    member.coachNtrp,
    member.ntrpRequest,
    maskPhone(memberContactFor(member)).slice(-4),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isGroupTicket(member) {
  return /2\s*대\s*1|그룹|group/i.test(`${member.ticket || ""} ${member.name || ""}`);
}

function groupMemberNames(member) {
  if (Array.isArray(member.groupMembers) && member.groupMembers.length) return member.groupMembers;
  if (!isGroupTicket(member) || !member.name.includes("&")) return [member.name];
  return member.name
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
}

function displayMemberItemsForFilter() {
  const filter = memberFilter();
  const source = filter === "expired"
    ? state.expiredMembers
    : filter === "all"
      ? state.members
      : filter === "attention"
        ? state.members.filter((member) => Boolean(memberAttentionLabel(member)))
      : state.members.filter((member) => member.statusCategory === filter);
  return source.flatMap((member) => {
    const names = groupMemberNames(member);
    if (names.length <= 1) return [{ ...member, displayName: member.name, sourceMemberId: member.id, isGroupDisplay: false }];
    return names.map((name, index) => ({
      ...member,
      id: `${member.id}-${index}`,
      displayName: name,
      sourceMemberId: member.id,
      groupMemberName: name,
      groupPosition: index + 1,
      groupTotal: names.length,
      phone: member.groupPhones?.[name] || member.phone,
      coachNtrp: member.groupCoachNtrp?.[name] || member.coachNtrp,
      selfNtrp: member.groupSelfNtrp?.[name] || member.selfNtrp,
      isGroupDisplay: true,
    }));
  });
}

function normalizeMemberPage(total) {
  const maxPage = Math.max(0, Math.ceil(total / memberPageSize) - 1);
  state.memberPage = Math.min(Math.max(Number(state.memberPage) || 0, 0), maxPage);
  return state.memberPage;
}

function ntrpNumber(value) {
  return value && value !== "측정 전" ? value : "-";
}

function memberGenderLabel(value = "") {
  return { female: "여", male: "남", other: "기타", prefer_not: "미응답" }[value] || "미입력";
}

function memberUsageLabel(member) {
  const total = Number(member.total);
  const used = Number(member.used);
  const remaining = Number(member.remaining);
  return Number.isFinite(total) && total > 0 && Number.isFinite(used)
    ? `총 ${total} / 소진 ${used} / 잔여 ${Number.isFinite(remaining) ? remaining : Math.max(0, total - used)}`
    : `잔여 ${member.remaining || 0}회`;
}

function memberAttentionLabel(member = {}) {
  const remaining = Number(member.remaining);
  if (member.statusCategory === "expiring") return "만료 임박";
  if (member.statusCategory === "paused_pending") return member.status || "휴회·대기";
  if (Number.isFinite(remaining) && remaining <= 1) return "재등록 확인";
  if (member.ntrpRequest === "요청") return "측정 요청";
  return "";
}

function memberRecentLessonLabel(member = {}) {
  const recent = String(member.lastLesson || "").trim();
  return recent ? `최근 ${recent}` : "최근 수업 없음";
}

function renderActiveMemberCard(member) {
  const attentionLabel = memberAttentionLabel(member);
  return `
    <button class="member-row active ${member.isGroupDisplay ? "group-child" : ""}" type="button" data-member-detail-id="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
      <span class="member-name">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "tiny")}
        <span class="member-name-copy">
          <strong>${member.displayName || member.name}</strong>
          <small>${escapeHtml(member.ticket || (member.isGroupDisplay ? "2대1 회원권" : "회원권 미정"))}</small>
        </span>
      </span>
      <span class="member-row-summary">
        <strong>${escapeHtml(memberRecentLessonLabel(member))}</strong>
        <small>${escapeHtml(memberUsageLabel(member))}</small>
      </span>
      ${attentionLabel ? `<span class="member-attention-badge">${escapeHtml(attentionLabel)}</span>` : ""}
      <span class="member-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function renderExpiredMemberCard(member) {
  return `
    <button class="member-row expired" type="button" data-member-detail-id="${member.id}">
      <span class="member-name">
        ${personAvatarMarkup(member, "tiny")}
        <span class="member-name-copy"><strong>${member.name}</strong><small>${escapeHtml(member.ticket || "이전 회원권")}</small></span>
      </span>
      <span class="member-row-summary"><strong>만료 ${escapeHtml(member.expiredAt || "-")}</strong><small>사용 ${escapeHtml(String(member.used || 0))}회</small></span>
      <span class="member-attention-badge">미재등록</span>
      <span class="member-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function renderMemberHeader(filter) {
  return "";
}

function renderMemberPager(total, page) {
  const pager = $("#memberPager");
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(total / memberPageSize));
  pager.innerHTML = `
    <span>10명씩 보기</span>
    <div class="member-page-row">
      ${Array.from({ length: pages }, (_, index) => `<button class="member-page-number ${index === page ? "is-current" : ""}" type="button" data-member-page="${index}">${index + 1}</button>`).join("")}
    </div>`;
}

function renderMembers() {
  ensureMemberLists();
  importNtrpRequests();
  const target = $("#memberList");
  if (!target) return;
  const filter = memberFilter();
  const query = memberQuery();
  const allItems = displayMemberItemsForFilter();
  const ticketFilter = state.memberTicketFilter || "all";
  const filteredByControls = allItems.filter((member) => {
    const ticketMatches = ticketFilter === "all" || (ticketFilter === "group" ? isGroupTicket(member) : !isGroupTicket(member));
    return ticketMatches;
  });
  const items = query ? filteredByControls.filter((member) => memberSearchValues(member).includes(query)) : filteredByControls;
  const page = normalizeMemberPage(items.length);
  const visible = items.slice(page * memberPageSize, page * memberPageSize + memberPageSize);
  if ($("#memberSearchInput") && $("#memberSearchInput").value !== state.memberQuery) $("#memberSearchInput").value = state.memberQuery || "";
  if ($("#memberTicketFilter")) $("#memberTicketFilter").value = ticketFilter;
  $$(".member-filter").forEach((button) => button.classList.toggle("is-active", button.dataset.memberFilter === filter));
  const advancedControls = $("#memberAdvancedControls");
  if (advancedControls) advancedControls.open = ["expiring", "paused_pending", "expired"].includes(filter);
  if ($("#memberFilterSummary")) {
    const filterLabel = { all: "내 담당 전체", active: "수강중", attention: "확인 필요", expiring: "만료 임박", paused_pending: "휴회·대기", expired: "만료" }[filter];
    $("#memberFilterSummary").textContent = `${filterLabel} ${items.length}/${allItems.length}명 · ${page + 1}페이지`;
  }
  const rows = visible
    .map((member) => (filter === "expired" ? renderExpiredMemberCard(member) : renderActiveMemberCard(member)))
    .join("");
  target.innerHTML = rows || coachEmptyState({
    title: filter === "expired" ? "만료회원이 없습니다" : "조건에 맞는 담당 회원이 없습니다",
    reason: query || ticketFilter !== "all"
      ? "검색어나 필터를 바꾸면 다른 회원을 확인할 수 있습니다."
      : "관리자가 회원과 코치를 연결하면 이 목록에 표시됩니다.",
    compact: true,
  });
  renderMemberPager(items.length, page);
}

function findMemberDetail(memberId, groupName = "") {
  const member = [...state.members, ...state.expiredMembers].find((item) => item.id === memberId);
  if (!member) return null;
  if (!groupName) return { ...member, displayName: member.name, sourceMemberId: member.id };
  return {
    ...member,
    displayName: groupName,
    sourceMemberId: member.id,
    groupMemberName: groupName,
    phone: member.groupPhones?.[groupName] || member.phone,
    coachNtrp: member.groupCoachNtrp?.[groupName] || member.coachNtrp,
    selfNtrp: member.groupSelfNtrp?.[groupName] || member.selfNtrp,
    isGroupDisplay: true,
  };
}

const coachMemberChartCache = new Map();

function coachMemberChartUserId(member = {}) {
  return String(member.serverUserId || member.sourceMemberId || member.id || "");
}

function coachMemberChartOutcomeLabel(item = {}) {
  return {
    completed: "수업 완료",
    no_show: "노쇼",
    absence: "불참",
    cancelled: "취소",
    holiday: "휴무",
  }[String(item.outcome || "").toLowerCase()] || "수업 기록";
}

function coachMemberChartDateLabel(item = {}) {
  const dateValue = String(item.lessonDate || item.finalizedAt || item.updatedAt || "").slice(0, 10);
  if (!dateValue) return item.lessonLabel || "이전 수업";
  const parsed = new Date(`${dateValue}T00:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? dateValue
    : parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return `${dateLabel}${item.startTime ? ` ${String(item.startTime).slice(0, 5)}` : ""}`;
}

function coachMemberChartLocalItems(userId = "", memberName = "") {
  const normalizedName = String(memberName || "").trim();
  return state.lessonLogs
    .filter((log) => {
      if ((log.participantResults || []).some((result) => String(result.userId || "") === String(userId))) return true;
      return normalizedName && recordMemberNames(log.member).includes(normalizedName);
    })
    .map((log) => {
      const participant = (log.participantResults || []).find((result) => String(result.userId || "") === String(userId)) || {};
      const completedValue = log.completedAt || participant.finalizedAt || participant.updatedAt || "";
      return {
        id: log.id,
        lessonId: log.serverLessonId || "",
        lessonDate: String(log.journalDate || completedValue).slice(0, 10),
        lessonLabel: log.lesson || "이전 수업",
        coachName: log.coach || currentCoachName(),
        outcome: participant.outcome || (log.status === "확인 완료" ? "completed" : ""),
        deductedSessions: Number(participant.deductedSessions ?? log.deductedSessions ?? (log.ticketDeducted ? 1 : 0)) || 0,
        coachComment: participant.coachComment || log.coachComment || log.content || "",
        nextGoal: participant.nextGoal || log.memberVisibleSummary || "",
        nextCurriculumSkillLabel: participant.nextCurriculumId || log.nextCurriculumId || "",
        finalizedAt: completedValue,
      };
    });
}

function coachMemberChartItems(userId = "", memberName = "") {
  const serverItems = coachMemberChartCache.get(String(userId))?.items || [];
  const merged = [...serverItems, ...coachMemberChartLocalItems(userId, memberName)];
  const seen = new Set();
  return merged
    .filter((item) => {
      const key = String(item.lessonId || item.id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftKey = `${left.lessonDate || ""} ${left.startTime || ""} ${left.finalizedAt || ""}`;
      const rightKey = `${right.lessonDate || ""} ${right.startTime || ""} ${right.finalizedAt || ""}`;
      return rightKey.localeCompare(leftKey);
    });
}

function coachMemberChartItemMarkup(item = {}) {
  const outcome = coachMemberChartOutcomeLabel(item);
  const deducted = Number(item.deductedSessions) || 0;
  const focus = item.nextGoal || item.nextCurriculumTitle || "";
  const curriculum = [item.nextCurriculumSkillLabel, item.nextCurriculumTitle].filter(Boolean).join(" · ");
  const detail = [item.technique, item.strength, item.improvement].filter(Boolean).join(" · ");
  return `
    <li class="member-chart-item">
      <time>${escapeHtml(coachMemberChartDateLabel(item))}</time>
      <div>
        <div class="member-chart-item-head">
          <strong>${escapeHtml(outcome)}</strong>
          <span>${deducted > 0 ? `${deducted}회 차감` : "차감 없음"}</span>
        </div>
        <p>${escapeHtml(item.coachComment || detail || "코치 기록이 완료되었습니다.")}</p>
        ${focus || curriculum ? `<small><b>다음 수업</b> ${escapeHtml(focus || curriculum)}</small>` : ""}
        <small>${escapeHtml([item.coachName, item.ticketName].filter(Boolean).join(" · "))}</small>
      </div>
    </li>`;
}

function coachMemberChartBodyMarkup(userId = "", memberName = "", limit = 5) {
  const cache = coachMemberChartCache.get(String(userId)) || {};
  const items = coachMemberChartItems(userId, memberName);
  if (!items.length && cache.status === "loading") return `<p class="member-chart-state">이전 수업 기록을 불러오는 중입니다.</p>`;
  if (!items.length && cache.status === "error") return `<p class="member-chart-state is-error">기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>`;
  if (!items.length) return `<p class="member-chart-state">아직 완료된 수업 기록이 없습니다.</p>`;
  const recent = items.slice(0, Math.max(1, Number(limit) || 5));
  const older = items.slice(recent.length);
  const latestFocus = recent[0]?.nextGoal || recent[0]?.nextCurriculumTitle || "";
  return `
    ${latestFocus ? `<div class="member-chart-focus"><span>이번 수업에서 볼 것</span><strong>${escapeHtml(latestFocus)}</strong></div>` : ""}
    <ol class="member-chart-timeline">${recent.map(coachMemberChartItemMarkup).join("")}</ol>
    ${older.length ? `
      <details class="member-chart-older">
        <summary>이전 기록 ${older.length}건 더 보기</summary>
        <ol class="member-chart-timeline">${older.map(coachMemberChartItemMarkup).join("")}</ol>
      </details>` : ""}`;
}

function coachMemberChartPanelMarkup(userId = "", memberName = "", limit = 5) {
  return `<div class="member-chart-body" data-member-chart-body data-member-user-id="${escapeHtml(userId)}" data-member-name="${escapeHtml(memberName)}" data-member-chart-limit="${Number(limit) || 5}">${coachMemberChartBodyMarkup(userId, memberName, limit)}</div>`;
}

function refreshCoachMemberChartBodies(userId = "") {
  $$('[data-member-chart-body]').filter((target) => String(target.dataset.memberUserId || "") === String(userId)).forEach((target) => {
    target.innerHTML = coachMemberChartBodyMarkup(
      target.dataset.memberUserId || "",
      target.dataset.memberName || "",
      Number(target.dataset.memberChartLimit) || 5,
    );
  });
}

async function syncCoachMemberChart(userId = "", memberName = "", force = false) {
  const normalizedId = String(userId || "");
  if (!normalizedId) return false;
  const cached = coachMemberChartCache.get(normalizedId);
  if (!force && cached?.status === "ready" && Date.now() - Number(cached.loadedAt || 0) < 60_000) return true;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  coachMemberChartCache.set(normalizedId, { ...(cached || {}), status: "loading", error: "" });
  refreshCoachMemberChartBodies(normalizedId);
  try {
    const response = await client.rpc("tn_member_lesson_chart", {
      target_user_id: normalizedId,
      target_limit: 30,
    });
    coachMemberChartCache.set(normalizedId, {
      status: "ready",
      items: Array.isArray(response) ? response : [],
      loadedAt: Date.now(),
      memberName,
    });
    refreshCoachMemberChartBodies(normalizedId);
    return true;
  } catch (error) {
    coachMemberChartCache.set(normalizedId, {
      ...(cached || {}),
      status: "error",
      error: String(error?.payload?.message || error?.message || "member_chart_failed"),
      memberName,
    });
    refreshCoachMemberChartBodies(normalizedId);
    return false;
  }
}

function relatedLessonsForMember(member) {
  const name = member.groupMemberName || member.displayName || member.name;
  return weekLessons().filter((lesson) => String(lesson.member || "").includes(name) || String(lesson.member || "").includes(member.name)).slice(0, 3);
}

function relatedLogsForMember(member) {
  const name = member.groupMemberName || member.displayName || member.name;
  return state.lessonLogs.filter((log) => String(log.member || "").includes(name) || String(log.member || "").includes(member.name)).slice(0, 3);
}

function renderMemberDetailModal(member) {
  const target = $("#memberDetailContent");
  const modal = $("#memberDetailModal");
  if (!target || !modal || !member) return;
  const key = memberDetailKey(member);
  const phone = memberContactFor(member);
  const isRevealed = state.revealedMemberContactKey === key;
  const lessons = relatedLessonsForMember(member);
  const memberUserId = coachMemberChartUserId(member);
  const memberSettlement = coachMemberSettlementSummary(member);
  target.innerHTML = `
    <div class="lesson-modal-head member-detail-head">
      <div class="member-detail-identity">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "small")}
        <div>
          <span>${member.statusCategory === "expired" ? "만료회원" : member.isGroupDisplay ? "2대1 회원" : member.status || "담당 회원"}</span>
          <strong>${member.displayName || member.name}</strong>
          <small>${member.coach || "담당 코치 미정"} · ${member.ticket || "회원권 미정"}</small>
        </div>
      </div>
      <button class="small-button" type="button" data-close-member-modal>닫기</button>
    </div>
    <section class="member-detail-section member-chart-section">
      <div class="member-chart-heading">
        <div><strong>수업 차트</strong><span>최근 기록부터 확인합니다.</span></div>
        <button class="small-button" type="button" data-refresh-member-chart="${escapeHtml(memberUserId)}">새로고침</button>
      </div>
      ${coachMemberChartPanelMarkup(memberUserId, member.displayName || member.name, 5)}
    </section>
    <button class="member-detail-settlement" type="button" data-open-coach-settlement>
      <span><b>이번 달 정산</b><small>내 담당 매출 기준</small></span>
      <strong id="memberDetailSettlementValue" data-linked="${String(memberSettlement.linked)}">${escapeHtml(memberSettlement.label)}</strong>
      <span aria-hidden="true">›</span>
    </button>
    <details class="member-detail-secondary">
      <summary>회원·회원권 정보</summary>
      <div class="modal-info-grid member-detail-grid">
        <article class="modal-info-card">
          <span>연락처</span>
          <strong>${isRevealed ? phone || "연락처 미입력" : maskPhone(phone)}</strong>
          <small>연락처 열람은 실제 서비스에서 기록으로 남깁니다.</small>
          <button class="small-button" type="button" data-reveal-member-contact="${key}">${isRevealed ? "표시 중" : "연락처 보기"}</button>
        </article>
        <article class="modal-info-card">
          <span>회원권</span>
          <strong>${member.remaining !== undefined ? `잔여 ${member.remaining}회` : member.used || "-"}</strong>
          <small>${member.statusCategory === "expired" ? `만료 ${member.expiredAt || "-"}` : member.lastLesson || "최근 수업 없음"}</small>
        </article>
        <article class="modal-info-card">
          <span>NTRP</span>
          <strong>자가 ${ntrpNumber(member.selfNtrp)} · 코치 ${ntrpNumber(member.coachNtrp)}</strong>
          <small>${member.ntrpRequest || "측정 요청 없음"}</small>
          <label class="member-detail-ntrp">
            <span>코치 측정</span>
            <select data-member-ntrp="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
              ${ntrpLevels.map((level) => `<option value="${level}" ${member.coachNtrp === level ? "selected" : ""}>${ntrpNumber(level)}</option>`).join("")}
            </select>
          </label>
        </article>
        <article class="modal-info-card">
          <span>기본 정보</span>
          <strong>${member.birthYear || "출생연도 미입력"} · ${memberGenderLabel(member.gender)}</strong>
          <small>${member.neighborhood || "거주동 미입력"}</small>
        </article>
      </div>
      <section class="member-detail-section">
        <strong>최근/예정 수업</strong>
        ${
          lessons.length
            ? lessons.map((lesson) => `<div><b>${lesson.day} ${lesson.time}</b><span>${lesson.type} · ${lesson.status} · ${lesson.task || ""}</span></div>`).join("")
            : `<p>연결된 수업이 없습니다.</p>`
        }
      </section>
      <section class="member-detail-section">
        <strong>운영 메모</strong>
        <p>${member.note || "운영 메모가 없습니다."}</p>
      </section>
    </details>
  `;
  openCoachModal("memberDetailModal");
  void syncCoachMemberChart(memberUserId, member.displayName || member.name);
}

function openMemberDetail(memberId, groupName = "") {
  const member = findMemberDetail(memberId, groupName);
  if (!member) return;
  state.viewingMemberDetailId = memberId;
  state.viewingMemberGroupName = groupName;
  renderMemberDetailModal(member);
}

function closeMemberDetailModal() {
  closeCoachModal("memberDetailModal");
}

function renderMakeups() {
  const target = $("#makeupRequests");
  if (!target) return;
  const requests = state.makeupRequests.filter((request) => ["승인 대기", "pending"].includes(request.status));
  target.innerHTML =
    requests
      .map(
        (request) => `
          <article class="work-card ${state.focusedMakeupId === request.id ? "is-focused" : ""}" data-makeup-card="${request.id}">
            <div>
              <strong>${request.member}</strong>
              <span>${request.original} → ${request.requested}</span>
              <small>${request.policy || "수업 변경 승인 요청"}</small>
            </div>
            <div class="actions">
              <b>${request.status}</b>
              <button class="approve-button" type="button" data-open-makeup-detail="${request.id}">${request.serverRequestV2 && !request.canReview ? "요청 확인" : "승인 요청 확인"}</button>
            </div>
          </article>`,
      )
      .join("") || "<p class='empty-text'>확인할 수업 변경 요청이 없습니다.</p>";
}

function getMakeupLinkedLog(member) {
  return state.lessonLogs.find((log) => log.member === member && log.status !== "확인 완료") || state.lessonLogs.find((log) => log.member === member);
}

function openMakeupDetail(id) {
  state.focusedMakeupId = id;
  openMakeupApprovalModal(id);
}

function openLinkedLog(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  const log = getMakeupLinkedLog(request.member);
  if (log) state.focusedLogId = log.id;
  state.todayTaskTab = "records";
  if (!$("#lessonEditModal")?.hidden) closeLessonEditor();
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    const selector = log ? `#todayRecordPanel [data-log-card="${log.id}"]` : "#todayRecordPanel";
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function focusRecordProcessing(id) {
  if (id) state.focusedLogId = id;
  state.todayTaskTab = "records";
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    const selector = id ? `#todayRecordPanel [data-log-card="${id}"]` : "#todayRecordPanel";
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function selectCoachMode(name) {
  if (!state.coach) return;
  state.selectedCoachName = name;
  if (state.coach) {
    state.coach.name = name;
    $("#coachName").textContent = name;
  }
  renderCoachModeList();
  renderCoachProfile();
  saveSnapshot();
}

function saveCoachProfile() {
  const name = currentCoachName();
  const existing = state.coachProfiles[name] || {};
  state.coachProfiles[name] = {
    ...existing,
    intro: $("#coachIntro")?.value.trim() || "",
    specialty: $("#coachSpecialty")?.value.trim() || "",
    lessonStyle: $("#coachLessonStyle")?.value.trim() || "",
    availableMemo: $("#coachAvailableMemo")?.value.trim() || "",
    memberMessage: $("#coachMemberMessage")?.value.trim() || "",
  };
  renderCoachProfile();
  saveSnapshot();
}

function updateCoachPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const name = currentCoachName();
    const photoDataUrl = String(reader.result || "");
    state.coachProfiles[name] = {
      ...(state.coachProfiles[name] || {}),
      photo: photoDataUrl,
    };
    if (state.coach) state.coach.profilePhotoUrl = photoDataUrl;
    renderCoachProfile();
    saveSnapshot();
    const client = window.TennisNoteDataClient;
    if (state.dataMode === "live" && state.liveProfileId && client?.updateRows) {
      try {
        await client.updateRows("tn_users", { id: state.liveProfileId }, {
          profile_photo_url: photoDataUrl || null,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Tennis Note coach profile photo save failed", error);
      }
    }
  };
  reader.readAsDataURL(file);
}

async function updateMemberNtrp(memberId, value, groupName = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  const previousValue = member.coachNtrp;
  const previousRequest = member.ntrpRequest;
  if (groupName) {
    member.groupCoachNtrp = {
      ...(member.groupCoachNtrp || {}),
      [groupName]: value,
    };
  } else {
    member.coachNtrp = value;
  }
  member.ntrpRequest = value === "측정 전" ? "요청" : "완료";
  const request = state.ntrpRequests.find((item) => item.member === (groupName || member.name));
  if (request) {
    request.coachNtrp = value;
    request.status = value === "측정 전" ? "측정 요청" : "측정 완료";
    exportNtrpResult(request);
  }
  if (!groupName && member.serverUserId && window.TennisNoteDataClient?.rpc) {
    try {
      await window.TennisNoteDataClient.rpc("tn_coach_update_member_ntrp", {
        target_user_id: member.serverUserId,
        target_coach_ntrp: value === "측정 전" ? null : Number(value),
      });

      showToast(value === "측정 전" ? "NTRP 측정 요청 상태로 변경" : "코치 NTRP 저장 완료");
    } catch (error) {
      member.coachNtrp = previousValue;
      member.ntrpRequest = previousRequest;
      showToast(`NTRP 서버 저장 실패: ${error?.message || "server_error"}`);
    }
  }
  renderMembers();
  saveSnapshot();
}

function completeNtrpRequest(id) {
  const request = state.ntrpRequests.find((item) => item.id === id);
  if (!request) return;
  const member = state.members.find((item) => item.name === request.member);
  request.coachNtrp = member?.coachNtrp && member.coachNtrp !== "측정 전" ? member.coachNtrp : request.selfNtrp;
  request.status = "측정 완료";
  if (member) {
    member.coachNtrp = request.coachNtrp;
    member.ntrpRequest = "완료";
  }
  exportNtrpResult(request);
  renderMembers();
  saveSnapshot();
}

function openLessonEditor(id) {
  const lesson = ensureCoachLessonRecord(id);
  const lessonModal = $("#lessonEditModal");
  if (lessonModal) lessonModal.dataset.tnInputGuard = `coach-lesson-record:${id}`;
  state.coachQuickAdd = null;
  state.editingLessonId = id;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
  (completionParticipantsForLesson(lesson) || []).forEach((participant) => {
    if (participant.userId) void syncCoachMemberChart(participant.userId, participant.name || "회원");
  });
}

function closeLessonEditor() {
  const lesson = state.editingLessonId ? ensureCoachLessonRecord(state.editingLessonId) : null;
  if (lesson) delete lesson.scheduleEditDraft;
  state.editingLessonId = null;
  state.coachQuickAdd = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  closeCoachModal("lessonEditModal");
}

function renderLessonEditModal() {
  const target = $("#lessonEditModalContent");
  if (!target) return;
  if (state.coachQuickAdd) {
    target.innerHTML = renderCoachQuickAddPanel();
    return;
  }
  if (state.viewingCurriculumId) {
    target.innerHTML = renderCurriculumDetailPanel();
    return;
  }
  if (state.editingMakeupId) {
    target.innerHTML = renderMakeupApprovalPanel();
    return;
  }
  if (state.writingLessonId) {
    target.innerHTML = renderLessonRecordWritePanel();
    return;
  }
  target.innerHTML = renderScheduleEditPanel();
  if (state.editingLessonId) updateLessonCompletionUi(state.editingLessonId);
}

function coachQuickAddOperationKey(prefix = "coach-add") {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 120);
}

function coachQuickAddTicketAvailability(ticket = {}) {
  const targetDate = state.coachQuickAdd?.date || localDateKey();
  if (String(ticket.coachRoleId || "") !== String(state.coachQuickAdd?.coachRoleId || "")) {
    return { visible: false, available: false, reason: "" };
  }
  if (!["regular", "group"].includes(ticket.productKind)) {
    return { visible: false, available: false, reason: "" };
  }
  if (ticket.status !== "active") {
    return { visible: true, available: false, reason: ticket.status === "paused" ? "일시정지" : "사용 불가" };
  }
  if (Number(ticket.remainingSessions) <= 0) {
    return { visible: true, available: false, reason: "잔여 횟수 없음" };
  }
  if (ticket.startsOn && targetDate < ticket.startsOn) {
    return { visible: true, available: false, reason: `${ticket.startsOn}부터 사용 가능` };
  }
  if (ticket.expiresOn && targetDate > ticket.expiresOn) {
    return { visible: true, available: false, reason: "이용기간 만료" };
  }
  return { visible: true, available: true, reason: "" };
}

function coachQuickAddTicketChoices() {
  const workspace = scheduleV2CoachWorkspace();
  return (workspace?.tickets || []).map((ticket) => ({
    ticket,
    availability: coachQuickAddTicketAvailability(ticket),
  })).filter((choice) => choice.availability.visible);
}

function coachQuickAddTickets() {
  return coachQuickAddTicketChoices()
    .filter((choice) => choice.availability.available)
    .map((choice) => choice.ticket);
}

function coachQuickAddTicketLabel(ticket = {}) {
  const workspace = scheduleV2CoachWorkspace();
  const memberMap = new Map((workspace?.members || []).map((member) => [member.id, member.name || "회원"]));
  const names = (ticket.participantUserIds || [ticket.ownerUserId]).map((userId) => memberMap.get(userId)).filter(Boolean);
  return `${names.join(" · ") || "회원"} · ${ticket.productName || "회원권"} · 잔여 ${Number(ticket.remainingSessions) || 0}회`;
}

function openCoachQuickAdd(button) {
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id) === String(button.dataset.coachRoleId || ""));
  const access = coach ? coachSlotAccess(coach, button.dataset.day, button.dataset.time, scheduleBlockMinutes, policy) : { allowed: false };
  if (!coach || !access.allowed) {
    showToast(access.reason === "holiday_locked"
      ? "휴무일에는 관리자만 수업을 등록할 수 있습니다."
      : "본인 수업 시간 또는 허용된 브레이크·상담 시간만 등록할 수 있습니다.");
    return;
  }
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  state.coachQuickAdd = {
    date: button.dataset.date,
    day: button.dataset.day,
    time: button.dataset.time,
    coachRoleId: button.dataset.coachRoleId,
    coachName: coach.name,
    kind: "regular",
    durationMinutes: 20,
    ticketId: "",
    note: "",
    validationMessage: "",
  };
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function renderCoachQuickAddPanel() {
  const draft = state.coachQuickAdd;
  if (!draft) return "";
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id) === String(draft.coachRoleId || ""));
  const access = coach ? coachSlotAccess(coach, draft.day, draft.time, scheduleBlockMinutes, policy) : { reason: "available" };
  const lockedOverride = access.reason === "locked_time_override";
  const ticketChoices = coachQuickAddTicketChoices();
  const tickets = ticketChoices.filter((choice) => choice.availability.available).map((choice) => choice.ticket);
  const ticketOptions = ticketChoices.map(({ ticket, availability }) => {
    const reason = availability.reason ? ` · ${availability.reason}` : "";
    return `<option value="${escapeHtml(ticket.id)}" ${draft.ticketId === ticket.id ? "selected" : ""} ${availability.available ? "" : "disabled"}>${escapeHtml(`${coachQuickAddTicketLabel(ticket)}${reason}`)}</option>`;
  }).join("");
  const writeModeLabel = policy.coachSingleAddMode === "immediate"
    ? "저장하면 바로 시간표에 반영됩니다."
    : policy.coachSingleAddMode === "blocked"
      ? "현재 운영 설정에서 코치 수업 추가가 꺼져 있습니다."
      : "저장하면 관리자 승인 대기로 접수됩니다.";
  const durationOptions = [20, 30, 40, 60].map((minutes) => `<button type="button" class="${Number(draft.durationMinutes) === minutes ? "is-active" : ""}" data-coach-add-duration="${minutes}">${minutes}분</button>`).join("");
  return `
    <form class="schedule-edit-panel coach-quick-add-panel" data-coach-quick-add-form>
      <div class="wide lesson-modal-head">
        <div><strong>수업 추가</strong><span>${draft.date} · ${draft.time} · ${escapeHtml(shortCoachName(draft.coachName))}</span></div>
        <b class="can-process">${lockedOverride ? "브레이크·상담 수동 등록" : "빈 시간"}</b>
      </div>
      <div class="wide coach-quick-kind" role="group" aria-label="수업 종류">
        <button type="button" class="${draft.kind === "regular" ? "is-active" : ""}" data-coach-add-kind="regular">정규</button>
        <button type="button" class="${draft.kind === "makeup" ? "is-active" : ""}" data-coach-add-kind="makeup">보강</button>
      </div>
      <label class="wide lesson-required-field">
        <span>회원권 <small>필수</small></span>
        <select id="coachQuickAddTicket" required>
          <option value="">회원을 선택해 주세요</option>
          ${ticketOptions}
        </select>
      </label>
      <div class="wide coach-quick-duration" role="group" aria-label="수업 시간">${durationOptions}</div>
      <label class="wide">
        <span>메모 <small>선택</small></span>
        <input id="coachQuickAddNote" type="text" maxlength="200" value="${escapeHtml(draft.note || "")}" placeholder="예: 브레이크 시간 협의 등록" />
      </label>
      ${draft.validationMessage ? `<p class="validation-text wide">${escapeHtml(draft.validationMessage)}</p>` : ""}
      ${ticketChoices.length ? "" : '<p class="validation-text wide">담당 회원권이 없습니다. 관리자에게 회원권 상태와 담당 코치를 확인해 주세요.</p>'}
      <p class="permission-note wide">회원에게는 브레이크 시간이 열리지 않습니다. ${writeModeLabel}</p>
      <div class="actions wide">
        <button class="approve-button" type="button" data-save-coach-quick-add ${tickets.length ? "" : "disabled"}>시간표에 등록</button>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </form>`;
}

async function saveCoachQuickAdd() {
  const draft = state.coachQuickAdd;
  const workspace = scheduleV2CoachWorkspace();
  const ticketId = $("#coachQuickAddTicket")?.value || "";
  const ticket = (workspace?.tickets || []).find((item) => item.id === ticketId);
  const note = $("#coachQuickAddNote")?.value.trim() || "";
  if (!draft || !ticket) {
    if (draft) draft.validationMessage = "회원권을 선택해 주세요.";
    renderLessonEditModal();
    return;
  }
  const duration = Number(draft.durationMinutes) || 20;
  const ticketUnit = Number(ticket.lessonMinutes) || 20;
  if (duration % ticketUnit !== 0) {
    draft.validationMessage = `${ticketUnit}분 회원권은 ${ticketUnit}분 단위로 선택해 주세요.`;
    renderLessonEditModal();
    return;
  }
  const participants = (ticket.participantUserIds || [ticket.ownerUserId])
    .filter(Boolean)
    .map((userId) => ({ userId, ticketId: ticket.id }));
  if (!participants.length) {
    draft.validationMessage = "회원권 참여자를 확인할 수 없습니다.";
    renderLessonEditModal();
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !workspace?.branchId) {
    draft.validationMessage = "서버 로그인 상태를 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  draft.validationMessage = "서버에서 시간과 회원권을 확인하고 있습니다.";
  renderLessonEditModal();
  try {
    const result = await client.rpc("tn_schedule_v2_coach_save_or_request", {
      target_branch_id: workspace.branchId,
      target_coach_role_id: draft.coachRoleId,
      target_lesson_date: draft.date,
      target_start_time: draft.time,
      target_duration_minutes: duration,
      target_schedule_kind: draft.kind,
      target_participants: participants,
      target_operation_key: coachQuickAddOperationKey(),
      target_lesson_id: null,
      target_expected_revision: null,
      target_note: note || null,
    });
    const normalized = Array.isArray(result) ? result[0] || {} : result || {};
    closeLessonEditor();
    coachScheduleV2WorkspaceCache = null;
    await syncCoachScheduleV2({ force: true });
    renderAll();
    showToast(normalized.writeMode === "approval" ? "관리자 승인 대기로 접수했습니다." : "시간표에 수업을 등록했습니다.");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "");
    const slotReasonMessages = {
      holiday_locked: "휴무일에는 관리자만 수업을 등록할 수 있습니다.",
      outside_working_hours: "등록된 근무시간 밖입니다. 운영 설정의 잠금시간 등록 허용을 확인해 주세요.",
      blocked_time: "브레이크·상담시간 수동 등록이 꺼져 있습니다.",
    };
    const slotReason = Object.keys(slotReasonMessages).find((reason) => code.includes(reason));
    const messages = {
      schedule_v2_coach_time_overlap: "같은 코치의 다른 수업과 시간이 겹칩니다.",
      schedule_v2_cross_coach_ticket_forbidden: "본인 담당 회원권만 등록할 수 있습니다.",
      schedule_v2_ticket_unavailable: "현재 사용할 수 있는 회원권이 아닙니다.",
      schedule_v2_duration_ticket_mismatch: "수업 시간과 회원권 단위가 맞지 않습니다.",
      schedule_v2_coach_write_blocked: "운영 설정에서 코치 수동 등록이 꺼져 있습니다.",
      schedule_v2_coach_slot_forbidden: "이 시간은 코치 수동 등록이 허용되지 않습니다.",
    };
    const key = Object.keys(messages).find((candidate) => code.includes(candidate));
    state.coachQuickAdd.validationMessage = slotReasonMessages[slotReason]
      || messages[key]
      || "수업을 저장하지 못했습니다. 시간표를 새로고침한 뒤 다시 시도해 주세요.";
    renderLessonEditModal();
  }
}

function updateLessonCompletionUi(id) {
  const lesson = ensureCoachLessonRecord(id);
  const participantRows = $$('[data-modal-participant-row]').filter((row) => row.dataset.modalParticipantRow === id);
  const submit = activeViewField(`[data-complete-lesson-from-modal="${id}"]`);
  const rowsReady = participantRows.length > 0 && participantRows.every((row) => {
    const comment = row.querySelector("[data-modal-coach-comment]")?.value.trim() || "";
    const curriculumId = row.querySelector("[data-modal-next-curriculum]")?.value || "";
    const count = row.querySelector("[data-modal-comment-count]");
    if (count) {
      count.textContent = `${comment.length}/5자`;
      count.classList.toggle("is-ready", comment.length >= 5);
    }
    row.classList.toggle("is-ready", comment.length >= 5 && Boolean(curriculumId));
    return comment.length >= 5 && Boolean(curriculumId);
  });
  const ready = Boolean(lesson && canProcessLesson(lesson) && lessonOutcomeWindowOpen(lesson) && rowsReady);
  if (submit) submit.disabled = !ready;
}

function openMakeupApprovalModal(id) {
  state.editingLessonId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  state.editingMakeupId = id || ownPendingMakeupRequests()[0]?.id || pendingMakeupRequests()[0]?.id || "__none__";
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function openLessonRecordWriter(id) {
  const firstLesson = recordableCoachLessons()[0];
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.viewingCurriculumId = null;
  state.writingLessonId = id || firstLesson?.id || "__none__";
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

async function saveLessonEdit(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson) return;
  if (!canRescheduleLesson(lesson)) return;
  const targetDay = $("#editLessonDay")?.value || lesson.day;
  const targetTime = $("#editLessonTime")?.value || lesson.time;
  const targetDate = coachWeekDateForDay(targetDay);
  const reason = $("#editLessonReason")?.value.trim() || "";
  lesson.scheduleEditDraft = { day: targetDay, time: targetTime, reason };
  if (!reason) {
    lesson.validationMessage = "일정 변경 사유를 입력해 주세요.";
    renderLessonEditModal();
    return;
  }
  if (!targetDate) {
    lesson.validationMessage = "변경할 주차와 날짜를 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  if ((lesson.lessonDate ? lesson.lessonDate === targetDate : lesson.day === targetDay) && lesson.time === targetTime) {
    lesson.validationMessage = "현재 수업과 다른 날짜 또는 시간을 선택해 주세요.";
    renderLessonEditModal();
    return;
  }
  if (lesson.serverLessonId) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) {
      lesson.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
      renderLessonEditModal();
      return;
    }
    lesson.validationMessage = "서버에서 일정과 정책을 확인하고 있습니다.";
    renderLessonEditModal();
    try {
      await client.rpc("tn_coach_reschedule_lesson", {
        target_lesson_id: lesson.serverLessonId,
        target_lesson_date: targetDate,
        target_start_time: targetTime,
        target_reason: reason,
      });
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
      const serverMessages = {
        coach_reschedule_reason_required: "변경 사유를 2자 이상 입력해 주세요.",
        coach_reschedule_future_time_required: "이미 지난 시간으로는 변경할 수 없습니다.",
        assigned_coach_required: "본인이 담당하는 수업만 변경할 수 있습니다.",
        lesson_not_changeable: "예정 상태인 수업만 변경할 수 있습니다.",
        coach_not_working: "선택한 시간은 코치 근무시간이 아닙니다.",
        target_time_blocked: "운영 중지 시간으로 변경할 수 없습니다. 근무시간 안의 브레이크 시간은 변경할 수 있습니다.",
        target_time_occupied: "선택한 시간에 이미 수업이 있습니다.",
        target_date_outside_ticket: "회원권 이용기간 밖의 날짜입니다.",
        schedule_scope_mismatch: "평일권과 주말권의 이용 가능 요일을 확인해 주세요.",
        daily_session_limit: "회원권의 하루 이용 가능 횟수를 초과합니다.",
        weekly_session_limit: "회원권의 주간 이용 가능 횟수를 초과합니다.",
        weekly_booking_day_limit: "회원권의 주간 예약 가능 일수를 초과합니다.",
      };
      lesson.validationMessage = serverMessages[code] || "일정 변경에 실패했습니다. 시간표와 회원권 상태를 확인해 주세요.";
      renderLessonEditModal();
      return;
    }
  }
  const lessonUpdates = {
    lessonDate: targetDate,
    day: targetDay,
    time: targetTime,
    type: String(lesson.type || "").replace(/^정규/, "코치변경"),
    source: "coach_change",
    task: "변경된 일정 수업 후 기록",
    validationMessage: "",
  };
  delete lesson.scheduleEditDraft;
  Object.assign(lesson, lessonUpdates);
  const liveLesson = state.liveLessons.find((item) => item.serverLessonId && item.serverLessonId === lesson.serverLessonId);
  if (liveLesson) Object.assign(liveLesson, lessonUpdates);
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  closeLessonEditor();
  renderAll();
}

function coachAttendanceParticipantResults(lesson, outcome, deduct, reason) {
  return completionParticipantsForLesson(lesson).map((participant) => ({
    userId: participant.userId || "",
    ticketId: participant.ticketId || "",
    outcome,
    deduct: Boolean(deduct),
    technique: "",
    strength: "",
    improvement: "",
    nextGoal: "",
    coachComment: reason,
    keywords: [],
    nextCurriculumRefId: null,
    memberJournalId: null,
  }));
}

async function processCoachAttendance(lessonId, outcome, deduct) {
  const lesson = ensureCoachLessonRecord(lessonId);
  const isAbsence = outcome === "absence";
  const inputSelector = isAbsence ? "#coachAbsenceReason" : "#coachNoShowReason";
  const reason = $(inputSelector)?.value.trim() || "";
  const label = isAbsence ? "불참" : "노쇼";
  if (!lesson?.serverLessonId || reason.length < 2) {
    if (lesson) lesson.validationMessage = `${label} 사유를 2자 이상 입력해 주세요.`;
    renderLessonEditModal();
    $(inputSelector)?.focus();
    return;
  }
  const participantResults = coachAttendanceParticipantResults(lesson, outcome, deduct, reason);
  if (!participantResults.length || participantResults.some((item) => !item.userId || !item.ticketId)) {
    lesson.validationMessage = "이 수업의 회원과 회원권 연결을 확인할 수 없습니다. 시간표를 새로고침해 주세요.";
    renderLessonEditModal();
    return;
  }
  const consequence = isAbsence && !deduct
    ? "횟수는 차감하지 않고 보강 가능 상태로 전환합니다."
    : `${deduct ? "회원권 횟수를 차감합니다." : "회원권 횟수는 차감하지 않습니다."}`;
  if (!window.confirm(`${lesson.member} 수업을 ${label} · ${deduct ? "차감" : "차감 없음"}으로 처리할까요?\n\n${consequence}`)) return;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    lesson.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
    renderLessonEditModal();
    return;
  }
  lesson.validationMessage = `${label} 처리와 회원권 상태를 확인하고 있습니다.`;
  renderLessonEditModal();
  try {
    await client.rpc("tn_schedule_v2_process_lesson", {
      target_lesson_id: lesson.serverLessonId,
      target_participant_results: participantResults,
      target_finalize: true,
      target_operation_key: `schedule-v2-coach-${outcome}:${lesson.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
    closeLessonEditor();
    coachScheduleV2WorkspaceCache = null;
    await syncCoachLessonsFromServer();
    renderAll();
    showToast(`${label} · ${deduct ? "횟수 차감" : "차감 없음"} 처리 완료${isAbsence && !deduct ? " · 보강 가능" : ""}`);
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    lesson.validationMessage = code.includes("ticket_units_unavailable") || code.includes("ticket_unavailable")
      ? "차감 가능한 회원권 횟수가 없습니다."
      : code.includes("already_processed") || code.includes("existing_final")
        ? "이미 처리된 수업입니다. 시간표를 새로고침해 주세요."
        : code.includes("forbidden")
          ? "본인이 담당하는 수업만 처리할 수 있습니다."
          : code.includes("status_invalid")
            ? "현재 상태에서는 처리할 수 없습니다. 새로고침 후 다시 확인해 주세요."
            : `${label} 처리에 실패했습니다. 수업과 회원권 연결을 다시 확인해 주세요.`;
    renderLessonEditModal();
  }
}

async function markCoachLessonAbsent(id) {
  return processCoachAttendance(id, "absence", false);
}

async function restoreCoachLessonAbsence(entitlementId) {
  const entitlement = state.makeupEntitlements.find((item) => item.id === entitlementId);
  if (!entitlement || !["open", "booked"].includes(entitlement.status)) return;
  const cancelBookedMakeup = entitlement.status === "booked";
  const bookedLabel = [entitlement.bookedDate, entitlement.bookedTime].filter(Boolean).join(" ");
  const confirmation = cancelBookedMakeup
    ? `${entitlement.member} 회원의 ${entitlement.original} 정규수업을 복원할까요?\n\n${bookedLabel || "예약된 보강"} 수업은 취소됩니다.`
    : `${entitlement.member} 회원의 ${entitlement.original} 정규수업을 다시 살릴까요?\n\n불참 처리와 보강 대기는 취소됩니다.`;
  if (!window.confirm(confirmation)) return;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    showToast("서버 로그인 상태를 먼저 확인해 주세요.");
    return;
  }
  try {
    await client.rpc("tn_restore_absent_lesson", {
      target_entitlement_id: entitlement.id,
      target_reason: "회원 참석 재확인",
      target_cancel_booked_makeup: cancelBookedMakeup,
    });
    await syncCoachLessonsFromServer();
    renderAll();
    showToast("원래 정규수업 복원 완료");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const message = code.includes("absence_original_slot_occupied")
      ? "원래 시간에 다른 수업이 있어 복원할 수 없습니다."
      : code.includes("absence_original_lesson_already_started")
        ? "이미 지난 정규수업은 참석으로 되돌릴 수 없습니다."
        : code.includes("absence_booked_makeup_locked")
          ? "이미 시작하거나 완료된 보강이 있어 복원할 수 없습니다."
          : code.includes("absence_restore_coach_or_admin_required")
            ? "담당 코치 또는 관리자만 복원할 수 있습니다."
            : "정규수업 복원에 실패했습니다. 시간표를 새로고침해 주세요.";
    showToast(message);
  }
}

async function processCoachNoShow(lessonId, deduct) {
  return processCoachAttendance(lessonId, "no_show", deduct);
}

function openFinalFeedbackRevision(lessonId, participantKey) {
  const lesson = ensureCoachLessonRecord(lessonId);
  if (!lesson || !canProcessLesson(lesson)) return;
  lesson.feedbackRevisionKey = participantKey;
  lesson.validationMessage = "";
  renderLessonEditModal();
  activeViewField("[data-feedback-revision-comment]")?.focus({ preventScroll: true });
}

function cancelFinalFeedbackRevision(lessonId) {
  const lesson = ensureCoachLessonRecord(lessonId);
  if (!lesson) return;
  delete lesson.feedbackRevisionKey;
  lesson.validationMessage = "";
  renderLessonEditModal();
}

async function saveFinalFeedbackRevision(lessonId) {
  const lesson = ensureCoachLessonRecord(lessonId);
  if (!lesson || !lesson.serverLessonId || !canProcessLesson(lesson) || !lesson.feedbackRevisionKey) return;
  const rows = $$('[data-feedback-revision-row]');
  const row = rows.find((candidate) => candidate.dataset.feedbackRevisionRow === lesson.feedbackRevisionKey);
  const participant = completionParticipantsForLesson(lesson)
    .find((candidate, index) => lessonChartParticipantKey(candidate, index) === lesson.feedbackRevisionKey);
  const coachComment = row?.querySelector("[data-feedback-revision-comment]")?.value.trim() || "";
  const nextCurriculumId = row?.querySelector("[data-feedback-revision-curriculum]")?.value || "";
  const expectedUpdatedAt = row?.dataset.recordUpdatedAt || participant?.updatedAt || "";
  if (!row || !participant?.userId || !expectedUpdatedAt) {
    lesson.validationMessage = "최신 피드백 정보를 다시 불러온 뒤 수정해 주세요.";
    renderLessonEditModal();
    return;
  }
  const validationMessage = coachCommentValidationMessage({
    id: `feedback-revision:${lesson.serverLessonId}:${participant.userId}`,
    member: participant.name || lesson.member,
    coachComment,
  });
  if (validationMessage) {
    lesson.validationMessage = validationMessage;
    renderLessonEditModal();
    return;
  }
  if (!nextCurriculumId) {
    lesson.validationMessage = "다음 커리큘럼을 검색해서 선택해 주세요.";
    renderLessonEditModal();
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token || client.isOnline?.() === false) {
    lesson.validationMessage = "서버 연결 후 완료 피드백을 수정할 수 있습니다.";
    renderLessonEditModal();
    return;
  }
  const button = row.querySelector("[data-save-final-feedback]");
  if (button) {
    button.disabled = true;
    button.textContent = "저장 중";
  }
  try {
    const nextStep = selectedCurriculum(nextCurriculumId);
    const curriculumRefId = await liveCurriculumRefId(nextStep);
    if (!curriculumRefId) throw new Error("schedule_v2_outcome_curriculum_invalid");
    const result = await client.rpc("tn_schedule_v2_update_feedback", {
      target_lesson_id: lesson.serverLessonId,
      target_user_id: participant.userId,
      target_coach_comment: coachComment,
      target_next_curriculum_ref_id: curriculumRefId,
      target_expected_updated_at: expectedUpdatedAt,
      target_operation_key: `schedule-v2-coach-feedback-revision:${lesson.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    });
    Object.assign(participant, {
      coachComment,
      nextCurriculumRefId: curriculumRefId,
      nextCurriculumId: nextStep.id,
      nextCurriculumTitle: nextStep.title || "",
      updatedAt: result?.updatedAt || new Date().toISOString(),
    });
    const log = state.lessonLogs.find((item) => String(item.serverLessonId || "") === String(lesson.serverLessonId));
    if (log) {
      log.coachComment = coachComment;
      log.nextCurriculumId = nextStep.id;
      log.curriculumId = nextStep.id;
      log.feedbackRevised = true;
      if (Array.isArray(log.participantResults)) {
        const participantResult = log.participantResults.find((item) => String(item.userId || "") === String(participant.userId));
        if (participantResult) Object.assign(participantResult, { coachComment, nextCurriculumId: nextStep.id });
      }
    }
    delete lesson.feedbackRevisionKey;
    lesson.validationMessage = "";
    saveSnapshot();
    renderLessonEditModal();
    renderAll();
    showToast("완료 피드백을 수정했습니다. 회원권 횟수는 그대로입니다.");
    void syncCoachScheduleV2({ force: true }).then(() => renderAll()).catch(() => false);
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    lesson.validationMessage = code.includes("schedule_v2_feedback_revision_stale")
      ? "다른 화면에서 피드백을 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요."
      : code.includes("schedule_v2_feedback_revision_forbidden")
        ? "담당 코치 또는 관리자만 완료 피드백을 수정할 수 있습니다."
        : "피드백을 저장하지 못했습니다. 내용을 유지한 채 다시 확인해 주세요.";
    renderLessonEditModal();
  }
}

function captureLessonChartDraft(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson) return [];
  const rows = $$('[data-modal-participant-row]').filter((row) => row.dataset.modalParticipantRow === id);
  const participantResults = rows.map((row) => ({
    userId: row.dataset.userId || "",
    ticketId: row.dataset.ticketId || "",
    name: row.dataset.participantName || "회원",
    ticketName: row.dataset.ticketName || "회원권",
    totalSessions: Number(row.dataset.totalSessions) || 0,
    usedSessions: Number(row.dataset.usedSessions) || 0,
    remainingSessions: Number(row.dataset.remainingSessions) || 0,
    coachComment: row.querySelector("[data-modal-coach-comment]")?.value.trim() || "",
    nextCurriculumId: row.querySelector("[data-modal-next-curriculum]")?.value || "",
  }));
  const drafts = {};
  participantResults.forEach((result, index) => {
    drafts[lessonChartParticipantKey(result, index)] = {
      coachComment: result.coachComment,
      nextCurriculumId: result.nextCurriculumId,
      savedAt: Date.now(),
    };
  });
  state.lessonChartDrafts ||= {};
  state.lessonChartDrafts[id] = drafts;
  saveSnapshot();
  return participantResults;
}

async function saveLessonChartDraft(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson || !canProcessLesson(lesson)) return false;
  const participantResults = captureLessonChartDraft(id);
  if (!participantResults.length) {
    lesson.validationMessage = "수업 참여자와 회원권 연결을 확인해 주세요.";
    renderLessonEditModal();
    return false;
  }
  const exactPairs = participantResults.every((result) => result.userId && result.ticketId);
  const client = window.TennisNoteDataClient;
  const canSaveServer = Boolean(lesson.serverLessonId && exactPairs && client?.rpc && client.getSession?.()?.access_token && client.isOnline?.() !== false);
  if (!canSaveServer) {
    window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
    showToast(lesson.serverLessonId ? "이 기기에 임시 저장했습니다. 연결되면 다시 저장해 주세요." : "이 기기에 임시 저장했습니다.");
    return true;
  }
  const button = activeViewField(`[data-save-lesson-draft="${id}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "저장 중";
  }
  try {
    const serverParticipantResults = await Promise.all(participantResults.map(async (result) => {
      const nextStep = result.nextCurriculumId ? selectedCurriculum(result.nextCurriculumId) : null;
      const curriculumRefId = nextStep ? await liveCurriculumRefId(nextStep) : null;
      return {
        userId: result.userId,
        ticketId: result.ticketId,
        outcome: "completed",
        deduct: false,
        technique: "",
        strength: "",
        improvement: "",
        nextGoal: nextStep?.title || "",
        coachComment: result.coachComment,
        keywords: [],
        nextCurriculumRefId: curriculumRefId || null,
        memberJournalId: null,
      };
    }));
    await client.rpc("tn_schedule_v2_process_lesson", {
      target_lesson_id: lesson.serverLessonId,
      target_participant_results: serverParticipantResults,
      target_finalize: false,
      target_operation_key: `schedule-v2-coach-draft:${lesson.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    });
    const draftsByPair = new Map(participantResults.map((result) => [`${result.userId}:${result.ticketId}`, result]));
    lesson.v2Participants = (lesson.v2Participants || []).map((participant) => {
      const draft = draftsByPair.get(`${participant.userId}:${participant.ticketId}`);
      return draft ? {
        ...participant,
        recordStatus: "draft",
        coachComment: draft.coachComment,
        nextCurriculumSkillLabel: draft.nextCurriculumId,
        nextCurriculumTitle: draft.nextCurriculumId ? selectedCurriculum(draft.nextCurriculumId)?.title || "" : "",
      } : participant;
    });
    lesson.validationMessage = "";
    window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
    saveSnapshot();
    showToast("코치 메모를 저장했습니다. 회원에게는 아직 공개되지 않습니다.");
    return true;
  } catch (error) {
    lesson.validationMessage = "메모를 서버에 저장하지 못했습니다. 작성 내용은 이 기기에 보관했습니다.";
    renderLessonEditModal();
    return false;
  }
}

function saveLessonRecord() {
  const lesson = ensureCoachLessonRecord($("#recordLessonSelect")?.value) || recordableCoachLessons()[0];
  if (!lesson) return;
  const nextCurriculumId = $("#recordNextCurriculum")?.value || "";
  const log = {
    id: `coach-record-${Date.now()}`,
    serverLessonId: lesson.serverLessonId || "",
    serverJournalId: "",
    member: lesson.member,
    lesson: `${lesson.day} ${lesson.time} ${lesson.type}`,
    content: $("#recordLessonContent")?.value.trim() || `${lesson.member} ${lesson.type} 수업 진행`,
    selfMemo: $("#recordSelfMemo")?.value.trim() || "회원 운동노트 미작성 · 코치가 수업 후 기록을 먼저 작성했습니다.",
    curriculumId: nextCurriculumId,
    nextCurriculumId,
    coachComment: $("#recordCoachComment")?.value.trim() || "",
    validationMessage: "",
    status: "확인 대기",
  };
  state.lessonLogs.unshift(log);
  state.focusedLogId = log.id;
  state.todayTaskTab = "records";
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  closeLessonEditor();
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    document.querySelector(`#todayRecordPanel [data-log-card="${log.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

async function completeLessonFromModal(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson || !canProcessLesson(lesson) || lesson.completionSubmitting) return;
  if (!lessonOutcomeWindowOpen(lesson)) {
    lesson.validationMessage = lessonOutcomeGuardMessage();
    renderLessonEditModal();
    return;
  }
  const content = `${lesson.member} ${lesson.type} 수업 진행`;
  const participantResults = captureLessonChartDraft(id);
  const primaryResult = participantResults[0] || {};
  const existingLog = state.lessonLogs.find((item) => item.serverLessonId && item.serverLessonId === lesson.serverLessonId && item.status !== "확인 완료");
  const logId = existingLog?.id || `coach-complete-${Date.now()}`;
  const log = existingLog || {
    id: logId,
    serverLessonId: lesson.serverLessonId || "",
    serverJournalId: "",
    member: lesson.member,
    lesson: `${lesson.day} ${lesson.time} ${lesson.type}`,
    content,
    selfMemo: "회원 운동노트 미작성이어도 코치가 기록/차감 확인을 진행했습니다.",
    curriculumId: primaryResult.nextCurriculumId || "",
    nextCurriculumId: primaryResult.nextCurriculumId || "",
    coachComment: primaryResult.coachComment || "",
    participantResults,
    validationMessage: "",
    status: "확인 대기",
    curriculumRegistered: false,
    ticketDeducted: false,
  };
  Object.assign(log, {
    content,
    curriculumId: primaryResult.nextCurriculumId || "",
    nextCurriculumId: primaryResult.nextCurriculumId || "",
    coachComment: primaryResult.coachComment || "",
    participantResults,
    validationMessage: "",
  });
  const usesV2Participants = Array.isArray(lesson.v2Participants) && lesson.v2Participants.length > 0;
  const missingParticipant = participantResults.find((result) => (
    !result.coachComment
    || !result.nextCurriculumId
    || (usesV2Participants && (!result.userId || !result.ticketId))
  ));
  if (!participantResults.length || missingParticipant) {
    lesson.validationMessage = missingParticipant
      ? `${missingParticipant.name} 회원의 코치 코멘트와 다음 커리큘럼을 입력해 주세요.`
      : "수업 참여자와 회원권 연결을 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  const invalidParticipant = participantResults
    .map((result) => ({
      name: result.name,
      message: coachCommentValidationMessage({
        id: `${logId}:${result.userId}:${result.ticketId}`,
        member: result.name,
        coachComment: result.coachComment,
      }),
    }))
    .find((result) => result.message);
  if (invalidParticipant) {
    lesson.validationMessage = `${invalidParticipant.name}: ${invalidParticipant.message}`;
    renderLessonEditModal();
    return;
  }
  if (!existingLog) state.lessonLogs.unshift(log);
  lesson.validationMessage = "";
  lesson.completionSubmitting = true;
  const submit = activeViewField(`[data-complete-lesson-from-modal="${id}"]`);
  if (submit) {
    submit.disabled = true;
    submit.textContent = "저장 중";
  }
  const completed = await confirmLog(log.id, { skipDraft: true });
  lesson.completionSubmitting = false;
  if (!completed) {
    lesson.validationMessage = log.validationMessage || "완료 처리에 실패했습니다. 같은 화면에서 다시 시도해 주세요.";
    renderLessonEditModal();
    return;
  }
  delete state.lessonChartDrafts?.[id];
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  state.todayTaskTab = "lessons";
  state.focusedLogId = "";
  closeLessonEditor();
  renderAll();
  setView("todayView");
}

function refreshSelectedCoachScheduleWeek() {
  if (state.dataMode !== "live" || !state.coach?.branchId) return;
  coachScheduleV2WorkspaceCache = null;
  void syncCoachScheduleV2({ force: true }).then((synced) => {
    if (!synced) return refreshCoachLiveSchedule({ force: true });
    renderAll();
    saveSnapshot();
    return true;
  }).catch(() => false);
}

function changeScheduleWeek(delta) {
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(activeWeekIndex() + Number(delta), coachScheduleMaxWeekOffset),
  );
  renderAll();
  refreshSelectedCoachScheduleWeek();
}

function coachWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const targetDayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + targetDayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
}

function changeCoachMonth(delta) {
  const currentStart = new Date(`${activeScheduleWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(coachWeekOffsetForDate(target), coachScheduleMaxWeekOffset),
  );
  renderAll();
  saveSnapshot();
  refreshSelectedCoachScheduleWeek();
}

function selectCoachMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeScheduleWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(coachWeekOffsetForDate(target), coachScheduleMaxWeekOffset),
  );
  renderAll();
  saveSnapshot();
  refreshSelectedCoachScheduleWeek();
}

function coachScheduleMonthValue(week = activeScheduleWeek()) {
  return String(week.startDate || "").slice(0, 7);
}

function curriculumOptions(selectedId, query = "") {
  const canonicalSelectedId = canonicalCurriculumId(selectedId);
  const searchQuery = String(query || "").trim();
  const search = window.TennisNoteCurriculumSearch;
  const rankedSteps = searchQuery && search?.search
    ? search.search(curriculumSteps, searchQuery, { limit: 24 }).map((result) => result.step)
    : null;
  const normalizedQuery = searchQuery.toLocaleLowerCase("ko-KR");
  const matchesQuery = (step) => {
    if (!normalizedQuery) return true;
    if (rankedSteps) return rankedSteps.includes(step);
    return `${step.id || ""} ${step.title || ""} ${step.trackTitle || ""} ${step.category || ""}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery);
  };
  if (rankedSteps) {
    const visibleSteps = [...rankedSteps];
    const selectedStep = curriculumSteps.find((step) => step.id === canonicalSelectedId);
    if (selectedStep && !visibleSteps.includes(selectedStep)) visibleSteps.unshift(selectedStep);
    return visibleSteps
      .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${escapeHtml(step.title)} · ${escapeHtml(step.trackTitle || step.category || "커리큘럼")}</option>`)
      .join("");
  }
  if (!curriculumCatalog.tracks?.length) {
    return curriculumSteps
      .filter(matchesQuery)
      .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${step.title}</option>`)
      .join("");
  }
  const groups = [
    { title: "기초 움직임과 서브", steps: (curriculumCatalog.fundamentals || []).filter(matchesQuery) },
    ...curriculumCatalog.tracks.map((track) => ({ title: track.title, steps: (track.lessons || []).filter(matchesQuery) })),
  ].filter((group) => group.steps?.length);
  return groups
    .map(
      (group) => `
        <optgroup label="${escapeHtml(group.title)}">
          ${group.steps
            .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${escapeHtml(step.title)}</option>`)
            .join("")}
        </optgroup>`,
    )
    .join("");
}

function filterCurriculumOptions(input) {
  const select = input?.closest("label")?.querySelector("select");
  if (!select) return;
  const selectedId = select.value || "";
  select.innerHTML = `<option value="">검색·선택</option>${curriculumOptions(selectedId, input.value)}`;
  if ([...select.options].some((option) => option.value === selectedId)) select.value = selectedId;
  renderCoachCurriculumSuggestions(input);
  updateCoachCurriculumDetailLink(input);
}

function coachCurriculumSearchResults(query) {
  const value = String(query || "").trim();
  if (!value) return [];
  const search = window.TennisNoteCurriculumSearch;
  if (search?.search) return search.search(curriculumSteps, value, { limit: 24 }).map((result) => result.step);
  const normalized = value.toLocaleLowerCase("ko-KR");
  return curriculumSteps
    .filter((step) => `${step.id} ${step.title} ${step.trackTitle || ""} ${step.category || ""}`.toLocaleLowerCase("ko-KR").includes(normalized))
    .slice(0, 24);
}

function exactCoachCurriculum(value = "") {
  const code = canonicalCurriculumId(String(value).trim().split(/\s|·/)[0]);
  return curriculumSteps.find((step) => step.id === code) || null;
}

function coachCurriculumNotionUrl(step) {
  const value = String(step?.notionUrl || "").trim();
  return /^https:\/\/(?:www\.)?(?:app\.)?notion\.(?:com|so|site)\//i.test(value) ? value : "";
}

function coachCurriculumDetailLinkMarkup(step) {
  const notionUrl = coachCurriculumNotionUrl(step);
  if (!notionUrl) return "";
  return `<a class="tn-curriculum-detail-link" href="${escapeHtml(notionUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`${step.id} ${step.title} 자세히 보기`)}">자세히 보기</a>`;
}

function updateCoachCurriculumDetailLink(input) {
  const label = input?.closest("label");
  if (!label) return;
  let link = label.querySelector("[data-curriculum-detail-link]");
  if (!link) {
    link = document.createElement("a");
    link.className = "tn-curriculum-detail-link tn-curriculum-selected-detail";
    link.dataset.curriculumDetailLink = "";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "자세히 보기";
    link.hidden = true;
    input.insertAdjacentElement("afterend", link);
  }
  const step = exactCoachCurriculum(input.value)
    || exactCoachCurriculum(label.querySelector("select")?.value || "");
  const notionUrl = coachCurriculumNotionUrl(step);
  link.hidden = !notionUrl;
  if (!notionUrl) {
    link.removeAttribute("href");
    link.removeAttribute("aria-label");
    return;
  }
  link.href = notionUrl;
  link.setAttribute("aria-label", `${step.id} ${step.title} 자세히 보기`);
}

function renderCoachCurriculumSuggestions(input) {
  const target = input?.closest("label")?.querySelector("[data-curriculum-option-suggestions]");
  if (!target) return;
  const query = String(input.value || "").trim();
  const exactCode = canonicalCurriculumId(query.split(/\s|·/)[0]);
  const exactStep = curriculumSteps.find((step) => step.id === exactCode);
  if (!query || (exactStep && `${exactStep.id} · ${exactStep.title}` === query)) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  const matches = coachCurriculumSearchResults(query);
  target.hidden = false;
  target.innerHTML = matches.length
    ? matches.map((step, index) => `<div class="tn-curriculum-suggestion-row"><button type="button" class="tn-curriculum-suggestion${index === 0 ? " is-active" : ""}" role="option" data-curriculum-option-code="${escapeHtml(step.id)}"><strong>${escapeHtml(`${step.id} · ${step.title}`)}</strong><span>${escapeHtml([step.trackTitle || step.category, step.stageLabel || step.level].filter(Boolean).join(" · "))}</span><small>${escapeHtml(step.focus || step.goal || step.guide || "선택한 단계가 다음 커리큘럼으로 저장됩니다.")}</small></button>${coachCurriculumDetailLinkMarkup(step)}</div>`).join("")
    : '<p class="tn-curriculum-suggestions-empty">일치하는 단계가 없습니다. 증상이나 동작을 다른 말로 입력해 보세요.</p>';
}

function selectCoachCurriculumSuggestion(button) {
  const label = button?.closest("label");
  const input = label?.querySelector("[data-curriculum-option-search]");
  const select = label?.querySelector("select");
  const target = label?.querySelector("[data-curriculum-option-suggestions]");
  const step = selectedCurriculum(button?.dataset.curriculumOptionCode || "");
  if (!input || !select || !step) return;
  input.value = `${step.id} · ${step.title}`;
  select.innerHTML = `<option value="">검색·선택</option>${curriculumOptions(step.id)}`;
  select.value = step.id;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  if (target) target.hidden = true;
  updateCoachCurriculumDetailLink(input);
  input.focus();
}

function selectedCurriculum(id) {
  const canonicalId = canonicalCurriculumId(id);
  return curriculumSteps.find((step) => step.id === canonicalId) || curriculumSteps[0];
}

function canonicalCurriculumId(id = "") {
  return curriculumCatalog.aliases?.[id] || id || "";
}

function curriculumNotionUrl(step) {
  return step?.notionUrl || notionCurriculumDetailUrl;
}

function journalMediaMarkup(log = {}) {
  if (log.mediaItems?.length) {
    return `<div class="coach-journal-media">${log.mediaItems.map((item) => {
      const name = escapeHtml(item.name || "수업 첨부");
      const url = escapeHtml(item.url || "");
      if (String(item.type || "").startsWith("video/")) {
        return `<figure><video controls preload="metadata" src="${url}" aria-label="${name}"></video><figcaption>${name}</figcaption></figure>`;
      }
      return `<figure><img src="${url}" alt="${name}" loading="lazy" /><figcaption>${name}</figcaption></figure>`;
    }).join("")}</div>`;
  }
  if (!log.mediaNames?.length) return "";
  return `<div class="media-list">${log.mediaNames.map((name) => `<b class="media-chip">${escapeHtml(name)}</b>`).join("")}</div>`;
}

function recordProcessingMarkup() {
  importMemberLessonLogs();
  importPracticeFeedbackRequests();
  const pendingLogs = ownPendingLessonLogs();
  const pendingFeedback = ownPendingFeedbackRequests();
  const completedLogs = ownCompletedLessonLogs();
  const completedFeedback = ownCompletedFeedbackRequests();
  const recordFilter = coachRecordStatusFilter();
  const recordTabs = `
    <div class="record-status-tabs" role="tablist" aria-label="피드백 작성 상태">
      <button type="button" role="tab" aria-selected="${recordFilter === "pending"}" class="${recordFilter === "pending" ? "is-active" : ""}" data-record-status-filter="pending">작성 필요 <b>${pendingLogs.length + pendingFeedback.length}</b></button>
      <button type="button" role="tab" aria-selected="${recordFilter === "completed"}" class="${recordFilter === "completed" ? "is-active" : ""}" data-record-status-filter="completed">작성 완료 <b>${completedLogs.length + completedFeedback.length}</b></button>
    </div>`;
  if (recordFilter === "completed") {
    const completedItems = [
      ...completedLogs.map((log) => ({
        id: log.id,
        member: log.member,
        meta: coachRecordLessonMetaMarkup(log),
        detail: log.coachComment || "코치 피드백 저장 완료",
        kind: "수업 피드백",
      })),
      ...completedFeedback.map((request) => ({
        id: request.id,
        member: request.member,
        meta: `<div class="record-lesson-meta"><b>${escapeHtml(request.date || "날짜 확인")}</b><span>운동노트</span><small>회원 요청 피드백</small></div>`,
        detail: request.coachFeedback || "코치 답변 완료",
        kind: "운동노트 피드백",
      })),
    ].slice(0, 12);
    return `${recordTabs}
      <section class="record-section">
        <div class="record-section-title"><strong>작성 완료</strong><small>최근 완료한 피드백을 확인합니다.</small></div>
        <div class="completed-record-list">
          ${completedItems.length ? completedItems.map((item) => `
            <article class="completed-record-row">
              <div><strong>${escapeHtml(item.member || "회원")}</strong><span>${item.kind}</span></div>
              ${item.meta}
              <p>${escapeHtml(item.detail)}</p>
            </article>`).join("") : coachEmptyState({ title: "작성 완료된 피드백이 없습니다", reason: "완료 처리한 피드백이 여기에 표시됩니다.", compact: true })}
        </div>
      </section>`;
  }
  const showAllRecords = isTodayTaskExpanded("records");
  const visibleLogs = showAllRecords ? pendingLogs : pendingLogs.slice(0, 3);
  const visibleFeedback = showAllRecords ? pendingFeedback : pendingFeedback.slice(0, Math.max(0, 3 - visibleLogs.length));
  const allRecordItems = [...pendingLogs, ...pendingFeedback];
  const lessonMarkup =
    visibleLogs
      .map((log) => {
        const nextStep = selectedCurriculum(log.nextCurriculumId || log.curriculumId);
        const confirmed = log.status === "확인 완료";
        const participantResults = completionDraftResultsForLog(log);
        const hasParticipantDrafts = Array.isArray(log.participantResults) && log.participantResults.length > 0;
        const participantDraftsRequirePairs = participantResults.some((result) => result.userId || result.ticketId)
          || state.liveLessons.some((lesson) => (
            lesson.serverLessonId === log.serverLessonId
            && Array.isArray(lesson.v2Participants)
            && lesson.v2Participants.length
          ));
        const participantDraftsReady = participantResults.every((result) => (
          String(result.coachComment || "").trim().length >= 5
          && Boolean(result.nextCurriculumId)
          && (!participantDraftsRequirePairs || Boolean(result.userId && result.ticketId))
        ));
        const participantDraftMarkup = hasParticipantDrafts
          ? `<div class="lesson-participant-completion-list lesson-log-participant-list">
              ${participantResults.map((result) => {
                const resultNextStep = result.nextCurriculumId ? selectedCurriculum(result.nextCurriculumId) : null;
                const resultCommentLength = String(result.coachComment || "").trim().length;
                const ticketSummary = result.ticketName
                  ? `${result.ticketName} · 총 ${Number(result.totalSessions) || 0} / 소진 ${Number(result.usedSessions) || 0} / 잔여 ${Number(result.remainingSessions) || 0}`
                  : "연결 회원권";
                return `<section class="lesson-participant-completion-card" data-log-participant-row="${escapeHtml(log.id)}" data-user-id="${escapeHtml(result.userId || "")}" data-ticket-id="${escapeHtml(result.ticketId || "")}" data-participant-name="${escapeHtml(result.name || "회원")}">
                  <div class="lesson-participant-completion-head">
                    <strong>${escapeHtml(result.name || "회원")}</strong>
                    <span>${escapeHtml(ticketSummary)}</span>
                  </div>
                  <label>
                    <span>코치 코멘트 <small>필수 · 5자 이상</small></span>
                    <textarea data-log-participant-comment="${escapeHtml(log.id)}" rows="3" ${confirmed ? "disabled" : ""}>${escapeHtml(result.coachComment || "")}</textarea>
                    <div class="tn-comment-draft-tools">
                      <input data-log-participant-keywords="${escapeHtml(log.id)}" type="text" maxlength="160" placeholder="키워드 입력 · Enter로 초안 만들기" ${confirmed ? "disabled" : ""} />
                      <button type="button" data-generate-log-participant-comment="${escapeHtml(log.id)}" ${confirmed ? "disabled" : ""}>초안 만들기</button>
                    </div>
                    <small class="lesson-comment-count ${resultCommentLength >= 5 ? "is-ready" : ""}" data-log-participant-comment-count="${escapeHtml(log.id)}">${resultCommentLength}/5자</small>
                  </label>
                  <label>
                    <span>다음 커리큘럼 <small>필수</small></span>
                    <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="${escapeHtml(result.name || "회원")} 다음 커리큘럼 검색" ${confirmed ? "disabled" : ""} />
                    <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
                    <select data-log-participant-curriculum="${escapeHtml(log.id)}" ${confirmed ? "disabled" : ""}>
                      <option value="">검색·선택</option>
                      ${curriculumOptions(result.nextCurriculumId || "")}
                    </select>
                  </label>
                  <em>${resultNextStep ? `다음 수업: ${escapeHtml(resultNextStep.id)} · ${escapeHtml(resultNextStep.title)}` : "다음 커리큘럼 선택 필요"}</em>
                </section>`;
              }).join("")}
            </div>`
          : `<label>
              <span>코치 코멘트 <small>필수 · 5자 이상</small></span>
              <textarea data-coach-comment="${log.id}" rows="3" ${confirmed ? "disabled" : ""}>${escapeHtml(log.coachComment || "")}</textarea>
              <div class="tn-comment-draft-tools">
                <input data-log-comment-keywords="${log.id}" type="text" maxlength="160" placeholder="키워드 입력 · Enter로 초안 만들기" ${confirmed ? "disabled" : ""} />
                <button type="button" data-generate-log-comment="${log.id}" ${confirmed ? "disabled" : ""}>초안 만들기</button>
              </div>
              <small class="lesson-comment-count ${String(log.coachComment || "").trim().length >= 5 ? "is-ready" : ""}" data-log-comment-count="${log.id}">${String(log.coachComment || "").trim().length}/5자</small>
            </label>
            <label>
              <span>다음 커리큘럼 <small>필수</small></span>
              <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="다음 커리큘럼 검색" ${confirmed ? "disabled" : ""} />
              <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
              <select data-next-curriculum="${log.id}" ${confirmed ? "disabled" : ""}><option value="">검색·선택</option>${curriculumOptions(log.nextCurriculumId || log.curriculumId)}</select>
            </label>
            <em>다음 수업: ${escapeHtml(nextStep.id)} · ${escapeHtml(nextStep.title)}</em>`;
        return `
          <article class="work-card log-card lesson-completion-card ${state.focusedLogId === log.id ? "is-focused" : ""}" data-log-card="${log.id}">
            <div class="log-main">
              <div class="lesson-completion-card-head">
                <strong>${escapeHtml(log.member)}</strong>
                <b>${escapeHtml(coachStatusLabel("coachRecord", log.serverDeducted || log.ticketDeducted ? "deducted" : log.status, log.status))}</b>
              </div>
              ${coachRecordLessonMetaMarkup(log)}
              ${confirmed ? `<p class="coach-comment-view">코치 코멘트: ${log.coachComment}</p>` : ""}
              <details class="lesson-log-reference">
                <summary>수업 참고</summary>
                <span>${log.content}</span>
                <small>${log.selfMemo}</small>
                ${journalMediaMarkup(log)}
              </details>
            </div>
            <div class="coach-confirm-panel">
              ${participantDraftMarkup}
              ${log.validationMessage ? `<p class="validation-text">${log.validationMessage}</p>` : ""}
              <div class="actions">
                <button class="approve-button" type="button" data-confirm-log="${log.id}" ${confirmed || log.status === "서버 처리 중" || !participantDraftsReady ? "disabled" : ""}>
                  ${["동기화 대기", "동기화 실패"].includes(log.status) ? "다시 동기화" : "수업 완료·횟수 차감"}
                </button>
              </div>
            </div>
          </article>`;
      })
      .join("") || coachEmptyState({
        title: "확인할 수업 기록이 없습니다",
        reason: "수업이 끝나면 코멘트와 다음 커리큘럼을 등록해 횟수를 차감합니다.",
        action: { label: "오늘 수업 보기", view: "todayView", primary: false },
        compact: true,
      });
  const feedbackMarkup =
    visibleFeedback
      .map((request) => {
        const done = request.status === "코치 답변 완료";
        const media = (request.mediaNames || []).map((name) => `<b class="media-chip">${name}</b>`).join("");
        return `
          <article class="work-card log-card">
            <div class="log-main">
              <strong>${request.member} · 운동노트 · ${request.date}</strong>
              <span>${request.type} · ${request.memo}</span>
              <small>질문: ${request.question || "코치 피드백 요청"}</small>
              ${media ? `<div class="media-list">${media}</div>` : ""}
              ${done ? `<p class="coach-comment-view">답변: ${request.coachFeedback}</p>` : ""}
            </div>
            <div class="coach-confirm-panel">
              <label>
                <span>운동노트 코멘트</span>
                <textarea data-feedback-comment="${request.id}" rows="3" ${done ? "disabled" : ""}>${request.coachFeedback || ""}</textarea>
              </label>
              ${request.validationMessage ? `<p class="validation-text">${request.validationMessage}</p>` : ""}
              <div class="actions">
                <b>${request.status}</b>
                <button class="approve-button" type="button" data-confirm-feedback="${request.id}" ${done ? "disabled" : ""}>피드백 보내기</button>
              </div>
            </div>
          </article>`;
      })
      .join("") || coachEmptyState({
        title: "운동노트 피드백 요청이 없습니다",
        reason: "회원이 사진·영상 기록에 피드백을 요청하면 여기에 표시됩니다.",
        compact: true,
      });
  return `${recordTabs}
    <section class="record-section">
      <div class="record-section-title">
        <strong>수업 완료</strong>
        <small>코멘트와 다음 커리큘럼을 등록하면 횟수가 차감됩니다.</small>
      </div>
      ${lessonMarkup}
    </section>
    <section class="record-section">
      <div class="record-section-title">
        <strong>운동노트 피드백</strong>
        <small>회원이 올린 사진/영상 운동노트 코멘트를 같은 화면에서 처리합니다.</small>
      </div>
      ${feedbackMarkup}
    </section>
    ${todayTaskToggleButton(allRecordItems, "records")}`;
}

function renderMemberRecordPanel() {
  const target = $("#memberRecordPanel");
  if (!target) return;
  importMemberLessonLogs();
  importPracticeFeedbackRequests();
  const pendingLogs = ownPendingLessonLogs().slice(0, 6);
  const pendingFeedback = ownPendingFeedbackRequests().slice(0, 4);
  if (!pendingLogs.length && !pendingFeedback.length) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  const logRows = pendingLogs
    .map(
      (log) => `
        <article class="member-record-row ${state.focusedLogId === log.id ? "is-focused" : ""}">
          <strong>${escapeHtml(log.member)}</strong>
          ${coachRecordLessonMetaMarkup(log)}
          <small>${escapeHtml(coachStatusLabel("coachRecord", log.status, log.status))}</small>
          <button class="small-button" type="button" data-focus-record="${log.id}">처리</button>
        </article>`,
    )
    .join("");
  const feedbackRows = pendingFeedback
    .map(
      (request) => `
        <article class="member-record-row">
          <strong>${request.member}</strong>
          <span>${request.date} · 운동노트 피드백</span>
          <small>${request.status}</small>
          <button class="small-button" type="button" data-summary-action="records">처리</button>
        </article>`,
    )
    .join("");
  target.innerHTML = `
    <section class="record-section">
      <div class="record-section-title">
        <strong>회원별 처리 일정</strong>
        <small>회원 관리에서는 대기 항목만 간단히 보고, 처리는 오늘 처리 일정에서 이어서 합니다.</small>
      </div>
      <div class="member-record-list">
        ${logRows || feedbackRows ? `${logRows}${feedbackRows}` : "<p class='empty-text'>처리 대기 중인 회원 기록이 없습니다.</p>"}
      </div>
    </section>`;
}

function renderLogs() {
  const markup = recordProcessingMarkup();
  if ($("#lessonLogs")) $("#lessonLogs").innerHTML = markup;
  if ($("#todayRecordPanel")) {
    $("#todayRecordPanel").hidden = todayTaskTab() !== "records";
    $("#todayRecordPanel").innerHTML = markup;
  }
  renderMemberRecordPanel();
}

function curriculumFilterOptions() {
  return [
    { id: "all", label: "전체" },
    { id: "favorite", label: "즐겨찾기" },
    { id: "기초", label: "기초" },
    { id: "포핸드", label: "포핸드" },
    { id: "백핸드", label: "백핸드" },
    { id: "네트플레이", label: "네트" },
    { id: "전술전환", label: "전술" },
    { id: "풋워크", label: "풋워크" },
    { id: "서브", label: "서브" },
  ];
}

function filteredCurriculumSteps() {
  const query = (state.curriculumQuery || "").trim().toLowerCase();
  const filter = state.curriculumFilter || "all";
  return curriculumSteps.filter((step) => {
    const text = `${step.id} ${step.title} ${step.level || ""} ${step.category || ""} ${step.focus} ${step.guide}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "favorite" && (state.favoriteCurriculums || []).includes(step.id)) ||
      step.level === filter ||
      step.category === filter;
    return matchesQuery && matchesFilter;
  });
}

function openCurriculumDetail(id) {
  state.viewingCurriculumId = id;
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function toggleCurriculumFavorite(id) {
  const favorites = new Set(state.favoriteCurriculums || []);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  state.favoriteCurriculums = [...favorites];
  renderCurriculums();
  saveSnapshot();
}

function renderCurriculumDetailPanel() {
  const step = selectedCurriculum(state.viewingCurriculumId);
  return `
    <section class="schedule-edit-panel curriculum-detail-panel">
      <div class="wide">
        <strong>${step.id} · ${step.title}</strong>
        <span>${step.level || "단계"} · ${step.category || "커리큘럼"}</span>
      </div>
      <article class="modal-info-card">
        <span>오늘 수업 목표</span>
        <strong>${step.focus}</strong>
        <small>${step.guide}</small>
      </article>
      <article class="modal-info-card">
        <span>코치 체크포인트</span>
        <strong>${step.checklist || "코치가 회원 상태에 맞춰 핵심 포인트를 확인합니다."}</strong>
      </article>
      <article class="modal-info-card">
        <span>회원 숙제</span>
        <strong>${step.mission || "개인 연습에서 같은 루틴을 짧게 반복합니다."}</strong>
      </article>
      <div class="actions wide">
        <a class="small-button" href="${curriculumNotionUrl(step)}" target="_blank" rel="noreferrer">상세 자료 보기</a>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function curriculumLibraryMarkup() {
  const steps = filteredCurriculumSteps();
  if (!steps.length) return "<p class='empty-text'>조건에 맞는 커리큘럼이 없습니다.</p>";
  const groups = new Map();
  steps.forEach((step) => {
    const groupId = step.trackId || step.category || "기타";
    if (!groups.has(groupId)) groups.set(groupId, { title: step.trackTitle || step.category || "기타", steps: [] });
    groups.get(groupId).steps.push(step);
  });
  const expandGroups = Boolean((state.curriculumQuery || "").trim()) || state.curriculumFilter !== "all";
  return [...groups.values()]
    .map(
      (group) => `
        <details class="curriculum-track-group" ${expandGroups ? "open" : ""}>
          <summary>
            <strong>${escapeHtml(group.title)}</strong>
            <span>${group.steps.length}개 단계</span>
          </summary>
          <div class="curriculum-library-grid">
            ${group.steps
              .map(
                (step) => `
                  <article class="curriculum-card" data-open-curriculum-detail="${step.id}">
                    <div class="curriculum-card-head">
                      <strong>${escapeHtml(step.title)}</strong>
                      <button class="favorite-button ${(state.favoriteCurriculums || []).includes(step.id) ? "is-active" : ""}" type="button" data-toggle-curriculum-favorite="${step.id}" aria-label="즐겨찾기">★</button>
                    </div>
                    <div class="curriculum-meta">
                      <b>${escapeHtml(step.stageLabel || step.level || "단계")}</b>
                      <b>${escapeHtml(step.category || "기술")}</b>
                      <small>${escapeHtml(step.id)}</small>
                    </div>
                    <span>${escapeHtml(step.focus)}</span>
                    ${step.environmentNote ? `<p class="curriculum-environment-note">${escapeHtml(step.environmentNote)}</p>` : `<p>${escapeHtml(step.checklist || step.guide)}</p>`}
                    <div class="actions">
                      <button class="small-button" type="button" data-open-curriculum-detail="${step.id}">상세 보기</button>
                      <a class="small-button" href="${curriculumNotionUrl(step)}" target="_blank" rel="noreferrer">자료</a>
                    </div>
                  </article>`,
              )
              .join("")}
          </div>
        </details>`,
    )
    .join("");
}

function renderCurriculumLibraryOnly() {
  const groups = document.querySelector(".curriculum-track-groups");
  if (groups) groups.innerHTML = curriculumLibraryMarkup();
}

function renderCurriculums() {
  const target = $("#curriculumSteps");
  if (!target) return;
  target.innerHTML = `
    <section class="curriculum-source-panel">
      <div>
        <strong>회원 다음 커리큘럼</strong>
        <span>오늘 수업 기록에서 회원별 다음 단계를 지정합니다.</span>
      </div>
      <div class="actions">
        <button class="primary-button" type="button" data-summary-action="records">회원 선택·지정</button>
      </div>
    </section>
    <details class="curriculum-browse-disclosure" open>
      <summary>커리큘럼 검색·빠른 보기</summary>
      <div class="curriculum-browse-body">
    <section class="curriculum-toolbar" aria-label="커리큘럼 검색과 필터">
      <input id="curriculumSearchInput" type="search" value="${state.curriculumQuery || ""}" placeholder="기술, 단계, 코드 검색" />
      <div class="curriculum-filter-row">
        ${curriculumFilterOptions()
          .map(
            (filter) => `
              <button class="curriculum-filter ${state.curriculumFilter === filter.id || (!state.curriculumFilter && filter.id === "all") ? "is-active" : ""}" type="button" data-curriculum-filter="${filter.id}">
                ${filter.label}
              </button>`,
          )
          .join("")}
      </div>
    </section>
    <section class="curriculum-library-panel">
      <div class="record-section-title">
        <strong>커리큘럼 빠른 보기</strong>
        <small>다음 수업에 사용할 단계를 빠르게 확인합니다.</small>
      </div>
      <div class="curriculum-track-groups">${curriculumLibraryMarkup()}</div>
    </section>
      <div class="curriculum-reference-actions">
        <a class="small-button" href="${notionCurriculumGuideUrl}" target="_blank" rel="noreferrer">회원용 안내</a>
        <a class="small-button" href="${notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">전체 자료</a>
      </div>
      </div>
    </details>`;
}


function activeViewField(selector) {
  return document.querySelector(`.view.is-active ${selector}`) || document.querySelector(selector);
}

function applyCoachCommentDraft(keywordSource, commentSource) {
  const keywordInput = typeof keywordSource === "string" ? activeViewField(keywordSource) : keywordSource;
  const commentInput = typeof commentSource === "string" ? activeViewField(commentSource) : commentSource;
  const generator = window.TennisNoteCommentDraft;
  if (!keywordInput || !commentInput || !generator?.generate) {
    showToast("코멘트 초안 기능을 불러오지 못했습니다.");
    return;
  }
  const scope = keywordInput.closest("[data-modal-participant-row], [data-log-participant-row], [data-log-card], .lesson-action-panel, .view")
    || commentInput.parentElement;
  const curriculumSearch = scope?.querySelector("[data-curriculum-option-search]");
  const curriculumSelect = curriculumSearch?.closest("label")?.querySelector("select");
  const curriculum = exactCoachCurriculum(curriculumSearch?.value || "")
    || exactCoachCurriculum(curriculumSelect?.value || "")
    || coachCurriculumSearchResults(curriculumSearch?.value || keywordInput.value)[0]
    || null;
  const result = generator.generate(keywordInput.value, { curriculum });
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

function updateFeedbackDraft(id) {
  const request = state.feedbackRequests.find((item) => item.id === id);
  if (!request || request.status === "코치 답변 완료") return request;
  const input = activeViewField(`[data-feedback-comment="${id}"]`);
  request.coachFeedback = input?.value.trim() || "";
  request.validationMessage = "";
  return request;
}

function confirmFeedback(id) {
  const request = updateFeedbackDraft(id);
  if (!request || request.status === "코치 답변 완료") return;
  if (!request.coachFeedback) {
    request.validationMessage = "운동노트 코멘트를 입력해야 회원에게 보낼 수 있습니다.";
    renderAll();
    return;
  }
  request.status = "코치 답변 완료";
  request.answeredAt = new Date().toISOString();
  exportPracticeFeedback(request);
  renderAll();
}

function normalizeCoachComment(text) {
  return (text || "")
    .replace(/\s+/g, "")
    .replace(/[.,!?~ㆍ·]/g, "")
    .toLowerCase();
}

function coachLogCommentEntries(log) {
  if (Array.isArray(log?.participantResults) && log.participantResults.length) {
    return log.participantResults.map((result) => ({
      memberNames: [result.name].filter(Boolean),
      comment: result.coachComment || "",
    }));
  }
  return [{ memberNames: recordMemberNames(log?.member), comment: log?.coachComment || "" }];
}

function coachCommentValidationMessage(log) {
  const comment = log.coachComment || "";
  const normalized = normalizeCoachComment(comment);
  const weakPhrases = ["수고했습니다", "잘했습니다", "좋아요", "확인완료", "다음에이어", "다음시간에이어", "고생했습니다", "괜찮습니다"];
  if (normalized.length < 5) return "코치 코멘트는 직접 5자 이상 작성해야 합니다.";
  if (weakPhrases.some((phrase) => {
    const normalizedPhrase = normalizeCoachComment(phrase);
    return normalized.includes(normalizedPhrase) && normalized.length <= normalizedPhrase.length + 4;
  })) {
    return "반복되는 짧은 칭찬/확인 문구만으로는 횟수 차감이 불가합니다.";
  }
  const currentMemberNames = recordMemberNames(log.member);
  const sameMemberDuplicateCount = state.lessonLogs.filter((item) => (
    item.id !== log.id
    && coachLogCommentEntries(item).some((entry) => (
      currentMemberNames.some((name) => entry.memberNames.includes(name))
      && normalizeCoachComment(entry.comment) === normalized
    ))
  )).length;
  if (sameMemberDuplicateCount >= 2) return "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.";
  return "";
}

async function approveMakeup(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  if (request.reviewing) return;
  if (request.serverRequestV2 && window.TennisNoteDataClient?.rpc) {
    if (!request.canReview) {
      showToast("이 요청은 관리자 승인 후 시간표에 반영됩니다.");
      return;
    }
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_schedule_v2_review_request", {
        target_request_id: request.serverRequestId,
        target_decision: "approved",
        target_reason: null,
      });
      coachScheduleV2WorkspaceCache = null;
      await syncCoachScheduleV2({ force: true });
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("수업 변경 승인 완료");
    } catch (error) {
      showToast(lessonChangeReviewErrorMessage(error, "승인"));
    } finally {
      request.reviewing = false;
    }
    return;
  }
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
        target_request_id: request.serverRequestId,
        target_decision: "approved",
        target_note: null,
      });
      await syncCoachLessonsFromServer();
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("수업 변경 승인 완료");
    } catch (error) {
      showToast(`승인 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    } finally {
      request.reviewing = false;
    }
    return;
  }
  request.status = "승인 완료";
  state.todayLessons.push({
    id: `approved-${id}`,
    day: request.requested.match(/[월화수목금토일]/)?.[0] || "금",
    time: request.requested.split(" ")[1] || "미정",
    coach: requestCoach(request),
    member: request.member,
    type: "보강",
    ticket: "기존 회원권",
    status: "승인됨",
    remaining: 8,
    task: "보강 수업 후 코멘트/다음 커리큘럼",
  });
  exportMakeupRequest(request);
  if (state.editingMakeupId === id) closeLessonEditor();
  renderAll();
}

async function rejectMakeup(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  if (request.reviewing) return;
  if (request.serverRequestId && !request.serverRequestV2
    && !window.confirm(`${request.member}님의 요청을 거절할까요? 원래 수업은 그대로 유지되고 회원권은 차감되지 않습니다.`)) return;
  if (request.serverRequestV2 && window.TennisNoteDataClient?.rpc) {
    if (!request.canReview) {
      showToast("이 요청은 관리자만 거절할 수 있습니다.");
      return;
    }
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_schedule_v2_review_request", {
        target_request_id: request.serverRequestId,
        target_decision: "rejected",
        target_reason: "승인 불가",
      });
      coachScheduleV2WorkspaceCache = null;
      await syncCoachScheduleV2({ force: true });
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("변경 요청 거절 완료");
    } catch (error) {
      showToast(lessonChangeReviewErrorMessage(error, "거절"));
    } finally {
      request.reviewing = false;
    }
    return;
  }
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
    request.reviewing = true;
    renderAll();
    try {
      const result = await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
        target_request_id: request.serverRequestId,
        target_decision: "rejected",
        target_note: "코치 승인 불가",
      });
      await syncCoachLessonsFromServer();
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      const deductedSessions = Number(result?.deductedSessions || 0);
      showToast(`변경 요청 거절 완료${deductedSessions ? ` · ${deductedSessions}회 차감` : ""}`);
    } catch (error) {
      showToast(`거절 처리 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    } finally {
      request.reviewing = false;
    }
    return;
  }
  request.status = "거절";
  exportMakeupRequest(request);
  if (state.editingMakeupId === id) closeLessonEditor();
  renderAll();
}

function lessonChangeReviewErrorMessage(error, action = "처리") {
  const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
  const messages = {
    request_not_pending: "다른 사용자가 먼저 처리했습니다. 새로고침해 주세요.",
    effective_coach_or_admin_required: "현재 담당 코치 또는 관리자만 처리할 수 있습니다.",
    target_time_occupied: "요청한 시간에 다른 수업이 생겼습니다. 회원에게 새 시간을 요청해 주세요.",
    target_effective_coach_unavailable: "현재 담당 코치의 근무시간과 맞지 않습니다.",
  };
  const key = Object.keys(messages).find((candidate) => code.includes(candidate));
  return messages[key] || `${action} 실패: ${code}`;
}

function updateLogDraft(id) {
  const log = state.lessonLogs.find((item) => item.id === id);
  if (!log || log.status === "확인 완료") return log;
  const logCard = document.querySelector(`#todayRecordPanel [data-log-card="${id}"]`);
  const participantRows = [...(logCard?.querySelectorAll(`[data-log-participant-row="${id}"]`) || [])];
  if (participantRows.length) {
    const existingByPair = new Map(completionDraftResultsForLog(log).map((result) => [
      `${result.userId || ""}:${result.ticketId || ""}`,
      result,
    ]));
    log.participantResults = participantRows.map((row) => {
      const userId = row.dataset.userId || "";
      const ticketId = row.dataset.ticketId || "";
      const existing = existingByPair.get(`${userId}:${ticketId}`) || {};
      const coachComment = row.querySelector("[data-log-participant-comment]")?.value.trim() || "";
      const nextCurriculumId = row.querySelector("[data-log-participant-curriculum]")?.value || "";
      return {
        ...existing,
        userId,
        ticketId,
        name: row.dataset.participantName || existing.name || "회원",
        coachComment,
        nextCurriculumId,
        localCoachCommentDirty: coachComment !== (existing.serverCoachComment || ""),
        localNextCurriculumDirty: nextCurriculumId !== (existing.serverNextCurriculumId || ""),
      };
    });
    const primaryResult = log.participantResults[0] || {};
    log.coachComment = primaryResult.coachComment || "";
    log.nextCurriculumId = primaryResult.nextCurriculumId || "";
    log.validationMessage = "";
    updateLogCompletionUi(log);
    return log;
  }
  const commentInput = activeViewField(`[data-coach-comment="${id}"]`);
  const curriculumSelect = activeViewField(`[data-next-curriculum="${id}"]`);
  log.coachComment = commentInput?.value.trim() || "";
  log.nextCurriculumId = curriculumSelect?.value || log.nextCurriculumId || log.curriculumId;
  log.localCoachCommentDirty = log.coachComment !== (log.serverCoachComment || "");
  log.localNextCurriculumDirty = log.nextCurriculumId !== (log.serverNextCurriculumId || "");
  log.validationMessage = "";
  updateLogCompletionUi(log);
  return log;
}

function updateLogCompletionUi(log) {
  if (!log) return;
  const logCard = document.querySelector(`#todayRecordPanel [data-log-card="${log.id}"]`);
  const participantRows = [...(logCard?.querySelectorAll(`[data-log-participant-row="${log.id}"]`) || [])];
  const submit = activeViewField(`[data-confirm-log="${log.id}"]`);
  if (participantRows.length) {
    const ready = participantRows.every((row) => {
      const length = String(row.querySelector("[data-log-participant-comment]")?.value || "").trim().length;
      const curriculumId = row.querySelector("[data-log-participant-curriculum]")?.value || "";
      const count = row.querySelector("[data-log-participant-comment-count]");
      if (count) {
        count.textContent = `${length}/5자`;
        count.classList.toggle("is-ready", length >= 5);
      }
      return length >= 5 && Boolean(curriculumId);
    });
    if (submit) submit.disabled = log.status === "서버 처리 중" || log.status === "확인 완료" || !ready;
    return;
  }
  const count = activeViewField(`[data-log-comment-count="${log.id}"]`);
  const length = String(log.coachComment || "").trim().length;
  if (count) {
    count.textContent = `${length}/5자`;
    count.classList.toggle("is-ready", length >= 5);
  }
  if (submit) submit.disabled = log.status === "서버 처리 중" || log.status === "확인 완료" || length < 5 || !log.nextCurriculumId;
}

async function confirmLog(id, options = {}) {
  const log = options.skipDraft
    ? state.lessonLogs.find((item) => item.id === id)
    : updateLogDraft(id);
  if (!log) return false;
  if (log.status === "확인 완료") return true;
  const linkedScheduleV2Lesson = state.liveLessons.find((item) => (
    item.serverLessonId === log.serverLessonId
    && Array.isArray(item.v2Participants)
    && item.v2Participants.length
  ));
  const linkedLesson = linkedScheduleV2Lesson || lessonForRecord(log);
  if (linkedLesson && !lessonOutcomeWindowOpen(linkedLesson)) {
    log.validationMessage = lessonOutcomeGuardMessage();
    renderAll();
    return false;
  }
  const participantResults = Array.isArray(log.participantResults) && log.participantResults.length
    ? log.participantResults
    : linkedScheduleV2Lesson
      ? linkedScheduleV2Lesson.v2Participants.map((participant) => ({
          userId: participant.userId,
          ticketId: participant.ticketId,
          name: participant.name || log.member,
          ticketName: participant.ticketName || "회원권",
          totalSessions: Number(participant.totalSessions) || 0,
          usedSessions: Number(participant.usedSessions) || 0,
          remainingSessions: Number(participant.remainingSessions) || 0,
          coachComment: log.coachComment,
          nextCurriculumId: log.nextCurriculumId,
        }))
      : [{
          userId: "",
          ticketId: "",
          name: log.member,
          coachComment: log.coachComment,
          nextCurriculumId: log.nextCurriculumId,
        }];
  if ((!Array.isArray(log.participantResults) || !log.participantResults.length) && linkedScheduleV2Lesson) {
    log.participantResults = participantResults;
  }
  const participantResultsHaveAnyPair = participantResults.some((result) => result.userId || result.ticketId);
  const participantResultsHaveExactPairs = participantResults.length > 0
    && participantResults.every((result) => result.userId && result.ticketId);
  const requiresExactParticipantPairs = Boolean(linkedScheduleV2Lesson || participantResultsHaveAnyPair);
  const missingParticipant = participantResults.find((result) => (
    !result.coachComment
    || !result.nextCurriculumId
    || (requiresExactParticipantPairs && (!result.userId || !result.ticketId))
  ));
  if (missingParticipant) {
    log.validationMessage = "코치 코멘트, 다음 커리큘럼과 정확한 회원권 연결을 확인해 주세요.";
    renderAll();
    return false;
  }
  const invalidParticipant = participantResults
    .map((result) => ({
      name: result.name,
      message: coachCommentValidationMessage({
        id: `${log.id}:${result.userId}:${result.ticketId}`,
        member: result.name,
        coachComment: result.coachComment,
      }),
    }))
    .find((result) => result.message);
  if (invalidParticipant) {
    log.validationMessage = `${invalidParticipant.name}: ${invalidParticipant.message}`;
    renderAll();
    return false;
  }
  const nextStep = selectedCurriculum(participantResults[0].nextCurriculumId);
  let serverResult = null;
  if (log.serverLessonId) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) {
      log.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
      renderAll();
      return false;
    }
    if (client.isOnline?.() === false) {
      log.status = "동기화 대기";
      log.validationMessage = "인터넷 연결 후 자동 처리됩니다. 서버 확인 전에는 횟수가 차감되지 않습니다.";
      saveSnapshot();
      renderAll();
      return false;
    }
    log.status = "서버 처리 중";
    renderAll();
    try {
      const scheduleV2Lesson = linkedScheduleV2Lesson || state.liveLessons.find((item) => (
        item.serverLessonId === log.serverLessonId
        && Array.isArray(item.v2Participants)
        && item.v2Participants.length
      ));
      const scheduleV2Participants = scheduleV2Lesson?.v2Participants?.length
        ? scheduleV2Lesson.v2Participants
        : participantResultsHaveExactPairs
          ? participantResults
          : null;
      if (scheduleV2Participants) {
        log.v2OperationKey ||= `schedule-v2-coach:${log.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
        const participantCount = scheduleV2Participants.length;
        const draftByTicketAndUser = new Map(participantResults.map((result) => [
          `${result.userId}:${result.ticketId}`,
          result,
        ]));
        const serverParticipantResults = await Promise.all(scheduleV2Participants.map(async (participant) => {
          const draft = draftByTicketAndUser.get(`${participant.userId}:${participant.ticketId}`);
          if (!draft) throw new Error("schedule_v2_participant_input_missing");
          const participantNextStep = selectedCurriculum(draft.nextCurriculumId);
          const participantCurriculumRefId = await liveCurriculumRefId(participantNextStep);
          return {
            userId: participant.userId,
            ticketId: participant.ticketId,
            outcome: "completed",
            deduct: true,
            technique: "",
            strength: "",
            improvement: "",
            nextGoal: participantNextStep?.title || "",
            coachComment: draft.coachComment,
            keywords: [],
            nextCurriculumRefId: participantCurriculumRefId || null,
            memberJournalId: participantCount === 1 ? (log.serverJournalId || null) : null,
          };
        }));
        serverResult = await client.rpc("tn_schedule_v2_process_lesson", {
          target_lesson_id: log.serverLessonId,
          target_participant_results: serverParticipantResults,
          target_finalize: true,
          target_operation_key: log.v2OperationKey,
        });
      } else {
        const curriculumRefId = await liveCurriculumRefId(nextStep);
        serverResult = await client.rpc("tn_complete_lesson_and_deduct", {
          target_lesson_id: log.serverLessonId,
          target_coach_comment: log.coachComment,
          target_next_curriculum_ref_id: curriculumRefId,
          target_member_journal_id: log.serverJournalId || null,
        });
      }
    } catch (error) {
      if (client.isOfflineError?.(error)) {
        log.status = "동기화 대기";
        log.validationMessage = "인터넷 연결 후 자동 처리됩니다. 서버 확인 전에는 횟수가 차감되지 않습니다.";
        saveSnapshot();
        renderAll();
        return false;
      }
      let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
      if (typeof code === "string" && code.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(code);
          code = parsed.message || parsed.code || code;
        } catch {
          // Keep the original server message when it is not valid JSON.
        }
      }
      const serverMessages = {
        schedule_v2_outcome_lesson_not_ended: lessonOutcomeGuardMessage(),
        lesson_complete_lesson_not_ended: lessonOutcomeGuardMessage(),
        lesson_complete_comment_too_short: "코치 코멘트는 직접 5자 이상 작성해야 합니다.",
        lesson_complete_comment_too_generic: "짧은 칭찬이나 확인 문구만으로는 횟수 차감이 불가합니다.",
        lesson_complete_comment_recent_duplicate: "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.",
        lesson_complete_comment_member_duplicate_limit: "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.",
      };
      log.status = options.fromOfflineQueue ? "동기화 실패" : "확인 대기";
      log.validationMessage = serverMessages[code]
        || (options.fromOfflineQueue
          ? "자동 동기화에 실패했습니다. 연결 상태를 확인한 뒤 다시 동기화해 주세요."
          : "서버 횟수 차감에 실패했습니다. 같은 기록에서 다시 시도해 주세요.");
      saveSnapshot();
      renderAll();
      return false;
    }
  }
  log.status = "확인 완료";
  log.completedAt = new Date().toISOString();
  log.memberVisibleSummary = participantResults.length > 1
    ? `${participantResults.length}명 다음 커리큘럼 등록 완료`
    : `다음 수업 등록 완료: ${nextStep.id} · ${nextStep.title}`;
  log.curriculumRegistered = true;
  log.serverDeducted = Boolean(serverResult?.ok);
  log.serverDeductionIdempotent = Boolean(serverResult?.idempotent);
  const lesson = state.liveLessons.find((item) => (
    log.serverLessonId
      ? item.serverLessonId === log.serverLessonId
      : item.member === log.member
  )) || state.todayLessons.find((item) => (
    log.serverLessonId
      ? item.serverLessonId === log.serverLessonId
      : item.member === log.member
  ));
  const v2ParticipantResults = Array.isArray(serverResult?.participants) ? serverResult.participants : [];
  const v2DeductedSessions = v2ParticipantResults.reduce((total, participant) => total + (Number(participant.deductedSessions) || 0), 0);
  const deductedSessions = v2ParticipantResults.length
    ? v2DeductedSessions
    : Number(serverResult?.deductedSessions || 0) || Math.max(
      1,
      Math.ceil(Number(lesson?.durationMinutes || 20) / Number(lesson?.ticketLessonMinutes || lesson?.durationMinutes || 20)),
    );
  log.deductedSessions = deductedSessions;
  exportConfirmedLog(log);
  if (lesson && v2ParticipantResults.length) {
    const resultsByUserId = new Map(v2ParticipantResults.map((participant) => [participant.userId, participant]));
    lesson.v2Participants = (lesson.v2Participants || []).map((participant) => ({
      ...participant,
      ...(resultsByUserId.get(participant.userId) || {}),
    }));
    const primaryResult = v2ParticipantResults.find((participant) => participant.ticketId === lesson.ticketId) || v2ParticipantResults[0];
    if (Number.isFinite(Number(primaryResult?.remainingSessions))) {
      lesson.remaining = Number(primaryResult.remainingSessions);
      lesson.usedSessions = Math.max(0, Number(lesson.totalSessions || 0) - lesson.remaining);
    }
    lesson.deductedSessions = Math.max(0, ...v2ParticipantResults.map((participant) => Number(participant.deductedSessions) || 0));
  } else if (lesson && Number.isFinite(Number(serverResult?.remainingSessions))) {
    lesson.remaining = Number(serverResult.remainingSessions);
    lesson.usedSessions = Number(serverResult.usedSessions) || lesson.usedSessions || 0;
  } else if (lesson && lesson.remaining > 0) {
    lesson.remaining = Math.max(0, lesson.remaining - deductedSessions);
  }
  if (lesson) {
    lesson.status = "완료";
    lesson.serverStatus = "completed";
    lesson.task = "기록/차감 완료";
  }
  saveSnapshot();
  renderAll();
  return true;
}

function coachPendingSyncLogs() {
  return state.lessonLogs.filter((log) => ["동기화 대기", "동기화 실패"].includes(log.status) && log.serverLessonId);
}

function renderCoachConnectivityStatus() {
  const status = $("#coachConnectivityStatus");
  const message = $("#coachConnectivityMessage");
  const retry = $("#coachSyncRetryButton");
  if (!status || !message || !retry) return;
  window.clearTimeout(coachSyncStatusTimer);
  const online = window.TennisNoteDataClient?.isOnline?.() !== false;
  const pendingCount = coachPendingSyncLogs().length;
  retry.hidden = true;
  retry.disabled = coachSyncUiState === "syncing";
  if (!online) {
    status.hidden = false;
    status.dataset.tone = "offline";
    message.textContent = pendingCount
      ? `오프라인 · 기록 ${pendingCount}건을 연결 후 처리합니다.`
      : "오프라인 · 최근 자료 조회와 수업기록 임시 저장만 가능합니다.";
    return;
  }
  if (coachSyncUiState === "syncing") {
    status.hidden = false;
    status.dataset.tone = "online";
    message.textContent = `수업기록 ${pendingCount}건을 동기화하는 중입니다.`;
    return;
  }
  if (pendingCount) {
    status.hidden = false;
    status.dataset.tone = coachSyncUiState === "failed" ? "error" : "online";
    message.textContent = coachSyncUiState === "failed"
      ? `동기화 실패 ${pendingCount}건 · 서버 확인 전에는 차감되지 않았습니다.`
      : `동기화 대기 ${pendingCount}건 · 서버 확인 전에는 차감되지 않습니다.`;
    retry.hidden = false;
    return;
  }
  if (coachSyncUiState === "restored") {
    status.hidden = false;
    status.dataset.tone = "online";
    message.textContent = "동기화 완료 · 기록과 횟수 차감을 확인했습니다.";
    coachSyncStatusTimer = window.setTimeout(() => {
      coachSyncUiState = "idle";
      renderCoachConnectivityStatus();
    }, 2500);
    return;
  }
  status.hidden = true;
  status.dataset.tone = "";
  message.textContent = "";
}

function flushCoachOfflineLessonDrafts() {
  if (coachOfflineFlushPromise || window.TennisNoteDataClient?.isOnline?.() === false) {
    return coachOfflineFlushPromise || Promise.resolve(false);
  }
  const pending = coachPendingSyncLogs();
  if (!pending.length) {
    renderCoachConnectivityStatus();
    return Promise.resolve(true);
  }
  coachSyncUiState = "syncing";
  renderCoachConnectivityStatus();
  coachOfflineFlushPromise = (async () => {
    for (const log of pending) {
      await confirmLog(log.id, { skipDraft: true, fromOfflineQueue: true });
    }
    saveSnapshot();
    const complete = coachPendingSyncLogs().length === 0;
    coachSyncUiState = complete ? "restored" : "failed";
    return complete;
  })().finally(() => {
    coachOfflineFlushPromise = null;
    renderAll();
  });
  return coachOfflineFlushPromise;
}

function installCoachConnectivitySync() {
  window.addEventListener("online", () => {
    showToast("인터넷 연결 복구 · 저장 대기 기록을 확인합니다.");
    renderCoachConnectivityStatus();
    void flushCoachOfflineLessonDrafts();
    void refreshCoachLiveSchedule().catch(() => false);
  });
  window.addEventListener("offline", () => {
    coachSyncUiState = "idle";
    renderCoachConnectivityStatus();
    showToast("오프라인 · 최근 자료는 조회할 수 있고 수업기록은 임시 저장됩니다.");
  });
}

function handleSummaryAction(action) {
  if (action === "lessons") {
    openTodayTaskTab("lessons");
    return;
  }
  if (action === "makeup") {
    openTodayTaskTab("makeup");
    return;
  }
  if (action === "records") {
    openTodayTaskTab("records");
  }
}

function bindEvents() {
  $('#coachLogoutButton').addEventListener('click', logoutCoach);
  $$(".tab").forEach((button) => button.addEventListener("click", () => navigateCoachView(button.dataset.view)));
  $("#coachProfileButton")?.addEventListener("click", () => navigateCoachView("coachProfileView"));
  $("#coachSettlementSummaryButton")?.addEventListener("click", () => {
    openCoachSettlement();
    if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();
  });
  $("#refreshButton").addEventListener("click", renderAll);
  $("#userModeButton")?.addEventListener("click", openUserMode);
  $("#userModeLoginButton")?.addEventListener("click", openUserMode);
  $("#noticeClose")?.addEventListener("click", () => closeNotice(false));
  $("#noticeHideToday")?.addEventListener("click", () => closeNotice(true));
  $("#noticeAction")?.addEventListener("click", () => closeNotice(false));
  $("#saveCoachProfile")?.addEventListener("click", saveCoachProfile);
  $("#refreshCoachSettlement")?.addEventListener("click", () => void syncCoachSettlementFromServer());
  $("#coachPushNotificationButton")?.addEventListener("click", () => void toggleNativeCoachPush());
  $("#enableCoachPushFromPrimer")?.addEventListener("click", () => void enableNativeCoachPush());
  $("#coachPushPrimerModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-defer-coach-push-primer]")) deferNativeCoachPushPrimer();
  });
  $("#coachSyncRetryButton")?.addEventListener("click", () => {
    if (window.TennisNoteDataClient?.isOnline?.() === false) {
      renderCoachConnectivityStatus();
      return;
    }
    void flushCoachOfflineLessonDrafts();
  });
  document.addEventListener("change", (event) => {
    const settlementMonth = event.target.closest("#coachSettlementMonth");
    if (settlementMonth) {
      state.settlementMonth = /^\d{4}-\d{2}$/.test(settlementMonth.value) ? settlementMonth.value : localDateKey().slice(0, 7);
      state.coachSettlement = null;
      void syncCoachSettlementFromServer();
      return;
    }

    const scheduleMonth = event.target.closest("[data-coach-month]");
    if (scheduleMonth) {
      selectCoachMonth(scheduleMonth.value);
      return;
    }

    const photoInput = event.target.closest("#coachPhotoInput");
    if (photoInput && photoInput.files?.[0]) {
      updateCoachPhoto(photoInput.files[0]);
      photoInput.value = "";
      return;
    }

    const curriculumSelect = event.target.closest("[data-next-curriculum]");
    if (curriculumSelect) updateLogDraft(curriculumSelect.dataset.nextCurriculum);

    const participantCurriculumSelect = event.target.closest("[data-log-participant-curriculum]");
    if (participantCurriculumSelect) updateLogDraft(participantCurriculumSelect.dataset.logParticipantCurriculum);

    const modalCurriculum = event.target.closest("[data-modal-next-curriculum]");
    if (modalCurriculum) updateLessonCompletionUi(modalCurriculum.dataset.modalNextCurriculum);

    if (event.target.closest("#recordLessonSelect")) {
      state.writingLessonId = event.target.value;
    }

    const ntrpSelect = event.target.closest("[data-member-ntrp]");
    if (ntrpSelect) updateMemberNtrp(ntrpSelect.dataset.memberNtrp, ntrpSelect.value, ntrpSelect.dataset.memberGroupName || "");
  });

  document.addEventListener("input", (event) => {
    const modalComment = event.target.closest("[data-modal-coach-comment]");
    if (modalComment) updateLessonCompletionUi(modalComment.dataset.modalCoachComment);

    const commentInput = event.target.closest("[data-coach-comment]");
    if (commentInput) updateLogDraft(commentInput.dataset.coachComment);

    const participantCommentInput = event.target.closest("[data-log-participant-comment]");
    if (participantCommentInput) updateLogDraft(participantCommentInput.dataset.logParticipantComment);

    const feedbackInput = event.target.closest("[data-feedback-comment]");
    if (feedbackInput) updateFeedbackDraft(feedbackInput.dataset.feedbackComment);

    const curriculumOptionSearch = event.target.closest("[data-curriculum-option-search]");
    if (curriculumOptionSearch) filterCurriculumOptions(curriculumOptionSearch);

    const curriculumSearch = event.target.closest("#curriculumSearchInput");
    if (curriculumSearch) {
      state.curriculumQuery = curriculumSearch.value;
      renderCurriculumLibraryOnly();
      saveSnapshot();
    }

    const memberSearch = event.target.closest("#memberSearchInput");
    if (memberSearch) {
      state.memberQuery = memberSearch.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const draftKeywords = event.target.closest("[data-log-comment-keywords], [data-log-participant-keywords]");
    if (draftKeywords && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      draftKeywords.closest(".tn-comment-draft-tools")?.querySelector("button")?.click();
      return;
    }
    const curriculumSearch = event.target.closest("[data-curriculum-option-search]");
    if (!curriculumSearch) return;
    const suggestions = curriculumSearch.closest("label")?.querySelector("[data-curriculum-option-suggestions]");
    if (event.key === "Escape") {
      if (suggestions) suggestions.hidden = true;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    suggestions?.querySelector("[data-curriculum-option-code]")?.click();
  });

  document.addEventListener("click", (event) => {
    const closeSettlementButton = event.target.closest("[data-close-coach-settlement]");
    if (closeSettlementButton) {
      closeCoachSettlementModal();
      return;
    }

    const openSettlementButton = event.target.closest("[data-open-coach-settlement]");
    if (openSettlementButton) {
      openCoachSettlement();
      if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();
      return;
    }

    const curriculumSuggestion = event.target.closest("[data-curriculum-option-code]");
    if (curriculumSuggestion) {
      selectCoachCurriculumSuggestion(curriculumSuggestion);
      return;
    }

    const participantTab = event.target.closest("[data-lesson-participant-tab]");
    if (participantTab) {
      const key = participantTab.dataset.lessonParticipantTab;
      const panel = participantTab.closest(".lesson-action-panel");
      panel?.querySelectorAll("[data-lesson-participant-tab]").forEach((button) => {
        const active = button === participantTab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      panel?.querySelectorAll("[data-lesson-participant-panel]").forEach((participantPanel) => {
        participantPanel.hidden = participantPanel.dataset.lessonParticipantPanel !== key;
      });
      const activePanel = [...(panel?.querySelectorAll("[data-lesson-participant-panel]") || [])]
        .find((participantPanel) => participantPanel.dataset.lessonParticipantPanel === key);
      activePanel?.querySelector("textarea, button")?.focus({ preventScroll: true });
      return;
    }

    const editFinalFeedbackButton = event.target.closest("[data-edit-final-feedback]");
    if (editFinalFeedbackButton) {
      openFinalFeedbackRevision(state.editingLessonId, editFinalFeedbackButton.dataset.editFinalFeedback);
      return;
    }
    const saveFinalFeedbackButton = event.target.closest("[data-save-final-feedback]");
    if (saveFinalFeedbackButton) {
      void saveFinalFeedbackRevision(saveFinalFeedbackButton.dataset.saveFinalFeedback);
      return;
    }
    const cancelFinalFeedbackButton = event.target.closest("[data-cancel-final-feedback]");
    if (cancelFinalFeedbackButton) {
      cancelFinalFeedbackRevision(cancelFinalFeedbackButton.dataset.cancelFinalFeedback);
      return;
    }

    const historyToggle = event.target.closest("[data-toggle-lesson-history]");
    if (historyToggle) {
      const key = historyToggle.dataset.toggleLessonHistory;
      const participantPanel = historyToggle.closest("[data-lesson-participant-panel]");
      const history = [...(participantPanel?.querySelectorAll("[data-lesson-history-panel]") || [])]
        .find((candidate) => candidate.dataset.lessonHistoryPanel === key);
      if (history) {
        history.hidden = !history.hidden;
        historyToggle.textContent = history.hidden ? "지난 기록 보기" : "지난 기록 닫기";
      }
      return;
    }
    const modalCommentDraftButton = event.target.closest("[data-generate-modal-comment]");
    if (modalCommentDraftButton) {
      const participantRow = modalCommentDraftButton.closest("[data-modal-participant-row]");
      applyCoachCommentDraft(
        participantRow?.querySelector("[data-modal-comment-keywords]"),
        participantRow?.querySelector("[data-modal-coach-comment]"),
      );
      return;
    }

    const logCommentDraftButton = event.target.closest("[data-generate-log-comment]");
    if (logCommentDraftButton) {
      const id = logCommentDraftButton.dataset.generateLogComment;
      applyCoachCommentDraft(`[data-log-comment-keywords="${id}"]`, `[data-coach-comment="${id}"]`);
      return;
    }

    const logParticipantDraftButton = event.target.closest("[data-generate-log-participant-comment]");
    if (logParticipantDraftButton) {
      const participantRow = logParticipantDraftButton.closest("[data-log-participant-row]");
      applyCoachCommentDraft(
        participantRow?.querySelector("[data-log-participant-keywords]"),
        participantRow?.querySelector("[data-log-participant-comment]"),
      );
      return;
    }

    const summaryActionButton = event.target.closest("[data-summary-action]");
    if (summaryActionButton) {
      handleSummaryAction(summaryActionButton.dataset.summaryAction);
      return;
    }

    const todayTaskTabButton = event.target.closest("[data-today-task-tab]");
    if (todayTaskTabButton) {
      openTodayTaskTab(todayTaskTabButton.dataset.todayTaskTab, false);
      return;
    }

    const toggleTaskButton = event.target.closest("[data-toggle-task-list]");
    if (toggleTaskButton) {
      toggleTodayTaskList(toggleTaskButton.dataset.toggleTaskList);
      return;
    }

    const focusRecordButton = event.target.closest("[data-focus-record]");
    if (focusRecordButton) {
      focusRecordProcessing(focusRecordButton.dataset.focusRecord);
      return;
    }

    const curriculumFilterButton = event.target.closest("[data-curriculum-filter]");
    if (curriculumFilterButton) {
      state.curriculumFilter = curriculumFilterButton.dataset.curriculumFilter;
      renderCurriculums();
      saveSnapshot();
      return;
    }

    const favoriteCurriculumButton = event.target.closest("[data-toggle-curriculum-favorite]");
    if (favoriteCurriculumButton) {
      toggleCurriculumFavorite(favoriteCurriculumButton.dataset.toggleCurriculumFavorite);
      return;
    }

    const curriculumDetailButton = event.target.closest("[data-open-curriculum-detail]");
    if (curriculumDetailButton && !event.target.closest("a")) {
      openCurriculumDetail(curriculumDetailButton.dataset.openCurriculumDetail);
      return;
    }

    const makeupDetailButton = event.target.closest("[data-open-makeup-detail]");
    if (makeupDetailButton) {
      openMakeupDetail(makeupDetailButton.dataset.openMakeupDetail);
      return;
    }

    const linkedLogButton = event.target.closest("[data-open-linked-log]");
    if (linkedLogButton) {
      openLinkedLog(linkedLogButton.dataset.openLinkedLog);
      return;
    }

    const weekButton = event.target.closest("[data-change-week]");
    if (weekButton) {
      changeScheduleWeek(weekButton.dataset.changeWeek);
      return;
    }

    const monthButton = event.target.closest("[data-change-coach-month]");
    if (monthButton) {
      changeCoachMonth(Number(monthButton.dataset.changeCoachMonth));
      return;
    }

    const scheduleDayButton = event.target.closest("[data-coach-schedule-day]");
    if (scheduleDayButton) {
      coachSchedulePreferenceTouched = true;
      state.selectedFullScheduleDay = scheduleDayButton.dataset.coachScheduleDay;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const showAllScheduleButton = event.target.closest("[data-coach-schedule-show-all]");
    if (showAllScheduleButton) {
      coachSchedulePreferenceTouched = true;
      state.scheduleFilter = "all";
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const jumpScheduleDayButton = event.target.closest("[data-coach-schedule-jump-day]");
    if (jumpScheduleDayButton) {
      coachSchedulePreferenceTouched = true;
      state.selectedFullScheduleDay = jumpScheduleDayButton.dataset.coachScheduleJumpDay;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const scheduleFilterButton = event.target.closest("[data-schedule-filter]");
    if (scheduleFilterButton) {
      coachSchedulePreferenceTouched = true;
      state.scheduleFilter = scheduleFilterButton.dataset.scheduleFilter;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const scheduleTimeRangeButton = event.target.closest("[data-schedule-time-range]");
    if (scheduleTimeRangeButton) {
      state.scheduleTimeRange = scheduleTimeRangeButton.dataset.scheduleTimeRange;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const coachModeButton = event.target.closest("[data-select-coach-mode]");
    if (coachModeButton) {
      selectCoachMode(coachModeButton.dataset.selectCoachMode);
      return;
    }

    const memberFilterButton = event.target.closest("[data-member-filter]");
    if (memberFilterButton) {
      state.memberFilter = memberFilterButton.dataset.memberFilter;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
      return;
    }

    const recordStatusButton = event.target.closest("[data-record-status-filter]");
    if (recordStatusButton) {
      state.recordStatusFilter = recordStatusButton.dataset.recordStatusFilter === "completed" ? "completed" : "pending";
      renderLogs();
      saveSnapshot();
      return;
    }

    const memberDetailRow = event.target.closest("[data-member-detail-id]");
    const memberDetailInteractive = event.target.closest("select, button, a, input, textarea");
    if (memberDetailRow && (!memberDetailInteractive || memberDetailInteractive === memberDetailRow)) {
      openMemberDetail(memberDetailRow.dataset.memberDetailId, memberDetailRow.dataset.memberGroupName || "");
      return;
    }

    const revealMemberContactButton = event.target.closest("[data-reveal-member-contact]");
    if (revealMemberContactButton) {
      state.revealedMemberContactKey = revealMemberContactButton.dataset.revealMemberContact;
      openMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
      saveSnapshot();
      return;
    }

    const refreshMemberChartButton = event.target.closest("[data-refresh-member-chart]");
    if (refreshMemberChartButton) {
      const member = findMemberDetail(state.viewingMemberDetailId, state.viewingMemberGroupName);
      const userId = refreshMemberChartButton.dataset.refreshMemberChart || coachMemberChartUserId(member || {});
      void syncCoachMemberChart(userId, member?.displayName || member?.name || "회원", true);
      return;
    }

    const memberPageButton = event.target.closest("[data-member-page]");
    if (memberPageButton) {
      state.memberPage = Number(memberPageButton.dataset.memberPage) || 0;
      renderMembers();
      saveSnapshot();
      return;
    }

    const restoreAbsenceButton = event.target.closest("[data-restore-absence-id]");
    if (restoreAbsenceButton) {
      restoreCoachLessonAbsence(restoreAbsenceButton.dataset.restoreAbsenceId);
      return;
    }

    const lockedTimeButton = event.target.closest("[data-coach-add-locked-time]");
    if (lockedTimeButton) {
      const wrapper = lockedTimeButton.closest(".coach-mobile-locked-add");
      const time = wrapper?.querySelector("[data-coach-locked-time-select]")?.value || "";
      if (!time) {
        showToast("등록할 시간을 선택해 주세요.");
        return;
      }
      openCoachQuickAdd({
        dataset: {
          date: lockedTimeButton.dataset.date,
          day: lockedTimeButton.dataset.day,
          time,
          coachRoleId: lockedTimeButton.dataset.coachRoleId,
        },
      });
      return;
    }

    const quickAddSlot = event.target.closest("[data-coach-add-lesson]");
    if (quickAddSlot) {
      openCoachQuickAdd(quickAddSlot);
      return;
    }

    const quickAddKind = event.target.closest("[data-coach-add-kind]");
    if (quickAddKind && state.coachQuickAdd) {
      state.coachQuickAdd.kind = quickAddKind.dataset.coachAddKind;
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || state.coachQuickAdd.ticketId;
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || state.coachQuickAdd.note;
      state.coachQuickAdd.validationMessage = "";
      renderLessonEditModal();
      return;
    }

    const quickAddDuration = event.target.closest("[data-coach-add-duration]");
    if (quickAddDuration && state.coachQuickAdd) {
      state.coachQuickAdd.durationMinutes = Number(quickAddDuration.dataset.coachAddDuration) || 20;
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || state.coachQuickAdd.ticketId;
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || state.coachQuickAdd.note;
      state.coachQuickAdd.validationMessage = "";
      renderLessonEditModal();
      return;
    }

    if (event.target.closest("[data-save-coach-quick-add]")) {
      state.coachQuickAdd.ticketId = $("#coachQuickAddTicket")?.value || "";
      state.coachQuickAdd.note = $("#coachQuickAddNote")?.value.trim() || "";
      saveCoachQuickAdd();
      return;
    }

    const editLessonButton = event.target.closest("[data-edit-lesson-id]");
    if (editLessonButton) {
      openLessonEditor(editLessonButton.dataset.editLessonId);
      return;
    }

    const absentLessonButton = event.target.closest("[data-mark-lesson-absent]");
    if (absentLessonButton) {
      markCoachLessonAbsent(absentLessonButton.dataset.markLessonAbsent);
      return;
    }

    const attendanceButton = event.target.closest("[data-process-attendance]");
    if (attendanceButton) {
      processCoachAttendance(
        attendanceButton.dataset.processAttendance,
        attendanceButton.dataset.outcome,
        attendanceButton.dataset.deduct === "true",
      );
      return;
    }

    const noShowButton = event.target.closest("[data-process-no-show]");
    if (noShowButton) {
      processCoachNoShow(noShowButton.dataset.processNoShow, noShowButton.dataset.deduct === "true");
      return;
    }

    const saveScheduleButton = event.target.closest("[data-save-schedule-edit]");
    if (saveScheduleButton) {
      saveLessonEdit(saveScheduleButton.dataset.saveScheduleEdit);
      return;
    }

    const openRecordWriterButton = event.target.closest("[data-open-record-writer]");
    if (openRecordWriterButton) {
      openLessonRecordWriter(openRecordWriterButton.dataset.openRecordWriter);
      return;
    }

    if (event.target.closest("[data-save-lesson-record]")) {
      saveLessonRecord();
      return;
    }

    const saveLessonDraftButton = event.target.closest("[data-save-lesson-draft]");
    if (saveLessonDraftButton) {
      void saveLessonChartDraft(saveLessonDraftButton.dataset.saveLessonDraft);
      return;
    }

    const completeLessonButton = event.target.closest("[data-complete-lesson-from-modal]");
    if (completeLessonButton) {
      completeLessonFromModal(completeLessonButton.dataset.completeLessonFromModal);
      return;
    }

    if (event.target.closest("[data-cancel-schedule-edit]")) {
      closeLessonEditor();
      return;
    }

    if (event.target.closest("[data-close-lesson-modal]")) {
      closeLessonEditor();
      return;
    }

    if (event.target.closest("[data-close-member-modal]")) {
      closeMemberDetailModal();
      return;
    }

    const approveButton = event.target.closest("[data-approve-makeup]");
    if (approveButton) approveMakeup(approveButton.dataset.approveMakeup);

    const rejectButton = event.target.closest("[data-reject-makeup]");
    if (rejectButton) rejectMakeup(rejectButton.dataset.rejectMakeup);

    const completeNtrpButton = event.target.closest("[data-complete-ntrp]");
    if (completeNtrpButton) completeNtrpRequest(completeNtrpButton.dataset.completeNtrp);

    const commentInput = event.target.closest("[data-coach-comment]");
    if (commentInput) updateLogDraft(commentInput.dataset.coachComment);

    const curriculumSelect = event.target.closest("[data-next-curriculum]");
    if (curriculumSelect) updateLogDraft(curriculumSelect.dataset.nextCurriculum);

    const confirmButton = event.target.closest("[data-confirm-log]");
    if (confirmButton) {
      const logId = confirmButton.dataset.confirmLog;
      const log = state.lessonLogs.find((item) => item.id === logId);
      const fromOfflineQueue = ["동기화 대기", "동기화 실패"].includes(log?.status);
      confirmLog(logId, { fromOfflineQueue });
    }

    const feedbackButton = event.target.closest("[data-confirm-feedback]");
    if (feedbackButton) confirmFeedback(feedbackButton.dataset.confirmFeedback);
  });

  document.addEventListener("keydown", (event) => {
    if (activeCoachModalId && event.key === "Tab") {
      const focusable = coachFocusableElements($(`#${activeCoachModalId}`));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "Escape" && activeCoachModalId) {
      event.preventDefault();
      closeCoachModal(activeCoachModalId);
      return;
    }
    if (event.key === "Escape" && !$("#noticeDialog")?.hidden) {
      event.preventDefault();
      closeNotice(false);
      return;
    }
    const summaryCard = event.target.closest?.(".summary-grid [data-summary-action]");
    if (!summaryCard || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    handleSummaryAction(summaryCard.dataset.summaryAction);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("#memberCoachFilter")) {
      state.memberCoachFilter = event.target.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
    if (event.target.matches("#memberTicketFilter")) {
      state.memberTicketFilter = event.target.value;
      state.memberPage = 0;
      renderMembers();
      saveSnapshot();
    }
  });
  window.addEventListener("popstate", (event) => {
    if (activeCoachModalId) {
      closeCoachModal(activeCoachModalId, true);
      return;
    }
    const targetView = event.state?.tennisNoteView;
    if (targetView && $(`#${targetView}`)) setView(targetView);
  });
}
function renderAll() {
  if (state.dataMode !== "live") {
    ensureTodayLessonDashboard();
    ensureMemberLists();
    ensureCoachDemoConsistency();
    importMemberLessonLogs();
    importPracticeFeedbackRequests();
    importMakeupRequests();
  }
  renderCoachAccessMessage();
  renderCoachModeList();
  renderCoachProfile();
  renderCoachPushNotificationSettings();
  renderSummary();
  renderTodayLessons();
  renderFullSchedule();
  renderMembers();
  renderMakeups();
  renderLogs();
  renderCurriculums();
  renderCoachConnectivityStatus();
  saveSnapshot();
}

let coachLiveScheduleRefreshTimer = 0;
let coachLiveScheduleRefreshInFlight = false;
let coachLiveScheduleLastRefreshAt = 0;
let coachScheduleRevisionWatcher = null;
const COACH_LIVE_REFRESH_INTERVAL_MS = 60_000;
const COACH_LIVE_REFRESH_STALE_MS = 30_000;

async function refreshCoachLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  const force = options.force === true;
  if (
    coachLiveScheduleRefreshInFlight
    || document.hidden
    || state.dataMode !== "live"
    || !state.coach
    || !client?.getSession?.()?.access_token
    || (!force && Date.now() - coachLiveScheduleLastRefreshAt < COACH_LIVE_REFRESH_STALE_MS)
  ) return false;

  coachLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncCoachLessonsFromServer();
    if (synced) coachLiveScheduleLastRefreshAt = Date.now();
    if (synced && options.render !== false) renderAll();
    return synced;
  } finally {
    coachLiveScheduleRefreshInFlight = false;
  }
}

function installCoachLiveScheduleRefresh() {
  if (coachLiveScheduleRefreshTimer) return;
  const refresh = () => refreshCoachLiveSchedule().catch(() => false);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  coachLiveScheduleRefreshTimer = window.setInterval(refresh, COACH_LIVE_REFRESH_INTERVAL_MS);
}

function installCoachScheduleRevisionWatcher() {
  if (coachScheduleRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  coachScheduleRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: () => state.coach?.branchId || "",
    active: () => !document.hidden && !$("#appScreen")?.hidden && Boolean(state.coach),
    onChange: async () => {
      coachScheduleV2WorkspaceCache = null;
      coachLiveScheduleLastRefreshAt = 0;
      await refreshCoachLiveSchedule({ force: true, render: true });
    },
  });
}

async function initCoachApp() {
  registerPwaServiceWorker();
  purgeLegacyDemoStorage();
  restoreSnapshot();
  resetCoachScheduleLaunchView();
  window.TennisNoteModeTransition?.consume("coach", { splashSelector: "#coachBrandSplash" });
  bindEvents();
  void installNativeCoachBackNavigation();
  installCoachConnectivitySync();
  installCoachLiveScheduleRefresh();
  installCoachScheduleRevisionWatcher();
  renderAll();
  const client = window.TennisNoteDataClient;
  const hasStoredSession = Boolean(client?.getSession?.()?.access_token);
  const oauthReturnPending = Boolean(
    new URLSearchParams(window.location.search || "").get("code")
    || new URLSearchParams(window.location.search || "").get("error")
    || window.location.hash.includes("access_token=")
  );
  if (oauthReturnPending) document.body.classList.add("coach-session-restoring");
  if (hasStoredSession && state.coach) openCoachApp(false);
  hideCoachBrandSplash();
  void (async () => {
    await syncLiveSchedulePolicy(state.coach?.branchId || "");
    renderAll();
  })().catch(() => {});

  const coachAccessResult = await Promise.race([
    applySupabaseCoachSession(false),
    new Promise((resolve) => window.setTimeout(() => resolve("timeout"), 8_000)),
  ]);
  const coachAccessTimedOut = coachAccessResult === "timeout";
  const openedFromSupabase = coachAccessResult === true;
  document.body.classList.remove("coach-session-restoring");
  const sessionStillAvailable = Boolean(client?.getSession?.()?.access_token);
  if (!sessionStillAvailable) {
    returnToMemberEntry(true);
    return;
  }
  if (coachAccessTimedOut) {
    state.coach = null;
    $("#coachAppScreen").hidden = true;
    $("#coachLoginScreen").hidden = false;
    setCoachAccessMessage("코치 권한 확인이 지연되고 있습니다. 네트워크를 확인한 뒤 새로고침하거나 회원 화면으로 돌아가 주세요.", "alert");
    saveSnapshot();
    return;
  }
  if (!openedFromSupabase) {
    state.coach = null;
    $("#coachAppScreen").hidden = true;
    $("#coachLoginScreen").hidden = false;
    setCoachAccessMessage("코치 권한을 확인하지 못했습니다. 네트워크를 확인한 뒤 새로고침하거나 관리자에게 승인 상태를 확인해 주세요.", "alert");
    saveSnapshot();
    return;
  }
  if (!state.coach) {
    $("#coachAppScreen").hidden = true;
    $("#coachLoginScreen").hidden = false;
    renderCoachAccessMessage();
    return;
  }
  if (window.TennisNoteDataClient?.isOnline?.() !== false) void flushCoachOfflineLessonDrafts();
}

window.__TENNIS_NOTE_COACH_APP_RUNTIME__ = Object.freeze({
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.392",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-coach-runtime-version",
  window.__TENNIS_NOTE_COACH_APP_RUNTIME__.version,
);
initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);
