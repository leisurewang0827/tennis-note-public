"use strict";
const parser=require("../app/shared/tennisnote-single-sheet-import.js");
const adapter=require("../app/shared/tennisnote-single-sheet-snapshot.js");
const {workbookBytes}=require("./check_tennisnote_single_sheet_preview.cjs");
const XLSX=require("../app/shared/vendor/xlsx.full.min.js");
let n=0;const check=(v,c)=>{n++;if(!v)throw Error(c);};
async function main(){
  for(const used of ["", "  ",0]){
    const wb=XLSX.read(workbookBytes(),{type:"buffer"});wb.Sheets[parser.SHEET].G2={t:typeof used==="number"?"n":"s",v:used};
    const parsed=await parser.parseWorkbook(wb,"a".repeat(64)), payload=await parser.serverUnits(parsed);
    check(payload.units.length===1&&payload.units[0].unit.rows[0].used===0,"BLANK_USED_ZERO");
    check(parser.HEADERS.length===14,"FOURTEEN_COLUMNS");
  }
  const scope={environment:"local",projectFingerprint:"a".repeat(64),branchId:"synthetic-branch"};
  const packet=()=>({contract:"single-sheet-server/2",initialContract:"initial-import/1",scope,
    proof:{complete:true,scope:"unit_dependencies",statementBudgetMs:10000,unitCount:1,expiresAt:new Date(Date.now()+300000).toISOString()},
    units:[{status:"READY",unitHash:"b".repeat(64),planHash:"c".repeat(64),revision:"c".repeat(64),rowCount:1,newMembers:0,newTickets:0,newLessons:0,
      initial:{kind:"TOPUP_EXISTING",historicalReceipt:false,remainingBefore:1,addedSessions:8,remainingAfter:9,expiresOn:"2099-12-31",preservedLessons:0,reservedUnits:0,manualAssignment:true}}]});
  const adapt=p=>adapter.adaptServer(p,{...scope,authorized:true},new Date().toISOString());
  check(adapt(packet()).serverPreview.units[0].initial.remainingAfter===9,"SAFE_TOPUP");
  for(const mutate of [p=>delete p.initialContract,p=>p.initialContract="unknown",p=>p.units[0].initial.remainingAfter=10,p=>p.units[0].initial.recordedBalance={remaining:9},p=>p.units[0].initial.phone="redacted",p=>p.units[0].newTickets=1,p=>p.units[0].initial=null,p=>p.units[0].initial.remainingBefore=null]){
    const p=packet();mutate(p);check(!adapt(p).serverPreview,"INVALID_ENVELOPE_FAIL_CLOSED");
  }
  for(const status of ["APPLIED","REVERSED","NO_OP"]){
    const p=packet();Object.assign(p.units[0],{status,verified:true,initial:status==="NO_OP"?null:{kind:"TOPUP_EXISTING",historicalReceipt:true}});
    const u=adapt(p).serverPreview.units[0];check(u.newTickets===0&&!u.initial?.remainingAfter,"RECEIPT_NOT_CURRENT_BALANCE");
  }
  const legacy=packet();delete legacy.initialContract;delete legacy.units[0].initial;legacy.units[0].newTickets=1;
  check(!!adapt(legacy).serverPreview,"LEGACY_COMPATIBILITY");
  const Batch=require("../app/shared/tennisnote-single-sheet-batch.js");
  let applied=false,writes=0;
  const transport={protocol:"local-synthetic/1",scope,enabled:true,currentScope:()=>scope,
    preview:async()=>{const p=packet();p.proof.unitCount=2;p.units.push({...p.units[0],unitHash:"d".repeat(64),status:"NO_OP",initial:null,verified:true});
      if(applied)Object.assign(p.units[0],{status:"APPLIED",initial:{kind:"TOPUP_EXISTING",historicalReceipt:true},verified:true});return p;},
    apply:async()=>{writes++;applied=true;return {status:"applied"};}};
  const batch=Batch.create({host:"localhost",transport,adapter,canOpen:()=>true});
  const payload={protocol:transport.protocol,fileHash:"e".repeat(64),held:[],units:[1,2].map(i=>({unit:{rows:[{}]},operationKey:String(i).repeat(64),rowNumbers:[i+1]}))};
  // Reconcile calls preview for exactly one unit; return the corresponding receipt.
  const originalPreview=transport.preview;
  transport.preview=async(s,units)=>{const p=await originalPreview();if(units.length===1){p.units=p.units.slice(0,1);p.proof.unitCount=1;}return p;};
  check(await batch.load(payload),"MIXED_NOOP_LOAD");
  await batch.confirm();batch.invalidate();
  check(writes===1&&batch.view().phase==="done"&&batch.view().applied===1,"MIXED_NOOP_REFRESH_COMPLETION");
  batch.dispose();
  // Historical recovery is distinct from appliedHere and never resubmits apply.
  const makeRecovery=async(options={})=>{
    let state="APPLIED",calls=0,applyCalls=0,reads=0,current=scope;
    const key="e".repeat(64),file="f".repeat(64);
    const t={protocol:"local-synthetic/1",scope,enabled:true,currentScope:()=>current,
      preview:async()=>{
        reads++;if(options.readFail&&reads>1)throw Error("synthetic read failure");
        const p=packet();if(options.branchMismatch)p.scope={...scope,branchId:"different-synthetic-branch"};
        if(options.expired)p.proof.expiresAt=new Date(Date.now()-1).toISOString();
        const status=options.closed?"REVERSED":options.changed&&reads>1?"HOLD":state;
        Object.assign(p.units[0],{status,newMembers:0,newTickets:0,newLessons:0,verified:!options.unverified,
          reversible:!options.otherActor&&status==="APPLIED",reason:status==="HOLD"?"SHEET_RECEIPT_STATE_CHANGED":"",
          initial:options.missingMetadata?null:{kind:"ADD_TICKET",historicalReceipt:true}});return p;
      },apply:async()=>{applyCalls++;},reverse:async(s,k)=>{
        calls++;check(s.branchId===scope.branchId&&k===key,"RECOVERY_EXACT_ORIGINAL_KEY");
        if(options.wrongFile)throw Object.assign(Error("redacted"),{code:"SHEET_IMPORT_RECEIPT_REQUIRED"});
        state="REVERSED";if(options.loss)throw Error("synthetic response loss");return {status:"reversed"};
      }};
    const c=Batch.create({host:"localhost",transport:t,adapter,canOpen:()=>true});
    await c.load({protocol:t.protocol,fileHash:file,held:[],units:[{operationKey:key,rowNumbers:[2],unit:{rows:[{startDate:"2099-01-01"}]}}]});
    return {c,t,counts:()=>({calls,applyCalls}),changeScope:()=>current={...scope,branchId:"changed-synthetic-branch"}};
  };
  for(const loss of [false,true]){
    const r=await makeRecovery({loss});
    check(r.c.view().canReverse&&r.c.view().historicalRecoveryCount===1&&!r.c.view().canConfirm,"HISTORICAL_EXPLICIT_RECOVERY_ONLY");
    check(r.c.view().rows[0].recoveryStartDates[0]==="2099-01-01","SOURCE_DATE_NOT_CURRENT_BALANCE");
    await Promise.all([r.c.reverse(),r.c.reverse()]);await r.c.reverse();
    check(r.counts().calls===1&&r.counts().applyCalls===0&&r.c.view().reversed===1,"RECOVERY_DUPLICATE_LOSS_ONE_WRITE");
    r.c.dispose();
  }
  for(const options of [{otherActor:true},{branchMismatch:true},{closed:true},{unverified:true},{missingMetadata:true},{expired:true}]){
    const r=await makeRecovery(options);check(!r.c.view().canReverse,"HISTORICAL_INVALID_PROOF_BLOCKED");
    await r.c.reverse();check(r.counts().calls===0&&r.counts().applyCalls===0,"INVALID_RECOVERY_WRITE_ZERO");r.c.dispose();
  }
  for(const options of [{changed:true},{readFail:true},{wrongFile:true}]){
    const r=await makeRecovery(options);await r.c.reverse();await r.c.reverse();
    check(r.counts().calls===(options.wrongFile?1:0)&&r.counts().applyCalls===0&&!r.c.view().canReverse,"RECOVERY_FAILURE_NO_RETRY");
    check(r.c.view().reversed===0,"NO_FALSE_RECOVERY_COMPLETION");r.c.dispose();
  }
  for(const action of [r=>r.c.invalidate(),r=>r.c.cancel(),r=>r.changeScope()]){
    const r=await makeRecovery();action(r);await r.c.reverse();
    check(!r.c.view().canReverse&&r.counts().calls===0,"RECOVERY_BACK_OR_SCOPE_INVALIDATION");r.c.dispose();
  }
  process.stdout.write(`PASS single-sheet initial envelope JS ${n} assertions\n`);
}
main().catch(()=>{process.stderr.write("FAIL single-sheet initial envelope JS; values redacted\n");process.exitCode=1;});
