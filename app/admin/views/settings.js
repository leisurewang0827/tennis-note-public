// 설정 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderOperationsLoginGate() {
  const gate = $("#operationsLoginGate");
  const shell = $("#adminAppShell");
  if (!gate || !shell) return;
  const ready = operationsAccessReady();
  const restoringSession = Boolean(
    adminImportAuthState.loading
    && window.TennisNoteDataClient?.getSession?.()?.access_token,
  );
  gate.hidden = ready || restoringSession;
  shell.hidden = !ready;
  const message = $("#operationsLoginMessage");
  const logout = $("#operationsLogoutButton");
  const role = operationsRole();
  if (message) {
    message.textContent = ready
      ? `${adminImportAuthState.profile?.name || "사용자"} 계정으로 로그인했습니다.`
      : adminImportAuthState.user && !["admin", "coach"].includes(role)
        ? "이 계정에는 운영 화면 권한이 없습니다."
        : adminImportAuthState.message || "관리자 또는 코치 계정으로 로그인해 주세요.";
  }
  if (logout) logout.hidden = !adminImportAuthState.user;
  const shellLogout = $("#adminSidebarLogoutButtonBottom");
  if (shellLogout) shellLogout.hidden = !adminImportAuthState.user;
  const remember = $("#operationsRememberLogin");
  if (remember && !remember.dataset.ready) {
    initializeOperationsSessionPersistence();
  }
  applyOperationsRolePermissions();
}

function renderAdminLockModal() {
  const message = $("#adminLockMessage");
  const error = $("#adminPinError");
  const input = $("#adminPinInput");
  if (message) {
    message.textContent = adminLockSession.pendingAction
      ? `${adminLockSession.pendingLabel || "민감 작업"}은 실행할 때마다 관리자 PIN 확인이 필요합니다.`
      : `${adminLockViewName(adminLockSession.pendingView)} 화면은 관리자 PIN 확인 후 열 수 있습니다.`;
  }
  if (error) error.textContent = adminLockSession.error || "";
  if (input && !adminLockSession.error) input.value = "";
}

function renderActiveOperationBranchContext() {
  const target = $("#activeOperationBranchContext");
  if (!target) return;
  const branchId = activeOperationBranchId();
  target.hidden = !branchId;
  target.textContent = branchId ? activeOperationBranchName() : "";
  target.title = branchId ? `${activeOperationProfile()?.name || "운영 프로필"} · ${activeOperationBranchName()}` : "";
}

function renderProductBulkToolbar() {
  const validIds = new Set(membershipProductsForActiveOperationProfile().map((product) => String(product.id)));
  state.selectedMembershipProductIds = [...selectedProductIdSet()].filter((id) => validIds.has(id));
  const toolbar = $("#productBulkToolbar");
  if (toolbar) toolbar.hidden = operationsRole() !== "admin";
  if ($("#productBulkCount")) $("#productBulkCount").textContent = String(state.selectedMembershipProductIds.length);
  ["saveSelectedProducts", "runProductBulkAction", "deleteSelectedProducts", "clearProductBulkSelection"].forEach((id) => {
    if ($(`#${id}`)) $(`#${id}`).disabled = !state.selectedMembershipProductIds.length;
  });
  const filteredIds = filteredMembershipProducts().map((product) => String(product.id));
  if ($("#selectAllProducts")) {
    $("#selectAllProducts").textContent = filteredIds.length && filteredIds.every((id) => selectedProductIdSet().has(id))
      ? "전체 해제"
      : "전체 선택";
  }
}

function renderDashboardNoticeSummary() {
  const target = $("#dashboardNoticeSummary");
  if (!target) return;
  const notice = currentPopupNotice();
  const lessonAlerts = [
    notificationPolicySettings.lessonDayBeforeEnabled,
    notificationPolicySettings.lesson30MinutesEnabled,
  ].filter(Boolean).length;
  const membershipAlerts = [
    notificationPolicySettings.couponNextBookingEnabled,
    notificationPolicySettings.ticketLowRemainingEnabled,
    notificationPolicySettings.ticketExpiryEnabled,
    notificationPolicySettings.ticketExpiredEnabled,
  ].filter(Boolean).length;
  const deliveryReady = ["ready", "limited"].includes(notificationDeliveryState.status);
  const deliveryLabel = deliveryReady
    ? `대기 ${notificationDeliveryState.queued} · 오류 ${notificationDeliveryState.failed}`
    : notificationDeliveryState.message;

  target.innerHTML = `
    <div class="dashboard-notification-summary-row">
      <div>
        <span>공지 팝업</span>
        <strong>${notice.status === "active" ? "노출중" : "꺼짐"}</strong>
        <small>${escapeHtml(notice.status === "active" ? notice.title : "현재 노출 공지 없음")}</small>
      </div>
      ${badge(notice.status === "active" ? "ready" : "neutral", notice.status === "active" ? "ON" : "OFF")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>수업 알림</span>
        <strong>${lessonAlerts}/2 켜짐</strong>
        <small>하루 전 · 30분 전</small>
      </div>
      ${badge(lessonAlerts === 2 ? "ready" : lessonAlerts ? "pending" : "neutral", lessonAlerts ? "사용" : "꺼짐")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>회원권 알림</span>
        <strong>${membershipAlerts}/4 켜짐</strong>
        <small>쿠폰 미예약 · 잔여 ${notificationPolicySettings.lowRemainingThreshold}회 · 만료 ${notificationPolicySettings.expiryDaysBefore}일 전 · 만료일</small>
      </div>
      ${badge(membershipAlerts === 4 ? "ready" : membershipAlerts ? "pending" : "neutral", membershipAlerts ? "사용" : "꺼짐")}
    </div>
    <div class="dashboard-notification-summary-row">
      <div>
        <span>발송 현황</span>
        <strong>${escapeHtml(deliveryLabel)}</strong>
        <small>${notificationDeliveryState.sentToday ? `오늘 ${notificationDeliveryState.sentToday}건 발송` : notificationDeliveryState.message}</small>
      </div>
      ${badge(notificationDeliveryState.failed ? "danger" : deliveryReady ? "ready" : "pending", notificationDeliveryState.failed ? "확인" : deliveryReady ? "정상" : "대기")}
    </div>`;
}

