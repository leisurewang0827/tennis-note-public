"use strict";
const vm=require("node:vm"),assert=require("node:assert/strict");
const names=["hasLiveMemberSession","phoneVerificationOwner","phoneVerificationOwnerCurrent","profilePhoneEditorOwnerCurrent","phoneVerificationRequestCurrent","openProfileEditor","requestIdentityPhoneVerification","confirmIdentityPhoneVerification"];
const extract=(s,n)=>{const m=s.match(new RegExp("^(?:async )?function "+n+"\\([\\s\\S]*?^}","m"));assert(m);return m[0]};
async function otpScenario(source,action,stage,field,surface="profile"){
  const phone=["010","0000","0003"].join(""),controls={input:{value:phone},code:{value:["123","456"].join("")},send:{disabled:false},verify:{disabled:false},row:{hidden:false}};
  const state={member:{id:"synthetic-profile",profileId:"synthetic-profile",authUserId:"synthetic-owner",role:"coach",status:"active"},liveProfileId:"synthetic-profile",profile:{phone,serverRevision:"synthetic-revision"}};
  let auth=0,verify=0,send=0,marked=0,token="synthetic-session",c;
  const mutate=()=>{if(field==="role")state.member.role="member";if(field==="status")state.member.status="inactive";if(field==="token")token="synthetic-refreshed";};
  const client={readiness:()=>({ready:true}),getSession:()=>({access_token:token,user:{id:"synthetic-owner"}}),getAuthUser:async()=>{auth++;if(stage==="auth")mutate();return{id:"synthetic-owner",phone}},verifyPhoneChange:async()=>{verify++;if(stage==="verify")mutate();},requestPhoneChangeVerification:async()=>{send++;if(stage==="send")mutate();}};
  const pending={status:"pending",phone,owner:{client,authId:"synthetic-owner",profileId:"synthetic-profile"}},beforeInput=JSON.stringify(controls.input),beforeCode=controls.code.value;
  c=vm.createContext({window:{TennisNoteDataClient:client,setTimeout:()=>{}},state,signupSmsEnabled:true,profilePhoneEditorOwner:null,profilePhoneExpectedPhone:phone,identityPhoneConfirmInFlight:false,identityPhoneRequestInFlight:false,profilePhoneVerification:pending,identityPhoneVerification:pending,phoneVerificationState:()=>pending,phoneVerificationControls:()=>controls,normalizeIdentityPhone:s=>String(s||"").replace(/\D/g,""),identityPhoneE164:s=>s,confirmedDirectAuthPhone:u=>action==="request"?"":u.phone,verifiedPhoneFromAuthUser:u=>u.phone,refreshIdentityPhoneVerification:async()=>{},refreshAuthProviderCapabilities:async()=>({status:"ready",providers:{phone:true}}),syncIdentityPhoneCapabilityControl:()=>{},resetIdentityPhoneVerification:()=>{},markIdentityPhoneVerified:()=>{marked++},setIdentityPhoneStatus:()=>{},openAppSheet:()=>{},normalizedIdentityErrorCode:()=>"synthetic",identityErrorMessage:()=>"synthetic-error",phoneAuthUnavailableMessage:()=>"synthetic-unavailable"});
  for(const n of names)vm.runInContext(extract(source,n),c);c.openProfileEditor();if(stage==="before")mutate();
  const accepted=await c[action==="request"?"requestIdentityPhoneVerification":"confirmIdentityPhoneVerification"](surface);
  if(stage!=="none"&&field!=="token") {assert.equal(accepted,false);assert.equal(marked,0);assert.equal(JSON.stringify(controls.input),beforeInput);assert.equal(controls.code.value,beforeCode);if(stage==="before")assert.equal(auth+verify+send,0);}
  return {action,stage,field,surface,accepted,auth,verify,send,marked};
}
module.exports={names,extract,otpScenario};
