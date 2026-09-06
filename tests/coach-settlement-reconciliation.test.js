import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(join(root, file), "utf8");
const scope = {
  branchId: "fixture-branch",
  coachRoleId: "fixture-coach-role",
  settlementMonth: "2099-03-01",
};

function reconciliationPayload(state = "PENDING", reason = "") {
  const terminal = ["ACKNOWLEDGED", "DISPUTED"].includes(state);
  return {
    ok: true,
    state,
    scope: { ...scope },
    snapshot: {
      snapshotId: "fixture-snapshot",
      revision: 2,
      status: "calculated",
      calculationVersion: "r3_monthly_settlement_v1",
      sourceFingerprint: "a".repeat(64),
      totals: {
        settledSessions: 5,
        settledMinutes: 100,
        totalSettlementAmount: 125000,
      },
    },
    confirmation: {
      confirmationId: "fixture-confirmation",
      status: "confirmed",
      confirmationVersion: "r3_monthly_settlement_confirmation_v1",
      confirmedAt: "2099-03-31T15:00:00.000Z",
    },
    reconciliation: terminal ? {
      reconciliationId: "fixture-reconciliation",
      status: state.toLowerCase(),
      reason: state === "DISPUTED" ? reason : null,
      responseVersion: "r3_monthly_settlement_coach_reconciliation_v1",
      respondedAt: "2099-03-31T15:10:00.000Z",
    } : null,
  };
}

