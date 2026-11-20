// Read-only V9 immutable artifact/overlay guards; no deploy, HTTP, or credentials.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export const PREVIOUS_SOURCE='5f95042d214245a752c3dc8b7d6fe459b925e13a';
export const PREVIOUS_PRODUCT='144c95b216fdd137c59dcbb2ec2fa08fd46f4bbe';
export const PREVIOUS_MANIFEST='59e7bce57d0fd136afc303874b7ce7fd4cb125998bdcc1de1a4028eeebceaddd';
export const OLD_ARTIFACT=Object.freeze({run:44661272137,id:14595008584,name:'absence-v8-44661272137',size:110950548,digest:'sha256:789ef2ad57ebf5ddefbae71e07b3e1afd0adf54fe088c7df073cb33d3d9fd036'});
export const CHANGED=Object.freeze({admin:['index.html','schedule-v2-admin.css','styles.css'],coach:['tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js','tennis-note-coach-app/styles.css','tennis-note-coach-app/ui/screens.js','tennis-note-coach-app/ui/sheet.js']});
const hash=b=>createHash('sha256').update(b).digest('hex');
export function validatePrior(meta,run,job){assert.equal(meta.id,OLD_ARTIFACT.id);assert.equal(meta.name,OLD_ARTIFACT.name);assert.equal(meta.size_in_bytes,OLD_ARTIFACT.size);assert.equal(meta.digest,OLD_ARTIFACT.digest);assert.equal(meta.expired,false);assert.equal(meta.workflow_run?.id,OLD_ARTIFACT.run);assert.equal(meta.workflow_run?.head_sha,PREVIOUS_SOURCE);assert.equal(run.id,OLD_ARTIFACT.run);assert.equal(run.head_sha,PREVIOUS_SOURCE);assert.equal(run.head_branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(run.path,'.github/workflows/absence-v8-web.yml');assert.equal(run.repository?.full_name,'leisurewang0827/tennis-note-public');assert.equal(run.head_repository?.full_name,'leisurewang0827/tennis-note-public');assert.equal(run.run_attempt,1);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.event,'push');assert.equal(job.run_id,run.id);assert.equal(job.name,'verify-source');assert.equal(job.conclusion,'success');return true}
export function verifyOverlay({surface,oldManifest,oldSeal,oldFiles,newFiles,productSha,expectedHashes}){
 assert(['admin','coach'].includes(surface));assert.match(productSha||'',/^[0-9a-f]{40}$/);assert.notEqual(productSha,PREVIOUS_SOURCE);
 const section=oldManifest.projects?.[surface];assert(section);const oldTarget={...section.baseline,...section.changed},names=Object.keys(oldTarget).sort();assert.equal(names.length,surface==='admin'?181:252);
 assert.deepEqual(oldSeal,{source:PREVIOUS_SOURCE,productSource:PREVIOUS_PRODUCT,manifest:PREVIOUS_MANIFEST,files:oldTarget});assert.deepEqual(Object.keys(oldFiles).sort(),names);
 for(const n of names)assert.equal(hash(oldFiles[n]),oldTarget[n],'PRIOR_FILE_HASH');
 assert.deepEqual(Object.keys(newFiles).sort(),CHANGED[surface].slice().sort());assert.deepEqual(Object.keys(expectedHashes).sort(),CHANGED[surface].slice().sort());
 const updated={...oldTarget};for(const n of CHANGED[surface]){assert(Object.hasOwn(oldTarget,n),'PATH_NOT_IN_BASE');assert.match(expectedHashes[n],/^[0-9a-f]{64}$/);assert.equal(hash(newFiles[n]),expectedHashes[n],'OVERLAY_HASH');assert.notEqual(updated[n],expectedHashes[n],'NOT_A_CHANGE');updated[n]=expectedHashes[n]}
 return {surface,productSha,total:names.length,changed:CHANGED[surface].length,unchanged:names.length-CHANGED[surface].length,files:updated};
}
