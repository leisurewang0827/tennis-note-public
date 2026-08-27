// 공지 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function liveNoticeClient() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token) return null;
  return client;
}

function liveNoticeReadClient() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return null;
  return client;
}

async function savePopupNoticeToServer(notice) {
  const client = liveNoticeClient();
  if (!client?.insertRows || !client?.updateRows) return "local";
  const payload = appNoticeToDbRow(notice);
  try {
    if (client.rpc) {
      try {
        const result = await client.rpc("tn_admin_save_notice_popup_v2", {
          target_notice_id: isUuid(notice.id) ? notice.id : null,
          target_title: payload.title,
          target_body: payload.body,
          target_audience: payload.audience,
          target_priority: payload.priority,
          target_status: payload.status,
          target_starts_on: payload.starts_on,
          target_ends_on: payload.ends_on,
          target_show_once_per_day: payload.show_once_per_day,
          target_display_order: payload.display_order,
          target_image_url: payload.image_url,
          target_image_storage_path: payload.image_storage_path,
          target_image_alt: payload.image_alt,
          target_action_label: payload.action_label,
          target_action_url: payload.action_url,
        });
        const savedRow = Array.isArray(result) ? result[0] : result;
        if (savedRow?.id) {
          writePopupNotice(noticeRowToAppNotice(savedRow));
          return "server";
        }
      } catch (rpcError) {
        const message = String(rpcError?.message || rpcError || "");
        if (!message.includes("tn_admin_save_notice_popup_v2") && !message.includes("PGRST202")) return "blocked";
      }
    }
    let rows = [];
    if (isUuid(notice.id)) {
      rows = await client.updateRows("tn_notice_popups", { id: notice.id }, payload);
    }
    if (!rows?.length) {
      rows = await client.insertRows("tn_notice_popups", payload);
    }
    if (rows?.[0]) writePopupNotice(noticeRowToAppNotice(rows[0]));
    return "server";
  } catch (error) {
    return "blocked";
  }
}

function applyNotificationOverview(payload = {}, source = "server") {
  Object.assign(notificationDeliveryState, normalizeNotificationOverview(payload, source));
  renderNotificationPolicySettings();
  renderDashboardNoticeSummary();
}

async function saveNotificationPolicySettings() {
  const policy = readNotificationPolicyForm();
  Object.assign(notificationPolicySettings, policy);
  saveSnapshot();
  const client = liveNoticeClient();
  let result = "local";

  if (client?.rpc) {
    try {
      const saved = await client.rpc("tn_admin_save_notification_policy", { target_policy: policy });
      Object.assign(notificationPolicySettings, normalizeNotificationPolicy(Array.isArray(saved) ? saved[0] || policy : saved || policy));
      result = "server";
    } catch (rpcError) {
      const message = String(rpcError?.message || rpcError || "");
      if (!message.includes("tn_admin_save_notification_policy") && !message.includes("PGRST202")) result = "blocked";
    }
  }

  if (result === "local" && client?.insertRows && client?.updateRows) {
    try {
      const updated = await client.updateRows("tn_admin_settings", { key: notificationPolicyKey }, {
        value: policy,
        updated_at: new Date().toISOString(),
      });
      if (!updated?.length) await client.insertRows("tn_admin_settings", { key: notificationPolicyKey, value: policy });
      result = "server";
    } catch {
      result = "blocked";
    }
  }

  if (result === "blocked") {
    Object.assign(notificationDeliveryState, {
      status: "blocked",
      message: "알림 설정 서버 미반영",
      checkedAt: new Date().toISOString(),
    });
  } else if (result === "local") {
    Object.assign(notificationDeliveryState, {
      status: "offline",
      message: "로컬 설정 · 관리자 로그인 필요",
      checkedAt: new Date().toISOString(),
    });
  }

  saveSnapshot();
  renderNotificationPolicySettings();
  renderDashboardNoticeSummary();
  if (result === "server") {
    showToast("자동 알림 설정을 서버에 저장했습니다");
    await loadNotificationDeliveryStatus();
    return;
  }
  showToast(result === "blocked" ? "로컬 저장 완료 · 서버 알림 패치 확인 필요" : "자동 알림 설정 저장 완료");
}

function resetNoticeImageDraft() {
  if (noticeImageDraftUrl) URL.revokeObjectURL(noticeImageDraftUrl);
  noticeImageDraftFile = null;
  noticeImageDraftUrl = "";
  noticeImageRemoveRequested = false;
}

async function deleteNoticeStorageObject(objectPath = "") {
  const client = liveNoticeClient();
  if (!objectPath || !client?.deleteObject) return false;
  try {
    await client.deleteObject(noticeMediaBucket, objectPath);
    return true;
  } catch {
    return false;
  }
}

