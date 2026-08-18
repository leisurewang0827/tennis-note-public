import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * app/shared/ 의 브라우저 스크립트를 있는 그대로 불러온다.
 *
 * 이 파일들은 IIFE 안에서 window.TennisNoteXxx 에 붙는 방식이라
 * Node 가 그냥 import 할 수 없다. 가짜 window 를 넘겨 실행한 뒤
 * 거기 붙은 것을 돌려준다.
 *
 * 원본을 고치지 않고 배포되는 파일 그대로를 검사하는 게 목적이다.
 * 나중에 이 파일들이 ES 모듈이 되면 이 헬퍼는 필요 없어지고
 * 테스트는 평범한 import 로 바뀐다.
 */
export function loadSharedScript(relativePath) {
  const source = readFileSync(join(repoRoot, relativePath), "utf8");
  const fakeWindow = {};
  // IIFE 안의 `window` 식별자를 인자로 가린다.
  new Function("window", source)(fakeWindow);
  return fakeWindow;
}
