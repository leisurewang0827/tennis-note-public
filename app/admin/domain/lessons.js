// 수업(lesson) 값 판정·표시 문구를 만드는 순수 함수들.
//
// 전역 변수도 DOM 도 서버도 참조하지 않는다. 인자만 보고 값을 돌려준다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.
// 여기 함수가 부르는 다른 함수는 아직 app.js 에 남아 있을 수 있는데,
// 모두 전역이고 실행 시점에는 다 정의돼 있으므로 문제되지 않는다.

function lessonTypeLabel(lesson) {
  return `${lesson.type} ${lesson.durationMinutes}분 · ${lessonUnitLabel(lesson.durationMinutes)}`;
}

function lessonTicketUnits(lesson, ticket) {
  const lessonMinutes = Math.max(1, Number(lesson?.durationMinutes) || 20);
  const ticketMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  return Math.max(1, Math.ceil(lessonMinutes / ticketMinutes));
}

function lessonSourceValue(lesson = {}) {
  return normalizeLessonSource(lesson.lessonSource || lesson.lesson_source || "");
}

function lessonStatusValue(lesson = {}) {
  const status = lessonRawStatusValue(lesson);
  if (status === "pending") return "pending_change";
  if (status === "confirmed") return "scheduled";
  return status || "scheduled";
}

function isLessonPendingChange(lesson = {}) {
  return lessonStatusValue(lesson) === "pending_change";
}

function isLessonCancelled(lesson = {}) {
  return lessonStatusValue(lesson) === "cancelled";
}

function isLessonAvailable(lesson = {}) {
  return lessonStatusValue(lesson) === "available";
}

function scheduleLessonExceptionLabel(lesson = {}) {
  if (lesson.releasedOriginLabel) return lesson.releasedOriginLabel;
  if (isReleasedRegularMakeupSlot(lesson)) {
    return lesson.historicalReleasedSlot ? "차감 없음" : "차감 없음 · 보강·원데이 가능";
  }
  if (lessonStatusValue(lesson) === "completed") return Number(lesson.deductedSessions) > 0 ? "완료 · 차감" : "완료 · 미차감";
  if (lessonStatusValue(lesson) === "no_show") return Number(lesson.deductedSessions) > 0 ? "노쇼 · 차감" : "노쇼 · 미차감";
  const context = `${lesson.type || ""} ${lessonSourceValue(lesson)} ${lesson.changeNote || ""} ${lesson.task || ""}`;
  if ((lesson.originalCoachRoleId && lesson.coachRoleId && lesson.originalCoachRoleId !== lesson.coachRoleId) || /대타/.test(context)) return "대타";
  if (/코치\s*변경/.test(context)) return "코치 변경";
  if (/시간\s*변경|변경\s*완료/.test(context)) return "시간 변경";
  return "";
}

function isMakeupLesson(lesson) {
  return lessonSourceValue(lesson) === "makeup" || lesson.type?.includes("보강") || lesson.type?.includes("대리") || lesson.makeup === true;
}

function getLessonStatusLabel(lesson) {
  const rawStatus = lessonRawStatusValue(lesson);
  const status = lessonStatusValue(lesson);
  if (lesson?.oneDayBooking) {
    if (status === "completed") return "원데이 완료";
    if (rawStatus === "checked_in") return "방문";
    return "원데이 예약";
  }
  if (isReleasedRegularMakeupSlot(lesson)) {
    return lesson.historicalReleasedSlot ? "정규 · 불참 기록" : "정규자리 · 보강 가능";
  }
  if (status === "completed") return Number(lesson.deductedSessions) > 0 ? "완료 · 차감" : "완료 · 미차감";
  if (status === "no_show") return Number(lesson.deductedSessions) > 0 ? "노쇼 · 차감" : "노쇼 · 미차감";
  if (status === "cancelled") return "취소";
  if (status === "available") return "보강 가능";
  if (isMakeupLesson(lesson) && isLessonPendingChange(lesson)) return "보강접수중";
  if (isMakeupLesson(lesson)) return "보강";
  if (isLessonPendingChange(lesson)) return "승인 필요";
  if (rawStatus === "confirmed") return "확정";
  return "예정";
}

