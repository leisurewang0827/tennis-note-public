import assert from 'node:assert/strict';
import {checkReceipt} from './verify-prior-static.mjs';
const run={head_sha:'3fc84adb98acabb138bbaa002eaa92a81c02b5b8',status:'completed',conclusion:'failure',run_attempt:1,path:'.github/workflows/deploy-cloudflare-pages.yml@refs/heads/example'};
const jobs={jobs:[{id:127342652574,name:'marketplace-verify',steps:[{name:'Check development preflight negative cases',conclusion:'success'}]}]};
assert.equal(checkReceipt(run,jobs),true);
assert.throws(()=>checkReceipt({...run,head_sha:'wrong'},jobs));
assert.throws(()=>checkReceipt({...run,run_attempt:2},jobs));
assert.throws(()=>checkReceipt(run,{jobs:[{...jobs.jobs[0],steps:[{...jobs.jobs[0].steps[0],conclusion:'failure'}]}]}));
console.log(JSON.stringify({status:'SYNTHETIC_PRIOR_RECEIPT_PASS',cases:4,network:0}));
