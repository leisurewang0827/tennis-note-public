// 수업기록·운동노트·보강 값 판정을 하는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberRecordsForReference(memberReference, allMembers = members) {
  if (memberReference && typeof memberReference === "object") return [memberReference];
  const names = splitMemberNames(memberReference);
  return allMembers.filter((member) => names.includes(member.name));
}

function memberDatabaseRecord(member = null, ticket = null, allLiveData = adminLiveDataState) {
  const records = allLiveData.memberDatabaseRecords || [];
  const membershipRecords = allLiveData.memberMembershipRecords || [];
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  const userIds = memberServerUserIds(member).map(String);
  if (ticketId) {
    return membershipRecords.find((record) => (
      String(record.ticket_id || "") === ticketId
      && userIds.includes(String(record.user_id || ""))
    ))
      || records.find((record) => (
        String(record.current_ticket_id || "") === ticketId
        && userIds.includes(String(record.user_id || ""))
      ))
      || null;
  }
  if (member?.memberRecord) return member.memberRecord;
  const userRecord = records.find((record) => record.user_id === member?.serverUserId);
  if (userRecord) return userRecord;
  return null;
}

function memberManagementRecordNumber(value) {
  return value === null || value === undefined || value === "" ? "미입력" : Number(value).toLocaleString("ko-KR");
}

function recordStatusBadge(record) {
  if (record.priority === "urgent") return badge("danger", record.statusLabel || "긴급");
  const statusTone = {
    pending: "pending",
    feedback: "requested",
    done: "confirmed",
    issue: "attention",
  };
  return badge(statusTone[record.group] || "neutral", record.statusLabel);
}

function legacyNoteRecord(note) {
  const done = note.status === "confirmed";
  return {
    id: `legacy-note-${note.id}`,
    group: done ? "done" : "feedback",
    source: "관리자 샘플",
    member: note.member,
    title: note.lesson,
    detail: note.reflection,
    subDetail: note.next,
    statusLabel: done ? "완료" : "처리 필요",
    actionLabel: done ? "기록 보기" : "피드백 작성",
    lessonId: note.serverLessonId || "",
    actionable: !done && Boolean(note.serverLessonId),
  };
}

function pendingLessonRecord(lesson, participant = null) {
  const endedAt = lessonEndTimestamp(lesson);
  const writingDelayed = endedAt > 0 && Date.now() - endedAt > 24 * 60 * 60 * 1000;
  const processingState = adminLessonProcessingState(lesson, []);
  return {
    id: `pending-lesson-${lesson.serverLessonId}-${participant?.userId || "all"}`,
    group: "feedback",
    source: "피드백 미작성",
    member: participant?.name || lesson.member || "회원 확인 필요",
    title: `${lesson.lessonDate || "수업일"} ${lesson.time || ""} · ${getCoachName(lesson.coachId)}`.trim(),
    detail: `${lesson.type || "수업"} ${lesson.durationMinutes || 20}분 · ${writingDelayed ? "수업 종료 후 24시간 초과" : "정상 작성 대기"}`,
    subDetail: "최종 저장 전까지 회원권 차감은 실행되지 않습니다.",
    statusLabel: processingState.label,
    actionLabel: processingState.actionLabel,
    lessonId: lesson.serverLessonId,
    actionable: true,
    priority: writingDelayed ? "high" : "normal",
    urgentReason: "",
    sortAt: endedAt ? new Date(endedAt).toISOString() : `${lesson.lessonDate || ""}T${lesson.time || "00:00"}:00`,
  };
}

