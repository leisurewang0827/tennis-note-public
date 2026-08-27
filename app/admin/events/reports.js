// 리포트 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindReportsEvents() {
  $("#managementReportMonth")?.addEventListener("change", (event) => {
    state.managementReportMonth = event.target.value || adminLocalDateKey(new Date()).slice(0, 7);
    renderReports();
    void loadAdminDriveReportSnapshot({ force: true });
    saveSnapshot();
  });
  $("#refreshDriveReportButton")?.addEventListener("click", () => {
    void loadAdminDriveReportSnapshot({ force: true });
  });
}
