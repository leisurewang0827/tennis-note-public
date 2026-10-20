import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import promotion from "./helpers/r3-production-promotion.cjs";

const { BASE: base, files, normalize, sha256, changedAppPaths } = promotion;
const read = path => normalize(fs.readFileSync(path, "utf8"));
const show = (revision, path) => normalize(execFileSync("git", ["show", `${revision}:${path}`], { encoding: "utf8", maxBuffer: 8e6 }));
const extract = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = source.indexOf("\n}", start);
  assert.notEqual(end, -1, name);
  return source.slice(start, end + 2);
};

// Frozen SHA-256 contracts computed from the reviewed public development source.
// The test deliberately does not require that source commit to remain reachable in CI.
const canonicalFunctions = [
  ["app/shared/tennisnote-settlement-adjustment.js", "effectiveProjection", "848d06517ab0486a6f270852109ab295dd911f3a746d3e84ac9f5b9738722129"],
  ["app/admin/domain/billing.js", "adminSettlementHistoryPayloadIsExact", "f354ce8fe9099f87199207d0b66cf17971ff2492d03cf12c2e8e46aa148f0afe"],
  ["app/admin/data/billing.js", "refreshAdminSettlementHistory", "b9d5f065b13f1361a36a47d79851919e3957cf19356e81d9d3ca1136e5ffc0a3"],
  ["app/admin/views/billing.js", "renderAdminSettlementHistory", "340181ba1c26e009b926c73d2d9d5df36332dfa70843c0d71d446d1371e70e18"],
  ["app/tennis-note-coach-app/domain/settlement.js", "coachSettlementReconciliationPayloadIsExact", "3b001d095dce4a1415b7487af796673d73b5245246e76b5bdbebf311f2117bb7"],
  ["app/tennis-note-coach-app/data/sync.js", "syncCoachSettlementHistoryFromServer", "63456053dd59c64e9508676e385f0e092ca40f4e7a2a53b162b3b9891ef9f8dd"],
  ["app/tennis-note-coach-app/views/settlement.js", "renderCoachSettlementHistory", "8bf91593b90b011f7356bc5f959329af9f711cbd7b12c179ce6cf4918f1c2341"],
  ["app/admin/data/billing.js", "adminSettlementHistoryAccessReady", "2abfc3f88c76b40718998a10fc7b538747c1c5865af396ec65039a8a768d163b"],
  ["app/admin/data/billing.js", "readMonthlySettlementConfirmation", "96b03a51b48ed33c8b4c835e252ff92caa64e5cfd30654a49dfb0f9f39c79dd1"],
  ["app/admin/data/billing.js", "refreshEffectiveSettlementPreview", "37eedb371b584bd975f4d20f42b0c89d2f8ad53594f744f6afbf1193e6784c10"],
  ["app/admin/data/billing.js", "effectiveSettlementPreviewContext", "71eaba18d9f482131176b3ea61ea0f1e51c93cb1847e09c3964db16cd3350549"],
  ["app/admin/data/billing.js", "effectiveSettlementPreviewContextIsCurrent", "70788b3448841e34d073f26572390f617c6a6fda0106c75039016b37335ee38a"],
  ["app/admin/data/billing.js", "invalidateEffectiveSettlementPreview", "9f6ff7eaebf0ef73d48d87c2fb0c96124bf0b31757a7319ee27c8c628e0b793f"],
  ["app/admin/domain/billing.js", "adminSettlementHistoryScope", "0d168a6f426d89945772134dc187cccd42ff35caed3c628f885e7d337afd0cb8"],
  ["app/admin/domain/billing.js", "adminSettlementHistoryCoaches", "e33bd698b8ecd19074b9183d2e90bfae134098446a16be999f13c0ead0291c7c"],
  ["app/admin/domain/billing.js", "adminSettlementHistoryScopeKey", "0cc8b9e479edb006ce106acea14fb8232ea15038bcb556690aa057a9b47a1d67"],
  ["app/admin/domain/common.js", "effectiveSettlementPreviewSignature", "5d53d404feec77dd7456e49b6c9bfde26481bca3336920724d801f03f2e3c3bf"],
  ["app/tennis-note-coach-app/data/sync.js", "syncCoachSettlementFromServer", "0318a9651feee6e1f0a375d36dca6281f2b440aeb8305b0a168cd56ee9e103df"],
  ["app/tennis-note-coach-app/domain/settlement.js", "coachSettlementReconciliationScope", "70f2f0ed22b87e0830e3dbc498945e5d8ef65cd7070978f152b39ba42ef67c34"],
  ["app/tennis-note-coach-app/domain/settlement.js", "coachSettlementMonth", "f5f1e4ebbcbc1f4272506b08f49cdcddfe02298459a7faf89f32697eb8d3380b"],
];

