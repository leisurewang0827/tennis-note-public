// 시간표 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderScheduleEditPanel() {
  const lesson = ensureCoachLessonRecord(state.editingLessonId);
  if (!lesson) {
    return `<section class="schedule-edit-panel is-empty"><strong>레슨 카드를 누르면 오늘 레슨을 바로 수정할 수 있습니다.</strong></section>`;
  }
  const canProcess = canProcessLesson(lesson);
  const canFinalize = canProcess && lessonOutcomeWindowOpen(lesson);
  const canReschedule = canRescheduleLesson(lesson);
  const finalized = lessonChartFinalized(lesson);
  const completionParticipants = completionParticipantsForLesson(lesson);
  const participantTabs = completionParticipants.length > 1
    ? `<div class="lesson-chart-member-tabs" role="tablist" aria-label="그룹 회원 선택">${completionParticipants.map((participant, index) => `<button type="button" role="tab" class="${index === 0 ? "is-active" : ""}" aria-selected="${index === 0}" data-lesson-participant-tab="${escapeHtml(lessonChartParticipantKey(participant, index))}">${escapeHtml(participant.name || `회원 ${index + 1}`)}</button>`).join("")}</div>`
    : "";
  const participantCompletionFields = completionParticipants.map((participant, index) => {
    const key = lessonChartParticipantKey(participant, index);
    const defaults = lessonChartParticipantDefaults(lesson, participant, index);
    const total = Number(participant.totalSessions) || Number(lesson.totalSessions) || 0;
    const used = Number(participant.usedSessions) || Math.max(0, total - (Number(participant.remainingSessions) || Number(lesson.remaining) || 0));
    const remaining = Number(participant.remainingSessions) || Number(lesson.remaining) || 0;
    const finalComment = participant.coachComment || participant.coach_comment || "";
    const finalCurriculumId = participant.nextCurriculumId || participant.nextCurriculumSkillLabel || participant.next_curriculum_skill_label || "";
    const finalCurriculumTitle = participant.nextCurriculumTitle || participant.next_curriculum_title || (finalCurriculumId ? selectedCurriculum(finalCurriculumId)?.title : "");
    if (finalized) {
      const outcome = String(participant.outcome || "completed").toLowerCase();
      const outcomeLabel = outcome === "no_show" ? "노쇼" : outcome === "absence" ? "불참" : "완료";
      const deducted = Number(participant.deductedSessions ?? participant.deducted_sessions) || 0;
      const feedbackEditing = outcome === "completed" && lesson.feedbackRevisionKey === key;
      return `
        <section class="lesson-participant-completion-card lesson-chart-participant is-final ${feedbackEditing ? "is-feedback-editing" : ""}" data-lesson-participant-panel="${escapeHtml(key)}" data-feedback-revision-row="${escapeHtml(key)}" data-user-id="${escapeHtml(participant.userId)}" data-record-updated-at="${escapeHtml(participant.updatedAt || "")}" ${index === 0 ? "" : "hidden"}>
          ${completionParticipants.length > 1 ? `<strong class="lesson-chart-participant-name">${escapeHtml(participant.name || "회원")}</strong>` : ""}
          <div class="lesson-chart-result-line"><b>${escapeHtml(outcomeLabel)}</b><span>${deducted ? `${deducted}회 차감` : "차감 없음"} · 잔여 ${remaining}회</span></div>
          ${outcome === "completed" && feedbackEditing ? `
            <label class="lesson-required-field">
              <span>코치 피드백 <small>횟수는 변경되지 않음</small></span>
              <textarea data-feedback-revision-comment rows="5" maxlength="500">${escapeHtml(finalComment)}</textarea>
              <small class="lesson-comment-count">5자 이상</small>
            </label>
            <label class="lesson-required-field">
              <span>다음 목표 <small>필수</small></span>
              <input data-curriculum-option-search type="search" value="${escapeHtml(finalCurriculumId && finalCurriculumTitle ? `${finalCurriculumId} · ${finalCurriculumTitle}` : "")}" placeholder="동작·증상·목표·코드 검색" aria-label="${escapeHtml(participant.name || "회원")} 다음 목표 검색" />
              <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
              <select data-feedback-revision-curriculum>
                <option value="">검색·선택</option>
                ${curriculumOptions(finalCurriculumId)}
              </select>
            </label>
            <div class="actions lesson-feedback-revision-actions"><button class="approve-button" type="button" data-save-final-feedback="${escapeHtml(lesson.id)}">피드백 저장</button><button class="small-button" type="button" data-cancel-final-feedback="${escapeHtml(lesson.id)}">취소</button></div>
          ` : outcome === "completed" ? `<div class="lesson-chart-readonly"><span>코치 피드백</span><p>${escapeHtml(finalComment || "등록된 피드백이 없습니다.")}</p></div><div class="lesson-chart-readonly"><span>다음 목표</span><strong>${escapeHtml(finalCurriculumTitle || "선택 안 됨")}</strong>${finalCurriculumId ? `<small>${escapeHtml(finalCurriculumId)}</small>` : ""}</div><button class="small-button" type="button" data-edit-final-feedback="${escapeHtml(key)}">피드백 수정</button>` : ""}
          <button class="small-button lesson-chart-history-toggle" type="button" data-toggle-lesson-history="${escapeHtml(key)}">지난 기록 보기</button>
          <div class="lesson-chart-history" data-lesson-history-panel="${escapeHtml(key)}" hidden>${participant.userId ? coachMemberChartPanelMarkup(participant.userId, participant.name || "회원", 5) : '<p class="member-chart-state">연결된 회원 기록이 없습니다.</p>'}</div>
        </section>`;
    }
    return `
      <section class="lesson-participant-completion-card lesson-chart-participant" data-modal-participant-row="${escapeHtml(lesson.id)}" data-lesson-participant-panel="${escapeHtml(key)}" data-user-id="${escapeHtml(participant.userId)}" data-ticket-id="${escapeHtml(participant.ticketId)}" data-participant-name="${escapeHtml(participant.name || "회원")}" data-ticket-name="${escapeHtml(participant.ticketName || lesson.ticket || "회원권")}" data-total-sessions="${total}" data-used-sessions="${used}" data-remaining-sessions="${remaining}" ${index === 0 ? "" : "hidden"}>
        ${completionParticipants.length > 1 ? `<strong class="lesson-chart-participant-name">${escapeHtml(participant.name || "회원")}</strong>` : ""}
        <div class="lesson-chart-goal"><span>오늘 목표</span><strong>${escapeHtml(defaults.todayGoal)}</strong></div>
        <button class="small-button lesson-chart-history-toggle" type="button" data-toggle-lesson-history="${escapeHtml(key)}">지난 기록 보기</button>
        <div class="lesson-chart-history" data-lesson-history-panel="${escapeHtml(key)}" hidden>${participant.userId ? coachMemberChartPanelMarkup(participant.userId, participant.name || "회원", 5) : '<p class="member-chart-state">연결된 회원 기록이 없습니다.</p>'}</div>
        <label class="lesson-required-field">
          <span>메모 <small>${canFinalize ? "완료 시 회원에게 공개" : "코치만 보는 임시 메모"}</small></span>
          <textarea data-modal-coach-comment="${escapeHtml(lesson.id)}" rows="5" placeholder="수업 내용이나 피드백을 입력하세요" ${canProcess ? "" : "disabled"}>${escapeHtml(defaults.comment)}</textarea>
          <details class="lesson-ai-draft">
            <summary>AI</summary>
            <div class="tn-comment-draft-tools">
              <input data-modal-comment-keywords="${escapeHtml(lesson.id)}" type="text" maxlength="160" placeholder="허리 회전, 타점, 리듬" ${canProcess ? "" : "disabled"} />
              <button type="button" data-generate-modal-comment="${escapeHtml(lesson.id)}" ${canProcess ? "" : "disabled"}>초안 만들기</button>
            </div>
          </details>
          <small class="lesson-comment-count" data-modal-comment-count="${escapeHtml(lesson.id)}">0/5자</small>
        </label>
        <label class="lesson-required-field">
          <span>다음 목표 <small>${canFinalize ? "필수" : "미리 선택 가능"}</small></span>
          <input data-curriculum-option-search type="search" placeholder="동작·증상·목표·코드 검색" aria-label="${escapeHtml(participant.name || "회원")} 다음 목표 검색" ${canProcess ? "" : "disabled"} />
          <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
          <select data-modal-next-curriculum="${escapeHtml(lesson.id)}" ${canProcess ? "" : "disabled"}>
            <option value="">검색·선택</option>
            ${curriculumOptions(defaults.nextCurriculumId)}
          </select>
        </label>
      </section>`;
  }).join("");
  const scheduleEditDraft = lesson.scheduleEditDraft || {};
  const selectedEditDay = scheduleEditDraft.day || lesson.day;
  const selectedEditTime = scheduleEditDraft.time || lesson.time;
  const dayOptions = ["월", "화", "수", "목", "금", "토", "일"].map((day) => `<option value="${day}" ${selectedEditDay === day ? "selected" : ""}>${day}요일</option>`).join("");
  const schedulePolicy = loadCoachSchedulePolicy();
  const latestStartMinutes = Math.max(
    minutesFromTime(schedulePolicy.openStart),
    minutesFromTime(schedulePolicy.openEnd) - lessonDuration(lesson),
  );
  const latestStart = `${String(Math.floor(latestStartMinutes / 60)).padStart(2, "0")}:${String(latestStartMinutes % 60).padStart(2, "0")}`;
  const availableTimes = makeCoachTimeRange(schedulePolicy.openStart, latestStart);
  if (!availableTimes.includes(selectedEditTime)) availableTimes.push(selectedEditTime);
  availableTimes.sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
  const timeOptions = availableTimes
    .map((time) => `<option value="${time}" ${selectedEditTime === time ? "selected" : ""}>${time}</option>`)
    .join("");
  return `
    <section class="schedule-edit-panel lesson-action-panel">
      <div class="wide lesson-modal-head">
        <div>
          <strong>${lesson.member}</strong>
          <span>${lesson.day} ${lesson.time} · ${lessonDuration(lesson)}분${completionParticipants.length === 1 ? ` · 잔여 ${Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0}회` : ""}</span>
        </div>
        <b class="${finalized || canFinalize ? "can-process" : "read-only"}">${finalized ? "완료" : canFinalize ? "처리 필요" : canProcess ? "예정" : "보기 전용"}</b>
      </div>
      ${canFinalize && !finalized && completionParticipants.length === 1 ? `<p class="lesson-chart-deduction-preview wide">완료 시 잔여 ${Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0}회 → ${Math.max(0, (Number(completionParticipants[0]?.remainingSessions) || Number(lesson.remaining) || 0) - 1)}회</p>` : ""}
      ${participantTabs}
      <div class="lesson-participant-completion-list wide">${participantCompletionFields}</div>
      ${lesson.validationMessage ? `<p class="validation-text wide">${lesson.validationMessage}</p>` : ""}
      ${!finalized && (canReschedule || (canProcess && lesson.serverLessonId))
        ? `<details class="lesson-secondary-panel lesson-other-actions wide">
            <summary>다른 처리</summary>
            ${canReschedule ? `
            <div class="lesson-edit-mini">
              <strong>일정 변경</strong>
              <div class="lesson-edit-grid">
                <label>
                  <span>요일</span>
                  <select id="editLessonDay">${dayOptions}</select>
                </label>
                <label>
                  <span>시간</span>
                  <select id="editLessonTime">${timeOptions}</select>
                </label>
                <label class="wide">
                  <span>변경 사유</span>
                  <input id="editLessonReason" type="text" maxlength="200" value="${escapeHtml(scheduleEditDraft.reason || "")}" placeholder="회원에게 안내할 변경 사유" />
                </label>
              </div>
              <p class="permission-note">근무시간 안의 브레이크 시간은 코치가 직접 변경할 수 있습니다. 회원 직접 신청은 계속 제한됩니다.</p>
              <button class="small-button" type="button" data-save-schedule-edit="${lesson.id}">일정 변경 저장</button>
            </div>
            ${canMarkRegularLessonAbsent(lesson) && lesson.serverLessonId
              ? `<div class="lesson-edit-mini lesson-absence-mini">
                  <strong>정규수업 불참</strong>
                  <div class="lesson-edit-grid">
                    <label class="wide">
                      <span>불참 사유</span>
                      <input id="coachAbsenceReason" type="text" minlength="2" maxlength="200" placeholder="예: 회원 사전 연락" />
                    </label>
                  </div>
                  <div class="actions">
                    <button class="reject-button" type="button" data-process-attendance="${lesson.id}" data-outcome="absence" data-deduct="false">불참 · 차감 없음</button>
                    <button class="small-button" type="button" data-process-attendance="${lesson.id}" data-outcome="absence" data-deduct="true">불참 · 횟수 차감</button>
                  </div>
                </div>` : ""}` : ""}
            ${canProcess && lesson.serverLessonId ? `
            <div class="lesson-edit-mini lesson-absence-mini">
              <strong>노쇼</strong>
              <div class="lesson-edit-grid">
                <label class="wide">
                  <span>노쇼 사유</span>
                  <input id="coachNoShowReason" type="text" minlength="2" maxlength="200" placeholder="예: 연락 없이 불참" />
                </label>
              </div>
              <div class="actions">
                <button class="reject-button" type="button" data-process-attendance="${lesson.id}" data-outcome="no_show" data-deduct="true">노쇼 · 차감</button>
                <button class="small-button" type="button" data-process-attendance="${lesson.id}" data-outcome="no_show" data-deduct="false">노쇼 · 차감 없음</button>
              </div>
            </div>` : ""}
          </details>`
        : ""}
      <div class="actions lesson-completion-actions wide">
        ${!finalized && canProcess ? canFinalize
          ? `<button class="approve-button" type="button" data-complete-lesson-from-modal="${lesson.id}" disabled>저장하고 완료</button>`
          : `<button class="approve-button" type="button" data-save-lesson-draft="${lesson.id}">저장</button>` : ""}
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
      ${canProcess
        ? canFinalize ? "" : `<p class="permission-note wide">${lessonOutcomeGuardMessage()}</p>`
        : `<p class="permission-note wide">${lessonPermissionText(lesson)}</p>`}
    </section>`;
}

