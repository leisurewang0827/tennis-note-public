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

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function adminEmptyState(options = {}) {
  return window.TennisNoteUiLanguage?.emptyState?.(options)
    || `<p class="empty-text">${escapeHtml(options.title || "표시할 내용이 없습니다.")}</p>`;
}

function avatarMarkup(person, className = "") {
  const photoUrl = person?.photoUrl?.trim();
  const name = person?.name || person?.member || "";
  return `<span class="profile-avatar ${className} ${photoUrl ? "has-photo" : "is-empty"}" aria-label="${escapeHtml(photoUrl ? `${name} 프로필 사진` : "기본 프로필 이미지")}">
    <span class="profile-avatar-placeholder" aria-hidden="true"></span>
    ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)} 프로필 사진" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('is-empty');this.remove()" />` : ""}
  </span>`;
}

function memberPaymentRecordStateOptions(record = null) {
  const state = memberPaymentRecordState(record);
  return [
    ["unentered", "미입력"],
    ["complete", "결제 완료"],
    ["transfer_zero", "양도 · 0원"],
    ...(state === "incomplete" ? [["incomplete", "확인 필요 · 기존값 유지"]] : []),
  ].map(([value, label]) => `<option value="${value}" ${state === value ? "selected" : ""}>${label}</option>`).join("");
}

function memberAuthStatusMarkup(member = {}) {
  const connection = memberAuthConnection(member);
  const label = connection.linked
    ? (connection.providers.map(authProviderLabel).filter(Boolean).join(" · ") || "연결됨")
    : "미연결";
  const detail = connection.linked
    ? `${connection.detail}${member.authLastSignInAt ? ` · 최근 로그인 ${notificationDateTimeLabel(member.authLastSignInAt)}` : ""}`
    : "회원이 앱에서 로그인하면 자동으로 연결 상태가 표시됩니다.";
  if (operationsRole() === "admin" && member.id) {
    return `<button class="member-auth-link-action" type="button"
      data-open-member-management="app_link"
      data-member-management-member-id="${member.id}"
      title="${escapeHtml(detail)}">
        <span class="member-auth-status ${connection.linked ? "is-linked" : "is-unlinked"}">${escapeHtml(label)}</span>
        <small>${connection.linked ? "로그인 변경" : "앱 연결"}</small>
      </button>`;
  }
  return `<span class="member-auth-status ${connection.linked ? "is-linked" : "is-unlinked"}" title="${escapeHtml(detail)}">${escapeHtml(label)}</span>`;
}

function accountDeletionActionButton(request) {
  if (accountDeletionExecutionInFlight.has(request.id)) {
    return `<button class="small-button" type="button" disabled aria-busy="true">삭제 처리 중</button>`;
  }
  if (request.status === "pending") {
    return `<button class="small-button" type="button" data-review-account-deletion="reviewing" data-account-deletion-id="${escapeHtml(request.id)}">검토 시작</button>`;
  }
  if (request.status === "reviewing") {
    return `<button class="small-button danger-button" type="button" data-review-account-deletion="completed" data-account-deletion-id="${escapeHtml(request.id)}">계정 삭제 실행</button>`;
  }
  if (request.status === "failed" || accountDeletionProcessingIsStale(request)) {
    return `<button class="small-button danger-button" type="button" data-review-account-deletion="completed" data-account-deletion-id="${escapeHtml(request.id)}">삭제 다시 시도</button>`;
  }
  if (request.status === "processing") {
    return `<button class="small-button" type="button" disabled>삭제 처리 중</button>`;
  }
  return "";
}

function memberPaymentOverviewMarkup(member) {
  const managedTickets = memberManagementTickets(member).filter((ticket) => ticket.status !== "voided");
  const paymentRows = managedTickets.map((ticket) => {
    const record = memberTicketPaymentProjection(member, ticket);
    const paymentState = memberPaymentRecordState(record);
    if (!record || paymentState === "unentered") return null;
    if (paymentState === "transfer_zero") {
      const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "양도일 미입력";
      return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>양도 · 0원</small></span>`;
    }
    const date = record.payment_recorded_on ? memberDetailDateLabel(record.payment_recorded_on) : "일자 미입력";
    const method = record.payment_method ? paymentMethodLabel(record.payment_method) : "수단 미입력";
    const amount = Number.isFinite(Number(record.payment_amount)) ? `${money.format(Number(record.payment_amount))}원` : "금액 미입력";
    const reviewLabel = paymentState === "incomplete" ? "확인 필요 · " : "";
    return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${reviewLabel}${method} · ${amount}`)}</small></span>`;
  }).filter(Boolean);
  if (paymentRows.length) return paymentRows.slice(0, 3).join("") + (paymentRows.length > 3 ? `<small>외 ${paymentRows.length - 3}건</small>` : "");
  const recentPayment = latestMemberPayment(member);
  if (!recentPayment) return '<span class="member-table-muted">미입력</span>';
  const date = memberDetailDateLabel(recentPayment.paidAt || recentPayment.verifiedAt || recentPayment.requestedAt);
  const amount = money.format(recentPayment.finalAmount || recentPayment.amount || 0);
  return `<span class="member-payment-summary-line"><strong>${escapeHtml(date)}</strong><small>${escapeHtml(`${paymentMethodLabel(recentPayment.method)} · ${amount}원`)}</small></span>`;
}

