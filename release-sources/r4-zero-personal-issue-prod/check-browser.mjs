import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {assemble} from "./compose.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TN_QA_PLAYWRIGHT_MODULE||"playwright");
const {output}=assemble(process.argv[2]);
const [actor,session,branch,other,member,reg,ticket]=Array.from({length:7},randomUUID);
const token="x."+Buffer.from(JSON.stringify({sub:actor,session_id:session,role:"authenticated",exp:Math.floor(Date.now()/1000)+300})).toString("base64url")+".x";
const receipt={registrationId:reg,ticketId:ticket,total:5,remaining:4,price:0,removed:false,public:false,payment:false,expiresOn:"2026-12-14"};
const origin="https://tennisnote-admin.pages.dev";
const api="https://cnympiwrwgouuvhaivbc.supabase.co/rest/v1/rpc/tn_r4_prod_zero_personal_issue";
const browser=await chromium.launch({headless:true,executablePath:process.env.TN_QA_CHROMIUM});
try{
  for(const scenario of ["issued","removed","new","lost","off","stale-branch"]){
    const c=await browser.newContext({serviceWorkers:"block",viewport:{width:390,height:844}});
    const calls=[];
    let saved=scenario==="issued"?receipt:scenario==="removed"?{...receipt,removed:true}:null,writeKey="";
    try{
      await c.route("**/*",async route=>{
        const req=route.request(),u=new URL(req.url());
        if(u.origin===origin&&req.method()==="GET"){
          const path=u.pathname.slice(1)||"index.html";
          if(!Object.hasOwn(output,path))return route.abort();
          return route.fulfill({body:output[path],contentType:path.endsWith(".js")?"application/javascript":
            path.endsWith(".html")?"text/html":path.endsWith(".css")?"text/css":undefined});
        }
        if(req.url()!==api)return route.abort();
        if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{
          "access-control-allow-origin":origin,"access-control-allow-methods":"POST,OPTIONS",
          "access-control-allow-headers":"authorization,apikey,content-type"}});
        if(req.method()!=="POST")return route.abort();
        const d=req.postDataJSON();calls.push(d.p_action);
        assert.equal(d.p_member,member);assert.equal(d.p_branch,branch);
        const headers={"access-control-allow-origin":origin};
        if(scenario==="off")return route.fulfill({status:403,headers,json:{code:"42501"}});
        if(d.p_action==="list")return route.fulfill({headers,json:[{id:reg,name:"<합성> 내부 상품",price:0,minutes:20,sessions:5,days:35}]});
        assert.equal(d.p_registration,reg);assert.ok(d.p_operation);
        if(d.p_action==="read"){
          if(writeKey)assert.equal(d.p_operation,writeKey);
          return route.fulfill({headers,body:JSON.stringify(saved),contentType:"application/json"});
        }
        assert.equal(d.p_action,"issue");assert.equal(writeKey,"");
        writeKey=d.p_operation;saved=receipt;
        if(scenario==="lost")return route.abort();
        return route.fulfill({headers,json:saved});
      });
      const page=await c.newPage();
      await page.goto(origin+"/",{waitUntil:"load"});
      await page.waitForFunction(()=>typeof window.TennisNoteR4ZeroPersonalIssue?.mount==="function"&&typeof openMemberManagementModal==="function");
      await page.evaluate(({actor,member,branch,other,token})=>{
        const client=window.TennisNoteDataClient;
        localStorage.setItem(client.authPersistenceKey,"session");
        sessionStorage.setItem(client.authStorageKey,JSON.stringify({access_token:token,expires_at:Date.now()+240000}));
        adminImportAuthState.profile={id:actor,role:"admin"};adminImportAuthState.user={id:actor};
        adminLiveDataState.branches=[{id:branch,name:"합성 지점",status:"active"},{id:other,name:"다른 지점",status:"active"}];
        members.splice(0,members.length,{id:321,serverUserId:member,name:"합성 회원",role:"member",status:"active",memberKind:"regular"});
        syncAdminLiveData=()=>loadLiveSchedulePolicyFromServer({value:{
          operationProfiles:[{id:"saved",branchId:branch,name:"서버 기준"}],activeOperationProfileId:"saved"
        }});
        document.querySelector("#operationsLoginGate")?.setAttribute("hidden","");
        document.body.classList.remove("operations-locked");
      },{actor,member,branch,other,token});
      await page.evaluate(()=>openMemberManagementModal(members[0],"assign"));
      const panel=page.locator("[data-r4-zero-personal-issue]");
      await panel.waitFor({state:"attached"});
      if(scenario==="off"){
        await page.waitForLoadState("networkidle");
        assert.deepEqual(calls,["list"]);assert.equal(await panel.isVisible(),false);continue;
      }
      await panel.getByText("내부 상품으로 등록",{exact:true}).click();
      assert.equal(await panel.locator("select").inputValue(),reg);
      assert.match(await panel.locator("option").textContent(),/<합성> 내부 상품.*0원/);
      const button=panel.getByRole("button",{name:"0원 개인권 발급"});
      assert.equal(await button.isDisabled(),true);
      if(scenario==="issued"){
        await panel.getByText("등록 확인 · 잔여 4회 · 만료 2026-12-14").waitFor();
        assert.deepEqual(calls,["list","read"]);continue;
      }
      if(scenario==="removed"){
        await panel.getByText("이전에 발급한 개인권이 삭제되었습니다. 같은 상품은 다시 발급하지 않습니다.").waitFor();
        assert.deepEqual(calls,["list","read"]);assert.equal(await button.isDisabled(),true);continue;
      }
      await panel.locator("input[type=checkbox]").check();
      assert.equal(await button.isEnabled(),true);
      if(scenario==="stale-branch"){
        await page.evaluate(x=>{activeOperationProfile().branchId=x;},other);
        await button.evaluate(b=>b.click());
        assert.deepEqual(calls,["list","read"]);assert.equal(await button.isDisabled(),true);continue;
      }
      await button.evaluate(b=>{b.click();b.click();});
      await panel.getByText("등록 확인 · 잔여 4회 · 만료 2026-12-14").waitFor();
      assert.deepEqual(calls,["list","read","issue","read"]);
      assert.equal(await button.isDisabled(),true);
      assert.equal(await button.getAttribute("type"),"button");
      assert.equal(await panel.evaluate(x=>x.closest("form")),null);
    }finally{await c.close();}
  }
  console.log("SEALED_ADMIN_DELTA_PASS: actual renderer, issued readback, deliberate confirm, lost reply, OFF, changed branch");
}finally{await browser.close();}
