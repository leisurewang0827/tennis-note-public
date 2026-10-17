import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),outer=require("./helpers/r3-auth548-outer-port.cjs"),gate=require("../scripts/check_tennisnote_r3_auth548_provenance.cjs");
test("release is monotonic from DEV548 and PROD547; native metadata and reviewed Auth functions unchanged",()=>{
  const r=JSON.parse(fs.readFileSync(outer.root+"/app/release.json"));assert.equal(r.version,"1.0.549");assert.equal(r.releaseId,"2026.10.13.03");
  for(const[f,cache]of[["app/tennis-note-member-app/service-worker.js","tennis-note-member-pwa-v585"],["app/tennis-note-coach-app/service-worker.js","tennis-note-coach-mode-v558"]])assert(fs.readFileSync(outer.root+"/"+f,"utf8").includes(cache));
  assert.equal(outer.contract.roleDelta.privateAfterSha256,"11d9f7e40380e4c8ed059235dbdc42b6d57376d21f37550eb7e6070de750f59f");
  for(const row of outer.contract.roleDelta.functions)assert.equal(fs.readFileSync(outer.root+"/"+row.path,"utf8").split(row.after).length,2);
});
test("DEV runtime admission is an exact fresh protected receipt; absent/wrong/stale/ON/PII fields deny before deployment",()=>{
  const c=outer.contract.runtimeAdmission,now=Date.parse("2026-01-01T00:10:00Z"),receipt={contract:c.contract,environment:"development",projectFingerprint:"63350140ffe5",privatePolicy:c.privatePolicy,authSourceSha256:c.authSourceSha256,releaseId:outer.contract.candidateRelease.releaseId,readOnly:true,schemaReady:true,roleGrantsVerified:true,rolloutOff:true,migrations:c.migrations,observedAt:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:20:00Z"};
  const run=r=>{const text=JSON.stringify(r);return gate.validateRuntimeReceipt(text,outer.sha(text),now)};assert(run(receipt));
  for(const delta of[{environment:"production"},{projectFingerprint:"wrong"},{privatePolicy:"wrong"},{authSourceSha256:"wrong"},{releaseId:"old"},{readOnly:false},{schemaReady:false},{roleGrantsVerified:false},{rolloutOff:false},{migrations:[]},{expiresAt:"2026-01-01T00:09:00Z"},{observedAt:"2026-01-01T00:11:00Z"},{expiresAt:"2026-01-01T01:00:00Z"},{rawIdentity:"synthetic-forbidden"}])assert.throws(()=>run({...receipt,...delta}));
  assert.throws(()=>gate.validateRuntimeReceipt("","",now));const raw=JSON.stringify(receipt);assert.throws(()=>gate.validateRuntimeReceipt(raw,"0".repeat(64),now));
});
