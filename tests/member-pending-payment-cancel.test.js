const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("member pending payments are restored and safely cancellable", () => {
  const paymentData = read("app/tennis-note-member-app/data/payment.js");
  const paymentActions = read("app/tennis-note-member-app/actions/payment.js");
  const products = read("app/tennis-note-member-app/views/products.js");
  const journal = read("app/tennis-note-member-app/domain/journal.js");
  const session = read("app/tennis-note-member-app/actions/session.js");

  assert.match(paymentData, /portone-payment\/member-pending/);
  assert.match(paymentData, /serverSynced: true/);
  assert.match(paymentData, /cancellable: \["ready", "failed"\]\.includes\(status\)/);
  assert.match(paymentData, /body: \{ paymentId, reason: "회원 결제 대기 취소" \}/);
  assert.match(paymentActions, /serverSynced: overrides\.serverSynced === true \|\| Boolean\(overrides\.serverPaymentId\)/);
  assert.match(products, /data-cancel-pending-purchase=/);
  assert.match(journal, /request\.cancellable !== true/);
  assert.match(session, /syncMemberPendingPaymentsFromServer\(\)/);
});
