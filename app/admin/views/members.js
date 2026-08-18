// 회원 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderMemberAuthLinkCard(member) {
  const role = defaultAuthRoleForMember(member);
  const connection = memberAuthConnection(member);
  return `
    <section class="member-auth-link-card">
      <div>
        <strong>${escapeHtml(connection.summary)}</strong>
        <span>${escapeHtml(connection.detail)}</span>
      </div>
      ${renderAuthProviderManagement(member)}
      <details class="auth-link-technical-tools">
        <summary>수동 연결 도구</summary>
        <div class="auth-link-technical-grid">
          <label>
            <small>Auth 사용자 UUID</small>
            <input type="text" data-auth-link-auth="${member.id}" placeholder="Authentication > Users에서 복사" spellcheck="false" />
          </label>
          <label>
            <small>회원 DB UUID</small>
            <input type="text" data-auth-link-profile="${member.id}" placeholder="후보 조회 SQL 결과의 id" spellcheck="false" />
          </label>
          <label>
            <small>권한</small>
            <select data-auth-link-role="${member.id}">
              <option value="member" ${role === "member" ? "selected" : ""}>회원</option>
              <option value="coach" ${role === "coach" ? "selected" : ""}>코치</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>관리자</option>
            </select>
          </label>
          <label>
            <small>연결할 로그인 수단</small>
            <select data-auth-link-provider="${member.id}">
              <option value="">선택하세요</option>
              ${authProviderChoices.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="auth-link-actions">
          <button class="ghost-button" type="button" data-copy-auth-link="candidate" data-auth-member-id="${member.id}">후보 조회 SQL 복사</button>
          <button class="small-button" type="button" data-copy-auth-link="link" data-auth-member-id="${member.id}">연결 SQL 복사</button>
        </div>
      </details>
  </section>`;
}

function renderMemberApprovalCard(member) {
  const stage = memberRegistrationStage(member);
  if (!stage || stage.code === "completed") return "";
  return `
    <section class="member-approval-card registration-stage-card is-${stage.code}">
      <div>
        <small>회원 등록</small>
        <strong>${escapeHtml(stage.label)}</strong>
        <span>${escapeHtml(stage.detail)}</span>
      </div>
      <div class="auth-link-actions">
        <button class="primary-button" type="button" data-open-member-management="${escapeHtml(stage.action)}">${escapeHtml(stage.actionLabel)}</button>
      </div>
    </section>`;
}

function renderMemberGroupAccountSettings(member, ticket, allMembers = members) {
  if (!ticketIsSharedGroup(ticket)) return "";
  const account = groupAccountForMemberTicket(member, ticket);
  if (!account) return "";
  const linkedMembers = (account.members || []).filter((item) => item.appStatus === "linked");
  return `
    <details class="member-admin-more member-group-account-details">
      <summary>2대1 결제·앱 관리 · ${escapeHtml(groupPaymentModeLabel(account.paymentMode))}</summary>
      <article class="group-account-admin-card member-group-account-card" data-group-account="${escapeHtml(account.id)}">
        <div class="group-account-allMembers">
          ${(account.members || []).map((item) => `
            <div>
              <span>${escapeHtml(item.name)}</span>
              <strong>${item.appStatus === "linked" ? "앱 연결" : "앱 미가입"}</strong>
              <small>${item.canManageSchedule ? "일정관리 가능" : "연결 회원이 대신 관리"}</small>
            </div>`).join("")}
        </div>
        <div class="group-payment-mode">
          <span>현재 결제 방식</span>
          <strong>${escapeHtml(groupPaymentModeLabel(account.paymentMode))}</strong>
          <small>${account.paymentMode === "separate" ? "각자 결제" : `다음 결제 담당 ${escapeHtml(account.nextPayer || "미지정")}`}</small>
        </div>
        <div class="group-account-actions">
          <button class="small-button ${account.paymentMode === "representative" ? "is-active" : ""}" type="button" data-group-payment-mode="representative" data-group-account-id="${escapeHtml(account.id)}">함께 결제</button>
          <button class="small-button ${account.paymentMode === "alternate" ? "is-active" : ""}" type="button" data-group-payment-mode="alternate" data-group-account-id="${escapeHtml(account.id)}" ${linkedMembers.length < 2 ? "disabled" : ""}>번갈아 결제</button>
          <button class="small-button ${account.paymentMode === "separate" ? "is-active" : ""}" type="button" data-group-payment-mode="separate" data-group-account-id="${escapeHtml(account.id)}" ${linkedMembers.length < 2 ? "disabled" : ""}>각자 결제</button>
          <button class="ghost-button" type="button" data-switch-group-payer="${escapeHtml(account.id)}" ${linkedMembers.length < 2 || account.paymentMode === "separate" ? "disabled" : ""}>다음 결제자 변경</button>
        </div>
      </article>
    </details>`;
}

function renderMemberStatusCounts() {
  const serverDirectoryExpected = operationsRole() === "admin"
    && Boolean(window.TennisNoteDataClient?.rpc);
  const serverDirectoryCurrent = adminMemberDirectoryState.loaded
    && adminMemberDirectoryState.signature === adminMemberDirectorySignature();
  const confirmedServerCounts = adminMemberDirectoryState.counts
    && typeof adminMemberDirectoryState.counts === "object"
    ? adminMemberDirectoryState.counts
    : null;
  const reusableServerCounts = adminMemberDirectoryState.loading
    ? confirmedServerCounts
    : null;
  const counts = serverDirectoryCurrent && confirmedServerCounts
    ? confirmedServerCounts
    : reusableServerCounts || (!serverDirectoryExpected ? memberStatusCounts() : null);
  const waitingForServer = serverDirectoryExpected
    && !serverDirectoryCurrent
    && !adminMemberDirectoryState.error;
  $$('[data-member-filter-count]').forEach((badge) => {
    const filter = badge.dataset.memberFilterCount;
    badge.textContent = counts
      ? `${counts[filter] || 0}명`
      : waitingForServer ? "…" : "확인 필요";
    badge.setAttribute("aria-busy", String(waitingForServer));
    badge.title = filter === "expired" && !waitingForServer
      ? "과거 DB에서 이관한 만료 회원을 포함합니다."
      : "";
  });
}

