import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {build,compose,walk,baseline,moduleBytes,sha,moduleHash} from './compose.mjs';
import {preimage,review} from './publish.mjs';
const prior={success:true,result:{name:'tennisnote-admin',production_branch:'main',canonical_deployment:{id:'92f88a6b-2eba-4650-b1b0-e8c3f195f27d',environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{branch:'main',commit_hash:'680f7d481121801a83972811bee41496e392aaf4'}}}}};
preimage(prior);
for(const mutate of [x=>x.result.name='tennisnote-app',x=>x.result.canonical_deployment.id='00000000-0000-0000-0000-000000000000',x=>x.result.canonical_deployment.deployment_trigger.metadata.commit_hash='0'.repeat(40)]){
  const bad=structuredClone(prior);mutate(bad);assert.throws(()=>preimage(bad));
}
const approval={state:'approved',user:{id:294703475},environments:[{id:26219323796}],comment:'ADMIN-CATALOG-HIDE '+ 'a'.repeat(40)+' exact-two-assets no-db'};
review([approval],'a'.repeat(40));
assert.throws(()=>review([approval],'b'.repeat(40)));
assert.throws(()=>review([{...approval,state:'rejected'}],'a'.repeat(40)));
assert.throws(()=>review([{...approval,user:{id:0}}],'a'.repeat(40)));
assert.throws(()=>review([approval,approval],'a'.repeat(40)));
const denied=new Proxy({}, {get(){throw Error('DOM_OR_AUTH_ACCESS');}});
const window={fetch(){throw Error('NETWORK_ACCESS');},document:denied,localStorage:denied,sessionStorage:denied,addEventListener(){throw Error('EVENT_SIDE_EFFECT');}};
runInNewContext(moduleBytes.toString(),{window,document:denied});
for(const allowed of [true,false,true])await window.TennisNoteR4ScopedMemberCatalog.refresh({allowed,client:denied});
await window.TennisNoteR4ScopedMemberCatalog.refresh();
assert(Object.isFrozen(window.TennisNoteR4ScopedMemberCatalog));
assert.equal(sha(moduleBytes),moduleHash);
const base=process.argv[2],out=process.argv[3];
if(base&&out){
  const result=build(base,out),files=walk(join(base,'admin'));
  for(const p of Object.keys(baseline)){
    if(!['index.html','r4-scoped-member-catalog.js'].includes(p))assert(result.files[p].equals(files[p]),p);
  }
  assert.throws(()=>compose({...files,'index.html':Buffer.concat([files['index.html'],Buffer.from(' ')])}),/BASELINE_DRIFT/);
  const missing={...files};delete missing['release.json'];assert.throws(()=>compose(missing),/BASELINE_DRIFT/);
  assert.throws(()=>compose({...files,'unexpected.js':Buffer.from('')}),/BASELINE_DRIFT/);
}
console.log(JSON.stringify({status:'ADMIN_PRIVATE_CATALOG_HIDE_PASS',sideEffects:0,dbChanges:0}));
