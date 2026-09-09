"use strict";
// Runs inside the existing actual admin-entry + Worker + transport harness.
module.exports = async ({page,modal,engine,check,workbookBytes,XLSX,parser}) => {
  await page.evaluate(() => {
    const real=window.TennisNoteDataClient.rpc;
    window.__initial={kind:"TOPUP_EXISTING",state:"READY",applies:0,reverses:0};
    window.TennisNoteDataClient.rpc=async(name,args,options)=>{
      const p=window.__initial;
      if(name==="tn_prepare_single_sheet_work_session")return real(name,args,options);
      if(name==="tn_apply_single_sheet_import_unit") {
        p.applies++;p.state="APPLIED";
        if(p.responseLoss)throw Error("SYNTHETIC_RESPONSE_LOSS");
        return {status:"applied"};
      }
      if(name==="tn_reverse_single_sheet_import_unit") {p.reverses++;p.state="REVERSED";return {status:"reversed"};}
      if(name!=="tn_preview_single_sheet_import")throw Error("UNEXPECTED_RPC");
      const held=p.state==="HOLD",ready=p.state==="READY";
      return {contract:"single-sheet-server/2",initialContract:"initial-import/1",scope:args.scope,
        proof:{complete:true,scope:"unit_dependencies",statementBudgetMs:10000,unitCount:args.units.length,expiresAt:new Date(Date.now()+300000).toISOString()},
        units:args.units.map((u,i)=>({status:p.state,unitHash:String(i+1).repeat(64),planHash:"b".repeat(64),revision:"b".repeat(64),rowCount:u.rows.length,
          newMembers:held?null:ready&&p.kind==="NEW_TICKET"?1:0,newTickets:held?null:ready&&p.kind!=="TOPUP_EXISTING"?1:0,newLessons:held?null:0,
          verified:!held&&!ready,reversible:p.state==="APPLIED",reason:held?"SHEET_NEW_SOURCE_EVIDENCE_REQUIRED":"",
          initial:held||p.state==="NO_OP"?null:ready?{kind:p.kind,historicalReceipt:false,remainingBefore:p.kind==="TOPUP_EXISTING"?1:0,addedSessions:8,remainingAfter:p.kind==="TOPUP_EXISTING"?9:8,expiresOn:"2099-12-31",preservedLessons:0,reservedUnits:0,manualAssignment:true}:{kind:p.kind,historicalReceipt:true}}))};
    };
  });
  const wb=XLSX.read(workbookBytes(),{type:"buffer"});
  wb.Sheets[parser.SHEET].G2={t:"s",v:""};
  const bytes=Buffer.from(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}));
  const apply=modal.locator("[data-excel-apply]"),input=modal.locator("[data-excel-file]");
  const start=async(kind,state="READY")=>{
    if(await modal.isVisible()) {await modal.locator("[data-excel-close]").click();await modal.waitFor({state:"hidden"});await page.waitForFunction(()=>!history.state?.tnExcelPreview);}
    await page.evaluate(({kind,state})=>Object.assign(window.__initial,{kind,state,applies:0,reverses:0,responseLoss:false}),{kind,state});
    await page.locator("#openSingleSheetPreviewButton").click();
    await input.setInputFiles({name:"synthetic-initial.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:bytes});
    await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase==="ready");
  };
  await start("TOPUP_EXISTING");
  check((await modal.innerText()).includes("잔여 1회 + 추가 8회 = 9회"),"ACTUAL_ENTRY_TOPUP_BALANCE");
  check((await modal.innerText()).includes("시간 수동 배정")&&await apply.isEnabled(),"BLANK_USED_ZERO_REAL_WORKER");
  const layouts=[[390,844],[768,1024],[1366,900],[844,390]];
  for(const [width,height]of layouts)for(const theme of ["light","dark"]){
    await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await apply.scrollIntoViewIfNeeded();await modal.locator(".tn-excel-panel").evaluate(e=>e.scrollTop=e.scrollHeight);
    const m=await modal.evaluate(e=>{
      const p=e.querySelector(".tn-excel-panel"),a=e.querySelector("[data-excel-apply]").getBoundingClientRect(),r=p.getBoundingClientRect();
      return {overflow:p.scrollWidth>p.clientWidth+1,inside:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,
        visible:Math.min(a.bottom,r.bottom,innerHeight)-Math.max(a.top,r.top,0),font:parseFloat(getComputedStyle(e.querySelector("input")).fontSize)};
    });
    check(!m.overflow&&m.inside&&m.visible>=44&&m.font>=16,"INITIAL_LAYOUT_TOUCH_FOCUS");
    if(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR){
      const fs=require("node:fs"),path=require("node:path"),dir=path.resolve(process.env.TENNISNOTE_EXCEL_CAPTURE_DIR);fs.mkdirSync(dir,{recursive:true});
      await modal.locator(".tn-excel-panel").evaluate(e=>e.scrollTop=0);
      await modal.locator(".tn-excel-panel").screenshot({path:path.join(dir,`${engine}-initial-${width}-${theme}.png`)});
    }
  }
  // Back discards selection; no write and no accidental reactivation.
  await page.goBack();await modal.waitFor({state:"hidden"});
  check(await page.evaluate(()=>window.__initial.applies===0),"BACK_WRITE_ZERO");
  for(const kind of ["NEW_TICKET","ADD_TICKET"]){await start(kind);check((await modal.innerText()).includes(kind==="NEW_TICKET"?"새 회원권 등록":"다른 코치 회원권 추가"),"INITIAL_KIND_LABEL");}
  await start("TOPUP_EXISTING","HOLD");check(await apply.isDisabled()&&(await modal.innerText()).includes("새 등록 근거"),"SOURCE_HOLD_NO_APPLY");
  await start("TOPUP_EXISTING","NO_OP");check(await apply.isDisabled()&&(await modal.innerText()).includes("이미 처리"),"NOOP_NO_APPLY");
  await start("TOPUP_EXISTING");await page.evaluate(()=>window.__initial.responseLoss=true);
  await apply.click();await apply.click();
  await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase==="done");
  check(await page.evaluate(()=>window.__initial.applies===1),"RESPONSE_LOSS_ONE_APPLY");
  check(!(await modal.innerText()).includes("= 9회")&&(await modal.innerText()).includes("현재 잔여"),"RECEIPT_NOT_LIVE_BALANCE");
  await page.evaluate(()=>window.dispatchEvent(new Event("tennisnote:excel-snapshot-changed")));
  check(await modal.getAttribute("data-batch-phase")==="done","480_COMPLETION_REFRESH_RETAINED");
  const reverse=modal.locator("[data-excel-reverse]");await reverse.click();await reverse.click();
  await page.waitForFunction(()=>document.querySelector("#singleSheetPreviewModal")?.dataset.batchPhase==="reversed");
  check(await page.evaluate(()=>window.__initial.reverses===1),"ONE_OWNED_REVERSE");
  process.stdout.write(`PASS ${engine} initial envelope actual admin/worker/transport/batch/UI; 8 layouts; synthetic write only\n`);
};
