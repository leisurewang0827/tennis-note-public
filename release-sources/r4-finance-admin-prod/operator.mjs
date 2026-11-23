// 같은 SHA의 실제 보호 승인 후에만 실행하는 로컬 DB 운영자. 관리 자격증명은 CI로 보내지 않는다.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';
import{spawnSync,execFileSync}from'node:child_process';
import{fileURLToPath}from'node:url';
import{resolve,join}from'node:path';
import{createHash}from'node:crypto';
import{validateRun,validateReview,repo,branch,reviewerId,contextName,offDescription}from'./gate.mjs';
const here=new URL('./',import.meta.url),m=JSON.parse(readFileSync(new URL('manifest.json',here)));
const hash=x=>createHash('sha256').update(x).digest('hex'),q=x=>"'"+String(x).replaceAll("'","''")+"'";
const gh=(p,b)=>{const r=spawnSync('C:/Program Files/GitHub CLI/gh.exe',['api',p,...(b?['--method','POST','--input','-']:[])],{encoding:'utf8',windowsHide:true,maxBuffer:4e6,input:b?JSON.stringify(b):undefined});assert.equal(r.status,0,'GitHub outcome unknown');return JSON.parse(r.stdout);};
const db=sql=>{const r=spawnSync('C:/Codex/tennisnote-dev-20260815/.codex-temp/supabase-cli/supabase.exe',['db','query','--yes','--linked','--project-ref','cnympiwrwgouuvhaivbc','--output','json','--',sql],{encoding:'utf8',windowsHide:true,timeout:35000,maxBuffer:3e6});assert.equal(r.status,0,'DB outcome unknown; query state separately, never reinstall blindly');return JSON.parse(r.stdout).rows;};
const ro=s=>db("begin read only;set local statement_timeout='8s';"+s+';rollback;');
const target=`encode(sha256(convert_to(u.id::text,'UTF8')),'hex')=${q(m.target.profileHash)} and encode(sha256(convert_to(u.auth_user_id::text,'UTF8')),'hex')=${q(m.target.authHash)}`;
function identity(){const rows=ro(`select u.role,u.status,(u.merged_into_user_id is null and u.permanently_deleted_at is null) intact,
 md5(to_jsonb(u)::text) profile_fingerprint,(select count(*)::int from auth.sessions s where s.user_id=u.auth_user_id) sessions,
 (select md5(coalesce(jsonb_agg(s.id order by s.id)::text,'[]')) from auth.sessions s where s.user_id=u.auth_user_id) session_fingerprint
 from public.tn_users u where ${target}`);assert.equal(rows.length,1);assert.equal(rows[0].role,'admin');assert.equal(rows[0].status,'active');assert.equal(rows[0].intact,true);return rows[0];}
function post(){return ro(`select jsonb_build_object(
 'opened',(select count(*)::int from private.tn_r4_finance_owner_control where paid_enabled or terms_enabled or history_enabled),
 'grants',(select count(*)::int from private.tn_r4_finance_admin_grants where enabled),
 'admin_rows',(select count(*)::int from private.tn_r4_finance_platform_admins),
 'active_admins',(select count(*)::int from private.tn_r4_finance_platform_admins where active),
 'matched_admins',(select count(*)::int from private.tn_r4_finance_platform_admins a join public.tn_users u on u.id=a.user_id where a.active and ${target}),
 'backup',(select count(*)::int from private.tn_r4_finance_admin_backup),
 'exact_helper',(select installed_hash=encode(sha256(convert_to(pg_get_functiondef('private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure),'UTF8')),'hex') and encode(sha256(convert_to(original_definition,'UTF8')),'hex')=${q(m.guardHash)} from private.tn_r4_finance_admin_backup),
 'metadata_exact',(select b.original_metadata=jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef) from private.tn_r4_finance_admin_backup b cross join pg_proc p where p.oid='private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure),
 'rls',(select count(*)::int from pg_class c where c.oid in ('private.tn_r4_finance_platform_admins'::regclass,'private.tn_r4_finance_admin_grants'::regclass,'private.tn_r4_finance_admin_audit'::regclass,'private.tn_r4_finance_admin_backup'::regclass) and c.relrowsecurity),
 'direct_table_access',(select bool_or(has_table_privilege(r,t,'select,insert,update,delete')) from unnest(ARRAY['anon','authenticated','service_role']) r cross join unnest(ARRAY['private.tn_r4_finance_platform_admins','private.tn_r4_finance_admin_grants','private.tn_r4_finance_admin_audit','private.tn_r4_finance_admin_backup']) t),
 'anonymous_rpc',has_function_privilege('anon','public.tn_r4_finance_admin_state(uuid)','execute') or has_function_privilege('anon','public.tn_r4_finance_admin_set(uuid,uuid,boolean,bigint,uuid)','execute'),
 'authenticated_rpc',has_function_privilege('authenticated','public.tn_r4_finance_admin_state(uuid)','execute') and has_function_privilege('authenticated','public.tn_r4_finance_admin_set(uuid,uuid,boolean,bigint,uuid)','execute'),
 'definitions',(select jsonb_object_agg(x,encode(sha256(convert_to(pg_get_functiondef(x::regprocedure),'UTF8')),'hex')) from unnest(ARRAY[${Object.keys(m.protectedFunctions).map(q).join(',')}]) x)) state`)[0].state;}
