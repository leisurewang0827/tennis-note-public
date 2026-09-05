/* Synthetic transport/config contract only. Never contacts Supabase or stores source rows. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash, webcrypto } = require("node:crypto");
const batchApi = require("../app/shared/tennisnote-single-sheet-batch.js");
const snapshotApi = require("../app/shared/tennisnote-single-sheet-snapshot.js");

const ROOT = path.resolve(__dirname, "..");
const TRANSPORT = fs.readFileSync(path.join(ROOT, "app/shared/tennisnote-single-sheet-transport.js"), "utf8");
const DATA_CLIENT = fs.readFileSync(path.join(ROOT, "app/shared/tennisnote-data-client.js"), "utf8");
const REF = "syntheticprojectref";
const URL_VALUE = `https://${REF}.supabase.co`;
const FINGERPRINT = createHash("sha256").update(REF).digest("hex");
const BRANCH = "11111111-1111-4111-8111-111111111111";
const UNIT = { rows: [{ name: "합성", phone: "01000000000", coach: "합성", product: "합성", startDate: "2099-01-01", total: 5, used: 0, group: "", slots: [] }] };
let assertions = 0;
const check = (value, code) => { assertions++; if (!value) throw Error(code); };
const token = (role = "authenticated", exp = Math.floor(Date.now() / 1000) + 3600) => `x.${Buffer.from(JSON.stringify({ role, exp })).toString("base64url")}.x`;

function loadTransport(origin = "https://tennisnote-admin-dev.pages.dev") {
  const parsed = new URL(origin);
  const context = vm.createContext({
    module: { exports: {} }, exports: {}, location: { origin, hostname: parsed.hostname }, crypto: webcrypto, TextEncoder,
    atob: value => Buffer.from(value, "base64").toString("binary"), Date, Uint8Array, JSON,
  });
  vm.runInContext(TRANSPORT, context);
  return context.module.exports;
}

async function rejectCode(promise, expected) {
  let code = "";
  try { await promise; } catch (error) { code = error.code || error.message; }
  check(code === expected, `EXPECTED_${expected}_GOT_${code || "RESOLVED"}`);
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function loadDataClient(fetchImpl, immediateTimeout = false) {
  const localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage(), timeoutValues = [];
  const window = {
    TENNISNOTE_CONFIG: { supabaseUrl: URL_VALUE, supabasePublishableKey: "fixture-publishable", environment: "development", projectFingerprint: FINGERPRINT, singleSheetImportMode: "preview", singleSheetImportReverseEnabled: false },
    localStorage, sessionStorage, location: { hash: "", pathname: "/admin/index.html", search: "", origin: "https://tennisnote-admin-dev.pages.dev" },
    history: { replaceState() {} }, addEventListener() {}, dispatchEvent() {}, navigator: { onLine: true },
    setTimeout(callback, milliseconds) { timeoutValues.push(milliseconds); return setTimeout(callback, immediateTimeout ? 0 : milliseconds); }, clearTimeout,
  };
  const context = vm.createContext({ window, localStorage, sessionStorage, fetch: fetchImpl, URL, URLSearchParams, AbortController, DOMException, setTimeout, clearTimeout, console, navigator: window.navigator, CustomEvent: class {} });
  vm.runInContext(DATA_CLIENT, context);
  return { client: window.TennisNoteDataClient, localStorage, timeoutValues };
}

async function main() {
  const api = loadTransport();
  let config = { supabaseUrl: URL_VALUE, environment: "development", projectFingerprint: FINGERPRINT, singleSheetImportMode: "preview" };
  let branch = BRANCH, allowed = true, session = { access_token: token() }, calls = [];
  const client = { loadConfig: () => ({ ...config }), getSession: () => session, rpc: async (...args) => { calls.push(args); return { safe: true }; } };
  const create = () => api.create({ client, getBranchId: () => branch, canOpen: () => allowed });

  const transport = await create();
  check(api.recognized(transport) && transport.enabled && transport.canApply === false && transport.canReverse === false, "PREVIEW_ONLY_TRANSPORT");
  check(typeof transport.apply === "undefined" && typeof transport.reverse === "undefined" && transport.cleanupContinuityRequired, "NO_MUTATION_METHODS");
  const response = await transport.preview(transport.scope, [UNIT]);
  check(response.safe === true && calls.length === 1 && calls[0][0] === "tn_preview_single_sheet_import", "EXACT_PREVIEW_RPC");
  check(JSON.stringify(calls[0][1]) === JSON.stringify({ scope: transport.scope, units: [UNIT] }), "EXACT_PREVIEW_BODY");
  check(calls[0][2].timeoutMs === 9000 && calls[0][2].requireCurrentSession === true && calls[0][2].retryAuth === false, "BOUNDED_NO_RETRY_OPTIONS");

  for (const scenario of [
    () => { config = { ...config, singleSheetImportMode: "off" }; },
    () => { config = { ...config, environment: "production", singleSheetImportMode: "preview" }; },
    () => { config = { ...config, environment: "development", projectFingerprint: "f".repeat(64) }; },
    () => { config = { ...config, projectFingerprint: "" }; },
    () => { config = { ...config, projectFingerprint: FINGERPRINT }; branch = "invalid"; },
    () => { branch = BRANCH; session = null; },
    () => { session = { access_token: token("anon") }; },
    () => { session = { access_token: token("authenticated", 1) }; },
    () => { session = { access_token: token() }; allowed = false; },
  ]) {
    const before = calls.length; scenario(); const blocked = await create();
    check(blocked.enabled === false, "GATE_BLOCKED"); await rejectCode(blocked.preview(blocked.scope, [UNIT]), blocked.reason); check(calls.length === before, "BLOCKED_RPC_ZERO");
  }

  config = { supabaseUrl: URL_VALUE, environment: "development", projectFingerprint: FINGERPRINT, singleSheetImportMode: "preview" };
  branch = BRANCH; session = { access_token: token() }; allowed = true;
  const stale = await create(); branch = "22222222-2222-4222-8222-222222222222";
  await rejectCode(stale.preview(stale.scope, [UNIT]), "TARGET_OR_REVISION_MISMATCH");
  branch = BRANCH;
  const bad = await create(); await rejectCode(bad.preview(bad.scope, [{ rows: [{ ...UNIT.rows[0], extra: true }] }]), "SHEET_PAYLOAD_INVALID");

  config = { supabaseUrl: URL_VALUE, environment: "development", projectFingerprint: FINGERPRINT, singleSheetImportMode: "apply", singleSheetImportReverseEnabled: false };
  const applyWithoutCleanup = await create();
  check(applyWithoutCleanup.canApply === true && applyWithoutCleanup.canReverse === false && typeof applyWithoutCleanup.reverse === "undefined", "APPLY_REVERSE_PERMISSION_SEPARATED");
  config = { ...config, singleSheetImportReverseEnabled: true };
  calls = [];
  const executable = await create();
  check(executable.enabled && executable.canApply && executable.canReverse && executable.isReady(), "HOSTED_EXECUTION_READY");
  const expiresAt = new Date(Date.now() + 120000).toISOString();
  await executable.apply(executable.scope, UNIT, "a".repeat(64), "b".repeat(64), expiresAt, "c".repeat(64), "d".repeat(64));
  await executable.reverse(executable.scope, "d".repeat(64));
  check(calls.length === 2 && calls[0][0] === "tn_apply_single_sheet_import_unit" && calls[1][0] === "tn_reverse_single_sheet_import_unit", "EXACT_MUTATION_RPCS");
  check(calls[0][1].expected_revision === "a".repeat(64) && calls[0][1].expected_plan_hash === "b".repeat(64)
    && calls[0][1].preview_expires_at === expiresAt && calls[0][1].file_hash === "c".repeat(64)
    && calls[0][1].operation_key === "d".repeat(64) && calls[1][1].operation_key === "d".repeat(64), "EXACT_MUTATION_PAYLOADS");
  check(calls.every(call => call[2].timeoutMs === 9000 && call[2].requireCurrentSession === true && call[2].retryAuth === false), "MUTATION_NO_RETRY_OPTIONS");
  config = { ...config, singleSheetImportReverseEnabled: false };
  check(!executable.isReady(), "REVERSE_CAPABILITY_CHANGE_INVALIDATES_EXECUTION");
  await rejectCode(executable.reverse(executable.scope, "d".repeat(64)), "SHEET_IMPORT_REVERSE_DISABLED");

  const scopeDenied = await api.create({ client: { ...client, rpc: async () => { const error = Error("SHEET_SCOPE_OFF_OR_MISMATCH"); error.code = "42501"; error.status = 403; throw error; } }, getBranchId: () => BRANCH, canOpen: () => true });
  await rejectCode(scopeDenied.preview(scopeDenied.scope, [UNIT]), "SHEET_IMPORT_SCOPE_DISABLED");
  const timedOut = await api.create({ client: { ...client, rpc: async () => { const error = Error("server_request_timeout"); error.code = "server_request_timeout"; throw error; } }, getBranchId: () => BRANCH, canOpen: () => true });
  await rejectCode(timedOut.preview(timedOut.scope, [UNIT]), "SHEET_IMPORT_TIMEOUT");
  let movingBranch = BRANCH;
  const changedDuringResponse = await api.create({ client: { ...client, rpc: async () => { movingBranch = "22222222-2222-4222-8222-222222222222"; return { safe: true }; } }, getBranchId: () => movingBranch, canOpen: () => true });
  await rejectCode(changedDuringResponse.preview(changedDuringResponse.scope, [UNIT]), "TARGET_OR_REVISION_MISMATCH");

  const noRetryCalls = [];
  const denied = loadDataClient(async url => { noRetryCalls.push(String(url)); return { ok: false, status: 403, text: async () => JSON.stringify({ code: "42501", message: "permission denied for function" }) }; });
  denied.localStorage.setItem(denied.client.storageKey, JSON.stringify({ environment: "production", projectFingerprint: "f".repeat(64), singleSheetImportMode: "off" }));
  denied.localStorage.setItem(denied.client.authStorageKey, JSON.stringify({ access_token: token(), refresh_token: "fixture-refresh", expires_at: Date.now() + 3600000 }));
  const loaded = denied.client.loadConfig();
  check(loaded.environment === "development" && loaded.projectFingerprint === FINGERPRINT && loaded.singleSheetImportMode === "preview" && loaded.singleSheetImportReverseEnabled === false, "FILE_CONFIG_AUTHORITATIVE");
  await rejectCode(denied.client.rpc("tn_preview_single_sheet_import", {}, { timeoutMs: 9000, requireCurrentSession: true, retryAuth: false }), "42501");
  check(noRetryCalls.length === 1 && !noRetryCalls[0].includes("/auth/v1/token"), "AUTH_RETRY_ZERO");

  const abort = loadDataClient((url, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))), true);
  abort.localStorage.setItem(abort.client.authStorageKey, JSON.stringify({ access_token: token(), expires_at: Date.now() + 3600000 }));
  await rejectCode(abort.client.rpc("tn_preview_single_sheet_import", {}, { timeoutMs: 9000, requireCurrentSession: true, retryAuth: false }), "server_request_timeout");
  check(abort.timeoutValues.includes(9000), "ABORT_DEADLINE_9000");

  const wrongOrigin = loadTransport("https://tennisnote-admin.pages.dev");
  const blockedOrigin = await wrongOrigin.create({ client, getBranchId: () => BRANCH, canOpen: () => true });
  check(blockedOrigin.reason === "SHEET_IMPORT_ENVIRONMENT_BLOCKED", "EXACT_DEV_ORIGIN_ONLY");
  const productionApi = loadTransport("https://tennisnote-admin.pages.dev");
  config = { supabaseUrl: URL_VALUE, environment: "production", projectFingerprint: FINGERPRINT, singleSheetImportMode: "preview", singleSheetImportReverseEnabled: false };
  const productionPreview = await productionApi.create({ client, getBranchId: () => BRANCH, canOpen: () => true });
  check(productionPreview.enabled && !productionPreview.canApply, "EXACT_PRODUCTION_ORIGIN_PREVIEW");

  // A receipt applied before this in-memory confirmation is read-only history.
  // Only the READY unit applied by this batch instance may be reversed.
  const batchScope = { environment: "development", projectFingerprint: FINGERPRINT, branchId: BRANCH };
  const unitHashes = ["1".repeat(64), "2".repeat(64)];
  const planHashes = ["3".repeat(64), "4".repeat(64)];
  const revisions = ["5".repeat(64), "6".repeat(64)];
  const operationKeys = ["7".repeat(64), "8".repeat(64)];
  const sourceUnits = [
    { rows: [{ ...UNIT.rows[0], phone: "01000000001" }] },
    { rows: [{ ...UNIT.rows[0], phone: "01000000002" }] },
  ];
  const states = ["APPLIED", "READY"];
  const appliedOperations = [], reversedOperations = [];
  const serverUnit = index => ({
    status: states[index], unitHash: unitHashes[index], planHash: planHashes[index], revision: revisions[index], rowCount: 1,
    newMembers: states[index] === "READY" ? 1 : 0, newTickets: states[index] === "READY" ? 1 : 0,
    newLessons: 0, verified: states[index] === "APPLIED" || states[index] === "REVERSED",
    reversible: states[index] === "APPLIED",
  });
  const batchTransport = {
    protocol: "scoped-postgrest-import/2", host: "tennisnote-admin-dev.pages.dev", scope: batchScope,
    enabled: true, canApply: true, canReverse: true, currentScope: () => batchScope, isReady: () => true,
    preview: async (_scope, units) => ({ contract: "single-sheet-server/2", scope: batchScope,
      proof: { complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: units.length,
        expiresAt: new Date(Date.now() + 120000).toISOString() },
      units: units.map(unit => serverUnit(sourceUnits.findIndex(candidate => candidate.rows[0].phone === unit.rows[0].phone))),
    }),
    apply: async (_scope, unit, _revision, _planHash, _expiresAt, _fileHash, operationKey) => {
      const index = sourceUnits.findIndex(candidate => candidate.rows[0].phone === unit.rows[0].phone);
      appliedOperations.push(operationKey); states[index] = "APPLIED";
    },
    reverse: async (_scope, operationKey) => {
      reversedOperations.push(operationKey); states[operationKeys.indexOf(operationKey)] = "REVERSED";
    },
  };
  const batch = batchApi.create({ host: batchTransport.host, transport: batchTransport, adapter: snapshotApi, canOpen: () => true });
  await batch.load({ protocol: batchTransport.protocol, fileHash: "9".repeat(64), held: [], units: sourceUnits.map((unit, index) => ({
    unit, rowNumbers: [index + 2], operationKey: operationKeys[index],
  })) });
  check(batch.view().applied === 1 && batch.view().canReverse === false, "HISTORICAL_APPLIED_NOT_REVERSIBLE");
  await batch.confirm();
  check(appliedOperations.length === 1 && appliedOperations[0] === operationKeys[1], "ONLY_READY_UNIT_APPLIED");
  check(batch.view().canReverse === true, "CURRENT_BATCH_APPLIED_REVERSIBLE");
  await batch.reverse();
  check(reversedOperations.length === 1 && reversedOperations[0] === operationKeys[1], "ONLY_CURRENT_BATCH_UNIT_REVERSED");
  check(batch.view().applied === 1 && batch.view().reversed === 1 && batch.view().canReverse === false, "HISTORICAL_APPLIED_PRESERVED");
  process.stdout.write(`Single sheet scoped transport: ${assertions} assertions PASS\n`);
}

main().catch(error => { process.stderr.write(`FAIL code=${/^[A-Z_0-9]+$/.test(error.message) ? error.message : "UNEXPECTED_EXCEPTION"}\n`); process.exitCode = 1; });
