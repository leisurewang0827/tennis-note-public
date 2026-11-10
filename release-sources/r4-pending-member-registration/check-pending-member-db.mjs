import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync,mkdtempSync} from "node:fs";
import {join} from "node:path";
import {createServer} from "node:net";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";

const repo="C:/Codex/tennis-note-public-release-20260815";
const bundle=join(process.env.TEMP,"tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f");
const {Client}=createRequire(join(bundle,"driver","package.json"))("pg");
const bin=join(bundle,"package","native","bin");
const cluster=mkdtempSync(join(process.env.TEMP,"tn-pending-member-focused-"));
const get=(name)=>{
  const r=spawnSync("git",["show","2eeae46e:release-sources/r4-zero-personal-issue-prod/"+name],{cwd:repo,encoding:"utf8",windowsHide:true});
  assert.equal(r.status,0);return r.stdout.replace(/\r\n/g,"\n");
};
const port=await new Promise((resolve,reject)=>{
  const s=createServer().once("error",reject);
  s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});
});
const pg=(name,args)=>{
  const r=spawnSync(join(bin,name+".exe"),args,{cwd:cluster,windowsHide:true,encoding:"utf8",timeout:30000});
  assert.equal(r.status,0,name);
};
const client=()=>new Client({host:"127.0.0.1",port,user:"postgres",database:"postgres",statement_timeout:8000});
const check=get("check-db.mjs");
const isolate=(a,b)=>{const i=check.indexOf(a),j=check.indexOf(b,i+a.length);assert(i>=0&&j>i);return check.slice(i,j);};
const ids=isolate("const [admin,adminProfile,adminSession","const sql=");
const setup=isolate("    create role anon;","  const footprint=");
const trig=isolate("const triggers=","try{");
const old=get("install-off.sql");
const packet=(name)=>readFileSync(new URL("./first-zero-canary-"+name+".sql",import.meta.url),"utf8");
const fresh=packet("install-off");
const hashSql=sig=>"encode(sha256(convert_to(pg_get_functiondef('"+sig+"'::regprocedure),'UTF8')),'hex')";
const rpc="public.tn_r4_prod_zero_personal_issue";
const sig=rpc+"(text,uuid,uuid,uuid,uuid)";
const run=async(db,other)=>{
  const sql=(c,s,v)=>c.query(s,v);
  const row=async(c,s,v)=>(await sql(c,s,v)).rows[0];
  const deny=(p)=>assert.rejects(p,e=>e.code==="42501");
  await eval("(async()=>{"+ids+"await sql(db,`"+setup+"return null;})()").catch(e=>{throw e;});
  const t=eval(trig+"triggers");
  await sql(db,`alter table public.tn_users add column name text,add column phone text;
    alter table public.tn_member_database_records
      add column source_name text,add column created_by_user_id uuid,add column coach_role_id uuid,
      add column lesson_days smallint[] default '{}',add column payment_amount integer default 0,
      add column payment_method text,add column payment_recorded_on date,add column lesson_schedule_scope text,
      add column lesson_type text,add column lesson_start_on date,add column total_sessions integer,
      add column used_sessions integer,add column remaining_sessions integer,add column last_updated_via text,add column updated_at timestamptz;
    alter table public.tn_membership_products add column schedule_scope text default 'mixed';
    create table public.tn_one_day_bookings(linked_user_id uuid);
    create function public.tn_link_one_day_bookings_for_user(uuid) returns int language sql as $$select 0$$;
    create or replace function public.qa_lifecycle() returns trigger language plpgsql as $$begin
      update public.tn_member_database_records m set current_ticket_id=new.id,branch_id=new.branch_id,
      coach_role_id=new.coach_role_id,
      record_status=case when new.status in ('active','paused') and new.remaining_sessions>0 then 'active' else 'historical' end,
      lesson_schedule_scope=(select p.schedule_scope from public.tn_membership_products p where p.id=new.product_id),
      lesson_type='one_on_one',lesson_start_on=new.starts_on,total_sessions=new.total_sessions,
      used_sessions=new.used_sessions,remaining_sessions=new.remaining_sessions,last_updated_via='ticket_created_sync',updated_at=now()
      where user_id=new.user_id and (current_ticket_id is null or record_status<>'active');
      return new;end$$;
    update public.tn_member_database_records m set remaining_sessions=t.remaining_sessions
      from public.tn_member_tickets t where t.id=m.current_ticket_id;
    alter table public.tn_member_database_records add constraint tn_member_database_record_active_ticket_check
      check(record_status<>'active' or (current_ticket_id is not null and remaining_sessions>0));
    alter table public.tn_member_database_records alter column id set default gen_random_uuid();`);
  await sql(db,"set search_path=pg_catalog");
  const h=await row(db,`select ${t} t,${hashSql("public.tn_r4_prod_admin_standing_catalog(text,uuid,jsonb)")} s,
    ${hashSql("private.tn_reconcile_future_regular_ticket_core(uuid,uuid,boolean)")} f,
    ${hashSql("public.tn_schedule_v2_reserved_regular_units(uuid,date)")} u`);
  const bind=s=>s.replaceAll("420c228b364835151a2e09a288a44c4cd146fa1e795122ab6d130ae922537dba",h.t)
    .replaceAll("e76652c1e8d06edfc790e5a1552691369fb2453ad5734b8b8da26d05568e52cf",h.s)
    .replaceAll("faf666a2a803548dc2bd26a5f8a0d301fff1e027e1609ce9f3e743bdd8462c2d",h.f)
    .replaceAll("03be6593c8831c589ebfa1e4a310e7baa56948312739007522386ea7f1081411",h.u);
  await sql(db,bind(old));
  const pre=(await row(db,"select "+hashSql(sig)+" h")).h;
  await sql(db,bind(fresh).replace("0f0a01a01bad74943390904afd08e22fc6403c5cd453f6caba424a1c1bb31db2",pre));
  const g=await row(db,"select * from private.tn_r4_zero_personal_issue_gate");
  const {id:sid}=await row(db,"select id from auth.sessions where user_id=$1",[g.actor_id]);
  const {id:reg}=await row(db,`select r.id from private.tn_r4_prod_member_catalog_registration r
    join private.tn_r4_prod_member_catalog_draft d on d.id=r.draft_id where d.price=0`);
  const op=randomUUID(),op2=randomUUID(),otherSession=randomUUID();
  const opHash=await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
    where oid='${sig}'::regprocedure) body,
    ${hashSql("public.tn_link_one_day_bookings_for_user(uuid)")} booking,
    encode(sha256(convert_to('','UTF8')),'hex') prep`);
  const packetBind=s=>s.replace("51d8fe75a68079bb08b5e81f29db38ec6cc66607cf51d5ff29a6e4a9d0fb3470",opHash.body)
    .replace("78a72aab952dc502da09a2f37811a8307daa9a89e483021c90f039f1b620f735",opHash.booking)
    .replace("95cd404b9d8285a5234ff9d58e877fe966b31745260c024780902535ec2fa297",opHash.prep);
  await sql(db,packetBind(packet("prepare-off")));
  const {user_id:member}=await row(db,"select user_id from public.tn_member_database_records where source_name='r4_first_zero_personal_canary'");
  const claims=(c,s)=>sql(c,"select set_config('request.jwt.claims',$1,false)",[JSON.stringify({
    sub:g.actor_id,session_id:s,role:"authenticated",exp:Math.floor(Date.now()/1000)+600})]);
  const issue=(c,a,m=member,r=reg,o=op)=>row(c,"select "+rpc+"($1,$2,$3,$4,$5) r",
    [a,g.branch_id,m,a==="list"?null:r,a==="list"?null:o]).then(x=>x.r);
  await sql(db,"insert into auth.sessions(id,user_id) values($1,$2)",[otherSession,g.actor_id]);
  await assert.rejects(sql(db,`update public.tn_member_database_records set record_status='active' where user_id=$1`,[member]),
    {constraint:"tn_member_database_record_active_ticket_check"});
  const stats=()=>row(db,`select (select count(*)::int from public.tn_member_tickets where user_id=$1) tickets,
    (select count(*)::int from private.tn_r4_zero_personal_issue_receipts where member_id=$1) receipts,
    (select count(*)::int from private.tn_r4_zero_personal_issue_requests) requests,
    (select count(*)::int from public.tn_payments) payments,(select count(*)::int from public.tn_lessons) lessons,
    (select count(*)::int from public.tn_regular_schedule_rules) rules,
    (select count(*)::int from public.tn_lesson_participants) participants,
    (select count(*)::int from public.tn_audit_logs) audit`,[member]);
  // Establish the already-proven canary history as a preimage, not a retest of that flow.
  await claims(db,sid);
  await sql(db,"update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id=$1",[otherSession]);
  await sql(db,packetBind(packet("open")));
  await issue(db,"issue");
  await sql(db,"update private.tn_r4_zero_personal_issue_gate set enabled=false,canary_until=clock_timestamp()-interval '1 second'");
  const standing=n=>readFileSync(new URL("./standing-zero-"+n+".sql",import.meta.url),"utf8");
  const priorCanaryHash=(await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
    where oid='${sig}'::regprocedure) body`)).body;
  await sql(db,bind(standing("install-off")).replace("51d8fe75a68079bb08b5e81f29db38ec6cc66607cf51d5ff29a6e4a9d0fb3470",priorCanaryHash));
  const next=(await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
    where oid='${sig}'::regprocedure) body`)).body;
  const seal=op=>standing(op).replace("a63c39cf45018ec8746d5b97bc11590f16a04ed54caffe61901f35a8ee7838fe",next);
  const read=async()=> (await sql(db,seal("readback"))).find(x=>x.command==="SELECT").rows[0];
  await sql(db,seal("open")); // Existing standing state is an input, not a repeated test.
  await sql(db,`alter table public.tn_member_database_records
    add column source_sheet_id text,add column source_tab_name text,add column source_row_number int,add column payment_record_state text;
    alter table public.tn_audit_logs add column actor_user_id uuid,add column metadata jsonb;
    alter table public.tn_audit_logs enable row level security;
    alter table public.tn_users add column member_kind text default 'journal_only';
    alter table public.tn_member_tickets add foreign key(user_id) references public.tn_users(id);
    alter table public.tn_payments add column user_id uuid references public.tn_users(id);
    create table public.tn_ticket_participants(user_id uuid references public.tn_users(id));
    create table public.tn_group_ticket_links(user_id uuid references public.tn_users(id));
    create table public.tn_group_account_members(user_id uuid references public.tn_users(id));
    create table public.tn_member_membership_records(user_id uuid references public.tn_users(id));`);
  // The fixture has an INSERT INTO audit_logs VALUES(...) only in the scheduler error path;
  // nullable model additions above intentionally mirror the production explicit-column writer.
  const newSql=n=>readFileSync(new URL("./standing-first-zero-"+n+".sql",import.meta.url),"utf8");
  await sql(db,bind(newSql("install-off")).replace("a63c39cf45018ec8746d5b97bc11590f16a04ed54caffe61901f35a8ee7838fe",next));
  const actualNew=(await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
    where oid='${sig}'::regprocedure) body`)).body;
  const freshSql=n=>readFileSync(new URL("./standing-first-coach-"+n+".sql",import.meta.url),"utf8");
  await sql(db,`create table public.tn_coach_roles(id uuid primary key,branch_id uuid,status text,employment_status text,
    archived_at timestamptz,deleted_at timestamptz)`);
  await sql(db,bind(freshSql("install-off")).replace("37361575331703a1c46c277f334d25ab7b2bf78d4cdf5186b6c4d4bc3718d4cf",actualNew)
    .replace("ef7ce6d21b0434e57f51943eeff75290755778d0b1b2258c718b3e05d9bcd247",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
  const finalHash=(await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
    where oid='${sig}'::regprocedure) body`)).body;
  const packetFinal=n=>freshSql(n).replace("68e95b142ffe5748b845879fcaad1db9a6d87c9bd098134a929cd3f6855936c8",finalHash);
  const roster=(await row(db,"select id from public.tn_branches where id<>$1",[g.branch_id])).id;
  const right=randomUUID(),foreign=randomUUID(),archived=randomUUID(),ended=randomUUID();
  await sql(db,`insert into public.tn_coach_roles values
    ($1,$2,'approved','active',null,null),($3,$4,'approved','active',null,null),
    ($5,$2,'approved','active',now(),null),($6,$2,'approved','ended',null,null)`,
    [right,g.branch_id,foreign,roster,archived,ended]);
  await sql(db,"alter table public.tn_coach_roles add column display_name text default 'QA coach'");
  await sql(db,`create function public.tn_save_member_database_record_internal(jsonb,uuid,uuid,uuid,text) returns jsonb
    language sql as $$ select '{}'::jsonb $$;
    create function public.tn_admin_update_member_database_record(j jsonb) returns jsonb language plpgsql as $$declare
    v_id uuid:=gen_random_uuid(); v_user uuid:=(j->>'userId')::uuid; v_branch uuid:=(j->>'branchId')::uuid;
    v_coach uuid:=(j->>'coachRoleId')::uuid; v_actor uuid;
    begin
      select id into strict v_actor from public.tn_users where auth_user_id=auth.uid() and role='admin';
      if j ? 'ticketId' or j ? 'lessonStartDate' or j->>'paymentAmount'<>'0' then raise exception 'not pending payload'; end if;
      insert into public.tn_member_database_records(id,user_id,branch_id,record_status,last_updated_via,created_by_user_id,
        coach_role_id,lesson_schedule_scope,lesson_type,payment_amount)
        values(v_id,v_user,v_branch,'pending','admin_manual',v_actor,v_coach,'mixed','one_on_one',0);
      insert into public.tn_audit_logs(target_id,target_table,action,actor_user_id,metadata)
        values(v_id,'tn_member_database_records','member_database_record_updated',v_actor,'{"ticketId":null}');
      if current_setting('qa.pending_fault',true)='payment' then
        insert into public.tn_payments(id,user_id) values(gen_random_uuid(),v_user);
      end if;
      return jsonb_build_object('recordId',v_id);
    end$$;`);
  const names=await row(db,`select
    (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where
       oid='public.tn_admin_update_member_database_record(jsonb)'::regprocedure) admin,
    (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where
       oid='public.tn_save_member_database_record_internal(jsonb,uuid,uuid,uuid,text)'::regprocedure) inner`);
  const pending=n=>readFileSync(new URL("./pending-member-registration-"+n+".sql",import.meta.url),"utf8");
  await sql(db,pending("install-off")
    .replace("68e95b142ffe5748b845879fcaad1db9a6d87c9bd098134a929cd3f6855936c8",finalHash)
    .replace("e1acdea797c7c7ed090f69d63be2baf38682e4746e5895b02edc8a04affba33b",names.admin)
    .replace("68ac7227023cb56703f853489812d24b1b47af2cbb786677ebe78a0e9c1c30c7",names.inner));
  const rpc2="public.tn_r4_prod_pending_member_registration";
  const body=(await row(db,`select (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where
    oid='${rpc2}(text,uuid,text,uuid,uuid)'::regprocedure) body`)).body;
  const opPending=randomUUID(),missing=randomUUID(),broken=randomUUID();
  const call=(c,a,n=null,k=null,o=null,b=g.branch_id)=>row(c,"select "+rpc2+"($1,$2,$3,$4,$5) r",[a,b,n,k,o]).then(x=>x.r);
  await deny(call(db,"coaches"));
  await sql(db,pending("open").replace("ccf15461df5d824a6c6ba607eb61ba1ef571ead55356087e5591010084db97ce",body));
  assert.deepEqual(await call(db,"coaches"),[{id:right,label:"QA coach"}]);
  await deny(call(db,"save","QA 대상",foreign,missing));
  await deny(call(db,"coaches",null,null,null,roster));
  const outsider=await row(db,"select user_id,id from auth.sessions where user_id<>$1",[g.actor_id]);
  await sql(other,"select set_config('request.jwt.claims',$1,false)",[JSON.stringify({
    sub:outsider.user_id,session_id:outsider.id,role:"authenticated",exp:Math.floor(Date.now()/1000)+600})]);
  await deny(call(other,"coaches"));
  await sql(db,"select set_config('qa.pending_fault','payment',false)");
  await assert.rejects(call(db,"save","QA 오류 대상",right,broken),/r4_pending_registration_footprint/);
  assert.equal(await call(db,"read",null,null,broken),null);
  assert.equal((await row(db,"select count(*)::int n from public.tn_users where name='QA 오류 대상'")).n,0);
  await sql(db,"select set_config('qa.pending_fault','',false)");
  const first=await call(db,"save","QA 대상",right,opPending);
  assert.equal(first.status,"pending");assert.equal(first.hasTicket,false);
  assert.deepEqual(await call(db,"save","QA 대상",right,opPending),first);
  assert.deepEqual(await call(db,"read",null,null,opPending),first);
  await deny(call(db,"save","QA 다른 대상",right,opPending));
  await sql(db,packetFinal("open"));
  assert.equal((await issue(db,"list",first.memberId)).length,1);
  const f=await row(db,`select
    (select count(*)::int from private.tn_r4_pending_registration_receipts) receipts,
    (select count(*)::int from public.tn_member_tickets where user_id=$1) tickets,
    (select count(*)::int from public.tn_payments where user_id=$1) payments`,[first.memberId]);
  assert.deepEqual(f,{receipts:1,tickets:0,payments:0});
  await sql(db,pending("off"));
  await deny(call(db,"coaches"));
  assert.equal((await issue(db,"list",first.memberId)).length,1);
  console.log("PENDING_MEMBER_DB_DELTA_PASS: OFF, correct actor/branch/coach, no-ticket canonical CRM, rollback and idempotent read-back, first-issue read only, independent registration OFF");
};
pg("initdb",["-A","trust","-U","postgres","--locale=C","-E","UTF8","-D",cluster]);
let started=false;
try{
  pg("pg_ctl",["start","-w","-t","12","-D",cluster,"-l",join(cluster,"isolated.log"),"-o",`-h 127.0.0.1 -p ${port}`]);
  started=true;
  const db=client(),other=client();await db.connect();await other.connect();
  try{await run(db,other);}finally{await other.end();await db.end();}
}finally{
  if(started){pg("pg_ctl",["stop","-w","-t","12","-m","fast","-D",cluster]);console.log("ISOLATED_CLUSTER_STOPPED");}
}
