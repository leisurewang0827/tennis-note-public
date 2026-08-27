// policy 관련 폼 항목·표시를 맞추는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function scheduleAdminOperationalCacheWrite() {
  if (adminOperationalCacheWriteQueued) return;
  adminOperationalCacheWriteQueued = true;
  const write = () => {
    adminOperationalCacheWriteHandle = 0;
    adminOperationalCacheWriteQueued = false;
    void writeAdminOperationalCache().catch((error) => {
      console.warn("[Tennis Note] administrator cache write skipped", error?.message || "cache_error");
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    adminOperationalCacheWriteHandle = window.requestIdleCallback(write, { timeout: 1500 });
    return;
  }
  adminOperationalCacheWriteHandle = window.setTimeout(write, 250);
}

function discountPolicyServerPayload(policy = {}) {
  const normalized = normalizeDiscountPolicy(policy);
  return {
    branch_id: normalized.branchId || activeOperationBranchId(),
    name: normalized.title,
    target_label: normalized.target,
    product_scope: normalized.productScope,
    campaign_type: normalized.campaignType,
    discount_type: normalized.type,
    discount_value: normalized.value,
    payment_scope: discountPaymentToServer[normalized.payment] || "card_cash",
    coach_permission: discountCoachPermissionToServer[normalized.coachPermission] || "admin_only",
    coach_issue_quota: normalized.coachQuota,
    expires_days: normalized.expiresDays,
    burden_party: discountBurdenToServer[normalized.burden] || "branch",
    status: discountStatusToServer[normalized.status] || "review",
  };
}

function readNotificationPolicyForm() {
  return normalizeNotificationPolicy({
    lessonDayBeforeEnabled: $("#notifyLessonDayBefore")?.checked !== false,
    lesson30MinutesEnabled: $("#notifyLesson30Minutes")?.checked !== false,
    couponNextBookingEnabled: $("#notifyCouponNextBooking")?.checked !== false,
    ticketLowRemainingEnabled: $("#notifyTicketLowRemaining")?.checked !== false,
    lowRemainingThreshold: $("#notifyLowRemainingThreshold")?.value,
    ticketExpiryEnabled: $("#notifyTicketExpiry")?.checked !== false,
    expiryDaysBefore: $("#notifyExpiryDaysBefore")?.value,
    ticketExpiredEnabled: $("#notifyTicketExpired")?.checked !== false,
    coachFeedbackReminderEnabled: $("#notifyCoachFeedbackReminder")?.checked !== false,
    coachFeedbackReminderMinutes: $("#notifyCoachFeedbackReminderMinutes")?.value,
    coachFeedbackAdminEscalationEnabled: $("#notifyCoachFeedbackEscalation")?.checked !== false,
    coachFeedbackAdminEscalationHours: $("#notifyCoachFeedbackEscalationHours")?.value,
    memberFeedbackReadyEnabled: $("#notifyMemberFeedbackReady")?.checked !== false,
    scheduleRequestStaffEnabled: $("#notifyScheduleRequestStaff")?.checked !== false,
    updatedAt: new Date().toISOString(),
  });
}

function renderBranchSalesPreview() {
  const target = $("#branchSalesMemberPreview");
  if (target) target.innerHTML = branchSalesPreviewMarkup();
  const status = $("#branchSalesDraftStatus");
  if (status) status.textContent = branchSalesSettingsDirty() ? "적용 전 변경 있음" : "현재 앱과 동일";
}

function installAdminOperationalRevisionWatcher() {
  if (adminOperationalRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  adminOperationalRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: () => activeOperationBranchId() || "",
    active: () => !document.hidden
      && operationsAccessReady()
      && adminLiveRefreshViews.has(state.view)
      && state.view !== "schedule",
    onChange: async () => {
      adminLiveScheduleLastRefreshAt = 0;
      await refreshAdminLiveSchedule({ force: true });
    },
  });
}
