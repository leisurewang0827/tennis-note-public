import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import profileCore from "./helpers/profile-core-authority.cjs";
const root=path.resolve(import.meta.dirname,"..");
const files=Object.keys(profileCore.authority).sort();
const sources=new Map(files.map(file=>[path.join(root,file),fs.readFileSync(path.join(root,file))]));
const fixtureReader=sourceMap=>file=>{
  if(!sourceMap.has(file))throw Object.assign(Error("synthetic missing source"),{code:"ENOENT"});
  return sourceMap.get(file);
};
test("portable core: current checkout requires all three exact authority sources",()=>{
  const result=profileCore.verifyProfileCore(root);assert.equal(result.ok,true);
  assert.deepEqual(result.files.map(x=>x.path),files);
  for(const row of result.files)assert.equal(row.sha256,profileCore.authority[row.path]);
});
for(const file of files)test("portable core: missing source fails: "+file,()=>{
  const changed=new Map(sources);changed.delete(path.join(root,file));
  assert.throws(()=>profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(changed)),/profile_core_missing/);
});
for(const file of files)test("portable core: one changed byte fails: "+file,()=>{
  const changed=new Map(sources),source=Buffer.from(changed.get(path.join(root,file)));source[0]^=1;changed.set(path.join(root,file),source);
  assert.throws(()=>profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(changed)),/profile_core_source_drift/);
});
test("portable core: unknown reference pin fails before any source read",()=>{
  const unknown={...profileCore.authority,[files[0]]:"0".repeat(64)};let reads=0;
  assert.throws(()=>profileCore.verifyProfileCore(root,unknown,()=>{reads++;}),/profile_core_reference_unknown/);assert.equal(reads,0);
});
test("portable core: extra or incomplete reference cannot weaken the three-file contract",()=>{
  const extra={...profileCore.authority,"app/synthetic-extra.js":"0".repeat(64)},missing={...profileCore.authority};delete missing[files[0]];let reads=0;
  for(const reference of [extra,missing,null,Object.create(null)])assert.throws(()=>profileCore.verifyProfileCore(root,reference,()=>{reads++;}),/profile_core_reference_unknown/);assert.equal(reads,0);
});
test("portable core: disk source and trusted local fixture yield identical decisions",()=>{
  const disk=profileCore.verifyProfileCore(root),fixture=profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(sources));assert.deepEqual(disk,fixture);
  const changed=new Map(sources);changed.delete(path.join(root,files[1]));assert.throws(()=>profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(changed)),/profile_core_missing/);
});
test("portable core: only established CRLF-to-LF normalization is allowed",()=>{
  const crlf=new Map([...sources].map(([p,b])=>[p,Buffer.from(b.toString("utf8").replace(/\r\n/g,"\n").replace(/\n/g,"\r\n"))]));
  assert.deepEqual(profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(crlf)),profileCore.verifyProfileCore(root));
});
test("portable core: invalid UTF8 and substituted paths fail closed",()=>{
  const invalid=new Map(sources);invalid.set(path.join(root,files[0]),Buffer.from([0xff]));assert.throws(()=>profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(invalid)),/profile_core_source_encoding_unknown/);
  const swapped=new Map(sources);swapped.set(path.join(root,files[0]),sources.get(path.join(root,files[1])));assert.throws(()=>profileCore.verifyProfileCore(root,profileCore.authority,fixtureReader(swapped)),/profile_core_source_drift/);
});
test("portable core: helper uses no Git, external object repo, environment, or history",()=>{
  const source=fs.readFileSync(path.join(root,"tests/helpers/profile-core-authority.cjs"),"utf8"),required=[];
  const permitted=new Set(["node:fs","node:path","node:assert/strict","node:crypto"]);
  const context=vm.createContext({Buffer,module:{exports:{}},require:name=>{required.push(name);assert(permitted.has(name),"unexpected dependency");return ({"node:fs":fs,"node:path":path,"node:assert/strict":assert,"node:crypto":{createHash:()=>{throw Error("hash module replaced below");}}})[name];}});
  // Use only standard crypto; no child_process or process object is available in this sandbox.
  return import("node:crypto").then(crypto=>{
    context.require=name=>{required.push(name);assert(permitted.has(name),"unexpected dependency");return {"node:fs":fs,"node:path":path,"node:assert/strict":assert,"node:crypto":crypto}[name];};
    vm.runInContext(source,context);const result=context.module.exports.verifyProfileCore(root);assert.equal(result.ok,true);assert.equal(result.files.length,3);assert.equal(required.length,4);
  });
});
test("portable core: authorised test adapter inverse is exact and rejects unknown drift",()=>{
  const current=fs.readFileSync(path.join(root,"tests/integrated-feature-parity.test.js"),"utf8"),before=profileCore.restoreTestAdapter(current);
  assert.notEqual(before,current);assert.match(before,/assert\.equal\(fs\.existsSync\(path\.join\(root,p\)\),false\)/);
  assert.throws(()=>profileCore.restoreTestAdapter(current+"\n"),/portable_test_adapter_source_drift/);
});
test("portable core: mechanical assertion input is restored without changing its assertions",()=>{
  const source=fs.readFileSync(path.join(root,"tests/release-freeze-mechanical.test.js"),"utf8");
  assert.equal(source.split('profileCore.restoreTestAdapter(read("public","tests/integrated-feature-parity.test.js"))').length-1,1);
  assert.match(source,/assert\.equal\(reverted,before\)/);
});
