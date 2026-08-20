// 커리큘럼 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMemberCurriculumLibrary(active = activeCurriculumStep()) {
  const target = $("#memberCurriculumLibrary");
  if (target) target.innerHTML = memberCurriculumLibraryMarkup(active);
  const count = filteredMemberCurriculumTracks().reduce((sum, track) => sum + track.steps.length, 0);
  if ($("#memberCurriculumCount")) $("#memberCurriculumCount").textContent = `${count}개 단계`;
}

function renderCurriculum() {
  const latest = latestCurriculumLog();
  const active = activeCurriculumStep();
  const activeTrack = curriculumSkillTracks.find((track) => track.steps.some((step) => step.id === active.id));
  const activeIndex = activeTrack?.steps.findIndex((step) => step.id === active.id) ?? -1;
  const nextStage = curriculumStageCards().find(({ tone }) => tone === "next")?.step;
  const guideMarkup = `
    <div class="curriculum-summary">
      <span>다음 수업</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <small>${activeTrack ? `${escapeHtml(activeTrack.title)} ${activeIndex + 1}/${activeTrack.steps.length}` : "코치 지정 단계"} · ${escapeHtml(latest?.lessonLabel || "최근 등록 기준")}</small>
      <p>${escapeHtml(active.goal || active.guide || active.next || active.focus)}</p>
      <details class="curriculum-action-details">
        <summary class="primary-button">3단계 시작</summary>
        ${curriculumThreeStepsMarkup(active)}
        ${curriculumSupportMarkup(active)}
        ${curriculumResourceLinks(active)}
      </details>
    </div>
    ${nextStage ? `
      <div class="curriculum-next-preview">
        <span>그다음 단계</span>
        <strong>${escapeHtml(nextStage.title)}</strong>
        <small>${escapeHtml(nextStage.focus)}</small>
      </div>` : ""}`;
  const miniGuideMarkup = `
    <button class="curriculum-compact-card" type="button" data-open-curriculum-view>
      <span>다음 커리큘럼</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <small>${activeTrack ? `${escapeHtml(activeTrack.title)} ${activeIndex + 1}/${activeTrack.steps.length}` : "코치 지정 단계"} · ${escapeHtml(latest?.lessonLabel || "최근 등록 기준")}</small>
      <b>상세 보기</b>
    </button>`;
  if ($("#curriculumMiniGuide")) $("#curriculumMiniGuide").innerHTML = miniGuideMarkup;
  if ($("#curriculumGuide")) $("#curriculumGuide").innerHTML = `
    <section class="curriculum-hero">
      <div>
        <span>내 커리큘럼</span>
        <strong>${escapeHtml(activeTrack?.title || active.title)}</strong>
        <p>현재 단계와 다음 수업만 간단히 확인하세요.</p>
      </div>
    </section>
    ${guideMarkup}`;
  if ($("#curriculumFullList")) {
    $("#curriculumFullList").innerHTML = `
      <details class="curriculum-library-disclosure">
        <summary>다른 기술 찾아보기</summary>
        <div class="curriculum-library-body">
          <section class="member-curriculum-toolbar" aria-label="커리큘럼 검색과 필터">
            <div class="member-curriculum-search-row">
              <input id="memberCurriculumSearch" type="search" value="${escapeHtml(state.curriculumQuery || "")}" placeholder="기술 검색" />
              <b id="memberCurriculumCount"></b>
            </div>
            <div class="curriculum-filter-row">
              ${memberCurriculumFilterOptions()
                .map(
                  (filter) => `
                    <button class="curriculum-filter ${state.curriculumFilter === filter.id ? "is-active" : ""}" type="button" data-member-curriculum-filter="${filter.id}">${filter.label}</button>`,
                )
                .join("")}
            </div>
          </section>
          <div id="memberCurriculumLibrary"></div>
          <a class="curriculum-source-link" href="${notionCurriculumGuideUrl}" target="_blank" rel="noreferrer">Notion 전체 원본</a>
        </div>
      </details>`;
    renderMemberCurriculumLibrary(active);
  }
}
