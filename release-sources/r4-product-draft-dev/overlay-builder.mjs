// DEV-only offline overlay. Caller supplies exact pinned DEV assets; never deploys.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
const hash=b=>createHash("sha256").update(b).digest("hex");
export function draftToken(parts) {
  const digest=createHash("sha256");
  for(const part of parts) {const bytes=Buffer.from(part);digest.update(String(bytes.length)+":");digest.update(bytes);}
  return digest.digest("hex").slice(0,16);
}
const read=name=>readFile(new URL(`../90-Dashboard/tennis-note-prototype/${name}`,import.meta.url));
function once(source,before,after) { assert.equal(source.split(before).length,2,"R4_DEV_DRAFT_ANCHOR_DRIFT");return source.replace(before,()=>after); }
export async function build({index,onboarding,pins,sources}) {
  for(const [key,value] of Object.entries({index,onboarding})) {
    assert.match(pins?.[key]||"",/^[a-f0-9]{64}$/);assert.equal(hash(value),pins[key],"R4_DEV_DRAFT_BASE_DRIFT");
  }
  const [module,hostSource,css,scoped]=sources ? [sources.module,sources.host,sources.css,sources.scoped].map(Buffer.from) :
    await Promise.all(["r4-product-draft-candidate.js","r4-product-draft-host-candidate.js",
      "r4-product-draft-candidate.css","r4-product-draft-dev-scoped-candidate.js"].map(read));
  const [guard,server,sqlBuilder,overlayBuilder]=sources ? [sources.guardHash,sources.serverHash,sources.sqlBuilderHash,sources.overlayBuilder].map(Buffer.from) : await Promise.all([
    new URL("../40-Database/tennisnote_r4_product_draft_dev_guard_candidate.sql",import.meta.url),
    new URL("../40-Database/tennisnote_r4_product_draft_candidate.sql",import.meta.url),
    new URL("./build_tennisnote_r4_product_draft_dev_sql.mjs",import.meta.url),
    new URL("./build_tennisnote_r4_product_draft_dev_overlay.mjs",import.meta.url),
  ].map(file=>readFile(file)));
  const host=Buffer.from(once(hostSource.toString(),
    'root.TennisNoteR4ExistingAccount?.isProductionTarget?.()',
    'root.TennisNoteR4ProductDraftDevScoped?.environmentOk?.()'));
  const serverPins=sources ? [guard,server,sqlBuilder] : [guard,server,sqlBuilder].map(b=>Buffer.from(hash(b)));
  assert.ok(serverPins.every(b=>/^[a-f0-9]{64}$/.test(b.toString())),"R4_DEV_SERVER_PINS_REQUIRED");
  const token=draftToken([index,onboarding,module,host,css,scoped,...serverPins,overlayBuilder]);
  let html=index.toString(),logic=onboarding.toString();
  assert.ok(!html.includes("r4-product-draft-candidate.js"),"R4_DEV_DRAFT_ALREADY_INSTALLED");
  html=once(html,'    <script src="./views/settings.js?',
    `    <link rel="stylesheet" href="./r4-product-draft-candidate.css?v=${token}">\n    <script src="./r4-product-draft-candidate.js?v=${token}"></script>\n    <script src="./r4-product-draft-dev-scoped-candidate.js?v=${token}"></script>\n    <script src="./r4-product-draft-host-candidate.js?v=${token}"></script>\n    <script src="./views/settings.js?`);
  const re=/(<script src="\.\/r4-onboarding\.js\?[^"\n]*)("\s*><\/script>)/g;
  assert.equal([...html.matchAll(re)].length,1,"R4_DEV_DRAFT_SCRIPT_DRIFT");
  html=html.replace(re,(_,start,end)=>`${start}&r4draft=${token}${end}`);
  logic=once(logic,'      if (opened !== true) throw Error("r4_workspace_unavailable");',
    '      if (!current(ctx)) return;\n      if (opened !== true) throw Error("r4_workspace_unavailable");\n      if (row.selfServe && seoulDev) root.TennisNoteR4ProductDraftHost?.open({ client: root.TennisNoteR4ProductDraftDevScoped.forBranch(ctx.client, row.branch_id), branchId: row.branch_id });');
  logic=once(logic,'      session = null;\n      panel.hidden = true;',
    '      root.TennisNoteR4ProductDraftHost?.close();\n      session = null;\n      panel.hidden = true;');
  return {token,files:{"index.html":Buffer.from(html),"r4-onboarding.js":Buffer.from(logic),
    "r4-product-draft-candidate.js":module,"r4-product-draft-host-candidate.js":host,
    "r4-product-draft-candidate.css":css,"r4-product-draft-dev-scoped-candidate.js":scoped}};
}
