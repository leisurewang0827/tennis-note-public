import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
const {createJournal,safeProof}=await import(existsSync(new URL('./journal.mjs',import.meta.url))?'./journal.mjs':'./v17-journal.mjs');
const dir=mkdtempSync(join(tmpdir(),'tn-v17-journal-'));let checks=0;
try{const f=join(dir,'receipt.json'),j=createJournal(f,{surface:'admin',execution:'a'.repeat(40),source:'b'.repeat(40)});let x=JSON.parse(readFileSync(f));assert.equal(x.phase,'PRECHECK');checks++;
 j.phase('PUBLISH_STARTED_OUTCOME_UNKNOWN');x=JSON.parse(readFileSync(f));assert.equal(x.phase,'PUBLISH_STARTED_OUTCOME_UNKNOWN');checks++;
 j.failure(Object.assign(Error('NETWORK'),{proof:[{status:404,path:'/x',token:'must-not-leak'}]}));x=JSON.parse(readFileSync(f));assert.equal(x.status,'FAILED_OR_UNKNOWN');assert.equal(x.proof[0].token,undefined);checks++;
 assert.throws(()=>createJournal(f,{surface:'admin',execution:'a'.repeat(40),source:'b'.repeat(40)}));checks++;
 const g=join(dir,'receipt2.json'),k=createJournal(g,{surface:'coach',execution:'a'.repeat(40),source:'b'.repeat(40)});k.phase('DEPLOYED_READBACK_PENDING',{attemptedDeploymentId:'new'});assert.throws(()=>k.rolledBack({restoredDeploymentId:'old'},[]),/RECOVERY_PROOF_REQUIRED/);k.rolledBack({restoredDeploymentId:'old'},[{path:'/ok',status:200,secret:'redacted'}]);k.failure(Error('READBACK_FAILED_ROLLED_BACK'));const restored=JSON.parse(readFileSync(g));assert.equal(restored.status,'ROLLED_BACK');assert.equal(restored.attemptedDeploymentId,'new');assert.equal(restored.restoredDeploymentId,'old');assert.equal(restored.deploymentId,undefined);assert.equal(restored.recoveryProof[0].secret,undefined);checks++;
 assert.deepEqual(safeProof({proof:[{path:'/a',secret:'x'}]}),[{path:'/a'}]);checks++;
}finally{for(const name of ['receipt.json','receipt2.json'])try{unlinkSync(join(dir,name))}catch(e){if(e.code!=='ENOENT')throw e}rmdirSync(dir);}
console.log(JSON.stringify({status:'PASS_SYNTHETIC_JOURNAL',checks,network:0,deployments:0}));
