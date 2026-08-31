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

const coachWebPortalUrl = "https://tennisnote-app.pages.dev/tennis-note-coach-app/";
const adminWebPortalUrl = "https://tennisnote-admin.pages.dev/";
let coachSchedulePreferenceTouched = false;

function hasTrustedCoachSchedulePolicySnapshot() {
  const snapshot = readAdminSnapshot();
  const settings = snapshot?.scheduleSettings || {};
  if (Number(settings.coachWorkPolicyVersion) < 2) return false;
  const activeBranchId = String(state.coach?.branchId || "");
  const snapshotBranchId = String(snapshot?.operationPolicyBranchId || "");
  if (activeBranchId && snapshotBranchId !== activeBranchId) return false;
  const coaches = Array.isArray(snapshot?.coaches) ? snapshot.coaches : [];
  return Boolean(
    (settings.openStart && settings.openEnd)
    || coaches.some((coach) => Array.isArray(coach.workBlocks)),
  );
}

function coachSchedulePolicyReady() {
  const workspaceBranchId = String(scheduleV2CoachWorkspace()?.branchId || "");
  const activeBranchId = String(state.coach?.branchId || "");
  return Boolean(
    (workspaceBranchId && (!activeBranchId || workspaceBranchId === activeBranchId))
    || hasTrustedCoachSchedulePolicySnapshot(),
  );
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

// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
// Kept temporarily for rollback diagnostics. Runtime schedule reads use V2 only.
let activeCoachModalId = "";
let coachModalReturnFocus = null;
let nativeCoachBackListenerReady = false;

function coachLessonCardState(lesson = {}, now = new Date()) {
  const participants = Array.isArray(lesson.v2Participants) ? lesson.v2Participants : [];
  const processing = coachLessonProcessingState(lesson, now);
  const deducted = Number(lesson.deductedSessions) > 0
    || participants.some((participant) => Number(participant.deductedSessions) > 0);
  const className = {
    released: "record-neutral",
    approval: "record-approval",
    processing_required: "record-problem",
    confirmation_needed: "record-problem",
    completed: "record-complete",
    no_show: "record-problem outcome-no-show",
    absence: "record-neutral outcome-absence",
    cancelled: "record-neutral",
    holiday: "record-neutral",
  }[processing.id] || "record-planned";
  const label = processing.id === "released"
    ? "차감 없음 · 예약 가능"
    : processing.id === "no_show"
      ? `노쇼 · ${deducted ? "1회 차감" : "차감 없음"}`
      : processing.id === "absence"
        ? `불참 · ${deducted ? "1회 차감" : "차감 없음"}`
        : processing.contextLabel
          ? `${processing.contextLabel} · ${processing.label}`
          : processing.label;
  return { ...processing, label, className };
}

function setCoachProfileEditOpen(open) {
  const form = $("#coachProfileFormCard");
  const toggle = $("#toggleCoachProfileEdit");
  if (!form || !toggle) return;
  const shouldOpen = Boolean(open);
  if (shouldOpen && form.hidden) renderCoachProfile();
  form.hidden = !shouldOpen;
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  toggle.textContent = shouldOpen ? "수정 닫기" : "프로필 수정";
  if (shouldOpen) window.setTimeout(() => $("#coachIntro")?.focus({ preventScroll: true }), 0);
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

function renderCoachFeedbackScheduleList(scheduleLessons = []) {
  const items = [...scheduleLessons].sort((left, right) => {
    const leftKey = `${coachRequestTimelineDate(left)} ${left.time || ""}`;
    const rightKey = `${coachRequestTimelineDate(right)} ${right.time || ""}`;
    return leftKey.localeCompare(rightKey, "ko");
  });
  if (!items.length) {
    return `
      <section class="tn-empty-state coach-feedback-empty" role="status">
        <strong>작성할 피드백이 없습니다</strong>
        <p>완료되지 않은 수업만 이 목록에 표시됩니다.</p>
      </section>`;
  }
  return `
    <section class="coach-feedback-list" aria-label="피드백 작성이 필요한 수업">
      ${items.map((lesson) => {
    const date = coachRequestTimelineDate(lesson);
    const cardState = coachLessonCardState(lesson);
    const round = coachScheduleRoundLabel(lesson);
    return `<button class="coach-feedback-row" type="button" ${coachScheduleLessonActionAttrs(lesson)}>
          <time>${escapeHtml(date || lesson.day || "날짜 확인")} · ${escapeHtml(lesson.time || "시간 확인")}</time>
          <strong>${escapeHtml(lesson.member || "회원")}</strong>
          <span>${escapeHtml(lesson.coach || "담당 코치")} · ${escapeHtml(round === "0/0회차" ? "회차 미연결" : round)}</span>
          <b>${escapeHtml(cardState.label)}</b>
        </button>`;
  }).join("")}
    </section>`;
}

const coachMemberChartCache = new Map();

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
  window.TennisNoteModeTransition?.warm(memberModeUrl(true));
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
  version: window.TENNIS_NOTE_RELEASE?.version || "1.0.443",
  loadedAt: new Date().toISOString(),
});
sessionStorage.setItem(
  "tennis-note-coach-runtime-version",
  window.__TENNIS_NOTE_COACH_APP_RUNTIME__.version,
);
initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);
