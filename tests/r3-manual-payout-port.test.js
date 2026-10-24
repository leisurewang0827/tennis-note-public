import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const canonicalText = (value) => String(value).replace(/\r\n/g, "\n");
const gitBlobOid = (value) => createHash("sha1").update(`blob ${Buffer.byteLength(value, "utf8")}\0`).update(value, "utf8").digest("hex");
const scope = { branchId: "synthetic-branch", coachRoleId: "synthetic-coach-role", settlementMonth: "2099-01-01" };
const snapshot = {
  snapshotId: "synthetic-snapshot",
  revision: 4,
  sourceFingerprint: "a".repeat(64),
  totals: { totalSettlementAmount: 5000 },
};

function functionSource(file, name, async = false) {
  const source = read(file);
  const match = source.match(new RegExp(`^(?:${async ? "async\\s+" : ""}function )${name}\\([^\\n]*\\)\\s*\\{[\\s\\S]*?^\\}`, "m"));
  assert(match, `missing function ${name} in ${file}`);
  return match[0];
}

function adminHarness({ recordingEnabled = true, payoutState, onRecord, onReverse, onReadback, role = "admin", approved = true } = {}) {
  const calls = [];
  const currentState = payoutState || {
    scope: { ...scope },
    snapshot: { ...snapshot },
    payout: { recordingEnabled, activeRecord: null, events: [] },
  };
  const current = {
    status: "CONFIRMED",
    scopeState: {
      scope: { ...scope },
      snapshot: { ...snapshot },
      confirmation: { status: "confirmed" },
      reconciliation: { status: "acknowledged" },
    },
    payoutState: currentState,
    payoutReadValid: true,
    payoutSubmitting: false,
    payoutLoading: false,
    payoutUncertain: false,
    payoutRequestId: 0,
    payoutOperationSignature: "",
    payoutOperationKey: "",
    payoutReverseOperationSignature: "",
    payoutReverseOperationKey: "",
    payoutMessage: "",
  };
  let operationNumber = 0;
  let sessionToken = "synthetic-session";
  const client = {
    getSession: () => ({ access_token: sessionToken }),
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "tn_admin_record_monthly_settlement_payout") return onRecord?.(args, currentState);
      if (name === "tn_admin_reverse_monthly_settlement_payout") return onReverse?.(args, currentState);
      if (name === "tn_monthly_settlement_payout_state") return onReadback?.(currentState) ?? currentState;
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const elements = new Map([
    ["#adminR3PayoutDate", { value: "2099-01-25" }],
    ["#adminR3PayoutMethod", { value: "bank_transfer" }],
    ["#adminR3PayoutReverseReason", { value: "wrong_date" }],
  ]);
  const sandbox = vm.createContext({
    window: { crypto: webcrypto, TextEncoder, TennisNoteDataClient: client },
    TextEncoder,
    adminMonthlySettlementWrite: current,
    adminImportAuthState: { profile: { id: "synthetic-admin" } },
    adminSettlementHistoryScope: () => ({ ...scope }),
    adminSettlementHistoryScopeKey: (value = scope) => JSON.stringify(value),
    adminR3SettlementSnapshot: (value) => value?.snapshot || (value?.snapshotId ? value : null),
    adminSettlementHistoryCoaches: () => [{ serverRoleId: scope.coachRoleId }],
    operationsRole: () => role,
    adminApprovalReady: () => approved,
    createAdminOperationKey: () => `synthetic-operation-${++operationNumber}`,
    renderAdminSettlementHistory() {},
    $: (selector) => elements.get(selector) || null,
  });
  const adminFile = "app/admin/actions/billing.js";
  const snippets = [
    functionSource(adminFile, "adminR3SettlementScopeMatches"),
    functionSource(adminFile, "adminR3PayoutBaseMatches"),
    functionSource(adminFile, "adminR3PayoutEvent"),
    functionSource(adminFile, "adminR3PayoutEventMatchesSnapshot"),
    functionSource(adminFile, "adminR3PayoutOperationHash", true),
    functionSource(adminFile, "adminR3EnsurePayoutOperation"),
    functionSource(adminFile, "recordAdminMonthlySettlementPayout", true),
    functionSource(adminFile, "reverseAdminMonthlySettlementPayout", true),
    "this.recordPayout = recordAdminMonthlySettlementPayout; this.reversePayout = reverseAdminMonthlySettlementPayout;",
  ];
  vm.runInContext(snippets.join("\n\n"), sandbox);
  return { sandbox, current, calls, state: currentState, setSessionToken: (value) => { sessionToken = value; } };
}

