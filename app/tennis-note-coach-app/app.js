const state = {
  coach: null,
  dataMode: "live",
  liveProfileId: "",
  coachAccessMessage: "",
  coachAccessTone: "wait",
  dashboardVersion: 5,
  editingMakeupId: null,
  writingLessonId: null,
  memberFilter: "active",
  memberQuery: "",
  memberCoachFilter: "all",
  memberTicketFilter: "all",
  memberPage: 0,
  revealedMemberContactKey: "",
  viewingMemberDetailId: "",
  viewingMemberGroupName: "",
  todayTaskTab: "lessons",
  expandedTodayTasks: {},
  liveLessons: [],
  releasedMakeupSlots: [],
  liveLessonsLoaded: false,
  liveMembersLoaded: false,
  scheduleFilter: "all",
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
  members: [],
  branchPermissions: {
    branch: "어린이대공원점",
    schedule: "같은 지점 전체 시간표 공유",
    memberRecords: "같은 지점 회원정보와 수업기록 열람",
    finance: "결제/전체매출/환불은 관리자만",
  },
  proxySettlements: [],
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

const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;

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
const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];

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
      { id: "week2-request-1", day: "금", time: "19:00", coach: "강 코치", member: "이하린", type: "변경요청", ticket: "개인레슨 8회", status: "승인 대기", remaining: 2, task: "24시간 이내 요청", changeNote: "승인 필요" },
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
    no_show: "당일 취소",
  }[status] || status || "예정";
}

