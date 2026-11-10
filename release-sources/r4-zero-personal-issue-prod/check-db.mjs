import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {Client}=require(process.env.TN_QA_PG_MODULE||"pg");
const connection=process.env.TN_QA_DB;
const url=new URL(connection);
assert.ok(url.hostname==="127.0.0.1"&&url.pathname==="/tn_zero_personal_ci"&&url.username==="postgres"&&url.port,
  "ISOLATED_DB_ONLY");
const clients=[];
const connect=async()=>{const c=new Client({connectionString:connection,statement_timeout:12000});await c.connect();clients.push(c);return c;};
const db=await connect(), other=await connect(), watch=await connect();
const [admin,adminProfile,adminSession,second,secondProfile,secondSession,branch,crossBranch,
  member,foreignMember,unsafeMember,secondMember,legacyProduct,legacyTicket,foreignTicket,secondTicket,
  draft,reg,paidDraft,paidReg,op1,op2,op3]=Array.from({length:23},randomUUID);
const sql=(c,s,values)=>c.query(s,values);
const row=async(c,s,values)=>(await sql(c,s,values)).rows[0];
const from=n=>readFileSync(new URL("./"+n,import.meta.url),"utf8").replace(/\r\n/g,"\n");
const rpc="public.tn_r4_prod_zero_personal_issue";
const call=(c,action,{b=branch,m=member,r=reg,o=op1}={})=>row(c,
  "select "+rpc+"($1,$2,$3,$4,$5) as result",[action,b,m,action==="list"?null:r,action==="list"?null:o]).then(x=>x.result);
