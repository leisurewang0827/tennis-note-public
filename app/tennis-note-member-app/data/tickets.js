// 서버에서 이용권에 붙일 것을 받아오는 함수들.
//
// domain/tickets.js 에 있었는데 판정이 아니라 서버 호출이라 여기로 옮겼다.
// layer-boundaries 검사가 잡았다.

async function attachLiveTicketProducts(client, rows = []) {
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  if (!productIds.length) return rows;
  const productMap = {};
  await Promise.all(productIds.map(async (productId) => {
    try {
      const productRows = await client.selectRows("tn_membership_products", {
        select: "id,product_code,name,lesson_minutes,product_kind,total_sessions,frequency_per_week,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes,validity_days,grace_days",
        filters: { id: productId },
        limit: 1,
      });
      if (productRows?.[0]) productMap[productId] = productRows[0];
    } catch {
      // Product names are a display enhancement; ticket counts still render without them.
    }
  }));
  return rows.map((row) => ({
    ...row,
    tn_membership_products: row.tn_membership_products || productMap[row.product_id] || null,
  }));
}

async function attachLiveTicketPayments(client, rows = []) {
  const ticketIds = rows.map((row) => row.id).filter(Boolean);
  if (!ticketIds.length) return rows;
  const paymentMap = {};
  await Promise.all(ticketIds.map(async (ticketId) => {
    try {
      let paymentRows = [];
      try {
        paymentRows = await client.selectRows("tn_payments", {
          select: "id,ticket_id,provider_payment_id,amount,final_amount,method,status,created_at,refunded_amount,refund_status,refund_reason,refund_breakdown,refunded_at",
          filters: { ticket_id: ticketId },
          limit: 1,
        });
      } catch {
        paymentRows = await client.selectRows("tn_payments", {
          select: "id,ticket_id,provider_payment_id,amount,final_amount,method,status,created_at",
          filters: { ticket_id: ticketId },
          limit: 1,
        });
      }
      if (paymentRows?.[0]) paymentMap[ticketId] = paymentRows[0];
    } catch {
      // A missing payment row should not block ticket display.
    }
  }));
  return rows.map((row) => ({
    ...row,
    tn_payments: row.tn_payments || paymentMap[row.id] || null,
  }));
}

async function refreshPurchaseScheduleAvailability(options = {}) {
  if (state.dataMode !== "live" || !state.member?.profileId) return true;
  const client = window.TennisNoteDataClient;
  const product = purchaseFlowProduct();
  const context = purchaseDirectoryContext(product);
  if (!client?.rpc || !client.getSession?.()?.access_token || !context.branchId) {
    memberPurchaseDirectoryLoad = {
      key: context.key,
      status: "error",
      error: "member_purchase_directory_unavailable",
    };
    renderMembershipPurchaseFlow();
    return false;
  }

  const cached = memberPurchaseDirectoryCache;
  if (!options.force && cached?.key === context.key && Date.now() - cached.loadedAt < 10_000) {
    memberPurchaseDirectoryLoad = { key: context.key, status: "ready", error: "" };
    const removedCount = reconcilePurchaseSchedulesAfterRefresh(product);
    const weekChanged = alignPurchaseScheduleWeekToAvailability(product);
    if (weekChanged) saveSnapshot();
    if (removedCount) showToast("마감되거나 변경된 시간을 해제했습니다. 가능한 시간을 다시 선택해 주세요.");
    const flow = purchaseFlowState();
    if (flow.open && flow.step !== 4) renderMembershipPurchaseFlow();
    if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
    return true;
  }

  const requestId = ++memberPurchaseDirectoryRequestSequence;
  memberPurchaseDirectoryLoad = { key: context.key, status: "loading", error: "" };
  if (purchaseFlowState().open && purchaseFlowState().step !== 4) renderMembershipPurchaseFlow();
  if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
  try {
    const directory = await client.rpc("tn_member_purchase_coach_directory", {
      target_branch_id: context.branchId,
      target_from: context.from,
      target_to: context.to,
    });
    if (requestId !== memberPurchaseDirectoryRequestSequence
      || purchaseDirectoryContext(purchaseFlowProduct()).key !== context.key) return false;
    if (!directory
      || String(directory.branchId || "") !== context.branchId
      || !Array.isArray(directory.coaches)
      || !Array.isArray(directory.occupancy)
      || !Array.isArray(directory.operationDays)
      || !Array.isArray(directory.breakRules)) {
      throw new Error("member_purchase_directory_response_invalid");
    }
    memberPurchaseDirectoryCache = {
      key: context.key,
      loadedAt: Date.now(),
      directory,
    };
    memberPurchaseDirectoryLoad = { key: context.key, status: "ready", error: "" };
    const removedCount = reconcilePurchaseSchedulesAfterRefresh(product);
    const weekChanged = alignPurchaseScheduleWeekToAvailability(product);
    if (weekChanged) saveSnapshot();
    if (removedCount) showToast("마감되거나 변경된 시간을 해제했습니다. 가능한 시간을 다시 선택해 주세요.");
  } catch (error) {
    if (requestId !== memberPurchaseDirectoryRequestSequence) return false;
    memberPurchaseDirectoryLoad = {
      key: context.key,
      status: "error",
      error: error?.payload?.code || error?.message || "member_purchase_directory_failed",
    };
    console.warn("Tennis Note purchase directory failed", memberPurchaseDirectoryLoad.error);
  }
  const flow = purchaseFlowState();
  if (flow.open && flow.step !== 4) renderMembershipPurchaseFlow();
  if (!$("#purchaseScheduleSheet")?.hidden) renderPurchaseScheduleSheet();
  return purchaseScheduleAvailabilityState() === "ready";
}
