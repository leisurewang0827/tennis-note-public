import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {Script} from 'node:vm';
import {build as previous,sha} from '../admin-excel-schedule-count/compose.mjs';
export {sha};
const bytes=readFileSync(new URL('seal.json',import.meta.url));
assert.equal(sha(bytes),'d6c9844e3b2d81cca5cdbae9cb840caea6f9b7ddbadba27b0af6bad83aa48dea');
const seal=JSON.parse(bytes), payload=JSON.parse(readFileSync(new URL('payload.json',import.meta.url)));
const excel='shared/tennisnote-single-sheet-preview-ui.js';
export const baseline=seal.baseline;
export function build(base,out){
 const p=previous(base,out+'-prior');
 assert.deepEqual(p.hashes,baseline);
 assert.deepEqual(Object.keys(payload).sort(),["index.html","styles.css","views/settings.js"]);
 const files={...p.files};
 for(const [name,encoded] of Object.entries(payload)){
  const b=Buffer.from(encoded,'base64');assert.equal(b.toString('base64'),encoded);files[name]=b;
 }
 const hashes=Object.fromEntries(Object.entries(files).map(([name,b])=>[name,sha(b)]));
 assert.deepEqual(hashes,seal.candidate);
 assert.equal(Object.keys(hashes).length,181);
 assert.deepEqual(Object.keys(hashes).filter(n=>hashes[n]!==baseline[n]).sort(),seal.changed);
 assert.equal(hashes[excel],seal.preservedExcel.sha);
 assert.ok(files['index.html'].toString().includes(seal.preservedExcel.ref));
 let expected=p.files['index.html'].toString();
 for(const n of ['styles.css','views/settings.js']) {
  const ref='./'+n+'?v=';
  const refs=expected.split('"').filter(v=>v.startsWith(ref));
  assert.equal(refs.length,1,n);
  expected=expected.replace(refs[0],ref+hashes[n].slice(0,16));
 }
 assert.equal(files['index.html'].toString(),expected);
 new Script(files['views/settings.js'].toString());
 for(const [name,b] of Object.entries(files)){const f=join(out,name);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,b,{flag:'wx'});}
 return {files,hashes};
}
