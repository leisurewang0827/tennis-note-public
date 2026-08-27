// 회원 입력 폼의 항목과 표시를 서로 맞추는 함수들.
//
// 선택지 목록을 다시 채우고 필드를 보이거나 숨긴다. 서버는 부르지 않는다.
// 관리자에서 sync*/refresh* 는 대부분 서버가 아니라 이 일을 한다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function refreshMembershipProductDrafts(source = []) {
  const savedProducts = Array.isArray(source) ? source : [];
  const deletedIds = new Set(deletedMembershipProductIds);
  const normalizedDefaults = membershipProductDefaults.map((defaultProduct) =>
    normalizeMembershipProduct(savedProducts.find((product) => product.id === defaultProduct.id), defaultProduct))
    .filter((product) => !deletedIds.has(product.id));
  normalizedDefaults
    .filter((product) => ["coupon-20", "coupon-30"].includes(product.id))
    .forEach((product) => {
      product.status = "hidden";
      product.rule = "기존 4회 쿠폰은 신규 판매에서 제외합니다.";
    });
  normalizedDefaults
    .filter((product) => product.id === "group-20")
    .forEach((product) => {
      product.status = "hidden";
      product.rule = "기존 8회 그룹권은 과거 이용 내역에서만 유지합니다.";
    });
  const extraProducts = savedProducts
    .filter((product) => product.id
      && !deletedIds.has(product.id)
      && !membershipProductDefaults.some((defaultProduct) => defaultProduct.id === product.id))
    .map((product) => normalizeMembershipProduct(product));
  replaceArray(membershipProductDrafts, [...normalizedDefaults, ...extraProducts]);
}

function refreshMembershipProductDraftsFromServer(source = []) {
  const products = (Array.isArray(source) ? source : [])
    .filter((product) => !String(product.product_code || "").startsWith("admin-ticket-"))
    .filter((product) => !String(product.product_code || "").startsWith("deleted-product-history-"))
    .map(membershipProductDraftFromServer)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || String(left.title || "").localeCompare(String(right.title || ""), "ko"));
  if (products.length) replaceArray(membershipProductDrafts, products);
}

function syncMemberTicketExtensionPreview(form) {
  const input = form?.elements?.extendedExpiresOn;
  const output = form?.querySelector("[data-member-ticket-extension-result]");
  if (!input || !output) return;
  output.textContent = input.value ? memberDetailDateLabel(input.value) : "날짜 선택";
  [...form.querySelectorAll("[data-ticket-extension-days]")].forEach((button) => {
    const expected = addMemberManagementDays(form.dataset.currentExpiresOn, Number(button.dataset.ticketExtensionDays));
    button.classList.toggle("is-active", expected === input.value);
  });
}

function syncManualMemberPartnerField(form) {
  if (!form?.elements?.partnerUserId) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const groupProduct = form.elements.lessonType
    ? form.elements.lessonType.value === "one_on_two"
    : Number(product?.group_size || 1) === 2;
  const field = form.querySelector("[data-manual-member-partner-field]");
  const partnerMode = form.elements.partnerMode?.value || "existing";
  const createNewPartner = groupProduct && partnerMode === "new" && Boolean(form.elements.partnerName);
  const newFields = form.querySelector("[data-manual-new-partner]");
  const existingFields = form.querySelector("[data-manual-existing-partner]");
  if (newFields) newFields.hidden = !createNewPartner;
  if (existingFields) existingFields.hidden = !groupProduct || createNewPartner;
  form.elements.partnerUserId.disabled = !groupProduct || createNewPartner;
  form.elements.partnerUserId.required = groupProduct && !createNewPartner;
  if (form.elements.partnerSearch) form.elements.partnerSearch.disabled = !groupProduct || createNewPartner;
  if (form.elements.partnerName) {
    form.elements.partnerName.disabled = !createNewPartner;
    form.elements.partnerName.required = createNewPartner;
  }
  ["partnerPhone", "partnerBirthYear", "partnerGender"].forEach((name) => {
    if (form.elements[name]) form.elements[name].disabled = !createNewPartner;
  });
  if (!groupProduct || createNewPartner) form.elements.partnerUserId.value = "";
  field?.classList.toggle("is-disabled", !groupProduct);
  if (field) field.hidden = !groupProduct;
  filterManualMemberPartnerOptions(form);
}

