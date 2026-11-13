// Read-only: identify a specific, sealed immutable byte mismatch. No write authority.
import {createHash} from 'node:crypto';
import {canonicalId,route,verifyPublished} from './finance-postread.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function classifyPostread({write,project,projectAfter,sealBytes,read,verify=verifyPublished}){
 const id=canonicalId(project),fixed=`https://${id.slice(0,8)}.tennisnote-admin.pages.dev`;
 if(write?.status!=='POST_RETURNED_READBACK_REQUIRED'||write.url!==fixed)throw Error('PUBLISH_ID_NOT_BOUND');
 const seal=JSON.parse(sealBytes),assets=seal.assets||{};
 const lookup=new Map();for(const [name,digest] of Object.entries(assets)){
  if(name.startsWith('tennis-note-member-app/'))continue;
  const path=route(name);if(path!==null)lookup.set(path,{name,digest});
 }
 let failed=null;
 const watched=async url=>{
  const response=await read(url),path=new URL(url).pathname,item=lookup.get(path);
  if(item&&response.status===200){
   const bytes=Buffer.from(await response.clone().arrayBuffer());
   if(sha(bytes)!==item.digest)failed=item;
  }
  return response;
 };
 try{return await verify({projectBefore:project,projectAfter,sealBytes,read:watched});}
 catch(e){
  if(e?.code!=='PUBLISHED_ASSET_MISMATCH'||!failed)return {status:'READBACK_UNVERIFIED_NO_RETRY',id};
  const path=route(failed.name);
  let response;try{response=await read(fixed+path);}catch{return {status:'READBACK_UNVERIFIED_NO_RETRY',id};}
  if(response.status!==200)return {status:'READBACK_UNVERIFIED_NO_RETRY',id};
  if(sha(Buffer.from(await response.arrayBuffer()))===failed.digest)return {status:'READBACK_UNVERIFIED_NO_RETRY',id};
  return {status:'IMMUTABLE_MISMATCH',id,asset:failed.name,expectedHash:failed.digest};
 }
}
