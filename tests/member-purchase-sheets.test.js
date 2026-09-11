import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("회원권 구매 변경 버튼에 필요한 바텀시트가 공개 HTML에 모두 존재한다", () => {
  const html = source("app/tennis-note-member-app/index.html");
  const events = source("app/tennis-note-member-app/events/delegated.js");
  const memberApp = source("app/tennis-note-member-app/app.js");
  const catalog = source("app/tennis-note-member-app/catalog.js");
  const purchase = source("app/tennis-note-member-app/domain/purchase.js");
  const commonViews = source("app/tennis-note-member-app/views/common.js");
  const styles = source("app/tennis-note-member-app/styles.css");

  assert.match(html, /id="purchaseProductSheet"/);
  assert.match(html, /id="purchaseProductSheetOptions"/);
  assert.match(html, /id="purchaseScheduleSheet"/);
  assert.match(html, /id="purchaseScheduleSheetCoachOptions"/);
  assert.match(html, /id="purchaseScheduleSheetGrid"/);
  assert.match(html, /id="completePurchaseScheduleSelection"/);
  assert.match(events, /data-open-purchase-product/);
  assert.match(catalog, /pickerLabel: "한달 \(4주\)"/);
  assert.match(catalog, /pickerLabel: "3개월 \(10% 할인\)"/);
  assert.match(purchase, /<em>다시 선택<\/em>/);
  assert.match(commonViews, /const oneDay = flow\.familyId === "one-day" \|\| membershipProductFamilyId\(purchaseFlowProduct\(\) \|\| \{\}\) === "one-day"/);
  assert.match(styles, /\.purchase-family-grid\s*\{[^}]*grid-template-columns: repeat\(2,/s);
  assert.match(events, /data-open-purchase-schedule/);
  assert.match(memberApp, /const scheduleReady = flexibleCoupon/);
  assert.match(memberApp, /completeButton\.setAttribute\("aria-disabled", String\(!scheduleReady\)\)/);
  assert.match(memberApp, /completeButton\.setAttribute\("aria-describedby", "purchaseScheduleSheetSummary"\)/);
  assert.match(styles, /\.purchase-schedule-sheet-actions \.primary-button:disabled/);
  assert.match(styles, /background: #e9eeeb/);
});

test("구매 상품은 선택 조건에 맞는 판매 가능 목록을 세 개로 제한하지 않는다", () => {
  const purchase = source("app/tennis-note-member-app/domain/purchase.js");
  const memberApp = source("app/tennis-note-member-app/app.js");

  assert.match(purchase, /const visibleProducts = matchingProducts;/);
  assert.doesNotMatch(purchase, /matchingProducts\.slice\(0, 3\)/);
  assert.match(purchase, /visibleProducts\.map\(\(product\) => purchaseProductCard\(product, String\(product\.id\) === String\(flow\.productId\)\)\)/);
  assert.match(purchase, /renewing \? "조건 일치 상품" : "상품"/);
  assert.match(memberApp, /if \(\["coupon", "one-day"\]\.includes\(flow\.familyId\)\) return familyProducts;/);
  assert.match(memberApp, /if \(\["coupon", "one-day"\]\.includes\(flow\.familyId\)\) return "";/);
  assert.doesNotMatch(memberApp, /if \(renewing \|\| \["coupon", "one-day"\]\.includes\(flow\.familyId\)\)/);
  assert.doesNotMatch(memberApp, /\(flow\.purchasePurpose === "renew_same" && purchaseFlowSourceTicket\(\)\)\) return ""/);
});
