import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import inverse from "./helpers/integrated-feature-release.cjs";
const root=path.resolve(import.meta.dirname,"..");
const candidate=fs.readFileSync(path.join(root,"app/tennis-note-member-app/data/auth.js"),"utf8");
const legacy=inverse.contract.files.find(x=>x.path==="app/tennis-note-member-app/data/auth.js").reviewedSource;
function fn(s,n) {const m=s.match(new RegExp("^(?:async )?function "+n+"\\(","m"));assert(m,n);const a=s.slice(m.index),e=a.slice(1).search(/\n(?:async )?function /);return a.slice(0,e<0?a.length:e+1).trim();}
function harness(source=candidate,{role="member",status="active",live=true,verified=true,resultStatus="approval_pending",loss=0,readback=true}={}) {
  const counters={rpc:0,writes:0,apply:0,verify:0,readback:0,keys:[],payloads:[]}, operations=new Map();let keyCount=0, readbackEnabled=readback;
  const state={member:{authUserId:"synthetic-auth",profileId:"synthetic-profile",role,status},profile:{draft:"synthetic draft"}};
  const session={access_token:"synthetic-memory-token"};
  const hooks={verify:null,rpc:null,readback:null};
  const client={readiness:()=>({ready:live}),getSession:()=>session,
    rpc:async(name,args)=>{
      counters.rpc++;if(hooks.rpc)await hooks.rpc();
      if(role!=="member"||status!=="active")throw Error("signup_profile_required");
      const p=name==="tn_save_my_signup_profile"?args.target_profile:{name:args.target_real_name,nickname:args.target_nickname,phoneCandidate:args.target_phone,birthYear:args.target_birth_year,neighborhood:args.target_neighborhood,gender:args.target_gender,privacyVersion:args.target_privacy_version};
      const key=name==="tn_save_my_signup_profile"?args.target_operation_key:JSON.stringify(p);
      counters.keys.push(key);counters.payloads.push(p);
      if(!operations.has(key)) {counters.writes++;operations.set(key,{ok:true,linkStatus:resultStatus,profile:{id:resultStatus==="linked"?"synthetic-linked-profile":"synthetic-profile",name:p.name}});}
      if(loss-->0) {const e=Error("synthetic response loss");e.transient=true;throw e;}
      return operations.get(key);
    }};
  const context=vm.createContext({state,window:{TennisNoteDataClient:client},crypto:{randomUUID:()=>"synthetic-operation-"+(++keyCount)},Date,
    normalizeIdentityText:v=>String(v||"").trim().replace(/\s+/g," "),normalizeIdentityPhone:v=>String(v||"").replace(/\D/g,""),identityPrivacyVersion:"2026-07-19-v2",
    hasLiveMemberSession:()=>client.readiness().ready&&!!client.getSession()?.access_token,
    requireVerifiedIdentityPhone:async()=>{counters.verify++;if(hooks.verify)await hooks.verify();if(!verified)throw Error("phone_verification_required");},
    retryTransientNetwork:async(f)=>{for(let i=0;i<3;i++){try{return await f();}catch(e){if(!e.transient||i===2)throw e;}}},
    applySavedIdentity:p=>{counters.apply++;state.profile={...state.profile,...p};},
    applySupabaseMemberSession:async(_,options)=>{counters.readback++;assert.equal(options.expectedAuthUserId,"synthetic-auth");assert.equal(options.requireSignupReadback,true);if(hooks.readback)await hooks.readback();if(readbackEnabled)state.member.profileId=options.expectedProfileId;return readbackEnabled;}
  });
  vm.runInContext('let signupProfileOperation = {fingerprint:"",key:""};\n'+fn(source,"persistIdentityProfile")+'\nglobalThis.persist = persistIdentityProfile;',context);
  const input={realName:"합성 이름",nickname:"합성닉",phone:"010"+"0000"+"0000",birthYear:"2000",neighborhood:"합성",gender:"other"};
  return {run:(x=input)=>context.persist(x),input,counters,state,session,hooks,client,setReadback:value=>{readbackEnabled=value;}};
}
for(const role of ["member","coach","admin"]) for(const resultStatus of ["approval_pending","linked"]) {
  test(`legacy/new same role and input meaning: ${role}/${resultStatus}`,async()=>{
    const old=harness(legacy,{role,resultStatus}),next=harness(candidate,{role,resultStatus});
    if(role!=="member") {await assert.rejects(old.run(),/signup_profile_required/);await assert.rejects(next.run(),/signup_profile_required/);assert.equal(next.counters.writes,0);assert.equal(next.counters.rpc,0);}
    else {const a=await old.run(),b=await next.run();assert.equal(a.linkStatus,b.linkStatus);assert.deepEqual(JSON.parse(JSON.stringify(old.counters.payloads[0])),JSON.parse(JSON.stringify(next.counters.payloads[0])));assert.equal(next.counters.writes,1);assert.equal(next.counters.readback,resultStatus==="linked"?1:0);}
  });
}
for(const kind of ["normal","ambiguous","admin-review"]) test(`existing pending semantics remain opaque: ${kind}`,async()=>{
  const h=harness();const result=await h.run();assert.equal(result.linkStatus,"approval_pending");assert.equal(h.counters.readback,0);assert.equal(h.counters.writes,1);assert.equal("candidateCount" in result,false);assert.equal("targetId" in result,false);
});
test("lost response retries the exact key and creates once",async()=>{const h=harness(candidate,{loss:1});await h.run();assert.equal(h.counters.rpc,2);assert.equal(h.counters.writes,1);assert.equal(new Set(h.counters.keys).size,1);});
test("same input retry retains key; changed input creates a distinct operation",async()=>{const h=harness();await h.run();await h.run();assert.equal(h.counters.writes,1);await h.run({...h.input,nickname:"다른합성닉"});assert.equal(h.counters.writes,2);assert.equal(new Set(h.counters.keys).size,2);});
test("owner change after verification blocks before RPC and preserves draft",async()=>{const h=harness();h.hooks.verify=()=>{h.state.member.authUserId="different-synthetic-auth";};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counters.rpc,0);assert.equal(h.state.profile.draft,"synthetic draft");});
for(const field of ["authUserId","profileId","sessionToken"]) test(`stale ${field} response is discarded`,async()=>{
  const h=harness();h.hooks.rpc=()=>{if(field==="sessionToken")h.session.access_token="changed-memory-token";else h.state.member[field]="changed-synthetic-owner";};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counters.apply,0);
});
test("owner loss between network attempts blocks the second RPC",async()=>{const h=harness(candidate,{loss:1});h.hooks.rpc=()=>{h.state.member.authUserId="changed-synthetic-auth";};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counters.rpc,1);assert.equal(h.counters.apply,0);});
test("linked response requires authoritative readback",async()=>{const h=harness(candidate,{resultStatus:"linked",readback:false});await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counters.apply,0);});
test("partial linked readback failure retains the same operation on explicit retry",async()=>{const h=harness(candidate,{resultStatus:"linked",readback:false});h.hooks.readback=()=>{h.state.member.profileId="synthetic-linked-profile";};await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);h.setReadback(true);await h.run();assert.equal(h.counters.rpc,2);assert.equal(h.counters.writes,1);assert.equal(new Set(h.counters.keys).size,1);});
for(const resultStatus of ["unknown","ambiguous","offline_preview"]) test(`unrecognized live ${resultStatus} is HOLD`,async()=>{const h=harness(candidate,{resultStatus});await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counters.apply,0);});
test("pending response for another profile is discarded",async()=>{const h=harness();h.client.rpc=async()=>({ok:true,linkStatus:"approval_pending",profile:{id:"different-synthetic-profile"}});await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counters.apply,0);});
for(const verified of [false,true]) test(`offline legacy/new verification parity: ${verified}`,async()=>{const old=harness(legacy,{live:false,verified}),next=harness(candidate,{live:false,verified});if(verified){assert.equal((await old.run()).linkStatus,"offline_preview");assert.equal((await next.run()).linkStatus,"offline_preview");}else{await assert.rejects(old.run(),/phone_verification_required/);await assert.rejects(next.run(),/phone_verification_required/);}assert.equal(next.counters.rpc,0);assert.equal(next.counters.verify,1);});
test("live session without RPC cannot silently fall through to offline preview",async()=>{const h=harness();delete h.client.rpc;await assert.rejects(h.run(),/login_required/);assert.equal(h.counters.apply,0);});
test("owner-bound key changes across identities even with unchanged input",async()=>{const h=harness();await h.run();h.state.member.authUserId="another-synthetic-auth";await h.run();assert.equal(new Set(h.counters.keys).size,2);});
test("modular signup remains exact to the verified private function pin",()=>{assert.equal(inverse.hash(fn(candidate,"persistIdentityProfile")),"b0ae9cd2053acd5b4d7fe62cedff4c3bade768e2e10c597346fdadff054b5bb6");});
test("memory-only draft operation, no new persistence or logging",()=>{const source=fn(candidate,"persistIdentityProfile");assert.doesNotMatch(source,/localStorage|sessionStorage|console\.|fetch\(/);assert.match(source,/const signupOperationKey/);assert.match(source,/signupOwner\.authId, operationProfileId/);});
