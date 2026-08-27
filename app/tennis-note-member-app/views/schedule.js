// 시간표 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMemberAssignedCoachSummary(policy = loadAdminSchedulePolicy()) {
  const tickets = memberScheduleCoachTickets();
  if (!tickets.length) {
    const initialSetup = memberInitialCoachSelectionSource();
    if (initialSetup) {
      return `
        <section class="member-assigned-coaches is-setup" role="status">
          <strong>첫 정규시간과 담당 코치를 선택해 주세요</strong>
          <span>${escapeHtml(initialSetup.ticketTitle || "정규 회원권")} 조건에 맞는 시간만 선택할 수 있습니다.</span>
        </section>`;
    }
    return `
      <section class="member-assigned-coaches is-empty" role="status">
        <strong>담당 코치 연결 확인 필요</strong>
        <span>로그인 계정과 회원권 연결을 확인하면 시간표가 표시됩니다.</span>
      </section>`;
  }
  const groupedTickets = tickets.reduce((groups, ticket) => {
    const roleId = String(ticket.coachRoleId || "");
    const coach = policy.coaches.find((item) => String(item.serverRoleId || item.roleId || item.id || "") === roleId);
    const coachName = memberCoachShortName(coach?.name || ticket.coach || "담당 코치");
    const status = window.TennisNoteTicketState?.label?.(ticket) || ticket.statusLabel || "사용 중";
    const ticketName = ticket.title || "회원권";
    if (!groups.has(roleId)) groups.set(roleId, { coachName, tickets: [] });
    groups.get(roleId).tickets.push(`${ticketName} · ${status}`);
    return groups;
  }, new Map());
  const items = [...groupedTickets.values()].map((group) => (
    `<span><b>${escapeHtml(group.coachName)}</b><small>${group.tickets.map(escapeHtml).join(" / ")}</small></span>`
  )).join("");
  return `
    <section class="member-assigned-coaches" aria-label="회원권 담당 코치">
      <strong>내 회원권 담당 코치</strong>
      <div>${items}</div>
    </section>`;
}

