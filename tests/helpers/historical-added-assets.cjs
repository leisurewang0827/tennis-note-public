"use strict";
// 정확한 검토 커밋/블롭으로 증명된 네 파일만 역사적 archive에서 제외한다.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(root,"tests/fixtures/historical-added-asset-provenance.json"),"utf8");
assert.equal(hash(raw),"3b95d9af446f54f54ab27012232625803600408030112583ccd3c784a00b895e","historical provenance contract drift");
const contract=JSON.parse(raw);
const boundedDelta=require("./production-isolation-historical-delta.cjs");
const expected=["app/shared/tennisnote-curriculum-contract.js","app/shared/tennisnote-curriculum-reader.js","app/shared/tennisnote-curriculum-ui.js","app/shared/tennisnote-settlement-adjustment.js"].sort();
assert.deepEqual(contract.files.map(x=>x.path).sort(),expected);
assert.equal(new Set(contract.files.map(x=>x.path)).size,4);
const git=args=>cp.execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:8e6}).replace(/\r\n/g,"\n");
function validateAll(reader=file=>fs.readFileSync(path.join(root,file),"utf8")) {
  for(const row of contract.files) {
    assert.equal(hash(reader(row.path).replace(/\r\n/g,"\n")),row.afterSha256,"historical approved asset changed: "+row.path);
    assert.equal(git(["rev-parse",row.publicReviewed+":"+row.path]).trim(),row.blob,"historical reviewed blob drift");
    assert.equal(hash(git(["show",row.publicReviewed+":"+row.path])),row.afterSha256,"historical reviewed content drift");
    assert.equal(row.privateBlob,row.blob,"private/public reviewed blob mismatch");
    assert.match(row.privateReviewed,/^[a-f0-9]{40}$/);
    for(const base of contract.historicalBases)
      assert.equal(git(["ls-tree","--name-only",base,"--",row.path]).trim(),"","historical asset already existed");
  }
  return contract.files;
}
function assertBoundedPaths(rows) {
  assert.deepEqual(rows.map(x=>x.path).sort(),expected);
  assert.equal(new Set(rows.map(x=>x.path)).size,4);
  for(const row of rows)assert.deepEqual(row,contract.files.find(x=>x.path===row.path));
  return true;
}
function assertAddedAbsentAt(base,file) {
  assert(contract.files.some(row=>row.path===file),"unapproved historical addition");
  assert([...contract.historicalBases,"648ac3387f11ad65e7631ad32e4a9a06b511d49c"].includes(base),"unapproved historical base");
  assert.equal(git(["ls-tree","--name-only",base,"--",file]).trim(),"","historical addition existed at exact base");
}
// 이미 검토된 후속 HOLD 안내 한 줄만 과거 운영 snapshot 검사 앞에서 역변환한다.
// 현재 제품을 되돌리지 않으며 기존 golden과 assert는 그대로 유지한다.
const snapshotDelta=Object.freeze({
  path:"app/shared/tennisnote-single-sheet-snapshot.js",
  base:"648ac3387f11ad65e7631ad32e4a9a06b511d49c",
  reviewed:"ddbfa811573c172889f0af6e9b1f638c07505960",
  blob:"7514077ad02a7d93e2218127a8396ba4d3f2716b",
  privateReviewed:"972f0586c8e52dc341e03f1862105a859b518470",
  beforeSha256:"35ea53c7994a9388bc2f95967a432face7cdc1a5b187cf6476077f2599b8e5df",
  afterSha256:"bddc11bf0d1b13fec023d2e56de1c276403ebf5b19b19d23c632bbfd03a8aa72",
  hunk:'    SHEET_SAME_PLAN_PERIOD_OVERLAP: "같은 상품·코치의 잔여 회원권과 기간이 겹쳐 등록을 보류했습니다. 기존 회원권은 유지됩니다. 시작일과 기존 만료일을 확인해 주세요.",\n'
});
function restoreReviewedSource(file,text) {
  if(file!==snapshotDelta.path||text===null)return boundedDelta.restore(file,text);
  text=text.replace(/\r\n/g,"\n");
  if(hash(text)===snapshotDelta.beforeSha256)return text;
  assert.equal(hash(text),snapshotDelta.afterSha256,"reviewed historical source candidate drift");
  assert.equal(git(["rev-parse",snapshotDelta.reviewed+":"+file]).trim(),snapshotDelta.blob);
  assert.equal(hash(git(["show",snapshotDelta.reviewed+":"+file])),snapshotDelta.afterSha256);
  assert.equal(text.split(snapshotDelta.hunk).length,2,"reviewed exact unique source hunk");
  const restored=text.replace(snapshotDelta.hunk,"");
  assert.equal(hash(restored),snapshotDelta.beforeSha256,"reviewed historical source baseline drift");
  assert.equal(hash(git(["show",snapshotDelta.base+":"+file])),snapshotDelta.beforeSha256);
  return restored;
}
module.exports={contract,validateAll,assertBoundedPaths,assertAddedAbsentAt,snapshotDelta,restoreReviewedSource};
