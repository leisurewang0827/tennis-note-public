// 보강·변경·홀딩 요청을 만들고 취소하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function updateChangeRequestAvailability(availableLessons = memberAvailableSlotsForSelectedLesson(), loadState = activeMemberScheduleLoadState()) {
  const sourceLessons = currentScheduledLessonsForChange();
  const hasSourceLesson = sourceLessons.length > 0;
  const hasAvailableSlot = availableLessons.length > 0;
  const source = sourceLessons.find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const isRegularInitialBooking = Boolean(source?.regularInitialBooking);
  const requiredCount = Math.max(1, Number(source?.frequencyPerWeek) || 1);
  const regularSelectionComplete = !isRegularInitialBooking
    || state.regularInitialSelections.length === requiredCount;
  const canSubmit = hasSourceLesson && hasAvailableSlot && regularSelectionComplete;
  const emptyState = $("#changeRequestEmptyState");
  const reason = $("#changeReason");
  const requestButton = $("#requestMakeup");
  const sourceSelect = $("#absenceLesson");
  const slotSelect = $("#makeupSlot");

  if (sourceSelect) sourceSelect.disabled = !hasSourceLesson;
  if (slotSelect) slotSelect.disabled = !hasAvailableSlot;
  if (reason) reason.disabled = !canSubmit;
  if (requestButton) {
    requestButton.disabled = !canSubmit;
    requestButton.setAttribute("aria-disabled", String(!canSubmit));
  }
  if (emptyState) {
    emptyState.hidden = canSubmit || (isRegularInitialBooking && hasAvailableSlot);
    emptyState.textContent = loadState === "loading"
      ? "선택한 주의 시간표를 확인하고 있습니다."
      : loadState === "error"
        ? "시간표를 불러오지 못했습니다. 다시 확인해 주세요."
        : state.serverChangeBlockedReason
          ? memberChangeBlockedMessage(state.serverChangeBlockedReason, memberChangePolicySnapshot())
        : !hasSourceLesson
      ? "예약하거나 변경할 수업이 없습니다. 이용권을 구매했다면 고객지원으로 문의해 주세요."
      : "현재 변경 가능한 시간이 없습니다. 다른 주를 확인하거나 고객지원으로 문의해 주세요.";
  }
  $("#changeRequestModal")?.classList.toggle("is-unavailable", !canSubmit);
}

function updateHoldingEvidenceFields() {
  const injury = $("#holdingRequestType")?.value === "injury";
  if ($("#holdingEvidenceFields")) $("#holdingEvidenceFields").hidden = !injury;
  if (!injury) {
    if ($("#holdingEvidenceFile")) $("#holdingEvidenceFile").value = "";
    if ($("#holdingSensitiveConsent")) $("#holdingSensitiveConsent").checked = false;
  }
  const policy = memberHoldingPolicy();
  const personalOption = $("#holdingRequestType option[value='personal']");
  if (personalOption) personalOption.disabled = Number(policy.personalMaxDays) <= 0;
  if (!injury && Number(policy.personalMaxDays) <= 0) {
    $("#holdingRequestType").value = "injury";
    return updateHoldingEvidenceFields();
  }
  if ($("#holdingPolicySummary")) {
    $("#holdingPolicySummary").textContent = injury
      ? `부상 홀딩 최대 ${policy.injuryMaxDays}일 · 증빙 확인 필요`
      : `개인 사유 홀딩 최대 ${policy.personalMaxDays}일`;
  }
}

