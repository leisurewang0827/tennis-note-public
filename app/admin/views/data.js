// 데이터 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderDataImportAuthStatus() {
  const target = $("#dataImportAuthStatus");
  if (!target) return;
  const tone = adminImportAuthTone();
  const hasSession = Boolean(window.TennisNoteDataClient?.getSession?.()?.access_token);
  target.innerHTML = `
    <div class="data-status-card ${tone}">
      <div>
        <strong>관리자 로그인 상태</strong>
        <span>${escapeHtml(adminImportAuthState.message)}</span>
      </div>
      ${badge(tone, adminImportAuthBadgeText())}
    </div>
    <div class="data-action-row">
      <button class="ghost-button" type="button" data-admin-login-provider="카카오">카카오 로그인</button>
      <button class="ghost-button" type="button" data-admin-login-provider="네이버">네이버 로그인</button>
      <button class="ghost-button" type="button" data-admin-auth-action="refresh">상태 새로고침</button>
      ${hasSession ? '<button class="ghost-button" type="button" data-admin-auth-action="logout">로그아웃</button>' : ""}
    </div>`;
}

function renderDataTools() {
  renderDataImportAuthStatus();
  renderAdminPendingUsers();

  const importTarget = $("#dataImportStatus");
  if (importTarget) {
    const tone = dataImportState.status === "ready" ? "good" : dataImportState.status === "review" ? "warn" : dataImportState.status === "error" ? "danger" : "neutral";
    const issues = dataImportState.issues.slice(0, 8);
    const serverPreview = dataImportState.serverPreview || {};
    const rosterImpact = serverPreview.rosterImpact || {};
    const serverTone = dataImportServerTone();
    const serverIssues = Array.isArray(serverPreview.issues) ? serverPreview.issues.slice(0, 6) : [];
    const plannedOperations = Object.entries(serverPreview.plannedOperations || {})
      .filter(([, count]) => Number(count) > 0)
      .slice(0, 6);
    const serverCard = dataImportState.serverStatus !== "idle" ? `
      <div class="data-status-card ${serverTone}">
        <div>
          <strong>서버 검증 결과</strong>
          <span>${escapeHtml(dataImportState.serverMessage || "서버 검증 대기 중입니다.")}</span>
        </div>
        ${badge(serverTone || "neutral", dataImportState.serverStatus === "checking" ? "처리중" : dataImportState.serverStatus === "committed" ? "반영 완료" : dataImportState.serverStatus === "ready" ? "통과" : dataImportState.serverStatus === "review" ? "확인 필요" : "오류")}
      </div>
      ${plannedOperations.length ? `
        <div class="data-export-sheet-list">
          ${plannedOperations.map(([name, count]) => `<span>${escapeHtml(name)} ${count}</span>`).join("")}
        </div>` : ""}
      ${serverPreview.rosterImpact ? `
        <div class="data-status-card ${Number(rosterImpact.expireMemberCount || 0) > 0 ? "warn" : "good"}">
          <div>
            <strong>8월 명단 전환 영향</strong>
            <span>명단에 없는 기존 수강생은 삭제하지 않고 만료회원으로 보관하며, 휴회 회원은 앱에서 복귀 시간을 다시 선택할 수 있습니다.</span>
          </div>
          <div class="data-export-sheet-list">
            <span>수강중 ${Number(rosterImpact.activeMemberCount || 0)}</span>
            <span>휴회 ${Number(rosterImpact.pausedMemberCount || 0)}</span>
            <span>만료 전환 ${Number(rosterImpact.expireMemberCount || 0)}</span>
            <span>미래 일정 종료 ${Number(rosterImpact.cancelFutureLessonCount || 0)}</span>
          </div>
        </div>` : ""}
      ${serverIssues.length ? `
        <div class="data-issue-list">
          ${serverIssues.map((issue) => `<p class="${issue.severity || "review"}">${escapeHtml(importServerIssueMessage(issue))}</p>`).join("")}
        </div>` : ""}
    ` : "";
    importTarget.innerHTML = `
      <div class="data-status-card ${tone}">
        <div>
          <strong>${dataImportState.fileName || "업로드 대기"}</strong>
          <span>${dataImportState.message}</span>
        </div>
        ${badge(tone, dataImportState.status === "idle" ? "대기" : dataImportState.status === "checking" ? "검증중" : dataImportState.status === "ready" ? "반영 가능" : dataImportState.status === "review" ? "확인 필요" : "오류")}
      </div>
      <div class="data-summary-grid">
        <article><span>${supportedImportWorkbookVersions.has(dataImportState.schemaVersion) ? "회원" : "전체 행"}</span><strong>${supportedImportWorkbookVersions.has(dataImportState.schemaVersion) ? dataImportState.memberRowCount : dataImportState.rowCount}</strong></article>
        ${supportedImportWorkbookVersions.has(dataImportState.schemaVersion) ? `<article><span>시간표</span><strong>${dataImportState.scheduleRowCount}</strong></article>` : ""}
        <article><span>반영 가능</span><strong>${dataImportState.readyRows}</strong></article>
        <article><span>확인 필요</span><strong>${dataImportState.reviewRows}</strong></article>
        <article><span>오류</span><strong>${dataImportState.errorRows}</strong></article>
      </div>
      <div class="data-issue-list">
        ${issues.length ? issues.map((issue) => `<p class="${issue.level}"><b>${issue.rowNumber}행</b> ${escapeHtml(issue.message)}</p>`).join("") : "<p>검증 이슈가 없습니다.</p>"}
      </div>
      ${serverCard}`;
  }

  const commitButton = $("#dataImportCommitButton");
  if (commitButton) {
    commitButton.disabled = dataImportState.status !== "ready" || dataImportState.serverStatus === "checking";
    commitButton.textContent = dataImportState.serverStatus === "checking"
      ? "검증 중"
      : dataImportState.serverStatus === "ready"
        ? "다시 검증"
        : "파일 검증";
  }

  const applyButton = $("#dataImportApplyButton");
  if (applyButton) {
    applyButton.disabled = dataImportState.status !== "ready" || dataImportState.serverStatus !== "ready";
    applyButton.textContent = dataImportState.serverStatus === "checking"
      ? "처리 중"
      : dataImportState.serverStatus === "committed"
        ? "DB 반영 완료"
        : "검증 결과 DB 반영";
  }

  const exportPreview = $("#dataExportPreview");
  if (exportPreview) {
    const dataset = $("#dataExportDataset")?.value || "all";
    const sheets = selectedExportSheets();
    const totalRows = sheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0);
    exportPreview.innerHTML = `
      <div class="data-status-card good">
        <div>
          <strong>${dataset === "all" ? "전체 운영 데이터" : sheets[0].name}</strong>
          <span>${sheets.length}개 시트, ${totalRows}개 행을 내려받습니다.</span>
        </div>
        ${badge("ready", "준비")}
      </div>
      <div class="data-export-sheet-list">
        ${sheets.map((sheet) => `<span>${escapeHtml(sheet.name)} ${Math.max(0, sheet.rows.length - 1)}행</span>`).join("")}
      </div>`;
  }
}
