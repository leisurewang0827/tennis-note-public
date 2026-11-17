// Public-safe Pages step. No DB credential, SQL or direct DB network path.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build as baselineBuilder } from "../admin-excel-complete/compose.mjs";
import { expected, assertSource } from "../../release-promotions/r4-branch-finance-admin/protected-finance-admission.mjs";
import { pins } from "./sequence.mjs";
import { bindPages } from "./pages-port.mjs";
import { acceptOfficialReview, workflowPath } from "./manual-approval.mjs";

const dir=dirname(fileURLToPath(import.meta.url));
const prefix="release-sources/admin-legacy-absence-manual/";
const branch="codex/tennisnote-r4-ui-finish-dev-20261108";
const baseParent="260798328d4b8a340323ef79c27710e373098f7e";
const failedCheckCommit="84e1f2fb7051d9e94e664e8d71533ae1e8deac75";
const failedWorkdirCommit="11dc7bb0892980509d420d621f189d7c23ef4a00";
const authRejectedCommit="30b2cb7b18119be4cab76fcedefa42fbca6daddb";
const diagnosticCommit="467ebc3c2e27ca77c8dbbd4f63c856417a80c600";
const excelCommit="f42cfca6cf22bcdbc82bd3ff8b08711ea806a34e";
const orderRejectedCommit="3d448ca70a712c720b963876faf89f684a93c303";
const excelReadbackCommit="9d6ab5a2e62362a5c1393c194e92f637b9441fd3";
const excelPrefix="release-sources/admin-excel-complete/";
const diagnosticWorkflow=".github/workflows/admin-legacy-absence-cloudflare-diagnostic.yml";
const artifactFolder="r4-branch-finance-admin-source-43391633723";
const pinFiles=["bundle.json","payload.json","pages-port.mjs","sequence.mjs","manual-approval.mjs","entry.mjs","intent.json"].map(x=>prefix+x);
const sha=b=>createHash("sha256").update(b).digest("hex");
const git=(...a)=>execFileSync("git",a,{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
const read=name=>readFileSync(join(dir,name));
const env=process.env;
const bundle=read("bundle.json");
assert.equal(sha(bundle),pins.digest);
const manifest=JSON.parse(bundle);
const intent=JSON.parse(read("intent.json"));
const currentHead=git("rev-parse","HEAD");
const ref="refs/heads/"+branch;
const originalFiles=[workflowPath,...pinFiles].sort();
const validUuid=x=>typeof x==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const validCommit=x=>typeof x==="string"&&/^[a-f0-9]{40}$/.test(x);
function assertReleaseLineage(releaseCommit) {
  assert.ok(validCommit(releaseCommit));
  assert.equal(git("rev-list","--parents","-n","1",failedCheckCommit),failedCheckCommit+" "+baseParent);
  assert.deepEqual(git("diff-tree","--no-commit-id","--name-status","-r",baseParent,failedCheckCommit).split("\n").sort(),
    originalFiles.map(x=>"A\t"+x).sort());
  assert.equal(git("rev-list","--parents","-n","1",failedWorkdirCommit),failedWorkdirCommit+" "+failedCheckCommit);
  assert.equal(git("diff-tree","--no-commit-id","--name-status","-r",failedCheckCommit,failedWorkdirCommit),"M\t"+prefix+"entry.mjs");
  assert.ok(![failedCheckCommit,failedWorkdirCommit,authRejectedCommit,diagnosticCommit,excelCommit,orderRejectedCommit,excelReadbackCommit].includes(releaseCommit),"NON_RELEASE_PREDECESSOR");
  const delta=(old,current)=>git("diff-tree","--no-commit-id","--name-status","-r",old,current).split("\n").sort();
  const parentIs=(commit,parent)=>assert.equal(git("rev-list","--parents","-n","1",commit),commit+" "+parent);
  parentIs(authRejectedCommit,failedWorkdirCommit);
  assert.deepEqual(delta(failedWorkdirCommit,authRejectedCommit),[workflowPath,prefix+"entry.mjs"].sort().map(x=>"M\t"+x));
  parentIs(diagnosticCommit,authRejectedCommit);
  assert.deepEqual(delta(authRejectedCommit,diagnosticCommit),["A\t"+diagnosticWorkflow]);
  parentIs(excelCommit,diagnosticCommit);
  assert.deepEqual(delta(diagnosticCommit,excelCommit),[".github/workflows/admin-excel-complete.yml",
    ...["check.mjs","compose.mjs","payload.json","publish.mjs","seal.json"].map(n=>excelPrefix+n)].sort().map(x=>"A\t"+x));
  parentIs(orderRejectedCommit,excelCommit);
  assert.deepEqual(delta(excelCommit,orderRejectedCommit),[workflowPath,
    ...["entry.mjs","bundle.json","payload.json","intent.json","sequence.mjs","pages-port.mjs"].map(n=>prefix+n)].sort().map(x=>"M\t"+x));
  parentIs(excelReadbackCommit,orderRejectedCommit);
  assert.deepEqual(delta(orderRejectedCommit,excelReadbackCommit),[".github/workflows/admin-excel-readback.yml",
    "release-sources/admin-excel-readback/readback.mjs","release-sources/admin-excel-readback/readback.test.mjs"].sort().map(x=>"A\t"+x));
  parentIs(releaseCommit,excelReadbackCommit);
  assert.deepEqual(delta(excelReadbackCommit,releaseCommit),[workflowPath,
    ...["entry.mjs","intent.json","pages-port.mjs"].map(n=>prefix+n)].sort().map(x=>"M\t"+x));
}
assert.equal(env.GITHUB_ACTIONS,"true");assert.equal(env.GITHUB_REPOSITORY,pins.repository);
assert.equal(env.GITHUB_REF,ref);assert.equal(env.GITHUB_EVENT_NAME,"push");assert.equal(env.GITHUB_RUN_ATTEMPT,"1");
assert.equal(env.GITHUB_WORKFLOW_REF,`${pins.repository}/${workflowPath}@${ref}`);assert.equal(env.GITHUB_SHA,currentHead);
assert.ok(validUuid(intent.operation));
const changed=git("diff-tree","--no-commit-id","--name-status","-r","HEAD^","HEAD").split("\n").sort();
if(intent.intent==="release"){
  assert.deepEqual(Object.keys(intent).sort(),["intent","operation"]);
  assertReleaseLineage(currentHead);
}else{
  assert.equal(intent.intent,"recover");
  assert.deepEqual(Object.keys(intent).sort(),["intent","operation","publishedId","publishedOperation","releaseCommit"]);
  assert.ok(validUuid(intent.publishedId)&&intent.publishedId!==pins.recovery&&validUuid(intent.publishedOperation)&&intent.operation!==intent.publishedOperation&&validCommit(intent.releaseCommit));
  assert.deepEqual(changed,["M\t"+prefix+"intent.json"]);
  assert.equal(git("rev-list","--parents","-n","1",currentHead),currentHead+" "+intent.releaseCommit);
  assertReleaseLineage(intent.releaseCommit);
  assert.deepEqual(JSON.parse(git("show",intent.releaseCommit+":"+prefix+"intent.json")),{intent:"release",operation:intent.publishedOperation});
}
assert.ok(env.GH_TOKEN);
const api="https://api.github.com/repos/"+pins.repository;
const get=async path=>{
  const r=await fetch(api+path,{method:"GET",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),
    headers:{Authorization:"Bearer "+env.GH_TOKEN,Accept:"application/vnd.github+json"}});
  if(r.status!==200)throw Error("GITHUB_READ_FAILED");
  return r.json();
};
const [ci,artifact]=await Promise.all([get("/actions/runs/"+expected.run),get("/actions/artifacts/"+expected.artifact)]);
assertSource(ci,artifact);
const work=join(env.RUNNER_TEMP,"tn-absence-manual-"+randomUUID());
mkdirSync(work);
const tree=join(work,"admin-web");
const existing=baselineBuilder(join(env.RUNNER_TEMP,"tn-absence-baseline",artifactFolder),join(work,"baseline"));
assert.deepEqual(existing.hashes,manifest.recovery);
const payload=JSON.parse(read("payload.json"));
assert.deepEqual(Object.keys(payload).sort(),["index.html","schedule-v2-admin.js"]);
const candidate={...existing.files};
for(const name of Object.keys(payload))candidate[name]=Buffer.from(payload[name],"base64");
const hashes=Object.fromEntries(Object.entries(candidate).map(([name,b])=>[name,sha(b)]));
assert.deepEqual(hashes,manifest.administrator);
for(const [name,b] of Object.entries(candidate)) {
  const file=join(tree,name);
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,b,{flag:"wx"});
}
if(process.argv[2]==="check"){
  assert.ok(env.GITHUB_OUTPUT);
  // This job exposes only the frozen enum; no secret values or input SQL.
  const { appendFileSync }=await import("node:fs");appendFileSync(env.GITHUB_OUTPUT,"intent="+intent.intent+"\n");
  console.log("ADMIN_MANUAL_BUNDLE_CHECKED_NO_WRITE");
}else{
  assert.equal(process.argv[2],"protected");
  assert.equal(env.GITHUB_JOB,"operate");
  const run=Number(env.GITHUB_RUN_ID);
  const path="/actions/runs/"+run;
  const jobs=(await get(path+"/attempts/1/jobs?per_page=100")).jobs;
  const active=jobs.filter(j=>j.name==="legacy-absence-manual-"+intent.intent&&j.status==="in_progress");
  assert.equal(active.length,1);
  const plan={intent:intent.intent,operation:intent.operation,workflowCommit:currentHead,
    releaseCommit:intent.releaseCommit??currentHead,run,job:active[0].id,
    ...(intent.intent==="recover"?{publishedId:intent.publishedId,publishedOperation:intent.publishedOperation}:{})};
  const readReview=async()=>{
    const [run,jobs,approvals,environment,head,history]=await Promise.all([get(path),get(path+"/attempts/1/jobs?per_page=100"),
      get(path+"/approvals"),get("/environments/"+pins.environment),get("/git/ref/heads/"+branch),
      get("/actions/runs?event=push&per_page=100&head_sha="+currentHead)]);
    return acceptOfficialReview(plan,{run,jobs:jobs.total_count<=100?jobs.jobs:null,approvals,environment,head,
      history:history.total_count<=100?history.workflow_runs:null});
  };
  const first=await readReview();
  assert.ok(first,"PROTECTED_REVIEW_OR_COMMITTED_OFF_ATTESTATION_MISSING");
  const authorization=async()=>!!await readReview();
  const state=async()=>await readReview()?{state:"installed",catalogExact:true,readOnly:true,separateConnection:true,
    target:pins.fingerprint,sql:manifest.database.readback,gate:"OFF",effective:0,stored:0}:null;
  // Exact push/attempt/job + official reviewer allow only this invocation. A branch re-push or rerun is not a retry path.
  let dispatched=false;
  const once=async()=>{if(dispatched)return false;dispatched=true;return true;};
  const pages=bindPages({bundle,adminRoot:tree,account:env.CLOUDFLARE_ACCOUNT_ID,
    accountFingerprint:env.TN_CLOUDFLARE_ACCOUNT_SHA,token:env.CLOUDFLARE_API_TOKEN,
    cli:join(env.RUNNER_TEMP,"tn-absence-wrangler/node_modules/wrangler/wrangler-dist/cli-tn-fixed.cjs"),
    authorization,admitWrite:once,read:state});
  // After dispatch never send it again; an unknown acknowledgement can be inspected as a separate read.
  if(intent.intent==="release"){
    const before=await pages.readAdmin(plan,"preinstall");
    assert.ok(before?.canonicalId===pins.recovery&&before.canonicalBytes===true,"PAGES_RECOVERY_BASE_MOVED");
    let acknowledgement=false;
    try{
      acknowledgement=(await pages.publishAdminOnly(plan,{files:hashes})).confirmed===true;
      if(!acknowledgement)console.warn("PAGES_PUBLISH_CLIENT_UNCONFIRMED_NO_RETRY");
    }catch(e){
      const codes=["PAGES_CANDIDATE_DRIFT","PAGES_ARTIFACT_DRIFT","PAGES_WRITE_DENIED","PAGES_PUBLISH_PRECONDITION"];
      console.warn(codes.includes(e?.message)?e.message:"PAGES_PUBLISH_CALL_UNCONFIRMED_NO_RETRY");
    }
    const after=await pages.readAdmin(plan,"postpublish");
    assert.ok(after?.releaseCommit===plan.releaseCommit&&after?.publishedOperation===plan.operation&&
      after.canonicalBytes===true&&after.immutableBytes===true,"PAGES_PUBLISH_STATE_UNKNOWN_NO_RETRY");
    console.log(JSON.stringify({status:"ADMIN_ASSETS_VERIFIED_DB_OFF_ATTESTED",deploymentId:after.canonicalId,
      providerAcknowledgement:acknowledgement?"CONFIRMED":"UNKNOWN_NO_RETRY",dbWrites:0}));
  }else{
    const before=await pages.readAdmin(plan,"prerecovery");
    assert.ok(before?.canonicalId===plan.publishedId&&before?.publishedOperation===plan.publishedOperation,"WRONG_ROLLBACK_SOURCE");
    let acknowledgement=false;
    try{acknowledgement=(await pages.rollbackAdminOnly(plan,{from:plan.publishedId,to:pins.recovery})).confirmed===true;}catch{}
    const after=await pages.readAdmin(plan,"postrollback");
    assert.ok(after?.canonicalId===pins.recovery&&after.canonicalBytes===true&&after.immutableBytes===true,
      "PAGES_ROLLBACK_STATE_UNKNOWN_NO_RETRY");
    console.log(JSON.stringify({status:"ADMIN_RECOVERY_VERIFIED_DB_OFF_ATTESTED",deploymentId:after.canonicalId,
      providerAcknowledgement:acknowledgement?"CONFIRMED":"UNKNOWN_NO_RETRY",dbWrites:0}));
  }
}
