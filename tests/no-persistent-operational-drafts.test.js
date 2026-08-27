import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("코치 수업 기록은 임시 저장 버튼과 서버 초안 RPC를 제공하지 않는다", () => {
  const html = source("app/tennis-note-coach-app/index.html");
  const schedule = source("app/tennis-note-coach-app/views/schedule.js");
  const events = source("app/tennis-note-coach-app/events/delegated.js");
  const app = source("app/tennis-note-coach-app/app.js");

  assert.doesNotMatch(html, /id="lessonEditModal"[^>]*data-tn-restore-draft/);
  assert.doesNotMatch(schedule, /data-save-lesson-draft/);
  assert.doesNotMatch(events, /data-save-lesson-draft|saveLessonChartDraft/);
  assert.doesNotMatch(app, /async function saveLessonChartDraft/);
});

test("관리자 수업 피드백과 회원권 등록은 임시 저장을 제공하지 않는다", () => {
  const html = source("app/admin/index.html");
  const schedule = source("app/admin/schedule-v2-admin.js");

  assert.doesNotMatch(html, /scheduleV2SaveOutcomeDraftButton/);
  assert.doesNotMatch(schedule, /processLessonOutcome\(false\)|scheduleV2SaveOutcomeDraftButton/);
  assert.doesNotMatch(html, /id="memberManagementModal"[^>]*data-tn-restore-draft/);
  assert.doesNotMatch(html, /id="lessonRecordModal"[^>]*data-tn-restore-draft/);
});

test("임시 저장을 끈 입력창은 종료 경고만 하고 브라우저 저장소에 쓰지 않는다", () => {
  const guard = source("app/shared/tennisnote-input-guard.js");

  assert.match(guard, /function persistsDraft\(root\)/);
  assert.match(guard, /if \(!persistsDraft\(root\)\) return false;/);
  assert.match(guard, /작성 내용을 지우고 나갈 수 있습니다/);
});

