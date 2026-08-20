// 서버(Supabase)에서 회원 데이터를 가져오는 함수들.
//
// 서버에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function loadAdminMemberDetail(member, { force = false, renderResult = true } = {}) {
  const userId = String(member?.serverUserId || "");
  if (!userId || operationsRole() !== "admin" || !window.TennisNoteDataClient?.rpc) return false;
  const current = adminMemberDetailCache.get(userId);
  if (!force && current?.status === "loaded") return true;
  if (!force && current?.promise) return current.promise;

  const requestId = Number(current?.requestId || 0) + 1;
  const entry = { status: "loading", error: "", data: null, requestId, promise: null };
  entry.promise = window.TennisNoteDataClient.rpc("tn_admin_member_detail", {
    target_user_id: userId,
  }).then((response) => {
    const latest = adminMemberDetailCache.get(userId);
    if (latest?.requestId !== requestId) return false;
    const payload = Array.isArray(response) ? response[0] : response;
    applyAdminMemberDetail(member, payload);
    Object.assign(latest, { status: "loaded", error: "", data: payload, promise: null });
    if (renderResult && state.view === "members" && state.selectedMemberId === member.id) {
      renderMembers({ preserveList: true });
    }
    return true;
  }).catch((error) => {
    const latest = adminMemberDetailCache.get(userId);
    if (latest?.requestId !== requestId) return false;
    Object.assign(latest, {
      status: "failed",
      error: String(error?.message || error || "member_detail_failed"),
      promise: null,
    });
    if (renderResult && state.view === "members" && state.selectedMemberId === member.id) {
      renderMembers({ preserveList: true });
    }
    return false;
  });
  adminMemberDetailCache.set(userId, entry);
  if (force && current?.status === "failed" && state.view === "members" && state.selectedMemberId === member.id) {
    renderMembers({ preserveList: true });
  }
  return entry.promise;
}

async function loadAdminMemberDirectoryPage({ force = false, render = true, preserveList = false } = {}) {
  if (operationsRole() !== "admin" || !window.TennisNoteDataClient?.rpc) return false;
  const signature = adminMemberDirectorySignature();
  if (!force && adminMemberDirectoryState.loaded && adminMemberDirectoryState.signature === signature) return false;

  const requestId = adminMemberDirectoryState.requestId + 1;
  Object.assign(adminMemberDirectoryState, {
    loading: true,
    error: "",
    counts: preserveList ? adminMemberDirectoryState.counts : null,
    preserveCountsWhileLoading: Boolean(preserveList && adminMemberDirectoryState.counts),
    requestId,
  });
  if (render && state.view === "members") {
    renderMembers({ preserveList });
    rememberAdminViewRender("members");
  }
  try {
    const query = JSON.parse(signature);
    const response = await window.TennisNoteDataClient.rpc("tn_admin_member_directory_page", {
      target_branch_id: query.branchId,
      target_status: query.status,
      target_search: query.search,
      target_coach_role_id: query.coachRoleId,
      target_product_kind: query.productKind,
      target_page: query.page,
      target_page_size: query.pageSize,
    });
    if (requestId !== adminMemberDirectoryState.requestId) return false;
    const payload = Array.isArray(response) ? response[0] : response;
    const directoryRows = Array.isArray(payload?.rows) ? payload.rows : [];
    directoryRows.forEach((row) => memberFromAdminDirectoryRow(row));
    Object.assign(adminMemberDirectoryState, {
      loading: false,
      loaded: true,
      error: "",
      signature,
      rows: directoryRows,
      total: Number(payload?.total) || 0,
      counts: payload?.counts && typeof payload.counts === "object"
        ? payload.counts
        : adminMemberDirectoryState.counts,
      preserveCountsWhileLoading: false,
    });
    if (render && state.view === "members") {
      renderMembers();
      rememberAdminViewRender("members");
    }
    return true;
  } catch (error) {
    if (requestId !== adminMemberDirectoryState.requestId) return false;
    Object.assign(adminMemberDirectoryState, {
      loading: false,
      loaded: false,
      error: String(error?.message || error || "member_directory_page_failed"),
      signature: "",
      counts: null,
      preserveCountsWhileLoading: false,
    });
    console.warn("[Tennis Note] member directory server paging unavailable; using local fallback", error);
    if (render && state.view === "members") {
      renderMembers();
      rememberAdminViewRender("members");
    }
    return false;
  }
}

