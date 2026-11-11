import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root=join(mkdtempSync(join(tmpdir(),'tn-r4-one-write-')),'journal');
const target=new URL('./first-issue-db-actions.mjs',import.meta.url).href;
const child=`import {claimWriteOnce} from ${JSON.stringify(target)};
  try{claimWriteOnce(process.argv[1],JSON.parse(process.argv[2]));}
  catch(e){console.error(e.message);process.exitCode=12;}`;
const attempt=x=>spawnSync(process.execPath,['--input-type=module','-e',child,root,JSON.stringify(x)],
  {encoding:'utf8',windowsHide:true,timeout:5000});
const install={commit:'1'.repeat(40),action:'install'};
const off={...install,action:'off',operation:'11111111-2222-4333-8444-555555555555'};
for(const binding of [install,off]){
  assert.equal(attempt(binding).status,0);
  const duplicate=attempt(binding);
  assert.equal(duplicate.status,12);
  assert.match(duplicate.stderr,/WRITE_ALREADY_ATTEMPTED_READBACK_ONLY/);
}
assert.equal(readdirSync(root).length,2);
console.log(JSON.stringify({separateProcessFirstClaims:2,duplicateClaimsDenied:2,network:0,productionWrites:0}));
