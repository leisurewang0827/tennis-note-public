// 시간표를 고치고 수업을 추가하는 함수들.
//
// 코치가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function applyScheduleV2CoachWorkspace(workspace = {}, oneDayRows = [], roster = null, legacyChangeRequests = []) {
  if (!workspace?.branchId || !Array.isArray(workspace.lessons)) return false;
  const cancelledLessonIds = new Set(
    workspace.lessons
      .filter((lesson) => String(lesson.status || "").toLowerCase() === "cancelled")
      .map((lesson) => String(lesson.id || "").trim())
      .filter(Boolean),
  );
  if (cancelledLessonIds.size) {
    state.lessonLogs = state.lessonLogs.filter((log) => !cancelledLessonIds.has(String(log.serverLessonId || "")));
  }
  state.scheduleOperationDays = Array.isArray(workspace.operationDays) ? workspace.operationDays : [];
  const tickets = Array.isArray(roster?.tickets)
    ? roster.tickets
    : Array.isArray(workspace.tickets) ? workspace.tickets : [];
  const members = Array.isArray(roster?.members)
    ? roster.members
    : Array.isArray(workspace.members) ? workspace.members : [];
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const ticketsByUserId = new Map();
  tickets.forEach((ticket) => {
    (ticket.participantUserIds || [ticket.ownerUserId]).filter(Boolean).forEach((userId) => {
      const current = ticketsByUserId.get(userId) || [];
      current.push(ticket);
      ticketsByUserId.set(userId, current);
    });
  });

  const mappedLessons = workspace.lessons
    .filter((lesson) => lesson.status !== "cancelled")
    .map((lesson) => scheduleV2CoachLesson(lesson, workspace));
  const mappedOneDay = (oneDayRows || [])
    .filter((booking) => ["reserved", "checked_in", "completed"].includes(booking.status))
    .map((booking) => scheduleV2CoachOneDayLesson(booking, workspace));
  const retainedLessons = (state.liveLessons || []).filter((lesson) => (
    lesson.lessonDate
    && (lesson.lessonDate < workspace.from || lesson.lessonDate > workspace.to)
  ));
  state.liveLessons = [...retainedLessons, ...mappedLessons, ...mappedOneDay]
    .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);

  const rawLessonsById = new Map((workspace.lessons || []).map((lesson) => [lesson.id, lesson]));
  const coachesByRoleId = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  state.makeupEntitlements = (workspace.makeupEntitlements || []).map((entitlement) => {
    const sourceLesson = rawLessonsById.get(entitlement.sourceLessonId) || {};
    const bookedLesson = rawLessonsById.get(entitlement.bookedLessonId) || {};
    return {
      id: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      bookedLessonId: entitlement.bookedLessonId || "",
      ticketId: entitlement.ticketId,
      coachRoleId: entitlement.coachRoleId,
      coach: coachesByRoleId.get(entitlement.coachRoleId)?.name || "담당 코치",
      member: entitlement.memberName || "회원",
      durationMinutes: Number(entitlement.durationMinutes) || 20,
      status: entitlement.status,
      reason: entitlement.reason || "회원 사전 불참",
      originalDate: sourceLesson.lessonDate || "",
      originalTime: String(sourceLesson.startTime || "").slice(0, 5),
      original: `${sourceLesson.lessonDate || "기존일"} ${String(sourceLesson.startTime || "").slice(0, 5)}`.trim(),
      bookedDate: bookedLesson.lessonDate || "",
      bookedTime: String(bookedLesson.startTime || "").slice(0, 5),
    };
  });
  const todayIso = localDateKey();
  state.releasedMakeupSlots = state.makeupEntitlements.flatMap((entitlement) => {
    if (!entitlement.originalDate || !entitlement.originalTime) return [];
    const releasedStart = minutesFromTime(entitlement.originalTime);
    const releasedEnd = releasedStart + entitlement.durationMinutes;
    const occupyingLesson = state.liveLessons.find((lesson) => {
      if (lesson.lessonDate !== entitlement.originalDate || lesson.coachRoleId !== entitlement.coachRoleId) return false;
      const lessonStart = minutesFromTime(lesson.time);
      return releasedStart < lessonStart + lessonDuration(lesson) && lessonStart < releasedEnd;
    });
    if (occupyingLesson) {
      occupyingLesson.releasedOriginMember = entitlement.member;
      occupyingLesson.releasedOriginLabel = `${entitlement.member} 정규 불참 자리`;
      return [];
    }
    const dayIndex = new Date(`${entitlement.originalDate}T00:00:00`).getDay();
    const historicalReleasedSlot = entitlement.originalDate < todayIso;
    return [{
      id: `released-${entitlement.id}`,
      releasedMakeupSlot: true,
      historicalReleasedSlot,
      lessonDate: entitlement.originalDate,
      day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
      time: entitlement.originalTime,
      coach: entitlement.coach,
      coachRoleId: entitlement.coachRoleId,
      member: entitlement.member,
      releasedOriginalMember: entitlement.member,
      entitlementId: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      type: historicalReleasedSlot
        ? `정규 · 불참 · 차감 없음 ${entitlement.durationMinutes}분`
        : `정규 · 불참 · 보강·원데이 가능 ${entitlement.durationMinutes}분`,
      lessonSource: "makeup",
      durationMinutes: entitlement.durationMinutes,
      status: "available",
      task: "보강 가능",
    }];
  });

  const latestLessonByUserId = new Map();
  [...mappedLessons]
    .sort((left, right) => `${right.lessonDate || ""} ${right.time || ""}`.localeCompare(`${left.lessonDate || ""} ${left.time || ""}`))
    .forEach((lesson) => {
      (lesson.memberUserIds || []).forEach((userId) => {
        if (!latestLessonByUserId.has(userId)) latestLessonByUserId.set(userId, lesson);
      });
    });
  const ticketStateRank = { expiring: 0, active: 1, paused_pending: 2, expired: 3 };
  const memberRows = members.map((member) => {
    const memberTickets = [...(ticketsByUserId.get(member.id) || [])].sort((left, right) => (
      (ticketStateRank[coachRosterTicketState(left, todayIso)] ?? 9) - (ticketStateRank[coachRosterTicketState(right, todayIso)] ?? 9)
      || String(right.startsOn || "").localeCompare(String(left.startsOn || ""))
    ));
    const ticket = memberTickets[0] || {};
    const coach = (workspace.coaches || []).find((item) => item.roleId === ticket.coachRoleId) || {};
    const latestLesson = latestLessonByUserId.get(member.id);
    const statusCategory = memberTickets.length ? coachRosterTicketState(ticket, todayIso) : "expired";
    const statusLabel = {
      active: "수강중",
      expiring: "만료 임박",
      paused_pending: ticket.status === "paused" ? "휴회" : ticket.status === "pending_payment" ? "결제 대기" : "시작 예정",
      expired: "만료",
    }[statusCategory] || "확인 필요";
    return {
      id: member.id,
      serverUserId: member.id,
      name: normalizeCoachScheduleMemberName(member.name, "이름 확인 필요"),
      photoUrl: member.photoUrl || "",
      coach: coach.name || "담당 코치 미지정",
      ticket: ticket.productName || `${Number(ticket.totalSessions) || 0}회 회원권`,
      total: Number(ticket.totalSessions) || 0,
      used: Number(ticket.usedSessions) || 0,
      remaining: Number(ticket.remainingSessions) || 0,
      status: statusLabel,
      statusCategory,
      memberTickets,
      ticketCount: memberTickets.length,
      lastLesson: latestLesson ? `${latestLesson.day} ${latestLesson.time}` : "최근 수업 없음",
      expiredAt: ticket.expiresOn || "",
      phone: member.phone || "",
      birthYear: member.birthYear || "",
      neighborhood: member.neighborhood || "",
      gender: member.gender || "",
      selfNtrp: member.selfNtrp ? String(member.selfNtrp) : "-",
      coachNtrp: member.coachNtrp ? String(member.coachNtrp) : "측정 전",
      ntrpRequest: member.ntrpRequestedAt ? (member.coachNtrp ? "완료" : "요청") : "미요청",
      ntrpSurvey: member.ntrpSurvey || {},
      ntrpGoal: member.tennisGoal || "",
      ntrpMemo: member.playStyleMemo || "",
    };
  });
  state.members = memberRows.filter((member) => member.statusCategory !== "expired");
  state.expiredMembers = memberRows.filter((member) => member.statusCategory === "expired");

  const membersById = new Map(members.map((member) => [member.id, member]));
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const scheduleV2Requests = (workspace.requests || []).map((request) => {
    const participant = Array.isArray(request.participants) ? request.participants[0] : null;
    const member = membersById.get(participant?.userId || request.requester_user_id) || {};
    return {
      id: request.id,
      serverRequestId: request.id,
      serverRequestV2: true,
      member: member.name || "회원",
      original: "기존 수업",
      requested: `${request.lesson_date || ""} ${String(request.start_time || "").slice(0, 5)}`.trim(),
      reason: request.note || "이유 미입력",
      policy: "운영 정책에 따른 승인 요청",
      status: "승인 대기",
      coach: coachesById.get(request.coach_role_id)?.name || "담당 코치",
      coachRoleId: request.coach_role_id || "",
      source: "schedule_v2",
      canReview: workspace.actor?.isAdmin === true || request.coach_role_id === workspace.actor?.coachRoleId,
    };
  });
  const requestStatusLabel = {
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "거절",
    auto_approved: "자동 변경 완료",
    cancelled: "회원 취소",
  };
  const legacyRequests = (legacyChangeRequests || [])
    .map((request) => {
      const lesson = state.liveLessons.find((item) => String(item.serverLessonId || "") === String(request.lesson_id || ""));
      if (!lesson || !lessonAssignedToCurrentCoachForTasks(lesson)) return null;
      const originalDate = request.original_lesson_date || lesson.lessonDate || "";
      const originalTime = String(request.original_start_time || lesson.time || "").slice(0, 5);
      return {
        id: request.id,
        serverRequestId: request.id,
        member: lesson.member || "회원",
        original: `${originalDate} ${originalTime}`.trim() || "기존 수업",
        requested: `${request.requested_lesson_date || ""} ${String(request.requested_start_time || "").slice(0, 5)}`.trim(),
        reason: request.reason === "정책상 사유 없음" ? "사유 없음" : request.reason || "이유 미입력",
        policy: lessonChangePolicyText(request),
        policySnapshot: lessonChangePolicySnapshot(request),
        requestedAt: lessonChangeRequestedAtText(request.created_at),
        remainingTime: lessonChangeRemainingText(originalDate, originalTime),
        status: requestStatusLabel[request.status] || request.status,
        coach: lesson.coach || "담당 코치",
        coachRoleId: lesson.coachRoleId || "",
        source: "server",
        canReview: request.status === "pending",
      };
    })
    .filter(Boolean);
  state.makeupRequests = [...legacyRequests, ...scheduleV2Requests];

  const today = localDateKey();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoff = localDateKey(cutoffDate);
  mappedLessons
    .filter((lesson) => (
      lesson.lessonDate >= cutoff
      && lesson.lessonDate <= today
      && lesson.v2Permissions?.canProcess
      && lesson.v2Participants?.length
      && lesson.v2Participants.every((participant) => participant.recordStatus === "final")
    ))
    .forEach((lesson) => {
      const participantResults = scheduleV2CoachParticipantResults(lesson);
      const primaryResult = participantResults[0] || {};
      const completedAt = participantResults
        .map((result) => result.finalizedAt || result.updatedAt || "")
        .filter(Boolean)
        .sort((left, right) => String(right).localeCompare(String(left)))[0] || "";
      const existingLog = state.lessonLogs.find((log) => log.serverLessonId === lesson.serverLessonId);
      const completedFields = {
        serverLessonId: lesson.serverLessonId,
        member: lesson.member,
        lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
        coachComment: primaryResult.coachComment || "",
        nextCurriculumId: primaryResult.nextCurriculumId || "",
        participantResults,
        serverCoachComment: primaryResult.coachComment || "",
        serverNextCurriculumId: primaryResult.nextCurriculumId || "",
        localCoachCommentDirty: false,
        localNextCurriculumDirty: false,
        status: "확인 완료",
        curriculumRegistered: Boolean(primaryResult.nextCurriculumId),
        ticketDeducted: lesson.deductedSessions > 0,
        completedAt,
      };
      if (existingLog) Object.assign(existingLog, completedFields);
      else state.lessonLogs.unshift({
        id: `schedule-v2-completed-${lesson.serverLessonId}`,
        serverJournalId: "",
        content: "관리자 또는 코치가 수업 피드백을 완료했습니다.",
        selfMemo: "서버에 저장된 참여자별 완료 피드백입니다.",
        mediaNames: [],
        mediaItems: [],
        curriculumId: primaryResult.nextCurriculumId || "",
        validationMessage: "",
        ...completedFields,
      });
    });
  mappedLessons
    .filter((lesson) => (
      lesson.serverStatus === "scheduled"
      && lesson.lessonDate >= cutoff
      && lesson.lessonDate <= today
      && lesson.v2Permissions?.canProcess
      && !lesson.v2Participants?.every((participant) => participant.recordStatus === "final")
    ))
    .forEach((lesson) => {
      const serverParticipantDrafts = scheduleV2CoachParticipantResults(lesson);
      const hasServerFeedbackDraft = serverParticipantDrafts.some((result) => (
        result.recordStatus === "draft"
        || Boolean(result.coachComment)
        || Boolean(result.nextCurriculumId)
      ));
      const existingLog = state.lessonLogs.find((log) => log.serverLessonId === lesson.serverLessonId);
      if (existingLog) {
        const existingParticipantDrafts = Array.isArray(existingLog.participantResults)
          ? existingLog.participantResults
          : [];
        const localDrafts = new Map(existingParticipantDrafts.map((result) => [
          `${result.userId || ""}:${result.ticketId || ""}`,
          result,
        ]));
        const shouldUseParticipantDrafts = hasServerFeedbackDraft
          || existingParticipantDrafts.length > 0
          || serverParticipantDrafts.length > 1;
        if (shouldUseParticipantDrafts) {
          existingLog.participantResults = serverParticipantDrafts.map((serverDraft, index) => {
            const localDraft = localDrafts.get(`${serverDraft.userId}:${serverDraft.ticketId}`) || {};
            return mergeScheduleV2CoachParticipantDraft(serverDraft, localDraft, {
              useFallback: index === 0,
              coachComment: existingLog.coachComment || "",
              nextCurriculumId: existingLog.nextCurriculumId || "",
              hasServerCoachComment: Object.prototype.hasOwnProperty.call(existingLog, "serverCoachComment"),
              hasServerNextCurriculumId: Object.prototype.hasOwnProperty.call(existingLog, "serverNextCurriculumId"),
              serverCoachComment: existingLog.serverCoachComment || "",
              serverNextCurriculumId: existingLog.serverNextCurriculumId || "",
              localCoachCommentDirty: existingLog.localCoachCommentDirty === true,
              localNextCurriculumDirty: existingLog.localNextCurriculumDirty === true,
            });
          });
          const primaryDraft = existingLog.participantResults[0] || {};
          existingLog.coachComment = primaryDraft.coachComment || "";
          existingLog.nextCurriculumId = primaryDraft.nextCurriculumId || "";
          existingLog.serverCoachComment = primaryDraft.serverCoachComment || "";
          existingLog.serverNextCurriculumId = primaryDraft.serverNextCurriculumId || "";
          existingLog.localCoachCommentDirty = primaryDraft.localCoachCommentDirty === true;
          existingLog.localNextCurriculumDirty = primaryDraft.localNextCurriculumDirty === true;
        } else {
          const primaryDraft = mergeScheduleV2CoachParticipantDraft(serverParticipantDrafts[0] || {}, {}, {
            useFallback: true,
            coachComment: existingLog.coachComment || "",
            nextCurriculumId: existingLog.nextCurriculumId || "",
            hasServerCoachComment: Object.prototype.hasOwnProperty.call(existingLog, "serverCoachComment"),
            hasServerNextCurriculumId: Object.prototype.hasOwnProperty.call(existingLog, "serverNextCurriculumId"),
            serverCoachComment: existingLog.serverCoachComment || "",
            serverNextCurriculumId: existingLog.serverNextCurriculumId || "",
            localCoachCommentDirty: existingLog.localCoachCommentDirty === true,
            localNextCurriculumDirty: existingLog.localNextCurriculumDirty === true,
          });
          existingLog.coachComment = primaryDraft.coachComment || "";
          existingLog.nextCurriculumId = primaryDraft.nextCurriculumId || "";
          existingLog.serverCoachComment = primaryDraft.serverCoachComment || "";
          existingLog.serverNextCurriculumId = primaryDraft.serverNextCurriculumId || "";
          existingLog.localCoachCommentDirty = primaryDraft.localCoachCommentDirty === true;
          existingLog.localNextCurriculumDirty = primaryDraft.localNextCurriculumDirty === true;
        }
        existingLog.member = lesson.member;
        existingLog.lesson = `${lesson.day} ${lesson.time} · ${lesson.type}`;
        if (existingLog.status === "확인 완료") existingLog.status = "확인 대기";
        existingLog.curriculumRegistered = false;
        existingLog.ticketDeducted = false;
        existingLog.serverDeducted = false;
        existingLog.serverDeductionIdempotent = false;
        existingLog.deductedSessions = Number(lesson.deductedSessions) || 0;
        existingLog.completedAt = "";
        existingLog.memberVisibleSummary = "";
        return;
      }
      const primaryDraft = serverParticipantDrafts[0] || {};
      const serverDraftFields = hasServerFeedbackDraft
        ? { participantResults: serverParticipantDrafts }
        : {};
      state.lessonLogs.unshift({
        id: `schedule-v2-lesson-${lesson.serverLessonId}`,
        serverJournalId: "",
        serverLessonId: lesson.serverLessonId,
        member: lesson.member,
        lesson: `${lesson.day} ${lesson.time} · ${lesson.type}`,
        content: "회원 운동일지 미작성 · 코치 기록으로 수업 완료 가능",
        selfMemo: "코치 코멘트와 다음 커리큘럼을 등록하면 정확한 회원권으로 차감됩니다.",
        mediaNames: [],
        mediaItems: [],
        curriculumId: "FH-01",
        nextCurriculumId: hasServerFeedbackDraft ? (primaryDraft.nextCurriculumId || "") : "FH-01",
        coachComment: hasServerFeedbackDraft ? (primaryDraft.coachComment || "") : "",
        serverCoachComment: primaryDraft.coachComment || "",
        serverNextCurriculumId: primaryDraft.nextCurriculumId || "",
        localCoachCommentDirty: false,
        localNextCurriculumDirty: false,
        ...serverDraftFields,
        validationMessage: "",
        status: "확인 대기",
        curriculumRegistered: false,
      });
    });
  state.liveMembersLoaded = true;
  state.liveLessonsLoaded = true;
  state.scheduleV2WorkspaceLoaded = true;
  state.scheduleV2SyncError = "";
  void coachScheduleRevisionWatcher?.check?.();
  return true;
}

