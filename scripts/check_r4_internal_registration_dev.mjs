// Only new assembly, DEV scope and recovery checks; existing product suites are not repeated.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,join} from "node:path";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import vm from "node:vm";
import {compose,walk,validateTarget,validatePublished,validateRecovery,validatePromotion,decideReadback,requestPath,get,safeFailure,patchWrangler} from "./r4_internal_registration_dev.mjs";
const p=JSON.parse(readFileSync("release-sources/r4-internal-registration-dev/policy.json"));
function checkReceipts() {
  const source="a".repeat(40),artifactDigest="b".repeat(64),sealSha256="c".repeat(64),digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
  const credentialEvidence={project:p.project,previewBranch:p.previewBranch,priorSuccessRun:p.previousPreviewRun,metadataUnchanged:true,writePermissionStatus:"NOT_DIRECTLY_VERIFIED"};
  const qaReceipt={approved:true,sourceCommit:source,privateCommit:p.privateCommit,artifactDigest,sealSha256,registrationModuleSha256:p.registrationModuleSha256,devOverlaySha256:p.devOverlaySha256,devSqlSha256:p.devSqlSha256};
  const recoveryReceipt={approved:true,baseSealSha256:p.baseSealSha256,project:p.project,previewBranch:p.previewBranch,noRetryOnUncertainty:true,aliasIdentityRequired:true,postReadbackRequired:true};
  const devOffReceipt={devSqlSha256:p.devSqlSha256,targetFingerprint:"63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba",gateOff:true,draftGateOff:true,marketplaceOff:true,productionWrites:0,scopeCount:1,neverOpened:true,registeredCount:0,actorSessions:0,threeAuthenticatedOnly:true,sourceCommit:source,sourceRunId:1,artifactDigest};
  const promotion={sourceCommit:source,privateCommit:p.privateCommit,sourceRunId:1,artifactId:2,artifactDigest,sealSha256,credentialEvidence,credentialEvidenceSha256:digest(credentialEvidence),qaReceipt,qaReceiptSha256:digest(qaReceipt),recoveryReceipt,recoveryReceiptSha256:digest(recoveryReceipt),devOffReceipt,devOffReceiptSha256:digest(devOffReceipt)};
  validatePromotion(promotion,source,p);for(const delta of [{gateOff:false},{draftGateOff:false},{marketplaceOff:false},{productionWrites:1},{scopeCount:2},{neverOpened:false},{registeredCount:1},{actorSessions:1},{threeAuthenticatedOnly:false}]) {const changed={...devOffReceipt,...delta};assert.throws(()=>validatePromotion({...promotion,devOffReceipt:changed,devOffReceiptSha256:digest(changed)},source,p));}
}
if(process.env.R4_INTERNAL_WRANGLER_ONLY) {
  const root=process.env.R4_WRANGLER_ROOT||"C:/Users/user/AppData/Local/npm-cache/_npx/c39b96b4691e9531/node_modules/wrangler";
  assert.equal(JSON.parse(readFileSync(join(root,"package.json"))).version,"3.90.0");
  const original=readFileSync(join(root,"wrangler-dist/cli.js")),patched=patchWrangler(original);assert.throws(()=>patchWrangler(Buffer.from("drift")));
  const require=createRequire(pathToFileURL(join(root,"package.json"))),{MockAgent,fetch}=require("undici"),agent=new MockAgent();agent.disableNetConnect();
  const account="a".repeat(32),target=`/accounts/${account}/pages/projects/tennisnote-admin-dev/deployments`;let requests=0;
  agent.get("https://api.cloudflare.com").intercept({path:"/client/v4"+target,method:"POST"}).reply(()=>{requests++;return {statusCode:200,data:{success:false,errors:[{code:8000000}]}};});
  const start=patched.indexOf("let __r4DeploymentPosts = 0;"),end=patched.indexOf('__name(performApiFetch, "performApiFetch");',start);assert.ok(start>=0&&end>start);
  const sandbox={process:{env:{CLOUDFLARE_ACCOUNT_ID:account}},import_node_assert4:{default:assert},
    requireLoggedIn:async()=>{},requireApiToken:()=>({apiToken:"synthetic"}),cloneHeaders:x=>({...x}),
    addAuthorizationHeaderIfUnspecified(){},addUserAgent(){},getCloudflareApiBaseUrl:()=>"https://api.cloudflare.com/client/v4",
    logger:{debug(){},debugWithSanitization(){}},import_undici3:{FormData:class {},fetch:(url,opts)=>fetch(url,{...opts,dispatcher:agent})}};
  vm.createContext(sandbox);vm.runInContext(patched.slice(start,end)+"\nthis.perform=performApiFetch;",sandbox);
  const loopStart=patched.indexOf("  let attempts = 0;\n  let lastErr;\n  while (attempts < MAX_DEPLOYMENT_ATTEMPTS) {");
  const loopEnd=patched.indexOf("\n  throw lastErr;\n}",loopStart);assert.ok(loopStart>=0&&loopEnd>loopStart);
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const run=new AsyncFunction("fetchResult","accountId","projectName","formData","MAX_DEPLOYMENT_ATTEMPTS","logger",patched.slice(loopStart,loopEnd)+"\n  throw lastErr;");
  const transport=async(resource,init)=>{const response=await sandbox.perform(resource,init);const body=await response.json();if(!body.success)throw Object.assign(Error("synthetic_unknown"),{code:body.errors[0].code});return body.result;};
  await assert.rejects(()=>run(transport,account,"tennisnote-admin-dev",null,3,{debug(){}}));assert.equal(requests,1);
  await assert.rejects(()=>sandbox.perform(target,{method:"POST"}),/R4_DEPLOYMENT_RETRY_DENIED/);
  await assert.rejects(()=>sandbox.perform(`/accounts/${account}/pages/projects/another-project/deployments`,{method:"POST"}),/R4_DEPLOYMENT_TARGET_DENIED/);
  const marker=patched.indexOf('response.status === 421 && !'),branchStart=patched.lastIndexOf("      if (",marker),branchEnd=patched.indexOf("\n      if (isAuthenticationFetch)",marker);
  assert.ok(marker>=0&&branchStart>=0&&branchEnd>marker);let replays=0;
  const run421=new AsyncFunction("response","request3","isNewConnectionFetch","requestCurrentURL","process","isCancelled","fetchParams","makeAppropriateNetworkError","httpNetworkOrCacheFetch","isAuthenticationFetch",patched.slice(branchStart,branchEnd)+"\nreturn response;");
  const p421={controller:{connection:{destroy(){}}}},url=new URL("https://api.cloudflare.com/client/v4"+target),req={method:"POST",body:{source:"synthetic"},urlList:[url]};
  await run421({status:421},req,false,x=>x.urlList.at(-1),sandbox.process,()=>false,p421,()=>null,async()=>{replays++;return {status:200};},false);
  assert.equal(replays,0,"TARGET_421_REPLAY");
  const otherReq={...req,method:"GET"};await run421({status:421},otherReq,false,x=>x.urlList.at(-1),sandbox.process,()=>false,p421,()=>null,async()=>{replays++;return {status:200};},false);
  assert.equal(replays,1,"UNRELATED_GET_BEHAVIOR_CHANGED");
  assert.equal(requests,1);await agent.close();console.log("PASS: pinned bundle, mocked actual transport unknown response POST1 and other target POST0");
} else if(process.env.R4_INTERNAL_DIAG_ONLY) {
  for(const [url,route] of [["https://api.github.com/x","gh"],["https://synthetic.invalid/project","cf_project"],["https://synthetic.invalid/deployments/id","cf_recovery"],["https://synthetic.invalid/deployments?page=1","cf_list"]]) {
    let failure;try {await get(url,"synthetic",async()=>({status:400}));}catch(e){failure=e;}assert.equal(safeFailure(failure),`${route}_HTTP_400`);
  }
  assert.equal(safeFailure(Error("private-value-or-url")),"R4_DEV_INTERNAL_BLOCKED");
  console.log("PASS: route/status only, unknown error redaction");
} else if(process.env.R4_INTERNAL_RECEIPT_ONLY) {
  checkReceipts();console.log("PASS: exact scoped DEV OFF receipt admission");
} else if(process.env.R4_INTERNAL_DELTA_ONLY) {
  const base="C:/Users/user/Documents/ChatGPT/테니스노트/outputs/2026-11-09-r4-style-ci-42539210658",result=await compose({files:walk(base+"/admin"),sealBytes:readFileSync(base+"/seal.json"),baseDir:base,policy:p});
  assert.deepEqual(Object.fromEntries(result.changed.map(k=>[k,result.hashes[k]])),{
    "index.html":"e38644bc2b291c4bf7cc2591b35202c03614144e3592cafbde28075253e86047",
    "r4-internal-product-registration-local.js":"e94827fbb03037d6d88149fd436d94841f11d16891ba305e1110e97287152e4f",
    "r4-product-draft-candidate.js":"eae30acf9c8bdc887cfb40da33fc4806913923cc2d3fbeac1e681368fba31f42",
    "r4-product-draft-dev-scoped-candidate.js":"cdd018d5e2eb6979f7634a1886526f6909535546db81e14212320bb73b5128b6"});
  assert.equal(requestPath("index.html"),"/");
  const workflow=readFileSync(".github/workflows/r4-internal-registration-dev.yml","utf8"),script=readFileSync("scripts/r4_internal_registration_dev.mjs","utf8");
  assert.ok(workflow.includes("failure() && steps.post.outputs.definite_mismatch == 'true'"));assert.ok(workflow.includes("failure() && steps.recovery_admit.outcome == 'success'"));
  assert.ok(workflow.includes("pages deploy style-base/admin --project-name=tennisnote-admin-dev --branch=r4-product-draft-qa --commit-hash=fde7b04878c9c093ebce73ef6b94a1e816b21fea"));
  const recovery=script.slice(script.indexOf('if(mode==="recovery-postcheck"'));
  assert.ok(!recovery.includes('"r4-internal-product-registration-local.js"'));assert.ok(script.includes('[[process.env.PUBLISHED_URL,true],[origin,false]]'));
  console.log("PASS: new overlay hashes and preview-only recovery wiring");
} else if(process.env.R4_INTERNAL_GUARD_ONLY) {
  const canonical={id:p.canonicalId,deployment_trigger:{metadata:{commit_hash:p.canonicalSha}},latest_stage:{status:"success"}};
  const project={name:p.project,production_branch:p.canonicalBranch,canonical_deployment:canonical},recovery={id:p.recoveryId,latest_stage:{status:"success"}};
  const d={id:p.previousPreviewId,url:p.previousPreviewUrl,aliases:[`https://${p.previewBranch}.${p.project}.pages.dev`],deployment_trigger:{metadata:{branch:p.previewBranch,commit_hash:p.baseSource}},latest_stage:{status:"success"}};
  assert.equal(validateTarget({project,recovery,deployments:[d]},p).previewId,p.previousPreviewId);
  assert.throws(()=>validateTarget({project,recovery,deployments:[]},p));assert.throws(()=>validateTarget({project,recovery,deployments:[d,{...d}]},p));
  assert.throws(()=>validateTarget({project,recovery,deployments:[{...d,id:"different"}]},p));
  assert.equal(validatePublished({project,deployments:[d]},p,p.baseSource,p.previousPreviewUrl),d.id);
  assert.equal(decideReadback(true,false),"ALIAS_DRIFT_HOLD");assert.equal(decideReadback(false,true),"IMMUTABLE_MISMATCH");
  const recoveryArgs={publishedDeploymentId:d.id,currentAliasDeploymentId:d.id,knownPublished:true,uncertain:false,baselineSealVerified:true};
  assert.equal(validateRecovery(recoveryArgs),true);for(const bad of [{uncertain:true},{knownPublished:false},{currentAliasDeploymentId:"changed"},{baselineSealVerified:false}])assert.throws(()=>validateRecovery({...recoveryArgs,...bad}));
  checkReceipts();
  console.log("PASS: exact DEV preview, target drift and restricted recovery guards");
} else {
  const base=process.env.R4_INTERNAL_BASE||"C:/Users/user/Documents/ChatGPT/테니스노트/outputs/2026-11-09-r4-style-ci-42539210658";
  const files=walk(base+"/admin"),sealBytes=readFileSync(base+"/seal.json"),result=await compose({files,sealBytes,baseDir:base,policy:p});
  assert.equal(Object.keys(result.files).length,176);assert.equal(result.changed.length,4);
  const fake={...files,"index.html":Buffer.from("drift")};await assert.rejects(()=>compose({files:fake,sealBytes,baseDir:base,policy:p}),/BASE_CONTENT_DRIFT/);
  await assert.rejects(()=>compose({files,sealBytes:Buffer.from("{}"),baseDir:base,policy:p}),/BASE_SEAL_DRIFT/);
  if(process.env.R4_INTERNAL_OUTPUT) {
    assert.equal(process.env.R4_INTERNAL_OUTPUT,"internal-release");mkdirSync("internal-release");mkdirSync("internal-release/admin");
    for(const [name,bytes] of Object.entries(result.files)) {assert.ok(!name.split("/").some(part=>part===".."||part===""));const target=join("internal-release/admin",name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:"wx"});}
    writeFileSync("internal-release/seal.json",JSON.stringify({schema:1,source:process.env.GITHUB_SHA,privateCommit:p.privateCommit,baseSource:p.baseSource,baseSealSha256:p.baseSealSha256,admin:result.hashes})+"\n",{flag:"wx"});
  }
  console.log(JSON.stringify({status:"DEV_INTERNAL_ASSEMBLY_PASS",base:175,result:176,changed:result.changed}));
}
