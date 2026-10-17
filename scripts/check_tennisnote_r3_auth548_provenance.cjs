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
const SQL5_RUNTIME_MIGRATIONS=Object.freeze([
  {version:"20261009001000",sha256:"edde250e27156280b1346c2c0d541d382494636f1e6862c5b3bfe3e3dc6bfe4b"},
  {version:"20261010001000",sha256:"7777f25c79155eafaf761bad1bfe0ab298a0c34956880719890e30f0999622cb"},
  {version:"20261012001000",sha256:"c4f0721e606177e458c412c01559859c38fab1009c9d4f3920d60578d38b7b35"},
  {version:"20261012002000",sha256:"7bb65a04a93e9025fe4d316c65226bd814f10c139c64aac512ca74a99cd7ac9b"},
  {version:"20261015001000",sha256:"f25d70419c747731014fb57df0b154fe7d9fc5f7acb2bd965e556bebed1f6bba"}
]);
function validateSql5RuntimeReceipt(raw,expectedHash,now=Date.now()){
  assert(/^[a-f0-9]{64}$/.test(expectedHash||""),"sql5_runtime_receipt_approval_missing");
  assert.equal(outer.sha(raw),expectedHash,"sql5_runtime_receipt_hash_mismatch");
  const receipt=JSON.parse(raw),extension=outer.contract.completedRunReuse.sql5RuntimeAdmission;
  assert.deepEqual(extension,{contract:"r3-development-readonly-capability-sql5-extension/1",migrations:SQL5_RUNTIME_MIGRATIONS},"sql5_contract_drift");
  assert.deepEqual(receipt.migrations,SQL5_RUNTIME_MIGRATIONS,"sql5_runtime_migration_set_mismatch");
  const legacyProjection={...receipt,migrations:outer.contract.runtimeAdmission.migrations},legacyRaw=JSON.stringify(legacyProjection);
  return validateRuntimeReceipt(legacyRaw,outer.sha(legacyRaw),now);
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
function validateStableHistoricalBinding(expected,run,proof){
  fixedCompletedAuthority(expected);assert(Array.isArray(run.pull_requests)&&run.pull_requests.length===0,"fallback_empty_array_only");
  assert(proof&&proof.repository===expected.repository&&proof.oldHead===expected.head_sha,"stable_binding_source_mismatch");
  const validateRepo=repo=>{assert(repo&&typeof repo==="object"&&!Array.isArray(repo)&&(repo.full_name!==undefined||repo.url!==undefined),"stable_repository_identity_missing");if(repo.full_name!==undefined)assert.equal(repo.full_name,expected.repository,"stable_repository_full_name");if(repo.url!==undefined)assert.equal(repo.url,"https://api.github.com/repos/"+expected.repository,"stable_repository_canonical_url");if(repo.name!==undefined)assert.equal(repo.name,expected.repository.split("/")[1],"stable_repository_name");};
  const validate=p=>{assert(p&&p.number===expected.pr,"stable_pr_number");validateRepo(p.head?.repo);validateRepo(p.base?.repo);assert.equal(p.head.ref,expected.head_branch);assert.equal(p.base.ref,expected.repository==="leisurewang0827/app-automation-vault"?"main":"dev");assert(/^[a-f0-9]{40}$/.test(p.head.sha||"")&&/^[a-f0-9]{40}$/.test(p.base.sha||""),"stable_mutable_sha_shape");};
  for(const page of [proof.associations,proof.inventory])assert(page&&page.complete===true&&Number.isInteger(page.pages)&&page.pages>=1&&page.pages<=2,"stable_page_incomplete");
  assert.equal(proof.associations.rows.length,1,"stable_association_ambiguous");validate(proof.associations.rows[0]);validate(proof.pr);
  assert(Number.isInteger(proof.pr.commits)&&proof.pr.commits>=1&&proof.pr.commits<=200,"stable_inventory_limit");assert.equal(proof.inventory.rows.length,proof.pr.commits,"stable_inventory_incomplete");
  const ids=proof.inventory.rows.map(r=>r.sha);assert(ids.every(s=>/^[a-f0-9]{40}$/.test(s||"")));assert.equal(new Set(ids).size,ids.length,"stable_inventory_duplicate");assert.equal(ids.filter(s=>s===expected.head_sha).length,1,"stable_old_head_missing");
  assert(["open","closed"].includes(proof.pr.state));assert(typeof proof.pr.created_at==="string"&&typeof run.created_at==="string","stable_per_run_time_type");const created=Date.parse(proof.pr.created_at),runCreated=Date.parse(run.created_at),now=Date.now();assert(Number.isFinite(created)&&Number.isFinite(runCreated)&&created<=runCreated&&runCreated<=now,"stable_per_run_time_missing_or_mismatch");
  if(proof.pr.state==="closed"){assert.equal(typeof proof.pr.merged_at,"string","stable_merge_time_type");const merged=Date.parse(proof.pr.merged_at);assert.equal(proof.pr.merged,true);assert(Number.isFinite(merged)&&runCreated<=merged&&merged<=now,"stable_merge_time_mismatch");}else{assert.equal(proof.pr.merged,false);assert.equal(proof.pr.merged_at,null);}
  return true;
}
const stableHistoricalCache=new Map();
async function readStablePages(prefix,read){
  const rows=[];for(let page=1;page<=2;page++){const p=await read(prefix+"?per_page=100&page="+page);assert(p&&Array.isArray(p.rows)&&p.rows.length<=100&&typeof p.hasNext==="boolean","stable_page_shape");rows.push(...p.rows);if(!p.hasNext)return{rows,pages:page,complete:true};assert(page<2,"stable_page_overflow");}assert.fail("stable_page_incomplete");
}
async function obtainStableHistoricalBinding(expected,run,read){
  fixedCompletedAuthority(expected);assert.equal(run.id,expected.id);assert.equal(run.head_sha,expected.head_sha);assert.equal(run.event,expected.event);assert.equal(run.run_attempt,1);assert.equal(run.repository?.full_name,expected.repository);
  const key=expected.repository+":"+expected.head_sha+":"+expected.pr;
  if(!stableHistoricalCache.has(key))stableHistoricalCache.set(key,(async()=>({repository:expected.repository,oldHead:expected.head_sha,associations:await readStablePages("commits/"+expected.head_sha+"/pulls",read),pr:await read("pulls/"+expected.pr),inventory:await readStablePages("pulls/"+expected.pr+"/commits",read)}))());
  const proof=await stableHistoricalCache.get(key);validateStableHistoricalBinding(expected,run,proof);return proof;
}
function validateMaintenanceAssociation(c,p,readGit){
  const M1="bd11425153deced09fcff4df441ac947955bf73b",repo="leisurewang0827/app-automation-vault",branch="codex/tennisnote-dev549-historical-binding-fix-20261014",allowed=["scripts/check_tennisnote_r3_auth548_admission.cjs","scripts/check_tennisnote_r3_completed_run_admission.cjs","scripts/fixtures/r3-auth548-private-admission.json"];
  assert.equal(c.repository,repo);assert.equal(c.checkout,c.sha);assert.equal(c.parent1,M1);assert(/^[a-f0-9]{40}$/.test(c.headSha||""),"maintenance_head_sha_shape");assert(Number.isSafeInteger(c.sourcePRNumber)&&c.sourcePRNumber>0&&c.sourcePRNumber!==596);assert.equal(p.number,c.sourcePRNumber);assert.equal(p.head?.repo?.full_name,repo);assert.equal(p.base?.repo?.full_name,repo);assert.equal(p.head.ref,branch);assert.equal(p.base.ref,"main");assert.equal(p.base.sha,M1);assert.equal(p.head.sha,c.headSha);
  assert.equal(readGit("rev-parse",c.headSha+"^1"),M1,"maintenance_head_not_direct_child");assert.equal(readGit("rev-list","--parents","-n","1",c.headSha).split(/\s+/).length,2,"maintenance_head_parent_count");
  assert.equal(readGit("rev-parse",c.headSha+"^{tree}"),readGit("rev-parse","HEAD^{tree}"),"maintenance_tree_mismatch");
  const delta=readGit("diff","--name-only",M1,"HEAD").split("\n").filter(Boolean);assert(delta.length>=1&&delta.length<=3&&new Set(delta).size===delta.length&&delta.every(f=>allowed.includes(f)),"maintenance_delta_outside_scope");assert.equal(p.changed_files,delta.length);
  if(c.event==="pull_request"){assert.equal(c.baseSha,M1);assert.equal(c.parent2,c.headSha);assert.equal(c.headBranch,branch);assert.equal(c.baseRepository,repo);assert.equal(c.headRepository,repo);assert.equal(c.baseRef,"main");}else{assert.equal(c.event,"push");assert.equal(c.ref,"refs/heads/main");assert(p.merged_at&&p.merged===true);assert.equal(p.merge_commit_sha,c.sha);assert.equal(c.mergeCommit,c.sha);assert.equal(c.headBranch,branch);}
  validateNewCallerShape(c,readGit("rev-list","--parents","-n","1","HEAD").split(/\s+/).length-1);return true;
}
function selectUniqueMergedAssociation(rows,sha,branches){assert(Array.isArray(rows),"current_association_array_required");const matches=rows.filter(p=>p.merged_at&&p.merge_commit_sha===sha&&branches.includes(p.head?.ref));assert(matches.length<=1,"current_merge_association_ambiguous");if(matches.length)assert.equal(rows.length,1,"current_merge_association_not_unique");return matches[0];}
function validateCompletedRun(expected,run,jobs,commit,logProof,stableProof=null){
  fixedCompletedAuthority(expected);
  assert.equal(run.repository?.full_name,expected.repository,"evidence_repository");
  for(const key of ["id","workflow_id","path","head_sha","head_branch","event","run_attempt"])assert.equal(run[key],expected[key],"evidence_"+key);
  assert.equal(run.status,"completed");assert.equal(run.conclusion,"success");assert(run.completed_at||run.updated_at,"evidence_time_missing");
  // run.head_sha와 checkout 부모는 과거 실행의 권위다. PR association head는 현재 PR 갱신을 반영한다.
  // association의 head/base SHA 모두 mutable이다. 동일 PR의 stable identity만 식별한다.
  assert(Array.isArray(run.pull_requests),"evidence_pr_binding");
  if(run.pull_requests.length===0){validateStableHistoricalBinding(expected,run,stableProof);}else{
  assert.equal(run.pull_requests.length,1,"evidence_pr_binding");
  const association=run.pull_requests[0];assert.equal(association.number,expected.pr,"evidence_pr_binding");
  assert.equal(association.base?.ref,expected.repository==="leisurewang0827/app-automation-vault"?"main":"dev","evidence_pr_base_branch");
  assert.equal(association.head?.ref,expected.head_branch,"evidence_pr_head_branch");
  for(const side of [association.base,association.head]){
    assert(/^[a-f0-9]{40}$/.test(side?.sha||""),"evidence_mutable_sha_shape");
    const repo=side.repo;assert(repo&&(repo.full_name!==undefined||repo.url!==undefined),"evidence_pr_repository_missing");
    if(repo.full_name!==undefined)assert.equal(repo.full_name,expected.repository,"evidence_pr_repository_binding");
    if(repo.url!==undefined)assert.equal(repo.url,"https://api.github.com/repos/"+expected.repository,"evidence_pr_repository_binding");
    if(repo.name!==undefined)assert.equal(repo.name,expected.repository.split("/")[1],"evidence_pr_repository_binding");
  }
  }
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
  const allowedJobs=new Set(),privateRepo=repository==="leisurewang0827/app-automation-vault",oldHead=privateRepo?"5f0d3d6ea1d89da9dba6f328627b44c9ef2525d3":"fe03b6cb3c69b19571e3fe07ba65afae8a40a6e9",originalPR=privateRepo?596:206;
  assert(privateRepo||repository==="leisurewang0827/tennis-note-public");assert(allowedRuns.length>0&&allowedRuns.every(n=>(privateRepo?[38394022243,38394022195]:[38394162701]).includes(n)),"completed_reader_authority");let oldCalls=0,fallbackCalls=0;const seen=new Set();
  return async function read(suffix){
    const run=suffix.match(/^actions\/runs\/(\d+)(?:\/attempts\/1\/jobs\?per_page=100)?$/),job=suffix.match(/^actions\/jobs\/(\d+)\/logs$/),commit=suffix.match(/^git\/commits\/([a-f0-9]{40})$/);
    const fallback=suffix==="pulls/"+originalPR||[1,2].some(page=>suffix==="commits/"+oldHead+"/pulls?per_page=100&page="+page||suffix==="pulls/"+originalPR+"/commits?per_page=100&page="+page);
    assert(fallback||(run&&allowedRuns.includes(Number(run[1])))||(job&&allowedJobs.has(Number(job[1])))||(commit&&allowedCommits.includes(commit[1])),"api_route_denied");assert(!seen.has(suffix),"api_duplicate_request");seen.add(suffix);if(fallback)assert(++fallbackCalls<=5,"fallback_api_cap");else assert(++oldCalls<=allowedRuns.length*4,"legacy_api_cap");
    assert(process.env.GH_TOKEN,"read_only_api_permission_missing");
    const response=await fetch("https://api.github.com/repos/"+repository+"/"+suffix,{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
    assert(response.ok,"read_only_evidence_unavailable");
    if(job)return response.text();
    const data=await response.json();if(fallback&&suffix.includes("?")){assert(response.headers&&typeof response.headers.get==="function","pagination_headers_missing");const link=response.headers.get("link")||"",links=link?link.split(/,\s*(?=<)/):[],currentPage=Number(suffix.match(/page=(\d+)$/)[1]),relations=new Set();let hasNext=false;
      for(const part of links){const m=part.match(/^\s*<([^>]+)>\s*;\s*rel="(next|prev|first|last)"\s*$/);assert(m,"pagination_link_malformed");assert(!relations.has(m[2]),"pagination_relation_ambiguous");relations.add(m[2]);const u=new URL(m[1]);assert.equal(u.origin,"https://api.github.com");assert.equal(u.pathname,"/repos/"+repository+"/"+suffix.split("?")[0]);assert.equal(u.searchParams.get("per_page"),"100");assert.equal([...u.searchParams.keys()].sort().join(","),"page,per_page");assert(!u.username&&!u.password&&!u.hash);assert(/^[1-9]\d*$/.test(u.searchParams.get("page")||""));assert(Number(u.searchParams.get("page"))<=2,"pagination_page_bound");if(m[2]==="next"){assert.equal(Number(u.searchParams.get("page")),currentPage+1);hasNext=true;}}
      return{rows:data,hasNext};}if(suffix.includes("/jobs?")){assert(data.total_count<=100&&data.jobs.length===data.total_count,"job_pagination_unconfirmed");for(const j of data.jobs)allowedJobs.add(j.id);}return data;
  };
}
async function obtainCompletedProof(expected,read){
  fixedCompletedAuthority(expected);
  const run=await read("actions/runs/"+expected.id),jobs=await read("actions/runs/"+expected.id+"/attempts/1/jobs?per_page=100");
  const selected=jobs.jobs.filter(j=>j.name===expected.job);assert.equal(selected.length,1,"evidence_job_ambiguous");
  const logProof=validateCheckoutLog(await read("actions/jobs/"+selected[0].id+"/logs"),expected);
  const commit=await read("git/commits/"+expected.checkout);assert(Array.isArray(run.pull_requests),"evidence_pr_binding");const stableProof=run.pull_requests.length===0?await obtainStableHistoricalBinding(expected,run,read):null;validateCompletedRun(expected,run,jobs,commit,logProof,stableProof);
  return{id:expected.id,checkout:expected.checkout,tree:expected.tree,job:expected.job,sourceOnly:true};
}
function currentInfrastructure(contract,root,git){
  const baselineTree=git("rev-parse",contract.head_sha+"^{tree}"),changedPaths=git("diff","--name-only",contract.head_sha,"HEAD").split("\n").filter(Boolean);
  validateInfrastructureDelta(contract,{baselineTree,changedPaths});
  assert.equal(process.env.NODE_OPTIONS||"","","runtime_loader_override_denied");assert.equal(process.env.TENNISNOTE_REUSE_OFFLINE_BASE||"","","offline_channel_in_ci_denied");
  if(process.env.TENNISNOTE_JOURNAL_ROOT)assert.equal(path.resolve(process.env.TENNISNOTE_JOURNAL_ROOT),path.join(root,"90-Dashboard"),"journal_root_override");
  return changedPaths;
}
function buildCollectorFixture(repository,sourceRoot,authorityRoot=sourceRoot,sourceRef="HEAD"){
  const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),isPrivate=repository==="leisurewang0827/app-automation-vault";
  assert(isPrivate||repository==="leisurewang0827/tennis-note-public");
  const read=(file,ref)=>{assert(!file.includes("production_projection")&&!file.includes("config.local"));if(!ref&&fs.existsSync(path.join(sourceRoot,file)))return fs.readFileSync(path.join(sourceRoot,file));return cp.execFileSync("git",["show",(ref||sourceRef)+":"+file],{cwd:authorityRoot,maxBuffer:16e6,stdio:["ignore","pipe","pipe"]});};
  const fixtureFile=isPrivate?"scripts/fixtures/r3-auth548-private-admission.json":"tests/fixtures/r3-after-auth548-outer-parity.json",packet=JSON.parse(read(fixtureFile)),entry=isPrivate?"scripts/check_tennisnote_r3_auth548_admission.cjs":"scripts/check_tennisnote_r3_auth548_provenance.cjs";
  const currentHead="c".repeat(40),checkout="d".repeat(40),currentTree="e".repeat(40),base=isPrivate?"40bd1687af6f2ee800c8b0c5324cc01ec49f6e04":packet.publicParent,branch=isPrivate?"codex/r3-policy-after-auth548-20261013":"codex/r3-after-auth548-local-20261013",number=isPrivate?596:206;
  const files={},git={},api={},es=isPrivate?Object.values(packet.completedRunReuse.completedRuns):[packet.completedRunReuse];
  const add=file=>{assert(!file.includes("production_projection"));files[file]=read(file).toString("utf8");};
  add(fixtureFile);add(entry);add(isPrivate?"scripts/check_tennisnote_r3_completed_run_admission.cjs":"tests/helpers/r3-auth548-outer-port.cjs");
  for(const row of isPrivate?packet.source:packet.files)add(row.path);if(!isPrivate)for(const row of packet.authPins)add(row.path);
  const pr={number,head:{sha:currentHead,ref:branch,repo:{full_name:repository}},base:{sha:base,ref:isPrivate?"main":"dev",repo:{full_name:repository}},changed_files:isPrivate?19:52};
  const env={GH_TOKEN:"synthetic-readonly-token",GITHUB_EVENT_NAME:"pull_request",GITHUB_EVENT_PATH:"/virtual/event.json",GITHUB_OUTPUT:"/virtual/output",GITHUB_REPOSITORY:repository,GITHUB_SHA:checkout,GITHUB_REF:"refs/pull/"+number+"/merge",NODE_OPTIONS:"",TENNISNOTE_REUSE_OFFLINE_BASE:""};
  const answer=(args,value)=>git[JSON.stringify(args)]=value;
  answer(["rev-parse","HEAD"],checkout);answer(["rev-parse","HEAD^1"],base);answer(["rev-parse","HEAD^2"],currentHead);answer(["rev-parse","HEAD^{tree}"],currentTree);answer(["rev-parse",currentHead+"^{tree}"],currentTree);answer(["rev-list","--parents","-n","1","HEAD"],[checkout,base,currentHead].join(" "));
  if(!isPrivate){answer(["rev-parse",currentHead+"^1"],"b199fcf825b7b27947217b81ed4d46c8e9bc714e");answer(["rev-list","--parents","-n","1",currentHead],currentHead+" b199fcf825b7b27947217b81ed4d46c8e9bc714e");answer(["diff","--name-only","b199fcf825b7b27947217b81ed4d46c8e9bc714e","HEAD"],["scripts/check_tennisnote_r3_auth548_provenance.cjs","tests/helpers/r3-auth548-outer-port.cjs","tests/fixtures/r3-after-auth548-outer-parity.json","tests/r3-auth549-completed-run-admission.test.js"].join("\n"));}
  answer(["diff","--name-only",base,"HEAD"],(isPrivate?packet.allowedPaths:Object.keys(packet.files.reduce((m,r)=>(m[r.path]=true,m),{}))).join("\n"));
  if(!isPrivate){const scope=52,paths=Array.from({length:scope},(_,i)=>"synthetic-scope-"+i);answer(["diff","--name-only",base,"HEAD"],paths.join("\n"));}
  api["pulls/"+number]=pr;
  if(isPrivate)api["actions/runs/38261870915"]={id:38261870915,head_sha:"527c0924d9a98d091ec986741934d2798b4f53f1",event:"workflow_dispatch",conclusion:"success",repository:{full_name:repository}};
  else for(const [which,e]of Object.entries(packet.evidence)){if(!["r3Public","authPublic"].includes(which))continue;api["actions/runs/"+e.run]={id:e.run,head_sha:e.head,event:e.event,conclusion:"success",repository:{full_name:repository},head_branch:e.branch,pull_requests:[{number:204,head:{sha:e.head},base:{sha:"e794c18059ff3391af9a5494f6389cfa0de70c2b"}}]};}
  for(const e of es){
    add(e.path);
    answer(["rev-parse",e.head_sha+"^{tree}"],e.tree);answer(["diff","--name-only",e.head_sha,"HEAD"],e.deltaPaths.join("\n"));
    for(const row of e.inputPins||[]){if(row.kind==="git-tree"){answer(["rev-parse",e.head_sha+":"+row.path],e.inputHashes[row.name]);answer(["rev-parse","HEAD:"+row.path],e.inputHashes[row.name]);}else{add(row.path);answer(["show",e.head_sha+":"+row.path],read(row.path,e.head_sha).toString("utf8"));}}
    answer(["show",e.head_sha+":"+e.path],read(e.path,e.head_sha).toString("utf8").trim());
    const jobId=e.id*10+1;
    api["actions/runs/"+e.id]={...e,status:"completed",conclusion:"success",updated_at:"synthetic-time",repository:{full_name:repository},pull_requests:[{number:e.pr,head:{ref:e.head_branch,sha:currentHead,repo:{url:"https://api.github.com/repos/"+repository,name:repository.split("/")[1]}},base:{ref:isPrivate?"main":"dev",sha:base,repo:{url:"https://api.github.com/repos/"+repository,name:repository.split("/")[1]}}}]};
    api["actions/runs/"+e.id+"/attempts/1/jobs?per_page=100"]={total_count:1,jobs:[{id:jobId,name:e.job,run_id:e.id,status:"completed",conclusion:"success",steps:e.steps.map(name=>({name,status:"completed",conclusion:"success"}))}]};
    api["actions/jobs/"+jobId+"/logs"]="git log -1 --format=%H\n"+e.checkout+"\n"+e.logMarkers.join("\n");
    api["git/commits/"+e.checkout]={sha:e.checkout,tree:{sha:e.tree},parents:[{sha:e.base},{sha:e.head_sha}]};
  }
  if(!isPrivate){const e=packet.completedRunReuse;for(const file of [fixtureFile,"tests/helpers/r3-auth548-outer-port.cjs",entry])answer(["show",e.head_sha+":"+file],read(file,e.head_sha).toString("utf8").trim());}
  const proofRoutes=e=>["actions/runs/"+e.id,"actions/runs/"+e.id+"/attempts/1/jobs?per_page=100","actions/jobs/"+(e.id*10+1)+"/logs","git/commits/"+e.checkout];
  const common=isPrivate?["pulls/"+number,"actions/runs/38261870915"]:["pulls/"+number,"actions/runs/"+packet.evidence.r3Public.run,"actions/runs/"+packet.evidence.authPublic.run];
  const mandatoryRoutes={"--ci-route":[...common,...es.flatMap(proofRoutes)]};
  if(isPrivate)mandatoryRoutes["--journal-route"]=[...common,...proofRoutes(packet.completedRunReuse.completedRuns.journal)];
  return {repository,entry,files,git,api,mandatoryRoutes,event:{pull_request:pr},env,nodeVersion:"22.23.3",mode:"--ci-route",synthetic:true,observedShape:"PR event; read token; merge checkout distinct from head; base-parent1/head-parent2"};
}
async function executeCollectorFixture(fixture,variant="positive"){
  const vm=require("node:vm"),path=require("node:path"),data=JSON.parse(JSON.stringify(fixture)),base=path.resolve("/virtual"),modules=new Map(),routeCounts={};let output="",calls=0;
  if(variant==="journal-positive")data.mode="--journal-route";
  if(variant==="no-token")delete data.env.GH_TOKEN;
  if(variant==="node24")data.nodeVersion="24.0.0";
  if(variant==="loader-override")data.env.NODE_OPTIONS="--require=synthetic-loader";
  if(variant==="offline-override")data.env.TENNISNOTE_REUSE_OFFLINE_BASE="synthetic-offline-root";
  if(variant==="wrong-checkout")data.env.GITHUB_SHA="f".repeat(40);
  if(variant==="wrong-event")data.env.GITHUB_EVENT_NAME="workflow_dispatch";
  if(variant==="wrong-base")data.event.pull_request.base.sha="f".repeat(40);
  if(variant==="wrong-head"){data.event.pull_request.head.sha="f".repeat(40);data.api["pulls/"+data.event.pull_request.number].head.sha="f".repeat(40);}
  if(variant==="wrong-repository")data.env.GITHUB_REPOSITORY="synthetic/foreign";
  if(variant==="wrong-scope"){data.event.pull_request.changed_files++;data.api["pulls/"+data.event.pull_request.number].changed_files++;}
  const isPrivate=data.repository==="leisurewang0827/app-automation-vault",expectedOutput=isPrivate?"scoped=true\nreused=true\n":"scoped=true\nchanged_inputs_required=true\nreused=false\n",requiredRoutes=data.mandatoryRoutes[data.mode];
  assert(Array.isArray(requiredRoutes)&&requiredRoutes.every(route=>Object.hasOwn(data.api,route)),"fixture_required_routes_missing");
  const expectedCounts={};for(const route of requiredRoutes)expectedCounts[route]=(expectedCounts[route]||0)+1;
  let context;const clone=x=>vm.runInContext("JSON.parse("+JSON.stringify(JSON.stringify(x))+")",context);
  const writeOutput=b=>{let text=String(b);if(variant==="output-missing-reused")text=text.replace(/reused=(true|false)\n/g,"");if(variant==="output-wrong-reused")text=text.replace(/reused=(true|false)\n/g,isPrivate?"reused=false\n":"reused=true\n");if(variant==="output-missing-changed")text=text.replace(/changed_inputs_required=(true|false)\n/g,"");if(variant==="output-extra-field")text+="complete=true\n";if(variant==="output-duplicate-field")text+="scoped=true\n";output+=text;};
  const fs={readFileSync:(p,encoding)=>{const full=path.resolve(p);let text;if(full===path.resolve(data.env.GITHUB_EVENT_PATH))text=JSON.stringify(data.event);else{assert(full.startsWith(base+path.sep));const file=full.slice(base.length+1).replace(/\\/g,"/");assert(!file.includes("production_projection"));assert(Object.hasOwn(data.files,file),"fixture_file_missing");text=data.files[file];}return encoding?text:Buffer.from(text);},existsSync:p=>{const file=path.resolve(p).slice(base.length+1).replace(/\\/g,"/");return Object.hasOwn(data.files,file);},appendFileSync:(p,b)=>{assert.equal(path.resolve(p),path.resolve(data.env.GITHUB_OUTPUT));writeOutput(b);}};
  const cp={execFileSync:(exe,args)=>{assert.equal(exe,"git");assert(!args.join(" ").includes("production_projection"));const key=JSON.stringify(args);assert(Object.hasOwn(data.git,key),"fixture_git_route_denied");return data.git[key];}};
  function load(file){if(modules.has(file))return modules.get(file).exports;assert(Object.hasOwn(data.files,file));const module={exports:{}};modules.set(file,module);let text=data.files[file];
    if(file===data.entry&&["early-return","complete-output-no-proof"].includes(variant)){const prefix=/(^|\n)async function main\(\)\{/;assert(prefix.test(text));const emitted=variant==="early-return"?"scoped=true\n":expectedOutput;text=text.replace(prefix,match=>match+"fs.appendFileSync(process.env.GITHUB_OUTPUT,"+JSON.stringify(emitted)+");return;");}
    if(variant==="proof-route-omission"&&text.includes('const run=await read("actions/runs/"+expected.id),jobs='))text=text.replace('const run=await read("actions/runs/"+expected.id),jobs=','const run=fixtureCachedEvidenceRun(expected.id),jobs=');
    if(variant==="proof-chain-short"&&text.includes("async function obtainCompletedProof(expected,read){"))text=text.replace("async function obtainCompletedProof(expected,read){",'async function obtainCompletedProof(expected,read){await read("actions/runs/"+expected.id);return {};');
    if(file===data.entry)text+="\nmodule.exports.fixtureEntry=main;";
    const localRequire=name=>{if(name.startsWith(".")){const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));return load(next);}if(name==="node:fs")return fs;if(name==="node:child_process")return cp;assert(["node:path","node:crypto","node:assert/strict","node:vm"].includes(name));return require(name);};localRequire.main=null;
    vm.runInContext("(function(require,module,__dirname,__filename){"+text+"\n})",context)(localRequire,module,path.dirname(path.join(base,file)),path.join(base,file));return module.exports;
  }
  context=vm.createContext({Buffer,URL,AbortSignal,process:{env:data.env,versions:{node:data.nodeVersion},argv:["node",data.entry,data.mode]},console:{log:()=>{},error:()=>{}},fixtureCachedEvidenceRun:id=>clone(data.api["actions/runs/"+id]),fetch:async url=>{assert(url.startsWith("https://api.github.com/repos/"+data.repository+"/"));const suffix=url.split("/repos/"+data.repository+"/")[1];assert(Object.hasOwn(data.api,suffix),"fixture_api_route_denied");calls++;routeCounts[suffix]=(routeCounts[suffix]||0)+1;const sequence=data.apiSequences?.[suffix],value=sequence?sequence[routeCounts[suffix]-1]:data.api[suffix];assert(value!==undefined,"fixture_api_sequence_exhausted");return{ok:variant!=="api-denied",headers:data.omitPaginationHeaders?undefined:{get:n=>data.apiHeaders?.[suffix]?.[n]||null},json:async()=>clone(value),text:async()=>String(value)};}});
  try{
    await load(data.entry).fixtureEntry();const outputMatches=output===expectedOutput,apiCoverageComplete=Object.keys(expectedCounts).every(route=>(routeCounts[route]||0)>=expectedCounts[route]),apiContractExact=JSON.stringify(Object.entries(routeCounts).sort())===JSON.stringify(Object.entries(expectedCounts).sort());
    const outputFields={};for(const line of output.split("\n").filter(Boolean)){const match=line.match(/^(scoped|reused|changed_inputs_required)=(true|false)$/);if(match&&!Object.hasOwn(outputFields,match[1]))outputFields[match[1]]=match[2]==="true";}
    return{passed:outputMatches&&apiCoverageComplete&&apiContractExact,calls,expectedCalls:requiredRoutes.length,routeCounts,expectedCounts,outputFields,outputMatches,apiCoverageComplete,apiContractExact,oldScopedOnlyDetectorWouldPass:output.includes("scoped=true\n"),network:0,db:0,synthetic:true};
  }catch(error){const allowed=new Set(["collector_node22_required","runtime_loader_override_denied","offline_channel_in_ci_denied","journal_root_override","fixture_api_route_denied","fixture_git_route_denied","fixture_file_missing"]),first=String(error.message).split("\n")[0];const diagnostic=data.grantD?{gate:/^[a-z][a-z0-9_:-]{1,100}$/.test(first)?first:"ASSERTION_GATE",operator:error.operator||null,actualType:typeof error.actual,expectedType:typeof error.expected,lastRoutes:Object.keys(routeCounts).slice(-3)}:null;return{passed:false,calls,errorCode:["ERR_ASSERTION","MODULE_NOT_FOUND"].includes(error.code)?error.code:"FIXTURE_FAILURE",reason:allowed.has(first)?first:"COLLECTOR_GATE_REJECTED",diagnostic,network:0,db:0,synthetic:true};}
}
function buildGrantDCollectorFixture(repository,sourceRoot,authorityRoot,sourceRef,event="pull_request",mode="--ci-route",empty=true){
  const d=buildCollectorFixture(repository,sourceRoot,authorityRoot,sourceRef),privateTarget=repository==="leisurewang0827/app-automation-vault",M1="bd11425153deced09fcff4df441ac947955bf73b",publicParent="b199fcf825b7b27947217b81ed4d46c8e9bc714e",oldPr=privateTarget?596:206,number=privateTarget?607:206,head="c".repeat(40),checkout="d".repeat(40),tree="e".repeat(40),branch=privateTarget?"codex/tennisnote-dev549-historical-binding-fix-20261014":"codex/r3-after-auth548-local-20261013",base=privateTarget?M1:d.event.pull_request.base.sha;
  const put=(a,v)=>d.git[JSON.stringify(a)]=v,oldNumber=privateTarget?596:206,oldCurrent=d.api["pulls/"+oldNumber];
  const pr={number,head:{sha:head,ref:branch,repo:{full_name:repository}},base:{sha:base,ref:privateTarget?"main":"dev",repo:{full_name:repository}},changed_files:privateTarget?3:52,merged:event==="push",merged_at:event==="push"?"2000-01-03T00:00:00Z":null,merge_commit_sha:event==="push"?checkout:null};
  d.event={number,pull_request:pr};d.env.GITHUB_EVENT_NAME=event;d.env.GITHUB_REF=event==="push"?(privateTarget?"refs/heads/main":"refs/heads/dev"):"refs/pull/"+number+"/merge";d.mode=mode;
  d.api["pulls/"+number]=pr;put(["rev-parse","HEAD^1"],base);put(["rev-parse",head+"^1"],privateTarget?M1:publicParent);put(["rev-list","--parents","-n","1",head],head+" "+(privateTarget?M1:publicParent));put(["rev-list","--parents","-n","1","HEAD"],[checkout,base,...(event==="push"?[]:[head])].join(" "));
  if(privateTarget)put(["diff","--name-only",M1,"HEAD"],["scripts/check_tennisnote_r3_auth548_admission.cjs","scripts/check_tennisnote_r3_completed_run_admission.cjs","scripts/fixtures/r3-auth548-private-admission.json"].join("\n"));
  if(event==="push"){d.api["commits/"+checkout+"/pulls"]=[pr];const file=privateTarget?"scripts/fixtures/r3-auth548-private-admission.json":"tests/fixtures/r3-after-auth548-outer-parity.json";put(["show","HEAD^1:"+file],"synthetic-parent-contract\n");}
  const packet=JSON.parse(d.files[privateTarget?"scripts/fixtures/r3-auth548-private-admission.json":"tests/fixtures/r3-after-auth548-outer-parity.json"]),runs=privateTarget?Object.values(packet.completedRunReuse.completedRuns):[packet.completedRunReuse],e=runs[0];
  const original={number:oldPr,head:{sha:privateTarget?"7839d9fe3dfe1c31a465f03e723af549ef491430":publicParent,ref:e.head_branch,repo:{full_name:repository}},base:{sha:e.base,ref:privateTarget?"main":"dev",repo:{full_name:repository}},state:privateTarget?"closed":"open",merged:privateTarget,merged_at:privateTarget?"2000-01-03T00:00:00Z":null,created_at:"2000-01-01T00:00:00Z",commits:privateTarget?4:5};
  const fallback=["commits/"+e.head_sha+"/pulls?per_page=100&page=1","pulls/"+oldPr,"pulls/"+oldPr+"/commits?per_page=100&page=1"];
  if(empty){d.api[fallback[0]]=[original];d.api[fallback[1]]=original;d.api[fallback[2]]=[{sha:e.head_sha},...Array.from({length:original.commits-1},(_,i)=>({sha:(i+1).toString(16).padStart(40,"0")}))];if(!privateTarget)d.api["pulls/206"]=pr;}
  // Public fallback shares pulls/206 with current-context lookup: add all live
  // original-PR identity/time fields to that same response, never replace head.
  if(empty&&!privateTarget)Object.assign(pr,{state:event==="push"?"closed":"open",merged:event==="push",merged_at:event==="push"?"2000-01-03T00:00:00Z":null,created_at:original.created_at,commits:original.commits});
  for(const r of runs){const old=d.api["actions/runs/"+r.id];old.created_at="2000-01-02T00:00:00Z";old.pull_requests=empty?[]:[{number:oldPr,head:{ref:r.head_branch,sha:r.head_sha,repo:{url:"https://api.github.com/repos/"+repository,name:repository.split("/")[1]}},base:{ref:privateTarget?"main":"dev",sha:r.base,repo:{url:"https://api.github.com/repos/"+repository,name:repository.split("/")[1]}}}];}
  const proofRoutes=r=>["actions/runs/"+r.id,"actions/runs/"+r.id+"/attempts/1/jobs?per_page=100","actions/jobs/"+(r.id*10+1)+"/logs","git/commits/"+r.checkout],selected=privateTarget&&mode==="--journal-route"?[packet.completedRunReuse.completedRuns.journal]:runs;
  const common=privateTarget?["pulls/"+number,"actions/runs/38261870915"]:["pulls/206",...Object.entries(packet.evidence).filter(([which])=>["r3Public","authPublic"].includes(which)).map(([,r])=>"actions/runs/"+r.run)];
  d.mandatoryRoutes[mode]=[...(event==="push"?["commits/"+checkout+"/pulls"]:[]),...common,...selected.flatMap(proofRoutes),...(empty?fallback:[])];d.grantD={event,mode,empty,privateTarget,number,head,checkout,base,oldPr,oldHead:e.head_sha};return d;
}
async function grantDActualEntryFocused(repository,sourceRoot,authorityRoot,sourceRef){
  const clone=x=>JSON.parse(JSON.stringify(x)),privateTarget=repository==="leisurewang0827/app-automation-vault";let positive=0,negative=0;const records=[];
  for(const event of ["pull_request","push"])for(const mode of privateTarget?["--ci-route","--journal-route"]:["--ci-route"])for(const empty of [false,true]){
    const fixture=buildGrantDCollectorFixture(repository,sourceRoot,authorityRoot,sourceRef,event,mode,empty),good=await executeCollectorFixture(fixture);assert(good.passed,"grant_d_actual_positive:"+event+":"+mode+":"+empty+":"+(good.reason||"coverage"));positive++;records.push({event,mode,empty,calls:good.calls,mandatoryRoutes:good.expectedCalls,outputExact:good.outputMatches,coverageExact:good.apiContractExact});
    const mutations=[
      d=>d.nodeVersion="24.0.0",d=>delete d.env.GH_TOKEN,d=>d.env.NODE_OPTIONS="--require=synthetic-loader",d=>d.api["pulls/"+d.grantD.number].head.repo.full_name="synthetic/foreign",d=>d.api["pulls/"+d.grantD.number].changed_files++,d=>d.git[JSON.stringify(["rev-parse",d.grantD.head+"^1"]) ]="f".repeat(40)
    ];
    const oldRunId=privateTarget?(mode==="--journal-route"?38394022195:38394022243):38394162701,oldRunKey="actions/runs/"+oldRunId,oldJobsKey=oldRunKey+"/attempts/1/jobs?per_page=100",oldLogKey="actions/jobs/"+(oldRunId*10+1)+"/logs",oldCheckout=fixedCompletedTestCheckout(repository);
    for(const patch of [{id:1},{head_sha:headForNegative()},{workflow_id:1},{path:"synthetic-wrong"},{event:"push"},{run_attempt:2},{conclusion:"failure"},{repository:{full_name:"synthetic/foreign"}},{pull_requests:null}])mutations.push(d=>Object.assign(d.api[oldRunKey],patch));
    mutations.push(d=>{const r=d.api[oldRunKey];r.pull_requests=[{},{}];},d=>d.api[oldJobsKey].jobs=[],d=>d.api[oldJobsKey].jobs[0].steps[0].conclusion="skipped",d=>d.api[oldJobsKey].jobs[0].run_id=1,d=>d.api[oldLogKey]="synthetic-no-checkout-or-runtime",d=>d.api["git/commits/"+oldCheckout].tree.sha=headForNegative(),d=>d.api["git/commits/"+oldCheckout].parents=[],d=>d.api["git/commits/"+oldCheckout].sha=headForNegative());
    if(privateTarget)mutations.push(d=>d.git[JSON.stringify(["diff","--name-only",d.grantD.base,"HEAD"])]+="\nunauthorized-file",d=>d.api["pulls/"+d.grantD.number].number++);
    if(event==="push")mutations.push(d=>d.api["commits/"+d.grantD.checkout+"/pulls"].push(clone(d.api["commits/"+d.grantD.checkout+"/pulls"][0])),d=>d.api["commits/"+d.grantD.checkout+"/pulls"]=[],d=>{d.apiHeaders={["commits/"+d.grantD.checkout+"/pulls"]:{link:"synthetic-next"}};});
    if(empty)mutations.push(
      d=>d.api["commits/"+d.grantD.oldHead+"/pulls?per_page=100&page=1"]=[],d=>{const a=d.api["commits/"+d.grantD.oldHead+"/pulls?per_page=100&page=1"];a.push(clone(a[0]));},
      d=>d.api["pulls/"+d.grantD.oldPr+"/commits?per_page=100&page=1"].shift(),d=>d.api["pulls/"+d.grantD.oldPr].created_at="invalid",
      d=>d.api["pulls/"+d.grantD.oldPr].created_at="2100-01-01T00:00:00Z",d=>{for(const r of Object.values(d.api))if(r&&r.id&&r.created_at)r.created_at="invalid";}
    );
    for(const mutate of mutations){const bad=clone(fixture);mutate(bad);const rejected=await executeCollectorFixture(bad);assert.equal(rejected.passed,false,"grant_d_actual_negative");negative++;}
    for(const variant of ["early-return","complete-output-no-proof","output-missing-reused","output-duplicate-field","proof-route-omission","proof-chain-short"]){const rejected=await executeCollectorFixture(fixture,variant);assert.equal(rejected.passed,false,"grant_d_output_or_route_gate");negative++;}
  }
  return{contract:"grant-d-actual-entry-focused/1",repository,positive,negative,total:positive+negative,records,network:0,db:0,oldSuiteRuns:0,runnerApiPass:false};
}
function fixedCompletedTestCheckout(repository){return repository==="leisurewang0827/app-automation-vault"?"90c3795959daec9ce05734758326df83a0f29a7a":"2c507027fb58a8aaa4ef7862540519e5f7d322a1";}
function headForNegative(){return"f".repeat(40);}
async function grantDStableRepresentationFocused(repository,sourceRoot,authorityRoot,sourceRef){
  const clone=x=>JSON.parse(JSON.stringify(x)),privateTarget=repository==="leisurewang0827/app-automation-vault",url="https://api.github.com/repos/"+repository,name=repository.split("/")[1],positives=[{full_name:repository},{url},{url,name},{full_name:repository,url,name}],negatives=[null,{},[],"synthetic",{name},{full_name:"synthetic/foreign"},{url:"https://api.github.com/repos/synthetic/foreign"},{full_name:repository,url:"https://api.github.com/repos/synthetic/foreign"},{full_name:"synthetic/foreign",url},{url:url+"/"},{url:url.toUpperCase()},{url,name:"foreign"},{full_name:null,url},{full_name:repository,url:null},{url,name:42}];let positive=0,negative=0;const records=[];
  for(const event of ["pull_request","push"])for(const mode of privateTarget?["--ci-route","--journal-route"]:["--ci-route"]){
    const fixture=buildGrantDCollectorFixture(repository,sourceRoot,authorityRoot,sourceRef,event,mode,true),associationKey="commits/"+fixture.grantD.oldHead+"/pulls?per_page=100&page=1",detailKey="pulls/"+fixture.grantD.oldPr;
    const prepare=(associationRep,detailRep,side=null)=>{const d=clone(fixture),details=clone(d.api[detailKey]);for(const s of side?[side]:["head","base"]){d.api[associationKey][0][s].repo=clone(associationRep);details[s].repo=clone(detailRep);}if(privateTarget)d.api[detailKey]=details;else d.apiSequences={[detailKey]:[clone(d.api[detailKey]),details]};return d;};
    for(let i=0;i<positives.length;i++){const result=await executeCollectorFixture(prepare(positives[i],positives[i]));assert(result.passed,"stable_representation_actual_positive:"+event+":"+mode+":"+i);positive++;records.push({event,mode,representation:["full_name_only","url_only","url_name","both"][i],calls:result.calls,mandatoryRoutes:result.expectedCalls,outputExact:result.outputMatches,coverageExact:result.apiContractExact});}
    for(const side of ["head","base"])for(const bad of negatives)for(const surface of ["association","detail"]){const d=prepare(surface==="association"?bad:positives[3],surface==="detail"?bad:positives[3],side),result=await executeCollectorFixture(d);assert.equal(result.passed,false,"stable_representation_actual_negative:"+event+":"+mode+":"+side+":"+surface);negative++;}
  }
  return{contract:"grant-d-stable-fallback-representation-actual-entry/1",repository,positive,negative,total:positive+negative,records,negativeCorpus:negatives.length,surfaces:["oldhead_commit_association","original_pr_detail"],sides:["head","base"],publicCurrentContextFullNamePathPreserved:true,network:0,db:0,oldSuiteRuns:0};
}
// 승인 E: 역사 증거와 별도의 current producer/consumer. 업무 baseline 설정은 private에서 주입합니다.
function recoveryCanonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(recoveryCanonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+recoveryCanonical(value[k])).join(',')+'}';
}
function recoveryDigest(value){return require('node:crypto').createHash('sha256').update(recoveryCanonical(value)).digest('hex');}
function recoveryShape(value,keys,code){assert(value&&typeof value==='object'&&!Array.isArray(value),code);assert.deepEqual(Object.keys(value).sort(),keys.slice().sort(),code);}
function recoveryHash(value,length=64){assert(typeof value==='string'&&new RegExp('^[a-f0-9]{'+length+'}$').test(value),'recovery_hash_shape');return value;}
function recoveryPaths(rows,expected){assert(Array.isArray(rows)&&rows.length===expected.length,'recovery_scope_count');assert.equal(new Set(rows).size,rows.length,'recovery_scope_duplicate');assert.deepEqual(rows.slice().sort(),expected.slice().sort(),'recovery_scope_exact');}
function validateRecoveryBaseline(spec,meta,changes){
  assert.equal(meta.oldCommit,spec.historicalAnchor);assert.equal(meta.oldTree,spec.historicalRootTree);assert.equal(meta.newCommit,spec.currentBase);assert.equal(meta.newTree,spec.currentRootTree);assert.deepEqual(meta.parents,[spec.historicalAnchor]);
  recoveryPaths(changes.map(x=>x.path),spec.baseline.map(x=>x.path));
  for(const row of changes){const known=spec.baseline.find(x=>x.path===row.path);assert.equal(row.changeType,known.changeType);assert.equal(row.mode,'100644','baseline_non_regular');assert(!row.path.includes('production_projection'),'protected_baseline_denied');if(!known.jsonFields)continue;
    const diff=[];const walk=(a,b,p='$')=>{if(recoveryCanonical(a)===recoveryCanonical(b))return;if(Array.isArray(a)&&Array.isArray(b)){assert.equal(a.length,b.length,'baseline_array_changed');a.forEach((v,i)=>walk(v,b[i],p+'[*]'));return;}if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),'baseline_schema_changed');for(const k of Object.keys(a))walk(a[k],b[k],p+'.'+k);return;}assert.equal(typeof a,typeof b,'baseline_type_changed');assert.equal(typeof b,'string','baseline_non_time_value_changed');diff.push({path:p,a,b});};
    walk(row.before,row.after);assert.equal(diff.length,known.changedLeaves,'baseline_leaf_count');assert.deepEqual([...new Set(diff.map(x=>x.path))].sort(),known.jsonFields.slice().sort(),'baseline_leaf_inventory');
    for(const d of diff){if(d.path==='$.steps[*].stdout[*]'){const rx=/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?/g;const aa=[...d.a.matchAll(rx)].map(x=>x[0]),bb=[...d.b.matchAll(rx)].map(x=>x[0]);assert(aa.length>0&&aa.length===bb.length);assert.equal(d.a.replace(rx,'<time>'),d.b.replace(rx,'<time>'),'baseline_stdout_non_time_change');aa.forEach((v,i)=>assert(Number.isFinite(Date.parse(v))&&Number.isFinite(Date.parse(bb[i]))&&Date.parse(v)<=Date.parse(bb[i]),'baseline_time_order'));}
      else{assert(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(d.a)&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(d.b),'baseline_time_format');assert(Number.isFinite(Date.parse(d.a))&&Number.isFinite(Date.parse(d.b))&&Date.parse(d.a)<=Date.parse(d.b),'baseline_time_order');}}
  }return{baselineVerified:true,privateOnly:true};
}
function validateRecoveryCurrentContext(c,p,spec,read){
  assert.equal(c.repository,spec.repository);assert.equal(c.checkout,c.sha);recoveryHash(c.sha,40);recoveryHash(c.headSha,40);assert.equal(c.parent1,spec.currentBase);assert(Number.isSafeInteger(p.number)&&p.number>0&&p.number!==596);assert.equal(p.head?.repo?.full_name,spec.repository);assert.equal(p.base?.repo?.full_name,spec.repository);assert.equal(p.head.ref,spec.branch);assert.equal(p.head.sha,c.headSha);assert.equal(p.base.ref,'main');assert.equal(p.base.sha,spec.currentBase);
  assert.equal(read('rev-list','--parents','-n','1',c.headSha),c.headSha+' '+spec.currentBase,'recovery_direct_parent');assert.equal(read('rev-parse',c.headSha+'^{tree}'),read('rev-parse','HEAD^{tree}'),'recovery_current_tree');recoveryPaths(read('diff','--name-only',spec.currentBase,'HEAD').split('\n').filter(Boolean),spec.ownedPaths);assert.equal(p.changed_files,spec.ownedPaths.length);
  if(c.event==='pull_request'){assert.equal(c.parent2,c.headSha);assert.equal(p.merged,false);assert.equal(c.baseSha,spec.currentBase);assert.equal(c.headBranch,spec.branch);}else{assert.equal(c.event,'push');assert.equal(c.ref,'refs/heads/main');assert.equal(p.merged,true);assert.equal(p.merge_commit_sha,c.sha);assert(p.merged_at);}
  validateNewCallerShape(c,read('rev-list','--parents','-n','1','HEAD').split(/\s+/).length-1);return true;
}
function validateRecoverySourceReceipt(receipt,expected){
  recoveryShape(receipt,['contract','mode','historicalProofPreserved','historicalRunsReexecuted','currentJournalFreshExecuted','currentJournalInheritedFromOld','currentTraceComplete','context','source','recipe','trace','media','negativeChecksPassed'],'recovery_receipt_shape');
  assert.equal(receipt.contract,'dev549-current-journal/1');assert.equal(receipt.mode,'pr-current-journal-produced');assert.equal(receipt.historicalProofPreserved,true);assert.equal(receipt.historicalRunsReexecuted,false);assert.equal(receipt.currentJournalFreshExecuted,true);assert.equal(receipt.currentJournalInheritedFromOld,false);assert.equal(receipt.currentTraceComplete,true);assert.equal(receipt.negativeChecksPassed,true);
  recoveryShape(receipt.context,['repository','workflowId','workflowPath','runId','attempt','pr','head','base','checkout','tree','dashboardTree'],'receipt_context_shape');
  for(const k of ['repository','workflowId','workflowPath','pr','head','base','tree','dashboardTree'])assert.equal(receipt.context[k],expected.context[k],'receipt_context_'+k);
  assert(Number.isSafeInteger(receipt.context.runId)&&receipt.context.runId>0);assert.equal(receipt.context.attempt,1);recoveryHash(receipt.context.checkout,40);for(const k of ['head','base','tree','dashboardTree'])recoveryHash(receipt.context[k],40);
  recoveryPaths(receipt.source.map(x=>x.path),expected.source.map(x=>x.path));for(const f of receipt.source){recoveryShape(f,['path','sha256'],'source_row_shape');assert.equal(f.sha256,expected.source.find(x=>x.path===f.path).sha256);recoveryHash(f.sha256);}
  assert.deepEqual(receipt.recipe,expected.recipe,'current_recipe_changed');assert.deepEqual(receipt.media,{mp4:true,chromium:true,webkit:true},'current_media_not_full_pass');
  const t=receipt.trace;recoveryShape(t,['complete','parserEof','descendantsClosed','channelsClosed','pending','sampleJsonRequests','sampleJsonOpens','unknownAssets','externalEgress','opaque','dropped','sourceOpens','httpRequests','localChannels','runtimeClasses','assets'],'trace_shape');
  recoveryShape(t.runtimeClasses,['system_library','node_runtime','pinned_browser_runtime','owned_runtime_temp','os_configuration','own_proc','device','pinned_node_package','source_directory'],'runtime_class_inventory');for(const n of Object.values(t.runtimeClasses))assert(Number.isSafeInteger(n)&&n>=0,'runtime_class_count');
  for(const k of ['complete','parserEof','descendantsClosed','channelsClosed'])assert.equal(t[k],true,'trace_'+k);for(const k of ['pending','sampleJsonRequests','sampleJsonOpens','unknownAssets','externalEgress','opaque','dropped'])assert.equal(t[k],0,'trace_'+k);for(const k of ['sourceOpens','httpRequests','localChannels'])assert(Number.isSafeInteger(t[k])&&t[k]>0,'trace_positive_'+k);
  assert(Array.isArray(t.assets)&&t.assets.length>0);assert.equal(new Set(t.assets.map(x=>x.path)).size,t.assets.length);for(const a of t.assets){recoveryShape(a,['path','sha256','opens','responses'],'asset_shape');assert(Object.hasOwn(expected.assetMap,a.path),'unknown_current_asset');assert(!a.path.includes('sample_dashboard_data')&&!a.path.includes('config.local')&&!a.path.includes('production_projection'));assert.equal(a.sha256,expected.assetMap[a.path]);assert(Number.isSafeInteger(a.opens)&&a.opens>0);assert(Number.isSafeInteger(a.responses)&&a.responses>=0);}
  return true;
}
function recoveryFrame(receipt){const raw=recoveryCanonical(receipt);assert(Buffer.byteLength(raw)<1024*1024,'receipt_bound');const b64=Buffer.from(raw).toString('base64url'),pieces=b64.match(/.{1,3000}/g)||[],digest=require('node:crypto').createHash('sha256').update(raw).digest('hex');return['DEV549_CURRENT_JOURNAL_BEGIN '+pieces.length,...pieces.map((p,i)=>'DEV549_CURRENT_JOURNAL_ITEM '+i+' '+p),'DEV549_CURRENT_JOURNAL_END '+digest].join('\n')+'\n';}
function readRecoveryFrame(log){
  assert(typeof log==='string'&&Buffer.byteLength(log)<16*1024*1024,'log_bound');const rows=log.split(/\r?\n/).map(l=>l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /,'')),fr=rows.filter(l=>l.startsWith('DEV549_CURRENT_JOURNAL_'));assert(fr.length>=3);assert(/^DEV549_CURRENT_JOURNAL_BEGIN [1-9]\d*$/.test(fr[0]));const n=Number(fr[0].split(' ')[1]);assert(n<=500&&fr.length===n+2);let b64='';for(let i=0;i<n;i++){const r=fr[i+1].match(/^DEV549_CURRENT_JOURNAL_ITEM (\d+) ([A-Za-z0-9_-]{1,3000})$/);assert(r&&Number(r[1])===i,'receipt_frame_order');b64+=r[2];}const end=fr.at(-1).match(/^DEV549_CURRENT_JOURNAL_END ([a-f0-9]{64})$/);assert(end);const raw=Buffer.from(b64,'base64url').toString('utf8');assert(Buffer.byteLength(raw)<1024*1024);assert.equal(require('node:crypto').createHash('sha256').update(raw).digest('hex'),end[1]);const r=JSON.parse(raw);assert.equal(recoveryCanonical(r),raw);return r;
}
function validateRecoveryConsumer(bundle,expected){
  assert.equal(bundle.associations.length,1,'current_merge_association_not_unique');const p=bundle.pr;assert.equal(bundle.associations[0].number,p.number);assert.equal(p.merged,true);assert.equal(p.merge_commit_sha,expected.mainSha);assert.equal(p.head.sha,expected.context.head);assert.equal(p.base.sha,expected.context.base);assert.equal(p.head.ref,expected.branch);assert.equal(p.head.repo.full_name,expected.context.repository);assert.equal(p.base.repo.full_name,expected.context.repository);assert.equal(p.base.ref,'main');assert.equal(p.changed_files,expected.ownedPaths.length);
  assert(Array.isArray(bundle.runs)&&bundle.runs.length===1,'current_pr_run_not_unique');const r=bundle.runs[0];assert.equal(r.id,bundle.run.id);for(const k of ['workflow_id','path','head_sha','head_branch','event','run_attempt','status','conclusion'])assert.equal(r[k],bundle.run[k]);assert.equal(r.workflow_id,expected.context.workflowId);assert.equal(r.path,expected.context.workflowPath);assert.equal(r.head_sha,expected.context.head);assert.equal(r.head_branch,expected.branch);assert.equal(r.event,'pull_request');assert.equal(r.run_attempt,1);assert.equal(r.status,'completed');assert.equal(r.conclusion,'success');assert.equal(r.repository.full_name,expected.context.repository);
  const identity=(repo,full)=>{assert(repo&&typeof repo==='object'&&!Array.isArray(repo)&&(repo.full_name!==undefined||repo.url!==undefined));if(repo.full_name!==undefined)assert.equal(repo.full_name,full);if(repo.url!==undefined)assert.equal(repo.url,'https://api.github.com/repos/'+full);if(repo.name!==undefined)assert.equal(repo.name,full.split('/')[1]);},binding=a=>{assert.equal(a.number,p.number);assert.equal(a.head.sha,p.head.sha);assert.equal(a.base.sha,p.base.sha);assert.equal(a.head.ref,p.head.ref);assert.equal(a.base.ref,'main');identity(a.head.repo,p.head.repo.full_name);identity(a.base.repo,p.base.repo.full_name);};
  assert(Array.isArray(r.pull_requests),'current_pr_array_required');if(r.pull_requests.length===1)binding(r.pull_requests[0]);else{assert.equal(r.pull_requests.length,0);assert.equal(bundle.headAssociations.length,1);binding(bundle.headAssociations[0]);}
  const created=Date.parse(p.created_at),started=Date.parse(r.created_at),finished=Date.parse(r.updated_at),merged=Date.parse(p.merged_at);assert([created,started,finished,merged].every(Number.isFinite)&&created<=started&&started<=finished&&finished<=merged&&merged<=Date.now(),'current_proof_time');
  const js=bundle.jobs.filter(x=>x.name==='candidate-source-admission');assert.equal(js.length,1);const job=js[0];assert.equal(job.run_id,r.id);assert.equal(job.head_sha,r.head_sha);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');for(const name of expected.steps){const ss=job.steps.filter(s=>s.name===name);assert.equal(ss.length,1,'required_step_unique');assert.equal(ss[0].status,'completed');assert.equal(ss[0].conclusion,'success','required_step_not_success');}
  const receipt=readRecoveryFrame(bundle.log);assert.equal(receipt.context.runId,r.id);assert.equal(receipt.context.pr,p.number);assert.equal(bundle.checkoutCommit.sha,receipt.context.checkout);assert.equal(bundle.checkoutCommit.tree.sha,expected.context.tree);assert.deepEqual(bundle.checkoutCommit.parents.map(x=>x.sha),[expected.context.base,expected.context.head],'CURRENT_PR_CHECKOUT_PARENTS');validateRecoverySourceReceipt(receipt,expected);return{mode:'main-consumes-successful-pr-current-proof',JournalExecutedHere:false,receipt};
}
function recoverySelfTest(){
  const clone=x=>JSON.parse(JSON.stringify(x)),a='a'.repeat(40),b='b'.repeat(40),t='c'.repeat(40),q='d'.repeat(40),s='e'.repeat(64),repository='synthetic/recovery',branch='codex/synthetic-recovery';let positive=0,negative=0;const yes=f=>{f();positive++;},no=f=>{assert.throws(f);negative++;};
  const expected={context:{repository,workflowId:1,workflowPath:'.github/workflows/synthetic.yml',pr:7,head:a,base:b,tree:t,dashboardTree:q},source:[{path:'scripts/synthetic.cjs',sha256:s}],recipe:{node:'22',playwright:'1.56.1',commands:['original-media','original-browser']},assetMap:{'90-Dashboard/shared/synthetic.js':s},branch,ownedPaths:['scripts/synthetic.cjs'],steps:['setup','minimum-cap','sdk','browser-cap','actual','negative','final'],mainSha:'f'.repeat(40)};
  const receipt={contract:'dev549-current-journal/1',mode:'pr-current-journal-produced',historicalProofPreserved:true,historicalRunsReexecuted:false,currentJournalFreshExecuted:true,currentJournalInheritedFromOld:false,currentTraceComplete:true,context:{...expected.context,runId:12,attempt:1,checkout:'1'.repeat(40)},source:clone(expected.source),recipe:clone(expected.recipe),trace:{complete:true,parserEof:true,descendantsClosed:true,channelsClosed:true,pending:0,sampleJsonRequests:0,sampleJsonOpens:0,unknownAssets:0,externalEgress:0,opaque:0,dropped:0,sourceOpens:1,httpRequests:1,localChannels:1,runtimeClasses:Object.fromEntries(['system_library','node_runtime','pinned_browser_runtime','owned_runtime_temp','os_configuration','own_proc','device','pinned_node_package','source_directory'].map(k=>[k,0])),assets:[{path:'90-Dashboard/shared/synthetic.js',sha256:s,opens:1,responses:1}]},media:{mp4:true,chromium:true,webkit:true},negativeChecksPassed:true};
  yes(()=>validateRecoverySourceReceipt(receipt,expected));yes(()=>assert.deepEqual(readRecoveryFrame(recoveryFrame(receipt)),receipt));
  const mutations=[r=>r.mode='historical-only',r=>r.currentJournalFreshExecuted=false,r=>r.currentJournalInheritedFromOld=true,r=>r.historicalRunsReexecuted=true,r=>r.negativeChecksPassed=false,r=>r.context.attempt=2,r=>r.context.tree=a,r=>r.context.pr=8,r=>r.source[0].sha256='f'.repeat(64),r=>r.source.push(clone(r.source[0])),r=>r.recipe.node='24',r=>r.media.webkit=false,r=>r.trace.complete=false,r=>r.trace.parserEof=false,r=>r.trace.channelsClosed=false,r=>r.trace.descendantsClosed=false,r=>r.trace.pending=1,r=>r.trace.sampleJsonRequests=1,r=>r.trace.sampleJsonOpens=1,r=>r.trace.unknownAssets=1,r=>r.trace.externalEgress=1,r=>r.trace.opaque=1,r=>r.trace.dropped=1,r=>r.trace.sourceOpens=0,r=>r.trace.httpRequests=0,r=>r.trace.localChannels=0,r=>r.trace.assets[0].opens=0,r=>r.trace.assets[0].sha256='f'.repeat(64),r=>r.trace.assets[0].path='unknown',r=>r.trace.assets.push(clone(r.trace.assets[0])),r=>r.secret='synthetic-forbidden'];
  for(const mutate of mutations){const r=clone(receipt);mutate(r);no(()=>validateRecoverySourceReceipt(r,expected));}
  for(const mutate of [r=>delete r.trace.runtimeClasses,r=>r.trace.runtimeClasses.unknown=1,r=>r.trace.runtimeClasses.own_proc=-1]){const r=clone(receipt);mutate(r);no(()=>validateRecoverySourceReceipt(r,expected));}
  const frame=recoveryFrame(receipt);for(const bad of [frame+frame,frame.replace('ITEM 0','ITEM 1'),frame.replace(/END [a-f0-9]{64}/,'END '+'0'.repeat(64)),frame.replace(/^.*ITEM.*\n/m,''),frame.slice(0,-10)])no(()=>readRecoveryFrame(bad));
  const repo={full_name:repository},p={number:7,merged:true,merge_commit_sha:expected.mainSha,head:{repo,ref:branch,sha:a},base:{repo,ref:'main',sha:b},changed_files:1,created_at:new Date(0).toISOString(),merged_at:new Date(3000).toISOString()},run={id:12,repository:repo,workflow_id:1,path:expected.context.workflowPath,head_sha:a,head_branch:branch,event:'pull_request',run_attempt:1,status:'completed',conclusion:'success',pull_requests:[{number:7,head:{repo,sha:a,ref:branch},base:{repo,sha:b,ref:'main'}}],created_at:new Date(1000).toISOString(),updated_at:new Date(2000).toISOString()},job={id:13,run_id:12,head_sha:a,name:'candidate-source-admission',status:'completed',conclusion:'success',steps:expected.steps.map(name=>({name,status:'completed',conclusion:'success'}))};
  const bundle={associations:[{number:7}],headAssociations:[clone(p)],pr:p,runs:[run],run,jobs:[job],checkoutCommit:{sha:receipt.context.checkout,tree:{sha:t},parents:[{sha:b},{sha:a}]},log:frame};yes(()=>assert.equal(validateRecoveryConsumer(bundle,expected).JournalExecutedHere,false));yes(()=>{const x=clone(bundle);x.run.pull_requests=[];x.runs[0].pull_requests=[];validateRecoveryConsumer(x,expected);});
  for(const change of [x=>x.associations=[],x=>x.associations.push({number:7}),x=>x.runs.push(clone(x.runs[0])),x=>x.run.run_attempt=2,x=>x.run.conclusion='failure',x=>x.run.event='push',x=>{x.run.pull_requests=null;x.runs[0].pull_requests=null;},x=>{x.run.pull_requests=[];x.runs[0].pull_requests=[];x.headAssociations=[];},x=>x.jobs.push(clone(x.jobs[0])),x=>x.jobs[0].conclusion='skipped',x=>x.jobs[0].steps.pop(),x=>x.jobs[0].steps[0].conclusion='failure',x=>x.pr.head.sha=b,x=>x.pr.merge_commit_sha=a,x=>x.pr.changed_files=2,x=>x.log=frame+frame]){const x=clone(bundle);change(x);no(()=>validateRecoveryConsumer(x,expected));}
  const spec={historicalAnchor:a,historicalRootTree:b,currentBase:t,currentRootTree:q,baseline:[{path:'synthetic.json',changeType:'MODIFIED',jsonFields:['$.generated_at'],changedLeaves:1}]},meta={oldCommit:a,oldTree:b,newCommit:t,newTree:q,parents:[a]},rows=[{path:'synthetic.json',changeType:'MODIFIED',mode:'100644',before:{generated_at:new Date(0).toISOString(),stableCount:1},after:{generated_at:new Date(1000).toISOString(),stableCount:1}}];yes(()=>validateRecoveryBaseline(spec,meta,rows));for(const change of [x=>x[0].after.stableCount=2,x=>x[0].after.extra=true,x=>x[0].after.generated_at='invalid',x=>x[0].mode='120000',x=>x.push(clone(x[0])),x=>x[0].path='unknown']){const x=clone(rows);change(x);no(()=>validateRecoveryBaseline(spec,meta,x));}no(()=>validateRecoveryBaseline(spec,{...meta,parents:[a,b]},rows));
  return{positive,negative,synthetic:true,actualTrace:false,oldSuiteRuns:0,network:0,db:0};
}