async function saveCoachQuickAdd() {
  const draft = state.coachQuickAdd;
  const workspace = scheduleV2CoachWorkspace();
  const ticketId = $("#coachQuickAddTicket")?.value || "";
  const ticket = (workspace?.tickets || []).find((item) => item.id === ticketId);
  const note = $("#coachQuickAddNote")?.value.trim() || "";
  if (!draft || !ticket) {
    if (draft) draft.validationMessage = "회원권을 선택해 주세요.";
    renderLessonEditModal();
    return;
  }
  const duration = Number(draft.durationMinutes) || 20;
  const ticketUnit = Number(ticket.lessonMinutes) || 20;
  if (duration % ticketUnit !== 0) {
    draft.validationMessage = `${ticketUnit}분 회원권은 ${ticketUnit}분 단위로 선택해 주세요.`;
    renderLessonEditModal();
    return;
  }
  const participants = (ticket.participantUserIds || [ticket.ownerUserId])
    .filter(Boolean)
    .map((userId) => ({ userId, ticketId: ticket.id }));
  if (!participants.length) {
    draft.validationMessage = "회원권 참여자를 확인할 수 없습니다.";
    renderLessonEditModal();
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !workspace?.branchId) {
    draft.validationMessage = "서버 로그인 상태를 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  draft.validationMessage = "서버에서 시간과 회원권을 확인하고 있습니다.";
  renderLessonEditModal();
  try {
    const result = await client.rpc("tn_schedule_v2_coach_save_or_request", {
      target_branch_id: workspace.branchId,
      target_coach_role_id: draft.coachRoleId,
      target_lesson_date: draft.date,
      target_start_time: draft.time,
      target_duration_minutes: duration,
      target_schedule_kind: draft.kind,
      target_participants: participants,
      target_operation_key: coachQuickAddOperationKey(),
      target_lesson_id: null,
      target_expected_revision: null,
      target_note: note || null,
    });
    const normalized = Array.isArray(result) ? result[0] || {} : result || {};
    closeLessonEditor();
    coachScheduleV2WorkspaceCache = null;
    await syncCoachScheduleV2({ force: true });
    renderAll();
    showToast(normalized.writeMode === "approval" ? "관리자 승인 대기로 접수했습니다." : "시간표에 수업을 등록했습니다.");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "");
    const slotReasonMessages = {
      holiday_locked: "휴무일에는 관리자만 수업을 등록할 수 있습니다.",
      outside_working_hours: "등록된 근무시간 밖입니다. 운영 설정의 잠금시간 등록 허용을 확인해 주세요.",
      blocked_time: "브레이크·상담시간 수동 등록이 꺼져 있습니다.",
    };
    const slotReason = Object.keys(slotReasonMessages).find((reason) => code.includes(reason));
    const messages = {
      schedule_v2_coach_time_overlap: "같은 코치의 다른 수업과 시간이 겹칩니다.",
      schedule_v2_cross_coach_ticket_forbidden: "본인 담당 회원권만 등록할 수 있습니다.",
      schedule_v2_ticket_unavailable: "현재 사용할 수 있는 회원권이 아닙니다.",
      schedule_v2_duration_ticket_mismatch: "수업 시간과 회원권 단위가 맞지 않습니다.",
      schedule_v2_coach_write_blocked: "운영 설정에서 코치 수동 등록이 꺼져 있습니다.",
      schedule_v2_coach_slot_forbidden: "이 시간은 코치 수동 등록이 허용되지 않습니다.",
    };
    const key = Object.keys(messages).find((candidate) => code.includes(candidate));
    state.coachQuickAdd.validationMessage = slotReasonMessages[slotReason]
      || messages[key]
      || "수업을 저장하지 못했습니다. 시간표를 새로고침한 뒤 다시 시도해 주세요.";
    renderLessonEditModal();
  }
}

