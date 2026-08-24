// 회원 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function applyAdminMemberDetail(member, payload) {
  const user = payload?.user || {};
  const enrollment = payload?.enrollment || {};
  const ticket = payload?.ticket || null;
  const product = payload?.product || {};
  const coach = payload?.coach || {};
  if (!member || !user.id) return;
  Object.assign(member, {
    name: user.name || member.name,
    nickname: user.nickname || member.nickname || "",
    phone: user.phone || enrollment.phone || member.phone || "",
    birthYear: user.birth_year || enrollment.birth_year || member.birthYear || "",
    neighborhood: user.neighborhood || enrollment.neighborhood || member.neighborhood || "",
    gender: user.gender || enrollment.gender || member.gender || "",
    photoUrl: user.profile_photo_url || member.photoUrl || "",
    dominantHand: user.dominant_hand || member.dominantHand || "",
    backhandStyle: user.backhand_style || member.backhandStyle || "",
    tennisStartedOn: user.tennis_started_on || member.tennisStartedOn || "",
    selfNtrp: user.self_ntrp || member.selfNtrp || "",
    coachNtrp: user.coach_ntrp || member.coachNtrp || "",
    tennisGoal: user.tennis_goal || enrollment.lesson_goal || member.tennisGoal || "",
    playStyleMemo: user.play_style_memo || member.playStyleMemo || "",
    coach: coach.display_name || member.coach || "",
    authLinked: Boolean(user.auth_user_id || payload?.authLinks?.length),
    enrollment,
    serverDetail: payload,
  });
  const databaseRecord = payload?.databaseRecord || null;
  if (databaseRecord?.user_id) {
    const records = adminLiveDataState.memberDatabaseRecords || [];
    const recordIndex = records.findIndex((item) => String(item.user_id) === String(databaseRecord.user_id));
    if (recordIndex >= 0) records[recordIndex] = databaseRecord;
    else records.push(databaseRecord);
  }
  const ticketItems = Array.isArray(payload?.ticketItems) ? payload.ticketItems : [];
  const membershipRecord = payload?.membershipRecord || null;
  const membershipRecords = [membershipRecord, ...ticketItems.map((item) => item?.membershipRecord)].filter((record) => record?.ticket_id);
  membershipRecords.forEach((record) => {
    const records = adminLiveDataState.memberMembershipRecords || [];
    const recordIndex = records.findIndex((item) => String(item.ticket_id) === String(record.ticket_id));
    if (recordIndex >= 0) records[recordIndex] = record;
    else records.push(record);
  });
  const resolvedTicketItems = ticketItems.length
    ? ticketItems
    : ticket
      ? [{ ticket, product, coach, membershipRecord }]
      : [];
  resolvedTicketItems.forEach((item) => {
    const itemTicket = item?.ticket;
    if (!itemTicket?.id) return;
    const mappedTicket = tickets.find((candidate) => candidate.serverTicketId === itemTicket.id);
    if (!mappedTicket) return;
    const itemProduct = item?.product || {};
    const itemCoach = item?.coach || {};
    const ticketRecord = item?.membershipRecord || databaseRecord;
    Object.assign(mappedTicket, {
      total: Number(itemTicket.total_sessions) || 0,
      used: Number(itemTicket.used_sessions) || 0,
      remaining: Number(itemTicket.remaining_sessions) || 0,
      purchased: itemTicket.starts_on || mappedTicket.purchased,
      expires: itemTicket.expires_on || mappedTicket.expires,
      status: itemTicket.status || mappedTicket.status,
      product: itemProduct.name || mappedTicket.product,
      productId: itemTicket.product_id || mappedTicket.productId,
      coachRoleId: itemTicket.coach_role_id || mappedTicket.coachRoleId,
      coachId: itemCoach.id || mappedTicket.coachId,
      scheduleScope: ticketRecord?.lesson_schedule_scope || mappedTicket.scheduleScope,
      weeklyCount: Number(ticketRecord?.lesson_frequency_per_week) || mappedTicket.weeklyCount,
      lessonTypeCode: ticketRecord?.lesson_type || mappedTicket.lessonTypeCode,
      serverUpdatedAt: itemTicket.updated_at || mappedTicket.serverUpdatedAt || "",
    });
  });
}

async function updateMembershipProductSetting(productId, options = {}) {
  const refreshAfterSave = options.refreshAfterSave !== false;
  const card = document.querySelector(`[data-product-card="${productId}"]`);
  const product = membershipProductDrafts.find((item) => item.id === productId);
  if (!card || !product) return;
  const fieldElement = (field) => card.querySelector(`[data-product-field="${field}"]`);
  const readField = (field) => fieldElement(field)?.value.trim() || "";
  let coachSaleAvailability = { ...(product.coachSaleAvailability || {}) };
  card.querySelectorAll("[data-product-coach-sale]").forEach((input) => {
    coachSaleAvailability[input.dataset.productCoachSale] = input.checked;
  });
  const selectedCoachSaleMode = fieldElement("coachSaleMode")
    ? readField("coachSaleMode")
    : product.coachSaleMode;
  if (selectedCoachSaleMode !== "selected") coachSaleAvailability = {};
  const ticketValue = numericValue(readField("tickets"), product.tickets);
  const cashAmount = numericValue(readField("cashAmount"), product.cashAmount);
  const nextProduct = membershipProductWithOperationalLimits(normalizeMembershipProduct({
    ...product,
    title: readField("title") || product.title,
    name: readField("title") || product.name,
    sessions: readField("sessions") || (fieldElement("tickets") ? `${ticketValue}회` : product.sessions),
    settlementBase: undefined,
    tickets: ticketValue,
    cardAmount: Math.round(cashAmount * 1.1),
    cashAmount,
    validityDays: numericValue(readField("validityDays"), product.validityDays),
    graceDays: numericValue(readField("graceDays"), product.graceDays),
    lessonMinutes: numericValue(readField("lessonMinutes"), product.lessonMinutes),
    groupSize: numericValue(readField("groupSize"), product.groupSize),
    frequencyPerWeek: numericValue(readField("frequencyPerWeek"), product.frequencyPerWeek),
    maxSessionsPerDay: numericValue(readField("maxSessionsPerDay"), product.maxSessionsPerDay),
    maxSessionsPerWeek: numericValue(readField("maxSessionsPerWeek"), product.maxSessionsPerWeek),
    maxBookingDaysPerWeek: numericValue(readField("maxBookingDaysPerWeek"), product.maxBookingDaysPerWeek),
    scheduleScope: readField("scheduleScope") || product.scheduleScope,
    productKind: readField("productKind") || product.productKind,
    discountEnabled: fieldElement("discountEnabled")
      ? readField("discountEnabled") === "yes"
      : product.discountEnabled,
    coachDiscountAllowed: fieldElement("coachDiscountAllowed")
      ? readField("coachDiscountAllowed") === "yes"
      : product.coachDiscountAllowed,
    firstLessonOfferEnabled: fieldElement("firstLessonOfferEnabled")
      ? readField("firstLessonOfferEnabled") === "yes"
      : product.firstLessonOfferEnabled,
    firstLessonOfferPrice: fieldElement("firstLessonOfferPrice")
      ? numericValue(readField("firstLessonOfferPrice"), product.firstLessonOfferPrice)
      : product.firstLessonOfferPrice,
    threeMonthDiscountRate: fieldElement("threeMonthDiscountRate")
      ? Math.max(0, Math.min(90, Number(readField("threeMonthDiscountRate")) || 0))
      : product.threeMonthDiscountRate,
    threeMonthPriceMode: fieldElement("threeMonthPriceMode")
      ? readField("threeMonthPriceMode")
      : product.threeMonthPriceMode,
    coachSaleMode: selectedCoachSaleMode,
    coachSaleAvailability,
    status: readField("status") || product.status,
  }, membershipProductDefaults.find((item) => item.id === product.id)));

  const settlementBase = numericValue(nextProduct.settlementBase, nextProduct.cashAmount);

  const requiredFields = [
    { key: "title", label: "상품명", value: nextProduct.title },
    { key: "sessions", label: "횟수 표기", value: String(nextProduct.sessions || "").trim() },
    { key: "cashAmount", label: "현금가격", value: Number(nextProduct.cashAmount) },
    { key: "cardAmount", label: "카드가격", value: Number(nextProduct.cardAmount) },
    { key: "validityDays", label: "사용기간", value: Number(nextProduct.validityDays) },
    { key: "tickets", label: "충전 횟수", value: Number(nextProduct.tickets) },
    { key: "frequencyPerWeek", label: "주 횟수", value: Number(nextProduct.frequencyPerWeek) },
    { key: "maxSessionsPerDay", label: "하루 최대 사용 회차", value: Number(nextProduct.maxSessionsPerDay) },
    { key: "maxSessionsPerWeek", label: "주간 최대 사용 회차", value: Number(nextProduct.maxSessionsPerWeek) },
    { key: "maxBookingDaysPerWeek", label: "주간 예약 가능 일수", value: Number(nextProduct.maxBookingDaysPerWeek) },
  ];
  const missingRequired = requiredFields.filter((field) => Number(field.value) <= 0 || String(field.value).trim() === "");
  if (missingRequired.length > 0) {
    const firstMissing = requiredFields.find((field) => Number(field.value) <= 0 || String(field.value).trim() === "");
    if (firstMissing) showToast(`${firstMissing.label}를 확인해 주세요.`);
    return;
  }
  if (![20, 30, 40].includes(Number(nextProduct.lessonMinutes))) {
    showToast("수업 시간은 20분, 30분 또는 40분으로 설정해 주세요.");
    return;
  }
  if (Number(nextProduct.maxSessionsPerDay) > Number(nextProduct.maxSessionsPerWeek)) {
    showToast("하루 최대 사용 회차는 주간 최대 사용 회차보다 클 수 없습니다.");
    return;
  }
  if (Number(nextProduct.maxBookingDaysPerWeek) > Number(nextProduct.maxSessionsPerWeek)) {
    showToast("주간 예약 가능 일수는 주간 최대 사용 회차보다 클 수 없습니다.");
    return;
  }
  if (nextProduct.firstLessonOfferEnabled === true
    && (!Number(nextProduct.firstLessonOfferPrice)
      || Number(nextProduct.firstLessonOfferPrice) >= Number(nextProduct.cardAmount))) {
    showToast("첫 수업가는 1원 이상, 카드 정상가보다 낮게 입력해 주세요.");
    return;
  }
  if (nextProduct.status === "sale" && nextProduct.coachSaleMode === "selected"
    && !Object.values(nextProduct.coachSaleAvailability || {}).some((value) => value === true)) {
    showToast("선택한 코치만 표시하려면 판매할 코치를 한 명 이상 선택해 주세요.");
    return;
  }
  const saleIssue = couponProductSaleIssue(nextProduct);
  if (saleIssue && nextProduct.status === "sale") nextProduct.status = "hidden";
  const client = window.TennisNoteDataClient;
  const serverProduct = serverMembershipProductForDraft(product);
  const branchId = activeOperationBranchId();
  const saveButton = card.querySelector("[data-save-product-setting]");
  if (!client?.rpc || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 회원권 상품을 저장해 주세요.");
    return;
  }
  if (!serverProduct?.id) {
    showToast("실서버 상품을 찾지 못했습니다. 새로고침 후 다시 저장해 주세요.");
    return;
  }
  if (!branchId || String(serverProduct.branch_id || "") !== branchId) {
    showToast("현재 운영 지점의 회원권 상품만 수정할 수 있습니다.");
    return;
  }
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중";
  }
  try {
    const serverKind = nextProduct.productKind === "coupon" ? "coupon" : "regular";
    await client.rpc("tn_admin_bulk_membership_product_action", {
      target_branch_id: branchId,
      target_action: "save",
      target_products: [membershipProductServerSavePayload(nextProduct, serverProduct)],
      target_reason: "관리자 회원권 상품 행 저장",
    });
    await client.rpc("tn_admin_save_membership_checkout_policy_v2", {
      target_product_id: serverProduct.id,
      target_three_month_discount_rate: Number(nextProduct.threeMonthDiscountRate ?? 10),
      target_three_month_price_mode: nextProduct.threeMonthPriceMode || "automatic",
      target_coach_sale_mode: nextProduct.coachSaleMode || "all_active",
      target_coach_sale_availability: nextProduct.coachSaleAvailability || {},
    });
    if (!refreshAfterSave) {
      return {
        productId,
        serverId: serverProduct.id,
        expected: nextProduct,
        expectedKind: serverKind,
        expectedSettlementBase: settlementBase,
      };
    }
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => item.id === serverProduct.id);
    if (!saved
      || String(saved.branch_id || "") !== branchId
      || saved.name !== nextProduct.title
      || Number(saved.total_sessions) !== Number(nextProduct.tickets)
      || Number(saved.lesson_minutes) !== Number(nextProduct.lessonMinutes)
      || Number(saved.group_size) !== Number(nextProduct.groupSize)
      || Number(saved.max_sessions_per_day || 0) !== Number(nextProduct.maxSessionsPerDay || 0)
      || Number(saved.max_sessions_per_week || 0) !== Number(nextProduct.maxSessionsPerWeek || 0)
      || Number(saved.max_booking_days_per_week || 0) !== Number(nextProduct.maxBookingDaysPerWeek || 0)
      || saved.schedule_scope !== nextProduct.scheduleScope
      || saved.product_kind !== serverKind
      || String(saved.policy_settings?.adminSaleStatus || "") !== String(nextProduct.status)
      || String(saved.policy_settings?.purchaseExperience || "") !== String(nextProduct.purchaseExperience || "")
      || Boolean(saved.policy_settings?.firstLessonOfferEnabled) !== Boolean(nextProduct.firstLessonOfferEnabled)
      || Number(saved.policy_settings?.firstLessonOfferPrice || 0) !== Number(nextProduct.firstLessonOfferPrice || 0)
      || Number(saved.policy_settings?.threeMonthDiscountRate ?? 10) !== Number(nextProduct.threeMonthDiscountRate ?? 10)
      || String(saved.policy_settings?.threeMonthPriceMode || "automatic") !== String(nextProduct.threeMonthPriceMode || "automatic")
      || Boolean(saved.is_active) !== (nextProduct.status !== "hidden")
      || Number(saved.card_price) !== Number(nextProduct.cardAmount)
      || Number(saved.cash_price) !== Number(nextProduct.cashAmount)
      || Number(saved.settlement_base_price) !== Number(settlementBase)) {
      throw new Error("membership_product_write_not_confirmed");
    }
    saveSnapshot();
    renderServiceReadiness();
    showToast(saleIssue ? `${saleIssue} 판매 상태는 숨김으로 저장했습니다.` : "회원권 상품이 회원 등록 화면까지 반영됐습니다.");
    return true;
  } catch (error) {
    const raw = `${error?.message || ""}`;
    showToast(raw.includes("admin_live_refresh_failed_after_write")
      ? "상품은 저장됐지만 다시 불러오지 못했습니다. 새로고침해 주세요."
      : "회원권 상품 저장에 실패했습니다. 서버 연결과 관리자 권한을 확인해 주세요.");
    return false;
  } finally {
    if (saveButton?.isConnected) {
      saveButton.disabled = false;
      saveButton.textContent = "저장";
    }
  }
}

