import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.env.TENNISNOTE_PUBLIC_REPO_ROOT || resolve(testDir, ".."));
const PINNED_PUBLIC_SHA = "582ebd00f31654233ecc77c1bf2efdd4fde0beec";
const sourceMode = process.env.TENNISNOTE_R3_SOURCE_MODE || "actual";
const domainPath = "app/admin/domain/coaches.js";
const actionPath = "app/admin/actions/coach.js";
const commonPath = "app/admin/data/common.js";
const schedulePath = "app/admin/data/schedule.js";
const formPath = "app/admin/forms/coach.js";
const settingsViewPath = "app/admin/views/settings.js";

function readPublicSource(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  assert.ok(absolutePath.startsWith(`${repoRoot}/`) || absolutePath.startsWith(`${repoRoot}\\`),
    `source path stays under the public repository: ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

function readGitSource(sourceSha, relativePath) {
  return execFileSync("git", ["-C", repoRoot, "show", `${sourceSha}:${relativePath}`], { encoding: "utf8" });
}

function applyUnifiedPatchInMemory(source, patchText, targetPath) {
  const sections = patchText.split(/^diff --git /m).slice(1);
  const section = sections.find((item) => item.startsWith(`a/${targetPath} b/${targetPath}\n`)
    || item.startsWith(`a/${targetPath} b/${targetPath}\r\n`));
  assert.ok(section, `patch contains ${targetPath}`);
  const lines = source.split(/\r?\n/);
  const sectionLines = section.split(/\r?\n/);
  let offset = 0;
  for (let i = 0; i < sectionLines.length; i += 1) {
    const header = sectionLines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!header) continue;
    const start = Number(header[1]) - 1 + offset;
    const oldLines = [];
    const newLines = [];
    for (i += 1; i < sectionLines.length && !sectionLines[i].startsWith("@@") && !sectionLines[i].startsWith("diff --git "); i += 1) {
      const line = sectionLines[i];
      if (line.startsWith("\\")) continue;
      if (line.startsWith(" ")) { oldLines.push(line.slice(1)); newLines.push(line.slice(1)); }
      else if (line.startsWith("-")) oldLines.push(line.slice(1));
      else if (line.startsWith("+")) newLines.push(line.slice(1));
      else if (line === "") break;
      else throw new Error(`unsupported unified patch line in ${targetPath}`);
    }
    assert.deepEqual(lines.slice(start, start + oldLines.length), oldLines,
      `${targetPath} exact pinned source context at old line ${Number(header[1])}`);
    lines.splice(start, oldLines.length, ...newLines);
    offset += newLines.length - oldLines.length;
    i -= 1;
  }
  return lines.join("\n");
}

function extractFunction(source, name) {
  const match = source.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(match, `actual source includes ${name}`);
  const start = match.index;
  const end = source.indexOf("\n}\n", start);
  assert.ok(end > start, `top-level function end found for ${name}`);
  return source.slice(start, end + 2);
}

function extractOptionalFunction(source, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  return declaration.test(source) ? extractFunction(source, name) : "";
}

function loadSourceBundle(mode = process.env.TENNISNOTE_R3_SOURCE_MODE || "actual") {
  if (mode === "actual") {
    return {
      mode,
      domainSource: readPublicSource(domainPath),
      actionSource: readPublicSource(actionPath),
      // The unchanged read dependency remains live so refresh failure is not mocked.
      commonSource: readPublicSource(commonPath),
      scheduleSource: readPublicSource(schedulePath),
    };
  }
  if (mode === "offline") {
    const sourceSha = process.env.TENNISNOTE_PUBLIC_SOURCE_SHA || "";
    const patchPath = process.env.TENNISNOTE_R3_PUBLIC_PATCH || "";
    assert.equal(sourceSha, PINNED_PUBLIC_SHA, "offline mode must use the exact pinned public base SHA");
    assert.ok(patchPath, "offline mode requires the existing in-memory patch input");
    const patchText = readFileSync(patchPath, "utf8");
    return {
      mode,
      sourceSha,
      patchText,
      domainSource: applyUnifiedPatchInMemory(readGitSource(sourceSha, domainPath), patchText, domainPath),
      actionSource: applyUnifiedPatchInMemory(readGitSource(sourceSha, actionPath), patchText, actionPath),
      commonSource: readGitSource(sourceSha, commonPath),
      scheduleSource: readGitSource(sourceSha, schedulePath),
    };
  }
  throw new Error(`unsupported source mode: ${mode}`);
}

function publicSaveHarness(domainSource, actionSource, commonSource, scenario) {
  const saveSource = extractFunction(actionSource, "saveCoachStaff");
  const scheduleSource = scenario.scheduleSource || "";
  const freshSettlementVerifier = extractOptionalFunction(domainSource, "coachStaffFreshSettlementTermMatches");
  const scheduleSignature = extractOptionalFunction(scheduleSource, "liveSchedulePolicySignature");
  const scheduleSync = extractOptionalFunction(scheduleSource, "syncLiveSchedulePolicyToServer");
  if (/\bcoachStaffFreshSettlementTermMatches\s*\(/.test(saveSource) && !freshSettlementVerifier) {
    throw new Error("saveCoachStaff requires its source-version settlement verifier");
  }
  if (/\bsyncLiveSchedulePolicyToServer\s*\(/.test(saveSource) && !scheduleSync) {
    throw new Error("saveCoachStaff requires its source-version schedule sync");
  }
  if (/\bliveSchedulePolicySignature\s*\(/.test(scheduleSync) && !scheduleSignature) {
    throw new Error("schedule sync requires its source-version signature helper");
  }
  const functionSource = [
    extractFunction(domainSource, "coachStaffPayload"),
    extractFunction(domainSource, "coachBlockSignature"),
    extractFunction(domainSource, "normalizeCoachWorkBlocks"),
    extractFunction(domainSource, "normalizeCoachBreakBlocks"),
    extractFunction(domainSource, "coachSettlementRule"),
    extractFunction(domainSource, "coachStaffServerMatches"),
    freshSettlementVerifier,
    extractFunction(commonSource, "refreshCoachStaffData"),
    saveSource,
    scheduleSignature,
    scheduleSync,
    extractFunction(readPublicSource("app/admin/domain/common.js"), "postgresDayOfWeek"),
    extractFunction(readPublicSource("app/admin/domain/values.js"), "timeToMinutes"),
  ].join("\n\n");
  const branchId = "synthetic-public-branch";
  const roleId = "synthetic-public-role";
  const effectiveFrom = "2099-10-01";
  const row = {
    coach_role_id: roleId,
    settlement_type: "ratio",
    coach_rate: 0.5,
    hourly_rate: null,
    settlement_basis: "cash_ex_vat",
    settlement_calculation_mode: "session_progress",
    substitute_policy: "manual",
    effective_from: effectiveFrom,
    effective_to: null,
    status: "scheduled",
  };
  const role = {
    id: roleId,
    user_id: "synthetic-public-user",
    branch_id: branchId,
    display_name: "Synthetic QA Coach",
    status: "approved",
    job_title: "레슨",
    employment_status: "active",
  };
  const displayedRule = {
    serverRoleId: roleId,
    coach: "Synthetic QA Coach",
    method: "ratio",
    ratio: 0.5,
    hourly: 0,
    cardBase: "cash",
    calculationMode: "session_progress",
    substitute: "manual",
    effectiveFrom,
  };
  const counters = { rpc: 0, termReads: 0, close: 0, toast: 0, renderError: 0 };
  counters.scheduleReads = 0;
  counters.scheduleInserts = 0;
  counters.scheduleUpdates = 0;
  counters.scheduleRefresh = 0;
  counters.scheduleUpdateFilters = [];
  const defaultWorkBlocks = [];
  const schedulePolicyState = {
    value: {
      version: 5,
      updatedAt: "before-save",
      operationProfiles: [{ id: "profile-1", updatedAt: "before-save", coaches: [{ serverRoleId: roleId, workBlocks: defaultWorkBlocks }] }],
      coaches: [{ serverRoleId: roleId, workBlocks: defaultWorkBlocks }],
    },
  };
  const button = { disabled: false, textContent: "저장" };
  const context = {
    console,
    window: {},
    state: { view: "coaches" },
    scheduleDays: ["월", "화", "수", "목", "금", "토", "일"],
    adminLiveDataState: { coachSettlementTerms: [row] },
      coaches: [{
        id: "synthetic-local-coach", serverRoleId: roleId, branchId, name: "Synthetic QA Coach",
        approvalStatus: "approved", employmentStatus: "active", workBlocks: defaultWorkBlocks, breakBlocks: [],
      }],
    coachSettlementRules: [displayedRule],
    coachStaffEditorState: {
      mode: "edit", saving: false, message: "", settlementDetailsOpen: false,
      draft: {
        coachId: "synthetic-local-coach",
        coachRoleId: roleId,
        availabilityRevision: 0,
        branchId,
        name: "Synthetic QA Coach",
        phone: "",
        jobTitle: "레슨",
        bio: "",
        color: "#157a5b",
        approvalStatus: "approved",
        employmentStatus: "active",
        employmentStartedOn: effectiveFrom,
        employmentEndedOn: "",
        workBlocks: scenario.draftWorkBlocks ?? [],
        breakBlocks: [],
        settlement: {
          method: "ratio", ratio: 50, hourly: 0, basis: "cash_ex_vat",
          calculationMode: "session_progress", substitute: "manual", effectiveFrom,
        },
      },
    },
    adminApprovalReady: () => true,
    operationsAccessReady: () => scenario.refreshReady !== false,
    activeOperationBranchId: () => branchId,
    readCoachStaffPanel: () => {},
    renderCoachStaffModal: () => { counters.renderError += 1; },
    renderCoaches: () => {},
    renderSchedule: () => {},
    scheduleAdminOperationalCacheWrite: () => {},
    applyServerCoachSnapshot: ({ serverCoachRoles }) => {
      context.coaches.splice(0, context.coaches.length, ...serverCoachRoles.map((item) => ({
        id: "synthetic-local-coach",
        serverRoleId: item.id,
        branchId: item.branch_id,
        name: item.display_name,
        phone: "",
        role: item.job_title,
        bio: "",
        approvalStatus: item.status,
        employmentStatus: item.employment_status,
        workBlocks: scenario.savedWorkBlocks ?? defaultWorkBlocks,
        breakBlocks: [],
      })));
      const nextBlocks = scenario.savedWorkBlocks ?? defaultWorkBlocks;
      schedulePolicyState.value = {
        ...schedulePolicyState.value,
        updatedAt: "after-save-volatile",
        operationProfiles: [{
          id: "profile-1", updatedAt: "after-save-volatile",
          coaches: [{ serverRoleId: roleId, workBlocks: nextBlocks }],
        }],
        coaches: [{ serverRoleId: roleId, workBlocks: nextBlocks }],
      };
    },
    normalizedMemberPhone: (value) => String(value || "").replace(/\D/g, ""),
    normalizeCoachWorkBlocks: (coach) => Array.isArray(coach?.workBlocks) ? coach.workBlocks : [],
    normalizeCoachBreakBlocks: (coach) => Array.isArray(coach?.breakBlocks) ? coach.breakBlocks : [],
    closeCoachStaffModal: () => { counters.close += 1; },
    updateActiveOperationProfileFromCurrent: () => {},
    loadLiveSchedulePolicyFromServer: async () => {},
    showToast: () => { counters.toast += 1; },
    $: () => button,
  };
  context.coachSettlementRule = undefined;
  context.coachBlockSignature = undefined;
  context.window.TennisNoteInputGuard = { markSaved: () => {} };
  context.window.TennisNoteDataClient = {
    readiness: () => ({ ready: true }),
    getSession: () => ({ access_token: "synthetic-session" }),
    rpc: async (name) => {
      assert.equal(name, "tn_admin_save_coach_staff_v2");
      counters.rpc += 1;
      return { coachRoleId: roleId };
    },
    selectRows: async (table) => {
      if (table === "tn_admin_settings") {
        counters.scheduleReads += 1;
        return scenario.scheduleExistingRow ? [{ updated_at: scenario.scheduleExistingRowUpdatedAt || "server-newer" }] : [];
      }
      if (table === "tn_coach_roles") return [role];
      if (table === "tn_coach_settlement_terms") {
        counters.termReads += 1;
        if (scenario.rejectTerms) throw new Error("synthetic terms read failure");
        return scenario.terms ?? [row];
      }
      return [];
    },
    insertRows: async (table, payload) => {
      assert.equal(table, "tn_admin_settings");
      counters.scheduleInserts += 1;
      counters.scheduleInsertPayload = payload;
      return [{ updated_at: "schedule-inserted" }];
    },
    updateRows: async (table, filters, payload) => {
      assert.equal(table, "tn_admin_settings");
      counters.scheduleUpdates += 1;
      counters.scheduleUpdateFilters.push(filters);
      counters.scheduleUpdatePayload = payload;
      return scenario.scheduleConflict ? [] : [{ updated_at: payload.updated_at }];
    },
  };
  context.liveSchedulePolicyPayload = () => {
    return { ...schedulePolicyState.value, updatedAt: schedulePolicyState.value.updatedAt };
  };
  context.liveSchedulePolicyServerUpdatedAt = scenario.scheduleUpdatedAt ?? "schedule-before-save";
  context.liveSchedulePolicyKey = "app_schedule_policy";
  context.loadLiveSchedulePolicyFromServer = async () => { counters.scheduleRefresh += 1; };
  scenario.scheduleSource = scenario.scheduleSource || readPublicSource(schedulePath);
  runInNewContext(functionSource, context);
  return { context, counters, button };
}

function baseTerm() {
  return {
    coach_role_id: "synthetic-public-role",
    settlement_type: "ratio",
    coach_rate: 0.5,
    hourly_rate: null,
    settlement_basis: "cash_ex_vat",
    settlement_calculation_mode: "session_progress",
    substitute_policy: "manual",
    effective_from: "2099-10-01",
    effective_to: null,
    status: "scheduled",
  };
}

test("source adapters resolve actual checkout and pinned offline candidate", () => {
  const saved = Object.fromEntries([
    "TENNISNOTE_R3_SOURCE_MODE",
    "TENNISNOTE_PUBLIC_SOURCE_SHA",
    "TENNISNOTE_R3_PUBLIC_PATCH",
  ].map((key) => [key, process.env[key]]));
  for (const key of Object.keys(saved)) delete process.env[key];
  let actual;
  try {
    actual = loadSourceBundle();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  for (const name of [
    "coachStaffPayload",
    "coachBlockSignature",
    "normalizeCoachWorkBlocks",
    "normalizeCoachBreakBlocks",
    "coachSettlementRule",
    "coachStaffServerMatches",
  ]) {
    assert.doesNotThrow(() => extractFunction(actual.domainSource, name), `actual domain adapter: ${name}`);
  }
  assert.doesNotThrow(() => extractFunction(actual.commonSource, "refreshCoachStaffData"), "actual refresh adapter");
  assert.doesNotThrow(() => extractFunction(actual.actionSource, "saveCoachStaff"), "actual save adapter");
  const save = extractFunction(actual.actionSource, "saveCoachStaff");
  const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
  console.log(`SOURCE_MODE=${sourceMode}`);
  console.log(`ACTUAL_CHECKOUT_SAVE_FUNCTION_SHA256=${sha256(save)}`);
  if (sourceMode === "offline") {
    const offline = loadSourceBundle("offline");
      const verifier = extractOptionalFunction(offline.domainSource, "coachStaffFreshSettlementTermMatches");
    assert.equal(offline.sourceSha, PINNED_PUBLIC_SHA);
      assert.doesNotMatch(offline.scheduleSource, /function\s+liveSchedulePolicySignature\s*\(/,
        "the pinned 1.0.548 schedule source remains unmodified and is not replaced with a copied 1.0.550 implementation");
      assert.match(actual.scheduleSource, /function\s+liveSchedulePolicySignature\s*\(/,
        "the current 1.0.550 source contains its schedule signature dependency");
      assert.doesNotThrow(() => publicSaveHarness(offline.domainSource, offline.actionSource, offline.commonSource, {
        scheduleSource: offline.scheduleSource,
      }), "the pinned offline source bundle enters the harness using only dependencies it actually contains");
    console.log(`PINNED_BASE_SHA=${offline.sourceSha}`);
    console.log(`PATCH_SHA256=${sha256(offline.patchText)}`);
      console.log(`OFFLINE_FRESH_VERIFIER_PRESENT=${Boolean(verifier)}`);
  }
});

test("hourly input accepts whole-won values and inactive settlement controls are disabled", () => {
  const domainSource = readPublicSource(domainPath);
  const formSource = readPublicSource(formPath);
  assert.match(domainSource, /id="coachStaffSettlementHourly" type="number" min="1" step="1"/,
    "hourly amount uses one-won precision without changing the positive minimum");

  const elements = Object.fromEntries(["ratio", "hourly"].map((method) => {
    const controls = [{ disabled: null, value: method === "ratio" ? "50" : "43200" }];
    const element = {
      hidden: false,
      controls,
      classList: { toggle(name, force) { if (name === "is-hidden") element.hidden = force; } },
      querySelectorAll(selector) { assert.equal(selector, "input, select, textarea"); return controls; },
    };
    return [method, element];
  }));
  const root = {
    querySelectorAll(selector) {
      const match = selector.match(/data-settlement-mode-field="(ratio|hourly)"/);
      return match ? [elements[match[1]]] : [];
    },
  };
  const invoke = (method) => runInNewContext(
    `${extractFunction(formSource, "syncCoachStaffSettlementFieldVisibility")}\nsyncCoachStaffSettlementFieldVisibility(method);`,
    { method, document: {}, $: () => root },
  );

  invoke("ratio");
  assert.equal(elements.ratio.hidden, false);
  assert.equal(elements.ratio.controls[0].disabled, false);
  assert.equal(elements.hourly.hidden, true);
  assert.equal(elements.hourly.controls[0].disabled, true);
  assert.equal(elements.hourly.controls[0].value, "43200", "disabling preserves the inactive draft value");

  invoke("hourly");
  assert.equal(elements.ratio.hidden, true);
  assert.equal(elements.ratio.controls[0].disabled, true);
  assert.equal(elements.hourly.hidden, false);
  assert.equal(elements.hourly.controls[0].disabled, false);
  assert.equal(elements.hourly.controls[0].value, "43200");
});

test("settlement modal initial render disables inactive required controls before validation", () => {
  const formSource = readPublicSource(formPath);
  const settingsSource = readPublicSource(settingsViewPath);
  const controlsByMethod = Object.fromEntries(["ratio", "hourly"].map((method) => {
    const control = {
      disabled: false,
      required: true,
      value: method === "ratio" ? "50" : "",
      get willValidate() { return !this.disabled; },
      get validity() { return { valid: this.disabled || Boolean(this.value) }; },
    };
    const field = {
      hidden: false,
      classList: { toggle(name, force) { if (name === "is-hidden") field.hidden = force; } },
      querySelectorAll(selector) {
        assert.equal(selector, "input, select, textarea");
        return [control];
      },
    };
    return [method, { field, control }];
  }));
  let rendered = false;
  const content = {
    set innerHTML(value) { rendered = value.includes("settlement"); },
    querySelectorAll(selector) {
      assert.equal(rendered, true, "visibility sync runs only after the settlement markup is rendered");
      const match = selector.match(/data-settlement-mode-field="(ratio|hourly)"/);
      return match ? [controlsByMethod[match[1]].field] : [];
    },
  };
  const elements = {
    "#coachStaffModal": { hidden: true },
    "#coachStaffModalContent": content,
    "#coachStaffModalTitle": { textContent: "" },
    "#coachStaffMoreMenu": { hidden: true },
    "#coachStaffMessage": { textContent: "" },
  };
  const context = {
    coachStaffEditorState: {
      tab: "settlement", mode: "edit", message: "",
      draft: { name: "fixture", coachRoleId: "", settlement: { method: "ratio" } },
    },
    $: (selector) => elements[selector] || null,
    $$: () => [],
    operationsRole: () => "admin",
    renderCoachStaffSettlementTab: () => "<form>settlement</form>",
  };
  const program = [
    extractFunction(formSource, "syncCoachStaffSettlementFieldVisibility"),
    extractFunction(settingsSource, "renderCoachStaffModal"),
    "renderCoachStaffModal();",
  ].join("\n");
  runInNewContext(program, context);

  assert.equal(controlsByMethod.ratio.field.hidden, false);
  assert.equal(controlsByMethod.ratio.control.disabled, false);
  assert.equal(controlsByMethod.hourly.field.hidden, true);
  assert.equal(controlsByMethod.hourly.control.disabled, true);
  assert.equal(controlsByMethod.hourly.control.willValidate, false);
  assert.equal(Object.values(controlsByMethod).filter(({ control }) => control.willValidate && !control.validity.valid).length, 0,
    "an empty hidden hourly amount does not contribute to native form validation");

  context.coachStaffEditorState.draft.settlement.method = "hourly";
  runInNewContext(program, context);
  assert.equal(controlsByMethod.ratio.field.hidden, true);
  assert.equal(controlsByMethod.ratio.control.disabled, true);
  assert.equal(controlsByMethod.hourly.field.hidden, false);
  assert.equal(controlsByMethod.hourly.control.disabled, false);
  controlsByMethod.hourly.control.value = "43200";

  context.coachStaffEditorState.tab = "basic";
  context.renderCoachStaffBasicTab = () => "<form>basic</form>";
  runInNewContext(program, context);
  context.coachStaffEditorState.tab = "settlement";
  runInNewContext(program, context);
  assert.equal(controlsByMethod.ratio.field.hidden, true, "settlement tab re-entry restores the selected hourly mode");
  assert.equal(controlsByMethod.ratio.control.disabled, true);
  assert.equal(controlsByMethod.hourly.field.hidden, false);
  assert.equal(controlsByMethod.hourly.control.disabled, false);
  assert.equal(controlsByMethod.hourly.control.value, "43200", "tab re-entry preserves the hourly draft");
});

test("actual public save -> refresh -> raw verifier blocks false-success in memory", async () => {
  const { domainSource, actionSource, commonSource, scheduleSource } = loadSourceBundle();
  const cases = [
    { name: "exact fresh row", scenario: {}, success: true },
    { name: "query rejection despite display fallback", scenario: { rejectTerms: true }, success: false },
    { name: "refresh false with stale exact row", scenario: { refreshReady: false }, success: false },
    { name: "missing raw term", scenario: { terms: [] }, success: false },
    { name: "wrong role", scenario: { terms: [{ ...baseTerm(), coach_role_id: "other-role" }] }, success: false },
    { name: "wrong effective date", scenario: { terms: [{ ...baseTerm(), effective_from: "2099-10-02" }] }, success: false },
    { name: "wrong persisted policy", scenario: { terms: [{ ...baseTerm(), settlement_basis: "actual_paid_inc_vat" }] }, success: false },
  ];
  for (const item of cases) {
    const harness = publicSaveHarness(domainSource, actionSource, commonSource, { ...item.scenario, scheduleSource });
    await harness.context.saveCoachStaff();
    assert.equal(harness.counters.rpc, 1, `${item.name}: one explicit save RPC only`);
    assert.equal(harness.counters.close, item.success ? 1 : 0, `${item.name}: modal close follows verification`);
    assert.equal(harness.counters.toast, item.success ? 1 : 0, `${item.name}: success toast follows verification`);
    if (!item.success) {
      assert.match(harness.context.coachStaffEditorState.message, /재확인에 실패/,
        `${item.name}: existing fail-closed message is shown`);
      assert.equal(harness.counters.scheduleInserts + harness.counters.scheduleUpdates, 0,
        `${item.name}: failed coach save never writes schedule policy`);
    }
  }
  console.log("PUBLIC_ACTUAL_SAVE_REFRESH_RAW_TERM_PASS=7_CASES; RPC_FAKE=1_PER_CASE; DB=0; WORKTREE_WRITE=0");
});

test("actual coach save syncs only a changed schedule policy and preserves optimistic guards", async () => {
  const { domainSource, actionSource, commonSource, scheduleSource } = loadSourceBundle();
  const same = publicSaveHarness(domainSource, actionSource, commonSource, {
    scheduleSource,
    scheduleUpdatedAt: "schedule-before-save",
  });
  await same.context.saveCoachStaff();
  assert.equal(same.counters.rpc, 1, "settlement-only save uses the existing coach RPC once");
  assert.equal(same.counters.scheduleReads, 0, "volatile timestamps do not trigger schedule policy read");
  assert.equal(same.counters.scheduleInserts, 0);
  assert.equal(same.counters.scheduleUpdates, 0, "settlement-only save does not rewrite schedule settings");

  const changed = publicSaveHarness(domainSource, actionSource, commonSource, {
    scheduleSource,
    draftWorkBlocks: [{ days: ["화"], start: "10:00", end: "11:00", label: "근무" }],
    savedWorkBlocks: [{ days: ["화"], start: "10:00", end: "11:00", label: "근무" }],
    scheduleUpdatedAt: "expected-prior-revision",
  });
  await changed.context.saveCoachStaff();
  assert.equal(changed.counters.scheduleUpdates, 1,
    `a real availability change sends one optimistic update; saveMessage=${changed.context.coachStaffEditorState.message}`);
  assert.equal(changed.counters.scheduleUpdateFilters[0].key, "app_schedule_policy");
  assert.equal(changed.counters.scheduleUpdateFilters[0].updated_at, "expected-prior-revision");
  assert.equal(changed.counters.scheduleInserts, 0);

  const missingBaseline = publicSaveHarness(domainSource, actionSource, commonSource, {
    scheduleSource,
    draftWorkBlocks: [{ days: ["목"], start: "12:00", end: "13:00", label: "근무" }],
    savedWorkBlocks: [{ days: ["목"], start: "12:00", end: "13:00", label: "근무" }],
    scheduleUpdatedAt: "",
    scheduleExistingRow: true,
  });
  await missingBaseline.context.saveCoachStaff();
  assert.equal(missingBaseline.counters.scheduleReads, 1, "missing baseline reads server revision before deciding");
  assert.equal(missingBaseline.counters.scheduleInserts, 0, "existing server row is never overwritten by insert fallback");
  assert.equal(missingBaseline.counters.scheduleUpdates, 0);
  assert.equal(missingBaseline.counters.scheduleRefresh, 1, "conflict triggers server read-back");

  const staleRevision = publicSaveHarness(domainSource, actionSource, commonSource, {
    scheduleSource,
    draftWorkBlocks: [{ days: ["수"], start: "11:00", end: "12:00", label: "근무" }],
    savedWorkBlocks: [{ days: ["수"], start: "11:00", end: "12:00", label: "근무" }],
    scheduleUpdatedAt: "stale-prior-revision",
    scheduleConflict: true,
  });
  await staleRevision.context.saveCoachStaff();
  assert.equal(staleRevision.counters.scheduleUpdates, 1, "stale revision is submitted only once");
  assert.equal(staleRevision.counters.scheduleUpdateFilters[0].key, "app_schedule_policy");
  assert.equal(staleRevision.counters.scheduleUpdateFilters[0].updated_at, "stale-prior-revision");
  assert.equal(staleRevision.counters.scheduleRefresh, 1, "optimistic conflict refreshes authoritative policy");
  assert.equal(staleRevision.counters.scheduleInserts, 0, "conflict is never retried as insert");
});