async function syncCoachLessonsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const [lessonRows, participantRows, userRows, coachRows, ticketRows, productRows, recordRows, changeRequestRows, makeupEntitlementRows, oneDayBookingRows] = await Promise.all([
      client.selectRows("tn_lessons", {
        select: "id,branch_id,member_ticket_id,coach_role_id,original_coach_role_id,lesson_date,day_of_week,start_time,duration_minutes,status,lesson_source",
        limit: 300,
      }),
      client.selectRows("tn_lesson_participants", {
        select: "lesson_id,user_id,ticket_id",
        limit: 500,
      }),
      client.selectRows("tn_users", { select: "id,name,phone,birth_year,neighborhood,gender,role,member_kind,status,profile_photo_url,self_ntrp,coach_ntrp,ntrp_requested_at,ntrp_survey,tennis_goal,play_style_memo", limit: 300 }),
      client.selectRows("tn_coach_roles", { select: "id,display_name,color,status", limit: 100 }),
      client.selectRows("tn_member_tickets", { select: "id,user_id,product_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,created_at", limit: 300 }),
      client.selectRows("tn_membership_products", { select: "id,name,group_size,lesson_minutes", limit: 200 }),
      client.selectRows("tn_lesson_records", { select: "lesson_id", limit: 300 }).catch(() => []),
      client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,decided_at,created_at",
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
    const usersById = new Map((userRows || []).map((user) => [user.id, user.name]));
    const coachesById = new Map((coachRows || []).map((coach) => [coach.id, coach]));
    const ticketsById = new Map((ticketRows || []).map((ticket) => [ticket.id, ticket]));
    const productsById = new Map((productRows || []).map((product) => [product.id, product]));
    const participantIdsByLesson = new Map();
    (participantRows || []).forEach((participant) => {
      if (!participantIdsByLesson.has(participant.lesson_id)) participantIdsByLesson.set(participant.lesson_id, []);
      participantIdsByLesson.get(participant.lesson_id).push(participant.user_id);
    });
    const completedLessonIds = new Set((recordRows || []).map((record) => record.lesson_id));

    const mappedLessons = (lessonRows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const participantIds = participantIdsByLesson.get(lesson.id) || [];
        const memberNames = participantIds.map((userId) => usersById.get(userId)).filter(Boolean);
        const ticket = ticketsById.get(lesson.member_ticket_id) || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(lesson.coach_role_id) || {};
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
          coach: coach.display_name || "담당 코치",
          coachRoleId: lesson.coach_role_id,
          member: memberNames.join("&") || "회원",
          memberUserIds: participantIds,
          type: `${lessonKind} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketLessonMinutes: Number(product.lesson_minutes) || Number(lesson.duration_minutes) || 20,
          ticketId: lesson.member_ticket_id || "",
          totalSessions: Number(ticket.total_sessions) || 0,
          usedSessions: Number(ticket.used_sessions) || 0,
          ticket: `${participantIds.length > 1 ? "2대1" : "개인"} ${ticket.total_sessions || ""}회`.replace("  회", ""),
          status: serverLessonStatusLabel(lesson.status),
          serverStatus: lesson.status,
          remaining: Number(ticket.remaining_sessions) || 0,
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
      .filter((entitlement) => {
        const sourceLesson = lessonRowsById.get(entitlement.sourceLessonId);
        if (!["open", "booked"].includes(entitlement.status) || sourceLesson?.status !== "cancelled") return false;
        if (!entitlement.originalDate || !entitlement.originalTime || entitlement.originalDate < todayIso) return false;
        const releasedStart = minutesFromTime(entitlement.originalTime);
        const releasedEnd = releasedStart + entitlement.durationMinutes;
        return !state.liveLessons.some((lesson) => {
          if (lesson.lessonDate !== entitlement.originalDate || lesson.coachRoleId !== entitlement.coachRoleId) return false;
          const lessonStart = minutesFromTime(lesson.time);
          return releasedStart < lessonStart + lessonDuration(lesson) && lessonStart < releasedEnd;
        });
      })
      .map((entitlement) => {
        const dayIndex = new Date(`${entitlement.originalDate}T00:00:00`).getDay();
        return {
          id: `released-${entitlement.id}`,
          releasedMakeupSlot: true,
          lessonDate: entitlement.originalDate,
          day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
          time: entitlement.originalTime,
          coach: entitlement.coach,
          coachRoleId: entitlement.coachRoleId,
          member: "수업 신청 가능",
          entitlementId: entitlement.id,
          sourceLessonId: entitlement.sourceLessonId,
          type: `수업 신청 가능 ${entitlement.durationMinutes}분`,
          lessonSource: "makeup",
          durationMinutes: entitlement.durationMinutes,
          status: "available",
          task: "수업 신청 가능",
        };
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
        const ticket = userTickets[0] || {};
        const product = productsById.get(ticket.product_id) || {};
        const coach = coachesById.get(ticket.coach_role_id) || {};
        const latestLesson = latestLessonByUser.get(user.id);
        const isActive = ["active", "paused"].includes(ticket.status) && Number(ticket.remaining_sessions || 0) > 0;
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
    state.liveLessons = [];
    state.releasedMakeupSlots = [];
    state.liveLessonsLoaded = state.dataMode === "live";
    state.liveMembersLoaded = state.dataMode === "live";
    if (state.dataMode === "live") {
      state.members = [];
      state.expiredMembers = [];
    }
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

function saveSnapshot() {
  localStorage.setItem(storageKey, JSON.stringify({ state }));
}

function approvedCoachesFromAdmin() {
  try {
    const snapshot = readAdminSnapshot();
    const adminCoaches = Array.isArray(snapshot?.coaches) ? snapshot.coaches : [];
    const approved = adminCoaches
      .filter((coach) => coach.status === "active" && coach.coachMode === "approved" && coach.name !== "무인")
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

function writeLiveSchedulePolicySnapshot(value = {}) {
  if (!value || typeof value !== "object") return false;
  const existing = readAdminSnapshot() || {};
  const scheduleSettings = value.scheduleSettings || {};
  const coaches = Array.isArray(value.coaches) ? value.coaches : [];
  if (!scheduleSettings.openStart && !scheduleSettings.openEnd && !coaches.length) return false;
  localStorage.setItem(adminStorageKey, JSON.stringify({
    ...existing,
    scheduleSettings: {
      ...(existing.scheduleSettings || {}),
      ...scheduleSettings,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : existing.scheduleSettings?.breakRules || [],
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
    },
    coaches: coaches.length ? coaches : existing.coaches || [],
  }));
  return true;
}

async function syncLiveSchedulePolicy() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: liveSchedulePolicyKey },
      limit: 1,
    });
    return writeLiveSchedulePolicySnapshot(rows?.[0]?.value);
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
  return normalized;
}

function loadCoachSchedulePolicy() {
  const fallback = defaultCoachSchedulePolicy();
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    if (!snapshot) return fallback;
    const scheduleSettings = snapshot.scheduleSettings || {};
    const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
    const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches) && snapshot.coaches.length ? snapshot.coaches : fallback.coaches;
    const coaches = savedCoaches.concat(fallback.coaches.filter((fallbackCoach) => !savedCoaches.some((coach) => coach.id === fallbackCoach.id)));
    return {
      openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
      openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
      breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
      lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
      lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
      coaches: coaches
        .filter((coach) => (coach.status || "active") === "active" && coach.name !== "무인")
        .map(normalizeCoachPolicyItem),
    };
  } catch {
    localStorage.removeItem(adminStorageKey);
    return fallback;
  }
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
  return matched?.name || raw;
}

function coachFromLesson(lesson, policy) {
  const key = coachKeyFromName(lesson.coach);
  return policy.coaches.find((coach) => coach.id === key)
    || policy.coaches.find((coach) => coach.name === lesson.coach)
    || normalizeCoachPolicyItem({ id: key || lesson.coach, name: lesson.coach || "미지정 코치" });
}

function dayCoachesForSchedule(day, policy, lessons = []) {
  const working = policy.coaches.filter((coach) => (coach.workBlocks || []).some((block) => block.days.includes(day)));
  const lessonCoaches = lessons
    .filter((lesson) => lesson.day === day)
    .map((lesson) => coachFromLesson(lesson, policy));
  return working
    .concat(lessonCoaches)
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index)
    .sort((a, b) => coachOrder(a.id) - coachOrder(b.id));
}

function breakRuleForSlot(policy, day, time) {
  const current = minutesFromTime(time);
  return (policy.breakRules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    return current >= minutesFromTime(rule.start) && current < minutesFromTime(rule.end);
  });
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
  const range = state.scheduleTimeRange || "lesson";
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
  if (!("serviceWorker" in navigator)) return;
  let controllerChanged = false;
  const refreshKey = "tennis-note-sw-refresh-1.0.45";
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controllerChanged) return;
    controllerChanged = true;
    if (sessionStorage.getItem(refreshKey) === "done") return;
    sessionStorage.setItem(refreshKey, "done");
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js?v=1.0.45", { updateViaCache: "none" })
      .then((registration) => {
        const activateWaitingWorker = () => registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) activateWaitingWorker();
          });
        });
        activateWaitingWorker();
        let lastUpdateAt = 0;
        const update = () => {
          const now = Date.now();
          if (now - lastUpdateAt < 30_000) return;
          lastUpdateAt = now;
          registration.update().catch(() => undefined);
        };
        update();
        window.addEventListener("focus", update);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") update();
        });
      })
      .catch(() => undefined);
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
  setView(showFromLogin ? "todayView" : document.body.dataset.activeView || "todayView", { replaceHistory: true });
  window.setTimeout(showNoticeAfterLiveSync, 0);
}

function canUseCoachAppProfile(profile, coachRole) {
  return Boolean(profile?.id && coachRole?.status === "approved");
}

function memberModeUrl(openProfile = false, memberMode = true) {
  const params = new URLSearchParams({ v: "1.0.45" });
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

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  state.coach = null;
  state.todayLessons = [];
  state.makeupRequests = [];
  state.feedbackRequests = [];
  state.ntrpRequests = [];
  state.lessonLogs = [];
  state.members = [];
  state.expiredMembers = [];
  state.proxySettlements = [];
  state.liveLessons = [];
  state.releasedMakeupSlots = [];
  state.liveLessonsLoaded = false;
  state.liveMembersLoaded = false;
  state.viewingMemberDetailId = "";
  state.viewingMemberGroupName = "";
  state.writingLessonId = null;
  state.editingMakeupId = null;
  localStorage.removeItem(sharedStorageKey);
}

async function applySupabaseCoachSession(showFromLogin = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  client.consumeOAuthRedirect?.();
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
      role: profile?.role || "coach",
    };
    state.selectedCoachName = displayName;
    renderAll();
    openCoachApp(showFromLogin);
    saveSnapshot();
    await Promise.allSettled([
      syncCoachLessonsFromServer(),
      syncCoachJournalEntriesFromServer(),
    ]);
    renderAll();
    saveSnapshot();
    return true;
  } catch (error) {
    return false;
  }
}

function openUserMode() {
  sessionStorage.setItem(appModePreferenceKey, "member");
  sessionStorage.setItem("tennis-note-member-mode-transition", String(Date.now()));
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  saveSnapshot();
  window.location.href = memberModeUrl(true);
}

async function logoutCoach() {
  await window.TennisNoteDataClient?.signOut?.();
  returnToMemberEntry(false, false);
}

let activeCoachModalId = "";
let coachModalReturnFocus = null;

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
  const pendingLessonLogs = state.lessonLogs.filter((item) => item.status !== "확인 완료").length;
  const pendingFeedback = state.feedbackRequests.filter((item) => item.status !== "코치 답변 완료").length;
  const pendingRecordTotal = pendingLessonLogs + pendingFeedback;
  $("#todayLessonCount").textContent = `${ownLessons.length}개`;
  if ($("#todayLessonSummaryNote")) $("#todayLessonSummaryNote").textContent = ownLessons.length ? `정규 ${regularCount} · 보강 ${makeupLessonCount}` : "오늘 수업 없음";
  $("#makeupPendingCount").textContent = `${makeupPendingCount}건`;
  if ($("#makeupSummaryNote")) $("#makeupSummaryNote").textContent = makeupPendingCount ? `처리 대기 ${makeupPendingCount}건` : "대기 없음";
  $("#logPendingCount").textContent = `${pendingRecordTotal}건`;
  if ($("#recordSummaryNote")) $("#recordSummaryNote").textContent = pendingRecordTotal ? `완료 처리 ${pendingRecordTotal}건` : "처리 없음";
  if ($("#recordRequiredNote")) {
    $("#recordRequiredNote").textContent = pendingRecordTotal
      ? `미처리 ${pendingRecordTotal}건 · 코멘트 등록 후 횟수가 차감됩니다.`
      : "오늘 처리할 기록이 없습니다.";
  }
  if ($("#openLessonRecordWriter")) $("#openLessonRecordWriter").hidden = ownLessons.length === 0;
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
        <button class="coach-mode-chip ${canonicalCoachName(state.coach?.name || state.selectedCoachName) === coach.name ? "is-active" : ""}" type="button" data-select-coach-mode="${coach.name}">
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
  return request.requested.includes("강") ? "강 코치" : request.requested.includes("황") ? "황 코치" : "노 코치";
}

function currentCoachName() {
  return canonicalCoachName(state.coach?.name || state.selectedCoachName || approvedCoachesFromAdmin()[0]?.name || "노 코치");
}

function ownTodayLessons() {
  const currentLessons = state.liveLessonsLoaded || state.dataMode === "live"
    ? weekLessons().filter((lesson) => lesson.lessonDate === localDateKey())
    : weekLessons();
  return currentLessons.filter((lesson) => (
    canonicalCoachName(lesson.coach) === currentCoachName()
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

function canProcessLesson(lesson) {
  if (!lesson) return false;
  if (canonicalCoachName(lesson.coach) === currentCoachName()) return true;
  return `${lesson.task || ""} ${lesson.status || ""}`.includes("대타");
}

function canRescheduleLesson(lesson) {
  if (!lesson || canonicalCoachName(lesson.coach) !== currentCoachName()) return false;
  if (lesson.serverStatus) return lesson.serverStatus === "scheduled";
  return !["완료", "취소", "당일 취소", "변경 요청"].includes(lesson.status);
}

function canMarkRegularLessonAbsent(lesson) {
  return canRescheduleLesson(lesson) && String(lesson.lessonSource || lesson.lesson_source || "regular") === "regular";
}

function lessonPermissionText(lesson) {
  if (canRescheduleLesson(lesson)) return "내 수업이라 일정 수정과 완료 처리가 가능합니다.";
  if (canProcessLesson(lesson)) return "대타 수업은 완료 처리할 수 있고 일정 수정은 원 담당 코치만 가능합니다.";
  return "다른 코치 수업은 같은 지점 공유용으로 확인만 가능합니다. 대타 지정 시 완료 처리할 수 있습니다.";
}

function pendingRecordTotal() {
  return state.lessonLogs.filter((item) => item.status !== "확인 완료").length + state.feedbackRequests.filter((item) => item.status !== "코치 답변 완료").length;
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
    { id: "lessons", label: "오늘 수업", count: lessonCount },
    { id: "makeup", label: "보강/변경 승인", count: makeupCount },
    { id: "records", label: "수업 완료", count: recordCount },
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
  if (lesson.releasedMakeupSlot) {
    return `data-restore-absence-id="${lesson.entitlementId || ""}" aria-label="${lesson.member || "회원"} 정규수업 복원"`;
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function coachLessonColorStyle(lesson, policy) {
  const kind = coachLessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const custom = (policy?.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  const saved = custom?.color || policy?.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function currentCoachProfile() {
  ensureMemberLists();
  const name = currentCoachName();
  return state.coachProfiles[name] || state.coachProfiles["노 코치"] || {};
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
}

function renderTodayLessons() {
  const schedulePolicy = loadCoachSchedulePolicy();
  const pendingMakeups = state.makeupRequests.filter((request) => request.status === "승인 대기");
  const ownLessons = ownTodayLessons();
  const ownMakeups = pendingMakeups.filter((request) => canonicalCoachName(requestCoach(request)) === currentCoachName());
  const ownAbsenceMakeups = ownOpenMakeupEntitlements();
  const ownMakeupTasks = [
    ...ownMakeups.map((request) => ({ ...request, taskKind: "approval" })),
    ...ownAbsenceMakeups.map((item) => ({ ...item, taskKind: "absence", requested: "회원 시간 선택 대기" })),
  ];
  const pendingRecordCount =
    state.lessonLogs.filter((item) => item.status === "확인 대기").length +
    state.feedbackRequests.filter((item) => item.status !== "코치 답변 완료").length;
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
                                  <button class="board-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${coachColorClass(lesson.coach)} ${lesson.remaining <= 2 ? "needs-renewal" : ""}" style="${coachLessonColorStyle(lesson, schedulePolicy)}" type="button" data-edit-lesson-id="${lesson.id}">
                                    <strong>${lesson.member}</strong>
                                    <span>${lesson.type}</span>
                                  </button>`,
                              )
                              .join("") || "<p class='empty-text'>이 시간에 확정된 레슨은 없습니다.</p>"}
                          </div>
                        </section>`;
                    })
                    .join("")
                : "<p class='empty-text'>오늘 등록된 레슨이 없습니다.</p>"}
            </div>
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
                : "<p class='empty-text'>확인할 보강신청이 없습니다.</p>"}
            </div>
            ${todayTaskToggleButton(ownMakeupTasks, "makeup")}
          </section>`
        : ""
    }`;
}

function renderScheduleEditPanel() {
  const lesson = ensureCoachLessonRecord(state.editingLessonId);
  if (!lesson) {
    return `<section class="schedule-edit-panel is-empty"><strong>레슨 카드를 누르면 오늘 레슨을 바로 수정할 수 있습니다.</strong></section>`;
  }
  const canProcess = canProcessLesson(lesson);
  const canReschedule = canRescheduleLesson(lesson);
  const member = memberForLesson(lesson);
  const recentLog = recentLogForLesson(lesson);
  const defaultContent = `${lesson.member} ${lesson.type} 수업 진행`;
  const defaultComment = "";
  const defaultCurriculumId = recentLog?.nextCurriculumId || recentLog?.curriculumId || curriculumSteps[0]?.id;
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
          <span>${lesson.day} ${lesson.time} · ${lesson.type} · ${lesson.coach}</span>
        </div>
        <b class="${canProcess ? "can-process" : "read-only"}">${canProcess ? "처리 가능" : "보기 전용"}</b>
      </div>
      <p class="permission-note wide">${lessonPermissionText(lesson)}</p>
      <div class="lesson-flow-grid wide">
        <article class="modal-info-card">
          <span>수업 정보</span>
          <strong>${lesson.ticket}</strong>
          <small>잔여 ${lesson.remaining}회 · 상태 ${lesson.status}</small>
        </article>
        <article class="modal-info-card">
          <span>회원 요약</span>
          <strong>${member ? `${member.ticket} · 자가 ${ntrpNumber(member.selfNtrp)}` : "회원정보 연결 전"}</strong>
          <small>${member ? `코치 NTRP ${ntrpNumber(member.coachNtrp)} · 최근 ${member.lastLesson}` : "회원관리에서 연결하면 요약이 보입니다."}</small>
        </article>
        <article class="modal-info-card">
          <span>최근 기록</span>
          <strong>${recentLog ? recentLog.lesson : "기록 없음"}</strong>
          <small>${recentLog?.coachComment || recentLog?.content || "이번 수업 완료 후 첫 기록을 남깁니다."}</small>
        </article>
      </div>
      <label class="wide">
        <span>오늘 레슨 내용</span>
        <textarea data-modal-lesson-content="${lesson.id}" rows="3" ${canProcess ? "" : "disabled"}>${defaultContent}</textarea>
      </label>
      <label class="wide">
        <span>코치 코멘트</span>
        <textarea data-modal-coach-comment="${lesson.id}" rows="3" ${canProcess ? "" : "disabled"}>${defaultComment}</textarea>
      </label>
      <label class="wide">
        <span>다음 커리큘럼</span>
        <select data-modal-next-curriculum="${lesson.id}" ${canProcess ? "" : "disabled"}>${curriculumOptions(defaultCurriculumId)}</select>
      </label>
      ${lesson.validationMessage ? `<p class="validation-text wide">${lesson.validationMessage}</p>` : ""}
      <div class="lesson-edit-mini wide">
        <strong>일정 수정</strong>
        <p class="permission-note">본인 담당 수업만 근무시간과 이용권 정책 안에서 변경할 수 있습니다. 회원에게 변경 알림이 발송됩니다.</p>
        <div class="lesson-edit-grid">
          <label>
            <span>요일</span>
            <select id="editLessonDay" ${canReschedule ? "" : "disabled"}>${dayOptions}</select>
          </label>
          <label>
            <span>시간</span>
            <select id="editLessonTime" ${canReschedule ? "" : "disabled"}>${timeOptions}</select>
          </label>
          <label class="wide">
            <span>변경 사유</span>
            <input id="editLessonReason" type="text" maxlength="200" value="${escapeHtml(scheduleEditDraft.reason || "")}" placeholder="회원에게 안내할 변경 사유" ${canReschedule ? "" : "disabled"} />
          </label>
        </div>
      </div>
      ${canMarkRegularLessonAbsent(lesson) && lesson.serverLessonId
        ? `<div class="lesson-edit-mini lesson-absence-mini wide">
            <strong>정규수업 불참 처리</strong>
            <p class="permission-note">횟수는 차감하지 않고 원래 시간을 보강 전용으로 엽니다. 회원에게 보강 안내가 전달됩니다.</p>
            <div class="lesson-edit-grid">
              <label class="wide">
                <span>불참 사유</span>
                <input id="coachAbsenceReason" type="text" minlength="2" maxlength="200" placeholder="예: 회원 사전 연락" />
              </label>
            </div>
            <button class="reject-button" type="button" data-mark-lesson-absent="${lesson.id}">불참 처리·보강 전용으로 열기</button>
          </div>`
        : ""}
      <div class="actions wide">
        <button class="approve-button" type="button" data-complete-lesson-from-modal="${lesson.id}" ${canProcess ? "" : "disabled"}>코멘트 등록 + 완료/차감</button>
        <button class="small-button" type="button" data-save-schedule-edit="${lesson.id}" ${canReschedule ? "" : "disabled"}>일정 수정 저장</button>
        <button class="reject-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function renderMakeupApprovalPanel() {
  const request = state.makeupRequests.find((item) => item.id === state.editingMakeupId);
  if (!request) {
    return `
      <section class="schedule-edit-panel is-empty">
        <strong>확인할 보강 요청이 없습니다.</strong>
        <div class="actions">
          <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
        </div>
      </section>`;
  }
  const linkedLog = getMakeupLinkedLog(request.member);
  return `
    <section class="schedule-edit-panel makeup-detail-panel">
      <div class="wide">
        <strong>${request.member} 보강 승인</strong>
        <span>${request.original} → ${request.requested}</span>
      </div>
      <article class="modal-info-card">
        <span>현재 상태</span>
        <strong>${request.status}</strong>
        <small>${requestCoach(request)} 담당으로 연결됩니다.</small>
      </article>
      <article class="modal-info-card">
        <span>연결 기록</span>
        <strong>${linkedLog ? linkedLog.lesson : "연결된 회원기록 없음"}</strong>
        <small>${linkedLog ? linkedLog.status : "승인 후 기록/차감 확인이 가능합니다."}</small>
      </article>
      <div class="actions wide">
        ${linkedLog ? `<button class="small-button" type="button" data-open-linked-log="${request.id}">회원기록 보기</button>` : ""}
        <button class="approve-button" type="button" data-approve-makeup="${request.id}">승인</button>
        <button class="reject-button" type="button" data-reject-makeup="${request.id}">거절</button>
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
        <strong>작성할 수업이 없습니다.</strong>
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
        <span>다음 커리큘럼</span>
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
  const merged = mergeCoachScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
  const breaks = (policy.breakRules || [])
    .filter((rule) => rule.days?.includes(day))
    .map((rule) => ({ start: minutesFromTime(rule.start), end: minutesFromTime(rule.end) }));
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

