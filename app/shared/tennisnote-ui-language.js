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
    emptyState,
  });
})();
