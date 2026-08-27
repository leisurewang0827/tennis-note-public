// 보강 요청.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindMakeupEvents() {
  $("#requestMakeup").addEventListener("click", requestMakeup);
  $("#makeupRequests")?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-change-request]");
    if (editButton) {
      void editMemberChangeRequest(editButton.dataset.editChangeRequest);
      return;
    }
    const changeButton = event.target.closest("[data-cancel-change-request]");
    if (changeButton) {
      cancelMemberScheduleRequest("change", changeButton.dataset.cancelChangeRequest);
      return;
    }
    const makeupButton = event.target.closest("[data-cancel-makeup-booking]");
    if (makeupButton) cancelMemberScheduleRequest("makeup", makeupButton.dataset.cancelMakeupBooking);
  });
}
