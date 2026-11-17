import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build as exactPrior, sha } from "../admin-excel2007-compat/compose.mjs";
import { Script } from "node:vm";
export { sha };
const sealBytes=readFileSync(new URL("./seal.json",import.meta.url));
assert.equal(sha(sealBytes),"f26e38370bd6073019eeb05448adde21f1ff593ed89e3703b2577c8801ebaea5");
const freeze=JSON.parse(sealBytes);
const payload=JSON.parse(readFileSync(new URL("./payload.json",import.meta.url),"utf8"));
export const baseline=freeze.baseline;
export function build(base,out) {
  const p=exactPrior(base,out+"-prior");
  assert.deepEqual(p.hashes,baseline);
  assert.deepEqual(Object.keys(payload).sort(),["index.html","schedule-v2-admin.js"]);
  const files={...p.files};
  for (const [name,bytes] of Object.entries(payload)) {
    const b=Buffer.from(bytes,"base64");
    assert.equal(b.toString("base64"),bytes);
    files[name]=b;
  }
  const hashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]));
  assert.deepEqual(hashes,freeze.candidate);
  assert.equal(Object.keys(hashes).length,181);
  assert.deepEqual(Object.keys(hashes).filter(p=>hashes[p]!==baseline[p]).sort(),freeze.changed);
  const admin=files["schedule-v2-admin.js"].toString("utf8");
  new Script(admin);
  assert.ok(admin.includes("tn_admin_v2_absence_makeup_correction") && admin.includes("tn_admin_legacy_absence_deduction"));
  assert.ok(files["index.html"].toString().includes("schedule-v2-admin.js?v="+hashes["schedule-v2-admin.js"].slice(0,16)));
  mkdirSync(out);
  for (const [p,b] of Object.entries(files)) {
    const dest=join(out,p);
    mkdirSync(join(dest,".."),{recursive:true});
    writeFileSync(dest,b,{flag:"wx"});
  }
  return {files,hashes};
}
export const releaseSeal = Object.freeze({digest:"f26e38370bd6073019eeb05448adde21f1ff593ed89e3703b2577c8801ebaea5",readbackSha:freeze.readbackSha,sql:freeze.sql,production:freeze.productionFingerprint});
