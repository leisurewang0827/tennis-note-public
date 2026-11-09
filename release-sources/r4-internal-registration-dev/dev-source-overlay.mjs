// Local-only assembly. Caller supplies a sealed artifact; this module has no network or deploy operation.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {buildRegistrationOverlay} from "./registration-overlay.mjs";
const hash=x=>createHash("sha256").update(x).digest("hex");
const once=(source,from,to)=>{assert.equal(source.split(from).length,2,"INTEGRATION_ANCHOR_DRIFT");return source.replace(from,()=>to);};
export async function buildDevSourceOverlay(base) {
  const prior=await buildRegistrationOverlay(base),modulePath=new URL("./registration-ui.js",import.meta.url);
  assert.equal(hash(await readFile(modulePath)),"a274a014c3d7d2a265a82810183de18e4a2cdea898a65d7338596befe9dd1849","MODULE_DRIFT");
  let module=prior.delta["r4-internal-product-registration-local.js"];
  module=once(module,"    let alive = true, stamp = 0, state = null;","    let alive = true, stamp = 0, state = null, sourceReceipt = null, sourcePhase = 'pending', legacyPhase = 'pending', legacyReceipt = null, pointerMismatch = false;");
  module=once(module,"    function show(r) {","    function render(r) {");
  const anchor="    return Object.freeze({show,clear,destroy(){ alive=false; clear(); panel.remove(); }});";
  module=once(module,anchor,`    function reconcile() {
      if (!alive || !current()) return;
      if (sourcePhase!=="ok" || legacyPhase==="pending") { panel.hidden=true; return; }
      if (pointerMismatch || legacyPhase==="bad" || (legacyReceipt && (legacyReceipt.operationId!==sourceReceipt.operationId || keys.some(k=>legacyReceipt[k]!==sourceReceipt[k])))) {
        panel.hidden=false; register.hidden=true; recover.hidden=true;
        status.textContent="저장된 초안 정보가 일치하지 않아 내부 등록을 중단했습니다."; return;
      }
      render(sourceReceipt);
    }
    function legacyResolved(result) { legacyReceipt=result; legacyPhase="ok"; reconcile(); }
    function legacyFailed(error) {
      const message=error?.payload?.message;
      const confirmed=error?.code==="42501" && error?.payload?.code==="42501" && error?.message===message &&
        ["r4_product_draft_disabled","r4_dev_product_draft_denied"].includes(message);
      legacyPhase=confirmed?"off":"bad"; reconcile();
    }
    async function loadSource(expectedDraft) {
      legacyPhase=expectedDraft?"pending":"off";
      const token=stamp;
      try {
        const source=await rpc("tn_r4_internal_product_source",{p_branch:branchId});
        if (!alive || token!==stamp || !current()) return;
        if (source?.branchId!==branchId || !uuid(source.operationId) || source.status!=="draft" || !privateOnly(source) || !validTerms(source)) { sourcePhase="bad"; reconcile(); return; }
        if (expectedDraft && source.operationId!==expectedDraft) {
          pointerMismatch=true; sourcePhase="ok"; sourceReceipt=source; reconcile(); return;
        }
        sourceReceipt=source; sourcePhase="ok"; reconcile();
      } catch { if (alive && token===stamp && current()) { sourcePhase="bad"; reconcile(); } }
    }
    return Object.freeze({show:legacyResolved,legacyFailed,clear,loadSource,destroy(){ alive=false; clear(); panel.remove(); }});`);
  let draft=prior.delta["r4-product-draft-candidate.js"];
  draft=once(draft,"      if (!validReceipt(result, saved)) {", "      if (!validReceipt(result, saved)) {\n        registration?.legacyFailed(null);");
  draft=once(draft,'      catch { if (current(stamp)) status.textContent = "저장 여부를 확인하지 못했습니다. 다시 저장하지 말고 관리자에게 확인해 주세요."; }',
    '      catch (error) { if (current(stamp)) { registration?.legacyFailed(error); status.textContent = "저장 여부를 확인하지 못했습니다. 다시 저장하지 말고 관리자에게 확인해 주세요."; } }');
  draft=once(draft,"    return Object.freeze({ destroy() {", "    if (!pointerBlocked) registration?.loadSource(pending?.id ?? null);\n    return Object.freeze({ destroy() {");
  let scoped=prior.delta["r4-product-draft-dev-scoped-candidate.js"];
  const start=scoped.indexOf("        internalRegistrationRpc:");const end=scoped.indexOf("\n        async rpc(",start);
  assert.ok(start>=0&&end>start,"SCOPED_PORT_DRIFT");
  const replacement=`        async internalRegistrationRpc(name,args) {
          const names=Object.freeze({tn_r4_internal_product_source:"tn_r4_dev_internal_product_source",tn_r4_internal_product_register:"tn_r4_dev_internal_product_register",tn_r4_internal_product_get:"tn_r4_dev_internal_product_get"});
          if (!environmentOk() || actor!==client.sessionSubject?.() || !Object.hasOwn(names,name) || args?.p_branch!==branchId) throw Error("r4_internal_scope_denied");
          const mapped=names[name];
          const result=await client.rpc(mapped,args,{requireCurrentSession:true,retryAuth:false});
          if (!environmentOk() || actor!==client.sessionSubject?.()) throw Error("r4_internal_scope_denied");
          return result;
        },`;
  scoped=scoped.slice(0,start)+replacement+scoped.slice(end);
  let index=prior.delta["index.html"];
  const moduleName="r4-internal-product-registration-local.js";
  for(const [name,oldValue,newValue] of [[moduleName,prior.delta[moduleName],module],["r4-product-draft-candidate.js",prior.delta["r4-product-draft-candidate.js"],draft],["r4-product-draft-dev-scoped-candidate.js",prior.delta["r4-product-draft-dev-scoped-candidate.js"],scoped]]) {
    index=once(index,`./${name}?v=${hash(oldValue).slice(0,16)}`,`./${name}?v=${hash(newValue).slice(0,16)}`);
  }
  return {delta:{"index.html":index,"r4-product-draft-candidate.js":draft,"r4-product-draft-dev-scoped-candidate.js":scoped,[moduleName]:module},baseSeal:prior.baseSeal};
}
