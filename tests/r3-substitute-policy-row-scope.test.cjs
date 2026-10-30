const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branch = id(1), roleA = id(2), roleB = id(3), assignment = id(4);
const item = () => ({ id: assignment, branchId: branch, lessonId: id(5), lessonRevision: 7,
  serviceDate: "2026-01-12", originalCoachRoleId: roleA, actualCoachRoleId: roleB,
  sourceFingerprint: "a".repeat(64) });
const scope = (role) => ({ branchId: branch, coachRoleId: role, settlementMonth: "2026-01-01" });
const functionNames = ["r3SubstituteDecisionCandidate", "r3SubstituteDecisionCandidates",
  "validatedR3SubstituteDecisionCandidates", "previewR3SubstituteDecision",
  "confirmR3SubstituteDecision", "renderEffectiveSettlementPreview"];
function extract(text, name) {
  const start = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(text);
  assert.ok(start, `missing ${name}`);
  const tail = text.slice(start.index), end = /\n\}(?=\n|$)/.exec(tail);
  assert.ok(end, `end missing ${name}`);
  return tail.slice(0, end.index + 2);
}
// 독립 수락된 반대쪽 source를 고정하여 같은 파일끼리 비교하지 않습니다.
const crypto = require("node:crypto");
const reviewedFunctionPins = {
  "r3SubstituteDecisionCandidate": "cf89b0adbc943e90d44799394b7c0dfc977b91a45068e64fba94049598dd2077",
  "r3SubstituteDecisionCandidates": "841b64dbafe44f386e5947562d096dc651a64f0fa7d1ab48c11bcea19a502bb3",
  "validatedR3SubstituteDecisionCandidates": "2abfc680b8714ee8507159d531f47ae2e5530738a8b4ca7b3239e40f2db130d0",
  "previewR3SubstituteDecision": "ebef4dceff7b62c6d0e89230e2be87038adf71b4e6a2d51f12ab763d6e70719c",
  "confirmR3SubstituteDecision": "a49ba17d1d8c5eb9c3d4d35a89b34822a183f5180f7c2c6fa75cdf59b64d376b",
  "renderEffectiveSettlementPreview": "872c9cc90b0c2f37b6903d7dc39b9b3c64278e1696f1c1609c66de0fb3856424"
};
const reviewedSourcePins = {
  "app/admin/data/billing.js": "fde08533a25c02eb875adf2dbe21d9676ae923149c2172a6c581fe526debf0ac",
  "app/admin/actions/billing.js": "45655328b301b63d63d5a8d44c60b3015c7cff89aa644944dd0b3f10d14877ae",
  "app/admin/views/billing.js": "36dec8b2e0a165cd338f763468cf08c62a974f67402be9c628223834f59d900f"
};
const counterpart = {"path":"tests/fixtures/r3-substitute-policy-private-reviewed.fragment.js","sha256":"61d8607c62a06d6a8c7262c3b3c2e6786948a296deb3b8839770d65d06ec963b"};
const lf = (text) => text.replace(/\r\n/g, "\n");
const digest = (text) => crypto.createHash("sha256").update(lf(text)).digest("hex");
function source(privateFragment) {
  if (Boolean(privateFragment) !== false) {
    const frozen = lf(fs.readFileSync(path.join(root, counterpart.path), "utf8"));
    assert.equal(digest(frozen), counterpart.sha256, "독립 검수 counterpart 무결성");
    return frozen;
  }
  const files = Object.keys(reviewedSourcePins).map((file) => lf(fs.readFileSync(path.join(root, file), "utf8")));
  const stateLine = files.map((file) => file.match(/^const r3SubstituteDecisionUi = .*;$/m)?.[0]).find(Boolean);
  assert.ok(stateLine, "실제 소스의 대타 편집 상태가 필요합니다.");
  return stateLine + "\n" + functionNames.map((name) => extract(files.find((file) =>
    new RegExp(`^(?:async )?function ${name}\\(`, "m").test(file)), name)).join("\n");
}
function assertReviewedFunctions(text) {
  for (const name of functionNames) {
    assert.equal(digest(extract(text, name).replace(/\bescapeHtmlText\(/g, "escapeHtml(")), reviewedFunctionPins[name], name);
  }
}
// A local event/HTML stand-in, not a browser or hosted UI acceptance harness.
function rowsStandIn() {
  let nodes = [], html = "";
  return {
    get innerHTML() { return html; },
    set innerHTML(value) {
      nodes.forEach((n) => { n.isConnected = false; }); html = value; nodes = [];
      for (const tag of value.matchAll(/<(button|select)\b([^>]*)>/g)) {
        const data = {};
        for (const attr of tag[2].matchAll(/\bdata-([a-z0-9-]+)(?:="([^"]*)")?/g)) {
          data[attr[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = attr[2] || "";
        }
        const listeners = new Map();
        nodes.push({ dataset: data, value: "", isConnected: true,
          disabled: /\sdisabled(?:\s|$)/.test(tag[2]),
          addEventListener(type, callback) { listeners.set(type, callback); },
          emit(type) { listeners.get(type)?.({ target: this }); },
          listenerCount(type) { return listeners.has(type) ? 1 : 0; } });
      }
    },
    querySelectorAll(selector) {
      const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return nodes.filter((n) => Object.hasOwn(n.dataset, key));
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
  };
}
function harness({ privateFragment = false, gate = true } = {}) {
  const rows = rowsStandIn(), summary = {}, calls = [], pending = {};
  const controls = { approved: true, current: true, gate, failConfirm: false };
  let operation = 0, refreshes = 0;
  const client = { async rpc(name, args) {
    calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
    if (pending[name]) return pending[name];
    if (name === "tn_admin_preview_substitute_policy_decision") return { branchId: branch,
      assignmentId: assignment, lessonId: id(5), lessonRevision: 7, sourceFingerprint: "a".repeat(64),
      originalCoachRoleId: roleA, actualCoachRoleId: roleB, chosenRecipient: null, decisionEnabled: controls.gate };
    if (controls.rejectGate) throw new Error("substitute_policy_decisions_disabled");
    if (controls.failConfirm) throw new Error("synthetic_response_loss");
    return { ok: true, decisionId: id(6), chosenRecipient: args.target_chosen_recipient };
  } };
  const context = { client };
  const escape = (s) => String(s).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
  const box = { console, Object, state: { billingMonth: "2026-01", settlementPage: 0 },
    effectiveSettlementPreview: { context, results: [], loading: false, error: "" },
    adminApprovalReady: () => controls.approved,
    activeOperationBranchId: () => branch,
    effectiveSettlementPreviewContextIsCurrent: (c) => controls.current && controls.approved && c === context,
    effectiveSettlementPreviewSignature: () => "synthetic-scope",
    refreshEffectiveSettlementPreview: () => { refreshes++; },
    invalidateEffectiveSettlementPreview: () => { box.effectiveSettlementPreview.results = []; box.effectiveSettlementPreview.context = null; },
    createAdminOperationKey: () => `synthetic-operation-${++operation}`,
    $: (sel) => sel === "#coachSettlementPreviewRows" ? rows : summary,
    escapeHtml: escape, escapeHtmlText: escape, renderDashboardPager: () => {},
    normalizeDashboardPage: () => 0, billingPageSize: 20,
    money: { format: () => "synthetic" }, tickets: [], expiredTickets: [], adminLiveDataState: {},
    window: { TennisNoteSettlementAdjustment: { effectiveError: () => "합성 오류" } } };
  vm.createContext(box); vm.runInContext(source(privateFragment), box);
  vm.runInContext(`globalThis.api = { ${functionNames.join(",")}, ui:r3SubstituteDecisionUi };`, box);
  const api = box.api;
  function add(role, candidates = [item()]) {
    const validated = api.validatedR3SubstituteDecisionCandidates({ ...scope(role), candidates }, scope(role));
    box.effectiveSettlementPreview.results.push({ coach: { serverRoleId: role, name: role === roleA ? "합성A" : "합성B" },
      error: "합성 귀속 확인", errorCode: "settlement_hold_substitute_manual_approval_required", candidates: validated });
    return validated;
  }
  const previews = () => calls.filter((c) => c.name === "tn_admin_preview_substitute_policy_decision");
  const confirms = () => calls.filter((c) => c.name === "tn_admin_confirm_substitute_policy_decision");
  return { api, add, box, rows, calls, previews, confirms, controls, pending, context, refreshes: () => refreshes };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("local event parser retains numeric data-r3 names used by the real renderer", () => {
  const rows = rowsStandIn();
  rows.innerHTML = '<button data-r3-policy-preview="synthetic" data-r3-policy-coach="row-b">확인</button>';
  const buttons = rows.querySelectorAll("[data-r3-policy-preview]");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].dataset.r3PolicyPreview, "synthetic");
  assert.equal(buttons[0].dataset.r3PolicyCoach, "row-b");
});

test("canonical item without coachRoleId is tagged only from validated envelope, without mutation", () => {
  const h = harness(), raw = item(), list = h.add(roleA, [raw]);
  assert.equal(raw.coachRoleId, undefined);
  assert.equal(list[0].coachRoleId, roleA);
  assert.equal(list[0].settlementMonth, "2026-01-01");
  for (const bad of [{ ...item(), coachRoleId: roleB }, { ...item(), settlementMonth: "2026-02-01" }]) {
    assert.throws(() => h.api.validatedR3SubstituteDecisionCandidates({ ...scope(roleA), candidates: [bad] }, scope(roleA)));
  }
  assert.throws(() => h.api.validatedR3SubstituteDecisionCandidates({ ...scope(roleB), candidates: [item()] }, scope(roleA)));
});
test("scoped preview and confirm preserve exact assignment/source/revision/operation", async () => {
  const h = harness(); h.add(roleA);
  await h.api.previewR3SubstituteDecision(assignment, roleA);
  assert.equal(h.previews().length, 1); h.api.ui.recipient = "actualCoach";
  await h.api.confirmR3SubstituteDecision(roleA, assignment);
  assert.equal(h.confirms().length, 1);
  const a = h.confirms()[0].args;
  assert.equal(a.target_assignment_id, assignment); assert.equal(a.expected_lesson_revision, 7);
  assert.equal(a.expected_source_fingerprint, "a".repeat(64));
  assert.equal(a.target_chosen_recipient, "actualCoach"); assert.ok(a.target_operation_key);
  assert.equal(h.refreshes(), 1);
});
test("same assignment under both coaches resolves chosen row, not an arbitrary flattened match", async () => {
  const h = harness(); h.add(roleA); h.add(roleB);
  await h.api.previewR3SubstituteDecision(assignment, roleB);
  assert.equal(h.previews().length, 1); assert.equal(h.api.ui.scope.coachRoleId, roleB);
  h.api.ui.recipient = "originalCoach";
  await h.api.confirmR3SubstituteDecision(roleA, assignment); assert.equal(h.confirms().length, 0);
  await h.api.confirmR3SubstituteDecision(roleB, assignment); assert.equal(h.confirms().length, 1);
});
test("duplicate within one row and missing or wrong row never call preview", async () => {
  const h = harness(); h.add(roleA);
  await h.api.previewR3SubstituteDecision(assignment);
  await h.api.previewR3SubstituteDecision(assignment, roleB);
  h.box.effectiveSettlementPreview.results[0].candidates.push({ ...h.box.effectiveSettlementPreview.results[0].candidates[0] });
  await h.api.previewR3SubstituteDecision(assignment, roleA);
  assert.equal(h.previews().length, 0);
});
test("wrong branch/month, invalid actor, loading and busy remain fail closed", async () => {
  for (const kind of ["branch", "month", "role", "loading", "busy"]) {
    const h = harness(); h.add(roleA);
    if (kind === "branch") h.box.effectiveSettlementPreview.results[0].candidates[0].branchId = id(99);
    if (kind === "month") h.box.state.billingMonth = "2026-02";
    if (kind === "role") h.controls.approved = false;
    if (kind === "loading") h.box.effectiveSettlementPreview.loading = true;
    if (kind === "busy") h.api.ui.busy = true;
    await h.api.previewR3SubstituteDecision(assignment, roleA);
    assert.equal(h.previews().length, 0, kind);
  }
});
test("stale source/revision, changed month or role after preview blocks confirmation", async () => {
  for (const kind of ["source", "revision", "month", "role"]) {
    const h = harness(); h.add(roleA); await h.api.previewR3SubstituteDecision(assignment, roleA);
    h.api.ui.recipient = "actualCoach";
    const c = h.box.effectiveSettlementPreview.results[0].candidates[0];
    if (kind === "source") c.sourceFingerprint = "b".repeat(64);
    if (kind === "revision") c.lessonRevision++;
    if (kind === "month") h.box.state.billingMonth = "2026-02";
    if (kind === "role") h.controls.approved = false;
    await h.api.confirmR3SubstituteDecision(roleA, assignment);
    assert.equal(h.confirms().length, 0, kind);
  }
});
test("gate OFF, chosen decision, invalid recipient and busy cannot confirm", async () => {
  for (const kind of ["gate", "chosen", "recipient", "busy"]) {
    const h = harness({ gate: kind !== "gate" }); h.add(roleA);
    await h.api.previewR3SubstituteDecision(assignment, roleA); h.api.ui.recipient = "actualCoach";
    if (kind === "chosen") h.api.ui.preview.chosenRecipient = "originalCoach";
    if (kind === "recipient") h.api.ui.recipient = "invalid";
    if (kind === "busy") h.api.ui.busy = true;
    await h.api.confirmR3SubstituteDecision(roleA, assignment); assert.equal(h.confirms().length, 0, kind);
  }
});
test("a stale or wrong preview response never creates a chooser", async () => {
  const h = harness(); h.add(roleA); let resolve;
  h.pending.tn_admin_preview_substitute_policy_decision = new Promise((r) => { resolve = r; });
  const p = h.api.previewR3SubstituteDecision(assignment, roleA);
  h.box.effectiveSettlementPreview.results[0].candidates[0].sourceFingerprint = "b".repeat(64);
  resolve({ branchId: branch, assignmentId: assignment, lessonId: id(5), lessonRevision: 7,
    sourceFingerprint: "a".repeat(64), originalCoachRoleId: roleA, actualCoachRoleId: roleB, decisionEnabled: true });
  await p; assert.equal(h.api.ui.preview, null);
});
test("double click while preview pending issues exactly one read RPC", async () => {
  const h = harness(); h.add(roleA); let resolve;
  h.pending.tn_admin_preview_substitute_policy_decision = new Promise((r) => { resolve = r; });
  const first = h.api.previewR3SubstituteDecision(assignment, roleA);
  await h.api.previewR3SubstituteDecision(assignment, roleA); assert.equal(h.previews().length, 1);
  resolve({ branchId: branch, assignmentId: assignment, lessonId: id(5), lessonRevision: 7,
    sourceFingerprint: "a".repeat(64), originalCoachRoleId: roleA, actualCoachRoleId: roleB, decisionEnabled: true });
  await first;
});
test("actual renderer binds the second row and only its exact chooser, preserving rerender/back safety", async () => {
  const h = harness(); h.add(roleA); h.add(roleB); h.api.renderEffectiveSettlementPreview();
  let buttons = h.rows.querySelectorAll("[data-r3-policy-preview]");
  assert.equal(buttons.length, 2); assert.ok(buttons.every((b) => b.listenerCount("click") === 1));
  buttons[1].emit("click"); await tick();
  assert.equal(h.previews().length, 1); assert.equal(h.api.ui.scope.coachRoleId, roleB);
  let selects = h.rows.querySelectorAll("[data-r3-policy-recipient]"); assert.equal(selects.length, 1);
  assert.equal(selects[0].dataset.r3PolicyCoach, roleB); assert.equal(selects[0].listenerCount("change"), 1);
  selects[0].value = "actualCoach"; selects[0].emit("change");
  const save = h.rows.querySelectorAll("[data-r3-policy-confirm]"); assert.equal(save.length, 1);
  assert.equal(save[0].listenerCount("click"), 1); assert.equal(save[0].disabled, false);
  save[0].emit("click"); await tick(); assert.equal(h.confirms().length, 1);
  save[0].emit("click"); await tick(); assert.equal(h.confirms().length, 1);
  h.controls.current = false; h.api.renderEffectiveSettlementPreview();
  assert.equal(h.rows.querySelectorAll("[data-r3-policy-confirm]").length, 0);
});
test("tampered chooser row or assignment cannot mutate recipient or call save", async () => {
  const h = harness(); h.add(roleA); await h.api.previewR3SubstituteDecision(assignment, roleA);
  const select = h.rows.querySelectorAll("[data-r3-policy-recipient]")[0];
  select.dataset.r3PolicyCoach = roleB; select.value = "actualCoach"; select.emit("change");
  assert.equal(h.api.ui.recipient, "");
  select.dataset.r3PolicyCoach = roleA; select.dataset.r3PolicyAssignment = id(99); select.emit("change");
  assert.equal(h.api.ui.recipient, ""); assert.equal(h.confirms().length, 0);
});
test("response loss retains exact operation key for same payload without forced local success", async () => {
  const h = harness(); h.add(roleA); await h.api.previewR3SubstituteDecision(assignment, roleA);
  h.api.ui.recipient = "actualCoach"; h.controls.failConfirm = true;
  await h.api.confirmR3SubstituteDecision(roleA, assignment); const key = h.api.ui.operationKey;
  assert.ok(key); assert.ok(h.api.ui.preview); assert.equal(h.refreshes(), 0);
  h.controls.failConfirm = false; await h.api.confirmR3SubstituteDecision(roleA, assignment);
  assert.equal(h.confirms()[1].args.target_operation_key, key);
});
test("private canonical fragment and modular candidate use the same repaired functions", async () => {
  const original = source(true), modular = source(false);
  for (const name of functionNames) {
    assert.equal(extract(original, name).replace(/\bescapeHtmlText\(/g, "escapeHtml("), extract(modular, name));
  }
  const h = harness({ privateFragment: true }); h.add(roleA); h.add(roleB);
  await h.api.previewR3SubstituteDecision(assignment, roleB); h.api.ui.recipient = "actualCoach";
  await h.api.confirmR3SubstituteDecision(roleB, assignment); assert.equal(h.confirms().length, 1);
});

test("server gate rejection retains exact scoped operation and never reports local success", async () => {
  const h = harness(); h.add(roleA); await h.api.previewR3SubstituteDecision(assignment, roleA);
  h.api.ui.recipient = "actualCoach"; h.controls.rejectGate = true;
  await h.api.confirmR3SubstituteDecision(roleA, assignment);
  assert.equal(h.confirms().length, 1); assert.equal(h.refreshes(), 0);
  assert.ok(h.api.ui.operationKey); assert.ok(h.api.ui.preview);
  assert.equal(h.api.ui.scope.coachRoleId, roleA); assert.equal(h.api.ui.busy, false);
  assert.equal(h.api.ui.message, "합성 오류");
});
test("wrong server preview branch, lesson revision or actual role cannot bind a decision", async () => {
  for (const kind of ["branch", "revision", "actual-role"]) {
    const h = harness(); h.add(roleA);
    const reply = { branchId: branch, assignmentId: assignment, lessonId: id(5), lessonRevision: 7,
      sourceFingerprint: "a".repeat(64), originalCoachRoleId: roleA, actualCoachRoleId: roleB, decisionEnabled: true };
    if (kind === "branch") reply.branchId = id(99);
    if (kind === "revision") reply.lessonRevision++;
    if (kind === "actual-role") reply.actualCoachRoleId = id(99);
    h.pending.tn_admin_preview_substitute_policy_decision = Promise.resolve(reply);
    await h.api.previewR3SubstituteDecision(assignment, roleA);
    assert.equal(h.api.ui.preview, null, kind); assert.equal(h.confirms().length, 0, kind);
  }
});
test("switching coach rows removes prior controls rather than saving an arbitrary duplicate", async () => {
  const h = harness(); h.add(roleA); h.add(roleB);
  await h.api.previewR3SubstituteDecision(assignment, roleA);
  const oldSelect = h.rows.querySelectorAll("[data-r3-policy-recipient]")[0];
  oldSelect.value = "actualCoach"; oldSelect.emit("change");
  const oldSave = h.rows.querySelectorAll("[data-r3-policy-confirm]")[0];
  await h.api.previewR3SubstituteDecision(assignment, roleB);
  oldSave.emit("click"); await tick(); assert.equal(h.confirms().length, 0);
  const select = h.rows.querySelectorAll("[data-r3-policy-recipient]")[0];
  assert.equal(select.dataset.r3PolicyCoach, roleB);
  select.value = "originalCoach"; select.emit("change");
  h.rows.querySelectorAll("[data-r3-policy-confirm]")[0].emit("click"); await tick();
  assert.equal(h.confirms().length, 1); assert.equal(h.confirms()[0].args.target_chosen_recipient, "originalCoach");
});

test("integration: actual repository paths retain reviewed source and six function pins", () => {
  for (const [file, expected] of Object.entries(reviewedSourcePins)) {
    assert.equal(digest(fs.readFileSync(path.join(root, file), "utf8")), expected, file);
  }
  assertReviewedFunctions(source(true));
  assertReviewedFunctions(source(false));
  assert.match(source(false).split("\n")[0], /scope: null/);
});
test("integration: missing or modified source function cannot satisfy the reviewed binding", () => {
  const current = source();
  const modified = current.replace("function r3SubstituteDecisionCandidate(", "function r3SubstituteDecisionCandidate( ");
  assert.notEqual(modified, current);
  assert.throws(() => assertReviewedFunctions(modified));
  assert.throws(() => assertReviewedFunctions(current.replace("function r3SubstituteDecisionCandidate(", "function missingCandidate(")));
});

test("integration: github ci metadata requires the exact successful PR and merge graph", () => {
  const { spawnSync } = require("node:child_process");
  const program = String.raw`
import copy, runpy
f = runpy.run_path('scripts/check_r3_dev_deployment.py')['row_scope_validate_ci_evidence']
repo='leisurewang0827/tennis-note-public'; base='d4ee449afcc5f442e5e98cc2792bff87146bffd1'
candidate='1'*40; source='2'*40; merge='3'*40; tree='4'*40
branch='codex/tennisnote-r3-substitute-row-scope-dev569-20261030'
basebranch='codex/tennisnote-coach-settlement-summary-dev568-20261030'
run={'workflow_id':329932540,'path':'.github/workflows/tennisnote-public-ci.yml','event':'pull_request','head_sha':candidate,'id':1,'run_attempt':1,'status':'completed','conclusion':'success','repository':{'full_name':repo},'head_repository':{'full_name':repo},'pull_requests':[{'number':2,'head':{'sha':candidate},'base':{'sha':base}}]}
pr={'state':'open','number':2,'head':{'sha':candidate,'ref':branch,'repo':{'full_name':repo}},'base':{'sha':base,'ref':basebranch,'repo':{'full_name':repo}},'merge_commit_sha':merge}
head={'sha':candidate,'parents':[{'sha':source}],'tree':{'sha':tree}}
src={'sha':source,'parents':[{'sha':base}]}
merged={'sha':merge,'parents':[{'sha':base},{'sha':candidate}],'tree':{'sha':tree}}
args=[run,pr,head,src,merged,candidate]
assert f(*args)['status']=='CI_METADATA_BOUND'
changes=[lambda a:a[0].update(conclusion='failure'),lambda a:a[0].update(status='queued'),lambda a:a[0].update(run_attempt=2),lambda a:a[0].update(head_sha='5'*40),lambda a:a[0].update(workflow_id=0),lambda a:a[1]['base'].update(sha='6'*40),lambda a:a[4].update(parents=[{'sha':candidate},{'sha':base}]),lambda a:a[4]['tree'].update(sha='7'*40),lambda a:a[0].update(conclusion='skipped'),lambda a:a[0].update(event='push')]
for change in changes:
    bad=copy.deepcopy(args); change(bad)
    try: f(*bad)
    except ValueError: continue
    raise AssertionError('bad CI metadata admitted')
print('CI_METADATA 1 positive / 10 negative PASS; deployment 0')
`;
  const result = spawnSync("python", ["-c", program], { cwd: root, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 positive \/ 10 negative PASS/);
});

test("integration: row scope boundary enforces exact two-layer paths, status and modes", async () => {
  const { pathToFileURL } = require("node:url");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  const mode = (p) => p === "scripts/verify.sh" ? "100755" : "100644";
  const sourceRows = [...m.ROW_SCOPE_MODIFIED, ...m.ROW_SCOPE_NEW].map((p) => ({ path: p,
    status: m.ROW_SCOPE_NEW.includes(p) ? "A" : "M", baseMode: m.ROW_SCOPE_NEW.includes(p) ? "" : mode(p),
    sourceMode: mode(p), headMode: mode(p) }));
  const metadataRows = m.METADATA.map((p) => ({ path: p, status: "M", baseMode: "100644", sourceMode: "100644", headMode: "100644" }));
  const head = "1".repeat(40), source = "2".repeat(40);
  const p = { repo: m.REPOSITORY, branch: m.ROW_SCOPE_BRANCH, base: m.ROW_SCOPE_BASE, baseTree: m.ROW_SCOPE_BASE_TREE,
    clean: true, indexClean: true, symlinks: false, head, source, checkout: head,
    headParents: [source], sourceParents: [m.ROW_SCOPE_BASE], headTree: "3".repeat(40), sourceTree: "4".repeat(40), sourceRows, metadataRows };
  assert.equal(m.rowScopeBoundary(p).status, "BOUNDARY_ONLY_NOT_ADMITTED");
  const mutate = [
    (x) => { x.branch = "wrong"; }, (x) => { x.base = "5".repeat(40); },
    (x) => { x.clean = false; }, (x) => { x.indexClean = false; }, (x) => { x.symlinks = true; },
    (x) => { x.headParents = [x.base, x.source]; }, (x) => { x.sourceParents = ["6".repeat(40)]; },
    (x) => { x.sourceRows.find((r) => r.status === "A").baseMode = "100644"; },
    (x) => { x.sourceRows.find((r) => r.status === "A").status = "M"; },
    (x) => { x.sourceRows.find((r) => r.path === "scripts/verify.sh").headMode = "100644"; },
    (x) => { x.sourceRows.pop(); }, (x) => { x.sourceRows.push({ ...x.sourceRows[0] }); },
    (x) => { x.sourceRows[0].path = "unexpected"; }, (x) => { x.metadataRows[0].status = "D"; },
    (x) => { x.metadataRows[0].path = x.sourceRows[0].path; },
  ];
  for (const change of mutate) { const bad = structuredClone(p); change(bad); assert.throws(() => m.rowScopeBoundary(bad)); }
});

test("integration: row scope boundary rejects the actual dirty checkout before collection", async () => {
  const { pathToFileURL } = require("node:url");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  assert.throws(() => m.rowScopePacket(root, "1".repeat(40)), /ROW_SCOPE_DIRTY/);
});

test("integration: PR merge context binds detached checkout and feature source exactly", async () => {
  const { pathToFileURL } = require("node:url");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  const feature = "1".repeat(40), source = "2".repeat(40), merge = "3".repeat(40), tree = "4".repeat(40);
  const ref = "refs/pull/12/merge", repo = m.REPOSITORY;
  const ci = { event: "pull_request", repo, eventRepo: repo, headRepo: repo, baseRepo: repo,
    baseRef: "codex/tennisnote-coach-settlement-summary-dev568-20261030", baseSha: m.ROW_SCOPE_BASE,
    headRef: m.ROW_SCOPE_BRANCH, featureHead: feature, mergeHead: merge, githubSha: merge, workflowSha: merge,
    workflow: "Tennis Note Public PWA CI", workflowRef: repo + "/.github/workflows/tennisnote-public-ci.yml@" + ref,
    ref, refType: "branch", number: 12, eventNumber: 12, attempt: "1", checkout: merge, checkoutBranch: "",
    mergeParents: [m.ROW_SCOPE_BASE, feature], mergeTree: tree, featureTree: tree };
  assert.equal(m.rowScopeCiContext(ci).status, "CI_CONTEXT_ONLY_NOT_ADMITTED");
  const mode = (p) => p === "scripts/verify.sh" ? "100755" : "100644";
  const sourceRows = [...m.ROW_SCOPE_MODIFIED, ...m.ROW_SCOPE_NEW].map((p) => ({ path: p, status: m.ROW_SCOPE_NEW.includes(p) ? "A" : "M",
    baseMode: m.ROW_SCOPE_NEW.includes(p) ? "" : mode(p), sourceMode: mode(p), headMode: mode(p) }));
  const metadataRows = m.METADATA.map((p) => ({ path: p, status: "M", baseMode: "100644", sourceMode: "100644", headMode: "100644" }));
  const packet = { repo, branch: m.ROW_SCOPE_BRANCH, base: m.ROW_SCOPE_BASE, baseTree: m.ROW_SCOPE_BASE_TREE,
    head: feature, source, checkout: merge, headParents: [source], sourceParents: [m.ROW_SCOPE_BASE],
    headTree: tree, sourceTree: "5".repeat(40), clean: true, indexClean: true, symlinks: false, sourceRows, metadataRows, ci };
  assert.equal(m.rowScopeBoundary(packet).status, "BOUNDARY_ONLY_NOT_ADMITTED");
  const changes = [
    (x) => { x.repo = "wrong"; }, (x) => { x.eventRepo = "wrong"; }, (x) => { x.headRepo = "wrong"; },
    (x) => { x.baseRepo = "wrong"; }, (x) => { x.baseRef = "wrong"; }, (x) => { x.baseSha = "6".repeat(40); },
    (x) => { x.headRef = "wrong"; }, (x) => { x.featureHead = "6".repeat(40); }, (x) => { x.ref = "refs/pull/13/merge"; },
    (x) => { x.eventNumber = 13; }, (x) => { x.attempt = "2"; }, (x) => { x.checkoutBranch = m.ROW_SCOPE_BRANCH; },
    (x) => { x.checkout = feature; }, (x) => { x.githubSha = feature; }, (x) => { x.workflowSha = feature; },
    (x) => { x.workflowRef = "wrong"; }, (x) => { x.mergeParents.reverse(); }, (x) => { x.mergeTree = "6".repeat(40); },
  ];
  for (const change of changes) { const bad = structuredClone(ci); change(bad); assert.throws(() => m.rowScopeCiContext(bad)); }
  const forged = structuredClone(packet); forged.head = "7".repeat(40); assert.throws(() => m.rowScopeBoundary(forged));
});

test("integration: B2a source bodies reject tampering without admitting deployment", async () => {
  const { pathToFileURL } = require("node:url");
  const { execFileSync } = require("node:child_process");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  const mode = (p) => p === "scripts/verify.sh" ? "100755" : "100644";
  const sourceRows = [...m.ROW_SCOPE_MODIFIED, ...m.ROW_SCOPE_NEW].map((p) => ({ path: p,
    status: m.ROW_SCOPE_NEW.includes(p) ? "A" : "M", baseMode: m.ROW_SCOPE_NEW.includes(p) ? "" : mode(p),
    sourceMode: mode(p), headMode: mode(p) }));
  const metadataRows = m.METADATA.map((p) => ({ path: p, status: "M", baseMode: "100644", sourceMode: "100644", headMode: "100644" }));
  const readBase = (p) => execFileSync("git", ["show", m.ROW_SCOPE_BASE + ":" + p], {
    cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"] });
  const bodies = {};
  for (const r of sourceRows) {
    const sourceText = fs.readFileSync(path.join(root, r.path), "utf8");
    bodies[r.path] = { base: r.status === "A" ? null : readBase(r.path), source: sourceText, head: sourceText };
  }
  for (const r of metadataRows) {
    const baseText = readBase(r.path);
    bodies[r.path] = { base: baseText, source: baseText, head: fs.readFileSync(path.join(root, r.path), "utf8") };
  }
  const head = "1".repeat(40), source = "2".repeat(40);
  const packet = { repo: m.REPOSITORY, branch: m.ROW_SCOPE_BRANCH, base: m.ROW_SCOPE_BASE, baseTree: m.ROW_SCOPE_BASE_TREE,
    clean: true, indexClean: true, symlinks: false, head, source, checkout: head, headParents: [source],
    sourceParents: [m.ROW_SCOPE_BASE], headTree: "3".repeat(40), sourceTree: "4".repeat(40), sourceRows, metadataRows, bodies };
  const proof = m.rowScopeValidate(packet);
  assert.equal(proof.status, "SOURCE_BODY_VALID_LOCAL_ONLY_NOT_ADMITTED");
  assert.equal(proof.deploymentAdmitted, false); assert.equal(proof.workflowRoutePending, false);
  const changes = [
    (x) => { const b = x.bodies["app/admin/data/billing.js"]; b.source += " "; b.head = b.source; },
    (x) => { const b = x.bodies["tests/fixtures/r3-substitute-policy-private-reviewed.fragment.js"]; b.source += " "; b.head = b.source; },
    (x) => { const b = x.bodies["tests/r3-substitute-policy-row-scope.test.cjs"]; b.source = b.source.replace("canonical item without coachRoleId", "changed callback name"); b.head = b.source; },
    (x) => { const b = x.bodies["scripts/verify.sh"]; b.source = b.source.replace("--r3-substitute-row-scope", "--wrong"); b.head = b.source; },
    (x) => { x.bodies["app/release.json"].source += " "; },
    (x) => { const b = x.bodies["scripts/check_r3_purchase_identity_admission.mjs"]; b.source += " "; b.head = b.source; },
    (x) => { const b = x.bodies[".github/workflows/tennisnote-public-ci.yml"]; b.source += " "; b.head = b.source; },
    (x) => { x.bodies["app/release.json"].head = x.bodies["app/release.json"].head.replace("1.0.569", "1.0.568"); },
    (x) => { x.bodies["app/admin/index.html"].head += " "; },
  ];
  for (const change of changes) { const bad = structuredClone(packet); change(bad); assert.throws(() => m.rowScopeValidate(bad)); }
});

test("integration: seal declaration rejects pending, alternate and duplicate literals", async () => {
  const { pathToFileURL } = require("node:url"), { execFileSync } = require("node:child_process");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  const mode = (p) => p === "scripts/verify.sh" ? "100755" : "100644";
  const sourceRows = [...m.ROW_SCOPE_MODIFIED, ...m.ROW_SCOPE_NEW].map((p) => ({ path: p, status: m.ROW_SCOPE_NEW.includes(p) ? "A" : "M",
    baseMode: m.ROW_SCOPE_NEW.includes(p) ? "" : mode(p), sourceMode: mode(p), headMode: mode(p) }));
  const metadataRows = m.METADATA.map((p) => ({ path: p, status: "M", baseMode: "100644", sourceMode: "100644", headMode: "100644" }));
  const base = (p) => execFileSync("git", ["show", m.ROW_SCOPE_BASE + ":" + p], { cwd: root, encoding: "utf8",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  const bodies = {};
  for (const r of sourceRows) { const text = fs.readFileSync(path.join(root, r.path), "utf8");
    bodies[r.path] = { base: r.status === "A" ? null : base(r.path), source: text, head: text }; }
  for (const r of metadataRows) { const old = base(r.path); bodies[r.path] = { base: old, source: old, head: fs.readFileSync(path.join(root, r.path), "utf8") }; }
  const head = "1".repeat(40), source = "2".repeat(40);
  const packet = { repo: m.REPOSITORY, branch: m.ROW_SCOPE_BRANCH, base: m.ROW_SCOPE_BASE, baseTree: m.ROW_SCOPE_BASE_TREE,
    clean: true, indexClean: true, symlinks: false, head, source, checkout: head, headParents: [source], sourceParents: [m.ROW_SCOPE_BASE],
    headTree: "3".repeat(40), sourceTree: "4".repeat(40), sourceRows, metadataRows, bodies };
  assert.equal(m.rowScopeValidate(packet).status, "SOURCE_BODY_VALID_LOCAL_ONLY_NOT_ADMITTED");
  const declaration = `export const ROW_SCOPE_BODY_SEAL = "${m.ROW_SCOPE_BODY_SEAL}";`;
  const alternate = m.ROW_SCOPE_BODY_SEAL === "a".repeat(64) ? "b".repeat(64) : "a".repeat(64);
  for (const replacement of ['export const ROW_SCOPE_BODY_SEAL = "PENDING";', `export const ROW_SCOPE_BODY_SEAL = "${alternate}";`, declaration + "\n" + declaration]) {
    const bad = structuredClone(packet), body = bad.bodies[m.SELF];
    assert.equal(body.source.split(declaration).length, 2);
    body.source = body.source.replace(declaration, replacement); body.head = body.source;
    assert.throws(() => m.rowScopeValidate(bad), /ROW_SCOPE_SEAL_DECLARATION/);
  }
});

test("integration: B2b route binds final source and rejects invalid claims", async () => {
  const { pathToFileURL } = require("node:url"), { execFileSync, spawnSync } = require("node:child_process");
  const m = await import(pathToFileURL(path.join(root, "scripts/check_r3_purchase_identity_admission.mjs")).href);
  assert.equal(m.rowScopeRequested([], {}), false);
  assert.equal(m.rowScopeRequested(["--ci-route", "--row-scope"], {}), true);
  const ref = "refs/heads/" + m.ROW_SCOPE_BRANCH, head = "1".repeat(40);
  const dev = { event: "workflow_dispatch", repo: m.REPOSITORY, eventRepo: m.REPOSITORY, ref, refType: "branch",
    attempt: "1", checkoutBranch: "", workflow: "Deploy Tennis Note development sites",
    workflowRef: m.REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@" + ref,
    workflowSha: head, githubSha: head, input: head, head, checkout: head };
  assert.equal(m.rowScopeDevContext(dev).status, "DEV_CONTEXT_ONLY_NOT_ADMITTED");
  for (const mutate of [x => { x.repo = "wrong"; }, x => { x.eventRepo = "wrong"; }, x => { x.ref = "refs/heads/main"; },
    x => { x.attempt = "2"; }, x => { x.checkoutBranch = m.ROW_SCOPE_BRANCH; }, x => { x.input = "2".repeat(40); },
    x => { x.workflow = "wrong"; }, x => { x.workflowSha = "3".repeat(40); }]) {
    const bad = structuredClone(dev); mutate(bad); assert.throws(() => m.rowScopeDevContext(bad));
  }
  const mode = (p) => p === "scripts/verify.sh" ? "100755" : "100644";
  const sourceRows = [...m.ROW_SCOPE_MODIFIED, ...m.ROW_SCOPE_NEW].map((p) => ({ path: p, status: m.ROW_SCOPE_NEW.includes(p) ? "A" : "M",
    baseMode: m.ROW_SCOPE_NEW.includes(p) ? "" : mode(p), sourceMode: mode(p), headMode: mode(p) }));
  const metadataRows = m.METADATA.map((p) => ({ path: p, status: "M", baseMode: "100644", sourceMode: "100644", headMode: "100644" }));
  const base = (p) => execFileSync("git", ["show", m.ROW_SCOPE_BASE + ":" + p], { cwd: root, encoding: "utf8",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  const bodies = {};
  for (const r of sourceRows) { const text = fs.readFileSync(path.join(root, r.path), "utf8");
    bodies[r.path] = { base: r.status === "A" ? null : base(r.path), source: text, head: text }; }
  for (const r of metadataRows) { const old = base(r.path); bodies[r.path] = { base: old, source: old, head: fs.readFileSync(path.join(root, r.path), "utf8") }; }
  const source = "2".repeat(40), packet = { repo: m.REPOSITORY, branch: m.ROW_SCOPE_BRANCH, base: m.ROW_SCOPE_BASE, baseTree: m.ROW_SCOPE_BASE_TREE,
    clean: true, indexClean: true, symlinks: false, head, source, checkout: head, headParents: [source], sourceParents: [m.ROW_SCOPE_BASE],
    headTree: "3".repeat(40), sourceTree: "4".repeat(40), sourceRows, metadataRows, bodies, dev };
  const result = m.rowScopeValidate(packet);
  assert.equal(result.status, "SOURCE_BODY_VALID_LOCAL_ONLY_NOT_ADMITTED");
  assert.equal(result.workflowRoutePending, false); assert.equal(result.deploymentAdmitted, false);
  for (const file of [".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_dev_deployment.py", m.SELF]) {
    const bad = structuredClone(packet), body = bad.bodies[file]; body.source += " "; body.head = body.source;
    assert.throws(() => m.rowScopeValidate(bad));
  }
  const processResult = spawnSync(process.execPath, [path.join(root, m.SELF), "--ci-route", "--row-scope"],
    { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "push", GIT_NO_LAZY_FETCH: "1" }, timeout: 10000 });
  assert.equal(processResult.status, 2); assert.doesNotMatch(processResult.stdout, /scoped=true|SOURCE_PROVEN/);
});
