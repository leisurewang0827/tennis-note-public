// Pure UI-only composition over an existing sealed administrator artifact.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,appendFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const hash=x=>createHash("sha256").update(x).digest("hex");
export const requestPath=path=>path==="index.html"?"/":`/${path}`;
export function decideReadback(immutableMatches,aliasMatches) {
  assert.equal(typeof immutableMatches,"boolean");assert.equal(typeof aliasMatches,"boolean");
  if(!immutableMatches) return "IMMUTABLE_MISMATCH";
  if(!aliasMatches) return "ALIAS_DRIFT_HOLD";
  return "PASS";
}
export function walk(dir,p="") {
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
    assert.ok(!e.isSymbolicLink(),"SYMLINK_DENIED");return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+"/")):[[p+e.name,readFileSync(join(dir,e.name))]];
  }));
}
export function compose({files,sealBytes,css,policy}) {
  assert.equal(hash(sealBytes),policy.baseSealSha256,"BASE_SEAL_DRIFT");const seal=JSON.parse(sealBytes);
  assert.equal(seal.sha,policy.baseSource,"BASE_SOURCE_DRIFT");assert.equal(Object.keys(seal.admin).length,175,"BASE_COUNT_DRIFT");
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([name,b])=>[name,hash(b)])),seal.admin,"BASE_CONTENT_DRIFT");
  assert.equal(hash(files["index.html"]),policy.baseIndexSha256);assert.equal(hash(files["r4-product-draft-candidate.css"]),policy.baseCssSha256);
  assert.equal(hash(css),policy.candidateCssSha256,"CSS_DRIFT");
  const old=files["index.html"].toString("utf8"),re=/(href="\.\/r4-product-draft-candidate\.css\?v=)[a-f0-9]{16}(")/g;
  assert.equal([...old.matchAll(re)].length,1,"INDEX_ANCHOR_DRIFT");const next=old.replace(re,(_,a,b)=>`${a}${policy.candidateCssSha256.slice(0,16)}${b}`);
  assert.notEqual(next,old,"INDEX_NO_CHANGE");
  const result={...files,"index.html":Buffer.from(next),"r4-product-draft-candidate.css":Buffer.from(css)};
  const changed=Object.keys(result).filter(p=>hash(result[p])!==hash(files[p])).sort();
  assert.deepEqual(changed,["index.html","r4-product-draft-candidate.css"]);
  return {files:result,changed,hashes:Object.fromEntries(Object.entries(result).map(([name,b])=>[name,hash(b)]))};
}
const sourcePaths=[".github/workflows/r4-product-draft-style-dev.yml","release-sources/r4-product-draft-style-dev/candidate.css","release-sources/r4-product-draft-style-dev/policy.json","scripts/check_r4_product_draft_style_dev.mjs","scripts/r4_product_draft_style_dev.mjs"].sort();
const promotionPath="release-promotions/r4-product-draft-style-dev/promotion.json";
const sha=x=>assert.match(x||"",/^[a-f0-9]{40}$/,"SHA_REQUIRED");
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const parent=(a,b)=>assert.equal(git("rev-list","--parents","-n","1",a),`${a} ${b}`,"PARENT_DRIFT");
const diff=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
export function classify(policy,current) {
  sha(current);sha(policy.privateCommit);const parents=git("rev-list","--parents","-n","1",current).split(" ");
  assert.equal(parents.length,2,"PARENT_DRIFT");const previous=parents[1],paths=diff(previous,current);
  if(previous===policy.publicParent && JSON.stringify(paths)===JSON.stringify(sourcePaths)) return {stage:"source",source:current};
  assert.deepEqual(paths,[promotionPath],"SCOPE_DRIFT");parent(previous,policy.publicParent);
  assert.deepEqual(diff(policy.publicParent,previous),sourcePaths,"SOURCE_SCOPE_DRIFT");return {stage:"promotion",source:previous};
}
async function get(url,token) {
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,200,"REMOTE_READ_FAILED");return r.json();
}
export function validateTarget({project,recovery,deployments},p) {
  assert.equal(p.project,"tennisnote-admin-dev");assert.equal(p.canonicalBranch,"dev");assert.equal(p.previewBranch,"r4-product-draft-qa");
  assert.equal(p.previousPreviewUrl,"https://58f0f421.tennisnote-admin-dev.pages.dev");
  assert.equal(project?.name,p.project,"PROJECT_DRIFT");assert.equal(project?.production_branch,p.canonicalBranch,"CANONICAL_BRANCH_DRIFT");
  const canonical=project?.canonical_deployment;assert.equal(canonical?.id,p.canonicalId,"CANONICAL_DRIFT");
  assert.equal(canonical?.deployment_trigger?.metadata?.commit_hash,p.canonicalSha,"CANONICAL_SHA_DRIFT");assert.equal(canonical?.latest_stage?.status,"success");
  assert.equal(recovery?.id,p.recoveryId,"RECOVERY_DRIFT");assert.equal(recovery?.latest_stage?.status,"success");
  const alias=`https://${p.previewBranch}.${p.project}.pages.dev`;
  const matches=deployments.filter(d=>Array.isArray(d.aliases)&&d.aliases.includes(alias));assert.equal(matches.length,1,"PREVIEW_ALIAS_UNKNOWN");
  const current=matches[0];assert.equal(current.url,p.previousPreviewUrl,"PREVIEW_CHANGED");
  assert.equal(current.deployment_trigger?.metadata?.branch,p.previewBranch,"PREVIEW_BRANCH_DRIFT");
  assert.equal(current.deployment_trigger?.metadata?.commit_hash,p.baseSource,"PREVIEW_SOURCE_DRIFT");assert.equal(current.latest_stage?.status,"success");
  return {previewId:current.id};
}
export async function readTarget(p,{account,token,fingerprint,fetcher=get}) {
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);assert.equal(hash(account),fingerprint,"ACCOUNT_DRIFT");
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${p.project}`;
  const project=await fetcher(base,token),recovery=await fetcher(`${base}/deployments/${p.recoveryId}`,token);
  assert.equal(project.success,true);assert.equal(recovery.success,true);let page=1,total=1,all=[];
  do {const r=await fetcher(`${base}/deployments?page=${page}`,token);assert.equal(r.success,true);assert.ok(Array.isArray(r.result));
    assert.ok(Number.isInteger(r.result_info?.total_pages)&&r.result_info.total_pages>=1&&r.result_info.total_pages<=100,"PAGINATION_UNKNOWN");
    assert.equal(r.result_info.page,page,"PAGE_DRIFT");if(page>1)assert.equal(r.result_info.total_pages,total,"PAGINATION_DRIFT");
    total=r.result_info.total_pages;all.push(...r.result);page++;
  } while(page<=total);
  return validateTarget({project:project.result,recovery:recovery.result,deployments:all},p);
}
export function validatePromotion(promotion,source,p) {
  assert.equal(promotion.sourceCommit,source);assert.equal(promotion.privateCommit,p.privateCommit);
  assert.ok(Number.isSafeInteger(promotion.sourceRunId));assert.ok(Number.isSafeInteger(promotion.artifactId));
  for(const key of ["artifactDigest","sealSha256","credentialEvidenceSha256","qaReceiptSha256","recoveryReceiptSha256"]) assert.match(promotion[key]||"",/^[a-f0-9]{64}$/);
  const receipt=promotion.credentialEvidence;assert.ok(receipt && typeof receipt==="object" && !Array.isArray(receipt));
  assert.equal(hash(JSON.stringify(receipt)),promotion.credentialEvidenceSha256,"CREDENTIAL_EVIDENCE_DRIFT");
  assert.equal(receipt.project,p.project);assert.equal(receipt.previewBranch,p.previewBranch);assert.equal(receipt.priorSuccessRun,p.previousPreviewRun);
  assert.equal(receipt.metadataUnchanged,true);assert.equal(receipt.writePermissionStatus,"NOT_DIRECTLY_VERIFIED");
  const qa=promotion.qaReceipt,rr=promotion.recoveryReceipt;assert.ok(qa&&typeof qa==="object"&&!Array.isArray(qa));assert.ok(rr&&typeof rr==="object"&&!Array.isArray(rr));
  assert.equal(hash(JSON.stringify(qa)),promotion.qaReceiptSha256,"QA_RECEIPT_DRIFT");assert.equal(qa.approved,true);
  assert.equal(qa.sourceCommit,source);assert.equal(qa.privateCommit,p.privateCommit);assert.equal(qa.artifactDigest,promotion.artifactDigest);assert.equal(qa.sealSha256,promotion.sealSha256);
  assert.equal(hash(JSON.stringify(rr)),promotion.recoveryReceiptSha256,"RECOVERY_RECEIPT_DRIFT");assert.equal(rr.approved,true);
  assert.equal(rr.baseSealSha256,p.baseSealSha256);assert.equal(rr.project,p.project);assert.equal(rr.previewBranch,p.previewBranch);
  assert.equal(rr.noRetryOnUncertainty,true);assert.equal(rr.aliasIdentityRequired,true);assert.equal(rr.postReadbackRequired,true);
}
export function validateRecovery({publishedDeploymentId,currentAliasDeploymentId,knownPublished,uncertain,baselineSealVerified}) {
  assert.equal(uncertain,false,"RESPONSE_OR_CONCURRENCY_UNCERTAIN");assert.equal(knownPublished,true,"PUBLICATION_NOT_CONFIRMED");
  assert.match(publishedDeploymentId||"",/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.equal(currentAliasDeploymentId,publishedDeploymentId,"PREVIEW_CHANGED");
  assert.equal(baselineSealVerified,true,"BASE_SEAL_DRIFT");return true;
}
export function validatePublished({project,deployments},p,source,expectedUrl) {
  assert.equal(project?.name,"tennisnote-admin-dev");assert.equal(project?.production_branch,"dev");
  assert.equal(project?.canonical_deployment?.id,p.canonicalId);assert.equal(project?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,p.canonicalSha);
  const alias="https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev";
  const matches=deployments.filter(d=>Array.isArray(d.aliases)&&d.aliases.includes(alias));assert.equal(matches.length,1,"PREVIEW_ALIAS_UNKNOWN");
  const d=matches[0];assert.match(expectedUrl||"",/^https:\/\/[a-f0-9]{8}\.tennisnote-admin-dev\.pages\.dev$/);assert.equal(d.url,expectedUrl,"DEPLOYMENT_URL_DRIFT");
  assert.equal(d.deployment_trigger?.metadata?.branch,p.previewBranch);assert.equal(d.deployment_trigger?.metadata?.commit_hash,source);
  assert.equal(d.latest_stage?.status,"success");assert.match(d.id||"",/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);return d.id;
}
async function published(p,source,expectedUrl) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);
  assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${p.project}`,project=await get(base,token);assert.equal(project.success,true);
  let page=1,total=1,deployments=[];
  do {const r=await get(`${base}/deployments?page=${page}`,token);assert.equal(r.success,true);assert.ok(Array.isArray(r.result));
    assert.ok(Number.isInteger(r.result_info?.total_pages)&&r.result_info.total_pages>=1&&r.result_info.total_pages<=100);assert.equal(r.result_info.page,page);
    if(page>1)assert.equal(r.result_info.total_pages,total);total=r.result_info.total_pages;deployments.push(...r.result);page++;
  } while(page<=total);
  return validatePublished({project:project.result,deployments},p,source,expectedUrl);
}
async function main() {
  const p=JSON.parse(readFileSync("release-sources/r4-product-draft-style-dev/policy.json"));
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");assert.equal(process.env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const {stage,source}=classify(p,process.env.GITHUB_SHA),mode=process.argv[2];
  if(mode==="classify") {appendFileSync(process.env.GITHUB_OUTPUT,`stage=${stage}\nsource=${source}\n`);return;}
  if(mode==="preflight") {await readTarget(p,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,fingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});console.log("DEV_STYLE_READONLY_PREFLIGHT_PASS");return;}
  if(mode==="admit" && stage==="promotion") {
    const promotion=JSON.parse(readFileSync(promotionPath));validatePromotion(promotion,source,p);
    const token=process.env.GH_TOKEN;assert.ok(token);const api="https://api.github.com/repos/leisurewang0827/tennis-note-public";
    const run=await get(`${api}/actions/runs/${promotion.sourceRunId}`,token),artifact=await get(`${api}/actions/artifacts/${promotion.artifactId}`,token);
    assert.equal(run.head_sha,source);assert.equal(run.conclusion,"success");assert.equal(run.run_attempt,1);assert.equal(run.event,"push");assert.equal(run.path,".github/workflows/r4-product-draft-style-dev.yml");
    assert.equal(artifact.workflow_run?.id,promotion.sourceRunId);assert.equal(artifact.name,`r4-product-draft-style-dev-${promotion.sourceRunId}`);assert.equal(artifact.expired,false);assert.equal(artifact.digest,`sha256:${promotion.artifactDigest}`);
    const seal=readFileSync("style-artifact/seal.json");assert.equal(hash(seal),promotion.sealSha256);const parsed=JSON.parse(seal);
    assert.equal(parsed.source,source);assert.equal(parsed.privateCommit,p.privateCommit);assert.equal(parsed.baseSource,p.baseSource);assert.equal(parsed.baseSealSha256,p.baseSealSha256);
    assert.deepEqual(Object.fromEntries(Object.entries(walk("style-artifact/admin")).map(([k,v])=>[k,hash(v)])),parsed.admin);
    assert.equal(parsed.admin["r4-product-draft-candidate.css"],p.candidateCssSha256);
    const expected=compose({files:walk("style-base/admin"),sealBytes:readFileSync("style-base/seal.json"),css:readFileSync("release-sources/r4-product-draft-style-dev/candidate.css"),policy:p});
    assert.deepEqual(parsed.admin,expected.hashes,"ARTIFACT_COMPOSITION_DRIFT");
    await readTarget(p,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,fingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});
    console.log("DEV_STYLE_PROMOTION_ADMISSION_PASS");return;
  }
  if(mode==="postcheck" && stage==="promotion") {
    const parsed=JSON.parse(readFileSync("style-artifact/seal.json")),origin=`https://${p.previewBranch}.${p.project}.pages.dev`;
    const deploymentId=await published(p,source,process.env.PUBLISHED_URL);let immutableMatches=true,aliasMatches=true;
    for(const path of ["index.html","r4-product-draft-candidate.css","r4-product-draft-candidate.js","r4-product-draft-host-candidate.js","r4-product-draft-dev-scoped-candidate.js","r4-onboarding.js"]) {
      for(const [base,isImmutable] of [[process.env.PUBLISHED_URL,true],[origin,false]]) {
        const response=await fetch(base+requestPath(path),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
        assert.equal(response.status,200,"POST_READ_FAILED");const matches=hash(Buffer.from(await response.arrayBuffer()))===parsed.admin[path];
        if(!matches) {if(isImmutable) immutableMatches=false;else aliasMatches=false;}
      }
    }
    assert.equal(await published(p,source,process.env.PUBLISHED_URL),deploymentId,"PREVIEW_CHANGED");
    const decision=decideReadback(immutableMatches,aliasMatches);
    if(decision==="IMMUTABLE_MISMATCH") {appendFileSync(process.env.GITHUB_OUTPUT,`definite_mismatch=true\ndeployment_id=${deploymentId}\n`);throw Error("POST_ASSET_DRIFT");}
    assert.equal(decision,"PASS","ALIAS_DRIFT_HOLD");
    console.log(JSON.stringify({status:"DEV_STYLE_POSTCHECK_PASS",deploymentId}));return;
  }
  if(mode==="recovery-admit" && stage==="promotion") {
    assert.equal(process.env.DEFINITE_MISMATCH,"true");const current=await published(p,source,process.env.PUBLISHED_URL);
    const baseSeal=readFileSync("style-base/seal.json");assert.equal(hash(baseSeal),p.baseSealSha256);
    const base=JSON.parse(baseSeal);assert.equal(base.sha,p.baseSource);
    assert.deepEqual(Object.fromEntries(Object.entries(walk("style-base/admin")).map(([k,v])=>[k,hash(v)])),base.admin);
    validateRecovery({publishedDeploymentId:process.env.PUBLISHED_DEPLOYMENT_ID,currentAliasDeploymentId:current,knownPublished:true,uncertain:false,baselineSealVerified:true});
    console.log("DEV_STYLE_RECOVERY_ADMISSION_PASS");return;
  }
  if(mode==="recovery-postcheck" && stage==="promotion") {
    const seal=JSON.parse(readFileSync("style-base/seal.json")),origin=`https://${p.previewBranch}.${p.project}.pages.dev`;
    const recoveryId=await published(p,p.baseSource,process.env.RECOVERY_URL);
    for(const path of ["index.html","r4-product-draft-candidate.css","r4-product-draft-candidate.js","r4-product-draft-host-candidate.js","r4-product-draft-dev-scoped-candidate.js","r4-onboarding.js"]) {
      for(const base of [process.env.RECOVERY_URL,origin]) {
        const response=await fetch(base+requestPath(path),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
        assert.equal(response.status,200,"RECOVERY_READ_FAILED");assert.equal(hash(Buffer.from(await response.arrayBuffer())),seal.admin[path],"RECOVERY_ASSET_DRIFT");
      }
    }
    assert.equal(await published(p,p.baseSource,process.env.RECOVERY_URL),recoveryId,"RECOVERY_ALIAS_DRIFT");
    console.log(JSON.stringify({status:"DEV_STYLE_RECOVERY_POSTCHECK_PASS",deploymentId:recoveryId}));return;
  }
  throw Error("INVALID_MODE");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(()=>{console.error("R4_DEV_STYLE_BLOCKED");process.exitCode=1;});
