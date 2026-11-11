// Runs the exact candidate BODY in a disposable local PG17 fixture. No remote client.
// The direct-execution stop marker is tested separately, not removed from the file.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {join} from 'node:path';
const bundle=join(process.env.TEMP,'tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f');
const {Client}=createRequire(join(bundle,'driver','package.json'))('pg');
const bin=join(bundle,'package','native','bin'),dir=mkdtempSync(join(process.env.TEMP,'tn-first-issue-body-'));
const port=await new Promise((resolve,reject)=>{const s=createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{let p=s.address().port;s.close(()=>resolve(p));});});
function run(name,args){const r=spawnSync(join(bin,name+'.exe'),args,{cwd:dir,windowsHide:true,timeout:25000,encoding:'utf8'});assert.equal(r.status,0,name+' failed');}
const db=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',statement_timeout:6000});
const source=readFileSync(new URL('./issue-body.sql',import.meta.url),'utf8'),marker='-- BEGIN ISOLATED TEST BODY';
assert.equal(source.split(marker).length,2);assert.ok(source.includes("raise exception 'r4_local_candidate_never_install_directly'"));
const body=source.split(marker)[1];
const ids=Object.fromEntries(['branch','branch2','owner','auth','session','session2','member','product','coach','operation'].map(k=>[k,randomUUID()]));
let started=false,connected=false;
try{
  run('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',dir,'-l',join(dir,'pg.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  await db.connect();connected=true;
  await db.query(`create role anon; create role authenticated; create role service_role; create schema private; create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('qa.jwt',true),''),'{}')::jsonb$$;
    create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create table public.tn_users(id uuid primary key,auth_user_id uuid,role text,status text,member_kind text,phone text,merged_into_user_id uuid,permanently_deleted_at timestamptz);
    create table public.tn_membership_products(id uuid primary key,branch_id uuid,name text,lesson_minutes int,total_sessions int,validity_days int,is_active boolean,is_coupon boolean,group_size int,product_kind text,base_price int,card_price int,cash_price int,settlement_base_price int);
    create table public.tn_coach_roles(id uuid primary key,branch_id uuid,status text,employment_status text,deleted_at timestamptz,archived_at timestamptz);
    create table public.tn_member_database_records(user_id uuid primary key,branch_id uuid,coach_role_id uuid,record_status text);
    create table public.tn_member_tickets(id uuid primary key default gen_random_uuid(),user_id uuid,product_id uuid,branch_id uuid,coach_role_id uuid,status text,total_sessions int,used_sessions int,remaining_sessions int,starts_on date,expires_on date,purchased_price int,settlement_base_price int,source_payment_id uuid,policy_snapshot jsonb);
    create table public.tn_ticket_participants(ticket_id uuid,user_id uuid,participant_order int);
    create table public.tn_member_membership_records(user_id uuid,ticket_id uuid,branch_id uuid,coach_role_id uuid,record_status text,lesson_type text,lesson_minutes int,lesson_start_on date,total_sessions int,used_sessions int,remaining_sessions int,payment_amount int,last_updated_via text,created_by_user_id uuid);
    create table public.tn_payments(id uuid,user_id uuid);
    create table public.tn_audit_logs(actor_user_id uuid,action text,target_table text,target_id uuid,metadata jsonb);
    create function private.tn_r4_prod_selfserve_lock_owner(b uuid) returns uuid language sql as $$select nullif(current_setting('qa.owner',true),'')::uuid$$;`);
  await assert.rejects(db.query(source),e=>e.message.includes('r4_local_candidate_never_install_directly'));
  await db.query('rollback');
  await db.query(body);
  const privilege=(await db.query("select has_function_privilege('anon','public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)','EXECUTE') anon,has_function_privilege('service_role','public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)','EXECUTE') service,has_function_privilege('authenticated','public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)','EXECUTE') authenticated")).rows[0];
  assert.deepEqual(privilege,{anon:false,service:false,authenticated:true});
  const q=(sql,args=[])=>db.query(sql,args);
  await q('insert into auth.users(id) values($1)',[ids.auth]);
  await q("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '10 minutes')",[ids.session,ids.auth]);
  await q("insert into public.tn_users(id,auth_user_id,role,status) values($1,$2,'member','active')",[ids.owner,ids.auth]);
  await q("insert into public.tn_users(id,role,status,member_kind) values($1,'member','active','journal_only')",[ids.member]);
  await q("insert into public.tn_coach_roles(id,branch_id,status,employment_status) values($1,$2,'approved','active')",[ids.coach,ids.branch]);
  await q("insert into public.tn_member_database_records values($1,$2,$3,'pending')",[ids.member,ids.branch,ids.coach]);
  await q("insert into public.tn_membership_products values($1,$2,'Synthetic',30,7,43,false,false,1,'regular',0,0,0,0)",[ids.product,ids.branch]);
  const jwt=JSON.stringify({role:'authenticated',session_id:ids.session,exp:Math.floor(Date.now()/1000)+600});
  await q("select set_config('qa.uid',$1,false),set_config('qa.owner',$2,false),set_config('qa.jwt',$3,false)",[ids.auth,ids.owner,jwt]);
  const args=[ids.branch,ids.member,ids.product,ids.coach,ids.operation];
  const call=async a=>(await q('select public.tn_r4_first_zero_issue($1,$2,$3,$4,$5) as result',a||args)).rows[0].result;
  await assert.rejects(call(),{code:'42501'});
  await q("insert into private.tn_r4_first_issue_scope(branch_id,owner_id,auth_id,session_id,member_id,product_id,coach_id,operation_id,valid_until) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+interval '2 minutes')",[ids.branch,ids.owner,ids.auth,ids.session,ids.member,ids.product,ids.coach,ids.operation]);
  await assert.rejects(call(),{code:'42501'});
  await q('update private.tn_r4_first_issue_scope set enabled=true; update private.tn_r4_first_issue_control set enabled=true');
  await assert.rejects(call([ids.branch2,...args.slice(1)]),{code:'42501'});
  for(const pos of [1,2,3,4]) {const mismatch=[...args];mismatch[pos]=randomUUID();await assert.rejects(call(mismatch),{code:'42501'});}
  await q("select set_config('qa.jwt',$1,false)",[JSON.stringify({role:'anon',session_id:ids.session,exp:Math.floor(Date.now()/1000)+600})]);
  await assert.rejects(call(),{code:'42501'});
  await q("select set_config('qa.jwt',$1,false)",[JSON.stringify({role:'authenticated',session_id:ids.session2,exp:Math.floor(Date.now()/1000)+600})]);
  await assert.rejects(call(),{code:'42501'});
  await q("select set_config('qa.jwt',$1,false)",[jwt]);
  await q("update private.tn_r4_first_issue_scope set valid_until=clock_timestamp()-interval '1 second'");
  await assert.rejects(call(),{code:'42501'});
  await q("update private.tn_r4_first_issue_scope set valid_until=clock_timestamp()+interval '2 minutes'");
  await q("update public.tn_coach_roles set status='pending'");await assert.rejects(call(),{code:'42501'});await q("update public.tn_coach_roles set status='approved'");
  await q('update public.tn_membership_products set base_price=1');await assert.rejects(call(),{code:'42501'});await q('update public.tn_membership_products set base_price=0');
  await q('insert into public.tn_payments(id,user_id) values($1,$2)',[randomUUID(),ids.member]);await assert.rejects(call(),{code:'42501'});await q('delete from public.tn_payments');
  const parallel=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',statement_timeout:6000});
  await parallel.connect();
  let first,again;
  try {
    await parallel.query("select set_config('qa.uid',$1,false),set_config('qa.owner',$2,false),set_config('qa.jwt',$3,false)",[ids.auth,ids.owner,jwt]);
    [first,again]=await Promise.all([call(),parallel.query('select public.tn_r4_first_zero_issue($1,$2,$3,$4,$5) as result',args).then(r=>r.rows[0].result)]);
  } finally {await parallel.end();}
  assert.deepEqual(first,again);assert.deepEqual(first,await call());assert.equal(first.total,7);assert.equal(first.remaining,7);assert.equal(first.payment,false);assert.equal(first.coachId,ids.coach);
  const counts=(await q('select (select count(*) from public.tn_member_tickets)::int tickets,(select count(*) from public.tn_payments)::int payments,(select count(*) from public.tn_audit_logs)::int audits')).rows[0];
  assert.deepEqual(counts,{tickets:1,payments:0,audits:1});
  await q('update private.tn_r4_first_issue_control set enabled=false');await assert.rejects(call(),{code:'42501'});
  console.log(JSON.stringify({defaultOff:'PASS',scopeOff:'PASS',mismatchedTargets:'PASS',anon:'PASS',wrongSession:'PASS',expired:'PASS',unapprovedCoach:'PASS',paidProduct:'PASS',priorPayment:'PASS',concurrentCreateReplay:'PASS',afterOff:'PASS',acl:'PASS',tickets:1,payments:0,audits:1,db:'isolated',productionPreimage:'NOT_TESTED'}));
} finally {if(connected)await db.end();if(started)run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}
