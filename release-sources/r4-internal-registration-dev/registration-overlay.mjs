import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const hash = x => createHash('sha256').update(x).digest('hex');
const replace = (s, from, to) => {
  assert.equal(s.split(from).length,2,'Expected exactly one sealed integration anchor');
  return s.replace(from,()=>to);
};

export async function buildRegistrationOverlay(artifactDir) {
  const rawSeal = await readFile(join(artifactDir,'seal.json'));
  assert.equal(hash(rawSeal),'520a2d58f74baac134ec0a9b690040a800db658d04b6296322bdead120669345');
  const seal=JSON.parse(rawSeal);
  const read=async name=>{
    const bytes=await readFile(join(artifactDir,'admin',name));
    assert.equal(hash(bytes),seal.admin[name],`Sealed input drift: ${name}`);
    return bytes.toString('utf8');
  };
  const names=['index.html','r4-product-draft-candidate.js','r4-product-draft-dev-scoped-candidate.js',
    'r4-product-draft-host-candidate.js','r4-onboarding.js','r4-selfserve-client.js','r4-branch-hours.js','r4-product-draft-candidate.css','styles.css'];
  const files=Object.fromEntries(await Promise.all(names.map(async n=>[n,await read(n)])));
  const moduleName='r4-internal-product-registration-local.js';
  const module=await readFile(new URL('./registration-ui.js',import.meta.url),'utf8');

  let draft=files['r4-product-draft-candidate.js'];
  const receiptAnchor='    const validReceipt = (result, saved) => result && result.branchId === branchId && result.operationId === saved.id &&';
  draft=replace(draft,receiptAnchor,`    const registration = root.TennisNoteR4InternalProductRegistrationLocal?.mount(container, {
      client, actor, branchId, storage, current: () => current(generation),
    });
${receiptAnchor}`);
  const verified='      pending = null; recover.hidden = true;';
  draft=replace(draft,verified,`${verified}\n      registration?.show(result);`);
  const newDraft='      pending = { fingerprint, id: root.crypto.randomUUID(), payload };';
  draft=replace(draft,newDraft,`      registration?.clear();\n${newDraft}`);
  draft=replace(draft,'const invalidate = () => { alive = false; generation++; };',
    'const invalidate = () => { alive = false; generation++; registration?.destroy(); };');

  const scoped=files['r4-product-draft-dev-scoped-candidate.js'];
  const portAnchor='        sessionSubject:()=>environmentOk() && actor===client.sessionSubject?.() ? actor : null,';
  const scopedNext=replace(scoped,portAnchor,`${portAnchor}
        internalRegistrationRpc: typeof client.internalRegistrationRpc !== "function" ? undefined : async (name,args) => {
          if (!environmentOk() || actor!==client.sessionSubject?.() || args?.p_branch!==branchId ||
              !["tn_r4_internal_product_register","tn_r4_internal_product_get"].includes(name)) throw Error("r4_internal_scope_denied");
          const result=await client.internalRegistrationRpc(name,args,{requireCurrentSession:true,retryAuth:false});
          if (!environmentOk() || actor!==client.sessionSubject?.()) throw Error("r4_internal_scope_denied");
          return result;
        },`);

  let index=files['index.html'];
  const oldDraft='    <script src="./r4-product-draft-candidate.js?v=4dd7538884f2c337"></script>';
  const oldScoped='    <script src="./r4-product-draft-dev-scoped-candidate.js?v=4dd7538884f2c337"></script>';
  index=replace(index,oldDraft,`    <script src="./${moduleName}?v=${hash(module).slice(0,16)}"></script>\n    <script src="./r4-product-draft-candidate.js?v=${hash(draft).slice(0,16)}"></script>`);
  index=replace(index,oldScoped,`    <script src="./r4-product-draft-dev-scoped-candidate.js?v=${hash(scopedNext).slice(0,16)}"></script>`);
  const delta={'index.html':index,'r4-product-draft-candidate.js':draft,'r4-product-draft-dev-scoped-candidate.js':scopedNext,[moduleName]:module};
  // Keep the compiled overlay in memory; there is intentionally no deployment or hosted transport here.
  return { files:{...files,...delta}, delta, baseSeal:hash(rawSeal) };
}
