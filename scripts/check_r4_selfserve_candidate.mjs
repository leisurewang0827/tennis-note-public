import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const arg=p=>process.argv.find(s=>s.startsWith(p))?.slice(p.length);const repo=arg('--repository=')||process.cwd(),ref=arg('--ref=')||process.env.GITHUB_SHA||'HEAD',parent="17a34a0de5b97ef0de83b8d595edf22b260407a7",expected={
  "app/admin/views/settings.js": "c1a7a40ee0977e82451986fdea4b6539da05591ad83882e53d428994a90b3080",
  "app/admin/actions/common.js": "144c3776c534b7fd5ba3ac5b61713f5e66ae2a6462c7a9f9e94ee75bed1cabeb",
  "app/admin/data/common.js": "9b1c09cbfa5fbd19601f91253f02c7fedaa6ef9dc150725eb379d9e8419f7435",
  "app/admin/actions/settings.js": "52d50b167e8d8b78579537aecd5968d72b23778c25af3bfe9f7b0f679eae2032",
  "app/admin/r4-onboarding.js": "d3a97cce1befd4ad2f99d17232c2f5298145098ddb764744b5a61936ee28e186",
  "scripts/check_r4_existing_account_ui.mjs": "097a41f593624eddb0f6f0a111193879ce36d3b8af2e401f9bc6a6c10e21edd0",
  "app/admin/index.html": "8afa60cbad3d763e97eaa096567cc86c15282d35c7c0eb2353412b100324982f",
  "scripts/build_r4_phone_dev.mjs": "01b8e2b982f89dfe2719cebd6c44a14cc0871f3b6d3058656aa8e87d90d841a4",
  ".github/workflows/deploy-cloudflare-pages.yml": "5a83a62b56314e1bb2be5ced33bb27207db65cb2ad81573b8007e61f06716159"
};
const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',maxBuffer:5e6}).trimEnd();const read=p=>execFileSync('git',['-C',repo,'show',ref+':'+p],{encoding:'utf8',maxBuffer:5e6});const sha=git('rev-parse',ref);
assert.equal(git('rev-list','--parents','-n','1',sha),sha+' '+parent);assert.deepEqual(git('diff','--name-only',parent,sha).split('\n').sort(),[...Object.keys(expected),'scripts/check_r4_selfserve_candidate.mjs'].sort());
const files={};for(const[p,h]of Object.entries(expected)){files[p]=read(p);assert.equal(createHash('sha256').update(files[p]).digest('hex'),h,p);}
const onboarding=files['app/admin/r4-onboarding.js'];files['app/admin/r4-existing-account-workspace.js']=onboarding.slice(0,onboarding.indexOf('(function installR4Onboarding'));
const tests=await import('data:text/javascript;base64,'+Buffer.from(files['scripts/check_r4_existing_account_ui.mjs']).toString('base64'));tests.checkExistingAccountUi(files);
assert.ok(files['.github/workflows/deploy-cloudflare-pages.yml'].includes('environment: tennisnote-r4-admin-production'));
if(process.env.GITHUB_ACTIONS==='true'){
assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(process.env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-admin-prod-candidate');assert.equal(process.env.GITHUB_SHA,sha);
const api=async p=>{const r=await fetch('https://api.github.com/repos/leisurewang0827/tennis-note-public'+p,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);return r.json();};const old=await api('/actions/runs/41984092092');assert.equal(old.head_sha,parent);assert.equal(old.conclusion,'success');
if(process.argv.includes('--require-prior-ci')){const {workflow_runs}=await api('/actions/workflows/deploy-cloudflare-pages.yml/runs?head_sha='+sha+'&status=completed&event=workflow_dispatch&per_page=30');let verified=false;for(const r of workflow_runs){if(r.head_sha!==sha||r.conclusion!=='success'||!r.display_title.startsWith('R4 administrator verify / '))continue;const {jobs}=await api('/actions/runs/'+r.id+'/jobs');if(jobs.some(j=>j.name==='verify-candidate'&&j.conclusion==='success')&&jobs.every(j=>!['admin-only','development-only'].includes(j.name)||j.conclusion==='skipped'))verified=true;}assert.equal(verified,true);}}
console.log('PASS DEV existing-account entry and isolated workspace mode for admin/coach/member; original views and production route preserved; source hashes and exact parent verified');
