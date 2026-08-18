import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, posix } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 이 앱들은 <script> 태그로 하나의 전역 공간에 코드를 쏟아붓는다.
// 같은 이름이 두 번 선언되면 에러가 나지 않고 나중에 로드된 쪽이 조용히 이긴다.
//
// app.js 를 화면·주제별 파일로 쪼개는 중이라 이 사고가 나기 쉽다.
// 옮기고 원본을 안 지우면 옛 코드가 계속 쓰이는데 아무도 모른다.

const PAGES = [
  { label: "관리자", html: "app/admin/index.html" },
  { label: "회원앱", html: "app/tennis-note-member-app/index.html" },
  { label: "코치앱", html: "app/tennis-note-coach-app/index.html" },
];

/** index.html 이 부르는 같은 사이트 스크립트를 로드 순서대로 돌려준다. */
function pageScripts(htmlPath) {
  const html = readFileSync(join(repoRoot, htmlPath), "utf8");
  const baseDir = posix.dirname(htmlPath);
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((src) => !/^https?:|^\/\//.test(src))
    .map((src) => posix.normalize(posix.join(baseDir, src.split("?")[0])));
}

/**
 * 최상위(들여쓰기 없음)에 선언된 이름만 모은다.
 * app/shared/ 의 파일들은 IIFE 로 감싸 안쪽이 들여쓰기돼 있으므로 잡히지 않는다.
 */
function topLevelNames(scriptPath) {
  let source;
  try {
    source = readFileSync(join(repoRoot, scriptPath), "utf8");
  } catch {
    return null; // config.local.js 처럼 빌드 때 생성되는 파일
  }
  const names = [];
  for (const line of source.split("\n")) {
    const fn = /^(?:async )?function ([A-Za-z0-9_$]+)/.exec(line);
    if (fn) { names.push(fn[1]); continue; }
    const decl = /^(?:const|let|var) ([A-Za-z0-9_$]+)\s*=/.exec(line);
    if (decl) names.push(decl[1]);
  }
  return names;
}

for (const page of PAGES) {
  test(`${page.label} — 전역 이름이 겹치지 않는다`, () => {
    const owners = new Map();
    const collisions = [];

    for (const scriptPath of pageScripts(page.html)) {
      const names = topLevelNames(scriptPath);
      if (names === null) continue;

      const seenHere = new Set();
      for (const name of names) {
        if (seenHere.has(name)) {
          collisions.push(`${name} — ${scriptPath} 안에서 두 번 선언됨`);
          continue;
        }
        seenHere.add(name);

        const previous = owners.get(name);
        if (previous && previous !== scriptPath) {
          collisions.push(`${name} — ${previous} 와 ${scriptPath} 양쪽에 선언됨 (뒤엣것이 이김)`);
        } else {
          owners.set(name, scriptPath);
        }
      }
    }

    assert.deepEqual(collisions, [], `전역 이름 충돌:\n  ${collisions.join("\n  ")}`);
  });
}

test("각 화면이 스크립트를 실제로 읽어들이고 있다", () => {
  for (const page of PAGES) {
    const scripts = pageScripts(page.html);
    assert.ok(scripts.length > 0, `${page.label}: 스크립트를 하나도 못 찾았다 — 검사가 무의미해진다`);
  }
});