function memberJournalRecord(entry, context = null, allLiveData = adminLiveDataState) {
  const memberName = context?.userNameById.get(String(entry.user_id || ""));
  const member = memberName ? { name: memberName } : (allLiveData.users || []).find((user) => user.id === entry.user_id);
  const mediaCount = context
    ? context.mediaCountByJournalId.get(String(entry.id || "")) || 0
    : (allLiveData.mediaFiles || []).filter((media) => media.journal_entry_id === entry.id).length;
  const linkedRecord = context
    ? context.lessonRecordByLessonId.get(String(entry.lesson_id || ""))
      || (context.participantRecordsByLessonId.get(String(entry.lesson_id || "")) || [])
        .find((record) => record.record_status === "final")
    : (allLiveData.lessonRecords || []).find((record) => record.lesson_id === entry.lesson_id);
  const entryLabel = entry.entry_type === "lesson" ? "레슨" : "개인운동";
  return {
    id: `journal-${entry.id}`,
    group: "feedback",
    source: "회원 피드",
    member: member?.name || "회원 확인 필요",
    title: `${entry.entry_date || "날짜 미정"} ${entryLabel}`,
    detail: journalBodySummary(entry.body),
    subDetail: `${mediaCount ? `사진·영상 ${mediaCount}개` : "첨부 없음"}${linkedRecord ? " · 코치 기록 완료" : ""}`,
    statusLabel: linkedRecord ? "피드 확인됨" : "새 피드",
    actionLabel: mediaCount ? "첨부 보기" : "확인",
    journalId: entry.id,
    mediaCount,
    priority: "normal",
    sortAt: entry.updated_at || entry.created_at || `${entry.entry_date || ""}T00:00:00`,
  };
}

function lessonLogRecord(log) {
  const done = log.status === "confirmed";
  const hasIssue = done && (!log.coachComment || !(log.nextCurriculumId || log.curriculumId || log.curriculum?.id));
  return {
    id: log.id || `lesson-log-${log.member}-${log.submittedAt || Date.now()}`,
    group: hasIssue ? "issue" : done ? "done" : "feedback",
    source: "회원/코치 기록",
    member: log.member || "회원",
    title: log.lessonLabel || log.lesson || `${log.date || ""} 수업`,
    detail: log.content || log.selfMemo || "회원 운동일지 또는 코치 완료 처리 확인",
    subDetail: log.coachComment ? `코치 코멘트: ${log.coachComment}` : "코치 코멘트 미등록",
    statusLabel: hasIssue ? "확인 필요" : done ? "완료" : "처리 필요",
    actionLabel: hasIssue ? "최신 상태 다시 확인" : done ? "기록 보기" : "피드백 작성",
    priority: hasIssue ? "urgent" : !done ? "high" : "normal",
    urgentReason: hasIssue ? "코멘트 또는 다음 커리큘럼 누락을 확인해야 합니다." : "",
    sortAt: log.completedAt || log.submittedAt || log.updatedAt || log.date || "",
  };
}

function feedbackRecord(request) {
  const done = request.status === "코치 답변 완료";
  return {
    id: request.id || `feedback-${request.member}-${request.date || Date.now()}`,
    group: done ? "done" : "feedback",
    source: "운동노트 피드백",
    member: request.member || "회원",
    title: `${request.date || "날짜 미정"} 사진/영상 피드백`,
    detail: request.question || request.memo || "코치 코멘트 요청",
    subDetail: request.coachFeedback ? `답변: ${request.coachFeedback}` : "코치 답변 대기",
    statusLabel: done ? "답변 완료" : "피드백 대기",
    actionLabel: done ? "완료" : "코치앱 답변",
    priority: done ? "normal" : "high",
    sortAt: request.updatedAt || request.createdAt || request.date || "",
  };
}

function lessonRecordErrorMessage(error) {
  let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
  if (typeof code === "string" && code.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(code);
      code = parsed.message || parsed.code || code;
    } catch {
      // Keep the server message when it is not valid JSON.
    }
  }
  return ({
    lesson_complete_comment_too_short: "코치 코멘트는 5자 이상 작성해 주세요.",
    lesson_complete_comment_too_generic: "짧은 칭찬이나 확인 문구 대신 이번 수업 내용을 작성해 주세요.",
    lesson_complete_comment_recent_duplicate: "최근 수업과 같은 코멘트입니다. 이번 수업 내용을 새로 작성해 주세요.",
    lesson_complete_forbidden: "이 수업을 처리할 권한이 없습니다.",
    lesson_complete_status_invalid: "이미 완료·취소된 수업입니다. 새로고침 후 확인해 주세요.",
    lesson_complete_ticket_unavailable: "사용 가능한 회원권 횟수가 없습니다.",
  })[code] || "서버 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.";
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function operationBranchRecords(source = []) {
  const lessonsById = new Map();
  lessons.forEach((lesson) => {
    if (lesson.id) lessonsById.set(String(lesson.id), lesson);
    if (lesson.serverLessonId) lessonsById.set(String(lesson.serverLessonId), lesson);
  });
  const allowedMemberNames = new Set(operationBranchMembers(members).map((member) => member.name));
  return source.filter((record) => {
    if (record.branchId) return matchesActiveOperationBranch(record.branchId);
    const lessonId = record.serverLessonId || record.lessonId;
    const lesson = lessonId ? lessonsById.get(String(lessonId)) : null;
    if (lesson) return matchesActiveOperationBranch(lesson.branchId);
    const memberNames = splitMemberNames(record.member || "");
    if (memberNames.length) {
      return memberNames.some((name) => allowedMemberNames.has(name));
    }
    return operationBranchAllowsLegacyRows();
  });
}

