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
  return [
    { id: "all", label: "전체" },
    { id: "stroke", label: "스트로크" },
    { id: "net", label: "네트" },
    { id: "tactics", label: "전술" },
    { id: "foundation", label: "풋워크·서브" },
  ];
}

function memberCurriculumMatchesFilter(filter, category) {
  if (filter === "all") return true;
  if (filter === "stroke") return ["포핸드", "백핸드"].includes(category);
  if (filter === "net") return category === "네트플레이";
  if (filter === "tactics") return category === "전술전환";
  if (filter === "foundation") return ["풋워크", "서브"].includes(category);
  return false;
}

function curriculumResourceLinks(step = {}) {
  const resources = Array.isArray(step.resources) ? step.resources : [];
  if (!resources.length) return "";
  return `
    <div class="curriculum-resource-links" aria-label="수업 자료">
      ${resources
        .map((resource, index) => {
          const url = String(resource.url || "");
          const videoId = curriculumYoutubeVideoId(url);
          if (!videoId) {
            return `<a class="small-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">자료 ${index + 1} 보기</a>`;
          }
          const title = String(resource.title || `커리큘럼 영상 ${index + 1}`);
          return `
            <div class="curriculum-video-item">
              <button class="small-button" type="button" data-play-curriculum-video="${videoId}" data-curriculum-video-title="${escapeHtml(title)}">
                영상 ${index + 1} 재생
              </button>
            </div>`;
        })
        .join("")}
    </div>`;
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
  if (!checks.length && !step.personalPractice) return "";
  return `
    <details class="curriculum-support-details">
      <summary>자가 체크·개인 연습</summary>
      ${checks.length ? `<ul>${checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${step.personalPractice ? `<p><b>개인 연습</b>${escapeHtml(step.personalPractice)}</p>` : ""}
    </details>`;
}