function renderAdminOperations() {
  const taskList = $("#adminTaskList");
  if (!taskList) return;

  const allTasks = getAdminTasks();
  const branchMembers = dashboardOperationalMembers();
  const branchCoaches = operationBranchCoaches();
  state.adminTaskPage = normalizeDashboardPage(allTasks.length, state.adminTaskPage);
  const tasks = allTasks.slice(state.adminTaskPage * dashboardPageSize, (state.adminTaskPage + 1) * dashboardPageSize);
  taskList.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
        <article class="ops-card ${task.tone}">
          <div>
            <span>${task.type}</span>
            <strong>${task.title}</strong>
            <small>${task.detail}</small>
          </div>
          <button class="small-button" type="button" data-jump="${task.view}" ${task.scheduleTicketId ? `data-schedule-ticket-id="${escapeHtml(String(task.scheduleTicketId))}"` : ""} ${task.scheduleLessonSource ? `data-schedule-lesson-source="${escapeHtml(task.scheduleLessonSource)}"` : ""}>${task.action}</button>
        </article>`,
        )
        .join("")
    : adminEmptyState({
        title: "지금 바로 처리할 일이 없습니다",
        reason: "결제 오류, 마감 업무, 당일 수업 영향 항목이 생기면 우선순위대로 표시됩니다.",
        action: { label: "오늘 시간표 확인", jump: "schedule", primary: false },
        compact: true,
      });

  renderDashboardPager("#adminTaskPager", allTasks.length, state.adminTaskPage, "tasks");

  state.memberStatusPage = normalizeDashboardPage(branchMembers.length, state.memberStatusPage);
  const visibleMembers = branchMembers.slice(state.memberStatusPage * dashboardPageSize, (state.memberStatusPage + 1) * dashboardPageSize);
  $("#memberStatusCards").innerHTML = visibleMembers
    .map((member) => {
      const remaining = memberRemainingCount(member);
      const listStatus = memberListStatus(member);
      const tone = ["expired", "journal"].includes(listStatus) ? "neutral" : listStatus === "pending" ? "warn" : remaining <= 1 ? "danger" : remaining <= 2 ? "warn" : "good";
      return `
        <article class="status-card ${tone}">
          <div class="profile-line">
            ${avatarMarkup(member)}
            <div>
              <span>${escapeHtml(member.statusLabel)}</span>
              <strong>${escapeHtml(member.name)}</strong>
              <small>${escapeHtml(member.coach)} · ${escapeHtml(member.regularTime)}</small>
            </div>
          </div>
          <b>잔여 ${remaining}회</b>
        </article>`;
    })
    .join("") || adminEmptyState({
      title: "표시할 회원 상태가 없습니다",
      reason: "회원과 회원권을 등록하면 잔여 횟수와 상태를 확인할 수 있습니다.",
      action: { label: "회원 관리", jump: "members", primary: false },
      compact: true,
    });
  renderDashboardPager("#memberStatusPager", branchMembers.length, state.memberStatusPage, "members");

  const shared = operationalSharedData();
  const pendingNotes = lessonNotes.filter((note) => note.status === "pending").length + shared.lessonLogs.filter((log) => log.status !== "confirmed").length;
  const feedbacks = shared.feedbackRequests.filter((item) => item.status !== "코치 답변 완료").length;
  const coachLoads = branchCoaches
    .filter((coach) => coach.status === "active")
    .map((coach) => {
      const lessonsForCoach = adminTodayLessonRows().filter((lesson) => getCoachName(lesson.coachId) === coach.name && lesson.status !== "available").length;
      return { coach, lessonsForCoach };
    });

  $("#coachWorkCards").innerHTML =
    coachLoads
      .map(
        ({ coach, lessonsForCoach }) => `
      <article class="work-summary-card">
        <div class="profile-line">
          ${avatarMarkup(coach)}
          <div>
            <span>${escapeHtml(coach.role)}</span>
            <strong>${escapeHtml(coach.name)}</strong>
            <small>오늘 수업 ${lessonsForCoach}건</small>
          </div>
        </div>
        <b>${coach.coachMode === "approved" ? "코치모드 사용" : coach.coachMode === "pending" ? "권한 미부여" : "앱 제외"}</b>
      </article>`,
      )
      .join("") +
    `<article class="work-summary-card warn">
      <span>확인 대기</span>
      <strong>${pendingNotes + feedbacks}건</strong>
      <small>수업기록 ${pendingNotes} · 운동노트 ${feedbacks}</small>
      <b>코치 처리 필요</b>
    </article>`;
}

function renderAuthProviderManagement(entity = {}, compact = false) {
  const userId = entity.serverUserId || "";
  const providers = authProviderList(entity);
  const currentProvider = providers[0] || "";
  const request = pendingAuthSwitch(entity);
  const canManage = Boolean(userId) && operationsRole() === "admin";
  const availableTargets = authProviderChoices.filter((item) => item.value !== currentProvider);
  const chips = currentProvider
    ? `<span class="auth-provider-chip">${escapeHtml(authProviderLabel(currentProvider) || currentProvider)}</span>`
    : `<span class="auth-provider-empty">로그인 수단 미연결</span>`;
  const duplicateWarning = providers.length > 1
    ? `<small class="form-message danger">과거 로그인 연결 ${providers.length}개가 남아 있습니다. 로그인 변경으로 하나만 유지해 주세요.</small>`
    : "";

  if (!userId) {
    return `<div class="auth-provider-manager ${compact ? "compact" : ""}"><div class="auth-provider-chip-list">${chips}</div><small>회원가입이 완료되면 로그인 수단을 관리할 수 있습니다.</small></div>`;
  }

  if (request) {
    return `
      <div class="auth-provider-manager ${compact ? "compact" : ""}">
        <div class="auth-provider-chip-list">${chips}</div>
        ${duplicateWarning}
        <div class="auth-switch-pending">
          <div>
            <strong>${escapeHtml(authProviderLabel(request.from_provider))} → ${escapeHtml(authProviderLabel(request.to_provider))} 변경 대기</strong>
            <span>${escapeHtml(authSwitchExpiryLabel(request.expires_at))} 새 수단으로 로그인하면 기존 연결이 자동 해제됩니다.</span>
          </div>
          <button class="ghost-button" type="button" data-cancel-auth-switch="${escapeHtml(request.id)}" data-auth-user-id="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>취소</button>
        </div>
      </div>`;
  }

  return `
    <div class="auth-provider-manager ${compact ? "compact" : ""}">
      <div class="auth-provider-chip-list">${chips}</div>
      ${duplicateWarning}
      ${currentProvider && availableTargets.length ? `
        <div class="auth-switch-form">
          <label>
            <span>현재</span>
            <select data-auth-switch-from="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>
              <option value="${escapeHtml(currentProvider)}" selected>${escapeHtml(authProviderLabel(currentProvider) || currentProvider)}</option>
            </select>
          </label>
          <span class="auth-switch-arrow">→</span>
          <label>
            <span>변경</span>
            <select data-auth-switch-target="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>
              ${availableTargets.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
          <button class="small-button" type="button" data-prepare-auth-switch="${escapeHtml(userId)}" ${canManage ? "" : "disabled"}>변경 준비</button>
        </div>
        <small>한 회원은 로그인 수단 하나만 사용합니다. 새 수단 로그인 성공 전까지 현재 로그인은 유지됩니다.</small>` : `<small>${currentProvider ? "현재 로그인 수단 하나만 사용 중입니다." : "첫 로그인 연결 후 수단 변경이 가능합니다."}</small>`}
    </div>`;
}

function renderCoachLaneAddCard(day, time, coach, label = "수업 추가", detail = "") {
  const blockedBreak = getCoachBreakOverlapping(coach.id, day, time, 20) || getBreakRuleOverlapping(day, time, 20, coach.id);
  if (blockedBreak) {
    return `
      <div class="coach-lane-card unavailable" data-coach-lane="${coach.id}">
        <strong>${getCoachName(coach.id)}</strong>
        <span>${blockedBreak.label || "브레이크"}</span>
        <small>${blockedBreak.start}~${blockedBreak.end}</small>
      </div>`;
  }

  if (!isCoachAvailableForSlot(coach.id, day, time, 20)) {
    return renderCoachLaneClosedCard(coach, "근무외", time);
  }

  if (!hasCourtCapacity(day, time, 20)) {
    return `
      <div class="coach-lane-card disabled" data-coach-lane="${coach.id}">
        <strong>${getCoachName(coach.id)}</strong>
        <span>코트 만석</span>
        <small>${time}</small>
      </div>`;
  }

  return `
    <div class="coach-lane-add-actions" data-coach-lane="${coach.id}">
      <button class="coach-lane-card empty ${getCoachToneClass(coach.id)}" type="button" ${lessonAddAttrs(day, time, 20, coach.id)}>
        <strong>${getCoachName(coach.id)}</strong>
        <span>${label}</span>
        <small>${detail || time}</small>
      </button>
      <button class="coach-lane-one-day" type="button" data-add-one-day-day="${day}" data-add-one-day-time="${time}" data-add-one-day-coach="${coach.id}">원데이</button>
    </div>`;
}

function renderCoachLaneSpillCard(day, time, coach, occupyingLesson, blockEnd) {
  const lessonEnd = timeToMinutes(occupyingLesson.time) + occupyingLesson.durationMinutes;
  const occupiedEnd = Math.min(lessonEnd, blockEnd);
  const availableStart = minutesToTime(occupiedEnd);
  const canContinue = blockEnd - occupiedEnd > 0;

  if (canContinue) {
    return `
      <div class="coach-lane-stack" data-coach-lane="${coach.id}">
        <button class="coach-lane-card spill ${getLessonStateClass(occupyingLesson)} ${getCoachToneClass(occupyingLesson.coachId)}" type="button" ${lessonActionAttrs(occupyingLesson)}>
          <strong>${getLessonMembersMarkup(occupyingLesson)}</strong>
          <span>${time}~${availableStart} 사용중</span>
          <small>${getLessonStatusLabel(occupyingLesson)} · ${getLessonRoundLabel(occupyingLesson)} · ${occupyingLesson.durationMinutes}분</small>
        </button>
        ${renderCoachLaneAddCard(day, availableStart, coach, "이어서 신청", `${availableStart}부터`)}
      </div>`;
  }

  return `
    <button class="coach-lane-card spill ${getLessonStateClass(occupyingLesson)} ${getCoachToneClass(occupyingLesson.coachId)}" type="button" data-coach-lane="${coach.id}" ${lessonActionAttrs(occupyingLesson)}>
      <strong>${getLessonMembersMarkup(occupyingLesson)}</strong>
      <span>${getCoachName(occupyingLesson.coachId)}</span>
      <small>${getLessonStatusLabel(occupyingLesson)} · ${time}~${availableStart} 사용중</small>
    </button>`;
}

function renderCoachLane(day, time, coach) {
  const blockStart = timeToMinutes(time);
  const blockEnd = blockStart + scheduleBlockMinutes;
  const startingLesson = findStartingLessonForCoach(day, time, coach.id);
  const occupyingLesson = findOccupyingLessonForCoach(day, time, coach.id);
  const startingInBlock = findLessonStartingInBlockForCoach(day, blockStart, blockEnd, coach.id);

  if (startingLesson) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneLessonCard(startingLesson)}</div>`;
  }

  if (occupyingLesson) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneSpillCard(day, time, coach, occupyingLesson, blockEnd)}</div>`;
  }

  if (!isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes)) {
    return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneClosedCard(coach, "근무외", time)}</div>`;
  }

  if (startingInBlock) {
    return `
      <div class="coach-lane" data-coach-lane="${coach.id}">
        <div class="coach-lane-stack">
          ${renderCoachLaneAddCard(day, time, coach, "수업 추가", `${time}~${startingInBlock.time}`)}
          ${renderCoachLaneLessonCard(startingInBlock, `${startingInBlock.time} 시작`)}
        </div>
      </div>`;
  }

  return `<div class="coach-lane" data-coach-lane="${coach.id}">${renderCoachLaneAddCard(day, time, coach)}</div>`;
}

