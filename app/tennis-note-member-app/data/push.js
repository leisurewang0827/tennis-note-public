// 푸시 알림 등록과 입금 알림 브리지를 다루는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function connectBankNotificationBridge() {
  if (!bankNotificationAdminAllowed()) return;
  const client = window.TennisNoteDataClient;
  const plugin = nativeBankNotificationBridgePlugin();
  if (!client?.invokeFunction || !client.getSession?.()?.access_token || !plugin?.getStatus) {
    showToast("관리자 로그인과 Android 앱 연결을 확인해 주세요.");
    return;
  }
  const currentStatus = await plugin.getStatus().catch(() => ({}));
  const repairRequired = currentStatus.repairRequired === true
    || currentStatus.remoteDisabled === true
    || String(currentStatus.lastError || "").includes("repair_required")
    || String(currentStatus.lastError || "").includes("feature_disabled")
    || String(currentStatus.lastError || "").includes("device_unauthorized");
  if (currentStatus.configured === true && currentStatus.permissionGranted !== true && !repairRequired) {
    await plugin.openNotificationAccessSettings?.();
    await refreshBankNotificationBridge();
    return;
  }
  if (currentStatus.configured === true && currentStatus.permissionGranted === true && !repairRequired) {
    await plugin.flush?.();
    await refreshBankNotificationBridge();
    showToast("입금 알림 연결 상태를 확인했습니다.");
    return;
  }
  const branchId = String(currentLiveTicket()?.branchId || "");
  try {
    const paired = await client.invokeFunction("portone-payment/bank-notification-pair", {
      body: {
        ...(branchId ? { branchId } : {}),
        devicePublicId: bankNotificationDevicePublicId(),
        deviceName: `관리자 Android ${memberNativeAppInfo?.version || ""}`.trim(),
      },
    });
    await plugin.configure({
      branchId: paired.branchId,
      deviceToken: paired.deviceToken,
      ingestUrl: paired.ingestUrl,
      heartbeatUrl: paired.heartbeatUrl,
      allowedPackages: paired.allowedPackages || [],
      accountRevision: Number(paired.accountRevision || 1),
    });
    await plugin.flush?.();
    bankNotificationBridgeState = await plugin.getStatus();
    renderBankNotificationBridge();
    if (bankNotificationBridgeState.permissionGranted !== true) {
      await plugin.openNotificationAccessSettings?.();
      showToast("알림 접근에서 Tennis Note를 허용한 뒤 앱으로 돌아와 주세요.");
    } else showToast("이 기기의 입금 알림을 연결했습니다.");
  } catch (error) {
    const code = error?.payload?.code || error?.message || "pair_failed";
    const messages = {
      bank_notification_feature_disabled: "관리자 웹에서 Android 입금 알림 확인을 먼저 켜 주세요.",
      bank_transfer_account_not_ready: "관리자 웹에서 사용할 입금 계좌를 먼저 저장해 주세요.",
      bank_notification_bank_not_supported: "현재 우리은행과 카카오뱅크 알림만 연결할 수 있습니다.",
    };
    showToast(messages[code] || `입금 알림 연결 실패: ${code}`);
    await refreshBankNotificationBridge();
  }
}

