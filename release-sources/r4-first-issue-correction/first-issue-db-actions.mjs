// Local review candidate. This module has no standalone write entry point.
// A production caller must verify the independent QA message through the
// Codex tool and supply its exact digest before checking GitHub's review.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,lstatSync,openSync,closeSync,writeFileSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
import {FIX, STOP, checkCorrection} from './verify-first-issue-correction.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw new Error(code);};
const repo='leisurewang0827/tennis-note-public', repoId=1299952631;
const branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const workflow='.github/workflows/r4-first-issue-correction.yml';
const environment='tennisnote-r4-admin-production', envId=26219323796;
const qaThread='01a00f94-df3e-7ac2-b30b-df881b7ed549';
const prodRef='cnympiwrwgouuvhaivbc';
const projectSha='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const cli='C:/Codex/tennisnote-dev-20260815/.codex-temp/supabase-cli/supabase.exe';
const cliSha='af90dcd1401f3f98bed6f9f5f3bf7b07e1ce2501a42265ce97007a2d1b026209';
const pre='f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f';
const post='15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286';
const correctionDir='release-sources/r4-first-issue-correction/';
const prodJournal='C:/Users/user/Documents/ChatGPT/테니스노트/outputs/2026-11-11-r4-first-catalog-lesson/db-write-journal';
const required=[workflow,...[
  'prod-install-corrected.sql','verify-first-issue-correction.mjs','first-issue-db-actions.mjs',
  'check-first-issue-db-actions.mjs','check-scoped-emergency-off.mjs','check-scoped-off-pg.mjs','check-db-write-journal.mjs',
].map(name=>correctionDir+name)];
const releasePaths=new Set([...required,'.github/workflows/r4-first-issue-admin-promotion.yml',...[
  'trusted-review-bridge.mjs','admin-single-write-transport.mjs','first-issue-admin-promotion.mjs',
  'check-trusted-review-bridge.mjs','check-admin-single-write-transport.mjs','check-correction-file-binding.mjs',
].map(name=>'release-promotions/r4-first-issue-admin/'+name)]);
const id=n=>Number.isSafeInteger(n)&&n>0;
const hex=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const actionOK=a=>['install','off','restore'].includes(a);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(x)&&x!=='00000000-0000-0000-0000-000000000000';

export function reviewComment({commit, manifest, qaDigest, action, operation, scopeDigest}) {
  if(!hex(commit,40)||!hex(manifest,64)||!hex(qaDigest,64)||!actionOK(action))fail('APPROVAL_BINDING_INVALID');
  const scoped=operation!==undefined||scopeDigest!==undefined;
  if((scoped&&(!uuid(operation)||!hex(scopeDigest,64)))||(action==='off'&&!scoped))fail('OFF_OPERATION_BINDING_REQUIRED');
  // One approved release plan covers the known default-OFF install and its
  // narrow recovery actions. It never allows an unbound canary or broad OFF.
  return ['R4-FIRST-ISSUE-CORRECTION-V2',commit,manifest,qaThread,qaDigest,projectSha,
    FIX.install,FIX.off,FIX.restore,FIX.source,FIX.artifactSha,FIX.recovery,
    scoped?operation:'NO_CANARY_OPERATION',scoped?scopeDigest:'NO_CANARY_SCOPE'].join('\n');
}

function gh(path) {
  try{return JSON.parse(execFileSync('gh',['api','--hostname','github.com','--method','GET',`repos/${repo}${path}`],
    {encoding:'utf8',shell:false,windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024}));}
  catch{fail('OFFICIAL_GITHUB_READ_FAILED');}
}

