import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewComment,verifyApprovalShape,classifyReadback} from './first-issue-db-actions.mjs';
import {FIX} from './verify-first-issue-correction.mjs';

const now=Date.parse('2026-11-11T15:00:00Z'), commit='a'.repeat(40), qaDigest='b'.repeat(64), runId=401;
const repo='leisurewang0827/tennis-note-public', branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const env='tennisnote-r4-admin-production', workflow='.github/workflows/r4-first-issue-correction.yml';
const ref=`/git/ref/heads/${branch}`, jobs=`/actions/runs/${runId}/jobs?per_page=100`, approvals=`/actions/runs/${runId}/approvals`;
const files=[workflow,'.github/workflows/r4-first-issue-admin-promotion.yml',
  ...['first-issue-db-actions.mjs','prod-install-corrected.sql','verify-first-issue-correction.mjs','check-first-issue-db-actions.mjs','check-scoped-emergency-off.mjs','check-scoped-off-pg.mjs','check-db-write-journal.mjs'].map(f=>`release-sources/r4-first-issue-correction/${f}`),
  ...['trusted-review-bridge.mjs','admin-single-write-transport.mjs','first-issue-admin-promotion.mjs','check-trusted-review-bridge.mjs','check-admin-single-write-transport.mjs','check-correction-file-binding.mjs'].map(f=>`release-promotions/r4-first-issue-admin/${f}`),
].sort().map((filename,i)=>({filename,sha:(i+1).toString(16).padStart(40,'0'),status:'added'}));
const manifest=createHash('sha256').update(JSON.stringify(files.map(x=>[x.filename,x.sha]))).digest('hex');
const input={commit,manifest,qaDigest,runId,action:'install'};
const state=()=>({
  '':{id:1299952631,full_name:repo,archived:false},
  [ref]:{ref:`refs/heads/${branch}`,object:{sha:commit}},
  [`/git/commits/${commit}`]:{sha:commit,parents:[{sha:FIX.source}]},
  [`/compare/${FIX.source}...${commit}?per_page=100`]:{status:'ahead',total_commits:1,files},
  [`/actions/runs/${runId}`]:{id:runId,path:workflow,head_sha:commit,head_branch:branch,head_repository:{id:1299952631},run_attempt:1,event:'push',status:'in_progress'},
  [`/environments/${env}`]:{id:26219323796,name:env,protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:3}}]}]},
  [jobs]:{jobs:[{name:'correction-only',status:'completed',conclusion:'success'},
    {name:'db-approval-evidence',id:2,status:'in_progress',head_sha:commit,started_at:new Date(now-1000).toISOString()}]},
  [approvals]:[{environments:[{id:26219323796,name:env}],state:'approved',user:{id:3},comment:reviewComment(input)}],
});
const get=d=>p=>d[p];
assert.equal(verifyApprovalShape(get(state()),input,()=>now).productionWriteAllowed,false);
for(const mutate of [
  d=>{d[approvals][0].comment=reviewComment({...input,qaDigest:'c'.repeat(64)});},
  d=>{d[approvals][0].user.id=8;},
  d=>{d[jobs].jobs[0].conclusion='failure';},
  d=>{d[jobs].jobs[1].started_at=new Date(now-241000).toISOString();},
  d=>{d[ref].object.sha=FIX.source;},
]) {const d=state();mutate(d);assert.throws(()=>verifyApprovalShape(get(d),input,()=>now));}
{
  const d=state();let reads=0;
  assert.throws(()=>verifyApprovalShape(p=>p===approvals&&++reads===2?[]:d[p],input,()=>now),/EXACT_REVIEW_NOT_FOUND/);
}
const pre='f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f';
const post='15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286';
const row={controlOff:true,activeScopeCount:0,backupPresent:true,expectedPreSha:pre,expectedPostSha:post,currentOptionsSha:post};
const raw=r=>JSON.stringify({data:[{receipt:r}]});
assert.equal(classifyReadback(raw(row),'install').controlOff,true);
assert.equal(classifyReadback(raw({...row,currentOptionsSha:pre}),'restore').optionsSha,pre);
for(const r of [{...row,activeScopeCount:1},{...row,currentOptionsSha:pre},{...row,controlOff:false},{...row,backupPresent:false}])
  assert.throws(()=>classifyReadback(raw(r),'install'));
assert.throws(()=>classifyReadback('{}','off'));
console.log(JSON.stringify({approvalShapeAccepted:1,approvalDriftDenied:6,readbackAccepted:2,readbackDenied:5,network:0,dbWrites:0}));
