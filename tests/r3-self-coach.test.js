import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const require=createRequire(import.meta.url),guard=require("./helpers/r3-self-coach.cjs");
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8").replace(/\r\n/g,"\n");
const hash=s=>createHash("sha256").update(s).digest("hex");
const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
function py(code,input=null){return JSON.parse(execFileSync(python,["-B","-X","utf8","-c",code],{cwd:root,input:input===null?undefined:JSON.stringify(input),encoding:"utf8",maxBuffer:16*1024*1024,stdio:[input===null?"ignore":"pipe","pipe","pipe"]}));}

test("현재 결합 제품과 도구1의 exact 역변환; 한 바이트·누락 recipe 거부",()=>{
  const c=guard.plan();
  for(const [i,row]of [...c.files,c.tool].entries()){
    const index=i===c.files.length?-1:i,proof=guard.mechanical(row,index);
    assert.equal(guard.restore(row.path,read(row.path)),proof.before);
    assert.equal(hash(proof.before),row.beforeSha256);
    assert.equal(guard.restore(row.path,proof.before),proof.before);
    assert.throws(()=>guard.restore(row.path,proof.after+" "),/unknown_bytes/);
    assert.throws(()=>guard.mechanical({...row,hunks:[]},index),/source_pin/);
  }
  guard.verifyCurrent();
});

test("실제 기존 수집기와 Python 진입점이 새 층을 먼저 복원; unknown·중복·누락 거부",()=>{
  const selected=require("./helpers/r3-production-selected.cjs"),basic=require("./helpers/r3-basic-refresh-production.cjs");
  const expected=[...new Set([...Object.keys(selected.plan()),...selected.RELEASE_PATHS])];
  const observed=[...new Set([...expected,...guard.PRODUCT])];
  assert.deepEqual(guard.resolvePaths(observed,expected),[...expected].sort());
  for(const names of [[...observed,"app/unknown.js"],[...observed,observed[0]],observed.filter(p=>p!==expected[0])])assert.throws(()=>guard.resolvePaths(names,expected),/unknown_paths/);
  assert.deepEqual(selected.restoreProductPaths(observed),Object.keys(selected.plan()).sort());
  const basicObserved=[...new Set([...Object.keys(basic.plan()),...Object.keys(selected.plan()),...guard.PRODUCT])];
  basic.assertPathSet(basicObserved);
  for(const p of guard.PRODUCT)assert.equal(selected.restoreRelease(p,read(p)),guard.mechanical(guard.plan().files[guard.PRODUCT.indexOf(p)],guard.PRODUCT.indexOf(p)).before);
  const result=py(String.raw`
import importlib.util,json,hashlib
from pathlib import Path
s=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
paths=sorted(m.SELECTED_R3_PRODUCTS|m.BASIC_REFRESH_RELEASE_PATHS|{x["path"] for x in json.loads(Path("tests/fixtures/r3-self-coach-source.json").read_text())["files"]})
m.selected_release_assert_paths(paths)
row=json.loads(Path("tests/fixtures/r3-self-coach-source.json").read_text())["files"][0]
text=Path(row["path"]).read_bytes()
restored=m.before_selected_release_candidate(row["path"],text)
print(json.dumps({"restored":hashlib.sha256(restored).hexdigest(),"historicalReleasePaths":len(m.selected_release_plan())}))
`);
  assert.equal(result.restored,guard.plan().files[0].beforeSha256);assert.equal(result.historicalReleasePaths,13);
});

test("역사적 fake 입력은 유지하고 실제 새 파일은 별도 봉인; 기존 음성·도구 pin 유지",()=>{
  const selected=require("./helpers/r3-production-selected.cjs");
  const expected=[...new Set([...Object.keys(selected.plan()),...selected.RELEASE_PATHS])];
  assert.deepEqual(selected.restoreProductPaths(expected),Object.keys(selected.plan()).sort());
  for(const names of [expected.slice(1),[...expected,expected[0]],[...expected,"unknown.js"]])assert.throws(()=>selected.restoreProductPaths(names),/exact22 path set mismatch/);
  assert.deepEqual(selected.restoreCheckpointPaths(selected.CHECKPOINT_PATHS,[]),[]);
  assert.throws(()=>selected.restoreCheckpointPaths(selected.CHECKPOINT_PATHS.slice(1),[]),/checkpoint exact path set mismatch/);
  const source=read("tests/r3-production-selected.test.js");
  assert.match(source,/const raw = p => require\("\.\/helpers\/r3-self-coach\.cjs"\)\.restore/);
  assert.match(source,/assert.equal\(raw\("scripts\/bump_release.py"\),source\(pin.base,"scripts\/bump_release.py"\)\)/);
  assert.equal(guard.restore("scripts/bump_release.py",read("scripts/bump_release.py")),execFileSync("git",["show",guard.plan().base+":scripts/bump_release.py"],{cwd:root,encoding:"utf8"}).replace(/\r\n/g,"\n"));
});

