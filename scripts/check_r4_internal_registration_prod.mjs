// Focused, local-only synthetic assertions; never creates a network client or writes data.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import vm from "node:vm";
import {compose} from "../release-sources/r4-internal-registration-prod/production-overlay.mjs";
const base=process.env.R4_PROD_BASE;
assert.ok(base,"R4_PROD_BASE_REQUIRED");
const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink()); return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+"/")):[[prefix+e.name,readFileSync(join(dir,e.name))]];
}));
const read=p=>readFileSync(p);
const {delta}=compose({files:walk(join(base,"admin")),sealBytes:read(join(base,"seal.json")),
  draftSource:read("release-sources/r4-product-draft-dev/r4-product-draft-candidate.js"),
  registrationSource:read("release-sources/r4-internal-registration-dev/registration-ui.js"),
  hostSource:read("release-sources/r4-internal-registration-prod/production-host.js"),
  cssSource:read("release-sources/r4-product-draft-style-dev/candidate.css")});
assert.equal(Object.keys(delta).length,6);
for(const [name,bytes] of Object.entries(delta)) {
  if(/\.(?:js|html)$/.test(name)) assert.doesNotMatch(bytes.toString(),/tn_r4_dev_product|udjmiezroipctytmztwz|r4-product-draft-qa/);
}
const draft=delta["r4-product-draft-candidate.js"].toString();
assert.match(draft,/pointer\.operation !== draftOperationId/);
assert.doesNotMatch(draft,/id: root\.crypto\.randomUUID/);
assert.match(draft,/result === null/);
assert.match(draft,/committed \|\| pointerBlocked/);
const registration=delta["r4-internal-product-registration.js"].toString();
assert.match(registration,/r\.internalRegistrationEnabled!==true/);

