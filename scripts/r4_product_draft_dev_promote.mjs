// Promotion admission only: never creates an artifact or executes a deployment.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync,readdirSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {preflight} from "./r4_product_draft_dev_release.mjs";
const hash=x=>createHash("sha256").update(x).digest("hex"),read=x=>readFileSync(x);
const walk=(dir,p="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink(),"SYMLINK_DENIED");return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+"/")):[[p+e.name,hash(read(join(dir,e.name)))]];
}));
async function get(url,token) {
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,200,"GITHUB_READ_FAILED");return r.json();
}
export function checkDeclaration(policy,promotion) {
  assert.equal(promotion.schema,1);assert.equal(promotion.privateCommit,policy.privateCommit);
  assert.match(policy.privateCommit||"",/^[a-f0-9]{40}$/,"PRIVATE_SOURCE_UNBOUND");
  assert.equal(promotion.targetFingerprint,"63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba");
  assert.equal(promotion.assembledSqlSha256,policy.privateSourceSha256.assembledSql);
  assert.equal(promotion.dbGateOffConfirmed,true);assert.match(promotion.dbReceiptSha256||"",/^[a-f0-9]{64}$/, "DB_RECEIPT_UNBOUND");
  const receipt=promotion.dbReceipt;
  assert.ok(receipt && typeof receipt==="object" && !Array.isArray(receipt),"DB_RECEIPT_MISSING");
  assert.equal(hash(JSON.stringify(receipt)),promotion.dbReceiptSha256,"DB_RECEIPT_HASH_DRIFT");
  assert.equal(receipt.targetFingerprint,promotion.targetFingerprint);assert.equal(receipt.assembledSqlSha256,promotion.assembledSqlSha256);
  assert.equal(receipt.gateOff,true);assert.equal(receipt.temporaryLeaseCount,0);assert.equal(receipt.productionWrites,0);
  assert.ok(Number.isSafeInteger(promotion.sourceRunId) && Number.isSafeInteger(promotion.artifactId));
  assert.match(promotion.artifactDigest||"",/^[a-f0-9]{64}$/);assert.match(promotion.sealSha256||"",/^[a-f0-9]{64}$/);
}
export async function admit(policy,promotion) {
  const sha=process.env.GITHUB_SHA,token=process.env.GH_TOKEN;
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF,`refs/heads/${policy.branch}`);assert.equal(process.env.GITHUB_EVENT_NAME,"push");
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");assert.match(sha||"",/^[a-f0-9]{40}$/);assert.ok(token);
  assert.match(promotion.sourceCommit||"",/^[a-f0-9]{40}$/);
  assert.equal(execFileSync("git",["rev-list","--parents","-n","1",sha],{encoding:"utf8"}).trim(),`${sha} ${promotion.sourceCommit}`,"PROMOTION_PARENT_DRIFT");
  assert.equal(execFileSync("git",["rev-list","--parents","-n","1",promotion.sourceCommit],{encoding:"utf8"}).trim(),`${promotion.sourceCommit} ${policy.parent}`,"SOURCE_PARENT_DRIFT");
  assert.deepEqual(execFileSync("git",["diff","--name-only",promotion.sourceCommit,sha],{encoding:"utf8"}).trim().split("\n"),
    ["release-promotions/r4-product-draft-dev/promotion.json"],"PROMOTION_SCOPE_DRIFT");
  assert.deepEqual(execFileSync("git",["diff","--name-only",policy.parent,promotion.sourceCommit],{encoding:"utf8"}).trim().split("\n").sort(),policy.exactPaths.toSorted(),"SOURCE_SCOPE_DRIFT");
  checkDeclaration(policy,promotion);
  const repo="https://api.github.com/repos/leisurewang0827/tennis-note-public";
  const run=await get(`${repo}/actions/runs/${promotion.sourceRunId}`,token),artifact=await get(`${repo}/actions/artifacts/${promotion.artifactId}`,token);
  assert.equal(run.head_sha,promotion.sourceCommit);assert.equal(run.conclusion,"success");assert.equal(run.run_attempt,1);
  assert.equal(run.event,"push");assert.equal(run.path,".github/workflows/r4-product-draft-dev-source.yml");
  assert.equal(artifact.name,`r4-product-draft-dev-${promotion.sourceRunId}`);assert.equal(artifact.expired,false);
  assert.equal(artifact.digest,`sha256:${promotion.artifactDigest}`);assert.equal(artifact.workflow_run?.id,promotion.sourceRunId);
  const sealBytes=read("promotion-artifact/seal.json");assert.equal(hash(sealBytes),promotion.sealSha256,"ARTIFACT_SEAL_DRIFT");
  const seal=JSON.parse(sealBytes);assert.equal(seal.sha,promotion.sourceCommit);assert.equal(seal.privateCommit,policy.privateCommit);
  assert.equal(seal.baseSha,policy.baseSha);assert.deepEqual(walk("promotion-artifact/admin"),seal.admin,"ARTIFACT_CONTENT_DRIFT");
  await preflight(policy);
  console.log(JSON.stringify({status:"DEV_PREVIEW_PROMOTION_ADMISSION_PASS",sourceCommit:promotion.sourceCommit}));
}
export async function postcheck(policy,promotion) {
  const origin=`https://${policy.previewBranch}.${policy.project}.pages.dev`;
  assert.equal(origin,"https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev");
  const seal=JSON.parse(read("promotion-artifact/seal.json"));
  const paths=["index.html","r4-onboarding.js","r4-product-draft-candidate.js","r4-product-draft-host-candidate.js",
    "r4-product-draft-candidate.css","r4-product-draft-dev-scoped-candidate.js","shared/config.local.js"];
  for(const path of paths) {
    const response=await fetch(origin+(path==="index.html"?"/":"/"+path),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,"PREVIEW_READ_FAILED");
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),seal.admin[path],"PREVIEW_ASSET_DRIFT");
    if(path==="shared/config.local.js") {
      const text=bytes.toString();assert.match(text,/["']?environment["']?\s*:\s*["']development["']/);
      assert.ok(text.includes("63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"),"PREVIEW_PROJECT_DRIFT");
    }
  }
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);
  assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const api=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${policy.project}`;
  const response=await get(api,token);assert.equal(response.success,true);
  const current=response.result?.canonical_deployment;
  assert.equal(current?.id,policy.canonicalId,"CANONICAL_CHANGED");
  assert.equal(current?.deployment_trigger?.metadata?.commit_hash,policy.canonicalSha,"CANONICAL_SHA_CHANGED");
  assert.equal(current?.latest_stage?.status,"success");
  console.log(JSON.stringify({status:"DEV_PREVIEW_ASSET_READBACK_PASS",sourceCommit:promotion.sourceCommit,canonicalUnchanged:true}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const policy=JSON.parse(read("release-sources/r4-product-draft-dev/policy.json")),promotion=JSON.parse(read("release-promotions/r4-product-draft-dev/promotion.json"));
    if(process.argv[2]==="admit")await admit(policy,promotion);
    else if(process.argv[2]==="postcheck")await postcheck(policy,promotion);
    else throw Error("INVALID_MODE");}
  catch(e){console.error("R4_DEV_PREVIEW_PROMOTION_BLOCKED: "+String(e.message).split("\n")[0].slice(0,150));process.exitCode=1;}
}
