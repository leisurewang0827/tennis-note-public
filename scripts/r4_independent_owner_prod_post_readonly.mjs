// GET-only post-publish evidence. Does not deploy, roll back, or access DB/Auth.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compose} from '../release-sources/r4-independent-owner-prod/compose.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const original='42930191570',originalHead='019c6de29efd2d75e84cc690c70f01ceaeab62c5';
const source='7ba4e453e5e89540c0578db1dd76312c6f8d9442',sourceRun='42846945596';
const deployed='d0841b4a-a92a-4a87-a5c1-ae40436fb2a3',previous='2652a679-cc7b-4b85-a4d0-166c393faa0d';
const previousSource='bd848b8c8f893d3b7be0e2a763065e1ffaa8ec7c';
const candidateDigest='66eed766bd596422bbbd352641f1f1c7b67d2ab0bf8c4fee8e4a22a3ccadeeae',candidateSeal='44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b';
const baseDigest='ebf3da21e1672a93e66b9936747b976762e55f69bc19aad70133ec4ef6ee759a',baseSeal='5a7b6af33ac72f8ebd879b02555baa720cd309a01b10246af5af66cb9f4c54ad';
const targetHash='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const hosts=new Set(['api.github.com','api.cloudflare.com','tennisnote-admin.pages.dev','d0841b4a.tennisnote-admin.pages.dev','2652a679.tennisnote-admin.pages.dev']);
const watched=['index.html','release.json','shared/config.local.js','r4-onboarding.js','r4-selfserve-client.js','pending-member-registration.js','r4-independent-owner.js'];
const oldWatched=watched.filter(x=>x!=='r4-independent-owner.js');
const ver=['r4-onboarding.js','r4-selfserve-client.js','pending-member-registration.js','r4-independent-owner.js'];
const paths=['.github/workflows/r4-independent-owner-prod-post-readonly.yml','scripts/r4_independent_owner_prod_post_readonly.mjs','scripts/check_r4_independent_owner_prod_post_readonly.mjs'].sort();
const allowedCodes=new Set(['INPUT_SCOPE','PRIOR_RUN','SOURCE_RUN','SOURCE_ARTIFACT','BASE_ARTIFACT','ARTIFACT_BYTES','CF_CANONICAL_BEFORE','CF_RECOVERY','RECOVERY_ASSETS','IMMUTABLE_ASSETS','CANONICAL_ASSETS','CF_CANONICAL_AFTER','RECEIPT_WRITE']);
export async function onlyGet(url,options={},token='',fetcher=fetch){
  assert.equal(options.method||'GET','GET','GET_ONLY');const u=new URL(url);
  assert.equal(u.protocol,'https:');assert.ok(hosts.has(u.hostname));assert.equal(u.port,'');assert.equal(u.username,'');assert.equal(u.password,'');assert.equal(u.hash,'');
  if(u.hostname==='api.github.com'){assert.match(u.pathname,/^\/repos\/leisurewang0827\/tennis-note-public\/actions\/(runs\/(42930191570|42846945596)(\/jobs)?|artifacts\/(13777303858|13743341814))$/);assert.ok(u.search===''||(u.pathname.endsWith('/jobs')&&u.search==='?per_page=100'));}
  else if(u.hostname==='api.cloudflare.com'){assert.match(u.pathname,/^\/client\/v4\/accounts\/[a-f0-9]{32}\/pages\/projects\/tennisnote-admin(\/deployments\/2652a679-cc7b-4b85-a4d0-166c393faa0d)?$/);assert.equal(u.search,'');}
  else {assert.equal(token,'');const f=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(watched.includes(f));if(u.search)assert.match(u.search,/^\?v=[a-zA-Z0-9._-]{1,100}$/);}
  const r=await fetcher(u.toString(),{method:'GET',headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200,'GET_STATUS');return r;
}
export async function stage(code,fn){assert.ok(allowedCodes.has(code));try{return await fn();}catch{throw Error(code);}}
export function validateRun(run,jobs){
  assert.equal(run.id,Number(original));assert.equal(run.head_sha,originalHead);assert.equal(run.status,'completed');
  assert.equal(run.conclusion,'failure');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);
  assert.equal(run.path,'.github/workflows/r4-independent-owner-prod-promotion.yml');
  assert.equal(jobs.total_count,1);assert.equal(jobs.jobs.length,1);const job=jobs.jobs[0];assert.equal(job.name,'promote');assert.equal(job.conclusion,'failure');
  for(const [name,result] of [['Recheck OFF receipt, exact artifacts, canonical and recovery','success'],['Publish sealed administrator artifact once','success'],['Verify canonical and immutable administrator assets','failure'],['Restore exact prior administrator only on definite immutable mismatch','skipped']]){
    const rows=job.steps.filter(s=>s.name===name);assert.equal(rows.length,1);assert.equal(rows[0].conclusion,result);
  }
}
export function validateSourceRun(x){assert.equal(x.head_sha,source);assert.equal(x.status,'completed');assert.equal(x.conclusion,'success');assert.equal(x.event,'push');assert.equal(x.run_attempt,1);assert.equal(x.path,'.github/workflows/r4-independent-owner-prod-source.yml');}
export function validateAsset(bytes,expected){assert.match(expected||'',/^[a-f0-9]{64}$/);assert.equal(sha(bytes),expected);}
export function validateDeployment(project,id,commit){assert.equal(project.success,true);assert.equal(project.result?.name,'tennisnote-admin');assert.equal(project.result?.production_branch,'main');
  const d=project.result.canonical_deployment;assert.equal(d?.id,id);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,commit);}