export function scopeOf(diff) {
  const rows=diff.files;
  if(diff.status!=='ahead'||diff.total_commits!==1||!Array.isArray(rows)||rows.length!==releasePaths.size||
    rows.some(x=>x.status!=='added'||!releasePaths.has(x.filename)||!hex(x.sha,40)))fail('RELEASE_DIFF_SCOPE');
  const files=rows.map(x=>[x.filename,x.sha]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  if(new Set(files.map(x=>x[0])).size!==files.length)fail('RELEASE_DIFF_SCOPE');
  return files;
}

function approval(get, {commit,manifest,qaDigest,action,runId,operation,scopeDigest}, clock) {
  if(!id(runId))fail('RELEASE_RUN_REQUIRED');
  const comment=reviewComment({commit,manifest,qaDigest,action,operation,scopeDigest});
  const officialRepo=get('');
  if(officialRepo.id!==repoId||officialRepo.full_name!==repo||officialRepo.archived)fail('REPO_DRIFT');
  const ref=()=>get(`/git/ref/heads/${branch}`);
  const head=ref(), entry=get(`/git/commits/${commit}`);
  if(head.ref!==`refs/heads/${branch}`||head.object?.sha!==commit||entry.sha!==commit||entry.parents?.length!==1||entry.parents[0].sha!==FIX.source)fail('CORRECTION_COMMIT_DRIFT');
  const files=scopeOf(get(`/compare/${FIX.source}...${commit}?per_page=100`));
  if(sha(JSON.stringify(files))!==manifest)fail('MANIFEST_DRIFT');
  const readState=()=>{
    const run=get(`/actions/runs/${runId}`), env=get(`/environments/${environment}`);
    if(run.id!==runId||run.path!==workflow||run.head_sha!==commit||run.head_branch!==branch||run.head_repository?.id!==repoId||run.run_attempt!==1||run.event!=='push'||run.status!=='in_progress'||env.id!==envId||env.name!==environment)fail('RELEASE_RUN_DRIFT');
    const jobs=get(`/actions/runs/${runId}/jobs?per_page=100`).jobs;
    const ci=jobs?.filter(j=>j.name==='correction-only')??[];
    const gate=jobs?.filter(j=>j.name==='db-approval-evidence')??[];
    if(ci.length!==1||gate.length!==1||ci[0].status!=='completed'||ci[0].conclusion!=='success'||gate[0].status!=='in_progress'||gate[0].head_sha!==commit)fail('RELEASE_JOB_NOT_READY');
    const reviewers=env.protection_rules?.find(x=>x.type==='required_reviewers')?.reviewers?.filter(x=>x.type==='User').map(x=>x.reviewer?.id)??[];
    const reviews=get(`/actions/runs/${runId}/approvals`);
    const rows=Array.isArray(reviews)?reviews.filter(x=>x.environments?.some(e=>e.id===envId&&e.name===environment)):[];
    if(rows.length!==1||rows[0].state!=='approved'||!reviewers.includes(rows[0].user?.id)||rows[0].comment!==comment)fail('EXACT_REVIEW_NOT_FOUND');
    const t=Date.parse(gate[0].started_at), now=clock();
    if(!Number.isFinite(t)||t>now+1000||now-t>=240000)fail('APPROVAL_WINDOW_CLOSED');
    return {gate:gate[0].id,reviewer:rows[0].user.id,expires:t+240000};
  };
  const first=readState(), last=readState();
  if(first.gate!==last.gate||first.reviewer!==last.reviewer||first.expires!==last.expires||ref().object?.sha!==commit||clock()>=last.expires)fail('FINAL_APPROVAL_DRIFT');
  return {files,expires:last.expires};
}

// Tests can exercise receipt parsing, never an injectable production writer.
export function verifyApprovalShape(get, request, clock) {return {...approval(get,request,clock),productionWriteAllowed:false};}

function db(sql) {
  return execFileSync(cli,['db','query','--yes','--linked','--project-ref',prodRef,'--output','json',sql],
    {encoding:'utf8',shell:false,windowsHide:true,timeout:38000,stdio:['ignore','pipe','pipe'],maxBuffer:256*1024});
}
function assertInitialInstallRead() {
  const q=`begin read only; set local search_path=pg_catalog;
    select (to_regprocedure('public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)') is null
      and to_regclass('private.tn_r4_first_issue_control') is null
      and to_regclass('private.tn_r4_first_issue_scope') is null
      and to_regclass('private.tn_r4_first_issue_receipts') is null
      and to_regclass('private.tn_r4_first_issue_ops_backup') is null
      and encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex')='${pre}') as r4_release_initial_absence;
    rollback;`;
  try{if(!/"r4_release_initial_absence"\s*:\s*true/.test(db(q)))fail('INSTALL_BASELINE_NOT_CONFIRMED');}
  catch{fail('INSTALL_BASELINE_NOT_CONFIRMED');}
}
function unwrap(bytes,digest) {
  if(sha(bytes)!==digest)fail('SQL_DIGEST_DRIFT');
  const text=bytes.toString('utf8');
  if(text.split(STOP).length!==2)fail('SQL_STOP_DRIFT');
  return text.replace(STOP,'-- Exact release authority checked by the operator.');
}
const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
function bindInstallBlob(gate, correctedPath) {
  const local=readFileSync(correctedPath);
  if(sha(local)!==FIX.install||gate.files.find(x=>x[0]===correctionDir+'prod-install-corrected.sql')?.[1]!==gitBlob(local))fail('APPROVED_INSTALL_BLOB_DRIFT');
  for(const name of ['first-issue-db-actions.mjs','verify-first-issue-correction.mjs']) {
    const bytes=readFileSync(new URL('./'+name,import.meta.url));
    if(gate.files.find(x=>x[0]===correctionDir+name)?.[1]!==gitBlob(bytes))fail('APPROVED_EXECUTOR_BLOB_DRIFT');
  }
}
// A local operator journal, deliberately not a distributed lock. The release
// is restricted to this operator host; never remove a marker to replay a write.
export function claimWriteOnce(root,{commit,action,operation}) {
  if(!hex(commit,40)||!actionOK(action)||(action==='off'?!uuid(operation):operation!==undefined))fail('WRITE_JOURNAL_BINDING');
  try{mkdirSync(root,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
  const stat=lstatSync(root);
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('WRITE_JOURNAL_DIRECTORY');
  const key=sha(JSON.stringify([commit,action,operation??null]));
  let fd;
  try{fd=openSync(join(root,key+'.json'),'wx',0o600);}
  catch(e){if(e.code==='EEXIST')fail('WRITE_ALREADY_ATTEMPTED_READBACK_ONLY');throw e;}
  try{writeFileSync(fd,JSON.stringify({attemptedAt:new Date().toISOString(),action,version:1})+'\n');fsyncSync(fd);}
  finally{closeSync(fd);}
}
export function renderGuardedBoundOff(template,operation) {
  if(!uuid(operation)||sha(template)!==FIX.off)fail('OFF_OPERATION_OR_TEMPLATE_DRIFT');
  const text=template.toString('utf8');
  const lock='lock table private.tn_r4_first_issue_scope in share row exclusive mode;';
  if(text.split(lock).length!==2||text.split(STOP).length!==2)fail('OFF_LOCK_OR_STOP_DRIFT');
  return text.replace(lock,`${lock}\n  if exists(select from private.tn_r4_first_issue_scope where enabled and operation_id is distinct from '${operation}'::uuid)\n    or encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex')<>'${post}'\n  then raise exception 'r4_off_operation_or_options_drift'; end if;`);
}
export function classifyReadback(raw, action) {
  const matches=[...String(raw).matchAll(/"receipt"\s*:\s*(\{[^{}]{1,2048}\})/g)];
  if(matches.length!==1)fail('COMMITTED_READBACK_MISSING');
  const row=JSON.parse(matches[0][1]);
  if(row.controlOff!==true||row.activeScopeCount!==0||row.backupPresent!==true||row.expectedPreSha!==pre||row.expectedPostSha!==post||
    row.currentOptionsSha!==(action==='restore'?pre:post))fail('COMMITTED_OFF_NOT_VERIFIED');
  return {controlOff:true,activeScopeCount:0,optionsSha:row.currentOptionsSha};
}

// Safe follow-up after a timeout or a durable duplicate-attempt marker.
// The fixed readback is a BEGIN READ ONLY transaction and returns no rows
// identifying members, sessions, or the scoped operation.
export function readCommittedOffState({baseDir,correctedPath,restored=false}) {
  checkCorrection(baseDir,correctedPath);
  if(typeof restored!=='boolean'||sha(prodRef)!==projectSha||sha(readFileSync(cli))!==cliSha)fail('TARGET_OR_TOOL_DRIFT');
  const sql=unwrap(readFileSync(join(baseDir,'prod-readback-template-v2.sql')),FIX.readback);
  if(!sql.startsWith('begin read only;'))fail('READBACK_MODE_DRIFT');
  let state;
  try{state=classifyReadback(db(sql),restored?'restore':'off');}
  catch{fail('COMMITTED_OFF_NOT_VERIFIED');}
  return Object.freeze({source:FIX.source,projectSha,observedAt:new Date().toISOString(),restored,...state,writeAttempts:0});
}

// Not invoked by CI. In particular there is no test-supplied transport, token,
// unbound JSON approval, second write attempt, or arbitrary SQL argument.
export function runApprovedDbAction({commit,manifest,qaDigest,action,runId,baseDir,correctedPath,operation,scopeDigest}) {
  checkCorrection(baseDir,correctedPath);
  if(sha(prodRef)!==projectSha||sha(readFileSync(cli))!==cliSha)fail('TARGET_OR_TOOL_DRIFT');
  if(!['install','restore'].includes(action))fail('ACTION_DENIED');
  const readBytes=readFileSync(join(baseDir,'prod-readback-template-v2.sql'));
  const readSql=unwrap(readBytes,FIX.readback);
  const actionBytes=readFileSync(action==='install'?correctedPath:join(baseDir,`prod-${action}-template-v2.sql`));
  const writeSql=unwrap(actionBytes,FIX[action]);
  if(action==='install')assertInitialInstallRead();
  const gate=approval(gh,{commit,manifest,qaDigest,action,runId,operation,scopeDigest},Date.now);
  bindInstallBlob(gate,correctedPath);
  if(Date.now()>=gate.expires)fail('APPROVAL_WINDOW_CLOSED');
  return writeOnceAndRead(commit,action,writeSql,readSql,{expires:gate.expires});
}

// Arm before any canary is opened. The sole later invocation can only close
// the previously approved operation, even if the reviewer job has ended.
// This is not a canary opener or a durable substitute for the server lease.
export function prepareBoundEmergencyOff({commit,manifest,qaDigest,runId,baseDir,correctedPath,operation,scopeDigest}) {
  checkCorrection(baseDir,correctedPath);
  if(sha(prodRef)!==projectSha||sha(readFileSync(cli))!==cliSha)fail('TARGET_OR_TOOL_DRIFT');
  const guarded=renderGuardedBoundOff(readFileSync(join(baseDir,'prod-off-template-v2.sql')),operation);
  const readSql=unwrap(readFileSync(join(baseDir,'prod-readback-template-v2.sql')),FIX.readback);
  const gate=approval(gh,{commit,manifest,qaDigest,action:'off',runId,operation,scopeDigest},Date.now);
  bindInstallBlob(gate,correctedPath);
  if(Date.now()>=gate.expires)fail('APPROVAL_WINDOW_CLOSED');
  let used=false;
  return ()=>{
    if(used)fail('OFF_ALREADY_ATTEMPTED_READBACK_ONLY');
    used=true;
    if(sha(readFileSync(cli))!==cliSha)fail('TARGET_OR_TOOL_DRIFT');
    return writeOnceAndRead(commit,'off',guarded.replace(STOP,'-- Exact prearmed OFF authority checked by the operator.'),readSql,{operation});
  };
}

function writeOnceAndRead(commit,action,writeSql,readSql,{expires,operation}={}) {
  claimWriteOnce(prodJournal,{commit,action,operation});
  if(expires!==undefined&&Date.now()>=expires)fail('APPROVAL_WINDOW_CLOSED');
  let acknowledged=false;
  try{db(writeSql);acknowledged=true;}catch{/* Do not expose subprocess output or repeat the write. */}
  try{
    const observation=classifyReadback(db(readSql),action);
    return Object.freeze({candidate:commit,source:FIX.source,sqlSha:FIX[action],projectSha,action,acknowledged,writeAttempts:1,
      status:acknowledged?'WRITE_ACKNOWLEDGED_STATE_VERIFIED':'STATE_VERIFIED_WRITE_ACK_UNKNOWN',
      observedAt:new Date().toISOString(),...observation});
  }
  catch{return Object.freeze({candidate:commit,action,acknowledged,writeAttempts:1,status:'UNKNOWN_NO_RETRY'});}
}
