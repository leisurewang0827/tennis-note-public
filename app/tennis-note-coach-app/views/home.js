// 홈 요약과 앱 전체를 다시 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderCoachAccessMessage() {
  setCoachAccessMessage(state.coachAccessMessage, state.coachAccessTone || "wait");
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
        <button class="coach-mode-chip ${canonicalCoachName(state.coach?.name || state.selectedCoachName) === canonicalCoachName(coach.name) ? "is-active" : ""}" type="button" data-select-coach-mode="${escapeHtml(coach.name)}">
          <strong>${escapeHtml(coach.name)}</strong>
          <span>${escapeHtml(coach.role)} · 코치모드 생성됨</span>
        </button>`,
    )
    .join("");
  if ($("#coachModeList")) {
    $("#coachModeList").hidden = true;
    $("#coachModeList").innerHTML = markup;
  }
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

function renderTodayLessons() {
  const schedulePolicy = loadCoachSchedulePolicy();
  const ownLessons = [...ownTodayLessons()].sort(compareTodayLessonsByNearest);
  const transferredLessons = transferredTodayLessons();
  const ownMakeups = ownPendingMakeupRequests();
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
      : "오프라인 · 최근 자료만 볼 수 있으며 수업 완료는 연결 후 가능합니다.";
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
