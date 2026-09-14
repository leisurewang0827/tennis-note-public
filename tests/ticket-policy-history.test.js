import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSharedScript } from "./helpers/load-browser-script.js";

function policyHistory() {
  const context = loadSharedScript("app/shared/tennisnote-ticket-policy-history.js");
  return context.TennisNoteTicketPolicyHistory;
}

test("회원권의 주당 횟수는 결제 당시 snapshot을 현재 상품보다 우선한다", () => {
  const history = policyHistory();
  const result = history.resolveWeeklyFrequency({
    policy_snapshot: { product: { frequency_per_week: 2 } },
  }, { frequency_per_week: 5 });

  assert.equal(result.status, "snapshot_exact");
  assert.equal(result.value, 2);
  assert.equal(history.isUsable(result), true);
});

test("snapshot 충돌·누락은 현재 상품값으로 추정하지 않고 fail closed한다", () => {
  const history = policyHistory();
  const conflict = history.resolveWeeklyFrequency({
    policy_snapshot: {
      product: { frequency_per_week: 2 },
      frequency_per_week: 3,
    },
  }, { frequency_per_week: 5 });
  const missing = history.resolveWeeklyFrequency({}, { frequency_per_week: 5 });

  assert.equal(conflict.status, "snapshot_conflict");
  assert.equal(history.isUsable(conflict), false);
  assert.equal(missing.status, "snapshot_missing");
  assert.equal(missing.currentProductFrequency, 5);
  assert.equal(history.isUsable(missing), false);
});

test("유효한 기존 ticket 컬럼은 snapshot이 없을 때만 exact 근거로 사용한다", () => {
  const history = policyHistory();
  const exact = history.resolveWeeklyFrequency({ frequency_per_week: 3 }, { frequency_per_week: 5 });
  const invalid = history.resolveWeeklyFrequency({ frequency_per_week: 0 }, { frequency_per_week: 5 });

  assert.equal(exact.status, "ticket_exact");
  assert.equal(exact.value, 3);
  assert.equal(history.isUsable(exact), true);
  assert.equal(invalid.status, "ticket_invalid");
  assert.equal(history.isUsable(invalid), false);
});
