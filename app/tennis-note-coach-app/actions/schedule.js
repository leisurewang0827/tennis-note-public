// 시간표를 고치고 수업을 추가하는 함수들.
//
// 코치가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachLessonLogHasUnsyncedDraft(log = {}) {
  const participantDraftDirty = (Array.isArray(log.participantResults) ? log.participantResults : []).some((result) => (
    result?.localCoachCommentDirty === true
    || result?.localNextCurriculumDirty === true
  ));
  return ["동기화 대기", "동기화 실패"].includes(log.status)
    || log.localCoachCommentDirty === true
    || log.localNextCurriculumDirty === true
    || participantDraftDirty;
}

function coachPendingAuthorityReady() {
  const authority = state.pendingLessonAuthority;
  if (!authority || Number(authority.version) !== coachPendingAuthorityVersion) return false;
  if (String(authority.profileId || "") !== String(state.liveProfileId || "")) return false;
  if (String(authority.coachRoleId || "") !== currentCoachRoleId()) return false;
  if (String(authority.branchId || "") !== String(state.coach?.branchId || "")) return false;
  return Array.isArray(authority.lessonIds);
}

function coachAuthoritativePendingLessonIds() {
  if (!coachPendingAuthorityReady()) return null;
  return new Set(state.pendingLessonAuthority.lessonIds.map((id) => String(id || "")).filter(Boolean));
}

function coachPendingAuthorityWindow(workspace = {}, today = new Date()) {
  const todayKey = localDateKey(today);
  const cutoffDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const cutoffKey = localDateKey(cutoffDate);
  const from = String(workspace.from || "");
  const to = String(workspace.to || "");
  return {
    ready: Boolean(from && to && from <= cutoffKey && to >= todayKey),
    from: cutoffKey,
    to: todayKey,
  };
}

function reconcileCoachPendingCacheAfterServerReadback(workspace = {}, mappedLessons = [], previousLiveLessonsById = new Map()) {
  const window = coachPendingAuthorityWindow(workspace);
  if (!window.ready || !state.liveProfileId || !currentCoachRoleId() || !state.coach?.branchId) return false;
  const lessonsById = new Map(mappedLessons.map((lesson) => [String(lesson.serverLessonId || ""), lesson]));
  const pendingLessonIds = mappedLessons
    .filter((lesson) => (
      lesson.serverStatus === "scheduled"
      && lesson.lessonDate >= window.from
      && lesson.lessonDate <= window.to
      && lesson.v2Permissions?.canProcess === true
      && Array.isArray(lesson.v2Participants)
      && lesson.v2Participants.length > 0
      && !lesson.v2Participants.every((participant) => participant.recordStatus === "final")
    ))
    .map((lesson) => String(lesson.serverLessonId || ""))
    .filter(Boolean);

  state.pendingLessonAuthority = {
    version: coachPendingAuthorityVersion,
    profileId: String(state.liveProfileId || ""),
    coachRoleId: currentCoachRoleId(),
    branchId: String(state.coach.branchId || ""),
    from: window.from,
    to: window.to,
    lessonIds: [...new Set(pendingLessonIds)],
    syncedAt: new Date().toISOString(),
  };

  if (Number(state.pendingAuthorityCacheVersion) >= coachPendingAuthorityVersion) return true;
  state.lessonLogs = state.lessonLogs.filter((log) => {
    const serverLessonId = String(log.serverLessonId || "");
    if (!serverLessonId || coachLessonLogHasUnsyncedDraft(log)) return true;
    const currentLesson = lessonsById.get(serverLessonId);
    if (currentLesson) return true;
    const previousLesson = previousLiveLessonsById.get(serverLessonId);
    const previousDate = String(previousLesson?.lessonDate || log.lessonDate || "");
    if (!previousDate || previousDate < String(workspace.from || "") || previousDate > String(workspace.to || "")) return true;
    return false;
  });
  state.pendingAuthorityCacheVersion = coachPendingAuthorityVersion;
  return true;
}

