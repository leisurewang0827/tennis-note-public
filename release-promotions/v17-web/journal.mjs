import assert from 'node:assert/strict';
import {writeFileSync,renameSync} from 'node:fs';
const allowed=['name','host','path','status','actual','expected','previous','classification','phase','round','error','sha256','expectedSha256','previousSha256','elapsedMs'];
export function safeProof(error){const source=Array.isArray(error?.readiness?.proof)?error.readiness.proof:Array.isArray(error?.proof)?error.proof:[];return source.slice(0,2000).map(x=>Object.fromEntries(allowed.filter(k=>Object.hasOwn(x||{},k)).flatMap(k=>{const v=x[k];return (v===null||['string','number','boolean'].includes(typeof v))?[[k,typeof v==='string'?v.slice(0,300):v]]:[]})));}
export function createJournal(file,{surface,execution,source}){
 assert.ok(['admin','coach'].includes(surface));assert.match(execution,/^[a-f0-9]{40}$/);assert.match(source,/^[a-f0-9]{40}$/);
 const state={status:'IN_PROGRESS',phase:'PRECHECK',surface,execution,source,dbWrites:0};let n=0;
 writeFileSync(file,JSON.stringify(state)+'\n',{flag:'wx'});
 function persist(){const tmp=file+'.next-'+(++n);writeFileSync(tmp,JSON.stringify(state)+'\n',{flag:'wx'});renameSync(tmp,file);}
 return Object.freeze({
  phase(value,extra={}){assert.match(value,/^[A-Z_]+$/);Object.assign(state,{phase:value},extra);persist();},
  success(extra){Object.assign(state,extra,{status:'V17_SURFACE_PASS',phase:'COMPLETE'});persist();},
  failure(error){if(state.status!=='ROLLED_BACK')state.status='FAILED_OR_UNKNOWN';state.reason=String(error?.message||'UNKNOWN').slice(0,160);const proof=safeProof(error);if(proof.length)state.proof=proof;persist();},
  rolledBack(extra,recoveryProof){const proof=safeProof({proof:recoveryProof});assert.ok(proof.length>0,'RECOVERY_PROOF_REQUIRED');Object.assign(state,extra,{status:'ROLLED_BACK',phase:'ROLLBACK_VERIFIED',recoveryProof:proof});persist();}
 });
}
