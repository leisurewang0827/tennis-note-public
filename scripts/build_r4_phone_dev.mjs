import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const root=process.cwd(), env=process.env;
const repository=env.R4_PHONE_LOCAL_REPOSITORY||root;
assert.ok(!env.GITHUB_ACTIONS||!env.R4_PHONE_LOCAL_REPOSITORY,"LOCAL_OVERRIDE_FORBIDDEN_ON_CI");
const devBase="0d2a1e5a489cead9957368ffe66c85c0b7c0a261";
const project="tennisnote-admin-dev";
const priorPrefix="1de3fbb1";
const fingerprint="63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
const hash=s=>createHash("sha256").update(s).digest("hex");
const git=(...args)=>execFileSync("git",["-C",repository,...args],{maxBuffer:30e6});
const json=async(url,token)=>{
  const response=await fetch(url,{headers:token?{Authorization:"Bearer "+token}:{},redirect:"error",signal:AbortSignal.timeout(20000)});
  assert.equal(response.ok,true,"READ_ONLY_PREFLIGHT_FAILED");return response.json();
};
assert.equal(env.TENNISNOTE_ENVIRONMENT,"development");
assert.equal(env.TENNISNOTE_SUPABASE_URL,"https://udjmiezroipctytmztwz.supabase.co");
assert.equal(env.TENNISNOTE_PAYMENTS_ENABLED,"false");
assert.equal(env.TENNISNOTE_PAYMENT_MODE,"disabled");
assert.equal(env.TENNISNOTE_BANK_TRANSFER_ENABLED,"false");
if(process.argv.includes("--preflight")){
  assert.equal(env.GITHUB_RUN_ATTEMPT,"1");assert.equal(env.TENNISNOTE_CANDIDATE_SHA,env.GITHUB_SHA);
  assert.match(env.GITHUB_SHA,/^[a-f0-9]{40}$/);
  const account=env.CLOUDFLARE_ACCOUNT_ID;assert.match(account,/^[a-f0-9]{32}$/);
  assert.equal(hash(account),env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const url="https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects/"+project;
  const data=await json(url,env.CLOUDFLARE_API_TOKEN);assert.equal(data.success,true);
  const current=data.result.canonical_deployment;
  assert.equal(data.result.name,project);assert.equal(data.result.production_branch,"dev");
  assert.equal(current.environment,"production");assert.equal(current.latest_stage.status,"success");
  assert.equal(current.deployment_trigger.metadata.commit_hash,"568810aa8285164c21b903242da16dccce39913f");
  assert.equal(current.id.startsWith(priorPrefix+"-"),true);
  assert.equal(current.url,"https://"+priorPrefix+"."+project+".pages.dev");
  const active=await json("https://"+project+".pages.dev/release.json");const immutable=await json(current.url+"/release.json");
  assert.deepEqual(active,immutable);assert.equal(active.version,"1.0.582");assert.equal(active.releaseId,"2026.11.05.05");
  mkdirSync("dist",{recursive:true});
  writeFileSync("dist/r4-phone-dev-recovery.json",JSON.stringify({project,source:env.GITHUB_SHA,rollback:current.id,rollbackUrl:current.url},null,2));
  console.log(JSON.stringify({status:"DEV_TARGET_AND_RECOVERY_PASS",project,rollbackDeployment:current.id}));
}else if(process.argv.includes("--build")){
  const dir=mkdtempSync(join(tmpdir(),"tn-r4-phone-artifact-"));
  const archive=join(dir,"source.tar");
  git("archive","--output="+archive,devBase,"app/admin","app/shared","app/tennis-note-member-app/assets","app/tennis-note-legal","app/release.json","commerce.html","support.html","delete-account.html","scripts/build_cloudflare_pages.py");
  execFileSync("tar",["-xf",archive,"-C",dir]);
  assert.equal(hash(readFileSync(join(dir,"scripts/build_cloudflare_pages.py"))),"5f2a9e85daa0cccc83aa9f9405f81ee9894abed93c730d3db00db6dae1079f80");
  let html=readFileSync(join(dir,"app/admin/index.html"),"utf8");
  const source=readFileSync(join(root,"app/admin/index.html"),"utf8");
  const start=source.indexOf('<div id="r4PhoneVerification"');const end=source.indexOf('<form id="r4ApplicationForm"',start);
  assert.ok(start>0&&end>start);
  const form=source.slice(start,end);
  assert.equal(html.split('<form id="r4ApplicationForm"').length,2);
  html=html.replace('<form id="r4ApplicationForm"',form+'<form id="r4ApplicationForm"');
  const scripts=source.match(/    <script src="\.\/r4-(?:selfserve-client|phone-verification|onboarding)\.js\?v=[^"]+"><\/script>/g);
  assert.equal(scripts.length,3);
  html=html.replace(/    <script src="\.\/r4-onboarding\.js\?v=[^"]+"><\/script>/,scripts.join("\n"));
  for(const path of ["views/settings.js","actions/common.js","data/common.js","actions/settings.js"]){
    const escaped=path.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const pattern=new RegExp('<script src="\\./'+escaped+'\\?v=[^"]+"><\\/script>');
    const tag=source.match(pattern)?.[0];assert.ok(tag);assert.match(html,pattern);html=html.replace(pattern,()=>tag);
  }
  const loginStart=source.indexOf('        <div id="operationsLoginControls">');
  const loginEnd=source.indexOf('        <button id="operationsLogoutButton"',loginStart);
  const oldLoginStart=html.indexOf('        <label class="operations-remember-row">');
  const oldLoginEnd=html.indexOf('        <button id="operationsLogoutButton"',oldLoginStart);
  assert.ok(loginStart>0&&loginEnd>loginStart&&oldLoginStart>0&&oldLoginEnd>oldLoginStart);
  html=html.slice(0,oldLoginStart)+source.slice(loginStart,loginEnd)+html.slice(oldLoginEnd);
  writeFileSync(join(dir,"app/admin/index.html"),html);
  for(const file of ["r4-onboarding.js","r4-phone-verification.js","r4-selfserve-client.js","views/settings.js","actions/common.js","data/common.js","actions/settings.js"]){
    writeFileSync(join(dir,"app/admin",file),readFileSync(join(root,"app/admin",file)));
  }
  const releasePath=join(dir,"app/release.json");const release=JSON.parse(readFileSync(releasePath));
  assert.equal(release.releaseId,"2026.11.05.02");release.releaseId="2026.11.05.06";
  writeFileSync(releasePath,JSON.stringify(release,null,2)+"\n");
  const out=resolve(root,"dist/admin-phone-dev");
  const isolatedOutput=join(dir,"dist/admin-dev");
  execFileSync(env.PYTHON||"python",[join(dir,"scripts/build_cloudflare_pages.py"),"--target","admin","--output",isolatedOutput],{cwd:dir,env,stdio:"pipe",windowsHide:true});
  cpSync(isolatedOutput,out,{recursive:true,errorOnExist:true,force:false});
  assert.ok(readFileSync(join(out,"index.html"),"utf8").includes('id="operationsLoginControls"'));
  const config=readFileSync(join(out,"shared/config.local.js"),"utf8");
  const runtime=JSON.parse(config.match(/window\.TENNISNOTE_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
  const payments=JSON.parse(config.match(/window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
  assert.equal(runtime.environment,"development");assert.equal(runtime.projectFingerprint,fingerprint);
  assert.equal(payments.enabled,false);assert.equal(payments.mode,"disabled");assert.equal(payments.bankTransfer.enabled,false);
  for(const file of ["r4-onboarding.js","r4-phone-verification.js","r4-selfserve-client.js","views/settings.js","actions/common.js","data/common.js","actions/settings.js"]){
    assert.equal(hash(readFileSync(join(out,file))),hash(readFileSync(join(root,"app/admin",file))));
  }
  assert.equal(existsSync(join(out,"tennis-note-member-app/index.html")),false);assert.equal(existsSync(join(out,"tennis-note-coach-app/index.html")),false);
  assert.equal(readFileSync(join(out,"index.html"),"utf8").includes('href="/admin-dev.webmanifest"'),true);
  assert.equal(JSON.parse(readFileSync(join(out,"release.json"))).releaseId,"2026.11.05.06");
  const walk=(p,prefix="")=>readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(join(p,x.name),prefix+x.name+"/"):[[prefix+x.name,hash(readFileSync(join(p,x.name)))]]);
  const assets=Object.fromEntries(walk(out));
  writeFileSync(join(root,"dist/r4-phone-dev-artifact.json"),JSON.stringify({source:env.GITHUB_SHA||null,devBase,project,release:"2026.11.05.06",assets},null,2));
  console.log(JSON.stringify({status:"ADMIN_DEV_ARTIFACT_PASS",project,release:"2026.11.05.06",assetCount:Object.keys(assets).length}));
}else throw Error("EXPLICIT_BUILD_OR_PREFLIGHT_REQUIRED");
