import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import integration from "./helpers/integrated-feature-release.cjs";
import mechanical from "./helpers/release-freeze-mechanical.cjs";
import r3 from "./helpers/r3-manual-ledger-release.cjs";
import aOnly from "./helpers/self-profile-a-only.cjs";
import profileCore from "./helpers/profile-core-authority.cjs";
const root=path.resolve(import.meta.dirname,"..");
const publicRepo=process.env.TENNISNOTE_INTEGRATION_PUBLIC_OBJECT_REPO || root;
const prod="686cc97d9676da2d16ca3cdfbd862dc9cd19434e",dev="c0513decc36421d99fe2ed452d417572625008ac",backend="8e0037f9e1e0e98c459428da2a598e6d8f263fc6";
const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),norm=s=>s.replace(/\r\n/g,"\n");
const get=(repo,ref,file)=>norm(execFileSync("git",["-C",repo,"show",ref+":"+file],{encoding:"utf8",maxBuffer:32e6}));
const read=file=>mechanical.restore(file,norm(fs.readFileSync(path.join(root,file),"utf8")));
const current=file=>fs.existsSync(path.join(root,file))?read(file):get(publicRepo,dev,file);
function fn(s,n){const m=s.match(new RegExp("^(?:async )?function "+n+"\\(","m"));assert(m,n);const a=s.slice(m.index),e=a.search(/^\}/m);assert(e>=0,"top-level function boundary");return a.slice(0,e+1).trim();}
for(const row of integration.contract.files) test("new outer inverse closes reviewed and DEV source: "+row.path,()=>{
  const text=current(row.path);assert.equal(hash(text),row.afterSha256);
  assert.equal(integration.restore(row.path,text,"development"),row.developmentSource);
  assert.equal(integration.restore(row.path,text),row.reviewedSource);
  assert.throws(()=>integration.restore(row.path,text+"\n"),/drift/);
});
test("R3 inverse contract preserved without golden repin",()=>{assert.equal(hash(read("tests/fixtures/r3-manual-ledger-release-parity.json")),"03f6688fc31517f55a5f999f4c1a13502876b762641b416dcdb4409068c0ac16");assert.equal(hash(read("tests/fixtures/self-profile-a-only.json")),"b418eab72b86167c64d255ef847d344134c53b0d83ea26d60cdfcd40b3177dd8");assert.match(read("tests/helpers/self-profile-a-only.cjs"),/r3\.restoreCandidate/);});
test("new integration still restores exact PROD A-only source before all old assertions",()=>{
  for(const row of aOnly.contract.files){const s=current(row.path);assert.equal(hash(aOnly.undoRelease(row.path,s)),row.afterHash);assert.equal(aOnly.restoreCandidate(row.path,s),get(publicRepo,aOnly.contract.base,row.path));}
});
test("new integration still restores every exact reviewed R3 product before historical evidence",()=>{
  for(const row of r3.contract.products){const restored=r3.restoreCandidate(row.path,current(row.path));if(row.status==="A")assert.equal(restored,null);else assert.equal(restored,get(publicRepo,prod,row.path));}
});
test("all unchanged profile core three are exact PROD and DEV",()=>{const result=profileCore.verifyProfileCore(root);assert.equal(result.ok,true);assert.equal(result.files.length,3);});
test("all DEV effective preview functions and renderer are preserved verbatim",()=>{
  for(const [file,names] of [["app/admin/data/billing.js",["effectiveSettlementPreviewContext","effectiveSettlementPreviewContextIsCurrent","invalidateEffectiveSettlementPreview","refreshEffectiveSettlementPreview"]],["app/admin/views/billing.js",["renderEffectiveSettlementPreview"]]])for(const name of names)assert.equal(fn(current(file),name),fn(get(publicRepo,dev,file),name));
  const render=fn(current("app/admin/views/billing.js"),"renderCoachSettlementPreview");assert.match(render,/renderAdminSettlementHistory\(\)/);assert.match(render,/effectiveSettlementPreviewContextIsCurrent/);assert.match(render,/identityRecovered/);
});
test("DEV curriculum/logout/email safeguards are not overwritten by PROD auth",()=>{
  const source=current("app/tennis-note-member-app/data/auth.js"),base=get(publicRepo,dev,"app/tennis-note-member-app/data/auth.js");
  for(const n of ["activateLiveMemberProfile","loginWithEmail","logout"])assert.equal(fn(source,n),fn(base,n));
});
test("R3 writer default-OFF and missing/unknown capability return false",()=>{
  const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-coach",settlementMonth:"synthetic-month"};
  const h={continuationIsCurrent:()=>true,loadedSignature:"scope",writerRequest:3,request:3,status:"READY",scopeState:{state:"EMPTY"},preview:{ok:true}};
  const c=vm.createContext({adminSettlementHistory:h,adminSettlementHistoryScope:()=>scope,adminSettlementHistoryScopeKey:()=>"scope",adminSettlementHistoryAccessReady:()=>true,adminSettlementHistoryPayloadIsExact:()=>true,monthlySettlementPreviewHasSources:()=>true,adminSettlementPreviewIsExact:()=>true});
  vm.runInContext(fn(current("app/admin/domain/billing.js"),"adminSettlementWriterAllowed")+"\nglobalThis.allowed=adminSettlementWriterAllowed;",c);
  for(const capability of [undefined,{contractVersion:"r3_snapshot_writer_capability_v1",writesEnabled:false},{contractVersion:"unknown",writesEnabled:true}]){h.scopeState.snapshotWriterCapability=capability;assert.equal(c.allowed(),false);}
  h.scopeState.snapshotWriterCapability={contractVersion:"r3_snapshot_writer_capability_v1",writesEnabled:true};assert.equal(c.allowed(),true);h.continuationIsCurrent=()=>false;assert.equal(c.allowed(),false);
});
test("R3 continuation invalidates auth/profile/token/client/role/scope changes",()=>{
  const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-coach",settlementMonth:"synthetic-month"};
  for(const changed of ["auth","profile","token","client","role","scope"]){
    const auth={profile:{id:"synthetic-admin",role:"admin"},user:{id:"synthetic-auth"}},session={access_token:"memory-only"},client={rpc:()=>{},getSession:()=>session};let key="scope";
    const c=vm.createContext({window:{TennisNoteDataClient:client},adminImportAuthState:auth,adminSettlementHistoryScope:()=>scope,adminSettlementHistoryScopeKey:()=>key,adminSettlementHistoryAccessReady:()=>true,adminSettlementHistoryCoaches:()=>[{serverRoleId:scope.coachRoleId}]});
    vm.runInContext(fn(current("app/admin/domain/billing.js"),"adminSettlementHistoryContinuation")+"\nglobalThis.make=adminSettlementHistoryContinuation;",c);const continuation=c.make();assert.equal(continuation(),true);
    if(changed==="auth")auth.user.id="other";if(changed==="profile")auth.profile.id="other";if(changed==="token")session.access_token="other";if(changed==="client")c.window.TennisNoteDataClient={};if(changed==="role")auth.profile.role="coach";if(changed==="scope")key="other";
    assert.equal(continuation(),false);
  }
});
test("public modular entry loads reviewed ledger once and preserves DEV adjustment",()=>{
  for(const role of ["admin","tennis-note-coach-app"]){const html=current(`app/${role}/index.html`);for(const asset of ["tennisnote-manual-settlement-ledger.js","tennisnote-manual-settlement-ledger.css","tennisnote-settlement-adjustment.js"]){assert.equal(html.split(asset).length-1,1);}assert.doesNotMatch(html,/tennisnote-manual-settlement-ledger[^\n]*1\.0\.547/);}
  const sw=current("app/tennis-note-coach-app/service-worker.js");assert.match(sw,/tennis-note-coach-mode-v556/);assert.equal(sw.split("tennisnote-manual-settlement-ledger.js").length-1,1);
});
test("production regression registration added without deleting DEV gates",()=>{
  const verify=current("scripts/verify.sh"),workflow=current(".github/workflows/tennisnote-public-ci.yml");
  assert.equal(verify.split("node scripts/check_tennisnote_self_profile_a_only_browser.cjs").length-1,1);
  for(const name of ["check_tennisnote_development_signin_browser.cjs","check_tennisnote_verified_profile_phone_browser.cjs","check_tennisnote_r3_effective_browser.cjs"])assert(verify.includes(name));
  assert.equal(workflow.split('      - "scripts/check_tennisnote_self_profile_a_only_browser.cjs"').length-1,2);
});
test("alignment inherits PROD547 while preserving historical golden hashes and DEV metadata",()=>{
  const j=JSON.parse(current("docs/tennisnote-dev-prod-alignment-20260916.json")),old=JSON.parse(get(publicRepo,dev,"docs/tennisnote-dev-prod-alignment-20260916.json"));
  assert.equal(j.authority.production_sha,prod);assert.equal(j.authority.development_sha,dev);assert.equal(j.authority_release.version,"1.0.547");assert.equal(j.candidate_release.version,"1.0.546");assert.deepEqual(j.product_tree,old.product_tree);assert.equal(j.required_migrations.db407_changed,false);assert.equal(j.required_migrations.profile.length,3);
});
test("new assembled JavaScript parses and has no unresolved conflict markers",()=>{
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);
  for(const file of walk(path.join(root,"app"))){const s=fs.readFileSync(file,"utf8");assert.doesNotMatch(s,/^(<<<<<<<|=======|>>>>>>>|\|{7})/m);if(file.endsWith(".js"))new vm.Script(s,{filename:path.relative(root,file)});}
});
