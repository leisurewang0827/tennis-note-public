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
  const ticketId = ticket?.serverTicketId || ticket?.id || "";
  if (ticketId) {
    return membershipRecords.find((record) => record.ticket_id === ticketId)
      || records.find((record) => record.current_ticket_id === ticketId)
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
    group: done ? "done" : "pending",
    source: "관리자 샘플",
    member: note.member,
    title: note.lesson,
    detail: note.reflection,
    subDetail: note.next,
    statusLabel: done ? "차감 확인됨" : "코치 확인 필요",
    actionLabel: done ? "완료" : "수업 완료·차감",
    lessonId: note.serverLessonId || "",
    actionable: !done && Boolean(note.serverLessonId),
  };
}

function pendingLessonRecord(lesson) {
  const endedAt = lessonEndTimestamp(lesson);
  return {
    id: `pending-lesson-${lesson.serverLessonId}`,
    group: "pending",
    source: "수업 완료 대기",
    member: lesson.member || "회원 확인 필요",
    title: `${lesson.lessonDate || "수업일"} ${lesson.time || ""} · ${getCoachName(lesson.coachId)}`.trim(),
    detail: `${lesson.type || "수업"} ${lesson.durationMinutes || 20}분 · ${lesson.ticketProduct || "회원권 확인 필요"}`,
    subDetail: `현재 잔여 ${Number(lesson.ticketRemaining) || 0}회`,
    statusLabel: "기록 대기",
    actionLabel: "수업 완료·차감",
    lessonId: lesson.serverLessonId,
    actionable: true,
    priority: "urgent",
    urgentReason: "수업 기록 미처리로 횟수 차감이 대기 중입니다.",
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
    group: hasIssue ? "issue" : done ? "done" : "pending",
    source: "회원/코치 기록",
    member: log.member || "회원",
    title: log.lessonLabel || log.lesson || `${log.date || ""} 수업`,
    detail: log.content || log.selfMemo || "회원 운동일지 또는 코치 완료 처리 확인",
    subDetail: log.coachComment ? `코치 코멘트: ${log.coachComment}` : "코치 코멘트 미등록",
    statusLabel: hasIssue ? "기록 보완 필요" : done ? "차감 완료" : "차감 대기",
    actionLabel: hasIssue ? "관리자 확인" : done ? "완료" : "코치앱 처리",
    priority: hasIssue || !done ? "urgent" : "normal",
    urgentReason: hasIssue ? "코멘트 또는 다음 커리큘럼 누락을 확인해야 합니다." : !done ? "기록 완료 전이라 횟수 차감이 대기 중입니다." : "",
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
