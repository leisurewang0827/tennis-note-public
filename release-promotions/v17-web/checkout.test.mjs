import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const {LEGACY_CHECKOUT,validateCheckout,assertExecution,EXECUTION_PARENT,PRIOR_EXECUTION,BRANCH,REPO,EXECUTION_PATHS,TOTAL_PATHS}=await import(existsSync(new URL('./gate.mjs',import.meta.url))?'./gate.mjs':'./v17-execution-gate.mjs');
const data=Buffer.from('synthetic\r\n'),read=()=>data,blob=()=>Buffer.from(data);
validateCheckout(LEGACY_CHECKOUT,{read,blob});assert.throws(()=>validateCheckout(['unrelated'],{read,blob}),/UNEXPECTED_CHECKOUT_PATH/);assert.throws(()=>validateCheckout([LEGACY_CHECKOUT[0]],{read,blob:()=>Buffer.from('changed')}),/RAW_CHECKOUT_CHANGED/);
const x={head:'1'.repeat(40),parent:EXECUTION_PARENT,grandparent:PRIOR_EXECUTION,branch:BRANCH,repo:REPO,paths:EXECUTION_PATHS,totalPaths:TOTAL_PATHS,attempt:1,event:'push'};assertExecution(x);assert.throws(()=>assertExecution({...x,totalPaths:[...TOTAL_PATHS,'unexpected']}));
console.log(JSON.stringify({status:'PASS_CHECKOUT_FIX_ONLY',legacyPaths:5,cases:5,network:0,deployments:0}));
