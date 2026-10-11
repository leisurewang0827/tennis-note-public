import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
const require=createRequire(import.meta.url),stage=require("./helpers/r3-confirmation-current-stage.cjs");
const root=path.resolve(import.meta.dirname,".."),read=file=>fs.readFileSync(path.join(root,file),"utf8").replace(/\r\n/g,"\n");
test("R3 current copy delta restores exact published parent, no historical golden repin",()=>{
 for(const row of stage.rows("public")){
  const current=read(row.path),parent=execFileSync("git",["show",row.parent+":"+row.path],{cwd:root,encoding:"utf8",maxBuffer:8e6}).replace(/\r\n/g,"\n");
  assert.equal(stage.hash(current),row.afterSha256);assert.equal(stage.hash(parent),row.beforeSha256);
  assert.equal(stage.restore(row.path,current),parent);assert.equal(stage.restore(row.path,parent),parent);
  for(const h of row.hunks)for(const bad of [current+"x",current.replace(h.after,""),current.replace(h.after,()=>h.after+h.after)])assert.throws(()=>stage.restore(row.path,bad),/drift/);
 }
});
test("R3 current and historical controls are distinct; old no-write DOM contract remains",()=>{
 const legacy=require("./helpers/legacy-integrated-source.cjs"),current=read("app/admin/index.html"),historical=legacy.read("app/admin/index.html");
 assert.match(current,/id="monthlySettlementPrimaryAction"[^>]*disabled>월 정산 확정/);
 assert(!historical.includes('id="monthlySettlementPrimaryAction"'));
 assert(!historical.includes('id="monthlySettlementConfirmation"'));
 assert.equal(require("./helpers/release-freeze-mechanical.cjs").verifyCurrent(root),true);
 const runner=read("scripts/check_tennisnote_r3_effective_browser.cjs");
 for(const marker of ["current disabled click and actual caller write RPC0","capability-off","loading","submitting","owner","request","scope","lost-confirm","logical operation physical writes1","terminal duplicate write RPC0"])assert(runner.includes(marker),marker);
});
test("R3 private authority and public current wording preserve confirmation versus actual transfer",()=>{
 for(const side of ["public","private"]){
  const rows=stage.rows(side),copy=rows.flatMap(r=>r.hunks.map(h=>h.after)).join("\n");
  for(const value of ["월 정산 확정","월 정산 확정 중","월 정산 확정 완료","실제 송금이 아닙니다"])assert(copy.includes(value),side+":"+value);
 }
 assert.doesNotMatch(stage.contract.files.flatMap(r=>r.hunks.map(h=>h.after)).join("\n"),/rpc\(|fetch\(|INSERT|UPDATE|DELETE|new Function/);
});
test("R3 current wording Python/JS inverse agreement and altered source fail-closed",()=>{
 const code=`import json,sys,hashlib
sys.path.insert(0,'scripts')
import tennisnote_release_freeze_inverse as f
f.verify_current()
results={}
for p,r in f.CONFIRMATION_ROWS.items():
 data=(f.ROOT/p).read_bytes()
 restored=f._reverse(p,data,r)
 results[p]=hashlib.sha256(restored).hexdigest()
 try: f.restore_bytes(p,data+b'x')
 except RuntimeError: pass
 else: raise AssertionError('current drift accepted')
print(json.dumps(results))`;
 const result=JSON.parse(execFileSync(process.env.TENNISNOTE_TEST_PYTHON||"python",["-B","-c",code],{cwd:root,encoding:"utf8"}));
 for(const row of stage.rows("public"))assert.equal(result[row.path],row.beforeSha256);
});
