"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
const root=path.resolve(__dirname,".."),runtime=require("./helpers/ci39-runtime.cjs");
runtime.register((name,fn)=>test(name,{timeout:3000},fn),root,"public");
runtime.registerActual((name,fn)=>test(name,{timeout:4000},fn),root,"public");
const correction=require("./helpers/ci39-correction-inverse.cjs"),provenance=require("./helpers/historical-added-assets.cjs");
test("CI39 delta historical fixtures: exact reviewed bytes restored without repinning",()=>{
  const crypto=require("node:crypto"),cp=require("node:child_process");
  const reviewed="e048a85ec59b39dfbaea0cff89d32564bad94157";
  const rows=[
    ["tests/fixtures/production-isolation-source.json","9bf5140063db78df3432928fa9ab56040ddc6230","c565b67ee3f687ac2c6191a9138da6840a9802d3bdb9864c72f094beeae242b3"],
    ["tests/fixtures/production-excel-refresh-source.json","c67f036354791d479a4a17aa8af8d4e922b1ac64","e6ca2ada8700537657add55a6ca35bc4c19951c9f69a8e57342fe5eaf85f7875"]
  ];
  for(const [name,blob,sha] of rows){
    const bytes=fs.readFileSync(path.join(root,name));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),sha);
    const r=cp.spawnSync("git",["rev-parse",reviewed+":"+name],{cwd:root,encoding:"utf8"});
    assert.equal(r.status,0);assert.equal(r.stdout.trim(),blob);
    const source=cp.spawnSync("git",["show",reviewed+":"+name],{cwd:root,maxBuffer:2*1024*1024});
    assert.equal(source.status,0);assert.deepEqual(bytes,source.stdout);
  }
});
test("CI39 delta provenance: exact four reviewed additions and both absence proofs",()=>{const rows=provenance.validateAll();assert.equal(rows.length,4);assert.equal(provenance.assertBoundedPaths(rows),true);});
test("CI39 delta provenance: changed, missing and fifth assets fail closed",()=>{
  const rows=provenance.contract.files;assert.throws(()=>provenance.validateAll(p=>fs.readFileSync(path.join(root,p),"utf8")+"\n//unknown"),/changed/);
  assert.throws(()=>provenance.validateAll(()=>{throw Error("synthetic-missing");}),/missing/);
  assert.throws(()=>provenance.assertBoundedPaths([...rows,{path:"app/shared/synthetic-fifth.js"}]));
  assert.throws(()=>provenance.assertBoundedPaths(rows.slice(1)));assert.throws(()=>provenance.assertBoundedPaths([...rows.slice(0,3),rows[0]]));
  assert.throws(()=>provenance.assertBoundedPaths(rows.map((r,i)=>i? r:{...r,blob:"0".repeat(40)})));
});
test("CI39 delta inverse: exact child->parent and byte mutation denied",()=>{
  assert.equal(correction.verifyCurrent(root),true);
  for(const row of correction.contract.files.filter(x=>x.side==="public")){const raw=fs.readFileSync(path.join(root,row.path),"utf8");assert.equal(correction.hash(correction.restore(row.path,raw)),row.beforeSha256);assert.throws(()=>correction.restore(row.path,raw+"\n//unknown"),/candidate drift/);}
});
test("CI39 delta historical preimage: exact HOLD hunk and additions bounded at original base",()=>{
  const {snapshotDelta:s}=provenance,raw=fs.readFileSync(path.join(root,s.path),"utf8");
  const restored=provenance.restoreReviewedSource(s.path,raw);
  assert.equal(correction.hash(restored),s.beforeSha256);
  assert.equal(provenance.restoreReviewedSource(s.path,restored),restored);
  assert.equal(raw.split(s.hunk).length,2);
  assert.throws(()=>provenance.restoreReviewedSource(s.path,raw+"\n//unknown"),/candidate drift/);
  for(const row of provenance.validateAll())provenance.assertAddedAbsentAt(s.base,row.path);
  assert.throws(()=>provenance.assertAddedAbsentAt(s.base,"app/shared/synthetic-fifth.js"));
  assert.throws(()=>provenance.assertAddedAbsentAt("0".repeat(40),provenance.contract.files[0].path));
});
const bounded=require("./helpers/production-isolation-historical-delta.cjs");
test("CI39 bounded: 29 exact source/commit/blob/47 hunk 보존",()=>{
  const rows=bounded.validateAll();assert.equal(rows.length,29);assert.equal(rows.reduce((n,r)=>n+r.hunks.length,0),47);
  assert.equal(rows.find(r=>r.path==="app/shared/tennisnote-single-sheet-transport.js").hunks.length,2);
  for(const row of rows){const raw=fs.readFileSync(path.join(root,row.path),"utf8"),restored=provenance.restoreReviewedSource(row.path,raw);
    assert.equal(bounded.hash(restored),row.beforeSha256);assert.equal(bounded.restore(row.path,restored),restored);}
});
test("CI39 bounded: unknown/missing/duplicate/base/blob/hunk/byte 모두 거절",()=>{
  const rows=bounded.contract.files;assert.throws(()=>bounded.assertBoundedPaths(rows.slice(1)));
  assert.throws(()=>bounded.assertBoundedPaths([...rows,rows[0]]));
  assert.throws(()=>bounded.assertBoundedPaths([...rows.slice(1),{...rows[0],path:"app/shared/synthetic-unknown.js"}]));
  assert.throws(()=>bounded.assertBoundedPaths(rows,"0".repeat(40)));
  assert.throws(()=>bounded.assertBoundedPaths(rows.map((r,i)=>i?r:{...r,blob:"0".repeat(40)})));
  for(const row of rows){const raw=fs.readFileSync(path.join(root,row.path),"utf8");
    assert.throws(()=>bounded.restore(row.path,raw+"\n//unknown"),/candidate drift/);
    assert.throws(()=>bounded.restore(row.path,raw+row.hunks[0].after),/candidate drift/);
    assert.throws(()=>bounded.reverse({...row,hunks:row.hunks.slice(1)},raw),/baseline drift/);
  }
  assert.throws(()=>bounded.reverse(null,""),/unknown/);
});
test("CI39 bounded: shared2 별도 exact hunk / 기존6 pin 불변",()=>{
  const crypto=require("node:crypto");
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,"tests/fixtures/ci39-correction-parity.json"))).digest("hex"),"e90bfe72f20cb2304aa618a4b60e48c78d8624071527ca32c7f68e46f871b08b");
  const row=bounded.contract.shared.find(r=>r.side==="public"),raw=fs.readFileSync(path.join(root,row.path),"utf8");
  assert.equal(bounded.hash(bounded.restoreShared(row.path,raw)),row.beforeSha256);
  assert.throws(()=>bounded.restoreShared(row.path,raw+"\n//unknown"),/candidate drift/);
  assert.throws(()=>bounded.restoreShared(row.path,raw+row.hunks[0].after),/candidate drift/);
  assert.throws(()=>bounded.reverse({...row,hunks:row.hunks.slice(1)},raw),/baseline drift/);
});
