/* Actual public modular entry/functions, synthetic RPC responses; no external network. */
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const base=process.env.TENNISNOTE_TEST_BASE || 'http://127.0.0.1:8897/app';
let assertions=0;
function check(ok,label){assertions++;if(!ok)throw new Error(label);}
(async()=>{
  for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
    if(process.env.TENNISNOTE_TEST_ENGINE && process.env.TENNISNOTE_TEST_ENGINE!==engineName)continue;
    const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser=await engine.launch({headless:true,...(engineName==='chromium'&&fs.existsSync(chrome)?{executablePath:chrome}:{})});
    try{
      for(const width of [390,768,1366])for(const colorScheme of ['light','dark']){
        // This RPC fixture isolates the actual page from the separately tested PWA cache lifecycle.
        const context=await browser.newContext({viewport:{width,height:844},colorScheme,serviceWorkers:'block'});
        await context.route('**/*',route=>route.request().url().startsWith(new URL(base).origin)?route.continue():route.abort());
        const page=await context.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/tennis-note-member-app/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof submitIdentitySetup==='function');
        const member=await page.evaluate(async()=>{
          const calls=[];const client=window.TennisNoteDataClient;
          client.readiness=()=>({ready:true});client.getSession=()=>({access_token:'synthetic-session'});
          client.requestPhoneChangeVerification=async()=>{calls.push('SMS');};
          client.verifyPhoneChange=async()=>{calls.push('VERIFY');};
          client.getAuthUser=async()=>({user_metadata:{}});
          const attempts=[];let responseLoss=true;
          client.rpc=async(name,payload)=>{
            calls.push(name);
            if(name==='tn_save_my_consent_preferences')return {ok:true,termsVersion:payload.target_terms_version,privacyVersion:payload.target_privacy_version};
            if(name==='tn_save_my_signup_profile'){
              attempts.push(payload.target_operation_key);
              if(responseLoss){responseLoss=false;throw new Error('synthetic_response_loss');}
              const p=payload.target_profile;
              return {ok:true,linkStatus:'approval_pending',profile:{name:p.name,nickname:p.nickname,phone:null,birth_year:p.birthYear,
                gender:p.gender,profile_completed_at:new Date().toISOString(),privacy_consent_version:p.privacyVersion}};
            }
            throw new Error('unexpected_fixture_rpc');
          };
          const form=document.getElementById('identitySetupForm');
          const modal=document.getElementById('identitySetupModal');modal.hidden=false;
          state.profile.phone='';state.profile.profileCompletedAt='';
          document.getElementById('identityRealName').value='합성 회원';
          document.getElementById('identityNickname').value='합성가입';
          document.getElementById('identityPhone').value='01'+'0'.repeat(9);
          document.getElementById('identityBirthYear').value='2000';
          document.getElementById('identityGender').value='prefer_not';
          document.getElementById('identityTermsConsent').checked=true;
          document.getElementById('identityPrivacyConsent').checked=true;
          syncIdentityPhoneCapabilityControl();
          await requestIdentityPhoneVerification();await confirmIdentityPhoneVerification();await requestNaverPhoneConsent();
          const smsCalls=calls.length;
          const smsHidden=document.getElementById('identityPhoneVerification').hidden;
          await Promise.all([submitIdentitySetup({preventDefault(){},currentTarget:form}),submitIdentitySetup({preventDefault(){},currentTarget:form})]);
          const firstAttempts=attempts.length;
          const preserved=document.getElementById('identityRealName').value==='합성 회원'&&!modal.hidden;
          const errorVisible=Boolean(document.getElementById('identitySetupMessage').textContent);
          await submitIdentitySetup({preventDefault(){},currentTarget:form});
          return {smsCalls,smsHidden,firstAttempts,preserved,errorVisible,attempts,
            closed:modal.hidden,complete:identityProfileComplete(),canonicalPhone:state.profile.phone,
            overflow:document.documentElement.scrollWidth>innerWidth+1,
            font:parseFloat(getComputedStyle(document.getElementById('identityPhone')).fontSize)};
        });
        check(member.smsCalls===0&&member.smsHidden,'signup-SMS-OFF');
        check(member.firstAttempts===1,'double-submit-one');
        check(member.preserved&&member.errorVisible,'error-draft-preserved');
        check(member.attempts.length===2&&member.attempts[0]===member.attempts[1],'response-loss-same-key');
        check(member.closed&&member.complete&&!member.canonicalPhone,'enter-without-canonical-phone');
        check(!member.overflow&&member.font>=16,`signup-layout:${engineName}:${width}:${colorScheme}:overflow=${member.overflow}:font=${member.font}`);
        await page.goto(base+'/admin/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof submitSignupLinkApproval==='function');
        const admin=await page.evaluate(async()=>{
          const calls=[];let loss=true;
          operationsRole=()=> 'admin';activeOperationBranchId=()=> 'synthetic-branch';
          loadMemberLinkCandidates=async()=>{};refreshMemberAuthManagement=async()=>{};
          const member={id:'local-member',serverUserId:'target-member',name:'합성 대상'};
          members.push(member);
          memberManagementActionAllowed=()=>true;
          memberManagementModalState.memberId=member.id;
          memberManagementModalState.action='app_link';
          memberManagementModalState.signupLinkRequests=[{id:'request-a',targetUserId:member.serverUserId,branchId:'synthetic-branch',status:'pending',revision:1}];
          renderMemberManagementModal();
          const form=document.getElementById('memberManagementForm');
          if(!form?.elements.signupLinkRequest)throw new Error('existing-modal-pending-control-missing');
          form.elements.signupLinkRequest.value='request-a';
          form.elements.signupLinkDecision.value='approve';
          const submit=()=>submitMemberManagementForm({preventDefault(){},target:form});
          window.TennisNoteDataClient.rpc=async(name,p)=>{calls.push({name,p});if(loss){loss=false;throw new Error('synthetic-response-loss');}
            return {ok:true,requestId:p.target_request_id,branchId:p.target_branch_id,targetUserId:p.target_member_id,status:'approved'};};
          await submit();
          const unchecked=calls.length;
          form.elements.signupLinkBranchConfirmed.checked=true;
          memberManagementModalState.signupLinkRequests[0].branchId='other-branch';
          await submit();const mismatch=calls.length;
          memberManagementModalState.signupLinkRequests[0].branchId='synthetic-branch';
          await Promise.all([submit(),submit()]);
          const firstCount=calls.length;
          await submit();
          form.remove();
          return {unchecked,mismatch,firstCount,count:calls.length,sameKey:calls[0]?.p.target_operation_key===calls[1]?.p.target_operation_key,
            exact:calls.every(c=>c.name==='tn_admin_review_signup_link'&&c.p.target_member_id===member.serverUserId&&c.p.target_branch_id==='synthetic-branch')};
        });
        check(admin.unchecked===0&&admin.mismatch===0,'admin-scope-RPC-zero');
        check(admin.firstCount===1&&admin.count===2&&admin.sameKey&&admin.exact,'admin-exact-double-replay');
        check(errors.length===0,`page-error-zero:${engineName}:${width}:${colorScheme}:${errors.join('|')}`);
        await context.close();
      }
      console.log(JSON.stringify({engine:engineName,assertions,status:'PASS',actualDevice:false,remoteWrites:0}));
    }finally{await browser.close();}
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
