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
const LEGACY_BASE="8aada4bc43e275c2474c71a535c7e94eca4f26b5";
const COMPAT_PATH=PRODUCT[3];
const COMPAT_PRIOR_SHA="53523a187b1148d47f0853a852247c12452694d2262e9406d786489a98778c34";
const COMPAT_BEFORE="const last=a.events.at(-1);",COMPAT_AFTER="const last=a.events.length ? a.events[a.events.length-1] : undefined;";
const normalize=s=>s.replace(/\r\n/g,"\n");
const sha=s=>crypto.createHash("sha256").update(normalize(s)).digest("hex");
function need(ok,code){if(!ok)throw Error(code);}
function byteError(code){const error=Error(code);error.code="SELF_COACH_BYTES";throw error;}
function compatibilityRestore(file,text){
  const value=normalize(text);if(file!==COMPAT_PATH)return value;
  const digest=sha(value);
  // Pure, zero-I/O stage dispatch: both unchanged historical source images stay exact.
  if(digest===APPROVED[3]||digest===COMPAT_PRIOR_SHA)return value;
  if(value.split(COMPAT_AFTER).length!==2)byteError("self_coach_unknown_bytes");
  const restored=value.replace(COMPAT_AFTER,COMPAT_BEFORE);
  // The whole old after-image, not a mutable fixture or a matching token, is authority.
  if(sha(restored)!==APPROVED[3])byteError("self_coach_unknown_bytes");
  return restored;
}
let legacyPlan;
function exactLegacy(file,text){
  const original=normalize(execFileSync("git",["show",`${LEGACY_BASE}:${file}`],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
  if(text===original)return true;
  const frozen=JSON.parse(execFileSync("git",["show",`${BASE}:tests/fixtures/r3-production-selected-source.json`],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
  if(!frozen.files.some(r=>r.path===file&&r.candidateSha256===sha(text)))return false;
  if(!legacyPlan){
    const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
    legacyPlan=JSON.parse(execFileSync(python,["-B","-X","utf8","-c","import importlib.util,json; s=importlib.util.spec_from_file_location('a','scripts/check_tennisnote_dev_prod_alignment.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(json.dumps(m.selected_r3_plan()))"],{cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]}));
  }
  need(legacyPlan[file]?.before===original,"legacy_mechanical_source");
  return text===legacyPlan[file].after;
}
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
  const current=require("./r3-coach-entry-successor.cjs").prior(file,text),row=c.metadata.files.find(x=>x.path===file);if(!row)return current;
  const digest=sha(current);
  if(digest===row.afterSha256)return metadataSpans(row,current,false);
  if(digest===row.beforeSha256||(c.metadata.legacyAccepted[file]||[]).includes(digest))return current;
  if(exactLegacy(file,current))return current;
  byteError("metadata_unknown_bytes_or_version");
}
function restore(file,text){
  const c=plan(),index=PRODUCT.indexOf(file),current=metadataRestore(file,compatibilityRestore(file,text,c),c);
  if(index<0&&file!==TOOL)return current;
  const row=mechanical(index<0?c.tool:c.files[index],index);
  if(current===row.before||(c.metadata.legacyAccepted[file]||[]).includes(sha(current)))return current;
  if(current===row.after)return row.before;
  if(file!==TOOL&&exactLegacy(file,current))return current;
  byteError("self_coach_unknown_bytes");
}
function verifyCurrent(){
  const successor=require("./r3-coach-entry-successor.cjs");
  const read=file=>successor.prior(file,fs.readFileSync(path.join(ROOT,file),"utf8"));
  if(JSON.parse(fs.readFileSync(path.join(ROOT,"app/release.json"),"utf8")).version==="1.0.561")successor.verifyCurrent();
  const c=plan();for(const [i,row]of c.files.entries())need(metadataRestore(row.path,compatibilityRestore(row.path,fs.readFileSync(path.join(ROOT,row.path),"utf8"),c),c)===mechanical(row,i).after,"self_coach_missing_product");
  need(normalize(fs.readFileSync(path.join(ROOT,TOOL),"utf8"))===mechanical(c.tool,-1).after,"self_coach_tool_drift");
  need(JSON.stringify(Object.keys(c.guardHashes).sort())===JSON.stringify(["tests/helpers/r3-self-coach.cjs","tests/r3-self-coach.test.js","tests/helpers/r3-production-selected.cjs","tests/helpers/r3-basic-refresh-production.cjs","scripts/check_tennisnote_dev_prod_alignment.py","tests/r3-production-selected.test.js","tests/r3-unpaid-substitute.test.js","scripts/check_r3_dev_deployment.py","tests/fixtures/r3-current-dev-deployment.json","tests/r3-current-dev-deployment.test.js"].sort()),"self_coach_guard_seal");
  for(const [file,digest]of Object.entries(c.guardHashes))need(sha(read(file))===digest,"self_coach_guard_drift");
  // Full physical stage: either all current feature558 or all planned559, never a mix.
  const release=JSON.parse(read("app/release.json"));
  const planned=release.version===c.metadata.proposed.version&&release.releaseId===c.metadata.proposed.releaseId;
  need(planned||(release.version===c.metadata.old.version&&release.releaseId===c.metadata.old.releaseId),"self_coach_metadata_not_admitted");
  for(const row of c.metadata.files)need(sha(read(row.path))===(planned?row.afterSha256:row.beforeSha256),"metadata_mixed_or_unknown_stage");
}
function resolvePaths(paths,expected,label="self_coach_unknown_paths"){
  const historical=paths.length===new Set(paths).size&&JSON.stringify([...paths].sort())===JSON.stringify([...expected].sort());
  if(historical){verifyCurrent();return [...expected].sort();}
  const added=require("./r3-coach-entry-successor.cjs").plan().addedPaths;
  const extras=[...PRODUCT.filter(p=>!expected.includes(p)),...[...GUARDS,...added].filter(p=>paths.includes(p)&&!expected.includes(p))];
  const required=[...new Set([...expected,...extras])].sort();
  if(!(paths.length===new Set(paths).size&&JSON.stringify([...paths].sort())===JSON.stringify(required))){const error=Error(label);error.code="SELF_COACH_PATHS";throw error;}
  verifyCurrent();return [...expected].sort();
}
function historicalObservation(paths,base,read=file=>fs.readFileSync(path.join(ROOT,file),"utf8")){
  need(base==="686cc97d9676da2d16ca3cdfbd862dc9cd19434e","historical_observation_base");
  const historical=execFileSync("git",["diff","--name-only",base,BASE,"--","app"],{cwd:ROOT,encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean);
  const projected=resolvePaths(paths,historical,"selected R3 historical observed path set mismatch");
  for(const file of PRODUCT.filter(p=>paths.includes(p))){
    const before=normalize(execFileSync("git",["show",`${BASE}:${file}`],{cwd:ROOT,encoding:"utf8"}));
    let restored;
    try{restored=restore(file,read(file));}catch(error){if(error.code!=="SELF_COACH_BYTES")throw error;throw Error("selected R3 historical candidate bytes mismatch: "+file);}
    need(restored===before,"selected R3 historical candidate bytes mismatch");
  }
  for(const file of paths.filter(p=>!historical.includes(p))){
    const before=normalize(execFileSync("git",["show",`${BASE}:${file}`],{cwd:ROOT,encoding:"utf8"}));
    const old=normalize(execFileSync("git",["show",`${base}:${file}`],{cwd:ROOT,encoding:"utf8"}));
    need(restore(file,read(file))===before&&before===old,"selected R3 historical candidate bytes mismatch");
  }
  return projected;
}
module.exports={restore,verifyCurrent,resolvePaths,plan,mechanical,metadataForward,metadataRestore,compatibilityRestore,historicalObservation,PRODUCT,GUARDS};
if(require.main===module){try{const input=JSON.parse(fs.readFileSync(0,"utf8"));let value;
 if(process.argv[2]==="--restore")value=restore(input.path,input.text);
 else if(process.argv[2]==="--paths")value=resolvePaths(input.paths,input.expected);
 else throw Error("self_coach_mode");process.stdout.write(JSON.stringify(value));
}catch(error){process.stderr.write(["SELF_COACH_BYTES","SELF_COACH_PATHS"].includes(error.code)?error.code+"\n":"SELF_COACH_CONTRACT\n");process.exitCode=1;}}
