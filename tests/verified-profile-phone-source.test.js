const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname,"..");
const port=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/verified-profile-phone-source-parity.json"),"utf8"));
const version=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version;
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const {restorePhone,restoreOperationStatus}=require("./helpers/verified-profile-phone-port.cjs");
test("본인 번호 exact private authority와 공개 metadata 방어 보존",()=>{
  for(const item of port.functions){
    const source=restoreOperationStatus(item.path,fs.readFileSync(path.join(root,item.path),"utf8").replace(/\r\n/g,"\n"));
    const fn=source.match(new RegExp("^(?:async )?function "+item.name+"\\([\\s\\S]*?^}","m"));
    assert(fn,item.name);assert.equal(hash(fn[0]),item.publicSha256,item.name);
    if(item.adapter==="exact_private_function")assert.equal(item.privateSha256,item.publicSha256);
  }
  const source=fs.readFileSync(path.join(root,"app/tennis-note-member-app/domain/identity.js"),"utf8");
  const fn=source.match(/function verifiedPhoneFromAuthUser\([\s\S]*?\n}/)[0];
  assert(!fn.includes("user_metadata"));assert(fn.includes("if (strict)"));
});

test("OTP 확인 줄바꿈 최소 CSS는 canonical private 블록과 exact hash parity",()=>{
  const item=port.otpConfirmStyle;
  const css=fs.readFileSync(path.join(root,item.publicPath),"utf8").replace(/\r\n/g,"\n");
  const block=css.match(/\/\* OTP input is the flexible column;[\s\S]*?#profilePhoneVerifyButton \{[\s\S]*?\n\}/)[0];
  assert.equal(hash(block),item.blockSha256);
  assert(block.includes("minmax(0, 1fr) auto"));assert(block.includes("min-width: 64px"));
  assert(block.includes("white-space: nowrap"));assert(block.includes("font-size: 16px"));
  assert.equal(item.adapter,"exact_private_css_block");
});
test("승인 번호 이식 inverse가 기존 golden 파일을 정확히 복구",()=>{
  for(const row of port.files){
    let source=restoreOperationStatus(row.path,fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n")).split(version).join(port.publicVersion);
    assert.equal(hash(source),row.candidateSha256,row.path);
    for(const h of [...row.hunks].reverse()){
      assert.equal(source.split(h.after).length-1,1,row.path);source=source.replace(h.after,h.before);
    }
    assert.equal(hash(source),row.baseSha256,row.path);
  }
});

test("전화번호 projection 추가·중복·누락 drift는 기존 golden 이전에 차단",()=>{
  for(const row of port.files){
    const source=fs.readFileSync(path.join(root,row.path),"utf8").replace(/\r\n/g,"\n");
    const restored=restorePhone(row.path,source).split(version).join(port.publicVersion);
    assert.equal(hash(restored),row.baseSha256,row.path);
    const after=row.hunks.at(-1).after;
    assert.equal(source.split(after).length,2,row.path);
    for(const drift of [source+"\n",source.replace(after,()=>after+after),source.replace(after,"")]){
      assert.throws(()=>restorePhone(row.path,drift),/phone candidate drift/);
    }
  }
});

test("전화번호 브라우저 단독 변경도 PR·push 필터와 full verify에 필수 연결",()=>{
  const runner="scripts/check_tennisnote_verified_profile_phone_browser.cjs";
  const workflow=fs.readFileSync(path.join(root,".github/workflows/tennisnote-public-ci.yml"),"utf8");
  const verify=fs.readFileSync(path.join(root,"scripts/verify.sh"),"utf8");
  assert.equal(workflow.split('      - "'+runner+'"').length-1,2);
  assert.equal(verify.split("node "+runner).length-1,1);
});
