import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),outer=require("./helpers/r3-auth548-outer-port.cjs"),provenance=require("../scripts/check_tennisnote_r3_auth548_provenance.cjs");
const read=file=>fs.readFileSync(outer.root+"/"+file,"utf8").replace(/\r\n/g,"\n");
test("new outer inverse preserves both frozen source authorities and rejects byte drift",()=>{
  assert.equal(outer.contract.publicParent,"582ebd00f31654233ecc77c1bf2efdd4fde0beec");
  assert.equal(outer.contract.oldR3,"67993445d5884ceb7e029abe88a541dffb499083");
  for(const row of outer.contract.files){
    const text=read(row.path);for(const kind of ["auth","r3"])assert.equal(outer.sha(outer.restore(row.path,text,kind)),row[kind+"Sha256"]);
    assert.throws(()=>outer.restore(row.path,text+"\n"),/source drift/);
    const h=row.authInverse||row.r3Inverse||row.authInverseHunks?.[0]||row.r3InverseHunks?.[0];if(h&&h.after){const bad=text.replace(h.after,h.before);if(bad!==text)assert.throws(()=>outer.restore(row.path,bad),/source drift/);}
  }
  assert.equal(outer.validateSource().authProducts,3);
});
test("editor/Auth/RPC/read hardening is the exact private-derived nine-function delta; protocols and original Auth proof are preserved",()=>{
  const profile=read("app/tennis-note-member-app/actions/profile.js");
  for(const fn of outer.contract.roleDelta.functions){if(fn.before!==null)assert.equal(outer.sha(fn.before),fn.beforeSha256);assert.equal(outer.sha(fn.after),fn.afterSha256);assert.equal(read(fn.path).split(fn.after).length,2);new vm.Script(fn.after)}
  assert.equal(outer.contract.roleDelta.functions.length,9);
  for(const marker of ["tn_save_my_verified_profile_phone","target_operation_key","target_expected_phone","requireFresh: true"]){const before=outer.restore("app/tennis-note-member-app/actions/profile.js",profile,"auth");assert.equal(profile.split(marker).length,before.split(marker).length)}
  for(const row of outer.contract.authPins)assert.equal(outer.sha(outer.restore(row.path,read(row.path),"auth")),row.currentSha256);
  for(const file of ["app/tennis-note-member-app/actions/enrollment.js","app/tennis-note-member-app/data/auth.js"]){
    const text=read(file),before=outer.restore(file,text,"auth");
    for(const marker of ["confirmedDirectAuthPhone","tn_save_my_signup_profile","verifyPhoneChange","requestPhoneChangeVerification","requireSignupReadback"])assert.equal(text.split(marker).length,before.split(marker).length,"unchanged direct-proof/OTP/signup call count");
  }
});
test("CI admission binds same repository, exact base/merge parents and branch; fork/direct/main/dispatch/drift deny",()=>{
  const p={repository:provenance.REPOSITORY,event:"pull_request",sha:"synthetic-merge",checkout:"synthetic-merge",headRepository:provenance.REPOSITORY,baseRepository:provenance.REPOSITORY,baseRef:"dev",baseSha:provenance.BASE,headRef:provenance.BRANCH,headSha:"synthetic-head",parent1:provenance.BASE,parent2:"synthetic-head"};
  assert.equal(provenance.validateContext(p),true);
  for(const d of [{repository:"wrong/repo"},{headRepository:"fork/repo"},{baseRef:"main"},{baseSha:"different"},{headRef:"wrong"},{parent1:"different"},{parent2:"different"},{checkout:"different"},{event:"workflow_dispatch"}])assert.throws(()=>provenance.validateContext({...p,...d}));
  const push={repository:provenance.REPOSITORY,event:"push",ref:"refs/heads/dev",sha:"synthetic-merge",checkout:"synthetic-merge",parent1:provenance.BASE,merged:true,mergeCommit:"synthetic-merge",headRepository:provenance.REPOSITORY,headRef:provenance.BRANCH};assert.equal(provenance.validateContext(push),true);
  for(const d of [{ref:"refs/heads/main"},{merged:false},{mergeCommit:"different"},{parent1:"different"}])assert.throws(()=>provenance.validateContext({...push,...d}));
});
test("old successful public runs are exact source evidence, never attest the new whole tree or private API access",()=>{
  for(const which of ["r3Public","authPublic"]){const e=outer.contract.evidence[which],r={id:e.run,head_sha:e.head,event:e.event,head_branch:e.branch,conclusion:"success",repository:{full_name:provenance.REPOSITORY},pull_requests:[{number:204,head:{sha:e.head},base:{sha:"e794c18059ff3391af9a5494f6389cfa0de70c2b"}}]};assert.equal(provenance.validateEvidence(which,r),true);for(const d of [{head_sha:"wrong"},{event:"workflow_dispatch"},{conclusion:"failure"},{id:1},{repository:{full_name:"wrong/repo"}}])assert.throws(()=>provenance.validateEvidence(which,{...r,...d}))}
  assert.equal(outer.contract.evidence.privateDb.publicRunnerCannotQueryPrivate,true);
  assert.equal(outer.contract.publishable,true);assert.doesNotThrow(()=>provenance.requirePublishable());
  assert.throws(()=>provenance.validateRuntimeReceipt("",""),/runtime_receipt_approval_missing/);
});
test("strong current DEV account/caller/source gate remains, and local foundation cannot accidentally deploy",()=>{
  const d=read(".github/workflows/deploy-cloudflare-pages-dev.yml"),ci=read(".github/workflows/tennisnote-public-ci.yml"),guard=read("scripts/check_tennisnote_development_deploy_scope.py");
  assert(d.indexOf("--deploy")<d.indexOf("check_tennisnote_development_deploy_scope.py"));assert(ci.includes("needs: build-and-check"));assert(ci.includes("steps.provenance.outputs.scoped != 'true'"));assert(ci.includes("./scripts/verify.sh"));assert(ci.includes("steps.provenance.outputs.scoped == 'true'"));
  assert(guard.includes('env.get("GITHUB_REPOSITORY") == REPOSITORY'));assert(guard.includes('env.get("TENNISNOTE_CALLER_WORKFLOW_REF") == CALLER_WORKFLOW'));assert(guard.includes("development_rollback_unconfirmed"));assert(!d.includes("pages project create"));
  for(const host of ["tennisnote-app --branch=main","tennisnote-admin --branch=main"])assert(!d.includes(host));
});
