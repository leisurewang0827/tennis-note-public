(function () {
  const TERMINAL = new Set(["expired", "refunded", "cancelled", "canceled", "voided"]);

  function value(ticket, ...keys) {
    for (const key of keys) {
      if (ticket?.[key] !== undefined && ticket?.[key] !== null) return ticket[key];
    }
    return "";
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

  function derive(ticket, today = localDateKey()) {
    if (!ticket) return "none";
    const status = String(value(ticket, "status") || "").toLowerCase();
    const startsOn = String(value(ticket, "startsOn", "starts_on", "starts", "purchased") || "");
    const expiresOn = String(value(ticket, "expiresOn", "expires_on", "expires") || "");
    const remaining = Number(value(ticket, "remaining", "remainingSessions", "remaining_sessions"));

    if (["refunded"].includes(status)) return "refunded";
    if (["cancelled", "canceled"].includes(status)) return "cancelled";
    if (status === "voided") return "voided";
    if (status === "pending_payment") return "pending_payment";
    if (expiresOn && expiresOn < today) return "expired";
    if (Number.isFinite(remaining) && remaining <= 0) return "exhausted";
    if (startsOn && startsOn > today) return "upcoming";
    if (status === "paused") return "paused";
    if (status === "expired") return "expired";
    if (TERMINAL.has(status)) return status;
    if (status === "active" || !status) return "current";
    return status;
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
      exhausted: "소진",
      expired: "만료",
      refunded: "환불 완료",
      cancelled: "결제 취소",
      voided: "삭제 처리",
    })[derive(ticket, today)] || "상태 확인";
  }

  window.TennisNoteTicketState = Object.freeze({ derive, label, localDateKey, rank, sort, split });
})();
