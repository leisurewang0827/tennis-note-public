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
  const collisionTransport = await api.create({ client: { ...client, rpc: async () => { throw { code: "23505", message: "PRIVATE_DATABASE_DETAIL" }; } }, getBranchId: () => branch, canOpen: () => allowed });
  await rejectCode(collisionTransport.preview(collisionTransport.scope, [UNIT]), "SHEET_IMPORT_STORAGE_CONFLICT");
  check(api.recognized(transport) && transport.enabled && transport.canApply === false && transport.canReverse === false, "PREVIEW_ONLY_TRANSPORT");
  check(typeof transport.apply === "undefined" && typeof transport.reverse === "undefined" && transport.cleanupContinuityRequired, "NO_MUTATION_METHODS");
  const response = await transport.preview(transport.scope, [UNIT]);
  check(response.safe === true && calls.length === 1 && calls[0][0] === "tn_preview_single_sheet_import", "EXACT_PREVIEW_RPC");
  check(JSON.stringify(calls[0][1]) === JSON.stringify({ scope: transport.scope, units: [UNIT] }), "EXACT_PREVIEW_BODY");
  check(calls[0][2].timeoutMs === 9000 && calls[0][2].requireCurrentSession === true && calls[0][2].retryAuth === false, "BOUNDED_NO_RETRY_OPTIONS");
  const prepareKeys=[api.newWorkSessionKey(),api.newWorkSessionKey()];
  check(prepareKeys.every(k=>/^[a-f0-9]{64}$/.test(k))&&prepareKeys[0]!==prepareKeys[1],"CRYPTO_WORK_KEY_NOT_FILE_OR_ACTOR");
  let prepareCalls=[];
  const workProof=()=>({contract:"single-sheet-work-session/1",scope:{...transport.scope},preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),replay:false});
  const preparedTransport=await api.create({client:{...client,rpc:async(...args)=>{prepareCalls.push(args);return workProof();}},getBranchId:()=>branch,canOpen:()=>allowed});
  const prepared=await preparedTransport.prepareSession(prepareKeys[0]);
  check(prepareCalls.length===1&&prepareCalls[0][0]==="tn_prepare_single_sheet_work_session"&&Object.keys(prepareCalls[0][1]).sort().join('|')==="operation_key|scope","EXACT_PREPARE_NO_ACTOR_OR_TTL");
  check(prepared.expiresAt===preparedTransport.workSessionExpiresAt()&&prepareCalls[0][2].retryAuth===false,"PREPARE_EXPIRY_NO_RETRY");
  await rejectCode(preparedTransport.prepareSession("bad"),"SHEET_PAYLOAD_INVALID");
  check(prepareCalls.length===1,"INVALID_PREPARE_RPC_ZERO");
  for(const mutate of [p=>p.contract="bad",p=>p.scope.branchId="different",p=>p.expiresAt=new Date(Date.now()+3600000).toISOString(),p=>p.expiresAt=new Date(0).toISOString(),p=>p.replay="true"]){
    const invalid=await api.create({client:{...client,rpc:async()=>{const p=workProof();mutate(p);return p;}},getBranchId:()=>branch,canOpen:()=>allowed});
    await rejectCode(invalid.prepareSession(prepareKeys[0]),"SHEET_WORK_SESSION_INVALID");
    check(invalid.workSessionExpiresAt()==="","INVALID_PROOF_NOT_CACHED");
  }
  for(const code of ["SHEET_WORK_RUNTIME_UNAVAILABLE","SHEET_WORK_ENVIRONMENT_MISMATCH","SHEET_WORK_BRANCH_UNAVAILABLE","SHEET_WORK_SESSION_REVOKED","SHEET_WORK_SESSION_EXPIRED","SHEET_WORK_SESSION_SUPERSEDED"]){
    const denied=await api.create({client:{...client,rpc:async()=>{throw {status:403,code:"42501",message:code,details:"RAW_SERVER_DETAIL"};}},getBranchId:()=>branch,canOpen:()=>allowed});
    await rejectCode(denied.prepareSession(prepareKeys[0]),code);
  }

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
  check(batchApi.allowed(applyWithoutCleanup.host, applyWithoutCleanup), "APPLY_ONLY_BATCH_ALLOWED_WITHOUT_REVERSE_METHOD");
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
  const onePayload = { protocol: batchTransport.protocol, fileHash: "9".repeat(64), held: [], units: [{
    unit: sourceUnits[1], rowNumbers: [3], operationKey: operationKeys[1],
  }] };
  // 운영 등록 권한은 원복 권한/메서드와 독립이다. 실제 연결/쓰기는 없는 합성 경로다.
  for (const includeReverseMethod of [false, true]) {
    const scope = { ...batchScope, environment: "production" };
    let state = "READY", applies = 0, reverses = 0;
    const applyOnly = { ...batchTransport, host: "tennisnote-admin.pages.dev", scope,
      currentScope: () => scope, canReverse: false, reverse: undefined,
      preview: async () => ({ contract: "single-sheet-server/2", scope,
        proof: { complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: 1,
          expiresAt: new Date(Date.now() + 120000).toISOString() },
        units: [{ ...serverUnit(1), status: state, verified: state === "APPLIED", reversible: true,
          newMembers: state === "READY" ? 1 : 0, newTickets: state === "READY" ? 1 : 0 }],
      }),
      apply: async () => { applies++; state = "APPLIED"; },
    };
    if (includeReverseMethod) applyOnly.reverse = async () => { reverses++; };
    const current = batchApi.create({ host: applyOnly.host, transport: applyOnly, adapter: snapshotApi, canOpen: () => true });
    await current.load(onePayload);
    check(current.view().canConfirm && !current.view().canReverse && applies === 0, "PRODUCTION_APPLY_ONLY_EXPLICIT_CONFIRM");
    await current.confirm(); await current.confirm(); await current.reverse();
    check(applies === 1 && reverses === 0 && current.view().applied === 1 && !current.view().canReverse, "PRODUCTION_APPLY_ONLY_READBACK_REPLAY_REVERSE_ZERO");
    applyOnly.canApply = false;
    check(!batchApi.allowed(applyOnly.host, applyOnly), "APPLY_FALSE_DENIED");
    applyOnly.canApply = true; applyOnly.enabled = false;
    check(!batchApi.allowed(applyOnly.host, applyOnly), "APPLY_OFF_DENIED");
    await current.confirm(); await current.reverse();
    check(applies === 1 && reverses === 0, "DISABLED_NO_ADDITIONAL_WRITE");
    current.dispose();
  }
  for (const [error, expectedCode] of [
    [{ code: "SHEET_IMPORT_SCOPE_DISABLED", message: "untrusted detail" }, "SHEET_IMPORT_SCOPE_DISABLED"],
    [{ code: "SHEET_IMPORT_SESSION_REQUIRED" }, "SHEET_IMPORT_SESSION_REQUIRED"],
    [{ code: "SHEET_IMPORT_ENVIRONMENT_BLOCKED" }, "SHEET_IMPORT_ENVIRONMENT_BLOCKED"],
    [{ code: "TARGET_OR_REVISION_MISMATCH" }, "TARGET_OR_REVISION_MISMATCH"],
    [{ code: "SHEET_IMPORT_TIMEOUT" }, "SHEET_IMPORT_TIMEOUT"],
    [{ message: "LOCAL_RESPONSE_TIMEOUT" }, "SHEET_IMPORT_TIMEOUT"],
    [{ code: "SHEET_IMPORT_UNRECOGNIZED", message: "RAW_SERVER_DETAIL<script>" }, "SHEET_IMPORT_PREVIEW_FAILED"],
    [{ code: "__proto__", message: "RAW_SERVER_DETAIL" }, "SHEET_IMPORT_PREVIEW_FAILED"],
  ]) {
    let previews = 0, writes = 0;
    const failing = { ...batchTransport, preview: async () => { previews++; throw error; }, apply: async () => { writes++; } };
    const deniedBatch = batchApi.create({ host: failing.host, transport: failing, adapter: snapshotApi, canOpen: () => true });
    check(await deniedBatch.load(onePayload) === false, "PREVIEW_FAILURE_BLOCKED");
    const state = deniedBatch.view();
    check(state.phase === "blocked" && state.failureCode === expectedCode && state.message === expectedCode, "SAFE_CODE_SURVIVES_BATCH");
    check(!state.canConfirm && !state.canResume && state.rows.length === 0, "FAILURE_NOT_READY_OR_ZERO_SUCCESS");
    await deniedBatch.confirm(); await deniedBatch.resume();
    check(previews === 1 && writes === 0 && !JSON.stringify(state).includes("RAW_SERVER_DETAIL"), "FAILURE_NO_AUTORETRY_WRITE_OR_RAW_DETAIL");
    deniedBatch.dispose();
  }
  for (const [change, expectedCode] of [
    [p => { p.proof.expiresAt = new Date(Date.now() - 1000).toISOString(); }, "STALE_PREVIEW"],
    [p => { p.scope = { ...p.scope, branchId: "different-fixture-branch" }; }, "TARGET_OR_REVISION_MISMATCH"],
    [p => { p.proof.complete = false; }, "SNAPSHOT_INCOMPLETE"],
    [p => { p.contract = "unknown"; }, "SERVER_CONTRACT_REQUIRED"],
  ]) {
    const invalid = { ...batchTransport, preview: async (...args) => { const p = await batchTransport.preview(...args); change(p); return p; } };
    const heldBatch = batchApi.create({ host: invalid.host, transport: invalid, adapter: snapshotApi, canOpen: () => true });
    await heldBatch.load(onePayload);
    check(heldBatch.view().failureCode === expectedCode && !heldBatch.view().canConfirm, "ADAPTER_FAILURE_CODE_PRESERVED");
    heldBatch.dispose();
  }
  // Real transport -> batch catch, including the production-observed 403 shape.
  let scopedRpc = 0;
  config = { ...config, environment: "development", singleSheetImportMode: "apply", singleSheetImportReverseEnabled: true };
  const scopedTransport = await api.create({ client: { ...client, rpc: async () => {
    scopedRpc++; throw { status: 403, code: "42501", message: "SHEET_SCOPE_OFF_OR_MISMATCH", details: "RAW_SERVER_DETAIL" };
  } }, getBranchId: () => BRANCH, canOpen: () => true });
  const scopedBatch = batchApi.create({ host: scopedTransport.host, transport: scopedTransport, adapter: snapshotApi, canOpen: () => true });
  await scopedBatch.load(onePayload);
  check(scopedBatch.view().failureCode === "SHEET_IMPORT_SCOPE_DISABLED" && scopedRpc === 1, "POSTGREST_403_TO_BATCH_EXACT_SAFE_CODE");
  scopedBatch.dispose();
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
  // Presentation must distinguish unknown plans/outcomes from verified zero.
  // All responses below are synthetic in-memory; no database/client is used.
  function uxFixture(initial) {
    const uxStates = initial.slice(), calls = { preview: 0, apply: [], reverse: [] };
    const options = { readbackFails: false, responseLost: false, changedPlan: false, blockedIndex: -1, release: null, holdPreview: false, releasePreview: null };
    const uxTransport = { ...batchTransport,
      preview: async (_scope, units) => {
        calls.preview++;
        if (options.holdPreview) await new Promise(resolve => { options.releasePreview = resolve; });
        if (options.readbackFails && calls.apply.length) throw Error("READBACK_UNAVAILABLE");
        return { contract: "single-sheet-server/2", scope: batchScope,
          proof: { complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: units.length, expiresAt: new Date(Date.now() + 120000).toISOString() },
          units: units.map(unit => {
            const i = sourceUnits.findIndex(candidate => candidate.rows[0].phone === unit.rows[0].phone), state = uxStates[i];
            return { ...serverUnit(i), status: state, verified: ["APPLIED", "REVERSED"].includes(state), reversible: state === "APPLIED",
              planHash: options.changedPlan ? "d".repeat(64) : planHashes[i],
              newMembers: state === "HOLD" ? null : state === "READY" ? 1 : 0,
              newTickets: state === "HOLD" ? null : state === "READY" ? 1 : 0,
              newLessons: state === "HOLD" ? null : 0, reason: state === "HOLD" ? "SHEET_COACH_AMBIGUOUS" : "" };
          }) };
      },
      apply: async (_scope, unit, revision, planHash, _expires, _file, key) => {
        const i = sourceUnits.findIndex(candidate => candidate.rows[0].phone === unit.rows[0].phone);
        calls.apply.push({ key, revision, planHash });
        if (options.blockedIndex === i) await new Promise(resolve => { options.release = resolve; });
        if (options.storageConflict) throw Error("SHEET_IMPORT_STORAGE_CONFLICT");
        if (!options.changedPlan) uxStates[i] = "APPLIED";
        if (options.responseLost) throw Error("RESPONSE_LOST");
      },
      reverse: async (_scope, key) => { calls.reverse.push(key); uxStates[operationKeys.indexOf(key)] = "REVERSED"; },
    };
    const controller = batchApi.create({ host: uxTransport.host, transport: uxTransport, adapter: snapshotApi, canOpen: () => true });
    const payload = { ...onePayload, units: initial.map((_, i) => ({ unit: sourceUnits[i], rowNumbers: [i + 2], operationKey: operationKeys[i] })) };
    return { controller, calls, options, payload };
  }
  for (const initial of [["HOLD"], ["READY", "HOLD"]]) {
    const f = uxFixture(initial); await f.controller.load(f.payload);
    const v = f.controller.view(), plans = snapshotApi.summarizePlans(v.rows);
    check(v.rows.at(-1).newMembers === null && v.rows.at(-1).newTickets === null && v.rows.at(-1).newLessons === null, "BATCH_HOLD_NULL_PRESERVED");
    check(plans.newTickets.value === null && plans.newTickets.known === (initial.length - 1) && plans.newTickets.unknownUnits === 1, "BATCH_MIXED_KNOWN_UNKNOWN_SEPARATE");
    f.controller.cancel(); await f.controller.confirm(); await f.controller.reverse();
    check(!f.controller.view().canConfirm && !f.controller.view().canResume && f.calls.apply.length === 0 && f.calls.reverse.length === 0, "PRE_APPLY_CANCEL_WRITES_ZERO");
    check(f.controller.view().message.includes("등록은 실행하지 않았습니다") && !f.controller.view().message.includes("성공"), "PRE_APPLY_CANCEL_NO_FAKE_SUCCESS");
    const originalNow = Date.now; Date.now = () => originalNow() + 180000;
    try { check(f.controller.view().expired && f.controller.view().message.includes("만료") && f.controller.view().message.includes("실행하지"), "ALL_HOLD_AND_MIXED_EXPIRY_TRUTHFUL"); }
    finally { Date.now = originalNow; }
    await f.controller.load(f.payload);
    check(f.calls.apply.length === 0 && f.calls.preview === 2, "CANCEL_EXPLICIT_RECHECK_ONLY");
    f.controller.dispose();
  }
  const loading = uxFixture(["READY"]); loading.options.holdPreview = true;
  const loadingResult = loading.controller.load(loading.payload);
  for (let i = 0; i < 100 && !loading.options.releasePreview; i++) await new Promise(resolve => setImmediate(resolve));
  check(typeof loading.options.releasePreview === "function", "PREVIEW_INFLIGHT_SYNTHETIC");
  loading.controller.cancel(); loading.options.releasePreview(); await loadingResult;
  check(!loading.controller.view().canConfirm && loading.controller.view().phase === "paused" && loading.calls.apply.length === 0, "CANCEL_BEFORE_PREVIEW_RESPONSE_STAYS_PAUSED");
  loading.options.holdPreview = false; await loading.controller.load(loading.payload);
  check(loading.controller.view().canConfirm && loading.calls.apply.length === 0, "EXPLICIT_RECHECK_RESETS_CANCEL_NO_AUTO_APPLY");
  loading.controller.dispose();
  const lost = uxFixture(["READY"]); await lost.controller.load(lost.payload);
  lost.options.responseLost = true; lost.options.readbackFails = true;
  await lost.controller.confirm(); lost.controller.cancel();
  check(lost.controller.view().unconfirmed === 1 && lost.controller.view().applied === 0 && lost.controller.view().message.includes("미확정"), "RESPONSE_LOSS_UNCONFIRMED_NOT_ZERO_SUCCESS");
  check(!/실행하지|성공|원복 이력이 확인/.test(lost.controller.view().message) && lost.calls.apply.length === 1, "UNKNOWN_CANCEL_NO_NO_WRITE_OR_ROLLBACK_CLAIM");
  lost.options.readbackFails = false;
  await lost.controller.resume(); await lost.controller.confirm();
  check(lost.controller.view().applied === 1 && lost.calls.apply.length === 1 && lost.calls.apply[0].key === operationKeys[0], "REPLAY_READBACK_NO_DUPLICATE_OPERATION");
  lost.controller.cancel();
  check(lost.controller.view().message.includes("확인된 등록 1단위"), "CONFIRMED_APPLIED_CANCEL_PRESERVED");
  await lost.controller.reverse();
  check(lost.calls.reverse.length === 0 && !lost.controller.view().message.includes("원복 이력이 확인"), "UNPROVEN_CURRENT_BATCH_REVERSE_STILL_DISABLED");
  lost.controller.dispose();
  const reversible = uxFixture(["READY"]); await reversible.controller.load(reversible.payload);
  await reversible.controller.confirm(); await reversible.controller.reverse(); reversible.controller.cancel();
  check(reversible.controller.view().reversed === 1 && reversible.controller.view().message.includes("원복 이력이 확인된 항목은 1단위"), "REVERSED_NOTICE_ONLY_AFTER_READBACK");
  reversible.controller.dispose();
  const partial = uxFixture(["READY", "READY"]); await partial.controller.load(partial.payload);
  partial.options.blockedIndex = 1;
  const running = partial.controller.confirm();
  for (let i = 0; i < 100 && !partial.options.release; i++) await new Promise(resolve => setImmediate(resolve));
  check(typeof partial.options.release === "function", "PARTIAL_SYNTHETIC_WRITE_PENDING");
  partial.controller.cancel();
  check(partial.controller.view().unconfirmed === 1 && partial.controller.view().message.includes("미확정") && partial.controller.view().message.includes("확인된 등록 1단위"), "PROCESSING_CANCEL_KNOWN_AND_UNKNOWN_SEPARATE");
  await partial.controller.confirm();
  check(partial.calls.apply.length === 2, "BUSY_DUPLICATE_CLICK_ZERO");
  partial.options.release(); await running;
  check(partial.controller.view().applied === 2 && partial.controller.view().unconfirmed === 0, "INFLIGHT_CANCEL_READBACK_COMPLETES_NOT_ROLLED_BACK");
  partial.controller.dispose();
  const changedPlan = uxFixture(["READY"]); await changedPlan.controller.load(changedPlan.payload); changedPlan.options.changedPlan = true;
  await changedPlan.controller.confirm();
  check(changedPlan.controller.view().rows[0].state === "HOLD" && changedPlan.controller.view().rows[0].newTickets === null && !changedPlan.controller.view().canResume, "CHANGED_UNAPPROVED_PLAN_UNKNOWN_NO_AUTO_RETRY");
  check(changedPlan.calls.apply[0].planHash === planHashes[0] && changedPlan.calls.apply[0].revision === revisions[0], "ORIGINAL_APPROVED_HASH_REVISION_PRESERVED");
  changedPlan.controller.dispose();
  for (const readbackFails of [false, true]) {
    const conflict = uxFixture(["READY"]); await conflict.controller.load(conflict.payload);
    conflict.options.storageConflict = true; conflict.options.readbackFails = readbackFails;
    await conflict.controller.confirm(); conflict.controller.invalidate();
    check(conflict.controller.view().message === "SHEET_IMPORT_STORAGE_CONFLICT", "CONFLICT_NOT_MASKED_BY_STALE");
    check(!conflict.controller.view().canResume && conflict.controller.view().applied === 0, "CONFLICT_NO_RETRY_OR_FALSE_SUCCESS");
    await conflict.controller.resume(); await conflict.controller.confirm();
    check(conflict.calls.apply.length === 1, "CONFLICT_SINGLE_MUTATION");
    check(readbackFails ? conflict.controller.view().unconfirmed === 1 : conflict.controller.view().rows[0].state === "HOLD", "CONFLICT_READBACK_CERTAINTY_PRESERVED");
    conflict.controller.dispose();
  }
  process.stdout.write(`Single sheet scoped transport: ${assertions} assertions PASS\n`);
}

main().catch(error => { process.stderr.write(`FAIL code=${/^[A-Z_0-9]+$/.test(error.message) ? error.message : "UNEXPECTED_EXCEPTION"}\n`); process.exitCode = 1; });
