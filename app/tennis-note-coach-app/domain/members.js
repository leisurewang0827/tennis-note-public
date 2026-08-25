// 회원 목록·검색·상세를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachRosterTicketState(ticket = {}, today = localDateKey()) {
  const status = String(ticket.status || "").toLowerCase();
  const startsOn = String(ticket.startsOn || "");
  const expiresOn = String(ticket.expiresOn || "");
  const remaining = Number(ticket.remainingSessions || 0);
  if (["refunded", "cancelled", "voided"].includes(status)) return "expired";
  if (status === "pending_payment" || (startsOn && startsOn > today)) return "paused_pending";
  if (status === "paused") return "paused_pending";
  if (status === "expired" || remaining <= 0 || (expiresOn && expiresOn < today)) return "expired";
  const expiringBoundary = new Date(`${today}T12:00:00`);
  expiringBoundary.setDate(expiringBoundary.getDate() + 14);
  const expiringOn = localDateKey(expiringBoundary);
  if ((expiresOn && expiresOn <= expiringOn) || remaining <= 2) return "expiring";
  return "active";
}

function formatScheduleMemberName(name) {
  const label = normalizeCoachScheduleMemberName(name);
  const lines = label
    .split(/[&·]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return `<span class="schedule-member-lines" aria-label="${escapeHtml(label)}">${(lines.length ? lines : [label]).map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</span>`;
}

function memberFilter() {
  return ["all", "active", "attention", "expiring", "paused_pending", "expired"].includes(state.memberFilter)
    ? state.memberFilter
    : "all";
}

function memberQuery() {
  return (state.memberQuery || "").trim().toLowerCase();
}

function memberContactFor(member) {
  if (member.groupMemberName && member.groupPhones?.[member.groupMemberName]) return member.groupPhones[member.groupMemberName];
  return member.phone || "";
}

function memberDetailKey(member) {
  return `${memberFilter()}:${member.sourceMemberId || member.id}:${member.groupMemberName || member.name}`;
}

function memberSearchValues(member) {
  return [
    member.name,
    member.displayName,
    member.groupMemberName,
    member.coach,
    member.ticket,
    member.lastLesson,
    member.expiredAt,
    member.status,
    member.note,
    member.selfNtrp,
    member.coachNtrp,
    member.ntrpRequest,
    maskPhone(memberContactFor(member)).slice(-4),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isGroupTicket(member) {
  return /2\s*대\s*1|그룹|group/i.test(`${member.ticket || ""} ${member.name || ""}`);
}

function groupMemberNames(member) {
  if (Array.isArray(member.groupMembers) && member.groupMembers.length) return member.groupMembers;
  if (!isGroupTicket(member) || !member.name.includes("&")) return [member.name];
  return member.name
    .split("&")
    .map((name) => name.trim())
    .filter(Boolean);
}

function displayMemberItemsForFilter() {
  const filter = memberFilter();
  const source = filter === "expired"
    ? state.expiredMembers
    : filter === "all"
      ? state.members
      : filter === "attention"
        ? state.members.filter((member) => Boolean(memberAttentionLabel(member)))
      : state.members.filter((member) => member.statusCategory === filter);
  return source.flatMap((member) => {
    const names = groupMemberNames(member);
    if (names.length <= 1) return [{ ...member, displayName: member.name, sourceMemberId: member.id, isGroupDisplay: false }];
    return names.map((name, index) => ({
      ...member,
      id: `${member.id}-${index}`,
      displayName: name,
      sourceMemberId: member.id,
      groupMemberName: name,
      groupPosition: index + 1,
      groupTotal: names.length,
      phone: member.groupPhones?.[name] || member.phone,
      coachNtrp: member.groupCoachNtrp?.[name] || member.coachNtrp,
      selfNtrp: member.groupSelfNtrp?.[name] || member.selfNtrp,
      isGroupDisplay: true,
    }));
  });
}

function normalizeMemberPage(total) {
  const maxPage = Math.max(0, Math.ceil(total / memberPageSize) - 1);
  state.memberPage = Math.min(Math.max(Number(state.memberPage) || 0, 0), maxPage);
  return state.memberPage;
}

function memberUsageLabel(member) {
  const total = Number(member.total);
  const used = Number(member.used);
  const remaining = Number(member.remaining);
  return Number.isFinite(total) && total > 0 && Number.isFinite(used)
    ? `총 ${total} / 소진 ${used} / 잔여 ${Number.isFinite(remaining) ? remaining : Math.max(0, total - used)}`
    : `잔여 ${member.remaining || 0}회`;
}

function memberAttentionLabel(member = {}) {
  const remaining = Number(member.remaining);
  if (member.statusCategory === "expiring") return "만료 임박";
  if (member.statusCategory === "paused_pending") return member.status || "휴회·대기";
  if (Number.isFinite(remaining) && remaining <= 1) return "재등록 확인";
  if (member.ntrpRequest === "요청") return "측정 요청";
  return "";
}

function memberRecentLessonLabel(member = {}) {
  const recent = String(member.lastLesson || "").trim();
  return recent ? (recent.startsWith("최근 ") ? recent : `최근 ${recent}`) : "최근 수업 없음";
}

function findMemberDetail(memberId, groupName = "") {
  const member = [...state.members, ...state.expiredMembers].find((item) => item.id === memberId);
  if (!member) return null;
  if (!groupName) return { ...member, displayName: member.name, sourceMemberId: member.id };
  return {
    ...member,
    displayName: groupName,
    sourceMemberId: member.id,
    groupMemberName: groupName,
    phone: member.groupPhones?.[groupName] || member.phone,
    coachNtrp: member.groupCoachNtrp?.[groupName] || member.coachNtrp,
    selfNtrp: member.groupSelfNtrp?.[groupName] || member.selfNtrp,
    isGroupDisplay: true,
  };
}

function coachMemberChartUserId(member = {}) {
  return String(member.serverUserId || member.sourceMemberId || member.id || "");
}

function coachMemberChartOutcomeLabel(item = {}) {
  return {
    completed: "수업 완료",
    no_show: "노쇼",
    absence: "불참",
    cancelled: "취소",
    holiday: "휴무",
  }[String(item.outcome || "").toLowerCase()] || "수업 기록";
}

function coachMemberChartDateLabel(item = {}) {
  const dateValue = String(item.lessonDate || item.finalizedAt || item.updatedAt || "").slice(0, 10);
  if (!dateValue) return item.lessonLabel || "이전 수업";
  const parsed = new Date(`${dateValue}T00:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? dateValue
    : parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return `${dateLabel}${item.startTime ? ` ${String(item.startTime).slice(0, 5)}` : ""}`;
}

function coachMemberChartLocalItems(userId = "", memberName = "") {
  const normalizedName = String(memberName || "").trim();
  return state.lessonLogs
    .filter((log) => {
      if ((log.participantResults || []).some((result) => String(result.userId || "") === String(userId))) return true;
      return normalizedName && recordMemberNames(log.member).includes(normalizedName);
    })
    .map((log) => {
      const participant = (log.participantResults || []).find((result) => String(result.userId || "") === String(userId)) || {};
      const completedValue = log.completedAt || participant.finalizedAt || participant.updatedAt || "";
      return {
        id: log.id,
        lessonId: log.serverLessonId || "",
        lessonDate: String(log.journalDate || completedValue).slice(0, 10),
        lessonLabel: log.lesson || "이전 수업",
        coachName: log.coach || currentCoachName(),
        outcome: participant.outcome || (log.status === "확인 완료" ? "completed" : ""),
        deductedSessions: Number(participant.deductedSessions ?? log.deductedSessions ?? (log.ticketDeducted ? 1 : 0)) || 0,
        coachComment: participant.coachComment || log.coachComment || log.content || "",
        nextGoal: participant.nextGoal || log.memberVisibleSummary || "",
        nextCurriculumSkillLabel: participant.nextCurriculumId || log.nextCurriculumId || "",
        finalizedAt: completedValue,
      };
    });
}

function coachMemberChartItems(userId = "", memberName = "") {
  const serverItems = coachMemberChartCache.get(String(userId))?.items || [];
  const merged = [...serverItems, ...coachMemberChartLocalItems(userId, memberName)];
  const seen = new Set();
  return merged
    .filter((item) => {
      const key = String(item.lessonId || item.id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftKey = `${left.lessonDate || ""} ${left.startTime || ""} ${left.finalizedAt || ""}`;
      const rightKey = `${right.lessonDate || ""} ${right.startTime || ""} ${right.finalizedAt || ""}`;
      return rightKey.localeCompare(leftKey);
    });
}

function coachMemberChartItemMarkup(item = {}) {
  const outcome = coachMemberChartOutcomeLabel(item);
  const deducted = Number(item.deductedSessions) || 0;
  const focus = item.nextGoal || item.nextCurriculumTitle || "";
  const curriculum = [item.nextCurriculumSkillLabel, item.nextCurriculumTitle].filter(Boolean).join(" · ");
  const detail = [item.technique, item.strength, item.improvement].filter(Boolean).join(" · ");
  return `
    <li class="member-chart-item">
      <time>${escapeHtml(coachMemberChartDateLabel(item))}</time>
      <div>
        <div class="member-chart-item-head">
          <strong>${escapeHtml(outcome)}</strong>
          <span>${deducted > 0 ? `${deducted}회 차감` : "차감 없음"}</span>
        </div>
        <p>${escapeHtml(item.coachComment || detail || "코치 기록이 완료되었습니다.")}</p>
        ${focus || curriculum ? `<small><b>다음 수업</b> ${escapeHtml(focus || curriculum)}</small>` : ""}
        <small>${escapeHtml([item.coachName, item.ticketName].filter(Boolean).join(" · "))}</small>
      </div>
    </li>`;
}

function coachMemberChartBodyMarkup(userId = "", memberName = "", limit = 5) {
  const cache = coachMemberChartCache.get(String(userId)) || {};
  const items = coachMemberChartItems(userId, memberName);
  if (!items.length && cache.status === "loading") return `<p class="member-chart-state">이전 수업 기록을 불러오는 중입니다.</p>`;
  if (!items.length && cache.status === "error") return `<p class="member-chart-state is-error">기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>`;
  if (!items.length) return `<p class="member-chart-state">아직 완료된 수업 기록이 없습니다.</p>`;
  const recent = items.slice(0, Math.max(1, Number(limit) || 5));
  const older = items.slice(recent.length);
  const latestFocus = recent[0]?.nextGoal || recent[0]?.nextCurriculumTitle || "";
  return `
    ${latestFocus ? `<div class="member-chart-focus"><span>이번 수업에서 볼 것</span><strong>${escapeHtml(latestFocus)}</strong></div>` : ""}
    <ol class="member-chart-timeline">${recent.map(coachMemberChartItemMarkup).join("")}</ol>
    ${older.length ? `
      <details class="member-chart-older">
        <summary>이전 기록 ${older.length}건 더 보기</summary>
        <ol class="member-chart-timeline">${older.map(coachMemberChartItemMarkup).join("")}</ol>
      </details>` : ""}`;
}

function coachMemberChartPanelMarkup(userId = "", memberName = "", limit = 5) {
  return `<div class="member-chart-body" data-member-chart-body data-member-user-id="${escapeHtml(userId)}" data-member-name="${escapeHtml(memberName)}" data-member-chart-limit="${Number(limit) || 5}">${coachMemberChartBodyMarkup(userId, memberName, limit)}</div>`;
}

function relatedLessonsForMember(member) {
  const name = member.groupMemberName || member.displayName || member.name;
  return weekLessons().filter((lesson) => String(lesson.member || "").includes(name) || String(lesson.member || "").includes(member.name)).slice(0, 3);
}

function relatedLogsForMember(member) {
  const name = member.groupMemberName || member.displayName || member.name;
  return state.lessonLogs.filter((log) => String(log.member || "").includes(name) || String(log.member || "").includes(member.name)).slice(0, 3);
}
