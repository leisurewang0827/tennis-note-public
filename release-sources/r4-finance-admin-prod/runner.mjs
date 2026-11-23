// Same-SHA protected admission + explicit operator DB-OFF attestation + ADMIN-only publication.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {composeWeb,hash,walk} from './compose-web.mjs';
import {repo,branch,workflow,validateRun,validateReview,validateOffStatus,contextName,previous,deployment,rollbackAllowed} from './gate.mjs';
import {patchProductionWrangler} from '../../scripts/r4_internal_registration_prod_promotion.mjs';
import {createPostreadPlan,classifyPostread} from './postread-policy.mjs';
const e=process.env,api='https://api.github.com/repos/'+repo,here=new URL('./',import.meta.url);
const m=JSON.parse(readFileSync(new URL('manifest.json',here),'utf8'));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',env:{...e,GIT_NO_LAZY_FETCH:'1'}}).trim();
let posted=false,attempted=null,rollbackPosted=false;
async function request(url,token){
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,'HTTP_'+r.status+' '+new URL(url).pathname);return r.json();
}
function scope(){
 assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);
 assert.equal(e.GITHUB_REF_NAME,branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(e.GITHUB_WORKFLOW_REF,repo+'/'+workflow+'@refs/heads/'+branch);
 assert.equal(git('rev-parse','HEAD'),e.GITHUB_SHA);assert.equal(git('rev-parse','HEAD^'),m.parent);
 const changes=git('diff-tree','--no-commit-id','--name-only','-r',m.parent,e.GITHUB_SHA).split('\n').sort();
 assert.deepEqual(changes,m.commitPaths);
 for(const [p,h]of Object.entries(m.payload))assert.equal(hash(readFileSync(new URL(p,here))),h,p);
 assert.equal(hash(readFileSync('scripts/r4_internal_registration_prod_promotion.mjs')),'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4');
 assert.equal(hash(readFileSync('scripts/r4_internal_registration_dev.mjs')),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677');
 assert(e.GH_TOKEN&&e.RUNNER_TEMP);
}
async function bound(){
 const run=await request(api+'/actions/runs/'+e.GITHUB_RUN_ID,e.GH_TOKEN);
 validateRun(run,e.GITHUB_SHA,e.GITHUB_RUN_ID);
 assert.equal((await request(api+'/git/ref/heads/'+branch,e.GH_TOKEN)).object.sha,e.GITHUB_SHA,'BRANCH_MOVED');
 validateReview(await request(api+'/actions/runs/'+e.GITHUB_RUN_ID+'/approvals',e.GH_TOKEN),e.GITHUB_SHA);
 return run;
}
const cf=()=>{assert.equal(e.CLOUDFLARE_ACCOUNT_ID,'409b5ce9af65bb6d271bba790bf7ca9e');assert(e.CLOUDFLARE_API_TOKEN);return 'https://api.cloudflare.com/client/v4/accounts/'+e.CLOUDFLARE_ACCOUNT_ID+'/pages/projects/tennisnote-admin';};
async function project(){
 const r=await request(cf(),e.CLOUDFLARE_API_TOKEN);assert.equal(r.success,true);assert.equal(r.result.name,'tennisnote-admin');assert.equal(r.result.production_branch,'main');return r.result;
}
async function baseRead(){
 const p=await project();deployment(p.canonical_deployment);
 const d=await request(cf()+'/deployments/'+previous.id,e.CLOUDFLARE_API_TOKEN);assert.equal(d.success,true);deployment(d.result);
 assert.equal(d.result.url,'https://392c69af.tennisnote-admin.pages.dev');
 const files=m.baselineFiles;
 for(const path of ['index.html','r4-branch-finance-paid.js','r4-branch-finance-settlement.js','shared/config.local.js'])
 for(const origin of ['https://tennisnote-admin.pages.dev','https://392c69af.tennisnote-admin.pages.dev']){
  const r=await fetch(origin+'/'+(path==='index.html'?'':path),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),files[path],'BASE_ASSET_DRIFT '+path);
 }
 const list=await request(cf()+'/deployments?page=1',e.CLOUDFLARE_API_TOKEN);assert.equal(list.success,true);assert(Array.isArray(list.result));
 assert(list.result.every(d=>['success','failure','canceled'].includes(d.latest_stage?.status)),'OTHER_PUBLICATION_IN_PROGRESS');
 deployment((await project()).canonical_deployment);
}
function sealed(){
 const out=join(e.RUNNER_TEMP,'candidate');
 const seal=JSON.parse(readFileSync(join(out,'seal.json'),'utf8'));
 const actual=Object.fromEntries(Object.entries(walk(join(out,'site'))).map(([n,b])=>[n,hash(b)]));
 assert.deepEqual(actual,seal.files);assert.equal(seal.baseline.deployment,previous.id);
 assert.deepEqual(seal.changes,['index.html','r4-finance-admin-control.css','r4-finance-admin-control.js']);
 return {out,seal};
}
async function artifactSource(){
 const r=await request(api+'/actions/runs/44921413585',e.GH_TOKEN);
 assert.equal(r.head_sha,'2076381588b23c7e1b7432eadfc2d603ecb04838');assert.equal(r.run_attempt,1);assert.equal(r.conclusion,'success');
 const a=await request(api+'/actions/artifacts/14713548078',e.GH_TOKEN);
 assert.equal(a.workflow_run.id,44921413585);assert.equal(a.expired,false);
 assert.equal(a.digest,'sha256:63dfa7819ccc886b3b018ed3699d44586430ebab8a724acfaf70bda361349143');
}
async function readAfter(current,seal){
 const origins=['https://'+current.id.slice(0,8)+'.tennisnote-admin.pages.dev','https://tennisnote-admin.pages.dev'];
 const plan=createPostreadPlan(seal,readFileSync(join(e.RUNNER_TEMP,'candidate/site/_redirects')));
 const paths=plan.paths;
 let staticResponses=0,redirectResponses=0;
 for(const origin of origins){
  let index=0;await Promise.all(Array.from({length:8},async()=>{
   while(index<paths.length){
    const path=paths[index++],route=path.endsWith('index.html')?path.slice(0,-10):path.replace(/\.html$/,'');
    let okay=false;
    for(let attempt=0;attempt<6;attempt++){
     const r=await fetch(origin+'/'+route,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
     const verdict=await classifyPostread(plan,path,r);
     if(verdict==='static'){staticResponses++;okay=true;break;}
     if(verdict==='redirect'){redirectResponses++;okay=true;break;}
     deployment((await project()).canonical_deployment,{id:current.id,source:e.GITHUB_SHA});
     await new Promise(resolve=>setTimeout(resolve,2000));
    }
    assert(okay,'POSTREAD_FAILED '+path);
   }
  }));
 }
 return {responses:paths.length*2,staticResponses,redirectResponses};
}
async function offReceipt(run,wait=false){
 let s;
 for(let i=0;i<(wait?48:1);i++){
  const rows=await request(api+'/commits/'+e.GITHUB_SHA+'/statuses?per_page=100',e.GH_TOKEN);
  s=rows.find(x=>x.context===contextName);if(s)break;
  if(wait){await bound();await new Promise(resolve=>setTimeout(resolve,10000));}
 }
 assert(s,'DB_OFF_ATTESTATION_MISSING');
 validateOffStatus({...s,sha:e.GITHUB_SHA},{sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,sqlHash:m.payload['admin-prod-install.sql'],createdAt:run.created_at});
 // This is the designated operator's independent DB query attestation, NOT a direct CI DB connection.
}
async function postRollback(current){
 assert(!rollbackPosted&&rollbackAllowed((await project()).canonical_deployment,current.id,e.GITHUB_SHA));rollbackPosted=true;
 const r=await fetch(cf()+'/deployments/'+previous.id+'/rollback',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,'ROLLBACK_OUTCOME_UNKNOWN');assert.equal((await r.json()).success,true);
 deployment((await project()).canonical_deployment);
}
async function publish(){
 const {out,seal}=sealed(),run=await bound();
 const jobs=await request(api+'/actions/runs/'+e.GITHUB_RUN_ID+'/jobs?per_page=100',e.GH_TOKEN);
 assert.equal(jobs.jobs.filter(x=>x.name==='admit'&&x.conclusion==='success').length,1);
 await offReceipt(run,true);await baseRead();await bound();await offReceipt(run);
 const wr=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');
 assert.equal(JSON.parse(readFileSync(join(wr,'package.json'),'utf8')).version,'3.90.0');
 const bytes=readFileSync(join(wr,'wrangler-dist/cli.js'));assert.equal(hash(bytes),'ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e');
 let transport=patchProductionWrangler(bytes);
 const anchor='if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");';assert.equal(transport.split(anchor).length,2);
 transport=transport.replace(anchor,'if(init2.body?.get("branch")!=="main"||init2.body?.get("commit_hash")!==process.env.R4_OWNER_EXACT_SHA)throw Error("R4_EXACT_ADMIN_BODY_DENIED");\n'+anchor);
 const bin=join(wr,'wrangler-dist/r4-finance-admin-prod.cjs');writeFileSync(bin,transport,{flag:'wx'});
 posted=true;
 await new Promise(done=>{
  let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);done()};
  const child=spawn(process.execPath,[bin,'pages','deploy',join(out,'site'),'--project-name=tennisnote-admin','--branch=main','--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],
   {shell:false,stdio:['ignore','ignore','ignore'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:e.CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:e.CLOUDFLARE_API_TOKEN,R4_OWNER_EXACT_SHA:e.GITHUB_SHA}});
  const timer=setTimeout(()=>{child.kill();finish()},120000);child.once('error',finish);child.once('close',finish);
 });
 let current;
 for(let i=0;i<12;i++){
  const d=(await project()).canonical_deployment;
  if(d.deployment_trigger?.metadata?.commit_hash===e.GITHUB_SHA&&d.latest_stage?.status==='success'){current=d;attempted=d.id;break;}
  deployment(d);await new Promise(resolve=>setTimeout(resolve,2000));
 }
 assert(current,'PUBLISH_OUTCOME_UNKNOWN_NO_RETRY');
 try{
  const proof=await readAfter(current,seal);deployment((await project()).canonical_deployment,{id:current.id,source:e.GITHUB_SHA});
  await bound();
  const result={status:'R4_OWNER_PROD_ADMIN_PUBLISHED_DEFAULT_OFF',source:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,deploymentId:current.id,rollbackId:previous.id,changed:seal.changes,...proof,
   dbEvidence:'designated-operator independent read-only post-install attestation',openedBranches:0,businessWrites:0,publicationAttempts:1};
  writeFileSync(join(e.RUNNER_TEMP,'r4-finance-admin-prod-receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
 }catch(error){await postRollback(current);throw Error('POSTREAD_FAILED_WEB_ROLLED_BACK '+error.message);}
}
async function main(){
 scope();const mode=process.argv[2];
 if(mode==='verify'){
  await artifactSource();const r=composeWeb(join(e.RUNNER_TEMP,'base'),join(e.RUNNER_TEMP,'candidate'));
  console.log(JSON.stringify({status:'R4_OWNER_EXACT_ADMIN_CANDIDATE_PASS',files:Object.keys(r.files).length,changes:r.changes}));return;
 }
 if(mode==='admit'){sealed();await bound();await baseRead();console.log('R4_OWNER_PROD_RECOVERY_ADMISSION_PASS_NO_DB_WRITE_NO_POST');return;}
 if(mode==='publish')return publish();
 throw Error('MODE_DENIED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
 try{writeFileSync(join(e.RUNNER_TEMP,'r4-finance-admin-prod-hold.json'),JSON.stringify({status:'HOLD',source:e.GITHUB_SHA,posted,attempted,rollbackPosted,reason:String(error.message).slice(0,250)})+'\n')}catch{}
 console.error('R4_PLATFORM_PROD_HOLD '+String(error.message).slice(0,250));process.exitCode=1;
});

