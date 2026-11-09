import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,join} from "node:path";
import {createHash} from "node:crypto";
import {compose,walk,validateTarget,validatePromotion,validateRecovery,validatePublished,readTarget,requestPath,decideReadback} from "./r4_product_draft_style_dev.mjs";
if(process.env.R4_STYLE_IMMUTABLE_ONLY) {
  assert.equal(decideReadback(true,true),"PASS");
  assert.equal(decideReadback(true,false),"ALIAS_DRIFT_HOLD");
  assert.equal(decideReadback(false,true),"IMMUTABLE_MISMATCH");
  assert.equal(decideReadback(false,false),"IMMUTABLE_MISMATCH");
  assert.throws(()=>decideReadback(null,true));assert.throws(()=>decideReadback(true,undefined));
  const script=readFileSync(new URL("./r4_product_draft_style_dev.mjs",import.meta.url),"utf8");
  assert.ok(script.includes('[[process.env.PUBLISHED_URL,true],[origin,false]]'));
  assert.ok(script.includes('await published(p,source,process.env.PUBLISHED_URL),deploymentId'));
  assert.ok(script.includes('[process.env.RECOVERY_URL,origin]'));
  console.log("PASS: immutable mismatch vs alias-only drift fail-closed");
} else if(process.env.R4_STYLE_RECEIPT_ONLY) {
  const p=JSON.parse(readFileSync(new URL("../release-sources/r4-product-draft-style-dev/policy.json",import.meta.url))),source="b".repeat(40),privateCommit="c".repeat(40),artifactDigest="d".repeat(64),sealSha256="e".repeat(64);
  const credentialEvidence={project:p.project,previewBranch:p.previewBranch,priorSuccessRun:p.previousPreviewRun,metadataUnchanged:true,writePermissionStatus:"NOT_DIRECTLY_VERIFIED"};
  const qaReceipt={approved:true,sourceCommit:source,privateCommit,artifactDigest,sealSha256},recoveryReceipt={approved:true,baseSealSha256:p.baseSealSha256,project:p.project,previewBranch:p.previewBranch,noRetryOnUncertainty:true,aliasIdentityRequired:true,postReadbackRequired:true};
  const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
  const promotion={sourceCommit:source,privateCommit,sourceRunId:1,artifactId:2,artifactDigest,sealSha256,credentialEvidence,credentialEvidenceSha256:digest(credentialEvidence),qaReceipt,qaReceiptSha256:digest(qaReceipt),recoveryReceipt,recoveryReceiptSha256:digest(recoveryReceipt)};
  validatePromotion(promotion,source,{...p,privateCommit});
  for(const key of ["qaReceipt","recoveryReceipt","credentialEvidence"])assert.throws(()=>validatePromotion({...promotion,[key]:{...promotion[key],approved:false}},source,{...p,privateCommit}));
  console.log("PASS: independent QA, recovery and credential receipt binding");
} else if(process.env.R4_STYLE_RECOVERY_ONLY) {
  const id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const good={publishedDeploymentId:id,currentAliasDeploymentId:id,knownPublished:true,uncertain:false,baselineSealVerified:true};
  assert.equal(validateRecovery(good),true);
  for(const delta of [{uncertain:true},{knownPublished:false},{currentAliasDeploymentId:"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"},{baselineSealVerified:false},{publishedDeploymentId:"invalid"}])assert.throws(()=>validateRecovery({...good,...delta}));
  const workflow=readFileSync(new URL("../.github/workflows/r4-product-draft-style-dev.yml",import.meta.url),"utf8");
  assert.ok(workflow.includes("failure() && steps.post.outputs.definite_mismatch == 'true'"));
  assert.ok(workflow.includes("failure() && steps.recovery_admit.outcome == 'success'"));
  assert.ok(workflow.includes("pages deploy style-base/admin --project-name=tennisnote-admin-dev --branch=r4-product-draft-qa"));
  console.log("PASS: synthetic recovery admission and gated workflow route");
} else if(process.env.R4_STYLE_ROUTE_ONLY) {
  assert.equal(requestPath("index.html"),"/");assert.equal(requestPath("r4-product-draft-candidate.css"),"/r4-product-draft-candidate.css");
  console.log("PASS: index root route and exact asset route");
} else if(process.env.R4_STYLE_POSTCHECK_ONLY) {
  const p=JSON.parse(readFileSync(new URL("../release-sources/r4-product-draft-style-dev/policy.json",import.meta.url)));
  const source="b".repeat(40),id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const project={name:p.project,production_branch:p.canonicalBranch,canonical_deployment:{id:p.canonicalId,deployment_trigger:{metadata:{commit_hash:p.canonicalSha}}}};
  const url="https://1234abcd.tennisnote-admin-dev.pages.dev";
  const preview={id,url,aliases:[`https://${p.previewBranch}.${p.project}.pages.dev`],deployment_trigger:{metadata:{branch:p.previewBranch,commit_hash:source}},latest_stage:{status:"success"}};
  assert.equal(validatePublished({project,deployments:[preview]},p,source,url),id);
  assert.throws(()=>validatePublished({project,deployments:[preview,preview]},p,source,url));
  assert.throws(()=>validatePublished({project,deployments:[{...preview,id:"invalid"}]},p,source,url));
  assert.throws(()=>validatePublished({project,deployments:[preview]},p,"c".repeat(40),url));
  assert.throws(()=>validatePublished({project,deployments:[preview]},p,source,"https://9999abcd.tennisnote-admin-dev.pages.dev"));
  assert.throws(()=>validatePublished({project:{...project,production_branch:"main"},deployments:[preview]},p,source,url));
  console.log("PASS: synthetic post-publication alias, source and canonical drift guards");
} else if(process.env.R4_STYLE_GUARD_ONLY) {
  const p=JSON.parse(readFileSync(new URL("../release-sources/r4-product-draft-style-dev/policy.json",import.meta.url)));
  const canonical={id:p.canonicalId,deployment_trigger:{metadata:{commit_hash:p.canonicalSha}},latest_stage:{status:"success"}};
  const project={name:p.project,production_branch:p.canonicalBranch,canonical_deployment:canonical};
  const recovery={id:p.recoveryId,latest_stage:{status:"success"}};
  const preview={id:"a".repeat(36),url:p.previousPreviewUrl,aliases:[`https://${p.previewBranch}.${p.project}.pages.dev`],deployment_trigger:{metadata:{branch:p.previewBranch,commit_hash:p.baseSource}},latest_stage:{status:"success"}};
  assert.equal(validateTarget({project,recovery,deployments:[preview]},p).previewId,preview.id);
  assert.throws(()=>validateTarget({project,recovery,deployments:[]},p));assert.throws(()=>validateTarget({project,recovery,deployments:[preview,preview]},p));
  assert.throws(()=>validateTarget({project:{...project,canonical_deployment:{...canonical,id:"changed"}},recovery,deployments:[preview]},p));
  assert.throws(()=>validateTarget({project,recovery,deployments:[{...preview,url:"changed"}]},p));
  const account="a".repeat(32),fingerprint=createHash("sha256").update(account).digest("hex"),seen=[];
  const fetcher=async url=>{seen.push(url);if(url.endsWith("/"+p.project))return {success:true,result:project};if(url.endsWith("/"+p.recoveryId))return {success:true,result:recovery};const page=Number(new URL(url).searchParams.get("page"));return {success:true,result:page===2?[preview]:[],result_info:{page,total_pages:2}};};
  await readTarget(p,{account,token:"synthetic",fingerprint,fetcher});assert.equal(seen.length,4);assert.ok(seen.every(x=>!x.includes("per_page")));
  await assert.rejects(()=>readTarget(p,{account,token:"synthetic",fingerprint:"b".repeat(64),fetcher}));
  const good={publishedDeploymentId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",currentAliasDeploymentId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",knownPublished:true,uncertain:false,baselineSealVerified:true};
  assert.equal(validateRecovery(good),true);for(const delta of [{uncertain:true},{knownPublished:false},{currentAliasDeploymentId:"b".repeat(36)},{baselineSealVerified:false}])assert.throws(()=>validateRecovery({...good,...delta}));
  const credentialEvidence={project:p.project,previewBranch:p.previewBranch,priorSuccessRun:p.previousPreviewRun,metadataUnchanged:true,writePermissionStatus:"NOT_DIRECTLY_VERIFIED"};
  const credentialEvidenceSha256=createHash("sha256").update(JSON.stringify(credentialEvidence)).digest("hex"),source="b".repeat(40),privateCommit="c".repeat(40);
  const qaReceipt={approved:true,sourceCommit:source,privateCommit,artifactDigest:"d".repeat(64),sealSha256:"e".repeat(64)},recoveryReceipt={approved:true,baseSealSha256:p.baseSealSha256,project:p.project,previewBranch:p.previewBranch,noRetryOnUncertainty:true,aliasIdentityRequired:true,postReadbackRequired:true};
  const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
  const promotion={sourceCommit:source,privateCommit,sourceRunId:1,artifactId:2,artifactDigest:"d".repeat(64),sealSha256:"e".repeat(64),credentialEvidence,credentialEvidenceSha256,qaReceipt,qaReceiptSha256:digest(qaReceipt),recoveryReceipt,recoveryReceiptSha256:digest(recoveryReceipt)};
  validatePromotion(promotion,source,{...p,privateCommit});assert.throws(()=>validatePromotion({...promotion,credentialEvidence:{...credentialEvidence,metadataUnchanged:false}},source,{...p,privateCommit}));
  console.log("PASS: synthetic fresh-target, full pagination, promotion evidence and recovery fail-closed");
} else {
const base=process.env.R4_STYLE_BASE || "C:/Users/user/Documents/ChatGPT/테니스노트/outputs/2026-11-08-r4-product-draft-ci-artifact-42489115768";
const files=walk(base+"/admin"),sealBytes=readFileSync(base+"/seal.json"),css=readFileSync(new URL("../release-sources/r4-product-draft-style-dev/candidate.css",import.meta.url)),policy=JSON.parse(readFileSync(new URL("../release-sources/r4-product-draft-style-dev/policy.json",import.meta.url)));
const result=compose({files,sealBytes,css,policy});assert.equal(Object.keys(result.files).length,175);
assert.throws(()=>compose({files:{...files,"index.html":Buffer.from("drift")},sealBytes,css,policy}),/BASE_CONTENT_DRIFT/);
assert.throws(()=>compose({files,sealBytes,css:Buffer.from("drift"),policy}),/CSS_DRIFT/);
assert.throws(()=>compose({files,sealBytes:Buffer.from("{}"),css,policy}),/BASE_SEAL_DRIFT/);
if(process.env.R4_STYLE_OUTPUT) {
  assert.equal(process.env.R4_STYLE_OUTPUT,"style-release");mkdirSync("style-release");mkdirSync("style-release/admin");
  for(const [name,bytes] of Object.entries(result.files)) {
    assert.ok(!name.split("/").some(part=>part===".."||part===""));
    const target=join("style-release/admin",name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:"wx"});
  }
  writeFileSync("style-release/seal.json",JSON.stringify({schema:1,source:process.env.GITHUB_SHA,privateCommit:policy.privateCommit,baseSource:policy.baseSource,baseSealSha256:policy.baseSealSha256,admin:result.hashes})+"\n",{flag:"wx"});
}
console.log("PASS: sealed 175-file baseline, exact CSS/index-only delta, tamper cases");
}