async function createMembershipProductSetting(options = {}) {
  const oneDay = options.preset === "one_day";
  const client = window.TennisNoteDataClient;
  if (!client?.insertRows || !operationsAccessReady() || operationsRole() !== "admin") {
    showToast("관리자 로그인 후 새 회원권을 만들 수 있습니다.");
    return;
  }
  const branchId = activeOperationBranchId() || defaultOperationBranch()?.id || null;
  if (!branchId) {
    showToast("지점 정보를 찾지 못했습니다. 서버 데이터를 새로고침해 주세요.");
    return;
  }
  const button = $(oneDay ? "#addOneDayProductButton" : "#addMembershipProductButton");
  if (button) {
    button.disabled = true;
    button.textContent = "만드는 중";
  }
  try {
    const productCode = `${oneDay ? "one-day" : "custom"}-${Date.now()}`;
    const rows = await client.insertRows("tn_membership_products", {
      branch_id: branchId,
      product_code: productCode,
      name: oneDay ? "원데이 1회권" : "새 회원권",
      lesson_minutes: 20,
      frequency_per_week: 1,
      max_sessions_per_day: 1,
      max_sessions_per_week: 1,
      max_booking_days_per_week: 1,
      total_sessions: oneDay ? 1 : 4,
      group_size: 1,
      product_kind: oneDay ? "coupon" : "regular",
      is_coupon: oneDay,
      is_active: false,
      schedule_scope: oneDay ? "mixed" : "weekday",
      term_weeks: 0,
      validity_days: oneDay ? 30 : 35,
      grace_days: oneDay ? 0 : 7,
      base_price: oneDay ? 40000 : 0,
      card_price: oneDay ? 44000 : 0,
      cash_price: oneDay ? 40000 : 0,
      settlement_base_price: oneDay ? 40000 : 0,
      discount_enabled: true,
      coach_discount_allowed: false,
      display_order: Math.max(0, ...membershipProductsForActiveOperationProfile().map((item) => Number(item.sortOrder) || 0)) + 10,
      policy_settings: {
        adminSaleStatus: "hidden",
        countLabel: oneDay ? "1회" : "4회",
        ...(oneDay ? {
          purchaseExperience: "one_day",
          firstLessonOfferEnabled: true,
          firstLessonOfferPrice: 15000,
        } : {}),
      },
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("membership_product_create_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const created = membershipProductDrafts.find((item) => item.serverProductCode === productCode || item.id === productCode);
    state.membershipProductSearch = "";
    state.membershipProductStatusFilter = "all";
    state.activeMembershipProductId = created ? String(created.id) : "";
    renderServiceReadiness();
    const card = created ? document.querySelector(`[data-product-card="${CSS.escape(created.id)}"]`) : null;
    if (card) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      card.querySelector('[data-product-field="title"]')?.focus();
    }
    showToast(oneDay
      ? "원데이 1회권 초안을 만들었습니다. 카드 44,000원·현금 40,000원·첫 수업 15,000원을 확인한 뒤 판매 상태를 변경해 주세요."
      : "새 회원권을 만들었습니다. 내용을 입력한 뒤 판매 상태를 변경해 주세요.");
  } catch {
    showToast("새 회원권 생성에 실패했습니다. 관리자 권한과 서버 연결을 확인해 주세요.");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = oneDay ? "원데이 1회권" : "새 회원권";
    }
  }
}

async function moveMembershipProductSetting(productId, direction) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 회원권 순서를 변경할 수 있습니다.");
    return;
  }
  const visibleProducts = membershipProductsForActiveOperationProfile();
  const currentIndex = visibleProducts.findIndex((item) => item.id === productId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleProducts.length) return;
  const nextOrder = [...visibleProducts];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  const serverProducts = nextOrder.map((item) => serverMembershipProductForDraft(item));
  if (serverProducts.some((item) => !item?.id)) {
    showToast("상품 정보를 다시 불러온 뒤 순서를 변경해 주세요.");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !operationsAccessReady()) {
    showToast("서버 연결 후 순서를 변경해 주세요.");
    return;
  }
  const previousDraftOrder = membershipProductDrafts.map((item) => ({ ...item }));
  const branchPositions = membershipProductDrafts
    .map((item, index) => visibleProducts.includes(item) ? index : -1)
    .filter((index) => index >= 0);
  branchPositions.forEach((position, index) => {
    membershipProductDrafts[position] = nextOrder[index];
    membershipProductDrafts[position].sortOrder = (index + 1) * 10;
  });
  renderServiceReadiness();
  try {
    await client.rpc("tn_admin_reorder_membership_products", {
      target_branch_id: serverProducts[0].branch_id,
      target_product_ids: serverProducts.map((item) => item.id),
    });
    const savedOrder = new Map(serverProducts.map((item, index) => [String(item.id), (index + 1) * 10]));
    (adminLiveDataState.products || []).forEach((item) => {
      if (savedOrder.has(String(item.id))) item.display_order = savedOrder.get(String(item.id));
    });
    saveSnapshot();
    showToast("회원권 순서를 변경했습니다.");
  } catch {
    replaceArray(membershipProductDrafts, previousDraftOrder);
    renderServiceReadiness();
    showToast("회원권 순서 변경에 실패했습니다. 서버 권한을 확인해 주세요.");
  }
}

