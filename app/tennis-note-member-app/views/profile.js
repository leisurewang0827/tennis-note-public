// 프로필과 설정 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderBankNotificationBridge() {
  const card = $("#bankNotificationBridgeCard");
  const status = $("#bankNotificationBridgeStatus");
  const detail = $("#bankNotificationBridgeDetail");
  const button = $("#bankNotificationBridgeButton");
  if (!card) return;
  const allowed = bankNotificationAdminAllowed();
  card.hidden = !allowed;
  if (!allowed) return;
  const bridge = bankNotificationBridgeState || {};
  const configured = bridge.configured === true;
  const permissionGranted = bridge.permissionGranted === true;
  const repairRequired = bridge.repairRequired === true
    || bridge.remoteDisabled === true
    || String(bridge.lastError || "").includes("repair_required")
    || String(bridge.lastError || "").includes("feature_disabled")
    || String(bridge.lastError || "").includes("device_unauthorized");
  const pendingCount = Math.max(0, Number(bridge.pendingCount || 0));
  card.classList.toggle("is-enabled", configured && permissionGranted && !repairRequired);
  card.classList.toggle("is-denied", configured && !permissionGranted);
  if (status) {
    status.textContent = repairRequired
      ? "계좌 변경 후 다시 연결 필요"
      : configured && permissionGranted
        ? `입금 알림 연결됨${pendingCount ? ` · 전송 대기 ${pendingCount}건` : ""}`
        : configured ? "휴대폰 알림 접근을 허용해 주세요" : "이 기기는 아직 연결되지 않았습니다";
  }
  if (detail) {
    detail.textContent = repairRequired
      ? "관리자 웹에서 계좌가 변경되어 기존 연결을 안전하게 중단했습니다. 다시 연결해 주세요."
      : configured && permissionGranted
        ? "정확히 일치한 입금만 자동 확인하며 일부·초과·지연 입금은 관리자 검토로 남습니다."
        : "우리은행·카카오뱅크 알림의 금액과 입금자만 읽으며 알림 원문은 서버에 저장하지 않습니다.";
  }
  if (button) button.textContent = repairRequired ? "다시 연결" : configured && permissionGranted ? "지금 확인" : configured ? "알림 접근 허용" : "이 기기 연결";
}

function renderMemberRuntimeDiagnostics() {
  const target = $("#memberRuntimeDiagnostics");
  if (!target) return;
  const release = window.TENNIS_NOTE_RELEASE || {};
  const platform = memberNativeAppInfo?.platform || nativeAppPlatform();
  const nativeLabel = memberNativeAppInfo?.version
    ? `${platform} ${memberNativeAppInfo.version} (${memberNativeAppInfo.build || "-"})`
    : platform === "web" ? "웹/PWA" : `${platform} 셸 확인 중`;
  const syncLabel = state.scheduleV2LastSyncedAt
    ? new Date(state.scheduleV2LastSyncedAt).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    : "아직 동기화 안 됨";
  const feedLabel = state.scheduleV2SyncErrorCode
    ? `V2 확인 필요 · ${state.scheduleV2SyncErrorCode}`
    : state.scheduleV2WorkspaceLoaded ? "V2 정상" : "V2 확인 중";
  target.textContent = `${nativeLabel} · 웹 ${release.version || "-"} · 배포 ${release.releaseId || "-"} · ${feedLabel} · 마지막 동기화 ${syncLabel}`;
}