function renderCoachStaffModal() {
  const modal = $("#coachStaffModal");
  const content = $("#coachStaffModalContent");
  const draft = coachStaffEditorState.draft;
  if (!modal || !content || !draft) return;
  if (coachStaffEditorState.tab === "settlement" && operationsRole() !== "admin") coachStaffEditorState.tab = "basic";
  $$("[data-coach-staff-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.coachStaffTab === coachStaffEditorState.tab);
    button.hidden = button.dataset.coachStaffTab === "settlement" && operationsRole() !== "admin";
  });
  $("#coachStaffModalTitle").textContent = coachStaffEditorState.mode === "create" ? "코치·직원 추가" : draft.name;
  content.innerHTML = coachStaffEditorState.tab === "work"
    ? renderCoachStaffWorkTab(draft)
    : coachStaffEditorState.tab === "settlement"
      ? renderCoachStaffSettlementTab(draft)
      : renderCoachStaffBasicTab(draft);
  const actions = $("#coachStaffMoreActions");
  if (actions) {
    const existing = Boolean(draft.coachRoleId);
    actions.innerHTML = existing ? `
      <button type="button" data-coach-staff-state="${draft.approvalStatus === "approved" ? "disabled" : "approved"}">${draft.approvalStatus === "approved" ? "코치 승인 해제" : "코치 승인"}</button>
      <button type="button" data-coach-staff-state="${draft.employmentStatus === "active" ? "ended" : "restored"}">${draft.employmentStatus === "active" ? "근무 종료" : "근무 복원"}</button>
      ${draft.employmentStatus === "archived" ? "" : '<button type="button" data-coach-staff-state="archived">목록에서 숨기기(보관)</button>'}
      <button type="button" data-delete-coach-staff>코치 삭제</button>
    ` : "";
    $("#coachStaffMoreMenu").hidden = !existing || operationsRole() !== "admin";
  }
  $("#coachStaffMessage").textContent = coachStaffEditorState.message || "";
  modal.hidden = false;
}

function renderCoachLaneOrderEditor() {
  const target = $("#coachLaneOrderPanel");
  if (!target) return;
  if (operationsRole() !== "admin") {
    target.hidden = true;
    return;
  }
  target.hidden = false;
  ensureCoachLaneOrderEditorState();
  const items = coachLaneOrderItems();
  const dirty = coachLaneOrderEditorState.roleIds.join("|") !== coachLaneOrderEditorState.baselineRoleIds.join("|");
  const busy = coachLaneOrderEditorState.loading || coachLaneOrderEditorState.saving;
  target.innerHTML = `
    <div class="coach-lane-order-heading">
      <div>
        <p class="eyebrow">레슨표 표시</p>
        <h3 id="coachLaneOrderTitle">시간표 열 순서</h3>
      </div>
      <span class="source-pill ${dirty ? "warn" : ""}">${dirty ? "변경 확인 필요" : "서버 순서"}</span>
    </div>
    <p class="coach-lane-order-help">교대 전후에도 같은 코치가 같은 쪽에 보이도록 왼쪽부터 순서를 정합니다.</p>
    <div class="coach-lane-order-list">
      ${items.length ? items.map((coach, index) => `
        <div class="coach-lane-order-row" data-coach-lane-role-id="${escapeHtml(coach.serverRoleId)}">
          <span class="coach-lane-order-number">${index + 1}</span>
          <strong>${escapeHtml(coach.name)}</strong>
          <div class="coach-lane-order-actions">
            <button class="icon-button" type="button" data-move-coach-lane="up" data-role-id="${escapeHtml(coach.serverRoleId)}" aria-label="${escapeHtml(coach.name)} 왼쪽으로 이동" title="왼쪽으로 이동" ${index === 0 || busy ? "disabled" : ""}>↑</button>
            <button class="icon-button" type="button" data-move-coach-lane="down" data-role-id="${escapeHtml(coach.serverRoleId)}" aria-label="${escapeHtml(coach.name)} 오른쪽으로 이동" title="오른쪽으로 이동" ${index === items.length - 1 || busy ? "disabled" : ""}>↓</button>
          </div>
        </div>`).join("") : '<p class="empty-text">근무 중인 코치가 없습니다.</p>'}
    </div>
    <div class="coach-lane-order-preview" aria-label="열 순서 미리보기">
      <span><b>평일 오전</b>${escapeHtml(coachLaneOrderPreviewText("월", "10:00"))}</span>
      <span><b>평일 오후</b>${escapeHtml(coachLaneOrderPreviewText("월", "19:00"))}</span>
    </div>
    <div class="coach-lane-order-footer">
      <span class="form-message" role="status">${escapeHtml(coachLaneOrderEditorState.message)}</span>
      <div>
        <button class="small-button" type="button" data-preview-coach-lane-order ${!items.length || busy ? "disabled" : ""}>서버 확인</button>
        <button class="primary-button" type="button" data-save-coach-lane-order ${!dirty || !coachLaneOrderEditorState.confirmed || busy ? "disabled" : ""}>순서 저장</button>
      </div>
    </div>`;
}

function renderCoaches() {
  const branchCoaches = operationBranchCoaches().filter((coach) => !coach.deletedAt);
  const activeCoaches = branchCoaches.filter((coach) => (
    (coach.employmentStatus || "active") === "active" && !coach.archivedAt
  ));
  const inactiveCoaches = branchCoaches.filter((coach) => !activeCoaches.includes(coach));
  const showingInactive = state.coachStaffListFilter === "inactive";
  const visibleCoaches = showingInactive ? inactiveCoaches : activeCoaches;
  const signedUpCount = activeCoaches.filter((coach) => coach.accountLinked).length;
  const approvedCount = activeCoaches.filter((coach) => ["approved", "active"].includes(coach.approvalStatus || coach.coachMode)).length;
  const target = $("#coachRows");
  if (!target) return;
  $("#activeCoachCount").textContent = activeCoaches.length;
  $("#inactiveCoachCount").textContent = inactiveCoaches.length;
  $$("[data-coach-staff-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.coachStaffFilter === state.coachStaffListFilter);
  });
  renderCoachLaneOrderEditor();
  target.innerHTML = `
    <div class="coach-status-summary">
      <strong>근무 중 ${activeCoaches.length}명</strong>
      <span>회원가입 ${signedUpCount}명</span>
      <span>승인 완료 ${approvedCount}명</span>
      ${inactiveCoaches.length ? `<span>종료·보관 ${inactiveCoaches.length}명</span>` : ""}
    </div>` + (visibleCoaches.length ? visibleCoaches
    .map(
      (coach) => {
        const breakCount = normalizeCoachBreakBlocks(coach).length;
        return `
        <article class="coach-row" data-coach-row="${coach.id}">
          <div class="coach-identity">
            ${avatarMarkup(coach, "large")}
            <div><strong>${escapeHtml(coach.name)}</strong><span>${escapeHtml(coach.role || "레슨")} · ${coachEmploymentLabel(coach)}</span></div>
          </div>
          <div class="coach-list-summary">
            <div class="coach-auth-badges">
              ${badge(coachSignupTone(coach), coachSignupLabel(coach))}
              ${badge(coachApprovalTone(coach), coachApprovalLabel(coach))}
              ${operationsRole() === "admin" && coach.loginCandidateUserId ? `<button class="small-button" type="button" data-reconcile-coach-login="${escapeHtml(coach.id)}">가입 계정 연결</button>` : ""}
              ${operationsRole() === "admin" && !coach.accountLinked && coach.loginCandidateCount > 1 ? badge("warn", "연결 후보 확인 필요") : ""}
            </div>
            <span>${escapeHtml(getCoachAvailabilitySummary(coach.id))}${breakCount ? ` · 브레이크 ${breakCount}개` : ""}</span>
            <span>${operationsRole() === "admin" ? coachSettlementSummary(coach) : "정산 정보 비공개"}</span>
          </div>
          <button class="icon-button coach-row-edit" type="button" aria-label="${escapeHtml(coach.name)} 편집" title="편집" data-edit-coach-staff="${coach.id}">···</button>
        </article>`;
      },
    )
    .join("") : `<p class="empty-text coach-list-empty">${showingInactive ? "종료하거나 보관한 코치가 없습니다." : "근무 중인 코치가 없습니다."}</p>`);
}