function coachMobileScheduleSegments(day, policy, scheduleLessons) {
  const windows = coachOperatingWindows(day, policy);
  const range = state.scheduleTimeRange || "lesson";
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
                return `<div class="coach-mobile-slot ${working ? "available" : "off"}" style="grid-row:${index + 1};"></div>`;
              }).join("")}
              ${coachLessons.filter((lesson) => minutesFromTime(lesson.time) >= segment.startMinutes && minutesFromTime(lesson.time) < segment.endMinutes).map((lesson) => {
                const startIndex = times.indexOf(lesson.time);
                if (startIndex < 0) return "";
                const span = Math.max(1, Math.ceil(lessonDuration(lesson) / scheduleBlockMinutes));
                const memberLabel = formatScheduleMemberName(lesson.member || "회원");
                return `<button class="coach-mobile-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${lesson.releasedMakeupSlot ? "released-makeup-slot" : ""} ${coachColorClass(lesson.coach)}" type="button" ${coachScheduleLessonActionAttrs(lesson)} style="${coachLessonColorStyle(lesson, policy)};grid-row:${startIndex + 1} / span ${span};"><strong>${memberLabel}</strong><span>${lesson.releasedMakeupSlot ? "신청 가능" : `${lessonDuration(lesson)}분`}</span></button>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderCoachMobileSchedule(policy, scheduleLessons) {
  const selectedDay = selectedCoachScheduleDay();
  const segments = coachMobileScheduleSegments(selectedDay, policy, scheduleLessons);
  return `
    <div class="coach-mobile-schedule">
      <div class="coach-mobile-day-strip" aria-label="날짜 선택">
        ${scheduleDays.map((day) => `<button class="coach-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-coach-schedule-day="${day}"><strong>${day}</strong><span>${coachScheduleDateLabel(day)}</span></button>`).join("")}
      </div>
      ${segments.length
        ? segments.map((segment, index) => `${index > 0 ? `<div class="coach-mobile-break"><strong>${segments[index - 1].end}~${segment.start}</strong><span>수업 없음</span></div>` : ""}${renderCoachMobileSegment(selectedDay, segment, policy, scheduleLessons)}`).join("")
        : `<p class="coach-mobile-empty">${selectedDay}요일은 현재 등록된 운영시간이 없습니다.</p>`}
    </div>`;
}

function renderFullSchedule() {
  if (!$("#fullScheduleBoard")) return;
  ensureMemberLists();
  const policy = loadCoachSchedulePolicy();
  const times = coachScheduleTimes(policy);
  const weekIndex = activeWeekIndex();
  const week = activeScheduleWeek();
  const scheduleFilter = state.scheduleFilter || "all";
  const lessonsForWeek = filterFullScheduleLessons(weekLessons(), scheduleFilter);
  const dayCoachMap = new Map(scheduleDays.map((day) => [day, dayCoachesForSchedule(day, policy, lessonsForWeek)]));
  const dayColumnTracks = scheduleDays
    .map((day) => {
      const laneCount = Math.max(1, dayCoachMap.get(day)?.length || 0);
      const minimumWidth = laneCount * coachScheduleLaneWidth + Math.max(0, laneCount - 1) * 3;
      return `minmax(${minimumWidth}px, 1fr)`;
    })
    .join(" ");
  $("#fullScheduleBoard").innerHTML = `
    <div class="coach-week-calendar">
      <div class="coach-week-controls">
        <button class="small-button" type="button" data-change-week="-1" ${weekIndex <= coachScheduleMinWeekOffset ? "disabled" : ""}>이전 주</button>
        <div class="schedule-period-summary">
          <div class="schedule-month-controls">
            <button class="small-button" type="button" data-change-coach-month="-1">이전 달</button>
            <input class="schedule-month-input" type="month" value="${coachScheduleMonthValue(week)}" data-coach-month aria-label="이동할 달">
            <button class="small-button" type="button" data-change-coach-month="1">다음 달</button>
          </div>
          <strong>${week.label}</strong>
          <span>${week.range} · ${fullScheduleFilterLabel(scheduleFilter)} · 관리자 근무시간 기준</span>
        </div>
        <button class="small-button" type="button" data-change-week="1" ${weekIndex >= coachScheduleMaxWeekOffset ? "disabled" : ""}>다음 주</button>
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
      <div class="schedule-filter-row compact" aria-label="시간 범위 필터">
        ${scheduleTimeRangeOptions()
          .map(
            (option) => `
              <button class="schedule-filter ${((state.scheduleTimeRange || "lesson") === option.id) ? "is-active" : ""}" type="button" data-schedule-time-range="${option.id}">
                ${option.label}
              </button>`,
          )
          .join("")}
      </div>
    </div>
    ${renderCoachMobileSchedule(policy, lessonsForWeek)}
    <div class="coach-desktop-schedule">
    <div class="coach-duration-schedule" role="table" aria-label="전체 레슨표" style="--day-count:${scheduleDays.length}; --slot-count:${times.length}; grid-template-columns:64px ${dayColumnTracks};">
      <div class="coach-duration-head time-head">시간</div>
      ${scheduleDays
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ name: "운영없음" }];
          return `
            <div class="coach-duration-head coach-day-head" style="--coach-count:${displayCoaches.length};">
              <strong>${day}요일</strong>
              <div class="coach-coach-head-row">
                ${displayCoaches.map((coach) => `<span>${shortCoachName(coach.name)}</span>`).join("")}
              </div>
            </div>`;
        })
        .join("")}
      <div class="coach-time-rail">
        ${times.map((time) => `<div class="coach-duration-time">${time}</div>`).join("")}
      </div>
      ${scheduleDays
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ id: `closed-${day}`, name: "운영없음", workBlocks: [] }];
          const dayLessons = lessonsForWeek.filter((lesson) => lesson.day === day);
          return `
            <div class="coach-day-column" style="--slot-count:${times.length}; --coach-count:${displayCoaches.length};">
              ${times
                .map((time, timeIndex) =>
                  displayCoaches
                    .map((coach, coachIndex) => {
                      const breakRule = breakRuleForSlot(policy, day, time);
                      const isWorking = !breakRule && isPolicyCoachWorking(coach, day, time, scheduleBlockMinutes);
                      const className = breakRule ? "blocked" : isWorking ? "available" : "off";
                      const label = breakRule ? (breakRule.label || "브레이크") : isWorking ? "" : "근무외";
                      return `
                        <div class="coach-slot-bg ${className}" style="grid-row:${timeIndex + 1}; grid-column:${coachIndex + 1};">
                          ${label ? `<span>${label}</span>` : ""}
                        </div>`;
                    })
                    .join(""),
                )
                .join("")}
              ${dayLessons
                .map((lesson) => {
                  const lessonCoach = coachFromLesson(lesson, policy);
                  const laneIndex = displayCoaches.findIndex((coach) => coach.id === lessonCoach.id);
                  const startIndex = times.indexOf(lesson.time);
                  if (startIndex < 0 || laneIndex < 0) return "";
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const isLongLesson = span >= 3;
                  const memberNames = formatScheduleMemberName(lesson.member);
                  const coachLabel = shortCoachName(lesson.coach);
                  return `
                    <button
                      class="coach-duration-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${lesson.releasedMakeupSlot ? "released-makeup-slot" : ""} ${coachColorClass(lesson.coach)} ${isLongLesson ? "is-long" : ""}"
                      type="button"
                      ${coachScheduleLessonActionAttrs(lesson)}
                      style="${coachLessonColorStyle(lesson, policy)}; grid-row:${startIndex + 1} / span ${span}; grid-column:${laneIndex + 1};"
                    >
                      <strong>${memberNames}</strong>
                      <span>${coachLabel}</span>
                    </button>`;
                })
              .join("")}
            </div>`;
        })
        .join("")}
    </div>
    </div>`;
}

function fullScheduleFilterOptions() {
  return [
    { id: "all", label: "전체" },
    { id: "mine", label: "내수업" },
    { id: "makeupChange", label: "보강&변경요청" },
  ];
}

function fullScheduleFilterLabel(filter) {
  return fullScheduleFilterOptions().find((item) => item.id === filter)?.label || "전체";
}

function filterFullScheduleLessons(lessons, filter) {
  if (filter === "mine") return lessons.filter((lesson) => canonicalCoachName(lesson.coach) === currentCoachName());
  if (filter === "makeupChange")
    return lessons.filter((lesson) =>
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("보강") ||
      `${lesson.type || ""} ${lesson.status || ""} ${lesson.changeNote || ""} ${lesson.task || ""}`.includes("변경") ||
      `${lesson.status || ""}`.includes("승인 대기"),
    );
  return lessons;
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
  return state.memberFilter === "expired" ? "expired" : "active";
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
  if (memberFilter() === "expired") return state.expiredMembers;
  return state.members.flatMap((member) => {
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

function renderActiveMemberCard(member) {
  const ticketType = isGroupTicket(member) ? "그룹" : "개인";
  const ticketLabel = `<span class="member-ticket ${isGroupTicket(member) ? "is-group" : "is-private"}"><b>${ticketType}</b><small>${member.ticket}</small></span>`;
  return `
    <article class="member-row active ${member.isGroupDisplay ? "group-child" : ""}" role="button" tabindex="0" data-member-detail-id="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
      <span class="member-name">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "tiny")}
        <span class="member-name-copy">
          <strong>${member.displayName || member.name}</strong>
          <small>${member.isGroupDisplay ? `2대1 ${member.groupPosition}/${member.groupTotal}` : "개인 회원"}</small>
        </span>
      </span>
      <span>${member.coach}</span>
      ${ticketLabel}
      <span>${memberUsageLabel(member)}</span>
      <span>${member.lastLesson}</span>
      <span>자가 ${ntrpNumber(member.selfNtrp)}</span>
      <label class="member-ntrp-inline">
        <span>코치</span>
        <select data-member-ntrp="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
          ${ntrpLevels.map((level) => `<option value="${level}" ${member.coachNtrp === level ? "selected" : ""}>${ntrpNumber(level)}</option>`).join("")}
        </select>
      </label>
    </article>`;
}

function renderExpiredMemberCard(member) {
  return `
    <article class="member-row expired" role="button" tabindex="0" data-member-detail-id="${member.id}">
      <span class="member-name">
        ${personAvatarMarkup(member, "tiny")}
        <span class="member-name-copy"><strong>${member.name}</strong></span>
      </span>
      <span>${member.coach}</span>
      <span>${member.ticket}</span>
      <span>기간 ~ ${member.expiredAt}</span>
      <span>사용 ${member.used}</span>
      <b>미재등록</b>
    </article>`;
}

function renderMemberHeader(filter) {
  const labels =
    filter === "active"
      ? ["회원", "코치", "회원권", "총/소진/잔여", "최근 수업", "자가 NTRP", "코치 측정"]
      : ["회원", "코치", "이전 회원권", "기간", "사용", "상태"];
  return `<div class="member-row member-row-head ${filter}">${labels.map((label) => `<span>${label}</span>`).join("")}</div>`;
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
  const coachFilter = state.memberCoachFilter || "all";
  const ticketFilter = state.memberTicketFilter || "all";
  const filteredByControls = allItems.filter((member) => {
    const coachMatches = coachFilter === "all" || canonicalCoachName(member.coach) === coachFilter;
    const ticketMatches = ticketFilter === "all" || (ticketFilter === "group" ? isGroupTicket(member) : !isGroupTicket(member));
    return coachMatches && ticketMatches;
  });
  const items = query ? filteredByControls.filter((member) => memberSearchValues(member).includes(query)) : filteredByControls;
  const page = normalizeMemberPage(items.length);
  const visible = items.slice(page * memberPageSize, page * memberPageSize + memberPageSize);
  if ($("#memberSearchInput") && $("#memberSearchInput").value !== state.memberQuery) $("#memberSearchInput").value = state.memberQuery || "";
  const coachSelect = $("#memberCoachFilter");
  if (coachSelect) {
    const coachNames = [...new Set(allItems.map((member) => canonicalCoachName(member.coach)).filter(Boolean))];
    coachSelect.innerHTML = `<option value="all">전체 코치</option>${coachNames
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("")}`;
    coachSelect.value = coachNames.includes(coachFilter) ? coachFilter : "all";
    if (coachSelect.value !== coachFilter) state.memberCoachFilter = "all";
  }
  if ($("#memberTicketFilter")) $("#memberTicketFilter").value = ticketFilter;
  $$(".member-filter").forEach((button) => button.classList.toggle("is-active", button.dataset.memberFilter === filter));
  if ($("#memberFilterSummary")) {
    $("#memberFilterSummary").textContent =
      filter === "active"
        ? `현재 수강생 ${items.length}/${allItems.length}명 · ${page + 1}페이지`
        : `만료회원 ${items.length}/${allItems.length}명 · ${page + 1}페이지`;
  }
  const rows = visible
    .map((member) => (filter === "active" ? renderActiveMemberCard(member) : renderExpiredMemberCard(member)))
    .join("");
  target.innerHTML = rows ? `${renderMemberHeader(filter)}${rows}` : `<p class='empty-text'>${filter === "active" ? "현재 수강생" : "만료회원"}이 없습니다.</p>`;
  renderMemberPager(items.length, page);
}

function findMemberDetail(memberId, groupName = "") {
  if (memberFilter() === "expired") return state.expiredMembers.find((member) => member.id === memberId);
  const member = state.members.find((item) => item.id === memberId);
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
  const logs = relatedLogsForMember(member);
  target.innerHTML = `
    <div class="lesson-modal-head member-detail-head">
      <div class="member-detail-identity">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "small")}
        <div>
          <span>${memberFilter() === "expired" ? "만료회원" : member.isGroupDisplay ? "2대1 회원" : "현재 수강생"}</span>
          <strong>${member.displayName || member.name}</strong>
          <small>${member.coach || "담당 코치 미정"} · ${member.ticket || "회원권 미정"}</small>
        </div>
      </div>
      <button class="small-button" type="button" data-close-member-modal>닫기</button>
    </div>
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
        <small>${memberFilter() === "expired" ? `만료 ${member.expiredAt || "-"}` : member.lastLesson || "최근 수업 없음"}</small>
      </article>
      <article class="modal-info-card">
        <span>NTRP</span>
        <strong>자가 ${ntrpNumber(member.selfNtrp)} · 코치 ${ntrpNumber(member.coachNtrp)}</strong>
        <small>${member.ntrpRequest || "측정 요청 없음"}</small>
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
      <strong>기록/차감 확인</strong>
      ${
        logs.length
          ? logs.map((log) => `<div><b>${log.lesson}</b><span>${log.status} · ${log.coachComment || "코치 코멘트 대기"}</span></div>`).join("")
          : `<p>아직 연결된 기록이 없습니다.</p>`
      }
    </section>
    <section class="member-detail-section">
      <strong>메모</strong>
      <p>${member.note || "운영 메모가 없습니다."}</p>
    </section>
  `;
  openCoachModal("memberDetailModal");
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
  target.innerHTML =
    state.makeupRequests
      .map(
        (request) => `
          <article class="work-card ${state.focusedMakeupId === request.id ? "is-focused" : ""}" data-makeup-card="${request.id}">
            <div>
              <strong>${request.member}</strong>
              <span>${request.original} → ${request.requested}</span>
              <small>${getMakeupLinkedLog(request.member) ? "관련 회원기록을 확인할 수 있습니다." : "관련 회원기록은 아직 없습니다."}</small>
            </div>
            <div class="actions">
              <b>${request.status}</b>
              <button class="small-button" type="button" data-open-makeup-detail="${request.id}">상세/승인창</button>
              <button class="small-button" type="button" data-open-linked-log="${request.id}">회원기록 보기</button>
              <button class="approve-button" type="button" data-approve-makeup="${request.id}">승인</button>
              <button class="reject-button" type="button" data-reject-makeup="${request.id}">거절</button>
            </div>
          </article>`,
      )
      .join("") || "<p class='empty-text'>확인할 보강 요청이 없습니다.</p>";
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

    const requestStatusLabel = {
      pending: "승인 대기",
      approved: "승인 완료",
      rejected: "거절",
      auto_approved: "자동 변경 완료",
    };
    state.makeupRequests = (changeRequestRows || [])
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((request) => {
        const lesson = state.liveLessons.find((item) => item.serverLessonId === request.lesson_id) || {};
        return {
          id: request.id,
          serverRequestId: request.id,
          member: usersById.get(request.requester_user_id) || lesson.member || "회원",
          original: `${lesson.lessonDate || ""} ${lesson.time || ""}`.trim() || "기존 수업",
          requested: `${request.requested_lesson_date || ""} ${String(request.requested_start_time || "").slice(0, 5)}`.trim(),
          reason: request.reason || "이유 미입력",
          policy: request.policy_window === "auto_before_24h" ? "24시간 이전 자동 변경" : "24시간 이내 코치 확인",
          status: requestStatusLabel[request.status] || request.status,
          coach: lesson.coach || "담당 코치",
          source: "server",
        };
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
  ensureCoachLessonRecord(id);
  state.editingLessonId = id;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function closeLessonEditor() {
  const lesson = state.editingLessonId ? ensureCoachLessonRecord(state.editingLessonId) : null;
  if (lesson) delete lesson.scheduleEditDraft;
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  closeCoachModal("lessonEditModal");
}

function renderLessonEditModal() {
  const target = $("#lessonEditModalContent");
  if (!target) return;
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
        target_time_blocked: "선택한 시간은 브레이크 또는 운영 중지 시간입니다.",
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
  closeLessonEditor();
  renderAll();
}

async function markCoachLessonAbsent(id) {
  const lesson = ensureCoachLessonRecord(id);
  const reason = $("#coachAbsenceReason")?.value.trim() || "";
  if (!lesson?.serverLessonId || !canMarkRegularLessonAbsent(lesson)) return;
  if (reason.length < 2) {
    lesson.validationMessage = "불참 사유를 2자 이상 입력해 주세요.";
    renderLessonEditModal();
    $("#coachAbsenceReason")?.focus();
    return;
  }
  if (!window.confirm(`${lesson.member} ${lesson.day} ${lesson.time} 정규수업을 불참 처리할까요?\n\n횟수는 지금 차감되지 않습니다. 원래 시간은 보강 전용으로 열리고 회원에게 보강 안내가 전달됩니다.`)) return;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    lesson.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
    renderLessonEditModal();
    return;
  }
  lesson.validationMessage = "불참 처리와 보강 대기를 생성하고 있습니다.";
  renderLessonEditModal();
  try {
    await client.rpc("tn_mark_lesson_absent_for_makeup", {
      target_lesson_id: lesson.serverLessonId,
      target_reason: reason,
    });
    closeLessonEditor();
    await syncCoachLessonsFromServer();
    renderAll();
    showToast("불참 처리 완료 · 회원 보강 선택 대기");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    lesson.validationMessage = code.includes("absence_lesson_already_started")
      ? "이미 시작한 수업은 사전 불참으로 처리할 수 없습니다."
      : code.includes("absence_lesson_not_scheduled")
        ? "예정 상태가 아닌 수업입니다. 새로고침 후 다시 확인해 주세요."
        : code.includes("absence_regular_lesson_required")
          ? "정규수업만 불참 처리할 수 있습니다."
        : code.includes("absence_coach_or_admin_required")
          ? "본인이 담당하는 수업만 불참 처리할 수 있습니다."
          : "불참 처리에 실패했습니다. 수업 상태를 다시 확인해 주세요.";
    renderLessonEditModal();
  }
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

function saveLessonRecord() {
  const lesson = ensureCoachLessonRecord($("#recordLessonSelect")?.value) || recordableCoachLessons()[0];
  if (!lesson) return;
  const nextCurriculumId = $("#recordNextCurriculum")?.value || curriculumSteps[0]?.id;
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
  closeLessonEditor();
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    document.querySelector(`#todayRecordPanel [data-log-card="${log.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

