// 홈 화면과 앱 전체를 다시 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMemberHomeOverview() {
  const grid = $("#homeSummaryGrid");
  const onboarding = $("#homeOnboarding");
  if (!grid || !onboarding) return;

  const currentTickets = currentLiveTickets();
  const nextTickets = upcomingLiveTickets();
  const ticket = currentTickets[0] || nextTickets[0] || null;
  const hasLowTicket = currentTickets.some((item) => Number(item.remaining) <= 2);
  const upcoming = upcomingMemberLessons(24);
  const latestFeedback = latestMemberFeedbackLog();
  const pendingFeedback = pendingMemberFeedbackLog();
  const hasNewFeedback = Boolean(latestFeedback && latestFeedback.id !== state.lastReadFeedbackId);
  const paymentPending = !currentTickets.length && nextTickets.some((item) => item.status === "pending_payment");
  const ticketRefreshing = state.dataMode === "live" && state.member && /확인 중/.test(state.ticketSyncStatus?.text || "");
  const lessonRefreshing = state.dataMode === "live" && state.member && !state.liveLessonsLoaded;
  const refreshing = Boolean(ticketRefreshing || lessonRefreshing);
  const syncFailed = state.ticketSyncStatus?.tone === "alert";
  const empty = !refreshing && !syncFailed && !ticket && !upcoming.length && !latestFeedback && !pendingFeedback;

  grid.hidden = empty;
  onboarding.hidden = !empty;
  if (empty) {
    $(".home-change-button")?.setAttribute("hidden", "");
    return;
  }

  const lessonCard = $("#homeNextLessonCard");
  const ticketCard = $("#homeTicketCard");
  const feedbackCard = $("#homeFeedbackCard");
  const showLessonCard = refreshing || Boolean(ticket) || upcoming.length > 0;
  const showFeedbackCard = hasNewFeedback || Boolean(pendingFeedback);

  lessonCard.hidden = !showLessonCard;
  ticketCard.hidden = false;
  feedbackCard.hidden = !showFeedbackCard;
  grid.dataset.cardCount = String([lessonCard, ticketCard, feedbackCard].filter((card) => !card.hidden).length);

  if (refreshing) {
    $("#nextLessonDate").textContent = "일정 확인 중";
    $("#followingLessonDate").textContent = "서버에서 최신 수업을 불러오고 있습니다.";
    $("#homeScheduleAction").textContent = "시간표";
  } else if (upcoming.length) {
    $("#nextLessonDate").textContent = scheduleSummaryText(upcoming[0], "예정 없음");
    const following = scheduleSummaryText(upcoming[1], "");
    $("#followingLessonDate").textContent = [upcoming[0]?.coach || "", following ? `다음 ${following}` : ""].filter(Boolean).join(" · ");
    $("#homeScheduleAction").textContent = "시간표";
  } else if (ticket) {
    $("#nextLessonDate").textContent = paymentPending ? "결제 확인 중" : "다음 수업 예약";
    $("#followingLessonDate").textContent = paymentPending
      ? "결제가 확인되면 예약 가능한 시간이 열립니다."
      : "가능한 시간에서 수업을 선택해 주세요.";
    $("#homeScheduleAction").textContent = paymentPending ? "결제 확인" : "예약하기";
  }
  const upcomingTarget = $("#homeUpcomingLessons");
  if (upcomingTarget) upcomingTarget.innerHTML = refreshing ? "" : memberHomeUpcomingLessonsMarkup(upcoming);
  if ($("#homeScheduleAction")) {
    $("#homeScheduleAction").dataset.summaryAction = paymentPending ? "shop" : "schedule";
  }

  if (ticket) {
    $("#remainingCount").textContent = currentTickets.length > 1 ? `${currentTickets.length}개` : `${ticket.remaining}회`;
    $("#ticketStatus").textContent = currentTickets.length > 1
      ? "회원권마다 잔여횟수와 다음 수업을 따로 확인하세요."
      : `${ticket.title} · ${ticket.statusLabel}`;
    $("#homeTicketAction").textContent = hasLowTicket ? "연장하기" : "회원권";
    ticketCard.classList.toggle("alert", hasLowTicket);
  } else if (refreshing) {
    $("#remainingCount").textContent = "확인 중";
    $("#ticketStatus").textContent = "서버에서 최신 회원권을 불러오고 있습니다.";
    $("#homeTicketAction").textContent = "회원권";
    ticketCard.classList.remove("alert");
  } else if (syncFailed) {
    $("#remainingCount").textContent = "확인 필요";
    $("#ticketStatus").textContent = "회원권 정보를 불러오지 못했습니다.";
    $("#homeTicketAction").textContent = "다시 확인";
    ticketCard.classList.add("alert");
  } else {
    $("#remainingCount").textContent = "구매 필요";
    $("#ticketStatus").textContent = "수업 시작 전 회원권이 필요합니다.";
    $("#homeTicketAction").textContent = "회원권 구매";
    ticketCard.classList.add("alert");
  }

  const feedback = hasNewFeedback ? latestFeedback : pendingFeedback;
  if (feedback) {
    const feedbackDate = feedback.journalDate || String(feedback.submittedAt || "").slice(0, 10);
    $("#homeFeedbackEyebrow").textContent = hasNewFeedback ? "새 코치 피드백" : "코치 피드백";
    $("#pendingNoteCount").textContent = hasNewFeedback ? lessonReviewTitle(feedback) : "등록 중";
    $("#lessonRecordNote").textContent = feedbackDate;
    $("#homeFeedbackAction").textContent = hasNewFeedback ? "코멘트 보기" : "운동일지";
    feedbackCard.classList.toggle("wait", !hasNewFeedback);
  }
  const changeButton = $(".home-change-button");
  if (changeButton) changeButton.hidden = paymentPending || currentScheduledLessonsForChange().length === 0;
}

