// 수업 기록·피드백·코멘트를 저장하는 함수들.
//
// 코치가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function updateLessonCompletionUi(id) {
  const lesson = ensureCoachLessonRecord(id);
  const participantRows = $$('[data-modal-participant-row]').filter((row) => row.dataset.modalParticipantRow === id);
  const submit = activeViewField(`[data-complete-lesson-from-modal="${id}"]`);
  const rowsReady = participantRows.length > 0 && participantRows.every((row) => {
    const comment = row.querySelector("[data-modal-coach-comment]")?.value.trim() || "";
    const curriculumId = row.querySelector("[data-modal-next-curriculum]")?.value || "";
    const count = row.querySelector("[data-modal-comment-count]");
    if (count) {
      count.textContent = `${comment.length}/5자`;
      count.classList.toggle("is-ready", comment.length >= 5);
    }
    row.classList.toggle("is-ready", comment.length >= 5 && Boolean(curriculumId));
    return comment.length >= 5 && Boolean(curriculumId);
  });
  const ready = Boolean(lesson && canProcessLesson(lesson) && lessonOutcomeWindowOpen(lesson) && rowsReady);
  if (submit) submit.disabled = !ready;
}

function saveLessonRecord() {
  const lesson = ensureCoachLessonRecord($("#recordLessonSelect")?.value) || recordableCoachLessons()[0];
  if (!lesson) return;
  const nextCurriculumId = $("#recordNextCurriculum")?.value || "";
  const log = {
    id: `coach-record-${Date.now()}`,
    serverLessonId: lesson.serverLessonId || "",
    serverJournalId: "",
    member: lesson.member,
    lesson: `${lesson.day} ${lesson.time} ${lesson.type}`,
    content: $("#recordLessonContent")?.value.trim() || `${lesson.member} ${lesson.type} 수업 진행`,
    selfMemo: $("#recordSelfMemo")?.value.trim() || "회원 운동노트 미작성 · 코치가 수업 후 기록을 먼저 작성했습니다.",
    curriculumId: nextCurriculumId,
    nextCurriculumId,
    coachComment: $("#recordCoachComment")?.value.trim() || "",
    validationMessage: "",
    status: "확인 대기",
  };
  state.lessonLogs.unshift(log);
  state.focusedLogId = log.id;
  state.todayTaskTab = "records";
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  closeLessonEditor();
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    document.querySelector(`#todayRecordPanel [data-log-card="${log.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function applyCoachCommentDraft(keywordSource, commentSource) {
  const keywordInput = typeof keywordSource === "string" ? activeViewField(keywordSource) : keywordSource;
  const commentInput = typeof commentSource === "string" ? activeViewField(commentSource) : commentSource;
  const generator = window.TennisNoteCommentDraft;
  if (!keywordInput || !commentInput || !generator?.generate) {
    showToast("코멘트 초안 기능을 불러오지 못했습니다.");
    return;
  }
  const result = generator.generate(keywordInput.value);
  if (!result.ok) {
    showToast(result.message);
    keywordInput.focus();
    return;
  }
  commentInput.value = result.comment;
  commentInput.dispatchEvent(new Event("input", { bubbles: true }));
  commentInput.focus();
  showToast("세부 코멘트 초안을 만들었습니다. 내용을 확인한 뒤 저장해 주세요.");
}

function updateFeedbackDraft(id) {
  const request = state.feedbackRequests.find((item) => item.id === id);
  if (!request || request.status === "코치 답변 완료") return request;
  const input = activeViewField(`[data-feedback-comment="${id}"]`);
  request.coachFeedback = input?.value.trim() || "";
  request.validationMessage = "";
  return request;
}

function confirmFeedback(id) {
  const request = updateFeedbackDraft(id);
  if (!request || request.status === "코치 답변 완료") return;
  if (!request.coachFeedback) {
    request.validationMessage = "운동노트 코멘트를 입력해야 회원에게 보낼 수 있습니다.";
    renderAll();
    return;
  }
  request.status = "코치 답변 완료";
  request.answeredAt = new Date().toISOString();
  exportPracticeFeedback(request);
  renderAll();
}

function updateLogDraft(id) {
  const log = state.lessonLogs.find((item) => item.id === id);
  if (!log || log.status === "확인 완료") return log;
  const logCard = document.querySelector(`#todayRecordPanel [data-log-card="${id}"]`);
  const participantRows = [...(logCard?.querySelectorAll(`[data-log-participant-row="${id}"]`) || [])];
  if (participantRows.length) {
    const existingByPair = new Map(completionDraftResultsForLog(log).map((result) => [
      `${result.userId || ""}:${result.ticketId || ""}`,
      result,
    ]));
    log.participantResults = participantRows.map((row) => {
      const userId = row.dataset.userId || "";
      const ticketId = row.dataset.ticketId || "";
      const existing = existingByPair.get(`${userId}:${ticketId}`) || {};
      const coachComment = row.querySelector("[data-log-participant-comment]")?.value.trim() || "";
      const nextCurriculumId = row.querySelector("[data-log-participant-curriculum]")?.value || "";
      return {
        ...existing,
        userId,
        ticketId,
        name: row.dataset.participantName || existing.name || "회원",
        coachComment,
        nextCurriculumId,
        localCoachCommentDirty: coachComment !== (existing.serverCoachComment || ""),
        localNextCurriculumDirty: nextCurriculumId !== (existing.serverNextCurriculumId || ""),
      };
    });
    const primaryResult = log.participantResults[0] || {};
    log.coachComment = primaryResult.coachComment || "";
    log.nextCurriculumId = primaryResult.nextCurriculumId || "";
    log.validationMessage = "";
    updateLogCompletionUi(log);
    return log;
  }
  const commentInput = activeViewField(`[data-coach-comment="${id}"]`);
  const curriculumSelect = activeViewField(`[data-next-curriculum="${id}"]`);
  log.coachComment = commentInput?.value.trim() || "";
  log.nextCurriculumId = curriculumSelect?.value || log.nextCurriculumId || log.curriculumId;
  log.localCoachCommentDirty = log.coachComment !== (log.serverCoachComment || "");
  log.localNextCurriculumDirty = log.nextCurriculumId !== (log.serverNextCurriculumId || "");
  log.validationMessage = "";
  updateLogCompletionUi(log);
  return log;
}

function updateLogCompletionUi(log) {
  if (!log) return;
  const logCard = document.querySelector(`#todayRecordPanel [data-log-card="${log.id}"]`);
  const participantRows = [...(logCard?.querySelectorAll(`[data-log-participant-row="${log.id}"]`) || [])];
  const submit = activeViewField(`[data-confirm-log="${log.id}"]`);
  if (participantRows.length) {
    const ready = participantRows.every((row) => {
      const length = String(row.querySelector("[data-log-participant-comment]")?.value || "").trim().length;
      const curriculumId = row.querySelector("[data-log-participant-curriculum]")?.value || "";
      const count = row.querySelector("[data-log-participant-comment-count]");
      if (count) {
        count.textContent = `${length}/5자`;
        count.classList.toggle("is-ready", length >= 5);
      }
      return length >= 5 && Boolean(curriculumId);
    });
    if (submit) submit.disabled = log.status === "서버 처리 중" || log.status === "확인 완료" || !ready;
    return;
  }
  const count = activeViewField(`[data-log-comment-count="${log.id}"]`);
  const length = String(log.coachComment || "").trim().length;
  if (count) {
    count.textContent = `${length}/5자`;
    count.classList.toggle("is-ready", length >= 5);
  }
  if (submit) submit.disabled = log.status === "서버 처리 중" || log.status === "확인 완료" || length < 5 || !log.nextCurriculumId;
}

async function confirmLog(id, options = {}) {
  const log = options.skipDraft
    ? state.lessonLogs.find((item) => item.id === id)
    : updateLogDraft(id);
  if (!log) return false;
  if (log.status === "확인 완료") return true;
  const linkedScheduleV2Lesson = state.liveLessons.find((item) => (
    item.serverLessonId === log.serverLessonId
    && Array.isArray(item.v2Participants)
    && item.v2Participants.length
  ));
  const linkedLesson = linkedScheduleV2Lesson || lessonForRecord(log);
  if (linkedLesson && !lessonOutcomeWindowOpen(linkedLesson)) {
    log.validationMessage = lessonOutcomeGuardMessage();
    renderAll();
    return false;
  }
  const participantResults = Array.isArray(log.participantResults) && log.participantResults.length
    ? log.participantResults
    : linkedScheduleV2Lesson
      ? linkedScheduleV2Lesson.v2Participants.map((participant) => ({
          userId: participant.userId,
          ticketId: participant.ticketId,
          name: participant.name || log.member,
          ticketName: participant.ticketName || "회원권",
          totalSessions: Number(participant.totalSessions) || 0,
          usedSessions: Number(participant.usedSessions) || 0,
          remainingSessions: Number(participant.remainingSessions) || 0,
          coachComment: log.coachComment,
          nextCurriculumId: log.nextCurriculumId,
        }))
      : [{
          userId: "",
          ticketId: "",
          name: log.member,
          coachComment: log.coachComment,
          nextCurriculumId: log.nextCurriculumId,
        }];
  if ((!Array.isArray(log.participantResults) || !log.participantResults.length) && linkedScheduleV2Lesson) {
    log.participantResults = participantResults;
  }
  const participantResultsHaveAnyPair = participantResults.some((result) => result.userId || result.ticketId);
  const participantResultsHaveExactPairs = participantResults.length > 0
    && participantResults.every((result) => result.userId && result.ticketId);
  const requiresExactParticipantPairs = Boolean(linkedScheduleV2Lesson || participantResultsHaveAnyPair);
  const missingParticipant = participantResults.find((result) => (
    !result.coachComment
    || !result.nextCurriculumId
    || (requiresExactParticipantPairs && (!result.userId || !result.ticketId))
  ));
  if (missingParticipant) {
    log.validationMessage = "코치 코멘트, 다음 커리큘럼과 정확한 회원권 연결을 확인해 주세요.";
    renderAll();
    return false;
  }
  const invalidParticipant = participantResults
    .map((result) => ({
      name: result.name,
      message: coachCommentValidationMessage({
        id: `${log.id}:${result.userId}:${result.ticketId}`,
        member: result.name,
        coachComment: result.coachComment,
      }),
    }))
    .find((result) => result.message);
  if (invalidParticipant) {
    log.validationMessage = `${invalidParticipant.name}: ${invalidParticipant.message}`;
    renderAll();
    return false;
  }
  const nextStep = selectedCurriculum(participantResults[0].nextCurriculumId);
  let serverResult = null;
  if (log.serverLessonId) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) {
      log.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
      renderAll();
      return false;
    }
    if (client.isOnline?.() === false) {
      log.status = "동기화 대기";
      log.validationMessage = "인터넷 연결 후 자동 처리됩니다. 서버 확인 전에는 횟수가 차감되지 않습니다.";
      saveSnapshot();
      renderAll();
      return false;
    }
    log.status = "서버 처리 중";
    renderAll();
    try {
      const scheduleV2Lesson = linkedScheduleV2Lesson || state.liveLessons.find((item) => (
        item.serverLessonId === log.serverLessonId
        && Array.isArray(item.v2Participants)
        && item.v2Participants.length
      ));
      const scheduleV2Participants = scheduleV2Lesson?.v2Participants?.length
        ? scheduleV2Lesson.v2Participants
        : participantResultsHaveExactPairs
          ? participantResults
          : null;
      if (scheduleV2Participants) {
        log.v2OperationKey ||= `schedule-v2-coach:${log.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
        const participantCount = scheduleV2Participants.length;
        const draftByTicketAndUser = new Map(participantResults.map((result) => [
          `${result.userId}:${result.ticketId}`,
          result,
        ]));
        const serverParticipantResults = await Promise.all(scheduleV2Participants.map(async (participant) => {
          const draft = draftByTicketAndUser.get(`${participant.userId}:${participant.ticketId}`);
          if (!draft) throw new Error("schedule_v2_participant_input_missing");
          const participantNextStep = selectedCurriculum(draft.nextCurriculumId);
          const participantCurriculumRefId = await liveCurriculumRefId(participantNextStep);
          return {
            userId: participant.userId,
            ticketId: participant.ticketId,
            outcome: "completed",
            deduct: true,
            technique: "",
            strength: "",
            improvement: "",
            nextGoal: participantNextStep?.title || "",
            coachComment: draft.coachComment,
            keywords: [],
            nextCurriculumRefId: participantCurriculumRefId || null,
            memberJournalId: participantCount === 1 ? (log.serverJournalId || null) : null,
          };
        }));
        serverResult = await client.rpc("tn_schedule_v2_process_lesson", {
          target_lesson_id: log.serverLessonId,
          target_participant_results: serverParticipantResults,
          target_finalize: true,
          target_operation_key: log.v2OperationKey,
        });
      } else {
        const curriculumRefId = await liveCurriculumRefId(nextStep);
        serverResult = await client.rpc("tn_complete_lesson_and_deduct", {
          target_lesson_id: log.serverLessonId,
          target_coach_comment: log.coachComment,
          target_next_curriculum_ref_id: curriculumRefId,
          target_member_journal_id: log.serverJournalId || null,
        });
      }
    } catch (error) {
      if (client.isOfflineError?.(error)) {
        log.status = "동기화 대기";
        log.validationMessage = "인터넷 연결 후 자동 처리됩니다. 서버 확인 전에는 횟수가 차감되지 않습니다.";
        saveSnapshot();
        renderAll();
        return false;
      }
      let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
      if (typeof code === "string" && code.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(code);
          code = parsed.message || parsed.code || code;
        } catch {
          // Keep the original server message when it is not valid JSON.
        }
      }
      const serverMessages = {
        schedule_v2_outcome_lesson_not_ended: lessonOutcomeGuardMessage(),
        lesson_complete_lesson_not_ended: lessonOutcomeGuardMessage(),
        lesson_complete_comment_too_short: "코치 코멘트는 직접 5자 이상 작성해야 합니다.",
        lesson_complete_comment_too_generic: "짧은 칭찬이나 확인 문구만으로는 횟수 차감이 불가합니다.",
        lesson_complete_comment_recent_duplicate: "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.",
        lesson_complete_comment_member_duplicate_limit: "같은 회원에게 동일한 코멘트는 2회까지만 사용할 수 있습니다.",
      };
      log.status = options.fromOfflineQueue ? "동기화 실패" : "확인 대기";
      log.validationMessage = serverMessages[code]
        || (options.fromOfflineQueue
          ? "자동 동기화에 실패했습니다. 연결 상태를 확인한 뒤 다시 동기화해 주세요."
          : "서버 횟수 차감에 실패했습니다. 같은 기록에서 다시 시도해 주세요.");
      saveSnapshot();
      renderAll();
      return false;
    }
  }
  log.status = "확인 완료";
  log.completedAt = new Date().toISOString();
  log.memberVisibleSummary = participantResults.length > 1
    ? `${participantResults.length}명 다음 커리큘럼 등록 완료`
    : `다음 수업 등록 완료: ${nextStep.id} · ${nextStep.title}`;
  log.curriculumRegistered = true;
  log.serverDeducted = Boolean(serverResult?.ok);
  log.serverDeductionIdempotent = Boolean(serverResult?.idempotent);
  const lesson = state.liveLessons.find((item) => (
    log.serverLessonId
      ? item.serverLessonId === log.serverLessonId
      : item.member === log.member
  )) || state.todayLessons.find((item) => (
    log.serverLessonId
      ? item.serverLessonId === log.serverLessonId
      : item.member === log.member
  ));
  const v2ParticipantResults = Array.isArray(serverResult?.participants) ? serverResult.participants : [];
  const v2DeductedSessions = v2ParticipantResults.reduce((total, participant) => total + (Number(participant.deductedSessions) || 0), 0);
  const deductedSessions = v2ParticipantResults.length
    ? v2DeductedSessions
    : Number(serverResult?.deductedSessions || 0) || Math.max(
      1,
      Math.ceil(Number(lesson?.durationMinutes || 20) / Number(lesson?.ticketLessonMinutes || lesson?.durationMinutes || 20)),
    );
  log.deductedSessions = deductedSessions;
  exportConfirmedLog(log);
  if (lesson && v2ParticipantResults.length) {
    const resultsByUserId = new Map(v2ParticipantResults.map((participant) => [participant.userId, participant]));
    lesson.v2Participants = (lesson.v2Participants || []).map((participant) => ({
      ...participant,
      ...(resultsByUserId.get(participant.userId) || {}),
    }));
    const primaryResult = v2ParticipantResults.find((participant) => participant.ticketId === lesson.ticketId) || v2ParticipantResults[0];
    if (Number.isFinite(Number(primaryResult?.remainingSessions))) {
      lesson.remaining = Number(primaryResult.remainingSessions);
      lesson.usedSessions = Math.max(0, Number(lesson.totalSessions || 0) - lesson.remaining);
    }
    lesson.deductedSessions = Math.max(0, ...v2ParticipantResults.map((participant) => Number(participant.deductedSessions) || 0));
  } else if (lesson && Number.isFinite(Number(serverResult?.remainingSessions))) {
    lesson.remaining = Number(serverResult.remainingSessions);
    lesson.usedSessions = Number(serverResult.usedSessions) || lesson.usedSessions || 0;
  } else if (lesson && lesson.remaining > 0) {
    lesson.remaining = Math.max(0, lesson.remaining - deductedSessions);
  }
  if (lesson) {
    lesson.status = "완료";
    lesson.serverStatus = "completed";
    lesson.task = "기록/차감 완료";
  }
  saveSnapshot();
  renderAll();
  return true;
}
