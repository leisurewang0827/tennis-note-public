import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {classify,preflight,get,safeFailure} from "./r4_product_draft_dev_resume.mjs";

const sha="a".repeat(40),diag="147bee0d433de3b66219c11145e16d83bb73f199";
const files=[".github/workflows/r4-product-draft-dev-resume.yml","scripts/r4_product_draft_dev_resume.mjs","scripts/check_r4_product_draft_dev_resume.mjs","release-resumes/r4-product-draft-dev/resume.json"];
test("only exact checkpoint or one-file promotion classifies",()=>{
  assert.equal(classify({sha,parents:`${sha} ${diag}`,diff:files}),"preflight");
  assert.equal(classify({sha,parents:`${sha} ${"b".repeat(40)}`,diff:["release-resumes/r4-product-draft-dev/promotion.json"]}),"promotion");
  assert.throws(()=>classify({sha,parents:`${sha} ${diag} ${"b".repeat(40)}`,diff:files}));
  assert.throws(()=>classify({sha,parents:`${sha} ${diag}`,diff:[...files,"unexpected"]}));
});
const account="a".repeat(32),fingerprint=createHash("sha256").update(account).digest("hex");
const policy={project:"tennisnote-admin-dev",productionBranch:"dev",previewBranch:"r4-product-draft-qa",canonicalId:"canonical",canonicalSha:"b".repeat(40),recoveryId:"recovery"};
const canonical={id:"canonical",deployment_trigger:{metadata:{branch:"dev",commit_hash:policy.canonicalSha}},latest_stage:{status:"success"}};
const project={success:true,result:{name:policy.project,production_branch:"dev",canonical_deployment:canonical}};
const recovery={success:true,result:{id:"recovery",latest_stage:{status:"success"}}};
function fixture(change={}) {
  const seen=[];
  const fetcher=async url=>{seen.push(url);if(url.endsWith("/tennisnote-admin-dev"))return project;if(url.endsWith("/deployments/recovery"))return recovery;
    const page=Number(new URL(url).searchParams.get("page"));assert.equal(new URL(url).searchParams.has("per_page"),false);
    return {success:true,result:page===2?(change.occupied?[{deployment_trigger:{metadata:{branch:policy.previewBranch}}}]:[]):[],result_info:{page,total_pages:change.drift&&page===2?3:2}};};
  return {fetcher,seen};
}
test("default pagination inspects every page",async()=>{const f=fixture();const r=await preflight(policy,{account,token:"synthetic",fingerprint,fetcher:f.fetcher});assert.equal(r.previewBranchVacant,true);assert.equal(f.seen.length,4);});
test("occupied and drifting pagination fail closed",async()=>{for(const change of [{occupied:true},{drift:true}]){const f=fixture(change);await assert.rejects(preflight(policy,{account,token:"synthetic",fingerprint,fetcher:f.fetcher}));}});
test("fingerprint mismatch makes no request",async()=>{const f=fixture();await assert.rejects(preflight(policy,{account,token:"synthetic",fingerprint:"b".repeat(64),fetcher:f.fetcher}));assert.equal(f.seen.length,0);});
test("safe diagnostics expose only allowlisted route and HTTP status",async()=>{
  for(const route of ["cf_project","cf_recovery","cf_list","gh"]) {
    let failure;try {await get("https://synthetic.invalid/private","synthetic-credential",route,async()=>({status:400}));} catch(e) {failure=e;}
    assert.equal(safeFailure(failure),`${route}_HTTP_400`);
  }
  assert.equal(safeFailure(Error("PAGINATION_UNKNOWN")),"PAGINATION_UNKNOWN");
  assert.equal(safeFailure(Error("private-value-or-url")),"R4_DEV_RESUME_BLOCKED");
  assert.equal(safeFailure(Error("cf_list_HTTP_400 private-value")),"R4_DEV_RESUME_BLOCKED");
});
test("resume paths do not trigger the original source workflow",()=>{
  const exact=new Set(["scripts/r4_product_draft_dev_release.mjs","scripts/r4_product_draft_dev_promote.mjs",".github/workflows/r4-product-draft-dev-source.yml",".github/workflows/r4-product-draft-dev-promote.yml"]);
  for(const file of files) {
    assert.equal(file.startsWith("release-sources/r4-product-draft-dev/"),false);
    assert.equal(/^scripts\/test_r4_product_draft_dev_.*\.mjs$/.test(file),false);
    assert.equal(exact.has(file),false);
  }
});
