// 승인된 개발 미리보기 한 곳에만 1회 게시. 운영·DB 실행 경로 없음.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,json,prefix,walk} from './compose.mjs';
import {patchWrangler} from '../../scripts/r4_internal_registration_dev.mjs';
import {getJson,allDeployments} from '../r4-finance-owner-dev-publish/publish.mjs';
export function validateOff(off,now=Date.now()){
 assert.equal(off.project,'udjmiezroipctytmztwz');const age=now-Date.parse(off.at);assert(age>=0&&age<60*60*1000,'OFF_EVIDENCE_EXPIRED');
 for(const k of ['opened','operators','grants'])assert.equal(off[k],0,k);
}
export function prepare(m){
 const dir=join(process.env.RUNNER_TEMP,'r4-finance-admin-transport/node_modules/wrangler');assert.equal(json(join(dir,'package.json')).version,'3.90.0');
 let s=patchWrangler(readFileSync(join(dir,'wrangler-dist/cli.js')));
 const anchor='if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");';assert.equal(s.split(anchor).length,2);
 s=s.replace(anchor,'if (init2.body?.get("branch") !== "r4-finance-owner-qa" || init2.body?.get("commit_hash") !== process.env.GITHUB_SHA) throw Error("R4_PREVIEW_SCOPE_DENIED");\n  '+anchor);
 writeFileSync(join(dir,'wrangler-dist/cli-r4-admin-single.cjs'),s,{flag:'wx'});
}
async function body(base,p){const r=await fetch(base+'/'+(p==='index.html'?'':p),{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});return {status:r.status,hash:hash(Buffer.from(await r.arrayBuffer()))};}
async function main(){
 const m=json(prefix+'manifest.json');assert.equal(process.env.GITHUB_REPOSITORY,m.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+m.branch);
 assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 if(process.argv[2]==='prepare'){prepare(m);return;}
 assert.equal(process.argv[2],'publish');validateOff(m.off);
 const c=json('candidate/composition.json');assert.equal(c.source,process.env.GITHUB_SHA);assert.equal(c.privateSource,m.privateSource);assert.equal(c.project,m.devProject);
 assert.equal(Object.keys(c.files).length,185);assert.deepEqual(walk('candidate/admin'),c.files);
 const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
 assert(token&&account);assert.equal(hash(account),m.accountFingerprint);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/tennisnote-admin-dev';
 const read=async path=>{const v=await getJson(base+path,token);assert.equal(v.success,true);return v.result;};
 const project=await read('');assert.equal(project.name,m.project);assert.equal(project.production_branch,'dev');
 const before=await allDeployments(base,token);assert(before.every(d=>['success','failure','canceled','cancelled'].includes(d.latest_stage?.status)),'OTHER_PUBLICATION_HOLD');
 const origin='https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev';
 const previous=before.filter(d=>d.aliases?.includes(origin));assert.equal(previous.length,1,'PREVIEW_ID_AMBIGUOUS');
 assert.equal(previous[0].id,m.recoveryId);assert.equal(previous[0].latest_stage.status,'success');
 assert(!before.some(d=>d.deployment_trigger?.metadata?.branch===m.preview&&d.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA),'ALREADY_PUBLISHED_RECONCILE');
 const preserved={};for(const p of ['index.html','shared/config.local.js'])preserved[p]=await body('https://tennisnote-admin-dev.pages.dev',p);
 const critical=['index.html','r4-finance-admin-control.js','r4-finance-admin-control.css','shared/config.local.js'];
 const old=json('base/composition.json');for(const p of ['index.html','shared/config.local.js'])assert.deepEqual(await body(origin,p),{status:200,hash:old.files[p]},'RECOVERY_ASSET_DRIFT '+p);
 const last=await read('');assert.equal(last.canonical_deployment?.id,project.canonical_deployment?.id);
 const lastList=await allDeployments(base,token);assert.deepEqual(lastList.map(d=>[d.id,d.latest_stage?.status]).sort(),before.map(d=>[d.id,d.latest_stage?.status]).sort(),'PUBLICATION_LIST_DRIFT');validateOff(m.off);
 writeFileSync('publication-result.json',JSON.stringify({status:'ADMITTED',source:c.source,recoveryId:previous[0].id,canonicalId:project.canonical_deployment?.id,postingAttempted:false})+'\n');
 const cli=join(process.env.RUNNER_TEMP,'r4-finance-admin-transport/node_modules/wrangler/wrangler-dist/cli-r4-admin-single.cjs');
 const run=spawnSync(process.execPath,[cli,'pages','deploy','candidate/admin','--project-name=tennisnote-admin-dev','--branch=r4-finance-owner-qa','--commit-hash='+process.env.GITHUB_SHA,'--commit-dirty=false'],{encoding:'utf8',timeout:150000,maxBuffer:3e6,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(run.status,0,'PUBLICATION_OUTCOME_UNKNOWN_NO_RETRY');
 const urls=[...new Set(((run.stdout||'')+'\n'+(run.stderr||'')).match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin-dev\.pages\.dev/g)||[])];assert.equal(urls.length,1,'RECONCILE_PUBLICATION_ID');
 const immutable=urls[0],after=await allDeployments(base,token);const published=after.filter(d=>d.url===immutable);assert.equal(published.length,1);
 const d=published[0];assert.equal(d.latest_stage.status,'success');assert(d.aliases?.includes(origin));assert.equal(d.deployment_trigger?.metadata?.branch,m.preview);assert.equal(d.deployment_trigger?.metadata?.commit_hash,c.source);
 writeFileSync('publication-result.json',JSON.stringify({status:'PUBLISHED_READ_PENDING',source:c.source,deploymentId:d.id,immutable,alias:origin,recoveryId:previous[0].id,postingAttempted:true})+'\n');
 for(const b of [immutable,origin])for(const p of critical){
  let response;for(let attempt=0;attempt<6;attempt++){
   response=await body(b,p);if(response.status===200&&response.hash===c.files[p])break;
   if(!(response.status===404||(response.status===200&&response.hash===old.files[p])))break;
   if(attempt<5)await new Promise(r=>setTimeout(r,3000));
  }
  assert.deepEqual(response,{status:200,hash:c.files[p]},'POSTREAD_FILE '+p+' HTTP_'+response?.status);
 }
 const final=await read('');assert.equal(final.canonical_deployment?.id,project.canonical_deployment?.id);
 for(const[p,v]of Object.entries(preserved))assert.deepEqual(await body('https://tennisnote-admin-dev.pages.dev',p),v,'CANONICAL_FILE_CHANGED');
 const result={status:'DEV_PREVIEW_PUBLICATION_PASS',source:c.source,privateSource:m.privateSource,deploymentId:d.id,immutable,alias:origin,recoveryId:previous[0].id,files:185,publications:1,canonicalUnchanged:true,paymentEnabled:false,dbExecution:false};
 writeFileSync('publication-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{
 let previous={};try{previous=json('publication-result.json');}catch{}
 writeFileSync('publication-result.json',JSON.stringify({...previous,status:'HOLD_NO_RETRY',reason:String(e.message).slice(0,300)},null,2)+'\n');
 console.error('DEV_PREVIEW_HOLD '+String(e.message).slice(0,300));process.exitCode=1;
});
