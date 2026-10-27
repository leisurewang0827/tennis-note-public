// 운영 BASIC 위에 선별한 R3 조합만 검사합니다. 실제 네트워크·자격정보는 사용하지 않습니다.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const selectedLayers = require("./helpers/r3-production-selected.cjs");
// Historical assertions use the exact inverse; the new guard separately seals actual bytes.
const raw = p => require("./helpers/r3-self-coach.cjs").restore(p, fs.readFileSync(p, "utf8"));
const read = p => selectedLayers.restoreRelease(p, raw(p));
const pin = JSON.parse(read("tests/fixtures/r3-production-selected-source.json"));
const git = (...args) => execFileSync("git", args, {encoding:"utf8", maxBuffer:8*1024*1024, stdio:["ignore","pipe","pipe"]}).replace(/\r\n/g,"\n");
const source = (sha,p) => git("show", `${sha}:${p}`);
const hash = s => createHash("sha256").update(s).digest("hex");
function observedProductPaths(run=git) {
  const tracked=run("diff","--name-only",pin.base,"--","app").trim().split("\n").filter(Boolean);
  const untracked=run("ls-files","--others","--exclude-standard","--","app").trim().split("\n").filter(Boolean);
  return selectedLayers.restoreProductPaths([...tracked,...untracked].sort());
}
function assertProductPaths(paths) {
  assert.equal(paths.length,new Set(paths).size);assert.deepEqual(paths,pin.files.map(x=>x.path).sort());
}
function functions(text) {
  return new Map([...text.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\([^\n]*\)\s*\{[\s\S]*?^\}/gm)].map(m=>[m[1],m[0]]));
}
const scope = {branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const totals = {paymentCount:0,ticketCount:2,lessonCount:1,sessionCount:2,settledSessions:1,settledMinutes:20,totalSettlementAmount:14400};
const snapshot = {snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_effective_settlement_v2",scope:{...scope},sourceFingerprint:"a".repeat(64),totals:{...totals}};
const copy = x => JSON.parse(JSON.stringify(x));
function element(value="") {
  return {value,disabled:false,hidden:false,textContent:"",isConnected:true,children:[],listeners:{},
    append(...xs){this.children.push(...xs);},replaceChildren(...xs){this.children=xs;},
    setAttribute(){},focus(){},querySelectorAll(){return [];},
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},
    set innerHTML(_){throw Error("unsafe HTML sink");}};
}
function admin() {
  const nodes=new Map(["adminR3PayoutDate","adminR3PayoutMethod","adminR3PayoutReverseReason","adminR3SettlementPreview","adminR3SettlementConfirm","adminR3SettlementWriterMessage","adminR3SettlementPreviewDetails","adminR3PayoutDetails","adminR3PayoutMessage","adminR3PayoutReadback","adminR3PayoutRecord","adminR3PayoutReverse"].map(id=>["#"+id,element()]));
  nodes.get("#adminR3PayoutDate").value="2099-01-02";nodes.get("#adminR3PayoutMethod").value="other_manual";nodes.get("#adminR3PayoutReverseReason").value="other_recording_error";
  const calls=[];let key=0;
  const c=vm.createContext({window:{crypto:webcrypto,TextEncoder},TextEncoder,Uint8Array,Date,Intl,console,
    document:{createElement:()=>element()},money:new Intl.NumberFormat("ko-KR"),
    adminImportAuthState:{profile:{id:"synthetic-profile"},user:{id:"synthetic-auth"}},adminDemoMode:false,
    token:"synthetic-session-marker",actorRole:"admin",approved:true,access:true,pinMissing:false,locked:false,scope:copy(scope),roles:[{serverRoleId:scope.coachRoleId}],
    $:id=>nodes.get(id)||null,$$:()=>[],operationsRole:()=>c.actorRole,adminApprovalReady:()=>c.approved,
    operationsAccessReady:()=>c.access,adminPinNeedsSetup:()=>c.pinMissing,isAdminViewLocked:()=>c.locked,isAdminUnlocked:()=>!c.locked,
    activeOperationBranchId:()=>c.scope.branchId,adminSettlementHistoryScope:()=>c.scope,
    adminSettlementHistoryScopeKey:(s=c.scope)=>[s.branchId,s.coachRoleId,s.settlementMonth].join(":"),adminSettlementHistoryCoaches:()=>c.roles,
    createAdminOperationKey:p=>p+":synthetic:"+(++key),renderAdminSettlementHistory(){},adminLocalDateKey:()=>"2099-01-02",
    fetch(){throw Error("external request forbidden");}});
  c.confirmed=false;c.ack=true;c.recording=true;c.events=[];c.active=null;
  c.scopeValue=()=>({state:c.confirmed?"CONFIRMED":"EMPTY",scope:copy(c.scope),snapshot:c.confirmed?copy(snapshot):null,confirmation:c.confirmed?{status:"confirmed"}:null,reconciliation:c.ack?{status:"acknowledged"}:null});
  c.payoutValue=()=>({scope:copy(c.scope),snapshot:copy(snapshot),payout:{recordingEnabled:c.recording,activeRecord:c.active,events:c.events}});
  c.window.TennisNoteDataClient={getSession:()=>c.token?{access_token:c.token}:null,rpc:async(name,args)=>{
    calls.push({name,args:copy(args)});if(c.before)await c.before(name,args);
    if(name==="tn_admin_preview_monthly_settlement_snapshot")return {...copy(snapshot),totals:c.empty?{...totals,paymentCount:0,ticketCount:0,lessonCount:0,sessionCount:0}:copy(totals)};
    if(name==="tn_admin_monthly_settlement_scope_state")return c.scopeValue();
    if(name==="tn_admin_create_monthly_settlement_snapshot")return copy(snapshot);
    if(name==="tn_admin_confirm_monthly_settlement_snapshot"){c.confirmed=true;if(c.confirmLoss)throw Error("synthetic response loss");return c.scopeValue();}
    if(name==="tn_monthly_settlement_payout_state"){if(c.readLoss)throw Error("synthetic read loss");return copy(c.payoutValue());}
    if(name==="tn_admin_record_monthly_settlement_payout"){
      const event={eventId:"synthetic-record",eventType:"payout_recorded",snapshotId:snapshot.snapshotId,snapshotRevision:1,sourceFingerprint:snapshot.sourceFingerprint,amount:14400,paidOn:args.target_paid_on,paymentMethod:args.target_payment_method,operationKeyHash:hash(args.target_operation_key),reversed:false};
      c.events.push(event);c.active=event;if(c.recordLoss)throw Error("synthetic response loss");return {payoutEventId:event.eventId};
    }
    if(name==="tn_admin_reverse_monthly_settlement_payout"){
      c.events[0].reversed=true;const event={...c.events[0],eventId:"synthetic-reversal",eventType:"payout_record_reversed",reversalOfEventId:args.target_payout_event_id,reason:args.target_reason,operationKeyHash:hash(args.target_operation_key)};c.events.push(event);c.active=null;return {payoutEventId:event.eventId};
    }
    throw Error("unexpected RPC "+name);
  }};
  vm.runInContext(read("app/admin/data/billing.js"),c);vm.runInContext(read("app/admin/actions/billing.js"),c);
  const value=expr=>vm.runInContext(expr,c);
  const prime=()=>{c.confirmed=true;c.initial=c.scopeValue();c.payout=c.payoutValue();value('Object.assign(adminMonthlySettlementWrite,{status:"CONFIRMED",scopeState:initial,payoutState:payout,payoutReadValid:true})');};
  return {c,calls,nodes,value,prime,count:name=>calls.filter(x=>x.name===name).length};
}
function coachPayload(status="PENDING",reason="") {
  return {scope:copy(scope),state:status,snapshot:copy(snapshot),confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},
    reconciliation:status==="PENDING"?null:{reconciliationId:"synthetic-response",status:status.toLowerCase(),reason,responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}};
}
function coach() {
  const calls=[];const c=vm.createContext({window:{},crypto:webcrypto,Date,Intl,token:"synthetic-session-marker",formatCoachWon:String,
    state:{dataMode:"live",liveProfileId:"synthetic-profile",coach:{role:"coach",authUserId:"synthetic-auth",branchId:scope.branchId,coachRoleId:scope.coachRoleId}},
    $:()=>element("2099-01"),renderCoachSettlementHistory(){},saveSnapshot(){},fetch(){throw Error("external request forbidden");}});
  c.saved=coachPayload();c.window.TennisNoteDataClient={getSession:()=>c.token?{access_token:c.token}:null,rpc:async(name,args)=>{
    calls.push({name,args:copy(args)});if(c.before)await c.before(name,args);
    if(name==="tn_coach_respond_monthly_settlement_confirmation"){c.saved=coachPayload(args.target_status.toUpperCase(),args.target_reason||"");if(c.loss)throw Error("synthetic response loss");return copy(c.saved);}
    if(name==="tn_coach_monthly_settlement_reconciliation_state")return copy(c.saved);
    if(name==="tn_monthly_settlement_payout_state")return {...copy(c.saved),payout:{state:"NOT_RECORDED",recordingEnabled:false,activeRecord:null,events:[]}};
    throw Error("unexpected RPC "+name);
  }};
  vm.runInContext(read("app/tennis-note-coach-app/domain/settlement.js"),c);
  c.coachSettlementMonth=()=>"2099-01";
  const data=read("app/tennis-note-coach-app/data/sync.js");vm.runInContext(data.slice(data.indexOf("const coachSettlementHistory =")),c);
  c.initial=coachPayload();vm.runInContext('Object.assign(coachSettlementHistory,{coachSettlementReconciliation:initial,coachSettlementReconciliationUiState:"PENDING",coachSettlementReconciliationChoice:"acknowledged"})',c);
  return {c,calls,value:expr=>vm.runInContext(expr,c)};
}

