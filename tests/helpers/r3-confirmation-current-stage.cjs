"use strict";
// Explicit new current stage BEFORE immutable historical adapters; not a golden repin.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),raw=fs.readFileSync(path.join(__dirname,"../fixtures/r3-confirmation-current-parity.json"),"utf8");
assert.equal(hash(raw),"fee448e4aab01389e2e3b7e4e103c9c772da517108189463964ae8b6a2aed596","confirmation current contract drift");
const contract=JSON.parse(raw);
assert.equal(contract.contract,"r3-confirmation-current-wording/1");
assert.equal(contract.files.length,6);
assert.equal(new Set(contract.files.map(r=>r.side+"/"+r.path)).size,6);
function restore(file,text,side="public"){
 assert(["public","private"].includes(side),"confirmation source side unknown");
 const row=contract.files.find(r=>r.side===side&&r.path===file);if(!row||text===null)return text;
 text=text.replace(/\r\n/g,"\n");if(hash(text)===row.beforeSha256)return text;
 assert.equal(hash(text),row.afterSha256,"confirmation candidate drift: "+file);
 for(const h of [...row.hunks].reverse()){
  assert(h.after&&h.before&&text.split(h.after).length===2,"confirmation unique hunk drift: "+file);
  text=text.replace(h.after,()=>h.before);
 }
 assert.equal(hash(text),row.beforeSha256,"confirmation baseline drift: "+file);return text;
}
function rows(side){return contract.files.filter(r=>r.side===side);}
module.exports={contract,hash,restore,rows};
