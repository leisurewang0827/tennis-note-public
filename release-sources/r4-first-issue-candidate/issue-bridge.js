// LOCAL PROTOTYPE: no automatic activation, DOM insertion, secret or deployment.
// Server-side scope enforcement remains mandatory. The caller must provide a reviewed,
// session-bound capability and an explicitly authorized transport; none exists here.
(function (root) {
  const uuid = x => typeof x === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
  const keys = ["branch", "member", "product", "coach", "operation"];
  root.TennisNoteR4FirstIssuePrototype = Object.freeze({
    create({ capability, client, branchElement, productionVerified }) {
      let busy = false;
      const scope = capability && Object.freeze({ ...capability });
      async function issue(request) {
        if (busy || productionVerified !== true || scope?.enabled !== true || !client ||
            typeof client.rpc !== "function" || typeof client.sessionSubject !== "function" ||
            typeof branchElement?.dispatchEvent !== "function" || branchElement.value !== scope.branch ||
            client.sessionSubject() !== scope.actor || !uuid(scope.actor) ||
            !Number.isFinite(scope.expiresAt) || scope.expiresAt <= Date.now() ||
            scope.expiresAt > Date.now() + 300000 ||
            keys.some(k => !uuid(scope[k]) || request?.[k] !== scope[k])) {
          throw Error("r4_first_issue_not_available");
        }
        busy = true;
        try {
          const result = await client.rpc("tn_r4_first_zero_issue", {
            p_branch: scope.branch, p_member: scope.member, p_product: scope.product,
            p_coach: scope.coach, p_operation: scope.operation,
          }, { requireCurrentSession: true, retryAuth: false });
          if (client.sessionSubject() !== scope.actor || branchElement.value !== scope.branch ||
              Date.now() >= scope.expiresAt || result?.branchId !== scope.branch ||
              result?.memberId !== scope.member || result?.productId !== scope.product ||
              result?.coachId !== scope.coach || !uuid(result?.ticketId) || result?.price !== 0 ||
              result?.payment !== false) throw Error("r4_first_issue_readback_mismatch");
          branchElement.dispatchEvent(new Event("r4-ticket-imported"));
          return result;
        } finally { busy = false; }
      }
      return Object.freeze({ issue });
    },
  });
})(globalThis);