function getAdminTasks() {
  const shared = operationalSharedData();
  const pendingLessonLogs = shared.lessonLogs.filter((log) => log.status !== "confirmed");
  const pendingFeedbacks = shared.feedbackRequests.filter((item) => item.status !== "코치 답변 완료");
  const branchTickets = operationBranchTickets();
  const branchBillings = operationBranchBillings();
  const lowTickets = branchTickets.filter((ticket) => ticket.remaining <= 2);
  const paymentAttemptEntries = groupedBillingAttempts(branchBillings);
  const paymentChecks = paymentAttemptEntries.filter((entry) => (
    ["check", "unverified"].includes(entry.primary.status) || isStaleReadyPayment(entry.primary)
  ));
  const draftBillings = paymentAttemptEntries.filter((entry) => entry.primary.status === "draft");
  const paymentDataErrors = paymentAttemptEntries.filter((entry) => paymentRequiresTicketRepair(entry.primary));
  const urgentMakeups = operationBranchMakeupRequests()
    .filter((item) => item.status === "coach_required" || item.status === "requested")
    .concat(shared.makeupRequests.filter((item) => item.status === "승인 대기"));
  const unassignedTickets = unassignedRegularTickets();
  const couponNoBookingTickets = couponTicketsWithoutUpcomingLesson();

  const tasks = [
    ...paymentDataErrors.map((entry) => ({
      type: "결제오류",
      title: `${entry.primary.member} 회원권 연결 누락`,
      detail: `${entry.primary.item} · ${money.format(entry.primary.amount)}원 · 서버 결제 확인 필요${entry.attemptCount > 1 ? ` · 동일 요청 ${entry.attemptCount}회` : ""}`,
      tone: "danger",
      action: "결제 확인",
      view: "billing",
      dueAt: entry.primary.verifiedAt || entry.primary.paidAt || entry.primary.requestedAt || "",
    })),
    ...unassignedTickets.map((ticket) => ({
      type: "긴급",
      title: `${ticketParticipantNames(ticket).join(" & ") || ticket.member} 정규시간 미배정`,
      detail: `${ticket.product} · ${getCoachName(ticket.coachId) || "담당 코치 미배정"}`,
      tone: "danger",
      action: "시간표 배정",
      view: "schedule",
      scheduleTicketId: ticket.id,
    })),
    ...couponNoBookingTickets.map((ticket) => ({
      type: "쿠폰 일정",
      title: `${ticketParticipantNames(ticket).join(" & ") || ticket.member} 다음 일정 미예약`,
      detail: `${ticket.product} · 잔여 ${ticket.remaining}회${ticket.expires ? ` · ${ticket.expires}까지` : ""}`,
      tone: "warn",
      action: "일정 예약",
      view: "schedule",
      scheduleTicketId: ticket.id,
      scheduleLessonSource: "coupon",
    })),
    ...urgentMakeups.map((item) => ({
      type: "보강",
      title: `${item.member} 보강 승인`,
      detail: `${item.original || item.absence} -> ${item.requested || item.makeup}`,
      tone: item.status === "coach_required" ? "danger" : "warn",
      action: "보강 요청 검토",
      view: "schedule",
      dueAt: item.requested || item.makeup || "",
    })),
    ...pendingLessonLogs.map((log) => ({
      type: "수업기록",
      title: `${log.member || "회원"} 코치 확인`,
      detail: `${log.lessonLabel || log.lesson || "수업기록"} · 다음 커리큘럼 등록 필요`,
      tone: "warn",
      action: "기록/차감",
      view: "notes",
    })),
    ...pendingFeedbacks.map((item) => ({
      type: "운동노트",
      title: `${item.member || "회원"} 원격 피드백`,
      detail: item.question || item.memo || "사진/영상 코멘트 요청",
      tone: "warn",
      action: "피드백 확인",
      view: "notes",
    })),
    ...lowTickets.map((ticket) => ({
      type: "횟수",
      title: `${ticket.member} 잔여 ${ticket.remaining}회`,
      detail: `${ticket.product} · 재등록/충전 안내`,
      tone: ticket.remaining <= 1 ? "danger" : "warn",
      action: "회원권 확인",
      view: "members",
    })),
    ...paymentChecks.map((entry) => ({
      type: "결제확인",
      title: `${entry.primary.member} 결제 확인`,
      detail: `${entry.primary.item} · ${money.format(entry.primary.amount)}원${entry.attemptCount > 1 ? ` · 동일 요청 ${entry.attemptCount}회` : ""}`,
      tone: "warn",
      action: "결제 확인",
      view: "billing",
      dueAt: entry.primary.requestedAt || "",
    })),
    ...draftBillings.map((entry) => ({
      type: "결제요청",
      title: `${entry.primary.member} 결제요청 발송`,
      detail: `${entry.primary.item} · ${money.format(entry.primary.amount)}원${entry.attemptCount > 1 ? ` · 동일 요청 ${entry.attemptCount}회` : ""}`,
      tone: "neutral",
      action: "결제 요청",
      view: "billing",
      dueAt: entry.primary.requestedAt || "",
    })),
  ];
  const priorityByType = {
    결제오류: 0,
    긴급: 1,
    보강: 2,
    결제확인: 3,
    횟수: 4,
    "쿠폰 일정": 4,
    수업기록: 5,
    운동노트: 6,
    결제요청: 7,
  };
  return tasks
    .map((task, index) => ({ ...task, originalIndex: index }))
    .sort((left, right) => {
      const priorityDifference = (priorityByType[left.type] ?? 99) - (priorityByType[right.type] ?? 99);
      if (priorityDifference) return priorityDifference;
      const latestDifference = recordTimestamp(right.dueAt) - recordTimestamp(left.dueAt);
      return latestDifference || left.originalIndex - right.originalIndex;
    });
}

