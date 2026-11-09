(function install(root) {
  "use strict";
  const uuid = s => typeof s === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
  const keys = ["name", "sessions", "minutes", "days", "price"];
  const ownTerms = r => Object.freeze(Object.fromEntries(keys.map(k => [k, r[k]])));
  const validTerms = r => typeof r?.name === "string" && r.name.trim().length > 0 &&
    [...r.name].length <= 100 && keys.slice(1).every(k => Number.isSafeInteger(r[k]) && r[k] >= (k === "price" ? 0 : 1));
  const privateOnly = r => r?.public === false && r.saleEnabled === false && r.paymentEnabled === false;
  const opts = Object.freeze({ requireCurrentSession: true, retryAuth: false });

  function mount(container, { client, actor, branchId, storage, current }) {
    // No fallback to the ordinary network RPC: this local overlay needs an explicit scoped port.
    if (typeof client?.internalRegistrationRpc !== "function") return null;
    const doc = container.ownerDocument;
    const el = (tag, text) => { const n = doc.createElement(tag); n.textContent = text; return n; };
    const panel = el("section", ""); panel.hidden = true; panel.setAttribute("aria-label", "내부 상품 등록");
    const title = el("h3", "내부 상품 등록");
    const summary = el("p", "");
    const note = el("p", "지점 내부 등록용입니다. 공개 판매·결제·회원권 발급은 하지 않습니다.");
    const register = el("button", "내부 등록"); const recover = el("button", "내부 등록 결과 확인");
    for (const b of [register, recover]) { b.type = "button"; b.className = "ghost-button"; }
    const status = el("p", ""); status.setAttribute("role", "status");
    panel.append(title, summary, note, register, recover, status); container.append(panel);
    let alive = true, stamp = 0, state = null;
    const isCurrent = (s, token) => alive && s === state && token === stamp && current();
    const update = s => {
      register.hidden = !!s.operation || s.blocked;
      register.disabled = s.busy || !!s.operation || s.blocked;
      recover.hidden = !s.operation || s.done || s.blocked;
      recover.disabled = s.busy || !s.operation || s.done || s.blocked;
    };
    const validResult = (r,s) => r?.branchId === branchId && r.operationId === s.operation &&
      r.draftOperationId === s.draft && r.status === "registered_internal" && privateOnly(r) &&
      validTerms(r.terms) && Object.keys(r.terms).length === keys.length && keys.every(k => r.terms[k] === s.terms[k]);
    const rpc = (name, args) => client.internalRegistrationRpc(name,args,opts);
    const unknown = "등록 여부를 확인하지 못했습니다. 다시 등록하지 말고 내부 등록 결과 확인을 눌러 주세요.";

    async function check(s,token) {
      if (!isCurrent(s,token)) return;
      const r = await rpc("tn_r4_internal_product_get", {p_branch:branchId,p_operation:s.operation});
      if (!isCurrent(s,token)) return;
      if (!validResult(r,s)) throw Error("internal_receipt_unconfirmed");
      s.done = true;
      status.textContent = "자기 지점에 내부 상품을 등록하고 확인했습니다. 판매·결제는 꺼져 있습니다.";
    }
    register.addEventListener("click", async () => {
      const s=state, token=stamp;
      if (!s || !isCurrent(s,token) || s.busy || s.operation || s.blocked) return;
      try {
        const id=root.crypto.randomUUID();
        if (!uuid(id) || id===s.draft) throw Error("invalid_operation");
        const encoded=JSON.stringify({operation:id});
        // Do not replace a marker another mount/tab has already saved.
        const existing=storage.getItem(s.key);
        if (existing !== null) {
          const pointer=JSON.parse(existing);
          if (!uuid(pointer?.operation) || pointer.operation===s.draft || Object.keys(pointer).length!==1) throw Error("invalid_pointer");
          s.operation=pointer.operation; status.textContent="이전 내부 등록 결과를 먼저 확인해 주세요."; update(s); return;
        }
        storage.setItem(s.key,encoded);
        if (storage.getItem(s.key)!==encoded) throw Error("pointer_write_unconfirmed");
        s.operation=id;
      } catch {
        s.blocked=true; status.textContent="결과 확인 기록을 보존할 수 없어 내부 등록을 중단했습니다."; update(s); return;
      }
      s.busy=true; update(s); status.textContent="내부 등록을 확인하는 중입니다.";
      try {
        const r=await rpc("tn_r4_internal_product_register", {
          p_branch:branchId,p_draft:s.draft,p_operation:s.operation,p_confirmed_terms:s.terms,
        });
        if (!isCurrent(s,token)) return;
        if (!validResult(r,s)) throw Error("internal_receipt_unconfirmed");
        await check(s,token);
      } catch { if (isCurrent(s,token)) status.textContent=unknown; }
      finally { if (isCurrent(s,token)) { s.busy=false; update(s); } }
    });
    recover.addEventListener("click", async () => {
      const s=state, token=stamp;
      if (!s || !isCurrent(s,token) || !s.operation || s.busy || s.done || s.blocked) return;
      s.busy=true; update(s); status.textContent="이전 내부 등록 결과를 확인하는 중입니다.";
      try { await check(s,token); }
      catch { if (isCurrent(s,token)) status.textContent=unknown; }
      finally { if (isCurrent(s,token)) { s.busy=false; update(s); } }
    });
    function clear() { stamp++; state=null; panel.hidden=true; }
    function show(r) {
      clear();
      if (!alive || !current() || r?.branchId!==branchId || !uuid(r.operationId) ||
          r.status!=="draft" || !privateOnly(r) || !validTerms(r)) return;
      const terms=ownTerms(r);
      const s=state={terms,draft:r.operationId,operation:null,blocked:false,busy:false,done:false,
        key:`tennis-note-r4-internal-product-v1:${actor}:${branchId}:${r.operationId}`};
      panel.hidden=false;
      summary.textContent=`등록할 저장된 초안: ${terms.name} · ${terms.sessions}회 · ${terms.minutes}분 · ${terms.days}일 · ${terms.price.toLocaleString("ko-KR")}원`;
      status.textContent="위 조건을 확인한 뒤 내부 등록을 눌러 주세요.";
      try {
        const raw=storage.getItem(s.key);
        if (raw!==null) {
          const p=JSON.parse(raw);
          if (!uuid(p?.operation) || p.operation===s.draft || Object.keys(p).length!==1) throw Error("invalid_pointer");
          s.operation=p.operation; status.textContent="이전 내부 등록 결과를 확인해 주세요.";
        }
      } catch { s.blocked=true; status.textContent="이전 등록 기록을 확인할 수 없어 새 등록을 중단했습니다."; }
      update(s);
    }
    return Object.freeze({show,clear,destroy(){ alive=false; clear(); panel.remove(); }});
  }
  root.TennisNoteR4InternalProductRegistrationLocal = Object.freeze({mount});
})(window);
