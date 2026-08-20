// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${options.title || "표시할 내용이 없습니다."}</p>`;
}

function memberHomeUpcomingLessonsMarkup(upcoming = []) {
  if (!upcoming.length) return "";
  const ticketMap = new Map(memberScheduleTicketOptions().map((ticket) => [String(ticket.id), ticket]));
  // The top card already shows the nearest lesson. Only expand this section
  // when the member actually needs to distinguish two or more tickets.
  if (ticketMap.size <= 1) return "";
  const groups = new Map();
  upcoming.forEach((lesson) => {
    const ticketId = memberLessonTicketId(lesson) || "unlinked";
    if (!groups.has(ticketId)) groups.set(ticketId, []);
    groups.get(ticketId).push(lesson);
  });
  return [...groups.entries()].map(([ticketId, ticketLessons]) => {
    const ticket = ticketMap.get(ticketId) || { id: ticketId, title: "회원권" };
    return `
      <section class="home-ticket-lessons">
        <div><strong>${escapeHtml(memberTicketCompactLabel(ticket))}</strong><small>잔여 ${Math.max(0, Number(ticket.remaining) || 0)}회</small></div>
        ${ticketLessons.slice(0, 3).map((lesson) => {
          const change = memberLessonChangeContext(lesson);
          const round = memberScheduleRoundLabel(lesson, true);
          return `
            <button type="button" data-home-change-lesson="${escapeHtml(lesson.id)}" data-home-ticket-id="${escapeHtml(ticketId)}">
              <span>${escapeHtml(round || "예정")}</span>
              <strong>${escapeHtml(lessonDateTimeLabel(lesson))}</strong>
              ${change
                ? `<small class="home-lesson-change"><b>시간 변경</b><i>${escapeHtml(change.original)} → ${escapeHtml(change.current)}</i></small>`
                : `<small>${escapeHtml(memberCoachShortName(lesson.coach || "담당 코치"))}</small>`}
            </button>`;
        }).join("")}
        <div class="home-ticket-lesson-actions">
          <button type="button" data-home-ticket-schedule="${escapeHtml(ticketId)}">전체 일정</button>
          <button type="button" data-home-ticket-availability="${escapeHtml(ticketId)}">변경·보강</button>
        </div>
      </section>`;
  }).join("");
}

function memberCurriculumLibraryMarkup(active) {
  const tracks = filteredMemberCurriculumTracks();
  const query = String(state.curriculumQuery || "").trim();
  if (!tracks.length) return "<p class='empty-text curriculum-empty'>조건에 맞는 커리큘럼이 없습니다.</p>";
  return tracks
    .map((track) => {
      const activeIndex = track.steps.findIndex((step) => step.id === active.id);
      const activeInTrack = activeIndex >= 0;
      const progressLabel = activeInTrack ? `${activeIndex + 1}/${track.steps.length}` : `${track.steps.length}단계`;
      return `
        <details class="curriculum-category curriculum-track" ${activeInTrack || query ? "open" : ""}>
          <summary class="curriculum-category-heading">
            <div>
              <strong>${escapeHtml(track.title)}</strong>
            </div>
            <b>${progressLabel}</b>
          </summary>
          <div class="curriculum-track-actions">
            <span>${escapeHtml(track.category || "기초")} · ${track.steps.length}개 단계</span>
          </div>
          <div class="curriculum-step-list">
            ${track.steps
              .map(
                (step) => `
                  <details class="curriculum-step ${step.id === active.id ? "is-current" : ""}">
                    <summary>
                      <span>${escapeHtml(step.stageLabel || step.level || "단계")} · ${escapeHtml(step.id)}</span>
                      <strong>${escapeHtml(step.title)}</strong>
                    </summary>
                    <div class="curriculum-step-details">
                      <p><b>오늘 할 일</b>${escapeHtml(step.goal || step.guide || step.focus || step.title)}</p>
                      ${curriculumThreeStepsMarkup(step)}
                      ${curriculumSupportMarkup(step)}
                      ${step.environmentNote ? `<small class="curriculum-environment-note">${escapeHtml(step.environmentNote)}</small>` : ""}
                      ${curriculumResourceLinks(step)}
                    </div>
                  </details>`,
              )
              .join("")}
          </div>
        </details>`;
    })
    .join("");
}

