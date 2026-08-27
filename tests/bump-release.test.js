import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 버전은 9개 파일 100곳 넘게 박혀 있고, 한 곳만 빠뜨리면 그 파일만 옛 캐시에
// 남아 사용자가 옛 화면을 본다. scripts/bump_release.py 가 전부 한 번에 바꾸는데,
// 새 버전 자리가 생겼을 때 스크립트가 그것을 모르면 다시 손으로 맞추게 된다.
//
// 그래서 --dry-run 을 여기서 돌린다. 스크립트가 모르는 자리가 하나라도 생기면
// 스크립트 스스로 "옛 버전이 남습니다" 로 멈추고, 이 테스트가 같이 실패한다.

/** bump 스크립트를 --dry-run 으로 돌린다. 파일은 바뀌지 않는다. */
function dryRun() {
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  return execFileSync(python, ["scripts/bump_release.py", "--next", "--dry-run"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
}

test("bump 스크립트가 아는 자리만으로 버전을 전부 바꿀 수 있다", () => {
  // 실패하면 execFileSync 가 던지면서 스크립트의 안내문이 그대로 보인다.
  const output = dryRun();
  assert.match(output, /--dry-run 이라 파일을 바꾸지 않았습니다/);
});

test("bump 스크립트가 release.json 의 현재 버전에서 출발한다", () => {
  const release = JSON.parse(readFileSync(join(repoRoot, "app/release.json"), "utf8"));
  assert.match(dryRun(), new RegExp(`^${release.version.replace(/\./g, "\\.")} → `, "m"));
});

test("bump 스크립트가 서비스워커 캐시 이름도 함께 올린다", () => {
  // 캐시 이름이 그대로면 브라우저가 옛 캐시를 계속 쓴다. 버전 문자열과 별개의
  // 카운터라 배포본 검사가 잡지 못하므로, 여기서 빠지지 않았는지 본다.
  const output = dryRun();
  assert.match(output, /캐시 이름 {2}tennis-note-member-pwa-v\d+ → tennis-note-member-pwa-v\d+/);
  assert.match(output, /캐시 이름 {2}tennis-note-coach-mode-v\d+ → tennis-note-coach-mode-v\d+/);
});
