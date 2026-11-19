// Only new release wiring and completion guards; no old UI or DB suite replay.
import assert from 'node:assert/strict';
import {validateCompletion} from './completion.mjs';
import {assertOwn,postOnce} from './runner.mjs';
import {EventEmitter} from 'node:events';
import {verifyAdmin} from './readiness.mjs';
const now=Date.now(),args={source:'a'.repeat(40),runId:'123',manifest:'b'.repeat(64),now},good={status:'ADMIN_V6_COMPLETED',source:args.source,runId:'123',attempt:1,deploymentId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',prior:'bcc6b9cc-a6be-451a-b4b5-f39323d59f77',manifest:args.manifest,responses:356,mismatch:0,dbWrites:0,createdAt:new Date(now).toISOString()};
if(!process.argv.includes('--delta')){assert.equal(validateCompletion(good,args),true);
for(const delta of [{status:'STARTED'},{source:'c'.repeat(40)},{runId:'456'},{responses:355},{mismatch:1},{createdAt:new Date(now-300001).toISOString()},{dbWrites:1}])assert.throws(()=>validateCompletion({...good,...delta},args));
assert.throws(()=>validateCompletion(undefined,args));}
const own={project:'tennisnote-admin',id:good.deploymentId,source:args.source,branch:'main',environment:'production',status:'success'};
for(const d of [{branch:'preview'},{environment:'preview'},{status:'failed'}])assert.throws(()=>assertOwn({...own,...d},own.id,own.source));
for(const event of ['error','aborted']){let requests=0;await assert.rejects(postOnce('https://example.invalid/','not-real',(_url,_options,callback)=>{requests++;const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{const response=new EventEmitter();callback(response);response.emit(event,new Error('SIMULATED_CUTOFF'))});return req}),/ROLLBACK_RESPONSE_UNKNOWN/);assert.equal(requests,1)}
const assets=Object.fromEntries(Array.from({length:178},(_,i)=>['file'+i+'.js','b'.repeat(64)])),previous={...assets,'file0.js':'a'.repeat(64)};let first=true;
const response=(status)=>({status,headers:new Headers(),arrayBuffer:async()=>new Uint8Array()});
let rejected;
try{await verifyAdmin({expected:own,assets,previous,observe:async()=>own,fetcher:async()=>response(403)})}catch(error){rejected=error}
assert(rejected?.readiness?.proof.some(p=>p.status===403&&p.path&&p.expected));
// Recovery can treat only the known candidate at the same path as pending.
const {createHash}=await import('node:crypto'),digest=x=>createHash('sha256').update(x).digest('hex');const base=Buffer.from('base'),candidate=Buffer.from('candidate');for(const n of Object.keys(assets))assets[n]=digest(base);for(const n of Object.keys(previous))previous[n]=digest(base);previous['file0.js']=digest(candidate);
let calls=0;const proof=await verifyAdmin({expected:own,assets,previous,observe:async()=>own,pause:async()=>{},fetcher:async(url)=>{calls++;const b=url.includes('/file0.js')&&first?(first=false,candidate):base;return {status:200,headers:new Headers(),arrayBuffer:async()=>b}}});assert.equal(proof.responses,356);assert(calls>356);console.log('NEW_RELEASE_DELTA_GUARDS_PASS');
