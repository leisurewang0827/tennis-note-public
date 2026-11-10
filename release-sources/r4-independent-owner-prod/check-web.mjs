// Synthetic browser only, intercepted origin, no network or real account.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.R4_PLAYWRIGHT_ROOT||'C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright';
const {chromium}=await import(pathToFileURL(root+'/index.mjs').href);
const script=readFileSync(new URL('./independent-ui.js',import.meta.url),'utf8');
const actor=randomUUID(),session=randomUUID(),workspace=randomUUID(),lesson=randomUUID();
const jwt='x.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,role:'authenticated',exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.x';
const html=`<meta charset="utf-8"><main><section id="r4Onboarding"></section></main><script>
localStorage.setItem('synthetic-auth',JSON.stringify({access_token:${JSON.stringify(jwt)}}));
window.calls=[];window.mockData={available:true,workspace:null,lesson:null};window.lose=false;window.failure='';window.failNextRead=false;
window.TennisNoteDataClient={authStorageKey:'synthetic-auth',authPersistenceKey:'synthetic-pref',
loadConfig:()=>({environment:'production',supabaseUrl:'https://cnympiwrwgouuvhaivbc.supabase.co',projectFingerprint:'3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'}),
rpc:async(name,a)=>{calls.push(a.p_action);if(a.p_action==='read'&&failNextRead){failNextRead=false;throw Error('read failed');}
if(failure===a.p_action){failure='';throw {status:400,code:'22023',payload:{code:'22023'}};}
if(failure==='unknown'&&a.p_action==='save'){failure='';throw Error('unknown');}
if(a.p_action==='register'){mockData.workspace={id:'${workspace}',operation:a.p_operation};if(lose)throw Error('response lost');}
if(a.p_action==='save'){mockData.lesson={id:'${lesson}',workspaceId:'${workspace}',title:a.p_title,startsAt:a.p_start,minutes:a.p_minutes,visibility:'private'};}
return structuredClone(mockData)}};</script><script src="/independent-ui.js"></script>`;
const executablePath=process.env.R4_CHROME_PATH||(process.platform==='win32'?'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe':undefined);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://tennisnote-admin.pages.dev')return route.abort();
   if(u.pathname==='/')return route.fulfill({body:html,contentType:'text/html; charset=utf-8'});if(u.pathname==='/independent-ui.js')return route.fulfill({body:script,contentType:'application/javascript; charset=utf-8'});return route.abort();});
 await page.goto('https://tennisnote-admin.pages.dev/');
 if(process.env.R4_WEB_DIAGNOSTIC){await page.waitForTimeout(500);console.log(JSON.stringify(await page.evaluate(()=>({calls:window.calls,sections:document.querySelectorAll('section').length,hidden:Array.from(document.querySelectorAll('section')).map(x=>x.hidden),buttons:Array.from(document.querySelectorAll('button')).map(x=>x.textContent),secure:isSecureContext,subtle:!!crypto.subtle}))),errors);}
 else if(process.env.R4_WEB_REJECTION_ONLY){
 await page.getByRole('button',{name:'독립 코치로 시작'}).waitFor();
 await page.evaluate(()=>window.failure='register');await page.getByRole('button',{name:'독립 코치로 시작'}).click();
 await page.waitForFunction(()=>window.calls.filter(x=>x==='read').length>=2);
 await page.getByRole('button',{name:'독립 코치로 시작'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'독립 코치로 시작'}).isEnabled(),true);
 await page.getByRole('button',{name:'독립 코치로 시작'}).click();
 await page.getByRole('button',{name:'비공개 레슨 저장'}).waitFor();
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 await page.getByLabel('날짜',{exact:true}).fill(tomorrow);await page.getByLabel('시작 시간').fill('12:00');
 await page.getByLabel('레슨 이름').fill(' a ');await page.getByRole('button',{name:'비공개 레슨 저장'}).click();
 await page.getByText('레슨 이름을 두 글자 이상 입력해 주세요.').waitFor();assert.equal(await page.evaluate(()=>calls.filter(x=>x==='save').length),0);
 await page.getByLabel('레슨 이름').evaluate(x=>{x.value='a\u0001b';x.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'비공개 레슨 저장'}).click();assert.equal(await page.evaluate(()=>calls.filter(x=>x==='save').length),0);
 await page.getByLabel('레슨 이름').fill('합성 레슨');await page.evaluate(()=>{window.failure='save';window.failNextRead=true;});
 await page.getByRole('button',{name:'비공개 레슨 저장'}).click();await page.getByText('다시 저장하지 말고 상태를 확인해 주세요.').waitFor();
 assert.equal(await page.getByRole('button',{name:'비공개 레슨 저장'}).isDisabled(),true);
 await page.getByRole('button',{name:'상태 다시 확인'}).click();await page.getByRole('button',{name:'비공개 레슨 저장'}).waitFor();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(x=>x.textContent==='비공개 레슨 저장'&&!x.disabled));
 assert.equal(await page.getByRole('button',{name:'비공개 레슨 저장'}).isEnabled(),true);
 await page.getByLabel('레슨 이름').fill('합성 레슨');await page.getByLabel('날짜',{exact:true}).fill(tomorrow);await page.getByLabel('시작 시간').fill('12:00');
 await page.evaluate(()=>window.failure='unknown');await page.getByRole('button',{name:'비공개 레슨 저장'}).click();
 await page.getByText('다시 저장하지 말고 상태를 확인해 주세요.').waitFor();await page.getByRole('button',{name:'상태 다시 확인'}).click();
 await page.getByText('저장 결과가 확인될 때까지 다시 저장할 수 없습니다.').waitFor();
 assert.equal(await page.getByRole('button',{name:'비공개 레슨 저장'}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x==='save').length),2);
 console.log('PASS synthetic Chromium delta: validation 0 calls, confirmed rollback with read recovery, unknown stays locked');
 }
 else {
 await page.getByText('독립 코치로 시작',{exact:true}).waitFor();
 await page.evaluate(()=>window.lose=true);await page.getByRole('button',{name:'독립 코치로 시작'}).click();
 await page.getByText('다시 저장하지 말고 상태를 확인해 주세요.').waitFor();
 assert.equal(await page.getByRole('button',{name:'독립 코치로 시작'}).isDisabled(),true);
 await page.evaluate(()=>window.lose=false);await page.getByRole('button',{name:'상태 다시 확인'}).click();
 await page.getByRole('button',{name:'비공개 레슨 저장'}).waitFor();
 assert.equal(await page.evaluate(()=>calls.filter(x=>x==='register').length),1);
 await page.getByLabel('레슨 이름').fill('합성 레슨');
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 await page.getByLabel('날짜',{exact:true}).fill(tomorrow);await page.getByLabel('시작 시간').fill('12:00');
 await page.getByRole('button',{name:'비공개 레슨 저장'}).click();
 await page.getByText(/합성 레슨.*비공개/).waitFor();
 assert.equal(await page.evaluate(()=>calls.filter(x=>x==='save').length),1);
 console.log('PASS synthetic Chromium: loss/readback, register 1, private lesson 1, exact session only');
 }
 await context.close();
}finally{await browser.close();}
