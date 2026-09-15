const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium, webkit } = require("playwright");

const baseUrl = process.env.TENNISNOTE_TEST_BASE || "http://127.0.0.1:8879/app";
const browserName = String(process.env.TENNISNOTE_BROWSER || "chromium").toLowerCase();
const chromePath = [process.env.CHROME_PATH, chromium.executablePath(), "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
  .find((candidate) => candidate && fs.existsSync(candidate));
const sizes = [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1366, height: 900 }];

async function memberFixture(page, label) {
  const result = await page.evaluate(async () => {
    let calls = 0;
    window.TennisNoteDataClient = {
      getSession: () => ({ access_token: "fixture" }),
      invokeFunction: async (route) => {
        if (route.endsWith("refund-request-submit")) {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 25));
          return { ok: true, request: { requestId: "request-fixture", status: "submitted", revision: 1 } };
        }
        throw new Error("unexpected route");
      },
    };
    Object.assign(memberRefundRequestFlow, {
      ticket: { id: "ticket-fixture", providerPaymentId: "hidden-provider-value", paymentStatus: "verified" },
      preview: { productName: "정규 5회권", paidAmount: 100000, totalSessions: 5, usedSessions: 1, remainingSessions: 4, usedAmount: 20000, penaltyAmount: 10000, reservationFee: 0, refundAmount: 70000, requiresPolicyFallbackConfirmation: false },
      request: null, loading: false, submitting: false, operationKey: "member-refund:fixture", message: "", tone: "neutral",
    });
    const sheet = document.querySelector("#memberRefundRequestSheet");
    sheet.hidden = false;
    renderMemberRefundRequestSheet();
    const reason = document.querySelector("#memberRefundRequestReason");
    reason.value = "합성 요청 사유";
    await Promise.all([submitMemberRefundRequest(), submitMemberRefundRequest()]);
    const card = sheet.querySelector(".sheet-card").getBoundingClientRect();
    const buttons = [...sheet.querySelectorAll("button")].filter((button) => getComputedStyle(button).display !== "none");
    const text = sheet.textContent || "";
    return {
      calls,
      status: memberRefundRequestFlow.request?.status,
      providerLeaked: text.includes("hidden-provider-value"),
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      clipped: card.left < -1 || card.right > innerWidth + 1,
      textareaFont: parseFloat(getComputedStyle(reason).fontSize),
      minButtonHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
    };
  });
  assert.equal(result.calls, 1, `${label}: duplicate submit reached Edge`);
  assert.equal(result.status, "submitted", `${label}: submitted state missing`);
  assert.equal(result.providerLeaked, false, `${label}: provider identifier leaked`);
  assert(result.overflow <= 1, `${label}: horizontal overflow ${result.overflow}`);
  assert.equal(result.clipped, false, `${label}: sheet clipped`);
  assert(result.textareaFont >= 16, `${label}: textarea font ${result.textareaFont}`);
  assert(result.minButtonHeight >= 44, `${label}: button touch area ${result.minButtonHeight}`);
}

async function adminFixture(page, label) {
  const result = await page.evaluate(() => {
    Object.assign(adminImportAuthState, { profile: { role: "admin" }, loading: false });
    Object.assign(adminLockSettings, { pinConfigured: true, pinHash: "", legacyPin: "" });
    window.TennisNoteDataClient = {
      readiness: () => ({ ready: true }),
      getSession: () => ({ access_token: "fixture" }),
    };
    adminMemberRefundRequests = [{
      requestId: "request-fixture", providerPaymentId: "pay-fixture", status: "submitted",
      reason: '<img src=x onerror="window.__xss=1">', expectedRefundAmount: 70000, revision: 3,
    }];
    const item = { providerPaymentId: "pay-fixture", status: "paid", member: "합성 회원", item: "정규 5회권" };
    const host = document.createElement("section");
    host.innerHTML = `${paymentRefundButtonFor(item, 0)}${billingRowDetailMarkup(item, 0, {}, "", false)}`;
    document.body.appendChild(host);
    return {
      text: host.textContent || "",
      imageCount: host.querySelectorAll("img").length,
      requestMatched: memberRefundRequestForBilling(item)?.requestId,
    };
  });
  assert(result.text.includes("회원 요청 확인"), `${label}: admin primary action mismatch`);
  assert.equal(result.imageCount, 0, `${label}: request reason rendered as HTML`);
  assert.equal(result.requestMatched, "request-fixture", `${label}: exact payment request mismatch`);
}

(async () => {
  assert(["chromium", "webkit"].includes(browserName));
  const browser = browserName === "webkit"
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ headless: true, executablePath: chromePath });
  let checks = 0;
  try {
    for (const colorScheme of ["light", "dark"]) {
      for (const size of sizes) {
        const memberContext = await browser.newContext({ viewport: size, colorScheme, serviceWorkers: "block" });
        const memberPage = await memberContext.newPage();
        await memberPage.goto(`${baseUrl}/tennis-note-member-app/index.html?fixture=member-refund`, { waitUntil: "domcontentloaded" });
        await memberPage.waitForFunction(() => typeof renderMemberRefundRequestSheet === "function");
        await memberFixture(memberPage, `${browserName} member ${size.width} ${colorScheme}`);
        await memberContext.close();

        const adminContext = await browser.newContext({ viewport: size, colorScheme, serviceWorkers: "block" });
        const adminPage = await adminContext.newPage();
        await adminPage.goto(`${baseUrl}/admin/index.html?demoAdmin=1&fixture=member-refund`, { waitUntil: "domcontentloaded" });
        await adminPage.waitForFunction(() => typeof memberRefundRequestForBilling === "function");
        await adminFixture(adminPage, `${browserName} admin ${size.width} ${colorScheme}`);
        await adminContext.close();
        checks += 2;
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`TENNISNOTE_MEMBER_REFUND_REQUEST_${browserName.toUpperCase()}_PASS=${checks}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
