// 서버(Supabase)에서 결제·정산 데이터를 가져오는 함수들.
//
// 서버에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function loadBranchPaymentAccountFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.selectRows || !branchId || !adminApprovalReady()) return false;
  branchPaymentAccountStatus = "loading";
  try {
    const rows = await client.selectRows("tn_branch_payment_accounts", {
      select: "branch_id,bank_name,account_number,account_holder,transfer_instructions,deposit_deadline_hours,revision,is_enabled,retired_at,updated_at",
      filters: { branch_id: branchId },
      limit: 1,
    });
    branchPaymentAccount = rows?.[0] || { branch_id: branchId, is_enabled: false };
    branchPaymentAccountStatus = "loaded";
    if (state.view === "settings") {
      renderPaymentSetup();
      renderBranchSalesSetup();
    }
    return true;
  } catch (error) {
    branchPaymentAccount = null;
    branchPaymentAccountStatus = "failed";
    if (state.view === "settings") {
      renderPaymentSetup();
      renderBranchSalesSetup();
    }
    console.warn("[Tennis Note] branch payment account unavailable", error?.message || error);
    return false;
  }
}

async function loadBankNotificationStatusFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !client?.selectRows || !branchId || !adminApprovalReady()) return false;
  bankNotificationStatusState.status = "loading";
  bankNotificationStatusState.message = "";
  try {
    const [statusResponse, accountHistory] = await Promise.all([
      client.rpc("tn_admin_bank_notification_status", { target_branch_id: branchId }),
      client.selectRows("tn_branch_payment_account_history", {
        select: "id,branch_id,revision,action,bank_name,account_number,account_holder,deposit_deadline_hours,is_enabled,created_at",
        filters: { branch_id: branchId },
        order: "revision.desc",
        limit: 8,
      }),
    ]);
    const status = Array.isArray(statusResponse) ? statusResponse[0] || {} : statusResponse || {};
    bankNotificationStatusState.status = "loaded";
    bankNotificationStatusState.devices = Array.isArray(status.devices) ? status.devices : [];
    bankNotificationStatusState.reviewEvents = Array.isArray(status.reviewEvents) ? status.reviewEvents : [];
    bankNotificationStatusState.accountHistory = Array.isArray(accountHistory) ? accountHistory : [];
    if (state.view === "settings") {
      renderPaymentSetup();
      renderBranchSalesSetup();
    }
    return true;
  } catch (error) {
    bankNotificationStatusState.status = "failed";
    bankNotificationStatusState.message = error?.payload?.code || error?.message || "server_error";
    bankNotificationStatusState.devices = [];
    bankNotificationStatusState.reviewEvents = [];
    bankNotificationStatusState.accountHistory = [];
    if (state.view === "settings") {
      renderPaymentSetup();
      renderBranchSalesSetup();
    }
    return false;
  }
}

