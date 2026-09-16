import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("회원 환불 요청은 미리보기와 멱등 operation key를 거쳐 관리자 처리 전에는 결제를 바꾸지 않는다", () => {
  const refunds = source("app/tennis-note-member-app/actions/refunds.js");
  const tickets = source("app/tennis-note-member-app/views/tickets.js");
  const html = source("app/tennis-note-member-app/index.html");

  assert.match(refunds, /portone-payment\/refund-request-preview/);
  assert.match(refunds, /portone-payment\/refund-request-submit/);
  assert.match(refunds, /operationKey: memberRefundRequestFlow\.operationKey/);
  assert.match(refunds, /if \(!ticket \|\| !preview \|\| memberRefundRequestFlow\.submitting\) return/);
  assert.match(refunds, /요청 접수만으로 결제 취소나 계좌 송금, 회원권 변경은 실행되지 않습니다/);
  assert.match(tickets, /data-open-member-refund-request/);
  assert.match(html, /id="memberRefundRequestSheet"/);
  assert.match(html, /actions\/refunds\.js/);
});

test("관리자는 exact 결제의 회원 요청을 검토하고 성공 뒤 결제 캐시를 강제로 갱신한다", () => {
  const data = source("app/admin/data/billing.js");
  const ui = source("app/admin/ui/billing.js");
  const app = source("app/admin/app.js");
  const views = source("app/admin/views/billing.js");

  assert.match(data, /portone-payment\/refund-request-admin-list/);
  assert.match(data, /String\(request\.providerPaymentId \|\| ""\) === String\(item\.providerPaymentId \|\| ""\)/);
  assert.match(ui, /memberRefundRequestId: refundFlowState\.memberRequest\?\.requestId/);
  assert.match(ui, /memberRefundRequestRevision: refundFlowState\.memberRequest\?\.revision/);
  assert.match(ui, /portone-payment\/refund-request-review/);
  assert.match(views, /회원 환불 요청/);

  const forceRefreshCount = [ui, app]
    .map((text) => text.match(/loadServerPaymentsIntoBilling\(\{ silent: true, force: true \}\)/g) || [])
    .reduce((total, matches) => total + matches.length, 0);
  assert.ok(forceRefreshCount >= 4, `환불 후 강제 새로고침 ${forceRefreshCount}개`);
});

test("코치 앱은 관리자 웹 진입을 노출하거나 호출하지 않는다", () => {
  const files = [
    "app/tennis-note-coach-app/index.html",
    "app/tennis-note-coach-app/views/profile.js",
    "app/tennis-note-coach-app/events/account.js",
    "app/tennis-note-coach-app/ui/screens.js",
  ].map(source);
  files.forEach((text) => {
    assert.doesNotMatch(text, /adminWebPortalButton/);
    assert.doesNotMatch(text, /관리자 웹 열기/);
    assert.doesNotMatch(text, /openCoachExternalPortal/);
  });
  assert.match(files[0], /내 담당 회원만 표시됩니다/);
});
