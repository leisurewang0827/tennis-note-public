import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 실제 HTML/entry/renderer를 실행한다. 서버 transport만 합성이며 외부·쓰기 요청은 차단한다.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium, webkit } = require("playwright");
const origin = "http://127.0.0.1:8773";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

function fixtureConfig(kind) {
  return `window.TennisNoteConfig = {};
  window.__coachInit = { kind: ${JSON.stringify(kind)}, token: "synthetic-token", reads: [], rpcs: [], pending: {}, writes: 0, pushWrites: 0, profileCalls: 0, nativeRegisters: 0, version: 1 };
  const f = window.__coachInit;
  const role = { id: "synthetic-role", branch_id: "synthetic-branch", status: "approved", employment_status: "active", display_name: "합성 코치" };
  const identity = () => ({ user: { id: f.version === 1 ? "synthetic-auth" : "synthetic-auth-next" }, profile: { id: f.version === 1 ? "synthetic-profile" : "synthetic-profile-next", name: "합성 코치", role: "coach", status: "active" }, coachRole: role });
  const deferred = name => new Promise((resolve, reject) => { f.pending[name] = { resolve, reject }; });
  const policy = () => [{ key: "synthetic-policy", value: { scheduleSettings: { openStart: "09:00", openEnd: "18:00", coachWorkPolicyVersion: 73 }, coaches: [{ name: "합성 코치", serverRoleId: role.id, branchId: role.branch_id }] } }];
  const settlement = args => ({ ok: true, calculationVersion: "r3_effective_settlement_v2", scope: { branchId: args.target_branch_id, coachRoleId: args.target_coach_role_id, settlementMonth: args.target_month }, sourceFingerprint: "a".repeat(64), confirmationReady: false, totals: { totalSettlementAmount: 0, revenueAmount: 0, settledSessions: 0, settledMinutes: 0, paymentCount: 0 }, sourceManifest: { tickets: [] }, lines: [] });
  f.release = name => { const p = f.pending[name]; if (!p) throw Error("missing deferred phase"); delete f.pending[name]; p.resolve(name === "profile" ? identity() : ["workspace", "eventWorkspace"].includes(name) ? { branchId: role.branch_id, lessons: [] } : name === "eventJournal" ? [{ id: "synthetic-event-journal", user_id: "synthetic-profile", entry_date: "synthetic-day", created_at: "synthetic-order", body: JSON.stringify({ schema: "tennisnote-mobile-journal-v1", clientLogId: "synthetic-event-log", content: "합성 기록" }) }] : name === "push" ? { receive: "granted" } : name === "settlement" ? settlement(f.settlementArgs) : ["journal", "notice"].includes(name) ? [] : policy()); };
  if (f.kind.startsWith("push-")) {
    window.Capacitor = { getPlatform: () => "ios", isNativePlatform: () => false };
    f.nativeListeners = {}; f.nativeCallbacks = []; f.removeCalls = 0; f.addRejected = 0;
    const listenerKinds = {
      "push-listener-owner-registration": "registration",
      "push-listener-owner-error": "registrationError",
      "push-listener-owner-received": "pushNotificationReceived",
      "push-listener-owner-action": "pushNotificationActionPerformed",
      "push-listener-concurrent": "pushNotificationReceived",
      "push-listener-plugin": "pushNotificationActionPerformed"
    };
    f.makeNativePlugin = pluginId => ({
      addListener: async (name, listener) => {
        if (f.kind === "push-listener-add-failure" && name === "pushNotificationActionPerformed" && !f.addRejected) { f.addRejected++; throw Error("synthetic addListener rejection"); }
        const entry = { name, listener, pluginId, active: true }; f.nativeCallbacks.push(entry); f.nativeListeners[name] = listener;
        const handle = { remove: async () => { f.removeCalls++; if (f.failRemove) throw Error("synthetic native removal failure"); entry.active = false; if (f.nativeListeners[name] === listener) delete f.nativeListeners[name]; } };
        if (listenerKinds[f.kind] === name && !f.listenerHeld) {
          f.listenerHeld = true;
          await new Promise(resolve => { f.pending.listener = { resolve: () => { delete f.pending.listener; resolve(); } }; });
        }
        return handle;
      },
      checkPermissions: () => f.kind.startsWith("push-registration-") || f.kind.startsWith("push-listener-") || ["push-relogin", "push-notice"].includes(f.kind) ? Promise.resolve({ receive: "granted" }) : f.kind === "push-primer" ? Promise.resolve({ receive: "prompt" }) : deferred("push"),
      register: async () => { f.nativeRegisters++; if (!f.kind.startsWith("push-registration-") && !f.kind.startsWith("push-listener-") && f.kind !== "push-relogin") await f.nativeListeners.registration?.({ value: "synthetic-push-token" }); }
    });
    window.TennisNoteNativePush = f.makeNativePlugin("first");
    window.Capacitor.Plugins = { PushNotifications: window.TennisNoteNativePush };
  }
  const readRpc = new Set(["tn_schedule_v2_coach_workspace", "tn_visible_one_day_bookings", "tn_schedule_v2_coach_member_roster", "tn_schedule_v2_operation_days_between", "tn_schedule_revision_snapshot", "tn_coach_lesson_feed", "tn_coach_settlement_scope_v2", "tn_coach_monthly_settlement_reconciliation_state", "tn_coach_monthly_settlement_payment_state"]);
  const client = {
    readiness: () => ({ ready: true }), isOnline: () => false,
    getSession: () => f.token ? { access_token: f.token } : null,
    ensureSession: async () => f.token ? { access_token: f.token } : null,
    consumeOAuthRedirect: async () => {}, signOut: async () => { f.token = ""; },
    selectCurrentProfile: async () => { f.profileCalls++; if (f.holdAction) { f.holdAction = false; const original = identity(); return new Promise(resolve => { f.pending.action = { resolve: () => { delete f.pending.action; resolve(original); } }; }); } if (f.kind === "profile-error") throw Error("synthetic profile error"); if (f.kind === "delayed-profile" || f.kind.startsWith("profile-")) return deferred("profile"); const i = identity(); if (f.kind === "missing-role") i.coachRole = null; if (f.kind === "unapproved-role") i.coachRole.status = "pending"; return i; },
    selectRows: async (table, args) => { f.reads.push({ table, args }); if (table === "tn_admin_settings") { if (f.kind.startsWith("policy-")) return deferred("policy"); return policy(); } if (table === "tn_coach_roles") return [role]; if (table === "tn_journal_entries" && f.holdEventJournal) { f.holdEventJournal = false; return deferred("eventJournal"); } if (table === "tn_journal_entries" && f.kind.startsWith("journal-")) return deferred("journal"); if (table === "tn_notice_popups" && f.holdNotice) return deferred("notice"); return []; },
    rpc: async (name, args, transport) => { f.rpcs.push({ name, args, transport, token: f.token }); if (name === "tn_register_push_device" && (f.kind.startsWith("push-listener-") || ["push-relogin", "push-notice"].includes(f.kind))) { f.pushWrites++; return true; } if (name === "tn_disable_push_device" && f.kind === "policy-actual-logout") return deferred("disable"); if (!readRpc.has(name)) { f.writes++; throw Error("unapproved fixture RPC"); } if (name === "tn_coach_monthly_settlement_reconciliation_state" && f.holdHistory) return deferred("history"); if (name === "tn_schedule_v2_coach_workspace") { if (f.holdEventWorkspace) { f.holdEventWorkspace = false; return deferred("eventWorkspace"); } if (f.kind.startsWith("workspace-")) return deferred("workspace"); return { branchId: role.branch_id, lessons: [] }; } if (name === "tn_coach_settlement_scope_v2") { if (f.kind.startsWith("settlement-")) { f.settlementArgs = args; return deferred("settlement"); } return settlement(args); } return []; },
    invokeFunction: async () => { f.writes++; throw Error("fixture write forbidden"); }
  };
  f.client = client;
  Object.defineProperty(window, "TennisNoteDataClient", { get: () => client, set: () => {}, configurable: true });`;
}

