// 커리큘럼 단계와 자료 링크를 고르는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function curriculumById(id, fallback) {
  const canonicalId = curriculumCatalog.aliases?.[id] || id;
  return curriculumSteps.find((step) => step.id === canonicalId) || fallback || curriculumSteps[0];
}

function activeCurriculumStep() {
  const latest = latestCurriculumLog();
  return curriculumById(latest?.nextCurriculumId || latest?.curriculum?.id, latest?.curriculum);
}

function curriculumStageCards() {
  const active = activeCurriculumStep();
  const track = curriculumSkillTracks.find((item) => item.steps.some((step) => step.id === active.id));
  const trackSteps = track?.steps?.length ? track.steps : curriculumSteps;
  const activeIndex = Math.max(0, trackSteps.findIndex((step) => step.id === active.id));
  const review = trackSteps[Math.max(0, activeIndex - 1)] || active;
  const next = curriculumById(active.nextLessonId, trackSteps[Math.min(trackSteps.length - 1, activeIndex + 1)] || active);
  return [
    { label: "현재 단계", step: active, tone: "current" },
    { label: "다음 단계", step: next, tone: "next" },
    { label: "복습 추천", step: review, tone: "review" },
  ];
}

function memberCurriculumFilterOptions() {
  return window.TennisNoteCurriculumUI.groups;
}

function memberCurriculumMatchesFilter(filter, category) {
  if (filter === "all") return true;
  return memberCurriculumFilterOptions().find(group => group.id === filter)?.categories.includes(category) || false;
}

function curriculumResourceLinks(step = {}) {
  const resources = window.TennisNoteCurriculumUI.resources(step);
  if (!resources.length) return '<p class="curriculum-resource-empty">이 수업에 등록된 자료가 없습니다.</p>';
  return `
    <details class="curriculum-resources"><summary>수업 자료 · ${resources.length}개</summary>
    <p class="curriculum-online-note">영상은 온라인에서 재생됩니다. 외부 재생이 제한되면 원본에서 확인해 주세요.</p>
    <div class="curriculum-resource-links" aria-label="수업 자료">
      ${resources
        .map((resource, index) => {
          const url = String(resource.url || "");
          const videoId = curriculumYoutubeVideoId(url);
          const title = String(resource.title || `커리큘럼 영상 ${index + 1}`);
          const interval = resource.start !== null || resource.end !== null
            ? `구간 ${resource.start ?? 0}초부터${resource.end !== null ? ` ${resource.end}초까지` : ""}` : "";
          return `
            <div class="curriculum-video-item" data-curriculum-resource-index="${index}">
              <strong>${escapeHtml(title)}</strong>
              ${resource.observation ? `<p>${escapeHtml(resource.observation)}</p>` : ""}
              ${interval ? `<small>${escapeHtml(interval)}</small>` : ""}
              ${videoId ? `<button class="small-button" type="button" data-play-curriculum-video="${videoId}" data-curriculum-video-title="${escapeHtml(title)}" data-video-start="${resource.start ?? ""}" data-video-end="${resource.end ?? ""}">영상 재생</button>`
                : `<a class="small-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">자료 보기</a>`}
            </div>`;
        })
        .join("")}
    </div></details>`;
}

function curriculumThreeStepsMarkup(step = {}) {
  const lessonSteps = Array.isArray(step.steps) ? step.steps : [];
  if (!lessonSteps.length) return "";
  return `
    <ol class="curriculum-three-steps">
      ${lessonSteps.map((item, index) => `<li><b>${index + 1}</b><span>${escapeHtml(item)}</span></li>`).join("")}
    </ol>`;
}

function curriculumSupportMarkup(step = {}) {
  const checks = Array.isArray(step.selfChecks) ? step.selfChecks : [];
  const practice = Array.isArray(step.personalPractice) ? step.personalPractice : [step.personalPractice].filter(Boolean);
  if (!checks.length && !practice.length) return "";
  return `
    <details class="curriculum-support-details">
      <summary>자가 체크·개인 연습</summary>
      ${checks.length ? `<ul>${checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${practice.length ? `<p><b>개인 연습</b></p><ul>${practice.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}
    </details>`;
}

function activeMemberCurriculumStep() {
  const legacy = activeCurriculumStep();
  return memberCurriculumSteps.find(step => step.id === legacy?.id) || memberCurriculumSteps[0];
}
