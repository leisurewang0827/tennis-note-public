import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('r4-finance-owner-dev-entry.js',import.meta.url),'utf8');
const preview='https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev';
const project='https://udjmiezroipctytmztwz.supabase.co';
const fingerprint='63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba';
for(const [name,origin,environment,url,fp,role,expected] of [
 ['owner DEV',preview,'development',project,fingerprint,'member',true],
 ['admin unchanged',preview,'development',project,fingerprint,'admin',false],
 ['coach unchanged',preview,'development',project,fingerprint,'coach',false],
 ['wrong fingerprint',preview,'development',project,'bad','member',false],
 ['DEV canonical unchanged','https://tennisnote-admin-dev.pages.dev','development',project,fingerprint,'member',false],
 ['other preview unchanged','https://r4-absence-group-qa.tennisnote-admin-dev.pages.dev','development',project,fingerprint,'member',false],
 ['PROD unchanged','https://tennisnote-admin.pages.dev','production','https://cnympiwrwgouuvhaivbc.supabase.co','bad','member',false]
]){
 let actor='qa-actor',timer,opened=0,closed=0,globalShell=0,profileReads=0;
 const prior={isProductionTarget:()=>false,isWorkspaceMode:()=>false,refreshEntry(){}};
 const client={loadConfig:()=>({environment,supabaseUrl:url,projectFingerprint:fp}),sessionSubject:()=>actor,
  async selectCurrentProfile(){profileReads++;return {user:{id:actor},profile:{role}};}};
 const root={location:{origin},TennisNoteDataClient:client,TennisNoteR4ExistingAccount:prior,
  TennisNoteR4BranchHours:{async refresh({allowed}){allowed?opened++:closed++;}},
  setInterval(fn){timer=fn;},renderOperationsLoginGate(){globalShell++;}};
 vm.runInNewContext(source,{window:root,document:{}},{timeout:1000});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(root.TennisNoteR4ExistingAccount.isProductionTarget(),false,'Never pretend DEV is PROD');
 assert.equal(root.TennisNoteR4ExistingAccount.isWorkspaceMode({role}),expected,name);
 assert.equal(Boolean(root.TennisNoteR4ExistingAccount.isDevFinanceTarget?.()),origin===preview&&environment==='development'&&fp===fingerprint,name);
 assert.equal(opened,0);assert.equal(profileReads,0);assert.equal(globalShell,0);assert.equal(timer,undefined);
 if(expected){actor='';assert.equal(root.TennisNoteR4ExistingAccount.isWorkspaceMode({role}),false);}
}
console.log(JSON.stringify({status:'DEV_ENTRY_DELTA_PASS',newCases:7,hostedRequests:0,businessWrites:0,previousTestsRerun:0}));
