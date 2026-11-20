// DEV-only single-attempt publisher. Adapts the existing pinned V15F transport.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {verifySource} from './v16-git-chain.mjs';
import {expectedDevMap,createReceiptJournal} from './v16-site-overlay.mjs';
const e=process.env,hash=b=>createHash('sha256').update(b).digest('hex');
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-admin-prod-candidate',alias='r4-absence-group-qa';
const root='release-sources/v16-preview',binding=JSON.parse(readFileSync(join(root,'v16-execution.json'),'utf8'));
const sites={coach:{project:'tennisnote-app-dev',canonical:'035ade34-d322-42f0-8b17-5c66b57dd59d',previous:'ac7ab685-907b-4a3a-a8c8-68950d7c4682'},admin:{project:'tennisnote-admin-dev',canonical:'6053d5a1-fe01-4867-a933-8f6dea4aedda',previous:'83aef268-0c37-42c6-8c5d-aeb0ab1bab04'}};
assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);assert.equal(e.GITHUB_REF,'refs/heads/'+branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
assert.equal(e.GITHUB_WORKFLOW_REF,repo+'/.github/workflows/v16-dev-preview.yml@refs/heads/'+branch);
assert.match(e.CLOUDFLARE_ACCOUNT_ID||'',/^[a-f0-9]{32}$/);assert.equal(hash(e.CLOUDFLARE_ACCOUNT_ID),e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);assert(e.CLOUDFLARE_API_TOKEN&&e.GH_TOKEN);
verifySource(binding.sourceCommit);
const git=(...a)=>execFileSync('git',a,{maxBuffer:20000000,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
assert.equal(git('rev-parse','HEAD').toString().trim(),e.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1',e.GITHUB_SHA).toString().trim(),e.GITHUB_SHA+' '+binding.sourceCommit);
const get=async(url,token)=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'API_READ_FAILED');return r.json()};
const gh='https://api.github.com/repos/'+repo,account=e.CLOUDFLARE_ACCOUNT_ID,token=e.CLOUDFLARE_API_TOKEN;
const branchCheck=async()=>assert.equal((await get(gh+'/git/ref/heads/'+branch,e.GH_TOKEN)).object.sha,e.GITHUB_SHA,'BRANCH_MOVED');
const state=async mode=>{const s=sites[mode],url=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${s.project}`,p=await get(url,token);assert.equal(p.success,true);assert.equal(p.result.name,s.project);assert.equal(p.result.production_branch,'dev');assert.equal(p.result.canonical_deployment.id,s.canonical);assert.equal(p.result.canonical_deployment.latest_stage.status,'success');let all=[],page=1,total=1;do{const r=await get(url+'/deployments?page='+page,token);assert.equal(r.success,true);assert.equal(r.result_info.page,page);if(page>1)assert.equal(r.result_info.total_pages,total);total=r.result_info.total_pages;assert(total>=1&&total<=100);all.push(...r.result);page++}while(page<=total);const matches=all.filter(d=>(d.aliases||[]).includes(`https://${alias}.${s.project}.pages.dev`));assert.equal(matches.length,1,'ALIAS_AMBIGUOUS');return matches[0]};
const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(x=>{assert(x.isFile()||x.isDirectory());const n=p+x.name;return x.isDirectory()?Object.entries(walk(join(dir,x.name),n+'/')):[[n,hash(readFileSync(join(dir,x.name)))]]}));
const dir=join(e.RUNNER_TEMP,'v16-dev-sites'),seal=JSON.parse(readFileSync(join(dir,'seal.json'),'utf8'));assert.equal(seal.source,binding.sourceCommit);assert.equal(seal.executor,e.GITHUB_SHA);assert.equal(seal.runId,e.GITHUB_RUN_ID);assert.equal(seal.runtime,'development');
const priorManifestBytes=readFileSync(join(root,'prior-manifest.json'));
for(const mode of ['coach','admin']){const expected=expectedDevMap(mode,priorManifestBytes);assert.deepEqual(seal.sites[mode],expected,'SEAL_TARGET_MISMATCH');assert.deepEqual(walk(join(dir,mode)),expected,'ARTIFACT_TARGET_MISMATCH')}
await branchCheck();const run=await get(gh+'/actions/runs/'+e.GITHUB_RUN_ID,e.GH_TOKEN),jobs=await get(gh+'/actions/runs/'+e.GITHUB_RUN_ID+'/attempts/1/jobs?per_page=100',e.GH_TOKEN);assert.equal(run.head_sha,e.GITHUB_SHA);assert.equal(run.head_branch,branch);assert.equal(run.path,'.github/workflows/v16-dev-preview.yml');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);assert.equal(run.repository?.full_name,repo);assert.equal(jobs.total_count,jobs.jobs.length);assert.equal(jobs.jobs.filter(j=>j.name==='verify-source'&&j.conclusion==='success').length,1);
for(const mode of ['coach','admin']){const d=await state(mode);assert.equal(d.id,sites[mode].previous,'PREVIEW_BASELINE_CHANGED');assert.equal(d.latest_stage.status,'success');assert.equal(d.deployment_trigger.metadata.branch,alias)}
const original=git('show','b0920a7798b878eaf972ae28870371b89d29b9ed:scripts/r4_internal_registration_dev.mjs');assert.equal(hash(original),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677');const txt=original.toString(),a=txt.indexOf('export function patchWrangler('),z=txt.indexOf('export const requestPath=',a);assert(a>=0&&z>a);const patch=Function('assert','hash','wranglerSha256',txt.slice(a,z).replace('export function','function')+';return patchWrangler;')(assert,hash,'ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e');
const wr=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assert.equal(JSON.parse(readFileSync(join(wr,'package.json'))).version,'3.90.0');const transport=patch(readFileSync(join(wr,'wrangler-dist/cli.js')));assert.equal(transport.split('tennisnote-admin-dev').length,3);
const done={},receiptSeed={kind:'V16_DEV_PREVIEW_RECEIPT',sourceCommit:binding.sourceCommit,executor:e.GITHUB_SHA,runId:Number(e.GITHUB_RUN_ID),runAttempt:1,runtime:'development'};
const receiptPath=join(e.RUNNER_TEMP,'v16-dev-receipt.json');
const journal=createReceiptJournal(receiptPath,receiptSeed);
try{for(const mode of ['coach','admin']){
 await branchCheck();for(const k of ['coach','admin'])assert.equal((await state(k)).id,done[k]||sites[k].previous,'PREVIEW_DRIFT');
 const s=sites[mode],bin=join(wr,'wrangler-dist/v16-'+mode+'.cjs');writeFileSync(bin,transport.replaceAll('tennisnote-admin-dev',s.project),{flag:'wx'});
 journal.start(mode,s.previous);
 console.log(JSON.stringify({status:'PUBLISH_STARTED_SINGLE_ATTEMPT',surface:mode}));
 const url=await new Promise(resolve=>{let out='',finished=false;const finish=x=>{if(!finished){finished=true;clearTimeout(timer);resolve(x)}};const child=spawn(process.execPath,[bin,'pages','deploy',join(dir,mode),'--project-name='+s.project,'--branch='+alias,'--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],{shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}});const timer=setTimeout(()=>{child.kill();finish(null)},120000);child.stdout.on('data',x=>{out+=x;if(out.length>1048576)child.kill()});child.stderr.resume();child.on('error',()=>finish(null));child.on('close',code=>{const urls=[...new Set(out.match(new RegExp('https://[a-f0-9]{8}\\.'+s.project+'\\.pages\\.dev','g'))||[])];finish(code===0&&urls.length===1?urls[0]:null)})});
 assert(url,'PUBLISH_UNKNOWN_NO_RETRY');const d=await state(mode);assert.notEqual(d.id,s.previous);assert.equal(d.url,url);assert.equal(d.latest_stage.status,'success');assert.equal(d.deployment_trigger.metadata.branch,alias);assert.equal(d.deployment_trigger.metadata.commit_hash,e.GITHUB_SHA);done[mode]=d.id;journal.observed(mode,s.previous,d.id);
 const assets=mode==='admin'?['actions/settings.js','data/common.js','events/common.js','index.html','shared/tennisnote-release-updater.js','shared/config.local.js']:['index.html','service-worker.js','tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js','shared/tennisnote-release-updater.js','shared/config.local.js'];
 for(const name of assets)for(const host of [url,`https://${alias}.${s.project}.pages.dev`]){const p='/'+(name.endsWith('index.html')?name.slice(0,-10):name);const r=await fetch(host+p,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'READBACK_HTTP');assert.equal(hash(Buffer.from(await r.arrayBuffer())),seal.sites[mode][name],'READBACK_MISMATCH')}
 if(mode==='admin')for(const host of [url,`https://${alias}.${s.project}.pages.dev`]){const r=await fetch(host+'/tennis-note-member-app/preview-probe',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://r4-absence-group-qa.tennisnote-app-dev.pages.dev/')}
 journal.pass(mode,s.previous,d.id);
}
for(const mode of ['coach','admin'])assert.equal((await state(mode)).id,done[mode]);await branchCheck();journal.complete();console.log(JSON.stringify({status:'V16_DEV_PREVIEWS_PASS',dbWrites:0}));
}catch(error){try{journal.fail()}catch{console.error('RECEIPT_PERSIST_FAILED')}throw error}
