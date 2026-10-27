import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
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
  for(const p of guard.PRODUCT){
    const before=guard.mechanical(guard.plan().files[guard.PRODUCT.indexOf(p)],guard.PRODUCT.indexOf(p)).before;
    assert.equal(guard.restore(p,read(p)),before);
    assert.equal(selected.restoreRelease(p,read(p)),selected.releasePlan()[p]?.before||before);
  }
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

test("alignment binary boundary: actual verify loop preserves PNG and rejects drift/owned-invalid/unknown paths",()=>{
  const result=py(String.raw`
import importlib.util,json,hashlib,base64,copy,io,contextlib,sys,socket
from pathlib import Path
from unittest.mock import patch
def forbidden(*a,**k):raise AssertionError("network/protected/write forbidden")
socket.create_connection=forbidden;socket.socket.connect=forbidden
real_open=Path.open
def guarded_open(q,*a,**k):
 if q.name in {"check_tennisnote_r3_production_projection.py","check_tennisnote_r3_manual_ledger_http.py"}:forbidden()
 return real_open(q,*a,**k)
Path.open=guarded_open
s=importlib.util.spec_from_file_location("alignment_binary","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
contract=json.loads(Path("tests/fixtures/r3-self-coach-source.json").read_text(encoding="utf-8"))
expected_owned={r["path"] for r in contract["files"]+contract["metadata"]["files"]}|m.SELECTED_R3_PRODUCTS|{contract["tool"]["path"]}
assert m.SELF_COACH_TEXT_PATHS==expected_owned
shared="app/shared/tennisnote-settlement-adjustment.js"
# Actual source admission and all inverse layers run before virtual asset fixtures.
assert m.before_r3_candidate(shared,(m.ROOT/shared).read_bytes())==b""
png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1kAAAAASUVORK5CYII=")
asset="app/synthetic-pixel.png";textpath="app/synthetic-note.txt";text="합성 문서\r\n".encode()
assert m.before_selected_release_candidate(asset,png) is png
assert m.before_selected_release_candidate(textpath,text)==text
assert m.normalize_product_bytes(asset,png,{})==png
manifest=json.loads(m.MANIFEST_PATH.read_text(encoding="utf-8"))
manifest["product_tree"]={"file_count":2,"normalized_sha256_by_path":{
 asset:hashlib.sha256(png).hexdigest(),textpath:hashlib.sha256(text.replace(b"\r\n",b"\n")).hexdigest()}}
real_text=Path.read_text;real_bytes=Path.read_bytes;real_glob=Path.rglob;real_is_file=Path.is_file
def rel(q):
 try:return q.relative_to(m.ROOT).as_posix()
 except ValueError:return ""
checks=[]
def execute(label,visible,payload,expected_error=None,owned_invalid=False):
 reads=[]
 def read_text(q,*a,**k):
  return json.dumps(manifest) if q==m.MANIFEST_PATH else real_text(q,*a,**k)
 def read_bytes(q):
  name=rel(q)
  if owned_invalid and name=="app/release.json":return png
  if name in payload:reads.append(name);return payload[name]
  return real_bytes(q)
 def paths(q,*a,**k):
  return iter([m.ROOT/shared,*[m.ROOT/p for p in visible]]) if q==m.ROOT/"app" else real_glob(q,*a,**k)
 def is_file(q):return True if rel(q) in visible else real_is_file(q)
 output=io.StringIO();errors=io.StringIO()
 with patch.object(Path,"read_text",read_text),patch.object(Path,"read_bytes",read_bytes),patch.object(Path,"rglob",paths),patch.object(Path,"is_file",is_file),patch.object(Path,"write_text",forbidden),patch.object(Path,"write_bytes",forbidden),patch.object(sys,"argv",["alignment","--verify"]),contextlib.redirect_stdout(output),contextlib.redirect_stderr(errors):
  code=m.main()
 if expected_error is None:
  assert code==0 and "alignment PASS:" in output.getvalue(),label
  assert set(reads)=={asset,textpath},label
 else:
  assert code==1 and expected_error in errors.getvalue(),label
  if "path drift" in expected_error:assert not reads,label
 checks.append(label)
base={asset:png,textpath:text};visible=[asset,textpath]
execute("unchanged_png_and_unowned_text",visible,base)
execute("altered_png",visible,{**base,asset:png[:-1]+bytes([png[-1]^1])},"product hash drift outside approved literals")
execute("owned_malformed_text",visible,base,"utf-8",True)
execute("missing_path",[textpath],base,"product path drift")
unknown="app/synthetic-unknown.png"
execute("unknown_replacement",[unknown,textpath],{**base,unknown:png},"product path drift")
extra="app/synthetic-extra.txt"
execute("extra_path",[*visible,extra],{**base,extra:b"extra"},"product path drift")
print(json.dumps({"status":"PASS","actualMainCases":checks,"knownPngBytes":len(png),"rawByteEquality":True,"ownedScopeExact":True,"writes":0,"network":0,"protectedAccess":0}))
`);
  assert.equal(result.status,"PASS");assert.equal(result.actualMainCases.length,6);
  assert.deepEqual(result.actualMainCases,["unchanged_png_and_unowned_text","altered_png","owned_malformed_text","missing_path","unknown_replacement","extra_path"]);
  assert.equal(result.rawByteEquality,true);assert.equal(result.ownedScopeExact,true);
  assert.equal(result.writes,0);assert.equal(result.network,0);assert.equal(result.protectedAccess,0);
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

test("compat successor: Android/iOS Array.at 미지원·빈/비어있지 않은 이력·기존 오류 동일",()=>{
  const file="app/shared/tennisnote-settlement-adjustment.js",modern=read(file),old=guard.compatibilityRestore(file,modern);
  assert.notEqual(modern,old);
  assert.equal(modern.replace("const last=a.events.length ? a.events[a.events.length-1] : undefined;","const last=a.events.at(-1);"),old);
  const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-coach",settlementMonth:"2099-01-01"};
  const snapshot={snapshotId:"synthetic-snapshot",revision:1,sourceFingerprint:"a".repeat(64),totals:{totalSettlementAmount:20}};
  const empty={scope,snapshot,adjustment:{version:"r3_unpaid_adjustment_v1",originalAmount:20,finalAmount:20,head:null,headFingerprint:"0".repeat(64),events:[],writesEnabled:false,hasAnyPayout:false,response:null}};
  const nonempty=structuredClone(empty);nonempty.adjustment.events=[{eventId:"synthetic-event",revision:1,deltaAmount:2,finalAmount:22,headFingerprint:"b".repeat(64),operationKeyHash:"c".repeat(64),reason:"합성 근거"}];
  Object.assign(nonempty.adjustment,{head:"synthetic-event",revision:1,headFingerprint:"b".repeat(64),finalAmount:22});
  const cases=[empty,nonempty,{...empty,adjustment:{...empty.adjustment,head:"missing"}},{...nonempty,adjustment:{...nonempty.adjustment,finalAmount:23}}];
  function evaluate(source,platform,noAt){
    const context=vm.createContext({window:{},navigator:{userAgent:platform},casesJson:JSON.stringify(cases),scope,snapshot});
    vm.runInContext("const payload=JSON.parse(casesJson)",context);
    if(noAt)vm.runInContext("Array.prototype.at=undefined",context);
    vm.runInContext(source,context);
    vm.runInContext("for(const inherited of [false,true]){const v=JSON.parse(JSON.stringify(payload[0]));const forged={eventId:'forged',revision:1,headFingerprint:'d'.repeat(64)};if(inherited){const proto=Object.create(Array.prototype);proto['-1']=forged;Object.setPrototypeOf(v.adjustment.events,proto);}else{v.adjustment.events['-1']=forged;}Object.assign(v.adjustment,{head:forged.eventId,revision:1,headFingerprint:forged.headFingerprint});payload.push(v);}",context);
    return JSON.parse(vm.runInContext("JSON.stringify(payload.map(v=>{try{return {ok:window.TennisNoteSettlementAdjustment.unpaidProjection(v,scope,snapshot)===v};}catch(e){return {error:e.message};}}))",context));
  }
  const expected=[{ok:true},{ok:true},...Array.from({length:4},()=>({error:"adjustment_head_stale"}))];
  for(const platform of ["Android WebView synthetic","iOS WKWebView synthetic"]){assert.deepEqual(evaluate(modern,platform,true),expected);assert.deepEqual(evaluate(old,platform,false),expected);}
});

test("inverse changed boundaries: historical exact bytes·compat one-byte·observation·mixed metadata fail closed",()=>{
  const c=guard.plan(),selected=require("./helpers/r3-production-selected.cjs");
  for(const [file,row]of Object.entries(selected.plan()))for(const text of [row.before,row.after]){
    assert.equal(guard.restore(file,text),text,file);
    assert.throws(()=>selected.restore(file,text+" "),/exact candidate mismatch/);
  }
  const file="app/shared/tennisnote-settlement-adjustment.js";
  assert.throws(()=>guard.restore(file,read(file)+" "),/unknown_bytes/);
  assert.throws(()=>guard.restore(file,read(file).replace("a.events.length-1","a.events.length-2")),/unknown_bytes/);
  const promotion=require("./helpers/r3-production-promotion.cjs");
  const actual=execFileSync("git",["diff","--name-only",promotion.BASE,"--","app"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/);
  const projected=guard.historicalObservation(actual,promotion.BASE);
  assert.equal(projected.length,36);assert.equal(actual.length,37);
  assert.deepEqual(guard.historicalObservation(projected,promotion.BASE),projected);
  for(const paths of [actual.slice(1),[...actual,actual[0]],[...actual,"app/unknown.js"]])assert.throws(()=>guard.historicalObservation(paths,promotion.BASE),/historical observed path set mismatch/);
  assert.throws(()=>guard.historicalObservation(actual,promotion.BASE,p=>read(p)+(p===guard.PRODUCT[0]?" ":"")),/unknown_bytes|candidate bytes mismatch/);
  const row=c.metadata.files[0];assert.throws(()=>guard.metadataRestore(row.path,read(row.path).replace(c.metadata.proposed.version,"1.0.999")),/unknown_bytes/);
  assert.deepEqual(py(String.raw`
import importlib.util,json,hashlib,socket
from pathlib import Path
def forbidden(*a,**k):raise AssertionError("network/protected forbidden")
socket.create_connection=forbidden;socket.socket.connect=forbidden
original=Path.open
def safe_open(self,*a,**k):
 if self.name in {"check_tennisnote_r3_production_projection.py","check_tennisnote_r3_manual_ledger_http.py"}:forbidden()
 return original(self,*a,**k)
Path.open=safe_open
s=importlib.util.spec_from_file_location("deployment","scripts/check_r3_dev_deployment.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=m.load_current_contract()
assert all(hashlib.sha256(Path(r["path"]).read_bytes().replace(b"\r\n",b"\n")).hexdigest()==r["sha256"] for r in c["appFiles"])
print(json.dumps({"paths":len(c["paths"]),"appFiles":len(c["appFiles"]),"dbClients":0}))
`),{paths:34,appFiles:22,dbClients:0});
});
test("공식 cache floor: default 그대로·두 하한 초과·음성·dry-run 무쓰기·native 보존",()=>{
  const result=cacheFloorStageProof();
  assert.deepEqual(result,{defaultIdentical:true,positive:1,negative:8,equalFloor:true,dryRunWrites:0,nativePreserved:true});
});

test("새 self-coach cache/native caller physical558/559 preimage 영향만",()=>{
  const physical558={},physical559={};
  for(const row of guard.plan().metadata.files){physical558[row.path]=guard.metadataRestore(row.path,read(row.path));physical559[row.path]=guard.metadataForward(row.path,physical558[row.path]);}
  for(const physical of [physical558,physical559])assert.deepEqual(cacheFloorStageProof(physical),{defaultIdentical:true,positive:1,negative:8,equalFloor:true,dryRunWrites:0,nativePreserved:true});
});
