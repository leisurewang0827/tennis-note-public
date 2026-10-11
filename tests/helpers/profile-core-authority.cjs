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
// Current connector delta is pinned separately; the original two historical pins stay immutable.
function restoreCurrentTestConnector(source){
  const original="dda947cd648c7f4284f0a152f78f168ffe6b2c92e9e81404e938abbc712fec49";
  if(hash(source)===original)return source;
  assert.equal(hash(source),"3fbb91d5865bd9eb7a0faa4f8411b66c7b1d4381a33126233bf83f03861f5731","portable_test_adapter_source_drift");
  const h={"before":"function fn(s,n){const m=s.match(new RegExp(\"^(?:async )?function \"+n+\"\\\\(\",\"m\"));assert(m,n);const a=s.slice(m.index),e=a.search(/^\\}/m);assert(e>=0,\"top-level function boundary\");return a.slice(0,e+1).trim();}\nfor(const row of integration.contract.files) test(\"new outer inverse closes reviewed and DEV source: \"+row.path,()=>{\n  const text=current(row.path);assert.equal(hash(text),row.afterSha256);\n  assert.equal(integration.restore(row.path,text,\"development\"),row.developmentSource);\n  assert.equal(integration.restore(row.path,text),row.reviewedSource);\n  assert.throws(()=>integration.restore(row.path,text+\"\\n\"),/drift/);\n});\ntest(\"R3 inverse contract preserved without golden repin\",()=>{assert.equal(hash(read(\"tests/fixtures/r3-manual-ledger-release-parity.json\")),\"03f6688fc31517f55a5f999f4c1a13502876b762641b416dcdb4409068c0ac16\");assert.equal(hash(read(\"tests/fixtures/self-profile-a-only.json\")),\"b418eab72b86167c64d255ef847d344134c53b0d83ea26d60cdfcd40b3177dd8\");assert.match(read(\"tests/helpers/self-profile-a-only.cjs\"),/r3\\.restoreCandidate/);});\ntest(\"new integration still restores exact PROD A-only source before all old assertions\",()=>{\n  for(const row of aOnly.contract.files){const s=current(row.path);assert.equal(hash(aOnly.undoRelease(row.path,s)),row.afterHash);assert.equal(aOnly.restoreCandidate(row.path,s),get(publicRepo,aOnly.contract.base,row.path));}\n});\ntest(\"new integration still restores every exact reviewed R3 product before historical evidence\",()=>{\n  for(const row of r3.contract.products){const restored=r3.restoreCandidate(row.path,current(row.path));if(row.status===\"A\")assert.equal(restored,null);else assert.equal(restored,get(publicRepo,prod,row.path));}","after":"// Inverse APIs consume current bytes themselves; never feed an already unwrapped historical stage twice.\nconst rawCurrent=file=>fs.existsSync(path.join(root,file))?norm(fs.readFileSync(path.join(root,file),\"utf8\")):get(publicRepo,dev,file);\nfunction fn(s,n){const m=s.match(new RegExp(\"^(?:async )?function \"+n+\"\\\\(\",\"m\"));assert(m,n);const a=s.slice(m.index),e=a.search(/^\\}/m);assert(e>=0,\"top-level function boundary\");return a.slice(0,e+1).trim();}\nfor(const row of integration.contract.files) test(\"new outer inverse closes reviewed and DEV source: \"+row.path,()=>{\n  const text=current(row.path);assert.equal(hash(text),row.afterSha256);\n  const raw=rawCurrent(row.path);assert.equal(mechanical.restore(row.path,raw),text);\n  assert.equal(integration.restore(row.path,raw,\"development\"),row.developmentSource);\n  assert.equal(integration.restore(row.path,raw),row.reviewedSource);\n  assert.notEqual(raw+\"\\n\",raw);assert.throws(()=>integration.restore(row.path,raw+\"\\n\"),/drift/);\n});\ntest(\"R3 inverse contract preserved without golden repin\",()=>{assert.equal(hash(read(\"tests/fixtures/r3-manual-ledger-release-parity.json\")),\"03f6688fc31517f55a5f999f4c1a13502876b762641b416dcdb4409068c0ac16\");assert.equal(hash(read(\"tests/fixtures/self-profile-a-only.json\")),\"b418eab72b86167c64d255ef847d344134c53b0d83ea26d60cdfcd40b3177dd8\");assert.match(read(\"tests/helpers/self-profile-a-only.cjs\"),/r3\\.restoreCandidate/);});\ntest(\"new integration still restores exact PROD A-only source before all old assertions\",()=>{\n  for(const row of aOnly.contract.files){const s=rawCurrent(row.path);assert.equal(hash(aOnly.undoRelease(row.path,s)),row.afterHash);assert.equal(aOnly.restoreCandidate(row.path,s),get(publicRepo,aOnly.contract.base,row.path));}\n});\ntest(\"new integration still restores every exact reviewed R3 product before historical evidence\",()=>{\n  for(const row of r3.contract.products){const raw=rawCurrent(row.path),restored=r3.restoreCandidate(row.path,raw);if(row.status===\"A\")assert.equal(restored,null);else assert.equal(restored,get(publicRepo,prod,row.path));assert.throws(()=>r3.restoreCandidate(row.path,raw+\"\\n\"),/drift/);}\n});\ntest(\"current test connector inverse retains old pins and rejects unknown/missing/duplicate bytes\",()=>{\n  const source=fs.readFileSync(path.join(root,\"tests/integrated-feature-parity.test.js\"),\"utf8\");\n  const before=profileCore.restoreTestAdapter(source);assert.equal(hash(before),\"eee0086fd40ae2d8f9207f37382145cfa2a1c1dac0bd8fe6e99a850b932f45cf\");\n  const marker=['const','rawCurrent=file=>'].join(' ');assert.equal(source.split(marker).length,2);\n  for(const changed of [source+\"x\",source.replace(marker,\"\"),source.replace(marker,()=>marker+marker)]){\n    assert.notEqual(changed,source);assert.throws(()=>profileCore.restoreTestAdapter(changed),/portable_test_adapter_source_drift/);\n  }"};
  assert.equal(source.split(h.after).length-1,1,"portable_test_adapter_hunk_drift");
  const before=source.replace(h.after,()=>h.before);
  assert.equal(hash(before),original,"portable_test_adapter_baseline_drift");return before;
}
function restoreTestAdapter(source){
  source=restoreCurrentTestConnector(source);
  assert.equal(hash(source),"dda947cd648c7f4284f0a152f78f168ffe6b2c92e9e81404e938abbc712fec49","portable_test_adapter_source_drift");
  const addedImport="\nimport profileCore from \"./helpers/profile-core-authority.cjs\";",newCase="test(\"all unchanged profile core three are exact PROD and DEV\",()=>{const result=profileCore.verifyProfileCore(root);assert.equal(result.ok,true);assert.equal(result.files.length,3);});",oldCase="test(\"all unchanged profile core three are exact PROD and DEV\",()=>{for(const file of [\"actions/profile.js\",\"events/profile.js\",\"views/profile.js\"]){const p=\"app/tennis-note-member-app/\"+file;assert.equal(get(publicRepo,dev,p),get(publicRepo,prod,p));assert.equal(fs.existsSync(path.join(root,p)),false);}});";
  assert.equal(source.split(addedImport).length-1,1,"portable_test_adapter_import_drift");
  assert.equal(source.split(newCase).length-1,1,"portable_test_adapter_case_drift");
  const before=source.replace(addedImport,"").replace(newCase,oldCase);
  assert.equal(hash(before),"eee0086fd40ae2d8f9207f37382145cfa2a1c1dac0bd8fe6e99a850b932f45cf","portable_test_adapter_baseline_drift");return before;
}
module.exports={authority,verifyProfileCore,restoreTestAdapter,hash};
