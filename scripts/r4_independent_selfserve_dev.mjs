// Exact DEV-admin-only publish plan. No DB credentials, activation or rollback writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=x=>createHash('sha256').update(x).digest('hex'),read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const parent='43488db4dfef1ea8515b0f401c39a9bc5f771c4a',source='ecdbdac4a7a9ca8821eea85eb0a78d66809a52ba';
const sourceRun=42805153957, artifactId=13757264546;
const prior='dde79900-4c3f-4471-9dfa-7ef4fd9d61d4',site='https://tennisnote-admin-dev.pages.dev';
const prefix='release-sources/r4-independent-selfserve-dev/';
const allow=['.github/workflows/r4-independent-selfserve-dev.yml','scripts/r4_independent_selfserve_dev.mjs',
  ...['install-off.sql','close-dev.sql','independent-selfserve.js','off-receipt.json'].map(x=>prefix+x)].sort();
const targetFingerprint='63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba';
const install='7075b26d33f003ce715b6b079fa53dac5b7c1d635b5cc81163552e6b345c3159';
const close='1e4d5162dd7a7a62d24b91ef5006c5618eec6d04d87f93c15fe403f79c512f1c';
const moduleSha='dabcb492d1010b52b8ef344c5082b21261d6e2fbb2a095f09a471e0d96195191';
const baseSeal='42c9a5a7c54cd5033edd5e0623d669eb4d1739b995802be3c46cbe873e34333d';
const digest='1272658b5a72962e789b11babcde9a5e5aa28f8104ee154f72ccff6622f34c98';
const localSeal='c819ac761f0197d972b28d85c362b57bbebe623b5f665cf744a3967e5b1bb0f7';
const cfg='shared/config.local.js',mod='r4-independent-selfserve-dev.js';
const assertEq=(a,b,label)=>{if(a!==b)throw Error(label);};
function scope(){
  assertEq(process.env.GITHUB_REPOSITORY,repo,'REPO');assertEq(process.env.GITHUB_REF,'refs/heads/'+branch,'BRANCH');
  assertEq(process.env.GITHUB_EVENT_NAME,'push','EVENT');assertEq(process.env.GITHUB_RUN_ATTEMPT,'1','ATTEMPT');
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  assertEq(git('rev-parse','HEAD'),process.env.GITHUB_SHA,'HEAD');
  assertEq(git('rev-list','--parents','-n','1','HEAD'),process.env.GITHUB_SHA+' '+parent,'PARENT');
  assert.deepEqual(git('diff','--name-only',parent,'HEAD').split('\n').sort(),allow);
  assertEq(hash(read('scripts/r4_internal_registration_dev.mjs')),'6a01f04e7fdb73d917943d0c98b0560dd13d7bbf49ffd947cf14c7e5135e3677','TRANSPORT');
  assertEq(hash(read(prefix+'install-off.sql')),install,'SQL');assertEq(hash(read(prefix+'close-dev.sql')),close,'CLOSE');
  assertEq(hash(read(prefix+'independent-selfserve.js')),moduleSha,'MODULE');
  const receipt=json(prefix+'off-receipt.json');
  assertEq(receipt.kind,'DEV_INDEPENDENT_SELF_SERVE_OFF_COMMITTED','RECEIPT_KIND');
  assert.ok(Number.isFinite(Date.parse(receipt.recordedAt)),'RECEIPT_DATE');
  assertEq(receipt.targetFingerprint,targetFingerprint,'RECEIPT_TARGET');assertEq(receipt.installSha,install,'RECEIPT_SQL');
  assertEq(receipt.localSealSha,localSeal,'RECEIPT_SEAL');assertEq(receipt.recoveryId,prior,'RECEIPT_RECOVERY');
  assert.deepEqual(receipt.actual,{createOff:true,lessonsOff:true,accessCount:0,lessonCount:0,operationCount:0,rpcAcl:true,privateTables:true});
  return receipt;
}
function tree(d,prefix=''){
  return readdirSync(d,{withFileTypes:true}).flatMap(e=>{assert.ok(e.isFile()||e.isDirectory());const p=prefix+e.name;
    return e.isDirectory()?tree(join(d,e.name),p+'/'):[p];});
}
export function assemble(basePath='base',candidateRoot=prefix){
  const baseAdmin=join(basePath,'admin'),seal=read(join(basePath,'seal.json')),baseline=JSON.parse(seal);assertEq(hash(seal),baseSeal,'BASE_SEAL');assertEq(baseline.source,source,'BASE_SOURCE');
  const files=tree(baseAdmin).sort();assert.deepEqual(files,Object.keys(baseline.admin).sort());
  const bytes=Object.fromEntries(files.map(p=>{const b=read(join(baseAdmin,p));assertEq(hash(b),baseline.admin[p],'BASE_BYTES');return [p,b];}));
  const m=read(join(candidateRoot,'independent-selfserve.js')),v=hash(m).slice(0,16);
  assertEq(hash(m),moduleSha,'MODULE');
  const old='<script defer src="./r4-general-dev.js?v=d9343e6abda15331"></script>',html=bytes['index.html'].toString('utf8');
  assertEq(html.split(old).length,2,'MOUNT');assertEq(html.split('id="r4Onboarding"').length,2,'ANCHOR');assertEq(bytes[mod],undefined,'MODULE_EXISTS');
  bytes['index.html']=Buffer.from(html.replace(old,old+'\n<script defer src="./'+mod+'?v='+v+'"></script>'));bytes[mod]=m;
  const admin=Object.fromEntries(Object.entries(bytes).map(([p,b])=>[p,hash(b)]));
  assert.deepEqual(Object.keys(admin).filter(p=>admin[p]!==baseline.admin[p]).sort(),['index.html',mod]);
  const result=Buffer.from(JSON.stringify({kind:'LOCAL_DEV_ONLY_NOT_DEPLOYMENT_APPROVAL',baseSource:source,baseSealSha:baseSeal,installSha:install,closeSha:close,admin},null,2)+'\n');
  assertEq(hash(result),localSeal,'CANDIDATE_SEAL');return {bytes,baseline:baseline.admin,admin,result,v};
}
const get=async(url,token)=>{const r=await fetch(url,{method:'GET',headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});assertEq(r.status,200,'GET');return r;};
const getJson=async(url,token)=>(await get(url,token)).json();
const cfCred=()=>{const id=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(id||'',/^[a-f0-9]{32}$/);assert.ok(t);assertEq(hash(id),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT,'CF_ACCOUNT');
  return {url:`https://api.cloudflare.com/client/v4/accounts/${id}/pages/projects/tennisnote-admin-dev`,t};};
