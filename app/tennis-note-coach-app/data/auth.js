// 로그인·로그아웃과 코치 세션을 서버와 주고받는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function activateLiveCoachProfile(profileId) {
  const nextProfileId = String(profileId || "");
  const profileChanged = state.liveProfileId !== nextProfileId;

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  if (!profileChanged) return;

  state.coach = null;
  state.todayLessons = [];
  state.makeupRequests = [];
  state.feedbackRequests = [];
  state.ntrpRequests = [];
  state.lessonLogs = [];
  state.members = [];
  state.expiredMembers = [];
  state.proxySettlements = [];
  state.coachSettlement = null;
  state.coachSettlementError = "";
  state.coachSettlementLoading = false;
  state.liveLessons = [];
  state.releasedMakeupSlots = [];
  state.scheduleOperationDays = [];
  state.liveLessonsLoaded = false;
  state.liveMembersLoaded = false;
  coachScheduleV2WorkspaceCache = null;
  state.viewingMemberDetailId = "";
  state.viewingMemberGroupName = "";
  state.writingLessonId = null;
  state.editingMakeupId = null;
  localStorage.removeItem(sharedStorageKey);
}

async function applySupabaseCoachSession(showFromLogin = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  await client.consumeOAuthRedirect?.();
  const session = await client.ensureSession?.() || client.getSession?.();
  if (!session?.access_token) return false;
  try {
    const { user, profile, coachRole } = await client.selectCurrentProfile();
    if (!profile || !canUseCoachAppProfile(profile, coachRole)) {
      state.coach = null;
      $("#coachAppScreen").hidden = true;
      $("#coachLoginScreen").hidden = false;
      setCoachAccessMessage("관리자 승인 후 코치앱을 사용할 수 있습니다. 회원앱은 계속 사용할 수 있습니다.", "alert");
      saveSnapshot();
      return true;
    }
    activateLiveCoachProfile(profile.id);
    const displayName = profile?.name || user?.user_metadata?.name || user?.email || state.selectedCoachName || approvedCoachesFromAdmin()[0]?.name || "코치";
    state.coach = {
      provider: session.provider || "Supabase",
      name: displayName,
      profilePhotoUrl: profile?.profile_photo_url || user?.user_metadata?.picture || user?.user_metadata?.avatar_url || "",
      authUserId: user?.id || "",
      coachRoleId: coachRole?.id || "",
      role: profile?.role || "coach",
      branchId: coachRole?.branch_id || "",
    };
    state.selectedCoachName = displayName;
    renderAll();
    openCoachApp(showFromLogin);
    saveSnapshot();
    void (async () => {
      if (await syncCoachSchedulePreview().catch(() => false)) {
        renderAll();
        saveSnapshot();
      }
      await syncLiveSchedulePolicy(state.coach.branchId);
      await Promise.allSettled([
        syncCoachLessonsFromServer(),
        syncCoachJournalEntriesFromServer(),
        syncCoachSettlementFromServer(),
        syncNativeCoachPushRegistration(profile),
      ]);
      renderAll();
      saveSnapshot();
    })();
    return true;
  } catch (error) {
    return false;
  }
}

async function logoutCoach() {
  await disableNativeCoachPushForLogout();
  await window.TennisNoteDataClient?.signOut?.();
  returnToMemberEntry(false, false);
}

async function authorizeCoachNotificationAction(data = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectCurrentProfile || !client.getSession?.()?.access_token) {
    showToast("로그인 후 알림 내용을 확인해 주세요.");
    return false;
  }
  try {
    const current = await client.selectCurrentProfile();
    if (
      !canUseCoachAppProfile(current?.profile, current?.coachRole)
      || String(current?.profile?.id || "") !== String(state.liveProfileId || "")
      || String(current?.coachRole?.id || "") !== currentCoachRoleId()
    ) {
      showToast("현재 코치 계정에서 확인할 수 없는 알림입니다.");
      return false;
    }

    const lessonId = String(data.lessonId || data.lesson_id || "").trim();
    const requestId = String(data.requestId || data.request_id || "").trim();
    if (lessonId || requestId) {
      const lessonsSynced = await syncCoachLessonsFromServer().catch(() => false);
      if (!lessonsSynced) {
        showToast("수업 정보를 새로 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (lessonId) {
        const lesson = (state.liveLessons || []).find((item) => (
          String(item.serverLessonId || item.id || "") === lessonId
        ));
        if (!lesson || !lessonAssignedToCurrentCoachForTasks(lesson)) {
          showToast("현재 코치에게 배정된 수업이 아닙니다.");
          return false;
        }
      }
      if (requestId) {
        const request = (state.makeupRequests || []).find((item) => (
          String(item.serverRequestId || item.id || "") === requestId
        ));
        const canOpenRequest = request && (
          current?.profile?.role === "admin"
          || String(request.coachRoleId || "") === currentCoachRoleId()
        );
        if (!canOpenRequest) {
          showToast("현재 코치에게 배정된 요청이 아닙니다.");
          return false;
        }
      }
    }
    return true;
  } catch {
    showToast("알림 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return false;
  }
}