export function validateRecovery(value){assert.equal(value.success,true);const d=value.result;assert.equal(d.id,previous);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,previousSource);assert.equal(d.url,'https://2652a679.tennisnote-admin.pages.dev');}
export function validateArtifact(a,id,run,digest){assert.equal(a.id,id);assert.equal(a.workflow_run?.id,run);assert.equal(a.expired,false);assert.equal(a.digest,'sha256:'+digest);assert.ok(Date.parse(a.expires_at)>Date.now());}
function walk(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert.ok(e.isDirectory()||e.isFile());const p=prefix+e.name;return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,readFileSync(join(dir,e.name))]];}));}
export function validateBytes(base,candidate){
  const oldBytes=readFileSync(join(base,'seal.json')),newBytes=readFileSync(join(candidate,'seal.json'));
  assert.equal(sha(oldBytes),baseSeal);assert.equal(sha(newBytes),candidateSeal);
  const old=JSON.parse(oldBytes),fresh=JSON.parse(newBytes);assert.equal(old.source,previousSource);assert.equal(fresh.source,source);assert.equal(fresh.recovery,previous);
  const hashes=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,sha(v)])),prior=walk(join(base,'admin')),now=walk(join(candidate,'admin'));
  assert.equal(Object.keys(prior).length,177);assert.equal(Object.keys(now).length,178);assert.deepEqual(hashes(prior),old.admin);assert.deepEqual(hashes(now),fresh.admin);assert.deepEqual(compose(base).hashes,fresh.admin);
  assert.equal(fresh.admin['shared/config.local.js'],'0a89879945c847ecf2244823a1a32ff21dfb6936ecc80706b183c7231671bd64');
  return {old,fresh};
}
export function versions(index,files){const html=index.toString('utf8');return Object.fromEntries(files.map(f=>{const p=html.split('src="./'+f+'?v=');assert.equal(p.length,2);const v=p[1].split('"')[0];assert.match(v,/^[a-zA-Z0-9._-]{1,100}$/);return [f,v];}));}
async function assets(get,host,hashes,files,params){for(const f of files){const response=await get(host+(f==='index.html'?'/':'/'+f));validateAsset(Buffer.from(await response.arrayBuffer()),hashes[f]);}
  for(const [f,v] of Object.entries(params)){const response=await get(host+'/'+f+'?v='+v);validateAsset(Buffer.from(await response.arrayBuffer()),hashes[f]);}}
