import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const hash=b=>createHash("sha256").update(b).digest("hex");
function once(s,a,b){assert.equal(s.split(a).length,2,"ANCHOR_DRIFT");return s.replace(a,()=>b);}
export function compose({files,sealBytes,policy,moduleBytes=readFileSync(new URL("./module.js",import.meta.url))}){
  assert.equal(hash(sealBytes),policy.prior.seal);
  const base=JSON.parse(sealBytes);
  assert.equal(base.source,policy.prior.source);
  assert.equal(Object.keys(base.admin).length,175);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)])),base.admin);
  const settings=files["views/settings.js"].toString();
  const nl=settings.includes("\r\n")?"\r\n":"\n";
  const view=once(settings,[
    '    allowed: !adminLocalPreviewMode && workspaceSignedIn && !restoringSession && role === "member"',
    '      && window.TennisNoteR4ExistingAccount?.isWorkspaceMode?.({ role }) === true,',
  ].join(nl),'    allowed: !adminLocalPreviewMode && ready && !workspaceMode && !restoringSession && role === "admin",');
  const index=once(once(files["index.html"].toString(),
    './r4-scoped-member-catalog.js?v='+base.admin["r4-scoped-member-catalog.js"].slice(0,16),
    './r4-scoped-member-catalog.js?v='+hash(moduleBytes).slice(0,16)),
    './views/settings.js?v='+base.admin["views/settings.js"].slice(0,16),
    './views/settings.js?v='+hash(view).slice(0,16));
  const delta={"index.html":Buffer.from(index),"views/settings.js":Buffer.from(view),"r4-scoped-member-catalog.js":moduleBytes};
  const hashes=Object.fromEntries(Object.entries(delta).map(([n,b])=>[n,hash(b)]));
  for(const [n,h] of Object.entries(hashes))assert.notEqual(h,base.admin[n],n);
  return {files:{...files,...delta},changed:Object.keys(delta).sort(),hashes:{...base.admin,...hashes}};
}