function applyScheduleV2CoachWorkspace(workspace = {}, oneDayRows = [], roster = null, legacyChangeRequests = []) {
  if (!workspace?.branchId || !Array.isArray(workspace.lessons)) return false;
  const previousLiveLessonsById = new Map((state.liveLessons || []).map((lesson) => [String(lesson.serverLessonId || ""), lesson]));
  const cancelledLessonIds = new Set(
    workspace.lessons
      .filter((lesson) => String(lesson.status || "").toLowerCase() === "cancelled")
      .map((lesson) => String(lesson.id || "").trim())
      .filter(Boolean),
  );
  if (cancelledLessonIds.size) {
    state.lessonLogs = state.lessonLogs.filter((log) => (
      !cancelledLessonIds.has(String(log.serverLessonId || ""))
      || coachLessonLogHasUnsyncedDraft(log)
    ));
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
  reconcileCoachPendingCacheAfterServerReadback(workspace, mappedLessons, previousLiveLessonsById);

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
      expired: window.TennisNoteTicketState?.label(ticket, todayIso) || "상태 확인 필요",
      attention: "상태 확인 필요",
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
  if (lesson.scheduleEditInFlight) return;
  if (!canRescheduleLesson(lesson)) return;
  if (normalCoachAssignedMove.active(lesson) && await normalCoachAssignedMove.save(lesson)) return;
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
    lesson.scheduleEditInFlight = true;
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
      lesson.scheduleEditInFlight = false;
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
    scheduleEditInFlight: false,
  };
  delete lesson.scheduleEditDraft;
  Object.assign(lesson, lessonUpdates);
  const liveLesson = state.liveLessons.find((item) => item.serverLessonId && item.serverLessonId === lesson.serverLessonId);
  if (liveLesson) Object.assign(liveLesson, lessonUpdates);
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  closeLessonEditor();
  renderAll();
}

function captureLessonTabInputs(lesson) {
  const panel = $('#lessonEditModalContent [data-lesson-tab-panel="feedback"]');
  if (panel && !panel.hidden) {
    lesson.feedbackTabInputs = [...panel.querySelectorAll("input,textarea,select")].map((node) => ({ value: node.value, checked: node.checked }));
    if (!lessonChartFinalized(lesson)) captureLessonChartDraft(lesson.id);
  }
  if (lesson.selectedSecondaryAction === "schedule" && $("#editLessonDay")) {
    lesson.scheduleEditDraft = { day: $("#editLessonDay").value, time: $("#editLessonTime").value, reason: $("#editLessonReason").value };
  }
  if ($("#coachAttendanceReason")) lesson.attendanceChoice = { ...(lesson.attendanceChoice || {}), reason: $("#coachAttendanceReason").value };
}

// Bundled in the normal schedule module. Server authority, not a query parameter or a UI tag.
// Session/branch eligibility comes from the authenticated product client, not URL values.
const normalCoachLease = (() => {
  const goodHost=()=>window.location.origin==="https://tennisnote-app-dev.pages.dev" &&
    window.TENNISNOTE_CONFIG?.environment==="development" &&
    window.TENNISNOTE_CONFIG.projectFingerprint==="63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
  const key=()=>[state.liveProfileId,currentCoachRoleId(),state.coach?.branchId].every(Boolean)
    ?[state.liveProfileId,currentCoachRoleId(),state.coach.branchId].join("/"):"";
  let last=null;
  const status=(s)=>{const b=document.querySelector("#fullScheduleBoard");if(b)b.dataset.qaAssignmentStatus=s;};
  async function inspect(force=false) {
    if(!goodHost()||!key())return "ordinary";
    const actor=key();
    if(last?.actor===actor && (!last.done || (!force && Date.now()<last.until)))return last.promise;
    const r={actor,done:false,until:Date.now()+15000};last=r;
    r.promise=(async()=>{
      try {
        const rpc=(n,a)=>window.TennisNoteDataClient.rpc(n,a);
        const w=await rpc("tn_dev_normal_coach_work",{});if(last!==r||key()!==actor)return "blocked";
        if(w?.eligible===false && w.assigned===false){status("ordinary");return "ordinary";}
        if(w?.eligible!==true || [w.self?.actorId,w.self?.coachRoleId,w.self?.branchId].join("/")!==actor){
          status("mismatch");return "blocked";}
        if(w.assigned===false){status("eligible-unassigned");return "eligible-unassigned";}
        if(w.assigned!==true||typeof w.observed!=="boolean"||!/^([a-f0-9]{8})-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(w.operation))throw Error();
        if(!w.observed && await rpc("tn_dev_normal_observe_work",{target_operation:w.operation})!==true)throw Error();
        if(last!==r||key()!==actor)return "blocked";
        status("eligible-bound");return "assigned";
      }catch{status("unverified");return "blocked";}
      finally{r.done=true;}
    })();
    return r.promise;
  }
  function enter(){if(goodHost() && document.querySelector("#fullScheduleView.is-active"))void inspect();}
  return Object.freeze({goodHost,inspect,enter});
})();

