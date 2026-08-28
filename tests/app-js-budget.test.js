import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// app.js 는 `state` 와 부팅 코드만 남기기로 하고 수십 개 파일로 나눴다.
// 그런데 origin/main 을 병합할 때마다 저쪽이 새로 만든 함수가 app.js 로 들어오고,
// 아무도 폴더로 다시 옮기지 않아서 계속 커진다. 실측:
//
//   병합                관리자   회원앱   코치앱
//   1.0.373 → 374        1,077     447     206   ← 분리 직후
//   1.0.375              1,077     682     206
//   1.0.382              1,115     972     240
//   1.0.396              1,326   1,097     619   ← 코치앱이 한 번에 2.6배
//
// 이 속도면 병합 열 번이면 원점이다. 문서에 "app.js 를 다시 키우지 마세요" 라고
// 적어뒀지만 지켜지는지 아무도 몰랐다. 그래서 지금 수를 상한으로 박는다.
//
// 이건 "지금이 옳다" 가 아니라 "여기서 더 늘리지 마라" 는 뜻이다.
// 아래 BUDGET 은 줄이는 방향으로만 고치세요.

/** app.js 에 남아도 되는 것: 부팅과 리스너 등록 묶음. */
const ALLOWED = new Set(["bindEvents", "initApp", "initCoachApp"]);

const BUDGET = [
  { app: "app/admin", label: "관리자", budget: 20 },
  { app: "app/tennis-note-member-app", label: "회원앱", budget: 48 },
  { app: "app/tennis-note-coach-app", label: "코치앱", budget: 21 },
];

/** 최상위 `function` 선언만 센다. 함수 끝은 열 0 의 `}` 로 찾는다. */
function topLevelFunctions(source) {
  const lines = source.split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/.exec(lines[i]);
    if (!match) continue;
    let end = i + 1;
    while (end < lines.length && lines[end] !== "}") end += 1;
    found.push({ name: match[1], lines: end - i + 1 });
    i = end;
  }
  return found;
}

for (const { app, label, budget } of BUDGET) {
  test(`${label} — app.js 에 폴더로 갔어야 할 함수가 늘지 않는다`, () => {
    const source = readFileSync(join(repoRoot, app, "app.js"), "utf8").replace(/\r\n?/g, "\n");
    const stray = topLevelFunctions(source).filter((fn) => !ALLOWED.has(fn.name));

    if (stray.length > budget) {
      const added = stray
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 10)
        .map((fn) => `    ${String(fn.lines).padStart(4)}줄  ${fn.name}`)
        .join("\n");
      assert.fail(
        `${app}/app.js 의 함수가 ${budget}개에서 ${stray.length}개로 늘었습니다.\n\n`
          + `  새로 만든 함수는 app.js 가 아니라 동작에 맞는 폴더로 보내세요.\n`
          + `  어디로 보낼지는 docs/structure.md 를 보세요.\n`
          + `  병합 직후라면 저쪽이 넣은 함수가 그대로 남은 것입니다.\n\n`
          + `  지금 app.js 에 있는 것 (큰 것부터):\n${added}\n`,
      );
    }

    // 줄어들면 상한도 같이 내린다. 안 내리면 다음에 도로 늘어나도 안 잡힌다.
    assert.equal(
      stray.length,
      budget,
      `${app}/app.js 의 함수가 ${budget}개에서 ${stray.length}개로 줄었습니다. `
        + `tests/app-js-budget.test.js 의 budget 을 ${stray.length} 로 낮추세요.`,
    );
  });
}
