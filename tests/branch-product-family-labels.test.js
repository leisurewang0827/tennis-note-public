import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("지점 판매 설정은 네 분류 표시명과 16·16·4·1 미리보기를 한 계약으로 보존한다", () => {
  const policy = source("app/admin/domain/policy.js");
  const forms = source("app/admin/forms/common.js");
  const views = source("app/admin/views/common.js");
  const actions = source("app/admin/actions/settings.js");
  const events = source("app/admin/events/delegated.js");
  const styles = source("app/admin/styles.css");

  for (const label of ["한달 (4주)", "3개월 (10% 할인)", "쿠폰 레슨", "원데이 1회"]) {
    assert.match(policy, new RegExp(label.replace(/[()]/g, "\\$&")));
  }
  assert.match(policy, /candidate && \[\.\.\.candidate\]\.length <= 40/);
  assert.match(forms, /data-sales-family-label/);
  assert.match(views, /\[\["fourWeek", 16\], \["threeMonth", 16\], \["coupon", 4\], \["oneDay", 1\]\]/);
  assert.match(views, /escapeHtml\(familyLabels\[key\]\)/);
  assert.match(views, /maxlength="40" required/);
  assert.match(actions, /회원권 분류명은 1~40자로 입력해 주세요/);
  assert.match(events, /resetBranchSalesFamilyLabelsButton/);
  assert.match(styles, /\.branch-sales-family-labels\s*\{[^}]*repeat\(2,/s);
  assert.match(styles, /\.branch-sales-preview-families strong\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test("회원 화면은 서버 표시명을 정규화해 모든 구매 분류 위치에 재사용한다", () => {
  const app = source("app/tennis-note-member-app/app.js");
  const catalog = source("app/tennis-note-member-app/catalog.js");
  const products = source("app/tennis-note-member-app/domain/products.js");
  const purchase = source("app/tennis-note-member-app/domain/purchase.js");
  const productViews = source("app/tennis-note-member-app/views/products.js");
  const commonViews = source("app/tennis-note-member-app/views/common.js");
  const payment = source("app/tennis-note-member-app/data/payment.js");
  const storage = source("app/tennis-note-member-app/storage.js");

  assert.match(app, /productFamilyLabels/);
  assert.match(catalog, /defaultMembershipProductFamilyLabels/);
  assert.match(products, /function membershipProductFamilyDisplayLabel/);
  assert.match(products, /candidate && \[\.\.\.candidate\]\.length <= 40/);
  assert.match(payment, /options\?\.productFamilyLabels/);
  assert.match(storage, /normalizeMembershipProductFamilyLabels/);
  assert.match(productViews, /escapeHtml\(membershipProductFamilyDisplayLabel\(preset\.id\)\)/);
  assert.match(purchase, /membershipProductFamilyDisplayLabel\(family\.id\)/);
  assert.match(commonViews, /membershipProductFamilyDisplayLabel\(family\.id\)/);
});
