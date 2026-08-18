import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSharedScript } from "./helpers/load-browser-script.js";

// app/admin/domain/values.js 는 전역 함수 선언만 있는 평범한 스크립트다.
// 가짜 window 를 넘겨 실행해도 전역에는 안 붙으므로, 여기서는 파일을
// 함수 본문으로 감싸 실행한 뒤 이름을 꺼낸다.
const V = loadSharedScript("app/admin/domain/values.js");

// loadSharedScript 는 window 에 붙은 것만 돌려준다. 이 파일은 전역 선언이라
// 직접 평가해서 가져온다.
const { readFileSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const { dirname, join } = await import("node:path");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(repoRoot, "app/admin/domain/values.js"), "utf8");
const NAMES = [...source.matchAll(/^function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
const values = new Function(`${source}\nreturn { ${NAMES.join(", ")} };`)();

// ⚠ 이 테스트는 "지금 이렇게 동작한다"를 고정한 것이다.
// app.js 에서 본문 그대로 옮겨왔으므로, 여기가 깨지면 옮기다 뭔가 바뀐 것이다.

test("옮긴 함수가 전부 존재한다", () => {
  assert.equal(NAMES.length, 27, "함수 개수가 바뀌었다면 이 테스트도 같이 고쳐야 한다");
  for (const name of NAMES) {
    assert.equal(typeof values[name], "function", `${name} 이 함수가 아니다`);
  }
});

test("timeToMinutes / minutesToTime", () => {
  assert.equal(values.timeToMinutes("00:00"), 0);
  assert.equal(values.timeToMinutes("18:40"), 1120);
  assert.equal(values.timeToMinutes("23:59"), 1439);
  assert.equal(values.minutesToTime(0), "00:00");
  assert.equal(values.minutesToTime(1120), "18:40");
  assert.equal(values.minutesToTime(540), "09:00");
  // 왕복해도 같은 값
  for (const time of ["07:00", "12:30", "19:20"]) {
    assert.equal(values.minutesToTime(values.timeToMinutes(time)), time);
  }
});

test("numericValue — 숫자로 못 읽으면 기본값", () => {
  assert.equal(values.numericValue("42"), 42);
  assert.equal(values.numericValue(7), 7);
  assert.equal(values.numericValue("abc", 5), 5);
  assert.equal(values.numericValue(undefined, 9), 9);
  assert.equal(values.numericValue(Infinity, 1), 1, "무한대는 유한하지 않으므로 기본값");

  // ⚠ 현재 동작을 기록한 것이지 옳다는 뜻이 아니다.
  // Number(null) 과 Number("") 은 0 이고 0 은 유한하므로 기본값이 안 쓰인다.
  // "값 없음"과 "진짜 0"이 구분되지 않는다.
  // tickets 의 remaining 이 null 이면 "소진"으로 판정되는 것과 같은 뿌리다.
  assert.equal(values.numericValue(null, 3), 0, "null 은 기본값이 아니라 0 이 된다");
  assert.equal(values.numericValue("", 3), 0, "빈 문자열도 0 이 된다");
});

test("splitMemberNames — & 와 · 로 나누고 중복 제거", () => {
  assert.deepEqual(values.splitMemberNames("김서준"), ["김서준"]);
  assert.deepEqual(values.splitMemberNames("이하린&최유나"), ["이하린", "최유나"]);
  assert.deepEqual(values.splitMemberNames("이하린 · 최유나"), ["이하린", "최유나"]);
  assert.deepEqual(values.splitMemberNames("김서준&김서준"), ["김서준"], "중복은 하나로");
  assert.deepEqual(values.splitMemberNames(""), []);
  assert.deepEqual(values.splitMemberNames(), []);
  assert.deepEqual(values.splitMemberNames("이하린&"), ["이하린"], "빈 조각은 버린다");
  assert.deepEqual(values.splitMemberNames("이하린,최유나"), ["이하린,최유나"], "쉼표는 구분자가 아니다");
});

test("adminLocalDateKey — 브라우저 로컬 시간 기준 YYYY-MM-DD", () => {
  assert.match(values.adminLocalDateKey(), /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(2026, 7, 18, 13, 45);
  assert.equal(values.adminLocalDateKey(date), "2026-08-18");
  assert.equal(values.adminLocalDateKey(new Date(2026, 0, 5)), "2026-01-05", "한 자리 월·일은 0 을 채운다");
});

test("recordTimestamp / lessonEndTimestamp", () => {
  assert.equal(values.recordTimestamp(""), 0);
  assert.equal(values.recordTimestamp("이상한 값"), 0);
  assert.equal(values.recordTimestamp("2026-08-18T00:00:00Z"), Date.parse("2026-08-18T00:00:00Z"));

  assert.equal(values.lessonEndTimestamp(null), 0);
  assert.equal(values.lessonEndTimestamp({ lessonDate: "2026-08-18" }), 0, "시간이 없으면 0");
  const end = values.lessonEndTimestamp({ lessonDate: "2026-08-18", time: "18:40", durationMinutes: 30 });
  assert.equal(end, new Date("2026-08-18T18:40:00").getTime() + 30 * 60 * 1000);
  const fallback = values.lessonEndTimestamp({ lessonDate: "2026-08-18", time: "18:40" });
  assert.equal(fallback, new Date("2026-08-18T18:40:00").getTime() + 20 * 60 * 1000, "기본 20분");
});

test("cloneOperationProfileValue — 깊은 복사", () => {
  const source = { branch: { id: "b1", coaches: ["가", "나"] } };
  const copy = values.cloneOperationProfileValue(source);
  assert.deepEqual(copy, source);
  copy.branch.coaches.push("다");
  assert.deepEqual(source.branch.coaches, ["가", "나"], "원본이 바뀌면 안 된다");
});
