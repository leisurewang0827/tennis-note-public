// 날짜 표시 전용 보호 조건. 기존 보호 설정을 변경하지 않는다.
import assert from 'node:assert/strict';
export const REPO='leisurewang0827/tennis-note-public';
export const BRANCH='codex/tennisnote-r4-admin-prod-candidate';
export const SOURCE='5706b9cca20acaa3baa2c281a7bdf7dd1577306a';
export const SOURCE_PARENT='9de2626e14d38b4a7918ee95c6b44c792de5681b';
export const PARENT='73f00c377095686260d8b9d5873bd57b10907174';
export const WORKFLOW='.github/workflows/ledger-date-production.yml';
export const PATHS=Object.freeze([WORKFLOW,...['gate.mjs','gate.test.mjs','runner.mjs','unpack.py','manifest.json','assets/domain/common.js','assets/index.html'].map(x=>'release-promotions/ledger-date/'+x)]);
export const SOURCE_PATHS=['app/admin/domain/common.js','app/admin/index.html'];
export const PREVIOUS={project:'tennisnote-admin',id:'1deb93ab-6ef7-4879-9621-d8515edb9729',source:PARENT,branch:'main',environment:'production',status:'success'};
export function assertContext(x){assert.match(x.head,/^[a-f0-9]{40}$/);assert.equal(x.parent,PARENT);assert.equal(x.repo,REPO);assert.equal(x.branch,BRANCH);assert.equal(x.workflow,REPO+'/'+WORKFLOW+'@refs/heads/'+BRANCH);assert.equal(x.event,'push');assert.equal(x.attempt,1);assert.equal(x.sourceHead,SOURCE);assert.equal(x.sourceParent,SOURCE_PARENT);assert.deepEqual([...x.paths].sort(),[...PATHS].sort());assert.deepEqual([...x.sourcePaths].sort(),[...SOURCE_PATHS].sort());}
export function assertReview(rows,sha){assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.state,'approved');assert.equal(r.user?.id,294703475);assert.deepEqual(r.environments.map(x=>x.id),[26219323796]);assert.equal(r.comment,'LEDGER-DATE '+sha+' admin-only no-db');}
export function assertDeployment(x,expected=PREVIOUS){assert.deepEqual(x,expected);}
export function assertComposition(prior,desired,actual){assert.equal(Object.keys(prior).length,182);assert.deepEqual(Object.keys(prior).sort(),Object.keys(desired).sort());assert.deepEqual(Object.keys(prior).sort(),Object.keys(actual).sort());const changed=Object.keys(prior).filter(k=>prior[k]!==desired[k]).sort();assert.deepEqual(changed,['domain/common.js','index.html']);for(const k of Object.keys(desired)){assert.match(desired[k],/^[a-f0-9]{64}$/);assert.equal(actual[k],desired[k],k);}}
