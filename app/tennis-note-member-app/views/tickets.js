// 이용권 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMemberTicketOverview(policy = loadAdminSchedulePolicy()) {
  const tickets = memberScheduleTicketOptions();
  if (!tickets.length) return renderMemberAssignedCoachSummary(policy);
  const selectedTicketId = ensureMemberScheduleTicketSelection();
  const ticket = tickets.find((item) => String(item.id) === selectedTicketId) || tickets[0];
  const title = ticket.title || ticket.productName || "회원권";
  const remaining = Math.max(0, Number(ticket.remaining) || 0);
  const status = window.TennisNoteTicketState?.label?.(ticket) || ticket.statusLabel || "사용 중";
  return `
    <section class="member-ticket-summary" aria-label="현재 회원권">
      <div class="member-ticket-summary-copy">
        <span>현재 회원권</span>
        <strong>${escapeHtml(title)} · 잔여 ${remaining}회</strong>
        <small>${escapeHtml(memberScheduleTicketCoachName(ticket, policy))} 코치 · ${escapeHtml(status)}</small>
      </div>
      ${tickets.length > 1 ? `
        <label class="member-ticket-summary-switch">
          <span>회원권 변경</span>
          <select id="memberScheduleTicketSelect" aria-label="확인할 회원권 변경">
            ${tickets.map((option) => `<option value="${escapeHtml(option.id)}" ${String(option.id) === String(ticket.id) ? "selected" : ""}>${escapeHtml(option.title || option.productName || "회원권")} · 잔여 ${Math.max(0, Number(option.remaining) || 0)}회</option>`).join("")}
          </select>
        </label>` : ""}
    </section>`;
}

function renderMemberCouponQuickStart() {
  const tickets = memberBookableCouponTickets();
  if (!tickets.length) return "";
  const selectedSource = tickets.find((ticket) => ticket.id === state.selectedMemberChangeSourceId);
  if (selectedSource) return "";
  return `
    <section class="member-coupon-quick-start" aria-label="쿠폰 수업 예약">
      <div>
        <span>쿠폰 예약</span>
        <strong>날짜를 고르고 가능한 시간을 누르세요</strong>
        <small>마지막 확인 후 바로 예약됩니다.</small>
      </div>
      <div role="group" aria-label="사용할 쿠폰 선택">
        ${tickets.map((ticket) => `
          <button class="member-coupon-ticket-button ${ticket.id === selectedSource?.id ? "is-active" : ""}" type="button" data-start-coupon-ticket="${escapeHtml(ticket.ticketId)}">
            <span>${escapeHtml(ticket.ticketTitle)}</span>
            <small>${escapeHtml(memberCoachShortName(ticket.coach))} · 잔여 ${Math.max(0, Number(ticket.remaining) || 0)}회</small>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderTickets() {
  const currentTickets = currentLiveTickets();
  const nextTickets = upcomingLiveTickets();
  const liveTicket = currentTickets[0] || nextTickets[0] || null;
  const total = currentTickets.length ? currentTickets.reduce((sum, ticket) => sum + Math.max(0, Number(ticket.total) || 0), 0) : Number(liveTicket?.total) || 0;
  const remaining = currentTickets.length ? currentTickets.reduce((sum, ticket) => sum + Math.max(0, Number(ticket.remaining) || 0), 0) : Number(liveTicket?.remaining) || 0;
  const used = currentTickets.length ? currentTickets.reduce((sum, ticket) => sum + Math.max(0, Number(ticket.used) || 0), 0) : Number(liveTicket?.used) || 0;
  const ticketTitle = currentTickets.length > 1 ? `현재 회원권 ${currentTickets.length}개` : liveTicket?.title || "현재 이용권 없음";
  const ticketStatus = liveTicket?.statusLabel || state.ticketSyncStatus?.text || "로그인 후 회원권 확인";
  const ticketPeriod = liveTicket?.expiresOn
    ? `${liveTicket.startsOn || "시작일 확인"} ~ ${liveTicket.expiresOn}`
    : "회원권 구매 또는 관리자 충전 필요";
  const lowTicket = currentTickets.some((ticket) => Number(ticket.remaining) <= 2);
  const needsTicket = !liveTicket;
  const upcoming = upcomingMemberLessons(2);
  const connectedSchedule = upcoming.length
    ? upcoming.map((lesson) => scheduleSummaryText(lesson, "")).filter(Boolean).join(" · ")
    : "연결된 고정시간 없음";
  if ($("#remainingCount")) $("#remainingCount").textContent = needsTicket ? "없음" : `${remaining}회`;
  if ($("#ticketStatus")) $("#ticketStatus").textContent = needsTicket ? "구매 필요" : `${total || "-"}회권`;
  if ($("#nextLessonDate")) $("#nextLessonDate").textContent = scheduleSummaryText(upcoming[0], "예정 없음");
  if ($("#followingLessonDate")) {
    const nextCoach = upcoming[0]?.coach || "";
    const following = scheduleSummaryText(upcoming[1], "");
    $("#followingLessonDate").textContent = [nextCoach, following ? `다음 ${following}` : ""].filter(Boolean).join(" · ");
  }
  if ($("#ticketOverview")) {
    $("#ticketOverview").innerHTML = `
      <article class="ticket-card primary">
        <span>${escapeHtml(ticketTitle)}</span>
        <strong>${remaining}회 남음</strong>
        <small>총 ${total || 0} / 소진 ${used} / 잔여 ${remaining}</small>
      </article>
      <article class="ticket-card">
        <span>회원권 상태</span>
        <strong>${escapeHtml(ticketStatus)}</strong>
        <small>${escapeHtml(ticketPeriod)}</small>
      </article>
      <article class="ticket-card ${lowTicket ? "alert" : ""}">
        <span>재등록</span>
        <strong>${needsTicket ? "구매 필요" : lowTicket ? "알림 필요" : "아직 여유"}</strong>
        <small>${needsTicket ? "회원권 구매 또는 관리자 충전" : lowTicket ? "결제 요청 가능" : "2회 이하부터 알림"}</small>
      </article>`;
  }
  if ($("#renewalPolicyPanel")) {
    $("#renewalPolicyPanel").innerHTML = `
      <article class="renewal-card ${lowTicket ? "alert" : ""}">
        <div>
          <span>재등록 기준</span>
          <strong>${lowTicket ? "지금 결제 안내 필요" : "잔여 2회부터 자동 알림"}</strong>
          <p>앱에서는 회원별 만료일 기준으로 결제합니다. 결제 전까지 기존 고정시간은 보호하고, 만료 후 미결제 상태가 되면 다음 주차부터 신청 가능 시간으로 열립니다.</p>
        </div>
        <button class="small-button" type="button" data-home-action="shop">연장 회원권 보기</button>
      </article>
      <article class="renewal-card">
        <div>
          <span>회원권 동기화</span>
          <strong>${escapeHtml(connectedSchedule)}</strong>
          <p>${escapeHtml(state.ticketSyncStatus?.text || "로그인 후 서버 회원권을 확인합니다.")}</p>
        </div>
      </article>`;
  }
  if (!$("#ticketHistory")) return;
  const ticketItems = state.lessonLogs;
  const ticketPage = normalizePage("ticket", ticketItems.length);
  const visibleTicketItems = paginateItems(ticketItems, ticketPage);
  $("#ticketHistory").innerHTML = visibleTicketItems
    .map((log) => {
      const confirmed = log.status === "confirmed";
      const step = curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum);
      return `
        <article class="lesson-status-card ${confirmed ? "done" : "wait"}">
          <div>
            <strong>${log.lessonLabel} 수업 진행</strong>
            <span>${log.content}</span>
            <small>${log.journalDate || ""} · ${confirmed ? "코치 코멘트 운동일지 등록됨" : "피드백 등록중"}</small>
          </div>
          <div class="lesson-status-actions">
            ${
              confirmed
                ? `<button class="small-button" type="button" data-open-journal-detail="${log.id}">코치 코멘트 확인</button>`
                : `<button class="small-button" type="button" disabled>피드백 등록중</button>`
            }
          </div>
        </article>`;
    })
    .join("") || memberEmptyState({
      title: "수업 이용내역이 없습니다",
      reason: "완료된 수업과 회원권 차감 내역이 여기에 표시됩니다.",
      action: { label: "시간표 보기", homeAction: "makeup", primary: false },
      compact: true,
    });
  renderListPager("ticketHistoryPager", "ticket", ticketPage, ticketItems.length);
}

