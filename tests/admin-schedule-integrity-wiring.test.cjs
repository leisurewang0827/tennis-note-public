const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const legacy = fs.readFileSync(path.join(root, "app/admin/events/schedule.js"), "utf8");
const v2 = fs.readFileSync(path.join(root, "app/admin/schedule-v2-admin.js"), "utf8");
const extract = (text, name, next) => {
  const a = text.indexOf(name), b = text.indexOf(next, a + name.length);
  assert.ok(a >= 0 && b > a, name);
  return text.slice(a, b);
};
const implementation = extract(v2, "  function currentIntegrityContext()", "  async function repairExpectedRegularSlot(");
const registrations = [legacy, v2].flatMap((source) => source.split("\n")
  .filter((line) => /\$\("#scheduleV2Integrity(?:Apply)?Button"\).*addEventListener\("click"/.test(line)));

function harness({ approve = true, changeOnConfirm = false, revokeOnConfirm = false, rejectApply = false, rejectDryRun = false, rows, latestMissing = false, swapOnLatest = false, unreadyOnLatest = false, applyResponse, deferApply = false } = {}) {
  const click = { preview: [], apply: [] }, calls = [], counts = { confirm: 0 }, statuses = [];
  let diagnosticCount = 0, resolveApply;
  let signalApplyEntered;
  const applyEntered = new Promise((resolve) => { signalApplyEntered = resolve; });
  const dom = {
    "#scheduleV2IntegrityButton": { disabled: false, addEventListener(_e, fn) { click.preview.push(fn); } },
    "#scheduleV2IntegrityApplyButton": { disabled: true, addEventListener(_e, fn) { click.apply.push(fn); } },
    "#scheduleV2IntegritySummary": {}, "#scheduleV2IntegrityList": {},
  };
  const ctx = { auth: true, actor: "actor-a", branch: "branch-a", ready: true };
  const items = [
    { ticketId:"valid",userId:"member-a",branchId:"branch-a",futureLessonCount:0,issueCodes:["active_regular_ticket_without_future_lessons"] },
    { ticketId:"other",userId:"member-b",branchId:"branch-b",futureLessonCount:0,issueCodes:["active_regular_ticket_without_future_lessons"] },
    { ticketId:"already",userId:"member-c",branchId:"branch-a",futureLessonCount:1,issueCodes:["future_lesson_participant_ticket_mismatch"] },
    { ticketId:"blocked",userId:"member-d",branchId:"branch-a",futureLessonCount:0,issueCodes:["active_regular_ticket_without_future_lessons"] },
  ];
  const results = rows || [
    {ticketId:"valid",eligible:true,createdCount:2,remainingUnassignedUnits:0,conflictCount:0},
    {ticketId:"blocked",eligible:false,createdCount:1,remainingUnassignedUnits:0,conflictCount:0},
    {ticketId:"other",eligible:true,createdCount:1,remainingUnassignedUnits:0,conflictCount:0},
    {ticketId:"already",eligible:true,createdCount:1,remainingUnassignedUnits:0,conflictCount:0},
  ];
  const api = {
    integrityContext: () => ({authorized:ctx.auth,actorId:ctx.actor,branchId:ctx.branch}),
    rpc: async (name, payload, options) => {
      calls.push({name,payload,options});
      if (name === "tn_admin_schedule_v2_member_integrity_preview") {
        diagnosticCount++;
        if (diagnosticCount === 2 && swapOnLatest) ctx.actor = "actor-b";
        if (diagnosticCount === 2 && unreadyOnLatest) ctx.ready = false;
        return {items: diagnosticCount === 2 && latestMissing ? items.filter((x) => x.ticketId !== "valid") : items};
      }
      if (payload.target_dry_run) { if (rejectDryRun) throw new Error("synthetic dry-run failure"); return {results}; }
      signalApplyEntered();
      if (rejectApply) throw new Error("synthetic response loss");
      const complete = {ok:true,dryRun:false,branchId:"branch-a",candidateCount:1,eligibleCount:1,blockedCount:0,
        createdCount:2,createdUnits:2,remainingUnassignedUnits:0,
        results:[{ok:true,ticketId:"valid",eligible:true,createdCount:2,createdUnits:2,remainingUnassignedUnits:0,conflictCount:0}]};
      if (deferApply) return new Promise((resolve) => { resolveApply = () => resolve(applyResponse === undefined ? complete : applyResponse); });
      return applyResponse === undefined ? complete : applyResponse;
    },
    refresh: async () => {},
  };
  const sandbox = {
    $: (selector) => dom[selector],
    state: {integrityRepairGroups:new Map(),integrityContext:null},
    bridge: () => api,
    groupedScheduleIntegrityItems: (v) => v,
    scheduleIntegrityIssueLabel: String,
    scheduleIntegrityRepairLabel: () => "확인",
    scheduleIntegrityMemberLabel: () => "합성",
    escapeHtml: String,
    operationKey: () => "synthetic-key",
    requireWritableServer: () => ctx.ready,
    setStatus: (message, tone) => statuses.push({message,tone}),
    errorMessage: () => "오류",
    refreshWorkspaceAfterWrite: async () => false,
    window: { confirm: () => { counts.confirm++; if (changeOnConfirm) ctx.branch = "branch-b"; if (revokeOnConfirm) ctx.auth = false; return approve; } },
    console,
    previewScheduleV2Integrity: () => { throw Error("legacy preview must not run"); },
    applyScheduleV2IntegrityPreview: () => { throw Error("legacy apply must not run"); },
  };
  vm.runInNewContext(implementation + "\n" + registrations.join("\n"), sandbox);
  return {click,calls,counts,ctx,dom,sandbox,statuses,applyEntered,resolveApply:()=>resolveApply()};
}

test("both actual registration sources attach exactly one path and apply exact eligible IDs once", async () => {
  const h = harness();
  assert.equal(h.click.preview.length,1); assert.equal(h.click.apply.length,1);
  await h.click.preview[0]();
  assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].textContent,"확정 가능한 1권 일정 생성");
  await h.click.apply[0]();
  const checks=h.calls.filter(x=>x.name==="tn_admin_schedule_v2_member_integrity_preview");
  const previews=h.calls.filter(x=>x.payload.target_dry_run===true);
  const applies=h.calls.filter(x=>x.payload.target_dry_run===false);
  assert.equal(checks.length,2); assert.equal(previews.length,1); assert.equal(h.counts.confirm,1); assert.equal(applies.length,1);
  assert.deepEqual(Array.from(applies[0].payload.target_ticket_ids),["valid"]);
  assert.equal(applies[0].payload.target_branch_id,"branch-a");
  await h.click.apply[0](); assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,1);
});

