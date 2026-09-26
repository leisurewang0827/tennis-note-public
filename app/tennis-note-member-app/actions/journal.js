// 운동노트와 수업 기록을 저장하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function savePracticeLog() {
  const existing = state.practiceLogs.find((log) => log.id === (state.personalEditingId || state.personalDraftId));
  const recoverySourceId = state.personalRecoverySourceId || "";
  const mediaItems = mediaItemsFromInput($("#practiceMedia"));
  const mediaNames = mediaItems.map((file) => file.name);
  const requestFeedback = $("#requestCoachFeedback")?.checked;
  const journalDate = $("#journalDate")?.value || localDateKey();
  const log = {
    ...(existing || {}),
    id: existing?.id || state.personalDraftId || window.TennisNotePersonalJournal.key(),
    date: new Date(`${journalDate}T00:00:00`).toLocaleDateString("ko-KR"),
    journalDate,
    type: $("#practiceType").value,
    memo: $("#practiceMemo").value.trim(),
    next: $("#practiceNext").value.trim(),
    mediaNames: [...(existing?.mediaNames || []), ...mediaNames],
    mediaItems: [...(existing?.mediaItems || []), ...mediaItems],
    feedbackQuestion: $("#feedbackQuestion")?.value.trim() || "",
    feedbackStatus: requestFeedback ? "코치 피드백 요청" : "개인 기록",
    coachFeedback: "",
    submittedAt: existing?.submittedAt || new Date().toISOString(),
  };
  state.personalDraftId = log.id;
  const hasLiveSession = Boolean(state.member?.profileId && window.TennisNoteDataClient?.getSession?.()?.access_token);
  if (!hasLiveSession && state.dataMode === "live") {
    personalJournalStatus("로그인이 필요합니다. 입력 내용은 유지됩니다.");
    return false;
  }
  if (hasLiveSession) {
    if (existing?.personalOwnerId && existing.personalOwnerId !== state.member.profileId) {
      personalJournalStatus("다른 계정의 기록은 변경할 수 없습니다."); return false;
    }
    log.personalOwnerId = state.member.profileId;
    log.personalClientKey ||= log.id;
    const checkpoint = (pendingLog) => {
      const index = state.practiceLogs.findIndex((item) => item.id === pendingLog.id);
      if (index < 0) state.practiceLogs.unshift(pendingLog);
      else state.practiceLogs[index] = pendingLog;
      state.personalEditingId = pendingLog.id;
      saveSnapshot();
    };
    try {
      await window.TennisNotePersonalJournal.save(log, [...($("#practiceMedia")?.files || [])], checkpoint);
      if (recoverySourceId) {
        state.practiceLogs = state.practiceLogs.filter((item) => item.id !== recoverySourceId);
      }
      await syncPersonalJournalFromServer();
    } catch (error) {
      personalJournalStatus(window.TennisNotePersonalJournal.errorMessage(error));
      return false;
    }
  } else {
    const index = state.practiceLogs.findIndex((item) => item.id === log.id);
    if (index < 0) state.practiceLogs.unshift(log); else state.practiceLogs[index] = log;
    if (requestFeedback) pushPracticeFeedbackToShared(log);
  }
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  state.personalEditingId = null;
  state.personalDraftId = null;
  state.personalRecoverySourceId = null;
  if ($("#practiceMedia")) $("#practiceMedia").value = "";
  personalJournalStatus();
  renderJournalCalendar();
  saveSnapshot();
  return true;
}

async function saveJournal() {
  const button = $("#saveJournal");
  if (button?.disabled || button?.dataset.personalSaving === "true") return;
  if (button) {
    button.disabled = true;
    button.textContent = "서버에 저장 중";
  }
  if (($("#journalMode")?.value || "lesson") === "lesson") {
    let saved = false;
    try {
      saved = await submitLessonLog();
    } finally {
      if (button) button.disabled = false;
      renderJournalMode();
    }
    if (saved) {
      window.TennisNoteInputGuard?.markSaved?.("#journalComposerSheet");
      closeAppSheet("journalComposerSheet");
    }
    return;
  }
  let saved = false;
  if (button) button.dataset.personalSaving = "true";
  try { saved = await savePracticeLog(); }
  finally {
    if (button) { button.disabled = false; delete button.dataset.personalSaving; }
    renderJournalMode();
  }
  if (saved) {
    window.TennisNoteInputGuard?.markSaved?.("#journalComposerSheet");
    closeAppSheet("journalComposerSheet");
  }
}

