// coaches 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function dayCoachesForSchedule(day, policy, lessons = [], filter = state.scheduleFilter || "all") {
  const currentRoleId = currentCoachRoleId();
  const currentName = currentCoachName();
  const working = policy.coaches.filter((coach) => {
    if (!(coach.workBlocks || []).some((block) => block.days.includes(day))) return false;
    if (filter !== "mine") return true;
    const roleMatches = currentRoleId && String(coach.roleId || coach.id || "") === currentRoleId;
    return Boolean(roleMatches || canonicalCoachName(coach.name) === currentName);
  });
  const lessonCoaches = lessons
    .filter((lesson) => lesson.day === day)
    .map((lesson) => coachFromLesson(lesson, policy));
  const unique = working
    .concat(lessonCoaches)
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index);
  return window.TennisNoteScheduleLanes?.sortByLaneOrder?.(unique)
    || unique.sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.sortIndex)) ? Number(a.sortIndex) : coachOrder(a.id);
      const bOrder = Number.isFinite(Number(b.sortIndex)) ? Number(b.sortIndex) : coachOrder(b.id);
      return aOrder - bOrder;
    });
}

function setCoachAccessMessage(message, tone = "wait") {
  state.coachAccessMessage = message || "";
  state.coachAccessTone = tone;
  const target = $("#coachAccessMessage");
  if (!target) return;
  target.hidden = !state.coachAccessMessage;
  target.textContent = state.coachAccessMessage;
  target.dataset.tone = tone;
}

function nativeCoachAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function nativeCoachPushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function canShowNativeCoachPushPrimer() {
  return ["android", "ios"].includes(nativeCoachAppPlatform())
    && !$("#coachAppScreen")?.hidden
    && Boolean(state.liveProfileId)
    && coachPushPreferenceEnabled()
    && coachPushUiState.permission === "prompt"
    && !coachPushPrimerWasRecentlyDeferred()
    && !activeCoachModalId
    && $("#noticeDialog")?.hidden !== false;
}

function scheduleNativeCoachPushPrimer(delay = 1400) {
  if (coachPushPrimerTimer || coachPushPrimerWasRecentlyDeferred()) return;
  coachPushPrimerTimer = window.setTimeout(() => {
    coachPushPrimerTimer = 0;
    if (canShowNativeCoachPushPrimer()) {
      coachPushPrimerAttempts = 0;
      openCoachModal("coachPushPrimerModal");
      return;
    }
    if (coachPushUiState.permission === "prompt" && coachPushPrimerAttempts < 4) {
      coachPushPrimerAttempts += 1;
      scheduleNativeCoachPushPrimer(3000);
    }
  }, delay);
}

async function bindNativeCoachPushListeners(plugin, context) {
  if (!context?.isCurrent?.()) return false;
  const epoch = ++coachPushListenerEpoch;
  // Invalidate synchronously, including callbacks already queued by the plugin.
  if (coachPushListenerBinding) coachPushListenerBinding.active = false;
  coachPushListenersReady = false;
  const installCurrent = () => context.isCurrent() && epoch === coachPushListenerEpoch
    && plugin === nativeCoachPushPlugin();
  const removeHandles = async (handles) => {
    for (const handle of handles) {
      // A failed native remove may leave a physical callback; its binding remains inert.
      try { await handle?.remove?.(); } catch { /* epoch/owner guard still fails closed */ }
    }
  };
  const install = coachPushListenerInstall.catch(() => false).then(async () => {
    const previous = coachPushListenerBinding;
    coachPushListenerBinding = null;
    coachPushRegistrationListeners = [];
    coachPushNotificationPlugin = null;
    if (previous) {
      previous.active = false;
      await removeHandles(previous.handles);
    }
    if (!installCurrent()) return false;
    const binding = { plugin, epoch, active: false, handles: [] };
    const bindingCurrent = () => binding.active && coachPushListenerBinding === binding
      && installCurrent();
    let published = false;
    try {
      for (const [name, listener] of [
        ["registration", async (token) => {
          if (!bindingCurrent()) return;
          await registerCoachPushToken(token?.value || "", context.platform, context).catch(() => false);
        }],
        ["registrationError", () => {
          if (!bindingCurrent() || coachPushPendingRegistration !== context) return;
          coachPushPendingRegistration = null;
          showToast("앱 알림 연결을 확인해 주세요.");
        }],
        ["pushNotificationReceived", async () => {
          if (!bindingCurrent()) return;
          const owner = captureCoachAsyncOwner();
          const current = () => bindingCurrent() && owner.isCurrent();
          if (current()) await syncLiveNotices(current).catch(() => false);
        }],
        ["pushNotificationActionPerformed", async (action) => {
          if (!bindingCurrent()) return;
          const owner = captureCoachAsyncOwner();
          const current = () => bindingCurrent() && owner.isCurrent();
          const data = coachNotificationData(action);
          if (!(await authorizeCoachNotificationAction(data, current)) || !current()) return;
          const route = coachNotificationRoute(data);
          const viewId = route === "schedule"
            ? "fullScheduleView"
            : ["member", "membership"].includes(route)
              ? "membersView"
              : "todayView";
          await Promise.allSettled([
            syncLiveNotices(current),
            ["today", "dashboard", "schedule", "feedback"].includes(route)
              ? syncCoachLessonsFromServer(current)
              : Promise.resolve(false),
            route === "feedback" ? syncCoachJournalEntriesFromServer(current) : Promise.resolve(false),
          ]);
          if (!current()) return;
          renderAll();
          setView(viewId);
          openCoachNotificationTarget(data, route);
        }],
      ]) {
        const handle = await plugin.addListener(name, listener);
        binding.handles.push(handle);
        if (!installCurrent()) return false;
      }
      coachPushListenerBinding = binding;
      binding.active = true;
      coachPushRegistrationListeners = binding.handles;
      coachPushNotificationPlugin = plugin;
      coachPushListenersReady = true;
      published = true;
      return true;
    } catch {
      return false;
    } finally {
      if (!published) {
        binding.active = false;
        await removeHandles(binding.handles);
      }
    }
  });
  // One queue owns all plugin installs/removals, even when plugin or owner changes.
  coachPushListenerInstall = install;
  return install;
}

