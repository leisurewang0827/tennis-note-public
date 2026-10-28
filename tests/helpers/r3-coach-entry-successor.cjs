"use strict";
// 559 증거는 변경하지 않는다. 승인된 호출1 + 공식 metadata13만 먼저 되돌린다.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),BASE="cd5cffc22bef8a0bfb290e9a7a327573172ec931";
const FIXTURE="tests/fixtures/r3-coach-entry-successor.json",SEAL="f902db54a9298450f2050127bc006868b950a2153857251e6caabbcb1d4ee8e3";
const normalize=s=>s.replace(/\r\n/g,"\n"),sha=s=>crypto.createHash("sha256").update(normalize(s)).digest("hex");
const read=p=>normalize(fs.readFileSync(path.join(ROOT,p),"utf8"));
function need(ok,code){if(!ok)throw Error("coach_entry_successor_"+code);}
function plan(){
  const raw=read(FIXTURE);need(sha(raw)===SEAL,"seal");const c=JSON.parse(raw);
  need(c.contract==="r3-coach-entry-successor/1"&&c.base===BASE,"identity");
  need(c.files.length===new Set(c.files.map(x=>x.path)).size&&c.files.filter(x=>x.kind==="metadata").length===13&&c.files.filter(x=>x.kind==="product").length===1,"scope");
  return c;
}
function transform(row,text,forward){
  const value=normalize(text);need(sha(value)===(forward?row.beforeSha256:row.afterSha256),"source_bytes");
  const lines=value.match(/[^\n]*\n|[^\n]+$/g)||[];let last=-1;
  for(const h of row.spans){const at=forward?h.beforeLine:h.afterLine;need(Number.isInteger(at)&&at>=last,"span_order");last=at;}
  for(const h of [...row.spans].reverse()){
    const at=forward?h.beforeLine:h.afterLine,before=forward?h.before:h.after,after=forward?h.after:h.before;
    const n=(before.match(/[^\n]*\n|[^\n]+$/g)||[]).length;
    need(lines.slice(at,at+n).join("")===before,"span_source");lines.splice(at,n,...(after.match(/[^\n]*\n|[^\n]+$/g)||[]));
  }
  const result=lines.join("");need(sha(result)===(forward?row.afterSha256:row.beforeSha256),"result_bytes");return result;
}
function restore(file,text){
  const row=plan().files.find(x=>x.path===file),value=normalize(text);
  if(!row)return value;
  if(sha(value)===row.beforeSha256)return value;
  return transform(row,value,false);
}
function prior(file,text){
  // 과거 층의 입력은 과거 검증기가 판정한다. 새 after-image만 exact inverse 적용.
  const row=plan().files.find(x=>x.path===file),value=normalize(text);
  return row&&sha(value)===row.afterSha256?transform(row,value,false):value;
}
function verifyCurrent(reader=read){
  const c=plan();
  for(const row of c.files){
    const before=normalize(execFileSync("git",["show",`${BASE}:${row.path}`],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
    need(sha(before)===row.beforeSha256,"frozen_source");
    need(normalize(reader(row.path))===transform(row,before,true),"current_bytes");
  }
  return c;
}
function historicalFiles(){return Object.fromEntries(plan().files.map(r=>[r.path,prior(r.path,read(r.path))]));}
function deploymentContract(){
  const s=verifyCurrent(),c=JSON.parse(read("tests/fixtures/r3-current-dev-deployment.json"));
  c.successorBase=BASE;c.successorTree=s.baseTree;c.contract="r3-coach-entry-dev-deployment/1";
  c.paths=[...new Set([...c.paths,...s.files.map(r=>r.path),...s.addedPaths])].sort();
  const replacements=new Map(s.files.filter(r=>r.path.startsWith("app/")).map(r=>[r.path,r.afterSha256]));
  c.appFiles=c.appFiles.map(r=>({path:r.path,sha256:replacements.get(r.path)||r.sha256}));
  c.release=s.release;return c;
}
module.exports={plan,transform,restore,prior,verifyCurrent,historicalFiles,deploymentContract,BASE,FIXTURE};
if(require.main===module){try{
  if(process.argv[2]!=="--deployment-contract")throw Error("mode");
  process.stdout.write(JSON.stringify(deploymentContract()));
}catch{process.stderr.write("COACH_ENTRY_SUCCESSOR_REJECTED\n");process.exitCode=1;}}
