(function () {
  const harshExpressionPattern = /^(?:최악|못함|형편없(?:음|다)?|엉망|바보|답답(?:함|하다)?|끔찍(?:함|하다)?)$/iu;
  const harshExpressionSuffixes = Object.freeze(["최악", "못함", "형편없음", "형편없다", "엉망", "바보", "답답함", "답답하다", "끔찍함", "끔찍하다"]);
  const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/gu;
  const observedPhrasePattern = /(?:좋아짐|나아짐|개선됨|안정됨|성공함|유지됨|연결됨|늦음|빨라짐|밀림|흔들림|부족함|약함|강함|짧음|길어짐|어려움|놓침|됨|함|임|었음|았음)$/;
  const completeObservationPattern = /(?:습니다|합니다|입니다|됐어요|되었어요|했어요|해요|이에요|예요)$/u;
  const minimumVisibleFeedbackLength = 20;

  function normalizedKeywordSource(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/[、/|;.!?。！？]+/g, ",")
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

  function feedbackVisibleText(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/<[^>]*>/gu, "")
      .replace(/[\p{Cf}\p{Cc}]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function feedbackVisibleLength(value) {
    const text = feedbackVisibleText(value);
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      return [...new Intl.Segmenter("ko-KR", { granularity: "grapheme" }).segment(text)].length;
    }
    return [...text].filter((character) => !/\p{M}/u.test(character)).length;
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

  function completeObservationSentence(value) {
    const text = String(value || "").trim();
    return completeObservationPattern.test(text) ? `${text}.` : "";
  }

  function topicSentence(values) {
    if (!values.length) return "";
    const topic = values.map((value) => String(value || "").trim()).filter(Boolean).join("·");
    return topic ? `오늘 수업에서는 ${topic}${objectParticle(topic)} 중심으로 확인했습니다.` : "";
  }

  function observationListSentence(values) {
    const facts = values.map((value) => String(value || "").trim()).filter(Boolean);
    return facts.length ? `관찰 내용: ${facts.join(" · ")}.` : "";
  }

  function draftSentences(keywords) {
    if (!keywords.length) return [];
    if (keywords.every((keyword) => !isObservedPhrase(keyword))) return [topicSentence(keywords)];
    if (keywords.length === 1) {
      const complete = completeObservationSentence(keywords[0]);
      return [complete || observationListSentence(keywords)];
    }
    return [observationListSentence(keywords)];
  }

  function minimumVisibleDraftSentences(keywords, sentences) {
    const current = fitWholeSentences(sentences);
    if (feedbackVisibleLength(current) >= minimumVisibleFeedbackLength) return sentences;
    if (keywords.length === 1 && completeObservationSentence(keywords[0])) {
      return [`오늘 수업 관찰 기록: ${completeObservationSentence(keywords[0])}`];
    }
    const facts = keywords.map((keyword) => String(keyword || "").trim()).filter(Boolean).join(" · ");
    return facts ? [`오늘 수업에서 확인한 관찰 내용: ${facts}.`] : [];
  }

  function sentenceSignature(value) {
    const text = String(value || "").trim();
    const start = canonicalKeyword(text.split(/\s+/)[0] || "");
    const words = text.replace(/[.!?。！？]+$/u, "").match(/[\p{L}\p{N}]+/gu) || [];
    const ending = canonicalKeyword(words.at(-1) || "");
    const verbMatch = (words.at(-1) || "").match(/^(.+?)(?:했습니다|했어요|합니다|해요|됐습니다|되었어요|됐어요|됩니다|었습니다|았습니다|어요|아요|습니다)$/u);
    const coreVerb = canonicalKeyword(verbMatch?.[1] || "");
    const nouns = [...text.matchAll(/[가-힣A-Za-z]{2,}/g)]
      .map((match) => canonicalKeyword(match[0]))
      .filter((token) => token && !["오늘수업에서는", "이라는", "관찰을", "추가로", "수업메모에", "부분을", "함께", "중심으로"].includes(token));
    return { start, ending, coreVerb, nouns: new Set(nouns) };
  }

  function hasAdjacentRepetition(sentences) {
    return sentences.some((sentence, index) => {
      if (!index) return false;
      const before = sentenceSignature(sentences[index - 1]);
      const current = sentenceSignature(sentence);
      if (before.start && before.start === current.start) return true;
      if (before.ending && before.ending === current.ending) return true;
      if (before.coreVerb && before.coreVerb === current.coreVerb) return true;
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

  const sectionDefinitions = Object.freeze([
    { key: "strength", label: "잘된 점", aliases: ["잘된 점", "잘된점"] },
    { key: "practice", label: "더 연습할 점", aliases: ["더 연습할 점", "더 연습해야 할 점", "연습할 점"] },
    { key: "personal", label: "개인 연습 중점", aliases: ["개인 연습", "개인 연습 중점", "개인연습"] },
  ]);

  function sectionFactsFrom(value) {
    const facts = Object.fromEntries(sectionDefinitions.map((section) => [section.key, ""]));
    const unassigned = [];
    const parts = String(value || "")
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .split(/[;\n]+/u)
      .map((part) => part.trim())
      .filter(Boolean);
    let explicitlySectioned = false;
    parts.forEach((part) => {
        const separator = part.indexOf(":");
        if (separator < 0) {
          unassigned.push(...keywordsFrom(part));
          return;
        }
        const heading = canonicalKeyword(part.slice(0, separator));
        const definition = sectionDefinitions.find((section) => section.aliases.some((alias) => canonicalKeyword(alias) === heading));
        if (!definition) {
          unassigned.push(...keywordsFrom(part));
          return;
        }
        explicitlySectioned = true;
        const fact = keywordsFrom(part.slice(separator + 1)).join(" · ");
        if (fact) facts[definition.key] = fact;
      });
    if (!explicitlySectioned) {
      const observed = unassigned.filter((fact) => isObservedPhrase(fact)
        && /(?:좋아짐|나아짐|개선됨|안정됨|성공함|좋아졌|나아졌|개선되|안정되|성공했)/u.test(fact));
      if (observed.length) facts.strength = observed.join(" · ");
    }
    const classified = new Set(Object.values(facts).flatMap((fact) => fact.split(" · ")).map(canonicalKeyword));
    return {
      facts,
      unassigned: unassigned.filter((fact) => !classified.has(canonicalKeyword(fact))),
    };
  }

  function sectionSentence(section, fact) {
    if (fact && section.key === "strength") return `수업에서 확인한 잘된 점: ${fact}.`;
    if (fact && section.key === "practice") return `더 연습하며 확인할 점: ${fact}.`;
    if (fact) return `개인 연습에서 중점적으로 확인할 내용: ${fact}.`;
    if (section.key === "strength") return "[입력 필요] 코치가 관찰한 잘된 점을 추가로 입력해 주세요.";
    if (section.key === "practice") return "[입력 필요] 코치가 관찰한 연습 필요 내용을 입력해 주세요.";
    return "[입력 필요] 코치가 확인한 개인 연습 중점을 입력해 주세요.";
  }

  function generateSectioned(value, context = {}) {
    if (hasHarshExpression(value)) {
      return {
        ok: false,
        code: "neutral_wording_required",
        message: "회원에게 공개하기 어려운 표현이 있습니다. 관찰한 동작을 중립적인 키워드로 바꿔 주세요.",
        keywords: keywordsFrom(value),
        sections: [],
        comment: "",
      };
    }
    const parsed = sectionFactsFrom(value);
    const facts = parsed.facts;
    const acceptedFacts = [...Object.values(facts).filter(Boolean), ...parsed.unassigned];
    if (!acceptedFacts.length) {
      return {
        ok: false,
        code: "keyword_required",
        message: "피드백에 반영할 키워드를 입력해 주세요.",
        keywords: keywordsFrom(value),
        sections: [],
        comment: "",
      };
    }
    const missing = sectionDefinitions.filter((section) => !facts[section.key]);
    const sections = sectionDefinitions.map((section) => ({
      label: section.label,
      text: sectionSentence(section, facts[section.key]),
    }));
    if (parsed.unassigned.length) {
      sections[0].text += ` 함께 입력한 미분류 키워드: ${parsed.unassigned.join("·")}.`;
    }
    if (sections.some((section) => feedbackVisibleLength(section.text) < minimumVisibleFeedbackLength)) {
      return {
        ok: false,
        code: "feedback_detail_required",
        message: "각 구획을 20자 이상의 자연스러운 피드백으로 만들 수 있도록 관찰 키워드를 조금 더 입력해 주세요.",
        keywords: Object.values(facts),
        sections: [],
        comment: "",
      };
    }
    const comment = sections.map((section) => `${section.label}\n${section.text}`).join("\n\n");
    const inputFactsOnly = acceptedFacts.every((fact) => comment.includes(fact));
    const complete = missing.length === 0;
    const adjacentRepetition = hasAdjacentRepetition(sections
      .filter((section) => !section.text.includes("[입력 필요]"))
      .map((section) => section.text));
    if (adjacentRepetition) {
      return { ok: false, code: "feedback_detail_required", message: "구획 사이에 같은 관찰이 반복됩니다. 키워드를 확인해 주세요.", keywords: acceptedFacts, sections: [], comment: "" };
    }
    const curriculum = curriculumContext(context.curriculum);
    return {
      ok: inputFactsOnly,
      complete,
      code: inputFactsOnly ? (complete ? "" : "feedback_sections_incomplete") : "feedback_detail_required",
      message: inputFactsOnly
        ? (complete ? "" : `${missing.map((section) => section.label).join(" · ")} 내용을 확인해 주세요.`)
        : "입력한 관찰 사실을 모두 보존할 수 없어 키워드를 다시 확인해 주세요.",
      keywords: acceptedFacts,
      sections,
      curriculumId: curriculum.id,
      comment,
      quality: Object.freeze({
        inputFactsOnly,
        complete,
        adjacentRepetition,
        sentenceCount: sections.length,
        visibleLength: feedbackVisibleLength(comment),
      }),
    };
  }

  function generate(value, context = {}) {
    const moderationBlocked = hasHarshExpression(value);
    const keywords = keywordsFrom(value);
    if (moderationBlocked) {
      return {
        ok: false,
        code: "neutral_wording_required",
        message: "회원에게 공개하기 어려운 표현이 있습니다. 관찰한 동작을 중립적인 키워드로 바꿔 주세요.",
        keywords,
        sections: [],
        comment: "",
      };
    }
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

    const sentences = minimumVisibleDraftSentences(keywords, draftSentences(keywords));
    const adjacentRepetition = hasAdjacentRepetition(sentences);
    if (adjacentRepetition) {
      return {
        ok: false,
        code: "draft_quality_retry_required",
        message: "같은 표현이 반복되지 않도록 키워드를 조금 나눠 다시 시도해 주세요.",
        keywords,
        sections: [],
        comment: "",
      };
    }
    const comment = fitWholeSentences(sentences);
    const visibleLength = feedbackVisibleLength(comment);
    const inputFactsOnly = keywords.every((keyword) => comment.includes(keyword));
    if (!inputFactsOnly || visibleLength < minimumVisibleFeedbackLength) {
      return {
        ok: false,
        code: "feedback_detail_required",
        message: "20자 이상의 자연스러운 피드백을 만들 수 있도록 관찰 키워드를 조금 더 입력해 주세요.",
        keywords,
        sections: [],
        comment: "",
      };
    }
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
        inputFactsOnly,
        adjacentRepetition,
        sentenceCount: sentences.length,
        visibleLength,
      }),
    };
  }

  window.TennisNoteCommentDraft = Object.freeze({
    keywordsFrom,
    generate,
    generateSectioned,
    feedbackVisibleLength,
    feedbackVisibleText,
    hasAdjacentRepetition,
  });
})();