function renderOperationProfileControls() {
  const select = $("#operationProfileSelect");
  if (!select) return;
  ensureOperationProfiles();
  select.innerHTML = operationProfiles
    .map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`)
    .join("");
  select.value = activeOperationProfileId;
  const current = activeOperationProfile();
  const branchSelect = $("#operationProfileBranchSelect");
  const branchOptions = operationBranchOptions();
  if (branchSelect) {
    branchSelect.innerHTML = [
      '<option value="">지점 미지정</option>',
      ...branchOptions.map((branch) => (
        `<option value="${escapeHtml(branch.id)}">${escapeHtml(branch.name)}${branch.status === "active" ? "" : " · 사용 중지"}</option>`
      )),
    ].join("");
    branchSelect.value = current.branchId || "";
    branchSelect.disabled = operationsRole() !== "admin" || !branchOptions.length;
  }
  const status = $("#operationProfileStatus");
  if (status) {
    status.textContent = `${current.name} · ${activeOperationBranchName()} · 운영시간·브레이크·코치 근무시간 적용 중`;
  }
  const deleteButton = $("#deleteOperationProfileButton");
  if (deleteButton) deleteButton.disabled = operationProfiles.length <= 1;
}

function renderPolicyGuide() {
  const target = $("#policyGuideCards");
  if (!target) return;
  target.innerHTML = policyGuideTemplates.map((guide) => `
    <article class="policy-guide-card">
      <div>
        <strong>${escapeHtml(guide.title)}</strong>
        <span>${escapeHtml(guide.summary)}</span>
      </div>
      <p>${escapeHtml(guide.copy)}</p>
      <button class="ghost-button" type="button" data-copy-policy-guide="${guide.id}">안내문 복사</button>
    </article>`).join("");
}

function renderPolicyVersionSettings() {
  const target = $("#policyVersionCards");
  if (!target) return;
  const active = activePolicyVersion();
  target.innerHTML = `
    <div class="policy-version-toolbar">
      <div>
        <strong>운영 정책 ${policyVersions.length}개</strong>
        <span>현재 적용본과 이전 정책을 한 번에 관리합니다.</span>
      </div>
      <button class="primary-button" type="button" data-copy-policy-version="${escapeHtml(active?.id || "")}">새 정책</button>
    </div>
    <div class="policy-version-rows">
      ${policyVersions.map((policy) => {
        const normalized = normalizePolicyVersion(policy);
        const statusLabel = normalized.status === "active" ? "적용중" : normalized.status === "draft" ? "수정본" : "보관";
        const statusTone = normalized.status === "active" ? "ready" : normalized.status === "draft" ? "pending" : "neutral";
        return `
          <article class="policy-version-row ${normalized.status}">
            <div class="policy-version-row-main">
              <div>
                <strong>${escapeHtml(normalized.title)}</strong>
                ${badge(statusTone, statusLabel)}
              </div>
              <span>${escapeHtml(normalized.effectiveFrom)} · ${escapeHtml(normalized.source)} · ${normalized.sections.length}개 항목</span>
              <small>${escapeHtml(normalized.summary)}</small>
            </div>
            <div class="policy-version-row-actions">
              <button class="ghost-button" type="button" data-preview-policy-snapshot="${escapeHtml(normalized.id)}">확인</button>
              <button class="ghost-button" type="button" data-edit-policy-version="${escapeHtml(normalized.id)}">수정</button>
              <button class="small-button" type="button" data-activate-policy-version="${escapeHtml(normalized.id)}" ${normalized.status === "active" ? "disabled" : ""}>적용</button>
              <button class="ghost-button danger-button" type="button" data-delete-policy-version="${escapeHtml(normalized.id)}" ${policyVersions.length <= 1 ? "disabled" : ""}>삭제</button>
            </div>
          </article>`;
      }).join("")}
    </div>
    <p class="policy-version-footnote">정책을 수정해도 이미 구매한 회원권에 저장된 구매 당시 정책은 바뀌지 않습니다.</p>`;
}

function renderNoticePopupSettings() {
  if (state.view !== "settings") return;
  const target = $("#noticePopupSettings");
  if (!target) return;
  const notices = popupNotices();
  const notice = editingPopupNotice();
  if (!state.noticeEditingId) state.noticeEditingId = notice.id;
  target.dataset.noticeId = notice.id || "notice-new";
  const audienceLabel = { all: "회원+코치", member: "회원만", coach: "코치만" }[notice.audience] || "회원+코치";
  const statusLabel = notice.status === "active" ? "노출중" : notice.status === "archived" ? "지난 공지" : "꺼짐";
  const previewUrl = noticeImageRemoveRequested ? "" : (noticeImageDraftUrl || notice.imageUrl || "");
  target.innerHTML = `
    <section class="notice-list-section" aria-label="등록 공지 목록">
      <div class="notice-list-heading">
        <div>
          <strong>등록 공지 ${notices.length}건</strong>
          <span>위에서부터 회원·코치 앱에 순서대로 표시됩니다.</span>
        </div>
        <button class="small-button" type="button" id="newNoticePopupButton">새 공지</button>
      </div>
      <div class="notice-list">
        ${notices.length ? notices.map((item, index) => {
          const itemAudience = { all: "회원+코치", member: "회원", coach: "코치" }[item.audience] || "회원+코치";
          const itemStatus = item.status === "active" ? "노출중" : item.status === "archived" ? "지난 공지" : "꺼짐";
          return `
            <div class="notice-list-row ${item.id === notice.id ? "selected" : ""}">
              <span class="notice-order-number">${index + 1}</span>
              <button class="notice-list-main" type="button" data-edit-notice="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(itemAudience)} · ${escapeHtml(itemStatus)}${item.imageUrl ? " · 이미지" : ""}</span>
              </button>
              <div class="notice-list-actions">
                <button class="icon-button" type="button" data-move-notice="${escapeHtml(item.id)}" data-direction="up" title="위로 이동" aria-label="${escapeHtml(item.title)} 위로 이동" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="icon-button" type="button" data-move-notice="${escapeHtml(item.id)}" data-direction="down" title="아래로 이동" aria-label="${escapeHtml(item.title)} 아래로 이동" ${index === notices.length - 1 ? "disabled" : ""}>↓</button>
                <button class="ghost-button" type="button" data-edit-notice="${escapeHtml(item.id)}">수정</button>
                <button class="danger-text-button" type="button" data-delete-notice="${escapeHtml(item.id)}">삭제</button>
              </div>
            </div>`;
        }).join("") : '<p class="empty-text">등록된 공지가 없습니다. 새 공지를 만들어주세요.</p>'}
      </div>
    </section>
    <article class="notice-control-summary ${notice.status === "active" ? "active" : "disabled"}">
      <div>
        <p class="eyebrow">${isUuid(notice.id) ? "공지 수정" : "새 공지"}</p>
        <strong>${escapeHtml(notice.title)}</strong>
        <span>${escapeHtml(notice.body)}</span>
      </div>
      ${badge(notice.status === "active" ? "ready" : "neutral", statusLabel)}
    </article>
    <div class="notice-control-grid">
      <label>
        <small>공지 제목</small>
        <input id="noticeTitleInput" type="text" maxlength="80" value="${escapeHtml(notice.title)}" />
      </label>
      <label>
        <small>노출 대상</small>
        <select id="noticeAudienceInput">
          <option value="all" ${notice.audience === "all" ? "selected" : ""}>회원+코치</option>
          <option value="member" ${notice.audience === "member" ? "selected" : ""}>회원만</option>
          <option value="coach" ${notice.audience === "coach" ? "selected" : ""}>코치만</option>
        </select>
      </label>
      <label>
        <small>상태</small>
        <select id="noticeStatusInput">
          <option value="active" ${notice.status === "active" ? "selected" : ""}>노출</option>
          <option value="disabled" ${notice.status === "disabled" ? "selected" : ""}>끄기</option>
          <option value="archived" ${notice.status === "archived" ? "selected" : ""}>지난 공지</option>
        </select>
      </label>
      <label>
        <small>중요도</small>
        <select id="noticePriorityInput">
          <option value="normal" ${notice.priority === "normal" ? "selected" : ""}>일반</option>
          <option value="important" ${notice.priority === "important" ? "selected" : ""}>중요</option>
          <option value="urgent" ${notice.priority === "urgent" ? "selected" : ""}>긴급</option>
        </select>
      </label>
      <label>
        <small>시작일</small>
        <input id="noticeStartDateInput" type="date" value="${escapeHtml(notice.startDate)}" />
      </label>
      <label>
        <small>종료일</small>
        <input id="noticeEndDateInput" type="date" value="${escapeHtml(notice.endDate)}" />
      </label>
      <label class="notice-body-field">
        <small>공지 내용</small>
        <textarea id="noticeBodyInput" rows="4" maxlength="1000">${escapeHtml(notice.body)}</textarea>
      </label>
      <div class="notice-image-field">
        <div class="notice-field-heading">
          <div>
            <small>대표 이미지</small>
            <span>JPG, PNG, WebP · 최대 5MB</span>
          </div>
          ${previewUrl ? '<button class="danger-text-button" type="button" id="removeNoticeImageButton">이미지 삭제</button>' : ""}
        </div>
        ${previewUrl
          ? `<img class="notice-image-preview" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(notice.imageAlt || notice.title || "공지 이미지")}" />`
          : '<div class="notice-image-empty">첨부된 이미지 없음</div>'}
        <input id="noticeImageInput" type="file" accept="image/jpeg,image/png,image/webp" />
        <label>
          <small>이미지 설명</small>
          <input id="noticeImageAltInput" type="text" maxlength="120" value="${escapeHtml(notice.imageAlt)}" placeholder="이미지 내용을 짧게 설명" />
        </label>
      </div>
      <div class="notice-action-fields">
        <label>
          <small>버튼 이름</small>
          <input id="noticeActionLabelInput" type="text" maxlength="30" value="${escapeHtml(notice.actionLabel)}" placeholder="예: 자세히 보기" />
        </label>
        <label>
          <small>버튼 연결 주소</small>
          <input id="noticeActionUrlInput" type="url" maxlength="500" value="${escapeHtml(notice.actionUrl)}" placeholder="https://..." />
        </label>
      </div>
      <label class="toggle-row notice-once-row">
        <input id="noticeOncePerDayInput" type="checkbox" ${notice.showOncePerDay ? "checked" : ""} />
        <span>확인한 사용자는 오늘 하루 다시 보이지 않게 하기</span>
      </label>
    </div>
    <div class="notice-control-footer">
      <span>현재 대상: ${audienceLabel} · ${isUuid(notice.id) && notice.updatedAt ? `마지막 수정 ${new Date(notice.updatedAt).toLocaleString("ko-KR")}` : "아직 저장되지 않음"}</span>
      <div class="data-action-row">
        <button class="small-button" type="button" id="saveNoticePopupButton">저장하고 반영</button>
        <button class="ghost-button" type="button" id="disableNoticePopupButton">공지 끄기</button>
        <button class="ghost-button" type="button" id="resetNoticeDismissalsButton">테스트 다시 보이기</button>
      </div>
    </div>`;
}

function renderNotificationPolicySettings() {
  if (state.view !== "settings") return;
  const target = $("#notificationPolicySettings");
  if (!target) return;
  const policy = normalizeNotificationPolicy(notificationPolicySettings);
  const stateTone = notificationDeliveryState.failed
    ? "danger"
    : ["ready", "limited"].includes(notificationDeliveryState.status)
      ? "ready"
      : "pending";
  const stateLabel = notificationDeliveryState.failed
    ? "오류 확인"
    : notificationDeliveryState.status === "ready"
      ? "서버 연결"
      : notificationDeliveryState.status === "limited"
        ? "기본 확인"
        : "확인 필요";
  const recentRows = (notificationDeliveryState.recent || []).slice(0, 8);

  target.innerHTML = `
    <div class="notification-rule-list">
      <div class="notification-rule-row">
        <input id="notifyLessonDayBefore" type="checkbox" role="switch" aria-label="수업 하루 전 알림" ${policy.lessonDayBeforeEnabled ? "checked" : ""} />
        <span><strong>수업 하루 전</strong><small>수업 시작 24시간 전</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyLesson30Minutes" type="checkbox" role="switch" aria-label="수업 30분 전 알림" ${policy.lesson30MinutesEnabled ? "checked" : ""} />
        <span><strong>수업 30분 전</strong><small>잠금화면 푸시</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyCouponNextBooking" type="checkbox" role="switch" aria-label="쿠폰 다음 일정 알림" ${policy.couponNextBookingEnabled ? "checked" : ""} />
        <span><strong>쿠폰 다음 일정</strong><small>예정 수업이 없으면 주 1회 안내</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketLowRemaining" type="checkbox" role="switch" aria-label="잔여횟수 알림" ${policy.ticketLowRemainingEnabled ? "checked" : ""} />
        <span><strong>잔여횟수</strong><small>재등록 안내</small></span>
        <span class="notification-inline-control"><input id="notifyLowRemainingThreshold" type="number" min="1" max="5" aria-label="잔여횟수 알림 기준" value="${policy.lowRemainingThreshold}" /><b>회</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketExpiry" type="checkbox" role="switch" aria-label="회원권 만료 임박 알림" ${policy.ticketExpiryEnabled ? "checked" : ""} />
        <span><strong>만료 임박</strong><small>오전 9시 발송</small></span>
        <span class="notification-inline-control"><input id="notifyExpiryDaysBefore" type="number" min="1" max="30" aria-label="만료 임박 알림 기준일" value="${policy.expiryDaysBefore}" /><b>일 전</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyTicketExpired" type="checkbox" role="switch" aria-label="회원권 만료일 알림" ${policy.ticketExpiredEnabled ? "checked" : ""} />
        <span><strong>만료일</strong><small>사용기간 종료 안내</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyCoachFeedbackReminder" type="checkbox" role="switch" aria-label="코치 피드백 미작성 알림" ${policy.coachFeedbackReminderEnabled ? "checked" : ""} />
        <span><strong>피드백 미작성</strong><small>수업 종료 후 담당 코치에게 알림</small></span>
        <span class="notification-inline-control"><input id="notifyCoachFeedbackReminderMinutes" type="number" min="10" max="1440" aria-label="피드백 작성 알림 시간" value="${policy.coachFeedbackReminderMinutes}" /><b>분 후</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyCoachFeedbackEscalation" type="checkbox" role="switch" aria-label="피드백 미작성 관리자 알림" ${policy.coachFeedbackAdminEscalationEnabled ? "checked" : ""} />
        <span><strong>미작성 관리자 확인</strong><small>장기 미처리 수업을 관리자에게 알림</small></span>
        <span class="notification-inline-control"><input id="notifyCoachFeedbackEscalationHours" type="number" min="1" max="168" aria-label="관리자 확인 알림 시간" value="${policy.coachFeedbackAdminEscalationHours}" /><b>시간 후</b></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyMemberFeedbackReady" type="checkbox" role="switch" aria-label="회원 피드백 등록 알림" ${policy.memberFeedbackReadyEnabled ? "checked" : ""} />
        <span><strong>피드백 등록 완료</strong><small>코치가 저장하면 회원에게 즉시 알림</small></span>
      </div>
      <div class="notification-rule-row">
        <input id="notifyScheduleRequestStaff" type="checkbox" role="switch" aria-label="수업 변경 및 보강 신청 알림" ${policy.scheduleRequestStaffEnabled ? "checked" : ""} />
        <span><strong>변경·보강 신청</strong><small>담당 코치와 관리자에게 즉시 알림</small></span>
      </div>
    </div>
    <div class="notification-delivery-metrics">
      <div><span>발송 대기</span><strong>${notificationDeliveryState.queued}</strong></div>
      <div><span>오늘 발송</span><strong>${notificationDeliveryState.sentToday}</strong></div>
      <div class="${notificationDeliveryState.failed ? "has-error" : ""}"><span>최근 오류</span><strong>${notificationDeliveryState.failed}</strong></div>
      <div><span>연결 기기</span><strong>${notificationDeliveryState.activeDevices ?? "-"}</strong></div>
    </div>
    <div class="notification-control-footer">
      <span>${escapeHtml(notificationDeliveryState.message)} · ${notificationDateTimeLabel(notificationDeliveryState.checkedAt)}</span>
      ${badge(stateTone, stateLabel)}
    </div>
    <div class="data-action-row notification-action-row">
      <button class="small-button" type="button" id="saveNotificationPolicyButton">알림 설정 저장</button>
      <button class="ghost-button" type="button" id="refreshNotificationStatusButton">발송 현황 새로고침</button>
    </div>
    <details class="notification-history">
      <summary>최근 알림 ${recentRows.length}건</summary>
      <div class="notification-history-list">
        ${recentRows.length
          ? recentRows.map((row) => `
            <div>
              <span>${escapeHtml(notificationTemplateLabel(row.template_key || row.templateKey))}</span>
              <strong>${escapeHtml(row.title || "앱 알림")}</strong>
              <small>${escapeHtml(row.status || "queued")} · ${notificationDateTimeLabel(row.sent_at || row.sentAt || row.scheduled_at || row.scheduledAt)}</small>
            </div>`).join("")
          : '<p class="empty-text">아직 발송 기록이 없습니다.</p>'}
      </div>
    </details>`;
}

function renderAdminLayoutSettings() {
  if (state.view !== "settings") return;
  applyAdminLayoutSettings();
  const target = $("#adminLayoutSettingsPanel");
  const status = $("#adminLayoutSaveStatus");
  if (status) {
    status.textContent = adminLayoutSaveState === "saving"
      ? "저장 중"
      : adminLayoutSaveState === "server"
        ? "서버 저장"
        : adminLayoutSaveState === "conflict"
          ? "다시 확인 필요"
          : "저장 전";
  }
  if (!target) return;
  const activePreset = adminLayoutPresetId();
  target.innerHTML = `
    <section class="admin-layout-presets" aria-label="화면 구성 추천">
      <div>
        <h3>추천 화면</h3>
        <p>업무에 맞는 기본 구성을 고른 뒤 세부 순서와 표시 여부를 바꿀 수 있습니다.</p>
      </div>
      <div class="admin-layout-preset-list">
        ${Object.entries(adminLayoutPresets).map(([id, preset]) => `
          <button class="admin-layout-preset ${activePreset === id ? "is-active" : ""}" type="button" data-admin-layout-preset="${id}" aria-pressed="${activePreset === id}">
            <b>${preset.label}</b><span>${preset.detail}</span>
          </button>`).join("")}
      </div>
    </section>
    <div class="admin-layout-editor-grid">
      <section>
        <h3>왼쪽 메뉴</h3>
        <div class="admin-layout-list">
          ${adminLayoutSettings.menuOrder.map((id, index) => {
            const item = adminMenuDefinitions.find((entry) => entry.id === id);
            return item ? adminLayoutRowMarkup(item, "menu", index, adminLayoutSettings.menuOrder.length) : "";
          }).join("")}
        </div>
      </section>
      <section>
        <h3>대시보드 묶음</h3>
        <div class="admin-layout-list">
          ${adminLayoutSettings.groupOrder.map((id, index) => {
            const item = adminDashboardGroupDefinitions.find((entry) => entry.id === id);
            return item ? adminLayoutRowMarkup(item, "group", index, adminLayoutSettings.groupOrder.length) : "";
          }).join("")}
        </div>
      </section>
      ${Object.entries(adminDashboardWidgetDefinitions).map(([group, items]) => `
        <section>
          <h3>${group === "operations" ? "오늘 운영 안쪽" : "공지·요약 안쪽"}</h3>
          <div class="admin-layout-list">
            ${adminLayoutSettings.widgetOrder[group].map((id, index) => {
              const item = items.find((entry) => entry.id === id);
              return item ? adminLayoutRowMarkup(item, "widget", index, items.length, group) : "";
            }).join("")}
          </div>
        </section>`).join("")}
      <section>
        <h3>경영 리포트 카드</h3>
        <div class="admin-layout-list">
          ${adminLayoutSettings.reportWidgetOrder.map((id, index) => {
            const item = adminReportWidgetDefinitions.find((entry) => entry.id === id);
            return item ? adminLayoutRowMarkup(item, "reportWidget", index, adminLayoutSettings.reportWidgetOrder.length) : "";
          }).join("")}
        </div>
      </section>
    </div>
    <div class="admin-layout-actions">
      <button id="resetAdminLayoutButton" class="ghost-button" type="button">기본 배치</button>
      <button id="saveAdminLayoutButton" class="primary-button" type="button">화면 구성 저장</button>
    </div>`;
}

function renderSettingsTabs() {
  if (state.view !== "settings") return;
  const active = ["operation", "membership", "notifications", "coach", "layout", "security"].includes(state.settingsTab) ? state.settingsTab : "operation";
  const membershipSection = state.membershipSettingsSection === "discounts" ? "discounts" : "products";
  state.settingsTab = active;
  state.membershipSettingsSection = membershipSection;
  $("#settingsView .settings-grid")?.setAttribute("data-active-tab", active);
  $$("[data-settings-tab]").forEach((button) => {
    const selected = button.dataset.settingsTab === active;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  $$("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== active;
  });
  $$("[data-membership-section]").forEach((button) => {
    const selected = button.dataset.membershipSection === membershipSection;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  $$("[data-membership-panel]").forEach((panel) => {
    panel.hidden = active !== "membership" || panel.dataset.membershipPanel !== membershipSection;
  });
}

function renderServiceReadiness() {
  const dataClientReadiness = window.TennisNoteDataClient?.readiness?.();
  const paymentReady = isPaymentGatewayReady();
  const readinessCards = $("#serviceReadinessCards");
  if (readinessCards) {
    readinessCards.innerHTML = serviceReadinessItems
      .map(
        (item) => {
          const isSupabaseItem = item.title === "Supabase DB";
          const isPaymentItem = item.title === "결제";
          const status = isSupabaseItem && dataClientReadiness?.ready ? "ready" : isPaymentItem && paymentReady ? "setup" : item.status;
          const label = isSupabaseItem && dataClientReadiness?.ready ? "연결값 준비" : isPaymentItem && paymentReady ? "결제창 준비" : item.label;
          const detail = isSupabaseItem && dataClientReadiness
            ? `${item.detail} 현재 앱 모드: ${dataClientReadiness.mode === "supabase" ? "Supabase 연결 가능" : "로컬 데모"}.`
            : isPaymentItem && paymentReady
              ? "Store ID와 Channel Key는 로컬에 저장되어 회원앱 결제창 연결을 테스트할 수 있습니다. 회원권 자동 충전은 서버 검증과 웹훅 연결 후 처리합니다."
            : item.detail;
          const next = isPaymentItem && paymentReady ? "PortOne 서버 검증/웹훅" : item.next;
          return `
        <article class="readiness-card">
          <div>
            <strong>${item.title}</strong>
            ${badge(status, label)}
          </div>
          <p>${detail}</p>
          <small>다음: ${next}</small>
        </article>`;
        },
      )
      .join("");
  }

  if (state.view !== "settings") return;
  renderPaymentSetup();

  const productCards = $("#productSettingCards");
  if (productCards) {
    renderProductBulkToolbar();
    const allProducts = membershipProductsForActiveOperationProfile();
    const filteredProducts = filteredMembershipProducts();
    const activeProductIndex = filteredProducts.findIndex((product) => String(product.id) === String(state.activeMembershipProductId || ""));
    if (activeProductIndex >= 0) state.membershipProductPage = Math.floor(activeProductIndex / membershipProductPageSize);
    state.membershipProductPage = normalizeDashboardPage(filteredProducts.length, state.membershipProductPage, membershipProductPageSize);
    const visibleProducts = filteredProducts.slice(
      state.membershipProductPage * membershipProductPageSize,
      (state.membershipProductPage + 1) * membershipProductPageSize,
    );
    if ($("#membershipProductSearch") && $("#membershipProductSearch").value !== state.membershipProductSearch) {
      $("#membershipProductSearch").value = state.membershipProductSearch || "";
    }
    if ($("#membershipProductStatusFilter")) $("#membershipProductStatusFilter").value = state.membershipProductStatusFilter;
    renderDashboardPager("#membershipProductPager", filteredProducts.length, state.membershipProductPage, "membership-products", membershipProductPageSize);
    const branchStatus = $("#membershipProductBranchStatus");
    if (branchStatus) {
      branchStatus.textContent = filteredProducts.length === allProducts.length
        ? `${activeOperationBranchName()} 상품 ${allProducts.length}개`
        : `${activeOperationBranchName()} 상품 ${allProducts.length}개 · 검색 ${filteredProducts.length}개`;
    }
    [
      ["#addMembershipProductButton", "회원권 추가"],
      ["#addOneDayProductButton", "원데이 1회권 추가"],
    ].forEach(([selector, label]) => {
      const button = $(selector);
      if (!button) return;
      button.disabled = operationsRole() !== "admin" || !activeOperationBranchId();
      button.title = activeOperationBranchId() ? `${activeOperationBranchName()}에 ${label}` : "운영 프로필에서 지점을 먼저 선택해 주세요.";
    });
    productCards.innerHTML = visibleProducts.length ? visibleProducts
      .map(
        (product) => {
          const normalized = normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id));
          const productId = String(normalized.id);
          const isEditing = String(state.activeMembershipProductId || "") === productId;
          if (!isEditing) {
            return `
        <article class="product-setting-card product-setting-summary-card" data-product-card="${normalized.id}">
          <form class="product-setting-header product-setting-inline-form" data-product-inline-form="${normalized.id}" data-dirty="false">
            <div class="product-order-actions">
              <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="up" aria-label="${escapeHtml(normalized.title)} 위로 이동" title="위로 이동">↑</button>
              <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="down" aria-label="${escapeHtml(normalized.title)} 아래로 이동" title="아래로 이동">↓</button>
            </div>
            <input class="product-select-checkbox" type="checkbox" data-select-product-row="${normalized.id}" aria-label="${escapeHtml(normalized.title)} 선택" ${selectedProductIdSet().has(productId) ? "checked" : ""} ${operationsRole() !== "admin" ? "disabled" : ""} />
            <label class="product-setting-inline-title">
              <span class="sr-only">상품명</span>
              <input type="text" data-product-field="title" value="${escapeHtml(normalized.title)}" aria-label="${escapeHtml(normalized.title)} 상품명" />
            </label>
            <div class="product-setting-inline-pair">
              <select data-product-field="productKind" aria-label="${escapeHtml(normalized.title)} 권종">
                <option value="regular" ${normalized.productKind === "regular" ? "selected" : ""}>정규권</option>
                <option value="coupon" ${normalized.productKind === "coupon" ? "selected" : ""}>쿠폰제</option>
              </select>
              <select data-product-field="scheduleScope" aria-label="${escapeHtml(normalized.title)} 레슨 방식">
                <option value="weekday" ${normalized.scheduleScope === "weekday" ? "selected" : ""}>평일</option>
                <option value="weekend" ${normalized.scheduleScope === "weekend" ? "selected" : ""}>주말</option>
                <option value="mixed" ${normalized.scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
              </select>
              <select data-product-field="groupSize" aria-label="${escapeHtml(normalized.title)} 수업 종류">
                <option value="1" ${Number(normalized.groupSize) === 1 ? "selected" : ""}>1:1</option>
                <option value="2" ${Number(normalized.groupSize) === 2 ? "selected" : ""}>1:2</option>
              </select>
            </div>
            <div class="product-setting-inline-triple">
              <select data-product-field="lessonMinutes" aria-label="${escapeHtml(normalized.title)} 수업 시간">
                ${[20, 30, 40].map((minute) => `<option value="${minute}" ${Number(normalized.lessonMinutes) === minute ? "selected" : ""}>${minute}분</option>`).join("")}
              </select>
              <input type="number" min="1" step="1" data-product-field="tickets" value="${normalized.tickets}" aria-label="${escapeHtml(normalized.title)} 횟수" />
              <input type="number" min="1" step="1" data-product-field="validityDays" value="${normalized.validityDays}" aria-label="${escapeHtml(normalized.title)} 사용기간 일수" />
            </div>
            <div class="product-setting-inline-price">
          <input type="number" min="0" step="1" data-product-field="cashAmount" value="${normalized.cashAmount}" aria-label="${escapeHtml(normalized.title)} 현금가격" />
          <input type="number" min="0" step="1" data-product-field="cardAmount" value="${normalized.cardAmount}" aria-label="${escapeHtml(normalized.title)} 카드가격" />
            </div>
            <select class="product-setting-quick-status" data-product-field="status" aria-label="${escapeHtml(normalized.title)} 판매 상태" ${operationsRole() !== "admin" ? "disabled" : ""}>
              ${membershipProductStatusOptions.map((option) => `<option value="${option.id}" ${option.id === normalized.status ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
            <div class="product-setting-row-actions">
              <button class="small-button product-inline-save" type="button" data-save-product-setting="${normalized.id}">저장</button>
              <button class="small-button danger-button" type="button" data-force-delete-product-setting="${normalized.id}">삭제</button>
              <button class="small-button" type="button" data-open-product-setting="${normalized.id}">수정</button>
            </div>
            <span class="product-inline-message" aria-live="polite"></span>
          </form>
        </article>`;
          }
          return `
        <details class="product-setting-card product-setting-form" data-product-card="${normalized.id}" open>
          <summary class="product-setting-header">
            <div class="product-order-actions">
              <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="up" aria-label="${escapeHtml(normalized.title)} 위로 이동" title="위로 이동">↑</button>
              <button class="icon-button" type="button" data-move-product-setting="${normalized.id}" data-move-direction="down" aria-label="${escapeHtml(normalized.title)} 아래로 이동" title="아래로 이동">↓</button>
            </div>
            <input class="product-select-checkbox" type="checkbox" data-select-product-row="${normalized.id}" aria-label="${escapeHtml(normalized.title)} 선택" ${selectedProductIdSet().has(String(normalized.id)) ? "checked" : ""} ${operationsRole() !== "admin" ? "disabled" : ""} />
            <div>
              <strong>${escapeHtml(normalized.title)}</strong>
              <small>${escapeHtml(normalized.group)} · ${normalized.tickets}회 · ${normalized.validityDays}일</small>
            </div>
            <div class="product-setting-summary-meta">
              <b>현금 ${money.format(normalized.cashAmount)}원 / 카드 ${money.format(normalized.cardAmount)}원</b>
            </div>
            <select class="product-setting-quick-status" data-quick-product-status="${normalized.id}" aria-label="${escapeHtml(normalized.title)} 판매 상태" ${operationsRole() !== "admin" ? "disabled" : ""}>
              ${membershipProductStatusOptions.map((option) => `<option value="${option.id}" ${option.id === normalized.status ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </summary>
          <div class="product-setting-fields">
            <label>
              <small>${productSettingFieldLabel("상품명", true)}</small>
              <input type="text" data-product-field="title" value="${escapeHtml(normalized.title)}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("횟수 표기", true)}</small>
              <input type="text" data-product-field="sessions" value="${escapeHtml(normalized.sessions)}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("현금가격", true)}</small>
              <input type="number" min="0" step="1" data-product-field="cashAmount" value="${normalized.cashAmount}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("카드가격", true)}</small>
              <input type="number" min="0" step="1" data-product-field="cardAmount" value="${normalized.cardAmount}" />
            </label>
            ${normalized.purchaseExperience === "one_day" ? `
            <label>
              <small>${productSettingFieldLabel("신규 첫 수업 혜택", true)}</small>
              <select data-product-field="firstLessonOfferEnabled">
                <option value="yes" ${normalized.firstLessonOfferEnabled ? "selected" : ""}>사용</option>
                <option value="no" ${!normalized.firstLessonOfferEnabled ? "selected" : ""}>중지</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("신규 첫 수업가", true)}</small>
              <input type="number" min="1" step="1" data-product-field="firstLessonOfferPrice" value="${normalized.firstLessonOfferPrice || 15000}" />
            </label>
            <p class="product-setting-offer-note">수업·회원권·결제 이력이 전혀 없는 회원에게만 1회 적용됩니다. 앱 가입만 새로 한 기존 회원은 제외됩니다.</p>` : ""}
            <label>
              <small>${productSettingFieldLabel("사용기간(일)", true)}</small>
              <input type="number" min="1" step="1" data-product-field="validityDays" value="${normalized.validityDays}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("유예기간(일)", false, "선택")}</small>
              <input type="number" min="0" step="1" data-product-field="graceDays" value="${normalized.graceDays}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("충전 횟수", true)}</small>
              <input type="number" min="0" step="1" data-product-field="tickets" value="${normalized.tickets}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("레슨 방식", true)}</small>
              <select data-product-field="scheduleScope">
                <option value="weekday" ${normalized.scheduleScope === "weekday" ? "selected" : ""}>평일</option>
                <option value="weekend" ${normalized.scheduleScope === "weekend" ? "selected" : ""}>주말</option>
                <option value="mixed" ${normalized.scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("수업 시간", true)}</small>
              <select data-product-field="lessonMinutes">
                ${[20, 30, 40].map((minute) => `<option value="${minute}" ${Number(normalized.lessonMinutes) === minute ? "selected" : ""}>${minute}분</option>`).join("")}
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("종류", true)}</small>
              <select data-product-field="groupSize">
                <option value="1" ${Number(normalized.groupSize) === 1 ? "selected" : ""}>개인 1:1</option>
                <option value="2" ${Number(normalized.groupSize) === 2 ? "selected" : ""}>그룹 2:1</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("1:2 차감 방식", false, "그룹권만")}</small>
              <select data-group-deduction-policy="${normalized.id}">
                <option value="shared_once" ${normalized.groupDeductionPolicy === "shared_once" ? "selected" : ""}>공유권 1회</option>
                <option value="per_participant" ${normalized.groupDeductionPolicy === "per_participant" ? "selected" : ""}>회원별 각 1회</option>
                <option value="representative_only" ${normalized.groupDeductionPolicy === "representative_only" ? "selected" : ""}>대표회원 1회</option>
              </select>
              <button class="small-button" type="button" data-save-group-deduction-policy="${normalized.id}">차감 방식 저장</button>
            </label>
            <label>
              <small>${productSettingFieldLabel("주 횟수", true)}</small>
              <input type="number" min="0" max="7" step="1" data-product-field="frequencyPerWeek" value="${normalized.frequencyPerWeek}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("하루 최대 사용 회차", true)}</small>
              <input type="number" min="1" max="7" step="1" data-product-field="maxSessionsPerDay" value="${normalized.maxSessionsPerDay || Math.max(1, normalized.frequencyPerWeek)}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("주간 최대 사용 회차", true)}</small>
              <input type="number" min="1" max="14" step="1" data-product-field="maxSessionsPerWeek" value="${normalized.maxSessionsPerWeek || Math.max(1, normalized.frequencyPerWeek)}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("주간 예약 가능 일수", true)}</small>
              <input type="number" min="1" max="7" step="1" data-product-field="maxBookingDaysPerWeek" value="${normalized.maxBookingDaysPerWeek || Math.max(1, normalized.frequencyPerWeek)}" />
            </label>
            <label>
              <small>${productSettingFieldLabel("권종", true)}</small>
              <select data-product-field="productKind">
                <option value="regular" ${normalized.productKind === "regular" ? "selected" : ""}>정규권</option>
                <option value="coupon" ${normalized.productKind === "coupon" ? "selected" : ""}>쿠폰제</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("할인 가능", false, "선택")}</small>
              <select data-product-field="discountEnabled">
                <option value="yes" ${normalized.discountEnabled ? "selected" : ""}>가능</option>
                <option value="no" ${!normalized.discountEnabled ? "selected" : ""}>불가</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("코치 할인권", false, "선택")}</small>
              <select data-product-field="coachDiscountAllowed">
                <option value="yes" ${normalized.coachDiscountAllowed ? "selected" : ""}>사용 가능</option>
                <option value="no" ${!normalized.coachDiscountAllowed ? "selected" : ""}>관리자만</option>
              </select>
            </label>
            <label>
              <small>${productSettingFieldLabel("판매 상태", true)}</small>
              <select data-product-field="status">
                ${membershipProductStatusOptions.map((option) => `<option value="${option.id}" ${option.id === normalized.status ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="product-setting-actions">
            <button class="ghost-button" type="button" data-close-product-setting="${normalized.id}">닫기</button>
            <button class="small-button" type="button" data-save-product-setting="${normalized.id}">저장</button>
            <button class="ghost-button danger-button" type="button" data-force-delete-product-setting="${normalized.id}">강제 삭제</button>
          </div>
        </details>`;
        },
      )
      .join("") : `<p class="empty-text product-setting-empty">${allProducts.length ? "검색 조건에 맞는 회원권 상품이 없습니다." : "이 지점에 등록된 회원권 상품이 없습니다. 새 회원권을 눌러 추가해 주세요."}</p>`;
  }

  const discountCards = $("#discountPolicyCards");
  if (discountCards) {
    state.discountView = state.discountView === "history" ? "history" : "policies";
    state.discountStatusFilter = ["all", "사용", "검토", "중지", "보관"].includes(state.discountStatusFilter) ? state.discountStatusFilter : "all";
    $$('[data-discount-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.discountView === state.discountView));
    if ($("#discountPolicySearch") && $("#discountPolicySearch").value !== state.discountSearch) $("#discountPolicySearch").value = state.discountSearch || "";
    if ($("#discountPolicyStatusFilter")) {
      $("#discountPolicyStatusFilter").value = state.discountStatusFilter;
      $("#discountPolicyStatusFilter").disabled = state.discountView === "history";
    }
    const discountSearch = String(state.discountSearch || "").trim().toLowerCase();
    if (state.discountView === "history") {
      const visibleLogs = discountIssueLogs.filter((log) => !discountSearch || `${log.at} ${log.text}`.toLowerCase().includes(discountSearch));
      discountCards.innerHTML = `
        <article class="discount-policy-card discount-history-card">
          <div><strong>발급·사용 내역</strong><span class="status-badge ready">${visibleLogs.length}건</span></div>
          <div class="discount-history-list">
            ${visibleLogs.length ? visibleLogs.map((log) => `<div><time>${escapeHtml(log.at)}</time><span>${escapeHtml(log.text)}</span></div>`).join("") : '<p class="empty-text">검색된 할인권 처리 내역이 없습니다.</p>'}
          </div>
        </article>`;
    } else {
      const visiblePolicies = discountPolicies.filter((policy) => {
      const normalized = normalizeDiscountPolicy(policy);
      const searchMatch = !discountSearch || `${normalized.title} ${normalized.target} ${normalized.payment}`.toLowerCase().includes(discountSearch);
      const statusMatch = state.discountStatusFilter === "all" || normalized.status === state.discountStatusFilter;
      return searchMatch && statusMatch;
    });
    discountCards.innerHTML = `
      <details class="discount-policy-card discount-create-card">
        <summary>
          <strong>새 할인권 만들기</strong>
          <span class="status-badge pending">관리자 생성</span>
        </summary>
        <div class="discount-create-grid">
          <label><small>이름</small><input id="discountTitleInput" type="text" placeholder="예: 주말 신규 15% 할인권" /></label>
          <label><small>대상</small><input id="discountTargetInput" type="text" value="쿠폰제/정기권" /></label>
          <label><small>방식</small><select id="discountTypeInput"><option value="percent">할인율</option><option value="amount">할인금액</option></select></label>
          <label><small>값</small><input id="discountValueInput" type="number" min="0" value="10" /></label>
          <label><small>결제수단</small><input id="discountPaymentInput" type="text" value="카드/현금" /></label>
          <label><small>코치권한</small><select id="discountCoachPermissionInput"><option>코치별 지급 수량 안에서 사용</option><option>요청만 가능</option><option>관리자만 사용</option></select></label>
          <label><small>코치 지급수량</small><input id="discountQuotaInput" type="number" min="0" value="5" /></label>
          <label><small>유효기간(일)</small><input id="discountExpiresInput" type="number" min="1" value="30" /></label>
          <label><small>부담</small><input id="discountBurdenInput" type="text" value="센터 부담" /></label>
        </div>
        <button class="small-button" type="button" id="createDiscountPolicy">할인권 생성</button>
      </details>
      ${visiblePolicies
      .map((policy) => {
        const normalized = normalizeDiscountPolicy(policy);
        const available = discountAvailableCount(normalized);
        const issuedText = `${normalized.issued}장 지급 · ${normalized.used}장 사용 · ${available}장 남음`;
        const valueLabel = normalized.type === "percent" ? `${normalized.value}%` : `${money.format(normalized.value)}원`;
        return `
        <details class="discount-policy-card" data-discount-card="${normalized.id}">
          <summary>
            <div><strong>${escapeHtml(normalized.title)}</strong><small>${valueLabel} · ${available}장 남음</small></div>
            ${badge(normalized.status === "사용" ? "ready" : "pending", normalized.status)}
          </summary>
          <div class="discount-create-grid">
            <label><small>이름</small><input data-discount-field="title" type="text" value="${escapeHtml(normalized.title)}" /></label>
            <label><small>대상</small><input data-discount-field="target" type="text" value="${escapeHtml(normalized.target)}" /></label>
            <label><small>방식</small><select data-discount-field="type"><option value="percent" ${normalized.type === "percent" ? "selected" : ""}>할인율</option><option value="amount" ${normalized.type === "amount" ? "selected" : ""}>할인금액</option></select></label>
            <label><small>값</small><input data-discount-field="value" type="number" min="0" value="${normalized.value}" /></label>
            <label><small>결제수단</small><input data-discount-field="payment" type="text" value="${escapeHtml(normalized.payment)}" /></label>
            <label><small>코치권한</small><select data-discount-field="coachPermission"><option ${normalized.coachPermission === "코치별 지급 수량 안에서 사용" ? "selected" : ""}>코치별 지급 수량 안에서 사용</option><option ${normalized.coachPermission === "요청만 가능" ? "selected" : ""}>요청만 가능</option><option ${normalized.coachPermission === "관리자만 사용" ? "selected" : ""}>관리자만 사용</option></select></label>
            <label><small>코치 지급수량</small><input data-discount-field="coachQuota" type="number" min="0" value="${normalized.coachQuota}" /></label>
            <label><small>유효기간(일)</small><input data-discount-field="expiresDays" type="number" min="1" value="${normalized.expiresDays}" /></label>
            <label><small>부담</small><input data-discount-field="burden" type="text" value="${escapeHtml(normalized.burden)}" /></label>
            <label><small>상태</small><select data-discount-field="status"><option ${normalized.status === "사용" ? "selected" : ""}>사용</option><option ${normalized.status === "검토" ? "selected" : ""}>검토</option><option ${normalized.status === "중지" ? "selected" : ""}>중지</option><option ${normalized.status === "보관" ? "selected" : ""}>보관</option></select></label>
          </div>
          <dl>
            <div><dt>할인</dt><dd>${valueLabel}</dd></div>
            <div><dt>대상</dt><dd>${escapeHtml(normalized.target)}</dd></div>
            <div><dt>발급/사용</dt><dd>${normalized.issued}/${normalized.used}장</dd></div>
            <div><dt>남은 수량</dt><dd>${available}장</dd></div>
            <div><dt>유효기간</dt><dd>발급 후 ${normalized.expiresDays}일</dd></div>
            <div><dt>코치 한도</dt><dd>${normalized.coachQuota || 0}장</dd></div>
          </dl>
          <p>${escapeHtml(issuedText)}</p>
          <div class="discount-action-row">
            <button class="small-button" type="button" data-save-discount-policy="${normalized.id}">저장</button>
            <button class="ghost-button danger-button" type="button" data-archive-discount-policy="${normalized.id}" ${normalized.status === "보관" ? "disabled" : ""}>보관</button>
          </div>
        </details>`;
      })
      .join("") || '<p class="empty-text">조건에 맞는 할인권 정책이 없습니다.</p>'}`;
    }
  }

  const roleFlow = $("#coachRoleFlow");
  if (roleFlow) {
    roleFlow.innerHTML = coachRegistrationFlow
      .map(
        (item) => `
        <article class="role-flow-item">
          <b>${item.step}</b>
          <div>
            <strong>${item.title}</strong>
            <span>${item.detail}</span>
          </div>
        </article>`,
      )
      .join("");
  }
}

