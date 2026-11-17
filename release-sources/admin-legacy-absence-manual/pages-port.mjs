// Administrator-only Pages transport, called only by an admitted protected job.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pins } from "./sequence.mjs";

const sha=x=>createHash("sha256").update(x).digest("hex");
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const originalCommit="f42cfca6cf22bcdbc82bd3ff8b08711ea806a34e";
const adminOrigin="https://tennisnote-admin.pages.dev";
const pinnedWrangler="e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4";
const allowedReads=new Set(["preinstall","prepublish","postpublish","prerecovery","before-rollback","postrollback"]);
const marker=operation=>"TN-LEGACY-ABSENCE-V2 "+operation;
const fixedOrigin=id=>`https://${id.slice(0,8)}.tennisnote-admin.pages.dev`;
const ctl=new Set(["_headers","_redirects","_worker.js"]);
function publicPath(file) {
  const parts=file.split("/");
  if(parts.some(p=>!p||p==="."||p===".."||p.includes("\\")))throw Error("PAGES_ROUTE_INVALID");
  const last=parts.at(-1);
  if(last==="index.html")return "/"+(parts.length===1?"":parts.slice(0,-1).map(encodeURIComponent).join("/")+"/");
  if(last.endsWith(".html"))parts[parts.length-1]=last.slice(0,-5);
  return "/"+parts.map(encodeURIComponent).join("/");
}
function verifyTree(root, inventory) {
  const names=(dir,prefix="")=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    if(e.isDirectory())return names(join(dir,e.name),prefix+e.name+"/");
    if(!e.isFile())throw Error("PAGES_NONREGULAR_INPUT");
    return [prefix+e.name];
  });
  const all=names(root), expected=Object.keys(inventory);
  if(all.length!==181 || expected.length!==181 || all.some(k=>sha(readFileSync(join(root,k)))!==inventory[k]))
    throw Error("PAGES_ARTIFACT_DRIFT");
}
function spawnPublish(cli,args,env) {
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[cli,...args],{stdio:"ignore",windowsHide:true,shell:false,env});
    let ended=false;
    const finish=code=>{if(ended)return;ended=true;clearTimeout(timer);resolve(code)};
    const timer=setTimeout(()=>{child.kill();finish(null)},120000);
    child.on("close",finish);child.on("error",()=>finish(null));
  });
}

