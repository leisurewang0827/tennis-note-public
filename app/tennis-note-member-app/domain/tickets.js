// 이용권의 상태·제목·범위를 정하는 함수들.
//
// 전역 상태도 DOM 도 서버도 참조하지 않는다. 필요한 값은 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function isActiveRegularLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "regular";
}

function isPausedRegularLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.status !== "paused" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "regular";
}

function memberTicketCompactLabel(ticket = {}) {
  const title = ticket.title || ticket.productName || "회원권";
  return `${title} · ${memberCoachShortName(memberTicketLessonCoach(ticket.id))}`;
}

function ticketCountFromTitle(title = "") {
  const match = `${title}`.match(/(\d+)\s*회/);
  return match ? Number(match[1]) : 0;
}

function isActiveCouponLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "coupon" || String(ticket.title || "").includes("쿠폰");
}

function liveTicketStatusInfo(status = "") {
  const key = String(status || "").toLowerCase();
  if (key === "active") return { label: "정상 이용중", tone: "done" };
  if (key === "paused") return { label: "휴회 · 복귀 시간 선택 가능", tone: "wait" };
  if (key === "pending_payment") return { label: "결제 확인 대기", tone: "wait" };
  if (key === "expired") return { label: "만료", tone: "wait" };
  if (["cancelled", "canceled", "refunded"].includes(key)) return { label: "취소", tone: "alert" };
  return { label: key || "상태 확인중", tone: "wait" };
}

function liveTicketProductTitle(row = {}) {
  const product = Array.isArray(row.tn_membership_products)
    ? row.tn_membership_products[0]
    : row.tn_membership_products || {};
  const lessonMinutes = Number(row.lesson_minutes || product.lesson_minutes || 20);
  const productKind = String(row.product_kind || product.product_kind || "");
  const fallbackTitle = `${lessonMinutes}분 ${productKind === "coupon" ? "쿠폰제" : "회원권"}`;
  const readableTitle = (value = "") => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/[?\uFFFD遺荑좏룿]/u.test(text)) return "";
    return /[가-힣A-Za-z0-9]/.test(text) ? text : "";
  };
  const productTitle = readableTitle(product.name);
  if (productTitle) return productTitle;
  const rowTitle = readableTitle(row.product_name);
  if (rowTitle) return rowTitle;
  return fallbackTitle;
}

function liveTicketScheduleScope(row = {}, product = {}) {
  const configuredScope = row.schedule_scope || product.schedule_scope || "";
  const productCode = String(row.product_code || product.product_code || "");
  if (productCode.startsWith("admin-ticket-")) return configuredScope;

  const productName = String(row.product_name || product.name || "");
  if (productName.includes("주말")) return "weekend";
  if (productName.includes("평일")) return "weekday";
  return configuredScope;
}

function normalizeLiveTicket(row = {}) {
  const product = Array.isArray(row.tn_membership_products)
    ? row.tn_membership_products[0]
    : row.tn_membership_products || {};
  const payment = Array.isArray(row.tn_payments)
    ? row.tn_payments[0]
    : row.tn_payments || {};
  const total = Math.max(0, Number(row.total_sessions ?? product.total_sessions ?? 0));
  const used = Math.max(0, Number(row.used_sessions ?? 0));
  const remainingValue = row.remaining_sessions ?? Math.max(0, total - used);
  const remaining = Math.max(0, Number(remainingValue));
  const statusInfo = liveTicketStatusInfo(row.status);
  return {
    id: row.id || "",
    branchId: row.branch_id || "",
    coachRoleId: row.coach_role_id || "",
    groupAccountId: row.shared_group_account_id || row.group_account_id || "",
    productId: row.product_id || product.id || "",
    productKind: row.product_kind || product.product_kind || "",
    lessonMinutes: Number(row.lesson_minutes || product.lesson_minutes || 20),
    frequencyPerWeek: Math.max(1, Number(row.frequency_per_week || product.frequency_per_week || 1)),
    groupSize: Number(row.group_size || product.group_size || 1),
    scheduleScope: liveTicketScheduleScope(row, product),
    maxSessionsPerDay: Number(row.max_sessions_per_day || product.max_sessions_per_day || 0),
    maxSessionsPerWeek: Number(row.max_sessions_per_week || product.max_sessions_per_week || 0),
    maxBookingDaysPerWeek: Number(row.max_booking_days_per_week || product.max_booking_days_per_week || 0),
    makeupAnchorMinutes: Number(row.makeup_anchor_minutes || product.makeup_anchor_minutes || 40),
    productValidityDays: Math.max(0, Number(row.validity_days || product.validity_days || 0)),
    productGraceDays: Math.max(0, Number(row.grace_days || product.grace_days || 0)),
    title: liveTicketProductTitle({ ...row, tn_membership_products: product }),
    status: row.status || "",
    statusLabel: statusInfo.label,
    tone: statusInfo.tone,
    total,
    used,
    remaining,
    startsOn: row.starts_on || "",
    expiresOn: row.expires_on || "",
    createdAt: row.created_at || "",
    sourcePaymentId: row.source_payment_id || "",
    paymentId: payment.id || row.source_payment_id || "",
    providerPaymentId: payment.provider_payment_id || row.provider_payment_id || "",
    paymentStatus: payment.status || "",
    paymentAmount: Number(payment.final_amount || payment.amount || 0),
    paymentMethod: payment.method || "card",
    refundedAmount: Number(payment.refunded_amount || 0),
    refundStatus: payment.refund_status || "none",
    refundReason: payment.refund_reason || "",
    refundBreakdown: payment.refund_breakdown && typeof payment.refund_breakdown === "object" ? payment.refund_breakdown : {},
    refundedAt: payment.refunded_at || "",
    sharedGroupTicket: Boolean(row.shared_group_ticket),
  };
}

function currentLiveTicket() {
  return currentLiveTickets()[0] || null;
}

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
