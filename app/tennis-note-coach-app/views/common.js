// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${escapeHtml(options.title || "표시할 내용이 없습니다.")}</p>`;
}

function curriculumOptions(selectedId, query = "", selectedOnlyWhenIdle = false) {
  const canonicalSelectedId = canonicalCurriculumId(selectedId);
  const searchQuery = String(query || "").trim();
  if (selectedOnlyWhenIdle && !searchQuery) {
    const selectedStep = curriculumSteps.find((step) => step.id === canonicalSelectedId);
    return selectedStep
      ? `<option value="${selectedStep.id}" selected>${selectedStep.id} · ${escapeHtml(selectedStep.title)} · ${escapeHtml(selectedStep.trackTitle || selectedStep.category || "커리큘럼")}</option>`
      : "";
  }
  const search = window.TennisNoteCurriculumSearch;
  const rankedSteps = searchQuery && search?.search
    ? search.search(curriculumSteps, searchQuery, { limit: 24 }).map((result) => result.step)
    : null;
  const normalizedQuery = searchQuery.toLocaleLowerCase("ko-KR");
  const matchesQuery = (step) => {
    if (!normalizedQuery) return true;
    if (rankedSteps) return rankedSteps.includes(step);
    return `${step.id || ""} ${step.title || ""} ${step.trackTitle || ""} ${step.category || ""}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery);
  };
  if (rankedSteps) {
    const visibleSteps = [...rankedSteps];
    const selectedStep = curriculumSteps.find((step) => step.id === canonicalSelectedId);
    if (selectedStep && !visibleSteps.includes(selectedStep)) visibleSteps.unshift(selectedStep);
    return visibleSteps
      .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${escapeHtml(step.title)} · ${escapeHtml(step.trackTitle || step.category || "커리큘럼")}</option>`)
      .join("");
  }
  if (!curriculumCatalog.tracks?.length) {
    return curriculumSteps
      .filter(matchesQuery)
      .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${step.title}</option>`)
      .join("");
  }
  const groups = [
    { title: "기초 움직임과 서브", steps: (curriculumCatalog.fundamentals || []).filter(matchesQuery) },
    ...curriculumCatalog.tracks.map((track) => ({ title: track.title, steps: (track.lessons || []).filter(matchesQuery) })),
  ].filter((group) => group.steps?.length);
  return groups
    .map(
      (group) => `
        <optgroup label="${escapeHtml(group.title)}">
          ${group.steps
            .map((step) => `<option value="${step.id}" ${step.id === canonicalSelectedId ? "selected" : ""}>${step.id} · ${escapeHtml(step.title)}</option>`)
            .join("")}
        </optgroup>`,
    )
    .join("");
}

function selectCoachCurriculumSuggestion(button) {
  const label = button?.closest("label");
  const input = label?.querySelector("[data-curriculum-option-search]");
  const select = label?.querySelector("select");
  const target = label?.querySelector("[data-curriculum-option-suggestions]");
  const step = selectedCurriculum(button?.dataset.curriculumOptionCode || "");
  if (!input || !select || !step) return;
  input.value = `${step.id} · ${step.title}`;
  select.innerHTML = `<option value="">검색·선택</option>${curriculumOptions(step.id, "", true)}`;
  select.value = step.id;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  if (target) target.hidden = true;
  updateCoachCurriculumDetailLink(input);
  input.focus();
}