function durationTone(lesson) {
  if (isReleasedRegularMakeupSlot(lesson)) return "available";
  if (lessonStatusValue(lesson) === "available") return "available";
  if (isMakeupLesson(lesson)) return "makeup";
  if (lesson.durationMinutes === 40 || lesson.durationMinutes === 60) return "stacked";
  if (lesson.durationMinutes >= 30) return "half";
  return "short";
}

function durationBadge(lesson) {
  const stackedLabel = lesson.durationMinutes === 40 ? "20분x2" : lesson.durationMinutes === 60 ? "30분x2" : `${lesson.durationMinutes}분`;
  return `<b class="duration-pill ${durationTone(lesson)}">${stackedLabel}</b>`;
}

function isBookedLesson(lesson) {
  return !isLessonAvailable(lesson) || isReleasedRegularMakeupSlot(lesson);
}

function getLessonMembersLabel(lesson) {
  if (isReleasedRegularMakeupSlot(lesson)) {
    return lesson.releasedOriginalMember || lesson.member || "정규 자리";
  }
  return lesson.member;
}

function participantLessonRecord(record, context) {
  const lessonId = String(record.lesson_id || "");
  const lesson = context.lessonById.get(lessonId) || null;
  const memberName = context.userNameById.get(String(record.user_id || "")) || "회원 확인 필요";
  const curriculum = context.curriculumById.get(String(record.next_curriculum_ref_id || "")) || null;
  const recordStatus = String(record.record_status || "draft");
  const isDraft = recordStatus !== "final";
  const deductedSessions = Math.max(0, Number(record.deducted_sessions) || 0);
  const deductionRequested = Boolean(record.deduction_requested);
  const missingDeduction = !isDraft
    && deductionRequested
    && deductedSessions === 0
    && ["completed", "no_show", "absence"].includes(String(record.outcome || ""));
  const outcomeLabel = participantOutcomeLabel(record.outcome);
  const completedLabel = deductedSessions > 0
    ? `완료 · ${deductedSessions}회 차감`
    : "완료 · 차감 없음";
  const detailParts = [
    String(record.coach_comment || "").trim() || (isDraft ? "작성 중인 피드백이 있습니다." : `${outcomeLabel} 기록`),
    curriculum?.title ? `다음 커리큘럼: ${curriculum.title}` : "",
  ].filter(Boolean);
  const lessonDate = lesson?.lessonDate || String(record.finalized_at || record.updated_at || "").slice(0, 10) || "날짜 미정";
  const lessonTime = lesson?.time || "";
  return {
    id: `participant-record-${record.id}`,
    group: missingDeduction ? "issue" : isDraft ? "feedback" : "done",
    source: "수업 피드백",
    branchId: lesson?.branchId || "",
    member: memberName,
    title: `${lessonDate} ${lessonTime} · ${outcomeLabel}`.replace(/\s+/g, " ").trim(),
    detail: detailParts.join(" · "),
    subDetail: isDraft
      ? "피드백만 임시 저장됨 · 회원권 차감 안 됨"
      : missingDeduction
        ? "차감 요청과 실제 차감 결과가 다릅니다. 수업 상세에서 확인해 주세요."
        : completedLabel,
    statusLabel: isDraft ? "초안 · 미차감" : missingDeduction ? "차감 확인 필요" : completedLabel,
    actionLabel: isDraft ? "이어 작성" : missingDeduction ? "차감 확인" : "처리 완료",
    lessonId,
    serverLessonId: lessonId,
    ticketId: record.ticket_id || "",
    coachId: lesson?.coachId || "",
    coachRoleId: record.coach_role_id || lesson?.coachRoleId || "",
    actionable: Boolean(lesson && (isDraft || missingDeduction)),
    priority: missingDeduction ? "urgent" : isDraft ? "high" : "normal",
    urgentReason: missingDeduction
      ? "완료 기록은 있지만 요청된 회원권 차감 결과가 0회입니다."
      : isDraft
        ? "초안 저장은 수업 완료나 회원권 차감을 실행하지 않습니다."
        : "",
    sortAt: record.finalized_at || record.updated_at || record.created_at || lesson?.lessonDate || "",
  };
}
