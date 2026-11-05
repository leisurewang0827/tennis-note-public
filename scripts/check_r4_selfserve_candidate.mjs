import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Script,createContext} from 'node:vm';
const arg=p=>process.argv.find(s=>s.startsWith(p))?.slice(p.length);
const repository=arg('--repository=')||process.cwd(),ref=arg('--ref=')||process.env.GITHUB_SHA||'HEAD';
const parent="a32801a876e14bda4aae63e890d3cf23ed854745",expected={
  "app/admin/r4-phone-verification.js": "896ec2fb0d3edd9c7a0e03e4fa99fc5f1e8481d79738b6973f0441f93fb43fac",
  "app/admin/index.html": "d0b3f5aa4fc650144c548a8cfc2cc8a71a0d0966f92655965eab811c97f46985",
  "scripts/build_r4_phone_dev.mjs": "9fe2f01ad24f30dac9cebbec96e27997b85fb81f6b4e1f19b0f49f4fffbec0f8",
  ".github/workflows/deploy-cloudflare-pages.yml": "4545bf22e27dd2705339bd36e488216f740ad126fb250260196c256e9bba2b18"
};
const git=(...a)=>execFileSync('git',['-C',repository,...a],{encoding:'utf8',maxBuffer:3e6}).trimEnd();
const read=p=>execFileSync('git',['-C',repository,'show',ref+':'+p],{encoding:'utf8',maxBuffer:3e6});
const sha=git('rev-parse',ref);
assert.equal(git('rev-list','--parents','-n','1',sha),sha+' '+parent);
assert.deepEqual(git('diff','--name-only',parent,sha).split('\n').sort(),[...Object.keys(expected),'scripts/check_r4_selfserve_candidate.mjs'].sort());
for(const[p,h]of Object.entries(expected))assert.equal(createHash('sha256').update(read(p)).digest('hex'),h,p);
const source=read('app/admin/r4-phone-verification.js');new Script(source);
const root={},elements=new Map();for(const id of ['r4PhoneVerification','r4PhoneVerificationForm','r4VerificationPhone','r4VerificationCode','r4VerificationSend','r4VerificationConfirm','r4VerificationStatus'])elements.set(id,{});
const probe=source.replace('  function controls(ctx) {','  root.normalizationProbe={authPhone,confirmed};return;\n  function controls(ctx) {');
new Script(probe).runInContext(createContext({window:root,document:{getElementById:id=>elements.get(id)},Date,Map,Error,Object,Boolean,String,Number}));
const {authPhone,confirmed}=root.normalizationProbe;
assert.equal(authPhone('821012340000'),'+821012340000');assert.equal(authPhone('+821012340000'),'+821012340000');
for(const p of ['++821012340000','+821012340000 ','01012340000',''])assert.equal(authPhone(p),'');
assert.equal(confirmed({phone:'821012340000',phone_confirmed_at:new Date().toISOString()}),true);
assert.equal(confirmed({phone:'821012340000',phone_confirmed_at:null}),false);
assert.ok(source.includes('authPhone(user.phone) !== destination'));
if(process.env.GITHUB_ACTIONS==='true'){
 assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(process.env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-admin-prod-candidate');assert.equal(process.env.GITHUB_SHA,sha);
 const api=async p=>{const r=await fetch('https://api.github.com/repos/leisurewang0827/tennis-note-public'+p,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});assert.equal(r.ok,true);return r.json();};
 const prior=await api('/actions/runs/41980433276');assert.equal(prior.head_sha,parent);assert.equal(prior.conclusion,'success');
 if(process.argv.includes('--require-prior-ci')){
 const runs=await api('/actions/workflows/deploy-cloudflare-pages.yml/runs?head_sha='+sha+'&status=completed&event=workflow_dispatch&per_page=30');let verified=false;
 for(const r of runs.workflow_runs){if(r.head_sha!==sha||r.conclusion!=='success'||!r.display_title.startsWith('R4 administrator verify / '))continue;const {jobs}=await api('/actions/runs/'+r.id+'/jobs');if(jobs.some(j=>j.name==='verify-candidate'&&j.conclusion==='success')&&jobs.every(j=>!['admin-only','development-only'].includes(j.name)||j.conclusion==='skipped'))verified=true;}assert.equal(verified,true);
 }
}
console.log('PASS exact normalization-only source delta; Auth phone formats and recipient binding; prior unaffected proof reused; production gate unchanged');