function renderSupabaseLiveStatus() {
  const target = $("#supabaseLiveStatus");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const items = supabaseLiveState.items.length
    ? supabaseLiveState.items
    : supabaseLiveTables.map((item) => ({ ...item, title: item.label, status: "setup", label: readiness?.ready ? "확인 전" : "설정 필요", detail: readiness?.ready ? "새로고침을 눌러 실제 읽기를 확인합니다." : "브라우저용 로컬 설정 파일이 필요합니다." }));

  target.innerHTML = `
    <article class="supabase-live-summary ${readiness?.ready ? "is-ready" : "is-setup"}">
      <strong>${readiness?.ready ? "앱 연결값 준비됨" : "앱 연결값 없음"}</strong>
      <span>${supabaseLiveState.loading ? "확인 중" : supabaseLiveState.message}</span>
    </article>
    ${items
      .map(
        (item) => `
      <article class="supabase-live-card ${item.status}">
        <div>
          <strong>${item.title || item.label}</strong>
          ${badge(item.status === "empty" ? "draft" : item.status === "blocked" ? "attention" : item.status, item.label)}
        </div>
        <p>${item.table}</p>
        <small>${item.detail}</small>
      </article>`,
      )
      .join("")}
  `;
}

function renderAuthProviderStatus() {
  const target = $("#authProviderStatus");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const items = authProviderState.items.length ? authProviderState.items : authProviderItems();
  target.innerHTML = `
    <article class="supabase-live-summary ${readiness?.ready ? "is-ready" : "is-setup"}">
      <strong>${readiness?.ready ? "Auth 확인 가능" : "앱 연결값 없음"}</strong>
      <span>${authProviderState.loading ? "확인 중" : authProviderState.message}</span>
    </article>
    ${items
      .map(
        (item) => `
      <article class="supabase-live-card ${item.status}">
        <div>
          <strong>${item.title}</strong>
          ${badge(item.status === "setup" ? "draft" : item.status, item.label)}
        </div>
        <p>${item.id}</p>
        <small>${item.detail}</small>
      </article>`,
      )
      .join("")}
  `;
}

function renderActiveSettingsPanel() {
  if (state.view !== "settings") return;
  switch (state.settingsTab) {
    case "membership":
      renderServiceReadiness();
      break;
    case "notifications":
      renderNoticePopupSettings();
      renderNotificationPolicySettings();
      break;
    case "coach":
      renderCoaches();
      renderCoachSettlementPreview();
      break;
    case "layout":
      renderAdminLayoutSettings();
      break;
    case "security":
      renderMemberManagementPolicySettings();
      renderAdminSecurity();
      break;
    case "operation":
    default:
      renderScheduleSettings();
      renderRefundPolicySettings();
      renderHoldingPolicySettings();
      break;
  }
}
