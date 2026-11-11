// Sealed v2 CI and protected administrator-only deployment checks.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFileSync,copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const github='https://api.github.com/repos/'+repo;
const parent='63c929ebcb61a03482042252f684734758a4b095',baselineSource='7ba4e453e5e89540c0578db1dd76312c6f8d9442';
const baselineRun=42846945596,baselineArtifact=13777303858;
const baselineDigest='66eed766bd596422bbbd352641f1f1c7b67d2ab0bf8c4fee8e4a22a3ccadeeae';
const baselineSeal='44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b';
const baselinePath='2026-11-10-r4-general-dev/prod-independent-source-42846945596';
const recovery='d0841b4a-a92a-4a87-a5c1-ae40436fb2a3';
const fingerprint='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const seal='f454d23dbce8ca99895945950f4a80ee75a0f1f633a9419b2eb73fdf049daaaa';
const src='release-sources/r4-independent-prod-v2',artifactDir='r4-prod-v2-artifact';
const sourceWorkflow='.github/workflows/r4-independent-prod-v2-source.yml';
const promotionWorkflow='.github/workflows/r4-independent-prod-v2-promotion.yml';
const receiptPath='release-promotions/r4-independent-prod-v2/off-receipt.json';
const transport='scripts/r4_internal_registration_prod_promotion.mjs';
const files=['candidate-seal.json','check-db.mjs','check-web.mjs','compose.mjs','designated-open.sql','disable.sql','independent-v2.js','install-off.sql','pilot-open.sql','postread.sql'];
const scopeFiles=[...files.map(p=>src+'/'+p),sourceWorkflow,promotionWorkflow,'scripts/r4_independent_prod_v2_release.mjs'].sort();
const origin='https://tennisnote-admin.pages.dev',recoveryUrl='https://d0841b4a.tennisnote-admin.pages.dev';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const hex64=/^[0-9a-f]{64}$/,hex40=/^[0-9a-f]{40}$/,uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const names=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
const parents=x=>git('rev-list','--parents','-n','1',x).split(' ');
const number=x=>Number.isSafeInteger(x)&&x>0;
const output=(k,v)=>appendFileSync(process.env.GITHUB_OUTPUT,k+'='+v+'\n');
function exactPaths(head,sourceCommit){
  assert.match(head,hex40);
  assert.match(sourceCommit,hex40);
  assert.deepEqual(parents(sourceCommit),[sourceCommit,parent]);
  assert.deepEqual(names(parent,sourceCommit),scopeFiles);
  if(head!==sourceCommit){
    assert.deepEqual(parents(head),[head,sourceCommit]);
    assert.deepEqual(names(sourceCommit,head),[receiptPath]);
  }
}
function ci(expectedWorkflow){
  const e=process.env;
  assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);
  assert.equal(e.GITHUB_REF,'refs/heads/'+branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(e.GITHUB_WORKFLOW_REF,repo+'/'+expectedWorkflow+'@refs/heads/'+branch);
  assert.match(e.GITHUB_SHA||'',hex40);assert.equal(git('rev-parse','HEAD'),e.GITHUB_SHA);
  return e.GITHUB_SHA;
}
function sealedInputs(){
  const bytes=read(src+'/candidate-seal.json');
  assert.equal(sha(bytes),seal);
  const m=JSON.parse(bytes);
  assert.equal(m.gitBase,parent);assert.equal(m.targetsBound,false);
  assert.equal(m.baseline.source,baselineSource);assert.equal(m.baseline.recovery,recovery);assert.equal(m.baseline.sealSha256,baselineSeal);
  assert.deepEqual([...Object.keys(m.inputs),'candidate-seal.json'].sort(),files);
  for(const [name,h] of Object.entries(m.inputs))assert.equal(sha(read(src+'/'+name)),h);
  return m;
}
async function build(){
  const m=sealedInputs();
  const mod=await import(pathToFileURL(resolve(src,'compose.mjs')));
  assert.equal(sha(Buffer.from(JSON.stringify(mod.manifest(),null,2)+'\n')),seal);
  const b=mod.assemble();
  assert.deepEqual(b.delta,['index.html','r4-independent-prod-v2.js']);
  assert.equal(Object.keys(b.after).length,179);
  assert.deepEqual(b.hashes,m.admin.sha256);
  return b;
}
const freshDir=()=>mkdtempSync(resolve('release-sources','.independent-v2-ci-'));
function once(text,from,to){
  assert.equal(text.split(from).length,2,'CI adapter drift');
  return text.replace(from,to);
}
export function adapt(db,web,temp,port){
  assert.ok(number(port)&&port<65536);
  const start=db.indexOf("const tools=join(tmpdir(),"),end=db.indexOf("const read=n=>",start);
  assert.ok(start>=0&&end>start);
  const pg=join(temp,'r4-v2-checks','package.json');
  let d=db.slice(0,start)+'const {Client}=createRequire('+JSON.stringify(pg)+")('pg');\n"+
    "const db=new Client({host:'127.0.0.1',port:"+port+",user:'postgres',password:'synthetic-ci-only',database:'postgres',statement_timeout:15000});\n"+db.slice(end);
  d=once(d,"{cwd:'C:/Codex/tennis-note-public-release-20260815',encoding:'utf8',windowsHide:true}","{cwd:process.cwd(),encoding:'utf8',windowsHide:true}");
  const bootStart=d.indexOf("  exec('initdb',"),bootEnd=d.indexOf("  await db.connect();",bootStart);
  assert.ok(bootStart>=0&&bootEnd>bootStart);d=d.slice(0,bootStart)+d.slice(bootEnd);
  d=once(d,"  if(started)exec('pg_ctl',['-D',dir,'-m','fast','-w','stop']);\n","");
  let w=once(web,"'file:///C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright/index.mjs'",
    JSON.stringify(pathToFileURL(join(temp,'r4-v2-checks','node_modules','playwright','index.mjs')).href));
  w=once(w,"{headless:true,executablePath:'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'}","{headless:true}");
  return {db:d,web:w};
}
function isolatedTests(){
  assert.equal(process.platform,'linux');
  const temp=process.env.RUNNER_TEMP,port=Number(process.env.R4_V2_SYNTHETIC_PORT);
  assert.ok(temp&&number(port));
  const dir=freshDir(),adapted=adapt(read(src+'/check-db.mjs').toString(),read(src+'/check-web.mjs').toString(),temp,port);
  for(const f of files)copyFileSync(src+'/'+f,join(dir,f));
  writeFileSync(join(dir,'ci-db.mjs'),adapted.db,{flag:'wx'});
  writeFileSync(join(dir,'ci-web.mjs'),adapted.web,{flag:'wx'});
  for(const f of ['ci-db.mjs','ci-web.mjs'])execFileSync(process.execPath,[join(dir,f)],{stdio:'inherit',timeout:180000});
}
function writeArtifact(b,head){
  for(const [p,data] of Object.entries(b.after)){
    const dest=join(artifactDir,'admin',p);
    mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,data,{flag:'wx'});
  }
  const manifest={kind:'INDEPENDENT_V2_SOURCE_CI',sourceCommit:head,candidateSeal:seal,admin:b.hashes};
  writeFileSync(join(artifactDir,'seal.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
}
function validateReceipt(head,age){
  sealedInputs();
  const r=json(receiptPath);
  assert.deepEqual(Object.keys(r).sort(),['actual','artifactDigest','candidateSeal','installSqlSha256','legacyBefore','postreadSqlSha256','projectFingerprint','recovery','sourceArtifact','sourceCommit','sourceRun','status','verifiedAt'].sort());
  assert.equal(r.status,'COMMITTED_R4_INDEPENDENT_V2_OFF_PASS');
  assert.equal(r.projectFingerprint,fingerprint);assert.equal(r.candidateSeal,seal);assert.equal(r.recovery,recovery);
  assert.equal(r.installSqlSha256,sha(read(src+'/install-off.sql')));
  assert.equal(r.postreadSqlSha256,sha(read(src+'/postread.sql')));
  assert.match(r.sourceCommit,hex40);assert.notEqual(r.sourceCommit,head);exactPaths(head,r.sourceCommit);
  assert.ok(number(r.sourceRun)&&number(r.sourceArtifact));assert.match(r.artifactDigest,hex64);
  assert.deepEqual(Object.keys(r.legacyBefore).sort(),['count','digest']);
  assert.equal(r.legacyBefore.count,1);assert.match(r.legacyBefore.digest,hex64);
  assert.deepEqual(r.actual,{prodTarget:true,mode:'off',epoch:0,effectivePilot:0,effectiveDesignated:0,
    unrevokedPilot:0,unrevokedDesignated:0,v2Lessons:0,v2Operations:0,legacyLessonCount:r.legacyBefore.count,
    legacyLessonDigest:r.legacyBefore.digest,surfaceOk:true});
  const elapsed=Date.now()-Date.parse(r.verifiedAt);
  assert.ok(Number.isFinite(elapsed)&&(!age||(elapsed>=-60000&&elapsed<7200000)),'OFF_RECEIPT_STALE');
  return r;
}
async function get(url,token){
  const res=await fetch(url,{method:'GET',headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(res.status,200,'READ_FAILED');
  return res;
}
async function obj(url,token){return (await get(url,token)).json();}
async function gh(path){
  const token=process.env.GH_TOKEN;assert.ok(token);
  return obj(github+path,token);
}
async function artifact(id,run,commit,digest,name){
  const a=await gh('/actions/artifacts/'+id);
  assert.equal(a.id,id);assert.equal(a.name,name);
  assert.equal(a.workflow_run?.id,run);assert.equal(a.workflow_run?.head_sha,commit);
  assert.equal(a.digest,'sha256:'+digest);assert.equal(a.expired,false);
  assert.ok(Date.parse(a.expires_at)>Date.now());
}
async function baseMeta(){await artifact(baselineArtifact,baselineRun,baselineSource,baselineDigest,'r4-independent-owner-prod-candidate-42846945596');}
async function sourceMeta(r){
  const run=await gh('/actions/runs/'+r.sourceRun);
  assert.equal(run.head_sha,r.sourceCommit);assert.equal(run.head_branch,branch);assert.equal(run.path,sourceWorkflow);
  assert.equal(run.event,'push');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
  await Promise.all([baseMeta(),artifact(r.sourceArtifact,r.sourceRun,r.sourceCommit,r.artifactDigest,'r4-independent-prod-v2-candidate-'+r.sourceRun)]);
}
function credentials(){
  const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.R4_ADMIN_CLOUDFLARE_API_TOKEN;
  assert.match(a||'',/^[a-f0-9]{32}$/);assert.ok(t);assert.equal(sha(a),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  return {token:t,url:'https://api.cloudflare.com/client/v4/accounts/'+a+'/pages/projects/tennisnote-admin'};
}
function deployment(d,id,commit){
  assert.equal(d?.id,id);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');
  assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,commit);
}
async function canonical(c){
  const p=await obj(c.url,c.token);assert.equal(p.success,true);
  assert.equal(p.result?.name,'tennisnote-admin');assert.equal(p.result?.production_branch,'main');return p.result.canonical_deployment;
}
async function recoveryRead(c){
  const p=await obj(c.url+'/deployments/'+recovery,c.token);
  assert.equal(p.success,true);deployment(p.result,recovery,baselineSource);assert.equal(p.result.url,recoveryUrl);
}
function assetTree(dir,prefix=''){
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    assert.ok(e.isFile()||e.isDirectory());
    const p=prefix+e.name;
    return e.isDirectory()?Object.entries(assetTree(join(dir,e.name),p+'/')):[[p,sha(read(join(dir,e.name)))]];
  }));
}
async function verifyArtifact(r){
  const b=await build();
  assert.deepEqual(json(artifactDir+'/seal.json'),{kind:'INDEPENDENT_V2_SOURCE_CI',sourceCommit:r.sourceCommit,candidateSeal:seal,admin:b.hashes});
  assert.deepEqual(assetTree(artifactDir+'/admin'),b.hashes);
  return b;
}
const common=['index.html','release.json','shared/config.local.js','r4-onboarding.js','r4-selfserve-client.js','pending-member-registration.js'];
function version(index,p){
  const parts=index.split('src="./'+p+'?v=');assert.equal(parts.length,2);
  const v=parts[1].split('"')[0];assert.match(v,/^[a-zA-Z0-9._-]{1,100}$/);return v;
}
async function served(host,hashes,index,feature){
  const checks=[...common,feature].map(p=>[p,p==='index.html'?'/':'/'+p]);
  for(const p of [...common.slice(3),feature])checks.push([p,'/'+p+'?v='+version(index,p)]);
  await Promise.all(checks.map(async ([name,path])=>assert.equal(
    sha(Buffer.from(await (await get(host+path)).arrayBuffer())),hashes[name],'SERVED_BYTES_MISMATCH')));
}
async function baseline(host){
  const bytes=read(baselinePath+'/seal.json');assert.equal(sha(bytes),baselineSeal);
  await served(host,JSON.parse(bytes).admin,read(baselinePath+'/admin/index.html').toString(),'r4-independent-owner.js');
}
async function main(){
  const mode=process.argv[2];
  if(mode==='source-meta'||mode==='source'){
    const head=ci(sourceWorkflow);exactPaths(head,head);sealedInputs();
    if(mode==='source-meta'){await baseMeta();console.log('V2_SOURCE_META_PASS');return;}
    const b=await build();isolatedTests();writeArtifact(b,head);console.log('V2_SOURCE_CI_PASS');return;
  }
  assert.ok(['promotion-meta','prepare','admit','publish-receipt','post'].includes(mode));
  const head=ci(promotionWorkflow),r=validateReceipt(head,mode!=='post'&&mode!=='publish-receipt');
  if(mode==='promotion-meta'){await sourceMeta(r);output('run',r.sourceRun);output('sha',r.sourceCommit);return;}
  if(mode==='prepare'){
    assert.equal(sha(read(transport)),'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4');
    const {patchProductionWrangler}=await import(pathToFileURL(resolve(transport)));
    const dir=join(process.env.RUNNER_TEMP,'r4-wrangler','node_modules','wrangler');
    assert.equal(json(join(dir,'package.json')).version,'3.90.0');
    writeFileSync(join(dir,'wrangler-dist','cli-r4-single.cjs'),patchProductionWrangler(read(join(dir,'wrangler-dist','cli.js'))),{flag:'wx'});return;
  }
  if(mode==='publish-receipt'){
    const log=read(join(process.env.RUNNER_TEMP,'r4-v2-admin-publish.log')).toString();
    const urls=[...new Set(log.match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin\.pages\.dev/g)||[])];
    assert.equal(urls.length,1,'PUBLISH_OUTCOME_UNKNOWN');output('url',urls[0]);return;
  }
  const c=credentials(),b=await verifyArtifact(r);
  await recoveryRead(c);
  if(mode==='admit'){
    await sourceMeta(r);
    deployment(await canonical(c),recovery,baselineSource);
    await Promise.all([baseline(origin),baseline(recoveryUrl)]);
    deployment(await canonical(c),recovery,baselineSource);
    validateReceipt(head,true);
    console.log('V2_ADMIN_ADMISSION_PASS');return;
  }
  const d=await canonical(c);
  assert.match(d?.id||'',uuid);assert.notEqual(d.id,recovery);deployment(d,d.id,r.sourceCommit);
  const fixed='https://'+d.id.slice(0,8)+'.tennisnote-admin.pages.dev';
  assert.equal(fixed,process.env.PUBLISHED_URL,'PUBLISH_OUTCOME_UNKNOWN');
  const index=b.after['index.html'].toString(),feature='r4-independent-prod-v2.js';
  assert.equal(version(index,feature),b.hashes[feature].slice(0,16));
  await Promise.all([served(fixed,b.hashes,index,feature),served(origin,b.hashes,index,feature),baseline(recoveryUrl)]);
  deployment(await canonical(c),d.id,r.sourceCommit);
  console.log(JSON.stringify({status:'V2_ADMIN_POSTCHECK_PASS',deployment:d.id,recovery,immutable:fixed}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    const safe=/^[A-Z_]{3,50}$/.test(e?.message||'')?e.message:'V2_RELEASE_HOLD';
    console.error(safe);process.exitCode=1;
  });
}
