// Synthetic-only admission and pinned transport tests: no real network or DB.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createRequire} from "node:module";
import {EventEmitter} from "node:events";
import {pathToFileURL} from "node:url";
import vm from "node:vm";
import {patchProductionWrangler,validateOff,recoveryDecision,assertFinalCanonical} from "./r4_internal_registration_prod_promotion.mjs";
if(process.env.R4_PROD_FINAL_CANONICAL_ONLY) {
  const state={success:true,result:{name:"tennisnote-admin",production_branch:"main",canonical_deployment:{id:"ours",deployment_trigger:{metadata:{commit_hash:"source"}}}}};
  assertFinalCanonical(state,"ours","source");
  assert.throws(()=>assertFinalCanonical(state,"other","source"));assert.throws(()=>assertFinalCanonical(state,"ours","other"));
  assert.throws(()=>assertFinalCanonical({...state,result:{...state.result,name:"tennisnote-app"}},"ours","source"));
  console.log("PASS: final canonical drift blocks success and recovery");process.exit(0);
}
if(process.env.R4_PROD_ROLLBACK_TRANSPORT_ONLY) {
  for(const mode of ["421","redirect","timeout","success"]) {
    const {postRollbackOnce}=await import(`./r4_internal_registration_prod_promotion.mjs?synthetic=${mode}`);
    let calls=0,timeoutFn;
    const requester=(_url,_opts,callback)=>{calls++;const req=new EventEmitter();req.setTimeout=(_n,fn)=>{timeoutFn=fn;};req.destroy=()=>req.emit("error",Error("synthetic"));req.end=()=>queueMicrotask(()=>{
      if(mode==="timeout"){timeoutFn();return;}const res=new EventEmitter();res.statusCode=mode==="421"?421:mode==="redirect"?302:200;callback(res);res.emit("data",Buffer.from('{"success":true}'));res.emit("end");
    });return req;};
    const url=`https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/pages/projects/tennisnote-admin/deployments/cfb8595d-dc30-4d50-88a5-fb611aa2dcd0/rollback`;
    if(mode==="success")assert.equal(await postRollbackOnce(url,"synthetic",requester),true);
    else await assert.rejects(()=>postRollbackOnce(url,"synthetic",requester),/ROLLBACK_OUTCOME_UNCERTAIN/);
    await assert.rejects(()=>postRollbackOnce(url,"synthetic",requester),/ROLLBACK_RETRY_DENIED/);assert.equal(calls,1);
  }
  console.log("PASS: native HTTPS 421/redirect/timeout/success: exactly one rollback request, retry denied");process.exit(0);
}
const source="a".repeat(40),digest="b".repeat(64),sha=s=>createHash("sha256").update(JSON.stringify(s)).digest("hex");
const offReceipt={targetFingerprint:"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a",installSqlSha256:"f76086eea58d4aa0e87a53d370e2c298f485b8500b69ed47249415c4be441ac3",verifySqlSha256:"6869e4f4f09c3289737dc90e29f014b6f25a2ef331e9182bf9f10144f1ddafc0",sourceCommit:source,sourceRunId:1,artifactDigest:digest,draftOff:true,internalOff:true,rpcAclOk:true,privateRlsAclOk:true,oldContractUnchanged:true,existingWorkspaceCreateUnchanged:true,existingPilotOff:true,devScopeAbsent:true,accessRows:0,draftRows:0,registrationRows:0,publicRpcCount:4};
const promotion={sourceCommit:source,preflightCommit:"c".repeat(40),sourceRunId:1,sourceArtifactId:2,preflightRunId:3,artifactDigest:digest,sealSha256:"d".repeat(64),offReceipt,offReceiptSha256:sha(offReceipt)};
validateOff(promotion);
for(const key of ["draftOff","internalOff","rpcAclOk","privateRlsAclOk","oldContractUnchanged","existingWorkspaceCreateUnchanged","existingPilotOff","devScopeAbsent"]) {const r={...offReceipt,[key]:false};assert.throws(()=>validateOff({...promotion,offReceipt:r,offReceiptSha256:sha(r)}));}
for(const key of ["accessRows","draftRows","registrationRows"]) {const r={...offReceipt,[key]:1};assert.throws(()=>validateOff({...promotion,offReceipt:r,offReceiptSha256:sha(r)}));}
assert.equal(recoveryDecision({knownPublished:true,currentId:"x",expectedId:"x",immutableMismatch:true,uncertain:false}),"ROLLBACK_ONCE");
for(const delta of [{uncertain:true},{knownPublished:false},{currentId:"different"},{immutableMismatch:false}])assert.equal(recoveryDecision({knownPublished:true,currentId:"x",expectedId:"x",immutableMismatch:true,uncertain:false,...delta}),"HOLD");
const root=process.env.R4_WRANGLER_ROOT||"C:/Users/user/AppData/Local/npm-cache/_npx/c39b96b4691e9531/node_modules/wrangler";
const patched=patchProductionWrangler(readFileSync(join(root,"wrangler-dist/cli.js")));assert.throws(()=>patchProductionWrangler(Buffer.from("drift")));
const require=createRequire(pathToFileURL(join(root,"package.json"))),{MockAgent,fetch}=require("undici"),agent=new MockAgent();agent.disableNetConnect();
const account="a".repeat(32),target=`/accounts/${account}/pages/projects/tennisnote-admin/deployments`;let requests=0;
agent.get("https://api.cloudflare.com").intercept({path:"/client/v4"+target,method:"POST"}).reply(()=>{requests++;return {statusCode:200,data:{success:false,errors:[{code:8000000}]}};});
const start=patched.indexOf("let __r4DeploymentPosts = 0;"),end=patched.indexOf('__name(performApiFetch, "performApiFetch");',start);assert.ok(start>=0&&end>start);
const sandbox={process:{env:{CLOUDFLARE_ACCOUNT_ID:account}},import_node_assert4:{default:assert},requireLoggedIn:async()=>{},requireApiToken:()=>({apiToken:"synthetic"}),cloneHeaders:x=>({...x}),addAuthorizationHeaderIfUnspecified(){},addUserAgent(){},getCloudflareApiBaseUrl:()=>"https://api.cloudflare.com/client/v4",logger:{debug(){},debugWithSanitization(){}},import_undici3:{FormData:class {},fetch:(url,opts)=>fetch(url,{...opts,dispatcher:agent})}};
vm.createContext(sandbox);vm.runInContext(patched.slice(start,end)+"\nthis.perform=performApiFetch;",sandbox);
await sandbox.perform(target,{method:"POST"});await assert.rejects(()=>sandbox.perform(target,{method:"POST"}),/R4_DEPLOYMENT_RETRY_DENIED/);await assert.rejects(()=>sandbox.perform(`/accounts/${account}/pages/projects/tennisnote-app/deployments`,{method:"POST"}),/R4_DEPLOYMENT_TARGET_DENIED/);assert.equal(requests,1);
const marker=patched.indexOf('response.status === 421 && !'),begin=patched.lastIndexOf("      if (",marker),end421=patched.indexOf("\n      if (isAuthenticationFetch)",marker);assert.ok(marker>=0&&begin>=0&&end421>marker);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run421=new AsyncFunction("response","request3","isNewConnectionFetch","requestCurrentURL","process","isCancelled","fetchParams","makeAppropriateNetworkError","httpNetworkOrCacheFetch","isAuthenticationFetch",patched.slice(begin,end421)+"\nreturn response;");
let replays=0;const fp={controller:{connection:{destroy(){}}}},url=new URL("https://api.cloudflare.com/client/v4"+target),req={method:"POST",body:{source:"synthetic"},urlList:[url]};
await run421({status:421},req,false,x=>x.urlList.at(-1),sandbox.process,()=>false,fp,()=>null,async()=>{replays++;},false);assert.equal(replays,0);
await run421({status:421},{...req,method:"GET"},false,x=>x.urlList.at(-1),sandbox.process,()=>false,fp,()=>null,async()=>{replays++;},false);assert.equal(replays,1);
await agent.close();console.log("PASS: OFF receipt, rollback decision, exact admin POST single and 421 guard (synthetic)");
