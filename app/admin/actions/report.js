// 리포트 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function setDataImportState(nextState) {
  Object.assign(dataImportState, nextState);
  renderDataTools();
}

async function handleDataImportFile(file) {
  if (!file) return;
  setDataImportState({
    fileName: file.name,
    fileType: file.name.split(".").pop()?.toLowerCase() || "",
    status: "checking",
    message: "파일을 읽고 검증하는 중입니다.",
    columns: [],
    rowCount: 0,
    readyRows: 0,
    reviewRows: 0,
    errorRows: 0,
    issues: [],
    rawRows: [],
    schemaVersion: "",
    workbookPayload: null,
    memberRowCount: 0,
    scheduleRowCount: 0,
    serverStatus: "idle",
    serverMessage: "",
    serverPreview: null,
  });
  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let rows = [];
    let workbookPayload = null;
    if (extension === "xlsx" || extension === "xls") {
      const workbook = completeMonthlyImportWorkbook(await readWorkbookFile(file));
      if (supportedImportWorkbookVersions.has(workbook.schemaVersion)) {
        const result = validateMonthlyImportWorkbook(workbook, file.name);
        setDataImportState({
          ...result,
          fileName: file.name,
          fileType: extension,
          rawRows: [],
          serverStatus: "idle",
          serverMessage: "서버 검증 대기 중입니다.",
          serverPreview: null,
          status: result.errorRows ? "error" : result.reviewRows ? "review" : "ready",
          message: result.errorRows
            ? "오류 행을 수정해야 실제 DB 반영이 가능합니다."
            : result.reviewRows
              ? "검토대기·결제검토 행을 모두 정리한 뒤 다시 업로드하세요."
              : result.scheduleRowCount
                ? "회원DB와 시간표 검증 통과. 서버 미리보기를 실행하세요."
                : "회원DB 검증 통과. 기존 서버 시간표는 그대로 보존됩니다.",
        });
        return;
      }
      rows = workbook.legacyRows || [];
    } else {
      const text = await readTextFile(file);
      rows = parseDelimitedRows(text, extension === "tsv" ? "\t" : ",");
    }
    const result = validateImportRows(rows, file.name);
    setDataImportState({
      ...result,
      fileName: file.name,
      fileType: extension,
      rawRows: rows,
      schemaVersion: "1.0",
      workbookPayload,
      memberRowCount: result.rowCount,
      scheduleRowCount: 0,
      serverStatus: "idle",
      serverMessage: "서버 검증 대기 중입니다.",
      serverPreview: null,
      status: result.errorRows ? "error" : result.reviewRows ? "review" : "ready",
      message: result.errorRows
        ? "오류 행을 수정해야 실제 DB 반영이 가능합니다."
        : result.reviewRows
          ? "확인 필요 행을 검토한 뒤 반영할 수 있습니다."
          : "검증 통과. 서버 연결 후 실제 DB 반영 대상으로 넘길 수 있습니다.",
    });
  } catch (error) {
    setDataImportState({
      fileName: file.name,
      fileType: file.name.split(".").pop()?.toLowerCase() || "",
      status: "error",
      message: error.message || "파일을 읽지 못했습니다.",
      columns: [],
      rowCount: 0,
      readyRows: 0,
      reviewRows: 0,
      errorRows: 1,
      issues: [{ rowNumber: "-", level: "error", message: error.message || "파일 읽기 실패" }],
      rawRows: [],
      schemaVersion: "",
      workbookPayload: null,
      memberRowCount: 0,
      scheduleRowCount: 0,
      serverStatus: "idle",
      serverMessage: "",
      serverPreview: null,
    });
  }
}

function startAdminImportLogin(provider) {
  const client = window.TennisNoteDataClient;
  if (!client?.signInWithOAuth || !client.readiness?.().ready) {
    blockServerPreview("Supabase 연결값을 먼저 설정해야 로그인할 수 있습니다.");
    return;
  }
  const remember = $("#operationsRememberLogin")?.checked !== false;
  localStorage.setItem(operationsRememberStorageKey, remember ? "true" : "false");
  client.setSessionPersistence?.(remember);
  client.signInWithOAuth(provider, { redirectTo: window.location.href });
}

