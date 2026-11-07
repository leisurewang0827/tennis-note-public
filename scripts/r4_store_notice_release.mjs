import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const parent='5653306f0aab741a0abb9dedf49162bf16630fea';
const repository='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-admin-prod-candidate';
const oldRun=42355060909,oldArtifact=13567208017,oldDigest='sha256:51a7521e42894586da6fe91c58e213b9b41ace82a0602492e16bcc6d6eca7c61';
export const changed=['release.json','shared/tennisnote-release.js'];
export const livePaths=['index.html','tennis-note-coach-app/index.html','shared/config.local.js','release.json','shared/tennisnote-release.js','service-worker.js','tennis-note-coach-app/service-worker.js'];
export const scope=['app/release.json','app/shared/tennisnote-release.js','scripts/r4_store_notice_release.mjs','tests/r4-store-notice-release.test.mjs','.github/workflows/deploy-cloudflare-pages.yml'].sort();
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function validateMetadata(beforeJson,afterJson,beforeJs,afterJs){
 const before=JSON.parse(beforeJson),expected=structuredClone(before);
 assert.equal(before.nativePlatforms.android.latestVersion,'1.0.474');assert.equal(before.nativePlatforms.android.latestBuild,103);
 expected.nativePlatforms.android.latestVersion='1.0.566';expected.nativePlatforms.android.latestBuild=134;
 assert.deepEqual(JSON.parse(afterJson),expected,'NOTICE_ONLY_ANDROID_DELTA');
 const anchor='    store: {\n      androidVersion: "1.0.474",\n      androidBuild: 103,';
 assert.equal(beforeJs.split(anchor).length,2,'STORE_ANCHOR_DRIFT');
 assert.equal(afterJs,beforeJs.replace(anchor,'    store: {\n      androidVersion: "1.0.566",\n      androidBuild: 134,'),'NOTICE_JS_ONLY_ANDROID_DELTA');
}
export function admit(env,actualParent,paths){
 assert.equal(env.GITHUB_REPOSITORY,repository);assert.equal(env.GITHUB_REF,'refs/heads/'+branch);
 assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
 assert.match(env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(env.GITHUB_SHA,env.REVIEWED_SHA);
 assert.equal(actualParent,env.GITHUB_SHA+' '+parent,'FROZEN_SOURCE_PARENT_REQUIRED');
 assert.deepEqual([...paths].sort(),scope,'EXACT_NOTICE_CHECKPOINT_REQUIRED');
}
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const original=path=>execFileSync('git',['show',parent+':app/'+path]);
const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{assert.ok(!e.isSymbolicLink(),'SYMLINK_DENIED');return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,hash(readFileSync(join(dir,e.name)))]];}));
const get=async(url,token)=>{const r=await fetch(url,{cache:'no-store',redirect:'error',headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'REMOTE_READ_REJECTED');return r;};
const gh=async path=>(await get('https://api.github.com/repos/'+repository+path,process.env.GH_TOKEN)).json();
async function validateOldArtifact(){
 const run=await gh('/actions/runs/'+oldRun),artifact=await gh('/actions/artifacts/'+oldArtifact);
 assert.equal(run.head_sha,parent);assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
 assert.equal(run.event,'workflow_dispatch');assert.equal(artifact.expired,false);assert.equal(artifact.digest,oldDigest);
 const seal=JSON.parse(readFileSync('store-base/seal.json','utf8'));assert.equal(seal.sha,parent);
 assert.deepEqual(walk('store-base/prod'),seal.prod.files,'FROZEN_ARTIFACT_DRIFT');
 for(const path of changed)assert.equal(hash(original(path)),seal.prod.files[path],'CANONICAL_NOTICE_PREIMAGE_DRIFT');
 return seal.prod.files;
}
async function baseline(files){
 await Promise.all(['tennisnote-app','2ec1dddc.tennisnote-app'].flatMap(host=>livePaths.map(async path=>{
  // Pages의 index 정규 경로를 사용해 리다이렉트와 다른 origin을 허용하지 않는다.
  // 비공개 _headers/_redirects/_worker.js는 HTTP 검사가 아니라 전체 artifact 불변 검증으로 보호한다.
  assert.match(files[path]||'',/^[a-f0-9]{64}$/);
  const route=path.replace(/index\.html$/,'');const response=await get('https://'+host+'.pages.dev/'+route);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),files[path],'LIVE_OR_RECOVERY_DRIFT:'+path);
 })));
}
async function main(){
 const env=process.env,sha=env.GITHUB_SHA,command=process.argv[2];
 admit(env,git(['rev-list','--parents','-n','1',sha]),git(['diff','--name-only',parent,sha]).split('\n'));
 validateMetadata(original(changed[0]).toString(),readFileSync('app/'+changed[0],'utf8'),original(changed[1]).toString(),readFileSync('app/'+changed[1],'utf8'));
 if(command==='build'){
  const baseFiles=await validateOldArtifact();await baseline(baseFiles);
  mkdirSync('store-notice-release');cpSync('store-base/prod','store-notice-release/prod',{recursive:true,errorOnExist:true,force:false});
  for(const path of changed)cpSync('app/'+path,'store-notice-release/prod/'+path,{force:true});
  const files=walk('store-notice-release/prod');assert.deepEqual(Object.keys(files).sort(),Object.keys(baseFiles).sort());
  assert.deepEqual(Object.keys(files).filter(p=>files[p]!==baseFiles[p]).sort(),changed);
  assert.equal(files['shared/config.local.js'],baseFiles['shared/config.local.js']);
  writeFileSync('store-notice-release/seal.json',JSON.stringify({sha,parent,changed,baseFiles,files,android:{version:'1.0.566',build:134},iosChanged:false})+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha,changed,androidPublicNotice:true,iosUnchanged:true,allOtherAssetsUnchanged:true}));
 }else if(command==='deploy-check'){
  assert.equal(env.APPROVED_SHA,sha,'EXACT_NOTICE_APPROVAL_REQUIRED');assert.match(env.VERIFY_RUN||'',/^\d+$/);
  const run=await gh('/actions/runs/'+env.VERIFY_RUN),jobs=await gh('/actions/runs/'+env.VERIFY_RUN+'/jobs?per_page=100');
  assert.equal(run.head_sha,sha);assert.equal(run.head_branch,branch);assert.equal(run.run_attempt,1);assert.equal(run.conclusion,'success');assert.equal(run.event,'workflow_dispatch');
  assert.equal(run.path,'.github/workflows/deploy-cloudflare-pages.yml');
  assert.equal(jobs.jobs.find(j=>j.name==='notice-verify')?.conclusion,'success');assert.ok(jobs.jobs.filter(j=>j.name!=='notice-verify').every(j=>j.conclusion==='skipped'));
  const seal=JSON.parse(readFileSync('store-notice-release/seal.json','utf8'));assert.equal(seal.sha,sha);assert.equal(seal.parent,parent);assert.deepEqual(seal.changed,changed);assert.deepEqual(walk('store-notice-release/prod'),seal.files);
  assert.deepEqual(Object.keys(seal.files).sort(),Object.keys(seal.baseFiles).sort());assert.deepEqual(Object.keys(seal.files).filter(path=>seal.files[path]!==seal.baseFiles[path]).sort(),changed);
  for(const path of changed)assert.equal(seal.files[path],hash(readFileSync('app/'+path)));
  assert.equal(seal.files['shared/config.local.js'],seal.baseFiles['shared/config.local.js']);
  const account=env.CLOUDFLARE_ACCOUNT_ID;assert.match(account||'',/^[a-f0-9]{32}$/);
  const project=await(await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/tennisnote-app',env.CLOUDFLARE_API_TOKEN)).json();
  assert.equal(project.success,true);assert.equal(project.result.name,'tennisnote-app');assert.equal(project.result.production_branch,'main');
  const recovery=project.result.canonical_deployment;assert.match(recovery.id,/^2ec1dddc-/);assert.equal(recovery.latest_stage.status,'success');assert.equal(recovery.deployment_trigger.metadata.commit_hash,parent);assert.equal(recovery.deployment_trigger.metadata.branch,'main');
  await baseline(seal.baseFiles);console.log(JSON.stringify({sha,recovery:recovery.id,noticeOnly:changed,configurationAndAllOtherAssetsPreserved:true}));
 }else throw Error('INVALID_NOTICE_COMMAND');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error('R4_NOTICE_BLOCKED: '+String(error.message).split('\n')[0].slice(0,140));process.exitCode=1;});
