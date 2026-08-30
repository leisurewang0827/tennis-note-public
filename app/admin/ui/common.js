// 공통 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function hideAdminBrandSplash() {
  const splash = document.querySelector("#adminBrandSplash");
  if (!splash || splash.hidden || adminBrandSplashHideScheduled) return;
  adminBrandSplashHideScheduled = true;
  const elapsed = performance.now() - adminBrandSplashStartedAt;
  const delay = Math.max(0, adminBrandSplashMinimumDuration - elapsed);
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
    }, 240);
  }, delay);
}

function closeAdminLockModal() {
  $("#adminLockModal")?.setAttribute("hidden", "");
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = null;
  const form = $("#adminLockForm");
  if (form) form.reset();
}

function showToast(message) {
  let toast = $("#actionToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "actionToast";
    toast.className = "action-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  updateAdminSaveState(message);
}

function openAdminToolsModal(tool, options = {}) {
  const config = adminToolConfig[tool];
  if (!config) return;
  if (!options.skipLock && !requestAdminUnlock(config.lockView, () => openAdminToolsModal(tool, { skipLock: true }))) return;
  const modal = $("#adminToolsModal");
  if (!modal) return;
  $("#adminToolsModalTitle").textContent = config.title;
  $$('[data-admin-tool-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.adminToolPanel !== tool;
  });
  modal.removeAttribute("hidden");
  setTimeout(() => modal.querySelector("input, select, button:not(#closeAdminToolsModal)")?.focus(), 0);
  void ensureAdminToolData(tool);
}

function closeAdminToolsModal() {
  $("#adminToolsModal")?.setAttribute("hidden", "");
}

function toggleAdminMenu(force) {
  const open = typeof force === "boolean"
    ? force
    : !document.body.classList.contains("admin-menu-open");
  document.body.classList.toggle("admin-menu-open", open);
  $("#adminMenuButton")?.setAttribute("aria-expanded", String(open));
  const backdrop = $("#adminMenuBackdrop");
  if (backdrop) backdrop.hidden = !open;
}

function closeAdminMenu() {
  toggleAdminMenu(false);
}

function openSubstituteModal(defaultLesson = null) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 대타 코치를 지정할 수 있습니다.");
    return;
  }
  const date = defaultLesson?.lessonDate || adminLocalDateKey(new Date());
  state.substituteOperationKey = createAdminOperationKey("substitute-assign");
  $("#substituteDate").value = date;
  state.selectedSubstituteLessonIds = defaultLesson?.serverLessonId ? [String(defaultLesson.serverLessonId)] : [];
  const activeCoaches = operationBranchCoaches().filter((coach) => coach.status === "active" && coach.serverRoleId);
  $("#substituteCoach").innerHTML = `<option value="">코치 선택</option>${activeCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}">${escapeHtml(coach.name)}</option>`).join("")}`;
  $("#substituteSettlementMode").value = "actual_coach";
  $("#substituteHourlyAmount").value = "";
  $("#substituteReason").value = "";
  $("#substituteFormMessage").textContent = "";
  syncSubstituteSettlementFields();
  renderSubstituteLessonList();
  $("#substituteModal").hidden = false;
}

function closeSubstituteModal() {
  if ($("#substituteModal")) $("#substituteModal").hidden = true;
  state.selectedSubstituteLessonIds = [];
  state.substituteOperationKey = "";
}

function openOneDayBookingModal(defaults = {}) {
  if (!$("#lessonModal")?.hidden) closeLessonModal({ fromHistory: true, clearHistory: true });
  const editingBooking = defaults.bookingId ? oneDayBookingForId(defaults.bookingId) : null;
  state.editingOneDayBookingId = editingBooking?.serverOneDayBookingId || null;
  fillSelect(
    $("#oneDayCoach"),
    coaches
      .filter((coach) => coach.status === "active" && coach.serverRoleId)
      .map((coach) => ({ value: coach.id, label: `${coach.name} · ${coach.role}` })),
  );
  fillSelect($("#oneDayTime"), getScheduleTimeOptions().map((time) => ({ value: time, label: time })));
  $("#oneDayGuestName").value = editingBooking?.member || defaults.guestName || "";
  $("#oneDayGuestPhone").value = editingBooking?.guestPhone || "";
  $("#oneDayDate").value = editingBooking?.lessonDate || oneDayDateForDefaults(defaults);
  $("#oneDayTime").value = editingBooking?.time || defaults.time || getScheduleTimeOptions()[0] || "";
  $("#oneDayDuration").value = String(editingBooking?.durationMinutes || defaults.durationMinutes || 20);
  $("#oneDayStatus").value = editingBooking?.serverStatus || "reserved";
  $("#oneDayNote").value = editingBooking?.oneDayNote || "";
  if (editingBooking?.coachId || defaults.coachId) $("#oneDayCoach").value = editingBooking?.coachId || defaults.coachId;
  $("#oneDayBookingModalTitle").textContent = editingBooking ? "원데이 예약 수정" : "원데이 예약";
  $("#saveOneDayBookingButton").textContent = editingBooking ? "원데이 예약 저장" : "원데이 예약 저장";
  $("#deleteOneDayBookingButton").hidden = !editingBooking;
  $("#oneDayBookingModal").hidden = false;
  renderOneDayBookingPreview();
  $("#oneDayGuestName").focus();
}

function closeOneDayBookingModal() {
  $("#oneDayBookingModal").hidden = true;
  state.editingOneDayBookingId = null;
  setOneDayBookingMessage("");
}

async function openJournalMedia(journalId) {
  const files = (adminLiveDataState.mediaFiles || []).filter((media) => media.journal_entry_id === journalId);
  if (!files.length) {
    showToast("첨부된 사진이나 영상이 없습니다.");
    return;
  }
  const preview = window.open("", "_blank");
  try {
    const blob = await window.TennisNoteDataClient.downloadObject("tennisnote-journal-media", files[0].storage_path);
    const url = URL.createObjectURL(blob);
    if (preview) preview.location.href = url;
    else window.open(url, "_blank");
    if (files.length > 1) showToast(`첫 첨부를 열었습니다. 전체 ${files.length}개입니다.`);
  } catch {
    preview?.close();
    showToast("첨부파일을 불러오지 못했습니다.");
  }
}

function openCoachStaffModal(coachId = "") {
  if (operationsRole() !== "admin") {
    showToast("관리자만 코치·직원 정보를 수정할 수 있습니다.");
    return;
  }
  const coach = operationBranchCoaches().find((item) => item.id === coachId) || null;
  coachStaffEditorState.coachId = coach?.id || "";
  coachStaffEditorState.mode = coach ? "edit" : "create";
  coachStaffEditorState.tab = "basic";
  coachStaffEditorState.draft = coachStaffDraftFrom(coach);
  coachStaffEditorState.settlementBaseline = { ...coachStaffEditorState.draft.settlement };
  coachStaffEditorState.settlementDetailsOpen = false;
  coachStaffEditorState.saving = false;
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "";
  renderCoachStaffModal();
  window.TennisNoteInputGuard?.markSaved?.("#coachStaffModal");
}

function closeCoachStaffModal() {
  const modal = $("#coachStaffModal");
  if (modal) modal.hidden = true;
  coachStaffEditorState.draft = null;
  coachStaffEditorState.settlementBaseline = null;
  coachStaffEditorState.settlementDetailsOpen = false;
  coachStaffEditorState.saving = false;
  coachStaffEditorState.editingBlockType = "";
  coachStaffEditorState.editingBlockId = "";
  coachStaffEditorState.message = "";
}
