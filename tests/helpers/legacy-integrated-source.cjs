"use strict";
// 승인된 outer inverse만 기존 golden 앞에 구성한다. 제품 파일은 수정하지 않는다.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const integration=require("./integrated-feature-release.cjs");
const mechanical=require("./release-freeze-mechanical.cjs");
const root=path.resolve(__dirname,"../..");
const raw=file=>fs.readFileSync(path.join(root,file),"utf8").replace(/\r\n/g,"\n");
const currentVersion=JSON.parse(raw("app/release.json")).version;
const developmentVersion=JSON.parse(integration.contract.files.find(x=>x.path==="app/release.json").developmentSource).version;
function restore(file,text){
  text=integration.restore(file,text,"development");
  if(text===null)return null;
  // 이미 검토된 development preimage에만 기존 version canonicalization을 적용.
  return text.replaceAll(developmentVersion,currentVersion);
}
const read=file=>restore(file,raw(file));
function verifyCurrent(){
  mechanical.verifyCurrent(root);
  for(const row of integration.contract.files)restore(row.path,raw(row.path));
  return true;
}
module.exports={root,raw,read,restore,verifyCurrent,currentVersion,developmentVersion};
