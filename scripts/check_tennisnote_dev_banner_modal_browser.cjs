const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./check_tennisnote_feedback_exit_ux_browser.cjs');
const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'app/shared/tennisnote-runtime-environment.js');
const current = fs.readFileSync(runtimePath, 'utf8');
// Freeze the old renderer from private 55c16b74 / public ba659e6b so a shallow
// CI checkout reproduces the bug without fetching historical Git objects.
const baseline = `(() => {
  const environment = window.TENNISNOTE_CONFIG.environment;
  document.documentElement.dataset.tennisnoteEnvironment = environment;
  if (environment !== 'development') return;
  const banner = document.createElement('aside');
  banner.dataset.tennisnoteInternalQaBanner = 'true';
  banner.setAttribute('role','status');
  banner.setAttribute('aria-label','서울 개발 내부 QA 안내');
  banner.textContent = '서울 개발 · 내부 QA · 실제 결제·푸시 차단';
  Object.assign(banner.style, {position:'sticky',top:'0',zIndex:'2147483647',
    padding:'max(8px, env(safe-area-inset-top)) 12px 8px',background:'#7c2d12',
    color:'#fff',textAlign:'center',font:'700 13px/1.4 system-ui, sans-serif'});
  document.body.prepend(banner);
})();`;
// Exact development build injection from public ba659e6b; no account or remote fixture.
const injectedBanner = '<aside role="status" aria-label="개발계 안내" style="position:sticky;top:0;z-index:2147483647;padding:8px 12px;background:#7c2d12;color:#fff;text-align:center;font:700 13px/1.4 system-ui,sans-serif">개발계 · 실제 결제·푸시 차단</aside>';
const output = process.env.TENNISNOTE_QA_OUTPUT;
if (output) fs.mkdirSync(output, { recursive: true });
const profiles = [[390,844],[768,1024],[1366,900],[844,390]];
const results = [];

async function mount(page, source, theme, environment = 'development', buildBanner = true) {
  await fixture.loadFixture(page, theme, async () => {
    await page.evaluate(({ injectedBanner, environment, buildBanner }) => {
      document.documentElement.dataset.tennisnoteSurface = 'coach';
      window.TENNISNOTE_CONFIG = { environment };
      if (environment === 'development' && buildBanner) document.body.insertAdjacentHTML('afterbegin', injectedBanner);
    }, { injectedBanner, environment, buildBanner });
    await page.addScriptTag({ content: source });
  }, 0);
}

async function geometry(page) {
  return page.evaluate(() => {
    const banner = document.querySelector('[data-tennisnote-internal-qa-banner]');
    const header = document.querySelector('.lesson-detail-sheet-header');
    const x = document.querySelector('.lesson-detail-sheet-close');
    const box = (el) => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right }; };
    const b = banner ? box(banner) : null;
    const h = box(header), r = box(x);
    // Existing X is a 44px circle; probe its centre and four cardinal edges,
    // not the bounding-box corners outside the rounded clickable shape.
    const points = [[.5,.5],[.5,.08],[.92,.5],[.5,.92],[.08,.5]];
    return {
      bannerCount:document.querySelectorAll('[data-tennisnote-internal-qa-banner],aside[aria-label="개발계 안내"]').length,
      banner:b, header:h, x:r,
      xHits:points.map(([a,b]) => x.contains(document.elementFromPoint(r.x+r.width*a,r.y+r.height*b))),
      headerVisible:(!b || h.y>=b.bottom-1) && h.bottom<=innerHeight,
      overflow:document.documentElement.scrollWidth>innerWidth,
      bannerText:banner?.textContent || '',
      requestCount:window.__networkCount+window.__rpcCount,
    };
  });
}

