// 커리큘럼 단계를 고르고 걸러내는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function selectedCurriculum(id) {
  const canonicalId = canonicalCurriculumId(id);
  return curriculumSteps.find((step) => step.id === canonicalId) || curriculumSteps[0];
}

function canonicalCurriculumId(id = "") {
  return curriculumCatalog.aliases?.[id] || id || "";
}

function curriculumNotionUrl(step) {
  return step?.notionUrl || notionCurriculumDetailUrl;
}

function curriculumFilterOptions() {
  return [
    { id: "all", label: "전체" },
    { id: "favorite", label: "즐겨찾기" },
    { id: "기초", label: "기초" },
    { id: "포핸드", label: "포핸드" },
    { id: "백핸드", label: "백핸드" },
    { id: "네트플레이", label: "네트" },
    { id: "전술전환", label: "전술" },
    { id: "풋워크", label: "풋워크" },
    { id: "서브", label: "서브" },
  ];
}

function filteredCurriculumSteps() {
  const query = (state.curriculumQuery || "").trim().toLowerCase();
  const filter = state.curriculumFilter || "all";
  return curriculumSteps.filter((step) => {
    const text = `${step.id} ${step.title} ${step.level || ""} ${step.category || ""} ${step.focus} ${step.guide}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "favorite" && (state.favoriteCurriculums || []).includes(step.id)) ||
      step.level === filter ||
      step.category === filter;
    return matchesQuery && matchesFilter;
  });
}

function curriculumLibraryMarkup() {
  const steps = filteredCurriculumSteps();
  if (!steps.length) return "<p class='empty-text'>조건에 맞는 커리큘럼이 없습니다.</p>";
  const groups = new Map();
  steps.forEach((step) => {
    const groupId = step.trackId || step.category || "기타";
    if (!groups.has(groupId)) groups.set(groupId, { title: step.trackTitle || step.category || "기타", steps: [] });
    groups.get(groupId).steps.push(step);
  });
  const expandGroups = Boolean((state.curriculumQuery || "").trim()) || state.curriculumFilter !== "all";
  return [...groups.values()]
    .map(
      (group) => `
        <details class="curriculum-track-group" ${expandGroups ? "open" : ""}>
          <summary>
            <strong>${escapeHtml(group.title)}</strong>
            <span>${group.steps.length}개 단계</span>
          </summary>
          <div class="curriculum-library-grid">
            ${group.steps
              .map(
                (step) => `
                  <article class="curriculum-card" data-open-curriculum-detail="${step.id}">
                    <div class="curriculum-card-head">
                      <strong>${escapeHtml(step.title)}</strong>
                      <button class="favorite-button ${(state.favoriteCurriculums || []).includes(step.id) ? "is-active" : ""}" type="button" data-toggle-curriculum-favorite="${step.id}" aria-label="즐겨찾기">★</button>
                    </div>
                    <div class="curriculum-meta">
                      <b>${escapeHtml(step.stageLabel || step.level || "단계")}</b>
                      <b>${escapeHtml(step.category || "기술")}</b>
                      <small>${escapeHtml(step.id)}</small>
                    </div>
                    <span>${escapeHtml(step.focus)}</span>
                    ${step.environmentNote ? `<p class="curriculum-environment-note">${escapeHtml(step.environmentNote)}</p>` : `<p>${escapeHtml(step.checklist || step.guide)}</p>`}
                    <div class="actions">
                      <button class="small-button" type="button" data-open-curriculum-detail="${step.id}">상세 보기</button>
                      <a class="small-button" href="${curriculumNotionUrl(step)}" target="_blank" rel="noreferrer">자료</a>
                    </div>
                  </article>`,
              )
              .join("")}
          </div>
        </details>`,
    )
    .join("");
}
