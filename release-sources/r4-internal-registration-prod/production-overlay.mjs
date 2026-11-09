// Offline-only production administrator overlay. No network, writes or deployment.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

const hash=b=>createHash("sha256").update(b).digest("hex");
const once=(source,before,after)=>{
  assert.equal(source.split(before).length,2,"PROD_OVERLAY_ANCHOR_DRIFT");
  return source.replace(before,()=>after);
};
export function compose({files,sealBytes,draftSource,registrationSource,hostSource,cssSource}) {
  assert.equal(hash(draftSource),"7a6649cd5f367a477f20cee3f73a8d6e386cc8342470f9d0ec4d8431a11a81d8","PROD_DRAFT_SOURCE_DRIFT");
  assert.equal(hash(registrationSource),"a274a014c3d7d2a265a82810183de18e4a2cdea898a65d7338596befe9dd1849","PROD_REGISTRATION_SOURCE_DRIFT");
  assert.equal(hash(cssSource),"61836d9c2a4518f150cdf5e888c24c392b100fb8ff2dd32cb35264ddae0e768d","PROD_STYLE_SOURCE_DRIFT");
  assert.equal(hash(sealBytes),"f16bf186f6d0d196f7d0a238f74863908dfb0904ee5fac201b947a834fb3ee20","PROD_BASE_SEAL_DRIFT");
  const seal=JSON.parse(sealBytes);
  assert.equal(seal.sha,"cc38b03df566c6b3d297e77a00e61757935c4a45");
  assert.equal(Object.keys(seal.admin).length,168);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)])),seal.admin,"PROD_BASE_CONTENT_DRIFT");
  let draft=Buffer.from(draftSource).toString();
  draft=once(draft,"{ client, branchId, currentBranch, scopeRevision, storage }", "{ client, branchId, draftOperationId, currentBranch, scopeRevision, storage }");
  draft=once(draft,'typeof scopeRevision !== "function" || scopeRevision() == null || !storage)',
    'typeof scopeRevision !== "function" || scopeRevision() == null || !storage || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(draftOperationId))');
  draft=once(draft,'    const validReceipt = (result, saved) =>',
    '    const registration = client.allowInternal === true ? root.TennisNoteR4InternalProductRegistrationLocal?.mount(container, { client, actor, branchId, storage, current: () => current(generation) }) : null;\n    const validReceipt = (result, saved) =>');
  draft=once(draft,'result.status === "draft" && result.public === false',
    'result.status === "draft" && typeof result.internalRegistrationEnabled === "boolean" && result.public === false');
  draft=once(draft,'      pending = null; recover.hidden = true;',
    '      registration?.show(result); committed = true;\n      pending = null; recover.hidden = true;');
  draft=once(draft,'        status.textContent = "저장 여부를 확인하지 못했습니다. 다시 저장하지 말고 관리자에게 확인해 주세요."; return;',
    '        client.rejectAmbiguous?.(); return;');
  draft=once(draft,'let pending = null, busy = false, alive = true, generation = 0, pointerBlocked = false;',
    'let pending = null, busy = false, alive = true, generation = 0, pointerBlocked = false, committed = false;');
  draft=once(draft,'if (busy || pointerBlocked || !current(stamp) || !form.reportValidity()) return;',
    'if (busy || committed || pointerBlocked || !current(stamp) || !form.reportValidity()) return;');
  draft=draft.replaceAll('submit.disabled = !!pending;', 'submit.disabled = !!pending || committed;');
  draft=once(draft,'      if (!pending && typeof root.crypto?.randomUUID !== "function") {\n        status.textContent = "안전한 저장 환경을 확인할 수 없습니다. 페이지를 다시 열어 주세요."; return;\n      }\n      pending = { fingerprint, id: root.crypto.randomUUID(), payload };',
    '      registration?.clear();\n      pending = { fingerprint, id: draftOperationId, payload };');
  draft=once(draft,'typeof pointer.operation !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pointer.operation))',
    'typeof pointer.operation !== "string" || pointer.operation !== draftOperationId)');
  draft=once(draft,'      invalidate();\n      if (mounted.get(container)',
    '      invalidate(); registration?.destroy();\n      if (mounted.get(container)');
  draft=once(draft,'    return Object.freeze({ destroy() {',
    `    if (!pending && !pointerBlocked) {
      const stamp = generation; busy = true; submit.disabled = true;
      status.textContent = "기존 초안을 확인하는 중입니다.";
      Promise.resolve().then(() => client.rpc("tn_r4_prod_product_draft_get", {p_branch:branchId,p_operation:draftOperationId},
        {requireCurrentSession:true,retryAuth:false})).then(result => {
        if (!current(stamp)) return;
        if (result === null) { status.textContent = "상품 정보를 입력해 주세요."; return; }
        if (!validReceipt(result,{id:draftOperationId,payload:null})) throw Error("draft_receipt_mismatch");
        committed = true; registration?.show(result);
        savedInfo.textContent = \`\${result.name} · \${result.sessions}회 · \${result.minutes}분 · \${result.days}일 · \${result.price.toLocaleString("ko-KR")}원 · 비공개 초안\`;
        status.textContent = "기존 비공개 초안을 확인했습니다.";
      }).catch(() => { if (current(stamp)) { pointerBlocked = true; client.rejectAmbiguous?.(); } })
        .finally(() => { if (current(stamp)) { busy = false; submit.disabled = committed || pointerBlocked || !!pending; } });
    }
    return Object.freeze({ destroy() {`);
  let registration=Buffer.from(registrationSource).toString();
  registration=once(registration,'r.status!=="draft" || !privateOnly(r) || !validTerms(r)',
    'r.status!=="draft" || r.internalRegistrationEnabled!==true || !privateOnly(r) || !validTerms(r)');
  const host=Buffer.from(hostSource),css=Buffer.from(cssSource);
  const token=hash(Buffer.concat([Buffer.from(draft),Buffer.from(registration),host,css])).slice(0,16);
  let index=files["index.html"].toString(),onboarding=files["r4-onboarding.js"].toString();
  assert.ok(!index.includes("r4-product-draft-candidate.js"),"PROD_ALREADY_INSTALLED");
  index=once(index,'    <script src="./views/settings.js?',
    `    <link rel="stylesheet" href="./r4-product-draft-candidate.css?v=${token}">\n    <script src="./r4-internal-product-registration.js?v=${token}"></script>\n    <script src="./r4-product-draft-candidate.js?v=${token}"></script>\n    <script src="./r4-production-draft-host.js?v=${token}"></script>\n    <script src="./views/settings.js?`);
  index=once(index,'r4-onboarding.js?v=r4-prod-workspace-a000a3108920',`r4-onboarding.js?v=r4-prod-workspace-a000a3108920-${token}`);
  onboarding=once(onboarding,'      if (opened !== true) throw Error("r4_workspace_unavailable");',
    '      if (!current(ctx)) return;\n      if (opened !== true) throw Error("r4_workspace_unavailable");\n      if (row.selfServe && seoulProduction) await root.TennisNoteR4ProductionDraftHost?.open({client:ctx.client,branchId:row.branch_id,currentContext:()=>session===ctx});');
  onboarding=once(onboarding,'      session = null;\n      panel.hidden = true;',
    '      root.TennisNoteR4ProductionDraftHost?.close();\n      session = null;\n      panel.hidden = true;');
  const delta={"index.html":Buffer.from(index),"r4-onboarding.js":Buffer.from(onboarding),
    "r4-product-draft-candidate.js":Buffer.from(draft),"r4-internal-product-registration.js":Buffer.from(registration),
    "r4-production-draft-host.js":host,"r4-product-draft-candidate.css":css};
  return {token,delta};
}