function scope(){assert.equal(process.env.GITHUB_REPOSITORY,repo);assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim(),head=git('rev-parse','HEAD');assert.equal(head,process.env.GITHUB_SHA);
  assert.equal(git('rev-list','--parents','-n','1',head),head+' '+originalHead);assert.deepEqual(git('diff','--name-only',originalHead,head).split('\n').sort(),paths);return head;}
async function main(){
  const head=await stage('INPUT_SCOPE',scope),account=process.env.CLOUDFLARE_ACCOUNT_ID,cfToken=process.env.R4_ADMIN_CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;
  await stage('INPUT_SCOPE',()=>{assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(cfToken&&gh);assert.equal(sha(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);assert.match(process.env.GITHUB_RUN_ID||'',/^[0-9]+$/);assert.notEqual(process.env.GITHUB_RUN_ID,original);});
  const ghBase='https://api.github.com/repos/'+repo,cf='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/tennisnote-admin';
  const json=async(url,token)=>(await onlyGet(url,{},token)).json(),get=async url=>onlyGet(url);
  await stage('PRIOR_RUN',async()=>validateRun(await json(ghBase+'/actions/runs/'+original,gh),await json(ghBase+'/actions/runs/'+original+'/jobs?per_page=100',gh)));
  await stage('SOURCE_RUN',async()=>validateSourceRun(await json(ghBase+'/actions/runs/'+sourceRun,gh)));
  await stage('SOURCE_ARTIFACT',async()=>validateArtifact(await json(ghBase+'/actions/artifacts/13777303858',gh),13777303858,Number(sourceRun),candidateDigest));
  await stage('BASE_ARTIFACT',async()=>validateArtifact(await json(ghBase+'/actions/artifacts/13743341814',gh),13743341814,42774611944,baseDigest));
  const sealed=await stage('ARTIFACT_BYTES',()=>validateBytes('prod-base','prod-candidate'));
  await stage('CF_CANONICAL_BEFORE',async()=>validateDeployment(await json(cf,cfToken),deployed,source));
  await stage('CF_RECOVERY',async()=>validateRecovery(await json(cf+'/deployments/'+previous,cfToken)));
  const oldVersions=versions(readFileSync('prod-base/admin/index.html'),ver.slice(0,3));
  const newVersions=versions(readFileSync('prod-candidate/admin/index.html'),ver);
  await stage('ARTIFACT_BYTES',()=>assert.equal(newVersions['r4-independent-owner.js'],sealed.fresh.admin['r4-independent-owner.js'].slice(0,16)));
  await stage('RECOVERY_ASSETS',()=>assets(get,'https://2652a679.tennisnote-admin.pages.dev',sealed.old.admin,oldWatched,oldVersions));
  await stage('IMMUTABLE_ASSETS',()=>assets(get,'https://d0841b4a.tennisnote-admin.pages.dev',sealed.fresh.admin,watched,newVersions));
  await stage('CANONICAL_ASSETS',()=>assets(get,'https://tennisnote-admin.pages.dev',sealed.fresh.admin,watched,newVersions));
  await stage('CF_CANONICAL_AFTER',async()=>validateDeployment(await json(cf,cfToken),deployed,source));
  const receipt={status:'READONLY_POST_EVIDENCE_PASS',overallPromotion:'ORIGINAL_RUN_FAILED',originalPostCause:'UNKNOWN',source,sourceRun:Number(sourceRun),sourceArtifact:13777303858,candidateDigest,candidateSeal,originalRun:Number(original),originalHead,originalPublish:'success',originalPost:'failure',originalRollback:'skipped',deployment:deployed,recovery:previous,targetHash,artifactFiles:178,httpCurrent:7,httpVersioned:4,httpRecovery:6,httpRecoveryVersioned:3,readOnlyHead:head,readOnlyRun:Number(process.env.GITHUB_RUN_ID),observedAt:new Date().toISOString()};
  await stage('RECEIPT_WRITE',()=>writeFileSync(join(process.env.RUNNER_TEMP,'r4-independent-readonly-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'}));
  console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{const code=allowedCodes.has(e?.message)?e.message:'INPUT_SCOPE';console.error('READONLY_POST_HOLD '+code);process.exitCode=1;});
