import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
const {composeSurface}=await import(existsSync(new URL('./overlay.mjs',import.meta.url))?'./overlay.mjs':'./v17-overlay.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');let checks=0;
for(const [surface,count] of [['admin',182],['coach',253]]){
 const files=Object.fromEntries(Array.from({length:count},(_,i)=>['file'+i,Buffer.from('before'+i)])),next=Buffer.from('next'),prior=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,sha(v)])),desired={...prior,file0:sha(next)};
 const plan={surfaces:{[surface]:{count,prior,desired,changed:{file0:{previousSha256:prior.file0,candidateSha256:desired.file0}}}}};
 const result=composeSurface({surface,manifest:plan,priorFiles:files,candidates:{file0:next}});assert.equal(result.file0.toString(),'next');assert.equal(files.file0.toString(),'before0');checks++;
 assert.throws(()=>composeSurface({surface,manifest:plan,priorFiles:{...files,file1:Buffer.from('tampered')},candidates:{file0:next}}),/PRIOR_ASSET_MISMATCH/);checks++;
 assert.throws(()=>composeSurface({surface,manifest:plan,priorFiles:files,candidates:{file0:Buffer.from('tampered')}}),/CANDIDATE_HASH_MISMATCH/);checks++;
 assert.throws(()=>composeSurface({surface,manifest:plan,priorFiles:files,candidates:{file0:next,extra:next}}),/CANDIDATE_PATH_MISMATCH/);checks++;
 assert.throws(()=>composeSurface({surface,manifest:plan,priorFiles:{...files,'../outside':next},candidates:{file0:next}}),/UNSAFE_PATH/);checks++;
}
console.log(JSON.stringify({status:'PASS_SYNTHETIC_OVERLAY_GUARDS',checks,network:0,deployments:0}));
