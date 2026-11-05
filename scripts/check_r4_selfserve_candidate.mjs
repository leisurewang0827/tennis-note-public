import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const value=p=>process.argv.find(s=>s.startsWith(p))?.slice(p.length);
const repository=value('--repository=')||process.cwd(), ref=value('--ref=')||process.env.GITHUB_SHA||'HEAD';
const parent='1aa2a5a3f026079a2ae9f229543f297f7f99a753', builder='scripts/build_r4_phone_dev.mjs', workflow='.github/workflows/deploy-cloudflare-pages.yml';
const git=(...a)=>execFileSync('git',['-C',repository,...a],{encoding:'utf8',maxBuffer:3e6}).trimEnd();
const source=(r,p)=>execFileSync('git',['-C',repository,'show',r+':'+p],{encoding:'utf8',maxBuffer:3e6});
const sha=git('rev-parse',ref);
assert.equal(git('rev-list','--parents','-n','1',sha),sha+' '+parent);
assert.deepEqual(git('diff','--name-only',parent,sha).split('\n').sort(),['.github/workflows/deploy-cloudflare-pages.yml','scripts/build_r4_phone_dev.mjs','scripts/check_r4_selfserve_candidate.mjs'].sort());
assert.equal(source(sha,builder),source(parent,builder).replace('const priorPrefix="5c75dcf7";','const priorPrefix="2eac2bf7";'));
const expectedWorkflow=source(parent,workflow).replace(/      - uses: actions\/setup-python@v7[\s\S]*?run: node scripts\/build_r4_phone_dev\.mjs --build\r?\n/,'').replace('prior=3bdc51d3d0767cfa0c1c7a4bd627bd3f705ec555','prior='+parent).replace('checkpoint_parent=69c2f771','phone_parent=3bdc51d3d0767cfa0c1c7a4bd627bd3f705ec555\n          test "$(git rev-parse "$prior^")" = "$phone_parent"\n          prior=$phone_parent\n          checkpoint_parent=69c2f771');
const withToken=expectedWorkflow.replace('      - name: Verify exact self-service administrator delta\n        run:', '      - name: Verify exact self-service administrator delta\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run:');
const finalExpected=withToken===expectedWorkflow?expectedWorkflow.replace('      - name: Verify exact self-service administrator delta\r\n        run:', '      - name: Verify exact self-service administrator delta\r\n        env:\r\n          GH_TOKEN: ${{ github.token }}\r\n        run:'):withToken;
assert.equal(source(sha,workflow),finalExpected);
if(process.env.GITHUB_ACTIONS==='true'){
 assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
 assert.equal(process.env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-admin-prod-candidate');
 assert.equal(process.env.GITHUB_SHA,sha);
 const api=async p=>{const r=await fetch('https://api.github.com/repos/leisurewang0827/tennis-note-public'+p,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);return r.json();};
 const old=await api('/actions/runs/41979460156');assert.equal(old.head_sha,parent);assert.equal(old.conclusion,'success');
 if(process.argv.includes('--require-prior-ci')){
  const runs=await api('/actions/workflows/deploy-cloudflare-pages.yml/runs?head_sha='+sha+'&status=completed&event=workflow_dispatch&per_page=30');
  assert.equal(runs.workflow_runs.some(r=>r.head_sha===sha&&r.conclusion==='success'&&r.display_title.startsWith('R4 administrator verify / ')),true);
 }
}
console.log('PASS recovery identity correction only; unchanged UI/build proof reused; production guards preserved');
