import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executeAuthorized} from './admin-single-write-transport.mjs';
import {publicAssetRoute} from './first-issue-admin-promotion.mjs';
if(process.argv.includes('--pages-routes-only')){
 const seal=JSON.parse(readFileSync(process.argv[3]??'release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json','utf8'));
 const names=Object.keys(seal.assets), routes=names.map(publicAssetRoute).filter(x=>x!==null);
 assert.equal(names.length,180);assert.equal(routes.length,177);assert.equal(new Set(routes).size,177);
 assert.equal(publicAssetRoute('index.html'),'/');assert.equal(publicAssetRoute('terms.html'),'/terms');
 assert.equal(publicAssetRoute('tennis-note-legal/index.html'),'/tennis-note-legal/');
 assert.equal(publicAssetRoute('tennis-note-legal/terms.html'),'/tennis-note-legal/terms');
 for(const f of ['_headers','_redirects','_worker.js'])assert.equal(publicAssetRoute(f),null);
 for(const f of ['../outside','/index.html','a\\b','x//y'])assert.throws(()=>publicAssetRoute(f));
 console.log(JSON.stringify({bundleAssets:180,publicRoutes:177,controlFilesArchiveOnly:3,unsafeRoutesDenied:4,network:0}));
}else{
const code=readFileSync(new URL('./admin-single-write-transport.mjs',import.meta.url),'utf8');
assert.equal((code.match(/method:'POST'/g)||[]).length,1);
assert.ok(code.includes('PUBLISH_NO_RETRY')&&code.includes('ROLLBACK_NO_RETRY'));
assert.ok(code.includes('UNKNOWN_READBACK_REQUIRED_NO_RETRY'));
assert.ok(code.includes('tennisnote-admin/deployments/${PIN.recovery}/rollback'));
for(const action of ['publish','rollback'])await assert.rejects(executeAuthorized(action,{}),e=>e.code==='PROTECTED_JOB_REQUIRED');
await assert.rejects(executeAuthorized('other',{}),e=>e.code==='ACTION_DENIED');
console.log(JSON.stringify({unboundDenied:2,wrongActionDenied:1,network:0,dbWrites:0}));
}