function renderTodayActions() {
  const target = $("#todayActionCards");
  if (!target) return;
  const nextLesson = nextMemberLesson();
  const nextLessonTicket = liveTicketForLesson(nextLesson);
  const currentTicketSummary = liveTicketAggregate();
  const nextLessonRemaining = nextLessonTicket
    ? Math.max(0, Number(nextLessonTicket.remaining) || 0)
    : currentTicketSummary.count ? currentTicketSummary.remaining : state.remaining;
  const latestLog = state.lessonLogs[0];
  const pendingLogCount = state.lessonLogs.filter((log) => log.status === "coach_pending").length;
  const makeupCount = state.makeupRequests.filter((request) => request.rawStatus === "pending").length;
  const lowTicket = currentLiveTickets().length
    ? currentLiveTickets().some((ticket) => Number(ticket.remaining) <= 2)
    : state.remaining <= 2;
  const curriculum = activeCurriculumStep();
  const lessonLabel = nextLesson
    ? `${nextLesson.day} ${nextLesson.time} · ${nextLesson.coach}`
    : "예정된 수업 없음";
  const nextLessonMeta = nextLesson?.oneDayBooking
    ? "원데이 예약 완료 · 회원권 차감 없음"
    : nextLesson ? `${nextLesson.type} · 연결 회원권 잔여 ${nextLessonRemaining}회` : "관리자에게 시간표 확인이 필요합니다.";
  const canChangeLesson = currentScheduledLessonsForChange().length > 0 || memberMakeupDueLessons().length > 0;
  target.innerHTML = `
    <article class="today-card primary">
      <div>
        <span>다음 수업</span>
        <strong>${lessonLabel}</strong>
        <small>${escapeHtml(nextLessonMeta)}</small>
        <small>다음 커리큘럼: ${curriculum.title}</small>
      </div>
      <button class="primary-button" type="button" data-home-action="curriculum">커리큘럼 보기</button>
    </article>
    ${canChangeLesson ? `<article class="today-card">
      <div>
        <span>수업 변경</span>
        <strong>${makeupCount ? `${makeupCount}건 대기` : "신청 가능"}</strong>
        <small>기존 수업을 가능한 시간으로 옮겨 요청합니다.</small>
      </div>
      <button class="small-button" type="button" data-home-action="makeup">시간표 보기</button>
    </article>` : `<article class="today-card onboarding-card">
      <div>
        <span>시작하기</span>
        <strong>회원권 구매 또는 상담</strong>
        <small>회원권을 선택하거나 카카오채널로 수업을 문의해 주세요.</small>
      </div>
      <button class="primary-button" type="button" data-home-action="shop">회원권 보기</button>
    </article>`}
    <article class="today-card ${pendingLogCount ? "wait" : ""}">
      <div>
        <span>피드백</span>
        <strong>${latestLog ? lessonReviewTitle(latestLog) : "확인할 피드백 없음"}</strong>
        <small>${pendingLogCount ? `${pendingLogCount}건 대기` : "코치 코멘트 확인"}</small>
      </div>
      <button class="small-button" type="button" data-home-action="ticket">코멘트 보기</button>
    </article>
    <article class="today-card ${lowTicket ? "alert" : ""}">
      <div>
        <span>회원권</span>
        <strong>${lowTicket ? "재등록 필요" : "정상 이용중"}</strong>
        <small>${lowTicket ? "잔여 2회 이하입니다." : "잔여횟수가 충분합니다."}</small>
      </div>
      <button class="small-button" type="button" data-home-action="shop">회원권 보기</button>
    </article>
  `;
}

