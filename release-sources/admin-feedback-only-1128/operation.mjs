import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {verify} from './check.mjs';
import {hash} from './compose.mjs';
const e=process.env,mode=process.argv[2],base='5acf24073c25240738b187a8ffffd28f70edf392',prior='641de955-956b-4930-81bb-830f769a82d2';
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-ui-finish-dev-20261108',wf='.github/workflows/admin-feedback-only-1128.yml';
const expected=[wf,...['detail.js','compose.mjs','check.mjs','operation.mjs'].map(p=>'release-sources/admin-feedback-only-1128/'+p)].sort();
assert(['verify','publish'].includes(mode));assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);
assert.equal(e.GITHUB_REF,'refs/heads/'+branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
assert.equal(e.GITHUB_WORKFLOW_REF,repo+'/'+wf+'@refs/heads/'+branch);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const isolated='cd12a935786dca7f1633c1c0c19e5eba6cfecbdc';
const sealed='6a103d8cf261ef537d24fa484bee9b7106316b07';
assert.equal(git('rev-list','--parents','-n','1','HEAD'),e.GITHUB_SHA+' '+sealed);
assert.equal(git('rev-list','--parents','-n','1',sealed),sealed+' '+isolated);
assert.deepEqual(git('diff-tree','-r','--no-commit-id','--name-status',sealed,'HEAD').split('\n').sort(),[wf,'release-sources/admin-feedback-only-1128/operation.mjs'].sort().map(p=>'M\t'+p));
assert.equal(git('rev-list','--parents','-n','1',isolated),isolated+' '+base);
assert.deepEqual(git('diff-tree','-r','--no-commit-id','--name-status',isolated,'HEAD').split('\n').sort(),[wf,'release-sources/admin-feedback-only-1128/compose.mjs','release-sources/admin-feedback-only-1128/operation.mjs'].sort().map(p=>'M\t'+p));
assert.deepEqual(git('diff-tree','-r','--no-commit-id','--name-status',base,'HEAD').split('\n').sort(),expected.map(p=>'A\t'+p));
const get=async(url,token)=>{const r=await fetch(url,{redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'read-only API status '+r.status);return r.json()};
const api='https://api.github.com/repos/'+repo, gh=p=>get(api+p,e.GH_TOKEN);
const ref=async()=>assert.equal((await gh('/git/ref/heads/'+branch)).object.sha,e.GITHUB_SHA,'branch moved');
await ref();
const run=await gh('/actions/runs/45117904109'),artifact=await gh('/actions/artifacts/14792327405');
assert.equal(run.head_sha,base);assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,45117904109);assert.equal(artifact.workflow_run.head_sha,base);
assert.equal(artifact.name,'r4-finance-admin-prod-admin-45117904109');assert.equal(artifact.digest,'sha256:728fcb57f80be60664a4e1b655b0dda75d6edd4e85e0e4fef2d31967c8700ad1');
const out=join(e.RUNNER_TEMP,'feedback-only-site'),{previous,next,data}=verify(join(e.RUNNER_TEMP,'prior-site'),out);
const origin='https://tennisnote-admin.pages.dev',fixed=id=>'https://'+id.slice(0,8)+'.tennisnote-admin.pages.dev';
async function routes(files,id,full){
  const paths=full?Object.keys(files).filter(p=>!['_headers','_redirects','_worker.js'].includes(p)):['index.html','shared/tennisnote-comment-draft.js'];
  let count=0;
  for(const host of [origin,fixed(id)]){
    let i=0;await Promise.all(Array.from({length:6},async()=>{while(i<paths.length){
      const p=paths[i++], route=p.endsWith('index.html')?p.slice(0,-10):p.replace(/\.html$/,'');
      const r=await fetch(host+'/'+route,{credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(p.startsWith('tennis-note-member-app/assets/')){assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://tennisnote-app.pages.dev/')}
      else{assert.equal(r.status,200,'GET '+p);assert.equal(hash(Buffer.from(await r.arrayBuffer())),files[p],'public bytes '+p)}
      count++;
    }}));
  }assert.equal(count,paths.length*2);return count;
}
if(mode==='verify'){
  const count=await routes(previous,prior,false);console.log(JSON.stringify({verified:184,preserved:182,baselineReads:count,dbCalls:0}));process.exit(0);
}
const reviews=await gh('/actions/runs/'+e.GITHUB_RUN_ID+'/approvals');assert.equal(reviews.length,1);
const a=reviews[0];assert.equal(a.state,'approved');assert.equal(a.user.id,294703475);assert.deepEqual(a.environments.map(x=>x.id),[26219323796]);
assert.equal(a.comment,'ADMIN FEEDBACK ONLY '+e.GITHUB_SHA+' two assets no DB or send');
assert.match(e.CLOUDFLARE_ACCOUNT_ID||'',/^[a-f0-9]{32}$/);assert.equal(hash(e.CLOUDFLARE_ACCOUNT_ID),e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
const apiCF='https://api.cloudflare.com/client/v4/accounts/'+e.CLOUDFLARE_ACCOUNT_ID+'/pages/projects/tennisnote-admin';
const cf=async(p='')=>{const r=await get(apiCF+p,e.CLOUDFLARE_API_TOKEN);assert.equal(r.success,true);return r.result};
const project=async()=>{const p=await cf();assert.equal(p.name,'tennisnote-admin');assert.equal(p.production_branch,'main');return p.canonical_deployment};
function deployment(d,id,sha){assert.equal(d.id,id);assert.equal(d.environment,'production');assert.equal(d.latest_stage.status,'success');assert.equal(d.deployment_trigger.metadata.branch,'main');assert.equal(d.deployment_trigger.metadata.commit_hash,sha)}
const quiet=async()=>{const ds=await cf('/deployments?page=1');assert(ds.length>0);assert(ds.every(d=>['success','failure','canceled'].includes(d.latest_stage?.status)),'publication busy')};
deployment(await project(),prior,base);deployment(await cf('/deployments/'+prior),prior,base);await quiet();await routes(previous,prior,true);
const helper=resolve('scripts/r4_internal_registration_prod_promotion.mjs');assert.equal(hash(readFileSync(helper)),'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4');
const {patchProductionWrangler}=await import(pathToFileURL(helper));
const wr=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler'), bytes=readFileSync(join(wr,'wrangler-dist/cli.js'));assert.equal(JSON.parse(readFileSync(join(wr,'package.json'))).version,'3.90.0');
assert.equal(hash(bytes),'ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e');
const patched=patchProductionWrangler(bytes);assert.equal(hash(patched),'e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4');
const anchor='if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");';assert.equal(patched.split(anchor).length,2);
const cli=join(wr,'wrangler-dist/feedback-only.cjs');writeFileSync(cli,patched.replace(anchor,'if(init2.body?.get("branch")!=="main"||init2.body?.get("commit_hash")!==process.env.EXACT_WEB_SHA)throw Error("WRONG_ADMIN_BODY");\n'+anchor),{flag:'wx'});
await ref();await quiet();deployment(await project(),prior,base);
await new Promise(done=>{const child=spawn(process.execPath,[cli,'pages','deploy',out,'--project-name=tennisnote-admin','--branch=main','--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],{shell:false,stdio:'ignore',env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:e.CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:e.CLOUDFLARE_API_TOKEN,EXACT_WEB_SHA:e.GITHUB_SHA}});
  const t=setTimeout(()=>child.kill(),120000);const end=()=>{clearTimeout(t);done()};child.once('error',end);child.once('close',end)});
let current;
for(let i=0;i<10;i++){const d=await project();if(d.deployment_trigger.metadata.commit_hash===e.GITHUB_SHA&&d.latest_stage.status==='success'){assert.match(d.id,/^[a-f0-9-]{36}$/);assert.notEqual(d.id,prior);deployment(d,d.id,e.GITHUB_SHA);current=d.id;break}
  deployment(d,prior,base);if(i<9)await new Promise(r=>setTimeout(r,2000));}
assert(current,'publish outcome unknown; do not retry');console.log('Candidate deployment '+current+' prior '+prior);
const observations=await routes(next,current,true);deployment(await project(),current,e.GITHUB_SHA);
console.log(JSON.stringify({published:current,recovery:prior,source:e.GITHUB_SHA,changed:2,readbacks:observations,siteFiles:Object.keys(data).length,dbCalls:0}));
