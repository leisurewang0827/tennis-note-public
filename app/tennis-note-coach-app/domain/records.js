// 수업 기록·피드백·코멘트를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function recentLogForLesson(lesson) {
  const names = String(lesson?.member || "")
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
  return state.lessonLogs.find((log) => log.member === lesson?.member || names.includes(log.member) || names.some((name) => log.member.includes(name)));
}

function completionParticipantsForLesson(lesson) {
  const v2Participants = Array.isArray(lesson?.v2Participants) ? lesson.v2Participants : [];
  if (v2Participants.length) return v2Participants;
  return [{
    userId: lesson?.memberUserIds?.[0] || "",
    ticketId: lesson?.ticketId || "",
    name: lesson?.member || "회원",
    ticketName: lesson?.ticket || "회원권",
    totalSessions: Number(lesson?.totalSessions) || 0,
    usedSessions: Number(lesson?.usedSessions) || 0,
    remainingSessions: Number(lesson?.remaining) || 0,
  }];
}

function recentLogForParticipant(participant, lesson) {
  const exact = state.lessonLogs.find((log) => (
    Array.isArray(log.participantResults)
    && log.participantResults.some((result) => (
      String(result.userId || "") === String(participant.userId || "")
      && String(result.ticketId || "") === String(participant.ticketId || "")
    ))
  ));
  if (exact) return exact;
  const byName = state.lessonLogs.find((log) => recordMemberNames(log.member).includes(participant.name));
  return byName || recentLogForLesson(lesson);
}

function participantLogResult(log, participant) {
  const exact = Array.isArray(log?.participantResults)
    ? log.participantResults.find((result) => (
      String(result.userId || "") === String(participant.userId || "")
      && String(result.ticketId || "") === String(participant.ticketId || "")
    ))
    : null;
  return exact || null;
}

function completionDraftResultsForLog(log) {
  if (Array.isArray(log?.participantResults) && log.participantResults.length) return log.participantResults;
  return [{
    userId: "",
    ticketId: "",
    name: log?.member || "회원",
    ticketName: "",
    totalSessions: 0,
    usedSessions: 0,
    remainingSessions: 0,
    coachComment: log?.coachComment || "",
    nextCurriculumId: log?.nextCurriculumId || log?.curriculumId || "",
  }];
}

function recordMemberNames(value = "") {
  return String(value)
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
}

function lessonForRecord(record = {}) {
  if (record.serverLessonId) {
    const serverLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === record.serverLessonId);
    return serverLesson || null;
  }
  const names = recordMemberNames(record.member);
  return weekLessons().find((lesson) => {
    const lessonNames = recordMemberNames(lesson.member);
    if (!names.some((name) => lessonNames.includes(name))) return false;
    const lessonLabel = String(record.lesson || "");
    return (!lesson.day || lessonLabel.includes(lesson.day)) && (!lesson.time || lessonLabel.includes(lesson.time));
  }) || null;
}

function coachRecordLessonMeta(record = {}) {
  const lesson = lessonForRecord(record);
  if (!lesson) {
    return {
      schedule: String(record.lesson || "수업 시간 확인 필요"),
      round: "회차 확인 필요",
      ticket: "회원권 확인 필요",
    };
  }
  const date = String(lesson.lessonDate || "");
  const [, month, day] = date.split("-");
  const dateLabel = month && day
    ? `${Number(month)}/${Number(day)}(${lesson.day || ""})`
    : lesson.day || "날짜 확인";
  const round = coachScheduleRoundLabel(lesson);
  return {
    schedule: `${dateLabel} ${lesson.time || "시간 확인"}`.trim(),
    round: round === "0/0회차" ? "회차 미연결" : round,
    ticket: String(lesson.ticket || lesson.type || "회원권 확인 필요"),
  };
}

