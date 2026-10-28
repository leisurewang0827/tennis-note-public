import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const page = "app/tennis-note-coach-app";
const html = read(`${page}/index.html`);
const modules = [
  "app/shared/tennisnote-escape-html.js",
  "app/shared/tennisnote-settlement-adjustment.js",
  `${page}/domain/settlement.js`, `${page}/views/settlement.js`,
  `${page}/data/sync.js`, `${page}/ui/screens.js`,
];
const order = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
  .map(match => resolve(root, page, match[1].split("?")[0]));

function element() {
  return {
    dataset: {}, children: [], value: "", textContent: "", innerHTML: "", hidden: false, disabled: false,
    setAttribute(name, value) { this[name] = value; },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); },
    replaceChildren(...items) { this.children = items; },
    querySelectorAll() { return []; }, addEventListener() {},
  };
}

// 실제 HTML의 모듈 순서와 원문을 사용한다. 렌더/조회/진입 함수는 대체하지 않는다.
// DOM과 transport만 합성이며 외부 네트워크와 저장 RPC는 허용하지 않는다.
function harness() {
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [`#${match[1]}`, element()]));
  const calls = [], modals = [], snapshots = [];
  let session = { access_token: "synthetic-session-only" };
  let scopeReply = scope => ({
    ok: true, scope, calculationVersion: "r3_effective_settlement_v2", sourceFingerprint: "a".repeat(64),
    confirmationReady: false, sourceManifest: { tickets: [] }, lines: [],
    totals: { totalSettlementAmount: 0, ownSettlementAmount: 0, substituteSettlementAmount: 0,
      substituteSessionCount: 0, revenueAmount: 0, settledSessions: 0, settledMinutes: 0, paymentCount: 0 },
  });
  const document = { body: { dataset: { activeView: "profileView" } }, createElement: element };
  const state = {
    dataMode: "live", liveProfileId: "synthetic-profile", coachSettlement: null,
    coach: { branchId: "synthetic-branch", coachRoleId: "synthetic-role", authUserId: "synthetic-auth", role: "coach" },
  };
  const client = {
    getSession: () => session,
    async rpc(name, args) {
      calls.push({ name, args });
      const shortKeys = name === "tn_monthly_settlement_adjustment_state";
      const scope = { branchId: shortKeys ? args.b : args.target_branch_id,
        coachRoleId: shortKeys ? args.c : args.target_coach_role_id, settlementMonth: shortKeys ? args.m : args.target_month };
      if (name === "tn_coach_settlement_scope_v2") return scopeReply(scope);
      const empty = { state: "EMPTY", scope, snapshot: null, confirmation: null, reconciliation: null };
      if (name === "tn_coach_monthly_settlement_reconciliation_state") return empty;
      if (name === "tn_monthly_settlement_adjustment_state") return {
        ...empty, adjustment: { version: "r3_unpaid_adjustment_v1", head: null, headFingerprint: "0".repeat(64),
          originalAmount: 0, finalAmount: 0, events: [], response: null, writesEnabled: false, hasAnyPayout: false },
        payout: { state: "NOT_RECORDED", recordingEnabled: false, activeRecord: null, events: [] },
      };
      throw Error("unexpected_or_write_rpc");
    },
  };
  const context = vm.createContext({
    window: { TennisNoteDataClient: client }, document, state, Intl,
    $: selector => nodes.get(selector) || null,
    formatCoachWon: value => `${Number(value) || 0}원`,
    coachEmptyState: ({ title, description }) => `${title} ${description}`,
    setView: value => { document.body.dataset.activeView = value; },
    openCoachModal: id => modals.push(["open", id]), closeCoachModal: id => modals.push(["close", id]),
    saveSnapshot: () => snapshots.push(state.coachSettlement),
    fetch: () => { throw Error("network_forbidden"); },
  });
  const loaded = modules.map(path => ({ path, index: order.indexOf(resolve(root, path)) }));
  assert.ok(loaded.every(item => item.index >= 0), "실제 HTML entry가 모든 모듈을 로드해야 함");
  for (const item of loaded.sort((a, b) => a.index - b.index)) {
    assert.equal(order.filter(path => path === resolve(root, item.path)).length, 1);
    vm.runInContext(read(item.path), context, { filename: item.path });
  }
  assert.equal(typeof context.renderCoachSettlementReconciliation, "undefined", "monolith의 누락 이름을 스텁으로 숨기지 않음");
  return { context, calls, nodes, state, modals, snapshots, document,
    setReply: reply => { scopeReply = reply; }, clearSession: () => { session = null; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("실제 modular 정산 진입: 상세와 현재 계산/확정이력 조회까지 연결, 쓰기 RPC 0", async () => {
  const h = harness();
  h.context.openCoachSettlement();
  await flush();
  assert.deepEqual(h.modals, [["open", "coachSettlementModal"]]);
  assert.equal(h.document.body.dataset.activeView, "membersView");
  assert.deepEqual(h.calls.map(call => call.name), [
    "tn_coach_settlement_scope_v2", "tn_coach_monthly_settlement_reconciliation_state", "tn_monthly_settlement_adjustment_state",
  ]);
  for (const call of h.calls) {
    const shortKeys = call.name === "tn_monthly_settlement_adjustment_state";
    assert.equal(call.args[shortKeys ? "c" : "target_coach_role_id"], "synthetic-role");
    assert.equal(call.args[shortKeys ? "b" : "target_branch_id"], "synthetic-branch");
  }
  assert.equal(h.state.coachSettlementLoading, false);
  assert.equal(h.state.coachSettlementError, "");
  assert.equal(h.nodes.get("#coachSettlementReconciliation").dataset.state, "EMPTY");
  assert.equal(h.nodes.get("#coachSettlementReconciliationStateBadge").textContent, "확정 대기");
  assert.equal(h.nodes.get("#coachSettlementReconciliationForm").hidden, true);
  assert.equal(h.snapshots.length, 1);
});

test("실제 정산 refresh 오류: 오류·다시 확인 표시, 자동 재시도/저장 0", async () => {
  const h = harness();
  h.setReply(() => { throw Error("settlement_hold_source"); });
  assert.equal(await h.context.syncCoachSettlementFromServer(), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.state.coachSettlement, null);
  assert.match(h.state.coachSettlementError, /확인 필요/);
  assert.equal(h.nodes.get("#coachSettlementStatus").hidden, false);
  assert.equal(h.nodes.get("#refreshCoachSettlement").hidden, false);
  assert.equal(h.state.coachSettlementLoading, false);
});

test("실제 정산 refresh stale 응답: 바뀐 월의 상태를 이전 실패가 덮어쓰지 않음", async () => {
  const h = harness(), pending = [];
  h.setReply(() => new Promise((_resolve, reject) => pending.push(reject)));
  const first = h.context.syncCoachSettlementFromServer();
  h.context.selectCoachSettlementMonth("2099-01");
  const second = h.context.syncCoachSettlementFromServer();
  pending[1](Error("settlement_hold_substitute_manual"));
  assert.equal(await second, false);
  const currentError = h.state.coachSettlementError;
  pending[0](Error("old_transport_error"));
  assert.equal(await first, false);
  assert.equal(h.state.coachSettlementError, currentError);
  assert.match(currentError, /대타 확인 필요/);
  assert.equal(h.calls.length, 2);
  assert.equal(h.snapshots.length, 1);
});

test("실제 정산 refresh 인증 없음: 서버 호출 0", async () => {
  const h = harness();
  h.clearSession();
  assert.equal(await h.context.syncCoachSettlementFromServer(), false);
  assert.equal(h.calls.length, 0);
});

test("실제 정산 상세 닫기/재진입: 현재 이력 렌더 재사용, 과거 전역 별칭 불필요", async () => {
  const h = harness();
  h.context.openCoachSettlement();
  await flush();
  h.context.closeCoachSettlementModal();
  h.context.openCoachSettlement();
  await flush();
  assert.deepEqual(h.modals.map(item => item[0]), ["open", "close", "open"]);
  assert.equal(h.calls.filter(call => call.name === "tn_coach_settlement_scope_v2").length, 2);
  assert.equal(h.nodes.get("#coachSettlementReconciliation").dataset.state, "EMPTY");
});