async function run(engineName) {
  const engine = fixture[engineName];
  const options = { headless:true };
  if (engineName === 'chromium' && process.platform === 'win32') {
    const exe = [engine.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
    if (exe) options.executablePath = exe;
  }
  const browser = await engine.launch(options);
  try {
    for (const [width,height] of profiles) for (const theme of ['light','dark']) {
      const context = await browser.newContext({ viewport:{width,height},colorScheme:theme });
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',message=>{ if(message.type()==='error') errors.push(message.text()); });
      const label=`${engineName}-${width}x${height}-${theme}`;
      if (width===390 && theme==='light') {
        await mount(page,baseline,theme);
        const before=await geometry(page);
        assert.equal(before.bannerCount,2,'baseline must reproduce duplicate banners');
        assert.equal(before.xHits[0],false,'baseline must reproduce X center interception');
        if(output) await page.screenshot({path:path.join(output,`${label}-before.png`)});
        results.push({label,stage:'before',...before});
      }
      await mount(page,current,theme);
      // Re-execution and an old deployment banner arriving after runtime must remain single.
      await page.addScriptTag({content:current});
      await page.evaluate(html=>document.body.insertAdjacentHTML('afterbegin',html),injectedBanner);
      await page.waitForTimeout(50);
      const after=await geometry(page);
      assert.equal(after.bannerCount,1,`${label} single banner`);
      assert(after.bannerText.includes('서울 개발 · 내부 QA · 실제 결제·푸시 차단'));
      assert(after.xHits.every(Boolean),`${label} X five-point hit-test ${JSON.stringify(after)}`);
      assert(after.x.width>=44 && after.x.height>=44,`${label} X touch size`);
      assert(after.headerVisible && !after.overflow,`${label} header/overflow`);
      if(width<=1024) assert(after.header.y<=after.banner.bottom+30,`${label} no artificial tablet height cap`);
      if(output) await page.screenshot({path:path.join(output,`${label}-after.png`)});
      await fixture.assertLayout(page,label);
      assert((await geometry(page)).xHits.every(Boolean),`${label} X after scroll`);
      if(output) await page.screenshot({path:path.join(output,`${label}-scrolled.png`)});
      await page.locator('.lesson-detail-sheet-close').click();
      await fixture.closeAndAssert(page,label);
      // Existing modal lifecycle, no new Back or close implementation.
      await page.evaluate(()=>window.__fixture.open());
      await page.locator('.lesson-completion-close').click();
      await page.locator('#lessonEditModal').waitFor({state:'hidden'});
      await page.waitForFunction(() => !history.state?.tennisNoteModal);
      await page.evaluate(()=>window.__fixture.open());
      await page.locator('#lessonEditModal').waitFor({state:'visible'});
      await page.waitForFunction(() => history.state?.tennisNoteModal === 'lessonEditModal');
      await page.goBack();
      await page.locator('#lessonEditModal').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(() => Boolean(window.__fixture)),true,`${label} Back must stay in app`);
      for(const surface of ['member','coach','member','coach']) {
        await page.evaluate(surface=>document.documentElement.dataset.tennisnoteSurface=surface,surface);
        await page.addScriptTag({content:current});
        assert.equal(await page.locator('[data-tennisnote-internal-qa-banner]').count(),1);
      }
      assert.equal((await page.evaluate(()=>window.__fixture.result())).rpc,0);
      assert.deepEqual(errors,[],`${label} page errors`);
      results.push({label,stage:'after',...after});
      await context.close();
    }
    // Production must not gain a banner, modal offset, or changed geometry.
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    await mount(page,baseline,'light','production');
    const productionBefore=await geometry(page);
    await mount(page,current,'light','production');
    assert.deepEqual(await geometry(page),productionBefore);
    assert.equal(await page.locator('[data-tennisnote-dev-qa-layout]').count(),0);
    results.push({label:engineName,stage:'production-parity',pass:true});
    // No Pages injection in native QA: runtime alone still renders one banner.
    await mount(page,current,'light','development',false);
    const nativeQa=await geometry(page);
    assert.equal(nativeQa.bannerCount,1);
    assert(nativeQa.xHits.every(Boolean) && nativeQa.headerVisible);
    results.push({label:engineName,stage:'development-without-build-banner',pass:true});
    await context.close();
  } finally { await browser.close(); }
}

(async()=>{
  await fixture.startFixtureServer();
  for(const engine of ['chromium','webkit']) await run(engine);
  if(output) fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({status:'PASS',responsiveCases:16,baselineReproductions:2,productionParity:2,developmentWithoutBuildBanner:2,DB:0,RPC:0}));
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;}).finally(()=>fixture.stopFixtureServer());
