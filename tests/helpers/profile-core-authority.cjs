"use strict";
// PROD/DEV에서 같다고 검토된 3파일은 존재와 고정 LF/UTF-8 해시를 함께 검사한다.
// Git/외부 저장소/환경변수/네트워크가 아닌 현재 checkout만 사용한다.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const hash=source=>crypto.createHash("sha256").update(source).digest("hex");
const authority=Object.freeze({
  "app/tennis-note-member-app/actions/profile.js": "b11fcb3ffaad339c7380d57eee74f2f6d4532c5b08f30285c32b8dcd6e1edaf1",
  "app/tennis-note-member-app/events/profile.js": "c40c0ab68b483d435423a5d28cbd7181eadb4ff973bc77bc456533a5ad1e2654",
  "app/tennis-note-member-app/views/profile.js": "8f903815d66c07ce7159c2842abc4b93053153848be4a8d6a30ce8602f32d98a"
});
function verifyProfileCore(root,reference=authority,reader=fs.readFileSync){
  const expected=Object.keys(authority).sort();
  assert(reference&&Object.getPrototypeOf(reference)===Object.prototype,"profile_core_reference_unknown");
  assert.deepEqual(Object.keys(reference).sort(),expected,"profile_core_reference_unknown");
  for(const file of expected)assert.equal(reference[file],authority[file],"profile_core_reference_unknown");
  const files=[];
  for(const file of expected){
    let bytes;try{bytes=reader(path.join(root,file));}catch(error){if(error?.code==="ENOENT")throw Error("profile_core_missing: "+file);throw error;}
    assert(Buffer.isBuffer(bytes),"profile_core_source_encoding_unknown");
    const source=bytes.toString("utf8");assert(Buffer.from(source,"utf8").equals(bytes),"profile_core_source_encoding_unknown");
    const canonical=source.replace(/\r\n/g,"\n");assert.equal(hash(canonical),authority[file],"profile_core_source_drift: "+file);
    files.push({path:file,sha256:authority[file]});
  }
  return {ok:true,contract:"profile-core-authority/1",files};
}
// 승인한 검사 input delta만 정확히 되돌려 기존 mechanical assertion/golden을 보존한다.
function restoreTestAdapter(source){
  assert.equal(hash(source),"dda947cd648c7f4284f0a152f78f168ffe6b2c92e9e81404e938abbc712fec49","portable_test_adapter_source_drift");
  const addedImport="\nimport profileCore from \"./helpers/profile-core-authority.cjs\";",newCase="test(\"all unchanged profile core three are exact PROD and DEV\",()=>{const result=profileCore.verifyProfileCore(root);assert.equal(result.ok,true);assert.equal(result.files.length,3);});",oldCase="test(\"all unchanged profile core three are exact PROD and DEV\",()=>{for(const file of [\"actions/profile.js\",\"events/profile.js\",\"views/profile.js\"]){const p=\"app/tennis-note-member-app/\"+file;assert.equal(get(publicRepo,dev,p),get(publicRepo,prod,p));assert.equal(fs.existsSync(path.join(root,p)),false);}});";
  assert.equal(source.split(addedImport).length-1,1,"portable_test_adapter_import_drift");
  assert.equal(source.split(newCase).length-1,1,"portable_test_adapter_case_drift");
  const before=source.replace(addedImport,"").replace(newCase,oldCase);
  assert.equal(hash(before),"eee0086fd40ae2d8f9207f37382145cfa2a1c1dac0bd8fe6e99a850b932f45cf","portable_test_adapter_baseline_drift");return before;
}
module.exports={authority,verifyProfileCore,restoreTestAdapter,hash};