function membershipTicketCard(ticket = {}, options = {}) {
  const currentTicketIds = options.currentTicketIds || new Set();
  const compact = Boolean(options.compact);
  const totalSessions = Math.max(0, Number(ticket.total || 0));
  const remainingSessions = Math.max(0, Number(ticket.remaining || 0));
  const usedSessions = Math.max(0, Number(ticket.used ?? totalSessions - remainingSessions));
  const progress = totalSessions ? Math.min(100, Math.max(0, (usedSessions / totalSessions) * 100)) : 0;
  const derivedState = window.TennisNoteTicketState?.derive?.(ticket) || ticket.status || "current";
  const isPendingTicket = derivedState === "pending_payment";
  const isUpcomingTicket = derivedState === "upcoming";
  const isCurrentTicket = currentTicketIds.has(String(ticket.id || "")) || String(ticket.id || "").startsWith("demo-");
  const isLowTicket = isCurrentTicket && remainingSessions <= 2;
  const statusLabel = window.TennisNoteTicketState?.label?.(ticket)
    || (isPendingTicket ? "결제 대기" : isUpcomingTicket ? "시작 예정" : ticket.statusLabel || "사용 중");
  const ticketPeriod = ticket.expiresOn
    ? `${ticket.startsOn || "시작일 확인"} ~ ${ticket.expiresOn}`
    : "이용 기간 확인 중";
  const holding = isCurrentTicket ? memberHoldingRequests(ticket.id)[0] : null;
  const pendingPaymentId = ticket.providerPaymentId || "";
  const canResumePayment = pendingPaymentId && Number(ticket.paymentAmount || 0) > 0;
  const isCancellingPendingPayment = Boolean(pendingPaymentId && pendingPaymentCancelInFlight.has(pendingPaymentId));
  const pendingPaymentActions = isPendingTicket
    ? `<div class="membership-pending-actions">
        <button class="small-button" type="button" data-resume-pending-ticket="${escapeHtml(ticket.id)}" ${canResumePayment ? "" : "disabled"}>결제 계속</button>
        <button class="small-button" type="button" data-check-pending-ticket="${escapeHtml(ticket.id)}" ${pendingPaymentId ? "" : "disabled"}>상태 확인</button>
        <button class="small-button danger-button" type="button" data-cancel-pending-ticket="${escapeHtml(ticket.id)}" ${pendingPaymentId && !isCancellingPendingPayment ? "" : "disabled"}>${isCancellingPendingPayment ? "취소 중" : "대기 취소"}</button>
      </div>`
    : "";
  const holdingAction = isCurrentTicket && !isPendingTicket
    ? `<button class="membership-status-note" type="button" data-open-holding-request="${escapeHtml(ticket.id)}">${holding ? `이용 보류 · ${escapeHtml(holdingStatusLabel(holding.status))}` : "기간 보류 신청"}</button>`
    : "";
  return `
    <article class="membership-ticket-unit ${compact ? "is-compact" : ""}" data-member-ticket-id="${escapeHtml(ticket.id || "")}" ${options.primary ? "data-primary-member-ticket" : ""}>
      <div class="membership-primary-card ${isPendingTicket || isUpcomingTicket ? "is-pending" : ""} ${isLowTicket ? "is-low" : ""}">
        <div class="membership-primary-head">
          <span>${isUpcomingTicket || isPendingTicket ? "다음 회원권" : "현재 회원권"}</span>
          <small>${escapeHtml(statusLabel)}</small>
        </div>
        <strong>${escapeHtml(ticket.title || "회원권")}</strong>
        <div class="membership-remaining-row">
          <span>남은 횟수</span>
          <b>${remainingSessions}<em>회</em></b>
        </div>
        ${compact ? "" : `<div class="membership-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${totalSessions || 1}" aria-valuenow="${usedSessions}" aria-label="회원권 사용 진행률"><span style="width: ${progress}%"></span></div>`}
        <small class="membership-period">${escapeHtml(ticketPeriod)}${compact ? "" : ` · 총 ${totalSessions} / 사용 ${usedSessions}`}</small>
      </div>
      ${pendingPaymentActions}
      ${holdingAction}
    </article>`;
}

