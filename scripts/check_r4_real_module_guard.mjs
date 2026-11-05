import assert from 'node:assert/strict';
import {Script,createContext} from 'node:vm';

class Node {
  constructor(){this.hidden=true;this.disabled=false;this.value='';this.textContent='';this.dataset={ready:true};this.children=[];this.selectors=new Map();this.elements=new Proxy({},{get:(o,k)=>o[k]??=(new Node())});}
  querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new Node());return this.selectors.get(s);}
  querySelectorAll(){return [];}
  addEventListener(){} removeEventListener(){} reset(){} dispatchEvent(){} setAttribute(){} removeAttribute(){}
  append(...n){this.children.push(...n);} prepend(...n){this.children.unshift(...n);} replaceChildren(...n){this.children=n;}
}

// 실제 설치 함수/refresh 본문을 실행한다. 모듈 자체를 spy stub으로 바꾸지 않는다.
export async function checkRealModuleEnvironmentGuard(files,{expectLeak=false}={}){
 const configs=[
  {name:'DEV',environment:'development',supabaseUrl:'https://udjmiezroipctytmztwz.supabase.co'},
  {name:'wrong project',supabaseUrl:'https://udjmiezroipctytmztwz.supabase.co'},
  {name:'wrong fingerprint',projectFingerprint:'invalid'},
  {name:'wrong origin',origin:'https://example.invalid'},
  {name:'unknown environment',environment:'staging'},
  {name:'valid production'},
 ];
 const result=[];
 for(const c of configs){
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={getElementById:get,createElement:()=>new Node()};
  const calls=[],pending=[],refreshCounts={};
  const config={environment:c.environment||'production',supabaseUrl:c.supabaseUrl||'https://cnympiwrwgouuvhaivbc.supabase.co',projectFingerprint:c.projectFingerprint||'3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'};
  const client={loadConfig:()=>config,getSession:()=>({access_token:'synthetic'}),sessionSubject:()=> '00000000-0000-4000-8000-000000000001',rpc:async(name)=>{calls.push(name);if(name==='tn_r4_my_managed_branches')return [];if(name==='tn_r4_prod_my_selfserve_branch')return {available:false,paymentEnabled:false,identityVerificationEnabled:false};return [];}};
  const root={TENNISNOTE_CONFIG:config,TennisNoteDataClient:client,TennisNoteR4PhoneVerification:{reset(){}},location:{origin:c.origin||'https://tennisnote-admin.pages.dev',search:'',pathname:'/'}};
  const ctx=createContext({window:root,document,URL,URLSearchParams,console,Event:class{},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000002'},$:s=>get(s.replace(/^#/,'')),operationsRole:()=> 'member',operationsAccessReady:()=>false,adminLocalPreviewMode:false,adminImportAuthState:{user:{id:'synthetic'},profile:{role:'member'},loading:false},initializeOperationsSessionPersistence(){},applyOperationsRolePermissions(){}});
  for(const path of ['app/admin/r4-branch-hours.js','app/admin/r4-branch-admin-writes.js','app/admin/r4-branch-operations.js','app/admin/r4-onboarding.js'])new Script(files[path],{filename:path}).runInContext(ctx);
  for(const name of ['TennisNoteR4BranchHours','TennisNoteR4BranchAdminWrites','TennisNoteR4BranchOperations','TennisNoteR4Onboarding']){
   const actual=root[name];assert.ok(actual?.refresh,name+' actually installed');refreshCounts[name]=0;
   root[name]={...actual,refresh(...args){refreshCounts[name]++;const p=actual.refresh(...args);if(p?.then)pending.push(p);return p;}};
  }
  const view=files['app/admin/views/settings.js'];new Script(view.slice(0,view.indexOf('function renderAdminLockModal()'))+'\nrenderOperationsLoginGate();').runInContext(ctx);
  await Promise.all(pending);await Promise.resolve();
  assert.ok(Object.values(refreshCounts).every(n=>n===1));
  if(c.name==='valid production')assert.ok(calls.length>0,'positive control must exercise real RPC path');
  else if(!expectLeak)assert.equal(calls.length,0,c.name+' real module RPC count');
  result.push({case:c.name,rpcCount:calls.length,realModulesInstalled:4});
 }
 if(expectLeak)assert.ok(result.some(x=>x.case!=='valid production'&&x.rpcCount>0),'old frozen source must reproduce P1');
 return {status:expectLeak?'P1_REPRODUCED':'PASS_REAL_MODULE_ENVIRONMENT_GUARD',cases:result};
}