function coachRecordLessonMetaMarkup(record = {}) {
  const meta = coachRecordLessonMeta(record);
  return `
    <div class="record-lesson-meta" aria-label="처리할 수업 정보">
      <b>${escapeHtml(meta.schedule)}</b>
      <span>${escapeHtml(meta.round)}</span>
      <small>${escapeHtml(meta.ticket)}</small>
    </div>`;
}

function memberForRecord(record = {}) {
  const names = recordMemberNames(record.member);
  return state.members.find((member) => names.includes(member.name))
    || state.members.find((member) => names.some((name) => member.name.includes(name) || name.includes(member.name)))
    || null;
}

function recordBelongsToCurrentCoach(record = {}) {
  const lesson = lessonForRecord(record);
  if (lesson) return lessonAssignedToCurrentCoachForTasks(lesson) && canProcessLesson(lesson);
  if (record.serverLessonId) return false;
  const member = memberForRecord(record);
  return Boolean(member?.coach && canonicalCoachName(member.coach) === currentCoachName());
}

function feedbackBelongsToCurrentCoach(request = {}) {
  const lessonId = String(request.lessonId || request.lesson_id || request.serverLessonId || "").trim();
  if (lessonId) {
    const lesson = [...(state.liveLessons || []), ...(state.todayLessons || [])].find((item) => (
      String(item.serverLessonId || item.id || "") === lessonId
    ));
    return Boolean(lesson && lessonAssignedToCurrentCoachForTasks(lesson) && canProcessLesson(lesson));
  }
  const targetCoachRoleId = String(
    request.coachRoleId || request.coach_role_id || request.targetCoachRoleId || request.target_coach_role_id || "",
  ).trim();
  if (targetCoachRoleId && currentCoachRoleId()) return targetCoachRoleId === currentCoachRoleId();
  if (state.dataMode === "live" || state.liveProfileId) return false;
  return canonicalCoachName(requestCoach(request)) === currentCoachName();
}

function ownPendingLessonLogs() {
  return state.lessonLogs.filter((log) => {
    if (log.status === "확인 완료" || !recordBelongsToCurrentCoach(log)) return false;
    const lesson = lessonForRecord(log);
    return lesson ? lessonOutcomeWindowOpen(lesson) : !(state.dataMode === "live" || state.liveProfileId);
  });
}

function ownPendingFeedbackRequests() {
  return state.feedbackRequests.filter((request) => request.status !== "코치 답변 완료" && feedbackBelongsToCurrentCoach(request));
}

function completedFeedbackTimestamp(item = {}) {
  return item.completedAt
    || item.completed_at
    || item.confirmedAt
    || item.answeredAt
    || item.updatedAt
    || item.updated_at
    || "";
}

function completedFeedbackVisibleForOneDay(item = {}, now = Date.now()) {
  const completedAt = Date.parse(completedFeedbackTimestamp(item));
  if (!Number.isFinite(completedAt)) return state.dataMode !== "live" && !state.liveProfileId;
  const elapsed = now - completedAt;
  return elapsed >= 0 && elapsed < completedFeedbackVisibilityMs;
}

function ownCompletedLessonLogs() {
  return state.lessonLogs.filter((log) => (
    log.status === "확인 완료"
    && recordBelongsToCurrentCoach(log)
    && completedFeedbackVisibleForOneDay(log)
  ));
}

function ownCompletedFeedbackRequests() {
  return state.feedbackRequests.filter((request) => (
    request.status === "코치 답변 완료"
    && feedbackBelongsToCurrentCoach(request)
    && completedFeedbackVisibleForOneDay(request)
  ));
}

function coachRecordStatusFilter() {
  return state.recordStatusFilter === "completed" ? "completed" : "pending";
}

function lessonPermissionText(lesson) {
  if (canRescheduleLesson(lesson)) return "내 수업이라 일정 수정과 완료 처리가 가능합니다.";
  if (canProcessLesson(lesson)) return "내 수업 완료 처리와 피드백 작성이 가능합니다.";
  return "다른 코치 수업은 같은 지점 공유용으로 확인만 가능합니다.";
}

