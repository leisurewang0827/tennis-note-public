// 커리큘럼 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderCoachCurriculumSuggestions(input) {
  const target = input?.closest("label")?.querySelector("[data-curriculum-option-suggestions]");
  if (!target) return;
  const query = String(input.value || "").trim();
  const exactCode = canonicalCurriculumId(query.split(/\s|·/)[0]);
  const exactStep = curriculumSteps.find((step) => step.id === exactCode);
  if (!query || (exactStep && `${exactStep.id} · ${exactStep.title}` === query)) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  const matches = coachCurriculumSearchResults(query);
  target.hidden = false;
  target.innerHTML = matches.length
    ? matches.map((step, index) => `<div class="tn-curriculum-suggestion-row"><button type="button" class="tn-curriculum-suggestion${index === 0 ? " is-active" : ""}" role="option" data-curriculum-option-code="${escapeHtml(step.id)}"><strong>${escapeHtml(`${step.id} · ${step.title}`)}</strong><span>${escapeHtml([step.trackTitle || step.category, step.stageLabel || step.level].filter(Boolean).join(" · "))}</span><small>${escapeHtml(step.focus || step.goal || step.guide || "선택한 단계가 다음 커리큘럼으로 저장됩니다.")}</small></button>${coachCurriculumDetailLinkMarkup(step)}</div>`).join("")
    : '<p class="tn-curriculum-suggestions-empty">일치하는 단계가 없습니다. 증상이나 동작을 다른 말로 입력해 보세요.</p>';
}

function renderCurriculumDetailPanel() {
  const step = selectedCurriculum(state.viewingCurriculumId);
  return `
    <section class="schedule-edit-panel curriculum-detail-panel">
      <div class="wide">
        <strong>${step.id} · ${step.title}</strong>
        <span>${step.level || "단계"} · ${step.category || "커리큘럼"}</span>
      </div>
      <article class="modal-info-card">
        <span>오늘 수업 목표</span>
        <strong>${step.focus}</strong>
        <small>${step.guide}</small>
      </article>
      <article class="modal-info-card">
        <span>코치 체크포인트</span>
        <strong>${step.checklist || "코치가 회원 상태에 맞춰 핵심 포인트를 확인합니다."}</strong>
      </article>
      <article class="modal-info-card">
        <span>회원 숙제</span>
        <strong>${step.mission || "개인 연습에서 같은 루틴을 짧게 반복합니다."}</strong>
      </article>
      <div class="actions wide">
        <a class="small-button" href="${curriculumNotionUrl(step)}" target="_blank" rel="noreferrer">상세 자료 보기</a>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function renderCurriculumLibraryOnly() {
  const groups = document.querySelector(".curriculum-track-groups");
  if (groups) groups.innerHTML = curriculumLibraryMarkup();
}

function renderCurriculums() {
  const target = $("#curriculumSteps");
  if (!target) return;
  target.innerHTML = `
    <section class="curriculum-source-panel">
      <div>
        <strong>회원 다음 커리큘럼</strong>
        <span>오늘 수업 기록에서 회원별 다음 단계를 지정합니다.</span>
      </div>
      <div class="actions">
        <button class="primary-button" type="button" data-summary-action="records">회원 선택·지정</button>
      </div>
    </section>
    <details class="curriculum-browse-disclosure" open>
      <summary>커리큘럼 검색·빠른 보기</summary>
      <div class="curriculum-browse-body">
    <section class="curriculum-toolbar" aria-label="커리큘럼 검색과 필터">
      <input id="curriculumSearchInput" type="search" value="${state.curriculumQuery || ""}" placeholder="기술, 단계, 코드 검색" />
      <div class="curriculum-filter-row">
        ${curriculumFilterOptions()
          .map(
            (filter) => `
              <button class="curriculum-filter ${state.curriculumFilter === filter.id || (!state.curriculumFilter && filter.id === "all") ? "is-active" : ""}" type="button" data-curriculum-filter="${filter.id}">
                ${filter.label}
              </button>`,
          )
          .join("")}
      </div>
    </section>
    <section class="curriculum-library-panel">
      <div class="record-section-title">
        <strong>커리큘럼 빠른 보기</strong>
        <small>다음 수업에 사용할 단계를 빠르게 확인합니다.</small>
      </div>
      <div class="curriculum-track-groups">${curriculumLibraryMarkup()}</div>
    </section>
      <div class="curriculum-reference-actions">
        <a class="small-button" href="${notionCurriculumGuideUrl}" target="_blank" rel="noreferrer">회원용 안내</a>
        <a class="small-button" href="${notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">전체 자료</a>
      </div>
      </div>
    </details>`;
}
