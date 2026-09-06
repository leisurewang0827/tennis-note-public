const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require("playwright");
const root = path.resolve(__dirname, "..");
const modulePaths = ["views/schedule.js","actions/schedule.js","domain/records.js","data/records.js","events/delegated.js"];
if(process.argv.includes('--draft-back-only'))modulePaths.push('actions/records.js');
const coachRoot = path.join(root,"app/tennis-note-coach-app");
const html = fs.readFileSync(path.join(coachRoot,"index.html"),"utf8");
for (const file of modulePaths) assert(html.includes(file), `actual entry missing ${file}`);
const app = modulePaths.map(file=>fs.readFileSync(path.join(coachRoot,file),"utf8")).join("\n");
const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>fs.readFileSync(path.resolve(coachRoot,m[1].split('?')[0]),"utf8")).join("\n");
const modalHtml = html.slice(html.indexOf('    <section id="lessonEditModal"'),html.indexOf('    <section id="memberDetailModal"')).replace(' hidden>','>');
assert(/class="modal-card(?:\s|\")/.test(modalHtml),"actual scroll container required");
function source(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(app);
  assert(match, `${name} missing`);
  const tail = app.slice(match.index);
  const next = /\n(?:async )?function /.exec(tail.slice(10));
  return next ? tail.slice(0,next.index+10) : tail;
}
const runtime = app; // 실제 index가 읽는 모듈 전체; 제품 함수 복제 없음
const handler = app.slice(app.indexOf('    const attendanceButton = event.target.closest("[data-process-attendance]");'),app.indexOf('    const noShowButton = event.target.closest("[data-process-no-show]");'));
assert(handler.includes("data-lesson-detail-tab") && handler.includes("data-back-lesson-actions"));
let cases=0;
async function checkMemberTickets() {
  const memberRoot=path.join(root,"app/tennis-note-member-app");
  const memberHtml=fs.readFileSync(path.join(memberRoot,"index.html"),"utf8");
  const files=["views/tickets.js","views/common.js","domain/tickets.js","forms/tickets.js"];
  for(const file of files) assert(memberHtml.includes(file));
  const memberRuntime=files.map(file=>fs.readFileSync(path.join(memberRoot,file),"utf8")).join("\n");
  const memberCss=[...memberHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>fs.readFileSync(path.resolve(memberRoot,m[1].split('?')[0]),"utf8")).join("\n");
  const shared=fs.readFileSync(path.join(root,"app/shared/tennisnote-ticket-state.js"),"utf8")+fs.readFileSync(path.join(root,"app/shared/tennisnote-escape-html.js"),"utf8");
  let count=0;
  for(const [name,engine] of [["Chromium",chromium],["WebKit",webkit]]){
    const browser=await engine.launch({headless:true,...(name==='Chromium'&&process.platform==='win32'?{channel:'chrome'}:{})});
    try {for(const [width,height] of [[390,844],[768,1024],[1366,900],[844,390],[1024,768],[900,1366]])for(const theme of ['light','dark']){
      const page=await browser.newPage({viewport:{width,height},colorScheme:theme});const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setContent(`<!doctype html><html lang="ko" data-tennisnote-surface="member" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${memberCss}</style></head><body><main><section id="currentTicketPanel"></section></main></body></html>`);
      await page.addScriptTag({content:`${shared}\n${memberRuntime}\n
        var $=s=>document.querySelector(s),state={liveTickets:[],expiredTickets:[]};
        var refundHeldLiveTickets=()=>[],currentHoldingTicket=()=>null,memberPurchaseLifecycle=()=>"current",memberHoldingRequests=()=>[];
        var pendingPaymentCancelInFlight=new Set();
        state.liveTickets=[{id:'synthetic-a',status:'active',title:'합성 정규 회원권 긴 이름 확인',remaining:4,total:5},{id:'synthetic-b',status:'active',title:'합성 정규 회원권 긴 이름 확인',remaining:3,total:5},{id:'synthetic-a',status:'active',remaining:4,total:5}];
        renderCurrentTicketPanel();
      `});
      assert.deepEqual(await page.locator('[data-member-ticket-id]').evaluateAll(ns=>ns.map(n=>n.dataset.memberTicketId)),['synthetic-a','synthetic-b']);
      assert.equal(await page.locator('[data-primary-member-ticket]').count(),1);
      assert.equal(await page.locator('[data-renew-ticket]').getAttribute('data-renew-ticket'),'synthetic-a');
      assert.equal(await page.locator('.membership-other-tickets').evaluate(n=>n.open),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert((await page.locator('[data-renew-ticket]').boundingBox()).height>=44);
      if(process.env.TENNISNOTE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.TENNISNOTE_SCREENSHOT_DIR,`tickets-${name}-${width}x${height}-${theme}.png`),fullPage:true});
      await page.evaluate(()=>{state.liveTickets=[];renderCurrentTicketPanel();});
      assert.equal(await page.locator('[data-member-ticket-id]').count(),0);
      assert.equal(await page.locator('[data-open-purchase-flow="new_purchase"]').count(),1);
      assert.deepEqual(errors,[]);count++;await page.close();
    }}finally{await browser.close();}
  }
  console.log(`MEMBER_EXACT_TICKET_BROWSER_PASS=${count}; actual modules/card renderer; duplicate exact ID/other ticket/empty/overflow/44px`);
}
async function checkAdminCorrection() {
  const admin = fs.readFileSync(path.join(root,"app/admin/schedule-v2-admin.js"),"utf8");
  const extract = name => {
    const start = new RegExp(`  (?:async )?function ${name}\\(`).exec(admin);
    assert(start, `actual admin ${name} missing`);
    const tail = admin.slice(start.index);
    const next = /\n  (?:async )?function /.exec(tail.slice(10));
    assert(next, `actual admin ${name} boundary missing`);
    return tail.slice(0,next.index+10);
  };
  const entry = admin.slice(admin.indexOf('      const correctionButton = event.target.closest("[data-v2-correct-deduction]");'),admin.indexOf('      const openRevisionButton = event.target.closest("[data-v2-open-feedback-revision]");'));
  assert(entry.includes('void correctParticipantDeduction('));
  const functions = ['correctParticipantDeduction','errorMessage','setEditorMessage'].map(extract).join('\n');
  let scenarios=0;
  for(const [label,engine] of [["Chromium",chromium],["WebKit",webkit]]) {
    const browser = await engine.launch({headless:true,...(label==='Chromium'&&process.platform==='win32'?{channel:'chrome'}:{})});
    try {
      for(const width of [390,768,1366]) for(const theme of ['light','dark']) {
        const page=await browser.newPage({viewport:{width,height:844},colorScheme:theme});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.setContent('<main><section data-v2-outcome-user="synthetic-member" data-v2-ticket-id="synthetic-ticket"><strong>합성 회원</strong><textarea>보존할 합성 초안</textarea><button data-v2-correct-deduction="deduct">누락 차감</button></section><p id="scheduleV2EditorMessage"></p></main>');
        await page.addScriptTag({content:`
          const state={editingLesson:{id:'synthetic-lesson'},payload:{lessons:[{id:'synthetic-lesson'}]}};
          const $=s=>document.querySelector(s),$$=(s,n=document)=>[...n.querySelectorAll(s)];
          window.calls=[];window.refresh=0;window.renders=0;window.allowed=true;window.cancel=false;window.failure='';
          const requireWritableServer=()=>window.allowed;
          window.prompt=()=>window.cancel?null:'합성 정정 사유'; window.confirm=()=>true;
          const operationKey=p=>p+'-synthetic-key';
          const bridge=()=>({rpc:async(name,args)=>{window.calls.push({name,args});await new Promise(r=>setTimeout(r,20));if(window.failure)throw Error(window.failure);return {ok:true};}});
          const invalidateCurrentWorkspaceCache=()=>{};
          const loadWorkspace=async()=>{window.refresh++;state.payload={lessons:[{id:'synthetic-lesson'}]};};
          const renderOutcomeEditor=()=>{window.renders++;document.querySelector('button').disabled=false;};
          ${functions}
          document.addEventListener('click',event=>{${entry}});
        `});
        for(const [code,text] of [
          ['attendance_choice_correction_makeup_conflict','이 출결에 연결된 대기·예약 보강권이 있어 차감만 바꿀 수 없습니다. 기존 보강 내역을 먼저 확인해 주세요.'],
          ['attendance_choice_correction_makeup_policy_required','불참 차감을 복구하려면 보강권 처리도 함께 확인해야 합니다. 차감만 자동으로 복구하지 않았습니다.']]) {
          await page.evaluate(code=>{calls=[];window.failure=code;},code);
          await page.locator('button').click();
          await page.waitForFunction(()=>document.querySelector('#scheduleV2EditorMessage').dataset.tone==='error');
          assert.equal(await page.locator('#scheduleV2EditorMessage').textContent(),text);
          assert.equal(await page.locator('button').isDisabled(),false);
          assert.equal(await page.locator('textarea').inputValue(),'보존할 합성 초안');
          assert.deepEqual(await page.evaluate(()=>({calls,refresh,renders})),{calls:[{name:'tn_admin_correct_schedule_v2_participant_deduction',args:{target_lesson_id:'synthetic-lesson',target_user_id:'synthetic-member',target_ticket_id:'synthetic-ticket',target_deduct:true,target_reason:'합성 정정 사유',target_operation_key:'admin-missing-deduction-synthetic-key'}}],refresh:0,renders:0});
          scenarios++;
        }
        await page.evaluate(()=>{calls=[];window.failure='';});
        await page.locator('button').click();
        await page.waitForFunction(()=>document.querySelector('#scheduleV2EditorMessage').dataset.tone==='success');
        assert.deepEqual(await page.evaluate(()=>({count:calls.length,refresh,renders})),{count:1,refresh:1,renders:1});scenarios++;
        for(const condition of ['permission','cancel']) {
          await page.evaluate(c=>{calls=[];window.allowed=c!=='permission';window.cancel=c==='cancel';},condition);
          await page.locator('button').click();
          assert.equal(await page.evaluate(()=>calls.length),0);scenarios++;
        }
        assert.deepEqual(errors,[]);await page.close();
      }
    } finally {await browser.close();}
  }
  console.log(`ATTENDANCE_ADMIN_CORRECTION_BROWSER_PASS=${scenarios}; actual delegated handler/errorMessage/textContent; synthetic RPC only`);
}
(async()=>{
  if(process.argv.includes('--member-only')) {await checkMemberTickets();return;}
  if(!process.argv.includes('--draft-back-only'))await checkAdminCorrection();
  if(process.argv.includes('--admin-correction-only')) return;
  for (const [engineName,engine] of [["Chromium",chromium],["WebKit",webkit]]) {
    const browser = await engine.launch({headless:true, ...(engineName === "Chromium" && process.platform === "win32" ? {channel:"chrome"} : {})});
    try {
      for (const [width,height] of [[390,844],[768,1024],[1366,900],[844,390],[1024,768],[900,1366]]) for(const theme of ["light","dark"]) {
        const page = await browser.newPage({viewport:{width,height},colorScheme:theme});
        const errors=[]; page.on("pageerror",e=>errors.push(e.message));
        await page.setContent(`<!doctype html><html lang="ko" data-tennisnote-surface="coach" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body>${modalHtml}</body></html>`);
        await page.addScriptTag({content:`
          var state={editingLessonId:"synthetic-lesson",lessonChartDrafts:{},groupFeedbackReviewLessonId:""};
          var $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
          var lesson={id:"synthetic-lesson",serverLessonId:"exact-lesson",member:"합성 회원 이름 긴 글자 시험",day:"월",time:"10:00",remaining:4,totalSessions:8};
          var participants=[{userId:"synthetic-member",ticketId:"exact-ticket",name:"합성 회원",remainingSessions:4,totalSessions:8,usedSessions:4}];
          var ensureCoachLessonRecord=()=>lesson, completionParticipantsForLesson=()=>participants;
          var canProcessLesson=()=>true,canRescheduleLesson=()=>true,lessonOutcomeWindowOpen=()=>true,lessonChartFinalized=()=>false;
          var coachLessonCardState=()=>({id:"scheduled",label:"예약 확정"});
          var lessonParticipantNeedsFeedback=()=>true,lessonGroupFeedbackCommonDraft=()=>null;
          var lessonChartParticipantKey=()=>"member-key",lessonChartParticipantDefaults=()=>({todayGoal:"합성 목표",comment:"",nextCurriculumId:""});
          var lessonGroupFeedbackParticipantUsesException=()=>false,coachMemberChartPanelMarkup=()=>"",curriculumOptions=()=>'<option value="goal">합성 목표</option>';
          var selectedCurriculum=()=>({title:"합성 목표"});
          var lessonDuration=()=>40,loadCoachSchedulePolicy=()=>({openStart:"09:00",openEnd:"18:00"}),minutesFromTime=v=>Number(v.split(":")[0])*60+Number(v.split(":")[1]);
          var makeCoachTimeRange=()=>["10:00","11:00"],lessonGroupDeductionSummary=()=>"",lessonOutcomeGuardMessage=()=>"",lessonPermissionText=()=>"";
          var escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          var captureLessonChartDraft=()=>[],updateLessonCompletionUi=()=>{};
          var activeViewField=s=>document.querySelector(s),exactCoachCurriculum=()=>null,coachCurriculumSearchResults=()=>[];
          var coachScheduleV2WorkspaceCache=null;
          var syncCoachLessonsFromServer=async()=>{window.syncedCount++},renderAll=()=>{},showToast=()=>{}; window.syncedCount=0;
          var closeLessonEditor=()=>{window.closedCount++}; window.closedCount=0;
          window.calls=[];window.failPreview=false;window.failSave=false;window.mismatch=false;
          window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-only"}),rpc:async(name,args)=>{
            window.calls.push({name,args});
            if(name==='tn_preview_coach_attendance_choice'){
              if(window.failPreview)throw Error('function_missing');
              return {contractVersion:1,lessonId:window.mismatch?'wrong-lesson':lesson.serverLessonId,outcome:args.target_outcome,deduct:args.target_deduct,revision:'synthetic-revision',participants:participants.map(p=>({...p,deductedSessions:args.target_deduct?2:0,remainingBefore:4,remainingAfter:args.target_deduct?2:4,makeupCreated:args.target_outcome==='absence'&&!args.target_deduct}))};
            }
            await new Promise(r=>setTimeout(r,30));
            if(window.failSave)throw Error('response_lost');
            return {ok:true};
          }};
          ${runtime}
          bindDelegatedEvents();
          window.test={lesson,processCoachAttendance,selectCoachAttendanceChoice,renderLessonEditModal};
          renderLessonEditModal();
        `});
        if(process.argv.includes('--draft-back-only')){
          await page.addScriptTag({path:path.join(root,'app/shared/tennisnote-comment-draft.js')});
          const keyword='잘된 점: 포핸드 방향이 좋아졌습니다; 더 연습할 점: 백핸드 준비가 늦었습니다; 개인 연습 중점: 스플릿스텝 타이밍 확인';
          await page.locator('.lesson-ai-draft > summary').click();
          await page.locator('[data-modal-comment-keywords]').fill(keyword);
          await page.locator('[data-generate-modal-comment]').click();
          const comment=await page.locator('[data-modal-coach-comment]').inputValue();
          assert(comment.includes('포핸드 방향이 좋아졌습니다')&&comment.includes('백핸드 준비가 늦었습니다')&&comment.includes('스플릿스텝 타이밍 확인'));
          assert.equal(await page.locator('[data-modal-coach-comment]').getAttribute('data-feedback-draft-incomplete'),'false');
          assert.equal(await page.evaluate(()=>calls.length),0);
          if(process.env.TENNISNOTE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.TENNISNOTE_SCREENSHOT_DIR,`feedback-${engineName}-${width}x${height}-${theme}.png`),fullPage:true});
          await page.locator('[data-modal-coach-comment]').fill('합성 수동 수정 문장을 그대로 유지합니다.');
          page.once('dialog',d=>d.dismiss());await page.locator('[data-generate-modal-comment]').click();
          assert.equal(await page.locator('[data-modal-coach-comment]').inputValue(),'합성 수동 수정 문장을 그대로 유지합니다.');
          await page.locator('[data-lesson-detail-tab="processing"]').click();
          await page.locator('[data-select-lesson-action="attendance"]').click();
          await page.waitForFunction(()=>test.lesson.attendanceChoice?.contractReady===true);
          await page.locator('#coachAttendanceReason').fill('합성 보존 사유');
          await page.locator('[data-back-lesson-actions]').click();
          assert.equal(await page.locator('[data-select-lesson-action="attendance"]').count(),1);
          await page.locator('[data-select-lesson-action="attendance"]').click();
          assert.equal(await page.locator('#coachAttendanceReason').inputValue(),'합성 보존 사유');
          await page.locator('[data-lesson-detail-tab="feedback"]').click();
          assert.equal(await page.locator('[data-modal-coach-comment]').inputValue(),'합성 수동 수정 문장을 그대로 유지합니다.');
          assert.equal(await page.locator('[data-modal-comment-keywords]').inputValue(),keyword);
          assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice').length),0);
          assert.deepEqual(errors,[]);cases++;await page.close();continue;
        }
        await page.locator('[data-modal-coach-comment]').fill("합성 초안 보존 시험입니다.");
        await page.locator('[data-modal-comment-keywords]').evaluate(n=>n.value="잘된 점: 합성 입력");
        await page.locator('[data-lesson-detail-tab="processing"]').click();
        assert.equal(await page.locator('[data-lesson-tab-panel="feedback"]').evaluate(n=>n.hidden&&n.disabled),true);
        assert.equal(await page.evaluate(()=>calls.length),0);
        await page.locator('[data-select-lesson-action="attendance"]').click();
        await page.waitForFunction(()=>test.lesson.attendanceChoice?.contractReady===true);
        assert.equal(await page.evaluate(()=>test.lesson.attendanceChoice.outcome),undefined,"capability probe selected outcome");
        assert.equal(await page.evaluate(()=>test.lesson.attendanceChoice.deduct),undefined,"capability probe selected deduction");
        assert.equal(await page.locator('[data-process-attendance]').isDisabled(),true);
        for(const outcome of ["absence","no_show"])for(const deduct of ["true","false"]){
          await page.locator(`[data-attendance-choice="outcome"][data-choice-value="${outcome}"]`).click();
          await page.locator(`[data-attendance-choice="deduct"][data-choice-value="${deduct}"]`).click();
          await page.waitForFunction(()=>test.lesson.attendanceChoice?.loading===false);
          assert.equal(await page.locator('[data-process-attendance]').isDisabled(),false);
          assert((await page.locator('[data-lesson-action-result]').innerText()).includes(deduct==="true"?"잔여 4회 → 2회":"잔여 4회 → 4회"));
        }
        await page.locator('[data-attendance-choice="outcome"][data-choice-value="absence"]').click();
        assert.equal(await page.evaluate(()=>test.lesson.attendanceChoice.deduct),false,"outcome flipped deduction");
        await page.locator('#coachAttendanceReason').fill("합성 사유");
        await page.locator('[data-lesson-detail-tab="feedback"]').click();
        assert.equal(await page.locator('[data-modal-coach-comment]').inputValue(),"합성 초안 보존 시험입니다.");
        assert.equal(await page.locator('[data-modal-comment-keywords]').inputValue(),"잘된 점: 합성 입력");
        assert.equal(await page.locator('[data-lesson-tab-panel="processing"]').evaluate(n=>n.hidden&&n.disabled),true);
        await page.locator('[data-lesson-detail-tab="processing"]').click();
        assert.equal(await page.locator('#coachAttendanceReason').inputValue(),"합성 사유");
        const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('[data-lesson-detail-tab],[data-attendance-choice],[data-process-attendance]')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height),font:parseFloat(getComputedStyle(document.querySelector('#coachAttendanceReason')).fontSize),invalid:document.querySelectorAll('fieldset[hidden] :invalid').length,primary:[...document.querySelectorAll('.approve-button')].filter(n=>n.getClientRects().length).length}));
        assert.equal(geometry.overflow,false,`${engineName} ${width} overflow`);assert(geometry.targets.every(h=>h>=44));assert(geometry.font>=16);assert.equal(geometry.primary,1);assert.equal(geometry.invalid,0);
        if(process.env.TENNISNOTE_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.TENNISNOTE_SCREENSHOT_DIR,`attendance-${engineName}-${width}x${height}-${theme}.png`),fullPage:true});
        // 네 조합은 실제 공개 delegated 클릭에서 같은 권위 RPC로만 전달한다.
        for (const outcome of ["absence", "no_show"]) for (const deduct of ["true", "false"]) {
          await page.locator(`[data-attendance-choice="outcome"][data-choice-value="${outcome}"]`).click();
          await page.locator(`[data-attendance-choice="deduct"][data-choice-value="${deduct}"]`).click();
          await page.locator('#coachAttendanceReason').fill("합성 사유");
          const count = await page.evaluate(()=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice').length);
          const closed = await page.evaluate(()=>window.closedCount);
          await page.locator('[data-process-attendance]').click();
          await page.waitForFunction(n=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice').length===n+1,count);
          // 성공은 모달 종료와 서버 재조회다. 폐기된 lesson 객체의 잠금 해제를 기다리지 않는다.
          await page.waitForFunction(n=>window.closedCount===n+1&&window.syncedCount===n+1,closed);
          const call = await page.evaluate(()=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice').at(-1));
          assert.equal(call.args.target_outcome,outcome);assert.equal(call.args.target_deduct,deduct==='true');
          // 다음 조합은 독립된 합성 요청이다. 이미 처리된 서버 수업을 재처리하는 fixture가 아니다.
          await page.evaluate(()=>{lesson={...lesson,attendanceInFlight:false,attendanceOperation:null};test.lesson=lesson;test.renderLessonEditModal();});
        }
        await page.locator('[data-attendance-choice="outcome"][data-choice-value="absence"]').click();
        await page.locator('[data-attendance-choice="deduct"][data-choice-value="false"]').click();
        await page.evaluate(()=>calls=[]);
        // Response loss preserves exact operation key; two concurrent UI requests only call once.
        await page.evaluate(async()=>{window.failSave=true;await Promise.all([test.processCoachAttendance(test.lesson.id,'absence',false),test.processCoachAttendance(test.lesson.id,'absence',false)]);});
        const first=await page.evaluate(()=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice'));
        assert.equal(first.length,1);assert.equal(await page.locator('#coachAttendanceReason').inputValue(),"합성 사유");
        await page.evaluate(async()=>{window.failSave=false;await test.processCoachAttendance(test.lesson.id,'absence',false);});
        const second=await page.evaluate(()=>calls.filter(c=>c.name==='tn_apply_coach_attendance_choice'));
        assert.equal(second.length,2);assert.equal(first[0].args.target_operation_key,second[1].args.target_operation_key);
        await page.evaluate(()=>{test.lesson.attendanceInFlight=false;window.failPreview=true;});
        await page.evaluate(()=>test.selectCoachAttendanceChoice(test.lesson.id,'deduct','true'));
        assert.equal(await page.locator('[data-process-attendance]').isDisabled(),true,"missing server contract must block");
        assert.equal(await page.locator('[data-attendance-choice]:enabled').count(),0,"old server must not expose selectable choices");
        await page.evaluate(()=>{window.failPreview=false;window.mismatch=true;});
        await page.evaluate(()=>test.selectCoachAttendanceChoice(test.lesson.id,'contract'));
        assert.equal(await page.locator('[data-process-attendance]').isDisabled(),true,"exact mismatch must block");
        assert.deepEqual(errors,[]);
        cases++;await page.close();
      }
    }finally{await browser.close();}
  }
  console.log(process.argv.includes('--draft-back-only')?`FEEDBACK_BACK_BROWSER_PASS=${cases}; actual modules/delegation/sectioned generator/confirm cancel/input preserve/write0`:`ATTENDANCE_CHOICE_BROWSER_PASS=${cases}; actual renderer/handler; tabs/4 choices/draft/44px/16px/RPC/response-loss`);
})().catch(e=>{console.error(e);process.exit(1)});
