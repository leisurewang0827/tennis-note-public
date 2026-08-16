(() => {
  const STOP_WORDS = new Set([
    "관련", "내용", "기술", "단계", "수업", "커리큘럼", "회원", "오늘", "다음", "자꾸", "조금", "하고", "하는", "에서", "으로", "처럼", "같이",
  ]);

  const SYNONYM_GROUPS = [
    { triggers: ["늦", "밀려", "밀림", "느림", "준비"], terms: ["준비", "타이밍", "백스윙", "첫발", "스플릿"] },
    { triggers: ["빠름", "급함", "서두름"], terms: ["리듬", "타이밍", "밸런스", "템포"] },
    { triggers: ["길어", "길게", "아웃", "오버"], terms: ["깊이", "스핀", "궤도", "컨트롤", "임팩트"] },
    { triggers: ["짧아", "짧게", "네트"], terms: ["높이", "궤도", "임팩트", "체중이동"] },
    { triggers: ["힘", "팔로", "팔만", "세게"], terms: ["밸런스", "체중이동", "회전", "연결", "힘빼기"] },
    { triggers: ["발", "스텝", "자리", "거리"], terms: ["풋워크", "회복", "스플릿", "첫발", "간격"] },
    { triggers: ["타점", "맞는점", "컨택"], terms: ["타점", "컨택", "임팩트", "거리"] },
    { triggers: ["방향", "코스", "조준"], terms: ["코스", "방향", "컨트롤", "목표"] },
    { triggers: ["불안", "흔들", "일정하지", "실수"], terms: ["안정", "반복", "리듬", "밸런스"] },
  ];

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[·•–—_\-\/\\()[\]{}:;,.!?|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function queryTerms(value) {
    const query = normalize(value);
    const direct = query
      .split(" ")
      .map((term) => term.replace(/(은|는|이|가|을|를|에|의|도|만|부터|까지|해요|돼요|됩니다)$/u, ""))
      .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
    const expanded = [];
    SYNONYM_GROUPS.forEach((group) => {
      if (group.triggers.some((trigger) => query.includes(trigger))) expanded.push(...group.terms);
    });
    return {
      query,
      direct: [...new Set(direct)],
      expanded: [...new Set(expanded.map(normalize))].filter((term) => !direct.includes(term)),
    };
  }

  function joinValues(value) {
    if (Array.isArray(value)) return value.map(joinValues).join(" ");
    if (value && typeof value === "object") return Object.values(value).map(joinValues).join(" ");
    return String(value || "");
  }

  function searchableFields(step = {}) {
    return [
      { name: "code", weight: 32, text: step.id },
      { name: "title", weight: 28, text: step.title },
      { name: "focus", weight: 22, text: step.focus },
      { name: "track", weight: 18, text: `${step.trackTitle || ""} ${step.category || ""} ${step.level || ""} ${step.stageLabel || ""}` },
      { name: "goal", weight: 12, text: `${step.goal || ""} ${step.guide || ""} ${step.memberSummary || ""}` },
      { name: "lesson", weight: 9, text: `${joinValues(step.steps)} ${joinValues(step.selfChecks)} ${step.checklist || ""}` },
      { name: "practice", weight: 8, text: `${step.personalPractice || ""} ${step.mission || ""}` },
      { name: "resource", weight: 3, text: joinValues(step.resources) },
    ].map((field) => ({ ...field, normalized: normalize(field.text) }));
  }

  function scoreStep(step, parsed) {
    const fields = searchableFields(step);
    let score = 0;
    const matches = new Set();
    if (parsed.query) {
      fields.forEach((field) => {
        if (field.normalized.includes(parsed.query)) {
          score += field.weight * 3;
          matches.add(field.name);
        }
      });
    }
    parsed.direct.forEach((term) => {
      fields.forEach((field) => {
        if (!field.normalized.includes(term)) return;
        score += field.weight;
        matches.add(field.name);
      });
    });
    parsed.expanded.forEach((term) => {
      fields.forEach((field) => {
        if (!field.normalized.includes(term)) return;
        score += Math.max(2, Math.round(field.weight * 0.32));
        matches.add(field.name);
      });
    });
    return { score, matches: [...matches] };
  }

  function search(steps, value, options = {}) {
    const list = Array.isArray(steps) ? steps : [];
    const parsed = queryTerms(value);
    const limit = Math.max(1, Number(options.limit) || 24);
    if (!parsed.query) {
      return list.slice(0, limit).map((step) => ({ step, score: 0, matches: [] }));
    }
    return list
      .map((step, index) => ({ step, index, ...scoreStep(step, parsed) }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score
        || Number(left.step.stage || 0) - Number(right.step.stage || 0)
        || left.index - right.index)
      .slice(0, limit)
      .map(({ step, score, matches }) => ({ step, score, matches }));
  }

  window.TennisNoteCurriculumSearch = Object.freeze({ normalize, queryTerms, searchableFields, search });
})();
