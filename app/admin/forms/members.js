// members 관련 폼 항목·표시를 맞추는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function ticketPriorityForMember(ticket, memberReference) {
  const memberUserIds = memberRecordsForReference(memberReference).flatMap(memberServerUserIds);
  const derivedState = window.TennisNoteTicketState?.derive(ticket) || "";
  const stateScore = ({ current: 5000, paused: 4000, upcoming: 3000, pending_payment: 2000 })[derivedState] || 0;
  let score = stateScore;
  if (ticket.remaining > 0) score += 1000;
  if (ticketIsSharedGroup(ticket)) score += 500;
  score += ticketParticipantUserIds(ticket).length * 20;
  if (memberUserIds.includes(ticket.serverUserId)) score += 10;
  if (ticket.status === "active") score += 5;
  return score;
}

async function copyMemberAuthSql(memberId, mode) {
  const member = members.find((item) => item.id === Number(memberId));
  if (!member) return;
  const role = document.querySelector(`[data-auth-link-role="${member.id}"]`)?.value || defaultAuthRoleForMember(member);
  const provider = document.querySelector(`[data-auth-link-provider="${member.id}"]`)?.value || "";
  if (mode === "candidate") {
    await copyTextToClipboard(buildAuthCandidateSql(member, role));
    showToast("후보 조회 SQL 복사 완료");
    return;
  }
  if (!provider) {
    showToast("연결할 로그인 수단을 선택해 주세요");
    return;
  }
  const authUserId = document.querySelector(`[data-auth-link-auth="${member.id}"]`)?.value.trim() || "";
  const tnUserId = document.querySelector(`[data-auth-link-profile="${member.id}"]`)?.value.trim() || "";
  if (!isAuthUuid(authUserId)) {
    showToast("Auth 사용자 UUID를 확인해 주세요");
    return;
  }
  if (!isAuthUuid(tnUserId)) {
    showToast("회원 DB UUID를 확인해 주세요");
    return;
  }
  await copyTextToClipboard(buildAuthLinkSql(member, { authUserId, tnUserId, role, provider }));
  showToast("로그인 연결 SQL 복사 완료");
}

function filteredMembers() {
  const localSearch = String(state.memberSearch || "").trim().toLowerCase();
  const globalSearch = String($("#globalSearch")?.value || "").trim();
  const matchingMembers = operationBranchMembers().filter((member) => {
    if (memberListStatus(member) === "journal") return false;
    const statusMatch = memberMatchesStatusFilter(member, state.memberFilter);
    const coachMatch = state.memberCoachFilter === "all" || memberCoachNames(member).includes(state.memberCoachFilter);
    const ticketMatch = state.memberTicketFilter === "all" || memberHasTicketKind(member, state.memberTicketFilter);
    const searchValues = globalSearch ? memberSearchValues(member) : [];
    const localMatch = !localSearch || normalizedMemberSearchText(member).includes(localSearch);
    return statusMatch
      && coachMatch
      && ticketMatch
      && localMatch
      && matchesSearch([...searchValues, memberStatusLabel(member)]);
  });
  return matchingMembers;
}

function validateRequiredMemberProfile(form, message = null) {
  const phone = form.elements.memberPhone;
  const birthYear = form.elements.memberBirthYear;
  const neighborhood = form.elements.memberNeighborhood;
  if (!phone && !birthYear && !neighborhood) return true;
  const currentYear = new Date().getFullYear();
  const phoneDigits = String(phone?.value || "").replace(/\D/g, "");
  const birthValue = Number(birthYear?.value || 0);
  const neighborhoodValue = String(neighborhood?.value || "").trim();
  let invalidControl = null;
  let errorText = "";
  if (phone && ((phone.required && !phoneDigits) || (phoneDigits && phoneDigits.length < 8))) {
    invalidControl = phone;
    errorText = "휴대전화 번호를 입력해 주세요.";
  } else if (birthYear && String(birthYear.value || "").trim() && (!Number.isInteger(birthValue) || birthValue < 1900 || birthValue > currentYear)) {
    invalidControl = birthYear;
    errorText = "출생연도를 네 자리로 입력해 주세요.";
  } else if (neighborhood?.required && !neighborhoodValue) {
    invalidControl = neighborhood;
    errorText = "거주동을 입력해 주세요.";
  }
  if (!invalidControl) return true;
  if (message) {
    message.textContent = errorText;
    message.classList?.add("is-error");
  }
  invalidControl.focus();
  return false;
}