async function saveLessonEdit(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson) return;
  if (!canRescheduleLesson(lesson)) return;
  const targetDay = $("#editLessonDay")?.value || lesson.day;
  const targetTime = $("#editLessonTime")?.value || lesson.time;
  const targetDate = coachWeekDateForDay(targetDay);
  const reason = $("#editLessonReason")?.value.trim() || "";
  lesson.scheduleEditDraft = { day: targetDay, time: targetTime, reason };
  if (!reason) {
    lesson.validationMessage = "일정 변경 사유를 입력해 주세요.";
    renderLessonEditModal();
    return;
  }
  if (!targetDate) {
    lesson.validationMessage = "변경할 주차와 날짜를 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  if ((lesson.lessonDate ? lesson.lessonDate === targetDate : lesson.day === targetDay) && lesson.time === targetTime) {
    lesson.validationMessage = "현재 수업과 다른 날짜 또는 시간을 선택해 주세요.";
    renderLessonEditModal();
    return;
  }
  if (lesson.serverLessonId) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !client.getSession?.()?.access_token) {
      lesson.validationMessage = "서버 로그인 상태를 확인한 뒤 다시 처리해 주세요.";
      renderLessonEditModal();
      return;
    }
    lesson.validationMessage = "서버에서 일정과 정책을 확인하고 있습니다.";
    renderLessonEditModal();
    try {
      await client.rpc("tn_coach_reschedule_lesson", {
        target_lesson_id: lesson.serverLessonId,
        target_lesson_date: targetDate,
        target_start_time: targetTime,
        target_reason: reason,
      });
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
      const serverMessages = {
        coach_reschedule_reason_required: "변경 사유를 2자 이상 입력해 주세요.",
        coach_reschedule_future_time_required: "이미 지난 시간으로는 변경할 수 없습니다.",
        assigned_coach_required: "본인이 담당하는 수업만 변경할 수 있습니다.",
        lesson_not_changeable: "예정 상태인 수업만 변경할 수 있습니다.",
        coach_not_working: "선택한 시간은 코치 근무시간이 아닙니다.",
        target_time_blocked: "운영 중지 시간으로 변경할 수 없습니다. 근무시간 안의 브레이크 시간은 변경할 수 있습니다.",
        target_time_occupied: "선택한 시간에 이미 수업이 있습니다.",
        target_date_outside_ticket: "회원권 이용기간 밖의 날짜입니다.",
        schedule_scope_mismatch: "평일권과 주말권의 이용 가능 요일을 확인해 주세요.",
        daily_session_limit: "회원권의 하루 이용 가능 횟수를 초과합니다.",
        weekly_session_limit: "회원권의 주간 이용 가능 횟수를 초과합니다.",
        weekly_booking_day_limit: "회원권의 주간 예약 가능 일수를 초과합니다.",
      };
      lesson.validationMessage = serverMessages[code] || "일정 변경에 실패했습니다. 시간표와 회원권 상태를 확인해 주세요.";
      renderLessonEditModal();
      return;
    }
  }
  const lessonUpdates = {
    lessonDate: targetDate,
    day: targetDay,
    time: targetTime,
    type: String(lesson.type || "").replace(/^정규/, "코치변경"),
    source: "coach_change",
    task: "변경된 일정 수업 후 기록",
    validationMessage: "",
  };
  delete lesson.scheduleEditDraft;
  Object.assign(lesson, lessonUpdates);
  const liveLesson = state.liveLessons.find((item) => item.serverLessonId && item.serverLessonId === lesson.serverLessonId);
  if (liveLesson) Object.assign(liveLesson, lessonUpdates);
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  closeLessonEditor();
  renderAll();
}
