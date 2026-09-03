import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("월별 결제 장부에서 선택한 회원권을 행 안에서 바로 편집한다", () => {
  const billingView = source("app/admin/views/billing.js");
  const billingUi = source("app/admin/ui/billing.js");
  const delegated = source("app/admin/events/delegated.js");
  const commonView = source("app/admin/views/common.js");

  assert.match(billingView, /data-billing-member-review/);
  assert.match(billingView, /billing-inline-editor-row/);
  assert.match(billingView, /context:\s*"billing"/);
  assert.match(billingView, /hideSchedule:\s*true/);
  assert.match(billingUi, /billingMemberTicketContext\(item\)/);
  assert.match(billingUi, /state\.billingInlineIndex/);
  assert.match(delegated, /data-billing-member-review/);
  assert.match(delegated, /memberInlineContext === "billing"/);
  assert.match(commonView, /data-member-inline-context/);
});

test("결제 장부 저장은 정확한 ticket id RPC를 사용하고 시간표를 건드리지 않는다", () => {
  const action = source("app/admin/actions/member.js");

  assert.match(action, /target_ticket_id:\s*ticket\.serverTicketId/);
  assert.match(action, /tn_admin_update_ticket_and_payment_grid/);
  assert.match(action, /target_future_schedule_mode:\s*scheduleReplacementRequested \? "replace" : "preserve"/);
  assert.match(action, /form\.dataset\.memberInlineContext === "billing"/);
});

test("재등록은 새 회원권 화면 대신 기존 ticket 횟수 누적 RPC를 사용한다", () => {
  const memberAction = source("app/admin/actions/member.js");
  const memberView = source("app/admin/views/members.js");
  const memberScreen = source("app/tennis-note-member-app/ui/screens.js");

  assert.match(memberAction, /tn_admin_accumulate_member_ticket_entitlement/);
  assert.match(memberAction, /sourceTicketId:\s*ticket\.serverTicketId/);
  assert.match(memberAction, /const addedSessions = Number\(form\.elements\.addedSessions\.value\)/);
  assert.match(memberAction, /addedSessions,/);
  assert.match(memberAction, /tn_ticket_entitlement_events/);
  assert.match(memberAction, /operation_key:\s*reenrollVerificationPayload\.operationKey/);
  assert.match(memberAction, /memberManagementWriteVerification\(action, action === "reenroll" \? reenrollVerificationPayload/);
  assert.match(memberView, /횟수 추가/);
  assert.match(memberScreen, /membershipTicketCanKeepSchedule/);
});

test("시간표 잔여횟수 부족은 등록 차단이 아니라 경고 후 저장 흐름을 유지한다", () => {
  const schedule = source("app/admin/schedule-v2-admin.js");

  assert.match(schedule, /잔여 0회 · 등록 후 연장 안내/);
  assert.match(schedule, /is-balance-warning/);
  assert.match(schedule, /data-v2-ticket-id/);
  assert.match(schedule, /admin-balance-warning-lesson/);
  assert.match(schedule, /수업 저장 완료 · 잔여 횟수가 부족합니다/);
});

test("관리자 결제 장부는 사용자 값을 이스케이프하고 7열·한 주행동만 기본 노출한다", () => {
  const billingView = source("app/admin/views/billing.js");
  const billingActions = source("app/admin/views/common.js");
  const billingDomain = source("app/admin/domain/payment.js");
  const billingHtml = source("app/admin/index.html");
  const billingCss = source("app/admin/styles.css");
  const paymentTable = billingHtml.match(/<table class="payment-sheet-table">[\s\S]*?<\/table>/)?.[0] || "";

  for (const marker of [
    "escapeHtml(item.member)",
    "escapeHtml(item.coach)",
    "escapeHtml(item.actualCoach)",
    "escapeHtml(settlementCoach)",
    "escapeHtml(item.paymentMethod)",
    "escapeHtml(item.discount)",
    "escapeHtml(serverPaymentSyncState.message)",
    "escapeHtml(ticket.member)",
    "escapeHtml(ticket.product)",
  ]) assert.match(billingView, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(billingView, /\son(?:click|error|load|mouseover|focus)\s*=/i);
  assert.match(billingView, /billingSafeUiTone/);
  assert.match(billingView, /처리 상세/);
  assert.match(billingView, /상세·위험 작업/);
  assert.match(billingView, /잠금 · PIN 설정 필요/);
  assert.match(billingActions, /if \(item\.status === "paid"\) return '<span class="payment-row-complete">처리 완료<\/span>'/);
  assert.doesNotMatch(billingActions.match(/function paymentActionFor[\s\S]*?\n}/)?.[0] || "", /payment(?:Pending|Approved)MoreActions/);
  assert.match(billingDomain, /결제·회원권 연결 완료/);
  assert.match(billingHtml, /0개 회원권/);
  assert.equal((paymentTable.match(/<th>/g) || []).length, 7);
  assert.match(billingCss, /\.payment-row-detail > summary[\s\S]*min-height:\s*44px/);
});
