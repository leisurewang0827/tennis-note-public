// 새 관리자 화면 계약만 검증한다. 실제 계정·네트워크를 사용하지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TN_PLAYWRIGHT_PATH || "C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright");
const html = readFileSync(new URL("../app/admin/index.html", import.meta.url), "utf8");
const markup = html.match(/<form id="r4BranchOperations"[\s\S]*?<\/form>/)?.[0];
assert.ok(markup);
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { branchA: id(1), branchB: id(2), memberA: id(3), memberB: id(4), product: id(5), paid: id(6), ticket: id(7) };
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/*", (route) => route.abort());
  await page.setContent(`<select id="r4ManagedBranch"><option value="${ids.branchA}">A</option><option value="${ids.branchB}">B</option></select>${markup}`);
  await page.addScriptTag({ content: readFileSync(new URL("../app/admin/r4-branch-operations.js", import.meta.url), "utf8") });
  await page.evaluate(({ ids }) => {
    window.calls = [];
    window.target = "development";
    let product;
    const paid = { id: ids.paid, name: "비공개 유료 참고상품", days: 35, minutes: 20, sessions: 5, price: 25000 };
    window.client = {
      loadConfig: () => ({ environment: window.target, supabaseUrl: "https://udjmiezroipctytmztwz.supabase.co",
        projectFingerprint: "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba" }),
      sessionSubject: () => "synthetic-qa",
      rpc: async (name, args) => {
        window.calls.push([name, args]);
        if (name === "tn_r4_branch_operations_options") return { branchId: args.branch, revision: 0, mode: "approval", coaches: [], products: [] };
        if (name !== "tn_r4_dev_branch_catalog") throw Error("unexpected RPC");
        const branchId = args.p_branch;
        if (args.p_action === "options") return branchId === ids.branchA
          ? { branchId, products: product ? [product, paid] : [paid], members: [{ id: ids.memberA, name: "합성 A" }] }
          : { branchId, products: [], members: [{ id: ids.memberB, name: "합성 B" }] };
        if (args.p_action === "product") {
          product = { id: ids.product, ...args.p_terms };
          return { branchId, product };
        }
        if (args.p_product !== ids.product || args.p_member !== ids.memberA || branchId !== ids.branchA) throw Error("wrong scope");
        return { branchId, productId: ids.product, memberId: ids.memberA, ticketId: ids.ticket, total: 7, days: 43,
          minutes: 30, expiresOn: "2026-12-23", price: 0, payment: false };
      },
    };
    window.TennisNoteR4BranchOperations.refresh({ allowed: true, client: window.client });
  }, { ids });
  const action = page.getByLabel("지점 설정");
  const status = page.getByRole("status");
  await action.selectOption("product");
  await page.getByLabel("상품 이름").fill("비공개 검증 상품");
  await page.getByLabel("수업 시간").selectOption("30");
  await page.getByLabel("횟수").fill("7");
  await page.getByLabel("유효기간(일)").fill("43");
  await page.getByLabel("상품 가격(원)").fill("0");
  await page.getByRole("button", { name: "상품 등록" }).click();
  await status.filter({ hasText: "비공개 상품 조건을 저장하고 확인했습니다." }).waitFor();
  await action.selectOption("issue");
  assert.equal(await page.locator('[name="catalogProduct"] option').count(), 2);
  await page.getByLabel("0원 상품").selectOption(ids.product);
  await page.getByLabel("이 지점 회원").selectOption(ids.memberA);
  await page.getByRole("button", { name: "회원권 등록" }).click();
  await status.filter({ hasText: "등록 확인 · 30분 · 7회" }).waitFor();
  const calls = await page.evaluate(() => window.calls.filter(([name]) => name === "tn_r4_dev_branch_catalog").map(([, args]) => args));
  assert.deepEqual(calls.map(args => args.p_action), ["options", "product", "options", "issue", "read"]);
  assert.deepEqual(calls[1].p_terms, { name: "비공개 검증 상품", minutes: 30, sessions: 7, days: 43, price: 0 });
  await page.locator("#r4ManagedBranch").selectOption(ids.branchB);
  await action.selectOption("issue");
  assert.equal(await page.getByRole("button", { name: "회원권 등록" }).isEnabled(), false);
  assert.equal(await page.locator('[name="catalogProduct"] option').count(), 1);
  await page.evaluate(() => { window.target = "production"; window.calls = []; });
  await page.locator("#r4ManagedBranch").selectOption(ids.branchA);
  await page.getByRole("button", { name: "정책 저장" }).waitFor();
  assert.deepEqual(await page.locator('option[value="issue"]').evaluate(option =>
    ({ disabled: option.disabled, hidden: option.hidden })), { disabled: true, hidden: true });
  assert.deepEqual(await page.evaluate(() => window.calls.map(([name]) => name)), ["tn_r4_branch_operations_options"]);
  console.log("R4_BRANCH_CATALOG_WEB_DELTA_PASS: product terms, issue/read, branch switch, zero-only, production RPC 0");
} finally {
  await browser.close();
}
