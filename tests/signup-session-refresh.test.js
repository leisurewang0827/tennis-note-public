import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root=path.resolve(import.meta.dirname,"..");
const corrected=fs.readFileSync(path.join(root,"app/tennis-note-member-app/data/auth.js"),"utf8");
const contract=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/integrated-feature-release-parity.json"),"utf8"));
const beforeRegression=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/signup-token-refresh-before.json"),"utf8"));
function fn(source){const start=source.indexOf("async function persistIdentityProfile("),end=source.slice(start).search(/^\}/m);assert(start>=0&&end>=0);return source.slice(start,start+end+1);}
function token(revision,subject="synthetic-auth",sessionId="synthetic-session"){return ["synthetic",Buffer.from(JSON.stringify({sub:subject,session_id:sessionId,revision})).toString("base64url"),"unsigned-fixture"].join(".");}
function harness({source=corrected,result="approval_pending",role="member",status="active",live=true,verified=true,loss=0,readback=true}={}){
 const counts={rpc:0,writes:0,readback:0,apply:0,keys:[]},operations=new Map(),hooks={verify:null,rpc:null,readback:null};let sequence=0;
 const state={member:{authUserId:"synthetic-auth",profileId:"synthetic-profile",role,status},profile:{draft:"합성 초안 보존"}},session={access_token:token(0)};
 const window={atob:s=>Buffer.from(s,"base64").toString("utf8")};
 const client={readiness:()=>({ready:live}),getSession:()=>session,rpc:async(name,args)=>{
  assert.equal(name,"tn_save_my_signup_profile");counts.rpc++;if(hooks.rpc)await hooks.rpc();
  if(role!=="member"||status!=="active")throw Error("signup_profile_required");
  const key=args.target_operation_key||JSON.stringify(args);counts.keys.push(key);
  if(!operations.has(key)){counts.writes++;operations.set(key,{ok:true,linkStatus:result,profile:{id:result==="linked"?"synthetic-linked-profile":"synthetic-profile"}});}
  if(loss-->0)throw Object.assign(Error("synthetic response loss"),{transient:true});return operations.get(key);
 }};window.TennisNoteDataClient=client;
 const c=vm.createContext({state,window,curriculumSessionAttempt:0,Date,crypto:{randomUUID:()=>"synthetic-key-"+(++sequence)},
  normalizeIdentityText:v=>String(v||"").trim().replace(/\s+/g," "),normalizeIdentityPhone:v=>String(v||"").replace(/\D/g,""),identityPrivacyVersion:"synthetic-policy",
  hasLiveMemberSession:()=>client.readiness().ready&&!!window.TennisNoteDataClient?.getSession?.()?.access_token,
  requireVerifiedIdentityPhone:async()=>{if(hooks.verify)await hooks.verify();if(!verified)throw Error("phone_verification_required");},
  retryTransientNetwork:async action=>{for(let i=0;i<3;i++){try{return await action();}catch(e){if(!e.transient||i===2)throw e;}}},
  applySavedIdentity:p=>{counts.apply++;state.profile={...state.profile,...p};},
  applySupabaseMemberSession:async(_,options)=>{counts.readback++;c.curriculumSessionAttempt++;assert.equal(options.expectedAuthUserId,"synthetic-auth");assert.equal(options.requireSignupReadback,true);if(hooks.readback)await hooks.readback();if(readback)state.member.profileId=options.expectedProfileId;return readback;},
 });
 vm.runInContext('let signupProfileOperation={fingerprint:"",key:""};\n'+fn(source)+'\nglobalThis.run= persistIdentityProfile;',c);
 const input={realName:"합성회원",nickname:"합성닉",phone:"010"+"0000"+"0000",birthYear:"2000",neighborhood:"합성",gender:"other"};
 return {run:()=>c.run(input),state,session,window,client,c,counts,hooks};
}
test("normal same-session rotation during RPC succeeds with one write",async()=>{const h=harness();h.hooks.rpc=()=>{h.session.access_token=token(1);};assert.equal((await h.run()).linkStatus,"approval_pending");assert.equal(h.counts.writes,1);assert.equal(h.counts.apply,1);});
test("normal rotation during linked authoritative readback succeeds",async()=>{const h=harness({result:"linked"});h.hooks.rpc=()=>{h.session.access_token=token(1);};h.hooks.readback=()=>{h.session.access_token=token(2);};assert.equal((await h.run()).linkStatus,"linked");assert.equal(h.counts.writes,1);assert.equal(h.counts.readback,1);assert.equal(h.state.member.profileId,"synthetic-linked-profile");});
for(const field of ["auth","profile","role","status","client","session-id","subject","generation"])test("RPC continuation blocks changed "+field,async()=>{
 const h=harness();h.hooks.rpc=()=>{h.session.access_token=token(1);if(field==="auth")h.state.member.authUserId="synthetic-other";if(field==="profile")h.state.member.profileId="synthetic-other";if(field==="role")h.state.member.role="coach";if(field==="status")h.state.member.status="inactive";if(field==="client")h.window.TennisNoteDataClient={getSession:()=>h.session};if(field==="session-id")h.session.access_token=token(1,"synthetic-auth","synthetic-new-login");if(field==="subject")h.session.access_token=token(1,"synthetic-other");if(field==="generation")h.c.curriculumSessionAttempt++;};
 await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.rpc,1);assert.equal(h.counts.apply,0);assert.equal(h.state.profile.draft,"합성 초안 보존");
});
for(const field of ["auth","role","status","client","wrong-linked-profile","generation","session-id"])test("linked readback blocks changed "+field,async()=>{
 const h=harness({result:"linked"});h.hooks.readback=()=>{h.session.access_token=token(1);if(field==="auth")h.state.member.authUserId="synthetic-other";if(field==="role")h.state.member.role="admin";if(field==="status")h.state.member.status="inactive";if(field==="client")h.window.TennisNoteDataClient={getSession:()=>h.session};if(field==="wrong-linked-profile"){h.state.member.profileId="synthetic-other";return;}if(field==="generation")h.c.curriculumSessionAttempt++;if(field==="session-id")h.session.access_token=token(1,"synthetic-auth","synthetic-new-login");};
 if(field==="wrong-linked-profile"){h.c.applySupabaseMemberSession=async()=>{h.counts.readback++;h.c.curriculumSessionAttempt++;await h.hooks.readback();return true;};}
 await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counts.writes,1);assert.equal(h.counts.apply,0);
});
test("same UID logout and relogin is not accepted as token refresh",async()=>{const h=harness();h.hooks.rpc=()=>{h.c.curriculumSessionAttempt+=2;h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.apply,0);});
test("unproven rotation without session claim is HOLD",async()=>{const h=harness();h.hooks.rpc=()=>{h.session.access_token="synthetic-unproven";};await assert.rejects(h.run(),/signup_identity_context_changed/);});
test("unproven rotation without a session generation is HOLD",async()=>{const h=harness();delete h.c.curriculumSessionAttempt;h.hooks.rpc=()=>{h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_identity_context_changed/);});
test("pre-RPC verification token replacement stays fail-closed RPC zero",async()=>{const h=harness();h.hooks.verify=()=>{h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.rpc,0);});
test("response loss after legitimate refresh retries exact token/key and writes once",async()=>{const h=harness({loss:1});h.hooks.rpc=()=>{h.session.access_token=token(h.counts.rpc);};await h.run();assert.equal(h.counts.rpc,2);assert.equal(h.counts.writes,1);assert.equal(new Set(h.counts.keys).size,1);});
test("context change on lost response prevents the second RPC",async()=>{const h=harness({loss:1});h.hooks.rpc=()=>{h.c.curriculumSessionAttempt++;h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.rpc,1);});
test("partial linked readback retry retains key despite acknowledged profile transition",async()=>{
 const h=harness({result:"linked"});let first=true;h.c.applySupabaseMemberSession=async(_,options)=>{h.counts.readback++;h.c.curriculumSessionAttempt++;h.state.member.profileId=options.expectedProfileId;h.session.access_token=token(h.counts.readback);if(first){first=false;return false;}return true;};
 await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);await h.run();assert.equal(h.counts.rpc,2);assert.equal(h.counts.writes,1);assert.equal(new Set(h.counts.keys).size,1);
});
test("replacement draft operation discards an older RPC result",async()=>{const h=harness();h.hooks.rpc=()=>vm.runInContext('signupProfileOperation={fingerprint:"different",key:"different"};',h.c);await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.apply,0);});
for(const result of ["ambiguous","unknown","offline_preview"])test("rotated response retains status allowlist: "+result,async()=>{const h=harness({result});h.hooks.rpc=()=>{h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counts.apply,0);});
test("wrong pending profile remains blocked after valid rotation",async()=>{const h=harness();h.client.rpc=async()=>{h.counts.rpc++;h.session.access_token=token(1);return {ok:true,linkStatus:"approval_pending",profile:{id:"synthetic-other"}};};await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counts.apply,0);});
for(const [role,status] of [["admin","active"],["coach","active"],["member","inactive"]])test(`rotated path cannot bypass ${role}/${status}`,async()=>{const h=harness({role,status});await assert.rejects(h.run(),/signup_profile_required/);assert.equal(h.counts.rpc,0);});
test("offline verification and live missing RPC remain fail-closed",async()=>{const offline=harness({live:false,verified:false});await assert.rejects(offline.run(),/phone_verification_required/);assert.equal(offline.counts.rpc,0);const live=harness();delete live.client.rpc;await assert.rejects(live.run(),/login_required/);assert.equal(live.counts.rpc,0);});
test("immutable pre-fix RPC rotation reproduces one committed write then false failure",async()=>{const h=harness({source:beforeRegression.source});h.hooks.rpc=()=>{h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_identity_context_changed/);assert.equal(h.counts.writes,1);assert.equal(h.counts.apply,0);});
test("immutable pre-fix linked readback rotation reproduces false failure",async()=>{const h=harness({source:beforeRegression.source,result:"linked"});h.hooks.readback=()=>{h.session.access_token=token(1);};await assert.rejects(h.run(),/signup_link_readback_unconfirmed/);assert.equal(h.counts.writes,1);assert.equal(h.counts.readback,1);});
