// 공통 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderGlobalSearchResults() {
  const input = $("#globalSearch");
  const target = $("#globalSearchResults");
  if (!input || !target) return;
  const query = input.value.trim();
  input.setAttribute("aria-expanded", query ? "true" : "false");
  target.hidden = !query;
  if (!query) {
    target.innerHTML = "";
    return;
  }

  const results = getGlobalSearchResults(query);
  target.innerHTML = results.length
    ? results
        .map(
          (item) => `
            <button class="global-search-result" type="button" role="option" data-global-search-result data-search-view="${item.view}" ${item.memberId ? `data-search-member-id="${item.memberId}"` : ""} ${item.settingsTab ? `data-search-settings-tab="${item.settingsTab}"` : ""}>
              <span>${escapeHtml(item.kind)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </button>`,
        )
        .join("")
    : `<div class="global-search-empty" role="status">
        <strong>검색 결과가 없습니다.</strong>
        <span>이름, 코치, 요일·시간 또는 상태를 다시 확인해 주세요.</span>
      </div>`;
}

function renderMetrics() {
  const recordGroups = adminRecordGroups();
  const todayLessonCount = adminTodayLessonRows().length;
  const pendingScheduleCount = operationBranchLessons().filter((lesson) => isPendingScheduleLesson(lesson)).length;
  $("#metricLessons").textContent = todayLessonCount;
  $("#metricMakeups").textContent = pendingLessonChangeApprovals().length;
  $("#metricNotes").textContent = recordGroups.pending.length + recordGroups.feedback.length + recordGroups.issue.length;
  $("#metricBilling").textContent = operationBranchBillings().filter(billingNeedsAdminAction).length;
  if ($("#scheduleMetricToday")) $("#scheduleMetricToday").textContent = `${todayLessonCount}회`;
  if ($("#scheduleMetricPending")) $("#scheduleMetricPending").textContent = `${pendingScheduleCount}건`;
}

function renderModePanel() {
  const mode = modeSummaries[state.activeMode] || modeSummaries.admin;
  $("#modePanel").innerHTML = `
    <div>
      <p class="eyebrow">${state.activeMode === "member" ? "Member App" : "Operations Mode"}</p>
      <h2>${mode.title}</h2>
      <p class="mode-copy">${mode.subtitle}</p>
    </div>
    <div class="mode-grid">
      ${mode.metrics
        .map(
          (item) => `
            <div class="mode-stat">
              <span>${item}</span>
            </div>`,
        )
        .join("")}
    </div>
    <div class="mode-actions">
      ${mode.actions.map((item) => `<button class="small-button" type="button" data-mode-action="${item}">${item}</button>`).join("")}
    </div>
  `;
}

function renderAccountDeletionAdminList() {
  const target = $("#accountDeletionAdminList");
  if (!target) return;
  const requests = state.accountDeletionRequests || [];
  scheduleAccountDeletionRetryRefresh(requests);
  const panel = target.closest("details");
  if (panel && requests.some((request) => ["pending", "reviewing", "processing", "failed"].includes(request.status))) panel.open = true;
  target.innerHTML = requests.length
    ? requests.map((request) => `
      <article class="holding-admin-row ${escapeHtml(request.status || "pending")}">
        <div class="holding-admin-main">
          <strong>${escapeHtml(request.member || "회원")}</strong>
          <span>${escapeHtml(accountDeletionStatusLabel(request.status))} · ${escapeHtml(accountDeletionDateTime(request.requestedAt || request.createdAt))}</span>
          <small>${escapeHtml(request.reason || "사유 미입력")} ${request.retainedDataSummary ? `· 보관: ${escapeHtml(request.retainedDataSummary)}` : ""}${request.status === "failed" ? " · 서버 삭제 작업 재시도 필요" : ""}</small>
        </div>
        <div class="holding-admin-status">
          ${badge(request.status === "completed" ? "ready" : ["cancelled", "failed"].includes(request.status) ? "danger" : "pending", accountDeletionStatusLabel(request.status))}
        </div>
        <div class="holding-admin-actions">
          ${accountDeletionActionButton(request)}
        </div>
      </article>`).join("")
    : `<p class="empty-text">접수된 회원 탈퇴 요청이 없습니다.</p>`;
}

