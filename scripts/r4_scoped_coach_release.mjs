import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildRelease} from './build_r4_prod_selfserve_release.mjs';
const parent='682c00a0fa5fcef51f7666d39caf73fd28048c2e';
const repo='leisurewang0827/tennis-note-public';
const branch='codex/tennisnote-r4-admin-prod-candidate';
const devSource='58bb20d2f808d850973349cb62f2862edff8834a';
const moduleHash='eea4df54a6f0755cffe9c8479ac05d1ffb38a23b6449259a2c6654b4d9385be6';
const hash=x=>createHash('sha256').update(x).digest('hex');
const policy={
  dev:{site:'tennisnote-admin-dev',branch:'dev',base:'869dfeaa-7098-49e9-9cac-87e17991fa5d',sha:devSource,
    index:'b125ff92b97f51d278ed013af407f4375a0a40043862545899e7a9404e639b09'},
  prod:{site:'tennisnote-admin',branch:'main',base:'229c1cf7-a3ca-4181-bcd6-fdb02e6bfb0f',sha:parent,
    index:'efb76e5367e89b4d483e2506006341ccb0ad2f7f0a705c885d863d901f50153f'}
};
const sha=process.env.GITHUB_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const get=async(url,token,method='GET')=>{
 const r=await fetch(url,{method,headers:token?{Authorization:'Bearer '+token}:{},redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.ok(r.ok,'EXACT_REMOTE_READ_FAILED');return r;
};
const gh=async endpoint=>(await get('https://api.github.com/repos/'+repo+endpoint,process.env.GH_TOKEN)).json();
const walk=(dir,prefix='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(e=>{
  assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+'/')):[[prefix+e.name,hash(readFileSync(join(dir,e.name)))]];}));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:6e6});