function memberManagementDatabaseFields({
  member,
  ticket,
  record,
  product,
  coachRoles,
  coachRoleId,
  partnerOptions,
  existingPayment = null,
  isCreate = false,
  isAssign = false,
  includeTicketStatus = false,
}) {
  const couponProduct = memberManagementProductIsCoupon(product);
  const productScheduleScope = memberManagementProductScheduleScope(product);
  const scheduleScope = (isAssign ? productScheduleScope : record?.lesson_schedule_scope || ticket?.scheduleScope) || productScheduleScope;
  const weeklyFrequency = couponProduct
    ? 1
    : Number((isAssign ? product?.frequency_per_week : record?.lesson_frequency_per_week || ticket?.weeklyCount) || product?.frequency_per_week || 1);
  const lessonType = (isAssign ? "" : record?.lesson_type || ticket?.lessonTypeCode) || (Number(product?.group_size || 1) === 2 ? "one_on_two" : "one_on_one");
  const lessonDays = isAssign ? [] : Array.isArray(record?.lesson_days) ? record.lesson_days : ticket?.lessonDays || [];
  const hasTicket = Boolean(ticket?.serverTicketId || isCreate || isAssign);
  const totalSessions = isAssign ? Number(product?.total_sessions || 1) : ticket?.total ?? record?.total_sessions ?? (isCreate ? Number(product?.total_sessions || 1) : null);
  const usedSessions = isAssign ? 0 : ticket?.used ?? record?.used_sessions ?? (isCreate ? 0 : null);
  const remainingSessions = isAssign ? Number(product?.total_sessions || 1) : ticket?.remaining ?? record?.remaining_sessions ?? (isCreate ? Number(product?.total_sessions || 1) : null);
  const startsOn = isAssign ? adminLocalDateKey(new Date()) : record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || (isCreate ? adminLocalDateKey(new Date()) : "");
  const validityDays = Math.max(1, Number(product?.validity_days || 1) + Number(product?.grace_days || 0));
  const expiresOn = ticket?.expires || (isCreate || isAssign ? addMemberManagementDays(startsOn, validityDays - 1) : "");
  const paymentProjection = isAssign
    ? existingPayment
      ? {
          payment: existingPayment,
          protected: existingPayment.status === "verified",
          payment_record_state: existingPayment.status === "verified" ? "complete" : "incomplete",
          payment_recorded_on: String(existingPayment.paid_at || existingPayment.verified_at || existingPayment.created_at || "").slice(0, 10),
          payment_method: existingPayment.method || existingPayment.provider || "",
          payment_amount: Number(existingPayment.final_amount ?? existingPayment.amount ?? 0),
        }
      : null
    : memberTicketPaymentProjection(member, ticket) || record;
  const existingPaymentDate = String(paymentProjection?.payment_recorded_on || "");
  const paymentDate = existingPaymentDate;
  const paymentMethod = paymentProjection?.payment_method || "";
  const paymentAmount = isAssign
    ? Number(existingPayment?.final_amount ?? existingPayment?.amount ?? product?.cash_price ?? product?.card_price ?? 0)
    : paymentProjection?.payment_amount ?? (isCreate ? 0 : "");
  const paymentRecordState = isAssign && existingPayment
    ? "complete"
    : paymentProjection
      ? memberPaymentRecordState(paymentProjection)
      : "unentered";
  const paymentProtected = Boolean(paymentProjection?.protected && !isAssign);
  const paymentControlState = paymentProtected ? "disabled aria-disabled=\"true\"" : "";
  const note = record ? record.admin_note || "" : member?.note || "";
  const partnerUserId = ticket && member ? memberTicketPartnerUserId(ticket, member) : "";
  const recordStatus = record?.record_status || (ticket?.status === "expired" ? "historical" : hasTicket ? "active" : "pending");
  const ticketStatus = ["active", "paused", "pending_payment", "expired"].includes(ticket?.status) ? ticket.status : "active";
  return `
    <input name="recordStatus" type="hidden" value="${escapeHtml(recordStatus)}" />
    ${isAssign && existingPayment ? `<input name="existingPaymentId" type="hidden" value="${escapeHtml(existingPayment.id)}" />
      <div class="member-management-warning"><strong>기존 결제 기록 연결</strong><span>${escapeHtml(paymentMethodLabel(existingPayment.method))} · ${money.format(Number(existingPayment.final_amount ?? existingPayment.amount ?? 0))}원 · 회원권 발급 후 같은 결제 기록에 연결됩니다.</span></div>` : ""}
    <div class="member-management-form-grid member-database-fields">
      <label class="form-field">${memberManagementFieldLabel("레슨강사", true)}<select name="coachRoleId" required>
        ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === coachRoleId ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("평일/주말", true)}<select name="scheduleScope" required>
        <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일</option>
        <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말</option>
        ${couponProduct ? "" : `<option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합</option>`}
      </select><small>${couponProduct ? "범위를 바꾸면 같은 조건의 활성 쿠폰 상품으로 안전하게 연결합니다." : "기존 예약은 별도 선택 없이 자동 변경하지 않습니다."}</small></label>
      ${couponProduct ? '<input name="weeklyFrequency" type="hidden" value="1" />' : `<label class="form-field">${memberManagementFieldLabel("주당 횟수", true)}<select name="weeklyFrequency" required>
        ${[1, 2, 3].map((frequency) => `<option value="${frequency}" ${frequency === weeklyFrequency ? "selected" : ""} ${scheduleScope === "weekend" && frequency === 3 ? "disabled" : ""}>주 ${frequency}회</option>`).join("")}
      </select></label>`}
      <label class="form-field">${memberManagementFieldLabel("레슨종류", true)}<select name="lessonType" required>
        <option value="one_on_one" ${lessonType === "one_on_one" ? "selected" : ""}>1:1</option>
        <option value="one_on_two" ${lessonType === "one_on_two" ? "selected" : ""}>1:2</option>
      </select></label>
      ${couponProduct ? '<input name="lessonDays" type="hidden" value="" />' : `<label class="form-field span-2 member-lesson-days-field">${memberManagementFieldLabel("레슨요일", true)}<span class="member-lesson-day-options" data-member-lesson-days>${memberManagementLessonDaysMarkup(lessonDays, scheduleScope)}</span><small>주간 회차 안에서 요일을 나누거나 같은 날 연속으로 사용할 수 있습니다.</small></label>`}
      <label class="form-field">${memberManagementFieldLabel("레슨시작일", hasTicket)}<input name="startsOn" type="date" value="${escapeHtml(startsOn)}" ${hasTicket ? "required" : ""} /></label>
      ${hasTicket ? `<label class="form-field">${memberManagementFieldLabel("회원권 만료일", true)}<input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" required /></label>` : ""}
      <label class="form-field">${memberManagementFieldLabel("총 회차", hasTicket)}<input name="totalSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(totalSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field">${memberManagementFieldLabel("소진 회차", hasTicket)}<input name="usedSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(usedSessions))}" ${hasTicket ? "required" : ""} /></label>
      <label class="form-field">${memberManagementFieldLabel("잔여 회차", hasTicket)}<input name="remainingSessions" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(remainingSessions))}" readonly aria-readonly="true" ${hasTicket ? "required" : ""} /><small>총 회차 - 소진 회차로 자동 계산</small></label>
      ${includeTicketStatus && ticket ? `<label class="form-field"><span>회원권 상태</span><select name="ticketStatus" required>
        <option value="active" ${ticketStatus === "active" ? "selected" : ""}>사용 중</option>
        <option value="paused" ${ticketStatus === "paused" ? "selected" : ""}>일시정지</option>
        ${ticketStatus === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
        <option value="expired" ${ticketStatus === "expired" ? "selected" : ""}>만료</option>
      </select></label>` : ""}
      ${paymentProtected ? '<div class="member-management-warning span-2"><strong>확인 완료 결제</strong><span>회원권 정보만 수정할 수 있습니다. 결제 변경·환불은 결제관리에서 진행하세요.</span></div>' : ""}
      <label class="form-field">${memberManagementFieldLabel("결제 구분")}<select name="paymentRecordState" ${paymentControlState}>${memberPaymentRecordStateOptions({
        payment_record_state: paymentRecordState,
        payment_recorded_on: paymentDate,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
      })}</select></label>
      <label class="form-field">${memberManagementFieldLabel("결제일자")}<input name="paymentDate" type="date" value="${escapeHtml(paymentDate)}" ${paymentControlState} /></label>
      <label class="form-field">${memberManagementFieldLabel("결제수단")}<select name="paymentMethod" ${paymentControlState}>
        <option value="" ${paymentMethod ? "" : "selected"}>미입력</option>
        <option value="card" ${paymentMethod === "card" ? "selected" : ""}>카드</option>
        <option value="bank" ${["bank", "bank_transfer", "transfer"].includes(paymentMethod) ? "selected" : ""}>계좌이체</option>
        <option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>현금</option>
        <option value="manual" ${paymentMethod === "manual" ? "selected" : ""}>관리자 입력</option>
        ${paymentMethod && !["card", "bank", "bank_transfer", "transfer", "cash", "manual"].includes(paymentMethod) ? `<option value="${escapeHtml(paymentMethod)}" selected>${escapeHtml(paymentMethodLabel(paymentMethod))}</option>` : ""}
      </select></label>
      <label class="form-field">${memberManagementFieldLabel("결제금액")}<input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(paymentAmount))}" ${paymentControlState} /></label>
      <label class="form-field span-2">${memberManagementFieldLabel("비고")}<textarea name="note" rows="3" maxlength="500">${escapeHtml(note)}</textarea></label>
      <div class="form-field span-2 member-partner-editor ${lessonType === "one_on_two" ? "" : "is-disabled"}" data-manual-member-partner-field>
        ${memberManagementFieldLabel("1:2 파트너", lessonType === "one_on_two")}
        ${isCreate ? `<div class="member-partner-mode" role="radiogroup" aria-label="파트너 등록 방법">
          <label><input name="partnerMode" type="radio" value="new" checked />새 파트너 같이 등록</label>
          <label><input name="partnerMode" type="radio" value="existing" />기존 회원 연결</label>
        </div>
        <div class="member-partner-new-fields" data-manual-new-partner>
          <label class="form-field">${memberManagementFieldLabel("파트너 실명", true)}<input name="partnerName" type="text" minlength="2" maxlength="40" autocomplete="off" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 휴대전화")}<input name="partnerPhone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 출생연도")}<input name="partnerBirthYear" type="number" min="1900" max="2100" step="1" /></label>
          <label class="form-field">${memberManagementFieldLabel("파트너 성별")}<select name="partnerGender"><option value="">미입력</option><option value="female">여성</option><option value="male">남성</option><option value="other">기타</option><option value="prefer_not">응답 안 함</option></select></label>
        </div>` : ""}
        <div class="member-partner-existing-fields" data-manual-existing-partner data-current-member-user-id="${escapeHtml(member?.serverUserId || "")}" ${isCreate ? "hidden" : ""}>
          <input name="partnerSearch" type="search" autocomplete="off" placeholder="이름 또는 전화번호 검색" data-manual-member-partner-search />
          <div class="member-partner-search-results" data-manual-member-partner-results aria-live="polite"></div>
          <select name="partnerUserId" ${lessonType === "one_on_two" && !isCreate ? "required" : "disabled"}>
            <option value="">파트너 선택</option>
            ${partnerOptions.filter((user) => user.id !== member?.serverUserId).map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "회원")}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>`;
}

function filterManualMemberPartnerOptions(form) {
  if (!form?.elements?.partnerUserId) return;
  const select = form.elements.partnerUserId;
  const currentValue = select.value;
  const keyword = String(form.elements.partnerSearch?.value || "").trim().toLowerCase();
  const currentMemberUserId = form.querySelector("[data-manual-existing-partner]")?.dataset.currentMemberUserId || "";
  const options = manualMemberPartnerOptions().filter((user) => user.id !== currentMemberUserId && (
    !keyword
    || [user.name, user.nickname, user.phone].some((value) => String(value || "").toLowerCase().includes(keyword))
  ));
  select.innerHTML = [
    `<option value="">${keyword && !options.length ? "검색 결과 없음" : "파트너 선택"}</option>`,
    ...options.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || "회원")}${user.phone ? ` · ${escapeHtml(maskMemberPhone(user.phone))}` : ""}</option>`),
  ].join("");
  if (options.some((user) => String(user.id) === String(currentValue))) select.value = currentValue;
  const results = form.querySelector("[data-manual-member-partner-results]");
  if (results) {
    const visible = keyword ? options.slice(0, 8) : [];
    results.innerHTML = keyword
      ? visible.length
        ? visible.map((user) => `<button type="button" class="member-partner-result-button ${String(user.id) === String(select.value) ? "is-selected" : ""}" data-select-manual-member-partner="${escapeHtml(user.id)}"><strong>${escapeHtml(user.name || "회원")}</strong><span>${escapeHtml(maskMemberPhone(user.phone))}</span></button>`).join("")
        : '<p class="member-partner-no-result">검색 결과가 없습니다.</p>'
      : "";
    results.hidden = !keyword;
  }
}