async function saveNoticePopupSettings(statusOverride = "") {
  const rawTitle = $("#noticeTitleInput")?.value.trim() || "";
  const rawBody = $("#noticeBodyInput")?.value.trim() || "";
  const startDate = $("#noticeStartDateInput")?.value || "";
  const endDate = $("#noticeEndDateInput")?.value || "";
  if (rawTitle.length < 2) {
    showToast("공지 제목을 2자 이상 입력해주세요");
    $("#noticeTitleInput")?.focus();
    return;
  }
  if (rawBody.length < 5) {
    showToast("공지 내용을 5자 이상 입력해주세요");
    $("#noticeBodyInput")?.focus();
    return;
  }
  if (startDate && endDate && endDate < startDate) {
    showToast("공지 종료일은 시작일보다 빠를 수 없습니다");
    return;
  }
  const actionUrl = $("#noticeActionUrlInput")?.value.trim() || "";
  if (actionUrl) {
    try {
      const parsed = new URL(actionUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol");
    } catch {
      showToast("버튼 연결 주소는 http:// 또는 https:// 주소로 입력해주세요");
      $("#noticeActionUrlInput")?.focus();
      return;
    }
  }
  const previousNotice = editingPopupNotice();
  let draftNotice = readNoticePopupForm(statusOverride);
  let uploadedPath = "";
  try {
    const uploadResult = await uploadNoticeDraftImage(draftNotice);
    draftNotice = uploadResult.notice;
    uploadedPath = uploadResult.uploadedPath;
  } catch (error) {
    showToast(error?.message || "공지 이미지를 업로드하지 못했습니다");
    return;
  }
  const liveResult = await savePopupNoticeToServer(draftNotice);
  if (liveResult === "blocked") {
    if (uploadedPath) await deleteNoticeStorageObject(uploadedPath);
    renderNoticePopupSettings();
    renderDashboardNoticeSummary();
    showToast("공지 서버 반영 실패 · 관리자 권한과 SQL 적용을 확인해주세요");
    return;
  }
  const notice = liveResult === "server" ? editingPopupNotice() : writePopupNotice(draftNotice);
  if (liveResult === "server" && previousNotice.imageStoragePath && previousNotice.imageStoragePath !== notice.imageStoragePath) {
    await deleteNoticeStorageObject(previousNotice.imageStoragePath);
  }
  resetNoticeImageDraft();
  resetNoticeDismissals();
  billingLogs.unshift(`공지사항 팝업 ${notice.status === "active" ? "반영" : "끄기"} · ${notice.title}`);
  renderNoticePopupSettings();
  renderDashboardNoticeSummary();
  if (liveResult === "server") {
    showToast(notice.status === "active" ? "공지사항 팝업 DB 반영 완료" : "공지사항 팝업 DB 끄기 완료");
    return;
  }
  showToast(notice.status === "active" ? "공지사항 팝업 반영 완료" : "공지사항 팝업 끄기 완료");
}

function startNewPopupNotice() {
  resetNoticeImageDraft();
  const newNotice = normalizePopupNotice({
    ...defaultPopupNotice,
    id: `notice-new-${Date.now()}`,
    title: "",
    body: "",
    status: "active",
    displayOrder: (popupNotices().length + 1) * 10,
    updatedAt: "",
  });
  state.noticeEditingId = newNotice.id;
  state.noticeDraft = newNotice;
  renderNoticePopupSettings();
  $("#noticeTitleInput")?.focus();
  showToast("새 공지를 작성할 수 있습니다");
}

async function movePopupNotice(noticeId = "", direction = "down") {
  const notices = popupNotices();
  const fromIndex = notices.findIndex((notice) => notice.id === noticeId);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= notices.length) return;
  [notices[fromIndex], notices[toIndex]] = [notices[toIndex], notices[fromIndex]];
  const reordered = notices.map((notice, index) => normalizePopupNotice({ ...notice, displayOrder: (index + 1) * 10 }));
  const client = liveNoticeClient();
  if (client?.rpc && reordered.every((notice) => isUuid(notice.id))) {
    try {
      await client.rpc("tn_admin_reorder_notice_popups", { target_notice_ids: reordered.map((notice) => notice.id) });
    } catch {
      showToast("공지 순서를 저장하지 못했습니다");
      await syncPopupNoticeFromServer();
      return;
    }
  }
  const shared = loadSharedData();
  shared.notices = reordered;
  saveSharedData(shared);
  renderNoticePopupSettings();
  resetNoticeDismissals();
  showToast("공지 표시 순서를 변경했습니다");
}

async function deletePopupNotice(noticeId = "") {
  const notice = popupNotices().find((item) => item.id === noticeId);
  if (!notice) return;
  if (!window.confirm(`\"${notice.title || "새 공지"}\" 공지를 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
  const client = liveNoticeClient();
  if (isUuid(notice.id) && client?.rpc) {
    try {
      await client.rpc("tn_admin_delete_notice_popup", { target_notice_id: notice.id });
    } catch {
      showToast("공지 삭제 실패 · 관리자 권한을 확인해주세요");
      return;
    }
  } else if (isUuid(notice.id) && client) {
    showToast("공지 삭제 기능 SQL 적용이 필요합니다");
    return;
  }
  if (notice.imageStoragePath && isUuid(notice.id)) await deleteNoticeStorageObject(notice.imageStoragePath);
  const shared = loadSharedData();
  shared.notices = (shared.notices || []).filter((item) => item.id !== notice.id);
  saveSharedData(shared);
  resetNoticeImageDraft();
  state.noticeDraft = null;
  state.noticeEditingId = popupNotices()[0]?.id || "";
  renderNoticePopupSettings();
  renderDashboardNoticeSummary();
  resetNoticeDismissals();
  showToast("공지를 삭제했습니다");
}
