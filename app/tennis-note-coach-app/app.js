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

function scheduleV2CoachWorkspace() {
  return coachScheduleV2WorkspaceCache?.workspace || null;
}

async function syncCoachSchedulePreview() {
  if (await syncCoachScheduleV2()) {
    state.scheduleV2SyncError = "";
    return true;
  }
  return false;
}

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
async function downloadCoachJournalMedia(client, row, displayName) {
  const blob = await client.downloadObject(journalMediaBucket, row.storage_path);
  return {
    name: displayName || "첨부파일",
    type: row.media_type === "video" ? (blob.type || "video/mp4") : (blob.type || "image/jpeg"),
    url: URL.createObjectURL(blob),
    storagePath: row.storage_path,
  };
}

function resetCoachScheduleLaunchView() {
  if (coachSchedulePreferenceTouched) return;
  state.scheduleFilter = "mine";
  state.selectedFullScheduleDay = currentCoachScheduleDay();
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

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

function registerPwaServiceWorker() {
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.371",
    remoteAppUrl: "https://tennisnote-app.pages.dev/tennis-note-coach-app/",
  });
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
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

let activeCoachModalId = "";
let coachModalReturnFocus = null;
let nativeCoachBackListenerReady = false;

function nativeCoachAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function nativeCoachPushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function setCoachPushNotificationState(permission, status, detail) {
  coachPushUiState = { permission, status, detail };
  renderCoachPushNotificationSettings();
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

const coachMemberChartCache = new Map();

function refreshCoachMemberChartBodies(userId = "") {
  $$('[data-member-chart-body]').filter((target) => String(target.dataset.memberUserId || "") === String(userId)).forEach((target) => {
    target.innerHTML = coachMemberChartBodyMarkup(
      target.dataset.memberUserId || "",
      target.dataset.memberName || "",
      Number(target.dataset.memberChartLimit) || 5,
    );
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

async function markCoachLessonAbsent(id) {
  return processCoachAttendance(id, "absence", false);
}

async function processCoachNoShow(lessonId, deduct) {
  return processCoachAttendance(lessonId, "no_show", deduct);
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
  input.focus();
}


function activeViewField(selector) {
  return document.querySelector(`.view.is-active ${selector}`) || document.querySelector(selector);
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

function bindEvents() {
  bindAccountEvents();
  bindDelegatedEvents();
}
let coachLiveScheduleRefreshTimer = 0;
let coachLiveScheduleRefreshInFlight = false;
let coachLiveScheduleLastRefreshAt = 0;
let coachScheduleRevisionWatcher = null;
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
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.371",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-coach-runtime-version",
  window.__TENNIS_NOTE_COACH_APP_RUNTIME__.version,
);
initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);
