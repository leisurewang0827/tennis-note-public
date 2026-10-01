/* 실제 공개 관리자 모듈 + 합성 transport. 외부 네트워크/DB/실사용자 접근 없음. */
const { chromium, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
let assertions = 0;
const failures = [];
const check = (ok, label) => { assertions++; if (!ok) failures.push(label); };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) || pathname.endsWith("config.local.js")) {
    res.writeHead(200, { "Content-Type": "application/javascript" }); res.end("/* offline fixture */"); return;
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
    try {
      for (const width of [390, 768, 1366]) for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, serviceWorkers: "block" });
        let externalRequests = 0;
        await context.route("**/*", route => {
          if (new URL(route.request().url()).origin === origin) return route.continue();
          externalRequests++; return route.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(origin + "/app/admin/index.html", { waitUntil: "load" });
        await page.waitForFunction(() => typeof submitSignupLinkApproval === "function");
        const result = await page.evaluate(async theme => {
          const checks = {};
          const record = (name, ok) => { checks[name] = Boolean(ok); };
          let branch = "synthetic-branch", role = "admin", allow = true;
          operationsRole = () => role;
          activeOperationBranchId = () => branch;
          memberManagementActionAllowed = () => allow;
          document.documentElement.dataset.theme = theme;
          document.body.dataset.theme = theme;
          const member = { id: "synthetic-local", serverUserId: "synthetic-member", name: "합성 대상" };
          members.push(member);
          const pending = { id: "synthetic-request", targetUserId: member.serverUserId, branchId: branch, status: "pending", revision: 1,
            sourceName: '<img src=x onerror="window.fixtureXss=true"> 합성 신청' };
          const client = window.TennisNoteDataClient;
          const modal = document.getElementById("memberManagementModal");
          document.getElementById("operationsLoginGate")?.setAttribute("hidden", "");
          document.getElementById("adminBrandSplash")?.setAttribute("hidden", "");
          const setup = (rows = [pending]) => {
            Object.assign(memberManagementModalState, { memberId: member.id, action: "app_link", signupLinkRequests: rows, message: "", linkCandidates: [] });
            renderMemberManagementModal(); modal.hidden = false;
            return document.getElementById("memberManagementForm");
          };
          setup([]);
          const listCalls = [];
          let resolveList;
          client.rpc = (name, payload) => {
            listCalls.push({ name, payload });
            if (name === "tn_admin_signup_link_requests") return new Promise(resolve => { resolveList = resolve; });
            return Promise.resolve({ candidates: [] });
          };
          const loading = loadMemberLinkCandidates(member);
          record("loading-visible", modal.textContent.includes("찾는 중"));
          resolveList({ requests: [pending] }); await loading;
          record("actual-loader-exact", listCalls.length === 2 && listCalls[0].payload.target_branch_id === branch && listCalls[0].payload.target_member_id === member.serverUserId);
          record("pending-not-legacy", Boolean(document.querySelector('[name="signupLinkRequest"]')) && !document.querySelector('[name="sourceSignupUserId"]'));
          record("escaped-not-executed", !window.fixtureXss && !modal.querySelector("img") && modal.textContent.includes("<img"));
          memberManagementModalState.signupLinkRequests = [];
          const stale = loadMemberLinkCandidates(member); branch = "other-branch";
          resolveList({ requests: [pending] }); await stale;
          record("stale-branch-ignored", memberManagementModalState.signupLinkRequests.length === 0 && listCalls.length === 3);
          branch = "synthetic-branch";
          client.rpc = async () => { throw Error("synthetic-offline"); };
          await loadMemberLinkCandidates(member);
          record("loader-error-visible", memberManagementModalState.signupLinkRequests.length === 0 && Boolean(document.getElementById("memberManagementMessage").textContent));
          client.rpc = async name => name === "tn_admin_signup_link_requests" ? { requests: [] } : { candidates: [] };
          await loadMemberLinkCandidates(member);
          record("empty-legacy-preserved", !document.querySelector('[name="signupLinkRequest"]') && Boolean(document.querySelector('[name="memberLinkQuery"]')));
          let form = setup();
          const submit = () => submitMemberManagementForm({ preventDefault() {}, target: form });
          const choose = decision => {
            form.elements.signupLinkRequest.value = pending.id;
            form.elements.signupLinkDecision.value = decision;
            form.elements.signupLinkBranchConfirmed.checked = true;
          };
          choose("approve");
          const calls = []; let behavior = "ok", finishRpc;
          let listReads = 0, authReads = 0;
          // 읽기 transport만 합성 응답이며 submit handler / renderer는 실제 코드다.
          loadMemberLinkCandidates = async () => { listReads++; };
          refreshMemberAuthManagement = async () => { authReads++; };
          client.rpc = async (name, payload) => {
            calls.push({ name, payload });
            if (behavior === "loss") throw Error("synthetic-response-loss");
            if (behavior === "defer") await new Promise(resolve => { finishRpc = resolve; });
            return { ok: true, requestId: behavior === "wrong" ? "wrong-request" : payload.target_request_id,
              branchId: payload.target_branch_id, targetUserId: payload.target_member_id,
              status: payload.target_decision === "approve" ? "approved" : "rejected" };
          };
          form.elements.signupLinkBranchConfirmed.checked = false; await submit();
          record("unchecked-rpc-zero", calls.length === 0); choose("approve");
          for (const [key, wrong] of [["branchId", "other"], ["targetUserId", "other"], ["status", "approved"], ["revision", "1"]]) {
            const previous = pending[key]; pending[key] = wrong; await submit(); pending[key] = previous;
            record(key + "-mismatch-rpc-zero", calls.length === 0);
          }
          role = "coach"; await submit(); role = "admin";
          record("nonadmin-rpc-zero", calls.length === 0);
          allow = false; await submit(); allow = true;
          record("existing-permission-gate", calls.length === 0 && document.getElementById("memberManagementMessage").textContent.includes("권한"));
          branch = ""; await submit(); branch = "synthetic-branch";
          record("missing-branch-rpc-zero", calls.length === 0);
          form.elements.signupLinkRequest.value = ""; await submit(); choose("approve");
          record("missing-request-rpc-zero", calls.length === 0);
          behavior = "defer";
          const inFlight = submit(); await submit();
          record("duplicate-one-busy", calls.length === 1 && form.querySelector('[type="submit"]').disabled);
          finishRpc(); await inFlight;
          record("approve-readback", listReads === 1 && authReads === 1 && document.getElementById("memberManagementMessage").textContent.includes("완료"));
          choose("reject"); behavior = "loss"; await submit();
          record("loss-error-draft", form.elements.signupLinkDecision.value === "reject" && document.getElementById("memberManagementMessage").textContent.includes("다시 시도"));
          behavior = "ok"; await submit();
          record("retry-same-key", calls.length === 3 && calls[1].payload.target_operation_key === calls[2].payload.target_operation_key && calls[0].payload.target_operation_key !== calls[1].payload.target_operation_key);
          record("reject-readback", listReads === 2 && authReads === 2);
          behavior = "wrong"; await submit();
          record("wrong-readback-no-success", listReads === 2 && authReads === 2 && document.getElementById("memberManagementMessage").textContent.includes("확인하지 못"));
          behavior = "defer"; const staleSubmit = submit(); branch = "other-branch"; finishRpc(); await staleSubmit;
          record("stale-submit-no-refresh", listReads === 2 && authReads === 2); branch = "synthetic-branch";
          record("only-authority-rpc", calls.every(call => call.name === "tn_admin_review_signup_link" && call.payload.target_member_id === member.serverUserId));
          closeMemberManagementModal();
          record("close-clears-modal", modal.hidden && !memberManagementModalState.memberId);
          form = setup([{ ...pending, sourceName: "합성 가입 신청" }]);
          choose("approve");
          record("reopen-operation-retained", Object.keys(memberManagementModalState.signupLinkReviewOperations).length === 2);
          behavior = "ok";
          window.fixtureApprovalCalls = calls;
          window.fixtureApprovalCallsBeforeClick = calls.length;
          // 다른 화면/인증 overlay는 테스트에서 열지 않는다. 기존 모달만 가시화.
          for (const overlay of document.querySelectorAll('.modal-backdrop')) if (overlay !== modal) overlay.hidden = true;
          const panel = modal.querySelector(".modal-panel");
          const primary = form.querySelector('[type="submit"]');
          const measure = button => {
            const css = getComputedStyle(button);
            return { minHeight: css.minHeight, minWidth: css.minWidth, background: css.backgroundColor, color: css.color, opacity: css.opacity };
          };
          const contrast = button => {
            const css = getComputedStyle(button);
            const luminance = value => {
              const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
                const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              });
              return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
            };
            const a = luminance(css.color), b = luminance(css.backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          };
          const scopedRules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
            .filter(rule => rule.selectorText?.startsWith('#memberManagementForm:has([name="signupLinkRequest"])'));
          record("selector-supported-exact", CSS.supports('selector(:has(*))') && scopedRules.length === 2);
          const otherButtons = [...document.querySelectorAll('button.primary-button, button.ghost-button')].filter(button => !form.contains(button));
          const otherBefore = JSON.stringify(otherButtons.map(measure));
          const rulesBefore = scopedRules.map(rule => rule.style.cssText);
          scopedRules.forEach(rule => { rule.style.cssText = ""; });
          const baselineHeight = primary.getBoundingClientRect().height;
          const otherBaseline = JSON.stringify(otherButtons.map(measure));
          scopedRules.forEach((rule, index) => { rule.style.cssText = rulesBefore[index]; });
          record("baseline-40-correction-44", baselineHeight === 40 && primary.getBoundingClientRect().height >= 44);
          record("other-modals-styles-unchanged", otherButtons.length > 10 && otherBefore === otherBaseline);
          const activeContrast = contrast(primary);
          primary.disabled = true;
          const disabledContrast = contrast(primary);
          record("disabled-neutral-44", primary.getBoundingClientRect().height >= 44 && getComputedStyle(primary).cursor === "not-allowed"
            && getComputedStyle(primary).backgroundColor === "rgb(229, 231, 235)" && getComputedStyle(primary).opacity === "1");
          primary.disabled = false;
          record("enabled-disabled-contrast", activeContrast >= 4.5 && disabledContrast >= 4.5);
          const pendingControl = form.elements.signupLinkRequest;
          pendingControl.name = "syntheticLegacyControl";
          record("legacy-app-link-styles-unchanged", primary.getBoundingClientRect().height === baselineHeight);
          pendingControl.name = "signupLinkRequest";
          const box = primary.getBoundingClientRect();
          record("single-primary", form.querySelectorAll("button.primary-button").length === 1);
          record("layout-overflow-zero", panel.scrollWidth <= panel.clientWidth + 1 && form.scrollWidth <= form.clientWidth + 1);
          record("primary-touch-44", box.height >= 44 && box.width >= 44);
          return { checks, buttonHeight: box.height, baselineHeight, activeContrast, disabledContrast,
            otherButtonsCompared: otherButtons.length, primaryCount: form.querySelectorAll("button.primary-button").length };
        }, theme);
        for (const [name, ok] of Object.entries(result.checks)) check(ok, `${engineName}/${width}/${theme}/${name}`);
        check(errors.length === 0, `${engineName}/${width}/${theme}/page-errors:${errors.join("|")}`);
        // 실제 delegate submit listener: HTML5 valid 폼을 버튼으로 한 번 제출한다.
        await page.locator('#memberManagementForm button[type="submit"]').click();
        await page.waitForFunction(() => !memberManagementModalState.signupLinkReviewBusy);
        check(await page.evaluate(() => window.fixtureApprovalCalls.length === window.fixtureApprovalCallsBeforeClick + 1), `${engineName}/${width}/${theme}/actual-delegate-submit-one`);
        const disabledNoRequest = await page.evaluate(() => {
          const button = document.querySelector('#memberManagementForm button[type="submit"]');
          const before = window.fixtureApprovalCalls.length;
          button.disabled = true;
          button.click();
          return window.fixtureApprovalCalls.length === before && button.disabled;
        });
        check(disabledNoRequest, `${engineName}/${width}/${theme}/disabled-click-rpc-zero`);
        if (process.env.TENNISNOTE_QA_OUTPUT) {
          fs.mkdirSync(process.env.TENNISNOTE_QA_OUTPUT, { recursive: true });
          await page.locator("#memberManagementModal").screenshot({ path: path.join(process.env.TENNISNOTE_QA_OUTPUT, `${engineName}-${width}-${theme}-disabled.png`) });
          await page.evaluate(() => { document.querySelector('#memberManagementForm button[type="submit"]').disabled = false; });
          await page.locator("#memberManagementModal").screenshot({ path: path.join(process.env.TENNISNOTE_QA_OUTPUT, `${engineName}-${width}-${theme}.png`) });
        }
        console.log(JSON.stringify({ engine: engineName, width, theme, checks: Object.keys(result.checks).length + 3,
          buttonHeight: result.buttonHeight, baselineHeight: result.baselineHeight, activeContrast: result.activeContrast,
          disabledContrast: result.disabledContrast, otherButtonsCompared: result.otherButtonsCompared,
          externalRequestsBlocked: externalRequests, remoteWrites: 0, actualDevice: false,
          failed: Object.entries(result.checks).filter(([, ok]) => !ok).map(([name]) => name) }));
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({ assertions, failures, status: failures.length ? "FAIL" : "PASS", hostedRoles: "NOT VERIFIED", actualAndroid: "NOT VERIFIED", actualIPhone: "NOT VERIFIED" }));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => server.close());
