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
const check = (ok, code) => { assertions++; if (!ok) throw Error(code); };
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname.endsWith("config.local.js")) { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end("window.TENNISNOTE_CONFIG={};"); return; }
  const target = path.resolve(root, "." + pathname);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(target).pipe(res);
});
async function remotePreviewScenario(browser, engine) {
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
    await route.fulfill({ status: 200, contentType: types[path.extname(target)] || "application/octet-stream", path: target, headers: { "Cache-Control": "no-store" } });
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
async function remoteExecutionScenario(browser, engine, reverseEnabled = true) {
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
    await route.fulfill({ status: 200, contentType: types[path.extname(target)] || "application/octet-stream", path: target, headers: { "Cache-Control": "no-store" } });
  });
  try {
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
        const failure = window.__sheetExecution.failure;
        if (failure === "scope") throw { status: 403, code: "42501", message: "SHEET_SCOPE_OFF_OR_MISMATCH", details: "RAW_SERVER_DETAIL" };
        if (failure === "timeout") throw { code: "server_request_timeout" };
        if (failure === "unknown") throw Error("RAW_SERVER_DETAIL<script>untrusted</script>");
        const applied = window.__sheetExecution.state !== "READY";
        const units = parameters.units.map(unit => ({
          status: window.__sheetExecution.state, unitHash, planHash, revision, verified: applied,
          reversible: window.__sheetExecution.state === "APPLIED",
          rowCount: unit.rows.length, newMembers: applied ? 0 : unit.rows.length, newTickets: applied ? 0 : 1, newLessons: 0,
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
    await page.locator("#openSingleSheetPreviewButton").click();
    const fileInput = modal.locator("[data-excel-file]");
    await page.waitForFunction(() => document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness === "awaiting-preview");
    check((await modal.locator("[data-excel-boundary]").innerText()).includes("서버 사용 범위는 미확인"), "INITIAL_LOCAL_READY_NOT_SERVER_PERMISSION");
    check(!/기능이 연결되기 전|현재는 읽기 전용/.test(await modal.innerText()) && await modal.locator("[data-excel-apply]").isDisabled(), "NO_STALE_INITIAL_READONLY_CLAIM");
    check(await page.evaluate(() => window.__sheetExecution.args.length) === 0, "OPEN_READINESS_RPC_ZERO");
    check((await modal.locator("[data-excel-boundary]").innerText()).includes("원복은 비활성") === !reverseEnabled, "READINESS_RESPECTS_REVERSE_CAPABILITY");
    await page.evaluate(()=>{window.__sheetExecution.prepareFailure=true;});
    await fileInput.setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes("valid") });
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelFailureCode==="SHEET_WORK_RUNTIME_UNAVAILABLE");
    check(await page.evaluate(()=>window.__sheetExecution.previews===0&&window.__sheetExecution.applies===0),"MISSING_RUNTIME_PREVIEW_WRITE_ZERO");
    await page.evaluate(()=>{window.__sheetExecution.prepareFailure=false;window.__sheetExecution.prepareResponseLost=true;});
    await modal.locator("[data-excel-retry]").click();
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelFailureCode==="SHEET_WORK_SESSION_FAILED");
    check(await page.evaluate(()=>Object.keys(window.__sheetExecution.prepareProofs).length===1&&window.__sheetExecution.previews===0),"PREPARE_RESPONSE_LOSS_NO_AUTO_PREVIEW_OR_RETRY");
    await page.evaluate(()=>{const button=document.querySelector("[data-excel-retry]");button.click();button.click();});
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.excelReadiness==="ready");
    check(await page.evaluate(()=>window.__sheetExecution.prepareCalls===3&&window.__sheetExecution.prepareReplay===1&&Object.keys(window.__sheetExecution.prepareProofs).length===1),"MANUAL_PREPARE_REPLAY_ONE_SESSION_DOUBLE_CLICK_ZERO");
    check(await page.evaluate(()=>window.__sheetExecution.args.filter(c=>c.name==="tn_prepare_single_sheet_work_session").every(c=>c.keys.join('|')==="operation_key|scope")),"UI_NO_ACTOR_TTL_SELF_GRANT_PAYLOAD");
    await page.evaluate(()=>{window.__sheetExecution.previews=0;});
    let expectedPreviews = 0;
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
  } finally { await context.close(); }
}
async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const engines = process.env.TENNISNOTE_BROWSER ? [process.env.TENNISNOTE_BROWSER] : ["chromium", "webkit"];
  for (const engine of engines) {
    check(["chromium", "webkit"].includes(engine), "SUPPORTED_ENGINE");
    const executablePath = engine === "chromium" ? [process.env.CHROME_PATH, chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(p => p && fs.existsSync(p)) : undefined;
    const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    try {
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
      await remotePreviewScenario(browser, engine);
      await remoteExecutionScenario(browser, engine);
      await remoteExecutionScenario(browser, engine, false);
    } finally { await browser.close(); }
  }
  process.stdout.write(`Single sheet preview browser: ${assertions} assertions PASS\n`);
}
main().catch(error => { process.stderr.write(`FAIL code=${/^[A-Z_0-9]+$/.test(error.message) ? error.message : "BROWSER_OPERATION_FAILED"}\n`); if (process.env.TENNISNOTE_EXCEL_DEBUG === "1") process.stderr.write(String(error.stack).replace(/synthetic[^\s]*/g, "fixture") + "\n"); process.exitCode = 1; }).finally(() => server.close());
