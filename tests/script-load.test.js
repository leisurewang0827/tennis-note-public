import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, posix } from "node:path";
import { loadScripts } from "./helpers/browser-stub.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// index.html 이 부르는 스크립트를 그 순서대로 실제로 실행해 본다.
//
// 잡는 것: <script> 가 실행되는 순간 터지는 오류.
//   - 함수 밖 최상위 코드가 없는 이름을 참조 (실제로 났던 사고)
//   - 스크립트 순서가 틀려 아직 정의 안 된 함수를 호출
//
// 못 잡는 것: 함수 안에서만 일어나는 일. 그건 화면을 눌러봐야 안다.
// 이 검사는 브라우저 확인을 대신하지 못하고, 가장 흔한 실수만 걸러낸다.

// 각 앱이 직접 소유한 스크립트만 넣는다.
// app/shared/ 의 공용 모듈은 타이머·감시자를 걸어서 이 얕은 스텁으로는
// 끝까지 실행되지 않는다(무한 대기). 그쪽은 우리가 리팩터링하는 대상도
// 아니므로 범위 밖에 둔다. tennisnote-release.js 만 예외로 넣는데,
// app.js 최상위에서 버전을 읽기 때문이다.
const PAGES = [
  {
    label: "관리자",
    pathname: "/app/admin/",
    scripts: [
      "app/shared/tennisnote-release.js",
      "app/admin/domain/values.js",
      "app/admin/domain/lessons.js",
      "app/admin/domain/billing.js",
      "app/admin/domain/tickets.js",
      "app/admin/app.js",
      "app/admin/schedule-v2-admin.js",
    ],
  },
  {
    label: "회원앱",
    pathname: "/app/tennis-note-member-app/",
    scripts: ["app/shared/tennisnote-release.js", "app/tennis-note-member-app/app.js"],
  },
  {
    label: "코치앱",
    pathname: "/app/tennis-note-coach-app/",
    scripts: ["app/shared/tennisnote-release.js", "app/tennis-note-coach-app/app.js"],
  },
];

for (const page of PAGES) {
  test(`${page.label} — 스크립트가 로드 시점에 터지지 않는다`, () => {
    const sources = [];
    for (const scriptPath of page.scripts) {
      try {
        sources.push(readFileSync(join(repoRoot, scriptPath), "utf8"));
      } catch {
        // config.local.js 는 배포 때 생성된다. 없는 게 정상.
      }
    }
    assert.ok(sources.length > 0, `${page.label}: 읽어들인 스크립트가 없다`);
    loadScripts(sources, { pathname: page.pathname });
  });
}
