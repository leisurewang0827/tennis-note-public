import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import mechanical from "./helpers/release-freeze-mechanical.cjs";
import integration from "./helpers/integrated-feature-release.cjs";
import profileCore from "./helpers/profile-core-authority.cjs";
import checkout from "./helpers/release-checkout-layout.cjs";
const publicRoot=path.resolve(import.meta.dirname,"..");
const read=(side,file)=>checkout.read(publicRoot,side,file);
const fn=s=>{const start=s.indexOf("async function persistIdentityProfile("),end=s.slice(start).search(/^\}/m);assert(start>=0&&end>=0);return s.slice(start,start+end+1);};
for(const row of mechanical.contract.files)test("exact mechanical inverse and drift rejection: "+row.side+":"+row.path,()=>{
 const current=read(row.side,row.path);assert.equal(mechanical.hash(current),row.afterSha256);
 assert.equal(mechanical.restore(row.path,current,row.side),row.beforeSource);
 assert.equal(mechanical.restore(row.path,row.beforeSource,row.side),row.beforeSource);
 assert.throws(()=>mechanical.restore(row.path,current+"\n",row.side),/drift/);
});
test("actual frozen public after-source is checked before inverse adapters",()=>assert.equal(mechanical.verifyCurrent(publicRoot),true));
test("pinned private frozen reference is checked before inverse adapters; not actual private CI",()=>assert.equal(mechanical.verifyCurrent(publicRoot,"private",file=>read("private",file)),true));
test("old semantic fixture and old golden pins remain immutable",()=>{
 const pins={"integrated-feature-release-parity.json":"a3fd09c24418cd24f4b12e11e99af0e5f561f761cfc9b7c6af21b05dbe52c6e7","self-profile-a-only.json":"b418eab72b86167c64d255ef847d344134c53b0d83ea26d60cdfcd40b3177dd8","r3-manual-ledger-release-parity.json":"03f6688fc31517f55a5f999f4c1a13502876b762641b416dcdb4409068c0ac16"};
 for(const [file,pin] of Object.entries(pins))assert.equal(mechanical.hash(read("public","tests/fixtures/"+file)),pin);
});
test("mechanical outer inverse composes with every previous semantic inverse",()=>{
 for(const row of integration.contract.files){const current=read("public",row.path);assert.equal(integration.restore(row.path,current),row.reviewedSource);assert.equal(integration.restore(row.path,current,"development"),row.developmentSource);assert.throws(()=>integration.restore(row.path,current+"\n"),/drift/);}
});
test("private/public signup function preserves corrected semantic pin through bump",()=>{
 const pub=fn(read("public","app/tennis-note-member-app/data/auth.js")),priv=fn(read("private","90-Dashboard/tennis-note-member-app/app.js"));
 assert.equal(pub,priv);assert.equal(mechanical.hash(pub),"b0ae9cd2053acd5b4d7fe62cedff4c3bade768e2e10c597346fdadff054b5bb6");
});
test("release and caches are identical and monotonic in both source projections",()=>{
 for(const side of ["private","public"]){const prefix=side==="public"?"app":"90-Dashboard";const release=JSON.parse(read(side,prefix+"/release.json"));assert.equal(release.version,"1.0.548");assert.equal(release.appSurfaceVersion,"1.0.548");assert.equal(release.releaseId,"2026.10.10.01");assert.equal(release.deployedAt,mechanical.contract.candidate.preparedAt);
 for(const [role,counter] of [["member",584],["coach",557]])assert.match(read(side,`${prefix}/tennis-note-${role}-app/service-worker.js`),new RegExp('^const CACHE_NAME = "[^"\\n]+-v'+counter+'";',"m"));}
 assert(548>547&&584>583&&557>556);
});
test("native available/prepared/minimum metadata is not promoted by web bump",()=>{
 for(const row of mechanical.contract.files.filter(x=>x.path.endsWith("/release.json"))){const before=JSON.parse(row.beforeSource),after=JSON.parse(read(row.side,row.path));delete before.version;delete before.appSurfaceVersion;delete before.releaseId;delete before.deployedAt;delete after.version;delete after.appSurfaceVersion;delete after.releaseId;delete after.deployedAt;assert.deepEqual(after,before);}
 for(const row of mechanical.contract.files.filter(x=>x.path.endsWith("/shared/tennisnote-release.js"))){const after=read(row.side,row.path);const strip=s=>s.replace(/^    (version|appSurfaceVersion|releaseId|deployedAt): "[^"]+"/gm,"METADATA");assert.equal(strip(after),strip(row.beforeSource));}
});
test("alignment current metadata advances but historical product golden tree is identical",()=>{
 const file="docs/tennisnote-dev-prod-alignment-20260916.json",actual=JSON.parse(read("public",file)),old=JSON.parse(mechanical.restore(file,read("public",file)));
 assert.equal(actual.candidate_release.version,"1.0.548");assert.equal(old.candidate_release.version,"1.0.546");assert.deepEqual(actual.product_tree,old.product_tree);assert.deepEqual(actual.required_migrations,old.required_migrations);assert.deepEqual(actual.authority,old.authority);assert.deepEqual(actual.dev_ahead_commits,old.dev_ahead_commits);
});
test("old semantic test assertions are unchanged; only source-read inverse is wrapped",()=>{
 const current=profileCore.restoreTestAdapter(read("public","tests/integrated-feature-parity.test.js")),before=checkout.semanticBefore();
 const reverted=current.replace('\nimport mechanical from "./helpers/release-freeze-mechanical.cjs";','').replace('const read=file=>mechanical.restore(file,norm(fs.readFileSync(path.join(root,file),"utf8")));','const read=file=>norm(fs.readFileSync(path.join(root,file),"utf8"));');assert.equal(reverted,before);
});
test("new fields do not permit email signup, production navigation from dev, or remote writes",()=>{
 for(const [env,origin,expected] of [["development","https://tennisnote-app-dev.pages.dev","https://tennisnote-app-dev.pages.dev/"],["production","https://tennisnote-app.pages.dev","https://tennisnote-app.pages.dev/"]]){
  const storage=new Map(),window={TENNISNOTE_CONFIG:{environment:env},location:{origin},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  const document={documentElement:{dataset:{}},readyState:"loading",addEventListener:()=>{}};const context=vm.createContext({window,document,URL});vm.runInContext(read("public","app/shared/tennisnote-runtime-environment.js"),context);
  const runtime=window.TennisNoteRuntimeEnvironment;assert.equal(runtime.resolvePortal("member").url,expected);assert.equal(runtime.features.emailPasswordAuthUi,false);assert.equal(runtime.features.developmentEmailSignIn,false);
  assert(!runtime.resolvePortal("coach").url.includes("coach-dev.pages.dev"));window.location.origin=env==="development"?"https://tennisnote-app.pages.dev":"https://tennisnote-app-dev.pages.dev";assert.equal(runtime.resolvePortal("member").ok,false);
 }
});
