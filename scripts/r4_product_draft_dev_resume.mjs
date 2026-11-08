// DEV-only resume: the original build and the fresh read-only gate stay separate.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {appendFileSync,readFileSync,readdirSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {validate} from "../release-sources/r4-product-draft-dev/preflight-guard.mjs";
import {checkDeclaration,postcheck} from "./r4_product_draft_dev_promote.mjs";

const source="0b21d398c508a515c6bd53ae38d8843a522239a0", diag="147bee0d433de3b66219c11145e16d83bb73f199";
const branch="codex/tennisnote-r4-ui-finish-dev-20261108", dir="release-resumes/r4-product-draft-dev/";
const resumePaths=[".github/workflows/r4-product-draft-dev-resume.yml","scripts/r4_product_draft_dev_resume.mjs","scripts/check_r4_product_draft_dev_resume.mjs",dir+"resume.json"].sort();
const diagPins={".github/workflows/r4-product-draft-dev-diagnostic.yml":"da1b3a0dd33d109f8fe9b9cd1ce598eb749c85b9a5ac3fbadbd2a5155726a919", "scripts/r4_product_draft_dev_diagnostic.mjs":"bb6506f579e97995eff9f38df12f8052daaf9e0518657f6634cb529eb4d7d878", "release-diagnostics/r4-product-draft-dev/diagnostic.json":"551155537b7526df8a4c24af33136f89375a4f5191f955071cdd3578fe1f5397"};
const hash=x=>createHash("sha256").update(x).digest("hex"), read=p=>readFileSync(p), json=p=>JSON.parse(read(p));
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const parent=(child,expected)=>assert.equal(git("rev-list","--parents","-n","1",child),`${child} ${expected}`,"PARENT_DRIFT");
const paths=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
const walk=(dir,p="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink(),"SYMLINK_DENIED");return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+"/")):[[p+e.name,hash(read(join(dir,e.name)))]];
}));
export function classify({sha,parents,diff}) {
  assert.match(sha||"",/^[a-f0-9]{40}$/);
  if(parents===`${sha} ${diag}` && JSON.stringify(diff.toSorted())===JSON.stringify(resumePaths)) return "preflight";
  if(parents.split(" ").length===2 && JSON.stringify(diff)==JSON.stringify([dir+"promotion.json"])) return "promotion";
  throw Error("CHECKPOINT_SCOPE_DRIFT");
}
function stage() {
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF,`refs/heads/${branch}`);assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const sha=process.env.GITHUB_SHA, parents=git("rev-list","--parents","-n","1",sha), parentSha=parents.split(" ")[1];
  const kind=classify({sha,parents,diff:paths(parentSha,sha)}), checkpoint=kind==="preflight"?sha:parentSha;
  parent(checkpoint,diag);parent(diag,source);
  assert.deepEqual(paths(source,diag),Object.keys(diagPins).sort());
  for(const [p,h] of Object.entries(diagPins)) assert.equal(hash(execFileSync("git",["show",`${diag}:${p}`])),h,"DIAGNOSTIC_BLOB_DRIFT");
  assert.deepEqual(paths(diag,checkpoint),resumePaths,"RESUME_SCOPE_DRIFT");
  const spec=json(dir+"resume.json");assert.equal(spec.schema,1);assert.equal(spec.diagnosticCommit,diag);assert.equal(spec.sourceCommit,source);
  assert.deepEqual(Object.keys(spec.pins).sort(),resumePaths.filter(x=>!x.endsWith("resume.json")));
  for(const [p,h] of Object.entries(spec.pins)) assert.equal(hash(execFileSync("git",["show",`${checkpoint}:${p}`])),h,"RESUME_BLOB_DRIFT");
  if(kind==="promotion") {
    const p=json(dir+"promotion.json");assert.equal(p.resumeCommit,checkpoint);assert.equal(p.sourceCommit,source);
    assert.match(p.qaReceiptSha256||"",/^[a-f0-9]{64}$/);assert.ok(p.qaReceipt && typeof p.qaReceipt==="object");
    assert.equal(hash(JSON.stringify(p.qaReceipt)),p.qaReceiptSha256,"QA_RECEIPT_DRIFT");
    assert.equal(p.qaReceipt.resumeCommit,checkpoint);assert.equal(p.qaReceipt.sourceCommit,source);assert.equal(p.qaReceipt.approved,true);
  }
  return {kind,checkpoint};
}
export function safeFailure(error) {
  const code=error?.message;
  if(typeof code==="string" && /^(cf_project|cf_recovery|cf_list|gh)_HTTP_(?:[1-5][0-9]{2})$/.test(code)) return code;
  if(["PAGINATION_UNKNOWN","PAGE_DRIFT","PAGINATION_DRIFT"].includes(code)) return code;
  return "R4_DEV_RESUME_BLOCKED";
}
export async function get(url,token,route="gh",fetcher=fetch) {
  assert.ok(["cf_project","cf_recovery","cf_list","gh"].includes(route));
  const r=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(r.status!==200) throw Error(`${route}_HTTP_${r.status}`);return r.json();
}
export async function preflight(policy,{account,token,fingerprint,fetcher=get}) {
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token);assert.equal(hash(account),fingerprint,"ACCOUNT_DRIFT");
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${policy.project}`;
  const project=await fetcher(base,token,"cf_project"), recovery=await fetcher(`${base}/deployments/${policy.recoveryId}`,token,"cf_recovery");
  assert.equal(project.success,true);assert.equal(recovery.success,true);
  let page=1,total=1,preview=[];
  do {
    const r=await fetcher(`${base}/deployments?page=${page}`,token,"cf_list");assert.equal(r.success,true);assert.ok(Array.isArray(r.result));
    if(!(Number.isInteger(r.result_info?.total_pages) && r.result_info.total_pages>=1 && r.result_info.total_pages<=100)) throw Error("PAGINATION_UNKNOWN");
    if(r.result_info.page!==page) throw Error("PAGE_DRIFT");if(page>1 && r.result_info.total_pages!==total) throw Error("PAGINATION_DRIFT");
    total=r.result_info.total_pages;preview.push(...r.result.filter(x=>x?.deployment_trigger?.metadata?.branch===policy.previewBranch));page++;
  } while(page<=total);
  return validate({accountFingerprint:hash(account),project:project.result,canonical:project.result?.canonical_deployment,recovery:recovery.result,preview},{...policy,accountFingerprint:fingerprint});
}
async function verifyGithub(policy,checkpoint,kind) {
  const token=process.env.GH_TOKEN;assert.ok(token);const api="https://api.github.com/repos/leisurewang0827/tennis-note-public";
  const run=await get(`${api}/actions/runs/42489115768`,token), jobs=await get(`${api}/actions/runs/42489115768/jobs?per_page=100`,token), artifact=await get(`${api}/actions/artifacts/13620632569`,token);
  assert.equal(run.head_sha,source);assert.equal(run.conclusion,"failure");assert.equal(run.run_attempt,1);assert.equal(run.event,"push");
  assert.equal(run.path,".github/workflows/r4-product-draft-dev-source.yml");assert.equal(jobs.total_count,2);
  const build=jobs.jobs.filter(j=>j.id===128757377952 && j.name==="build");assert.equal(build.length,1);assert.equal(build[0].conclusion,"success");
  assert.equal(artifact.id,13620632569);assert.equal(artifact.name,"r4-product-draft-dev-42489115768");assert.equal(artifact.expired,false);
  assert.equal(artifact.digest,"sha256:4ec011eae442175915bb85dedb6893a6c2318f8046b4f5b0807343f5b69addd2");assert.equal(artifact.workflow_run?.id,42489115768);
  const sealBytes=read("promotion-artifact/seal.json");assert.equal(hash(sealBytes),"c6b99afbd52a1d0c878df0c1cb8190f6333ac2828ada6873ffabef7288b1451b");
  const seal=JSON.parse(sealBytes);assert.equal(seal.sha,source);assert.equal(seal.privateCommit,policy.privateCommit);assert.equal(seal.baseSha,policy.baseSha);
  assert.deepEqual(walk("promotion-artifact/admin"),seal.admin,"ARTIFACT_CONTENT_DRIFT");
  if(kind==="promotion") {
    const p=json(dir+"promotion.json");checkDeclaration(policy,p);
    assert.equal(p.sourceRunId,42489115768);assert.equal(p.artifactId,13620632569);assert.equal(p.artifactDigest,artifact.digest.slice(7));assert.equal(p.sealSha256,hash(sealBytes));
    assert.ok(Number.isSafeInteger(p.resumeRunId));const pre=await get(`${api}/actions/runs/${p.resumeRunId}`,token);
    assert.equal(pre.head_sha,checkpoint);assert.equal(pre.conclusion,"success");assert.equal(pre.run_attempt,1);assert.equal(pre.event,"push");
    assert.equal(pre.path,".github/workflows/r4-product-draft-dev-resume.yml");
  }
}
async function main() {
  const {kind,checkpoint}=stage();
  if(process.argv[2]==="classify") {appendFileSync(process.env.GITHUB_OUTPUT,`stage=${kind}\n`);return;}
  const policy=json("release-sources/r4-product-draft-dev/policy.json");
  if(process.argv[2]==="admit") {
    parent(source,policy.parent);assert.deepEqual(paths(policy.parent,source),policy.exactPaths.toSorted());
    await verifyGithub(policy,checkpoint,kind);
    await preflight(policy,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,fingerprint:process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT});
    console.log(JSON.stringify({status:kind==="preflight"?"DEV_RESUME_PREFLIGHT_PASS":"DEV_RESUME_PROMOTION_ADMISSION_PASS"}));
  } else if(process.argv[2]==="postcheck" && kind==="promotion") await postcheck(policy,{sourceCommit:source});
  else throw Error("INVALID_MODE");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(safeFailure(e));process.exitCode=1;});
