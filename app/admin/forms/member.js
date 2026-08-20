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
  if (matchingProduct) form.elements.productId.value = matchingProduct.id;
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
  if (memberInlineTicketDefinitionChanged(form) && memberInlineScheduleIsComplete(form, schedules)) {
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
  if (!product) return;
  form.elements.lessonType.value = groupProduct ? "one_on_two" : "one_on_one";
  const productScope = memberManagementProductScheduleScope(product);
  form.elements.scheduleScope.value = productScope;
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
