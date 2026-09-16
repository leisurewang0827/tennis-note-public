const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium, webkit } = require("playwright");

const root = path.resolve(__dirname, "..");
const widths = [390, 768, 1366];

function contentType(file) {
  return file.endsWith(".html") ? "text/html; charset=utf-8"
    : file.endsWith(".js") ? "text/javascript; charset=utf-8"
      : file.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream";
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
    if (!requested.startsWith(`${root}${path.sep}`) || !fs.existsSync(requested) || !fs.statSync(requested).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": contentType(requested), "cache-control": "no-store" });
    if (requested.endsWith(`${path.sep}tennis-note-member-app${path.sep}app.js`)) {
      response.end(fs.readFileSync(requested, "utf8").replace("void initApp();", "// email auth hidden browser contract: boot held"));
      return;
    }
    fs.createReadStream(requested).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launch(browserType) {
  if (browserType !== chromium) return browserType.launch({ headless: true });
  const executablePath = [
    chromium.executablePath(),
    path.join(process.env.LOCALAPPDATA || "", "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find((candidate) => fs.existsSync(candidate));
  return browserType.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

(async () => {
  const server = await startServer();
  const { port } = server.address();
  try {
    let checked = 0;
    for (const [engineName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
      const browser = await launch(browserType);
      try {
        for (const colorScheme of ["light", "dark"]) {
          for (const width of widths) {
            const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 900 : 844 }, colorScheme, serviceWorkers: "block" });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(`http://127.0.0.1:${port}/app/tennis-note-member-app/index.html`, { waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => (
              typeof window.setEmailAuthMode === "function"
              && typeof window.emailPasswordAuthUiEnabled === "function"
              && Boolean(window.__TENNIS_NOTE_MEMBER_APP_RUNTIME__)
            ));
            const result = await page.evaluate(async () => {
              const calls = [];
              document.querySelector("#loginScreen").hidden = false;
              document.querySelector("#appScreen").hidden = true;
              document.querySelector("#publicOnboardingLoginActions").hidden = false;
              window.TennisNoteDataClient.signInWithPassword = async () => calls.push("login");
              window.TennisNoteDataClient.signUpWithPassword = async () => calls.push("signup");
              window.TennisNoteDataClient.sendPasswordResetEmail = async () => calls.push("reset");
              window.TennisNoteDataClient.updatePassword = async () => calls.push("update");
              window.TennisNoteDataClient.signOut = async () => { calls.push("signout"); };
              setEmailAuthMode("signup", { focus: false });
              for (const id of ["memberEmailLoginForm", "memberEmailSignupForm", "memberPasswordRecoveryForm"]) {
                document.getElementById(id)?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
              }
              document.querySelector("#memberPasswordResetButton")?.click();
              const callsBeforeRecovery = [...calls];
              await handleOAuthResult({ detail: { ok: true, callbackType: "recovery", provider: "이메일" }, preventDefault() {} });
              const panel = document.querySelector("#memberEmailAuthPanel");
              const providers = [...document.querySelectorAll('[data-login-provider]:not([hidden])')];
              return {
                feature: window.TennisNoteRuntimeEnvironment.features.emailPasswordAuthUi,
                hidden: panel.hidden,
                inert: panel.inert,
                ariaHidden: panel.getAttribute("aria-hidden"),
                visibleEmailControls: [...panel.querySelectorAll("summary,button,input,a")].filter((item) => item.getClientRects().length).length,
                providers: providers.map((button) => ({
                  name: button.getAttribute("aria-label") || button.textContent.trim(),
                  height: button.getBoundingClientRect().height,
                  display: getComputedStyle(button).display,
                  parentDisplay: getComputedStyle(button.parentElement).display,
                  loginHidden: document.querySelector("#loginScreen").hidden,
                })),
                status: document.querySelector("#memberEmailLoginStatus").textContent,
                callsBeforeRecovery,
                calls,
                overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
              };
            });
            assert.equal(result.feature, false);
            assert(result.hidden && result.inert && result.ariaHidden === "true");
            assert.equal(result.visibleEmailControls, 0);
            assert.deepEqual(result.callsBeforeRecovery, []);
            assert.deepEqual(result.calls, ["signout"]);
            assert.match(result.status, /현재 앱에서 제공하지 않습니다/);
            assert.equal(result.providers.length, 3);
            result.providers.forEach((provider) => assert(
              provider.name && provider.height >= 44,
              `${engineName} ${width}px inaccessible provider ${JSON.stringify(provider)}`,
            ));
            assert.equal(result.overflow, 0);
            assert.deepEqual(errors, []);
            checked += 1;
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
    console.log(`PASS email auth hidden public modular UI ${checked}/12`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
