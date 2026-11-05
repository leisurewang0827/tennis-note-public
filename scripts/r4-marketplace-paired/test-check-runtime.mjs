import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
assert.ok(process.argv[2],'synthetic config fixture path required');
const fixture=await readFile(process.argv[2],'utf8');
const temp=await mkdtemp(join(tmpdir(),'tn-r4-runtime-check-'));
for(const side of ['admin','member'])await mkdir(join(temp,side,'shared'),{recursive:true});
async function check(a,b,mode,ok){for(const [side,text] of [['admin',a],['member',b]])await writeFile(join(temp,side,'shared/config.local.js'),text);const run=spawnSync(process.execPath,[join(root,'check-runtime.mjs'),temp,mode],{encoding:'utf8'});assert.equal(run.status===0,ok,'unexpected admission decision');assert.ok(!(run.stdout+run.stderr).includes('sb_publishable_r4_local_artifact_only'),'credential-like value leaked');}
if(process.argv[3]!=='--new-key-cases'){
await check(fixture,fixture,'--synthetic',true);
await check(fixture,fixture,'--live',false);
await check(fixture.replace('"development"','"production"'),fixture,'--synthetic',false);
await check(fixture.replace('63350140ffe50d07','00000140ffe50d07'),fixture,'--synthetic',false);
await check(fixture.replace('"enabled": false','"enabled": true'),fixture,'--synthetic',false);
await check(fixture,fixture+'\n','--synthetic',false);
}
const synthetic='sb_publishable_r4_local_artifact_only';
const jwt=role=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({role,iss:'supabase',ref:'udjmiezroipctytmztwz'})).toString('base64url'),Buffer.alloc(32).toString('base64url')].join('.');
for(const [key,ok] of [['sb_publishable_synthetic_valid',true],[jwt('anon'),true],['sb_secret_synthetic',false],[jwt('service_role'),false],[jwt('authenticated'),false],['invalid-key',false],['eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.invalid',false]]){const c=fixture.replace(synthetic,key);await check(c,c,'--live',ok);}
const wrong=fixture.replace('https://udjmiezroipctytmztwz.supabase.co','https://udjmiezroipctytmztwz.supabase.co/incorrect');await check(wrong,wrong,'--synthetic',false);
console.log(JSON.stringify({status:'SYNTHETIC_RUNTIME_NEGATIVE_GATE_PASS',newCases:8,realExternalNetwork:0}));
