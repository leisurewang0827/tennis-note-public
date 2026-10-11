"use strict";
// Exact outer metadata inverse before existing semantic/golden adapters.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const raw=fs.readFileSync(path.join(__dirname,"../fixtures/release-freeze-mechanical-parity.json"),"utf8");
assert.equal(hash(raw),"7ed303e24c88c551fb399e799b80ed9dc98dce350ab80da105ed1ba7324c8bdd","mechanical freeze contract drift");
const contract=JSON.parse(raw);
const correction=require("./ci39-correction-inverse.cjs");
const bounded=require("./production-isolation-historical-delta.cjs");
// 승인된 refresh7 hunk 이후의 frozen 미리보기 증분만 비교용 원본으로 복원한다.
const previewPreimage=Object.freeze({
 path:"app/shared/tennisnote-single-sheet-preview-ui.js",
 beforeCommit:"f5dbdbdecc659b98cc0b9c0b629cee28f28ea713",beforeBlob:"c70712c589703a91c08df1ce34b21ee8533ae5ce",
 afterCommit:"fffc272c8155d00df741ea5b7cbf755a703d29db",afterBlob:"b0fbe165f8dd4af479a17ed948879a053575abde",
 beforeSha256:"09d4e6c62f752f844532fa1622fd28c87f4522519e1d1b29586f39499c4b7c49",
 afterSha256:"71ce704b6b1c880db4dc396f4975b1a9c6b494952c81cc8a5ffe87644c8a51a9"
});
function reverseReviewedPreviewDiff(before,after,diff){
 const hunks=[];let active=null;
 for(const line of diff.split("\n")){
  if(line.startsWith("@@ ")){active={before:"",after:""};hunks.push(active);continue;}
  if(!active||line.startsWith("\\ No newline"))continue;
  if(line.startsWith(" ")){active.before+=line.slice(1)+"\n";active.after+=line.slice(1)+"\n";}
  else if(line.startsWith("-"))active.before+=line.slice(1)+"\n";
  else if(line.startsWith("+"))active.after+=line.slice(1)+"\n";
 }
 assert.equal(hunks.length,4,"reviewed preview hunk count drift");
 let restored=after;
 for(const hunk of [...hunks].reverse()){
  assert(hunk.before&&hunk.after&&hunk.before!==hunk.after,"reviewed preview empty/unchanged hunk");
  assert.equal(before.split(hunk.before).length,2,"reviewed preview baseline hunk is not unique");
  assert.equal(restored.split(hunk.after).length,2,"reviewed preview candidate hunk is not unique");
  restored=restored.replace(hunk.after,()=>hunk.before);
 }
 assert.equal(restored,before,"reviewed preview inverse drift");
 assert.equal(hash(restored),previewPreimage.beforeSha256,"reviewed preview restored hash drift");
 return restored;
}
function restoreReviewedPreview(file,text,side){
 if(side!=="public"||file!==previewPreimage.path||text===null)return text;
 text=text.replace(/\r\n/g,"\n");
 if(hash(text)===previewPreimage.beforeSha256)return text;
 assert.equal(hash(text),previewPreimage.afterSha256,"reviewed preview candidate drift: "+file);
 const {execFileSync}=require("node:child_process"),root=path.resolve(__dirname,"../..");
 const git=args=>execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:8e6}).replace(/\r\n/g,"\n");
 assert.equal(git(["rev-parse",previewPreimage.afterCommit+":"+file]).trim(),previewPreimage.afterBlob,"reviewed preview frozen blob drift");
 assert.equal(git(["rev-parse",previewPreimage.beforeCommit+":"+file]).trim(),previewPreimage.beforeBlob,"reviewed preview baseline blob drift");
 assert.equal(git(["show",previewPreimage.afterCommit+":"+file]),text,"reviewed preview frozen source drift");
 const before=git(["show",previewPreimage.beforeCommit+":"+file]);
 assert.equal(hash(before),previewPreimage.beforeSha256,"reviewed preview baseline drift");
 const diff=git(["diff","--no-ext-diff","--no-textconv","--no-color","--no-renames","--diff-algorithm=myers","--no-indent-heuristic","--unified=3",previewPreimage.beforeCommit,previewPreimage.afterCommit,"--",file]);
 return reverseReviewedPreviewDiff(before,text,diff);
}
function restore(file,text,side="public"){
 text=restoreReviewedPreview(file,text,side);
 text=bounded.restoreShared(file,text,side);
 text=correction.restore(file,text,side);
 const row=contract.files.find(x=>x.side===side&&x.path===file);if(!row)return text;
 const source=text.replace(/\r\n/g,"\n"),found=hash(source);
 assert.equal(hash(row.beforeSource),row.beforeSha256,"mechanical baseline drift: "+file);
 // Explicit exact before hash supports nested adapters; unknown text never normalizes.
 if(found===row.beforeSha256)return row.beforeSource;
 assert.equal(found,row.afterSha256,"mechanical candidate drift: "+file);return row.beforeSource;
}
function verifyCurrent(root,side="public",reader=file=>fs.readFileSync(path.join(root,file),"utf8")){
 correction.verifyCurrent(root,side);
 for(const row of contract.files.filter(x=>x.side===side))assert.equal(hash(reader(row.path).replace(/\r\n/g,"\n")),row.afterSha256,"unfrozen current metadata: "+row.path);
 return true;
}
module.exports={contract,hash,restore,verifyCurrent};