function renderSplitSegment(kind, lesson, label, extraClass = "", addSlot = null) {
  if (!lesson) {
    const addAttrs = addSlot ? lessonAddAttrs(addSlot.day, addSlot.time) : "";
    return `
      <button class="split-segment empty ${extraClass}" type="button" ${addAttrs}>
        <strong>${label}</strong>
        <small>예약 가능</small>
      </button>`;
  }

  const isDimmed = !scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson);
  return `
    <button class="split-segment ${kind} ${lessonCssStatusClass(lesson)} ${getLessonStateClass(lesson)} duration-${durationTone(lesson)} ${getCoachToneClass(lesson.coachId)} ${extraClass} ${isDimmed ? "is-dimmed" : ""}" type="button" ${lessonActionAttrs(lesson)}>
      <strong>${label}</strong>
      <span>${getLessonMembersMarkup(lesson)}</span>
      <small>${getCoachName(lesson.coachId)} · ${getLessonRoundLabel(lesson)} · ${lessonTypeLabel(lesson)}</small>
      ${durationBadge(lesson)}
    </button>`;
}

function renderContinuationSegment(label, detail, addSlot) {
  return `
    <button class="split-segment continuation" type="button" ${lessonAddAttrs(addSlot.day, addSlot.time)}>
      <strong>${label}</strong>
      <small>${detail}</small>
    </button>`;
}

function renderSplitStartWithOverlap(day, time, lesson, label, extraClass = "") {
  return `
    <div class="split-parallel ${extraClass}">
      <div class="overlap-note ${getCoachToneClass(lesson.coachId)}">
        <strong>10분 겹침</strong>
        <small>다른 코트 가능</small>
      </div>
      ${renderSplitSegment("starts", lesson, label)}
    </div>`;
}

function renderTickets() {
  const target = $("#ticketRows");
  if (!target) return;
  const branchExpiredTickets = operationBranchTickets(expiredTickets);
  target.innerHTML = branchExpiredTickets.length
    ? branchExpiredTickets
    .map(
      (ticket) => `
        <tr>
          <td>${ticket.member}</td>
          <td>${getTicketDisplayProduct(ticket)} 총 ${ticket.total}회<br><small>잔여 ${ticket.remaining}회</small></td>
          <td>${ticket.total}회</td>
          <td>${ticket.used}회</td>
          <td><strong>${ticket.remaining}회</strong></td>
          <td>${ticket.purchased}~${ticket.expires}<br><small>${ticket.statusLabel}</small></td>
        </tr>`,
    )
    .join("")
    : `<tr><td colspan="6">만료된 회원권 이력이 없습니다.</td></tr>`;
}

function renderRackettime() {
  if (!$("#racketMetricCards") || !$("#settlementRows") || !$("#racketMemberRows")) return;
  $("#racketMetricCards").innerHTML = operationMetrics
    .map(
      (item) => `
        <article class="operation-card ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.compare}</small>
        </article>`,
    )
    .join("");

  $("#settlementRows").innerHTML = settlements
    .map(
      (item) => `
        <tr>
          <td>${item.date}</td>
          <td>${money.format(item.sales)}원</td>
          <td>-${money.format(item.fee)}원</td>
          <td><strong>${money.format(item.net)}원</strong></td>
        </tr>`,
    )
    .join("");

  $("#racketMemberRows").innerHTML = racketMembers
    .map(
      (member) => `
        <tr>
          <td>${escapeHtml(member.name)}</td>
          <td>${member.reservations}회</td>
          <td>${money.format(member.total)}원</td>
          <td>${member.lastVisit}</td>
          <td>${member.action}</td>
        </tr>`,
    )
    .join("");
}

function renderCommunity() {
  if (!$("#communityFeed") || !$("#hotTopics")) return;
  const filteredPosts = state.communityChannel === "홈" ? communityPosts : communityPosts.filter((post) => post.channel === state.communityChannel);
  $("#communityFeed").innerHTML = filteredPosts.length ? filteredPosts
    .map(
      (post) => `
        <article class="post-card">
          <div class="post-meta">
            <span>${post.channel}</span>
            <b>${post.type}</b>
          </div>
          <h2>${post.title}</h2>
          <p>${post.body}</p>
          <div class="post-actions">
            <span>좋아요 ${post.likes}</span>
            <span>댓글 ${post.comments}</span>
          </div>
        </article>`,
    )
    .join("") : `<p class="empty-text">${state.communityChannel} 채널에 새 글을 작성해보세요.</p>`;

  $("#hotTopics").innerHTML = [
    "보강 가능한 빈 시간대",
    "초보 회원이 자주 묻는 질문",
    "이번 주 동호회 참가 명단",
    "개인 연습 이용 후기",
  ]
    .map((topic) => `<li>${topic}</li>`)
    .join("");
}

