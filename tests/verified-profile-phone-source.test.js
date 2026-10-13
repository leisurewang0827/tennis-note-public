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
const {restorePhone,restoreOperationStatus,restoreAuthReconciliation}=require("./helpers/verified-profile-phone-port.cjs");
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
    for drift in (source+'\\n',source.replace(row['functions'][0]['after'],''),source+row['functions'][0]['after']):
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
    const source=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n");
    assert.equal(hash(source),row.afterFileSha256);
    assert.equal(hash(restoreAuthReconciliation(row.path,source)),row.beforeFileSha256);
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
    assert.throws(()=>restoreAuthReconciliation(row.path,source+"\n"),/Auth candidate drift/);
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
    const after=authRow?.functions.at(-1).after||row.hunks.at(-1).after;
    assert.equal(source.split(after).length,2,row.path);
    for(const drift of [source+"\n",source.replace(after,()=>after+after),source.replace(after,"")]){
      assert.throws(()=>restorePhone(row.path,drift),/Auth candidate drift|phone candidate drift/);
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
