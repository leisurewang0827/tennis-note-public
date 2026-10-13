"use strict";
const vm=require("node:vm"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const names=["hasLiveMemberSession","phoneVerificationOwner","phoneVerificationOwnerCurrent","profilePhoneEditorOwnerCurrent","phoneVerificationRequestCurrent","openProfileEditor","refreshIdentityPhoneVerification","requireVerifiedIdentityPhone","persistIdentityProfile","readSavedSelfProfileExactly","updateMemberProfileOnServer"];
function extract(s,n){const m=s.match(new RegExp("^(?:async )?function "+n+"\\([\\s\\S]*?^}","m"));assert(m,"missing:"+n);return m[0];}
async function scenario(s,stage,field){
  const phone=["010","0000","0003"].join(""),oldPhone=["010","0000","0001"].join("");
  const state={member:{role:"coach",status:"active",id:"synthetic-profile",profileId:"synthetic-profile",authUserId:"synthetic-owner"},liveProfileId:"synthetic-profile",profile:{phone:oldPhone,name:"합성",nickname:"합성별명",serverRevision:"2026-01-01T00:00:00.000Z",goal:"합성 초안"}};
  let token="synthetic-session",auth=0,rpc=0,reads=0,apply=0,marked=0,saved,ctx,requestKey;
  const input={value:phone},draft=JSON.stringify(state.profile);
  function mutate(){if(field==="role")state.member.role="member";if(field==="status")state.member.status="inactive";if(field==="token")token="synthetic-refreshed";}
  const client={readiness:()=>({ready:true}),getSession:()=>({access_token:token,user:{id:"synthetic-owner"}}),getAuthUser:async()=>{auth++;if((stage==="open-auth"&&auth===1)||(stage==="save-auth"&&auth===2))mutate();return {id:"synthetic-owner",phone,phone_confirmed_at:"synthetic-confirmed"}},rpc:async(n,a)=>{rpc++;assert.equal(n,"tn_save_my_verified_profile_phone");requestKey=a.target_operation_key;saved={...a.target_profile,id:"synthetic-profile",role:state.member.role,status:state.member.status,updated_at:"2026-01-01T00:00:01.000Z"};if(stage==="rpc")mutate();return {ok:true,profileContract:"atomic-self-profile/1",styleSaved:true,phoneVerified:true,profile:saved}},selectRows:async(t,o)=>{reads++;assert.equal(t,"tn_users");assert.equal(o.requireFresh,true);if(stage==="read")mutate();return [{...saved,role:state.member.role,status:state.member.status}]}};
  ctx=vm.createContext({window:{TennisNoteDataClient:client},state,crypto,$:()=>input,normalizeIdentityPhone:x=>String(x||"").replace(/\D/g,""),normalizeIdentityText:x=>String(x||"").trim(),phoneVerificationControls:()=>({input}),profilePhoneExpectedPhone:oldPhone,profilePhoneEditorOwner:null,signupSmsEnabled:true,phoneVerificationState:()=>({status:"unverified"}),confirmedDirectAuthPhone:u=>u.phone,verifiedPhoneFromAuthUser:u=>u.phone,markIdentityPhoneVerified:()=>{marked++},resetIdentityPhoneVerification:()=>{},openAppSheet:()=>{},refreshAuthProviderCapabilities:()=>Promise.resolve(),setIdentityPhoneStatus:()=>{},selfProfileStyleOperation:{fingerprint:"unchanged-pre-save",key:"synthetic-existing-key",parameters:null},profilePhoneSaveOperation:{fingerprint:"unchanged-phone",key:"synthetic-phone-key"},applySavedIdentity:()=>{apply++}});
  for(const n of names){if(n==="profilePhoneEditorOwnerCurrent"&&!s.includes("function "+n+"("))continue;vm.runInContext(extract(s,n),ctx);}
  ctx.openProfileEditor();await new Promise(r=>setImmediate(r));
  const immutable=Object.isFrozen(ctx.profilePhoneEditorOwner);if(stage==="before-save")mutate();
  const keyBefore=JSON.stringify(ctx.selfProfileStyleOperation),ownerBefore=JSON.stringify({...ctx.profilePhoneEditorOwner,client:undefined});
  let accepted=false,error="";
  try{const r=await ctx.persistIdentityProfile({realName:"합성",nickname:"합성별명",phone,profileEditor:true,profileStyle:{tennis_goal:"합성 초안"}});accepted=r.ok===true;}catch(e){error=e.message;}
  const unchanged=JSON.stringify(state.profile)===draft&&input.value===phone;
  const early=["before-save","open-auth","save-auth"].includes(stage);
  if(early&&!accepted){assert.equal(rpc,0);assert.equal(reads,0);assert.equal(apply,0);assert(unchanged);assert.equal(JSON.stringify(ctx.selfProfileStyleOperation),keyBefore);assert.equal(JSON.stringify({...ctx.profilePhoneEditorOwner,client:undefined}),ownerBefore);}
  if(["rpc","read"].includes(stage)&&!accepted){assert.equal(apply,0);assert(unchanged);assert.equal(ctx.selfProfileStyleOperation.key,requestKey);}
  return {stage,field,accepted,authQueries:auth,rpc,reads,apply,draftPreserved:unchanged,keyPreserved:early?JSON.stringify(ctx.selfProfileStyleOperation)===keyBefore:ctx.selfProfileStyleOperation.key===requestKey,immutableEditor:immutable,rejection:error?/context_changed|readback_unconfirmed/.test(error):false};
}
module.exports={scenario,names};
