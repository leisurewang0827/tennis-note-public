const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium, webkit } = require("playwright");
const root = path.resolve(__dirname, "..");
const coachRoot = path.join(root, "app", "tennis-note-coach-app");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const schedule = read("app/tennis-note-coach-app/views/schedule.js");
const css = `${read("app/shared/tennisnote-ui-foundation.css")}\n${read("app/tennis-note-coach-app/styles.css")}`;
const guardPath = path.join(root, "app", "shared", "tennisnote-input-guard.js");

function functionSource(relative, name) {
  const content = read(relative);
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(content);
  assert(match, `${name} source missing in ${relative}`);
  const tail = content.slice(match.index);
  const next = /\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/.exec(tail.slice(match[0].length));
  return next ? tail.slice(0, next.index + match[0].length) : tail;
}

function listenerSource(relative, target, eventName, requiredText) {
  const content = functionSource(relative, "bindDelegatedEvents");
  const needle = `${target}.addEventListener("${eventName}", (event) => {`;
  let offset = 0;
  while (offset < content.length) {
    const start = content.indexOf(needle, offset);
    if (start < 0) break;
    const end = content.indexOf("\n  });", start);
    assert(end >= 0, `${target} ${eventName} listener terminator missing`);
    const listener = content.slice(start, end + 6);
    if (listener.includes(requiredText)) return listener;
    offset = end + 6;
  }
  throw new Error(`${target} ${eventName} listener with ${requiredText} missing`);
}

const runtime = [
  ["app/tennis-note-coach-app/domain/values.js", "coachFocusableElements"],
  ["app/tennis-note-coach-app/ui/sheet.js", "refreshCoachModalState"],
  ["app/tennis-note-coach-app/ui/sheet.js", "captureCoachModalReturnContext"],
  ["app/tennis-note-coach-app/ui/sheet.js", "coachModalReturnFocusTarget"],
  ["app/tennis-note-coach-app/ui/sheet.js", "restoreCoachModalReturnContext"],
  ["app/tennis-note-coach-app/ui/sheet.js", "restorePendingCoachModalReturnContext"],
  ["app/tennis-note-coach-app/ui/sheet.js", "openCoachModal"],
  ["app/tennis-note-coach-app/ui/sheet.js", "closeCoachModal"],
  ["app/tennis-note-coach-app/ui/screens.js", "closeLessonEditor"],
  ["app/tennis-note-coach-app/ui/screens.js", "requestCloseLessonEditor"],
  ["app/tennis-note-coach-app/forms/coaches.js", "installNativeCoachBackNavigation"],
].map(([file, name]) => functionSource(file, name)).join("\n");

const delegatedClose = listenerSource(
  "app/tennis-note-coach-app/events/delegated.js", "document", "click", '[data-close-lesson-modal]',
);
const delegatedEscape = listenerSource(
  "app/tennis-note-coach-app/events/delegated.js", "document", "keydown", 'activeCoachModalId === "lessonEditModal"',
);
const delegatedPopstate = listenerSource(
  "app/tennis-note-coach-app/events/delegated.js", "window", "popstate", "restorePendingCoachModalReturnContext",
);

const header = /<header class="wide lesson-detail-sheet-header"[\s\S]*?<\/header>/.exec(schedule)?.[0];
const closeButton = /<button class="small-button lesson-completion-close"[^>]*data-cancel-schedule-edit>닫기<\/button>/.exec(schedule)?.[0];
assert(header, "actual feedback exit header missing");
assert(closeButton, "actual feedback footer close missing");

