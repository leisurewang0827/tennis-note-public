// 시간표 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderLessonPolicySettings() {
  const target = $("#lessonPolicyList");
  if (!target) return;
  const search = String(state.lessonPolicySearch || "").trim().toLowerCase();
  const visible = lessonPolicies.filter((policy) => (
    !search || `${policy.title} ${policy.detail} ${policy.category}`.toLowerCase().includes(search)
  ));
  const count = $("#lessonPolicyCount");
  if (count) count.textContent = `${lessonPolicies.filter((item) => item.status === "active").length}/${lessonPolicies.length}개 사용`;
  const searchInput = $("#lessonPolicySearch");
  if (searchInput && searchInput.value !== state.lessonPolicySearch) searchInput.value = state.lessonPolicySearch || "";
  target.innerHTML = visible.length ? visible.map((rawPolicy) => {
    const policyIndex = lessonPolicies.findIndex((item) => item.id === rawPolicy.id);
    const policy = normalizeLessonPolicy(rawPolicy, policyIndex);
    return `
      <details class="lesson-policy-row ${policy.status}" data-lesson-policy-id="${escapeHtml(policy.id)}">
        <summary>
          <span class="lesson-policy-order">${String(policyIndex + 1).padStart(2, "0")}</span>
          <span class="lesson-policy-summary">
            <strong>${escapeHtml(policy.title)}</strong>
            <small>${escapeHtml(policy.category)} · ${escapeHtml(policy.detail)}</small>
          </span>
          ${badge(policy.status === "active" ? "ready" : "neutral", policy.status === "active" ? "사용" : "중지")}
        </summary>
        <div class="lesson-policy-edit-grid">
          <label>
            <small>정책명</small>
            <input type="text" maxlength="60" value="${escapeHtml(policy.title)}" data-lesson-policy-field="title" />
          </label>
          <label>
            <small>분류</small>
            <select data-lesson-policy-field="category">
              ${["수업 변경", "수업 처리", "수업 단위", "출석·차감", "기타"].map((category) => `<option ${policy.category === category ? "selected" : ""}>${category}</option>`).join("")}
            </select>
          </label>
          <label>
            <small>상태</small>
            <select data-lesson-policy-field="status">
              <option value="active" ${policy.status === "active" ? "selected" : ""}>사용</option>
              <option value="inactive" ${policy.status === "inactive" ? "selected" : ""}>중지</option>
            </select>
          </label>
          <label class="lesson-policy-detail-field">
            <small>정책 내용</small>
            <textarea rows="2" maxlength="300" data-lesson-policy-field="detail">${escapeHtml(policy.detail)}</textarea>
          </label>
        </div>
        <div class="lesson-policy-actions">
          <div>
            <button class="icon-button" type="button" title="위로 이동" aria-label="${escapeHtml(policy.title)} 위로 이동" data-move-lesson-policy="${escapeHtml(policy.id)}" data-direction="up" ${policyIndex === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-button" type="button" title="아래로 이동" aria-label="${escapeHtml(policy.title)} 아래로 이동" data-move-lesson-policy="${escapeHtml(policy.id)}" data-direction="down" ${policyIndex === lessonPolicies.length - 1 ? "disabled" : ""}>↓</button>
          </div>
          <div>
            <button class="ghost-button danger-button" type="button" data-delete-lesson-policy="${escapeHtml(policy.id)}">삭제</button>
            <button class="small-button" type="button" data-save-lesson-policy="${escapeHtml(policy.id)}">저장</button>
          </div>
        </div>
      </details>`;
  }).join("") : `<p class="empty-text">${search ? "검색된 수업 정책이 없습니다." : "등록된 수업 정책이 없습니다. 새 정책을 추가해 주세요."}</p>`;
}

function renderSchedulePolicyPreview() {
  const target = $("#schedulePolicyPreview");
  if (!target) return;
  const compactDays = ["월", "화", "토"];
  target.innerHTML = `
    <article>
      <strong>표시 기준</strong>
      <span>회원앱/코치앱 기본은 수업근처만 표시합니다. 오전·오후·저녁·전체는 필요할 때 눌러 확인합니다.</span>
    </article>
    <article>
      <strong>운영 시간</strong>
      <span>${scheduleSettings.openStart}~${scheduleSettings.openEnd} · 10분 단위 표시 · 20/30분 수업 전체 시간으로 충돌 검사</span>
    </article>
    ${compactDays
      .map((day) => `
        <article>
          <strong>${day}요일</strong>
          <span>${scheduleCoachSummaryForDay(day)}</span>
          <small>${scheduleBreakSummaryForDay(day)}</small>
        </article>`)
      .join("")}`;
}

function renderCourtControls() {
  const label = $("#courtCountLabel");
  if (label) label.textContent = fixedCourtCount;
}

function renderScheduleAssignmentPicker() {
  const picker = $("#scheduleAssignmentTicket");
  const search = $("#scheduleAssignmentSearch");
  const statusFilter = $("#scheduleAssignmentStatusFilter");
  const count = $("#scheduleAssignmentCount");
  const bar = $("#scheduleAssignmentBar");
  if (!picker || !search || !statusFilter || !count || !bar) return;
  const allCandidates = unassignedRegularTickets();
  const candidates = scheduleAssignmentQueueCandidates();
  const assignmentCounts = allCandidates.reduce((summary, ticket) => {
    const progress = ticketRegularScheduleAssignmentProgress(ticket);
    summary[progress.state] += 1;
    return summary;
  }, { unassigned: 0, partial: 0 });
  const current = currentScheduleAssignmentTicket();
  const options = [...candidates];
  if (current && !options.some((ticket) => String(ticket.id) === String(current.id))) options.unshift(current);
  search.value = state.scheduleAssignmentSearch;
  statusFilter.innerHTML = `
    <option value="all">전체 ${allCandidates.length}</option>
    <option value="partial">일부 ${assignmentCounts.partial}</option>
    <option value="unassigned">미배정 ${assignmentCounts.unassigned}</option>
  `;
  statusFilter.value = state.scheduleAssignmentFilter;
  picker.innerHTML = `<option value="">${options.length ? "회원 선택" : "검색 결과 없음"}</option>${options.map((ticket) => {
    const names = ticketParticipantNames(ticket).join(" & ") || ticket.member || "회원";
    const progress = ticketRegularScheduleAssignmentProgress(ticket);
    const remaining = state.scheduleAssignmentTicketId === String(ticket.id)
      ? scheduleAssignmentRemainingCount(ticket)
      : progress.remainingCount;
    const assignmentLabel = progress.assignedCount > 0
      ? `일부 ${progress.assignedCount}/${progress.requiredCount}`
      : `미배정 0/${progress.requiredCount}`;
    return `<option value="${escapeHtml(String(ticket.id))}">[${assignmentLabel}] ${escapeHtml(names)} · ${escapeHtml(getCoachName(ticket.coachId) || "코치 미배정")} · ${remaining}개 남음</option>`;
  }).join("")}`;
  picker.value = current ? String(current.id) : "";
  count.textContent = candidates.length === allCandidates.length
    ? `미배정 ${assignmentCounts.unassigned} · 일부 ${assignmentCounts.partial}`
    : `${candidates.length}명 표시`;
  bar.hidden = !current;
  if (!current) return;
  const names = ticketParticipantNames(current).join(" & ") || current.member || "회원";
  const source = state.scheduleAssignmentLessonSource === "regular" ? "정규시간" : lessonTypeLabel({ lessonSource: state.scheduleAssignmentLessonSource });
  const remaining = scheduleAssignmentRemainingCount(current);
  const progress = ticketRegularScheduleAssignmentProgress(current);
  $("#scheduleAssignmentMember").textContent = `${names} · ${source} 배정`;
  $("#scheduleAssignmentDetail").textContent = `${getCoachName(current.coachId) || "담당 코치 미배정"} · ${getTicketDisplayProduct(current)} · 현재 ${progress.assignedCount}/${progress.requiredCount} · ${remaining}개 더 선택`;
}

function renderSchedulePasteToolbar() {
  const toolbar = $("#schedulePasteToolbar");
  if (!toolbar) return;
  const clipboard = state.scheduleLessonClipboard;
  toolbar.hidden = !clipboard;
  if (!clipboard) return;
  const ticket = scheduleClipboardTicket();
  const coachName = scheduleCoachDisplayName(getCoachName(ticket?.coachId || clipboard.coachId));
  $("#schedulePasteSummary").textContent = `${clipboard.memberLabel} · ${clipboard.durationMinutes}분 · ${coachName}`;
}

function renderScheduleOpenSlotToolbar() {
  const toolbar = $("#scheduleOpenSlotToolbar");
  const toggle = $("#toggleScheduleOpenSlotMode");
  const scheduleView = $("#scheduleView");
  const visibleKeys = new Set(visibleScheduleOpenSlotKeys());
  state.selectedScheduleOpenSlots = (state.selectedScheduleOpenSlots || [])
    .filter((slot) => visibleKeys.has(scheduleOpenSlotKey(slot)));
  const selected = sortedSelectedScheduleOpenSlots();
  if (toolbar) toolbar.hidden = !state.scheduleOpenSlotMode;
  if ($("#scheduleOpenSlotCount")) $("#scheduleOpenSlotCount").textContent = String(selected.length);
  const preview = $("#scheduleOpenSlotPreview");
  if (preview) {
    preview.textContent = scheduleOpenSlotPreviewText(selected);
    preview.classList.toggle("is-empty", selected.length === 0);
  }
  const createButton = $("#createLessonFromOpenSlots");
  if (createButton) {
    createButton.disabled = selected.length === 0;
    createButton.textContent = state.scheduleLessonClipboard ? "선택칸에 붙여넣기" : "선택칸 수업 추가";
  }
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(state.scheduleOpenSlotMode));
    toggle.textContent = state.scheduleOpenSlotMode ? "빈칸 선택 중" : "빈칸 선택";
  }
  scheduleView?.classList.toggle("is-open-slot-edit", state.scheduleOpenSlotMode);
}

