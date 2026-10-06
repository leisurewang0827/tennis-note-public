// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || String(value || "");
}

function memberDisplayLessons(lessons = []) {
  return window.TennisNoteUiLanguage?.mergeLessonDisplaySegments?.(lessons) || lessons;
}

function memberTicketSessionSnapshot(record = {}) {
  return window.TennisNoteUiLanguage?.ticketSessionSnapshot?.(record) || {
    confirmed: false,
    adjusted: false,
    label: "기록 당시 회차 미확정",
    detail: "현재 회원권 횟수와 분리된 과거 기록입니다.",
    snapshot: null,
  };
}

function memberDisplaySegmentAttrs(lesson = {}) {
  const ids = Array.isArray(lesson.displaySegmentIds) ? lesson.displaySegmentIds : [];
  return ids.length ? ` data-lesson-segments="${escapeHtml(ids.join(","))}"` : "";
}

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function registerPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPwaInstallPrompt = event;
    updatePwaInstallButtons();
  });
  window.addEventListener("appinstalled", () => {
    deferredPwaInstallPrompt = null;
    updatePwaInstallButtons();
  });
  updatePwaInstallButtons();
}

function registerPwaServiceWorker() {
  const memberPortal = window.TennisNoteRuntimeEnvironment?.resolvePortal?.("member");
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.534",
    remoteAppUrl: memberPortal?.ok ? memberPortal.url : "",
  });
}

function nativeAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function blurActiveFormControl() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches("input, textarea, select")) return false;
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const keyboardVisible = Boolean(viewport && layoutHeight - viewport.height - viewport.offsetTop > 96);
  active.blur();
  return keyboardVisible;
}

async function installNativeBackNavigation() {
  if (nativeBackListenerReady || nativeAppPlatform() !== "android") return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  nativeBackListenerReady = true;
  await appPlugin.addListener("backButton", async () => {
    if (blurActiveFormControl()) return;
    if (!$("#noticeDialog")?.hidden) {
      closeNotice(false);
      return;
    }
    if (closeVisibleAppModal()) return;
    if (closeVisibleAppSheet(false, { immediate: true })) return;
    if (purchaseFlowState().open) {
      closeMembershipPurchaseFlow();
      return;
    }
    if (!$("#kakaoInquiryModal")?.hidden) {
      closeKakaoInquiryModal();
      return;
    }
    if (!$("#memberEnrollmentModal")?.hidden) {
      closeMemberEnrollmentModal();
      return;
    }
    if (!$("#appScreen")?.hidden && activeMemberViewId() !== "homeView") {
      setView("homeView", { replaceHistory: true });
      return;
    }
    const minimized = await appPlugin.minimizeApp?.().then(() => true).catch(() => false);
    if (!minimized) await appPlugin.exitApp?.().catch(() => undefined);
  });
}

function memberDayCoaches(day, policy, scheduleLessons = []) {
  const working = policy.coaches.filter((coach) => (
    memberCoachMatchesAssignment(coach)
    && (coach.workBlocks || []).some((block) => block.days.includes(day))
  ));
  const lessonCoaches = scheduleLessons
    .filter((lesson) => (
      lesson.day === day
      && lesson.status !== "available"
      && isOwnMemberScheduleLesson(lesson)
    ))
    .map((lesson) => memberLessonCoach(lesson, policy));
  const unique = working
    .concat(lessonCoaches)
    .filter((coach) => memberCoachMatchesAssignment(coach))
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index)
    .map((coach) => ({ ...coach, laneOrder: memberScheduleLaneOrder(coach) }));
  return window.TennisNoteScheduleLanes?.sortByLaneOrder?.(unique)
    || unique.sort((a, b) => Number(a.laneOrder) - Number(b.laneOrder));
}

