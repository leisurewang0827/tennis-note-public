// 푸시 알림 등록을 다루는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function registerCoachPushToken(tokenValue, platform = nativeCoachAppPlatform()) {
  const client = window.TennisNoteDataClient;
  if (!tokenValue || !coachPushProfileId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  await client.rpc("tn_register_push_device", {
    target_platform: platform,
    target_device_id: currentCoachPushDeviceId(),
    target_push_token: tokenValue,
  });
  return true;
}

async function syncNativeCoachPushRegistration(profile = null, requestPermission = false) {
  const plugin = nativeCoachPushPlugin();
  const platform = nativeCoachAppPlatform();
  coachPushProfileId = profile?.id || state.liveProfileId || "";
  if (!plugin || !["android", "ios"].includes(platform)) {
    setCoachPushNotificationState("unavailable", "설치 앱에서 사용 가능", "휴대폰에 설치한 Tennis Note 앱에서 수업 알림을 켤 수 있습니다.");
    return false;
  }
  if (!coachPushProfileId || !window.TennisNoteDataClient?.getSession?.()?.access_token) {
    setCoachPushNotificationState("unknown", "로그인 후 알림 설정", "코치 로그인 후 기기 알림을 연결할 수 있습니다.");
    return false;
  }
  if (!coachPushPreferenceEnabled()) {
    setCoachPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
    return false;
  }
  await bindNativeCoachPushListeners(plugin);
  if (platform === "android") {
    await plugin.createChannel?.({
      id: "lesson-reminders",
      name: "수업·회원권 알림",
      description: "수업 일정과 처리할 기록 알림",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  let permission = await plugin.checkPermissions?.().catch(() => null);
  if (requestPermission && ["prompt", "prompt-with-rationale"].includes(permission?.receive)) {
    permission = await plugin.requestPermissions?.().catch(() => permission);
  }
  if (permission?.receive === "denied") {
    setCoachPushNotificationState("denied", "휴대폰 알림이 꺼져 있음", "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.");
    return false;
  }
  if (permission?.receive !== "granted") {
    setCoachPushNotificationState("prompt", "알림 허용 필요", "알림 켜기를 누르면 다음 수업과 미처리 기록을 알려드립니다.");
    scheduleNativeCoachPushPrimer();
    return false;
  }
  setCoachPushNotificationState("granted", "앱 알림 연결됨", "내 수업 변경과 처리할 기록을 이 기기로 알려드립니다.");
  await plugin.register();
  return true;
}

async function disableNativeCoachPush() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    setCoachPushNotificationState("unknown", "알림 끄기 실패", "로그인과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    return false;
  }
  await client.rpc("tn_disable_push_device", {
    target_device_id: currentCoachPushDeviceId(),
  });
  setCoachPushPreferenceEnabled(false);
  setCoachPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
  return true;
}

async function disableNativeCoachPushForLogout() {
  const client = window.TennisNoteDataClient;
  if (client?.getSession?.()?.access_token && client?.rpc) {
    await client.rpc("tn_disable_push_device", {
      target_device_id: currentCoachPushDeviceId(),
    }).catch(() => null);
  }
  coachPushProfileId = "";
  setCoachPushNotificationState("unknown", "로그인 후 알림 설정", "코치 로그인 후 기기 알림을 연결할 수 있습니다.");
}
