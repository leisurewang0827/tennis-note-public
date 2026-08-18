import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * app/admin/domain/ 의 파일들을 브라우저처럼 한 전역 공간에서 평가하고,
 * 최상위로 선언된 함수를 이름으로 꺼내 돌려준다.
 *
 * 이 파일들은 IIFE 로 감싸지 않은 평범한 스크립트다. 브라우저에서는
 * <script> 로 로드되어 전역 함수가 되고, app.js 가 그 이름을 그대로 부른다.
 * 테스트도 같은 방식으로 평가해야 실제로 배포되는 코드를 검사하는 게 된다.
 *
 * 여러 파일을 넘기면 index.html 의 로드 순서대로 이어붙인다.
 * 서로를 호출하는 함수들이 있으므로 순서가 중요하다.
 */
export function loadAdminDomain(...relativePaths) {
  const sources = relativePaths.map((path) => readFileSync(join(repoRoot, path), "utf8"));
  const combined = sources.join("\n\n");
  const names = [...combined.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const unique = [...new Set(names)];
  return new Function(`${combined}\nreturn { ${unique.join(", ")} };`)();
}
