// 운영 환경 접합·새 2개 정적 파일·복구 연결만 검사한다. 기존 업무 검사는 반복하지 않는다.
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{join}from'node:path';
import{createPostreadPlan,classifyPostread}from'./postread-policy.mjs';
import{hash}from'./compose-web.mjs';
const here=new URL('./',import.meta.url),m=JSON.parse(readFileSync(new URL('manifest.json',here)));
assert.equal(m.project,'cnympiwrwgouuvhaivbc');assert.equal(m.guardHash,'944facf8eb4a1f6cdf3890ecb8a8cd6e3500ad834142e66ce7adad5c8c5a83f9');
for(const h of Object.values(m.target))assert.match(h,/^[a-f0-9]{64}$/);
for(const[p,h]of Object.entries(m.payload))assert.equal(hash(readFileSync(new URL(p,here))),h,p);
const js=readFileSync(new URL('r4-finance-admin-control.js',here),'utf8'),dev=readFileSync('release-sources/r4-finance-admin-dev/r4-finance-admin-control.js','utf8');
assert.equal(js.slice(js.indexOf('  const el =')),dev.slice(dev.indexOf('  const el =')),'Verified UI handlers must be identical');
assert(js.includes('config?.environment !== "production"')&&!js.includes('udjmiezroipctytmztwz')&&!js.includes('tennisnote-admin-dev.pages.dev'));
for(const p of ['runner.mjs','operator.mjs','gate.mjs','compose-web.mjs','postread-policy.mjs','r4-finance-admin-control.js'])execFileSync(process.execPath,['--check',new URL(p,here).pathname.replace(/^\/([A-Za-z]:)/,'$1')]);
if(process.argv.includes('--composed')){
 const base=join(process.env.RUNNER_TEMP,'candidate'),seal=JSON.parse(readFileSync(join(base,'seal.json')));
 const plan=createPostreadPlan(seal,readFileSync(join(base,'site/_redirects')));assert.equal(plan.paths.length,181);assert.equal(plan.redirects.length,40);
 for(const p of ['r4-finance-admin-control.js','r4-finance-admin-control.css'])assert.equal(await classifyPostread(plan,p,new Response(readFileSync(join(base,'site',p)),{status:200})),'static');
}
console.log(JSON.stringify({newProductionConnection:'PASS',uiHandlersUnchanged:true,newStaticFiles:2,financialTestsRepeated:false}));
