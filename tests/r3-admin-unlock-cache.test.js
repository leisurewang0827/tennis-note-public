import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const parity = require("./helpers/r3-admin-history-port.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const extract = (file, name) => {
  const result = read(file).match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}", "m"));
  assert(result, name + " must exist in actual modular source");
  return result[0];
};
const functions = {
  "app/admin/actions/common.js": ["operationsAccessReady", "reconcileAdminBillingLockUi", "confirmAdminUnlock", "setView"],
  "app/admin/domain/common.js": ["adminPinNeedsSetup", "isAdminLockActive", "isAdminViewLocked", "isAdminUnlocked", "adminViewUiSignature", "canReuseAdminView", "rememberAdminViewRender"],
  "app/admin/domain/policy.js": ["operationsRole"],
  "app/admin/actions/settings.js": ["adminApprovalReady"],
  "app/admin/data/common.js": ["verifyAdminPin"],
  "app/admin/data/billing.js": ["resetAdminSettlementHistory", "adminSettlementHistoryAccessReady"],
  "app/admin/views/billing.js": ["renderAdminSettlementHistory"],
};
function fixture() {
  const elements = new Map(), calls = [], timers = [];
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: "", disabled: false, hidden: false, dataset: {}, textContent: "",
      classList: { toggle() {}, remove() {}, add() {} }, setAttribute() {}, replaceChildren() {}, focus() {} });
    return elements.get(id);
  };
  const c = vm.createContext({ Date, Intl, window: {}, document: { createElement: () => ({}) },
    state: { view: "dashboard", billingMonth: "2099-01", billingFilter: "all", billingPage: 1, settlementPage: 1, rechargePage: 1 },
    adminLocalPreviewMode: false, adminDemoMode: false,
    adminImportAuthState: { user: { id: "synthetic-auth" }, profile: { id: "synthetic-admin", role: "admin" } },
    adminLockSettings: { enabled: true, pinConfigured: true, pinHash: "", legacyPin: "", timeoutMinutes: 10, lockedViews: ["billing"] },
    adminLockSession: { unlockedUntil: 0, pendingView: "billing", pendingAction: "", afterUnlock: null },
    legacyDefaultAdminPin: "unused-fixture", legacyDefaultAdminPinHashes: new Set(),
    adminViewRenderCache: new Map(), adminViewRenderRevision: 1,
    adminSettlementHistory: { coachRoleId: "synthetic-role", key: "", request: 0, loading: false, value: null, message: "synthetic", sessionToken: "", profileId: "" },
    adminLayoutSettings: { moreMenus: [] }, serverPaymentSyncState: { loading: false },
    activeOperationBranchId: () => "synthetic-branch", operationsViewAllowed: () => true,
    dirtyMemberInlineForms: () => [], closeCleanMemberInlineEditor() {}, setAdminMoreMenuOpen() {}, closeAdminMenu() {},
    ensureAdminViewData: async () => false, loadServerPaymentsIntoBilling: () => true,
    closeAdminLockModal() { c.adminLockSession.pendingView = ""; c.adminLockSession.afterUnlock = null; },
    renderAdminSecurity() {}, showToast() {}, renderAdminLockModal() {}, renderOperationsLoginGate() {},
    adminSettlementHistoryScope: () => ({ coachRoleId: c.adminSettlementHistory.coachRoleId }),
    adminSettlementHistoryScopeKey: () => "synthetic-scope",
    adminSettlementHistoryCoaches: () => [{ serverRoleId: "synthetic-role", name: "합성 코치" }],
    $: el, $$: () => [], CustomEvent: function () {},
  });
  c.window.dispatchEvent = () => {};
  c.window.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
  c.window.TennisNoteDataClient = {
    readiness: () => ({ ready: true }), getSession: () => ({ access_token: "synthetic-session" }),
    rpc: async name => { calls.push(name); assert.equal(name, "tn_admin_verify_security_pin"); return true; },
  };
  c.renderAdminView = () => { c.renders++; vm.runInContext('renderAdminSettlementHistory(); rememberAdminViewRender("billing");', c); };
  c.renders = 0;
  for (const [file, names] of Object.entries(functions)) vm.runInContext(names.map(name => extract(file, name)).join("\n"), c);
  el("#adminPinInput").value = "synthetic-pin";
  return { c, el, calls, timers, run: code => vm.runInContext(code, c) };
}
test("SETTLE-01 cached locked billing unlock updates controls without full render or history RPC", async () => {
  const { c, el, calls, timers, run } = fixture();
  run('renderAdminSettlementHistory(); rememberAdminViewRender("billing");');
  assert.equal(el("#adminSettlementHistoryCoach").disabled, true);
  await c.confirmAdminUnlock();
  assert.equal(run("isAdminUnlocked()"), true); assert.equal(c.renders, 0);
  assert.equal(el("#adminSettlementHistoryCoach").disabled, false);
  assert.equal(el("#adminSettlementHistoryRead").disabled, false);
  assert.deepEqual(calls, ["tn_admin_verify_security_pin"]);
  assert.equal(timers.length, 1); assert.equal(timers[0].delay, 600001);
});
test("SETTLE-01 cold cache normal unlock keeps existing single render", async () => {
  const { c, el, calls } = fixture(); await c.confirmAdminUnlock();
  assert.equal(c.renders, 1); assert.equal(el("#adminSettlementHistoryRead").disabled, false);
  assert.deepEqual(calls, ["tn_admin_verify_security_pin"]);
});
test("NFR-02 same-view callback unlock reconciles without overwriting callback/draft", async () => {
  const { c, el, calls, run } = fixture(); let callbacks = 0;
  c.state.view = "billing"; c.adminLockSession.pendingView = "";
  c.adminLockSession.afterUnlock = () => { callbacks++; };
  el("#syntheticDraft").value = "합성 초안"; run("renderAdminSettlementHistory()");
  await c.confirmAdminUnlock(); assert.equal(callbacks, 1); assert.equal(c.renders, 0);
  assert.equal(el("#syntheticDraft").value, "합성 초안");
  assert.equal(el("#adminSettlementHistoryRead").disabled, false);
  assert.deepEqual(calls, ["tn_admin_verify_security_pin"]);
});
test("NFR-02 expiration timer reconciles visible controls without a network read", async () => {
  const { c, el, calls, timers } = fixture(); await c.confirmAdminUnlock();
  c.adminLockSession.unlockedUntil = 0; timers[0].fn();
  assert.equal(el("#adminSettlementHistoryCoach").disabled, true);
  assert.equal(el("#adminSettlementHistoryRead").disabled, true);
  assert(el("#adminSettlementHistoryMessage").textContent.includes("잠금 해제"));
  assert.deepEqual(calls, ["tn_admin_verify_security_pin"]);
});
for (const mode of ["logout", "role", "missing-profile", "readiness", "loading"]) {
  test("NFR-02 cached navigation rejects changed " + mode + " with automatic RPC zero", () => {
    const { c, el, calls, run } = fixture(); c.state.view = "billing";
    c.adminLockSession.unlockedUntil = Date.now() + 600000;
    run('renderAdminSettlementHistory(); rememberAdminViewRender("billing");');
    if (mode === "logout") c.window.TennisNoteDataClient.getSession = () => null;
    if (mode === "role") c.adminImportAuthState.profile.role = "coach";
    if (mode === "missing-profile") c.adminImportAuthState.profile = null;
    if (mode === "readiness") c.window.TennisNoteDataClient.readiness = () => ({ ready: false });
    if (mode === "loading") c.adminSettlementHistory.loading = true;
    c.setView("billing", { skipLock: true });
    assert.equal(el("#adminSettlementHistoryCoach").disabled, true);
    assert.equal(el("#adminSettlementHistoryRead").disabled, true);
    assert.deepEqual(calls, []);
  });
}
test("NFR-02 failed PIN does not unlock or schedule an expiry redraw", async () => {
  const { c, calls, timers, run } = fixture();
  c.window.TennisNoteDataClient.rpc = async name => { calls.push(name); return false; };
  c.setTimeout = () => {}; await c.confirmAdminUnlock();
  assert.equal(run("isAdminUnlocked()"), false); assert.equal(timers.length, 0);
  assert.deepEqual(calls, ["tn_admin_verify_security_pin"]);
});
for (const mode of ["profile", "session"]) {
  test("NFR-02 changed valid admin " + mode + " discards old history without automatic read", () => {
    const { c, calls, run } = fixture(); c.state.view = "billing";
    c.adminLockSession.unlockedUntil = Date.now() + 600000;
    run('renderAdminSettlementHistory(); rememberAdminViewRender("billing");');
    c.adminSettlementHistory.key = "synthetic-scope";
    c.adminSettlementHistory.sessionToken = "synthetic-session";
    c.adminSettlementHistory.profileId = "synthetic-admin";
    c.adminSettlementHistory.value = { priorIdentity: true };
    if (mode === "profile") c.adminImportAuthState.profile.id = "synthetic-other-admin";
    else c.window.TennisNoteDataClient.getSession = () => ({ access_token: "synthetic-other-session" });
    c.setView("billing", { skipLock: true });
    assert.equal(c.adminSettlementHistory.value, null); assert.deepEqual(calls, []);
  });
}
test("NFR-02 reconciliation is render-only; no new confirmation controls or writes", () => {
  const helper = extract("app/admin/actions/common.js", "reconcileAdminBillingLockUi");
  assert(helper.includes("renderAdminSettlementHistory({ refresh: false })"));
  assert.doesNotMatch(helper, /rpc|fetch|renderAll|renderAdminView|refreshAdminSettlementHistory|\.disabled\s*=/);
  const html = read("app/admin/index.html");
  assert(!html.includes('id="monthlySettlementPrimaryAction"'));
  assert(!html.includes('id="monthlySettlementConfirmation"'));
});

