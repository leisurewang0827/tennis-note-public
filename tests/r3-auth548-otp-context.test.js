import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),outer=require("./helpers/r3-auth548-outer-port.cjs"),fixture=require("./helpers/r3-auth548-otp-context.cjs");
const paths=["data/auth.js","forms/members.js","domain/members.js","actions/enrollment.js"];
const source=paths.map(f=>fs.readFileSync(outer.root+"/app/tennis-note-member-app/"+f,"utf8").replace(/\r\n/g,"\n")).join("\n");
test("OTP/request pre-write and await drift fail closed on exact editor role/status",async()=>{
  for(const action of ["request","confirm"])for(const stage of ["before",action==="request"?"auth":"verify"])for(const field of ["role","status"]){const r=await fixture.otpScenario(source,action,stage,field);assert.equal(r.accepted,false);if(action==="request")assert.equal(r.send,0);if(stage==="before")assert.equal(r.verify,0);assert.equal(r.marked,0);}
});
test("valid profile verification, same-owner refresh, and existing signup confirmation remain supported",async()=>{
  for(const [surface,stage,field] of [["profile","none","none"],["profile","verify","token"],["signup","none","none"]]){const r=await fixture.otpScenario(source,"confirm",stage,field,surface);assert(r.accepted);assert.equal(r.verify,1);assert.equal(r.auth,1);assert.equal(r.marked,1);}
});
