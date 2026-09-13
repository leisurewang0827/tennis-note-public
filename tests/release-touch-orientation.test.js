import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 비공개 PR470의 NFR-04 최소 변경만 이식한다. 전체 CSS 덮어쓰기 금지.
test("피드백 상태 탭의 최소 터치 높이는 44px", () => {
  const css = readFileSync(new URL("../app/tennis-note-coach-app/styles.css", import.meta.url), "utf8");
  const block = css.match(/\.record-status-tabs button\s*\{([^}]+)\}/)?.[1];
  assert.ok(block);
  assert.match(block, /min-height:\s*44px;/);
});

test("공용 PWA는 사용자 기기 방향을 세로로 강제하지 않음", () => {
  const manifest = JSON.parse(readFileSync(new URL("../app/tennis-note-member-app/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.orientation, "any");
  assert.equal(manifest.display, "standalone");
});
