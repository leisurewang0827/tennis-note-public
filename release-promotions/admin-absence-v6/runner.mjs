// Exact administrator overlay only. All remote writes require this protected job.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {verifyAdmin} from './readiness.mjs';
import {validateCompletion} from './completion.mjs';
const here=dirname(fileURLToPath(import.meta.url)),raw=readFileSync(join(here,'manifest.json')),m=JSON.parse(raw),e=process.env;
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-admin-prod-candidate',folder='release-promotions/admin-absence-v6',workflow='.github/workflows/admin-absence-v6.yml',project='tennisnote-admin';
const paths=[workflow,...['runner.mjs','readiness.mjs','completion.mjs','check.mjs','manifest.json',...Object.keys(m.changed).map(n=>'assets/'+n)].map(n=>folder+'/'+n)].sort();
const controls=['_headers','_redirects','_worker.js'];
let phase='CONTEXT';
function diagnostic(error,where=phase){const reason=error?.code==='ERR_ASSERTION'?'ASSERTION':/^[A-Z_]+$/.test(error?.message||'')?error.message:'CHECK_FAILED';return {phase:where,reason,...(error?.readiness?{readiness:error.readiness}:{})}}
function evidence(name,data){writeFileSync(join(e.RUNNER_TEMP,name),JSON.stringify(data)+'\n',{flag:'wx'})}
export const target=Object.fromEntries(Object.entries(m.baseline).map(([n,h])=>[n,m.changed[n]||h]));
const visible=x=>Object.fromEntries(Object.entries(x).filter(([n])=>!controls.includes(n)));
export function overlay(base,delta){
 assert.deepEqual(Object.keys(base).sort(),Object.keys(m.baseline).sort());assert.equal(Object.keys(base).length,181);
 for(const [n,b]of Object.entries(base))assert.equal(hash(b),m.baseline[n],'BASELINE_DRIFT');
 assert.deepEqual(Object.keys(delta).sort(),Object.keys(m.changed).sort());for(const [n,b]of Object.entries(delta))assert.equal(hash(b),m.changed[n],'DELTA_DRIFT');return {...base,...delta};
}
function walk(dir,p=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(x=>{assert(x.isFile()||x.isDirectory());const n=p+x.name;return x.isDirectory()?Object.entries(walk(join(dir,x.name),n+'/')):[[n,readFileSync(join(dir,x.name))]]}))}
function tree(dir,files){for(const[n,b]of Object.entries(files)){assert(!n.startsWith('/')&&!n.includes('\\')&&!n.split('/').some(p=>!p||p==='.'||p==='..'));const p=join(dir,n);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b,{flag:'wx'})}}
function context(){
 assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);assert.equal(e.GITHUB_REF,'refs/heads/'+branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(e.GITHUB_WORKFLOW_REF,`${repo}/${workflow}@refs/heads/${branch}`);assert.equal(git('rev-parse','HEAD'),e.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${e.GITHUB_SHA} ${m.parent}`);
 assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',m.parent,'HEAD').split('\n').sort(),paths);
 assert.equal(m.kind,'ADMIN_ABSENCE_V6');assert.equal(m.parent,'64a045e676aa4816f0d974a1a3f63eeb57c4fdae');assert.equal(m.prior,'bcc6b9cc-a6be-451a-b4b5-f39323d59f77');
 for(const[n,h]of Object.entries(m.changed))assert.equal(hash(readFileSync(join(here,'assets',n))),h);
}
async function get(url,token){const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,`HTTP_${r.status}`);return r.json()}
const ghApi=`https://api.github.com/repos/${repo}`;
async function build(){
 phase='BUILD_ARTIFACT';
 const a=await get(`${ghApi}/actions/artifacts/14486218857`,e.GH_TOKEN);assert.equal(a.name,'admin-absence-group-44433060159');assert.equal(a.workflow_run?.id,44433060159);assert.equal(a.workflow_run?.head_sha,'f38bc845af1409846e81bf87d0c931adaa01179d');assert.equal(a.digest,'sha256:7c9ee3106a531c2c692d709e1d3fbcfefbc9ea2c12b9cdcdfd277861c0a717ee');assert.equal(a.expired,false);
 const input=join(e.RUNNER_TEMP,'admin-v6-previous'),seal=JSON.parse(readFileSync(join(input,'seal.json')));assert.deepEqual(seal,{source:'f38bc845af1409846e81bf87d0c931adaa01179d',manifest:'67d551a4d7f2b917776f07a39027bac02a4cba6dc59fdc7644ede4ac253d3dd7',files:m.baseline});
 const files=overlay(walk(join(input,'site')),Object.fromEntries(Object.keys(m.changed).map(n=>[n,readFileSync(join(here,'assets',n))]))),out=join(e.RUNNER_TEMP,'admin-v6-artifact');tree(join(out,'site'),files);
 writeFileSync(join(out,'seal.json'),JSON.stringify({source:e.GITHUB_SHA,manifest:hash(raw),files:target})+'\n',{flag:'wx'});console.log('EXACT_OVERLAY_PASS 181 3 178');
}
function identity(x){assert.equal(x.success,true);assert.equal(x.result?.name,project);assert.equal(x.result?.production_branch,'main');const d=x.result.canonical_deployment;return {project,id:d.id,source:d.deployment_trigger?.metadata?.commit_hash,branch:d.deployment_trigger?.metadata?.branch,environment:d.environment,status:d.latest_stage?.status}}
function expected(id,source){return {project,id,source,branch:'main',environment:'production'}}
export function assertOwn(x,id,source){assert.deepEqual(x,{...expected(id,source),status:'success'},'OWN_IDENTITY_DENIED')}
function assertPrior(x){assert.deepEqual(x,{...expected(m.prior,m.priorSource),status:'success'})}
function review(items,sha){assert.equal(items.length,1);const a=items[0];assert.equal(a.state,'approved');assert.equal(a.user?.id,294703475);assert.deepEqual(a.environments.map(v=>v.id),[26219323796]);assert.equal(a.comment,`ADMIN-ABSENCE-V6 ${sha} exact-assets no-db`)}
export function postOnce(url,token,request=https.request){return new Promise((done,reject)=>{let settled=false;const finish=ok=>{if(settled)return;settled=true;ok?done():reject(Error('ROLLBACK_RESPONSE_UNKNOWN'))};const req=request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},timeout:15000},r=>{let b='';r.on('error',()=>finish(false));r.on('aborted',()=>finish(false));r.on('data',x=>{b+=x;if(b.length>1048576){finish(false);req.destroy()}});r.on('end',()=>{try{assert.equal(r.statusCode,200);assert.equal(JSON.parse(b).success,true);finish(true)}catch{finish(false)}})});req.on('timeout',()=>{finish(false);req.destroy()});req.on('error',()=>finish(false));req.end('{}')})}
function transport(original){
 const b=execFileSync('git',['show','b0920a7798b878eaf972ae28870371b89d29b9ed:scripts/r4_internal_registration_dev.mjs']);assert.equal(hash(b),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677');const s=b.toString(),a=s.indexOf('export function patchWrangler('),z=s.indexOf('export const requestPath=',a);assert(a>=0&&z>a);
 const fn=Function('assert','hash','wranglerSha256',s.slice(a,z).replace('export function','function')+';return patchWrangler;')(assert,hash,'ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e');const p=fn(original);assert.equal(p.split('tennisnote-admin-dev').length,3);const result=p.replaceAll('tennisnote-admin-dev',project);assert.equal(hash(result),'e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4');return result;
}
async function publish(){
 phase='PROTECTED_CONTEXT';
 const gh=e.GH_TOKEN,token=e.CLOUDFLARE_API_TOKEN,account=e.CLOUDFLARE_ACCOUNT_ID;assert(gh&&token);assert.match(account||'',/^[a-f0-9]{32}$/);assert.equal(hash(account),e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const cf=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`,observe=async()=>identity(await get(cf,token)),approve=async()=>review(await get(`${ghApi}/actions/runs/${e.GITHUB_RUN_ID}/approvals`,gh),e.GITHUB_SHA);
 const dir=join(e.RUNNER_TEMP,'admin-v6-artifact'),seal=JSON.parse(readFileSync(join(dir,'seal.json'))),files=walk(join(dir,'site'));assert.deepEqual(seal,{source:e.GITHUB_SHA,manifest:hash(raw),files:target});assert.deepEqual(Object.keys(files).sort(),Object.keys(target).sort());for(const[n,b]of Object.entries(files))assert.equal(hash(b),target[n]);
 const jobs=await get(`${ghApi}/actions/runs/${e.GITHUB_RUN_ID}/attempts/1/jobs?per_page=100`,gh);assert.equal(jobs.total_count,jobs.jobs.length);const source=jobs.jobs.filter(x=>x.name==='verify-source');assert.equal(source.length,1);assert.equal(source[0].conclusion,'success');
 phase='CF_RECOVERY_PREFLIGHT';const recovery=await get(`${cf}/deployments/${m.prior}`,token),d=recovery.result;assert.equal(recovery.success,true);assert.equal(d.id,m.prior);assert.equal(d.latest_stage?.status,'success');assert.equal(d.environment,'production');assert.equal(d.deployment_trigger?.metadata?.commit_hash,m.priorSource);assert.equal(d.deployment_trigger?.metadata?.branch,'main');
 phase='PUBLIC_BASELINE';assertPrior(await observe());await verifyAdmin({expected:expected(m.prior,m.priorSource),assets:visible(m.baseline),previous:visible(m.baseline),observe});phase='GH_REVIEW_REF';await approve();assert.equal((await get(`${ghApi}/git/ref/heads/${branch}`,gh)).object?.sha,e.GITHUB_SHA);
 const root=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assert.equal(JSON.parse(readFileSync(join(root,'package.json'))).version,'3.90.0');const executable=join(root,'wrangler-dist/cli-admin-v6-once.cjs');writeFileSync(executable,transport(readFileSync(join(root,'wrangler-dist/cli.js'))),{flag:'wx'});
 assertPrior(await observe());await approve();phase='PUBLISH';console.log('PUBLISH_STARTED_SINGLE_ATTEMPT');
 // The transport has exactly one deployment POST and never retries an unknown outcome.
 await new Promise(done=>{let settled=false;const finish=()=>{if(!settled){settled=true;clearTimeout(timer);done()}};const child=spawn(process.execPath,[executable,'pages','deploy',join(dir,'site'),'--project-name='+project,'--branch=main','--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],{shell:false,stdio:['ignore','ignore','ignore'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}});const timer=setTimeout(()=>{child.kill();finish()},120000);child.on('error',finish);child.on('close',finish)});
 phase='CF_POSTPUBLISH';let own;for(let i=0;i<12;i++){const x=await observe();if(x.source===e.GITHUB_SHA){assert.notEqual(x.id,m.prior);assert.equal(x.project,project);assert.equal(x.branch,'main');assert.equal(x.environment,'production');if(x.status==='success'){assertOwn(x,x.id,e.GITHUB_SHA);own=x;break}}else assertPrior(x);await new Promise(r=>setTimeout(r,2000))}assert(own,'PUBLISH_UNKNOWN_NO_RETRY');
 let proof;
 try{phase='PUBLIC_CANDIDATE';proof=await verifyAdmin({expected:expected(own.id,e.GITHUB_SHA),assets:visible(target),previous:visible(m.baseline),observe});await approve();assertOwn(await observe(),own.id,e.GITHUB_SHA)}
 catch(err){evidence('admin-v6-publication-failure.json',diagnostic(err));phase='ROLLBACK_IDENTITY_REVIEW_REF';assertOwn(await observe(),own.id,e.GITHUB_SHA);await approve();assert.equal((await get(`${ghApi}/git/ref/heads/${branch}`,gh)).object?.sha,e.GITHUB_SHA);assertOwn(await observe(),own.id,e.GITHUB_SHA);phase='ROLLBACK_POST_ONCE';let response;try{await postOnce(`${cf}/deployments/${m.prior}/rollback`,token);response='accepted'}catch{response='unknown'}phase='ROLLBACK_READBACK';assertPrior(await observe());const restored=await verifyAdmin({expected:expected(m.prior,m.priorSource),assets:visible(m.baseline),previous:visible(target),observe});evidence('admin-v6-recovery.json',{status:'ROLLBACK_VERIFIED',response,restored});console.log('ROLLBACK_VERIFIED '+response);throw err}
 // Receipt I/O is outside rollback catch: missing evidence fails CI, not a second deployment.
 phase='COMPLETION_EVIDENCE';evidence('admin-v6-publication-proof.json',proof);const receipt={status:'ADMIN_V6_COMPLETED',source:e.GITHUB_SHA,runId:e.GITHUB_RUN_ID,attempt:1,deploymentId:own.id,prior:m.prior,manifest:hash(raw),responses:proof.responses,mismatch:proof.mismatch,dbWrites:0,createdAt:new Date().toISOString()};validateCompletion(receipt,{source:e.GITHUB_SHA,runId:e.GITHUB_RUN_ID,manifest:hash(raw),now:Date.now()});writeFileSync(join(e.RUNNER_TEMP,'admin-v6-completion.json'),JSON.stringify(receipt)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
}
async function main(){context();if(process.argv[2]==='build')return build();if(process.argv[2]==='publish')return publish();if(process.argv[2]==='completion'){const r=JSON.parse(readFileSync(join(e.RUNNER_TEMP,'admin-v6-completion.json')));validateCompletion(r,{source:e.GITHUB_SHA,runId:e.GITHUB_RUN_ID,manifest:hash(raw),now:Date.now()});console.log('ADMIN_V6_COMPLETION_VERIFIED');return}throw Error('MODE_DENIED')}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const guard=setTimeout(()=>{console.error('ADMIN_V6_HOLD DEADLINE');process.exit(1)},420000);try{await main()}catch(error){const data=diagnostic(error);console.error(JSON.stringify({status:'ADMIN_V6_HOLD',...data}));try{evidence('admin-v6-failure.json',data)}catch{}process.exitCode=1}finally{clearTimeout(guard)}}
