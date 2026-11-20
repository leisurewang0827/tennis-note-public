// Pure overlay, caller must verify the source Git tree and GitHub artifact first.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyExtracted} from './v16-previous-artifact.mjs';
import {PRODUCT} from './v16-git-chain.mjs';
import {writeFileSync,renameSync} from 'node:fs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const routes=Object.freeze({
 admin:{'actions/settings.js':'public/app/admin/actions/settings.js','data/common.js':'public/app/admin/data/common.js','events/common.js':'public/app/admin/events/common.js','index.html':'public/app/admin/index.html','shared/tennisnote-release-updater.js':'public/app/shared/tennisnote-release-updater.js'},
 coach:{'index.html':'public/app/tennis-note-member-app/index.html','service-worker.js':'public/app/tennis-note-member-app/service-worker.js','tennis-note-coach-app/index.html':'public/app/tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js':'public/app/tennis-note-coach-app/service-worker.js','shared/tennisnote-release-updater.js':'public/app/shared/tennisnote-release-updater.js'}
});
export function compose({surface,seal,files,priorManifestBytes,v16ManifestBytes,sourceBytes}){
 assert(['admin','coach'].includes(surface));verifyExtracted({surface,seal,files,priorManifestBytes});
 assert(Buffer.isBuffer(v16ManifestBytes));assert.equal(hash(v16ManifestBytes),'4e47f8b98515c3a0c8845755afbe78245a9294502bf92b7440908e2f47737462');
 const entries=JSON.parse(v16ManifestBytes).files, expected=Object.fromEntries(entries.map(x=>[x.path,x.sha256]));
 const needed=[...new Set(Object.values(routes[surface]))].sort();assert.deepEqual(Object.keys(sourceBytes).sort(),needed);
 for(const name of needed){assert(Buffer.isBuffer(sourceBytes[name]));assert.equal(hash(sourceBytes[name]),expected[name]);}
 const result={...files};for(const [dest,src] of Object.entries(routes[surface])){assert(Object.hasOwn(files,dest),'MISSING_EXISTING_ASSET');result[dest]=sourceBytes[src];}
 const changed=Object.keys(result).filter(n=>!result[n].equals(files[n])).sort();assert.deepEqual(changed,Object.keys(routes[surface]).sort());
 return {files:result,hashes:Object.fromEntries(Object.entries(result).map(([n,b])=>[n,hash(b)])),changed};
}
// Independently derive the publish target from pinned historical manifest and
// the compile-time S blob hashes, never from the uploaded artifact seal.
export function expectedDevMap(surface,priorManifestBytes){
 assert(['admin','coach'].includes(surface));assert(Buffer.isBuffer(priorManifestBytes));
 assert.equal(hash(priorManifestBytes),'975e98caa79f6b79c91c9b5ef677f57c569c2a545d01fc20a8dfc44300852c80');
 const p=JSON.parse(priorManifestBytes.toString('utf8')).projects[surface],result={...p.baseline,...p.changed};
 for(const [dest,src] of Object.entries(routes[surface])){assert(Object.hasOwn(result,dest));assert(PRODUCT[src.slice(7)]);result[dest]=PRODUCT[src.slice(7)];}
 result['shared/config.local.js']='2876392b257795e386dacf06b07a3ce568dcdaa27357d5e91961564e697cc3de';
 if(surface==='admin')result['_redirects']='29cdc87d91a19f8fe58d011f57e62016a04bcb41329049a4f3b222f6e87b4ac6';
 assert.equal(Object.keys(result).length,surface==='admin'?182:253);
 return result;
}
export function createReceiptJournal(path,seed){
 const receipt={...seed,status:'PENDING',phase:'BEFORE_POST',surfaces:{coach:{status:'NOT_STARTED'},admin:{status:'NOT_STARTED'}}};
 writeFileSync(path,JSON.stringify(receipt)+'\n',{flag:'wx'});
 let version=0;
 function persist(){const tmp=path+'.next-'+(++version);writeFileSync(tmp,JSON.stringify(receipt)+'\n',{flag:'wx'});renameSync(tmp,path)}
 return Object.freeze({
  start(mode,previous){receipt.phase='POST_'+mode;receipt.surfaces[mode]={status:'POST_STARTED_OUTCOME_UNKNOWN',previousDeploymentId:previous};persist()},
  observed(mode,previous,id){receipt.phase='READBACK_'+mode;receipt.surfaces[mode]={status:'DEPLOYED_READBACK_PENDING',previousDeploymentId:previous,deploymentId:id};persist()},
  pass(mode,previous,id){receipt.surfaces[mode]={status:'READBACK_PASS',previousDeploymentId:previous,deploymentId:id,hashesMatch:true,runtimeVerified:true};persist()},
  complete(){assert.equal(receipt.surfaces.coach.status,'READBACK_PASS');assert.equal(receipt.surfaces.admin.status,'READBACK_PASS');receipt.status='SUCCESS';receipt.phase='COMPLETE';persist()},
  fail(){receipt.status='FAILED_OR_UNKNOWN';receipt.failure='DIAGNOSE_WITHOUT_RETRY';persist()}
 });
}
export {routes};
