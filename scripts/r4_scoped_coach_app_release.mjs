import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {hash,walk,policy,baselineCheck,makeProductionBase,overlay} from './build_r4_scoped_coach_app.mjs';
const repository='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-admin-prod-candidate';
const parent='c4ff61948cf34922fb7b6749014729a59e52a3ee';
const checkpointParent='6e626e29d9c9e9f4739a189d1e8d61ec20b942cb';
const sourcePin='b45499e49a1dcfec8a86e846bc573620ae908d498799830fa1f8cd12a3084c78';
const basePins={dev:'6b6e59d62fe9d464b43662c81e24a8e5f45350be2b225d925bc7a587dcd8922b',prod:'912b3590682012a3b6c131ee185f9ae66776ef620136417615dc344c62f2e9ba'};
const configPins={dev:'2876392b257795e386dacf06b07a3ce568dcdaa27357d5e91961564e697cc3de',prod:'0a89879945c847ecf2244823a1a32ff21dfb6936ecc80706b183c7231671bd64'};
const rootPins={dev:'1b1072ef801d0d3a150b152c96eb5562daf24099945da1e2b3dfbeaeb44250c9',prod:'cdafbcc2f3257fa3fa82fcb2d13040412ce81ddcf53e1ce59e7fd47ff5cd5dbc'};
const sha=process.env.GITHUB_SHA;
const get=async(url,token)=>{const r=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'REMOTE_READ_BLOCKED');return r;};
const gh=async path=>(await get('https://api.github.com/repos/'+repository+path,process.env.GH_TOKEN)).json();
const exact=()=>{
 assert.equal(process.env.GITHUB_REPOSITORY,repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);
 assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(process.env.REVIEWED_SHA,sha);assert.match(sha||'',/^[a-f0-9]{40}$/);
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 assert.equal(git('rev-list','--parents','-n','1',sha),sha+' '+checkpointParent);
 assert.deepEqual(git('diff','--name-only',checkpointParent,sha).split('\n').sort(),['app/tennis-note-coach-app/r4-scoped-workspace.css','scripts/build_r4_scoped_coach_app.mjs','scripts/r4_scoped_coach_app_release.mjs']);
 assert.deepEqual(git('diff','--name-only',parent,sha).split('\n').sort(),['.github/workflows/deploy-cloudflare-pages.yml','app/tennis-note-coach-app/data/r4-scoped-workspace.js','app/tennis-note-coach-app/r4-scoped-workspace.css','scripts/build_r4_scoped_coach_app.mjs','scripts/r4_scoped_coach_app_release.mjs'].sort());
 assert.equal(hash(readFileSync('app/tennis-note-coach-app/data/r4-scoped-workspace.js')),sourcePin);
 assert.equal(hash(readFileSync('app/tennis-note-coach-app/r4-scoped-workspace.css')),'cce20c1ec9f7b111be6254351e85e9e5b96fec0db08c6f1a3211f2510f03654e');
};
const live=async mode=>{
 await baselineCheck(mode);const p=policy[mode];
 for(const [path,pin]of [['',rootPins[mode]],['shared/config.local.js',configPins[mode]]])
  assert.equal(hash(Buffer.from(await(await get('https://'+p.site+'.pages.dev/'+path)).arrayBuffer())),pin,'NON_COACH_LIVE_DRIFT');
};
const prior=async()=>{
 const id=process.env.VERIFY_RUN;assert.match(id||'',/^\d+$/);const run=await gh('/actions/runs/'+id);
 assert.equal(run.head_sha,sha);assert.equal(run.head_branch,branch);assert.equal(run.event,'workflow_dispatch');assert.equal(run.run_attempt,1);assert.equal(run.conclusion,'success');
 assert.ok(run.path.startsWith('.github/workflows/deploy-cloudflare-pages.yml'));
 const {jobs}=await gh('/actions/runs/'+id+'/jobs?per_page=100');assert.equal(jobs.find(x=>x.name==='app-verify')?.conclusion,'success');
 assert.ok(['app-dev','app-prod','coach-verify','coach-dev','coach-prod','verify-candidate','admin-only','development-only'].every(n=>jobs.find(x=>x.name===n)?.conclusion==='skipped'));
};
const preflight=async mode=>{
 const t=policy[mode],account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token);if(mode==='dev')assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const data=await(await get('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+t.site,token)).json();
 assert.equal(data.success,true);assert.equal(data.result.name,t.site);assert.equal(data.result.production_branch,t.branch);
 const c=data.result.canonical_deployment;assert.match(c.id,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.equal(c.id.slice(0,8),t.base);assert.equal(c.url,'https://'+t.base+'.'+t.site+'.pages.dev');
 assert.equal(c.latest_stage.status,'success');assert.equal(c.deployment_trigger.metadata.branch,t.branch);assert.equal(c.deployment_trigger.metadata.commit_hash,t.source);
 await live(mode);return c.id;
};
try{
 exact();const command=process.argv[2],mode=process.argv[3];
 if(command==='build'){
  await Promise.all(['dev','prod'].map(live));
  const run=await gh('/actions/runs/42059081638');assert.equal(run.head_sha,policy.dev.source);assert.equal(run.conclusion,'success');
  const a=await gh('/actions/artifacts/13431390236');assert.equal(a.expired,false);assert.equal(a.digest,'sha256:17f721b5f3af5705a18b1dd58d62edfb48963dd5f388b5268a9bca68fc0124ca');
  const seal=readFileSync('app-base/r4-marketplace-seal.json');assert.equal(hash(seal),'ea332e093adcc9d7a5c761ad1bdb67aec359267b0996f4e98568d8ca378ec6c3');
  const expected=Object.fromEntries(JSON.parse(seal).files.filter(x=>x.path.startsWith('member/')).map(x=>[x.path.slice(7),x.sha256]));
  assert.deepEqual(walk('app-base/r4-marketplace-paired/member'),expected);
  mkdirSync('coach-app-release');cpSync('app-base/r4-marketplace-paired/member','coach-app-release/dev',{recursive:true,force:false,errorOnExist:true});
  await makeProductionBase('coach-app-release/prod');
  const result={sha,parent};
  for(const m of ['dev','prod']){
   assert.equal(hash(JSON.stringify(walk('coach-app-release/'+m))),basePins[m],'EXACT_BASE_MANIFEST_REQUIRED');
   result[m]=overlay('coach-app-release/'+m,m);
   assert.equal(result[m].files['shared/config.local.js'],configPins[m]);assert.equal(result[m].files['index.html'],rootPins[m]);
  }
  writeFileSync('coach-app-release/seal.json',JSON.stringify(result)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha,changedCoachAssets:7,memberAndConfigUnchanged:true,devIndex:result.dev.files['tennis-note-coach-app/index.html'],prodIndex:result.prod.files['tennis-note-coach-app/index.html']}));
 }else if(command==='deploy-check'){
  assert.ok(mode==='dev'||mode==='prod');if(mode==='prod')assert.equal(process.env.APPROVED_SHA,sha,'EXACT_APP_APPROVAL_REQUIRED');
  await prior();const seal=JSON.parse(readFileSync('coach-app-release/seal.json'));assert.equal(seal.sha,sha);assert.equal(seal.parent,parent);
  assert.deepEqual(walk('coach-app-release/'+mode),seal[mode].files);
  assert.equal(hash(JSON.stringify(seal[mode].baseFiles)),basePins[mode]);assert.equal(seal[mode].files['shared/config.local.js'],configPins[mode]);
  const recovery=await preflight(mode);console.log(JSON.stringify({sha,mode,recovery,coachIndex:seal[mode].files['tennis-note-coach-app/index.html'],memberUnchanged:true}));
 }else throw Error('INVALID_COMMAND');
}catch(e){console.error('R4_COACH_APP_BLOCKED: '+String(e.message).split('\n')[0].slice(0,180));process.exitCode=1;}
