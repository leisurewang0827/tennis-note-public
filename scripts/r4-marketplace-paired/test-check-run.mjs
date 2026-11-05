import assert from 'node:assert/strict';
import {checkRun} from './check-run.mjs';
const sha='1'.repeat(40),branch='codex/tennisnote-r4-marketplace-paired-20261106',env={GITHUB_REPOSITORY:'leisurewang0827/tennis-note-public',GITHUB_REF:'refs/heads/'+branch,GITHUB_SHA:sha,GH_TOKEN:'synthetic-token'};
let fault='',kind='verify';const fake=async url=>({ok:true,json:async()=>url.includes('/jobs?')?{jobs:[{name:'marketplace-'+(kind==='failed-promote'?'promote':kind),conclusion:kind==='failed-promote'?'failure':'success'}]}:{head_sha:fault==='sha'?'2'.repeat(40):sha,head_branch:branch,status:'completed',conclusion:kind==='failed-promote'?'failure':'success',run_attempt:fault==='attempt'?2:1,path:fault==='path'?'.github/workflows/other.yml@main':'.github/workflows/deploy-cloudflare-pages.yml@refs/heads/'+branch}});
for(const type of ['verify','preview','failed-promote']){kind=type;assert.equal((await checkRun('123',type,env,fake)).status,'EXACT_PRIOR_CI_PASS');}
kind='verify';for(const bad of ['sha','attempt','path']){fault=bad;await assert.rejects(()=>checkRun('123',kind,env,fake));}fault='';await assert.rejects(()=>checkRun('abc',kind,env,fake));
console.log(JSON.stringify({status:'SYNTHETIC_CI_BINDING_PASS',cases:7,network:0}));
