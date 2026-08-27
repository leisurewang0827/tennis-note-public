// tickets 관련 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderDiscountIssueControls() {
  const policySelect = $("#discountIssuePolicy");
  const memberSelect = $("#discountIssueMember");
  const referralSelect = $("#discountIssueReferralMember");
  if (!policySelect || !memberSelect || !referralSelect) return;
  const previousPolicy = policySelect.value;
  const previousMember = memberSelect.value;
  const previousReferral = referralSelect.value;
  const policies = discountPolicies.filter((policy) => normalizeDiscountPolicy(policy).status === "사용");
  policySelect.innerHTML = policies.length
    ? policies.map((policy) => `<option value="${escapeHtml(policy.id)}">${escapeHtml(policy.title)} · ${escapeHtml(policy.type === "percent" ? `${policy.value}%` : `${money.format(policy.value)}원`)}</option>`).join("")
    : '<option value="">사용 가능한 정책 없음</option>';
  if (policies.some((policy) => String(policy.id) === previousPolicy)) policySelect.value = previousPolicy;

  const visibleMembers = discountIssueEligibleMembers($("#discountIssueMemberSearch")?.value || "");
  const memberOptions = visibleMembers.map((member) => `<option value="${escapeHtml(member.serverUserId)}">${escapeHtml(member.name || "회원")} · ${escapeHtml(maskMemberPhone(member.phone || ""))}</option>`).join("");
  memberSelect.innerHTML = memberOptions || '<option value="">검색 결과 없음</option>';
  if (visibleMembers.some((member) => String(member.serverUserId) === previousMember)) memberSelect.value = previousMember;

  const allMembers = discountIssueEligibleMembers();
  referralSelect.innerHTML = `<option value="">선택 안 함</option>${allMembers
    .filter((member) => String(member.serverUserId) !== String(memberSelect.value || ""))
    .map((member) => `<option value="${escapeHtml(member.serverUserId)}">${escapeHtml(member.name || "회원")} · ${escapeHtml(maskMemberPhone(member.phone || ""))}</option>`).join("")}`;
  if (allMembers.some((member) => String(member.serverUserId) === previousReferral) && previousReferral !== memberSelect.value) {
    referralSelect.value = previousReferral;
  }
}

function memberTicketListMarkup(member) {
  const grouped = window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(memberManagementTickets(member))
    : { current: memberManagementTickets(member).filter((ticket) => isCurrentMemberTicket(ticket)), upcoming: [] };
  const managedTickets = [...grouped.current, ...grouped.upcoming].filter((ticket) => ticket.status !== "voided");
  if (!managedTickets.length) return '<span class="member-table-muted">미등록</span>';
  const possibleDuplicateIds = memberPossibleDuplicateTicketIds(managedTickets);
  return `<div class="member-ticket-summary-list" aria-label="${escapeHtml(member.name)} 회원권 ${managedTickets.length}개">
    ${managedTickets.map((ticket, index) => {
      const ticketId = String(ticket.serverTicketId || ticket.id || "");
      const ownershipLabel = managedTickets.length > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
      const possibleDuplicate = possibleDuplicateIds.has(String(ticket.serverTicketId || ""));
      const sequenceLabel = managedTickets.length > 1 ? `회원권 ${index + 1}/${managedTickets.length}` : "";
      const periodLabel = [ticket.actualLessonStart || ticket.purchased, ticket.expires].filter(Boolean).map(memberDetailDateLabel).join("~");
      const contextLabel = [sequenceLabel, ownershipLabel, possibleDuplicate ? "중복 가능" : ""].filter(Boolean).join(" · ");
      return `
      <button class="member-ticket-summary-button member-ticket-summary-line ${possibleDuplicate ? "is-possible-duplicate" : ""}" type="button" data-select-member="${member.id}" data-member-ticket="${escapeHtml(ticketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} ${escapeHtml(contextLabel)} ${escapeHtml(memberTicketStatusLabel(ticket))} 확인">
        ${contextLabel ? `<span class="member-ticket-context-label">${escapeHtml(contextLabel)}</span>` : ""}
        <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
        <small>${escapeHtml(memberTicketStatusLabel(ticket))} · ${escapeHtml(ticketUsageLabel(ticket))}${periodLabel ? ` · ${escapeHtml(periodLabel)}` : ""}</small>
      </button>`;
    }).join("")}
  </div>`;
}

