// 회원 목록과 상세 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderPersonAvatar(target, person = {}, size = "small", baseClass = "") {
  if (!target) return;
  const hasPhoto = Boolean(personPhotoUrl(person));
  const name = person.name || person.displayName || "사용자";
  target.className = `${baseClass} person-avatar ${size} ${hasPhoto ? "has-photo" : "is-empty"}`.trim();
  target.setAttribute("aria-label", hasPhoto ? `${name} 프로필 사진` : "기본 프로필 이미지");
  target.innerHTML = personAvatarInnerMarkup(person);
}

function renderActiveMemberCard(member) {
  const attentionLabel = memberAttentionLabel(member);
  return `
    <button class="member-row active ${member.isGroupDisplay ? "group-child" : ""}" type="button" data-member-detail-id="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
      <span class="member-name">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "tiny")}
        <span class="member-name-copy">
          <strong>${escapeHtml(member.displayName || member.name)}</strong>
          <small>${escapeHtml(member.ticket || (member.isGroupDisplay ? "2대1 회원권" : "회원권 미정"))}</small>
        </span>
      </span>
      <span class="member-row-summary">
        <strong>${escapeHtml(memberRecentLessonLabel(member))}</strong>
        <small>${escapeHtml(memberUsageLabel(member))}</small>
      </span>
      ${attentionLabel ? `<span class="member-attention-badge">${escapeHtml(attentionLabel)}</span>` : ""}
      <span class="member-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function renderExpiredMemberCard(member) {
  return `
    <button class="member-row expired" type="button" data-member-detail-id="${member.id}">
      <span class="member-name">
        ${personAvatarMarkup(member, "tiny")}
        <span class="member-name-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.ticket || "이전 회원권")}</small></span>
      </span>
      <span class="member-row-summary"><strong>만료 ${escapeHtml(member.expiredAt || "-")}</strong><small>사용 ${escapeHtml(String(member.used || 0))}회</small></span>
      <span class="member-attention-badge">미재등록</span>
      <span class="member-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function renderMemberHeader(filter) {
  return "";
}

function renderMemberPager(total, page) {
  const pager = $("#memberPager");
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(total / memberPageSize));
  pager.innerHTML = `
    <span>10명씩 보기</span>
    <div class="member-page-row">
      ${Array.from({ length: pages }, (_, index) => `<button class="member-page-number ${index === page ? "is-current" : ""}" type="button" data-member-page="${index}">${index + 1}</button>`).join("")}
    </div>`;
}

function renderMembers() {
  ensureMemberLists();
  importNtrpRequests();
  const target = $("#memberList");
  if (!target) return;
  const filter = memberFilter();
  const query = memberQuery();
  const allItems = displayMemberItemsForFilter();
  const ticketFilter = state.memberTicketFilter || "all";
  const filteredByControls = allItems.filter((member) => {
    const ticketMatches = ticketFilter === "all" || (ticketFilter === "group" ? isGroupTicket(member) : !isGroupTicket(member));
    return ticketMatches;
  });
  const items = query ? filteredByControls.filter((member) => memberSearchValues(member).includes(query)) : filteredByControls;
  const page = normalizeMemberPage(items.length);
  const visible = items.slice(page * memberPageSize, page * memberPageSize + memberPageSize);
  if ($("#memberSearchInput") && $("#memberSearchInput").value !== state.memberQuery) $("#memberSearchInput").value = state.memberQuery || "";
  if ($("#memberSearchClearButton")) $("#memberSearchClearButton").hidden = !query;
  if ($("#memberTicketFilter")) $("#memberTicketFilter").value = ticketFilter;
  $$(".member-filter").forEach((button) => button.classList.toggle("is-active", button.dataset.memberFilter === filter));
  const advancedControls = $("#memberAdvancedControls");
  if (advancedControls) advancedControls.open = ["expiring", "paused_pending", "expired"].includes(filter);
  if ($("#memberFilterSummary")) {
    const filterLabel = { all: "내 담당 전체", active: "수강중", attention: "확인 필요", expiring: "만료 임박", paused_pending: "휴회·대기", expired: "만료" }[filter];
    const queryLabel = query ? ` · 검색 “${state.memberQuery.trim()}” 적용 중` : "";
    $("#memberFilterSummary").textContent = `${filterLabel} ${items.length}/${allItems.length}명 · ${page + 1}페이지${queryLabel}`;
  }
  const rows = visible
    .map((member) => (filter === "expired" ? renderExpiredMemberCard(member) : renderActiveMemberCard(member)))
    .join("");
  target.innerHTML = rows || coachEmptyState({
    title: filter === "expired" ? "만료회원이 없습니다" : "조건에 맞는 담당 회원이 없습니다",
    reason: query || ticketFilter !== "all"
      ? "검색어나 필터를 바꾸면 다른 회원을 확인할 수 있습니다."
      : "관리자가 회원과 코치를 연결하면 이 목록에 표시됩니다.",
    compact: true,
  });
  renderMemberPager(items.length, page);
}

