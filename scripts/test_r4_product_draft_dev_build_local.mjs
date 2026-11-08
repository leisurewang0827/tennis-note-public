import assert from "node:assert/strict";
import {mkdtemp,cp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,sep} from "node:path";
import {buildAdmin} from "./r4_product_draft_dev_release.mjs";
const [sealed]=process.argv.slice(2);assert.ok(sealed);
const original=process.cwd(),temp=await mkdtemp(join(tmpdir(),"r4-draft-build-"));
const expectedPrefix=resolve(tmpdir())+sep+"r4-draft-build-";
assert.ok(resolve(temp).startsWith(expectedPrefix),"TEMP_SCOPE_DENIED");
const realFetch=globalThis.fetch,oldToken=process.env.GH_TOKEN;
try {
  await cp(join(original,"release-sources/r4-product-draft-dev"),join(temp,"release-sources/r4-product-draft-dev"),{recursive:true});
  await cp(sealed,join(temp,"draft-base"),{recursive:true});
  const policy=JSON.parse(await readFile(join(temp,"release-sources/r4-product-draft-dev/policy.json")));
  policy.privateCommit="1".repeat(40);
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes("/actions/runs/")?
    {head_sha:policy.baseSha,conclusion:"success",run_attempt:1}:
    {name:policy.baseArtifactName,expired:false,digest:`sha256:${policy.baseArtifactSha256}`}));
  process.env.GH_TOKEN="synthetic";process.chdir(temp);
  await buildAdmin(policy,"2".repeat(40));
  const seal=JSON.parse(await readFile(join(temp,"draft-release/seal.json")));
  assert.equal(seal.sha,"2".repeat(40));assert.equal(Object.keys(seal.admin).length,175);
  assert.ok(seal.admin["r4-product-draft-dev-scoped-candidate.js"]);
  console.log("PASS: sealed DEV base -> admin-only six-file overlay; synthetic API, no network/deploy");
} finally {
  process.chdir(original);globalThis.fetch=realFetch;
  if(oldToken===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=oldToken;
  await rm(temp,{recursive:true,force:true});
}