function pendingRecordTotal() {
  return ownPendingLessonLogs().length + ownPendingFeedbackRequests().length;
}

function coachAttendanceParticipantResults(lesson, outcome, deduct, reason) {
  return completionParticipantsForLesson(lesson).map((participant) => ({
    userId: participant.userId || "",
    ticketId: participant.ticketId || "",
    outcome,
    deduct: Boolean(deduct),
    technique: "",
    strength: "",
    improvement: "",
    nextGoal: "",
    coachComment: reason,
    keywords: [],
    nextCurriculumRefId: null,
    memberJournalId: null,
  }));
}

function journalMediaMarkup(log = {}) {
  if (log.mediaItems?.length) {
    return `<div class="coach-journal-media">${log.mediaItems.map((item) => {
      const name = escapeHtml(item.name || "수업 첨부");
      const url = escapeHtml(item.url || "");
      if (String(item.type || "").startsWith("video/")) {
        return `<figure><video controls preload="metadata" src="${url}" aria-label="${name}"></video><figcaption>${name}</figcaption></figure>`;
      }
      return `<figure><img src="${url}" alt="${name}" loading="lazy" /><figcaption>${name}</figcaption></figure>`;
    }).join("")}</div>`;
  }
  if (!log.mediaNames?.length) return "";
  return `<div class="media-list">${log.mediaNames.map((name) => `<b class="media-chip">${escapeHtml(name)}</b>`).join("")}</div>`;
}

