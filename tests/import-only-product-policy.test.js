import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const source = read("app/tennis-note-member-app/forms/tickets.js");
const mapper = source.slice(source.indexOf("function membershipProductFromServer("), source.indexOf("\nfunction memberScheduleCoachTickets(")).trim();
const context = vm.createContext({
  window: {}, numericValue: (value, fallback = 0) => Number(value ?? fallback),
  normalizeProduct: (value) => value, isOneDayMembershipProduct: () => false,
});
vm.runInContext(mapper, context);

test("가져오기 전용 상품은 구매에서 숨기고 기존 상품 필드는 보존한다", () => {
  for (const [policy, expected] of [
    [{ importOnly: true, adminSaleStatus: "sale" }, "hidden"],
    [{ importOnly: true, adminSaleStatus: "consult" }, "hidden"],
    [{ memberCheckoutVisible: false, adminSaleStatus: "sale" }, "hidden"],
    [{ memberCheckoutVisible: false, adminSaleStatus: "consult" }, "hidden"],
    [{ importOnly: false, memberCheckoutVisible: true }, "sale"],
    [{}, "sale"], [{ adminSaleStatus: "consult" }, "consult"],
    [{ adminSaleStatus: "hidden" }, "hidden"],
  ]) {
    const product = context.membershipProductFromServer({ id: "synthetic-product", name: "합성 정규권", total_sessions: 5, policy_settings: policy });
    assert.equal(product.status, expected);
    assert.equal(product.id, "synthetic-product");
    assert.equal(product.title, "합성 정규권");
    assert.equal(product.tickets, 5);
  }
});

test("구매 필터와 소유 회원권 분류는 독립 경로다", () => {
  const domain = read("app/tennis-note-member-app/domain/tickets.js");
  const purchase = domain.slice(domain.indexOf("function membershipProducts("), domain.indexOf("\nfunction activeMembershipPresetId("));
  const history = source.slice(source.indexOf("function historicalLiveTickets("), source.indexOf("\nfunction ", source.indexOf("function historicalLiveTickets(") + 1));
  Object.assign(context, { state: { dataMode: "live", liveMembershipProducts: [
    context.membershipProductFromServer({ id: "hidden", policy_settings: { importOnly: true } }),
    context.membershipProductFromServer({ id: "sale" }),
  ], liveTickets: [{ id: "owned", productId: "hidden", status: "expired", remaining: 0 }], expiredTickets: [] },
  membershipProductFamilyId: () => "regular", distinctTicketsByExactId: (items) => items });
  vm.runInContext(`${purchase}\n${history}`, context);
  assert.deepEqual(Array.from(context.membershipProducts(), (item) => item.id), ["sale"]);
  assert.deepEqual(Array.from(context.historicalLiveTickets(), (item) => item.id), ["owned"]);
});

test("비공개 권위 함수와 공개 모듈의 정규화 hash가 일치한다", () => {
  const manifest = JSON.parse(read("tests/fixtures/import-only-product-source-parity.json"));
  const normalized = mapper.replace(/^\s*\/\/.*\n/gm, "");
  assert.equal(createHash("sha256").update(normalized).digest("hex"), manifest.mapperWithoutCommentsSha256);
  assert.equal(createHash("sha256").update(manifest.hunk).digest("hex"), manifest.hunkSha256);
  assert.equal(mapper.split(manifest.hunk).length - 1, 1);
});
