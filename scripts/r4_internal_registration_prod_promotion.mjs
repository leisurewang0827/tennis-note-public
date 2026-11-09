// Administrator-only production promotion; every external write is separately gated.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,writeFileSync,appendFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {request as httpsRequest} from "node:https";
import {patchWrangler} from "./r4_internal_registration_dev.mjs";
import {validate as validateBaseline} from "./r4_internal_registration_prod_preflight.mjs";
import {compose} from "../release-sources/r4-internal-registration-prod/production-overlay.mjs";
const h=b=>createHash("sha256").update(b).digest("hex"),read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const prodId="cfb8595d-dc30-4d50-88a5-fb611aa2dcd0",baseSource="cc38b03df566c6b3d297e77a00e61757935c4a45";
const install="f76086eea58d4aa0e87a53d370e2c298f485b8500b69ed47249415c4be441ac3",verify="6869e4f4f09c3289737dc90e29f014b6f25a2ef331e9182bf9f10144f1ddafc0";
const promotionPath="release-promotions/r4-internal-registration-prod/promotion.json";
const sourcePaths=[".github/workflows/r4-internal-registration-prod-source.yml","release-sources/r4-internal-registration-prod/production-host.js","release-sources/r4-internal-registration-prod/production-overlay.mjs","scripts/build_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod_browser.mjs"].sort();
const preflightPaths=[".github/workflows/r4-internal-registration-prod-preflight.yml","scripts/check_r4_internal_registration_prod_preflight.mjs","scripts/r4_internal_registration_prod_preflight.mjs"].sort();
const finalPaths=[".github/workflows/r4-internal-registration-prod-promotion.yml",promotionPath,"scripts/check_r4_internal_registration_prod_promotion.mjs","scripts/r4_internal_registration_prod_promotion.mjs"].sort();
const walk=(dir,p="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+"/")):[[p+e.name,read(join(dir,e.name))]];
}));
export function patchProductionWrangler(bytes) {
  const original=patchWrangler(bytes),needle="tennisnote-admin-dev";
  assert.equal(original.split(needle).length,3,"TRANSPORT_SCOPE_DRIFT");
  const patched=original.replaceAll(needle,"tennisnote-admin");
  assert.ok(!patched.includes(needle),"DEV_TARGET_REMAINS");return patched;
}
export function validateOff(p) {
  assert.match(p.sourceCommit||"",/^[a-f0-9]{40}$/);assert.match(p.preflightCommit||"",/^[a-f0-9]{40}$/);
  for(const n of ["sourceRunId","sourceArtifactId","preflightRunId"])assert.ok(Number.isSafeInteger(p[n])&&p[n]>0);
  for(const n of ["artifactDigest","sealSha256","offReceiptSha256"])assert.match(p[n]||"",/^[a-f0-9]{64}$/);
  const r=p.offReceipt;assert.ok(r&&!Array.isArray(r)&&typeof r==="object");assert.equal(h(JSON.stringify(r)),p.offReceiptSha256);
  assert.equal(r.targetFingerprint,"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a");
  assert.equal(r.installSqlSha256,install);assert.equal(r.verifySqlSha256,verify);
  assert.equal(r.sourceCommit,p.sourceCommit);assert.equal(r.sourceRunId,p.sourceRunId);assert.equal(r.artifactDigest,p.artifactDigest);
  for(const k of ["draftOff","internalOff","rpcAclOk","privateRlsAclOk","oldContractUnchanged","existingWorkspaceCreateUnchanged","existingPilotOff","devScopeAbsent"])assert.equal(r[k],true,`OFF_${k}`);
  for(const k of ["accessRows","draftRows","registrationRows"])assert.equal(r[k],0,`OFF_${k}`);assert.equal(r.publicRpcCount,4);
}
export function recoveryDecision({knownPublished,currentId,expectedId,immutableMismatch,uncertain}) {
  if(uncertain || !knownPublished || !immutableMismatch || !expectedId || currentId!==expectedId)return "HOLD";
  return "ROLLBACK_ONCE";
}
export function assertFinalCanonical(result,expectedId,expectedSource) {
  assert.equal(result?.success,true);assert.equal(result?.result?.name,"tennisnote-admin");assert.equal(result?.result?.production_branch,"main");
  assert.equal(result?.result?.canonical_deployment?.id,expectedId,"CANONICAL_FINAL_DRIFT");
  assert.equal(result?.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,expectedSource,"CANONICAL_FINAL_SOURCE_DRIFT");
}
let rollbackSent=false;
export async function postRollbackOnce(url,token,requester=httpsRequest) {
  const target=new URL(url);
  assert.equal(target.protocol,"https:");assert.equal(target.host,"api.cloudflare.com");
  assert.match(target.pathname,/^\/client\/v4\/accounts\/[a-f0-9]{32}\/pages\/projects\/tennisnote-admin\/deployments\/cfb8595d-dc30-4d50-88a5-fb611aa2dcd0\/rollback$/);
  assert.equal(target.search,"");assert.equal(target.hash,"");assert.ok(token);assert.equal(rollbackSent,false,"ROLLBACK_RETRY_DENIED");rollbackSent=true;
  return await new Promise((resolve,reject)=>{
    const req=requester(target,{method:"POST",headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}},res=>{
      const chunks=[];let size=0;res.on("data",chunk=>{size+=chunk.length;if(size>1048576){req.destroy(Error("RESPONSE_TOO_LARGE"));return;}chunks.push(chunk);});
      res.on("error",reject);res.on("end",()=>{try{assert.equal(res.statusCode,200);const result=JSON.parse(Buffer.concat(chunks).toString("utf8"));assert.equal(result.success,true);resolve(true);}catch{reject(Error("ROLLBACK_OUTCOME_UNCERTAIN"));}});
    });
    req.on("error",()=>reject(Error("ROLLBACK_OUTCOME_UNCERTAIN")));req.setTimeout(20000,()=>req.destroy(Error("TIMEOUT")));req.end();
  });
}
function scope(p) {
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");assert.equal(process.env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const sha=process.env.GITHUB_SHA;assert.match(sha||"",/^[a-f0-9]{40}$/);const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
  const parents=(x)=>git("rev-list","--parents","-n","1",x).split(" ");
  const paths=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
  assert.deepEqual(parents(sha),[sha,p.preflightCommit]);assert.deepEqual(paths(p.preflightCommit,sha),finalPaths);
  assert.deepEqual(parents(p.preflightCommit),[p.preflightCommit,p.sourceCommit]);assert.deepEqual(paths(p.sourceCommit,p.preflightCommit),preflightPaths);
  assert.deepEqual(parents(p.sourceCommit),[p.sourceCommit,"7ecba95a6c6304563ee0b919a57b56de5366ccce"]);assert.deepEqual(paths("7ecba95a6c6304563ee0b919a57b56de5366ccce",p.sourceCommit),sourcePaths);
  return sha;
}
async function get(url,token) {const r=await fetch(url,{method:"GET",headers:token?{Authorization:`Bearer ${token}`,Accept:"application/json"}:{},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});if(r.status!==200)throw Error("READ_FAILED");return r;}
function credentials() {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.R4_ADMIN_CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token&&gh);assert.equal(h(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  return {token,gh,cf:`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`,api:"https://api.github.com/repos/leisurewang0827/tennis-note-public"};
}
async function freshBaseline(c) {
  const [project,recovery,run,artifact,index,immutable]=await Promise.all([(await get(c.cf,c.token)).json(),(await get(`${c.cf}/deployments/${prodId}`,c.token)).json(),(await get(`${c.api}/actions/runs/42449225848`,c.gh)).json(),(await get(`${c.api}/actions/artifacts/13604763261`,c.gh)).json(),(await get("https://tennisnote-admin.pages.dev/")).arrayBuffer(),(await get("https://cfb8595d.tennisnote-admin.pages.dev/")).arrayBuffer()]);
  assert.equal(project.success,true);assert.equal(recovery.success,true);
  const result=validateBaseline({project:project.result,recovery:recovery.result,run,artifact,sealBytes:read("prod-base/seal.json"),admin:walk("prod-base/admin"),indexBytes:Buffer.from(index),immutableBytes:Buffer.from(immutable),now:Date.now()});
  const fresh=await (await get(c.cf,c.token)).json();assertFinalCanonical(fresh,prodId,baseSource);return result;
}
async function admit(p) {
  const c=credentials(),source=await (await get(`${c.api}/actions/runs/${p.sourceRunId}`,c.gh)).json(),preflight=await (await get(`${c.api}/actions/runs/${p.preflightRunId}`,c.gh)).json();
  for(const [r,sha,path] of [[source,p.sourceCommit,".github/workflows/r4-internal-registration-prod-source.yml"],[preflight,p.preflightCommit,".github/workflows/r4-internal-registration-prod-preflight.yml"]]) {
    assert.equal(r.head_sha,sha);assert.equal(r.path,path);assert.equal(r.conclusion,"success");assert.equal(r.run_attempt,1);assert.equal(r.event,"push");
  }
  const artifact=await (await get(`${c.api}/actions/artifacts/${p.sourceArtifactId}`,c.gh)).json();
  assert.equal(artifact.workflow_run?.id,p.sourceRunId);assert.equal(artifact.name,`r4-internal-registration-prod-source-${p.sourceRunId}`);assert.equal(artifact.expired,false);assert.equal(artifact.digest,`sha256:${p.artifactDigest}`);
  const sealBytes=read("prod-artifact/seal.json");assert.equal(h(sealBytes),p.sealSha256);const seal=JSON.parse(sealBytes);
  assert.equal(seal.source,p.sourceCommit);assert.equal(seal.installSqlSha256,install);assert.equal(seal.verifySqlSha256,verify);
  const actual=walk("prod-artifact/admin");assert.deepEqual(Object.fromEntries(Object.entries(actual).map(([k,v])=>[k,h(v)])),seal.admin);assert.equal(Object.keys(actual).length,172);
  const base=walk("prod-base/admin"),{delta}=compose({files:base,sealBytes:read("prod-base/seal.json"),draftSource:read("release-sources/r4-product-draft-dev/r4-product-draft-candidate.js"),registrationSource:read("release-sources/r4-internal-registration-dev/registration-ui.js"),hostSource:read("release-sources/r4-internal-registration-prod/production-host.js"),cssSource:read("release-sources/r4-product-draft-style-dev/candidate.css")});
  const expected={...base,...delta};assert.deepEqual(Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,h(v)])),seal.admin,"ARTIFACT_DRIFT");
  await freshBaseline(c);console.log("PROD_ADMIN_PROMOTION_ADMISSION_PASS");
}
async function post(p) {
  const c=credentials(),response=await (await get(c.cf,c.token)).json(),current=response.result?.canonical_deployment;
  assert.equal(response.success,true);assert.equal(response.result?.name,"tennisnote-admin");assert.equal(response.result?.production_branch,"main");
  assert.match(current?.id||"",/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.notEqual(current.id,prodId);
  assert.equal(current.deployment_trigger?.metadata?.branch,"main");assert.equal(current.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);assert.equal(current.latest_stage?.status,"success");
  const seal=json("prod-artifact/seal.json");assert.equal(h(read("prod-artifact/seal.json")),p.sealSha256);
  const immutable=`https://${current.id.slice(0,8)}.tennisnote-admin.pages.dev`;
  assert.equal(immutable,process.env.PUBLISHED_URL,"PUBLISHED_ID_UNCERTAIN");
  const paths=["index.html","r4-onboarding.js","r4-product-draft-candidate.js","r4-internal-product-registration.js","r4-production-draft-host.js","r4-product-draft-candidate.css","shared/config.local.js","release.json"];
  let immutableMatches=true,canonicalMatches=true;
  for(const path of paths)for(const [base,isImmutable] of [[immutable,true],["https://tennisnote-admin.pages.dev",false]]) {
    const bytes=Buffer.from(await (await get(base+(path==="index.html"?"/":`/${path}`))).arrayBuffer());
    if(h(bytes)!==seal.admin[path]){if(isImmutable)immutableMatches=false;else canonicalMatches=false;}
  }
  const fresh=await (await get(c.cf,c.token)).json();assertFinalCanonical(fresh,current.id,p.sourceCommit);
  if(!immutableMatches) {appendFileSync(process.env.GITHUB_OUTPUT,`definite_mismatch=true\ndeployment_id=${current.id}\n`);throw Error("IMMUTABLE_MISMATCH");}
  assert.equal(canonicalMatches,true,"CANONICAL_READBACK_UNCERTAIN");
  console.log(JSON.stringify({status:"PROD_ADMIN_POSTCHECK_PASS",deploymentId:current.id,immutable,rollbackId:prodId}));
}
async function rollback(p) {
  const c=credentials(),published=process.env.PUBLISHED_DEPLOYMENT_ID;
  const project=await (await get(c.cf,c.token)).json(),current=project.result?.canonical_deployment;
  assert.equal(project.success,true);assert.equal(project.result?.name,"tennisnote-admin");assert.equal(project.result?.production_branch,"main");
  assert.match(published||"",/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const decision=recoveryDecision({knownPublished:true,currentId:current?.id,expectedId:published,immutableMismatch:process.env.DEFINITE_MISMATCH==="true",uncertain:false});
  assert.equal(decision,"ROLLBACK_ONCE");assert.equal(current?.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);
  const old=await (await get(`${c.cf}/deployments/${prodId}`,c.token)).json();assert.equal(old.success,true);assert.equal(old.result?.id,prodId);assert.equal(old.result?.latest_stage?.status,"success");assert.equal(old.result?.deployment_trigger?.metadata?.branch,"main");assert.equal(old.result?.deployment_trigger?.metadata?.commit_hash,baseSource);
  const fresh=await (await get(c.cf,c.token)).json();assert.equal(fresh.success,true);assert.equal(fresh.result?.name,"tennisnote-admin");assert.equal(fresh.result?.production_branch,"main");assert.equal(fresh.result?.canonical_deployment?.id,published,"ROLLBACK_RECHECK_DRIFT");assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,p.sourceCommit);
  await postRollbackOnce(`${c.cf}/deployments/${prodId}/rollback`,c.token);
  await freshBaseline(c);console.log("PROD_ADMIN_ROLLBACK_POSTCHECK_PASS");
}
async function main() {
  const p=json(promotionPath);validateOff(p);scope(p);
  if(process.argv[2]==="admit")return admit(p);
  if(process.argv[2]==="prepare") {const root=join(process.env.RUNNER_TEMP,"r4-wrangler/node_modules/wrangler");assert.equal(json(join(root,"package.json")).version,"3.90.0");writeFileSync(join(root,"wrangler-dist/cli-r4-single.cjs"),patchProductionWrangler(read(join(root,"wrangler-dist/cli.js"))),{flag:"wx"});return;}
  if(process.argv[2]==="post")return post(p);
  if(process.argv[2]==="rollback")return rollback(p);
  throw Error("INVALID_MODE");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error("PROD_ADMIN_PROMOTION_BLOCKED");process.exitCode=1;});