async function completeLessonFromModal(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson || !canProcessLesson(lesson)) return;
  const content = activeViewField(`[data-modal-lesson-content="${id}"]`)?.value.trim() || `${lesson.member} ${lesson.type} 수업 진행`;
  const coachComment = activeViewField(`[data-modal-coach-comment="${id}"]`)?.value.trim() || "";
  const nextCurriculumId = activeViewField(`[data-modal-next-curriculum="${id}"]`)?.value || curriculumSteps[0]?.id;
  const log = {
    id: `coach-complete-${Date.now()}`,
    serverLessonId: lesson.serverLessonId || "",
    serverJournalId: "",
    member: lesson.member,
    lesson: `${lesson.day} ${lesson.time} ${lesson.type}`,
    content,
    selfMemo: "회원 운동노트 미작성이어도 코치가 기록/차감 확인을 진행했습니다.",
    curriculumId: nextCurriculumId,
    nextCurriculumId,
    coachComment,
    validationMessage: "",
    status: "확인 대기",
    curriculumRegistered: false,
    ticketDeducted: false,
  };
  if (!coachComment || !nextCurriculumId) {
    lesson.validationMessage = "코치 코멘트와 다음 커리큘럼을 등록해야 횟수 차감이 가능합니다.";
    renderLessonEditModal();
    return;
  }
  const commentError = coachCommentValidationMessage(log);
  if (commentError) {
    lesson.validationMessage = commentError;
    renderLessonEditModal();
    return;
  }
  state.lessonLogs.unshift(log);
  lesson.validationMessage = "";
  closeLessonEditor();
  state.todayTaskTab = "records";
  renderAll();
  setView("todayView");
  await confirmLog(log.id, { skipDraft: true });
}