async function updateMembershipProductQuickStatus(productId, nextStatus, control) {
  const allowedStatus = membershipProductStatusOptions.some((option) => option.id === nextStatus);
  const product = membershipProductDrafts.find((item) => String(item.id) === String(productId));
  const serverProduct = serverMembershipProductForDraft(product);
  const previousStatus = normalizeMembershipProduct(product || {}).status;
  if (!allowedStatus || !product || !serverProduct?.id) {
    if (control) control.value = previousStatus;
    showToast("상품 정보를 다시 불러온 뒤 판매 상태를 변경해 주세요.");
    return false;
  }
  if (operationsRole() !== "admin" || !operationsAccessReady()) {
    if (control) control.value = previousStatus;
    showToast("관리자 로그인 후 판매 상태를 변경해 주세요.");
    return false;
  }
  if (String(serverProduct.branch_id || "") !== String(activeOperationBranchId() || "")) {
    if (control) control.value = previousStatus;
    showToast("현재 지점의 상품만 변경할 수 있습니다.");
    return false;
  }
  if (control) control.disabled = true;
  try {
    const rows = await window.TennisNoteDataClient.updateRows("tn_membership_products", {
      id: serverProduct.id,
      branch_id: serverProduct.branch_id,
    }, {
      is_active: nextStatus !== "hidden",
      policy_settings: {
        ...(serverProduct.policy_settings || {}),
        adminSaleStatus: nextStatus,
      },
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("membership_product_status_write_not_confirmed");
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const saved = (adminLiveDataState.products || []).find((item) => String(item.id) === String(serverProduct.id));
    if (!saved
      || Boolean(saved.is_active) !== (nextStatus !== "hidden")
      || String(saved.policy_settings?.adminSaleStatus || "") !== nextStatus) {
      throw new Error("membership_product_status_write_not_confirmed");
    }
    renderServiceReadiness();
    showToast(`판매 상태를 ${membershipProductStatusOptions.find((option) => option.id === nextStatus)?.label || nextStatus}(으)로 변경했습니다.`);
    return true;
  } catch {
    if (control?.isConnected) {
      control.value = previousStatus;
      control.disabled = false;
    }
    showToast("판매 상태 저장에 실패했습니다. 서버 상태를 다시 확인해 주세요.");
    return false;
  }
}

async function forceDeleteMembershipProductSetting(productId) {
  if (operationsRole() !== "admin") {
    showToast("관리자만 회원권 상품을 강제 삭제할 수 있습니다.");
    return;
  }
  const product = membershipProductDrafts.find((item) => item.id === productId);
  if (!product) return;
  const reason = "관리자 회원권 상품 강제 삭제";
  if (!window.confirm(
    `회원권 상품을 강제 삭제할까요?\n\n${product.title || product.name}\n\n기존 회원권은 삭제 상품 기록으로 연결되고 결제 증빙은 유지됩니다.`,
  )) return;

  const serverProduct = serverMembershipProductForDraft(product);
  try {
    if (serverProduct?.id) {
      const branchId = activeOperationBranchId();
      if (!branchId || String(serverProduct.branch_id || "") !== branchId) {
        throw new Error("membership_product_branch_mismatch");
      }
      const client = window.TennisNoteDataClient;
      if (!client?.rpc || !operationsAccessReady()) throw new Error("admin_live_connection_required");
      await client.rpc("tn_admin_force_delete_membership_product", {
        target_product_id: serverProduct.id,
        target_reason: reason,
      });
    }
    if (!deletedMembershipProductIds.includes(product.id)) deletedMembershipProductIds.push(product.id);
    const index = membershipProductDrafts.findIndex((item) => item.id === product.id);
    if (index >= 0) membershipProductDrafts.splice(index, 1);
    if (String(state.activeMembershipProductId) === String(product.id)) state.activeMembershipProductId = "";
    saveSnapshot();
    if (serverProduct?.id) {
      const serverIndex = (adminLiveDataState.products || [])
        .findIndex((item) => String(item.id) === String(serverProduct.id));
      if (serverIndex >= 0) adminLiveDataState.products.splice(serverIndex, 1);
    }
    renderServiceReadiness();
    showToast("회원권 상품 강제 삭제 완료");
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    showToast(raw.includes("tn_admin_force_delete_membership_product") || raw.includes("PGRST202")
        ? "회원권 강제 삭제 DB 패치를 먼저 적용해 주세요."
        : "회원권 상품 강제 삭제에 실패했습니다.");
  }
}

function applyMemberTicketExtensionPreset(button) {
  const form = button?.closest("#memberManagementForm");
  if (!form?.elements?.extendedExpiresOn) return;
  form.elements.extendedExpiresOn.value = addMemberManagementDays(
    form.dataset.currentExpiresOn,
    Number(button.dataset.ticketExtensionDays),
  );
  syncMemberTicketExtensionPreview(form);
}

function setMemberCreateStep(step) {
  const form = $("#memberManagementForm");
  if (!form || memberManagementModalState.action !== "create") return;
  const nextStep = step === 2 ? 2 : 1;
  memberManagementModalState.createStep = nextStep;
  [...form.querySelectorAll("[data-member-create-panel]")].forEach((panel) => {
    panel.hidden = Number(panel.dataset.memberCreatePanel) !== nextStep;
  });
  [...form.querySelectorAll("[data-member-create-step-indicator]")].forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.memberCreateStepIndicator);
    indicator.classList.toggle("is-active", indicatorStep === nextStep);
    indicator.classList.toggle("is-done", indicatorStep < nextStep);
  });
  const previous = form.querySelector("[data-member-create-previous]");
  const next = form.querySelector("[data-member-create-next]");
  const submit = form.querySelector("[data-member-create-submit]");
  if (previous) previous.hidden = nextStep === 1;
  if (next) next.hidden = nextStep === 2;
  if (submit) submit.hidden = nextStep !== 2;
  const heading = form.querySelector(`[data-member-create-panel="${nextStep}"] input, [data-member-create-panel="${nextStep}"] select`);
  window.setTimeout(() => heading?.focus(), 0);
}

function applyMemberManagementProductDefaults(form, allLiveData = adminLiveDataState) {
  const product = (allLiveData.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || !form) return;
  const total = Number(product.total_sessions) || 1;
  const start = memberManagementDate(form.elements.startsOn?.value);
  const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
  form.elements.totalSessions.value = total;
  form.elements.usedSessions.value = 0;
  form.elements.remainingSessions.value = total;
  form.elements.expiresOn.value = addMemberManagementDays(start, validityDays - 1);
  if (form.elements.paymentAmount) form.elements.paymentAmount.value = Number(product.cash_price || product.card_price || 0);
  const productScope = memberManagementProductScheduleScope(product);
  if (form.elements.scheduleScope) {
    form.elements.scheduleScope.value = productScope;
  }
  if (form.elements.weeklyFrequency) form.elements.weeklyFrequency.value = memberManagementProductWeeklyFrequency(product);
  if (form.elements.lessonType) form.elements.lessonType.value = Number(product.group_size || 1) === 2 ? "one_on_two" : "one_on_one";
  syncMemberManagementScopeFields(form);
  syncManualMemberPartnerField(form);
  syncMemberCreateSchedule(form, product);
}

