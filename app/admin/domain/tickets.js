// 이용권(ticket) 판정·표시 문구를 만드는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다
// (기본값 이음매를 거친 함수 포함). app.js 에서 본문 그대로 옮겨왔고
// 전역 함수 선언이라 호출부는 예전과 같다.

function getCoachName(coachId, allCoaches = coaches) {
  return allCoaches.find((coach) => coach.id === coachId)?.name || "미배정";
}

function ticketHasFutureRegularLesson(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  return allLessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    if (["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson))) return false;
    return lessonSourceValue(lesson) === "regular";
  });
}

function ticketFutureRegularScheduleCoverage(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  const baseMinutes = Math.max(1, getTicketDurationMinutes(ticket));
  const anchors = new Map();
  allLessons.forEach((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket?.id || "")) return;
    if (!lesson.lessonDate || lesson.lessonDate < today) return;
    if (["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson))) return;
    if (lessonSourceValue(lesson) !== "regular") return;
    const key = [lesson.day || "", lesson.time || "", lessonScheduleCoachId(lesson) || ""].join("|");
    const units = Math.max(1, Math.ceil((Number(lesson.durationMinutes) || baseMinutes) / baseMinutes));
    anchors.set(key, Math.max(anchors.get(key) || 0, units));
  });
  return [...anchors.values()].reduce((sum, units) => sum + units, 0);
}