async function signOutAdminImport() {
  const client = window.TennisNoteDataClient;
  cancelAdminInitialLiveSync();
  await clearAdminOperationalCache();
  if (client?.signOut) await client.signOut();
  clearCachedOperationsIdentity();
  Object.assign(adminImportAuthState, {
    loading: false,
    loaded: true,
    user: null,
    profile: null,
    message: "로그아웃되었습니다. 서버 검증은 관리자 로그인 후 가능합니다.",
  });
  localStorage.removeItem(storageKey);
  renderOperationsLoginGate();
  renderDataTools();
  showToast("관리자 로그인 해제");
}

async function commitDataImportOnServer() {
  const summary = dataImportState.serverPreview || {};
  if (dataImportState.status !== "ready" || dataImportState.serverStatus !== "ready") {
    showToast("로컬·서버 검증을 모두 통과한 파일만 반영할 수 있습니다.");
    return;
  }
  if (Number(summary.errorRows || 0) > 0 || Number(summary.reviewRows || 0) > 0) {
    showToast("오류 또는 확인 필요 행을 먼저 정리하세요.");
    return;
  }
  if (!hasDataImportPayload()) {
    showToast("반영할 업로드 데이터가 없습니다.");
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    blockServerPreview("관리자 로그인 후 DB 반영을 실행할 수 있습니다.", summary);
    return;
  }

  const approved = window.confirm(
    `${dataImportState.readyRows}개 행을 실제 DB에 반영합니다.\n\n` +
    "반영 전 데이터 내보내기로 백업했는지 확인하세요. 계속할까요?",
  );
  if (!approved) return;

  setDataImportState({
    serverStatus: "checking",
    serverMessage: "검증된 업로드 행을 DB에 반영하는 중입니다. 창을 닫지 마세요.",
    serverPreview: summary,
  });

  try {
    const response = await client.invokeFunction("tennisnote-admin-import", {
      headers: { "x-tennisnote-import-mode": "commit" },
      body: {
        ...dataImportRequestBody("commit"),
        confirm: "IMPORT_APPROVED",
      },
    });
    if (!response?.writesToDatabase || response?.code !== "import_committed") {
      throw Object.assign(new Error(response?.code || "import_commit_not_confirmed"), { payload: response });
    }
    let refreshedFromServer = false;
    try {
      await syncAdminLiveData(true);
      await loadAdminMemberDirectoryPage({ force: true, render: false });
      refreshedFromServer = true;
    } catch (refreshError) {
      console.warn("[Tennis Note] import committed but post-import refresh failed", refreshError);
    }
    const importResult = response.result || {};
    const importedMembers = Number(importResult.memberCount || importResult.member_count || dataImportState.memberRowCount || 0);
    const importedSchedules = Number(importResult.scheduleCount || importResult.schedule_count || dataImportState.scheduleRowCount || 0);
    setDataImportState({
      serverStatus: "committed",
      serverMessage: `DB 반영 완료. 회원 ${importedMembers}명, 시간표 ${importedSchedules}건을 처리했습니다. ${
        refreshedFromServer ? "서버 재조회까지 완료했습니다." : "서버 재조회 버튼으로 결과를 확인하세요."
      }`,
      serverPreview: { ...summary, importResult },
    });
    billingLogs.unshift(`엑셀 DB 반영 완료: ${dataImportState.fileName} ${dataImportState.readyRows}행`);
    saveSnapshot();
    showToast("DB 반영 완료");
  } catch (error) {
    const payload = error?.payload || {};
    const message = payload.code === "commit_disabled"
      ? "운영 DB 반영 기능이 아직 잠겨 있습니다. 최종 승인 후 서버 설정을 켜야 합니다."
      : payload.code === "preview_not_clear"
        ? "서버 재검증에서 확인할 행이 발견되어 반영하지 않았습니다."
        : payload.code || error?.message || "DB 반영에 실패했습니다.";
    setDataImportState({
      serverStatus: "error",
      serverMessage: message,
      serverPreview: payload.summary || summary,
    });
    showToast("DB 반영 실패");
  }
}

function setAdminReportWidgetOption(kind, itemId, value) {
  if (!adminReportWidgetDefinitions.some((item) => item.id === itemId)) return;
  const options = kind === "size" ? adminReportWidgetSizeOptions : adminReportWidgetFilterOptions;
  if (!options.some((option) => option.id === value)) return;
  const key = kind === "size" ? "reportWidgetSizes" : "reportWidgetFilters";
  adminLayoutSettings[key][itemId] = value;
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
  if (kind === "filter") renderReports();
}