function deployment(d,id,sha){assertEq(d.id,id,'DEPLOYMENT');assertEq(d.environment,'production','PAGES_ENV');assertEq(d.latest_stage?.status,'success','STAGE');
  assertEq(d.deployment_trigger?.metadata?.branch,'dev','PAGES_BRANCH');assertEq(d.deployment_trigger?.metadata?.commit_hash,sha,'PAGES_COMMIT');}
async function current(c){const p=await getJson(c.url,c.t);assertEq(p.success,true,'CF');assertEq(p.result.name,'tennisnote-admin-dev','CF_PROJECT');
  assertEq(p.result.production_branch,'dev','CF_BRANCH');return p.result.canonical_deployment;}
async function served(origin,hashes,version){
  const selected=[['index.html','/'],[cfg,'/'+cfg],['release.json','/release.json'],['r4-general-dev.js','/r4-general-dev.js?v=d9343e6abda15331']];
  if(version)selected.push([mod,'/'+mod+'?v='+version]);
  for(const [p,u] of selected)assertEq(hash(Buffer.from(await (await get(origin+u)).arrayBuffer())),hashes[p],'SERVED_BYTES');
}
async function main(){
  const receipt=scope(),mode=process.argv[2],x=assemble();
  if(mode==='build'){
    for(const [p,b] of Object.entries(x.bytes)){const to=join('candidate/admin',p);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,b,{flag:'wx'});}
    writeFileSync('candidate/seal.json',x.result,{flag:'wx'});return;
  }
  if(mode==='prepare'){
    const {patchWrangler}=await import('./r4_internal_registration_dev.mjs');
    const dir=join(process.env.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assertEq(json(join(dir,'package.json')).version,'3.90.0','WRANGLER');
    writeFileSync(join(dir,'wrangler-dist/cli-r4-single.cjs'),patchWrangler(read(join(dir,'wrangler-dist/cli.js'))),{flag:'wx'});return;
  }
  const c=cfCred();
  if(mode==='admit'){
    assertEq(hash(read('candidate/seal.json')),localSeal,'BUILT_SEAL');
    assert.deepEqual(tree('candidate/admin').sort(),Object.keys(x.admin).sort());
    for(const [p,h] of Object.entries(x.admin))assertEq(hash(read(join('candidate/admin',p))),h,'BUILT_BYTES');
    assert.ok(process.env.GH_TOKEN);
    const a=await getJson('https://api.github.com/repos/'+repo+'/actions/artifacts/'+artifactId,process.env.GH_TOKEN);
    assertEq(a.expired,false,'ARTIFACT_EXPIRY');assertEq(a.digest,'sha256:'+digest,'ARTIFACT');assertEq(a.workflow_run?.id,sourceRun,'ARTIFACT_RUN');
    const d=await getJson(c.url+'/deployments/'+prior,c.t);assertEq(d.success,true,'RECOVERY');deployment(d.result,prior,source);
    deployment(await current(c),prior,source);await served(site,x.baseline);await served('https://dde79900.tennisnote-admin-dev.pages.dev',x.baseline);
    deployment(await current(c),prior,source);
    const age=Date.now()-Date.parse(receipt.recordedAt);
    assert.ok(Number.isFinite(age)&&age>=-30000&&age<=115*60*1000,'RECEIPT_FRESHNESS');
    console.log('DEV_ADMIN_ADMITTED');return;
  }
  assertEq(mode,'post','MODE');const d=await current(c);assert.match(d.id,/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.notEqual(d.id,prior);deployment(d,d.id,process.env.GITHUB_SHA);
  const imm='https://'+d.id.slice(0,8)+'.tennisnote-admin-dev.pages.dev';assertEq(process.env.PUBLISHED_URL,imm,'PUBLISHED_URL');
  await served(imm,x.admin,x.v);await served(site,x.admin,x.v);deployment(await current(c),d.id,process.env.GITHUB_SHA);
  console.log(JSON.stringify({status:'DEV_ADMIN_POSTCHECK_PASS',deployment:d.id,recovery:prior}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{console.error('DEV_ADMIN_HOLD_NO_RETRY');process.exitCode=1;});
}