function purchaseScheduleSlotGroupsHtml(product = purchaseFlowProduct()) {
  const flow = purchaseFlowState();
  const status = purchaseScheduleAvailabilityState();
  if (status === "loading") return '<p class="purchase-availability-state" role="status">실제 시간표에서 가능한 시간을 확인하고 있습니다.</p>';
  if (status === "error") return '<p class="purchase-availability-state is-error" role="status">시간표를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>';
  if (status === "coach_error") return '<p class="purchase-availability-state is-error" role="status">운영 중인 선생님 정보를 확인하지 못했습니다. 임시 선생님을 대신 표시하지 않으며, 새로고침 후 다시 확인해 주세요.</p>';
  const slots = purchaseAvailableScheduleSlots(product);
  const coachSaleAvailability = product?.coachSaleAvailability || {};
  const coachSaleMode = String(product?.coachSaleMode || "all_active") === "selected" ? "selected" : "all_active";
  const coachOptions = purchaseCoachOptions().filter((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    return coachSaleMode === "selected" ? coachSaleAvailability[roleId] === true : coachSaleAvailability[roleId] !== false;
  });
  const sourceTicket = purchaseFlowSourceTicket();
  const sourceCoachId = flow.purchasePurpose === "renew_same" ? String(sourceTicket?.coachRoleId || "") : "";
  const visibleCoaches = sourceCoachId
    ? coachOptions.filter((coach) => String(coach.serverRoleId || coach.roleId || coach.id || "") === sourceCoachId)
    : coachOptions;
  const selectedCoach = visibleCoaches.find((coach) => (
    String(coach.serverRoleId || coach.roleId || coach.id || "") === String(flow.coachRoleId || sourceCoachId)
  ));
  const selectedCoachSlots = selectedCoach
    ? slots.filter((slot) => String(slot.coachRoleId) === String(flow.coachRoleId || sourceCoachId))
    : [];
  const coachSelector = sourceCoachId ? "" : flow.coachRoleId && selectedCoach
    ? `<article class="purchase-selected-coach">
        <div><span>선택한 선생님</span><strong>${escapeHtml(memberCoachShortName(selectedCoach.name || flow.coachName || "담당 코치"))} 코치</strong><small>${selectedCoachSlots[0] ? `가장 빠른 ${escapeHtml(purchaseDateLabel(selectedCoachSlots[0].lessonDate))} ${escapeHtml(selectedCoachSlots[0].time)}` : "가능한 시간을 확인해 주세요"}</small></div>
        <button class="small-button" type="button" data-clear-purchase-coach>다시 선택</button>
      </article>`
    : `<div class="purchase-coach-filter-grid" role="group" aria-label="선생님 선택">
      ${visibleCoaches.map((coach) => {
    const roleId = String(coach.serverRoleId || coach.roleId || coach.id || "");
    const coachSlots = slots.filter((slot) => String(slot.coachRoleId) === roleId);
    const first = coachSlots[0];
    const selected = roleId === String(flow.coachRoleId || "");
    return `<button class="purchase-coach-filter ${selected ? "is-selected" : ""} ${first ? "" : "is-unavailable"}" type="button"
        data-purchase-coach-filter="${escapeHtml(roleId)}" data-purchase-coach-filter-name="${escapeHtml(coach.name || "담당 코치")}" ${first ? "" : "disabled"}
        aria-pressed="${selected}"><strong>${escapeHtml(memberCoachShortName(coach.name || "담당 코치"))} 코치</strong><small>${first ? `가장 빠른 ${escapeHtml(purchaseDateLabel(first.lessonDate))} ${escapeHtml(first.time)}` : "현재 가능한 시간 없음"}</small></button>`;
  }).join("")}
    </div>`;
  const activeCoachRoleId = String(flow.coachRoleId || sourceCoachId || "");
  const matchingSlots = activeCoachRoleId
    ? slots.filter((slot) => String(slot.coachRoleId) === activeCoachRoleId)
    : [];
  const requiredCount = purchaseRequiredScheduleCount(product);
  const selectedSchedules = purchaseSelectedSchedules(product);
  const selectedSummary = selectedSchedules.length
    ? `<div class="purchase-selected-schedule-list" aria-label="선택한 수업 시간">${selectedSchedules.map((schedule, index) => `<span><b>${index + 1}</b>${escapeHtml(purchaseDateLabel(schedule.lessonDate))} ${escapeHtml(schedule.startTime)}</span>`).join("")}</div>`
    : '<p class="purchase-availability-state" role="status">요일과 시간을 선택해 주세요.</p>';
  return `<div class="purchase-slot-groups">
    ${coachSelector}
    ${activeCoachRoleId
    ? `<div class="purchase-schedule-picker-launch">
        <div class="purchase-schedule-count" role="status"><strong>${selectedSchedules.length}/${requiredCount}개 선택</strong><span>${matchingSlots.length ? "실제 시간표에서 선택" : "현재 가능한 시간이 없습니다"}</span></div>
        ${selectedSummary}
        <button class="primary-button" type="button" data-open-purchase-schedule ${matchingSlots.length ? "" : "disabled"}>요일·시간 선택</button>
      </div>`
    : '<p class="purchase-availability-state purchase-coach-first" role="status">선생님을 선택해 주세요.</p>'}
  </div>`;
}

