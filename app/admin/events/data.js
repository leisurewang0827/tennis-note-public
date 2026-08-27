// 데이터 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindDataEvents() {
  $("#downloadImportTemplateButton")?.addEventListener("click", downloadImportTemplate);
  $("#dataImportFile")?.addEventListener("change", (event) => handleDataImportFile(event.target.files?.[0]));
  $("#clearDataImportButton")?.addEventListener("click", clearDataImportResult);
  $("#dataImportCommitButton")?.addEventListener("click", previewDataImportOnServer);
  $("#dataImportApplyButton")?.addEventListener("click", commitDataImportOnServer);
  $("#downloadDataExportButton")?.addEventListener("click", downloadDataExport);
  $("#downloadSafeBackupButton")?.addEventListener("click", downloadSafeBackup);
  ["#dataExportDataset", "#dataExportFormat", "#dataExportPrivateFields"].forEach((selector) => {
    $(selector)?.addEventListener("change", renderDataTools);
  });
}
