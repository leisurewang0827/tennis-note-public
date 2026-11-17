import {verifyAssets} from './readback.mjs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const assets={'index.html':createHash('sha256').update('ok').digest('hex')};let n=0;
assert.equal((await verifyAssets(assets,['https://synthetic.invalid'],async()=>{n++;return new Response(n===1?'wait':'ok',{status:n===1?503:200});},async()=>{})).diagnostics.length,1);
assert.equal(n,2);
for(const status of [401,403,404,429,503]){n=0;await assert.rejects(verifyAssets(assets,['https://synthetic.invalid'],async()=>{n++;return new Response('error',{status});},async()=>{}));assert.equal(n,[401,403].includes(status)?1:3);}
await assert.rejects(verifyAssets(assets,['https://synthetic.invalid'],async()=>new Response('wrong'),async()=>{}),/ASSET_HASH_MISMATCH/);
console.log('PASS readback: bounded GET retries, permanent denial, strict hash; no writes');