function renderPushNotificationSettings() {
  const card = $(".push-settings-card");
  const status = $("#pushNotificationStatus");
  const detail = $("#pushNotificationDetail");
  const button = $("#pushNotificationButton");
  if (!card || !status || !detail || !button) return;

  if (accountDeletionBlocksNotifications(state.accountDeletionRequest?.status)) {
    card.classList.remove("is-enabled", "is-denied");
    status.textContent = "탈퇴 요청으로 알림 중지";
    detail.textContent = "계정 삭제 요청을 처리하는 동안 새 기기 알림을 등록하지 않습니다.";
    button.textContent = "알림 중지됨";
    button.disabled = true;
    return;
  }

  const pushState = state.pushNotifications || {};
  const permission = pushState.permission || "unknown";
  button.disabled = false;
  card.classList.toggle("is-enabled", permission === "granted");
  card.classList.toggle("is-denied", permission === "denied");
  status.textContent = pushState.status || "앱 알림 확인 중";
  detail.textContent = pushState.detail || "수업 일정과 회원권 만료를 알려드립니다.";
  button.textContent = permission === "granted" ? "알림 끄기" : permission === "denied" ? "설정 확인" : "알림 켜기";
}

function renderAccountDeletionSettings() {
  const card = $(".account-settings-card");
  const status = $("#accountDeletionStatus");
  const detail = $("#accountDeletionDetail");
  const button = $("#openAccountDeletionButton");
  if (!card || !status || !detail || !button) return;

  const request = state.accountDeletionRequest;
  const requestStatus = request?.status || "";
  card.classList.toggle("is-pending", ["pending", "reviewing", "processing", "failed"].includes(requestStatus));
  card.classList.toggle("is-completed", requestStatus === "completed");
  button.disabled = ["reviewing", "processing", "failed", "completed"].includes(requestStatus);

  if (requestStatus === "pending") {
    status.textContent = "탈퇴 요청 접수됨";
    detail.textContent = "관리자 검토 전에는 요청을 취소할 수 있습니다.";
    button.textContent = "요청 취소";
    return;
  }
  if (requestStatus === "reviewing") {
    status.textContent = "관리자 검토 중";
    detail.textContent = "결제·환불·잔여 수업과 법정 보관 대상을 확인하고 있습니다.";
    button.textContent = "처리 중";
    return;
  }
  if (requestStatus === "processing") {
    status.textContent = "계정 삭제 처리 중";
    detail.textContent = "로그인 연결과 개인 이용 데이터를 안전하게 삭제하고 있습니다.";
    button.textContent = "처리 중";
    return;
  }
  if (requestStatus === "failed") {
    if (String(request?.last_error_code || "").includes("apple_reauthentication")) {
      status.textContent = "Apple 로그인 갱신 필요";
      detail.textContent = "로그아웃한 뒤 Apple로 다시 로그인하고 고객지원에 삭제 처리를 다시 요청해 주세요.";
      button.textContent = "재로그인 필요";
      return;
    }
    status.textContent = "삭제 처리 재확인 중";
    detail.textContent = "일부 서버 처리를 다시 확인하고 있습니다. 고객지원에서 안전하게 재시도합니다.";
    button.textContent = "재확인 중";
    return;
  }
  if (requestStatus === "completed") {
    status.textContent = "탈퇴 처리 완료";
    detail.textContent = "법정 보관 대상 외 계정과 이용 데이터의 삭제 처리가 완료되었습니다.";
    button.textContent = "처리 완료";
    return;
  }

  status.textContent = "회원 탈퇴 요청 없음";
  detail.textContent = "탈퇴하면 정산·환불·법정 보관 자료를 제외한 계정과 이용 데이터를 삭제합니다.";
  button.textContent = "탈퇴·삭제 요청";
}

function renderProfileAvatar(target, size = "small") {
  if (!target) return;
  target.className = `profile-avatar ${size}`;
  target.replaceChildren();
  const renderEmptyAvatar = () => {
    target.classList.remove("has-photo");
    target.classList.add("is-empty");
    target.setAttribute("aria-label", "기본 프로필 이미지");
    const placeholder = document.createElement("span");
    placeholder.className = "profile-avatar-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    target.replaceChildren(placeholder);
  };
  const photoUrl = String(state.profile?.photoDataUrl || "").trim();
  if (!photoUrl) {
    renderEmptyAvatar();
    return;
  }
  const image = document.createElement("img");
  image.src = photoUrl;
  image.alt = `${state.profile?.name || state.member?.name || "회원"} 프로필 사진`;
  image.addEventListener("error", renderEmptyAvatar, { once: true });
  target.classList.add("has-photo");
  target.classList.remove("is-empty");
  target.setAttribute("aria-label", image.alt);
  target.append(image);
}