async function runCoachInitBrowser(options = {}) {
  const root = path.resolve(options.root || process.env.TENNISNOTE_COACH_INIT_SOURCE_ROOT || path.join(__dirname, ".."));
  const side = options.side || process.env.TENNISNOTE_COACH_INIT_SOURCE_SIDE || "private";
  assert(["private", "public"].includes(side));
  const prefix = side === "private" ? "90-Dashboard" : "app";
  const cache = new Map();
  function readAsset(relative) {
    assert(relative.startsWith(prefix + "/") && !relative.split("/").includes(".."));
    const file = path.join(root, relative);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return fs.readFileSync(file);
    if (side !== "private" || !process.env.TENNISNOTE_COACH_INIT_PINNED_REPO) return null;
    if (!cache.has(relative)) {
      try { cache.set(relative, cp.execFileSync("git", ["show", "5cf0ff5fad1d059f01b90505c03a77a595c3ddf2:" + relative], { cwd: process.env.TENNISNOTE_COACH_INIT_PINNED_REPO, maxBuffer: 16e6, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] })); }
      catch { cache.set(relative, null); }
    }
    return cache.get(relative);
  }
  let checks = 0, cases = 0;
  const check = (value, label) => { assert(value, label); checks++; };
  const changes = ["token", "client", "profile", "auth", "role", "request", "branch", "logout"];
  const listenerKinds = ["push-listener-owner-registration", "push-listener-owner-error", "push-listener-owner-received", "push-listener-owner-action", "push-listener-concurrent", "push-listener-plugin", "push-listener-remove-failure", "push-listener-add-failure", "push-listener-late-action", "push-listener-late-notice", "push-listener-downstream-workspace", "push-listener-downstream-journal"];
  const kinds = options.kinds || ["normal", "delayed-profile", "profile-error", "missing-role", "unapproved-role", "default-common", "push-relogin", "push-primer", "push-notice", "history-reset", "policy-actual-logout", ...listenerKinds, ...changes.flatMap(change => ["workspace-", "policy-", "push-", "push-registration-"].map(phase => phase + change)), "journal-token", "journal-branch", "settlement-token", "settlement-branch", "settlement-error"];
  async function changeOwner(page, change) {
    await page.evaluate(({ change, side }) => {
      const f = window.__coachInit;
      if (change === "token") f.token = "synthetic-new-token";
      else if (change === "client") Object.defineProperty(window, "TennisNoteDataClient", { value: { ...f.client }, configurable: true });
      else if (change === "profile") state.liveProfileId = "synthetic-new-profile";
      else if (change === "auth") state.coach.authUserId = "synthetic-new-auth";
      else if (change === "role") state.coach.coachRoleId = "synthetic-new-role";
      else if (change === "branch") state.coach.branchId = "synthetic-new-branch";
      else if (change === "request") { if (side === "private") state.coachSettlementReconciliationRequestId++; else coachSettlementHistory.coachSettlementReconciliationRequestId++; }
      else if (change === "logout") { state.coach = null; state.liveProfileId = ""; f.token = ""; }
      else throw Error("unknown owner mutation");
    }, { change, side });
  }
  for (const [engine, type] of Object.entries({ chromium, webkit }).filter(([name]) => !options.engines || options.engines.includes(name))) {
    const browser = await type.launch({ headless: true });
    try {
      for (const kind of kinds) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
        let external = 0, logoutNavigations = 0, logoutWrites = null, nativeManifestReads = 0;
        const externalMetadata = [];
        await context.route("**/*", async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) {
            // The unchanged private native release updater reads this one public
            // manifest on startup. Supply exact local bytes; never contact it.
            if (side === "private" && kind.startsWith("push-")
              && url.origin === "https://tennisnote-app.pages.dev" && url.pathname === "/release.json"
              && [...url.searchParams.keys()].every(key => key === "_")
              && (!url.search || /^\d{10,16}$/.test(url.searchParams.get("_") || ""))
              && route.request().method() === "GET") {
              nativeManifestReads++;
              const body = readAsset(prefix + "/release.json");
              assert(body, "native release fixture bytes missing");
              return route.fulfill({ contentType: "application/json", body });
            }
            external++; externalMetadata.push({ protocol: url.protocol, host: url.hostname, type: route.request().resourceType(), navigation: route.request().isNavigationRequest() }); return route.abort();
          }
          // Stop at the actual logout caller's member destination, not at a
          // fresh fixture bootstrap that would manufacture another session.
          // Destination UI is not claimed as verified by this negative case.
          if (kind === "policy-actual-logout" && route.request().isNavigationRequest()
            && url.pathname === "/" + prefix + "/tennis-note-member-app/index.html") {
            logoutNavigations++;
            return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Offline logout destination receipt</title>" });
          }
          if (url.pathname.endsWith("config.local.js")) return route.fulfill({ contentType: "text/javascript", body: fixtureConfig(kind) });
          let relative = decodeURIComponent(url.pathname).slice(1);
          if (relative.endsWith("/")) relative += "index.html";
          if (!relative.startsWith(prefix + "/") || relative.split("/").includes("..")) return route.fulfill({ status: 403 });
          const body = readAsset(relative);
          return route.fulfill({ status: body ? 200 : 404, contentType: mime[path.extname(relative)] || "application/octet-stream", body: body || "" });
        });
        const page = await context.newPage(), errors = [];
        try {
          page.on("pageerror", error => errors.push(error.message));
          await page.goto(origin + "/" + prefix + "/tennis-note-coach-app/", { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => Boolean(window.__TENNIS_NOTE_COACH_APP_RUNTIME__) && window.__coachInit?.profileCalls > 0);
          if (kind === "delayed-profile") {
            check(await page.evaluate(() => state.coach === null && __coachInit.reads.every(r => r.table !== "tn_admin_settings")), side + " no pre-auth policy/render race");
            await page.evaluate(() => __coachInit.release("profile"));
          }
          if (["profile-error", "missing-role", "unapproved-role"].includes(kind)) {
            await page.waitForFunction(() => state.coach === null && document.querySelector("#coachLoginScreen").hidden === false);
            check(await page.evaluate(() => __coachInit.reads.every(r => r.table !== "tn_admin_settings") && __coachInit.writes === 0), "unusable profile no followup policy/write");
            check(external === 0 && errors.length === 0, "unusable profile safe actual entry"); cases++; continue;
          }
          await page.waitForFunction(() => state.coach?.coachRoleId === "synthetic-role" && state.liveProfileId === "synthetic-profile" && document.querySelector("#coachLoginScreen").hidden && !document.querySelector("#coachAppScreen").hidden);
          if (kind === "history-reset") {
            await page.waitForFunction(() => !!state.coachSettlement && __coachInit.reads.some(r => r.table === "tn_journal_entries"));
            if (side === "public") {
              check(await page.evaluate(() => { const before = coachSettlementHistory.coachSettlementReconciliationRequestId; renderCoachSettlement(); renderCoachSettlement(); return before === coachSettlementHistory.coachSettlementReconciliationRequestId; }), "closed empty history render does not cancel independent owners");
            }
            await page.evaluate(() => { __coachInit.holdHistory = true; });
            await page.locator('.tab[data-view="membersView"]').click();
            await page.locator("#coachSettlementSummaryButton").click();
            await page.waitForFunction(() => !!__coachInit.pending.history);
            const before = await page.evaluate(side => side === "private" ? state.coachSettlementReconciliationRequestId : coachSettlementHistory.coachSettlementReconciliationRequestId, side);
            await page.locator("#coachSettlementModal button[data-close-coach-settlement]").click();
            await page.waitForFunction(() => document.querySelector("#coachSettlementModal").hidden);
            await page.evaluate(() => __coachInit.release("history"));
            await page.waitForTimeout(100);
            check(await page.evaluate(({ side, before }) => { const h = side === "private" ? state : coachSettlementHistory; return h.coachSettlementReconciliationRequestId > before && h.coachSettlementReconciliation === null && h.coachSettlementReconciliationUiState === "EMPTY" && !h.coachSettlementReconciliationLoading; }, { side, before }), "actual modal close invalidates pending history and rejects late response");
          } else if (kind === "policy-actual-logout") {
            await page.waitForFunction(() => !!__coachInit.pending.policy);
            const before = await page.evaluate(() => localStorage.getItem(adminStorageKey));
            await page.locator('.tab[data-view="coachProfileView"]').click();
            await page.locator("#coachLogoutButton").click();
            await page.waitForFunction(() => !!__coachInit.pending.disable && state.coach === null && state.liveProfileId === "");
            await page.evaluate(() => __coachInit.release("policy"));
            await page.waitForTimeout(100);
            check(await page.evaluate(() => localStorage.getItem(adminStorageKey)) === before, "actual logout rejects pending policy cache update");
            check(await page.evaluate(() => __coachInit.rpcs.filter(r => r.name === "tn_disable_push_device").length === 1 && __coachInit.rpcs.find(r => r.name === "tn_disable_push_device").transport?.retryAuth === false), "actual logout exact old-session disable caller once");
            logoutWrites = await page.evaluate(() => __coachInit.writes);
            await page.evaluate(() => __coachInit.release("disable"));
            await page.waitForURL(url => url.origin === origin && url.pathname === "/" + prefix + "/tennis-note-member-app/index.html");
            check(logoutNavigations === 1, "actual logout navigation observed once, hosted transport not executed");
          } else if (kind.startsWith("push-listener-downstream-")) {
            await page.waitForFunction(() => __coachInit.nativeRegisters === 1 && !!state.coachSettlement);
            const phase = kind.endsWith("workspace") ? "eventWorkspace" : "eventJournal";
            const routeName = phase === "eventWorkspace" ? "schedule" : "feedback";
            await page.evaluate(({ phase, routeName }) => {
              const f = __coachInit; f.actionProfilesBefore = f.profileCalls;
              if (phase === "eventWorkspace") f.holdEventWorkspace = true; else f.holdEventJournal = true;
              f.downstreamEvent = f.nativeListeners.pushNotificationActionPerformed({ notification: { data: { route: routeName } } });
            }, { phase, routeName });
            await page.waitForFunction(phase => !!__coachInit.pending[phase], phase);
            check(await page.evaluate(() => __coachInit.profileCalls === __coachInit.actionProfilesBefore + 1), "authorization finished before delayed downstream read");
            await page.evaluate(async () => { await syncNativeCoachPushRegistration(); });
            check(await page.evaluate(() => coachPushListenersReady && __coachInit.nativeRegisters === 2 && state.liveProfileId === "synthetic-profile" && __coachInit.token === "synthetic-token"), "same owner new binding publishes without identity mutation");
            const snapshot = await page.evaluate(() => JSON.stringify({ cache: coachScheduleV2WorkspaceCache, lessons: state.liveLessons, loaded: state.liveLessonsLoaded, error: state.scheduleV2SyncError, logs: state.lessonLogs, shared: localStorage.getItem(sharedStorageKey), admin: localStorage.getItem(adminStorageKey), reads: __coachInit.reads.length, rpcs: __coachInit.rpcs.length, view: document.querySelector(".view.is-active")?.id, toast: document.querySelector("#appToast")?.textContent }));
            await page.evaluate(async phase => { __coachInit.release(phase); await __coachInit.downstreamEvent; }, phase);
            check(await page.evaluate(() => JSON.stringify({ cache: coachScheduleV2WorkspaceCache, lessons: state.liveLessons, loaded: state.liveLessonsLoaded, error: state.scheduleV2SyncError, logs: state.lessonLogs, shared: localStorage.getItem(sharedStorageKey), admin: localStorage.getItem(adminStorageKey), reads: __coachInit.reads.length, rpcs: __coachInit.rpcs.length, view: document.querySelector(".view.is-active")?.id, toast: document.querySelector("#appToast")?.textContent })) === snapshot, "already started old read has zero stale apply/cache/render/toast/navigation/followup RPC");
            check(await page.evaluate(async routeName => { const f = __coachInit, before = f.profileCalls, workspace = f.rpcs.filter(r => r.name === "tn_schedule_v2_coach_workspace").length, journals = f.reads.filter(r => r.table === "tn_journal_entries").length; await f.nativeListeners.pushNotificationActionPerformed({ notification: { data: { route: routeName } } }); return f.profileCalls === before + 1 && f.rpcs.filter(r => r.name === "tn_schedule_v2_coach_workspace").length === workspace + 1 && (routeName !== "feedback" || f.reads.filter(r => r.table === "tn_journal_entries").length === journals + 1); }, routeName), "new binding action keeps normal authorized downstream callers once");
          } else if (kind.startsWith("push-listener-")) {
            const delayedInstall = kind.includes("-owner-") || ["push-listener-concurrent", "push-listener-plugin"].includes(kind);
            if (delayedInstall) await page.waitForFunction(() => !!__coachInit.pending.listener);
            else if (kind === "push-listener-add-failure") {
              await page.waitForFunction(() => __coachInit.addRejected === 1);
              await page.evaluate(async () => { await coachPushListenerInstall; });
              check(await page.evaluate(() => !coachPushListenersReady && __coachInit.nativeRegisters === 0 && __coachInit.nativeCallbacks.every(r => !r.active) && __coachInit.removeCalls === 3), "partial failed installation cleans every returned handle before retry");
            } else await page.waitForFunction(() => __coachInit.nativeRegisters === 1);
            await page.evaluate(async kind => {
              const f = __coachInit; f.oldCallbacks = [...f.nativeCallbacks];
              f.listenerSnapshot = () => JSON.stringify({ reads: f.reads.length, rpcs: f.rpcs.length, profiles: f.profileCalls, cache: localStorage.getItem(sharedStorageKey), view: document.querySelector(".view.is-active")?.id, toast: document.querySelector("#appToast")?.textContent });
              if (kind === "push-listener-late-action") { f.holdAction = true; f.inflightEvent = f.nativeListeners.pushNotificationActionPerformed({ notification: { data: { route: "schedule" } } }); }
              if (kind === "push-listener-late-notice") { f.holdNotice = true; f.inflightEvent = f.nativeListeners.pushNotificationReceived(); }
            }, kind);
            if (kind === "push-listener-late-action") await page.waitForFunction(() => !!__coachInit.pending.action);
            if (kind === "push-listener-late-notice") await page.waitForFunction(() => !!__coachInit.pending.notice);
            await page.evaluate(kind => {
              const f = __coachInit;
              f.holdNotice = false;
              if (kind !== "push-listener-concurrent" && kind !== "push-listener-add-failure") { f.token = "synthetic-token-next"; f.version = 2; }
              if (["push-listener-plugin", "push-listener-remove-failure"].includes(kind)) {
                if (kind === "push-listener-remove-failure") f.failRemove = true;
                window.TennisNoteNativePush = f.makeNativePlugin("next"); window.Capacitor.Plugins.PushNotifications = window.TennisNoteNativePush;
              }
              f.rebindDone = false;
              f.rebind = (kind === "push-listener-concurrent" || kind === "push-listener-add-failure" ? syncNativeCoachPushRegistration() : applySupabaseCoachSession(false)).then(() => { f.rebindDone = true; });
            }, kind);
            if (delayedInstall) {
              await page.waitForFunction(() => coachPushRegistrationSequence >= 2);
              check(await page.evaluate(() => !coachPushListenersReady), "superseding attempt cannot publish pending first binding");
              await page.evaluate(() => __coachInit.pending.listener.resolve());
            }
            await page.waitForFunction(() => __coachInit.rebindDone && coachPushListenersReady);
            const expectedRegisters = delayedInstall || kind === "push-listener-add-failure" ? 1 : 2;
            check(await page.evaluate(expected => __coachInit.nativeRegisters === expected, expectedRegisters), "only completed current install reaches native register");
            check(await page.evaluate(kind => {
              const f = __coachInit, pluginId = ["push-listener-plugin", "push-listener-remove-failure"].includes(kind) ? "next" : "first";
              return ["registration", "registrationError", "pushNotificationReceived", "pushNotificationActionPerformed"].every(name => f.nativeCallbacks.filter(r => r.active && r.pluginId === pluginId && r.name === name).length === 1)
                && (kind === "push-listener-remove-failure" ? f.removeCalls === 4 : f.oldCallbacks.every(r => !r.active));
            }, kind), "all four current event handles exactly once; old handles removed or removal failure inert");
            const snapshot = await page.evaluate(() => __coachInit.listenerSnapshot());
            await page.evaluate(async () => {
              const f = __coachInit;
              if (f.pending.action) f.pending.action.resolve();
              if (f.pending.notice) f.release("notice");
              await f.inflightEvent;
              for (const entry of f.oldCallbacks) await entry.listener(entry.name === "pushNotificationActionPerformed" ? { notification: { data: { route: "schedule" } } } : { value: "synthetic-old-event" });
            });
            check(await page.evaluate(() => __coachInit.listenerSnapshot()) === snapshot, "queued or physically unremoved old callbacks never borrow new owner/read/cache/toast/view/RPC");
            check(await page.evaluate(async () => { const f = __coachInit, before = f.reads.filter(r => r.table === "tn_notice_popups").length; await f.nativeListeners.pushNotificationReceived(); return f.reads.filter(r => r.table === "tn_notice_popups").length === before + 1; }), "current notification receive still runs exactly once");
            check(await page.evaluate(async () => { const f = __coachInit, before = f.profileCalls; await f.nativeListeners.pushNotificationActionPerformed({ notification: { data: { route: "schedule" } } }); return f.profileCalls === before + 1 && document.querySelector(".view.is-active")?.id === "fullScheduleView"; }), "current notification action authorization and navigation preserved");
            await page.evaluate(async () => { await __coachInit.nativeListeners.registration({ value: "synthetic-current-event" }); await __coachInit.nativeListeners.registration({ value: "synthetic-current-event" }); });
            check(await page.evaluate(() => __coachInit.pushWrites === 1 && __coachInit.rpcs.filter(r => r.name === "tn_register_push_device").every(r => r.transport?.requireCurrentSession === true && r.transport?.retryAuth === false)), "current registration consumes exact context once; duplicate event RPC zero");
          } else if (kind === "push-relogin") {
            await page.waitForFunction(() => __coachInit.nativeRegisters === 1);
            await page.evaluate(async () => {
              const f = __coachInit; f.oldRegistration = f.nativeListeners.registration;
              await f.nativeListeners.registration({ value: "synthetic-push-token" });
              await f.nativeListeners.registration({ value: "synthetic-push-token" });
              f.token = "synthetic-token-next"; f.version = 2;
              await applySupabaseCoachSession(false);
            });
            await page.waitForFunction(() => __coachInit.nativeRegisters === 2 && state.liveProfileId === "synthetic-profile-next");
            await page.evaluate(async () => { await __coachInit.oldRegistration({ value: "synthetic-old-event" }); await __coachInit.nativeListeners.registration({ value: "synthetic-new-event" }); });
            check(await page.evaluate(() => __coachInit.pushWrites === 2 && __coachInit.rpcs.filter(r => r.name === "tn_register_push_device").every(r => r.transport?.requireCurrentSession === true && r.transport?.retryAuth === false)), "new login re-registration exactly once per owner; old event ignored");
          } else if (kind === "push-primer") {
            await page.waitForFunction(() => coachPushUiState.permission === "prompt");
            check(await page.evaluate(() => __coachInit.nativeRegisters === 0 && (coachPushPrimerTimer > 0 || activeCoachModalId === "coachPushPrimerModal")), "current prompt schedules native primer");
          } else if (kind === "push-notice") {
            await page.waitForFunction(() => __coachInit.nativeRegisters === 1);
            await page.evaluate(() => { __coachInit.holdNotice = true; void __coachInit.nativeListeners.pushNotificationReceived(); });
            await page.waitForFunction(() => !!__coachInit.pending.notice);
            const before = await page.evaluate(() => localStorage.getItem(sharedStorageKey));
            await changeOwner(page, "token"); await page.evaluate(() => __coachInit.release("notice"));
            await page.waitForTimeout(100);
            check(await page.evaluate(() => localStorage.getItem(sharedStorageKey)) === before, "stale native notice cache unchanged");
          } else if (kind.startsWith("push-registration-")) {
            await page.waitForFunction(() => __coachInit.nativeRegisters === 1 && !!__coachInit.nativeListeners.registration);
            await changeOwner(page, kind.slice("push-registration-".length));
            await page.evaluate(async () => { await __coachInit.nativeListeners.registration({ value: "synthetic-push-token" }); });
            check(await page.evaluate(() => __coachInit.writes === 0), side + " late native registration callback must not send old-owner RPC");
          } else if (kind.startsWith("push-")) {
            await page.waitForFunction(() => !!__coachInit.pending.push);
            await changeOwner(page, kind.slice("push-".length)); await page.evaluate(() => __coachInit.release("push"));
            await page.waitForTimeout(100);
            check(await page.evaluate(() => __coachInit.nativeRegisters === 0 && __coachInit.writes === 0), side + " stale native permission response must not register or send RPC");
          } else if (kind.startsWith("workspace-")) {
            await page.waitForFunction(() => !!__coachInit.pending.workspace);
            const before = await page.evaluate(() => JSON.stringify({ loaded: state.liveLessonsLoaded, cache: coachScheduleV2WorkspaceCache }));
            await changeOwner(page, kind.slice("workspace-".length)); await page.evaluate(() => __coachInit.release("workspace"));
            await page.waitForTimeout(100);
            const result = await page.evaluate(() => ({ after: JSON.stringify({ loaded: state.liveLessonsLoaded, cache: coachScheduleV2WorkspaceCache }), policyReads: __coachInit.reads.filter(r => r.table === "tn_admin_settings").length }));
            check(result.after === before, side + " late workspace response after token replacement must not apply/cache");
            check(result.policyReads === 0, side + " stale workspace must not start policy read");
          } else if (kind.startsWith("policy-")) {
            await page.waitForFunction(() => !!__coachInit.pending.policy);
            const before = await page.evaluate(() => localStorage.getItem(adminStorageKey));
            await changeOwner(page, kind.slice("policy-".length)); await page.evaluate(() => __coachInit.release("policy"));
            await page.waitForTimeout(100);
            const result = await page.evaluate(() => ({ unchanged: localStorage.getItem(adminStorageKey), downstream: __coachInit.reads.some(r => r.table === "tn_journal_entries"), writes: __coachInit.writes }));
            check(result.unchanged === before, side + " late policy response after token replacement must not write cache");
            check(!result.downstream && result.writes === 0, side + " stale policy must not start followup writes/reads");
          } else if (kind.startsWith("journal-")) {
            await page.waitForFunction(() => !!__coachInit.pending.journal);
            const before = await page.evaluate(() => JSON.stringify({ logs: state.lessonLogs, loaded: state.liveJournalLoaded }));
            await changeOwner(page, kind.slice("journal-".length)); await page.evaluate(() => __coachInit.release("journal"));
            await page.waitForTimeout(100);
            check(await page.evaluate(() => JSON.stringify({ logs: state.lessonLogs, loaded: state.liveJournalLoaded })) === before, "stale journal no state mutation");
          } else if (kind.startsWith("settlement-")) {
            await page.waitForFunction(() => !!__coachInit.pending.settlement);
            const before = await page.evaluate(() => JSON.stringify({ settlement: state.coachSettlement, error: state.coachSettlementError, loading: state.coachSettlementLoading }));
            await changeOwner(page, kind === "settlement-branch" ? "branch" : "token");
            await page.evaluate(error => { if (error) { __coachInit.pending.settlement.reject(Error("synthetic settlement failure")); delete __coachInit.pending.settlement; } else __coachInit.release("settlement"); }, kind === "settlement-error");
            await page.waitForTimeout(100);
            check(await page.evaluate(() => JSON.stringify({ settlement: state.coachSettlement, error: state.coachSettlementError, loading: state.coachSettlementLoading })) === before, "stale settlement response/catch/finally no mutation");
          } else {
            await page.waitForFunction(() => __coachInit.reads.some(r => r.table === "tn_admin_settings") && __coachInit.reads.some(r => r.table === "tn_coach_roles") && readAdminSnapshot()?.scheduleSettings?.coachWorkPolicyVersion === 73);
            check(await page.evaluate(() => readAdminSnapshot().operationPolicyBranchId === "synthetic-branch"), side + " exact branch policy readback");
            check(await page.evaluate(() => __coachInit.reads.some(r => r.table === "tn_journal_entries")), side + " followup journal read executed");
            if (kind === "default-common") {
              const result = await page.evaluate(async () => {
                const policy = await syncLiveSchedulePolicy("synthetic-branch"), notices = await syncLiveNotices();
                const reads = __coachInit.reads.length;
                const denied = await syncLiveSchedulePolicy("synthetic-branch", () => false);
                const thrown = await syncLiveSchedulePolicy("synthetic-branch", () => { throw Error("synthetic continuation failure"); });
                const extraReads = __coachInit.reads.length - reads;
                const defaultLesson = await syncCoachLessonsFromServer(), defaultJournal = await syncCoachJournalEntriesFromServer();
                const counts = [__coachInit.reads.length, __coachInit.rpcs.length, __coachInit.profileCalls];
                const blocked = [];
                for (const fn of [syncCoachLessonsFromServer, syncCoachJournalEntriesFromServer]) {
                  blocked.push(await fn(() => false), await fn(() => { throw Error("synthetic continuation failure"); }));
                }
                blocked.push(await authorizeCoachNotificationAction({}, () => false), await authorizeCoachNotificationAction({}, () => { throw Error("synthetic continuation failure"); }));
                return { policy, notices, denied, thrown, extraReads, defaultLesson, defaultJournal, blocked: blocked.every(r => r === false), blockedCalls: JSON.stringify(counts) === JSON.stringify([__coachInit.reads.length, __coachInit.rpcs.length, __coachInit.profileCalls]) };
              });
              check(result.policy && result.notices && !result.denied && !result.thrown && result.extraReads === 0, "default shared caller preserved; false/throw blocked before read");
              check(result.defaultLesson && result.defaultJournal && result.blocked && result.blockedCalls, "default lesson/journal caller preserved; invalid continuation fails closed before transport");
            }
          }
          check(kind === "policy-actual-logout" ? logoutWrites === 0 : await page.evaluate(() => __coachInit.writes === 0), "fixture writes zero");
          check(external === 0, "external requests zero");
          check(nativeManifestReads <= 1, "bounded existing native manifest transport at most once");
          check(errors.length === 0, "page errors zero: " + errors.join(";"));
          cases++;
          console.log(JSON.stringify({ result: "PASS", side, engine, kind, actualEntry: true, external: 0, writes: 0, pageErrors: 0, syntheticNativeManifestReads: nativeManifestReads }));
        } catch (error) {
          const diagnostic = await page.evaluate(() => ({ profileCalls: __coachInit.profileCalls, reads: __coachInit.reads.map(r => r.table), rpcNames: __coachInit.rpcs.map(r => r.name), registers: __coachInit.nativeRegisters, permission: coachPushUiState.permission, pending: Object.keys(__coachInit.pending), hasCoach: !!state.coach, hasProfile: !!state.liveProfileId, hasAuth: !!state.coach?.authUserId, hasBranch: !!state.coach?.branchId, hasRole: !!state.coach?.coachRoleId, ownerCurrent: captureCoachAsyncOwner().isCurrent(), listenerNames: Object.keys(__coachInit.nativeListeners || {}) })).catch(() => null);
          console.error(JSON.stringify({ result: "FAIL", side, engine, kind, diagnostic, pageErrors: errors, externalMetadata }));
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  return { checks, cases, actualEntry: true, hostedWrites: 0, actualDevices: "NOT VERIFIED" };
}

const coachStage = require("./helpers/r3-coach-init-current-stage.cjs");
test("coach current exact reviewed inverse and fail-closed drift", () => {
  const root = path.resolve(__dirname, "..");
  for (const row of coachStage.rows("public")) {
    const current = fs.readFileSync(path.join(root, row.path), "utf8").replace(/\r\n/g, "\n");
    assert.equal(coachStage.hash(current), row.afterSha256);
    const before = cp.execFileSync("git", ["show", row.beforeCommit + ":" + row.path], { cwd: root, encoding: "utf8", maxBuffer: 16e6, windowsHide: true }).replace(/\r\n/g, "\n");
    assert.equal(coachStage.restore(row.path, current), before);
    assert.equal(coachStage.hash(before), row.beforeSha256);
    assert.equal(coachStage.restore(row.path, before), before);
    assert.throws(() => coachStage.restore(row.path, current + "\n// unknown change"), /candidate drift/);
    for (const h of row.hunks) {
      assert.throws(() => coachStage.restore(row.path, current.replace(h.after, "")), /candidate drift/);
      assert.throws(() => coachStage.restore(row.path, current + h.after), /candidate drift/);
    }
  }
});
test("coach current real HTML entry normal and async owner race contracts", async () => {
  const result = await runCoachInitBrowser({ root: path.resolve(__dirname, ".."), side: "public" });
  assert.equal(result.cases, 120); assert.equal(result.hostedWrites, 0);
});