function renderCoachScheduleOperationNotice(day) {
  const operation = coachScheduleOperationDay(day);
  if (!operation) return "";
  const mode = String(operation.mode || "");
  const label = operation.label || "운영 안내";
  const detail = mode === "closed"
    ? "수업 등록은 관리자만 가능합니다."
    : mode === "shortened"
      ? `${operation.startTime || "-"}~${operation.endTime || "-"}만 운영합니다.`
      : "공휴일에도 정상 운영합니다.";
  const title = mode === "closed" ? "휴무" : mode === "shortened" ? "단축 운영" : "정상 운영";
  return `<p class="coach-operation-notice is-${escapeHtml(mode || "normal")}" role="status"><strong>${title}</strong><span>${escapeHtml(label)} · ${escapeHtml(detail)}</span></p>`;
}

function renderCoachMobileLockedTimeControl(day, policy) {
  const times = coachLockedTimesForDay(day, policy);
  if (!times.length) return "";
  const currentRoleId = currentCoachRoleId();
  return `
    <div class="coach-mobile-locked-add">
      <label>
        <span>브레이크·상담 시간</span>
        <select data-coach-locked-time-select aria-label="브레이크·상담 시간 선택">
          ${times.map((item) => `<option value="${item.time}">${item.time} · ${escapeHtml(item.label)}</option>`).join("")}
        </select>
      </label>
      <button class="small-button" type="button" data-coach-add-locked-time data-date="${coachWeekDateForDay(day)}" data-day="${day}" data-coach-role-id="${escapeHtml(currentRoleId)}">+ 수동 등록</button>
    </div>`;
}