async function submitLessonLog() {
  const lesson = memberScheduleLessons().find((item) => item.id === $("#logLesson").value);
  if (!lesson) return false;

  const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
  const mediaInput = $("#lessonMedia");
  const files = [...(mediaInput?.files || [])];
  const mediaItems = mediaItemsFromInput(mediaInput);
  const mediaNames = mediaItems.map((file) => file.name);
  const journalDate = $("#journalDate")?.value || localDateKey();
  const hasLiveSession = Boolean(state.member?.profileId && window.TennisNoteDataClient?.getSession?.()?.access_token);
  const log = {
    id: `member-log-${Date.now()}`,
    lessonId: lesson.id,
    lessonLabel: `${lesson.day} ${lesson.time} · ${lesson.coach}`,
    round: lessonRound(),
    journalDate,
    content: $("#todayLessonContent").value.trim() || "수업 내용 미입력",
    selfMemo: $("#selfWorkoutMemo").value.trim() || "자기 운동 일지 미입력",
    mediaNames,
    mediaItems,
    status: hasLiveSession ? "uploading" : "coach_pending",
    curriculum,
    nextCurriculumId: curriculum.id,
    coachComment: "",
    memberVisibleSummary: "",
    ticketDeducted: false,
    submittedAt: new Date().toISOString(),
  };
  state.lessonLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  renderAll();

  if (hasLiveSession) {
    try {
      await persistLessonJournalToServer(log, files);
      log.status = "coach_pending";
      state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 운동일지 · 서버 저장 완료`, tone: "done" });
    } catch {
      log.status = "server_error";
      state.ticketHistory.unshift({ text: "운동일지 서버 저장 실패 · 네트워크와 저장공간을 확인해 주세요.", tone: "alert" });
      renderAll();
      return false;
    }
  }

  pushLessonLogToShared(log);
  state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 수업기록 제출 · 코멘트/커리큘럼 작성 대기`, tone: "wait" });
  if (mediaInput) mediaInput.value = "";
  renderAll();
  return true;
}

function prepareJournalWriteDate(dateValue) {
  openJournalComposer(dateValue);
}

function editPersonalJournal(id) {
  const log = state.practiceLogs.find((item) => item.id === id);
  if (!log || !log.personalOwnerVerified || log.personalOwnerId !== state.member?.profileId) {
    showToast("서버에서 확인된 본인의 개인운동만 수정할 수 있습니다."); return;
  }
  closeJournalDetail();
  state.personalRecoverySourceId = null;
  state.personalEditingId = log.id;
  $("#journalMode").value = "practice";
  $("#practiceType").value = log.type;
  $("#practiceMemo").value = log.memo;
  $("#practiceNext").value = log.next;
  $("#feedbackQuestion").value = log.feedbackQuestion || "";
  $("#requestCoachFeedback").checked = false;
  $("#practiceMedia").value = "";
  openJournalComposer(log.journalDate, { edit: true });
}

function recoverLocalPersonalJournal(id) {
  const log = state.practiceLogs.find((item) => item.id === id);
  const api = window.TennisNotePersonalJournal;
  const hasLiveSession = Boolean(state.member?.profileId && window.TennisNoteDataClient?.getSession?.()?.access_token);
  if (!log || log.serverJournalId || !api || !hasLiveSession) {
    showToast("로그인 후 이 기기의 기록을 복구할 수 있습니다.");
    return;
  }
  closeJournalDetail();
  state.personalEditingId = null;
  state.personalDraftId = api.key();
  state.personalRecoverySourceId = log.id;
  $("#journalMode").value = "practice";
  $("#practiceType").value = log.type || "기타";
  $("#practiceMemo").value = log.memo || "";
  $("#practiceNext").value = log.next || "";
  $("#feedbackQuestion").value = log.feedbackQuestion || "";
  $("#requestCoachFeedback").checked = false;
  $("#practiceMedia").value = "";
  openJournalComposer(log.journalDate || log.date || localDateKey(), { edit: true, recovery: true });
  personalJournalStatus("기존 글과 날짜를 불러왔습니다. 사진·영상만 다시 선택한 뒤 저장해 주세요.");
}

async function deletePersonalJournal(id, button) {
  const log = state.practiceLogs.find((item) => item.id === id);
  if (!log || !log.personalOwnerVerified || log.personalOwnerId !== state.member?.profileId || button?.disabled) return;
  if (!window.confirm("이 개인운동과 첨부만 삭제합니다. 수업 결과·회차·코치 피드백은 바뀌지 않습니다.")) return;
  if (button) button.disabled = true;
  try {
    const removed = await window.TennisNotePersonalJournal.remove(log);
    await syncPersonalJournalFromServer();
    closeJournalDetail();
    renderJournalCalendar();
    if (removed.cleanupPending) showToast("기록은 삭제됐습니다. 첨부 정리는 연결 복구 후 다시 확인합니다.");
  } catch (error) { showToast(window.TennisNotePersonalJournal.errorMessage(error)); }
  finally { if (button) button.disabled = false; }
}
