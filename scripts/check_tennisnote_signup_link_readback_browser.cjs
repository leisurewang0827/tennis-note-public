/* 실제 public modular entry/functions, synthetic RPC responses; no external network. */
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
        await context.route('**/*',route=>{
          if(new URL(route.request().url()).pathname.endsWith('config.local.js'))return route.fulfill({contentType:'text/javascript',body:'window.TENNISNOTE_CONFIG={};'});
          return route.request().url().startsWith(new URL(base).origin)?route.continue():route.abort();
        });
        const page=await context.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/tennis-note-member-app/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof submitIdentitySetup==='function');
        const baselineFont=await page.locator('#identityPhone').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
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
          const smsCalls=calls.filter(call=>call==='SMS'||call==='VERIFY').length;
          const smsHidden=document.getElementById('identityPhoneVerification').hidden;
          markIdentityPhoneVerified('01'+'0'.repeat(9));
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
        check(member.smsCalls===0&&!member.smsHidden,'signup-SMS-required-visible');
        check(member.firstAttempts===1,'double-submit-one');
        check(member.preserved&&member.errorVisible,'error-draft-preserved');
        check(member.attempts.length===2&&member.attempts[0]===member.attempts[1],'response-loss-same-key');
        check(member.closed&&member.complete&&!member.canonicalPhone,'enter-without-canonical-phone');
        // 공개 기준 CSS는 1024px 이하에 16px을 강제한다. 데스크톱은 기존 계산값을 보존한다.
        check(!member.overflow&&member.font===baselineFont&&(width>1024||member.font>=16),`signup-layout:${engineName}:${width}:${colorScheme}:overflow=${member.overflow}:font=${member.font}`);
        if(process.env.TENNISNOTE_SIGNUP_CAPTURE_DIR){
          const path=require('node:path'),dir=process.env.TENNISNOTE_SIGNUP_CAPTURE_DIR;
          fs.mkdirSync(dir,{recursive:true});
          await page.evaluate(()=>document.getElementById('identitySetupModal').hidden=false);
          await page.locator('#identitySetupModal').screenshot({path:path.join(dir,`${engineName}-signup-${width}-${colorScheme}.png`),mask:[page.locator('#identitySetupForm input')]});
          await page.evaluate(()=>document.getElementById('identitySetupModal').hidden=true);
        }
        const linked=await page.evaluate(async()=>{
          // Exercise actual signup/session hydration/ticket selection. Transport
          // and unrelated feeds are synthetic; this is not hosted E2E evidence.
          const client=window.TennisNoteDataClient;
          const authId='00000000-0000-4000-8000-000000000110';
          const target='00000000-0000-4000-8000-000000000020';
          const ticketId='00000000-0000-4000-8000-000000000060';
          const profile={id:target,name:'합성 회원',nickname:'합성가입',role:'member',status:'active',member_kind:'lesson_member',
            phone:'01'+'0'.repeat(9),birth_year:2000,gender:'prefer_not',profile_completed_at:new Date().toISOString(),privacy_consent_version:identityPrivacyVersion};
          let mode='mismatch',saves=0,workspaceReads=0;const keys=[],ticketOwners=[],toasts=[];
          const session={access_token:'synthetic-session',provider:'email'};
          client.getSession=()=>session;client.ensureSession=async()=>session;client.consumeOAuthRedirect=async()=>{};
          client.selectCurrentProfile=async()=>({user:{id:authId,user_metadata:{}},profile:{...profile,id:mode==='mismatch'?'wrong-profile':target},coachRole:null});
          client.selectRows=async(table,options)=>{
            if(table==='tn_member_tickets'){
              ticketOwners.push(options.filters.user_id||options.filters.id);
              return [{id:ticketId,user_id:target,branch_id:'synthetic-branch',status:'active',total_sessions:5,used_sessions:1,remaining_sessions:4,
                starts_on:new Date(Date.now()-86400000).toISOString().slice(0,10),expires_on:new Date(Date.now()+30*86400000).toISOString().slice(0,10),
                tn_membership_products:{name:'합성 정규권',lesson_minutes:20,product_kind:'regular',total_sessions:5}}];
            }
            return [];
          };
          client.rpc=async(name,p)=>{
            if(name==='tn_save_my_signup_profile'){saves++;keys.push(p.target_operation_key);return {ok:true,linkStatus:'linked',profile};}
            if(name==='tn_save_my_consent_preferences')return {ok:true};
            return {};
          };
          // No notification/push/consent write or onboarding side effects.
          loadIdentityConsentPreferences=async()=>{};syncIdentitySetupModal=()=>{};
          syncMemberRefundRequests=async()=>false;syncMemberPendingPurchaseSchedulesFromServer=async()=>false;
          syncMemberPendingPaymentsFromServer=async()=>false;syncMemberAccountDeletionRequestFromServer=async()=>false;
          syncMemberChangeRequestsFromServer=async()=>false;syncMemberJournalEntriesFromServer=async()=>false;
          syncMemberGroupAccountFromServer=async()=>false;syncMemberNotificationsFromServer=async()=>false;
          syncNativePushRegistration=async()=>false;syncLiveSchedulePolicy=async()=>{};
          scheduleNativePushPrimer=()=>{};applyPendingOnboardingIntent=async()=>{};
          memberCurriculumUI.bindVerifiedProfile=async()=>{};
          openAppFromSession=()=>{};renderAll=()=>{};saveSnapshot=()=>{};showToast=text=>toasts.push(text);
          syncMemberLessonsFromServer=async p=>{workspaceReads++;if(p.id!==target)throw Error('wrong-fixture-owner');return mode!=='readback-fail';};
          state.member={profileId:'synthetic-source',authUserId:authId,role:'member',status:'active'};
          const form=document.getElementById('identitySetupForm'),modal=document.getElementById('identitySetupModal');
          const submit=()=>submitIdentitySetup({preventDefault(){},currentTarget:form});
          modal.hidden=false;markIdentityPhoneVerified(profile.phone);
          await Promise.all([submit(),submit()]);
          const mismatch={saves,reads:ticketOwners.length,open:!modal.hidden,success:toasts.length};
          mode='readback-fail';markIdentityPhoneVerified(profile.phone);await submit();
          const failed={open:!modal.hidden,message:document.getElementById('identitySetupMessage').textContent,success:toasts.length};
          mode='ok';markIdentityPhoneVerified(profile.phone);await submit();
          return {mismatch,failed,saves,sameKey:keys.length===3&&new Set(keys).size===1,
            profileExact:state.member?.profileId===target,authExact:state.member?.authUserId===authId,
            ticketExact:state.liveTickets.length===1&&state.liveTickets[0].id===ticketId,
            remaining:state.remaining,allOwnerExact:ticketOwners.length>0&&ticketOwners.every(id=>id===target),workspaceReads,
            closed:modal.hidden,success:toasts.length===1&&toasts[0].includes('회원권과 수업'),
            retained:document.getElementById('identityRealName').value==='합성 회원'};
        });
        check(linked.mismatch.saves===1&&linked.mismatch.reads===0&&linked.mismatch.open&&linked.mismatch.success===0,'linked-mismatch-no-feed-no-success');
        check(linked.failed.open&&linked.failed.message.includes('다시 확인')&&linked.failed.success===0,'linked-readback-failure-safe-retry');
        check(linked.saves===3&&linked.sameKey&&linked.retained,'linked-retry-same-operation-and-draft');
        check(linked.profileExact&&linked.authExact&&linked.ticketExact&&linked.remaining===4&&linked.allOwnerExact,'linked-actual-ticket-sync-exact');
        check(linked.workspaceReads===2&&linked.closed&&linked.success,'linked-workspace-readback-before-success');
        check(errors.length===0,`page-error-zero:${engineName}:${width}:${colorScheme}:${errors.join('|')}`);
        await context.close();
      }
      console.log(JSON.stringify({engine:engineName,assertions,status:'PASS',actualDevice:false,remoteWrites:0}));
    }finally{await browser.close();}
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
