import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("사용자 입력 HTML 이스케이프 구현은 공용 정본 한 곳에만 둔다", () => {
  assert.match(source("app/shared/tennisnote-escape-html.js"), /function escapeHtml\(value = ""\)/);
  [
    "app/admin/schedule-v2-admin.js",
    "app/shared/tennisnote-ui-language.js",
    "app/shared/tennisnote-issue-reporter.js",
  ].forEach((path) => {
    const text = source(path);
    assert.doesNotMatch(text, /function escapeHtml\(/, `${path}에 사본이 남아 있습니다.`);
    assert.match(text, /window\.escapeHtml/);
  });
});

test("세 화면은 이스케이프 정본을 의존 스크립트보다 먼저 읽는다", () => {
  [
    "app/admin/index.html",
    "app/tennis-note-member-app/index.html",
    "app/tennis-note-coach-app/index.html",
  ].forEach((path) => {
    const html = source(path);
    const canonical = html.indexOf("tennisnote-escape-html.js");
    assert.ok(canonical >= 0, `${path}에 정본 스크립트가 없습니다.`);
    ["tennisnote-ui-language.js", "tennisnote-issue-reporter.js"].forEach((dependency) => {
      assert.ok(html.indexOf(dependency) > canonical, `${path}의 ${dependency} 로드 순서가 잘못됐습니다.`);
    });
    if (path === "app/admin/index.html") {
      assert.ok(html.indexOf("schedule-v2-admin.js") > canonical, "관리자 시간표가 정본보다 먼저 로드됩니다.");
    }
  });
});
