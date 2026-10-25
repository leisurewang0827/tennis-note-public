const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/r3-coach-history-source-parity.json"),"utf8"));
const sha=text=>crypto.createHash("sha256").update(text).digest("hex");
let validatedRefreshAuthorityHash="";
function restoreOpenRefresh(file,text,{inputVersion=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version,preserveVersion=false}={}){
  const retained=require("./r3-retained-response-port.cjs").restore(file,text);
  if(retained.applied){
    const baseline=restoreOpenRefresh(file,retained.text,{inputVersion:retained.baseVersion,preserveVersion});
    return preserveVersion?baseline.replaceAll(retained.baseVersion,inputVersion):baseline;
  }
  const raw=fs.readFileSync(path.join(root,"tests/fixtures/r3-coach-open-refresh-source-parity.json"),"utf8");
  const authority=JSON.parse(raw);
  // 같은 canonical Python 검증기를 재사용한다. fixture가 변하면 검증도 다시 한다.
  if(validatedRefreshAuthorityHash!==sha(raw)){
    const result=execFileSync(process.env.TENNISNOTE_PYTHON||"python",["-B","-c","import json,sys; sys.path.insert(0,'scripts'); import check_tennisnote_dev_prod_alignment as a; a._load_r3_coach_open_refresh_authority(json.loads(sys.stdin.buffer.read().decode('utf-8'))); print('REFRESH_AUTHORITY_BOUND')"],{cwd:root,encoding:"utf8",input:raw,stdio:["pipe","pipe","pipe"]});
    if(result.trim()!=="REFRESH_AUTHORITY_BOUND")throw Error("R3 open refresh authority binding drift");
    validatedRefreshAuthorityHash=sha(raw);
  }
  const row=authority.files.find(item=>item.path===file);
  if(!row)return text;
  const source=text.replace(/\r\n/g,"\n"),digest=sha(source);
  if(digest===row.beforeSha256)return source;
  if(digest!==row.afterSha256){
    const projection=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/r3-effective-source-parity.json"),"utf8"));
    const versions=[authority.baseVersion,authority.targetVersion,"1.0.552",manifest.publicVersion,projection.publicVersion];
    if(!versions.includes(inputVersion))throw Error("R3 open refresh unknown version stage: "+file);
    const prior=[[authority.baseCommit,authority.baseVersion],[authority.candidateCommit,authority.targetVersion],
      ["636bdb571dab9d67e18725cd101f0fbe452d69d7","1.0.552"],
      ["758feca68b3dcc7df89652c0dda03176e1c2dc16","1.0.552"],
      ["1b1a73ce73ea2998ed91b54d52aa312d6a2d47f6","1.0.554"]];
    for(const [revision,version] of prior){
      try{
        const before=execFileSync("git",["show",revision+":"+file],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).replace(/\r\n/g,"\n");
        if(source===before)return source;
        let canonicalStage=before.replaceAll(version,inputVersion);
        if(file==="app/tennis-note-coach-app/service-worker.js"&&inputVersion===projection.publicVersion){
          const cache=/^const CACHE_NAME = "([^"]+)";/m.exec(canonicalStage);
          if(cache)canonicalStage=canonicalStage.replace(cache[1],projection.publicCoachCache);
        }
        if(source===canonicalStage)return source;
      }catch(error){if(error.status==null)throw error;}
    }
    throw Error("R3 open refresh source stage drift: "+file);
  }
  let restored=source;
  for(const hunk of [...row.hunks].reverse()){
    if(!hunk.after||restored.split(hunk.after).length!==2)throw Error("R3 open refresh inverse hunk drift: "+file);
    restored=restored.replace(hunk.after,()=>hunk.before);
  }
  if(sha(restored)!==row.beforeSha256)throw Error("R3 open refresh baseline drift: "+file);
  return preserveVersion?restored.replaceAll(authority.baseVersion,inputVersion):restored;
}
function restore(file,text,inputVersion=JSON.parse(fs.readFileSync(path.join(root,"app/release.json"),"utf8")).version){
  const outputVersion=inputVersion;
  const retained=require("./r3-retained-response-port.cjs").restore(file,text);
  if(retained.applied){text=retained.text;inputVersion=retained.baseVersion;}
  text=restoreOpenRefresh(file,text,{inputVersion,preserveVersion:true});
  text=require("./r3-admin-history-port.cjs").restore(file,text,inputVersion);
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
  return text.replaceAll(manifest.publicVersion,outputVersion);
}
module.exports={root,manifest,sha,restore,restoreOpenRefresh};
