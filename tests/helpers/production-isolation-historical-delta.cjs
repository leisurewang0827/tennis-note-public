"use strict";
// 검사 전용 exact 증분 역변환. 제품/허용 경로/golden을 바꾸지 않는다.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),norm=s=>s.replace(/\r\n/g,"\n"),hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const bytes=fs.readFileSync(path.join(root,"tests/fixtures/production-isolation-historical-delta.json"));
assert.equal(hash(bytes),"ca06b5537bb4328b365bde336fce6d159a9f8413a8065028632aab43a2329059","bounded historical fixture drift");
const contract=JSON.parse(bytes);
assert.equal(contract.version,"ci39-historical-bounded/1");
assert.equal(contract.base,"648ac3387f11ad65e7631ad32e4a9a06b511d49c");
assert.equal(contract.frozen,"fffc272c8155d00df741ea5b7cbf755a703d29db");
assert.equal(contract.files.length,29);assert.equal(new Set(contract.files.map(r=>r.path)).size,29);
assert.deepEqual(contract.shared.map(r=>r.side+":"+r.path),["private:90-Dashboard/shared/tennisnote-data-client.js","public:app/shared/tennisnote-data-client.js"]);
function assertBoundedPaths(rows,base=contract.base){
  assert.equal(base,contract.base,"bounded historical base drift");
  assert.equal(rows.length,29,"bounded historical path count drift");
  assert.equal(new Set(rows.map(r=>r.path)).size,29,"bounded historical duplicate path");
  for(const row of rows)assert.deepEqual(row,contract.files.find(r=>r.path===row.path),"bounded historical unknown path/metadata");
  return true;
}
function reverse(row,text){
  assert(row,"bounded unknown source");text=norm(text);
  if(hash(text)===row.beforeSha256)return text;
  assert.equal(hash(text),row.afterSha256,"bounded candidate drift: "+row.path);
  for(const h of [...row.hunks].reverse()){
    assert(h.name&&h.before&&h.after,"bounded empty/unnamed hunk");
    assert.equal(text.split(h.after).length,2,"bounded unique hunk: "+h.name);
    text=text.replace(h.after,()=>h.before);
  }
  assert.equal(hash(text),row.beforeSha256,"bounded baseline drift: "+row.path);
  return text;
}
function restore(file,text){const row=contract.files.find(r=>r.path===file);return !row||text===null?text:reverse(row,text);}
function restoreShared(file,text,side="public"){
  const row=contract.shared.find(r=>r.path===file&&r.side===side);return !row||text===null?text:reverse(row,text);
}
const git=args=>norm(cp.execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:12e6}));
function validateAll(reader=file=>fs.readFileSync(path.join(root,file),"utf8")){
  assertBoundedPaths(contract.files);
  for(const row of contract.files){
    const text=norm(reader(row.path));assert.equal(hash(text),row.afterSha256,"bounded current source drift: "+row.path);
    assert.equal(git(["rev-parse",row.reviewed+":"+row.path]).trim(),row.blob,"bounded reviewed blob drift");
    assert.equal(hash(git(["show",row.reviewed+":"+row.path])),row.afterSha256,"bounded reviewed content drift");
    assert.equal(hash(git(["show",contract.frozen+":"+row.path])),row.afterSha256,"bounded frozen drift");
    assert.equal(hash(git(["show",contract.base+":"+row.path])),row.beforeSha256,"bounded base content drift");
    assert.equal(hash(reverse(row,text)),row.beforeSha256);
  }
  return contract.files;
}
module.exports={contract,hash,assertBoundedPaths,reverse,restore,restoreShared,validateAll};