function recordedState(args) {
  const opHash = sha256(args.target_operation_key);
  const event = {
    operationKeyHash: opHash,
    eventType: "payout_recorded",
    eventId: "synthetic-payout-event",
    snapshotId: snapshot.snapshotId,
    snapshotRevision: snapshot.revision,
    sourceFingerprint: snapshot.sourceFingerprint,
    amount: snapshot.totals.totalSettlementAmount,
    paidOn: args.target_paid_on,
    paymentMethod: args.target_payment_method,
    reversed: false,
  };
  return {
    scope: { ...scope },
    snapshot: { ...snapshot },
    payout: { recordingEnabled: true, state: "RECORDED", activeRecord: event, events: [event] },
  };
}

test("R3 manual payout public port is pinned to the reviewed private source contract", () => {
  const authority = JSON.parse(read("tests/fixtures/r3-manual-payout-port-source-authority.json"));
  assert.match(authority.privateFeatureCommit, /^[0-9a-f]{40}$/);
  assert.match(authority.privateMergedMain, /^[0-9a-f]{40}$/);
  assert.match(authority.privateReviewedCommit, /^[0-9a-f]{40}$/);
  assert.equal(authority.migration.slice(0, 14), "20261023001000");
  assert.equal(authority.sourceVerification.remoteExactRefRead, true);
  assert.equal(authority.sourceVerification.localMergedMainGitObjectAvailable, false);
  assert.equal(new Set(authority.publicFiles.map((row) => row.path)).size, 7);
  const successor = authority.releaseSuccessor;
  assert.equal(successor.contract, "r3-manual-payout-public-dev-release-successor/1");
  const release = JSON.parse(read("app/release.json"));
  assert.ok([successor.baseVersion, successor.targetVersion].includes(release.version), "unexpected public release version");
  const readCacheVersion = (file, prefix) => {
    const match = read(file).match(new RegExp(`CACHE_NAME\\s*=\\s*[\"']${prefix}-v(\\d+)[\"']`));
    assert(match, `missing cache name for ${prefix}`);
    return Number(match[1]);
  };
  if (release.version === successor.baseVersion) {
    assert.equal(release.releaseId, successor.baseReleaseId);
  } else {
    assert.equal(release.releaseId, successor.targetReleaseId);
    assert.equal(readCacheVersion("app/tennis-note-member-app/service-worker.js", "tennis-note-member-pwa"), successor.candidateMemberCache);
    assert.equal(readCacheVersion("app/tennis-note-coach-app/service-worker.js", "tennis-note-coach-mode"), successor.candidateCoachCache);
    assert.ok(successor.candidateMemberCache > successor.memberCacheFloor);
    assert.ok(successor.candidateCoachCache > successor.coachCacheFloor);
  }
  assert.deepEqual(Object.keys(authority.privateFiles.reviewed).sort(), Object.keys(authority.privateFiles.mergedMain).sort());
  assert.deepEqual(Object.keys(authority.privateFiles.feature).sort(), Object.keys(authority.privateFiles.reviewed).sort());
  for (const row of authority.publicFiles) {
    const canonical = canonicalText(read(row.path));
    if (row.releaseInvariantSha256) {
      const queryMatches = [...canonical.matchAll(/\?v=(\d+\.\d+\.\d+)/g)];
      assert.equal(queryMatches.length, row.versionQueryCount, `${row.path} version query count`);
      assert.ok(queryMatches.every((match) => match[1] === release.version), `${row.path} version query release parity`);
      const normalized = canonical.replace(/\?v=\d+\.\d+\.\d+/g, "?v=<VERSION>");
      assert.equal(sha256(normalized), row.releaseInvariantSha256, `${row.path} release-invariant canonical-LF SHA-256`);
      const tampered = `${normalized}// synthetic source drift\\n`;
      assert.notEqual(sha256(tampered), row.releaseInvariantSha256, `${row.path} tamper must break the release-invariant pin`);
    } else {
      assert.equal(sha256(canonical), row.canonicalLfSha256, `${row.path} canonical-LF SHA-256`);
      assert.equal(gitBlobOid(canonical), row.gitBlob, `${row.path} Git blob OID`);
      const tampered = `${canonical}// synthetic source drift\\n`;
      assert.notEqual(sha256(tampered), row.canonicalLfSha256, `${row.path} tamper must break the canonical pin`);
      assert.notEqual(gitBlobOid(tampered), row.gitBlob, `${row.path} tamper must break the Git blob pin`);
    }
  }

  const adminAction = read("app/admin/actions/billing.js");
  const payoutActions = [
    functionSource("app/admin/actions/billing.js", "recordAdminMonthlySettlementPayout", true),
    functionSource("app/admin/actions/billing.js", "reverseAdminMonthlySettlementPayout", true),
  ].join("\n");
  const adminEvents = read("app/admin/events/billing.js");
  const adminMarkup = read("app/admin/index.html");
  const coachData = read("app/tennis-note-coach-app/data/sync.js");
  const coachView = read("app/tennis-note-coach-app/views/settlement.js");
  for (const rpc of Object.values(authority.rpc)) assert(adminAction.includes(`"${rpc}"`), rpc);
  assert.match(adminEvents, /#adminR3PayoutRecord[^\n]*recordAdminMonthlySettlementPayout/);
  assert.match(adminEvents, /#adminR3PayoutReverse[^\n]*reverseAdminMonthlySettlementPayout/);
  assert.match(adminMarkup, /<details id="adminR3PayoutDetails" hidden>/);
  assert.match(coachData, /async function readCoachSettlementPayoutState\(scope\)[\s\S]*?tn_monthly_settlement_payout_state/);
  assert.match(coachView, /수동 기록/);
  assert.match(coachView, /실제 송금/);
  assert.doesNotMatch(coachData, /tn_admin_(?:record|reverse)_monthly_settlement_payout/);
  assert.doesNotMatch(payoutActions, /portone|paymentIntent|refundOrder|transferFunds/i);
  assert.match(functionSource("app/admin/actions/billing.js", authority.privateFunctionMap.record[1], true), /tn_admin_record_monthly_settlement_payout/);
  assert.match(functionSource("app/admin/actions/billing.js", authority.privateFunctionMap.reverse[1], true), /tn_admin_reverse_monthly_settlement_payout/);
  assert.match(functionSource("app/tennis-note-coach-app/data/sync.js", authority.privateFunctionMap.state[1], true), /tn_monthly_settlement_payout_state/);
});

test("R3 payout port matches pinned private feature/review/merge object bindings when source checkout is supplied", { skip: !process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO }, () => {
  const repo = process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
  const authority = JSON.parse(read("tests/fixtures/r3-manual-payout-port-source-authority.json"));
  const filePaths = Object.keys(authority.privateFiles.feature);
  const readAt = (revision, file) => execFileSync("git", ["-C", repo, "show", `${revision}:${file}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const blobAt = (revision, file) => execFileSync("git", ["-C", repo, "rev-parse", `${revision}:${file}`], { encoding: "utf8" }).trim();
  const assertBinding = (revision, rows) => {
    for (const file of filePaths) {
      const content = canonicalText(readAt(revision, file));
      assert.equal(blobAt(revision, file), rows[file].gitBlob, `${revision}:${file} Git blob`);
      assert.equal(sha256(content), rows[file].canonicalLfSha256, `${revision}:${file} canonical-LF SHA-256`);
    }
  };
  assertBinding(authority.privateFeatureCommit, authority.privateFiles.feature);
  assertBinding(authority.privateReviewedCommit, authority.privateFiles.reviewed);
  for (const file of filePaths) {
    assert.equal(authority.privateFiles.reviewed[file].gitBlob, authority.privateFiles.mergedMain[file].gitBlob,
      `reviewed source must match merged main blob for ${file}`);
    assert.equal(authority.privateFiles.reviewed[file].canonicalLfSha256, authority.privateFiles.mergedMain[file].canonicalLfSha256,
      `reviewed source must match merged main canonical content for ${file}`);
  }

  const source = readAt(authority.privateReviewedCommit, "90-Dashboard/tennis-note-prototype/app.js");
  const coachSource = readAt(authority.privateReviewedCommit, "90-Dashboard/tennis-note-coach-app/app.js");
  const migration = readAt(authority.privateReviewedCommit, `supabase/supabase/migrations/${authority.migration}`);
  for (const name of ["readMonthlySettlementPayoutState", "recordMonthlySettlementPayout", "reverseMonthlySettlementPayout"]) {
    assert.match(source, new RegExp(`function ${name}\\(`), name);
  }
  assert.match(coachSource, /async function syncCoachSettlementPayoutState\(/);
  assert.match(coachSource, /tn_monthly_settlement_payout_state/);
  for (const rpc of ["tn_monthly_settlement_payout_state", "tn_admin_record_monthly_settlement_payout", "tn_admin_reverse_monthly_settlement_payout"]) {
    assert.ok(migration.includes(`public.${rpc}`), rpc);
  }
  assert.match(migration, /tn_r3_manual_payout_write_gate/);
  assert.match(migration, /if not public\.tn_is_admin\(\) then raise exception 'admin_role_required'/);
  assert.match(migration, /for update/);
  assert.doesNotMatch(migration, /portone|refund_order|transfer_funds/i);
});

test("R3 payout gate rejects before any RPC and response-loss recovery never retries the write", async () => {
  const denied = [
    adminHarness({ recordingEnabled: false }),
    adminHarness({ role: "coach" }),
    adminHarness({ approved: false }),
    ...["branchId", "coachRoleId", "settlementMonth"].map((key) => {
      const received = { ...scope, [key]: `wrong-${key}` };
      return adminHarness({ payoutState: {
        scope: received, snapshot: { ...snapshot }, payout: { recordingEnabled: true, activeRecord: null, events: [] },
      } });
    }),
    adminHarness({ payoutState: {
      scope: { ...scope }, snapshot: { ...snapshot, sourceFingerprint: "b".repeat(64) },
      payout: { recordingEnabled: true, activeRecord: null, events: [] },
    } }),
    adminHarness({ payoutState: {
      scope: { ...scope }, snapshot: { ...snapshot },
      payout: { recordingEnabled: true, activeRecord: { eventId: "synthetic-active" }, events: [] },
    } }),
  ];
  for (const blocked of denied) {
    assert.equal(await blocked.sandbox.recordPayout(), false);
    assert.deepEqual(blocked.calls, []);
  }

  let stored;
  const harness = adminHarness({
    onRecord: (args) => {
      stored = recordedState(args);
      harness.state.scope = stored.scope;
      harness.state.snapshot = stored.snapshot;
      harness.state.payout = stored.payout;
      throw new Error("synthetic response lost after persistence");
    },
  });
  const result = await harness.sandbox.recordPayout();
  assert.equal(result, true, `calls=${harness.calls.map((call) => call.name).join(",")}; message=${harness.current.payoutMessage}`);
  assert.equal(harness.calls.filter((call) => call.name === "tn_admin_record_monthly_settlement_payout").length, 1);
  assert.equal(harness.calls.filter((call) => call.name === "tn_monthly_settlement_payout_state").length, 1);
  assert.equal(harness.calls.some((call) => /payment|refund|transfer|portone/i.test(call.name)), false);
  assert.equal(harness.current.payoutUncertain, false);
  assert.equal(harness.current.payoutState.payout.activeRecord.eventId, "synthetic-payout-event");
  assert.ok(stored);
  assert.equal(await harness.sandbox.recordPayout(), false, "active record must block duplicate click");
  assert.equal(harness.calls.filter((call) => call.name === "tn_admin_record_monthly_settlement_payout").length, 1);
});

test("R3 payout rejects stale session state readback after the one-shot write", async () => {
  let harness;
  harness = adminHarness({
    onRecord: (args) => ({ payoutEventId: "synthetic-write-response" }),
    onReadback: (state) => {
      harness.setSessionToken("synthetic-replaced-session");
      return state;
    },
  });
  assert.equal(await harness.sandbox.recordPayout(), false);
  assert.equal(harness.calls.filter((call) => call.name === "tn_admin_record_monthly_settlement_payout").length, 1);
  assert.equal(harness.calls.filter((call) => call.name === "tn_monthly_settlement_payout_state").length, 1);
  assert.equal(harness.current.payoutState.payout.activeRecord, null, "stale-session readback is not adopted");
  assert.equal(harness.current.payoutUncertain, false, "obsolete session does not mutate current session state");
});

test("R3 payout reversal writes one correction event and uses exact readback only", async () => {
  const active = {
    eventId: "synthetic-existing-event",
    snapshotId: snapshot.snapshotId,
    snapshotRevision: snapshot.revision,
    sourceFingerprint: snapshot.sourceFingerprint,
    amount: snapshot.totals.totalSettlementAmount,
  };
  const initial = {
    scope: { ...scope },
    snapshot: { ...snapshot },
    payout: { recordingEnabled: true, state: "RECORDED", activeRecord: active, events: [active] },
  };
  let reverseResponse;
  const harness = adminHarness({
    payoutState: initial,
    onReverse: (args) => {
      const event = {
        operationKeyHash: sha256(args.target_operation_key),
        eventType: "payout_record_reversed",
        eventId: "synthetic-reversal-event",
        reversalOfEventId: active.eventId,
        snapshotId: active.snapshotId,
        snapshotRevision: active.snapshotRevision,
        sourceFingerprint: active.sourceFingerprint,
        amount: active.amount,
      };
      initial.payout.state = "REVERSED";
      initial.payout.activeRecord = null;
      initial.payout.events.push(event);
      reverseResponse = event.eventId;
      return { payoutEventId: reverseResponse };
    },
  });
  const result = await harness.sandbox.reversePayout();
  assert.equal(result, true, `calls=${harness.calls.map((call) => call.name).join(",")}; message=${harness.current.payoutMessage}`);
  assert.equal(harness.calls.filter((call) => call.name === "tn_admin_reverse_monthly_settlement_payout").length, 1);
  assert.equal(harness.calls.filter((call) => call.name === "tn_monthly_settlement_payout_state").length, 1);
  assert.equal(harness.calls.some((call) => /payment|refund|transfer|portone/i.test(call.name)), false);
  assert.equal(harness.current.payoutState.payout.state, "REVERSED");
  assert.equal(reverseResponse, "synthetic-reversal-event");
  assert.equal(await harness.sandbox.reversePayout(), false, "missing active record must block duplicate correction");
  assert.equal(harness.calls.filter((call) => call.name === "tn_admin_reverse_monthly_settlement_payout").length, 1);
});
