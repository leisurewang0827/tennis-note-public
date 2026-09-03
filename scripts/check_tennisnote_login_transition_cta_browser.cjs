const { chromium, webkit } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const viewports = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 960 },
  { width: 1366, height: 768 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/app/shared/config.local.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end('window.TENNISNOTE_CONFIG={environment:"development"};window.TENNIS_NOTE_PAYMENT_CONFIG={enabled:false,allowedMethods:[]};');
      return;
    }
    const relative = pathname.replace(/^\/+/, "") || "app/tennis-note-member-app/index.html";
    const requested = path.resolve(root, relative.endsWith("/") ? `${relative}index.html` : relative);
    if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
    if (!fs.existsSync(requested) || !fs.statSync(requested).isFile()) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": contentType(requested), "cache-control": "no-store" });
    fs.createReadStream(requested).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launch(browserType) {
  if (browserType !== chromium) {
    const executablePath = process.env.TENNISNOTE_WEBKIT_EXECUTABLE || undefined;
    return browserType.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  }
  const chrome = [chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
  return browserType.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  let total = 0;
  try {
    for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
      const browser = await launch(browserType);
      try {
        for (const colorScheme of ["light", "dark"]) {
          for (const viewport of viewports) {
            const context = await browser.newContext({ viewport, colorScheme });
            await context.addInitScript(() => {
              sessionStorage.setItem("tennis-note-recent-login-provider-v1", "custom:kakao");
            });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(`${base}/app/tennis-note-member-app/`, { waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => Boolean(window.TennisNoteModeTransition) && typeof window.renderRecentLoginBadge === "function");
            const result = await page.evaluate(() => {
              window.renderRecentLoginBadge();
              const splash = document.querySelector("#brandSplash");
              splash.hidden = false;
              splash.classList.remove("is-hidden");
              sessionStorage.setItem("tennis-note-mode-transition-v1", JSON.stringify({
                from: "coach", to: "member", startedAt: Date.now(), targetView: "homeView", targetScrollY: 0,
              }));
              window.TennisNoteModeTransition.consume("member", { splashSelector: "#brandSplash" });
              const card = document.querySelector("#brandSplash .tn-mode-transition-card");
              const mark = card?.querySelector(".tn-mode-transition-mark");
              const button = document.querySelector("#completePurchaseScheduleSelection");
              const badge = document.querySelector("#memberRecentLoginBadge");
              const cardStyle = card ? getComputedStyle(card) : null;
              const markStyle = mark ? getComputedStyle(mark) : null;
              const buttonStyle = button ? getComputedStyle(button) : null;
              return {
                cardWidth: card?.getBoundingClientRect().width || 0,
                cardClientWidth: card?.clientWidth || 0,
                gridColumns: cardStyle?.gridTemplateColumns || "",
                markPosition: markStyle?.position || "",
                buttonDisabled: Boolean(button?.disabled),
                ariaDisabled: button?.getAttribute("aria-disabled") || "",
                describedBy: button?.getAttribute("aria-describedby") || "",
                buttonBackground: buttonStyle?.backgroundColor || "",
                badgeText: badge?.textContent || "",
                badgeVisible: Boolean(badge && !badge.hidden),
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              };
            });
            assert(result.cardWidth > 260 && result.cardWidth <= viewport.width - 16, `${engine} ${viewport.width} ${colorScheme}: transition card collapsed ${JSON.stringify(result)}`);
            assert(result.gridColumns.split(" ").length === 3 && result.markPosition === "static", `${engine} ${viewport.width} ${colorScheme}: transition mark left the grid`);
            assert(result.buttonDisabled, `${engine} ${viewport.width} ${colorScheme}: disabled CTA contract missing`);
            assert(result.buttonBackground !== "rgb(15, 118, 110)", `${engine} ${viewport.width} ${colorScheme}: disabled CTA retained primary green`);
            assert(result.badgeVisible && result.badgeText === "최근 카카오 로그인", `${engine} ${viewport.width} ${colorScheme}: recent provider badge missing ${JSON.stringify(result)}`);
            assert(result.overflow <= 1 && errors.length === 0, `${engine} ${viewport.width} ${colorScheme}: overflow or page error`);
            await context.close();
            total += 1;
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`TENNISNOTE_PUBLIC_LOGIN_TRANSITION_CTA_BROWSER_PASS=${total}`);
})().catch((error) => {
  console.error(`FAIL ${error.stack || error.message}`);
  process.exit(1);
});