async function submitMemberManagementForm(event) {
  event.preventDefault();
  const form = event.target;
  const member = members.find((item) => item.id === memberManagementModalState.memberId);
  const action = memberManagementModalState.action;
  const isCreate = action === "create";
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === memberManagementModalState.ticketId) || null;
  const client = window.TennisNoteDataClient;
  const message = $("#memberManagementMessage");
  const submit = form.querySelector("button[type='submit']");
  if ((!isCreate && !member?.serverUserId) || !client?.rpc || !memberManagementActionAllowed(action, ticket)) {
    if (message) message.textContent = "현재 계정에는 이 작업 권한이 없습니다.";
    return;
  }
  if (action === "force_delete" && !memberManagementModalState.forceDeletePreview?.ok) {
    if (message) message.textContent = memberManagementModalState.forceDeletePreviewError || "삭제 영향을 먼저 확인해 주세요.";
    return;
  }
  if (action === "close" && !memberManagementModalState.closePreview?.ok) {
    if (message) message.textContent = memberManagementModalState.closePreviewError || "종료할 회원권과 미래 수업을 먼저 확인해 주세요.";
    return;
  }
  if (!validateRequiredMemberProfile(form, message)) return;

  syncMemberManagementBalance(form);
  const reason = action === "close"
    ? String(form.elements.closeReason?.value || "").trim()
    : automaticMemberManagementReason(action);
  const managementPayload = action === "extend"
    ? {
      userId: member?.serverUserId || null,
      ticketId: ticket?.serverTicketId || null,
      expiresOn: form.elements.extendedExpiresOn?.value || null,
    }
    : ["create", "assign", "profile", "correct"].includes(action)
      ? memberManagementDatabasePayload(form, isCreate ? null : member, ticket, reason)
      : null;
  const selectedManagementProduct = (adminLiveDataState.products || [])
    .find((item) => item.id === form.elements.productId?.value);
  if (managementPayload && ["create", "assign", "correct"].includes(action)) {
    normalizeMemberManagementTicketPayload(managementPayload);
  }
  const createRegularSchedules = isCreate ? memberInlineScheduleValues(form) : [];
  if (managementPayload && action === "profile") {
    // Profile, note, and partner edits must never recalculate or replace a fixed schedule.
    managementPayload.preserveExistingSchedule = true;
  }
  const statusAction = form.elements.memberStatusAction?.value || "keep";

  if (form.elements.lessonType) {
    const total = memberManagementNullableNumber(form.elements.totalSessions);
    const used = memberManagementNullableNumber(form.elements.usedSessions);
    const remaining = memberManagementNullableNumber(form.elements.remainingSessions);
    if (total !== null && used !== null && used > total) {
      if (message) message.textContent = "소진 회차는 총 회차보다 클 수 없습니다.";
      return;
    }
    if ([total, used, remaining].every((value) => value !== null) && used + remaining !== total) {
      if (message) message.textContent = "잔여 회차 자동 계산값을 확인해 주세요.";
      return;
    }
    const activeRecord = isCreate || action === "assign" || form.elements.recordStatus?.value === "active";
    const selectedProduct = selectedManagementProduct;
    const couponProduct = selectedProduct?.is_coupon === true || selectedProduct?.product_kind === "coupon";
    const requiredLessonDays = Math.max(1, Number(form.elements.weeklyFrequency?.value) || 1);
    const selectedLessonDays = memberManagementSelectedDays(form);
    const createsWithoutSchedule = form.elements.createWithoutSchedule?.value === "true";
    if (isCreate && activeRecord && !createsWithoutSchedule && memberManagementProductSupportsRegularSchedule(selectedProduct)) {
      const completeSchedule = memberInlineScheduleIsComplete(form, createRegularSchedules);
      const uniqueScheduleCount = new Set(createRegularSchedules.map((slot) => `${slot.dayOfWeek}:${slot.startTime}`)).size;
      const scope = memberManagementProductScheduleScope(selectedProduct);
      if (!completeSchedule || createRegularSchedules.length !== requiredLessonDays) {
        if (message) message.textContent = `주 ${requiredLessonDays}회 정규 요일과 시간을 모두 선택해 주세요.`;
        return;
      }
      if (uniqueScheduleCount !== createRegularSchedules.length) {
        if (message) message.textContent = "같은 요일과 시간을 중복 선택할 수 없습니다.";
        return;
      }
      if (createRegularSchedules.some((slot) => !memberScheduleDayAllowed(scope, slot.dayOfWeek))) {
        if (message) message.textContent = "회원권의 평일·주말 이용 범위에 맞는 요일을 선택해 주세요.";
        return;
      }
      managementPayload.lessonDays = createRegularSchedules.map((slot) => slot.dayOfWeek);
    } else if (!isCreate && activeRecord && !createsWithoutSchedule && !couponProduct && (selectedLessonDays.length < 1 || selectedLessonDays.length > requiredLessonDays)) {
      if (message) message.textContent = `주 ${requiredLessonDays}회 회원권은 레슨 요일을 1개부터 ${requiredLessonDays}개까지 선택해 주세요. 같은 날 연속 수업도 가능합니다.`;
      return;
    }
    if (form.elements.lessonType.value === "one_on_two") {
      const newPartner = isCreate && form.elements.partnerMode?.value === "new";
      if (newPartner && String(form.elements.partnerName?.value || "").trim().length < 2) {
        if (message) message.textContent = "같이 등록할 파트너 실명을 두 글자 이상 입력해 주세요.";
        return;
      }
      if (!newPartner && !form.elements.partnerUserId?.value) {
        if (message) message.textContent = "기존 회원 중 연결할 1:2 파트너를 선택해 주세요.";
        return;
      }
    }
    const paymentAmount = memberManagementNullableNumber(form.elements.paymentAmount) || 0;
    const paymentDate = form.elements.paymentDate?.value || "";
    const paymentMethod = form.elements.paymentMethod?.value || "";
    const paymentRecordState = form.elements.paymentRecordState?.value || memberPaymentRecordState({
      payment_recorded_on: paymentDate,
      payment_method: paymentMethod,
      payment_amount: paymentAmount,
    });
    if (paymentRecordState === "complete" && (paymentAmount <= 0 || !paymentDate || !paymentMethod)) {
      if (message) message.textContent = "결제 완료는 결제일자, 결제수단, 1원 이상의 결제금액을 모두 입력해 주세요.";
      return;
    }
    if (paymentRecordState === "unentered" && (paymentAmount > 0 || paymentDate || paymentMethod)) {
      if (message) message.textContent = "결제값을 입력했다면 결제 구분을 결제 완료로 바꿔 주세요.";
      return;
    }
    normalizeMemberManagementPaymentPayload(managementPayload);
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = "처리 중";
  }
  if (message) message.textContent = "";

  try {
    let result = null;
    let linkedSourceSignupUserId = "";
    let linkedTargetMemberUserId = "";
    if (isCreate) {
      const createOperationKey = form.dataset.createOperationKey || createMemberChangeBatchId();
      form.dataset.createOperationKey = createOperationKey;
      result = await client.rpc("tn_admin_create_member_and_regular_schedule", {
        target_record: managementPayload,
        target_schedules: managementPayload.createWithoutSchedule ? [] : createRegularSchedules,
        target_operation_key: createOperationKey,
      });
      state.memberFilter = "active";
    } else if (action === "assign") {
      const existingPaymentId = managementPayload?.existingPaymentId || "";
      const assignmentRequestId = form.dataset.assignmentRequestId || createMemberChangeBatchId();
      form.dataset.assignmentRequestId = assignmentRequestId;
      const assignmentPayload = existingPaymentId
        ? { ...managementPayload, assignmentRequestId, paymentAmount: 0, paymentDate: null, paymentMethod: null }
        : { ...managementPayload, assignmentRequestId };
      result = await client.rpc("tn_admin_assign_member_database_ticket", {
        target_record: assignmentPayload,
      });
      if (existingPaymentId) {
        const linkedPayment = await client.rpc("tn_admin_link_existing_payment_to_ticket", {
          target_payment_id: existingPaymentId,
          target_ticket_id: result?.ticketId || result?.ticket_id,
        });
        if (!linkedPayment?.ok) throw new Error(linkedPayment?.code || "existing_payment_link_failed");
      }
      state.memberFilter = "active";
    } else if (action === "link_existing") {
      linkedTargetMemberUserId = form.elements.targetMembershipUserId?.value || "";
      if (!linkedTargetMemberUserId) throw new Error("membership_link_target_required");
      result = await client.rpc("tn_admin_replace_member_login", {
        target_member_user_id: linkedTargetMemberUserId,
        source_signup_user_id: member.serverUserId,
        target_reason: reason,
      });
    } else if (action === "profile") {
      const birthYearValue = String(form.elements.memberBirthYear?.value || "").trim();
      const selfNtrpValue = String(form.elements.memberSelfNtrp?.value || "").trim();
      const coachNtrpValue = String(form.elements.memberCoachNtrp?.value || "").trim();
      result = await client.rpc("tn_admin_update_member_profile_full", {
        target_user_id: member.serverUserId,
        target_name: form.elements.memberName.value.trim(),
        target_nickname: form.elements.memberNickname.value.trim(),
        target_phone: form.elements.memberPhone.value.trim(),
        target_birth_year: birthYearValue ? Number(birthYearValue) : null,
        target_neighborhood: form.elements.memberNeighborhood.value.trim(),
        target_gender: form.elements.memberGender.value || null,
        target_dominant_hand: form.elements.memberDominantHand.value || null,
        target_backhand_style: form.elements.memberBackhandStyle.value || null,
        target_tennis_started_on: form.elements.memberTennisStartedOn.value || null,
        target_self_ntrp: selfNtrpValue ? Number(selfNtrpValue) : null,
        target_coach_ntrp: coachNtrpValue ? Number(coachNtrpValue) : null,
        target_tennis_goal: form.elements.memberTennisGoal.value.trim(),
        target_play_style_memo: form.elements.memberPlayStyleMemo.value.trim(),
      });
    } else if (action === "app_link") {
      const sourceSignupUserId = form.elements.sourceSignupUserId?.value || "";
      if (!sourceSignupUserId) throw new Error("source_signup_not_linked");
      linkedSourceSignupUserId = sourceSignupUserId;
      result = await client.rpc("tn_admin_replace_member_login", {
        target_member_user_id: member.serverUserId,
        source_signup_user_id: sourceSignupUserId,
        target_reason: reason,
      });
    } else if (action === "extend") {
      const nextExpiresOn = form.elements.extendedExpiresOn?.value || "";
      if (!ticket?.serverTicketId || !nextExpiresOn || nextExpiresOn <= String(ticket.expires || "")) {
        throw new Error("member_ticket_extension_date_must_increase");
      }
      let expectedUpdatedAt = String(ticket.serverUpdatedAt || "");
      if (!expectedUpdatedAt) {
        const revisionResponse = await client.rpc("tn_admin_member_ticket_revision", {
          target_ticket_id: ticket.serverTicketId,
        });
        expectedUpdatedAt = String(revisionResponse?.updatedAt || revisionResponse?.updated_at || "");
      }
      if (!expectedUpdatedAt) throw new Error("member_ticket_expected_updated_at_required");
      result = await client.rpc("tn_admin_extend_member_ticket_period", {
        target_ticket_id: ticket.serverTicketId,
        target_expires_on: nextExpiresOn,
        target_expected_updated_at: expectedUpdatedAt,
        target_reason: reason,
      });
      window.TennisNoteScheduleRevision?.notify?.(ticket.branchId);
    } else if (action === "correct") {
      result = operationsRole() === "admin"
        ? await client.rpc("tn_admin_update_member_record_with_payment", {
          target_record: managementPayload,
        })
        : await client.rpc("tn_update_member_ticket_lifecycle", {
          target_ticket_id: ticket.serverTicketId,
          target_total_sessions: Number(form.elements.totalSessions.value),
          target_used_sessions: Number(form.elements.usedSessions.value),
          target_remaining_sessions: Number(form.elements.remainingSessions.value),
          target_starts_on: form.elements.startsOn.value,
          target_expires_on: form.elements.expiresOn.value,
          target_schedule_scope: form.elements.scheduleScope.value,
          target_status: form.elements.ticketStatus.value,
          target_reason: reason,
        });
    } else if (action === "expire") {
      result = await client.rpc("tn_expire_member_ticket", {
        target_ticket_id: ticket.serverTicketId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "close") {
      result = await client.rpc("tn_admin_close_member_ticket_and_future_lessons", {
        target_user_id: member.serverUserId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "force_delete") {
      result = await client.rpc("tn_admin_force_delete_member_ticket", {
        target_ticket_id: ticket.serverTicketId,
        target_reason: reason,
      });
      state.memberFilter = "expired";
    } else if (action === "permanent_delete") {
      result = await client.rpc("tn_admin_permanently_delete_inactive_member", {
        target_user_id: member.serverUserId,
      });
      state.memberFilter = "inactive";
      state.selectedMemberId = null;
    } else if (action === "reenroll") {
      result = await client.rpc("tn_reenroll_member_database_ticket", {
        target_source_ticket_id: ticket.serverTicketId,
        target_product_id: form.elements.productId.value,
        target_coach_role_id: form.elements.coachRoleId.value,
        target_total_sessions: Number(form.elements.totalSessions.value),
        target_used_sessions: Number(form.elements.usedSessions.value),
        target_remaining_sessions: Number(form.elements.remainingSessions.value),
        target_starts_on: form.elements.startsOn.value,
        target_expires_on: form.elements.expiresOn.value,
        target_purchased_price: Number(form.elements.purchasedPrice.value),
        target_reason: reason,
      });
      state.memberFilter = "active";
    } else if (["deactivate", "restore"].includes(action)) {
      result = await client.rpc("tn_set_member_operational_status", {
        target_user_id: member.serverUserId,
        target_status: action === "deactivate" ? "inactive" : "active",
        target_reason: reason,
      });
      state.memberFilter = action === "deactivate" ? "inactive" : "expired";
    }

    window.TennisNoteInputGuard?.markSaved?.("#memberManagementModal");
    closeMemberManagementModal();

    const requiresFullRefresh = ["create", "assign", "close", "force_delete", "permanent_delete"].includes(action);
    const synced = requiresFullRefresh
      ? await syncAdminLiveData(true)
      : await loadAdminMemberDetail(member, { force: true, renderResult: false });
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    if (linkedSourceSignupUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(member.serverUserId));
      if (!linkedMember?.authLinked) throw new Error("member_login_link_not_confirmed");
    }
    if (linkedTargetMemberUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(linkedTargetMemberUserId));
      if (!linkedMember?.authLinked) throw new Error("member_login_link_not_confirmed");
    }
    const verificationError = memberManagementWriteVerification(action, managementPayload, result, statusAction);
    if (verificationError) throw new Error(verificationError);
    const normalizedResult = normalizedRpcResult(result);
    if (action === "link_existing" && linkedTargetMemberUserId) {
      const linkedMember = members.find((item) => memberServerUserIds(item).includes(linkedTargetMemberUserId));
      state.selectedMemberId = linkedMember?.id || null;
      state.memberFilter = linkedMember ? memberListStatus(linkedMember) : "active";
    } else if ((isCreate || action === "assign") && normalizedResult.userId) {
      state.selectedMemberId = members.find((item) => item.serverUserId === normalizedResult.userId)?.id || null;
    } else if (member?.serverUserId) {
      const refreshedMember = members.find((item) => memberServerUserIds(item).includes(member.serverUserId));
      if (refreshedMember) {
        state.selectedMemberId = refreshedMember.id;
        state.memberFilter = memberListStatus(refreshedMember);
      }
    }
    $$("[data-member-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.memberFilter === state.memberFilter));
    renderMembers();
    if (isCreate) {
      const createdTicketId = normalizedResult.ticketId || result?.ticket_id || "";
      const createdTicket = tickets.find((item) => item.serverTicketId === createdTicketId);
      if (normalizedResult.scheduleCreated) {
        state.scheduleEditMode = false;
        showToast("회원·회원권·정규시간표 등록 완료");
      } else if (normalizedResult.scheduleDeferred && memberManagementProductSupportsRegularSchedule(selectedManagementProduct)) {
        state.pinnedLessonTicketId = createdTicket?.id || "";
        state.scheduleEditMode = true;
        setView("schedule");
        showToast("회원권 등록 완료 · 시간표에서 첫 수업을 선택해 주세요.");
      } else {
        showToast("회원·회원권 등록 완료");
      }
    } else {
      showToast(`${memberManagementActionLabel(action)} 완료`);
    }
  } catch (error) {
    memberManagementModalState.message = memberManagementErrorText(error);
    if (message) message.textContent = memberManagementModalState.message;
    showToast(memberManagementModalState.message);
    if (submit) {
      submit.disabled = false;
      submit.textContent = action === "profile"
        ? "기본정보 저장"
        : action === "app_link"
          ? "앱 계정 연결"
          : `${memberManagementActionLabel(action)} 확정`;
    }
  }
}

function setMemberAdminEditEnabled(enabled) {
  memberAdminEditEnabled = Boolean(enabled);
  memberAdminEditExpiresAt = memberAdminEditEnabled ? Date.now() + memberAdminEditTimeoutMs : 0;
  state.inlineMemberId = null;
  state.inlineMemberTicketId = "";
  renderMembers();
  showToast(memberAdminEditEnabled ? "회원 수정 잠금을 해제했습니다." : "회원 수정을 잠갔습니다.");
}

function createMemberChangeBatchId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function restoreFailedMemberInlineDrafts(drafts = []) {
  drafts.forEach((draft) => {
    const ticketSelector = draft.ticketId
      ? `[data-ticket-id="${CSS.escape(draft.ticketId)}"]`
      : '[data-ticket-id=""]';
    const form = document.querySelector(`[data-member-inline-form="${draft.memberId}"]${ticketSelector}`)
      || document.querySelector(`[data-member-inline-form="${draft.memberId}"]`);
    if (!form) return;
    if (form.elements.productId && draft.values.productId !== undefined) {
      form.elements.productId.value = draft.values.productId;
      syncMemberQuickEditorProduct(form);
    }
    memberInlineDraftFieldNames.forEach((name) => {
      if (name === "productId" || draft.values[name] === undefined || !form.elements[name]) return;
      form.elements[name].value = draft.values[name];
    });
    syncMemberQuickEditorSchedule(form);
    if (form.elements.totalSessions && form.elements.usedSessions) syncMemberManagementBalance(form);
    setMemberInlineDirtyState(form, true);
    form.classList.add("is-save-error");
    const message = form.querySelector(".member-inline-message");
    if (message) message.textContent = "저장하지 못한 입력값을 유지했습니다. 오류를 확인한 뒤 다시 저장해 주세요.";
    updateMemberInlineToolbar();
  });
}

async function saveMemberManagementPolicySettings() {
  if (!adminApprovalReady()) {
    showToast("관리자 계정으로 로그인해 주세요");
    return;
  }
  const target = $("#memberManagementPolicySettings");
  const policy = {};
  target?.querySelectorAll("[data-member-policy]").forEach((input) => {
    policy[input.dataset.memberPolicy] = input.checked;
  });
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_save_member_management_policy", {
      target_policy: policy,
    });
    Object.assign(memberManagementPolicy, normalizeMemberManagementPolicy(result || policy));
    renderMemberManagementPolicySettings();
    renderMembers();
    showToast("회원관리 권한 저장 완료");
  } catch {
    showToast("권한 저장 실패 · 관리자 권한과 DB 적용을 확인해 주세요");
  }
}

