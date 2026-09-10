/* Actual admin entry + real Worker, local HTTP only, synthetic in-memory XLSX. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createHash } = require("node:crypto");
const { chromium, webkit } = require("playwright");
const { packet, expected, workbookBytes } = require("./check_tennisnote_single_sheet_preview.cjs");
const parser = require("../app/shared/tennisnote-single-sheet-import.js");
const XLSX = require("../app/shared/vendor/xlsx.full.min.js");
const root = path.resolve(__dirname, "..");
let assertions = 0;
const completedScenarios = new Map();
const scenarioPassed = (engine, name) => completedScenarios.get(engine).push(name);
const check = (ok, code) => { assertions++; if (!ok) throw Object.assign(Error(code), { testCode: code }); };
const observationStart = Date.now();
let observationCount = 0;
function heartbeat(phase = diagnostic.phase) {
  if (observationCount++ >= 256) return;
  process.stdout.write(`TN_EXCEL_OBS ${JSON.stringify({ engine: diagnostic.engine, scenario: diagnostic.scenario, phase,
    caseLabel: ["failed", "unknown", "all-hold"].includes(diagnostic.caseLabel) ? diagnostic.caseLabel : "other",
    elapsedMs: Math.max(0, Math.min(3600000, Date.now() - observationStart)) })}\n`);
}
const observed = state => new Proxy(state, { set(target, key, value) {
  const changed = target[key] !== value; target[key] = value;
  if (changed && ["phase", "caseLabel"].includes(key)) heartbeat();
  return true;
} });
let diagnostic = observed({ engine: "not-started", scenario: "BOOT", phase: "START" });
const diagnosticStep = (engine, scenario, phase) => {
  diagnostic = observed({ engine: ["chromium", "webkit"].includes(engine) ? engine : "not-started", scenario, phase });
  heartbeat();
};
function safeFailureDiagnostic(error) {
  const names = ["Error", "TimeoutError", "TypeError", "RangeError", "ReferenceError", "SyntaxError"];
  const callsites = String(error.stack || "").split("\n").filter(line => /^\s+at /.test(line) && line.includes(__filename + ":"))
    .map(line => line.match(/:(\d+):(\d+)\)?$/)).filter(Boolean).slice(0, 5)
    .map(match => ({ line: Number(match[1]), column: Number(match[2]) }));
  return { ...diagnostic, errorName: names.includes(error.name) ? error.name : "OTHER_ERROR", callsites };
}
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
// Immutable source bytes are shared; browser contexts, sessions and all fixture
// state remain fresh. No HTTP cache or service worker can hide a stale response.
const sourceBytes = new Map();
function assetBytes(target) {
  if (!sourceBytes.has(target)) sourceBytes.set(target, fs.readFileSync(target));
  return sourceBytes.get(target);
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname.endsWith("config.local.js")) { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end("window.TENNISNOTE_CONFIG={};"); return; }
  const target = path.resolve(root, "." + pathname);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(assetBytes(target));
});
async function remotePreviewScenario(browser, engine) {
  diagnosticStep(engine, "REMOTE_PREVIEW", "INITIAL");
  const devOrigin = "https://tennisnote-admin-dev.pages.dev";
  const projectRef = "syntheticprojectref";
  const fingerprint = createHash("sha256").update(projectRef).digest("hex");
  const branchId = "11111111-1111-4111-8111-111111111111";
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const consoleText = [], pageErrors = [];
  page.on("console", message => consoleText.push(message.text()));
  page.on("pageerror", () => pageErrors.push("PAGE_ERROR"));
  await context.route("**/*", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== devOrigin) { await route.abort(); return; }
    if (requestUrl.pathname.endsWith("config.local.js")) {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: `window.TENNISNOTE_CONFIG=${JSON.stringify({ supabaseUrl: `https://${projectRef}.supabase.co`, supabasePublishableKey: "your_publishable_key_here", environment: "development", projectFingerprint: fingerprint, singleSheetImportMode: "preview" })};` });
      return;
    }
    const target = path.resolve(root, "." + decodeURIComponent(requestUrl.pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { await route.fulfill({ status: 404, body: "" }); return; }
    await route.fulfill({ status: 200, contentType: types[path.extname(target)] || "application/octet-stream", body: assetBytes(target), headers: { "Cache-Control": "no-store" } });
  });
  try {
    await page.goto(`${devOrigin}/app/admin/index.html?demoAdmin=1`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#openSingleSheetPreviewButton")?.dataset.excelBound === "true");
    await page.evaluate(({ branchId }) => {
      const payload = { role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 };
      const jwt = `x.${btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.x`;
      window.__remotePreview = { calls: 0, writes: 0, options: null };
      activeOperationBranchId = () => branchId;
      operationsRole = () => "admin";
      operationsAccessReady = () => true;
      window.TennisNoteDataClient.getSession = () => ({ access_token: jwt });
      window.TennisNoteDataClient.rpc = async (name, parameters, options) => {
        if (name === "tn_prepare_single_sheet_work_session") return {contract:"single-sheet-work-session/1",scope:parameters.scope,preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),replay:false};
        if (name !== "tn_preview_single_sheet_import") return [];
        window.__remotePreview.calls++;
        window.__remotePreview.options = { name, timeoutMs: options.timeoutMs, current: options.requireCurrentSession, retry: options.retryAuth, unitCount: parameters.units.length };
        const units = parameters.units.map((unit, index) => ({
          status: "READY", unitHash: String(index + 1).padStart(64, "a"), planHash: String(index + 1).padStart(64, "b"), revision: String(index + 1).padStart(64, "c"),
          verified: false, rowCount: unit.rows.length, newMembers: unit.rows.length, newTickets: 1, newLessons: 0,
        }));
        return { contract: "single-sheet-server/2", scope: parameters.scope, proof: { complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: units.length, expiresAt: new Date(Date.now() + 300000).toISOString() }, units };
      };
      document.querySelector("#adminBrandSplash").hidden = true;
      document.querySelector("#adminAppShell").hidden = false;
      document.querySelector("#openSingleSheetPreviewButton").hidden = false;
    }, { branchId });
    await page.evaluate(() => setView("members", { skipLock: true }));
    const trigger = page.locator("#openSingleSheetPreviewButton");
    await trigger.click();
    const modal = page.locator("#singleSheetPreviewModal"), input = modal.locator("[data-excel-file]");
    await input.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(() => document.querySelector("[data-excel-status]")?.textContent.includes("서버 미리보기 완료"));
    const state = await page.evaluate(() => ({
      probe: window.__remotePreview,
      text: document.querySelector("#singleSheetPreviewModal")?.innerText || "",
      applyDisabled: document.querySelector("[data-excel-apply]")?.disabled,
      applyAria: document.querySelector("[data-excel-apply]")?.getAttribute("aria-disabled"),
      applyClass: document.querySelector("[data-excel-apply]")?.className,
      storage: JSON.stringify({ local: Object.values(localStorage), session: Object.values(sessionStorage) }),
    }));
    check(state.probe.calls === 1, state.probe.calls === 0 ? "REMOTE_PREVIEW_RPC_ZERO" : "REMOTE_PREVIEW_DUPLICATE");
    check(state.probe.options.name === "tn_preview_single_sheet_import", "REMOTE_PREVIEW_EXACT_RPC");
    check(state.probe.options.timeoutMs === 9000 && state.probe.options.current === true && state.probe.options.retry === false, "REMOTE_PREVIEW_BOUNDED_OPTIONS");
    check(state.applyDisabled && state.applyAria === "true" && state.applyClass === "tn-excel-disabled" && state.text.includes("등록·원복은 비활성"), "REMOTE_MUTATION_DISABLED");
    check(!/합성회원|합성코치|010\d{8}|operationKey|fileHash/.test(state.text + state.storage + consoleText.join(" ")), "REMOTE_PII_PRESENTATION_ZERO");
    await page.evaluate(() => { window.TENNISNOTE_CONFIG.singleSheetImportMode = "off"; });
    await input.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(() => document.querySelector("[data-excel-status]")?.textContent.includes("사용 범위"));
    check(await page.evaluate(() => window.__remotePreview.calls) === 1, "SCOPE_OFF_RPC_ZERO");
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    check(pageErrors.length === 0, "REMOTE_PAGE_ERRORS_ZERO");
    process.stdout.write(`PASS ${engine} development PostgREST preview UI; rpc=1; writes=0; scope-off-rpc=0; presentation-pii=0\n`);
  } finally { await context.close(); }
}
async function remoteExecutionScenario(browser, engine, reverseEnabled = true, completionOnly = process.env.TENNISNOTE_EXCEL_COMPLETION_ONLY === "1", initialOnly = process.env.TENNISNOTE_EXCEL_INITIAL_ONLY === "1") {
  diagnosticStep(engine, completionOnly ? "COMPLETION" : reverseEnabled ? "REMOTE_EXECUTION" : "PRODUCTION_APPLY_ONLY", "INITIAL_CONTEXT");
  const environment = reverseEnabled ? "development" : "production";
  const devOrigin = reverseEnabled ? "https://tennisnote-admin-dev.pages.dev" : "https://tennisnote-admin.pages.dev";
  const projectRef = "syntheticprojectref";
  const fingerprint = createHash("sha256").update(projectRef).digest("hex");
  const branchId = "11111111-1111-4111-8111-111111111111";
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", () => errors.push("PAGE_ERROR"));
  await context.route("**/*", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== devOrigin) { await route.abort(); return; }
    if (requestUrl.pathname.endsWith("config.local.js")) {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: `window.TENNISNOTE_CONFIG=${JSON.stringify({
        supabaseUrl: `https://${projectRef}.supabase.co`, supabasePublishableKey: "fixture-publishable", environment,
        projectFingerprint: fingerprint, singleSheetImportMode: "apply", singleSheetImportReverseEnabled: reverseEnabled,
      })};` });
      return;
    }
    const target = path.resolve(root, "." + decodeURIComponent(requestUrl.pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { await route.fulfill({ status: 404, body: "" }); return; }
    await route.fulfill({ status: 200, contentType: types[path.extname(target)] || "application/octet-stream", body: assetBytes(target), headers: { "Cache-Control": "no-store" } });
  });
  try {
    diagnostic.phase = "INITIAL_LOAD";
    await page.goto(`${devOrigin}/app/admin/index.html?demoAdmin=1`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#openSingleSheetPreviewButton")?.dataset.excelBound === "true");
    await page.evaluate(({ branchId }) => {
      const payload = { role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 };
      const jwt = `x.${btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.x`;
      const unitHash = "a".repeat(64), planHash = "b".repeat(64), revision = "b".repeat(64);
      window.__sheetExecution = { state: "READY", previews: 0, applies: 0, reverses: 0, args: [], applyResponseLost: true, reverseResponseLost: true,prepareCalls:0,prepareProofs:{},prepareReplay:0 };
      activeOperationBranchId = () => branchId;
      operationsRole = () => "admin";
      operationsAccessReady = () => true;
      window.TennisNoteDataClient.getSession = () => ({ access_token: jwt });
      window.TennisNoteDataClient.rpc = async (name, parameters, options) => {
        window.__sheetExecution.args.push({ name, keys: Object.keys(parameters).sort(), timeout: options.timeoutMs, retry: options.retryAuth });
        if (name === "tn_prepare_single_sheet_work_session") {
          const s=window.__sheetExecution;s.prepareCalls++;
          if(s.prepareFailure)throw {status:403,code:"42501",message:"SHEET_WORK_RUNTIME_UNAVAILABLE"};
          let proof=s.prepareProofs[parameters.operation_key];
          const replay=!!proof;
          if(!proof)proof=s.prepareProofs[parameters.operation_key]={contract:"single-sheet-work-session/1",scope:parameters.scope,preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString()};
          if(s.prepareResponseLost){s.prepareResponseLost=false;throw {code:"server_request_timeout"};}
          if(replay)s.prepareReplay++;
          return {...proof,replay};
        }
        if (name === "tn_apply_single_sheet_import_unit") {
          window.__sheetExecution.applies++;
          window.__sheetExecution.state = "APPLIED";
          if (window.__sheetExecution.applyResponseLost) { window.__sheetExecution.applyResponseLost = false; throw Error("response_lost"); }
          return { status: "applied", replay: false };
        }
        if (name === "tn_reverse_single_sheet_import_unit") {
          window.__sheetExecution.reverses++;
          window.__sheetExecution.state = "REVERSED";
          if (window.__sheetExecution.reverseResponseLost) { window.__sheetExecution.reverseResponseLost = false; throw Error("response_lost"); }
          return { status: "reversed", replay: false };
        }
        if (name !== "tn_preview_single_sheet_import") throw Error("UNEXPECTED_RPC");
        window.__sheetExecution.previews++;
        if (window.__sheetExecution.holdPreview) {
          window.__sheetExecution.holdPreview = false;
          await new Promise(resolve => { window.__sheetExecution.releasePreview = resolve; });
        }
        if (window.__sheetExecution.unavailableReadback && window.__sheetExecution.applies > 0) throw Error("SYNTHETIC_READBACK_UNAVAILABLE");
        const failure = window.__sheetExecution.failure;
        if (failure === "scope") throw { status: 403, code: "42501", message: "SHEET_SCOPE_OFF_OR_MISMATCH", details: "RAW_SERVER_DETAIL" };
        if (failure === "timeout") throw { code: "server_request_timeout" };
        if (failure === "unknown") throw Error("RAW_SERVER_DETAIL<script>untrusted</script>");
        const applied = window.__sheetExecution.state !== "READY";
        const units = parameters.units.map((unit, index) => ({
          status: window.__sheetExecution.state, unitHash, planHash, revision, verified: applied,
          reversible: window.__sheetExecution.state === "APPLIED",
          rowCount: unit.rows.length, newMembers: applied ? 0 : unit.rows.length, newTickets: applied ? 0 : 1, newLessons: 0,
          ...(window.__sheetExecution.uxUnits ? { ...window.__sheetExecution.uxUnits[index], unitHash: String(index + 1).repeat(64) } : {}),
        }));
        return { contract: "single-sheet-server/2", scope: parameters.scope, proof: {
          complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: units.length,
          expiresAt: new Date(Date.now() + (failure === "stale" ? -1000 : failure === "expires" ? 1500 : 300000)).toISOString(),
        }, units };
      };
      document.querySelector("#adminBrandSplash").hidden = true;
      document.querySelector("#adminAppShell").hidden = false;
      document.querySelector("#openSingleSheetPreviewButton").hidden = false;
      setView("members", { skipLock: true });
    }, { branchId });
    const modal = page.locator("#singleSheetPreviewModal");
    if (initialOnly) {
      await require("./tennisnote_single_sheet_initial_ui_cases.cjs")({ page, modal, engine, check, workbookBytes, XLSX, parser });
      check(errors.length === 0, "INITIAL_PAGE_ERRORS_ZERO");
      return;
    }
    if (completionOnly) {
      diagnostic.phase = "COMPLETION_REFRESH";
      await completionRefreshScenario(page, modal, engine);
      check(errors.length === 0, "COMPLETION_PAGE_ERRORS_ZERO");
      return;
    }
    diagnostic.phase = "INITIAL_OPEN";
    await page.locator("#openSingleSheetPreviewButton").click();
    const fileInput = modal.locator("[data-excel-file]");
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "awaiting-preview");
    check((await modal.locator("[data-excel-boundary]").innerText()).includes("서버 사용 범위는 미확인"), "INITIAL_LOCAL_READY_NOT_SERVER_PERMISSION");
    check(!/기능이 연결되기 전|현재는 읽기 전용/.test(await modal.innerText()) && await modal.locator("[data-excel-apply]").isDisabled(), "NO_STALE_INITIAL_READONLY_CLAIM");
    check(await page.evaluate(() => window.__sheetExecution.args.length) === 0, "OPEN_READINESS_RPC_ZERO");
    check((await modal.locator("[data-excel-boundary]").innerText()).includes("원복은 비활성") === !reverseEnabled, "READINESS_RESPECTS_REVERSE_CAPABILITY");
    diagnostic.phase = "READINESS_RUNTIME_MISSING";
    await page.evaluate(()=>{window.__sheetExecution.prepareFailure=true;});
    await fileInput.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelFailureCode==="SHEET_WORK_RUNTIME_UNAVAILABLE");
    check(await page.evaluate(()=>window.__sheetExecution.previews===0&&window.__sheetExecution.applies===0),"MISSING_RUNTIME_PREVIEW_WRITE_ZERO");
    diagnostic.phase = "READINESS_PREPARE_RESPONSE_LOSS";
    await page.evaluate(()=>{window.__sheetExecution.prepareFailure=false;window.__sheetExecution.prepareResponseLost=true;});
    await modal.locator("[data-excel-retry]").click();
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelFailureCode==="SHEET_WORK_SESSION_FAILED");
    check(await page.evaluate(()=>Object.keys(window.__sheetExecution.prepareProofs).length===1&&window.__sheetExecution.previews===0),"PREPARE_RESPONSE_LOSS_NO_AUTO_PREVIEW_OR_RETRY");
    diagnostic.phase = "READINESS_PREPARE_REPLAY";
    await page.evaluate(()=>{const button=document.querySelector("[data-excel-retry]");button.click();button.click();});
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness==="ready");
    check(await page.evaluate(()=>window.__sheetExecution.prepareCalls===3&&window.__sheetExecution.prepareReplay===1&&Object.keys(window.__sheetExecution.prepareProofs).length===1),"MANUAL_PREPARE_REPLAY_ONE_SESSION_DOUBLE_CLICK_ZERO");
    check(await page.evaluate(()=>window.__sheetExecution.args.filter(c=>c.name==="tn_prepare_single_sheet_work_session").every(c=>c.keys.join('|')==="operation_key|scope")),"UI_NO_ACTOR_TTL_SELF_GRANT_PAYLOAD");
    await page.evaluate(()=>{window.__sheetExecution.previews=0;});
    let expectedPreviews = 0;
    diagnostic.phase = "READINESS_ERROR_MATRIX";
    for (const [failure, safeCode, message] of [
      ["scope", "SHEET_IMPORT_SCOPE_DISABLED", "운영 담당자에게 허용 상태·기간·연결 환경"],
      ["timeout", "SHEET_IMPORT_TIMEOUT", "응답 시간이 초과"],
      ["unknown", "SHEET_IMPORT_PREVIEW_FAILED", "파일 오류로 확정된 것은 아닙니다"],
      ["stale", "STALE_PREVIEW", "만료"],
    ]) {
      await page.evaluate(failure => { window.__sheetExecution.failure = failure; }, failure);
      await fileInput.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
      await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "blocked");
      expectedPreviews++;
      check(await modal.getAttribute("data-excel-failure-code") === safeCode && (await modal.locator("[data-excel-status]").innerText()).includes(message), "ERROR_CODE_TO_EXACT_UI_GUIDANCE");
      check(await fileInput.evaluate(el => el.files.length) === 1 && await modal.locator("[data-excel-retry]").isVisible(), "BLOCKED_FILE_RETAINED_MANUAL_RETRY");
      check(await modal.locator("[data-excel-apply]").isDisabled() && await modal.locator(".tn-excel-summary").count() === 0, "BLOCKED_NO_APPLY_OR_FALSE_ZERO_SUMMARY");
      check(!/RAW_SERVER_DETAIL|<script>|서버 요청을 보내지 않았|파일을 다시 확인해/.test(await modal.innerText()), "NO_RAW_ERROR_OR_FALSE_NO_REQUEST_FILE_BLAME");
      check(await page.evaluate(n => window.__sheetExecution.previews === n && window.__sheetExecution.applies === 0, expectedPreviews), "FAILED_PREVIEW_ONCE_NO_AUTO_WRITE_RETRY");
    }
    diagnostic.phase = "READINESS_EXPIRY";
    await page.evaluate(() => { window.__sheetExecution.failure = "expires"; });
    await page.evaluate(() => { const b = document.querySelector("[data-excel-retry]"); b.click(); b.click(); });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "ready");
    expectedPreviews++;
    check(await page.evaluate(n => window.__sheetExecution.previews === n, expectedPreviews), "EXPLICIT_DOUBLE_RETRY_SINGLE_PREVIEW");
    await modal.locator("[data-excel-apply]").click();
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "expired");
    check(await modal.locator("[data-excel-apply]").isDisabled() && (await modal.locator("[data-excel-status]").innerText()).includes("만료"), "EXPIRY_CANCELS_CONFIRMATION_AND_BLOCKS_APPLY");
    check(!(await modal.locator("[data-excel-status]").innerText()).startsWith("확인:") && await fileInput.evaluate(el => el.files.length) === 1, "EXPIRED_GUIDANCE_NOT_MASKED_FILE_RETAINED");
    check((await modal.locator(".tn-excel-rows").innerText()).includes("미리보기 만료") && !(await modal.locator(".tn-excel-rows").innerText()).includes("등록 가능"), "EXPIRED_ROWS_NOT_READY_CLAIM");
    check(await page.evaluate(() => window.__sheetExecution.applies) === 0, "EXPIRED_WRITE_ZERO");
    if (process.env.TENNISNOTE_EXCEL_READINESS_ONLY === "1") {
      for (const [width, height] of [[390, 844], [768, 1024], [1366, 900], [844, 390]]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await modal.locator("[data-excel-apply]").scrollIntoViewIfNeeded();
        const geometry = await modal.evaluate(el => {
          const panel = el.querySelector(".tn-excel-panel"), button = el.querySelector("[data-excel-apply]"), r = button.getBoundingClientRect(), p = panel.getBoundingClientRect();
          return { overflow: panel.scrollWidth > panel.clientWidth + 1, visible: Math.min(r.bottom, p.bottom, innerHeight) - Math.max(r.top, p.top, 0), font: parseFloat(getComputedStyle(el.querySelector("input")).fontSize) };
        });
        check(!geometry.overflow && geometry.visible >= 44 && geometry.font >= 16, "READINESS_RESPONSIVE_FOCUS_TOUCH");
        if (process.env.TENNISNOTE_EXCEL_CAPTURE_DIR) {
          const dir = path.resolve(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR); fs.mkdirSync(dir, { recursive: true });
          await modal.locator(".tn-excel-panel").evaluate(el => { el.scrollTop = 0; });
          await modal.locator(".tn-excel-panel").screenshot({ path: path.join(dir, `${engine}-readiness-${width}-${theme}.png`) });
        }
      }
    }
    if (reverseEnabled) await holdPlanUiScenario(page, modal, engine);
    diagnosticStep(engine, reverseEnabled ? "REMOTE_EXECUTION" : "PRODUCTION_APPLY_ONLY", "EXECUTION_REOPEN");
    await modal.locator("[data-excel-close]").click(); await modal.waitFor({ state: "hidden" });
    await page.evaluate(() => { window.__sheetExecution.failure = ""; window.__sheetExecution.previews = 0; window.__sheetExecution.args = []; });
    await page.locator("#openSingleSheetPreviewButton").click();
    await modal.locator("[data-excel-file]").setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "ready");
    const apply = modal.locator("[data-excel-apply]"), reverse = modal.locator("[data-excel-reverse]");
    check(!(await apply.isDisabled()) && await reverse.isHidden(), "EXECUTION_READY_ONE_PRIMARY");
    await modal.locator("[data-excel-close]").click();
    await modal.waitFor({ state: "hidden" });
    await page.locator("#openSingleSheetPreviewButton").click();
    check(await apply.isDisabled() && (await modal.locator("[data-excel-status]").innerText()).includes("파일을 선택"), "CLOSE_DISCARDS_UNAPPROVED_BATCH");
    check(await page.evaluate(() => window.__sheetExecution.applies) === 0, "REOPEN_WITHOUT_FILE_RPC_ZERO");
    await modal.locator("[data-excel-file]").setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "ready");
    diagnostic.phase = "EXECUTION_CONFIRM";
    await apply.click();
    check(await page.evaluate(() => window.__sheetExecution.applies) === 0 && (await modal.innerText()).includes("확인:"), "APPLY_CONFIRM_BEFORE_WRITE");
    await page.evaluate(() => { const button = document.querySelector("[data-excel-apply]"); button.click(); button.click(); });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "done");
    check(await page.evaluate(() => window.__sheetExecution.applies) === 1 && (await reverse.isHidden()) === !reverseEnabled, "APPLY_EXACTLY_ONCE_READBACK");
    if (!reverseEnabled) {
      check(await reverse.isDisabled(), "PRODUCTION_REVERSE_HIDDEN_DISABLED");
      await page.evaluate(() => { document.querySelector("[data-excel-reverse]").click(); document.querySelector("[data-excel-apply]").click(); });
      check(await page.evaluate(() => window.__sheetExecution.applies === 1 && window.__sheetExecution.reverses === 0 && window.__sheetExecution.state === "APPLIED"), "PRODUCTION_DUPLICATE_REVERSE_RPC_ZERO");
      check((await modal.locator("[data-excel-boundary]").innerText()).includes("원복은 비활성"), "APPLIED_CAPABILITY_TEXT_PRESERVED");
      await page.keyboard.press("Escape"); await modal.waitFor({ state: "hidden" });
      for (const mode of ["preview", "off"]) {
        await page.evaluate(mode => { window.TENNISNOTE_CONFIG.singleSheetImportMode = mode; }, mode);
        await page.locator("#openSingleSheetPreviewButton").click();
        await fileInput.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
        await page.waitForFunction(() => ["preview-only", "blocked"].includes(document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness));
        check(await apply.isDisabled() && await reverse.isHidden(), "PRODUCTION_PREVIEW_OFF_MUTATIONS_DISABLED");
        check(await page.evaluate(() => window.__sheetExecution.applies === 1 && window.__sheetExecution.reverses === 0), "PRODUCTION_PREVIEW_OFF_WRITE_ZERO");
        await page.keyboard.press("Escape"); await modal.waitFor({ state: "hidden" });
      }
      check(errors.length === 0, "PRODUCTION_APPLY_ONLY_PAGE_ERRORS_ZERO");
      process.stdout.write(`PASS ${engine} production-like apply-only actual entry; mock apply=1; reverse=0; duplicate=0; real network=0\n`);
      return;
    }
    diagnostic.phase = "EXECUTION_REVERSE";
    await reverse.click();
    check(await page.evaluate(() => window.__sheetExecution.reverses) === 0 && (await modal.innerText()).includes("후속 사용 이력"), "REVERSE_SEPARATE_CONFIRM");
    await page.evaluate(() => { const button = document.querySelector("[data-excel-reverse]"); button.click(); button.click(); });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "reversed");
    const result = await page.evaluate(() => window.__sheetExecution);
    check(result.applies === 1 && result.reverses === 1 && result.previews === 4 && !result.applyResponseLost && !result.reverseResponseLost, "PREVIEW_APPLY_READBACK_REVERSE_READBACK_COUNTS");
    check(result.args.every(call => call.timeout === 9000 && call.retry === false), "EXECUTION_BOUNDED_NO_RETRY");
    check(result.args.find(call => call.name === "tn_apply_single_sheet_import_unit")?.keys.join("|") === "expected_plan_hash|expected_revision|file_hash|operation_key|preview_expires_at|scope|unit", "APPLY_EXACT_ARGUMENTS");
    check(result.args.find(call => call.name === "tn_reverse_single_sheet_import_unit")?.keys.join("|") === "operation_key|scope", "REVERSE_EXACT_ARGUMENTS");
    check((await modal.innerText()).includes("원복 완료") && errors.length === 0, "REVERSE_VISIBLE_READBACK");
    process.stdout.write(`PASS ${engine} scoped Excel preview-apply-readback-reverse; writes=2; duplicate=0\n`);
    await modal.locator("[data-excel-close]").click(); await modal.waitFor({ state: "hidden" });
    diagnostic.phase = "EXECUTION_RESPONSE_LOSS";
    await page.evaluate(() => Object.assign(window.__sheetExecution, { state: "READY", applies: 0, reverses: 0, unavailableReadback: true, applyResponseLost: true }));
    await page.locator("#openSingleSheetPreviewButton").click();
    await fileInput.setInputFiles({ name: "synthetic-loss.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "ready");
    await apply.click(); await apply.click();
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "paused");
    await page.evaluate(() => dispatchEvent(new Event("tennisnote:excel-snapshot-changed")));
    const uncertainText = await modal.locator("[data-excel-status]").innerText();
    check(uncertainText.includes("미확정") && uncertainText.includes("완료 여부를 단정할 수 없습니다") && !/실행하지|성공|원복 이력이 확인/.test(uncertainText), "UNKNOWN_UI_CANCEL_NO_FALSE_ZERO_OR_ROLLBACK");
    check((await modal.locator(".tn-excel-summary").innerText()).includes("결과 미확정 단위") && await reverse.isHidden(), "UNKNOWN_UI_EXPLICIT_SUMMARY_NO_REVERSE");
    check(await page.evaluate(() => window.__sheetExecution.applies === 1 && window.__sheetExecution.reverses === 0), "UNKNOWN_UI_NO_AUTOMATIC_RETRY");
    await page.evaluate(() => { window.__sheetExecution.unavailableReadback = false; });
    await apply.click();
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "done");
    check(await page.evaluate(() => window.__sheetExecution.applies === 1) && (await modal.locator(".tn-excel-rows").innerText()).includes("등록 완료"), "UNKNOWN_UI_MANUAL_READBACK_ONLY_NO_DUPLICATE");
    check(errors.length === 0, "HOLD_UNKNOWN_UI_PAGE_ERRORS_ZERO");
    process.stdout.write(`PASS ${engine} unresolved response-loss UI; mock apply=1; duplicate=0; real network=0\n`);
  } finally { await context.close(); }
}
async function completionRefreshScenario(page, modal, engine) {
  // 실제 관리자 entry/Worker/transport/adapter/listener를 실행한다. RPC는 메모리 합성 응답뿐이다.
  await page.evaluate(() => {
    const p = window.__sheetExecution;
    const originalRpc = window.TennisNoteDataClient.rpc;
    const originalCreate = window.TennisNoteSingleSheetBatch.create;
    p.branch = activeOperationBranchId();
    activeOperationBranchId = () => p.branch;
    p.trace = []; p.states = {}; p.indices = {}; p.hold = ""; p.readbackFailure = false;
    p.refresh = () => {
      p.trace.push({ event: "snapshot-before", phase: p.controller?.view().phase, applied: p.controller?.view().applied, reversed: p.controller?.view().reversed });
      dispatchEvent(new Event("tennisnote:excel-snapshot-changed"));
      p.trace.push({ event: "snapshot-after", phase: p.controller?.view().phase, applied: p.controller?.view().applied, reversed: p.controller?.view().reversed });
    };
    window.TennisNoteSingleSheetBatch = Object.freeze({ ...window.TennisNoteSingleSheetBatch, create(options) {
      p.controller = originalCreate({ ...options, changed(v) {
        p.trace.push({ event: "render", phase: v.phase, applied: v.applied, reversed: v.reversed, pending: v.pending });
        options.changed(v);
      } });
      return p.controller;
    } });
    const wait = async kind => {
      if (p.hold !== kind) return;
      p.hold = "";
      try { await new Promise((resolve, reject) => { p.release = resolve; p.reject = () => reject(Error("SYNTHETIC_FAILURE")); }); }
      finally { delete p.release; delete p.reject; }
    };
    window.TennisNoteDataClient.rpc = async (name, params, options) => {
      if (name === "tn_prepare_single_sheet_work_session") return originalRpc(name, params, options);
      const key = unit => {
        const phone = unit.rows[0].phone;
        if (!p.indices[phone]) p.indices[phone] = Object.keys(p.indices).length + 1;
        return p.indices[phone];
      };
      if (name === "tn_apply_single_sheet_import_unit") {
        p.applies++;
        const index = key(params.unit);
        p.operations ||= {}; p.operations[params.operation_key] = index;
        p.trace.push({ event: "apply-sent", count: p.applies });
        await wait("apply");
        p.states[index] = p.failedWrite ? "HOLD" : "APPLIED";
        p.trace.push({ event: "apply-response", receipt: p.states[index] });
        if (p.failedWrite) throw Error("SYNTHETIC_FAILURE");
        return { status: "applied", replay: false };
      }
      if (name === "tn_reverse_single_sheet_import_unit") {
        p.reverses++; p.trace.push({ event: "reverse-sent", count: p.reverses });
        await wait("reverse");
        p.states[p.operations[params.operation_key]] = "REVERSED";
        p.trace.push({ event: "reverse-response", receipt: "REVERSED" });
        return { status: "reversed", replay: false };
      }
      if (name !== "tn_preview_single_sheet_import") return [];
      p.previews++;
      await wait(p.applies ? "readback" : "preview");
      if (p.readbackFailure && p.applies) throw Error("SYNTHETIC_READBACK_FAILURE");
      const units = params.units.map(unit => {
        const index = key(unit), status = p.states[index] || "READY";
        return { status, unitHash: String(index).repeat(64), planHash: "b".repeat(64), revision: "c".repeat(64),
          verified: ["APPLIED", "REVERSED"].includes(status), reversible: status === "APPLIED", rowCount: unit.rows.length,
          newMembers: status === "HOLD" ? null : status === "READY" ? unit.rows.length : 0,
          newTickets: status === "HOLD" ? null : status === "READY" ? 1 : 0,
          newLessons: status === "HOLD" ? null : 0, reason: status === "HOLD" ? "SHEET_EXISTING_TICKET_REVIEW" : "" };
      });
      p.trace.push({ event: "preview-response", receipts: units.map(u => u.status) });
      return { contract: "single-sheet-server/2", scope: params.scope, proof: {
        complete: true, scope: "unit_dependencies", statementBudgetMs: 10000, unitCount: units.length,
        expiresAt: new Date(Date.now() + 300000).toISOString() }, units };
    };
  });
  const input = modal.locator("[data-excel-file]"), apply = modal.locator("[data-excel-apply]"), reverse = modal.locator("[data-excel-reverse]");
  const single = workbookBytes("valid");
  const wb = XLSX.read(single, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[parser.SHEET], { header: 1 });
  rows.push([...rows[1]]); rows[2][1] = "01000000002";
  wb.Sheets[parser.SHEET] = XLSX.utils.aoa_to_sheet(rows);
  const double = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  const select = buffer => input.setInputFiles({ name: "synthetic-completion.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  const read = () => page.evaluate(() => {
    const p = window.__sheetExecution, v = p.controller.view();
    return { phase: v.phase, pending: v.pending, applied: v.applied, reversed: v.reversed, unconfirmed: v.unconfirmed,
      canConfirm: v.canConfirm, canResume: v.canResume, canReverse: v.canReverse, states: v.rows.map(r => r.state),
      message: document.querySelector("[data-excel-status]").textContent, applies: p.applies, reverses: p.reverses, trace: p.trace };
  });
  const idle = () => page.waitForFunction(() => window.__sheetExecution.controller && !window.__sheetExecution.controller.view().busy);
  const configure = values => page.evaluate(values => Object.assign(window.__sheetExecution, values), values);
  const refresh = () => page.evaluate(() => window.__sheetExecution.refresh());
  const release = () => page.evaluate(() => window.__sheetExecution.release());
  const waiting = () => page.waitForFunction(() => typeof window.__sheetExecution.release === "function");
  const start = async (values = {}, buffer = single) => {
    if (await modal.isVisible()) {
      await modal.locator("[data-excel-close]").click(); await modal.waitFor({ state: "hidden" });
      await page.waitForFunction(() => !history.state?.tnExcelPreview);
    }
    // 새 합성 lifecycle은 별도 페이지 메모리 batch로 격리한다. 실제 계정/DB는 없다.
    await page.evaluate(() => { window.__sheetExecution.controller?.dispose(); window.__sheetExecution.controller = null; });
    await configure({ trace: [], states: {}, indices: {}, operations: {}, applies: 0, reverses: 0, previews: 0, hold: "", failedWrite: false, readbackFailure: false, ...values });
    await page.locator("#openSingleSheetPreviewButton").click();
    await select(buffer);
    if (values.hold !== "preview") {
      heartbeat("READY_WAIT");
      try { await page.waitForFunction(() => window.__sheetExecution.controller?.view().phase === "ready"); heartbeat("READY_PASS"); }
      catch (error) {
        heartbeat("READY_FAIL");
        const state = await page.evaluate(() => {
          const p = window.__sheetExecution, v = p.controller?.view();
          const phases = ["idle", "previewing", "ready", "paused", "done", "reversed", "failed", "error"];
          return { controllerExists: Boolean(p.controller), phase: phases.includes(v?.phase) ? v.phase : "OTHER",
            busy: Boolean(v?.busy), previewCount: Number.isSafeInteger(p.previews) ? p.previews : -1,
            failureCode: ["READBACK_UNVERIFIED", "SHEET_INPUT_INVALID", "SHEET_EXISTING_TICKET_REVIEW"].includes(v?.failureCode) ? v.failureCode : v?.failureCode ? "OTHER_SAFE_CODE" : "NONE" };
        });
        process.stderr.write(`COMPLETION_READY_DIAGNOSTIC ${JSON.stringify({ caseLabel: diagnostic.caseLabel || "other", ...state })}\n`);
        throw error;
      }
    }
  };
  const confirm = async control => { await control.click(); await control.click(); };
  await start(); await confirm(apply); await idle();
  const before = await read(); await refresh(); const after = await read();
  if (process.env.TENNISNOTE_EXCEL_COMPLETION_REPRO === "1") {
    check(before.phase === "done" && after.phase === "paused" && after.applied === 1 && after.pending === 0 && after.message.includes("미전송분을 중단"), "OLD_APPLIED_RECEIPT_REFRESH_FALSE_PAUSED_REPRODUCED");
    process.stdout.write(`OLD FAIL ${engine} APPLY ${JSON.stringify({ before: before.phase, after: after.phase, applied: after.applied, pending: after.pending, trace: after.trace })}\n`);
    await confirm(reverse); await idle(); await refresh(); const reverted = await read();
    check(reverted.phase === "paused" && reverted.reversed === 1 && reverted.pending === 0 && reverted.message.includes("미전송분을 중단"), "OLD_REVERSED_RECEIPT_REFRESH_FALSE_PAUSED_REPRODUCED");
    process.stdout.write(`OLD FAIL ${engine} REVERSE ${JSON.stringify({ phase: reverted.phase, reversed: reverted.reversed, pending: reverted.pending, trace: reverted.trace.slice(-9) })}\n`);
    return;
  }
  check(after.phase === "done" && after.applied === 1 && after.pending === 0 && !/중단|나머지/.test(after.message), "APPLIED_REFRESH_COMPLETION_PRESERVED");
  await confirm(reverse); await idle(); await refresh();
  let result = await read();
  check(result.phase === "reversed" && result.reversed === 1 && !/중단|나머지/.test(result.message), "REVERSED_REFRESH_COMPLETION_PRESERVED");
  async function layouts(outcome) {
    for (const [width, height] of [[390,844], [768,1024], [1366,900], [844,390]]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await apply.scrollIntoViewIfNeeded();
      const measure = () => modal.evaluate(el => {
        const panel = el.querySelector(".tn-excel-panel"), r = el.querySelector("[data-excel-apply]").getBoundingClientRect(), p = panel.getBoundingClientRect();
        const rect = value => ({ left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height });
        const status = el.querySelector("[data-excel-status]"), input = el.querySelector("input"), button = el.querySelector("[data-excel-apply]");
        return { overflow: panel.scrollWidth > panel.clientWidth + 1,
          inside: p.left >= 0 && p.right <= innerWidth + 1 && p.top >= 0 && p.bottom <= innerHeight + 1,
          visible: Math.min(r.bottom, p.bottom, innerHeight) - Math.max(r.top, p.top, 0),
          font: parseFloat(getComputedStyle(input).fontSize),
          statusOverflow: status.scrollWidth > status.clientWidth + 1,
          panel: { ...rect(p), clientWidth: panel.clientWidth, clientHeight: panel.clientHeight, scrollWidth: panel.scrollWidth, scrollHeight: panel.scrollHeight, scrollTop: panel.scrollTop, scrollLeft: panel.scrollLeft },
          button: { ...rect(r), minHeight: getComputedStyle(button).minHeight, fontSize: getComputedStyle(button).fontSize },
          status: { ...rect(status.getBoundingClientRect()), clientWidth: status.clientWidth, scrollWidth: status.scrollWidth },
          input: { fontSize: getComputedStyle(input).fontSize, lineHeight: getComputedStyle(input).lineHeight },
          viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height, offsetTop: visualViewport?.offsetTop },
          fonts: document.fonts.status, readyState: document.readyState };
      });
      const beforeScroll = await measure();
      // WebKit의 nearest 스크롤은 정수 clientHeight 경계에 멈출 수 있다.
      // 실제 패널 끝까지 이동한 상태에서 기존 44px 가시 높이를 그대로 검사한다.
      await modal.locator(".tn-excel-panel").evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.waitForFunction(() => {
        const panel = document.querySelector("#singleSheetPreviewModal .tn-excel-panel");
        return panel && panel.scrollTop + panel.clientHeight >= panel.scrollHeight;
      }, null, { polling: "raf", timeout: 5000 });
      const geometry = await measure();
      check(geometry.panel.scrollTop + geometry.panel.clientHeight >= geometry.panel.scrollHeight, "COMPLETION_LAYOUT_SCROLLED_TO_END");
      if (beforeScroll.visible < 44) {
        process.stdout.write(`COMPLETION_SCROLL_TO_END ${JSON.stringify({ engine, outcome, viewport: { width, height }, theme, beforeVisible: beforeScroll.visible, afterVisible: geometry.visible, beforeScrollTop: beforeScroll.panel.scrollTop, afterScrollTop: geometry.panel.scrollTop, buttonHeight: geometry.button.height, panelHeight: geometry.panel.height })}\n`);
      }
      if (geometry.overflow || geometry.statusOverflow || !geometry.inside || !(geometry.visible >= 44) || !(geometry.font >= 16)) {
        process.stdout.write(`COMPLETION_LAYOUT_DIAGNOSTIC ${JSON.stringify({ engine, outcome, viewport: { width, height }, theme, geometry })}\n`);
      }
      check(!geometry.overflow && !geometry.statusOverflow && geometry.inside && geometry.visible >= 44 && geometry.font >= 16, "COMPLETION_LAYOUT_TOUCH_FOCUS");
      check(!/중단|나머지/.test((await read()).message) && await apply.isDisabled(), "COMPLETION_LAYOUT_NO_STALE_PRIMARY");
      if (process.env.TENNISNOTE_EXCEL_CAPTURE_DIR && ((width === 390 && theme === "light") || (width === 1366 && theme === "dark"))) {
        const dir = path.resolve(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR); fs.mkdirSync(dir, { recursive: true });
        await modal.locator(".tn-excel-panel").evaluate(el => { el.scrollTop = 0; });
        await modal.locator(".tn-excel-panel").screenshot({ path: path.join(dir, `${engine}-${outcome}-${width}-${theme}.png`) });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await layouts("reversed");
  await page.keyboard.press("Escape"); await modal.waitFor({ state: "hidden" });
  await page.waitForFunction(() => !history.state?.tnExcelPreview);
  await refresh(); await page.locator("#openSingleSheetPreviewButton").click();
  check((await read()).phase === "reversed" && (await read()).reversed === 1, "COMPLETED_BACK_AND_HIDDEN_REFRESH_KEEP_RECEIPT");
  for (const heldAt of ["apply", "readback"]) {
    await start(); await configure({ hold: heldAt }); await confirm(apply); await waiting();
    await refresh();
    check((await read()).unconfirmed === 1 && !(await read()).canConfirm, "INFLIGHT_REFRESH_NO_PREMATURE_SUCCESS");
    await release(); await idle(); result = await read();
    check(result.phase === "done" && result.applied === 1 && result.applies === 1 && !result.canConfirm && !result.canResume && !/중단|나머지/.test(result.message), "LAST_APPLY_RESPONSE_REFRESH_CONVERGES_EXACT_RECEIPT");
    await configure({ hold: heldAt === "apply" ? "reverse" : "readback" }); await confirm(reverse); await waiting();
    await refresh(); await release(); await idle(); result = await read();
    check(result.phase === "reversed" && result.reversed === 1 && result.reverses === 1 && !/중단|나머지/.test(result.message), "LAST_REVERSE_RESPONSE_REFRESH_CONVERGES_EXACT_RECEIPT");
  }
  await start(); await confirm(apply); await idle(); await refresh(); await layouts("applied");
  const appliedCount = (await read()).applies;
  await page.evaluate(() => { document.querySelector("[data-excel-apply]").click(); document.querySelector("[data-excel-apply]").click(); });
  check((await read()).applies === appliedCount, "TERMINAL_DOUBLE_CLICK_WRITE_ZERO");
  // 새 파일의 미리보기에 이전 receipt/confirmation을 섞지 않는다.
  await configure({ states: {}, indices: {} }); await select(double);
  await page.waitForFunction(() => window.__sheetExecution.controller?.view().phase === "ready");
  result = await read();
  check(result.applied === 0 && result.pending === 2 && result.reversed === 0 && !result.canReverse && result.applies === appliedCount, "NEW_FILE_NO_OLD_RECEIPT_OR_AUTO_WRITE");
  await refresh(); result = await read();
  check(result.phase === "paused" && !result.canConfirm && !result.canResume && result.states.every(s => s === "READY") && !(await modal.locator(".tn-excel-rows").innerText()).includes("등록 가능"), "SNAPSHOT_INVALIDATES_READY_PROOF_AND_LABEL");
  await apply.evaluate(el => el.click());
  check((await read()).applies === appliedCount, "STALE_READY_CLICK_RPC_ZERO");
  for (const interruption of ["snapshot", "cancel"]) {
    await start({}, double); await configure({ hold: "apply" }); await confirm(apply); await waiting();
    if (interruption === "snapshot") await refresh(); else await modal.locator("[data-excel-cancel]").click();
    await release(); await idle(); result = await read();
    check(result.phase === "paused" && result.applied === 1 && result.pending === 1 && result.applies === 1 && result.message.includes("확인된 등록 1단위"), "PARTIAL_INTERRUPTION_STOPS_UNSENT_PRESERVES_CONFIRMED");
    if (interruption === "snapshot") {
      check(!result.canResume && await modal.locator("[data-excel-retry]").isVisible(), "PARTIAL_STALE_REQUIRES_EXPLICIT_NEW_PREVIEW");
      await apply.evaluate(el => el.click());
      check((await read()).applies === 1, "PARTIAL_STALE_NO_OLD_PLAN_RETRY");
    } else check(result.message.includes("미전송분을 중단"), "USER_CANCEL_REMAINS_EXPLICIT");
  }
  for (const failure of ["failed", "unknown", "all-hold"]) {
    diagnostic.caseLabel = failure;
    await start(failure === "all-hold" ? { states: { 1: "HOLD" } } : {});
    if (failure !== "all-hold") {
      await configure({ failedWrite: failure === "failed", readbackFailure: failure === "unknown" });
      await confirm(apply); await idle();
    }
    await refresh(); result = await read();
    check(result.phase === "paused" && result.applied === 0 && result.reversed === 0 && !result.canReverse && !/등록 결과 재조회 완료|원복 결과 재조회 완료/.test(result.message), "PENDING_ZERO_NOT_PROOF_FAILED_UNKNOWN_HOLD");
    if (failure === "unknown") {
      check(result.unconfirmed === 1 && result.canResume, "UNKNOWN_STALE_ALLOWS_READBACK_ONLY");
      // 미처리 READY를 다시 받더라도 invalidated plan으로 자동 재전송하지 않는다.
      await configure({ readbackFailure: false, states: {} }); await apply.click(); await idle();
      result = await read();
      check(result.applies === 1 && result.states[0] === "HOLD" && !result.canResume && result.phase === "paused", "UNKNOWN_TO_READY_STALE_WRITE_ZERO");
    }
  }
  // 결과 유실 뒤 authoritative APPLIED 조회는 mutation 없이 완료로 수렴한다.
  await start(); await configure({ readbackFailure: true }); await confirm(apply); await idle(); await refresh();
  await configure({ readbackFailure: false }); await apply.click(); await idle(); result = await read();
  check(result.phase === "done" && result.applied === 1 && result.applies === 1 && !result.canReverse, "UNKNOWN_TO_VERIFIED_APPLIED_READBACK_ONLY");
  for (const interrupt of ["cancel", "snapshot"]) for (const response of ["resolve", "reject"]) {
    await start({ hold: "preview" }); await waiting();
    if (interrupt === "cancel") await modal.locator("[data-excel-cancel]").click(); else await refresh();
    if (response === "resolve") await release(); else await page.evaluate(() => window.__sheetExecution.reject());
    await idle(); result = await read();
    check(!result.canConfirm && !result.canResume && result.applies === 0 && !["ready", "done", "reversed"].includes(result.phase), "LATE_PREVIEW_CANCEL_INVALIDATION_NEVER_READY");
    check(await modal.locator("[data-excel-retry]").isVisible() && await input.evaluate(el => el.files.length) === 1, "LATE_PREVIEW_FILE_RETRY_PRESERVED");
    await modal.locator("[data-excel-retry]").click();
    await page.waitForFunction(() => window.__sheetExecution.controller?.view().phase === "ready");
    check((await read()).applies === 0, "LATE_PREVIEW_MANUAL_RECHECK_NO_AUTO_WRITE");
  }
  for (const kind of ["branch", "environment"]) {
    await start(); await configure({ hold: "apply" }); await confirm(apply); await waiting();
    await page.evaluate(kind => {
      window.__savedBranch = window.__sheetExecution.branch;
      if (kind === "branch") window.__sheetExecution.branch = "22222222-2222-4222-8222-222222222222";
      else window.TENNISNOTE_CONFIG.environment = "production";
    }, kind);
    await refresh(); await release(); await idle(); result = await read();
    if (result.applied !== 0 || result.unconfirmed !== 1 || result.canResume || result.canReverse || result.canConfirm) process.stdout.write(`SCOPE DIAGNOSTIC ${engine} ${kind} ${JSON.stringify(result)}\n`);
    check(result.applied === 0 && result.unconfirmed === 1 && !result.canResume && !result.canReverse && !result.canConfirm, "SCOPE_CHANGE_NO_CROSS_SCOPE_RECEIPT_SUCCESS");
    await page.evaluate(() => { window.__sheetExecution.branch = window.__savedBranch; window.TENNISNOTE_CONFIG.environment = "development"; });
  }
  process.stdout.write(`PASS ${engine} completion-refresh actual entry; last-response/partial/cancel/UNKNOWN/scope/late-preview; 16 viewport-theme states; real network=0\n`);
}
async function holdPlanUiScenario(page, modal, engine) {
  diagnosticStep(engine, "HOLD", "INITIAL");
  // Actual entry -> Worker -> scoped mock -> adapter -> batch -> DOM. No live RPC.
  const wb = XLSX.read(workbookBytes("valid"), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[parser.SHEET], { header: 1 });
  rows.push([...rows[1]]); rows[2][1] = "01000000002";
  wb.Sheets[parser.SHEET] = XLSX.utils.aoa_to_sheet(rows);
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
  const file = { name: "synthetic-hold.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer };
  const hold = reason => ({ status: "HOLD", reason, verified: false, newMembers: null, newTickets: null, newLessons: null });
  const unknownRows = [hold("SHEET_COACH_AMBIGUOUS"), hold("SHEET_EXISTING_TICKET_REVIEW")];
  const summary = () => modal.locator(".tn-excel-summary").evaluate(el => Object.fromEntries([...el.children].map(pair => [pair.querySelector("dt").textContent, pair.querySelector("dd").textContent])));
  let layouts = 0;
  for (const kind of ["hold", "mixed", "zero"]) {
    diagnostic.phase = ({ hold: "HOLD_READY", mixed: "MIXED_READY", zero: "ZERO_READY" })[kind];
    const units = structuredClone(unknownRows);
    if (kind === "mixed") units[0] = { status: "READY", verified: false, newMembers: 1, newTickets: 1, newLessons: 0 };
    if (kind === "zero") for (const unit of units) Object.assign(unit, { newMembers: 0, newTickets: 0, newLessons: 0 });
    await page.evaluate(units => { window.__sheetExecution.failure = ""; window.__sheetExecution.uxUnits = units; }, units);
    await modal.locator("[data-excel-file]").setInputFiles(file);
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "ready");
    const totals = await summary(), text = await modal.locator(".tn-excel-rows").innerText();
    const expected = kind === "hold" ? "미확정 (2단위)" : kind === "mixed" ? "확정 1 · 1단위 미확정" : "0";
    check(totals["신규 회원 계획"] === expected && totals["신규 회원권 계획"] === expected, "HOLD_UI_NULL_ZERO_MIXED_SUMMARY");
    check(totals["예정 수업"] === (kind === "hold" ? expected : kind === "mixed" ? "확정 0 · 1단위 미확정" : "0"), "KNOWN_ZERO_LESSONS_NOT_UNKNOWN");
    check(text.includes(kind === "zero" ? "새 회원 0 · 회원권 0 · 수업 0" : "새 회원 미확정 · 회원권 미확정 · 수업 미확정"), "HOLD_ROW_PLAN_NULL_PRESERVED");
    check(text.includes("등록 목적과 대상") && !/손상|갱신합니다/.test(text), "EXISTING_TICKET_HOLD_NOT_CORRUPTION_OR_RENEWAL");
    if (kind !== "mixed") check(text.includes("코치를 한 명으로 확정") && text.includes("표시명"), "COACH_REASON_EXACT_GUIDANCE");
    check((await modal.locator("[data-excel-apply]").isDisabled()) === (kind !== "mixed"), "HOLD_NOT_APPLY_PERMISSION");
    if (kind !== "zero") for (const [width, height] of [[390,844], [768,1024], [1366,900], [844,390]]) for (const theme of ["light", "dark"]) {
      diagnostic.phase = "HOLD_LAYOUT";
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await modal.locator("[data-excel-apply]").scrollIntoViewIfNeeded();
      const m = await modal.evaluate(el => {
        const panel = el.querySelector(".tn-excel-panel"), p = panel.getBoundingClientRect(), b = el.querySelector("[data-excel-apply]").getBoundingClientRect();
        return { overflow: panel.scrollWidth > panel.clientWidth + 1,
          inside: p.left >= 0 && p.right <= innerWidth + 1 && p.top >= 0 && p.bottom <= innerHeight + 1,
          visible: Math.min(b.bottom,p.bottom,innerHeight) - Math.max(b.top,p.top,0),
          font: parseFloat(getComputedStyle(el.querySelector("input")).fontSize),
          rowsOverflow: [...el.querySelectorAll(".tn-excel-rows li,.tn-excel-summary dd")].some(row => row.scrollWidth > row.clientWidth + 1) };
      });
      check(!m.overflow && !m.rowsOverflow && m.inside && m.visible >= 44 && m.font >= 16, "HOLD_LONG_GUIDANCE_RESPONSIVE_TOUCH_FOCUS");
      layouts++;
      if (process.env.TENNISNOTE_EXCEL_CAPTURE_DIR && height > 390) {
        const dir = path.resolve(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR); fs.mkdirSync(dir, { recursive: true });
        await modal.locator(".tn-excel-panel").evaluate(el => { el.scrollTop = 0; });
        await modal.locator(".tn-excel-panel").screenshot({ path: path.join(dir, `${engine}-${kind}-${width}-${theme}.png`) });
      }
    }
    // Existing snapshot-change event stops a not-yet-applied plan. No new route.
    diagnostic.phase = "HOLD_SNAPSHOT";
    await page.evaluate(() => dispatchEvent(new Event("tennisnote:excel-snapshot-changed")));
    check((await modal.locator("[data-excel-status]").innerText()).includes("등록은 실행하지 않았습니다") && await modal.locator("[data-excel-apply]").isDisabled(), "PRE_APPLY_CANCEL_UI_TRUTHFUL");
    check(await modal.locator("[data-excel-retry]").isVisible() && await modal.locator("[data-excel-file]").evaluate(el => el.files.length) === 1, "CANCEL_FILE_PRESERVED_EXPLICIT_RECHECK");
    check(await page.evaluate(() => window.__sheetExecution.applies === 0 && window.__sheetExecution.reverses === 0), "ALL_HOLD_CANCEL_REAL_APPLY_ZERO");
  }
  diagnostic.phase = "HOLD_EXPIRY";
  await page.evaluate(units => { window.__sheetExecution.uxUnits = units; window.__sheetExecution.failure = "expires"; }, unknownRows);
  await modal.locator("[data-excel-retry]").click();
  await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "expired");
  check((await modal.locator("[data-excel-status]").innerText()).includes("등록은 실행하지 않았습니다"), "HOLD_EXPIRY_NO_FAKE_SUCCESS");
  check((await summary())["신규 회원권 계획"] === "미확정 (2단위)" && await modal.locator("[data-excel-apply]").isDisabled(), "HOLD_EXPIRY_UNKNOWN_PRESERVED_DISABLED");
  await page.evaluate(() => { delete window.__sheetExecution.uxUnits; window.__sheetExecution.failure = ""; });
  diagnostic.phase = "HOLD_INFLIGHT_CANCEL";
  await page.evaluate(() => { window.__sheetExecution.holdPreview = true; });
  await modal.locator("[data-excel-file]").setInputFiles({ ...file, buffer: workbookBytes("valid") });
  await page.waitForFunction(() => typeof window.__sheetExecution.releasePreview === "function");
  await modal.locator("[data-excel-cancel]").click();
  await page.evaluate(() => { window.__sheetExecution.releasePreview(); delete window.__sheetExecution.releasePreview; });
  await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase === "paused");
  check(await modal.locator("[data-excel-apply]").isDisabled() && (await modal.locator("[data-excel-status]").innerText()).includes("등록은 실행하지 않았습니다"), "INFLIGHT_PREVIEW_CANCEL_DOES_NOT_REENABLE_APPLY");
  diagnostic.phase = "HOLD_MANUAL_RECHECK";
  await modal.locator("[data-excel-retry]").click();
  await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "ready");
  check(await page.evaluate(() => window.__sheetExecution.applies === 0), "INFLIGHT_CANCEL_MANUAL_RECHECK_NO_AUTO_APPLY");
  await page.setViewportSize({ width: 390, height: 844 });
  process.stdout.write(`PASS ${engine} HOLD null/zero/mixed/cancel/expiry actual-entry UI; ${layouts} layouts; mock apply/reverse=0\n`);
  scenarioPassed(engine, "HOLD");
}
async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const engines = process.env.TENNISNOTE_BROWSER ? [process.env.TENNISNOTE_BROWSER] : ["chromium", "webkit"];
  for (const engine of engines) {
    const engineStartAssertions = assertions;
    completedScenarios.set(engine, []);
    diagnosticStep(engine, "ACTUAL_ENTRY", "INITIAL");
    check(["chromium", "webkit"].includes(engine), "SUPPORTED_ENGINE");
    const executablePath = engine === "chromium" ? [process.env.CHROME_PATH, chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(p => p && fs.existsSync(p)) : undefined;
    const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    try {
      if (process.env.TENNISNOTE_EXCEL_COMPLETION_ONLY === "1") { await remoteExecutionScenario(browser, engine); continue; }
      if (process.env.TENNISNOTE_EXCEL_INITIAL_ONLY === "1") { await remoteExecutionScenario(browser, engine); continue; }
      if (process.env.TENNISNOTE_EXCEL_READINESS_ONLY === "1") { await remoteExecutionScenario(browser, engine); await remoteExecutionScenario(browser, engine, false); continue; }
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", acceptDownloads: true });
      const page = await context.newPage();
      const pageErrors = [], relevantConsole = []; let writeRequests = 0, externalRequests = 0;
      page.on("pageerror", () => pageErrors.push("PAGE_ERROR"));
      page.on("console", msg => { if (msg.type() === "error" && /single-sheet|ExcelPreview/i.test(msg.text())) relevantConsole.push("PREVIEW_CONSOLE_ERROR"); });
      page.on("request", req => { if (req.method() !== "GET") writeRequests++; if (!req.url().startsWith(origin)) externalRequests++; });
      await context.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.addInitScript(() => {
        window.__previewProbe = { workers: 0, messages: 0, terminated: 0, snapshots: 0, unsafeResult: false };
        const W = window.Worker;
        window.__previewRealWorker = class extends W {
          constructor(...args) {
            super(...args); window.__previewProbe.workers++;
            this.addEventListener("message", event => {
              window.__previewProbe.messages++;
              window.__previewProbe.lastType = event.data.type;
              window.__previewProbe.lastCode = event.data.code || null;
              window.__previewProbe.lastStage = event.data.stage || null;
              window.__previewProbe.snapshotCodes = event.data.result?.snapshotErrors || [];
              window.__previewProbe.parseCodes = event.data.result?.errors || [];
              const output = JSON.stringify(event.data);
              if (/synthetic-(branch|coach|product)|합성회원|합성코치|010\d{8}|operationKey|fileHash/.test(output)) window.__previewProbe.unsafeResult = true;
            });
          }
          terminate() { window.__previewProbe.terminated++; return super.terminate(); }
        };
        window.Worker = window.__previewRealWorker;
      });
      await page.goto(origin + "/app/admin/index.html?demoAdmin=1", { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#openSingleSheetPreviewButton")?.dataset.excelBound === "true");
      await page.evaluate(() => setView("members"));
      const trigger = page.locator("#openSingleSheetPreviewButton"), modal = page.locator("#singleSheetPreviewModal"), status = modal.locator("[data-excel-status]"), input = modal.locator("[data-excel-file]");
      const open = async () => { await trigger.click(); await modal.waitFor({ state: "visible" }); };
      const close = async () => { await modal.locator("[data-excel-close]").click(); await modal.waitFor({ state: "hidden" }); await page.waitForFunction(() => !history.state?.tnExcelPreview); };
      const select = async kind => input.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes(kind) });
      const waitResult = () => page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal .tn-excel-summary") || !document.querySelector("#singleSheetPreviewModal [data-excel-retry]").hidden);
      const setSnapshot = async mode => page.evaluate(({ p, e, mode }) => {
        if (!window.__snapshotAdapter) window.__snapshotAdapter = window.TennisNoteSingleSheetSnapshot;
        window.TennisNoteSingleSheetSnapshot = { ...window.__snapshotAdapter, adapt(...args) {
          window.__previewProbe.snapshots++;
          if (mode === "reject") throw Error("SYNTHETIC_READ_ERROR");
          if (mode === "pending") return new Promise(() => {});
          if (mode === "incomplete") return window.__snapshotAdapter.adapt(...args);
          if (mode === "stale") p.proof.expiresAt = new Date(Date.now() - 1).toISOString();
          if (mode === "expires") p.proof.expiresAt = new Date(Date.now() + 2500).toISOString();
          const result = window.__snapshotAdapter.adapt(p, e, new Date().toISOString());
          if (mode === "malformed") result.context.expected = { ...result.context.expected, revision: "different-synthetic-revision" };
          return result;
        } };
      }, { p: packet(), e: expected, mode });
      await open();
      check(await modal.locator('input[type="file"]').count() === 1
        && await modal.locator("[data-excel-apply]:disabled").count() === 1
        && await modal.locator("[data-excel-reverse]:visible").count() === 0, "ONE_INPUT_DISABLED_APPLY");
      check((await status.textContent()).includes("파일을 선택"), "EMPTY_STATE");
      const [templateDownload] = await Promise.all([
        page.waitForEvent("download"),
        modal.locator("[data-excel-template]").click(),
      ]);
      const templatePath = await templateDownload.path();
      const templateBytes = new Uint8Array(fs.readFileSync(templatePath));
      const templateResult = await parser.readFile(templateBytes, XLSX);
      check(templateDownload.suggestedFilename() === parser.TEMPLATE_FILE_NAME, "TEMPLATE_DOWNLOAD_NAME");
      check(templateBytes.byteLength > 0 && templateResult.errors.length === 1 && templateResult.errors[0] === "EMPTY_DATA" && templateResult.rows.length === 0, "TEMPLATE_DOWNLOAD_ROUNDTRIP");
      check((await status.textContent()).includes("앞자리 0"), "TEMPLATE_PHONE_GUIDANCE");
      await select("valid"); await waitResult();
      check((await status.textContent()).includes("보류") && (await modal.innerText()).includes("미확정"), "ACTUAL_ROSTER_HOLD");
      check(await page.evaluate(() => !window.__previewProbe.unsafeResult), "REAL_WORKER_SAFE_MESSAGE");
      await close();
      await page.evaluate(() => { window.__originalOperationsRole = operationsRole; operationsRole = () => "coach"; });
      await trigger.click(); check(await modal.isHidden(), "NON_ADMIN_ENTRY_DENIED");
      await page.evaluate(() => { operationsRole = window.__originalOperationsRole; });
      await setSnapshot("good"); await open(); await select("slot"); await waitResult();
      check((await status.textContent()).includes("미리보기 완료"), "ACTUAL_ENTRY_COMPLETE_MOCK");
      check(await modal.locator(".tn-excel-summary div").filter({ hasText: "예정 수업" }).locator("dd").textContent() === "5", "FIVE_LESSON_PREVIEW");
      check(await modal.locator(".tn-excel-summary div").filter({ hasText: "신규 회원권" }).locator("dd").textContent() === "1", "ONE_TICKET_CANDIDATE");
      await page.evaluate(() => dispatchEvent(new Event("tennisnote:excel-snapshot-changed")));
      check((await status.textContent()).includes("오래됐") && await modal.locator(".tn-excel-summary").count() === 0, "REVISION_INVALIDATES_PREVIEW");
      await close();
      for (const [kind, text] of [["empty", "입력된 행이 없습니다"], ["group", "그룹"], ["long", "특수 입력"]]) {
        await open(); await select(kind); await waitResult(); check((await modal.innerText()).includes(text), "ROW_ERROR_STATE");
        check(await modal.locator("[data-excel-results] img, [data-excel-results] script").count() === 0, "SAFE_TEXT_RENDER"); await close();
      }
      await open(); await input.setInputFiles({ name: "oversize.xlsx", mimeType: "application/octet-stream", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
      check((await status.textContent()).includes("5MB"), "FILE_LIMIT");
      await input.setInputFiles({ name: "wrong.csv", mimeType: "text/csv", buffer: Buffer.from("synthetic") });
      check((await status.textContent()).includes("XLSX"), "FILE_TYPE");
      await input.setInputFiles({ name: "corrupt.xlsx", mimeType: "application/octet-stream", buffer: Buffer.alloc(30) }); await waitResult();
      check((await status.textContent()).includes("XLSX"), "CORRUPT_ZIP"); await close();
      for (const [mode, text] of [["reject", "가져오지"], ["stale", "오래됐"]]) {
        await setSnapshot(mode); await open(); await select("valid"); await waitResult(); check((await modal.innerText()).includes(text), "SNAPSHOT_ERROR");
        await setSnapshot("good"); await modal.locator("[data-excel-retry]").click(); await page.waitForFunction(() => document.querySelector("[data-excel-status]").textContent.includes("미리보기 완료"));
        check(await input.evaluate(el => el.files.length) === 1, "RETRY_FILE_PRESERVED"); await close();
      }
      await setSnapshot("malformed"); await open(); await select("valid"); await waitResult();
      check((await modal.innerText()).includes("미확정") && await modal.locator(".tn-excel-summary div").filter({ hasText: "전체 행" }).locator("dd").textContent() === "1", "WORKER_CONTEXT_HOLD_PRESERVES_ROW_COUNT"); await close();
      await setSnapshot("expires"); await open(); await select("valid"); await waitResult();
      await page.waitForFunction(() => document.querySelector("[data-excel-status]").textContent.includes("오래됐"));
      check(await modal.locator(".tn-excel-summary").count() === 0, "EXPIRED_RESULT_CLEARED"); await close();
      await setSnapshot("pending"); await open(); await select("valid");
      check((await status.textContent()).includes("확인하고"), "LOADING_STATE"); await modal.locator("[data-excel-cancel]").click();
      check((await status.textContent()).includes("취소"), "CANCEL_STATE");
      await setSnapshot("good"); await select("valid"); await waitResult(); check((await status.textContent()).includes("완료"), "RESELECT_AFTER_CANCEL"); await close();
      // A stalled Worker proves termination/cancellation and hard deadline; no sync fallback.
      await page.evaluate(() => { window.Worker = class { postMessage() {} terminate() { window.__previewProbe.terminated++; } }; });
      await open(); await select("valid"); await modal.locator("[data-excel-cancel]").click();
      check((await status.textContent()).includes("취소"), "WORKER_TERMINATED_CANCEL");
      await modal.locator("[data-excel-retry]").click();
      await page.waitForFunction(() => document.querySelector("[data-excel-status]").textContent.includes("시간이 초과"), null, { timeout: 15000 });
      check(await modal.locator(".tn-excel-summary").count() === 0, "TIMEOUT_NO_RESULT"); await close();
      await page.evaluate(() => { window.Worker = undefined; }); await open(); await select("valid");
      check((await status.textContent()).includes("안전한 파일 처리"), "WORKER_UNSUPPORTED_NO_FALLBACK"); await close();
      await page.evaluate(() => { window.Worker = window.__previewRealWorker; });
      await open(); await select("valid"); await waitResult(); await context.setOffline(true);
      await page.waitForFunction(() => document.querySelector("[data-excel-status]").textContent.includes("오프라인"));
      check((await status.textContent()).includes("오프라인") && await modal.locator(".tn-excel-summary").count() === 0, "OFFLINE_HOLD");
      await modal.locator("[data-excel-retry]").click(); check((await status.textContent()).includes("오프라인"), "OFFLINE_RETRY_NO_PARSE"); await context.setOffline(false);
      await page.keyboard.press("Escape"); await modal.waitFor({ state: "hidden" }); await page.waitForFunction(() => !history.state?.tnExcelPreview);
      await open(); await page.goBack(); await modal.waitFor({ state: "hidden" }); check(await input.evaluate(el => el.files.length) === 0, "BACK_CLEARS_FILE");
      await open(); await modal.click({ position: { x: 2, y: 2 } }); await modal.waitFor({ state: "hidden" }); await page.waitForFunction(() => !history.state?.tnExcelPreview);
      check(await page.evaluate(() => document.activeElement.id === "openSingleSheetPreviewButton"), "FOCUS_RETURN");
      const metrics = [];
      for (const [width, height] of [[390, 844], [768, 1024], [1366, 900], [320, 568], [667, 375], [390, 350]]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await open(); await select("group"); await waitResult();
        await modal.locator("[data-excel-apply]").scrollIntoViewIfNeeded();
        const m = await modal.evaluate(el => {
          const panel = el.querySelector(".tn-excel-panel"), controls = [...el.querySelectorAll("button,input")].filter(c => !c.hidden);
          const button = el.querySelector("[data-excel-apply]"), r = button.getBoundingClientRect(), p = panel.getBoundingClientRect();
          return { overflow: panel.scrollWidth > panel.clientWidth + 1, panelInside: p.left >= 0 && p.right <= innerWidth + 1 && p.top >= 0 && p.bottom <= innerHeight + 1,
            minTouch: Math.min(...controls.map(c => c.getBoundingClientRect().height)), font: parseFloat(getComputedStyle(el.querySelector("input")).fontSize), color: getComputedStyle(button).backgroundColor, panelColor: getComputedStyle(panel).backgroundColor,
            visibleHeight: Math.max(0, Math.min(r.bottom, p.bottom, innerHeight) - Math.max(r.top, p.top, 0)), disabled: button.disabled && button.getAttribute("aria-disabled") === "true" };
        });
        check(!m.overflow && m.panelInside, "PREVIEW_GEOMETRY"); check(m.minTouch >= 44 && m.font >= 16, "TOUCH_FOCUS_SIZE"); check(m.visibleHeight >= 44 && m.disabled, "DISABLED_CTA_VISIBLE");
        check(["rgb(229, 231, 235)", "rgb(55, 65, 81)"].includes(m.color), "NEUTRAL_DISABLED");
        check(m.panelColor === (theme === "dark" ? "rgb(23, 32, 51)" : "rgb(255, 255, 255)"), "DIALOG_THEME");
        metrics.push({ width, height, theme, ...m });
        if (process.env.TENNISNOTE_EXCEL_CAPTURE_DIR && [390, 768, 1366].includes(width) && height >= 800) {
          const dir = path.resolve(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR); fs.mkdirSync(dir, { recursive: true });
          await modal.locator(".tn-excel-panel").evaluate(el => { el.scrollTop = 0; });
          await modal.locator(".tn-excel-panel").screenshot({ path: path.join(dir, `${engine}-${width}-${theme}.png`) });
          if (width === 390) { await modal.locator("[data-excel-apply]").scrollIntoViewIfNeeded(); await modal.locator(".tn-excel-panel").screenshot({ path: path.join(dir, `${engine}-${width}-${theme}-footer.png`) }); }
        }
        await close();
      }
      const probe = await page.evaluate(() => window.__previewProbe);
      check(probe.snapshots > 0 && probe.workers > 0 && probe.messages > 0 && !probe.unsafeResult, "ACTUAL_MODULE_WORKER_COVERAGE");
      check(writeRequests === 0 && externalRequests === 0, "NETWORK_WRITE_ZERO");
      check(pageErrors.length === 0 && relevantConsole.length === 0, "PAGE_PREVIEW_ERRORS_ZERO");
      process.stdout.write(`PASS ${engine} actual-entry/worker/states; ${metrics.length} viewport-theme cases; minTouch=${Math.min(...metrics.map(m => m.minTouch))}; minVisibleCTA=${Math.min(...metrics.map(m => m.visibleHeight))}; writes=0; external=0; pageErrors=0\n`);
      await context.close();
      scenarioPassed(engine, "ACTUAL_ENTRY");
      await remotePreviewScenario(browser, engine);
      scenarioPassed(engine, "REMOTE_PREVIEW");
      await remoteExecutionScenario(browser, engine);
      scenarioPassed(engine, "REMOTE_EXECUTION");
      await remoteExecutionScenario(browser, engine, false);
      scenarioPassed(engine, "PRODUCTION_APPLY_ONLY");
      await remoteExecutionScenario(browser, engine, true, true);
      scenarioPassed(engine, "COMPLETION");
      await remoteExecutionScenario(browser, engine, true, false, true);
      scenarioPassed(engine, "INITIAL_ENVELOPE");
    } finally { await browser.close(); }
    process.stdout.write(`TN_EXCEL_ENGINE_RESULT ${JSON.stringify({engine, assertions: assertions-engineStartAssertions, scenarios: completedScenarios.get(engine)})}\n`);
  }
  process.stdout.write(`Single sheet preview browser: ${assertions} assertions PASS\n`);
}
main().catch(error => {
  process.stderr.write(`FAIL code=${/^[A-Z_0-9]+$/.test(error.testCode || "") ? error.testCode : "BROWSER_OPERATION_FAILED"}\n`);
  process.stderr.write(`BROWSER_FAILURE_DIAGNOSTIC ${JSON.stringify(safeFailureDiagnostic(error))}\n`);
  process.exitCode = 1;
}).finally(() => server.close());