test("R3 production candidate is exact to production base and release 1.0.553", () => {
  execFileSync("git", ["merge-base", "--is-ancestor", base, "HEAD"]);
  assert.deepEqual(changedAppPaths(base), files.map(([path]) => path).sort());
  for (const [path, baseSha256, candidateSha256] of files) {
    assert.equal(sha256(read(path)), candidateSha256, `${path}: candidate SHA-256`);
    if (baseSha256) assert.equal(sha256(show(base, path)), baseSha256, `${path}: base SHA-256`);
    else assert.throws(() => execFileSync("git", ["cat-file", "-e", `${base}:${path}`], { stdio: "ignore" }));
  }
  const release = JSON.parse(read("app/release.json"));
  const baseRelease = JSON.parse(show(base, "app/release.json"));
  assert.equal(release.version, "1.0.553");
  assert.equal(release.releaseId, "2026.10.21.01");
  assert.deepEqual(release.nativePlatforms, baseRelease.nativePlatforms);
  assert.match(read("app/tennis-note-member-app/service-worker.js"), /CACHE_NAME\s*=\s*["']tennis-note-member-pwa-v589["']/);
  assert.match(read("app/tennis-note-coach-app/service-worker.js"), /CACHE_NAME\s*=\s*["']tennis-note-coach-mode-v562["']/);
});

test("R3 canonical settlement source, admin identity/scope fences and coach entry remain exact", () => {
  for (const [path, name, expected] of canonicalFunctions) assert.equal(sha256(extract(read(path), name)), expected, `${path}:${name}`);
  const path = "app/tennis-note-coach-app/domain/settlement.js";
  assert.equal(sha256(extract(show(base, path), "coachSettlementMonth")), canonicalFunctions.at(-1)[2], "production KST month selection remains unchanged");
});

test("R3 projection uses exact scope, server totals and read-only preview contract", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"), context);
  const scope = { branchId: "synthetic-branch", coachRoleId: "synthetic-coach-role", settlementMonth: "2099-01-01" };
  const payload = {
    ok: true,
    calculationVersion: "r3_effective_settlement_v2",
    scope: { ...scope },
    sourceFingerprint: "a".repeat(64),
    confirmationReady: false,
    totals: { totalSettlementAmount: 50, revenueAmount: 100, settledSessions: 1, settledMinutes: 40, paymentCount: 1 },
    sourceManifest: { tickets: [{ id: "synthetic-ticket", userId: "synthetic-member" }] },
    lines: [{ sourceTicketId: "synthetic-ticket", sourcePaymentId: "synthetic-payment", settlementAmount: 50, settledSessions: 1, settledMinutes: 40, totalSessions: 5, netAmount: 100, calculationComponents: [] }],
  };
  const projected = context.window.TennisNoteSettlementAdjustment.effectiveProjection(payload, scope);
  assert.equal(projected.estimatedSettlement, 50);
  assert.equal(projected.settledMinutes, 40);
  assert.equal(projected.confirmationReady, false);
  assert.equal(projected.rows[0].userId, "synthetic-member");
  assert.throws(() => context.window.TennisNoteSettlementAdjustment.effectiveProjection(payload, { ...scope, branchId: "other-branch" }));
  const source = read("app/admin/data/billing.js") + read("app/tennis-note-coach-app/data/sync.js");
  assert(source.includes('"tn_coach_settlement_scope_v2"'));
  assert(source.includes('"tn_admin_monthly_settlement_scope_state"'));
  assert(source.includes('"tn_coach_monthly_settlement_reconciliation_state"'));
  for (const forbidden of ["tn_admin_confirm_monthly_settlement_snapshot", "tn_admin_create_monthly_settlement_snapshot", "tn_admin_pay_monthly_settlement"]) assert(!source.includes(forbidden));
  assert.doesNotMatch(read("app/tennis-note-coach-app/index.html"), /coachSettlementReconciliationForm|coachSettlementReconciliationSubmit/);
});

test("admin and coach history adapters call only their exact read RPCs", async () => {
  const scope = { branchId: "synthetic-branch", coachRoleId: "synthetic-coach-role", settlementMonth: "2099-01-01" };
  const calls = [];
  const context = vm.createContext({ window: { TennisNoteDataClient: { rpc: async (name, args) => { calls.push({ name, args }); return { ok: true, state: "EMPTY" }; } } } });
  const adminRead = extract(read("app/admin/data/billing.js"), "readMonthlySettlementConfirmation");
  const coachRead = extract(read("app/tennis-note-coach-app/data/sync.js"), "readCoachSettlementHistory");
  vm.runInContext(adminRead, context);
  vm.runInContext(coachRead, context);
  await context.readMonthlySettlementConfirmation(scope);
  await context.readCoachSettlementHistory(scope);
  assert.deepEqual(calls.map(call => call.name), ["tn_admin_monthly_settlement_scope_state", "tn_coach_monthly_settlement_reconciliation_state"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), { target_branch_id: scope.branchId, target_coach_role_id: scope.coachRoleId, target_month: scope.settlementMonth, expected_source_fingerprint: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].args)), { target_branch_id: scope.branchId, target_coach_role_id: scope.coachRoleId, target_month: scope.settlementMonth });
});