test("unlock inverse restores exact approved baseline before every historical parity layer", () => {
  assert.equal(parity.unlockManifest.contractVersion, "r3_admin_unlock_source_inverse_v1");
  assert.equal(parity.unlockManifest.privateSource, "d28165e7a8e53c66824d6795c06c3040f425a528");
  assert.equal(parity.unlockManifest.files.length, 1);
  const entry = parity.unlockManifest.files[0];
  const source = read(entry.path).replace(/\r\n/g, "\n");
  const baseline = execFileSync("git", ["show", `${parity.unlockManifest.publicBase}:${entry.path}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
  assert.equal(parity.sha(source), entry.candidateSha256);
  assert.equal(parity.sha(baseline), entry.baseSha256);
  assert.equal(parity.restoreUnlock(entry.path, source), baseline);
  // common.js는 기존 history manifest의 대상 밖이어도 먼저 역변환되어야 한다.
  assert(!parity.manifest.files.some(item => item.path === entry.path));
  assert.equal(parity.restore(entry.path, source), baseline);
  assert.equal(parity.restoreUnlock("synthetic-unrelated.js", "unchanged"), "unchanged");
});

test("unlock exact hunks are unique and unexpected source or inverse drift is rejected", () => {
  const entry = parity.unlockManifest.files[0];
  const source = read(entry.path).replace(/\r\n/g, "\n");
  assert.equal(entry.hunks.length, 5);
  for (const hunk of entry.hunks) {
    assert(hunk.after.length > 0);
    assert.equal(source.split(hunk.after).length, 2);
    assert.throws(() => parity.restore(entry.path, source.replace(hunk.after, hunk.before)), /candidate drift/);
  }
  for (const drift of [source + "\n", source + entry.hunks[0].after, source.replace("refresh: false", "refresh: true")]) {
    assert.throws(() => parity.restore(entry.path, drift), /candidate drift/);
  }
  const hunk = entry.hunks[0], original = hunk.after;
  try {
    hunk.after += "synthetic-invalid-inverse";
    assert.throws(() => parity.restore(entry.path, source), /inverse hunk drift/);
  } finally { hunk.after = original; }
});

test("unlock helper and confirm retain canonical private executable hashes", () => {
  assert.equal(parity.unlockManifest.functions.length, 2);
  for (const entry of parity.unlockManifest.functions) {
    let source = extract("app/admin/actions/common.js", entry.name).replace(/\r\n/g, "\n");
    assert.equal(parity.sha(source), entry.projectedSha256);
    for (const [projected, canonical] of entry.inverseTransforms) {
      assert.equal(source.split(projected).length, 2);
      source = source.replace(projected, canonical);
    }
    assert.equal(parity.sha(source), entry.privateSha256);
  }
});

test("renewal and purchase caller restores its original golden even outside the R3 manifest", () => {
  const renewal = require("./helpers/renewal-hold-port.cjs");
  const r3 = require("./helpers/r3-effective-port.cjs");
  const entry = parity.unlockManifest.files[0];
  const source = read(entry.path).replace(/\r\n/g, "\n");
  const original = execFileSync("git", ["show", `${renewal.manifest.base}:${entry.path}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
  assert(!r3.manifest.files.some(item => item.path === entry.path));
  assert.equal(renewal.restoreBase(entry.path, source), original);
  assert.equal(renewal.sha(original), renewal.manifest.files.find(item => item.path === entry.path).baseSha256);
  for (const drift of [source + "\n", source + entry.hunks[0].after, source.replace("refresh: false", "refresh: true")]) {
    assert.throws(() => renewal.restoreBase(entry.path, drift), /candidate drift/);
  }
});
