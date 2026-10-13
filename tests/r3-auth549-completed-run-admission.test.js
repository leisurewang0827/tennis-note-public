import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),outer=require("./helpers/r3-auth548-outer-port.cjs"),gate=require("../scripts/check_tennisnote_r3_auth548_provenance.cjs"),e=outer.contract.completedRunReuse;
const clone=x=>JSON.parse(JSON.stringify(x));
const run={...e,repository:{full_name:e.repository},status:"completed",conclusion:"success",updated_at:"synthetic-time",pull_requests:[{number:e.pr,head:{ref:e.head_branch,sha:e.head_sha,repo:{full_name:e.repository}},base:{ref:"dev",sha:e.base,repo:{full_name:e.repository}}}]};
const jobs={jobs:[{id:1,run_id:e.id,name:e.job,status:"completed",conclusion:"success",steps:e.steps.map(name=>({name,status:"completed",conclusion:"success"}))}]};
const commit={sha:e.checkout,tree:{sha:e.tree},parents:[{sha:e.base},{sha:e.head_sha}]},logProof={checkout:e.checkout,runtimeMarkers:true};
test("mutable completed-run association preserves immutable execution and independently binds current candidate",()=>{
  let checks=0;const check=f=>{f();checks++;},currentHead="c".repeat(40),currentTree="d".repeat(40),currentCheckout="e".repeat(40),updated=clone(run);
  updated.pull_requests[0].head={ref:e.head_branch,sha:currentHead,repo:{full_name:e.repository}};updated.pull_requests[0].base.repo={full_name:e.repository};
  const context={repository:e.repository,event:"pull_request",sha:currentCheckout,checkout:currentCheckout,headRepository:e.repository,baseRepository:e.repository,baseRef:"dev",baseSha:e.base,headRef:e.head_branch,headSha:currentHead,parent1:e.base,parent2:currentHead};
  const pr={number:e.pr,head:{repo:{full_name:e.repository},ref:e.head_branch,sha:currentHead},base:{repo:{full_name:e.repository},ref:"dev",sha:e.base},changed_files:52},log="git log -1 --format=%H\n"+e.checkout+"\n"+e.logMarkers.join("\n");
  check(()=>assert.equal(updated.pull_requests.some(p=>p.number===e.pr&&p.head.sha===e.head_sha&&p.base.sha===e.base),false));
  check(()=>gate.validateCompletedRun(e,updated,jobs,commit,gate.validateCheckoutLog(log,e)));check(()=>gate.validateCompletedRun(e,run,jobs,commit,logProof));
  check(()=>{const future=clone(updated);future.pull_requests[0].base.sha="f".repeat(40);gate.validateCompletedRun(e,future,jobs,commit,logProof);});
  check(()=>{const brief=clone(updated);for(const side of [brief.pull_requests[0].head,brief.pull_requests[0].base])side.repo={url:"https://api.github.com/repos/"+e.repository,name:e.repository.split("/")[1]};gate.validateCompletedRun(e,brief,jobs,commit,logProof);});
  check(()=>gate.validateContext(context));check(()=>gate.validateCurrentAssociation(context,pr,currentTree,currentTree));check(()=>gate.validateNewCallerShape(context,2));
  for(const patch of [{head_sha:currentHead},{head_sha:"f".repeat(40)},{id:1},{workflow_id:1},{path:"wrong"},{head_branch:"wrong"},{event:"push"},{run_attempt:2},{status:"in_progress"},{conclusion:"failure"},{repository:{full_name:"fork/repo"}},{repository:undefined},{pull_requests:[]},{pull_requests:undefined}])check(()=>assert.throws(()=>gate.validateCompletedRun(e,{...updated,...patch},jobs,commit,logProof)));
  for(const mutate of [r=>r.pull_requests[0].number=1,r=>r.pull_requests[0].base.sha="invalid",r=>delete r.pull_requests[0].base,r=>r.pull_requests[0].head.sha="invalid",r=>delete r.pull_requests[0].head,r=>r.pull_requests.push(clone(r.pull_requests[0])),r=>r.pull_requests.push({...clone(r.pull_requests[0]),number:1}),r=>r.pull_requests[0].head.repo.full_name="fork/repo",r=>r.pull_requests[0].base.repo.full_name="fork/repo",r=>delete r.pull_requests[0].head.repo,r=>delete r.pull_requests[0].base.repo,r=>r.pull_requests[0].head.repo={},r=>r.pull_requests[0].base.repo={},r=>r.pull_requests[0].head.ref="wrong",r=>r.pull_requests[0].base.ref="wrong",r=>delete r.pull_requests[0].base.ref,r=>delete r.pull_requests[0].head.ref,r=>r.pull_requests[0].head.repo.url="https://api.github.com/repos/fork/repo",r=>r.pull_requests[0].base.repo.name="wrong"]){check(()=>{const bad=clone(updated);mutate(bad);assert.throws(()=>gate.validateCompletedRun(e,bad,jobs,commit,logProof));});}
  for(const patch of [{sha:currentCheckout},{tree:{sha:currentTree}},{parents:[{sha:e.base},{sha:currentHead}]},{parents:[]}])check(()=>assert.throws(()=>gate.validateCompletedRun(e,updated,jobs,{...commit,...patch},logProof)));
  check(()=>assert.throws(()=>gate.validateCheckoutLog(log.replace(e.checkout,currentCheckout),e)));check(()=>assert.throws(()=>gate.validateCheckoutLog(log.replace(e.logMarkers[0],"missing-runtime"),e)));
  for(const patch of [{checkout:currentCheckout},{runtimeMarkers:false}])check(()=>assert.throws(()=>gate.validateCompletedRun(e,updated,jobs,commit,patch)));
  for(const mutate of [j=>j.jobs=[],j=>j.jobs.push(clone(j.jobs[0])),j=>j.jobs[0].name="wrong",j=>j.jobs[0].run_id=1,j=>j.jobs[0].conclusion="failure",j=>j.jobs[0].steps=[],j=>j.jobs[0].steps[0].conclusion="skipped"]){check(()=>{const bad=clone(jobs);mutate(bad);assert.throws(()=>gate.validateCompletedRun(e,updated,bad,commit,logProof));});}
  for(const mutate of [p=>p.number=1,p=>p.head.sha="f".repeat(40),p=>p.head.ref="wrong",p=>p.head.repo.full_name="fork/repo",p=>p.base.sha="f".repeat(40),p=>p.changed_files=53])check(()=>{const bad=clone(pr);mutate(bad);assert.throws(()=>gate.validateCurrentAssociation(context,bad,currentTree,currentTree));});
  check(()=>assert.throws(()=>gate.validateCurrentAssociation(context,pr,"f".repeat(40),currentTree)));
  console.log(JSON.stringify({mutableAssociationPublicChecks:checks,oldSuiteRuns:0,network:0,db:0,syntheticOnly:true}));
});
function baseline(file){
  assert(!file.includes("production_projection"));
  if(process.env.GITHUB_ACTIONS==="true"||!process.env.TENNISNOTE_REUSE_OFFLINE_BASE)return cp.execFileSync("git",["show",e.head_sha+":"+file],{cwd:outer.root,encoding:"utf8",maxBuffer:16e6}).replace(/\r\n/g,"\n");
  // 로컬 출력 후보의 읽기 어댑터다. CI에서 이 변수로 baseline을 바꾸지 못한다.
  return fs.readFileSync(path.join(process.env.TENNISNOTE_REUSE_OFFLINE_BASE,file),"utf8").replace(/\r\n/g,"\n");
}
const current=file=>fs.readFileSync(path.join(outer.root,file),"utf8").replace(/\r\n/g,"\n");
function impactTexts(){return{oldContractRaw:baseline("tests/fixtures/r3-after-auth548-outer-parity.json"),currentContractRaw:current("tests/fixtures/r3-after-auth548-outer-parity.json"),oldHelper:baseline("tests/helpers/r3-auth548-outer-port.cjs"),currentHelper:current("tests/helpers/r3-auth548-outer-port.cjs"),oldCi:baseline(".github/workflows/tennisnote-public-ci.yml"),currentCi:current(".github/workflows/tennisnote-public-ci.yml"),oldProvenance:baseline("scripts/check_tennisnote_r3_auth548_provenance.cjs"),currentProvenance:current("scripts/check_tennisnote_r3_auth548_provenance.cjs")};}
test("new shared guard derives from private authority; old public12 is NOT reused after transitive input changes",()=>{
  assert.equal(gate.sharedCompletedGuardHash(),e.sharedGuardSha256);assert.equal(e.oldWholeSuiteReusable,false);
  const texts=impactTexts(),impact=gate.validatePublicInputImpact(JSON.parse(texts.oldContractRaw),outer.contract,texts);
  assert.equal(impact.oldSuiteReusable,false);assert.equal(impact.changedInputValidationRequired,true);assert.equal(impact.productAndGoldenDelta,0);assert.equal(impact.changedInputPaths.length,3);
  for(const patch of [{authPins:[]},{roleDelta:{}},{runtimeAdmission:{}},{candidateRelease:{version:"old"}}])assert.throws(()=>gate.validatePublicInputImpact(JSON.parse(texts.oldContractRaw),{...outer.contract,...patch},texts));
  for(const field of ["currentHelper","currentProvenance","currentCi"]){const bad={...texts,[field]:texts[field]+"\n"};if(field==="currentProvenance")bad[field]=texts[field].replace('function validateRuntimeReceipt(raw,expectedHash,now=Date.now()){','function validateRuntimeReceipt(raw,expectedHash,now=Date.now()){return true;');assert.throws(()=>gate.validatePublicInputImpact(JSON.parse(texts.oldContractRaw),outer.contract,bad));}
});
test("completed run binds immutable repository/workflow/head/event/attempt/job/steps/checkout and denies incomplete or substituted proof",()=>{
  assert(gate.validateCompletedRun(e,run,jobs,commit,logProof));
  for(const patch of [{id:1},{workflow_id:1},{path:"wrong"},{head_sha:"wrong"},{head_branch:"wrong"},{event:"push"},{run_attempt:2},{status:"in_progress"},{conclusion:"cancelled"},{repository:{full_name:"fork/repo"}},{pull_requests:[]}])assert.throws(()=>gate.validateCompletedRun(e,{...run,...patch},jobs,commit,logProof));
  for(const patch of [{sha:"wrong"},{tree:{sha:"wrong"}},{parents:[]}])assert.throws(()=>gate.validateCompletedRun(e,run,jobs,{...commit,...patch},logProof));
  for(const patch of [{checkout:"wrong"},{runtimeMarkers:false}])assert.throws(()=>gate.validateCompletedRun(e,run,jobs,commit,patch));
  assert.throws(()=>gate.validateCompletedRun(e,run,{jobs:[]},commit,logProof));assert.throws(()=>gate.validateCompletedRun(e,run,{jobs:[...jobs.jobs,...jobs.jobs]},commit,logProof));
  for(const status of ["skipped","failure","cancelled"]){const j=clone(jobs);j.jobs[0].steps[0].conclusion=status;assert.throws(()=>gate.validateCompletedRun(e,run,j,commit,logProof));}
  assert.throws(()=>gate.validateCompletedRun({...e,id:1},{...run,id:1},jobs,commit,logProof));assert.throws(()=>gate.validateCompletedRun({...e,head_sha:"wrong"},{...run,head_sha:"wrong"},jobs,commit,logProof));
});
test("exact infrastructure envelope is not proof that old transitive test inputs are unchanged",()=>{
  assert(gate.validateInfrastructureDelta(e,{baselineTree:e.tree,changedPaths:e.deltaPaths}));
  for(const patch of [{baselineTree:"wrong",changedPaths:e.deltaPaths},{baselineTree:e.tree,changedPaths:[]},{baselineTree:e.tree,changedPaths:[...e.deltaPaths,"app/shared/extra.js"]}])assert.throws(()=>gate.validateInfrastructureDelta(e,patch));
  assert(gate.validateUnchangedInputs({entry:"same",fixture:"same"},{entry:"same",fixture:"same"}));
  assert.throws(()=>gate.validateUnchangedInputs({entry:"same",fixture:"old"},{entry:"same",fixture:"new"}));
  assert.throws(()=>gate.validateUnchangedInputs({entry:"same"},{entry:"same",extra:"new"}));
  assert.throws(()=>gate.validateInfrastructureDelta({...e,deltaPaths:[...e.deltaPaths,"app/shared/extra.js"]},{baselineTree:e.tree,changedPaths:[...e.deltaPaths,"app/shared/extra.js"]}));
});
test("actual log proof returns only SHA/boolean and fails on unavailable or ambiguous checkout/runtime",()=>{
  const log="git log -1 --format=%H\n"+e.checkout+"\n"+e.logMarkers.join("\n"),r=gate.validateCheckoutLog(log,e);assert.deepEqual(Object.keys(r).sort(),["checkout","runtimeMarkers"]);
  for(const bad of ["",log.replace(e.checkout,"0".repeat(40)),log+"\ngit log -1 --format=%H",log.replace(e.logMarkers[0],"")])assert.throws(()=>gate.validateCheckoutLog(bad,e));
});
test("missing API permission/evidence never becomes an ordinary full-suite fallback",async()=>{
  let reads=0;await assert.rejects(()=>gate.obtainCompletedProof(e,async()=>{reads++;throw new Error("synthetic-denied")}),/synthetic-denied/);assert.equal(reads,1);
  assert.equal(typeof gate.completedApi("synthetic/repo",[e.id],[e.checkout]),"function");
});
test("new pull and squash dev contexts remain independently bound; wrong base/association/target cannot borrow old success",()=>{
  const p={repository:gate.REPOSITORY,event:"pull_request",sha:"synthetic-merge",checkout:"synthetic-merge",headRepository:gate.REPOSITORY,baseRepository:gate.REPOSITORY,baseRef:"dev",baseSha:gate.BASE,headRef:gate.BRANCH,headSha:"synthetic-head",parent1:gate.BASE,parent2:"synthetic-head"};assert(gate.validateContext(p));
  for(const delta of [{repository:"wrong/repo"},{headRepository:"fork/repo"},{baseRef:"main"},{baseSha:"wrong"},{headRef:"wrong"},{parent1:"wrong"},{parent2:"wrong"},{checkout:"wrong"},{event:"workflow_dispatch"}])assert.throws(()=>gate.validateContext({...p,...delta}));
  const s={repository:gate.REPOSITORY,event:"push",ref:"refs/heads/dev",sha:"synthetic-merge",checkout:"synthetic-merge",parent1:gate.BASE,merged:true,mergeCommit:"synthetic-merge",headRepository:gate.REPOSITORY,headRef:gate.BRANCH};assert(gate.validateContext(s));
  for(const delta of [{ref:"refs/heads/main"},{merged:false},{mergeCommit:"wrong"},{parent1:"wrong"}])assert.throws(()=>gate.validateContext({...s,...delta}));
  const actual={...p,sha:"a".repeat(40),checkout:"a".repeat(40),headSha:"b".repeat(40),parent2:"b".repeat(40)};assert(gate.validateNewCallerShape(actual,2));assert.throws(()=>gate.validateNewCallerShape(actual,1));assert(gate.validateNewCallerShape({...actual,event:"push"},1));assert.throws(()=>gate.validateNewCallerShape({...actual,event:"push"},2));assert.throws(()=>gate.validateNewCallerShape(p,2));
  const pr={number:206,head:{repo:{full_name:gate.REPOSITORY},ref:gate.BRANCH,sha:actual.headSha},base:{repo:{full_name:gate.REPOSITORY},ref:"dev",sha:gate.BASE},changed_files:52};assert(gate.validateCurrentAssociation(actual,pr,e.tree,e.tree));assert.throws(()=>gate.validateCurrentAssociation(actual,{...pr,changed_files:51},e.tree,e.tree));assert.throws(()=>gate.validateCurrentAssociation(actual,pr,"0".repeat(40),e.tree));assert.throws(()=>gate.validateCurrentAssociation({...actual,event:"push"},pr,e.tree,e.tree));assert(gate.validateCurrentAssociation({...actual,event:"push"},{...pr,merged_at:"synthetic",merge_commit_sha:actual.sha},e.tree,e.tree));assert.throws(()=>gate.validateCurrentAssociation(actual,{...pr,changed_files:undefined},e.tree,e.tree));assert.throws(()=>gate.validateCurrentAssociation(actual,{...pr,number:1},e.tree,e.tree));
});
test("changed loader/provenance input gets a new fresh receipt guard result, not the old public12 PASS",()=>{
  const c=outer.contract.runtimeAdmission,now=Date.parse("2026-01-01T00:10:00Z"),r={contract:c.contract,environment:"development",projectFingerprint:"63350140ffe5",privatePolicy:c.privatePolicy,authSourceSha256:c.authSourceSha256,releaseId:outer.contract.candidateRelease.releaseId,readOnly:true,schemaReady:true,roleGrantsVerified:true,rolloutOff:true,migrations:c.migrations,observedAt:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:20:00Z"};
  const verify=x=>{const raw=JSON.stringify(x);return gate.validateRuntimeReceipt(raw,outer.sha(raw),now)};assert(verify(r));
  for(const delta of [{environment:"production"},{projectFingerprint:"wrong"},{privatePolicy:"wrong"},{authSourceSha256:"wrong"},{releaseId:"old"},{readOnly:false},{schemaReady:false},{roleGrantsVerified:false},{rolloutOff:false},{migrations:[]},{expiresAt:"2026-01-01T00:09:00Z"},{observedAt:"2026-01-01T00:11:00Z"},{expiresAt:"2026-01-01T01:00:00Z"},{rawIdentity:"forbidden"}])assert.throws(()=>verify({...r,...delta}));
  assert.throws(()=>gate.validateRuntimeReceipt("","",now));
});
test("ordinary verification and deploy needs/caller/sites/rollback remain; candidate old12 is replaced only by new changed-input guard",()=>{
  const ci=current(".github/workflows/tennisnote-public-ci.yml"),old=baseline(".github/workflows/tennisnote-public-ci.yml"),source=current("scripts/check_tennisnote_r3_auth548_provenance.cjs");
  for(const marker of ["steps.provenance.outputs.scoped != 'true'","./scripts/verify.sh","needs: build-and-check","uses: ./.github/workflows/deploy-cloudflare-pages-dev.yml"])assert.equal(ci.split(marker).length,old.split(marker).length);
  assert(ci.includes("steps.provenance.outputs.changed_inputs_required == 'true'"));assert(source.includes("await proveShallowDeployment()"));assert(source.includes("fixed_candidate_merge_association_missing"));
  assert.equal(outer.contract.runtimeAdmission.authSourceSha256,"11d9f7e40380e4c8ed059235dbdc42b6d57376d21f37550eb7e6070de750f59f");
  assert.deepEqual(outer.contract.runtimeAdmission.migrations.map(x=>x.version),["20261012001000","20261012002000"]);
});
test("P1 ordinary same-base push is full; an arriving fixed packet without association is HOLD independently of ancestry",()=>{
  const pins=[{path:"sealed-packet",sha256:"a".repeat(64)}],fixed={"sealed-packet":"a".repeat(64)},other={"sealed-packet":"b".repeat(64)};
  assert.equal(gate.classifyPushSourceArrival(pins,other,other,false),false);
  assert.equal(gate.classifyPushSourceArrival(pins,other,{},false),false);
  assert.equal(gate.classifyPushSourceArrival(pins,fixed,fixed,false),false);
  for(const parent of [other,{}])assert.throws(()=>gate.classifyPushSourceArrival(pins,fixed,parent,false),/fixed_candidate_merge_association_missing/);
  assert.equal(gate.classifyPushSourceArrival(pins,fixed,other,true),true);
  const source=current("scripts/check_tennisnote_r3_auth548_provenance.cjs");assert(source.includes("fixedPushSourceArrival(["));assert(!source.includes("payload.before===BASE"));
});
function shallowFixture(){
  const head="b".repeat(40),merged="c".repeat(40),tree="d".repeat(40),runId=9001;
  const env={GITHUB_REPOSITORY:gate.REPOSITORY,GITHUB_EVENT_NAME:"push",GITHUB_REF:"refs/heads/dev",GITHUB_SHA:merged,GITHUB_RUN_ID:String(runId),GITHUB_RUN_ATTEMPT:"1",TENNISNOTE_CALLER_WORKFLOW_REF:gate.REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@refs/heads/dev"};
  const gitCalls=[],git=(...args)=>{gitCalls.push(args.join(" "));if(args.join(" ")==="rev-parse HEAD")return merged;if(args.join(" ")==="rev-parse HEAD^{tree}")return tree;if(args.join(" ")==="diff --name-only HEAD")return "";throw new Error("shallow-history-unavailable");};
  const local=gate.readLocalDeploymentCheckout(env,git,p=>Buffer.from("synthetic:"+p));
  const rows=(old)=>e.deltaPaths.map((p,i)=>({path:p,type:"blob",mode:"100644",sha:old?String(i+1).repeat(40):local.blobs[p]}));
  const unchanged={path:"app/synthetic-unchanged.js",type:"blob",mode:"100644",sha:"e".repeat(40)};
  const bundle={run:{id:runId,repository:{full_name:gate.REPOSITORY},workflow_id:329932540,path:".github/workflows/tennisnote-public-ci.yml",event:"push",head_branch:"dev",head_sha:merged,run_attempt:1,status:"in_progress",conclusion:null},jobs:{total_count:1,jobs:[{id:1,run_id:runId,head_sha:merged,name:"build-and-check",status:"completed",conclusion:"success",steps:[{name:"Verify changed-input completed-run admission only",status:"completed",conclusion:"success"}]}]},associations:[{number:206,merged_at:"synthetic",merge_commit_sha:merged,head:{ref:gate.BRANCH}}],pr:{number:206,head:{repo:{full_name:gate.REPOSITORY},ref:gate.BRANCH,sha:head},base:{repo:{full_name:gate.REPOSITORY},ref:"dev",sha:gate.BASE},changed_files:52,merged_at:"synthetic",merge_commit_sha:merged},currentCommit:{sha:merged,tree:{sha:tree},parents:[{sha:gate.BASE}]},headCommit:{sha:head,tree:{sha:tree}},baselineCommit:{sha:e.head_sha,tree:{sha:e.tree}},baselineTree:{sha:e.tree,truncated:false,tree:[...rows(true),unchanged]},currentTree:{sha:tree,truncated:false,tree:[...rows(false),unchanged]}};
  const responses=new Map([["actions/runs/"+runId,bundle.run],["actions/runs/"+runId+"/attempts/1/jobs?per_page=100",bundle.jobs],["commits/"+merged+"/pulls",bundle.associations],["pulls/206",bundle.pr],["git/commits/"+merged,bundle.currentCommit],["git/commits/"+head,bundle.headCommit],["git/commits/"+e.head_sha,bundle.baselineCommit],["git/trees/"+e.tree+"?recursive=1",bundle.baselineTree],["git/trees/"+tree+"?recursive=1",bundle.currentTree]]);
  return{local,bundle,gitCalls,responses};
}
test("P1 depth-one local HEAD plus same-run/API immutable metadata admits without local parents, fetch, show or old history",async()=>{
  const f=shallowFixture(),reads=[];const result=await gate.obtainShallowDeploymentProof(f.local,async suffix=>{reads.push(suffix);assert(f.responses.has(suffix));return f.responses.get(suffix)});
  assert.deepEqual(f.gitCalls,["rev-parse HEAD","rev-parse HEAD^{tree}","diff --name-only HEAD"]);assert.equal(reads.length,9);assert.equal(result.shallowSafe,true);assert.equal(result.sourceDeltaPaths,5);assert.equal(result.oldWholePublicSuiteReusable,false);
  const source=current("scripts/check_tennisnote_r3_auth548_provenance.cjs"),deploy=source.slice(source.indexOf('if(mode==="--deploy")'),source.indexOf('assert.equal(mode,"--local")'));
  assert(!deploy.includes("routeCi()"));assert(deploy.includes("validateRuntimeReceipt("));assert(deploy.includes("await proveShallowDeployment()"));
});
test("P1 shallow deployment denies wrong/missing current step/source/PR/caller/old proof rather than trusting receipt",async()=>{
  const f=shallowFixture();let negatives=0;
  const deny=(mutate)=>{const b=clone(f.bundle),l=clone(f.local);mutate(b,l);assert.throws(()=>gate.validateShallowDeploymentBundle(l,b));negatives++;};
  for(const patch of [{id:9002},{repository:{full_name:"fork/repo"}},{workflow_id:1},{path:"wrong"},{event:"workflow_dispatch"},{head_branch:"main"},{head_sha:"f".repeat(40)},{run_attempt:2},{status:"queued"},{status:"completed",conclusion:"failure"}])deny(b=>Object.assign(b.run,patch));
  for(const patch of [{caller:"wrong"},{repository:"fork/repo"},{event:"pull_request"},{ref:"refs/heads/main"},{checkout:"f".repeat(40)},{attempt:2}])deny((b,l)=>Object.assign(l,patch));
  deny(b=>b.jobs.jobs=[]);deny(b=>b.jobs.jobs.push(clone(b.jobs.jobs[0])));deny(b=>b.jobs.jobs[0].head_sha="f".repeat(40));deny(b=>b.jobs.jobs[0].run_id=9002);
  for(const status of ["skipped","failure","cancelled"])deny(b=>b.jobs.jobs[0].steps[0].conclusion=status);
  deny(b=>b.jobs.jobs[0].steps=[]);deny(b=>b.associations=[]);deny(b=>b.pr.changed_files=51);deny(b=>b.pr.head.repo.full_name="fork/repo");deny(b=>b.pr.merge_commit_sha="f".repeat(40));deny(b=>b.currentCommit.parents[0].sha="f".repeat(40));deny(b=>b.headCommit.tree.sha="f".repeat(40));
  deny(b=>b.baselineCommit.tree.sha="f".repeat(40));deny(b=>b.currentTree.truncated=true);deny(b=>b.currentTree.tree.pop());deny((b,l)=>l.blobs[e.deltaPaths[0]]="f".repeat(40));
  await assert.rejects(()=>gate.obtainShallowDeploymentProof(f.local,async()=>{throw new Error("metadata-permission-denied")}),/metadata-permission-denied/);negatives++;
  assert(negatives>=30);console.log(JSON.stringify({newP1ShallowNegativeAssertions:negatives,realNetwork:0,db:0}));
});
test("P1 receipt is necessary but cannot replace current-run proof; stale/wrong environment/source receipt remains HOLD",()=>{
  const c=outer.contract.runtimeAdmission,now=Date.parse("2026-01-01T00:10:00Z"),receipt={contract:c.contract,environment:"development",projectFingerprint:"63350140ffe5",privatePolicy:c.privatePolicy,authSourceSha256:c.authSourceSha256,releaseId:outer.contract.candidateRelease.releaseId,readOnly:true,schemaReady:true,roleGrantsVerified:true,rolloutOff:true,migrations:c.migrations,observedAt:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:20:00Z"};
  const verify=x=>{const raw=JSON.stringify(x);return gate.validateRuntimeReceipt(raw,outer.sha(raw),now)};assert(verify(receipt));
  const f=shallowFixture();f.bundle.jobs.jobs[0].steps=[];assert.throws(()=>gate.validateShallowDeploymentBundle(f.local,f.bundle));
  for(const delta of [{expiresAt:"2026-01-01T00:09:00Z"},{environment:"production"},{projectFingerprint:"wrong"},{authSourceSha256:"wrong"}])assert.throws(()=>verify({...receipt,...delta}));
});
