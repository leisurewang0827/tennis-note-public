const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/r3-coach-history-source-parity.json"),"utf8"));
const sha=text=>crypto.createHash("sha256").update(text).digest("hex");
function restore(file,text,inputVersion=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version){
  const entry=manifest.files.find(e=>e.path===file);
  if(!entry)return text;
  text=text.replaceAll(inputVersion,manifest.publicVersion);
  if(sha(text)!==entry.candidateSha256)throw Error("R3 history candidate drift: "+file);
  for(const hunk of [...entry.hunks].reverse()){
    const chars=Array.from(text);
    if(chars.slice(hunk.start,hunk.end).join("")!==hunk.after)throw Error("R3 history inverse hunk drift: "+file);
    text=chars.slice(0,hunk.start).join("")+hunk.before+chars.slice(hunk.end).join("");
  }
  if(sha(text)!==entry.baseSha256)throw Error("R3 history baseline drift: "+file);
  return text.replaceAll(manifest.publicVersion,inputVersion);
}
module.exports={root,manifest,sha,restore};