function renderScheduleSheetPastePreview(rows = state.scheduleSheetPasteRows || []) {
  const panel = $("#scheduleSheetPastePanel");
  const preview = $("#scheduleSheetPastePreview");
  if (panel) panel.hidden = !state.scheduleSheetPasteOpen;
  if (!preview) return;
  const saveButton = $("#saveScheduleSheetPaste");
  if (!rows.length) {
    state.selectedScheduleSheetPasteRowNumbers = [];
    if (saveButton) saveButton.disabled = true;
    preview.innerHTML = `<p class="empty-state">엑셀이나 구글시트에서 복사한 줄을 붙여넣고 미리보기를 눌러주세요.</p>`;
    return;
  }
  pruneScheduleSheetPasteSelection(rows);
  const readyCount = rows.filter((row) => !row.issues.length).length;
  const issueCount = rows.length - readyCount;
  if (saveButton) saveButton.disabled = !readyCount || !adminApprovalReady();
  const visibleRows = scheduleSheetPasteVisibleRows(rows);
  const selectedRows = scheduleSheetPasteSelectedRowSet();
  preview.innerHTML = `
    <div class="schedule-sheet-paste-summary">
      <strong>${rows.length}줄 미리보기</strong>
      <span>등록 가능 ${readyCount}줄 · 확인 필요 ${issueCount}줄</span>
      <button class="ghost-button" type="button" data-clear-schedule-sheet-issues ${issueCount ? "" : "disabled"}>확인 필요 줄 삭제</button>
    </div>
    ${scheduleSheetPasteFilterButtons(rows)}
    ${scheduleSheetPasteBulkControls(rows, visibleRows)}
    ${visibleRows.length ? visibleRows.map(({ row, index }) => `
      <div class="schedule-sheet-paste-row ${row.issues.length ? "needs-check" : "is-ready"}">
        <input class="schedule-sheet-paste-check" type="checkbox" data-select-schedule-sheet-row="${scheduleSheetPasteRowSelectionKey(row, index)}" aria-label="${row.rowNumber || index + 1}번 줄 선택" ${selectedRows.has(scheduleSheetPasteRowSelectionKey(row, index)) ? "checked" : ""} />
        <span class="schedule-sheet-paste-number">${row.rowNumber || index + 1}</span>
        ${scheduleSheetDayField(row, index)}
        <input data-schedule-sheet-field="time" data-row-index="${index}" type="time" value="${escapeHtml(row.time || "")}" aria-label="시간" />
        ${scheduleSheetCoachField(row, index)}
        <input data-schedule-sheet-field="memberName" data-row-index="${index}" type="text" value="${escapeHtml(row.memberName || "")}" aria-label="회원" placeholder="회원" />
        ${scheduleSheetSourceField(row, index)}
        ${scheduleSheetDurationField(row, index)}
        <small>${row.issues.length ? escapeHtml(row.issues.join(", ")) : "확인 완료"}</small>
        <button class="danger-text-button schedule-sheet-paste-remove" type="button" data-remove-schedule-sheet-row="${index}" aria-label="${row.rowNumber || index + 1}번 줄 삭제">삭제</button>
      </div>
    `).join("") : `<p class="empty-state">현재 필터에 표시할 줄이 없습니다.</p>`}
  `;
}

function renderScheduleBulkToolbar() {
  const toolbar = $("#scheduleBulkToolbar");
  const toggle = $("#toggleScheduleBulkMode");
  const scheduleView = $("#scheduleView");
  const selected = selectedScheduleLessons();
  const validIds = new Set(selected.map((lesson) => String(lesson.serverLessonId)));
  state.selectedScheduleLessonIds = (state.selectedScheduleLessonIds || [])
    .map(String)
    .filter((id) => validIds.has(id));
  if (toolbar) toolbar.hidden = !state.scheduleBulkMode;
  if ($("#scheduleBulkCount")) $("#scheduleBulkCount").textContent = String(selected.length);
  const preview = $("#scheduleBulkPreview");
  if (preview) {
    preview.textContent = scheduleBulkPreviewText(selected);
    preview.classList.toggle("is-empty", selected.length === 0);
  }
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(state.scheduleBulkMode));
    toggle.textContent = state.scheduleBulkMode ? "다중 수정 중" : "다중 수정";
  }
  scheduleView?.classList.toggle("is-bulk-edit", state.scheduleBulkMode);
  $$("[data-shift-schedule-lessons], #bulkScheduleSubstitute, #clearScheduleBulkSelection")
    .forEach((button) => {
      button.disabled = selected.length === 0;
    });
  if ($("#copyScheduleLesson")) $("#copyScheduleLesson").disabled = selected.length !== 1;
  renderSchedulePasteToolbar();
  renderScheduleOpenSlotToolbar();
}