function syncMemberManagementScopeFields(form) {
  if (!form?.elements?.scheduleScope) return;
  const scope = form.elements.scheduleScope.value;
  const frequency = form.elements.weeklyFrequency;
  if (frequency) {
    const threeTimes = Array.from(frequency.options || []).find((option) => option.value === "3");
    if (threeTimes) threeTimes.disabled = scope === "weekend";
    if (scope === "weekend" && Number(frequency.value) > 2) frequency.value = "2";
  }
  form.querySelectorAll('input[name="lessonDays"]').forEach((input) => {
    const day = Number(input.value);
    const allowed = scope === "mixed" || (scope === "weekend" ? [0, 6].includes(day) : day >= 1 && day <= 5);
    input.disabled = !allowed;
    if (!allowed) input.checked = false;
    input.closest(".member-lesson-day-option")?.classList.toggle("is-disabled", !allowed);
  });
}

function syncMemberManagementProductForMethod(form, allLiveData = adminLiveDataState) {
  if (!form?.elements?.productId || !form.elements.scheduleScope || !form.elements.weeklyFrequency || !form.elements.lessonType) return;
  const groupSize = form.elements.lessonType.value === "one_on_two" ? 2 : 1;
  const currentProduct = (allLiveData.products || []).find((item) => item.id === form.elements.productId.value);
  if (currentProduct?.product_kind === "coupon" || currentProduct?.is_coupon === true) return;
  const matchingProduct = memberManagementProducts().find((item) => (
    (!currentProduct?.branch_id || item.branch_id === currentProduct.branch_id)
    && memberManagementProductScheduleScope(item) === form.elements.scheduleScope.value
    && Number(item.frequency_per_week || 1) === Number(form.elements.weeklyFrequency.value)
    && Number(item.group_size || 1) === groupSize
  ));
  if (matchingProduct) {
    form.elements.productId.value = matchingProduct.id;
    applyMemberManagementProductDefaults(form);
  }
}

async function loadMemberEditorModeFromServer() {
  if (operationsRole() === "admin" && isAdminUnlocked() && !memberAdminEditEnabled) {
    memberAdminEditEnabled = true;
    memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
  }
  renderMemberEditorModeBar();
  return true;
}

function syncMemberInlineFutureScheduleChoice(form) {
  if (!form?.dataset.ticketId || !form.elements.applyToFutureSchedule) return;
  const schedules = memberInlineScheduleValues(form);
  if (memberInlineCoachChanged(form) && memberInlineScheduleIsComplete(form, schedules)) {
    form.elements.applyToFutureSchedule.value = "true";
  }
}

function syncMemberTicketPartnerField(setup) {
  const groupSize = Number(setup?.querySelector("[data-ticket-group-size]")?.value || 1);
  const partnerField = setup?.querySelector("[data-ticket-partner-field]");
  const partnerSearch = setup?.querySelector("[data-ticket-partner-search]");
  const partnerSelect = setup?.querySelector("[data-ticket-partner-user]");
  if (!partnerField || !partnerSearch || !partnerSelect) return;
  const enabled = groupSize === 2 && setup.dataset.ticketOwnerView === "true" && adminApprovalReady();
  partnerField.hidden = groupSize !== 2;
  partnerSearch.disabled = !enabled;
  partnerSelect.disabled = !enabled;
  if (groupSize !== 2) partnerSearch.value = "";
  filterMemberTicketPartnerOptions(setup);
}

function syncMemberBulkRenewalFields() {
  const action = $("#memberBulkAction")?.value || "";
  const fields = $("#memberBulkRenewalFields");
  if (!fields) return;
  fields.hidden = action !== "reenroll";
  if (fields.hidden) return;

  const productSelect = $("#memberBulkRenewalProduct");
  if (productSelect) {
    const previousValue = productSelect.value;
    const products = membershipProductsForActiveOperationProfile()
      .map((draft) => ({ draft, server: serverMembershipProductForDraft(draft) }))
      .filter(({ draft, server }) => server?.id && draft.status !== "hidden" && draft.status !== "disabled");
    productSelect.innerHTML = products.length
      ? products.map(({ draft, server }) => `<option value="${escapeHtml(server.id)}">${escapeHtml(draft.title || draft.name || server.name || "회원권")}</option>`).join("")
      : '<option value="">판매 중인 회원권 없음</option>';
    if (products.some(({ server }) => String(server.id) === previousValue)) productSelect.value = previousValue;
  }
  const paymentDate = $("#memberBulkRenewalPaymentDate");
  if (paymentDate && !paymentDate.value) paymentDate.value = adminLocalDateKey(new Date());
}

