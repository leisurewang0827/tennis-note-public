(function installScopedProductionDraft(root, document) {
  "use strict";
  const uuid = s => typeof s === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
  const select = document.getElementById("r4ManagedBranch");
  const panel = document.getElementById("r4BranchHoursPanel");
  const hoursForm = document.getElementById("r4BranchHoursForm");
  if (!select || !panel || !hoursForm || typeof root.MutationObserver !== "function") return;
  let revision = 0, controller = null, container = null, stopWatch = null;
  const production = () => root.TennisNoteR4ExistingAccount?.isProductionTarget?.() === true &&
    root.location.origin === "https://tennisnote-admin.pages.dev";
  function sessionClaims(client) {
    try {
      if(typeof client?.authStorageKey!=="string" || typeof client?.authPersistenceKey!=="string") return null;
      const persistence=root.localStorage.getItem(client.authPersistenceKey);
      if(persistence!==null && persistence!=="local" && persistence!=="session") return null;
      const store=persistence==="session"?root.sessionStorage:root.localStorage;
      const stored=JSON.parse(store.getItem(client.authStorageKey)||"null"),token=stored?.access_token;
      if (typeof token!=="string" || token.split(".").length!==3) return null;
      const part=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
      const claim=JSON.parse(root.atob(part.padEnd(Math.ceil(part.length/4)*4,"=")));
      if(!uuid(claim.sub) || !uuid(claim.session_id) || (stored?.user?.id && stored.user.id!==claim.sub)) return null;
      return {actor:claim.sub,session:claim.session_id};
    } catch { return null; }
  }
  function close() {
    revision++; stopWatch?.(); stopWatch = null; controller?.destroy(); controller = null;
    container?.remove(); container = null;
  }
  select.addEventListener("change", close);
  new root.MutationObserver(() => { if (hoursForm.hidden || !select.value) close(); }).observe(hoursForm,{attributes:true,attributeFilter:["hidden"]});
  function waitForHours(current) {
    if (!current()) return Promise.resolve(false);
    if (!hoursForm.hidden) return Promise.resolve(true);
    return new Promise(resolve => {
      let done=false; const finish=value=>{if(done)return;done=true;observer.disconnect();root.clearTimeout(timer);resolve(value);};
      const observer=new root.MutationObserver(()=>{if(!current())finish(false);else if(!hoursForm.hidden)finish(true);});
      observer.observe(hoursForm,{attributes:true,attributeFilter:["hidden"]});
      const timer=root.setTimeout(()=>finish(false),5000);
      if(!current())finish(false); else if(!hoursForm.hidden)finish(true);
    });
  }
  async function open({client, branchId, currentContext}) {
    close();
    const stamp = revision, initial = sessionClaims(client), actor = initial?.actor, initialSession = initial?.session;
    const current = () => {
      const now=sessionClaims(client);
      const valid=stamp === revision && production() && actor && initialSession && actor === now?.actor &&
        now?.session === initialSession && uuid(branchId) && select.value === branchId && currentContext?.() === true;
      if (!valid && stamp === revision) close();
      return !!valid;
    };
    if (!current() || typeof client?.rpc !== "function") return false;
    const opts = {requireCurrentSession:true, retryAuth:false};
    try {
      if (!await waitForHours(current) || !current()) return false;
      const access = await client.rpc("tn_r4_prod_product_draft_get", {p_branch:branchId,p_operation:null}, opts);
      if (!current() || access?.branchId !== branchId || access.status !== "draft_access" ||
          !uuid(access.draftOperationId) || typeof access.internalRegistrationEnabled !== "boolean" ||
          access.public !== false || access.saleEnabled !== false || access.paymentEnabled !== false) return false;
      const draft = access.draftOperationId, internalEnabled = access.internalRegistrationEnabled;
      const scoped = Object.freeze({
        allowInternal:internalEnabled,
        rejectAmbiguous:()=>{if(current()) close();},
        sessionSubject:() => current() ? actor : null,
        async rpc(name,args) {
          if (!current() || !["tn_r4_prod_product_draft_get","tn_r4_prod_product_draft_save"].includes(name) ||
              args?.p_branch !== branchId || args?.p_operation !== draft) throw Error("r4_prod_scope_denied");
          let result;
          try { result=await client.rpc(name,args,opts); }
          catch (error) { if(name.endsWith("_get") && current()) close(); throw error; }
          if (!current()) throw Error("r4_prod_scope_changed");
          return result;
        },
        async internalRegistrationRpc(name,args) {
          if (!current() || !internalEnabled || !["tn_r4_internal_product_register","tn_r4_internal_product_get"].includes(name) ||
              args?.p_branch !== branchId || (name.endsWith("_register") && args?.p_draft !== draft)) throw Error("r4_prod_scope_denied");
          const result=await client.rpc(name,args,opts);
          if (!current()) throw Error("r4_prod_scope_changed");
          return result;
        }
      });
      if (!current() || !root.TennisNoteR4ProductDraftCandidate?.mount) return false;
      container=document.createElement("section"); container.id="r4ProductDraftHost";
      container.setAttribute("aria-label","상품 설정 초안"); panel.append(container);
      controller=root.TennisNoteR4ProductDraftCandidate.mount(container,{
        client:scoped,branchId,draftOperationId:draft,currentBranch:()=>select.value,
        scopeRevision:()=>revision,storage:root.localStorage
      });
      const watch=()=>{current();};
      const timer=root.setInterval(watch,1000);
      for(const event of ["storage","focus","pageshow","tennisnote:oauth-result"]) root.addEventListener(event,watch);
      document.addEventListener("visibilitychange",watch);
      stopWatch=()=>{root.clearInterval(timer);for(const event of ["storage","focus","pageshow","tennisnote:oauth-result"]) root.removeEventListener(event,watch);document.removeEventListener("visibilitychange",watch);};
      return true;
    } catch { if (stamp === revision) close(); return false; }
  }
  root.TennisNoteR4ProductionDraftHost=Object.freeze({open,close});
})(window,document);
