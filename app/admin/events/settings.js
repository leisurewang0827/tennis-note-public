// 설정 화면의 이벤트 등록.
//
// app.js 의 bindEvents() 에서 문장을 그대로 옮겨왔다. 순서는 원본 안에서의
// 상대 순서를 유지한다. 등록 대상과 이벤트 종류가 화면마다 겹치지 않아
// 화면 사이의 순서는 결과에 영향을 주지 않는다.
// (같은 요소에 두 번 등록되는 건 document 뿐이고, 그건 delegated.js 에서
//  원래 순서 그대로 유지한다. stopImmediatePropagation 은 쓰이지 않는다.)

function bindSettingsEvents() {
  $("#adminMoreMenuButton")?.addEventListener("click", () => setAdminMoreMenuOpen(!adminMoreMenuOpen));
  $("#adminMenuButton")?.addEventListener("click", () => toggleAdminMenu());
  $("#adminMenuBackdrop")?.addEventListener("click", () => closeAdminMenu());
  $("#coachStaffForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCoachStaff();
  });
  $("#adminLockForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmAdminUnlock();
  });
  $("#closeAdminLockModal")?.addEventListener("click", closeAdminLockModal);
  $("#cancelAdminLockModal")?.addEventListener("click", closeAdminLockModal);
  $("#adminLockModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminLockModal") closeAdminLockModal();
  });
  $("#closeAdminToolsModal")?.addEventListener("click", closeAdminToolsModal);
  $("#adminToolsModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminToolsModal") closeAdminToolsModal();
  });
  $("#closePolicyVersionEditor")?.addEventListener("click", closePolicyVersionEditor);
  $("#cancelPolicyVersionEditor")?.addEventListener("click", closePolicyVersionEditor);
  $("#savePolicyVersionEditor")?.addEventListener("click", savePolicyVersionEditor);
  $("#policyVersionEditorModal")?.addEventListener("click", (event) => {
    if (event.target.id === "policyVersionEditorModal") closePolicyVersionEditor();
  });
  $("#operationsPasswordLoginForm")?.addEventListener("submit", signInAdminWithPassword);
  $("#sendAdminPasswordResetButton")?.addEventListener("click", sendAdminPasswordReset);
  $("#createAdminEmailAccountButton")?.addEventListener("click", createAdminEmailAccount);
  const operationProfileSelect = $("#operationProfileSelect");
  if (operationProfileSelect) {
    operationProfileSelect.addEventListener("change", async () => {
      const nextProfile = operationProfiles.find((profile) => profile.id === operationProfileSelect.value);
      if (!nextProfile || nextProfile.id === activeOperationProfileId) return;
      const approved = window.confirm(`${nextProfile.name} 운영시간과 코치 근무시간을 적용할까요?`);
      if (!approved) {
        operationProfileSelect.value = activeOperationProfileId;
        return;
      }
      await activateOperationProfile(nextProfile.id);
    });
  }
  $("#operationProfileBranchSelect")?.addEventListener("change", async (event) => {
    const profile = activeOperationProfile();
    const nextBranchId = String(event.target.value || "");
    if (nextBranchId === String(profile.branchId || "")) return;
    const backup = operationProfileWorkspaceBackup();
    const previousBranchId = String(profile.branchId || "");
    const nextBranch = operationBranchOptions().find((branch) => branch.id === nextBranchId);
    removeOperationProfileFromBranchMap(profile.id, previousBranchId);
    profile.branchId = nextBranchId;
    profile.branchName = nextBranch?.name || "";
    profile.updatedAt = new Date().toISOString();
    markOperationProfileActiveForBranch(profile);
    resetOperationBranchViewState();
    await persistOperationProfileWorkspace(
      backup,
      nextBranchId ? `${profile.name}을(를) ${profile.branchName}에 연결했습니다.` : `${profile.name}의 지점 연결을 해제했습니다.`,
    );
  });
  $("#addOperationProfileButton")?.addEventListener("click", async () => {
    const requestedName = window.prompt("새 운영 프로필 이름", "새 매장 운영");
    if (requestedName === null) return;
    const backup = operationProfileWorkspaceBackup();
    const profile = createOperationProfile(uniqueOperationProfileName(requestedName), activeOperationProfile());
    operationProfiles.push(profile);
    activeOperationProfileId = profile.id;
    markOperationProfileActiveForBranch(profile);
    applyOperationProfile(profile);
    await persistOperationProfileWorkspace(backup, `${profile.name} 프로필을 만들었습니다.`);
  });
  $("#duplicateOperationProfileButton")?.addEventListener("click", async () => {
    const source = activeOperationProfile();
    const requestedName = window.prompt("복제할 운영 프로필 이름", `${source.name} 복사본`);
    if (requestedName === null) return;
    const backup = operationProfileWorkspaceBackup();
    const profile = createOperationProfile(uniqueOperationProfileName(requestedName), source);
    operationProfiles.push(profile);
    activeOperationProfileId = profile.id;
    markOperationProfileActiveForBranch(profile);
    applyOperationProfile(profile);
    await persistOperationProfileWorkspace(backup, `${profile.name} 프로필을 복제했습니다.`);
  });
  $("#renameOperationProfileButton")?.addEventListener("click", async () => {
    const profile = activeOperationProfile();
    const requestedName = window.prompt("운영 프로필 이름 변경", profile.name);
    if (requestedName === null || !String(requestedName).trim()) return;
    const backup = operationProfileWorkspaceBackup();
    profile.name = uniqueOperationProfileName(requestedName, profile.id);
    profile.updatedAt = new Date().toISOString();
    await persistOperationProfileWorkspace(backup, `${profile.name}(으)로 이름을 변경했습니다.`);
  });
  $("#deleteOperationProfileButton")?.addEventListener("click", async () => {
    ensureOperationProfiles();
    if (operationProfiles.length <= 1) {
      showToast("운영 프로필은 하나 이상 필요합니다.");
      return;
    }
    const profile = activeOperationProfile();
    if (!window.confirm(`${profile.name} 프로필을 삭제할까요? 수업과 회원 데이터는 삭제되지 않습니다.`)) return;
    const backup = operationProfileWorkspaceBackup();
    const index = operationProfiles.findIndex((item) => item.id === profile.id);
    operationProfiles.splice(index, 1);
    removeOperationProfileFromBranchMap(profile.id, profile.branchId);
    const replacement = operationProfiles.find((item) => (
      String(item.branchId || "") === String(profile.branchId || "")
    )) || operationProfiles[Math.max(0, index - 1)] || operationProfiles[0];
    activeOperationProfileId = replacement.id;
    markOperationProfileActiveForBranch(replacement);
    applyOperationProfile(replacement);
    await persistOperationProfileWorkspace(backup, `${profile.name} 프로필을 삭제했습니다.`);
  });
  $("#coachStaffModal")?.addEventListener("click", (event) => {
    if (event.target.id === "coachStaffModal") closeCoachStaffModal();
  });
  $("#discountPolicySearch")?.addEventListener("input", (event) => {
    state.discountSearch = event.target.value;
    renderServiceReadiness();
  });
  $("#discountPolicyStatusFilter")?.addEventListener("change", (event) => {
    state.discountStatusFilter = event.target.value;
    renderServiceReadiness();
    saveSnapshot();
  });
  const refreshSupabaseStatus = $("#refreshSupabaseStatus");
  if (refreshSupabaseStatus) {
    refreshSupabaseStatus.addEventListener("click", () => {
      loadSupabaseLiveStatus();
      showToast("Supabase 읽기 상태 확인");
    });
  }
  const refreshAuthStatus = $("#refreshAuthStatus");
  if (refreshAuthStatus) {
    refreshAuthStatus.addEventListener("click", () => {
      loadAuthProviderStatus();
      showToast("로그인 제공자 상태 확인");
    });
  }
}
