const { chromium, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");

// 실제 모듈/DOM을 사용하되 부팅·원격 접속은 차단하고 합성 조회 결과만 주입한다.
const server = http.createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  if (name.endsWith("/config.local.js")) {
    res.setHeader("content-type", "text/javascript");
    res.end('window.TENNISNOTE_CONFIG={environment:"development"};window.TENNIS_NOTE_PAYMENT_CONFIG={enabled:false};');
    return;
  }
  const file = path.resolve(root, `.${name}${name.endsWith("/") ? "index.html" : ""}`);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  const ext = path.extname(file);
  res.setHeader("content-type", { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" }[ext] || "application/octet-stream");
  if (file.endsWith(`${path.sep}tennis-note-member-app${path.sep}app.js`)) {
    res.end(fs.readFileSync(file, "utf8").replace("void initApp();", "// 합성 브라우저 검사: 부팅 보류"));
  } else fs.createReadStream(file).pipe(res);
});

async function check(page) {
  return page.evaluate(async () => {
    const rows = [
      { id: "synthetic-import", name: "합성 가져오기 전용", policy_settings: { importOnly: true, adminSaleStatus: "sale" } },
      { id: "synthetic-hidden", name: "합성 구매 비노출", policy_settings: { memberCheckoutVisible: false, adminSaleStatus: "consult" } },
      { id: "synthetic-sale", name: "합성 일반 정규권", policy_settings: {} },
      { id: "synthetic-consult", name: "합성 상담 정규권", policy_settings: { adminSaleStatus: "consult" } },
    ].map((row) => ({ product_kind: "regular", total_sessions: 5, lesson_minutes: 20,
      frequency_per_week: 1, group_size: 1, is_active: true, card_price: 100, ...row }));
    let mapperCalls = 0;
    const originalMapper = window.membershipProductFromServer;
    window.membershipProductFromServer = (row) => { mapperCalls += 1; return originalMapper(row); };
    let reads = 0;
    window.TennisNoteDataClient = { readiness: () => ({ ready: true }), rpc: async (name) => {
      if (name !== "tn_public_membership_product_catalog") throw Error("unexpected fixture RPC");
      reads += 1; return rows;
    } };
    await syncPublicMembershipProductsFromServer();
    const publicIds = state.publicMembershipProducts.map((p) => p.id);
    state.dataMode = "live";
    state.liveMembershipProducts = rows.map(window.membershipProductFromServer);
    const purchaseIds = membershipProducts().map((p) => p.id);
    const ticket = { id: "synthetic-owned", productId: "synthetic-import", title: "합성 보유 정규권",
      total: 5, used: 0, remaining: 5, status: "active", startsOn: "2000-01-01", expiresOn: "2099-01-01",
      productKind: "regular", coachRoleId: "synthetic-coach", coach: "합성 담당" };
    const history = { ...ticket, id: "synthetic-history", title: "합성 종료 정규권", status: "expired", used: 5, remaining: 0, expiresOn: "2000-02-01" };
    state.liveTickets = [ticket, history]; state.expiredTickets = []; state.paymentRequests = [];
    state.liveLessons = []; state.lessonLogs = []; state.memberRefundRequests = [];
    renderProducts();
    renderPurchaseProductSheet();
    const owned = document.querySelector("#currentTicketPanel").textContent;
    const historyText = document.querySelector("#paymentRequests").textContent;
    const before = JSON.stringify(state.liveTickets);
    state.liveMembershipProducts = state.liveMembershipProducts.filter((p) => p.status === "hidden");
    renderPurchaseProductSheet();
    const emptyPurchase = membershipProducts().length === 0;
    renderProducts();
    return { reads, mapperCalls, publicIds, purchaseIds, owned: owned.includes(ticket.title) && owned.includes("5"),
      history: historyText.includes(history.title), emptyPurchase,
      ownedUnchanged: before === JSON.stringify(state.liveTickets),
      historyExact: historicalLiveTickets().some((t) => t.id === history.id),
      currentExact: currentLiveTickets().some((t) => t.id === ticket.id),
      entry: Boolean(window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cases = 0;
  try {
    for (const [name, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
      const browser = await type.launch({ headless: true });
      try {
        for (const width of [390, 768, 1366]) for (const colorScheme of ["light", "dark"]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, serviceWorkers: "block" });
          let remoteRequests = 0;
          await context.route("**/*", (route) => {
            if (route.request().url().startsWith(origin)) return route.continue();
            // 기존 로그인 CSS의 Apple 정적 이미지만 로컬 대체한다. 외부 전송은 없다.
            const url = new URL(route.request().url());
            if (url.origin === "https://appleid.cdn-apple.com" && url.pathname === "/appleid/button" && route.request().resourceType() === "image") {
              return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
            }
            remoteRequests += 1; return route.abort();
          });
          const page = await context.newPage();
          const errors = []; page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(`${origin}/app/tennis-note-member-app/`);
          await page.waitForFunction(() => Boolean(window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__));
          const r = await check(page);
          assert.deepEqual(r.publicIds, ["synthetic-sale", "synthetic-consult"]);
          assert.deepEqual(r.purchaseIds, r.publicIds);
          assert.equal(r.mapperCalls, 8); assert.equal(r.reads, 1);
          for (const key of ["owned", "history", "emptyPurchase", "ownedUnchanged", "historyExact", "currentExact", "entry"]) assert.equal(r[key], true, key);
          assert.equal(r.overflow, 0); assert.deepEqual(errors, []); assert.equal(remoteRequests, 0);
          cases += 1; console.log(`${name} ${width} ${colorScheme}: PASS purchase hidden / owned+history retained / remote 0`);
          await context.close();
        }
      } finally { await browser.close(); }
    }
    console.log(`import-only browser PASS ${cases}/12; synthetic only; actual devices NOT VERIFIED`);
  } finally { server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