function memberTicketRowMarkup(member, ticket, position = 1, count = 1, possibleDuplicate = false, renewalOverlap = false) {
  if (!ticket) return '<span class="member-table-muted">회원권 없음</span>';
  const ownershipLabel = count > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
  const context = [
    count > 1 ? memberTicketLifecyclePositionLabel(member, ticket) : "",
    ownershipLabel,
    renewalOverlap ? "연장 겹침 · 확인 필요" : possibleDuplicate ? "중복 가능" : "",
  ].filter(Boolean).join(" · ");
  const period = [ticket.actualLessonStart || ticket.purchased, ticket.expires]
    .filter(Boolean)
    .map(memberDetailDateLabel)
    .join("~");
  const simpleContext = [
    memberTicketScheduleScopeLabel(ticket),
    memberTicketCoachLabel(member, ticket),
    ticketUsageLabel(ticket),
  ].filter(Boolean).join(" · ");
  return `<span class="member-ticket-row-summary">
    ${context ? `<small>${escapeHtml(context)}</small>` : ""}
    <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
    <span>${escapeHtml(memberTicketStatusLabel(ticket))}${period ? ` · ${escapeHtml(period)}` : ""}</span>
    <small class="member-ticket-simple-context">${escapeHtml(simpleContext)}</small>
  </span>`;
}

