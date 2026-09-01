(() => {
  const statusGroups = Object.freeze({
    lesson: Object.freeze({
      scheduled: "예정",
      completed: "완료",
      absent: "불참",
      no_show: "노쇼",
      cancelled: "취소",
      makeup_due: "보강 가능",
      makeup_booked: "보강 예약",
      requested: "변경 요청",
    }),
    coachRecord: Object.freeze({
      writing: "작성 전",
      draft: "임시 저장",
      sync_pending: "동기화 대기",
      sync_failed: "동기화 실패",
      saved: "저장 완료",
      deducted: "차감 완료",
    }),
    membership: Object.freeze({
      payment_required: "결제 필요",
      active: "활성",
      expiring: "만료 임박",
      exhausted: "소진",
      expired: "만료",
      suspended: "정지",
      refunded: "환불 처리",
    }),
    payment: Object.freeze({
      order_created: "주문 생성",
      pending: "결제 대기",
      paid: "결제 성공",
      verification_failed: "검증 실패",
      membership_created: "회원권 생성 완료",
      cancelled: "취소",
      refunded: "환불",
    }),
  });

  const aliases = Object.freeze({
    "확인 대기": ["coachRecord", "writing"],
    "동기화 대기": ["coachRecord", "sync_pending"],
    "동기화 실패": ["coachRecord", "sync_failed"],
    "확인 완료": ["coachRecord", "saved"],
    "차감 완료": ["coachRecord", "deducted"],
    scheduled: ["lesson", "scheduled"],
    completed: ["lesson", "completed"],
    absent: ["lesson", "absent"],
    no_show: ["lesson", "no_show"],
    cancelled: ["lesson", "cancelled"],
    makeup_due: ["lesson", "makeup_due"],
    makeup_booked: ["lesson", "makeup_booked"],
  });

  const escapeHtml = window.escapeHtml;

  function statusLabel(group, value, fallback = "") {
    const direct = statusGroups[group]?.[value];
    if (direct) return direct;
    const alias = aliases[value];
    if (alias) return statusGroups[alias[0]]?.[alias[1]] || fallback || value;
    return fallback || String(value || "");
  }

  function lessonProcessingState(options = {}) {
    const rawLessonStatus = String(options.lessonStatus || options.status || "scheduled").trim().toLowerCase();
    const lessonStatus = ({
      "예정": "scheduled",
      "확정": "scheduled",
      "완료": "completed",
      "취소": "cancelled",
      "노쇼": "no_show",
      "불참": "absent",
      "휴무": "holiday",
      "보강 가능": "available",
      "변경 요청": "pending_change",
      "승인 대기": "pending_change",
      confirmed: "scheduled",
    })[rawLessonStatus] || rawLessonStatus;
    const records = Array.isArray(options.participantRecords) ? options.participantRecords : [];
    const participantCount = Math.max(0, Number(options.participantCount) || records.length);
    const finalRecords = records.filter((record) => (
      String(record?.recordStatus || record?.record_status || "").toLowerCase() === "final"
    ));
    const finalCount = Math.max(0, Number.isFinite(Number(options.finalCount))
      ? Number(options.finalCount)
      : finalRecords.length);
    const outcomes = (Array.isArray(options.outcomes) ? options.outcomes : finalRecords.map((record) => record?.outcome))
      .map((value) => String(value || "completed").toLowerCase())
      .filter(Boolean);
    const deductionIssue = options.deductionIssue === true || finalRecords.some((record) => {
      const hasRequestedValue = Object.prototype.hasOwnProperty.call(record || {}, "deductionRequested")
        || Object.prototype.hasOwnProperty.call(record || {}, "deduction_requested");
      const requested = record?.deductionRequested === true || record?.deduction_requested === true;
      if (!hasRequestedValue || !requested) return false;
      const deducted = Math.max(0, Number(record?.deductedSessions ?? record?.deducted_sessions) || 0);
      const ticketKnown = record?.recordTicketKnown === true
        || Object.prototype.hasOwnProperty.call(record || {}, "recordTicketId")
        || Object.prototype.hasOwnProperty.call(record || {}, "ticket_id");
      const ticketId = record?.recordTicketId ?? record?.ticket_id ?? record?.ticketId ?? "";
      return deducted === 0 || (ticketKnown && !ticketId);
    });
    const hasExplicitError = options.hasError === true || options.partialFailure === true;
    const allFinal = participantCount > 0 && finalCount >= participantCount;
    const someFinal = finalCount > 0;
    const incomplete = participantCount > 0 && finalCount < participantCount;
    const ended = options.hasEnded === true;
    const released = options.released === true || lessonStatus === "available";
    const approval = ["pending", "pending_change", "requested"].includes(lessonStatus);
    const cancelled = ["cancelled", "canceled"].includes(lessonStatus);
    const holiday = lessonStatus === "holiday" || outcomes.length > 0 && outcomes.every((outcome) => outcome === "holiday");
    const noShow = lessonStatus === "no_show" || outcomes.includes("no_show");
    const absence = lessonStatus === "absent" || outcomes.length > 0 && outcomes.every((outcome) => outcome === "absence");
    const finalizedStatus = ["completed", "no_show"].includes(lessonStatus);

    const result = (id, label, actionLabel, extra = {}) => Object.freeze({
      id,
      label,
      actionLabel,
      needsFeedback: id === "processing_required",
      resolved: ["completed", "cancelled", "holiday", "absence", "no_show", "released"].includes(id),
      ...extra,
    });

    if (released) return result("released", "보강 가능", "예약 가능");
    if (approval) return result("approval", "승인 대기", "요청 확인");
    if (cancelled) return result("cancelled", "취소", "기록 보기");
    if (holiday) return result("holiday", "휴무", "기록 보기");
    if (hasExplicitError || deductionIssue || (someFinal && incomplete) || (finalizedStatus && !allFinal)) {
      return result("confirmation_needed", "확인 필요", "최신 상태 다시 확인", {
        contextLabel: noShow ? "노쇼" : absence ? "불참" : "",
      });
    }
    if (allFinal) {
      if (noShow) return result("no_show", "노쇼", "기록 보기");
      if (absence) return result("absence", "불참", "기록 보기");
      return result("completed", "완료", "기록 보기");
    }
    if (ended) return result("processing_required", "처리 필요", "피드백 작성");
    return result("scheduled", "예정", "수업 보기");
  }

  function ticketSessionSnapshot(record = {}) {
    const raw = record?.ticketSessionSnapshot
      ?? record?.ticket_session_snapshot
      ?? record?.sessionSnapshot
      ?? null;
    const snapshot = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    const legacy = Object.freeze({
      confirmed: false,
      adjusted: false,
      label: "기록 당시 회차 미확정",
      detail: "현재 회원권 횟수와 분리된 과거 기록입니다.",
      snapshot: null,
    });
    if (!snapshot || Number(snapshot.version) !== 1 || !String(snapshot.ticketId || "").trim()) return legacy;
    const integer = (key) => {
      const value = Number(snapshot[key]);
      return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
    };
    const total = integer("totalSessions");
    const usedBefore = integer("usedBefore");
    const remainingBefore = integer("remainingBefore");
    const usedAfter = integer("usedAfter");
    const remainingAfter = integer("remainingAfter");
    const participantDeducted = integer("participantDeductedSessions");
    const ticketDeducted = integer("ticketDeductedSessions");
    if (
      ![total, usedBefore, remainingBefore, usedAfter, remainingAfter, participantDeducted, ticketDeducted]
        .every(Number.isFinite)
      || usedAfter - usedBefore !== ticketDeducted
      || remainingBefore - remainingAfter !== ticketDeducted
      || participantDeducted > ticketDeducted
      || [usedBefore, remainingBefore, usedAfter, remainingAfter].some((value) => value > total)
    ) return legacy;

    const currentDeducted = Number(record?.deductedSessions ?? record?.deducted_sessions);
    const adjusted = Number.isFinite(currentDeducted) && Math.max(0, currentDeducted) !== participantDeducted;
    const round = ticketDeducted > 1 ? `${usedBefore + 1}~${usedAfter}` : `${usedAfter}`;
    const label = ticketDeducted > 0
      ? `이번 수업 ${round}/${total}회차${adjusted ? " · 차감 정정" : ""}`
      : `수업 당시 ${usedAfter}/${total}회 사용 · 차감 없음${adjusted ? " · 차감 정정" : ""}`;
    return Object.freeze({
      confirmed: true,
      adjusted,
      label,
      detail: `수업 전 ${usedBefore}/${total}회 사용 · 잔여 ${remainingBefore}회 → 수업 후 ${usedAfter}/${total}회 사용 · 잔여 ${remainingAfter}회`,
      snapshot: Object.freeze({
        ...snapshot,
        totalSessions: total,
        usedBefore,
        remainingBefore,
        usedAfter,
        remainingAfter,
        participantDeductedSessions: participantDeducted,
        ticketDeductedSessions: ticketDeducted,
      }),
    });
  }

  function lessonDisplayMinutes(value = "") {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return Number.NaN;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return Number.NaN;
    return hour * 60 + minute;
  }

  function lessonDisplayTime(minutes = 0) {
    const safe = Math.max(0, Math.min(24 * 60, Number(minutes) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function lessonDisplayList(value) {
    return [...new Set((Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean))].sort();
  }

  function lessonDisplayArray(value) {
    if (Array.isArray(value)) return value;
    return value === undefined || value === null || value === "" ? [] : [value];
  }

  function lessonDisplayParticipantKey(lesson = {}) {
    const participants = Array.isArray(lesson.v2Participants) ? lesson.v2Participants : [];
    const ids = lessonDisplayList([
      ...lessonDisplayArray(lesson.memberUserIds),
      ...lessonDisplayArray(lesson.participantUserIds),
      ...lessonDisplayArray(lesson.serverParticipantUserIds),
      ...participants.map((participant) => participant?.userId || participant?.user_id),
    ]);
    const tickets = lessonDisplayList([
      lesson.ticketId,
      lesson.ticket_id,
      lesson.memberTicketId,
      lesson.member_ticket_id,
      ...participants.map((participant) => participant?.ticketId || participant?.ticket_id),
    ]);
    const group = String(lesson.groupId || lesson.group_id || lesson.groupAccountId || lesson.group_account_id || "").trim();
    const memberFallback = String(lesson.member || lesson.memberName || lesson.member_name || "")
      .split(/[&,·]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join("|");
    return JSON.stringify({ ids, tickets, group, memberFallback: ids.length ? "" : memberFallback });
  }

  function lessonDisplayRecordKey(lesson = {}) {
    const records = Array.isArray(lesson.v2Participants)
      ? lesson.v2Participants
      : Array.isArray(lesson.participantRecords) ? lesson.participantRecords : lesson.participantRecord ? [lesson.participantRecord] : [];
    return JSON.stringify(records.map((record) => ({
      userId: String(record?.userId || record?.user_id || ""),
      ticketId: String(record?.ticketId || record?.ticket_id || record?.recordTicketId || ""),
      status: String(record?.recordStatus || record?.record_status || ""),
      outcome: String(record?.outcome || ""),
      requested: record?.deductionRequested === true || record?.deduction_requested === true,
      deducted: Math.max(0, Number(record?.deductedSessions ?? record?.deducted_sessions) || 0),
    })).sort((left, right) => `${left.userId}|${left.ticketId}`.localeCompare(`${right.userId}|${right.ticketId}`)));
  }

  function lessonDisplayIdentity(lesson = {}) {
    const logicalLessonId = String(
      lesson.serverLessonId || lesson.server_lesson_id || lesson.lessonId || lesson.lesson_id || lesson.id || "",
    ).trim();
    const coach = String(
      lesson.substituteCoachRoleId || lesson.substitute_coach_role_id
      || lesson.coachRoleId || lesson.coach_role_id || lesson.coachId || lesson.coach_id || lesson.coach || "",
    ).trim().toLowerCase();
    const originalCoach = String(
      lesson.originalCoachRoleId || lesson.original_coach_role_id || lesson.originalCoachId || lesson.original_coach_id || "",
    ).trim().toLowerCase();
    const lessonDate = String(lesson.lessonDate || lesson.lesson_date || lesson.date || lesson.day || "").trim();
    const serverStatus = String(lesson.serverStatus || lesson.server_status || "").trim().toLowerCase();
    const status = String(lesson.status || serverStatus || "scheduled").trim().toLowerCase();
    const lessonSource = String(lesson.lessonSource || lesson.lesson_source || "").trim().toLowerCase();
    const scheduleKind = String(lesson.scheduleKind || lesson.schedule_kind || lesson.scheduleV2Kind || "").trim().toLowerCase();
    const outcome = String(lesson.outcome || lesson.participantRecord?.outcome || "").trim().toLowerCase();
    const substitute = Boolean(lesson.isSubstitute || lesson.is_substitute || originalCoach);
    return {
      logicalLessonId,
      key: JSON.stringify({
        logicalLessonId,
        lessonDate,
        coach,
        originalCoach,
        serverStatus,
        status,
        lessonSource,
        scheduleKind,
        outcome,
        substitute,
        flags: {
          released: Boolean(lesson.releasedMakeupSlot || lesson.releasedRegularSlot),
          oneDay: Boolean(lesson.oneDayBooking),
          makeup: Boolean(lesson.makeup),
          groupPartialFailure: Boolean(lesson.groupPartialFailure),
          completionNeedsReview: Boolean(lesson.completionNeedsReview),
          feedbackSaved: Boolean(lesson.feedbackSaved || lesson.hasFeedback || lesson.feedbackWritten),
          deductionRequested: Boolean(lesson.deductionRequested || lesson.deduction_requested),
        },
        recordStatus: String(lesson.recordStatus || lesson.record_status || "").trim().toLowerCase(),
        feedbackStatus: String(lesson.feedbackStatus || lesson.feedback_status || "").trim().toLowerCase(),
        deductionStatus: String(lesson.deductionStatus || lesson.deduction_status || "").trim().toLowerCase(),
        participant: lessonDisplayParticipantKey(lesson),
        records: lessonDisplayRecordKey(lesson),
        ticketTotal: Number(lesson.ticketTotalSessions ?? lesson.totalSessions) || 0,
        ticketUsed: Number(lesson.ticketUsedSessions ?? lesson.usedSessions) || 0,
        ticketRemaining: Number(lesson.ticketRemainingSessions ?? lesson.remaining) || 0,
        deducted: Math.max(0, Number(lesson.deductedSessions) || 0),
      }),
    };
  }

  function lessonDisplaySegmentId(lesson = {}, logicalLessonId = "") {
    return String(lesson.segmentId || lesson.segment_id || lesson.displaySegmentId || lesson.id || logicalLessonId || "").trim();
  }

  function mergeLessonDisplaySegments(lessons = []) {
    if (!Array.isArray(lessons) || lessons.length < 2) return Array.isArray(lessons) ? lessons : [];
    const entries = lessons.map((lesson, index) => {
      const identity = lessonDisplayIdentity(lesson);
      const start = lessonDisplayMinutes(lesson.time || lesson.startTime || lesson.start_time);
      const duration = Math.max(0, Number(lesson.durationMinutes ?? lesson.duration_minutes) || 0);
      return {
        lesson,
        index,
        ...identity,
        segmentId: lessonDisplaySegmentId(lesson, identity.logicalLessonId),
        start,
        duration,
        end: Number.isFinite(start) ? start + duration : Number.NaN,
      };
    });
    const groups = new Map();
    entries.forEach((entry) => {
      if (!entry.logicalLessonId || !entry.segmentId || !Number.isFinite(entry.start) || entry.duration !== 20) return;
      const group = groups.get(entry.key) || [];
      group.push(entry);
      groups.set(entry.key, group);
    });
    const runByIndex = new Map();
    groups.forEach((group) => {
      const ordered = [...group].sort((left, right) => left.start - right.start || left.index - right.index);
      let run = [];
      const register = () => {
        if (run.length < 2) return;
        const uniqueSegments = new Set(run.map((entry) => entry.segmentId));
        if (uniqueSegments.size !== run.length) return;
        const descriptor = { entries: [...run], firstIndex: Math.min(...run.map((entry) => entry.index)) };
        run.forEach((entry) => runByIndex.set(entry.index, descriptor));
      };
      ordered.forEach((entry) => {
        if (!run.length || run.at(-1).end === entry.start) {
          run.push(entry);
          return;
        }
        register();
        run = [entry];
      });
      register();
    });

    const emitted = new Set();
    return entries.flatMap((entry) => {
      const run = runByIndex.get(entry.index);
      if (!run) return [entry.lesson];
      if (emitted.has(run)) return [];
      emitted.add(run);
      const ordered = [...run.entries].sort((left, right) => left.start - right.start || left.index - right.index);
      const first = ordered[0];
      const totalMinutes = ordered.reduce((sum, item) => sum + item.duration, 0);
      const startTime = lessonDisplayTime(first.start);
      const endTime = lessonDisplayTime(first.start + totalMinutes);
      const segmentIds = ordered.map((item) => item.segmentId);
      const lessonIds = lessonDisplayList(ordered.map((item) => item.logicalLessonId));
      const type = String(first.lesson.type || "").replace(/\d+\s*분/, `${totalMinutes}분`);
      return [{
        ...first.lesson,
        ...(type ? { type } : {}),
        time: startTime,
        startTime,
        start_time: startTime,
        durationMinutes: totalMinutes,
        duration_minutes: totalMinutes,
        displayMerged: true,
        displayStartTime: startTime,
        displayEndTime: endTime,
        displayDurationMinutes: totalMinutes,
        displayTimeRange: `${startTime}~${endTime}`,
        displaySegmentIds: segmentIds,
        displayLessonIds: lessonIds,
        displaySegments: ordered.map((item) => item.lesson),
        displayPrimarySegmentId: first.segmentId,
      }];
    });
  }

  function actionAttributes(action = {}) {
    if (action.view) return `data-view="${escapeHtml(action.view)}"`;
    if (action.jump) return `data-jump="${escapeHtml(action.jump)}"`;
    if (action.homeAction) return `data-home-action="${escapeHtml(action.homeAction)}"`;
    if (action.openChange) return "data-open-member-change";
    if (action.openJournal) return `data-journal-write-date="${escapeHtml(action.openJournal)}"`;
    if (action.summaryAction) return `data-summary-action="${escapeHtml(action.summaryAction)}"`;
    return "";
  }

  function emptyState({
    title = "표시할 내용이 없습니다",
    reason = "현재 조건에 맞는 내용이 없습니다.",
    action = null,
    compact = false,
  } = {}) {
    const actionMarkup = action?.label
      ? `<button class="${action.primary === false ? "small-button" : "primary-button"}" type="button" ${actionAttributes(action)}>${escapeHtml(action.label)}</button>`
      : "";
    return `
      <section class="tn-empty-state${compact ? " is-compact" : ""}" role="status">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(reason)}</p>
        ${actionMarkup}
      </section>`;
  }

  window.TennisNoteUiLanguage = Object.freeze({
    groups: statusGroups,
    statusLabel,
    lessonProcessingState,
    ticketSessionSnapshot,
    mergeLessonDisplaySegments,
    emptyState,
  });
})();