function renderScheduleLessonCell(lesson, day, time, extraClass = "") {
  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell lesson-slot ${lessonCssStatusClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${extraClass} ${isDimmed ? "is-dimmed" : ""}" title="${day} ${time}">
      <button class="slot-lesson-main ${getCoachToneClass(lesson.coachId)} ${getLessonStateClass(lesson)}" type="button" ${lessonActionAttrs(lesson)}>
        <strong>${getLessonMembersMarkup(lesson)}</strong>
        <span>${getCoachName(lesson.coachId)}</span>
        <small>${getLessonRoundLabel(lesson)} · ${lessonTypeLabel(lesson)}</small>
        ${durationBadge(lesson)}
      </button>
      ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderMultiScheduleCell(day, time, startingLessons) {
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell multi-cell" title="${day} ${time}">
      ${startingLessons
        .map((lesson) => {
          const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
          return `
            <button class="multi-lesson ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
              <strong>${getLessonMembersMarkup(lesson)}</strong>
              <span>${getCoachName(lesson.coachId)}</span>
              <small>${getLessonRoundLabel(lesson)} · ${lesson.durationMinutes}분</small>
            </button>`;
        })
        .join("")}
      ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderCoachLaneLessonCard(lesson, label = "") {
  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const roundLabel = getLessonRoundLabel(lesson);
  return `
    <button class="coach-lane-card lesson ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      ${roundLabel ? `<span class="schedule-round-label">${escapeHtml(roundLabel)}</span>` : ""}
      <span>${label || getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${lesson.durationMinutes}분</small>
    </button>`;
}

function renderUniformCoachScheduleCell(day, time) {
  const lanes = getScheduleCoachLanes(day);
  if (!lanes.length) {
    const breakRule = getBreakRuleForSlot(day, time);
    return `
      <div class="sheet-cell schedule-break-cell" title="${day} ${time}">
        <strong>${breakRule?.label || "브레이크"}</strong>
        <small>근무 코치 없음</small>
      </div>`;
  }
  const laneCount = Math.max(lanes.length, 1);
  const laneSlots = lanes
    .map((coach) => {
      const startingLesson = findStartingLessonForCoach(day, time, coach.id);
      const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
      if (startingLesson) return renderUniformScheduleLine("start", startingLesson);
      if (occupyingLesson) return `<div class="schedule-stack-placeholder is-occupied" data-coach-lane="${coach.id}" aria-hidden="true"></div>`;
      const blockedBreak = getCoachBreakOverlapping(coach.id, day, time, 20) || getBreakRuleOverlapping(day, time, 20, coach.id);
      if (blockedBreak) {
        return `<div class="schedule-coach-slot is-closed is-break" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} ${escapeHtml(blockedBreak.label || "브레이크")}"></div>`;
      }
      if (!isCoachAvailableForSlot(coach.id, day, time, 20)) {
        return `<div class="schedule-coach-slot is-closed" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} 근무 외"></div>`;
      }
      if (canAddLessonAt(day, time, 20, coach.id)) {
        return `<button class="schedule-stack-add admin-duration-add" type="button" data-coach-lane="${coach.id}" ${lessonAddAttrs(day, time, 20, coach.id)}>+ 수업 추가</button>`;
      }
      return `<div class="schedule-coach-slot is-full" data-coach-lane="${coach.id}" aria-label="${escapeHtml(coach.name)} 신청 불가"></div>`;
    })
    .join("");

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines" style="--visible-lane-count: ${laneCount}">
        ${laneSlots}
      </div>
    </div>`;
}

function renderUniformScheduleLine(kind, lesson, timeLabel = "") {
  const lessonSlotsForCard = Math.max(1, Math.ceil(lesson.durationMinutes / scheduleBlockMinutes));
  const scheduleRowHeight = isAdminMobileSchedule() && state.scheduleView !== "coach" ? 60 : 68;
  const lessonCardHeight = lessonSlotsForCard * scheduleRowHeight + Math.max(0, lessonSlotsForCard - 1) * 3 - 8;
  const isCardDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const roundLabel = getLessonRoundLabel(lesson) || "회차 확인";
  const detailLabel = isReleasedRegularMakeupSlot(lesson)
    ? "차감 없음 · 보강·원데이 가능"
    : getLessonStatusLabel(lesson);
  return `
    <button class="schedule-stack-line ${kind} lesson-kind-${lessonVisualKind(lesson)} ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} ${isCardDimmed ? "is-dimmed" : ""}" style="--lesson-height:${lessonCardHeight}px;${lessonColorStyle(lesson)}" type="button" ${lessonActionAttrs(lesson)}>
      ${timeLabel ? `<span class="stack-time">${timeLabel}</span>` : ""}
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      ${isReleasedRegularMakeupSlot(lesson) ? '<span class="schedule-round-label">정규 · 불참</span>' : `<span class="schedule-round-label">${escapeHtml(roundLabel)}</span>`}
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${detailLabel}</small>
    </button>`;
}

function renderFixedCoachScheduleCell(day, time) {
  return renderUniformCoachScheduleCell(day, time);

  const breakRule = getCoachBreakOverlapping(coach.id, day, time, scheduleBlockMinutes) || getBreakRuleForSlot(day, time, coach.id);
  if (breakRule) {
    return `
      <div class="sheet-cell schedule-break-cell" title="${day} ${time}">
        <strong>${breakRule.label || "브레이크"}</strong>
        <small>${breakRule.start}~${breakRule.end}</small>
      </div>`;
  }

  const scheduleLanes = getScheduleCoachLanes();
  const startingLessonsByCoach = scheduleLanes.map((coach) => findStartingLessonForCoach(day, time, coach.id));
  const occupyingLessonsByCoach = scheduleLanes.map((coach) => findOccupyingLessonForCoach(day, time, coach.id));
  const lastVisibleCoachIndex = Math.max(
    startingLessonsByCoach.findLastIndex(Boolean),
    occupyingLessonsByCoach.findLastIndex(Boolean),
  );
  const scheduleOpenCoachId = getAvailableCoachId(day, time);
  const scheduleAddLine = canAddLessonAt(day, time, 20, scheduleOpenCoachId)
    ? `<button class="schedule-stack-add" type="button" ${lessonAddAttrs(day, time, 20, scheduleOpenCoachId)}>+ 수업 추가</button>`
    : `<div class="schedule-stack-full">신청불가</div>`;

  if (lastVisibleCoachIndex < 0) {
    return `
      <div class="sheet-cell schedule-stack-cell is-empty" title="${day} ${time}">
        ${scheduleAddLine}
      </div>`;
  }

  const visibleLaneCount = Math.max(lastVisibleCoachIndex + 1, 1);
  const laneSlots = scheduleLanes
    .slice(0, visibleLaneCount)
    .map((coach, index) => {
      const startingLesson = startingLessonsByCoach[index];
      if (startingLesson) return renderScheduleStackLine("start", startingLesson, `${time} 시작`);
      return `<div class="schedule-stack-placeholder" data-coach-lane="${coach.id}" aria-hidden="true"></div>`;
    })
    .join("");

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines" style="--visible-lane-count: ${visibleLaneCount}">
        ${laneSlots}
      </div>
      ${scheduleAddLine}
    </div>`;

  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const lanes = getScheduleCoachLanes();
  const activeLines = lanes
    .map((coach) => {
      const startingLesson = findStartingLessonForCoach(day, time, coach.id);
      const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
      const startingInBlock = findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coach.id);
      if (startingLesson) return renderScheduleStackLine("start", startingLesson, `${time} 시작`);
      if (occupyingLesson) {
        const occupiedEnd = Math.min(timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes, blockEnd);
        return renderScheduleStackLine("spill", occupyingLesson, `${time}~${minutesToTime(occupiedEnd)} 사용중`);
      }
      if (startingInBlock) return renderScheduleStackLine("start", startingInBlock, `${startingInBlock.time} 시작`);
      return "";
    })
    .filter(Boolean);

  const openCoachId = getAvailableCoachId(day, time);
  const addLine = canAddLessonAt(day, time, 20, openCoachId)
    ? `<button class="schedule-stack-add" type="button" ${lessonAddAttrs(day, time, 20, openCoachId)}>+ 수업 추가</button>`
    : `<div class="schedule-stack-full">신청불가</div>`;

  if (!activeLines.length) {
    return `
      <div class="sheet-cell schedule-stack-cell is-empty" title="${day} ${time}">
        ${addLine}
      </div>`;
  }

  return `
    <div class="sheet-cell schedule-stack-cell" title="${day} ${time}">
      <div class="schedule-stack-lines">
        ${activeLines.join("")}
      </div>
      ${addLine}
    </div>`;
}

function renderScheduleStackLine(kind, lesson, timeLabel) {
  const lessonSlotsForCard = Math.max(1, Math.ceil(lesson.durationMinutes / scheduleBlockMinutes));
  const lessonCardHeight = lessonSlotsForCard * 52 + (lessonSlotsForCard - 1);
  const isCardDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const roundLabel = getLessonRoundLabel(lesson) || "회차 확인";
  return `
    <button class="schedule-stack-line ${kind} ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)} ${isCardDimmed ? "is-dimmed" : ""}" style="--lesson-height: ${lessonCardHeight}px" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${roundLabel}</small>
    </button>`;

  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  const kindLabel = kind === "spill" ? "걸침" : `${lesson.durationMinutes}분`;
  return `
    <button class="schedule-stack-line ${kind} ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <span class="stack-time">${timeLabel}</span>
      <strong>${getLessonMembersMarkup(lesson)}</strong>
      <span class="stack-coach">${getCoachName(lesson.coachId)}</span>
      <small>${getLessonStatusLabel(lesson)} · ${kindLabel} · ${getLessonRoundLabel(lesson) || "빈자리"}</small>
    </button>`;
}

function renderSplitLessonWithAdd(day, time, lesson, label, extraClass = "") {
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="split-parallel ${extraClass}">
      ${renderSplitSegment("occupied", lesson, label)}
      ${canAdd ? `<button class="split-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
    </div>`;
}

function renderOverlapScheduleCell(day, time, occupyingLesson, startingLessons) {
  const blockEnd = timeToMinutes(time) + scheduleBlockMinutes;
  const occupiedEnd = Math.min(timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes, blockEnd);
  const occupiedLabel = `${time}~${minutesToTime(occupiedEnd)} 겹침`;
  const canAdd = hasCourtCapacity(day, time);
  return `
    <div class="sheet-cell overlap-cell" title="${day} ${time}">
      <div class="overlap-strip ${getCoachToneClass(occupyingLesson.coachId)}">
        <button class="overlap-lesson" type="button" ${lessonActionAttrs(occupyingLesson)}>
          <strong>${occupiedLabel}</strong>
          <span>${getCoachName(occupyingLesson.coachId)} · ${getLessonMembersLabel(occupyingLesson)}</span>
        </button>
        <small>${getLessonRoundLabel(occupyingLesson)} · 30분 수업 일부 사용중</small>
      </div>
      <div class="overlap-starts">
        ${startingLessons
          .map((lesson) => {
            const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
            return `
              <button class="multi-lesson ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
                <strong>${getLessonMembersMarkup(lesson)}</strong>
                <span>${getCoachName(lesson.coachId)}</span>
                <small>${getLessonRoundLabel(lesson)} · ${lesson.durationMinutes}분</small>
              </button>`;
          })
          .join("")}
        ${canAdd ? `<button class="slot-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
      </div>
    </div>`;
}

function renderSplitScheduleCell(day, time, previousLesson, nextLesson) {
  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const previousEnd = Math.min(timeToMinutes(previousLesson.time) + previousLesson.durationMinutes, blockEnd);

  if (previousEnd >= blockEnd && !nextLesson) {
    const searchMatch = scheduleLessonMatches(previousLesson);
    const canAdd = hasCourtCapacity(day, time);
    return `
      <div class="sheet-cell split-parallel-full duration-${durationTone(previousLesson)} ${searchMatch ? "" : "is-dimmed"}" title="${day} ${time}">
        <button class="split-segment occupied ${getCoachToneClass(previousLesson.coachId)}" type="button" ${lessonActionAttrs(previousLesson)}>
          <strong>사용중</strong>
          <span>${getLessonMembersMarkup(previousLesson)}</span>
          <small>${getCoachName(previousLesson.coachId)} · ${getLessonRoundLabel(previousLesson)} · ${lessonTypeLabel(previousLesson)}</small>
          ${durationBadge(previousLesson)}
        </button>
        ${canAdd ? `<button class="split-add-button" type="button" ${lessonAddAttrs(day, time)}>+ 수업 추가</button>` : ""}
      </div>`;
  }

  const availableStart = minutesToTime(previousEnd);
  const remainingMinutes = blockEnd - previousEnd;
  return `
    <div class="sheet-cell split-cell" title="${day} ${time}">
      ${renderSplitLessonWithAdd(day, time, previousLesson, `${time}~${availableStart} 사용중`, "top")}
      ${
        nextLesson
          ? renderSplitStartWithOverlap(day, time, nextLesson, `${nextLesson.time} 시작`, "bottom")
          : remainingMinutes >= 20
            ? renderSplitSegment("empty", null, `${availableStart} 이후`, "bottom", { day, time: availableStart })
            : renderContinuationSegment(`${availableStart} 이어서 신청`, "10분 경계 시작 가능", { day, time: availableStart })
      }
    </div>`;
}

function renderScheduleCell(day, time) {
  return renderFixedCoachScheduleCell(day, time);

  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const startingLessons = findLessons(day, time);
  const occupyingLesson = findOccupyingLesson(day, time);
  const startingInBlock = findLessonStartingInBlock(day, blockStart, blockEnd);
  if (startingLessons.length >= 1 && occupyingLesson) return renderOverlapScheduleCell(day, time, occupyingLesson, startingLessons);
  if (startingLessons.length >= 1) return renderMultiScheduleCell(day, time, startingLessons);
  if (occupyingLesson) return renderSplitScheduleCell(day, time, occupyingLesson, startingInBlock);

  if (startingInBlock) {
    return `
      <div class="sheet-cell split-cell" title="${day} ${time}">
        ${renderSplitSegment("empty", null, `${time}~${startingInBlock.time} 가능`, "top", { day, time })}
        ${renderSplitSegment("starts", startingInBlock, `${startingInBlock.time} 시작`, "bottom")}
      </div>`;
  }

  return `
    <button class="sheet-cell empty addable-cell" type="button" ${lessonAddAttrs(day, time)}>
      <span>+</span>
      <small>수업 추가</small>
    </button>`;
}

function renderCoachDayBaseCell(day, time, coach, row, column) {
  const breakRule = getCoachBreakOverlapping(coach.id, day, time, scheduleBlockMinutes)
    || getBreakRuleForSlot(day, time, coach.id);
  const occupyingLesson = lessons.find((lesson) => lessonScheduleCoachId(lesson) === coach.id && lessonOverlapsScheduleSlot(lesson, day, time));
  const working = isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes);
  const className = breakRule ? "is-break" : working ? "is-open" : "is-closed";
  const label = breakRule ? (breakRule.label || "브레이크") : working ? "수업 추가" : "근무외";
  const canAdd = working && !occupyingLesson && canAddLessonAt(day, time, 20, coach.id);
  const content = canAdd
    ? `<button type="button" ${lessonAddAttrs(day, time, 20, coach.id)}><span>+</span><small>${label}</small></button>`
    : `<span>${occupyingLesson ? "" : label}</span>`;
  return `<div class="coach-day-cell ${className} ${occupyingLesson ? "is-occupied" : ""}" style="grid-row:${row};grid-column:${column};" title="${escapeHtml(`${day} ${time} · ${coach.name}`)}">${content}</div>`;
}

function renderCoachDayLessonCard(lesson, visibleTimes, column) {
  const startIndex = visibleTimes.indexOf(lesson.time);
  if (startIndex < 0 || !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson)) return "";
  const start = timeToMinutes(lesson.time);
  const end = start + (Number(lesson.durationMinutes) || 20);
  const rowSpan = Math.max(1, visibleTimes.filter((time) => {
    const value = timeToMinutes(time);
    return value >= start && value < end;
  }).length);
  const memberLabel = isReleasedRegularMakeupSlot(lesson)
    ? getLessonMembersLabel(lesson)
    : isLessonAvailable(lesson) ? "보강 가능" : getLessonMembersLabel(lesson);
  const statusLabel = isReleasedRegularMakeupSlot(lesson)
    ? "정규 · 불참 · 차감 없음 · 보강·원데이 가능"
    : isLessonAvailable(lesson) ? `${lesson.durationMinutes}분 신청 가능` : `${getLessonStatusLabel(lesson)} · ${lesson.durationMinutes}분`;
  const roundLabel = getLessonRoundLabel(lesson);
  const coachLabel = lessonScheduleCoachLabel(lesson);
  return `
    <button class="coach-day-lesson ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} ${getCoachToneClass(lesson.coachId)}" style="grid-row:${startIndex + 2} / span ${rowSpan};grid-column:${column};" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${scheduleMemberLinesMarkup(memberLabel)}</strong>
      ${roundLabel ? `<span class="schedule-round-label">${escapeHtml(roundLabel)}</span>` : ""}
      <span>${escapeHtml(`${statusLabel}${coachLabel ? ` · ${coachLabel}` : ""}`)}</span>
      <small>${lesson.time}~${minutesToTime(end)}</small>
    </button>`;
}

function renderCoachDaySchedule(day) {
  const target = $("#coachScheduleGrid");
  if (!target) return;
  const dayCoaches = getScheduleCoachLanes(day).filter((coach) => coach.id !== "coach-machine");
  if (state.scheduleCoachFilter !== "all" && !dayCoaches.some((coach) => coach.id === state.scheduleCoachFilter)) {
    state.scheduleCoachFilter = "all";
  }
  const visibleCoaches = state.scheduleCoachFilter === "all"
    ? dayCoaches
    : dayCoaches.filter((coach) => coach.id === state.scheduleCoachFilter);
  const visibleTimes = coachScheduleVisibleTimes(day, visibleCoaches);
  const picker = $("#adminScheduleCoachPicker");
  if (picker) {
    picker.innerHTML = `
      <button class="coach-filter-button ${state.scheduleCoachFilter === "all" ? "is-active" : ""}" type="button" data-select-schedule-coach="all">전체 코치</button>
      ${dayCoaches.map((coach) => `<button class="coach-filter-button ${getCoachToneClass(coach.id)} ${state.scheduleCoachFilter === coach.id ? "is-active" : ""}" type="button" data-select-schedule-coach="${coach.id}">${escapeHtml(coach.name)}</button>`).join("")}`;
  }

  if (!visibleCoaches.length || !visibleTimes.length) {
    target.style.gridTemplateColumns = "1fr";
    target.innerHTML = '<p class="coach-schedule-empty">선택한 조건에 표시할 코치 일정이 없습니다.</p>';
    return;
  }

  target.style.gridTemplateColumns = `68px repeat(${visibleCoaches.length}, minmax(154px, 1fr))`;
  const headers = `<div class="coach-day-corner">시간</div>${visibleCoaches.map((coach) => {
    const workLabel = normalizeCoachWorkBlocks(coach)
      .filter((block) => block.days.includes(day))
      .map((block) => `${block.start}~${block.end}`)
      .join(" · ") || "근무 없음";
    return `<div class="coach-day-header ${getCoachToneClass(coach.id)}"><strong>${escapeHtml(coach.name)}</strong><span>${escapeHtml(workLabel)}</span></div>`;
  }).join("")}`;
  const baseCells = visibleTimes.map((time, timeIndex) => {
    const row = timeIndex + 2;
    const minor = timeToMinutes(time) % 20 !== 0;
    return `<div class="coach-day-time ${minor ? "is-minor" : ""}" style="grid-row:${row};grid-column:1;">${time}</div>${visibleCoaches.map((coach, coachIndex) => renderCoachDayBaseCell(day, time, coach, row, coachIndex + 2)).join("")}`;
  }).join("");
  const lessonCards = visibleCoaches.map((coach, coachIndex) => operationBranchLessons()
    .filter((lesson) => lesson.day === day && lessonScheduleCoachId(lesson) === coach.id && !isLessonCancelled(lesson) && lessonMatchesActiveScheduleWeek(lesson, day))
    .map((lesson) => renderCoachDayLessonCard(lesson, visibleTimes, coachIndex + 2))
    .join("")).join("");
  target.innerHTML = headers + baseCells + lessonCards;
}

function renderAdminDurationSchedule(displayDays, visibleTimes, dayCoachMap) {
  const target = $("#scheduleGrid");
  target.classList.remove("schedule-loading-state");
  const scheduleLessons = operationBranchLessons();
  const lanes = [];
  const dayRanges = [];
  displayDays.forEach((day) => {
    const coaches = dayCoachMap.get(day) || [];
    const displayCoaches = coaches.length ? coaches : [{ id: `closed-${day}`, name: "운영없음", workBlocks: [] }];
    const startColumn = lanes.length + 2;
    displayCoaches.forEach((coach) => lanes.push({ day, coach }));
    dayRanges.push({ day, coaches: displayCoaches, startColumn, span: displayCoaches.length });
  });

  const laneTracks = lanes.map(() => "minmax(88px, 1fr)").join(" ");
  target.classList.add("admin-duration-schedule");
  target.classList.remove("is-mobile-day", "has-coach-overflow");
  target.style.gridTemplateColumns = `58px ${laneTracks}`;
  target.style.gridTemplateRows = `30px 34px repeat(${Math.max(visibleTimes.length, 1)}, 44px)`;

  const dateHeaders = dayRanges.map(({ day, startColumn, span }) => `
    <div class="admin-duration-date admin-duration-day-start" style="grid-row:1;grid-column:${startColumn} / span ${span};">
      ${day} · ${adminScheduleDateLabel(day)}
    </div>`).join("");
  const dayStartLaneIndexes = new Set(dayRanges.map(({ startColumn }) => startColumn - 2));
  const laneLessonIndex = new Map(lanes.map(({ day, coach }) => [`${day}|${coach.id}`, []]));
  scheduleLessons.forEach((lesson) => {
    if (isLessonCancelled(lesson) || !lessonMatchesActiveScheduleWeek(lesson, lesson.day)) return;
    laneLessonIndex.get(`${lesson.day}|${lessonScheduleCoachId(lesson)}`)?.push(lesson);
  });
  const laneLessons = lanes.map(({ day, coach }) => laneLessonIndex.get(`${day}|${coach.id}`) || []);
  const slotStateIndex = buildAdminDurationSlotStateIndex(
    displayDays,
    visibleTimes,
    lanes,
    laneLessons,
    scheduleLessons,
  );
  const selectedOpenSlotKeys = selectedScheduleOpenSlotKeys();
  const assignmentTicket = currentScheduleAssignmentTicket();
  const visibleTimeIndexes = new Map(visibleTimes.map((time, index) => [time, index]));
  const coachHeaders = lanes.map(({ coach }, index) => `
    <div class="admin-duration-coach ${dayStartLaneIndexes.has(index) ? "admin-duration-day-start" : ""} ${coach.id?.startsWith("closed-") ? "is-closed" : getCoachToneClass(coach.id)}" style="grid-row:2;grid-column:${index + 2};">
      ${escapeHtml(String(coach.name || "운영없음").replace(/\s*코치$/, ""))}
    </div>`).join("");
  const timeCells = visibleTimes.map((time, index) => `
    <div class="admin-duration-time" style="grid-row:${index + 3};grid-column:1;">${time}</div>`).join("");

  const slotCells = visibleTimes.map((time, timeIndex) => lanes.map(({ day, coach }, laneIndex) => {
    const row = timeIndex + 3;
    const column = laneIndex + 2;
    const slotState = slotStateIndex.get(`${laneIndex}|${time}`)
      || getAdminDurationSlotState(day, time, coach, laneLessons[laneIndex]);
    const openSlotKey = scheduleOpenSlotKey({ day, time, coachId: coach.id });
    const openSlotSelected = selectedOpenSlotKeys.has(openSlotKey);
    const assignmentAllowsCoach = !assignmentTicket?.coachId || String(assignmentTicket.coachId) === String(coach.id || "");
    const canAddForAssignment = slotState.canAdd && assignmentAllowsCoach;
    const addButtonContent = state.scheduleOpenSlotMode
      ? (openSlotSelected ? "선택됨" : "선택")
      : slotState.pasteReady
        ? "붙여넣기"
        : '<span class="admin-duration-add-icon" aria-hidden="true">+</span><span class="admin-duration-add-label">수업 추가</span>';
    const addableClass = canAddForAssignment
      ? ` admin-duration-add ${slotState.pasteReady ? "is-paste-ready" : ""} ${openSlotSelected ? "is-slot-selected" : ""}`
      : "";
    const addableAttrs = canAddForAssignment
      ? `role="button" tabindex="0" data-quick-lesson-entry="true" ${state.scheduleOpenSlotMode ? `data-select-schedule-slot="${escapeHtml(openSlotKey)}" aria-pressed="${openSlotSelected ? "true" : "false"}"` : ""} ${slotState.pasteReady ? 'data-paste-schedule-lesson="true"' : ""} ${lessonAddAttrs(day, time, 20, coach.id)}`
      : "";
    const assignmentClass = assignmentTicket && !assignmentAllowsCoach ? " is-assignment-blocked" : "";
    return `<div class="admin-duration-slot ${dayStartLaneIndexes.has(laneIndex) ? "admin-duration-day-start" : ""} ${slotState.className}${addableClass}${assignmentClass}" ${addableAttrs} style="grid-row:${row};grid-column:${column};">${canAddForAssignment ? addButtonContent : ""}</div>`;
  }).join("")).join("");

  const lessonCards = lanes.map((lane, laneIndex) => laneLessons[laneIndex]
    .map((lesson) => {
      const startIndex = visibleTimeIndexes.get(lesson.time) ?? -1;
      if (startIndex < 0) return "";
      const span = Math.max(1, Math.ceil((Number(lesson.durationMinutes) || 20) / 10));
      const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
      return `
        <button class="admin-duration-lesson ${dayStartLaneIndexes.has(laneIndex) ? "admin-duration-day-start" : ""} lesson-kind-${lessonVisualKind(lesson)} ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} ${isDimmed ? "is-dimmed" : ""}" type="button" data-schedule-lesson-id="${escapeHtml(String(lesson.id || ""))}" ${lessonActionAttrs(lesson)} style="${lessonColorStyle(lesson)};grid-row:${startIndex + 3} / span ${span};grid-column:${laneIndex + 2};">
          <strong class="schedule-lesson-name">${getLessonMembersMarkup(lesson)}</strong>
          <span class="schedule-lesson-round">${escapeHtml(getLessonRoundLabel(lesson) || "회차 확인")}</span>
          <span class="schedule-lesson-coach">${escapeHtml(lessonScheduleCoachLabel(lesson))}</span>
          <span class="schedule-lesson-note ${scheduleLessonExceptionLabel(lesson) ? "" : "is-empty"}">${escapeHtml(scheduleLessonExceptionLabel(lesson) || "-")}</span>
        </button>`;
    }).join("")).join("");

  target.innerHTML = `
    <div class="admin-duration-corner" style="grid-row:1 / span 2;grid-column:1;">시간</div>
    ${dateHeaders}${coachHeaders}${timeCells}${slotCells}${lessonCards}`;
}

function renderSchedule() {
  syncAdminScheduleWeek();
  renderScheduleBulkToolbar();
  const activeWeek = activeAdminWeek();
  if ($("#adminWeekTitle")) $("#adminWeekTitle").textContent = `${activeWeek.label} 레슨관리표`;
  if ($("#adminWeekNote")) $("#adminWeekNote").textContent = `${activeWeek.range} · ${state.liveScheduleLoaded ? state.liveScheduleMessage : activeWeek.note}`;
  renderScheduleMemberSearch();
  renderScheduleAssignmentPicker();
  if ($("#adminWeekSwitcher")) {
    $("#adminWeekSwitcher").innerHTML = `
      <button class="ghost-button" type="button" data-change-admin-week="-1" ${state.activeAdminWeekIndex <= adminScheduleMinWeekOffset ? "disabled" : ""} aria-label="이전 주" title="이전 주">‹</button>
      <div class="schedule-period-summary">
        <div class="schedule-month-controls">
          <button class="ghost-button" type="button" data-go-admin-today>오늘</button>
          <input class="schedule-month-input" type="month" value="${adminScheduleMonthValue(activeWeek)}" data-admin-month aria-label="이동할 달">
        </div>
        <strong>${activeWeek.label}</strong>
        <span>${activeWeek.range} · ${state.liveScheduleLoaded ? "실시간 모든 코치 시간표" : "모든 코치 시간표"}</span>
      </div>
      <button class="ghost-button" type="button" data-change-admin-week="1" ${state.activeAdminWeekIndex >= adminScheduleMaxWeekOffset ? "disabled" : ""} aria-label="다음 주" title="다음 주">›</button>
    `;
  }
  state.scheduleView = state.scheduleView === "coach" ? "coach" : "week";
  state.scheduleFilter = state.scheduleFilter === "pending" ? "pending" : "all";
  const editToggle = $("#toggleScheduleEditMode");
  if (editToggle) {
    editToggle.setAttribute("aria-pressed", String(state.scheduleEditMode));
    editToggle.textContent = state.scheduleEditMode ? "편집 끝내기" : "시간표 편집";
  }
  const coachDayView = state.scheduleView === "coach";
  const mobileDayView = !coachDayView && isAdminMobileSchedule();
  const selectedDay = selectedAdminScheduleDay();
  const displayDays = mobileDayView ? [selectedDay] : scheduleDays;
  $$('[data-schedule-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleView === state.scheduleView));
  $$(".segment[data-schedule-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleFilter === state.scheduleFilter));
  if ($("#adminScheduleDayPicker")) {
    $("#adminScheduleDayPicker").classList.toggle("is-visible", coachDayView || mobileDayView);
    $("#adminScheduleDayPicker").innerHTML = scheduleDays.map((day) => `
      <button class="schedule-day-button ${day === selectedDay ? "is-active" : ""}" type="button" data-select-admin-day="${day}">
        <strong>${day}</strong><span>${adminScheduleDateLabel(day)}</span>
      </button>`).join("");
  }
  if ($("#adminScheduleCoachPicker")) $("#adminScheduleCoachPicker").hidden = !coachDayView;
  $("#scheduleGrid").hidden = coachDayView;
  $("#coachScheduleGrid").hidden = !coachDayView;
  if (coachDayView) {
    renderCoachDaySchedule(selectedDay);
    renderScheduleBulkToolbar();
    return;
  }
  const visibleTimes = getVisibleScheduleTimes()
    .filter(scheduleTimeHasFilteredLesson)
    .filter((time) => !mobileDayView || adminTimeVisibleForDay(selectedDay, time));
  const dayCoachMap = new Map(displayDays.map((day) => [day, getScheduleCoachLanes(day)]));
  renderAdminDurationSchedule(displayDays, visibleTimes, dayCoachMap);
  renderScheduleBulkToolbar();
  return;
  const dayWidths = displayDays.map((day) => {
    if (mobileDayView) return 0;
    const dayLaneCount = Math.max(1, dayCoachMap.get(day)?.length || 0);
    return dayLaneCount * coachSlotWidth + Math.max(0, dayLaneCount - 1) * 3 + 11;
  });
  const mobileCoachCount = Math.max(1, dayCoachMap.get(selectedDay)?.length || 0);
  const mobileCoachOverflow = mobileDayView && mobileCoachCount >= 4;
  const mobileDayWidth = mobileCoachCount * mobileCoachSlotWidth + Math.max(0, mobileCoachCount - 1) * 3 + 8;
  $("#scheduleGrid").classList.toggle("is-mobile-day", mobileDayView);
  $("#scheduleGrid").classList.toggle("has-coach-overflow", mobileCoachOverflow);
  $("#scheduleGrid").style.gridTemplateColumns = mobileDayView
    ? `52px ${mobileCoachOverflow ? `${mobileDayWidth}px` : "minmax(0, 1fr)"}`
    : `${timeColumnWidth}px ${dayWidths.map((width) => `${width}px`).join(" ")}`;

  const header = ["<div class=\"sheet-head time-head\">시간</div>"]
    .concat(displayDays.map((day) => {
      const dayCoaches = dayCoachMap.get(day) || [];
      const displayCoaches = dayCoaches.length ? dayCoaches : [{ name: "운영없음" }];
      return `
        <div class="sheet-head admin-day-head" style="--admin-coach-count:${displayCoaches.length};">
          <strong class="admin-day-label">${day} · ${adminScheduleDateLabel(day)}</strong>
          <div class="admin-coach-head-row">
            ${displayCoaches.map((coach) => `<span>${escapeHtml(coach.name.replace(/\s*코치$/, ""))}</span>`).join("")}
          </div>
        </div>`;
    }))
    .join("");

  const body = visibleTimes.length
    ? visibleTimes
    .map((time) => {
      const cells = displayDays
        .map((day) => {
          return renderScheduleCell(day, time);
        })
        .join("");
      return `<div class="sheet-time">${time}</div>${cells}`;
    })
    .join("")
    : `<div class="sheet-time">-</div><div class="sheet-cell schedule-stack-cell is-empty" style="grid-column: span ${displayDays.length};">확인 필요한 시간이 없습니다.</div>`;

  $("#scheduleGrid").innerHTML = header + body;
}

function renderRegularSchedulePreview(ticket, candidate, validation) {
  const requiredCount = validation.requiredCount || 1;
  if (requiredCount <= 1) return "";
  const issueRows = regularScheduleIssueRows(ticket, candidate, validation);
  const readyCount = issueRows.filter((row) => !row.issue).length;
  return `
    <div class="lesson-repeat-preview" aria-label="반복 정규수업 미리보기">
      <strong>정규시간 ${requiredCount}개 확인 <em>서버 저장 예정 ${readyCount}/${requiredCount}</em></strong>
      <div class="lesson-repeat-preview-list">
        ${issueRows.map((row) => `
          <div class="lesson-repeat-preview-item ${row.issue ? "has-issue" : "is-ready"}">
            <span>${row.index}</span>
            <b>${escapeHtml(row.label)}</b>
            <small>${escapeHtml(row.issue || "등록 가능")}</small>
          </div>`).join("")}
      </div>
    </div>`;
}

function renderLessonDurationQuickButtons() {
  const panel = $("#lessonDurationQuickPanel");
  const target = $("#lessonDurationQuickButtons");
  const select = $("#lessonDuration");
  if (!panel || !target || !select) return;
  const summary = $("#lessonDurationQuickSummary");
  const ticket = scheduleTicketById($("#lessonTicket")?.value);
  const ticketDuration = getTicketDurationMinutes(ticket);
  const allowed = new Set([...select.options].map((option) => option.value));
  const current = String(select.value || "20");
  const currentMinutes = Number(current) || 20;
  const startTime = $("#lessonTime")?.value || "";
  const endTime = startTime ? minutesToTime(timeToMinutes(startTime) + currentMinutes) : "";
  const unitLabel = currentMinutes === ticketDuration
    ? "회원권 기준 1회"
    : currentMinutes === ticketDuration * 2
      ? "회원권 2회 연속"
      : adminManualOverrideEnabled()
        ? "관리자 수동 시간"
        : "회원권 기준과 다름";
  panel.hidden = false;
  if (summary) {
    summary.textContent = `${currentMinutes}분${endTime ? ` · ${startTime}~${endTime}` : ""} · ${unitLabel}`;
    summary.classList.toggle("has-warning", unitLabel.includes("다름") || unitLabel.includes("수동"));
  }
  target.innerHTML = [20, 30, 40, 60].map((minutes) => {
    const value = String(minutes);
    const disabled = !allowed.has(value);
    const title = disabled ? "회원권 기준과 다릅니다. 관리자 강제 수동 처리를 켜면 선택할 수 있습니다." : `${minutes}분으로 변경`;
    return `<button class="duration-chip ${current === value ? "is-active" : ""}" type="button" data-lesson-duration-quick="${value}" ${disabled ? "disabled" : ""} title="${escapeHtml(title)}">${minutes}분</button>`;
  }).join("");
}

function renderLessonExpiredTickets() {
  const target = $("#lessonExpiredTickets");
  if (!target) return;
  const memberName = $("#lessonMember").value;
  const history = getExpiredTicketsForMember(memberName)
    .filter((ticket) => ["expired", "refunded", "voided"].includes(ticket.status));
  target.innerHTML = `
    <strong>만료 회원권 이력</strong>
    ${
      history.length
        ? `<ul>${history.map((ticket) => `<li>${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)} · ${ticket.purchased}~${ticket.expires}</li>`).join("")}</ul>`
        : `<span>${memberName || "선택 회원"}의 만료 이력이 없습니다.</span>`
    }
  `;
}

function renderLessonTicketHint() {
  const target = $("#lessonTicketHint");
  if (!target) return;
  renderCurrentLessonMembers();
  const memberName = $("#lessonMember")?.value || "";
  const ticket = getSelectedTicket();
  if (!memberName) {
    target.textContent = "회원 이름을 검색해 주세요.";
    return;
  }
  if (!ticket) {
    target.textContent = `${memberName} 회원에게 현재 코치로 사용할 수 있는 회원권이 없습니다.`;
    return;
  }
  const sourceLabels = isCouponLessonTicket(ticket) ? "쿠폰수업 · 보강" : "정규수업 · 보강";
  target.textContent = `${ticketParticipantNames(ticket).join(" & ") || memberName} · ${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)} · 선택 가능: ${sourceLabels}`;
}

function renderLessonPreview() {
  if (!$("#lessonPreview")) return;
  syncLessonRepeatPreviewPanel("");
  let candidate = getLessonFormCandidate();
  syncQuickLessonEntryUi(candidate);
  const pastCorrection = syncPastLessonCorrectionUi(candidate);
  candidate = getLessonFormCandidate();
  syncSameDayRegularAdjustmentPanel(candidate);
  syncAdminForceDeleteLessonButton(candidate);
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const manualOverride = adminManualOverrideEnabled();
  const sourceTicketMismatch = ticket && !ticketMatchesLessonSource(ticket, candidate.lessonSource);
  if (!candidate.time) {
    syncAdminManualOverrideUi(["선택할 수업 시간이 없습니다."]);
    $("#lessonPreview").innerHTML = `
      <strong>선택 가능한 시간이 없습니다.</strong>
      <span>${getCoachName(candidate.coachId)}의 근무 가능 시간을 확인해주세요.</span>
    `;
    setLessonFormMessage("코치 가능 시간 밖이라 수업을 추가할 수 없습니다.", "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const start = timeToMinutes(candidate.time);
  const end = start + candidate.durationMinutes;
  if (isCompletedLessonCorrectionMode()) {
    const editingLesson = getCurrentEditingLesson();
    const lessonDate = adminWeekDateForDay(candidate.day);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    const warnings = getAdminManualOverrideWarnings(candidate, ticket, false);
    const futureCompletedTime = Number.isFinite(adminLessonEndTimestamp(candidate))
      && adminLessonEndTimestamp(candidate) > Date.now();
    const blocked = Boolean(!ticket || exactDuplicate || futureCompletedTime || !editingLesson?.serverLessonId);
    const message = !ticket
      ? "완료 기록에 연결된 회원권을 찾지 못했습니다."
      : exactDuplicate
        ? "같은 회원권·날짜·시간의 수업이 이미 있어 중복 저장할 수 없습니다."
        : futureCompletedTime
          ? "완료 수업은 이미 끝난 날짜와 시간으로만 정정할 수 있습니다."
          : `완료 기록과 코치 피드백은 유지됩니다. 정책 충돌 ${warnings.length}건은 관리자 정정 이력에 남깁니다.`;
    $("#lessonPreview").innerHTML = `
      <strong>${candidate.day} ${candidate.time}~${minutesToTime(end)} · 완료 수업 정정</strong>
      <span>${getLessonMembersLabel(editingLesson)} · ${scheduleCoachDisplayName(getCoachName(candidate.coachId))} · ${candidate.durationMinutes}분 · ${lessonDate || ""}</span>
    `;
    setLessonFormMessage(message, blocked ? "danger" : "good");
    setLessonSubmitEnabled(!blocked);
    syncAdminManualOverrideUi(warnings);
    return;
  }
  if (pastCorrection) {
    const correctionReason = adminPastCorrectionReason();
    const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
    const absenceMode = pastLessonCorrectionMode() === "absence";
    if (absenceMode) {
      const editingLesson = getCurrentEditingLesson();
      const regularLesson = editingLesson && normalizeLessonSource(editingLesson.lessonSource) === "regular";
      const canCreateAbsenceRecord = Boolean(!editingLesson?.serverLessonId && ticket?.serverTicketId && !isCouponLessonTicket(ticket));
      const blocked = (!regularLesson && !canCreateAbsenceRecord) || correctionReason.length < 5;
      const overlappingActualLesson = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
        .find((lesson) => lesson.id !== editingLesson?.id && !isReleasedRegularMakeupSlot(lesson));
      const message = editingLesson?.serverLessonId && !regularLesson
          ? "정규수업만 사전 불참으로 보정할 수 있습니다."
        : !editingLesson?.serverLessonId && !ticket?.serverTicketId
          ? "불참 회원의 정규 회원권을 선택해 주세요."
        : canCreateAbsenceRecord && correctionReason.length >= 5
          ? overlappingActualLesson
            ? "실제 진행된 수업은 유지하고, 원래 정규회원의 불참·차감 없음 기록만 함께 남깁니다."
            : "원래 정규시간을 불참·차감 없음으로 기록하고 보강 신청을 엽니다."
          : correctionReason.length < 5
            ? "보정 사유를 5자 이상 입력해 주세요."
            : "횟수를 차감하지 않고 보강 신청이 가능한 상태로 바꿉니다.";
      $("#lessonPreview").innerHTML = `
        <strong>${candidate.day} ${candidate.time}~${minutesToTime(end)} · 사전 불참 보정</strong>
        <span>${getLessonMembersLabel(candidate)} · ${getCoachName(candidate.coachId)} · 횟수 차감 없음</span>
      `;
      setLessonFormMessage(message, blocked ? "danger" : "good");
      setLessonSubmitEnabled(!blocked);
      syncAdminManualOverrideUi([]);
      return;
    }
    const selectedEntitlement = selectedAdminMakeupEntitlement();
    const sourceRequiresEntitlement = candidate.lessonSource === "makeup" && !state.editingLessonId;
    const sourceInvalid = !state.editingLessonId && candidate.lessonSource === "regular";
    const conflict = getPastLessonCorrectionConflict(candidate);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    const ticketDateMismatch = ticket && (
      adminWeekDateForDay(candidate.day) < (ticket.purchased || "")
      || adminWeekDateForDay(candidate.day) > (ticket.expires || "9999-12-31")
    );
    const overrideWarnings = getAdminManualOverrideWarnings(candidate, ticket, true);
    const overrideReasonMissing = false;
    const normalMessage = !ticket || sourceTicketMismatch
      ? "선택한 수업 종류에 맞는 회원권이 없습니다."
      : sourceInvalid
        ? "새 과거 수업은 보강·쿠폰수업 또는 과거수업 보정으로 등록해 주세요."
        : sourceRequiresEntitlement && !selectedEntitlement
          ? "불참 처리에서 생성된 보강 대기를 선택해 주세요. 보강 대기가 없으면 과거수업 보정을 선택하세요."
          : ticketDateMismatch
            ? "회원권 시작일과 만료일 안의 날짜만 보정할 수 있습니다."
            : coachComment.length < 5
                ? "실제 수업 코멘트를 5자 이상 입력해 주세요."
                : conflict
                  ? conflict.message
                  : "저장 즉시 완료 처리되고 회원권 횟수가 차감됩니다.";
    const normalBlocked = Boolean(
      !ticket
      || sourceTicketMismatch
      || sourceInvalid
      || (sourceRequiresEntitlement && !selectedEntitlement)
      || ticketDateMismatch
      || coachComment.length < 5
      || conflict
    );
    const blocked = manualOverride
      ? Boolean(!ticket || exactDuplicate || coachComment.length < 5 || overrideReasonMissing)
      : normalBlocked;
    const message = manualOverride
      ? exactDuplicate
        ? "같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다. 기존 수업을 수정해 주세요."
        : overrideReasonMissing
          ? "강제 처리 사유를 5자 이상 입력해 주세요."
          : coachComment.length < 5
            ? "실제 수업 코멘트를 5자 이상 입력해 주세요."
            : `정책 충돌 ${overrideWarnings.length}건을 우회해 완료 처리하고 감사 기록을 남깁니다.`
      : normalMessage;
    $("#lessonPreview").innerHTML = `
      <strong>${candidate.day} ${candidate.time}~${minutesToTime(end)} · 과거 수업 완료 반영</strong>
      <span>${lessonSourceLabel(candidate.lessonSource)} · ${getLessonMembersLabel(candidate)} · ${getCoachName(candidate.coachId)} · ${candidate.durationMinutes}분</span>
    `;
    setLessonFormMessage(message, blocked ? "danger" : "good");
    setLessonSubmitEnabled(!blocked);
    syncAdminManualOverrideUi(overrideWarnings);
    return;
  }
  const regularScheduleValidation = getRegularScheduleValidation(ticket);
  const selectedSchedules = getSelectedLessonSchedules();
  const scheduleScopeMismatch = ticket && selectedSchedules.some((schedule) => !ticketAllowsScheduleDay(ticket, schedule.day));
  const conflict = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes) || selectedSchedules
    .map((schedule) => getLessonConflict(getLessonFormCandidate({ day: schedule.day, time: schedule.time })))
    .find(Boolean);
  const scheduleCandidates = selectedSchedules.map((schedule) => getLessonFormCandidate({ day: schedule.day, time: schedule.time }));
  const restorableRegularSlot = selectedSchedules.length === 1
    ? getRestorableReleasedRegularSlot(scheduleCandidates[0])
    : null;
  const exactDuplicate = scheduleCandidates.map((candidate) => getAdminManualExactDuplicate(candidate)).find(Boolean);
  const overrideWarnings = scheduleCandidates.flatMap((item) => getAdminManualOverrideWarnings(item, ticket, false));
  const uniqueOverrideWarnings = [...new Set(overrideWarnings)];
  const overrideReasonMissing = false;
  const internalDuplicate = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes);
  const scheduleIssueMessage = regularScheduleSaveCheckMessage(ticket, candidate, regularScheduleValidation);
  const scheduleLabel = selectedSchedules
    .map((schedule) => `${schedule.day} ${schedule.time}~${minutesToTime(timeToMinutes(schedule.time) + candidate.durationMinutes)}`)
    .join(", ");
  const repeatPreview = renderRegularSchedulePreview(ticket, candidate, regularScheduleValidation);
  syncLessonRepeatPreviewPanel(repeatPreview);
  const missingMember = !$("#lessonMember")?.value;
  $("#lessonPreview").innerHTML = `
    <strong>${scheduleLabel || `${candidate.day} ${candidate.time}~${minutesToTime(end)}`}</strong>
    <span>${lessonSourceLabel(candidate.lessonSource)} · ${getLessonMembersLabel(candidate)} · ${getCoachName(candidate.coachId)} · ${getLessonRoundLabel(candidate)} · ${lessonTypeLabel(candidate)}</span>
  `;
  const normalBlocked = Boolean(missingMember || !ticket || sourceTicketMismatch || !regularScheduleValidation.valid || scheduleIssueMessage || scheduleScopeMismatch || conflict);
  const overrideBlocked = Boolean(missingMember || !ticket || exactDuplicate || internalDuplicate || overrideReasonMissing);
  setLessonFormMessage(
    missingMember
      ? "회원 이름을 검색하거나 선택해 주세요."
      : manualOverride
      ? exactDuplicate
        ? "같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요."
        : internalDuplicate
          ? internalDuplicate.message
          : overrideReasonMissing
            ? "강제 처리 사유를 5자 이상 입력해 주세요."
            : `정책 충돌 ${uniqueOverrideWarnings.length}건을 우회해 저장하고 감사 기록을 남깁니다.`
      : !ticket || sourceTicketMismatch
      ? "선택한 수업 종류에 맞는 회원권이 없습니다. 회원권 또는 수업 종류를 확인해 주세요."
      : !regularScheduleValidation.valid
        ? regularScheduleValidation.message
      : scheduleIssueMessage
        ? scheduleIssueMessage
      : scheduleScopeMismatch
        ? `${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))}에서 이용할 수 없는 요일입니다.`
      : restorableRegularSlot
        ? "원래 불참 회원의 정규 자리입니다. 저장하면 정규수업을 복원하고 보강 대기를 취소합니다."
      : conflict
        ? conflict.message
        : "추가 가능한 시간입니다.",
    missingMember ? "" : manualOverride ? overrideBlocked ? "danger" : "good" : normalBlocked ? "danger" : "good",
  );
  if (restorableRegularSlot && $("#saveLessonButton")) {
    $("#saveLessonButton").textContent = "정규수업 복원";
  }
  setLessonSubmitEnabled(manualOverride ? !overrideBlocked : !normalBlocked);
  syncAdminManualOverrideUi(uniqueOverrideWarnings);
}

function renderSubstituteLessonList() {
  const target = $("#substituteLessonList");
  if (!target) return;
  const date = $("#substituteDate")?.value || "";
  const available = substituteLessonsForDate(date);
  const availableIds = new Set(available.map((lesson) => String(lesson.serverLessonId)));
  state.selectedSubstituteLessonIds = (state.selectedSubstituteLessonIds || [])
    .map(String)
    .filter((id) => availableIds.has(id));
  const selected = new Set(state.selectedSubstituteLessonIds);
  target.innerHTML = available.length ? `
    <div class="substitute-list-heading">
      <label><input id="selectAllSubstituteLessons" type="checkbox" ${selected.size === available.length ? "checked" : ""} /> 이날 수업 전체 선택</label>
      <span>${available.length}건</span>
    </div>
    ${available.map((lesson) => {
      const originalRoleId = lesson.originalCoachRoleId || lesson.coachRoleId;
      const isSubstitute = Boolean(lesson.originalCoachRoleId && lesson.originalCoachRoleId !== lesson.coachRoleId);
      return `
        <label class="substitute-lesson-row">
          <input type="checkbox" data-select-substitute-lesson="${escapeHtml(lesson.serverLessonId)}" ${selected.has(String(lesson.serverLessonId)) ? "checked" : ""} />
          <span><strong>${escapeHtml(lesson.time)} · ${escapeHtml(lesson.member)}</strong><small>원 담당 ${escapeHtml(coachNameForRoleId(originalRoleId))}${isSubstitute ? ` · 현재 ${escapeHtml(coachNameForRoleId(lesson.coachRoleId))}` : ""}</small></span>
          ${isSubstitute ? '<b class="status-badge pending">대타 지정</b>' : ""}
        </label>`;
    }).join("")}` : '<p class="empty-text">이 날짜에 대타 지정 가능한 수업이 없습니다.</p>';
  const all = $("#selectAllSubstituteLessons");
  if (all) all.indeterminate = selected.size > 0 && selected.size < available.length;
  const historyTarget = $("#substituteHistory");
  if (historyTarget) {
    const history = (adminLiveDataState.substituteAssignments || []).slice(0, 20);
    historyTarget.innerHTML = history.length ? history.map((assignment) => {
      const lesson = lessons.find((item) => String(item.serverLessonId) === String(assignment.lesson_id));
      const settlement = assignment.settlement_mode === "hourly"
        ? `시급 ${money.format(Number(assignment.hourly_amount) || 0)}원`
        : assignment.settlement_mode === "none"
          ? "정산 없음"
          : "실제 코치 기준";
      return `<div class="substitute-history-row"><strong>${escapeHtml(lesson ? `${lesson.lessonDate} ${lesson.time} · ${lesson.member}` : "지난 수업")}</strong><span>${escapeHtml(coachNameForRoleId(assignment.original_coach_role_id))} → ${escapeHtml(coachNameForRoleId(assignment.substitute_coach_role_id))} · ${escapeHtml(settlement)} · ${escapeHtml(assignment.status || "assigned")}</span></div>`;
    }).join("") : '<p class="empty-text">대타 이력이 없습니다.</p>';
  }
}

function renderOneDayBookingPreview() {
  const values = oneDayBookingFormValues();
  const target = $("#oneDayBookingPreview");
  const coach = coaches.find((item) => item.id === values.coachId);
  if (!target) return;
  if (!values.bookingDate || !values.time || !values.coachId) {
    target.innerHTML = "<strong>원데이 예약 시간 선택</strong><span>이름, 코치, 날짜와 시간을 입력해 주세요.</span>";
    setOneDayBookingMessage("");
    return;
  }
  const candidateStart = timeToMinutes(values.time);
  const candidateEnd = candidateStart + values.durationMinutes;
  const conflict = lessons.find((lesson) => {
    if (String(lesson.serverOneDayBookingId || "") === String(values.bookingId || "")) return false;
    if (lesson.lessonDate !== values.bookingDate || lesson.coachId !== values.coachId) return false;
    if (["cancelled", "archived"].includes(lesson.serverStatus || "")) return false;
    const lessonStart = timeToMinutes(lesson.time);
    const lessonEnd = lessonStart + Number(lesson.durationMinutes || 20);
    return candidateStart < lessonEnd && candidateEnd > lessonStart;
  });
  target.innerHTML = `
    <strong>${escapeHtml(values.bookingDate)} ${escapeHtml(values.time)}~${escapeHtml(minutesToTime(candidateEnd))}</strong>
    <span>${escapeHtml(values.guestName || "원데이 방문자")} · ${escapeHtml(getCoachName(values.coachId))} · ${values.durationMinutes}분</span>
  `;
  if (conflict) {
    setOneDayBookingMessage(`${conflict.member} 예약과 시간이 겹칩니다. 다른 시간을 선택해 주세요.`, "danger");
  } else if (!isCoachAvailableForSlot(values.coachId, scheduleDays[new Date(`${values.bookingDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${values.bookingDate}T00:00:00`).getDay() - 1], values.time, values.durationMinutes)) {
    setOneDayBookingMessage(`${coach?.name || "선택한 코치"}의 근무 시간 또는 브레이크를 확인해 주세요.`, "danger");
  } else {
    setOneDayBookingMessage("회원가입 전 원데이 예약으로 저장됩니다. 가입 후 자동 연결됩니다.", "good");
  }
}

function renderLessonAbsenceRestorePanel() {
  const panel = $("#lessonAbsenceRestorePanel");
  const entitlement = releasedAbsenceEntitlement();
  if (!panel) return;
  panel.hidden = !(entitlement && ["open", "booked"].includes(entitlement.status) && operationsRole() === "admin");
  if (panel.hidden) return;
  const bookedNote = entitlement.status === "booked"
    ? ` · 예약된 보강 ${entitlement.bookedDate} ${entitlement.bookedTime}도 취소됩니다.`
    : "";
  $("#lessonAbsenceRestoreSummary").textContent = `${entitlement.member} · ${entitlement.originalLabel} · ${entitlement.reason}${bookedNote}`;
}

function renderScheduleChangeApprovalQueue() {
  const target = $("#scheduleChangeApprovalRows");
  const count = $("#scheduleChangeApprovalCount");
  if (!target || !count) return;
  const requests = pendingLessonChangeApprovals();
  count.textContent = `${requests.length}건`;
  target.innerHTML = requests.length
    ? requests.map((request) => `
        <article class="schedule-change-approval-card">
          <header><strong>${escapeHtml(request.member)}</strong><span>${escapeHtml(request.policy || "24시간 이내")}</span></header>
          <div class="schedule-change-path">
            <span><small>현재 수업</small><b>${escapeHtml(request.original)}</b></span>
            <i aria-hidden="true">→</i>
            <span><small>요청 시간</small><b>${escapeHtml(request.requested)}</b></span>
          </div>
          <p>${escapeHtml(request.reason || "변경 사유 미입력")}</p>
          <div class="schedule-change-approval-actions">
            <button class="primary-button" type="button" data-review-change-request="${request.serverRequestId}" data-review-decision="approved">변경 승인</button>
            <button class="ghost-button" type="button" data-review-change-request="${request.serverRequestId}" data-review-decision="rejected">거절</button>
            <small>거절하면 원래 수업을 그대로 유지하며 회원권은 차감하지 않습니다.</small>
          </div>
        </article>
      `).join("")
    : `<p class="empty-text">현재 승인할 24시간 이내 변경 요청이 없습니다.</p>`;
}

function renderLessonRecordCurriculumSuggestions(choices, query) {
  const target = $("#lessonRecordCurriculumSuggestions");
  if (!target) return;
  if (!query) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  target.innerHTML = choices.length
    ? choices.map((choice, index) => {
      const step = choice.step || {};
      const detail = step.focus || step.goal || step.guide || "검색 결과에서 선택하면 다음 커리큘럼에 바로 반영됩니다.";
      const meta = [step.category || step.trackTitle, step.stageLabel || step.level].filter(Boolean).join(" · ");
      return `<button type="button" class="tn-curriculum-suggestion${index === 0 ? " is-active" : ""}" role="option" data-lesson-record-curriculum-choice="${escapeHtml(choice.value)}" data-curriculum-search-label="${escapeHtml(`${step.id || ""} ${step.title || choice.label}`.trim())}"><strong>${escapeHtml(choice.label)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}<small>${escapeHtml(detail)}</small></button>`;
    }).join("")
    : '<p class="tn-curriculum-suggestions-empty">일치하는 단계가 없습니다. 증상이나 동작을 다른 말로 입력해 보세요.</p>';
}

function renderCustomLessonColorRules() {
  const target = $("#customLessonColorRules");
  if (!target) return;
  target.innerHTML = (scheduleSettings.lessonColorRules || []).map((rule) => `
    <label class="custom-lesson-color-rule">
      <input type="text" value="${escapeHtml(rule.label || "추가 표시")}" data-custom-lesson-label="${rule.id}" aria-label="표시 이름" />
      <input type="text" value="${escapeHtml(rule.match || "")}" data-custom-lesson-match="${rule.id}" placeholder="수업 종류 문구" aria-label="적용 문구" />
      <input type="color" value="${rule.color || "#64748b"}" data-custom-lesson-color="${rule.id}" aria-label="표시 색상" />
      <button class="small-button danger" type="button" data-delete-lesson-color-rule="${rule.id}">삭제</button>
    </label>`).join("");
}

function renderScheduleSettings() {
  if (state.view !== "settings") return;
  const openStartInput = $("#openStartInput");
  const openEndInput = $("#openEndInput");
  if (!openStartInput || !openEndInput) return;
  openStartInput.value = scheduleSettings.openStart;
  openEndInput.value = scheduleSettings.openEnd;
  const requestOnlyInput = $("#memberScheduleRequestOnly");
  if (requestOnlyInput) requestOnlyInput.checked = scheduleSettings.memberScheduleRequestOnly !== false;
  const tuningModeInput = $("#adminScheduleTuningMode");
  if (tuningModeInput) tuningModeInput.checked = scheduleSettings.adminTuningMode === true;
  renderOperationProfileControls();
  ["regular", "regular30", "makeup", "coupon", "noShow"].forEach((kind) => {
    const input = $(`[data-lesson-color="${kind}"]`);
    if (input) input.value = scheduleSettings.lessonColors[kind];
  });
  renderSchedulePolicyPreview();
  renderPolicyVersionSettings();
  renderLessonPolicySettings();
  renderPolicyGuide();
  if (!Array.isArray(scheduleSettings.breakFavorites)) scheduleSettings.breakFavorites = [];
  const activeBreakCoaches = memberManagementCoachRoles();
  const editingBreakRule = scheduleSettings.breakRules.find((rule) => rule.id === state.editingBreakRuleId);
  const editingCoachRoleIds = editingBreakRule ? breakRuleCoachRoleIds(editingBreakRule) : [];
  const breakCoachOptions = $("#breakCoachOptions");
  if (breakCoachOptions) {
    breakCoachOptions.innerHTML = activeBreakCoaches.length
      ? activeBreakCoaches.map((role) => `<label><input type="checkbox" value="${escapeHtml(role.id)}" data-break-coach ${!editingBreakRule || !editingCoachRoleIds.length || editingCoachRoleIds.includes(role.id) ? "checked" : ""} /><span>${escapeHtml(String(role.display_name || "코치").replace(/\s*코치$/, ""))}</span></label>`).join("")
      : '<span class="empty-text">재직 중인 승인 코치가 없습니다.</span>';
  }
  const favoriteTarget = $("#breakFavoritePresets");
  if (favoriteTarget) {
    favoriteTarget.innerHTML = scheduleSettings.breakFavorites.length
      ? scheduleSettings.breakFavorites.map((favorite) => `
        <span class="break-favorite-chip">
          <button type="button" data-load-break-favorite="${escapeHtml(favorite.id)}" title="편집칸에 불러오기">
            <strong>${escapeHtml(favorite.label || "브레이크")}</strong>
            <small>${escapeHtml(favorite.start)}~${escapeHtml(favorite.end)}</small>
          </button>
          <button class="break-favorite-remove" type="button" data-remove-break-favorite="${escapeHtml(favorite.id)}" title="즐겨찾기 해제" aria-label="${escapeHtml(favorite.label || "브레이크")} 즐겨찾기 해제">★</button>
        </span>`).join("")
      : '<span class="empty-text">브레이크 옆 별표를 누르면 여기에 표시됩니다.</span>';
  }
  $("#breakRuleList").innerHTML = scheduleSettings.breakRules.length
    ? scheduleSettings.breakRules
      .map(
        (rule) => `
        <div class="break-rule-row">
          <strong>${rule.label || "브레이크"}</strong>
          <span>${rule.days.join(", ")} · ${rule.start}~${rule.end} · ${escapeHtml(breakRuleCoachNames(rule))}</span>
          <button class="break-favorite-toggle ${scheduleSettings.breakFavorites.some((favorite) => favorite.sourceRuleId === rule.id) ? "is-active" : ""}" type="button" data-toggle-break-favorite="${rule.id}" title="즐겨찾기 ${scheduleSettings.breakFavorites.some((favorite) => favorite.sourceRuleId === rule.id) ? "해제" : "추가"}" aria-label="${escapeHtml(rule.label || "브레이크")} 즐겨찾기">★</button>
          <button class="small-button" type="button" data-edit-break-rule="${rule.id}">수정</button>
          <button class="small-button" type="button" data-remove-break-rule="${rule.id}">삭제</button>
        </div>`,
      )
      .join("")
    : `<p class="empty-text">등록된 브레이크타임이 없습니다.</p>`;
  if (editingBreakRule) {
    $$('[data-break-day]').forEach((input) => { input.checked = editingBreakRule.days.includes(input.value); });
    if ($("#breakStartInput")) $("#breakStartInput").value = editingBreakRule.start;
    if ($("#breakEndInput")) $("#breakEndInput").value = editingBreakRule.end;
    if ($("#breakLabelInput")) $("#breakLabelInput").value = editingBreakRule.label || "브레이크";
  }
  const applyButton = $("#applyBreakRuleButton");
  if (applyButton) applyButton.textContent = editingBreakRule ? "브레이크 수정 적용" : "브레이크 추가";
}

function renderScheduleV2IntegrityResult(result, eligibleRows) {
  const summary = $("#scheduleV2IntegritySummary");
  const list = $("#scheduleV2IntegrityList");
  const applyButton = $("#scheduleV2IntegrityApplyButton");
  const rows = Array.isArray(result?.results) ? result.results : [];
  const eligibleIds = new Set(eligibleRows.map((row) => String(row.ticketId || "")));
  const blocked = rows.filter((row) => !eligibleIds.has(String(row.ticketId || "")));
  const reasonCounts = blocked.reduce((counts, row) => {
    const key = String(row.reason || (Number(row.conflictCount) > 0 ? "conflicts_only" : "unknown"));
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  if (summary) summary.textContent = eligibleRows.length
    ? `생성 가능 ${eligibleRows.length}개`
    : "자동 생성 대상 없음";
  if (list) list.innerHTML = `
    <p><strong>확정 생성 가능</strong> ${eligibleRows.length}개 회원권 · ${scheduleV2IntegrityPreviewState.plannedUnits}회차</p>
    ${Object.entries(reasonCounts).length ? `<ul>${Object.entries(reasonCounts).map(([reason, count]) => (
      `<li>${escapeHtml(scheduleV2IntegrityReasonLabel(reason))} ${count}개</li>`
    )).join("")}</ul>` : ""}
    <p class="setting-help">확정되지 않은 항목은 변경하지 않습니다. 생성 후 서버 시간표를 다시 확인합니다.</p>`;
  if (applyButton) applyButton.disabled = eligibleRows.length === 0;
}
