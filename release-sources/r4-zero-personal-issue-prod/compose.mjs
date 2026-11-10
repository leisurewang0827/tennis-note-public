import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {pathToFileURL} from "node:url";

export const recovery={
  source:"caafa15aa8a05dbf6c54812316cff6c909b8ff1b",
  deployment:"3da3b356-f9a5-4473-9dbb-e0da2e4e864c",
  run:42732459784,artifact:13725347078,
  artifactSha256:"75ea630c84d0984e4d0fe72ed653d8bf99db6609cb1b60adfbdf35ddac35010b",
  seal:"3bb0fdd4aab43768fcf33207540edf2aebdc25533817d34dbd2c2bf7f1289ec5",
};
export const digest=b=>createHash("sha256").update(b).digest("hex");
const text=name=>readFileSync(new URL("./"+name,import.meta.url),"utf8").replace(/\r\n/g,"\n");
function walk(root,prefix=""){
  const files={};
  for(const x of readdirSync(root,{withFileTypes:true})){
    const name=prefix+x.name;
    assert.ok(x.isFile()||x.isDirectory(),"ASSET_KIND_DRIFT");
    if(x.isDirectory())Object.assign(files,walk(join(root,x.name),name+"/"));
    else files[name]=readFileSync(join(root,x.name));
  }
  return files;
}
const hashes=o=>Object.fromEntries(Object.entries(o).map(([n,b])=>[n,digest(b)]));
function one(s,a,b){
  assert.equal(s.split(a).length,2,"ANCHOR_DRIFT");
  return s.replace(a,()=>b);
}
export function assemble(baseDir) {
  const seal=readFileSync(join(baseDir,"seal.json"));
  assert.equal(digest(seal),recovery.seal);
  const base=JSON.parse(seal);
  assert.equal(base.source,recovery.source);
  const files=walk(join(baseDir,"admin"));
  assert.equal(Object.keys(files).length,175);
  assert.deepEqual(hashes(files),base.admin);
  const name="r4-zero-personal-issue.js",viewName="views/members.js";
  assert.ok(!Object.hasOwn(files,name));
  const module=Buffer.from(text("module.js"));
  const source=files[viewName].toString();
  const eol=source.includes("\r\n")?"\r\n":"\n";
  const anchor="</form>`;" + eol + "}" + eol + eol + "function renderMemberEditorModeBar()";
  const patch=[
    "</form>`;",
    '  if (action === "assign" && operationsRole() === "admin") {',
    "    const branch = activeOperationBranchId();",
    "    const memberId = member.serverUserId;",
    "    window.TennisNoteR4ZeroPersonalIssue?.mount({",
    "      target, member: memberId, branch, client: window.TennisNoteDataClient,",
    '      currentScope: () => operationsRole() === "admin" && activeOperationBranchId() === branch',
    '        && memberManagementModalState.action === "assign"',
    "        && memberManagementModalState.purchaseTargetUserId === memberId,",
    "    });",
    "  }",
    "}", "", "function renderMemberEditorModeBar()"
  ].join(eol);
  const view=Buffer.from(one(source,anchor,patch));
  const indexText=files["index.html"].toString();
  const line=indexText.includes("\r\n")?"\r\n":"\n";
  const index=Buffer.from(one(indexText,'    <script src="./views/members.js?v=1.0.566"></script>',
    '    <script src="./'+name+'?v='+digest(module).slice(0,16)+'"></script>'+line+
    '    <script src="./views/members.js?v='+digest(view).slice(0,16)+'"></script>'));
  const delta={"index.html":index,[viewName]:view,[name]:module};
  const output={...files,...delta};
  assert.equal(Object.keys(output).length,176);
  return {
    output,base,
    seal:{kind:"R4_ZERO_PERSONAL_ISSUE_PROD_PREP_ONLY",source:process.env.GITHUB_SHA||"LOCAL",
      recovery,delta:hashes(delta),admin:hashes(output),
      sql:{installOff:digest(text("install-off.sql")),off:digest(text("off.sql"))}},
  };
}
async function publicCompare(base) {
  const hosts=["https://tennisnote-admin.pages.dev","https://3da3b356.tennisnote-admin.pages.dev"];
  const names=["index.html","views/members.js","r4-scoped-member-catalog.js","release.json","shared/config.local.js"];
  await Promise.all(hosts.flatMap(host=>names.map(async name=>{
    const r=await fetch(host+(name==="index.html"?"/":"/"+name),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000)});
    assert.equal(r.status,200,"PRODUCTION_ASSET_UNAVAILABLE");
    assert.equal(digest(Buffer.from(await r.arrayBuffer())),base.admin[name],"PRODUCTION_BASE_DRIFT");
  })));
  console.log("PROD_EXISTING_ADMIN_AND_FIXED_RECOVERY_BYTES_MATCH");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [, , baseDir, destination, flag]=process.argv;
  const {output,seal,base}=assemble(baseDir);
  if(flag==="--public-read-only")await publicCompare(base);
  else assert.equal(flag,undefined);
  mkdirSync(destination,{recursive:true});
  for(const [n,b] of Object.entries(output)){
    const file=join(destination,"admin",n);
    mkdirSync(dirname(file),{recursive:true});writeFileSync(file,b,{flag:"wx"});
  }
  const bytes=JSON.stringify(seal)+"\n";
  writeFileSync(join(destination,"seal.json"),bytes,{flag:"wx"});
  console.log(JSON.stringify({status:"PROD_CANDIDATE_COMPOSED_NOT_DEPLOYED",assets:176,
    delta:seal.delta,sql:seal.sql,sealSha256:digest(bytes)}));
}
