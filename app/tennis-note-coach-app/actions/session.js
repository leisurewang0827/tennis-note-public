// 앱 전체에 걸친 처리와 스냅샷 저장.
//
// 코치가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function saveSharedData(shared) {
  localStorage.setItem(sharedStorageKey, JSON.stringify(shared));
}

function saveSnapshot() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ state: compactCoachSnapshotState() }));
    return true;
  } catch (error) {
    console.warn("Tennis Note coach snapshot save skipped", error?.name || error);
    return false;
  }
}

function returnToMemberEntry(openProfile = false, rememberMemberMode = true) {
  state.coach = null;
  if (rememberMemberMode) sessionStorage.setItem(appModePreferenceKey, "member");
  else sessionStorage.removeItem(appModePreferenceKey);
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  saveSnapshot();
  window.location.replace(memberModeUrl(openProfile, rememberMemberMode));
}

function handleSummaryAction(action) {
  if (action === "lessons") {
    openTodayTaskTab("lessons");
    return;
  }
  if (action === "makeup") {
    openTodayTaskTab("makeup");
    return;
  }
  if (action === "records") {
    openTodayTaskTab("records");
  }
}