async function loadMemberLinkCandidates(member, query = memberManagementModalState.linkQuery || "") {
  if (!member?.serverUserId || operationsRole() !== "admin") return;
  const inputGuardWasDirty = Boolean(
    window.TennisNoteInputGuard?.isDirty?.("#memberManagementModal"),
  );
  memberManagementModalState.linkQuery = String(query || "").trim();
  memberManagementModalState.linkCandidatesLoading = true;
  memberManagementModalState.linkCandidatesLoadedFor = member.serverUserId;
  renderMemberManagementModal();
  if (!inputGuardWasDirty) {
    window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  }
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_member_link_candidates", {
      target_user_id: member.serverUserId,
      target_query: memberManagementModalState.linkQuery || null,
    });
    if (memberManagementModalState.memberId !== member.id || memberManagementModalState.action !== "app_link") return;
    memberManagementModalState.linkCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    memberManagementModalState.linkCandidates = [];
  } finally {
    memberManagementModalState.linkCandidatesLoading = false;
    if (memberManagementModalState.memberId === member.id && memberManagementModalState.action === "app_link") {
      const inputGuardWasDirtyAfterRequest = Boolean(
        window.TennisNoteInputGuard?.isDirty?.("#memberManagementModal"),
      );
      renderMemberManagementModal();
      if (!inputGuardWasDirtyAfterRequest) {
        window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
      }
    }
  }
}

async function loadMemberTicketForceDeletePreview(ticketId) {
  const client = window.TennisNoteDataClient;
  if (!ticketId || !client?.rpc || memberManagementModalState.action !== "force_delete") return;
  memberManagementModalState.forceDeletePreviewLoading = true;
  memberManagementModalState.forceDeletePreview = null;
  memberManagementModalState.forceDeletePreviewError = "";
  renderMemberManagementModal();
  try {
    const result = await client.rpc("tn_admin_member_ticket_force_delete_preview", {
      target_ticket_id: ticketId,
    });
    if (memberManagementModalState.action !== "force_delete" || memberManagementModalState.ticketId !== ticketId) return;
    const preview = normalizedRpcResult(result);
    if (!preview?.ok || preview.ticketId !== ticketId) throw new Error("force_delete_preview_not_confirmed");
    memberManagementModalState.forceDeletePreview = preview;
  } catch (error) {
    if (memberManagementModalState.action !== "force_delete" || memberManagementModalState.ticketId !== ticketId) return;
    memberManagementModalState.forceDeletePreviewError = memberManagementErrorText(error);
  } finally {
    if (memberManagementModalState.action === "force_delete" && memberManagementModalState.ticketId === ticketId) {
      memberManagementModalState.forceDeletePreviewLoading = false;
      renderMemberManagementModal();
      window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    }
  }
}

async function loadMemberTicketFutureClosePreview(memberUserId) {
  const client = window.TennisNoteDataClient;
  if (!memberUserId || !client?.rpc || memberManagementModalState.action !== "close") return;
  memberManagementModalState.closePreviewLoading = true;
  memberManagementModalState.closePreview = null;
  memberManagementModalState.closePreviewError = "";
  renderMemberManagementModal();
  try {
    const result = await client.rpc("tn_admin_preview_member_ticket_and_future_lessons_close", {
      target_user_id: memberUserId,
    });
    if (memberManagementModalState.action !== "close") return;
    const preview = normalizedRpcResult(result);
    if (!preview?.ok || preview.userId !== memberUserId) throw new Error("member_close_preview_not_confirmed");
    memberManagementModalState.closePreview = preview;
  } catch (error) {
    if (memberManagementModalState.action !== "close") return;
    memberManagementModalState.closePreviewError = memberManagementErrorText(error);
  } finally {
    if (memberManagementModalState.action === "close") {
      memberManagementModalState.closePreviewLoading = false;
      renderMemberManagementModal();
      window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    }
  }
}

async function loadMemberManagementPolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) return false;
  try {
    const result = await client.rpc("tn_member_management_policy", {});
    Object.assign(memberManagementPolicy, normalizeMemberManagementPolicy(result || {}));
    renderMemberManagementPolicySettings();
    return true;
  } catch {
    Object.assign(memberManagementPolicy, defaultMemberManagementPolicy);
    renderMemberManagementPolicySettings();
    return false;
  }
}
