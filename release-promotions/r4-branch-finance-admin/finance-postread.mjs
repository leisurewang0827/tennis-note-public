// Post-publish readback only. Never publishes or grants a write capability.
import {createHash} from 'node:crypto';
import {expected} from './protected-finance-admission.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Object.assign(new Error(s),{code:s});};
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const origin='https://tennisnote-admin.pages.dev';
export function canonicalId(value){
 const p=value?.result,d=p?.canonical_deployment;
 if(value?.success!==true||p?.name!=='tennisnote-admin'||p.production_branch!=='main'||
   !uuid.test(d?.id||'')||d.id===expected.recovery||d.environment!=='production'||
   d.latest_stage?.status!=='success'||d.deployment_trigger?.metadata?.branch!=='main'||
   d.deployment_trigger?.metadata?.commit_hash!==expected.source)fail('PUBLISHED_CANONICAL_MISMATCH');
 return d.id;
}
export function route(name){
 if(typeof name!=='string'||name.startsWith('/')||name.includes('\\'))fail('ASSET_PATH_DENIED');
 if(['_headers','_redirects','_worker.js'].includes(name))return null;
 const parts=name.split('/');if(parts.some(x=>!x||x==='.'||x==='..'))fail('ASSET_PATH_DENIED');
 if(parts.at(-1)==='index.html')return '/'+(parts.length>1?parts.slice(0,-1).map(encodeURIComponent).join('/')+'/':'');
 if(parts.at(-1).endsWith('.html'))parts[parts.length-1]=parts.at(-1).slice(0,-5);
 return '/'+parts.map(encodeURIComponent).join('/');
}
// Generic verifier exposes no write method and is injectable solely to test routing.
export async function readRoutes(assets,hosts,read){
 let normal=0,redirected=0,controls=0;
 for(const [name,digest] of Object.entries(assets)){
  if(!/^[0-9a-f]{64}$/.test(digest))fail('SEAL_SCOPE');
  const path=route(name);if(path===null){controls++;continue;}
  for(const host of hosts){
   const response=await read(host+path);
   if(name.startsWith('tennis-note-member-app/')){
    if(response.status!==302||response.headers.get('location')!=='https://tennisnote-app.pages.dev/')fail('REDIRECT_MISMATCH');
   }else{
    if(response.status!==200)fail('READBACK_FAILED');
    if(sha(Buffer.from(await response.arrayBuffer()))!==digest)fail('PUBLISHED_ASSET_MISMATCH');
   }
  }
  if(name.startsWith('tennis-note-member-app/'))redirected++;else normal++;
 }
 return {normal,redirected,controls};
}
export async function verifyPublished({projectBefore,projectAfter,sealBytes,read}){
 if(sha(sealBytes)!==expected.seal)fail('SEAL_MISMATCH');
 const seal=JSON.parse(sealBytes);
 if(seal.candidateCount!==181||Object.keys(seal.assets||{}).length!==181||seal.recoveryCandidate!==expected.recovery)fail('SEAL_SCOPE');
 const id=canonicalId(projectBefore);
 const hosts=[origin,`https://${id.slice(0,8)}.tennisnote-admin.pages.dev`];
 const counts=await readRoutes(seal.assets,hosts,read);
 if(counts.normal+counts.redirected+counts.controls!==181||counts.controls!==3)fail('PUBLIC_ASSET_SCOPE');
 if(canonicalId(await projectAfter())!==id)fail('CANONICAL_DRIFT');
 return {status:'PUBLISHED_ASSETS_VERIFIED',id,...counts};
}