const normalCoachAssignedMove = (() => {
  const enabled=normalCoachLease.goodHost;
  const uuid = s => typeof s === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
  const day = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const time = s => typeof s === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
  const cache = new WeakMap();
  const active = l => enabled() || (!!cache.get(l) && cache.get(l).mode!=="ordinary");
  const roster = rows => Array.isArray(rows) && rows.length >= 1 && rows.length <= 2
    && rows.every(p => uuid(p?.userId) && uuid(p?.ticketId))
    && new Set(rows.map(p=>p.userId)).size===rows.length && new Set(rows.map(p=>p.ticketId)).size===rows.length
    ? JSON.stringify(rows.map(p=>[p.userId,p.ticketId]).sort()) : "";
  function matches(l,s) {
    return enabled() && s?.status === "assigned" && uuid(s.lessonId) && s.lessonId === l.serverLessonId
      && uuid(s.actorId) && s.actorId === state.liveProfileId && uuid(s.branchId) && s.branchId === state.coach?.branchId
      && uuid(s.coachRoleId) && s.coachRoleId === currentCoachRoleId() && s.coachRoleId === l.coachRoleId
      && !l.isSubstitute && !l.substituteCoachRoleId && l.serverStatus === "scheduled"
      && ["regular","group","coupon"].includes(s.kind) && roster(s.participants) !== ""
      && s.participants.length === (s.kind==="group"?2:1) && roster(s.participants) === roster(l.v2Participants)
      && Number.isSafeInteger(s.revision) && s.revision === l.serverRevision
      && day(s.fromDay) && time(s.fromTime) && l.lessonDate===s.fromDay && l.time===s.fromTime
      && day(s.toDay) && time(s.toTime) && (s.toDay!==s.fromDay || s.toTime!==s.fromTime)
      && uuid(s.operationKey) && Number.isFinite(Date.parse(s.expiresAt)) && Date.parse(s.expiresAt)>Date.now();
  }
  function paint(l) { if (state.editingLessonId===l.id) renderLessonEditModal(); }
  async function open(l) {
    if (!enabled() || !l?.serverLessonId) return;
    const prev=cache.get(l); if (prev?.busy || prev?.uncertain) return;
    const rec={mode:"checking"}; cache.set(l,rec);
    try {
      const mode=await normalCoachLease.inspect(true);
      if(cache.get(l)!==rec)return;
      if(mode==="ordinary"){rec.mode="ordinary";paint(l);return;}
      if(mode==="blocked"){rec.mode="blocked";paint(l);return;}
      const s=await window.TennisNoteDataClient.rpc("tn_dev_normal_assigned_time_scope",{target_lesson_id:l.serverLessonId});
      if(cache.get(l)!==rec)return;
      if(s?.status==="ordinary" && s.lessonId===l.serverLessonId) rec.mode="ordinary";
      else if(matches(l,s)){rec.mode="assigned"; rec.s=s;}
      else rec.mode="blocked";
    } catch {rec.mode="blocked";}
    paint(l);
  }
  function panel(l) {
    const rec=cache.get(l);
    if(!rec || rec.mode==="ordinary")return null;
    if(rec.mode==="checking")return '<p role="status">시험 수업 배정을 확인하고 있습니다.</p>';
    if(rec.mode!=="assigned" || (!rec.uncertain && !matches(l,rec.s)))return '<p role="status">배정을 확인할 수 없어 저장하지 않았습니다. 수업 상세를 다시 열어 주세요.</p>';
    const s=rec.s;
    // Dates and times must be validated before being rendered; no server labels or member data interpolated.
    return '<div class="lesson-edit-mini"><strong>일정 변경</strong><p>지정 시험 수업 · '+s.fromDay+' '+s.fromTime+' → '+s.toDay+' '+s.toTime+'</p>'
      +'<p>수업 시간만 바뀌며, 이 변경으로 회차를 차감하지 않습니다.</p>'
      +'<label>변경 사유<input id="exactTimeReason" maxlength="200"></label>'
      +'<label><input type="checkbox" id="exactTimeAgreed">참가 회원 '+s.participants.length+'명 전원과 이 시간에 합의했습니다.</label>'
      +'<p role="status" id="exactTimeMessage"></p><button type="button" class="small-button" data-back-lesson-actions="'+escapeHtml(l.id)+'">돌아가기</button> '
      +'<button type="button" class="approve-button" data-save-schedule-edit="'+escapeHtml(l.id)+'" '+(rec.busy?'disabled':'')+'>'
      +(rec.uncertain?'저장 결과 확인':'일정 변경 확인')+'</button></div>';
  }
  async function save(l) {
    const r=cache.get(l);
    if(!enabled())return !!r && r.mode!=="ordinary";
    if(!l?.serverLessonId && !r)return false;
    if(r?.mode==="ordinary" && enabled())return false;
    if(!r || r.mode!=="assigned" || !enabled() || r.busy)return true;
    const s=r.s, rpc=(n,a)=>window.TennisNoteDataClient.rpc(n,a);
    if(!r.uncertain && !matches(l,s)){r.mode="blocked";paint(l);return true;}
    if(!r.uncertain) {
      const reason=($("#exactTimeReason")?.value||"").trim();
      if($("#exactTimeAgreed")?.checked!==true || reason.length<2 || reason.length>200){
        l.validationMessage="변경 사유와 참가 회원 전원의 합의를 확인해 주세요.";
        const msg=$("#exactTimeMessage"); if(msg)msg.textContent=l.validationMessage;return true;
      }
      r.reason=reason;
    }
    // A lost response can only trigger a read. Never dispatch the ordinary save, even on error.
    r.busy=true;
    try {
      if(!r.uncertain) {
        r.uncertain=true;
        await rpc("tn_dev_normal_assigned_time_save",{target_lesson_id:s.lessonId,target_operation_id:s.operationKey,
          target_lesson_date:s.toDay,target_start_time:s.toTime,target_expected_revision:s.revision,
          target_reason:r.reason,target_member_agreed:true,target_agreed_participants:s.participants.map(p=>({userId:p.userId,ticketId:p.ticketId}))});
      }
      const v=await rpc("tn_lesson_time_change_state",{target_lesson_id:s.lessonId});
      if(v?.lessonId!==s.lessonId || v.branchId!==s.branchId || v.coachRoleId!==s.coachRoleId || v.status!=="scheduled"
        || v.lessonDate!==s.toDay || String(v.startTime).slice(0,5)!==s.toTime || !(v.revision>s.revision)
        || roster(v.participants)!==roster(s.participants) || !v.history?.some(x=>x.id===s.operationKey && x.toDate===s.toDay && String(x.toTime).slice(0,5)===s.toTime))
        throw Error("unconfirmed");
      if(await syncCoachScheduleV2({force:true})!==true)throw Error("readback");
      r.uncertain=false;r.mode="done";l.validationMessage="같은 수업의 변경 결과를 확인했습니다.";
      if(state.editingLessonId===l.id)closeLessonEditor();renderAll();
    } catch { l.validationMessage="저장 결과를 확인하지 못했습니다. 다시 저장하지 말고 결과를 조회해 주세요."; }
    finally {r.busy=false;paint(l);}
    return true;
  }
  return Object.freeze({open,panel,save,active});
})();
