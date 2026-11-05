import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
assert.ok(process.argv.includes('--verify-only'),'REVIEW_ONLY_REQUIRED');
assert.equal(process.env.R4_REVIEW_ONLY,'true');
assert.equal(process.env.TENNISNOTE_ENVIRONMENT,'production');
assert.equal(process.env.TENNISNOTE_SUPABASE_URL,'https://cnympiwrwgouuvhaivbc.supabase.co');
const root=process.cwd(),repo=process.env.R4_LOCAL_REPOSITORY||root;
assert.ok(!process.env.GITHUB_ACTIONS||!process.env.R4_LOCAL_REPOSITORY);
const manifest=JSON.parse(readFileSync(join(root,'docs/tennisnote-r4-prod-selfserve-candidate.json')));
const hash=s=>createHash('sha256').update(s).digest('hex');
const temp=mkdtempSync(join(tmpdir(),'tn-r4-prod-review-')),tar=join(temp,'source.tar');
execFileSync('git',['-C',repo,'archive','--output='+tar,manifest.currentProduction.source,'app/admin','app/shared','app/tennis-note-member-app/assets','app/tennis-note-legal','app/release.json','commerce.html','support.html','delete-account.html','scripts/build_cloudflare_pages.py']);
execFileSync('tar',['-xf',tar,'-C',temp]);
for(const[p,h]of Object.entries(manifest.effectiveChangedRuntime)){const bytes=readFileSync(join(root,p));assert.equal(hash(bytes),h,p);writeFileSync(join(temp,p),bytes);}
const output=resolve(root,'dist/admin-selfserve-review');mkdirSync(join(root,'dist'),{recursive:true});
const isolatedOutput=join(temp,'dist/admin-selfserve-review');
try{execFileSync(process.env.PYTHON||'python',[join(temp,'scripts/build_cloudflare_pages.py'),'--target','admin','--output',isolatedOutput],{cwd:temp,env:process.env,stdio:'pipe',windowsHide:true});}catch(error){throw Error('REVIEW_ARTIFACT_BUILD_FAILED: '+String(error.stderr||'').trim().split('\n').slice(-1)[0]);}
cpSync(isolatedOutput,output,{recursive:true,errorOnExist:true,force:false});
for(const[p,h]of Object.entries(manifest.effectiveChangedRuntime)){if(!p.endsWith('index.html'))assert.equal(hash(readFileSync(join(output,p.replace('app/admin/','')))),h,p);}
const config=readFileSync(join(output,'shared/config.local.js'),'utf8');
const runtime=JSON.parse(config.match(/window\.TENNISNOTE_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
const payment=JSON.parse(config.match(/window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
assert.equal(runtime.environment,'production');assert.equal(runtime.projectFingerprint,manifest.target.fingerprint);
assert.equal(payment.enabled,true);assert.equal(payment.mode,'multi');assert.equal(payment.bankTransfer.enabled,true);
assert.equal(existsSync(join(output,'tennis-note-member-app/index.html')),false);assert.equal(existsSync(join(output,'tennis-note-coach-app/index.html')),false);
const marker={status:'REVIEW_ONLY_NOT_DEPLOYABLE',source:process.env.GITHUB_SHA||null,candidateSha256:manifest.candidateSha256,existingPaymentShapePreserved:true,r4PaidSales:'OFF',pilot:'OFF',remoteMutation:0};
writeFileSync(join(output,'r4-review-only.json'),JSON.stringify(marker,null,2)+'\n');console.log(JSON.stringify(marker));
