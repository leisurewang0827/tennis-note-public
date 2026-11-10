import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {assemble} from "./compose-pending-member-registration.mjs";
const {chromium}=await import(pathToFileURL('C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright/index.mjs').href);
const chrome='C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const base=process.argv[2],{output,version}=assemble(base);
const app="https://tennisnote-admin.pages.dev",api="https://cnympiwrwgouuvhaivbc.supabase.co/rest/v1/rpc/tn_r4_prod_pending_member_registration";
const [actor,session,branch,coach,member]=Array.from({length:5},randomUUID);
const jwt="x."+Buffer.from(JSON.stringify({sub:actor,session_id:session,role:"authenticated",exp:Math.floor(Date.now()/1000)+600})).toString("base64url")+".x";
const fragment=`<meta charset="utf-8"><main id=adminAppShell><section id=membersView><button id=addMemberButton>회원 등록</button></section></main>
<script>window.operationsRole=()=>"admin";window.activeOperationBranchId=()=>"${branch}";
window.TennisNoteDataClient={getSession:()=>({access_token:${JSON.stringify(jwt)}}),
loadConfig:()=>({environment:"production",supabaseUrl:"https://cnympiwrwgouuvhaivbc.supabase.co",
projectFingerprint:"3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a",supabasePublishableKey:"synthetic"})};</script>
<script src="/pending-member-registration.js?v=${version}"></script>`;
const browser=await chromium.launch({headless:true,executablePath:chrome});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let page=await context.newPage();
 const calls=[],browserErrors=[],receipts=new Map();let saved=null,delayPage=null,waitForOld=null;
 page.on("pageerror",err=>browserErrors.push(err.message));
 page.on("requestfailed",req=>browserErrors.push(new URL(req.url()).pathname+":"+req.failure()?.errorText));
 const headers={"access-control-allow-origin":app,"access-control-allow-methods":"POST,OPTIONS",
  "access-control-allow-headers":"apikey,authorization,content-type"};
 await context.route("**/*",async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.origin===app){
     if(url.pathname==="/")return route.fulfill({body:fragment,contentType:"text/html"});
     if(url.pathname==="/pending-member-registration.js")
       return route.fulfill({body:output["pending-member-registration.js"],contentType:"application/javascript"});
     return route.abort();
   }
   if(r.url()!==api)return route.abort();
   if(r.method()==="OPTIONS")return route.fulfill({status:204,headers});
   const q=r.postDataJSON();calls.push(q);
   assert.equal(q.p_branch,branch);
   if(q.p_action==="coaches")return route.fulfill({json:[{id:coach,label:"합성 코치"}],headers});
   if(q.p_action==="save"){
     assert.deepEqual(Object.keys(q).sort(),["p_action","p_branch","p_coach","p_name","p_operation"]);
     saved={op:q.p_operation,name:q.p_name};
     receipts.set(saved.op,saved);
     return route.abort("failed");
   }
   const result=receipts.get(q.p_operation);
   if(delayPage===r.frame().page()&&waitForOld)await waitForOld;
   return route.fulfill({json:result?{memberId:member,name:result.name,status:"pending",hasTicket:false}:null,headers});
 });
 await page.goto(app);
 try{await page.getByText("대기 회원 등록",{exact:true}).click({timeout:5000});}
 catch(e){throw Error(JSON.stringify({actions:calls.map(x=>x.p_action),browserErrors,
   controller:await page.locator("[data-r4-pending-registration]").evaluate(x=>({hidden:x.hidden,options:x.querySelectorAll("option").length,
    summary:x.querySelector("summary")?.textContent,disabled:x.querySelector("button")?.disabled}))}),{cause:e});}
 await page.getByLabel("회원 이름").fill("합성 신규 회원");
 await page.getByLabel("담당 코치").selectOption(coach);
 const other=await context.newPage();
 await other.goto(app);
 await other.getByText("대기 회원 등록",{exact:true}).click();
 await other.getByLabel("회원 이름").fill("합성 신규 회원");
 await other.getByLabel("담당 코치").selectOption(coach);
 const form="[data-r4-pending-registration] form";
 await Promise.all([page.locator(form).evaluate(f=>f.requestSubmit()),other.locator(form).evaluate(f=>f.requestSubmit())]);
 await Promise.race([page.getByText(/결과가 확실하지 않습니다/).waitFor(),other.getByText(/결과가 확실하지 않습니다/).waitFor()]);
 assert.equal(await page.getByRole("button",{name:"대기 회원 저장"}).isEnabled(),false);
 assert.equal(await other.getByRole("button",{name:"대기 회원 저장"}).isEnabled(),false);
 await page.close();
 await other.close();
 page=await context.newPage();
 await page.goto(app);
 await page.getByText("대기 회원 등록",{exact:true}).click();
 await page.getByText("이전 등록 결과를 먼저 조회하세요.").waitFor();
 assert.equal(await page.getByRole("button",{name:"대기 회원 저장"}).isEnabled(),false);
 await page.getByRole("button",{name:"저장 결과 다시 조회"}).click();
 await page.getByText(/합성 신규 회원 · 대기 등록 확인 · 회원권 없음/).waitFor();
 assert.equal(calls.filter(x=>x.p_action==="save").length,1);
 assert.equal(calls.filter(x=>x.p_action==="read").length,1);
 let releaseOld;
 delayPage=page;waitForOld=new Promise(resolve=>{releaseOld=resolve;});
 await page.getByRole("button",{name:"저장 결과 다시 조회"}).click();
 const peer=await context.newPage();
 await peer.goto(app);
 await peer.getByText("대기 회원 등록",{exact:true}).click();
 await peer.getByRole("button",{name:"저장 결과 다시 조회"}).click();
 await peer.getByText(/대기 등록 확인 · 회원권 없음/).waitFor();
 await peer.getByLabel("회원 이름").fill("합성 다음 회원");
 await peer.getByLabel("담당 코치").selectOption(coach);
 await peer.getByRole("button",{name:"대기 회원 저장"}).click();
 await peer.getByText(/결과가 확실하지 않습니다/).waitFor();
 releaseOld();
 await page.getByText("최신 등록 결과를 먼저 조회하세요.").waitFor();
 await page.getByLabel("회원 이름").fill("차단되어야 함");
 await page.getByLabel("담당 코치").selectOption(coach);
 assert.equal(await page.getByRole("button",{name:"대기 회원 저장"}).isEnabled(),false);
 assert.equal(calls.filter(x=>x.p_action==="save").length,2);
 console.log("PENDING_MEMBER_WEB_DELTA_PASS: sealed admin two-file delta, no-charge fields, concurrent tabs once, closed-tab read-back, delayed old response cannot unlock new operation");
}finally{await browser.close();}