const login=(c,sub=admin,sid=adminSession,exp=Math.floor(Date.now()/1000)+600)=>sql(c,
  "select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub,session_id:sid,role:"authenticated",exp})]);
const rejected=(p,message)=>assert.rejects(p,e=>e.code==="42501"&&(!message||e.message===message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const triggers=`encode(sha256(convert_to(coalesce((select string_agg(
    concat_ws(':',tgrelid::regclass::text,tgname,tgenabled::text,pg_get_triggerdef(oid),pg_get_functiondef(tgfoid)),
    chr(10) order by tgrelid::regclass::text,tgname) from pg_trigger where not tgisinternal and tgrelid in
    ('public.tn_member_tickets'::regclass,'public.tn_membership_products'::regclass,'public.tn_payments'::regclass)),''),'UTF8')),'hex')`;
try{
  assert.equal((await row(db,"select current_database() n,(select count(*)::int from pg_namespace where nspname in ('private','auth')) private")).n,"tn_zero_personal_ci");
  assert.equal((await row(db,"select count(*)::int n from pg_namespace where nspname in ('private','auth')")).n,0);
  await sql(db,`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
    create table public.tn_users(id uuid primary key,auth_user_id uuid,role text,status text,merged_into_user_id uuid,permanently_deleted_at timestamptz);
    create table public.tn_branches(id uuid primary key,name text,status text);
    create table private.tn_r4_prod_member_catalog_standing(singleton boolean primary key,enabled boolean,cancelled boolean,
      actor_id uuid,profile_id uuid,branch_id uuid,verify_until timestamptz);
    create table private.tn_r4_prod_member_catalog_draft(id uuid primary key,branch_id uuid,profile_id uuid,name text,sessions int,minutes int,days int,price bigint);
    create table private.tn_r4_prod_member_catalog_registration(id uuid primary key,draft_id uuid,branch_id uuid,profile_id uuid,terms jsonb,registered_at timestamptz default now());
    create function public.tn_r4_prod_admin_standing_catalog(text,uuid,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
    create table public.tn_membership_products(id uuid primary key,branch_id uuid,name text not null,lesson_minutes integer,
      frequency_per_week integer,total_sessions integer,group_size integer,base_price integer,card_price integer,cash_price integer,
      settlement_base_price integer,validity_days integer,grace_days integer,product_kind text,is_coupon boolean,is_active boolean,
      discount_enabled boolean,coach_discount_allowed boolean,policy_settings jsonb default '{}'::jsonb);
    create table public.tn_member_tickets(id uuid primary key,user_id uuid,product_id uuid references public.tn_membership_products(id),
      branch_id uuid,coach_role_id uuid,total_sessions integer,used_sessions integer,remaining_sessions integer,
      starts_on date,expires_on date,status text,purchased_price integer,settlement_base_price integer,
      source_payment_id uuid,refund_hold_at timestamptz,policy_snapshot jsonb default '{}'::jsonb);
    create table public.tn_member_database_records(id uuid primary key,user_id uuid unique,current_ticket_id uuid,branch_id uuid,record_status text);
    create table public.tn_payments(id uuid primary key,product_id uuid,ticket_id uuid);
    create table public.qa_schedule_log(ticket_id uuid);
    create table public.qa_revision_log(branch_id uuid);
    create function public.qa_lifecycle() returns trigger language plpgsql as $$begin
      update public.tn_member_database_records set current_ticket_id=new.id,branch_id=new.branch_id
      where user_id=new.user_id and (current_ticket_id is null or record_status<>'active'); return new; end$$;
    create trigger legacy_crm after insert on public.tn_member_tickets for each row execute function public.qa_lifecycle();
    create function public.qa_future() returns trigger language plpgsql as $$begin
      if current_setting('tennisnote.skip_future_regular_reconcile',true) is distinct from 'on' then
        insert into public.qa_schedule_log values(new.id); end if;return new;end$$;
    create trigger legacy_future after insert on public.tn_member_tickets for each row execute function public.qa_future();
    create function public.qa_revision() returns trigger language plpgsql as $$begin
      insert into public.qa_revision_log values(new.branch_id);return new;end$$;
    create trigger legacy_revision after insert on public.tn_member_tickets for each row execute function public.qa_revision();
    alter table public.tn_membership_products enable row level security;
    create policy qa_catalog_active on public.tn_membership_products for select to anon,authenticated using(is_active);
    grant select on public.tn_membership_products to anon,authenticated;
    insert into auth.users(id) values('${admin}'),('${second}');
    insert into auth.sessions values('${adminSession}','${admin}',null),('${secondSession}','${second}',null);
    insert into public.tn_users values
      ('${adminProfile}','${admin}','admin','active',null,null),
      ('${secondProfile}','${second}','admin','active',null,null),
      ('${member}',null,'member','active',null,null),('${foreignMember}',null,'member','active',null,null),
      ('${unsafeMember}',null,'member','active',null,null),('${secondMember}',null,'member','active',null,null);
    insert into public.tn_branches values('${branch}','테니스클럽하우스','active'),('${crossBranch}','Other','active');
    insert into private.tn_r4_prod_member_catalog_standing values(true,true,false,'${admin}','${adminProfile}','${branch}',null);
    insert into private.tn_r4_prod_member_catalog_draft values
      ('${draft}','${branch}','${adminProfile}','합성 전용',5,20,35,0),
      ('${paidDraft}','${branch}','${adminProfile}','유료 제외',5,20,35,3000);
    insert into private.tn_r4_prod_member_catalog_registration(id,draft_id,branch_id,profile_id,terms)
    select case when id='${draft}' then '${reg}'::uuid else '${paidReg}'::uuid end,id,branch_id,profile_id,
      jsonb_build_object('name',name,'sessions',sessions,'minutes',minutes,'days',days,'price',price)
    from private.tn_r4_prod_member_catalog_draft;
    insert into public.tn_membership_products(id,branch_id,name,is_active) values('${legacyProduct}','${branch}','기존 상품',true);
    insert into public.tn_member_tickets(id,user_id,product_id,branch_id,status,remaining_sessions) values
      ('${legacyTicket}','${member}','${legacyProduct}','${branch}','active',7),
      ('${foreignTicket}','${foreignMember}','${legacyProduct}','${crossBranch}','active',7),
      ('${secondTicket}','${secondMember}','${legacyProduct}','${branch}','active',7);
    insert into public.tn_member_database_records values
      (gen_random_uuid(),'${member}','${legacyTicket}','${branch}','active'),
      (gen_random_uuid(),'${foreignMember}','${foreignTicket}','${crossBranch}','active'),
      (gen_random_uuid(),'${unsafeMember}',null,'${branch}','historical'),
      (gen_random_uuid(),'${secondMember}','${secondTicket}','${branch}','active');
    insert into public.tn_payments values(gen_random_uuid(),'${legacyProduct}','${legacyTicket}');
    truncate public.qa_schedule_log,public.qa_revision_log;
  `);
  const footprint=()=>row(db,`select
    (select jsonb_agg(to_jsonb(x) order by id) from public.tn_member_database_records x) crm,
    (select jsonb_agg(to_jsonb(x) order by id) from public.tn_member_tickets x where product_id='${legacyProduct}') existing,
    (select jsonb_agg(to_jsonb(x) order by id) from public.tn_payments x) payments,
    (select jsonb_agg(to_jsonb(x) order by id) from auth.sessions x) sessions,
    (select jsonb_agg(to_jsonb(x) order by id) from private.tn_r4_prod_member_catalog_registration x) registrations,
    (select count(*)::int from public.qa_schedule_log) schedules`);
  const baseline=await footprint();
  await sql(db,"set search_path=pg_catalog");
  const seal=await row(db,`select ${triggers} t,encode(sha256(convert_to(pg_get_functiondef(
    'public.tn_r4_prod_admin_standing_catalog(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') s`);
  const original=from("install-off.sql");
  const st="e76652c1e8d06edfc790e5a1552691369fb2453ad5734b8b8da26d05568e52cf";
  const tr="420c228b364835151a2e09a288a44c4cd146fa1e795122ab6d130ae922537dba";
  assert.equal(original.split(st).length,2);assert.equal(original.split(tr).length,3);
  await assert.rejects(sql(db,original),{message:"r4_zero_issue_preimage_drift"});
  await sql(db,"rollback");
  await sql(db,original.replace(st,seal.s).replaceAll(tr,seal.t));
  assert.deepEqual(await footprint(),baseline);
  await login(db);await login(other);
  await rejected(call(db,"list"));
  const can=await row(db,`select has_function_privilege('anon','${rpc}(text,uuid,uuid,uuid,uuid)','execute') anon,
    has_function_privilege('service_role','${rpc}(text,uuid,uuid,uuid,uuid)','execute') service,
    has_table_privilege('authenticated','private.tn_r4_zero_personal_issue_receipts','insert') direct`);
  assert.deepEqual(can,{anon:false,service:false,direct:false});
  await sql(db,"update private.tn_r4_zero_personal_issue_gate set enabled=true");
  await sql(db,"set role authenticated");
  assert.deepEqual((await call(db,"list")).map(x=>x.id),[reg]);
  assert.equal(await call(db,"read"),null);
  await rejected(call(db,"list",{b:crossBranch}));
  await rejected(call(db,"list",{m:foreignMember}),"r4_zero_personal_member_scope");
  await rejected(call(db,"issue",{m:unsafeMember}),"r4_zero_personal_member_scope");
  await rejected(call(db,"issue",{r:paidReg}),"r4_zero_personal_product_scope");
  await login(db,second,secondSession);await rejected(call(db,"issue"));
  await login(db,admin,secondSession);await rejected(call(db,"issue"));
  await login(db,admin,adminSession,1);await rejected(call(db,"issue"));
  await login(db);
  await sql(db,"begin");
  const result=await call(db,"issue");
  let done=false;
  await sql(other,"set role authenticated");
  const concurrent=call(other,"issue",{o:op2}).finally(()=>{done=true;});
  for(let i=0;i<16;i++){
    const x=await row(watch,"select wait_event_type from pg_stat_activity where pid=$1",[other.processID]);
    if(x?.wait_event_type==="Lock")break;
    if(i===15)throw Error("SECOND_CONNECTION_DID_NOT_WAIT");
    await sleep(25);
  }
  assert.equal(done,false);
  await sql(db,"commit");
  assert.deepEqual(await concurrent,result);
  assert.equal(result.price,0);assert.equal(result.remaining,5);assert.equal(result.payment,false);
  assert.deepEqual(await call(db,"read",{o:op2}),result);
  await rejected(call(db,"issue",{m:secondMember}),"r4_zero_personal_operation_conflict");
  await rejected(call(db,"issue",{m:secondMember,o:op2}),"r4_zero_personal_operation_conflict");
  await sql(db,"reset role");
  const ref=await row(db,"select product_id from public.tn_member_tickets where id=$1",[result.ticketId]);
  assert.ok(ref.product_id);
  await rejected(sql(db,"update public.tn_membership_products set is_active=true where id=$1",[ref.product_id]));
  await rejected(sql(db,"insert into public.tn_payments values(gen_random_uuid(),$1,null)",[ref.product_id]));
  await rejected(sql(db,"insert into public.tn_payments values(gen_random_uuid(),null,$1)",[result.ticketId]));
  await rejected(sql(db,"update public.tn_member_tickets set purchased_price=1 where id=$1",[result.ticketId]));
  await rejected(sql(db,"insert into public.tn_member_tickets(id,product_id,user_id) values(gen_random_uuid(),$1,$2)",[ref.product_id,member]));
  await sql(db,"set role anon");
  assert.equal((await row(db,"select count(*)::int n from public.tn_membership_products where id=$1",[ref.product_id])).n,0);
  await sql(db,"reset role");
  await sql(db,"update public.tn_member_tickets set remaining_sessions=4,used_sessions=1 where id=$1",[result.ticketId]);
  assert.equal((await call(db,"read")).remaining,4);
  await sql(db,"alter table public.tn_member_tickets disable trigger legacy_future");
  await assert.rejects(call(db,"issue",{m:secondMember,o:op3}),{message:"r4_zero_issue_preimage_drift"});
  await sql(db,"alter table public.tn_member_tickets enable trigger legacy_future");
  await sql(db,"begin");
  await call(db,"read");
  await sql(other,"reset role");
  let offDone=false;
  const stop=sql(other,from("off.sql")).finally(()=>{offDone=true;});
  for(let i=0;i<16;i++){
    const x=await row(watch,"select wait_event_type from pg_stat_activity where pid=$1",[other.processID]);
    if(x?.wait_event_type==="Lock")break;
    if(i===15)throw Error("OFF_DID_NOT_WAIT_FOR_GATE");
    await sleep(25);
  }
  assert.equal(offDone,false);
  await sql(db,"commit");await stop;
  await rejected(call(db,"list"));await rejected(call(db,"read"));await rejected(call(db,"issue",{m:secondMember,o:op3}));
  assert.deepEqual(await footprint(),baseline);
  const tail=await row(db,`select (select count(*)::int from private.tn_r4_zero_personal_issue_receipts) receipts,
    (select count(*)::int from private.tn_r4_zero_personal_issue_requests) bound_requests,
    (select count(*)::int from public.tn_member_tickets where policy_snapshot ? 'r4ProdZeroPersonal') tickets,
    (select count(*)::int from public.qa_revision_log where branch_id='${branch}') revisions,
    (select count(*)::int from private.tn_r4_zero_personal_issue_gate where enabled) enabled`);
  assert.deepEqual(tail,{receipts:1,bound_requests:2,tickets:1,revisions:1,enabled:0});
  // Existing authorized correction deletes the ticket even when issuance is OFF.
  await sql(db,"delete from public.tn_member_tickets where id=$1",[result.ticketId]);
  await rejected(sql(db,"insert into public.tn_member_tickets(id,product_id,user_id,branch_id,policy_snapshot) values($1,$2,$3,$4,jsonb_build_object('r4ProdZeroPersonal',$5::uuid))",
    [result.ticketId,ref.product_id,member,branch,reg]));
  await rejected(sql(db,"insert into public.tn_member_tickets(id,product_id,user_id,branch_id) values($1,$2,$3,$4)",
    [result.ticketId,legacyProduct,secondMember,branch]));
  await rejected(sql(db,"update public.tn_member_tickets set id=$1 where id=$2",[result.ticketId,secondTicket]));
  await sql(db,"update private.tn_r4_zero_personal_issue_gate set enabled=true");
  const tombstone=await call(db,"read");
  assert.deepEqual(tombstone,{registrationId:reg,ticketId:result.ticketId,price:0,removed:true,public:false,payment:false});
  assert.deepEqual(await call(db,"issue",{o:op3}),tombstone);
  await rejected(call(db,"issue",{m:secondMember,o:op3}),"r4_zero_personal_operation_conflict");
  await sql(db,from("off.sql"));
  const preserved=await row(db,`select (select count(*)::int from private.tn_r4_zero_personal_issue_receipts where removed_at is not null) tombstones,
    (select count(*)::int from private.tn_r4_zero_personal_issue_requests) bound_requests,
    (select count(*)::int from public.tn_member_tickets where policy_snapshot ? 'r4ProdZeroPersonal') tickets`);
  assert.deepEqual(preserved,{tombstones:1,bound_requests:3,tickets:0});
  assert.deepEqual(await footprint(),baseline);
  console.log("PG17_DELTA_PASS: scoped access, request binding, atomic race, no paid route, correction and no reissue, drift denial, readback, OFF lock");
}finally{await Promise.all(clients.map(c=>c.end()));}