const body = `
  <main id="fullScheduleView" class="view is-active">
    <div style="height:420px"></div>
    <button id="lessonTrigger" type="button" data-edit-lesson-id="synthetic-lesson">수업 상세 열기</button>
    <div style="height:720px"></div>
  </main>
  <nav class="tabbar"><button type="button">레슨표</button></nav>
  <section id="noticeDialog" hidden></section>
  <section id="lessonEditModal" class="lesson-edit-modal" data-tn-input-guard="coach-lesson-record:synthetic-lesson" hidden>
    <div class="modal-backdrop" data-close-lesson-modal></div>
    <div class="modal-card lesson-editor-modal-card" role="dialog" aria-modal="true" aria-label="수업 상세">
      <div id="lessonEditModalContent">
        <section class="schedule-edit-panel lesson-action-panel">
          ${header}
          <div class="wide lesson-detail-scroll-region">
            <div class="wide lesson-modal-head"><div><strong>합성 회원</strong><span>금 18:00 · 40분 · 잔여 4회</span></div><b class="can-process">처리 가능</b></div>
            <label class="lesson-required-field wide"><span>피드백</span><textarea id="feedbackMemo" rows="4"></textarea></label>
            <div style="height:920px" class="wide" aria-hidden="true"></div>
            <label class="lesson-required-field wide"><span>마지막 확인</span><input id="finalField" value="합성 마지막 필드" readonly></label>
          </div>
          <div class="actions lesson-completion-actions wide" data-tn-feedback-footer-contract="v1-0-428-pair">
            ${closeButton}
            <button class="approve-button" type="button">저장하고 완료</button>
          </div>
        </section>
      </div>
    </div>
  </section>`;

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    const instance = http.createServer((_request, response) => {
      response.writeHead(200, { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>Tennis Note feedback exit fixture</title>");
    });
    instance.listen(0, "127.0.0.1", () => resolve(instance));
  });
}

