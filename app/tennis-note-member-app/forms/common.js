// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || String(value || "");
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
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.438",
    remoteAppUrl: "https://tennisnote-app.pages.dev/",
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
  const videoId = String(button?.dataset?.playCurriculumVideo || "");
  if (!/^[A-Za-z0-9_-]{11}$/u.test(videoId)) return;
  const item = button.closest(".curriculum-video-item");
  if (!item) return;
  const title = String(button.dataset.curriculumVideoTitle || "커리큘럼 영상");
  const iframe = document.createElement("iframe");
  iframe.className = "curriculum-video-frame";
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  const fallback = document.createElement("a");
  fallback.className = "curriculum-video-fallback";
  fallback.href = `https://www.youtube.com/watch?v=${videoId}`;
  fallback.target = "_blank";
  fallback.rel = "noreferrer";
  fallback.textContent = "YouTube에서 보기";
  item.replaceChildren(iframe, fallback);
}

function paymentRedirectUrl() {
  if (nativeAppPlatform() !== "web") return "com.tennisclubhouse.tennisnote://payment";
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

function setView(viewId, options = {}) {
  if (!viewId || !$(`#${viewId}`)) return;
  if (viewId === "scheduleView" && !state.memberScheduleModeTouched) {
    state.memberScheduleMode = "mine";
    state.memberScheduleFullView = false;
  }
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
}

function setEmailAuthStatus(message = "", tone = "") {
  const status = $("#memberEmailLoginStatus");
  if (!status) return;
  status.textContent = message;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function setEmailAuthMode(mode = "login", options = {}) {
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
