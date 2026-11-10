import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {existsSync,mkdtempSync,readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createServer} from "node:net";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {setTimeout as pause} from "node:timers/promises";
import {bindStanding} from "./bind-standing.mjs";

const bin=process.argv[2];
assert.ok(bin,"PG_BIN_REQUIRED");
const {Client}=createRequire(resolve(process.argv[3],"package.json"))("pg");
const exe=name=>join(bin,name+(process.platform==="win32"?".exe":""));
const dir=mkdtempSync(join(tmpdir(),"tn-standing-isolated-"));
const port=await new Promise((ok,no)=>{
  const s=createServer().once("error",no).listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>ok(p));});
});
const cli=(name,args,input)=>{
  const p=spawnSync(exe(name),args,{input,encoding:"utf8",windowsHide:true,timeout:18000});
  assert.equal(p.status,0,name+": "+p.stderr?.slice(0,400));return p.stdout.trim();
};
const cfg={host:"127.0.0.1",port,user:"postgres",database:"postgres",connectionTimeoutMillis:4000,query_timeout:10000,ssl:false};
let control;
const q=(sql,c=control)=>c.query(sql);
const value=(r,k)=>(Array.isArray(r)?r:[r]).find(x=>Object.hasOwn(x.rows[0]??{},k)).rows[0][k];
const sha=s=>createHash("sha256").update(s).digest("hex");
const [actor,profile,branch,other,otherProfile,otherBranch,first,second,otherSession,draft,registration,late]=Array.from({length:12},randomUUID);
const table="private.tn_r4_prod_member_catalog";
const rpc="public.tn_r4_prod_admin_standing_catalog";
const old="public.tn_r4_prod_member_private_catalog";
const terms={name:"R4 비공개 상시 권한 검증 01234567",sessions:1,minutes:20,days:7,price:0};
const ctx=(id=first,sub=actor,expiry="floor(extract(epoch from clock_timestamp()))::int+300")=>
  `begin;set local statement_timeout='8s';set local role authenticated;
    select set_config('request.jwt.claims',jsonb_build_object('sub','${sub}','session_id','${id}','role','authenticated','exp',${expiry})::text,true) is not null;`;
