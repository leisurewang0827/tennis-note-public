import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const hash=b=>createHash("sha256").update(b).digest("hex");
function once(s,a,b){assert.equal(s.split(a).length,2,"ANCHOR_DRIFT");return s.replace(a,()=>b);}
export function compose({files,sealBytes,policy,moduleBytes=Buffer.from(readFileSync(new URL("./module.js",import.meta.url),"utf8").replace(/\r\n/g,"\n"))}){
  assert.equal(hash(sealBytes),policy.prior.seal);
  const base=JSON.parse(sealBytes);
  assert.equal(base.source,policy.prior.source);
  assert.equal(Object.keys(base.admin).length,175);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)])),base.admin);
  const settings=files["views/settings.js"].toString();
  assert.equal(settings.split('allowed: !adminLocalPreviewMode && ready && !workspaceMode && !restoringSession && role === "admin"').length,2);
  const index=once(files["index.html"].toString(),
    './r4-scoped-member-catalog.js?v='+base.admin["r4-scoped-member-catalog.js"].slice(0,16),
    './r4-scoped-member-catalog.js?v='+hash(moduleBytes).slice(0,16));
  const delta={"index.html":Buffer.from(index),"r4-scoped-member-catalog.js":moduleBytes};
  const hashes=Object.fromEntries(Object.entries(delta).map(([n,b])=>[n,hash(b)]));
  for(const [n,h] of Object.entries(hashes))assert.notEqual(h,base.admin[n],n);
  return {files:{...files,...delta},changed:Object.keys(delta).sort(),hashes:{...base.admin,...hashes}};
}