function recordProcessingMarkup() {
  importMemberLessonLogs();
  importPracticeFeedbackRequests();
  const pendingLogs = ownPendingLessonLogs();
  const pendingFeedback = ownPendingFeedbackRequests();
  const completedLogs = ownCompletedLessonLogs();
  const completedFeedback = ownCompletedFeedbackRequests();
  const recordFilter = coachRecordStatusFilter();
  const recordTabs = `
    <div class="record-status-tabs" role="tablist" aria-label="피드백 작성 상태">
      <button type="button" role="tab" aria-selected="${recordFilter === "pending"}" class="${recordFilter === "pending" ? "is-active" : ""}" data-record-status-filter="pending">작성 필요 <b>${pendingLogs.length + pendingFeedback.length}</b></button>
      <button type="button" role="tab" aria-selected="${recordFilter === "completed"}" class="${recordFilter === "completed" ? "is-active" : ""}" data-record-status-filter="completed">작성 완료 <b>${completedLogs.length + completedFeedback.length}</b></button>
    </div>`;
  if (recordFilter === "completed") {
    const completedItems = [
      ...completedLogs.map((log) => ({
        id: log.id,
        member: log.member,
        meta: coachRecordLessonMetaMarkup(log),
        detail: log.coachComment || "코치 피드백 저장 완료",
        kind: "수업 피드백",
      })),
      ...completedFeedback.map((request) => ({
        id: request.id,
        member: request.member,
        meta: `<div class="record-lesson-meta"><b>${escapeHtml(request.date || "날짜 확인")}</b><span>운동노트</span><small>회원 요청 피드백</small></div>`,
        detail: request.coachFeedback || "코치 답변 완료",
        kind: "운동노트 피드백",
      })),
    ].slice(0, 12);
    return `${recordTabs}
      <section class="record-section">
        <div class="record-section-title"><strong>작성 완료</strong><small>최근 완료한 피드백을 확인합니다.</small></div>
        <div class="completed-record-list">
          ${completedItems.length ? completedItems.map((item) => `
            <article class="completed-record-row">
              <div><strong>${escapeHtml(item.member || "회원")}</strong><span>${item.kind}</span></div>
              ${item.meta}
              <p>${escapeHtml(item.detail)}</p>
            </article>`).join("") : coachEmptyState({ title: "작성 완료된 피드백이 없습니다", reason: "완료 처리한 피드백이 여기에 표시됩니다.", compact: true })}
        </div>
      </section>`;
  }
  const showAllRecords = isTodayTaskExpanded("records");
  const visibleLogs = showAllRecords ? pendingLogs : pendingLogs.slice(0, 3);
  const visibleFeedback = showAllRecords ? pendingFeedback : pendingFeedback.slice(0, Math.max(0, 3 - visibleLogs.length));
  const allRecordItems = [...pendingLogs, ...pendingFeedback];
  const lessonMarkup =
    visibleLogs
      .map((log) => {
        const nextStep = selectedCurriculum(log.nextCurriculumId || log.curriculumId);
        const confirmed = log.status === "확인 완료";
        const participantResults = completionDraftResultsForLog(log);
        const hasParticipantDrafts = Array.isArray(log.participantResults) && log.participantResults.length > 0;
        const participantDraftsRequirePairs = participantResults.some((result) => result.userId || result.ticketId)
          || state.liveLessons.some((lesson) => (
            lesson.serverLessonId === log.serverLessonId
            && Array.isArray(lesson.v2Participants)
            && lesson.v2Participants.length
          ));
        const participantDraftsReady = participantResults.every((result) => (
          String(result.coachComment || "").trim().length >= 5
          && Boolean(result.nextCurriculumId)
          && (!participantDraftsRequirePairs || Boolean(result.userId && result.ticketId))
        ));
        const participantDraftMarkup = hasParticipantDrafts
          ? `<div class="lesson-participant-completion-list lesson-log-participant-list">
              ${participantResults.map((result) => {
                const resultNextStep = result.nextCurriculumId ? selectedCurriculum(result.nextCurriculumId) : null;
                const resultCommentLength = String(result.coachComment || "").trim().length;
                const ticketSummary = result.ticketName
                  ? `${result.ticketName} · 총 ${Number(result.totalSessions) || 0} / 소진 ${Number(result.usedSessions) || 0} / 잔여 ${Number(result.remainingSessions) || 0}`
                  : "연결 회원권";
                return `<section class="lesson-participant-completion-card" data-log-participant-row="${escapeHtml(log.id)}" data-user-id="${escapeHtml(result.userId || "")}" data-ticket-id="${escapeHtml(result.ticketId || "")}" data-participant-name="${escapeHtml(result.name || "회원")}">
                  <div class="lesson-participant-completion-head">
                    <strong>${escapeHtml(result.name || "회원")}</strong>
                    <span>${escapeHtml(ticketSummary)}</span>
                  </div>
                  <label>
                    <span>코치 코멘트 <small>필수 · 5자 이상</small></span>
                    <textarea data-log-participant-comment="${escapeHtml(log.id)}" rows="3" ${confirmed ? "disabled" : ""}>${escapeHtml(result.coachComment || "")}</textarea>
                    <div class="tn-comment-draft-tools">
                      <input data-log-participant-keywords="${escapeHtml(log.id)}" type="text" maxlength="160" placeholder="키워드 입력 · Enter로 초안 만들기" ${confirmed ? "disabled" : ""} />
                      <button type="button" data-generate-log-participant-comment="${escapeHtml(log.id)}" ${confirmed ? "disabled" : ""}>초안 만들기</button>
                    </div>
                    <small class="lesson-comment-count ${resultCommentLength >= 5 ? "is-ready" : ""}" data-log-participant-comment-count="${escapeHtml(log.id)}">${resultCommentLength}/5자</small>
                  </label>
                  <label>
                    <span>다음 커리큘럼 <small>필수</small></span>
                    <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="${escapeHtml(result.name || "회원")} 다음 커리큘럼 검색" ${confirmed ? "disabled" : ""} />
                    <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
                    <select data-log-participant-curriculum="${escapeHtml(log.id)}" ${confirmed ? "disabled" : ""}>
                      <option value="">검색·선택</option>
                      ${curriculumOptions(result.nextCurriculumId || "")}
                    </select>
                  </label>
                  <em>${resultNextStep ? `다음 수업: ${escapeHtml(resultNextStep.id)} · ${escapeHtml(resultNextStep.title)}` : "다음 커리큘럼 선택 필요"}</em>
                </section>`;
              }).join("")}
            </div>`
          : `<label>
              <span>코치 코멘트 <small>필수 · 5자 이상</small></span>
              <textarea data-coach-comment="${log.id}" rows="3" ${confirmed ? "disabled" : ""}>${escapeHtml(log.coachComment || "")}</textarea>
              <div class="tn-comment-draft-tools">
                <input data-log-comment-keywords="${log.id}" type="text" maxlength="160" placeholder="키워드 입력 · Enter로 초안 만들기" ${confirmed ? "disabled" : ""} />
                <button type="button" data-generate-log-comment="${log.id}" ${confirmed ? "disabled" : ""}>초안 만들기</button>
              </div>
              <small class="lesson-comment-count ${String(log.coachComment || "").trim().length >= 5 ? "is-ready" : ""}" data-log-comment-count="${log.id}">${String(log.coachComment || "").trim().length}/5자</small>
            </label>
            <label>
              <span>다음 커리큘럼 <small>필수</small></span>
              <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="다음 커리큘럼 검색" ${confirmed ? "disabled" : ""} />
              <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
              <select data-next-curriculum="${log.id}" ${confirmed ? "disabled" : ""}><option value="">검색·선택</option>${curriculumOptions(log.nextCurriculumId || log.curriculumId)}</select>
            </label>
            <em>다음 수업: ${escapeHtml(nextStep.id)} · ${escapeHtml(nextStep.title)}</em>`;
        return `
          <article class="work-card log-card lesson-completion-card ${state.focusedLogId === log.id ? "is-focused" : ""}" data-log-card="${log.id}">
            <div class="log-main">
              <div class="lesson-completion-card-head">
                <strong>${escapeHtml(log.member)}</strong>
                <b>${escapeHtml(coachStatusLabel("coachRecord", log.serverDeducted || log.ticketDeducted ? "deducted" : log.status, log.status))}</b>
              </div>
              ${coachRecordLessonMetaMarkup(log)}
              ${confirmed ? `<p class="coach-comment-view">코치 코멘트: ${log.coachComment}</p>` : ""}
              <details class="lesson-log-reference">
                <summary>수업 참고</summary>
                <span>${log.content}</span>
                <small>${log.selfMemo}</small>
                ${journalMediaMarkup(log)}
              </details>
            </div>
            <div class="coach-confirm-panel">
              ${participantDraftMarkup}
              ${log.validationMessage ? `<p class="validation-text">${log.validationMessage}</p>` : ""}
              <div class="actions">
                <button class="approve-button" type="button" data-confirm-log="${log.id}" ${confirmed || log.status === "서버 처리 중" || !participantDraftsReady ? "disabled" : ""}>
                  ${["동기화 대기", "동기화 실패"].includes(log.status) ? "다시 동기화" : "수업 완료·횟수 차감"}
                </button>
              </div>
            </div>
          </article>`;
      })
      .join("") || coachEmptyState({
        title: "확인할 수업 기록이 없습니다",
        reason: "수업이 끝나면 코멘트와 다음 커리큘럼을 등록해 횟수를 차감합니다.",
        action: { label: "오늘 수업 보기", view: "todayView", primary: false },
        compact: true,
      });
  const feedbackMarkup =
    visibleFeedback
      .map((request) => {
        const done = request.status === "코치 답변 완료";
        const media = (request.mediaNames || []).map((name) => `<b class="media-chip">${name}</b>`).join("");
        return `
          <article class="work-card log-card">
            <div class="log-main">
              <strong>${request.member} · 운동노트 · ${request.date}</strong>
              <span>${request.type} · ${request.memo}</span>
              <small>질문: ${request.question || "코치 피드백 요청"}</small>
              ${media ? `<div class="media-list">${media}</div>` : ""}
              ${done ? `<p class="coach-comment-view">답변: ${request.coachFeedback}</p>` : ""}
            </div>
            <div class="coach-confirm-panel">
              <label>
                <span>운동노트 코멘트</span>
                <textarea data-feedback-comment="${request.id}" rows="3" ${done ? "disabled" : ""}>${request.coachFeedback || ""}</textarea>
              </label>
              ${request.validationMessage ? `<p class="validation-text">${request.validationMessage}</p>` : ""}
              <div class="actions">
                <b>${request.status}</b>
                <button class="approve-button" type="button" data-confirm-feedback="${request.id}" ${done ? "disabled" : ""}>피드백 보내기</button>
              </div>
            </div>
          </article>`;
      })
      .join("") || coachEmptyState({
        title: "운동노트 피드백 요청이 없습니다",
        reason: "회원이 사진·영상 기록에 피드백을 요청하면 여기에 표시됩니다.",
        compact: true,
      });
  return `${recordTabs}
    <section class="record-section">
      <div class="record-section-title">
        <strong>수업 완료</strong>
        <small>코멘트와 다음 커리큘럼을 등록하면 횟수가 차감됩니다.</small>
      </div>
      ${lessonMarkup}
    </section>
    <section class="record-section">
      <div class="record-section-title">
        <strong>운동노트 피드백</strong>
        <small>회원이 올린 사진/영상 운동노트 코멘트를 같은 화면에서 처리합니다.</small>
      </div>
      ${feedbackMarkup}
    </section>
    ${todayTaskToggleButton(allRecordItems, "records")}`;
}

