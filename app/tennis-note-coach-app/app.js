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

const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;
let coachOfflineFlushPromise = null;
let coachSyncUiState = "idle";
let coachSyncStatusTimer = 0;
let appToastTimer = 0;

const brandSplashStartedAt = performance.now();
const curriculumCatalog = window.TennisNoteCurriculumCatalog || {
  sources: {},
  tracks: [],
  fundamentals: [],
  steps: legacyCurriculumSteps,
  aliases: {},
};
const curriculumSteps = curriculumCatalog.steps?.length ? curriculumCatalog.steps : legacyCurriculumSteps;

let coachPushListenersReady = false;
let coachPushProfileId = "";
let coachPushPrimerTimer = 0;
let coachPushPrimerAttempts = 0;
let coachPushUiState = {
  permission: "unknown",
  status: "앱 알림 확인 중",
  detail: "수업 일정과 처리할 기록을 알려드립니다.",
};

const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";
const scheduleWeeks = buildScheduleWeeks();
let coachScheduleV2WorkspaceCache = null;
let coachScheduleV2RequestSequence = 0;

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
let activeCoachModalId = "";
let coachModalReturnFocus = null;
let nativeCoachBackListenerReady = false;

const coachMemberChartCache = new Map();


function bindEvents() {
  bindAccountEvents();
  bindDelegatedEvents();
}
let coachLiveScheduleRefreshTimer = 0;
let coachLiveScheduleRefreshInFlight = false;
let coachLiveScheduleLastRefreshAt = 0;
let coachScheduleRevisionWatcher = null;
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
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.373",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-coach-runtime-version",
  window.__TENNIS_NOTE_COACH_APP_RUNTIME__.version,
);
initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);