const exactSource=()=>{
  assert.equal(process.env.GITHUB_REPOSITORY,repo);
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);
  assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(process.env.REVIEWED_SHA,sha);
  assert.equal(git('rev-list','--parents','-n','1',sha).trim(),sha+' '+parent);
  const paths=['.github/workflows/deploy-cloudflare-pages.yml','app/admin/index.html','app/admin/r4-scoped-coach.js',
    'scripts/build_r4_scoped_coach_admin_overlay.mjs','scripts/check_r4_scoped_coach_admin_browser.mjs',
    'scripts/build_r4_prod_selfserve_release.mjs','scripts/r4_scoped_coach_release.mjs'].sort();
  assert.deepEqual(git('diff','--name-only',parent,sha).trim().split('\n').sort(),paths);
  const source=readFileSync('app/admin/r4-scoped-coach.js');
  assert.equal(hash(source),moduleHash);
  const index=readFileSync('app/admin/index.html','utf8');
  const stripped=index.replace(/    <script defer src="\.\/r4-scoped-coach\.js\?v=eea4df54a6f0755c"><\/script>\r?\n/,'');
  assert.equal(stripped.replace(/\r\n/g,'\n'),git('show',parent+':app/admin/index.html').replace(/\r\n/g,'\n'));
};
const baseline=async t=>{
  const actual=await get('https://'+t.site+'.pages.dev/');
  const immutable=await get('https://'+t.base.slice(0,8)+'.'+t.site+'.pages.dev/');
  assert.equal(hash(Buffer.from(await actual.arrayBuffer())),t.index,'LIVE_BASELINE_DRIFT');
  assert.equal(hash(Buffer.from(await immutable.arrayBuffer())),t.index,'RECOVERY_BASELINE_DRIFT');
};
const receipt=async()=>{
  const id=process.env.VERIFY_RUN;assert.match(id||'',/^\d+$/);
  const run=await gh('/actions/runs/'+id);
  assert.equal(run.head_sha,sha);assert.equal(run.head_branch,branch);
  assert.equal(run.event,'workflow_dispatch');assert.equal(run.run_attempt,1);assert.equal(run.conclusion,'success');
  assert.ok(run.path.startsWith('.github/workflows/deploy-cloudflare-pages.yml'));
  const {jobs}=await gh('/actions/runs/'+id+'/jobs?per_page=100');
  assert.equal(jobs.find(x=>x.name==='coach-verify')?.conclusion,'success');
  assert.ok(['coach-dev','coach-prod','admin-only','development-only'].every(n=>jobs.find(x=>x.name===n)?.conclusion==='skipped'));
};
const preflight=async t=>{
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token);
  if(t.branch==='dev')assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const a=await (await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+t.site,token)).json();
  assert.equal(a.success,true);assert.equal(a.result.name,t.site);assert.equal(a.result.production_branch,t.branch);
  const c=a.result.canonical_deployment;
  assert.equal(c.id,t.base);assert.equal(c.latest_stage.status,'success');
  await baseline(t);
};
function overlay(where,mode){
  const config=readFileSync(join(where,'shared/config.local.js'));
  const index=join(where,'index.html');
  const before=walk(where);
  assert.equal(before['index.html'],policy[mode].index);
  assert.ok(!before['r4-scoped-coach.js']);
  const patched=execFileSync(process.execPath,['scripts/build_r4_scoped_coach_admin_overlay.mjs',index,policy[mode].index]);
  writeFileSync(index,patched);
  cpSync('app/admin/r4-scoped-coach.js',join(where,'r4-scoped-coach.js'),{force:false,errorOnExist:true});
  const after=walk(where);
  assert.equal(after['r4-scoped-coach.js'],moduleHash);
  assert.deepEqual(Object.keys(after).filter(k=>after[k]!==before[k]).sort(),['index.html','r4-scoped-coach.js']);
  assert.ok(config.equals(readFileSync(join(where,'shared/config.local.js'))));
  assert.ok(!after['tennis-note-member-app/index.html']&&!after['tennis-note-coach-app/index.html']);
  return {files:after,index:after['index.html']};
}
const command=process.argv[2],mode=process.argv[3];
try{
 exactSource();
 if(command==='build'){
  await Promise.all(Object.values(policy).map(baseline));
  const run=await gh('/actions/runs/42059081638');assert.equal(run.head_sha,devSource);assert.equal(run.conclusion,'success');
  const a=await gh('/actions/artifacts/13431390236');
  assert.equal(a.digest,'sha256:17f721b5f3af5705a18b1dd58d62edfb48963dd5f388b5268a9bca68fc0124ca');
  assert.equal(a.workflow_run.head_sha,devSource);
  const seal=readFileSync('coach-base/r4-marketplace-seal.json');
  assert.equal(hash(seal),'ea332e093adcc9d7a5c761ad1bdb67aec359267b0996f4e98568d8ca378ec6c3');
  const old=Object.fromEntries(JSON.parse(seal).files.filter(x=>x.path.startsWith('admin/')).map(x=>[x.path.slice(6),x.sha256]));
  assert.deepEqual(walk('coach-base/r4-marketplace-paired/admin'),old);
  await buildRelease({ref:parent,existingRuntime:true});
  mkdirSync('coach-release');
  cpSync('coach-base/r4-marketplace-paired/admin','coach-release/dev',{recursive:true,force:false,errorOnExist:true});
  cpSync('dist/admin','coach-release/prod',{recursive:true,force:false,errorOnExist:true});
  const manifest={sha,dev:overlay('coach-release/dev','dev'),prod:overlay('coach-release/prod','prod')};
  writeFileSync('coach-release/seal.json',JSON.stringify(manifest)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha,changedAssetsPerSurface:2,devIndex:manifest.dev.index,prodIndex:manifest.prod.index,existingConfigPreserved:true}));
 }else if(command==='deploy-check'){
  assert.ok(mode in policy);
  if(mode==='prod')assert.equal(process.env.APPROVED_SHA,sha,'EXACT_PRODUCTION_APPROVAL_REQUIRED');
  await receipt();
  const seal=JSON.parse(readFileSync('coach-release/seal.json','utf8'));assert.equal(seal.sha,sha);
  assert.deepEqual(walk('coach-release/'+mode),seal[mode].files);
  assert.equal(seal[mode].files['r4-scoped-coach.js'],moduleHash);
  await preflight(policy[mode]);
  console.log(JSON.stringify({sha,mode,recovery:policy[mode].base,index:seal[mode].index}));
 }else throw Error('INVALID_COMMAND');
}catch(e){console.error('R4_COACH_RELEASE_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