// END SHARED COMPLETED RUN GUARD
const git=(...args)=>cp.execFileSync("git",args,{cwd:outer.root,encoding:"utf8",maxBuffer:16e6}).trim();
// 승인 E의 단 한 predecessor만 허용한다. 기존 D direct-b199 계약과 분리.
const E_CHAIN=Object.freeze({anchor:'b199fcf825b7b27947217b81ed4d46c8e9bc714e',anchorTree:'4200768bb0a3b1eaf71e407d8ad6410fca7c0bfc',predecessor:'ad7ca0fc86b08e8511d6fbab2e4d44aa4159aa56',predecessorTree:'0e1a09b6b49fd6173e12e1ebe48f4ea1c5e5ef70',base:'582ebd00f31654233ecc77c1bf2efdd4fde0beec',workflow:329932540,paths:Object.freeze(['scripts/check_tennisnote_r3_auth548_provenance.cjs','tests/helpers/r3-auth548-outer-port.cjs','tests/fixtures/r3-after-auth548-outer-parity.json','tests/r3-auth549-completed-run-admission.test.js'])});
// A strict direct-child bridge for the already frozen public head. This is not
// a relaxation of E or legacy D: it pins the exact b0 commit, root tree, and
// E predecessor, then admits only the same four regular-file paths.
const B0_CHILD=Object.freeze({commit:'b0c6cfb8979576710b3c9bd4a5c6f9448c4f517e',tree:'e4f0ab912866c82ae07010cffe370cccf9cd6c98',parent:E_CHAIN.predecessor,base:E_CHAIN.base,paths:E_CHAIN.paths});
// Exact successor bridge from the already verified c4 public head.
const C4_CHILD=Object.freeze({commit:'c4b836b31ccf9f84a088ac06e1ad02bf8bfdadbe',tree:'7400f2bbf703779dd3475a3396b6c2081100b076',parent:B0_CHILD.commit,base:B0_CHILD.base,paths:B0_CHILD.paths,directPaths:Object.freeze([B0_CHILD.paths[0],B0_CHILD.paths[3]])});
function validateRegularBlobDelta(raw,expected,code){
  assert.equal(typeof raw,'string',code);const rows=raw.split(/\r?\n/).filter(Boolean),paths=rows.map(row=>{const match=row.match(/^:100644 100644 [a-f0-9]{40} [a-f0-9]{40} M\t(.+)$/);assert(match,code);return match[1];});recoveryPaths(paths,expected);return true;
}
function validateB0ChildContext(c,p,read){
  validateContext(c);validateNewCallerShape(c,read('rev-list','--parents','-n','1','HEAD').split(/\s+/).length-1);assert.equal(p.number,206);assert.equal(p.head?.repo?.full_name,REPOSITORY);assert.equal(p.base?.repo?.full_name,REPOSITORY);assert.equal(p.head.ref,BRANCH);assert.equal(p.base.ref,'dev');assert.equal(p.base.sha,B0_CHILD.base);assert.equal(p.head.sha,c.headSha);assert.equal(p.changed_files,52);
  recoveryHash(c.headSha,40);assert.equal(read('rev-list','--parents','-n','1',B0_CHILD.commit),B0_CHILD.commit+' '+B0_CHILD.parent,'b0_anchor_parent');assert.equal(read('rev-parse',B0_CHILD.commit+'^{tree}'),B0_CHILD.tree,'b0_anchor_tree');assert.equal(read('rev-parse',c.headSha+'^1'),B0_CHILD.commit,'public_b0_child_parent_mismatch');assert.equal(read('rev-list','--parents','-n','1',c.headSha),c.headSha+' '+B0_CHILD.commit,'public_b0_child_parent_count');
  validateCurrentAssociation(c,p,read('rev-parse',c.headSha+'^{tree}'),read('rev-parse','HEAD^{tree}'));validateRegularBlobDelta(read('diff','--raw','--no-ext-diff','--no-renames','--abbrev=40',B0_CHILD.commit,c.headSha),B0_CHILD.paths,'public_b0_child_direct_delta');const total=read('diff','--name-only',B0_CHILD.base,c.headSha).split('\n').filter(Boolean);assert.equal(total.length,52,'public_b0_child_total52');assert.equal(new Set(total).size,52,'public_b0_child_total_duplicate');
  if(c.event==='pull_request'){assert.equal(p.state,'open');assert.equal(p.merged,false);assert.equal(c.parent2,c.headSha);}else{assert.equal(c.event,'push');assert.equal(c.ref,'refs/heads/dev');assert.equal(p.merged,true);assert.equal(p.merge_commit_sha,c.sha);assert(p.merged_at);}return true;
}
function validateC4ChildContext(c,p,read){
  validateContext(c);validateNewCallerShape(c,read('rev-list','--parents','-n','1','HEAD').split(/\s+/).length-1);assert.equal(p.number,206);assert.equal(p.head?.repo?.full_name,REPOSITORY);assert.equal(p.base?.repo?.full_name,REPOSITORY);assert.equal(p.head.ref,BRANCH);assert.equal(p.base.ref,'dev');assert.equal(p.base.sha,C4_CHILD.base);assert.equal(p.head.sha,c.headSha);assert.equal(p.changed_files,52);
  recoveryHash(c.headSha,40);assert.equal(read('rev-list','--parents','-n','1',C4_CHILD.commit),C4_CHILD.commit+' '+C4_CHILD.parent,'c4_anchor_parent');assert.equal(read('rev-parse',C4_CHILD.commit+'^{tree}'),C4_CHILD.tree,'c4_anchor_tree');assert.equal(read('rev-parse',c.headSha+'^1'),C4_CHILD.commit,'public_c4_child_parent_mismatch');assert.equal(read('rev-list','--parents','-n','1',c.headSha),c.headSha+' '+C4_CHILD.commit,'public_c4_child_parent_count');
  assert.deepEqual(C4_CHILD.paths,B0_CHILD.paths,'c4_public4_envelope_drift');assert.deepEqual(C4_CHILD.directPaths,[C4_CHILD.paths[0],C4_CHILD.paths[3]],'c4_exact_pt_paths');validateCurrentAssociation(c,p,read('rev-parse',c.headSha+'^{tree}'),read('rev-parse','HEAD^{tree}'));validateRegularBlobDelta(read('diff','--raw','--no-ext-diff','--no-renames','--abbrev=40',C4_CHILD.commit,c.headSha),C4_CHILD.directPaths,'public_c4_child_direct_delta');const total=read('diff','--name-only',C4_CHILD.base,c.headSha).split('\n').filter(Boolean);assert.equal(total.length,52,'public_c4_child_total52');assert.equal(new Set(total).size,52,'public_c4_child_total_duplicate');
  if(c.event==='pull_request'){assert.equal(p.state,'open');assert.equal(p.merged,false);assert.equal(c.parent2,c.headSha);}else{assert.equal(c.event,'push');assert.equal(c.ref,'refs/heads/dev');assert.equal(p.merged,true);assert.equal(p.merge_commit_sha,c.sha);assert(p.merged_at);}return true;
}
function validateEChainContext(c,p,read){
  validateContext(c);validateNewCallerShape(c,read('rev-list','--parents','-n','1','HEAD').split(/\s+/).length-1);assert.equal(p.number,206);assert.equal(p.head?.repo?.full_name,REPOSITORY);assert.equal(p.base?.repo?.full_name,REPOSITORY);assert.equal(p.head.ref,BRANCH);assert.equal(p.base.ref,'dev');assert.equal(p.base.sha,E_CHAIN.base);assert.equal(p.head.sha,c.headSha);assert.equal(p.changed_files,52);
  recoveryHash(c.headSha,40);assert.notEqual(c.headSha,E_CHAIN.predecessor);assert.equal(read('rev-list','--parents','-n','1',c.headSha),c.headSha+' '+E_CHAIN.predecessor,'e_chain_exact_parent');assert.equal(read('rev-list','--parents','-n','1',E_CHAIN.predecessor),E_CHAIN.predecessor+' '+E_CHAIN.anchor,'e_chain_predecessor_parent');assert.equal(read('rev-parse',E_CHAIN.predecessor+'^{tree}'),E_CHAIN.predecessorTree);assert.equal(read('rev-parse',E_CHAIN.anchor+'^{tree}'),E_CHAIN.anchorTree);
  validateCurrentAssociation(c,p,read('rev-parse',c.headSha+'^{tree}'),read('rev-parse','HEAD^{tree}'));recoveryPaths(read('diff','--name-only',E_CHAIN.anchor,c.headSha).split('\n').filter(Boolean),E_CHAIN.paths);const total=read('diff','--name-only',E_CHAIN.base,c.headSha).split('\n').filter(Boolean);assert.equal(total.length,52);assert.equal(new Set(total).size,52,'e_chain_total_duplicate');
  if(c.event==='pull_request'){assert.equal(p.state,'open');assert.equal(p.merged,false);assert.equal(c.parent2,c.headSha);}else{assert.equal(c.event,'push');assert.equal(c.ref,'refs/heads/dev');assert.equal(p.merged,true);assert.equal(p.merge_commit_sha,c.sha);assert(p.merged_at);}return true;
}
function validateECurrentCheckpoint(c,p,env,run,data){
  assert.equal(env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(env.GITHUB_EVENT_NAME,c.event);assert.equal(env.GITHUB_SHA,c.sha);assert.equal(env.GITHUB_RUN_ATTEMPT,'1');assert.equal(env.GITHUB_JOB,'build-and-check');assert.equal(env.GITHUB_WORKFLOW,'Tennis Note Public PWA CI');assert(/^\d+$/.test(env.GITHUB_RUN_ID||''));const id=Number(env.GITHUB_RUN_ID);assert(Number.isSafeInteger(id)&&id>0);assert.equal(run.id,id);assert.equal(run.repository?.full_name,REPOSITORY);assert.equal(run.workflow_id,E_CHAIN.workflow);assert.equal(run.path,'.github/workflows/tennisnote-public-ci.yml');assert.equal(run.run_attempt,1);assert.equal(run.event,c.event);assert.equal(run.head_sha,c.event==='pull_request'?p.head.sha:c.sha);assert.equal(run.head_branch,c.event==='pull_request'?BRANCH:'dev');assert.equal(run.status,'in_progress');assert.equal(run.conclusion,null);
  assert(Number.isSafeInteger(data.total_count)&&data.total_count<=100&&data.jobs.length===data.total_count);const jobs=data.jobs.filter(j=>j.name==='build-and-check');assert.equal(jobs.length,1,'e_current_job_unique');const job=jobs[0];assert.equal(job.run_id,id);assert.equal(job.head_sha,run.head_sha);assert.equal(job.status,'in_progress');assert.equal(job.conclusion,null);const steps=job.steps.filter(s=>s.name==='Select exact R3/Auth source checkpoint');assert.equal(steps.length,1);assert.equal(steps[0].status,'in_progress');assert.equal(steps[0].conclusion,null);return true;
}
async function requireECurrentCheckpoint(c,p){
  const env=process.env;assert(/^\d+$/.test(env.GITHUB_RUN_ID||''));const run=await api('actions/runs/'+env.GITHUB_RUN_ID);assert(env.GH_TOKEN);const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/actions/runs/'+env.GITHUB_RUN_ID+'/attempts/1/jobs?per_page=100',{headers:{Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000),redirect:'error'});assert(response.ok,'e_current_jobs_unavailable');assert(response.headers&&typeof response.headers.get==='function');assert.equal(response.headers.get('link')||'','','e_current_jobs_pagination');return validateECurrentCheckpoint(c,p,env,run,await response.json());
}
async function api(suffix){
  assert(suffix==="pulls/206"||/^(actions\/runs\/\d+|commits\/[a-f0-9]{40}\/pulls)$/.test(suffix));assert(process.env.GH_TOKEN,"read_only_api_access_missing");
  const result=await fetch("https://api.github.com/repos/"+REPOSITORY+"/"+suffix,{headers:{Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000)});
  assert(result.ok,"read_only_evidence_unconfirmed");if(suffix.startsWith("commits/")){assert(result.headers&&typeof result.headers.get==="function","current_association_pagination_missing");assert.equal(result.headers.get("link")||"", "", "current_association_pagination_unconfirmed");}return result.json();
}
async function routeCi(){
  const env=process.env,event=env.GITHUB_EVENT_NAME,ref=env.GITHUB_REF;
  const payload=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,"utf8"));let scoped=false,context,currentPr,changedInputsRequired=false,changedInputsBaseline;
  if(event==="pull_request"&&payload.pull_request?.head?.ref===BRANCH){
    const p=payload.pull_request;currentPr=p;context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),baseRepository:p.base.repo.full_name,headRepository:p.head.repo.full_name,baseRef:p.base.ref,baseSha:p.base.sha,headRef:p.head.ref,headSha:p.head.sha,parent1:git("rev-parse","HEAD^1"),parent2:git("rev-parse","HEAD^2")};scoped=true;
  }else if(event==="push"&&ref==="refs/heads/dev"){
    assert.equal(env.GITHUB_REPOSITORY,REPOSITORY);
    const prs=await api("commits/"+env.GITHUB_SHA+"/pulls"),p=selectUniqueMergedAssociation(prs,env.GITHUB_SHA,[BRANCH]);
    fixedPushSourceArrival([{path:"tests/fixtures/r3-after-auth548-outer-parity.json",sha256:outer.sha(fs.readFileSync(path.join(outer.root,"tests/fixtures/r3-after-auth548-outer-parity.json")))}],outer.root,Boolean(p));if(p){currentPr=p;context={repository:env.GITHUB_REPOSITORY,event,ref,sha:env.GITHUB_SHA,checkout:git("rev-parse","HEAD"),parent1:git("rev-parse","HEAD^1"),merged:true,mergeCommit:p.merge_commit_sha,headRepository:p.head.repo.full_name,headRef:p.head.ref};scoped=true;requirePublishable()}
  }
  if(scoped){
    currentPr=await api("pulls/206");context.headSha=currentPr.head.sha;const headParent=git('rev-parse',context.headSha+'^1');
    if(headParent===E_CHAIN.predecessor){changedInputsBaseline=E_CHAIN.predecessor;validateEChainContext(context,currentPr,git);await requireECurrentCheckpoint(context,currentPr);}
    else if(headParent===B0_CHILD.commit){changedInputsBaseline=B0_CHILD.commit;validateB0ChildContext(context,currentPr,git);await requireECurrentCheckpoint(context,currentPr);}
    else if(headParent===C4_CHILD.commit){changedInputsBaseline=C4_CHILD.commit;validateC4ChildContext(context,currentPr,git);await requireECurrentCheckpoint(context,currentPr);}
    else{changedInputsBaseline=B0_CHILD.commit;validateContext(context);validateCurrentAssociation(context,currentPr,git("rev-parse",context.headSha+"^{tree}"),git("rev-parse","HEAD^{tree}"));validateNewCallerShape(context,git("rev-list","--parents","-n","1","HEAD").split(/\s+/).length-1);assert.equal(headParent,"b199fcf825b7b27947217b81ed4d46c8e9bc714e","public_grant_d_parent_mismatch");assert.equal(git("rev-list","--parents","-n","1",context.headSha).split(/\s+/).length,2,"public_grant_d_parent_count");const direct=git("diff","--name-only","b199fcf825b7b27947217b81ed4d46c8e9bc714e","HEAD").split("\n").filter(Boolean),allowed=["scripts/check_tennisnote_r3_auth548_provenance.cjs","tests/helpers/r3-auth548-outer-port.cjs","tests/fixtures/r3-after-auth548-outer-parity.json","tests/r3-auth549-completed-run-admission.test.js"];assert(direct.length>=1&&direct.length<=4&&new Set(direct).size===direct.length&&direct.every(f=>allowed.includes(f)),"public_grant_d_direct_scope");}
    outer.validateSource();for(const which of ["r3Public","authPublic"])validateEvidence(which,await api("actions/runs/"+outer.contract.evidence[which].run));const impact=await provePublicChangedInputDelta(changedInputsBaseline);assert.equal(impact.oldSuiteReusable,false);changedInputsRequired=true;
  }
  if(!scoped&&event==="pull_request")fixedPushSourceArrival([{path:"tests/fixtures/r3-after-auth548-outer-parity.json",sha256:outer.sha(fs.readFileSync(path.join(outer.root,"tests/fixtures/r3-after-auth548-outer-parity.json")))}],outer.root,false);
  fs.appendFileSync(env.GITHUB_OUTPUT,"scoped="+String(scoped)+"\nchanged_inputs_required="+String(changedInputsRequired)+"\nreused=false\n");console.log(scoped?"R3_AUTH_CHANGED_INPUT_DELTA_REQUIRED":"STANDARD_VERIFICATION_REQUIRED");return scoped;
}
function validateCollectorRuntime(){assert(/^22\./.test(process.versions.node),"collector_node22_required");return true;}
async function main(){
  validateCollectorRuntime();
  const mode=process.argv[2];
  if(mode==="--ci-route")return routeCi();
  if(mode==="--deploy"){
    assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_REF,"refs/heads/dev");
    requirePublishable();outer.validateSource();
    validateSql5RuntimeReceipt(process.env.TENNISNOTE_R3_CAPABILITY_RECEIPT||"",process.env.DEV_R3_CAPABILITY_RECEIPT_SHA256||"");
    await proveShallowDeployment();return;
  }
  assert.equal(mode,"--local");console.log(JSON.stringify(outer.validateSource()));
}
module.exports={validateContext,validateEvidence,requirePublishable,validateRuntimeReceipt,validateSql5RuntimeReceipt,fixedCompletedAuthority,validateNewCallerShape,validateCurrentAssociation,validateCompletedRun,validateCheckoutLog,validateInfrastructureDelta,currentInfrastructure,buildCollectorFixture,executeCollectorFixture,validateUnchangedInputs,completedApi,obtainCompletedProof,validatePublicInputImpact,sharedCompletedGuardHash,classifyPushSourceArrival,fixedPushSourceArrival,validateShallowDeploymentBundle,obtainShallowDeploymentProof,validateCurrentDeltaRun,readLocalDeploymentCheckout,REPOSITORY,BRANCH,BASE,B0_CHILD,validateB0ChildContext,validateRegularBlobDelta};
module.exports.C4_CHILD=C4_CHILD;
module.exports.validateC4ChildContext=validateC4ChildContext;
module.exports.validateStableHistoricalBinding=validateStableHistoricalBinding;
module.exports.validateMaintenanceAssociation=validateMaintenanceAssociation;
module.exports.selectUniqueMergedAssociation=selectUniqueMergedAssociation;
module.exports.buildGrantDCollectorFixture=buildGrantDCollectorFixture;
module.exports.grantDActualEntryFocused=grantDActualEntryFocused;
module.exports.grantDStableRepresentationFocused=grantDStableRepresentationFocused;
if(require.main===module)main().catch(()=>{console.error("R3_AUTH_PROVENANCE_FAIL");process.exitCode=1});
// 새 changed-input delta. 기계적 준비가 아래를 기존 authority wrapper 뒤에 붙인다.
function validatePublicInputImpact(before,after,texts,baselineCommit){
  const withoutFiles=c=>{const result=JSON.parse(JSON.stringify(c));delete result.files;delete result.completedRunReuse;return result;};
  assert.deepEqual(withoutFiles(after),withoutFiles(before),"legacy_authority_metadata_changed");
  const sql5Child={contract:"r3-development-readonly-capability-sql5-extension/1",migrations:SQL5_RUNTIME_MIGRATIONS};
  const sql5Epoch=baselineCommit===C4_CHILD.commit?"present":([E_CHAIN.predecessor,B0_CHILD.commit].includes(baselineCommit)?"absent":null);
  assert(sql5Epoch,"unsupported_completed_run_baseline");
  const beforeHasSql5=Object.hasOwn(before.completedRunReuse,"sql5RuntimeAdmission");
  assert.equal(beforeHasSql5,sql5Epoch==="present","baseline_sql5_epoch_mismatch");
  if(beforeHasSql5)assert.deepEqual(before.completedRunReuse.sql5RuntimeAdmission,sql5Child,"baseline_sql5_child_contract_mismatch");
  assert.deepEqual(after.completedRunReuse.sql5RuntimeAdmission,sql5Child,"sql5_child_contract_mismatch");
  const withoutSql5=c=>{const result=JSON.parse(JSON.stringify(c));delete result.sql5RuntimeAdmission;return result;};
  assert.deepEqual(withoutSql5(after.completedRunReuse),withoutSql5(before.completedRunReuse),"completed_run_authority_changed");
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
  const deploy=texts.currentProvenance.slice(texts.currentProvenance.indexOf('if(mode==="--deploy")'),texts.currentProvenance.indexOf('assert.equal(mode,"--local")'));
  assert(deploy.includes("validateSql5RuntimeReceipt("),"deploy_sql5_validator_missing");assert(!deploy.includes("validateRuntimeReceipt("),"deploy_legacy_receipt_path_retained");
  for(const snippet of after.completedRunReuse.commandSnippets){assert(texts.oldCi.includes(snippet));assert.equal(texts.currentCi.split(snippet).length,texts.oldCi.split(snippet).length,"old_command_changed");}
  // Whole public12 input graph changes at its direct loader/fixture/provenance imports.
  // Thus old12 is historical authority only, NOT a new whole-suite reuse attestation.
  return{oldSuiteReusable:false,changedInputValidationRequired:true,productAndGoldenDelta:0,changedInputPaths:after.completedRunReuse.changedInputPaths};
}
async function provePublicChangedInputDelta(baselineCommit=outer.contract.completedRunReuse.head_sha){
  assert(/^[a-f0-9]{40}$/.test(baselineCommit),"changed_input_baseline_sha");
  const e=outer.contract.completedRunReuse;assert.equal(e.sharedGuardSha256,sharedCompletedGuardHash());
  currentInfrastructure(e,outer.root,git);
  const old=(file)=>git("show",baselineCommit+":"+file),current=(file)=>fs.readFileSync(path.join(outer.root,file),"utf8").replace(/\r\n/g,"\n");
  const fixture="tests/fixtures/r3-after-auth548-outer-parity.json",helper="tests/helpers/r3-auth548-outer-port.cjs",ci=".github/workflows/tennisnote-public-ci.yml",provenance="scripts/check_tennisnote_r3_auth548_provenance.cjs";
  const oldContractRaw=old(fixture)+"\n",currentContractRaw=current(fixture);
  const impact=validatePublicInputImpact(JSON.parse(oldContractRaw),outer.contract,{oldContractRaw,currentContractRaw,oldHelper:old(helper)+"\n",currentHelper:current(helper),oldCi:old(ci)+"\n",currentCi:current(ci),oldProvenance:old(provenance)+"\n",currentProvenance:current(provenance)},baselineCommit);
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
  const associated=selectUniqueMergedAssociation(bundle.associations,local.sha,[BRANCH]);assert(associated&&associated.number===206,"deployment_merge_admission_missing");
  const commit=bundle.currentCommit,pr=bundle.pr;assert.equal(commit.sha,local.sha);assert.equal(commit.tree?.sha,local.tree);assert.equal(commit.parents.length,1);
  const context={repository:REPOSITORY,event:"push",ref:local.ref,sha:local.sha,checkout:local.checkout,parent1:commit.parents[0].sha,merged:true,mergeCommit:pr.merge_commit_sha,headRepository:pr.head.repo.full_name,headRef:pr.head.ref,headSha:pr.head.sha};
  validateContext(context);validateNewCallerShape(context,1);assert.equal(bundle.headCommit.sha,pr.head.sha);if(bundle.headCommit.parents?.[0]?.sha===E_CHAIN.predecessor){
    assert.equal(associated.head?.sha,pr.head.sha,'deployment_e_association_head');assert.equal(associated.base?.sha,E_CHAIN.base);assert.equal(associated.base?.ref,'dev');for(const side of [associated.head,associated.base]){assert(side.repo&&(side.repo.full_name!==undefined||side.repo.url!==undefined));if(side.repo.full_name!==undefined)assert.equal(side.repo.full_name,REPOSITORY);if(side.repo.url!==undefined)assert.equal(side.repo.url,'https://api.github.com/repos/'+REPOSITORY);if(side.repo.name!==undefined)assert.equal(side.repo.name,REPOSITORY.split('/')[1]);}
    assert.notEqual(pr.head.sha,E_CHAIN.predecessor);assert.deepEqual(bundle.headCommit.parents.map(p=>p.sha),[E_CHAIN.predecessor],'deployment_e_chain_parent');assert.equal(bundle.predecessorCommit?.sha,E_CHAIN.predecessor);assert.equal(bundle.predecessorCommit.tree?.sha,E_CHAIN.predecessorTree);assert.deepEqual(bundle.predecessorCommit.parents.map(p=>p.sha),[E_CHAIN.anchor],'deployment_e_predecessor_parent');assert.equal(bundle.anchorCommit?.sha,E_CHAIN.anchor);assert.equal(bundle.anchorCommit.tree?.sha,E_CHAIN.anchorTree);assert.equal(bundle.anchorTree?.sha,E_CHAIN.anchorTree);assert.equal(bundle.anchorTree.truncated,false);const leaves=rows=>{const result={};for(const row of rows){assert(!Object.hasOwn(result,row.path));assert(['blob','tree','commit'].includes(row.type));if(row.type!=='tree')result[row.path]=row.type+':'+row.mode+':'+row.sha;}return result;},a=leaves(bundle.anchorTree.tree),b=leaves(bundle.currentTree.tree),changed=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(p=>a[p]!==b[p]);recoveryPaths(changed,E_CHAIN.paths);for(const p of changed){assert(a[p]?.startsWith('blob:100644:')&&b[p]?.startsWith('blob:100644:'),'deployment_e_changed_mode');}validateCurrentAssociation(context,pr,bundle.headCommit.tree?.sha,local.tree);assert.equal(commit.parents[0].sha,E_CHAIN.base,'deployment_e_base');
  }else if(bundle.headCommit.parents?.[0]?.sha===B0_CHILD.commit){
    assert.deepEqual(bundle.headCommit.parents.map(p=>p.sha),[B0_CHILD.commit],'deployment_b0_child_parent');assert.equal(bundle.b0Commit?.sha,B0_CHILD.commit,'deployment_b0_anchor_sha');assert.deepEqual(bundle.b0Commit.parents?.map(p=>p.sha),[B0_CHILD.parent],'deployment_b0_anchor_parent');assert.equal(bundle.b0Commit.tree?.sha,B0_CHILD.tree,'deployment_b0_anchor_tree');assert.equal(bundle.b0Tree?.sha,B0_CHILD.tree,'deployment_b0_tree_root');assert.equal(bundle.b0Tree.truncated,false,'deployment_b0_tree_pagination');
    assert.equal(associated.head?.sha,pr.head.sha,'deployment_b0_association_head');assert.equal(associated.base?.sha,B0_CHILD.base);assert.equal(associated.base?.ref,'dev');for(const side of [associated.head,associated.base]){assert(side.repo&&(side.repo.full_name!==undefined||side.repo.url!==undefined));if(side.repo.full_name!==undefined)assert.equal(side.repo.full_name,REPOSITORY);if(side.repo.url!==undefined)assert.equal(side.repo.url,'https://api.github.com/repos/'+REPOSITORY);if(side.repo.name!==undefined)assert.equal(side.repo.name,REPOSITORY.split('/')[1]);}
    const leaves=tree=>{assert.equal(tree.truncated,false,'deployment_b0_tree_pagination');const result={};for(const row of tree.tree){assert(!Object.hasOwn(result,row.path));assert(['blob','tree','commit'].includes(row.type));if(row.type!=='tree')result[row.path]=row.type+':'+row.mode+':'+row.sha;}return result;},before=leaves(bundle.b0Tree),after=leaves(bundle.currentTree),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);recoveryPaths(changed,B0_CHILD.paths);for(const p of changed)assert(before[p]==='blob:100644:'+before[p].split(':').at(-1)&&after[p]?.startsWith('blob:100644:'),'deployment_b0_regular_file_delta');validateCurrentAssociation(context,pr,bundle.headCommit.tree?.sha,local.tree);assert.equal(commit.parents[0].sha,e.base,'deployment_b0_dev_base');
  }else if(bundle.headCommit.parents?.[0]?.sha===C4_CHILD.commit){
    assert.deepEqual(bundle.headCommit.parents.map(p=>p.sha),[C4_CHILD.commit],'deployment_c4_child_parent');assert.equal(bundle.c4Commit?.sha,C4_CHILD.commit,'deployment_c4_anchor_sha');assert.deepEqual(bundle.c4Commit.parents?.map(p=>p.sha),[C4_CHILD.parent],'deployment_c4_anchor_parent');assert.equal(bundle.c4Commit.tree?.sha,C4_CHILD.tree,'deployment_c4_anchor_tree');assert.equal(bundle.c4Tree?.sha,C4_CHILD.tree,'deployment_c4_tree_root');assert.equal(bundle.c4Tree.truncated,false,'deployment_c4_tree_pagination');
    assert.equal(associated.head?.sha,pr.head.sha,'deployment_c4_association_head');assert.equal(associated.base?.sha,C4_CHILD.base);assert.equal(associated.base?.ref,'dev');for(const side of [associated.head,associated.base]){assert(side.repo&&(side.repo.full_name!==undefined||side.repo.url!==undefined));if(side.repo.full_name!==undefined)assert.equal(side.repo.full_name,REPOSITORY);if(side.repo.url!==undefined)assert.equal(side.repo.url,'https://api.github.com/repos/'+REPOSITORY);if(side.repo.name!==undefined)assert.equal(side.repo.name,REPOSITORY.split('/')[1]);}
    const leaves=tree=>{assert.equal(tree.truncated,false,'deployment_c4_tree_pagination');const result={};for(const row of tree.tree){assert(!Object.hasOwn(result,row.path));assert(['blob','tree','commit'].includes(row.type));if(row.type!=='tree')result[row.path]=row.type+':'+row.mode+':'+row.sha;}return result;},before=leaves(bundle.c4Tree),after=leaves(bundle.currentTree),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);assert.deepEqual(C4_CHILD.paths,B0_CHILD.paths,'deployment_c4_public4_envelope');assert.deepEqual(C4_CHILD.directPaths,[C4_CHILD.paths[0],C4_CHILD.paths[3]],'deployment_c4_exact_pt_paths');recoveryPaths(changed,C4_CHILD.directPaths);for(const p of changed)assert(before[p]==='blob:100644:'+before[p].split(':').at(-1)&&after[p]?.startsWith('blob:100644:'),'deployment_c4_regular_file_delta');validateCurrentAssociation(context,pr,bundle.headCommit.tree?.sha,local.tree);
  }else{assert.deepEqual(bundle.headCommit.parents?.map(p=>p.sha),["b199fcf825b7b27947217b81ed4d46c8e9bc714e"],"deployment_grant_d_parent_mismatch");validateCurrentAssociation(context,pr,bundle.headCommit.tree?.sha,local.tree);}
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
  let predecessorCommit,anchorCommit,anchorTree,b0Commit,b0Tree,c4Commit,c4Tree;if(headCommit.parents?.[0]?.sha===E_CHAIN.predecessor){predecessorCommit=await read('git/commits/'+E_CHAIN.predecessor);anchorCommit=await read('git/commits/'+E_CHAIN.anchor);anchorTree=await read('git/trees/'+anchorCommit.tree.sha+'?recursive=1');}else if(headCommit.parents?.[0]?.sha===B0_CHILD.commit){b0Commit=await read('git/commits/'+B0_CHILD.commit);b0Tree=await read('git/trees/'+B0_CHILD.tree+'?recursive=1');}else if(headCommit.parents?.[0]?.sha===C4_CHILD.commit){c4Commit=await read('git/commits/'+C4_CHILD.commit);c4Tree=await read('git/trees/'+C4_CHILD.tree+'?recursive=1');}return validateShallowDeploymentBundle(local,{run,jobs,associations,pr,currentCommit,headCommit,baselineCommit,baselineTree,currentTree,predecessorCommit,anchorCommit,anchorTree,b0Commit,b0Tree,c4Commit,c4Tree});
}
async function proveShallowDeployment(){
  const env=process.env,e=outer.contract.completedRunReuse;
  assert.equal(env.NODE_OPTIONS||"","");assert.equal(env.TENNISNOTE_REUSE_OFFLINE_BASE||"","");assert(env.GH_TOKEN);assert(/^\d+$/.test(env.GITHUB_RUN_ID||""));
  // Only current HEAD is available/needed. No HEAD^, show, old diff or fetch.
  const local=readLocalDeploymentCheckout(env,git,p=>fs.readFileSync(path.join(outer.root,p)));
  const allowed=new Set(["actions/runs/"+local.runId,"actions/runs/"+local.runId+"/attempts/1/jobs?per_page=100","commits/"+local.sha+"/pulls","pulls/206","git/commits/"+local.sha,"git/commits/"+e.head_sha,"git/trees/"+e.tree+"?recursive=1","git/trees/"+local.tree+"?recursive=1"]);
  const seen=new Set();let eChain=false,b0Child=false,c4Child=false,expectedHeadSha=null;const read=async suffix=>{assert(allowed.has(suffix),"deploy_metadata_route_denied");assert(!seen.has(suffix),'deploy_metadata_duplicate');seen.add(suffix);assert(seen.size<=12,'deploy_metadata_e_bound');const response=await fetch("https://api.github.com/repos/"+REPOSITORY+"/"+suffix,{headers:{Authorization:"Bearer "+env.GH_TOKEN,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(20000),redirect:'error'});assert(response.ok,"deploy_metadata_unavailable");assert(response.headers&&typeof response.headers.get==='function');assert.equal(response.headers.get('link')||'','','deploy_metadata_pagination');const data=await response.json();if(suffix==="pulls/206"){assert.equal(data.head?.repo?.full_name,REPOSITORY);assert(/^[a-f0-9]{40}$/.test(data.head?.sha||""));expectedHeadSha=data.head.sha;allowed.add("git/commits/"+data.head.sha);}else if(suffix==='git/commits/'+B0_CHILD.commit&&b0Child){assert.equal(data.sha,B0_CHILD.commit);assert.deepEqual(data.parents?.map(p=>p.sha),[B0_CHILD.parent],'deploy_b0_anchor_parent');assert.equal(data.tree?.sha,B0_CHILD.tree,'deploy_b0_anchor_tree');allowed.add('git/trees/'+B0_CHILD.tree+'?recursive=1');}else if(suffix==='git/commits/'+C4_CHILD.commit&&c4Child){assert.equal(data.sha,C4_CHILD.commit);assert.deepEqual(data.parents?.map(p=>p.sha),[C4_CHILD.parent],'deploy_c4_anchor_parent');assert.equal(data.tree?.sha,C4_CHILD.tree,'deploy_c4_anchor_tree');allowed.add('git/trees/'+C4_CHILD.tree+'?recursive=1');}else if(suffix==='git/commits/'+expectedHeadSha){if(data.parents?.length===1&&data.parents[0].sha===E_CHAIN.predecessor){eChain=true;allowed.add('git/commits/'+E_CHAIN.predecessor);allowed.add('git/commits/'+E_CHAIN.anchor);}else if(data.parents?.length===1&&data.parents[0].sha===B0_CHILD.commit){b0Child=true;allowed.add('git/commits/'+B0_CHILD.commit);}else if(data.parents?.length===1&&data.parents[0].sha===C4_CHILD.commit){c4Child=true;allowed.add('git/commits/'+C4_CHILD.commit);}}else if(eChain&&suffix==='git/commits/'+E_CHAIN.anchor){assert.equal(data.sha,E_CHAIN.anchor);assert(/^[a-f0-9]{40}$/.test(data.tree?.sha||''));allowed.add('git/trees/'+data.tree.sha+'?recursive=1');}return data;};
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

Object.assign(module.exports,{recoveryCanonical,recoveryDigest,recoveryShape,recoveryHash,recoveryPaths,validateRecoveryBaseline,validateRecoveryCurrentContext,validateRecoverySourceReceipt,recoveryFrame,readRecoveryFrame,validateRecoveryConsumer,recoverySelfTest});
Object.assign(module.exports,{validateEChainContext,validateECurrentCheckpoint});