function memberTicketPaymentMarkup(member, ticket) {
  if (!ticket) return '<span class="member-table-muted">미입력</span>';
  const record = memberTicketPaymentProjection(member, ticket);
  const paymentState = memberPaymentRecordState(record);
  if (!record || paymentState === "unentered") {
    return '<span class="member-table-muted">미입력</span>';
  }
  if (paymentState === "transfer_zero") {
    const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "양도일 미입력";
    return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>양도 · 0원</small></span>`;
  }
  const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "일자 미입력";
  const method = record.payment_method ? paymentMethodLabel(record.payment_method) : "수단 미입력";
  const amount = Number.isFinite(Number(record.payment_amount)) ? `${money.format(Number(record.payment_amount))}원` : "금액 미입력";
  const reviewLabel = paymentState === "incomplete" ? "확인 필요 · " : "";
  return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${reviewLabel}${method} · ${amount}`)}</small></span>`;
}

function memberSimpleTicketFields(product, coachRoles, coachRoleId, partnerOptions, options = {}) {
  const total = Number(product?.total_sessions || 1);
  const startsOn = adminLocalDateKey(new Date());
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const isGroup = Number(product?.group_size || 1) === 2;
  const scheduleScope = memberManagementProductScheduleScope(product);
  const existingPayment = options.existingPayment || null;
  const paymentDate = String(existingPayment?.paid_at || existingPayment?.verified_at || existingPayment?.created_at || "").slice(0, 10);
  const paymentMethod = existingPayment?.method || existingPayment?.provider || "";
  const paymentAmount = Number(existingPayment?.final_amount ?? existingPayment?.amount ?? 0);
  const preferExistingPartner = options.preferExistingPartner === true;
  return `
    <input name="createWithoutSchedule" type="hidden" value="${memberManagementProductSupportsRegularSchedule(product) ? "false" : "true"}" />
    <input name="recordStatus" type="hidden" value="active" />
    <input name="scheduleScope" type="hidden" value="${escapeHtml(scheduleScope)}" />
    <input name="weeklyFrequency" type="hidden" value="${memberManagementProductWeeklyFrequency(product)}" />
    <input name="lessonType" type="hidden" value="${isGroup ? "one_on_two" : "one_on_one"}" />
    <input name="usedSessions" type="hidden" value="0" />
    <input name="remainingSessions" type="hidden" value="${total}" />
    <input name="note" type="hidden" value="" />
    ${existingPayment ? `<input name="existingPaymentId" type="hidden" value="${escapeHtml(existingPayment.id)}" />` : ""}
    <div class="member-management-form-grid member-simple-ticket-fields">
      <label class="form-field span-2">${memberManagementFieldLabel("회원권", true)}<select name="productId" required>
        ${memberManagementProducts().map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")}</option>`).join("")}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("담당 코치", true)}<select name="coachRoleId" required>
        ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("총 횟수", true)}<input name="totalSessions" type="number" min="1" step="1" value="${total}" required /></label>
      <label class="form-field">${memberManagementFieldLabel("시작일", true)}<input name="startsOn" type="date" value="${escapeHtml(startsOn)}" required /></label>
      <label class="form-field">${memberManagementFieldLabel("만료일", true)}<input name="expiresOn" type="date" value="${escapeHtml(addMemberManagementDays(startsOn, validityDays - 1))}" readonly aria-readonly="true" required /><small>상품 기간으로 자동 계산</small></label>
      ${existingPayment ? `
        <input name="paymentRecordState" type="hidden" value="complete" />
        <input name="paymentDate" type="hidden" value="${escapeHtml(paymentDate)}" />
        <input name="paymentMethod" type="hidden" value="${escapeHtml(paymentMethod)}" />
        <input name="paymentAmount" type="hidden" value="${paymentAmount}" />
        <div class="member-management-warning span-2"><strong>확인 완료 결제 연결</strong><span>${escapeHtml(paymentDate || "결제일 확인")} · ${escapeHtml(paymentMethodLabel(paymentMethod))} · ${money.format(paymentAmount)}원</span></div>` : `
        <input name="paymentRecordState" type="hidden" value="unentered" />
        <div class="form-field member-payment-derived"><span class="member-field-label">결제 상태<em class="is-optional">자동</em></span><strong data-member-payment-derived-state>미입력</strong><small data-member-payment-missing></small></div>
        <label class="form-field">${memberManagementFieldLabel("결제일", true)}<input name="paymentDate" type="date" value="" /></label>
        <label class="form-field">${memberManagementFieldLabel("결제수단", true)}<select name="paymentMethod">
          <option value="">선택</option>
          <option value="card">카드</option>
          <option value="bank_transfer">계좌이체</option>
          <option value="cash">현금</option>
        </select></label>
        <label class="form-field member-payment-amount-field">${memberManagementFieldLabel("결제금액", true)}<input name="paymentAmount" type="number" min="0" step="1" value="0" readonly aria-readonly="true" /><button class="text-button" type="button" data-enable-payment-override>직접 수정</button><small>결제수단에 맞는 상품 가격이 자동 적용됩니다.</small></label>
        <label class="form-field span-2 member-payment-override-reason" data-payment-override-reason hidden>${memberManagementFieldLabel("금액 수정 사유", true)}<input name="paymentOverrideReason" type="text" minlength="4" maxlength="120" disabled placeholder="할인·추가결제 등 사유" /></label>`}
      <div class="form-field span-2 member-partner-editor ${isGroup ? "" : "is-disabled"}" data-manual-member-partner-field ${isGroup ? "" : "hidden"}>
        ${memberManagementFieldLabel("1:2 파트너", isGroup)}
        <div class="member-partner-mode" role="radiogroup" aria-label="파트너 등록 방법">
          <label><input name="partnerMode" type="radio" value="new" ${preferExistingPartner ? "" : "checked"} /> 새 파트너 같이 등록</label>
          <label><input name="partnerMode" type="radio" value="existing" ${preferExistingPartner ? "checked" : ""} /> 기존 회원 연결</label>
        </div>
        <div class="member-partner-new-fields" data-manual-new-partner ${preferExistingPartner ? "hidden" : ""}>
          <label class="form-field">${memberManagementFieldLabel("파트너 이름", true)}<input name="partnerName" type="text" minlength="2" maxlength="40" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 휴대전화")}<input name="partnerPhone" type="tel" inputmode="tel" maxlength="20" /></label>
          <input name="partnerBirthYear" type="hidden" value="" />
          <input name="partnerGender" type="hidden" value="" />
          <p class="form-message span-2" data-manual-partner-phone-status role="status" hidden></p>
        </div>
        <div class="member-partner-existing-fields" data-manual-existing-partner ${preferExistingPartner ? "" : "hidden"}>
          <input name="partnerSearch" type="search" autocomplete="off" placeholder="이름 또는 전화번호 검색" data-manual-member-partner-search />
          <div class="member-partner-search-results" data-manual-member-partner-results aria-live="polite"></div>
          <p class="form-message" data-manual-existing-partner-status role="status">앱 가입만 하고 회원권이 없는 회원도 검색됩니다.</p>
          <select name="partnerUserId" ${preferExistingPartner ? "" : "disabled"}>
            <option value="">파트너 선택</option>
            ${partnerOptions.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || "회원")}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
    ${memberCreateScheduleMarkup(product)}`;
}

function memberTicketForceDeletePreviewMarkup() {
  if (memberManagementModalState.forceDeletePreviewLoading) {
    return `<div class="member-ticket-delete-preview is-loading" role="status">
      <strong>삭제 영향 확인 중</strong>
      <span>연결 수업·결제·엑셀 이관 기록을 서버에서 확인하고 있습니다.</span>
    </div>`;
  }
  if (memberManagementModalState.forceDeletePreviewError) {
    return `<div class="member-ticket-delete-preview is-error" role="alert">
      <strong>삭제 준비를 확인하지 못했습니다.</strong>
      <span>${escapeHtml(memberManagementModalState.forceDeletePreviewError)}</span>
    </div>`;
  }
  const preview = memberManagementModalState.forceDeletePreview;
  if (!preview?.ok) return "";
  const linkedLessons = Math.max(0, Number(preview.linkedLessons) || 0);
  const completedLessons = Math.max(0, Number(preview.completedLessons) || 0);
  const preservedPayments = Math.max(0, Number(preview.preservedPayments) || 0);
  const importedRows = Math.max(0, Number(preview.importedRows) || 0);
  const relationshipLinks = Math.max(0, Number(preview.participantLinks) || 0)
    + Math.max(0, Number(preview.groupLinks) || 0);
  return `<div class="member-ticket-delete-preview is-ready" role="status">
    <strong>삭제 전 영향 확인 완료</strong>
    <span>연결 수업 ${linkedLessons}건${completedLessons ? ` · 완료 ${completedLessons}건 회차 복원` : ""}</span>
    <span>결제 증빙 ${preservedPayments}건 보존 · 참여 연결 ${relationshipLinks}건 정리</span>
    ${importedRows ? `<span>엑셀 이관 연결 ${importedRows}건은 감사기록에 개수를 남기고 정리</span>` : ""}
  </div>`;
}

function memberTicketFutureClosePreviewMarkup() {
  if (memberManagementModalState.closePreviewLoading) {
    return `<div class="member-ticket-delete-preview is-loading" role="status">
      <strong>종료할 회원권과 미래 수업 확인 중</strong>
      <span>회원권·파트너·미래 수업·보존할 결제 기록을 서버에서 확인하고 있습니다.</span>
    </div>`;
  }
  if (memberManagementModalState.closePreviewError) {
    return `<div class="member-ticket-delete-preview is-error" role="alert">
      <strong>종료 준비를 확인하지 못했습니다.</strong>
      <span>${escapeHtml(memberManagementModalState.closePreviewError)}</span>
    </div>`;
  }
  const preview = memberManagementModalState.closePreview;
  if (!preview?.ok) return "";
  const previewTickets = Array.isArray(preview.tickets) ? preview.tickets : [];
  return `<div class="member-ticket-delete-preview is-ready member-ticket-close-preview" role="status">
    <strong>회원권과 미래 수업을 모두 종료할까요?</strong>
    <span>남은 횟수는 소멸되고, 오늘 이후 예정 수업은 취소됩니다.</span>
    <span>회원은 만료회원으로 보존되며, 결제·환불·감사 기록은 유지됩니다.</span>
    <dl>
      <div><dt>회원명</dt><dd>${escapeHtml(preview.memberName || "회원")}</dd></div>
      <div><dt>종료 회원권</dt><dd>${Math.max(0, Number(preview.ticketCount) || 0)}개</dd></div>
      <div><dt>취소 예정 수업</dt><dd>${Math.max(0, Number(preview.futureLessonCount) || 0)}건</dd></div>
      <div><dt>1:2 파트너</dt><dd>${preview.hasPartner ? `${Math.max(1, Number(preview.partnerCount) || 0)}명 연결 종료` : "해당 없음"}</dd></div>
    </dl>
    ${previewTickets.map((ticket) => `<div class="member-ticket-close-preview-row">
      <strong>${escapeHtml(ticket.productName || "회원권")}</strong>
      <span>총 ${Number(ticket.totalSessions) || 0} · 사용 ${Number(ticket.usedSessions) || 0} · 잔여 ${Number(ticket.remainingSessions) || 0}</span>
    </div>`).join("")}
  </div>`;
}

function filterMemberInlineProductOptions(form) {
  const input = form?.querySelector("[data-member-product-search]");
  const select = form?.elements?.productId;
  if (!input || !select) return;
  const tokens = memberInlineProductSearchTokens(input.value);
  const selectedValue = String(select.value || "");
  const matches = [];
  [...select.options].forEach((option) => {
    if (!option.value) {
      option.hidden = tokens.length > 0;
      return;
    }
    const matched = memberInlineProductSearchMatches(option, tokens);
    option.hidden = tokens.length > 0 && !matched && option.value !== selectedValue;
    if (matched) matches.push(option);
  });
  const results = form.querySelector("[data-member-product-results]");
  if (!results) return;
  results.innerHTML = tokens.length
    ? matches.length
      ? `<span class="member-inline-product-result-count">검색 결과 ${matches.length}개</span>${matches.slice(0, 12).map((option) => `<button type="button" data-select-member-product="${escapeHtml(option.value)}" role="option" aria-selected="${option.value === selectedValue ? "true" : "false"}">${escapeHtml(option.textContent.trim())}</button>`).join("")}`
      : '<span class="member-inline-product-no-result">검색 결과가 없습니다.</span>'
    : "";
  results.hidden = tokens.length === 0;
  input.setAttribute("aria-expanded", tokens.length > 0 ? "true" : "false");
}
