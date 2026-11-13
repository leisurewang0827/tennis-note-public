import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildCatalogReads, dbObserver, operationFor } from './r4-off-only-protected-entry.mjs';
import { classifyPages } from './r4-off-only-pages-transport.mjs';
import { scope } from './r4-off-only-github-admission.mjs';

const commit='a'.repeat(40), packageSha='b'.repeat(64), operation=operationFor(commit,12);
assert.match(operation,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
assert.notEqual(operation,operationFor(commit,13));
const repoWorkflow = new URL('../../.github/workflows/r4-first-issue-off-only-release.yml',import.meta.url);
const workflow = readFileSync(existsSync(repoWorkflow) ? repoWorkflow : new URL('r4-first-issue-off-only-release.yml',import.meta.url),'utf8');
assert.ok(workflow.includes('    name: '+scope.job+'\n') && workflow.includes('    environment: '+scope.environment+'\n') &&
  workflow.includes('    needs: '+scope.deltaJob+'\n') && workflow.includes('      group: cloudflare-pages\n') &&
  workflow.includes('      id-token: write\n') && workflow.includes('secrets.R4_FIRST_ISSUE_DB_WRITE_TOKEN'));
assert.equal(workflow.match(/protected-entry\.mjs release \./g)?.length,1);
const reads=buildCatalogReads();
for(const sql of Object.values(reads)) {
  assert.match(sql,/^begin isolation level repeatable read read only;/);
  assert.doesNotMatch(sql,/\block table\b|__ASSEMBLY_PHASE__/i);
  assert.match(sql,/\nrollback;\s*$/);
}
const safe={primary:true,independentOff:true,independentV2Off:true};
const plan={commit,operation,packageSha,dbFingerprint:'c'.repeat(64)};
const baseline={...safe,optionsSha:'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f',newObjectsAbsent:true};
const installed={...safe,optionsSha:'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286',
  issueFenceExact:true,canaryRows:0,issuanceRows:0,enabledScopeRows:0,scopeRows:0,controlOff:true,optionsBackupMatches:true};
assert.equal((await dbObserver({observeExact:()=>[baseline]},reads,plan)()).state,'baseline');
assert.equal((await dbObserver({observeExact:sql=>sql===reads.installed?[installed]:[]},reads,plan)()).state,'installed');
assert.equal(await dbObserver({observeExact:sql=>sql===reads.installed?[{...installed,optionsBackupMatches:false}]:[]},reads,plan)(),null);
assert.equal((await dbObserver({observeExact:sql=>sql===reads.restored?[{...baseline,closedFencesRemoved:true,controlOff:true,
  enabledScopeRows:0,canaryRows:0,issuanceRows:0}]:[]},reads,plan)()).state,'restored');

const d=(id,commit_hash,commit_message='')=>({id,environment:'production',latest_stage:{status:'success'},
  deployment_trigger:{metadata:{branch:'main',commit_hash,commit_message}}});
const old=d('80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4','81046af5ff14184585533f1a72b22f29a0298050');
const next=d('01234567-1111-2222-3333-444444444444','30bdd59100426cc6cee740c9b52b84c1e6c10c5d',`r4-off-${commit}-${operation}`);
const hash='66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0';
assert.equal(classifyPages(plan,old,old,{recoveryIndex:hash,currentIndex:hash}).canonicalMatchesRecovery,true);
assert.equal(classifyPages(plan,old,old,{recoveryIndex:'wrong'}),null);
assert.equal(classifyPages(plan,next,old,{recoveryIndex:hash,canonicalBytes:true,immutableBytes:true}).publicationOperation,operation);
assert.equal(classifyPages({...plan,commit:'d'.repeat(40)},next,old,{recoveryIndex:hash}).publicationOperation,null);
console.log('R4_OFF_ONLY_RELEASE_ENTRY_DELTA_PASS: protected wiring, distinct SQL states, Cloudflare recovery ownership');
