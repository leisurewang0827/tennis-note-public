import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),outer=require("./helpers/r3-auth548-outer-port.cjs"),fixture=require("./helpers/r3-auth548-editor-context.cjs");
const map={"data/auth.js":["hasLiveMemberSession","refreshIdentityPhoneVerification","requireVerifiedIdentityPhone","persistIdentityProfile"],"forms/members.js":["phoneVerificationOwner","phoneVerificationOwnerCurrent","profilePhoneEditorOwnerCurrent","phoneVerificationRequestCurrent"],"domain/members.js":["openProfileEditor"],"actions/profile.js":["readSavedSelfProfileExactly","updateMemberProfileOnServer"]};
const source=Object.entries(map).flatMap(([file,names])=>{const text=fs.readFileSync(outer.root+"/app/tennis-note-member-app/"+file,"utf8").replace(/\r\n/g,"\n");return names.map(n=>{const m=text.match(new RegExp("^(?:async )?function "+n+"\\([\\s\\S]*?^}","m"));assert(m);return m[0]})}).join("\n\n");
test("actual public editor open and Auth await reject role/status drift before RPC while preserving draft/key",async()=>{
  for(const stage of ["before-save","open-auth","save-auth"])for(const field of ["role","status"]){const r=await fixture.scenario(source,stage,field);assert.equal(r.accepted,false);assert.equal(r.rpc,0);assert.equal(r.reads,0);assert.equal(r.apply,0);assert(r.draftPreserved&&r.keyPreserved&&r.immutableEditor);}
});
test("actual public editor pipeline keeps RPC/read captured context, not a newly adopted role",async()=>{
  for(const stage of ["rpc","read"])for(const field of ["role","status"]){const r=await fixture.scenario(source,stage,field);assert.equal(r.accepted,false);assert.equal(r.apply,0);assert(r.draftPreserved&&r.keyPreserved);}
});
test("same-owner RPC token refresh remains valid; fresh-read token drift fails; stable coach succeeds once",async()=>{
  for(const [stage,field,accepted]of [["rpc","token",true],["read","token",false],["none","none",true]]){const r=await fixture.scenario(source,stage,field);assert.equal(r.accepted,accepted);if(accepted){assert.equal(r.rpc,1);assert.equal(r.reads,1);assert.equal(r.apply,1)}else assert.equal(r.apply,0);}
});
