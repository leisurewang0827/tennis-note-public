"use strict";
// 선별 R3의 실제 HTML/CSS/모듈과 합성 RPC만 사용한다. 전체 앱 부팅·실로그인 증거가 아니다.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const root=path.resolve(__dirname,".."),origin="http://127.0.0.1:8773";
const out=path.resolve(process.argv[2]||path.join(root,".local-r3-selected-browser"));
const remainingAfterMonthFixture=process.argv.includes("--remaining-after-coach-month-fixture");
const captureOnly768=process.argv.includes("--capture-only-768");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const snapshot={snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_effective_settlement_v2",scope,sourceFingerprint:"a".repeat(64),totals:{paymentCount:0,ticketCount:2,lessonCount:1,sessionCount:2,settledSessions:1,settledMinutes:20,totalSettlementAmount:14400}};
let layouts=0,checks=0,hosted=0,blockedAssets=0;const evidence=[];
function check(ok,label){assert(ok,label);checks++;}
async function mount(page,kind){
  await page.route("**/*",async route=>{
    const u=new URL(route.request().url());
    if(u.origin!==origin){if(/supabase|portone/i.test(u.hostname))hosted++;else blockedAssets++;return route.abort();}
    const file=path.resolve(root,"."+decodeURIComponent(u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:""});
    const ext=path.extname(file);let body=fs.readFileSync(file);
    if(ext===".html")body=body.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*href=["']https?:[^>]*>/gi,"");
    return route.fulfill({body,contentType:ext===".html"?"text/html":ext===".css"?"text/css":ext===".js"?"text/javascript":"application/octet-stream"});
  });
  await page.goto(`${origin}/app/${kind==="admin"?"admin":"tennis-note-coach-app"}/index.html`);
  await page.evaluate(({kind,scope,snapshot})=>{
    window.__r3Scope=scope;window.__r3Snapshot=snapshot;window.__r3Calls=[];
    const target=document.querySelector(kind==="admin"?"#adminSettlementHistory":"#coachSettlementModal");
    const retained=kind==="coach"?[document.querySelector("#coachLogoutButton"),document.querySelector("#refreshButton")].filter(Boolean):[];
    document.body.replaceChildren(target,...retained);for(const button of retained)button.hidden=true;
    target.hidden=false;if(kind==="coach")document.body.classList.add("modal-open");
    window.fetch=()=>{throw Error("fixture network forbidden");};
  },{kind,scope,snapshot});
  if(kind==="admin"){
    await page.addScriptTag({content:`
      var state={},money=new Intl.NumberFormat("ko-KR"),adminDemoMode=false;
      var adminImportAuthState={profile:{id:"synthetic-profile"},user:{id:"synthetic-auth"}};
      var $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
      var __role="admin",__approved=true,__confirmed=false,__manual=false,__keys=0;
      function operationsRole(){return __role;}function adminApprovalReady(){return __approved;}
      function operationsAccessReady(){return true;}function adminPinNeedsSetup(){return false;}
      function isAdminViewLocked(){return false;}function isAdminUnlocked(){return true;}
      function activeOperationBranchId(){return __r3Scope.branchId;}
      function adminSettlementHistoryScope(){return __r3Scope;}
      function adminSettlementHistoryScopeKey(s=__r3Scope){return [s.branchId,s.coachRoleId,s.settlementMonth].join(":");}
      function adminSettlementHistoryCoaches(){return [{serverRoleId:__r3Scope.coachRoleId,name:"합성 검수"}];}
      function adminLocalDateKey(){return "2099-01-02";}function createAdminOperationKey(p){return p+":synthetic:"+(++__keys);}
      function __scopeValue(){return {state:__confirmed?"CONFIRMED":"EMPTY",scope:__r3Scope,snapshot:__confirmed?__r3Snapshot:null,confirmation:__confirmed?{status:"confirmed",confirmedAt:"2099-01-01T00:00:00Z"}:null,reconciliation:{status:"acknowledged"}};}
      window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session-marker"}),rpc:async(name,args)=>{
        __r3Calls.push(name);
        if(name==="tn_admin_preview_monthly_settlement_snapshot")return __r3Snapshot;
        if(name==="tn_admin_monthly_settlement_scope_state")return __scopeValue();
        if(name==="tn_admin_create_monthly_settlement_snapshot")return __r3Snapshot;
        if(name==="tn_admin_confirm_monthly_settlement_snapshot"){__confirmed=true;return __scopeValue();}
        if(name==="tn_monthly_settlement_payout_state")return {scope:__r3Scope,snapshot:__r3Snapshot,payout:{recordingEnabled:__manual,activeRecord:null,events:[]}};
        throw Error("unexpected synthetic RPC");
      }};
    `});
    for(const p of ["app/admin/data/billing.js","app/admin/actions/billing.js","app/admin/views/billing.js","app/admin/events/billing.js"])await page.addScriptTag({content:read(p)});
    await page.evaluate(()=>{bindBillingEvents();renderAdminSettlementHistory();});
  }else{
    await page.addScriptTag({content:`
      var state={dataMode:"live",liveProfileId:"synthetic-profile",coach:{role:"coach",authUserId:"synthetic-auth",branchId:__r3Scope.branchId,coachRoleId:__r3Scope.coachRoleId}};
      var $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
      function formatCoachWon(v){return new Intl.NumberFormat("ko-KR").format(v)+"원";}
      function saveSnapshot(){}function logoutCoach(){}function renderAll(){}function openUserMode(){}function saveCoachProfile(){}
      function __payload(status="PENDING"){return {scope:__r3Scope,state:status,snapshot:__r3Snapshot,confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:status==="PENDING"?null:{reconciliationId:"synthetic-response",status:"acknowledged",reason:"",responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}};}
      var __saved=__payload();window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session-marker"}),rpc:async(name,args)=>{
        __r3Calls.push(name);
        if(name==="tn_coach_respond_monthly_settlement_confirmation"){__saved=__payload("ACKNOWLEDGED");return __saved;}
        if(name==="tn_coach_monthly_settlement_reconciliation_state")return __saved;
        throw Error("unexpected synthetic RPC");
      }};
    `});
    await page.addScriptTag({content:read("app/tennis-note-coach-app/domain/settlement.js")});
    await page.evaluate(()=>{
      selectCoachSettlementMonth("2099-01");
      document.querySelector("#coachSettlementMonth").value=coachSettlementMonth();
      if(coachSettlementReconciliationScope().settlementMonth!==__r3Scope.settlementMonth)throw Error("synthetic month selection mismatch");
    });
    const data=read("app/tennis-note-coach-app/data/sync.js");await page.addScriptTag({content:data.slice(data.indexOf("const coachSettlementHistory ="))});
    for(const p of ["app/tennis-note-coach-app/views/settlement.js","app/tennis-note-coach-app/events/account.js"])await page.addScriptTag({content:read(p)});
    await page.evaluate(()=>{Object.assign(coachSettlementHistory,{coachSettlementReconciliation:__payload(),coachSettlementReconciliationUiState:"PENDING"});bindAccountEvents();renderCoachSettlementHistory();});
  }
}
async function layout(page,kind,state){
  return page.evaluate(({kind,state})=>{
    if(kind==="admin"){
      __approved=state!=="PIN";__manual=state==="MANUAL";__confirmed=true;
      Object.assign(adminMonthlySettlementWrite,{status:state==="ERROR"?"ERROR":"CONFIRMED",loading:state==="LOADING",scopeState:__scopeValue(),payoutReadValid:true,payoutState:{scope:__r3Scope,snapshot:__r3Snapshot,payout:{recordingEnabled:__manual,activeRecord:null,events:[]}}});
      renderAdminSettlementHistory();document.querySelector("#adminR3PayoutDetails").open=true;
    }else{
      const phase=state==="ERROR"?"ERROR":"PENDING";Object.assign(coachSettlementHistory,{coachSettlementReconciliation:__payload(),coachSettlementReconciliationUiState:phase,coachSettlementReconciliationLoading:state==="LOADING",coachSettlementReconciliationChoice:state==="DISPUTED"?"disputed":"acknowledged",coachSettlementReconciliationReason:"합성 검수"});renderCoachSettlementHistory();
    }
    const section=document.querySelector(kind==="admin"?"#adminSettlementHistory":"#coachSettlementModal .modal-card");
    const ids=kind==="admin"?["adminR3SettlementPreview","adminR3PayoutRecord","adminR3PayoutReverse"]:["coachSettlementReconciliationSubmit"];
    const targets=ids.map(id=>document.getElementById(id)).filter(el=>el&&el.getClientRects().length).map(el=>({id:el.id,height:el.getBoundingClientRect().height,disabled:el.disabled}));
    const controls=Array.from(section.querySelectorAll("input,select,textarea")).filter(el=>el.getClientRects().length&&!el.disabled&&el.type!=="radio").map(el=>({id:el.id,font:parseFloat(getComputedStyle(el).fontSize)}));
    return {overflow:section.scrollWidth-section.clientWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth,targets,controls,recordDisabled:document.querySelector("#adminR3PayoutRecord")?.disabled,responseDisabled:document.querySelector("#coachSettlementReconciliationSubmit")?.disabled};
  },{kind,state});
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  if(captureOnly768){
    const browser=await webkit.launch({headless:true});const captures=[];
    try{for(const kind of ["admin","coach"])for(const theme of ["light","dark"]){
      const page=await browser.newPage({viewport:{width:768,height:1024},colorScheme:theme});
      await mount(page,kind);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await layout(page,kind,kind==="admin"?"MANUAL":"PENDING");
      const file=`${kind}-768-${theme}-webkit.png`;
      await page.locator(kind==="admin"?"#adminSettlementHistory":"#coachSettlementModal .modal-card").screenshot({path:path.join(out,file)});
      captures.push({engine:"webkit",kind,width:768,theme,file,rpcCalls:await page.evaluate(()=>__r3Calls.length)});await page.close();
    }}finally{await browser.close();}
    const receipt={contract:"r3-production-selected-capture-only/1",testAssertions:0,hostedRequests:hosted,captures,scope:"synthetic mount and screenshots only; not another test PASS; OS colorScheme does not imply a separate dark palette"};
    fs.writeFileSync(path.join(out,"capture-only-768.json"),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));return;
  }
  for(const engine of ["chromium","webkit"]){
    const launch=engine==="chromium"&&fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{};
    const browser=await ({chromium,webkit}[engine]).launch({headless:true,...launch});
    try{for(const kind of ["admin","coach"])for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1366,height:900},{width:844,height:390}])for(const theme of ["light","dark"]){
      if(remainingAfterMonthFixture&&engine==="chromium"&&kind==="admin")continue;
      const page=await browser.newPage({viewport,colorScheme:theme});const errors=[];page.on("pageerror",e=>errors.push(e.name));
      await mount(page,kind);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      if(viewport.width===390&&theme==="light"){
        if(kind==="admin"){
          await page.locator("#adminR3SettlementPreview").click();await page.waitForFunction(()=>adminMonthlySettlementWrite.status==="READY");
          await page.locator("#adminR3SettlementConfirm").click();await page.waitForFunction(()=>adminMonthlySettlementWrite.status==="CONFIRMED");
          const calls=await page.evaluate(()=>__r3Calls);check(calls.filter(n=>n==="tn_admin_create_monthly_settlement_snapshot").length===1,"actual DOM create once");check(calls.filter(n=>n==="tn_admin_confirm_monthly_settlement_snapshot").length===1,"actual DOM confirm once");
        }else{
          await page.locator('input[value="acknowledged"]').check();await page.locator("#coachSettlementReconciliationSubmit").click();await page.waitForFunction(()=>coachSettlementHistory.coachSettlementReconciliationUiState==="ACKNOWLEDGED");
          const calls=await page.evaluate(()=>__r3Calls);check(calls.filter(n=>n==="tn_coach_respond_monthly_settlement_confirmation").length===1,"actual DOM coach response once");
        }
      }
      for(const variant of kind==="admin"?["MANUAL","OFF","PIN","LOADING","ERROR"]:["PENDING","DISPUTED","LOADING","ERROR"]){
        const result=await layout(page,kind,variant);check(result.overflow<=1,`${engine}/${kind}/${viewport.width}/${theme}/${variant} section overflow`);check(result.documentOverflow<=1,"document overflow");
        for(const item of result.targets)check(item.height>=44,`${engine}/${kind}/${item.id} hit target ${item.height}`);
        for(const item of result.controls)check(item.font>=16,`${engine}/${kind}/${item.id} font ${item.font}`);
        if(kind==="admin"&&variant!=="MANUAL")check(result.recordDisabled,"OFF/PIN/loading/error record disabled");
        if(kind==="coach"&&["LOADING","ERROR"].includes(variant))check(result.responseDisabled,"loading/error response disabled");
      }
      await layout(page,kind,kind==="admin"?"MANUAL":"PENDING");
      if(engine==="chromium"&&[390,1366].includes(viewport.width))await page.locator(kind==="admin"?"#adminSettlementHistory":"#coachSettlementModal .modal-card").screenshot({path:path.join(out,`${kind}-${viewport.width}-${theme}.png`)});
      check(errors.length===0,"page errors zero");layouts++;evidence.push({engine,kind,width:viewport.width,height:viewport.height,theme,pageErrors:errors.length});
      fs.writeFileSync(path.join(out,"progress.json"),JSON.stringify({layouts,checks,evidence},null,2));await page.close();
    }}finally{await browser.close();}
  }
  check(hosted===0,"hosted DB/provider requests zero");const result={contract:"r3-production-selected-local-browser/1",status:"PASS",layouts,checks,hostedRequests:hosted,blockedExternalAssets:blockedAssets,priorNotRepeated:remainingAfterMonthFixture?{layouts:8,scope:"Chromium admin completed before first failed coach/month fixture step; four screenshots preserved; no initial per-layout ledger was written"}:null,scope:"actual focused HTML/CSS/module and delegated event wiring with synthetic RPC; not full app boot, real login, hosted or device evidence",evidence};
  fs.writeFileSync(path.join(out,"result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:undefined}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
