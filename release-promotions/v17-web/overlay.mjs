import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
function safe(name){assert.equal(typeof name,'string');assert.ok(name&&!name.startsWith('/')&&!name.includes('\\')&&!/[?#]/.test(name)&&!name.split('/').some(x=>!x||x==='.'||x==='..'),'UNSAFE_PATH');}
function mapBytes(files){const result={};for(const [name,bytes] of Object.entries(files)){safe(name);assert.ok(Buffer.isBuffer(bytes),'NOT_BYTES');result[name]=digest(bytes);}return result;}
function sorted(x){return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));}
export function composeSurface({surface,manifest,priorFiles,candidates}){
 assert.ok(surface==='admin'||surface==='coach');const plan=manifest.surfaces[surface];assert.ok(plan);assert.equal(plan.count,surface==='admin'?182:253);
 assert.deepEqual(sorted(mapBytes(priorFiles)),sorted(plan.prior),'PRIOR_ASSET_MISMATCH');
 assert.deepEqual(Object.keys(candidates).sort(),Object.keys(plan.changed).sort(),'CANDIDATE_PATH_MISMATCH');
 const result={...priorFiles};for(const [dest,value] of Object.entries(candidates)){safe(dest);assert.ok(Buffer.isBuffer(value));assert.equal(digest(value),plan.changed[dest].candidateSha256,'CANDIDATE_HASH_MISMATCH');assert.equal(digest(priorFiles[dest]),plan.changed[dest].previousSha256,'PREVIOUS_HASH_MISMATCH');result[dest]=value;}
 assert.deepEqual(sorted(mapBytes(result)),sorted(plan.desired),'RESULT_ASSET_MISMATCH');return result;
}