const branch="11111111-1111-4111-8111-111111111111",operation="22222222-2222-4222-8222-222222222222",actorId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fakeStore=claims=>({getItem(k){if(k==="persist")return null;if(k==="auth"){const c=claims();return c===null?null:JSON.stringify({access_token:`x.${Buffer.from(JSON.stringify(c)).toString("base64url")}.x`});}return null;}});
const noFallback={authStorageKey:"auth",authPersistenceKey:"persist",sessionSubject(){throw Error("SESSION_FALLBACK_CALLED");},getSession(){throw Error("SESSION_FALLBACK_CALLED");}};
async function scenario(mode) {
  const events={},calls=[],select={value:branch,addEventListener:(n,fn)=>events[n]=fn};
  const panel={append(node){this.child=node;}};
  const document={getElementById:id=>id==="r4ManagedBranch"?select:panel,createElement:()=>({setAttribute(){},remove(){}}),addEventListener(){},removeEventListener(){}};
  let actor=actorId,mounts=0,opts;
  const root={location:{origin:"https://tennisnote-admin.pages.dev"},localStorage:fakeStore(()=>({sub:actor,session_id:"33333333-3333-4333-8333-333333333333"})),MutationObserver:class{observe(){} disconnect(){}},setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){},atob:s=>Buffer.from(s,"base64").toString("utf8"),
    TennisNoteR4ExistingAccount:{isProductionTarget:()=>true},
    TennisNoteR4ProductDraftCandidate:{mount(_node,o){mounts++;opts=o;return {destroy(){}};}}};
  const client={...noFallback,async rpc(name,args){calls.push({name,args});
    if (name==="tn_r4_prod_product_draft_get" && args.p_operation===null) {
      if(mode==="off") throw Error("r4_product_draft_disabled");
      if(mode==="stale") select.value="other";
      return {branchId:branch,status:"draft_access",draftOperationId:operation,internalRegistrationEnabled:mode==="on",public:false,saleEnabled:false,paymentEnabled:false};
    }
    return null;
  }};
  vm.runInNewContext(delta["r4-production-draft-host.js"].toString(),{window:root,document});
  const result=await root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true});
  if(mode==="off"||mode==="stale") {assert.equal(result,false);assert.equal(mounts,0);assert.equal(calls.length,1);return;}
  assert.equal(result,true);assert.equal(mounts,1);assert.equal(opts.draftOperationId,operation);
  await assert.rejects(()=>opts.client.rpc("tn_r4_prod_product_draft_save",{p_branch:branch,p_operation:"other"}));
  await assert.rejects(()=>opts.client.rpc("tn_r4_dev_product_draft_save",{p_branch:branch,p_operation:operation}));
  if(mode!=="on") await assert.rejects(()=>opts.client.internalRegistrationRpc("tn_r4_internal_product_register",{p_branch:branch,p_draft:operation}));
  await opts.client.rpc("tn_r4_prod_product_draft_get",{p_branch:branch,p_operation:operation});
  assert.equal(calls.length,2);
  actor="changed";
  await assert.rejects(()=>opts.client.rpc("tn_r4_prod_product_draft_get",{p_branch:branch,p_operation:operation}));
  assert.equal(calls.length,2);
}
async function sessionRace(phase) {
  const select={value:branch,addEventListener(){}};let removed=0,destroyed=0,mounts=0,opts,resolvePending;
  const panel={append(){}};const document={getElementById:id=>id==="r4ManagedBranch"?select:panel,createElement:()=>({setAttribute(){},remove(){removed++;}}),addEventListener(){},removeEventListener(){}};
  const root={location:{origin:"https://tennisnote-admin.pages.dev"},localStorage:fakeStore(()=>({sub:actorId,session_id:session,version})),MutationObserver:class{observe(){} disconnect(){}},setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){},atob:s=>Buffer.from(s,"base64").toString("utf8"),
    TennisNoteR4ExistingAccount:{isProductionTarget:()=>true},TennisNoteR4ProductDraftCandidate:{mount(_node,o){mounts++;opts=o;return {destroy(){destroyed++;}};}}};
  let session="33333333-3333-4333-8333-333333333333",version=1, calls=0;
  const access={branchId:branch,status:"draft_access",draftOperationId:operation,internalRegistrationEnabled:true,public:false,saleEnabled:false,paymentEnabled:false};
  const client={...noFallback,
    rpc:async(name,args)=>{calls++;if((phase==="probe"&&args.p_operation===null)||(phase==="get"&&args.p_operation!==null)) return new Promise(resolve=>{resolvePending=resolve;});return access;}};
  vm.runInNewContext(delta["r4-production-draft-host.js"].toString(),{window:root,document});
  if(phase==="probe") {
    const result=root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true});
    await Promise.resolve(); assert.equal(typeof resolvePending,"function");
    session="44444444-4444-4444-8444-444444444444";resolvePending(access);assert.equal(await result,false);assert.equal(mounts,0);assert.equal(calls,1);return;
  }
  assert.equal(await root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true}),true);
  version++;await opts.client.rpc("tn_r4_prod_product_draft_get",{p_branch:branch,p_operation:operation}).then(()=>{if(phase==="get")throw Error("UNEXPECTED");});
}
if(process.env.R4_PROD_STORAGE_ONLY) {
  let localToken=true,calls=0,destroyed=0,writes=0,fallback=0;const events={},select={value:branch,addEventListener(){}},panel={append(){}},form={hidden:false};
  const encoded=JSON.stringify({access_token:`x.${Buffer.from(JSON.stringify({sub:actorId,session_id:"33333333-3333-4333-8333-333333333333"})).toString("base64url")}.x`});
  const local={getItem(k){return k==="persist"?null:k==="auth"&&localToken?encoded:null;},setItem(){writes++;},removeItem(){writes++;}};
  const stale={getItem(){return encoded;},setItem(){writes++;},removeItem(){writes++;}};
  const doc={getElementById:id=>id==="r4ManagedBranch"?select:id==="r4BranchHoursForm"?form:panel,createElement:()=>({setAttribute(){},remove(){}}),addEventListener(n,fn){events[n]=fn;},removeEventListener(n){delete events[n];}};
  const root={location:{origin:"https://tennisnote-admin.pages.dev"},localStorage:local,sessionStorage:stale,MutationObserver:class{observe(){} disconnect(){}},setInterval:()=>1,clearInterval(){},addEventListener(n,fn){events[n]=fn;},removeEventListener(n){delete events[n];},atob:s=>Buffer.from(s,"base64").toString("utf8"),TennisNoteR4ExistingAccount:{isProductionTarget:()=>true},TennisNoteR4ProductDraftCandidate:{mount(){return {destroy(){destroyed++;}};}}};
  const client={authStorageKey:"auth",authPersistenceKey:"persist",getSession(){fallback++;return {access_token:"stale"};},sessionSubject(){fallback++;return actorId;},rpc:async()=>{calls++;return {branchId:branch,status:"draft_access",draftOperationId:operation,internalRegistrationEnabled:true,public:false,saleEnabled:false,paymentEnabled:false};}};
  vm.runInNewContext(delta["r4-production-draft-host.js"].toString(),{window:root,document:doc});
  assert.equal(await root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true}),true);
  localToken=false;events.storage();assert.equal(destroyed,1);assert.equal(writes,0);assert.equal(fallback,0);assert.equal(calls,1);
  console.log("PASS: removed canonical session closes panel, stale fallback untouched, mutation/RPC 0");
} else if(process.env.R4_PROD_IDLE_ONLY) {
  let session="33333333-3333-4333-8333-333333333333",version=1,calls=0,destroyed=0,removed=0,cleared=0;
  const events={},select={value:branch,addEventListener(){}},panel={append(){}},form={hidden:false};
  const doc={getElementById:id=>id==="r4ManagedBranch"?select:id==="r4BranchHoursForm"?form:panel,createElement:()=>({setAttribute(){},remove(){removed++;}}),addEventListener(n,fn){events[n]=fn;},removeEventListener(n){delete events[n];}};
  const root={location:{origin:"https://tennisnote-admin.pages.dev"},localStorage:fakeStore(()=>({sub:actorId,session_id:session,version})),MutationObserver:class{observe(){} disconnect(){}},setInterval:()=>1,clearInterval(){cleared++;},addEventListener(n,fn){events[n]=fn;},removeEventListener(n){delete events[n];},atob:s=>Buffer.from(s,"base64").toString("utf8"),TennisNoteR4ExistingAccount:{isProductionTarget:()=>true},TennisNoteR4ProductDraftCandidate:{mount(){return {destroy(){destroyed++;}};}}};
  const client={...noFallback,rpc:async()=>{calls++;return {branchId:branch,status:"draft_access",draftOperationId:operation,internalRegistrationEnabled:true,public:false,saleEnabled:false,paymentEnabled:false};}};
  vm.runInNewContext(delta["r4-production-draft-host.js"].toString(),{window:root,document:doc});
  assert.equal(await root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true}),true);
  version++;events.focus();assert.equal(destroyed,0);
  session="44444444-4444-4444-8444-444444444444";
  events.storage({get oldValue(){throw Error("EVENT_DATA_READ");},get newValue(){throw Error("EVENT_DATA_READ");}});
  assert.equal(destroyed,1);assert.equal(removed,1);assert.equal(cleared,1);assert.equal(calls,1);assert.equal(Object.keys(events).length,0);
  console.log("PASS: idle same-actor session switch closes panel without RPC; refresh preserved; listeners/timer removed");
} else if(process.env.R4_PROD_SESSION_ONLY) {
  // A refresh keeps session_id and is allowed; an actor-identical new session invalidates the panel.
  const select={value:branch,addEventListener(){}};let opts,removed=0,destroyed=0,calls=0,version=1,session="33333333-3333-4333-8333-333333333333";
  const doc={getElementById:id=>id==="r4ManagedBranch"?select:{append(){}},createElement:()=>({setAttribute(){},remove(){removed++;}}),addEventListener(){},removeEventListener(){}};
  const root={location:{origin:"https://tennisnote-admin.pages.dev"},localStorage:fakeStore(()=>({sub:actorId,session_id:session,version})),MutationObserver:class{observe(){} disconnect(){}},setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){},atob:s=>Buffer.from(s,"base64").toString("utf8"),TennisNoteR4ExistingAccount:{isProductionTarget:()=>true},TennisNoteR4ProductDraftCandidate:{mount(_n,o){opts=o;return {destroy(){destroyed++;}};}}};
  const access={branchId:branch,status:"draft_access",draftOperationId:operation,internalRegistrationEnabled:true,public:false,saleEnabled:false,paymentEnabled:false};
  let resolveRead;const client={...noFallback,rpc:async(_n,a)=>{calls++;if(a.p_operation===null)return access;return new Promise(resolve=>{resolveRead=resolve;});}};
  vm.runInNewContext(delta["r4-production-draft-host.js"].toString(),{window:root,document:doc});
  assert.equal(await root.TennisNoteR4ProductionDraftHost.open({client,branchId:branch,currentContext:()=>true}),true);
  version++;const read=opts.client.rpc("tn_r4_prod_product_draft_get",{p_branch:branch,p_operation:operation});
  session="44444444-4444-4444-8444-444444444444";resolveRead(null);await assert.rejects(()=>read);assert.equal(destroyed,1);assert.equal(removed,1);
  await assert.rejects(()=>opts.client.internalRegistrationRpc("tn_r4_internal_product_register",{p_branch:branch,p_draft:operation}));assert.equal(calls,2);
  await sessionRace("probe");
  console.log("PASS: same-actor session change blocks late probe/read and stale writes; same-session refresh accepted");
} else {
  for(const mode of ["off","stale","on","internal-off"]) await scenario(mode);
  console.log("PASS: exact 168 baseline and six-asset overlay; OFF/stale/session/operation/registration gates (synthetic only)");
}