function requestMemberInlineEditor(memberId, ticketId = "") {
  if (operationsRole() !== "admin") return;
  const openEditor = () => openMemberInlineEditor(memberId, ticketId);
  if (memberAdminEditEnabled || isAdminUnlocked()) {
    openEditor();
    return;
  }
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("운영 설정의 보안·잠금에서 관리자 PIN을 먼저 설정해 주세요.");
    return;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "member_admin_edit";
  adminLockSession.pendingLabel = "회원 바로 수정";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = openEditor;
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
}

function dirtyMemberInlineForms() {
  return [...document.querySelectorAll('[data-member-inline-form][data-dirty="true"]')];
}

function requestMemberAdminEdit() {
  if (operationsRole() !== "admin") return;
  if (memberAdminEditEnabled) {
    if (dirtyMemberInlineForms().length && !window.confirm("저장하지 않은 변경사항을 버리고 회원표 편집을 종료할까요?")) return;
    setMemberAdminEditEnabled(false);
    return;
  }
  if (isAdminUnlocked()) {
    setMemberAdminEditEnabled(true);
    return;
  }
  if (adminPinNeedsSetup()) {
    state.settingsTab = "security";
    showToast("운영 설정의 보안·잠금에서 관리자 PIN을 먼저 설정해 주세요.");
    return;
  }
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "member_admin_edit";
  adminLockSession.pendingLabel = "회원표 바로 편집";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = () => setMemberAdminEditEnabled(true);
  renderAdminLockModal();
  $("#adminLockModal")?.removeAttribute("hidden");
  setTimeout(() => $("#adminPinInput")?.focus(), 0);
}

function keepMemberInlineScheduleSeparate(form) {
  if (!form?.elements.applyToFutureSchedule) return;
  if (memberInlineCoachChanged(form)) {
    const message = form.querySelector(".member-inline-message");
    if (message) {
      message.textContent = "코치 변경은 기존 시간표를 그대로 둘 수 없습니다. 새 코치의 가능한 요일·시간을 선택해 함께 저장해 주세요.";
      message.classList.add("is-error");
      message.classList.remove("is-success");
    }
    return;
  }
  form.elements.applyToFutureSchedule.value = "false";
  const message = form.querySelector(".member-inline-message");
  if (message) {
    message.textContent = "회원권 정보만 저장하고 기존 시간표는 유지합니다.";
    message.classList.remove("is-error", "is-success");
  }
  setMemberInlineDirtyState(form);
}

function syncMemberInlineDurationShortcuts(form, selectedProduct = null) {
  const product = selectedProduct || (adminLiveDataState.products || [])
    .find((item) => String(item.id || "") === String(form?.elements?.productId?.value || ""));
  const selectedMinutes = Number(product?.lesson_minutes || 0);
  form?.querySelectorAll("[data-member-product-duration]").forEach((button) => {
    button.setAttribute("aria-pressed", Number(button.dataset.memberProductDuration) === selectedMinutes ? "true" : "false");
  });
}

function selectedLessonMemberReference() {
  const select = $("#lessonMember");
  const selectedUserId = select?.selectedOptions?.[0]?.dataset?.memberUserId || "";
  if (selectedUserId) {
    const exactMember = members.find((member) => memberServerUserIds(member).includes(selectedUserId));
    if (exactMember) return exactMember;
  }
  return select?.value || "";
}