function renderProfile() {
  syncNtrpResultFromCoach();
  if (!state.profile) {
    state.profile = {
      name: state.member?.name || "김서준 회원",
      nickname: "서준",
      phone: "010-0000-0000",
      profileCompletedAt: new Date().toISOString(),
      privacyConsentVersion: identityPrivacyVersion,
      privacyConsentedAt: new Date().toISOString(),
      suggestedNickname: "",
      branch: "어린이대공원점",
      mainCoach: "노 코치",
      ticket: "주2회 개인 20분 · 총 10회",
      photoDataUrl: "",
      hand: "오른손",
      backhand: "투핸드 백핸드",
      startedAt: "2025-03-01",
      goal: "포핸드 랠리 안정화",
      styleMemo: "오른손잡이, 백핸드는 투핸드로 배우는 중입니다.",
      selfNtrp: "2.5",
      coachNtrp: "측정 전",
      ntrpCheckRequested: false,
    };
  }
  const realName = state.profile.name || state.member?.name || "김서준";
  const memberName = state.profile.nickname || realName || "회원";
  renderProfileAvatar($("#topProfileAvatar"), "small");
  renderProfileAvatar($("#profileAvatar"), "large");
  if ($("#homeMemberGreeting")) $("#homeMemberGreeting").textContent = `${memberName}님, 오늘 수업을 확인하세요`;
  if ($("#homeAccountDetail")) $("#homeAccountDetail").textContent = "내 정보에서 프로필과 계정을 관리합니다.";
  if ($("#memberName")) $("#memberName").textContent = memberName;
  if ($("#memberLoginLabel")) $("#memberLoginLabel").textContent = state.member?.provider ? `${state.member.provider} 로그인 유지` : "Tennis Note";
  if ($("#profileName")) $("#profileName").textContent = memberName;
  if ($("#profileRealName")) $("#profileRealName").textContent = `실명 ${realName}`;
  if ($("#profileProvider")) {
    const coachRole = canUseCoachMode() ? " · 코치 승인" : "";
    const provider = state.member?.provider ? `${state.member.provider} 로그인 유지중${coachRole}` : "간편 로그인 대기";
    $("#profileProvider").textContent = provider;
  }
  if ($("#profileNtrpSummary")) {
    const selfNtrp = state.profile.selfNtrp || "측정 전";
    const coachNtrp = state.profile.coachNtrp || "측정 전";
    $("#profileNtrpSummary").textContent = `내가 고른 수준 ${selfNtrp} · 코치가 본 수준 ${coachNtrp}`;
  }
  // A live schedule refresh runs while the profile sheet is open. Do not replace
  // what the member is typing with the last server value during that refresh.
  const setProfileFieldValue = (selector, value) => {
    const field = $(selector);
    if (field && document.activeElement !== field) field.value = value;
  };
  setProfileFieldValue("#profileRealNameInput", realName === "가입 확인 중" ? "" : realName);
  setProfileFieldValue("#profileNicknameInput", state.profile.nickname || "");
  setProfileFieldValue("#profilePhoneInput", formatIdentityPhone(state.profile.phone || ""));
  if ($("#profileHand")) $("#profileHand").value = state.profile.hand || "오른손";
  if ($("#profileBackhand")) $("#profileBackhand").value = state.profile.backhand || "투핸드 백핸드";
  if ($("#profileStartedAt")) $("#profileStartedAt").value = state.profile.startedAt || "";
  if ($("#profileGoal")) $("#profileGoal").value = state.profile.goal || "";
  if ($("#profileStyleMemo")) $("#profileStyleMemo").value = state.profile.styleMemo || "";
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = state.profile.selfNtrp || "2.5";
  if ($("#profileCoachNtrp")) $("#profileCoachNtrp").value = state.profile.coachNtrp || "측정 전";
  if ($("#ntrpPanel")) {
    $("#ntrpPanel").innerHTML = `
      <article>
        <span>내가 본 레벨</span>
        <strong>${state.profile.selfNtrp || "2.5"} 단계</strong>
        <small>자가 체크 기준입니다. 실제 레슨에서는 코치가 움직임, 랠리, 서브, 게임 이해도를 보고 다시 측정합니다.</small>
      </article>
      <article class="${state.profile.ntrpCheckRequested ? "is-requested" : ""}">
        <span>코치 측정</span>
        <strong>${state.profile.coachNtrp || "측정 전"}</strong>
        <small>${state.profile.ntrpCheckRequested ? "코치에게 측정 요청이 전달된 상태입니다." : "원하면 코치에게 레벨 측정을 요청할 수 있습니다."}</small>
      </article>
      <article>
        <span>기준표</span>
        <strong>공식 기준 1.5~7.0</strong>
        <small>NTRP 원문은 참고자료에서만 확인할 수 있습니다.</small>
      </article>`;
  }
  renderDiscountCouponWallet();
  renderPushNotificationSettings();
  renderAccountDeletionSettings();
  renderNtrpSurvey();
}

