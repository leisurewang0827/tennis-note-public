// Offline synthetic checks only. No external HTTP or credentials.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {onlyGet,stage,validateRun,validateSourceRun,validateAsset,validateDeployment,validateRecovery,validateArtifact,validateBytes,versions} from './r4_independent_owner_prod_post_readonly.mjs';
const base=process.argv[2],candidate=process.argv[3];assert.ok(base&&candidate);
if(process.env.R4_POST_DELTA_ONLY){
  const x={head_sha:'7ba4e453e5e89540c0578db1dd76312c6f8d9442',status:'completed',conclusion:'success',event:'push',run_attempt:1,path:'.github/workflows/r4-independent-owner-prod-source.yml'};
  validateSourceRun(x);assert.throws(()=>validateSourceRun({...x,conclusion:'failure'}));assert.throws(()=>validateSourceRun({...x,head_sha:'different'}));
  assert.throws(()=>validateAsset(Buffer.from('modified'),'0'.repeat(64)));console.log('PASS readonly post delta: source run and asset mismatch fail closed');
}else{
let requests=0;
const fetcher=async(url,options)=>{requests++;assert.equal(options.method,'GET');return {status:200};};
const good='https://tennisnote-admin.pages.dev/r4-independent-owner.js?v=05b861eaffad3030';
await onlyGet(good,{},'',fetcher);assert.equal(requests,1);
await assert.rejects(()=>onlyGet(good,{method:'POST'},'',fetcher),/GET_ONLY/);
await assert.rejects(()=>onlyGet('https://untrusted.invalid/',{},'',fetcher));
await assert.rejects(()=>onlyGet('https://tennisnote-admin.pages.dev/',{},'synthetic-token',fetcher));
await assert.rejects(()=>onlyGet('https://api.cloudflare.com/client/v4/anything',{},'synthetic-token',fetcher));
assert.equal(requests,1);
await assert.rejects(()=>onlyGet(good,{},'',async()=>({status:404})),/GET_STATUS/);
await assert.rejects(()=>onlyGet(good,{},'',async()=>({status:500})),/GET_STATUS/);
await assert.rejects(()=>onlyGet(good,{},'',async()=>{throw Error('timeout');}));
await assert.rejects(()=>stage('CANONICAL_ASSETS',async()=>{throw Error('unsafe details');}),/^Error: CANONICAL_ASSETS$/);
const run={id:42930191570,head_sha:'019c6de29efd2d75e84cc690c70f01ceaeab62c5',status:'completed',conclusion:'failure',event:'push',run_attempt:1,path:'.github/workflows/r4-independent-owner-prod-promotion.yml'};
const names=[['Recheck OFF receipt, exact artifacts, canonical and recovery','success'],['Publish sealed administrator artifact once','success'],['Verify canonical and immutable administrator assets','failure'],['Restore exact prior administrator only on definite immutable mismatch','skipped']];
const jobs={total_count:1,jobs:[{name:'promote',conclusion:'failure',steps:names.map(([name,conclusion])=>({name,conclusion}))}]};
validateRun(run,jobs);assert.throws(()=>validateRun({...run,conclusion:'success'},jobs));
assert.throws(()=>validateRun({...run,head_sha:'different'},jobs));
assert.throws(()=>validateRun(run,{...jobs,jobs:[{...jobs.jobs[0],steps:jobs.jobs[0].steps.slice(0,3)}]}));
const sourceRun={head_sha:'7ba4e453e5e89540c0578db1dd76312c6f8d9442',status:'completed',conclusion:'success',event:'push',run_attempt:1,path:'.github/workflows/r4-independent-owner-prod-source.yml'};
validateSourceRun(sourceRun);assert.throws(()=>validateSourceRun({...sourceRun,conclusion:'failure'}));assert.throws(()=>validateSourceRun({...sourceRun,head_sha:'different'}));
assert.throws(()=>validateAsset(Buffer.from('modified'),'0'.repeat(64)));
const deployment={id:'d0841b4a-a92a-4a87-a5c1-ae40436fb2a3',environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:'main',commit_hash:'7ba4e453e5e89540c0578db1dd76312c6f8d9442'}}};
const project={success:true,result:{name:'tennisnote-admin',production_branch:'main',canonical_deployment:deployment}};
validateDeployment(project,deployment.id,deployment.deployment_trigger.metadata.commit_hash);
assert.throws(()=>validateDeployment({...project,result:{...project.result,production_branch:'dev'}},deployment.id,deployment.deployment_trigger.metadata.commit_hash));
assert.throws(()=>validateDeployment(project,'00000000-0000-0000-0000-000000000000',deployment.deployment_trigger.metadata.commit_hash));
const recovery={success:true,result:{...deployment,id:'2652a679-cc7b-4b85-a4d0-166c393faa0d',url:'https://2652a679.tennisnote-admin.pages.dev',deployment_trigger:{metadata:{branch:'main',commit_hash:'bd848b8c8f893d3b7be0e2a763065e1ffaa8ec7c'}}}};
validateRecovery(recovery);assert.throws(()=>validateRecovery({...recovery,result:{...recovery.result,id:deployment.id}}));
const artifact={id:13777303858,workflow_run:{id:42846945596},expired:false,digest:'sha256:'+'a'.repeat(64),expires_at:'2099-01-01T00:00:00Z'};
validateArtifact(artifact,13777303858,42846945596,'a'.repeat(64));assert.throws(()=>validateArtifact({...artifact,expired:true},13777303858,42846945596,'a'.repeat(64)));
const seal=validateBytes(base,candidate);assert.equal(Object.keys(seal.fresh.admin).length,178);
const tmp=mkdtempSync(join(tmpdir(),'tn-independent-post-negative-'));writeFileSync(join(tmp,'seal.json'),'{}');assert.throws(()=>validateBytes(base,tmp));
const v=versions(readFileSync(join(candidate,'admin','index.html')),['r4-independent-owner.js']);assert.equal(v['r4-independent-owner.js'],'05b861eaffad3030');assert.throws(()=>versions(Buffer.from('missing'),['r4-independent-owner.js']));
console.log('PASS readonly post delta: GET-only, no credential leak, failure-history pins, 178 artifacts, canonical/recovery drift, versions, HTTP failures');
}
