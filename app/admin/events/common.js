// 공통 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindCommonEvents() {
  $$(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#globalSearch").addEventListener("focus", renderGlobalSearchResults);
  $("#globalSearch").addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    clearGlobalSearch();
    event.currentTarget.blur();
  });
  $("#globalSearchResults").addEventListener("click", (event) => {
    const resultButton = event.target.closest("[data-global-search-result]");
    if (!resultButton) return;
    if (resultButton.dataset.searchMemberId) state.selectedMemberId = Number(resultButton.dataset.searchMemberId);
    if (resultButton.dataset.searchSettingsTab) state.settingsTab = resultButton.dataset.searchSettingsTab;
    clearGlobalSearch();
    renderAll();
    setView(resultButton.dataset.searchView || "dashboard");
  });
  $("#saveRackettimeButton")?.addEventListener("click", saveRackettimeList);
  $("#writeCommunityButton")?.addEventListener("click", writeCommunityPost);
  ["#openStartInput", "#openEndInput"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      scheduleSettings.openStart = $("#openStartInput").value || scheduleSettings.openStart;
      scheduleSettings.openEnd = $("#openEndInput").value || scheduleSettings.openEnd;
      renderAll();
      showToast("운영시간 반영 완료");
    });
  });
  $$(".segment[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMode = button.dataset.mode;
      $$(".segment[data-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderModePanel();
      saveSnapshot();
    });
  });
}