function memberOperatingWindows(day, policy) {
  const merged = mergeMemberScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
  const breaks = (policy.breakRules || [])
    .filter((rule) => rule.days?.includes(day))
    .map((rule) => ({ start: minutesFromTime(rule.start), end: minutesFromTime(rule.end), label: rule.label || "수업 없음" }));
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

function curriculumYoutubeVideoId(value = "") {
  try {
    const url = new URL(String(value || "").trim(), window.location.origin);
    const host = url.hostname.replace(/^www\./u, "").toLowerCase();
    let candidate = "";
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      candidate = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/u)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/u.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function playCurriculumVideo(button) {
  if (!memberCurriculumUI.authorized()) return;
  const videoId = String(button?.dataset?.playCurriculumVideo || "");
  if (!/^[A-Za-z0-9_-]{11}$/u.test(videoId)) return;
  const item = button.closest(".curriculum-video-item");
  if (!item) return;
  closeCurriculumPlayer();
  const title = String(button.dataset.curriculumVideoTitle || "커리큘럼 영상");
  const iframe = document.createElement("iframe");
  iframe.className = "curriculum-video-frame";
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`);
  for (const key of ["start", "end"]) {
    const value = button.dataset[key === "start" ? "videoStart" : "videoEnd"];
    if (/^\d+(?:\.\d+)?$/.test(value || "")) url.searchParams.set(key, value);
  }
  url.searchParams.set("enablejsapi", "1");
  iframe.src = url.href;
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  const fallback = document.createElement("a");
  fallback.className = "curriculum-video-fallback";
  fallback.href = `https://www.youtube.com/watch?v=${videoId}`;
  if (url.searchParams.has("start")) fallback.href += `&t=${url.searchParams.get("start")}`;
  if (url.searchParams.has("end")) fallback.href += `&end=${url.searchParams.get("end")}`;
  fallback.target = "_blank";
  fallback.rel = "noreferrer";
  fallback.textContent = "YouTube에서 보기";
  const box = document.createElement("div");
  box.className = "curriculum-player";
  const status = document.createElement("p");
  status.className = "curriculum-player-status";
  status.setAttribute("role", "status");
  status.textContent = navigator.onLine ? "영상을 불러오는 중입니다." : "온라인 연결 후 다시 재생해 주세요.";
  const close = document.createElement("button");
  close.type = "button"; close.className = "small-button"; close.textContent = "영상 닫기";
  close.dataset.closeCurriculumVideo = "true";
  close.addEventListener("click", () => { closeCurriculumPlayer(); memberCurriculumUI.activity(memberCurriculumActivity()); button.focus(); });
  const timer = setTimeout(() => {
    if (curriculumPlayer?.frame === iframe) status.textContent = "영상을 확인하지 못했습니다. 닫고 다시 시도하거나 원본에서 확인해 주세요.";
  }, 12000);
  curriculumPlayer = { frame: iframe, box, button, timer, status };
  iframe.addEventListener("load", () => {
    if (curriculumPlayer?.frame !== iframe) return;
    clearTimeout(timer); status.textContent = "영상 창이 열렸습니다. 재생이 안 되면 원본에서 확인해 주세요.";
  });
  iframe.addEventListener("error", () => {
    if (curriculumPlayer?.frame !== iframe) return;
    clearTimeout(timer); status.textContent = "영상을 불러오지 못했습니다. 닫고 다시 시도해 주세요.";
  });
  button.hidden = true; box.append(status, iframe, close, fallback); item.append(box);
  memberCurriculumUI.activity(memberCurriculumActivity());
}

function paymentRedirectUrl() {
  if (nativeAppPlatform() !== "web") return "com.tennisclubhouse.tennisnote://payment";
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

function setView(viewId, options = {}) {
  if (!viewId || !$(`#${viewId}`)) return;
  if (document.body.dataset.activeMemberView === "curriculumView" && viewId !== "curriculumView") leaveMemberCurriculum();
  if (document.body.dataset.activeMemberView !== viewId) closeJournalDetail();
  if (viewId === "scheduleView" && !state.memberScheduleModeTouched) {
    state.memberScheduleMode = "mine";
    state.memberScheduleFullView = false;
  }
  const enteringHome = viewId === "homeView" && document.body.dataset.activeMemberView !== viewId;
  document.body.dataset.activeMemberView = viewId;
  document.body.classList.toggle(
    "purchase-flow-open",
    viewId === "shopView" && Boolean(purchaseFlowState().open),
  );
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  const screenTitles = {
    homeView: "오늘",
    scheduleView: "시간표",
    lessonLogView: "운동일지",
    curriculumView: "커리큘럼",
    shopView: "회원권",
    profileView: "내 정보",
  };
  if ($("#memberScreenTitle")) $("#memberScreenTitle").textContent = screenTitles[viewId] || "Tennis Note";
  renderActiveMemberView(viewId);
  if (enteringHome && state.dataMode === "live") void refreshMemberLiveSchedule();
  if (viewId === "curriculumView") enterMemberCurriculum();
  jumpToTop();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  const nextState = { ...historyState, tennisNoteMode: "member", tennisNoteView: viewId };
  delete nextState.tennisNoteModal;
  delete nextState.tennisNoteSheet;
  delete nextState.tennisNotePurchase;
  if (options.pushHistory && historyState.tennisNoteView !== viewId) history.pushState(nextState, "", window.location.href);
  else if (!historyState.tennisNoteView || options.replaceHistory) history.replaceState(nextState, "", window.location.href);
}

function collectNtrpSurvey() {
  const answers = {};
  const scores = ntrpSurveyQuestions.map((question) => {
    const selected = document.querySelector(`input[name="ntrp-${question.id}"]:checked`);
    const score = Number(selected?.value || 2.5);
    answers[question.id] = score;
    return score;
  });
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const rounded = Math.round(average * 2) / 2;
  return { answers, level: String(Math.max(1.5, Math.min(4, rounded)).toFixed(1)), average };
}

function calculateNtrpFromSurvey() {
  const survey = collectNtrpSurvey();
  state.profile.selfNtrp = survey.level;
  state.profile.ntrpSurvey = survey.answers;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  state.ticketHistory.unshift({ text: `질문 기준 내 테니스 수준 ${survey.level} 계산 완료`, tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
}

async function retryTransientNetwork(operation, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function beginOAuthLogin(provider) {
  if (oauthLoginInFlightProvider) return false;
  oauthLoginInFlightProvider = provider || "간편";
  $$('[data-login-provider]').forEach((button) => {
    button.dataset.oauthDisabledBefore = button.disabled ? "true" : "false";
    button.disabled = true;
    button.setAttribute("aria-busy", button.dataset.loginProvider === provider ? "true" : "false");
  });
  return true;
}

function finishOAuthLogin() {
  oauthLoginInFlightProvider = "";
  $$('[data-login-provider]').forEach((button) => {
    const disabledBefore = button.dataset.oauthDisabledBefore;
    if (disabledBefore) button.disabled = disabledBefore === "true";
    delete button.dataset.oauthDisabledBefore;
    button.removeAttribute("aria-busy");
  });
  syncAuthProviderCapabilityControls();
}

function setEmailAuthStatus(message = "", tone = "") {
  const status = $("#memberEmailLoginStatus");
  if (!status) return;
  status.textContent = message;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function emailPasswordAuthUiEnabled() {
  return window.TennisNoteRuntimeEnvironment?.features?.emailPasswordAuthUi === true;
}

function setEmailAuthMode(mode = "login", options = {}) {
  if (!emailPasswordAuthUiEnabled()) {
    const panel = $("#memberEmailAuthPanel");
    if (panel) {
      panel.hidden = true;
      panel.inert = true;
      panel.setAttribute("aria-hidden", "true");
    }
    setEmailAuthStatus(emailAuthUiUnavailableMessage, "alert");
    return false;
  }
  const nextMode = ["login", "signup", "recovery"].includes(mode) ? mode : "login";
  emailAuthMode = nextMode;
  const panel = $("#memberEmailAuthPanel");
  const tabs = $("#memberEmailAuthTabs");
  const summary = $("#memberEmailAuthSummary");
  const forms = {
    login: $("#memberEmailLoginForm"),
    signup: $("#memberEmailSignupForm"),
    recovery: $("#memberPasswordRecoveryForm"),
  };
  if (panel) panel.open = true;
  if (tabs) tabs.hidden = nextMode === "recovery";
  if (summary) summary.textContent = nextMode === "recovery" ? "새 비밀번호 설정" : "이메일 로그인·가입";
  Object.entries(forms).forEach(([key, form]) => {
    if (form) form.hidden = key !== nextMode;
  });
  $$('[data-email-auth-mode]').forEach((button) => {
    const selected = button.dataset.emailAuthMode === nextMode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  if (Object.prototype.hasOwnProperty.call(options, "message")) {
    setEmailAuthStatus(options.message, options.tone || "");
  } else if (options.clearStatus !== false) {
    setEmailAuthStatus();
  }
  if (options.focus === false) return;
  const focusTarget = forms[nextMode]?.querySelector("input:not([type=checkbox])");
  window.requestAnimationFrame(() => focusTarget?.focus());
}

function memberCurriculumActivity() {
  return {
    lessonOpen: Boolean($("#curriculumView details.curriculum-action-details[open], #curriculumView details.curriculum-step[open], #curriculumView details.curriculum-library-disclosure[open]")),
    // Loading, paused and fullscreen frames also retain their document until explicitly closed.
    videoPlaying: Boolean(curriculumPlayer?.frame?.isConnected),
  };
}

function leaveMemberCurriculum() {
  closeCurriculumPlayer();
  $$("#curriculumView details[open]").forEach(details => { details.open = false; });
  memberCurriculumUI.activity({ lessonOpen: false, videoPlaying: false });
}

function enterMemberCurriculum() {
  if (document.body.dataset.activeMemberView === "curriculumView" && !document.hidden) {
    renderCurriculum();
    void memberCurriculumUI.enter();
  }
}

function closeCurriculumPlayer() {
  if (!curriculumPlayer) return;
  const { frame, box, button, timer } = curriculumPlayer;
  clearTimeout(timer);
  if (document.fullscreenElement === frame) void document.exitFullscreen?.().catch(() => {});
  frame.remove(); box.remove(); button.hidden = false;
  curriculumPlayer = null;
}
