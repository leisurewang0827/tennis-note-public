const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const mechanical=require('./helpers/release-freeze-mechanical.cjs'),correction=require('./helpers/ci39-correction-inverse.cjs'),bounded=require('./helpers/production-isolation-historical-delta.cjs'),checkout=require('./helpers/release-checkout-layout.cjs');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const preview='app/shared/tennisnote-single-sheet-preview-ui.js',shared='app/shared/tennisnote-data-client.js';
test('nine-link current preview and historical preimage are explicitly distinct, immutable pins',()=>{
  const raw=read(preview);assert.equal(mechanical.hash(raw),'71ce704b6b1c880db4dc396f4975b1a9c6b494952c81cc8a5ffe87644c8a51a9');
  assert.equal(mechanical.hash(mechanical.restore(preview,raw)),'09d4e6c62f752f844532fa1622fd28c87f4522519e1d1b29586f39499c4b7c49');
  assert.throws(()=>mechanical.restore(preview,raw+'x'),/drift/);
  assert.match(read('tests/excel-signup-source-parity.test.js'),/legacy-integrated-source\.cjs'\)\.raw\(item\.path\)/);
});
test('nine-link unknown stage/side/reference path is rejected, never implicit fallback',()=>{
  for(const stage of ['',null,'current','unknown'])assert.throws(()=>mechanical.restore(preview,read(preview),'public',stage),/stage unknown/);
  assert.throws(()=>mechanical.restore(preview,read(preview),'unknown'),/side unknown/);
  assert.throws(()=>mechanical.restore(preview,read(preview),'public','pinned-private-reference'),/mismatch/);
  assert.throws(()=>mechanical.restore('90-Dashboard/unknown.js','unknown','private','pinned-private-reference'),/mismatch/);
  assert.throws(()=>mechanical.currentRows('public','pinned-private-reference'),/mismatch/);
});
test('nine-link exact injected reader is propagated once per union path and cannot invent missing input',()=>{
  const rows=mechanical.currentRows(),sources=new Map(rows.map(r=>[r.path,read(r.path)])),seen=[];
  assert.equal(new Set(rows.map(r=>r.path)).size,rows.length);
  assert.equal(mechanical.verifyCurrent('unavailable-root','public',file=>{seen.push(file);return sources.get(file);}),true);
  assert.deepEqual(seen,rows.map(r=>r.path));
  assert.throws(()=>mechanical.verifyCurrent('unavailable-root','public',null),/reader missing/);
  assert.throws(()=>correction.verifyCurrent('unavailable-root','public',null),/reader missing/);
  for(const r of [rows[0],rows.find(r=>r.kind==='correction'),rows.find(r=>r.path===shared)]){
    assert.throws(()=>mechanical.verifyCurrent('unavailable-root','public',p=>p===r.path?undefined:sources.get(p)),/reader missing/);
    assert.throws(()=>mechanical.verifyCurrent('unavailable-root','public',p=>p===r.path?sources.get(p)+'x':sources.get(p)),/unfrozen current/);
  }
});
test('nine-link pinned private reference cannot masquerade as actual corrected private source',()=>{
  const reader=p=>checkout.projectPrivate(p);
  assert.equal(mechanical.verifyCurrent('no-private-checkout','private',reader,'pinned-private-reference'),true);
  assert.throws(()=>mechanical.verifyCurrent('no-private-checkout','private',reader),/unfrozen current correction/);
  assert.throws(()=>mechanical.verifyCurrent('no-private-checkout','private',reader,'unknown'),/stage unknown/);
});
test('nine-link shared inverse rejects altered, missing, duplicate hunk before durable golden',()=>{
  const raw=read(shared),row=bounded.contract.shared.find(r=>r.side==='public'),h=row.hunks[0];
  assert.equal(mechanical.hash(bounded.restoreShared(shared,raw)),row.beforeSha256);
  for(const changed of [raw+'x',raw.replace(h.after,''),raw.replace(h.after,()=>h.after+h.after)])assert.throws(()=>bounded.restoreShared(shared,changed),/drift/);
});
test('nine-link Python metadata/historical adapters agree with JS and refuse unknown/drift stages',()=>{
  const code=`
import copy,json,sys,hashlib
sys.path.insert(0,'scripts')
import tennisnote_release_freeze_inverse as f
paths=list(f.CURRENT_OUTER)
def rejected(callback):
    try: callback()
    except RuntimeError: return
    raise AssertionError('drift accepted')
results={}
for p in paths:
    data=(f.ROOT/p).read_bytes()
    results[p]=hashlib.sha256(f.restore_bytes(p,data,stage='historical-integrated')).hexdigest()
    rejected(lambda: f.restore_bytes(p,data+b'x',stage='historical-integrated'))
    row=f.CURRENT_OUTER[p];h=row['hunks'][0];text=data.decode('utf-8').replace('\\r\\n','\\n')
    for bad in [text.replace(h['after'],''),text.replace(h['after'],h['after']+h['after'])]:
        rejected(lambda: f.restore_bytes(p,bad.encode(),stage='historical-integrated'))
    invalid=copy.deepcopy(row);invalid['hunks'][0]['after']+='synthetic-drift'
    rejected(lambda: f._reverse(p,data,invalid))
rejected(lambda: f.restore_bytes('unknown',b'unchanged',stage='unknown'))
rejected(lambda: f.restore_bytes('../unknown',b'unchanged'))
rejected(lambda: f._load_reviewed('ci39-correction-parity.json','0'*64))
print(json.dumps(results,sort_keys=True))
`;
  const result=JSON.parse(cp.execFileSync(process.env.TENNISNOTE_TEST_PYTHON||'python',['-B','-c',code],{cwd:root,encoding:'utf8'}));
  for(const [p,h] of Object.entries(result))assert.equal(mechanical.hash(mechanical.restore(p,read(p))),h,p);
  assert.equal(Object.keys(result).length,5);
});