function buildAdminRecordContext() {
  const ticketCoachByMember = new Map();
  [...tickets, ...expiredTickets].forEach((ticket) => {
    String(ticket.member || "").split("&").map((name) => name.trim()).filter(Boolean).forEach((name) => {
      if (!ticketCoachByMember.has(name) && ticket.coachId) ticketCoachByMember.set(name, ticket.coachId);
    });
  });
  const memberCoachByName = new Map(members.map((member) => [member.name, member.coachId || ""]));
  const userNameById = new Map((adminLiveDataState.users || []).map((user) => [String(user.id), user.name]));
  const mediaCountByJournalId = new Map();
  (adminLiveDataState.mediaFiles || []).forEach((media) => {
    const key = String(media.journal_entry_id || "");
    if (!key) return;
    mediaCountByJournalId.set(key, (mediaCountByJournalId.get(key) || 0) + 1);
  });
  const lessonRecordByLessonId = new Map(
    (adminLiveDataState.lessonRecords || [])
      .filter((record) => record.lesson_id)
      .map((record) => [String(record.lesson_id), record]),
  );
  const lessonById = new Map();
  lessons.forEach((lesson) => {
    if (lesson.id) lessonById.set(String(lesson.id), lesson);
    if (lesson.serverLessonId) lessonById.set(String(lesson.serverLessonId), lesson);
  });
  const curriculumById = new Map(
    (adminLiveDataState.curriculumRefs || [])
      .filter((curriculum) => curriculum.id)
      .map((curriculum) => [String(curriculum.id), curriculum]),
  );
  const participantRecordsByLessonId = new Map();
  (adminLiveDataState.participantRecords || []).forEach((record) => {
    const lessonId = String(record.lesson_id || "");
    if (!lessonId) return;
    const rows = participantRecordsByLessonId.get(lessonId) || [];
    rows.push(record);
    participantRecordsByLessonId.set(lessonId, rows);
  });
  return {
    ticketCoachByMember,
    memberCoachByName,
    userNameById,
    mediaCountByJournalId,
    lessonRecordByLessonId,
    lessonById,
    curriculumById,
    participantRecordsByLessonId,
  };
}

