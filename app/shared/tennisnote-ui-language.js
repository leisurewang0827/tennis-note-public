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
    emptyState,
  });
})();
