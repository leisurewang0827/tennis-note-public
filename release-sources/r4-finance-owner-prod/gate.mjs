import assert from 'node:assert/strict';
export const repo='leisurewang0827/tennis-note-public';
export const branch='codex/tennisnote-r4-ui-finish-dev-20261108';
export const workflow='.github/workflows/r4-finance-owner-prod.yml';
export const environmentId=26219323796, reviewerId=294703475;
export const previous={id:'9704d39b-8c66-40e0-8b91-1bf6c02f4f6f',source:'2076381588b23c7e1b7432eadfc2d603ecb04838'};
export const contextName='tennisnote/r4-finance-owner-prod-off';
export function validateRun(r,sha,id){
 assert.equal(String(r.id),String(id));assert.equal(r.head_sha,sha);assert.equal(r.head_branch,branch);
 assert.equal(r.repository.full_name,repo);assert.equal(r.head_repository.full_name,repo);
 assert.equal(r.path,workflow);assert.equal(r.event,'push');assert.equal(r.run_attempt,1);
}
export function validateReview(rows,sha){
 assert(Array.isArray(rows));
 const scoped=rows.filter(x=>x.environments?.some(e=>e.id===environmentId));
 assert(scoped.length>=1&&scoped.length<=2);
 for(const a of scoped){
  assert.equal(a.state,'approved');assert.equal(a.user.id,reviewerId);
  assert.deepEqual(a.environments.map(x=>x.id),[environmentId]);
  assert.equal(a.comment,'R4 FINANCE OWNER '+sha+' default-OFF DB and ADMIN only');
 }
}
export function offDescription(run,sqlHash){
 assert.match(String(run),/^\d+$/);assert.match(sqlHash,/^[a-f0-9]{64}$/);
 return 'OFF0 '+run+' '+sqlHash;
}
export function validateOffStatus(s,{sha,run,sqlHash,createdAt,now=Date.now()}){
 assert.equal(s.sha,sha);assert.equal(s.context,contextName);assert.equal(s.state,'success');
 assert.equal(s.creator.id,reviewerId);assert.equal(s.description,offDescription(run,sqlHash));
 const at=Date.parse(s.updated_at);assert(Number.isFinite(at)&&at>=Date.parse(createdAt)&&at<=now&&now-at<=10*60000,'OFF_EVIDENCE_STALE');
}
export function deployment(d,{id=previous.id,source=previous.source}={}){
 assert.equal(d.id,id);assert.equal(d.environment,'production');assert.equal(d.latest_stage.status,'success');
 assert.equal(d.deployment_trigger.metadata.branch,'main');assert.equal(d.deployment_trigger.metadata.commit_hash,source);
}
export function rollbackAllowed(current,attempted,sha){
 return !!attempted&&current?.id===attempted&&current?.deployment_trigger?.metadata?.commit_hash===sha
  &&current?.deployment_trigger?.metadata?.branch==='main';
}

