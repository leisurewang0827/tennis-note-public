import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire('C:/Codex/.tennisnote-playwright-1.56.1/package.json')('playwright');
const code=readFileSync(new URL('../app/admin/r4-scoped-coach.js',import.meta.url),'utf8');
const host='https://tennisnote-admin-dev.pages.dev';
const branch='00000000-0000-4000-8000-000000000001';
const roster='00000000-0000-4000-8000-000000000002';
const html=(wrong=false)=>`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light dark} body{font:16px system-ui;margin:16px} [hidden]{display:none!important}
.operations-password-login-form{display:grid;gap:8px;padding:12px;border:1px solid;max-width:740px}
button,a,input{min-height:44px;max-width:100%;box-sizing:border-box}button{white-space:normal}
</style><section id="r4Onboarding">내 지점</section><section id="r4BranchHoursPanel">
<select id="r4ManagedBranch"><option value="${branch}">A</option></select></section>
<script>
window.scopeTestActor='manager';
window.testCalls=[]; window.testLinked=false;window.testAdded=false;
window.TennisNoteDataClient={
 loadConfig:()=>({environment:'development',supabaseUrl:'https://udjmiezroipctytmztwz.supabase.co',projectFingerprint:'${wrong?'wrong':'63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'}'}),
 sessionSubject:()=>window.scopeTestActor,
 rpc:async(name,args,auth)=>{
  if(auth.requireCurrentSession!==true || auth.retryAuth!==false)throw Error('unsafe auth mode');
  window.testCalls.push({name,who:window.scopeTestActor,branch:args.p_branch});
  switch(name){
   case 'tn_r4_list_scoped_coach_roster':if(window.scopeTestActor!=='manager')throw Error('403');return {branchId:args.p_branch,rows:[{id:'${roster}',name:'합성 코치',eligible:true,linked:window.testLinked}]};
   case 'tn_r4_add_scoped_coach':window.testAdded=true;return {branchId:args.p_branch,rosterRoleId:'${roster}'};
   case 'tn_r4_accept_scoped_coach_code':window.testLinked=true;return {branchId:args.p_branch,rosterRoleId:'${roster}',linked:true};
   case 'tn_r4_revoke_scoped_coach':window.testLinked=false;return {branchId:args.p_branch,revoked:true};
   case 'tn_r4_my_scoped_coach_branches':return window.scopeTestActor==='coach'&&window.testLinked?[{id:'${branch}',name:'합성 A 지점'}]:[];
   case 'tn_r4_read_scoped_coach_schedule':return {branchId:args.p_branch,lessons:[{lessonDate:'2026-11-07',startTime:'09:10',minutes:20}]};
   default:throw Error('unexpected RPC');
  }
 }
};
</script><script defer src="/r4-scoped-coach.js"></script>`;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let layouts=0;
try{
 for(const width of [390,768,1366])for(const colorScheme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme,serviceWorkers:'block'});
  await ctx.route('**/*',route=>route.request().url().endsWith('/r4-scoped-coach.js')
    ?route.fulfill({contentType:'application/javascript',body:code})
    :route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:html()}):route.abort());
  const page=await ctx.newPage();
  await page.goto(host);
  await page.getByRole('heading',{name:'코치·직원'}).waitFor();
  await page.getByLabel('이름',{exact:true}).fill('추가 코치');
  await page.getByRole('button',{name:'코치 추가'}).click();
  await page.getByRole('status').filter({hasText:'명단에 추가했습니다.'}).waitFor();
  await page.getByLabel('연결 코드',{exact:true}).fill('1'.repeat(32));
  await page.getByRole('button',{name:'계정 연결'}).click();
  await page.getByText('계정 연결됨',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'연결 해제'}).click();
  await page.getByText('미연결',{exact:true}).waitFor();
  await page.evaluate(()=>{window.testLinked=true;window.scopeTestActor='coach';});
  await page.getByRole('heading',{name:'내 코치 일정'}).waitFor();
  await page.getByRole('button',{name:'합성 A 지점'}).click();
  await page.getByText('2026-11-07 · 09:10 · 20분').waitFor();
  assert.equal(await page.getByRole('button',{name:'코치 추가'}).count(),0);
  await page.evaluate(()=>{window.scopeTestActor='';});
  await page.getByRole('heading',{name:'내 코치 일정'}).waitFor({state:'detached'});
  assert.equal(await page.getByText('2026-11-07 · 09:10 · 20분').count(),0);
  const calls=await page.evaluate(()=>window.testCalls.filter(x=>x.branch));
  assert.ok(calls.length>=5&&calls.every(x=>x.branch===branch));
  layouts++;
  await ctx.close();
 }
 const wrong=await browser.newContext({serviceWorkers:'block'});
 await wrong.route('**/*',r=>r.request().url().endsWith('/r4-scoped-coach.js')?r.fulfill({contentType:'application/javascript',body:code}):r.fulfill({contentType:'text/html',body:html(true)}));
 const page=await wrong.newPage();await page.goto(host);
 assert.equal(await page.evaluate(()=>window.testCalls.length),0);
 await wrong.close();
 console.log(JSON.stringify({layouts,managerAddLinkRevoke:true,coachRead:true,sessionSwitchClears:true,wrongTargetRpc:0,hostedBrowser:false}));
}finally{await browser.close();}