function memberUsageOverviewMarkup(member) {
  const memberTickets = memberOperationalTickets(member);
  if (!memberTickets.length) return '<span class="member-table-muted">-</span>';
  return memberTickets.slice(0, 3).map((ticket) => `
    <span class="member-ticket-summary-line">
      <strong>${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")}</strong>
      <small>${escapeHtml(ticketUsageLabel(ticket))}</small>
    </span>`).join("")
    + (memberTickets.length > 3 ? `<small>외 ${memberTickets.length - 3}건</small>` : "");
}

function memberQuickEditorMarkup(member, ticket, options = {}) {
  if (!memberAdminEditEnabled || operationsRole() !== "admin") return "";
  const embedded = options.embedded === true;
  const ticketPosition = Number(options.ticketPosition || 0);
  const ticketCount = Number(options.ticketCount || 0);
  const record = memberDatabaseRecord(member, ticket);
  const paymentProjection = memberTicketPaymentProjection(member, ticket) || record;
  const paymentProtected = Boolean(paymentProjection?.protected);
  const paymentControlState = paymentProtected ? 'disabled aria-disabled="true"' : "";
  const coachRoles = memberManagementCoachRoles(ticket || {});
  const partnerUserId = ticket ? memberTicketPartnerUserId(ticket, member) : "";
  const partnerOptions = manualMemberPartnerOptions()
    .filter((user) => user.id !== member.serverUserId)
    .map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === partnerUserId ? "selected" : ""}>${escapeHtml(user.name || "회원")}</option>`)
    .join("");
  const total = Number(ticket?.total ?? record?.total_sessions ?? 0);
  const used = Number(ticket?.used ?? record?.used_sessions ?? 0);
  const remaining = Math.max(0, total - used);
  const startsOn = memberManagementDate(record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased)
    || adminLocalDateKey(new Date());
  const expiresOn = memberManagementDate(ticket?.expires);
  const paymentRecordState = memberPaymentRecordState(paymentProjection);
  const currentProduct = (adminLiveDataState.products || []).find((item) => item.id === ticket?.productId);
  const activeProductOptions = membershipProductsForActiveOperationProfile()
    .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
    .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled")
    .map(({ draft, server }) => `<option value="${escapeHtml(server.id)}" data-group-size="${Number(server.group_size || 1)}" data-product-kind="${escapeHtml(server.product_kind || "regular")}" data-frequency="${Number(server.frequency_per_week || 1)}" data-scope="${escapeHtml(memberManagementProductScheduleScope(server))}" data-duration="${Number(server.lesson_minutes || 20)}" ${server.id === ticket?.productId ? "selected" : ""}>${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`)
    .join("");
  const currentProductIncluded = Boolean(ticket?.productId)
    && activeProductOptions.includes(`value="${escapeHtml(ticket.productId)}"`);
  const currentProductOption = currentProduct && !currentProductIncluded
    ? `<option value="${escapeHtml(currentProduct.id)}" data-group-size="${Number(currentProduct.group_size || ticket?.groupSize || 1)}" data-product-kind="${escapeHtml(currentProduct.product_kind || ticket?.productKind || "regular")}" data-frequency="${Number(currentProduct.frequency_per_week || ticket?.weeklyCount || 1)}" data-scope="${escapeHtml(memberManagementProductScheduleScope(currentProduct))}" data-duration="${Number(currentProduct.lesson_minutes || ticket?.durationMinutes || 20)}" selected>현재 · ${escapeHtml(getTicketDisplayProduct(ticket) || currentProduct.name || "기존 회원권")}</option>`
    : "";
  const productOptions = currentProductOption + activeProductOptions;
  const isGroup = Number(currentProduct?.group_size || record?.lesson_group_size || ticket?.groupSize || 1) === 2;
  const ticketOwnershipLabel = ticket && ticketCount > 1 ? memberTicketOwnershipLabel(ticket, member) : "";
  const managedTickets = memberOperationalTickets(member);
  const possibleDuplicate = Boolean(ticket?.serverTicketId)
    && memberPossibleDuplicateTicketIds(managedTickets).has(String(ticket.serverTicketId));
  const renewalOverlap = Boolean(ticket?.serverTicketId)
    && memberRenewalOverlapTicketIds(managedTickets).has(String(ticket.serverTicketId));
  const ticketContextLabel = [
    ticket ? memberTicketLifecyclePositionLabel(member, ticket) : "새 회원권",
    ticketOwnershipLabel,
    renewalOverlap ? "연장 겹침 · 확인 필요" : possibleDuplicate ? "중복 가능" : "",
  ].filter(Boolean).join(" · ");
  const initialSchedule = memberRegularScheduleSlots(member, ticket)
    .slice(0, memberRegularScheduleFrequency(currentProduct, ticket))
    .map((slot) => ({ dayOfWeek: Number(slot.dayOfWeek), startTime: String(slot.startTime || "").slice(0, 5) }));
  const memberProfileFields = embedded && ticket
    ? `<input name="memberName" type="hidden" value="${escapeHtml(member.name || "")}" />
       <input name="memberPhone" type="hidden" value="${escapeHtml(member.phone || "")}" />
       <input name="memberBirthYear" type="hidden" value="${escapeHtml(memberManagementValue(member.birthYear))}" />
       <input name="memberNeighborhood" type="hidden" value="${escapeHtml(member.neighborhood || "")}" />
       <input name="memberGender" type="hidden" value="${escapeHtml(member.gender || "")}" />`
    : `<label><span>이름</span><input name="memberName" value="${escapeHtml(member.name || "")}" required /></label>
       <label><span>연락처 · 필수</span><input name="memberPhone" inputmode="tel" value="${escapeHtml(member.phone || "")}" required /></label>
       <label><span>출생연도 · 필수</span><input name="memberBirthYear" type="number" min="1900" max="2100" value="${escapeHtml(memberManagementValue(member.birthYear))}" required /></label>
       <label><span>거주동 · 필수</span><input name="memberNeighborhood" value="${escapeHtml(member.neighborhood || "")}" required /></label>
       <label><span>성별</span><select name="memberGender">
         <option value="" ${member.gender ? "" : "selected"}>미입력</option>
         <option value="female" ${member.gender === "female" ? "selected" : ""}>여성</option>
         <option value="male" ${member.gender === "male" ? "selected" : ""}>남성</option>
         <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
         <option value="prefer_not" ${member.gender === "prefer_not" ? "selected" : ""}>응답 안 함</option>
       </select></label>`;
  return `
        <form class="member-inline-editor member-inline-editor--compact ${embedded && ticket ? "member-inline-editor--ticket-only" : ""}" data-member-inline-form="${member.id}" data-ticket-id="${escapeHtml(ticket?.serverTicketId || "")}" data-initial-product-id="${escapeHtml(ticket?.productId || "")}" data-initial-schedule-scope="${escapeHtml(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct))}" data-initial-coach-role-id="${escapeHtml(record?.coach_role_id || ticket?.coachRoleId || "")}" data-initial-schedule="${escapeHtml(encodeURIComponent(JSON.stringify(initialSchedule)))}" data-initial-payment="${escapeHtml(memberPaymentInitialSnapshot(paymentProjection))}">
          <div class="member-inline-editor-heading" ${embedded ? "hidden" : ""}>
            <div><strong>${escapeHtml(member.name)} 빠른 편집</strong><span>저장하면 서버와 시간표에 바로 반영됩니다.</span></div>
            <button class="icon-button" type="button" data-close-member-inline aria-label="빠른 수정 닫기" title="닫기">×</button>
          </div>
          ${embedded ? `<div class="member-inline-ticket-context ${possibleDuplicate ? "is-possible-duplicate" : ""}">
            <strong>${escapeHtml(ticketContextLabel)}</strong>
            <span>${escapeHtml(ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "회원권 미등록")}${ticket ? ` · ${escapeHtml(memberTicketStatusLabel(ticket))}` : ""}</span>
          </div>` : ""}
          <input name="lessonType" type="hidden" value="${escapeHtml(record?.lesson_type || ticket?.lessonTypeCode || "one_on_one")}" />
          <input name="weeklyFrequency" type="hidden" value="${memberManagementProductWeeklyFrequency(currentProduct, record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? 1)}" />
          <input name="recordStatus" type="hidden" value="${escapeHtml(record?.record_status || (ticket ? "active" : "pending"))}" />
          <input name="expectedTicketUpdatedAt" type="hidden" value="${escapeHtml(ticket?.serverUpdatedAt || "")}" />
          ${embedded && ticket ? `<p class="member-inline-profile-hint"><strong>${escapeHtml(member.name)}</strong><span>회원 기본정보는 이름을 눌러 수정합니다. 아래에서는 선택한 회원권만 바뀝니다.</span></p>` : ""}
          <div class="member-inline-compact-grid">
            ${memberProfileFields}
            <label class="member-inline-product"><span>회원권</span>
              <span class="member-inline-product-search" data-member-product-search-shell>
                <input name="productSearch" type="search" autocomplete="off" placeholder="회원권 검색 · 30분, 평일 2회, 그룹, 쿠폰" data-member-product-search role="combobox" aria-autocomplete="list" aria-expanded="false" />
                <button type="button" data-clear-member-product-search aria-label="회원권 검색어 지우기">지우기</button>
                <span class="member-inline-product-results" data-member-product-results role="listbox" aria-live="polite" hidden></span>
              </span>
              <span class="member-inline-duration-shortcuts" role="group" aria-label="수업시간 빠른 변경">
                <span>빠른 변경</span>
                <button type="button" data-member-product-duration="20" aria-pressed="${Number(currentProduct?.lesson_minutes || ticket?.durationMinutes || 0) === 20 ? "true" : "false"}">20분</button>
                <button type="button" data-member-product-duration="30" aria-pressed="${Number(currentProduct?.lesson_minutes || ticket?.durationMinutes || 0) === 30 ? "true" : "false"}">30분</button>
              </span>
              <select name="productId">
              <option value="">${ticket ? "회원권 취소·만료" : "미등록"}</option>${productOptions}
              </select>
              <span class="member-inline-product-change-note" data-member-product-change-note hidden></span>
            </label>
            <label class="member-inline-scope"><span>평일/주말</span><select name="scheduleScope" required>
              <option value="weekday" ${(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct)) === "weekday" ? "selected" : ""}>평일</option>
              <option value="weekend" ${(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct)) === "weekend" ? "selected" : ""}>주말</option>
              ${memberManagementProductIsCoupon(currentProduct) ? "" : `<option value="mixed" ${(record?.lesson_schedule_scope || ticket?.scheduleScope || memberManagementProductScheduleScope(currentProduct)) === "mixed" ? "selected" : ""}>혼합</option>`}
            </select><small>쿠폰도 같은 조건의 상품으로 변경</small></label>
            <label class="member-inline-coach"><span>담당 코치</span><select name="coachRoleId">
              <option value="">미배정</option>
              ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === (record?.coach_role_id || ticket?.coachRoleId) ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
            </select></label>
            <label class="member-inline-partner" data-member-quick-partner data-manual-member-partner-field><span>파트너</span><span class="member-inline-partner-empty" data-member-quick-partner-empty ${isGroup ? "hidden" : ""}>1:1 · 해당 없음</span><span class="member-inline-partner-search" data-manual-existing-partner data-current-member-user-id="${escapeHtml(member.serverUserId || "")}" ${isGroup ? "" : "hidden"}>
              <input name="partnerSearch" type="search" autocomplete="off" placeholder="이름 검색" data-manual-member-partner-search ${isGroup ? "" : "disabled"} />
              <span class="member-partner-search-results" data-manual-member-partner-results aria-live="polite" hidden></span>
              <select name="partnerUserId" ${isGroup ? "required" : "disabled"}>
                <option value="">파트너 선택</option>${partnerOptions}
              </select>
            </span></label>
            <label class="member-inline-start-date"><span>시작일</span><input name="startsOn" type="date" value="${escapeHtml(startsOn)}" /></label>
            <label class="member-inline-end-date"><span>만료일</span><input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" /></label>
            <label class="member-inline-count"><span>총</span><input name="totalSessions" type="number" min="0" step="1" value="${total}" ${ticket ? "" : "disabled"} /></label>
            <label class="member-inline-count"><span>소진</span><input name="usedSessions" type="number" min="0" step="1" value="${used}" ${ticket ? "" : "disabled"} /></label>
            <label class="member-inline-count"><span>잔여</span><input name="remainingSessions" type="number" min="0" step="1" value="${remaining}" readonly aria-readonly="true" /></label>
            ${ticket ? `<label class="member-inline-status"><span>회원권 상태</span><select name="ticketStatus">
              <option value="active" ${ticket.status === "active" ? "selected" : ""}>사용 중</option>
              <option value="paused" ${ticket.status === "paused" ? "selected" : ""}>일시정지</option>
              ${ticket.status === "pending_payment" ? '<option value="pending_payment" selected>결제 대기 유지</option>' : ""}
              <option value="expired" ${ticket.status === "expired" ? "selected" : ""}>만료</option>
            </select></label>` : ""}
            ${paymentProtected ? '<div class="member-management-warning member-inline-payment-protected"><strong>확인 결제 보존</strong><span>결제 변경·환불은 결제관리에서 진행하세요.</span></div>' : ""}
            <label class="member-inline-payment-state"><span>결제 구분</span><select name="paymentRecordState" ${paymentControlState}>${memberPaymentRecordStateOptions({
              payment_record_state: paymentRecordState,
              payment_recorded_on: paymentProjection?.payment_recorded_on,
              payment_method: paymentProjection?.payment_method,
              payment_amount: paymentProjection?.payment_amount,
            })}</select></label>
            <label class="member-inline-payment-date"><span>결제일</span><input name="paymentDate" type="date" value="${escapeHtml(paymentProjection?.payment_recorded_on || "")}" ${paymentControlState} /></label>
            <label class="member-inline-payment-method"><span>결제수단</span><select name="paymentMethod" ${paymentControlState}>
              <option value="">미입력</option>
              <option value="card" ${paymentProjection?.payment_method === "card" ? "selected" : ""}>카드</option>
              <option value="bank_transfer" ${["bank", "bank_transfer", "transfer"].includes(paymentProjection?.payment_method) ? "selected" : ""}>계좌이체</option>
              <option value="cash" ${paymentProjection?.payment_method === "cash" ? "selected" : ""}>현금</option>
              ${paymentProjection?.payment_method && !["card", "bank", "bank_transfer", "transfer", "cash"].includes(paymentProjection.payment_method) ? `<option value="${escapeHtml(paymentProjection.payment_method)}" selected>${escapeHtml(paymentMethodLabel(paymentProjection.payment_method))}</option>` : ""}
            </select></label>
            <label class="member-inline-payment-amount"><span>결제금액</span><input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(paymentProjection?.payment_amount ?? ""))}" ${paymentControlState} /></label>
            <label class="member-inline-note"><span>비고</span><input name="note" value="${escapeHtml(record?.admin_note || member.note || "")}" /></label>
            <div class="member-inline-compact-actions">
              <label class="member-inline-schedule-scope"><span>시간표 반영</span><select name="applyToFutureSchedule">
                <option value="false">회원권만 저장 · 기존 시간표 유지</option>
                <option value="true">미래 정규시간 다시 만들기</option>
              </select></label>
              <button class="primary-button member-inline-save" type="submit">${ticket ? "이 회원권 저장" : "새 회원권 등록"}</button>
              ${embedded ? '<button class="ghost-button member-inline-cancel" type="button" data-close-member-inline>취소</button>' : ""}
              ${operationsRole() === "admin" && ticket && ticket.status !== "voided"
                ? `<button class="danger-button member-inline-force-delete" type="button" data-open-member-management="force_delete" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(ticketContextLabel)} 삭제">이 회원권 삭제</button>`
                : ""}
              ${memberListStatus(member) === "inactive" && member.authRole !== "admin" && member.serverUserId
                ? `<button class="danger-button member-row-permanent-delete" type="button" data-open-member-management="permanent_delete" data-member-management-member-id="${member.id}">영구 삭제</button>`
                : ""}
            </div>
          </div>
          ${ticket ? memberInlineScheduleMarkup(member, ticket, currentProduct) : ""}
          <div class="member-inline-editor-actions">
            <p class="member-inline-message" aria-live="polite"></p>
          </div>
        </form>`;
}

function memberInlineEditorMarkup(member, ticket) {
  if (operationsRole() !== "admin") return "";
  const record = memberDatabaseRecord(member, ticket);
  const paymentProjection = memberTicketPaymentProjection(member, ticket) || record;
  const paymentProtected = Boolean(paymentProjection?.protected);
  const paymentControlState = paymentProtected ? 'disabled aria-disabled="true"' : "";
  const coachRoles = memberManagementCoachRoles(ticket || {});
  const startsOn = memberManagementDate(record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased);
  const expiresOn = memberManagementDate(ticket?.expires);
  const total = Number(ticket?.total ?? record?.total_sessions ?? 0);
  const used = Number(ticket?.used ?? record?.used_sessions ?? 0);
  const remaining = Math.max(0, total - used);
  const paymentMethod = paymentProjection?.payment_method || "";
  const paymentDate = paymentProjection?.payment_recorded_on || "";
  const paymentAmount = paymentProjection?.payment_amount ?? "";
  const scheduleScope = record?.lesson_schedule_scope || ticket?.scheduleScope || "";
  const lessonType = record?.lesson_type || ticket?.lessonTypeCode || "one_on_one";
  const weeklyFrequency = Number(record?.lesson_frequency_per_week ?? ticket?.weeklyCount ?? 1);
  const required = "";
  return `
    <tr class="member-inline-editor-row" data-inline-editor-member="${member.id}">
      <td colspan="9">
        <form class="member-inline-editor" data-member-inline-form="${member.id}" data-ticket-id="${escapeHtml(ticket?.serverTicketId || "")}" data-initial-payment="${escapeHtml(memberPaymentInitialSnapshot(paymentProjection))}">
          <div class="member-inline-editor-heading">
            <div><strong>${escapeHtml(member.name)} 행 편집</strong><span>${escapeHtml(ticket ? getTicketDisplayProduct(ticket) || ticket.product || "회원권" : "기본정보만 저장")}</span></div>
            <button class="icon-button" type="button" data-close-member-inline aria-label="빠른 수정 닫기" title="닫기">×</button>
          </div>
          <div class="member-inline-editor-grid member-inline-editor-grid--profile">
            <label><span>이름</span><input name="memberName" value="${escapeHtml(member.name || "")}" required /></label>
            <label><span>연락처 · 필수</span><input name="memberPhone" inputmode="tel" value="${escapeHtml(member.phone || "")}" required /></label>
            <label><span>출생연도 · 필수</span><input name="memberBirthYear" type="number" min="1900" max="2100" value="${escapeHtml(memberManagementValue(member.birthYear))}" required /></label>
            <label><span>거주동 · 필수</span><input name="memberNeighborhood" value="${escapeHtml(member.neighborhood || "")}" required /></label>
            <label><span>성별</span><select name="memberGender">
              <option value="">미입력</option>
              <option value="female" ${member.gender === "female" ? "selected" : ""}>여</option>
              <option value="male" ${member.gender === "male" ? "selected" : ""}>남</option>
              <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
            </select></label>
            <label><span>담당 코치</span><select name="coachRoleId" ${required}>
              <option value="">미배정</option>
              ${coachRoles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === (record?.coach_role_id || ticket?.coachRoleId) ? "selected" : ""}>${escapeHtml(role.display_name || "코치")}</option>`).join("")}
            </select></label>
            <label><span>레슨 방식</span><select name="scheduleScope" ${ticket ? "" : "disabled"}>
              <option value="">미입력</option>
              <option value="weekday" ${scheduleScope === "weekday" ? "selected" : ""}>평일</option>
              <option value="weekend" ${scheduleScope === "weekend" ? "selected" : ""}>주말</option>
              <option value="mixed" ${scheduleScope === "mixed" ? "selected" : ""}>혼합</option>
            </select></label>
            <label><span>레슨 종류</span><select name="lessonType" ${ticket ? "" : "disabled"}>
              <option value="one_on_one" ${lessonType !== "one_on_two" ? "selected" : ""}>개인 1:1</option>
              <option value="one_on_two" ${lessonType === "one_on_two" ? "selected" : ""}>그룹 1:2</option>
            </select></label>
            <label><span>주 횟수</span><input name="weeklyFrequency" type="number" min="1" max="7" value="${weeklyFrequency}" ${ticket ? "" : "disabled"} /></label>
          </div>
          ${ticket ? `${paymentProtected ? '<div class="member-management-warning"><strong>확인 결제 보존</strong><span>회원권 정보만 수정할 수 있습니다. 결제 변경·환불은 결제관리에서 진행하세요.</span></div>' : ""}<div class="member-inline-editor-grid member-inline-editor-grid--ticket">
            <label><span>시작일</span><input name="startsOn" type="date" value="${escapeHtml(startsOn)}" required /></label>
            <label><span>만료일</span><input name="expiresOn" type="date" value="${escapeHtml(expiresOn)}" required /></label>
            <label><span>총</span><input name="totalSessions" type="number" min="0" step="1" value="${total}" required /></label>
            <label><span>소진</span><input name="usedSessions" type="number" min="0" step="1" value="${used}" required /></label>
            <label><span>잔여</span><input name="remainingSessions" type="number" min="0" step="1" value="${remaining}" readonly aria-readonly="true" /></label>
            <label><span>결제수단</span><select name="paymentMethod" ${required} ${paymentControlState}>
              <option value="">미입력</option>
              <option value="card" ${paymentMethod === "card" ? "selected" : ""}>카드</option>
              <option value="bank_transfer" ${["bank", "bank_transfer", "transfer"].includes(paymentMethod) ? "selected" : ""}>계좌이체</option>
              <option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>현금</option>
              <option value="manual" ${paymentMethod === "manual" ? "selected" : ""}>관리자 입력</option>
            </select></label>
            <label><span>결제일</span><input name="paymentDate" type="date" value="${escapeHtml(paymentDate)}" ${required} ${paymentControlState} /></label>
            <label><span>금액</span><input name="paymentAmount" type="number" min="0" step="1" value="${escapeHtml(memberManagementValue(paymentAmount))}" ${paymentControlState} /></label>
            <label class="member-inline-note"><span>비고</span><input name="note" value="${escapeHtml(record?.admin_note || member.note || "")}" /></label>
          </div>` : ""}
          <div class="member-inline-editor-actions">
            ${ticket ? "" : '<span>회원권은 저장 후 ‘회원권 등록’에서 연결합니다.</span>'}
            ${ticket ? "" : `<button class="ghost-button" type="button" data-inline-member-management="${member.id}" data-inline-member-ticket="">회원권 등록</button>`}
            ${operationsRole() === "admin" && ticket && ticket.status !== "voided"
              ? `<button class="danger-button member-inline-force-delete" type="button" data-open-member-management="force_delete" data-member-management-member-id="${member.id}" data-member-management-ticket="${escapeHtml(ticket.serverTicketId)}" aria-label="${escapeHtml(member.name)} ${escapeHtml(getTicketDisplayProduct(ticket) || ticket.product || "회원권")} 강제 삭제">강제 삭제</button>`
              : ""}
            <button class="primary-button member-inline-save" type="submit">저장</button>
          </div>
          <p class="member-inline-message" aria-live="polite">행의 변경값을 서버에 저장합니다. 기존 시간표는 유지됩니다.</p>
        </form>
      </td>
    </tr>`;
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => {
    const memberUserId = option.memberUserId
      ? ` data-member-user-id="${escapeHtml(String(option.memberUserId))}"`
      : "";
    return `<option value="${option.value}"${memberUserId}>${option.label}</option>`;
  }).join("");
}