async function submitHoldingRequest(event) {
  event.preventDefault();
  const ticket = currentHoldingTicket();
  if (!ticket) return;
  const requestType = $("#holdingRequestType").value;
  const startDate = $("#holdingStartDate").value;
  const endDate = $("#holdingEndDate").value;
  const reason = $("#holdingReason").value.trim();
  const file = $("#holdingEvidenceFile").files?.[0] || null;
  const consent = $("#holdingSensitiveConsent").checked;
  const policy = memberHoldingPolicy();
  const days = holdingRequestDays(startDate, endDate);
  const maxDays = requestType === "injury" ? Number(policy.injuryMaxDays) : Number(policy.personalMaxDays);
  if (requestType === "personal" && maxDays <= 0) {
    message.textContent = "쿠폰제는 개인 사유 홀딩을 제공하지 않습니다. 부상·입원은 증빙과 함께 신청할 수 있습니다.";
    return;
  }
  const message = $("#holdingRequestMessage");
  if (!days || days > maxDays) {
    message.textContent = `${requestType === "injury" ? "부상" : "개인 사유"} 홀딩은 최대 ${maxDays}일까지 신청할 수 있습니다.`;
    return;
  }
  if (requestType === "injury" && policy.evidenceRequired && !file) {
    message.textContent = "부상 홀딩은 진단서 또는 진료확인서를 첨부해 주세요.";
    return;
  }
  const allowedEvidenceTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (file && !allowedEvidenceTypes.includes(file.type)) {
    message.textContent = "PDF·JPG·PNG·WEBP 파일만 첨부할 수 있습니다.";
    return;
  }
  if (file && file.size > 5 * 1024 * 1024) {
    message.textContent = "첨부파일은 5MB 이하만 가능합니다.";
    return;
  }
  if (requestType === "injury" && !consent) {
    message.textContent = "건강정보 처리 안내를 확인하고 동의해 주세요.";
    return;
  }
  if (requestType === "personal" && memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.type === "personal" && request.status === "approved")) {
    message.textContent = "이 회원권은 개인 사유 홀딩을 이미 사용했습니다.";
    return;
  }
  if (memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.status === "pending")) {
    message.textContent = "이미 검토 중인 홀딩 요청이 있습니다.";
    return;
  }

  const requestId = globalThis.crypto?.randomUUID?.() || `holding-${Date.now()}`;
  const client = window.TennisNoteDataClient;
  let evidencePath = "";
  const isLive = !ticket.id.startsWith("demo-") && state.member?.profileId && client?.getSession?.()?.access_token;
  try {
    if (isLive && requestType === "injury" && file) {
      evidencePath = `${state.member.profileId}/${requestId}/${safeHoldingFileName(file.name)}`;
      await client.uploadObject("tennisnote-private-holding-evidence", evidencePath, file);
    }
    if (isLive) {
      await client.insertRows("tn_holding_requests", {
        id: requestId,
        branch_id: ticket.branchId,
        user_id: state.member.profileId,
        ticket_id: ticket.id,
        request_type: requestType,
        requested_start_on: startDate,
        requested_end_on: endDate,
        reason_summary: reason,
        evidence_object_path: evidencePath,
        evidence_status: requestType === "injury" ? "uploaded" : "not_required",
        sensitive_consent_at: requestType === "injury" ? new Date().toISOString() : null,
        evidence_purge_due_at: requestType === "injury" ? new Date(Date.now() + Number(policy.evidenceRetentionDays) * 86400000).toISOString() : null,
      });
    }
  } catch {
    if (evidencePath && client?.deleteObject) {
      await client.deleteObject("tennisnote-private-holding-evidence", evidencePath).catch(() => {});
    }
    message.textContent = "서버 신청을 저장하지 못했습니다. 관리자에게 문의해 주세요.";
    return;
  }

  const shared = loadSharedData();
  shared.holdingRequests = shared.holdingRequests || [];
  shared.holdingRequests.unshift({
    id: requestId,
    member: state.member?.name || state.profile.name,
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    type: requestType,
    typeLabel: requestType === "injury" ? "부상·입원" : "개인 사유",
    startDate,
    endDate,
    days,
    reason,
    evidencePath: isLive ? evidencePath : "",
    evidenceLabel: requestType === "injury" ? "증빙 첨부" : "증빙 없음",
    status: "pending",
    source: isLive ? "server" : "demo",
    createdAt: new Date().toISOString(),
  });
  saveSharedData(shared);
  state.ticketHistory.unshift({ text: `홀딩 신청 · ${startDate}~${endDate} · 관리자 검토중`, tone: "wait" });
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#holdingRequestModal");
  closeHoldingRequestModal();
  state.selectedHoldingTicketId = "";
  renderCurrentTicketPanel();
}

