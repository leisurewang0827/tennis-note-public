import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const parent='f4980f9ed0ea96e98fe4c24f1b533ddb5d6d7d93';
const repo='leisurewang0827/tennis-note-public';
const branch='codex/tennisnote-r4-admin-prod-candidate';
const moduleHash='154feef8f3767a7306c9edbdfE0df1bd2b8b79adb8f97bffe38351dec3df3e39'.toLowerCase();
const workflowHash='88207f6aed31a50693a4a7554ca8a860ee67a74236a2d80591cccb3487fbba16';
const priorModule='eea4df54a6f0755cffe9c8479ac05d1ffb38a23b6449259a2c6654b4d9385be6';
const priorSeal='50106048b7bffac7a58d7c12474c173cac57c2f8854de29f7a16a1b2c95910ff';
const policy={
 dev:{site:'tennisnote-admin-dev',branch:'dev',prefix:'4ecf57a3',index:'0eca844efb987b39de1027db3f108c64b92d0d8e2f3d6adf28d0ef0adf24c200'},
 prod:{site:'tennisnote-admin',branch:'main',prefix:'5983228d',index:'bc4f44b41f0db41f5c84f4fed1909c2c27ba3fb9532c87bcd75660c0bcf212b5'}
};
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const get=async(url,token)=>{
 const r=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{},redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.ok(r.ok,'EXACT_REMOTE_READ_FAILED');return r;
};
const gh=async ep=>(await get('https://api.github.com/repos/'+repo+ep,process.env.GH_TOKEN)).json();
const walk=(dir,prefix='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(e=>{
 assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+'/')):[[prefix+e.name,hash(readFileSync(join(dir,e.name)))]];
}));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:6e6});
const line=(name,digest)=>'<script defer src="./'+name+'?v='+digest.slice(0,16)+'"></script>';
const patch=html=>{
 const old=line('r4-scoped-coach.js',priorModule);assert.equal(html.split(old).length,2);
 return html.replace(old,()=>line('r4-scoped-coach-workflows.js',workflowHash)+'\n    '+line('r4-scoped-coach.js',moduleHash));
};
const exactSource=()=>{
 assert.equal(process.env.GITHUB_REPOSITORY,repo);assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);
 assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(process.env.REVIEWED_SHA,sha);assert.equal(git('rev-list','--parents','-n','1',sha).trim(),sha+' '+parent);
 const paths=['.github/workflows/deploy-cloudflare-pages.yml','app/admin/index.html','app/admin/r4-scoped-coach.js',
  'app/admin/r4-scoped-coach-workflows.js','scripts/build_r4_scoped_coach_admin_overlay.mjs','scripts/r4_scoped_coach_release.mjs'].sort();
 assert.deepEqual(git('diff','--name-only',parent,sha).trim().split('\n').sort(),paths);
 assert.equal(hash(readFileSync('app/admin/r4-scoped-coach.js')),moduleHash);
 assert.equal(hash(readFileSync('app/admin/r4-scoped-coach-workflows.js')),workflowHash);
 assert.equal(readFileSync('app/admin/index.html','utf8').replaceAll('\r\n','\n'),patch(git('show',parent+':app/admin/index.html').replaceAll('\r\n','\n')));
};
const baseline=async t=>{
 for(const host of [t.site,t.prefix+'.'+t.site]){
  const r=await get('https://'+host+'.pages.dev/');
  assert.equal(hash(Buffer.from(await r.arrayBuffer())),t.index,'BASELINE_OR_RECOVERY_DRIFT');
 }
};
const receipt=async()=>{
 const id=process.env.VERIFY_RUN;assert.match(id||'',/^\d+$/);
 const run=await gh('/actions/runs/'+id);
 assert.equal(run.head_sha,sha);assert.equal(run.head_branch,branch);assert.equal(run.event,'workflow_dispatch');
 assert.equal(run.run_attempt,1);assert.equal(run.conclusion,'success');assert.ok(run.path.startsWith('.github/workflows/deploy-cloudflare-pages.yml'));
 const {jobs}=await gh('/actions/runs/'+id+'/jobs?per_page=100');
 assert.equal(jobs.find(x=>x.name==='coach-verify')?.conclusion,'success');
 assert.ok(['coach-dev','coach-prod','admin-only','development-only'].every(n=>jobs.find(x=>x.name===n)?.conclusion==='skipped'));
};
const preflight=async t=>{
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token);
 if(t.branch==='dev')assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const a=await(await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+t.site,token)).json();
 assert.equal(a.success,true);assert.equal(a.result.name,t.site);assert.equal(a.result.production_branch,t.branch);
 const c=a.result.canonical_deployment;
 assert.match(c.id,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.equal(c.id.slice(0,8),t.prefix);assert.equal(c.url,'https://'+t.prefix+'.'+t.site+'.pages.dev');
 assert.equal(c.deployment_trigger.metadata.commit_hash,parent);assert.equal(c.deployment_trigger.metadata.branch,t.branch);
 assert.equal(c.latest_stage.status,'success');await baseline(t);
 return c.id;
};
function overlay(where,mode){
 const before=walk(where);assert.equal(before['index.html'],policy[mode].index);assert.equal(before['r4-scoped-coach.js'],priorModule);
 assert.ok(!before['r4-scoped-coach-workflows.js']);const config=readFileSync(join(where,'shared/config.local.js'));
 const index=join(where,'index.html');
 const patched=execFileSync(process.execPath,['scripts/build_r4_scoped_coach_admin_overlay.mjs',index,policy[mode].index]);
 assert.equal(patched.toString(),patch(readFileSync(index,'utf8')));writeFileSync(index,patched);
 cpSync('app/admin/r4-scoped-coach.js',join(where,'r4-scoped-coach.js'));
 cpSync('app/admin/r4-scoped-coach-workflows.js',join(where,'r4-scoped-coach-workflows.js'),{force:false,errorOnExist:true});
 const after=walk(where);assert.equal(after['r4-scoped-coach.js'],moduleHash);assert.equal(after['r4-scoped-coach-workflows.js'],workflowHash);
 assert.deepEqual(Object.keys(after).filter(k=>after[k]!==before[k]).sort(),['index.html','r4-scoped-coach-workflows.js','r4-scoped-coach.js']);
 assert.ok(config.equals(readFileSync(join(where,'shared/config.local.js'))));
 assert.ok(!after['tennis-note-member-app/index.html']&&!after['tennis-note-coach-app/index.html']);
 return {files:after,index:after['index.html']};
}
try{
 exactSource();const command=process.argv[2],mode=process.argv[3];
 if(command==='build'){
  await Promise.all(Object.values(policy).map(baseline));
  const run=await gh('/actions/runs/42335014564');assert.equal(run.head_sha,parent);assert.equal(run.conclusion,'success');
  const a=await gh('/actions/artifacts/13559292107');assert.equal(a.digest,'sha256:dac470effd02f84c974f7672021e80e672967131cb35d0c67d0597b224edb8a8');
  assert.equal(a.workflow_run.head_sha,parent);assert.equal(a.expired,false);
  const bytes=readFileSync('coach-base/seal.json');assert.equal(hash(bytes),priorSeal);const old=JSON.parse(bytes);assert.equal(old.sha,parent);
  mkdirSync('coach-release');
  for(const m of ['dev','prod']){assert.deepEqual(walk('coach-base/'+m),old[m].files);cpSync('coach-base/'+m,'coach-release/'+m,{recursive:true,force:false,errorOnExist:true});}
  const manifest={sha,parent,dev:overlay('coach-release/dev','dev'),prod:overlay('coach-release/prod','prod')};
  writeFileSync('coach-release/seal.json',JSON.stringify(manifest)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha,changedAssetsPerSurface:3,devIndex:manifest.dev.index,prodIndex:manifest.prod.index,existingConfigPreserved:true}));
 }else if(command==='deploy-check'){
  assert.ok(mode in policy);if(mode==='prod')assert.equal(process.env.APPROVED_SHA,sha,'EXACT_PRODUCTION_APPROVAL_REQUIRED');
  await receipt();const seal=JSON.parse(readFileSync('coach-release/seal.json','utf8'));assert.equal(seal.sha,sha);assert.equal(seal.parent,parent);
  assert.deepEqual(walk('coach-release/'+mode),seal[mode].files);assert.equal(seal[mode].files['r4-scoped-coach.js'],moduleHash);
  assert.equal(seal[mode].files['r4-scoped-coach-workflows.js'],workflowHash);
  const recovery=await preflight(policy[mode]);console.log(JSON.stringify({sha,mode,recovery,index:seal[mode].index}));
 }else throw Error('INVALID_COMMAND');
}catch(e){console.error('R4_COACH_RELEASE_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