function renderCoachMobileSegment(day, segment, policy, scheduleLessons) {
  const times = makeCoachStartTimes(segment.start, segment.end);
  const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
  const coaches = dayCoachesForSchedule(day, policy, dayLessons).filter((coach) => {
    const worksHere = (coach.workBlocks || []).some((block) => block.days.includes(day)
      && minutesFromTime(block.start) < segment.endMinutes
      && minutesFromTime(block.end) > segment.startMinutes);
    const hasLesson = dayLessons.some((lesson) => coachFromLesson(lesson, policy).id === coach.id
      && minutesFromTime(lesson.time) < segment.endMinutes
      && minutesFromTime(lesson.time) + lessonDuration(lesson) > segment.startMinutes);
    return worksHere || hasLesson;
  });
  if (!times.length || !coaches.length) return `<p class="coach-mobile-empty">이 시간대에 운영하는 코치가 없습니다.</p>`;
  return `
    <section class="coach-mobile-segment">
      <div class="coach-mobile-segment-title"><strong>${segment.start}~${segment.end}</strong><span>${coaches.length}명 · 레슨 ${dayLessons.length}개</span></div>
      <div class="coach-mobile-lane-board" style="--coach-count:${coaches.length}; --slot-count:${times.length};">
        <div class="coach-mobile-lane-head time">시간</div>
        ${coaches.map((coach) => `<div class="coach-mobile-lane-head ${coachColorClass(coach.name)}">${escapeHtml(shortCoachName(coach.name))}</div>`).join("")}
        <div class="coach-mobile-time-rail">${times.map((time) => `<span>${time}</span>`).join("")}</div>
        ${coaches.map((coach) => {
          const coachLessons = dayLessons.filter((lesson) => coachFromLesson(lesson, policy).id === coach.id);
          return `
            <div class="coach-mobile-coach-lane">
              ${times.map((time, index) => {
                const working = isPolicyCoachWorking(coach, day, time, scheduleBlockMinutes);
                const breakRule = breakRuleForSlot(policy, day, time);
                const blockedRule = coachBlockedRuleForSlot(coach, day, time);
                const closure = coachClosureForSlot(day, time);
                const lockedRule = blockedRule || breakRule;
                return coachQuickAddSlotMarkup({
                  coach,
                  day,
                  time,
                  policy,
                  className: `coach-mobile-slot ${closure || lockedRule ? "blocked" : working ? "available" : "off"}`,
                  label: closure?.label || lockedRule?.label || (working ? "빈 시간" : "근무 외"),
                  style: `grid-row:${index + 1};`,
                });
              }).join("")}
              ${coachLessons.filter((lesson) => minutesFromTime(lesson.time) >= segment.startMinutes && minutesFromTime(lesson.time) < segment.endMinutes).map((lesson) => {
                const startIndex = times.indexOf(lesson.time);
                if (startIndex < 0) return "";
                const span = Math.max(1, Math.ceil(lessonDuration(lesson) / scheduleBlockMinutes));
                const memberLabel = formatScheduleMemberName(lesson.member || "회원");
                const note = coachScheduleExceptionLabel(lesson);
                const laneCoach = coachFromLesson(lesson, policy);
                const releasedLabel = lesson.historicalReleasedSlot ? "과거 빈자리" : "예약 가능한 빈자리";
                const primaryLabel = lesson.releasedMakeupSlot ? releasedLabel : memberLabel;
                const roundOrState = lesson.releasedMakeupSlot
                  ? `${memberLabel} 불참으로 발생`
                  : coachScheduleRoundLabel(lesson);
                const cardNote = lesson.releasedMakeupSlot
                  ? (lesson.historicalReleasedSlot ? "차감 없음" : "보강·원데이 가능")
                  : note;
                return `<button class="coach-mobile-lesson lesson-source lesson-kind-${coachLessonVisualKind(lesson)} ${lesson.releasedMakeupSlot ? "released-makeup-slot" : ""} ${coachColorClass(laneCoach.name)} ${coachLessonStateClass(lesson)}" type="button" ${coachScheduleLessonActionAttrs(lesson)} style="${coachLessonColorStyle(lesson, policy)};grid-row:${startIndex + 1} / span ${span};"><strong>${escapeHtml(primaryLabel)}</strong><span>${escapeHtml(roundOrState)}</span><small class="schedule-card-note ${cardNote ? "" : "is-empty"}">${escapeHtml(cardNote || "-")}</small></button>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderCoachMineEmptyState(policy, scheduleLessons) {
  if (state.scheduleFilter !== "mine") return "";
  const selectedDay = selectedCoachScheduleDay();
  const currentRoleId = currentCoachRoleId();
  const currentName = currentCoachName();
  const currentCoach = policy.coaches.find((coach) => (
    String(coach.roleId || coach.id || "") === currentRoleId
    || canonicalCoachName(coach.name) === currentName
  ));
  const worksOnSelectedDay = Boolean(currentCoach?.workBlocks?.some((block) => block.days.includes(selectedDay)));
  const lessonsOnSelectedDay = scheduleLessons.filter((lesson) => lesson.day === selectedDay);
  if (worksOnSelectedDay || lessonsOnSelectedDay.length) return "";

  const nextLessonDay = scheduleDays.find((day) => scheduleLessons.some((lesson) => lesson.day === day));
  const nextLessonCount = nextLessonDay
    ? scheduleLessons.filter((lesson) => lesson.day === nextLessonDay).length
    : 0;
  return `
    <section class="tn-empty-state coach-schedule-filter-empty" role="status">
      <strong>${selectedDay}요일에는 내 수업이 없습니다</strong>
      <p>지점의 다른 코치 수업은 전체 시간표에서 확인할 수 있습니다.</p>
      <div class="actions">
        <button class="primary-button" type="button" data-coach-schedule-show-all>전체 시간표 보기</button>
        ${nextLessonDay ? `<button class="small-button" type="button" data-coach-schedule-jump-day="${nextLessonDay}">${nextLessonDay}요일 내 수업 ${nextLessonCount}건</button>` : ""}
      </div>
    </section>`;
}

function renderCoachMobileSchedule(policy, scheduleLessons) {
  const selectedDay = selectedCoachScheduleDay();
  const mineEmptyState = renderCoachMineEmptyState(policy, scheduleLessons);
  const segments = coachMobileScheduleSegments(selectedDay, policy, scheduleLessons);
  return `
    <div class="coach-mobile-schedule">
      <div class="coach-mobile-day-strip" aria-label="날짜 선택">
        ${scheduleDays.map((day) => `<button class="coach-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-coach-schedule-day="${day}"><strong>${day}</strong><span>${coachScheduleDateLabel(day)}</span></button>`).join("")}
      </div>
      ${renderCoachScheduleOperationNotice(selectedDay)}
      ${renderCoachMobileLockedTimeControl(selectedDay, policy)}
      ${mineEmptyState || (segments.length
        ? segments.map((segment, index) => `${index > 0 ? `<div class="coach-mobile-break"><strong>${segments[index - 1].end}~${segment.start}</strong><span>수업 없음</span></div>` : ""}${renderCoachMobileSegment(selectedDay, segment, policy, scheduleLessons)}`).join("")
        : `<p class="coach-mobile-empty">${selectedDay}요일은 현재 등록된 운영시간이 없습니다.</p>`)}
    </div>`;
}

function renderFullSchedule() {
  if (!$("#fullScheduleBoard")) return;
  if (state.scheduleV2SyncError && !state.scheduleV2WorkspaceLoaded) {
    $("#fullScheduleBoard").innerHTML = `
      <section class="tn-empty-state" role="alert">
        <strong>시간표를 불러오지 못했습니다</strong>
        <p>${escapeHtml(state.scheduleV2SyncError)}</p>
        <button id="retryCoachScheduleV2" class="primary-button" type="button">다시 불러오기</button>
      </section>`;
    $("#retryCoachScheduleV2")?.addEventListener("click", () => {
      state.scheduleV2SyncError = "";
      state.liveLessonsLoaded = false;
      renderFullSchedule();
      void syncCoachLessonsFromServer().then(() => renderAll());
    });
    return;
  }
  const scheduleFilter = state.scheduleFilter || "mine";
  if (["mine", "all"].includes(scheduleFilter) && !coachSchedulePolicyReady()) {
    $("#fullScheduleBoard").innerHTML = `
      <section class="tn-empty-state coach-schedule-policy-loading" role="status" aria-live="polite">
        <strong>코치 근무시간을 확인하고 있습니다</strong>
        <p>확인되지 않은 기본 시간표는 표시하지 않습니다.</p>
      </section>`;
    return;
  }
  ensureMemberLists();
  const policy = loadCoachSchedulePolicy();
  const weekIndex = activeWeekIndex();
  const week = activeScheduleWeek();
  const lessonsForWeek = filterFullScheduleLessons(weekLessons(), scheduleFilter);
  const scheduleContent = scheduleFilter === "makeupChange"
    ? renderCoachRequestTimeline(lessonsForWeek)
    : scheduleFilter === "feedback"
      ? renderCoachFeedbackScheduleList(lessonsForWeek)
      : renderCoachMobileSchedule(policy, lessonsForWeek);
  const scheduleGuide = scheduleFilter === "makeupChange"
    ? "승인할 요청, 시간을 정할 보강, 처리 완료 내역을 날짜·시간순으로 확인합니다."
    : scheduleFilter === "feedback"
      ? "피드백을 작성해야 하는 내 수업만 날짜·시간순으로 표시합니다."
      : "요일을 고른 뒤 빈칸은 수업 등록, 수업 카드는 변경·완료·피드백 처리에 사용합니다.";
  $("#fullScheduleBoard").innerHTML = `
    <div class="coach-week-calendar">
      <div class="coach-week-controls">
        <button class="small-button schedule-week-arrow" type="button" data-change-week="-1" ${weekIndex <= coachScheduleMinWeekOffset ? "disabled" : ""} aria-label="이전 주" title="이전 주">&lt;</button>
        <div class="schedule-period-summary">
          <strong>${week.label}</strong>
          <span>${week.range} · ${fullScheduleFilterLabel(scheduleFilter)} · 관리자 근무시간 기준</span>
        </div>
        <button class="small-button schedule-week-arrow" type="button" data-change-week="1" ${weekIndex >= coachScheduleMaxWeekOffset ? "disabled" : ""} aria-label="다음 주" title="다음 주">&gt;</button>
      </div>
      <div class="schedule-filter-row" aria-label="전체 레슨표 필터">
        ${fullScheduleFilterOptions()
          .map(
            (filter) => `
              <button class="schedule-filter ${scheduleFilter === filter.id ? "is-active" : ""}" type="button" data-schedule-filter="${filter.id}">
                ${filter.label}
              </button>`,
          )
          .join("")}
      </div>
    </div>
    <p class="coach-day-schedule-guide">${scheduleGuide}</p>
    ${scheduleContent}`;
}

function renderCoachRequestTimeline(scheduleLessons = []) {
  const items = [...scheduleLessons]
    .map((lesson) => ({ lesson, state: coachRequestTimelineState(lesson), date: coachRequestTimelineDate(lesson) }))
    .sort((left, right) => (
      left.state.order - right.state.order
      || `${left.date} ${left.lesson.time || ""}`.localeCompare(`${right.date} ${right.lesson.time || ""}`)
    ));
  if (!items.length) {
    return coachEmptyState({
      title: "확인할 변경·보강이 없습니다",
      reason: "새 요청이나 시간을 정할 보강이 생기면 날짜순으로 표시됩니다.",
      compact: true,
    });
  }
  const groups = [
    { id: "approval", title: "승인할 요청" },
    { id: "slot", title: "시간을 정할 보강" },
    { id: "changed", title: "변경 완료" },
    { id: "booked", title: "보강 확정" },
  ];
  return `<div class="coach-request-timeline">
    ${groups.map((group) => {
      const groupItems = items.filter((item) => item.state.id === group.id);
      if (!groupItems.length) return "";
      return `<section class="coach-request-group" aria-label="${group.title}">
        <div class="coach-request-group-title"><strong>${group.title}</strong><span>${groupItems.length}건</span></div>
        <div class="coach-request-list">
          ${groupItems.map(({ lesson, state: itemState, date }) => `
            <button class="coach-request-row ${itemState.id}" type="button" ${coachScheduleLessonActionAttrs(lesson)}>
              <time>${escapeHtml(date || lesson.day || "날짜 확인")} · ${escapeHtml(lesson.time || "시간 확인")}</time>
              <strong>${escapeHtml(lesson.member || "회원")}</strong>
              <span>${escapeHtml(lesson.coach || "담당 코치")} · ${escapeHtml(lesson.type || "수업")}</span>
              <b>${itemState.label}</b>
            </button>`).join("")}
        </div>
      </section>`;
    }).join("")}
  </div>`;
}

function renderLessonEditModal() {
  const target = $("#lessonEditModalContent");
  if (!target) return;
  if (state.coachQuickAdd) {
    target.innerHTML = renderCoachQuickAddPanel();
    return;
  }
  if (state.viewingCurriculumId) {
    target.innerHTML = renderCurriculumDetailPanel();
    return;
  }
  if (state.editingMakeupId) {
    target.innerHTML = renderMakeupApprovalPanel();
    return;
  }
  if (state.writingLessonId) {
    target.innerHTML = renderLessonRecordWritePanel();
    return;
  }
  target.innerHTML = renderScheduleEditPanel();
  if (state.editingLessonId) updateLessonCompletionUi(state.editingLessonId);
}

function renderCoachQuickAddPanel() {
  const draft = state.coachQuickAdd;
  if (!draft) return "";
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id) === String(draft.coachRoleId || ""));
  const access = coach ? coachSlotAccess(coach, draft.day, draft.time, scheduleBlockMinutes, policy) : { reason: "available" };
  const lockedOverride = access.reason === "locked_time_override";
  const ticketChoices = coachQuickAddTicketChoices();
  const tickets = ticketChoices.filter((choice) => choice.availability.available).map((choice) => choice.ticket);
  const ticketOptions = ticketChoices.map(({ ticket, availability }) => {
    const reason = availability.reason ? ` · ${availability.reason}` : "";
    return `<option value="${escapeHtml(ticket.id)}" ${draft.ticketId === ticket.id ? "selected" : ""} ${availability.available ? "" : "disabled"}>${escapeHtml(`${coachQuickAddTicketLabel(ticket)}${reason}`)}</option>`;
  }).join("");
  const writeModeLabel = policy.coachSingleAddMode === "immediate"
    ? "저장하면 바로 시간표에 반영됩니다."
    : policy.coachSingleAddMode === "blocked"
      ? "현재 운영 설정에서 코치 수업 추가가 꺼져 있습니다."
      : "저장하면 관리자 승인 대기로 접수됩니다.";
  const durationOptions = [20, 30, 40, 60].map((minutes) => `<button type="button" class="${Number(draft.durationMinutes) === minutes ? "is-active" : ""}" data-coach-add-duration="${minutes}">${minutes}분</button>`).join("");
  return `
    <form class="schedule-edit-panel coach-quick-add-panel" data-coach-quick-add-form>
      <div class="wide lesson-modal-head">
        <div><strong>수업 추가</strong><span>${draft.date} · ${draft.time} · ${escapeHtml(shortCoachName(draft.coachName))}</span></div>
        <b class="can-process">${lockedOverride ? "브레이크·상담 수동 등록" : "빈 시간"}</b>
      </div>
      <div class="wide coach-quick-kind" role="group" aria-label="수업 종류">
        <button type="button" class="${draft.kind === "regular" ? "is-active" : ""}" data-coach-add-kind="regular">정규</button>
        <button type="button" class="${draft.kind === "makeup" ? "is-active" : ""}" data-coach-add-kind="makeup">보강</button>
      </div>
      <label class="wide lesson-required-field">
        <span>회원권 <small>필수</small></span>
        <select id="coachQuickAddTicket" required>
          <option value="">회원을 선택해 주세요</option>
          ${ticketOptions}
        </select>
      </label>
      <div class="wide coach-quick-duration" role="group" aria-label="수업 시간">${durationOptions}</div>
      <label class="wide">
        <span>메모 <small>선택</small></span>
        <input id="coachQuickAddNote" type="text" maxlength="200" value="${escapeHtml(draft.note || "")}" placeholder="예: 브레이크 시간 협의 등록" />
      </label>
      ${draft.validationMessage ? `<p class="validation-text wide">${escapeHtml(draft.validationMessage)}</p>` : ""}
      ${ticketChoices.length ? "" : '<p class="validation-text wide">담당 회원권이 없습니다. 관리자에게 회원권 상태와 담당 코치를 확인해 주세요.</p>'}
      <p class="permission-note wide">회원에게는 브레이크 시간이 열리지 않습니다. ${writeModeLabel}</p>
      <div class="actions wide">
        <button class="approve-button" type="button" data-save-coach-quick-add ${tickets.length ? "" : "disabled"}>시간표에 등록</button>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </form>`;
}