const read=async(...args)=>value(await q(ctx(...args)+`select ${rpc}('scope') v;commit;`),"v");
const reject=async(sql,marker="r4_member_catalog_denied")=>{
  await assert.rejects(q(sql),new RegExp(marker));await q("rollback");
};
const enable=`update ${table}_standing set enabled=true,actor_id='${actor}',profile_id='${profile}',branch_id='${branch}' where singleton and not enabled and not cancelled;`;
const clear="verify_until=null,verify_session=null,verify_draft=null,verify_registration=null,verify_name=null";
const disable=`update ${table}_standing set enabled=false,cancelled=true,actor_id=null,profile_id=null,branch_id=null,${clear} where singleton;`;
let started=false,holder,offClient,lateClient;
try{
  cli("initdb",["-A","trust","-U","postgres","--locale=C","-E","UTF8","-D",dir]);
  const log=join(dir,"server.log");
  const tcpOnly=process.platform==="win32"?"":" -c unix_socket_directories=";
  try {
    cli("pg_ctl",["start","-w","-t","12","-D",dir,"-l",log,"-o",`-h 127.0.0.1 -p ${port}${tcpOnly}`]);
    started=true;
  } catch (e) {
    if(existsSync(log)) {
      const line=readFileSync(log,"utf8").split(/\r?\n/).find(l=>/\b(FATAL|PANIC)\b/.test(l));
      if(line)console.error("Isolated cluster startup: "+line.split(/\b(?:FATAL|PANIC):\s*/,2)[1]?.slice(0,250));
    }
    throw e;
  }
  control=new Client(cfg);await control.connect();
  await q(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create table public.tn_users(id uuid primary key,auth_user_id uuid,role text,status text);
    create table public.tn_branches(id uuid primary key,name text,status text);
    insert into auth.users(id) values('${actor}'),('${other}');
    insert into auth.sessions values('${first}','${actor}',null),('${second}','${actor}',null),('${otherSession}','${other}',null);
    insert into tn_users values('${profile}','${actor}','admin','active'),('${otherProfile}','${other}','admin','active');
    insert into tn_branches values('${branch}','synthetic A','active'),('${otherBranch}','synthetic B','active');
    create table ${table}_gate(singleton boolean primary key,enabled boolean);
    insert into ${table}_gate values(true,false);
    create table ${table}_grant(enabled boolean);
    create table ${table}_draft(id uuid primary key,branch_id uuid,profile_id uuid,name text,sessions int,minutes int,days int,price bigint,created_at timestamptz default now());
    create table ${table}_registration(id uuid primary key,draft_id uuid unique,branch_id uuid,profile_id uuid,terms jsonb);
    create function ${table}_deadline(d timestamptz) returns void language plpgsql as $$begin
      if d is null or clock_timestamp() >= d then raise insufficient_privilege using message='r4_member_catalog_denied';end if;end$$;
    create function ${old}(text,uuid,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;`);
  const baseRpc=value(await q(`select encode(sha256(convert_to(pg_get_functiondef('${old}(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') v;`),"v");
  const binding={environment:"production",actor:sha(actor),profile:sha(profile),branch:sha(branch),baseRpc};
  await reject(bindStanding({...binding,baseRpc:"0".repeat(64)}),"r4_standing_catalog_preimage_drift");
  await q(bindStanding(binding));
  assert.equal(value(await q(`select (select not enabled and actor_id is null from ${table}_standing)
    and not has_table_privilege('authenticated','${table}_standing','SELECT,UPDATE')
    and not has_function_privilege('anon','${rpc}(text,uuid,jsonb)','EXECUTE')
    and not has_function_privilege('service_role','${rpc}(text,uuid,jsonb)','EXECUTE') v;`),"v"),true);
  await reject(ctx()+`select ${rpc}('scope');`);
  await q(enable);
  assert.equal((await read()).standing,true);
  assert.equal((await read(second)).branchId,branch);
  await reject(ctx(otherSession,other)+`select ${rpc}('scope');`);
  await reject(ctx(otherSession)+`select ${rpc}('scope');`);
  await reject(ctx(first,actor,"1")+`select ${rpc}('scope');`);
  await q(`update ${table}_standing set verify_until=clock_timestamp()-interval '1 second',verify_session='${first}',
    verify_draft='${draft}',verify_registration='${registration}',verify_name='${terms.name}';`);
  await reject(ctx()+`select ${rpc}('scope');`);
  await q(`update ${table}_standing set verify_until=clock_timestamp()+interval '5 minutes';`);
  await reject(ctx(second)+`select ${rpc}('scope');`);
  await reject(ctx()+`select ${rpc}('save','${branch}','${JSON.stringify({operationId:late,...terms})}');`);
  await reject(ctx()+`select ${rpc}('save','${branch}','${JSON.stringify({operationId:draft,...terms,price:1})}');`);
  await reject(ctx()+`select ${rpc}('save','${otherBranch}','{}');`);
  await q(`update tn_users set role='member' where id='${profile}'`);
  await reject(ctx()+`select ${rpc}('scope');`);
  await q(`update tn_users set role='admin' where id='${profile}'`);
  await q(ctx()+`select ${rpc}('save','${branch}','${JSON.stringify({operationId:draft,...terms})}');commit;`);
  await reject(ctx()+`select ${rpc}('register','${branch}','${JSON.stringify({operationId:late,draftId:draft,terms})}');`);
  await q(ctx()+`select ${rpc}('register','${branch}','${JSON.stringify({operationId:registration,draftId:draft,terms})}');commit;`);
  await q(`update ${table}_standing set ${clear};`);
  const row=value(await q(ctx(second)+`select ${rpc}('list','${branch}') v;commit;`),"v")[0];
  assert.deepEqual(row,{draftId:draft,registrationId:registration,terms,public:false,saleEnabled:false,paymentEnabled:false,membershipEnabled:false});

  // Hold a completed write/read transaction open, queue OFF, then prove a later write cannot pass it.
  holder=new Client(cfg);offClient=new Client(cfg);lateClient=new Client(cfg);
  await Promise.all([holder.connect(),offClient.connect(),lateClient.connect()]);
  await q(ctx()+`select ${rpc}('list','${branch}') is not null;`,holder);
  const off=q("set application_name='standing_off';set lock_timeout='6s';"+disable,offClient).then(()=>true,()=>false);
  let waiting=false;
  for(let i=0;i<18&&!waiting;i++){
    waiting=value(await q("select exists(select from pg_stat_activity where application_name='standing_off' and wait_event_type='Lock') v;"),"v");
    if(!waiting)await pause(100);
  }
  assert.equal(waiting,true);
  const lateWrite=q(ctx()+`select ${rpc}('save','${branch}','${JSON.stringify({operationId:late,...terms})}');commit;`,lateClient).then(()=>false,e=>e.message==="r4_member_catalog_denied");
  await q("commit;",holder);
  assert.equal(await off,true);
  assert.equal(await lateWrite,true);
  assert.equal((await q(enable)).rowCount,0);
  await reject(ctx(second)+`select ${rpc}('list','${branch}');`);
  assert.equal(value(await q(`select (select count(*)=1 from ${table}_draft)
    and (select count(*)=1 from ${table}_registration)
    and (select count(*)=0 from ${table}_standing where enabled)
    and (select not enabled from ${table}_gate)
    and (select count(*)=3 from auth.sessions) v;`),"v"),true);
  console.log("STANDING_ISOLATED_PG_PASS: default OFF, second session, wrong admin/branch/role/expiry, private write/read, concurrent OFF, retained records");
} finally {
  await Promise.allSettled([control,holder,offClient,lateClient].filter(Boolean).map(c=>c.end()));
  if(started)cli("pg_ctl",["stop","-w","-t","12","-m","fast","-D",dir]);
}
