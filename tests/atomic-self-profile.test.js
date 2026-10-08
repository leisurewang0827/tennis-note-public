const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/tennis-note-member-app/actions/profile.js'),'utf8');
const fn=source.match(/^function profileSaveErrorMessage\([\s\S]*?^}/m)[0];
const sandbox={identityErrorMessage:()=> '기존 인증 오류'};
vm.createContext(sandbox);vm.runInContext(fn,sandbox);

test('실제 client transport code와 gateway timeout은 결과 미확인, 부분 실패로 단정하지 않음',()=>{
  for(const error of [{code:'server_connection_failed',status:0,message:'server_connection_failed'},
    {status:408},{status:502},{status:503},{status:504},{message:'profile_atomic_readback_unconfirmed'}]){
    const message=sandbox.profileSaveErrorMessage(error);
    assert(message.includes('결과를 확인하지 못했습니다'));assert(message.includes('입력은 유지'));
    assert(!message.includes('저장되지 않았습니다'));
  }
});
test('권한 거절과 stale/validation은 일반 재시도 성공 안내로 바꾸지 않음',()=>{
  assert(sandbox.profileSaveErrorMessage({code:'42501'}).includes('관리자'));
  assert(sandbox.profileSaveErrorMessage({message:'profile_revision_stale'}).includes('최신'));
  assert(sandbox.profileSaveErrorMessage({message:'profile_style_input_invalid'}).includes('저장되지 않았습니다'));
  assert(sandbox.profileSaveErrorMessage({message:'profile_phone_input_invalid'}).includes('계약'));
});
test('성공은 한 self RPC readback 이후, 직접 PATCH/skipped 성공 경로 없음',()=>{
  const save=source.match(/^async function saveProfileInfoOnce\([\s\S]*?^}/m)[0];
  const update=source.match(/^async function updateMemberProfileOnServer\([\s\S]*?^}/m)[0];
  assert.equal(save.match(/persistIdentityProfile\(/g).length,1);
  assert(!save.includes('updateMemberProfileOnServer'));
  assert(!update.includes('updateRows'));assert(!update.includes('skipped'));
  assert(update.indexOf('profile_atomic_readback_unconfirmed')<update.indexOf('applySavedIdentity'));
  assert(update.includes('selfProfileStyleOperation.parameters ||='));
});

test('실제 profile query가 revision을 포함하며 구 bootstrap 응답은 exact self 재조회',async()=>{
  const clientSource=fs.readFileSync(path.join(root,'app/shared/tennisnote-data-client.js'),'utf8');
  const entry=clientSource.match(/^  async function performSelectCurrentProfile\([\s\S]*?^  }/m)[0];
  const port=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/verified-profile-phone-source-parity.json'),'utf8'));
  assert.equal(require('node:crypto').createHash('sha256').update(entry.replace(/\r\n/g,'\n')).digest('hex'),port.atomicExtension.profileReadbackFunctionSha256);
  for(const scenario of ['lesson','old-bootstrap','wrong-readback','duplicate-readback','missing-revision']){
    let reads=0, bootstrap=0;
    const profile={id:'synthetic-profile',role:'member',member_kind:scenario==='lesson'?'lesson_member':'journal_only',updated_at:'2026-01-01T00:00:00Z'};
    const context={flushOAuthProviderCredentialCapture:async()=>{},getSession:()=>({access_token:'synthetic'}),
      getAuthUser:async()=>({id:'synthetic-auth'}),emitClientError:()=>{},rpc:async()=>({status:'ok',actorUserId:profile.id}),
      bootstrapCurrentProfile:async()=>{bootstrap++;return {profile:{id:profile.id,role:'member'}};},
      selectRows:async(table,options)=>{
        if(table==='tn_coach_roles')return [];
        reads++;assert(options.select.split(',').includes('updated_at'));
        if(reads===2 && scenario==='wrong-readback')return [{...profile,id:'synthetic-other'}];
        if(reads===2 && scenario==='duplicate-readback')return [profile,profile];
        if(reads===2 && scenario==='missing-revision')return [{...profile,updated_at:null}];
        return [profile];
      }};
    vm.createContext(context);vm.runInContext(entry,context);
    const result=await context.performSelectCurrentProfile();
    if(['wrong-readback','duplicate-readback','missing-revision'].includes(scenario)){
      assert.equal(result.profile,null);assert.equal(result.profileBootstrapError.code,'profile_revision_unconfirmed');
    }else{
      assert.equal(result.profile.updated_at,profile.updated_at);
      assert.equal(reads,scenario==='lesson'?1:2);assert.equal(bootstrap,scenario==='lesson'?0:1);
    }
  }
});

function profileRuntime() {
  const fields = Object.fromEntries(['saveProfileInfo','requestNtrpCheck','profileEditorSheet','profileRealNameInput',
    'profileNicknameInput','profilePhoneInput','profileHand','profileBackhand','profileStartedAt','profileGoal',
    'profileStyleMemo','profileSelfNtrp'].map(id=>[id,{value:'',disabled:false,readOnly:false,hidden:false}]));
  Object.assign(fields.profileRealNameInput,{value:'합성 초안 이름'});
  Object.assign(fields.profileNicknameInput,{value:'합성 초안 별명'});
  Object.assign(fields.profilePhoneInput,{value:'synthetic-draft-phone'});
  Object.assign(fields.profileHand,{value:'왼손'});Object.assign(fields.profileBackhand,{value:'원핸드 백핸드'});
  Object.assign(fields.profileStartedAt,{value:'2026-01-01'});Object.assign(fields.profileGoal,{value:'합성 새 목표'});
  Object.assign(fields.profileStyleMemo,{value:'합성 새 메모'});Object.assign(fields.profileSelfNtrp,{value:'3'});
  const calls=[], exports=[];
  const c={state:{profile:{name:'합성 저장 이름',nickname:'합성 저장 별명',phone:'synthetic-saved-phone',
    serverRevision:'2026-01-01T00:00:00Z',photoDataUrl:'https://fixture.invalid/draft.png',goal:'저장 목표',styleMemo:'저장 메모',
    selfNtrp:'2.5',ntrpSurvey:{},coachNtrp:'',ntrpCheckRequested:false},ticketHistory:[]},
    $:selector=>fields[selector.slice(1)],fields,calls,exports,
    hasLiveMemberSession:()=>true,phoneVerificationOwner:()=>({authId:'synthetic-auth',profileId:'synthetic-profile'}),
    profilePhoneEditorOwner:{authId:'synthetic-auth',profileId:'synthetic-profile',revision:'2026-01-01T00:00:00Z'},
    profilePhoneExpectedPhone:'synthetic-saved-phone',phoneVerificationOwnerCurrent:()=>true,
    phoneVerificationRequestCurrent:()=>true,normalizeIdentityPhone:x=>x,normalizeIdentityText:x=>x,
    selfProfileStyleOperation:{fingerprint:'',key:'',parameters:null},profileInfoSaving:false,ntrpCheckSaving:false,
    crypto:{randomUUID:()=>`synthetic-operation-${calls.length+1}`},
    collectNtrpSurvey:()=>({level:'3',answers:{rally:3}}),
    applySavedIdentity:p=>{c.state.profile.serverRevision=p.updated_at;c.state.profile.name=p.name;
      c.state.profile.nickname=p.nickname;c.state.profile.phone=p.phone;},
    identityErrorMessage:()=> '기존 인증 오류',showToast:()=>{},setNicknameStatus:()=>{},renderTickets:()=>{},saveSnapshot:()=>{},
    exportNtrpRequest:s=>exports.push(s),renderProfile:()=>{fields.profileGoal.value=c.state.profile.goal;
      fields.profileStyleMemo.value=c.state.profile.styleMemo;},closeAppSheet:()=>{fields.profileEditorSheet.hidden=true;},
    window:{TennisNoteInputGuard:{markSaved:()=>{}}}};
  c.reply = parameters=>({ok:true,styleSaved:true,profileContract:'atomic-self-profile/1',
    profile:{id:'synthetic-profile',name:c.state.profile.name,nickname:c.state.profile.nickname,phone:c.state.profile.phone,
      updated_at:c.state.profile.serverRevision,profile_photo_url:'https://fixture.invalid/saved.png',
      tennis_goal:c.state.profile.goal,play_style_memo:c.state.profile.styleMemo,
      ...parameters.target_profile,ntrp_requested_at:'2026-01-01T00:00:01Z'}});
  c.window.TennisNoteDataClient={rpc:async(name,parameters)=>{calls.push({name,parameters:JSON.parse(JSON.stringify(parameters))});return c.reply(parameters);}};
  c.persistIdentityProfile=async p=>{const result=await c.updateMemberProfileOnServer(p.profileStyle,
    {name:p.realName,nickname:p.nickname,phone:p.phone});if(!result.ok)throw result.error;return result;};
  vm.createContext(c);
  for(const name of ['updateMemberProfileOnServer','profileSaveErrorMessage','lockProfileMutationControls',
    'saveProfileInfo','saveProfileInfoOnce','requestNtrpCheck']){
    const found=source.match(new RegExp('^(?:async )?function '+name+'\\([\\s\\S]*?^}', 'm'));
    assert(found,name);vm.runInContext(found[0],c);
  }
  return c;
}

test('응답 유실은 같은 revision/key/payload, 확인된 stale 후 새 권위 revision은 새 key',async()=>{
  const c=profileRuntime();
  c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{
    c.calls.push({name,parameters:JSON.parse(JSON.stringify(parameters))});throw new TypeError('Failed to fetch');};
  assert.equal((await c.updateMemberProfileOnServer({tennis_goal:'합성 목표'})).ok,false);
  c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{
    c.calls.push({name,parameters:JSON.parse(JSON.stringify(parameters))});return c.reply(parameters);};
  assert.equal((await c.updateMemberProfileOnServer({tennis_goal:'합성 목표'})).ok,true);
  assert.deepEqual(c.calls[0].parameters,c.calls[1].parameters);
  c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{
    c.calls.push({name,parameters:JSON.parse(JSON.stringify(parameters))});throw new Error('profile_revision_stale');};
  assert.equal((await c.updateMemberProfileOnServer({tennis_goal:'합성 목표'})).ok,false);
  c.state.profile.serverRevision='2026-01-01T00:00:02Z'; // 권위 재조회 결과를 모델링한다. 자동 재시도는 없다.
  c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{
    c.calls.push({name,parameters:JSON.parse(JSON.stringify(parameters))});return c.reply(parameters);};
  assert.equal((await c.updateMemberProfileOnServer({tennis_goal:'합성 목표'})).ok,true);
  assert.notEqual(c.calls[2].parameters.target_operation_key,c.calls[3].parameters.target_operation_key);
  assert.equal(c.calls[3].parameters.target_profile.expected_revision,c.state.profile.serverRevision);
  assert.equal(c.calls.length,4);
});

test('열린 NTRP 성공·실패는 이름/번호/스타일/사진 초안과 Back 상태를 보존',async()=>{
  for(const fail of [false,true]){
    const c=profileRuntime();
    const draft=JSON.stringify(c.fields), photo=c.state.profile.photoDataUrl;
    if(fail)c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{c.calls.push({name,parameters});throw Object.assign(new Error('permission denied'),{code:'42501'});};
    assert.equal(await c.requestNtrpCheck(),!fail);
    assert.equal(JSON.stringify(c.fields),draft);assert.equal(c.state.profile.photoDataUrl,photo);
    assert.equal(c.fields.profileEditorSheet.hidden,false);
    assert.equal(c.exports.length,fail?0:1);assert.equal(c.state.ticketHistory.length,fail?0:1);
    assert.equal(c.state.profile.goal,'저장 목표');assert.equal(c.state.profile.styleMemo,'저장 메모');
    assert.equal('tennis_goal' in c.calls[0].parameters.target_profile,false);
    assert.equal('play_style_memo' in c.calls[0].parameters.target_profile,false);
    assert.equal(c.calls[0].parameters.target_profile.phone,'synthetic-saved-phone');
    assert.equal(c.profilePhoneEditorOwner.revision,c.state.profile.serverRevision);
  }
});

test('NTRP→저장 및 저장→NTRP interleaving은 공통 잠금으로 RPC 1, 두 버튼 잠금·복구',async()=>{
  for(const first of ['requestNtrpCheck','saveProfileInfo']){
    const c=profileRuntime();let release;
    // This fixture exercises mutation exclusion, not new-phone proof. A changed
    // phone without server phoneVerified must still fail its separate guard.
    c.fields.profilePhoneInput.value=c.state.profile.phone;
    c.window.TennisNoteDataClient.rpc=async(name,parameters)=>{
      c.calls.push({name,parameters});await new Promise(resolve=>{release=resolve;});return c.reply(parameters);};
    const pending=c[first]();assert.equal(c.calls.length,1);
    assert.equal(c.fields.saveProfileInfo.disabled,true);assert.equal(c.fields.requestNtrpCheck.disabled,true);
    const second=first==='requestNtrpCheck'?'saveProfileInfo':'requestNtrpCheck';
    assert.equal(await c[second](),false);assert.equal(await c[first](),false);assert.equal(c.calls.length,1);
    release();assert.equal(await pending,true);
    assert.equal(c.fields.saveProfileInfo.disabled,false);assert.equal(c.fields.requestNtrpCheck.disabled,false);
    assert.equal(c.profileInfoSaving,false);assert.equal(c.ntrpCheckSaving,false);
  }
});

test('서버가 확인한 수준 요청은 표시용 측정 전 문구를 rating으로 오인하지 않음',async()=>{
  for(const label of ['측정 전','3.0']){
    const c=profileRuntime();c.state.profile.coachNtrp=label;
    assert.equal(await c.requestNtrpCheck(),true);
    assert.equal(c.state.profile.ntrpCheckRequested,true);
    assert.equal(c.state.profile.coachNtrp,label);assert.equal(c.calls.length,1);
  }
});
