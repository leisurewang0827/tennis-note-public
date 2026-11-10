import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,appendFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {get,patchWrangler,validatePublished,walk} from "../../scripts/r4_scoped_member_catalog_dev.mjs";

const source="12664a91ddb71ba3690f9606f655ba2eccc71e5c";
const branch="refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108";
const project="tennisnote-admin-dev";
const preview="r4-product-draft-qa";
const alias="https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev";
const oldUrl="https://1d93768f.tennisnote-admin-dev.pages.dev";
const oldId="1d93768f-b196-4a98-8262-eaba905a3929";
const oldSource="75370e049e68fefb0e2d751d4b2e7792c3cf7d9a";
const canonical={canonicalId:"200eb1ac-8718-4cd7-904c-3c7426ce90d2",canonicalSha:"ca5528d3b7b8cd1b9ef41c4cefd7122d9671af57",previewBranch:preview};
const baseHash="4e8f6bd749c0088cf247532b88de9f77497dbc64f1f850e0323cd78f1583253b";
const module="r4-internal-catalog-issue-dev.js", view="views/members.js";
const expected={
  "index.html":"87ab97b8d988aaf5309e86dba532cea036ebe582dff71c7d42d234c7dfaff645",
  [view]:"ba5a46d09bda1cd31316606abf618bec5576f1caa71c5df9f131f539ed52b5be",
  [module]:"b5d2030b1f0a84f26726ece5fba77a2bd9a6307d95c31e89aa0a3a73867f3a54",
};
const paths=["index.html",view,module,"r4-scoped-member-catalog.js","release.json","shared/config.local.js"];
const sha=x=>createHash("sha256").update(x).digest("hex");
const norm=x=>x.replace(/\r\n/g,"\n");
const git=(...args)=>execFileSync("git",args,{maxBuffer:5*1024*1024});
const hashes=files=>Object.fromEntries(Object.entries(files).map(([k,v])=>[k,sha(v)]));
function compose(root) {
  const baseBytes=readFileSync(join(root,"seal.json"));assert.equal(sha(baseBytes),baseHash);
  const base=JSON.parse(baseBytes);assert.equal(base.source,oldSource);
  const files=walk(join(root,"admin"));assert.equal(Object.keys(files).length,178);assert.deepEqual(hashes(files),base.admin);
  assert.equal(norm(files[view].toString()),norm(git("show",source+"^:app/admin/"+view).toString()),"VIEW_BASE_DRIFT");
  assert.ok(!Object.hasOwn(files,module));
  const next=git("show",source+":app/admin/"+view);
  const js=git("show",source+":app/admin/"+module);
  const html=files["index.html"].toString(), line=html.includes("\r\n")?"\r\n":"\n";
  const anchor='<script src="./views/members.js?v=1.0.578"></script>';
  assert.equal(html.split(anchor).length,2);
  const insert='<script src="./'+module+'?v=1"></script>';
  const committed=norm(git("show",source+":app/admin/index.html").toString());
  assert.equal(committed.replace("    "+insert+"\n",""),norm(git("show",source+"^:app/admin/index.html").toString()));
  const index=html.replace(anchor,insert+line+"    "+anchor.replace("v=1.0.578","v="+sha(next).slice(0,16)));
  const delta={"index.html":Buffer.from(index),[view]:next,[module]:js};
  assert.deepEqual(hashes(delta),expected);
  return {base,files:{...files,...delta},seal:{source,project,preview,baseHash,delta:expected,admin:hashes({...files,...delta})}};
}
function envFence() {
  const e=process.env;
  assert.equal(e.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");assert.equal(e.GITHUB_REF,branch);
  assert.equal(e.GITHUB_EVENT_NAME,"push");assert.equal(e.GITHUB_RUN_ATTEMPT,"1");
  assert.equal(git("rev-list","--parents","-n","1",e.GITHUB_SHA).toString().trim(),e.GITHUB_SHA+" "+source);
  assert.deepEqual(git("diff","--name-only",source,e.GITHUB_SHA).toString().trim().split("\n").sort(),
    [".github/workflows/r4-internal-catalog-issue-preview.yml","release-sources/r4-internal-catalog-issue-preview/preview.mjs"].sort());
}
async function readCf() {
  const a=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  assert.match(a||"",/^[a-f0-9]{32}$/);assert.ok(token);
  assert.equal(sha(a),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const api="https://api.cloudflare.com/client/v4/accounts/"+a+"/pages/projects/"+project;
  const response=await get(api,token);assert.equal(response.success,true);
  const cf=response.result;
  assert.equal(cf.name,project);assert.equal(cf.production_branch,"dev");
  assert.equal(cf.canonical_deployment?.id,canonical.canonicalId);
  assert.equal(cf.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,canonical.canonicalSha);
  assert.equal(cf.canonical_deployment?.latest_stage?.status,"success");
  const prior=await get(api+"/deployments/"+oldId,token);assert.equal(prior.success,true);
  assert.equal(prior.result.id,oldId);assert.equal(prior.result.url,oldUrl);
  assert.equal(prior.result.deployment_trigger?.metadata?.commit_hash,oldSource);
  assert.equal(prior.result.deployment_trigger?.metadata?.branch,preview);assert.equal(prior.result.latest_stage?.status,"success");
  const deployments=[];
  let total;
  for(let page=1;page<=(total??1);page++){
    const r=await get(api+"/deployments?page="+page,token);assert.equal(r.success,true);
    assert.equal(r.result_info?.page,page);
    const pages=r.result_info?.total_pages;
    assert.ok(Number.isInteger(pages)&&pages>=1&&pages<=100);
    if(total!==undefined)assert.equal(total,pages);
    total=pages;assert.ok(Array.isArray(r.result));deployments.push(...r.result);
  }
  return {project:cf,deployments};
}
async function verifyLive(host,assetHashes,names) {
  await Promise.all(names.map(async name=>{
    const r=await fetch(host+(name==="index.html"?"/":"/"+name),{redirect:"error",cache:"no-store",
      headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(15000)});
    assert.equal(r.status,200,"LIVE_ASSET_READ_FAILED");
    assert.equal(sha(Buffer.from(await r.arrayBuffer())),assetHashes[name],"LIVE_ASSET_MISMATCH");
  }));
}
const mode=process.argv[2];
if(mode==="local"){
  const {seal}=compose(process.argv[3]);
  console.log(JSON.stringify({status:"PREVIEW_ASSEMBLY_PASS",assets:Object.keys(seal.admin).length,delta:seal.delta}));
}else{
  envFence();
  const {base,files,seal}=compose("preview-base");
  if(mode==="admit"){
    const api="https://api.github.com/repos/leisurewang0827/tennis-note-public";
    const gh=process.env.GH_TOKEN;assert.ok(gh);
    const [ci,artifact]=await Promise.all([get(api+"/actions/runs/42736205394",gh),get(api+"/actions/artifacts/13678027479",gh)]);
    assert.equal(ci.head_sha,source);assert.equal(ci.conclusion,"success");assert.equal(ci.run_attempt,1);
    assert.equal(artifact.workflow_run?.id,42625150294);assert.equal(artifact.expired,false);
    assert.equal(artifact.digest,"sha256:e022497bc347a052eef76b5c4d3ff2575f1e6e83c25c3be571c20f5cb1708f9b");
    const cf=await readCf();
    assert.equal(validatePublished(cf,canonical,oldSource,oldUrl),oldId);
    for(const host of [alias,oldUrl])await verifyLive(host,base.admin,paths.filter(x=>x!==module));
    for(const [name,data] of Object.entries(files)){
      const dest=join("issue-preview/admin",name);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,data,{flag:"wx"});
    }
    writeFileSync("issue-preview/seal.json",JSON.stringify(seal)+"\n",{flag:"wx"});
    const wrangler=join(process.env.RUNNER_TEMP,"r4-wrangler/node_modules/wrangler/wrangler-dist");
    writeFileSync(join(wrangler,"cli-r4-single.cjs"),patchWrangler(readFileSync(join(wrangler,"cli.js"))),{flag:"wx"});
    // Recheck the mutable target after preparation; a drift never reaches publication.
    assert.equal(validatePublished(await readCf(),canonical,oldSource,oldUrl),oldId);
    appendFileSync(process.env.GITHUB_OUTPUT,"approved=yes\n");
  }else if(mode==="post"){
    const url=process.env.PUBLISHED_URL;
    const id=validatePublished(await readCf(),canonical,source,url);
    assert.notEqual(id,oldId);
    await Promise.all([verifyLive(url,seal.admin,paths),verifyLive(alias,seal.admin,paths)]);
    assert.equal(validatePublished(await readCf(),canonical,source,url),id);
    console.log(JSON.stringify({status:"DEV_ISSUE_PREVIEW_PASS",deployment:id,url,recovery:oldId,canonical:canonical.canonicalId,source}));
  }else throw Error("MODE_DENIED");
}
