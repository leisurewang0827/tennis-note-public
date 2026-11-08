import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {compose,composeSuccessor} from './r4_ui_finish_release.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const policy=JSON.parse(readFileSync('release-sources/r4-ui-finish/policy.json'));
const css=readFileSync('release-sources/r4-ui-finish/r4-ui-finish.css');
const js=readFileSync('release-sources/r4-ui-finish/r4-ui-finish.js');
if(process.argv.includes('--new-keyboard')){
 const base=process.env.R4_PREVIOUS_COACH_DIR,dependency=process.env.R4_NODE_DEPENDENCIES;if(!base||!dependency)throw Error('KEYBOARD_FIXTURE_AND_DEPENDENCIES_REQUIRED');
 const {chromium,webkit}=createRequire(resolve(dependency,'package.json'))('playwright');
 const sheet=['tennis-note-coach-app/styles.css','shared/tennisnote-ui-foundation.css','tennis-note-coach-app/r4-scoped-workspace.css'].map(x=>readFileSync(resolve(base,x),'utf8')).join('\n')+'\n'+css;
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){const browser=await engine.launch({headless:true});try{const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});try{const page=await context.newPage();await page.setContent(`<style>${sheet}</style><section id="r4ScopedCoachApp"><label>내 지점<select aria-label="내 지점"><option value="a">합성 지점 A</option><option value="b">합성 지점 B</option></select></label></section>`);await page.evaluate(()=>{window.__changes=0;document.querySelector('select').addEventListener('change',()=>window.__changes++);});const select=page.locator('select');await select.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await select.inputValue(),'b',`${name} keyboard value`);assert.equal(await page.evaluate(()=>window.__changes),1,`${name} keyboard change`);}finally{await context.close();}}finally{await browser.close();}}
 console.log('R4_UI_SELECT_KEYBOARD_2_PASS');
}else{
assert.equal(hash(css),policy.sourceSha256['r4-ui-finish.css']);
assert.equal(hash(js),policy.sourceSha256['r4-ui-finish.js']);
const adminIndex=Buffer.from('<head></head><form id="r4FirstLessonSetup"></form>');
const coachIndex=Buffer.from('<head></head><script src="r4-scoped-workspace.js"></script>');
const coachWorker=Buffer.from('const CACHE_NAME = "prior";\nconst APP_SHELL = [\n];');
const sample={adminIndex,coachIndex,coachWorker,css,js};
const result=compose(sample);
const successor=composeSuccessor({adminIndex:result.admin,coachIndex:result.coach,coachWorker:result.worker,css:Buffer.from(css.toString()+'\n/* synthetic */'),js,oldToken:result.token});
assert.notEqual(successor.token,result.token);
assert.equal(successor.admin.toString().split(result.token).length,1);
assert.throws(()=>composeSuccessor({adminIndex:Buffer.from('invalid'),coachIndex:result.coach,coachWorker:result.worker,css,js,oldToken:result.token}),/UNCHANGED_TOKEN|PREVIOUS_TOKEN_DRIFT/);
assert.equal(result.admin.toString().split('r4-ui-finish.js').length,2);
assert.equal(result.coach.toString().split('r4-ui-finish.js').length,2);
assert.equal(result.worker.toString().split('r4-ui-finish.js').length,2);
assert.match(result.worker.toString(),/prior-ui-[0-9a-f]{16}/);
assert.throws(()=>compose({...sample,adminIndex:Buffer.from('<head></head>')}),/ADMIN_FORM_DRIFT/);
assert.throws(()=>compose({...sample,coachIndex:Buffer.from('<head></head>')}),/COACH_ENTRY_DRIFT/);
assert.throws(()=>compose({...sample,coachWorker:Buffer.from('wrong')}),/SW_SHELL_DRIFT/);
assert.throws(()=>compose({...sample,adminIndex:Buffer.from('<head></head><form id="r4FirstLessonSetup"></form>r4-ui-finish.js')}),/ALREADY_INSTALLED/);
assert.equal(policy.environment,'development');
assert.equal(policy.admin.project,'tennisnote-admin-dev');
assert.equal(policy.coach.project,'tennisnote-app-dev');
assert.match(css.toString(),/#r4ScopedCoachApp select\{[^}]*-webkit-appearance:none;appearance:none;/);
assert.match(css.toString(),/#r4ScopedCoachApp select option\{background-color:var\(--paper\);color:var\(--ink\)\}/);
if(process.argv.includes('--new-contrast')){
 const base=process.env.R4_PREVIOUS_COACH_DIR,dependency=process.env.R4_NODE_DEPENDENCIES;if(!base||!dependency)throw Error('CONTRAST_FIXTURE_AND_DEPENDENCIES_REQUIRED');
 const req=createRequire(resolve(dependency,'package.json')),{chromium,webkit}=req('playwright'),{PNG}=req('pngjs');
 const sheet=['tennis-note-coach-app/styles.css','shared/tennisnote-ui-foundation.css','tennis-note-coach-app/r4-scoped-workspace.css'].map(x=>readFileSync(resolve(base,x),'utf8')).join('\n')+'\n'+css;
 const lum=c=>{const v=c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){const browser=await engine.launch({headless:true});try{for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});try{const page=await context.newPage();await page.setContent(`<style>${sheet}</style><section id="r4ScopedCoachApp"><label>내 지점<select aria-label="내 지점"><option value="a">합성 지점 A</option><option value="b">합성 지점 B</option></select></label></section>`);
  const select=page.locator('select'),s=await select.evaluate(e=>({fill:getComputedStyle(e).webkitTextFillColor,font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height}));const png=PNG.sync.read(await select.screenshot());const i=(8*png.width+8)*4,bg=[...png.data.subarray(i,i+3)],fg=(s.fill.match(/\d+/g)||[]).map(Number).slice(0,3),a=lum(bg),b=lum(fg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${name}/${theme} raster contrast`);assert.ok(s.font>=16&&s.height>=44);await select.selectOption('b');assert.equal(await select.inputValue(),'b');
 }finally{await context.close();}}
 }finally{await browser.close();}}
 console.log('R4_UI_SELECT_RASTER_CONTRAST_PASS');
}
console.log('R4 UI release delta: synthetic transform and fail-closed pins PASS');
}
