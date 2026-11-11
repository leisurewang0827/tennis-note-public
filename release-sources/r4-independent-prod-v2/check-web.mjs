// New production binding and permission rendering, synthetic Chromium, no live requests.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'file:///C:/Codex/.tennisnote-playwright-1.56.1/node_modules/playwright/index.mjs';
import {assemble} from './compose.mjs';
const {after,delta}=assemble();
assert.equal(Object.keys(after).length,179);
assert.deepEqual(delta,['index.html','r4-independent-prod-v2.js']);
const html=after['index.html'].toString('utf8'), tag=html.match(/<script src="(\.\/r4-independent-prod-v2\.js\?v=[a-f0-9]{16})"><\/script>/)?.[0];
assert.ok(tag&&!html.includes('src="./r4-independent-owner.js?'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const origin='https://tennisnote-admin.pages.dev',backend='https://cnympiwrwgouuvhaivbc.supabase.co';
async function make(mode){
  const context=await browser.newContext({serviceWorkers:'block'});
  const p=await context.newPage(), id=randomUUID(), sid=randomUUID(), w=randomUUID(), l=randomUUID();
  const token='synthetic.'+Buffer.from(JSON.stringify({sub:id,session_id:sid,role:'authenticated',exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.synthetic';
  const cfg={environment:mode==='wrong'?'development':'production',supabaseUrl:backend,
    projectFingerprint:'3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'};
  const api={workspace:{id:w,displayName:'검증 작업공간',kind:'independent_coach'},canCreate:mode==='writer',canManageLessons:true,canWriteLessons:mode==='writer'};
  const start=new Date(Date.now()+2*86400000);start.setUTCMinutes(0,0,0);
  const listing={lessons:[{id:l,startsAt:start.toISOString(),minutes:20,revision:1,cancelled:false,title:'<b>비공개 검증</b>'}],next:null};
  const errors=[];p.on('pageerror',e=>errors.push(e.name));
  await context.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin!==origin)return r.abort();
    if(u.pathname==='/r4-independent-prod-v2.js')return r.fulfill({contentType:'application/javascript; charset=utf-8',body:after['r4-independent-prod-v2.js']});
    if(u.pathname!=='/')return r.abort();
    return r.fulfill({contentType:'text/html; charset=utf-8',body:`<meta charset="utf-8"><section id="r4Onboarding"></section><script>
      window.testCalls=[]; localStorage.setItem('mock-auth',JSON.stringify({access_token:${JSON.stringify(token)}}));
      window.TennisNoteDataClient={loadConfig:()=>(${JSON.stringify(cfg)}),authStorageKey:'mock-auth',authPersistenceKey:'mock-pref',
      async rpc(name,args,options){window.testCalls.push({name,args,options});
        if(${JSON.stringify(mode)}==='off')throw Error('off');
        if(name==='tn_r4_prod_my_independent_v2_workspace')return ${JSON.stringify(api)};
        if(name==='tn_r4_prod_my_independent_v2_lessons'&&args.p_action==='list')return ${JSON.stringify(listing)};
        throw Error('unexpected call');}};
      </script>${tag}`});
  });
  await p.goto(origin);return {p,context,errors,panel:p.locator('[data-r4-independent-prod-v2]')};
}
try{
  const a=await make('writer'),b=await make('reader'),off=await make('off'),wrong=await make('wrong');
  for(const m of [a,b]){
    await m.panel.getByText('<b>비공개 검증</b>',{exact:true}).waitFor({timeout:6000});
    assert.equal(await m.panel.locator('b').count(),0,'title text must not be HTML');
    const calls=await m.p.evaluate(()=>window.testCalls);
    assert.deepEqual(calls.map(c=>c.name),['tn_r4_prod_my_independent_v2_workspace','tn_r4_prod_my_independent_v2_lessons']);
    assert.ok(calls.every(c=>c.options.requireCurrentSession===true&&c.options.retryAuth===false));
  }
  assert.equal(await a.panel.getByRole('button',{name:'비공개 레슨 추가',exact:true}).count(),1);
  assert.equal(await a.panel.getByRole('button',{name:'수정',exact:true}).count(),1);
  assert.equal(await a.panel.getByRole('button',{name:'취소',exact:true}).count(),1);
  assert.equal(await b.panel.getByRole('button').filter({hasText:/비공개 레슨 추가|수정|취소/}).count(),0);
  await off.p.waitForFunction(()=>window.testCalls?.length===1);
  assert.equal(await off.panel.isVisible(),false);
  assert.equal(await wrong.panel.count(),0);
  assert.deepEqual(await wrong.p.evaluate(()=>window.testCalls),[]);
  assert.deepEqual([a,b,off,wrong].flatMap(x=>x.errors),[]);
  console.log('PROD_V2_LOCAL_WEB_PASS: sealed admin delta, exact prod binding, writer/reader/OFF/wrong target, text-only rendering, no external calls');
}finally{await browser.close();}