function renderAdminPendingUsers() {
  const target = $("#adminPendingUsersPanel");
  if (!target) return;
  const readiness = window.TennisNoteDataClient?.readiness?.();
  const canApprove = adminApprovalReady();
  const items = adminPendingUsersState.items.slice(0, 12);
  if (!adminPendingUsersState.loading && !items.length) {
    target.innerHTML = `
      <section class="admin-pending-compact">
        <div><strong>가입 대기</strong><span>${escapeHtml(adminPendingUsersState.message || (canApprove ? "처리할 가입 계정이 없습니다." : "관리자 로그인 후 확인할 수 있습니다."))}</span></div>
        <button class="ghost-button" type="button" data-admin-users-action="refresh">새로고침</button>
      </section>`;
    return;
  }
  target.innerHTML = `
    <section class="admin-pending-card">
      <div class="panel-heading compact-heading">
        <div>
          <h3>가입 계정 관리</h3>
        </div>
        <div class="data-action-row compact">
          <button class="ghost-button" type="button" data-admin-users-action="refresh" ${adminPendingUsersState.loading ? "disabled" : ""}>새로고침</button>
        </div>
      </div>
      <div class="data-status-card ${canApprove ? "good" : readiness?.ready ? "warn" : "neutral"}">
        <div>
          <strong>${adminPendingUsersState.loading ? "확인 중" : adminPendingUsersState.message}</strong>
          <span>보류된 가입 계정과 코치 권한을 여기서 처리합니다.</span>
        </div>
        ${badge(canApprove ? "ready" : "pending", canApprove ? "승인 가능" : "로그인 필요")}
      </div>
      <div class="admin-pending-list">
        ${
          items.length
            ? items
                .map((user) => {
                  const id = escapeHtml(String(user.id || ""));
                  const name = escapeHtml(String(user.name || "이름 없음"));
                  return `
                    <article class="admin-pending-row">
                      <div>
                        <strong>${name}</strong>
                        <span>${escapeHtml(String(user.role || "member"))} · ${escapeHtml(String(user.status || "pending"))}</span>
                        <small>${escapeHtml(String(user.created_at || "").slice(0, 10) || "가입일 확인 전")}</small>
                      </div>
                      <label>
                        <small>권한</small>
                        <select data-admin-pending-role="${id}" ${canApprove ? "" : "disabled"}>
                          <option value="member" ${user.role === "member" ? "selected" : ""}>회원</option>
                          <option value="coach" ${user.role === "coach" ? "selected" : ""}>코치</option>
                          <option value="admin" ${user.role === "admin" ? "selected" : ""}>관리자</option>
                        </select>
                      </label>
                      <label>
                        <small>코치 표시명</small>
                        <input data-admin-pending-display="${id}" value="${name}" ${canApprove ? "" : "disabled"} />
                      </label>
                      <div class="admin-pending-actions">
                        <button class="small-button" type="button" data-admin-approve-user="${id}" ${canApprove ? "" : "disabled"}>승인</button>
                        <button class="ghost-button" type="button" data-admin-hold-user="${id}" ${canApprove ? "" : "disabled"}>보류</button>
                      </div>
                    </article>`;
                })
                .join("")
            : `<p class="empty-text">${adminPendingUsersState.loading ? "불러오는 중입니다." : "정리할 이전·보류 계정이 없습니다."}</p>`
        }
      </div>
    </section>`;
}

