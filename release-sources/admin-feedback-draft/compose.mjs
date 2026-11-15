import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {sha,walk,compose as hide,sealBytes} from '../admin-private-catalog-hide/compose.mjs';
import {compose as summary} from '../admin-coupon-summary/compose.mjs';
import {compose as scope} from '../admin-coupon-scope/compose.mjs';
import {patchAdminDraftSource} from './draft.mjs';
import {assertArtifact} from '../../release-promotions/r4-branch-finance-admin/protected-finance-admission.mjs';
export {sha};
export let baseline;
export const changes={
  'actions/common.js':'d7bb47a6e5c28a69f81626e001d380e015306907504c204248d47d45654db894',
  'index.html':'b8489432102dacb1f7cf385063e2aa958116c3ebf0f138c875e21ee34f64bda1',
  'schedule-v2-admin.js':'e63a7c5bb999743225cb0e3c3330c4facca9fc395399da4fa99f61bdd079f465',
  'shared/tennisnote-comment-draft.js':'be01c5d237d12374a23e0d5fe98d75c1b9dd1d6bbfccc2f0ae2f8cc92d41e6a0',
};
export function build(base,out){
  assertArtifact(base,sealBytes);
  const previous=scope(summary(hide(walk(join(base,'admin'))).files).files);
  const files=previous.files,next={...files};
  assert.equal(Object.keys(files).length,181);
  baseline=Object.freeze(previous.hashes);
  assert.equal(baseline['index.html'],'2a9a4abcc40023d0eb24e10449e2cee38e5ff931b5381a7d84b73533de032f27');
  let html=files['index.html'].toString('utf8');
  for(const [path,tag] of [
    ['shared/tennisnote-comment-draft.js','../shared/tennisnote-comment-draft.js?v=1.0.566'],
    ['actions/common.js','./actions/common.js?v=r4-first-workspace-97054ce0860a'],
    ['schedule-v2-admin.js','./schedule-v2-admin.js?v=schedule-v2-21'],
  ]){
    next[path]=Buffer.from(patchAdminDraftSource((path.startsWith('shared/')?'app/':'app/admin/')+path,files[path].toString('utf8')));
    assert.equal(html.split(tag).length,2);
    html=html.replace(tag,tag.split('?')[0]+'?v='+sha(next[path]).slice(0,16));
  }
  next['index.html']=Buffer.from(html);
  const hashes=Object.fromEntries(Object.entries(next).map(([p,b])=>[p,sha(b)]));
  const changed=Object.keys(hashes).filter(p=>hashes[p]!==baseline[p]).sort();
  assert.deepEqual(changed,Object.keys(changes).sort());
  for(const path of changed)assert.equal(hashes[path],changes[path],path);
  mkdirSync(out,{recursive:false});
  for(const [path,bytes] of Object.entries(next)){
    const target=join(out,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:'wx'});
  }
  assert.deepEqual(Object.fromEntries(Object.entries(walk(out)).map(([p,b])=>[p,sha(b)])),hashes);
  return {files:next,hashes};
}
