(function installR4ProductDraftDevScoped(root) {
  "use strict";
  const environmentOk = () => {
    const c = root.TennisNoteDataClient?.loadConfig?.() || root.TENNISNOTE_CONFIG || {};
    return root.location.origin === "https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev" && c.environment === "development" &&
      c.supabaseUrl === "https://udjmiezroipctytmztwz.supabase.co" &&
      c.projectFingerprint === "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
  };
  const names = Object.freeze({
    tn_r4_prod_product_draft_save: "tn_r4_dev_product_draft_save",
    tn_r4_prod_product_draft_get: "tn_r4_dev_product_draft_get",
  });
  root.TennisNoteR4ProductDraftDevScoped = Object.freeze({
    environmentOk,
    forBranch(client,branchId) {
      const actor=client?.sessionSubject?.();
      if (!environmentOk() || !actor || !client?.rpc ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branchId)) throw Error("r4_dev_draft_scope_denied");
      return Object.freeze({
        sessionSubject:()=>environmentOk() && actor===client.sessionSubject?.() ? actor : null,
        async rpc(name,args,options) {
          if (!environmentOk() || actor!==client.sessionSubject?.() || !names[name] || args?.p_branch!==branchId)
            throw Error("r4_dev_draft_scope_denied");
          const result=await client.rpc(names[name],args,{...options,requireCurrentSession:true,retryAuth:false});
          if (!environmentOk() || actor!==client.sessionSubject?.()) throw Error("r4_dev_draft_scope_denied");
          return result;
        },
      });
    },
  });
})(window);
