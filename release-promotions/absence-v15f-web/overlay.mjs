// LOCAL REVIEW CANDIDATE ONLY: pure validation; does not fetch, publish or roll back.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const PINS=Object.freeze({source:'b88ad08187446f786e22b100c6dd8c280472224a',devExecution:'508f9cf90c922c1036bbcd052d6deb2f1e000ded',devRun:44706106526,v9Run:44669723933,v9Execution:'808e4ce0b8539f0ce774c5cef832ab1985c064a8',v9Product:'71b0854eb0dfb216c0bd320e10a5fd77a7abfd08',v9Manifest:'4f4e95767605b9caac06a0bc96d3a7d5a5e902f10d8bfce864b38c72703730a9',overlay:'80c72b46ab0199cad145f49366b20910b832ef50d42470f958932b162363f422',adminPrior:'3e6fab7a-4d32-410f-963a-17d288a1ba1d',coachPrior:'5b7847e3-1506-4bb0-9e48-ed5c9a1d2bd2'});
const names=Object.freeze({admin:['actions/settings.js','schedule-v2-admin.js','views/members.js','styles.css','index.html','shared/tennisnote-absence-handoff.js'],coach:['tennis-note-coach-app/ui/screens.js','tennis-note-coach-app/styles.css','tennis-note-coach-app/index.html','tennis-note-coach-app/service-worker.js','shared/tennisnote-absence-handoff.js']});
const safe=n=>typeof n==='string'&&!n.startsWith('/')&&!n.includes('\\')&&!n.split('/').some(x=>!x||x==='.'||x==='..');
export function verifyV14Overlay({mode,v9ManifestBytes,overlayBytes,priorSeal,priorFiles,changedFiles,sourceBytes}){
 assert(['admin','coach'].includes(mode));assert.equal(sha(v9ManifestBytes),PINS.v9Manifest);assert.equal(sha(overlayBytes),PINS.overlay);
 const old=JSON.parse(v9ManifestBytes),overlay=JSON.parse(overlayBytes),p=old.projects[mode];assert.equal(overlay.files.length,11);assert.equal(old.productSource,PINS.v9Product);
 const expectedOld={...p.baseline,...p.changed};assert.equal(Object.keys(expectedOld).length,mode==='admin'?181:252);
 assert.deepEqual(priorSeal,{source:PINS.v9Execution,productSource:PINS.v9Product,manifest:PINS.v9Manifest,files:expectedOld});
 assert.deepEqual(Object.keys(priorFiles).sort(),Object.keys(expectedOld).sort());
 for(const [n,h] of Object.entries(expectedOld)){assert(safe(n));assert.equal(sha(priorFiles[n]),h,'BASE_HASH '+n)}
 const items=overlay.files.filter(x=>x.name.startsWith(mode+'/'));assert.deepEqual(items.map(x=>x.name.slice(mode.length+1)).sort(),names[mode].slice().sort());
 assert.deepEqual(Object.keys(changedFiles).sort(),names[mode].slice().sort());assert.deepEqual(Object.keys(sourceBytes).sort(),names[mode].slice().sort());
 const result={...expectedOld};for(const item of items){const n=item.name.slice(mode.length+1);assert(safe(n));assert.equal(result[n]||null,item.beforeSha256,'PREIMAGE '+n);assert.equal(sha(changedFiles[n]),item.afterSha256,'OVERLAY '+n);assert.equal(sha(sourceBytes[n]),item.afterSha256,'SOURCE '+n);result[n]=item.afterSha256;}
 assert.equal(Object.keys(result).length,mode==='admin'?182:253);for(const n of ['shared/config.local.js','_headers','_redirects','_worker.js'])assert.equal(result[n],expectedOld[n],'CONTROL '+n);
 return {mode,files:result,total:Object.keys(result).length,unchanged:Object.keys(expectedOld).length-(names[mode].length-1),source:PINS.source};
}
function verifyRun(run,job,id,sha,workflow){assert.equal(run.id,id);assert.equal(run.head_sha,sha);assert.equal(run.head_branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(run.path,workflow);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);assert.equal(run.repository?.full_name,'leisurewang0827/tennis-note-public');assert.equal(run.head_repository?.full_name,'leisurewang0827/tennis-note-public');assert.equal(job.run_id,run.id);assert.equal(job.name,'verify-source');assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');return true}
export function verifyRunEvidence(run,job){return verifyRun(run,job,PINS.devRun,PINS.devExecution,'.github/workflows/absence-simple-dev-preview.yml')}
export function verifyV9RunEvidence(run,job){return verifyRun(run,job,PINS.v9Run,PINS.v9Execution,'.github/workflows/readability-v9-web.yml')}
export function verifyPriorDeployment(mode,observation){assert(['admin','coach'].includes(mode));assert.deepEqual(observation,{project:mode==='admin'?'tennisnote-admin':'tennisnote-app',id:mode==='admin'?PINS.adminPrior:PINS.coachPrior,source:PINS.v9Execution,branch:'main',environment:'production',status:'success'});return true}

export function verifyV9Artifact(a){assert.equal(a.id,14599313239);assert.equal(a.name,'readability-v9-44669723933');assert.equal(a.size_in_bytes,110950556);assert.equal(a.digest,'sha256:312607020638f31d50e1878d23dc7bc664e1310e4532717d29a775184ed1c367');assert.equal(a.expired,false);assert.equal(a.workflow_run?.id,PINS.v9Run);assert.equal(a.workflow_run?.head_sha,PINS.v9Execution);assert.equal(a.workflow_run?.head_branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(a.workflow_run?.repository_id,1299952631);assert.equal(a.workflow_run?.head_repository_id,1299952631);return true}
