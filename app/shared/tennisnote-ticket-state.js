(function () {
  function value(ticket, ...keys) {
    for (const key of keys) {
      if (ticket?.[key] !== undefined && ticket?.[key] !== null) return ticket[key];
    }
    return "";
  }

  function numericValue(ticket, ...keys) {
    // 명시된 null을 다른 별칭이나 total-used로 추정하지 않는다.
    const key = keys.find((item) => Object.prototype.hasOwnProperty.call(ticket || {}, item));
    const raw = key ? ticket[key] : null;
    if (typeof raw !== "number" && typeof raw !== "string") return null;
    if (typeof raw === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function validDateKey(raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const parsed = new Date(raw + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
  }

  function localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function classify(ticket, today = localDateKey()) {
    const status = String(value(ticket, "status") || "").trim().toLowerCase();
    const startsOn = String(value(ticket, "startsOn", "starts_on", "starts", "start_date", "purchased") || "");
    const expiresOn = String(value(ticket, "expiresOn", "expires_on", "expires", "end_date") || "");
    const remaining = numericValue(ticket, "remaining", "remainingSessions", "remaining_sessions");
    const result = (state, reason = state) => ({ state, reason, canUse: state === "current", remaining, startsOn, expiresOn });
    if (!ticket) return result("none");
    if (status === "refunded") return result("refunded");
    if (["cancelled", "canceled"].includes(status)) return result("cancelled");
    if (["voided", "deleted"].includes(status)) return result("voided");
    if (status === "pending_payment") return result("pending_payment");
    if (!validDateKey(today)) return result("unknown", "date_unknown");
    // 만료일 당일까지 포함한다. 표시 판정은 원본 횟수/상태를 쓰지 않는다.
    if (validDateKey(expiresOn) && expiresOn < today) return result("expired", "date_expired");
    if (remaining !== null && remaining <= 0) return result("exhausted", "uses_exhausted");
    if (status === "expired") return result("expired", "explicit_expired");
    if (remaining === null) return result("unknown", "remaining_unknown");
    if (!validDateKey(startsOn) || !validDateKey(expiresOn) || startsOn > expiresOn) return result("unknown", "date_unknown");
    if (ticket.refundHoldId || ticket.refund_hold_refund_id || ["hold", "on_hold", "refund_pending"].includes(status)) return result("held");
    if (status && !["active", "paused"].includes(status)) return result("unknown", "status_unknown");
    if (startsOn > today) return result("upcoming");
    if (status === "paused") return result("paused");
    return result("current", "usable");
  }

  function derive(ticket, today = localDateKey()) {
    return classify(ticket, today).state;
  }

  function rank(ticket, today = localDateKey()) {
    return ({ current: 0, paused: 1, upcoming: 2, pending_payment: 3, exhausted: 4, expired: 5, refunded: 6, cancelled: 7, voided: 8 })[derive(ticket, today)] ?? 9;
  }

  function sort(tickets, today = localDateKey()) {
    return [...(tickets || [])].sort((left, right) => {
      const stateOrder = rank(left, today) - rank(right, today);
      if (stateOrder) return stateOrder;
      const leftStart = String(value(left, "startsOn", "starts_on", "starts", "purchased") || "");
      const rightStart = String(value(right, "startsOn", "starts_on", "starts", "purchased") || "");
      return rightStart.localeCompare(leftStart);
    });
  }

  function split(tickets, today = localDateKey()) {
    const groups = { current: [], upcoming: [], history: [] };
    sort(tickets, today).forEach((ticket) => {
      const state = derive(ticket, today);
      if (["current", "paused"].includes(state)) groups.current.push(ticket);
      else if (["upcoming", "pending_payment"].includes(state)) groups.upcoming.push(ticket);
      else groups.history.push(ticket);
    });
    return groups;
  }

  function label(ticket, today = localDateKey()) {
    return ({
      current: "사용 중",
      paused: "일시정지",
      upcoming: "시작 예정",
      pending_payment: "결제 대기",
      exhausted: "회원권 만료",
      expired: "회원권 만료",
      refunded: "환불 완료",
      cancelled: "결제 취소",
      voided: "삭제 처리",
      held: "이용 보류",
      unknown: "상태 확인 필요",
    })[derive(ticket, today)] || "상태 확인";
  }

  window.TennisNoteTicketState = Object.freeze({ classify, derive, label, localDateKey, rank, sort, split });
})();