function renderMemberFilterSections() {
  const filter = state.memberFilter || "active";
  const role = operationsRole();
  $$(".segment[data-member-filter]").forEach((button) => {
    const isActive = button.dataset.memberFilter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  $$('[data-member-scope]').forEach((section) => {
    const scopes = String(section.dataset.memberScope || "").split(/\s+/).filter(Boolean);
    const roleAllowed = !section.hasAttribute("data-member-admin-only") || role === "admin";
    section.hidden = !roleAllowed || !scopes.includes(filter);
  });
}

function renderMemberManagementControls(member) {
  if (!member?.serverUserId || !operationsAccessReady()) return "";
  const status = memberListStatus(member);
  const managedTickets = memberManagementTickets(member);
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);
  const hasClosableTickets = managedTickets.some((ticket) => (
    ["active", "paused", "pending_payment"].includes(ticket.status)
  ));

  const ticketRow = (ticket) => {
    const actions = [];
    const editable = !["refunded", "voided"].includes(ticket.status);
    if (status !== "inactive" && ["active", "paused"].includes(ticket.status) && operationsRole() === "admin") {
      actions.push({ action: "extend", label: "기간 연장", tone: "primary-button" });
    }
    if (status !== "inactive" && editable && memberManagementActionAllowed("correct", ticket)) {
      actions.push({ action: "correct", label: "수정", tone: "ghost-button" });
    }
    if (status !== "inactive" && ["active", "paused", "pending_payment"].includes(ticket.status)
      && memberManagementActionAllowed("expire", ticket)) {
      actions.push({ action: "expire", label: "만료", tone: "ghost-button" });
    }
    if (status !== "inactive" && ["expired", "refunded"].includes(ticket.status)
      && memberManagementActionAllowed("reenroll", ticket)) {
      actions.push({ action: "reenroll", label: "재등록", tone: "primary-button" });
    }
    if (operationsRole() === "admin" && ticket.status !== "voided") {
      actions.push({ action: "force_delete", label: "강제 삭제", tone: "danger-button" });
    }
    const derivedState = window.TennisNoteTicketState?.derive(ticket) || ticket.status || "unknown";
    return `
      <div class="member-ticket-management-row" data-managed-ticket="${escapeHtml(ticket.serverTicketId)}">
        <div class="member-ticket-management-main">
          <span class="member-ticket-status status-${escapeHtml(derivedState)}">${escapeHtml(memberTicketStatusLabel(ticket))}</span>
          <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
          <small>${escapeHtml(ticketUsageLabel(ticket))} · ${escapeHtml(memberDetailDateLabel(ticket.purchased))}~${escapeHtml(memberDetailDateLabel(ticket.expires))}</small>
        </div>
        <div class="member-management-actions">
          ${actions.length
            ? actions.map((item) => `<button class="small-button ${item.tone}" type="button" data-open-member-management="${item.action}" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} ${escapeHtml(item.label)}">${item.label}</button>`).join("")
            : '<span class="member-ticket-no-action">변경 불가</span>'}
        </div>
      </div>`;
  };
  const groups = window.TennisNoteTicketState?.split
    ? window.TennisNoteTicketState.split(managedTickets)
    : { current: managedTickets, upcoming: [], history: [] };
  const ticketRows = [
    ["현재 사용 중", groups.current],
    ["시작 예정", groups.upcoming],
    ["지난 회원권 이력", groups.history],
  ].filter(([, rows]) => rows.length).map(([label, rows]) => `
    <section class="member-ticket-management-group">
      <h4>${label} <small>${rows.length}개</small></h4>
      ${rows.map(ticketRow).join("")}
    </section>`).join("");

  if (!ticketRows && operationsRole() !== "admin") return "";
  return `
    <div class="member-management-controls">
      <div class="member-ticket-management-heading">
        <div>
          <strong>회원권 관리</strong>
        </div>
        <small>${operationsRole() === "coach" ? "허용된 본인 담당 회원권만 처리할 수 있습니다." : "회원권별 작업을 고른 뒤 관리 버튼을 누릅니다."}</small>
      </div>
      <div class="member-ticket-management-list">
        ${ticketRows || '<p class="member-more-empty">등록된 회원권이 없습니다.</p>'}
      </div>
      ${operationsRole() === "admin"
        ? `<div class="member-management-actions member-ticket-management-footer">
            <button class="primary-button member-ticket-assign-button" type="button" data-open-member-management="assign">${unlinkedPayment ? "결제 연결·회원권 발급" : "판매중 회원권 등록"}</button>
            ${hasClosableTickets ? '<button class="danger-button" type="button" data-open-member-management="close">회원권·미래수업 종료</button>' : ""}
          </div>`
        : ""}
    </div>`;
}

function renderMemberManagementModal() {
  const target = $("#memberManagementModalContent");
  if (!target) return;
  const action = memberManagementModalState.action;
  const isCreate = action === "create";
  const member = isCreate
    ? { id: null, name: "새 회원", serverUserId: "manual-create" }
    : members.find((item) => item.id === memberManagementModalState.memberId);
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === memberManagementModalState.ticketId) || null;
  if (!member || !action) {
    target.innerHTML = "";
    return;
  }

  const record = memberDatabaseRecord(isCreate ? null : member, ticket);
  const products = ["assign", "reenroll"].includes(action)
    ? memberManagementProducts(ticket)
    : isCreate
      ? memberManagementProducts()
      : [];
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);
  const product = products.find((item) => item.id === ticket?.productId)
    || products.find((item) => item.id === unlinkedPayment?.product_id)
    || (adminLiveDataState.products || []).find((item) => item.id === ticket?.productId)
    || products[0]
    || null;
  const coachRoles = ["correct", "assign", "reenroll"].includes(action)
    ? memberManagementCoachRoles(ticket || { branchId: record?.branch_id })
    : isCreate
      ? memberManagementCoachRoles({ branchId: product?.branch_id })
      : [];
  const currentCoachRoleId = record?.coach_role_id || ticket?.coachRoleId || "";
  const coachRoleId = coachRoles.some((role) => role.id === currentCoachRoleId) ? currentCoachRoleId : coachRoles[0]?.id || "";
  const scheduleScope = record?.lesson_schedule_scope || ticket?.scheduleScope || product?.schedule_scope || "weekday";
  const partnerOptions = ["correct", "assign"].includes(action) || isCreate ? manualMemberPartnerOptions() : [];
  const groupProduct = (record?.lesson_type || ticket?.lessonTypeCode) === "one_on_two" || Number(product?.group_size || 1) === 2;
  const today = adminLocalDateKey(new Date());
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const defaultTotal = action === "reenroll" ? Number(product?.total_sessions || ticket?.total || 0) : Number(record?.total_sessions ?? ticket?.total ?? 0);
  const defaultUsed = action === "reenroll" ? 0 : Number(record?.used_sessions ?? ticket?.used ?? 0);
  const defaultRemaining = action === "reenroll" ? defaultTotal : Number(record?.remaining_sessions ?? ticket?.remaining ?? 0);
  const defaultStartsOn = action === "reenroll" ? today : memberManagementDate(record?.lesson_start_on || ticket?.purchased);
  const defaultExpiresOn = action === "reenroll" ? addMemberManagementDays(today, validityDays - 1) : memberManagementDate(ticket?.expires);
  const ticketStatus = ["active", "paused", "pending_payment", "expired"].includes(ticket?.status) ? ticket.status : "expired";
  const destructive = ["expire", "close", "force_delete", "deactivate", "permanent_delete"].includes(action);
  const submitLabel = action === "profile"
    ? "기본정보 저장"
    : action === "app_link"
      ? "앱 계정 연결"
      : `${memberManagementActionLabel(action)} 확정`;
  let actionFields = "";

  if (action === "link_existing") {
    const connection = memberAuthConnection(member);
    const linkQuery = memberManagementModalState.linkQuery || "";
    const candidates = memberMembershipLinkTargets(member, linkQuery);
    const recommended = candidates.find((candidate) => candidate.recommended)?.serverUserId || "";
    actionFields = `
      <div class="member-link-control member-existing-link-control">
        <div class="member-link-status is-linked"><strong>${escapeHtml(member.name)} 앱 계정</strong><span>${escapeHtml(connection.summary)} · 운동일지와 가입정보를 함께 연결합니다.</span></div>
        <label class="form-field"><span>기존 수강회원 검색</span><div class="member-link-search-row">
          <input name="existingMemberLinkQuery" type="search" value="${escapeHtml(linkQuery)}" placeholder="이름·닉네임·전화번호 뒤 4자리" autocomplete="off" />
          <button class="secondary-button" type="button" data-search-existing-member-link>검색</button>
        </div></label>
        ${candidates.length ? `<label class="form-field"><span>연결할 기존 수강 DB</span><select name="targetMembershipUserId" required>
          <option value="">선택하세요</option>
          ${candidates.map((candidate) => `<option value="${escapeHtml(candidate.serverUserId)}" ${candidate.serverUserId === recommended ? "selected" : ""}>${escapeHtml(memberMembershipTargetLabel(candidate))}</option>`).join("")}
        </select><small>연결 후 기존 회원권·시간표는 유지되고 이 앱 계정과 운동일지가 합쳐집니다.</small></label>`
          : `<div class="member-link-status"><strong>${linkQuery ? "검색 결과 없음" : "기존 수강회원을 검색해 주세요"}</strong><span>수강 DB의 이름·닉네임·전화번호 뒤 4자리로 찾을 수 있습니다.</span></div>`}
      </div>
      <p class="member-management-rule">연결 후 운동노트 회원은 중복 목록에서 정리되고 기존 수강회원 계정으로 앱을 이용합니다.</p>`;
  } else if (action === "profile") {
    actionFields = `
      <p class="member-create-step-help"><strong>기본정보만 수정</strong> 회원권·횟수·결제·파트너·시간표는 변경되지 않습니다.</p>
      <div class="member-management-form-grid member-basic-profile-form">
        ${memberBasicProfileFields(member)}
      </div>`;
  } else if (action === "app_link") {
    const connection = memberAuthConnection(member);
    const candidates = memberManagementModalState.linkCandidates || [];
    const recommended = candidates.find((candidate) => candidate.recommended)?.userId || "";
    const linkQuery = memberManagementModalState.linkQuery || "";
    const candidateControl = memberManagementModalState.linkCandidatesLoading
      ? '<div class="member-link-status"><strong>앱 가입 계정 찾는 중</strong><span>잠시만 기다려 주세요.</span></div>'
      : candidates.length
        ? `<label class="form-field"><span>연결할 앱 가입 계정</span><select name="sourceSignupUserId">
            <option value="">선택하세요</option>
            ${candidates.map((candidate) => `<option value="${escapeHtml(candidate.userId)}" ${candidate.userId === recommended ? "selected" : ""}>${escapeHtml(memberLinkCandidateLabel(candidate))}</option>`).join("")}
          </select><small>연결하면 기존 회원권과 시간표는 유지되고 선택한 앱 로그인이 기존 로그인을 대체합니다.</small></label>`
        : `<div class="member-link-status"><strong>${linkQuery ? "검색 결과 없음" : "자동 일치 계정 없음"}</strong><span>${linkQuery ? "이름·닉네임·전화번호 뒤 4자리를 다시 확인해 주세요." : "아래 검색으로 앱 가입 계정을 직접 찾을 수 있습니다."}</span></div>`;
    const existingConnectionNotice = connection.linked
      ? `<div class="member-link-status is-linked"><strong>연결된 로그인</strong><span>${escapeHtml(connection.summary)} · 다른 수단을 연결하면 현재 로그인을 교체합니다.</span></div>`
      : "";
    const linkControl = `<div class="member-link-control span-2">
          <label class="form-field"><span>앱 가입 계정 수동 연결</span><div class="member-link-search-row">
            <input name="memberLinkQuery" type="search" value="${escapeHtml(linkQuery)}" placeholder="이름·닉네임·전화번호 뒤 4자리" autocomplete="off" />
            <button class="secondary-button" type="button" data-search-member-link>검색</button>
          </div></label>
          ${candidateControl}
        </div>`;
    actionFields = `
      <div class="member-management-form-grid">${existingConnectionNotice}${linkControl}</div>
      <p class="member-management-rule">같은 이름만으로는 자동 연결하지 않습니다. 전화번호가 같은 한 명만 추천하며, 한 회원은 확인된 로그인 수단 하나만 사용합니다.</p>`;
  } else if (isCreate) {
    actionFields = products.length && coachRoles.length ? `
      <ol class="member-create-steps" aria-label="회원 추가 단계">
        <li class="is-active" data-member-create-step-indicator="1"><span>1</span> 기본정보</li>
        <li data-member-create-step-indicator="2"><span>2</span> 회원권</li>
      </ol>
      <div data-member-create-panel="1">
        <p class="member-create-step-help"><strong>1단계</strong> 현장에서는 이름만 필수입니다. 나머지는 회원이 앱에서 작성한 뒤 연결할 수 있습니다.</p>
        <div class="member-management-form-grid">
          ${memberManualRegistrationFields()}
        </div>
      </div>
      <div data-member-create-panel="2" hidden>
        <p class="member-create-step-help"><strong>2단계</strong> 회원권·담당 코치·정규 요일과 시간을 고르면 회원 등록과 시간표 생성이 한 번에 끝납니다.</p>
        ${memberSimpleTicketFields(product, coachRoles, coachRoleId, partnerOptions)}
      </div>
      <p class="member-management-rule">정규권은 선택한 전체 횟수의 요일·시간을 모두 입력해야 저장됩니다. 예외일 때만 ‘시간표는 나중에 설정’을 선택하세요.</p>` : `<p class="form-message danger">사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "assign") {
    actionFields = products.length && coachRoles.length ? `
      <div class="member-management-form-grid">
        <label class="form-field span-2">${memberManagementFieldLabel("판매중 회원권", true)}<select name="productId" required>
          ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")} · ${memberManagementScheduleScopeLabel(memberManagementProductScheduleScope(item))}</option>`).join("")}
        </select></label>
      </div>
      ${memberManagementDatabaseFields({ member, ticket: null, record, product, coachRoles, coachRoleId, partnerOptions, existingPayment: unlinkedPayment, isAssign: true })}
      <p class="member-management-rule">판매 중인 상품을 선택하면 기간과 회차가 자동 입력됩니다. 저장 후 시간표에서 정규 수업을 등록합니다.</p>` : `<p class="form-message danger">사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "correct") {
    actionFields = operationsRole() === "admin" ? `
      ${memberManagementDatabaseFields({ member, ticket, record, product, coachRoles, coachRoleId, partnerOptions, includeTicketStatus: true })}
      <p class="member-management-rule">레슨 방식·종류·요일·횟수·결제 메모를 한 번에 수정합니다. 기존 결제 증빙은 변경하지 않습니다.</p>` : `
      <div class="member-management-form-grid">
        <label class="form-field"><span>총횟수</span><input name="totalSessions" type="number" min="1" step="1" value="${defaultTotal}" required /></label>
        <label class="form-field"><span>소진횟수</span><input name="usedSessions" type="number" min="0" step="1" value="${defaultUsed}" required /></label>
        <label class="form-field"><span>잔여횟수</span><input name="remainingSessions" type="number" min="0" step="1" value="${defaultRemaining}" readonly aria-readonly="true" required /><small>자동 계산</small></label>
        <label class="form-field"><span>시작일</span><input name="startsOn" type="date" value="${defaultStartsOn}" required /></label>
        <label class="form-field"><span>만료일</span><input name="expiresOn" type="date" value="${defaultExpiresOn}" required /></label>
        <label class="form-field"><span>이용 구분</span><select name="scheduleScope" required>
          <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일권 (월~금)</option>
          <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말권 (토·일)</option>
          <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합권 (월~일)</option>
        </select></label>
        <label class="form-field"><span>회원권 상태</span><select name="ticketStatus" ${operationsRole() === "admin" ? "" : "disabled"} required>
          <option value="active" ${ticketStatus === "active" ? "selected" : ""}>사용 중</option>
          <option value="paused" ${ticketStatus === "paused" ? "selected" : ""}>일시정지</option>
          ${ticketStatus === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
          <option value="expired" ${ticketStatus === "expired" ? "selected" : ""}>만료</option>
        </select></label>
      </div>
      <p class="member-management-rule">총횟수는 소진횟수와 잔여횟수의 합이어야 합니다. 상태·기간·횟수·평일/주말 변경은 미래 시간표에도 함께 반영됩니다.</p>`;
  } else if (action === "extend") {
    const minimumExtensionDate = addMemberManagementDays(defaultExpiresOn, 1);
    const suggestedExtensionDate = addMemberManagementDays(defaultExpiresOn, 30);
    actionFields = `
      <section class="member-ticket-extension-card">
        <div class="member-ticket-extension-preview" aria-live="polite">
          <span>현재 만료일<strong>${escapeHtml(memberDetailDateLabel(defaultExpiresOn))}</strong></span>
          <b aria-hidden="true">→</b>
          <span>연장 후<strong data-member-ticket-extension-result>${escapeHtml(memberDetailDateLabel(suggestedExtensionDate))}</strong></span>
        </div>
        <div class="member-ticket-extension-presets" aria-label="회원권 기간 빠른 연장">
          ${[7, 14, 30].map((days) => `<button class="small-button ${days === 30 ? "is-active" : ""}" type="button" data-ticket-extension-days="${days}">+${days}일</button>`).join("")}
        </div>
        <label class="form-field"><span>새 만료일</span><input name="extendedExpiresOn" type="date" min="${escapeHtml(minimumExtensionDate)}" value="${escapeHtml(suggestedExtensionDate)}" required /></label>
      </section>
      <p class="member-management-rule">횟수·결제 정보는 그대로 두고 기간만 늘립니다. 기존 고정시간이 있으면 남은 횟수 범위에서 연장 기간까지 이어지며, 열린 회원 앱에도 자동 반영됩니다.</p>`;
  } else if (action === "reenroll") {
    actionFields = products.length && coachRoles.length ? `
      <div class="member-management-form-grid">
        <label class="form-field span-2"><span>새 회원권</span><select name="productId" required>
          ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === product?.id ? "selected" : ""}>${escapeHtml(item.name || "회원권")}</option>`).join("")}
        </select></label>
        <label class="form-field span-2"><span>담당 코치</span><select name="coachRoleId" required>
          ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
        </select></label>
        <label class="form-field"><span>총횟수</span><input name="totalSessions" type="number" min="1" step="1" value="${defaultTotal}" required /></label>
        <label class="form-field"><span>소진횟수</span><input name="usedSessions" type="number" min="0" step="1" value="0" required /></label>
        <label class="form-field"><span>잔여횟수</span><input name="remainingSessions" type="number" min="0" step="1" value="${defaultRemaining}" readonly aria-readonly="true" required /><small>자동 계산</small></label>
        <label class="form-field"><span>시작일</span><input name="startsOn" type="date" value="${defaultStartsOn}" required /></label>
        <label class="form-field"><span>만료일</span><input name="expiresOn" type="date" value="${defaultExpiresOn}" required /></label>
        <label class="form-field"><span>등록 금액</span><input name="purchasedPrice" type="number" min="0" step="1" value="${Number(product?.cash_price || product?.card_price || ticket?.amount || 0)}" required /></label>
      </div>
      <p class="member-management-rule">과거 회원권은 그대로 보관하고 새 회원권을 만듭니다. 2대1 파트너도 함께 연결됩니다.</p>` : `<p class="form-message danger">같은 지점·수업형태의 사용 가능한 회원권 상품과 승인 코치를 먼저 등록해 주세요.</p>`;
  } else if (action === "expire") {
    actionFields = `<div class="member-management-warning"><strong>남은 횟수는 이력으로 보존됩니다.</strong><span>앞으로 예정된 수업은 취소되고 회원은 만료회원으로 이동합니다.</span></div>`;
  } else if (action === "close") {
    actionFields = `${memberTicketFutureClosePreviewMarkup()}
      <label class="form-field"><span>종료 사유</span><input name="closeReason" type="text" minlength="5" maxlength="200" value="재등록하지 않아 회원권·미래수업 종료" required /></label>`;
  } else if (action === "force_delete") {
    actionFields = `<div class="member-management-warning danger"><strong>회원권과 연결 수업을 강제 삭제합니다.</strong><span>완료 수업의 차감 횟수는 복원한 뒤 수업·회원권 행을 제거합니다. 결제·환불 증빙과 감사 기록은 분리 보존합니다.</span></div>${memberTicketForceDeletePreviewMarkup()}`;
  } else if (action === "deactivate") {
    actionFields = `<div class="member-management-warning danger"><strong>운영 목록에서 삭제합니다.</strong><span>결제·수업·감사 기록은 보존되며 삭제회원 탭에서 다시 복원할 수 있습니다.</span></div>`;
  } else if (action === "permanent_delete") {
    actionFields = `<div class="member-management-warning danger"><strong>삭제회원 목록에서 완전히 제거합니다.</strong><span>개인정보와 앱 연결은 삭제하고 결제·환불·감사 증빙은 익명 상태로 보존합니다. 이 작업은 되돌릴 수 없습니다.</span></div>`;
  } else if (action === "restore") {
    actionFields = `<div class="member-management-warning"><strong>회원 계정을 운영 목록으로 복원합니다.</strong><span>과거 회원권은 자동으로 되살리지 않으며, 복원 후 다시 수강 등록할 수 있습니다.</span></div>`;
  }

  target.innerHTML = `
    <div class="member-management-summary">
      <span>${escapeHtml(member.name)}</span>
      <strong>${memberManagementActionLabel(action)}</strong>
      <small>${ticket ? `${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product)} · ${ticketUsageLabel(ticket)}` : isCreate ? "실서버 회원·회원권 동시 등록" : memberStatusLabel(member)}</small>
    </div>
    <form id="memberManagementForm" class="member-management-form" ${action === "extend" ? `data-current-expires-on="${escapeHtml(defaultExpiresOn)}"` : ""}>
      ${actionFields}
      <div id="memberManagementMessage" class="form-message danger" role="status">${escapeHtml(memberManagementModalState.message || "")}</div>
      <div class="modal-actions">
        <button class="ghost-button" type="button" data-close-member-management>취소</button>
        ${isCreate && products.length && coachRoles.length ? `
          <button class="ghost-button" type="button" data-member-create-previous hidden>이전</button>
          <button class="primary-button" type="button" data-member-create-next>다음: 회원권</button>
          <button class="primary-button" type="submit" data-member-create-submit hidden>등록 후 시간표 열기</button>
        ` : `<button class="${destructive ? "danger-button" : "primary-button"}" type="submit" ${((["assign", "reenroll"].includes(action) || isCreate) && (!products.length || !coachRoles.length)) || (action === "force_delete" && !memberManagementModalState.forceDeletePreview?.ok) || (action === "close" && !memberManagementModalState.closePreview?.ok) ? "disabled" : ""}>${submitLabel}</button>`}
      </div>
    </form>`;
}

function renderMemberEditorModeBar() {
  const bar = $("#memberEditorModeBar");
  if (!bar) return;
  bar.hidden = operationsRole() !== "admin";
  const button = $("#toggleMemberAdminEdit");
  if (button) {
    button.classList.toggle("is-active", memberAdminEditEnabled);
    button.setAttribute("aria-pressed", String(memberAdminEditEnabled));
    button.textContent = memberAdminEditEnabled ? "회원 수정 잠그기" : "회원 수정 잠금 해제";
  }
  const summary = $("#memberEditorModeSummary");
  if (summary) summary.textContent = memberAdminEditEnabled
    ? "회원권별 행의 수정 버튼을 누르면 그 자리에서 바로 저장·삭제할 수 있습니다."
    : "수정을 누르면 PIN 확인 후 선택한 행만 바로 편집합니다.";
  updateMemberInlineToolbar();
}

function renderMemberManagementPolicySettings() {
  if (state.view !== "settings") return;
  const target = $("#memberManagementPolicySettings");
  if (!target) return;
  target.innerHTML = `
    <div class="member-management-policy-grid">
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanCorrectTicket" ${memberManagementPolicy.coachCanCorrectTicket ? "checked" : ""} /><span>코치가 본인 담당 회원권 숫자·기간 수정</span></label>
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanExpireTicket" ${memberManagementPolicy.coachCanExpireTicket ? "checked" : ""} /><span>코치가 본인 담당 회원권 만료 처리</span></label>
      <label class="toggle-row"><input type="checkbox" data-member-policy="coachCanReenroll" ${memberManagementPolicy.coachCanReenroll ? "checked" : ""} /><span>코치가 본인 담당 만료회원 재등록</span></label>
    </div>
    <div class="data-action-row">
      <button id="saveMemberManagementPolicy" class="primary-button" type="button" ${adminApprovalReady() ? "" : "disabled"}>권한 저장</button>
    </div>
    <small>회원 삭제·복원은 항상 관리자만 가능합니다. 관리자는 추가 PIN이나 사유 입력 없이 처리하며, 계정·시각·이전 값은 자동으로 감사 이력에 남습니다.</small>`;
}

function renderMemberCoachAssignment(ticket, allCoaches = coaches) {
  if (!ticket?.serverTicketId) return "";
  const ticketCoach = allCoaches.find((coach) => coach.id === ticket.coachId);
  const branchCoaches = allCoaches.filter((coach) =>
    coach.serverRoleId &&
    coach.status === "active" &&
    (!ticket.branchId || !coach.branchId || coach.branchId === ticket.branchId)
  );
  return `
    <div class="member-coach-assignment">
      <label>
        <span>담당 코치 지정</span>
        <select data-ticket-coach-select="${escapeHtml(ticket.serverTicketId)}" ${adminApprovalReady() ? "" : "disabled"}>
          <option value="">미배정</option>
          ${branchCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}" ${coach.serverRoleId === ticketCoach?.serverRoleId ? "selected" : ""}>${escapeHtml(coach.name)}</option>`).join("")}
        </select>
      </label>
      <button class="primary-button" type="button" data-save-ticket-coach="${escapeHtml(ticket.serverTicketId)}" ${adminApprovalReady() ? "" : "disabled"}>저장</button>
      <small>${adminApprovalReady() ? "이 이용권으로 신청 가능한 코치를 지정합니다." : "관리자 로그인 후 변경할 수 있습니다."}</small>
    </div>`;
}

function renderMemberTicketLessonSetup(member, ticket, allLiveData = adminLiveDataState) {
  if (!ticket?.serverTicketId) return "";
  const groupSize = Number(ticket.groupSize) === 2 || ticket.lessonKind === "2대1" ? 2 : 1;
  const durationMinutes = getTicketDurationMinutes(ticket);
  const owner = (allLiveData.users || []).find((user) => user.id === ticket.serverUserId);
  const selectedIsOwner = memberOwnsTicket(ticket, member);
  const partnerUserId = memberTicketPartnerUserId(ticket, member);
  const partner = (allLiveData.users || []).find((user) => user.id === partnerUserId);
  const candidates = selectedIsOwner
    ? (allLiveData.users || [])
      .filter((user) => user.id !== ticket.serverUserId && (user.status === "active" || user.id === partnerUserId))
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"))
    : [partner].filter(Boolean);
  const editable = adminApprovalReady() && selectedIsOwner;
  const partnerName = partner?.name || ticketPartnerNames(ticket, member)[0] || "확인 필요";
  const relationshipLabel = groupSize === 2
    ? `파트너 ${partnerName}${selectedIsOwner ? "" : " · 대표 이용권 연결"}`
    : `대표 회원 ${owner?.name || member.name || "확인 필요"}`;
  return `
    <div class="member-ticket-lesson-setup" data-ticket-lesson-setup="${escapeHtml(ticket.serverTicketId)}" data-ticket-owner-view="${selectedIsOwner ? "true" : "false"}">
      <div class="member-ticket-lesson-setup-heading">
        <strong>수업 설정</strong>
        <span>${escapeHtml(relationshipLabel)}</span>
      </div>
      <div class="member-ticket-lesson-setup-fields">
        <label>
          <span>수업 형태</span>
          <select data-ticket-group-size ${editable ? "" : "disabled"}>
            <option value="1" ${groupSize === 1 ? "selected" : ""}>개인 1대1</option>
            <option value="2" ${groupSize === 2 ? "selected" : ""}>2대1 그룹</option>
          </select>
        </label>
        <label>
          <span>수업 시간</span>
          <select data-ticket-duration-minutes ${editable ? "" : "disabled"}>
            ${[20, 30, 40].map((minutes) => `<option value="${minutes}" ${durationMinutes === minutes ? "selected" : ""}>${minutes}분</option>`).join("")}
          </select>
        </label>
        <label class="member-ticket-partner-field" data-ticket-partner-field ${groupSize === 2 ? "" : "hidden"}>
          <span>파트너</span>
          <div class="member-ticket-partner-control">
            <input type="search" data-ticket-partner-search placeholder="이름 또는 연락처 검색" autocomplete="off" ${editable && groupSize === 2 ? "" : "disabled"}>
            <select data-ticket-partner-user ${editable && groupSize === 2 ? "" : "disabled"}>
              <option value="">파트너 선택</option>
              ${candidates.map((user) => `<option value="${escapeHtml(user.id)}" data-partner-search="${escapeHtml(`${user.name || ""} ${user.phone || ""}`.trim())}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "이름 확인 필요")}${user.phone ? ` · ${escapeHtml(user.phone)}` : ""}</option>`).join("")}
            </select>
            <small class="member-ticket-partner-result" data-ticket-partner-result aria-live="polite" hidden></small>
          </div>
        </label>
        <button class="primary-button" type="button" data-save-ticket-lesson-setup="${escapeHtml(ticket.serverTicketId)}" ${editable ? "" : "disabled"}>${selectedIsOwner ? "저장" : "대표 회원에서 수정"}</button>
      </div>
      <small>${editable
        ? "저장하면 2대1 팀, 두 회원 정보와 예정된 시간표가 함께 연결됩니다. 완료된 수업은 유지됩니다."
        : selectedIsOwner
          ? "관리자 로그인 후 변경할 수 있습니다."
          : `${escapeHtml(owner?.name || "대표 회원")} 이용권에 연결된 그룹입니다. 파트너 변경은 대표 회원 상세에서 진행해주세요.`}</small>
    </div>`;
}

function renderMemberBulkToolbar(visibleMembers = [], filteredSelectionIds = null) {
  const selected = selectedMemberIdSet();
  const validIds = new Set(members.map((member) => Number(member.id)));
  state.selectedMemberIds = [...selected].filter((id) => validIds.has(id));
  const selectedMembers = members.filter((member) => selectedMemberIdSet().has(Number(member.id)));
  const selectedMembersAreInactive = selectedMembers.length > 0
    && selectedMembers.every((member) => memberListStatus(member) === "inactive" && member.authRole !== "admin");
  const toolbar = $("#memberBulkToolbar");
  if (toolbar) toolbar.hidden = operationsRole() !== "admin";
  if ($("#memberBulkCount")) $("#memberBulkCount").textContent = String(state.selectedMemberIds.length);
  ["runMemberBulkAction", "deleteSelectedMembers", "clearMemberBulkSelection"].forEach((id) => {
    if ($(`#${id}`)) $(`#${id}`).disabled = !state.selectedMemberIds.length;
  });
  const filteredIds = Array.isArray(filteredSelectionIds)
    ? filteredSelectionIds.map(Number)
    : null;
  if ($("#selectAllFilteredMembers")) {
    const allFilteredSelected = filteredIds
      ? filteredIds.length > 0 && filteredIds.every((id) => selectedMemberIdSet().has(id))
      : state.selectedMemberIds.length > 0 && state.selectedMemberIds.length === adminMemberDirectoryState.total;
    $("#selectAllFilteredMembers").textContent = allFilteredSelected
      ? "전체 해제"
      : "전체 선택";
  }
  const selectAll = $("#selectVisibleMembers");
  if (selectAll) {
    const visibleIds = visibleMembers.map((member) => Number(member.id));
    const selectedCount = visibleIds.filter((id) => selected.has(id)).length;
    selectAll.checked = Boolean(visibleIds.length && selectedCount === visibleIds.length);
    selectAll.indeterminate = selectedCount > 0 && selectedCount < visibleIds.length;
    selectAll.disabled = operationsRole() !== "admin" || !visibleIds.length;
  }
  const coachSelect = $("#memberBulkCoach");
  if (coachSelect) {
    const activeCoaches = operationBranchCoaches().filter((coach) => coach.status === "active" && coach.serverRoleId);
    coachSelect.innerHTML = activeCoaches.map((coach) => `<option value="${escapeHtml(coach.serverRoleId)}">${escapeHtml(coach.name)}</option>`).join("");
    coachSelect.hidden = $("#memberBulkAction")?.value !== "assign_coach";
  }
  const permanentDeleteOption = $('#memberBulkAction option[value="permanent_delete"]');
  if (permanentDeleteOption) {
    permanentDeleteOption.hidden = state.memberFilter !== "inactive";
    permanentDeleteOption.disabled = !selectedMembersAreInactive;
    if (permanentDeleteOption.hidden && $("#memberBulkAction")?.value === "permanent_delete") {
      $("#memberBulkAction").value = "";
    }
  }
  const deleteButton = $("#deleteSelectedMembers");
  if (deleteButton) {
    deleteButton.textContent = selectedMembersAreInactive ? "선택 영구 삭제" : "선택 삭제";
  }
  syncMemberBulkRenewalFields();
}

