import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha,walk,build as hideBuild} from '../admin-private-catalog-hide/compose.mjs';
export {sha};
const here=dirname(fileURLToPath(import.meta.url)),seal=JSON.parse(readFileSync(join(here,'seal.json')));
export const baseline=seal.baseline;
export function compose(files){
 assert.deepEqual(Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)])),baseline,'BASELINE_DRIFT');
 const next={...files},old="${schedules.length ? ` · ${escapeHtml(schedules.join(\" / \"))}` : \" · 시간 선택 필요\"}",replacement="${memberManagementProductIsCoupon(product) ? \" · 쿠폰 예약제로 이용\" : schedules.length ? ` · ${escapeHtml(schedules.join(\" / \"))}` : \" · 시간 선택 필요\"}";
 const member=next['forms/member.js'].toString();assert.equal(member.split(old).length,2);
 next['forms/member.js']=Buffer.from(member.replace(old,replacement));
 const html=next['index.html'].toString(),script='./forms/member.js?v=1.0.566';assert.equal(html.split(script).length,2);
 next['index.html']=Buffer.from(html.replace(script,'./forms/member.js?v='+sha(next['forms/member.js']).slice(0,16)));
 const hashes=Object.fromEntries(Object.entries(next).map(([p,b])=>[p,sha(b)]));
 assert.deepEqual(hashes,seal.candidate,'CANDIDATE_DRIFT');
 assert.deepEqual(Object.keys(hashes).filter(p=>hashes[p]!==baseline[p]).sort(),['forms/member.js','index.html']);return {files:next,hashes};
}
export function build(base,out){const previous=hideBuild(base,out+'-prior'),result=compose(previous.files);for(const [p,b]of Object.entries(result.files)){const f=join(out,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b);}assert.deepEqual(Object.fromEntries(Object.entries(walk(out)).map(([p,b])=>[p,sha(b)])),result.hashes);return result;}