async function loadServerPaymentsIntoBilling(options = {}) {
  const silent = Boolean(options.silent);
  const force = Boolean(options.force);
  const preferCached = Boolean(options.preferCached);
  if (
    !force
    && preferCached
    && serverPaymentSyncState.loaded
    && Date.now() - serverPaymentSyncState.lastLoadedAt < SERVER_PAYMENT_REFRESH_STALE_MS
  ) {
    return true;
  }
  if (
    !force
    && serverPaymentSyncState.loaded
    && serverPaymentSyncState.directLoaded
    && Date.now() - serverPaymentSyncState.lastLoadedAt < SERVER_PAYMENT_REFRESH_STALE_MS
  ) {
    return true;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !client.readiness?.().ready) {
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.message = "Supabase 연결값이 없어 서버 결제 기록을 불러올 수 없습니다.";
    serverPaymentSyncState.tone = "danger";
    renderBilling();
    if (!silent) showToast("Supabase 연결값 확인 필요");
    return false;
  }

  serverPaymentSyncState.loading = true;
  serverPaymentSyncState.message = "서버 결제 기록을 불러오는 중입니다.";
  serverPaymentSyncState.tone = "neutral";
  renderBilling();

  try {
    const readPayments = (select) => (client.selectAllRows || client.selectRows).call(client, "tn_payments", {
      select,
      order: "created_at.desc",
      limit: 500,
      pageSize: 500,
      maxRows: 5000,
    });
    let rows = [];
    try {
      rows = await readPayments("id,user_id,branch_id,provider,provider_payment_id,purchase_intent_key,purchase_group_key,product_id,ticket_id,one_day_booking_id,revenue_month,revenue_month_source,revenue_attribution_status,revenue_exclusion_reason,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,bank_account_snapshot,depositor_name_snapshot,deposit_due_at,bank_transfer_state,bank_transfer_error_code,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at,tn_users(name)");
    } catch (error) {
      try {
        rows = await readPayments("id,user_id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,bank_account_snapshot,depositor_name_snapshot,deposit_due_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at,tn_users(name)");
      } catch (legacyJoinError) {
        try {
          rows = await readPayments("id,user_id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at,bank_account_snapshot,depositor_name_snapshot,deposit_due_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at");
        } catch (refundSchemaError) {
          rows = await readPayments("id,user_id,branch_id,provider,provider_payment_id,product_id,ticket_id,amount,original_amount,settlement_base_amount,discount_amount,final_amount,method,status,created_at,paid_at,verified_at");
        }
      }
    }
    const { added, updated, removed } = replaceServerPaymentRows(Array.isArray(rows) ? rows : []);
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.directLoaded = true;
    serverPaymentSyncState.lastLoadedAt = Date.now();
    serverPaymentSyncState.message = `서버 결제 ${rows.length}건 확인 · 새로 추가 ${added}건 · 갱신 ${updated}건 · 정리 ${removed}건`;
    serverPaymentSyncState.tone = "good";
    billingLogs.unshift(serverPaymentSyncState.message);
    renderAll();
    if (!silent) showToast("서버 결제 기록 불러오기 완료");
    return true;
  } catch (error) {
    serverPaymentSyncState.loaded = true;
    serverPaymentSyncState.message = `서버 결제 불러오기 실패: ${error?.message || "권한 또는 연결 확인 필요"}`;
    serverPaymentSyncState.tone = "danger";
    billingLogs.unshift(serverPaymentSyncState.message);
    renderAll();
    if (!silent) showToast("서버 결제 기록 확인 필요");
    return false;
  } finally {
    serverPaymentSyncState.loading = false;
    renderBilling();
    saveSnapshot();
  }
}

function reportAdminPaymentGuard(stage, code, operationKey = "") {
  window.TennisNoteIssueReporter?.captureClientError?.({
    category: "runtime",
    stage: `admin_payment_${stage}`,
    code: String(code || "unknown_error"),
    message: `${String(code || "unknown_error")}${operationKey ? ` operation_key=${operationKey}` : ""}`,
    provider: "admin_payment",
  });
}

async function syncRefundPolicySettingsToServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.getSession?.()?.access_token || adminImportAuthState.profile?.role !== "admin") {
    return "local";
  }
  const value = {
    ...normalizeRefundPolicySettings(refundPolicySettings),
    updatedAt: new Date().toISOString(),
  };
  try {
    const updated = await client.updateRows("tn_admin_settings", { key: "refund_policy" }, {
      value,
      updated_at: new Date().toISOString(),
    });
    if (!updated?.length) {
      await client.insertRows("tn_admin_settings", { key: "refund_policy", value });
    }
    return "server";
  } catch {
    return "blocked";
  }
}

async function loadRefundPolicySettingsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: "refund_policy" },
      limit: 1,
    });
    if (!rows?.[0]?.value) return false;
    Object.assign(refundPolicySettings, normalizeRefundPolicySettings(rows[0].value));
    reflectRefundPolicyInActiveVersion();
    saveSnapshot();
    renderRefundPolicySettings();
    renderPolicyVersionSettings();
    return true;
  } catch {
    return false;
  }
}

async function loadDiscountPoliciesFromServer() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.selectRows || !branchId || !adminApprovalReady()) return false;
  const [rows, issues] = await Promise.all([
    client.selectRows("tn_discount_policies", {
      select: "id,branch_id,name,target_label,product_scope,campaign_type,discount_type,discount_value,payment_scope,coach_permission,coach_issue_quota,expires_days,burden_party,status,updated_at",
      filters: { branch_id: branchId },
      order: "created_at.desc",
      limit: 200,
    }),
    client.selectRows("tn_discount_issues", {
      select: "policy_id,status",
      filters: { branch_id: branchId },
      limit: 1000,
    }).catch(() => []),
  ]);
  replaceArray(discountPolicies, (rows || []).map((row) => discountPolicyFromServer(row, issues || [])));
  saveSnapshot();
  if (state.view === "settings" && state.settingsTab === "membership") renderServiceReadiness();
  return true;
}

