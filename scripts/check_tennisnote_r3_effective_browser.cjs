/* 실제 public index/module 실행. 합성 transport만 허용, hosted/Auth/write 0. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {root} = require("../tests/helpers/r3-effective-port.cjs");
const {chromium,webkit} = require("playwright");
const base="http://127.0.0.1:8773";
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
function fixtureConfig(coach) {
  return `window.TennisNoteConfig={}; window.__r3Rpc=[];
  const fixtureClient={readiness:()=>({ready:${coach}}),getSession:()=>(${coach}?{access_token:"synthetic-only"}:null),ensureSession:async()=>({access_token:"synthetic-only"}),consumeOAuthRedirect:async()=>{},isOnline:()=>false,
    selectCurrentProfile:async()=>({user:{id:"synthetic-auth"},profile:{id:"synthetic-profile",name:"합성 코치",role:"coach",status:"active"},coachRole:{id:"synthetic-role",branch_id:"synthetic-branch",status:"approved"}}),
    selectRows:async()=>[],rpc:async(name,args)=>{window.__r3Rpc.push({name,args}); if(name==="tn_coach_settlement_scope_v2")return window.__r3Payload(args);if(name==="tn_coach_monthly_settlement_reconciliation_state")return window.__r3History(args);if(name==="tn_admin_monthly_settlement_scope_state")return window.__r3AdminHistory(args);return []},
    invokeFunction:async()=>{throw Error("fixture write forbidden")}};
  window.__r3Payload=args=>({ok:true,calculationVersion:"r3_effective_settlement_v2",scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},sourceFingerprint:"a".repeat(64),confirmationReady:false,
    totals:{totalSettlementAmount:50,revenueAmount:100,settledSessions:1,settledMinutes:40,paymentCount:1},sourceManifest:{tickets:[{id:"synthetic-ticket",userId:"synthetic-user"}]},
    lines:[{sourceTicketId:"synthetic-ticket",sourcePaymentId:"synthetic-payment",settlementAmount:50,settledSessions:1,settledMinutes:40,totalSessions:5,netAmount:100,calculationComponents:[]}]});
  Object.defineProperty(window,"TennisNoteDataClient",{get:()=>fixtureClient,set:()=>{},configurable:true});`;
}
async function runFixture(page,surface){
  return page.evaluate(async surface=>{
    let checks=0;const check=(value,reason)=>{if(!value)throw Error(reason);checks++};
    if(surface==="admin"){
      window.activeOperationBranchId=()=>"synthetic-branch";
      window.operationBranchCoaches=()=>[{name:'합성 코치 <img src=x onerror="throw 1">',branchId:"synthetic-branch",serverRoleId:"synthetic-role"}];
      window.adminApprovalReady=()=>true;
      window.isAdminViewLocked=()=>false;
      window.isAdminUnlocked=()=>false;
      window.adminPinNeedsSetup=()=>false;
      adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};
      window.TennisNoteDataClient.getSession=()=>({access_token:"synthetic-only"});
      window.__r3AdminHistory=args=>({ok:true,state:"CONFIRMED",scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_monthly_settlement_v1",sourceFingerprint:"b".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
      state.view="billing";state.billingMonth="2099-01";state.settlementPage=0;
      // 합성 transport 권한은 실제 로그인 증거가 아니다. 실제 shell만 fixture에서 연다.
      document.querySelector("#operationsLoginGate").hidden=true;
      document.querySelector("#adminAppShell").hidden=false;
      document.querySelector("#adminBrandSplash").hidden=true;
      tickets.splice(0,tickets.length,{id:"synthetic-ticket",serverTicketId:"synthetic-ticket",member:"합성 회원 <script>throw 1</script>"});expiredTickets.splice(0);adminLiveDataState.settlementTickets=[];
      document.querySelectorAll(".view").forEach(el=>{el.classList.toggle("is-active",el.id==="billingView")});
      document.querySelector("#billingView").hidden=false;
      document.querySelector("#coachSettlementSummary").closest("details").open=true;
      const signature=effectiveSettlementPreviewSignature();
      const original=window.refreshEffectiveSettlementPreview;let entries=0;
      window.refreshEffectiveSettlementPreview=(...args)=>{entries++;return original(...args)};
      renderCoachSettlementPreview();
      await new Promise(resolve=>setTimeout(resolve,0));
      check(entries===1,"actual admin view enters data module");
      check(effectiveSettlementPreview.results[0].value.estimatedSettlement===50,"admin exact server amount");
      check(effectiveSettlementPreview.results[0].value.settledMinutes===40,"group logical time 40 not 80");
      check(document.querySelector("#coachSettlementSummary").textContent.includes("미리보기"),"gate OFF not confirmed");
      check(!document.querySelector("#coachSettlementSummary img"),"coach XSS escaped");
      check(!document.querySelector("#coachSettlementPreviewRows script"),"member XSS escaped");
      check(billingSettlementApprovalMarkup({status:"paid",ticketId:"synthetic-ticket"}).includes("월 정산"),"linked payment row no independent amount formula");
      check(billingSettlementApprovalMarkup({status:"paid"}).includes("회원권 연결 후 계산"),"unlinked payment repair HOLD preserved");
      const client=window.TennisNoteDataClient,old=client.rpc;client.rpc=async()=>{throw Error("settlement_hold_refund")};
      await refreshEffectiveSettlementPreview(signature);
      check(document.querySelector("#coachSettlementSummary").textContent.includes("확인 필요"),"admin HOLD not zero");
      client.rpc=old;await refreshEffectiveSettlementPreview(signature);
      const select=document.querySelector("#adminSettlementHistoryCoach"),button=document.querySelector("#adminSettlementHistoryRead"),details=document.querySelector("#adminSettlementHistoryDetails");
      select.value="synthetic-role";select.dispatchEvent(new Event("change",{bubbles:true}));
      check(!button.disabled,"actual binding selects exact role");
      const before=window.__r3Rpc.filter(row=>row.name==="tn_admin_monthly_settlement_scope_state").length;
      button.click();button.click();await new Promise(resolve=>setTimeout(resolve,0));
      check(window.__r3Rpc.filter(row=>row.name==="tn_admin_monthly_settlement_scope_state").length===before+1,"one read through actual button/listener; duplicate zero");
      check(details.textContent.includes("37원")&&details.textContent.includes("기존 v1"),"admin immutable history same as coach fixture");
      check(effectiveSettlementPreview.results[0].value.estimatedSettlement===50,"confirmed history never overwrites estimate");
      const adminHistory=window.__r3AdminHistory;
      window.__r3AdminHistory=args=>({...adminHistory(args),reconciliation:{reconciliationId:"synthetic-response",status:"DISPUTED",reason:"적용기간 확인 요청 ".repeat(12).trim(),responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}});
      check(await refreshAdminSettlementHistory(),"prior coach dispute readback");
      check(details.textContent.includes("이의 접수")&&!details.querySelector("img,script"),"read-only reason safe DOM");
      window.isAdminViewLocked=()=>true;renderAdminSettlementHistory();
      check(button.disabled&&details.hidden&&details.childElementCount===0,"PIN lock erases history and disables read");
      window.isAdminViewLocked=()=>false;renderAdminSettlementHistory();
      check(await refreshAdminSettlementHistory(),"synthetic unlock recovery");
    }else{
      check(Boolean(window.__TENNIS_NOTE_COACH_APP_RUNTIME__),"actual coach entry boot");
      window.__r3History=args=>({scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},state:"PENDING",
        snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_monthly_settlement_v1",sourceFingerprint:"b".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},
        confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
      check(state.coach?.coachRoleId==="synthetic-role"&&state.coach?.branchId==="synthetic-branch","approved fixture exact role branch boot");
      state.settlementMonth="2099-01";selectCoachSettlementMonth("2099-01");
      check(await syncCoachSettlementFromServer(),"actual coach data RPC success");
      check(state.coachSettlement.estimatedSettlement===50,"coach parity with admin amount");
      check(state.coachSettlement.settledMinutes===40,"coach exact minutes");
      check(coachSettlementRowsForMember({name:"회원권별 계산 근거"}).length===0,"no name fallback");
      check(coachSettlementRowsForMember({serverUserId:"synthetic-user"}).length===1,"exact own member");
      openCoachSettlement();
      check(await syncCoachSettlementHistoryFromServer(),"open enters actual history read module");
      const summary=document.querySelector("#coachSettlementReconciliationSummary");
      check(summary.textContent.includes("37원")&&summary.textContent.includes("기존 v1"),"v1 confirmed amount separate from current preview");
      check(state.coachSettlement.estimatedSettlement===50,"history never overwrites current preview");
      check(!document.querySelector("#coachSettlementReconciliationForm, #coachSettlementReconciliationSubmit"),"response/confirmation write controls absent");
      const history=window.__r3History;
      window.__r3History=args=>({...history(args),state:"DISPUTED",reconciliation:{reconciliationId:"synthetic-response",status:"DISPUTED",reason:"적용기간 확인 요청 ".repeat(12).trim(),responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}});
      check(await syncCoachSettlementHistoryFromServer(),"prior dispute read only");
      check(summary.textContent.includes("적용기간 확인 요청")&&!summary.querySelector("img,script"),"prior reason textContent safe");
      window.__r3History=args=>({...history(args),scope:{branchId:"other",coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month}});
      check(await syncCoachSettlementHistoryFromServer()===false&&summary.hidden,"scope mismatch hides old history");
      window.__r3History=args=>({scope:history(args).scope,state:"EMPTY",snapshot:null,confirmation:null,reconciliation:null});
      check(await syncCoachSettlementHistoryFromServer()&&summary.hidden,"empty history not fabricated zero");
      check(document.querySelector("#coachSettlementReconciliationMessage").textContent.includes("없습니다"),"empty distinct from preview");
      window.__r3History=history;
      check(await syncCoachSettlementHistoryFromServer(),"synthetic recovery only after diagnosed payload mismatch");
      const client=window.TennisNoteDataClient,old=client.rpc;client.rpc=async()=>{throw Error("settlement_hold_refund")};
      check(await syncCoachSettlementFromServer()===false,"HOLD fail closed");
      check(document.querySelector("#coachEstimatedSettlement").textContent==="—","coach HOLD not zero");
      check(document.querySelector("#coachSettlementRows").textContent.includes("계산 근거"),"coach visible retry/error");
      client.rpc=old;check(await syncCoachSettlementFromServer(),"diagnosed synthetic recovery once");
      check(document.querySelector("#coachSettlementRule").textContent.includes("미리보기"),"coach confirmation OFF");
    }
    const scopeCalls=window.__r3Rpc.filter(row=>row.name==="tn_coach_settlement_scope_v2");
    check(scopeCalls.length>0&&scopeCalls.every(row=>row.args.target_branch_id==="synthetic-branch"&&row.args.target_coach_role_id==="synthetic-role"),"actual entry spy exact scope RPC");
    check(!window.__r3Rpc.some(row=>/confirm|respond|payout|payment|refund|save|create|update/.test(row.name)),"write RPC zero");
    return {checks,previewCalls:scopeCalls.length,hostedWrites:0};
  },surface);
}
(async()=>{
  const deadline=setTimeout(()=>{console.error("R3 browser deadline");process.exit(124)},180000);deadline.unref();
  let layouts=0,checks=0;const widths=[[320,740],[360,800],[375,812],[390,844],[393,852],[402,874],[412,915],[430,932],[768,1024],[1366,900],[667,375],[844,390],[932,430]];
  try{
    for(const [engine,type] of Object.entries({chromium,webkit})){
      const browser=await type.launch({headless:true});
      try{for(const colorScheme of ["light","dark"])for(const surface of (process.env.TENNISNOTE_R3_HISTORY_LAYOUT_ONLY === "1" ? ["coach"] : ["admin","coach"])){
        const context=await browser.newContext({viewport:{width:390,height:844},colorScheme,serviceWorkers:"block"});
        let external=0;await context.route("**/*",route=>{
          const url=new URL(route.request().url());if(url.origin!==base){external++;return route.abort()}
          if(url.pathname.endsWith("config.local.js"))return route.fulfill({contentType:"text/javascript",body:fixtureConfig(surface==="coach")});
          let file=path.resolve(root,"."+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
          if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
          if(!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({contentType:mime[path.extname(file)]||"application/octet-stream",body:fs.readFileSync(file)});
        });
        try{
          const page=await context.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));
          await page.goto(base+`/app/${surface==="admin"?"admin":"tennis-note-coach-app"}/`,{waitUntil:"domcontentloaded"});
          await page.waitForFunction(surface=>surface==="admin"?typeof renderCoachSettlementPreview==="function"&&typeof state==="object":Boolean(window.__TENNIS_NOTE_COACH_APP_RUNTIME__)&&state.coach?.coachRoleId==="synthetic-role",surface);
          const receipt=await runFixture(page,surface);checks+=receipt.checks;
          const target=page.locator(surface==="admin"?"#adminSettlementHistory":"#coachSettlementModal");
          for(const [width,height] of widths){
            await page.setViewportSize({width,height});await target.scrollIntoViewIfNeeded();
            const geometry=await target.evaluate(el=>({visible:!!el.getClientRects().length,width:el.getBoundingClientRect().width,documentOverflow:document.documentElement.scrollWidth-innerWidth}));
            assert(geometry.visible&&geometry.width>100&&geometry.width<=width+1,"actual settlement target visible viewport width");
            assert(geometry.documentOverflow<=1,"page overflow zero");assert.deepEqual(errors,[],"page error zero");
            if(surface==="admin") {
              await page.locator("#adminSettlementHistory").scrollIntoViewIfNeeded();
              const historyGeometry=await page.locator("#adminSettlementHistory").evaluate(el=>{
                const bounds=el.getBoundingClientRect();
                const visible=Array.from(el.querySelectorAll("*")).map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
                // WebKit native select의 익명 popup은 부모 scrollWidth에 포함될 수 있습니다.
                // 가시 DOM 경계·본문 scroll·문서 overflow를 모두 검사하고 원시 값도 남깁니다.
                return {overflow:Math.max(0,...visible.map(rect=>Math.max(rect.right-bounds.right,bounds.left-rect.left))),
                  textOverflow:Math.max(0,...Array.from(el.querySelectorAll("p,dl,dd")).map(node=>node.scrollWidth-node.clientWidth)),
                  nativeControlScrollOverflow:el.querySelector(".admin-settlement-history-controls").scrollWidth-el.querySelector(".admin-settlement-history-controls").clientWidth,
                  font:parseFloat(getComputedStyle(el.querySelector("select")).fontSize),touch:el.querySelector("button").getBoundingClientRect().height,visible:!!el.querySelector("dl").getClientRects().length};
              });
              assert(historyGeometry.visible&&historyGeometry.overflow<=1&&historyGeometry.textOverflow<=1,"admin history visible/no overflow "+JSON.stringify({engine,colorScheme,width,height,...historyGeometry}));
              if(historyGeometry.nativeControlScrollOverflow>1) console.log(JSON.stringify({diagnostic:"native-select-intrinsic-scroll",engine,colorScheme,width,height,...historyGeometry}));
              assert(historyGeometry.font>=16&&historyGeometry.touch>=44,"admin history focus/touch contract");checks+=2;
            }
            if(surface==="coach") {
              await page.locator("#coachSettlementReconciliationSummary").scrollIntoViewIfNeeded();
              const historyGeometry=await page.locator("#coachSettlementReconciliationSummary").evaluate(el=>{
                const r=el.getBoundingClientRect(),p=el.closest(".coach-settlement-modal-card"),pr=p.getBoundingClientRect();
                return {visible:!el.hidden&&!!el.getClientRects().length,overflow:el.scrollWidth-el.clientWidth,
                  reachable:r.bottom<=pr.bottom+1&&r.bottom<=innerHeight+1,closeHeight:document.querySelector("button[data-close-coach-settlement]").getBoundingClientRect().height,
                  monthFont:parseFloat(getComputedStyle(document.querySelector("#coachSettlementMonth")).fontSize)};
              });
              assert(historyGeometry.visible&&historyGeometry.reachable,"confirmed summary reachable by sheet scroll to end");
              assert(historyGeometry.overflow<=1,"confirmed history horizontal overflow zero");
              assert(historyGeometry.closeHeight>=44&&historyGeometry.monthFont>=16,"existing close touch and month focus contract "+JSON.stringify({engine,colorScheme,width,height,...historyGeometry}));
              checks+=3;
            }
            if(process.env.TENNISNOTE_R3_SCREENSHOT_DIR&&engine==="chromium"&&[390,768,1366].includes(width)){
              fs.mkdirSync(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,{recursive:true});await target.screenshot({path:path.join(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,`${surface}-${width}-${colorScheme}.png`)});
            }
            layouts++;checks+=3;
          }
          console.log(JSON.stringify({result:"PASS",engine,colorScheme,surface,...receipt,layouts:widths.length,externalBlocked:external,hostedRequests:0,pageErrors:errors.length}));
        }finally{await context.close()}
      }}finally{await browser.close()}
    }
    assert.equal(layouts,process.env.TENNISNOTE_R3_HISTORY_LAYOUT_ONLY === "1"?52:104);console.log(JSON.stringify({result:"PASS",layouts,checks,actualRoles:"synthetic only",actualDevices:"NOT VERIFIED",themeEvidence:"OS light/dark preference; existing coach light palette unchanged",hostedRequests:0,hostedWrites:0}));
  }finally{clearTimeout(deadline)}
})().catch(error=>{console.error("R3 browser FAIL",error.message);process.exitCode=1});
