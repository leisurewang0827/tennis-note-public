import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {Script} from 'node:vm';
import {build as prior,sha} from '../admin-v2-absence-makeup/compose.mjs';
export {sha};
const raw=readFileSync(new URL('seal.json',import.meta.url));
assert.equal(sha(raw),'b725cad51faea856e851c0e092916b58621df5ebb5e9acf006636957c7f6d61c');
const seal=JSON.parse(raw), payload=JSON.parse(readFileSync(new URL('payload.json',import.meta.url)));
const ui="shared/tennisnote-single-sheet-preview-ui.js";
export const baseline=seal.baseline;
export function build(base,out) {
  const p=prior(base,out+'-prior');
  assert.deepEqual(p.hashes,baseline);
  assert.deepEqual(Object.keys(payload).sort(),seal.changed);
  const files={...p.files};
  for(const [name,encoded] of Object.entries(payload)) {
    const b=Buffer.from(encoded,'base64');
    assert.equal(b.toString('base64'),encoded);
    files[name]=b;
  }
  const hashes=Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,sha(bytes)]));
  assert.deepEqual(hashes,seal.candidate);
  assert.equal(Object.keys(hashes).length,181);
  assert.deepEqual(Object.keys(hashes).filter(n=>hashes[n]!==baseline[n]).sort(),seal.changed);
  assert.equal(files['index.html'].toString(),p.files['index.html'].toString().replace(ui+'?v='+baseline[ui].slice(0,16),ui+'?v='+hashes[ui].slice(0,16)));
  const script=files[ui].toString();
  new Script(script);
  assert(!/devFixtureOnly|tn_dev_excel_fixture_preview_v1/.test(script));
  for(const boundary of ['/^/','    async function run(file)']) {
    const before=p.files[ui].toString().replaceAll('\r\n','\n');
    const after=script.replaceAll('\r\n','\n');
    const mark=boundary==='/^/'?'    const rowPlanText':boundary;
    assert(before.includes(mark)&&after.includes(mark));
    assert.equal(boundary==='/^/'?after.split(mark)[0]:after.split(mark)[1],boundary==='/^/'?before.split(mark)[0]:before.split(mark)[1]);
  }
  for(const [name,bytes] of Object.entries(files)) {
    const f=join(out,name); mkdirSync(dirname(f),{recursive:true}); writeFileSync(f,bytes,{flag:'wx'});
  }
  return {files,hashes};
}
