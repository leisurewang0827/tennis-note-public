/* Exercise only V17 API timeout composition with stubbed, non-network fetch. */
import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const here=existsSync(new URL('./runner.mjs',import.meta.url))?new URL('./runner.mjs',import.meta.url):new URL('./v17-protected-runner.mjs',import.meta.url),source=readFileSync(here,'utf8');
const m=source.match(/async function api\(url,token,label,signal\)\{[^\n]+\}/);assert.ok(m);let calls=0,last,code=200;
const AbortSignal={timeout:ms=>({kind:'limit',ms}),any:items=>({kind:'combined',items})},fetch=async(u,opts)=>{calls++;last=opts;return {status:code,json:async()=>({ok:true})}};
const ctx={assert,AbortSignal,fetch};vm.createContext(ctx);vm.runInContext(m[0]+'\nthis.api=api;',ctx);
const caller={kind:'caller'};await ctx.api('https://example.invalid','synthetic','x',caller);assert.equal(calls,1);assert.equal(last.signal.kind,'combined');assert.equal(last.signal.items[0],caller);assert.equal(last.signal.items[1].ms,15000);
await ctx.api('https://example.invalid','synthetic','x');assert.equal(calls,2);assert.equal(last.signal.kind,'limit');assert.equal(last.signal.ms,15000);
code=403;await assert.rejects(ctx.api('https://example.invalid','synthetic','x',caller),/HTTP_403_x/);assert.equal(calls,3);
console.log(JSON.stringify({status:'PASS_API_TIMEOUT_INTERSECTION',cases:3,network:0,deployments:0}));
