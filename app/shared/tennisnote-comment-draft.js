(function () {
  const harshExpressionPattern = /^(?:최악|못함|형편없(?:음|다)?|엉망|바보|답답(?:함|하다)?|끔찍(?:함|하다)?)$/iu;
  const harshExpressionSuffixes = Object.freeze(["최악", "못함", "형편없음", "형편없다", "엉망", "바보", "답답함", "답답하다", "끔찍함", "끔찍하다"]);
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/gu;
  const observedPhrasePattern = /(?:좋아짐|나아짐|개선됨|안정됨|성공함|유지됨|연결됨|늦음|빨라짐|밀림|흔들림|부족함|약함|강함|짧음|길어짐|어려움|놓침|됨|함|임|었음|았음)$/;
  const sentenceEndings = ["확인했습니다", "기록했습니다", "남겼습니다", "살펴봤습니다"];

  function normalizedKeywordSource(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/[、/|;]+/g, ",")
      .replace(/\r\n?/g, "\n");
  }

  function harshScanForm(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(zeroWidthPattern, "")
      .match(/[\p{L}\p{N}]+/gu) || [];
  }

  function hasHarshExpression(value) {
    const tokens = harshScanForm(value);
    return tokens.some((token, start) => {
      let candidate = "";
      for (let end = start; end < Math.min(tokens.length, start + 4); end += 1) {
        candidate += tokens[end];
        if (harshExpressionPattern.test(candidate)) return true;
      }
      return harshExpressionSuffixes.some((phrase) => token.length > phrase.length && token.endsWith(phrase));
    });
  }

  function canonicalKeyword(value) {
    return String(value || "")
      .normalize("NFC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  function cleanKeyword(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/^[\s•·\-–—]+|[\s.!?。！？,;:•·\-–—]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function keywordsFrom(value) {
    const seen = new Set();
    const selected = [];
    normalizedKeywordSource(value)
      .split(/[,\n]+/)
      .map(cleanKeyword)
      .some((item) => {
        const canonical = canonicalKeyword(item);
        if (!item || item.length < 2 || !canonical || seen.has(canonical)) return false;
        seen.add(canonical);
        selected.push(item);
        return selected.length >= 5;
      });
    return selected;
  }

  function curriculumContext(value = {}) {
    const curriculum = value && typeof value === "object" ? value : {};
    return { id: String(curriculum.id || "").trim() };
  }

  function hasKoreanFinalConsonant(value) {
    const text = String(value || "").trim();
    const code = text.charCodeAt(text.length - 1);
    return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  }

  function objectParticle(value) {
    return hasKoreanFinalConsonant(value) ? "을" : "를";
  }

  function isObservedPhrase(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    return observedPhrasePattern.test(text) || /\s/.test(text) && /(?:좋|나아|개선|안정|성공|유지|연결|늦|빠르|밀리|흔들|부족|약하|강하|짧|길|어려|놓치)/.test(text);
  }

  function quoted(value) {
    return `‘${String(value || "").replace(/[‘’]/g, "").trim()}’`;
  }

  function topicSentence(values) {
    if (!values.length) return "";
    const topic = values.map((value) => String(value || "").trim()).filter(Boolean).join("·");
    return topic ? `오늘 수업에서는 ${topic}${objectParticle(topic)} 중심으로 확인했습니다.` : "";
  }

  function observedSentence(value, index) {
    const fact = quoted(value);
    if (index === 0) return `${fact}이라는 관찰을 기록했습니다.`;
    if (index === 1) return `추가로 ${fact}도 수업 메모에 남겼습니다.`;
    return `${fact} 부분을 함께 살펴봤습니다.`;
  }

  function sentenceSignature(value) {
    const text = String(value || "").trim();
    const start = canonicalKeyword(text.split(/\s+/)[0] || "");
    const ending = sentenceEndings.find((item) => text.endsWith(`${item}.`)) || "";
    const nouns = [...text.matchAll(/[가-힣A-Za-z]{2,}/g)]
      .map((match) => canonicalKeyword(match[0]))
      .filter((token) => token && !["오늘수업에서는", "이라는", "관찰을", "추가로", "수업메모에", "부분을", "함께", "중심으로"].includes(token));
    return { start, ending, nouns: new Set(nouns) };
  }

  function hasAdjacentRepetition(sentences) {
    return sentences.some((sentence, index) => {
      if (!index) return false;
      const before = sentenceSignature(sentences[index - 1]);
      const current = sentenceSignature(sentence);
      if (before.start && before.start === current.start) return true;
      if (before.ending && before.ending === current.ending) return true;
      const shared = [...current.nouns].filter((token) => before.nouns.has(token));
      return shared.length >= 2;
    });
  }

  function fitWholeSentences(sentences, maximum = 500) {
    const selected = [];
    sentences.filter(Boolean).some((sentence) => {
      const candidate = [...selected, sentence].join(" ");
      if (candidate.length > maximum) return true;
      selected.push(sentence);
      return false;
    });
    return selected.join(" ");
  }

  function generate(value, context = {}) {
    const keywords = keywordsFrom(value);
    if (!keywords.length) {
      return {
        ok: false,
        code: "keyword_required",
        message: "수업 키워드를 하나 이상 입력해 주세요.",
        keywords: [],
        sections: [],
        comment: "",
      };
    }
    if (hasHarshExpression(value)) {
      return {
        ok: false,
        code: "neutral_wording_required",
        message: "회원에게 공개하기 어려운 표현이 있습니다. 관찰한 동작을 중립적인 키워드로 바꿔 주세요.",
        keywords,
        sections: [],
        comment: "",
      };
    }

    const nounOnly = keywords.filter((keyword) => !isObservedPhrase(keyword));
    const observed = keywords.filter(isObservedPhrase);
    const sentences = [];
    if (nounOnly.length) sentences.push(topicSentence(nounOnly));
    observed.forEach((keyword, index) => sentences.push(observedSentence(keyword, index)));
    const comment = fitWholeSentences(sentences);
    const curriculum = curriculumContext(context.curriculum);

    return {
      ok: true,
      code: "",
      message: "",
      keywords,
      sections: [{ label: "오늘 수업", text: comment }],
      curriculumId: curriculum.id,
      comment,
      quality: Object.freeze({
        inputFactsOnly: keywords.every((keyword) => comment.includes(keyword)),
        adjacentRepetition: hasAdjacentRepetition(sentences),
        sentenceCount: sentences.length,
      }),
    };
  }

  window.TennisNoteCommentDraft = Object.freeze({
    keywordsFrom,
    generate,
    hasAdjacentRepetition,
  });
})();
