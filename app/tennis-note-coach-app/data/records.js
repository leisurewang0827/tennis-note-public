// 수업 결과와 보강 승인을 서버에 보내는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function processCoachAttendance(lessonId, outcome, deduct) {
  const lesson = ensureCoachLessonRecord(lessonId);
  if (lesson?.attendanceInFlight) return;
  const isAbsence = outcome === "absence";
  if (!lesson || lesson.detailTab !== "processing" || lesson.attendanceChoice?.contractReady !== true || !coachAttendancePreviewMatches(lesson)
    || lesson.attendanceChoice.outcome !== outcome || lesson.attendanceChoice.deduct !== deduct) {
    if (lesson) lesson.validationMessage = "처리 결과를 서버에서 먼저 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  const inputSelector = "#coachAttendanceReason";
  const reason = $(inputSelector)?.value.trim() || "";
  lesson.attendanceChoice.reason = reason;
  const label = isAbsence ? "불참" : "노쇼";
  if (!lesson?.serverLessonId || reason.length < 2) {
    if (lesson) lesson.validationMessage = `${label} 사유를 2자 이상 입력해 주세요.`;
    renderLessonEditModal();
    $(inputSelector)?.focus();
    return;
  }
  const participantResults = coachAttendanceParticipantResults(lesson, outcome, deduct, reason);
  if (!participantResults.length || participantResults.some((item) => !item.userId || !item.ticketId)) {
    lesson.validationMessage = "이 수업의 회원과 회원권 연결을 확인할 수 없습니다. 시간표를 새로고침해 주세요.";
    renderLessonEditModal();
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    lesson.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
    renderLessonEditModal();
    return;
  }
  const operationSignature = `${outcome}:${deduct}:${reason}:${lesson.attendanceChoice.preview.revision}`;
  if (!lesson.attendanceOperation || lesson.attendanceOperation.signature !== operationSignature) {
    lesson.attendanceOperation = {
      signature: operationSignature,
      key: `schedule-v2-coach-${outcome}:${lesson.serverLessonId}:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    };
  }
  lesson.attendanceInFlight = true;
  lesson.validationMessage = `${label} 처리와 회원권 상태를 확인하고 있습니다.`;
  renderLessonEditModal();
  try {
    await client.rpc("tn_apply_coach_attendance_choice", {
      target_lesson_id: lesson.serverLessonId,
      target_outcome: outcome,
      target_deduct: deduct,
      target_reason: reason,
      target_expected_revision: lesson.attendanceChoice.preview.revision,
      target_operation_key: lesson.attendanceOperation.key,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
    closeLessonEditor();
    coachScheduleV2WorkspaceCache = null;
    await syncCoachLessonsFromServer();
    renderAll();
    showToast(`${label} · ${deduct ? "횟수 차감" : "차감 없음"} 처리 완료${isAbsence && !deduct ? " · 보강 가능" : ""}`);
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    lesson.validationMessage = code.includes("ticket_units_unavailable") || code.includes("ticket_unavailable")
      ? "차감 가능한 회원권 횟수가 없습니다."
      : code.includes("already_processed") || code.includes("existing_final")
        ? "이미 처리된 수업입니다. 시간표를 새로고침해 주세요."
        : code.includes("forbidden")
          ? "본인이 담당하는 수업만 처리할 수 있습니다."
          : code.includes("stale_preview")
            ? "수업 또는 회원권이 변경되었습니다. 처리 결과를 다시 확인해 주세요."
          : code.includes("status_invalid")
            ? "현재 상태에서는 처리할 수 없습니다. 새로고침 후 다시 확인해 주세요."
            : `${label} 처리에 실패했습니다. 수업과 회원권 연결을 다시 확인해 주세요.`;
    lesson.attendanceInFlight = false;
    if (code.includes("stale_preview")) lesson.attendanceChoice.preview = null;
    renderLessonEditModal();
  }
}

async function restoreCoachLessonAbsence(entitlementId) {
  const entitlement = state.makeupEntitlements.find((item) => item.id === entitlementId);
  if (!entitlement || !["open", "booked"].includes(entitlement.status)) return;
  const cancelBookedMakeup = entitlement.status === "booked";
  const bookedLabel = [entitlement.bookedDate, entitlement.bookedTime].filter(Boolean).join(" ");
  const confirmation = cancelBookedMakeup
    ? `${entitlement.member} 회원의 ${entitlement.original} 정규수업을 복원할까요?\n\n${bookedLabel || "예약된 보강"} 수업은 취소됩니다.`
    : `${entitlement.member} 회원의 ${entitlement.original} 정규수업을 다시 살릴까요?\n\n불참 처리와 보강 대기는 취소됩니다.`;
  if (!window.confirm(confirmation)) return;
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token) {
    showToast("서버 로그인 상태를 먼저 확인해 주세요.");
    return;
  }
  try {
    await client.rpc("tn_restore_absent_lesson", {
      target_entitlement_id: entitlement.id,
      target_reason: "회원 참석 재확인",
      target_cancel_booked_makeup: cancelBookedMakeup,
    });
    await syncCoachLessonsFromServer();
    renderAll();
    showToast("원래 정규수업 복원 완료");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const message = code.includes("absence_original_slot_occupied")
      ? "원래 시간에 다른 수업이 있어 복원할 수 없습니다."
      : code.includes("absence_original_lesson_already_started")
        ? "이미 지난 정규수업은 참석으로 되돌릴 수 없습니다."
        : code.includes("absence_booked_makeup_locked")
          ? "이미 시작하거나 완료된 보강이 있어 복원할 수 없습니다."
          : code.includes("absence_restore_coach_or_admin_required")
            ? "담당 코치 또는 관리자만 복원할 수 있습니다."
            : "정규수업 복원에 실패했습니다. 시간표를 새로고침해 주세요.";
    showToast(message);
  }
}

async function approveMakeup(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  if (request.reviewing) return;
  if (request.serverRequestV2 && window.TennisNoteDataClient?.rpc) {
    if (!request.canReview) {
      showToast("이 요청은 관리자 승인 후 시간표에 반영됩니다.");
      return;
    }
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_schedule_v2_review_request", {
        target_request_id: request.serverRequestId,
        target_decision: "approved",
        target_reason: null,
      });
      coachScheduleV2WorkspaceCache = null;
      await syncCoachScheduleV2({ force: true });
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("수업 변경 승인 완료");
    } catch (error) {
      showToast(lessonChangeReviewErrorMessage(error, "승인"));
    } finally {
      request.reviewing = false;
    }
    return;
  }
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
        target_request_id: request.serverRequestId,
        target_decision: "approved",
        target_note: null,
      });
      await syncCoachLessonsFromServer();
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("수업 변경 승인 완료");
    } catch (error) {
      showToast(`승인 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    } finally {
      request.reviewing = false;
    }
    return;
  }
  request.status = "승인 완료";
  state.todayLessons.push({
    id: `approved-${id}`,
    day: request.requested.match(/[월화수목금토일]/)?.[0] || "금",
    time: request.requested.split(" ")[1] || "미정",
    coach: requestCoach(request),
    member: request.member,
    type: "보강",
    ticket: "기존 회원권",
    status: "승인됨",
    remaining: 8,
    task: "보강 수업 후 코멘트/다음 커리큘럼",
  });
  exportMakeupRequest(request);
  if (state.editingMakeupId === id) closeLessonEditor();
  renderAll();
}

