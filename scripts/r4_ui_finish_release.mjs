import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(path);
const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{
  assert.ok(!e.isSymbolicLink(),'SYMLINK_DENIED');
  return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,digest(read(join(dir,e.name)))]];
}));
const insert=(text,anchor,value)=>{assert.equal(text.split(anchor).length,2,'ANCHOR_DRIFT');return text.replace(anchor,()=>value+anchor);};

// Pure UI-only transform; existing auth, roles, RPCs and member assets are not modified.
export function compose({adminIndex,coachIndex,coachWorker,css,js}) {
  const token=digest(Buffer.concat([css,js])).slice(0,16);
  const tag=`  <link rel="stylesheet" href="./r4-ui-finish.css?v=${token}">\n  <script defer src="./r4-ui-finish.js?v=${token}"></script>\n`;
  const a=adminIndex.toString(),c=coachIndex.toString(),w=coachWorker.toString();
  assert.equal(a.split('id="r4FirstLessonSetup"').length,2,'ADMIN_FORM_DRIFT');
  assert.equal(c.split('r4-scoped-workspace.js').length,2,'COACH_ENTRY_DRIFT');
  for(const text of [a,c,w])assert.ok(!text.includes('r4-ui-finish.js'),'ALREADY_INSTALLED');
  assert.equal(w.split('const APP_SHELL = [').length,2,'SW_SHELL_DRIFT');
  assert.equal(w.split('const CACHE_NAME = "').length,2,'SW_CACHE_DRIFT');
  const worker=w.replace('const APP_SHELL = [',()=>`const APP_SHELL = [\n  "./r4-ui-finish.css?v=${token}",\n  "./r4-ui-finish.js?v=${token}",`)
    .replace(/(const CACHE_NAME = ")([^"]+)(";)/,(_,a,b,c)=>a+b+'-ui-'+token+c);
  assert.notEqual(worker,w,'SW_INSERT_FAILED');
  return {token,admin:Buffer.from(insert(a,'</head>',tag)),coach:Buffer.from(insert(c,'</head>',tag)),worker:Buffer.from(worker)};
}

const policyPath='release-sources/r4-ui-finish/policy.json';
const config=()=>JSON.parse(read(policyPath));
const get=async (url,token)=>{
  const response=await fetch(url,{headers:token?{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,'READ_FAILED');return response;
};
const github=async p=>(await get('https://api.github.com/repos/leisurewang0827/tennis-note-public'+p,process.env.GH_TOKEN)).json();
function ready(p){
  assert.equal(p.schema,1);assert.equal(p.repository,'leisurewang0827/tennis-note-public');assert.equal(p.environment,'development');
  assert.match(p.privateCommit||'',/^[0-9a-f]{40}$/,'PRIVATE_COMMIT_UNBOUND');
  for(const x of [p.admin,p.coach])assert.match(x.canonicalId||'',/^[0-9a-f-]{36}$/,'CANONICAL_ID_UNBOUND');
}
function candidate(p){
  assert.equal(process.env.GITHUB_REPOSITORY,p.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+p.branch);
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  const sha=process.env.GITHUB_SHA;assert.match(sha||'',/^[0-9a-f]{40}$/);
  assert.equal(execFileSync('git',['rev-list','--parents','-n','1',sha],{encoding:'utf8'}).trim(),sha+' '+p.publicParent,'PARENT_DRIFT');
  const changed=execFileSync('git',['diff','--name-only',p.publicParent,sha],{encoding:'utf8'}).trim().split('\n').sort();
  assert.deepEqual(changed,['.github/workflows/r4-ui-finish-dev.yml','release-sources/r4-ui-finish/policy.json','release-sources/r4-ui-finish/r4-ui-finish.css','release-sources/r4-ui-finish/r4-ui-finish.js','scripts/check_r4_ui_finish_release.mjs','scripts/r4_ui_finish_release.mjs'].sort(),'SCOPE_DRIFT');
  for(const [name,sha256] of Object.entries(p.sourceSha256))assert.equal(digest(read('release-sources/r4-ui-finish/'+name)),sha256,'SOURCE_DRIFT');
  return sha;
}
async function artifact(spec,dir){
  const run=await github('/actions/runs/'+spec.run),a=await github('/actions/artifacts/'+spec.artifactId);
  assert.equal(run.head_sha,spec.source);assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
  assert.equal(run.event,'workflow_dispatch');assert.equal(run.head_branch,'codex/tennisnote-r4-admin-prod-candidate');
  assert.ok(run.path.startsWith('.github/workflows/deploy-cloudflare-pages.yml'),'BASE_WORKFLOW_DRIFT');
  assert.equal(a.name,spec.artifactName);assert.equal(a.digest,'sha256:'+spec.artifactDigest);assert.equal(a.expired,false);assert.equal(a.workflow_run.id,spec.run);
  const seal=read(join(dir,'seal.json'));assert.equal(digest(seal),spec.sealHash,'SEAL_DRIFT');const obj=JSON.parse(seal);
  assert.equal(obj.sha,spec.source);assert.deepEqual(walk(join(dir,'dev')),obj.dev.files,'BASE_CONTENT_DRIFT');return obj.dev.files;
}
async function baseline(p,adminFiles,coachFiles){
  for(const [project,path,hash] of [[p.admin.project,'/',p.admin.indexHash],[p.admin.project,'/views/settings.js',adminFiles['views/settings.js']],[p.coach.project,'/',coachFiles['index.html']],[p.coach.project,'/tennis-note-coach-app/',p.coach.indexHash],[p.coach.project,'/tennis-note-coach-app/service-worker.js',p.coach.workerHash]]){
    const body=Buffer.from(await(await get('https://'+project+'.pages.dev'+path)).arrayBuffer());assert.equal(digest(body),hash,'LIVE_DRIFT');
  }
  for(const [project,files] of [[p.admin.project,adminFiles],[p.coach.project,coachFiles]]){
    const bytes=Buffer.from(await(await get('https://'+project+'.pages.dev/shared/config.local.js')).arrayBuffer());
    assert.equal(digest(bytes),files['shared/config.local.js'],'CONFIG_HASH_DRIFT');const cfg=bytes.toString();
    assert.ok(cfg.includes(p.projectFingerprint)&&cfg.includes('development')&&!/service_role|PORTONE_API_SECRET/i.test(cfg),'CONFIG_DRIFT');
  }
}
function write(path,data){writeFileSync(path,data);}
async function build(p,sha){
  const a=await artifact(p.admin,'base-admin'),c=await artifact(p.coach,'base-coach');await baseline(p,a,c);
  const css=read('release-sources/r4-ui-finish/r4-ui-finish.css'),js=read('release-sources/r4-ui-finish/r4-ui-finish.js');
  const changes=compose({adminIndex:read('base-admin/dev/index.html'),coachIndex:read('base-coach/dev/tennis-note-coach-app/index.html'),coachWorker:read('base-coach/dev/tennis-note-coach-app/service-worker.js'),css,js});
  mkdirSync('ui-release');cpSync('base-admin/dev','ui-release/admin',{recursive:true,errorOnExist:true});cpSync('base-coach/dev','ui-release/coach',{recursive:true,errorOnExist:true});
  for(const [dir,index] of [['ui-release/admin',changes.admin],['ui-release/coach/tennis-note-coach-app',changes.coach]]){
    write(join(dir,'index.html'),index);write(join(dir,'r4-ui-finish.css'),css);write(join(dir,'r4-ui-finish.js'),js);
  }
  write('ui-release/coach/tennis-note-coach-app/service-worker.js',changes.worker);
  const afterA=walk('ui-release/admin'),afterC=walk('ui-release/coach');
  const delta=(base,after)=>Object.keys({...base,...after}).filter(k=>base[k]!==after[k]).sort();
  assert.deepEqual(delta(a,afterA),['index.html','r4-ui-finish.css','r4-ui-finish.js'].sort());
  assert.deepEqual(delta(c,afterC),['tennis-note-coach-app/index.html','tennis-note-coach-app/r4-ui-finish.css','tennis-note-coach-app/r4-ui-finish.js','tennis-note-coach-app/service-worker.js'].sort());
  write('ui-release/seal.json',JSON.stringify({sha,policyHash:digest(read(policyPath)),admin:afterA,coach:afterC})+'\n');
  console.log(JSON.stringify({status:'BUILT',sha,adminChanges:3,coachChanges:4,sourcePrivate:p.privateCommit}));
}
async function deployCheck(p,sha){
  const seal=JSON.parse(read('ui-release/seal.json'));assert.equal(seal.sha,sha);assert.equal(seal.policyHash,digest(read(policyPath)));
  assert.deepEqual(walk('ui-release/admin'),seal.admin);assert.deepEqual(walk('ui-release/coach'),seal.coach);
  const baseA=await artifact(p.admin,'base-admin'),baseC=await artifact(p.coach,'base-coach');await baseline(p,baseA,baseC);
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(account||'',/^[0-9a-f]{32}$/);assert.ok(token);assert.equal(digest(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  for(const spec of [p.admin,p.coach]){
    const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+spec.project;
    const data=await(await get(base,token)).json();const project=data.result,now=project?.canonical_deployment;
    assert.equal(data.success,true);assert.equal(project.name,spec.project);assert.equal(project.production_branch,'dev');
    assert.equal(now?.id,spec.canonicalId,'CANONICAL_DRIFT');assert.equal(now?.deployment_trigger?.metadata?.commit_hash,spec.source);
    assert.equal(now?.deployment_trigger?.metadata?.branch,'dev');assert.equal(now?.latest_stage?.status,'success');
    const prior=await(await get(base+'/deployments/'+spec.priorRecoveryId,token)).json();
    assert.equal(prior.success,true);assert.equal(prior.result.id,spec.priorRecoveryId);assert.equal(prior.result.latest_stage.status,'success');
  }
  console.log(JSON.stringify({status:'DEPLOY_ADMISSION_PASS',sha,targets:[p.admin.project,p.coach.project]}));
}
async function postCheck(p,sha){
  const seal=JSON.parse(read('ui-release/seal.json'));assert.equal(seal.sha,sha);assert.equal(seal.policyHash,digest(read(policyPath)));
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(account||'',/^[0-9a-f]{32}$/);assert.ok(token);assert.equal(digest(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  for(const [spec,paths] of [[p.admin,[['/','index.html'],['/shared/config.local.js','shared/config.local.js'],['/r4-ui-finish.css','r4-ui-finish.css'],['/r4-ui-finish.js','r4-ui-finish.js']]],[p.coach,[['/','index.html'],['/shared/config.local.js','shared/config.local.js'],['/tennis-note-coach-app/','tennis-note-coach-app/index.html'],['/tennis-note-coach-app/service-worker.js','tennis-note-coach-app/service-worker.js'],['/tennis-note-coach-app/r4-ui-finish.css','tennis-note-coach-app/r4-ui-finish.css'],['/tennis-note-coach-app/r4-ui-finish.js','tennis-note-coach-app/r4-ui-finish.js']]]]){
    const files=spec===p.admin?seal.admin:seal.coach;
    for(const [url,path] of paths)assert.equal(digest(Buffer.from(await(await get('https://'+spec.project+'.pages.dev'+url)).arrayBuffer())),files[path],'LIVE_READBACK_DRIFT');
    const data=await(await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+spec.project,token)).json();
    const current=data.result?.canonical_deployment;assert.equal(data.success,true);assert.ok(current?.id&&current.id!==spec.canonicalId,'DEPLOY_ID_UNCHANGED');
    assert.equal(current.deployment_trigger?.metadata?.commit_hash,sha);assert.equal(current.deployment_trigger?.metadata?.branch,'dev');assert.equal(current.latest_stage?.status,'success');
    console.log(JSON.stringify({project:spec.project,deploymentId:current.id,previousDeploymentId:spec.canonicalId}));
  }
  console.log(JSON.stringify({status:'DEV_READBACK_PASS',sha}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const p=config();ready(p);const sha=candidate(p);if(process.argv[2]==='build')await build(p,sha);else if(process.argv[2]==='deploy-check')await deployCheck(p,sha);else if(process.argv[2]==='post-check')await postCheck(p,sha);else throw Error('INVALID_COMMAND');}
  catch(e){console.error('R4_UI_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
}
