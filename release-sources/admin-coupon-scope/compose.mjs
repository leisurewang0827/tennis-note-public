import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha,walk} from '../admin-private-catalog-hide/compose.mjs';
import {build as hideBuild} from '../admin-coupon-summary/compose.mjs';
export {sha};
const here=dirname(fileURLToPath(import.meta.url)),seal=JSON.parse(readFileSync(join(here,'seal.json')));
export const baseline=seal.baseline;
export function compose(files){
 assert.deepEqual(Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)])),baseline,'BASELINE_DRIFT');
 const next={...files};
 for(const {old,replacement} of [{"old":"        ${couponProduct ? \"\" : `<option value=\"mixed\" ${scheduleScope === \"mixed\" ? \"selected\" : \"\"}>혼합</option>`}","replacement":"        <option value=\"mixed\" ${scheduleScope === \"mixed\" ? \"selected\" : \"\"}>혼합</option>"},{"old":"              ${memberManagementProductIsCoupon(currentProduct) ? \"\" : `<option value=\"mixed\" ${(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct)) === \"mixed\" ? \"selected\" : \"\"}>혼합</option>`}","replacement":"              <option value=\"mixed\" ${(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct)) === \"mixed\" ? \"selected\" : \"\"}>혼합</option>"}]){const text=next['views/common.js'].toString();assert.equal(text.split(old).length,2);next['views/common.js']=Buffer.from(text.replace(old,replacement));}
 const html=next['index.html'].toString(),script='./views/common.js?v=1.0.566';assert.equal(html.split(script).length,2);
 next['index.html']=Buffer.from(html.replace(script,'./views/common.js?v='+sha(next['views/common.js']).slice(0,16)));
 const hashes=Object.fromEntries(Object.entries(next).map(([p,b])=>[p,sha(b)]));
 assert.deepEqual(hashes,seal.candidate,'CANDIDATE_DRIFT');
 assert.deepEqual(Object.keys(hashes).filter(p=>hashes[p]!==baseline[p]).sort(),['index.html','views/common.js']);return {files:next,hashes};
}
export function build(base,out){const previous=hideBuild(base,out+'-prior'),result=compose(previous.files);for(const [p,b]of Object.entries(result.files)){const f=join(out,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b);}assert.deepEqual(Object.fromEntries(Object.entries(walk(out)).map(([p,b])=>[p,sha(b)])),result.hashes);return result;}