function renderCurrentTicketPanel() {
  const target = $("#currentTicketPanel");
  if (!target) return;
  const currentTickets = currentLiveTickets();
  const upcomingTickets = upcomingLiveTickets();
  const demoTicket = !currentTickets.length && !upcomingTickets.length ? currentHoldingTicket() : null;
  const visibleTickets = [...currentTickets, ...upcomingTickets];
  if (demoTicket) visibleTickets.push(demoTicket);
  const currentTicketIds = new Set(currentTickets.map((ticket) => String(ticket.id || "")));
  const primaryTicket = visibleTickets[0] || null;
  const lifecycle = memberPurchaseLifecycle();
  const previousTicket = lifecycle === "returning" ? latestPreviousMembershipTicket() : null;
  const otherTickets = visibleTickets.slice(1);
  const primaryCard = primaryTicket
    ? membershipTicketCard(primaryTicket, { currentTicketIds, primary: true })
    : previousTicket
      ? `<article class="membership-empty-ticket membership-previous-ticket">
          <span>이전 회원권</span>
          <strong>${escapeHtml(previousTicket.title || "회원권")}</strong>
          <small>마지막 이용 ${escapeHtml(previousTicket.expiresOn || "기간 확인")}</small>
          <p>다시 시작하시겠어요? 이전 수업 조건을 불러왔습니다.</p>
        </article>`
      : `<article class="membership-empty-ticket"><strong>아직 등록된 회원권이 없습니다</strong><span>상품과 선생님·시간을 한 번에 선택할 수 있습니다.</span></article>`;
  const otherTicketList = otherTickets.length
    ? `<details class="membership-other-tickets">
        <summary>다른 회원권 ${otherTickets.length}개</summary>
        <div>${otherTickets.map((ticket) => membershipTicketCard(ticket, { currentTicketIds, compact: true })).join("")}</div>
      </details>`
    : "";
  const primaryAction = primaryTicket
    ? `<button class="primary-button" type="button" data-renew-ticket="${escapeHtml(primaryTicket.id || "")}">연장</button>`
    : previousTicket
      ? `<button class="primary-button" type="button" data-reregister-ticket="${escapeHtml(previousTicket.id || "")}">재등록</button>`
      : '<button class="primary-button" type="button" data-open-purchase-flow="new_purchase">등록</button>';
  const secondaryAction = primaryTicket
    ? '<button class="small-button membership-secondary-action" type="button" data-open-purchase-flow="add_coach">다른 코치·이용권 추가</button>'
    : previousTicket
      ? '<button class="small-button membership-secondary-action" type="button" data-open-purchase-flow="new_purchase">다른 상품으로 등록</button>'
      : "";
  target.innerHTML = `
    ${primaryCard}
    <div class="membership-action-row ${primaryTicket ? "has-ticket" : "is-empty"}">
      ${primaryAction}
      ${secondaryAction}
      <button class="small-button" type="button" data-open-discount-coupon-wallet>쿠폰함</button>
      <button class="small-button" type="button" data-open-membership-history>이용 내역</button>
    </div>
    ${otherTicketList}
    ${currentTickets.length > 1 ? `<p class="membership-multiple-note">수업별 회원권 ${currentTickets.length}개가 각각 차감됩니다. 다른 회원권에서 자세히 확인할 수 있습니다.</p>` : ""}`;
}