test("selected11 exact hashes, base tree and excluded surfaces remain BASIC; uncommitted SHA is not invented",()=>{
  assert.equal(pin.status,"LOCAL_UNCOMMITTED_PRODUCT_ONLY");assert.equal(git("rev-parse",`${pin.base}^{tree}`).trim(),pin.baseTree);
  const paths=observedProductPaths();assertProductPaths(paths);assert.equal(paths.length,11);
  for(const row of pin.files){assert.equal(hash(read(row.path)),row.candidateSha256);assert.equal(hash(source(pin.base,row.path)),row.baseSha256);assert.notEqual(hash(read(row.path)+" "),row.candidateSha256);}
  assert.equal(hash(pin.files.map(x=>x.path+"\0"+x.candidateSha256+"\n").join("")),pin.productAggregateSha256);
});
test("new adapters match tested DEV functions; every other existing BASIC function is preserved",()=>{
  const changed={"app/admin/data/billing.js":["resetAdminSettlementHistory","refreshAdminSettlementHistory"],"app/admin/views/billing.js":["renderAdminSettlementHistory"],"app/tennis-note-coach-app/data/sync.js":["resetCoachSettlementHistory","syncCoachSettlementHistoryFromServer"],"app/tennis-note-coach-app/domain/settlement.js":["coachSettlementReconciliationDefaultMessage"],"app/tennis-note-coach-app/views/settlement.js":["renderCoachSettlementHistory"],"app/admin/events/billing.js":["bindBillingEvents"],"app/tennis-note-coach-app/events/account.js":["bindAccountEvents"]};
  for(const row of pin.files.filter(x=>x.path.endsWith(".js"))){const old=functions(source(pin.base,row.path)),now=functions(read(row.path)),dev=functions(source(pin.testedDev,row.path));
    for(const [name,body] of old){assert(now.has(name),name);if(!(changed[row.path]||[]).includes(name))assert.equal(now.get(name),body,"BASIC "+name);}
    for(const [name,body] of now)if(!old.has(name))assert.equal(body,dev.get(name),"DEV "+name);
  }
  const manual=JSON.parse(source(pin.testedDev,"tests/fixtures/r3-manual-payout-port-source-authority.json"));
  const response=JSON.parse(source(pin.testedDev,"tests/fixtures/r3-retained-response-source-authority.json"));
  assert.equal(manual.privateFiles.mergedMain["90-Dashboard/tennis-note-prototype/app.js"].gitBlob,pin.privateAdminBlob);assert.equal(response.privateCoachAppBlob,pin.privateCoachBlob);
  assert.equal(read("app/tennis-note-coach-app/ui/screens.js"),source(pin.base,"app/tennis-note-coach-app/ui/screens.js"));
});
test("HTML/module wiring has all controls once, response inside existing sheet, and unchanged asset entry order",()=>{
  for(const surface of ["admin","tennis-note-coach-app"]){const p=`app/${surface}/index.html`,text=read(p),before=source(pin.base,p);const scripts=t=>[...t.matchAll(/<script[^>]*src="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(scripts(text),scripts(before));
    const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
  }
  const html=read("app/tennis-note-coach-app/index.html");assert(html.indexOf('id="coachSettlementReconciliationForm"')>html.indexOf('id="coachSettlementModal"'));
  for(const id of ["adminR3SettlementPreview","adminR3SettlementConfirm","adminR3PayoutRecord","adminR3PayoutReverse"])assert(read("app/admin/events/billing.js").includes(`$("#${id}")?.addEventListener`));
  assert(read("app/tennis-note-coach-app/events/account.js").includes('$("#coachSettlementReconciliationForm")?.addEventListener("submit"'));
});
test("admin assembled preview -> create/confirm/readback keeps exact scope and one physical group amount",async()=>{
  const h=admin();assert.equal(await h.c.previewAdminMonthlySettlement(),true);assert.equal(h.value("adminMonthlySettlementWrite.status"),"READY");assert.equal(await h.c.confirmAdminMonthlySettlementSnapshot(),true);
  assert.equal(h.count("tn_admin_create_monthly_settlement_snapshot"),1);assert.equal(h.count("tn_admin_confirm_monthly_settlement_snapshot"),1);assert.equal(h.value("adminMonthlySettlementWrite.scopeState.snapshot.totals.totalSettlementAmount"),14400);
  for(const call of h.calls)assert.equal(call.args.target_coach_role_id,scope.coachRoleId);
});
test("admin missing session, PIN, role, exact coach or month fails before RPC",async()=>{
  for(const mutate of [h=>h.c.token="",h=>h.c.actorRole="coach",h=>h.c.pinMissing=true,h=>h.c.roles.push({...h.c.roles[0]}),h=>h.c.scope.settlementMonth="invalid"]){const h=admin();mutate(h);assert.equal(await h.c.previewAdminMonthlySettlement(),false);assert.equal(h.calls.length,0);}
});
test("admin preview read failure stays ERROR, no zero-success or write fallback",async()=>{
  const h=admin();h.c.before=()=>{throw Error("monthly_settlement_snapshot_writes_disabled");};assert.equal(await h.c.previewAdminMonthlySettlement(),false);assert.equal(h.value("adminMonthlySettlementWrite.status"),"ERROR");assert.equal(await h.c.confirmAdminMonthlySettlementSnapshot(),false);assert.equal(h.count("tn_admin_create_monthly_settlement_snapshot"),0);
});
test("admin concurrent confirms send one create and one confirm; response loss recovers by read only",async()=>{
  const h=admin();await h.c.previewAdminMonthlySettlement();h.c.confirmLoss=true;const results=await Promise.all([h.c.confirmAdminMonthlySettlementSnapshot(),h.c.confirmAdminMonthlySettlementSnapshot()]);assert(results.includes(true));assert.equal(h.count("tn_admin_create_monthly_settlement_snapshot"),1);assert.equal(h.count("tn_admin_confirm_monthly_settlement_snapshot"),1);assert.equal(h.value("adminMonthlySettlementWrite.status"),"CONFIRMED");
});
test("admin delayed response after session loss cannot become READY or write",async()=>{
  const h=admin();h.c.before=name=>{if(name==="tn_admin_preview_monthly_settlement_snapshot")h.c.token="";};assert.equal(await h.c.previewAdminMonthlySettlement(),false);assert.notEqual(h.value("adminMonthlySettlementWrite.status"),"READY");assert.equal(h.count("tn_admin_create_monthly_settlement_snapshot"),0);
});
test("manual gate OFF and missing coach acknowledgment are write-zero",async()=>{
  for(const mode of ["off","ack"]){const h=admin();if(mode==="off")h.c.recording=false;else h.c.ack=false;h.prime();assert.equal(await h.c.recordAdminMonthlySettlementPayout(),false);assert.equal(h.calls.length,0);}
});
test("manual record and reversal keep exact source/readback; never call a financial provider",async()=>{
  const h=admin();h.prime();assert.equal(await h.c.recordAdminMonthlySettlementPayout(),true);assert.equal(h.c.events.length,1);assert.equal(await h.c.reverseAdminMonthlySettlementPayout(),true);assert.equal(h.c.events.length,2);assert.equal(h.c.active,null);assert(h.c.events[0].reversed);assert.equal(h.c.events[1].reversalOfEventId,h.c.events[0].eventId);
  assert(h.calls.every(x=>["tn_admin_record_monthly_settlement_payout","tn_admin_reverse_monthly_settlement_payout","tn_monthly_settlement_payout_state"].includes(x.name)));
});
test("manual response loss uses readback once, uncertain outcome blocks another write",async()=>{
  const h=admin();h.prime();h.c.recordLoss=true;assert.equal(await h.c.recordAdminMonthlySettlementPayout(),true);assert.equal(h.count("tn_admin_record_monthly_settlement_payout"),1);
  const u=admin();u.prime();u.c.recordLoss=true;u.c.readLoss=true;assert.equal(await u.c.recordAdminMonthlySettlementPayout(),false);assert.equal(u.value("adminMonthlySettlementWrite.payoutUncertain"),true);assert.equal(await u.c.recordAdminMonthlySettlementPayout(),false);assert.equal(u.count("tn_admin_record_monthly_settlement_payout"),1);
});
test("coach exact response and duplicate submit produce one POST plus authoritative readback",async()=>{
  const h=coach();await Promise.all([h.c.submitCoachSettlementReconciliation(),h.c.submitCoachSettlementReconciliation()]);assert.equal(h.calls.filter(x=>x.name==="tn_coach_respond_monthly_settlement_confirmation").length,1);assert.equal(h.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"ACKNOWLEDGED");
  const args=h.calls[0].args;assert.equal(args.target_snapshot_id,snapshot.snapshotId);assert.equal(args.target_source_fingerprint,undefined);assert.equal(args.expected_source_fingerprint,snapshot.sourceFingerprint);assert.equal(args.target_coach_role_id,scope.coachRoleId);
});
test("coach invalid identity, scope and dispute reason fail closed before POST",async()=>{
  for(const mutate of [h=>h.c.token="",h=>h.c.state.coach.role="member",h=>h.c.state.coach.branchId="",h=>h.value('coachSettlementHistory.coachSettlementReconciliationChoice="disputed";coachSettlementHistory.coachSettlementReconciliationReason="x"')]){const h=coach();mutate(h);assert.equal(await h.c.submitCoachSettlementReconciliation(),false);assert.equal(h.calls.length,0);}
});
test("coach response loss performs only read recovery and session loss cannot overwrite",async()=>{
  const h=coach();h.c.loss=true;assert.equal(await h.c.submitCoachSettlementReconciliation(),true);assert.equal(h.calls.filter(x=>x.name==="tn_coach_respond_monthly_settlement_confirmation").length,1);
  const s=coach();s.c.before=name=>{if(name==="tn_coach_respond_monthly_settlement_confirmation")s.c.token="";};assert.equal(await s.c.submitCoachSettlementReconciliation(),false);assert.notEqual(s.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"ACKNOWLEDGED");
});
test("actual assembled renderer uses safe DOM and gate OFF leaves controls disabled",()=>{
  const h=admin();h.c.recording=false;h.prime();vm.runInContext(functions(read("app/admin/views/billing.js")).get("renderAdminR3SettlementWriter"),h.c);h.c.renderAdminR3SettlementWriter();assert(h.nodes.get("#adminR3PayoutRecord").disabled);assert(h.nodes.get("#adminR3PayoutReverse").disabled);assert.match(h.nodes.get("#adminR3PayoutMessage").textContent,/잠겨/);
  h.c.events.push({amount:14400,paidOn:"<img data-synthetic>",paymentMethod:"other_manual",eventType:"payout_recorded",snapshotRevision:1});h.prime();h.c.renderAdminR3SettlementWriter();assert(h.nodes.get("#adminR3PayoutReadback").children.length>0);
});

test("admin snapshot write gate OFF allows preview READY then rejects one create, never confirms or retries writes",async()=>{
  const h=admin();assert.equal(await h.c.previewAdminMonthlySettlement(),true);assert.equal(h.value("adminMonthlySettlementWrite.status"),"READY");
  h.c.before=name=>{if(name==="tn_admin_create_monthly_settlement_snapshot")throw Error("55000 monthly_settlement_snapshot_writes_disabled");};
  assert.equal(await h.c.confirmAdminMonthlySettlementSnapshot(),false);assert.equal(h.count("tn_admin_create_monthly_settlement_snapshot"),1);assert.equal(h.count("tn_admin_confirm_monthly_settlement_snapshot"),0);
  assert.equal(h.value("adminMonthlySettlementWrite.status"),"ERROR");assert.equal(h.count("tn_admin_monthly_settlement_scope_state"),2);
});

test("selected consumer JS reconstructs all11 from source recipe and reverses to exact BASIC without changing old goldens",()=>{
  const selected=require("./helpers/r3-production-selected.cjs"),basic=require("./helpers/r3-basic-refresh-production.cjs");
  const planned=selected.plan();assert.equal(Object.keys(planned).length,11);selected.verifyCurrent();basic.verifyCurrent();
  for(const p of Object.keys(planned)){assert.equal(selected.restore(p,read(p)),source(pin.base,p));assert.equal(selected.restore(p,source(pin.base,p)),source(pin.base,p));
    const basicRow=basic.plan()[p];assert.equal(basic.restoreSuccessor(p,read(p)),basicRow?basicRow.before:source(pin.base,p));
  }
  const oldFixture="tests/fixtures/r3-basic-refresh-production.json";assert.equal(read(oldFixture),source(pin.base,oldFixture));
});
test("selected consumer JS actual promotion chain preserves exact historical bytes and one-byte errors",()=>{
  const promotion=require("./helpers/r3-production-promotion.cjs"),selected=require("./helpers/r3-production-selected.cjs");
  for(const row of pin.files){const old=promotion.files.find(x=>x[0]===row.path);const expected=old?old[1]===null?"":source(promotion.BASE,row.path):source(pin.base,row.path);
    assert.equal(promotion.restoreBeforeR3(row.path,read(row.path)),expected,row.path);
    assert.throws(()=>selected.restore(row.path,read(row.path)+" "),/selected R3 exact candidate mismatch/);
    assert.throws(()=>promotion.restoreBeforeR3(row.path,read(row.path)+" "),/selected R3 exact candidate mismatch/);
  }
});
test("selected consumer JS path union accepts only exact BASIC+selected paths, old missing/duplicate/unknown failures remain",()=>{
  const basic=require("./helpers/r3-basic-refresh-production.cjs");const old=Object.keys(basic.plan()),all=[...new Set([...old,...pin.files.map(x=>x.path)])];
  basic.assertPathSet(old);basic.assertPathSet(all);
  for(const paths of [old.slice(1),[...all,"app/synthetic-unknown.js"],[...all,all[0]],all.slice(1)])assert.throws(()=>basic.assertPathSet(paths),/BASIC refresh exact path set mismatch/);
});
test("selected consumer Python actual before_basic/before_r3 functions agree with JS and reject new drift",()=>{
  const code=String.raw`
import importlib.util,json,copy,socket
from pathlib import Path
def forbidden(*a,**k):raise AssertionError("network/protected forbidden")
socket.create_connection=forbidden
socket.socket.connect=forbidden
original_open=Path.open
def safe_open(self,*a,**kw):
    if self.name in {"check_tennisnote_r3_production_projection.py","check_tennisnote_r3_manual_ledger_http.py"}:forbidden()
    return original_open(self,*a,**kw)
Path.open=safe_open
spec=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
c=json.loads(m.SELECTED_R3_PATH.read_text(encoding="utf-8"));plan=m.selected_r3_plan(c)
results={}
for p,row in plan.items():
    data=Path(p).read_bytes()
    assert m.before_selected_r3_candidate(p,data).decode()==row["before"]
    results[p]=m.before_r3_candidate(p,data).decode()
    for fn in (m.before_selected_r3_candidate,m.before_basic_refresh_candidate,m.before_r3_candidate):
        try:fn(p,data+b" ")
        except RuntimeError:pass
        else:raise AssertionError("one-byte accepted")
for mutate in (lambda x:x.update(base="0"*40),lambda x:x.update(privateSource="0"*40),lambda x:x["files"].pop(),lambda x:x["files"].append(copy.deepcopy(x["files"][0])),lambda x:x["files"][0].update(path="app/synthetic-unknown.js"),lambda x:x["files"][0].update(candidateSha256="0"*64)):
    bad=copy.deepcopy(c);mutate(bad)
    try:m.selected_r3_plan(bad)
    except RuntimeError:pass
    else:raise AssertionError("source/schema drift accepted")
for paths in (list(plan)[:-1],list(plan)+["app/synthetic-unknown.js"],list(plan)+[next(iter(plan))]):
    try:m.selected_r3_assert_paths(paths)
    except RuntimeError:pass
    else:raise AssertionError("unknown/path drift accepted")
print(json.dumps(results))
`;
  const py=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
  const result=JSON.parse(execFileSync(py,["-B","-X","utf8","-c",code],{encoding:"utf8",maxBuffer:8*1024*1024,stdio:["ignore","pipe","pipe"]}));
  const promotion=require("./helpers/r3-production-promotion.cjs");for(const row of pin.files)assert.equal(result[row.path],promotion.restoreBeforeR3(row.path,read(row.path)));
});

test("selected Python entry rejects undeclared live app path before historical consumer",()=>{
  const code=String.raw`
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=m.subprocess.check_output
def observed(args,*a,**kw):
    result=original(args,*a,**kw)
    if args[:3]==["git","diff","--name-only"]:result+=b"app/synthetic-unknown.js\n"
    return result
m.subprocess.check_output=observed
try:m.before_r3_candidate("app/admin/index.html",Path("app/admin/index.html").read_bytes())
except RuntimeError as error:assert str(error)=="selected R3 release exact22 path set mismatch"
else:raise AssertionError("actual consumer accepted undeclared app path")
print("PASS")
`;
  const py=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");assert.equal(execFileSync(py,["-B","-X","utf8","-c",code],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim(),"PASS");
});

test("selected checkpoint collector preserves old23 and rejects unknown duplicate missing new paths",()=>{
  const selected=require("./helpers/r3-production-selected.cjs"),basic=require("./helpers/r3-basic-refresh-production.cjs");
  const old=[...basic.contract.files.map(x=>x.path),"tests/fixtures/r3-basic-refresh-production.json","tests/helpers/r3-basic-refresh-production.cjs","tests/r3-basic-refresh-production.test.js","tests/helpers/r3-production-promotion.cjs","scripts/check_tennisnote_dev_prod_alignment.py","tests/r3-production-candidate.test.js","tests/r3-production-promotion.test.js"].sort();
  assert.equal(old.length,23);const combined=[...new Set([...old,...selected.CHECKPOINT_PATHS])].sort();assert.deepEqual(selected.restoreCheckpointPaths(combined,old),old);
  for(const paths of [[...combined,"synthetic-unknown.js"],[...combined,combined[0]],combined.slice(1),old])assert.throws(()=>selected.restoreCheckpointPaths(paths,old),/selected R3 checkpoint exact path set mismatch/);
});

test("selected product observation uses pinned base equally in dirty local, clean commit and PR merge",()=>{
  for(const mode of ["dirty","clean","pr-test-merge"]){const calls=[];const fake=(...args)=>{calls.push(args);if(args[0]==="diff"){assert.equal(args[2],pin.base);return [...new Set([...pin.files.map(x=>x.path),...selectedLayers.RELEASE_PATHS])].join("\n");}if(args[0]==="ls-files")return "";throw Error("unexpected Git observation");};assertProductPaths(observedProductPaths(fake));assert.equal(calls.length,2,mode);}
  for(const changed of [[],[...pin.files.map(x=>x.path),"app/synthetic-unknown.js"],[...pin.files.map(x=>x.path),pin.files[0].path]])assert.throws(()=>assertProductPaths([...changed].sort()));
});

test("selected release official558 reconstructs exact13 and preserves product11 semantics plus native metadata",()=>{
  const releasePin=JSON.parse(raw("tests/fixtures/r3-production-selected-release.json"));
  const planned=selectedLayers.releasePlan();assert.equal(Object.keys(planned).length,13);assert.equal(releasePin.release.officialReplacementCount,374);
  selectedLayers.verifyCurrent();
  for(const row of releasePin.files){assert.equal(hash(raw(row.path)),row.afterSha256);assert.equal(hash(selectedLayers.restoreRelease(row.path,raw(row.path))),row.beforeSha256);}
  for(const row of pin.files)assert.equal(hash(selectedLayers.restoreRelease(row.path,raw(row.path))),row.candidateSha256);
  assert.equal(hash(pin.files.map(x=>x.path+"\0"+hash(read(x.path))+"\n").join("")),pin.productAggregateSha256);
  const actual=JSON.parse(raw("app/release.json")),before=JSON.parse(source(pin.base,"app/release.json"));
  assert.deepEqual(actual.nativePlatforms,before.nativePlatforms);assert.equal(actual.minimumNativeShellVersion,before.minimumNativeShellVersion);
  assert.equal(actual.version,"1.0.558");assert.equal(actual.appSurfaceVersion,"1.0.558");assert.equal(actual.releaseId,"2026.10.26.02");
  const unpack=text=>{const c=vm.createContext({window:{},document:{readyState:"loading",addEventListener(){}}});vm.runInContext(text,c);return JSON.parse(JSON.stringify(c.window.TENNIS_NOTE_RELEASE));};
  const oldJs=unpack(source(pin.base,"app/shared/tennisnote-release.js")),newJs=unpack(raw("app/shared/tennisnote-release.js"));
  for(const key of ["nativeShell","store","prepared","minimumNativeShellVersion"])assert.deepEqual(newJs[key],oldJs[key],key);
  assert.equal(newJs.version,actual.version);assert.equal(newJs.releaseId,actual.releaseId);assert.equal(newJs.deployedAt,actual.deployedAt);
  for(const [p,cache]of [["app/tennis-note-member-app/service-worker.js","tennis-note-member-pwa-v591"],["app/tennis-note-coach-app/service-worker.js","tennis-note-coach-mode-v564"]])assert(raw(p).includes(`const CACHE_NAME = "${cache}"`));
  assert.equal(raw("scripts/bump_release.py"),source(pin.base,"scripts/bump_release.py"));
  assert.deepEqual(selectedLayers.restoreProductPaths([...new Set([...pin.files.map(x=>x.path),...selectedLayers.RELEASE_PATHS])]),pin.files.map(x=>x.path).sort());
});

test("selected release actual JS and Python consumers remove metadata then selected11 then BASIC556 without repinning goldens",()=>{
  const basic=require("./helpers/r3-basic-refresh-production.cjs"),promotion=require("./helpers/r3-production-promotion.cjs");
  const paths=[...new Set([...pin.files.map(x=>x.path),...selectedLayers.RELEASE_PATHS])].sort();assert.equal(paths.length,22);
  const expected={};
  for(const p of paths){
    assert.equal(selectedLayers.restore(p,raw(p)),source(pin.base,p),p);
    const basicRow=basic.plan()[p];assert.equal(basic.restoreSuccessor(p,raw(p)),basicRow?basicRow.before:source(pin.base,p));
    const old=promotion.files.find(x=>x[0]===p);expected[p]=old?old[1]===null?"":source(promotion.BASE,p):source(pin.base,p);
    assert.equal(promotion.restoreBeforeR3(p,raw(p)),expected[p],p);
  }
  const code=String.raw`
import importlib.util,json,socket
from pathlib import Path
def forbidden(*a,**k):raise AssertionError("network/protected forbidden")
socket.create_connection=forbidden;socket.socket.connect=forbidden
old_open=Path.open
def safe_open(self,*a,**k):
    if self.name in {"check_tennisnote_r3_production_projection.py","check_tennisnote_r3_manual_ledger_http.py"}:forbidden()
    return old_open(self,*a,**k)
Path.open=safe_open
s=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
paths=sorted(set(m.selected_r3_plan())|set(m.selected_release_plan()));result={}
for p in paths:
    data=Path(p).read_bytes();result[p]=m.before_r3_candidate(p,data).decode()
    for fn in (m.before_selected_release_candidate,m.before_selected_r3_candidate,m.before_basic_refresh_candidate,m.before_r3_candidate):
        if p not in m.BASIC_REFRESH_RELEASE_PATHS and fn==m.before_selected_release_candidate:continue
        try:fn(p,data+b" ")
        except RuntimeError:pass
        else:raise AssertionError("one-byte accepted "+p)
print(json.dumps(result))
`;
  const py=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");assert.deepEqual(JSON.parse(execFileSync(py,["-B","-X","utf8","-c",code],{encoding:"utf8",maxBuffer:8*1024*1024,stdio:["ignore","pipe","pipe"]})),expected);
  assert.equal(hash(raw("tests/fixtures/r3-production-selected-source.json")),"28aba25a81f271958a33638723594f7a3b13838871b2bff405d81806739dda7d","pre-release frozen product fixture unchanged");
  for(const p of ["tests/fixtures/r3-basic-refresh-production.json","tests/fixtures/r3-production-promotion.json","tests/fixtures/self-profile-a-only.json","tests/fixtures/production-isolation-source.json","tests/fixtures/production-excel-release.json","scripts/verify.sh", ".github/workflows/tennisnote-public-ci.yml"])assert.equal(raw(p),source(pin.base,p));
});

test("selected release metadata path and contract drift fail closed without modifying historical expectations",()=>{
  const paths=[...new Set([...pin.files.map(x=>x.path),...selectedLayers.RELEASE_PATHS])];
  for(const list of [paths.slice(1),[...paths,paths[0]],[...paths,"app/unknown.js"],pin.files.map(x=>x.path)])assert.throws(()=>selectedLayers.restoreProductPaths(list),/exact22 path set/);
  for(const p of selectedLayers.RELEASE_PATHS){
    const error=pin.files.some(x=>x.path===p)?/^selected R3 exact candidate mismatch: /:/^selected R3 release exact candidate mismatch: /;
    assert.throws(()=>selectedLayers.restoreRelease(p,raw(p)+" "),{message:error});
    if(pin.files.some(x=>x.path===p))assert.throws(()=>selectedLayers.restore(p,read(p)+" "),{message:/^selected R3 exact candidate mismatch: /});
  }
  const combined=selectedLayers.CHECKPOINT_PATHS;assert.equal(combined.length,33);assert.deepEqual(selectedLayers.restoreCheckpointPaths(combined,[]),[]);
  for(const list of [combined.slice(1),[...combined,combined[0]],[...combined,"unknown.js"]])assert.throws(()=>selectedLayers.restoreCheckpointPaths(list,[]),/checkpoint exact path set/);
  const code=String.raw`
import importlib.util,json,copy
s=importlib.util.spec_from_file_location("a","scripts/check_tennisnote_dev_prod_alignment.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=json.loads(m.SELECTED_RELEASE_PATH.read_text(encoding="utf-8"));cases=[lambda x:x.update(base="0"*40),lambda x:x.update(productAggregateSha256="0"*64),lambda x:x.update(officialToolSha256="0"*64),lambda x:x["release"].update(version="1.0.557"),lambda x:x["release"].update(releaseId="2026.10.26.01"),lambda x:x["release"].update(memberCache="tennis-note-member-pwa-v590"),lambda x:x["release"].update(officialReplacementCount=373),lambda x:x["files"].pop(),lambda x:x["files"].append(copy.deepcopy(x["files"][0])),lambda x:x["files"][0].update(path="app/unknown.js"),lambda x:x["files"][0].update(afterSha256="0"*64),lambda x:x["release"].update(preparedBuild=999)]
for mutate in cases:
    x=copy.deepcopy(c);mutate(x)
    try:m.selected_release_plan(x)
    except RuntimeError:pass
    else:raise AssertionError("metadata drift accepted")
print(len(cases))
`;
  const py=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");assert.equal(execFileSync(py,["-B","-X","utf8","-c",code],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim(),"12");
});

test("selected correction actual historical collector restores exact old35 without filename filtering",()=>{
  const promotion=require("./helpers/r3-production-promotion.cjs"),basic=require("./helpers/r3-basic-refresh-production.cjs");
  const tracked=git("diff","--name-only",promotion.BASE,"--","app").trim().split("\n").filter(Boolean);
  const untracked=git("ls-files","--others","--exclude-standard","--","app").trim().split("\n").filter(Boolean);
  const current=[...tracked,...untracked],expected=promotion.files.map(x=>x[0]).sort();
  assert.equal(current.length,36);assert.equal(expected.length,35);
  assert.deepEqual(promotion.changedAppPaths(),expected);
  assert.deepEqual(selectedLayers.restoreHistoricalAppPaths(current,basic.restoreSuccessor),expected);
  const removed=current.filter(p=>!expected.includes(p));assert.equal(removed.length,1);
  for(const p of removed)assert.equal(basic.restoreSuccessor(p,raw(p)),source(promotion.BASE,p),"inverse-proven historical unchanged source");
});

test("selected correction historical admission rejects unknown missing duplicate and byte drift",()=>{
  const promotion=require("./helpers/r3-production-promotion.cjs"),basic=require("./helpers/r3-basic-refresh-production.cjs");
  const current=git("diff","--name-only",promotion.BASE,"--","app").trim().split("\n").filter(Boolean);
  for(const paths of [current.slice(1),[...current,current[0]],[...current,"app/unknown.js"]])assert.throws(()=>selectedLayers.restoreHistoricalAppPaths(paths,basic.restoreSuccessor),/historical observed path set mismatch/);
  for(const p of ["app/admin/actions/billing.js","app/admin/actions/coach.js","app/admin/index.html"]){
    assert.throws(()=>selectedLayers.restoreHistoricalAppPaths(current,basic.restoreSuccessor,{read:file=>raw(file)+(file===p?" ":"")}),/exact candidate mismatch|historical candidate bytes mismatch/);
  }
  assert.throws(()=>promotion.changedAppPaths(promotion.BASE,"tests"),/historical fixed checkout mismatch|not a git repository|bad revision/);
});

test("selected correction AGENTS is fixed-base plus one pointer only and instructions cannot drift",()=>{
  const before=source(pin.base,"AGENTS.md"),current=raw("AGENTS.md");
  assert.equal(selectedLayers.verifyDocRegistration(current),before);
  assert.equal(current.replace(selectedLayers.DOC_POINTER+"\n",""),before);
  assert.equal(current.split(selectedLayers.DOC_POINTER).length,2);
  for(const text of [before,current+" ",current+"\n"+selectedLayers.DOC_POINTER,current.replace("직접 커밋하거나 직접 푸시하지 않습니다.","직접 푸시를 허용합니다.")])assert.throws(()=>selectedLayers.verifyDocRegistration(text),/document registration exact pointer mismatch/);
  const basic=require("./helpers/r3-basic-refresh-production.cjs"),old=[...basic.contract.files.map(x=>x.path),"tests/fixtures/r3-basic-refresh-production.json","tests/helpers/r3-basic-refresh-production.cjs","tests/r3-basic-refresh-production.test.js","tests/helpers/r3-production-promotion.cjs","scripts/check_tennisnote_dev_prod_alignment.py","tests/r3-production-candidate.test.js","tests/r3-production-promotion.test.js"].sort();
  const combined=[...new Set([...old,...selectedLayers.CHECKPOINT_PATHS])];
  assert.equal(old.length,23);assert.equal(selectedLayers.CHECKPOINT_PATHS.length,33);
  assert.deepEqual(selectedLayers.restoreCheckpointPaths(combined,old),old);
  for(const paths of [combined.slice(1),[...combined,combined[0]],[...combined,"unknown.js"]])assert.throws(()=>selectedLayers.restoreCheckpointPaths(paths,old),/checkpoint exact path set mismatch/);
});
