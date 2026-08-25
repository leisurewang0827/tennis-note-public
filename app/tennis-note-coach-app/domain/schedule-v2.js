// 새 시간표(v2) 서버 형식을 코치앱 형식으로 바꾸는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function serverLessonStatusLabel(status = "") {
  return {
    scheduled: "예정",
    pending_change: "변경 요청",
    completed: "완료",
    cancelled: "취소",
    no_show: "노쇼",
  }[status] || status || "예정";
}

function scheduleV2LessonKindLabel(kind = "") {
  return {
    regular: "정규",
    makeup: "보강",
    coupon: "쿠폰",
    one_day: "원데이",
    correction: "관리자 보정",
  }[String(kind || "").toLowerCase()] || "수업";
}

function scheduleV2CoachLesson(lesson = {}, workspace = {}) {
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const ticketsById = new Map((workspace.tickets || []).map((ticket) => [ticket.id, ticket]));
  const participants = Array.isArray(lesson.participants) ? lesson.participants : [];
  const participantNames = participants
    .map((participant) => normalizeCoachScheduleMemberName(participant.name, ""))
    .filter(Boolean);
  const primaryTicket = ticketsById.get(participants[0]?.ticketId) || {};
  const laneCoach = coachesById.get(lesson.coachRoleId) || {};
  const substitute = lesson.substitute && lesson.substitute.coachRoleId ? lesson.substitute : null;
  const lessonDate = String(lesson.lessonDate || "");
  const dayIndex = lessonDate ? new Date(`${lessonDate}T00:00:00`).getDay() : 1;
  const durationMinutes = Math.max(10, Number(lesson.durationMinutes) || 20);
  const kind = String(lesson.scheduleKind || "regular");
  const participantDeductions = participants.map((participant) => Number(participant.deductedSessions) || 0);
  const deductedSessions = participantDeductions.length ? Math.max(...participantDeductions) : 0;
  const permissions = lesson.permissions && typeof lesson.permissions === "object" ? lesson.permissions : {};
  return {
    id: `server-${lesson.id}`,
    serverLessonId: lesson.id,
    serverRevision: Number(lesson.revision) || 0,
    lessonDate,
    day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
    time: String(lesson.startTime || "").slice(0, 5),
    coach: substitute?.coachName || laneCoach.name || "담당 코치",
    coachRoleId: lesson.coachRoleId,
    originalCoachRoleId: substitute ? lesson.coachRoleId : "",
    originalCoach: substitute ? (laneCoach.name || "담당 코치") : "",
    isSubstitute: Boolean(substitute),
    substituteCoachRoleId: substitute?.coachRoleId || "",
    substituteSettlementMode: substitute?.settlementMode || "",
    member: participantNames.join("&") || "회원",
    memberUserIds: participants.map((participant) => participant.userId).filter(Boolean),
    v2Participants: participants.map((participant) => {
      const ticket = ticketsById.get(participant.ticketId) || {};
      return {
        userId: participant.userId,
        ticketId: participant.ticketId,
        name: normalizeCoachScheduleMemberName(participant.name),
        recordStatus: participant.recordStatus || "",
        outcome: participant.outcome || "",
        deductedSessions: Number(participant.deductedSessions) || 0,
        coachComment: participant.coachComment || "",
        nextCurriculumRefId: participant.nextCurriculumRefId || "",
        nextCurriculumId: participant.nextCurriculumSkillLabel || "",
        nextCurriculumTitle: participant.nextCurriculumTitle || "",
        finalizedAt: participant.finalizedAt || "",
        updatedAt: participant.updatedAt || "",
        ticketName: ticket.productName || `${scheduleV2LessonKindLabel(kind)} 회원권`,
        totalSessions: Number(ticket.totalSessions) || 0,
        usedSessions: Number(ticket.usedSessions) || 0,
        remainingSessions: Number(ticket.remainingSessions) || 0,
      };
    }),
    v2Permissions: {
      canProcess: permissions.canProcess === true,
      canEdit: permissions.canEdit === true,
      isOwnLane: permissions.isOwnLane === true,
      isSubstitute: permissions.isSubstitute === true,
    },
    type: `${scheduleV2LessonKindLabel(kind)} ${durationMinutes}분`,
    lessonSource: kind,
    durationMinutes,
    ticketLessonMinutes: Number(primaryTicket.lessonMinutes) || durationMinutes,
    ticketId: primaryTicket.id || participants[0]?.ticketId || "",
    totalSessions: Number(primaryTicket.totalSessions) || 0,
    usedSessions: Number(primaryTicket.usedSessions) || 0,
    ticket: primaryTicket.productName || `${scheduleV2LessonKindLabel(kind)} 회원권`,
    status: serverLessonStatusLabel(lesson.status),
    serverStatus: lesson.status,
    remaining: Number(primaryTicket.remainingSessions) || 0,
    deductedSessions,
    task: lesson.status === "pending_change" ? "변경 요청 확인" : "수업 후 코멘트/다음 커리큘럼",
  };
}

