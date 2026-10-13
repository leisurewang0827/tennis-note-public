"use strict";
// Read-only source/evidence admission. This foundational packet is intentionally not deployable.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const outer=require("../tests/helpers/r3-auth548-outer-port.cjs");
const REPOSITORY="leisurewang0827/tennis-note-public",BRANCH="codex/r3-after-auth548-local-20261013",BASE=outer.contract.publicParent;
function validateContext(c){
  assert.equal(c.repository,REPOSITORY,"repository_mismatch");assert.equal(c.checkout,c.sha,"checkout_mismatch");
  if(c.event==="pull_request"){
    assert.equal(c.headRepository,REPOSITORY,"fork_denied");assert.equal(c.baseRepository,REPOSITORY);
    assert.equal(c.baseRef,"dev","base_ref_mismatch");assert.equal(c.baseSha,BASE,"base_drift");
    assert.equal(c.headRef,BRANCH,"head_ref_mismatch");assert.equal(c.parent1,BASE);assert.equal(c.parent2,c.headSha);
  }else{
    assert.equal(c.event,"push","event_denied");assert.equal(c.ref,"refs/heads/dev","ref_denied");
    assert.equal(c.parent1,BASE,"parent_drift");assert.equal(c.merged,true,"direct_push_denied");
    assert.equal(c.mergeCommit,c.sha,"merge_receipt_mismatch");assert.equal(c.headRepository,REPOSITORY);assert.equal(c.headRef,BRANCH);
  }
  return true;
}
function validateEvidence(which,run){
  const expected=outer.contract.evidence[which];assert(expected&&!expected.sourceOnlyAttestation);
  assert.equal(run.conclusion,"success","evidence_unsuccessful");assert.equal(run.head_sha,expected.head,"evidence_head_mismatch");
  assert.equal(run.event,expected.event,"evidence_event_mismatch");assert.equal(run.repository?.full_name,REPOSITORY);
  assert.equal(Number(run.id),expected.run,"evidence_run_mismatch");assert.equal(run.head_branch,expected.branch,"evidence_branch_mismatch");
  if(which==="r3Public")assert(run.pull_requests?.some(p=>p.number===204&&p.head?.sha===expected.head&&p.base?.sha==="e794c18059ff3391af9a5494f6389cfa0de70c2b"),"evidence_pr_mismatch");
  return true;
}
function requirePublishable(){assert.equal(outer.contract.publishable,true,"foundation_requires_release_and_server_gate");}
function validateRuntimeReceipt(raw,expectedHash,now=Date.now()){
  assert(/^[a-f0-9]{64}$/.test(expectedHash||""),"runtime_receipt_approval_missing");
  assert.equal(outer.sha(raw),expectedHash,"runtime_receipt_hash_mismatch");
  const r=JSON.parse(raw),c=outer.contract.runtimeAdmission;
  assert.deepEqual(Object.keys(r).sort(),["contract","environment","projectFingerprint","privatePolicy","authSourceSha256","releaseId","readOnly","schemaReady","roleGrantsVerified","rolloutOff","migrations","observedAt","expiresAt"].sort(),"runtime_receipt_field_mismatch");
  assert.equal(r.contract,"r3-development-readonly-capability/1");
  assert.equal(r.environment,"development");assert.equal(r.projectFingerprint,"63350140ffe5");
  assert.equal(r.privatePolicy,c.privatePolicy);assert.equal(r.authSourceSha256,c.authSourceSha256);
  assert.equal(r.releaseId,outer.contract.candidateRelease.releaseId);
  assert.equal(r.readOnly,true);assert.equal(r.schemaReady,true);assert.equal(r.roleGrantsVerified,true);assert.equal(r.rolloutOff,true);
  assert.deepEqual(r.migrations,c.migrations);
  const observed=Date.parse(r.observedAt),expires=Date.parse(r.expiresAt);
  assert(Number.isFinite(observed)&&Number.isFinite(expires)&&observed<=now&&now<expires&&expires-observed<=30*60*1000,"runtime_receipt_stale");return true;
}
// BEGIN SHARED COMPLETED RUN GUARD
function fixedCompletedAuthority(expected){
  const privateRepo="leisurewang0827/app-automation-vault",publicRepo="leisurewang0827/tennis-note-public";
  const records={
    38394022243:[privateRepo,324140637,".github/workflows/tennisnote-ci.yml","5f0d3d6ea1d89da9dba6f328627b44c9ef2525d3","codex/r3-policy-after-auth548-20261013",596,"40bd1687af6f2ee800c8b0c5324cc01ec49f6e04","90c3795959daec9ce05734758326df83a0f29a7a","614279ba45499a370cd78bde7169d203bf869530","candidate-source-admission",["New editor and Auth context only"],["node: v22.","node scripts/check_tennisnote_auth_editor_context.cjs"]],
    38394022195:[privateRepo,368385432,".github/workflows/tennisnote-personal-journal-ui.yml","5f0d3d6ea1d89da9dba6f328627b44c9ef2525d3","codex/r3-policy-after-auth548-20261013",596,"40bd1687af6f2ee800c8b0c5324cc01ec49f6e04","90c3795959daec9ce05734758326df83a0f29a7a","614279ba45499a370cd78bde7169d203bf869530","journal-ui",["Install pinned Playwright and media runtimes","Offline journal validation, playback exits and resumable upload regression"],["node: v22.","playwright@1.56.1","node scripts/test_tennisnote_mp4_faststart.cjs","node scripts/check_tennisnote_personal_journal_browser.cjs"]],
    38394162701:[publicRepo,329932540,".github/workflows/tennisnote-public-ci.yml","fe03b6cb3c69b19571e3fe07ba65afae8a40a6e9","codex/r3-after-auth548-local-20261013",206,"582ebd00f31654233ecc77c1bf2efdd4fde0beec","2c507027fb58a8aaa4ef7862540519e5f7d322a1","9b4117b1740c0288821c89d22267ae0f39a361b2","build-and-check",["Select exact R3/Auth source checkpoint","Verify only newly composed source and context guards"],["node: v22.","node --test tests/r3-auth548-composition.test.js","python scripts/check_tennisnote_dev_prod_alignment.py"]]
  };
  const keys=["repository","workflow_id","path","head_sha","head_branch","pr","base","checkout","tree","job","steps","logMarkers"],record=records[expected.id];assert(record,"unknown_completed_authority");
  keys.forEach((key,i)=>assert.deepEqual(expected[key],record[i],"fixture_cannot_replace_authority:"+key));assert.equal(expected.event,"pull_request");assert.equal(expected.run_attempt,1);return true;
}
function fixedInfrastructurePaths(repository){
  if(repository==="leisurewang0827/app-automation-vault")return[".github/workflows/tennisnote-personal-journal-ui.yml",".github/workflows/tennisnote-ci.yml","scripts/check_tennisnote_r3_auth548_admission.cjs","scripts/fixtures/r3-auth548-private-admission.json","scripts/check_tennisnote_r3_completed_run_admission.cjs"];
  assert.equal(repository,"leisurewang0827/tennis-note-public");return[".github/workflows/tennisnote-public-ci.yml","scripts/check_tennisnote_r3_auth548_provenance.cjs","tests/fixtures/r3-after-auth548-outer-parity.json","tests/helpers/r3-auth548-outer-port.cjs","tests/r3-auth549-completed-run-admission.test.js"];
}
function validateNewCallerShape(context,parentCount){
  for(const field of ["sha","checkout","parent1"])assert(/^[a-f0-9]{40}$/.test(context[field]||""),"caller_sha_shape");
  if(context.event==="pull_request"){assert.equal(parentCount,2,"pr_parent_count");assert(/^[a-f0-9]{40}$/.test(context.headSha||""));assert(/^[a-f0-9]{40}$/.test(context.parent2||""));}
  else{assert.equal(context.event,"push");assert.equal(parentCount,1,"squash_one_parent_required");}return true;
}
function validateCurrentAssociation(context,pr,headTree,checkoutTree){
  const privateTarget=context.repository==="leisurewang0827/app-automation-vault",target=privateTarget?"main":"dev";
  assert(privateTarget||context.repository==="leisurewang0827/tennis-note-public");
  assert.equal(pr.number,privateTarget?596:206,"current_pr_number_mismatch");
  assert.equal(pr.head.repo.full_name,context.repository);assert.equal(pr.base.repo.full_name,context.repository);assert.equal(pr.base.ref,target);assert.equal(pr.base.sha,context.parent1);
  assert.equal(pr.head.ref,context.headBranch||context.headRef);assert.equal(pr.head.sha,context.headSha);assert(/^[a-f0-9]{40}$/.test(pr.head.sha));assert(/^[a-f0-9]{40}$/.test(checkoutTree));assert.equal(headTree,checkoutTree,"pr_head_checkout_tree_mismatch");
  assert.equal(pr.changed_files,privateTarget?19:52,"new_candidate_path_count");
  if(context.event==="push"){assert(pr.merged_at);assert.equal(pr.merge_commit_sha,context.sha,"squash_association_unconfirmed");}return true;
}
function validateCompletedRun(expected,run,jobs,commit,logProof){
  fixedCompletedAuthority(expected);
  assert.equal(run.repository?.full_name,expected.repository,"evidence_repository");
  for(const key of ["id","workflow_id","path","head_sha","head_branch","event","run_attempt"])assert.equal(run[key],expected[key],"evidence_"+key);
  assert.equal(run.status,"completed");assert.equal(run.conclusion,"success");assert(run.completed_at||run.updated_at,"evidence_time_missing");
  assert(run.pull_requests?.some(p=>p.number===expected.pr&&p.head?.sha===expected.head_sha&&p.base?.sha===expected.base),"evidence_pr_binding");
  assert.equal(commit.sha,expected.checkout);assert.equal(commit.tree?.sha,expected.tree,"evidence_tree");
  assert.deepEqual(commit.parents.map(p=>p.sha),[expected.base,expected.head_sha],"evidence_parents");
  const selected=jobs.jobs.filter(j=>j.name===expected.job);assert.equal(selected.length,1,"evidence_job_ambiguous");const job=selected[0];
  assert.equal(job.run_id,expected.id);assert.equal(job.status,"completed");assert.equal(job.conclusion,"success");
  for(const name of expected.steps){const found=job.steps.filter(s=>s.name===name);assert.equal(found.length,1,"evidence_step_missing");assert.equal(found[0].status,"completed");assert.equal(found[0].conclusion,"success","evidence_step_not_executed");}
  assert.equal(logProof.checkout,expected.checkout,"actual_checkout_unproven");assert.equal(logProof.runtimeMarkers,true,"actual_runtime_unproven");
  return true;
}
function validateCheckoutLog(text,expected){
  // 원문은 메모리에만 머문다. SHA/boolean 외 값은 저장·반환·출력하지 않는다.
  const lines=String(text).split(/\r?\n/),markers=lines.map((line,i)=>line.includes("git log -1 --format=%H")?i:-1).filter(i=>i>=0);
  assert.equal(markers.length,1,"checkout_marker_ambiguous");
  const values=lines.slice(markers[0]+1,markers[0]+4).map(line=>line.match(/\b([a-f0-9]{40})\s*$/)?.[1]).filter(Boolean);
  assert.equal(values.length,1,"checkout_sha_missing");assert.equal(values[0],expected.checkout);
  for(const marker of expected.logMarkers)assert(text.includes(marker),"runtime_or_entry_marker_missing");
  return{checkout:values[0],runtimeMarkers:true};
}
function validateInfrastructureDelta(contract,current){
  fixedCompletedAuthority(contract);assert.deepEqual([...contract.deltaPaths].sort(),fixedInfrastructurePaths(contract.repository).sort(),"fixture_cannot_expand_infra");
  assert.equal(current.baselineTree,contract.tree,"baseline_tree_drift");
  const changed=[...current.changedPaths].sort();assert.equal(new Set(changed).size,changed.length);
  assert.deepEqual(changed,[...contract.deltaPaths].sort(),"infra_delta_outside_exact_scope");
  assert(changed.every(p=>!p.includes("production_projection")),"protected_path_denied");
  return true;
}
function validateUnchangedInputs(expected,actual){
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),"input_inventory_drift");
  for(const name of Object.keys(expected))assert.equal(actual[name],expected[name],"old_test_input_changed:"+name);
  return true;
}
function classifyPushSourceArrival(pins,current,parent,associated){
  assert(pins.length>0);assert.equal(new Set(pins.map(p=>p.path)).size,pins.length);
  for(const p of pins)assert(/^[a-f0-9]{64}$/.test(p.sha256));
  const introduced=pins.some(p=>current[p.path]===p.sha256&&parent[p.path]!==p.sha256);
  // BASE ancestry is not a source signature. A known packet arriving without
  // its association is HOLD even after base drift; unrelated pushes stay full.
  if(introduced&&!associated)assert.fail("fixed_candidate_merge_association_missing");
  return Boolean(associated);
}
function fixedPushSourceArrival(pins,root,associated){
  const current={},parent={},digest=b=>require("node:crypto").createHash("sha256").update(b.toString().replace(/\r\n/g,"\n")).digest("hex");
  for(const p of pins){
    assert(!p.path.includes("production_projection"));
    current[p.path]=fs.existsSync(path.join(root,p.path))?digest(fs.readFileSync(path.join(root,p.path))):null;
    try{parent[p.path]=digest(cp.execFileSync("git",["show","HEAD^1:"+p.path],{cwd:root,maxBuffer:16e6,stdio:["ignore","pipe","pipe"]}));}catch{parent[p.path]=null;}
  }
  return classifyPushSourceArrival(pins,current,parent,associated);
}
function completedApi(repository,allowedRuns,allowedCommits=[]){
  const allowedJobs=new Set();
  return async function read(suffix){
    const run=suffix.match(/^actions\/runs\/(\d+)(?:\/attempts\/1\/jobs\?per_page=100)?$/),job=suffix.match(/^actions\/jobs\/(\d+)\/logs$/),commit=suffix.match(/^git\/commits\/([a-f0-9]{40})$/);
    assert((run&&allowedRuns.includes(Number(run[1])))||(job&&allowedJobs.has(Number(job[1])))||(commit&&allowedCommits.includes(commit[1])),"api_route_denied");
    assert(process.env.GH_TOKEN,"read_only_api_permission_missing");
    const response=await fetch("https://api.github.com/repos/"+repository+"/"+suffix,{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
    assert(response.ok,"read_only_evidence_unavailable");
    if(job)return response.text();
    const data=await response.json();if(suffix.includes("/jobs?")){assert(data.total_count<=100&&data.jobs.length===data.total_count,"job_pagination_unconfirmed");for(const j of data.jobs)allowedJobs.add(j.id);}return data;
  };
}
async function obtainCompletedProof(expected,read){
  fixedCompletedAuthority(expected);
  const run=await read("actions/runs/"+expected.id),jobs=await read("actions/runs/"+expected.id+"/attempts/1/jobs?per_page=100");
  const selected=jobs.jobs.filter(j=>j.name===expected.job);assert.equal(selected.length,1,"evidence_job_ambiguous");
  const logProof=validateCheckoutLog(await read("actions/jobs/"+selected[0].id+"/logs"),expected);
  const commit=await read("git/commits/"+expected.checkout);validateCompletedRun(expected,run,jobs,commit,logProof);
  return{id:expected.id,checkout:expected.checkout,tree:expected.tree,job:expected.job,sourceOnly:true};
}
function currentInfrastructure(contract,root,git){
  const baselineTree=git("rev-parse",contract.head_sha+"^{tree}"),changedPaths=git("diff","--name-only",contract.head_sha,"HEAD").split("\n").filter(Boolean);
  validateInfrastructureDelta(contract,{baselineTree,changedPaths});
  assert.equal(process.env.NODE_OPTIONS||"","runtime_loader_override_denied");assert.equal(process.env.TENNISNOTE_REUSE_OFFLINE_BASE||"","offline_channel_in_ci_denied");
  if(process.env.TENNISNOTE_JOURNAL_ROOT)assert.equal(path.resolve(process.env.TENNISNOTE_JOURNAL_ROOT),path.join(root,"90-Dashboard"),"journal_root_override");
  return changedPaths;
}
// END SHARED COMPLETED RUN GUARD
const git=(...args)=>cp.execFileSync("git",args,{cwd:outer.root,encoding:"utf8",maxBuffer:16e6}).trim();
async function api(suffix){
  assert(suffix==="pulls/206"||/^(actions\/runs\/\d+|commits\/[a-f0-9]{40}\/pulls)$/.test(suffix));assert(process.env.GH_TOKEN,"read_only_api_access_missing");
  const result=await fetch("https://api.github.com/repos/"+REPOSITORY+"/"+suffix,{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
  assert(result.ok,"read_only_evidence_unconfirmed");return result.json();
}
async function routeCi(){
  const env=process.env,event=env.GITHUB_EVENT_NAME,ref=env.GITHUB_REF;
  const payload=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,"utf8"));let scoped=false,context,currentPr,changedInputsRequired=false;
  if(event==="pull_request"&&payload.pull_request?.head?.ref===BRANCH){
    const p=payload.pull_request;currentPr=p;context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),baseRepository:p.base.repo.full_name,headRepository:p.head.repo.full_name,baseRef:p.base.ref,baseSha:p.base.sha,headRef:p.head.ref,headSha:p.head.sha,parent1:git("rev-parse","HEAD^1"),parent2:git("rev-parse","HEAD^2")};scoped=true;
  }else if(event==="push"&&ref==="refs/heads/dev"){
    assert.equal(env.GITHUB_REPOSITORY,REPOSITORY);
    const prs=await api("commits/"+env.GITHUB_SHA+"/pulls"),p=prs.find(p=>p.merged_at&&p.merge_commit_sha===env.GITHUB_SHA&&p.head?.ref===BRANCH);
    fixedPushSourceArrival([{path:"tests/fixtures/r3-after-auth548-outer-parity.json",sha256:outer.sha(fs.readFileSync(path.join(outer.root,"tests/fixtures/r3-after-auth548-outer-parity.json")))}],outer.root,Boolean(p));if(p){currentPr=p;context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),parent1:git("rev-parse","HEAD^1"),merged:true,mergeCommit:p.merge_commit_sha,headRepository:p.head.repo.full_name,headRef:p.head.ref};scoped=true;requirePublishable()}
  }
  if(scoped){currentPr=await api("pulls/206");context.headSha=currentPr.head.sha;validateContext(context);validateCurrentAssociation(context,currentPr,git("rev-parse",context.headSha+"^{tree}"),git("rev-parse","HEAD^{tree}"));validateNewCallerShape(context,git("rev-list","--parents","-n","1","HEAD").split(/\s+/).length-1);outer.validateSource();for(const which of ["r3Public","authPublic"])validateEvidence(which,await api("actions/runs/"+outer.contract.evidence[which].run));const impact=await provePublicChangedInputDelta();assert.equal(impact.oldSuiteReusable,false);changedInputsRequired=true;}
  fs.appendFileSync(env.GITHUB_OUTPUT,"scoped="+String(scoped)+"\nchanged_inputs_required="+String(changedInputsRequired)+"\nreused=false\n");console.log(scoped?"R3_AUTH_CHANGED_INPUT_DELTA_REQUIRED":"STANDARD_VERIFICATION_REQUIRED");return scoped;
}
async function main(){
  const mode=process.argv[2];
  if(mode==="--ci-route")return routeCi();
  if(mode==="--deploy"){
    assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_REF,"refs/heads/dev");
    requirePublishable();outer.validateSource();
    validateRuntimeReceipt(process.env.TENNISNOTE_R3_CAPABILITY_RECEIPT||"",process.env.DEV_R3_CAPABILITY_RECEIPT_SHA256||"");
    await proveShallowDeployment();return;
  }
  assert.equal(mode,"--local");console.log(JSON.stringify(outer.validateSource()));
}
module.exports={validateContext,validateEvidence,requirePublishable,validateRuntimeReceipt,fixedCompletedAuthority,validateNewCallerShape,validateCurrentAssociation,validateCompletedRun,validateCheckoutLog,validateInfrastructureDelta,validateUnchangedInputs,completedApi,obtainCompletedProof,validatePublicInputImpact,sharedCompletedGuardHash,classifyPushSourceArrival,fixedPushSourceArrival,validateShallowDeploymentBundle,obtainShallowDeploymentProof,validateCurrentDeltaRun,readLocalDeploymentCheckout,REPOSITORY,BRANCH,BASE};
if(require.main===module)main().catch(()=>{console.error("R3_AUTH_PROVENANCE_FAIL");process.exitCode=1});
// 새 changed-input delta. 기계적 준비가 아래를 기존 authority wrapper 뒤에 붙인다.
function validatePublicInputImpact(before,after,texts){
  const withoutFiles=c=>{const result=JSON.parse(JSON.stringify(c));delete result.files;delete result.completedRunReuse;return result;};
  assert.deepEqual(withoutFiles(after),withoutFiles(before),"legacy_authority_metadata_changed");
  assert.equal(after.files.length,before.files.length);
  for(let i=0;i<before.files.length;i++){
    const old=before.files[i],next=after.files[i];assert.equal(next.path,old.path);
    if(old.path!==".github/workflows/tennisnote-public-ci.yml"){assert.deepEqual(next,old,"product_or_golden_input_changed");continue;}
    assert.equal(next.authSha256,old.authSha256);assert.equal(next.r3Sha256,old.r3Sha256);assert.equal(next.afterSha256,outer.sha(texts.currentCi));
    for(const kind of ["auth","r3"])assert.equal(outer.sha(outer.restore(next.path,texts.currentCi,kind)),old[kind+"Sha256"],"new_ci_inverse_drift");
  }
  assert.equal(texts.currentHelper,texts.oldHelper.replace('"'+outer.sha(texts.oldContractRaw)+'"','"'+outer.sha(texts.currentContractRaw)+'"'),"loader_change_outside_hash_pin");
  for(const name of ["validateContext","validateEvidence","requirePublishable","validateRuntimeReceipt"]){
    const regex=name==="requirePublishable"?new RegExp("function "+name+"\\(\\)\\{[^\\n]*\\}"):new RegExp("function "+name+"\\([\\s\\S]*?\\n\\}");
    const old=texts.oldProvenance.match(regex)?.[0],current=texts.currentProvenance.match(regex)?.[0];assert(old&&current);assert.equal(current,old,"existing_validator_changed:"+name);
  }
  for(const snippet of after.completedRunReuse.commandSnippets){assert(texts.oldCi.includes(snippet));assert.equal(texts.currentCi.split(snippet).length,texts.oldCi.split(snippet).length,"old_command_changed");}
  // Whole public12 input graph changes at its direct loader/fixture/provenance imports.
  // Thus old12 is historical authority only, NOT a new whole-suite reuse attestation.
  return{oldSuiteReusable:false,changedInputValidationRequired:true,productAndGoldenDelta:0,changedInputPaths:after.completedRunReuse.changedInputPaths};
}
async function provePublicChangedInputDelta(){
  const e=outer.contract.completedRunReuse;assert.equal(e.sharedGuardSha256,sharedCompletedGuardHash());
  currentInfrastructure(e,outer.root,git);
  const old=(file)=>git("show",e.head_sha+":"+file),current=(file)=>fs.readFileSync(path.join(outer.root,file),"utf8").replace(/\r\n/g,"\n");
  const fixture="tests/fixtures/r3-after-auth548-outer-parity.json",helper="tests/helpers/r3-auth548-outer-port.cjs",ci=".github/workflows/tennisnote-public-ci.yml",provenance="scripts/check_tennisnote_r3_auth548_provenance.cjs";
  const oldContractRaw=old(fixture)+"\n",currentContractRaw=current(fixture);
  const impact=validatePublicInputImpact(JSON.parse(oldContractRaw),outer.contract,{oldContractRaw,currentContractRaw,oldHelper:old(helper)+"\n",currentHelper:current(helper),oldCi:old(ci)+"\n",currentCi:current(ci),oldProvenance:old(provenance)+"\n",currentProvenance:current(provenance)});
  const read=completedApi(REPOSITORY,[e.id],[e.checkout]);await obtainCompletedProof(e,read);return impact;
}
function sharedCompletedGuardHash(){
  const text=fs.readFileSync(__filename,"utf8"),body=text.match(/\/\/ BEGIN SHARED COMPLETED RUN GUARD\n([\s\S]*?)\/\/ END SHARED COMPLETED RUN GUARD/)[1];return outer.sha(body);
}
async function requireCurrentDeltaJob(){
  assert(/^\d+$/.test(process.env.GITHUB_RUN_ID||""));assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");assert(process.env.GH_TOKEN);
  const response=await fetch("https://api.github.com/repos/"+REPOSITORY+"/actions/runs/"+process.env.GITHUB_RUN_ID+"/jobs?per_page=100",{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
  assert(response.ok,"current_delta_job_unconfirmed");const data=await response.json();assert(data.total_count<=100&&data.jobs.length===data.total_count);
  const jobs=data.jobs.filter(j=>j.name==="build-and-check");assert.equal(jobs.length,1);const job=jobs[0];assert.equal(job.head_sha,process.env.GITHUB_SHA);assert.equal(job.status,"completed");assert.equal(job.conclusion,"success");
  const steps=job.steps.filter(s=>s.name==="Verify changed-input completed-run admission only");assert.equal(steps.length,1);assert.equal(steps[0].status,"completed");assert.equal(steps[0].conclusion,"success");return true;
}
function validateCurrentDeltaRun(local,run,jobs){
  assert.equal(local.repository,REPOSITORY);assert.equal(local.event,"push");assert.equal(local.ref,"refs/heads/dev");
  assert.equal(local.caller,REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@refs/heads/dev","deploy_caller_mismatch");
  assert(/^[a-f0-9]{40}$/.test(local.sha));assert.equal(local.checkout,local.sha);assert.equal(local.attempt,1);assert(Number.isSafeInteger(local.runId)&&local.runId>0);
  assert.equal(run.id,local.runId);assert.equal(run.repository?.full_name,REPOSITORY);assert.equal(run.workflow_id,329932540);assert.equal(run.path,".github/workflows/tennisnote-public-ci.yml");
  assert.equal(run.event,"push");assert.equal(run.head_branch,"dev");assert.equal(run.head_sha,local.sha);assert.equal(run.run_attempt,1);
  assert(["in_progress","completed"].includes(run.status));if(run.status==="completed")assert.equal(run.conclusion,"success");
  assert(jobs.total_count<=100&&jobs.jobs.length===jobs.total_count);const found=jobs.jobs.filter(j=>j.name==="build-and-check");assert.equal(found.length,1);
  const job=found[0];assert.equal(job.run_id,local.runId);assert.equal(job.head_sha,local.sha);assert.equal(job.status,"completed");assert.equal(job.conclusion,"success");
  const steps=job.steps.filter(s=>s.name==="Verify changed-input completed-run admission only");assert.equal(steps.length,1);assert.equal(steps[0].status,"completed");assert.equal(steps[0].conclusion,"success","changed_input_step_not_executed");return true;
}
function validateShallowDeploymentBundle(local,bundle){
  validateCurrentDeltaRun(local,bundle.run,bundle.jobs);
  const e=outer.contract.completedRunReuse;fixedCompletedAuthority(e);
  assert(bundle.associations.some(p=>p.number===206&&p.merged_at&&p.merge_commit_sha===local.sha&&p.head?.ref===BRANCH),"deployment_merge_admission_missing");
  const commit=bundle.currentCommit,pr=bundle.pr;assert.equal(commit.sha,local.sha);assert.equal(commit.tree?.sha,local.tree);assert.equal(commit.parents.length,1);
  const context={repository:REPOSITORY,event:"push",ref:local.ref,sha:local.sha,checkout:local.checkout,parent1:commit.parents[0].sha,merged:true,mergeCommit:pr.merge_commit_sha,headRepository:pr.head.repo.full_name,headRef:pr.head.ref,headSha:pr.head.sha};
  validateContext(context);validateNewCallerShape(context,1);assert.equal(bundle.headCommit.sha,pr.head.sha);validateCurrentAssociation(context,pr,bundle.headCommit.tree?.sha,local.tree);
  assert.equal(bundle.baselineCommit.sha,e.head_sha);assert.equal(bundle.baselineCommit.tree?.sha,e.tree);
  const map=(t,expected)=>{assert.equal(t.sha,expected);assert.equal(t.truncated,false,"tree_pagination_unconfirmed");const result={};for(const row of t.tree){assert(!Object.hasOwn(result,row.path));result[row.path]=row.type+":"+row.mode+":"+row.sha;}return result;};
  const before=map(bundle.baselineTree,e.tree),after=map(bundle.currentTree,local.tree);
  // Compare leaf blobs only: ancestor tree IDs necessarily change with an
  // approved child edit. New/deleted files and symlinks remain visible.
  const leaves=m=>Object.fromEntries(Object.entries(m).filter(([,v])=>!v.startsWith("tree:")));
  const a=leaves(before),b=leaves(after),changed=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(p=>a[p]!==b[p]);
  validateInfrastructureDelta(e,{baselineTree:e.tree,changedPaths:changed});
  assert.deepEqual(Object.keys(local.blobs).sort(),e.deltaPaths.slice().sort());for(const p of e.deltaPaths)assert.equal(after[p],"blob:100644:"+local.blobs[p],"checked_out_source_blob_mismatch");
  return{shallowSafe:true,currentRunBound:true,oldWholePublicSuiteReusable:false,sourceDeltaPaths:changed.length};
}
async function obtainShallowDeploymentProof(local,read){
  const e=outer.contract.completedRunReuse;
  const run=await read("actions/runs/"+local.runId),jobs=await read("actions/runs/"+local.runId+"/attempts/1/jobs?per_page=100");
  validateCurrentDeltaRun(local,run,jobs);
  const associations=await read("commits/"+local.sha+"/pulls"),pr=await read("pulls/206");
  const currentCommit=await read("git/commits/"+local.sha),headCommit=await read("git/commits/"+pr.head.sha),baselineCommit=await read("git/commits/"+e.head_sha);
  const baselineTree=await read("git/trees/"+e.tree+"?recursive=1"),currentTree=await read("git/trees/"+local.tree+"?recursive=1");
  return validateShallowDeploymentBundle(local,{run,jobs,associations,pr,currentCommit,headCommit,baselineCommit,baselineTree,currentTree});
}
async function proveShallowDeployment(){
  const env=process.env,e=outer.contract.completedRunReuse;
  assert.equal(env.NODE_OPTIONS||"","");assert.equal(env.TENNISNOTE_REUSE_OFFLINE_BASE||"","");assert(env.GH_TOKEN);assert(/^\d+$/.test(env.GITHUB_RUN_ID||""));
  // Only current HEAD is available/needed. No HEAD^, show, old diff or fetch.
  const local=readLocalDeploymentCheckout(env,git,p=>fs.readFileSync(path.join(outer.root,p)));
  const allowed=new Set(["actions/runs/"+local.runId,"actions/runs/"+local.runId+"/attempts/1/jobs?per_page=100","commits/"+local.sha+"/pulls","pulls/206","git/commits/"+local.sha,"git/commits/"+e.head_sha,"git/trees/"+e.tree+"?recursive=1","git/trees/"+local.tree+"?recursive=1"]);
  const read=async suffix=>{assert(allowed.has(suffix),"deploy_metadata_route_denied");const response=await fetch("https://api.github.com/repos/"+REPOSITORY+"/"+suffix,{headers:{Authorization:"Bearer "+env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});assert(response.ok,"deploy_metadata_unavailable");const data=await response.json();if(suffix==="pulls/206"){assert.equal(data.head?.repo?.full_name,REPOSITORY);assert(/^[a-f0-9]{40}$/.test(data.head?.sha||""));allowed.add("git/commits/"+data.head.sha);}return data;};
  const result=await obtainShallowDeploymentProof(local,read);
  await obtainCompletedProof(e,completedApi(REPOSITORY,[e.id],[e.checkout]));
  console.log(JSON.stringify(result));return result;
}
function readLocalDeploymentCheckout(env,readGit,readBytes){
  const local={repository:env.GITHUB_REPOSITORY,event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,sha:env.GITHUB_SHA,checkout:readGit("rev-parse","HEAD"),tree:readGit("rev-parse","HEAD^{tree}"),caller:env.TENNISNOTE_CALLER_WORKFLOW_REF,runId:Number(env.GITHUB_RUN_ID),attempt:Number(env.GITHUB_RUN_ATTEMPT),blobs:{}};
  assert.equal(readGit("diff","--name-only","HEAD"),"","checkout_modified");
  for(const p of outer.contract.completedRunReuse.deltaPaths){const bytes=readBytes(p);local.blobs[p]=require("node:crypto").createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");}
  return local;
}
