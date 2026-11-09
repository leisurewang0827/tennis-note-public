// Synthetic browser-only checks; all requests are intercepted, no real account or DB.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {compose} from "../release-sources/r4-internal-registration-prod/production-overlay.mjs";
const base=process.env.R4_PROD_BASE; assert.ok(base);
const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+"/")):[[prefix+e.name,readFileSync(join(dir,e.name))]]));
const {delta}=compose({files:walk(join(base,"admin")),sealBytes:readFileSync(join(base,"seal.json")),
  draftSource:readFileSync("release-sources/r4-product-draft-dev/r4-product-draft-candidate.js"),
  registrationSource:readFileSync("release-sources/r4-internal-registration-dev/registration-ui.js"),
  hostSource:readFileSync("release-sources/r4-internal-registration-prod/production-host.js"),cssSource:readFileSync("release-sources/r4-product-draft-style-dev/candidate.css")});
const {chromium,webkit}=await import(pathToFileURL("C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright/index.mjs").href);
const engines=[["chromium",chromium,"C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"],["webkit",webkit,"C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe"]];
for(const [name,engine,executablePath] of engines){
  const browser=await engine.launch({headless:true,executablePath});
  try {for(const mode of (process.env.R4_PROD_TEST_MODE?process.env.R4_PROD_TEST_MODE.split(","):["off","new","existing-enabled","existing-disabled","invalid","hours-change"])){
    const page=await browser.newPage();
    await page.route("**/*",route=>route.fulfill({status:200,contentType:"text/html",body:'<select id="r4ManagedBranch"><option value="11111111-1111-4111-8111-111111111111">x</option></select><div id="r4BranchHoursPanel"><form id="r4BranchHoursForm"></form></div>'}));
    await page.goto("https://tennisnote-admin.pages.dev/");
    await page.evaluate(mode=>{window.mode=mode;window.calls=[];window.saved=false;window.TennisNoteR4ExistingAccount={isProductionTarget:()=>true};
      const branch="11111111-1111-4111-8111-111111111111",op="22222222-2222-4222-8222-222222222222";
      const receipt=()=>({branchId:branch,operationId:op,name:"합성 상품",sessions:5,minutes:20,days:30,price:0,status:"draft",internalRegistrationEnabled:mode!=="existing-disabled",public:false,saleEnabled:false,paymentEnabled:false});
      localStorage.setItem('synthetic-auth',JSON.stringify({access_token:`x.${btoa(JSON.stringify({sub:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",session_id:"33333333-3333-4333-8333-333333333333"}))}.x`}));
      window.fixtureClient={authStorageKey:'synthetic-auth',authPersistenceKey:'synthetic-persistence',sessionSubject(){throw Error('fallback');},getSession(){throw Error('fallback');},async rpc(name,args){window.calls.push({name,args});
        if(name==="tn_r4_prod_product_draft_get"&&args.p_operation===null){if(mode==="off")throw Error("disabled");return {branchId:branch,draftOperationId:op,status:"draft_access",internalRegistrationEnabled:mode!=="existing-disabled",public:false,saleEnabled:false,paymentEnabled:false};}
        if(name==="tn_r4_prod_product_draft_get")return mode==="new"&&!window.saved?null:mode==="invalid"?{}:receipt();
        if(name==="tn_r4_prod_product_draft_save"){window.saved=true;return receipt();} throw Error("unexpected");}};
    },mode);
    for(const file of ["r4-internal-product-registration.js","r4-product-draft-candidate.js","r4-production-draft-host.js"])await page.addScriptTag({content:delta[file].toString()});
    await page.evaluate(()=>window.TennisNoteR4ProductionDraftHost.open({client:window.fixtureClient,branchId:"11111111-1111-4111-8111-111111111111",currentContext:()=>true}));
    if(mode==="off"){assert.equal(await page.locator("#r4ProductDraftHost").count(),0);assert.equal(await page.evaluate(()=>calls.length),1);}
    else {
      await page.waitForFunction(()=>!document.querySelector('#r4ProductDraftHost [role=status]')?.textContent.includes('확인하는 중'));
      const save=page.locator('#r4ProductDraftHost button[type=submit]');
      if(mode==="new"){assert.equal(await save.isEnabled(),true);for(const [key,value] of Object.entries({name:"합성 상품",sessions:"5",minutes:"20",days:"30",price:"0"}))await page.locator(`[name=${key}]`).fill(value);await save.click();await page.getByText('비공개 초안을 저장하고 확인했습니다.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='tn_r4_prod_product_draft_save').length),1);assert.equal(await page.evaluate(()=>calls.find(c=>c.name==='tn_r4_prod_product_draft_save').args.p_operation),"22222222-2222-4222-8222-222222222222");assert.equal(await page.getByRole('button',{name:'내부 등록',exact:true}).isVisible(),true);assert.equal(await save.isDisabled(),true);}
      if(mode==="invalid")assert.equal(await page.locator("#r4ProductDraftHost").count(),0);
      if(mode==="hours-change"){await page.locator('#r4BranchHoursForm').evaluate(el=>el.hidden=true);await page.waitForFunction(()=>!document.querySelector('#r4ProductDraftHost'));assert.equal(await page.locator("#r4ProductDraftHost").count(),0);}
      if(mode.startsWith("existing")){assert.equal(await save.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'내부 등록',exact:true}).isVisible(),mode==='existing-enabled');}
    }
    await page.close();
  }} finally {await browser.close();}
  console.log(`PASS ${name}: OFF/new/existing/on/off/invalid (synthetic)`);
}
