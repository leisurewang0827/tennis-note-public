// 결제·정산 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function saveBranchPaymentAccount(options = {}) {
  const silent = options.silent === true;
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  const bankName = ($("#salesBranchBankName") || $("#branchBankName"))?.value.trim() || "";
  const accountNumber = ($("#salesBranchBankAccountNumber") || $("#branchBankAccountNumber"))?.value.trim() || "";
  const accountHolder = ($("#salesBranchBankAccountHolder") || $("#branchBankAccountHolder"))?.value.trim() || "";
  const transferInstructions = ($("#salesBranchBankTransferInstructions") || $("#branchBankTransferInstructions"))?.value.trim() || "";
  const enabled = ($("#salesBranchBankTransferEnabled") || $("#branchBankTransferEnabled"))?.checked === true;
  const depositDeadlineHours = Number((
    $("#salesBranchBankDepositDeadlineHours") || $("#branchBankDepositDeadlineHours")
  )?.value || 24);
  const digits = accountNumber.replace(/[^0-9]/g, "");
  if (!client?.rpc || !branchId || !adminApprovalReady()) {
    showToast("관리자 로그인과 운영 지점을 확인해 주세요");
    return false;
  }
  if (bankName.length < 2 || accountHolder.length < 2 || digits.length < 8 || digits.length > 24) {
    showToast("은행명·예금주·계좌번호를 확인해 주세요");
    return false;
  }
  if (!Number.isInteger(depositDeadlineHours) || depositDeadlineHours < 1 || depositDeadlineHours > 168) {
    showToast("입금기한은 1시간부터 168시간 사이로 입력해 주세요");
    return false;
  }
  const payload = {
    bank_name: bankName,
    account_number: accountNumber,
    account_holder: accountHolder,
    transfer_instructions: transferInstructions,
    deposit_deadline_hours: depositDeadlineHours,
    is_enabled: enabled,
    updated_at: new Date().toISOString(),
  };
  const button = $("#saveSalesBranchPaymentAccountButton") || $("#saveBranchPaymentAccountButton");
  if (button) button.disabled = true;
  try {
    const existing = String(branchPaymentAccount?.branch_id || "") === String(branchId);
    const saved = await client.rpc("tn_admin_save_branch_payment_account", {
      target_branch_id: branchId,
      target_bank_name: payload.bank_name,
      target_account_number: payload.account_number,
      target_account_holder: payload.account_holder,
      target_transfer_instructions: payload.transfer_instructions,
      target_deposit_deadline_hours: payload.deposit_deadline_hours,
      target_is_enabled: payload.is_enabled,
      target_expected_revision: existing && Number.isInteger(Number(branchPaymentAccount?.revision))
        ? Number(branchPaymentAccount.revision)
        : null,
    });
    const result = Array.isArray(saved) ? saved[0] || {} : saved || {};
    if (result.ok !== true || String(result.branchId || "") !== String(branchId)) {
      throw new Error("bank_account_write_not_confirmed");
    }
    await loadBranchPaymentAccountFromServer();
    await loadBranchSalesEffectiveOptionsFromServer();
    await loadBankNotificationStatusFromServer();
    if (!silent) {
      showToast(enabled ? "계좌이체 계좌를 서버에 저장하고 회원 결제에 표시했습니다" : "계좌를 저장하고 회원 결제 노출을 껐습니다");
    }
    return true;
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    if (String(code).includes("branch_payment_account_revision_conflict")) {
      await loadBranchPaymentAccountFromServer();
      showToast("다른 관리자가 계좌를 먼저 수정했습니다. 최신 내용을 확인하고 다시 저장해 주세요");
    } else {
      showToast(`계좌 저장 실패: ${code}`);
    }
    return false;
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

function setProductInlineDirtyState(form, dirty = true) {
  if (!form) return;
  form.dataset.dirty = dirty ? "true" : "false";
  form.classList.toggle("is-dirty", dirty);
  form.classList.remove("is-save-error", "is-save-success");
  const message = form.querySelector(".product-inline-message");
  if (message) message.textContent = dirty ? "변경됨" : "";
  const saveAllButton = $("#saveVisibleProductRows");
  if (saveAllButton) {
    saveAllButton.hidden = !document.querySelector('[data-product-inline-form][data-dirty="true"]');
  }
}

async function saveVisibleProductRows() {
  const forms = [...document.querySelectorAll('[data-product-inline-form][data-dirty="true"]')];
  const button = $("#saveVisibleProductRows");
  if (operationsRole() !== "admin" || !forms.length) {
    showToast(forms.length ? "관리자 로그인 후 저장해 주세요." : "변경된 상품이 없습니다.");
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = `저장 중 0/${forms.length}`;
  }
  const results = [];
  let failed = 0;
  for (let index = 0; index < forms.length; index += 1) {
    const form = forms[index];
    const result = await updateMembershipProductSetting(form.dataset.productInlineForm, { refreshAfterSave: false });
    if (result) results.push({ form, result });
    else {
      failed += 1;
      form.classList.add("is-save-error");
      const message = form.querySelector(".product-inline-message");
      if (message) message.textContent = "저장 실패";
    }
    if (button) button.textContent = `저장 중 ${index + 1}/${forms.length}`;
  }
  if (results.length) {
    const synced = await syncAdminLiveData();
    if (!synced) {
      failed += results.length;
      results.forEach(({ form }) => {
        form.classList.add("is-save-error");
        const message = form.querySelector(".product-inline-message");
        if (message) message.textContent = "서버 재확인 실패";
      });
    } else {
      results.forEach(({ form, result }) => {
        if (!savedMembershipProductMatches(result)) {
          failed += 1;
          form.classList.add("is-save-error");
          const message = form.querySelector(".product-inline-message");
          if (message) message.textContent = "저장 확인 필요";
          return;
        }
        setProductInlineDirtyState(form, false);
        form.classList.add("is-save-success");
        const message = form.querySelector(".product-inline-message");
        if (message) message.textContent = "저장 완료";
      });
    }
  }
  if (!failed) {
    renderServiceReadiness();
    showToast(`${forms.length}개 상품 저장·서버 확인 완료`);
  } else {
    showToast(`${forms.length - failed}개 저장 완료 · ${failed}개 확인 필요`);
  }
  if (button?.isConnected) {
    button.disabled = false;
    button.textContent = "현재 페이지 전체 저장";
    button.hidden = !document.querySelector('[data-product-inline-form][data-dirty="true"]');
  }
}

async function runProductBulkAction(forcedAction = "") {
  const selected = membershipProductsForActiveOperationProfile().filter((product) => selectedProductIdSet().has(String(product.id)));
  const action = forcedAction || $("#productBulkAction")?.value || "";
  if (!selected.length || !action) {
    showToast("회원권 상품과 일괄 작업을 선택해 주세요.");
    return;
  }
  const labels = {
    save: "선택 저장",
    delete: "선택 삭제",
    sale: "판매중",
    hidden: "숨김",
    consult: "상담",
  };
  const label = labels[action] || $("#productBulkAction")?.selectedOptions?.[0]?.textContent || "일괄 작업";
  if (!window.confirm(`${selected.length}개 상품을 '${label}' 처리할까요?`)) return;
  const button = action === "save"
    ? $("#saveSelectedProducts")
    : action === "delete"
      ? $("#deleteSelectedProducts")
      : $("#runProductBulkAction");
  if (button) button.disabled = true;
  try {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || operationsRole() !== "admin" || !operationsAccessReady()) throw new Error("admin_required");
    const branchId = activeOperationBranchId();
    if (!branchId) throw new Error("active_branch_required");
    const payload = action === "save"
      ? selected.map(membershipProductBulkSavePayload)
      : selected.map((product) => {
        const serverProduct = serverMembershipProductForDraft(product);
        if (!serverProduct?.id || String(serverProduct.branch_id || "") !== branchId) {
          throw new Error("membership_product_server_mapping_required");
        }
        return { id: serverProduct.id };
      });
    await client.rpc("tn_admin_bulk_membership_product_action", {
      target_branch_id: branchId,
      target_action: action,
      target_products: payload,
      target_reason: action === "delete" ? "관리자 회원권 상품 선택 삭제" : `관리자 회원권 상품 ${label}`,
    });
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_write");
    const savedIds = new Set((adminLiveDataState.products || []).map((product) => String(product.id)));
    if (action === "delete" && payload.some((item) => savedIds.has(String(item.id)))) {
      throw new Error("membership_product_delete_not_confirmed");
    }
    if (action === "save") {
      payload.forEach((item) => {
        const saved = (adminLiveDataState.products || []).find((product) => String(product.id) === String(item.id));
        if (!saved
          || saved.name !== item.name
          || Number(saved.total_sessions) !== item.totalSessions
          || Number(saved.lesson_minutes) !== item.lessonMinutes
          || Number(saved.group_size) !== item.groupSize
          || String(saved.policy_settings?.adminSaleStatus || "") !== item.status) {
          throw new Error("membership_product_bulk_save_not_confirmed");
        }
      });
    }
    if (["sale", "hidden", "consult"].includes(action)) {
      payload.forEach((item) => {
        const saved = (adminLiveDataState.products || []).find((product) => String(product.id) === String(item.id));
        if (!saved || String(saved.policy_settings?.adminSaleStatus || "") !== action) {
          throw new Error("membership_product_status_write_not_confirmed");
        }
      });
    }
    state.selectedMembershipProductIds = [];
    saveSnapshot();
    renderServiceReadiness();
    showToast(`${selected.length}개 상품 ${label}·서버 확인 완료`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.message || ""}`;
    showToast(raw.includes("membership_product_invalid")
      ? "선택한 상품의 필수값과 횟수·기간·가격을 확인해 주세요."
      : raw.includes("PGRST202") || raw.includes("tn_admin_bulk_membership_product_action")
        ? "회원권 다중 작업 DB 기능을 먼저 적용해 주세요."
        : "회원권 상품 다중 작업에 실패했습니다. 서버에서 변경되지 않았습니다.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function saveRefundPolicySettings() {
  Object.assign(refundPolicySettings, normalizeRefundPolicySettings({
    penaltyRate: $("#refundPenaltyRate")?.value,
    reservationFee: $("#refundReservationFee")?.value,
    memo: $("#refundPolicyMemo")?.value,
  }));
  reflectRefundPolicyInActiveVersion();
  const syncTarget = await syncRefundPolicySettingsToServer();
  const policySyncTarget = await syncPolicyVersionsToServer();
  billingLogs.unshift(`환불정책 저장: 할인 전 원가 기준 위약금 ${refundPolicySettings.penaltyRate}%`);
  saveSnapshot();
  renderRefundPolicySettings();
  renderPolicyVersionSettings();
  showToast(syncTarget === "server" && policySyncTarget !== "blocked" ? "환불정책 서버 저장 완료" : syncTarget === "blocked" || policySyncTarget === "blocked" ? "로컬 저장 완료 · 서버 저장 확인 필요" : "환불정책 로컬 저장 완료");
}

async function resetRefundPolicySettings() {
  Object.assign(refundPolicySettings, normalizeRefundPolicySettings());
  reflectRefundPolicyInActiveVersion();
  const syncTarget = await syncRefundPolicySettingsToServer();
  const policySyncTarget = await syncPolicyVersionsToServer();
  billingLogs.unshift("환불정책 기본값 복원");
  saveSnapshot();
  renderRefundPolicySettings();
  renderPolicyVersionSettings();
  showToast(syncTarget === "blocked" || policySyncTarget === "blocked" ? "기본값 복원 완료 · 서버 저장 확인 필요" : "환불정책 기본값 복원 완료");
}

async function issueDiscountCoupons() {
  const client = window.TennisNoteDataClient;
  const policyId = $("#discountIssuePolicy")?.value || "";
  const memberUserId = $("#discountIssueMember")?.value || "";
  const referralUserId = $("#discountIssueReferralMember")?.value || "";
  const note = $("#discountIssueNote")?.value.trim() || "";
  const status = $("#discountIssueStatus");
  const userIds = [...new Set([memberUserId, referralUserId].filter(Boolean))];
  if (!client?.rpc || !adminApprovalReady() || !policyId || !userIds.length) {
    if (status) status.textContent = "할인 정책과 발급 회원을 선택해 주세요.";
    return false;
  }
  const button = $("#issueDiscountCouponButton");
  if (button) button.disabled = true;
  if (status) status.textContent = "서버에 쿠폰을 발급하는 중입니다.";
  try {
    const response = await client.rpc("tn_admin_issue_discount_coupons", {
      target_policy_id: policyId,
      target_user_ids: userIds,
      target_note: note || null,
    });
    const result = Array.isArray(response) ? response[0] || {} : response || {};
    const issuedCount = Number(result.issuedCount ?? result.issued_count ?? 0);
    const skippedCount = Number(result.skippedCount ?? result.skipped_count ?? 0);
    const ineligibleCount = Number(result.ineligibleCount ?? result.ineligible_count ?? 0);
    await loadDiscountPoliciesFromServer();
    const policy = discountPolicies.find((item) => String(item.id) === String(policyId));
    const exclusionSummary = [
      skippedCount ? `중복 ${skippedCount}명 제외` : "",
      ineligibleCount ? `신규회원 아님 ${ineligibleCount}명 제외` : "",
    ].filter(Boolean).join(" · ");
    discountIssueLogs.unshift({
      id: `discount-issue-log-${Date.now()}`,
      text: `${policy?.title || "할인 쿠폰"} ${issuedCount}명 발급${exclusionSummary ? ` · ${exclusionSummary}` : ""}`,
      at: new Date().toLocaleDateString("ko-KR"),
    });
    if (status) status.textContent = `${issuedCount}명 발급 완료${exclusionSummary ? ` · ${exclusionSummary}` : ""}`;
    showToast(status?.textContent || "할인 쿠폰 발급 완료");
    renderServiceReadiness();
    return true;
  } catch (error) {
    if (status) status.textContent = `발급 실패: ${error?.payload?.code || error?.message || "server_error"}`;
    return false;
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function createDiscountPolicy() {
  const title = $("#discountTitleInput")?.value.trim() || "";
  if (!title) {
    showToast("할인권 이름을 입력해주세요");
    return;
  }
  if (!adminApprovalReady() || !window.TennisNoteDataClient?.insertRows || !activeOperationBranchId()) {
    showToast("관리자 로그인과 운영 지점을 확인해 주세요");
    return;
  }
  const policy = normalizeDiscountPolicy({
    title,
    target: $("#discountTargetInput")?.value.trim() || "전체 회원권",
    productScope: $("#discountProductScopeInput")?.value || "all",
    campaignType: $("#discountCampaignTypeInput")?.value || "general",
    type: $("#discountTypeInput")?.value || "percent",
    value: $("#discountValueInput")?.value,
    payment: $("#discountPaymentInput")?.value || "카드/현금",
    coachPermission: $("#discountCoachPermissionInput")?.value || "코치별 지급 수량 안에서 사용",
    coachQuota: $("#discountQuotaInput")?.value,
    expiresDays: $("#discountExpiresInput")?.value,
    burden: $("#discountBurdenInput")?.value || "센터 부담",
    status: "사용",
    branchId: activeOperationBranchId(),
  });
  try {
    const inserted = await window.TennisNoteDataClient.insertRows("tn_discount_policies", discountPolicyServerPayload(policy));
    if (!inserted?.[0]?.id) throw new Error("discount_policy_write_not_confirmed");
    await loadDiscountPoliciesFromServer();
    discountIssueLogs.unshift({ id: `discount-log-${Date.now()}`, text: `${policy.title} 생성`, at: new Date().toLocaleDateString("ko-KR") });
    showToast("할인권을 서버에 생성했습니다");
  } catch (error) {
    showToast(`할인권 생성 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

async function updateDiscountPolicy(policyId) {
  const card = document.querySelector(`[data-discount-card="${policyId}"]`);
  const policy = discountPolicies.find((item) => item.id === policyId);
  if (!card || !policy) return;
  const readField = (field) => card.querySelector(`[data-discount-field="${field}"]`)?.value.trim() || "";
  const nextPolicy = normalizeDiscountPolicy({
    ...policy,
    title: readField("title") || policy.title,
    target: readField("target") || policy.target,
    productScope: readField("productScope") || policy.productScope,
    campaignType: readField("campaignType") || policy.campaignType,
    type: readField("type") || policy.type,
    value: readField("value") || policy.value,
    payment: readField("payment") || policy.payment,
    coachPermission: readField("coachPermission") || policy.coachPermission,
    coachQuota: readField("coachQuota") || policy.coachQuota,
    expiresDays: readField("expiresDays") || policy.expiresDays,
    burden: readField("burden") || policy.burden,
    status: readField("status") || policy.status,
  });
  if (!adminApprovalReady() || !window.TennisNoteDataClient?.updateRows || !policy.serverUpdatedAt) {
    showToast("할인권 서버 정보를 새로고침한 뒤 다시 저장해 주세요");
    return;
  }
  try {
    const updated = await window.TennisNoteDataClient.updateRows("tn_discount_policies", {
      id: policy.id,
      branch_id: activeOperationBranchId(),
      updated_at: policy.serverUpdatedAt,
    }, discountPolicyServerPayload(nextPolicy));
    if (!updated?.length) throw new Error("discount_policy_revision_conflict");
    await loadDiscountPoliciesFromServer();
    showToast("할인권을 서버에 저장했습니다");
  } catch (error) {
    await loadDiscountPoliciesFromServer().catch(() => false);
    showToast(String(error?.message || "").includes("revision_conflict")
      ? "다른 관리자가 먼저 수정했습니다. 최신 값을 불러왔습니다."
      : `할인권 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

async function archiveDiscountPolicy(policyId) {
  const policy = discountPolicies.find((item) => item.id === policyId);
  const client = window.TennisNoteDataClient;
  if (!policy || !adminApprovalReady() || !client?.updateRows || !policy.serverUpdatedAt) return;
  if (!window.confirm(`${policy.title} 할인권을 보관할까요?\n기존 발급·사용 이력은 유지됩니다.`)) return;
  try {
    const updated = await client.updateRows("tn_discount_policies", {
      id: policy.id,
      branch_id: activeOperationBranchId(),
      updated_at: policy.serverUpdatedAt,
    }, { status: "archived" });
    if (!updated?.length) throw new Error("discount_policy_revision_conflict");
    await loadDiscountPoliciesFromServer();
    showToast("할인권을 보관했습니다");
  } catch (error) {
    await loadDiscountPoliciesFromServer().catch(() => false);
    showToast(`할인권 보관 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  }
}

async function setGroupPaymentMode(groupAccountId, mode) {
  const account = groupAccounts.find((item) => item.id === groupAccountId);
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (mode !== "representative" && linkedMembers.length < 2) {
    showToast("두 회원이 모두 앱에 연결된 뒤 사용할 수 있습니다");
    return;
  }
  if (account.serverAccount && window.TennisNoteDataClient?.rpc) {
    const nextPayer = linkedMembers.find((member) => member.name === account.nextPayer) || linkedMembers[0];
    try {
      await window.TennisNoteDataClient.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: mode,
        target_next_payer_user_id: mode === "separate" ? null : nextPayer?.userId || account.nextPayerUserId || null,
      });
      await syncAdminLiveData();
      showToast(`${groupPaymentModeLabel(mode)}로 변경 완료`);
    } catch (error) {
      showToast(`결제 방식 변경 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    }
    return;
  }
  account.paymentMode = mode;
  if (mode !== "separate" && !linkedMembers.some((member) => member.name === account.nextPayer)) {
    account.nextPayer = linkedMembers[0]?.name || account.nextPayer;
  }
  saveSnapshot();
  renderMembers();
  showToast(`${groupPaymentModeLabel(mode)}로 변경 완료`);
}

function updateOnsitePaymentAmount() {
  const product = onsitePaymentProducts().find(({ server }) => String(server.id) === String($("#onsitePaymentProduct")?.value));
  const method = $("#onsitePaymentMethod")?.value || "bank_transfer";
  const amount = Number(method === "card" ? product?.server?.card_price : product?.server?.cash_price) || 0;
  if ($("#onsitePaymentAmount")) $("#onsitePaymentAmount").value = String(Math.max(0, Math.round(amount)));
}

async function submitOnsitePayment(event) {
  event.preventDefault();
  const form = event.currentTarget || $("#onsitePaymentForm");
  const userId = $("#onsitePaymentMember")?.value || "";
  const sourceTicketId = $("#onsitePaymentSourceTicket")?.value || "";
  const productId = $("#onsitePaymentProduct")?.value || "";
  const coachRoleId = $("#onsitePaymentCoach")?.value || "";
  const paymentMethod = $("#onsitePaymentMethod")?.value || "";
  const paymentDate = $("#onsitePaymentDate")?.value || "";
  const paymentAmount = Number($("#onsitePaymentAmount")?.value);
  if (!userId || !productId || !coachRoleId || !paymentDate || !Number.isInteger(paymentAmount) || paymentAmount <= 0) {
    $("#onsitePaymentMessage").textContent = "회원, 회원권 상품, 담당 코치, 결제일, 실제 결제금액을 확인해 주세요.";
    reportAdminPaymentGuard("onsite_validation", "onsite_payment_required_fields");
    return;
  }
  const requestFingerprint = JSON.stringify([
    userId,
    sourceTicketId || null,
    productId,
    coachRoleId,
    paymentMethod,
    paymentDate,
    paymentAmount,
    $("#onsitePaymentStartDate")?.value || null,
    Boolean($("#onsitePaymentKeepSchedule")?.checked),
  ]);
  if (form?.dataset.onsitePaymentRequestFingerprint !== requestFingerprint) {
    form.dataset.onsitePaymentRequestFingerprint = requestFingerprint;
    form.dataset.onsitePaymentOperationKey = createAdminOperationKey("onsite-payment");
  }
  const operationKey = form?.dataset.onsitePaymentOperationKey || createAdminOperationKey("onsite-payment");
  if (form) form.dataset.onsitePaymentOperationKey = operationKey;
  const submit = event.submitter || $("#onsitePaymentForm button[type='submit']");
  submit.disabled = true;
  $("#onsitePaymentMessage").textContent = "현장결제와 회원권을 서버에 저장하고 있습니다.";
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_record_onsite_payment_v3", {
      target_user_id: userId,
      target_source_ticket_id: sourceTicketId || null,
      target_product_id: productId,
      target_coach_role_id: coachRoleId,
      target_payment_method: paymentMethod,
      target_payment_date: paymentDate,
      target_payment_amount: paymentAmount,
      target_starts_on: $("#onsitePaymentStartDate")?.value || null,
      target_keep_schedule: Boolean($("#onsitePaymentKeepSchedule")?.checked),
      target_operation_key: operationKey,
    });
    if (!result?.ok) throw new Error(result?.error || "onsite_payment_not_saved");
    if (String(result.operationKey || "") !== operationKey) throw new Error("onsite_payment_operation_key_not_confirmed");
    const synced = await syncAdminLiveData(true);
    const paymentsLoaded = await loadServerPaymentsIntoBilling({ silent: true, force: true });
    const savedTicketId = String(result.ticketId || result.ticket_id || "");
    const savedPaymentId = String(result.paymentId || result.payment_id || "");
    const savedTicket = [...tickets, ...expiredTickets].find((ticket) => String(ticket.serverTicketId || "") === savedTicketId);
    const savedPayment = billings.find((payment) => String(payment.serverPaymentId || "") === savedPaymentId);
    if (!synced || !paymentsLoaded || !savedTicket || !savedPayment || String(savedPayment.ticketId || "") !== savedTicketId || savedPayment.status !== "paid") {
      throw new Error("onsite_payment_write_not_confirmed");
    }
    delete form.dataset.onsitePaymentOperationKey;
    delete form.dataset.onsitePaymentRequestFingerprint;
    closeOnsitePaymentModal();
    renderBilling();
    showToast("현장결제 기록과 회원권 발급이 저장됐습니다.");
  } catch (error) {
    const raw = String(error?.message || error?.payload?.message || "");
    reportAdminPaymentGuard("onsite_save", raw || "onsite_payment_not_saved", operationKey);
    $("#onsitePaymentMessage").textContent = raw.includes("onsite_payment_write_not_confirmed")
      ? "저장 요청은 전송됐지만 결과를 다시 확인하지 못했습니다. 입력값을 유지했으니 같은 내용으로 다시 시도해 주세요."
      : raw.includes("source_ticket_not_found")
      ? "선택한 기존 회원권을 찾지 못했습니다. 첫 회원권 등록 또는 다른 회원권을 선택해 주세요."
      : raw.includes("onsite_payment_group_partner_required")
        ? "2대1 첫 등록은 파트너 연결이 필요합니다. 회원관리에서 파트너를 먼저 연결해 주세요."
      : raw.includes("onsite_payment_schedule_incompatible")
        ? "상품 형태가 달라 기존 고정시간을 이어갈 수 없습니다. 고정시간 연장을 끄고 다시 저장해 주세요."
      : raw.includes("operation_key_reused_with_different_payload")
        ? "저장 내용이 변경됐습니다. 결제창을 닫았다가 다시 열어 주세요."
      : "저장하지 못했습니다. 회원·상품·권한을 확인해 주세요.";
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

function adminPaymentCancelReady() {
  const client = window.TennisNoteDataClient;
  return Boolean(
    !adminPinNeedsSetup()
    && client?.readiness?.().ready
    && client.getSession?.()?.access_token
    && adminImportAuthState.profile?.role === "admin"
  );
}

function adminPaymentCancelBlockedMessage() {
  const client = window.TennisNoteDataClient;
  if (adminPinNeedsSetup()) return "운영 PIN을 먼저 설정해야 결제취소·환불 위험 작업을 사용할 수 있습니다.";
  if (!client?.readiness?.().ready) return "Supabase 연결값 설정 후 결제취소를 사용할 수 있습니다.";
  if (!client.getSession?.()?.access_token) return "관리자 로그인 후 결제취소할 수 있습니다.";
  if (adminImportAuthState.loading) return "관리자 권한을 확인하는 중입니다.";
  if (adminImportAuthState.user && adminImportAuthState.profile?.role !== "admin") return "관리자 권한 계정만 결제취소할 수 있습니다.";
  return "관리자 권한 확인 후 결제취소할 수 있습니다.";
}

async function executeBillingPaymentCancellation(item, reason) {
  const serverBacked = Boolean(item?.serverPaymentId);
  const localPending = item && ["check", "unverified", "failed"].includes(item.status) && !serverBacked;
  const actionLabel = ["paid", "cancel_reconcile"].includes(item.status) ? "실제 결제취소" : "결제 전 대기취소";
  const cancelAmount = paymentFullCancelAmount(item);
  if (paymentCancelInFlight.has(item.providerPaymentId)) {
    paymentCancelFlowState.message = "같은 결제의 취소 요청이 이미 처리 중입니다.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }
  if (localPending) {
    item.status = "cancelled";
    item.statusLabel = "대기취소";
    item.refundReason = reason;
    item.refundedAt = new Date().toISOString();
    billingLogs.unshift(`${item.member} ${item.item} 대기건 정리: ${reason}`);
    saveSnapshot();
    closePaymentCancelModal();
    renderAll();
    showToast("결제 대기건 정리 완료");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: Supabase 연결값 없음`);
    paymentCancelFlowState.message = "Supabase 연결값을 확인해 주세요.";
    paymentCancelFlowState.tone = "danger";
    renderPaymentCancelModal();
    return;
  }

  paymentCancelFlowState.submitting = true;
  paymentCancelFlowState.message = "PortOne 결제취소와 연결 회원권 비활성화를 처리하고 있습니다.";
  paymentCancelFlowState.tone = "neutral";
  item.statusLabel = "취소처리중";
  billingLogs.unshift(`${item.member} ${item.item} ${actionLabel} 요청`);
  paymentCancelInFlight.add(item.providerPaymentId);
  renderPaymentCancelModal();
  renderAll();

  try {
    const result = await client.invokeFunction("portone-payment/cancel", {
      body: {
        paymentId: item.providerPaymentId,
        amount: cancelAmount,
        reason,
        idempotencyKey: paymentCancelFlowState.idempotencyKey,
      },
    });
    if (result?.ok) {
      item.status = "cancelled";
      item.statusLabel = result.localOnly ? "대기취소" : "결제취소";
      const alreadyCancelled = result?.status === "already_cancelled";
      billingLogs.unshift(`${item.member} ${item.item} 취소 완료: ${alreadyCancelled ? "이미 취소된 결제" : result.localOnly ? "대기건 정리" : "PortOne 취소"}`);
      await loadServerPaymentsIntoBilling({ silent: true, force: true });
      paymentCancelFlowState.submitting = false;
      closePaymentCancelModal();
      showToast(alreadyCancelled ? "이미 취소 완료된 결제입니다" : result.localOnly ? "대기 결제 정리 완료" : "결제 취소 완료");
    } else {
      item.statusLabel = "취소확인필요";
      billingLogs.unshift(`${item.member} ${item.item} 취소 확인 필요: ${result?.code || "unknown"}`);
      paymentCancelFlowState.message = refundErrorText(result?.code || "provider_cancel_failed");
      paymentCancelFlowState.tone = "danger";
    }
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    item.statusLabel = "취소실패";
    billingLogs.unshift(`${item.member} ${item.item} 취소 실패: ${code}`);
    paymentCancelFlowState.message = refundErrorText(code);
    paymentCancelFlowState.tone = "danger";
  } finally {
    paymentCancelInFlight.delete(item.providerPaymentId);
    paymentCancelFlowState.submitting = false;
  }
  renderPaymentCancelModal();
  renderAll();
}

async function cancelBillingPaymentItem(item, itemIndex = billings.indexOf(item)) {
  await openPaymentCancelModal(item, itemIndex);
}

async function revokeBankNotificationDevice(deviceId = "") {
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !deviceId || !adminApprovalReady()) return false;
  if (!window.confirm("이 기기의 입금 알림 연결을 해제할까요? 다시 사용하려면 Android 앱에서 재연결해야 합니다.")) return false;
  try {
    await client.rpc("tn_admin_revoke_bank_notification_device", { target_device_id: deviceId });
    await loadBankNotificationStatusFromServer();
    showToast("입금 알림 기기 연결을 해제했습니다.");
    return true;
  } catch (error) {
    showToast(`기기 연결 해제 실패: ${error?.payload?.code || error?.message || "server_error"}`);
    return false;
  }
}
