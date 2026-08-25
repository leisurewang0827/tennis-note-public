// 회원 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindMembersEvents() {
  $("#onsitePaymentMember")?.addEventListener("change", syncOnsitePaymentSourceTickets);
  $("#adminScheduleMemberSearch")?.addEventListener("input", (event) => {
    if (state.scheduleMemberSearch !== event.target.value) state.scheduleSearchLastAutoJump = "";
    state.scheduleMemberSearch = event.target.value;
    renderSchedule();
    autoJumpToExactScheduleMember();
  });
  $("#adminScheduleMemberSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const target = scheduleMemberSearchMatches()[0];
    if (target) jumpToScheduleSearchResult(target.lessonDate, target.day, target.id);
  });
  $("#clearAdminScheduleMemberSearch")?.addEventListener("click", () => {
    state.scheduleMemberSearch = "";
    state.scheduleSearchLastAutoJump = "";
    renderSchedule();
    $("#adminScheduleMemberSearch")?.focus();
  });
  $("#adminScheduleMemberSearchResult")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jump-schedule-date]");
    if (button) jumpToScheduleSearchResult(button.dataset.jumpScheduleDate, button.dataset.jumpScheduleDay, button.dataset.jumpScheduleLesson);
  });
  $("#globalSearch").addEventListener("input", () => {
    renderGlobalSearchResults();
    if (state.view === "members") renderMembers();
    if (state.view === "schedule") renderSchedule();
  });
  $("#addMemberButton").addEventListener("click", openManualMemberModal);
  $("#exportMembersButton")?.addEventListener("click", exportVisibleMembers);
  $("#memberListSearch")?.addEventListener("input", (event) => {
    state.memberSearch = event.target.value;
    state.memberListPage = 0;
    window.clearTimeout(memberSearchRenderTimer);
    memberSearchRenderTimer = window.setTimeout(() => {
      state.selectedMemberId = null;
      renderMembers();
      void loadAdminMemberDirectoryPage({ force: true });
    }, 120);
  });
  $("#resetMemberFilters")?.addEventListener("click", () => {
    state.memberSearch = "";
    state.memberCoachFilter = "all";
    state.memberTicketFilter = "all";
    state.memberTicketGridFilter = "all";
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    void loadAdminMemberDirectoryPage({ force: true });
    saveSnapshot();
  });
  $("#memberCoachFilter")?.addEventListener("change", (event) => {
    state.memberCoachFilter = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    void loadAdminMemberDirectoryPage({ force: true });
    saveSnapshot();
  });
  $("#memberTicketFilter")?.addEventListener("change", (event) => {
    state.memberTicketFilter = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    void loadAdminMemberDirectoryPage({ force: true });
    saveSnapshot();
  });
  $("#memberTicketGridFilter")?.addEventListener("change", (event) => {
    state.memberTicketGridFilter = event.target.value;
    state.memberListPage = 0;
    state.selectedMemberId = null;
    renderMembers();
    saveSnapshot();
  });
  $("#downloadMemberImportTemplateButton")?.addEventListener("click", downloadImportTemplate);
  $("#uploadMemberImportWorkbookButton")?.addEventListener("click", () => {
    openAdminToolsModal("data");
    window.setTimeout(() => $("#dataImportFile")?.click(), 0);
  });
  const memberScheduleRequestOnlyInput = $("#memberScheduleRequestOnly");
  if (memberScheduleRequestOnlyInput) {
    memberScheduleRequestOnlyInput.addEventListener("change", async () => {
      const previousValue = scheduleSettings.memberScheduleRequestOnly !== false;
      scheduleSettings.memberScheduleRequestOnly = memberScheduleRequestOnlyInput.checked;
      renderScheduleSettings();
      saveSnapshot();
      const synced = await syncLiveSchedulePolicyToServer();
      if (!(await recoverLiveSchedulePolicySave(synced, () => {
        scheduleSettings.memberScheduleRequestOnly = previousValue;
      }))) return;
      showToast("회원앱 시간표 표시 저장 완료");
    });
  }
  $("#lessonMemberSearch").addEventListener("input", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    refreshLessonMemberOptions();
    alignCoachToSelectedMemberTicket();
    refreshLessonTicketOptions();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    renderLessonExpiredTickets();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#lessonMemberSearch").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !state.quickLessonEntry) return;
    event.preventDefault();
    const selectedMember = $("#lessonMember");
    if (!selectedMember?.value) return;
    selectedMember.focus();
  });
  $("#lessonMember").addEventListener("change", () => {
    state.pinnedLessonTicketId = "";
    state.lessonSourceTouched = false;
    alignCoachToSelectedMemberTicket();
    refreshLessonTicketOptions();
    syncLessonModalWeekToSelectedTicket();
    syncLessonSourceFromTicket(true);
    refreshLessonDayOptions();
    renderLessonExpiredTickets();
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#lessonAdminOverride")?.addEventListener("change", () => {
    const currentMember = $("#lessonMember")?.value || "";
    refreshLessonMemberOptions(currentMember, getCurrentEditingLesson());
    if (currentMember && [...$("#lessonMember").options].some((option) => option.value === currentMember)) {
      $("#lessonMember").value = currentMember;
    }
    refreshLessonTicketOptions();
    syncLessonSourceOptions();
    refreshLessonDurationOptions();
    refreshLessonDayOptions();
    refreshLessonTimeOptions($("#lessonTime").value);
    refreshLessonMakeupEntitlementOptions();
    renderLessonPreview();
  });
  $("#memberManagementModal")?.addEventListener("click", (event) => {
    if (event.target.id === "memberManagementModal") closeMemberManagementModal();
    if (event.target.closest("[data-search-member-link]")) {
      event.preventDefault();
      const member = members.find((item) => item.id === memberManagementModalState.memberId);
      const query = $("#memberManagementForm")?.elements.memberLinkQuery?.value || "";
      loadMemberLinkCandidates(member, query);
    }
    if (event.target.closest("[data-search-existing-member-link]")) {
      event.preventDefault();
      const query = $("#memberManagementForm")?.elements.existingMemberLinkQuery?.value || "";
      memberManagementModalState.linkQuery = String(query).trim();
      renderMemberManagementModal();
      setTimeout(() => $("#memberManagementForm")?.elements.existingMemberLinkQuery?.focus(), 0);
    }
  });
  $("#memberManagementModal")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !["memberLinkQuery", "existingMemberLinkQuery"].includes(event.target?.name)) return;
    event.preventDefault();
    if (event.target.name === "existingMemberLinkQuery") {
      memberManagementModalState.linkQuery = String(event.target.value || "").trim();
      renderMemberManagementModal();
      setTimeout(() => $("#memberManagementForm")?.elements.existingMemberLinkQuery?.focus(), 0);
      return;
    }
    const member = members.find((item) => item.id === memberManagementModalState.memberId);
    loadMemberLinkCandidates(member, event.target.value);
  });
  $$(".segment[data-member-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.memberFilter = button.dataset.memberFilter;
      state.memberListPage = 0;
      state.selectedMemberId = null;
      renderMembers();
      void loadAdminMemberDirectoryPage({ force: true });
      if (state.memberFilter === "pending" && operationsRole() === "admin" && !adminPendingUsersState.loaded && !adminPendingUsersState.loading) {
        refreshAdminPendingUsers();
      }
      saveSnapshot();
    });
  });
  $("#membershipProductSearch")?.addEventListener("input", (event) => {
    state.membershipProductSearch = event.target.value;
    state.membershipProductPage = 0;
    state.activeMembershipProductId = "";
    renderServiceReadiness();
  });
  $("#membershipProductStatusFilter")?.addEventListener("change", (event) => {
    state.membershipProductStatusFilter = event.target.value;
    state.membershipProductPage = 0;
    state.activeMembershipProductId = "";
    renderServiceReadiness();
    saveSnapshot();
  });
}
