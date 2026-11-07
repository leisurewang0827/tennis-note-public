import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {memberCoachEntry} from './build_r4_member_coach_entry.mjs';
const repository='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-admin-prod-candidate';
const parent='ea99e40018a9ef3dc68b3980d454779c858c23b8',oldRun=42344119447,oldArtifact=13562887087;
const sha=process.env.GITHUB_SHA,hash=x=>createHash('sha256').update(x).digest('hex');
const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(e=>{assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,hash(readFileSync(join(dir,e.name)))]];}));
const get=async(url,token)=>{const r=await fetch(url,{cache:'no-store',redirect:'error',headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'REMOTE_READ_BLOCKED');return r;};
const gh=async p=>(await get('https://api.github.com/repos/'+repository+p,process.env.GH_TOKEN)).json();
const policy={dev:{site:'tennisnote-app-dev',branch:'dev',recovery:'5816f634'},prod:{site:'tennisnote-app',branch:'main',recovery:'160a4cb1'}};
const changed=['index.html','service-worker.js','actions/session.js','domain/coaches.js','data/auth.js','shared/tennisnote-r4-coach-entry.js','tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js','tennis-note-coach-app/data/auth.js','tennis-note-coach-app/data/r4-scoped-workspace.js','tennis-note-coach-app/data/r4-workflows.js'].sort();
function exact(){
 assert.equal(process.env.GITHUB_REPOSITORY,repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(sha,process.env.REVIEWED_SHA);assert.match(sha||'',/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-list','--parents','-n','1',sha],{encoding:'utf8'}).trim(),sha+' '+parent,'CANDIDATE_PARENT_DRIFT');
 const paths=execFileSync('git',['diff','--name-only',parent,sha],{encoding:'utf8'}).trim().split('\n');
 assert.ok(paths.every(p=>/^(app\/(tennis-note-member-app|tennis-note-coach-app|shared)\/|app\/release\.json$|scripts\/(build_r4_member_coach_entry|r4_member_coach_release)\.mjs$|\.github\/workflows\/r4-member-coach-release\.yml$)/.test(p)),'UNREVIEWED_PATH');
}
async function oldSeal(){
 const run=await gh('/actions/runs/'+oldRun),artifact=await gh('/actions/artifacts/'+oldArtifact);assert.equal(run.conclusion,'success');assert.equal(run.head_sha,parent);assert.equal(artifact.expired,false);assert.equal(artifact.digest,'sha256:49e7207574e6ac7f9dbe23dd82bfa0224fd9ab71bbcc663269c074bfba196755');
 const seal=JSON.parse(readFileSync('entry-base/seal.json'));assert.equal(seal.sha,parent);
 for(const mode of ['dev','prod'])assert.deepEqual(walk('entry-base/'+mode),seal[mode].files);
 return seal;
}
async function baseline(mode,files){
 const p=policy[mode];for(const host of [p.site,p.recovery+'.'+p.site])for(const path of ['index.html','tennis-note-coach-app/index.html','shared/config.local.js'])assert.equal(hash(Buffer.from(await(await get('https://'+host+'.pages.dev/'+path)).arrayBuffer())),files[path],'LIVE_OR_RECOVERY_DRIFT');
}
function canonicalParity(files){
 for(const path of changed){
  const relative=path.startsWith('shared/')||path.startsWith('tennis-note-coach-app/')?path:'tennis-note-member-app/'+path;
  let data=readFileSync('app/'+relative,'utf8');
  if(['index.html','service-worker.js'].includes(path))data=data.replaceAll('../shared/','./shared/');
  // 루트 helper의 ../shared 링크는 같은 origin의 /shared로 정규화된다.
  let actual=readFileSync('member-coach-release/prod/'+path,'utf8');
  if(path==='index.html'||path==='service-worker.js')actual=actual.replaceAll('../shared/','./shared/');
  assert.equal(data,actual,'NATIVE_PWA_SOURCE_PARITY:'+path);
 }
 assert.equal(files['shared/tennisnote-r4-coach-entry.js'],hash(readFileSync('app/shared/tennisnote-r4-coach-entry.js')));
}
try{
 exact();const command=process.argv[2],mode=process.argv[3];
 if(command==='build'){
  const base=await oldSeal();const seal={sha,parent,changed};mkdirSync('member-coach-release');
  for(const m of ['dev','prod']){
   await baseline(m,base[m].files);cpSync('entry-base/'+m,'member-coach-release/'+m,{recursive:true,errorOnExist:true,force:false});
   const binding=memberCoachEntry('member-coach-release/'+m,'app/shared/tennisnote-r4-coach-entry.js'),files=walk('member-coach-release/'+m);
   assert.deepEqual(Object.keys(files).filter(p=>files[p]!==base[m].files[p]).sort(),changed);
   assert.equal(files['shared/config.local.js'],base[m].files['shared/config.local.js']);
   for(const path of changed.filter(p=>p.endsWith('.js')))execFileSync('node',['--check','member-coach-release/'+m+'/'+path],{stdio:'pipe'});
   seal[m]={files,baseFiles:base[m].files,binding};
  }
  canonicalParity(seal.prod.files);writeFileSync('member-coach-release/seal.json',JSON.stringify(seal)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha,memberCoachAssets:changed.length,sharedConfigUnchanged:true,nativePwaParity:true}));
 }else if(command==='deploy-check'){
  assert.ok(mode==='dev'||mode==='prod');if(mode==='prod')assert.equal(process.env.APPROVED_SHA,sha,'EXACT_APPROVAL_REQUIRED');
  const id=process.env.VERIFY_RUN;assert.match(id||'',/^\d+$/);const run=await gh('/actions/runs/'+id);assert.equal(run.head_sha,sha);assert.equal(run.head_branch,branch);assert.equal(run.run_attempt,1);assert.equal(run.conclusion,'success');assert.equal(run.event,'workflow_dispatch');assert.ok(run.path.startsWith('.github/workflows/r4-member-coach-release.yml'));
  const jobs=await gh('/actions/runs/'+id+'/jobs?per_page=100');assert.equal(jobs.jobs.find(j=>j.name==='verify')?.conclusion,'success');assert.ok(jobs.jobs.filter(j=>j.name!=='verify').every(j=>j.conclusion==='skipped'));
  const seal=JSON.parse(readFileSync('member-coach-release/seal.json'));assert.equal(seal.sha,sha);assert.equal(seal.parent,parent);assert.deepEqual(seal.changed,changed);assert.deepEqual(walk('member-coach-release/'+mode),seal[mode].files);
  const p=policy[mode],account=process.env.CLOUDFLARE_ACCOUNT_ID;assert.match(account||'',/^[a-f0-9]{32}$/);
  if(mode==='dev')assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const project=await(await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+p.site,process.env.CLOUDFLARE_API_TOKEN)).json();assert.equal(project.success,true);assert.equal(project.result.name,p.site);assert.equal(project.result.production_branch,p.branch);
  const recovery=project.result.canonical_deployment;assert.equal(recovery.id.slice(0,8),p.recovery);assert.equal(recovery.deployment_trigger.metadata.commit_hash,parent);assert.equal(recovery.deployment_trigger.metadata.branch,p.branch);assert.equal(recovery.latest_stage.status,'success');
  await baseline(mode,seal[mode].baseFiles);console.log(JSON.stringify({sha,mode,recovery:recovery.id,memberCoachAssets:changed.length}));
 }else throw Error('INVALID_COMMAND');
}catch(e){console.error('R4_ENTRY_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