function renderSelects() {
  const previousAbsence = state.selectedMemberChangeSourceId || $("#absenceLesson")?.value;
  const previousMakeup = $("#makeupSlot")?.value;
  const sourceLessons = currentScheduledLessonsForChange();
  const regularOptions = sourceLessons
    .map((lesson) => {
      if (lesson.regularInitialBooking) {
        return `<option value="${lesson.id}">${lesson.resumePausedTicket ? "휴회 복귀 시간 선택" : "첫 정규시간 설정"} · ${lesson.ticketTitle} · 주 ${lesson.frequencyPerWeek}회</option>`;
      }
      if (lesson.couponBooking) return `<option value="${lesson.id}">쿠폰 예약 · ${lesson.ticketTitle} · 잔여 ${lesson.remaining}회</option>`;
      return `<option value="${lesson.id}">${lesson.status === "makeup_due" ? "보강 필요 · " : ""}${lesson.day} ${lesson.time} · ${lesson.coach}</option>`;
    })
    .join("");
  const logOptions = memberLessons()
    .map((lesson) => `<option value="${lesson.id}">${lesson.day} ${lesson.time} · ${lesson.coach} · ${lesson.type}</option>`)
    .join("");

  $("#absenceLesson").innerHTML = regularOptions || "<option>변경 가능한 기존 수업 없음</option>";
  $("#logLesson").innerHTML = logOptions || "<option>기록할 수업 없음</option>";
  if (previousAbsence && [...$("#absenceLesson").options].some((option) => option.value === previousAbsence)) {
    $("#absenceLesson").value = previousAbsence;
  }
  state.selectedMemberChangeSourceId = $("#absenceLesson")?.value || "";
  const selectedSource = sourceLessons.find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const scheduleLoadState = activeMemberScheduleLoadState();
  const candidateLoadState = memberChangeCandidateUiState(selectedSource);
  const loadState = scheduleLoadState !== "ready"
    ? scheduleLoadState
    : ["loading", "error"].includes(candidateLoadState) ? candidateLoadState : "ready";
  const availableOptions = loadState === "ready" ? memberAvailableSlotsForSelectedLesson()
    .map((lesson) => `<option value="${lesson.id}">${escapeHtml(lessonDateTimeLabel(lesson))} · ${escapeHtml(memberCoachShortName(lesson.coach))} 코치</option>`)
    .join("") : "";
  $("#makeupSlot").innerHTML = availableOptions
    ? `<option value="">시간을 선택해 주세요</option>${availableOptions}`
    : `<option value="">${loadState === "loading" ? "변경 가능한 시간 확인 중" : loadState === "error" ? "시간표 불러오기 실패" : "가능한 변경 시간 없음"}</option>`;
  if (previousMakeup && [...$("#makeupSlot").options].some((option) => option.value === previousMakeup)) {
    $("#makeupSlot").value = previousMakeup;
  } else {
    $("#makeupSlot").value = "";
  }
  const isMakeupDue = selectedSource?.status === "makeup_due";
  const isCouponBooking = Boolean(selectedSource?.couponBooking);
  const isRegularInitialBooking = Boolean(selectedSource?.regularInitialBooking);
  const isPausedResumeBooking = Boolean(selectedSource?.resumePausedTicket);
  if ($("#changeModalTitle")) $("#changeModalTitle").textContent = isMakeupDue ? "보강 시간 선택" : isCouponBooking ? "쿠폰 수업 예약" : "수업 변경 요청";
  if ($("#changeSourceStepLabel")) $("#changeSourceStepLabel").textContent = isMakeupDue
    ? "1. 보강할 수업"
    : isCouponBooking ? "1. 사용할 쿠폰" : "1. 변경할 수업";
  renderMemberChangeReasonControl(selectedSource, null);
  if ($("#requestMakeup")) $("#requestMakeup").textContent = memberChangeSubmitLabel(selectedSource, null);
  if (isRegularInitialBooking) {
    if ($("#changeModalTitle")) $("#changeModalTitle").textContent = isPausedResumeBooking ? "휴회 복귀 시간 선택" : "첫 정규시간 설정";
    renderMemberChangeReasonControl(selectedSource, null);
    if ($("#requestMakeup")) $("#requestMakeup").textContent = isPausedResumeBooking ? "복귀하고 시간 확정" : "수업시간 확정";
    if ($("#changeSourceStepLabel")) $("#changeSourceStepLabel").textContent = isPausedResumeBooking ? "1. 복귀할 회원권" : "1. 설정할 회원권";
  }
}

