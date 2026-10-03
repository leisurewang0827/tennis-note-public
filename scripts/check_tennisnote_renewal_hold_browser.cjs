/* 실제 index/module 로드. 외부 네트워크·결제는 차단하고 합성 상태만 사용한다. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {root} = require("../tests/helpers/renewal-hold-port.cjs");
const {chromium,webkit} = require("playwright");
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  if(pathname.endsWith("config.local.js")){res.writeHead(200,{"Content-Type":"text/javascript"});res.end("window.TennisNoteConfig = {}; ");return;}
  let file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(file).pipe(res);
});
async function memberFixture(page) {
  return page.evaluate(async()=>{
    let checks=0;const check=(v,why)=>{if(!v)throw Error(why);checks++};
    window.__renewalCalls={prepare:0,provider:0,blocked:0};
    const original=window.purchaseRenewalSourceIssue;
    window.purchaseRenewalSourceIssue=function(...args){window.__renewalCalls.blocked++;return original(...args)};
    window.preloadPortOneSdk=()=>{};
    window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-not-a-credential"}),
      readiness:()=>({ready:false}),invokeFunction:async(name,request)=>{
        if(name!=="portone-payment/prepare")throw Error("unexpected synthetic operation");
        window.__renewalCalls.prepare++;window.__lastPrepare=request.body;return {ok:true};
      }};
    window.TENNIS_NOTE_PAYMENT_CONFIG={enabled:true,mode:"multi",storeId:"synthetic-store",
      channels:{tosspay:"synthetic-channel"}};
    const source=membershipProductFromServer({id:"synthetic-source",product_kind:"regular",total_sessions:5,
      term_weeks:4,frequency_per_week:1,name:"합성 정규권",policy_settings:{importOnly:true}});
    const sale={...source,id:"synthetic-sale",status:"sale",termWeeks:12};
    const ticket={id:"synthetic-ticket",productId:source.id,status:"active",productKind:"regular",weeklyFrequencyStatus:"ticket_exact",coachRoleId:"synthetic-coach",remaining:5,total:5};
    state.dataMode="live";state.liveMembershipProducts=[source,sale];state.liveTickets=[ticket];state.expiredTickets=[];
    state.livePaymentOptions={allowedMethods:["tosspay","bank_transfer"],bankTransferEnabled:true,features:{threeMonth:true}};
    check(isPaymentGatewayReady("tosspay")&&isPaymentGatewayReady("bank_transfer"),"synthetic config passes real readiness");
    check(paymentMethodIdForRequest("bank_transfer")==="bank_transfer","bank request method remains exact");
    state.purchaseFlow={open:true,step:1,purchasePurpose:"renew_same",renewalTicketId:ticket.id,productId:source.id,
      familyId:"four-week",scheduleMode:"keep",coachRoleId:ticket.coachRoleId,preferredSchedules:[]};
    state.selectedPaymentMethod="tosspay";
    const owned=JSON.stringify(state.liveTickets);
    check(purchaseRenewalSourceIssue()?.code==="renewal_source_checkout_unavailable","hidden source guard");
    selectPurchasePurpose("renew_same");
    check(state.purchaseFlow.renewalTicketId===ticket.id&&!state.purchaseFlow.productId,"exact source/no substitute");
    check(!purchaseStepCanContinue(),"disabled checkout");
    let error="";try{await prepareServerPayment(sale,"synthetic-payment")}catch(e){error=e.message}
    check(error==="renewal_source_checkout_unavailable"&&window.__renewalCalls.prepare===0,"blocked prepare zero");
    check(JSON.stringify(state.liveTickets)===owned,"owned ticket unchanged");
    const hold=paymentServerErrorMessage({payload:{code:"renewal_source_checkout_unavailable",paymentStatus:"verified",entitlementStatus:"hold"}});
    check(hold.includes("다시 결제하지 말고"),"verified HOLD no repurchase");
    for(const id of ["","missing"]){state.purchaseFlow.renewalTicketId=id;check(purchaseRenewalSourceIssue()?.code==="exact_renewal_source_ticket_required","no first ticket fallback")}
    state.purchaseFlow.renewalTicketId=ticket.id;
    source.status="sale";state.purchaseFlow.productId=sale.id;
    check(!purchaseRenewalPaymentIssue(sale),"explicit term conversion remains allowed");
    await prepareServerPayment(sale,"synthetic-payment","bank_transfer");
    check(window.__lastPrepare.renewalSourceTicketId===ticket.id&&window.__lastPrepare.productKey===sale.id&&window.__lastPrepare.method==="bank_transfer","exact bank conversion payload");
    source.status="hidden";blockPurchaseRenewal(purchaseRenewalSourceIssue());
    document.querySelector("#appScreen").hidden=false;
    document.querySelector("#loginScreen")?.setAttribute("hidden","");
    setView("shopView");renderMembershipPurchaseFlow();
    check(window.__renewalCalls.blocked>4,"actual modular guard spy");
    return {checks,prepareFixtureCalls:window.__renewalCalls.prepare,providerCalls:window.__renewalCalls.provider};
  });
}
async function adminFixture(page) {
  return page.evaluate(async()=>{
    let checks=0;const check=(v,why)=>{if(!v)throw Error(why);checks++};
    const branch="synthetic-branch";
    window.activeOperationBranchId=()=>branch;
    let calls=0;
    window.TennisNoteDataClient={rpc:async(name,args)=>{
      check(name==="tn_admin_payment_hold_reasons","exact read RPC");calls++;
      check(args.target_payment_ids.length===1&&args.target_payment_ids[0]==="synthetic-held","exact batch");
      return [{payment_id:"synthetic-held",reason_code:"renewal_source_checkout_unavailable",failed_at:"2099-01-01T00:00:00Z"}];
    },readiness:()=>({ready:false})};
    const rows=await loadAdminPaymentHoldReasons([{id:"synthetic-held",branch_id:branch,status:"verified",method:"card",member:"합성 회원",item:"합성 회원권"}]);
    const item=billingRowFromServerPayment(rows[0]);
    check(chargeStatusForPayment(item).label==="회원권 적용 보류","HOLD projection");
    billings.splice(0,billings.length,item);
    document.querySelectorAll(".view").forEach(el=>el.classList.toggle("is-active",el.id==="billingView"));
    document.querySelector("#billingView").hidden=false;
    renderPaymentChargeAudit();
    check(document.querySelector("#paymentChargeAudit").textContent.includes("회원권 적용 보류"),"actual card renderer");
    check(calls===1,"projection once");
    return {checks,readRpcFixtureCalls:calls,writes:0};
  });
}
(async()=>{
  const startedAt=performance.now();
  // 실패·종료 지연도 PR 전체 제한을 소비하지 않도록 성공 생략 없이 차단한다.
  const deadline=setTimeout(()=>{console.error("FAIL renewal-hold browser deadline 120000ms");process.exit(124);},120000);
  deadline.unref();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${server.address().port}`;let combinations=0;
  try{
    for(const [engine,type] of Object.entries({chromium,webkit})){
      const browser=await type.launch({headless:true});
      try{for(const [width,height] of [[390,844],[844,390]])for(const colorScheme of ["light","dark"]){
        const context=await browser.newContext({viewport:{width,height},colorScheme,serviceWorkers:"block"});
        await context.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        try{for(const app of ["tennis-note-member-app","admin"]){
          const page=await context.newPage();const errors=[];
          page.on("pageerror",e=>errors.push(e.message));
          // 코치 surface 선행 로드는 networkidle과 무관하다. 실제 앱 상태/함수 준비를 확인한다.
          await page.goto(`${base}/app/${app}/?${app==="admin"?"demoAdmin=1":"curriculumPreview=1"}`,{waitUntil:"domcontentloaded"});
          await page.waitForFunction(name=>typeof window[name]==="function"&&typeof state==="object",app==="admin"?"loadAdminPaymentHoldReasons":"purchaseRenewalSourceIssue");
          const result=await(app==="admin"?adminFixture(page):memberFixture(page));
          const target=page.locator(app==="admin"?"#paymentChargeAudit":"#membershipPurchaseFlow");
          await target.scrollIntoViewIfNeeded();
          const geometry=await target.evaluate(el=>({visible:!!el.getClientRects().length,width:el.getBoundingClientRect().width,overflow:el.scrollWidth-el.clientWidth}));
          assert(geometry.visible&&geometry.width>100,"actual target visible");assert(geometry.overflow<=1,"target horizontal overflow");
          if(app!=="admin"){
            assert(await page.locator("[data-purchase-pay]").isDisabled());
            assert.match(await page.locator("#purchasePayReason").textContent(),/온라인 연장이 불가/);
            const h=await page.locator("[data-purchase-pay]").evaluate(el=>el.getBoundingClientRect().height);assert(h>=44,"touch target");
          }
          assert.deepEqual(errors,[],"page errors");
          console.log(JSON.stringify({result:"PASS",engine,width,height,colorScheme,app,...result,geometry,realNetwork:0}));
          combinations++;await page.close();
        }}finally{await context.close();}
      }}finally{await browser.close();}
    }
    assert.equal(combinations,16,"full member/admin Chromium/WebKit matrix required");
    console.log(JSON.stringify({result:"PASS",combinations,durationMs:Math.round(performance.now()-startedAt),hostedWrites:0,providerCalls:0}));
  }finally{await new Promise(resolve=>server.close(resolve));clearTimeout(deadline);}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
