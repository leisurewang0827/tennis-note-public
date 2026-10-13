import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const port = require("./helpers/r3-substitute-port.cjs");
const read = (file) => fs.readFileSync(path.join(port.root, file), "utf8").replace(/\r\n/g, "\n");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = { branchId: uid(10), coachRoleId: uid(21), settlementMonth: "2097-09-01" };
const candidate = () => ({ id: uid(82), branchId: scope.branchId, coachRoleId: scope.coachRoleId,
  lessonId: uid(80), lessonRevision: 1, serviceDate: "2097-09-24",
  originalCoachRoleId: uid(20), actualCoachRoleId: scope.coachRoleId, sourceFingerprint: "a".repeat(64) });
const decision = () => ({ branchId: scope.branchId, assignmentId: uid(82), lessonId: uid(80),
  lessonRevision: 1, sourceFingerprint: "a".repeat(64),
  originalCoachRoleId: uid(20), actualCoachRoleId: scope.coachRoleId,
  decisionEnabled: true, chosenRecipient: null });
const extract = (source, name) => {
  const body = source.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`, "m"));
  assert(body, `missing actual function ${name}`);
  return body[0];
};

function adminContext() {
  const calls = [], dom = new Map();
  const state = { view: "billing", billingMonth: "2097-09", settlementPage: 0 };
  const c = vm.createContext({ window: {}, state, adminDemoMode: false,
    adminImportAuthState: { profile: { id: uid(1), role: "admin" }, user: { id: uid(101) } },
    sessionToken: "synthetic-token", admitted: true, branch: scope.branchId,
    activeOperationBranchId: () => c.branch,
    operationBranchCoaches: () => [{ serverRoleId: scope.coachRoleId, branchId: c.branch, name: "합성 코치" }],
    effectiveSettlementPreviewSignature: () => JSON.stringify([c.branch, state.billingMonth]),
    operationsRole: () => c.adminImportAuthState.profile?.role,
    adminApprovalReady: () => c.admitted,
    createAdminOperationKey: () => "synthetic-r3-operation-0001",
    $: (selector) => { if (!dom.has(selector)) dom.set(selector, {
      innerHTML: "", textContent: "", querySelectorAll: () => [], querySelector: () => null,
    }); return dom.get(selector); },
    money: { format: (n) => String(n) }, tickets: [], expiredTickets: [],
    adminLiveDataState: { settlementTickets: [] }, billingPageSize: 10,
    normalizeDashboardPage: () => 0, renderDashboardPager() {}, escapeHtml: (s) => String(s),
  });
  let response = async (name) => {
    if (name === "tn_coach_settlement_scope_v2") throw Error("settlement_hold_substitute_manual_approval_required");
    if (name === "tn_admin_list_substitute_manual_candidates") return { ...scope, candidates: [candidate()] };
    if (name === "tn_admin_preview_substitute_policy_decision") return decision();
    if (name === "tn_admin_confirm_substitute_policy_decision") return { ok: true, replayed: false };
    throw Error("unexpected RPC");
  };
  c.window.TennisNoteDataClient = { getSession: () => c.sessionToken ? { access_token: c.sessionToken } : null,
    rpc: async (name, args) => { calls.push({ name, args }); return response(name, args); } };
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"), c);
  const data = read("app/admin/data/billing.js"), view = read("app/admin/views/billing.js");
  vm.runInContext(data.match(/^const effectiveSettlementPreview = .*;$/m)[0], c);
  vm.runInContext(view.match(/^const r3SubstituteDecisionUi = .*;$/m)[0], c);
  for (const name of ["effectiveSettlementPreviewContext", "effectiveSettlementPreviewContextIsCurrent",
    "invalidateEffectiveSettlementPreview", "validatedR3SubstituteDecisionCandidates",
    "requestR3SubstituteDecisionPreview", "requestR3SubstituteDecisionConfirmation", "refreshEffectiveSettlementPreview"]) {
    vm.runInContext(extract(data, name), c);
  }
  for (const name of ["r3SubstituteDecisionCandidate", "r3SubstituteDecisionCandidates", "previewR3SubstituteDecision",
    "confirmR3SubstituteDecision", "renderEffectiveSettlementPreview"]) {
    vm.runInContext(extract(view, name), c);
  }
  const get = (expression) => vm.runInContext(expression, c);
  return { c, calls, dom, get, setResponse: (next) => { response = next; } };
}

test("new exact-source layer inverses only reviewed bytes and preserves prior goldens", () => {
  const coachVariants = port.manifest.files.filter((item) => item.path === "app/admin/domain/coaches.js");
  const dirtyCoach = coachVariants.find((item) => item.provenance?.startsWith("pre-existing availability"));
  const cleanCoach = coachVariants.find((item) => item.provenance?.startsWith("clean R3 candidate"));
  assert(dirtyCoach && cleanCoach && coachVariants.length === 2);
  const availability = dirtyCoach.hunks[0];
  assert.equal(availability.before, "");
  const currentCoach = read("app/admin/domain/coaches.js");
  const currentCoachSha = port.sha(currentCoach);
  assert([dirtyCoach.candidateSha256, cleanCoach.candidateSha256].includes(currentCoachSha),
    "coach source must be exactly the dirty-preserved or clean R3 candidate");
  const cleanCoachSource = currentCoachSha === dirtyCoach.candidateSha256
    ? currentCoach.replace(availability.after, "") : currentCoach;
  assert.equal(port.sha(cleanCoachSource), cleanCoach.candidateSha256);
  const chars = Array.from(cleanCoachSource);
  const dirtyCoachSource = chars.slice(0, availability.start).join("") + availability.after
    + chars.slice(availability.start).join("");
  assert.equal(port.sha(dirtyCoachSource), dirtyCoach.candidateSha256);
  for (const entry of port.manifest.files) {
    let source = entry.path === "app/admin/domain/coaches.js"
      ? entry === dirtyCoach ? dirtyCoachSource : cleanCoachSource : read(entry.path);
    source = port.restoreContext(entry.path, port.restoreNonPayable(entry.path, source));
    assert.equal(port.sha(source), entry.candidateSha256);
    assert.equal(port.sha(port.restore(entry.path, source)), entry.baseSha256);
    const required = entry.hunks.at(-1).after;
    for (const mutated of [source + "\n", source.replace(required, ""),
      source.replace(required, required + required)]) {
      assert.throws(() => port.restore(entry.path, mutated), /candidate drift/);
    }
  }
  assert.equal(port.restore("app/release.json", read("app/release.json")), read("app/release.json"));
});

test("P2 nonpayable trace has a separate exact seal without repinning older substitute goldens", () => {
  const seal = JSON.parse(read("tests/fixtures/r3-substitute-context-source-parity.json")).nonPayableTrace;
  assert.equal(seal.contract, "r3-substitute-nonpayable-trace-v1");
  for (const entry of seal.files) {
    const source = read(entry.path);
    assert.equal(port.sha(source), entry.candidateSha256);
    assert.equal(port.sha(port.restoreNonPayable(entry.path, source)), entry.priorCandidateSha256);
    assert.equal(port.sha(port.restore(entry.path, source)), port.manifest.files.find((item) => item.path === entry.path).baseSha256);
    assert.throws(() => port.restoreNonPayable(entry.path, source + "\n"), /candidate drift/);
  }
});

test("P1 repair has its own exact source seal and cannot bypass the older R3 golden", () => {
  const file = "app/admin/views/billing.js";
  const source = read(file);
  const prior = port.restoreContext(file, source);
  const entry = port.manifest.files.find((item) => item.path === file);
  assert.equal(port.sha(prior), entry.candidateSha256);
  assert.equal(port.sha(port.restore(file, source)), entry.baseSha256);
  for (const altered of [source + "\n", source.replace("effectiveSettlementPreview.context !== context", "false")]) {
    assert.throws(() => port.restoreContext(file, altered), /candidate drift/);
  }
});

test("data-layer RPC move preserves exact preview/confirm inputs and the immutable R3 pins", () => {
  const seal = JSON.parse(read("tests/fixtures/r3-substitute-context-source-parity.json")).layerBoundaryRepair;
  assert.equal(seal.contract, "r3-substitute-data-layer-rpc-v1");
  assert.equal(seal.files.length, 2);
  for (const entry of seal.files) {
    const source = read(entry.path);
    assert.equal(port.sha(source), entry.candidateSha256);
    assert.equal(port.sha(port.restoreLayer(entry.path, source)), entry.priorCandidateSha256);
    assert.equal(port.sha(port.restore(entry.path, source)), port.manifest.files.find((item) => item.path === entry.path).baseSha256);
    assert.throws(() => port.restoreLayer(entry.path, source + "\n"), /candidate drift/);
  }
  const view = read("app/admin/views/billing.js"), data = read("app/admin/data/billing.js");
  assert(!view.includes("context.client.rpc("));
  for (const rpc of ["tn_admin_preview_substitute_policy_decision", "tn_admin_confirm_substitute_policy_decision"]) {
    assert.equal(view.split(rpc).length, 1);
    assert.equal(data.split(rpc).length, 2);
  }
});

test("actual modular entries load the shared validator and R3 admin/coach callers", () => {
  const admin = read("app/admin/index.html"), coach = read("app/tennis-note-coach-app/index.html");
  for (const file of ["shared/tennisnote-settlement-adjustment.js", "views/billing.js", "data/billing.js"]) {
    assert(admin.includes(file), file);
  }
  for (const file of ["shared/tennisnote-settlement-adjustment.js", "views/settlement.js"]) {
    assert(coach.includes(file), file);
  }
  assert(admin.indexOf("shared/tennisnote-settlement-adjustment.js") < admin.indexOf("views/billing.js"));
  assert(admin.indexOf("views/billing.js") < admin.indexOf("data/billing.js"));
  assert(coach.indexOf("shared/tennisnote-settlement-adjustment.js") < coach.indexOf("views/settlement.js"));
  assert(read("scripts/verify.sh").includes('node --test "tests/**/*.test.js"'));
  assert(read(".github/workflows/tennisnote-public-ci.yml").includes('"tests/**"'));
});

test("existing modular browser fixture still satisfies the exact R3 projection contract", () => {
  const c = vm.createContext({ window: {} });
  vm.runInContext(extract(read("scripts/check_tennisnote_r3_effective_browser.cjs"), "fixtureConfig"), c);
  vm.runInContext(c.fixtureConfig(true), c);
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"), c);
  const value = c.window.__r3Payload({ target_branch_id: scope.branchId,
    target_coach_role_id: scope.coachRoleId, target_month: scope.settlementMonth });
  const projection = c.window.TennisNoteSettlementAdjustment.effectiveProjection(value, scope);
  assert.equal(projection.estimatedSettlement, 50);
  assert.equal(projection.ownSettlement, 50);
  assert.equal(projection.substituteSettlement, 0);
});

test("manual candidate source mismatch fails closed before preview RPC", async () => {
  const s = adminContext();
  const wrong = { ...candidate(), sourceFingerprint: "bad" };
  s.setResponse(async (name) => {
    if (name === "tn_coach_settlement_scope_v2") throw Error("settlement_hold_substitute_manual_approval_required");
    if (name === "tn_admin_list_substitute_manual_candidates") return { ...scope, candidates: [wrong] };
    throw Error("unexpected RPC");
  });
  await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
  assert.equal(s.get("effectiveSettlementPreview.results[0].candidates.length"), 0);
  await s.c.previewR3SubstituteDecision(uid(82));
  assert.equal(s.calls.filter((item) => item.name === "tn_admin_preview_substitute_policy_decision").length, 0);
  assert.equal(s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision").length, 0);
});

test("gate OFF, stale source, and changed actor all produce confirm RPC zero", async () => {
  for (const kind of ["gate-off", "stale-source", "actor-changed"]) {
    const s = adminContext();
    await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
    if (kind === "gate-off") s.setResponse(async (name) => {
      if (name === "tn_admin_preview_substitute_policy_decision") return { ...decision(), decisionEnabled: false };
      throw Error("unexpected RPC");
    });
    if (kind === "stale-source") s.setResponse(async (name) => {
      if (name === "tn_admin_preview_substitute_policy_decision") return { ...decision(), sourceFingerprint: "b".repeat(64) };
      throw Error("unexpected RPC");
    });
    await s.c.previewR3SubstituteDecision(uid(82));
    if (kind === "actor-changed") s.c.adminImportAuthState.profile.role = "coach";
    s.get("r3SubstituteDecisionUi.recipient = 'actualCoach'");
    await s.c.confirmR3SubstituteDecision();
    assert.equal(s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision").length, 0, kind);
  }
});

test("changed month, branch, and role after preview block confirm before RPC", async () => {
  for (const kind of ["month", "branch", "role"]) {
    const s = adminContext();
    await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
    await s.c.previewR3SubstituteDecision(uid(82));
    s.get("r3SubstituteDecisionUi.recipient = 'actualCoach'");
    if (kind === "month") s.c.state.billingMonth = "2097-10";
    if (kind === "branch") s.c.branch = uid(99);
    if (kind === "role") s.c.adminImportAuthState.profile.role = "coach";
    await s.c.confirmR3SubstituteDecision();
    assert.equal(s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision").length, 0, kind);
  }
});

test("synchronous render invalidation and recipient mutation never reach confirm RPC", async () => {
  for (const kind of ["month", "recipient"]) {
    const s = adminContext();
    await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
    await s.c.previewR3SubstituteDecision(uid(82));
    s.get("r3SubstituteDecisionUi.recipient = 'actualCoach'");
    const render = s.c.renderEffectiveSettlementPreview;
    s.c.renderEffectiveSettlementPreview = () => {
      if (kind === "month") s.c.state.billingMonth = "2097-10";
      if (kind === "recipient") s.get("r3SubstituteDecisionUi.recipient = 'originalCoach'");
      render();
    };
    await s.c.confirmR3SubstituteDecision();
    assert.equal(s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision").length, 0, kind);
  }
});

test("valid synthetic decision uses exact source and one RPC despite concurrent clicks", async () => {
  const s = adminContext();
  await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
  await s.c.previewR3SubstituteDecision(uid(82));
  assert(s.dom.get("#coachSettlementPreviewRows").innerHTML.includes("data-r3-policy-recipient"));
  s.get("r3SubstituteDecisionUi.recipient = 'actualCoach'");
  let release;
  s.setResponse(async (name) => {
    if (name === "tn_admin_confirm_substitute_policy_decision") return new Promise((resolve) => { release = resolve; });
    if (name === "tn_coach_settlement_scope_v2") throw Error("settlement_hold_substitute_manual_approval_required");
    if (name === "tn_admin_list_substitute_manual_candidates") return { ...scope, candidates: [candidate()] };
    throw Error("unexpected RPC");
  });
  const first = s.c.confirmR3SubstituteDecision();
  await s.c.confirmR3SubstituteDecision();
  const confirms = s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision");
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].args.target_assignment_id, uid(82));
  assert.equal(confirms[0].args.expected_source_fingerprint, "a".repeat(64));
  assert.equal(confirms[0].args.target_chosen_recipient, "actualCoach");
  release({ ok: true, replayed: false });
  await first;
});

test("lost response retains the same operation key for one explicit retry", async () => {
  const s = adminContext();
  await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
  await s.c.previewR3SubstituteDecision(uid(82));
  s.get("r3SubstituteDecisionUi.recipient = 'actualCoach'");
  let attempts = 0;
  s.setResponse(async (name) => {
    if (name === "tn_admin_confirm_substitute_policy_decision") {
      attempts += 1;
      if (attempts === 1) throw Error("synthetic response lost");
      return { ok: true, replayed: true };
    }
    if (name === "tn_coach_settlement_scope_v2") throw Error("settlement_hold_substitute_manual_approval_required");
    if (name === "tn_admin_list_substitute_manual_candidates") return { ...scope, candidates: [candidate()] };
    throw Error("unexpected RPC");
  });
  await s.c.confirmR3SubstituteDecision();
  assert.equal(s.get("r3SubstituteDecisionUi.operationKey"), "synthetic-r3-operation-0001");
  await s.c.confirmR3SubstituteDecision();
  const confirms = s.calls.filter((item) => item.name === "tn_admin_confirm_substitute_policy_decision");
  assert.equal(confirms.length, 2);
  assert.equal(confirms[0].args.target_operation_key, confirms[1].args.target_operation_key);
});

test("v2 substitute projection retains one physical source and rejects split/source drift", () => {
  const c = vm.createContext({ window: {} });
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"), c);
  const build = () => ({ ok: true, calculationVersion: "r3_effective_settlement_v2", scope: { ...scope },
    sourceFingerprint: "a".repeat(64), confirmationReady: false,
    totals: { totalSettlementAmount: 50, ownSettlementAmount: 0, substituteSettlementAmount: 50,
      substituteSessionCount: 1, branchSubstituteExpenseAmount: 0, revenueAmount: 0,
      settledSessions: 1, settledMinutes: 40, paymentCount: 0 },
    sourceManifest: { substituteContractVersion: "r3_substitute_policy_v2",
      tickets: [{ id: uid(40), userId: uid(3), coachRoleId: uid(20) }],
      assignments: [{ id: uid(82), lessonId: uid(80), branchId: scope.branchId,
        originalCoachRoleId: uid(20), substituteCoachRoleId: scope.coachRoleId,
        settlementMode: "actual_coach", status: "completed" }],
      sessions: [{ id: uid(81), lessonId: uid(80), substituteAssignmentId: uid(82),
        accountingClass: "coach_settlement", substituteSettlementMode: "actual_coach",
        recipientCoachRoleId: scope.coachRoleId }] },
    lines: [{ lineIndex: 1, lineKind: "substitute_session", sourceTicketId: uid(40),
      sourceLessonId: uid(80), sourceSessionId: uid(81), sourceSubstituteAssignmentId: uid(82),
      settlementAmount: 50, settledSessions: 1, settledMinutes: 40, totalSessions: 5, netAmount: 0,
      calculationComponents: { physicalKey: "synthetic-physical-1", accountingClass: "coach_settlement",
        contributions: [{ sessionId: uid(81), lessonId: uid(80), substituteAssignmentId: uid(82), formula: "hourly" }] } }] });
  const project = (value) => c.window.TennisNoteSettlementAdjustment.effectiveProjection(value, scope);
  const value = project(build());
  assert.equal(value.estimatedSettlement, 50);
  assert.equal(value.substituteSessionCount, 1);
  assert.equal(value.rows[0].sourceSubstituteAssignmentId, uid(82));
  for (const mutate of [p => { p.totals.substituteSessionCount = 2; },
    p => { p.totals.ownSettlementAmount = 1; },
    p => { p.sourceManifest.sessions[0].lessonId = uid(99); },
    p => { p.sourceManifest.assignments[0].id = uid(99); },
    p => { p.lines[0].calculationComponents.contributions[0].sessionId = uid(99); }]) {
    const invalid = build(); mutate(invalid); assert.throws(() => project(invalid));
  }
});

test("per-lesson zero-won trace is nonpayable, exact, and fails closed on source or amount drift", () => {
  const c = vm.createContext({ window: {} });
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"), c);
  const project = (value) => c.window.TennisNoteSettlementAdjustment.effectiveProjection(value, scope);
  const build = (policy = "none") => {
    const reason = policy === "none" ? "explicit_no_settlement" : "recipient_original_coach";
    const accountingClass = policy === "none" ? "explicit_no_settlement" : "original_coach_settlement";
    const settlementMode = policy === "none" ? "none" : "actual_coach";
    return { ok: true, calculationVersion: "r3_effective_settlement_v2", scope: { ...scope },
      sourceFingerprint: "a".repeat(64), confirmationReady: false,
      totals: { totalSettlementAmount: 0, ownSettlementAmount: 0, substituteSettlementAmount: 0,
        substituteSessionCount: 0, branchSubstituteExpenseAmount: 0, revenueAmount: 0,
        settledSessions: 0, settledMinutes: 0, paymentCount: 0 },
      sourceManifest: { substituteContractVersion: "r3_substitute_policy_v2",
        tickets: [{ id: uid(40), userId: uid(3), coachRoleId: uid(20) }],
        assignments: [{ id: uid(82), lessonId: uid(80), branchId: scope.branchId,
          originalCoachRoleId: uid(20), substituteCoachRoleId: scope.coachRoleId,
          settlementMode, status: "completed" }],
        sessions: [{ id: uid(81), lessonId: uid(80), substituteAssignmentId: uid(82),
          accountingClass, substituteSettlementMode: settlementMode, substitutePolicy: policy,
          outcome: "completed", coachRoleId: scope.coachRoleId, originalCoachRoleId: uid(20),
          recipientCoachRoleId: policy === "none" ? null : uid(20),
          lessonDate: "2097-09-24", startTime: "10:00", groupAccountId: null }] },
      lines: [{ lineIndex: 1, lineKind: "substitute_session", sourceTicketId: uid(40),
        sourceLessonId: uid(80), sourceSessionId: uid(81), sourceSubstituteAssignmentId: uid(82),
        settlementAmount: 0, settledSessions: 0, settledMinutes: 0, totalSessions: 5, netAmount: 0,
        calculationComponents: { physicalKey: [uid(80), scope.coachRoleId, "2097-09-24", "10:00"].join("|"),
          accountingClass, nonPayableDecision: true, nonPayableReason: reason,
          duplicateSharedTime: false, contributions: [] } }] };
  };
  for (const [policy, label] of [["none", "대타 · 지급 제외 · 0원 근거"], ["originalCoach", "대타 · 원코치 귀속 · 0원 근거"]]) {
    const valid = build(policy);
    assert.equal(project(valid).rows[0].method, label);
    for (const mutate of [p => { p.lines[0].settlementAmount = 1; },
      p => { p.lines[0].settledMinutes = 1; },
      p => { p.lines[0].settledSessions = 1; },
      p => { p.lines[0].calculationComponents.contributions.push({ sessionId: uid(81) }); },
      p => { p.lines[0].calculationComponents.accountingClass = "coach_settlement"; p.sourceManifest.sessions[0].accountingClass = "coach_settlement"; },
      p => { const mode = policy === "none" ? "actual_coach" : "none"; p.sourceManifest.sessions[0].substituteSettlementMode = mode; p.sourceManifest.assignments[0].settlementMode = mode; },
      p => { p.lines[0].calculationComponents.nonPayableReason = "wrong"; },
      p => { p.lines[0].calculationComponents.physicalKey += "|wrong"; },
      p => { p.sourceManifest.sessions[0].outcome = "scheduled"; },
      p => { p.sourceManifest.sessions[0].recipientCoachRoleId = scope.coachRoleId; },
      p => { p.sourceManifest.sessions.push({ ...p.sourceManifest.sessions[0] }); }]) {
      const invalid = build(policy); mutate(invalid); assert.throws(() => project(invalid));
    }
  }
  const legacy = build("originalCoach");
  legacy.lines[0].calculationComponents.duplicateSharedTime = true;
  legacy.lines[0].calculationComponents.nonPayableReason = null;
  assert.equal(project(legacy).rows[0].method, "대타 · 원코치 귀속 · 0원 근거");
});