function renderAdminSecurity() {
  if (state.view !== "settings") return;
  $$(".nav-item").forEach((button) => {
    const view = button.dataset.view || "";
    const locked = isAdminViewLocked(view);
    button.classList.toggle("is-locked", locked);
    button.classList.toggle("is-unlocked", locked && isAdminUnlocked());
    if (locked) button.title = isAdminUnlocked() ? `잠금 해제됨 · ${adminUnlockRemainingText()}` : "관리자 PIN 필요";
    else button.removeAttribute("title");
  });

  const target = $("#adminSecurityPanel");
  if (!target) return;
  const draft = currentAdminSecurityDraft();
  const lockedLabels = draft.lockedViews.map(adminLockViewName);
  const pinSetupRequired = adminPinNeedsSetup();
  const securityMode = adminSecurityMode(draft);
  const modeLabel = adminSecurityPresets[securityMode]?.label || "직접 설정";
  target.innerHTML = `
    <div class="admin-security-summary ${draft.enabled ? "is-on" : "is-off"}">
      <div>
        <h2>운영 잠금</h2>
        <span>${adminSecurityIsDirty() ? "저장 전 변경사항 있음" : `${modeLabel} · ${draft.enabled ? lockedLabels.join(", ") || "잠금 대상 없음" : "추가 PIN 없음"}`}</span>
      </div>
      ${badge(adminSecuritySaveState.status === "blocked" ? "danger" : draft.enabled ? "warn" : "neutral", adminSecuritySaveState.status === "saving" ? "저장 중" : adminSecuritySaveState.status === "blocked" ? "저장 실패" : adminSecurityIsDirty() ? "저장 필요" : draft.enabled ? adminUnlockRemainingText() : "꺼짐")}
    </div>
    <div class="admin-security-mode-list" role="radiogroup" aria-label="운영 잠금 방식">
      ${Object.entries(adminSecurityPresets).map(([id, preset]) => `
        <button class="admin-security-mode ${securityMode === id ? "is-active" : ""}" type="button" data-admin-security-mode="${id}" aria-pressed="${securityMode === id}">
          <b>${preset.label}${id === "transition" ? " · 추천" : ""}</b>
          <span>${preset.detail}</span>
        </button>`).join("")}
      <button class="admin-security-mode ${securityMode === "custom" ? "is-active" : ""}" type="button" data-admin-security-mode="custom" aria-pressed="${securityMode === "custom"}">
        <b>직접 설정</b>
        <span>잠글 메뉴와 유지시간을 직접 선택합니다.</span>
      </button>
    </div>
    <p class="admin-security-login-note">관리자 로그인은 항상 유지됩니다. 여기서는 로그인 후 사용하는 추가 PIN만 설정합니다.</p>
    <section class="admin-security-grid">
      <article class="admin-security-card" ${securityMode === "transition" ? "hidden" : ""}>
        <strong>추가 PIN</strong>
        <label class="toggle-row">
          <input id="adminLockEnabled" type="checkbox" ${draft.enabled ? "checked" : ""} />
          <span>선택한 메뉴를 PIN으로 보호</span>
        </label>
        <label class="field-row">
          <span>잠금 해제 유지시간</span>
          <select id="adminLockTimeout">
            ${[3, 5, 10, 15, 30, 60].map((minute) => `<option value="${minute}" ${draft.timeoutMinutes === minute ? "selected" : ""}>${minute}분</option>`).join("")}
          </select>
        </label>
        <label class="toggle-row">
          <input id="adminPastAbsenceLockEveryTime" type="checkbox" ${draft.pastAbsenceRequirePinEveryTime ? "checked" : ""} />
          <span>지난 수업 보정 때마다 PIN 확인</span>
        </label>
        <div class="data-action-row">
          <button class="ghost-button" type="button" id="adminLockNowButton">지금 다시 잠그기</button>
        </div>
      </article>
      <article class="admin-security-card" ${securityMode === "transition" ? "hidden" : ""}>
        <strong>잠금 대상 메뉴</strong>
        <div class="admin-lock-target-list">
          ${adminLockViewOptions
            .map(
              (item) => `
                <label class="admin-lock-target">
                  <input type="checkbox" value="${item.id}" data-admin-lock-view ${draft.lockedViews.includes(item.id) ? "checked" : ""} />
                  <span>
                    <b>${item.label}</b>
                  </span>
                </label>`,
            )
            .join("")}
        </div>
      </article>
      <article class="admin-security-card admin-pin-card" ${securityMode === "transition" ? "hidden" : ""}>
        <strong>운영 PIN 변경</strong>
        <p>숫자 6~8자리 PIN을 설정합니다.</p>
        <div class="admin-pin-grid">
          <label>
            <small>현재 PIN</small>
            <input id="adminCurrentPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" />
          </label>
          <label>
            <small>새 PIN</small>
            <input id="adminNewPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" />
          </label>
          <label>
            <small>새 PIN 확인</small>
            <input id="adminConfirmPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" />
          </label>
        </div>
        <div class="data-action-row">
          <button class="primary-button" type="button" id="changeAdminPinButton">운영 PIN 변경</button>
        </div>
      </article>
      <footer class="admin-security-actions">
        <span>${adminSecuritySaveState.status === "saved" && adminSecuritySaveState.savedAt ? `서버 저장 완료 · ${new Date(adminSecuritySaveState.savedAt).toLocaleString("ko-KR")}` : "저장하면 모든 관리자 기기에 적용됩니다."}</span>
        <div>
          <button class="ghost-button" type="button" id="resetAdminSecurityButton" ${adminSecurityIsDirty() && adminSecuritySaveState.status !== "saving" ? "" : "disabled"}>변경 취소</button>
          <button class="primary-button" type="button" id="saveAdminSecurityButton" ${adminSecurityIsDirty() && adminSecuritySaveState.status !== "saving" ? "" : "disabled"}>잠금 설정 저장</button>
        </div>
      </footer>
    </section>`;
  if (pinSetupRequired && draft.enabled) {
    target.querySelector("#adminCurrentPin")?.closest("label")?.setAttribute("hidden", "");
    const summary = target.querySelector(".admin-security-summary span");
    const summaryBadge = target.querySelector(".admin-security-summary .badge");
    const title = target.querySelector(".admin-pin-card strong");
    const description = target.querySelector(".admin-pin-card p");
    const button = target.querySelector("#changeAdminPinButton");
    if (summary) summary.textContent = "운영 PIN 설정 필요";
    if (summaryBadge) {
      summaryBadge.className = "badge danger";
      summaryBadge.textContent = "PIN 설정 필요";
    }
    if (title) title.textContent = "운영 PIN 최초 설정";
    if (description) description.textContent = "숫자 6~8자리 PIN을 설정하세요.";
    if (button) button.textContent = "PIN 설정 완료";
  }
}