function check(s,admins){assert.equal(s.opened,0);assert.equal(s.grants,0);assert.equal(s.admin_rows,admins);assert.equal(s.active_admins,admins);assert.equal(s.matched_admins,admins);assert.equal(s.backup,1);assert.equal(s.exact_helper,true);assert.equal(s.metadata_exact,true);assert.equal(s.rls,4);assert.equal(s.direct_table_access,false);assert.equal(s.anonymous_rpc,false);assert.equal(s.authenticated_rpc,true);for(const[k,v]of Object.entries(m.protectedFunctions))assert.equal(s.definitions[k],v,k);}
function bind(runId,sha){const r=gh('repos/'+repo+'/actions/runs/'+runId);validateRun(r,sha,runId);assert.equal(gh('repos/'+repo+'/git/ref/heads/'+branch).object.sha,sha);assert.equal(gh('user').id,reviewerId);validateReview(gh('repos/'+repo+'/actions/runs/'+runId+'/approvals'),sha);const jobs=gh('repos/'+repo+'/actions/runs/'+runId+'/jobs?per_page=100').jobs;for(const name of ['verify','admit'])assert.equal(jobs.filter(x=>x.name===name&&x.conclusion==='success').length,1);return r;}
function payload(sha){for(const[p,h]of Object.entries(m.payload))assert.equal(hash(readFileSync(new URL(p,here))),h);const remote=gh('repos/'+repo+'/contents/release-sources/r4-finance-admin-prod?ref='+sha);assert.deepEqual(remote.map(x=>x.name).sort(),[...Object.keys(m.payload),'manifest.json'].sort());for(const x of remote){const b=readFileSync(new URL(x.name,here));assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),x.sha);}}
async function main(){
 const[mode,run,sha,out]=process.argv.slice(2);assert.match(run||'',/^\d+$/);assert.match(sha||'',/^[a-f0-9]{40}$/);assert(out&&resolve(out).startsWith('C:\\Users\\user\\Documents\\ChatGPT\\테니스노트\\outputs\\'));
 payload(sha);bind(run,sha);mkdirSync(out,{recursive:true});const settings=`select set_config('tennisnote.install_target','cnympiwrwgouuvhaivbc',false);`;
 if(mode==='install'){
  assert(!existsSync(join(out,'INSTALL-ATTEMPT.json')),'Reconcile prior installation attempt');const before=identity();
  const state=ro(`select encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') hash,
    jsonb_build_object('oid',p.oid::text,'owner',p.proowner::text,'acl',p.proacl::text,'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef) meta,
    to_regclass('private.tn_r4_finance_platform_admins')::text platform,
    (select count(*)::int from private.tn_r4_finance_owner_control where paid_enabled or terms_enabled or history_enabled) opened from pg_proc p where p.oid='private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure`)[0];
  assert.equal(state.hash,m.guardHash);assert.deepEqual(state.meta,m.guardMetadata);assert.equal(state.platform,null);assert.equal(state.opened,0);
  writeFileSync(join(out,'INSTALL-ATTEMPT.json'),JSON.stringify({source:sha,run,sql:m.payload['admin-prod-install.sql'],before})+'\n',{flag:'wx'});
  let responseKnown=true;try{db(settings+readFileSync(new URL('admin-prod-install.sql',here),'utf8'));}catch{responseKnown=false;}
  check(post(),0);assert.deepEqual(identity(),before);
  writeFileSync(join(out,'INSTALLED-OFF.json'),JSON.stringify({source:sha,run,responseKnown,opened:0,activeAdmins:0,separateRead:true})+'\n',{flag:'wx'});
  bind(run,sha);
  writeFileSync(join(out,'DESIGNATION-ATTEMPT.json'),JSON.stringify({source:sha,target:m.target})+'\n',{flag:'wx'});
  db(settings+`select set_config('tennisnote.platform_profile_hash',${q(m.target.profileHash)},false),set_config('tennisnote.platform_auth_hash',${q(m.target.authHash)},false);`+readFileSync(new URL('admin-prod-designate.sql',here),'utf8'));
  const after=post();check(after,1);assert.deepEqual(identity(),before);bind(run,sha);
  writeFileSync(join(out,'DESIGNATED-OFF-READ.json'),JSON.stringify({source:sha,run,target:m.target,after,identityAndSessionsUnchanged:true})+'\n',{flag:'wx'});
  const status=gh('repos/'+repo+'/statuses/'+sha,{state:'success',context:contextName,description:offDescription(run,m.payload['admin-prod-install.sql'])});assert.equal(status.creator.id,reviewerId);
  console.log(JSON.stringify({installed:true,designatedAdmins:1,opened:0,existingSessions:before.sessions,preserved:true,offAttestation:true}));return;
 }
 if(mode==='read'||mode==='attest'){check(post(),1);const current=identity();
  if(mode==='attest'){writeFileSync(join(out,'UI-ONLY-OFF-READ.json'),JSON.stringify({source:sha,run,opened:0,designatedAdmins:1,identity:current,noDbWrites:true})+'\n',{flag:'wx'});gh('repos/'+repo+'/statuses/'+sha,{state:'success',context:contextName,description:offDescription(run,m.payload['admin-prod-install.sql'])});}
  console.log(JSON.stringify({opened:0,designatedAdmins:1,identity:current,noDbWrites:true}));return;}
 if(mode==='rollback'){db(settings+readFileSync(new URL('admin-prod-off.sql',here),'utf8'));db(settings+readFileSync(new URL('admin-prod-rollback.sql',here),'utf8'));console.log('NEW_MANAGEMENT_OFF_AND_EXACT_HELPER_RESTORED');return;}
 throw Error('mode denied');
}
main().catch(e=>{console.error('PLATFORM_OPERATOR_HOLD '+String(e.message).slice(0,200));process.exitCode=1;});