function renderMemberDetailModal(member) {
  const target = $("#memberDetailContent");
  const modal = $("#memberDetailModal");
  if (!target || !modal || !member) return;
  const key = memberDetailKey(member);
  const phone = memberContactFor(member);
  const isRevealed = state.revealedMemberContactKey === key;
  const lessons = relatedLessonsForMember(member);
  const memberUserId = coachMemberChartUserId(member);
  const memberSettlement = coachMemberSettlementSummary(member);
  target.innerHTML = `
    <div class="lesson-modal-head member-detail-head">
      <div class="member-detail-identity">
        ${personAvatarMarkup({ ...member, name: member.displayName || member.name }, "small")}
        <div>
          <span>${member.statusCategory === "expired" ? "만료회원" : member.isGroupDisplay ? "2대1 회원" : member.status || "담당 회원"}</span>
          <strong>${escapeHtml(member.displayName || member.name)}</strong>
          <small>${escapeHtml(member.coach || "담당 코치 미정")} · ${escapeHtml(member.ticket || "회원권 미정")}</small>
        </div>
      </div>
      <button class="small-button" type="button" data-close-member-modal>닫기</button>
    </div>
    <section class="member-detail-section member-chart-section">
      <div class="member-chart-heading">
        <div><strong>수업 차트</strong><span>최근 기록부터 확인합니다.</span></div>
        <button class="small-button" type="button" data-refresh-member-chart="${escapeHtml(memberUserId)}">새로고침</button>
      </div>
      ${coachMemberChartPanelMarkup(memberUserId, member.displayName || member.name, 5)}
    </section>
    <button class="member-detail-settlement" type="button" data-open-coach-settlement>
      <span><b>이번 달 정산</b><small>내 담당 매출 기준</small></span>
      <strong id="memberDetailSettlementValue" data-linked="${String(memberSettlement.linked)}">${escapeHtml(memberSettlement.label)}</strong>
      <span aria-hidden="true">›</span>
    </button>
    <details class="member-detail-secondary">
      <summary>회원·회원권 정보</summary>
      <div class="modal-info-grid member-detail-grid">
        <article class="modal-info-card">
          <span>연락처</span>
          <strong>${isRevealed ? phone || "연락처 미입력" : maskPhone(phone)}</strong>
          <small>연락처 열람은 실제 서비스에서 기록으로 남깁니다.</small>
          <button class="small-button" type="button" data-reveal-member-contact="${key}">${isRevealed ? "표시 중" : "연락처 보기"}</button>
        </article>
        <article class="modal-info-card">
          <span>회원권</span>
          <strong>${member.remaining !== undefined ? `잔여 ${member.remaining}회` : member.used || "-"}</strong>
          <small>${member.statusCategory === "expired" ? `만료 ${member.expiredAt || "-"}` : member.lastLesson || "최근 수업 없음"}</small>
        </article>
        <article class="modal-info-card">
          <span>NTRP</span>
          <strong>자가 ${ntrpNumber(member.selfNtrp)} · 코치 ${ntrpNumber(member.coachNtrp)}</strong>
          <small>${member.ntrpRequest || "측정 요청 없음"}</small>
          <label class="member-detail-ntrp">
            <span>코치 측정</span>
            <select data-member-ntrp="${member.sourceMemberId || member.id}" data-member-group-name="${member.groupMemberName || ""}">
              ${ntrpLevels.map((level) => `<option value="${level}" ${member.coachNtrp === level ? "selected" : ""}>${ntrpNumber(level)}</option>`).join("")}
            </select>
          </label>
        </article>
        <article class="modal-info-card">
          <span>기본 정보</span>
          <strong>${member.birthYear || "출생연도 미입력"} · ${memberGenderLabel(member.gender)}</strong>
          <small>${escapeHtml(member.neighborhood || "거주동 미입력")}</small>
        </article>
      </div>
      <section class="member-detail-section">
        <strong>최근/예정 수업</strong>
        ${
          lessons.length
            ? lessons.map((lesson) => `<div><b>${lesson.day} ${lesson.time}</b><span>${lesson.type} · ${lesson.status} · ${lesson.task || ""}</span></div>`).join("")
            : `<p>연결된 수업이 없습니다.</p>`
        }
      </section>
      <section class="member-detail-section">
        <strong>운영 메모</strong>
        <p>${escapeHtml(member.note || "운영 메모가 없습니다.")}</p>
      </section>
    </details>
  `;
  openCoachModal("memberDetailModal");
  void syncCoachMemberChart(memberUserId, member.displayName || member.name);
}
