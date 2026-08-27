// 대시보드 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderDashboard() {
  const dashboardReady = dashboardOperationalDataReady();
  const branchMembers = operationBranchMembers();
  const branchCoaches = operationBranchCoaches();
  const branchLessons = operationBranchLessons();
  const branchMakeups = operationBranchMakeupRequests();
  const branchTickets = operationBranchTickets();
  const branchBillings = operationBranchBillings();
  const todayLessonRows = adminTodayLessonRows()
    .slice(0, 5);
  $("#todayLessons").innerHTML = !dashboardReady
    ? '<p class="dashboard-loading-row" role="status">오늘 수업을 불러오는 중입니다.</p>'
    : todayLessonRows.length
      ? todayLessonRows.map(
      (lesson) => `
        <article class="lesson-item duration-${durationTone(lesson)}">
          <div class="time-chip">${lesson.time}</div>
          <div>
            <strong>${lesson.member}</strong>
            <span>${lesson.day}요일 · ${getCoachName(lesson.coachId)} · ${lessonTypeLabel(lesson)}</span>
          </div>
          ${durationBadge(lesson)}
          ${badge(lesson.status, getLessonStatusLabel(lesson))}
        </article>`,
      ).join("")
      : '<p class="empty-text">오늘 예정된 수업이 없습니다.</p>';

  const pendingMakeupCount = branchMakeups.filter((item) => ["pending", "requested", "coach_required"].includes(item.status)).length;
  const lowTicketCount = branchTickets.filter((ticket) => ticket.remaining <= 2).length;
  const pendingRecordCount = adminRecordGroups().pending.length + adminRecordGroups().issue.length;
  const pendingPaymentCount = branchBillings.filter((item) => !["paid", "cancelled", "refunded"].includes(item.status)).length;
  const unassignedRegularCount = unassignedRegularTickets().length;
  const couponNoBookingCount = couponTicketsWithoutUpcomingLesson().length;
  const reportTarget = $("#dashboardReportSummary");
  if (reportTarget) {
    reportTarget.classList.toggle("is-loading", !dashboardReady);
    reportTarget.setAttribute("aria-busy", String(!dashboardReady));
    const recordGroups = adminRecordGroups();
    const liveReportMetrics = [
      { label: "활성 회원", value: `${branchMembers.filter((member) => member.status === "active").length}명`, detail: "실서버 회원권 기준", tone: "" },
      { label: "현재 주 수업", value: `${branchLessons.length}개`, detail: "실서버 레슨표 기준", tone: "calm" },
      { label: "완료 기록", value: `${recordGroups.done.length}건`, detail: `확인 필요 ${recordGroups.pending.length + recordGroups.issue.length}건`, tone: "warning" },
      { label: "활성 코치", value: `${branchCoaches.filter((coach) => coach.status === "active").length}명`, detail: "승인된 코치 권한 기준", tone: "accent" },
    ];
    reportTarget.innerHTML = (adminDemoMode ? reportMetrics.slice(0, 4) : liveReportMetrics)
      .map(
        (item) => `
          <article>
            <span>${item.label}</span>
            <strong>${dashboardReady ? item.value : "—"}</strong>
            <small>${dashboardReady ? item.detail : "최신 자료를 불러오는 중"}</small>
          </article>`,
      )
      .join("");
  }
  renderDashboardNoticeSummary();
}

function renderDashboardPager(selector, total, page, kind, pageSize = dashboardPageSize) {
  const target = $(selector);
  if (!target) return;
  const pageCount = Math.ceil(total / pageSize);
  const currentPage = normalizeDashboardPage(total, page, pageSize);
  target.hidden = pageCount <= 1;
  target.innerHTML = pageCount <= 1
    ? ""
    : `
      <button class="dashboard-page-number pager-nav-button" type="button" data-dashboard-page="${kind}" data-dashboard-page-index="${currentPage - 1}" aria-label="이전 페이지" ${currentPage === 0 ? "disabled" : ""}>&lsaquo;</button>
      ${compactDashboardPageIndexes(pageCount, currentPage)
        .map((index) =>
          index === "ellipsis"
            ? '<span class="dashboard-page-ellipsis" aria-hidden="true">&hellip;</span>'
            : `<button class="dashboard-page-number ${index === currentPage ? "is-current" : ""}" type="button" data-dashboard-page="${kind}" data-dashboard-page-index="${index}" aria-label="${index + 1}페이지" ${index === currentPage ? 'aria-current="page"' : ""}>${index + 1}</button>`,
        )
        .join("")}
      <button class="dashboard-page-number pager-nav-button" type="button" data-dashboard-page="${kind}" data-dashboard-page-index="${currentPage + 1}" aria-label="다음 페이지" ${currentPage === pageCount - 1 ? "disabled" : ""}>&rsaquo;</button>
    `;
}
