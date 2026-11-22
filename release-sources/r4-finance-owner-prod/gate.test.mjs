import test from 'node:test';import assert from 'node:assert/strict';
import{validateOffStatus,offDescription,validateReview,rollbackAllowed,contextName,environmentId,reviewerId}from'./gate.mjs';
const sha='a'.repeat(40),sqlHash='b'.repeat(64),now=Date.now(),run=45099999999;
const params={sha,sqlHash,run,now,createdAt:new Date(now-60000).toISOString()};
const row={sha,context:contextName,state:'success',creator:{id:reviewerId},description:offDescription(run,sqlHash),updated_at:new Date(now).toISOString()};
test('OFF evidence is exact SHA/run/SQL, designated actor and fresh',()=>{
 validateOffStatus(row,params);
 for(const x of [{sha:'c'.repeat(40)},{description:offDescription(run+1,sqlHash)},{creator:{id:1}},{state:'pending'},{updated_at:new Date(now-11*60000).toISOString()}])
 assert.throws(()=>validateOffStatus({...row,...x},params));
});
test('only this same-SHA protected review is admitted',()=>{
 const r={state:'approved',user:{id:reviewerId},environments:[{id:environmentId}],comment:'R4 FINANCE OWNER '+sha+' default-OFF DB and ADMIN only'};
 validateReview([r],sha);assert.throws(()=>validateReview([{...r,comment:'old approval'}],sha));
 assert.throws(()=>validateReview([{...r,user:{id:1}}],sha));
});
test('rollback never overwrites another publisher or unknown outcome',()=>{
 const d={id:'ours',deployment_trigger:{metadata:{commit_hash:sha,branch:'main'}}};
 assert(rollbackAllowed(d,'ours',sha));assert(!rollbackAllowed(d,'another',sha));assert(!rollbackAllowed(d,null,sha));
});

