(function () {
  const keywordAliases = [
    [/포핸드\s*백핸드/gi, "포핸드, 백핸드"],
    [/스윙\s*크게/gi, "스윙 크기"],
    [/몸\s*회전/gi, "몸통 회전"],
    [/허리\s*회전/gi, "몸통 회전"],
    [/준비\s*늦(?:음|게|어짐)?/gi, "준비가 늦음"],
    [/타점\s*늦(?:음|게|어짐)?/gi, "타점이 늦음"],
  ];
  const technicalTerms = [
    "포핸드", "백핸드", "서브", "리턴", "발리", "스매시", "풋워크",
    "테이크백", "백스윙", "스윙 크기", "스윙", "팔로스루", "타점", "임팩트",
    "몸통 회전", "어깨 회전", "하체", "체중 이동", "준비", "회복", "리듬",
    "밸런스", "균형", "간격", "스텝", "라켓면", "토스", "궤적", "스핀",
  ];

  function normalizedKeywordSource(value) {
    return keywordAliases.reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      String(value || "").replace(/[、\/]+/g, ","),
    );
  }

  function keywordsFrom(value) {
    const seen = new Set();
    const selected = [];
    const source = normalizedKeywordSource(value);
    const explicit = source
      .split(/[,;\n|]+/)
      .map((item) => item.trim().replace(/\s+/g, " "));
    const extracted = technicalTerms.filter((term) => source.includes(term));
    const candidates = explicit.flatMap((item) => {
      if (!item) return [];
      const terms = extracted.filter((term) => item.includes(term));
      if (terms.length >= 2 || item.length > 24) return terms.length ? terms : item.split(/\s+/);
      return [item];
    });
    [...candidates, ...extracted]
      .map((item) => item.trim().replace(/\s+/g, " "))
      .some((item) => {
        const normalized = item.toLocaleLowerCase("ko-KR");
        if (!item || item.length < 2 || seen.has(normalized)) return false;
        if (selected.some((existing) => existing.toLocaleLowerCase("ko-KR").includes(normalized))) return false;
        seen.add(normalized);
        selected.push(item);
        return selected.length >= 5;
      });
    return selected;
  }

  function hashOf(value) {
    return [...String(value || "")].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
  }

  function sentence(value) {
    const text = String(value || "").trim().replace(/[.!?]+$/g, "");
    return text ? `${text}.` : "";
  }

  function displayKeyword(value) {
    const text = String(value || "").trim();
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }

  function concise(value, maximum = 78) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^[•·\-\s]+/, "")
      .trim();
    if (!text) return "";
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/g, "");
    return firstSentence.length > maximum ? `${firstSentence.slice(0, maximum).trim()}…` : firstSentence;
  }

  function joinedTerms(values) {
    const unique = [...new Set(values.filter(Boolean).map(displayKeyword))];
    if (!unique.length) return "핵심 동작";
    if (unique.length === 1) return unique[0];
    if (unique.length === 2) return `${unique[0]}와 ${unique[1]}`;
    return `${unique[0]}·${unique[1]}·${unique[2]}`;
  }

  function observationSummary(value, kind) {
    const text = String(value || "").trim();
    if (kind === "positive") {
      if (/회복/.test(text)) return "회복 후 균형";
      if (/준비/.test(text)) return "준비 동작";
      if (/타점/.test(text)) return "타점의 안정감";
      if (/리듬/.test(text)) return "스윙 리듬";
      return `${displayKeyword(text).replace(/(?:됨|함|나타남)$/g, "").trim()} 동작`;
    }
    if (/타점.*(?:뒤|밀|늦)/.test(text)) return "타점이 뒤로 밀리거나 늦어지는 구간";
    if (/준비.*늦/.test(text)) return "준비가 늦어지는 구간";
    if (/리듬.*(?:불안|흔들)/.test(text)) return "리듬이 흔들리는 구간";
    if (/네트/.test(text)) return "공이 네트에 걸리는 구간";
    if (/아웃|길/.test(text)) return "공이 길어지는 구간";
    return `${displayKeyword(text).replace(/(?:됨|함|나타남)$/g, "").trim()} 구간`;
  }

  function curriculumContext(value = {}) {
    const curriculum = value && typeof value === "object" ? value : {};
    return {
      id: String(curriculum.id || "").trim(),
      title: concise(curriculum.title, 36),
      focus: concise(curriculum.focus || curriculum.guide, 64),
      goal: concise(curriculum.goal, 92),
      practice: concise(curriculum.personalPractice || curriculum.mission || curriculum.selfChecks?.[0], 92),
    };
  }

  function generate(value, context = {}) {
    const keywords = keywordsFrom(value);
    if (!keywords.length) {
      return {
        ok: false,
        message: "수업 키워드를 하나 이상 입력해 주세요.",
        keywords: [],
        sections: [],
        variant: 0,
        comment: "",
      };
    }

    const positivePattern = /(좋|안정|개선|성공|정확|부드럽|일정|집중|유지|연결됨|잘됨)/;
    const challengePattern = /(늦|빠르|밀리|흔들|불안|실수|부족|약함|강함|짧|길|네트|아웃|놓침|어려)/;
    const positives = keywords.filter((keyword) => positivePattern.test(keyword)).map(displayKeyword);
    const challenges = keywords.filter((keyword) => challengePattern.test(keyword)).map(displayKeyword);
    const focus = keywords
      .filter((keyword) => !positivePattern.test(keyword) && !challengePattern.test(keyword))
      .map(displayKeyword);
    const displayKeywords = keywords.map(displayKeyword);
    const subject = joinedTerms((focus.length ? focus : displayKeywords).slice(0, 3));
    const curriculum = curriculumContext(context.curriculum);
    const variant = hashOf(`${keywords.join("|")}|${curriculum.id}`) % 6;

    const reviews = [
      `${subject} 중심으로 준비부터 타점, 마무리까지 순서대로 점검했습니다`,
      `${subject} 동작을 반복하며 리듬이 끊기는 지점과 안정되는 지점을 비교했습니다`,
      `${subject}에서 공을 보기 전 준비와 임팩트 뒤 회복 동작을 연결했습니다`,
      `${subject} 동작을 실제 랠리에 적용하며 다시 만들 수 있는 기준을 정했습니다`,
      `${subject} 동작을 낮은 속도부터 시작해 정확도와 균형 변화를 확인했습니다`,
      `${subject}의 시작 자세, 임팩트, 다음 공 준비를 각각 나눠 연습했습니다`,
    ];
    const nextGoals = [
      `준비를 한 박자 빠르게 시작해 같은 타점을 3회 연속 만드는 것을 목표로 합니다`,
      `힘보다 리듬을 우선해 성공 동작의 속도를 일정하게 만듭니다`,
      `준비 → 타점 → 회복 순서를 끊김 없이 연결합니다`,
      `한 번에 한 가지 기준만 확인하고 랠리 속도에서도 유지합니다`,
      `공의 방향이 바뀌어도 첫 준비 자세가 달라지지 않게 만듭니다`,
      `성공한 동작 직후 균형을 유지하고 다음 공까지 빠르게 회복합니다`,
    ];
    const practices = [
      `핵심 동작을 공 없이 천천히 10회 반복한 뒤 짧은 랠리로 연결해 주세요`,
      `거울이나 영상으로 준비 자세를 5회 확인하고 같은 템포로 10회 반복해 주세요`,
      `낮은 속도에서 3회 연속 성공한 뒤 속도를 한 단계씩 높여 주세요`,
      `동작 전후의 균형을 확인하며 30초씩 3세트 연습해 주세요`,
      `목표 지점을 정해 5개씩 3세트 진행하고 성공 횟수를 기록해 주세요`,
      `준비와 회복만 따로 10회 연습한 뒤 공을 치는 동작과 연결해 주세요`,
    ];

    const sections = [
      { label: "오늘 수업", text: sentence(reviews[variant]) },
    ];
    if (positives.length) {
      sections.push({
        label: "잘된 점",
        text: sentence(`${joinedTerms(positives.slice(0, 2).map((item) => observationSummary(item, "positive")))} 부분은 반복할수록 안정되어 성공 기준으로 확인했습니다`),
      });
    }
    if (!positives.length) {
      sections.push({
        label: "확인한 점",
        text: sentence("속도를 낮추고 같은 리듬으로 반복할 때 동작 기준을 더 분명하게 확인할 수 있습니다"),
      });
    }
    sections.push({
      label: "보완할 점",
      text: sentence(challenges.length
        ? `${joinedTerms(challenges.slice(0, 2).map((item) => observationSummary(item, "challenge")))}에서는 속도를 낮추고 준비 위치부터 다시 확인합니다`
        : "공의 속도가 빨라져도 준비 순서가 바뀌지 않도록 동작 크기보다 시작 자세를 먼저 맞춥니다"),
    });
    sections.push(
      {
        label: "다음 목표",
        text: sentence(curriculum.goal || (curriculum.title ? `${curriculum.title}: ${curriculum.focus || nextGoals[variant]}` : nextGoals[variant])),
      },
      { label: "개인 연습", text: sentence(curriculum.practice || practices[variant]) },
    );

    const comment = sections.map((item) => `${item.label}: ${item.text}`).join("\n");
    return {
      ok: true,
      message: "",
      keywords,
      sections,
      variant,
      curriculumId: curriculum.id,
      comment: comment.length <= 500 ? comment : `${comment.slice(0, 497).trimEnd()}…`,
    };
  }

  window.TennisNoteCommentDraft = Object.freeze({ keywordsFrom, generate });
})();
