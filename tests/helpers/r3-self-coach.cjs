"use strict";
// New exact self-coach delta only; historical selected/BASIC expectations stay immutable.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="b7fe326b6b750f9be47db7eca64b03577359090f";
const FIXTURE="tests/fixtures/r3-self-coach-source.json";
const PRODUCT=["app/tennis-note-coach-app/data/auth.js","app/tennis-note-coach-app/data/sync.js","app/tennis-note-coach-app/domain/settlement.js","app/shared/tennisnote-settlement-adjustment.js","app/shared/tennisnote-ui-foundation.css","app/admin/data/billing.js","app/admin/actions/billing.js","app/admin/views/billing.js","app/tennis-note-coach-app/views/settlement.js","app/admin/index.html"];
const TOOL="scripts/bump_release.py";
const GUARDS=[FIXTURE,"tests/helpers/r3-self-coach.cjs","tests/r3-self-coach.test.js","tests/r3-unpaid-substitute.test.js",TOOL,"scripts/check_r3_dev_deployment.py","tests/fixtures/r3-current-dev-deployment.json","tests/r3-current-dev-deployment.test.js"];
const TOOL_AFTER="2010dc0ef78a2cf2bfb28e5c672fbd939428d6c36ce8a7442c95efa10ca3827d";
const APPROVED=["974731b39b9aec143bd9ff00f3ca04b051823861eaf787c4d9c666f357445ce6","3e7a5f3fdb1907b2272bf04814dd4ef27a6a0312e3d48e76de7bc5466a0a7a78","25552c63367476cb1ff4634799e4a08b8d7e7ae7558bfa26cdf9bd44b874ef8f","0cc1cef6b10ff1ce5a8ff6a6093f509fa5a03ee22f56e9e6d39102ebcd7389fe","7840c3435ceab526fcb6a000b082fcb222815b0f59a0c7ddea443bc560f81d76","a80af14c3b910e7cb72891cb7f49037e83849f0c95853ffdac01e1531a062636","1527b16a13edcdcca6456d34b61177d4938847290b3af0acc3514ac9e783596c","04d674e8726464e176f42063cb21b91636e55e12edb5eea0498e1d38eaddaef6","d9aba8637133ca2a87b02bf376fa8f53bf038ef32a2c6ce56d14a375c8197098","59635ae81476e72227d32255115e66904f7ef12aa3f0d37c6459357823f1e88d"];
const METADATA_SEAL="b9836171b7f68a8e1fcc4214dbca3fb2b9177edb061b6f9b7c39914628555e5d";
const normalize=s=>s.replace(/\r\n/g,"\n");
const sha=s=>crypto.createHash("sha256").update(normalize(s)).digest("hex");
function need(ok,code){if(!ok)throw Error(code);}
function plan(){
  const c=JSON.parse(fs.readFileSync(path.join(ROOT,FIXTURE),"utf8"));
  need(c.contract==="r3-self-coach-source/1"&&c.base===BASE&&c.tree==="f6e3f569a4b5b1d483e0fcdc884af1f919c38f7c"&&c.status==="COMBINED_FEATURE_METADATA_BRIDGE_PREPARED_APPLY0","self_coach_contract");
  need(JSON.stringify(c.files.map(x=>x.path))===JSON.stringify(PRODUCT),"self_coach_exact_product_paths");
  need(sha(JSON.stringify(c.metadata))===METADATA_SEAL&&c.metadata.files.length===13&&new Set(c.metadata.files.map(x=>x.path)).size===13&&c.metadata.applyCalls===0,"self_coach_metadata_recipe_seal");
  need(c.tool.path===TOOL&&c.tool.afterSha256===TOOL_AFTER,"self_coach_tool_contract");
  return c;
}
function mechanical(row,index){
  const before=normalize(execFileSync("git",["show",`${BASE}:${row.path}`],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
  need(sha(before)===row.beforeSha256&&row.afterSha256===(index===-1?TOOL_AFTER:APPROVED[index])&&row.hunks.length>0,"self_coach_source_pin");
  let after=before;for(const h of row.hunks){need(h.before&&h.after&&after.split(h.before).length===2,"self_coach_anchor");after=after.replace(h.before,h.after);}need(sha(after)===row.afterSha256,"self_coach_recipe");
  return {before,after};
}
function metadataSpans(row,text,forward){
  const value=normalize(text),from=forward?row.beforeSha256:row.afterSha256,to=forward?row.afterSha256:row.beforeSha256;
  need(sha(value)===from,"metadata_exact_source");
  const lines=value.match(/[^\n]*\n|[^\n]+$/g)||[];
  let last=-1;
  for(const span of row.spans){const at=forward?span.beforeLine:span.afterLine;need(Number.isInteger(at)&&at>=last,"metadata_span_order");last=at;}
  for(const span of [...row.spans].reverse()){
    const at=forward?span.beforeLine:span.afterLine,before=forward?span.before:span.after,replacement=forward?span.after:span.before;
    const count=(before.match(/[^\n]*\n|[^\n]+$/g)||[]).length;
    need(lines.slice(at,at+count).join("")===before,"metadata_span_source");
    lines.splice(at,count,...(replacement.match(/[^\n]*\n|[^\n]+$/g)||[]));
  }
  const result=lines.join("");need(sha(result)===to,"metadata_exact_result");return result;
}
function metadataForward(file,text){
  const row=plan().metadata.files.find(x=>x.path===file);need(row,"metadata_path_not_admitted");return metadataSpans(row,text,true);
}
function metadataRestore(file,text,c=plan()){
  const current=normalize(text),row=c.metadata.files.find(x=>x.path===file);if(!row)return current;
  const digest=sha(current);
  if(digest===row.afterSha256)return metadataSpans(row,current,false);
  if(digest===row.beforeSha256||(c.metadata.legacyAccepted[file]||[]).includes(digest))return current;
  throw Error("metadata_unknown_bytes_or_version");
}
function restore(file,text){
  const c=plan(),index=PRODUCT.indexOf(file),current=metadataRestore(file,text,c);
  if(index<0&&file!==TOOL)return current;
  const row=mechanical(index<0?c.tool:c.files[index],index);
  if(current===row.before||(c.metadata.legacyAccepted[file]||[]).includes(sha(current)))return current;
  need(current===row.after,"self_coach_unknown_bytes");return row.before;
}
function verifyCurrent(){
  const c=plan();for(const [i,row]of c.files.entries())need(metadataRestore(row.path,fs.readFileSync(path.join(ROOT,row.path),"utf8"),c)===mechanical(row,i).after,"self_coach_missing_product");
  need(normalize(fs.readFileSync(path.join(ROOT,TOOL),"utf8"))===mechanical(c.tool,-1).after,"self_coach_tool_drift");
  need(JSON.stringify(Object.keys(c.guardHashes).sort())===JSON.stringify(["tests/helpers/r3-self-coach.cjs","tests/r3-self-coach.test.js","tests/helpers/r3-production-selected.cjs","tests/helpers/r3-basic-refresh-production.cjs","scripts/check_tennisnote_dev_prod_alignment.py","tests/r3-production-selected.test.js","tests/r3-unpaid-substitute.test.js","scripts/check_r3_dev_deployment.py","tests/fixtures/r3-current-dev-deployment.json","tests/r3-current-dev-deployment.test.js"].sort()),"self_coach_guard_seal");
  for(const [file,digest]of Object.entries(c.guardHashes))need(sha(fs.readFileSync(path.join(ROOT,file),"utf8"))===digest,"self_coach_guard_drift");
  // Full physical stage: either all current feature558 or all planned559, never a mix.
  const release=JSON.parse(fs.readFileSync(path.join(ROOT,"app/release.json"),"utf8"));
  const planned=release.version===c.metadata.proposed.version&&release.releaseId===c.metadata.proposed.releaseId;
  need(planned||(release.version===c.metadata.old.version&&release.releaseId===c.metadata.old.releaseId),"self_coach_metadata_not_admitted");
  for(const row of c.metadata.files)need(sha(fs.readFileSync(path.join(ROOT,row.path),"utf8"))===(planned?row.afterSha256:row.beforeSha256),"metadata_mixed_or_unknown_stage");
}
function resolvePaths(paths,expected,label="self_coach_unknown_paths"){
  const historical=paths.length===new Set(paths).size&&JSON.stringify([...paths].sort())===JSON.stringify([...expected].sort());
  if(historical){verifyCurrent();return [...expected].sort();}
  const extras=[...PRODUCT.filter(p=>!expected.includes(p)),...GUARDS.filter(p=>paths.includes(p)&&!expected.includes(p))];
  const required=[...new Set([...expected,...extras])].sort();
  need(paths.length===new Set(paths).size&&JSON.stringify([...paths].sort())===JSON.stringify(required),label);
  verifyCurrent();return [...expected].sort();
}
module.exports={restore,verifyCurrent,resolvePaths,plan,mechanical,metadataForward,metadataRestore,PRODUCT,GUARDS};
if(require.main===module){try{const input=JSON.parse(fs.readFileSync(0,"utf8"));let value;
 if(process.argv[2]==="--restore")value=restore(input.path,input.text);
 else if(process.argv[2]==="--paths")value=resolvePaths(input.paths,input.expected);
 else throw Error("self_coach_mode");process.stdout.write(JSON.stringify(value));
}catch(error){process.stderr.write("SELF_COACH_SOURCE_REJECTED\n");process.exitCode=1;}}