function loadSettlementContext(extra = {}) {
  const context = {
    state: {
      settlementMonth: "2099-03",
      coach: { branchId: scope.branchId, coachRoleId: scope.coachRoleId },
      coachSettlementReconciliation: null,
      coachSettlementReconciliationUiState: "EMPTY",
      coachSettlementReconciliationLoading: false,
      coachSettlementReconciliationSubmitting: false,
      coachSettlementReconciliationMessage: "",
      coachSettlementReconciliationValidation: "",
      coachSettlementReconciliationChoice: "",
      coachSettlementReconciliationReason: "",
      coachSettlementReconciliationOperation: null,
      coachSettlementReconciliationRequestId: 0,
    },
    localDateKey: () => "2099-03-01",
    formatCoachWon: (value) => `${Number(value) || 0}원`,
    renderCoachSettlementReconciliation: () => undefined,
    saveSnapshot: () => undefined,
    $: () => null,
    crypto: { randomUUID: () => "fixture-operation" },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(source("app/tennis-note-coach-app/domain/settlement.js"), context);
  return context;
}

test("코치 정산 응답은 exact scope·snapshot·confirmation 상태만 허용한다", () => {
  const C = loadSettlementContext();
  const pending = reconciliationPayload();
  assert.equal(C.coachSettlementReconciliationPayloadIsExact(pending, scope), true);
  assert.equal(C.coachSettlementReconciliationPayloadIsExact(reconciliationPayload("ACKNOWLEDGED"), scope), true);
  assert.equal(C.coachSettlementReconciliationPayloadIsExact(reconciliationPayload("DISPUTED", "횟수 합계 확인"), scope), true);

  const mutations = [
    (value) => { value.scope.branchId = "other"; },
    (value) => { value.scope.coachRoleId = "other"; },
    (value) => { value.scope.settlementMonth = "2099-04-01"; },
    (value) => { value.snapshot.revision = 0; },
    (value) => { value.snapshot.status = "draft"; },
    (value) => { value.snapshot.calculationVersion = "other"; },
    (value) => { value.snapshot.sourceFingerprint = "short"; },
    (value) => { value.snapshot.totals.settledSessions = "5"; },
    (value) => { value.snapshot.totals.totalSettlementAmount = -1; },
    (value) => { value.confirmation.status = "pending"; },
    (value) => { value.confirmation.confirmationVersion = "other"; },
    (value) => { value.confirmation.confirmedAt = "invalid"; },
  ];
  for (const mutate of mutations) {
    const candidate = reconciliationPayload();
    mutate(candidate);
    assert.equal(C.coachSettlementReconciliationPayloadIsExact(candidate, scope), false);
  }
});

test("이의 사유는 Unicode를 정규화하고 개인정보·링크를 fail-closed한다", () => {
  const C = loadSettlementContext();
  assert.equal(C.normalizeCoachSettlementReconciliationReason("  횟수\u200b  합계\n확인  "), "횟수 합계 확인");
  assert.equal(C.coachSettlementReconciliationReasonError("횟수 합계 확인"), "");
  assert.match(C.coachSettlementReconciliationReasonError("한"), /2~240자/);
  assert.match(C.coachSettlementReconciliationReasonError("a@example.invalid"), /개인정보/);
  assert.match(C.coachSettlementReconciliationReasonError("https://example.invalid"), /개인정보/);
  assert.match(C.coachSettlementReconciliationReasonError("010-1234-5678"), /개인정보/);
  assert.match(C.coachSettlementReconciliationReasonError("123e4567-e89b-12d3-a456-426614174000"), /개인정보/);
  assert.match(C.coachSettlementReconciliationReasonError("<img>"), /개인정보/);
});

test("stale·conflict·권한·migration 오류는 결정적 재시도 상태로 정규화한다", () => {
  const C = loadSettlementContext();
  assert.equal(C.coachSettlementReconciliationErrorContract({ message: "snapshot_revision_stale" }).state, "STALE");
  assert.equal(C.coachSettlementReconciliationErrorContract({ message: "operation_key_reused" }).state, "CONFLICT");
  assert.equal(C.coachSettlementReconciliationErrorContract({ message: "approved_coach_scope_required" }).state, "ERROR");
  assert.equal(C.coachSettlementReconciliationErrorContract({ message: "PGRST202" }).state, "ERROR");
  assert.equal(C.coachSettlementReconciliationErrorContract({ message: "reason_sensitive" }).state, "PENDING");
});

test("이의 선택 change 이벤트만 사유 입력으로 안전하게 초점을 옮긴다", () => {
  const listeners = {};
  const focusCalls = [];
  let renderCount = 0;
  const context = {
    state: {
      coachSettlementReconciliationChoice: "",
      coachSettlementReconciliationValidation: "previous",
    },
    document: {
      addEventListener: (type, handler) => {
        listeners[type] ||= [];
        listeners[type].push(handler);
      },
    },
    window: { addEventListener: () => undefined },
    requestAnimationFrame: (callback) => callback(),
    renderCoachSettlementReconciliation: () => { renderCount += 1; },
    $: (selector) => selector === "#coachSettlementReconciliationReason"
      ? { focus: (options) => focusCalls.push(options) }
      : null,
  };
  vm.createContext(context);
  vm.runInContext(source("app/tennis-note-coach-app/events/delegated.js"), context);
  context.bindDelegatedEvents();
  const change = listeners.change[0];
  const dispatchChoice = (value) => change({
    target: {
      value,
      closest: (selector) => selector === 'input[name="coachSettlementReconciliationChoice"]'
        ? { value }
        : null,
    },
  });

  dispatchChoice("disputed");
  assert.equal(context.state.coachSettlementReconciliationChoice, "disputed");
  assert.equal(context.state.coachSettlementReconciliationValidation, "");
  assert.equal(focusCalls.length, 1);
  assert.equal(focusCalls[0]?.preventScroll, true);
  dispatchChoice("acknowledged");
  assert.equal(context.state.coachSettlementReconciliationChoice, "acknowledged");
  assert.equal(focusCalls.length, 1);
  assert.equal(renderCount, 2);
});

test("응답 저장은 중복 클릭을 막고 exact RPC 뒤 exact read-back으로만 완료한다", async () => {
  let releaseResponse;
  const calls = [];
  const terminal = reconciliationPayload("ACKNOWLEDGED");
  const C = loadSettlementContext({
    window: {
      TennisNoteDataClient: {
        rpc: async (name, parameters) => {
          calls.push({ name, parameters });
          await new Promise((resolve) => { releaseResponse = resolve; });
          return terminal;
        },
      },
    },
    readCoachSettlementReconciliation: async () => {
      calls.push({ name: "readback", parameters: { ...scope } });
      return terminal;
    },
  });
  vm.runInContext(source("app/tennis-note-coach-app/actions/settlement.js"), C);
  C.state.coachSettlementReconciliation = reconciliationPayload();
  C.state.coachSettlementReconciliationUiState = "PENDING";
  C.state.coachSettlementReconciliationChoice = "acknowledged";

  const first = C.submitCoachSettlementReconciliation();
  const duplicate = await C.submitCoachSettlementReconciliation();
  assert.equal(duplicate, false);
  assert.equal(calls.filter((call) => call.name === "tn_coach_respond_monthly_settlement_confirmation").length, 1);
  releaseResponse();
  assert.equal(await first, true);
  assert.deepEqual(calls.map((call) => call.name), ["tn_coach_respond_monthly_settlement_confirmation", "readback"]);
  const parameters = calls[0].parameters;
  assert.equal(parameters.target_branch_id, scope.branchId);
  assert.equal(parameters.target_coach_role_id, scope.coachRoleId);
  assert.equal(parameters.target_month, scope.settlementMonth);
  assert.equal(parameters.target_confirmation_id, "fixture-confirmation");
  assert.equal(parameters.target_snapshot_id, "fixture-snapshot");
  assert.equal(parameters.expected_snapshot_revision, 2);
  assert.equal(parameters.expected_source_fingerprint, "a".repeat(64));
  assert.equal(parameters.target_status, "acknowledged");
  assert.equal(parameters.target_reason, null);
  assert.match(parameters.target_operation_key, /^settlement-coach-response:fixture-confirmation:/);
  assert.equal(C.state.coachSettlementReconciliationUiState, "ACKNOWLEDGED");
  assert.equal(C.state.coachSettlementReconciliationSubmitting, false);
});

test("public modular path는 read/respond/read-back, draft privacy, 단일 CTA를 연결한다", () => {
  const app = source("app/tennis-note-coach-app/app.js");
  const domain = source("app/tennis-note-coach-app/domain/settlement.js");
  const shared = source("app/tennis-note-coach-app/domain/shared-data.js");
  const auth = source("app/tennis-note-coach-app/data/auth.js");
  const sync = source("app/tennis-note-coach-app/data/sync.js");
  const actions = source("app/tennis-note-coach-app/actions/settlement.js");
  const view = source("app/tennis-note-coach-app/views/settlement.js");
  const account = source("app/tennis-note-coach-app/events/account.js");
  const delegated = source("app/tennis-note-coach-app/events/delegated.js");
  const html = source("app/tennis-note-coach-app/index.html");
  const css = source("app/tennis-note-coach-app/styles.css");
  const worker = source("app/tennis-note-coach-app/service-worker.js");

  assert.match(sync, /tn_coach_monthly_settlement_reconciliation_state/);
  assert.match(actions, /tn_coach_respond_monthly_settlement_confirmation/);
  assert.match(actions, /state\.coachSettlementReconciliationSubmitting \|\| state\.coachSettlementReconciliationLoading/);
  assert.match(actions, /target_confirmation_id:\s*expected\.confirmationId/);
  assert.match(actions, /expected_snapshot_revision:\s*expected\.revision/);
  assert.match(actions, /expected_source_fingerprint:\s*expected\.sourceFingerprint/);
  assert.match(actions, /readCoachSettlementReconciliation\(scope\)/);
  assert.match(actions, /응답이 끊겼지만 서버 기록을 다시 읽어 완료 상태를 확인했습니다/);
  assert.match(sync, /requestId !== state\.coachSettlementReconciliationRequestId/);
  assert.match(domain, /r3_monthly_settlement_coach_reconciliation_v1/);
  assert.match(auth, /syncCoachSettlementReconciliationFromServer/);
  assert.match(account, /coachSettlementReconciliationForm/);
  assert.match(delegated, /coachSettlementReconciliationChoice/);
  assert.match(view, /labelNode\.textContent = label/);
  assert.match(view, /valueNode\.textContent = value/);
  assert.match(shared, /coachSettlementReconciliationReason:\s*""/);
  assert.match(shared, /coachSettlementReconciliationOperation:\s*null/);
  assert.match(app, /coachSettlementReconciliationRequestId:\s*0/);
  assert.equal((html.match(/id="coachSettlementReconciliation"/g) || []).length, 1);
  assert.equal((html.match(/id="coachSettlementReconciliationSubmit"/g) || []).length, 1);
  assert.match(html, /actions\/settlement\.js\?v=1\.0\.478/);
  assert.match(worker, /actions\/settlement\.js\?v=1\.0\.478/);
  assert.match(css, /#coachSettlementReconciliationSubmit[\s\S]*min-height:\s*44px/);
  assert.match(css, /coach-settlement-reconciliation-reason textarea[\s\S]*font-size:\s*16px/);
  const reconciliationSection = html.match(/id="coachSettlementReconciliation"[\s\S]*?<\/section>/)?.[0] || "";
  assert.doesNotMatch(reconciliationSection, /지급하기|송금|첨부|재조정|결제 처리/);
});
