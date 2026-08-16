(function () {
  function keywordsFrom(value) {
    const seen = new Set();
    return String(value || "")
      .split(/[,;\n|]+/)
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter((item) => {
        const normalized = item.toLowerCase();
        if (!item || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, 5);
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

  function generate(value) {
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
    const subject = (focus.length ? focus : displayKeywords).slice(0, 3).join(" · ");
    const nextFocus = (challenges.at(-1) || focus.at(-1) || displayKeywords.at(-1));
    const variant = hashOf(keywords.join("|")) % 4;

    const reviews = [
      `${subject}을 중심으로 준비, 타점, 마무리 순서를 나눠 확인했습니다`,
      `${subject} 동작을 반복하면서 리듬과 균형이 유지되는 구간을 확인했습니다`,
      `${subject} 상황에서 공을 보기 전 준비와 임팩트 뒤 회복을 함께 점검했습니다`,
      `${subject}을 실제 랠리 흐름에 연결하며 재현 가능한 동작 기준을 정리했습니다`,
    ];
    const nextGoals = [
      `${nextFocus}에서 준비를 한 박자 빠르게 하고 같은 타점을 3회 연속 만드는 것을 목표로 합니다`,
      `${nextFocus} 동작을 힘보다 리듬 중심으로 반복해 성공 기준을 일정하게 만듭니다`,
      `${nextFocus} 구간에서 준비 → 타점 → 회복 순서를 끊기지 않게 연결합니다`,
      `${nextFocus}을 한 번에 하나의 기준으로 점검하고 랠리 속도에서도 유지합니다`,
    ];
    const practices = [
      `${nextFocus} 핵심 동작을 공 없이 천천히 10회 반복한 뒤 짧은 랠리로 연결해 주세요`,
      `거울 또는 영상으로 ${nextFocus} 준비 자세를 5회 확인하고 같은 템포로 10회 반복해 주세요`,
      `${nextFocus}을 낮은 속도에서 3회 연속 성공한 뒤 속도를 한 단계씩 높여 주세요`,
      `${nextFocus} 동작 전후의 균형을 확인하며 30초씩 3세트 연습해 주세요`,
    ];

    const sections = [
      { label: "오늘 수업", text: sentence(reviews[variant]) },
    ];
    if (positives.length) {
      sections.push({
        label: "잘된 점",
        text: sentence(`${positives.slice(0, 2).join(" · ")} 흐름을 유지하며 반복 기준을 만들었습니다`),
      });
    }
    if (challenges.length) {
      sections.push({
        label: "보완할 점",
        text: sentence(`${challenges.slice(0, 2).join(" · ")} 상황에서는 속도를 낮추고 준비 위치부터 다시 확인합니다`),
      });
    } else {
      sections.push({
        label: "확인한 점",
        text: sentence(`${displayKeywords.slice(0, 2).join(" · ")}을 같은 리듬으로 반복할 때 동작 기준을 더 쉽게 확인할 수 있습니다`),
      });
    }
    sections.push(
      { label: "다음 목표", text: sentence(nextGoals[variant]) },
      { label: "개인 연습", text: sentence(practices[variant]) },
    );

    return {
      ok: true,
      message: "",
      keywords,
      sections,
      variant,
      comment: sections.map((item) => `${item.label}: ${item.text}`).join("\n"),
    };
  }

  window.TennisNoteCommentDraft = Object.freeze({ keywordsFrom, generate });
})();
