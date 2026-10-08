const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname,"..");
const port=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/verified-profile-phone-source-parity.json"),"utf8"));
const version=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version;
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
test("본인 번호 exact private authority와 공개 metadata 방어 보존",()=>{
  for(const item of port.functions){
    const source=fs.readFileSync(path.join(root,item.path),"utf8").replace(/\r\n/g,"\n");
    const fn=source.match(new RegExp("^(?:async )?function "+item.name+"\\([\\s\\S]*?^}","m"));
    assert(fn,item.name);assert.equal(hash(fn[0]),item.publicSha256,item.name);
    if(item.adapter==="exact_private_function")assert.equal(item.privateSha256,item.publicSha256);
  }
  const source=fs.readFileSync(path.join(root,"app/tennis-note-member-app/domain/identity.js"),"utf8");
  const fn=source.match(/function verifiedPhoneFromAuthUser\([\s\S]*?\n}/)[0];
  assert(!fn.includes("user_metadata"));assert(fn.includes("if (strict)"));
});
test("승인 번호 이식 inverse가 기존 golden 파일을 정확히 복구",()=>{
  for(const row of port.files){
    let source=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n").split(version).join(port.publicVersion);
    assert.equal(hash(source),row.candidateSha256,row.path);
    for(const h of [...row.hunks].reverse()){
      assert.equal(source.split(h.after).length-1,1,row.path);source=source.replace(h.after,h.before);
    }
    assert.equal(hash(source),row.baseSha256,row.path);
  }
});