function renderGroupAccountPanel() {
  const target = $("#groupAccountPanel");
  const account = state.groupAccount;
  if (!target) return;
  if (!account?.members?.length) {
    target.innerHTML = "";
    return;
  }
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  target.innerHTML = `
    <section class="member-group-account-card" aria-label="2대1 공동관리 상태">
      <div class="member-group-account-heading">
        <div>
          <span>2대1 공동관리</span>
          <strong>${escapeHtml(account.name)}</strong>
          <small>${escapeHtml(account.coach)} · ${escapeHtml(account.schedule)}</small>
        </div>
        <b>${account.scheduleSyncRequired ? "시간표 자동 연동" : "연동 확인 필요"}</b>
      </div>
      <div class="member-group-people">
        ${account.members.map((member) => `
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${member.appStatus === "linked" ? "앱 연결" : "앱 없이 함께 사용"}</span>
            <small>${member.canManageSchedule ? "결제·일정관리 가능" : "연결 회원이 대신 관리"}</small>
          </div>
        `).join("")}
      </div>
      <div class="member-group-payment-status">
        <span>현재 결제 방식</span>
        <strong>${memberGroupPaymentModeLabel(account.paymentMode)}</strong>
        <small>${account.paymentMode === "separate" ? "두 회원권의 결제 상태를 각각 확인합니다." : `다음 결제 담당 ${escapeHtml(account.nextPayer)}`}</small>
      </div>
      <div class="member-group-actions">
        <button class="small-button" type="button" data-member-group-mode="representative">함께 결제</button>
        <button class="small-button" type="button" data-member-group-mode="alternate" ${linkedMembers.length < 2 ? "disabled" : ""}>번갈아 결제</button>
        <button class="small-button" type="button" data-member-group-mode="separate" ${linkedMembers.length < 2 ? "disabled" : ""}>각자 결제</button>
        <button class="ghost-button" type="button" data-member-group-link>${linkedMembers.length < 2 ? "파트너 앱 연결" : "파트너 연결됨"}</button>
      </div>
    </section>`;
}

function renderDiscountCouponWallet() {
  const coupons = state.discountCoupons || [];
  const available = availableDiscountCoupons();
  if ($("#profileCouponWalletCount")) $("#profileCouponWalletCount").textContent = `${available.length}장`;
  if ($("#profileCouponWalletSummary")) {
    $("#profileCouponWalletSummary").textContent = available.length
      ? `사용 가능 ${available.length}장 · 결제 적용 전 조건 확인`
      : "현재 사용 가능한 할인 쿠폰이 없습니다";
  }
  const target = $("#discountCouponWalletList");
  if (!target) return;
  target.innerHTML = coupons.length
    ? coupons.map((coupon) => {
      const status = discountCouponStatus(coupon);
      const expires = coupon.expiresAt ? `${formatDateTimeLabel(coupon.expiresAt)} 만료` : "기간 제한 없음";
      return `<article class="discount-coupon-wallet-card ${status.tone}">
        <div><strong>${escapeHtml(coupon.name || "할인 쿠폰")}</strong><span>${escapeHtml(status.label)}</span></div>
        <b>${escapeHtml(discountCouponValueLabel(coupon))}</b>
        <small>${escapeHtml(coupon.targetLabel || "회원권")} · ${escapeHtml(expires)}</small>
      </article>`;
    }).join("")
    : memberEmptyState({ title: "아직 발급된 할인 쿠폰이 없습니다", reason: "사용 가능한 쿠폰이 여기에 표시됩니다.", compact: true });
}
