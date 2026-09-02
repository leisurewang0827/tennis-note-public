import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");
const context = { window: {} };
vm.runInNewContext(source("app/shared/tennisnote-comment-draft.js"), context);
const draft = context.window.TennisNoteCommentDraft;

test("키워드 순서와 명시 사실만 보존한 중립 초안을 만든다", () => {
  assert.equal(draft.generate("").code, "keyword_required");
  assert.equal(draft.generate("포핸드 타점").comment, "오늘 수업에서는 포핸드 타점을 중심으로 확인했습니다.");

  const observed = draft.generate("포핸드, 방향 좋아짐, 준비 늦음");
  assert.equal(observed.ok, true);
  assert.deepEqual(Array.from(observed.keywords), ["포핸드", "방향 좋아짐", "준비 늦음"]);
  assert.equal(observed.quality.inputFactsOnly, true);
  assert.equal(observed.quality.adjacentRepetition, false);
  assert.match(observed.comment, /포핸드/);
  assert.match(observed.comment, /방향 좋아짐/);
  assert.match(observed.comment, /준비 늦음/);
  assert.doesNotMatch(observed.comment, /\d|세트|반복|랠리|성공 기준|저속|낮은 속도/);

  const natural = draft.generate("포핸드 타점이 좋아졌습니다.");
  assert.equal(natural.comment, "포핸드 타점이 좋아졌습니다.");
  assert.doesNotMatch(natural.comment, /이라는 관찰/);

  const five = draft.generate("방향 좋아짐, 준비 늦음, 라켓면 열림, 스윙 짧음, 리듬 흔들림");
  assert.equal(five.ok, true);
  assert.equal(five.quality.adjacentRepetition, false);
  assert.ok(five.quality.sentenceCount <= 3);
  assert.deepEqual(Array.from(five.keywords), ["방향 좋아짐", "준비 늦음", "라켓면 열림", "스윙 짧음", "리듬 흔들림"]);
  five.keywords.forEach((keyword) => assert.match(five.comment, new RegExp(keyword)));
  assert.doesNotMatch(five.comment, /함께 살펴봤습니다/);

  for (const input of ["포핸드. 백핸드? 서브!", "포핸드; 백핸드\n서브!", "포핸드。백핸드？서브！"]) {
    const separated = draft.generate(input);
    assert.deepEqual(Array.from(separated.keywords), ["포핸드", "백핸드", "서브"], input);
    assert.match(separated.comment, /포핸드·백핸드·서브/, input);
  }

  const sameEnding = draft.generate("포핸드가 좋아졌습니다. 백핸드가 좋아졌습니다. 서브가 좋아졌습니다.");
  assert.equal(sameEnding.quality.adjacentRepetition, false);
  sameEnding.keywords.forEach((keyword) => assert.match(sameEnding.comment, new RegExp(keyword)));
  assert.equal(draft.hasAdjacentRepetition(["포핸드를 확인했습니다.", "백핸드를 확인했습니다."]), true);
  assert.equal(draft.hasAdjacentRepetition(["포핸드를 확인했어요.", "백핸드를 확인했습니다."]), true);
});

test("공백과 문장부호만 다른 중복을 제거하고 가혹 표현은 차단한다", () => {
  for (const value of ["", "   ", ".?!;", "。！？"]) {
    assert.equal(draft.generate(value).code, "keyword_required", value);
  }

  for (const value of ["최.악", "못!함", "엉;망", "형편。없음", "최\u200B악", "못！함", "엉；망"]) {
    const blocked = draft.generate(value);
    assert.equal(blocked.ok, false, value);
    assert.equal(blocked.code, "neutral_wording_required", value);
    assert.equal(blocked.comment, "", value);
  }

  const deduped = draft.generate("포핸드, 포핸드!,  포핸드。\n방향 좋아짐");
  assert.deepEqual(Array.from(deduped.keywords), ["포핸드", "방향 좋아짐"]);

  const harsh = draft.generate("포핸드, 최악");
  assert.equal(harsh.ok, false);
  assert.equal(harsh.code, "neutral_wording_required");
  assert.equal(harsh.comment, "");

  [
    "포핸드, 못 함",
    "포핸드, 최 악",
    "포핸드, 형편 없음",
    "포핸드, 엉 망",
    "포핸드, 못\t함",
    "포핸드, 최\n악",
    "포핸드, 형편.없음",
    "포핸드, 엉/망",
    "포핸드, 못\u200B함",
    "포핸드, 최\u200D악",
    "포핸드, 형편\u2060없음",
    "포핸드, 엉\uFEFF망",
  ].forEach((value) => {
    const blocked = draft.generate(value);
    assert.equal(blocked.ok, false, value);
    assert.equal(blocked.code, "neutral_wording_required", value);
    assert.equal(blocked.comment, "", value);
  });

  [
    "못 함께한 준비",
    "최적 악력",
    "형편이 없음",
    "엉킨 망 정리",
    "답답하게 느껴진 구간",
  ].forEach((value) => {
    const allowed = draft.generate(value);
    assert.equal(allowed.ok, true, value);
    assert.match(allowed.comment, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), value);
  });
});

test("코치 화면은 키워드 한 칸과 회원별 기존 예외만 유지하고 수동 문장을 보호한다", () => {
  const schedule = source("app/tennis-note-coach-app/views/schedule.js");
  const actions = source("app/tennis-note-coach-app/actions/records.js");
  const foundation = source("app/shared/tennisnote-ui-foundation.css");
  const coachStyles = source("app/tennis-note-coach-app/styles.css");

  assert.equal((schedule.match(/data-group-feedback-common-keywords=/g) || []).length, 1);
  assert.match(schedule, /data-group-feedback-exception=/);
  assert.match(schedule, /<summary>초안 도우미<\/summary>/);
  assert.doesNotMatch(schedule, /<summary>AI<\/summary>/);
  assert.match(actions, /window\.confirm\("작성 중인 내용을 새 초안으로 바꿀까요\?/);
  assert.match(actions, /작성 중인 내용을 유지했습니다/);
  assert.match(actions, /직접 확인하고 수정한 뒤 저장해 주세요/);
  assert.match(foundation, /\.tn-comment-draft-tools input[\s\S]*?min-height:\s*44px/);
  assert.match(foundation, /\.tn-comment-draft-tools button[\s\S]*?min-height:\s*44px/);
  assert.match(coachStyles, /\.lesson-ai-draft summary[\s\S]*?min-height:\s*44px/);
});
