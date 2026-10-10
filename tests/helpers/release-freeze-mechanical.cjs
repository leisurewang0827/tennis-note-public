"use strict";
// Exact outer metadata inverse before existing semantic/golden adapters.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(__dirname,"../fixtures/release-freeze-mechanical-parity.json"),"utf8");
assert.equal(hash(raw),"7ed303e24c88c551fb399e799b80ed9dc98dce350ab80da105ed1ba7324c8bdd","mechanical freeze contract drift");
const contract=JSON.parse(raw);
function restore(file,text,side="public"){
 const row=contract.files.find(x=>x.side===side&&x.path===file);if(!row)return text;
 const source=text.replace(/\r\n/g,"\n"),found=hash(source);
 assert.equal(hash(row.beforeSource),row.beforeSha256,"mechanical baseline drift: "+file);
 // Explicit exact before hash supports nested adapters; unknown text never normalizes.
 if(found===row.beforeSha256)return row.beforeSource;
 assert.equal(found,row.afterSha256,"mechanical source drift: "+file);return row.beforeSource;
}
function verifyCurrent(root,side="public",reader=file=>fs.readFileSync(path.join(root,file),"utf8")){
 for(const row of contract.files.filter(x=>x.side===side))assert.equal(hash(reader(row.path).replace(/\r\n/g,"\n")),row.afterSha256,"unfrozen current metadata: "+row.path);
 return true;
}
module.exports={contract,hash,restore,verifyCurrent};
