import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
export function checkExistingAccountUi(files){
 const helper=files['app/admin/r4-existing-account-workspace.js'], view=files['app/admin/views/settings.js'];
 for(const env of ['development','production'])for(const mode of [false,true])for(const role of ['admin','coach','member']){
  const nodes=new Map();for(const id of ['operationsLoginGate','adminAppShell','operationsLoginMessage','operationsLogoutButton','adminSidebarLogoutButtonBottom','operationsRememberLogin'])nodes.set('#'+id,{hidden:false,textContent:'',dataset:{ready:true}});
  const root={TENNISNOTE_CONFIG:{environment:env,supabaseUrl:env==='development'?'https://udjmiezroipctytmztwz.supabase.co':'https://cnympiwrwgouuvhaivbc.supabase.co',projectFingerprint:'63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'},location:{origin:'https://example.invalid',pathname:'/',search:mode?'?r4Workspace=1':''},TennisNoteDataClient:{getSession:()=>({access_token:'synthetic'})}};
  const calls=[];for(const name of ['TennisNoteR4BranchHours','TennisNoteR4BranchAdminWrites','TennisNoteR4BranchOperations','TennisNoteR4Onboarding'])root[name]={refresh:p=>calls.push(p.allowed)};
  const scoped=env==='development'&&mode,ready=role!=='member'&&!scoped;
  const sandbox={window:root,document:{getElementById:()=>null},URL,URLSearchParams,Object,$:id=>nodes.get(id),operationsAccessReady:()=>ready,adminLocalPreviewMode:false,operationsRole:()=>role,applyOperationsRolePermissions:()=>{},initializeOperationsSessionPersistence:()=>{},adminImportAuthState:{loading:false,user:{id:'synthetic'},profile:{name:'Synthetic',role}}};
  const ctx=createContext(sandbox);new Script(helper).runInContext(ctx);
  new Script(view.slice(0,view.indexOf('function renderAdminLockModal()'))+'\nrenderOperationsLoginGate();').runInContext(ctx);
  assert.equal(nodes.get('#operationsLoginGate').hidden,ready&&!scoped);assert.equal(nodes.get('#adminAppShell').hidden,!ready||scoped);
  assert.deepEqual(calls,[1,2,3,4].map(()=>env==='development'&&mode||role==='member'));
 }
 for(const path of ['app/admin/actions/common.js','app/admin/data/common.js','app/admin/actions/settings.js','app/admin/r4-onboarding.js'])new Script(files[path]);
 assert.ok(files['app/admin/actions/common.js'].includes('if (window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.()) return false;'));
 assert.ok(files['app/admin/data/common.js'].includes('includes(role) && !window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.()'));
 assert.ok(files['app/admin/actions/settings.js'].includes('operationsRole() === "admin" && !window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.()'));
 assert.ok(files['app/admin/r4-onboarding.js'].includes('if (seoulDev && root.TennisNoteR4ExistingAccount?.isWorkspaceMode?.())'));
}
