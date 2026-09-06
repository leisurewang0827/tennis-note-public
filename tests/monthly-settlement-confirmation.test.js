import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");
const D = loadAdminDomain("app/admin/domain/billing.js");

const scope = {
  branchId: "fixture-branch",
  coachRoleId: "fixture-coach-role",
  settlementMonth: "2099-02-01",
};
const snapshot = {
  snapshotId: "fixture-snapshot",
  scope,
  revision: 3,
  sourceFingerprint: "a".repeat(64),
};

test("월 정산 확인은 exact scope·revision·fingerprint read-back만 완료로 본다", () => {
  const confirmed = {
    state: "CONFIRMED",
    scope,
    snapshot,
    confirmation: { status: "confirmed" },
  };

  assert.equal(D.monthlySettlementConfirmedReadbackMatches(confirmed, snapshot, scope), true);
  assert.equal(D.monthlySettlementConfirmedReadbackMatches({ ...confirmed, scope: { ...scope, coachRoleId: "other" } }, snapshot, scope), false);
  assert.equal(D.monthlySettlementConfirmedReadbackMatches({ ...confirmed, snapshot: { ...snapshot, revision: 4 } }, snapshot, scope), false);
  assert.equal(D.monthlySettlementConfirmedReadbackMatches({ ...confirmed, snapshot: { ...snapshot, sourceFingerprint: "b".repeat(64) } }, snapshot, scope), false);
  assert.equal(D.monthlySettlementConfirmedReadbackMatches({ ...confirmed, confirmation: null }, snapshot, scope), false);
});

test("월 정산 확인 오류는 stale·conflict·권한·busy를 fail-closed 상태로 정규화한다", () => {
  assert.equal(D.monthlySettlementErrorContract({ message: "settlement_source_stale" }).status, "STALE");
  assert.equal(D.monthlySettlementErrorContract({ payload: { code: "monthly_settlement_snapshot_confirmation_conflict" } }).status, "CONFLICT");
  assert.equal(D.monthlySettlementErrorContract({ message: "admin_role_required" }).status, "ERROR");
  assert.equal(D.monthlySettlementErrorContract({ message: "55P03" }).status, "CONFLICT");
  assert.equal(D.monthlySettlementErrorContract({ message: "unknown" }).status, "ERROR");
});

test("월 정산 확인 public modular 경로가 preview→snapshot→confirm→read-back과 단일 action을 고정한다", () => {
  const app = source("app/admin/app.js");
  const data = source("app/admin/data/billing.js");
  const actions = source("app/admin/actions/billing.js");
  const events = source("app/admin/events/billing.js");
  const views = source("app/admin/views/billing.js");
  const html = source("app/admin/index.html");
  const css = source("app/admin/styles.css");

  for (const state of ["EMPTY", "LOADING", "READY", "STALE", "CONFLICT", "CONFIRMED", "ERROR"]) {
    assert.match(`${app}\n${data}\n${actions}\n${views}`, new RegExp(`\\b${state}\\b`));
  }
  for (const rpc of [
    "tn_admin_preview_monthly_settlement_snapshot",
    "tn_admin_create_monthly_settlement_snapshot",
    "tn_admin_confirm_monthly_settlement_snapshot",
    "tn_admin_monthly_settlement_scope_state",
  ]) assert.match(`${data}\n${actions}`, new RegExp(rpc));

  assert.match(actions, /if \(current\.submitting \|\| current\.loading \|\| current\.status !== "READY"\) return/);
  assert.match(actions, /target_snapshot_id:\s*expectedSnapshot\.snapshotId/);
  assert.match(actions, /expected_snapshot_revision:\s*Number\(expectedSnapshot\.revision\)/);
  assert.match(actions, /expected_source_fingerprint:\s*expectedSnapshot\.sourceFingerprint/);
  assert.match(actions, /readMonthlySettlementConfirmation\(scope, expectedSnapshot\.sourceFingerprint\)/);
  assert.match(actions, /응답이 끊겼지만 서버 확인 기록을 다시 읽어 완료 상태를 확인했습니다/);
  assert.match(data, /settlement_source_changed_after_confirmation/);
  assert.match(events, /monthlySettlementConfirmationState\.submitting/);
  assert.match(events, /정산 확인이 끝난 뒤 월을 변경해 주세요/);
  assert.match(views, /const loadedScopeIsCurrent = current\.loadedSignature === signature/);
  assert.match(views, /const aggregate = loadedScopeIsCurrent/);
  assert.match(views, /primary\.disabled = current\.status !== "READY"[\s\S]*\|\| !loadedScopeIsCurrent/);
  assert.match(views, /monthlySettlementCoachReconciliationEvidence\(current\.scopeState\?\.reconciliation\)/);
  assert.match(views, /escapeHtml\(reason\)/);
  assert.match(views, /confirmedRefresh \? "코치 응답 다시 확인" : "다시 불러오기"/);
  assert.match(views, /\["STALE", "CONFLICT", "CONFIRMED", "ERROR"\]/);
  assert.equal((html.match(/id="monthlySettlementPrimaryAction"/g) || []).length, 1);
  assert.match(html, /<th>예상 정산<\/th>/);
  assert.doesNotMatch(html.match(/id="monthlySettlementConfirmation"[\s\S]*?<\/section>/)?.[0] || "", /지급일|지급 방법|송금|첨부|재조정/);
  assert.match(views, /escapeHtml\(coach\.serverRoleId\)/);
  assert.match(views, /renderMonthlySettlementConfirmation\(\);/);
  assert.match(css, /\.monthly-settlement-confirmation-controls select[\s\S]*font-size:\s*16px/);
  assert.match(css, /\.monthly-settlement-confirmation-actions button[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*grid-template-columns:\s*1fr/);
});
