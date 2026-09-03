const { chromium, webkit } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const widths = [390, 768, 1366];
const themes = ["light", "dark"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contentType(file) {
  return file.endsWith(".html") ? "text/html; charset=utf-8"
    : file.endsWith(".js") ? "text/javascript; charset=utf-8"
      : file.endsWith(".css") ? "text/css; charset=utf-8"
        : file.endsWith(".json") || file.endsWith(".webmanifest") ? "application/json; charset=utf-8"
          : "application/octet-stream";
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
    if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(requested) || !fs.statSync(requested).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": contentType(requested), "cache-control": "no-store" });
    if (requested.endsWith(`${path.sep}tennis-note-member-app${path.sep}app.js`)) {
      response.end(fs.readFileSync(requested, "utf8").replace("void initApp();", "// browser contract: boot held"));
      return;
    }
    if (requested.endsWith(`${path.sep}tennis-note-coach-app${path.sep}app.js`)) {
      response.end(fs.readFileSync(requested, "utf8").replace(
        "initCoachApp().finally(hideCoachBrandSplash).catch(() => undefined);",
        "// browser contract: boot held",
      ));
      return;
    }
    fs.createReadStream(requested).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launch(browserType) {
  if (browserType !== chromium) return browserType.launch({ headless: true });
  const candidates = [
    chromium.executablePath(),
    path.join(process.env.LOCALAPPDATA || "", "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  return browserType.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

async function waitForEntry(page, app) {
  await page.waitForFunction((targetApp) => (
    Boolean(window.TennisNoteRuntimeEnvironment)
    && typeof window.registerPwaServiceWorker === "function"
    && typeof window.normalizeAppNotice === "function"
    && typeof window.closeNotice === "function"
    && (targetApp === "member"
      ? typeof window.showNoticeIfNeeded === "function"
      : typeof window.openCoachExternalPortal === "function")
  ), app);
}

async function memberEntryChecks(page) {
  return page.evaluate(() => {
    const original = window.TennisNoteRuntimeEnvironment;
    const calls = { resolver: 0, localize: 0, acknowledgement: 0, updaterUrl: "" };
    window.TennisNoteRuntimeEnvironment = Object.freeze({
      ...original,
      resolvePortal(kind) {
        calls.resolver += 1;
        return original.resolvePortal(kind);
      },
      localizeSyntheticNotice(notice) {
        calls.localize += 1;
        return original.localizeSyntheticNotice(notice);
      },
      acknowledgeNotice(notice) {
        calls.acknowledgement += 1;
        return original.acknowledgeNotice(notice);
      },
    });
    window.TennisNoteReleaseUpdater = { start(options) { calls.updaterUrl = options.remoteAppUrl; } };
    window.registerPwaServiceWorker();
    const notice = window.normalizeAppNotice({
      id: "synthetic-modular-entry",
      title: "Synthetic notice",
      body: "Testing announcement",
      updatedAt: "revision-1",
    });
    const originalActive = window.activeNoticesForApp;
    window.activeNoticesForApp = () => [notice];
    window.showNoticeIfNeeded();
    const visibleBeforeClose = !document.querySelector("#noticeDialog")?.hidden;
    window.closeNotice(false);
    window.activeNoticesForApp = originalActive;
    const changedNotice = original.localizeSyntheticNotice({
      id: "synthetic-modular-entry",
      title: "Synthetic notice",
      body: "Changed testing announcement",
      updatedAt: "revision-1",
    });
    const changedContentAcknowledged = original.hasNoticeAcknowledgement(changedNotice, "member");
    const previousRelease = window.TENNIS_NOTE_RELEASE;
    window.TENNIS_NOTE_RELEASE = { ...previousRelease, releaseId: `${previousRelease.releaseId || "release"}.next` };
    const changedReleaseAcknowledged = original.hasNoticeAcknowledgement(notice, "member");
    window.TENNIS_NOTE_RELEASE = previousRelease;
    return {
      calls,
      notice,
      visibleBeforeClose,
      acknowledged: original.hasNoticeAcknowledgement(notice, "member"),
      changedContentAcknowledged,
      changedReleaseAcknowledged,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      banner: document.body.textContent.includes("서울 개발 · 내부 QA"),
    };
  });
}

async function coachEntryChecks(page) {
  return page.evaluate(async () => {
    const original = window.TennisNoteRuntimeEnvironment;
    const calls = { resolver: 0, updaterUrl: "", openedUrl: "" };
    window.TennisNoteRuntimeEnvironment = Object.freeze({
      ...original,
      resolvePortal(kind) {
        calls.resolver += 1;
        return original.resolvePortal(kind);
      },
    });
    window.TennisNoteReleaseUpdater = { start(options) { calls.updaterUrl = options.remoteAppUrl; } };
    window.open = (url) => { calls.openedUrl = url; return {}; };
    window.registerPwaServiceWorker();
    await window.openCoachExternalPortal("coach");
    const notice = original.localizeSyntheticNotice({
      id: "synthetic-modular-entry",
      title: "Synthetic notice",
      body: "Testing announcement",
      updatedAt: "revision-1",
    });
    return {
      calls,
      roleSwitchAcknowledged: original.hasNoticeAcknowledgement(notice, "coach"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      banner: document.body.textContent.includes("서울 개발 · 내부 QA"),
    };
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  let total = 0;
  try {
    for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
      const browser = await launch(browserType);
      try {
        for (const width of widths) {
          for (const theme of themes) {
            const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 768 : Math.max(720, Math.round(width * 2.1)) }, colorScheme: theme });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
              if (message.type() === "error") errors.push(message.text());
            });
            await page.goto(`${base}/app/tennis-note-member-app/`, { waitUntil: "domcontentloaded" });
            await waitForEntry(page, "member");
            const member = await memberEntryChecks(page);
            assert(member.calls.resolver === 1 && member.calls.updaterUrl === "https://tennisnote-app-dev.pages.dev/", `${engine} ${width} ${theme}: member resolver entry not executed`);
            assert(member.calls.localize === 1 && member.calls.acknowledgement === 1, `${engine} ${width} ${theme}: member notice entry not executed`);
            assert(member.visibleBeforeClose && member.acknowledged, `${engine} ${width} ${theme}: notice close acknowledgement failed`);
            assert(!member.changedContentAcknowledged && !member.changedReleaseAcknowledged, `${engine} ${width} ${theme}: changed content/release was suppressed`);
            assert(member.notice.title === "개발 검증 안내" && member.banner && member.overflow <= 1, `${engine} ${width} ${theme}: member presentation failed`);

            await page.goto(`${base}/app/tennis-note-coach-app/`, { waitUntil: "domcontentloaded" });
            await waitForEntry(page, "coach");
            const coach = await coachEntryChecks(page);
            assert(coach.calls.resolver === 2, `${engine} ${width} ${theme}: coach resolver entries not executed`);
            assert(coach.calls.updaterUrl === "https://tennisnote-app-dev.pages.dev/tennis-note-coach-app/", `${engine} ${width} ${theme}: coach updater used wrong portal`);
            assert(coach.calls.openedUrl === "https://tennisnote-app-dev.pages.dev/tennis-note-coach-app/", `${engine} ${width} ${theme}: coach portal used wrong target`);
            assert(coach.roleSwitchAcknowledged, `${engine} ${width} ${theme}: role switch repeated acknowledged notice`);
            assert(coach.banner && coach.overflow <= 1 && errors.length === 0, `${engine} ${width} ${theme}: coach presentation or page error failed`);

            await page.goBack({ waitUntil: "domcontentloaded" });
            await waitForEntry(page, "member");
            const afterBack = await page.evaluate(() => window.TennisNoteRuntimeEnvironment.hasNoticeAcknowledgement(
              window.TennisNoteRuntimeEnvironment.localizeSyntheticNotice({
                id: "synthetic-modular-entry", title: "Synthetic notice", body: "Testing announcement", updatedAt: "revision-1",
              }),
              "member",
            ));
            assert(afterBack, `${engine} ${width} ${theme}: browser back lost acknowledgement`);
            await context.setOffline(true);
            const offlinePortal = await page.evaluate(() => window.TennisNoteRuntimeEnvironment.resolvePortal("coach"));
            assert(offlinePortal.ok && offlinePortal.url.includes("tennisnote-app-dev.pages.dev"), `${engine} ${width} ${theme}: offline resolver changed authority`);
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
  console.log(`TENNISNOTE_PUBLIC_MODULAR_PORTAL_NOTICE_BROWSER_PASS=${total}`);
})().catch((error) => {
  console.error(`FAIL ${error.stack || error.message}`);
  process.exit(1);
});