function handleScheduleClick(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId);
  if (!lesson) return;
  if (isOwnMemberScheduleLesson(lesson)) {
    openLessonDetailSheet(lesson.id);
    return;
  }
  if (lesson.status === "available") {
    const initialSource = regularInitialSourceLesson();
    if (initialSource) {
      toggleRegularInitialScheduleSlot(lesson.id);
      return;
    }
    const firstRegular = currentScheduledLessonsForChange().find((item) => (
      item.id === state.selectedMemberChangeSourceId
    ));
    if (!firstRegular) {
      showToast("변경할 기존 수업을 먼저 선택해 주세요.");
      document.querySelector("#memberInlineChangeSource")?.focus();
      return;
    }
    $("#absenceLesson").value = firstRegular.id;
    renderSelects();
    $("#makeupSlot").value = lesson.id;
    state.memberChangeCompactSelection = true;
    $("#changeRequestModal")?.classList.add("is-inline-confirmation");
    renderAvailableSlots();
    renderChangeModalSummary();
    openAppModal("changeRequestModal", "#requestMakeup");
  }
}

function confirmRegularInitialSchedule() {
  const source = regularInitialSourceLesson();
  if (!source) return;
  const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
  if (state.regularInitialSelections.length !== requiredCount) {
    showToast(`${requiredCount}개의 시간을 선택해 주세요.`);
    return;
  }
  renderSelects();
  $("#absenceLesson").value = source.id;
  renderSelects();
  $("#makeupSlot").value = state.regularInitialSelections[0];
  renderAvailableSlots();
  requestMakeup();
}

async function cancelMemberScheduleRequest(kind, id) {
  if (!id || !window.TennisNoteDataClient?.rpc) return;
  const label = kind === "makeup" ? "보강 예약" : "수업 변경 요청";
  if (!window.confirm(`${label}을 취소하고 원래 상태로 되돌릴까요?`)) return;
  try {
    await window.TennisNoteDataClient.rpc(
      kind === "makeup" ? "tn_cancel_my_makeup_booking" : "tn_cancel_my_lesson_change_request",
      kind === "makeup" ? { target_entitlement_id: id } : { target_request_id: id },
    );
    await syncMemberLessonsFromServer();
    await syncMemberChangeRequestsFromServer();
    renderAll();
    showToast(`${label}을 취소했습니다.`);
  } catch (error) {
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    const message = errorText.includes("original_time_occupied")
      ? "원래 수업 시간에 다른 수업이 들어와 자동 복원이 어렵습니다. 카카오채널로 문의해 주세요."
      : errorText.includes("already_started") || errorText.includes("not_cancelable")
        ? "이미 시작했거나 처리된 수업은 앱에서 취소할 수 없습니다."
        : "취소하지 못했습니다. 새로고침 후 다시 시도해 주세요.";
    showToast(message);
  }
}

async function submitMemberLessonChange(client, args) {
  try {
    return await client.rpc("tn_submit_lesson_change_request_v3", args);
  } catch (error) {
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_submit_lesson_change_request_v3|PGRST202|42883|schema cache/i.test(errorText)) throw error;
  }
  const compatibilityArgs = { ...args };
  delete compatibilityArgs.target_policy_revision;
  try {
    return await client.rpc("tn_submit_lesson_change_request_v2", compatibilityArgs);
  } catch (error) {
    const errorText = `${error?.payload?.message || ""} ${error?.message || ""}`;
    if (!/tn_submit_lesson_change_request_v2|PGRST202|42883|schema cache/i.test(errorText)) throw error;
    return client.rpc("tn_submit_lesson_change_request", compatibilityArgs);
  }
}

