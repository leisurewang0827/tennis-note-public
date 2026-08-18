// 수업기록 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderRecordFilters(records = []) {
  const coachSelect = $("#recordCoachFilter");
  if (coachSelect) {
    const availableCoachIds = new Set(records.map((record) => record.coachId).filter(Boolean));
    coachSelect.innerHTML = [
      '<option value="all">전체 코치</option>',
      ...coaches
        .filter((coach) => availableCoachIds.has(coach.id))
        .map((coach) => `<option value="${escapeHtml(coach.id)}">${escapeHtml(coach.name)}</option>`),
    ].join("");
    if (state.recordCoachFilter !== "all" && !availableCoachIds.has(state.recordCoachFilter)) {
      state.recordCoachFilter = "all";
    }
    coachSelect.value = state.recordCoachFilter;
  }
  const pendingTypeSelect = $("#recordPendingTypeFilter");
  if (pendingTypeSelect) {
    pendingTypeSelect.hidden = state.recordFilter !== "pending";
    pendingTypeSelect.value = state.recordPendingType;
  }
}

function renderNotes() {
  const target = $("#recordAuditRows");
  if (!target) return;
  const groups = adminRecordGroups();
  const activeFilter = ["pending", "feedback", "done", "issue"].includes(state.recordFilter) ? state.recordFilter : "pending";
  state.recordFilter = activeFilter;
  if (!["all", "lesson", "payment", "makeup", "feedback"].includes(state.recordPendingType)) state.recordPendingType = "all";
  if (!state.recordCoachFilter) state.recordCoachFilter = "all";
  if (typeof state.recordSearch !== "string") state.recordSearch = "";

  renderRecordFilters(Object.values(groups).flat());
  if ($("#recordSearch")) $("#recordSearch").value = state.recordSearch;
  const visibleGroups = Object.fromEntries(Object.entries(groups).map(([key, records]) => [
    key,
    state.recordCoachFilter === "all" ? records : records.filter((record) => record.coachId === state.recordCoachFilter),
  ]));

  $("#recordPendingCount").textContent = `${visibleGroups.pending.length}건`;
  $("#recordFeedbackCount").textContent = `${visibleGroups.feedback.length}건`;
  $("#recordDoneCount").textContent = `${visibleGroups.done.length}건`;
  $("#recordIssueCount").textContent = `${visibleGroups.issue.length}건`;
  $$("[data-record-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.recordFilter === activeFilter));

  const searchQuery = state.recordSearch.trim().toLowerCase();
  const visibleRecords = visibleGroups[activeFilter].filter((record) => (
    activeFilter !== "pending"
    || state.recordPendingType === "all"
    || record.pendingType === state.recordPendingType
  )).filter((record) => (
    !searchQuery
    || [record.member, record.title, record.coachName, record.source]
      .some((value) => String(value || "").toLowerCase().includes(searchQuery))
  ));
  const recordPageSize = 20;
  state.recordPage = normalizeDashboardPage(visibleRecords.length, state.recordPage, recordPageSize);
  const pageStart = state.recordPage * recordPageSize;
  const pageRecords = visibleRecords.slice(pageStart, pageStart + recordPageSize);
  const summary = $("#recordResultSummary");
  if (summary) {
    const first = visibleRecords.length ? pageStart + 1 : 0;
    const last = Math.min(pageStart + recordPageSize, visibleRecords.length);
    summary.textContent = `전체 ${visibleRecords.length}건 · ${first}-${last}건 표시`;
  }
  renderDashboardPager("#recordAuditPager", visibleRecords.length, state.recordPage, "records", recordPageSize);
  target.innerHTML = pageRecords
    .map(
      (record) => `
        <article class="record-audit-card ${record.group} ${record.priority === "urgent" ? "urgent" : ""}">
          <div>
            <span>${escapeHtml(record.source)} · ${escapeHtml(record.coachName || "미배정")}</span>
            <strong>${escapeHtml(record.member)} · ${escapeHtml(record.title)}</strong>
            ${record.urgentReason ? `<em class="record-urgent-reason">${escapeHtml(record.urgentReason)}</em>` : ""}
            <p>${escapeHtml(record.detail)}</p>
            <small>${escapeHtml(record.subDetail)}</small>
          </div>
          <aside>
            ${recordStatusBadge(record)}
            ${record.memberId ? `<button class="small-button" type="button" data-record-member-id="${escapeHtml(record.memberId)}" data-record-ticket-id="${escapeHtml(record.ticketId || "")}" aria-label="${escapeHtml(`${record.member} · ${record.title} · ${record.actionLabel}`)}">${escapeHtml(record.actionLabel)}</button>` : record.actionable ? `<button class="small-button" type="button" data-open-lesson-record="${escapeHtml(record.lessonId)}" aria-label="${escapeHtml(`${record.member} · ${record.title} · ${record.coachName || "코치 미배정"} · ${record.actionLabel}`)}">${escapeHtml(record.actionLabel)}</button>` : record.actionView ? `<button class="small-button" type="button" data-record-action-view="${escapeHtml(record.actionView)}" aria-label="${escapeHtml(`${record.member} · ${record.title} · ${record.coachName || "코치 미배정"} · ${record.actionLabel}`)}">${escapeHtml(record.actionLabel)}</button>` : record.mediaCount ? `<button class="ghost-button" type="button" data-open-journal-media="${escapeHtml(record.journalId)}" aria-label="${escapeHtml(`${record.member} · ${record.title} · ${record.coachName || "코치 미배정"} · ${record.actionLabel}`)}">${escapeHtml(record.actionLabel)}</button>` : `<b>${escapeHtml(record.actionLabel)}</b>`}
          </aside>
        </article>`,
    )
    .join("") || adminEmptyState({
      title: "해당 상태의 기록이 없습니다",
      reason: activeFilter === "pending"
        ? "수업 후 코멘트·커리큘럼·차감이 필요한 항목이 생기면 여기에 표시됩니다."
        : "필터를 바꾸면 다른 처리 상태의 기록을 확인할 수 있습니다.",
      action: { label: "오늘 시간표 확인", jump: "schedule", primary: false },
      compact: true,
    });
}
