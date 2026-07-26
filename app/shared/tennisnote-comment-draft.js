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

  function generate(value) {
    const keywords = keywordsFrom(value);
    if (!keywords.length) {
      return {
        ok: false,
        message: "수업 키워드를 하나 이상 입력해 주세요.",
        keywords: [],
        comment: "",
      };
    }

    const [primary, ...secondary] = keywords;
    const review = secondary.length
      ? `${primary} 중심으로 연습했고, ${secondary.join("·")} 부분을 함께 점검했습니다.`
      : `${primary} 중심으로 동작을 점검했습니다.`;
    const nextFocus = secondary.at(-1) || primary;
    return {
      ok: true,
      message: "",
      keywords,
      comment: `${review} 다음 수업에서는 ${nextFocus} 동작을 반복해 안정성을 높이겠습니다.`,
    };
  }

  window.TennisNoteCommentDraft = Object.freeze({ keywordsFrom, generate });
})();
