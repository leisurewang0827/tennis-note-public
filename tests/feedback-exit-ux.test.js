import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("수업 상세는 첫 화면 하단에 닫기와 저장 주행동을 한 행으로 둔다", () => {
  const schedule = source("app/tennis-note-coach-app/views/schedule.js");
  const render = schedule.slice(
    schedule.indexOf("function renderScheduleEditPanel()"),
    schedule.indexOf("function renderCoachScheduleOperationNotice"),
  );
  const footer = /<div class="actions lesson-completion-actions wide[^>]*" data-tn-feedback-footer-contract="v1-0-428-pair">([\s\S]*?)<\/div>/.exec(render)?.[1] || "";

  assert.match(render, /data-tn-feedback-exit-contract="lesson-editor-v1"/);
  assert.match(render, /id="lessonDetailSheetTitle">수업 상세<\/strong>/);
  assert.match(render, /data-close-lesson-modal aria-label="수업 상세 닫기"/);
  assert.equal((render.match(/data-close-lesson-modal/g) || []).length, 1);
  assert.equal((render.match(/data-cancel-schedule-edit/g) || []).length, 1);
  assert.match(footer, /class="small-button lesson-completion-close"[^>]*data-cancel-schedule-edit>닫기<\/button>/);
  assert.match(footer, /feedbackPrimaryAction/);
  assert.ok(footer.indexOf("lesson-completion-close") < footer.indexOf("feedbackPrimaryAction"));
  assert.ok(render.indexOf("data-edit-group-feedback-review") < render.indexOf("data-tn-feedback-footer-contract"));
});

test("수업 상세는 header/body/footer 경계와 44px 종료 동작을 고정한다", () => {
  const css = source("app/tennis-note-coach-app/styles.css");
  const html = source("app/tennis-note-coach-app/index.html");

  assert.match(css, /\.lesson-action-panel\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.lesson-detail-scroll-region\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.lesson-completion-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.lesson-completion-actions :is\(\.lesson-completion-close, \.approve-button\)[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.lesson-detail-sheet-close\s*\{[\s\S]*?min-height:\s*44px[\s\S]*?touch-action:\s*manipulation/);
  assert.match(html, /class="modal-card lesson-editor-modal-card"[^>]*aria-label="수업 상세"/);
});

test("닫기·X·ESC·Android back은 같은 draft guard 경로를 사용한다", () => {
  const globals = source("app/tennis-note-coach-app/app.js");
  const screen = source("app/tennis-note-coach-app/ui/screens.js");
  const sheet = source("app/tennis-note-coach-app/ui/sheet.js");
  const coaches = source("app/tennis-note-coach-app/forms/coaches.js");
  const delegated = source("app/tennis-note-coach-app/events/delegated.js");
  const guard = source("app/shared/tennisnote-input-guard.js");

  assert.match(globals, /pendingCoachModalHistoryCloseId/);
  assert.match(screen, /lesson-completion-actions \[data-cancel-schedule-edit\][\s\S]*?lesson-detail-sheet-close[\s\S]*?\[data-close-lesson-modal\]/);
  assert.match(screen, /closeTrigger\?\.isConnected[\s\S]*?closeTrigger\.click\(\)/);
  assert.doesNotMatch(/function requestCloseLessonEditor\([\s\S]*?\n\}/.exec(screen)?.[0] || "", /closeLessonEditor\(\)/);
  assert.match(coaches, /pendingCoachModalHistoryCloseId[\s\S]*?activeCoachModalId === "lessonEditModal"\) requestCloseLessonEditor\(\)/);
  assert.match(delegated, /event\.target\.closest\("\[data-cancel-schedule-edit\]"\)[\s\S]*?closeLessonEditor\(\)/);
  assert.match(delegated, /event\.target\.closest\("\[data-close-lesson-modal\]"\)[\s\S]*?closeLessonEditor\(\)/);
  assert.match(delegated, /event\.key === "Escape"[\s\S]*?requestCloseLessonEditor\(\)/);
  assert.match(guard, /"\[data-close-lesson-modal\]"/);
  assert.match(guard, /signature\(root\) !== current\.initial/);

  assert.match(sheet, /pendingCoachModalReturnContext = returnContext/);
  assert.match(sheet, /pendingCoachModalHistoryCloseId = modalId/);
  assert.match(sheet, /modal\.hidden \|\| activeCoachModalId !== modalId \|\| pendingCoachModalHistoryCloseId/);
  assert.match(sheet, /restoreCoachModalReturnContext\(context\)/);
  assert.match(sheet, /openCoachModal\(queuedModalId\)/);
  assert.match(delegated, /restorePendingCoachModalReturnContext\(\)/);
});

test("공개 운영 초안 비영속 계약과 저장 RPC 경계를 유지한다", () => {
  const html = source("app/tennis-note-coach-app/index.html");
  const schedule = source("app/tennis-note-coach-app/views/schedule.js");

  assert.doesNotMatch(html, /id="lessonEditModal"[^>]*data-tn-restore-draft/);
  assert.doesNotMatch(schedule, /data-save-lesson-draft/);
  assert.equal((schedule.match(/data-complete-lesson-from-modal/g) || []).length, 2);
  assert.equal((schedule.match(/data-review-group-feedback/g) || []).length, 1);
});
