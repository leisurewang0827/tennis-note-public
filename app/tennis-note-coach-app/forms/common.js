// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachStatusLabel(group, value, fallback = "") {
  return window.TennisNoteUiLanguage?.statusLabel?.(group, value, fallback) || fallback || value || "";
}

function coachDisplayLessons(lessons = []) {
  return window.TennisNoteUiLanguage?.mergeLessonDisplaySegments?.(lessons) || lessons;
}

function coachTicketSessionSnapshot(record = {}) {
  return window.TennisNoteUiLanguage?.ticketSessionSnapshot?.(record) || {
    confirmed: false,
    adjusted: false,
    label: "기록 당시 회차 미확정",
    detail: "현재 회원권 횟수와 분리된 과거 기록입니다.",
    snapshot: null,
  };
}

function coachDisplaySegmentAttrs(lesson = {}) {
  const ids = Array.isArray(lesson.displaySegmentIds) ? lesson.displaySegmentIds : [];
  return ids.length ? ` data-lesson-segments="${escapeHtml(ids.join(","))}"` : "";
}

function registerPwaServiceWorker() {
  const coachPortal = window.TennisNoteRuntimeEnvironment?.resolvePortal?.("coach");
  window.TennisNoteReleaseUpdater?.start({
    manifestUrl: "../release.json",
    workerUrl: "./service-worker.js?v=1.0.471",
    remoteAppUrl: coachPortal?.ok ? coachPortal.url : "",
  });
}

function setView(viewId, options = {}) {
  if (!viewId || !$("#" + viewId)) return;
  if (viewId !== "fullScheduleView" && state.bookingMakeupEntitlementId) {
    if (state.coachQuickAdd?.makeupEntitlementId) state.coachQuickAdd = null;
    clearCoachMakeupBooking();
  }
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

function refreshCoachMemberChartBodies(userId = "") {
  $$('[data-member-chart-body]').filter((target) => String(target.dataset.memberUserId || "") === String(userId)).forEach((target) => {
    target.innerHTML = coachMemberChartBodyMarkup(
      target.dataset.memberUserId || "",
      target.dataset.memberName || "",
      Number(target.dataset.memberChartLimit) || 5,
    );
  });
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

function activeViewField(selector) {
  return document.querySelector(`.view.is-active ${selector}`) || document.querySelector(selector);
}
