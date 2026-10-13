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
const git=(...args)=>cp.execFileSync("git",args,{cwd:outer.root,encoding:"utf8",maxBuffer:16e6}).trim();
async function api(suffix){
  assert(/^(actions\/runs\/\d+|commits\/[a-f0-9]{40}\/pulls)$/.test(suffix));assert(process.env.GH_TOKEN,"read_only_api_access_missing");
  const result=await fetch("https://api.github.com/repos/"+REPOSITORY+"/"+suffix,{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
  assert(result.ok,"read_only_evidence_unconfirmed");return result.json();
}
async function routeCi(){
  const env=process.env,event=env.GITHUB_EVENT_NAME,ref=env.GITHUB_REF;
  const payload=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,"utf8"));let scoped=false,context;
  if(event==="pull_request"&&payload.pull_request?.head?.ref===BRANCH){
    const p=payload.pull_request;context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),baseRepository:p.base.repo.full_name,headRepository:p.head.repo.full_name,baseRef:p.base.ref,baseSha:p.base.sha,headRef:p.head.ref,headSha:p.head.sha,parent1:git("rev-parse","HEAD^1"),parent2:git("rev-parse","HEAD^2")};scoped=true;
  }else if(event==="push"&&ref==="refs/heads/dev"){
    assert.equal(env.GITHUB_REPOSITORY,REPOSITORY);
    const prs=await api("commits/"+env.GITHUB_SHA+"/pulls"),p=prs.find(p=>p.merged_at&&p.merge_commit_sha===env.GITHUB_SHA&&p.head?.ref===BRANCH);
    if(p){context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),parent1:git("rev-parse","HEAD^1"),merged:true,mergeCommit:p.merge_commit_sha,headRepository:p.head.repo.full_name,headRef:p.head.ref};scoped=true;requirePublishable()}
  }
  if(scoped){validateContext(context);outer.validateSource();for(const which of ["r3Public","authPublic"])validateEvidence(which,await api("actions/runs/"+outer.contract.evidence[which].run));}
  fs.appendFileSync(env.GITHUB_OUTPUT,"scoped="+String(scoped)+"\n");console.log(scoped?"R3_AUTH_SOURCE_EVIDENCE_PASS":"STANDARD_VERIFICATION_REQUIRED");
}
async function main(){
  const mode=process.argv[2];
  if(mode==="--ci-route")return routeCi();
  if(mode==="--deploy"){assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_REF,"refs/heads/dev");requirePublishable();throw Error("explicit_runtime_admission_still_required")}
  assert.equal(mode,"--local");console.log(JSON.stringify(outer.validateSource()));
}
module.exports={validateContext,validateEvidence,requirePublishable,REPOSITORY,BRANCH,BASE};
if(require.main===module)main().catch(()=>{console.error("R3_AUTH_PROVENANCE_FAIL");process.exitCode=1});