function syncMemberQuickEditorProduct(form) {
  if (!form?.classList.contains("member-inline-editor--compact")) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const groupSize = Number(product?.group_size || 1);
  const groupProduct = Boolean(product) && groupSize === 2;
  const partnerField = form.querySelector("[data-member-quick-partner]");
  const partnerEmpty = form.querySelector("[data-member-quick-partner-empty]");
  if (form.elements.partnerUserId) {
    form.elements.partnerUserId.disabled = !groupProduct;
    form.elements.partnerUserId.required = groupProduct;
  }
  if (form.elements.partnerSearch) form.elements.partnerSearch.disabled = !groupProduct;
  const partnerSearchFields = form.querySelector("[data-manual-existing-partner]");
  if (partnerSearchFields) partnerSearchFields.hidden = !groupProduct;
  if (partnerField) partnerField.hidden = false;
  if (partnerEmpty) partnerEmpty.hidden = groupProduct;
  if (!groupProduct && form.elements.partnerSearch) form.elements.partnerSearch.value = "";
  filterManualMemberPartnerOptions(form);
  syncMemberQuickEditorSchedule(form, product);
  syncMemberInlineProductChangeNote(form, product);
  syncMemberInlineDurationShortcuts(form, product);
  if (!product) return;
  form.elements.lessonType.value = groupProduct ? "one_on_two" : "one_on_one";
  const productScope = memberManagementProductScheduleScope(product);
  if (form.dataset.scheduleScopeTouched !== "true") form.elements.scheduleScope.value = productScope;
  const mixedOption = [...(form.elements.scheduleScope?.options || [])].find((option) => option.value === "mixed");
  if (mixedOption) mixedOption.hidden = memberManagementProductIsCoupon(product);
  form.elements.weeklyFrequency.value = memberManagementProductWeeklyFrequency(product);
}

