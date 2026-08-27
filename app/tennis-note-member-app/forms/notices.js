// notices 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function nativePushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function canShowNativePushPrimer() {
  const platform = nativeAppPlatform();
  return ["android", "ios"].includes(platform)
    && !$("#appScreen")?.hidden
    && Boolean(state.member?.profileId)
    && pushPreferenceEnabled()
    && state.pushNotifications?.permission === "prompt"
    && !pushPrimerWasRecentlyDeferred()
    && !activeAppModalId
    && !activeAppSheetId
    && $("#noticeDialog")?.hidden !== false
    && $("#kakaoInquiryModal")?.hidden !== false
    && $("#memberEnrollmentModal")?.hidden !== false;
}

function scheduleNativePushPrimer(delay = 1400) {
  if (pushPrimerTimer || pushPrimerWasRecentlyDeferred()) return;
  pushPrimerTimer = window.setTimeout(() => {
    pushPrimerTimer = null;
    if (canShowNativePushPrimer()) {
      pushPrimerAttempts = 0;
      openAppModal("pushPrimerModal", "#enablePushFromPrimer");
      return;
    }
    if (state.pushNotifications?.permission === "prompt" && pushPrimerAttempts < 4) {
      pushPrimerAttempts += 1;
      scheduleNativePushPrimer(3000);
    }
  }, delay);
}

async function bindNativePushListeners(plugin) {
  if (pushListenersReady) return;
  await plugin.addListener("registration", async (token) => {
    try {
      await registerPushToken(token?.value || "", nativeAppPlatform());
    } catch {
      setPushNotificationState("granted", "알림 연결 확인 필요", "앱 로그인과 서버 설정을 확인한 뒤 다시 연결해 주세요.");
    }
  });
  await plugin.addListener("registrationError", () => {
    setPushNotificationState("unknown", "알림 등록 실패", "휴대폰 알림 설정과 네트워크를 확인한 뒤 다시 시도해 주세요.");
  });
  await plugin.addListener("pushNotificationReceived", async () => {
    await syncMemberNotificationsFromServer().catch(() => false);
    showNoticeIfNeeded();
  });
  await plugin.addListener("pushNotificationActionPerformed", async (action) => {
    const data = nativeNotificationData(action);
    if (!(await authorizeMemberNotificationAction(data))) return;
    const route = memberNotificationRoute(data);
    const viewId = route === "membership"
      ? "shopView"
      : route === "schedule"
        ? "scheduleView"
        : ["feedback", "journal"].includes(route)
          ? "lessonLogView"
          : "homeView";
    await Promise.allSettled([
      syncMemberNotificationsFromServer(),
      ["schedule", "feedback", "journal"].includes(route) ? syncMemberLessonsFromServer() : Promise.resolve(false),
      route === "membership" ? syncMemberTicketsFromServer() : Promise.resolve(false),
      ["feedback", "journal"].includes(route) ? syncMemberJournalEntriesFromServer() : Promise.resolve(false),
    ]);
    renderAll();
    setView(viewId);
    openMemberNotificationTarget(data, route);
  });
  pushListenersReady = true;
}