function renderMemberQuickEditPopover() {
  const popover = $("#memberQuickEditPopover");
  if (!popover) return;
  const member = memberAdminEditEnabled
    ? members.find((item) => item.id === state.inlineMemberId)
    : null;
  if (!member) {
    popover.hidden = true;
    popover.innerHTML = "";
    return;
  }
  popover.innerHTML = memberQuickEditorMarkup(member, memberCurrentTicket(member));
  popover.hidden = false;
  syncMemberQuickEditorProduct(popover.querySelector("[data-member-inline-form]"));
  window.requestAnimationFrame(positionMemberQuickEditPopover);
}

function renderMembers(options = {}) {
  const branchMembers = operationBranchMembers();
  const coachFilter = $("#memberCoachFilter");
  if (coachFilter) {
    const coachNames = [...new Set(branchMembers.flatMap((member) => memberCoachNames(member)))];
    coachFilter.innerHTML = `<option value="all">전체 코치</option>${coachNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
    coachFilter.value = coachNames.includes(state.memberCoachFilter) ? state.memberCoachFilter : "all";
    state.memberCoachFilter = coachFilter.value;
  }
  if ($("#memberListSearch") && $("#memberListSearch").value !== state.memberSearch) $("#memberListSearch").value = state.memberSearch || "";
  if ($("#memberTicketFilter")) $("#memberTicketFilter").value = state.memberTicketFilter || "all";

  const serverDirectoryReady = operationsRole() === "admin"
    && adminMemberDirectoryState.loaded
    && adminMemberDirectoryState.signature === adminMemberDirectorySignature();
  const serverDirectoryExpected = operationsRole() === "admin"
    && Boolean(window.TennisNoteDataClient?.rpc);
  const serverDirectoryPending = serverDirectoryExpected
    && !serverDirectoryReady
    && !adminMemberDirectoryState.error;
  let filtered;
  let filteredTotal;
  if (serverDirectoryReady) {
    const membersByServerUserId = new Map(branchMembers.map((member) => [String(member.serverUserId || ""), member]));
    filtered = adminMemberDirectoryState.rows
      .map((row) => membersByServerUserId.get(String(row.user_id || "")))
      .filter(Boolean);
    filteredTotal = adminMemberDirectoryState.total;
  } else if (serverDirectoryPending) {
    filtered = [];
    // Keep the last confirmed total while the requested page is loading.
    // Resetting the total to zero normalizes every page click back to page 1.
    filteredTotal = adminMemberDirectoryState.total;
  } else {
    filtered = filteredMembers();
    filteredTotal = filtered.length;
  }
  const filterCopy = memberFilterCopy[state.memberFilter] || memberFilterCopy.active;
  if ($("#memberFilterSummary")) {
    $("#memberFilterSummary").textContent = serverDirectoryPending
      ? `${filteredTotal}명 · ${state.memberListPage + 1}페이지 불러오는 중`
      : `${filteredTotal}${filterCopy.summary}`;
  }
  const hasMemberListFilter = Boolean(
    String(state.memberSearch || "").trim()
    || state.memberCoachFilter !== "all"
    || state.memberTicketFilter !== "all"
  );
  if ($("#resetMemberFilters")) $("#resetMemberFilters").hidden = !hasMemberListFilter;
  renderMemberStatusCounts();
  renderMemberFilterSections();
  renderMemberEditorModeBar();

  const selectedIndex = filtered.findIndex((member) => member.id === state.selectedMemberId);
  if (!serverDirectoryReady && selectedIndex >= 0) state.memberListPage = Math.floor(selectedIndex / memberListPageSize);
  if (!serverDirectoryPending) {
    state.memberListPage = normalizeDashboardPage(filteredTotal, state.memberListPage, memberListPageSize);
  }
  const visibleMembers = serverDirectoryReady
    ? filtered
    : filtered.slice(
      state.memberListPage * memberListPageSize,
      (state.memberListPage + 1) * memberListPageSize,
    );
  renderDashboardPager("#memberListPager", filteredTotal, state.memberListPage, "member-directory", memberListPageSize);
  renderMemberBulkToolbar(
    visibleMembers,
    serverDirectoryReady || serverDirectoryPending ? null : filtered.map((member) => Number(member.id)),
  );

  const memberRows = $("#memberRows");
  memberRows?.setAttribute("aria-busy", String(serverDirectoryPending));
  const preserveList = options.preserveList === true && memberRows?.children.length;
  if (!preserveList) {
    memberRows.innerHTML = serverDirectoryPending
      ? '<tr><td colspan="11" class="empty-text">서버 회원 목록을 확인하고 있습니다.</td></tr>'
      : visibleMembers.length ? visibleMembers
      .map((member) => {
      const editableTickets = memberDirectoryTickets(member);
      const displayedTickets = editableTickets.length ? editableTickets : [null];
      const possibleDuplicateTicketIds = memberPossibleDuplicateTicketIds(editableTickets);
      const selectedIds = selectedMemberIdSet();
      const listStatus = memberListStatus(member);
      return displayedTickets.map((rowTicket, ticketIndex) => {
        const ticketId = String(rowTicket?.serverTicketId || "");
        const possibleDuplicate = possibleDuplicateTicketIds.has(ticketId);
        const editingNewTicket = memberAdminEditEnabled
          && Number(state.inlineMemberId) === Number(member.id)
          && String(state.inlineMemberTicketId || "") === ""
          && ticketIndex === 0;
        const editingThisRow = memberAdminEditEnabled
          && Number(state.inlineMemberId) === Number(member.id)
          && String(state.inlineMemberTicketId || "") === ticketId
          && !editingNewTicket;
        if (editingThisRow || editingNewTicket) {
          const editorTicket = editingNewTicket ? null : rowTicket;
          return `<tr class="member-inline-editor-row member-inline-sheet-row" data-member-id="${member.id}" data-member-editor-row="${member.id}" data-member-editor-ticket="${escapeHtml(ticketId)}">
            <td colspan="11">${memberQuickEditorMarkup(member, editorTicket, {
              embedded: true,
              ticketPosition: editingNewTicket ? editableTickets.length + 1 : ticketIndex + 1,
              ticketCount: editableTickets.length,
            })}</td>
          </tr>`;
        }
        const permanentDeleteButton = operationsRole() === "admin"
          && listStatus === "inactive"
          && member.authRole !== "admin"
          && member.serverUserId
          && ticketIndex === 0
            ? `<button class="small-button danger-button member-row-permanent-delete" type="button" data-open-member-management="permanent_delete" data-member-management-member-id="${member.id}">영구 삭제</button>`
            : "";
        const ticketStatus = rowTicket
          ? `<span class="member-ticket-status status-${escapeHtml(window.TennisNoteTicketState?.derive(rowTicket) || rowTicket.status || "unknown")}">${escapeHtml(memberTicketStatusLabel(rowTicket))}</span>`
          : memberStatusBadge(member);
        return `<tr class="member-ticket-table-row ${possibleDuplicate ? "is-possible-duplicate" : ""} ${member.id === state.selectedMemberId ? "is-selected" : ""}" data-member-id="${member.id}" data-member-ticket-row="${escapeHtml(ticketId)}">
          <td class="row-select-cell member-select-column">${ticketIndex === 0
            ? `<input type="checkbox" data-select-member-row="${member.id}" aria-label="${escapeHtml(member.name)} 선택" ${selectedIds.has(Number(member.id)) ? "checked" : ""} ${operationsRole() !== "admin" ? "disabled" : ""} />`
            : '<span class="member-secondary-ticket-mark" aria-hidden="true">↳</span>'}</td>
          <td class="member-name-column">
            <button class="member-link-button ${possibleDuplicate ? "is-possible-duplicate" : ""}" type="button" data-select-member="${member.id}" ${ticketId ? `data-member-ticket="${escapeHtml(ticketId)}"` : ""}>
              ${avatarMarkup(member, "small")}
              <span>${escapeHtml(member.name)}</span>
            </button>
          </td>
          <td class="member-auth-column">${memberAuthStatusMarkup(member)}</td>
          <td class="member-coach-column">${escapeHtml(memberTicketCoachLabel(member, rowTicket))}</td>
          <td class="member-ticket-column">${memberTicketRowMarkup(member, rowTicket, ticketIndex + 1, editableTickets.length, possibleDuplicate)}</td>
          <td class="member-schedule-column">${escapeHtml(rowTicket ? memberScheduleSummary(member, rowTicket) : "미배정")}</td>
          <td class="member-usage-column">${rowTicket ? escapeHtml(ticketUsageLabel(rowTicket)) : '<span class="member-table-muted">-</span>'}</td>
          <td class="member-payment-column">${memberTicketPaymentMarkup(member, rowTicket)}</td>
          <td class="member-status-column"><div class="member-status-actions">${ticketStatus}${permanentDeleteButton}</div></td>
          <td class="member-table-note member-note-column">${escapeHtml(memberDatabaseRecord(member, rowTicket)?.admin_note || memberRemarkLabel(member))}</td>
          <td class="member-actions-column"><div class="member-row-actions">
            ${operationsRole() === "admin" && member.serverUserId && listStatus !== "inactive" && rowTicket && ["active", "paused"].includes(rowTicket.status)
              ? `<button class="small-button primary-button member-row-ticket-extend" type="button" data-open-member-management="extend" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(rowTicket) || rowTicket.product || "회원권")} 기간 연장">기간 연장</button>`
              : ""}
            ${operationsRole() === "admin" ? `<button class="small-button" type="button" data-open-member-inline="${member.id}" data-member-inline-ticket="${escapeHtml(ticketId)}">${rowTicket ? "회원권 수정" : "회원권 등록"}</button>` : ""}
            ${operationsRole() === "admin" && rowTicket && rowTicket.status !== "voided"
              ? `<button class="small-button danger-button member-row-ticket-delete" type="button" data-open-member-management="force_delete" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(rowTicket) || rowTicket.product || "회원권")} 삭제">회원권 삭제</button>`
              : ""}
            ${operationsRole() === "admin" && ticketIndex === 0 && rowTicket ? `<button class="ghost-button member-add-ticket-button" type="button" data-open-member-inline="${member.id}" data-member-inline-ticket="">+ 회원권</button>` : ""}
          </div></td>
        </tr>`;
      }).join("");
      })
      .join("") : `<tr><td colspan="11" class="empty-text">${filterCopy.empty}</td></tr>`;
  } else {
    memberRows.querySelectorAll("tr[data-member-id]").forEach((row) => {
      row.classList.toggle("is-selected", Number(row.dataset.memberId) === Number(state.selectedMemberId));
    });
  }
  if (memberAdminEditEnabled) {
    $("#showChangedMemberRows")?.removeAttribute("hidden");
    const failedButton = $("#showFailedMemberRows");
    if (failedButton) failedButton.hidden = !document.querySelector("[data-member-inline-form].is-save-error");
    applyMemberInlineRowFilter();
  } else {
    memberInlineRowFilter = "all";
  }

  const popover = $("#memberQuickEditPopover");
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = "";
  }

  const detailPanel = $("#memberDetail");
  if (!detailPanel) {
    state.selectedMemberId = null;
    return;
  }
  const detailLayout = detailPanel?.closest(".member-directory-layout");
  const selected = visibleMembers.find((member) => member.id === state.selectedMemberId);
  detailPanel.hidden = !selected;
  detailLayout?.classList.toggle("is-detail-open", Boolean(selected));
  if (!selected) {
    state.selectedMemberId = null;
    detailPanel.innerHTML = "";
  }
  if (selected) {
    const detailEntry = adminMemberDetailEntry(selected);
    if (operationsRole() === "admin" && selected.serverUserId && detailEntry?.status !== "loaded") {
      if (!detailEntry) window.setTimeout(() => void loadAdminMemberDetail(selected), 0);
      detailPanel.innerHTML = detailEntry?.status === "failed"
        ? `<div class="empty-state compact">
            <strong>회원 상세정보를 불러오지 못했습니다.</strong>
            <span>목록은 그대로 사용할 수 있습니다.</span>
            <button class="small-button" type="button" data-retry-member-detail="${escapeHtml(selected.serverUserId)}">다시 불러오기</button>
          </div>`
        : '<div class="empty-state compact"><strong>회원 상세정보 불러오는 중</strong><span>선택한 회원 정보만 안전하게 확인하고 있습니다.</span></div>';
      return;
    }
    const selectedStatus = memberListStatus(selected);
    const selectedHasClosableTickets = memberManagementTickets(selected).some((ticket) => (
      ["active", "paused", "pending_payment"].includes(ticket.status)
    ));
    const selectedRecordCandidate = memberDatabaseRecord(selected, null);
    const selectedTicket = memberCurrentTicket(selected)
      || expiredTickets.find((ticket) => ticket.serverTicketId === selectedRecordCandidate?.current_ticket_id)
      || expiredTickets.find((ticket) => ticketBelongsToMember(ticket, selected))
      || null;
    const selectedRecord = memberDatabaseRecord(selected, selectedTicket);
    const enrollment = selected.enrollment || {};
    const recentPayment = latestMemberPayment(selected);
    const ticketName = selectedTicket
      ? getTicketDisplayProduct(selectedTicket) || selectedTicket.product
      : selectedStatus === "expired" ? "현재 회원권 없음" : selected.lessonType || "회원권 없음";
    const hasRecordedPayment = Boolean(selectedRecord && (
      selectedRecord.payment_recorded_on
      || selectedRecord.payment_method
      || Number(selectedRecord.payment_amount) > 0
    ));
    const paymentDate = selectedRecord
      ? selectedRecord.payment_recorded_on ? memberDetailDateLabel(selectedRecord.payment_recorded_on) : "미입력"
      : recentPayment ? memberDetailDateLabel(recentPayment.paidAt || recentPayment.verifiedAt || recentPayment.requestedAt) : "없음";
    const paymentSummary = selectedRecord
      ? hasRecordedPayment
        ? `${selectedRecord.payment_method ? paymentMethodLabel(selectedRecord.payment_method) : "미입력"} · ${money.format(Number(selectedRecord.payment_amount) || 0)}원`
        : "미입력"
      : recentPayment
        ? `${paymentMethodLabel(recentPayment.method)} · ${money.format(recentPayment.finalAmount || recentPayment.amount || 0)}원`
        : "결제 이력 없음";
    const lessonStart = selectedTicket
      ? selectedRecord?.lesson_start_on || selectedTicket.actualLessonStart || selectedTicket.purchased || ""
      : "";
    const totalSessions = selectedTicket ? selectedRecord?.total_sessions ?? selectedTicket.total : null;
    const usedSessions = selectedTicket ? selectedRecord?.used_sessions ?? selectedTicket.used : null;
    const remainingSessions = selectedTicket ? selectedRecord?.remaining_sessions ?? selectedTicket.remaining : null;
    detailPanel.innerHTML = `
      <div class="detail-header member-db-header">
        <div class="profile-line large">
          ${avatarMarkup(selected, "large")}
          <div>
            <h2>${escapeHtml(selected.name)}</h2>
            <span>회원 기본정보</span>
          </div>
        </div>
        <div class="member-detail-header-actions">
          ${memberStatusBadge(selected)}
          ${operationsRole() === "admin" ? '<button class="small-button" type="button" data-open-member-management="profile">기본정보 수정</button>' : ""}
          ${operationsRole() === "admin" ? '<button class="ghost-button" type="button" data-open-member-management="app_link">앱 연결</button>' : ""}
          ${operationsRole() === "admin" && selectedStatus === "journal" && selected.authLinked
            ? '<button class="primary-button" type="button" data-open-member-management="link_existing">수강 DB 연결</button>'
            : ""}
          ${operationsRole() === "admin" && selectedHasClosableTickets && !["admin", "coach"].includes(selected.authRole)
            ? '<button class="danger-button" type="button" data-open-member-management="close">회원권·미래수업 종료</button>'
            : ""}
          ${operationsRole() === "admin" && !selectedHasClosableTickets && selectedStatus !== "inactive" && !["admin", "coach"].includes(selected.authRole)
            ? '<button class="ghost-button danger-button" type="button" data-open-member-management="deactivate">삭제회원으로 이동</button>'
            : ""}
          ${operationsRole() === "admin" && selectedStatus === "inactive" && selected.authRole !== "admin"
            ? '<button class="ghost-button danger-button" type="button" data-open-member-management="permanent_delete">영구 삭제</button>'
            : ""}
          <button class="icon-button" type="button" data-close-member-detail aria-label="회원 상세 닫기" title="닫기">×</button>
        </div>
      </div>
      <section class="member-db-section member-db-section--profile">
        <h3>기본 정보</h3>
        <dl class="member-db-grid">
          <div><dt>연락처</dt><dd>${escapeHtml(selected.phone || enrollment.phone || "미입력")}</dd></div>
          <div><dt>출생연도</dt><dd>${escapeHtml(String(selected.birthYear || enrollment.birth_year || "미입력"))}</dd></div>
          <div><dt>거주동</dt><dd>${escapeHtml(selected.neighborhood || enrollment.neighborhood || "미입력")}</dd></div>
          <div><dt>성별</dt><dd>${escapeHtml(memberGenderLabel(selected.gender || enrollment.gender))}</dd></div>
          <div><dt>주사용 손</dt><dd>${escapeHtml(({ right: "오른손", left: "왼손", ambidextrous: "양손" })[selected.dominantHand] || "미입력")}</dd></div>
          <div><dt>백핸드</dt><dd>${escapeHtml(({ two_handed: "투핸드", one_handed: "원핸드" })[selected.backhandStyle] || "미입력")}</dd></div>
          <div><dt>테니스 시작일</dt><dd>${escapeHtml(selected.tennisStartedOn || "미입력")}</dd></div>
          <div><dt>자가/코치 NTRP</dt><dd>${escapeHtml(`${selected.selfNtrp || "-"} / ${selected.coachNtrp || "-"}`)}</dd></div>
          <div class="wide"><dt>테니스 목표</dt><dd>${escapeHtml(selected.tennisGoal || "미입력")}</dd></div>
          <div class="wide"><dt>플레이 스타일·관리 메모</dt><dd>${escapeHtml(selected.playStyleMemo || "미입력")}</dd></div>
        </dl>
      </section>
      <section class="member-db-section member-db-section--lesson">
        <h3>수업·회원권</h3>
        <dl class="member-db-grid">
          <div><dt>담당 코치</dt><dd>${escapeHtml(selected.coach || "미배정")}</dd></div>
          <div><dt>레슨 방식</dt><dd>${escapeHtml(memberManagementLessonMethodLabel(selectedRecord, selectedTicket))}</dd></div>
          <div><dt>레슨 종류</dt><dd>${escapeHtml(memberManagementLessonTypeLabel(selectedRecord?.lesson_type || selectedTicket?.lessonTypeCode))}</dd></div>
          <div><dt>레슨 요일</dt><dd>${escapeHtml(memberManagementLessonDaysLabel(selectedRecord, selectedTicket))}</dd></div>
          <div class="wide"><dt>회원권</dt><dd>${escapeHtml(ticketName)}</dd></div>
          <div><dt>레슨 시작일</dt><dd>${escapeHtml(memberDetailDateLabel(lessonStart))}</dd></div>
          <div><dt>만료일</dt><dd>${selectedTicket ? escapeHtml(memberDetailDateLabel(selectedTicket.expires)) : "없음"}</dd></div>
          <div><dt>총 회차</dt><dd>${selectedTicket ? escapeHtml(memberManagementRecordNumber(totalSessions)) : "-"}</dd></div>
          <div><dt>소진 회차</dt><dd>${selectedTicket ? escapeHtml(memberManagementRecordNumber(usedSessions)) : "-"}</dd></div>
          <div><dt>잔여 회차</dt><dd class="member-remaining-value">${selectedTicket ? escapeHtml(memberManagementRecordNumber(remainingSessions)) : "-"}</dd></div>
        </dl>
        ${renderMemberCoachAssignment(selectedTicket)}
        ${renderMemberTicketLessonSetup(selected, selectedTicket)}
        ${renderMemberGroupAccountSettings(selected, selectedTicket)}
        ${renderMemberManagementControls(selected)}
      </section>
      <section class="member-db-section member-db-section--billing">
        <h3>결제·비고</h3>
        <dl class="member-db-grid">
          <div><dt>결제일자</dt><dd>${escapeHtml(paymentDate)}</dd></div>
          <div><dt>결제수단·금액</dt><dd>${escapeHtml(paymentSummary)}</dd></div>
          <div class="wide"><dt>비고</dt><dd>${escapeHtml(selectedRecord ? selectedRecord.admin_note || "없음" : selected.note || "없음")}</dd></div>
        </dl>
      </section>
      ${renderMemberApprovalCard(selected)}
      ${renderMemberEnrollmentDetails(selected)}
      <details class="member-admin-more member-technical-details">
        <summary>앱 계정 관리 · ${escapeHtml(memberAuthConnection(selected).summary)}</summary>
        ${renderMemberAuthLinkCard(selected)}
      </details>
    `;
  }
}

function renderScheduleMemberSearch() {
  const input = $("#adminScheduleMemberSearch");
  const clearButton = $("#clearAdminScheduleMemberSearch");
  const result = $("#adminScheduleMemberSearchResult");
  if (!input || !result) return;
  if (input.value !== state.scheduleMemberSearch) input.value = state.scheduleMemberSearch || "";
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (clearButton) clearButton.hidden = !keyword;
  if (!keyword) {
    result.innerHTML = "";
    return;
  }
  const matches = scheduleMemberSearchMatches();
  const currentWeekMatches = matches.filter((lesson) => lessonMatchesActiveScheduleWeek(lesson, lesson.day));
  const resultLessons = (currentWeekMatches.length ? currentWeekMatches : matches).slice(0, 6);
  result.innerHTML = matches.length
    ? `<span>${currentWeekMatches.length ? `현재 주 ${currentWeekMatches.length}건` : `다른 주 ${matches.length}건`}</span>${resultLessons.map((lesson) => `<button type="button" data-jump-schedule-date="${escapeHtml(lesson.lessonDate || "")}" data-jump-schedule-day="${escapeHtml(lesson.day || "")}" data-jump-schedule-lesson="${escapeHtml(String(lesson.id || ""))}">${escapeHtml(lesson.lessonDate || lesson.day)} · ${escapeHtml(lesson.time)} · ${escapeHtml(getCoachName(lesson.coachId))}</button>`).join("")}`
    : "<span>일치하는 수업이 없습니다.</span>";
}

function renderCurrentLessonMembers(lesson = null) {
  const target = $("#lessonCurrentMembers");
  if (!target) return;
  const selectedTicket = getSelectedTicket();
  const participantNames = lesson
    ? getLessonParticipantNames(lesson)
    : ticketParticipantNames(selectedTicket);
  target.hidden = !participantNames.length;
  target.innerHTML = participantNames.length
    ? `<span class="lesson-participant-heading">${participantNames.length === 2 ? "2대1 참가자" : "수업 참가자"}</span><span class="lesson-participant-list">${participantNames.map((name, index) => `<span class="lesson-participant-row"><small>참가자 ${index + 1}</small><strong>${escapeHtml(name)}</strong></span>`).join("")}</span>`
    : "";
}
