import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 폴더 이름이 곧 "무엇을 하는 코드인가" 라는 것이 이 구조의 전부다.
// 이름이 실제와 다르면 이어받는 사람이 엉뚱한 파일을 연다.
//
// 실제로 그렇게 됐다. 환불 모달 함수들은 나눌 때는 정말 여닫기만 했는데,
// origin/main 이 거기에 서버 호출을 넣으면서 ui/ 라는 이름이 거짓이 됐다.
// 우리가 잘못 분류한 게 아니라 나중에 어긋난 것이라, 한 번 검사해서 될 일이
// 아니라 매번 봐야 한다.
//
// 여기서는 가장 확실한 둘만 막는다.
//   domain/ 은 값을 받아 판정해 돌려주는 곳이다. 서버를 부르면 안 된다.
//   views/  는 화면을 그리는 곳이다. 그리는 김에 불러오면 안 된다.
//
// ui/ 와 forms/ 에도 서버 호출이 남아 있다(관리자 6곳). 저쪽이 만든 환불
// 흐름이라 옮기려면 손이 커서 지금은 두었고 docs/unfinished.md 에 적었다.

/** 네트워크를 타지 않는 것들. 화면이 "지금 접속돼 있나" 를 보는 데 쓴다. */
const LOCAL_ONLY = new Set([
  "readiness", "isOnline", "getSession", "isOfflineError", "isTransientConnectionError",
  "storageKey", "authStorageKey", "authPersistenceKey", "sessionPersistence", "providerSlug",
]);

const APPS = ["app/admin", "app/tennis-note-member-app", "app/tennis-note-coach-app"];
const PURE = ["domain", "views"];

/** 문자열과 주석을 지워서 그 안의 글자를 코드로 오인하지 않게 한다. */
function stripQuotes(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "\"" || c === "'" || c === "`") {
      const quote = c;
      out += " ";
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\") { out += "  "; i += 2; continue; }
        if (text[i] === quote) break;
        out += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += " ";
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") { out += " "; i += 1; }
      out += "\n";
      continue;
    }
    out += c;
  }
  return out;
}

function serverCalls(source) {
  const clean = stripQuotes(source).split("\n");
  const hits = [];
  clean.forEach((line, index) => {
    // DataClient 의 메서드 호출. 뒤에 여는 괄호가 있어야 호출이다.
    // `Boolean(client?.rpc)` 처럼 있는지만 보는 것은 호출이 아니다.
    for (const m of line.matchAll(/TennisNoteDataClient\??\.\??([A-Za-z0-9_]+)\s*\(/g)) {
      if (!LOCAL_ONLY.has(m[1])) hits.push({ line: index + 1, what: `DataClient.${m[1]}()` });
    }
    // 앱 안에서 client 로 받아 쓰는 경우도 있다.
    for (const m of line.matchAll(/\bclient\??\.\??(rpc|invokeFunction|selectRows|selectAllRows|countRows|insertRows|updateRows|deleteRows|uploadObject|downloadObject|deleteObject)\s*\(/g)) {
      hits.push({ line: index + 1, what: `client.${m[1]}()` });
    }
    for (const _ of line.matchAll(/(?<![\w.$])fetch\s*\(/g)) {
      hits.push({ line: index + 1, what: "fetch()" });
    }
  });
  return hits;
}

for (const app of APPS) {
  for (const layer of PURE) {
    const dir = join(repoRoot, app, layer);
    if (!existsSync(dir)) continue;
    test(`${app}/${layer} — 서버를 부르지 않는다`, () => {
      const bad = [];
      for (const name of readdirSync(dir).sort()) {
        if (!name.endsWith(".js")) continue;
        const source = readFileSync(join(dir, name), "utf8");
        for (const hit of serverCalls(source)) {
          bad.push(`${layer}/${name}:${hit.line}  ${hit.what}`);
        }
      }
      assert.deepEqual(
        bad,
        [],
        `${app}/${layer}/ 에서 서버를 부릅니다:\n  ${bad.join("\n  ")}\n\n`
          + `  서버에 붙는 함수는 data/ 로 보내세요. 함수 이름이 전역이라\n`
          + `  본문을 그대로 옮기면 호출부는 안 고쳐도 됩니다.\n`
          + `  판단 기준은 docs/structure.md 를 보세요.\n`,
      );
    });
  }
}
