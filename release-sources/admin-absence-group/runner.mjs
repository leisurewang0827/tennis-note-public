// Protected release connection. No DB access, no direct invocation outside the pinned GitHub job.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error(x);};
const here=dirname(fileURLToPath(import.meta.url)), manifestBytes=readFileSync(join(here,'manifest.json'));
const m=JSON.parse(manifestBytes),admin=m.kind==='ADMIN_ABSENCE_GROUP_V1';
assert.ok(admin||m.kind==='COACH_ABSENCE_GROUP_V1','KIND_DENIED');
const folder=admin?'admin-absence-group':'coach-absence-group';
const workflow=`.github/workflows/${folder}.yml`;
const manifestSha=admin?'67d551a4d7f2b917776f07a39027bac02a4cba6dc59fdc7644ede4ac253d3dd7':'d5ea8aa12db801100c96f273f6451a9ebe8d8943d78288188a08977c93716add';
assert.equal(sha(manifestBytes),manifestSha,'MANIFEST_DRIFT');
const repo='leisurewang0827/tennis-note-public',branch=admin?'codex/tennisnote-r4-ui-finish-dev-20261108':'codex/tennisnote-r4-admin-prod-candidate';
const project=admin?'tennisnote-admin':'tennisnote-app';
const origin=`https://${project}.pages.dev`,fixed=`https://${m.prior.slice(0,8)}.${project}.pages.dev`;
const changed=Object.keys(m.changed).sort(),baseNames=Object.keys(m.baseline).sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const baseFolder=`release-sources/${folder}`;
const paths=[workflow,`${baseFolder}/manifest.json`,`${baseFolder}/runner.mjs`,...changed.map(p=>admin?`${baseFolder}/assets/${p}`:`app/${p}`)].sort();
const targetHash=()=>Object.fromEntries(baseNames.map(p=>[p,m.changed[p]||m.baseline[p]]));
const productPath=p=>admin?`${baseFolder}/assets/${p}`:`app/${p}`;
export function validateOverlay(base,delta,baseline,expected){
 assert.deepEqual(Object.keys(base).sort(),Object.keys(baseline).sort(),'BASE_SCOPE');
 for(const p of Object.keys(base))assert.equal(sha(base[p]),baseline[p],'BASE_DRIFT');
 assert.deepEqual(Object.keys(delta).sort(),Object.keys(expected).sort(),'DELTA_SCOPE');
 const result={...base};for(const p of Object.keys(delta)){assert.ok(Object.hasOwn(base,p),'ASSET_ABSENT');assert.equal(sha(delta[p]),expected[p],'DELTA_DRIFT');result[p]=delta[p];}
 return result;
}
function walk(dir,p=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert.ok(e.isFile()||e.isDirectory(),'UNSAFE_FILE');let n=p+e.name;return e.isDirectory()?Object.entries(walk(join(dir,e.name),n+'/')):[[n,readFileSync(join(dir,e.name))]];}));}
function pathFor(p){assert.ok(!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>x==='..'||x===''||x==='.'),'PATH_DENIED');return '/'+(p.endsWith('index.html')?p.slice(0,-10):p.replace(/\.html$/,''));}
async function bytes(host,p){const r=await fetch(host+pathFor(p),{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'ASSET_READ_FAILED');return Buffer.from(await r.arrayBuffer());}
const controls=['_headers','_redirects','_worker.js'];
async function readRemote(hashes,host){
 const names=Object.keys(hashes).filter(p=>!controls.includes(p));
 for(let i=0;i<names.length;i+=8)await Promise.all(names.slice(i,i+8).map(async p=>{
  if(admin&&p.startsWith('tennis-note-member-app/')){const r=await fetch(host+pathFor(p),{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000)});assert.equal(r.status,302,'REDIRECT_STATUS');assert.equal(r.headers.get('location'),'https://tennisnote-app.pages.dev/','REDIRECT_TARGET');return;}
  assert.equal(sha(await bytes(host,p)),hashes[p],'REMOTE_DRIFT');
 }));return names.length;
}
function context(){
 const e=process.env;assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);assert.equal(e.GITHUB_REF,'refs/heads/'+branch);
 assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');assert.equal(e.GITHUB_WORKFLOW_REF,`${repo}/${workflow}@refs/heads/${branch}`);
 assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(git('rev-parse','HEAD'),e.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${e.GITHUB_SHA} ${m.parent}`);
 assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',m.parent,'HEAD').split('\n').sort(),paths,'GIT_SCOPE');
}
async function baseline(){
 if(admin){
  const old=await import('../admin-absence-reasons/compose.mjs');
  const result=old.build(join(process.env.RUNNER_TEMP,'admin-absence-group-base'),join(process.env.RUNNER_TEMP,'admin-absence-group-old'));
  return result.files;
 }
 const out={};for(let i=0;i<baseNames.length;i+=8)await Promise.all(baseNames.slice(i,i+8).map(async p=>{
  const b=Object.hasOwn(m.controls,p)?Buffer.from(m.controls[p],'base64'):await bytes(fixed,p);
  assert.equal(sha(b),m.baseline[p],'BASELINE_DRIFT');out[p]=b;
 }));return out;
}
function delta(){return Object.fromEntries(changed.map(p=>[p,readFileSync(productPath(p))]));}
function writeTree(dir,files){for(const [p,b] of Object.entries(files)){const f=join(dir,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b,{flag:'wx'});}}
async function build(){
 const gh=process.env.GH_TOKEN,api=`https://api.github.com/repos/${repo}`;assert.ok(gh,'GITHUB_READ_TOKEN_MISSING');
 const id=admin?43391633723:44087595858;
 const previous=await getJson(`${api}/actions/runs/${id}`,gh);
 assert.equal(previous.id,id);assert.equal(previous.status,'completed');assert.equal(previous.conclusion,'success');assert.equal(previous.run_attempt,1);assert.equal(previous.event,'push');
 assert.equal(previous.head_sha,admin?'680f7d481121801a83972811bee41496e392aaf4':'543cc0661f710ba5f54b2e58106b8d13f129c412');
 assert.equal(previous.head_branch,'codex/tennisnote-r4-ui-finish-dev-20261108');assert.equal(previous.path,admin?'.github/workflows/r4-branch-finance-source-ci.yml':'.github/workflows/member-notification-readback.yml');
 if(admin){const artifact=await getJson(`${api}/actions/artifacts/${m.baseArtifact}`,gh);assert.equal(artifact.workflow_run?.id,id);assert.equal(artifact.workflow_run?.head_sha,previous.head_sha);assert.equal(artifact.expired,false);assert.equal(artifact.digest,'sha256:e3cedb9135f1f5703a81f65ee96e43d59953596678e649b5b449c333c5d4b6a6');assert.ok(Date.parse(artifact.expires_at)>Date.now());}
 const original=await baseline(),result=validateOverlay(original,delta(),m.baseline,m.changed),out=join(process.env.RUNNER_TEMP,folder+'-artifact');
 writeTree(join(out,'site'),result);writeFileSync(join(out,'seal.json'),JSON.stringify({source:process.env.GITHUB_SHA,manifest:manifestSha,files:targetHash()})+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'EXACT_OVERLAY_VERIFIED',base:baseNames.length,changed:changed.length,source:process.env.GITHUB_SHA}));
}
async function getJson(url,token){const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,'API_READ_FAILED');return r.json();}
function preimage(x){const d=x.result?.canonical_deployment;assert.equal(x.success,true);assert.equal(x.result?.name,project);assert.equal(x.result?.production_branch,'main');assert.equal(d?.id,m.prior);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,m.priorSource);}
function recovery(x){const d=x.result;assert.equal(x.success,true);assert.equal(d?.id,m.prior);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,m.priorSource);assert.equal(d.url,fixed);}
function review(items,commit){assert.equal(items.length,1,'REVIEW_AMBIGUOUS');const a=items[0];assert.equal(a.state,'approved');assert.equal(a.user?.id,294703475);assert.deepEqual(a.environments.map(x=>x.id),[26219323796]);assert.equal(a.comment,`${admin?'ADMIN':'COACH'}-ABSENCE-GROUP ${commit} exact-assets no-db`);}
export function singleTransport(original){
 const raw=execFileSync('git',['show','b0920a7798b878eaf972ae28870371b89d29b9ed:scripts/r4_internal_registration_dev.mjs']);
 assert.equal(sha(raw),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677','TRANSPORT_SOURCE_DRIFT');
 const text=raw.toString(),a=text.indexOf('export function patchWrangler('),b=text.indexOf('export const requestPath=',a);assert.ok(a>=0&&b>a);
 const fn=Function('assert','hash','wranglerSha256',text.slice(a,b).replace('export function','function')+';return patchWrangler;')(assert,sha,'ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e');
 const patched=fn(original);assert.equal(patched.split('tennisnote-admin-dev').length,3,'TRANSPORT_SCOPE_DRIFT');return patched.replaceAll('tennisnote-admin-dev',project);
}
async function publish(){
 const e=process.env,gh=e.GH_TOKEN,account=e.CLOUDFLARE_ACCOUNT_ID,token=e.CLOUDFLARE_API_TOKEN;
 assert.ok(gh&&token);assert.match(account||'',/^[a-f0-9]{32}$/);assert.equal(sha(account),e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT,'ACCOUNT_MISMATCH');
 const api=`https://api.github.com/repos/${repo}`,cf=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`;
 const dir=join(e.RUNNER_TEMP,folder+'-artifact'),seal=JSON.parse(readFileSync(join(dir,'seal.json')));
 assert.deepEqual(seal,{source:e.GITHUB_SHA,manifest:manifestSha,files:targetHash()});
 const data=walk(join(dir,'site'));assert.deepEqual(Object.keys(data).sort(),baseNames);for(const p of baseNames)assert.equal(sha(data[p]),targetHash()[p],'ARTIFACT_DRIFT');
 const jobs=await getJson(`${api}/actions/runs/${e.GITHUB_RUN_ID}/attempts/1/jobs?per_page=100`,gh);assert.equal(jobs.total_count,jobs.jobs.length);const j=jobs.jobs.filter(x=>x.name==='verify-source');assert.equal(j.length,1);assert.equal(j[0].conclusion,'success');
 const approval=async()=>review(await getJson(`${api}/actions/runs/${e.GITHUB_RUN_ID}/approvals`,gh),e.GITHUB_SHA);
 const state=async()=>preimage(await getJson(cf,token));
 await state();recovery(await getJson(`${cf}/deployments/${m.prior}`,token));await Promise.all([readRemote(m.baseline,origin),readRemote(m.baseline,fixed)]);await state();await approval();
 const ref=await getJson(`${api}/git/ref/heads/${branch}`,gh);assert.equal(ref.object?.sha,e.GITHUB_SHA,'BRANCH_MOVED');
 const root=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assert.equal(JSON.parse(readFileSync(join(root,'package.json'))).version,'3.90.0');
 const executable=join(root,'wrangler-dist/cli-absence-group-single.cjs'),transport=singleTransport(readFileSync(join(root,'wrangler-dist/cli.js')));
 assert.equal(sha(transport),admin?'e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4':'2cb46cfd629498bc5bd898bf5130acd9ebc61257f196d41e74fb1df01520f287','TRANSPORT_OUTPUT_DRIFT');writeFileSync(executable,transport,{flag:'wx'});
 await state();recovery(await getJson(`${cf}/deployments/${m.prior}`,token));await approval();
 let used=false;const once=async()=>{assert.equal(used,false,'PUBLISH_RETRY_DENIED');used=true;return new Promise(done=>{
  let output='',finished=false;const finish=x=>{if(!finished){finished=true;clearTimeout(timer);done(x);}};
  const child=spawn(process.execPath,[executable,'pages','deploy',join(dir,'site'),'--project-name='+project,'--branch=main','--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],{shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}});
  const timer=setTimeout(()=>{child.kill();finish(null);},120000);child.stdout.on('data',x=>{output+=x;if(output.length>1048576)child.kill();});child.stderr.resume();child.on('error',()=>finish(null));child.on('close',code=>{const matches=[...new Set(output.match(new RegExp(`https://[a-f0-9]{8}\\.${project}\\.pages\\.dev`,'g'))||[])];finish(code===0&&matches.length===1?matches[0]:null);});
 });};
 const url=await once();
 if(!url){
  try{const v=await getJson(cf,token),d=v.result?.canonical_deployment;
   const observed=v.success===true&&v.result?.name===project&&v.result?.production_branch==='main'
    ? d?.id===m.prior?'prior':d?.deployment_trigger?.metadata?.commit_hash===e.GITHUB_SHA?'candidate':'unclassified'
    : 'unclassified';console.log(JSON.stringify({status:'PUBLISH_UNKNOWN_NO_RETRY',observed}));
  }catch{console.log(JSON.stringify({status:'PUBLISH_UNKNOWN_NO_RETRY',observed:'read_failed'}));}
  fail('PUBLISH_UNKNOWN_NO_RETRY');
 }
 const post=await getJson(cf,token),d=post.result?.canonical_deployment;assert.equal(post.success,true);assert.match(d?.id||'',/^[a-f0-9-]{36}$/);assert.notEqual(d.id,m.prior);assert.equal(url,`https://${d.id.slice(0,8)}.${project}.pages.dev`);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,e.GITHUB_SHA);
 const counts=await Promise.all([readRemote(targetHash(),origin),readRemote(targetHash(),url)]);assert.equal((await getJson(cf,token)).result?.canonical_deployment?.id,d.id,'CANONICAL_MOVED');
 console.log(JSON.stringify({status:'PUBLISHED_READBACK_PASS',deploymentId:d.id,source:e.GITHUB_SHA,prior:m.prior,counts,dbWrites:0}));
}
async function main(){context();const mode=process.argv[2];if(mode==='build')return build();if(mode==='publish')return publish();fail('MODE_DENIED');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('ABSENCE_GROUP_HOLD',/^[A-Z_]{3,50}$/.test(e?.message||'')?e.message:'CHECK_FAILED');process.exitCode=1;});
