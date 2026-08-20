// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function focusJournalActivity(status) {
  const today = localDateKey();
  const matches = journalActivityItems()
    .filter((item) => item.status === status)
    .sort((left, right) => {
      const leftFuture = left.dateValue >= today ? 0 : 1;
      const rightFuture = right.dateValue >= today ? 0 : 1;
      return leftFuture - rightFuture || left.dateValue.localeCompare(right.dateValue);
    });
  if (!matches.length) return;
  const calendarDisclosure = $("#journalCalendarDisclosure");
  if (calendarDisclosure) {
    calendarDisclosure.open = true;
    calendarDisclosure.dataset.userToggled = "true";
  }
  selectJournalDate(matches[0].dateValue);
  $("#journalSelectedDayPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
