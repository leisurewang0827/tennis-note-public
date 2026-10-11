"use strict";
// 이번 승인 증분만 역변환한다. 기존 릴리스·역사적 golden은 변경하지 않는다.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(__dirname,"../fixtures/ci39-correction-parity.json"),"utf8");
assert.equal(hash(raw),"e90bfe72f20cb2304aa618a4b60e48c78d8624071527ca32c7f68e46f871b08b","CI39 correction contract drift");
const contract=JSON.parse(raw);
assert.equal(contract.publicParent,"fffc272c8155d00df741ea5b7cbf755a703d29db");
assert.equal(contract.privateParent,"790c8a7a8efff3c9525e6b4228e9312de03a212c");
assert.equal(contract.files.filter(x=>x.side==="public").length,4);
assert.equal(contract.files.filter(x=>x.side==="private").length,2);
function restore(file,text,side="public") {
  const row=contract.files.find(x=>x.side===side&&x.path===file);
  if(!row)return text;
  text=text.replace(/\r\n/g,"\n");
  if(hash(text)===row.beforeSha256)return text;
  assert.equal(hash(text),row.afterSha256,"CI39 correction candidate drift: "+file);
  for(const h of [...row.hunks].reverse()) {
    assert(h.after&&text.split(h.after).length===2,"CI39 unique hunk: "+file);
    text=text.replace(h.after,()=>h.before);
  }
  assert.equal(hash(text),row.beforeSha256,"CI39 exact parent drift: "+file);
  return text;
}
function verifyCurrent(root,side="public",reader=file=>fs.readFileSync(path.join(root,file),"utf8")) {
  assert(["public","private"].includes(side),"CI39 current source side unknown");
  assert.equal(typeof reader,"function","CI39 current source reader missing");
  for(const row of contract.files.filter(x=>x.side===side)) {
    const source=reader(row.path);assert.equal(typeof source,"string","CI39 current source reader missing: "+row.path);
    const text=source.replace(/\r\n/g,"\n");
    assert.equal(hash(text),row.afterSha256,"CI39 current source drift: "+row.path);
    restore(row.path,text,side);
  }
  return true;
}
module.exports={contract,hash,restore,verifyCurrent};
