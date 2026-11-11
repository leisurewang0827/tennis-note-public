// Source-CI evidence only. Does not connect to any database or authorize execution.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EXACT_CANDIDATE_PATHS} from './candidate-allowlist.mjs';
const base='06529aa58e2ace8f37c245beccc72f8781176765';
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const fail=x=>{throw new Error(x);};
export function validateAddedPaths(rows){
 const expected=[...EXACT_CANDIDATE_PATHS].sort();
 if(!Array.isArray(rows)||rows.length!==expected.length||rows.some(row=>!row.startsWith('A\t')))fail('FILE_SCOPE_MISMATCH');
 const actual=rows.map(row=>row.slice(2)).sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))fail('FILE_SCOPE_MISMATCH');
 return expected;
}
function main(){
const mode=process.argv[2],destination=process.argv[3];
if(!['write','verify'].includes(mode)||!destination)fail('USAGE');
const commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
if(!/^[a-f0-9]{40}$/.test(commit)||process.env.GITHUB_SHA!==commit||git('rev-parse','HEAD^')!==base)fail('COMMIT_MISMATCH');
const expected=validateAddedPaths(git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').filter(Boolean));
const files=expected.map(path=>({path,blob:git('rev-parse',`HEAD:${path}`),sha256:sha(readFileSync(path))}));
for(const f of files){const blob=execFileSync('git',['cat-file','blob',f.blob]);if(sha(blob)!==f.sha256)fail('WORKTREE_BLOB_MISMATCH');}
const evidence=JSON.stringify({version:2,commit,tree,base,files,assertion:'isolated-original-v2-mutation-body-only',productionPreimage:'NOT_TESTED',adminSealSha256:'7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e',adminAssets:180,recoveryDeployment:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',deploymentAuthorized:false})+'\n';
if(mode==='write')writeFileSync(destination,evidence,{flag:'wx'});
else if(readFileSync(destination,'utf8')!==evidence)fail('PROVENANCE_MISMATCH');
console.log(JSON.stringify({provenance:mode==='write'?'WRITTEN':'VERIFIED',candidateFiles:files.length,productionPreimage:'NOT_TESTED'}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main();