function urgentOperationsRecords() {
  const paymentRecords = billings
    .filter(paymentRequiresTicketRepair)
    .map((item) => ({
      id: `urgent-payment-${item.serverPaymentId || item.providerPaymentId || item.member}`,
      group: "pending",
      source: "결제 오류",
      member: item.member || "회원 확인 필요",
      title: `${item.item || "회원권 결제"} 연결 누락`,
      detail: `${money.format(Number(item.amount) || 0)}원 결제 후 회원권이 발급되지 않았습니다.`,
      subDetail: "결제 확인 후 회원권 연결이 필요합니다.",
      statusLabel: "긴급",
      actionLabel: "결제 확인",
      actionView: "billing",
      priority: "urgent",
      urgentReason: "결제 완료와 회원권 데이터가 일치하지 않습니다.",
      sortAt: item.verifiedAt || item.paidAt || item.requestedAt || "",
    }));
  const makeupRecords = makeupRequests
    .filter((item) => ["coach_required", "requested", "pending"].includes(item.status))
    .map((item) => ({
      id: `urgent-makeup-${item.id}`,
      group: "pending",
      source: "긴급 보강·변경",
      member: item.member || "회원 확인 필요",
      title: `${item.original || item.absence || "기존 수업"} 변경 요청`,
      detail: `${item.requested || item.makeup || "변경 시간 확인 필요"} · ${item.reason || "사유 미입력"}`,
      subDetail: item.policy || item.statusLabel || "승인 여부 확인 필요",
      statusLabel: "긴급",
      actionLabel: "시간표 확인",
      actionView: "schedule",
      priority: "urgent",
      urgentReason: item.status === "coach_required" || item.status === "pending"
        ? "승인 전 원래 수업을 유지하는 변경 요청입니다."
        : "접수된 보강·변경 요청을 확인해야 합니다.",
      sortAt: item.createdAt || item.requestedAt || item.requested || "",
    }));
  return paymentRecords.concat(makeupRecords);
}