async function launch(engineName, browserType) {
  if (engineName !== "chromium") return browserType.launch({ headless: true });
  const executablePath = [
    chromium.executablePath(),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  return browserType.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

async function loadFixture(page, theme) {
  await page.goto(`${baseUrl}/feedback-exit`, { waitUntil: "domcontentloaded" });
  await page.setContent(`<!doctype html><html lang="ko" data-theme="${theme}"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <style>
      :root{--green:#087b5b;--soft-green:#eaf7f1;--line:#d6e1dc;--ink:#10251f;--muted:#61736d;--paper:${theme === "dark" ? "#14221e" : "#fff"};--amber:#9a6100;--soft-amber:#fff6de;color-scheme:${theme}}
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink);font-family:system-ui,sans-serif}button,input,textarea{font:inherit}.view{padding:16px}.actions{display:flex;gap:8px}.small-button,.approve-button{border:1px solid var(--line);border-radius:8px;padding:8px 12px}.approve-button{color:#fff;background:var(--green)}.lesson-required-field{display:grid;gap:8px}.lesson-required-field :is(input,textarea){width:100%;min-height:44px;font-size:16px}
      ${css}
    </style></head><body data-active-view="fullScheduleView">${body}</body></html>`, { waitUntil: "load" });
  await page.addScriptTag({ path: guardPath });
  await page.addScriptTag({ content: `
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const state = { editingLessonId: null, editingMakeupId: null, writingLessonId: null, viewingCurriculumId: null, coachQuickAdd: null, groupFeedbackReviewLessonId: "" };
    let activeCoachModalId = "";
    let coachModalReturnContext = null;
    let pendingCoachModalReturnContext = null;
    let pendingCoachModalHistoryCloseId = "";
    let queuedCoachModalOpenId = "";
    let nativeCoachBackListenerReady = false;
    window.__rpcCount = 0; window.__networkCount = 0; window.__closeCount = 0; window.__captureCount = 0;
    window.fetch = async () => { window.__networkCount += 1; throw new Error("unexpected network"); };
    window.TennisNoteDataClient = { rpc() { window.__rpcCount += 1; throw new Error("unexpected RPC"); } };
    window.Capacitor = { Plugins: { App: { async addListener(name, callback) { if (name === "backButton") window.__nativeBack = callback; return { remove() {} }; } } } };
    function nativeCoachAppPlatform() { return "android"; }
    function blurActiveCoachFormControl() { const active = document.activeElement; if (!active?.matches?.("input,textarea,select")) return false; active.blur(); return true; }
    function closeNotice() {}
    function openUserMode() {}
    function ensureCoachLessonRecord(id) { return id === "synthetic-lesson" ? { id, scheduleEditDraft: {} } : null; }
    function lessonChartFinalized() { return false; }
    function captureLessonChartDraft() { window.__captureCount += 1; }
    function setView(viewId) { document.querySelectorAll(".view").forEach((node) => node.classList.toggle("is-active", node.id === viewId)); document.body.dataset.activeView = viewId; }
    ${runtime}
    const originalClose = closeLessonEditor;
    closeLessonEditor = function(fromHistory = false) { window.__closeCount += 1; return originalClose(fromHistory); };
    ${delegatedClose}
    ${delegatedEscape}
    ${delegatedPopstate}
    history.replaceState({ tennisNoteMode: "coach", tennisNoteView: "fullScheduleView" }, "", location.href);
    window.__fixture = {
      async ready() { await installNativeCoachBackNavigation(); },
      open() { window.scrollTo(0, 420); window.__openScrollY = window.scrollY; const trigger = document.querySelector("#lessonTrigger"); trigger.focus({ preventScroll: true }); state.editingLessonId = "synthetic-lesson"; openCoachModal("lessonEditModal"); },
      requestClose() { return requestCloseLessonEditor(); },
      nativeBack() { return window.__nativeBack?.(); },
      result() { return { activeCoachModalId, editingLessonId: state.editingLessonId, pendingCoachModalHistoryCloseId, scrollY, openScrollY: window.__openScrollY, focus: document.activeElement?.id || "", rpc: window.__rpcCount, network: window.__networkCount, closes: window.__closeCount, historyModal: history.state?.tennisNoteModal || "" }; },
    };
  ` });
  await page.evaluate(() => window.__fixture.ready());
  await page.evaluate(() => window.__fixture.open());
  await page.waitForTimeout(80);
}

async function layoutResult(page, position) {
  return page.evaluate((target) => {
    const modal = document.querySelector(".lesson-editor-modal-card");
    const header = document.querySelector(".lesson-detail-sheet-header");
    const scroller = document.querySelector(".lesson-detail-scroll-region");
    const footer = document.querySelector(".lesson-completion-actions");
    const close = document.querySelector(".lesson-completion-close");
    const primary = footer.querySelector(".approve-button");
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = target === "end" ? maxScroll : 0;
    const modalRect = modal.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    const visualTop = window.visualViewport?.offsetTop || 0;
    const visualBottom = visualTop + (window.visualViewport?.height || innerHeight);
    const atClose = document.elementFromPoint(closeRect.left + closeRect.width / 2, closeRect.top + closeRect.height / 2);
    const atPrimary = document.elementFromPoint(primaryRect.left + primaryRect.width / 2, primaryRect.top + primaryRect.height / 2);
    return {
      maxScroll, scrollTop: scroller.scrollTop, outerScroll: document.querySelector("#lessonEditModalContent").scrollTop,
      modalTop: modalRect.top, modalBottom: modalRect.bottom, headerTop: headerRect.top,
      footerTop: footerRect.top, footerBottom: footerRect.bottom, visualTop, visualBottom,
      closeHeight: closeRect.height, primaryHeight: primaryRect.height,
      sameRow: Math.abs(closeRect.top - primaryRect.top) <= 1 && closeRect.right <= primaryRect.left + 1,
      closeHit: atClose === close || atClose?.closest?.(".lesson-completion-close") === close,
      primaryHit: atPrimary === primary || atPrimary?.closest?.(".approve-button") === primary,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      footerMarker: footer.dataset.tnFeedbackFooterContract,
      headerMarker: header.dataset.tnFeedbackExitContract,
    };
  }, position);
}

async function assertLayout(page, label) {
  const start = await layoutResult(page, "start");
  assert(start.maxScroll > 0, `${label}: fixture does not scroll`);
  assert.equal(start.scrollTop, 0, `${label}: initial body scroll`);
  assert.equal(start.outerScroll, 0, `${label}: outer modal scrolled`);
  assert(start.footerTop >= start.visualTop && start.footerBottom <= start.visualBottom, `${label}: footer outside first viewport`);
  assert(start.footerTop >= start.modalTop && start.footerBottom <= start.modalBottom, `${label}: footer outside modal`);
  assert(start.headerTop >= start.modalTop, `${label}: header outside modal`);
  assert(start.closeHeight >= 44 && start.primaryHeight >= 44, `${label}: action under 44px`);
  assert(start.sameRow && start.closeHit && start.primaryHit, `${label}: action row or hit target mismatch`);
  assert(start.overflow <= 1, `${label}: horizontal overflow ${start.overflow}`);
  assert.equal(start.footerMarker, "v1-0-428-pair", `${label}: footer marker`);
  assert.equal(start.headerMarker, "lesson-editor-v1", `${label}: header marker`);
  const end = await layoutResult(page, "end");
  assert(Math.abs(end.footerTop - start.footerTop) <= 1 && Math.abs(end.footerBottom - start.footerBottom) <= 1, `${label}: footer moved while body scrolled`);
}

async function closeAndAssert(page, label) {
  await page.locator("#lessonEditModal").waitFor({ state: "hidden" });
  await page.waitForTimeout(80);
  const result = await page.evaluate(() => window.__fixture.result());
  assert.equal(result.closes, 1, `${label}: close count`);
  assert.equal(result.activeCoachModalId, "", `${label}: active modal`);
  assert.equal(result.editingLessonId, null, `${label}: stale lesson`);
  assert.equal(result.pendingCoachModalHistoryCloseId, "", `${label}: pending history lock`);
  assert.equal(result.historyModal, "", `${label}: history marker`);
  assert.equal(result.focus, "lessonTrigger", `${label}: focus restore`);
  assert(Math.abs(result.scrollY - result.openScrollY) <= 2, `${label}: scroll restore ${result.scrollY}/${result.openScrollY}`);
  assert.equal(result.rpc, 0, `${label}: RPC call`);
  assert.equal(result.network, 0, `${label}: network call`);
}

async function runExit(page, route, dirty) {
  if (dirty) await page.locator("#feedbackMemo").fill(`합성 ${route} 초안`);
  if (route === "footer") await page.locator(".lesson-completion-close").click();
  if (route === "header") await page.locator(".lesson-detail-sheet-close").click();
  if (route === "backdrop") await page.locator(".modal-backdrop").click({ position: { x: 3, y: 3 } });
  if (route === "escape") {
    if (dirty) {
      await page.locator("#feedbackMemo").focus();
      await page.keyboard.press("Escape");
    }
    await page.keyboard.press("Escape");
  }
  if (route === "history") await page.evaluate(() => history.back());
  if (route === "native") {
    await page.evaluate(() => window.__fixture.nativeBack());
    if (dirty) await page.evaluate(() => window.__fixture.nativeBack());
  }
  if (dirty) {
    await page.locator(".tn-unsaved-prompt:not([hidden])").waitFor();
    assert.equal(await page.locator(".tn-unsaved-prompt").count(), 1, `${route}: duplicate draft prompt`);
    await page.locator('[data-tn-unsaved-action="leave"]').click();
  }
}

(async () => {
  server = await startServer();
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  let layouts = 0;
  let exits = 0;
  for (const [engineName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await launch(engineName, browserType);
    try {
      for (const [width, height] of [[320, 720], [390, 844], [430, 932]]) {
        for (const theme of ["light", "dark"]) {
          const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme });
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await loadFixture(page, theme);
          await assertLayout(page, `${engineName}/${width}/${theme}`);
          assert.deepEqual(errors, [], `${engineName}/${width}/${theme}: page errors`);
          layouts += 1;
          await page.close();
        }
      }
      for (const dirty of [false, true]) {
        for (const route of ["footer", "header", "backdrop", "escape", "history", "native"]) {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: dirty ? "dark" : "light" });
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await loadFixture(page, dirty ? "dark" : "light");
          await runExit(page, route, dirty);
          await closeAndAssert(page, `${engineName}/${dirty ? "dirty" : "clean"}/${route}`);
          assert.deepEqual(errors, [], `${engineName}/${route}: page errors`);
          exits += 1;
          await page.close();
        }
      }
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await loadFixture(page, "light");
      const result = await page.evaluate(() => [window.__fixture.requestClose(), window.__fixture.requestClose()]);
      assert.deepEqual(result, [true, false], `${engineName}: duplicate close did not no-op`);
      await closeAndAssert(page, `${engineName}/double-close`);
      exits += 1;
      await page.close();
    } finally {
      await browser.close();
    }
  }
  console.log(`TENNISNOTE_FEEDBACK_EXIT_BROWSER_PASS layouts=${layouts}; exits=${exits}; DB/RPC/network writes=0`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(() => {
  server?.close();
});
