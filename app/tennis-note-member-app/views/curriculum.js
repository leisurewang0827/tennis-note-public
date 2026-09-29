// 커리큘럼 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMemberCurriculumLibrary(active = activeMemberCurriculumStep()) {
  if (!memberCurriculumUI.authorized()) return;
  // Search/filter is an explicit navigation action. Never replace the separately opened current lesson.
  if (curriculumPlayer?.frame.closest("#memberCurriculumLibrary")) closeCurriculumPlayer();
  const target = $("#memberCurriculumLibrary");
  if (target) target.innerHTML = memberCurriculumLibraryMarkup(active);
  const count = filteredMemberCurriculumTracks().reduce((sum, track) => sum + track.steps.length, 0);
  if ($("#memberCurriculumCount")) $("#memberCurriculumCount").textContent = `${count}개 단계`;
}

function renderCurriculum() {
  if (!memberCurriculumUI.authorized()) {
    const guide = $("#curriculumGuide");
    if (guide) {
      const status = document.createElement("div");
      status.className = "curriculum-summary";
      status.setAttribute("role", "status");
      const title = document.createElement("strong");
      const description = document.createElement("p");
      if (state.member?.role === "member") {
        title.textContent = "회원 커리큘럼 권한을 확인하지 못했습니다";
        description.textContent = "로그인 상태를 확인한 뒤 다시 열어주세요. 계속되면 관리자에게 문의해 주세요.";
      } else {
        title.textContent = "회원 커리큘럼 이용 안내";
        description.textContent = "커리큘럼은 인증된 회원 계정에서 볼 수 있습니다. 회원 계정으로 로그인해 주세요.";
      }
      status.append(title, description);
      guide.replaceChildren(status);
    }
    $("#curriculumFullList")?.replaceChildren();
    $("#curriculumMiniGuide")?.replaceChildren();
    return;
  }
  const activity = memberCurriculumActivity();
  memberCurriculumUI.activity(activity);
  if (activity.lessonOpen || activity.videoPlaying) return;
  const latest = latestCurriculumLog();
  const active = activeMemberCurriculumStep();
  if (!active) {
    $("#curriculumGuide")?.replaceChildren(); $("#curriculumFullList")?.replaceChildren();
    return;
  }
  const activeTrack = memberCurriculumTracks.find((track) => track.steps.some((step) => step.id === active.id));
  const activeIndex = activeTrack?.steps.findIndex((step) => step.id === active.id) ?? -1;
  const nextStage = memberCurriculumSteps.find(step => step.id === active.nextLessonId);
  const guideMarkup = `
    <div class="curriculum-summary">
      <span>${latest?.nextCurriculumId || latest?.curriculum?.id ? "지금 수업" : "아직 지정된 수업이 없습니다 · 수업 둘러보기"}</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <p class="curriculum-current-goal">${escapeHtml(active.goal || active.guide || active.next || active.focus)}</p>
      <details class="curriculum-action-details">
        <summary class="primary-button">오늘 수업 시작</summary>
        ${curriculumThreeStepsMarkup(active)}
        ${curriculumSupportMarkup(active)}
        ${curriculumResourceLinks(active)}
      </details>
    </div>
    ${nextStage ? `
      <div class="curriculum-next-preview">
        <span>다음 수업</span>
        <strong>${escapeHtml(nextStage.title)}</strong>
      </div>` : ""}`;
  const miniGuideMarkup = `
    <button class="curriculum-compact-card" type="button" data-open-curriculum-view>
      <span>다음 커리큘럼</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <small>${activeTrack ? `${escapeHtml(activeTrack.title)} ${activeIndex + 1}/${activeTrack.steps.length}` : "코치 지정 단계"} · ${escapeHtml(latest?.lessonLabel || "최근 등록 기준")}</small>
      <b>상세 보기</b>
    </button>`;
  if ($("#curriculumMiniGuide")) $("#curriculumMiniGuide").innerHTML = miniGuideMarkup;
  if ($("#curriculumGuide")) $("#curriculumGuide").innerHTML = guideMarkup;
  if ($("#curriculumFullList")) {
    $("#curriculumFullList").innerHTML = `
      <details class="curriculum-library-disclosure">
        <summary>다른 기술 찾기</summary>
        <div class="curriculum-library-body">
          <section class="member-curriculum-toolbar" aria-label="커리큘럼 검색과 필터">
            <div class="member-curriculum-search-row">
              <input id="memberCurriculumSearch" type="search" value="${escapeHtml(state.curriculumQuery || "")}" placeholder="기술 검색" aria-label="커리큘럼 기술 검색" />
              <b id="memberCurriculumCount"></b>
            </div>
            <div class="curriculum-filter-row">
              ${memberCurriculumFilterOptions()
                .map(
                  (filter) => `
                    <button class="curriculum-filter ${state.curriculumFilter === filter.id ? "is-active" : ""}" aria-pressed="${state.curriculumFilter === filter.id}" type="button" data-member-curriculum-filter="${filter.id}">${filter.label}</button>`,
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
