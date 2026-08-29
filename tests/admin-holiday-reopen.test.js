import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "app/admin/schedule-v2-admin.js"), "utf8");

test("휴무 처리와 운영일 저장은 복구 가능한 서버 경로만 사용한다", () => {
  assert.match(source, /tn_schedule_v2_apply_closure_treatment_reversible/);
  assert.match(source, /tn_schedule_v2_set_operation_day/);
  assert.doesNotMatch(source, /bridge\(\)\.rpc\("tn_schedule_v2_apply_closure_treatment"/);
  assert.doesNotMatch(source, /bridge\(\)\.rpc\("tn_schedule_v2_upsert_operation_day"/);
});

test("휴무와 운영일 해제는 미래 수업 복구 결과를 안내한다", () => {
  assert.match(source, /tn_schedule_v2_clear_closure/);
  assert.match(source, /tn_schedule_v2_clear_operation_day/);
  assert.match(source, /restoredLessonCount/);
  assert.match(source, /휴무일 해제 완료 · 수업 \$\{restoredCount\}건 복구/);
  assert.match(source, /운영일 설정 해제 완료 · 수업 \$\{restoredCount\}건 복구/);
});

test("자동 복구가 중단되는 안전 오류를 관리자에게 설명한다", () => {
  assert.match(source, /schedule_v2_holiday_restore_conflict/);
  assert.match(source, /schedule_v2_holiday_restore_makeup_review_required/);
  assert.match(source, /schedule_v2_holiday_restore_record_changed/);
  assert.match(source, /schedule_v2_holiday_restore_deduction_changed/);
});
