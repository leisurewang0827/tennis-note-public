import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {appendFileSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {createHash} from "node:crypto";
import {patchProductionWrangler} from "../../scripts/r4_internal_registration_prod_promotion.mjs";

import {assemble} from "./compose-pending-member-registration.mjs";
let bind;
const repo="leisurewang0827/tennis-note-public", project="tennisnote-admin", branch="main";
const origin="https://tennisnote-admin.pages.dev";
const previous={"id":"af8eba1b-28f8-42e7-b0b8-f644213dcdd7","source":"2eeae46e2818bd0156654ab4812e6bdfa9afe462","url":"https://af8eba1b.tennisnote-admin.pages.dev","seal":"dd2661614bc2519ff105fe2070387d6e60252c4ec2773e5897c4ff9dac308f31","run":42747801159,"artifact":13732216652,"artifactHash":"3dd227bf7254987652253ebc9ea082936a53ee824c820be658c9e8f6a38ca9b6"};
const candidatePaths=["release-sources/r4-pending-member-registration/pending-member-registration-install-off.sql","release-sources/r4-pending-member-registration/pending-member-registration-open.sql","release-sources/r4-pending-member-registration/pending-member-registration-off.sql","release-sources/r4-pending-member-registration/pending-member-registration.js","release-sources/r4-pending-member-registration/compose-pending-member-registration.mjs","release-sources/r4-pending-member-registration/check-pending-member-db.mjs","release-sources/r4-pending-member-registration/check-pending-member-web.mjs","release-sources/r4-pending-member-registration/release.mjs",".github/workflows/r4-pending-member-registration-candidate.yml",".github/workflows/r4-pending-member-registration-promotion.yml"];
const candidateWorkflow=".github/workflows/r4-pending-member-registration-candidate.yml";
const promotionPath="release-sources/r4-pending-member-registration/promotion.json";
const baseCommit="c0e13d85a0b035305e69a3be0e7e66f6ccdd99a1";
const projectHash="3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a";
const modulePath="pending-member-registration.js";
const sqlNames={installOff:"pending-member-registration-install-off.sql",open:"pending-member-registration-open.sql",off:"pending-member-registration-off.sql"};
const rpcDefinition="ccf15461df5d824a6c6ba607eb61ba1ef571ead55356087e5591010084db97ce";
const sha=x=>createHash("sha256").update(x).digest("hex");
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",maxBuffer:4*1024*1024}).trimEnd();
const h=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const stablePaths=["index.html","views/members.js","r4-scoped-member-catalog.js","shared/config.local.js","release.json","r4-zero-personal-issue.js"];
const publishedPaths=[...stablePaths,modulePath];
const versionedBasePaths=["views/members.js","r4-scoped-member-catalog.js","r4-zero-personal-issue.js"];

function environment(){
  const e=process.env;
  assert.equal(e.GITHUB_REPOSITORY,repo);
  assert.equal(e.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(e.GITHUB_EVENT_NAME,"push");
  assert.equal(e.GITHUB_RUN_ATTEMPT,"1");
  assert.equal(git("rev-parse","HEAD"),e.GITHUB_SHA);
  return e.GITHUB_SHA;
}
function checkpoint(head,parent,paths){
  assert.equal(git("rev-list","--parents","-n","1",head),head+" "+parent);
  assert.deepEqual(git("diff","--name-only",parent,head).split("\n").sort(),[...paths].sort());
}
function sqlHashes(){
  return Object.fromEntries(Object.entries(sqlNames).map(([k,n])=>[k,sha(readFileSync(new URL("./"+n,import.meta.url)))]));
}
function evidence(){
  const head=environment();
  bind=JSON.parse(readFileSync(new URL("./promotion.json",import.meta.url)));
  assert.match(bind.source,/^[a-f0-9]{40}$/);
  for(const k of ["artifactHash","sealHash","receiptHash"])assert.match(bind[k],h);
  for(const k of ["run","artifact"])assert.ok(Number.isSafeInteger(bind[k])&&bind[k]>0);
  checkpoint(head,bind.source,[promotionPath]);
  const proof=bind.receipt;
  assert.equal(sha(JSON.stringify(proof)),bind.receiptHash);
  assert.equal(proof.status,"COMMITTED_PROD_PENDING_MEMBER_OFF_PASS");
  for(const k of ["source","run","artifact","artifactHash","sealHash"])assert.equal(proof[k],bind[k]);
  assert.equal(proof.projectHash,projectHash);
  assert.equal(proof.recovery,previous.id);
  assert.deepEqual(proof.sql,sqlHashes());
  assert.deepEqual(proof.actual,{pending_off:true,pending_receipts:0,standing_enabled:1,first_enabled:0,issue_receipts:1,issue_requests:1,rpc_acl:true,rpc_definition:rpcDefinition});
  const age=Date.now()-Date.parse(proof.verifiedAt);
  assert.ok(age>=-60000&&age<7200000,"COMMITTED_OFF_PROOF_STALE");
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

function candidate(){
  const source=environment();
  checkpoint(source,baseCommit,candidatePaths);
  const {output,version,hashes}=assemble("prod-base");
  assert.equal(Object.keys(hashes).length,177);
  assert.equal(sqlHashes().installOff,"fdf63f9696b620dc4b31b1fbb1b3f4ce8145fd1f3f2e490c9c149b0a74a03e11");
  assert.equal(hashes[modulePath],"d5bfafdd590034f9212d3a287c8e80ad77bbe99cdc89f84be35c99c799fe2338");
  for(const [file,bytes] of Object.entries(output)){
    const path=join("prod-candidate/admin",file);
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,bytes,{flag:"wx"});
  }
  const seal={kind:"R4_PENDING_MEMBER_PROD_PREP_ONLY",source,recovery:previous.id,sql:sqlHashes(),version,admin:hashes,
    delta:{"index.html":hashes["index.html"],[modulePath]:hashes[modulePath]}};
  const bytes=Buffer.from(JSON.stringify(seal,null,2)+"\n");
  writeFileSync("prod-candidate/seal.json",bytes,{flag:"wx"});
  console.log(JSON.stringify({status:"PENDING_MEMBER_ADMIN_SEALED",files:177,sealHash:sha(bytes),sql:seal.sql}));
}
function seals(){
  const prior=readFileSync("prod-base/seal.json"),bytes=readFileSync("prod-candidate/seal.json");
  assert.equal(sha(prior),previous.seal);assert.equal(sha(bytes),bind.sealHash);
  const old=JSON.parse(prior),next=JSON.parse(bytes);
  assert.equal(old.source,previous.source);
  assert.equal(next.kind,"R4_PENDING_MEMBER_PROD_PREP_ONLY");assert.equal(next.source,bind.source);
  assert.equal(next.recovery,previous.id);assert.deepEqual(next.sql,sqlHashes());
  assert.equal(Object.keys(old.admin).length,176);assert.equal(Object.keys(next.admin).length,177);
  assert.deepEqual(walk("prod-base/admin"),old.admin);assert.deepEqual(walk("prod-candidate/admin"),next.admin);
  assert.deepEqual(Object.keys(next.delta).sort(),["index.html",modulePath]);
  assert.deepEqual(next.admin,{...old.admin,...next.delta});
  assert.deepEqual(assemble("prod-base").hashes,next.admin);
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

function versions(seal,html,paths){
  const result={};
  for(const file of paths){
    const prefix='src="./'+file+'?v=';
    const parts=html.split(prefix);
    assert.equal(parts.length,2);
    const version=parts[1].split('"')[0];
    assert.equal(version,seal.admin[file].slice(0,16));
    result[file]=version;
  }
  return result;
}
async function checkBaseArtifact(token){
  assert.ok(token);
  const c={gh:"https://api.github.com/repos/"+repo,ghToken:token};
  const r=await asJson(c.gh+"/actions/runs/"+previous.run,token);
  assert.equal(r.head_sha,previous.source);assert.equal(r.conclusion,"success");assert.equal(r.run_attempt,1);
  assert.equal(r.path,".github/workflows/r4-zero-personal-issue-prod-candidate.yml");
  await verifyArtifact(c,previous.artifact,previous.run,previous.artifactHash);
}
async function admit(){
  const c=credentials(),s=seals();
  const meta=await asJson(c.gh+"/actions/runs/"+bind.run,c.ghToken);
  assert.equal(meta.head_sha,bind.source);assert.equal(meta.conclusion,"success");assert.equal(meta.run_attempt,1);
  assert.equal(meta.path,candidateWorkflow);
  await Promise.all([verifyArtifact(c,bind.artifact,bind.run,bind.artifactHash),
    verifyArtifact(c,previous.artifact,previous.run,previous.artifactHash),verifyRecovery(c)]);
  deployment(await canonical(c),previous.id,previous.source);
  const oldVersions=versions(s.old,readFileSync("prod-base/admin/index.html","utf8"),versionedBasePaths);
  const [live,fixed]=await Promise.all([match(origin,s.old.admin,stablePaths,oldVersions),match(previous.url,s.old.admin,stablePaths,oldVersions)]);
  assert.ok(live&&fixed,"BASELINE_BYTES_DRIFT");
  deployment(await canonical(c),previous.id,previous.source);
  console.log("PENDING_MEMBER_ADMIN_ADMISSION_PASS: candidate, committed OFF, canonical and immutable recovery");
}
async function post(){
  const c=credentials(),s=seals();
  const liveVersions=versions(s.next,readFileSync("prod-candidate/admin/index.html","utf8"),[...versionedBasePaths,modulePath]);
  await verifyRecovery(c);
  const recoveryVersions=versions(s.old,readFileSync("prod-base/admin/index.html","utf8"),versionedBasePaths);
  assert.equal(await match(previous.url,s.old.admin,stablePaths,recoveryVersions),true,"RECOVERY_BYTES_DRIFT");
  const now=await canonical(c),id=now?.id;
  deployment(now,id,bind.source);assert.notEqual(id,previous.id);
  const fixed="https://"+id.slice(0,8)+"."+project+".pages.dev";
  assert.equal(fixed,process.env.PUBLISHED_URL,"PUBLISH_OUTCOME_UNCERTAIN");
  assert.equal(await match(fixed,s.next.admin,publishedPaths,liveVersions),true,"IMMUTABLE_BYTES_MISMATCH");
  let live=false;
  for(let i=0;i<5&&!live;i++){
    if(i)await new Promise(r=>setTimeout(r,4000));
    deployment(await canonical(c),id,bind.source);
    live=await match(origin,s.next.admin,publishedPaths,liveVersions);
  }
  assert.ok(live,"ALIAS_BYTES_UNCERTAIN_NO_RETRY");
  deployment(await canonical(c),id,bind.source);
  console.log(JSON.stringify({status:"PENDING_MEMBER_ADMIN_PROD_PUBLISHED",source:bind.source,deployment:id,recovery:previous.id}));
}
try{
  const mode=process.argv[2];
  assert.ok(["candidate-source","candidate","source","transport","admit","post"].includes(mode));
  if(mode==="candidate-source"){checkpoint(environment(),baseCommit,candidatePaths);await checkBaseArtifact(process.env.GH_TOKEN);}
  else if(mode==="candidate")candidate();
  else evidence();
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
  console.log("PENDING_MEMBER_PROD_HOLD_NO_RETRY "+(/^[A-Z0-9_]+$/.test(msg)?msg:"PINNED_CONDITION_NOT_MET"));
  process.exitCode=1;
}