function changeScheduleWeek(delta) {
  state.selectedWeekIndex = Math.max(
    coachScheduleMinWeekOffset,
    Math.min(activeWeekIndex() + Number(delta), coachScheduleMaxWeekOffset),
  );
  renderAll();
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
}

function coachScheduleMonthValue(week = activeScheduleWeek()) {
  return String(week.startDate || "").slice(0, 7);
}

function curriculumOptions(selectedId) {
  const canonicalSelectedId = curriculumCatalog.aliases?.[selectedId] || selectedId;
  if (!curriculumCatalog.tracks?.length) {
    return curriculumSteps
      .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${step.title}</option>`)
      .join("");
  }
  const groups = [
    { title: "기초 움직임과 서브", steps: curriculumCatalog.fundamentals || [] },
    ...curriculumCatalog.tracks.map((track) => ({ title: track.title, steps: track.lessons })),
  ];
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

function selectedCurriculum(id) {
  const canonicalId = curriculumCatalog.aliases?.[id] || id;
  return curriculumSteps.find((step) => step.id === canonicalId) || curriculumSteps[0];
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
  const pendingLogs = state.lessonLogs.filter((log) => log.status !== "확인 완료");
  const pendingFeedback = state.feedbackRequests.filter((request) => request.status !== "코치 답변 완료");
  const showAllRecords = isTodayTaskExpanded("records");
  const visibleLogs = showAllRecords ? pendingLogs : pendingLogs.slice(0, 3);
  const visibleFeedback = showAllRecords ? pendingFeedback : pendingFeedback.slice(0, Math.max(0, 3 - visibleLogs.length));
  const allRecordItems = [...pendingLogs, ...pendingFeedback];
  const lessonMarkup =
    visibleLogs
      .map((log) => {
        const nextStep = selectedCurriculum(log.nextCurriculumId || log.curriculumId);
        const confirmed = log.status === "확인 완료";
        return `
          <article class="work-card log-card ${state.focusedLogId === log.id ? "is-focused" : ""}" data-log-card="${log.id}">
            <div class="log-main">
              <strong>${log.member} · ${log.lesson}</strong>
              <span>${log.content}</span>
              <small>${log.selfMemo}</small>
              ${journalMediaMarkup(log)}
              <small>같은 지점 코치 열람 가능 · 대타 수업이면 실제 진행 코치가 확인/차감합니다.</small>
              <em>회원에게 안내될 다음 수업: ${nextStep.id} · ${nextStep.title}</em>
              ${confirmed ? `<p class="coach-comment-view">코치 코멘트: ${log.coachComment}</p>` : ""}
            </div>
            <div class="coach-confirm-panel">
              <label>
                <span>코치 코멘트</span>
                <textarea data-coach-comment="${log.id}" rows="3" ${confirmed ? "disabled" : ""}>${log.coachComment || ""}</textarea>
              </label>
              <label>
                <span>다음 커리큘럼</span>
                <select data-next-curriculum="${log.id}" ${confirmed ? "disabled" : ""}>${curriculumOptions(log.nextCurriculumId || log.curriculumId)}</select>
              </label>
              ${log.validationMessage ? `<p class="validation-text">${log.validationMessage}</p>` : ""}
              <div class="actions">
                <b>${log.status}</b>
                <button class="approve-button" type="button" data-confirm-log="${log.id}" ${confirmed ? "disabled" : ""}>다음 커리큘럼 등록 + 확인/차감</button>
              </div>
            </div>
          </article>`;
      })
      .join("") || "<p class='empty-text'>확인할 수업 기록이 없습니다.</p>";
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
      .join("") || "<p class='empty-text'>확인할 운동노트 피드백 요청이 없습니다.</p>";
  return `
    <section class="record-section">
      <div class="record-section-title">
        <strong>기록/차감 확인</strong>
        <small>레슨 확인, 코치 코멘트, 다음 커리큘럼을 등록해야 회원권 횟수가 차감됩니다.</small>
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
  const pendingLogs = state.lessonLogs.filter((log) => log.status !== "확인 완료").slice(0, 6);
  const pendingFeedback = state.feedbackRequests.filter((request) => request.status !== "코치 답변 완료").slice(0, 4);
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
          <strong>${log.member}</strong>
          <span>${log.lesson}</span>
          <small>${log.status}</small>
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
    <details class="curriculum-browse-disclosure">
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
  exportPracticeFeedback(request);
  renderAll();
}

function normalizeCoachComment(text) {
  return (text || "")
    .replace(/\s+/g, "")
    .replace(/[.,!?~ㆍ·]/g, "")
    .toLowerCase();
}

function coachCommentValidationMessage(log) {
  const comment = log.coachComment || "";
  const normalized = normalizeCoachComment(comment);
  const weakPhrases = ["수고했습니다", "잘했습니다", "좋아요", "확인완료", "다음에이어", "다음시간에이어", "고생했습니다", "괜찮습니다"];
  if (normalized.length < 10) return "코치 코멘트는 직접 10자 이상 작성해야 합니다.";
  if (weakPhrases.some((phrase) => {
    const normalizedPhrase = normalizeCoachComment(phrase);
    return normalized.includes(normalizedPhrase) && normalized.length <= normalizedPhrase.length + 4;
  })) {
    return "반복되는 짧은 칭찬/확인 문구만으로는 횟수 차감이 불가합니다.";
  }
  const recentComments = state.lessonLogs
    .filter((item) => item.id !== log.id && item.coachComment)
    .slice(0, 5)
    .map((item) => normalizeCoachComment(item.coachComment));
  if (recentComments.includes(normalized)) return "최근 코멘트와 같은 내용은 다시 사용할 수 없습니다.";
  return "";
}

async function approveMakeup(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
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
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
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
    }
    return;
  }
  request.status = "거절";
  exportMakeupRequest(request);
  if (state.editingMakeupId === id) closeLessonEditor();
  renderAll();
}

