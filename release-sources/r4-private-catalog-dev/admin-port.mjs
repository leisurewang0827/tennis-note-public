// BRANCH-02 existing 관리자 상품 설정 binding candidate. No network except the explicit scoped client.
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const terms=t=>t&&typeof t.name==='string'&&t.name.trim()===t.name&&[...t.name].length>0&&[...t.name].length<=100&&
  ['sessions','minutes','days','price'].every(k=>Number.isSafeInteger(t[k])&&t[k]>=(k==='price'?0:1))&&Object.keys(t).length===5;
const privateOnly=r=>r?.public===false&&r.saleEnabled===false&&r.paymentEnabled===false&&r.membershipEnabled===false;
const options=Object.freeze({requireCurrentSession:true,retryAuth:false});
const devOrigin='https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev';
const devProject='63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba';
const same=(a,b)=>terms(a)&&terms(b)&&['name','sessions','minutes','days','price'].every(k=>a[k]===b[k]);
export function bindDevPrivateCatalog({client,branchId,readContext,onInvalidate=()=>{}}){
  const initial=readContext();
  const inDev=c=>c?.origin===devOrigin&&c.projectFingerprint===devProject&&c.branchId===branchId&&uuid(c.subject)&&uuid(c.sessionId);
  if(!uuid(branchId)||!inDev(initial)||typeof client?.rpc!=='function')throw Error('private_catalog_scope_missing');
  const {subject,sessionId}=initial;
  let valid=true;
  const close=()=>{if(valid){valid=false;onInvalidate();}};
  const current=()=>{
    const c=readContext();
    return valid&&inDev(c)&&c.subject===subject&&c.sessionId===sessionId;
  };
  async function call(name,params={}){
    if(!current()){close();throw Error('private_catalog_scope_changed');}
    try{
      const r=await client.rpc(name,{...params,p_branch:branchId},options);
      if(!current())throw Error('private_catalog_scope_changed');
      return r;
    }catch(e){if(!current()||e?.code==='42501'||e?.payload?.code==='42501')close();throw e;}
  }
  const list=async()=>{
    const rows=await call('tn_r4_dev_private_catalog_list');
    if(!Array.isArray(rows)||rows.length>50||rows.some(r=>!uuid(r?.draftId)||!terms(r.terms)||!privateOnly(r)||
      (r.registrationId!==null&&(!uuid(r.registrationId)||r.registrationId===r.draftId)))||
      new Set(rows.map(r=>r.draftId)).size!==rows.length){close();throw Error('private_catalog_list_unconfirmed');}
    return rows;
  };
  return Object.freeze({
    close,list,
    async save(draftId,t){
      if(!uuid(draftId)||!terms(t))throw Error('private_catalog_draft_input_invalid');
      const r=await call('tn_r4_dev_private_catalog_save',{p_operation:draftId,p_name:t.name,p_sessions:t.sessions,
        p_minutes:t.minutes,p_days:t.days,p_price:t.price});
      if(r?.draftId!==draftId||!privateOnly(r)||!same(r.terms,t))throw Error('private_catalog_save_unconfirmed');
      return r;
    },
    async register(draftId,operationId,t){
      if(!uuid(draftId)||!uuid(operationId)||draftId===operationId||!terms(t))throw Error('private_catalog_registration_input_invalid');
      const r=await call('tn_r4_dev_private_catalog_register',{p_draft:draftId,p_operation:operationId,p_confirmed_terms:t});
      if(r?.draftId!==draftId||r.registrationId!==operationId||!privateOnly(r)||!same(r.terms,t))throw Error('private_catalog_registration_unconfirmed');
      return r;
    }
  });
}
