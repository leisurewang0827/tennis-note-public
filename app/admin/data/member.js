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

async function searchManualMemberPartnerCandidates(form, options = {}) {
  if (!form?.elements?.partnerSearch) return [];
  const query = String(form.elements.partnerSearch.value || "").trim();
  const normalizedQuery = normalizedMemberLinkSearch(query);
  const queryDigits = normalizedMemberPhone(query);
  if (normalizedQuery.length < 2 && queryDigits.length < 4) {
    manualMemberPartnerSearchState.delete(form);
    filterManualMemberPartnerOptions(form);
    return [];
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || operationsRole() !== "admin") {
    setManualMemberPartnerStatus(form, "서버 회원 검색을 사용할 수 없습니다. 관리자 로그인 상태를 확인해 주세요.", "danger");
    return [];
  }
  const requestId = createMemberChangeBatchId();
  const stateValue = {
    query: query.toLowerCase(),
    requestId,
    loading: true,
    candidates: [],
  };
  manualMemberPartnerSearchState.set(form, stateValue);
  filterManualMemberPartnerOptions(form);
  try {
    const response = await client.rpc("tn_admin_search_member_partner_candidates", {
      target_query: query,
      target_branch_id: activeOperationBranchId() || null,
      target_current_user_id: form.querySelector("[data-manual-existing-partner]")?.dataset.currentMemberUserId || null,
      target_limit: 20,
    });
    if (manualMemberPartnerSearchState.get(form)?.requestId !== requestId) return [];
    const candidates = (Array.isArray(response) ? response : response?.candidates || [])
      .filter((candidate) => candidate?.id)
      .map((candidate) => ({
        ...candidate,
        id: String(candidate.id),
        eligible: candidate.eligible === true,
        eligibilityCode: String(candidate.eligibilityCode || ""),
      }));
    manualMemberPartnerSearchState.set(form, {
      query: query.toLowerCase(),
      requestId,
      loading: false,
      candidates,
    });
    const exactEligible = candidates.filter((candidate) => candidate.eligible && candidate.exactPhoneMatch === true);
    const exactBlocked = candidates.filter((candidate) => !candidate.eligible && candidate.exactPhoneMatch === true);
    if (options.promoteExactPhone && exactEligible.length === 1) {
      const existingMode = form.querySelector('input[name="partnerMode"][value="existing"]');
      if (existingMode) existingMode.checked = true;
      syncManualMemberPartnerField(form);
      form.elements.partnerSearch.value = query;
      setManualMemberPartnerStatus(form, `${exactEligible[0].name || "앱 가입 회원"} 계정을 찾았습니다. 이름을 확인하고 선택해 주세요.`, "good");
    } else if (options.promoteExactPhone && exactEligible.length > 1) {
      setManualMemberPartnerStatus(form, "같은 전화번호의 회원 계정이 여러 개입니다. 임의로 연결하지 말고 계정 연결 점검을 진행해 주세요.", "danger", "new");
    } else if (options.promoteExactPhone && exactBlocked.length) {
      setManualMemberPartnerStatus(form, manualMemberPartnerCandidateStatus(exactBlocked[0]), "danger", "new");
    } else if (!candidates.length) {
      setManualMemberPartnerStatus(form, "일치하는 회원 계정이 없습니다. 신규 회원이면 새 파트너 등록을 계속하세요.");
    } else {
      setManualMemberPartnerStatus(form, "검색 결과에서 이름과 전화번호 끝자리를 확인한 뒤 선택해 주세요.");
    }
    filterManualMemberPartnerOptions(form);
    return candidates;
  } catch (error) {
    if (manualMemberPartnerSearchState.get(form)?.requestId !== requestId) return [];
    manualMemberPartnerSearchState.set(form, {
      query: query.toLowerCase(),
      requestId,
      loading: false,
      candidates: [],
      error: String(error?.message || error || "partner_search_failed"),
    });
    setManualMemberPartnerStatus(form, "회원 계정 검색에 실패했습니다. 네트워크와 서버 기능 적용 여부를 확인한 뒤 다시 검색해 주세요.", "danger");
    filterManualMemberPartnerOptions(form);
    return [];
  }
}