function purchasePurposeOptionsHtml() {
  const flow = purchaseFlowState();
  const activeTickets = (state.liveTickets || []).filter((ticket) => !["expired", "refunded", "cancelled"].includes(String(ticket.status || "").toLowerCase()));
  if (!activeTickets.length) {
    flow.purchasePurpose = membershipProductFamilyId(purchaseFlowProduct() || {}) === "one-day" ? "one_day" : "new_purchase";
    const returning = memberPurchaseLifecycle() === "returning";
    return `<input type="hidden" value="new_purchase" /><p class="purchase-policy-note"><strong>${returning ? "재등록" : "신규 등록"}</strong> · ${returning ? "상품·선생님·시간을 다시 선택합니다. 이전 이용권 기록은 그대로 보관됩니다." : "모든 활성 코치의 실제 가능한 시간을 확인할 수 있습니다."}</p>`;
  }
  const renewing = flow.purchasePurpose === "renew_same";
  const selectedTicket = purchaseFlowSourceTicket() || activeTickets[0] || null;
  const lesson = purchaseTicketLesson(selectedTicket || {});
  const coachName = selectedTicket?.coach || memberScheduleTicketCoachName(selectedTicket || {}) || "담당 코치";
  const scheduleLabel = lesson ? `${lesson.day || ""} ${lesson.time || ""}`.trim() : "기존 정규시간";
  return `
    <section class="purchase-purpose-section" aria-label="구매 목적">
      <div class="purchase-purpose-toggle" role="group" aria-label="연장 또는 새 선생님 추가">
        <button class="purchase-choice ${renewing ? "is-selected" : ""}" type="button" data-purchase-purpose="renew_same" aria-pressed="${renewing}"><strong>연장</strong><small>선생님·시간 유지</small></button>
        <button class="purchase-choice ${flow.purchasePurpose === "add_coach" ? "is-selected" : ""}" type="button" data-purchase-purpose="add_coach" aria-pressed="${flow.purchasePurpose === "add_coach"}"><strong>새 이용권</strong><small>다른 선생님 선택</small></button>
      </div>
      ${renewing && selectedTicket ? `<article class="purchase-renewal-summary">
        <div><span>연장 대상</span><strong>${escapeHtml(memberTicketCompactLabel(selectedTicket))}</strong><small>${escapeHtml(memberCoachShortName(coachName))} 코치 · ${escapeHtml(scheduleLabel)}</small></div>
        <button class="small-button" type="button" data-purchase-schedule-mode="${flow.scheduleMode === "change" ? "keep" : "change"}">${flow.scheduleMode === "change" ? "기존 시간 유지" : "시간만 변경"}</button>
      </article>
      ${activeTickets.length > 1 ? `<label class="purchase-renewal-ticket-field"><span>다른 이용권 선택</span><select id="purchaseRenewalTicket" aria-label="연장할 이용권 선택">${activeTickets.map((ticket) => `<option value="${escapeHtml(ticket.id || "")}" ${String(ticket.id) === String(flow.renewalTicketId) ? "selected" : ""}>${escapeHtml(memberTicketCompactLabel(ticket))} · ${escapeHtml(memberCoachShortName(ticket.coach || "담당 코치"))} 코치</option>`).join("")}</select></label>` : ""}` : '<p class="purchase-policy-note">새 선생님을 먼저 선택한 뒤 그 선생님의 가능한 시간만 고릅니다. 기존 이용권은 그대로 유지됩니다.</p>'}
    </section>`;
}

function purchaseEmptyFamilyHtml(familyId = "") {
  const family = membershipProductFamilyDefinition(familyId);
  if (family.id === "one-day") {
    return `
      <div class="empty-state compact purchase-family-empty">
        <strong>원데이 1회권 판매 준비 중</strong>
        <span>가격이 등록되면 이 화면에서 바로 결제할 수 있습니다. 지금은 가능한 코치와 시간을 먼저 문의해 주세요.</span>
        <button class="small-button" type="button" data-open-one-day-inquiry>원데이 문의</button>
      </div>`;
  }
  return memberEmptyState({ title: `${family.label} 판매 준비 중`, reason: "상품이 등록되면 이 화면에서 바로 선택할 수 있습니다.", compact: true });
}

function purchaseStepTwoHtml() {
  const flow = purchaseFlowState();
  const product = purchaseFlowProduct();
  if (!product) return memberEmptyState({ title: "상품을 먼저 선택해 주세요", reason: "이전 단계에서 회원권을 골라주세요.", compact: true });
  const sourceTicket = purchaseFlowSourceTicket();
  const coupon = membershipProductFacet(product, "productKind") === "coupon";
  const selectedCoachName = flow.coachName || sourceTicket?.coach || state.profile.mainCoach || "";
  const fixedRenewal = Boolean(sourceTicket && !coupon);
  if (fixedRenewal && flow.scheduleMode === "keep") {
    return "";
  }
  const availabilityTitle = fixedRenewal
    ? `${memberCoachShortName(selectedCoachName || "담당 코치")} 코치`
    : flow.coachRoleId ? `${memberCoachShortName(flow.coachName || "선택한 선생님")} 코치` : "코치 선택";
  return `
    <div class="purchase-step-intro"><strong>${availabilityTitle}</strong></div>
    <section class="purchase-choice-section purchase-actual-slots" aria-label="실제 예약 가능한 시간">
      ${purchaseScheduleSlotGroupsHtml(product)}
    </section>`;
}