function paymentCancelButtonFor(index, label = "결제취소") {
  const item = billings[index] || {};
  const context = `${item.member || "회원"} · ${item.item || "결제"} · ${label}`;
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-cancel-payment="${index}" aria-label="${escapeHtml(context)}" title="${escapeHtml(context)}">${label}</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentFullCancelButtonFor(item, index) {
  const amount = paymentFullCancelAmount(item);
  if (isManualCashRefundItem(item)) return "";
  const context = `${item?.member || "회원"} · ${item?.item || "결제"} · PG 전액 결제취소 ${money.format(amount)}원`;
  if (!item?.providerPaymentId || amount <= 0) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="서버 결제번호와 결제금액이 필요합니다.">PG 전액 결제취소</button>`;
  }
  if (paymentCancelInFlight.has(item.providerPaymentId)) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}">취소 처리 중</button>`;
  }
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-cancel-payment="${index}" aria-label="${escapeHtml(context)}" title="테스트·오결제·당일 미사용 결제를 PG에서 전액 취소합니다.">PG 전액 결제취소</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentRefundButtonFor(item, index) {
  const context = `${item?.member || "회원"} · ${item?.item || "결제"} · 환불 계산`;
  if (!item?.providerPaymentId) {
    return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="서버 결제번호가 필요합니다.">환불 계산</button>`;
  }
  if (adminPaymentCancelReady()) {
    return `<button class="small-button danger-action" type="button" data-refund-payment="${index}" aria-label="${escapeHtml(context)}" title="${escapeHtml(context)}">환불 계산</button>`;
  }
  return `<button class="small-button danger-action" type="button" disabled aria-label="${escapeHtml(context)}" title="${escapeHtml(adminPaymentCancelBlockedMessage())}">관리자 로그인 필요</button>`;
}

function paymentActionFor(item, index) {
  const context = (label) => `aria-label="${escapeHtml(`${item.member || "회원"} · ${item.item || "결제"} · ${label}`)}" title="${escapeHtml(`${item.member || "회원"} · ${item.item || "결제"} · ${label}`)}"`;
  if (item.status === "check") return item.providerPaymentId
    ? `<button class="small-button" type="button" data-review-payment="${index}" ${context("서버 확인")}>서버 확인</button>${paymentCancelButtonFor(index, "대기취소")}`
    : '<button class="small-button" type="button" disabled>서버 결제번호 없음</button>';
  if (item.status === "unverified") return `<button class="small-button" type="button" data-review-payment="${index}" ${context("서버 연결 확인")}>서버 연결 확인</button>${paymentCancelButtonFor(index, "대기취소")}`;
  if (item.status === "failed") return `<button class="small-button" type="button" data-failed-payment="${index}" ${context("실패 확인")}>실패 확인</button>${paymentCancelButtonFor(index, "대기취소")}`;
  if (item.status === "draft") return '<button class="small-button" type="button" disabled>회원 결제 대기</button>';
  if (item.status === "server_ready") {
    const label = String(item.method || "") === "bank_transfer"
      ? "입금 확인"
      : isStaleReadyPayment(item) ? "상태 확인" : "결제 확인";
    return `<button class="small-button" type="button" data-server-ready-payment="${index}" ${context(label)}>${label}</button>${paymentCancelButtonFor(index, "대기취소")}`;
  }
  if (item.status === "paid") return `<button class="small-button" type="button" data-paid-payment="${index}" ${context("결제 완료 상세")}>완료됨</button>${paymentFullCancelButtonFor(item, index)}${paymentRefundButtonFor(item, index)}`;
  if (item.status === "refund_manual_pending") return `<button class="small-button danger-action" type="button" data-refund-payment="${index}" ${context("실제 송금 후 환불 완료 확인")}>송금완료 확인</button>`;
  if (item.status === "refund_processing") return `<button class="small-button" type="button" disabled>환불처리중</button>`;
  if (item.status === "cancel_reconcile") return paymentCancelButtonFor(index, "취소 상태 맞추기");
  if (item.status === "refund_reconcile") return `<button class="small-button danger-action" type="button" data-refund-payment="${index}" ${context("환불 동기화 확인")}>동기화 확인</button>`;
  if (item.status === "cancelled") return `<button class="small-button" type="button" disabled>취소완료</button>`;
  if (item.status === "refunded") return `<button class="small-button" type="button" disabled>환불완료</button>`;
  return "";
}

function branchSalesPreviewMarkup() {
  const config = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  const methods = Object.entries(config.paymentMethods)
    .filter(([id, method]) => id !== "onsite_cash" && method.enabled === true)
    .sort((left, right) => Number(left[1].displayOrder) - Number(right[1].displayOrder));
  const products = membershipProductsForActiveOperationProfile()
    .map((product) => normalizeMembershipProduct(product, membershipProductDefaults.find((item) => item.id === product.id)))
    .filter((product) => product.status === "sale")
    .filter((product) => config.features.oneDay || product.purchaseExperience !== "one_day")
    .filter((product) => config.features.threeMonth || Number(product.termWeeks) < 12)
    .slice(0, 3);
  const benefit = Object.values(config.benefits).find((item) => item.enabled === true);
  return `
    <div class="branch-sales-phone" aria-label="회원앱 390픽셀 미리보기">
      <div class="branch-sales-phone-head"><small>회원권</small><strong>${escapeHtml(activeOperationBranchName())}</strong></div>
      <div class="branch-sales-phone-body">
        <strong>${products[0] ? "원하는 수업을 선택하세요" : "판매 상품을 준비 중입니다"}</strong>
        ${products.map((product, index) => `<button type="button" tabindex="-1" class="branch-sales-preview-product ${index === 0 ? "is-selected" : ""}"><span>${escapeHtml(product.title)}</span><b>${money.format(Number(product.cashAmount || product.cardAmount || 0))}원~</b></button>`).join("")}
        ${benefit ? `<span class="branch-sales-preview-benefit">${escapeHtml(benefit.title)} · ${Number(benefit.discountValue || 0)}% 자동 확인</span>` : ""}
        <div class="branch-sales-preview-methods">${methods.map(([, method], index) => `<span class="${index === 0 ? "is-selected" : ""}">${escapeHtml(method.title)}</span>`).join("") || "<span>결제수단 준비 중</span>"}</div>
        <button type="button" tabindex="-1" class="branch-sales-preview-pay">결제하기</button>
      </div>
    </div>`;
}

function branchSalesPaymentMethodMarkup(id, method) {
  const labels = {
    tosspay: "승인된 토스 간편결제",
    bank_transfer: "입금 확인 후 회원권 생성",
    card: "일반 카드 PG 승인 후 사용",
    kakaopay: "카카오페이 승인 후 사용",
    naverpay: "네이버페이 승인 후 사용",
  };
  return `
    <article class="branch-sales-method-card">
      <label class="branch-sales-toggle"><input type="checkbox" data-sales-payment-method="${id}" data-sales-field="enabled" ${method.enabled ? "checked" : ""} /><span>${escapeHtml(method.title)}</span></label>
      <small>${labels[id]} · ${method.priceBasis === "cash" ? "현금가" : "카드가"}</small>
      <div class="branch-sales-inline-fields">
        <label><span>앱 표기</span><input type="text" maxlength="30" value="${escapeHtml(method.title)}" data-sales-payment-method="${id}" data-sales-field="title" /></label>
        <label><span>순서</span><input type="number" min="1" max="999" value="${Number(method.displayOrder || 10)}" data-sales-payment-method="${id}" data-sales-field="displayOrder" /></label>
        <label class="branch-sales-check"><input type="checkbox" data-sales-payment-method="${id}" data-sales-field="couponAllowed" ${method.couponAllowed !== false ? "checked" : ""} /> 쿠폰 허용</label>
      </div>
    </article>`;
}

function branchSalesBenefitMarkup(id, benefit) {
  const descriptions = {
    newMember: "처음 등록하는 회원",
    returningMember: `${Number(benefit.inactiveDays || 90)}일 이상 쉬고 돌아온 회원`,
    referral: "추천 관계가 확인된 두 회원",
  };
  return `
    <article class="branch-sales-benefit-card">
      <label class="branch-sales-toggle"><input type="checkbox" data-sales-benefit="${id}" data-sales-field="enabled" ${benefit.enabled ? "checked" : ""} /><span>${escapeHtml(benefit.title)}</span></label>
      <small>${descriptions[id]}</small>
      <div class="branch-sales-inline-fields">
        <label><span>쿠폰 이름</span><input type="text" maxlength="40" value="${escapeHtml(benefit.title)}" data-sales-benefit="${id}" data-sales-field="title" /></label>
        <label><span>할인율</span><input type="number" min="1" max="100" value="${Number(benefit.discountValue || 5)}" data-sales-benefit="${id}" data-sales-field="discountValue" /></label>
        <label><span>사용기한</span><input type="number" min="1" max="365" value="${Number(benefit.expiresDays || 30)}" data-sales-benefit="${id}" data-sales-field="expiresDays" /></label>
        ${id === "returningMember" ? `<label><span>미이용 일수</span><input type="number" min="30" max="730" value="${Number(benefit.inactiveDays || 90)}" data-sales-benefit="${id}" data-sales-field="inactiveDays" /></label>` : ""}
      </div>
    </article>`;
}

function bankNotificationStatusMarkup() {
  if (bankNotificationStatusState.status === "loading") {
    return '<p class="empty-text">입금 알림 기기 상태를 확인하는 중입니다.</p>';
  }
  if (bankNotificationStatusState.status === "failed") {
    return `<p class="branch-sales-error">알림 상태를 불러오지 못했습니다. (${escapeHtml(bankNotificationStatusState.message)})</p>`;
  }
  const devices = bankNotificationStatusState.devices || [];
  const reviewEvents = bankNotificationStatusState.reviewEvents || [];
  const history = bankNotificationStatusState.accountHistory || [];
  const currentRevision = Number(branchPaymentAccount?.revision || 0);
  const deviceMarkup = devices.length
    ? devices.slice(0, 4).map((device) => {
        const online = device.status === "active"
          && Date.now() - Date.parse(device.lastHeartbeatAt || "") < 15 * 60 * 1000;
        const revisionMatches = Number(device.accountRevision || 0) === currentRevision;
        return `<li><span><strong>${escapeHtml(device.deviceName || "관리자 Android")}</strong><small>마지막 연결 ${escapeHtml(bankNotificationDateTime(device.lastHeartbeatAt))}</small></span><span class="bank-device-actions">${badge(online && revisionMatches ? "ready" : "pending", !revisionMatches ? "다시 연결 필요" : online ? "연결됨" : "연결 확인")}${device.status === "active" ? `<button class="ghost-button" type="button" data-revoke-bank-device="${escapeHtml(device.id || "")}">연결 해제</button>` : ""}</span></li>`;
      }).join("")
    : '<li class="empty-text">연결된 Android 관리기기가 없습니다. 관리자 계정으로 앱에서 연결해 주세요.</li>';
  const reviewMarkup = reviewEvents.length
    ? reviewEvents.slice(0, 5).map((event) => `<li><span><strong>${money.format(Number(event.amount || 0))}원 · ${escapeHtml(event.depositorHint || "입금자 미확인")}</strong><small>${escapeHtml(bankNotificationDateTime(event.receivedAt))}</small></span>${badge("pending", ({ partial: "일부 입금", overpaid: "초과 입금", late: "기한 지남", ambiguous: "중복 후보", rejected: "해석 실패", disabled: "자동확인 꺼짐" })[event.status] || "확인 필요")}</li>`).join("")
    : '<li class="empty-text">직접 확인할 입금 알림이 없습니다.</li>';
  const actionLabels = { created: "등록", updated: "변경", retired: "사용 중지", reactivated: "다시 사용", migration_snapshot: "기존 설정" };
  const historyMarkup = history.length
    ? history.slice(0, 5).map((entry) => {
        const digits = String(entry.account_number || "").replace(/[^0-9]/g, "");
        return `<li><span><strong>v${Number(entry.revision || 0)} · ${escapeHtml(entry.bank_name || "은행")} · 끝 ${escapeHtml(digits.slice(-4) || "----")}</strong><small>${escapeHtml(bankNotificationDateTime(entry.created_at))} · 입금기한 ${Number(entry.deposit_deadline_hours || 24)}시간</small></span>${badge(entry.is_enabled ? "ready" : "neutral", actionLabels[entry.action] || "변경")}</li>`;
      }).join("")
    : '<li class="empty-text">계좌 변경이력은 새 DB 업데이트 적용 후 기록됩니다.</li>';
  return `
    <div class="bank-notification-status-grid">
      <section><h4>알림 기기</h4><ul>${deviceMarkup}</ul></section>
      <section><h4>확인 필요</h4><ul>${reviewMarkup}</ul></section>
      <section><h4>계좌 변경이력</h4><ul>${historyMarkup}</ul></section>
    </div>`;
}

function renderBranchSalesSetup() {
  const target = $("#branchSalesSetupPanel");
  if (!target) return;
  const branchId = activeOperationBranchId();
  if (!branchId) {
    target.innerHTML = '<p class="empty-text">운영 지점을 먼저 선택해 주세요.</p>';
    return;
  }
  if (branchSalesSettingsState.status === "loading") {
    target.innerHTML = '<p class="empty-text">회원 판매 설정을 불러오는 중입니다.</p>';
    return;
  }
  const config = normalizeBranchSalesConfig(branchSalesSettingsState.draftConfig);
  const account = branchPaymentAccount || {};
  const activeCoaches = coaches.filter((coach) => coach.status === "active" && coach.serverRoleId);
  const failed = branchSalesSettingsState.status === "failed";
  target.innerHTML = `
    <div class="panel-heading compact-heading branch-sales-heading">
      <div><p class="eyebrow">초보자 빠른 설정</p><h2>회원 판매 5단계</h2><span>기존 상품·시간표·쿠폰·결제를 한곳에서 설정합니다.</span></div>
      <span id="branchSalesDraftStatus" class="source-pill">${failed ? "서버 설정 필요" : branchSalesSettingsDirty() ? "적용 전 변경 있음" : "현재 앱과 동일"}</span>
    </div>
    ${failed ? `<p class="branch-sales-error" role="alert">설정 기능을 불러오지 못했습니다. DB 업데이트와 관리자 권한을 확인한 뒤 다시 시도해 주세요. (${escapeHtml(branchSalesSettingsState.message)})</p>` : ""}
    <div class="branch-sales-steps ${failed ? "is-disabled" : ""}">
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>1</b><span><strong>상품</strong><small>판매할 종류만 켭니다</small></span></div><div class="branch-sales-toggle-grid">
        <label><input type="checkbox" data-sales-feature="threeMonth" ${config.features.threeMonth ? "checked" : ""} /> 3개월</label>
        <label><input type="checkbox" data-sales-feature="oneDay" ${config.features.oneDay ? "checked" : ""} /> 원데이</label>
        <label><input type="checkbox" data-sales-feature="coupons" ${config.features.coupons ? "checked" : ""} /> 쿠폰</label>
        <label><input type="checkbox" data-sales-feature="bankNotificationEvidence" ${config.features.bankNotificationEvidence ? "checked" : ""} /> Android 입금 알림 확인</label>
      </div><small>가격·주 1/2회·평일/주말은 아래 기존 상품 편집에서 그대로 관리합니다.</small></section>
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>2</b><span><strong>코치·시간</strong><small>실제 시간표와 연결</small></span></div><p><strong>활동 코치 ${activeCoaches.length}명</strong> · ${activeCoaches.map((coach) => escapeHtml(coach.name)).join(" · ") || "연결된 코치 없음"}</p><small>모든 코치 또는 선택 코치는 상품별 상세에서 정합니다. 앱에는 서버에 연결되고 빈 시간이 있는 코치만 예약 가능으로 표시됩니다.</small></section>
      <section class="branch-sales-step branch-sales-payment-step"><div class="branch-sales-step-title"><b>3</b><span><strong>결제</strong><small>수단별 이름·노출·쿠폰</small></span></div><div class="branch-sales-method-grid">${["tosspay", "bank_transfer", "card", "kakaopay", "naverpay"].map((id) => branchSalesPaymentMethodMarkup(id, config.paymentMethods[id])).join("")}</div>
        <details class="branch-sales-bank-details" ${account.is_enabled ? "open" : ""}><summary>계좌이체 입금 계좌</summary><div class="branch-sales-bank-grid">
          <label><span>은행</span><input id="salesBranchBankName" type="text" maxlength="40" value="${escapeHtml(account.bank_name || "")}" placeholder="예: 우리은행" /></label>
          <label><span>계좌번호</span><input id="salesBranchBankAccountNumber" type="text" maxlength="32" inputmode="numeric" value="${escapeHtml(account.account_number || "")}" /></label>
          <label><span>예금주</span><input id="salesBranchBankAccountHolder" type="text" maxlength="60" value="${escapeHtml(account.account_holder || "")}" /></label>
          <label><span>입금기한</span><select id="salesBranchBankDepositDeadlineHours"><option value="12" ${Number(account.deposit_deadline_hours || 24) === 12 ? "selected" : ""}>12시간</option><option value="24" ${Number(account.deposit_deadline_hours || 24) === 24 ? "selected" : ""}>24시간</option><option value="48" ${Number(account.deposit_deadline_hours || 24) === 48 ? "selected" : ""}>48시간</option><option value="72" ${Number(account.deposit_deadline_hours || 24) === 72 ? "selected" : ""}>72시간</option></select></label>
          <label class="branch-sales-check"><input id="salesBranchBankTransferEnabled" type="checkbox" ${account.is_enabled ? "checked" : ""} /> 회원앱 사용</label>
          <label class="branch-sales-bank-note"><span>입금 안내</span><input id="salesBranchBankTransferInstructions" type="text" maxlength="300" value="${escapeHtml(account.transfer_instructions || "")}" placeholder="신청자 이름으로 입금해 주세요" /></label>
          <button id="saveSalesBranchPaymentAccountButton" class="small-button" type="button">계좌만 저장</button>
        </div><small>회원앱에 적용을 누르면 계좌와 결제 설정을 함께 저장합니다. 계좌는 주문할 때 복사되어 이후 계좌를 바꿔도 기존 주문은 그대로 유지됩니다. 정확히 일치한 Android 입금 알림만 자동 확인하고, 나머지는 관리자 검토로 남깁니다.</small>${bankNotificationStatusMarkup()}</details>
      </section>
      <section class="branch-sales-step"><div class="branch-sales-step-title"><b>4</b><span><strong>혜택·쿠폰</strong><small>대상별 이름·할인율</small></span></div><div class="branch-sales-benefit-grid">${Object.entries(config.benefits).map(([id, benefit]) => branchSalesBenefitMarkup(id, benefit)).join("")}</div><small>혜택은 켠 뒤에도 대상 판정과 중복 방지를 서버에서 다시 확인합니다.</small></section>
      <section class="branch-sales-step branch-sales-preview-step"><div class="branch-sales-step-title"><b>5</b><span><strong>미리보기·적용</strong><small>390px 회원 화면 기준</small></span></div><div id="branchSalesMemberPreview">${branchSalesPreviewMarkup()}</div><div class="branch-sales-actions"><button id="saveBranchSalesDraftButton" class="secondary-button" type="button" ${failed ? "disabled" : ""}>초안 저장</button><button id="applyBranchSalesSettingsButton" class="primary-button" type="button" ${failed ? "disabled" : ""}>회원앱에 적용</button></div><small>초안 저장만으로는 앱이 바뀌지 않습니다. 적용 후 새 주문부터 새 설정과 가격이 고정됩니다.</small></section>
    </div>`;
}

function adminLayoutRowMarkup(item, kind, index, count, group = "") {
  const hiddenList = kind === "menu"
    ? adminLayoutSettings.hiddenMenus
    : kind === "group"
      ? adminLayoutSettings.hiddenGroups
      : kind === "reportWidget"
        ? adminLayoutSettings.hiddenReportWidgets
        : adminLayoutSettings.hiddenWidgets;
  return `
    <div class="admin-layout-row ${kind === "reportWidget" ? "has-report-options" : ""}">
      <label>
        <input type="checkbox" data-admin-layout-visible="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" ${hiddenList.includes(item.id) ? "" : "checked"} ${item.required ? "disabled" : ""} />
        <span>${escapeHtml(item.label)}</span>
      </label>
      <div class="admin-layout-row-actions">
        ${kind === "menu" && item.id !== "dashboard" ? `
          <button class="small-button admin-menu-placement-button" type="button" data-admin-menu-placement="${adminLayoutSettings.moreMenus.includes(item.id) ? "primary" : "more"}" data-admin-layout-id="${item.id}">${adminLayoutSettings.moreMenus.includes(item.id) ? "주 메뉴로" : "더보기로"}</button>
        ` : ""}
        ${kind === "reportWidget" ? `
          <label class="admin-layout-option">
            <span>폭</span>
            <select data-admin-report-widget-size="${item.id}" aria-label="${escapeHtml(item.label)} 폭">
              ${adminReportWidgetSizeOptions.map((option) => `<option value="${option.id}" ${adminLayoutSettings.reportWidgetSizes[item.id] === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
          <label class="admin-layout-option">
            <span>표시</span>
            <select data-admin-report-widget-filter="${item.id}" aria-label="${escapeHtml(item.label)} 표시 기준">
              ${adminReportWidgetFilterOptions.map((option) => `<option value="${option.id}" ${adminLayoutSettings.reportWidgetFilters[item.id] === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        <button class="icon-button" type="button" aria-label="위로 이동" title="위로 이동" data-move-admin-layout="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-button" type="button" aria-label="아래로 이동" title="아래로 이동" data-move-admin-layout="${kind}" data-admin-layout-id="${item.id}" data-admin-layout-group="${group}" data-direction="1" ${index === count - 1 ? "disabled" : ""}>↓</button>
      </div>
    </div>`;
}
