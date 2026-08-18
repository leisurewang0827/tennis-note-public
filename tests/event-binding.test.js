import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const eventsDir = join(repoRoot, "app/admin/events");

// bindEvents() 2,386줄을 화면별 파일로 나눴다. 나누면서 등록 순서가 바뀌는데,
// 그게 안전한 이유는 두 가지다. 그 두 조건이 계속 성립하는지 검사한다.
//
// 1. 같은 (대상, 이벤트) 에 두 번 등록되는 건 document 뿐이고,
//    document 리스너들은 delegated.js 에 원래 순서 그대로 모여 있다.
// 2. stopImmediatePropagation 을 쓰지 않는다. 그걸 쓰면 같은 요소의
//    다른 리스너가 실행되지 않아, 등록 순서가 결과를 바꾼다.
//    (stopPropagation 은 상위로 올라가는 것만 막으므로 무관하다.)

/** 줄 주석을 걷어낸 소스. 주석에 적힌 단어를 코드로 오인하지 않기 위해서다. */
function eventFiles() {
  return readdirSync(eventsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => {
      const raw = readFileSync(join(eventsDir, name), "utf8");
      const source = raw.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
      return { name, source };
    });
}

test("stopImmediatePropagation 을 쓰지 않는다", () => {
  const users = eventFiles()
    .filter((file) => file.source.includes("stopImmediatePropagation"))
    .map((file) => file.name);
  assert.deepEqual(
    users,
    [],
    "쓰게 되면 등록 순서가 결과를 바꾼다. 화면별로 나눈 전제가 무너지므로,\n" +
      "그 리스너는 delegated.js 로 옮기고 원래 순서를 지켜야 한다.",
  );
});

test("document·window 리스너는 delegated.js 에만 둔다", () => {
  const strays = [];
  for (const file of eventFiles()) {
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

test("화면 파일끼리 같은 (대상, 이벤트) 를 중복 등록하지 않는다", () => {
  const seen = new Map();
  const clashes = [];
  for (const file of eventFiles()) {
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

test("bindEvents 는 화면별 함수를 부르기만 한다", () => {
  const app = readFileSync(join(repoRoot, "app/admin/app.js"), "utf8");
  const match = /^function bindEvents\(\) \{\n([\s\S]*?)\n\}/m.exec(app);
  assert.ok(match, "bindEvents 를 찾지 못했다");

  const lines = match[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
  const notACall = lines.filter((l) => !/^bind[A-Za-z]+Events\(\);$/.test(l));
  assert.deepEqual(
    notACall,
    [],
    "bindEvents 에 직접 등록 코드를 다시 넣지 마세요. 화면 파일에 넣으세요:\n  " + notACall.join("\n  "),
  );
  assert.ok(lines.length >= 5, "화면별 등록 함수 호출이 사라졌다");
});