async function requestMakeup() {
  if ($("#requestMakeup")?.disabled) {
    showToast("현재 변경할 수 있는 수업 시간이 없습니다.");
    return;
  }
  const absence = ensureMemberScheduleLesson($("#absenceLesson").value);
  const makeup = ensureMemberScheduleLesson($("#makeupSlot").value);
  if (!absence || !makeup) return;

  const originalDay = absence.day;
  const originalTime = absence.time;
  const originalCoach = absence.coach;
  const isMakeupEntitlement = Boolean(absence.makeupEntitlementId);
  const isCouponBooking = Boolean(absence.couponBooking);
  const isRegularInitialBooking = Boolean(absence.regularInitialBooking);
  const isPausedResumeBooking = Boolean(absence.resumePausedTicket);
  const enteredReason = $("#changeReason")?.value.trim() || "";
  const reasonMode = memberChangeReasonMode(absence, makeup);
  const reason = isPausedResumeBooking
    ? "휴회 복귀 정규시간 설정"
    : isRegularInitialBooking
    ? "회원 첫 정규시간 설정"
    : isMakeupEntitlement ? "불참 처리 후 보강 예약" : isCouponBooking ? "쿠폰 수업 예약" : reasonMode === "none" ? "" : enteredReason;
  if (!isMakeupEntitlement && !isCouponBooking && !isRegularInitialBooking && reasonMode === "required" && reason.length < 2) {
    showToast("변경 이유를 2자 이상 입력해주세요.");
    const reasonInput = $("#changeReason");
    reasonInput?.focus?.({ preventScroll: true });
    reasonInput?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return;
  }
  const client = window.TennisNoteDataClient;
  const liveRequest = Boolean(state.member?.profileId && (
    absence.serverLessonId
    || absence.makeupEntitlementId
    || ((isCouponBooking || isRegularInitialBooking) && absence.ticketId)
  ) && client?.rpc);
  if (state.dataMode === "live" && !liveRequest) {
    showToast("실제 수업 연결을 다시 확인한 뒤 요청해주세요.");
    return;
  }

  if (liveRequest) {
    const button = $("#requestMakeup");
    if (button) {
      button.disabled = true;
      button.textContent = isMakeupEntitlement || isCouponBooking ? "예약 중" : "요청 중";
    }
    try {
      const targetDate = makeup.lessonDate || memberScheduleDateForDay(makeup.day);
      if (!targetDate) throw new Error("target_lesson_date_required");
      const changeDirection = memberChangeDirection(absence, makeup);
      const regularSchedules = state.regularInitialSelections
        .map((id) => memberScheduleOptions().find((lesson) => lesson.id === id))
        .filter(Boolean)
        .map((lesson) => ({
          lessonDate: lesson.lessonDate || memberScheduleDateForDay(lesson.day),
          startTime: lesson.time,
          durationMinutes: Number(lesson.durationMinutes) || Number(absence.durationMinutes) || 20,
          coachRoleId: lesson.coachRoleId || "",
        }));
      if (isRegularInitialBooking && regularSchedules.length !== Math.max(1, Number(absence.frequencyPerWeek) || 1)) {
        throw new Error("regular_schedule_count_mismatch");
      }
      if (isRegularInitialBooking && !state.regularInitialOperationKey) {
        state.regularInitialOperationKey = `member_regular_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
      }
      const editingRequestId = state.editingChangeRequestId;
      const result = isRegularInitialBooking
        ? isPausedResumeBooking
          ? await client.rpc("tn_resume_paused_regular_schedule", {
              target_ticket_id: absence.ticketId,
              target_schedules: regularSchedules,
              target_operation_key: state.regularInitialOperationKey,
            })
          : await client.rpc("tn_book_initial_regular_schedule", {
              target_ticket_id: absence.ticketId,
              target_schedules: regularSchedules,
              target_operation_key: state.regularInitialOperationKey,
            })
        : isMakeupEntitlement
        ? await client.rpc("tn_book_makeup_entitlement", {
            target_entitlement_id: absence.makeupEntitlementId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
          })
        : isCouponBooking
          ? await client.rpc("tn_book_coupon_lesson", {
              target_ticket_id: absence.ticketId,
              target_lesson_date: targetDate,
              target_start_time: makeup.time,
            })
          : editingRequestId
            ? await client.rpc("tn_update_my_lesson_change_request", {
              target_request_id: editingRequestId,
              target_lesson_date: targetDate,
              target_start_time: makeup.time,
              target_reason: reason,
            })
          : await submitMemberLessonChange(client, {
            target_lesson_id: absence.serverLessonId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
            target_policy_revision: Number(memberChangePolicySnapshot(makeup)?.revision) || 0,
          });
      await syncMemberLessonsFromServer();
      if (isPausedResumeBooking) await syncMemberTicketsFromServer();
      if (!isMakeupEntitlement) await syncMemberChangeRequestsFromServer();
      state.ticketHistory.unshift({
        text: isRegularInitialBooking
          ? `${absence.ticketTitle} · ${isPausedResumeBooking ? "휴회 복귀 및 정규시간 설정 완료" : "정규시간 설정 완료"}`
          : isMakeupEntitlement
          ? `${originalDay} ${originalTime} 불참 수업 → ${makeup.day} ${makeup.time} 보강 예약 완료`
          : isCouponBooking
            ? `${absence.ticketTitle} → ${makeup.day} ${makeup.time} 쿠폰 예약 완료`
            : `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} ${editingRequestId ? "요청 수정" : changeDirection === "advance" ? "앞당기기" : "변경"} ${result?.status === "auto_approved" ? "완료" : "담당 코치·관리자 승인 대기"}`,
        tone: isRegularInitialBooking || isMakeupEntitlement || isCouponBooking || result?.status === "auto_approved" ? "done" : "wait",
      });
      if ($("#changeReason")) $("#changeReason").value = "";
      window.TennisNoteInputGuard?.markSaved?.("#changeRequestModal");
      closeChangeRequestModal();
      renderAll();
      saveSnapshot();
      showToast(isRegularInitialBooking
        ? isPausedResumeBooking ? "휴회를 마치고 정규 수업시간을 설정했습니다." : "정규 수업시간이 설정되었습니다."
        : isMakeupEntitlement
        ? "보강 예약이 완료되었습니다."
        : isCouponBooking
          ? "쿠폰 수업 예약이 완료되었습니다."
          : editingRequestId
            ? "수업 변경 요청을 수정했습니다. 담당 코치 또는 관리자가 확인합니다."
          : result?.status === "auto_approved"
            ? changeDirection === "advance" ? "수업을 앞당겼습니다." : "수업 시간이 변경되었습니다."
            : changeDirection === "advance" ? "담당 코치·관리자에게 수업 앞당기기 요청을 보냈습니다." : "담당 코치·관리자에게 변경 요청을 보냈습니다.");
    } catch (error) {
      let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
      if (typeof code === "string" && code.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(code);
          code = parsed.message || parsed.code || code;
        } catch {
          // Keep the original server message when it is not valid JSON.
        }
      }
      const messages = {
        regular_schedule_count_mismatch: "회원권의 주 횟수만큼 시간을 선택해주세요.",
        initial_regular_schedule_already_exists: "이미 정규시간이 설정된 회원권입니다. 수업 변경을 이용해주세요.",
        regular_ticket_required: "사용 가능한 정규 회원권을 다시 확인해주세요.",
        regular_schedule_day_duplicate: "같은 요일은 한 번만 선택할 수 있습니다.",
        regular_schedule_single_coach_required: "주간 정규시간은 같은 코치로 선택해주세요.",
        coach_role_required: "선택한 시간의 코치를 확인할 수 없습니다. 다시 선택해주세요.",
        coach_role_inactive: "담당 코치가 현재 근무 중이 아닙니다. 관리자에게 문의해주세요.",
        regular_slot_anchor_required: "해당 날짜에는 담당 코치의 기존 수업이 없어 새 정규시간을 선택할 수 없습니다.",
        regular_slot_outside_anchor_window: "담당 코치의 기존 수업 전후 허용 범위 안에서 시간을 다시 선택해주세요.",
        change_reason_required: "변경 이유를 2자 이상 입력해주세요.",
        member_change_policy_changed: "운영 규칙이 방금 변경되었습니다. 가능한 시간을 다시 확인한 뒤 신청해 주세요.",
        member_change_disabled: "회원 앱 수업 변경이 현재 꺼져 있습니다. 담당 코치에게 문의해 주세요.",
        member_change_within_cutoff_blocked: "수업 변경 가능 시간이 지나 앱에서 신청할 수 없습니다. 담당 코치에게 문의해 주세요.",
        group_member_change_blocked: "그룹수업은 앱에서 변경할 수 없습니다. 담당 코치에게 문의해 주세요.",
        lesson_already_started: "이미 시작한 수업은 변경할 수 없습니다.",
        target_time_must_be_future: "이미 지난 시간으로는 변경할 수 없습니다.",
        same_lesson_time: "현재 수업과 다른 시간을 선택해주세요.",
        no_nearby_coach_lesson: "담당 코치의 기존 수업과 40분 이내인 시간만 신청할 수 있습니다.",
        target_time_occupied: "방금 다른 수업이 배정된 시간입니다. 다른 시간을 선택해주세요.",
        target_time_blocked: "브레이크 또는 운영 중지 시간입니다.",
        coach_not_working: "담당 코치의 근무시간이 아닙니다.",
        schedule_scope_mismatch: "평일권은 평일, 주말권은 주말 시간만 변경할 수 있습니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과합니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과합니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과합니다.",
        lesson_change_request_already_pending: "이미 승인 대기 중인 변경 요청이 있습니다. 요청 내역에서 기존 요청을 수정해 주세요.",
        target_date_outside_ticket: "회원권 사용기간 밖의 날짜입니다.",
        coupon_booking_forbidden: "이 쿠폰을 예약할 권한이 없습니다.",
        coupon_ticket_required: "사용 가능한 쿠폰 회원권을 확인해 주세요.",
        coupon_product_required: "선택한 회원권은 쿠폰 예약 상품이 아닙니다.",
        ticket_balance_insufficient: "쿠폰 잔여 횟수가 부족합니다.",
        makeup_entitlement_not_found: "보강 대상 수업을 찾을 수 없습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_entitlement_not_open: "이미 예약되었거나 종료된 보강입니다.",
        makeup_source_lesson_invalid: "원래 수업 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_booking_forbidden: "이 보강을 예약할 권한이 없습니다.",
        active_ticket_required: "사용 가능한 회원권 횟수를 확인해 주세요.",
      };
      showToast(messages[code] || `${isMakeupEntitlement ? "보강 예약" : "수업 변경 요청"} 실패: ${code}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = memberChangeSubmitLabel(absence, makeup);
      }
    }
    return;
  }

  absence.status = "available";
  absence.member = "";
  absence.type = "수업 변경 가능";
  absence.policy = "auto";
  makeup.status = "requested";
  makeup.member = currentMemberName();
  const needsApproval = makeup.policy === "coach";
  const request = {
    id: `makeup-${Date.now()}`,
    absence: `${originalDay} ${originalTime} 기존 수업`,
    makeup: `${makeup.day} ${makeup.time} 수업 변경 희망 · ${makeup.coach}`,
    reason,
    policy: policyDetail(makeup.policy, memberChangePolicySnapshot(makeup)),
    status: needsApproval ? "코치 승인 대기 · 당일 취소 차감" : "자동 변경 완료",
  };
  state.makeupRequests.unshift(request);
  pushMakeupRequestToShared(request);
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} 수업 변경 요청 접수`, tone: "wait" });
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} ${originalCoach} 시간 비움 · 다른 회원 수업변경 신청 가능`, tone: "done" });
  if ($("#changeReason")) $("#changeReason").value = "";
  window.TennisNoteInputGuard?.markSaved?.("#changeRequestModal");
  closeChangeRequestModal();
  renderAll();
}

