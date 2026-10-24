// 실제 modular entry와 private 권위 함수의 로컬 합성 회귀. 외부 호출/저장 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import vm from "node:vm";
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const fn = (text, name) => {
  const found = text.match(new RegExp("^(?:async )?function " + name + "\\([\\s\\S]*?^}", "m"));
  assert(found, "실제 함수가 없으면 추측 대체 금지: " + name);
  return found[0];
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const noExternal = () => { throw Error("external network forbidden in synthetic test"); };

function fixture(mode, cache = "zero") {
  const elements = new Map(), documentEvents = new Map(), pending = [];
  let historyReads = 0, snapshotSaves = 0;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === "#coachSettlementModal", textContent: "", innerHTML: "", value: "", dataset: {},
      listeners: new Map(),
      addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
      },
    });
    return elements.get(selector);
  };
  const c = vm.createContext({
    window: { addEventListener() {}, fetch: noExternal }, fetch: noExternal,
    document: {
      hidden: false, body: { dataset: { activeView: "membersView" } },
      addEventListener(type, handler) {
        if (!documentEvents.has(type)) documentEvents.set(type, []);
        documentEvents.get(type).push(handler);
      },
    },
    state: {
      coach: { branchId: "synthetic-branch", coachRoleId: "synthetic-coach" }, month: "2099-01",
      coachSettlement: cache === "empty" ? null : { estimatedSettlement: 0, settledSessions: 0, paymentCount: 0, rows: [] },
      coachSettlementLoading: false, coachSettlementError: cache === "error" ? "synthetic prior error" : "",
      coachSettlementReconciliationLoading: false, coachSettlementReconciliationSubmitting: false,
    },
    token: "synthetic-session-not-a-credential", $: element, $$: () => [],
    logoutCoach() {}, saveCoachProfile() {}, renderAll() {},
    saveSnapshot() { snapshotSaves += 1; },
    coachSettlementMonth: () => c.state.month,
    coachSettlementReconciliationScope: () => ({ ...c.state.coach, settlementMonth: c.state.month + "-01" }),
    coachSettlementReconciliationScopeSignature: scope => JSON.stringify(scope || c.coachSettlementReconciliationScope()),
    formatCoachWon: amount => String(Number(amount) || 0),
    coachSettlementRuleLabel: () => "합성 기본 정산",
    escapeHtml: value => String(value ?? ""), coachEmptyState: () => "<p>합성 빈 상태</p>",
    openCoachModal(id) { element("#" + id).hidden = false; },
    closeCoachModal(id) { element("#" + id).hidden = true; },
    setView(view) { c.document.body.dataset.activeView = view; },
  });
  c.window.TennisNoteDataClient = {
    getSession: () => c.token ? { access_token: c.token } : null,
    rpc(name, args) {
      assert.equal(name, "tn_coach_settlement_scope_v2", "새 API/고급 쓰기 금지");
      assert.equal(args.target_branch_id, "synthetic-branch");
      assert.equal(args.target_coach_role_id, "synthetic-coach");
      return new Promise((resolve, reject) => pending.push({ resolve, reject, args }));
    },
  };
  vm.runInContext(read(path.join(PUBLIC, "app/shared/tennisnote-settlement-adjustment.js")), c);
    for (const relative of ["data/sync.js", "ui/screens.js", "views/settlement.js", "events/account.js", "events/delegated.js"]) {
      vm.runInContext(read(path.join(PUBLIC, "app/tennis-note-coach-app", relative)), c, { filename: relative });
    }
    // 별도 고급 이력의 서버/렌더는 이번 BASIC 대상이 아니다. 기존 호출은 보존한다.
    c.syncCoachSettlementHistoryFromServer = async () => { historyReads += 1; return true; };
    c.renderCoachSettlementHistory = () => {};
    c.bindAccountEvents(); c.bindDelegatedEvents();

  const open = entry => {
    if (entry === "summary") {
      for (const handler of element("#coachSettlementSummaryButton").listeners.get("click") || []) handler();
    } else {
      const event = { target: { closest: selector => selector === "[data-open-coach-settlement]" ? { dataset: {} } : null } };
      for (const handler of documentEvents.get("click") || []) handler(event);
    }
  };
  return { c, pending, element, open, historyReads: () => historyReads, snapshotSaves: () => snapshotSaves };
}

function response(args, amount = 14400, sessions = 1) {
  return {
    ok: true, calculationVersion: "r3_effective_settlement_v2", sourceFingerprint: "a".repeat(64), confirmationReady: false,
    scope: { branchId: args.target_branch_id, coachRoleId: args.target_coach_role_id, settlementMonth: args.target_month },
    totals: { totalSettlementAmount: amount, revenueAmount: 0, settledSessions: sessions, settledMinutes: sessions * 20, paymentCount: 0 },
    sourceManifest: { tickets: [{ id: "synthetic-ticket", userId: "synthetic-member" }] },
    lines: sessions ? [{ sourceTicketId: "synthetic-ticket", settlementAmount: amount, settledSessions: sessions,
      settledMinutes: sessions * 20, totalSessions: 5, netAmount: 0, calculationComponents: [] }] : [],
  };
}