function coachLogCommentEntries(log) {
  if (Array.isArray(log?.participantResults) && log.participantResults.length) {
    return log.participantResults.map((result) => ({
      memberNames: [result.name].filter(Boolean),
      comment: result.coachComment || "",
    }));
  }
  return [{ memberNames: recordMemberNames(log?.member), comment: log?.coachComment || "" }];
}

function coachCommentValidationMessage(log) {
  const comment = log.coachComment || "";
  const normalized = normalizeCoachComment(comment);
  const weakPhrases = ["수고했습니다", "잘했습니다", "좋아요", "확인완료", "다음에이어", "다음시간에이어", "고생했습니다", "괜찮습니다"];
  if (normalized.length < 5) return "코치 코멘트는 직접 5자 이상 작성해야 합니다.";
  if (weakPhrases.some((phrase) => {
    const normalizedPhrase = normalizeCoachComment(phrase);
    return normalized.includes(normalizedPhrase) && normalized.length <= normalizedPhrase.length + 4;
  })) {
    return "반복되는 짧은 칭찬/확인 문구만으로는 횟수 차감이 불가합니다.";
  }
  const currentMemberNames = recordMemberNames(log.member);
  const sameMemberDuplicateCount = state.lessonLogs.filter((item) => (
    item.id !== log.id
    && coachLogCommentEntries(item).some((entry) => (
      currentMemberNames.some((name) => entry.memberNames.includes(name))
      && normalizeCoachComment(entry.comment) === normalized
    ))
  )).length;
  if (sameMemberDuplicateCount >= 2) return "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.";
  return "";
}

function lessonChangeReviewErrorMessage(error, action = "처리") {
  const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
  const messages = {
    request_not_pending: "다른 사용자가 먼저 처리했습니다. 새로고침해 주세요.",
    effective_coach_or_admin_required: "현재 담당 코치 또는 관리자만 처리할 수 있습니다.",
    target_time_occupied: "요청한 시간에 다른 수업이 생겼습니다. 회원에게 새 시간을 요청해 주세요.",
    target_effective_coach_unavailable: "현재 담당 코치의 근무시간과 맞지 않습니다.",
  };
  const key = Object.keys(messages).find((candidate) => code.includes(candidate));
  return messages[key] || `${action} 실패: ${code}`;
}

function coachPendingSyncLogs() {
  return state.lessonLogs.filter((log) => ["동기화 대기", "동기화 실패"].includes(log.status) && log.serverLessonId);
}