function scheduleV2CoachParticipantResults(lesson = {}) {
  return (lesson.v2Participants || []).map((participant) => ({
    userId: participant.userId,
    ticketId: participant.ticketId,
    name: participant.name,
    ticketName: participant.ticketName,
    totalSessions: participant.totalSessions,
    usedSessions: participant.usedSessions,
    remainingSessions: participant.remainingSessions,
    recordStatus: participant.recordStatus || "",
    coachComment: participant.coachComment || "",
    nextCurriculumId: canonicalCurriculumId(participant.nextCurriculumId),
    finalizedAt: participant.finalizedAt || "",
    updatedAt: participant.updatedAt || "",
    serverCoachComment: participant.coachComment || "",
    serverNextCurriculumId: canonicalCurriculumId(participant.nextCurriculumId),
  }));
}

function mergeScheduleV2CoachParticipantDraft(serverDraft = {}, localDraft = {}, fallback = {}) {
  const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);
  const useFallback = fallback.useFallback === true;
  const hasLocalComment = hasOwn(localDraft, "coachComment") || useFallback;
  const hasLocalCurriculum = hasOwn(localDraft, "nextCurriculumId") || useFallback;
  const localComment = hasOwn(localDraft, "coachComment")
    ? localDraft.coachComment || ""
    : useFallback ? fallback.coachComment || "" : "";
  const localCurriculumId = hasOwn(localDraft, "nextCurriculumId")
    ? localDraft.nextCurriculumId || ""
    : useFallback ? fallback.nextCurriculumId || "" : "";
  const hasPreviousServerComment = hasOwn(localDraft, "serverCoachComment")
    || (useFallback && fallback.hasServerCoachComment === true);
  const hasPreviousServerCurriculum = hasOwn(localDraft, "serverNextCurriculumId")
    || (useFallback && fallback.hasServerNextCurriculumId === true);
  const previousServerComment = hasOwn(localDraft, "serverCoachComment")
    ? localDraft.serverCoachComment || ""
    : useFallback ? fallback.serverCoachComment || "" : "";
  const previousServerCurriculumId = hasOwn(localDraft, "serverNextCurriculumId")
    ? localDraft.serverNextCurriculumId || ""
    : useFallback ? fallback.serverNextCurriculumId || "" : "";
  const serverComment = serverDraft.coachComment || "";
  const serverCurriculumId = canonicalCurriculumId(serverDraft.nextCurriculumId);
  const localCommentChanged = localDraft.localCoachCommentDirty === true
    || (useFallback && fallback.localCoachCommentDirty === true)
    || (hasLocalComment && (
      hasPreviousServerComment
        ? localComment !== previousServerComment
        : Boolean(localComment)
    ));
  const localCurriculumChanged = localDraft.localNextCurriculumDirty === true
    || (useFallback && fallback.localNextCurriculumDirty === true)
    || (hasLocalCurriculum && (
      hasPreviousServerCurriculum
        ? localCurriculumId !== previousServerCurriculumId
        : Boolean(localCurriculumId)
    ));
  const preserveLocalComment = localCommentChanged && localComment !== serverComment;
  const preserveLocalCurriculum = localCurriculumChanged && localCurriculumId !== serverCurriculumId;
  return {
    ...localDraft,
    ...serverDraft,
    coachComment: preserveLocalComment ? localComment : serverComment,
    nextCurriculumId: preserveLocalCurriculum ? localCurriculumId : serverCurriculumId,
    serverCoachComment: serverComment,
    serverNextCurriculumId: serverCurriculumId,
    localCoachCommentDirty: preserveLocalComment,
    localNextCurriculumDirty: preserveLocalCurriculum,
  };
}

function scheduleV2CoachOneDayLesson(booking = {}, workspace = {}) {
  const coach = (workspace.coaches || []).find((item) => item.roleId === booking.coach_role_id) || {};
  const lessonDate = String(booking.booking_date || "");
  const dayIndex = lessonDate ? new Date(`${lessonDate}T00:00:00`).getDay() : 1;
  return {
    id: `one-day-${booking.id}`,
    serverOneDayBookingId: booking.id,
    oneDayBooking: true,
    lessonDate,
    day: scheduleDays[dayIndex === 0 ? 6 : dayIndex - 1],
    time: String(booking.start_time || "").slice(0, 5),
    coach: coach.name || "담당 코치",
    coachRoleId: booking.coach_role_id,
    member: booking.guest_name || "원데이",
    memberUserIds: [],
    type: `원데이 ${Number(booking.duration_minutes) || 20}분`,
    lessonSource: "one_day",
    durationMinutes: Number(booking.duration_minutes) || 20,
    ticketLessonMinutes: Number(booking.duration_minutes) || 20,
    ticketId: "",
    totalSessions: 0,
    usedSessions: 0,
    ticket: "원데이",
    status: booking.status === "completed" ? "원데이 완료" : booking.status === "checked_in" ? "방문" : "원데이 예약",
    serverStatus: booking.status,
    remaining: 0,
    task: "원데이 예약",
  };
}
