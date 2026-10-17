"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(root,"tests/fixtures/r3-after-auth548-outer-parity.json"));
assert.equal(sha(raw),"893c5fa05125b3b7ac3f71847139ec60d33c14cfcd9bc005ba294ed483689cd7","R3/Auth outer seal drift");
const contract=JSON.parse(raw);assert.equal(contract.contract,"r3-after-auth548-strict-outer/1");
function restore(file,text,kind="auth"){
  assert(["auth","r3"].includes(kind));text=text.replace(/\r\n/g,"\n");
  const row=contract.files.find(r=>r.path===file);if(!row)return text;
  assert.equal(sha(text),row.afterSha256,"R3/Auth outer source drift:"+file);
  const hunk=row[kind+"Inverse"],hunks=row[kind+"InverseHunks"]||(hunk?[hunk]:[]);
  for(const patch of [...hunks].reverse()){const chars=Array.from(text),length=Array.from(patch.after).length;assert.equal(chars.slice(patch.start,patch.start+length).join(""),patch.after,"R3/Auth inverse drift");text=chars.slice(0,patch.start).join("")+patch.before+chars.slice(patch.start+length).join("")}
  assert.equal(sha(text),row[kind+"Sha256"],"R3/Auth authority drift");return text;
}
function validateSource(){
  for(const row of contract.files)restore(row.path,fs.readFileSync(path.join(root,row.path),"utf8"));
  for(const row of contract.authPins)assert.equal(sha(restore(row.path,fs.readFileSync(path.join(root,row.path),"utf8"),"auth")),row.currentSha256,"Auth548 product drift");
  return {contract:contract.contract,files:contract.files.length,authProducts:contract.authPins.length,publishable:contract.publishable};
}
module.exports={root,sha,contract,restore,validateSource};
