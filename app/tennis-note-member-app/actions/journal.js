// 운동노트와 수업 기록을 저장하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function savePracticeLog() {
  const mediaItems = mediaItemsFromInput($("#practiceMedia"));
  const mediaNames = mediaItems.map((file) => file.name);
  const requestFeedback = $("#requestCoachFeedback")?.checked;
  const journalDate = $("#journalDate")?.value || localDateKey();
  const log = {
    id: `practice-${Date.now()}`,
    date: new Date(`${journalDate}T00:00:00`).toLocaleDateString("ko-KR"),
    journalDate,
    type: $("#practiceType").value,
    memo: $("#practiceMemo").value.trim() || "운동 기록 미입력",
    next: $("#practiceNext").value.trim() || "다음 연습 계획 미입력",
    mediaNames,
    mediaItems,
    feedbackQuestion: $("#feedbackQuestion")?.value.trim() || "",
    feedbackStatus: requestFeedback ? "코치 피드백 요청" : "개인 기록",
    coachFeedback: "",
    submittedAt: new Date().toISOString(),
  };
  state.practiceLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  if (requestFeedback) pushPracticeFeedbackToShared(log);
  renderAll();
}

async function saveJournal() {
  const button = $("#saveJournal");
  if (button?.disabled) return;
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
  savePracticeLog();
  if (button) button.disabled = false;
  renderJournalMode();
  window.TennisNoteInputGuard?.markSaved?.("#journalComposerSheet");
  closeAppSheet("journalComposerSheet");
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
