"use strict";
// Exact outer inverse: new integration -> reviewed R3 or historical DEV.
// Original R3/A-only golden fixtures and assertions are not repinned.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(__dirname,"../fixtures/integrated-feature-release-parity.json"),"utf8");
assert.equal(hash(raw),"a3fd09c24418cd24f4b12e11e99af0e5f561f761cfc9b7c6af21b05dbe52c6e7","integrated inverse contract drift");
const contract=JSON.parse(raw);
const mechanical=require("./release-freeze-mechanical.cjs");
function restore(file,text,target="reviewed") {
  text=mechanical.restore(file,text).replace(/\r\n/g,"\n");
  const row=contract.files.find(x=>x.path===file);
  if(!row)return text;
  assert.equal(hash(text),row.afterSha256,"integrated source drift: "+file);
  const value=target==="development"?row.developmentSource:row.reviewedSource;
  const pin=target==="development"?row.developmentSha256:row.reviewedSha256;
  if(value===null){assert.equal(pin,null);return null;}
  assert.equal(hash(value),pin,"integrated inverse baseline drift: "+file);
  return value;
}
module.exports={contract,hash,restore};