function renderNtrpSurvey() {
  if ($("#ntrpReferenceCards")) {
    $("#ntrpReferenceCards").innerHTML = ntrpReferences
      .map(
        (item) => `
          <article>
            <button class="ntrp-reference-button" type="button" data-open-ntrp-reference="${item.id}">
              <strong>${item.title}</strong>
              <span>${item.detail}</span>
              <small>${item.image ? "포스터는 팝업에서 확인합니다." : "공식 기준 요약은 팝업에서 확인합니다."}</small>
              <b>확인</b>
            </button>
          </article>`,
      )
      .join("");
  }
  const quickGuide = `
    <section class="ntrp-quick-guide">
      ${ntrpQuickLevels
        .map(
          (item) => `
            <article>
              <strong>${item.level}</strong>
              <span>${item.label}</span>
              <small>${item.detail}</small>
            </article>`,
        )
        .join("")}
    </section>`;
  if ($("#ntrpSurveyQuestions")) {
    $("#ntrpSurveyQuestions").innerHTML =
      quickGuide +
      ntrpSurveyQuestions
      .map(
        (question) => `
          <fieldset class="ntrp-question">
            <legend>${question.title}</legend>
            ${question.options
              .map(
                (option, index) => `
                  <label>
                    <input type="radio" name="ntrp-${question.id}" value="${option.score}" ${Number(state.profile?.ntrpSurvey?.[question.id] || 0) === option.score || (!state.profile?.ntrpSurvey?.[question.id] && index === 2) ? "checked" : ""} />
                    <span>${option.score} 단계 · ${option.label}</span>
                  </label>`,
              )
              .join("")}
          </fieldset>`,
      )
      .join("");
  }
}

function renderMemberHelp() {
  const target = $("#memberHelpList");
  if (!target) return;
  $$('[data-member-help-category]').forEach((button) => {
    const selected = button.dataset.memberHelpCategory === memberHelpCategory;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  const entries = filteredMemberHelpEntries();
  target.innerHTML = entries.length ? entries.map((entry) => `
    <details data-member-help-entry="${escapeHtml(entry.id)}">
      <summary>${escapeHtml(entry.question)}</summary>
      <div class="member-help-answer">
        <p>${escapeHtml(entry.answer)}</p>
        <button class="small-button" type="button" data-member-help-action="${escapeHtml(entry.action)}">${escapeHtml(entry.actionLabel)}</button>
      </div>
    </details>
  `).join("") : '<p class="member-help-empty">검색 결과가 없습니다. 다른 단어로 찾아보세요.</p>';
}
