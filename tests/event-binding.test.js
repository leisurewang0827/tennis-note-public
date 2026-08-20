import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// bindEvents() 를 화면별 파일로 나눴다. 나누면서 등록 순서가 바뀌는데,
// 그게 안전한 이유는 두 가지다. 그 두 조건이 계속 성립하는지 검사한다.
//
// 1. 같은 (대상, 이벤트) 에 두 번 등록되는 건 document 뿐이고,
//    document 리스너들은 delegated.js 에 원래 순서 그대로 모여 있다.
// 2. stopImmediatePropagation 을 쓰지 않는다. 그걸 쓰면 같은 요소의
//    다른 리스너가 실행되지 않아, 등록 순서가 결과를 바꾼다.
//    (stopPropagation 은 상위로 올라가는 것만 막으므로 무관하다.)
//
// 세 앱이 같은 구조라 같은 검사를 돌린다. 새 앱을 나누면
// 여기에 한 줄 추가하세요. 빠뜨리면 그 앱만 검사 밖에 남는다.
const APPS = [
  { label: "관리자", events: "app/admin/events", app: "app/admin/app.js" },
  { label: "회원앱", events: "app/tennis-note-member-app/events", app: "app/tennis-note-member-app/app.js" },
  { label: "코치앱", events: "app/tennis-note-coach-app/events", app: "app/tennis-note-coach-app/app.js" },
];

/** 줄 주석을 걷어낸 소스. 주석에 적힌 단어를 코드로 오인하지 않기 위해서다. */
function eventFiles(eventsDir) {
  const dir = join(repoRoot, eventsDir);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => {
      const raw = readFileSync(join(dir, name), "utf8");
      const source = raw.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
      return { name, source };
    });
}

for (const { label, events, app } of APPS) {
  test(`${label} — stopImmediatePropagation 을 쓰지 않는다`, () => {
    const users = eventFiles(events)
      .filter((file) => file.source.includes("stopImmediatePropagation"))
      .map((file) => file.name);
    assert.deepEqual(
      users,
      [],
      "쓰게 되면 등록 순서가 결과를 바꾼다. 화면별로 나눈 전제가 무너지므로,\n" +
        "그 리스너는 delegated.js 로 옮기고 원래 순서를 지켜야 한다.",
    );
  });

  test(`${label} — document·window 리스너는 delegated.js 에만 둔다`, () => {
    const strays = [];
    for (const file of eventFiles(events)) {
      if (file.name === "delegated.js") continue;
      for (const match of file.source.matchAll(/^\s{2}(document|window)\b.*$/gm)) {
        strays.push(`${file.name}: ${match[0].trim().slice(0, 60)}`);
      }
    }
    assert.deepEqual(
      strays,
      [],
      "문서 전역 리스너는 서로 순서가 얽힐 수 있어 한 파일에 모아 둔다:\n  " + strays.join("\n  "),
    );
  });

  test(`${label} — 화면 파일끼리 같은 (대상, 이벤트) 를 중복 등록하지 않는다`, () => {
    const seen = new Map();
    const clashes = [];
    for (const file of eventFiles(events)) {
      if (file.name === "delegated.js") continue;
      for (const match of file.source.matchAll(/\$\$?\(\s*"([^"]+)"\s*\)\s*\??\.addEventListener\(\s*"([a-z]+)"/g)) {
        const key = `${match[1]} / ${match[2]}`;
        const previous = seen.get(key);
        if (previous && previous !== file.name) clashes.push(`${key} — ${previous} 와 ${file.name}`);
        else seen.set(key, file.name);
      }
    }
    assert.deepEqual(
      clashes,
      [],
      "같은 요소의 같은 이벤트에 두 곳에서 등록하면 순서가 의미를 갖는다:\n  " + clashes.join("\n  "),
    );
  });

  test(`${label} — bindEvents 는 화면별 함수를 부르기만 한다`, () => {
    const source = readFileSync(join(repoRoot, app), "utf8");
    const match = /^function bindEvents\(\) \{\n([\s\S]*?)\n\}/m.exec(source);
    assert.ok(match, "bindEvents 를 찾지 못했다");

    const lines = match[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
    const notACall = lines.filter((l) => !/^bind[A-Za-z]+Events\(\);$/.test(l));
    assert.deepEqual(
      notACall,
      [],
      "bindEvents 에 직접 등록 코드를 다시 넣지 마세요. 화면 파일에 넣으세요:\n  " + notACall.join("\n  "),
    );

    // 화면 파일이 만든 등록 함수와 bindEvents 가 부르는 목록이 정확히 같아야 한다.
    // 예전에는 "5개 이상" 이었는데, 그건 앱마다 파일 수가 달라 의미가 없었고
    // 파일을 하나 추가하고 호출을 빠뜨려도 통과했다.
    const called = new Set(lines.map((l) => l.replace("();", "")));
    const defined = new Set();
    for (const file of eventFiles(events)) {
      for (const m of file.source.matchAll(/^function (bind[A-Za-z]+Events)\(\)/gm)) defined.add(m[1]);
    }
    assert.deepEqual(
      [...defined].filter((name) => !called.has(name)),
      [],
      "화면 파일에 등록 함수를 만들고 bindEvents 에서 부르지 않았습니다. 그 화면은 아무 반응도 하지 않습니다.",
    );
    assert.deepEqual(
      [...called].filter((name) => !defined.has(name)),
      [],
      "bindEvents 가 어느 화면 파일에도 없는 함수를 부릅니다.",
    );
  });
}