function confirmLatestLesson() {
  let pendingLog = state.lessonLogs.find((log) => log.status === "coach_pending");
  if (!pendingLog) {
    const fallbackLesson = memberScheduleLessons().find((item) => isCurrentMemberName(item.member) && item.status === "scheduled");
    if (!fallbackLesson || state.remaining <= 0) return;
    const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
    pendingLog = {
      id: `coach-only-${Date.now()}`,
      lessonId: fallbackLesson.id,
      lessonLabel: `${fallbackLesson.day} ${fallbackLesson.time} · ${fallbackLesson.coach}`,
      round: lessonRound(),
      content: "회원 운동일지 미작성 · 코치 코멘트와 다음 커리큘럼으로 출석 확인",
      selfMemo: "회원에게는 운동일지 작성 안내만 표시하고, 미작성 상태여도 코치 코멘트와 다음 커리큘럼 등록으로 횟수 체크합니다.",
      status: "coach_pending",
      curriculum,
      nextCurriculumId: curriculum.id,
      coachComment: "출석 확인 완료. 회원 운동일지 미작성 상태지만 코치 코멘트로 수업을 확인했습니다.",
      memberVisibleSummary: curriculum.next,
      ticketDeducted: false,
      submittedAt: new Date().toISOString(),
    };
    state.lessonLogs.unshift(pendingLog);
  }
  if (state.remaining <= 0) return;

  const lesson = ensureMemberScheduleLesson(pendingLog.lessonId);
  pendingLog.status = "confirmed";
  if (lesson) lesson.status = "completed";
  state.remaining -= 1;
  state.ticketHistory.unshift({
    text: `${lessonReviewTitle(pendingLog)} · 1회 차감`,
    tone: "done",
  });
  if (state.remaining === 2) {
    state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
  }
  renderAll();
}

function handleLessonDetailAction(action) {
  const lesson = selectedLessonDetail();
  if (!lesson) return;
  closeLessonDetailForAction();
  if (action === "journal") {
    openJournalComposer(lesson.lessonDate || localDateKey());
    return;
  }
  if (action === "change" || action === "makeup") {
    openMemberChangeTimetable(lesson.id);
  }
}
