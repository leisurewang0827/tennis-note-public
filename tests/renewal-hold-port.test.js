import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {execFileSync} from "node:child_process";
import port from "./helpers/renewal-hold-port.cjs";
const {root,manifest,sha,read,restoreBase,appSource,definition} = port;
const member = appSource("tennis-note-member-app");
const admin = appSource("admin");

test("12파일 exact 역변환 및 7개 private 실행 함수 hash", () => {
  assert.equal(manifest.files.length,12);
  for (const row of manifest.files) {
    const source = read(row.path);
    const base = execFileSync("git",["show",`${manifest.base}:${row.path}`],{cwd:root,encoding:"utf8"}).replace(/\r\n/g,"\n");
    assert.equal(restoreBase(row.path,source),base);
    assert.throws(()=>restoreBase(row.path,source+"\n"),/candidate drift/);
  }
  for (const row of manifest.parity) assert.equal(sha(definition(read(row.path),row.name)),row.privateExecutableSha256);
  assert.equal(manifest.parity.filter(row=>row.excludedExactComment).length,1);
});

test("importOnly strict boolean만 숨김: baseline의 다른 필드/권리 보존", () => {
  const file="app/tennis-note-member-app/forms/tickets.js";
  const context={window:{},numericValue:(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,
    isOneDayMembershipProduct:()=>false,normalizeProduct:v=>v};
  const current=vm.runInNewContext(`(${definition(member,"membershipProductFromServer")})`,context);
  const old=vm.runInNewContext(`(${definition(restoreBase(file,read(file)),"membershipProductFromServer")})`,context);
  for(const product_kind of ["regular","group","coupon"]) for(const policy_settings of [
    {},{adminSaleStatus:"consult"},{importOnly:true},{memberCheckoutVisible:false},
    {importOnly:"true"},{memberCheckoutVisible:"false"},{importOnly:false,memberCheckoutVisible:true},
  ]) {
    const row={id:"synthetic-product",product_kind,total_sessions:5,policy_settings};
    const a=JSON.parse(JSON.stringify(current(row))),b=JSON.parse(JSON.stringify(old(row)));
    const hidden=policy_settings.importOnly===true||policy_settings.memberCheckoutVisible===false;
    assert.equal(a.status,hidden?"hidden":b.status);
    delete a.status; delete b.status; assert.deepEqual(a,b);
  }
});

test("실제 modular 회원 함수: exact 연장·숨김·stale·일반결제·계좌이체·4주→3개월", () => {
  const report=execFileSync(process.execPath,["scripts/check_tennisnote_renewal_hold_member.cjs"],{cwd:root,encoding:"utf8"});
  assert.match(report,/PASS node focused \d+ contracts; real network\/DB writes 0/);
});

test("admin HOLD batch/권한/새 조회와 기존 bank 표시 보존", async () => {
  const names=["loadAdminPaymentHoldReasons","billingStatusFromServerPayment","paymentEnvironment",
    "billingRowFromServerPayment","paymentTicketFinalizeRecoveryCode","paymentTicketFinalizeRecoveryMessage","chargeStatusForPayment"];
  let branch="synthetic-branch",role="admin",calls=[];
  let reply=args=>args.target_payment_ids.filter((_,i)=>i%5!==0).map(payment_id=>({payment_id,
    reason_code:"renewal_source_checkout_unavailable",failed_at:"2099-01-01T00:00:00Z"}));
  const context=vm.createContext({window:{TennisNoteDataClient:{rpc:async(name,args)=>{
    assert.equal(name,"tn_admin_payment_hold_reasons");calls.push(args);return reply(args);
  }}},activeOperationBranchId:()=>branch,operationsRole:()=>role,isHistoricalImportedPayment:()=>false,isStaleReadyPayment:()=>false});
  vm.runInContext(names.map(name=>definition(admin,name)).join("\n"),context);
  const row=(id,extra={})=>({id,branch_id:branch,status:"verified",method:"card",...extra});
  const rows=Array.from({length:500},(_,i)=>row(`synthetic-${i}`));
  const before=JSON.stringify(rows),result=await context.loadAdminPaymentHoldReasons(rows);
  assert.equal(calls.length,1);assert.equal(result.filter(r=>r.finalizeHoldCode).length,400);
  assert.equal(result.map(context.billingRowFromServerPayment).filter(r=>context.chargeStatusForPayment(r).label==="회원권 적용 보류").length,400);
  assert.equal(JSON.stringify(rows),before);
  reply=()=>[];assert.equal((await context.loadAdminPaymentHoldReasons(result)).filter(r=>r.finalizeHoldCode).length,0);
  calls=[];await context.loadAdminPaymentHoldReasons(Array.from({length:501},(_,i)=>row(`batch-${i}`)));
  assert.deepEqual(calls.map(c=>c.target_payment_ids.length),[500,1]);
  calls=[];
  for(const extra of [{method:"bank_transfer"},{provider:"bank_transfer"},{ticket_id:"synthetic-ticket"},{one_day_booking_id:"synthetic-booking"},{branch_id:"other"},{status:"ready"}]) await context.loadAdminPaymentHoldReasons([row("ineligible",extra)]);
  role="coach";await context.loadAdminPaymentHoldReasons(rows);role="admin";
  branch="";await context.loadAdminPaymentHoldReasons(rows);branch="synthetic-branch";assert.equal(calls.length,0);
  reply=()=>{throw Error("synthetic-denied")};await assert.rejects(context.loadAdminPaymentHoldReasons(rows),/synthetic-denied/);
  for(const bad of [{payment_id:"outside",reason_code:"renewal_source_checkout_unavailable",failed_at:"2099-01-01"},
    {payment_id:"synthetic-0",reason_code:"raw_event",failed_at:"2099-01-01"},
    {payment_id:"synthetic-0",reason_code:"renewal_source_checkout_unavailable",failed_at:"invalid"}]) {
    reply=()=>[bad];await assert.rejects(context.loadAdminPaymentHoldReasons(rows),/projection_invalid/);
  }
  reply=()=>{branch="other";return []};await assert.rejects(context.loadAdminPaymentHoldReasons(rows),/scope_changed/);
  const file="app/admin/domain/payment.js";
  const oldStatus=vm.runInNewContext(`(${definition(restoreBase(file,read(file)),"chargeStatusForPayment")})`,{isHistoricalImportedPayment:()=>false,isStaleReadyPayment:()=>false});
  for(const status of ["server_ready","paid","cancelled","failed","unverified","refunded"]) {
    const item={status,method:"bank_transfer"};
    assert.equal(JSON.stringify(context.chargeStatusForPayment(item)),JSON.stringify(oldStatus(item)));
  }
  assert(read("app/admin/actions/common.js").includes("await loadAdminPaymentHoldReasons(serverPayments || [])"));
  assert(read("app/admin/data/billing.js").includes("rows = await loadAdminPaymentHoldReasons(Array.isArray(rows) ? rows : [])"));
});