function cacheFloorStageProof(physical=null){
  const result=py(String.raw`
import importlib.util,json,sys,io,contextlib,subprocess
from pathlib import Path
from unittest.mock import patch
s=importlib.util.spec_from_file_location("actual_bump","scripts/bump_release.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=json.loads(Path("tests/fixtures/r3-self-coach-source.json").read_text());v=json.load(sys.stdin)
physical=v.get("physical") or {r["path"]:Path(r["path"]).read_text(encoding="utf-8") for r in c["metadata"]["files"]}
stage=json.loads(physical["app/release.json"])["version"];assert stage in (c["metadata"]["old"]["version"],c["metadata"]["proposed"]["version"])
side="beforeSha256" if stage==c["metadata"]["old"]["version"] else "afterSha256"
import hashlib
assert all(hashlib.sha256(physical[r["path"]].encode()).hexdigest()==r[side] for r in c["metadata"]["files"])
restore_code="const f=require('fs'),g=require('./tests/helpers/r3-self-coach.cjs');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(s)).map(([p,t])=>[p,g.metadataRestore(p,t)])))));"
preimage=json.loads(subprocess.check_output(["node","-e",restore_code],input=json.dumps(physical).encode()))
real_read=Path.read_text
def preimage_read(q,*args,**kwargs):
 try:name=q.resolve().relative_to(m.ROOT).as_posix()
 except ValueError:return real_read(q,*args,**kwargs)
 return preimage[name] if name in preimage else real_read(q,*args,**kwargs)
raw=Path("scripts/bump_release.py").read_text(encoding="utf-8")
old=subprocess.check_output(["node","tests/helpers/r3-self-coach.cjs","--restore"],input=json.dumps({"path":"scripts/bump_release.py","text":raw}).encode())
old=json.loads(old)
ns={"__file__":str(Path("scripts/bump_release.py").resolve()),"__name__":"historical_bump"};exec(compile(old,"historical_bump","exec"),ns)
read=preimage_read
before=ns["plan_cache_names"](read);default=m.plan_cache_names(read)
assert before==default
floors=[int(x[3].rsplit("v",1)[1])+1 for x in before]
planned=m.plan_cache_names(read,*floors)
assert [int(x[4].rsplit("v",1)[1]) for x in planned]==[x+1 for x in floors]
negative=[(floors[0],None),(None,floors[1]),(-1,floors[1]),(0,floors[1]),("592",floors[1]),(True,floors[1]),(floors[0]-2,floors[1]),(floors[0],floors[1]-2)]
for values in negative:
 try:m.plan_cache_names(read,*values)
 except m.BumpError:pass
 else:raise AssertionError("floor_not_denied")
assert [int(x[4].rsplit("v",1)[1]) for x in m.plan_cache_names(read,floors[0]-1,floors[1]-1)]==floors
release=read(m.RELEASE_JSON);releasejs=read(m.RELEASE_JS);native=json.loads(release)["nativePlatforms"]
writes=[]
def no_write(*a,**k):writes.append(True);raise AssertionError("unexpected_write")
with patch.object(Path,"read_text",preimage_read),patch.object(sys,"argv",["bump","--next","--dry-run","--member-cache-floor",str(floors[0]),"--coach-cache-floor",str(floors[1])]),patch.object(Path,"write_text",no_write),contextlib.redirect_stdout(io.StringIO()) as output:
 assert m.read_current()[0]=="1.0.558"
 assert m.main()==0
assert not writes and "--dry-run" in output.getvalue()
assert read(m.RELEASE_JSON)==release and read(m.RELEASE_JS)==releasejs
with patch.object(Path,"read_text",preimage_read):
 merged=m.plan_release_json("1.0.558","1.0.559","2099.01.01.01","2099-01-01T00:00:00+09:00")[1]
 assert json.loads(merged)["nativePlatforms"]==native
 assert [line for line in m.plan_release_js("1.0.558","1.0.559","2099.01.01.01","2099-01-01T00:00:00+09:00")[1].splitlines() if "nativeShell" in line or "androidVersion" in line or "iosVersion" in line]==[line for line in releasejs.splitlines() if "nativeShell" in line or "androidVersion" in line or "iosVersion" in line]
print(json.dumps({"defaultIdentical":True,"positive":1,"negative":len(negative),"equalFloor":True,"dryRunWrites":len(writes),"nativePreserved":True}))
`,{physical});
  return result;
}
test("공식 cache floor: default 그대로·두 하한 초과·음성·dry-run 무쓰기·native 보존",()=>{
  const result=cacheFloorStageProof();
  assert.deepEqual(result,{defaultIdentical:true,positive:1,negative:8,equalFloor:true,dryRunWrites:0,nativePreserved:true});
});

test("새 self-coach cache/native caller physical558/559 preimage 영향만",()=>{
  const physical558={},physical559={};
  for(const row of guard.plan().metadata.files){physical558[row.path]=guard.metadataRestore(row.path,read(row.path));physical559[row.path]=guard.metadataForward(row.path,physical558[row.path]);}
  for(const physical of [physical558,physical559])assert.deepEqual(cacheFloorStageProof(physical),{defaultIdentical:true,positive:1,negative:8,equalFloor:true,dryRunWrites:0,nativePreserved:true});
});