async function verifyBillingPaymentItem(item) {
  const ticketRepairRetry = paymentRequiresTicketRepair(item);
  if (!item?.providerPaymentId) {
    billingLogs.unshift(`${item?.member || "회원"} ${item?.item || "결제"} 서버검증 실패: paymentId 없음`);
    reportAdminPaymentGuard("reconcile_validation", "missing_payment_id");
    renderAll();
    showToast("서버 결제번호가 없어 다시 처리할 수 없습니다.");
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member} ${item.item} 서버검증 실패: Supabase 연결값 없음`);
    reportAdminPaymentGuard("reconcile_validation", "data_client_not_ready");
    renderAll();
    showToast("서버 연결 상태를 확인해 주세요.");
    return;
  }

  if (item.approvalPending) return;
  item.approvalPending = true;
  item.statusLabel = "승인처리중";
  billingLogs.unshift(`${item.member} ${item.item} 결제 확인·승인 실행: ${item.providerPaymentId}`);
  renderAll();

  try {
    const bankTransfer = String(item.method || "") === "bank_transfer";
    const lateDeposit = bankTransfer && Number.isFinite(Date.parse(item.depositDueAt || "")) && Date.now() > Date.parse(item.depositDueAt);
    const bankPrompt = lateDeposit
      ? `${item.member} 회원의 입금기한이 지났습니다.\n실제 입금 ${money.format(item.finalAmount || item.amount)}원을 직접 확인한 경우에만 승인하세요.`
      : `${item.member} 회원의 ${money.format(item.finalAmount || item.amount)}원 입금을 확인했습니까?\n확인 후에만 회원권 또는 원데이 예약이 생성됩니다.`;
    if (bankTransfer && !ticketRepairRetry && !window.confirm(bankPrompt)) {
      item.status = "server_ready";
      item.statusLabel = "입금확인대기";
      item.approvalPending = false;
      renderAll();
      return;
    }
    const result = await client.invokeFunction("portone-payment/admin-approve", {
      body: {
        paymentId: item.providerPaymentId,
        ...(bankTransfer ? {
          confirmedAmount: Number(item.finalAmount || item.amount || 0),
          acceptLateDeposit: lateDeposit,
        } : {}),
      },
    });
    if (result?.ok) {
      item.status = result.status === "verified" || result.status === "already_verified" ? "paid" : "check";
      item.statusLabel = result.ticketId || result.chargedTicket ? "승인/회원권연결완료" : "승인완료";
      billingLogs.unshift(`${item.member} ${item.item} 결제 승인 완료: ${result.status}`);
      await loadServerPaymentsIntoBilling({ silent: true, force: true });
      const refreshed = billings.find((billing) => (
        String(billing.serverPaymentId || "") === String(item.serverPaymentId || "")
        || String(billing.providerPaymentId || "") === String(item.providerPaymentId || "")
      ));
      const linked = Boolean(result.ticketId || refreshed?.ticketId || refreshed?.oneDayBookingId);
      if (!linked && (!refreshed || paymentRequiresTicketRepair(refreshed))) {
        item.status = "paid";
        item.statusLabel = "회원권처리실패";
        billingLogs.unshift(`${item.member} ${item.item} 결제 확인 완료 · 회원권 처리 실패`);
        showToast("결제는 확인됐지만 회원권 처리가 끝나지 않았습니다. 다시 처리해 주세요.");
      } else {
        showToast(bankTransfer ? "입금 승인·회원권 연결·정산 반영 완료" : "결제 승인·회원권 연결·정산 반영 완료");
      }
    } else if (result?.code === "payment_not_paid") {
      item.status = "server_ready";
      item.statusLabel = "결제대기";
      billingLogs.unshift(`${item.member} ${item.item} 아직 Toss 결제 완료 전: ${result.portoneStatus || "pending"}`);
      showToast("아직 결제 완료 전입니다");
    } else {
      const rawCode = result?.code || "unknown";
      const safeCode = ticketRepairRetry ? paymentTicketFinalizeRecoveryCode(rawCode) : rawCode;
      item.status = ticketRepairRetry ? "paid" : "check";
      item.statusLabel = ticketRepairRetry ? "회원권처리실패" : "검증확인필요";
      billingLogs.unshift(`${item.member} ${item.item} ${ticketRepairRetry ? "회원권 재처리" : "결제 승인"} 실패: ${safeCode}`);
      reportAdminPaymentGuard("reconcile_failed", safeCode);
      showToast(ticketRepairRetry
        ? paymentTicketFinalizeRecoveryMessage(rawCode)
        : bankTransfer ? bankTransferConfirmationMessage(rawCode) : "결제 승인 확인이 필요합니다.");
    }
  } catch (error) {
    const code = error?.payload?.code || error?.message || "server_error";
    if (code === "payment_not_paid") {
      item.status = "server_ready";
      item.statusLabel = "결제대기";
      billingLogs.unshift(`${item.member} ${item.item} 아직 Toss 결제 완료 전`);
      showToast("아직 결제 완료 전입니다");
    } else {
      const safeCode = ticketRepairRetry ? paymentTicketFinalizeRecoveryCode(code) : code;
      item.status = ticketRepairRetry ? "paid" : "check";
      item.statusLabel = ticketRepairRetry ? "회원권처리실패" : "검증실패";
      billingLogs.unshift(`${item.member} ${item.item} ${ticketRepairRetry ? "회원권 재처리" : "결제 승인"} 실패: ${safeCode}`);
      reportAdminPaymentGuard("reconcile_failed", safeCode);
      showToast(ticketRepairRetry
        ? paymentTicketFinalizeRecoveryMessage(code)
        : String(item.method || "") === "bank_transfer" ? bankTransferConfirmationMessage(code) : "결제 승인에 실패했습니다.");
    }
  } finally {
    item.approvalPending = false;
  }
  renderAll();
}

async function ensureAdminPaymentCancelReady(item = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: Supabase 연결값 없음`);
    renderAll();
    showToast("Supabase 연결 후 결제취소 가능");
    return false;
  }
  if (!client.getSession?.()?.access_token) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: 관리자 로그인 필요`);
    renderAll();
    showToast("관리자 로그인 후 결제취소 가능");
    return false;
  }
  if (!adminPaymentCancelReady()) {
    await refreshAdminImportAuthState();
  }
  if (!adminPaymentCancelReady()) {
    billingLogs.unshift(`${item.member || "회원"} ${item.item || "결제"} 취소 차단: 관리자 권한 확인 필요`);
    renderAll();
    showToast("관리자 권한 계정만 결제취소 가능");
    return false;
  }
  return true;
}

async function loadAdminSettlementSupportData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  const readAll = (table, options) => (client.selectAllRows || client.selectRows).call(client, table, {
    limit: 500,
    pageSize: 500,
    maxRows: 20000,
    ...options,
  });
  const [lessonRecords, substituteAssignments, settlementTicketRows] = await Promise.all([
    readAll("tn_lesson_records", {
      select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_ticket_id,deducted_sessions,completed_at,tn_lessons(member_ticket_id,duration_minutes)",
      order: "id.asc",
    }).catch(() => client.selectRows("tn_lesson_records", {
      select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
      limit: 500,
    }).catch(() => adminLiveDataState.lessonRecords || [])),
    readAll("tn_lesson_substitute_assignments", {
      select: "id,lesson_id,branch_id,original_coach_role_id,substitute_coach_role_id,settlement_mode,hourly_amount,status,reason,assigned_at,ended_at",
      order: "assigned_at.desc",
    }).catch(() => adminLiveDataState.substituteAssignments || []),
    readAll("tn_member_tickets", {
      select: "id,user_id,product_id,branch_id,coach_role_id,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,status,purchased_price,updated_at",
      order: "id.asc",
    }).catch(() => []),
  ]);
  Object.assign(adminLiveDataState, {
    lessonRecords,
    substituteAssignments,
    settlementTickets: settlementTicketRows.length
      ? mapAdminSettlementTicketRows(settlementTicketRows)
      : adminLiveDataState.settlementTickets || [],
  });
  return true;
}

async function readMonthlySettlementConfirmation(scope, expectedSourceFingerprint = "") {
  return window.TennisNoteDataClient.rpc("tn_admin_monthly_settlement_scope_state", {
    target_branch_id: scope.branchId,
    target_coach_role_id: scope.coachRoleId,
    target_month: scope.settlementMonth,
    expected_source_fingerprint: expectedSourceFingerprint,
  });
}

async function refreshMonthlySettlementConfirmation({ force = false } = {}) {
  const current = monthlySettlementConfirmationState;
  const scope = monthlySettlementScope();
  const signature = monthlySettlementScopeSignature(scope);
  if (!scope.branchId || !scope.coachRoleId || !scope.settlementMonth) {
    current.status = "EMPTY";
    current.tone = "neutral";
    current.message = scope.branchId ? "코치를 선택해 주세요." : "현재 지점을 먼저 선택해 주세요.";
    renderMonthlySettlementConfirmation();
    return;
  }
  if (operationsRole() !== "admin" || !adminApprovalReady() || !window.TennisNoteDataClient?.rpc) {
    current.status = "ERROR";
    current.tone = "danger";
    current.message = "관리자 로그인과 서버 연결을 확인해 주세요.";
    current.errorCode = "settlement_confirmation_forbidden";
    current.loadedSignature = signature;
    renderMonthlySettlementConfirmation();
    return;
  }
  if (!force && (current.loading || current.loadedSignature === signature)) return;

  const requestId = ++current.requestId;
  current.loading = true;
  current.status = "LOADING";
  current.tone = "neutral";
  current.message = "정산 계산 결과를 불러오는 중입니다.";
  current.errorCode = "";
  renderMonthlySettlementConfirmation();
  try {
    const preview = await window.TennisNoteDataClient.rpc("tn_admin_preview_monthly_settlement_snapshot", {
      target_branch_id: scope.branchId,
      target_coach_role_id: scope.coachRoleId,
      target_month: scope.settlementMonth,
    });
    if (requestId !== current.requestId || signature !== monthlySettlementScopeSignature()) return;
    const scopeState = await readMonthlySettlementConfirmation(scope, preview?.sourceFingerprint || "");
    if (requestId !== current.requestId || signature !== monthlySettlementScopeSignature()) return;
    if (!monthlySettlementScopeMatches(preview, scope) || !monthlySettlementScopeMatches(scopeState, scope)) {
      throw new Error("settlement_confirmation_scope_mismatch");
    }
    current.preview = preview;
    current.scopeState = scopeState;
    current.loadedSignature = signature;
    const snapshot = monthlySettlementSnapshotFrom(scopeState);
    if (String(scopeState?.state || "").toUpperCase() === "CONFIRMED" && snapshot && scopeState?.confirmation) {
      if (String(snapshot.sourceFingerprint || "") !== String(preview.sourceFingerprint || "")) {
        current.status = "STALE";
        current.tone = "warn";
        current.message = "확인 이후 원천 기록이 변경되었습니다. 기존 확인 기록은 보존되며 추가 확인은 차단됩니다.";
        current.errorCode = "settlement_source_changed_after_confirmation";
      } else {
        current.status = "CONFIRMED";
        current.tone = "good";
        current.message = "이 월의 서버 계산본을 확인했습니다. 확인 당시 원천과 합계는 변경되지 않습니다.";
      }
    } else if (!monthlySettlementPreviewHasSources(preview)) {
      current.status = "EMPTY";
      current.tone = "neutral";
      current.message = "선택한 월에는 확인할 정산 원천이 없습니다.";
    } else if (snapshot && !monthlySettlementSnapshotMatchesPreview(snapshot, preview, scope)) {
      current.status = "STALE";
      current.tone = "warn";
      current.message = "저장된 계산본 뒤에 원천 기록이 변경되었습니다. 최신 상태를 다시 계산해 확인해 주세요.";
    } else {
      current.status = "READY";
      current.tone = "ready";
      current.message = snapshot
        ? "저장된 서버 계산본과 현재 원천이 일치합니다. 합계를 확인한 뒤 확정해 주세요."
        : "서버 계산 결과입니다. 확인하면 이 원천과 합계가 불변 기록으로 남습니다.";
      monthlySettlementEnsureOperationKeys(scope, preview);
    }
  } catch (error) {
    if (requestId !== current.requestId) return;
    Object.assign(current, monthlySettlementErrorContract(error));
    current.loadedSignature = signature;
  } finally {
    if (requestId === current.requestId) {
      current.loading = false;
      renderMonthlySettlementConfirmation();
    }
  }
}
