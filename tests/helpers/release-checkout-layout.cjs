"use strict";
// 공개 CI는 공개 checkout만 읽는다. 비공개 쪽은 고정된 검사 reference임을 명시한다.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const mechanical=require("./release-freeze-mechanical.cjs");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),norm=s=>s.replace(/\r\n/g,"\n");
function loadContract(raw){
 assert.equal(hash(raw),"1dd926136d59af6dca299864d49df7a722c17630f05c8351cfe2c5fb0ba70c3a","checkout_reference_drift");
 const c=JSON.parse(raw);assert.equal(c.contract,"public-ci-checkout-reference/1");
 assert.equal(c.sourceScope,"PRIVATE_PINNED_REFERENCE_NOT_REMOTE_PRIVATE_CHECKOUT");
 assert.equal(c.mechanicalGoldenSha256,"7ed303e24c88c551fb399e799b80ed9dc98dce350ab80da105ed1ba7324c8bdd");
 assert.equal(hash(c.semanticBefore.source),c.semanticBefore.sha256,"semantic_before_drift");
 assert.deepEqual(c.privateRecipes.map(r=>r.path).sort(),mechanical.contract.files.filter(r=>r.side==="private").map(r=>r.path).sort());
 return c;
}
const contract=loadContract(norm(fs.readFileSync(path.join(__dirname,"../fixtures/release-checkout-layout.json"),"utf8")));
function projectPrivate(file){
 const recipe=contract.privateRecipes.find(r=>r.path===file),row=mechanical.contract.files.find(r=>r.side==="private"&&r.path===file);
 assert(recipe&&row,"private_reference_unknown_path");
 assert.equal(recipe.beforeSha256,row.beforeSha256);assert.equal(recipe.afterSha256,row.afterSha256);
 assert.equal(hash(row.beforeSource),row.beforeSha256,"private_reference_before_drift");
 const lines=row.beforeSource.split("\n"),seen=new Set();
 for(const p of recipe.patches){assert(Number.isInteger(p.line)&&p.line>=0&&p.line<lines.length&&!seen.has(p.line),"private_reference_patch_drift");seen.add(p.line);assert.equal(lines[p.line],p.before,"private_reference_patch_drift");assert.equal(typeof p.after,"string");lines[p.line]=p.after;}
 const source=lines.join("\n");assert.equal(hash(source),row.afterSha256,"private_reference_after_drift");return source;
}
function read(root,side,file,reader=fs.readFileSync){
 assert(["public","private"].includes(side),"checkout_source_side_unknown");
 assert(typeof file==="string"&&!path.isAbsolute(file)&&!file.split(/[\\/]/).includes(".."),"checkout_source_path_invalid");
 if(side==="private")return projectPrivate(file);
 const bytes=reader(path.join(root,file));assert(Buffer.isBuffer(bytes),"public_source_encoding_unknown");
 const source=bytes.toString("utf8");assert(Buffer.from(source,"utf8").equals(bytes),"public_source_encoding_unknown");return norm(source);
}
function semanticBefore(){assert.equal(hash(contract.semanticBefore.source),contract.semanticBefore.sha256);return contract.semanticBefore.source;}
module.exports={read,projectPrivate,semanticBefore,loadContract,contract,hash};
