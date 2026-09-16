// 회원 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function closeCleanMemberInlineEditor(nextView) {
  if (state.view !== "members" || nextView === "members" || !state.inlineMemberId) return;
  const openEditor = document.querySelector(".member-inline-editor--compact");
  if (openEditor?.dataset.dirty === "true") return;
  state.inlineMemberId = null;
  state.inlineMemberTicketId = "";
}

async function openMemberManagementModal(member, action, ticketId = "") {
  if (["profile", "app_link"].includes(action)) ticketId = "";
  const targetUserId = member?.serverUserId || "";
  const initialTicket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === ticketId) || null;
  if (!targetUserId || !memberManagementActionAllowed(action, initialTicket)) {
    showToast("이 작업을 처리할 권한이 없습니다.");
    return;
  }
  const refreshed = await syncAdminLiveData();
  if (!refreshed) {
    showToast("최신 회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  let refreshedMember = members.find((item) => memberServerUserIds(item).includes(targetUserId));
  if (!refreshedMember && operationsRole() === "admin" && state.view === "members") {
    // The operational roster intentionally excludes branchless app-signup users.
    // Await the authoritative directory page before deciding that the member vanished.
    await loadAdminMemberDirectoryPage({ force: true, render: false, preserveList: true });
    refreshedMember = members.find((item) => memberServerUserIds(item).includes(targetUserId));
  }
  const refreshedTicket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === ticketId) || null;
  if (!refreshedMember || !memberManagementActionAllowed(action, refreshedTicket)) {
    showToast("회원 또는 회원권 상태가 변경됐습니다. 회원 목록에서 다시 확인해 주세요.");
    return;
  }
  if (action === "app_link") await refreshMemberAuthManagement(refreshedMember);
  Object.assign(memberManagementModalState, {
    memberId: refreshedMember.id,
    action,
    ticketId,
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: ["link_existing", "app_link"].includes(action) ? refreshedMember.name || "" : "",
    forceDeletePreview: null,
    forceDeletePreviewLoading: action === "force_delete",
    forceDeletePreviewError: "",
    closePreview: null,
    closePreviewLoading: action === "close",
    closePreviewError: "",
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
  syncMemberCreateSchedule($("#memberManagementForm"));
  syncMemberReenrollSchedule($("#memberManagementForm"));
  syncMemberManagementPaymentFields($("#memberManagementForm"), { forcePrice: true });
  syncMemberRegistrationSummary($("#memberManagementForm"));
  window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  if (action === "app_link") loadMemberLinkCandidates(refreshedMember);
  if (action === "force_delete") loadMemberTicketForceDeletePreview(ticketId);
  if (action === "close") loadMemberTicketFutureClosePreview(refreshedMember.serverUserId);
  setTimeout(() => $("#memberManagementForm input, #memberManagementForm select")?.focus(), 0);
}

async function openManualMemberModal() {
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    showToast("관리자 계정으로 로그인해야 회원을 추가할 수 있습니다.");
    return;
  }
  const refreshed = await syncAdminLiveData();
  if (!refreshed) {
    showToast("최신 회원권과 코치 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  Object.assign(memberManagementModalState, {
    memberId: null,
    action: "create",
    ticketId: "",
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: "",
    createStep: 1,
    forceDeletePreview: null,
    forceDeletePreviewLoading: false,
    forceDeletePreviewError: "",
  });
  renderMemberManagementModal();
  $("#memberManagementModal")?.removeAttribute("hidden");
  syncMemberManagementBalance($("#memberManagementForm"));
  syncMemberManagementScopeFields($("#memberManagementForm"));
  syncManualMemberPartnerField($("#memberManagementForm"));
  syncMemberCreateSchedule($("#memberManagementForm"));
  syncMemberReenrollSchedule($("#memberManagementForm"));
  syncMemberManagementPaymentFields($("#memberManagementForm"), { forcePrice: true });
  syncMemberRegistrationSummary($("#memberManagementForm"));
  window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
  setTimeout(() => $("#memberManagementForm input[name='memberName']")?.focus(), 0);
}

function closeMemberManagementModal() {
  $("#memberManagementModal")?.setAttribute("hidden", "");
  Object.assign(memberManagementModalState, {
    memberId: null,
    action: "",
    ticketId: "",
    message: "",
    linkCandidates: [],
    linkCandidatesLoading: false,
    linkCandidatesLoadedFor: "",
    linkQuery: "",
    createStep: 1,
    forceDeletePreview: null,
    forceDeletePreviewLoading: false,
    forceDeletePreviewError: "",
  });
  const target = $("#memberManagementModalContent");
  if (target) target.innerHTML = "";
}

function openMemberInlineEditor(memberId, ticketId = "") {
  memberAdminEditEnabled = true;
  memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
  state.inlineMemberId = Number(memberId);
  state.inlineMemberTicketId = String(ticketId || "");
  renderMembers();
  window.setTimeout(() => {
    const form = document.querySelector(`[data-member-inline-form="${Number(memberId)}"][data-ticket-id="${CSS.escape(String(ticketId || ""))}"]`);
    form?.querySelector("input, select")?.focus();
  }, 0);
}

function positionMemberQuickEditPopover() {
  const popover = $("#memberQuickEditPopover");
  const anchor = document.querySelector(`[data-open-member-inline="${state.inlineMemberId || ""}"]`);
  if (!popover || popover.hidden || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  const maxLeft = Math.max(margin, window.innerWidth - popover.offsetWidth - margin);
  popover.style.left = `${Math.min(maxLeft, Math.max(margin, rect.right + 8))}px`;
  popover.style.top = `${Math.min(
    Math.max(margin, window.innerHeight - popover.offsetHeight - margin),
    Math.max(margin, rect.top - 12),
  )}px`;
}

async function openSimpleMemberRegistrationHub() {
  await openManualMemberModal();
}