function blurActiveCoachFormControl() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches("input, textarea, select")) return false;
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const keyboardVisible = Boolean(viewport && layoutHeight - viewport.height - viewport.offsetTop > 96);
  active.blur();
  return keyboardVisible;
}

async function installNativeCoachBackNavigation() {
  if (nativeCoachBackListenerReady || nativeCoachAppPlatform() !== "android") return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  nativeCoachBackListenerReady = true;
  await appPlugin.addListener("backButton", async () => {
    if (pendingCoachModalHistoryCloseId) return;
    if (blurActiveCoachFormControl()) return;
    if (!$("#noticeDialog")?.hidden) {
      closeNotice(false);
      return;
    }
    if (activeCoachModalId) {
      if (activeCoachModalId === "coachSettlementModal") {
        resetCoachSettlementHistory();
        renderCoachSettlementHistory();
      }
      if (activeCoachModalId === "lessonEditModal") requestCloseLessonEditor();
      else closeCoachModal(activeCoachModalId);
      return;
    }
    const activeView = $(".view.is-active")?.id || "todayView";
    if (!$("#coachAppScreen")?.hidden && activeView !== "todayView") {
      setView("todayView", { replaceHistory: true });
      return;
    }
    if (!$("#coachAppScreen")?.hidden) {
      openUserMode();
      return;
    }
    const minimized = await appPlugin.minimizeApp?.().then(() => true).catch(() => false);
    if (!minimized) await appPlugin.exitApp?.().catch(() => undefined);
  });
}

function mergeCoachScheduleWindows(windows) {
  return windows
    .map((window) => ({ ...window, startMinutes: minutesFromTime(window.start), endMinutes: minutesFromTime(window.end) }))
    .filter((window) => window.startMinutes < window.endMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .reduce((merged, window) => {
      const previous = merged[merged.length - 1];
      if (!previous || window.startMinutes > previous.endMinutes) merged.push({ ...window });
      else {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = `${String(Math.floor(previous.endMinutes / 60)).padStart(2, "0")}:${String(previous.endMinutes % 60).padStart(2, "0")}`;
      }
      return merged;
    }, []);
}

function selectCoachMode(name) {
  if (!state.coach) return;
  state.selectedCoachName = name;
  if (state.coach) {
    state.coach.name = name;
    $("#coachName").textContent = name;
  }
  renderCoachModeList();
  renderCoachProfile();
  saveSnapshot();
  setCoachProfileEditOpen(false);
  showToast("이 기기에 코치 프로필을 저장했습니다.");
}

function installCoachConnectivitySync() {
  window.addEventListener("online", () => {
    showToast("인터넷 연결 복구 · 저장 대기 기록을 확인합니다.");
    renderCoachConnectivityStatus();
    void flushCoachOfflineLessonDrafts();
    void refreshCoachLiveSchedule().catch(() => false);
  });
  window.addEventListener("offline", () => {
    coachSyncUiState = "idle";
    renderCoachConnectivityStatus();
    showToast("오프라인에서는 최근 자료만 볼 수 있습니다. 수업 완료는 연결 후 진행해 주세요.");
  });
}

function installCoachLiveScheduleRefresh() {
  if (coachLiveScheduleRefreshTimer) return;
  const refresh = () => refreshCoachLiveSchedule().catch(() => false);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  coachLiveScheduleRefreshTimer = window.setInterval(refresh, COACH_LIVE_REFRESH_INTERVAL_MS);
}

function installCoachScheduleRevisionWatcher() {
  if (coachScheduleRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  coachScheduleRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: () => state.coach?.branchId || "",
    active: () => !document.hidden && !$("#appScreen")?.hidden && Boolean(state.coach),
    onChange: async () => {
      coachScheduleV2WorkspaceCache = null;
      coachLiveScheduleLastRefreshAt = 0;
      await refreshCoachLiveSchedule({ force: true, render: true });
    },
  });
}
