import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

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
