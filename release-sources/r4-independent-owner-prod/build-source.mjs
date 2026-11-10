import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {compose,digest} from './compose.mjs';
const files=['.github/workflows/r4-independent-owner-prod-source.yml','release-sources/r4-independent-owner-prod/install-off.sql','release-sources/r4-independent-owner-prod/canary-open.sql','release-sources/r4-independent-owner-prod/canary-close.sql','release-sources/r4-independent-owner-prod/canary-postread.sql','release-sources/r4-independent-owner-prod/independent-ui.js','release-sources/r4-independent-owner-prod/check-db.mjs','release-sources/r4-independent-owner-prod/check-web.mjs','release-sources/r4-independent-owner-prod/compose.mjs','release-sources/r4-independent-owner-prod/build-source.mjs'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
assert.equal(process.env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108');
assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
assert.equal(git('rev-parse','HEAD'),process.env.GITHUB_SHA);
assert.equal(git('rev-list','--parents','-n','1','HEAD'),process.env.GITHUB_SHA+' eeb53af5dfb03291d26da6e84b7454c1cc153c26');
assert.deepEqual(git('diff','--name-only','HEAD^','HEAD').split('\n').sort(),files.sort());
const {output,hashes,version}=compose('prod-base');
for(const [file,bytes] of Object.entries(output)){const dest=join('prod-candidate','admin',file);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes,{flag:'wx'});}
const sql={};for(const x of ['install-off.sql','canary-open.sql','canary-close.sql','canary-postread.sql'])sql[x]=digest(readFileSync(new URL('./'+x,import.meta.url)));
const seal={kind:'R4_INDEPENDENT_OWNER_SOURCE_ONLY',source:process.env.GITHUB_SHA,recovery:'2652a679-cc7b-4b85-a4d0-166c393faa0d',version,sql,admin:hashes};
const body=Buffer.from(JSON.stringify(seal,null,2)+'\n');writeFileSync('prod-candidate/seal.json',body,{flag:'wx'});
console.log(JSON.stringify({status:'INDEPENDENT_SOURCE_ONLY_SEALED',files:Object.keys(hashes).length,sealHash:digest(body),sql}));
