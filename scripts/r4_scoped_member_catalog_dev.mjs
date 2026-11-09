// DEV-only scoped member catalog composition and protected preview promotion.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,appendFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {compose} from "../release-sources/r4-scoped-member-catalog-dev/compose.mjs";
const hash=x=>createHash("sha256").update(x).digest("hex");
const wranglerSha256="ee0efb7ee6b32ddcd8cfba64be8b42d536ac69f27395920a69e3abbad11ed87e";
export function patchWrangler(bytes) {
  assert.equal(hash(bytes),wranglerSha256,"WRANGLER_BUNDLE_DRIFT");let source=bytes.toString("utf8");
  const anchor='async function performApiFetch(resource, init2 = {}, queryParams, abortSignal) {\n  const method = init2.method ?? "GET";';
  const guard=`let __r4DeploymentPosts = 0;
function __r4GuardDeployment(resource, init2) {
  if ((init2.method ?? "GET") !== "POST" || !/^\\/accounts\\/[^/]+\\/pages\\/projects\\/[^/]+\\/deployments$/.test(resource)) return init2;
  const expected = \`/accounts/\${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/tennisnote-admin-dev/deployments\`;
  if (resource !== expected) throw Error("R4_DEPLOYMENT_TARGET_DENIED");
  if (getCloudflareApiBaseUrl() !== "https://api.cloudflare.com/client/v4") throw Error("R4_DEPLOYMENT_ORIGIN_DENIED");
  if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");
  __r4DeploymentPosts++;
  return { ...init2, redirect: "error" };
}
async function performApiFetch(resource, init2 = {}, queryParams, abortSignal) {
  init2 = __r4GuardDeployment(resource, init2);
  const method = init2.method ?? "GET";`;
  assert.equal(source.split(anchor).length,2,"WRANGLER_TRANSPORT_DRIFT");source=source.replace(anchor,()=>guard);
  const loop='if (e4.code === 8e6 /* UNKNOWN_ERROR */ && attempts < MAX_DEPLOYMENT_ATTEMPTS) {';
  assert.equal(source.split(loop).length,2,"WRANGLER_RETRY_DRIFT");source=source.replace(loop,'if (false && e4.code === 8e6 /* UNKNOWN_ERROR */ && attempts < MAX_DEPLOYMENT_ATTEMPTS) {');
  const boundary=source.indexOf("var require_undici = __commonJS(");assert.ok(boundary>0,"WRANGLER_UNDICI_DRIFT");
  let target=source.slice(0,boundary),rest=source.slice(boundary);
  const replay='response.status === 421 && // isNewConnectionFetch is false';
  assert.equal(target.split(replay).length,2,"WRANGLER_421_DRIFT");
  target=target.replace(replay,`response.status === 421 && !(request3.method === "POST" && requestCurrentURL(request3).origin === "https://api.cloudflare.com" && requestCurrentURL(request3).pathname === \`/client/v4/accounts/\${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/tennisnote-admin-dev/deployments\`) && // isNewConnectionFetch is false`);
  source=target+rest;
  return source;
}
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
const sourcePaths=[".github/workflows/r4-scoped-member-catalog-dev.yml","release-sources/r4-scoped-member-catalog-dev/compose.mjs","release-sources/r4-scoped-member-catalog-dev/module.js","release-sources/r4-scoped-member-catalog-dev/policy.json","scripts/check_r4_scoped_member_catalog_dev.mjs","scripts/r4_scoped_member_catalog_dev.mjs"];
const promotionPath="release-promotions/r4-scoped-member-catalog-dev/promotion.json";
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
export function safeFailure(error) {
  const code=error?.message;
  if(typeof code==="string" && /^(cf_project|cf_recovery|cf_list|gh)_HTTP_[1-5][0-9]{2}$/.test(code)) return code;
  if(["PAGINATION_UNKNOWN","PAGE_DRIFT","PAGINATION_DRIFT"].includes(code)) return code;
  return "R4_DEV_SCOPED_MEMBER_CATALOG_BLOCKED";
}
export async function get(url,token,fetcher=fetch) {
  const route=url.startsWith("https://api.github.com/")?"gh":url.includes("/deployments?")?"cf_list":url.includes("/deployments/")?"cf_recovery":"cf_project";
  const r=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(r.status!==200)throw Error(`${route}_HTTP_${r.status}`);return r.json();
}
export function validateTarget({project,recovery,deployments},p) {
  assert.equal(p.project,"tennisnote-admin-dev");assert.equal(p.canonicalBranch,"dev");assert.equal(p.previewBranch,"r4-product-draft-qa");
  assert.equal(p.previousPreviewUrl,"https://058efdcc.tennisnote-admin-dev.pages.dev");
  assert.equal(project?.name,p.project,"PROJECT_DRIFT");assert.equal(project?.production_branch,p.canonicalBranch,"CANONICAL_BRANCH_DRIFT");
  const canonical=project?.canonical_deployment;assert.equal(canonical?.id,p.canonicalId,"CANONICAL_DRIFT");
  assert.equal(canonical?.deployment_trigger?.metadata?.commit_hash,p.canonicalSha,"CANONICAL_SHA_DRIFT");assert.equal(canonical?.latest_stage?.status,"success");
  assert.equal(recovery?.id,p.recoveryId,"RECOVERY_DRIFT");assert.equal(recovery?.latest_stage?.status,"success");assert.equal(recovery?.url,p.previousPreviewUrl);
  assert.equal(recovery?.deployment_trigger?.metadata?.branch,p.previewBranch);
  assert.equal(recovery?.deployment_trigger?.metadata?.commit_hash,p.baseSource);
  const alias=`https://${p.previewBranch}.${p.project}.pages.dev`;
  const matches=deployments.filter(d=>Array.isArray(d.aliases)&&d.aliases.includes(alias));assert.equal(matches.length,1,"PREVIEW_ALIAS_UNKNOWN");
  const current=matches[0];assert.equal(current.url,p.previousPreviewUrl,"PREVIEW_CHANGED");assert.equal(current.id,p.previousPreviewId,"PREVIEW_ID_DRIFT");
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
    if(r.result_info.page!==page)throw Error("PAGE_DRIFT");if(page>1&&r.result_info.total_pages!==total)throw Error("PAGINATION_DRIFT");
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
  assert.deepEqual(qa.delta,p.delta);assert.equal(qa.devSqlTemplateSha256,p.devSqlTemplateSha256);
  const db=promotion.devOffReceipt;assert.ok(db&&typeof db==="object"&&!Array.isArray(db));
  assert.equal(hash(JSON.stringify(db)),promotion.devOffReceiptSha256);
  assert.equal(db.targetFingerprint,"63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba");
  assert.equal(db.devSqlTemplateSha256,p.devSqlTemplateSha256);assert.match(db.devSqlSha256,/^[a-f0-9]{64}$/);assert.notEqual(db.devSqlSha256,p.devSqlTemplateSha256);assert.equal(db.defaultOff,true);
  assert.equal(db.fixtureBranches,1);assert.equal(db.noPublicFixture,true);assert.equal(db.memberOnly,true);assert.equal(db.draftRows,0);assert.equal(db.registrationRows,0);
  assert.equal(db.activeGrants,0);assert.equal(db.temporarySessions,0);assert.equal(db.authenticatedOnly,true);
  assert.equal(db.productionWrites,0);assert.equal(db.sourceCommit,source);assert.equal(db.sourceRunId,promotion.sourceRunId);
  assert.equal(db.artifactDigest,promotion.artifactDigest);assert.equal(db.artifactId,promotion.artifactId);
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
async function verifyBase(p) {
  const api="https://api.github.com/repos/leisurewang0827/tennis-note-public", token=process.env.GH_TOKEN;
  assert.ok(token);
  const run=await get(`${api}/actions/runs/${p.baseRun}`,token);
  const a=await get(`${api}/actions/artifacts/${p.baseArtifactId}`,token);
  assert.equal(run.head_sha,p.baseSource);
  assert.equal(run.conclusion,"success");
  assert.equal(run.path,".github/workflows/r4-private-catalog-dev.yml");
  assert.equal(a.workflow_run?.id,p.baseRun);
  assert.equal(a.expired,false);
  assert.equal(a.name,`r4-private-catalog-dev-${p.baseRun}`);
  assert.equal(a.digest,`sha256:${p.baseArtifactDigest}`);
}
async function main() {
  const p=JSON.parse(readFileSync("release-sources/r4-scoped-member-catalog-dev/policy.json"));
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");assert.equal(process.env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const {stage,source}=classify(p,process.env.GITHUB_SHA),mode=process.argv[2];
  if(mode==="classify") {appendFileSync(process.env.GITHUB_OUTPUT,`stage=${stage}\nsource=${source}\n`);return;}
  if(mode==="compose" && stage==="source"){
    const built=await compose({files:walk("style-base/admin"),sealBytes:readFileSync("style-base/seal.json"),policy:p});
    const {mkdirSync}=await import("node:fs");
    for(const [name,bytes] of Object.entries(built.files)){const dest=join("internal-release/admin",name);mkdirSync(resolve(dest,".."),{recursive:true});writeFileSync(dest,bytes,{flag:"wx"});}
    writeFileSync("internal-release/seal.json",JSON.stringify({schema:1,source,privateCommit:p.privateCommit,baseSource:p.baseSource,baseSealSha256:p.baseSealSha256,admin:built.hashes})+"\n",{flag:"wx"});
    console.log("DEV_SCOPED_MEMBER_CATALOG_COMPOSE_PASS");return;
  }
  if(mode==="preflight" && stage==="source") {await verifyBase(p);await readTarget(p,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,fingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});console.log("DEV_SCOPED_MEMBER_CATALOG_READONLY_PREFLIGHT_PASS");return;}
  if(mode==="prepare-wrangler" && stage==="promotion") {
    const root=resolve(process.env.RUNNER_TEMP||"","r4-wrangler/node_modules/wrangler");
    assert.equal(JSON.parse(readFileSync(join(root,"package.json"))).version,"3.90.0");
    const patched=patchWrangler(readFileSync(join(root,"wrangler-dist/cli.js")));
    writeFileSync(join(root,"wrangler-dist/cli-r4-single.cjs"),patched,{flag:"wx"});console.log("DEV_SCOPED_MEMBER_CATALOG_SINGLE_POST_GUARD_READY");return;
  }
  if(mode==="admit" && stage==="promotion") {
    await verifyBase(p);
    const promotion=JSON.parse(readFileSync(promotionPath));validatePromotion(promotion,source,p);
    const token=process.env.GH_TOKEN;assert.ok(token);const api="https://api.github.com/repos/leisurewang0827/tennis-note-public";
    const run=await get(`${api}/actions/runs/${promotion.sourceRunId}`,token),artifact=await get(`${api}/actions/artifacts/${promotion.artifactId}`,token);
    assert.equal(run.head_sha,source);assert.equal(run.conclusion,"success");assert.equal(run.run_attempt,1);assert.equal(run.event,"push");assert.equal(run.path,".github/workflows/r4-scoped-member-catalog-dev.yml");
    assert.equal(artifact.workflow_run?.id,promotion.sourceRunId);assert.equal(artifact.name,`r4-scoped-member-catalog-dev-${promotion.sourceRunId}`);assert.equal(artifact.expired,false);assert.equal(artifact.digest,`sha256:${promotion.artifactDigest}`);
    const seal=readFileSync("style-artifact/seal.json");assert.equal(hash(seal),promotion.sealSha256);const parsed=JSON.parse(seal);
    assert.equal(parsed.source,source);assert.equal(parsed.privateCommit,p.privateCommit);assert.equal(parsed.baseSource,p.baseSource);assert.equal(parsed.baseSealSha256,p.baseSealSha256);
    assert.deepEqual(Object.fromEntries(Object.entries(walk("style-artifact/admin")).map(([k,v])=>[k,hash(v)])),parsed.admin);
    const expected=await compose({files:walk("style-base/admin"),sealBytes:readFileSync("style-base/seal.json"),baseDir:"style-base",policy:p});
    assert.deepEqual(parsed.admin,expected.hashes,"ARTIFACT_COMPOSITION_DRIFT");
    await readTarget(p,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,fingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});
    console.log("DEV_SCOPED_MEMBER_CATALOG_PROMOTION_ADMISSION_PASS");return;
  }
  if(mode==="postcheck" && stage==="promotion") {
    const parsed=JSON.parse(readFileSync("style-artifact/seal.json")),origin=`https://${p.previewBranch}.${p.project}.pages.dev`;
    const deploymentId=await published(p,source,process.env.PUBLISHED_URL);let immutableMatches=true,aliasMatches=true;
    for(const path of [...Object.keys(p.delta),"r4-product-draft-candidate.css","shared/config.local.js"]) {
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
    console.log(JSON.stringify({status:"DEV_SCOPED_MEMBER_CATALOG_POSTCHECK_PASS",deploymentId}));return;
  }
  if(mode==="recovery-admit" && stage==="promotion") {
    assert.equal(process.env.DEFINITE_MISMATCH,"true");const current=await published(p,source,process.env.PUBLISHED_URL);
    const baseSeal=readFileSync("style-base/seal.json");assert.equal(hash(baseSeal),p.baseSealSha256);
    const base=JSON.parse(baseSeal);assert.equal(base.source,p.baseSource);
    assert.deepEqual(Object.fromEntries(Object.entries(walk("style-base/admin")).map(([k,v])=>[k,hash(v)])),base.admin);
    validateRecovery({publishedDeploymentId:process.env.PUBLISHED_DEPLOYMENT_ID,currentAliasDeploymentId:current,knownPublished:true,uncertain:false,baselineSealVerified:true});
    console.log("DEV_SCOPED_MEMBER_CATALOG_RECOVERY_ADMISSION_PASS");return;
  }
  if(mode==="recovery-postcheck" && stage==="promotion") {
    const seal=JSON.parse(readFileSync("style-base/seal.json")),origin=`https://${p.previewBranch}.${p.project}.pages.dev`;
    const recoveryId=await published(p,p.baseSource,process.env.RECOVERY_URL);
    for(const path of ["index.html","views/settings.js","r4-product-draft-candidate.css","r4-product-draft-host-candidate.js","r4-onboarding.js","shared/config.local.js"]) {
      for(const base of [process.env.RECOVERY_URL,origin]) {
        const response=await fetch(base+requestPath(path),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
        assert.equal(response.status,200,"RECOVERY_READ_FAILED");assert.equal(hash(Buffer.from(await response.arrayBuffer())),seal.admin[path],"RECOVERY_ASSET_DRIFT");
      }
    }
    assert.equal(await published(p,p.baseSource,process.env.RECOVERY_URL),recoveryId,"RECOVERY_ALIAS_DRIFT");
    console.log(JSON.stringify({status:"DEV_SCOPED_MEMBER_CATALOG_RECOVERY_POSTCHECK_PASS",deploymentId:recoveryId}));return;
  }
  throw Error("INVALID_MODE");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(safeFailure(e));process.exitCode=1;});
