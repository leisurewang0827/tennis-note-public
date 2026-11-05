(function installR4SelfserveClient(root) {
  const cache = new WeakMap();
  const names = Object.freeze({
    tn_r4_open_my_branch: "tn_r4_prod_selfserve_open",
    tn_r4_my_managed_branches: "tn_r4_prod_selfserve_branches",
    tn_r4_get_operating_hours: "tn_r4_prod_selfserve_get_hours",
    tn_r4_save_operating_hours: "tn_r4_prod_selfserve_save_hours",
    tn_r4_initialize_first_lesson: "tn_r4_prod_selfserve_first_setup",
    tn_r4_admin_save_options: "tn_r4_prod_selfserve_save_options",
    tn_r4_admin_saved_lesson: "tn_r4_prod_selfserve_saved_lesson",
    tn_r4_get_ticket_write_state: "tn_r4_prod_selfserve_ticket_state",
    tn_r4_save_ticket_memo: "tn_r4_prod_selfserve_save_memo",
    tn_r4_branch_operations_options: "tn_r4_prod_selfserve_ops_options",
    tn_r4_save_lesson_policy: "tn_r4_prod_selfserve_save_policy",
    tn_r4_create_branch_product: "tn_r4_prod_selfserve_create_product",
    tn_r4_initial_sheet_row: "tn_r4_prod_selfserve_sheet_row",
  });
  root.TennisNoteR4SelfserveClient = Object.freeze({
    forBranch(client, branchId) {
      if (root.TennisNoteR4ExistingAccount?.isProductionTarget?.() !== true) throw Error("r4_environment_mismatch");
      const actor = client?.sessionSubject?.();
      if (!actor || !client?.rpc || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branchId)) {
        throw Error("r4_selfserve_session_required");
      }
      let entry = cache.get(client);
      if (!entry || entry.actor !== actor) {
        entry = { actor, branches: new Map() };
        cache.set(client, entry);
      }
      if (entry.branches.has(branchId)) return entry.branches.get(branchId);
      const scoped = Object.freeze({
        sessionSubject: () => actor === client.sessionSubject?.() ? actor : null,
        async rpc(name, args = {}, options = {}) {
          if (actor !== client.sessionSubject?.()) throw Error("r4_session_changed");
          const target = args.target_branch_id ?? args.target_branch ?? args.branch;
          if (target !== undefined && target !== branchId) throw Error("r4_selfserve_branch_mismatch");
          let mapped = names[name];
          if (name === "tn_schedule_v2_save_lesson") {
            if (target !== branchId || args.target_schedule_kind !== "regular" ||
                args.target_lesson_id != null || args.target_request_id != null) {
              throw Error("r4_selfserve_new_regular_only");
            }
            mapped = name;
          }
          if (!mapped) throw Error("r4_selfserve_action_not_available");
          const result = await client.rpc(mapped, args, {
            ...options, requireCurrentSession: true, retryAuth: false,
          });
          if (actor !== client.sessionSubject?.()) throw Error("r4_session_changed");
          return result;
        },
      });
      entry.branches.set(branchId, scoped);
      return scoped;
    },
  });
})(window);