function updateLogDraft(id) {
  const log = state.lessonLogs.find((item) => item.id === id);
  if (!log || log.status === "확인 완료") return log;
  const commentInput = activeViewField(`[data-coach-comment="${id}"]`);
  const curriculumSelect = activeViewField(`[data-next-curriculum="${id}"]`);
  log.coachComment = commentInput?.value.trim() || "";
  log.nextCurriculumId = curriculumSelect?.value || log.nextCurriculumId || log.curriculumId;
  log.validationMessage = "";
  return log;
}

async function confirmLog(id, options = {}) {
  const log = options.skipDraft
    ? state.lessonLogs.find((item) => item.id === id)
    : updateLogDraft(id);
  if (!log || log.status === "확인 완료") return;
  if (!log.coachComment || !log.nextCurriculumId) {
    log.validationMessage = "코치 코멘트와 다음 커리큘럼을 등록해야 횟수 차감이 가능합니다.";
    renderAll();
    return;
  }
  const commentError = coachCommentValidationMessage(log);
  if (commentError) {
    log.validationMessage = commentError;
    renderAll();
    return;
  }
  const nextStep = selectedCurriculum(log.nextCurriculumId);
  let serverResult = null;
  if (log.serverLessonId) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) {
      log.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
      renderAll();
      return;
    }
    log.status = "서버 처리 중";
    renderAll();
    try {
      const curriculumRefId = await liveCurriculumRefId(nextStep);
      serverResult = await client.rpc("tn_complete_lesson_and_deduct", {
        target_lesson_id: log.serverLessonId,
        target_coach_comment: log.coachComment,
        target_next_curriculum_ref_id: curriculumRefId,
        target_member_journal_id: log.serverJournalId || null,
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
        lesson_complete_comment_too_short: "코치 코멘트는 직접 10자 이상 작성해야 합니다.",
        lesson_complete_comment_too_generic: "짧은 칭찬이나 확인 문구만으로는 횟수 차감이 불가합니다.",
        lesson_complete_comment_recent_duplicate: "최근 수업과 같은 코멘트입니다. 이번 수업 내용을 직접 작성해 주세요.",
      };
      log.status = "확인 대기";
      log.validationMessage = serverMessages[code] || "서버 횟수 차감에 실패했습니다. 같은 기록에서 다시 시도해 주세요.";
      renderAll();
      return;
    }
  }
  log.status = "확인 완료";
  log.memberVisibleSummary = `다음 수업 등록 완료: ${nextStep.id} · ${nextStep.title}`;
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
  const deductedSessions = Number(serverResult?.deductedSessions || 0) || Math.max(
    1,
    Math.ceil(Number(lesson?.durationMinutes || 20) / Number(lesson?.ticketLessonMinutes || lesson?.durationMinutes || 20)),
  );
  log.deductedSessions = deductedSessions;
  exportConfirmedLog(log);
  if (lesson && Number.isFinite(Number(serverResult?.remainingSessions))) {
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
  renderAll();
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
  $("#refreshButton").addEventListener("click", renderAll);
  $("#userModeButton")?.addEventListener("click", openUserMode);
  $("#userModeLoginButton")?.addEventListener("click", openUserMode);
  $("#noticeClose")?.addEventListener("click", () => closeNotice(false));
  $("#noticeHideToday")?.addEventListener("click", () => closeNotice(true));
  $("#noticeAction")?.addEventListener("click", () => closeNotice(false));
  $("#saveCoachProfile")?.addEventListener("click", saveCoachProfile);
  $("#openLessonRecordWriter")?.addEventListener("click", () => openLessonRecordWriter());
  document.addEventListener("change", (event) => {
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

    if (event.target.closest("#recordLessonSelect")) {
      state.writingLessonId = event.target.value;
    }

    const ntrpSelect = event.target.closest("[data-member-ntrp]");
    if (ntrpSelect) updateMemberNtrp(ntrpSelect.dataset.memberNtrp, ntrpSelect.value, ntrpSelect.dataset.memberGroupName || "");
  });

  document.addEventListener("input", (event) => {
    const commentInput = event.target.closest("[data-coach-comment]");
    if (commentInput) updateLogDraft(commentInput.dataset.coachComment);

    const feedbackInput = event.target.closest("[data-feedback-comment]");
    if (feedbackInput) updateFeedbackDraft(feedbackInput.dataset.feedbackComment);

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

  document.addEventListener("click", (event) => {
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
      state.selectedFullScheduleDay = scheduleDayButton.dataset.coachScheduleDay;
      renderFullSchedule();
      saveSnapshot();
      return;
    }

    const scheduleFilterButton = event.target.closest("[data-schedule-filter]");
    if (scheduleFilterButton) {
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

    const memberDetailRow = event.target.closest("[data-member-detail-id]");
    if (memberDetailRow && !event.target.closest("select, button, a, input, textarea")) {
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
    if (confirmButton) confirmLog(confirmButton.dataset.confirmLog);

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
  renderSummary();
  renderTodayLessons();
  renderFullSchedule();
  renderMembers();
  renderMakeups();
  renderLogs();
  renderCurriculums();
  saveSnapshot();
}

let coachLiveScheduleRefreshTimer = 0;
let coachLiveScheduleRefreshInFlight = false;

async function refreshCoachLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  if (
    coachLiveScheduleRefreshInFlight
    || document.hidden
    || state.dataMode !== "live"
    || !state.coach
    || !client?.getSession?.()?.access_token
  ) return false;

  coachLiveScheduleRefreshInFlight = true;
  try {
    const synced = await syncCoachLessonsFromServer();
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
  coachLiveScheduleRefreshTimer = window.setInterval(refresh, 15_000);
}

async function initCoachApp() {
  registerPwaServiceWorker();
  purgeLegacyDemoStorage();
  restoreSnapshot();
  bindEvents();
  installCoachLiveScheduleRefresh();
  renderAll();
  const client = window.TennisNoteDataClient;
  const hasStoredSession = Boolean(client?.getSession?.()?.access_token);
  if (hasStoredSession && state.coach) openCoachApp(false);
  hideCoachBrandSplash();
  void syncLiveSchedulePolicy().then(() => renderAll()).catch(() => {});

  const openedFromSupabase = await applySupabaseCoachSession(false);
  if (!openedFromSupabase || !state.coach) {
    const sessionStillAvailable = Boolean(client?.getSession?.()?.access_token);
    if (!sessionStillAvailable || !state.coach) returnToMemberEntry(true);
  }
}

initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);