function renderAll() {
  renderActiveOperationBranchContext();
  renderOperationsLoginGate();
  renderSupabaseLiveStatus();
  renderAuthProviderStatus();
  renderDataTools();
  renderGlobalSearchResults();
  if (!operationsAccessReady()) {
    saveSnapshot();
    return;
  }
  adminViewRenderRevision += 1;
  renderAdminView(state.view);
  saveSnapshot();
}

function renderAdminView(view = state.view) {
  if (!operationsAccessReady()) return;
  const activeView = view === "makeup"
    ? "schedule"
    : view;

  if (activeView === "dashboard") {
    renderMetrics();
    renderCourtControls();
    renderDashboard();
    renderAdminOperations();
    renderReports();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "members") {
    renderMembers();
    renderHoldingRequestAdminList();
    renderAccountDeletionAdminList();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "schedule") {
    renderCourtControls();
    renderSchedule();
    renderScheduleChangeApprovalQueue();
    renderMakeups();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "billing") {
    renderTickets();
    renderBilling();
    renderCoachSettlementPreview();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "reports") {
    renderReports();
    applyAdminLayoutSettings();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "notes") {
    renderNotes();
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView === "issues") {
    rememberAdminViewRender(activeView);
    return;
  }

  if (activeView !== "settings") return;
  renderSettingsTabs();
  renderActiveSettingsPanel();
  rememberAdminViewRender(activeView);
}

function renderAdminConnectivityStatus(
  reconnected = false,
  customMessage = "",
  customTone = "",
  hideAfterMs = 2500,
) {
  const status = $("#adminConnectivityStatus");
  const message = $("#adminConnectivityMessage");
  if (!status || !message) return;
  window.clearTimeout(adminConnectivityHideTimer);
  const online = window.TennisNoteDataClient?.isOnline?.() !== false;
  if (!online) {
    status.hidden = false;
    status.dataset.tone = "offline";
    message.textContent = "오프라인 · 최근 자료 조회만 가능하며 운영 변경은 연결 후 처리할 수 있습니다.";
    return;
  }
  if (customMessage) {
    status.hidden = false;
    status.dataset.tone = customTone || "online";
    message.textContent = customMessage;
    if (hideAfterMs > 0) {
      adminConnectivityHideTimer = window.setTimeout(() => {
        status.hidden = true;
      }, hideAfterMs);
    }
    return;
  }
  if (!reconnected) {
    status.hidden = true;
    status.dataset.tone = "";
    message.textContent = "";
    return;
  }
  status.hidden = false;
  status.dataset.tone = "online";
  message.textContent = "인터넷 연결 복구 · 운영 자료를 다시 확인합니다.";
  adminConnectivityHideTimer = window.setTimeout(() => {
    status.hidden = true;
  }, 2500);
}