function ticketIntegrityReviewRecords() {
  if (operationsRole() !== "admin" || !state.liveScheduleLoaded) return [];
  const relevantStates = new Set(["current", "upcoming", "paused", "pending_payment"]);
  const linkContext = ticketReviewLinkContext();
  const records = [];

  operationBranchMembers().forEach((member) => {
    const ticketsByFingerprint = new Map();
    memberManagementTickets(member)
      .filter((ticket) => relevantStates.has(ticketReviewState(ticket)))
      .forEach((ticket) => {
        const fingerprint = memberTicketDuplicateFingerprint(ticket);
        if (!fingerprint) return;
        const grouped = ticketsByFingerprint.get(fingerprint) || [];
        grouped.push(ticket);
        ticketsByFingerprint.set(fingerprint, grouped);
      });
    [...ticketsByFingerprint.values()].forEach((grouped, index) => {
      if (grouped.length < 2) return;
      const ticketIds = grouped.map((ticket) => String(ticket.serverTicketId || "")).filter(Boolean);
      if (isExpectedPersonalGroupTicketSet(ticketIds, linkContext)) return;
      const ticket = grouped[0];
      const period = [ticket.actualLessonStart || ticket.purchased, ticket.expires].filter(Boolean).join("~");
      records.push({
        id: `ticket-overlap-${member.id}-${index}`,
        group: "issue",
        source: "회원권 점검",
        member: member.name || "회원 확인 필요",
        title: "회원권 중복 가능",
        detail: `${getTicketDisplayProduct(ticket) || ticket.product || "회원권"} · ${getCoachName(ticket.coachId)}`,
        subDetail: `${period || "기간 확인 필요"} · 자동 삭제하지 않았습니다. 두 회원권을 비교해 주세요.`,
        statusLabel: "확인 필요",
        actionLabel: "회원권 확인",
        memberId: member.id,
        ticketId: ticket.serverTicketId || "",
        priority: "urgent",
        urgentReason: "상품·코치·수업 유형·기간·참여자가 같은 회원권이 둘 이상입니다.",
        sortAt: ticket.serverUpdatedAt || ticket.expires || "",
      });
    });
  });

  linkContext.byAccount.forEach((account, accountId) => {
    if (account.userIds.size >= 2 && account.ticketIds.size >= 1) return;
    const accountRow = (adminLiveDataState.groupAccounts || []).find((item) => String(item.id || "") === accountId);
    const firstUserId = [...account.userIds][0] || "";
    const member = ticketReviewMember(firstUserId);
    const firstTicketId = [...account.ticketIds][0] || "";
    const ticket = (adminLiveDataState.tickets || []).find((item) => String(item.serverTicketId || item.id || "") === firstTicketId);
    records.push({
      id: `group-account-incomplete-${accountId}`,
      group: "issue",
      source: "1:2 연결 점검",
      member: member?.name || accountRow?.display_name || "1:2 회원 확인 필요",
      title: "파트너 연결 미완성",
      detail: `참여 회원 ${account.userIds.size}명 · 연결 회원권 ${account.ticketIds.size}개`,
      subDetail: "파트너 또는 회원권 연결을 확인해야 1:2 차감이 안전하게 처리됩니다.",
      statusLabel: "확인 필요",
      actionLabel: member ? "회원권 확인" : "운영 설정 확인",
      memberId: member?.id || null,
      ticketId: ticket?.serverTicketId || firstTicketId,
      actionView: member ? "" : "settings",
      priority: "urgent",
      urgentReason: "1:2 계정의 회원 또는 회원권 연결 수가 부족합니다.",
      sortAt: ticket?.serverUpdatedAt || "",
    });
  });

  const linkedTicketIds = new Set(linkContext.accountIdsByTicket.keys());
  (adminLiveDataState.tickets || [])
    .filter((ticket) => Number(ticket.groupSize || 1) === 2)
    .filter((ticket) => relevantStates.has(ticketReviewState(ticket)))
    .filter((ticket) => !linkedTicketIds.has(String(ticket.serverTicketId || ticket.id || "")))
    .forEach((ticket) => {
      const member = ticketReviewMember(ticket.serverUserId);
      records.push({
        id: `group-ticket-unlinked-${ticket.serverTicketId || ticket.id}`,
        group: "issue",
        source: "1:2 연결 점검",
        member: member?.name || ticket.member || "회원 확인 필요",
        title: "1:2 회원권 연결 없음",
        detail: `${getTicketDisplayProduct(ticket) || ticket.product || "1:2 회원권"} · ${getCoachName(ticket.coachId)}`,
        subDetail: "회원권은 유지하고 파트너 계정 연결만 확인해 주세요.",
        statusLabel: "확인 필요",
        actionLabel: member ? "회원권 확인" : "회원관리 확인",
        memberId: member?.id || null,
        ticketId: ticket.serverTicketId || "",
        actionView: member ? "" : "members",
        priority: "urgent",
        urgentReason: "사용 중인 1:2 회원권이 파트너 계정과 연결되지 않았습니다.",
        sortAt: ticket.serverUpdatedAt || ticket.expires || "",
      });
    });

  return records;
}

function adminRecordGroups() {
  const shared = operationalSharedData();
  const context = buildAdminRecordContext();
  const participantRecords = (adminLiveDataState.participantRecords || []).map((record) => (
    participantLessonRecord(record, context)
  ));
  const participantRecordLessonIds = new Set(
    (adminLiveDataState.participantRecords || []).map((record) => String(record.lesson_id || "")).filter(Boolean),
  );
  const records = [
    ...urgentOperationsRecords(),
    ...pendingLessonRecords(context),
    ...completedLessonRecordIssues(context),
    ...lessonNotes
      .filter((note) => !participantRecordLessonIds.has(String(note.serverLessonId || "")))
      .map(legacyNoteRecord),
    ...participantRecords,
    ...shared.lessonLogs.map(lessonLogRecord),
    ...shared.feedbackRequests.map(feedbackRecord),
    ...(adminLiveDataState.journalEntries || []).map((entry) => memberJournalRecord(entry, context)),
    ...ticketIntegrityReviewRecords(),
  ];
  const normalizedRecords = operationBranchRecords(records).map((record) => withRecordCoach(
    {
      ...record,
      pendingType: pendingRecordType(record),
    },
    record,
    context,
  ));
  const roleFilteredRecords = operationsRole() === "coach"
    ? normalizedRecords.filter((record) => (
      record.pendingType !== "payment"
      && recordBelongsToCurrentCoach(record)
    ))
    : normalizedRecords;
  return {
    pending: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "pending")),
    feedback: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "feedback")),
    done: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "done")),
    issue: sortAdminRecords(roleFilteredRecords.filter((record) => record.group === "issue")),
  };
}