function exportVisibleMembers(allMembers = members) {
  const visibleMembers = filteredMembers();
  const bodyRows = visibleMembers.flatMap((member) => {
    const memberTickets = memberOperationalTickets(member);
    return (memberTickets.length ? memberTickets : [null]).map((ticket) => {
      const record = memberDatabaseRecord(member, ticket);
      const payment = ticket ? null : latestMemberPayment(member);
      return [
        member.name,
        member.phone || "",
        member.birthYear || "",
        member.neighborhood || "",
        memberGenderLabel(member.gender),
        ticket?.coach || member.coach,
        memberManagementLessonMethodLabel(record, ticket),
        memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
        memberManagementLessonDaysLabel(record, ticket),
        record?.lesson_start_on || ticket?.actualLessonStart || ticket?.purchased || "",
        record?.total_sessions ?? ticket?.total ?? "",
        record?.used_sessions ?? ticket?.used ?? "",
        record?.remaining_sessions ?? ticket?.remaining ?? "",
        record?.payment_recorded_on || payment?.paidAt || payment?.verifiedAt || "",
        record ? paymentMethodLabel(record.payment_method) : paymentMethodLabel(payment?.method),
        record?.payment_amount ?? payment?.finalAmount ?? payment?.amount ?? "",
        record ? record.admin_note || "" : member.note || "",
      ];
    });
  });
  const rows = [["이름", "전화번호", "출생년도", "거주동", "성별", "레슨강사", "레슨방식", "레슨종류", "레슨요일", "레슨시작일", "총회차", "소진회차", "잔여회차", "결제일자", "결제수단", "결제금액", "비고"], ...bodyRows];
  downloadRowsAsCsv(`tennis-note-allMembers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast(`${visibleMembers.length}명 · 회원권 ${bodyRows.length}행을 내보냈습니다`);
}

async function saveMemberTicketLessonSetup(button) {
  const ticketId = button?.dataset.saveTicketLessonSetup || "";
  const setup = button?.closest("[data-ticket-lesson-setup]");
  const groupSize = Number(setup?.querySelector("[data-ticket-group-size]")?.value || 1);
  const durationMinutes = Number(setup?.querySelector("[data-ticket-duration-minutes]")?.value || 20);
  const partnerUserId = groupSize === 2
    ? setup?.querySelector("[data-ticket-partner-user]")?.value || ""
    : null;
  const client = window.TennisNoteDataClient;
  if (!ticketId || !setup || setup.dataset.ticketOwnerView !== "true" || !client?.rpc || !adminApprovalReady()) {
    showToast("관리자 로그인과 이용권 정보를 확인해주세요");
    return;
  }
  if (groupSize === 2 && !partnerUserId) {
    showToast("2대1 수업은 파트너를 선택해주세요");
    return;
  }

  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "저장 중";
  try {
    await client.rpc("tn_admin_update_ticket_lesson_setup", {
      target_ticket_id: ticketId,
      target_group_size: groupSize,
      target_lesson_minutes: durationMinutes,
      target_partner_user_id: partnerUserId || null,
    });
    await syncAdminLiveData();
    showToast(`${groupSize === 2 ? "2대1 그룹" : "개인 1대1"} · ${durationMinutes}분 설정 완료`);
  } catch (error) {
    showToast(memberTicketLessonSetupError(error));
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

async function runMemberBulkAction() {
  const selectedMembers = members.filter((member) => selectedMemberIdSet().has(Number(member.id)) && memberServerUserIds(member).length);
  const selectedUserIds = [...new Set(selectedMembers.flatMap(memberServerUserIds))];
  const action = $("#memberBulkAction")?.value || "";
  if (!selectedMembers.length || !action) {
    showToast("회원과 일괄 작업을 선택해 주세요.");
    return;
  }
  const actionLabel = $("#memberBulkAction")?.selectedOptions?.[0]?.textContent || "일괄 작업";
  if (!window.confirm(`${selectedMembers.length}명에게 '${actionLabel}' 작업을 적용할까요?`)) return;
  const button = $("#runMemberBulkAction");
  if (button) button.disabled = true;
  try {
    if (action === "permanent_delete") {
      const eligibleMembers = selectedMembers.filter((member) => (
        member.serverUserId
        && memberListStatus(member) === "inactive"
        && member.authRole !== "admin"
      ));
      if (eligibleMembers.length !== selectedMembers.length) {
        throw new Error("permanent_delete_inactive_members_only");
      }
      const failedMemberIds = [];
      for (const member of eligibleMembers) {
        try {
          await window.TennisNoteDataClient.rpc("tn_admin_permanently_delete_inactive_member", {
            target_user_id: member.serverUserId,
          });
        } catch (error) {
          failedMemberIds.push(Number(member.id));
        }
      }
      await syncAdminLiveData(true);
      const deletedServerIds = new Set(eligibleMembers
        .filter((member) => !failedMemberIds.includes(Number(member.id)))
        .map((member) => String(member.serverUserId)));
      const unconfirmedIds = members
        .filter((member) => deletedServerIds.has(String(member.serverUserId)))
        .map((member) => Number(member.id));
      const remainingIds = [...new Set([...failedMemberIds, ...unconfirmedIds])];
      state.selectedMemberIds = remainingIds;
      renderMembers();
      if (remainingIds.length) {
        showToast(`${eligibleMembers.length - remainingIds.length}명 영구 삭제 · ${remainingIds.length}명 확인 필요`);
      } else {
        showToast(`${eligibleMembers.length}명 영구 삭제 완료`);
      }
      return;
    }
    if (action === "reenroll") {
      const productId = $("#memberBulkRenewalProduct")?.value || "";
      const paymentMethod = $("#memberBulkRenewalPaymentMethod")?.value || "";
      const paymentDate = $("#memberBulkRenewalPaymentDate")?.value || "";
      const startsOn = $("#memberBulkRenewalStartDate")?.value || null;
      const keepSchedule = Boolean($("#memberBulkRenewalKeepSchedule")?.checked);
      if (!productId || !["card", "bank_transfer"].includes(paymentMethod) || !paymentDate) {
        throw new Error("bulk_reenrollment_fields_required");
      }
      let processedCount = 0;
      const failedRows = [];
      for (const [batchIndex, userIds] of chunkedValues(selectedUserIds).entries()) {
        const result = await window.TennisNoteDataClient.rpc("tn_admin_bulk_reenroll_members", {
          target_user_ids: userIds,
          target_product_id: productId,
          target_payment_method: paymentMethod,
          target_payment_date: paymentDate,
          target_starts_on: startsOn,
          target_keep_schedule: keepSchedule,
          target_operation_key: `${createAdminOperationKey("member-bulk-reenroll")}-${batchIndex + 1}`,
        });
        processedCount += Number(result?.processedCount ?? result?.processed_count ?? 0);
        if (Array.isArray(result?.failed)) failedRows.push(...result.failed);
      }
      const resultNode = $("#memberBulkRenewalResult");
      if (resultNode) {
        resultNode.classList.toggle("is-error", Boolean(failedRows.length));
        resultNode.textContent = failedRows.length
          ? `${processedCount}명 완료 · ${failedRows.length}명 확인 필요: ${failedRows.map((row) => row.name || row.reason || "확인 필요").join(", ")}`
          : `${processedCount}명 재등록과 회원권 연장이 완료되었습니다.`;
      }
      await syncAdminLiveData(true);
      state.selectedMemberIds = failedRows.length
        ? members.filter((member) => failedRows.some((row) => String(row.userId || row.user_id) === String(member.serverUserId))).map((member) => Number(member.id))
        : [];
      renderMembers();
      showToast(failedRows.length ? `${processedCount}명 완료 · ${failedRows.length}명 확인 필요` : `${processedCount}명 일괄 재등록 완료`);
      return;
    }
    let processedCount = 0;
    let ticketCount = 0;
    let pendingMemberCount = 0;
    let skippedCount = 0;
    for (const userIds of chunkedValues(selectedUserIds)) {
      const result = await window.TennisNoteDataClient.rpc("tn_admin_bulk_member_action", {
        target_user_ids: userIds,
        target_action: action,
        target_coach_role_id: null,
        target_reason: `관리자 회원 목록 · ${actionLabel}`,
      });
      processedCount += Number(result?.processedCount ?? result?.processed_count ?? 0);
      ticketCount += Number(result?.ticketCount ?? result?.ticket_count ?? 0);
      pendingMemberCount += Number(result?.pendingMemberCount ?? result?.pending_member_count ?? 0);
      skippedCount += Number(result?.skippedCount ?? result?.skipped_count ?? 0);
    }
    if (!processedCount) throw new Error("bulk_member_no_changes");
    await syncAdminLiveData();
    state.selectedMemberIds = [];
    renderMembers();
    if (action === "expire_tickets") {
      const details = [
        ticketCount ? `회원권 ${ticketCount}건` : "회원권 없음",
        pendingMemberCount ? `가입대기 ${pendingMemberCount}명` : "",
        skippedCount ? `확인 필요 ${skippedCount}명` : "",
      ].filter(Boolean).join(" · ");
      showToast(`${processedCount}명 만료회원 전환 완료 · ${details}`);
    } else {
      showToast(`${processedCount}명 일괄 처리 완료${skippedCount ? ` · ${skippedCount}명 확인 필요` : ""}`);
    }
  } catch (error) {
    const message = `${error?.message || ""}`;
    showToast(message.includes("tn_admin_bulk_member_action") || message.includes("PGRST202")
      ? "회원 일괄 처리 DB 패치를 먼저 적용해 주세요."
      : message.includes("bulk_member_no_changes")
        ? "변경된 회원이 없습니다. 회원 연결 상태를 확인해 주세요."
      : message.includes("permanent_delete_inactive_members_only")
        ? "삭제회원만 영구 삭제할 수 있습니다. 선택한 회원 상태를 확인해 주세요."
      : "회원 일괄 처리에 실패했습니다. 권한과 회원 상태를 확인해 주세요.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

function updateMemberInlineToolbar() {
  const dirtyCount = dirtyMemberInlineForms().length;
  const saveAllButton = $("#saveVisibleMemberRows");
  if (saveAllButton) {
    saveAllButton.hidden = !memberAdminEditEnabled || dirtyCount === 0;
    if (!saveAllButton.disabled) saveAllButton.textContent = `변경 ${dirtyCount}건 저장`;
  }
  const stateTarget = $("#memberEditorModeSaveState");
  if (stateTarget) stateTarget.textContent = !memberAdminEditEnabled
    ? "잠김"
    : dirtyCount ? `저장 대기 ${dirtyCount}건` : "저장 완료";
  const changedButton = $("#showChangedMemberRows");
  const failedButton = $("#showFailedMemberRows");
  if (changedButton) changedButton.hidden = !memberAdminEditEnabled;
  if (failedButton) failedButton.hidden = !memberAdminEditEnabled
    || !document.querySelector("[data-member-inline-form].is-save-error");
  applyMemberInlineRowFilter();
}

function setMemberInlineDirtyState(form, dirty = true) {
  if (!form) return;
  if (dirty) touchMemberAdminEditSession();
  form.dataset.dirty = dirty ? "true" : "false";
  form.classList.toggle("is-dirty", dirty);
  if (dirty) form.classList.remove("is-save-error", "is-save-success");
  const message = form.querySelector(".member-inline-message");
  if (dirty && message && !message.classList.contains("is-error")) {
    message.textContent = "변경됨";
    message.classList.remove("is-success");
  }
  updateMemberInlineToolbar();
}

function applyMemberInlineRowFilter() {
  document.querySelectorAll("[data-member-inline-form]").forEach((form) => {
    const row = form.closest("tr");
    if (!row) return;
    const visible = memberInlineRowFilter === "all"
      || (memberInlineRowFilter === "changed" && form.dataset.dirty === "true")
      || (memberInlineRowFilter === "failed" && form.classList.contains("is-save-error"));
    row.hidden = !visible;
  });
  $("#showChangedMemberRows")?.classList.toggle("is-active", memberInlineRowFilter === "changed");
  $("#showFailedMemberRows")?.classList.toggle("is-active", memberInlineRowFilter === "failed");
}

async function submitMemberInlineEditor(form, options = {}) {
  const refreshAfterSave = options.refreshAfterSave !== false;
  const member = members.find((item) => item.id === Number(form.dataset.memberInlineForm));
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form.dataset.ticketId);
  const message = form.querySelector(".member-inline-message");
  const submit = form.querySelector("button[type='submit']");
  if (!member?.serverUserId || operationsRole() !== "admin") return;
  if (!validateRequiredMemberProfile(form, message)) {
    form.classList.add("is-save-error");
    return false;
  }
  syncMemberQuickEditorProduct(form);
  syncMemberInlineProductCancellation(form);
  const selectedProduct = (adminLiveDataState.products || []).find((item) => item.id === form.elements.productId?.value);
  const paymentChanged = memberInlinePaymentChanged(form);
  if (ticket || selectedProduct) syncMemberManagementBalance(form);
  const total = selectedProduct ? memberManagementNullableNumber(form.elements.totalSessions) : null;
  const used = selectedProduct ? memberManagementNullableNumber(form.elements.usedSessions) : null;
  if (selectedProduct && (total === null || used === null || total <= 0 || used < 0 || used > total)) {
    message.textContent = "총 회차와 소진 회차를 확인해 주세요.";
    message.classList.add("is-error");
    return;
  }
  if (selectedProduct && (!form.elements.startsOn?.value || !form.elements.expiresOn?.value
    || form.elements.startsOn.value > form.elements.expiresOn.value)) {
    message.textContent = "회원권 시작일과 만료일을 확인해 주세요.";
    message.classList.add("is-error");
    return false;
  }
  const ticketPeriodReview = selectedProduct
    ? memberManagementTicketPeriodReview(selectedProduct, form.elements.startsOn?.value, form.elements.expiresOn?.value)
    : null;
  if (Number(selectedProduct?.group_size || 1) === 2 && !form.elements.partnerUserId?.value) {
    message.textContent = "2대1 회원권은 파트너를 선택해 주세요.";
    message.classList.add("is-error");
    form.classList.add("is-save-error");
    return false;
  }
  const paymentAmount = memberManagementNullableNumber(form.elements.paymentAmount) || 0;
  const paymentDate = form.elements.paymentDate?.value || "";
  const paymentMethod = form.elements.paymentMethod?.value || "";
  const paymentRecordState = form.elements.paymentRecordState?.value || memberPaymentRecordState({
    payment_recorded_on: paymentDate,
    payment_method: paymentMethod,
    payment_amount: paymentAmount,
  });
  if (paymentChanged && paymentRecordState === "complete" && (paymentAmount <= 0 || !paymentDate || !paymentMethod)) {
    message.textContent = "결제 완료는 결제일자, 결제수단, 1원 이상의 결제금액을 모두 입력해 주세요.";
    message.classList.add("is-error");
    return false;
  }
  if (paymentChanged && paymentRecordState === "unentered" && (paymentAmount > 0 || paymentDate || paymentMethod)) {
    message.textContent = "결제값을 입력했다면 결제 구분을 결제 완료로 바꿔 주세요.";
    message.classList.add("is-error");
    return false;
  }
  const regularSchedules = memberInlineScheduleValues(form);
  const scheduleSlotsChanged = Boolean(ticket && selectedProduct
    && String(selectedProduct.product_kind || "regular") === "regular")
    && memberInlineScheduleChanged(form, regularSchedules);
  const ticketDefinitionChanged = memberInlineTicketDefinitionChanged(form);
  const applyFutureRequested = form.elements.applyToFutureSchedule?.value === "true";
  const scheduleReplacementRequested = Boolean(ticket && selectedProduct
    && String(selectedProduct.product_kind || "regular") === "regular"
    && applyFutureRequested
    && (scheduleSlotsChanged || ticketDefinitionChanged));
  if (memberInlineCoachChanged(form) && !scheduleReplacementRequested) {
    message.textContent = "코치 변경은 새 코치의 요일·시간을 함께 선택해야 합니다.";
    message.classList.add("is-error");
    form.classList.add("is-save-error");
    return false;
  }
  if (scheduleReplacementRequested) {
    const scheduleScope = memberManagementProductScheduleScope(selectedProduct);
    const requiredScheduleCount = memberRegularScheduleFrequency(selectedProduct, ticket);
    const invalidSchedule = regularSchedules.find((slot) => (
      !memberScheduleDayOrder.includes(slot.dayOfWeek)
      || !/^\d{2}:\d{2}$/.test(slot.startTime)
      || !memberScheduleDayAllowed(scheduleScope, slot.dayOfWeek)
    ));
    const duplicateSchedule = new Set(regularSchedules.map((slot) => `${slot.dayOfWeek}:${slot.startTime}`)).size !== regularSchedules.length;
    if (invalidSchedule || duplicateSchedule || regularSchedules.length !== requiredScheduleCount) {
      message.textContent = duplicateSchedule
        ? "같은 요일·시간을 두 번 선택할 수 없습니다."
        : invalidSchedule
          ? "회원권 범위에 맞는 요일과 시간을 확인해 주세요."
          : `정규시간을 직접 바꾸려면 ${requiredScheduleCount}개를 모두 선택해 주세요. 시간표에서 등록할 예정이면 모두 비운 채 저장할 수 있습니다.`;
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
    if (!form.elements.coachRoleId?.value) {
      message.textContent = "시간표를 변경하려면 담당 코치를 먼저 선택해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
  }
  const reason = "관리자 회원표 수정";
  const payload = memberManagementDatabasePayload(form, member, ticket, reason);
  normalizeMemberManagementTicketPayload(payload);
  payload.paymentChanged = paymentChanged;
  if (paymentChanged) {
    normalizeMemberManagementPaymentPayload(payload);
  } else {
    delete payload.paymentDate;
    delete payload.paymentMethod;
    delete payload.paymentAmount;
    delete payload.paymentRecordState;
    delete payload.existingPaymentId;
  }
  if (ticket && !form.elements.productId?.value) {
    payload.productId = ticket.productId || null;
    payload.ticketStatus = "expired";
    payload.recordStatus = "historical";
    payload.usedSessions = Number(payload.totalSessions) || 0;
    payload.remainingSessions = 0;
  }
  if (selectedProduct) {
    const selectedGroupSize = Number(selectedProduct.group_size || 1);
    payload.lessonType = selectedGroupSize === 2 ? "one_on_two" : "one_on_one";
    payload.partnerUserId = selectedGroupSize === 2
      ? form.elements.partnerUserId?.value || null
      : null;
    const selectedProductScope = memberManagementProductScheduleScope(selectedProduct);
    payload.scheduleScope = selectedProductScope;
    payload.weeklyFrequency = memberManagementProductWeeklyFrequency(
      selectedProduct,
      memberRegularScheduleFrequency(selectedProduct, ticket),
    );
  }
  if (scheduleReplacementRequested) payload.lessonDays = regularSchedules.map((slot) => slot.dayOfWeek);
  payload.preserveExistingSchedule = true;
  payload.applyToFutureSchedule = scheduleReplacementRequested;
  payload.changeBatchId = form.dataset.changeBatchId || createMemberChangeBatchId();
  payload.changeSource = "admin_web";
  if (!ticket) {
    const overlapTicket = memberRenewalOverlapForPayload(member, payload);
    if (overlapTicket) {
      message.textContent = "같은 코치·같은 회원권의 기간이 겹칩니다. 기존권 만료 다음 날부터 시작하도록 날짜를 수정해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
  }
  if (ticket && !payload.expectedTicketUpdatedAt) {
    message.textContent = "최신 회원권 정보를 확인하는 중입니다.";
    message.classList.remove("is-error");
    const revisionResponse = await window.TennisNoteDataClient.rpc("tn_admin_member_ticket_revision", {
      target_ticket_id: ticket.serverTicketId,
    }).catch(() => null);
    const revision = String(revisionResponse?.updatedAt || revisionResponse?.updated_at || "");
    if (!revision) {
      message.textContent = "최신 회원권 정보를 확인하지 못했습니다. 새로고침 후 다시 저장해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      return false;
    }
    payload.expectedTicketUpdatedAt = revision;
    ticket.serverUpdatedAt = revision;
    if (form.elements.expectedTicketUpdatedAt) form.elements.expectedTicketUpdatedAt.value = revision;
  }
  if (!options.skipConfirmation) {
    const scopeText = payload.applyToFutureSchedule ? "미래 정규시간 다시 만들기" : "회원권만 저장 · 기존 시간표 유지";
    const periodWarning = ticketPeriodReview?.isShorter
      ? `\n주의: 입력한 이용기간 ${ticketPeriodReview.actualDays}일이 상품 기본 ${ticketPeriodReview.expectedDays}일보다 짧습니다. 의도한 단축 등록인지 확인해 주세요.`
      : "";
    if (!window.confirm(`${memberInlineChangeSummary(form)}\n적용 범위: ${scopeText}${periodWarning}\n서버에 저장할까요?`)) return false;
  }
  submit.disabled = true;
  submit.textContent = "저장 중";
  message.textContent = "서버에 저장하고 확인하는 중입니다.";
  message.classList.remove("is-error", "is-success");
  let saveResult = null;
  try {
    if (ticket) {
      saveResult = scheduleReplacementRequested
        ? await window.TennisNoteDataClient.rpc("tn_admin_update_member_record_and_regular_schedule", {
          target_record: payload,
          target_schedules: regularSchedules,
          target_operation_key: createAdminOperationKey("member-schedule"),
        })
        : await window.TennisNoteDataClient.rpc("tn_admin_update_member_record_with_payment", {
          target_record: payload,
        });
    } else if (payload.productId) {
      const product = (adminLiveDataState.products || []).find((item) => item.id === payload.productId);
      if (!product) throw new Error("membership_product_not_found");
      const startsOn = payload.startsOn || adminLocalDateKey(new Date());
      const validityDays = Math.max(1, Number(product.validity_days || 1) + Number(product.grace_days || 0));
      payload.startsOn = startsOn;
      payload.expiresOn = payload.expiresOn || addMemberManagementDays(startsOn, validityDays - 1);
      payload.totalSessions = Number(payload.totalSessions) || Number(product.total_sessions) || 1;
      payload.usedSessions = Number(payload.usedSessions) || 0;
      payload.remainingSessions = Math.max(0, payload.totalSessions - payload.usedSessions);
      const productScope = memberManagementProductScheduleScope(product);
      payload.scheduleScope = productScope;
      payload.weeklyFrequency = memberManagementProductWeeklyFrequency(product);
      payload.lessonType = Number(product.group_size || 1) === 2 ? "one_on_two" : "one_on_one";
      payload.recordStatus = payload.remainingSessions === 0 ? "historical" : "active";
      payload.ticketStatus = payload.remainingSessions === 0 ? "expired" : "active";
      saveResult = await window.TennisNoteDataClient.rpc("tn_admin_assign_member_database_ticket_resolving_stale", {
        target_record: payload,
      });
    } else {
      await window.TennisNoteDataClient.rpc("tn_admin_update_member_profile_full", {
        target_user_id: member.serverUserId,
        target_name: payload.name,
        target_nickname: payload.nickname || "",
        target_phone: payload.phone || "",
        target_birth_year: payload.birthYear,
        target_neighborhood: payload.neighborhood || "",
        target_gender: payload.gender,
        target_dominant_hand: payload.dominantHand,
        target_backhand_style: payload.backhandStyle,
        target_tennis_started_on: payload.tennisStartedOn,
        target_self_ntrp: payload.selfNtrp,
        target_coach_ntrp: payload.coachNtrp,
        target_tennis_goal: payload.tennisGoal || "",
        target_play_style_memo: payload.playStyleMemo || "",
      });
    }
    if (!refreshAfterSave) {
      message.textContent = "저장됨";
      message.classList.add("is-success");
      form.classList.remove("is-dirty", "is-save-error");
      form.classList.add("is-save-success");
      form.dataset.dirty = "false";
      submit.disabled = false;
      submit.textContent = ticket ? "이 회원권 저장" : "새 회원권 등록";
      return {
        ok: true,
        ticketId: String(saveResult?.ticketId || saveResult?.ticket_id || ticket?.serverTicketId || ""),
        ticketUpdatedAt: String(saveResult?.ticketUpdatedAt || saveResult?.ticket_updated_at || ""),
      };
    }
    const synced = await syncAdminLiveData(true);
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    await refreshScheduleAfterMemberTicketSave();
    const refreshedMember = members.find((item) => item.serverUserId === member.serverUserId);
    const savedTicketId = String(saveResult?.ticketId || saveResult?.ticket_id || ticket?.serverTicketId || "");
    const refreshed = savedTicketId
      ? [...tickets, ...expiredTickets].find((item) => String(item.serverTicketId || "") === savedTicketId)
      : refreshedMember ? memberCurrentTicket(refreshedMember) : null;
    if (!refreshedMember || refreshedMember.name !== payload.name) {
      throw new Error("member_inline_profile_write_not_confirmed");
    }
    if ((ticket || payload.productId) && !memberManagementTicketMatchesPayload(refreshed, payload, { verifyPayment: payload.paymentChanged !== false })) {
      throw new Error("member_inline_write_not_confirmed");
    }
    if (scheduleReplacementRequested && refreshedMember) {
      const refreshedSlots = memberRegularScheduleSlots(refreshedMember, refreshed)
        .slice(0, regularSchedules.length)
        .map((slot) => ({ dayOfWeek: Number(slot.dayOfWeek), startTime: String(slot.startTime || "").slice(0, 5) }));
      const expectedSlots = [...regularSchedules].sort((left, right) => (
        memberScheduleDayOrder.indexOf(left.dayOfWeek) - memberScheduleDayOrder.indexOf(right.dayOfWeek)
        || left.startTime.localeCompare(right.startTime)
      ));
      if (JSON.stringify(refreshedSlots) !== JSON.stringify(expectedSlots)) {
        throw new Error("member_schedule_write_not_confirmed");
      }
    }
    message.textContent = payload.ticketStatus === "expired"
      ? "서버 저장 완료 · 만료회원 반영 확인"
      : payload.productId ? "서버 저장 완료 · 수강중 반영 확인" : "기본정보 서버 저장 완료";
    message.classList.add("is-success");
    form.classList.remove("is-dirty", "is-save-error");
    form.classList.add("is-save-success");
    form.dataset.dirty = "false";
    showToast(`${member.name} 회원권 저장 완료`);
    renderMembers();
    return true;
  } catch (error) {
    const raw = String(error?.message || error?.payload?.message || "");
    if (ticket?.serverTicketId && payload.changeBatchId) {
      const safeErrorCode = [
        "member_ticket_revision_conflict",
        "member_ticket_expected_updated_at_required",
        "ticket_not_found",
        "active_product_required",
        "group_partner_required",
        "member_active_ticket_exists",
        "member_ticket_renewal_overlap_forbidden",
        "member_ticket_overlap_confirmation_required",
        "member_ticket_exact_duplicate",
      ].find((code) => raw.includes(code)) || "member_inline_save_failed";
      void window.TennisNoteDataClient.rpc("tn_admin_log_member_inline_failure", {
        target_ticket_id: ticket.serverTicketId,
        target_change_batch_id: payload.changeBatchId,
        target_error_code: safeErrorCode,
      }).catch(() => false);
    }
    if (raw.includes("member_ticket_revision_conflict")) {
      message.textContent = "다른 사용자가 먼저 수정했습니다. 입력값은 유지했습니다. 서버 최신값을 확인한 뒤 다시 저장해 주세요.";
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      updateMemberInlineToolbar();
      submit.disabled = false;
      submit.textContent = "다시 저장";
      return false;
    }
    if (raw.includes("member_ticket_overlap_confirmation_required") || raw.includes("member_ticket_exact_duplicate")) {
      submit.disabled = false;
      submit.textContent = "회원권 등록";
      message.textContent = memberManagementErrorText(error);
      message.classList.add("is-error");
      form.classList.add("is-save-error");
      updateMemberInlineToolbar();
      return false;
    }
    if (raw.includes("member_active_ticket_exists") || raw.includes("member_verified_pending_ticket_exists")) {
      const synced = await syncAdminLiveData(true).catch(() => false);
      if (synced) {
        state.inlineMemberId = member.id;
        state.inlineMemberTicketId = String(ticket?.serverTicketId || "");
        renderMembers();
        showToast(raw.includes("member_verified_pending_ticket_exists")
          ? "결제가 확인된 대기 회원권이 있습니다. 결제/정산에서 연결 상태를 확인해 주세요."
          : "사용 중인 회원권이 있습니다. 표시된 회원권을 수정하거나 만료 처리해 주세요.");
        return false;
      }
    }
    message.textContent = memberManagementErrorText(error);
    message.classList.add("is-error");
    form.classList.add("is-save-error");
    updateMemberInlineToolbar();
    submit.disabled = false;
    submit.textContent = "다시 저장";
    return false;
  }
}

async function saveVisibleMemberRows() {
  const allForms = [...document.querySelectorAll("[data-member-inline-form]")];
  const forms = allForms.filter((form) => form.dataset.dirty === "true");
  const button = $("#saveVisibleMemberRows");
  if (operationsRole() !== "admin") return;
  if (!forms.length) {
    showToast("변경된 행이 없습니다.");
    return;
  }
  const summaries = forms.slice(0, 8).map((form) => memberInlineChangeSummary(form));
  const extra = forms.length > summaries.length ? `\n외 ${forms.length - summaries.length}건` : "";
  if (!window.confirm(`현재 페이지 회원권 ${forms.length}건의 변경사항을 저장합니다.\n\n${summaries.join("\n")}${extra}\n\n실패한 행은 입력값을 유지합니다.`)) return;
  const changeBatchId = createMemberChangeBatchId();
  forms.forEach((form) => {
    form.dataset.changeBatchId = changeBatchId;
  });
  if (button) {
    button.disabled = true;
    button.textContent = `저장 중 0/${forms.length}`;
  }
  let saved = 0;
  let failed = 0;
  const failedDrafts = [];
  const groupedForms = new Map();
  forms.forEach((form) => {
    const key = form.dataset.ticketId ? `ticket:${form.dataset.ticketId}` : `member:${form.dataset.memberInlineForm}`;
    if (!groupedForms.has(key)) groupedForms.set(key, []);
    groupedForms.get(key).push(form);
  });
  const formGroups = [...groupedForms.values()];
  const propagateTicketRevision = (ticketId, updatedAt) => {
    if (!ticketId || !updatedAt) return;
    document.querySelectorAll(`[data-member-inline-form][data-ticket-id="${CSS.escape(ticketId)}"]`).forEach((targetForm) => {
      if (targetForm.elements.expectedTicketUpdatedAt) targetForm.elements.expectedTicketUpdatedAt.value = updatedAt;
    });
  };
  let nextGroupIndex = 0;
  const saveNextGroup = async () => {
    while (nextGroupIndex < formGroups.length) {
      const group = formGroups[nextGroupIndex];
      nextGroupIndex += 1;
      for (const form of group) {
        const draft = memberInlineDraft(form);
        const result = await submitMemberInlineEditor(form, {
          refreshAfterSave: false,
          skipConfirmation: true,
        });
        if (result) {
          saved += 1;
          propagateTicketRevision(result.ticketId, result.ticketUpdatedAt);
        } else {
          failed += 1;
          failedDrafts.push(draft);
        }
        if (button) button.textContent = `저장 중 ${saved + failed}/${forms.length}`;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, formGroups.length) }, () => saveNextGroup()));
    if (saved) {
      const synced = await syncAdminLiveData(true);
      if (!synced) throw new Error("admin_live_refresh_failed_after_write");
      await loadAdminMemberDirectoryPage({ force: true, render: false });
      renderMembers();
      await refreshScheduleAfterMemberTicketSave();
    }
    if (!failed) {
      if (!saved) renderMembers();
      showToast(`${saved}명 현재 페이지 저장 완료`);
    } else {
      restoreFailedMemberInlineDrafts(failedDrafts);
      showToast(`${saved}명 저장 완료 · ${failed}명 실패 행만 다시 확인해 주세요.`);
    }
  } catch {
    showToast(`${saved}명 저장 완료 · 서버 재조회에 실패했습니다. 저장 결과를 다시 확인해 주세요.`);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      updateMemberInlineToolbar();
    }
  }
}
