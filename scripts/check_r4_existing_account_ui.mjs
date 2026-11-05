import assert from 'node:assert/strict';
import {Script,createContext} from 'node:vm';

export function checkLoginControlsUi(files) {
  const view=files['app/admin/views/settings.js'];
  const html=files['app/admin/index.html'];
  const helper=files['app/admin/r4-existing-account-workspace.js'];
  assert.equal(html.split('id="operationsLoginControls"').length,2);
  const controls=html.slice(html.indexOf('<div id="operationsLoginControls">'),html.indexOf('<button id="operationsLogoutButton"'));
  for(const id of ['operationsRememberLogin','operationsPasswordLoginForm'])assert.ok(controls.includes('id="'+id+'"'));
  assert.ok(controls.includes('operations-login-actions'));
  assert.equal(controls.includes('id="r4Onboarding"'),false);
  assert.ok(html.indexOf('id="operationsLogoutButton"')<html.indexOf('id="r4Onboarding"'));
  const cases=[
    {label:'DEV verified administrator',env:'development',mode:true,user:true,token:true,role:'admin',hide:true},
    {label:'DEV verified coach',env:'development',mode:true,user:true,token:true,role:'coach',hide:true},
    {label:'DEV verified member',env:'development',mode:true,user:true,token:true,role:'member',hide:true},
    {label:'DEV signed out',env:'development',mode:true,user:false,token:false,role:'',hide:false},
    {label:'DEV missing token',env:'development',mode:true,user:true,token:false,role:'admin',hide:false},
    {label:'DEV token without verified user',env:'development',mode:true,user:false,token:true,role:'',hide:false},
    {label:'DEV restoring session',env:'development',mode:true,user:false,token:true,loading:true,role:'',hide:false},
    {label:'DEV ordinary administrator',env:'development',mode:false,user:true,token:true,role:'admin',hide:false},
    {label:'PROD workspace query ignored',env:'production',mode:true,user:true,token:true,role:'admin',hide:false},
    {label:'PROD login unchanged',env:'production',mode:false,user:false,token:false,role:'',hide:false},
  ];
  for(const c of cases){
    const nodes=new Map(['operationsLoginGate','adminAppShell','operationsLoginControls','operationsLoginTitle','operationsLoginMessage','operationsLogoutButton','adminSidebarLogoutButtonBottom','operationsRememberLogin'].map(id=>['#'+id,{hidden:false,textContent:'',dataset:{ready:true}}]));
    const root={TENNISNOTE_CONFIG:{environment:c.env,supabaseUrl:c.env==='development'?'https://udjmiezroipctytmztwz.supabase.co':'https://cnympiwrwgouuvhaivbc.supabase.co',projectFingerprint:'63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'},location:{origin:'https://example.invalid',pathname:'/',search:c.mode?'?r4Workspace=1':''},TennisNoteDataClient:{getSession:()=>c.token?{access_token:'synthetic'}:null}};
    const scoped=c.env==='development'&&c.mode;
    const ready=!scoped&&c.user&&c.token&&['admin','coach'].includes(c.role);
    const sandbox={window:root,document:{getElementById:()=>null},URL,URLSearchParams,Object,$:id=>nodes.get(id),operationsAccessReady:()=>ready,adminLocalPreviewMode:false,operationsRole:()=>c.role,applyOperationsRolePermissions:()=>{},initializeOperationsSessionPersistence:()=>{},adminImportAuthState:{loading:!!c.loading,user:c.user?{id:'synthetic'}:null,profile:{name:'Synthetic',role:c.role}}};
    const ctx=createContext(sandbox);new Script(helper).runInContext(ctx);
    new Script(view.slice(0,view.indexOf('function renderAdminLockModal()'))+'\nrenderOperationsLoginGate();').runInContext(ctx);
    assert.equal(nodes.get('#operationsLoginControls').hidden,c.hide,c.label);
    assert.equal(nodes.get('#operationsLoginTitle').textContent,c.hide?'내 지점':'운영 화면 로그인',c.label);
    if(c.hide){assert.equal(nodes.get('#operationsLoginGate').hidden,false);assert.equal(nodes.get('#adminAppShell').hidden,true);assert.equal(nodes.get('#operationsLogoutButton').hidden,false);}
    // 만료/로그아웃 전환 시 이전 hidden 값이 남지 않아야 한다.
    if(c.hide){sandbox.adminImportAuthState.user=null;root.TennisNoteDataClient.getSession=()=>null;new Script('renderOperationsLoginGate();').runInContext(ctx);assert.equal(nodes.get('#operationsLoginControls').hidden,false);assert.equal(nodes.get('#operationsLoginTitle').textContent,'운영 화면 로그인');}
  }
  return {cases:cases.length,scope:'login-controls-only',authWrites:0,businessWrites:0};
}