function syncMemberQuickEditorSchedule(form, product = null) {
  const panel = form?.querySelector("[data-member-inline-schedule]");
  if (!panel) return;
  const selectedProduct = product || (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  const regularProduct = memberManagementProductSupportsRegularSchedule(selectedProduct);
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const frequency = memberRegularScheduleFrequency(selectedProduct, ticket);
  const scope = memberManagementProductScheduleScope(selectedProduct || {});
  panel.hidden = !regularProduct;
  panel.dataset.productKind = selectedProduct?.product_kind || "";
  let invalidScope = false;
  panel.querySelectorAll("[data-member-schedule-row]").forEach((row, offset) => {
    const enabled = regularProduct && offset < frequency;
    row.hidden = !enabled;
    const dayInput = row.querySelector(`input[name="scheduleDay${offset + 1}"]`);
    const timeInput = row.querySelector(`select[name="scheduleTime${offset + 1}"]`);
    if (dayInput) dayInput.disabled = !enabled;
    if (timeInput) timeInput.disabled = !enabled;
    const selectedDay = Number(dayInput?.value);
    row.querySelectorAll("[data-member-schedule-day]").forEach((button) => {
      const day = Number(button.dataset.memberScheduleDay);
      const selected = String(day) === String(dayInput?.value);
      const allowed = memberScheduleDayAllowed(scope, day);
      button.disabled = !enabled || (!allowed && !selected);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.classList.toggle("is-out-of-scope", selected && !allowed);
    });
    if (enabled && dayInput?.value !== "" && !memberScheduleDayAllowed(scope, selectedDay)) invalidScope = true;
  });
  const warning = panel.querySelector("[data-member-schedule-warning]");
  if (warning) warning.textContent = invalidScope
    ? "회원권의 평일·주말 범위와 기존 요일이 다릅니다. 저장 전 새 요일을 선택해 주세요."
    : "";
}

function syncMemberCreateSchedule(form, product = null) {
  const panel = form?.querySelector("[data-member-create-schedule]");
  if (!panel || !form.elements.createWithoutSchedule) return;
  const selectedProduct = product || (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  const regularProduct = memberManagementProductSupportsRegularSchedule(selectedProduct);
  const scheduleLater = regularProduct && Boolean(form.elements.createScheduleLater?.checked);
  syncMemberQuickEditorSchedule(form, selectedProduct);
  panel.hidden = !regularProduct;
  panel.classList.toggle("is-deferred", scheduleLater);
  form.elements.createWithoutSchedule.value = regularProduct && !scheduleLater ? "false" : "true";
  if (form.elements.createScheduleLater) form.elements.createScheduleLater.disabled = !regularProduct;
  if (!regularProduct) return;
  panel.querySelectorAll("[data-member-schedule-row]").forEach((row) => {
    if (row.hidden) return;
    row.querySelectorAll("input[name^='scheduleDay'], select[name^='scheduleTime'], [data-member-schedule-day]")
      .forEach((control) => { control.disabled = scheduleLater; });
  });
  const warning = panel.querySelector("[data-member-schedule-warning]");
  if (warning && scheduleLater) warning.textContent = "회원과 회원권만 저장한 뒤 시간표에서 정규시간을 설정합니다.";
}

async function refreshScheduleAfterMemberTicketSave() {
  adminLiveScheduleLastRefreshAt = 0;
  if (state.view !== "schedule") return true;
  const refreshed = await refreshAdminLiveSchedule({ force: true });
  if (refreshed) renderSchedule();
  return refreshed;
}

function ensureMemberHasCoachTicket() {
  const memberSelect = $("#lessonMember");
  const coachId = $("#lessonCoach").value;
  if (getEligibleTickets(selectedLessonMemberReference(), coachId).length) return;
  const fallbackMember = findFirstMemberWithCoachTicket(coachId);
  if (fallbackMember) memberSelect.value = fallbackMember;
}

function refreshLessonMemberOptions(keepValue = "", editingLesson = null) {
  const search = $("#lessonMemberSearch").value.trim();
  const keyword = search.toLowerCase();
  const currentValue = keepValue || $("#lessonMember").value;
  const allOptions = getSelectableMembers(search);
  const exactMember = search
    ? allOptions.find((member) => memberSearchValues(member)
      .some((value) => String(value || "").trim().toLowerCase() === keyword))
    : null;
  const options = allOptions.slice(0, search ? 80 : 30);
  if (exactMember && !options.some((member) => member.name === exactMember.name)) options.unshift(exactMember);
  const currentMember = members.find((member) => member.name === currentValue);
  const currentMatchesSearch = currentMember && (!keyword || memberSearchValues(currentMember)
    .some((value) => String(value || "").toLowerCase().includes(keyword)));
  if (!search && currentMember && !options.some((member) => member.name === currentValue)) options.unshift(currentMember);
  const editingParticipantLabel = editingLesson ? getLessonParticipantNames(editingLesson).join(" & ") : "";
  const editingTicket = editingLesson ? getTicketByLesson(editingLesson) : null;
  if (!options.length) {
    fillSelect($("#lessonMember"), [{ value: "", label: search ? "검색 결과 없음" : "선택 가능한 회원 없음" }]);
    $("#lessonMember").value = "";
    return;
  }
  fillSelect(
    $("#lessonMember"),
    [
      { value: "", label: "회원 검색 또는 선택" },
      ...options.map((member) => ({
      value: member.name,
      memberUserId: member.serverUserId || memberServerUserIds(member)[0] || "",
      label: editingParticipantLabel && member.name === currentValue
        ? `현재 수업 · ${editingParticipantLabel}${editingTicket ? ` · ${getTicketOptionLabel(editingTicket)}` : ""}`
        : getMemberOptionLabel(member),
      })),
    ],
  );
  const selectedName = exactMember?.name
    || (currentMatchesSearch && options.some((member) => member.name === currentValue) ? currentValue : "");
  $("#lessonMember").value = selectedName;
}

function ensureLessonMemberOption(memberName, label = "") {
  const select = $("#lessonMember");
  const value = String(memberName || "").trim();
  if (!select || !value || [...select.options].some((option) => option.value === value)) return false;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label || `${value} · 회원권 확인`;
  select.prepend(option);
  select.value = value;
  return true;
}

function syncMakeupEntitlementIdentityLock() {
  const locked = Boolean(selectedAdminMakeupEntitlement());
  ["#lessonMemberSearch", "#lessonMember", "#lessonTicket", "#lessonCoach"].forEach((selector) => {
    const field = $(selector);
    if (field) field.disabled = locked;
  });
  if (locked && $("#lessonTicketHint")) {
    $("#lessonTicketHint").textContent = "선택한 보강 대기의 회원·회원권·담당 코치는 변경할 수 없습니다. 요일과 시간은 직접 선택할 수 있습니다.";
  } else {
    renderLessonTicketHint();
  }
}

// ── forms/members.js 에 있던 것을 합쳤다 (같은 주제인데 파일이 둘로 갈려 있었다) ──
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
    if (memberListStatus(member) === "journal" && state.memberFilter !== "journal") return false;
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
  if (phone && ((phone.required && !phoneDigits) || (phoneDigits && !/^01[0-9]{8,9}$/.test(phoneDigits)))) {
    invalidControl = phone;
    errorText = phoneDigits ? "휴대전화 번호를 010-0000-0000 형식으로 입력해 주세요." : "휴대전화 번호를 입력해 주세요.";
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

function setManualMemberPartnerStatus(form, text = "", tone = "", target = "existing") {
  const selector = target === "new" ? "[data-manual-partner-phone-status]" : "[data-manual-existing-partner-status]";
  const status = form?.querySelector(selector);
  if (!status) return;
  status.hidden = !text;
  status.textContent = text;
  status.className = `form-message${tone ? ` ${tone}` : ""}`;
}

function queueManualMemberPartnerSearch(form, options = {}) {
  if (!form?.elements?.partnerSearch) return;
  const previous = manualMemberPartnerSearchState.get(form);
  if (previous?.timer) window.clearTimeout(previous.timer);
  const query = String(form.elements.partnerSearch.value || "").trim();
  const timer = window.setTimeout(() => {
    searchManualMemberPartnerCandidates(form, options);
  }, options.immediate ? 0 : 250);
  manualMemberPartnerSearchState.set(form, {
    ...(previous || {}),
    query: query.toLowerCase(),
    timer,
  });
}

function syncMemberReenrollSchedule(form, product = null) {
  const panel = form?.querySelector("[data-member-reenroll-schedule]");
  if (!panel || !form.elements.reenrollScheduleMode) return;
  const selectedProduct = product || (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  const regularProduct = memberManagementProductSupportsRegularSchedule(selectedProduct);
  const changeSchedule = regularProduct && form.elements.reenrollScheduleMode.value === "change";
  syncMemberQuickEditorSchedule(form, selectedProduct);
  panel.hidden = !regularProduct;
  const fields = panel.querySelector("[data-member-reenroll-schedule-fields]");
  if (fields) fields.hidden = !changeSchedule;
  panel.querySelectorAll("[data-member-schedule-row]").forEach((row) => {
    if (row.hidden) return;
    row.querySelectorAll("input[name^='scheduleDay'], select[name^='scheduleTime'], [data-member-schedule-day]")
      .forEach((control) => { control.disabled = !changeSchedule; });
  });
  const note = panel.querySelector("[data-member-reenroll-schedule-note]");
  if (note) note.textContent = changeSchedule
    ? `새 회원권의 주 ${memberManagementProductWeeklyFrequency(selectedProduct)}회 요일·시간을 모두 선택해 주세요.`
    : "기존 회원권의 마지막 정규시간을 새 회원권 기간으로 이어갑니다.";
}

function syncMemberManagementPaymentFields(form, options = {}) {
  if (!form?.elements?.paymentRecordState || !form.elements.paymentAmount) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const method = form.elements.paymentMethod?.value || "";
  const overridden = form.dataset.paymentAmountOverride === "true";
  if (options.forcePrice === true && !overridden) {
    form.elements.paymentAmount.value = memberManagementPaymentAmountForMethod(product, method);
  }
  const values = {
    paymentDate: form.elements.paymentDate?.value || "",
    paymentMethod: method,
    paymentAmount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
  };
  const state = memberManagementPaymentStateFromValues(values);
  form.elements.paymentRecordState.value = state;
  const stateLabel = form.querySelector("[data-member-payment-derived-state]");
  if (stateLabel) stateLabel.textContent = memberPaymentRecordStateLabel(state);
  const missing = [];
  if (state === "incomplete") {
    if (!values.paymentDate) missing.push("결제일");
    if (!values.paymentMethod) missing.push("결제수단");
    if (values.paymentAmount <= 0) missing.push("결제금액");
  }
  const missingLabel = form.querySelector("[data-member-payment-missing]");
  if (missingLabel) missingLabel.textContent = missing.length ? `${missing.join(" · ")} 입력 필요` : state === "complete" ? "입력 완료 · 결제 완료로 자동 처리" : "세 항목을 모두 비우면 미결제";
  syncMemberRegistrationSummary(form);
}

function enableMemberManagementPaymentOverride(form) {
  if (!form?.elements?.paymentAmount || form.elements.paymentAmount.disabled) return;
  form.dataset.paymentAmountOverride = "true";
  form.elements.paymentAmount.readOnly = false;
  form.elements.paymentAmount.removeAttribute("aria-readonly");
  const field = form.querySelector("[data-payment-override-reason]");
  const reason = form.elements.paymentOverrideReason;
  if (field) field.hidden = false;
  if (reason) {
    reason.disabled = false;
    reason.required = true;
    reason.focus();
  }
}

function syncMemberRegistrationSummary(form) {
  const summary = form?.querySelector("[data-member-registration-summary]");
  if (!summary) return;
  const product = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const coach = memberManagementCoachRoles({ branchId: product?.branch_id })
    .find((item) => item.id === form.elements.coachRoleId?.value);
  const partnerSelect = form.elements.partnerUserId;
  const partnerName = partnerSelect && !partnerSelect.disabled ? partnerSelect.selectedOptions?.[0]?.textContent?.trim() : "";
  const isGroup = Number(product?.group_size || 1) === 2;
  const schedules = memberInlineScheduleValues(form).map((slot) => `${memberManagementDayLabel(slot.dayOfWeek)} ${slot.startTime}`);
  const paymentState = memberManagementPaymentStateFromValues({
    paymentDate: form.elements.paymentDate?.value || "",
    paymentMethod: form.elements.paymentMethod?.value || "",
    paymentAmount: memberManagementNullableNumber(form.elements.paymentAmount) || 0,
  });
  const primaryName = form.elements.memberName?.value?.trim()
    || members.find((item) => item.id === memberManagementModalState.memberId)?.name
    || "회원";
  summary.innerHTML = `<strong>최종 확인</strong><dl>
    <div><dt>회원</dt><dd>${escapeHtml(isGroup && partnerName ? `${primaryName} · ${partnerName}` : primaryName)}</dd></div>
    <div><dt>회원권</dt><dd>${escapeHtml(product?.name || "선택 필요")}${isGroup ? " · 그룹 2명 연결" : ""}</dd></div>
    <div><dt>코치·일정</dt><dd>${escapeHtml(coach?.display_name || "코치 선택 필요")}${schedules.length ? ` · ${escapeHtml(schedules.join(" / "))}` : " · 시간 선택 필요"}</dd></div>
    <div><dt>기간</dt><dd>${escapeHtml(form.elements.startsOn?.value || "시작일 필요")} ~ ${escapeHtml(form.elements.expiresOn?.value || "자동 계산")}</dd></div>
    <div><dt>결제</dt><dd>${escapeHtml(memberPaymentRecordStateLabel(paymentState))}${paymentState === "complete" ? ` · ${escapeHtml(paymentMethodLabel(form.elements.paymentMethod?.value || ""))} ${money.format(Number(form.elements.paymentAmount?.value) || 0)}원` : ""}</dd></div>
  </dl><small>수정할 항목이 있으면 위 입력칸에서 바로 바꾼 뒤 확정하세요.</small>`;
}

function renderMemberTableViewMode() {
  const simple = state.memberTableView !== "detail";
  const table = $("#memberDirectoryTable");
  table?.classList.toggle("is-simple", simple);
  table?.classList.toggle("is-detail", !simple);
  const button = $("#toggleMemberTableView");
  if (button) {
    button.textContent = simple ? "상세 보기" : "간단 보기";
    button.setAttribute("aria-pressed", String(simple));
    button.title = simple
      ? "코치·기간·결제일 등 운영 상세 열까지 펼칩니다."
      : "회원·앱 연결·회원권·횟수·결제·정산·처리만 표시합니다.";
  }
}
