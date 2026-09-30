/* Actual shared UI/generator, synthetic scoped read only, no external requests. */
"use strict";
const fs = require("node:fs"), path = require("node:path");
const { chromium, webkit } = require("playwright");
const { snapshot } = require("./check_tennisnote_single_sheet_products.cjs");
const ROOT = path.resolve(__dirname, "../app/shared");
async function run({ diagnosticOnly = false } = {}) {
  let assertions = 0;
  const check = (v, code) => { assertions++; if (!v) throw Error(code); };
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      let external = 0, errors = 0;
      page.on("pageerror", () => errors++);
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.href === "http://127.0.0.1:17321/") return route.fulfill({ contentType: "text/html; charset=utf-8", body: '<html lang="ko"><head><meta charset="utf-8"></head><body><button id="open">엑셀 등록</button></body></html>' });
        if (url.href === "http://127.0.0.1:17321/admin.css") return route.fulfill({ contentType: "text/css; charset=utf-8", body: fs.readFileSync(path.resolve(ROOT, "../admin/styles.css")) });
        const files = ["tennisnote-single-sheet-import.js", "tennisnote-single-sheet-preview-ui.js", "vendor/xlsx.full.min.js", "tennisnote-ui-foundation.css"];
        if (url.origin !== "http://127.0.0.1:17321" || !files.includes(url.pathname.slice(1))) { external++; return route.abort(); }
        return route.fulfill({ contentType: url.pathname.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8", body: fs.readFileSync(path.join(ROOT, url.pathname.slice(1))) });
      });
      await page.goto("http://127.0.0.1:17321/");
      await page.addStyleTag({ url: "http://127.0.0.1:17321/admin.css" });
      await page.addStyleTag({ url: "http://127.0.0.1:17321/tennisnote-ui-foundation.css" });
      for (const file of ["vendor/xlsx.full.min.js", "tennisnote-single-sheet-import.js", "tennisnote-single-sheet-preview-ui.js"]) await page.addScriptTag({ url: `http://127.0.0.1:17321/${file}` });
      await page.evaluate(s => {
        const state = window.__catalog = { s, downloads: 0, reads: 0, ready: true, allowed: true, mode: "ok", held: null, bytes: null };
        const original = URL.createObjectURL;
        URL.createObjectURL = blob => { state.downloads++; blob.arrayBuffer().then(b => { state.bytes = new Uint8Array(b); }); return original(blob); };
        window.TennisNoteExcelPreviewUI.bind({ button: document.getElementById("open"), canOpen: () => state.allowed, getPreviewTransport: async () => ({
          enabled: true, isReady: () => state.ready, templateProducts: async () => { state.reads++; if (state.mode === "error") throw Error("RAW_PRIVATE_ERROR"); if (state.mode === "hold") await new Promise(resolve => { state.held = resolve; }); return state.s; },
        }) });
      }, snapshot());
      if (diagnosticOnly) await page.evaluate(() => {
        const original = TennisNoteSingleSheetImport;
        window.TennisNoteSingleSheetImport = { ...original,
          buildProductTemplateBytes(...args) { __catalog.phase = "BUILD"; try { return original.buildProductTemplateBytes(...args); } catch (e) { __catalog.error = /^[A-Z0-9_]+$/.test(e.message) ? e.message : e.name; throw e; } },
          async readFile(...args) { __catalog.phase = "READ"; try { const r = await original.readFile(...args); __catalog.codes = r.errors; return r; } catch(e) { __catalog.error = /^[A-Z0-9_]+$/.test(e.message) ? e.message : e.name; throw e; } },
        };
      });
      const modal = page.locator("#singleSheetPreviewModal"), button = modal.locator("[data-excel-template]");
      await page.locator("#open").click();
      await button.click();
      if (diagnosticOnly) {
        await page.waitForFunction(() => !document.querySelector("[data-excel-template]").disabled);
        const state = await page.evaluate(() => ({ phase: __catalog.phase, error: __catalog.error, codes: __catalog.codes, secure: isSecureContext, reads: __catalog.reads, downloads: __catalog.downloads, bytesReady: Boolean(__catalog.bytes), status: document.querySelector("[data-excel-status]").textContent.includes("다운로드 완료") ? "DONE" : "OTHER" }));
        process.stdout.write(`CATALOG_DIAGNOSTIC ${JSON.stringify({ engine, ...state, errors, external })}\n`);
        return 0;
      }
      await page.waitForFunction(() => window.__catalog.bytes && document.querySelector("[data-excel-status]").textContent.includes("다운로드 완료"));
      check(await page.evaluate(async () => { const r = await TennisNoteSingleSheetImport.readFile(__catalog.bytes, XLSX); return r.errors.join() === "EMPTY_DATA" && __catalog.downloads === 1 && __catalog.reads === 1; }), "REAL_BROWSER_XLSX_REIMPORT");
      await page.evaluate(() => { __catalog.s.products.push({ ...__catalog.s.products[0], id: "duplicate" }); });
      await button.click(); await page.waitForFunction(() => !document.querySelector("[data-excel-template]").disabled);
      check(await page.evaluate(() => __catalog.downloads === 1 && document.querySelector("[data-excel-status]").textContent.includes("같은 이름")), "DUPLICATE_NO_DOWNLOAD");
      for (const [width, height] of [[390, 900], [768, 900], [1366, 900], [844, 390]]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await button.scrollIntoViewIfNeeded();
        const metrics = await button.evaluate(el => { const r = el.getBoundingClientRect(); return { touch: r.height, visible: Math.min(innerHeight, r.bottom) - Math.max(0, r.top), font: parseFloat(getComputedStyle(document.querySelector('[data-excel-file]')).fontSize), overflow: document.documentElement.scrollWidth > innerWidth, enabled: !el.disabled }; });
        check(metrics.touch >= 44 && metrics.visible >= 44 && metrics.font >= 16 && !metrics.overflow && metrics.enabled, "LAYOUT_ERROR_RETRY");
        if (process.env.TENNISNOTE_EXCEL_CAPTURE_DIR) {
          fs.mkdirSync(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR, { recursive: true });
          await modal.screenshot({ path: path.join(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR, `catalog-${engine}-${width}-${theme}.png`) });
        }
      }
      await page.evaluate(() => { __catalog.s.products.pop(); __catalog.mode = "error"; });
      await button.click(); await page.waitForFunction(() => !document.querySelector("[data-excel-template]").disabled);
      check(await page.evaluate(() => __catalog.downloads === 1 && !document.body.textContent.includes("RAW_PRIVATE_ERROR")), "READ_ERROR_PRIVATE");
      await page.evaluate(() => { __catalog.mode = "hold"; });
      const before = await page.evaluate(() => __catalog.reads);
      await button.click(); await page.waitForFunction(() => typeof __catalog.held === "function");
      check(await button.isDisabled(), "BUSY_DISABLED");
      await button.evaluate(el => { el.click(); el.click(); });
      check(await page.evaluate(n => __catalog.reads === n + 1, before), "DOUBLE_CLICK_READ_ONCE");
      await modal.locator("[data-excel-close]").click();
      await page.evaluate(() => __catalog.held()); await page.waitForFunction(() => !document.querySelector("[data-excel-template]").disabled);
      check(await page.evaluate(() => __catalog.downloads === 1), "CLOSE_PENDING_NO_DOWNLOAD");
      await page.waitForFunction(() => !history.state?.tnExcelPreview);
      await page.locator("#open").click();
      await page.evaluate(() => { __catalog.mode = "ok"; __catalog.ready = false; });
      await button.click(); await page.waitForFunction(() => !document.querySelector("[data-excel-template]").disabled);
      check(await page.evaluate(() => __catalog.downloads === 1), "SCOPE_LOSS_NO_DOWNLOAD");
      await page.evaluate(() => { __catalog.ready = true; });
      await button.click(); await page.waitForFunction(() => __catalog.downloads === 2);
      check(await page.evaluate(() => document.querySelector("[data-excel-apply]").disabled), "DOWNLOAD_NEVER_APPLIES");
      check(external === 0 && errors === 0, "NO_EXTERNAL_OR_PAGE_ERROR");
      process.stdout.write(`PASS ${engine} catalog UI; generated XLSX reimport; 8 viewport/theme cases; external=0\n`);
    } finally { await browser.close(); }
  }
  return assertions;
}
if (require.main === module) run({ diagnosticOnly: process.argv.includes("--diagnose") }).then(n => process.stdout.write(n ? `PASS catalog browser ${n} assertions\n` : "DIAGNOSTIC_ONLY_NOT_PASS\n")).catch(e => { process.stderr.write(`FAIL catalog browser ${/^[A-Z0-9_]+$/.test(e.message) ? e.message : e.name}\n`); process.exitCode = 1; });
module.exports = { run };