async function registerPushToken(tokenValue, platform = nativeAppPlatform()) {
  const client = window.TennisNoteDataClient;
  if (accountDeletionBlocksNotifications(state.accountDeletionRequest?.status)) return false;
  if (!["android", "ios"].includes(platform)) return false;
  if (!tokenValue || !pushProfileId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  await client.rpc("tn_register_push_device", {
    target_platform: platform,
    target_device_id: currentPushDeviceId(),
    target_push_token: tokenValue,
  });
  setPushPreferenceEnabled(true);
  setPushNotificationState("granted", "앱 알림 켜짐", "수업 하루 전·30분 전과 회원권 안내를 잠금화면으로 알려드립니다.");
  return true;
}

async function authorizeMemberNotificationAction(data = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.selectCurrentProfile || !client?.selectRows || !client.getSession?.()?.access_token) {
    showToast("로그인 후 알림 내용을 확인해 주세요.");
    return false;
  }

  try {
    const current = await client.selectCurrentProfile();
    const currentProfileId = String(current?.profile?.id || "");
    if (!currentProfileId || currentProfileId !== String(state.member?.profileId || "")) {
      const restored = await applySupabaseMemberSession(false);
      if (!restored || currentProfileId !== String(state.member?.profileId || "")) {
        showToast("회원 연결을 다시 확인한 뒤 알림을 열어 주세요.");
        return false;
      }
    }

    const lessonId = String(data.lessonId || data.lesson_id || "").trim();
    if (lessonId) {
      const [legacyParticipants, participantRecords] = await Promise.all([
        client.selectRows("tn_lesson_participants", {
          select: "lesson_id,user_id,ticket_id",
          filters: { lesson_id: lessonId, user_id: currentProfileId },
          limit: 1,
        }).catch(() => []),
        client.selectRows("tn_lesson_participant_records_v2", {
          select: "id,lesson_id,user_id,member_ticket_id",
          filters: { lesson_id: lessonId, user_id: currentProfileId },
          limit: 1,
        }).catch(() => []),
      ]);
      if (!legacyParticipants?.length && !participantRecords?.length) {
        showToast("현재 계정에서 확인할 수 없는 수업입니다.");
        return false;
      }
    }

    const participantRecordId = String(
      data.participantRecordId || data.participant_record_id || data.lessonRecordId || data.lesson_record_id || "",
    ).trim();
    if (participantRecordId) {
      const records = await client.selectRows("tn_lesson_participant_records_v2", {
        select: "id,user_id,lesson_id",
        filters: { id: participantRecordId, user_id: currentProfileId },
        limit: 1,
      }).catch(() => []);
      if (!records?.length) {
        showToast("현재 계정에서 확인할 수 없는 피드백입니다.");
        return false;
      }
    }

    const ticketId = String(data.ticketId || data.ticket_id || "").trim();
    if (ticketId) {
      const ticketsSynced = await syncMemberTicketsFromServer(current.profile).catch(() => false);
      if (!ticketsSynced) {
        showToast("회원권 정보를 새로 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (!(state.liveTickets || []).some((ticket) => String(ticket.id || "") === ticketId)) {
        showToast("현재 계정에서 확인할 수 없는 회원권입니다.");
        return false;
      }
    }
    return true;
  } catch {
    showToast("알림 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return false;
  }
}

async function syncNativePushRegistration(profile = null, requestPermission = false) {
  const plugin = nativePushPlugin();
  const platform = nativeAppPlatform();
  const profileId = profile?.id || state.member?.profileId || "";
  pushProfileId = profileId;

  if (accountDeletionBlocksNotifications(state.accountDeletionRequest?.status)) {
    // The deletion-request RPC already disabled every currently enabled
    // device. Do not touch updated_at here because cancellation uses that
    // request-time marker to restore only devices disabled by the request.
    pushProfileId = "";
    setPushNotificationState("disabled", "탈퇴 요청으로 알림 중지", "계정 삭제 요청을 처리하는 동안 새 기기 알림을 등록하지 않습니다.");
    return false;
  }

  if (!["android", "ios"].includes(platform) || !plugin) {
    setPushNotificationState(
      "unavailable",
      "설치 앱에서 사용 가능",
      "휴대폰에 설치한 Tennis Note 앱에서 수업·회원권 알림을 켤 수 있습니다.",
    );
    return false;
  }
  if (!profileId || !window.TennisNoteDataClient?.getSession?.()?.access_token) {
    setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
    return false;
  }
  if (!pushPreferenceEnabled()) {
    setPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
    return false;
  }

  await bindNativePushListeners(plugin);
  if (platform === "android") {
    await plugin.createChannel({
      id: "lesson-reminders",
      name: "수업·회원권 알림",
      description: "수업 일정과 회원권 만료 알림",
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }

  let permission = await plugin.checkPermissions();
  if (requestPermission && ["prompt", "prompt-with-rationale"].includes(permission.receive)) {
    permission = await plugin.requestPermissions();
  }
  if (permission.receive === "denied") {
    setPushNotificationState("denied", "휴대폰 알림이 꺼져 있음", "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.");
    return false;
  }
  if (permission.receive !== "granted") {
    setPushNotificationState("prompt", "알림 허용 필요", "알림 허용을 누르면 하루 전과 30분 전에 알려드립니다.");
    return false;
  }

  setPushNotificationState("granted", "앱 알림 연결 중", "기기 알림 토큰을 안전하게 등록하고 있습니다.");
  await plugin.register();
  return true;
}

async function disableNativePushForLogout() {
  const client = window.TennisNoteDataClient;
  if (client?.getSession?.()?.access_token && client?.rpc) {
    await client.rpc("tn_disable_push_device", {
      target_device_id: currentPushDeviceId(),
    }).catch(() => null);
  }
  // The server-side device record above is the authoritative push opt-out.
  // Calling the Android plugin's unregister method without an initialized
  // Firebase app terminates the whole native process instead of rejecting.
  // Keep the native registration intact and let the next signed-in session
  // refresh it after Firebase is available.
  pushProfileId = "";
  setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
}

async function disableNativePushForMember() {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    setPushNotificationState("unknown", "알림 끄기 실패", "로그인과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    return false;
  }
  await client.rpc("tn_disable_push_device", {
    target_device_id: currentPushDeviceId(),
  });
  setPushPreferenceEnabled(false);
  setPushNotificationState("disabled", "앱 알림 꺼짐", "이 기기에서는 알림을 보내지 않습니다. 알림 켜기를 누르면 다시 받을 수 있습니다.");
  return true;
}