function ticketHasUpcomingLesson(ticket, today = adminLocalDateKey(new Date()), allLessons = lessons) {
  return allLessons.some((lesson) => {
    if (String(lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    return !["available", "cancelled", "completed", "no_show"].includes(lessonStatusValue(lesson));
  });
}

function normalizeMemberManagementTicketPayload(payload = null) {
  if (!payload?.productId) return payload;
  const total = Number(payload.totalSessions);
  const used = Number(payload.usedSessions);
  if (Number.isFinite(total) && Number.isFinite(used)) {
    payload.remainingSessions = Math.max(0, total - used);
  }
  if (Number(payload.remainingSessions) <= 0) {
    payload.ticketStatus = "expired";
    payload.recordStatus = "historical";
  } else if (!payload.ticketStatus) {
    payload.ticketStatus = "active";
    payload.recordStatus = "active";
  }
  return payload;
}

function memberTicketOwnershipLabel(ticket, member, allLiveData = adminLiveDataState) {
  const ownerUserId = String(ticket?.serverUserId || "");
  if (!ownerUserId) return "";
  const ownUserIds = new Set(memberServerUserIds(member).map(String));
  if (ownUserIds.has(ownerUserId)) return "본인권";
  const ownerName = (allLiveData.users || []).find((user) => String(user.id || "") === ownerUserId)?.name || "";
  return ownerName ? `파트너권 · ${ownerName}` : "파트너권";
}

function memberPossibleDuplicateTicketIds(managedTickets = []) {
  const ticketsByFingerprint = new Map();
  managedTickets.forEach((ticket) => {
    const fingerprint = memberTicketDuplicateFingerprint(ticket);
    if (!fingerprint) return;
    const grouped = ticketsByFingerprint.get(fingerprint) || [];
    grouped.push(ticket);
    ticketsByFingerprint.set(fingerprint, grouped);
  });
  return new Set([...ticketsByFingerprint.values()]
    .filter((grouped) => grouped.length > 1)
    .flatMap((grouped) => grouped.map((ticket) => String(ticket.serverTicketId || ""))));
}

function memberTicketCoachLabel(member, ticket, allLiveData = adminLiveDataState) {
  if (!ticket) return member.coach || "미배정";
  const coachRole = (allLiveData.coachRoles || []).find((role) => role.id === ticket.coachRoleId);
  if (coachRole?.display_name) return coachRole.display_name;
  return getCoachName(ticket.coachId) || member.coach || "미배정";
}

function memberInlineTicketDefinitionChanged(form) {
  if (!form?.dataset.ticketId) return false;
  return String(form.elements.productId?.value || "") !== String(form.dataset.initialProductId || "")
    || String(form.elements.coachRoleId?.value || "") !== String(form.dataset.initialCoachRoleId || "");
}

function memberOwnsTicket(ticket, member, allLiveData = adminLiveDataState) {
  if (!ticket || !member) return false;
  const userIds = memberServerUserIds(member);
  if (userIds.length) return userIds.includes(ticket.serverUserId);
  const ownerName = (allLiveData.users || []).find((user) => user.id === ticket.serverUserId)?.name;
  return ownerName === member.name;
}

function memberTicketLessonSetupError(error) {
  const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
  if (raw.includes("group_partner_required")) return "2대1 수업은 파트너를 선택해주세요";
  if (raw.includes("partner_must_be_different")) return "대표 회원과 다른 파트너를 선택해주세요";
  if (raw.includes("partner_not_found")) return "선택한 파트너 정보를 다시 확인해주세요";
  if (raw.includes("lesson_duration_conflict")) return "변경한 수업 시간이 다른 수업과 겹칩니다. 시간표를 먼저 조정해주세요";
  if (raw.includes("admin_role_required")) return "관리자 권한으로 로그인해주세요";
  return "수업 설정 저장에 실패했습니다";
}

function onsitePaymentTicketLabel(ticket) {
  const coach = getCoachName(ticket.coachId || "") || "코치 미배정";
  const period = [ticket.purchased, ticket.expires].filter(Boolean).join("~");
  return `${ticket.product || "회원권"} · ${coach} · 잔여 ${Number(ticket.remaining) || 0}회${period ? ` · ${period}` : ""}`;
}

function getTicketWeeklyUnitLimit(ticket) {
  const weeklyCount = Math.max(1, getTicketWeeklyCount(ticket));
  const explicitWeeklyLimit = Number(ticket?.maxSessionsPerWeek) || 0;
  const dailyLimit = Number(ticket?.maxSessionsPerDay) || 0;
  return Math.max(weeklyCount, explicitWeeklyLimit || dailyLimit || weeklyCount);
}

function getTicketLessonKind(ticket) {
  if (!ticket) return "";
  if (ticket.lessonKind) return ticket.lessonKind;
  if (ticket.product?.includes("2대1")) return "2대1";
  if (ticket.product?.includes("그룹")) return "그룹";
  return "개인";
}

function getTicketScheduleScope(ticket) {
  return ["weekday", "weekend", "mixed"].includes(ticket?.scheduleScope) ? ticket.scheduleScope : "weekday";
}

function getTicketScheduleDays(ticket, allScheduleDays = scheduleDays) {
  const scope = getTicketScheduleScope(ticket);
  if (scope === "mixed") return [...scheduleDays];
  return scope === "weekend" ? allScheduleDays.slice(5) : allScheduleDays.slice(0, 5);
}

function ticketAllowsScheduleDay(ticket, day) {
  return getTicketScheduleDays(ticket).includes(day);
}

function ticketUsageLabel(ticket) {
  const total = Math.max(0, Number(ticket?.total) || 0);
  const used = Math.max(0, Number(ticket?.used) || 0);
  const remaining = Math.max(0, Number(ticket?.remaining) || 0);
  return `총 ${total} / 소진 ${used} / 잔여 ${remaining}`;
}

function getTicketOptionLabel(ticket) {
  return `${getTicketDisplayProduct(ticket)} · ${ticketUsageLabel(ticket)}`;
}

function linkedTicketForBilling(item = {}) {
  return [...tickets, ...expiredTickets].find((ticket) => (
    String(ticket.serverTicketId || ticket.id || "") === String(item.ticketId || "")
  )) || null;
}

function ticketReviewLinkContext(allLiveData = adminLiveDataState) {
  const activeLinks = (allLiveData.groupTicketLinks || []).filter((link) => (
    ["active", "linked"].includes(String(link.status || "active").toLowerCase())
    && link.group_account_id
  ));
  const byAccount = new Map();
  const accountIdsByTicket = new Map();
  activeLinks.forEach((link) => {
    const accountId = String(link.group_account_id);
    const account = byAccount.get(accountId) || { userIds: new Set(), ticketIds: new Set() };
    if (link.user_id) account.userIds.add(String(link.user_id));
    if (link.ticket_id) {
      const ticketId = String(link.ticket_id);
      account.ticketIds.add(ticketId);
      const accountIds = accountIdsByTicket.get(ticketId) || new Set();
      accountIds.add(accountId);
      accountIdsByTicket.set(ticketId, accountIds);
    }
    byAccount.set(accountId, account);
  });
  return { byAccount, accountIdsByTicket };
}

function liveTicketParticipantIds(ticket, ticketParticipants = []) {
  if (ticketParticipants instanceof Map) {
    return [...new Set([
      ticket.user_id,
      ...(ticketParticipants.get(ticket.id) || []),
    ].filter(Boolean))];
  }
  return [...new Set([
    ticket.user_id,
    ...ticketParticipants.filter((item) => item.ticket_id === ticket.id).map((item) => item.user_id),
  ].filter(Boolean))];
}

function liveTicketLessonKind(product = {}) {
  return Number(product.group_size) === 2 ? "2대1" : "개인";
}

function managementReportTicketIsActive(ticket = {}, today = adminLocalDateKey(new Date())) {
  if (["expired", "cancelled", "inactive"].includes(String(ticket.status || "").toLowerCase())) return false;
  if (Number(ticket.remaining) <= 0) return false;
  if (ticket.starts && ticket.starts > today) return false;
  return !ticket.expires || ticket.expires >= today;
}
