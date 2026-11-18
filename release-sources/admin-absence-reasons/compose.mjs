import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {build as previous,sha} from '../admin-dashboard-task-detail/compose.mjs';
export {sha};
const bytes=readFileSync(new URL('seal.json',import.meta.url));
assert.equal(sha(bytes),'3da1005eaf57b3949dde142cf480b056145d912f8c425b7c96b84c212aedc2ca');
const seal=JSON.parse(bytes),payload=JSON.parse(readFileSync(new URL('payload.json',import.meta.url)));
export const baseline=seal.baseline;
export function build(base,out) {
  const p=previous(base,out+'-prior');
  assert.deepEqual(p.hashes,baseline);
  const files={...p.files};
  assert.deepEqual(Object.keys(payload).sort(),['index.html','schedule-v2-admin.js']);
  for(const [name,encoded] of Object.entries(payload)) {
    const b=Buffer.from(encoded,'base64');assert.equal(b.toString('base64'),encoded);files[name]=b;
  }
  const hashes=Object.fromEntries(Object.entries(files).map(([name,b])=>[name,sha(b)]));
  assert.deepEqual(hashes,seal.candidate);
  assert.deepEqual(Object.keys(hashes).filter(n=>hashes[n]!==baseline[n]).sort(),['index.html','schedule-v2-admin.js']);
  const before=p.files['index.html'].toString(), refs=before.split('"').filter(v=>v.startsWith('./schedule-v2-admin.js?v='));
  assert.deepEqual(refs,['./schedule-v2-admin.js?v='+baseline['schedule-v2-admin.js'].slice(0,16)]);
  assert.equal(files['index.html'].toString(),before.replace(refs[0],'./schedule-v2-admin.js?v='+hashes['schedule-v2-admin.js'].slice(0,16)));
  for(const [name,b] of Object.entries(files)){const f=join(out,name);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b,{flag:'wx'});}
  return {files,hashes};
}
