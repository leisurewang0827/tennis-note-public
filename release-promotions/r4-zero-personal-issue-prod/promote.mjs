import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {appendFileSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {patchProductionWrangler} from "../../scripts/r4_internal_registration_prod_promotion.mjs";

// Bind only after the separate committed production OFF read has passed.
const bind = {"source":"2eeae46e2818bd0156654ab4812e6bdfa9afe462","run":42747801159,"artifact":13732216652,"artifactHash":"3dd227bf7254987652253ebc9ea082936a53ee824c820be658c9e8f6a38ca9b6","sealHash":"dd2661614bc2519ff105fe2070387d6e60252c4ec2773e5897c4ff9dac308f31","projectHash":"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a","installHash":"bbffe514d3d88829cd59b53113053c36771f08551e5f7d8efb6ea17c73b6f1be","offHash":"02d21812c0fc0dffbecd159a0452b1f4bc399427a6cb7573cc0c9c466df04a0a","rpcDefinition":"0f0a01a01bad74943390904afd08e22fc6403c5cd453f6caba424a1c1bb31db2","receiptHash":"7cf2fd829cfa6380b37ab98df5979b9381b21d8b9174fc1fd3111f6405d3160d","defaultOff":true,"effectiveGrants":0,"issued":0,"requests":0,"recovery":"3da3b356-f9a5-4473-9dbb-e0da2e4e864c","protectedTables":3,"protectedTriggers":3,"receipt":{"status":"COMMITTED_PROD_ZERO_PERSONAL_OFF_PASS","source":"2eeae46e2818bd0156654ab4812e6bdfa9afe462","run":42747801159,"artifact":13732216652,"artifactHash":"3dd227bf7254987652253ebc9ea082936a53ee824c820be658c9e8f6a38ca9b6","sealHash":"dd2661614bc2519ff105fe2070387d6e60252c4ec2773e5897c4ff9dac308f31","projectHash":"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a","installHash":"bbffe514d3d88829cd59b53113053c36771f08551e5f7d8efb6ea17c73b6f1be","offHash":"02d21812c0fc0dffbecd159a0452b1f4bc399427a6cb7573cc0c9c466df04a0a","priorId":"3da3b356-f9a5-4473-9dbb-e0da2e4e864c","priorPublicBytesVerified":true,"existingRowsCountPreserved":true,"verifiedAt":"2026-11-10T03:13:36.934Z","actual":{"effective_grants":0,"exact_binding":1,"off":true,"protected_tables":3,"protected_triggers":3,"receipts":0,"requests":0,"rpc_acl":true,"rpc_body":"b7f966aee00a63b00467ef9d7f409779ec6898895a2cea046ea7007b7f319d8e","rpc_definition":"0f0a01a01bad74943390904afd08e22fc6403c5cd453f6caba424a1c1bb31db2"}}};
const repo="leisurewang0827/tennis-note-public", project="tennisnote-admin", branch="main";
const origin="https://tennisnote-admin.pages.dev";
const previous={
  id:"3da3b356-f9a5-4473-9dbb-e0da2e4e864c",
  source:"caafa15aa8a05dbf6c54812316cff6c909b8ff1b",
  url:"https://3da3b356.tennisnote-admin.pages.dev",
  seal:"3bb0fdd4aab43768fcf33207540edf2aebdc25533817d34dbd2c2bf7f1289ec5",
  run:42732459784,artifact:13725347078,artifactHash:"75ea630c84d0984e4d0fe72ed653d8bf99db6609cb1b60adfbdf35ddac35010b",
};
const paths=[".github/workflows/r4-zero-personal-issue-prod-promotion.yml","release-promotions/r4-zero-personal-issue-prod/promote.mjs"];
const sha=x=>createHash("sha256").update(x).digest("hex");
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",maxBuffer:4*1024*1024}).trimEnd();
const h=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const stablePaths=["index.html","views/members.js","r4-scoped-member-catalog.js","shared/config.local.js","release.json"];
const publishedPaths=[...stablePaths,"r4-zero-personal-issue.js"];

function evidence(){
  assert.ok(bind,"NO_COMMITTED_OFF_PROOF");
  for(const k of ["artifactHash","sealHash","projectHash","installHash","offHash","rpcDefinition","receiptHash"])assert.match(bind[k],h);
  assert.equal(bind.projectHash,"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a");
  assert.equal(bind.offHash,"02d21812c0fc0dffbecd159a0452b1f4bc399427a6cb7573cc0c9c466df04a0a");
  assert.match(bind.source,/^[a-f0-9]{40}$/);
  for(const k of ["run","artifact"])assert.ok(Number.isSafeInteger(bind[k])&&bind[k]>0);
  assert.equal(bind.defaultOff,true);
  assert.equal(bind.effectiveGrants,0);
  assert.equal(bind.issued,0);
  assert.equal(bind.requests,0);
  assert.equal(bind.recovery,previous.id);
  assert.equal(bind.protectedTables,3);
  assert.equal(bind.protectedTriggers,3);
  const proof=bind.receipt;
  assert.equal(sha(JSON.stringify(proof)),bind.receiptHash);
  assert.equal(proof.status,"COMMITTED_PROD_ZERO_PERSONAL_OFF_PASS");
  for(const k of ["source","run","artifact","artifactHash","sealHash","projectHash","installHash","offHash"]){
    assert.equal(proof[k],bind[k]);
  }
  assert.equal(proof.priorId,previous.id);
  assert.equal(proof.priorPublicBytesVerified,true);assert.equal(proof.existingRowsCountPreserved,true);
  assert.equal(proof.actual.off,true);assert.equal(proof.actual.effective_grants,0);
  assert.equal(proof.actual.receipts,0);assert.equal(proof.actual.requests,0);
  assert.equal(proof.actual.exact_binding,1);assert.equal(proof.actual.rpc_acl,true);
  assert.equal(proof.actual.protected_tables,3);assert.equal(proof.actual.protected_triggers,3);
  assert.equal(proof.actual.rpc_definition,bind.rpcDefinition);
  const age=Date.now()-Date.parse(proof.verifiedAt);
  assert.ok(age>=-60000&&age<7200000,"COMMITTED_OFF_PROOF_STALE");
}
function scope(){
  evidence();
  const env=process.env;
  assert.equal(env.GITHUB_REPOSITORY,repo);
  assert.equal(env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(env.GITHUB_EVENT_NAME,"push");assert.equal(env.GITHUB_RUN_ATTEMPT,"1");
  assert.equal(git("rev-parse","HEAD"),env.GITHUB_SHA);
  assert.equal(git("rev-list","--parents","-n","1",env.GITHUB_SHA),env.GITHUB_SHA+" "+bind.source);
  assert.deepEqual(git("diff","--name-only",bind.source,env.GITHUB_SHA).split("\n").sort(),[...paths].sort());
  for(const [file,hash] of [["install-off.sql",bind.installHash],["off.sql",bind.offHash]]){
    assert.equal(sha(execFileSync("git",["show",bind.source+":release-sources/r4-zero-personal-issue-prod/"+file])),hash);
  }
}
function walk(dir,prefix=""){
  const out={};
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const path=prefix+e.name;
    assert.ok(e.isDirectory()||e.isFile());
    if(e.isDirectory())Object.assign(out,walk(join(dir,e.name),path+"/"));
    else out[path]=sha(readFileSync(join(dir,e.name)));
  }
  return out;
}
function seals(){
  const prior=readFileSync("prod-base/seal.json"), bytes=readFileSync("prod-candidate/seal.json");
  assert.equal(sha(prior),previous.seal);assert.equal(sha(bytes),bind.sealHash);
  const old=JSON.parse(prior),next=JSON.parse(bytes);
  assert.equal(old.source,previous.source);
  assert.equal(next.kind,"R4_ZERO_PERSONAL_ISSUE_PROD_PREP_ONLY");assert.equal(next.source,bind.source);
  assert.equal(next.recovery.deployment,previous.id);
  assert.equal(next.sql.installOff,bind.installHash);assert.equal(next.sql.off,bind.offHash);
  assert.equal(Object.keys(old.admin).length,175);assert.equal(Object.keys(next.admin).length,176);
  assert.deepEqual(walk("prod-base/admin"),old.admin);assert.deepEqual(walk("prod-candidate/admin"),next.admin);
  assert.deepEqual(Object.keys(next.delta).sort(),["index.html","r4-zero-personal-issue.js","views/members.js"]);
  assert.deepEqual(next.admin,{...old.admin,...next.delta});
  return {old,next};
}
function credentials(){
  const {CLOUDFLARE_ACCOUNT_ID:account,R4_ADMIN_CLOUDFLARE_API_TOKEN:cfToken,GH_TOKEN:ghToken,
    EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT:pin}=process.env;
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.equal(sha(account),pin);assert.ok(cfToken&&ghToken);
  return {cf:"https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects/"+project,cfToken,
    gh:"https://api.github.com/repos/"+repo,ghToken};
}
async function get(url,token){
  const r=await fetch(url,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),
    headers:token?{Authorization:"Bearer "+token,Accept:"application/json"}:{}});
  assert.equal(r.status,200,"READBACK_HTTP_FAILED");
  return r;
}
const asJson=async(url,token)=>(await get(url,token)).json();
async function canonical(c){
  const p=await asJson(c.cf,c.cfToken);
  assert.equal(p.success,true);assert.equal(p.result?.name,project);assert.equal(p.result?.production_branch,branch);
  return p.result.canonical_deployment;
}
function deployment(d,id,source){
  assert.match(id,uuid);assert.equal(d?.id,id);
  assert.equal(d.latest_stage?.status,"success");
  assert.equal(d.environment,"production");
  assert.equal(d.deployment_trigger?.metadata?.branch,branch);
  assert.equal(d.deployment_trigger?.metadata?.commit_hash,source);
}
async function verifyArtifact(c,id,run,hash){
  const a=await asJson(c.gh+"/actions/artifacts/"+id,c.ghToken);
  assert.equal(a.id,id);assert.equal(a.workflow_run?.id,run);assert.equal(a.digest,"sha256:"+hash);
  assert.equal(a.expired,false);assert.ok(Date.parse(a.expires_at)>Date.now());
}
async function verifyRecovery(c){
  const a=await asJson(c.cf+"/deployments/"+previous.id,c.cfToken);
  assert.equal(a.success,true);deployment(a.result,previous.id,previous.source);assert.equal(a.result.url,previous.url);
}
async function match(host,hashes,paths,versions={}){
  const targets=paths.map(file=>[file,file==="index.html"?"/":"/"+file]);
  for(const [file,v] of Object.entries(versions)){
    assert.match(v,/^[a-f0-9.]{6,24}$/);
    targets.push([file,"/"+file+"?v="+v]);
  }
  const compared=await Promise.all(targets.map(async ([file,url])=>{
    const r=await get(host+url);
    return sha(Buffer.from(await r.arrayBuffer()))===hashes[file];
  }));
  return compared.every(Boolean);
}
function nextVersions(next){
  const versions=Object.fromEntries(["views/members.js","r4-zero-personal-issue.js"].map(n=>[n,next.admin[n].slice(0,16)]));
  const html=readFileSync("prod-candidate/admin/index.html","utf8");
  for(const [n,v] of Object.entries(versions))assert.equal(html.split('src="./'+n+'?v='+v+'"').length,2);
  return versions;
}
async function admit(){
  const c=credentials(),s=seals();
  const meta=await asJson(c.gh+"/actions/runs/"+bind.run,c.ghToken);
  assert.equal(meta.head_sha,bind.source);assert.equal(meta.conclusion,"success");assert.equal(meta.run_attempt,1);
  assert.equal(meta.path,".github/workflows/r4-zero-personal-issue-prod-candidate.yml");
  await Promise.all([verifyArtifact(c,bind.artifact,bind.run,bind.artifactHash),
    verifyArtifact(c,previous.artifact,previous.run,previous.artifactHash),verifyRecovery(c)]);
  deployment(await canonical(c),previous.id,previous.source);
  const oldVersions={"views/members.js":"1.0.566","r4-scoped-member-catalog.js":s.old.admin["r4-scoped-member-catalog.js"].slice(0,16)};
  const [live,fixed]=await Promise.all([match(origin,s.old.admin,stablePaths,oldVersions),match(previous.url,s.old.admin,stablePaths,oldVersions)]);
  assert.ok(live&&fixed,"BASELINE_BYTES_DRIFT");
  deployment(await canonical(c),previous.id,previous.source);
  console.log("ZERO_PERSONAL_ADMIN_ADMISSION_PASS: candidate, committed OFF, canonical and immutable recovery");
}
async function post(){
  const c=credentials(),s=seals();
  const versions=nextVersions(s.next);
  await verifyRecovery(c);
  assert.equal(await match(previous.url,s.old.admin,stablePaths),true,"RECOVERY_BYTES_DRIFT");
  const now=await canonical(c),id=now?.id;
  deployment(now,id,bind.source);assert.notEqual(id,previous.id);
  const fixed="https://"+id.slice(0,8)+"."+project+".pages.dev";
  assert.equal(fixed,process.env.PUBLISHED_URL,"PUBLISH_OUTCOME_UNCERTAIN");
  assert.equal(await match(fixed,s.next.admin,publishedPaths,versions),true,"IMMUTABLE_BYTES_MISMATCH");
  let live=false;
  for(let i=0;i<5&&!live;i++){
    if(i)await new Promise(r=>setTimeout(r,4000));
    deployment(await canonical(c),id,bind.source);
    live=await match(origin,s.next.admin,publishedPaths,versions);
  }
  assert.ok(live,"ALIAS_BYTES_UNCERTAIN_NO_RETRY");
  deployment(await canonical(c),id,bind.source);
  console.log(JSON.stringify({status:"ZERO_PERSONAL_ADMIN_PROD_PUBLISHED",source:bind.source,deployment:id,recovery:previous.id}));
}
try{
  const mode=process.argv[2];
  assert.ok(["source","transport","admit","post"].includes(mode));
  scope();
  if(mode==="source")appendFileSync(process.env.GITHUB_OUTPUT,"source="+bind.source+"\nrun="+bind.run+"\n");
  if(mode==="transport"){
    const dir=join(process.env.RUNNER_TEMP,"r4-wrangler","node_modules","wrangler");
    assert.equal(JSON.parse(readFileSync(join(dir,"package.json"))).version,"3.90.0");
    const asset=join(dir,"wrangler-dist");
    writeFileSync(join(asset,"cli-r4-single.cjs"),patchProductionWrangler(readFileSync(join(asset,"cli.js"))),{flag:"wx"});
  }
  if(mode==="admit")await admit();
  if(mode==="post")await post();
}catch(e){
  const msg=e?.message||"";
  console.log("ZERO_PERSONAL_PROD_HOLD_NO_RETRY "+(/^[A-Z0-9_]+$/.test(msg)?msg:"PINNED_CONDITION_NOT_MET"));
  process.exitCode=1;
}