function renderMakeupDueBanner() {
  const banner = $("#makeupDueBanner");
  const dueLessons = memberMakeupDueLessons();
  const couponTickets = memberBookableCouponTickets();
  const canChangeLesson = dueLessons.length > 0 || currentScheduledLessonsForChange().length > 0;
  const homeChangeButton = $(".home-change-button");
  if (homeChangeButton) homeChangeButton.hidden = !canChangeLesson;
  if ($("#homeChangeLabel")) $("#homeChangeLabel").textContent = dueLessons.length ? `보강 시간 선택 (${dueLessons.length})` : couponTickets.length ? "쿠폰 수업 예약" : "수업 변경";
  if (!banner) return;
  banner.hidden = dueLessons.length === 0;
  if (!dueLessons.length) return;
  const nearest = [...dueLessons].sort((left, right) => `${left.lessonDate}${left.time}`.localeCompare(`${right.lessonDate}${right.time}`))[0];
  if ($("#makeupDueTitle")) $("#makeupDueTitle").textContent = dueLessons.length > 1 ? `보강할 수업 ${dueLessons.length}건` : "보강 시간을 선택해 주세요";
  if ($("#makeupDueDetail")) $("#makeupDueDetail").textContent = `${nearest.lessonDate} ${nearest.day} ${nearest.time} 불참 · ${nearest.reason}`;
}

function renderListPager(targetId, type, currentPage, total) {
  const target = $(`#${targetId}`);
  if (!target) return;
  if (total <= listPageSize) {
    target.innerHTML = "";
    return;
  }
  const totalPages = pageCount(total);
  const pageButtons = Array.from({ length: totalPages }, (_, index) => `
    <button class="page-number ${index === currentPage ? "is-current" : ""}" type="button" data-page-list="${type}" data-page-index="${index}" ${index === currentPage ? "aria-current=\"page\"" : ""}>${index + 1}</button>`).join("");
  target.innerHTML = `
    <span>현재</span>
    <div class="page-number-row">${pageButtons}</div>`;
}

function renderPendingApprovalGate() {
  const pending = isApprovalPending();
  const gate = $("#pendingApprovalGate");
  document.body.classList.toggle("member-pending-approval", pending);
  if (gate) gate.hidden = !pending;
  const message = $("#pendingApprovalMessage");
  if (message && pending) {
    message.textContent = `${state.member?.name || "회원"}님 계정은 현재 이용 확인이 필요합니다. 고객지원으로 문의해 주세요.`;
  }
}

function renderAll() {
  renderProfile();
  renderTodayActions();
  renderSchedule();
  renderSelects();
  renderMakeupDueBanner();
  renderJournalMode();
  renderAvailableSlots();
  renderRequests();
  renderLessonLogs();
  renderCurriculum();
    renderTickets();
  renderPracticeLogs();
  renderJournalCalendar();
  renderJournalActivitySummary();
  renderProducts();
  renderPendingApprovalGate();
  renderMemberHomeOverview();
  saveSnapshot();
}

function renderActiveMemberView(viewId = activeMemberViewId()) {
  renderProfile();
  renderPendingApprovalGate();

  if (viewId === "homeView") {
    renderMakeupDueBanner();
    renderMemberHomeOverview();
  } else if (viewId === "scheduleView") {
    void memberScheduleRevisionWatcher?.check?.();
    renderSchedule();
    renderAvailableSlots();
    renderRequests();
  } else if (viewId === "lessonLogView") {
    renderJournalMode();
    renderLessonLogs();
    renderPracticeLogs();
    renderJournalCalendar();
    renderJournalActivitySummary();
  } else if (viewId === "curriculumView") {
    renderCurriculum();
  } else if (viewId === "shopView") {
    renderTickets();
    renderProducts();
  }

  saveSnapshot();
}

function renderMemberConnectivityStatus(reconnected = false) {
  const status = $("#memberConnectivityStatus");
  const message = $("#memberConnectivityMessage");
  if (!status || !message) return;
  window.clearTimeout(memberConnectivityHideTimer);
  const online = window.TennisNoteDataClient?.isOnline?.() !== false;
  if (!online) {
    status.hidden = false;
    status.dataset.tone = "offline";
    message.textContent = "오프라인 · 최근 저장된 자료를 보고 있습니다.";
    return;
  }
  if (!reconnected) {
    status.hidden = true;
    status.dataset.tone = "";
    message.textContent = "";
    return;
  }
  status.hidden = false;
  status.dataset.tone = "online";
  message.textContent = "인터넷 연결 복구 · 최신 자료를 확인했습니다.";
  memberConnectivityHideTimer = window.setTimeout(() => {
    status.hidden = true;
  }, 2500);
}
