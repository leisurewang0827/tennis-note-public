// Admin-only DEV preview: staged source verification and read-only admission.
// This file never deploys. Promotion requires a separately bound successor.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync,readdirSync,mkdirSync,cpSync,writeFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "../release-sources/r4-product-draft-dev/overlay-builder.mjs";
import {validate} from "../release-sources/r4-product-draft-dev/preflight-guard.mjs";
const root="release-sources/r4-product-draft-dev/", hash=x=>createHash("sha256").update(x).digest("hex");
const read=path=>readFileSync(path), json=path=>JSON.parse(read(path));
const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink(),"SYMLINK_DENIED");
  return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+"/")):[[prefix+e.name,hash(read(join(dir,e.name)))]];
}));
const get=async(url,token)=>{
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,200,"REMOTE_READ_FAILED");return r.json();
};
export function checkCandidate(policy) {
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF,`refs/heads/${policy.branch}`);
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const sha=process.env.GITHUB_SHA;assert.match(sha||"",/^[a-f0-9]{40}$/);assert.match(policy.privateCommit||"",/^[a-f0-9]{40}$/, "PRIVATE_SOURCE_UNBOUND");
  const parents=execFileSync("git",["rev-list","--parents","-n","1",sha],{encoding:"utf8"}).trim();
  assert.equal(parents,`${sha} ${policy.parent}`,"PARENT_DRIFT");
  const paths=execFileSync("git",["diff","--name-only",policy.parent,sha],{encoding:"utf8"}).trim().split("\n").sort();
  assert.deepEqual(paths,policy.exactPaths.toSorted(),"SCOPE_DRIFT");
  for(const [name,digest] of Object.entries(policy.sourceSha256))assert.equal(hash(read(root+name)),digest,"SOURCE_DRIFT");
  return sha;
}
export async function buildAdmin(policy,sha) {
  const githubToken=process.env.GH_TOKEN;assert.ok(githubToken,"GITHUB_TOKEN_REQUIRED");
  const repo="https://api.github.com/repos/leisurewang0827/tennis-note-public";
  const run=await get(`${repo}/actions/runs/${policy.baseRun}`,githubToken);
  const artifact=await get(`${repo}/actions/artifacts/${policy.baseArtifactId}`,githubToken);
  assert.equal(run.head_sha,policy.baseSha);assert.equal(run.conclusion,"success");assert.equal(run.run_attempt,1);
  assert.equal(artifact.name,policy.baseArtifactName);assert.equal(artifact.expired,false);
  assert.equal(artifact.digest,`sha256:${policy.baseArtifactSha256}`,"BASE_ARTIFACT_DRIFT");
  const sealBytes=read("draft-base/seal.json");assert.equal(hash(sealBytes),policy.baseSealSha256,"BASE_SEAL_DRIFT");
  const seal=JSON.parse(sealBytes);assert.equal(seal.sha,policy.baseSha,"BASE_SOURCE_DRIFT");
  const baseline=walk("draft-base/admin");assert.deepEqual(baseline,seal.admin,"BASE_ADMIN_DRIFT");
  const index=read("draft-base/admin/index.html"),onboarding=read("draft-base/admin/r4-onboarding.js");
  const sources={module:read(root+"r4-product-draft-candidate.js"),host:read(root+"r4-product-draft-host-candidate.js"),
    css:read(root+"r4-product-draft-candidate.css"),scoped:read(root+"r4-product-draft-dev-scoped-candidate.js"),
    overlayBuilder:read(root+"overlay-builder.mjs"),guardHash:policy.privateSourceSha256.guard,
    serverHash:policy.privateSourceSha256.server,sqlBuilderHash:policy.privateSourceSha256.sqlBuilder};
  const overlay=await build({index,onboarding,pins:{index:hash(index),onboarding:hash(onboarding)},sources});
  mkdirSync("draft-release");cpSync("draft-base/admin","draft-release/admin",{recursive:true,errorOnExist:true,force:false});
  for(const [path,data] of Object.entries(overlay.files))writeFileSync(join("draft-release/admin",path),data);
  const after=walk("draft-release/admin"),delta=Object.keys({...baseline,...after}).filter(k=>baseline[k]!==after[k]).sort();
  assert.deepEqual(delta,Object.keys(overlay.files).sort(),"ADMIN_SCOPE_DRIFT");
  const manifest={schema:1,sha,privateCommit:policy.privateCommit,baseSha:policy.baseSha,token:overlay.token,admin:after};
  writeFileSync("draft-release/seal.json",JSON.stringify(manifest)+"\n",{flag:"wx"});
  console.log(JSON.stringify({status:"ADMIN_BUILD_PASS",fileChanges:delta.length,sha}));
}
export async function preflight(policy) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);
  const accountFingerprint=hash(account);assert.equal(accountFingerprint,process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${policy.project}`;
  const projectResponse=await get(base,token);assert.equal(projectResponse.success,true);
  const priorResponse=await get(`${base}/deployments/${policy.recoveryId}`,token);assert.equal(priorResponse.success,true);
  let page=1,totalPages=1,preview=[];
  do {
    const result=await get(`${base}/deployments?per_page=100&page=${page}`,token);
    assert.equal(result.success,true);assert.ok(Array.isArray(result.result));
    assert.ok(Number.isInteger(result.result_info?.total_pages) && result.result_info.total_pages>=1 && result.result_info.total_pages<=100,"PAGINATION_UNKNOWN");
    if(page>1)assert.equal(result.result_info.total_pages,totalPages,"PAGINATION_DRIFT");
    totalPages=result.result_info.total_pages;
    preview.push(...result.result.filter(x=>x?.deployment_trigger?.metadata?.branch===policy.previewBranch));page++;
  } while(page<=totalPages);
  const result=validate({accountFingerprint,project:projectResponse.result,canonical:projectResponse.result?.canonical_deployment,
    recovery:priorResponse.result,preview},{...policy,accountFingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});
  console.log(JSON.stringify({status:"DEV_PREVIEW_PREFLIGHT_PASS",...result}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const policy=json(root+"policy.json"),sha=checkCandidate(policy);
    if(process.argv[2]==="build")await buildAdmin(policy,sha);
    else if(process.argv[2]==="preflight")await preflight(policy);
    else throw Error("INVALID_MODE");
  } catch(e) {console.error("R4_DEV_PREVIEW_BLOCKED: "+String(e.message).split("\n")[0].slice(0,150));process.exitCode=1;}
}
