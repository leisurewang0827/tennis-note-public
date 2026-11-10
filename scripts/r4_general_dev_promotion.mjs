// Guarded administrator-only DEV promotion; unknown write outcome never retries.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {request as httpsRequest} from 'node:https';
import {patchWrangler} from './r4_internal_registration_dev.mjs';
import {walk,compose,readTarget} from './r4_general_dev_source.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const promotionPath='release-promotions/r4-general-dev/promotion.json';
const sourcePaths=['.github/workflows/r4-general-dev-source.yml','release-sources/r4-general-dev/general-ui.js','release-sources/r4-general-dev/policy.json','scripts/r4_general_dev_source.mjs','scripts/check_r4_general_dev_source.mjs'].sort();
const promotionPaths=['.github/workflows/r4-general-dev-promotion.yml','release-promotions/r4-general-dev/promotion.json','scripts/r4_general_dev_promotion.mjs','scripts/check_r4_general_dev_promotion.mjs'].sort();
export function validateOff(p,policy) {
  assert.match(p.sourceCommit||'',/^[a-f0-9]{40}$/);for(const k of ['sourceRunId','artifactId'])assert.ok(Number.isSafeInteger(p[k])&&p[k]>0);
  for(const k of ['artifactDigest','sealSha256','devOffReceiptSha256','qaReceiptSha256'])assert.match(p[k]||'',/^[a-f0-9]{64}$/);
  const q=p.qaReceipt;assert.ok(q&&typeof q==='object'&&!Array.isArray(q));assert.equal(hash(JSON.stringify(q)),p.qaReceiptSha256);
  assert.equal(q.approved,true);assert.equal(q.sourceCommit,p.sourceCommit);assert.equal(q.sourceRunId,p.sourceRunId);
  assert.equal(q.artifactDigest,p.artifactDigest);assert.equal(q.sealSha256,p.sealSha256);assert.equal(q.moduleSha256,policy.moduleSha256);assert.equal(q.sqlSha256,policy.sqlSha256);
  const r=p.devOffReceipt;assert.ok(r&&typeof r==='object'&&!Array.isArray(r));assert.equal(hash(JSON.stringify(r)),p.devOffReceiptSha256);
  assert.equal(r.targetFingerprint,policy.targetFingerprint);assert.equal(r.sqlSha256,policy.sqlSha256);assert.equal(r.sourceCommit,p.sourceCommit);
  assert.equal(r.sourceRunId,p.sourceRunId);assert.equal(r.artifactDigest,p.artifactDigest);assert.equal(r.rosterOff,true);assert.equal(r.lessonOff,true);
  assert.equal(r.activeLeases,0);assert.equal(r.existingRecordsPreserved,true);assert.equal(r.legacySwitchesUnchanged,true);
  assert.equal(r.rpcAclOk,true);assert.equal(r.privateRlsAclOk,true);assert.equal(r.productionWrites,0);
}
function scope(p,policy) {
  assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(process.env.GITHUB_REF,`refs/heads/${policy.branch}`);
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');const sha=process.env.GITHUB_SHA;assert.match(sha||'',/^[a-f0-9]{40}$/);
  const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim(),paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
  assert.equal(git('rev-list','--parents','-n','1',sha),`${sha} ${p.sourceCommit}`);assert.deepEqual(paths(p.sourceCommit,sha),promotionPaths);
  assert.equal(git('rev-list','--parents','-n','1',p.sourceCommit),`${p.sourceCommit} ${policy.parent}`);assert.deepEqual(paths(policy.parent,p.sourceCommit),sourcePaths);
  assert.equal(hash(read('scripts/r4_internal_registration_dev.mjs')),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677','TRANSPORT_SOURCE_DRIFT');return sha;
}
const creds=()=>{const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token&&gh);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);return {token,gh,base:`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin-dev`,api:'https://api.github.com/repos/leisurewang0827/tennis-note-public'};};
const get=async(url,token)=>{const r=await fetch(url,{method:'GET',headers:token?{Authorization:`Bearer ${token}`,Accept:'application/json'}:{},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'GET_FAILED');return r;};
async function admit(p,policy) {
  const c=creds(),run=await (await get(`${c.api}/actions/runs/${p.sourceRunId}`,c.gh)).json(),artifact=await (await get(`${c.api}/actions/artifacts/${p.artifactId}`,c.gh)).json();
  assert.equal(run.head_sha,p.sourceCommit);assert.equal(run.path,'.github/workflows/r4-general-dev-source.yml');assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);assert.equal(run.event,'push');
  assert.equal(artifact.workflow_run?.id,p.sourceRunId);assert.equal(artifact.name,`r4-general-dev-source-${p.sourceRunId}`);assert.equal(artifact.expired,false);assert.equal(artifact.digest,`sha256:${p.artifactDigest}`);
  const sealed=read('candidate/seal.json');assert.equal(hash(sealed),p.sealSha256);const seal=JSON.parse(sealed);
  assert.equal(seal.source,p.sourceCommit);assert.equal(seal.sqlSha256,policy.sqlSha256);assert.equal(seal.baseSealSha256,policy.baseSealSha256);
  const current=walk('candidate/admin');assert.deepEqual(Object.fromEntries(Object.entries(current).map(([k,v])=>[k,hash(v)])),seal.admin);
  const expected=compose({files:walk('base/admin'),sealBytes:read('base/seal.json'),module:read('release-sources/r4-general-dev/general-ui.js'),policy});assert.deepEqual(seal.admin,expected.hashes);
  await readTarget(policy);console.log('GENERAL_DEV_PROMOTION_ADMISSION_PASS');
}
export function rollbackDecision({uncertain,knownPublished,currentId,publishedId,immutableMismatch}) {return !uncertain&&knownPublished&&immutableMismatch&&publishedId&&currentId===publishedId?'ROLLBACK_ONCE':'HOLD';}
let rollbackSent=false;
export async function rollbackOnce(url,token,requester=httpsRequest) {
  const target=new URL(url);assert.equal(target.protocol,'https:');assert.equal(target.host,'api.cloudflare.com');
  assert.match(target.pathname,/^\/client\/v4\/accounts\/[a-f0-9]{32}\/pages\/projects\/tennisnote-admin-dev\/deployments\/200eb1ac-8718-4cd7-904c-3c7426ce90d2\/rollback$/);
  assert.equal(target.search,'');assert.equal(target.hash,'');assert.ok(token);assert.equal(rollbackSent,false);rollbackSent=true;
  return await new Promise((resolve,reject)=>{const req=requester(target,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}},res=>{
    let size=0,chunks=[];res.on('data',c=>{size+=c.length;if(size>1048576){req.destroy(Error('large'));return;}chunks.push(c);});res.on('error',reject);res.on('end',()=>{try{assert.equal(res.statusCode,200);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).success,true);resolve(true);}catch{reject(Error('ROLLBACK_UNKNOWN'));}});});
    req.on('error',()=>reject(Error('ROLLBACK_UNKNOWN')));req.setTimeout(20000,()=>req.destroy(Error('timeout')));req.end();});
}
async function post(p,policy) {
  const c=creds(),response=await (await get(c.base,c.token)).json(),current=response.result?.canonical_deployment;
  assert.equal(response.success,true);assert.equal(response.result?.name,policy.project);assert.equal(response.result?.production_branch,'dev');
  assert.match(current?.id||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.notEqual(current.id,policy.canonicalId);
  assert.equal(current.deployment_trigger?.metadata?.branch,'dev');assert.equal(current.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);assert.equal(current.latest_stage?.status,'success');
  const immutable=`https://${current.id.slice(0,8)}.tennisnote-admin-dev.pages.dev`;assert.equal(immutable,process.env.PUBLISHED_URL,'PUBLISHED_ID_UNCERTAIN');
  const sealBytes=read('candidate/seal.json');assert.equal(hash(sealBytes),p.sealSha256);const seal=JSON.parse(sealBytes);let immutableMatch=true,liveMatch=true;
  for(const path of ['index.html','r4-general-dev.js','shared/config.local.js','release.json','r4-onboarding.js'])for(const [base,isImmutable] of [[immutable,true],['https://tennisnote-admin-dev.pages.dev',false]]) {
    const bytes=Buffer.from(await (await get(base+(path==='index.html'?'/':`/${path}`))).arrayBuffer());if(hash(bytes)!==seal.admin[path]){if(isImmutable)immutableMatch=false;else liveMatch=false;}
  }
  const fresh=await (await get(c.base,c.token)).json();assert.equal(fresh.success,true);assert.equal(fresh.result?.name,policy.project);assert.equal(fresh.result?.production_branch,'dev');assert.equal(fresh.result?.canonical_deployment?.id,current.id,'CANONICAL_FINAL_DRIFT');assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);
  if(!immutableMatch){appendFileSync(process.env.GITHUB_OUTPUT,`definite_mismatch=true\ndeployment_id=${current.id}\n`);throw Error('IMMUTABLE_MISMATCH');}
  assert.equal(liveMatch,true,'LIVE_READBACK_UNCERTAIN');console.log(JSON.stringify({status:'GENERAL_DEV_ADMIN_POSTCHECK_PASS',deploymentId:current.id,rollbackId:policy.canonicalId,immutable}));
}
async function rollback(p,policy) {
  const c=creds(),published=process.env.PUBLISHED_DEPLOYMENT_ID,project=await (await get(c.base,c.token)).json(),current=project.result?.canonical_deployment;
  assert.equal(project.success,true);assert.equal(project.result?.name,policy.project);assert.equal(project.result?.production_branch,'dev');
  assert.match(published||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(rollbackDecision({uncertain:false,knownPublished:true,currentId:current?.id,publishedId:published,immutableMismatch:process.env.DEFINITE_MISMATCH==='true'}),'ROLLBACK_ONCE');
  assert.equal(current?.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);
  const prior=await (await get(`${c.base}/deployments/${policy.canonicalId}`,c.token)).json();assert.equal(prior.success,true);assert.equal(prior.result?.id,policy.canonicalId);assert.equal(prior.result?.latest_stage?.status,'success');assert.equal(prior.result?.deployment_trigger?.metadata?.branch,'dev');assert.equal(prior.result?.deployment_trigger?.metadata?.commit_hash,policy.baseSource);
  const fresh=await (await get(c.base,c.token)).json();assert.equal(fresh.success,true);assert.equal(fresh.result?.name,policy.project);assert.equal(fresh.result?.production_branch,'dev');assert.equal(fresh.result?.canonical_deployment?.id,published);assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);
  await rollbackOnce(`${c.base}/deployments/${policy.canonicalId}/rollback`,c.token);await readTarget(policy);console.log('GENERAL_DEV_ADMIN_ROLLBACK_POSTCHECK_PASS');
}
async function main() {
  const p=json(promotionPath),policy=json('release-sources/r4-general-dev/policy.json');validateOff(p,policy);scope(p,policy);
  if(process.argv[2]==='admit')return admit(p,policy);
  if(process.argv[2]==='prepare'){const dir=join(process.env.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assert.equal(json(join(dir,'package.json')).version,'3.90.0');writeFileSync(join(dir,'wrangler-dist/cli-r4-single.cjs'),patchWrangler(read(join(dir,'wrangler-dist/cli.js'))),{flag:'wx'});return;}
  if(process.argv[2]==='post')return post(p,policy);if(process.argv[2]==='rollback')return rollback(p,policy);throw Error('INVALID_MODE');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('GENERAL_DEV_PROMOTION_BLOCKED');process.exitCode=1;});
