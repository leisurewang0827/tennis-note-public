const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname,"..");
const port=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/verified-profile-phone-source-parity.json"),"utf8"));
const version=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version;
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const {restorePhone,restoreOperationStatus,restoreAuthReconciliation,restoreSessionLoss}=require("./helpers/verified-profile-phone-port.cjs");
test("세션 없는 실제 가입·동의 함수는 로컬 완료를 만들지 않고 입력을 보존",async()=>{
  const rows=port.sessionLoss.files;
  let applied=0;
  const context={Date,window:{TennisNoteDataClient:{rpc:async()=>{throw Error("unexpected_rpc");}}},
    hasLiveMemberSession:()=>false,normalizeIdentityText:value=>String(value||"").trim(),
    normalizeIdentityPhone:value=>String(value||"").replace(/\D/g,""),
    applySavedIdentity:()=>{applied+=1;},applyConsentPreferences:()=>{applied+=1;},
    identityPrivacyVersion:"fixture-privacy",identityTermsVersion:"fixture-terms"};
  vm.createContext(context);
  const input={realName:"합성 회원",nickname:"합성별명",phone:"01000000003",birthYear:2000,neighborhood:"",gender:"prefer_not"};
  for(const name of ["persistIdentityProfile","persistConsentPreferences"]){
    const fn=rows.flatMap(row=>row.functions).find(fn=>fn.name===name);
    assert(fn); applied=0;
    const legacy=vm.runInContext(`${fn.before}; ${name}`,context);
    const result=await legacy(input);
    assert.equal(result.ok,true);assert.equal(applied,1,"baseline false success must be reproduced");
    applied=0;
    const current=vm.runInContext(`${fn.after}; ${name}`,context);
    await assert.rejects(current(input),/login_required/);
    assert.equal(applied,0);
  }
  for(const row of rows){
    const current=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n");
    assert.equal(hash(current),row.afterFileSha256);
    assert.equal(hash(restoreSessionLoss(row.path,current)),row.beforeFileSha256);
    assert.throws(()=>restoreSessionLoss(row.path,current+"\n"),/Auth session loss candidate drift/);
  }
});
test("실제 migration 응답 shape의 승인대기·자동연결·응답유실을 분리",async()=>{
  const fn=port.sessionLoss.files.flatMap(row=>row.functions).find(fn=>fn.name==="persistIdentityProfile");
  const sourceId="synthetic-source",targetId="synthetic-linked",authId="synthetic-auth",phone="01000000003";
  const row={id:sourceId,name:"합성 회원",nickname:"합성별명",phone:"",birth_year:2000,neighborhood:"",gender:"prefer_not",
    role:"member",status:"active",updated_at:"2026-01-01T00:00:00Z",profile_completed_at:"2026-01-01T00:00:00Z",
    privacy_consent_version:"fixture-privacy",privacy_consented_at:"2026-01-01T00:00:00Z"};
  const {role,status,updated_at,...receipt}=row;
  assert(!Object.hasOwn(receipt,"role")&&!Object.hasOwn(receipt,"status"));
  let live=true,mode="pending",applied=0,restored=0,reads=0,rpcs=0,keys=[];
  const client={rpc:async(name,args)=>{
    assert.equal(name,"tn_save_my_signup_profile");rpcs++;keys.push(args.target_operation_key);
    if(mode==="response-loss"){mode="pending";throw new TypeError("Failed to fetch");}
    if(mode==="lost-rpc")live=false;
    return mode.startsWith("linked")?{ok:true,linkStatus:"linked",profile:{...receipt,id:targetId,phone}}:
      {ok:true,linkStatus:"approval_pending",profile:{...receipt,phone_candidate:mode==="wrong-candidate"?"01000000004":phone}};
  },selectRows:async(table,options)=>{
    assert.equal(table,"tn_users");assert.deepEqual(JSON.parse(JSON.stringify(options.filters)),{id:sourceId});
    assert.equal(options.limit,2);assert.equal(options.requireFresh,true);assert.equal(options.requireCurrentSession,true);assert.equal(options.retryAuth,false);
    reads++;return mode==="duplicate-read"?[{...row},{...row}]:[{...row}];
  }};
  const owner={client,authId,profileId:sourceId};
  const context={Date,window:{TennisNoteDataClient:client},hasLiveMemberSession:()=>live,
    normalizeIdentityText:v=>String(v||"").trim(),normalizeIdentityPhone:v=>String(v||"").replace(/\D/g,""),
    phoneVerificationOwner:()=>owner,phoneVerificationOwnerCurrent:()=>live,
    requireVerifiedIdentityPhone:async()=>{},identityPrivacyVersion:"fixture-privacy",signupProfileOperation:{fingerprint:"",key:""},
    crypto:{randomUUID:()=>"fixture-operation-key"},state:{member:{authUserId:"stale-not-authority"}},
    retryTransientNetwork:callback=>callback(),applySavedIdentity:profile=>{assert.equal(profile.phone,"");applied++;},
    applySupabaseMemberSession:async(show,options)=>{
      assert.equal(options.expectedAuthUserId,authId);assert.equal(options.expectedProfileId,targetId);assert.equal(options.requireSignupReadback,true);
      restored++;return mode!=="linked-unconfirmed";
    }};
  vm.createContext(context);const save=vm.runInContext(`${fn.after}; persistIdentityProfile`,context);
  const input={realName:row.name,nickname:row.nickname,phone,birthYear:2000,neighborhood:"",gender:row.gender};
  const pending=await save(input);assert.equal(pending.signupReadbackConfirmed,true);assert.equal(pending.profile.phone,"");assert.equal(applied,1);
  mode="linked";const linked=await save(input);assert.equal(linked.signupReadbackConfirmed,true);assert.equal(restored,1);assert.equal(reads,1);
  mode="linked-unconfirmed";await assert.rejects(save(input),/signup_link_readback_unconfirmed/);assert.equal(applied,1);
  mode="wrong-candidate";const beforeReads=reads;await assert.rejects(save(input),/signup_link_readback_unconfirmed/);assert.equal(reads,beforeReads);
  mode="duplicate-read";await assert.rejects(save(input),/signup_link_readback_unconfirmed/);assert.equal(applied,1);
  mode="lost-rpc";await assert.rejects(save(input),/login_required/);assert.equal(applied,1);
  live=true;mode="response-loss";await assert.rejects(save(input),/Failed to fetch/);
  await save(input);assert.equal(applied,2);assert.equal(new Set(keys).size,1);assert.equal(rpcs,8);
});
test("Python 기존 golden chain도 Auth 증분만 역변환하고 drift를 거부",()=>{
  const result=execFileSync(process.env.TENNISNOTE_PYTHON || "python",["-B","-c",`
import copy, json, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads((a.ROOT/'tests/fixtures/verified-profile-phone-source-parity.json').read_text(encoding='utf-8'))
for row in port['authReconciliation']['files']:
    source=(a.ROOT/row['path']).read_text(encoding='utf-8')
    restored=a.restore_auth_reconciliation_base(row['path'],source)
    assert a.sha256(restored.encode('utf-8'))==row['beforeFileSha256']
    current=next((item for item in port['sessionLoss']['files'] if item['path']==row['path']),row)
    needle=current['functions'][0]['after']
    assert source.count(needle)==1, 'negative fixture must actually mutate current source'
    for drift in (source+'\\n',source.replace(needle,''),source+needle):
        try: a.restore_auth_reconciliation_base(row['path'],drift)
        except RuntimeError: pass
        else: raise AssertionError('Auth drift accepted')
assert a.restore_auth_reconciliation_base('synthetic-unrelated.js','unchanged')=='unchanged'
a.verify()
print('AUTH_PYTHON_GOLDEN_CHAIN_PASS')
`],{cwd:root,encoding:"utf8",maxBuffer:2e6});
  assert.match(result,/AUTH_PYTHON_GOLDEN_CHAIN_PASS/);
});
test("direct Auth 확인은 본인·과거 확인 시각·정확한 번호만 허용",()=>{
  const source=fs.readFileSync(path.join(root,"app/tennis-note-member-app/domain/identity.js"),"utf8");
  const fn=source.match(/^function confirmedDirectAuthPhone\([\s\S]*?^}/m)?.[0];
  assert(fn);
  const read=vm.runInNewContext(`${fn}; confirmedDirectAuthPhone`,{
    normalizeIdentityPhone:value=>String(value||"").replace(/\D/gu,""), Date,
  });
  const owner="synthetic-owner", phone="01000000003";
  const valid={id:owner,phone:"+821000000003",phone_confirmed_at:new Date(Date.now()-1000).toISOString()};
  assert.equal(read(valid,owner),phone);
  for(const user of [null,{id:owner},{...valid,id:"other"},{...valid,phone:"01000000004"},
    {...valid,phone_confirmed_at:"invalid"},{...valid,phone_confirmed_at:new Date(Date.now()+86400000).toISOString()},
    {id:owner,user_metadata:{phone,phone_verified:true}}]){
    assert.notEqual(read(user,owner),phone);
  }
  assert.equal(read(valid,""),"");
});
test("프로필 refresh/save gate는 provider-only·cached proof·stale revision을 거부",async()=>{
  const authSource=fs.readFileSync(path.join(root,"app/tennis-note-member-app/data/auth.js"),"utf8");
  const identitySource=fs.readFileSync(path.join(root,"app/tennis-note-member-app/domain/identity.js"),"utf8");
  const extract=(source,name)=>source.match(new RegExp("^(?:async )?function "+name+"\\([\\s\\S]*?^}","m"))?.[0];
  const names=["verifiedPhoneFromAuthUser","confirmedDirectAuthPhone"];
  const functions=[...names.map(name=>extract(identitySource,name)),
    ...["refreshIdentityPhoneVerification","requireVerifiedIdentityPhone"].map(name=>extract(authSource,name))];
  assert(functions.every(Boolean));
  const phone="01000000003", owner={authId:"synthetic-auth",profileId:"synthetic-profile"};
  const input={value:phone};
  const fixture={authUser:{id:owner.authId,identities:[{provider:"custom:naver",
    identity_data:{mobile:phone,mobile_verified:true}}]},marked:0,reads:0,
    verification:{phone,status:"verified",source:"provider",owner}};
  const context={fixture,Date,signupSmsEnabled:true,state:{profile:{serverRevision:"revision-1"}},
    profilePhoneEditorOwner:{...owner,revision:"revision-1"},
    window:{TennisNoteDataClient:{getAuthUser:async()=>{fixture.reads+=1;return fixture.authUser;}}},
    hasLiveMemberSession:()=>true,phoneVerificationOwner:()=>owner,
    phoneVerificationOwnerCurrent:()=>true,phoneVerificationRequestCurrent:()=>input.value===phone,
    phoneVerificationControls:()=>({input}),phoneVerificationState:()=>fixture.verification,
    markIdentityPhoneVerified:()=>{fixture.marked+=1;return true;},
    normalizeIdentityPhone:value=>String(value||"").replace(/\D/gu,"")};
  vm.createContext(context);
  vm.runInContext(functions.join("\n\n"),context);
  const legacy=vm.runInContext("verifiedPhoneFromAuthUser",context);
  const refresh=vm.runInContext("refreshIdentityPhoneVerification",context);
  const requirePhone=vm.runInContext("requireVerifiedIdentityPhone",context);
  assert.equal(legacy(fixture.authUser,true),phone);
  assert.equal(await refresh("profile"),"");
  await assert.rejects(requirePhone(phone,"profile"),/phone_verification_required/);
  assert.equal(fixture.marked,0);
  fixture.authUser={id:owner.authId,phone,phone_confirmed_at:new Date(Date.now()-1000).toISOString()};
  context.state.profile.serverRevision="revision-2";
  await assert.rejects(requirePhone(phone,"profile"),/phone_verification_required/);
  assert.equal(fixture.marked,0);
  context.state.profile.serverRevision="revision-1";
  assert.equal(await requirePhone(phone,"profile"),true);
  assert.equal(fixture.marked,1);
  assert.equal(fixture.reads,4);
});
test("Auth 응답 유실 복구는 private 함수와 exact 일치하고 이전 후보를 복원",()=>{
  const contract=port.authReconciliation;
  assert.equal(contract.contract,"auth-direct-phone-reconciliation/1");
  assert.deepEqual(contract.files.map(row=>row.path),[
    "app/tennis-note-member-app/actions/enrollment.js",
    "app/tennis-note-member-app/domain/identity.js",
    "app/tennis-note-member-app/data/auth.js",
  ]);
  for(const row of contract.files){
    const current=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n");
    const source=restoreSessionLoss(row.path,current);
    assert.equal(hash(source),row.afterFileSha256);
    assert.equal(hash(restoreAuthReconciliation(row.path,current)),row.beforeFileSha256);
    for(const fn of row.functions){
      assert.equal(hash(fn.before),fn.beforeSha256);
      assert.equal(hash(fn.after),fn.afterSha256);
      assert.equal(fn.afterSha256,hash(source.match(new RegExp("^(?:async )?function "+fn.name+"\\([\\s\\S]*?^}","m"))?.[0]||""));
      assert.equal(fn.afterSha256,{
        requestIdentityPhoneVerification:"26fe806074efbca0ac34945b348e79f5d6739fdc4ef2505aa22cb1970ee6e098",
        confirmIdentityPhoneVerification:"b941b24f3bcb15515e65778055f145617f051c5b5e6a3952fd30fad26bc86100",
        identityErrorMessage:"084fd2eb26233de15879fcddfe41134050239e722f48abbdc12da7f465957f21",
        confirmedDirectAuthPhone:"c54c4fac1dd8c3b4251f95241fe67498d70ae0c75ffb0c0f96c01a32b0a2c46f",
        refreshIdentityPhoneVerification:"8a5b89e7a526fd8d7e35ed24ba16bc007c505c963b8b4308856eb5b089ca1f19",
        requireVerifiedIdentityPhone:"1a0d001b72fc271b0fd8fef64c84134b66f7835335b751e8d4c3520aad586755",
      }[fn.name]);
    }
    assert.throws(()=>restoreAuthReconciliation(row.path,current+"\n"),/Auth(?: session loss)? candidate drift/);
  }
});
test("본인 번호 exact private authority와 공개 metadata 방어 보존",()=>{
  for(const item of port.functions){
    const source=restoreOperationStatus(item.path,fs.readFileSync(path.join(root,item.path),"utf8").replace(/\r\n/g,"\n"));
    const fn=source.match(new RegExp("^(?:async )?function "+item.name+"\\([\\s\\S]*?^}","m"));
    assert(fn,item.name);assert.equal(hash(fn[0]),item.publicSha256,item.name);
    if(item.adapter==="exact_private_function")assert.equal(item.privateSha256,item.publicSha256);
  }
  const source=fs.readFileSync(path.join(root,"app/tennis-note-member-app/domain/identity.js"),"utf8");
  const fn=source.match(/function verifiedPhoneFromAuthUser\([\s\S]*?\n}/)[0];
  assert(!fn.includes("user_metadata"));assert(fn.includes("if (strict)"));
});

