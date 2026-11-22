// Explicit local DB operation after the same run's protected read-only admission.
// Uses the existing logged-in Supabase CLI. Never uploads a DB management credential to GitHub.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {hash} from './compose-web.mjs';
import{repo,branch,validateRun,validateReview,contextName,offDescription,reviewerId}from'./gate.mjs';
const here=new URL('./',import.meta.url),m=JSON.parse(readFileSync(new URL('manifest.json',here),'utf8'));
const gh='C:/Program Files/GitHub CLI/gh.exe';
const cli='C:/Codex/tennisnote-dev-20260815/.codex-temp/supabase-cli/supabase.exe';
const ref='cnympiwrwgouuvhaivbc',q=x=>"'"+String(x).replaceAll("'","''")+"'";
const api=path=>JSON.parse(execFileSync(gh,['api',path],{encoding:'utf8',windowsHide:true,maxBuffer:2e6}));
const base='repos/'+repo;
const query=(sql,file=false)=>{
 const args=['db','query','--yes','--linked','--project-ref',ref,'--output','json',...(file?['--file',sql]:['--',sql])];
 const r=spawnSync(cli,args,{encoding:'utf8',windowsHide:true,maxBuffer:2e6,timeout:35000});
 if(r.status!==0)throw Error('DB_OPERATION_UNCERTAIN_NO_RETRY');
 const v=JSON.parse(r.stdout);const rows=Array.isArray(v)?v:v.rows;assert(Array.isArray(rows));return rows;
};
const ro=sql=>query("begin read only;set local statement_timeout='8s';"+sql+";rollback;");
function payload(sha){
 for(const [p,h]of Object.entries(m.payload))assert.equal(hash(readFileSync(new URL(p,here))),h,p);
 const prefix='release-sources/r4-finance-owner-prod/';
 const remote=api(base+'/contents/'+prefix+'?ref='+sha);
 assert(Array.isArray(remote));
 assert.deepEqual(remote.map(x=>x.name).sort(),[...Object.keys(m.payload),'manifest.json'].sort());
 for(const x of remote){
  assert.equal(x.type,'file');const bytes=readFileSync(new URL(x.name,here));
  const blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(blob,x.sha,'LOCAL_FILE_NOT_THE_REVIEWED_COMMIT '+x.name);
 }
}
function postState(){
 const s=query(fileURLToPath(new URL('owner-prod-postread.sql',here)),true)[0].state;
 for(const k of ['effective_access','control_rows','old_paid_access','old_terms_access','old_history_access'])assert.equal(s[k],0,k);
 assert.equal(s.backup_rows,6);assert.equal(s.exact_installed,6);assert.equal(s.private_tables_protected,2);
 for(const k of ['assert_direct','probe_direct','roster_anonymous'])assert.equal(s[k],false,k);
 assert.equal(s.roster_authenticated,true);
 for(const [sig,h]of Object.entries(m.protectedFunctions))assert.equal(s.definitions[sig],h,sig);
 return s;
}
function bound(runId,sha,installOnly=true){
 const r=api(base+'/actions/runs/'+runId);validateRun(r,sha,runId);
 assert.equal(api(base+'/git/ref/heads/'+branch).object.sha,sha,'CANDIDATE_MOVED');
 assert.equal(api('user').id,reviewerId);
 validateReview(api(base+'/actions/runs/'+runId+'/approvals'),sha);
 const jobs=api(base+'/actions/runs/'+runId+'/jobs?per_page=100');
 for(const name of ['verify','admit'])assert.equal(jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length,1,name);
 if(installOnly)assert(!jobs.jobs.some(j=>j.name==='publish'&&j.conclusion==='success'),'PUBLICATION_PRECEDED_INSTALLATION');
 return r;
}
export function preState(){
 const signs=m.catalog.map(x=>q(x.signature)).join(',');
 const s=ro(`select jsonb_build_object('new_control',to_regclass('private.tn_r4_finance_owner_control') is not null,
 'new_backup',to_regclass('private.tn_r4_finance_owner_backup') is not null,
 'new_roster',to_regprocedure('public.tn_r4_branch_finance_coaches(uuid)') is not null,
 'paid',(select count(*) from private.tn_r4_branch_paid_access where expires_at>clock_timestamp()),
 'terms',(select count(*) from private.tn_r4_branch_finance_term_access where expires_at>clock_timestamp()),
 'history',(select count(*) from private.tn_r4_branch_paid_history_access where expires_at>clock_timestamp()),
 'catalog',(select jsonb_agg(jsonb_build_object('signature',case when n.nspname='public' then 'public.' else '' end||p.oid::regprocedure::text,
 'oid',p.oid::text,'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 'ownerOid',p.proowner::text,'acl',p.proacl::text,'config',p.proconfig,'volatility',p.provolatile))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in (select x::regprocedure from unnest(ARRAY[${signs}]) x))) as state`)[0].state;
 for(const k of ['new_control','new_backup','new_roster'])assert.equal(s[k],false,k);
 for(const k of ['paid','terms','history'])assert.equal(s[k],0,k);
 assert.equal(s.catalog.length,6);
 for(const pin of m.catalog){const x=s.catalog.find(x=>x.signature===pin.signature);assert(x,pin.signature);
  for(const k of ['oid','sha256','ownerOid','acl','config','volatility'])assert.deepEqual(x[k],pin[k],pin.signature+' '+k);}
 return {catalogPins:6,effectiveAccess:0,newObjectsAbsent:true};
}
async function main(){
 const [mode,runId,sha,out]=process.argv.slice(2);
 assert.equal(ref,m.project);assert.match(runId||'',/^\d+$/);assert.match(sha||'',/^[a-f0-9]{40}$/);
 assert(out&&resolve(out).startsWith('C:\\Users\\user\\Documents\\ChatGPT\\테니스노트\\outputs\\'));
 payload(sha);const run=bound(runId,sha,mode==='install');mkdirSync(out,{recursive:true});
 const record={source:sha,run:runId,project:ref,sqlSha256:m.payload['owner-prod-install.sql']};
 if(mode==='install'){
  record.before=preState();record.installAttempted=true;
  writeFileSync(join(out,'PROD-INSTALL-JOURNAL.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  // Exactly one installation request. On lost response, only separate state reconciliation is permitted.
  let responseKnown=true;try{query(fileURLToPath(new URL('owner-prod-install.sql',here)),true)}catch{responseKnown=false;}
  record.responseKnown=responseKnown;
  record.post=postState();record.status='PROD_INSTALLED_DEFAULT_OFF_SEPARATE_READ_PASS';
  writeFileSync(join(out,'PROD-INSTALL-AND-OFF.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  bound(runId,sha);
  const description=offDescription(runId,m.payload['owner-prod-install.sql']);
  const value=JSON.parse(execFileSync(gh,['api','--method','POST',base+'/statuses/'+sha,'-f','state=success','-f','context='+contextName,'-f','description='+description],{encoding:'utf8',windowsHide:true}));
  assert.equal(value.creator.id,reviewerId);assert.equal(value.description,description);assert.equal(value.state,'success');
  console.log(JSON.stringify({status:record.status,responseKnown,effectiveAccess:0,backup:6,operatorAttestationRecorded:true}));return;
 }
 if(mode==='read'){console.log(JSON.stringify({status:'PROD_OFF_SEAL_READ_PASS',state:postState()}));return;}
 throw Error('MODE_DENIED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error('R4_OWNER_OPERATOR_HOLD '+String(error.message).slice(0,180));process.exitCode=1});