test("cancel, stale branch, changed role and blocked rows never apply", async () => {
  for (const opts of [{approve:false},{changeOnConfirm:true},{rows:[{ticketId:"valid",eligible:true,createdCount:2,remainingUnassignedUnits:1,conflictCount:0}]}]) {
    const h=harness(opts); await h.click.preview[0](); await h.click.apply[0]();
    assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
  }
  const h=harness(); await h.click.preview[0](); h.ctx.auth=false; await h.click.apply[0]();
  assert.equal(h.counts.confirm,0); assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
});

test("conflicts, absent eligibility, zero created and permission changes during confirmation fail closed", async () => {
  const cases = [
    {rows:[{ticketId:"valid",eligible:true,createdCount:1,remainingUnassignedUnits:0,conflictCount:1}]},
    {rows:[{ticketId:"valid",createdCount:1,remainingUnassignedUnits:0,conflictCount:0}]},
    {rows:[{ticketId:"valid",eligible:true,createdCount:0,remainingUnassignedUnits:0,conflictCount:0}]},
    {rows:[{ticketId:"valid",eligible:true,createdCount:1,conflictCount:0}]},
    {revokeOnConfirm:true},
  ];
  for (const opts of cases) {
    const h=harness(opts); await h.click.preview[0](); await h.click.apply[0]();
    assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
  }
});

test("branch changed before confirmation clears stale target and never confirms", async () => {
  const h=harness(); await h.click.preview[0](); h.ctx.branch="branch-b"; await h.click.apply[0]();
  assert.equal(h.counts.confirm,0);
  assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
  assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  assert.equal(h.sandbox.state.integrityRepairGroups.size,0);
});

test("uncertain response disables duplicate apply until a new preview", async () => {
  const h=harness({rejectApply:true}); await h.click.preview[0](); await h.click.apply[0](); await h.click.apply[0]();
  assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,1);
  assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  assert.equal(h.sandbox.state.integrityRepairGroups.size,0);
});

test("fresh diagnostic loss or actor swap before apply prevents transport", async () => {
  for (const opts of [{latestMissing:true},{swapOnLatest:true}]) {
    const h=harness(opts); await h.click.preview[0](); await h.click.apply[0]();
    assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
    assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  }
});

