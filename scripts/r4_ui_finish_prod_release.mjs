import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compose} from './r4_ui_finish_release.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(p);
const policyPath='release-sources/r4-ui-finish-prod/policy.json';
const receiptPath='release-sources/r4-ui-finish-prod/qa-receipt.json';
const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{
 assert.ok(!e.isSymbolicLink(),'SYMLINK_DENIED');return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,hash(read(join(dir,e.name)))]];
}));
const get=async(url,token)=>{const r=await fetch(url,{headers:token?{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'REMOTE_READ_FAILED');return r;};
const github=async path=>(await get('https://api.github.com/repos/leisurewang0827/tennis-note-public'+path,process.env.GH_TOKEN)).json();

// A receipt is an independently reviewed, privacy-free local evidence summary,
// bound into the reviewed commit. It is not a substitute for inspecting evidence.
export function receiptCheck(p,bytes){
 assert.match(p.authReceiptSha256||'',/^[0-9a-f]{64}$/,'DEV_RECEIPT_UNBOUND');
 assert.equal(hash(bytes),p.authReceiptSha256,'DEV_RECEIPT_DRIFT');
 const r=JSON.parse(bytes);
 assert.deepEqual(Object.keys(r).sort(),['schema','status','independentReview','behavioral','visual','unchangedContracts','newAuthExecutions','newAuthAccounts','businessWrites','productionWrites'].sort(),'DEV_RECEIPT_SHAPE');
 assert.equal(r.schema,2);
 assert.equal(r.status,'PASS');assert.equal(r.independentReview,'PASS');
 const b=r.behavioral,v=r.visual,u=r.unchangedContracts;
 assert.deepEqual(Object.keys(b).sort(),['privateSource','devSource','devRun','receiptDigests','authCases','sessionsClosed','baseOff','workflowOff','linksClosed','leaseRestored'].sort(),'BEHAVIORAL_SHAPE');
 assert.equal(b.privateSource,p.behavioral.privateSource);assert.equal(b.devSource,p.behavioral.devSource);assert.equal(b.devRun,p.behavioral.devRun);assert.deepEqual(b.receiptDigests,p.behavioral.receiptDigests);
 assert.equal(b.authCases,8);assert.equal(b.sessionsClosed,10);assert.equal(b.baseOff,true);assert.equal(b.workflowOff,true);assert.equal(b.linksClosed,true);assert.equal(b.leaseRestored,true);
 assert.deepEqual(Object.keys(v).sort(),['privateSource','devSource','devRun','artifactId','artifactDigest','cssSha256','jsSha256','token','localRasterCases','localEvidenceDigest','hostedEvidenceDigest','hostedVisual'].sort(),'VISUAL_SHAPE');
 assert.equal(v.privateSource,p.privateSource);assert.equal(v.devSource,p.devSource);assert.equal(v.devRun,p.dev.run);assert.equal(v.artifactId,p.dev.artifactId);assert.equal(v.artifactDigest,p.dev.digest);
 assert.equal(v.cssSha256,p.cssSha256);assert.equal(v.jsSha256,p.jsSha256);assert.equal(v.token,p.visual.token);assert.equal(v.localRasterCases,4);assert.equal(v.localEvidenceDigest,p.visual.localEvidenceDigest);assert.match(p.visual.hostedEvidenceDigest||'',/^[0-9a-f]{64}$/,'HOSTED_VISUAL_UNBOUND');assert.equal(v.hostedEvidenceDigest,p.visual.hostedEvidenceDigest);assert.equal(v.hostedVisual,'PASS');
 assert.deepEqual(u,{jsUnchanged:true,authContractUnchanged:true,dbContractUnchanged:true,independentReuseReview:'PASS'});
 assert.equal(r.newAuthExecutions,0);assert.equal(r.newAuthAccounts,0);assert.equal(r.businessWrites,0);assert.equal(r.productionWrites,0);
 return r;
}
export function validateSuccessor(p,prior,parentLine,paths,sha,priorParentLine){
 assert.equal(p.parent,'3cd8cf4e9344205969435516e34d993af070856b','PRODUCTION_PARENT_DRIFT');
 assert.equal(p.devSource,'ca5528d3b7b8cd1b9ef41c4cefd7122d9671af57','VISUAL_SOURCE_DRIFT');
 assert.equal(priorParentLine,p.parent+' '+p.devSource,'PRIOR_PARENT_DRIFT');
 assert.deepEqual({...p,parent:prior.parent},prior,'POLICY_SCOPE_DRIFT');
 assert.equal(parentLine,sha+' '+p.parent,'PARENT_DRIFT');
 assert.deepEqual([...paths].sort(),['.github/workflows/r4-ui-finish-prod.yml','release-sources/r4-ui-finish-prod/policy.json','scripts/check_r4_ui_finish_prod_release.mjs','scripts/r4_ui_finish_prod_release.mjs'].sort(),'SUCCESSOR_SCOPE_DRIFT');
}
function admission(p){
 assert.equal(p.schema,2);assert.equal(p.repository,'leisurewang0827/tennis-note-public');
 assert.match(p.privateSource||'',/^[0-9a-f]{40}$/,'VISUAL_PRIVATE_UNBOUND');assert.match(p.devSource||'',/^[0-9a-f]{40}$/,'VISUAL_DEV_UNBOUND');
 assert.match(p.composeSha256||'',/^[0-9a-f]{64}$/,'COMPOSE_UNBOUND');assert.ok(Number.isSafeInteger(p.dev.run)&&Number.isSafeInteger(p.dev.artifactId));assert.match(p.dev.digest||'',/^[0-9a-f]{64}$/);assert.match(p.dev.sealHash||'',/^[0-9a-f]{64}$/);assert.ok(p.dev.name);
 assert.match(p.authReceiptSha256||'',/^[0-9a-f]{64}$/,'DEV_RECEIPT_UNBOUND');
 receiptCheck(p,read(receiptPath));
 assert.equal(process.env.GITHUB_REPOSITORY,p.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+p.branch);
 assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 const sha=process.env.GITHUB_SHA;assert.match(sha||'',/^[0-9a-f]{40}$/);
 const parentLine=execFileSync('git',['rev-list','--parents','-n','1',sha],{encoding:'utf8'}).trim();
 const priorParentLine=execFileSync('git',['rev-list','--parents','-n','1',p.parent],{encoding:'utf8'}).trim();
 const prior=JSON.parse(execFileSync('git',['show',p.parent+':'+policyPath],{encoding:'utf8'}));
 const paths=execFileSync('git',['diff','--name-only',p.parent,sha],{encoding:'utf8'}).trim().split('\n').sort();
 validateSuccessor(p,prior,parentLine,paths,sha,priorParentLine);
 assert.equal(hash(read('scripts/r4_ui_finish_release.mjs')),p.composeSha256,'COMPOSE_SOURCE_DRIFT');
 return sha;
}
export function validateRunMetadata(run,jobs,spec,mode){
 assert.equal(run.head_sha,spec.source);assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
 assert.equal(run.event,mode==='dev'?'push':'workflow_dispatch');
 assert.equal(run.head_branch,mode==='dev'?'codex/tennisnote-r4-ui-finish-dev-20261108':'codex/tennisnote-r4-admin-prod-candidate','ARTIFACT_BRANCH_DRIFT');
 assert.equal(run.path,mode==='dev'?'.github/workflows/r4-ui-finish-dev.yml':'.github/workflows/deploy-cloudflare-pages.yml','ARTIFACT_WORKFLOW_DRIFT');
 for(const name of mode==='dev'?['verify','deploy']:[mode==='admin'?'coach-verify':'notice-verify']) {
  const matches=jobs.jobs.filter(job=>job.name===name);assert.equal(matches.length,1,'ARTIFACT_JOB_MISSING');assert.equal(matches[0].conclusion,'success','ARTIFACT_JOB_FAILED');
 }
}
async function artifact(spec,dir,mode){
 const run=await github('/actions/runs/'+spec.run),a=await github('/actions/artifacts/'+spec.artifactId);
 const jobs=await github('/actions/runs/'+spec.run+'/jobs?per_page=100');validateRunMetadata(run,jobs,spec,mode);
 assert.equal(a.workflow_run.id,spec.run);assert.equal(a.name,spec.name);assert.equal(a.digest,'sha256:'+spec.digest);assert.equal(a.expired,false);
 const bytes=read(join(dir,'seal.json'));assert.equal(hash(bytes),spec.sealHash,'SEAL_DRIFT');const seal=JSON.parse(bytes);assert.equal(seal.sha,spec.source);
 if(mode==='admin')assert.deepEqual(walk(join(dir,'prod')),seal.prod.files,'ADMIN_BASE_DRIFT');
 if(mode==='coach')assert.deepEqual(walk(join(dir,'prod')),seal.files,'COACH_BASE_DRIFT');
 if(mode==='dev'){assert.deepEqual(walk(join(dir,'admin')),seal.admin,'DEV_ADMIN_DRIFT');assert.deepEqual(walk(join(dir,'coach')),seal.coach,'DEV_COACH_DRIFT');}
 return seal;
}
async function bases(p){
 const admin=await artifact(p.admin,'prod-base-admin','admin'),coach=await artifact(p.coach,'prod-base-coach','coach');
 const dev=await artifact({...p.dev,source:p.devSource},'dev-ui','dev');
 const css=read('dev-ui/admin/r4-ui-finish.css'),js=read('dev-ui/admin/r4-ui-finish.js');
 assert.equal(hash(css),p.cssSha256);assert.equal(hash(js),p.jsSha256);
 assert.equal(hash(read('dev-ui/coach/tennis-note-coach-app/r4-ui-finish.css')),p.cssSha256);
 assert.equal(hash(read('dev-ui/coach/tennis-note-coach-app/r4-ui-finish.js')),p.jsSha256);
 assert.equal(hash(read('release-sources/r4-ui-finish/r4-ui-finish.css')),p.cssSha256);assert.equal(hash(read('release-sources/r4-ui-finish/r4-ui-finish.js')),p.jsSha256);
 return {a:admin.prod.files,c:coach.files,dev,css,js};
}
async function live(p,a,c){
 for(const [project,path,key,files] of [[p.admin.project,'/','index.html',a],[p.admin.project,'/shared/config.local.js','shared/config.local.js',a],[p.admin.project,'/release.json','release.json',a],[p.coach.project,'/','index.html',c],[p.coach.project,'/shared/config.local.js','shared/config.local.js',c],[p.coach.project,'/release.json','release.json',c],[p.coach.project,'/tennis-note-coach-app/','tennis-note-coach-app/index.html',c],[p.coach.project,'/tennis-note-coach-app/service-worker.js','tennis-note-coach-app/service-worker.js',c]]){
  const bytes=Buffer.from(await(await get('https://'+project+'.pages.dev'+path)).arrayBuffer());assert.equal(hash(bytes),files[key],'LIVE_BASE_DRIFT');
  if(path==='/shared/config.local.js'){const cfg=bytes.toString();assert.ok(cfg.includes('production')&&cfg.includes(p.projectFingerprint)&&!/service_role|PORTONE_API_SECRET/i.test(cfg),'PROD_CONFIG_DRIFT');}
 }
}
const delta=(before,after)=>Object.keys({...before,...after}).filter(k=>before[k]!==after[k]).sort();
async function build(p,sha){
 const {a,c,css,js}=await bases(p);await live(p,a,c);
 const out=compose({adminIndex:read('prod-base-admin/prod/index.html'),coachIndex:read('prod-base-coach/prod/tennis-note-coach-app/index.html'),coachWorker:read('prod-base-coach/prod/tennis-note-coach-app/service-worker.js'),css,js});
 mkdirSync('prod-ui-release');cpSync('prod-base-admin/prod','prod-ui-release/admin',{recursive:true,errorOnExist:true});cpSync('prod-base-coach/prod','prod-ui-release/coach',{recursive:true,errorOnExist:true});
 for(const [dir,index] of [['prod-ui-release/admin',out.admin],['prod-ui-release/coach/tennis-note-coach-app',out.coach]]){writeFileSync(join(dir,'index.html'),index);writeFileSync(join(dir,'r4-ui-finish.css'),css);writeFileSync(join(dir,'r4-ui-finish.js'),js);}
 writeFileSync('prod-ui-release/coach/tennis-note-coach-app/service-worker.js',out.worker);
 const aa=walk('prod-ui-release/admin'),cc=walk('prod-ui-release/coach');
 assert.deepEqual(delta(a,aa),['index.html','r4-ui-finish.css','r4-ui-finish.js'].sort());
 assert.deepEqual(delta(c,cc),['tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js','tennis-note-coach-app/r4-ui-finish.css','tennis-note-coach-app/r4-ui-finish.js'].sort());
 writeFileSync('prod-ui-release/seal.json',JSON.stringify({sha,policyHash:hash(read(policyPath)),receiptHash:p.authReceiptSha256,admin:aa,coach:cc})+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PROD_CANDIDATE_BUILT',sha,adminChanged:3,coachChanged:4}));
}
async function verifyTarget(p,sha,post=false){
 const seal=JSON.parse(read('prod-ui-release/seal.json'));assert.equal(seal.sha,sha);assert.equal(seal.policyHash,hash(read(policyPath)));assert.equal(seal.receiptHash,p.authReceiptSha256);
 assert.deepEqual(walk('prod-ui-release/admin'),seal.admin);assert.deepEqual(walk('prod-ui-release/coach'),seal.coach);
 const {a,c}=await bases(p);if(!post)await live(p,a,c);
 const account=process.env.CLOUDFLARE_ACCOUNT_ID;assert.match(account||'',/^[0-9a-f]{32}$/);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 for(const [spec,token] of [[p.admin,process.env.PROD_ADMIN_TOKEN],[p.coach,process.env.PROD_COACH_TOKEN]]){
  assert.ok(token,'PROD_TOKEN_MISSING');const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+spec.project;
  const data=await(await get(base,token)).json();const current=data.result?.canonical_deployment;assert.equal(data.success,true);assert.equal(data.result.name,spec.project);assert.equal(data.result.production_branch,'main');
  if(post){assert.ok(current?.id&&current.id!==spec.canonicalId,'NEW_DEPLOYMENT_REQUIRED');assert.equal(current.deployment_trigger?.metadata?.commit_hash,sha);}
  else {assert.equal(current?.id,spec.canonicalId,'CANONICAL_DRIFT');assert.equal(current.deployment_trigger?.metadata?.commit_hash,spec.source);}
  assert.equal(current.deployment_trigger?.metadata?.branch,'main');assert.equal(current.latest_stage?.status,'success');
  const old=await(await get(base+'/deployments/'+spec.canonicalId,token)).json();assert.equal(old.success,true);assert.equal(old.result.id,spec.canonicalId);assert.equal(old.result.latest_stage.status,'success');
  if(post)console.log(JSON.stringify({project:spec.project,deploymentId:current.id,rollbackId:spec.canonicalId}));
 }
 if(post){
  for(const [project,path,key,files] of [[p.admin.project,'/','index.html',seal.admin],[p.admin.project,'/shared/config.local.js','shared/config.local.js',seal.admin],[p.admin.project,'/release.json','release.json',seal.admin],[p.admin.project,'/r4-ui-finish.css','r4-ui-finish.css',seal.admin],[p.admin.project,'/r4-ui-finish.js','r4-ui-finish.js',seal.admin],[p.coach.project,'/','index.html',seal.coach],[p.coach.project,'/shared/config.local.js','shared/config.local.js',seal.coach],[p.coach.project,'/release.json','release.json',seal.coach],[p.coach.project,'/tennis-note-coach-app/','tennis-note-coach-app/index.html',seal.coach],[p.coach.project,'/tennis-note-coach-app/service-worker.js','tennis-note-coach-app/service-worker.js',seal.coach],[p.coach.project,'/tennis-note-coach-app/r4-ui-finish.css','tennis-note-coach-app/r4-ui-finish.css',seal.coach],[p.coach.project,'/tennis-note-coach-app/r4-ui-finish.js','tennis-note-coach-app/r4-ui-finish.js',seal.coach]])assert.equal(hash(Buffer.from(await(await get('https://'+project+'.pages.dev'+path)).arrayBuffer())),files[key],'PROD_POSTCHECK_DRIFT');
 }
 console.log(JSON.stringify({status:post?'PROD_POSTCHECK_PASS':'PROD_ADMISSION_PASS',sha}));
}
// Pure decision only. Unknown canonical state is never overwritten.
export function rollbackDecision(current,spec,sha){
 assert.equal(current?.deployment_trigger?.metadata?.branch,'main','ROLLBACK_BRANCH_DRIFT');
 assert.equal(current?.latest_stage?.status,'success','ROLLBACK_STAGE_UNKNOWN');
 if(current.id===spec.canonicalId && current.deployment_trigger.metadata.commit_hash===spec.source)return 'unchanged';
 if(current.deployment_trigger.metadata.commit_hash===sha && current.id!==spec.canonicalId)return 'rollback';
 throw Error('ROLLBACK_CANONICAL_DRIFT');
}
async function rollbackPartial(p,sha){
 assert.equal(process.env.DEPLOY_ADMISSION_OK,'true','ROLLBACK_ADMISSION_REQUIRED');
 assert.equal(process.env.APPROVED_SHA,sha,'APPROVED_SHA_REQUIRED');
 const account=process.env.CLOUDFLARE_ACCOUNT_ID;assert.match(account||'',/^[0-9a-f]{32}$/);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const {a,c}=await bases(p);
 const targets=[[p.admin,process.env.PROD_ADMIN_TOKEN],[p.coach,process.env.PROD_COACH_TOKEN]];
 const states=[];
 // Read both projects before any write; a drift in either makes the entire recovery HOLD.
 for(const [spec,token] of targets){
  assert.ok(token,'PROD_TOKEN_MISSING');const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+spec.project;
  const data=await(await get(base,token)).json();assert.equal(data.success,true);assert.equal(data.result.name,spec.project);assert.equal(data.result.production_branch,'main');
  const old=await(await get(base+'/deployments/'+spec.canonicalId,token)).json();assert.equal(old.success,true);assert.equal(old.result.id,spec.canonicalId);assert.equal(old.result.latest_stage.status,'success');assert.equal(old.result.deployment_trigger?.metadata?.commit_hash,spec.source);assert.equal(old.result.deployment_trigger?.metadata?.branch,'main');
  states.push({spec,token,base,decision:rollbackDecision(data.result.canonical_deployment,spec,sha)});
 }
 for(const item of states){
  if(item.decision==='unchanged')continue;
  // Cloudflare rollback has no compare-and-swap parameter. Recheck immediately;
  // the approved single-publisher/no-competing-deployment condition is required.
  const fresh=await(await get(item.base,item.token)).json();assert.equal(fresh.success,true);assert.equal(rollbackDecision(fresh.result?.canonical_deployment,item.spec,sha),'rollback','ROLLBACK_RECHECK_DRIFT');
  const response=await fetch(item.base+'/deployments/'+item.spec.canonicalId+'/rollback',{method:'POST',headers:{Authorization:'Bearer '+item.token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,'ROLLBACK_RESPONSE_UNCERTAIN');const body=await response.json();assert.equal(body.success,true,'ROLLBACK_RESPONSE_UNCERTAIN');
 }
 for(const item of states){
  const fresh=await(await get(item.base,item.token)).json();assert.equal(fresh.success,true);assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,item.spec.source,'ROLLBACK_POSTCHECK_DRIFT');assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.branch,'main');assert.equal(fresh.result?.canonical_deployment?.latest_stage?.status,'success');
 }
 await live(p,a,c);console.log(JSON.stringify({status:'ROLLBACK_POSTCHECK_PASS',sha}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const p=JSON.parse(read(policyPath));const sha=admission(p);if(process.argv[2]==='build')await build(p,sha);else if(process.argv[2]==='deploy-check'||process.argv[2]==='post-check'){assert.equal(process.env.APPROVED_SHA,sha,'APPROVED_SHA_REQUIRED');await verifyTarget(p,sha,process.argv[2]==='post-check');}else if(process.argv[2]==='rollback-partial')await rollbackPartial(p,sha);else throw Error('INVALID_COMMAND');}
 catch(e){console.error('R4_UI_PROD_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
}
