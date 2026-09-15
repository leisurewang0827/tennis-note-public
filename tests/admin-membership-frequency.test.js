import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const P = loadAdminDomain("app/admin/domain/policy.js");

test("회원권 상품명과 주 횟수는 같은 권위 파서로 판정한다", () => {
  assert.equal(P.membershipProductTitleFrequencyPerWeek({ title: "개인 주 2회 20분", productKind: "regular" }), 2);
  assert.equal(P.membershipProductTitleFrequencyPerWeek({ title: "개인 · 평일 1회(30분)", productKind: "regular" }), 1);
  assert.equal(P.membershipProductTitleFrequencyPerWeek({ title: "원데이 쿠폰", productKind: "coupon" }), null);

  assert.equal(P.membershipProductFrequencyConsistencyIssue({
    title: "개인 · 평일 1회(30분)",
    productKind: "regular",
    frequencyPerWeek: 1,
  }), "");
  assert.match(P.membershipProductFrequencyConsistencyIssue({
    title: "개인 · 평일 1회(30분)",
    productKind: "regular",
    frequencyPerWeek: 2,
  }), /주 1회.*2회/u);
});

test("레거시 0 값도 상품명과 같은 주 횟수로만 보정한다", () => {
  const normalized = P.membershipProductWithOperationalLimits({
    title: "개인 · 평일 1회(30분)",
    productKind: "regular",
    tickets: 6,
    frequencyPerWeek: 0,
  });
  assert.equal(normalized.frequencyPerWeek, 1);
  assert.equal(normalized.maxSessionsPerWeek, 1);
});