test("partial or absent results cannot be reported as complete", async () => {
  for (const response of [null,{ok:true,dryRun:false,branchId:"branch-a",candidateCount:1,eligibleCount:1,blockedCount:0,
    createdCount:2,createdUnits:2,remainingUnassignedUnits:0,results:[]},
    {ok:true,dryRun:false,branchId:"branch-a",candidateCount:1,eligibleCount:1,blockedCount:0,
      createdCount:3,createdUnits:2,remainingUnassignedUnits:0,
      results:[{ok:true,ticketId:"valid",eligible:true,createdCount:2,createdUnits:2,remainingUnassignedUnits:0,conflictCount:0}]}]) {
    const h=harness({applyResponse:response}); await h.click.preview[0](); await h.click.apply[0]();
    assert.equal(h.statuses.some(x=>x.tone==="success"),false);
    assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  }
});

test("apply locks preview and suppresses stale success after actor switch", async () => {
  const h=harness({deferApply:true}); await h.click.preview[0]();
  const pending=h.click.apply[0](); await h.applyEntered;
  const before=h.calls.length; await h.click.preview[0](); assert.equal(h.calls.length,before);
  const applied=h.calls.find(x=>x.payload.target_dry_run===false);
  assert.equal(applied.options.requireCurrentSession,true); assert.equal(applied.options.retryAuth,false);
  h.ctx.actor="actor-b"; h.resolveApply(); await pending;
  assert.equal(h.statuses.some(x=>x.tone==="success"),false);
});

test("official token-only session helper resolves subject without exposing token", () => {
  const shared=fs.readFileSync(path.join(root,"app/shared/tennisnote-data-client.js"),"utf8");
  const app=fs.readFileSync(path.join(root,"app/admin/app.js"),"utf8");
  const helper=extract(shared,"  function sessionSubject(","  function isOnline()");
  const bridge=extract(app,"  integrityContext: () => {","  saveOneDayBooking:");
  const token="x."+Buffer.from(JSON.stringify({sub:"synthetic-actor"})).toString("base64url")+".x";
  const client={getSession:()=>({access_token:token})};
  const ctx={window:{atob:(s)=>Buffer.from(s,"base64").toString("utf8"),TennisNoteDataClient:client},
    operationsRole:()=>"admin",operationsAccessReady:()=>true,activeOperationBranchId:()=>"branch-a"};
  client.sessionSubject=vm.runInNewContext(helper+";sessionSubject",ctx);
  const value=vm.runInNewContext("({"+bridge+"})",ctx).integrityContext();
  assert.equal(value.authorized,true);assert.equal(value.actorId,"synthetic-actor");assert.equal(value.branchId,"branch-a");
  assert.doesNotMatch(JSON.stringify(value),/access_token/);
});

test("dry-run failure remains distinct from an empty eligible set", async () => {
  const h=harness({rejectDryRun:true}); await h.click.preview[0]();
  assert.equal(h.dom["#scheduleV2IntegritySummary"].textContent,"점검 실패");
  assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
});

test("result validation rejects wrong ticket, duplicate rows and skipped eligibility", () => {
  const h=harness(); const check=h.sandbox.integrityApplyResultComplete;
  const row={ok:true,ticketId:"valid",eligible:true,createdCount:1,createdUnits:1,remainingUnassignedUnits:0,conflictCount:0};
  const result={ok:true,dryRun:false,branchId:"branch-a",candidateCount:1,eligibleCount:1,blockedCount:0,createdCount:1,createdUnits:1,remainingUnassignedUnits:0,results:[row]};
  assert.equal(check(result,{branchId:"branch-a"},new Set(["valid"])),true);
  assert.equal(check({...result,results:[{...row,ticketId:"other"}]},{branchId:"branch-a"},new Set(["valid"])),false);
  assert.equal(check({...result,candidateCount:2,eligibleCount:2,createdCount:2,createdUnits:2,results:[row,row]},{branchId:"branch-a"},new Set(["valid","other"])),false);
  assert.equal(check({...result,results:[{...row,eligible:false}]},{branchId:"branch-a"},new Set(["valid"])),false);
});

test("readiness lost during fresh diagnosis clears pending target before apply", async () => {
  const h=harness({unreadyOnLatest:true}); await h.click.preview[0](); await h.click.apply[0]();
  assert.equal(h.ctx.actor,"actor-a"); assert.equal(h.ctx.branch,"branch-a");
  assert.equal(h.calls.filter(x=>x.payload.target_dry_run===false).length,0);
  assert.equal(h.sandbox.state.integrityRepairGroups.size,0);
  assert.equal(h.dom["#scheduleV2IntegrityApplyButton"].disabled,true);
  assert.match(h.statuses.at(-1).message,/다시 점검/);
});
