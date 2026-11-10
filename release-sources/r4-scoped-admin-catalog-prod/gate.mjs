import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve,dirname} from 'node:path';
import {request as httpsRequest} from 'node:https';
import {compose} from './compose.mjs';
import {template} from './bind-standing.mjs';
import {appendFileSync,mkdirSync} from 'node:fs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const fixed=Object.freeze(JSON.parse(readFileSync(new URL('./policy.json',import.meta.url))));
const templateHash=sha(template);
export function verifyOff(packet,source) {
  assert.match(source,/^[a-f0-9]{40}$/);
  assert.equal(packet.sourceCommit,source);
  assert.equal(packet.targetFingerprint,fixed.productionFingerprint);
  assert.equal(packet.installSha256,templateHash);
  assert.equal(packet.recoveryId,fixed.prior.id);
  assert.ok(Number.isSafeInteger(packet.sourceRunId)&&packet.sourceRunId>0);
  assert.ok(Number.isSafeInteger(packet.artifactId)&&packet.artifactId>0);
  for(const k of ['artifactDigest','candidateSeal','functionDefinition','boundInstallSha256']) assert.match(packet[k],/^[a-f0-9]{64}$/);
  const d=packet.readback;
  assert.equal(packet.readbackSha256,sha(JSON.stringify(d)));
  for(const k of ['off','authOnly','oldOff','adminBound','recordsPreserved','standingProtected'])assert.equal(d[k],true,k);
  for(const k of ['grants','activeGrants','effectiveGrants'])assert.equal(d[k],0,k);
  assert.equal(d.functionDefinition,packet.functionDefinition);
}
const assertDeployment=(d,id,source)=>{
  assert.equal(d?.id,id);assert.equal(d?.latest_stage?.status,'success');
  assert.equal(d?.deployment_trigger?.metadata?.branch,fixed.productionBranch);
  assert.equal(d?.deployment_trigger?.metadata?.commit_hash,source);
};
export function verifyBaseline(project,previous,artifact,now=Date.now()){
  assert.equal(project?.name,fixed.project);assert.equal(project?.production_branch,fixed.productionBranch);
  assertDeployment(project.canonical_deployment,fixed.prior.id,fixed.prior.source);
  assertDeployment(previous,fixed.prior.id,fixed.prior.source);
  assert.equal(previous.url,fixed.prior.url);
  assert.equal(artifact.id,fixed.prior.artifact);assert.equal(artifact.workflow_run?.id,fixed.prior.run);
  assert.equal(artifact.digest,'sha256:'+fixed.prior.digest);
  assert.equal(artifact.expired,false);assert.ok(Date.parse(artifact.expires_at)>now);
}
export function verifyPost(project,id,source){
  assert.equal(project?.name,fixed.project);assert.equal(project?.production_branch,fixed.productionBranch);
  assert.match(id||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.notEqual(id,fixed.prior.id);
  assertDeployment(project.canonical_deployment,id,source);
}
export function rollbackDecision({publishedId,canonicalId,immutableMismatch,uncertain,recoveryVerified}){
  return !uncertain&&recoveryVerified===true&&immutableMismatch===true&&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(publishedId||'')&&
    publishedId!==fixed.prior.id&&canonicalId===publishedId?'EXACT_PRIOR_ONCE':'HOLD';
}
async function get(url,token){
  const r=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{}});
  assert.equal(r.status,200,'READBACK_FAILED');return r;
}
async function verifyAssets(origin,seal,paths){
  for(const p of paths){
    const bytes=Buffer.from(await (await get(origin+(p==='index.html'?'/':'/'+p))).arrayBuffer());
    assert.equal(sha(bytes),seal.admin[p],'ASSET_DRIFT');
  }
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sha40=x=>/^[a-f0-9]{40}$/.test(x||'');
const promotionPath='release-promotions/r4-scoped-admin-catalog-prod/promotion.json';
function requireWorkflow(){
  const env=process.env;
  assert.equal(env.GITHUB_REPOSITORY,fixed.repository);assert.equal(env.GITHUB_REF,fixed.branch);
  assert.equal(env.GITHUB_EVENT_NAME,'push');assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
  assert.ok(sha40(env.GITHUB_SHA));assert.equal(git('rev-parse','HEAD'),env.GITHUB_SHA);
  return env;
}
function credentials(){
  const env=requireWorkflow();
  const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.R4_ADMIN_CLOUDFLARE_API_TOKEN;
  assert.match(account||'',/^[a-f0-9]{32}$/);assert.equal(sha(account),env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  assert.ok(token&&env.GH_TOKEN);
  return {cf:'https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+fixed.project,
    gh:'https://api.github.com/repos/'+fixed.repository,token,github:env.GH_TOKEN};
}
async function protectedBase({cf,gh,token,github}){
  const [a,b,c]=await Promise.all([(await get(cf,token)).json(),(await get(cf+'/deployments/'+fixed.prior.id,token)).json(),
    (await get(gh+'/actions/artifacts/'+fixed.prior.artifact,github)).json()]);
  assert.equal(a.success,true);assert.equal(b.success,true);verifyBaseline(a.result,b.result,c);
  const bytes=readFileSync('prod-base/seal.json');assert.equal(sha(bytes),fixed.prior.seal);
  const seal=JSON.parse(bytes);const paths=['index.html','views/settings.js','r4-scoped-member-catalog.js','r4-onboarding.js','r4-prod-private-catalog-host.js','shared/config.local.js','release.json'];
  assert.deepEqual(seal.admin,walk('prod-base/admin'));
  await Promise.all([verifyAssets(fixed.origin,seal,paths),verifyAssets(fixed.prior.url,seal,paths)]);
  const last=await (await get(cf,token)).json();assert.equal(last.success,true);verifyBaseline(last.result,b.result,c);
  console.log('PROD_PRIVATE_CATALOG_RECOVERY_BASE_VERIFIED');
}
function walk(dir,prefix=''){
  const map={};
  for(const e of readdirSync(dir,{withFileTypes:true})){
    assert.ok(!e.isSymbolicLink());const n=prefix+e.name;
    if(e.isDirectory())Object.assign(map,walk(join(dir,e.name),n+'/'));
    else {assert.ok(e.isFile());map[n]=sha(readFileSync(join(dir,e.name)));}
  }
  return map;
}

function files(root,paths=Object.keys(walk(root))) {
  return Object.fromEntries(paths.map(n=>[n,readFileSync(join(root,n))]));
}
const build=(base='prod-base')=>compose({files:files(join(base,'admin')),sealBytes:readFileSync(join(base,'seal.json')),policy:fixed});
export function classification() {
  const env=requireWorkflow(), h=env.GITHUB_SHA;
  const parent=git('rev-list','--parents','-n','1',h).split(' ');
  assert.equal(parent.length,2);
  const changes=git('diff','--name-only',parent[1],h).split('\n').sort();
  const paths=[fixed.workflow,...['module.js','compose.mjs','gate.mjs','check.mjs','policy.json','standing.sql','bind-standing.mjs','check-standing-db.mjs'].map(n=>'release-sources/r4-scoped-admin-catalog-prod/'+n)].sort();
  if(parent[1]===fixed.parent){assert.deepEqual(changes,paths);return {stage:'source',source:h};}
  assert.deepEqual(changes,[promotionPath]);
  assert.deepEqual(git('rev-list','--parents','-n','1',parent[1]).split(' '),[parent[1],fixed.parent]);
  assert.deepEqual(git('diff','--name-only',fixed.parent,parent[1]).split('\n').sort(),paths);
  return {stage:'promotion',source:parent[1]};
}
export function expectedSeal(source,base='prod-base') {
  const built=build(base), delta=Object.fromEntries(built.changed.map(n=>[n,built.hashes[n]]));
  const seal={schema:1,source,baseSeal:fixed.prior.seal,installSha256:templateHash,delta,admin:built.hashes};
  return {built,bytes:Buffer.from(JSON.stringify(seal)+'\n'),seal};
}
function composeStage(){
  const {stage,source}=classification();assert.equal(stage,'source');
  const {built,bytes}=expectedSeal(source);
  for(const [name,data] of Object.entries(built.files)){
    const path=join('prod-candidate/admin',name);
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,data,{flag:'wx'});
  }
  writeFileSync('prod-candidate/seal.json',bytes,{flag:'wx'});
}
function promotion(){
  const {stage,source}=classification();assert.equal(stage,'promotion');
  const p=JSON.parse(readFileSync(promotionPath));
  verifyOff(p,source);
  return p;
}
function verifyCandidate(p){
  const result=expectedSeal(p.sourceCommit);
  const bytes=readFileSync('prod-candidate/seal.json');
  assert.equal(sha(bytes),p.candidateSeal);
  assert.deepEqual(bytes,result.bytes);
  assert.deepEqual(result.seal.admin,walk('prod-candidate/admin'));
  return result.seal;
}
async function admit(){
  const p=promotion(),c=credentials();
  const [run,a]=await Promise.all([(await get(c.gh+'/actions/runs/'+p.sourceRunId,c.github)).json(),
    (await get(c.gh+'/actions/artifacts/'+p.artifactId,c.github)).json()]);
  assert.equal(run.head_sha,p.sourceCommit);assert.equal(run.path,fixed.workflow);
  assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);assert.equal(run.event,'push');
  assert.equal(a.id,p.artifactId);assert.equal(a.workflow_run?.id,p.sourceRunId);
  assert.equal(a.name,'r4-scoped-admin-catalog-prod-'+p.sourceRunId);
  assert.equal(a.digest,'sha256:'+p.artifactDigest);assert.equal(a.expired,false);
  assert.ok(Date.parse(a.expires_at)>Date.now());
  verifyCandidate(p);
  await protectedBase(c);
  console.log('SCOPED_PROD_ADMIN_RETARGET_ADMISSION_PASS');
}
async function prepare(){
  promotion();
  const root=join(process.env.RUNNER_TEMP||'','r4-wrangler/node_modules/wrangler');
  assert.equal(JSON.parse(readFileSync(join(root,'package.json'))).version,'3.90.0');
  const {patchProductionWrangler}=await import(new URL('../../scripts/r4_internal_registration_prod_promotion.mjs',import.meta.url));
  writeFileSync(join(root,'wrangler-dist/cli-r4-single.cjs'),patchProductionWrangler(readFileSync(join(root,'wrangler-dist/cli.js'))),{flag:'wx'});
}
async function canonical(c){
  const x=await (await get(c.cf,c.token)).json();assert.equal(x.success,true);return x.result;
}
const immutableUrl=id=>'https://'+id.slice(0,8)+'.tennisnote-admin.pages.dev';
async function matchBytes(origin,seal,paths){
  let same=true;
  for(const p of paths){
    const r=await get(origin+(p==='index.html'?'/':'/'+p));
    if(sha(Buffer.from(await r.arrayBuffer()))!==seal.admin[p])same=false;
  }
  return same;
}
async function post(){
  const p=promotion(),c=credentials();
  const proj=await canonical(c),id=proj.canonical_deployment?.id;
  verifyPost(proj,id,p.sourceCommit);
  const immutable=immutableUrl(id);
  assert.equal(immutable,process.env.PUBLISHED_URL,'PUBLISHED_OUTCOME_UNCERTAIN');
  const seal=verifyCandidate(p),paths=[...Object.keys(seal.delta),'shared/config.local.js','release.json'];
  const [immutableOk,originOk]=await Promise.all([matchBytes(immutable,seal,paths),matchBytes(fixed.origin,seal,paths)]);
  verifyPost(await canonical(c),id,p.sourceCommit);
  if(!immutableOk){
    appendFileSync(process.env.GITHUB_OUTPUT,`definite_mismatch=true\ndeployment_id=${id}\n`);
    throw Error('IMMUTABLE_BYTES_MISMATCH');
  }
  assert.equal(originOk,true,'CANONICAL_BYTES_UNCERTAIN');
  console.log(JSON.stringify({status:'SCOPED_PROD_ADMIN_POSTCHECK_PASS',deploymentId:id,recoveryId:fixed.prior.id}));
}
async function rollback(){
  const p=promotion(),c=credentials(),id=process.env.PUBLISHED_DEPLOYMENT_ID;
  assert.equal(process.env.DEFINITE_MISMATCH,'true');
  assert.equal(immutableUrl(id),process.env.PUBLISHED_URL);
  verifyPost(await canonical(c),id,p.sourceCommit);
  const baseline=readFileSync('prod-base/seal.json');
  assert.equal(sha(baseline),fixed.prior.seal);
  const seal=JSON.parse(baseline);
  assert.deepEqual(walk('prod-base/admin'),seal.admin);
  const prior=await (await get(c.cf+'/deployments/'+fixed.prior.id,c.token)).json();
  assert.equal(prior.success,true);assertDeployment(prior.result,fixed.prior.id,fixed.prior.source);
  assert.equal(prior.result.url,fixed.prior.url);
  const paths=['index.html','views/settings.js','r4-scoped-member-catalog.js','shared/config.local.js','release.json'];
  assert.equal(await matchBytes(fixed.prior.url,seal,paths),true);
  verifyPost(await canonical(c),id,p.sourceCommit);
  const target=new URL(c.cf+'/deployments/'+fixed.prior.id+'/rollback');
  assert.equal(target.origin,'https://api.cloudflare.com');
  assert.match(target.pathname,/^\/client\/v4\/accounts\/[a-f0-9]{32}\/pages\/projects\/tennisnote-admin\/deployments\/48d1aabf-b856-40a7-898c-fb9e979f3b88\/rollback$/);
  await new Promise((ok,no)=>{
    const req=httpsRequest(target,{method:'POST',agent:false,headers:{Authorization:'Bearer '+c.token,'Content-Length':0}},r=>{
      let body='',total=0;
      r.on('data',b=>{total+=b.length;if(total>100000)req.destroy();else body+=b;});
      r.on('aborted',()=>no(Error('ROLLBACK_UNCERTAIN')));
      r.on('error',no);r.on('end',()=>{try{assert.equal(r.statusCode,200);assert.equal(JSON.parse(body).success,true);ok();}catch(e){no(e);}});
    });
    req.on('error',no);req.setTimeout(12000,()=>req.destroy(Error('ROLLBACK_UNCERTAIN')));req.end();
  });
  await protectedBase(c);
  console.log('SCOPED_PROD_ADMIN_ROLLBACK_VERIFIED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const actions={classify:()=>{const v=classification();appendFileSync(process.env.GITHUB_OUTPUT,`stage=${v.stage}\nsource=${v.source}\n`);},
    compose:composeStage,preflight:()=>{assert.equal(classification().stage,'source');return protectedBase(credentials());},admit,prepare,post,rollback};
  try{assert.ok(Object.hasOwn(actions,process.argv[2]));await actions[process.argv[2]]();}
  catch(e){const reason=/^[A-Z_]{4,60}$/.test(e?.message||'')?e.message:'BINDING_OR_RESPONSE_ERROR';console.error('SCOPED_PROD_HOLD_NO_RETRY '+reason);process.exitCode=1;}
}