function renderMemberScheduleTicketPicker() {
  const tickets = memberScheduleTicketOptions();
  if (tickets.length <= 1) return "";
  const selectedTicketId = ensureMemberScheduleTicketSelection();
  return `
    <section class="member-ticket-picker" aria-label="확인할 회원권 선택">
      <strong>회원권별 일정</strong>
      <div role="group" aria-label="회원권별 일정 선택">
        ${tickets.map((ticket) => `
          <button class="member-ticket-picker-button ${String(ticket.id) === selectedTicketId ? "is-active" : ""}" type="button" data-member-ticket-filter="${escapeHtml(ticket.id)}">
            <span>${escapeHtml(memberTicketCompactLabel(ticket))}</span>
            <small>잔여 ${Math.max(0, Number(ticket.remaining) || 0)}회</small>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderMemberScheduleOperationNotice(day) {
  const operation = memberScheduleOperationDay(day);
  if (!operation) return "";
  const mode = String(operation.mode || "");
  const label = operation.label || "운영 안내";
  const detail = mode === "closed"
    ? "회원 예약이 열리지 않습니다."
    : mode === "shortened"
      ? `${operation.startTime || "-"}~${operation.endTime || "-"}만 운영합니다.`
      : "공휴일에도 정상 운영합니다.";
  const title = mode === "closed" ? "휴무" : mode === "shortened" ? "단축 운영" : "정상 운영";
  return `<p class="member-operation-notice is-${escapeHtml(mode || "normal")}" role="status"><strong>${title}</strong><span>${escapeHtml(label)} · ${escapeHtml(detail)}</span></p>`;
}

function renderMemberMobileSegment(day, segment, policy, baseLessons, scheduleLessons) {
  const times = makeMemberStartTimes(segment.start, segment.end);
  const segmentStart = segment.startMinutes;
  const segmentEnd = segment.endMinutes;
  const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
  const coaches = memberDayCoaches(day, policy, baseLessons).filter((coach) => {
    const worksHere = (coach.workBlocks || []).some((block) => block.days.includes(day)
      && minutesFromTime(block.start) < segmentEnd
      && minutesFromTime(block.end) > segmentStart);
    const hasLesson = dayLessons.some((lesson) => memberLessonCoach(lesson, policy).id === coach.id
      && minutesFromTime(lesson.time) < segmentEnd
      && minutesFromTime(lesson.time) + lessonDuration(lesson) > segmentStart);
    return worksHere || hasLesson;
  });
  if (!times.length || !coaches.length) return `<p class="member-mobile-empty">이 시간대에 운영하는 코치가 없습니다.</p>`;
  const availableCount = dayLessons.filter((lesson) => lesson.status === "available"
    && minutesFromTime(lesson.time) >= segmentStart
    && minutesFromTime(lesson.time) < segmentEnd).length;
  const hasMakeupSlots = dayLessons.some((lesson) => lesson.status === "available" && /보강/.test(lesson.type || ""));
  const hasCouponSlots = dayLessons.some((lesson) => lesson.status === "available" && lesson.type === "쿠폰 예약 가능");
  return `
    <section class="member-mobile-segment">
      <div class="member-mobile-segment-title">
        <strong>${segment.start}~${segment.end}</strong>
        <span>${coaches.map((coach) => escapeHtml(memberCoachShortName(coach.name))).join(" · ")} · ${hasMakeupSlots ? "보강 가능" : hasCouponSlots ? "쿠폰 예약" : "변경 가능"} ${availableCount}개</span>
      </div>
      <div class="member-mobile-lane-board" style="--coach-count:${coaches.length}; --slot-count:${times.length};">
        <div class="member-mobile-lane-head time">시간</div>
        ${coaches.map((coach) => `<div class="member-mobile-lane-head ${memberCoachColorClass(coach.name)}">${escapeHtml(memberCoachShortName(coach.name))}</div>`).join("")}
        <div class="member-mobile-time-rail">${times.map((time) => `<span>${time}</span>`).join("")}</div>
        ${coaches.map((coach) => {
          const coachLessons = dayLessons.filter((lesson) => memberLessonCoach(lesson, policy).id === coach.id);
          return `
            <div class="member-mobile-coach-lane">
              ${times.map((time, index) => {
                const available = coachLessons.find((lesson) => lesson.status === "available" && lesson.time === time);
                const working = isMemberCoachWorking(coach, day, time, 10);
                const initialOrder = available ? state.regularInitialSelections.indexOf(available.id) : -1;
                const availableLabel = /보강/.test(available?.type || "") ? "보강 가능" : available?.type === "쿠폰 예약 가능" ? "쿠폰 예약 가능" : "수업 변경 가능";
                const slotLabel = initialOrder >= 0
                  ? `${initialOrder + 1}번째`
                  : available?.releasedRegularSlot ? "정규·보강" : /보강/.test(available?.type || "") ? "보강" : available?.type === "쿠폰 예약 가능" ? "예약" : "선택";
                return `<button class="member-mobile-slot ${available ? "available" : working ? "busy" : "off"} ${initialOrder >= 0 ? "is-initial-selected" : ""} ${available?.releasedRegularSlot ? "released-regular-slot" : ""}" type="button" ${available ? `data-lesson="${available.id}"` : "disabled"} style="grid-row:${index + 1};" aria-label="${day}요일 ${time} ${escapeHtml(memberCoachShortName(coach.name))} ${available ? availableLabel : "신청 불가"}">${available ? slotLabel : ""}</button>`;
              }).join("")}
              ${coachLessons.filter((lesson) => lesson.status !== "available" && memberScheduleVisibleLesson(lesson, policy) && minutesFromTime(lesson.time) >= segmentStart && minutesFromTime(lesson.time) < segmentEnd).map((lesson) => {
                const startIndex = times.indexOf(lesson.time);
                if (startIndex < 0) return "";
                const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                const isMine = isOwnMemberScheduleLesson(lesson);
                const note = memberScheduleExceptionLabel(lesson);
                const roundLabel = memberScheduleRoundLabel(lesson, isMine);
                return `<button class="member-mobile-lesson lesson-source lesson-kind-${memberLessonVisualKind(lesson)} ${isMine ? `mine ${lesson.status}` : "occupied"} ${memberCoachColorClass(lesson.coach)} ${memberLessonStateClass(lesson)}" type="button" ${isMine ? `data-lesson="${lesson.id}"` : "disabled"} style="${memberLessonColorStyle(lesson, policy)};grid-row:${startIndex + 1} / span ${span};"><strong>${escapeHtml(memberScheduleCardName(lesson, isMine))}</strong><span class="schedule-card-round ${roundLabel ? "" : "is-empty"}">${escapeHtml(roundLabel || "-")}</span><span>${escapeHtml(memberCoachShortName(lesson.coach))}</span><small class="schedule-card-note ${note ? "" : "is-empty"}">${escapeHtml(note || "-")}</small></button>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderMemberMobileSchedule(policy, baseLessons, scheduleLessons) {
  const availableLessons = scheduleLessons
    .filter((lesson) => lesson.status === "available")
    .sort((left, right) => (
      String(left.lessonDate || "").localeCompare(String(right.lessonDate || ""))
      || minutesFromTime(left.time) - minutesFromTime(right.time)
    ));
  const availabilityKey = `${state.serverChangeCandidateKey || state.selectedMemberChangeSourceId || "fallback"}:${activeMemberWeek().startDate}`;
  if (state.memberScheduleMode === "availability"
    && availableLessons.length
    && state.memberAvailabilityAutoDayKey !== availabilityKey) {
    state.selectedScheduleDay = availableLessons[0].day;
    state.memberAvailabilityAutoDayKey = availabilityKey;
  }
  const selectedDay = selectedMemberScheduleDay();
  if (state.memberScheduleMode === "availability") {
    const loadState = memberChangeCandidateUiState(
      memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId),
    );
    const selectedLessons = availableLessons.filter((lesson) => lesson.day === selectedDay);
    const groupedByCoach = selectedLessons.reduce((groups, lesson) => {
      const coach = memberCoachShortName(lesson.coach || "담당 코치");
      if (!groups.has(coach)) groups.set(coach, []);
      groups.get(coach).push(lesson);
      return groups;
    }, new Map());
    const source = memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
    const emptyMessage = loadState === "loading"
      ? "신청 가능한 시간을 확인하고 있습니다."
      : loadState === "error"
        ? "시간을 불러오지 못했습니다. 다시 확인해 주세요."
        : availableLessons.length
          ? `${dayName(selectedDay)}에는 신청 가능한 시간이 없습니다.`
          : memberCandidateEmptyReason(source);
    return `
      <div class="member-mobile-schedule member-mobile-availability">
        <div class="member-mobile-day-strip" aria-label="신청 날짜 선택">
          ${days.map((day) => {
            const count = availableLessons.filter((lesson) => lesson.day === day).length;
            return `<button class="member-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-member-schedule-day="${day}"><strong>${day}</strong><span>${memberScheduleDateLabel(day)}</span><b>${count || "-"}</b></button>`;
          }).join("")}
        </div>
        ${renderMemberScheduleOperationNotice(selectedDay)}
        <div class="member-available-coach-groups" aria-live="polite">
          ${groupedByCoach.size
            ? [...groupedByCoach.entries()].map(([coach, candidates]) => `
                <section class="member-available-coach-group">
                  <div><strong>${escapeHtml(coach)}</strong><span>${candidates.length}개 가능</span></div>
                  <div class="member-available-time-grid">
                    ${candidates.map((lesson) => `
                      <button class="member-available-time" type="button" data-lesson="${escapeHtml(lesson.id)}" aria-label="${escapeHtml(lessonDateTimeLabel(lesson))} ${escapeHtml(coach)} 신청">
                        <strong>${escapeHtml(lesson.time)}</strong>
                        <span>${lesson.policy === "coach" ? "승인 필요" : "선택"}</span>
                        <small>${escapeHtml(memberCandidateWindowLabel(lesson))}</small>
                      </button>`).join("")}
                  </div>
                </section>`).join("")
            : `<p class="member-mobile-empty">${escapeHtml(emptyMessage)}</p>`}
        </div>
      </div>`;
  }
  const segments = memberMobileScheduleSegments(selectedDay, policy, baseLessons, scheduleLessons);
  const requestOnly = memberScheduleRequestOnly(policy);
  return `
    <div class="member-mobile-schedule ${requestOnly ? "member-request-only" : ""}">
      <div class="member-mobile-day-strip" aria-label="날짜 선택">
        ${days.map((day) => `<button class="member-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-member-schedule-day="${day}"><strong>${day}</strong><span>${memberScheduleDateLabel(day)}</span></button>`).join("")}
      </div>
      ${renderMemberScheduleOperationNotice(selectedDay)}
      ${segments.length
        ? segments.map((segment, index) => `${index > 0 ? `<div class="member-mobile-break"><strong>${segments[index - 1].end}~${segment.start}</strong><span>수업 없음</span></div>` : ""}${renderMemberMobileSegment(selectedDay, segment, policy, baseLessons, scheduleLessons)}`).join("")
        : `<p class="member-mobile-empty">${selectedDay}요일은 현재 등록된 운영시간이 없습니다.</p>`}
    </div>`;
}

function renderMemberOwnSchedule() {
  const ownLessons = currentWeekMemberLessons();
  const pendingSchedules = currentWeekPendingPurchaseSchedules();
  return `
    <section class="member-own-schedule" aria-label="이번 주 내 일정">
      <div class="member-own-schedule-head">
        <strong>이번 주 내 수업</strong>
        ${ownLessons.length ? `<button class="small-button" type="button" data-open-member-change>시간 변경</button>` : ""}
      </div>
      <div class="member-own-lesson-list">
        ${ownLessons.length
          ? ownLessons.map((lesson) => {
              const change = memberLessonChangeContext(lesson);
              const round = memberScheduleRoundLabel(lesson, true);
              return `
              <button class="member-own-lesson" type="button" data-lesson="${lesson.id}">
                <span class="member-own-lesson-date">${escapeHtml(lessonDateTimeLabel(lesson))}</span>
                <span class="member-own-lesson-detail">
                  <strong>${escapeHtml([round, memberCoachShortName(lesson.coach)].filter(Boolean).join(" · "))}</strong>
                  ${change
                    ? `<small class="member-lesson-change"><b>변경된 수업</b><i>변경 전 ${escapeHtml(change.original)}</i><i>현재 ${escapeHtml(change.current)}</i></small>`
                    : `<small>${escapeHtml(lesson.type || "레슨")}</small>`}
                </span>
                <span class="member-own-lesson-action">변경</span>
              </button>`;
            }).join("")
          : pendingSchedules.length
            ? '<p class="member-mobile-empty">결제 확인 후 이곳에 정식 수업으로 표시됩니다.</p>'
            : memberEmptyState({
              title: "이번 주 수업이 없습니다",
              reason: "회원권이 있다면 시간표에서 예약 가능한 시간을 확인해 주세요.",
              action: { label: "시간표 보기", homeAction: "makeup" },
              compact: true,
            })}
      </div>
      ${pendingSchedules.length ? `<section class="member-pending-purchase-schedules" aria-label="입금 확인 대기 일정">
        <div><strong>결제 확인 대기</strong><span>결제 또는 입금 확인 후 정식 수업으로 등록됩니다.</span></div>
        ${pendingSchedules.map((schedule) => `<article class="member-pending-purchase-schedule">
          <span>${escapeHtml(pendingPurchaseScheduleLabel(schedule))}</span>
          <strong>${escapeHtml([memberCoachShortName(schedule.coachName || "담당 코치"), schedule.productName || "회원권"].filter(Boolean).join(" · "))}</strong>
          <small>${schedule.active === false ? "시간 보관 만료 · 신청을 취소하고 다시 선택해 주세요." : schedule.expiresAt ? `${escapeHtml(formatDateTimeLabel(schedule.expiresAt))}까지 시간 보관` : schedule.paymentMethod === "bank_transfer" ? "입금 확인 대기" : "결제 확인 대기"}</small>
          ${schedule.paymentStatus === "ready" && schedule.providerPaymentId ? `<button class="small-button" type="button" data-cancel-pending-purchase="${escapeHtml(schedule.providerPaymentId)}" data-pending-purchase-title="${escapeHtml(schedule.productName || "회원권")}">신청 취소</button>` : ""}
        </article>`).join("")}
      </section>` : ""}
    </section>`;
}

function renderMemberAvailabilityOverview(scheduleLessons, compact = false) {
  if (memberHasPendingPaymentOnly()) {
    return `
      <section class="member-availability-overview">
        ${memberEmptyState({
          title: "결제 확인 후 예약할 수 있습니다",
          reason: "결제가 확인되면 회원권 조건에 맞는 시간만 자동으로 표시됩니다.",
          action: { label: "결제 상태 확인", homeAction: "shop" },
          compact: true,
        })}
      </section>`;
  }
  const dayOrder = new Map(days.map((day, index) => [day, index]));
  const available = scheduleLessons
    .filter((lesson) => lesson.status === "available")
    .sort((left, right) =>
      (dayOrder.get(left.day) ?? 99) - (dayOrder.get(right.day) ?? 99)
      || minutesFromTime(left.time) - minutesFromTime(right.time));
  if (!available.length) {
    const source = memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
    return `
      <section class="member-availability-overview">
        ${memberEmptyState({
          title: "지금 신청 가능한 시간이 없습니다",
          reason: memberCandidateEmptyReason(source),
          compact: true,
        })}
        <div class="member-availability-actions">
          <button class="small-button" type="button" data-member-schedule-mode="mine">내 일정 보기</button>
        </div>
      </section>`;
  }
  const grouped = available.reduce((result, lesson) => {
    if (!result[lesson.day]) result[lesson.day] = [];
    result[lesson.day].push(lesson);
    return result;
  }, {});
  return `
    <section class="member-availability-overview ${compact ? "is-compact" : ""}">
      <div class="member-availability-heading">
        <div><strong>신청 가능한 시간</strong><span>${available.length}개</span></div>
      </div>
      <details class="member-availability-details" open>
        <summary>시간 목록 보기</summary>
        <div class="member-availability-days">
        ${days.filter((day) => grouped[day]?.length).map((day) => `
          <section class="member-availability-day">
            <strong>${day}요일 <small>${memberScheduleDateLabel(day)}</small></strong>
            <div>
              ${grouped[day].map((lesson) => `
                <button class="member-availability-slot" type="button" data-lesson="${lesson.id}">
                  <b>${lesson.time}</b>
                  <span>${escapeHtml(memberCoachShortName(lesson.coach))}</span>
                  <small>${lesson.type === "보강 신청가능" ? "보강" : lesson.type === "쿠폰 예약 가능" ? "쿠폰" : "변경"}</small>
                </button>`).join("")}
            </div>
          </section>`).join("")}
        </div>
      </details>
    </section>`;
}

function renderMemberChangeInlineBar() {
  const sources = memberAllInlineChangeSources();
  if (!sources.length) {
    return memberEmptyState({
      title: "변경하거나 보강할 수업이 없습니다",
      reason: "예정 수업 또는 보강 가능 수업이 생기면 이 시간표에서 바로 선택할 수 있습니다.",
      compact: true,
    });
  }
  if (!sources.some((lesson) => lesson.id === state.selectedMemberChangeSourceId)) {
    state.selectedMemberChangeSourceId = "";
  }
  const source = sources.find((lesson) => lesson.id === state.selectedMemberChangeSourceId) || null;
  if (!source) {
    return `
      <section class="member-booking-summary" aria-label="변경할 수업 선택">
        <div class="member-booking-summary-main">
          <span>1. 기존 수업 선택</span>
          <strong>변경할 수업을 먼저 골라주세요</strong>
          <small>선택 전에는 새 시간을 잡지 않습니다.</small>
        </div>
        <label class="member-booking-source-switch">
          <span>변경할 수업</span>
          <select id="memberInlineChangeSource" aria-label="변경할 기존 수업 선택">
            <option value="">수업을 선택하세요</option>
            ${sources.map((lesson) => `<option value="${escapeHtml(lesson.id)}">${escapeHtml(memberChangeSourceOptionLabel(lesson))}</option>`).join("")}
          </select>
        </label>
      </section>`;
  }
  const sourceTicketId = memberLessonTicketId(source);
  if (sourceTicketId) state.selectedMemberScheduleTicketId = sourceTicketId;
  const isCouponBooking = Boolean(source.couponBooking);
  const couponPeriodSummary = memberCouponPeriodSummary(source);
  const couponPeriodWarning = memberCouponPeriodInfo(source)?.isShorterThanProduct;
  const loadState = memberChangeCandidateUiState(source);
  const activeWeekCandidateCount = state.serverChangeCandidates.filter(memberChangeCandidateInActiveWeek).length;
  const statusText = loadState === "loading"
    ? "가능한 시간을 확인 중입니다"
    : loadState === "error"
      ? "시간을 불러오지 못했습니다"
      : loadState === "ready"
        ? activeWeekCandidateCount > 0
          ? `이번 주 가능 ${activeWeekCandidateCount}개`
          : state.serverChangeCandidates.length > 0
            ? "다른 주에 가능한 시간이 있습니다"
            : memberCandidateEmptyReason(source)
        : "수업을 고르면 가능한 시간만 표시합니다";
  const sourceLabel = isCouponBooking
    ? "예약할 회원권"
    : source.resumePausedTicket
      ? "복귀할 회원권"
      : source.regularInitialBooking
        ? "첫 수업 회원권"
        : source.status === "makeup_due"
          ? "보강할 수업"
          : "변경할 수업";
  const instruction = isCouponBooking || source.regularInitialBooking
    ? "날짜를 선택하고 가능한 시간을 누르세요."
    : "새 날짜와 가능한 시간을 선택하세요.";
  return `
    <section class="member-booking-summary ${couponPeriodWarning ? "has-period-warning" : ""}" aria-label="${escapeHtml(sourceLabel)}">
      <div class="member-booking-summary-main">
        <span>${escapeHtml(sourceLabel)}</span>
        <strong>${escapeHtml(memberBookingSourceTitle(source))}</strong>
        <small>${escapeHtml(memberBookingSourceMeta(source))}</small>
        ${couponPeriodSummary ? `<small class="member-booking-period">${escapeHtml(couponPeriodSummary)}</small>` : ""}
      </div>
      ${sources.length > 1 ? `<label class="member-booking-source-switch">
        <span>다른 수업 선택</span>
        <select id="memberInlineChangeSource" aria-label="예약 또는 변경 대상 선택">
          <option value="">수업을 선택하세요</option>
          ${sources.map((lesson) => `<option value="${escapeHtml(lesson.id)}" ${lesson.id === source.id ? "selected" : ""}>${escapeHtml(memberChangeSourceOptionLabel(lesson))}</option>`).join("")}
        </select>
      </label>` : `<input id="memberInlineChangeSource" type="hidden" value="${escapeHtml(source.id)}" />`}
      <p class="member-booking-instruction"><strong>${escapeHtml(statusText)}</strong><span>${escapeHtml(loadState === "error"
        ? state.serverChangeCandidateError || "인터넷 연결을 확인한 뒤 다시 시도해 주세요."
        : instruction)}</span></p>
      ${loadState === "error" ? '<button class="small-button" type="button" data-retry-member-change>다시 확인</button>' : ""}
    </section>`;
}

function renderRegularInitialScheduleBar() {
  const source = regularInitialSourceLesson();
  if (!source) return "";
  const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
  const selected = state.regularInitialSelections
    .map((id) => memberScheduleOptions().find((lesson) => lesson.id === id))
    .filter(Boolean);
  return `
    <section class="regular-initial-bar" aria-label="첫 정규시간 선택">
      <div>
        <span>첫 정규시간</span>
        <strong>${selected.length}/${requiredCount} 선택</strong>
        <small>${selected.length
          ? selected.map((lesson) => `${lesson.day} ${lesson.time}`).join(" · ")
          : "시간표의 가능한 칸을 눌러주세요."}</small>
      </div>
      <button class="primary-button" type="button" data-confirm-initial-schedule ${selected.length === requiredCount ? "" : "disabled"}>확정</button>
    </section>`;
}

function renderMemberBookingShortcuts() {
  const couponTickets = memberBookableCouponTickets();
  return `
    <section class="member-booking-shortcuts" aria-label="추가 예약">
      ${couponTickets.length ? "" : `
        <article>
          <div><strong>쿠폰 레슨</strong><span>필요한 횟수만 구매해 예약할 수 있습니다.</span></div>
          <button class="small-button" type="button" data-flex-booking-products="coupon">쿠폰 회원권 보기</button>
        </article>`}
      <article>
        <div><strong>원데이 레슨</strong><span>실제 가능한 코치와 시간을 선택해 바로 신청할 수 있습니다.</span></div>
        <button class="small-button" type="button" data-start-one-day-purchase>원데이 시간 보기</button>
      </article>
    </section>`;
}

function renderDynamicMemberSchedule() {
  const activeWeek = activeMemberWeek();
  const scheduleMode = state.memberScheduleMode || "mine";
  const quickWeeks = memberQuickWeekOptions();
  $("#memberWeekSwitcher").innerHTML = `
    <button class="ghost-button schedule-week-arrow" type="button" data-change-member-week="-1" ${state.activeMemberWeekIndex <= memberScheduleMinWeekOffset ? "disabled" : ""} aria-label="이전 주" title="이전 주">&lt;</button>
    <div class="schedule-period-summary">
      <strong>${activeWeek.label}</strong>
      <span>${activeWeek.range} · 관리자 근무시간 기준</span>
    </div>
    <button class="ghost-button schedule-week-arrow" type="button" data-change-member-week="1" ${state.activeMemberWeekIndex >= memberScheduleMaxWeekOffset ? "disabled" : ""} aria-label="다음 주" title="다음 주">&gt;</button>
    <div class="member-week-quick-nav" role="group" aria-label="가까운 주차 선택">
      ${quickWeeks.map(({ offset, label, week }) => `
        <button class="member-week-quick-button ${Number(state.activeMemberWeekIndex) === offset ? "is-active" : ""}" type="button" data-select-member-week="${offset}" aria-pressed="${Number(state.activeMemberWeekIndex) === offset}">
          <strong>${label}</strong><span>${week.range}</span>
        </button>`).join("")}
    </div>
  `;

  const loadState = activeMemberScheduleLoadState();
  const selectedSource = memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
  const couponCandidateView = scheduleMode === "availability" && Boolean(selectedSource?.couponBooking);
  if (loadState === "loading" && !couponCandidateView) {
    $("#scheduleGrid").innerHTML = `
      <section class="tn-empty-state" role="status" aria-live="polite">
        <strong>시간표 확인 중</strong>
        <p>선택한 주의 수업과 신청 가능한 시간을 불러오고 있습니다.</p>
      </section>`;
    return;
  }

  if (loadState === "error" && !couponCandidateView) {
    $("#scheduleGrid").innerHTML = `
      <section class="tn-empty-state" role="alert">
        <strong>시간표를 불러오지 못했습니다</strong>
        <p>${escapeHtml(state.scheduleV2SyncError)}</p>
        <button id="retryMemberScheduleV2" class="primary-button" type="button">다시 불러오기</button>
      </section>`;
    $("#retryMemberScheduleV2")?.addEventListener("click", () => {
      state.scheduleV2SyncError = "";
      state.liveLessonsLoaded = false;
      refreshSelectedMemberScheduleWeek();
    });
    return;
  }

  const policy = loadAdminSchedulePolicy();
  const requestOnly = memberScheduleRequestOnly(policy);
  const scheduleTimeList = memberScheduleTimes(policy);
  const baseLessons = memberScheduleLessons();
  const scheduleLessons = memberScheduleOptions();
  const dayCoachMap = new Map(days.map((day) => [day, memberDayCoaches(day, policy, baseLessons)]));
  const dayColumnTracks = days
    .map((day) => {
      const laneCount = Math.max(1, dayCoachMap.get(day)?.length || 0);
      return `${laneCount * memberScheduleCoachLaneWidth + Math.max(0, laneCount - 1) * 3}px`;
    })
    .join(" ");
  const ticketOverview = renderMemberTicketOverview(policy);
  ensureMemberScheduleTicketSelection();
  $$("[data-member-schedule-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.memberScheduleMode === scheduleMode));
  if (scheduleMode === "mine") {
    $("#scheduleGrid").innerHTML = `${ticketOverview}${renderMemberOwnSchedule()}`;
    return;
  }
  const inlineChangeBar = renderMemberChangeInlineBar();
  if (memberHasPendingPaymentOnly()) {
    $("#scheduleGrid").innerHTML = renderMemberAvailabilityOverview(scheduleLessons, true);
    return;
  }
  if (!memberAssignedCoachRoleIds().size && !memberInitialCoachSelectionSource()) {
    $("#scheduleGrid").innerHTML = `
      ${memberEmptyState({
        title: "시간표를 열 수 없습니다",
        reason: "현재 로그인 계정에 담당 코치가 연결된 회원권이 없습니다. 관리자에게 계정 연결을 요청해 주세요.",
        compact: true,
      })}`;
    return;
  }
  $("#scheduleGrid").innerHTML = `
    ${renderRegularInitialScheduleBar()}
    ${inlineChangeBar}
    ${renderMemberMobileSchedule(policy, baseLessons, scheduleLessons)}
    <div class="member-full-schedule-action">
      <button class="small-button" type="button" data-toggle-full-member-schedule aria-expanded="${state.memberScheduleFullView}">
        ${state.memberScheduleFullView ? "가능한 시간만 보기" : "전체 시간표 보기"}
      </button>
      <span>${state.memberScheduleFullView ? "등록된 수업과 근무시간을 함께 표시합니다." : "필요할 때만 전체 시간표를 펼칠 수 있습니다."}</span>
    </div>
    ${state.memberScheduleFullView ? `
    <div class="member-desktop-schedule">
    <div class="member-duration-schedule ${requestOnly ? "member-request-only" : ""}" role="table" aria-label="회원 전체 시간표" style="--day-count:${days.length}; --slot-count:${scheduleTimeList.length}; grid-template-columns:64px ${dayColumnTracks};">
      <div class="member-duration-head time-head">시간</div>
      ${days
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ name: "운영없음" }];
          return `
            <div class="member-duration-head member-day-head" style="--coach-count:${displayCoaches.length};">
              <strong>${day}요일</strong>
              <div class="member-coach-head-row">
                ${displayCoaches.map((coach) => `<span>${escapeHtml(memberCoachShortName(coach.name))}</span>`).join("")}
              </div>
            </div>`;
        })
        .join("")}
      <div class="member-time-rail">
        ${scheduleTimeList.map((time) => `<div class="member-duration-time">${time}</div>`).join("")}
      </div>
      ${days
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ id: `closed-${day}`, name: "운영없음", workBlocks: [] }];
          const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
          const visibleLessons = dayLessons.filter((lesson) => lesson.status !== "available" && memberScheduleVisibleLesson(lesson, policy));
          const availableLessons = dayLessons.filter((lesson) => lesson.status === "available");
          return `
            <div class="member-day-column" style="--slot-count:${scheduleTimeList.length}; --coach-count:${displayCoaches.length};">
              ${displayCoaches.map((coach, coachIndex) => {
                const runs = memberDesktopScheduleBackgroundRuns(policy, day, coach, scheduleTimeList);
                return `
                  <div class="member-slot-lane" aria-hidden="true" style="grid-row:1 / span ${scheduleTimeList.length}; grid-column:${coachIndex + 1};"></div>
                  ${runs.filter((run) => run.state !== "base").map((run) => `
                    <div class="member-slot-run ${run.state}" aria-hidden="true" style="grid-row:${run.startIndex + 1} / span ${run.span}; grid-column:${coachIndex + 1};">
                      <span>${requestOnly ? "" : escapeHtml(run.label)}</span>
                    </div>`).join("")}`;
              }).join("")}
              ${availableLessons
                .map((lesson) => {
                  const startIndex = scheduleTimeList.indexOf(lesson.time);
                  if (startIndex < 0) return "";
                  const lessonCoach = memberLessonCoach(lesson, policy);
                  const coachIndex = displayCoaches.findIndex((coach) => coach.id === lessonCoach.id);
                  if (coachIndex < 0) return "";
                  const initialOrder = state.regularInitialSelections.indexOf(lesson.id);
                  return `
                    <button
                      class="member-slot-bg available ${initialOrder >= 0 ? "is-initial-selected" : ""} ${lesson.releasedRegularSlot ? "released-regular-slot" : ""} ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}"
                      type="button"
                      data-lesson="${lesson.id}"
                      aria-label="${day}요일 ${lesson.time} ${memberCoachShortName(lessonCoach.name)} ${/보강/.test(lesson.type || "") ? "보강 신청 가능" : "수업 변경 신청 가능"}"
                      style="grid-row:${startIndex + 1}; grid-column:${coachIndex + 1};"
                    >
                      <span>${initialOrder >= 0 ? `${initialOrder + 1}번째 선택` : lesson.releasedRegularSlot ? "정규 자리 · 보강 가능" : /보강/.test(lesson.type || "") ? "보강 가능" : "선택 가능"}</span>
                    </button>`;
                })
                .join("")}
              ${visibleLessons
                .map((lesson) => {
                  const startIndex = scheduleTimeList.indexOf(lesson.time);
                  if (startIndex < 0) return "";
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const lessonCoach = memberLessonCoach(lesson, policy);
                  const coachIndex = displayCoaches.findIndex((coach) => coach.id === lessonCoach.id);
                  if (coachIndex < 0) return "";
                  const isMine = isOwnMemberScheduleLesson(lesson);
                  const lessonClass = isMine ? `mine ${lesson.status}` : "occupied";
                  const lessonAction = isMine ? `data-lesson="${lesson.id}"` : "disabled";
                  const note = memberScheduleExceptionLabel(lesson);
                  const roundLabel = memberScheduleRoundLabel(lesson, isMine);
                  return `
                    <button
                      class="member-duration-lesson lesson-source lesson-kind-${memberLessonVisualKind(lesson)} ${lessonClass} ${memberCoachColorClass(lesson.coach)} ${memberLessonStateClass(lesson)}"
                      type="button"
                      ${lessonAction}
                      style="${memberLessonColorStyle(lesson, policy)}; grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <strong>${escapeHtml(memberScheduleCardName(lesson, isMine))}</strong>
                      <span class="schedule-card-round ${roundLabel ? "" : "is-empty"}">${escapeHtml(roundLabel || "-")}</span>
                      <span>${escapeHtml(memberCoachShortName(lesson.coach))}</span>
                      <small class="schedule-card-note ${note ? "" : "is-empty"}">${escapeHtml(note || "-")}</small>
                    </button>`;
                })
                .join("")}
            </div>`;
        })
        .join("")}
    </div>
    </div>
    ` : ""}
    ${renderMemberBookingShortcuts()}`;
  $$("#scheduleGrid [data-lesson]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleScheduleClick(button.dataset.lesson);
    });
  });
}

function renderSchedule() {
  renderDynamicMemberSchedule();
  return;
  const activeWeek = activeMemberWeek();
  $("#memberWeekSwitcher").innerHTML = `
    <button class="ghost-button" type="button" data-change-member-week="-1" ${state.activeMemberWeekIndex === 0 ? "disabled" : ""}>이전 주</button>
    <div>
      <strong>${activeWeek.label}</strong>
      <span>${activeWeek.range} · ${activeWeek.note}</span>
    </div>
    <button class="ghost-button" type="button" data-change-member-week="1" ${state.activeMemberWeekIndex === memberScheduleWeeks.length - 1 ? "disabled" : ""}>다음 주</button>
  `;
  const scheduleLessons = memberScheduleLessons();
  const scheduleCoaches = memberScheduleCoachNames(scheduleLessons);
  $("#scheduleGrid").innerHTML = `
    <div class="member-duration-schedule" role="table" aria-label="회원 전체 시간표" style="--day-count:${days.length}; --slot-count:${times.length}; --coach-count:${scheduleCoaches.length};">
      <div class="member-duration-head time-head">시간</div>
      ${days
        .map(
          (day) => `
            <div class="member-duration-head">
              <strong>${day}요일</strong>
              <small>${scheduleCoaches.map(shortCoachName).join(" · ")}</small>
            </div>`,
        )
        .join("")}
      <div class="member-time-rail">
        ${times.map((time) => `<div class="member-duration-time">${time}</div>`).join("")}
      </div>
      ${days
        .map((day) => {
          const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
          const visibleLessons = dayLessons.filter((lesson) => lesson.status !== "available");
          const availableLessons = dayLessons.filter((lesson) => lesson.status === "available");
          return `
            <div class="member-day-column" style="--slot-count:${times.length}; --coach-count:${scheduleCoaches.length};">
              ${times
                .map((time, timeIndex) =>
                  scheduleCoaches
                    .map(
                      (coach, coachIndex) => `
                        <button
                          class="member-slot-bg"
                          type="button"
                          disabled
                          style="grid-row:${timeIndex + 1}; grid-column:${coachIndex + 1};"
                        >
                          <span>신청불가</span>
                        </button>`,
                    )
                    .join(""),
                )
                .join("")}
              ${availableLessons
                .map((lesson) => {
                  const startIndex = Math.max(0, times.indexOf(lesson.time));
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const coachIndex = Math.max(0, scheduleCoaches.indexOf(lesson.coach));
                  return `
                    <button
                      class="member-slot-bg available ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}"
                      type="button"
                      data-lesson="${lesson.id}"
                      style="grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <span>가능</span>
                      <small>${policyShortLabel(lesson.policy, memberChangePolicySnapshot(lesson))}</small>
                    </button>`;
                })
                .join("")}
              ${visibleLessons
                .map((lesson) => {
                  const startIndex = Math.max(0, times.indexOf(lesson.time));
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const coachIndex = Math.max(0, scheduleCoaches.indexOf(lesson.coach));
                  const isMine = isOwnMemberScheduleLesson(lesson);
                  const title = memberLessonTitle(lesson, isMine);
                  const lessonClass = isMine ? `mine ${lesson.status}` : "occupied";
                  const lessonAction = isMine ? `data-lesson="${lesson.id}"` : "disabled";
                  return `
                    <button
                      class="member-duration-lesson ${lessonClass} ${memberCoachColorClass(lesson.coach)}"
                      type="button"
                      ${lessonAction}
                      style="grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <strong>${title}</strong>
                      <span>${shortCoachName(lesson.coach)}</span>
                    </button>`;
                })
                .join("")}
            </div>`;
        })
        .join("")}
    </div>`;
}

function renderAvailableSlots() {
  const target = $("#availableSlotList");
  const selectedId = $("#makeupSlot")?.value;
  const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const scheduleLoadState = activeMemberScheduleLoadState();
  const candidateLoadState = memberChangeCandidateUiState(source);
  const loadState = scheduleLoadState !== "ready"
    ? scheduleLoadState
    : ["loading", "error"].includes(candidateLoadState) ? candidateLoadState : "ready";
  const availableLessons = loadState === "ready" ? memberAvailableSlotsForSelectedLesson() : [];
  const selected = memberScheduleOptions().find((lesson) => lesson.id === selectedId);
  const isMakeupDue = source?.status === "makeup_due";
  const isCouponBooking = Boolean(source?.couponBooking);
  const isRegularInitialBooking = Boolean(source?.regularInitialBooking);
  const isPausedResumeBooking = Boolean(source?.resumePausedTicket);
  const requiredCount = Math.max(1, Number(source?.frequencyPerWeek) || 1);
  const selectedIds = isRegularInitialBooking ? state.regularInitialSelections : [selectedId].filter(Boolean);
  if ($("#requestMakeup")) $("#requestMakeup").textContent = memberChangeSubmitLabel(source, selected);
  renderMemberChangeReasonControl(source, selected);
  if ($("#changePolicyNote")) {
    $("#changePolicyNote").textContent = isRegularInitialBooking
      ? isPausedResumeBooking
        ? `주 ${requiredCount}회분의 시간을 선택하면 휴회를 마치고 정규시간이 확정됩니다.`
        : `주 ${requiredCount}회분의 시간을 선택하면 정규시간이 확정됩니다. 같은 날도 선택할 수 있습니다.`
      : isMakeupDue
        ? "불참 처리된 수업의 보강입니다. 시간을 선택하면 즉시 예약됩니다."
        : isCouponBooking
          ? "담당 코치의 빈 시간을 선택하면 쿠폰 수업으로 즉시 예약됩니다."
          : selected
            ? policyDetail(selected.policy, memberChangePolicySnapshot(selected))
            : state.serverChangeBlockedReason
              ? memberChangeBlockedMessage(state.serverChangeBlockedReason, memberChangePolicySnapshot())
              : memberChangePolicySnapshot()
                ? policyDetail(
                  memberChangePolicySnapshot()?.outcome === "auto" ? "auto" : "coach",
                  memberChangePolicySnapshot(),
                )
                : "수업 변경 규칙을 확인하고 있습니다.";
  }
  renderChangeModalSummary();
  if (!target) return;
  if (loadState === "loading") {
    target.innerHTML = memberEmptyState({
      title: "변경 가능한 시간을 확인하고 있습니다",
      reason: "선택한 주의 최신 시간표를 불러온 뒤 신청 가능한 시간만 표시합니다.",
      compact: true,
    });
    updateChangeRequestAvailability([], loadState);
    return;
  }
  if (loadState === "error") {
    target.innerHTML = memberEmptyState({
      title: "시간표를 불러오지 못했습니다",
      reason: state.serverChangeCandidateError || state.scheduleV2SyncError || "인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      compact: true,
    }) + '<button id="retryMemberChangeSlots" class="primary-button" type="button">다시 확인</button>';
    $("#retryMemberChangeSlots")?.addEventListener("click", () => {
      if (memberChangeUsesServerCandidates(source)) syncMemberChangeCandidates(source);
      else refreshSelectedMemberScheduleWeek();
    });
    updateChangeRequestAvailability([], loadState);
    return;
  }
  target.innerHTML =
    availableLessons
      .map(
        (lesson) => {
          const directionLabel = !isMakeupDue && !isCouponBooking && memberChangeDirection(source, lesson) === "advance"
            ? "앞당길 수 있음"
            : memberCandidateWindowLabel(lesson);
          return `
          <button class="slot-card ${selectedIds.includes(lesson.id) ? "is-selected" : ""} ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}" type="button" data-select-slot="${lesson.id}">
            <strong>${escapeHtml(lessonDateTimeLabel(lesson))}</strong>
            <span>${lesson.coach}</span>
            <small>${selectedIds.includes(lesson.id)
              ? isRegularInitialBooking ? `${selectedIds.indexOf(lesson.id) + 1}번째 선택` : "선택됨"
              : isRegularInitialBooking ? `${selectedIds.length}/${requiredCount} 선택` : directionLabel}</small>
          </button>`;
        },
      )
      .join("") || memberEmptyState({
        title: "변경 가능한 시간이 없습니다",
        reason: memberCandidateEmptyReason(source),
        action: { label: "회원권 확인", homeAction: "shop", primary: false },
        compact: true,
      });
  updateChangeRequestAvailability(availableLessons, loadState);
}

function renderChangeModalSummary() {
  const target = $("#changeModalSummary");
  if (!target) return;
  const absence = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value)
    || memberScheduleOptions().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const makeup = memberScheduleOptions().find((lesson) => lesson.id === $("#makeupSlot")?.value);
  if (!absence || !makeup) {
    target.textContent = absence?.status === "makeup_due" ? "예약할 보강 시간을 선택해 주세요." : absence?.couponBooking ? "쿠폰으로 예약할 시간을 선택해 주세요." : "기존 수업과 희망 시간을 확인합니다.";
    return;
  }
  target.textContent = absence.status === "makeup_due"
    ? `${absence.day} ${absence.time} 불참 수업의 보강을 ${makeup.day} ${makeup.time}에 예약합니다.`
    : absence.couponBooking
      ? `${absence.ticketTitle}으로 ${makeup.day} ${makeup.time} 수업을 예약합니다.`
      : memberChangePolicySnapshot(makeup)?.isGroup
        ? `그룹수업 전체를 ${absence.day} ${absence.time}에서 ${makeup.day} ${makeup.time}으로 변경 요청합니다.`
      : memberChangeDirection(absence, makeup) === "advance"
        ? `${absence.day} ${absence.time} 수업을 ${makeup.day} ${makeup.time}으로 앞당깁니다.`
        : `${absence.day} ${absence.time} 수업을 ${makeup.day} ${makeup.time} 수업으로 변경합니다.`;
}

function renderSelectedMemberScheduleWeek() {
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
}
