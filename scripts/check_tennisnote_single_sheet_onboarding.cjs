/* Synthetic in-memory catalog/transport regression. No files, hosted DB or credentials. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto,createHash}=require("node:crypto");
const api=require("../app/shared/tennisnote-single-sheet-import.js");
const XLSX=require("../app/shared/vendor/xlsx.full.min.js");
const {snapshot,rewrite}=require("./check_tennisnote_single_sheet_products.cjs");
async function run(){
 let n=0;const check=(v,c)=>{n++;if(!v)throw Error(c);};
 const rejects=(f,c)=>{try{f();throw Error("NOT_REJECTED");}catch(e){check(e.message===c,"REJECT_"+c);}};
 const snap=snapshot(32);
 snap.coaches=Array.from({length:2},(_,i)=>({id:`coach-${i}`,branch_id:snap.branchId,display_name:`합성 코치 ${i}`,status:"approved",employment_status:"active",archived_at:null,deleted_at:null}));
 const bytes=api.buildProductTemplateBytes(XLSX,snap),w=XLSX.read(bytes,{type:"array",bookFiles:true,cellStyles:true});
 check((await api.readFile(bytes,XLSX)).errors.join()==="EMPTY_DATA","NEW_TEMPLATE_ACCEPTED");
 check(api.productNames(snap).length===32&&api.coachNames(snap).length===2,"EXACT_CATALOG_COUNTS");
 check(w.Workbook.Names.length===2&&w.Workbook.Names[0].Ref==="'상품목록'!$A$2:$A$33"&&w.Workbook.Names[1].Ref==="'상품목록'!$B$2:$B$3","PRODUCT_REFERENCE_UNCHANGED_COACH_ADDED");
 check(w.Sheets["상품목록"].B2.v===snap.coaches[0].display_name,"EXACT_DISPLAY_NAME");
 for(const count of [1,2,33,137]) {
  const s=snapshot(2);s.coaches=Array.from({length:count},(_,i)=>({...snap.coaches[0],id:`c${i}`,display_name:`합성 ${i}`,branch_id:s.branchId}));
  check((await api.readFile(api.buildProductTemplateBytes(XLSX,s),XLSX)).errors.join()==="EMPTY_DATA","UNEQUAL_COLUMN_LENGTHS");
 }
 for(const patch of [{branch_id:"other"},{status:"pending"},{employment_status:"inactive"},{archived_at:"synthetic"},{deleted_at:"synthetic"},{display_name:"=unsafe"}]) rejects(()=>api.coachNames({...snap,coaches:[{...snap.coaches[0],...patch}]}),"TEMPLATE_COACHES_INVALID");
 rejects(()=>api.coachNames({...snap,coaches:[]}),"TEMPLATE_COACHES_REQUIRED");
 rejects(()=>api.coachNames({...snap,coaches:[snap.coaches[0],{...snap.coaches[1],display_name:snap.coaches[0].display_name}]}),"TEMPLATE_COACHES_AMBIGUOUS");
 for(const change of [xml=>xml.replace('sqref="C2:C501"','sqref="E2:E501"'),xml=>xml.replace('TN_CoachOptions','OTHER'),xml=>xml.replace('count="2"','count="1"')]) {
  const bad=rewrite(bytes,"xl/worksheets/sheet1.xml",change);
  check((await api.readFile(bad,XLSX)).errors.includes("PRODUCT_CATALOG_UNSAFE"),"TAMPERED_COACH_VALIDATION_BLOCKED");
 }
 const legacy=api.buildProductTemplateBytes(XLSX,snapshot(32));
 check((await api.readFile(legacy,XLSX)).errors.join()==="EMPTY_DATA","LEGACY_PRODUCT_ONLY_ACCEPTED");
 const branch="11111111-1111-4111-8111-111111111111",ref="syntheticprojectref",fp=createHash("sha256").update(ref).digest("hex");
 const config={environment:"development",projectFingerprint:fp,supabaseUrl:`https://${ref}.supabase.co`,singleSheetImportMode:"preview"};
 const ctx=vm.createContext({module:{exports:{}},exports:{},location:{origin:"https://tennisnote-admin-dev.pages.dev",hostname:"tennisnote-admin-dev.pages.dev"},crypto:webcrypto,TextEncoder,atob:v=>Buffer.from(v,"base64").toString("binary"),Date,Uint8Array,JSON});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../app/shared/tennisnote-single-sheet-transport.js"),"utf8"),ctx);
 let current=branch,reads=0,writes=0,mode="ok";
 const coaches=Array.from({length:137},(_,i)=>({...snap.coaches[0],id:`c${i}`,display_name:`합성 ${i}`,branch_id:branch}));
 const client={loadConfig:()=>config,getSession:()=>({access_token:`x.${Buffer.from(JSON.stringify({role:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")}.x`}),rpc:async()=>{writes++;throw Error("UNEXPECTED_RPC");},selectRows:async(table,o)=>{
  reads++;check(table==="tn_coach_roles"&&o.filters.branch_id===branch&&o.filters.status==="approved"&&o.filters.employment_status==="active"&&o.filters.archived_at.is===null&&o.filters.deleted_at.is===null,"SERVER_COACH_FILTER_PARITY");
  if(mode==="drift")current="22222222-2222-4222-8222-222222222222";
  return mode==="bad"?null:coaches.slice(o.offset,o.offset+o.limit);
 }};
 const t=await ctx.module.exports.create({client,getBranchId:()=>current,canOpen:()=>true});
 const result=await t.templateCoaches();check(result.complete&&result.coaches.length===137&&reads===2&&writes===0,"COACH_PAGINATION_READ_ONLY");
 mode="bad";await t.templateCoaches().then(()=>check(false,"BAD"),e=>check(e.message==="TEMPLATE_COACHES_INVALID","QUERY_FAIL_CLOSED"));
 mode="drift";await t.templateCoaches().then(()=>check(false,"DRIFT"),e=>check(e.message==="TARGET_OR_REVISION_MISMATCH","STALE_BRANCH_FAIL_CLOSED"));
 const before=reads;await t.templateCoaches().catch(()=>{});check(reads===before&&writes===0,"STALE_ZERO_READ_OR_WRITE");
 return n;
}
if(require.main===module)run().then(n=>console.log(`PASS onboarding catalog ${n} assertions; DB=0 network=0 files=0`)).catch(e=>{console.error(`FAIL onboarding catalog ${/^[A-Z0-9_]+$/.test(e.message)?e.message:e.name}`);process.exitCode=1;});
module.exports={run};