test("캐시가 있는 0원도 actual 두 진입점에서 BASIC 재조회 정확히1회", async () => {
  for (const mode of ["public"]) for (const entry of ["summary", "delegated"]) {
    const s = fixture(mode); s.open(entry);
    assert.equal(s.pending.length, 1, mode + "/" + entry + " cached0 must revalidate");
    assert.equal(s.c.state.coachSettlementLoading, true);
    assert.equal(s.element("#coachEstimatedSettlement").textContent, "—", "로딩 중 캐시를 최신 금액으로 표시하지 않음");
    s.pending[0].resolve(response(s.pending[0].args)); await tick();
    assert.equal(s.c.state.coachSettlement.estimatedSettlement, 14400);
    assert.equal(s.element("#coachEstimatedSettlement").textContent, "14400");
    assert.equal(s.element("#coachSettledSessions").textContent, "1회");
    assert.equal(s.historyReads(), 1, "고급 이력 호출 의미 유지");
  }
});

test("initial empty/error도 actual 한 open당 BASIC1회, 기존 두entry 중복호출0", async () => {
  for (const mode of ["public"]) for (const entry of ["summary", "delegated"]) for (const cache of ["empty", "error"]) {
    const s = fixture(mode, cache); s.open(entry);
    assert.equal(s.pending.length, 1, mode + "/" + entry + "/" + cache);
    assert.equal(s.c.state.coachSettlementError, "");
    s.pending[0].resolve(response(s.pending[0].args)); await tick();
    assert.equal(s.snapshotSaves(), 1);
  }
});

test("닫기 후 다시 열면 정리후0 결과도 서버에서 새로 확인", async () => {
  for (const mode of ["public"]) {
    const s = fixture(mode); s.open("summary");
    s.pending[0].resolve(response(s.pending[0].args)); await tick();
    s.c.closeCoachSettlementModal(); assert.equal(s.element("#coachSettlementModal").hidden, true);
    s.open("delegated"); assert.equal(s.pending.length, 2);
    s.pending[1].resolve(response(s.pending[1].args, 0, 0)); await tick();
    assert.equal(s.element("#coachEstimatedSettlement").textContent, "0");
    assert.equal(s.element("#coachSettledSessions").textContent, "0회");
    assert.equal(s.c.state.coachSettlementError, "");
  }
});

test("조회 실패를0원 성공으로 바꾸지 않고 기존 명시 재시도만 허용", async () => {
  for (const mode of ["public"]) {
    const s = fixture(mode); s.open("summary");
    s.pending[0].reject(Error("settlement_hold_refund")); await tick();
    assert.equal(s.c.state.coachSettlement, null); assert(s.c.state.coachSettlementError);
    assert.equal(s.element("#coachEstimatedSettlement").textContent, "—");
    assert.equal(s.pending.length, 1, "자동 재시도 루프 없음");
    const retry = s.c.syncCoachSettlementFromServer();
    assert.equal(s.pending.length, 2); s.pending[1].resolve(response(s.pending[1].args));
    assert.equal(await retry, true);
  }
});

test("기존 sequence/scope fence는 역순 성공·오류와 다른월을 그대로 방어", async () => {
  for (const mode of ["public"]) for (const failOld of [false, true]) {
    const s = fixture(mode); s.open("summary"); s.c.state.month = "2099-02"; s.open("delegated");
    assert.equal(s.pending.length, 2);
    s.pending[1].resolve(response(s.pending[1].args)); await tick();
    if (failOld) s.pending[0].reject(Error("synthetic obsolete error")); else s.pending[0].resolve(response(s.pending[0].args, 0, 0));
    await tick(); assert.equal(s.c.state.coachSettlement.estimatedSettlement, 14400);
    assert.equal(s.c.state.coachSettlementError, ""); assert.equal(s.c.state.coachSettlementLoading, false);
  }
});

test("권위 코치나 세션이 없으면 open 후에도 BASIC RPC0", () => {
  for (const mode of ["public"]) for (const missing of ["coach", "session"]) {
    const s = fixture(mode); if (missing === "coach") s.c.state.coach = null; else s.c.token = "";
    s.open("summary"); assert.equal(s.pending.length, 0);
  }
});

test("기존 BASIC 계산·scope·generation·finally 불변 및 실제 entry 재조회 단일 소유", () => {
  assert.equal(sha(fn(read(path.join(PUBLIC, "app/tennis-note-coach-app/data/sync.js")), "syncCoachSettlementFromServer")),
    "f525532488903d1c90d4c9c46461548357904b2b7e6d064d0948f65d6d4db855");
  for (const relative of ["events/account.js", "events/delegated.js"]) {
    assert(!read(path.join(PUBLIC, "app/tennis-note-coach-app", relative)).includes("if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();"));
  }
  const open = fn(read(path.join(PUBLIC, "app/tennis-note-coach-app/ui/screens.js")), "openCoachSettlement");
  assert.equal(open.split("void syncCoachSettlementFromServer();").length - 1, 1);
  assert.equal(open.split("void syncCoachSettlementHistoryFromServer();").length - 1, 1);
});
