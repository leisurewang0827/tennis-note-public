// New candidate admission. This module does not upload or issue a rollback request.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const fixed=Object.freeze({
  repository:'leisurewang0827/tennis-note-public',branch:'refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108',
  parent:'300b07bb0112b01cca833ec3cdb384a0987f7f25',
  project:'tennisnote-admin',productionBranch:'main',origin:'https://tennisnote-admin.pages.dev',
  productionFingerprint:'3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a',
  prior:{id:'bf15615b-d771-49fc-9359-74128e7248f3',source:'498cdb4167021c032bfa8fd79c1ee92ef31a4f14',
    url:'https://bf15615b.tennisnote-admin.pages.dev',artifact:13651365401,run:42564720753,
    digest:'44edc10edce4e72cd9114bb475ae90fd26c1664be989bc4588d692459e3d8c3c',
    seal:'dc73cac7dde5074a073ce1d55464d809a0e4f499b26a995f5efed018ec5de2c1'},
  candidate:{seal:'b494d676974e0ee4b6d0b0ca12ca7813d94a5af19d5ff98a991f493e5ae30d59',sql:'7695c664b5b51289eb727a6bcd279e9430d74b277a33906965d4d25ff3abdaf4',off:'45f10b02d85d89d59d4dc17db7050d8e975f94256ca6eb0ad85fe4f55e0b1397',readback:'f0a070037f87ac801633db6163bb210d1ef0cd417012f92fd2c84a9882b84579'},
  ownerDefinition:'e8366bd1a1fce390ccc694638105a82d8a06f1605004addd914c5ada792fce8d',
  functionDefinitions:{"public.tn_r4_prod_private_catalog_list(uuid)":"6347eb432de63e814cd8bbd63b399b8d009405b1d79dc3858e8161857909b6b1","private.tn_r4_prod_private_catalog_manager(uuid)":"4a2c541cd1ca6b20ee0672643d98bdc3454650c2cae33658fec2a2c331cf05ca","public.tn_r4_prod_private_catalog_register(uuid,uuid,uuid,jsonb)":"96adf8c15a345a1c53c805193883ec7bbf8ae4c338ea6a5832a4ffa73fc81277","private.tn_r4_prod_private_catalog_terms(private.tn_r4_prod_private_catalog_drafts)":"03759edfef310c7ec8162eed3743a109c057f682ad452152794fa003898affef","public.tn_r4_prod_private_catalog_save(uuid,uuid,text,integer,integer,integer,bigint)":"9997c7245a773b3b865827fd1069f36cb750503852928772474652b1d8e9acbc"}
});
export function verifyOff(packet,source){
  assert.match(source||'',/^[a-f0-9]{40}$/);
  assert.equal(packet.sourceCommit,source);
  assert.equal(packet.targetFingerprint,fixed.productionFingerprint);
  assert.deepEqual(packet.candidate,fixed.candidate);
  assert.ok(Number.isSafeInteger(packet.sourceRunId)&&packet.sourceRunId>0);
  assert.match(packet.artifactDigest||'',/^[a-f0-9]{64}$/);
  assert.equal(packet.readbackSha256,sha(JSON.stringify(packet.readback)));
  const s=packet.readback;
  for(const k of ['off','tablesProtected','apiProtected','authRoleConstrained','legacyOff','pilotOff'])assert.equal(s[k],true,k);
  for(const k of ['activeGrants','totalGrants','drafts','registrations','legacyActiveScopes'])assert.equal(s[k],0,k);
  assert.equal(s.ownerDefinition,fixed.ownerDefinition);
  assert.deepEqual(s.functionDefinitions,fixed.functionDefinitions);
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
const promotionPath='release-promotions/r4-private-catalog-prod/promotion.json';
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
  const seal=JSON.parse(bytes);const paths=['index.html','r4-onboarding.js','r4-production-draft-host.js','shared/config.local.js','r4-admin-release.json'];
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
export function verifyCandidate(sealBytes,assetHashes){
  assert.equal(sha(sealBytes),fixed.candidate.seal);
  const seal=JSON.parse(sealBytes);
  for(const k of ['sql','off','readback'])assert.equal(seal[k],fixed.candidate[k]);
  assert.equal(Object.keys(seal.admin).length,174);
  assert.deepEqual(seal.admin,assetHashes);return seal;
}
function promotion(){
  const env=requireWorkflow(),p=JSON.parse(readFileSync(promotionPath));
  assert.ok(sha40(p.sourceCommit));
  assert.deepEqual(git('rev-list','--parents','-n','1','HEAD').split(' '),[env.GITHUB_SHA,p.sourceCommit]);
  assert.deepEqual(git('diff','--name-only',p.sourceCommit,'HEAD').split('\n').sort(),
    ['.github/workflows/r4-private-catalog-prod-promotion.yml',promotionPath].sort());
  verifyOff(p,p.sourceCommit);
  assert.ok(Number.isSafeInteger(p.artifactId)&&p.artifactId>0);
  assert.equal(p.independentReview?.approved,true);
  assert.equal(p.independentReview?.sourceCommit,p.sourceCommit);
  assert.equal(p.independentReview?.candidateSeal,fixed.candidate.seal);
  assert.equal(p.recoveryId,fixed.prior.id);
  return p;
}
async function admit(){
  const p=promotion(),c=credentials();
  const [run,artifact]=await Promise.all([(await get(c.gh+'/actions/runs/'+p.sourceRunId,c.github)).json(),
    (await get(c.gh+'/actions/artifacts/'+p.artifactId,c.github)).json()]);
  assert.equal(run.head_sha,p.sourceCommit);assert.equal(run.path,'.github/workflows/r4-private-catalog-prod-source.yml');
  assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);assert.equal(run.event,'push');
  assert.equal(artifact.id,p.artifactId);assert.equal(artifact.workflow_run?.id,p.sourceRunId);
  assert.equal(artifact.name,'r4-private-catalog-prod-candidate-'+p.sourceRunId);
  assert.equal(artifact.digest,'sha256:'+p.artifactDigest);assert.equal(artifact.expired,false);
  assert.ok(Date.parse(artifact.expires_at)>Date.now());
  verifyCandidate(readFileSync('prod-candidate/seal.json'),walk('prod-candidate/admin'));
  await protectedBase(c);
  console.log('PROD_PRIVATE_CATALOG_ADMISSION_PASS');
}
async function prepare(){
  promotion();
  const root=join(process.env.RUNNER_TEMP||'','r4-wrangler/node_modules/wrangler');
  assert.equal(JSON.parse(readFileSync(join(root,'package.json'))).version,'3.90.0');
  const {patchProductionWrangler}=await import(new URL('../../scripts/r4_internal_registration_prod_promotion.mjs',import.meta.url));
  const file=join(root,'wrangler-dist/cli.js');
  writeFileSync(join(root,'wrangler-dist/cli-r4-single.cjs'),patchProductionWrangler(readFileSync(file)),{flag:'wx'});
}
async function post(){
  const p=promotion(),c=credentials();
  const current=async()=>{const x=await (await get(c.cf,c.token)).json();assert.equal(x.success,true);return x.result;};
  const project=await current(),id=project.canonical_deployment?.id;
  verifyPost(project,id,p.sourceCommit);
  const immutable='https://'+id.slice(0,8)+'.tennisnote-admin.pages.dev';
  assert.equal(immutable,process.env.PUBLISHED_URL,'PUBLISHED_OUTCOME_UNCERTAIN');
  const seal=verifyCandidate(readFileSync('prod-candidate/seal.json'),walk('prod-candidate/admin'));
  const paths=[...Object.keys(seal.delta),'shared/config.local.js','release.json'];
  await Promise.all([verifyAssets(fixed.origin,seal,paths),verifyAssets(immutable,seal,paths)]);
  verifyPost(await current(),id,p.sourceCommit);
  console.log(JSON.stringify({status:'PROD_PRIVATE_CATALOG_POSTCHECK_PASS',deploymentId:id,recoveryId:fixed.prior.id}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const actions={preflight:()=>protectedBase(credentials()),admit,prepare,post};
  try {assert.ok(Object.hasOwn(actions,process.argv[2]));await actions[process.argv[2]]();}
  catch{console.error('PROD_PRIVATE_CATALOG_HOLD_NO_RETRY');process.exitCode=1;}
}