test("OTP 확인 줄바꿈 최소 CSS는 canonical private 블록과 exact hash parity",()=>{
  const item=port.otpConfirmStyle;
  const css=fs.readFileSync(path.join(root,item.publicPath),"utf8").replace(/\r\n/g,"\n");
  const block=css.match(/\/\* OTP input is the flexible column;[\s\S]*?#profilePhoneVerifyButton \{[\s\S]*?\n\}/)[0];
  assert.equal(hash(block),item.blockSha256);
  assert(block.includes("minmax(0, 1fr) auto"));assert(block.includes("min-width: 64px"));
  assert(block.includes("white-space: nowrap"));assert(block.includes("font-size: 16px"));
  assert.equal(item.adapter,"exact_private_css_block");
});
test("승인 번호 이식 inverse가 기존 golden 파일을 정확히 복구",()=>{
  for(const row of port.files){
    let source=restoreOperationStatus(row.path,fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n")).split(version).join(port.publicVersion);
    assert.equal(hash(source),row.candidateSha256,row.path);
    for(const h of [...row.hunks].reverse()){
      assert.equal(source.split(h.after).length-1,1,row.path);source=source.replace(h.after,h.before);
    }
    assert.equal(hash(source),row.baseSha256,row.path);
  }
});

test("전화번호 projection 추가·중복·누락 drift는 기존 golden 이전에 차단",()=>{
  for(const row of port.files){
    const source=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n");
    const restored=restorePhone(row.path,source).split(version).join(port.publicVersion);
    assert.equal(hash(restored),row.baseSha256,row.path);
    const authRow=port.authReconciliation.files.find(item=>item.path===row.path);
    const sessionRow=port.sessionLoss.files.find(item=>item.path===row.path);
    const after=sessionRow?.functions.at(-1).after||authRow?.functions.at(-1).after||row.hunks.at(-1).after;
    assert.equal(source.split(after).length,2,row.path);
    for(const drift of [source+"\n",source.replace(after,()=>after+after),source.replace(after,"")]){
      assert.throws(()=>restorePhone(row.path,drift),/Auth(?: session loss)? candidate drift|phone candidate drift/);
    }
  }
});

test("전화번호 브라우저 단독 변경도 PR·push 필터와 full verify에 필수 연결",()=>{
  const runner="scripts/check_tennisnote_verified_profile_phone_browser.cjs";
  const workflow=fs.readFileSync(path.join(root,".github/workflows/tennisnote-public-ci.yml"),"utf8");
  const verify=fs.readFileSync(path.join(root,"scripts/verify.sh"),"utf8");
  assert.equal(workflow.split('      - "'+runner+'"').length-1,2);
  assert.equal(verify.split("node "+runner).length-1,1);
});
