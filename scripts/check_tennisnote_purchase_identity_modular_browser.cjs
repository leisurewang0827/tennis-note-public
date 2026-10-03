/* 실제 관리자 entry·폼·submit listener + 합성 transport. 외부 네트워크/DB 호출 금지. */
const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) || pathname.endsWith("config.local.js")) {
    res.setHeader("Content-Type", "application/javascript"); res.end("window.TENNISNOTE_CONFIG={};"); return;
  }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", ({ ".js": "application/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".json": "application/json" })[path.extname(file)] || "application/octet-stream");
    res.end(bytes);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [engineName, engine] of [["chromium", chromium], ["webkit", webkit]]) {
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const browser = await engine.launch({ headless: true, ...(engineName === "chromium" && fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
    let checks = 0;
    const failures = [];
    try {
      for (const [width, height] of [[390, 844], [768, 1024], [1366, 900], [844, 390]]) for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, serviceWorkers: "block" });
        await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.goto(origin + "/app/admin/index.html", { waitUntil: "load" });
        await page.waitForFunction(() => typeof confirmMemberPurchaseIdentity === "function");
        await page.evaluate(theme => {
          document.documentElement.dataset.theme = theme;
          document.body.dataset.theme = theme;
          document.getElementById("operationsLoginGate")?.setAttribute("hidden", "");
          document.getElementById("adminBrandSplash")?.setAttribute("hidden", "");
          activeOperationBranchId = () => "synthetic-branch";
          members.splice(0, members.length, { id: "synthetic-local", serverUserId: "synthetic-member", name: "합성 대상", phone: "" });
          tickets.splice(0, tickets.length, { serverTicketId: "synthetic-ticket" });
          billings.splice(0, billings.length, { serverPaymentId: "synthetic-payment", ticketId: "synthetic-ticket", status: "paid" });
          syncAdminLiveData = loadServerPaymentsIntoBilling = async () => true;
          renderBilling = showToast = reportAdminPaymentGuard = () => {};
          const fixture = window.identityFixture = { mode: "pass", previews: 0, writes: 0, confirms: 0, committed: new Set(), keys: [], helperCalls: 0 };
          const original = confirmMemberPurchaseIdentity;
          confirmMemberPurchaseIdentity = (...args) => { fixture.helperCalls++; return original(...args); };
          window.TennisNoteDataClient.rpc = async (name, args) => {
            if (name === "tn_admin_preview_purchase_identity") {
              fixture.previews++;
              await new Promise(resolve => setTimeout(resolve, 30));
              if (fixture.mode === "branch") activeOperationBranchId = () => "synthetic-other-branch";
              if (fixture.mode === "stale") document.getElementById("onsitePaymentSourceTicket").value = "synthetic-source";
              if (fixture.mode === "back") document.getElementById("onsitePaymentModal").hidden = true;
              if (fixture.mode === "legacy") throw new Error("purchase_identity_client_update_required");
              return { revision: "a".repeat(64), branchId: "synthetic-branch", userId: "synthetic-member", people: [{ providers: ["email"], phoneVerified: false, identityTag: "1".repeat(8) }] };
            }
            if (name !== "tn_admin_record_onsite_payment_with_identity" || args.target_record.identityProof !== "a".repeat(64)) throw new Error("unexpected_fixture_write");
            fixture.writes++; fixture.keys.push(args.target_operation_key); fixture.committed.add(args.target_operation_key);
            if (fixture.mode === "loss") { fixture.mode = "pass"; throw new Error("synthetic_response_loss"); }
            return { ok: true, operationKey: args.target_operation_key, ticketId: "synthetic-ticket", paymentId: "synthetic-payment" };
          };
          window.resetIdentityFixture = mode => {
            fixture.mode = mode; fixture.previews = fixture.writes = fixture.confirms = fixture.helperCalls = 0;
            fixture.keys = []; fixture.committed.clear();
            activeOperationBranchId = () => "synthetic-branch";
            const form = document.getElementById("onsitePaymentForm");
            delete form.dataset.onsitePaymentOperationKey; delete form.dataset.onsitePaymentRequestFingerprint;
            form.reset(); document.getElementById("onsitePaymentModal").hidden = false;
            const fields = { onsitePaymentMember: "synthetic-member", onsitePaymentProduct: "synthetic-product", onsitePaymentCoach: "synthetic-coach", onsitePaymentMethod: "card", onsitePaymentSourceTicket: "" };
            for (const [id, value] of Object.entries(fields)) {
              const field = document.getElementById(id); field.replaceChildren(new Option("합성 검증", value)); field.value = value;
            }
            document.getElementById("onsitePaymentSourceTicket").add(new Option("합성 변경", "synthetic-source"));
            document.getElementById("onsitePaymentDate").value = new Date().toISOString().slice(0, 10);
            document.getElementById("onsitePaymentAmount").value = "1000";
            document.getElementById("onsitePaymentMessage").textContent = "";
            form.querySelector("button[type=submit]").disabled = false;
          };
          window.confirm = message => { fixture.confirms++; fixture.messageSafe = !message.includes("synthetic-member") && !message.includes("a".repeat(64)); return fixture.mode !== "cancel"; };
          resetIdentityFixture("pass");
        }, theme);
        const click = async () => {
          await page.locator("#onsitePaymentForm button[type=submit]").click();
          await page.waitForFunction(() => !document.getElementById("onsitePaymentForm").dataset.purchaseSubmitting);
        };
        const snapshot = () => page.evaluate(() => ({ previews: identityFixture.previews, writes: identityFixture.writes, confirms: identityFixture.confirms,
          helperCalls: identityFixture.helperCalls, unique: identityFixture.committed.size, keysSame: new Set(identityFixture.keys).size === 1,
          safe: identityFixture.messageSafe, hidden: document.getElementById("onsitePaymentModal").hidden,
          message: document.getElementById("onsitePaymentMessage").textContent, draft: document.getElementById("onsitePaymentMember").value === "synthetic-member" }));
        const check = (ok, label) => { checks++; if (!ok) failures.push(`${engineName}/${width}/${theme}/${label}`); };
        await click(); let s = await snapshot();
        check(s.previews === 1 && s.writes === 1 && s.helperCalls === 1 && s.confirms === 1 && s.hidden && s.safe, "actual-entry-click-confirm-save-readback");
        for (const mode of ["cancel", "stale", "branch", "back", "legacy"]) {
          await page.evaluate(mode => resetIdentityFixture(mode), mode); await click(); s = await snapshot();
          check(s.writes === 0 && s.previews === 1 && s.draft, `${mode}-write0-draft`);
          check(mode === "cancel" ? s.message.includes("입력값은 유지") : mode === "legacy" ? s.message.includes("새로고침") : s.message.includes("다시 선택"), `${mode}-message`);
        }
        await page.evaluate(() => resetIdentityFixture("loss")); await click(); s = await snapshot();
        check(!s.hidden && s.draft && s.unique === 1, "response-loss-draft");
        await click(); s = await snapshot();
        check(s.writes === 2 && s.unique === 1 && s.keysSame && s.hidden, "same-key-replay-mock-one-result");
        await page.evaluate(() => { resetIdentityFixture("pass"); const form = document.getElementById("onsitePaymentForm"); form.requestSubmit(); form.requestSubmit(); });
        await page.waitForFunction(() => !document.getElementById("onsitePaymentForm").dataset.purchaseSubmitting);
        s = await snapshot(); check(s.previews === 1 && s.writes === 1, "actual-listener-double-submit");
        await page.evaluate(() => resetIdentityFixture("cancel")); await click();
        const geometry = await page.locator("#onsitePaymentModal").evaluate(modal => {
          const form = modal.querySelector("form"), button = form.querySelector("button[type=submit]"); button.scrollIntoView({ block: "center" });
          const r = button.getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth + 1, formOverflow: form.scrollWidth > form.clientWidth + 1, height: r.height, width: r.width, visible: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) };
        });
        check(!geometry.overflow && !geometry.formOverflow && geometry.height >= 44 && geometry.width >= 44 && geometry.visible >= 44, `layout-touch-scroll:${JSON.stringify(geometry)}`);
        check(errors.length === 0, "pageerror0");
        if (process.env.TENNISNOTE_IDENTITY_CAPTURE_DIR) {
          fs.mkdirSync(process.env.TENNISNOTE_IDENTITY_CAPTURE_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.TENNISNOTE_IDENTITY_CAPTURE_DIR, `${engineName}-${width}-${theme}.png`), mask: [page.locator("#onsitePaymentForm input"), page.locator("#onsitePaymentForm select")] });
        }
        await context.close();
      }
      console.log(JSON.stringify({ status: failures.length ? "FAIL" : "PASS", engine: engineName, checks, failures, cases: 8, scope: "actual modular entry and existing onsite form; synthetic transport", hostedWrites: 0 }));
      if (failures.length) process.exitCode = 1;
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => server.close());
