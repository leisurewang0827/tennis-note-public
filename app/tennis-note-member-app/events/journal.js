// 운동일지와 수업 상세.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindJournalEvents() {
  $("#saveJournal").addEventListener("click", saveJournal);
  $("#journalMode").addEventListener("change", renderJournalMode);
  $("#openJournalComposer")?.addEventListener("click", () => openJournalComposer(localDateKey()));
  $("#lessonDetailSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-lesson-detail]")) {
      closeAppSheet("lessonDetailSheet");
      return;
    }
    const actionButton = event.target.closest("[data-lesson-detail-action]");
    if (actionButton) handleLessonDetailAction(actionButton.dataset.lessonDetailAction);
  });
  $("#journalComposerSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-journal-composer]")) closeAppSheet("journalComposerSheet");
  });
  $("#journalPrevMonth")?.addEventListener("click", () => changeJournalMonth(-1));
  $("#journalNextMonth")?.addEventListener("click", () => changeJournalMonth(1));
  $("#journalTodayButton")?.addEventListener("click", returnJournalToToday);
  $("#journalCalendarDisclosure")?.addEventListener("toggle", (event) => {
    if (event.isTrusted) event.currentTarget.dataset.userToggled = "true";
  });
  $("#journalSearch")?.addEventListener("input", (event) => {
    state.journalSearchQuery = event.target.value;
    renderJournalCalendar();
    saveSnapshot();
  });
  $("#journalJumpDate")?.addEventListener("change", (event) => selectJournalDate(event.target.value));
  $("#journalCalendar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-journal-date]");
    if (button) selectJournalDate(button.dataset.selectJournalDate);
  });
  $("#journalActivitySummary")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-journal-activity-status]");
    if (button && !button.disabled) focusJournalActivity(button.dataset.journalActivityStatus);
  });
  $("#journalSelectedDayPanel")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-journal-write-date]");
    if (button) prepareJournalWriteDate(button.dataset.journalWriteDate);
  });
}