async function rejectMakeup(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  if (request.reviewing) return;
  if (request.serverRequestId && !request.serverRequestV2
    && !window.confirm(`${request.member}님의 요청을 거절할까요? 원래 수업은 그대로 유지되고 회원권은 차감되지 않습니다.`)) return;
  if (request.serverRequestV2 && window.TennisNoteDataClient?.rpc) {
    if (!request.canReview) {
      showToast("이 요청은 관리자만 거절할 수 있습니다.");
      return;
    }
    request.reviewing = true;
    renderAll();
    try {
      await window.TennisNoteDataClient.rpc("tn_schedule_v2_review_request", {
        target_request_id: request.serverRequestId,
        target_decision: "rejected",
        target_reason: "승인 불가",
      });
      coachScheduleV2WorkspaceCache = null;
      await syncCoachScheduleV2({ force: true });
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      showToast("변경 요청 거절 완료");
    } catch (error) {
      showToast(lessonChangeReviewErrorMessage(error, "거절"));
    } finally {
      request.reviewing = false;
    }
    return;
  }
  if (request.serverRequestId && window.TennisNoteDataClient?.rpc) {
    request.reviewing = true;
    renderAll();
    try {
      const result = await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
        target_request_id: request.serverRequestId,
        target_decision: "rejected",
        target_note: "코치 승인 불가",
      });
      await syncCoachLessonsFromServer();
      if (state.editingMakeupId === id) closeLessonEditor();
      renderAll();
      const deductedSessions = Number(result?.deductedSessions || 0);
      showToast(`변경 요청 거절 완료${deductedSessions ? ` · ${deductedSessions}회 차감` : ""}`);
    } catch (error) {
      showToast(`거절 처리 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    } finally {
      request.reviewing = false;
    }
    return;
  }
  request.status = "거절";
  exportMakeupRequest(request);
  if (state.editingMakeupId === id) closeLessonEditor();
  renderAll();
}

function flushCoachOfflineLessonDrafts() {
  if (coachOfflineFlushPromise || window.TennisNoteDataClient?.isOnline?.() === false) {
    return coachOfflineFlushPromise || Promise.resolve(false);
  }
  const pending = coachPendingSyncLogs();
  if (!pending.length) {
    renderCoachConnectivityStatus();
    return Promise.resolve(true);
  }
  coachSyncUiState = "syncing";
  renderCoachConnectivityStatus();
  coachOfflineFlushPromise = (async () => {
    for (const log of pending) {
      await confirmLog(log.id, { skipDraft: true, fromOfflineQueue: true });
    }
    saveSnapshot();
    const complete = coachPendingSyncLogs().length === 0;
    coachSyncUiState = complete ? "restored" : "failed";
    return complete;
  })().finally(() => {
    coachOfflineFlushPromise = null;
    renderAll();
  });
  return coachOfflineFlushPromise;
}

async function downloadCoachJournalMedia(client, row, displayName) {
  const blob = await client.downloadObject(journalMediaBucket, row.storage_path);
  return {
    name: displayName || "첨부파일",
    type: row.media_type === "video" ? (blob.type || "video/mp4") : (blob.type || "image/jpeg"),
    url: URL.createObjectURL(blob),
    storagePath: row.storage_path,
  };
}

async function refreshLessonCompletionState({ log = null, lessonId = "" } = {}) {
  const serverLessonId = log?.serverLessonId || ensureCoachLessonRecord(lessonId)?.serverLessonId || "";
  if (!serverLessonId) return { ok: false, message: "서버 수업 연결을 확인할 수 없습니다." };
  const client = window.TennisNoteDataClient;
  let preflight = null;
  try {
    preflight = await client?.rpc?.("tn_schedule_v2_coach_completion_preflight", {
      target_lesson_id: serverLessonId,
    });
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    captureLessonCompletionFailure(code, log || ensureCoachLessonRecord(lessonId), true);
    return { ok: false, message: lessonCompletionErrorMessage(code) };
  }
  coachScheduleV2WorkspaceCache = null;
  const refreshed = await syncCoachScheduleV2({ force: true });
  if (!refreshed) return { ok: false, message: "최신 수업 정보를 불러오지 못했습니다. 인터넷과 로그인 상태를 확인해 주세요." };
  const latestLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === serverLessonId);
  const latestLog = state.lessonLogs.find((item) => item.serverLessonId === serverLessonId) || log;
  const preflightStatus = String(preflight?.status || "").toLowerCase();
  if (preflightStatus === "already_completed") {
    if (latestLog) {
      latestLog.status = "확인 완료";
      latestLog.validationMessage = "이미 완료·차감된 수업입니다. 최신 완료 결과를 표시합니다.";
    }
    return { ok: true, alreadyFinal: true, lesson: latestLesson, log: latestLog };
  }
  if (preflight && (preflight.ok === false || preflightStatus !== "ready")) {
    const message = coachCompletionPreflightMessage(preflightStatus);
    if (latestLog) {
      latestLog.status = "확인 대기";
      latestLog.validationMessage = message;
    }
    return { ok: false, stale: true, status: preflightStatus, message, lesson: latestLesson, log: latestLog };
  }
  if (!latestLesson) return { ok: false, message: "최신 시간표에서 수업을 찾지 못했습니다. 관리자 시간표를 확인해 주세요." };
  if (lessonChartFinalized(latestLesson)) {
    if (latestLog) {
      latestLog.status = "확인 완료";
      latestLog.validationMessage = "다른 화면에서 이미 처리된 수업입니다. 최신 완료 결과를 표시합니다.";
    }
    return { ok: true, alreadyFinal: true, lesson: latestLesson, log: latestLog };
  }
  if (latestLog) latestLog.validationMessage = "최신 수업·회원권 상태를 확인했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
  return { ok: true, alreadyFinal: false, lesson: latestLesson, log: latestLog };
}

function captureLessonCompletionFailure(code, lesson, retry = false) {
  window.TennisNoteIssueReporter?.captureClientError?.({
    category: "runtime",
    stage: "coach_lesson_complete",
    code,
    message: "coach_lesson_complete_failed",
    provider: Array.isArray(lesson?.v2Participants) && lesson.v2Participants.length > 1 ? "group" : "personal",
    status: retry ? 409 : 0,
  });
}

async function selectCoachAttendanceChoice(lessonId, field, value) {
  const lesson = ensureCoachLessonRecord(lessonId);
  if (!lesson || lesson.attendanceInFlight || !["outcome", "deduct", "contract"].includes(field)) return;
  const probing = field === "contract";
  if (!probing && lesson.attendanceChoice?.contractReady !== true) return;
  captureLessonTabInputs(lesson);
  const draft = lesson.attendanceChoice ||= {};
  if (probing) draft.contractReady = false;
  else draft[field] = field === "deduct" ? value === "true" : value;
  // Changing the outcome never silently changes the independently chosen deduction.
  draft.preview = null;
  draft.error = "";
  const sequence = draft.sequence = (draft.sequence || 0) + 1;
  draft.loading = probing || (["absence", "no_show"].includes(draft.outcome) && typeof draft.deduct === "boolean");
  renderLessonEditModal();
  if (!draft.loading) return;
  try {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) throw new Error("login_required");
    const preview = await client.rpc("tn_preview_coach_attendance_choice", {
      target_lesson_id: lesson.serverLessonId,
      target_outcome: probing ? "absence" : draft.outcome,
      target_deduct: probing ? false : draft.deduct,
    });
    if (sequence !== draft.sequence) return;
    const candidate = { ...lesson, attendanceChoice: { ...draft, preview,
      outcome: probing ? "absence" : draft.outcome, deduct: probing ? false : draft.deduct } };
    if (!coachAttendancePreviewMatches(candidate)) throw new Error("exact_preview_mismatch");
    draft.contractReady = true;
    // A read-only capability probe must not select an attendance policy for the coach.
    draft.preview = probing ? null : preview;
  } catch (error) {
    if (sequence !== draft.sequence) return;
    draft.preview = null;
    draft.contractReady = false;
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    draft.error = code.includes("existing_member_request")
      ? "회원이 이미 불참 요청을 보냈습니다. 요청 내역에서 먼저 확인해 주세요."
      : code.includes("already_processed")
        ? "이미 처리되었거나 확정 중인 수업입니다. 최신 상태를 확인해 주세요."
        : code.includes("group_policy_unknown")
          ? "그룹 회원권의 차감 정책을 확인할 수 없어 처리할 수 없습니다. 관리자에게 문의해 주세요."
          : code.includes("ticket_") || code.includes("exact_ticket")
            ? "이 수업의 정확한 회원권 또는 차감 가능 횟수를 확인할 수 없습니다."
            : code.includes("forbidden")
              ? "본인이 담당하는 수업만 처리할 수 있습니다."
              : "서버의 출결 선택 계약 또는 최신 수업·회원권 상태를 확인할 수 없습니다. 새로고침 후 다시 선택해 주세요.";
  }
  if (sequence === draft.sequence) {
    draft.loading = false;
    if (state.editingLessonId === lesson.id) { captureLessonTabInputs(lesson); renderLessonEditModal(); }
  }
}
