import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("숨겨진 관리자 시간표는 운영 화면 진입 전 서버 workspace를 미리 읽지 않는다", () => {
  const schedule = source("app/admin/schedule-v2-admin.js");

  assert.match(schedule, /function scheduleWorkspaceIsActive\(\)/);
  assert.match(schedule, /state\.engine === "v2" && !state\.payload && scheduleWorkspaceIsActive\(\)/);
  assert.match(schedule, /tennisnote:admin-view-change/);
});

test("전체 운영자료 갱신은 Schedule V2 workspace를 다시 강제 조회하지 않는다", () => {
  const schedule = source("app/admin/schedule-v2-admin.js");
  const legacyRefresh = source("app/admin/forms/schedule.js");
  const liveDataListener = /window\.addEventListener\("tennisnote:admin-live-data",[\s\S]*?\n\s*\}\);/.exec(schedule)?.[0] || "";

  assert.match(liveDataListener, /scheduleWorkspaceIsActive\(\)/);
  assert.match(liveDataListener, /state\.payload/);
  assert.doesNotMatch(liveDataListener, /requestLiveRefresh\(\)/);
  assert.match(legacyRefresh, /function adminScheduleV2IsActive\(\)/);
  assert.match(legacyRefresh, /\|\| adminScheduleV2IsActive\(\)/);
});

test("최근 운영 스냅샷 결제는 결제 메뉴 첫 진입에서 다시 전체 조회하지 않는다", () => {
  const actions = source("app/admin/actions/common.js");
  const billing = source("app/admin/data/billing.js");

  assert.match(actions, /loadServerPaymentsIntoBilling\(\{ preferCached: true \}\)/);
  assert.match(billing, /const preferCached = Boolean\(options\.preferCached\)/);
  assert.match(billing, /preferCached[\s\S]*serverPaymentSyncState\.loaded[\s\S]*SERVER_PAYMENT_REFRESH_STALE_MS/);
});

test("revision watcher는 비활성 화면에서 주기 조회하지 않는다", () => {
  const revision = source("app/shared/tennisnote-schedule-revision.js");
  const actions = source("app/admin/actions/common.js");

  assert.match(revision, /\(!force && !isActive\(\)\)/);
  assert.doesNotMatch(actions, /void adminOperationalRevisionWatcher\?\.check\?\.\(\);/);
});

test("대형 시간표는 화면 밖 셀과 카드를 브라우저 렌더링 대상에서 제외한다", () => {
  const styles = source("app/admin/schedule-v2-admin.css");

  assert.match(styles, /\.schedule-v2-week-slot,[\s\S]*\.schedule-v2-history-card[\s\S]*content-visibility:\s*auto/);
  assert.match(styles, /contain-intrinsic-size:\s*auto\s+28px/);
});