export function bindPages({bundle,adminRoot,account,accountFingerprint,token,cli,authorization,admitWrite,read,
  request=fetch, startPublish=spawnPublish, verifyLocal=verifyTree, digestFile=f=>sha(readFileSync(f))}) {
  if(!Buffer.isBuffer(bundle)||sha(bundle)!==pins.digest || !/^[a-f0-9]{32}$/.test(account) || sha(account)!==accountFingerprint ||
     !token || !cli || !adminRoot || typeof authorization!=="function" || typeof admitWrite!=="function" || typeof read!=="function")
    throw Error("PAGES_BINDING_UNAVAILABLE");
  const manifest=JSON.parse(bundle);
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`;
  const base=plan=>({candidate:plan.releaseCommit,operation:plan.operation,bundle:pins.digest});
  const used=new Set();
  async function api(suffix="",method="GET") {
    const res=await request(endpoint+suffix,{method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000),
      headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    if(!res.ok)throw Error("PAGES_ACK_UNKNOWN");
    const data=await res.json();
    if(data.success!==true)throw Error("PAGES_ACK_UNKNOWN");
    return data.result;
  }
  async function verifyAssets(host,inventory,full) {
    const keys=full?Object.keys(inventory):["index.html","schedule-v2-admin.js"];
    for(let i=0;i<keys.length;i+=10) {
      if(!(await Promise.all(keys.slice(i,i+10).map(async file=>{
        if(ctl.has(file))return true; // Upload inventory pins these; Pages does not serve its controls.
        const res=await request(host+publicPath(file),{method:"GET",redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(8000)});
        if(file.startsWith("tennis-note-member-app/"))return res.status===302 && res.headers.get("location")==="https://tennisnote-app.pages.dev/";
        return res.status===200 && sha(Buffer.from(await res.arrayBuffer()))===inventory[file];
      }))).every(Boolean))return false;
    }
    return true;
  }
  const isProd=d=>uuid.test(d?.id) && d.environment==="production" && d.latest_stage?.status==="success" &&
    d.deployment_trigger?.metadata?.branch==="main";
  const existing=(d,plan,op)=>isProd(d) && d.deployment_trigger?.metadata?.commit_hash===plan.releaseCommit &&
    d.deployment_trigger?.metadata?.commit_message===marker(op);
  async function project() {
    const r=await api();
    if(r.name!=="tennisnote-admin" || r.production_branch!=="main" || !isProd(r.canonical_deployment))
      throw Error("PAGES_PROJECT_DRIFT");
    return r.canonical_deployment;
  }
  const original=d=>isProd(d)&&d.id===pins.recovery&&d.deployment_trigger.metadata.commit_hash===originalCommit;
  const isOff=r=>r?.catalogExact===true && r?.state==="installed" && r.readOnly===true && r.separateConnection===true &&
    r.gate==="OFF" && r.effective===0 && r.stored===0 && r.target===pins.fingerprint && r.sql===manifest.database.readback;
  async function start(plan,action) {
    if(used.has(action) || !await authorization(plan,action) || !await admitWrite(plan,action))throw Error("PAGES_WRITE_DENIED");
    used.add(action);
  }
  return Object.freeze({
    async readAdmin(plan,purpose){
      if(!allowedReads.has(purpose)||!await authorization(plan,"read"))return null;
      const candidate=await project(), rollback=await api("/deployments/"+pins.recovery);
      if(!original(rollback))return null;
      const full=["prepublish","postpublish","postrollback"].includes(purpose);
      const recoveryBytes=await verifyAssets(fixedOrigin(pins.recovery),manifest.recovery,full);
      if(!recoveryBytes)return null;
      const op=plan.intent==="release"?plan.operation:plan.publishedOperation;
      const ours=existing(candidate,plan,op);
      const expected=original(candidate)?manifest.recovery:ours?manifest.administrator:null;
      const immutableBytes=!!expected&&await verifyAssets(fixedOrigin(candidate.id),expected,full);
      const canonicalBytes=!!expected&&await verifyAssets(adminOrigin,expected,full);
      if((await project()).id!==candidate.id)return null;
      return {...base(plan),purpose,observedAt:Date.now(),project:pins.project,production:true,recoveryId:pins.recovery,
        recoveryBytes,canonicalId:candidate.id,immutableBytes,canonicalBytes,
        releaseCommit:candidate.deployment_trigger.metadata.commit_hash,publishedOperation:ours?op:null};
    },
    async publishAdminOnly(plan,detail) {
      if(plan.intent!=="release" || !detail?.files || digestFile(cli)!==pinnedWrangler ||
        JSON.stringify(detail.files)!==JSON.stringify(manifest.administrator))throw Error("PAGES_CANDIDATE_DRIFT");
      verifyLocal(adminRoot,manifest.administrator);
      await start(plan,"publish");
      if(!isOff(await read(plan,"prepublish")) || !original(await project()) || !await authorization(plan,"publish"))
        throw Error("PAGES_PUBLISH_PRECONDITION");
      const code=await startPublish(cli,["pages","deploy",adminRoot,"--project-name=tennisnote-admin","--branch=main",
        "--commit-hash="+plan.releaseCommit,"--commit-dirty=false","--commit-message="+marker(plan.operation)],
      {PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token});
      return {...base(plan),action:"publish",confirmed:code===0};
    },
    async rollbackAdminOnly(plan,detail) {
      if(plan.intent!=="recover" || detail?.from!==plan.publishedId || detail.to!==pins.recovery)throw Error("PAGES_ROLLBACK_SCOPE");
      await start(plan,"rollback");
      const current=await project();
      if(!existing(current,plan,plan.publishedOperation)||current.id!==plan.publishedId || !isOff(await read(plan,"before-rollback")) ||
        !original(await api("/deployments/"+pins.recovery)) || (await project()).id!==current.id ||
        !await authorization(plan,"rollback"))throw Error("PAGES_ROLLBACK_PRECONDITION");
      await api("/deployments/"+pins.recovery+"/rollback","POST");
      return {...base(plan),action:"rollback",confirmed:true};
    },
  });
}
