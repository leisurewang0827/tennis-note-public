import assert from 'node:assert/strict';
export function validateCompletion(r,{source,runId,manifest,now}){
 assert.equal(r.status,'ADMIN_V6_COMPLETED');assert.equal(r.source,source);assert.match(source,/^[a-f0-9]{40}$/);assert.equal(String(r.runId),String(runId));assert.match(String(runId),/^\d+$/);assert.equal(r.attempt,1);assert.equal(r.manifest,manifest);assert.match(manifest,/^[a-f0-9]{64}$/);assert.match(r.deploymentId,/^[a-f0-9-]{36}$/);assert.equal(r.prior,'bcc6b9cc-a6be-451a-b4b5-f39323d59f77');assert.notEqual(r.deploymentId,r.prior);assert.equal(r.responses,356);assert.equal(r.mismatch,0);assert.equal(r.dbWrites,0);const age=now-Date.parse(r.createdAt);assert(Number.isFinite(age)&&age>=0&&age<=300000);return true;
}
