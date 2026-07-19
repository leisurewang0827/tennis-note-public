const state = {
  member: null,
  dataMode: "live",
  liveProfileId: "",
  memberEnrollment: null,
  pendingPurchaseProductId: "",
  profile: {
    name: "",
    nickname: "",
    phone: "",
    profileCompletedAt: "",
    privacyConsentVersion: "",
    privacyConsentedAt: "",
    suggestedNickname: "",
    branch: "",
    mainCoach: "",
    ticket: "현재 이용권 없음",
    photoDataUrl: "",
    hand: "",
    backhand: "",
    startedAt: "",
    goal: "",
    styleMemo: "",
    selfNtrp: "",
    coachNtrp: "측정 전",
    ntrpCheckRequested: false,
  },
  coachModeAllowed: false,
  remaining: 0,
  demoPresentationVersion: 0,
  activeMemberWeekIndex: 0,
  selectedScheduleDay: "",
  scheduleTimeRange: "lesson",
  activeJournalMonth: "2026-07",
  selectedJournalDate: "2026-07-03",
  journalSearchQuery: "",
  curriculumQuery: "",
  curriculumFilter: "all",
  lessonLogPage: 0,
  ticketHistoryPage: 0,
  expiredTicketPage: 0,
  practiceLogPage: 0,
  makeupRequests: [],
  lessonLogs: [],
  practiceLogs: [],
  paymentRequests: [],
  selectedPaymentMethod: "card",
  liveMembershipProducts: [],
  liveTickets: [],
  liveLessons: [],
  liveLessonsLoaded: false,
  liveMakeupEntitlements: [],
  liveReleasedMakeupSlots: [],
  groupAccount: null,
  holdingPolicySettings: {
    personalMaxDays: 7,
    fourWeekPersonalMaxDays: 7,
    threeMonthPersonalMaxDays: 14,
    couponPersonalMaxDays: 0,
    injuryMaxDays: 30,
    emergencyRetroactiveDays: 3,
    evidenceRequired: true,
    evidenceRetentionDays: 30,
  },
  liveNotifications: [],
  pushNotifications: {
    permission: "unknown",
    status: "checking",
    detail: "수업 일정과 회원권 만료를 알려드립니다.",
  },
  accountDeletionRequest: null,
  ticketSyncStatus: { tone: "wait", text: "로그인 후 회원권을 확인합니다" },
  pendingPaymentCheckStatus: null,
  lastLiveTicketKey: "",
  lastLiveNotificationKey: "",
  expiredTickets: [],
  noticeHiddenDate: "",
  noticeHiddenId: "",
  noticeHiddenIds: [],
  ticketHistory: [],
};

const brandSplashStartedAt = performance.now();
const brandSplashMinimumDuration = 1800;
const noticeSessionSeenIds = new Set();
let noticePreviousFocus = null;

function hideBrandSplash() {
  const splash = document.querySelector("#brandSplash");
  if (!splash) return;
  const elapsed = performance.now() - brandSplashStartedAt;
  const delay = Math.max(0, brandSplashMinimumDuration - elapsed);
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => {
      splash.hidden = true;
    }, 240);
  }, delay);
}

const days = ["월", "화", "수", "목", "금", "토", "일"];
const times = makeMemberTimeRange("18:40", "21:20");
const listPageSize = 5;
const memberScheduleCoachLaneWidth = 64;
const journalMediaBucket = "tennisnote-journal-media";
const serverJournalSchema = "tennisnote-mobile-journal-v1";
const memberEnrollmentFormVersion = "2026-07-15-v1";
const identityPrivacyVersion = "2026-07-17-v1";
const memberEnrollmentLegacyDefaults = {
  lessonGoal: "미수집",
  preferredSchedule: "시간표에서 선택",
};

const lessons = [];

const memberScheduleWeeks = [
  { label: "7월 1주차", range: "7/1~7/6", note: "이번 주 정규 수업과 변경 가능 시간" },
  {
    label: "7월 2주차",
    range: "7/8~7/13",
    note: "다음 주 정규 수업과 변경 가능 시간",
    lessons: [
      { id: "member-w2-mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w2-wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w2-tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
      { id: "member-w2-thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
      { id: "member-w2-fri-1900", day: "금", time: "19:00", coach: "강 코치", member: "이하린&최유나", type: "정규", status: "occupied" },
      { id: "member-w2-sat-1840", day: "토", time: "18:40", coach: "황 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    ],
  },
  {
    label: "7월 3주차",
    range: "7/15~7/20",
    note: "변경 요청이 반영된 주차 예시",
    lessons: [
      { id: "member-w3-mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w3-wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
      { id: "member-w3-thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "김서준", type: "수업 변경 요청", status: "requested", policy: "coach" },
      { id: "member-w3-tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
      { id: "member-w3-fri-2050", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규", status: "occupied" },
      { id: "member-w3-sat-2020", day: "토", time: "20:20", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    ],
  },
];

const memberScheduleMinWeekOffset = -104;
const memberScheduleMaxWeekOffset = 156;

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function refreshMemberScheduleWeekLabels() {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const dateLabel = (value) => `${value.getMonth() + 1}/${value.getDate()}`;
  memberScheduleWeeks.forEach((week, offset) => {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + (offset * 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
    week.label = `${start.getMonth() + 1}\uC6D4 ${weekOfMonth}\uC8FC\uCC28`;
    week.range = `${dateLabel(start)}~${dateLabel(end)}`;
    week.startDate = localDateKey(start);
    week.endDate = localDateKey(end);
  });
}

refreshMemberScheduleWeekLabels();

const notices = [];

const defaultProducts = [
  { id: "fixed-20-w1", group: "고정 수업권", title: "평일 개인 20분 주1회 4회", detail: "20분 레슨 + 20분 개인연습 · 주1회 고정시간", listAmount: 165000, amount: 150000, settlementBase: 150000, tickets: 4, cardAmount: 165000, cashAmount: 150000, validityDays: 35, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 20분 주1회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주1회" },
  { id: "fixed-30-w1", group: "고정 수업권", title: "평일 개인 30분 주1회 4회", detail: "30분 레슨 + 30분 개인연습 · 주1회 고정시간", listAmount: 198000, amount: 180000, settlementBase: 180000, tickets: 4, cardAmount: 198000, cashAmount: 180000, validityDays: 35, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 30분 주1회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주1회" },
  { id: "fixed-20", group: "고정 수업권", title: "평일 개인 20분 주2회 10회", detail: "20분 레슨 + 20분 개인연습 · 주2회 고정시간", listAmount: 358000, amount: 325000, settlementBase: 325000, tickets: 10, cardAmount: 358000, cashAmount: 325000, validityDays: 30, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 20분 주2회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주2회" },
  { id: "fixed-30", group: "고정 수업권", title: "평일 개인 30분 주2회 10회", detail: "30분 레슨 + 30분 개인연습 · 주2회 고정시간", listAmount: 427000, amount: 388000, settlementBase: 388000, tickets: 10, cardAmount: 427000, cashAmount: 388000, validityDays: 30, graceDays: 14, coach: "선택한 시간에 가능한 코치", flow: "신규: 시간 선택 → 30분 주2회권 선택 → 가능 코치 확정", mode: "fixed", discount: "카드가/현금가 분리 · 정산은 현금가 기준", badge: "주2회" },
  { id: "coupon-20", group: "쿠폰제", title: "20분 쿠폰제", detail: "고정시간 없이 가능한 시간마다 예약 · 선택 코치 전용", listAmount: 200000, amount: 180000, settlementBase: 180000, tickets: 4, cardAmount: 200000, cashAmount: 180000, validityDays: 60, graceDays: 7, productKind: "pass", coachDiscountAllowed: true, coach: "선택 코치 전용", flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감", mode: "coupon", discount: "코치 할인권 사용 가능", badge: "유동 예약", rule: "고정 시간이 없는 쿠폰제이며 선택 코치 근무시간 안에서 예약합니다." },
  { id: "coupon-30", group: "쿠폰제", title: "30분 쿠폰제", detail: "매번 원하는 시간에 예약하는 쿠폰제 · 선택 코치 전용", listAmount: 220000, amount: 198000, settlementBase: 198000, tickets: 4, cardAmount: 220000, cashAmount: 198000, validityDays: 60, graceDays: 7, productKind: "pass", coachDiscountAllowed: true, coach: "선택 코치 전용", flow: "예약: 날짜 선택 → 코치 가능시간 확인 → 1회 차감", mode: "coupon", discount: "이벤트 할인 가능", badge: "유동 예약", rule: "고정 시간이 없는 쿠폰제이며 선택 코치 근무시간 안에서 예약합니다." },
  { id: "group-20", group: "그룹 수업권", title: "평일 2대1 20분 8회", detail: "동반 회원 2명이 같은 시간에 함께 쓰는 그룹 수업권", listAmount: 198000, amount: 180000, settlementBase: 180000, tickets: 8, cardAmount: 198000, cashAmount: 180000, validityDays: 60, graceDays: 7, coach: "선택 코치 전용", flow: "그룹: 대표 회원 선택 → 동반 회원 연결 → 같은 시간 확정", mode: "group", discount: "파트너 변경은 관리자 확인 필요", badge: "2대1" },
  { id: "renewal", group: "재등록", title: "기존 시간 재등록", detail: "잔여 2회 이하부터 결제 안내 · 결제 전까지 기존 시간 보호", listAmount: 0, amount: 0, settlementBase: 0, tickets: 0, coach: "현재 담당 코치", flow: "재등록: 기존 시간 유지 → 회원권 연장 → 결제 확인", mode: "renewal", discount: "만료 후 미결제면 다음 주차부터 시간 오픈", badge: "연장" },
  { id: "extra-coach", group: "추가/변경", title: "새 코치 회원권 추가", detail: "다른 코치에게 배우려면 코치별 회원권을 별도 구매", listAmount: 0, amount: 0, settlementBase: 0, tickets: 0, coach: "새 코치 선택", flow: "추가: 새 시간 선택 → 새 코치권 결제 → 별도 횟수 관리", mode: "add", discount: "중간 코치 변경은 관리자 승인 후 잔여횟수 이전", badge: "코치별 관리" },
];

defaultProducts
  .filter((product) => ["coupon-20", "coupon-30"].includes(product.id))
  .forEach((product) => {
    product.status = "hidden";
    product.rule = "기존 4회 쿠폰은 신규 판매에서 제외합니다.";
  });

const legacyGroupProduct = defaultProducts.find((product) => product.id === "group-20");
if (legacyGroupProduct) {
  legacyGroupProduct.status = "hidden";
  legacyGroupProduct.rule = "기존 8회 그룹권은 과거 이용 내역에서만 유지합니다.";
}

function memberCouponPolicyTemplate({ id, lessonMinutes, groupSize, sessions }) {
  const lessonType = groupSize === 2 ? "2대1" : "1대1";
  return {
    id,
    group: "쿠폰제",
    title: `${lessonType} ${lessonMinutes}분 쿠폰 ${sessions}회`,
    detail: "고정시간 없이 담당 코치의 가능한 시간에 예약",
    listAmount: 0,
    amount: 0,
    settlementBase: 0,
    tickets: sessions,
    cardAmount: 0,
    cashAmount: 0,
    validityDays: sessions * 14,
    graceDays: 14,
    lessonMinutes,
    groupSize,
    productKind: "pass",
    coachDiscountAllowed: true,
    coach: "선택 코치 전용",
    flow: groupSize === 2 ? "2대1 팀 연결 → 결제방식 선택 → 공동 시간표 예약" : "코치 선택 → 결제 → 가능한 시간 예약",
    mode: "pass",
    discount: sessions === 10 ? "10회권은 5회권보다 회당가 할인" : "기준 회당가",
    badge: `${sessions}회`,
    rule: `${sessions}회는 ${sessions * 2}주 사용 · 개인 사정 유예 2주`,
    status: "hidden",
  };
}

defaultProducts.push(
  ...[20, 30].flatMap((lessonMinutes) => [1, 2].flatMap((groupSize) => [5, 10].map((sessions) =>
    memberCouponPolicyTemplate({
      id: `coupon-${lessonMinutes}-${groupSize}to1-${sessions}`,
      lessonMinutes,
      groupSize,
      sessions,
    })))),
);

const finalizedMemberProducts = window.TennisNoteProductCatalog?.createCatalog?.() || [];
if (finalizedMemberProducts.length) {
  const consultProducts = defaultProducts.filter((product) => ["renewal", "add"].includes(product.mode));
  defaultProducts.splice(0, defaultProducts.length, ...finalizedMemberProducts, ...consultProducts);
}

const paymentConfigKey = "tennis-note-payment-config";
const adminStorageKey = "tennis-note-admin-demo-v1";
const liveSchedulePolicyKey = "app_schedule_policy";
const holdingPolicyKey = "holding_policy";

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatDateTimeLabel(value = "") {
  if (!value) return "방금 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeProduct(product = {}, fallback = {}) {
  const merged = { ...fallback, ...product };
  const cleanText = (value = "") => String(value)
    .replaceAll("횟수권", "쿠폰제")
    .replaceAll("쿠폰권", "쿠폰제")
    .replaceAll("쿠폰 수업권", "쿠폰제");
  const title = cleanText(merged.title || merged.name || "회원권");
  const amount = numericValue(merged.amount, numericValue(fallback.amount));
  const listAmount = numericValue(merged.listAmount, numericValue(fallback.listAmount));
  const settlementBase = numericValue(merged.settlementBase, amount);
  const tickets = numericValue(merged.tickets, numericValue(fallback.tickets));
  const mode = merged.mode === "coupon" ? "pass" : merged.mode || fallback.mode || "fixed";
  const productKind = merged.productKind || (mode === "group" ? "group" : mode === "pass" ? "pass" : mode === "renewal" || mode === "add" ? "consult" : "regular");
  return {
    ...merged,
    id: merged.id || `product-${Date.now()}`,
    group: cleanText(merged.group || fallback.group || "회원권"),
    title,
    name: cleanText(merged.name || title),
    detail: cleanText(merged.detail || merged.format || fallback.detail || "관리자 설정 회원권"),
    format: cleanText(merged.format || fallback.format || merged.detail || "회원권"),
    listAmount,
    amount,
    settlementBase,
    tickets,
    cardAmount: numericValue(merged.cardAmount, numericValue(fallback.cardAmount, listAmount || amount)),
    cashAmount: numericValue(merged.cashAmount, numericValue(fallback.cashAmount, settlementBase || amount)),
    validityDays: numericValue(merged.validityDays, numericValue(fallback.validityDays, mode === "pass" ? 60 : 35)),
    graceDays: numericValue(merged.graceDays, numericValue(fallback.graceDays, mode === "pass" ? 7 : 14)),
    productKind,
    discountEnabled: merged.discountEnabled ?? fallback.discountEnabled ?? true,
    coachDiscountAllowed: merged.coachDiscountAllowed ?? fallback.coachDiscountAllowed ?? false,
    coach: merged.coach || fallback.coach || "선택 코치 전용",
    flow: cleanText(merged.flow || fallback.flow || "시간 선택 → 회원권 선택 → 결제"),
    mode,
    discount: cleanText(merged.discount || fallback.discount || "관리자 설정 기준 적용"),
    badge: cleanText(merged.badge || fallback.badge || "회원권"),
    rule: cleanText(merged.rule || fallback.rule || "코치별 회원권으로 관리합니다."),
    status: merged.status || fallback.status || "sale",
  };
}

function readAdminProducts() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    const source = snapshot?.membershipProducts || snapshot?.membershipProductDrafts;
    if (!Array.isArray(source) || !source.length) return [];
    return source
      .map((product) => normalizeProduct(product, defaultProducts.find((item) => item.id === product.id)));
  } catch {
    return [];
  }
}

function membershipProductFromServer(row = {}) {
  const productKind = String(row.product_kind || "regular");
  const mode = productKind === "coupon" ? "pass" : productKind === "group" ? "group" : "fixed";
  const sessions = numericValue(row.total_sessions);
  const lessonMinutes = numericValue(row.lesson_minutes, 20);
  const groupSize = numericValue(row.group_size, 1);
  const frequency = numericValue(row.frequency_per_week);
  const group = productKind === "coupon" ? "쿠폰제" : groupSize === 2 ? "2대1 정기권" : "정기권";
  const couponValidityWeeks = window.TennisNoteProductCatalog?.policy?.coupon?.validityWeeksBySessions || {};
  const status = productKind === "coupon" && ![5, 10, 15, 20].includes(sessions) ? "hidden" : "sale";
  return normalizeProduct({
    id: row.id,
    group,
    title: row.name || `${lessonMinutes}분 회원권`,
    name: row.name,
    detail: `${lessonMinutes}분 레슨${numericValue(row.machine_minutes) ? ` + ${numericValue(row.machine_minutes)}분 개인연습` : ""}`,
    format: groupSize === 2 ? "2대1" : "1대1",
    listAmount: numericValue(row.card_price),
    amount: numericValue(row.card_price),
    cardAmount: numericValue(row.card_price),
    cashAmount: numericValue(row.cash_price),
    settlementBase: numericValue(row.settlement_base_price, numericValue(row.cash_price)),
    tickets: sessions,
    validityDays: numericValue(row.validity_days, productKind === "coupon" ? Number(couponValidityWeeks[sessions] || 0) * 7 : 35),
    graceDays: numericValue(row.grace_days),
    lessonMinutes,
    groupSize,
    frequencyPerWeek: frequency,
    productKind,
    discountEnabled: row.discount_enabled !== false,
    coachDiscountAllowed: Boolean(row.coach_discount_allowed),
    coach: "선택한 코치 전용",
    flow: productKind === "coupon" ? "날짜 선택 → 코치 가능시간 확인 → 결제" : "시간 선택 → 코치 확정 → 결제",
    mode,
    discount: row.discount_enabled === false ? "할인 적용 불가" : "관리자 할인 정책 적용",
    badge: productKind === "coupon" ? `${sessions}회` : frequency ? `주 ${frequency}회` : `${sessions}회`,
    rule: productKind === "coupon" ? "선택한 코치의 가능 시간에 예약합니다." : "담당 코치와 고정 시간을 연결합니다.",
    status,
  });
}

function membershipProducts() {
  if (state.dataMode === "live") {
    return state.liveMembershipProducts.filter((product) => product.status !== "hidden");
  }
  if (state.liveMembershipProducts.length) {
    return state.liveMembershipProducts.filter((product) => product.status !== "hidden");
  }
  const adminProducts = readAdminProducts();
  const mergedProducts = defaultProducts.map((defaultProduct) =>
    normalizeProduct(adminProducts.find((product) => product.id === defaultProduct.id), defaultProduct));
  const extraProducts = adminProducts.filter((product) => !defaultProducts.some((defaultProduct) => defaultProduct.id === product.id));
  return [...mergedProducts, ...extraProducts]
    .map((product) => ["coupon-20", "coupon-30", "group-20"].includes(product.id)
      ? { ...product, status: "hidden" }
      : product)
    .filter((product) => product.status !== "hidden");
}

function productKindLabel(product) {
  if (product.status === "consult" || product.productKind === "consult") return "상담형";
  if (product.productKind === "pass" || product.mode === "pass") return "쿠폰제";
  if (product.productKind === "group" || product.mode === "group") return "2대1";
  return "정기권";
}

function formatWon(value) {
  const number = numericValue(value);
  return number ? `${number.toLocaleString("ko-KR")}원` : "상담";
}

function productUsagePills(product) {
  const pills = [
    productKindLabel(product),
    product.tickets ? `${product.tickets}회` : "상담",
    product.validityDays ? `사용 ${product.validityDays}일` : "기간 상담",
    product.graceDays ? `유예 ${product.graceDays}일` : "유예 없음",
  ];
  if (product.coachDiscountAllowed) pills.push("코치 할인권 가능");
  if (!product.discountEnabled) pills.push("할인 불가");
  return pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("");
}

function productOperationNote(product) {
  if (product.status === "consult" || !product.amount) return "관리자 확인 후 회원권, 담당 코치, 시간을 확정합니다.";
  if (product.productKind === "pass" || product.mode === "pass") return "고정 시간이 없는 쿠폰제라 예약할 때마다 가능한 시간에서 1회씩 차감됩니다.";
  if (product.productKind === "group" || product.mode === "group") return "동반 회원을 하나의 회원권으로 묶고 시간표에는 두 이름을 함께 표시합니다.";
  return "고정 시간은 잔여 2회부터 재등록 안내가 가고, 미결제 시 다음 주차부터 시간이 열립니다.";
}

function productPriceRows(product) {
  if (product.status === "consult" || !product.amount) {
    return `
      <div class="product-price-panel consult">
        <strong>상담 후 확정</strong>
        <small>${escapeHtml(product.flow)}</small>
      </div>`;
  }
  return `
    <div class="product-price-panel">
      <div><span>온라인 결제</span><strong>${formatWon(onlinePaymentAmount(product))}</strong></div>
      <div><span>카드가</span><b>${formatWon(product.cardAmount || product.listAmount)}</b></div>
      <div><span>계좌이체가</span><b>${formatWon(product.cashAmount || product.amount)}</b></div>
      <div><span>정산기준</span><b>${formatWon(product.settlementBase)}</b></div>
    </div>`;
}

function onlinePaymentAmount(product = {}) {
  return numericValue(product.cardAmount, numericValue(product.listAmount, numericValue(product.amount)));
}

const registrationFlows = [
  { title: "운동노트 회원", detail: "간편 로그인만 하면 회원권 없이도 운동 기록을 바로 남길 수 있습니다.", steps: ["간편 로그인", "운동 기록", "사진·영상", "계속 이용"] },
  { title: "첫 회원권 구매", detail: "처음 유료 레슨을 구매할 때만 수강 가입서를 작성하고 결제로 이어집니다.", steps: ["회원권 선택", "수강 가입서", "결제", "수강 시작"] },
  { title: "재등록", detail: "현재 가입서가 유효한 회원은 다시 작성하지 않고 기존 시간과 회원권을 연장합니다.", steps: ["잔여 2회 알림", "기존 시간 보호", "결제", "연장"] },
  { title: "2대1 공동관리", detail: "한 명이 가입서와 결제를 진행해도 파트너 일정이 함께 연결됩니다.", steps: ["파트너 입력", "공동 시간표", "대표 결제", "앱 추가 연결"] },
];

const legacyCurriculumSteps = [
  {
    id: "FH-01",
    title: "포핸드 연결 안정화",
    focus: "라켓면 고정, 전진 스텝, 짧은 공 처리",
    next: "다음 수업은 짧은 공 접근 후 크로스 방향 컨트롤을 진행합니다.",
    notionSource: "Notion · 입문/초급 포핸드 DB",
    notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed",
  },
  {
    id: "FT-02",
    title: "풋워크와 회복 스텝",
    focus: "첫 발 반응, 중심 회복, 다음 공 준비",
    next: "다음 수업 전에는 타구 후 제자리 회복을 영상으로 확인합니다.",
    notionSource: "Notion · 풋워크/기초 움직임 DB",
    notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7",
  },
  {
    id: "BH-R1",
    title: "백핸드 리턴 준비",
    focus: "스플릿 스텝, 어깨 회전, 임팩트 전 준비",
    next: "다음 수업은 백핸드 리턴 타이밍과 낮은 공 처리를 진행합니다.",
    notionSource: "Notion · 리턴/백핸드 DB",
    notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8",
  },
];

const legacyCurriculumSkillTracks = [
  {
    title: "포핸드",
    summary: "가장 많이 쓰는 스트로크라 입문 이후에도 방향, 깊이, 전술 전환으로 계속 확장합니다.",
    currentLevel: "초급",
    progress: "4/8",
    activeStepId: "FH-01",
    steps: [
      { level: "입문", id: "FH-01", title: "제자리 컨트롤", goal: "느린 공을 안정적으로 넘기기", practice: "라켓면 고정, 리듬 만들기", completion: "10구 이상 랠리 연결", notionUrl: "https://app.notion.com/p/305b107df4808096a7f9f2a1776487ed" },
      { level: "초급", id: "FH-C01", title: "크로스 기본 코스", goal: "크로스 방향으로 안정적인 랠리", practice: "대각선 감각, 타점 유지", completion: "크로스 8구 이상 연결", notionUrl: "https://app.notion.com/p/305b107df4808088b673df964a164020" },
      { level: "중급", id: "FH-T03", title: "공격 전환", goal: "짧은 공을 보고 앞으로 들어가기", practice: "어프로치, 마무리 스윙", completion: "짧은 공 처리 후 회복", notionUrl: "https://app.notion.com/p/317b107df48080afa274f62eecce42a7" },
    ],
  },
  {
    title: "백핸드",
    summary: "포핸드보다 늦게 올라오는 경우가 많아 별도 단계로 천천히 추적합니다.",
    currentLevel: "입문",
    progress: "2/6",
    activeStepId: "BH-R1",
    steps: [
      { level: "입문", id: "BH-01", title: "기본 준비 자세", goal: "백핸드 준비와 라켓면 안정", practice: "어깨 회전, 짧은 스윙", completion: "천천히 오는 공 넘기기", notionUrl: "https://app.notion.com/p/38ab107df480817cbeb6f953d1d24d9d" },
      { level: "입문", id: "BH-R1", title: "전진 타점 적용", goal: "백핸드 준비와 임팩트 안정", practice: "스플릿 스텝, 어깨 회전", completion: "느린 리턴 랠리 시작", notionUrl: "https://app.notion.com/p/317b107df48080b6a6f4fc1c42348dd8" },
      { level: "초급", id: "BH-02", title: "짧은 스윙 연결", goal: "백핸드 랠리 연결", practice: "짧은 스윙, 회복 스텝", completion: "백핸드 6구 이상 연결", notionUrl: "https://app.notion.com/p/38ab107df48081a9bab8db0ecc082980" },
    ],
  },
  {
    title: "풋워크",
    summary: "기술을 잘 쳐도 움직임이 늦으면 무너지기 때문에 별도 진행도로 봅니다.",
    currentLevel: "입문",
    progress: "3/5",
    activeStepId: "ST-01",
    steps: [
      { level: "입문", id: "ST-01", title: "풋워크 입문", goal: "첫 발과 준비 자세 만들기", practice: "스플릿 스텝, 레디 포지션", completion: "타구 후 제자리 회복", notionUrl: "https://app.notion.com/p/38ab107df4808195bff1e85caaf95dd7" },
      { level: "입문", id: "ST-PHOTO", title: "레디 포지션", goal: "기본 준비 자세 확인", practice: "정면/측면 자세 체크", completion: "상체와 라켓 위치 안정", notionUrl: "https://app.notion.com/p/38ab107df4808179ac38c384f5d6ba8d" },
      { level: "초급", id: "ST-VIDEO", title: "스플릿 스텝 기본", goal: "공 없이 첫 발 반응 만들기", practice: "스플릿 스텝, 첫 발", completion: "5회 반복 촬영 확인", notionUrl: "https://app.notion.com/p/38ab107df480817fbcb4fdd7f2da8d91" },
    ],
  },
  {
    title: "발리/네트플레이",
    summary: "처음부터 많이 하지 않아도, 게임을 시작하면 따로 열리는 기술 영역입니다.",
    currentLevel: "시작 전",
    progress: "0/5",
    activeStepId: "",
    steps: [
      { level: "입문", id: "NV-01", title: "네트플레이 이해", goal: "네트 앞 역할 이해", practice: "기본 위치, 라켓면", completion: "네트 앞 준비 자세 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
      { level: "입문", id: "NV-02", title: "기본 발리 안정", goal: "짧은 동작으로 공 막기", practice: "포핸드/백핸드 발리", completion: "느린 발리 연결", notionUrl: "https://app.notion.com/p/317b107df48080b3a731d449f1690f97" },
      { level: "초급", id: "NV-03", title: "어프로치 & 첫 발리", goal: "앞으로 들어가 첫 발리 연결", practice: "어프로치, 파트너 위치 확인", completion: "첫 발리 후 다음 공 준비", notionUrl: "https://app.notion.com/p/317b107df48081959b99c3cf91fb4f23" },
    ],
  },
  {
    title: "서브/리턴",
    summary: "실내 수업에서는 가볍게 보고, 야외 게임으로 이어질 때 확장합니다.",
    currentLevel: "입문",
    progress: "1/4",
    activeStepId: "SV-01",
    steps: [
      { level: "입문", id: "SV-01", title: "서브 기본 루틴", goal: "토스와 리듬 안정", practice: "토스 위치, 임팩트 밸런스", completion: "세컨드 서브 안정", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
      { level: "입문", id: "RT-01", title: "리턴 첫 발", goal: "서브에 맞춰 빠르게 준비", practice: "스플릿 스텝, 블록 리턴", completion: "느린 서브 리턴 성공", notionUrl: "https://app.notion.com/p/317b107df480808989b8c5588935e05f" },
      { level: "초급", id: "SV-R1", title: "서브 후 첫 공 준비", goal: "서브 뒤 멈추지 않기", practice: "착지 후 스플릿 스텝", completion: "첫 공 준비 자세 유지", notionUrl: "https://app.notion.com/p/38ab107df480817188a2e3f84eeb12cf" },
    ],
  },
  {
    title: "게임 운영/복식",
    summary: "기술이 어느 정도 연결되면 포인트 흐름과 복식 위치를 따로 관리합니다.",
    currentLevel: "시작 전",
    progress: "0/6",
    activeStepId: "",
    steps: [
      { level: "입문", id: "GM-01", title: "성장 로드맵", goal: "지금 필요한 기술 찾기", practice: "목표별 커리큘럼 선택", completion: "다음 목표 설명 가능", notionUrl: "https://app.notion.com/p/317b107df480803baf48c4b5e18b2573" },
      { level: "초급", id: "TC-01", title: "중립 → 공격", goal: "유리한 공에서 공격 전환", practice: "크로스 후 다운더라인", completion: "패턴 3구 연결", notionUrl: "https://app.notion.com/p/317b107df48080aab3b9ca696dd655e6" },
      { level: "중급", id: "DB-01", title: "복식 기본 위치", goal: "전위/후위 역할 이해", practice: "자리 전환, 커버 범위", completion: "기본 포지션 유지", notionUrl: "https://app.notion.com/p/317b107df48080dfa195ed6ad397c436" },
    ],
  },
];

const curriculumCatalog = window.TennisNoteCurriculumCatalog || {
  sources: {},
  levels: [],
  tracks: [],
  fundamentals: [],
  steps: legacyCurriculumSteps,
  aliases: {},
};
const curriculumSteps = curriculumCatalog.steps?.length ? curriculumCatalog.steps : legacyCurriculumSteps;
const curriculumSkillTracks = curriculumCatalog.tracks?.length
  ? [
      {
        id: "FOUNDATION",
        title: "기초 움직임과 서브",
        category: "기초",
        summary: "모든 기술의 바탕이 되는 풋워크와 실외 서브 기초입니다.",
        currentLevel: "입문",
        progress: `0/${curriculumCatalog.fundamentals.length}`,
        activeStepId: "",
        notionUrl: curriculumCatalog.sources?.skillGuide || curriculumCatalog.sources?.detailedGuide,
        steps: curriculumCatalog.fundamentals.map((step) => ({
          ...step,
          goal: step.focus,
          practice: step.mission,
          completion: step.checklist,
        })),
      },
      ...curriculumCatalog.tracks.map((track) => ({
        ...track,
        currentLevel: track.lessons[0]?.level || "입문",
        progress: `0/${track.lessons.length}`,
        activeStepId: "",
        steps: track.lessons.map((step) => ({
          ...step,
          goal: step.focus,
          practice: step.mission,
          completion: step.checklist,
        })),
      })),
    ]
  : legacyCurriculumSkillTracks;

const storageKey = "tennis-note-member-live-v1";
const sharedStorageKey = "tennis-note-shared-live-v1";
const appModePreferenceKey = "tennis-note-app-mode";
const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];
let coachModeNavigationStarted = false;

function purgeLegacyDemoStorage() {
  legacyDemoStorageKeys.forEach((key) => localStorage.removeItem(key));
}
const notionCurriculumGuideUrl = curriculumCatalog.sources?.memberGuide || "https://app.notion.com/p/94544cb6f3d546e991db21dbab5fb163";
const notionCurriculumDetailUrl = curriculumCatalog.sources?.detailedGuide || "https://app.notion.com/p/312b107df48080e282cbe84b95cff64b";

const ntrpReferences = [
  {
    id: "poster",
    title: "내가 만든 NTRP 포스터",
    detail: "테니스클럽하우스 NTRP 테니스 자가 레벨 측정 포스터 기준",
    image: "./assets/ntrp-poster.jpg",
    path: "C:\\Users\\user\\Documents\\자료정리\\다이너스티주식회사\\테니스클럽하우스\\커리큘럼\\2024-03-26_테니스클럽하우스_NTRP_테니스게임레벨_안내.jpg",
  },
  {
    id: "usta",
    title: "USTA 공식 NTRP 기준",
    detail: "공식 기준은 길어서 앱에서는 1.5~4.0 핵심만 가볍게 요약합니다.",
    url: "https://www.usta.com/content/dam/usta/pdfs/10013_experience_player_ntrp_characteristics1%20%282%29.pdf",
  },
];

const ntrpQuickLevels = [
  { level: "1.5", label: "입문", detail: "스트로크를 배우는 중" },
  { level: "2.0", label: "초급", detail: "타점과 위치 선정이 아직 불안정" },
  { level: "2.5", label: "초급+", detail: "느린 랠리와 기본 게임 가능" },
  { level: "3.0", label: "중급 입문", detail: "중간 속도 랠리 가능, 조절은 불안정" },
  { level: "3.5", label: "중급", detail: "방향 조절과 전술 시도" },
  { level: "4.0", label: "상급 입문", detail: "안정적 경기 운영 가능" },
];

const ntrpSurveyQuestions = [
  {
    id: "rally",
    title: "베이스라인 랠리 유지",
    options: [
      { score: 1.5, label: "아직 공을 넘기는 것 자체를 연습 중" },
      { score: 2.0, label: "천천히 치면 몇 번은 넘기지만 타점이 자주 흔들림" },
      { score: 2.5, label: "비슷한 수준과 베이스라인 랠리를 천천히 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 랠리를 이어가지만 깊이/방향/속도 조절은 불안정" },
      { score: 3.5, label: "랠리가 가능하고 방향 조절을 시도할 수 있음" },
      { score: 4.0, label: "대부분의 샷이 안정적이고 방향/길이 조절이 가능" },
    ],
  },
  {
    id: "forehand",
    title: "포핸드 안정성",
    options: [
      { score: 1.5, label: "공을 맞혀 넘기는 것을 연습 중" },
      { score: 2.0, label: "폼은 배우고 있지만 방향과 타점이 자주 흔들림" },
      { score: 2.5, label: "천천히 오는 공은 포핸드로 주고받을 수 있음" },
      { score: 3.0, label: "중간 속도 공을 비교적 꾸준히 치지만 깊이/방향 조절은 부족" },
      { score: 3.5, label: "포핸드 방향 조절과 공격 전환을 시도할 수 있음" },
      { score: 4.0, label: "포핸드로 깊이, 방향, 속도 조절이 가능하고 기회볼을 만들 수 있음" },
    ],
  },
  {
    id: "backhand",
    title: "백핸드 안정성",
    options: [
      { score: 1.5, label: "백핸드 자세를 배우는 중" },
      { score: 2.0, label: "백핸드를 피하거나 라켓면이 자주 열림" },
      { score: 2.5, label: "천천히 오는 공은 백핸드로 넘길 수 있음" },
      { score: 3.0, label: "중간 속도 백핸드 랠리가 가능하지만 공격/방향 조절은 불안정" },
      { score: 3.5, label: "백핸드 크로스와 다운더라인을 구분해 시도할 수 있음" },
      { score: 4.0, label: "백핸드에서도 깊이와 방향 조절이 가능하고 수비에서 회복할 수 있음" },
    ],
  },
  {
    id: "serve",
    title: "서브",
    options: [
      { score: 1.5, label: "서브 동작을 배우는 중" },
      { score: 2.0, label: "토스와 임팩트가 일정하지 않음" },
      { score: 2.5, label: "천천히 넣는 서브는 가능하지만 세컨서브가 불안함" },
      { score: 3.0, label: "서브를 넣고 랠리를 시작할 수 있음" },
      { score: 3.5, label: "서브 방향과 첫 볼 연결을 의식함" },
      { score: 4.0, label: "안정적인 세컨서브와 포인트 시작 능력이 있음" },
    ],
  },
  {
    id: "return",
    title: "리턴",
    options: [
      { score: 1.5, label: "서브를 받아 넘기는 감각을 배우는 중" },
      { score: 2.0, label: "느린 서브는 받아보지만 준비가 늦고 실수가 많음" },
      { score: 2.5, label: "느린 서브를 리턴해서 랠리를 시작할 수 있음" },
      { score: 3.0, label: "중간 속도 서브 리턴은 가능하지만 방향 조절이 부족" },
      { score: 3.5, label: "리턴 방향을 선택하고 다음 공 준비를 의식함" },
      { score: 4.0, label: "상대 서브에 따라 블록/공격 리턴을 구분할 수 있음" },
    ],
  },
  {
    id: "net",
    title: "네트플레이와 발리",
    options: [
      { score: 1.5, label: "네트 앞 플레이가 아직 낯섦" },
      { score: 2.0, label: "발리 자세를 배우지만 공이 뜨거나 라켓면이 흔들림" },
      { score: 2.5, label: "쉬운 발리는 넘길 수 있지만 위치 선정이 부족" },
      { score: 3.0, label: "발리 시도는 가능하지만 낮은 공/빠른 공에 약함" },
      { score: 3.5, label: "어프로치 후 발리, 로브 대응을 시도할 수 있음" },
      { score: 4.0, label: "발리, 로브, 오버헤드를 상황에 맞게 사용할 수 있음" },
    ],
  },
  {
    id: "game",
    title: "경기 이해",
    options: [
      { score: 1.5, label: "룰과 위치를 배우는 중" },
      { score: 2.0, label: "단식/복식 위치 선정이 아직 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임을 시도할 수 있음" },
      { score: 3.0, label: "복식에서 전위/후위 위치를 이해하고 포인트를 진행함" },
      { score: 3.5, label: "기회볼, 로브, 어프로치 등 선택을 시작함" },
      { score: 4.0, label: "포인트 패턴과 약점 공략을 생각하며 경기함" },
    ],
  },
  {
    id: "movement",
    title: "움직임과 회복",
    options: [
      { score: 1.5, label: "공 위치를 따라가는 감각을 잡는 중" },
      { score: 2.0, label: "공에 늦게 도착하거나 준비 동작이 자주 늦음" },
      { score: 2.5, label: "천천히 오는 공은 준비해서 칠 수 있음" },
      { score: 3.0, label: "중간 속도 공에 반응하지만 회복 스텝이 자주 늦음" },
      { score: 3.5, label: "타구 후 다음 위치로 회복하려고 움직임" },
      { score: 4.0, label: "코트 포지션을 선택하고 다음 공을 준비함" },
    ],
  },
  {
    id: "control",
    title: "방향/깊이/속도 조절",
    options: [
      { score: 1.5, label: "공을 코트 안에 넣는 것이 우선" },
      { score: 2.0, label: "방향을 의도해도 결과가 자주 벗어남" },
      { score: 2.5, label: "천천히 치면 코스 선택을 조금 시도할 수 있음" },
      { score: 3.0, label: "중간 속도에서 방향/깊이/속도 조절이 아직 일정하지 않음" },
      { score: 3.5, label: "방향 조절과 깊이 조절을 의식적으로 시도함" },
      { score: 4.0, label: "상황에 따라 깊이, 방향, 속도를 바꿔 포인트를 만들 수 있음" },
    ],
  },
  {
    id: "doubles",
    title: "복식 위치와 팀플레이",
    options: [
      { score: 1.5, label: "복식 위치와 룰이 아직 어렵다" },
      { score: 2.0, label: "단식/복식 기본 위치 선정이 헷갈림" },
      { score: 2.5, label: "기본 위치를 알고 게임에 참여할 수 있음" },
      { score: 3.0, label: "전위/후위 역할을 이해하고 한 명 앞, 한 명 뒤 형태로 플레이함" },
      { score: 3.5, label: "포칭, 로브 커버, 파트너 위치를 조금씩 의식함" },
      { score: 4.0, label: "팀플레이가 보이고 찬스볼 마무리와 수비 전환이 가능함" },
    ],
  },
];

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: shared.lessonLogs || [],
      feedbackRequests: shared.feedbackRequests || [],
      ntrpRequests: shared.ntrpRequests || [],
      paymentRequests: shared.paymentRequests || [],
      makeupRequests: shared.makeupRequests || [],
      holdingRequests: shared.holdingRequests || [],
      notices: shared.notices || [],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    localStorage.removeItem(sharedStorageKey);
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], paymentRequests: [], makeupRequests: [], holdingRequests: [], notices: [], noticeSource: "" };
  }
}

function saveSharedData(shared) {
  localStorage.setItem(sharedStorageKey, JSON.stringify(shared));
}

function normalizeAppNotice(notice = {}) {
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status) ? notice.status : "active";
  return {
    id: notice.id || `notice-${Date.now()}`,
    title: notice.title || notices[0]?.title || "공지사항",
    body: notice.body || notices[0]?.body || "",
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : "all",
    status: normalizedStatus,
    priority: notice.priority || "normal",
    startDate: notice.startDate || "",
    endDate: notice.endDate || "",
    showOncePerDay: notice.showOncePerDay !== false,
    displayOrder: Math.max(0, Number(notice.displayOrder ?? notice.display_order) || 10),
    imageUrl: String(notice.imageUrl || notice.image_url || "").trim(),
    imageAlt: String(notice.imageAlt || notice.image_alt || "").trim(),
    actionLabel: String(notice.actionLabel || notice.action_label || "").trim(),
    actionUrl: String(notice.actionUrl || notice.action_url || "").trim(),
    updatedAt: notice.updatedAt || "",
  };
}

function activeNoticesForApp(audience = "member") {
  const today = localDateKey();
  const shared = loadSharedData();
  const source = shared.noticeSource === "server" ? shared.notices : (shared.notices?.length ? shared.notices : notices);
  return source
    .map((notice) => normalizeAppNotice(notice))
    .filter((notice) => (
      notice.status === "active"
      && ["all", audience].includes(notice.audience)
      && (!notice.startDate || notice.startDate <= today)
      && (!notice.endDate || notice.endDate >= today)
    ))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function noticeMetaText(notice = {}) {
  const audienceLabel = notice.audience === "coach" ? "코치용" : notice.audience === "member" ? "회원용" : "회원/코치 공통";
  const priorityLabel = notice.priority === "urgent" ? "긴급" : notice.priority === "important" ? "중요" : "일반";
  return `${audienceLabel} · ${priorityLabel}`;
}

function noticeRowToAppNotice(row = {}) {
  return normalizeAppNotice({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    priority: row.priority,
    startDate: row.starts_on || "",
    endDate: row.ends_on || "",
    showOncePerDay: row.show_once_per_day !== false,
    displayOrder: row.display_order,
    imageUrl: row.image_url || "",
    imageAlt: row.image_alt || "",
    actionLabel: row.action_label || "",
    actionUrl: row.action_url || "",
    updatedAt: row.updated_at || row.created_at || "",
  });
}

async function syncLiveNotices() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_notice_popups", {
      select: "id,title,body,audience,priority,status,starts_on,ends_on,show_once_per_day,display_order,image_url,image_alt,action_label,action_url,created_at,updated_at",
      limit: 100,
    });
    const notices = (rows || [])
      .map((row) => noticeRowToAppNotice(row))
      .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const shared = loadSharedData();
    if (!notices.length) {
      shared.notices = [];
      shared.noticeSource = "server";
      saveSharedData(shared);
      return true;
    }
    shared.notices = notices.slice(0, 100);
    shared.noticeSource = "server";
    saveSharedData(shared);
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeLiveNotification(row = {}) {
  const templateKey = String(row.template_key || "");
  const isRefund = ["payment_cancelled", "payment_request_cancelled", "payment_refunded"].includes(templateKey);
  const isMakeupRequired = templateKey === "lesson_absence_makeup_required";
  const isMakeupBooked = templateKey === "makeup_booking_completed";
  const title = row.title || (templateKey === "payment_refunded" ? "환불 완료" : isRefund ? "결제취소 완료" : "앱 알림");
  const body = row.body || (templateKey === "payment_request_cancelled"
    ? "결제 대기건이 취소되었습니다. 실제 결제가 완료된 건은 아닙니다."
    : isRefund
      ? "결제취소와 회원권 환불 처리가 완료되었습니다. 이용권 내역에서 환불완료 상태를 확인할 수 있습니다."
      : "새 알림이 도착했습니다.");
  return {
    id: row.id || `${templateKey}-${row.created_at || Date.now()}`,
    templateKey,
    title,
    body,
    status: row.status || "sent",
    createdAt: row.sent_at || row.created_at || row.scheduled_at || "",
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    tone: isRefund || isMakeupRequired ? "alert" : isMakeupBooked ? "done" : "wait",
  };
}

async function syncMemberNotificationsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_notifications", {
      select: "id,user_id,channel,template_key,title,body,payload,scheduled_at,sent_at,status,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const notifications = (rows || [])
      .filter((row) => row.channel === "app")
      .map((row) => normalizeLiveNotification(row))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const previousKey = state.lastLiveNotificationKey;
    state.liveNotifications = notifications;
    const latest = notifications[0];
    const latestKey = latest ? `${latest.id}:${latest.status}` : "";
    if (latest && latestKey !== state.lastLiveNotificationKey) {
      state.lastLiveNotificationKey = latestKey;
      state.ticketHistory.unshift({ text: `${latest.title} · ${latest.body}`, tone: latest.tone });
    }
    return {
      ok: true,
      newNotification: previousKey && latest && latestKey !== previousKey ? latest : null,
    };
  } catch {
    return false;
  }
}

async function showNoticeAfterLiveSync() {
  await syncLiveNotices();
  showNoticeIfNeeded();
}

function pushPaymentRequestToShared(request) {
  const shared = loadSharedData();
  const paymentId = request.paymentId || `local_${Date.now()}_${request.productId}`;
  const nextRequest = {
    ...request,
    paymentId,
    member: state.profile.name,
    phone: state.profile.phone,
    requestedAt: new Date().toISOString(),
    source: "member-app",
  };
  shared.paymentRequests = [
    nextRequest,
    ...(shared.paymentRequests || []).filter((item) => item.paymentId !== paymentId),
  ].slice(0, 30);
  saveSharedData(shared);
}

function pushMakeupRequestToShared(request) {
  const shared = loadSharedData();
  const payload = {
    id: request.id,
    member: currentMemberName(),
    original: request.absence,
    requested: request.makeup,
    reason: request.reason,
    policy: request.policy,
    status: request.status.includes("자동") ? "자동 변경 완료" : "승인 대기",
    requestedAt: new Date().toISOString(),
    source: "member-app",
  };
  shared.makeupRequests = [
    payload,
    ...(shared.makeupRequests || []).filter((item) => item.id !== payload.id),
  ].slice(0, 30);
  saveSharedData(shared);
}

function mediaItemsFromInput(input) {
  return [...(input?.files || [])].map((file) => ({
    name: file.name,
    type: file.type || "",
    url: URL.createObjectURL(file),
  }));
}

function mediaItemsFromNames(names = []) {
  return names.map((name) => {
    const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(name);
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    return {
      name,
      type: isVideo ? "video/demo" : isImage ? "image/demo" : "",
      url: "",
    };
  });
}

function normalizeMediaItems(log) {
  if (Array.isArray(log.mediaItems) && log.mediaItems.length) return log.mediaItems;
  return mediaItemsFromNames(log.mediaNames || []);
}

function renderMediaPreview(mediaItems = [], compact = false) {
  if (!mediaItems.length) return "";
  return `
    <div class="journal-media-grid ${compact ? "compact" : ""}">
      ${mediaItems
        .map((item) => {
          const isVideo = item.type?.startsWith("video") || /\.(mp4|mov|webm|m4v)$/i.test(item.name || "");
          const isImage = item.type?.startsWith("image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name || "");
          if (item.url && isVideo) {
            return `
              <figure class="journal-media-item video">
                <video src="${item.url}" controls playsinline preload="metadata"></video>
                <figcaption>${item.name}</figcaption>
              </figure>`;
          }
          if (item.url && isImage) {
            return `
              <figure class="journal-media-item image">
                <img src="${item.url}" alt="${item.name}" loading="lazy" />
                <figcaption>${item.name}</figcaption>
              </figure>`;
          }
          return `<b class="media-chip">${item.name}</b>`;
        })
        .join("")}
    </div>`;
}

function curriculumById(id, fallback) {
  const canonicalId = curriculumCatalog.aliases?.[id] || id;
  return curriculumSteps.find((step) => step.id === canonicalId) || fallback || curriculumSteps[0];
}

function latestCurriculumLog() {
  return state.lessonLogs.find((log) => log.nextCurriculumId || log.curriculum?.id) || state.lessonLogs[0] || null;
}

function activeCurriculumStep() {
  const latest = latestCurriculumLog();
  return curriculumById(latest?.nextCurriculumId || latest?.curriculum?.id, latest?.curriculum);
}

function curriculumStageCards() {
  const active = activeCurriculumStep();
  const track = curriculumSkillTracks.find((item) => item.steps.some((step) => step.id === active.id));
  const trackSteps = track?.steps?.length ? track.steps : curriculumSteps;
  const activeIndex = Math.max(0, trackSteps.findIndex((step) => step.id === active.id));
  const review = trackSteps[Math.max(0, activeIndex - 1)] || active;
  const next = trackSteps[Math.min(trackSteps.length - 1, activeIndex + 1)] || active;
  return [
    { label: "현재 단계", step: active, tone: "current" },
    { label: "다음 단계", step: next, tone: "next" },
    { label: "복습 추천", step: review, tone: "review" },
  ];
}

function syncConfirmationsFromCoach() {
  const shared = loadSharedData();
  state.lessonLogs.forEach((log) => {
    const sharedLog = shared.lessonLogs.find((item) => item.id === log.id);
    if (!sharedLog) return;
    const wasConfirmed = log.status === "confirmed";
    log.status = sharedLog.status;
    log.coachComment = sharedLog.coachComment || log.coachComment || "";
    log.nextCurriculumId = sharedLog.nextCurriculumId || log.nextCurriculumId || log.curriculum?.id;
    log.curriculum = curriculumById(log.nextCurriculumId, log.curriculum);
    log.memberVisibleSummary = sharedLog.memberVisibleSummary || log.memberVisibleSummary || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    if (!wasConfirmed && log.status === "confirmed" && !log.ticketDeducted && state.remaining > 0) {
      state.remaining -= 1;
      log.ticketDeducted = true;
      state.ticketHistory.unshift({ text: `${lessonReviewTitle(log)} · 1회 차감`, tone: "done" });
      if (state.remaining === 2) {
        state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
      }
    }
  });
}

function pushLessonLogToShared(log) {
  const shared = loadSharedData();
  const payload = {
    id: log.id,
    member: "김서준",
    lessonLabel: log.lessonLabel,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculum.id,
    nextCurriculumId: log.nextCurriculumId || log.curriculum.id,
    coachComment: log.coachComment || "",
    memberVisibleSummary: log.memberVisibleSummary || "",
    mediaNames: log.mediaNames || [],
    mediaItems: normalizeMediaItems(log).map((item) => ({ name: item.name, type: item.type })),
    journalDate: log.journalDate,
    status: log.status,
    submittedAt: log.submittedAt,
  };
  const index = shared.lessonLogs.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.lessonLogs[index] = payload;
  else shared.lessonLogs.unshift(payload);
  saveSharedData(shared);
}
function syncPracticeFeedbackFromCoach() {
  const shared = loadSharedData();
  state.practiceLogs.forEach((log) => {
    const sharedRequest = shared.feedbackRequests.find((item) => item.id === log.id);
    if (!sharedRequest) return;
    log.feedbackStatus = sharedRequest.status;
    log.coachFeedback = sharedRequest.coachFeedback || log.coachFeedback || "";
    if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
  });
}

function pushPracticeFeedbackToShared(log) {
  const shared = loadSharedData();
  const payload = {
    id: log.id,
    member: "김서준",
    type: log.type,
    date: log.date,
    memo: log.memo,
    next: log.next,
    question: log.feedbackQuestion,
    mediaNames: log.mediaNames,
    mediaItems: normalizeMediaItems(log).map((item) => ({ name: item.name, type: item.type })),
    coachFeedback: log.coachFeedback || "",
    status: log.feedbackStatus,
    submittedAt: log.submittedAt,
  };
  const index = shared.feedbackRequests.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.feedbackRequests[index] = payload;
  else shared.feedbackRequests.unshift(payload);
  saveSharedData(shared);
}

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) return;
    if (snapshot.state) Object.assign(state, snapshot.state);
    if (Array.isArray(snapshot.lessons)) lessons.splice(0, lessons.length, ...snapshot.lessons);
    const visibleLessons = lessons.filter((lesson) => !["무인", "볼머신"].some((word) => `${lesson.coach} ${lesson.type}`.includes(word)));
    lessons.splice(0, lessons.length, ...visibleLessons);
    state.lessonLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    state.practiceLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    if (!Array.isArray(state.expiredTickets)) state.expiredTickets = [];
    if (!Array.isArray(state.liveMembershipProducts)) state.liveMembershipProducts = [];
    if (!Array.isArray(state.liveTickets)) state.liveTickets = [];
    if (!state.memberEnrollment || typeof state.memberEnrollment !== "object") state.memberEnrollment = null;
    state.pendingPurchaseProductId = String(state.pendingPurchaseProductId || "");
    if (!["card", "naverpay", "kakaopay"].includes(state.selectedPaymentMethod)) state.selectedPaymentMethod = "card";
    if (!state.pushNotifications || typeof state.pushNotifications !== "object") {
      state.pushNotifications = {
        permission: "unknown",
        status: "checking",
        detail: "수업 일정과 회원권 만료를 알려드립니다.",
      };
    }
    if (!state.ticketSyncStatus || typeof state.ticketSyncStatus !== "object") {
      state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
    }
    if (state.pendingPaymentCheckStatus && typeof state.pendingPaymentCheckStatus !== "object") {
      state.pendingPaymentCheckStatus = null;
    }
    state.lastLiveTicketKey = state.lastLiveTicketKey || "";
    state.lessonLogPage = Number(state.lessonLogPage) || 0;
    state.ticketHistoryPage = Number(state.ticketHistoryPage) || 0;
    state.expiredTicketPage = Number(state.expiredTicketPage) || 0;
    state.practiceLogPage = Number(state.practiceLogPage) || 0;
    syncConfirmationsFromCoach();
    syncPracticeFeedbackFromCoach();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function ensureDemoPresentation() {
  if (state.demoPresentationVersion === 6) return;
  state.demoPresentationVersion = 6;
  state.remaining = 6;
  state.lessonLogs = [
    {
      id: "demo-log-1",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 4,
      content: "포핸드 연결, 짧은 공 전진 스텝",
      selfMemo: "타점이 늦어질 때 준비가 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "BH-R1",
      coachComment: "준비 자세는 좋아졌고, 전진할 때 라켓면만 더 고정하면 됩니다.",
      memberVisibleSummary: "다음 수업: 백핸드 리턴 준비",
      ticketDeducted: true,
      mediaNames: ["포핸드-레슨영상.mp4"],
      submittedAt: "2026-07-01T10:00:00.000Z",
      journalDate: "2026-07-01",
    },
    {
      id: "demo-log-2",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 5,
      content: "백핸드 리턴 타이밍",
      selfMemo: "스플릿 스텝 후 어깨 회전이 늦었습니다.",
      status: "coach_pending",
      curriculum: curriculumSteps[1],
      nextCurriculumId: "BH-R1",
      coachComment: "",
      memberVisibleSummary: "",
      ticketDeducted: false,
      mediaNames: ["백핸드-리턴.jpg"],
      submittedAt: "2026-07-03T10:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "demo-log-3",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 3,
      content: "포핸드 크로스 코스와 회복 스텝",
      selfMemo: "크로스 방향은 좋아졌지만 회복이 늦었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[2],
      nextCurriculumId: "FH-C01",
      coachComment: "방향은 안정됐고, 타구 후 첫 발 회복만 더 빠르게 가져가면 됩니다.",
      memberVisibleSummary: "다음 수업: 포핸드 크로스 반복",
      ticketDeducted: true,
      mediaNames: ["포핸드-크로스.jpg"],
      submittedAt: "2026-06-28T10:00:00.000Z",
      journalDate: "2026-06-28",
    },
    {
      id: "demo-log-4",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 2,
      content: "풋워크 입문, 스플릿 스텝",
      selfMemo: "공을 기다릴 때 발이 멈추는 습관이 있었습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[3],
      nextCurriculumId: "ST-01",
      coachComment: "공이 오기 전 작게 뛰는 리듬은 좋아졌습니다.",
      memberVisibleSummary: "다음 수업: 첫 발 반응",
      ticketDeducted: true,
      mediaNames: ["풋워크-스플릿.mp4"],
      submittedAt: "2026-06-25T10:00:00.000Z",
      journalDate: "2026-06-25",
    },
    {
      id: "demo-log-5",
      lessonId: "mon-1840",
      lessonLabel: "월 18:40 · 노 코치",
      round: 1,
      content: "기본 준비 자세와 포핸드 제자리 컨트롤",
      selfMemo: "라켓면을 오래 유지하는 게 어려웠습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "FH-01",
      coachComment: "손목을 쓰기보다 어깨 회전으로 보내는 감각을 유지하세요.",
      memberVisibleSummary: "다음 수업: 포핸드 연결",
      ticketDeducted: true,
      mediaNames: ["기본자세-demo.jpg"],
      submittedAt: "2026-06-21T10:00:00.000Z",
      journalDate: "2026-06-21",
    },
    {
      id: "demo-log-6",
      lessonId: "wed-2000",
      lessonLabel: "수 20:00 · 노 코치",
      round: 0,
      content: "체험 레슨, 레벨 체크와 목표 설정",
      selfMemo: "랠리가 길어질수록 자세가 무너졌습니다.",
      status: "confirmed",
      curriculum: curriculumSteps[0],
      nextCurriculumId: "GM-01",
      coachComment: "기본기는 충분히 시작 가능하고, 포핸드 안정화부터 진행하면 좋겠습니다.",
      memberVisibleSummary: "다음 수업: 등록 후 포핸드 기본",
      ticketDeducted: true,
      mediaNames: ["체험레슨-demo.jpg"],
      submittedAt: "2026-06-18T10:00:00.000Z",
      journalDate: "2026-06-18",
    },
  ];
  state.practiceLogs = [
    {
      id: "practice-demo-1",
      date: "2026. 7. 2.",
      type: "레슨복습",
      memo: "포핸드 전진 스텝 30분, 짧은 공 접근 연습",
      next: "라켓면 고정 후 크로스 방향으로 보내기",
      mediaNames: ["포핸드-전진스텝.mp4"],
      feedbackQuestion: "전진할 때 타점이 늦는지 봐주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고, 마지막 스텝만 조금 늦습니다.",
      submittedAt: "2026-07-02T11:00:00.000Z",
      journalDate: "2026-07-02",
    },
    {
      id: "practice-demo-2",
      date: "2026. 7. 3.",
      type: "랠리 및 게임",
      memo: "친구와 랠리 40분, 백핸드 리턴 타이밍 확인",
      next: "리턴 후 첫 발 회복 연습",
      mediaNames: ["랠리-백핸드.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-07-03T12:00:00.000Z",
      journalDate: "2026-07-03",
    },
    {
      id: "practice-demo-3",
      date: "2026. 6. 30.",
      type: "개인연습",
      memo: "포핸드 크로스 20분, 준비 자세 반복",
      next: "타구 후 회복 스텝",
      mediaNames: ["포핸드-크로스-복습.mp4"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-30T12:00:00.000Z",
      journalDate: "2026-06-30",
    },
    {
      id: "practice-demo-4",
      date: "2026. 6. 27.",
      type: "랠리 및 게임",
      memo: "친구와 랠리, 짧은 공 접근 연습",
      next: "짧은 공에서 라켓면 고정",
      mediaNames: ["짧은공-접근.jpg"],
      feedbackQuestion: "앞으로 들어갈 때 스윙이 커지는지 확인해주세요.",
      feedbackStatus: "코치 피드백 요청",
      coachFeedback: "첫 발은 좋아졌고 마지막 스텝을 더 작게 가져가면 안정됩니다.",
      submittedAt: "2026-06-27T12:00:00.000Z",
      journalDate: "2026-06-27",
    },
    {
      id: "practice-demo-5",
      date: "2026. 6. 23.",
      type: "개인연습",
      memo: "백핸드 준비 자세와 어깨 회전 연습",
      next: "스플릿 스텝 후 어깨 먼저 돌리기",
      mediaNames: ["백핸드-준비자세.mov"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-23T12:00:00.000Z",
      journalDate: "2026-06-23",
    },
    {
      id: "practice-demo-6",
      date: "2026. 6. 19.",
      type: "기타",
      memo: "서브 토스 위치 확인과 루틴 연습",
      next: "토스 높이 일정하게 맞추기",
      mediaNames: ["서브-토스.jpg"],
      feedbackQuestion: "",
      feedbackStatus: "개인 기록",
      coachFeedback: "",
      submittedAt: "2026-06-19T12:00:00.000Z",
      journalDate: "2026-06-19",
    },
  ];
  state.ticketHistory = [
    { text: "7/3 수업기록 제출 · 피드백 대기", tone: "wait" },
    { text: "7/1 4회차 수업 완료 · 1회 차감", tone: "done" },
    { text: "잔여 6회 · 정상 이용중", tone: "done" },
  ];
  if (!state.makeupRequests.length) {
    state.makeupRequests = [
      {
        absence: "수 20:00 기존 수업",
        makeup: "금 19:00 수업 변경 희망 · 강 코치",
        reason: "회사 일정",
        policy: "24시간 이전 요청이라 자동 변경됩니다.",
        status: "자동 변경 완료",
      },
    ];
  }
}

function normalizeMemberName(name = "") {
  return String(name).replace(/\s*회원$/u, "").trim();
}

function currentMemberName() {
  return normalizeMemberName(state.member?.name || state.profile?.name || "");
}

function isCurrentMemberName(name = "") {
  const normalized = normalizeMemberName(name);
  const current = currentMemberName();
  return Boolean(normalized && current && normalized === current);
}

function ensureScheduleBaseline() {
  if (state.dataMode === "live") return;
  const baseline = [
    { id: "mon-1840", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "wed-2000", day: "수", time: "20:00", coach: "노 코치", member: "김서준", type: "정규", status: "scheduled" },
    { id: "mon-1900", day: "월", time: "19:00", coach: "강 코치", member: "최유나&이하린", type: "정규", status: "occupied" },
    { id: "mon-1900-no", day: "월", time: "19:00", coach: "노 코치", member: "윤서준", type: "정규", status: "occupied" },
    { id: "tue-1920", day: "화", time: "19:20", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "thu-1940", day: "목", time: "19:40", coach: "노 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "fri-1900", day: "금", time: "19:00", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "auto" },
    { id: "sat-2020", day: "토", time: "20:20", coach: "강 코치", member: "", type: "수업 변경 가능", status: "available", policy: "coach" },
    { id: "thu-2020", day: "목", time: "20:20", coach: "강 코치", member: "박민재", type: "정규", status: "occupied" },
    { id: "fri-2050", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규", status: "occupied" },
    { id: "sat-1840", day: "토", time: "18:40", coach: "황 코치", member: "임현우", type: "정규", status: "occupied" },
  ];
  baseline.forEach((item) => {
    const existing = lessons.find((lesson) => lesson.id === item.id);
    if (existing) {
      if (existing.type.includes("보강") || existing.type.includes("변경")) existing.type = "수업 변경 가능";
      existing.policy = existing.policy || item.policy;
      if (!existing.status && existing.member && !isCurrentMemberName(existing.member)) existing.status = "occupied";
      return;
    }
    lessons.push(item);
  });
}

function saveSnapshot() {
  localStorage.setItem(storageKey, JSON.stringify({ state, lessons }));
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

let deferredPwaInstallPrompt = null;

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updatePwaInstallButtons() {
  const canInstall = Boolean(deferredPwaInstallPrompt) && !isStandalonePwa();
  $$("[data-install-pwa]").forEach((button) => {
    button.hidden = !canInstall;
  });
}

async function promptPwaInstall() {
  if (!deferredPwaInstallPrompt) return;
  deferredPwaInstallPrompt.prompt();
  await deferredPwaInstallPrompt.userChoice.catch(() => null);
  deferredPwaInstallPrompt = null;
  updatePwaInstallButtons();
}

function registerPwaInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPwaInstallPrompt = event;
    updatePwaInstallButtons();
  });
  window.addEventListener("appinstalled", () => {
    deferredPwaInstallPrompt = null;
    updatePwaInstallButtons();
  });
  updatePwaInstallButtons();
}

function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    let controllerChanged = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (controllerChanged) return;
      controllerChanged = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => undefined))
      .catch(() => undefined);
  });
}

const pushDeviceStorageKey = "tennis-note-push-device-id";
let pushListenersReady = false;
let pushProfileId = "";

function nativePushPlugin() {
  return window.TennisNoteNativePush || window.Capacitor?.Plugins?.PushNotifications || null;
}

function nativeAppPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function currentPushDeviceId() {
  let deviceId = localStorage.getItem(pushDeviceStorageKey) || "";
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(pushDeviceStorageKey, deviceId);
  }
  return deviceId;
}

function setPushNotificationState(permission, status, detail) {
  state.pushNotifications = { permission, status, detail };
  renderPushNotificationSettings();
  saveSnapshot();
}

function renderPushNotificationSettings() {
  const card = $(".push-settings-card");
  const status = $("#pushNotificationStatus");
  const detail = $("#pushNotificationDetail");
  const button = $("#pushNotificationButton");
  if (!card || !status || !detail || !button) return;

  if (["pending", "reviewing", "completed"].includes(state.accountDeletionRequest?.status || "")) {
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
  button.textContent = permission === "granted" ? "알림 다시 연결" : permission === "denied" ? "설정 확인" : "알림 허용";
}

function renderAccountDeletionSettings() {
  const card = $(".account-settings-card");
  const status = $("#accountDeletionStatus");
  const detail = $("#accountDeletionDetail");
  const button = $("#openAccountDeletionButton");
  if (!card || !status || !detail || !button) return;

  const request = state.accountDeletionRequest;
  const requestStatus = request?.status || "";
  card.classList.toggle("is-pending", ["pending", "reviewing"].includes(requestStatus));
  card.classList.toggle("is-completed", requestStatus === "completed");
  button.disabled = requestStatus === "reviewing" || requestStatus === "completed";

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

function openAccountDeletionModal() {
  const client = window.TennisNoteDataClient;
  if (!state.member?.profileId || !client?.getSession?.()?.access_token) {
    showToast("로그인한 회원만 탈퇴 요청을 접수할 수 있습니다");
    return;
  }
  $("#accountDeletionForm")?.reset();
  if ($("#accountDeletionMessage")) $("#accountDeletionMessage").textContent = "요청 접수 후 관리자가 처리 상태를 확인합니다.";
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = false;
}

function closeAccountDeletionModal() {
  if ($("#accountDeletionModal")) $("#accountDeletionModal").hidden = true;
}

async function submitAccountDeletionRequest(event) {
  event?.preventDefault?.();
  const message = $("#accountDeletionMessage");
  if (!$("#accountDeletionConfirm")?.checked) {
    if (message) message.textContent = "탈퇴 및 알림 중단 확인에 체크해 주세요.";
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token || !state.member?.profileId) {
    if (message) message.textContent = "회원 로그인과 서버 연결을 확인해 주세요.";
    return;
  }

  try {
    await client.rpc("tn_request_account_deletion", {
      target_reason: $("#accountDeletionReason")?.value?.trim() || "",
    });
    await disableNativePushForLogout();
    await syncMemberAccountDeletionRequestFromServer();
    closeAccountDeletionModal();
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("회원 탈퇴 및 데이터 삭제 요청이 접수되었습니다");
  } catch {
    if (message) message.textContent = "요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

async function cancelAccountDeletionRequest() {
  const request = state.accountDeletionRequest;
  const client = window.TennisNoteDataClient;
  if (!request?.id || request.status !== "pending" || !client?.rpc) return;
  if (!window.confirm("회원 탈퇴 및 데이터 삭제 요청을 취소할까요?")) return;
  try {
    await client.rpc("tn_cancel_account_deletion", { target_request_id: request.id });
    await syncMemberAccountDeletionRequestFromServer();
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("탈퇴 요청을 취소했습니다");
  } catch {
    showToast("검토가 시작된 요청은 앱에서 취소할 수 없습니다");
  }
}

async function registerPushToken(tokenValue) {
  const client = window.TennisNoteDataClient;
  if (["pending", "reviewing", "completed"].includes(state.accountDeletionRequest?.status || "")) return false;
  if (!tokenValue || !pushProfileId || !client?.rpc || !client.getSession?.()?.access_token) return false;
  await client.rpc("tn_register_push_device", {
    target_platform: "android",
    target_device_id: currentPushDeviceId(),
    target_push_token: tokenValue,
  });
  setPushNotificationState("granted", "앱 알림 켜짐", "수업 하루 전·30분 전과 회원권 안내를 잠금화면으로 알려드립니다.");
  return true;
}

async function bindNativePushListeners(plugin) {
  if (pushListenersReady) return;
  await plugin.addListener("registration", async (token) => {
    try {
      await registerPushToken(token?.value || "");
    } catch {
      setPushNotificationState("granted", "알림 연결 확인 필요", "앱 로그인과 서버 설정을 확인한 뒤 다시 연결해 주세요.");
    }
  });
  await plugin.addListener("registrationError", () => {
    setPushNotificationState("unknown", "알림 등록 실패", "Firebase 앱 설정을 확인한 뒤 다시 시도해 주세요.");
  });
  await plugin.addListener("pushNotificationReceived", async () => {
    await syncMemberNotificationsFromServer().catch(() => false);
    showNoticeIfNeeded();
  });
  await plugin.addListener("pushNotificationActionPerformed", async (action) => {
    const route = String(action?.notification?.data?.route || "").trim().toLowerCase();
    const viewId = route === "membership" ? "shopView" : route === "schedule" ? "scheduleView" : "homeView";
    setView(viewId);
    jumpToTop();
    await syncMemberNotificationsFromServer().catch(() => false);
  });
  pushListenersReady = true;
}

async function syncNativePushRegistration(profile = null, requestPermission = false) {
  const plugin = nativePushPlugin();
  const platform = nativeAppPlatform();
  const profileId = profile?.id || state.member?.profileId || "";
  pushProfileId = profileId;

  if (["pending", "reviewing", "completed"].includes(state.accountDeletionRequest?.status || "")) {
    const client = window.TennisNoteDataClient;
    if (client?.getSession?.()?.access_token && client?.rpc) {
      await client.rpc("tn_disable_push_device", { target_device_id: currentPushDeviceId() }).catch(() => null);
    }
    // The backend device record is disabled above. Avoid the native
    // unregister call here as well because it can terminate an Android app
    // whose Firebase runtime has not been initialized yet.
    pushProfileId = "";
    setPushNotificationState("disabled", "탈퇴 요청으로 알림 중지", "계정 삭제 요청을 처리하는 동안 새 기기 알림을 등록하지 않습니다.");
    return false;
  }

  if (platform !== "android" || !plugin) {
    const isIos = platform === "ios";
    setPushNotificationState(
      "unavailable",
      isIos ? "iPhone 알림 준비 중" : "설치 앱에서 사용 가능",
      isIos ? "TestFlight 단계에서 Apple 알림 인증을 연결합니다." : "Play 스토어용 앱에서 수업·회원권 알림을 켤 수 있습니다.",
    );
    return false;
  }
  if (!profileId || !window.TennisNoteDataClient?.getSession?.()?.access_token) {
    setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
    return false;
  }

  await bindNativePushListeners(plugin);
  await plugin.createChannel({
    id: "lesson-reminders",
    name: "수업·회원권 알림",
    description: "수업 일정과 회원권 만료 알림",
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

  let permission = await plugin.checkPermissions();
  if (requestPermission && ["prompt", "prompt-with-rationale"].includes(permission.receive)) {
    permission = await plugin.requestPermissions();
  }
  if (permission.receive === "denied") {
    setPushNotificationState("denied", "휴대폰 알림이 꺼져 있음", "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.");
    return false;
  }
  if (permission.receive !== "granted") {
    setPushNotificationState("prompt", "알림 허용 필요", "알림 허용을 누르면 하루 전과 30분 전에 알려드립니다.");
    return false;
  }

  setPushNotificationState("granted", "앱 알림 연결 중", "기기 알림 토큰을 안전하게 등록하고 있습니다.");
  await plugin.register();
  return true;
}

async function disableNativePushForLogout() {
  const client = window.TennisNoteDataClient;
  if (client?.getSession?.()?.access_token && client?.rpc) {
    await client.rpc("tn_disable_push_device", {
      target_device_id: currentPushDeviceId(),
    }).catch(() => null);
  }
  // The server-side device record above is the authoritative push opt-out.
  // Calling the Android plugin's unregister method without an initialized
  // Firebase app terminates the whole native process instead of rejecting.
  // Keep the native registration intact and let the next signed-in session
  // refresh it after Firebase is available.
  pushProfileId = "";
  setPushNotificationState("unknown", "로그인 후 알림 설정", "회원 로그인 후 기기 알림을 연결할 수 있습니다.");
}

function makeMemberTimeRange(startTime, endTime, stepMinutes = 10) {
  const result = [];
  for (let current = minutesFromTime(startTime); current <= minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function defaultMemberCoachPolicy() {
  const weekdays = days.slice(0, 5);
  const weekend = days.slice(5);
  return {
    openStart: "06:40",
    openEnd: "22:00",
    breakRules: [{ id: "weekday-midday", days: weekdays, start: "13:00", end: "17:00", label: "수업 없음" }],
    lessonColors: { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" },
    coaches: [
      {
        id: "coach-no",
        name: "노 코치",
        status: "active",
        workBlocks: [
          { id: "coach-no-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" },
          { id: "coach-no-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" },
        ],
      },
      {
        id: "coach-hwang",
        name: "황 코치",
        status: "active",
        workBlocks: [{ id: "coach-hwang-am", days: weekdays, start: "06:40", end: "13:00", label: "오전" }],
      },
      {
        id: "coach-kang",
        name: "강 코치",
        status: "active",
        workBlocks: [{ id: "coach-kang-pm", days: weekdays, start: "17:00", end: "22:00", label: "오후" }],
      },
      {
        id: "coach-park",
        name: "박창준 코치",
        status: "active",
        workBlocks: [{ id: "coach-park-weekend", days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }],
      },
    ],
  };
}

function memberDefaultWorkBlocksForCoach(coach) {
  const weekdays = days.slice(0, 5);
  const weekend = days.slice(5);
  if (coach.id === "coach-no" || coach.availability === "split") {
    return [
      { id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" },
      { id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" },
    ];
  }
  if (coach.id === "coach-hwang" || coach.availability === "weekday-am") {
    return [{ id: `${coach.id}-am`, days: weekdays, start: "06:40", end: "13:00", label: "오전" }];
  }
  if (coach.id === "coach-kang" || coach.availability === "weekday-pm") {
    return [{ id: `${coach.id}-pm`, days: weekdays, start: "17:00", end: "22:00", label: "오후" }];
  }
  if (coach.id === "coach-park" || coach.availability === "weekend") {
    return [{ id: `${coach.id}-weekend`, days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }];
  }
  return [{ id: `${coach.id || "coach"}-all`, days, start: "06:40", end: "22:00", label: "전체" }];
}

function normalizeMemberCoach(coach) {
  const normalized = { ...coach };
  normalized.id = normalized.id || memberCoachKey(normalized.name) || `coach-${normalized.name || Date.now()}`;
  normalized.name = normalized.name || "이름 없음";
  normalized.status = normalized.status || "active";
  normalized.workBlocks = Array.isArray(normalized.workBlocks) && normalized.workBlocks.length
    ? normalized.workBlocks
    : memberDefaultWorkBlocksForCoach(normalized);
  normalized.workBlocks = normalized.workBlocks
    .map((block, index) => ({
      id: block.id || `${normalized.id}-block-${index}`,
      days: Array.isArray(block.days) && block.days.length ? block.days : days,
      start: block.start || "06:40",
      end: block.end || "22:00",
      label: block.label || "근무",
    }))
    .filter((block) => minutesFromTime(block.start) < minutesFromTime(block.end));
  if (!normalized.workBlocks.length) normalized.workBlocks = memberDefaultWorkBlocksForCoach(normalized);
  return normalized;
}

function loadAdminSchedulePolicy() {
  const fallback = defaultMemberCoachPolicy();
  try {
    const snapshot = readAdminSnapshot();
    if (!snapshot) return fallback;
    const scheduleSettings = snapshot.scheduleSettings || {};
    const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
    const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches) && snapshot.coaches.length
      ? snapshot.coaches
      : fallback.coaches;
    const coaches = savedCoaches.concat(fallback.coaches.filter((fallbackCoach) => !savedCoaches.some((coach) => coach.id === fallbackCoach.id)));
    return {
      openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
      openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
      breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
      lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
      lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
      coaches: coaches
        .filter((coach) => (coach.status || "active") === "active")
        .map(normalizeMemberCoach),
    };
  } catch {
    localStorage.removeItem(adminStorageKey);
    return fallback;
  }
}

function readAdminSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(adminStorageKey) || "null");
  } catch {
    localStorage.removeItem(adminStorageKey);
    return null;
  }
}

function writeLiveSchedulePolicySnapshot(value = {}) {
  if (!value || typeof value !== "object") return false;
  const existing = readAdminSnapshot() || {};
  const scheduleSettings = value.scheduleSettings || {};
  const coaches = Array.isArray(value.coaches) ? value.coaches : [];
  if (!scheduleSettings.openStart && !scheduleSettings.openEnd && !coaches.length) return false;
  localStorage.setItem(adminStorageKey, JSON.stringify({
    ...existing,
    scheduleSettings: {
      ...(existing.scheduleSettings || {}),
      ...scheduleSettings,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : existing.scheduleSettings?.breakRules || [],
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
    },
    coaches: coaches.length ? coaches : existing.coaches || [],
  }));
  return true;
}

async function syncLiveSchedulePolicy() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: liveSchedulePolicyKey },
      limit: 1,
    });
    return writeLiveSchedulePolicySnapshot(rows?.[0]?.value);
  } catch (error) {
    return false;
  }
}

function adminCoachNameForLesson(lesson, snapshot) {
  const coach = (snapshot?.coaches || []).find((item) => item.id === lesson.coachId);
  return coach?.name || lesson.coach || "미지정 코치";
}

function normalizeAdminLessonForMember(lesson, snapshot) {
  const coach = adminCoachNameForLesson(lesson, snapshot);
  const rawText = `${lesson.type || ""} ${lesson.status || ""} ${coach}`;
  if (/무인|볼머신/.test(rawText)) return null;
  const memberName = lesson.member === "빈자리" || lesson.member === "보강대기" ? "" : lesson.member || "";
  const isAvailable = lesson.status === "available" || !memberName;
  const isMine = isCurrentMemberName(memberName);
  const isPending = lesson.status === "pending" || /요청|접수/.test(rawText);
  return {
    id: `admin-${lesson.id}`,
    day: lesson.day,
    time: lesson.time,
    coach,
    member: memberName,
    type: isAvailable ? "수업 변경 가능" : isPending && isMine ? "수업 변경 요청" : "정규",
    status: isAvailable ? "available" : isPending && isMine ? "requested" : isMine ? "scheduled" : "occupied",
    policy: isPending ? "coach" : "auto",
    durationMinutes: Number(lesson.durationMinutes) || 20,
    lessonSource: lesson.lessonSource || (lesson.makeup ? "makeup" : "regular"),
    source: "admin",
  };
}

function adminMemberScheduleLessons() {
  const snapshot = readAdminSnapshot();
  if (!snapshot || !Array.isArray(snapshot.lessons)) return [];
  return snapshot.lessons
    .map((lesson) => normalizeAdminLessonForMember(lesson, snapshot))
    .filter(Boolean);
}

function memberCoachKey(name = "") {
  if (name.includes("노")) return "coach-no";
  if (name.includes("강")) return "coach-kang";
  if (name.includes("황")) return "coach-hwang";
  if (name.includes("박")) return "coach-park";
  return "";
}

function memberCoachOrder(id = "") {
  const order = ["coach-no", "coach-hwang", "coach-kang", "coach-park"];
  const index = order.indexOf(id);
  return index >= 0 ? index : order.length;
}

function memberCoachShortName(name = "") {
  return name.replace(" 코치", "").replace("코치", "").trim();
}

function memberLessonCoach(lesson, policy) {
  const key = memberCoachKey(lesson.coach);
  return policy.coaches.find((coach) => coach.id === key)
    || policy.coaches.find((coach) => coach.name === lesson.coach)
    || normalizeMemberCoach({ id: key || lesson.coach, name: lesson.coach || "미지정 코치" });
}

function memberBreakRuleForSlot(policy, day, time) {
  const current = minutesFromTime(time);
  return (policy.breakRules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    return current >= minutesFromTime(rule.start) && current < minutesFromTime(rule.end);
  });
}

function memberBreakRuleOverlaps(policy, day, time, durationMinutes = 20) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (policy.breakRules || []).find((rule) => {
    if (!Array.isArray(rule.days) || !rule.days.includes(day)) return false;
    const ruleStart = minutesFromTime(rule.start);
    const ruleEnd = minutesFromTime(rule.end);
    return start < ruleEnd && ruleStart < end;
  });
}

function isMemberCoachWorking(coach, day, time, durationMinutes = 10) {
  const start = minutesFromTime(time);
  const end = start + durationMinutes;
  return (coach.workBlocks || []).some((block) => {
    if (!block.days.includes(day)) return false;
    return start >= minutesFromTime(block.start) && end <= minutesFromTime(block.end);
  });
}

function memberScheduleTimes(policy = loadAdminSchedulePolicy()) {
  const range = state.scheduleTimeRange || "lesson";
  const allStart = policy.openStart;
  const allEnd = policy.openEnd;
  if (range === "morning") return makeMemberTimeRange(allStart, "12:00");
  if (range === "afternoon") return makeMemberTimeRange("12:00", "17:00");
  if (range === "evening") return makeMemberTimeRange("17:00", allEnd);
  if (range === "all") return makeMemberTimeRange(allStart, allEnd);
  const openStartMinutes = minutesFromTime(allStart);
  const openEndMinutes = minutesFromTime(allEnd);
  const allScheduleLessons = memberScheduleLessons().filter((lesson) => {
    const start = minutesFromTime(lesson.time);
    const serverStatus = lesson.serverStatus || lesson.status;
    return lesson.status !== "available"
      && serverStatus !== "completed"
      && start >= openStartMinutes
      && start < openEndMinutes;
  });
  const ownScheduleLessons = allScheduleLessons.filter((lesson) => lesson.isOwnLesson || isCurrentMemberName(lesson.member));
  const scheduleLessons = ownScheduleLessons.length ? ownScheduleLessons : allScheduleLessons;
  if (!scheduleLessons.length) return makeMemberTimeRange("17:00", allEnd);
  const starts = scheduleLessons.map((lesson) => minutesFromTime(lesson.time));
  const ends = scheduleLessons.map((lesson) => minutesFromTime(lesson.time) + lessonDuration(lesson));
  const start = Math.max(minutesFromTime(allStart), Math.floor((Math.min(...starts) - 30) / 10) * 10);
  const end = Math.min(minutesFromTime(allEnd), Math.ceil((Math.max(...ends) + 30) / 10) * 10);
  if (end <= start) return makeMemberTimeRange("17:00", allEnd);
  const startText = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const endText = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return makeMemberTimeRange(startText, endText);
}

function scheduleTimeRangeOptions() {
  return [
    { id: "lesson", label: "추천" },
    { id: "morning", label: "오전" },
    { id: "evening", label: "저녁" },
    { id: "all", label: "전체" },
  ];
}

function memberDayCoaches(day, policy, scheduleLessons = []) {
  const working = policy.coaches.filter((coach) => (coach.workBlocks || []).some((block) => block.days.includes(day)));
  const lessonCoaches = scheduleLessons
    .filter((lesson) => lesson.day === day && lesson.status !== "available")
    .map((lesson) => memberLessonCoach(lesson, policy));
  return working
    .concat(lessonCoaches)
    .filter((coach, index, array) => array.findIndex((item) => item.id === coach.id) === index)
    .sort((a, b) => memberCoachOrder(a.id) - memberCoachOrder(b.id));
}

function hasMemberCoachLessonAt(scheduleLessons, day, time, coach, durationMinutes = 10, policy = loadAdminSchedulePolicy()) {
  const slotStart = minutesFromTime(time);
  const slotEnd = slotStart + durationMinutes;
  return scheduleLessons.some((lesson) => {
    if (lesson.status === "available" || lesson.day !== day) return false;
    const lessonCoach = memberLessonCoach(lesson, policy);
    if (lessonCoach.id !== coach.id) return false;
    const lessonStart = minutesFromTime(lesson.time);
    const lessonEnd = lessonStart + lessonDuration(lesson);
    return slotStart < lessonEnd && slotEnd > lessonStart;
  });
}

function makeMemberStartTimes(startTime, endTime, stepMinutes = 10) {
  const result = [];
  for (let current = minutesFromTime(startTime); current < minutesFromTime(endTime); current += stepMinutes) {
    result.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return result;
}

function memberCoachBookableTimes(coach, day) {
  return [...new Set((coach.workBlocks || [])
    .filter((block) => block.days.includes(day))
    .flatMap((block) => makeMemberStartTimes(block.start, block.end)))]
    .sort((left, right) => minutesFromTime(left) - minutesFromTime(right));
}

function memberScheduleDateForDay(day) {
  const week = activeMemberWeek();
  const dayIndex = days.indexOf(day);
  if (!week?.startDate || dayIndex < 0) return "";
  const date = new Date(`${week.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return localDateKey(date);
}

function memberChangePolicyForLesson(lesson) {
  const lessonDate = lesson?.lessonDate || memberScheduleDateForDay(lesson?.day);
  if (!lessonDate || !lesson?.time) return "coach";
  const lessonAt = new Date(`${lessonDate}T${lesson.time}:00`);
  return lessonAt.getTime() - Date.now() >= 24 * 60 * 60 * 1000 ? "auto" : "coach";
}

function activeTicketScheduleScope() {
  const ticket = currentLiveTicket();
  if (ticket?.scheduleScope) return ticket.scheduleScope;
  const title = `${ticket?.title || state.profile?.ticket || ""}`;
  return title.includes("주말") ? "weekend" : "weekday";
}

function sourceLessonScheduleScope(sourceLesson = {}) {
  const ticketId = sourceLesson.member_ticket_id || sourceLesson.ticketId || "";
  const ticket = (state.liveTickets || []).find((item) => item.id === ticketId);
  return ticket?.scheduleScope || activeTicketScheduleScope();
}

function memberOpenMakeupEntitlements() {
  return (state.liveMakeupEntitlements || []).filter((item) => item.status === "open");
}

function memberMakeupDueLessons() {
  const memberName = currentMemberName();
  return memberOpenMakeupEntitlements().map((item) => ({
    id: `makeup-due-${item.id}`,
    makeupEntitlementId: item.id,
    serverLessonId: item.sourceLessonId,
    member_ticket_id: item.ticketId,
    coach_role_id: item.coachRoleId,
    coachRoleId: item.coachRoleId,
    lessonDate: item.lessonDate,
    day: item.day,
    time: item.time,
    coach: item.coach,
    member: memberName,
    type: "보강 필요",
    status: "makeup_due",
    lessonSource: "makeup",
    durationMinutes: item.durationMinutes,
    reason: item.reason,
    isOwnLesson: true,
  }));
}

function memberReleasedMakeupSlot(lessonDate, time, coachRoleId, durationMinutes) {
  return (state.liveReleasedMakeupSlots || []).find((slot) => (
    slot.lessonDate === lessonDate
    && slot.time === time
    && slot.coachRoleId === coachRoleId
    && Number(slot.durationMinutes) === Number(durationMinutes)
  ));
}

function generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson = null) {
  const result = [];
  const sourceLesson = selectedLesson
    || scheduleLessons.find((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled" && lesson.serverLessonId)
    || scheduleLessons.find((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
  if (!sourceLesson) return result;
  const sourceCoach = memberLessonCoach(sourceLesson, policy);
  const durationMinutes = lessonDuration(sourceLesson);
  const scheduleScope = sourceLessonScheduleScope(sourceLesson);
  const isMakeupDue = Boolean(sourceLesson.makeupEntitlementId);
  const requestPolicy = isMakeupDue ? "auto" : memberChangePolicyForLesson(sourceLesson);
  days.forEach((day) => {
    const isWeekend = ["토", "일"].includes(day);
    if ((scheduleScope === "weekday" && isWeekend) || (scheduleScope === "weekend" && !isWeekend)) return;
    const lessonDate = memberScheduleDateForDay(day);
    const coaches = memberDayCoaches(day, policy, scheduleLessons).filter((coach) => coach.id === sourceCoach.id);
    coaches.forEach((coach) => {
      memberCoachBookableTimes(coach, day).forEach((time) => {
        if (memberBreakRuleOverlaps(policy, day, time, durationMinutes)) return;
        if (!isMemberCoachWorking(coach, day, time, durationMinutes)) return;
        if (hasMemberCoachLessonAt(scheduleLessons, day, time, coach, durationMinutes, policy)) return;
        const hasNearbyAnchor = scheduleLessons.some((lesson) => {
          if (lesson.day !== day || lesson.status === "available" || lesson.serverStatus === "pending_change") return false;
          if (memberLessonCoach(lesson, policy).id !== coach.id) return false;
          return Math.abs(minutesFromTime(lesson.time) - minutesFromTime(time)) <= 40;
        });
        const releasedSlot = memberReleasedMakeupSlot(lessonDate, time, coach.id, durationMinutes);
        if (!hasNearbyAnchor && !releasedSlot) return;
        const existing = scheduleLessons.some((lesson) => lesson.day === day && lesson.time === time && memberLessonCoach(lesson, policy).id === coach.id);
        if (existing) return;
        result.push({
          id: `auto-slot-${day}-${time}-${coach.id}`,
          day,
          time,
          coach: coach.name,
          coachRoleId: sourceLesson.coach_role_id || sourceLesson.coachRoleId || "",
          lessonDate,
          member: "",
          type: isMakeupDue ? "보강 신청가능" : "수업 변경 신청가능",
          status: "available",
          policy: requestPolicy,
          generated: true,
          durationMinutes,
          makeupEntitlementId: sourceLesson.makeupEntitlementId || "",
          releasedSlotId: releasedSlot?.id || "",
        });
      });
    });
  });
  return result;
}

function memberScheduleOptions() {
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedId = $("#absenceLesson")?.value;
  const sourceLessons = memberMakeupDueLessons().concat(
    scheduleLessons.filter((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled"),
  );
  const selectedLesson = sourceLessons.find((lesson) => lesson.id === selectedId)
    || scheduleLessons.find((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
  const generated = generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson);
  return scheduleLessons.concat(generated);
}

function memberAvailableSlotsForSelectedLesson() {
  const selectedId = $("#absenceLesson")?.value;
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedLesson = scheduleLessons.find((lesson) => lesson.id === selectedId) || currentScheduledLessonsForChange().find((lesson) => lesson.id === selectedId);
  const options = scheduleLessons.concat(generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson));
  const selectedCoachId = selectedLesson ? memberLessonCoach(selectedLesson, loadAdminSchedulePolicy()).id : "";
  return options.filter((lesson) => {
    if (lesson.status !== "available") return false;
    if (!selectedCoachId) return true;
    return memberLessonCoach(lesson, loadAdminSchedulePolicy()).id === selectedCoachId;
  });
}

function memberLessons() {
  const current = memberScheduleLessons().filter((lesson) => isCurrentMemberName(lesson.member) && ["scheduled", "requested"].includes(lesson.status));
  if (current.length || state.liveLessonsLoaded || state.dataMode === "live") return current;
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && ["scheduled", "requested"].includes(lesson.status));
}

function currentScheduledLessonsForChange() {
  const dueLessons = memberMakeupDueLessons();
  const fromSchedule = memberScheduleLessons().filter((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
  if (dueLessons.length || fromSchedule.length || state.liveLessonsLoaded || state.dataMode === "live") return dueLessons.concat(fromSchedule);
  return lessons.filter((lesson) => isCurrentMemberName(lesson.member) && lesson.status === "scheduled");
}

function activeMemberWeek() {
  const offset = Math.min(
    Math.max(Number(state.activeMemberWeekIndex) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  state.activeMemberWeekIndex = offset;
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  return {
    ...(offset >= 0 ? memberScheduleWeeks[offset] || {} : {}),
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    note: offset === 0 ? "이번 주 정규 수업과 변경 가능 시간" : "선택한 주의 수업과 변경 가능 시간",
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}

function memberScheduleLessons() {
  const liveLessons = (state.liveLessons || []).filter((lesson) => {
    const week = activeMemberWeek();
    if (!lesson.lessonDate || !week.startDate || !week.endDate) return true;
    return lesson.lessonDate >= week.startDate && lesson.lessonDate <= week.endDate;
  });
  if (state.dataMode === "live" || state.liveLessonsLoaded || liveLessons.length || state.liveLessons?.length) return liveLessons;
  const adminLessons = adminMemberScheduleLessons();
  if (state.activeMemberWeekIndex === 0 && adminLessons.length) {
    return adminLessons.map((adminLesson) => lessons.find((stored) => stored.id === adminLesson.id) || adminLesson);
  }
  const weekLessons = activeMemberWeek().lessons || [];
  if (!weekLessons.length && state.activeMemberWeekIndex !== 0) return [];
  const storedWeekIds = new Set(weekLessons.map((lesson) => lesson.id));
  const mergedWeekLessons = weekLessons.map((lesson) => lessons.find((stored) => stored.id === lesson.id) || lesson);
  return lessons.filter((lesson) => !storedWeekIds.has(lesson.id)).concat(mergedWeekLessons);
}

function ensureMemberScheduleLesson(lessonId) {
  let lesson = lessons.find((item) => item.id === lessonId);
  if (lesson) return lesson;
  const weekLesson = memberMakeupDueLessons().find((item) => item.id === lessonId)
    || memberScheduleOptions().find((item) => item.id === lessonId);
  if (!weekLesson) return null;
  lesson = { ...weekLesson };
  lessons.push(lesson);
  return lesson;
}

function nextMemberLesson() {
  return memberLessons()[0] || null;
}

function upcomingMemberLessons(limit = 2) {
  const dayOrder = new Map(days.map((day, index) => [day, index]));
  return memberLessons()
    .filter((lesson) => lesson.status === "scheduled")
    .sort((a, b) => {
      const dayDiff = (dayOrder.get(a.day) ?? 99) - (dayOrder.get(b.day) ?? 99);
      return dayDiff || minutesFromTime(a.time) - minutesFromTime(b.time);
    })
    .slice(0, limit);
}

function scheduleSummaryText(lesson, fallback) {
  if (!lesson) return fallback;
  return `${lesson.day} ${lesson.time}`;
}

function dayName(day) {
  return { 월: "월요일", 화: "화요일", 수: "수요일", 목: "목요일", 금: "금요일", 토: "토요일", 일: "일요일" }[day] || day;
}

function lessonRound() {
  return Math.max(1, 10 - state.remaining + 1);
}

function lessonReviewTitle(log) {
  const lesson = lessons.find((item) => item.id === log?.lessonId);
  const day = lesson ? dayName(lesson.day) : log?.lessonLabel?.split(" ")[0] || "이번";
  const round = log?.round || lessonRound();
  return `${day} ${round}회차 피드백`;
}

function policyLabel(policy) {
  return policy === "coach" ? "24h 이내" : "24h 이전";
}

function policyShortLabel(policy) {
  return policy === "coach" ? "24h내" : "24h전";
}

function policyDetail(policy) {
  return policy === "coach"
    ? "24시간 이내 요청이라 코치 승인이 필요합니다. 승인되지 않아도 당일 취소로 회원권은 차감됩니다."
    : "24시간 이전 요청이라 자동 변경됩니다.";
}

function memberScheduleCoachNames(scheduleLessons = []) {
  const preferred = ["노 코치", "강 코치", "황 코치"];
  const fromLessons = scheduleLessons.map((lesson) => lesson.coach).filter(Boolean);
  return [...new Set([...preferred, ...fromLessons])];
}

function shortCoachName(name = "") {
  return name.replace(" 코치", "");
}

function memberCoachColorClass(name = "") {
  if (name.includes("노")) return "coach-color-no";
  if (name.includes("강")) return "coach-color-kang";
  if (name.includes("황")) return "coach-color-hwang";
  if (name.includes("박")) return "coach-color-park";
  return "coach-color-default";
}

function minutesFromTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function lessonDuration(lesson) {
  const text = `${lesson.type || ""} ${lesson.ticket || ""}`;
  const matched = text.match(/(\d+)\s*분/);
  return matched ? Number(matched[1]) : 20;
}

function memberLessonVisualKind(lesson = {}) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  if (["no_show", "cancelled_late"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase())) return "noShow";
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup";
  if (source === "coupon" || String(lesson.type || "").includes("쿠폰")) return "coupon";
  if (lessonDuration(lesson) === 30) return "regular30";
  return "regular";
}

function memberLessonColorStyle(lesson, policy) {
  const kind = memberLessonVisualKind(lesson);
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const custom = (policy?.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${lesson.lessonSource || ""}`.includes(rule.match));
  const saved = custom?.color || policy?.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function memberLessonTitle(lesson, isMine) {
  if (!isMine) return lesson?.oneDayBooking ? "원데이 예약" : "수업중";
  if (lesson.status === "requested") return "변경요청";
  const kind = memberLessonVisualKind(lesson);
  if (kind === "makeup") return "보강";
  if (kind === "coupon") return "쿠폰";
  return "내 수업";
}

function isLessonActiveAt(lesson, time) {
  const start = minutesFromTime(lesson.time);
  const current = minutesFromTime(time);
  return current >= start && current < start + lessonDuration(lesson);
}

function isLessonStartAt(lesson, time) {
  return lesson.time === time;
}

function syncNtrpResultFromCoach() {
  const shared = loadSharedData();
  const request = shared.ntrpRequests.find((item) => isCurrentMemberName(item.member));
  if (!request) return;
  state.profile.ntrpCheckRequested = request.status !== "측정 완료";
  state.profile.selfNtrp = request.selfNtrp || state.profile.selfNtrp;
  state.profile.coachNtrp = request.coachNtrp || state.profile.coachNtrp || "측정 전";
  state.profile.ntrpSurvey = request.surveyAnswers || state.profile.ntrpSurvey || {};
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
    $("#profileNtrpSummary").textContent = `자가 NTRP ${selfNtrp} · 코치 ${coachNtrp}`;
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
        <strong>NTRP ${state.profile.selfNtrp || "2.5"}</strong>
        <small>자가 체크 기준입니다. 실제 레슨에서는 코치가 움직임, 랠리, 서브, 게임 이해도를 보고 다시 측정합니다.</small>
      </article>
      <article class="${state.profile.ntrpCheckRequested ? "is-requested" : ""}">
        <span>코치 측정</span>
        <strong>${state.profile.coachNtrp || "측정 전"}</strong>
        <small>${state.profile.ntrpCheckRequested ? "코치에게 측정 요청이 전달된 상태입니다." : "원하면 코치에게 레벨 측정을 요청할 수 있습니다."}</small>
      </article>
      <article>
        <span>기준표</span>
        <strong>USTA NTRP 1.5~7.0</strong>
        <small>데모에서는 자주 쓰는 1.5~4.0 구간을 먼저 보여줍니다.</small>
      </article>`;
  }
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
                    <span>NTRP ${option.score} · ${option.label}</span>
                  </label>`,
              )
              .join("")}
          </fieldset>`,
      )
      .join("");
  }
}

function openNtrpReference(referenceId) {
  const item = ntrpReferences.find((reference) => reference.id === referenceId);
  if (!item) return;
  const isPoster = Boolean(item.image);
  $("#ntrpReferenceContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${item.title}</h2>
      <span>${item.detail}</span>
    </div>
    ${
      isPoster
        ? `<img class="ntrp-modal-image" src="${item.image}" alt="${item.title}" />`
        : `<div class="ntrp-official-summary">
            ${ntrpQuickLevels
              .map(
                (level) => `
                  <article>
                    <strong>NTRP ${level.level}</strong>
                    <span>${level.label}</span>
                    <small>${level.detail}</small>
                  </article>`,
              )
              .join("")}
            <a class="small-button" href="${item.url}" target="_blank" rel="noreferrer">공식 PDF 열기</a>
          </div>`
    }`;
  $("#ntrpReferenceModal").hidden = false;
}

function closeNtrpReference() {
  $("#ntrpReferenceModal").hidden = true;
}

function renderTodayActions() {
  const target = $("#todayActionCards");
  if (!target) return;
  const nextLesson = nextMemberLesson();
  const latestLog = state.lessonLogs[0];
  const pendingLogCount = state.lessonLogs.filter((log) => log.status === "coach_pending").length;
  const makeupCount = state.makeupRequests.length;
  const lowTicket = state.remaining <= 2;
  const curriculum = activeCurriculumStep();
  const lessonLabel = nextLesson
    ? `${nextLesson.day} ${nextLesson.time} · ${nextLesson.coach}`
    : "예정된 수업 없음";
  target.innerHTML = `
    <article class="today-card primary">
      <div>
        <span>다음 수업</span>
        <strong>${lessonLabel}</strong>
        <small>${nextLesson ? `${nextLesson.type} · 잔여 ${state.remaining}회` : "관리자에게 시간표 확인이 필요합니다."}</small>
        <small>다음 커리큘럼: ${curriculum.title}</small>
      </div>
      <button class="primary-button" type="button" data-home-action="curriculum">커리큘럼 보기</button>
    </article>
    <article class="today-card">
      <div>
        <span>수업 변경</span>
        <strong>${makeupCount ? `${makeupCount}건 대기` : "신청 가능"}</strong>
        <small>기존 수업을 가능한 시간으로 옮겨 요청합니다.</small>
      </div>
      <button class="small-button" type="button" data-home-action="makeup">시간표 보기</button>
    </article>
    <article class="today-card ${pendingLogCount ? "wait" : ""}">
      <div>
        <span>피드백</span>
        <strong>${latestLog ? lessonReviewTitle(latestLog) : "확인할 피드백 없음"}</strong>
        <small>${pendingLogCount ? `${pendingLogCount}건 대기` : "코치 코멘트 확인"}</small>
      </div>
      <button class="small-button" type="button" data-home-action="ticket">코멘트 보기</button>
    </article>
    <article class="today-card ${lowTicket ? "alert" : ""}">
      <div>
        <span>회원권</span>
        <strong>${lowTicket ? "재등록 필요" : "정상 이용중"}</strong>
        <small>${lowTicket ? "잔여 2회 이하입니다." : "잔여횟수가 충분합니다."}</small>
      </div>
      <button class="small-button" type="button" data-home-action="shop">회원권 보기</button>
    </article>
  `;
}

function currentMemberScheduleDay() {
  const dayIndex = new Date().getDay();
  return days[dayIndex === 0 ? 6 : dayIndex - 1];
}

function selectedMemberScheduleDay() {
  if (!days.includes(state.selectedScheduleDay)) state.selectedScheduleDay = currentMemberScheduleDay();
  return state.selectedScheduleDay;
}

function memberWeekDateForDay(day) {
  const week = activeMemberWeek();
  const dayIndex = days.indexOf(day);
  if (!week.startDate || dayIndex < 0) return "";
  const value = new Date(`${week.startDate}T00:00:00`);
  value.setDate(value.getDate() + dayIndex);
  return localDateKey(value);
}

function memberScheduleDateLabel(day) {
  const value = memberWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function mergeMemberScheduleWindows(windows) {
  return windows
    .map((window) => ({ ...window, startMinutes: minutesFromTime(window.start), endMinutes: minutesFromTime(window.end) }))
    .filter((window) => window.startMinutes < window.endMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .reduce((merged, window) => {
      const previous = merged.at(-1);
      if (!previous || window.startMinutes > previous.endMinutes) {
        merged.push({ ...window });
      } else {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = `${String(Math.floor(previous.endMinutes / 60)).padStart(2, "0")}:${String(previous.endMinutes % 60).padStart(2, "0")}`;
      }
      return merged;
    }, []);
}

function memberOperatingWindows(day, policy) {
  const merged = mergeMemberScheduleWindows(policy.coaches.flatMap((coach) => (
    (coach.workBlocks || []).filter((block) => block.days.includes(day))
  )));
  const breaks = (policy.breakRules || [])
    .filter((rule) => rule.days?.includes(day))
    .map((rule) => ({ start: minutesFromTime(rule.start), end: minutesFromTime(rule.end), label: rule.label || "수업 없음" }));
  return merged.flatMap((window) => {
    let pieces = [{ start: window.startMinutes, end: window.endMinutes }];
    breaks.forEach((rule) => {
      pieces = pieces.flatMap((piece) => {
        if (rule.end <= piece.start || rule.start >= piece.end) return [piece];
        return [
          piece.start < rule.start ? { start: piece.start, end: rule.start } : null,
          rule.end < piece.end ? { start: rule.end, end: piece.end } : null,
        ].filter(Boolean);
      });
    });
    return pieces;
  }).map((window) => ({
    start: `${String(Math.floor(window.start / 60)).padStart(2, "0")}:${String(window.start % 60).padStart(2, "0")}`,
    end: `${String(Math.floor(window.end / 60)).padStart(2, "0")}:${String(window.end % 60).padStart(2, "0")}`,
    startMinutes: window.start,
    endMinutes: window.end,
  }));
}

function memberMobileScheduleSegments(day, policy, baseLessons) {
  const windows = memberOperatingWindows(day, policy);
  const range = state.scheduleTimeRange || "lesson";
  if (range === "morning") return windows.filter((window) => window.startMinutes < minutesFromTime("17:00"));
  if (range === "evening") return windows.filter((window) => window.endMinutes > minutesFromTime("17:00"));
  if (range === "all") return windows;
  const focusLesson = baseLessons.find((lesson) => lesson.day === day && isCurrentMemberName(lesson.member))
    || baseLessons.find((lesson) => lesson.day === day && lesson.status === "available");
  const fallbackWindow = windows.length ? (days.indexOf(day) < 5 ? windows.at(-1) : windows[0]) : null;
  const focusMinutes = focusLesson ? minutesFromTime(focusLesson.time) : fallbackWindow?.startMinutes;
  const matching = windows.find((window) => focusMinutes >= window.startMinutes && focusMinutes < window.endMinutes) || fallbackWindow;
  if (!matching) return [];

  const windowMinutes = 90;
  const preferredStart = Math.floor((focusMinutes - 40) / 10) * 10;
  const latestStart = Math.max(matching.startMinutes, matching.endMinutes - windowMinutes);
  const startMinutes = Math.min(Math.max(preferredStart, matching.startMinutes), latestStart);
  const endMinutes = Math.min(matching.endMinutes, startMinutes + windowMinutes);
  const timeText = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return [{
    start: timeText(startMinutes),
    end: timeText(endMinutes),
    startMinutes,
    endMinutes,
  }];
}

function renderMemberMobileSegment(day, segment, policy, baseLessons, scheduleLessons) {
  const times = makeMemberStartTimes(segment.start, segment.end);
  const segmentStart = segment.startMinutes;
  const segmentEnd = segment.endMinutes;
  const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
  const coaches = memberDayCoaches(day, policy, baseLessons).filter((coach) => {
    const worksHere = (coach.workBlocks || []).some((block) => block.days.includes(day)
      && minutesFromTime(block.start) < segmentEnd
      && minutesFromTime(block.end) > segmentStart);
    const hasLesson = dayLessons.some((lesson) => memberLessonCoach(lesson, policy).id === coach.id
      && minutesFromTime(lesson.time) < segmentEnd
      && minutesFromTime(lesson.time) + lessonDuration(lesson) > segmentStart);
    return worksHere || hasLesson;
  });
  if (!times.length || !coaches.length) return `<p class="member-mobile-empty">이 시간대에 운영하는 코치가 없습니다.</p>`;
  const availableCount = dayLessons.filter((lesson) => lesson.status === "available"
    && minutesFromTime(lesson.time) >= segmentStart
    && minutesFromTime(lesson.time) < segmentEnd).length;
  const hasMakeupSlots = dayLessons.some((lesson) => lesson.status === "available" && lesson.type === "보강 신청가능");
  return `
    <section class="member-mobile-segment">
      <div class="member-mobile-segment-title">
        <strong>${segment.start}~${segment.end}</strong>
        <span>${coaches.map((coach) => memberCoachShortName(coach.name)).join(" · ")} · ${hasMakeupSlots ? "보강 가능" : "변경 가능"} ${availableCount}개</span>
      </div>
      <div class="member-mobile-lane-board" style="--coach-count:${coaches.length}; --slot-count:${times.length};">
        <div class="member-mobile-lane-head time">시간</div>
        ${coaches.map((coach) => `<div class="member-mobile-lane-head ${memberCoachColorClass(coach.name)}">${escapeHtml(memberCoachShortName(coach.name))}</div>`).join("")}
        <div class="member-mobile-time-rail">${times.map((time) => `<span>${time}</span>`).join("")}</div>
        ${coaches.map((coach) => {
          const coachLessons = dayLessons.filter((lesson) => memberLessonCoach(lesson, policy).id === coach.id);
          return `
            <div class="member-mobile-coach-lane">
              ${times.map((time, index) => {
                const available = coachLessons.find((lesson) => lesson.status === "available" && lesson.time === time);
                const working = isMemberCoachWorking(coach, day, time, 10);
                const availableLabel = available?.type === "보강 신청가능" ? "보강 가능" : "수업 변경 가능";
                return `<button class="member-mobile-slot ${available ? "available" : working ? "busy" : "off"}" type="button" ${available ? `data-lesson="${available.id}"` : "disabled"} style="grid-row:${index + 1};" aria-label="${day}요일 ${time} ${escapeHtml(memberCoachShortName(coach.name))} ${available ? availableLabel : "신청 불가"}">${available ? (available.type === "보강 신청가능" ? "보강" : "+") : ""}</button>`;
              }).join("")}
              ${coachLessons.filter((lesson) => lesson.status !== "available" && minutesFromTime(lesson.time) >= segmentStart && minutesFromTime(lesson.time) < segmentEnd).map((lesson) => {
                const startIndex = times.indexOf(lesson.time);
                if (startIndex < 0) return "";
                const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                const isMine = isCurrentMemberName(lesson.member);
                const title = memberLessonTitle(lesson, isMine);
                return `<button class="member-mobile-lesson lesson-source lesson-kind-${memberLessonVisualKind(lesson)} ${isMine ? `mine ${lesson.status}` : "occupied"} ${memberCoachColorClass(lesson.coach)}" type="button" ${isMine ? `data-lesson="${lesson.id}"` : "disabled"} style="${memberLessonColorStyle(lesson, policy)};grid-row:${startIndex + 1} / span ${span};"><strong>${title}</strong><span>${lessonDuration(lesson)}분</span></button>`;
              }).join("")}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderMemberMobileSchedule(policy, baseLessons, scheduleLessons) {
  const selectedDay = selectedMemberScheduleDay();
  const segments = memberMobileScheduleSegments(selectedDay, policy, baseLessons);
  return `
    <div class="member-mobile-schedule">
      <div class="member-mobile-day-strip" aria-label="날짜 선택">
        ${days.map((day) => `<button class="member-mobile-day ${day === selectedDay ? "is-active" : ""}" type="button" data-member-schedule-day="${day}"><strong>${day}</strong><span>${memberScheduleDateLabel(day)}</span></button>`).join("")}
      </div>
      ${segments.length
        ? segments.map((segment, index) => `${index > 0 ? `<div class="member-mobile-break"><strong>${segments[index - 1].end}~${segment.start}</strong><span>수업 없음</span></div>` : ""}${renderMemberMobileSegment(selectedDay, segment, policy, baseLessons, scheduleLessons)}`).join("")
        : `<p class="member-mobile-empty">${selectedDay}요일은 현재 등록된 운영시간이 없습니다.</p>`}
    </div>`;
}

function renderDynamicMemberSchedule() {
  const activeWeek = activeMemberWeek();
  $("#memberWeekSwitcher").innerHTML = `
    <button class="ghost-button" type="button" data-change-member-week="-1" ${state.activeMemberWeekIndex <= memberScheduleMinWeekOffset ? "disabled" : ""}>이전 주</button>
    <div class="schedule-period-summary">
      <div class="schedule-month-controls">
        <button class="ghost-button" type="button" data-change-member-month="-1">이전 달</button>
        <input class="schedule-month-input" type="month" value="${memberScheduleMonthValue(activeWeek)}" data-member-month aria-label="이동할 달">
        <button class="ghost-button" type="button" data-change-member-month="1">다음 달</button>
      </div>
      <strong>${activeWeek.label}</strong>
      <span>${activeWeek.range} · 관리자 근무시간 기준</span>
    </div>
    <button class="ghost-button" type="button" data-change-member-week="1" ${state.activeMemberWeekIndex >= memberScheduleMaxWeekOffset ? "disabled" : ""}>다음 주</button>
  `;

  const policy = loadAdminSchedulePolicy();
  const scheduleTimeList = memberScheduleTimes(policy);
  const baseLessons = memberScheduleLessons();
  const scheduleLessons = memberScheduleOptions();
  const dayCoachMap = new Map(days.map((day) => [day, memberDayCoaches(day, policy, baseLessons)]));
  const dayColumnTracks = days
    .map((day) => {
      const laneCount = Math.max(1, dayCoachMap.get(day)?.length || 0);
      return `${laneCount * memberScheduleCoachLaneWidth + Math.max(0, laneCount - 1) * 3}px`;
    })
    .join(" ");
  $("#scheduleGrid").innerHTML = `
    <div class="member-schedule-range-row" aria-label="시간 범위 필터">
      ${scheduleTimeRangeOptions()
        .map(
          (option) => `
            <button class="member-schedule-filter ${((state.scheduleTimeRange || "lesson") === option.id) ? "is-active" : ""}" type="button" data-member-schedule-time-range="${option.id}">
              ${option.label}
            </button>`,
        )
        .join("")}
    </div>
    ${renderMemberMobileSchedule(policy, baseLessons, scheduleLessons)}
    <div class="member-desktop-schedule">
    <div class="member-duration-schedule" role="table" aria-label="회원 전체 시간표" style="--day-count:${days.length}; --slot-count:${scheduleTimeList.length}; grid-template-columns:64px ${dayColumnTracks};">
      <div class="member-duration-head time-head">시간</div>
      ${days
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ name: "운영없음" }];
          return `
            <div class="member-duration-head member-day-head" style="--coach-count:${displayCoaches.length};">
              <strong>${day}요일</strong>
              <div class="member-coach-head-row">
                ${displayCoaches.map((coach) => `<span>${memberCoachShortName(coach.name)}</span>`).join("")}
              </div>
            </div>`;
        })
        .join("")}
      <div class="member-time-rail">
        ${scheduleTimeList.map((time) => `<div class="member-duration-time">${time}</div>`).join("")}
      </div>
      ${days
        .map((day) => {
          const dayCoaches = dayCoachMap.get(day) || [];
          const displayCoaches = dayCoaches.length ? dayCoaches : [{ id: `closed-${day}`, name: "운영없음", workBlocks: [] }];
          const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
          const visibleLessons = dayLessons.filter((lesson) => lesson.status !== "available");
          const availableLessons = dayLessons.filter((lesson) => lesson.status === "available");
          return `
            <div class="member-day-column" style="--slot-count:${scheduleTimeList.length}; --coach-count:${displayCoaches.length};">
              ${scheduleTimeList
                .map((time, timeIndex) =>
                  displayCoaches
                    .map((coach, coachIndex) => {
                      const breakRule = memberBreakRuleForSlot(policy, day, time);
                      const isWorking = !breakRule && isMemberCoachWorking(coach, day, time, 10);
                      const stateClass = breakRule ? "blocked" : isWorking ? "base" : "off";
                      const label = timeIndex % 3 === 0
                        ? breakRule ? (breakRule.label || "브레이크") : isWorking ? "수업 신청불가" : "근무외"
                        : "";
                      const fullLabel = breakRule ? (breakRule.label || "브레이크") : isWorking ? "수업 신청불가" : "근무외";
                      return `
                        <button
                          class="member-slot-bg ${stateClass}"
                          type="button"
                          disabled
                          aria-label="${day}요일 ${time} ${memberCoachShortName(coach.name)} ${fullLabel}"
                          style="grid-row:${timeIndex + 1}; grid-column:${coachIndex + 1};"
                        >
                          <span>${label}</span>
                        </button>`;
                    })
                    .join(""),
                )
                .join("")}
              ${availableLessons
                .map((lesson) => {
                  const startIndex = scheduleTimeList.indexOf(lesson.time);
                  if (startIndex < 0) return "";
                  const lessonCoach = memberLessonCoach(lesson, policy);
                  const coachIndex = displayCoaches.findIndex((coach) => coach.id === lessonCoach.id);
                  if (coachIndex < 0) return "";
                  return `
                    <button
                      class="member-slot-bg available ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}"
                      type="button"
                      data-lesson="${lesson.id}"
                      aria-label="${day}요일 ${lesson.time} ${memberCoachShortName(lessonCoach.name)} ${lesson.type === "보강 신청가능" ? "보강 신청 가능" : "수업 변경 신청 가능"}"
                      style="grid-row:${startIndex + 1}; grid-column:${coachIndex + 1};"
                    >
                      <span>${lesson.type === "보강 신청가능" ? "보강 가능" : "변경 가능"}</span>
                    </button>`;
                })
                .join("")}
              ${visibleLessons
                .map((lesson) => {
                  const startIndex = scheduleTimeList.indexOf(lesson.time);
                  if (startIndex < 0) return "";
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const lessonCoach = memberLessonCoach(lesson, policy);
                  const coachIndex = displayCoaches.findIndex((coach) => coach.id === lessonCoach.id);
                  if (coachIndex < 0) return "";
                  const isMine = isCurrentMemberName(lesson.member);
                  const title = memberLessonTitle(lesson, isMine);
                  const lessonClass = isMine ? `mine ${lesson.status}` : "occupied";
                  const lessonAction = isMine ? `data-lesson="${lesson.id}"` : "disabled";
                  return `
                    <button
                      class="member-duration-lesson lesson-source lesson-kind-${memberLessonVisualKind(lesson)} ${lessonClass} ${memberCoachColorClass(lesson.coach)}"
                      type="button"
                      ${lessonAction}
                      style="${memberLessonColorStyle(lesson, policy)}; grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <strong>${title}</strong>
                      <span>${memberCoachShortName(lesson.coach)}</span>
                    </button>`;
                })
                .join("")}
            </div>`;
        })
        .join("")}
    </div>
    </div>`;
  $$("#scheduleGrid [data-lesson]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleScheduleClick(button.dataset.lesson);
    });
  });
}

function renderSchedule() {
  renderDynamicMemberSchedule();
  return;
  const activeWeek = activeMemberWeek();
  $("#memberWeekSwitcher").innerHTML = `
    <button class="ghost-button" type="button" data-change-member-week="-1" ${state.activeMemberWeekIndex === 0 ? "disabled" : ""}>이전 주</button>
    <div>
      <strong>${activeWeek.label}</strong>
      <span>${activeWeek.range} · ${activeWeek.note}</span>
    </div>
    <button class="ghost-button" type="button" data-change-member-week="1" ${state.activeMemberWeekIndex === memberScheduleWeeks.length - 1 ? "disabled" : ""}>다음 주</button>
  `;
  const scheduleLessons = memberScheduleLessons();
  const scheduleCoaches = memberScheduleCoachNames(scheduleLessons);
  $("#scheduleGrid").innerHTML = `
    <div class="member-duration-schedule" role="table" aria-label="회원 전체 시간표" style="--day-count:${days.length}; --slot-count:${times.length}; --coach-count:${scheduleCoaches.length};">
      <div class="member-duration-head time-head">시간</div>
      ${days
        .map(
          (day) => `
            <div class="member-duration-head">
              <strong>${day}요일</strong>
              <small>${scheduleCoaches.map(shortCoachName).join(" · ")}</small>
            </div>`,
        )
        .join("")}
      <div class="member-time-rail">
        ${times.map((time) => `<div class="member-duration-time">${time}</div>`).join("")}
      </div>
      ${days
        .map((day) => {
          const dayLessons = scheduleLessons.filter((lesson) => lesson.day === day);
          const visibleLessons = dayLessons.filter((lesson) => lesson.status !== "available");
          const availableLessons = dayLessons.filter((lesson) => lesson.status === "available");
          return `
            <div class="member-day-column" style="--slot-count:${times.length}; --coach-count:${scheduleCoaches.length};">
              ${times
                .map((time, timeIndex) =>
                  scheduleCoaches
                    .map(
                      (coach, coachIndex) => `
                        <button
                          class="member-slot-bg"
                          type="button"
                          disabled
                          style="grid-row:${timeIndex + 1}; grid-column:${coachIndex + 1};"
                        >
                          <span>신청불가</span>
                        </button>`,
                    )
                    .join(""),
                )
                .join("")}
              ${availableLessons
                .map((lesson) => {
                  const startIndex = Math.max(0, times.indexOf(lesson.time));
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const coachIndex = Math.max(0, scheduleCoaches.indexOf(lesson.coach));
                  return `
                    <button
                      class="member-slot-bg available ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}"
                      type="button"
                      data-lesson="${lesson.id}"
                      style="grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <span>가능</span>
                      <small>${policyShortLabel(lesson.policy)}</small>
                    </button>`;
                })
                .join("")}
              ${visibleLessons
                .map((lesson) => {
                  const startIndex = Math.max(0, times.indexOf(lesson.time));
                  const span = Math.max(1, Math.ceil(lessonDuration(lesson) / 10));
                  const coachIndex = Math.max(0, scheduleCoaches.indexOf(lesson.coach));
                  const isMine = isCurrentMemberName(lesson.member);
                  const title = isMine ? (lesson.status === "requested" ? "변경" : "내수업") : lesson.oneDayBooking ? "원데이 예약" : "수업중";
                  const lessonClass = isMine ? `mine ${lesson.status}` : "occupied";
                  const lessonAction = isMine ? `data-lesson="${lesson.id}"` : "disabled";
                  return `
                    <button
                      class="member-duration-lesson ${lessonClass} ${memberCoachColorClass(lesson.coach)}"
                      type="button"
                      ${lessonAction}
                      style="grid-row:${startIndex + 1} / span ${span}; grid-column:${coachIndex + 1};"
                    >
                      <strong>${title}</strong>
                      <span>${shortCoachName(lesson.coach)}</span>
                    </button>`;
                })
                .join("")}
            </div>`;
        })
        .join("")}
    </div>`;
}

function renderSelects() {
  const previousAbsence = $("#absenceLesson")?.value;
  const previousMakeup = $("#makeupSlot")?.value;
  const sourceLessons = currentScheduledLessonsForChange();
  const regularOptions = sourceLessons
    .map((lesson) => `<option value="${lesson.id}">${lesson.status === "makeup_due" ? "보강 필요 · " : ""}${lesson.day} ${lesson.time} · ${lesson.coach}</option>`)
    .join("");
  const logOptions = memberLessons()
    .map((lesson) => `<option value="${lesson.id}">${lesson.day} ${lesson.time} · ${lesson.coach} · ${lesson.type}</option>`)
    .join("");

  $("#absenceLesson").innerHTML = regularOptions || "<option>변경 가능한 기존 수업 없음</option>";
  $("#logLesson").innerHTML = logOptions || "<option>기록할 수업 없음</option>";
  if (previousAbsence && [...$("#absenceLesson").options].some((option) => option.value === previousAbsence)) {
    $("#absenceLesson").value = previousAbsence;
  }
  const availableOptions = memberAvailableSlotsForSelectedLesson()
    .map((lesson) => `<option value="${lesson.id}">${lesson.day} ${lesson.time} · ${lesson.coach}</option>`)
    .join("");
  $("#makeupSlot").innerHTML = availableOptions || "<option>가능한 변경 시간 없음</option>";
  if (previousMakeup && [...$("#makeupSlot").options].some((option) => option.value === previousMakeup)) {
    $("#makeupSlot").value = previousMakeup;
  }
  const selectedSource = sourceLessons.find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const isMakeupDue = selectedSource?.status === "makeup_due";
  if ($("#changeModalTitle")) $("#changeModalTitle").textContent = isMakeupDue ? "보강 시간 선택" : "수업 변경 요청";
  if ($("#changeReasonField")) $("#changeReasonField").hidden = isMakeupDue;
  if ($("#requestMakeup")) $("#requestMakeup").textContent = isMakeupDue ? "보강 예약 확정" : "수업 변경 요청";
}

function renderJournalMode() {
  const mode = $("#journalMode")?.value || "lesson";
  const isLesson = mode === "lesson";
  if ($("#journalDate") && !$("#journalDate").value) $("#journalDate").value = localDateKey();
  $("#lessonJournalFields").hidden = !isLesson;
  $("#practiceJournalFields").hidden = isLesson;
  $("#saveJournal").textContent = isLesson ? "레슨 운동일지 저장" : "개인 운동일지 저장";
}

function renderAvailableSlots() {
  const target = $("#availableSlotList");
  const selectedId = $("#makeupSlot")?.value;
  const availableLessons = memberAvailableSlotsForSelectedLesson();
  const selected = memberScheduleOptions().find((lesson) => lesson.id === selectedId);
  const source = currentScheduledLessonsForChange().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const isMakeupDue = source?.status === "makeup_due";
  if ($("#changePolicyNote")) {
    $("#changePolicyNote").textContent = isMakeupDue
      ? "불참 처리된 수업의 보강입니다. 시간을 선택하면 즉시 예약됩니다."
      : selected ? policyDetail(selected.policy) : "24시간 이전은 자동 변경, 24시간 이내는 코치 승인 필요";
  }
  renderChangeModalSummary();
  if (!target) return;
  target.innerHTML =
    availableLessons
      .map(
        (lesson) => `
          <button class="slot-card ${lesson.id === selectedId ? "is-selected" : ""} ${lesson.policy === "coach" ? "needs-approval" : "auto-change"}" type="button" data-select-slot="${lesson.id}">
            <strong>${lesson.day} ${lesson.time}</strong>
            <span>${lesson.coach}</span>
            <small>${lesson.id === selectedId ? "선택됨" : isMakeupDue ? "즉시 예약" : policyLabel(lesson.policy)}</small>
          </button>`,
      )
      .join("") || "<p class='empty-text'>현재 정책 안에서 변경 가능한 시간이 없습니다.</p>";
}

function renderChangeModalSummary() {
  const target = $("#changeModalSummary");
  if (!target) return;
  const absence = memberScheduleOptions().find((lesson) => lesson.id === $("#absenceLesson")?.value);
  const makeup = memberScheduleOptions().find((lesson) => lesson.id === $("#makeupSlot")?.value);
  if (!absence || !makeup) {
    target.textContent = absence?.status === "makeup_due" ? "예약할 보강 시간을 선택해 주세요." : "기존 수업과 희망 시간을 확인합니다.";
    return;
  }
  target.textContent = absence.status === "makeup_due"
    ? `${absence.day} ${absence.time} 불참 수업의 보강을 ${makeup.day} ${makeup.time}에 예약합니다.`
    : `${absence.day} ${absence.time} 수업을 ${makeup.day} ${makeup.time} 수업으로 변경합니다.`;
}

function renderMakeupDueBanner() {
  const banner = $("#makeupDueBanner");
  const dueLessons = memberMakeupDueLessons();
  if ($("#homeChangeLabel")) $("#homeChangeLabel").textContent = dueLessons.length ? `보강 시간 선택 (${dueLessons.length})` : "수업 변경";
  if (!banner) return;
  banner.hidden = dueLessons.length === 0;
  if (!dueLessons.length) return;
  const nearest = [...dueLessons].sort((left, right) => `${left.lessonDate}${left.time}`.localeCompare(`${right.lessonDate}${right.time}`))[0];
  if ($("#makeupDueTitle")) $("#makeupDueTitle").textContent = dueLessons.length > 1 ? `보강할 수업 ${dueLessons.length}건` : "보강 시간을 선택해 주세요";
  if ($("#makeupDueDetail")) $("#makeupDueDetail").textContent = `${nearest.lessonDate} ${nearest.day} ${nearest.time} 불참 · ${nearest.reason}`;
}

function renderRequests() {
  syncMakeupRequestsFromCoach();
  if ($("#requestCount")) $("#requestCount").textContent = `${state.makeupRequests.length}건`;
  if (!$("#makeupRequests")) return;
  $("#makeupRequests").innerHTML =
    state.makeupRequests
      .map(
        (request) => `
          <article class="request-card">
            <strong>${request.absence}</strong>
            <span>${request.makeup}</span>
            ${request.reason ? `<small>이유: ${request.reason}</small>` : ""}
            <small>${request.policy || ""}</small>
            <b>${request.status}</b>
          </article>`,
      )
      .join("") || "<p class='empty-text'>아직 수업 변경 요청이 없습니다.</p>";
}

function syncMakeupRequestsFromCoach() {
  const shared = loadSharedData();
  shared.makeupRequests.forEach((sharedRequest) => {
    const existing = state.makeupRequests.find((request) => request.id === sharedRequest.id);
    if (!existing) return;
    if (sharedRequest.status === "승인 완료") existing.status = "코치 승인 완료";
    else if (sharedRequest.status === "거절") existing.status = "코치 거절";
    else existing.status = sharedRequest.status || existing.status;
  });
}

function renderLessonLogs() {
  syncConfirmationsFromCoach();
  syncPracticeFeedbackFromCoach();
  const pendingCount = state.lessonLogs.filter((log) => ["coach_pending", "uploading", "server_error"].includes(log.status)).length;
  const confirmedCount = state.lessonLogs.filter((log) => log.status === "confirmed").length;
  const latestLog = state.lessonLogs[0];
  if ($("#pendingNoteCount")) {
    $("#pendingNoteCount").textContent = pendingCount ? `대기 ${pendingCount}건` : confirmedCount ? `${confirmedCount}건` : "없음";
  }
  if ($("#lessonRecordNote")) {
    const latestDate = latestLog?.journalDate || (latestLog?.submittedAt ? latestLog.submittedAt.slice(0, 10) : "");
    $("#lessonRecordNote").textContent = latestLog ? latestDate : "";
  }
  const lessonItems = state.lessonLogs;
  const lessonPage = normalizePage("lesson", lessonItems.length);
  const visibleLessonItems = paginateItems(lessonItems, lessonPage);
  $("#lessonLogs").innerHTML =
    visibleLessonItems
      .map(
        (log) => {
          const statusLabel = log.status === "confirmed"
            ? "코치 코멘트 확인"
            : log.status === "uploading"
              ? "서버 저장 중"
              : log.status === "server_error"
                ? "서버 저장 확인 필요"
                : "피드백 등록중";
          const dateLabel = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
          return `
            <button class="history-card compact-log summary-log ${log.status === "confirmed" ? "done" : "wait"}" type="button" data-open-journal-detail="${log.id}">
              <span class="summary-log-main">
                <strong>${lessonReviewTitle(log)}</strong>
                <small>${dateLabel} · ${log.lessonLabel}</small>
              </span>
              <span class="summary-log-status">${statusLabel}</span>
            </button>`;
        },
      )
      .join("") || "<p class='empty-text'>아직 제출된 수업기록이 없습니다.</p>";
  renderListPager("lessonLogsPager", "lesson", lessonPage, lessonItems.length);
}

function memberCurriculumFilterOptions() {
  return [
    { id: "all", label: "전체" },
    { id: "기초", label: "기초" },
    { id: "포핸드", label: "포핸드" },
    { id: "백핸드", label: "백핸드" },
    { id: "네트플레이", label: "네트" },
    { id: "전술전환", label: "전술" },
    { id: "서브", label: "서브" },
  ];
}

function filteredMemberCurriculumTracks() {
  const query = String(state.curriculumQuery || "").trim().toLowerCase();
  const filter = state.curriculumFilter || "all";
  return curriculumSkillTracks
    .map((track) => {
      const matchesTrack = !query || `${track.id || ""} ${track.title} ${track.category || ""} ${track.summary || ""}`.toLowerCase().includes(query);
      const steps = track.steps.filter((step) => {
        const matchesFilter = filter === "all" || step.category === filter || track.category === filter;
        const text = `${step.id} ${step.title} ${step.level || ""} ${step.focus || ""} ${step.guide || ""}`.toLowerCase();
        return matchesFilter && (matchesTrack || !query || text.includes(query));
      });
      return { ...track, steps };
    })
    .filter((track) => track.steps.length > 0);
}

function memberCurriculumLibraryMarkup(active) {
  const tracks = filteredMemberCurriculumTracks();
  const query = String(state.curriculumQuery || "").trim();
  if (!tracks.length) return "<p class='empty-text curriculum-empty'>조건에 맞는 커리큘럼이 없습니다.</p>";
  return tracks
    .map((track) => {
      const activeIndex = track.steps.findIndex((step) => step.id === active.id);
      const activeInTrack = activeIndex >= 0;
      const progressLabel = activeInTrack ? `${activeIndex + 1}/${track.steps.length}` : `${track.steps.length}단계`;
      return `
        <details class="curriculum-category curriculum-track" ${activeInTrack || query ? "open" : ""}>
          <summary class="curriculum-category-heading">
            <div>
              <strong>${escapeHtml(track.title)}</strong>
              <span>${escapeHtml(track.summary)}</span>
            </div>
            <b>${progressLabel}</b>
          </summary>
          <div class="curriculum-track-actions">
            <span>${escapeHtml(track.category || "기초")} · ${track.steps.length}개 단계</span>
            <a class="small-button notion-link" href="${track.notionUrl || notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">트랙 원본</a>
          </div>
          <div class="curriculum-step-list">
            ${track.steps
              .map(
                (step) => `
                  <article class="curriculum-step ${step.id === active.id ? "is-current" : ""}">
                    <div>
                      <span>${escapeHtml(step.stageLabel || step.level || "단계")} · ${escapeHtml(step.id)}</span>
                      <strong>${escapeHtml(step.title)}</strong>
                    </div>
                    <p><b>핵심</b>${escapeHtml(step.focus || step.goal || step.title)}</p>
                    ${step.environmentNote ? `<small class="curriculum-environment-note">${escapeHtml(step.environmentNote)}</small>` : ""}
                    <a class="small-button notion-link" href="${step.notionUrl || notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">원본 보기</a>
                  </article>`,
              )
              .join("")}
          </div>
        </details>`;
    })
    .join("");
}

function renderMemberCurriculumLibrary(active = activeCurriculumStep()) {
  const target = $("#memberCurriculumLibrary");
  if (target) target.innerHTML = memberCurriculumLibraryMarkup(active);
  const count = filteredMemberCurriculumTracks().reduce((sum, track) => sum + track.steps.length, 0);
  if ($("#memberCurriculumCount")) $("#memberCurriculumCount").textContent = `${count}개 단계`;
}

function renderCurriculum() {
  const latest = latestCurriculumLog();
  const active = activeCurriculumStep();
  const activeTrack = curriculumSkillTracks.find((track) => track.steps.some((step) => step.id === active.id));
  const activeIndex = activeTrack?.steps.findIndex((step) => step.id === active.id) ?? -1;
  const guideMarkup = `
    <div class="curriculum-summary">
      <span>다음 수업 커리큘럼</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <small>${activeTrack ? `${escapeHtml(activeTrack.title)} ${activeIndex + 1}/${activeTrack.steps.length}` : "코치가 지정한 단계"} · ${escapeHtml(latest?.lessonLabel || "최근 코치 등록 커리큘럼")} 기준</small>
      <p>${escapeHtml(active.guide || active.next || active.focus)}</p>
      <a class="small-button notion-link" href="${active.notionUrl || notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">노션에서 자세히 보기</a>
    </div>
    <div class="curriculum-stage-grid">
      ${curriculumStageCards()
        .map(
          ({ label, step, tone }) => `
            <article class="curriculum-stage ${tone}">
              <span>${label}</span>
              <strong>${escapeHtml(step.title)}</strong>
              <small>${escapeHtml(step.focus)}</small>
            </article>`,
        )
        .join("")}
    </div>`;
  const miniGuideMarkup = `
    <button class="curriculum-compact-card" type="button" data-open-curriculum-view>
      <span>다음 커리큘럼</span>
      <strong>${escapeHtml(active.id)} · ${escapeHtml(active.title)}</strong>
      <small>${activeTrack ? `${escapeHtml(activeTrack.title)} ${activeIndex + 1}/${activeTrack.steps.length}` : "코치 지정 단계"} · ${escapeHtml(latest?.lessonLabel || "최근 등록 기준")}</small>
      <b>상세 보기</b>
    </button>`;
  if ($("#curriculumMiniGuide")) $("#curriculumMiniGuide").innerHTML = miniGuideMarkup;
  if ($("#curriculumGuide")) $("#curriculumGuide").innerHTML = `
    <section class="curriculum-hero">
      <div>
        <span>노션 전체 커리큘럼 연동</span>
        <strong>기술별 현재 위치와 다음 단계를 짧게 확인합니다.</strong>
        <p>앱에서는 핵심만 보고, 필요한 단계만 노션 원본으로 열 수 있습니다. 서브는 실내 천장 제한으로 야외 훈련을 권장합니다.</p>
      </div>
      <div class="curriculum-hero-actions">
        <a class="small-button notion-link" href="${notionCurriculumGuideUrl}" target="_blank" rel="noreferrer">회원용 안내</a>
        <a class="small-button notion-link" href="${curriculumCatalog.sources?.roadmap || notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">성장 로드맵</a>
        <a class="small-button notion-link" href="${curriculumCatalog.sources?.goalFinder || notionCurriculumDetailUrl}" target="_blank" rel="noreferrer">배우고 싶은 것 찾기</a>
      </div>
    </section>
    ${guideMarkup}`;
  if ($("#curriculumFullList")) {
    $("#curriculumFullList").innerHTML = `
      <section class="curriculum-progress-board curriculum-level-board" aria-label="성장 단계">
        ${(curriculumCatalog.levels || [])
          .map(
            (level) => `
              <article class="is-waiting">
                <span>${escapeHtml(level.period)}</span>
                <strong>${escapeHtml(level.title)}</strong>
                <small>${escapeHtml(level.summary)}</small>
              </article>`,
          )
          .join("")}
      </section>
      <section class="member-curriculum-toolbar" aria-label="커리큘럼 검색과 필터">
        <div class="member-curriculum-search-row">
          <input id="memberCurriculumSearch" type="search" value="${escapeHtml(state.curriculumQuery || "")}" placeholder="기술, 단계, 코드 검색" />
          <b id="memberCurriculumCount"></b>
        </div>
        <div class="curriculum-filter-row">
          ${memberCurriculumFilterOptions()
            .map(
              (filter) => `
                <button class="curriculum-filter ${state.curriculumFilter === filter.id ? "is-active" : ""}" type="button" data-member-curriculum-filter="${filter.id}">${filter.label}</button>`,
            )
            .join("")}
        </div>
      </section>
      <div id="memberCurriculumLibrary"></div>`;
    renderMemberCurriculumLibrary(active);
  }
}

function renderTickets() {
  const liveTicket = currentLiveTicket();
  const total = liveTicket ? liveTicket.total : 0;
  const remaining = liveTicket ? liveTicket.remaining : 0;
  const used = liveTicket ? liveTicket.used : 0;
  const ticketTitle = liveTicket?.title || "현재 이용권 없음";
  const ticketStatus = liveTicket?.statusLabel || state.ticketSyncStatus?.text || "로그인 후 회원권 확인";
  const ticketPeriod = liveTicket?.expiresOn
    ? `${liveTicket.startsOn || "시작일 확인"} ~ ${liveTicket.expiresOn}`
    : "회원권 구매 또는 관리자 충전 필요";
  const lowTicket = !!liveTicket && remaining <= 2;
  const needsTicket = !liveTicket;
  const upcoming = upcomingMemberLessons(2);
  const connectedSchedule = upcoming.length
    ? upcoming.map((lesson) => scheduleSummaryText(lesson, "")).filter(Boolean).join(" · ")
    : "연결된 고정시간 없음";
  if ($("#remainingCount")) $("#remainingCount").textContent = needsTicket ? "없음" : `${remaining}회`;
  if ($("#ticketStatus")) $("#ticketStatus").textContent = needsTicket ? "구매 필요" : `${total || "-"}회권`;
  if ($("#nextLessonDate")) $("#nextLessonDate").textContent = scheduleSummaryText(upcoming[0], "예정 없음");
  if ($("#followingLessonDate")) {
    const nextCoach = upcoming[0]?.coach || "";
    const following = scheduleSummaryText(upcoming[1], "");
    $("#followingLessonDate").textContent = [nextCoach, following ? `다음 ${following}` : ""].filter(Boolean).join(" · ");
  }
  if ($("#ticketOverview")) {
    $("#ticketOverview").innerHTML = `
      <article class="ticket-card primary">
        <span>${escapeHtml(ticketTitle)}</span>
        <strong>${remaining}회 남음</strong>
        <small>총 ${total || 0} / 소진 ${used} / 잔여 ${remaining}</small>
      </article>
      <article class="ticket-card">
        <span>회원권 상태</span>
        <strong>${escapeHtml(ticketStatus)}</strong>
        <small>${escapeHtml(ticketPeriod)}</small>
      </article>
      <article class="ticket-card ${lowTicket ? "alert" : ""}">
        <span>재등록</span>
        <strong>${needsTicket ? "구매 필요" : lowTicket ? "알림 필요" : "아직 여유"}</strong>
        <small>${needsTicket ? "회원권 구매 또는 관리자 충전" : lowTicket ? "결제 요청 가능" : "2회 이하부터 알림"}</small>
      </article>`;
  }
  if ($("#renewalPolicyPanel")) {
    $("#renewalPolicyPanel").innerHTML = `
      <article class="renewal-card ${lowTicket ? "alert" : ""}">
        <div>
          <span>재등록 기준</span>
          <strong>${lowTicket ? "지금 결제 안내 필요" : "잔여 2회부터 자동 알림"}</strong>
          <p>앱에서는 회원별 만료일 기준으로 결제합니다. 결제 전까지 기존 고정시간은 보호하고, 만료 후 미결제 상태가 되면 다음 주차부터 신청 가능 시간으로 열립니다.</p>
        </div>
        <button class="small-button" type="button" data-home-action="shop">연장 회원권 보기</button>
      </article>
      <article class="renewal-card">
        <div>
          <span>회원권 동기화</span>
          <strong>${escapeHtml(connectedSchedule)}</strong>
          <p>${escapeHtml(state.ticketSyncStatus?.text || "로그인 후 서버 회원권을 확인합니다.")}</p>
        </div>
      </article>`;
  }
  if (!$("#ticketHistory")) return;
  const ticketItems = state.lessonLogs;
  const ticketPage = normalizePage("ticket", ticketItems.length);
  const visibleTicketItems = paginateItems(ticketItems, ticketPage);
  $("#ticketHistory").innerHTML = visibleTicketItems
    .map((log) => {
      const confirmed = log.status === "confirmed";
      const step = curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum);
      return `
        <article class="lesson-status-card ${confirmed ? "done" : "wait"}">
          <div>
            <strong>${log.lessonLabel} 수업 진행</strong>
            <span>${log.content}</span>
            <small>${log.journalDate || ""} · ${confirmed ? "코치 코멘트 운동일지 등록됨" : "피드백 등록중"}</small>
          </div>
          <div class="lesson-status-actions">
            ${
              confirmed
                ? `<button class="small-button" type="button" data-open-journal-detail="${log.id}">코치 코멘트 확인</button>`
                : `<button class="small-button" type="button" disabled>피드백 등록중</button>`
            }
          </div>
        </article>`;
    })
    .join("") || "<p class='empty-text'>아직 수업 진행 내역이 없습니다.</p>";
  renderListPager("ticketHistoryPager", "ticket", ticketPage, ticketItems.length);
}

function renderPracticeLogs() {
  syncPracticeFeedbackFromCoach();
  if (!$("#practiceLogs")) return;
  const practiceItems = state.practiceLogs;
  const practicePage = normalizePage("practice", practiceItems.length);
  const visiblePracticeItems = paginateItems(practiceItems, practicePage);
  $("#practiceLogs").innerHTML =
    visiblePracticeItems
      .map((log) => {
        const mediaCount = normalizeMediaItems(log).length;
        const dateLabel = log.journalDate || log.date;
        const statusLabel = log.coachFeedback ? "코치 코멘트 있음" : log.feedbackStatus || "개인 기록";
        return `
          <button class="history-card compact-log summary-log done" type="button" data-open-journal-detail="${log.id}">
            <span class="summary-log-main">
              <strong>${log.type}</strong>
              <small>${dateLabel} · ${statusLabel}${mediaCount ? ` · 첨부 ${mediaCount}개` : ""}</small>
            </span>
            <span class="summary-log-status">상세 보기</span>
          </button>`;
      })
      .join("") || "<p class='empty-text'>아직 저장된 개인 운동일지가 없습니다.</p>";
  renderListPager("practiceLogsPager", "practice", practicePage, practiceItems.length);
}

function memberHoldingPolicy() {
  const fallback = {
    personalMaxDays: 7,
    fourWeekPersonalMaxDays: 7,
    threeMonthPersonalMaxDays: 14,
    couponPersonalMaxDays: 0,
    injuryMaxDays: 30,
    emergencyRetroactiveDays: 3,
    evidenceRequired: true,
    evidenceRetentionDays: 30,
  };
  let saved = fallback;
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    saved = { ...fallback, ...(state.holdingPolicySettings || {}), ...(snapshot?.holdingPolicySettings || {}) };
  } catch {
    saved = fallback;
  }
  const ticketTitle = String(currentHoldingTicket()?.title || "");
  const personalMaxDays = /쿠폰/.test(ticketTitle)
    ? Number(saved.couponPersonalMaxDays) || 0
    : /3개월|12주/.test(ticketTitle)
      ? Number(saved.threeMonthPersonalMaxDays) || 14
      : Number(saved.fourWeekPersonalMaxDays ?? saved.personalMaxDays) || 7;
  return { ...saved, personalMaxDays };
}

function currentHoldingTicket() {
  const liveTicket = currentLiveTicket();
  if (liveTicket) return liveTicket;
  if (state.member && state.ticketSyncStatus?.tone === "demo") {
    return {
      id: "demo-ticket-holding",
      branchId: "demo-branch",
      title: state.profile.ticket || "정기권",
      status: "active",
      total: 10,
      remaining: state.remaining,
      used: Math.max(0, 10 - state.remaining),
      startsOn: "2026-07-01",
      expiresOn: "2026-07-31",
      statusLabel: "데모 이용중",
    };
  }
  return null;
}

function memberHoldingRequests() {
  const shared = loadSharedData();
  const memberName = state.member?.name || state.profile.name;
  return (shared.holdingRequests || []).filter((request) => request.member === memberName);
}

function holdingStatusLabel(status) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "cancelled") return "취소";
  return "검토중";
}

function renderCurrentTicketPanel() {
  const target = $("#currentTicketPanel");
  if (!target) return;
  const ticket = currentHoldingTicket();
  const totalSessions = Math.max(0, Number(ticket?.total || 0));
  const remainingSessions = Math.max(0, Number(ticket?.remaining || 0));
  const usedSessions = Math.max(0, Number(ticket?.used ?? totalSessions - remainingSessions));
  const progress = totalSessions ? Math.min(100, Math.max(0, (usedSessions / totalSessions) * 100)) : 0;
  const isPendingTicket = ticket?.status === "pending_payment";
  const isLowTicket = Boolean(ticket) && remainingSessions <= 2;
  const ticketTitle = ticket?.title || "현재 이용권 없음";
  const ticketPeriod = ticket?.expiresOn
    ? `${ticket.startsOn || "시작일 확인"} ~ ${ticket.expiresOn}`
    : ticket
      ? "이용 기간을 확인 중입니다"
      : state.ticketSyncStatus?.text || "이용권을 구매하거나 관리자 충전 후 사용할 수 있습니다.";
  const statusLabel = isPendingTicket
    ? "결제 확인 중"
    : !ticket
      ? "구매 필요"
      : isLowTicket
        ? "재등록 안내"
        : ticket.statusLabel || "정상 이용 중";
  const holding = ticket ? memberHoldingRequests()[0] : null;
  const pendingPaymentId = ticket?.providerPaymentId || "";
  const canResumePayment = pendingPaymentId && Number(ticket?.paymentAmount || 0) > 0;
  const pendingPaymentActions = isPendingTicket
    ? `<div class="membership-pending-actions">
        <button class="small-button" type="button" data-resume-pending-ticket="${escapeHtml(ticket.id)}" ${canResumePayment ? "" : "disabled"}>결제창 다시 열기</button>
        <button class="small-button" type="button" data-check-pending-ticket="${escapeHtml(ticket.id)}" ${pendingPaymentId ? "" : "disabled"}>결제 상태 다시 확인</button>
      </div>`
    : "";
  const holdingAction = ticket && !isPendingTicket
    ? `<button class="membership-status-note" type="button" data-open-holding-request>${holding ? `이용권 보류 · ${escapeHtml(holdingStatusLabel(holding.status))}` : "이용권 보류 신청"}</button>`
    : "";
  target.innerHTML = `
    <article class="membership-primary-card ${isPendingTicket ? "is-pending" : ""} ${isLowTicket ? "is-low" : ""}">
      <div class="membership-primary-head">
        <span>현재 이용권</span>
        <small>${escapeHtml(statusLabel)}</small>
      </div>
      <strong>${escapeHtml(ticketTitle)}</strong>
      <div class="membership-remaining-row">
        <span>남은 횟수</span>
        <b>${remainingSessions}<em>회</em></b>
      </div>
      <div class="membership-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${totalSessions || 1}" aria-valuenow="${usedSessions}" aria-label="이용권 사용 진행률">
        <span style="width: ${progress}%"></span>
      </div>
      <small class="membership-period">${escapeHtml(ticketPeriod)} · 총 ${totalSessions} / 소진 ${usedSessions} / 잔여 ${remainingSessions}</small>
    </article>
    <div class="membership-action-row">
      <button class="primary-button" type="button" data-open-membership-products>${isPendingTicket ? "결제 상태 확인" : "연장하기"}</button>
      <button class="small-button" type="button" data-open-membership-history>이용 내역</button>
    </div>
    ${pendingPaymentActions}
    ${holdingAction}`;
}

function holdingRequestDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function updateHoldingEvidenceFields() {
  const injury = $("#holdingRequestType")?.value === "injury";
  if ($("#holdingEvidenceFields")) $("#holdingEvidenceFields").hidden = !injury;
  if (!injury) {
    if ($("#holdingEvidenceFile")) $("#holdingEvidenceFile").value = "";
    if ($("#holdingSensitiveConsent")) $("#holdingSensitiveConsent").checked = false;
  }
  const policy = memberHoldingPolicy();
  const personalOption = $("#holdingRequestType option[value='personal']");
  if (personalOption) personalOption.disabled = Number(policy.personalMaxDays) <= 0;
  if (!injury && Number(policy.personalMaxDays) <= 0) {
    $("#holdingRequestType").value = "injury";
    return updateHoldingEvidenceFields();
  }
  if ($("#holdingPolicySummary")) {
    $("#holdingPolicySummary").textContent = injury
      ? `부상 홀딩 최대 ${policy.injuryMaxDays}일 · 증빙 확인 필요`
      : `개인 사유 홀딩 최대 ${policy.personalMaxDays}일`;
  }
}

function openHoldingRequestModal() {
  if (!currentHoldingTicket()) return;
  const today = new Date();
  $("#holdingRequestForm")?.reset();
  $("#holdingStartDate").value = today.toISOString().slice(0, 10);
  $("#holdingEndDate").value = new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  $("#holdingRequestMessage").textContent = "승인되면 해당 기간만큼 회원권 종료일이 연장됩니다.";
  updateHoldingEvidenceFields();
  $("#holdingRequestModal").hidden = false;
}

function closeHoldingRequestModal() {
  $("#holdingRequestModal").hidden = true;
}

function safeHoldingFileName(fileName = "evidence") {
  const extension = `${fileName}`.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `evidence.${extension}`;
}

async function submitHoldingRequest(event) {
  event.preventDefault();
  const ticket = currentHoldingTicket();
  if (!ticket) return;
  const requestType = $("#holdingRequestType").value;
  const startDate = $("#holdingStartDate").value;
  const endDate = $("#holdingEndDate").value;
  const reason = $("#holdingReason").value.trim();
  const file = $("#holdingEvidenceFile").files?.[0] || null;
  const consent = $("#holdingSensitiveConsent").checked;
  const policy = memberHoldingPolicy();
  const days = holdingRequestDays(startDate, endDate);
  const maxDays = requestType === "injury" ? Number(policy.injuryMaxDays) : Number(policy.personalMaxDays);
  if (requestType === "personal" && maxDays <= 0) {
    message.textContent = "쿠폰제는 개인 사유 홀딩을 제공하지 않습니다. 부상·입원은 증빙과 함께 신청할 수 있습니다.";
    return;
  }
  const message = $("#holdingRequestMessage");
  if (!days || days > maxDays) {
    message.textContent = `${requestType === "injury" ? "부상" : "개인 사유"} 홀딩은 최대 ${maxDays}일까지 신청할 수 있습니다.`;
    return;
  }
  if (requestType === "injury" && policy.evidenceRequired && !file) {
    message.textContent = "부상 홀딩은 진단서 또는 진료확인서를 첨부해 주세요.";
    return;
  }
  const allowedEvidenceTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (file && !allowedEvidenceTypes.includes(file.type)) {
    message.textContent = "PDF·JPG·PNG·WEBP 파일만 첨부할 수 있습니다.";
    return;
  }
  if (file && file.size > 5 * 1024 * 1024) {
    message.textContent = "첨부파일은 5MB 이하만 가능합니다.";
    return;
  }
  if (requestType === "injury" && !consent) {
    message.textContent = "건강정보 처리 안내를 확인하고 동의해 주세요.";
    return;
  }
  if (requestType === "personal" && memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.type === "personal" && request.status === "approved")) {
    message.textContent = "이 회원권은 개인 사유 홀딩을 이미 사용했습니다.";
    return;
  }
  if (memberHoldingRequests().some((request) => request.ticketId === ticket.id && request.status === "pending")) {
    message.textContent = "이미 검토 중인 홀딩 요청이 있습니다.";
    return;
  }

  const requestId = globalThis.crypto?.randomUUID?.() || `holding-${Date.now()}`;
  const client = window.TennisNoteDataClient;
  let evidencePath = "";
  const isLive = !ticket.id.startsWith("demo-") && state.member?.profileId && client?.getSession?.()?.access_token;
  try {
    if (isLive && requestType === "injury" && file) {
      evidencePath = `${state.member.profileId}/${requestId}/${safeHoldingFileName(file.name)}`;
      await client.uploadObject("tennisnote-private-holding-evidence", evidencePath, file);
    }
    if (isLive) {
      await client.insertRows("tn_holding_requests", {
        id: requestId,
        branch_id: ticket.branchId,
        user_id: state.member.profileId,
        ticket_id: ticket.id,
        request_type: requestType,
        requested_start_on: startDate,
        requested_end_on: endDate,
        reason_summary: reason,
        evidence_object_path: evidencePath,
        evidence_status: requestType === "injury" ? "uploaded" : "not_required",
        sensitive_consent_at: requestType === "injury" ? new Date().toISOString() : null,
        evidence_purge_due_at: requestType === "injury" ? new Date(Date.now() + Number(policy.evidenceRetentionDays) * 86400000).toISOString() : null,
      });
    }
  } catch {
    if (evidencePath && client?.deleteObject) {
      await client.deleteObject("tennisnote-private-holding-evidence", evidencePath).catch(() => {});
    }
    message.textContent = "서버 신청을 저장하지 못했습니다. 관리자에게 문의해 주세요.";
    return;
  }

  const shared = loadSharedData();
  shared.holdingRequests = shared.holdingRequests || [];
  shared.holdingRequests.unshift({
    id: requestId,
    member: state.member?.name || state.profile.name,
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    type: requestType,
    typeLabel: requestType === "injury" ? "부상·입원" : "개인 사유",
    startDate,
    endDate,
    days,
    reason,
    evidencePath: isLive ? evidencePath : "",
    evidenceLabel: requestType === "injury" ? "증빙 첨부" : "증빙 없음",
    status: "pending",
    source: isLive ? "server" : "demo",
    createdAt: new Date().toISOString(),
  });
  saveSharedData(shared);
  state.ticketHistory.unshift({ text: `홀딩 신청 · ${startDate}~${endDate} · 관리자 검토중`, tone: "wait" });
  saveSnapshot();
  closeHoldingRequestModal();
  renderCurrentTicketPanel();
}

function renderMemberPaymentAlerts() {
  const target = $("#memberPaymentAlerts");
  if (!target) return;
  const alerts = (state.liveNotifications || [])
    .filter((item) => ["payment_cancelled", "payment_request_cancelled", "payment_refunded"].includes(item.templateKey))
    .slice(0, 3);
  if (!alerts.length) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = `
    <section class="member-alert-list" aria-label="최근 결제 알림">
      ${alerts
        .map((alert) => `
          <article class="member-alert-card ${alert.tone || "wait"}">
            <div>
              <strong>${escapeHtml(alert.title)}</strong>
              <span>${escapeHtml(alert.body)}</span>
              <small>${escapeHtml(formatDateTimeLabel(alert.createdAt))}</small>
            </div>
            <b>${alert.status === "sent" ? "확인 가능" : "처리중"}</b>
          </article>`)
        .join("")}
    </section>`;
}

function memberGroupPaymentModeLabel(mode = "representative") {
  if (mode === "alternate") return "결제자를 번갈아 지정";
  if (mode === "separate") return "각자 회원권 결제";
  return "대표회원이 두 사람 함께 결제";
}

function renderGroupAccountPanel() {
  const target = $("#groupAccountPanel");
  const account = state.groupAccount;
  if (!target) return;
  if (!account?.members?.length) {
    target.innerHTML = "";
    return;
  }
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  target.innerHTML = `
    <section class="member-group-account-card" aria-label="2대1 공동관리 상태">
      <div class="member-group-account-heading">
        <div>
          <span>2대1 공동관리</span>
          <strong>${escapeHtml(account.name)}</strong>
          <small>${escapeHtml(account.coach)} · ${escapeHtml(account.schedule)}</small>
        </div>
        <b>${account.scheduleSyncRequired ? "시간표 자동 연동" : "연동 확인 필요"}</b>
      </div>
      <div class="member-group-people">
        ${account.members.map((member) => `
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${member.appStatus === "linked" ? "앱 연결" : "앱 없이 함께 사용"}</span>
            <small>${member.canManageSchedule ? "결제·일정관리 가능" : "연결 회원이 대신 관리"}</small>
          </div>
        `).join("")}
      </div>
      <div class="member-group-payment-status">
        <span>현재 결제 방식</span>
        <strong>${memberGroupPaymentModeLabel(account.paymentMode)}</strong>
        <small>${account.paymentMode === "separate" ? "두 회원권의 결제 상태를 각각 확인합니다." : `다음 결제 담당 ${escapeHtml(account.nextPayer)}`}</small>
      </div>
      <div class="member-group-actions">
        <button class="small-button" type="button" data-member-group-mode="representative">함께 결제</button>
        <button class="small-button" type="button" data-member-group-mode="alternate" ${linkedMembers.length < 2 ? "disabled" : ""}>번갈아 결제</button>
        <button class="small-button" type="button" data-member-group-mode="separate" ${linkedMembers.length < 2 ? "disabled" : ""}>각자 결제</button>
        <button class="ghost-button" type="button" data-member-group-link>${linkedMembers.length < 2 ? "파트너 앱 연결" : "파트너 연결됨"}</button>
      </div>
    </section>`;
}

async function setMemberGroupPaymentMode(mode) {
  const account = state.groupAccount;
  if (!account) return;
  const linkedMembers = account.members.filter((member) => member.appStatus === "linked");
  if (mode !== "representative" && linkedMembers.length < 2) return;
  let nextPayer = linkedMembers.find((member) => member.name === account.nextPayer) || linkedMembers[0];
  if (mode === "alternate") {
    const currentIndex = linkedMembers.findIndex((member) => member.name === account.nextPayer);
    nextPayer = linkedMembers[(currentIndex + 1) % linkedMembers.length] || nextPayer;
  }
  const client = window.TennisNoteDataClient;
  if (!account.demoOnly && client?.rpc) {
    try {
      await client.rpc("tn_set_group_payment_mode", {
        target_group_account_id: account.id,
        target_payment_mode: mode,
        target_next_payer_user_id: mode === "separate" ? null : nextPayer?.userId || null,
      });
    } catch {
      state.ticketHistory.unshift({ text: "2대1 결제방식 변경 실패 · 관리자 확인 필요", tone: "alert" });
      renderGroupAccountPanel();
      return;
    }
  }
  account.paymentMode = mode;
  account.nextPayer = nextPayer?.name || account.nextPayer;
  account.nextPayerUserId = nextPayer?.userId || account.nextPayerUserId;
  state.ticketHistory.unshift({ text: `2대1 결제방식 변경 · ${memberGroupPaymentModeLabel(mode)}`, tone: "done" });
  saveSnapshot();
  renderGroupAccountPanel();
}

function linkMemberGroupPartner() {
  if (state.groupAccount && !state.groupAccount.demoOnly) {
    state.ticketHistory.unshift({ text: "파트너 앱 연결 요청 · 관리자 확인 필요", tone: "wait" });
    saveSnapshot();
    renderGroupAccountPanel();
    return;
  }
  const partner = state.groupAccount?.members?.find((member) => member.appStatus !== "linked");
  if (!partner) return;
  partner.appStatus = "linked";
  partner.canManageSchedule = true;
  saveSnapshot();
  renderGroupAccountPanel();
}

function isGroupMembershipProduct(product = {}) {
  return Number(product.groupSize || 1) === 2
    || product.productKind === "group"
    || product.mode === "group"
    || `${product.title || ""} ${product.detail || ""}`.includes("2대1");
}

function memberKind() {
  return String(state.member?.memberKind || "journal_only");
}

function memberEnrollmentAllowsProduct(product = {}) {
  if (["lesson_member", "former_lesson_member"].includes(memberKind())) return true;
  const enrollment = state.memberEnrollment;
  if (!enrollment || enrollment.form_version !== memberEnrollmentFormVersion) return false;
  if (!["submitted", "approved"].includes(String(enrollment.status || ""))) return false;
  if (isGroupMembershipProduct(product)) {
    return Number(enrollment.group_size || 1) === 2
      && Boolean(String(enrollment.partner_name || "").trim())
      && Boolean(String(enrollment.partner_phone || "").trim());
  }
  return true;
}

function memberEnrollmentStatusInfo() {
  if (memberKind() === "lesson_member" || currentLiveTicket()?.status === "active") {
    return { tone: "done", title: "수강회원", detail: "가입서와 결제가 연결되어 시간표와 회원권을 이용 중입니다." };
  }
  if (memberKind() === "former_lesson_member") {
    return { tone: "done", title: "기존 수강회원", detail: "재등록할 때 기존 가입서를 다시 작성하지 않고 결제로 이어집니다." };
  }
  if (["submitted", "approved"].includes(String(state.memberEnrollment?.status || ""))) {
    return { tone: "wait", title: "가입서 제출 완료", detail: "선택한 회원권을 결제하면 수강회원으로 자동 전환됩니다." };
  }
  return { tone: "journal", title: "운동노트 회원", detail: "운동 기록은 바로 사용할 수 있고, 첫 회원권 결제 때 수강 가입서를 작성합니다." };
}

function renderRegistrationFlow() {
  const target = $("#registrationFlow");
  if (!target) return;
  const status = memberEnrollmentStatusInfo();
  target.innerHTML = `
    <article class="member-enrollment-status ${status.tone}">
      <span>현재 계정</span>
      <strong>${escapeHtml(status.title)}</strong>
      <p>${escapeHtml(status.detail)}</p>
    </article>
    ${registrationFlows
      .map(
        (flow) => `
          <article class="flow-card">
            <strong>${flow.title}</strong>
            <p>${flow.detail}</p>
            <div>${flow.steps.map((step) => `<span>${step}</span>`).join("")}</div>
          </article>`,
      )
      .join("")}`;
}

function setEnrollmentInputValue(selector, value = "") {
  const input = $(selector);
  if (input) input.value = value ?? "";
}

function updateEnrollmentPartnerFields(product = null) {
  const selectedProduct = product || membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const isGroup = isGroupMembershipProduct(selectedProduct || {});
  const fields = $("#enrollmentPartnerFields");
  if (fields) fields.hidden = !isGroup;
  ["#enrollmentPartnerName", "#enrollmentPartnerPhone"].forEach((selector) => {
    const input = $(selector);
    if (input) input.required = isGroup;
  });
}

function openMemberEnrollmentModal(productId, message = "") {
  const product = membershipProducts().find((item) => item.id === productId);
  const modal = $("#memberEnrollmentModal");
  if (!product || !modal) return;
  state.pendingPurchaseProductId = productId;
  const enrollment = state.memberEnrollment || {};
  const productSummary = $("#memberEnrollmentProduct");
  if (productSummary) {
    productSummary.innerHTML = `
      <span>선택 회원권</span>
      <strong>${escapeHtml(product.title)}</strong>
      <small>${escapeHtml(product.detail)} · ${formatWon(onlinePaymentAmount(product))}</small>`;
  }
  setEnrollmentInputValue("#enrollmentName", enrollment.applicant_name || state.member?.name || state.profile.name || "");
  setEnrollmentInputValue("#enrollmentPhone", enrollment.phone || state.profile.phone || "");
  setEnrollmentInputValue("#enrollmentBirthYear", enrollment.birth_year || state.member?.birthYear || "");
  setEnrollmentInputValue("#enrollmentNeighborhood", enrollment.neighborhood || state.member?.neighborhood || "");
  setEnrollmentInputValue("#enrollmentGender", enrollment.gender || state.member?.gender || "");
  setEnrollmentInputValue("#enrollmentExperience", enrollment.experience_level || "beginner");
  setEnrollmentInputValue("#enrollmentPartnerName", enrollment.partner_name || "");
  setEnrollmentInputValue("#enrollmentPartnerPhone", enrollment.partner_phone || "");
  setEnrollmentInputValue("#enrollmentPartnerBirthYear", enrollment.partner_birth_year || "");
  setEnrollmentInputValue("#enrollmentPartnerNeighborhood", enrollment.partner_neighborhood || "");
  setEnrollmentInputValue("#enrollmentPartnerGender", enrollment.partner_gender || "");
  if ($("#enrollmentPrivacyConsent")) $("#enrollmentPrivacyConsent").checked = false;
  if ($("#enrollmentTermsConsent")) $("#enrollmentTermsConsent").checked = false;
  const maxBirthYear = new Date().getFullYear() - 5;
  if ($("#enrollmentBirthYear")) $("#enrollmentBirthYear").max = String(maxBirthYear);
  if ($("#enrollmentPartnerBirthYear")) $("#enrollmentPartnerBirthYear").max = String(maxBirthYear);
  if ($("#memberEnrollmentMessage")) $("#memberEnrollmentMessage").textContent = message;
  updateEnrollmentPartnerFields(product);
  modal.hidden = false;
  window.setTimeout(() => $("#enrollmentName")?.focus(), 40);
}

function closeMemberEnrollmentModal() {
  const modal = $("#memberEnrollmentModal");
  if (modal) modal.hidden = true;
}

function memberEnrollmentErrorMessage(error) {
  const code = error?.payload?.code || error?.message || "";
  const labels = {
    applicant_name_required: "이름을 확인해 주세요.",
    valid_phone_required: "연락처를 정확히 입력해 주세요.",
    valid_birth_year_required: "출생연도를 확인해 주세요.",
    group_partner_required: "2대1 파트너 이름과 연락처를 입력해 주세요.",
    member_enrollment_consent_required: "필수 안내 두 가지를 확인하고 동의해 주세요.",
    active_product_required: "판매 중인 회원권 정보를 다시 확인해 주세요.",
  };
  return labels[code] || "가입서를 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
}

async function syncMemberEnrollmentFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.readiness?.().ready || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_member_enrollments", {
      select: "id,user_id,branch_id,requested_product_id,form_version,status,applicant_name,phone,birth_year,neighborhood,gender,experience_level,lesson_goal,preferred_schedule,group_size,partner_name,partner_phone,partner_birth_year,partner_neighborhood,partner_gender,submitted_at,approved_at,updated_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.memberEnrollment = (rows || [])
      .filter((row) => row.form_version === memberEnrollmentFormVersion)
      .sort((left, right) => new Date(right.submitted_at || 0) - new Date(left.submitted_at || 0))[0] || null;
    return true;
  } catch {
    state.memberEnrollment = null;
    return false;
  }
}

async function submitMemberEnrollment(event) {
  event.preventDefault();
  const product = membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const message = $("#memberEnrollmentMessage");
  if (!product || !message) return;
  const isGroup = isGroupMembershipProduct(product);
  const birthYear = Number($("#enrollmentBirthYear")?.value || 0);
  const partnerBirthYear = Number($("#enrollmentPartnerBirthYear")?.value || 0) || null;
  const maxBirthYear = new Date().getFullYear() - 5;
  const payload = {
    target_product_id: product.id,
    target_form_version: memberEnrollmentFormVersion,
    target_applicant_name: $("#enrollmentName")?.value.trim() || "",
    target_phone: $("#enrollmentPhone")?.value.trim() || "",
    target_birth_year: birthYear,
    target_neighborhood: $("#enrollmentNeighborhood")?.value.trim() || "",
    target_gender: $("#enrollmentGender")?.value || "",
    target_experience_level: $("#enrollmentExperience")?.value || "beginner",
    target_lesson_goal: memberEnrollmentLegacyDefaults.lessonGoal,
    target_preferred_schedule: memberEnrollmentLegacyDefaults.preferredSchedule,
    target_partner_name: isGroup ? $("#enrollmentPartnerName")?.value.trim() || "" : "",
    target_partner_phone: isGroup ? $("#enrollmentPartnerPhone")?.value.trim() || "" : "",
    target_partner_birth_year: isGroup ? partnerBirthYear : null,
    target_partner_neighborhood: isGroup ? $("#enrollmentPartnerNeighborhood")?.value.trim() || "" : "",
    target_partner_gender: isGroup ? $("#enrollmentPartnerGender")?.value || "" : "",
    target_privacy_consent: Boolean($("#enrollmentPrivacyConsent")?.checked),
    target_terms_consent: Boolean($("#enrollmentTermsConsent")?.checked),
  };
  if (!payload.target_applicant_name || payload.target_phone.replace(/\D/g, "").length < 9) {
    message.textContent = "이름과 연락처를 확인해 주세요.";
    return;
  }
  if (birthYear < 1900 || birthYear > maxBirthYear) {
    message.textContent = "출생연도를 확인해 주세요.";
    return;
  }
  if (isGroup && (!payload.target_partner_name || payload.target_partner_phone.replace(/\D/g, "").length < 9)) {
    message.textContent = "2대1 파트너 이름과 연락처를 입력해 주세요.";
    return;
  }
  if (!payload.target_privacy_consent || !payload.target_terms_consent) {
    message.textContent = "필수 안내 두 가지를 확인하고 동의해 주세요.";
    return;
  }

  const submitButton = $("#memberEnrollmentForm button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  message.textContent = "가입서를 안전하게 저장하는 중입니다.";
  try {
    const client = window.TennisNoteDataClient;
    if (hasLiveMemberSession() && client?.rpc) {
      await client.rpc("tn_submit_member_enrollment", payload);
      if (state.member) state.member.memberKind = state.member.memberKind === "lesson_member" ? "lesson_member" : "lesson_pending";
      await syncMemberEnrollmentFromServer();
    } else {
      state.memberEnrollment = {
        id: `demo-enrollment-${Date.now()}`,
        user_id: state.member?.profileId || "demo-member",
        requested_product_id: product.id,
        form_version: memberEnrollmentFormVersion,
        status: "submitted",
        applicant_name: payload.target_applicant_name,
        phone: payload.target_phone,
        birth_year: payload.target_birth_year,
        neighborhood: payload.target_neighborhood,
        gender: payload.target_gender,
        experience_level: payload.target_experience_level,
        lesson_goal: payload.target_lesson_goal,
        preferred_schedule: payload.target_preferred_schedule,
        group_size: isGroup ? 2 : 1,
        partner_name: payload.target_partner_name,
        partner_phone: payload.target_partner_phone,
        submitted_at: new Date().toISOString(),
      };
      if (state.member) state.member.memberKind = "lesson_pending";
    }
    state.profile.name = payload.target_applicant_name;
    state.profile.phone = payload.target_phone;
    state.ticketHistory.unshift({ text: `${product.title} 수강 가입서 제출 완료`, tone: "done" });
    saveSnapshot();
    renderAll();
    closeMemberEnrollmentModal();
    if (hasLiveMemberSession()) {
      await startProductPayment(product.id, { skipEnrollmentGate: true });
    } else {
      state.pendingPaymentCheckStatus = { tone: "done", text: "데모 가입서 제출 완료 · 실제 로그인 후 결제로 이어집니다." };
      renderAll();
      setView("shopView");
    }
  } catch (error) {
    message.textContent = memberEnrollmentErrorMessage(error);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function renderProducts() {
  renderPaymentGatewayStatus();
  renderCurrentTicketPanel();
  renderGroupAccountPanel();
  renderMemberPaymentAlerts();
  const activeProducts = membershipProducts();
  renderRegistrationFlow();
  $("#productGrid").innerHTML = Object.entries(
    activeProducts.reduce((groups, product) => {
      groups[product.group] = groups[product.group] || [];
      groups[product.group].push(product);
      return groups;
    }, {}),
  )
    .map(
      ([group, groupProducts]) => `
        <section class="product-group">
          <h3>${group}</h3>
          <div class="product-group-grid">
            ${groupProducts
              .map(
                (product) => `
        <article class="product-card ${product.mode}">
          <div>
            <div class="product-card-title">
              <i>${escapeHtml(product.status === "consult" ? "상담" : product.badge)}</i>
              <strong>${escapeHtml(product.title)}</strong>
            </div>
            <span>${escapeHtml(product.detail)}</span>
            <div class="product-meta-pills">${productUsagePills(product)}</div>
            <small>연결 코치: ${escapeHtml(product.coach)}</small>
            <small>${escapeHtml(product.rule)}</small>
          </div>
          ${productPriceRows(product)}
          <em>${escapeHtml(productOperationNote(product))}</em>
          <small class="product-flow-text">${escapeHtml(product.flow)} · ${escapeHtml(product.discount)}</small>
          <button class="primary-button" type="button" data-buy-product="${product.id}">${product.status === "consult" || !product.amount ? "상담 요청" : "결제하기"}</button>
        </article>`,
              )
              .join("")}
          </div>
        </section>`,
    )
    .join("");

  const passItems = membershipPassRecords();
  const passPage = normalizePage("expired", passItems.length);
  const visiblePassItems = paginateItems(passItems, passPage);
  $("#paymentRequests").innerHTML =
    visiblePassItems
      .map(
        (pass) => `
          <article class="history-card pass-history-card ${pass.tone || "done"}">
            <div>
              <strong>${pass.title}</strong>
              <span>${pass.period}</span>
              <small>${pass.coach || "상담 후 배정"} · 총 ${pass.total} / 소진 ${pass.used} / 잔여 ${Math.max(0, Number(pass.total || 0) - Number(pass.used || 0))} · ${pass.paid}</small>
            </div>
            <b>${pass.status}</b>
            ${pass.note ? `<small>${pass.note}</small>` : ""}
          </article>`,
      )
      .join("") || "<p class='empty-text'>아직 만기 이용권이 없습니다.</p>";
  renderListPager("paymentRequestsPager", "expired", passPage, passItems.length);
}

function paginateItems(items, page) {
  return items.slice(page * listPageSize, page * listPageSize + listPageSize);
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / listPageSize));
}

function normalizePage(type, total) {
  const key = pageStateKey(type);
  const maxPage = pageCount(total) - 1;
  state[key] = Math.min(Math.max(Number(state[key]) || 0, 0), maxPage);
  return state[key];
}

function pageStateKey(type) {
  if (type === "lesson") return "lessonLogPage";
  if (type === "ticket") return "ticketHistoryPage";
  if (type === "practice") return "practiceLogPage";
  return "expiredTicketPage";
}

function renderListPager(targetId, type, currentPage, total) {
  const target = $(`#${targetId}`);
  if (!target) return;
  if (total <= listPageSize) {
    target.innerHTML = "";
    return;
  }
  const totalPages = pageCount(total);
  const pageButtons = Array.from({ length: totalPages }, (_, index) => `
    <button class="page-number ${index === currentPage ? "is-current" : ""}" type="button" data-page-list="${type}" data-page-index="${index}" ${index === currentPage ? "aria-current=\"page\"" : ""}>${index + 1}</button>`).join("");
  target.innerHTML = `
    <span>현재</span>
    <div class="page-number-row">${pageButtons}</div>`;
}

function membershipPassRecords() {
  const pendingPasses = state.paymentRequests.map((request) => {
    const display = paymentRequestDisplay(request);
    return {
      id: request.paymentId || request.productId || `pending-${request.productTitle}`,
      title: request.productTitle,
      period: display.period,
      total: ticketCountFromTitle(request.productTitle),
      used: 0,
      coach: request.coach || "상담 후 배정",
      paid: request.amountLabel || "금액 확인",
      status: display.status,
      note: display.note,
      tone: display.tone,
    };
  });
  const refundedPasses = (state.liveTickets || [])
    .filter((ticket) => ["refunded", "cancelled", "canceled"].includes(String(ticket.status || "").toLowerCase()))
    .map((ticket) => {
      const breakdown = ticket.refundBreakdown || {};
      const refundAmount = Number(ticket.refundedAmount || breakdown.refundAmount || 0);
      const usedAmount = Number(breakdown.usedAmount || 0);
      const penaltyAmount = Number(breakdown.penaltyAmount || 0);
      const detailParts = [];
      if (refundAmount) detailParts.push(`환불 ${refundAmount.toLocaleString("ko-KR")}원`);
      if (usedAmount) detailParts.push(`사용 회차 차감 ${usedAmount.toLocaleString("ko-KR")}원`);
      if (penaltyAmount) detailParts.push(`위약금 ${penaltyAmount.toLocaleString("ko-KR")}원`);
      if (ticket.refundReason) detailParts.push(`사유 ${ticket.refundReason}`);
      return {
        id: `refunded-${ticket.id}`,
        title: ticket.title || "환불된 이용권",
        period: ticket.refundedAt ? `${formatDateTimeLabel(ticket.refundedAt)} 환불 완료` : ticket.expiresOn ? `${ticket.startsOn || "시작일 확인"} ~ ${ticket.expiresOn}` : "서버 환불 처리 완료",
        total: ticket.total || 0,
        used: ticket.used || 0,
        coach: state.profile.mainCoach || "담당 코치",
        paid: ticket.paymentAmount ? `결제 ${ticket.paymentAmount.toLocaleString("ko-KR")}원` : "결제금액 확인",
        status: ticket.status === "refunded" ? "환불완료" : "취소완료",
        note: detailParts.join(" · ") || "결제취소 후 이용권 비활성화",
        tone: "alert",
      };
    });
  return [...pendingPasses, ...refundedPasses, ...(state.expiredTickets || [])];
}

function paymentRequestDisplay(request = {}) {
  const text = `${request.method || ""} ${request.status || ""}`;
  if (text.includes("설정")) {
    return {
      period: "결제창 연결 전 요청",
      status: "설정 필요",
      note: "관리자 결제 설정 후 실제 결제창을 다시 연결합니다.",
      tone: "alert",
    };
  }
  if (text.includes("실패") || text.includes("오류")) {
    return {
      period: "결제 재확인 필요",
      status: "확인 필요",
      note: request.status || "결제가 끝나지 않아 관리자 확인이 필요합니다.",
      tone: "alert",
    };
  }
  if (text.includes("서버 검증") || text.includes("PortOne 결제창")) {
    return {
      period: "결제 완료 접수 · 이용권 충전 대기",
      status: "검증 대기",
      note: "관리자 화면에 접수됐고, 서버 검증 후 이용권이 충전됩니다.",
      tone: "wait",
    };
  }
  if (text.includes("상담")) {
    return {
      period: "상담 후 이용권 확정",
      status: "상담 대기",
      note: request.status || "관리자가 시간과 코치를 확인합니다.",
      tone: "wait",
    };
  }
  return {
    period: "관리자 확인 후 이용권 시작",
    status: "확인 대기",
    note: request.status || "결제 확인 후 이용권이 충전됩니다.",
    tone: "wait",
  };
}

function ticketCountFromTitle(title = "") {
  const match = `${title}`.match(/(\d+)\s*회/);
  return match ? Number(match[1]) : 0;
}

const paymentMethodDefinitions = [
  { id: "card", label: "카드·토스페이", shortLabel: "카드", payMethod: "CARD", detail: "카드 또는 토스 결제창" },
  { id: "naverpay", label: "네이버페이", shortLabel: "네이버페이", payMethod: "EASY_PAY", detail: "네이버페이 바로 결제" },
  { id: "kakaopay", label: "카카오페이", shortLabel: "카카오페이", payMethod: "EASY_PAY", detail: "카카오페이 바로 결제" },
];

function paymentGatewayConfig() {
  const localConfig = (() => {
    try {
      return JSON.parse(localStorage.getItem(paymentConfigKey) || "{}");
    } catch {
      localStorage.removeItem(paymentConfigKey);
      return {};
    }
  })();
  const browserConfig = window.TENNIS_NOTE_PAYMENT_CONFIG || {};
  return {
    provider: "portone",
    storeId: browserConfig.storeId || localConfig.storeId || "",
    naverPayCategoryType: browserConfig.naverPayCategoryType || localConfig.naverPayCategoryType || "",
    naverPayCategoryId: browserConfig.naverPayCategoryId || localConfig.naverPayCategoryId || "",
    channels: {
      card: browserConfig.channels?.card || browserConfig.channelKey || localConfig.channels?.card || localConfig.channelKey || "",
      naverpay: browserConfig.channels?.naverpay || browserConfig.naverPayChannelKey || localConfig.channels?.naverpay || localConfig.naverPayChannelKey || "",
      kakaopay: browserConfig.channels?.kakaopay || browserConfig.kakaoPayChannelKey || localConfig.channels?.kakaopay || localConfig.kakaoPayChannelKey || "",
    },
  };
}

function journalMediaType(file = {}) {
  if (String(file.type || "").startsWith("video/")) return "video";
  return "image";
}

function safeJournalObjectName(file = {}, index = 0) {
  const extension = String(file.name || "media.bin").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const uniqueId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
  return `${uniqueId}.${extension}`;
}

function parseServerJournalBody(body = "") {
  try {
    const payload = JSON.parse(body || "{}");
    return payload?.schema === serverJournalSchema ? payload : null;
  } catch {
    return null;
  }
}

function serverJournalBody(log = {}) {
  return JSON.stringify({
    schema: serverJournalSchema,
    clientLogId: log.id,
    lessonId: log.lessonId,
    lessonLabel: log.lessonLabel,
    round: log.round,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculum?.id || log.nextCurriculumId || "FH-01",
    nextCurriculumId: log.nextCurriculumId || log.curriculum?.id || "FH-01",
    mediaNames: log.mediaNames || [],
    submittedAt: log.submittedAt,
  });
}

async function syncMemberLessonsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    const participants = await client.selectRows("tn_lesson_participants", {
      select: "lesson_id,ticket_id,user_id",
      filters: { user_id: profileId },
      limit: 100,
    });
    const ownLessonIds = new Set((participants || []).map((item) => item.lesson_id));
    const [rows, coachRoles, makeupEntitlementRows, releasedMakeupSlots, oneDaySlots] = await Promise.all([
      client.selectRows("tn_lessons", {
        select: "id,member_ticket_id,coach_role_id,lesson_date,start_time,duration_minutes,status,lesson_source",
        limit: 200,
      }),
      client.selectRows("tn_coach_roles", {
        select: "id,display_name,color,status",
        filters: { status: "approved" },
        limit: 50,
      }).catch(() => []),
      client.selectRows("tn_makeup_entitlements", {
        select: "id,source_lesson_id,ticket_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at",
        limit: 100,
      }).catch(() => []),
      client.rpc
        ? client.rpc("tn_member_released_makeup_slots", {}).catch(() => [])
        : Promise.resolve([]),
      client.rpc
        ? client.rpc("tn_member_one_day_schedule_slots", {}).catch(() => [])
        : Promise.resolve([]),
    ]);
    const coachNames = new Map((coachRoles || []).map((coach) => [coach.id, coach.display_name]));
    const lessonsById = new Map((rows || []).map((lesson) => [lesson.id, lesson]));
    const memberName = currentMemberName();
    state.liveMakeupEntitlements = (makeupEntitlementRows || [])
      .filter((entitlement) => ownLessonIds.has(entitlement.source_lesson_id))
      .map((entitlement) => {
        const sourceLesson = lessonsById.get(entitlement.source_lesson_id) || {};
        const lessonDate = sourceLesson.lesson_date || "";
        const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
        return {
          id: entitlement.id,
          sourceLessonId: entitlement.source_lesson_id,
          ticketId: entitlement.ticket_id,
          coachRoleId: entitlement.coach_role_id,
          coach: coachNames.get(entitlement.coach_role_id) || "담당 코치",
          lessonDate,
          day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
          time: String(sourceLesson.start_time || "").slice(0, 5),
          durationMinutes: Number(entitlement.duration_minutes) || Number(sourceLesson.duration_minutes) || 20,
          status: entitlement.status,
          reason: entitlement.reason || "회원 불참",
          markedAt: entitlement.marked_at || "",
          bookedLessonId: entitlement.booked_lesson_id || "",
          bookedAt: entitlement.booked_at || "",
        };
      });
    state.liveReleasedMakeupSlots = (releasedMakeupSlots || []).map((slot) => ({
      id: slot.slot_id,
      coachRoleId: slot.coach_role_id,
      lessonDate: slot.lesson_date,
      time: String(slot.start_time || "").slice(0, 5),
      durationMinutes: Number(slot.duration_minutes) || 20,
    }));
    const mappedLessons = (rows || [])
      .filter((lesson) => lesson.status !== "cancelled")
      .map((lesson) => {
        const isOwnLesson = ownLessonIds.has(lesson.id);
        const ticket = (state.liveTickets || []).find((item) => item.id === lesson.member_ticket_id) || {};
        const lessonSource = lesson.lesson_source === "makeup"
          ? "보강"
          : lesson.lesson_source === "coupon"
            ? "쿠폰"
            : lesson.lesson_source === "coach_change"
              ? "코치변경"
              : "정규";
        const visibleStatus = isOwnLesson
          ? lesson.status === "pending_change" ? "requested" : lesson.status
          : "occupied";
        return {
          ...lesson,
          serverStatus: lesson.status,
          serverLessonId: lesson.id,
          lessonDate: lesson.lesson_date,
          day: days[new Date(`${lesson.lesson_date}T00:00:00`).getDay() === 0 ? 6 : new Date(`${lesson.lesson_date}T00:00:00`).getDay() - 1],
          time: String(lesson.start_time || "").slice(0, 5),
          coach: coachNames.get(lesson.coach_role_id) || "담당 코치",
          member: isOwnLesson ? memberName : "",
          type: `${lessonSource} ${lesson.duration_minutes}분`,
          lessonSource: lesson.lesson_source || "regular",
          durationMinutes: Number(lesson.duration_minutes) || 20,
          ticketTotalSessions: Number(ticket.total) || 0,
          ticketUsedSessions: Number(ticket.used) || 0,
          ticketRemainingSessions: Number(ticket.remaining) || 0,
          ticketLessonMinutes: Number(ticket.lessonMinutes) || Number(lesson.duration_minutes) || 20,
          status: visibleStatus,
          isOwnLesson,
        };
      });
    const oneDayOccupancy = (oneDaySlots || []).map((slot) => {
      const lessonDate = slot.booking_date || "";
      const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
      return {
        id: `one-day-${slot.id}`,
        oneDayBooking: true,
        serverOneDayBookingId: slot.id,
        lessonDate,
        day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
        time: String(slot.start_time || "").slice(0, 5),
        coach: coachNames.get(slot.coach_role_id) || "담당 코치",
        coach_role_id: slot.coach_role_id,
        member: "",
        type: "원데이 예약",
        lessonSource: "one_day",
        durationMinutes: Number(slot.duration_minutes) || 20,
        status: "occupied",
        isOwnLesson: false,
      };
    });
    state.liveLessons = [...mappedLessons, ...oneDayOccupancy];
    state.liveLessonsLoaded = true;
    return true;
  } catch {
    state.liveLessons = [];
    state.liveMakeupEntitlements = [];
    state.liveReleasedMakeupSlots = [];
    state.liveLessonsLoaded = state.dataMode === "live";
    return false;
  }
}

async function syncMemberChangeRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !profileId) return false;
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,original_lesson_date,original_start_time,reviewed_note,deducted_sessions,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    } catch {
      rows = await client.selectRows("tn_lesson_change_requests", {
        select: "id,lesson_id,requester_user_id,requested_lesson_date,requested_start_time,reason,policy_window,status,decided_at,created_at",
        filters: { requester_user_id: profileId },
        limit: 100,
      });
    }
    const statusLabel = {
      pending: "코치 승인 대기 · 당일 취소 차감",
      approved: "코치 승인 완료",
      rejected: "코치 거절 · 당일 취소 차감",
      auto_approved: "자동 변경 완료",
    };
    state.makeupRequests = (rows || [])
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((row) => {
        const sourceLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === row.lesson_id) || {};
        const originalDate = row.original_lesson_date || sourceLesson.lessonDate || "";
        const originalTime = String(row.original_start_time || sourceLesson.time || "").slice(0, 5);
        const targetDate = row.requested_lesson_date || "";
        const targetTime = String(row.requested_start_time || "").slice(0, 5);
        return {
          id: row.id,
          serverRequestId: row.id,
          absence: `${originalDate} ${originalTime} 기존 수업`.trim(),
          makeup: `${targetDate} ${targetTime} 수업 변경 희망 · ${sourceLesson.coach || "담당 코치"}`.trim(),
          reason: row.reason || "이유 미입력",
          policy: row.policy_window === "auto_before_24h" ? policyDetail("auto") : policyDetail("coach"),
          status: statusLabel[row.status] || row.status,
          source: "server",
        };
      });
    return true;
  } catch {
    return false;
  }
}

function liveLessonForJournal(log = {}) {
  const activeTicketId = currentLiveTicket()?.id || "";
  const targetDate = log.journalDate || "";
  const targetTime = String(log.lessonLabel || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
  const candidates = state.liveLessons.filter((lesson) => lesson.isOwnLesson && lesson.status === "scheduled");
  return candidates.find((lesson) => lesson.id === log.lessonId)
    || candidates.find((lesson) => lesson.lessonDate === targetDate && lesson.time === targetTime && (!activeTicketId || lesson.member_ticket_id === activeTicketId))
    || candidates.find((lesson) => lesson.lessonDate === targetDate && (!activeTicketId || lesson.member_ticket_id === activeTicketId))
    || null;
}

async function downloadServerMediaItem(client, row, displayName = "첨부파일") {
  const blob = await client.downloadObject(journalMediaBucket, row.storage_path);
  return {
    name: displayName,
    type: row.media_type === "video" ? (blob.type || "video/mp4") : (blob.type || "image/jpeg"),
    url: URL.createObjectURL(blob),
    storagePath: row.storage_path,
    serverMediaId: row.id,
  };
}

async function syncMemberJournalEntriesFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.selectRows || !client.downloadObject || !profileId) return false;
  try {
    const [journalRows, mediaRows, recordRows, curriculumRows] = await Promise.all([
      client.selectRows("tn_journal_entries", {
        select: "id,user_id,lesson_id,entry_date,entry_type,body,created_at,updated_at",
        filters: { user_id: profileId },
        limit: 100,
      }),
      client.selectRows("tn_media_files", {
        select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
        filters: { owner_user_id: profileId },
        limit: 200,
      }),
      client.selectRows("tn_lesson_records", {
        select: "lesson_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
        limit: 100,
      }).catch(() => []),
      client.selectRows("tn_curriculum_refs", {
        select: "id,skill_label,title,notion_url,status",
        filters: { status: "active" },
        limit: 200,
      }).catch(() => []),
    ]);
    const ownLessonIds = new Set(state.liveLessons.filter((lesson) => lesson.isOwnLesson).map((lesson) => lesson.id));
    const recordsByLesson = new Map((recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .map((record) => [record.lesson_id, record]));
    const curriculaById = new Map((curriculumRows || []).map((curriculum) => [curriculum.id, curriculum]));

    for (const row of (journalRows || []).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))) {
      const payload = parseServerJournalBody(row.body);
      if (!payload) continue;
      const rowsForJournal = (mediaRows || [])
        .filter((media) => media.journal_entry_id === row.id)
        .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
      const mediaItems = await Promise.all(rowsForJournal.map((media, index) => (
        downloadServerMediaItem(client, media, payload.mediaNames?.[index] || `첨부 ${index + 1}`)
      )));
      const record = recordsByLesson.get(row.lesson_id);
      const recordCurriculum = curriculaById.get(record?.next_curriculum_ref_id);
      const nextCurriculumId = recordCurriculum?.skill_label || payload.nextCurriculumId || payload.curriculumId;
      const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
      const log = {
        id: payload.clientLogId || `server-journal-${row.id}`,
        serverJournalId: row.id,
        serverLessonId: row.lesson_id || "",
        lessonId: payload.lessonId || "",
        lessonLabel: payload.lessonLabel || "서버 수업기록",
        round: Number(payload.round) || lessonRound(),
        journalDate: row.entry_date,
        content: payload.content || "수업 내용 미입력",
        selfMemo: payload.selfMemo || "자기 운동 일지 미입력",
        mediaNames: payload.mediaNames || mediaItems.map((item) => item.name),
        mediaItems,
        status: record ? "confirmed" : "coach_pending",
        curriculum,
        nextCurriculumId: nextCurriculumId || curriculum.id,
        coachComment: record?.coach_comment || "",
        memberVisibleSummary: record ? `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}` : "",
        ticketDeducted: Boolean(record && Number(record.deducted_sessions) > 0),
        submittedAt: payload.submittedAt || row.created_at,
      };
      const existingIndex = state.lessonLogs.findIndex((item) => item.serverJournalId === row.id || item.id === log.id);
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = { ...state.lessonLogs[existingIndex], ...log };
      else state.lessonLogs.unshift(log);
    }

    const existingRecordLessonIds = new Set(state.lessonLogs
      .map((item) => item.serverLessonId)
      .filter(Boolean));
    const recordOnlyLogs = (recordRows || [])
      .filter((record) => ownLessonIds.has(record.lesson_id))
      .sort((left, right) => String(left.completed_at || "").localeCompare(String(right.completed_at || "")))
      .map((record, index) => ({ record, round: index + 1 }))
      .filter(({ record }) => !existingRecordLessonIds.has(record.lesson_id))
      .map(({ record, round }) => {
        const lesson = state.liveLessons.find((item) => item.id === record.lesson_id || item.serverLessonId === record.lesson_id) || {};
        const recordCurriculum = curriculaById.get(record.next_curriculum_ref_id);
        const nextCurriculumId = recordCurriculum?.skill_label || "FH-01";
        const curriculum = curriculumById(nextCurriculumId, curriculumSteps[0]);
        return {
          id: `server-record-${record.lesson_id}`,
          serverJournalId: "",
          serverLessonId: record.lesson_id,
          lessonId: lesson.id || `server-${record.lesson_id}`,
          lessonLabel: `${lesson.day || lesson.lessonDate || "수업"} ${lesson.time || ""} · ${lesson.type || "레슨"}`.trim(),
          round,
          journalDate: lesson.lessonDate || String(record.completed_at || "").slice(0, 10),
          content: "회원 운동일지 미작성 · 코치 수업기록",
          selfMemo: "운동일지 미작성",
          mediaNames: [],
          mediaItems: [],
          status: "confirmed",
          curriculum,
          nextCurriculumId,
          coachComment: record.coach_comment || "",
          memberVisibleSummary: `다음 수업 등록 완료: ${curriculum.id} · ${curriculum.title}`,
          ticketDeducted: Number(record.deducted_sessions) > 0,
          submittedAt: record.completed_at,
        };
      })
      .reverse();
    if (recordOnlyLogs.length) state.lessonLogs = [...recordOnlyLogs, ...state.lessonLogs];
    return true;
  } catch (error) {
    console.warn("Tennis Note member journal sync failed", error);
    return false;
  }
}

async function persistLessonJournalToServer(log, files = []) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!profileId || !client?.insertRows || !client?.uploadObject || !client.getSession?.()?.access_token) return false;
  const liveLesson = liveLessonForJournal(log);
  const inserted = await client.insertRows("tn_journal_entries", {
    user_id: profileId,
    lesson_id: liveLesson?.id || null,
    entry_date: log.journalDate,
    entry_type: "lesson",
    practice_type: null,
    body: serverJournalBody(log),
  });
  const journal = inserted?.[0];
  if (!journal?.id) throw new Error("journal_insert_failed");

  const uploadedPaths = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storagePath = `${profileId}/${journal.id}/${safeJournalObjectName(file, index)}`;
      await client.uploadObject(journalMediaBucket, storagePath, file);
      uploadedPaths.push(storagePath);
      await client.insertRows("tn_media_files", {
        owner_user_id: profileId,
        journal_entry_id: journal.id,
        storage_path: storagePath,
        media_type: journalMediaType(file),
      });
    }
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((storagePath) => client.deleteObject(journalMediaBucket, storagePath)));
    await client.deleteRows?.("tn_journal_entries", { id: journal.id }).catch(() => {});
    throw error;
  }

  log.serverJournalId = journal.id;
  log.serverLessonId = liveLesson?.id || "";
  return true;
}

function paymentMethodDefinition(methodId = state.selectedPaymentMethod) {
  return paymentMethodDefinitions.find((method) => method.id === methodId) || paymentMethodDefinitions[0];
}

function isPaymentGatewayReady(methodId = state.selectedPaymentMethod) {
  const config = paymentGatewayConfig();
  const channelReady = Boolean(config.storeId && config.channels?.[methodId]);
  if (methodId !== "naverpay") return channelReady;
  return channelReady && Boolean(config.naverPayCategoryType && config.naverPayCategoryId);
}

function normalizeSelectedPaymentMethod() {
  if (isPaymentGatewayReady(state.selectedPaymentMethod)) return state.selectedPaymentMethod;
  const readyMethod = paymentMethodDefinitions.find((method) => isPaymentGatewayReady(method.id));
  state.selectedPaymentMethod = readyMethod?.id || "card";
  return state.selectedPaymentMethod;
}

function selectPaymentMethod(methodId) {
  if (!paymentMethodDefinitions.some((method) => method.id === methodId) || !isPaymentGatewayReady(methodId)) return;
  state.selectedPaymentMethod = methodId;
  saveSnapshot();
  renderProducts();
}

function paymentRedirectUrl() {
  if (nativeAppPlatform() !== "web") return "com.tennisclubhouse.tennisnote://payment";
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

function portOnePaymentRequest({ paymentId, productId, orderName, totalAmount, methodId = state.selectedPaymentMethod }) {
  const config = paymentGatewayConfig();
  const method = paymentMethodDefinition(methodId);
  const channelKey = config.channels?.[method.id] || "";
  if (!config.storeId || !channelKey) throw new Error("payment_channel_not_ready");
  const request = {
    storeId: config.storeId,
    channelKey,
    paymentId,
    orderName,
    totalAmount,
    currency: "CURRENCY_KRW",
    payMethod: method.payMethod,
    locale: "KO_KR",
    customer: {
      fullName: state.profile.name,
      phoneNumber: state.profile.phone,
    },
    redirectUrl: paymentRedirectUrl(),
  };
  if (method.id === "naverpay") {
    request.windowType = { pc: "POPUP", mobile: "REDIRECTION" };
    request.bypass = {
      naverpay: {
        productItems: [{
          categoryType: config.naverPayCategoryType,
          categoryId: config.naverPayCategoryId,
          uid: String(productId || paymentId),
          name: orderName,
          count: 1,
        }],
      },
    };
  }
  if (method.id === "kakaopay") request.windowType = { pc: "IFRAME", mobile: "REDIRECTION" };
  if (nativeAppPlatform() !== "web") request.appScheme = "com.tennisclubhouse.tennisnote://";
  return request;
}

function renderPaymentGatewayStatus() {
  const target = $("#paymentGatewayStatus");
  if (!target) return;
  const selectedMethodId = normalizeSelectedPaymentMethod();
  const readyCount = paymentMethodDefinitions.filter((method) => isPaymentGatewayReady(method.id)).length;
  const ready = readyCount > 0;
  const methodButtons = paymentMethodDefinitions.map((method) => {
    const methodReady = isPaymentGatewayReady(method.id);
    const selected = method.id === selectedMethodId;
    return `
      <button class="payment-method-option ${selected ? "is-selected" : ""}" type="button" data-select-payment-method="${method.id}" aria-pressed="${selected}" ${methodReady ? "" : "disabled"}>
        <strong>${method.label}</strong>
        <small>${methodReady ? method.detail : "연결 준비중"}</small>
      </button>`;
  }).join("");
  target.innerHTML = `
    <article class="payment-status-card ${ready ? "ready" : "setup"}">
      <div>
        <strong>${ready ? "안전결제 연결됨" : "결제 연결 설정 필요"}</strong>
        <span>${ready ? `사용할 결제수단을 고른 뒤 회원권을 선택하세요. ${readyCount}/3개 수단 사용 가능` : "결제 채널 연결 후 회원권을 구매할 수 있습니다."}</span>
      </div>
      <b>${ready ? paymentMethodDefinition(selectedMethodId).shortLabel : "설정 대기"}</b>
    </article>
    <section class="payment-method-selector" aria-label="결제수단 선택">
      <div class="payment-method-selector-title">
        <strong>결제수단</strong>
        <span>온라인 결제는 카드가 기준입니다.</span>
      </div>
      <div class="payment-method-segments" role="group" aria-label="결제수단">${methodButtons}</div>
    </section>`;
}

function setNoticeDialogOpen(open) {
  const dialog = $("#noticeDialog");
  if (!dialog) return;
  if (open) {
    if (dialog.hidden) {
      noticePreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    dialog.hidden = false;
    document.body.classList.add("notice-open");
    window.requestAnimationFrame(() => {
      if (!dialog.hidden) $("#noticeClose")?.focus({ preventScroll: true });
    });
    return;
  }
  dialog.hidden = true;
  document.body.classList.remove("notice-open");
  if (noticePreviousFocus?.isConnected) noticePreviousFocus.focus({ preventScroll: true });
  noticePreviousFocus = null;
}

function showNoticeIfNeeded() {
  const today = localDateKey();
  const activeNotices = [...activeNoticesForApp("member"), ...couponBookingPopupNotices()];
  const hiddenToday = new Set(state.noticeHiddenDate === today
    ? [...(Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : []), state.noticeHiddenId].filter(Boolean)
    : []);
  const notice = activeNotices.find((item) => !noticeSessionSeenIds.has(item.id) && !(item.showOncePerDay && hiddenToday.has(item.id)));
  if (!notice) {
    setNoticeDialogOpen(false);
    return;
  }
  const noticeIndex = activeNotices.findIndex((item) => item.id === notice.id);
  $("#noticeEyebrow").textContent = notice.source === "coupon-booking" ? "회원권 알림" : "공지사항";
  $("#noticeTitle").textContent = notice.title;
  $("#noticeBody").textContent = notice.body;
  $("#noticeMeta").textContent = `${noticeMetaText(notice)} · ${noticeIndex + 1}/${activeNotices.length}`;
  const noticeImage = $("#noticeImage");
  noticeImage.hidden = !notice.imageUrl;
  noticeImage.src = notice.imageUrl || "";
  noticeImage.alt = notice.imageAlt || notice.title;
  const noticeAction = $("#noticeAction");
  const safeActionUrl = /^https?:\/\//i.test(notice.actionUrl) ? notice.actionUrl : "";
  const actionRoute = notice.actionRoute === "schedule" ? "schedule" : "";
  const hasAction = Boolean(safeActionUrl || actionRoute);
  noticeAction.hidden = !hasAction;
  noticeAction.href = safeActionUrl || "#";
  noticeAction.dataset.route = actionRoute;
  noticeAction.target = safeActionUrl ? "_blank" : "_self";
  noticeAction.textContent = notice.actionLabel || "자세히 보기";
  $("#noticeDialog").dataset.noticeId = notice.id;
  setNoticeDialogOpen(true);
}

function isActiveCouponLiveTicket(ticket, today = localDateKey()) {
  if (!ticket || ticket.status !== "active" || Number(ticket.remaining) <= 0) return false;
  if (ticket.startsOn && ticket.startsOn > today) return false;
  if (ticket.expiresOn && ticket.expiresOn < today) return false;
  return String(ticket.productKind || "").toLowerCase() === "coupon" || String(ticket.title || "").includes("쿠폰");
}

function liveTicketHasUpcomingLesson(ticket, today = localDateKey()) {
  return (state.liveLessons || []).some((lesson) => {
    if (String(lesson.member_ticket_id || lesson.ticketId || "") !== String(ticket.id || "")) return false;
    if (!lesson.lessonDate || lesson.lessonDate < today) return false;
    const status = lesson.serverStatus || lesson.status || "scheduled";
    return !["cancelled", "completed", "confirmed", "no_show"].includes(status);
  });
}

function couponBookingPopupNotices() {
  if (state.dataMode !== "live" || !state.liveLessonsLoaded) return [];
  return (state.liveTickets || [])
    .filter((ticket) => isActiveCouponLiveTicket(ticket) && !liveTicketHasUpcomingLesson(ticket))
    .map((ticket) => ({
      id: `coupon-next-booking-${ticket.id}`,
      title: "다음 수업을 예약해 주세요",
      body: `${ticket.title || "쿠폰제 회원권"}이 ${Number(ticket.remaining) || 0}회 남아 있습니다. 시간표에서 다음 수업을 선택해 주세요.`,
      audience: "member",
      priority: "important",
      status: "active",
      showOncePerDay: true,
      source: "coupon-booking",
      actionLabel: "시간표 보기",
      actionRoute: "schedule",
      startDate: "",
      endDate: "",
      imageUrl: "",
      imageAlt: "",
    }));
}

function closeNotice(hideToday = false) {
  const noticeId = $("#noticeDialog")?.dataset.noticeId || "";
  if (noticeId) noticeSessionSeenIds.add(noticeId);
  if (hideToday) {
    const today = localDateKey();
    const previousIds = state.noticeHiddenDate === today && Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : [];
    state.noticeHiddenDate = today;
    state.noticeHiddenId = noticeId;
    state.noticeHiddenIds = [...new Set([...previousIds, noticeId].filter(Boolean))];
  }
  setNoticeDialogOpen(false);
  saveSnapshot();
  window.setTimeout(showNoticeIfNeeded, 0);
}

function savePracticeLog() {
  const mediaItems = mediaItemsFromInput($("#practiceMedia"));
  const mediaNames = mediaItems.map((file) => file.name);
  const requestFeedback = $("#requestCoachFeedback")?.checked;
  const journalDate = $("#journalDate")?.value || localDateKey();
  const log = {
    id: `practice-${Date.now()}`,
    date: new Date(`${journalDate}T00:00:00`).toLocaleDateString("ko-KR"),
    journalDate,
    type: $("#practiceType").value,
    memo: $("#practiceMemo").value.trim() || "운동 기록 미입력",
    next: $("#practiceNext").value.trim() || "다음 연습 계획 미입력",
    mediaNames,
    mediaItems,
    feedbackQuestion: $("#feedbackQuestion")?.value.trim() || "",
    feedbackStatus: requestFeedback ? "코치 피드백 요청" : "개인 기록",
    coachFeedback: "",
    submittedAt: new Date().toISOString(),
  };
  state.practiceLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  if (requestFeedback) pushPracticeFeedbackToShared(log);
  renderAll();
}

function requestProduct(productId) {
  const product = membershipProducts().find((item) => item.id === productId);
  if (!product) return;
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: product.amount ? `${product.amount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: product.amount ? "결제 링크/입금 확인 대기" : "관리자 상담 필요",
    status: product.amount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`,
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: `local_${Date.now()}_${product.id}`,
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
  state.ticketHistory.unshift({ text: `${product.title} 구매 요청 생성 · ${product.coach}`, tone: product.amount ? "wait" : "done" });
  renderAll();
  setView("shopView");
}

function createPaymentRecord(product, overrides = {}) {
  const paymentAmount = onlinePaymentAmount(product);
  const request = {
    productId: product.id,
    productTitle: product.title,
    amountLabel: paymentAmount ? `${paymentAmount.toLocaleString("ko-KR")}원` : "무료",
    coach: product.coach,
    method: overrides.method || (paymentAmount ? "결제 확인 대기" : "관리자 상담 필요"),
    status: overrides.status || (paymentAmount ? `${product.flow} · 결제 확인 대기` : `${product.flow} · 관리자 확인 필요`),
    discount: product.discount,
    settlementBaseLabel: product.settlementBase ? `${product.settlementBase.toLocaleString("ko-KR")}원` : "관리자 확인",
    paymentId: overrides.paymentId || "",
    serverPaymentId: overrides.serverPaymentId || "",
  };
  state.paymentRequests.unshift(request);
  pushPaymentRequestToShared(request);
}

function paymentServerErrorMessage(error) {
  const code = error?.payload?.code || error?.message || "server_error";
  const labels = {
    group_next_payer_required: "이번 결제 담당 회원의 로그인이 필요합니다.",
    group_partner_required: "2대1 동반 회원 정보를 확인해주세요.",
    group_enrollment_required: "2대1 수강 가입서를 먼저 작성해주세요.",
    group_partner_duplicate_phone_review: "동반 회원 연락처를 관리자가 확인해야 합니다.",
    group_payment_not_allowed: "이 계정은 공동 회원권 결제 권한이 없습니다.",
    group_account_not_available: "선택한 2대1 공동 회원권을 확인할 수 없습니다. 회원권을 다시 선택해 주세요.",
  };
  return labels[code] || code;
}

function hasLiveMemberSession() {
  const client = window.TennisNoteDataClient;
  return Boolean(client?.readiness?.().ready && client.getSession?.()?.access_token);
}

function markTicketSyncLoginNeeded() {
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    if (hasLiveMemberSession()) {
      state.ticketSyncStatus = {
        tone: "alert",
        text: "서버 회원 연결 확인 필요 · 관리자 승인/회원권 확인",
      };
      return;
    }
    state.ticketSyncStatus = {
      tone: "wait",
      text: "서버 로그인 필요 · 간편 로그인 후 실제 회원권 확인",
    };
    return;
  }
  state.ticketSyncStatus = { tone: "alert", text: "실사용 데이터 연결 설정이 필요합니다" };
}

function liveTicketStatusInfo(status = "") {
  const key = String(status || "").toLowerCase();
  if (key === "active") return { label: "정상 이용중", tone: "done" };
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
    if (/[?�遺荑좏룿]/.test(text)) return "";
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
    groupSize: Number(row.group_size || product.group_size || 1),
    scheduleScope: liveTicketScheduleScope(row, product),
    maxSessionsPerDay: Number(row.max_sessions_per_day || product.max_sessions_per_day || 0),
    maxSessionsPerWeek: Number(row.max_sessions_per_week || product.max_sessions_per_week || 0),
    maxBookingDaysPerWeek: Number(row.max_booking_days_per_week || product.max_booking_days_per_week || 0),
    makeupAnchorMinutes: Number(row.makeup_anchor_minutes || product.makeup_anchor_minutes || 40),
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

function liveTicketPriority(ticket = {}) {
  if (ticket.status === "active") return 0;
  if (ticket.status === "pending_payment") return 1;
  if (["expired", "cancelled", "canceled", "refunded"].includes(String(ticket.status || "").toLowerCase())) return 4;
  return 3;
}

function currentLiveTicket() {
  if (!Array.isArray(state.liveTickets) || !state.liveTickets.length) return null;
  const usableTickets = state.liveTickets.filter((ticket) => ["active", "pending_payment"].includes(String(ticket.status || "").toLowerCase()));
  if (!usableTickets.length) return null;
  return [...usableTickets].sort((a, b) => {
    const priority = liveTicketPriority(a) - liveTicketPriority(b);
    if (priority) return priority;
    const sharedGroupPriority = Number(Boolean(b.sharedGroupTicket && Number(b.groupSize) === 2))
      - Number(Boolean(a.sharedGroupTicket && Number(a.groupSize) === 2));
    if (sharedGroupPriority) return sharedGroupPriority;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  })[0] || null;
}

async function attachLiveTicketProducts(client, rows = []) {
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  if (!productIds.length) return rows;
  const productMap = {};
  await Promise.all(productIds.map(async (productId) => {
    try {
      const productRows = await client.selectRows("tn_membership_products", {
        select: "id,product_code,name,lesson_minutes,product_kind,total_sessions,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes",
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

async function syncMemberGroupAccountFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const ownRows = await client.selectRows("tn_group_account_members", {
      select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
      filters: { user_id: profileId },
      limit: 20,
    });
    const activeGroupAccountId = currentLiveTicket()?.groupAccountId || "";
    const ownMembership = (ownRows || []).find((row) => row.group_account_id === activeGroupAccountId) || ownRows?.[0];
    if (!ownMembership?.group_account_id) {
      state.groupAccount = null;
      return true;
    }
    const [accountRows, memberRows] = await Promise.all([
      client.selectRows("tn_group_accounts", {
        select: "id,coach_role_id,display_name,status,payment_mode,next_payer_user_id,schedule_sync_required",
        filters: { id: ownMembership.group_account_id },
        limit: 1,
      }),
      client.selectRows("tn_group_account_members", {
        select: "id,group_account_id,user_id,display_name,participant_order,app_status,can_manage_schedule,can_pay",
        filters: { group_account_id: ownMembership.group_account_id },
        limit: 2,
      }),
    ]);
    const account = accountRows?.[0];
    if (!account) {
      state.groupAccount = null;
      return true;
    }
    let coachName = "담당 코치";
    if (account.coach_role_id) {
      const coachRows = await client.selectRows("tn_coach_roles", {
        select: "id,display_name",
        filters: { id: account.coach_role_id },
        limit: 1,
      }).catch(() => []);
      coachName = coachRows?.[0]?.display_name || coachName;
    }
    const members = [...(memberRows || [])]
      .sort((a, b) => Number(a.participant_order) - Number(b.participant_order))
      .map((member, index) => ({
        userId: member.user_id,
        name: member.display_name || `회원 ${index + 1}`,
        appStatus: member.app_status || "not_joined",
        canManageSchedule: member.can_manage_schedule === true,
        canPay: member.can_pay === true,
      }));
    state.groupAccount = {
      id: account.id,
      demoOnly: false,
      name: account.display_name || members.map((member) => member.name).join(" · "),
      schedule: "공동 시간표",
      coach: coachName,
      paymentMode: account.payment_mode || "representative",
      nextPayerUserId: account.next_payer_user_id || "",
      nextPayer: members.find((member) => member.userId === account.next_payer_user_id)?.name || members[0]?.name || "대표회원",
      scheduleSyncRequired: account.schedule_sync_required !== false,
      members,
    };
    return true;
  } catch {
    state.groupAccount = null;
    return false;
  }
}

async function syncMemberHoldingRequestsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_holding_requests", {
      select: "id,ticket_id,request_type,requested_start_on,requested_end_on,reason_summary,evidence_object_path,evidence_status,status,reviewed_at,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    const shared = loadSharedData();
    const otherMembers = (shared.holdingRequests || []).filter((request) => request.member !== (state.member?.name || state.profile.name));
    const ownRequests = (rows || []).map((row) => ({
      id: row.id,
      member: state.member?.name || state.profile.name,
      ticketId: row.ticket_id,
      ticketTitle: state.profile.ticket || "회원권",
      type: row.request_type,
      typeLabel: row.request_type === "injury" ? "부상·입원" : "개인 사유",
      startDate: row.requested_start_on,
      endDate: row.requested_end_on,
      days: holdingRequestDays(row.requested_start_on, row.requested_end_on),
      reason: row.reason_summary || "",
      evidencePath: row.evidence_object_path || "",
      evidenceLabel: row.request_type === "injury" ? "증빙 첨부" : "증빙 없음",
      status: row.status || "pending",
      source: "server",
      reviewedAt: row.reviewed_at || "",
      createdAt: row.created_at || "",
    }));
    shared.holdingRequests = [...ownRequests, ...otherMembers];
    saveSharedData(shared);
    return true;
  } catch {
    return false;
  }
}

async function syncMemberAccountDeletionRequestFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "id,user_id,status,reason_summary,admin_note,retained_data_summary,requested_at,reviewed_at,completed_at,cancelled_at,created_at",
      filters: { user_id: profileId },
      limit: 20,
    });
    state.accountDeletionRequest = (rows || [])
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0] || null;
    renderAccountDeletionSettings();
    return true;
  } catch {
    state.accountDeletionRequest = null;
    renderAccountDeletionSettings();
    return false;
  }
}

async function syncMemberHoldingPolicyFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_admin_settings", {
      select: "key,value,updated_at",
      filters: { key: holdingPolicyKey },
      limit: 1,
    });
    if (rows?.[0]?.value) state.holdingPolicySettings = { ...state.holdingPolicySettings, ...rows[0].value };
    return true;
  } catch {
    return false;
  }
}

async function syncLiveMembershipProductsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_membership_products", {
      select: "id,name,lesson_minutes,machine_minutes,frequency_per_week,total_sessions,group_size,card_price,cash_price,settlement_base_price,validity_days,grace_days,product_kind,discount_enabled,coach_discount_allowed,is_active,display_order",
      filters: { is_active: true },
      limit: 100,
    });
    const products = (rows || [])
      .filter((row) => numericValue(row.card_price) > 0)
      .sort((left, right) => numericValue(left.display_order, 999) - numericValue(right.display_order, 999))
      .map(membershipProductFromServer);
    state.liveMembershipProducts = products;
    return products.length > 0;
  } catch {
    if (state.dataMode === "live") state.liveMembershipProducts = [];
    return false;
  }
}

function reconcileVerifiedPaymentRequests() {
  const completedPaymentIds = new Set();
  (state.liveTickets || [])
    .filter((ticket) => String(ticket.status || "").toLowerCase() === "active")
    .forEach((ticket) => {
      [ticket.paymentId, ticket.providerPaymentId, ticket.sourcePaymentId].filter(Boolean).forEach((id) => completedPaymentIds.add(String(id)));
    });
  if (!completedPaymentIds.size) return false;

  const isCompletedRequest = (request = {}) => [request.paymentId, request.serverPaymentId]
    .filter(Boolean)
    .some((id) => completedPaymentIds.has(String(id)));
  const beforeCount = state.paymentRequests.length;
  state.paymentRequests = state.paymentRequests.filter((request) => !isCompletedRequest(request));

  const shared = loadSharedData();
  const sharedRequests = Array.isArray(shared.paymentRequests) ? shared.paymentRequests : [];
  const nextSharedRequests = sharedRequests.filter((request) => !isCompletedRequest(request));
  if (nextSharedRequests.length !== sharedRequests.length) {
    shared.paymentRequests = nextSharedRequests;
    saveSharedData(shared);
  }
  return beforeCount !== state.paymentRequests.length;
}

async function syncMemberTicketsFromServer(profile = null) {
  const client = window.TennisNoteDataClient;
  const profileId = profile?.id || state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.selectRows || !profileId) return false;

  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  try {
    let rows;
    try {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes)",
        filters: { user_id: profileId },
        limit: 20,
      });
    } catch {
      rows = await client.selectRows("tn_member_tickets", {
        select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
        filters: { user_id: profileId },
        limit: 20,
      });
    }

    const sharedLinks = await client.selectRows("tn_group_ticket_links", {
      select: "group_account_id,ticket_id,status",
      filters: { user_id: profileId },
      limit: 20,
    }).catch(() => []);
    const activeSharedLinks = (sharedLinks || [])
      .filter((link) => !["expired", "refunded"].includes(String(link.status || "").toLowerCase()));
    const sharedTicketIds = new Set(activeSharedLinks
      .map((link) => link.ticket_id)
      .filter(Boolean));
    const sharedAccountIdByTicketId = new Map(activeSharedLinks
      .filter((link) => link.ticket_id && link.group_account_id)
      .map((link) => [link.ticket_id, link.group_account_id]));
    const ownedTicketIds = new Set((rows || []).map((row) => row.id));
    const sharedTicketRows = await Promise.all(activeSharedLinks
      .filter((link) => link.ticket_id && !ownedTicketIds.has(link.ticket_id))
      .map(async (link) => {
        try {
          return await client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at,tn_membership_products(product_code,name,lesson_minutes,product_kind,total_sessions,group_size,schedule_scope,max_sessions_per_day,max_sessions_per_week,max_booking_days_per_week,makeup_anchor_minutes)",
            filters: { id: link.ticket_id },
            limit: 1,
          });
        } catch {
          return client.selectRows("tn_member_tickets", {
            select: "id,branch_id,user_id,product_id,coach_role_id,status,total_sessions,used_sessions,remaining_sessions,starts_on,expires_on,source_payment_id,created_at",
            filters: { id: link.ticket_id },
            limit: 1,
          }).catch(() => []);
        }
      }));
    rows = [...(rows || []), ...sharedTicketRows.flat()].map((row) => ({
      ...row,
      shared_group_ticket: sharedTicketIds.has(row.id),
      shared_group_account_id: sharedAccountIdByTicketId.get(row.id) || "",
    }));

    rows = await attachLiveTicketProducts(client, rows || []);
    rows = await attachLiveTicketPayments(client, rows || []);
    state.liveTickets = Array.isArray(rows) ? rows.map(normalizeLiveTicket) : [];
    const paymentRequestsChanged = reconcileVerifiedPaymentRequests();
    const ticket = currentLiveTicket();
    if (!ticket) {
      state.remaining = 0;
      state.profile.ticket = "현재 이용권 없음";
      state.ticketSyncStatus = { tone: "wait", text: "현재 이용 가능한 회원권 없음 · 결제 또는 관리자 충전 필요" };
      return true;
    }

    if (ticket.total) {
      state.remaining = ticket.remaining;
      state.profile.ticket = `${ticket.title} · 총 ${ticket.total}회`;
    }
    if (ticket.status === "active" && state.member) state.member.memberKind = "lesson_member";
    state.ticketSyncStatus = {
      tone: ticket.tone,
      text: `${ticket.statusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
    };
    const syncKey = `${ticket.id}:${ticket.status}:${ticket.remaining}:${ticket.total}`;
    if (syncKey !== state.lastLiveTicketKey) {
      state.lastLiveTicketKey = syncKey;
      state.ticketHistory.unshift({
        text: `${ticket.title} · ${ticket.statusLabel} · 총 ${ticket.total || 0} / 소진 ${ticket.used || 0} / 잔여 ${ticket.remaining || 0}`,
        tone: ticket.tone,
      });
    }
    if (paymentRequestsChanged) saveSnapshot();
    return true;
  } catch {
    state.liveTickets = [];
    state.remaining = 0;
    state.profile.ticket = "회원권 확인 필요";
    state.ticketSyncStatus = { tone: "alert", text: "서버 회원권 확인 실패 · 다시 로그인하거나 관리자에게 문의해주세요" };
    return false;
  }
}

async function prepareServerPayment(product, paymentId, methodId = state.selectedPaymentMethod) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  const paymentAmount = onlinePaymentAmount(product);
  return client.invokeFunction("portone-payment/prepare", {
    body: {
      paymentId,
      productKey: product.id,
      productTitle: product.title,
      amount: paymentAmount,
      originalAmount: product.cardAmount || product.listAmount || paymentAmount,
      cashPrice: product.cashAmount || product.settlementBase || paymentAmount,
      settlementBaseAmount: product.settlementBase || product.cashAmount || paymentAmount,
      finalAmount: paymentAmount,
      totalSessions: product.tickets || 1,
      lessonMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      machineMinutes: Number(product.lessonMinutes) || (product.title.includes("30") || product.detail.includes("30") ? 30 : 20),
      productKind: product.productKind === "pass" || product.mode === "coupon" || product.mode === "pass" ? "coupon" : product.mode === "add" ? "add" : product.mode === "renewal" ? "renewal" : "regular",
      groupSize: Number(product.groupSize) || (product.title.includes("2대1") || product.detail.includes("2대1") || product.detail.includes("2:1") ? 2 : 1),
      validityDays: Number(product.validityDays) || 35,
      graceDays: Number(product.graceDays) || 0,
      method: paymentMethodDefinition(methodId).id,
      groupAccountId: Number(product.groupSize) === 2 ? state.groupAccount?.id || null : null,
    },
  });
}

async function verifyServerPayment(paymentId) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    throw new Error("login_required");
  }
  return client.invokeFunction("portone-payment/verify", {
    body: { paymentId },
  });
}

function clearPaymentRedirectParams() {
  const url = new URL(window.location.href);
  ["paymentId", "code", "message", "pgCode", "pgMessage"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function handlePaymentRedirectResult() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("paymentId") || "";
  if (!paymentId) return false;
  const errorCode = params.get("code") || "";
  const message = params.get("message") || params.get("pgMessage") || "";
  clearPaymentRedirectParams();
  if (errorCode) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: message || "결제가 완료되지 않았습니다." };
    state.ticketHistory.unshift({ text: message || `결제 미완료 · ${errorCode}`, tone: "alert" });
    renderAll();
    setView("shopView");
    return true;
  }
  try {
    const verification = await verifyServerPayment(paymentId);
    state.pendingPaymentCheckStatus = verification?.ok
      ? { tone: "done", text: "결제 검증이 끝났습니다. 회원권 상태를 확인합니다." }
      : { tone: "wait", text: "결제 접수 후 서버 검증을 기다리는 중입니다." };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 서버 검증 완료", tone: verification?.ok ? "done" : "wait" });
  } catch (error) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: `결제 검증 확인 필요 · ${paymentServerErrorMessage(error)}` };
    state.ticketHistory.unshift({ text: "결제창 복귀 · 관리자 검증 확인 필요", tone: "alert" });
  }
  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
  return true;
}

async function checkPendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || currentLiveTicket();
  const paymentId = ticket?.providerPaymentId || "";
  if (!ticket || !paymentId) {
    state.ticketSyncStatus = { tone: "alert", text: "결제 기록 연결 확인 필요 · 새 결제 전 관리자 화면 확인" };
    state.pendingPaymentCheckStatus = { tone: "alert", text: "결제 기록을 찾지 못했습니다. 새 결제 전 관리자 화면을 먼저 확인해주세요." };
    state.ticketHistory.unshift({ text: "대기 회원권의 결제 기록을 아직 찾지 못했습니다.", tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }

  state.ticketSyncStatus = { tone: "wait", text: "결제 상태 서버 확인 중" };
  state.pendingPaymentCheckStatus = { tone: "wait", text: "결제 상태를 확인하는 중입니다." };
  renderProducts();
  try {
    const verification = await verifyServerPayment(paymentId);
    if (verification?.ok) {
      state.pendingPaymentCheckStatus = { tone: "done", text: "서버 검증이 완료되었습니다. 회원권 상태를 새로 확인합니다." };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제 검증 완료 · 회원권 활성화 확인`, tone: "done" });
    } else if (verification?.code === "payment_not_paid") {
      state.pendingPaymentCheckStatus = { tone: "wait", text: "아직 결제 완료 전입니다. 결제창에서 결제를 마친 뒤 다시 눌러주세요." };
      state.ticketHistory.unshift({ text: `${ticket.title} 아직 결제 완료 전 · 결제 완료 후 다시 확인`, tone: "wait" });
      state.ticketSyncStatus = { tone: "wait", text: "아직 결제 완료 전 · 결제창 완료 후 다시 확인" };
    } else {
      state.pendingPaymentCheckStatus = { tone: "alert", text: `결제 확인이 필요합니다. ${verification?.code || "서버 응답을 확인해주세요."}` };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제 확인 필요 · ${verification?.code || "서버 응답 확인"}`, tone: "alert" });
      state.ticketSyncStatus = { tone: "alert", text: "결제 확인 필요 · 관리자 확인" };
    }
  } catch (error) {
    const code = paymentServerErrorMessage(error);
    const isNotPaid = code === "payment_not_paid";
    state.ticketHistory.unshift({
      text: isNotPaid
        ? `${ticket.title} 아직 결제 완료 전 · 결제 후 다시 확인`
        : `${ticket.title} 결제 검증 실패 · ${code}`,
      tone: isNotPaid ? "wait" : "alert",
    });
    state.pendingPaymentCheckStatus = {
      tone: isNotPaid ? "wait" : "alert",
      text: isNotPaid ? "아직 결제 완료 전입니다. 결제창에서 결제를 마친 뒤 다시 확인해주세요." : `결제 검증 실패: ${code}`,
    };
    state.ticketSyncStatus = {
      tone: isNotPaid ? "wait" : "alert",
      text: isNotPaid ? "아직 결제 완료 전 · 결제 후 다시 확인" : `결제 검증 실패 · ${code}`,
    };
  }
  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

async function resumePendingTicketPayment(ticketId = "") {
  const ticket = state.liveTickets.find((item) => item.id === ticketId) || currentLiveTicket();
  const paymentId = ticket?.providerPaymentId || "";
  const amount = Number(ticket?.paymentAmount || 0);
  const methodId = paymentMethodDefinitions.some((method) => method.id === ticket?.paymentMethod)
    ? ticket.paymentMethod
    : normalizeSelectedPaymentMethod();
  if (!ticket || !paymentId || !amount || !isPaymentGatewayReady(methodId)) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "기존 결제창을 열 결제 기록이나 결제 설정을 확인해주세요." };
    renderAll();
    setView("shopView");
    return;
  }

  try {
    const PortOne = await import("https://cdn.portone.io/v2/browser-sdk.esm.js");
    const response = await PortOne.requestPayment(portOnePaymentRequest({
      paymentId,
      productId: ticket.productId,
      orderName: ticket.title,
      totalAmount: amount,
      methodId,
    }));

    if (response?.code) {
      state.pendingPaymentCheckStatus = { tone: "alert", text: response.message || "결제가 완료되지 않았습니다." };
      state.ticketHistory.unshift({ text: `${ticket.title} 결제창 종료 · 결제 미완료`, tone: "alert" });
    } else {
      state.pendingPaymentCheckStatus = { tone: "wait", text: "결제창 완료 접수 · 서버 검증을 확인합니다." };
      await checkPendingTicketPayment(ticketId);
      return;
    }
  } catch {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "결제창을 열지 못했습니다. 잠시 후 다시 시도해주세요." };
    state.ticketHistory.unshift({ text: `${ticket.title} 결제창 열기 실패`, tone: "alert" });
  }

  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

async function startProductPayment(productId, options = {}) {
  const product = membershipProducts().find((item) => item.id === productId);
  if (!product) return;
  const paymentAmount = onlinePaymentAmount(product);
  if (!paymentAmount || product.status === "consult") {
    requestProduct(productId);
    return;
  }

  const methodId = normalizeSelectedPaymentMethod();
  const method = paymentMethodDefinition(methodId);
  if (!options.skipEnrollmentGate && state.member && !memberEnrollmentAllowsProduct(product)) {
    openMemberEnrollmentModal(productId);
    return;
  }
  if (!hasLiveMemberSession()) {
    markTicketSyncLoginNeeded();
    state.pendingPaymentCheckStatus = { tone: "alert", text: "서버 로그인 후 결제할 수 있습니다. 간편 로그인으로 다시 접속해주세요." };
    state.ticketHistory.unshift({ text: `${product.title} 결제 전 서버 로그인 필요`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }
  const paymentId = `tn_${Date.now()}_${product.id}`;
  if (!isPaymentGatewayReady(methodId)) {
    createPaymentRecord(product, {
      paymentId,
      method: `${method.label} 설정 필요`,
      status: `${product.flow} · 결제 채널 연결 후 결제 가능`,
    });
    state.ticketHistory.unshift({ text: `${product.title} 결제 준비 · ${method.label} 연결 필요`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }
  if (methodId === "naverpay" && paymentAmount < 100) {
    state.pendingPaymentCheckStatus = { tone: "alert", text: "네이버페이는 100원 이상부터 결제할 수 있습니다." };
    renderAll();
    setView("shopView");
    return;
  }

  let preparedPayment = null;
  try {
    preparedPayment = await prepareServerPayment(product, paymentId, methodId);
    await syncMemberTicketsFromServer();
  } catch (error) {
    const serverCode = error?.payload?.code || error?.message || "server_error";
    const serverError = paymentServerErrorMessage(error);
    if (["membership_enrollment_required", "group_enrollment_required", "group_partner_required"].includes(serverCode)) {
      await syncMemberEnrollmentFromServer();
      openMemberEnrollmentModal(productId, "2대1 동반 회원 정보를 포함해 수강 가입서를 확인해 주세요.");
      return;
    }
    if (serverCode === "login_required") {
      markTicketSyncLoginNeeded();
      state.pendingPaymentCheckStatus = { tone: "alert", text: "서버 로그인 후 결제할 수 있습니다. 간편 로그인으로 다시 접속해주세요." };
      state.ticketHistory.unshift({ text: `${product.title} 결제 전 서버 로그인 필요`, tone: "alert" });
      renderAll();
      setView("shopView");
      return;
    }
    createPaymentRecord(product, {
      paymentId,
      method: "서버 결제 기록 생성 실패",
      status: `네이버 로그인 후 다시 시도 필요 · ${paymentServerErrorMessage(error)}`,
    });
    state.ticketHistory.unshift({ text: `${product.title} 결제 기록 생성 실패 · 로그인/회원 연결 확인`, tone: "alert" });
    renderAll();
    setView("shopView");
    return;
  }

  try {
    const PortOne = await import("https://cdn.portone.io/v2/browser-sdk.esm.js");
    const response = await PortOne.requestPayment(portOnePaymentRequest({
      paymentId,
      productId: product.id,
      orderName: product.title,
      totalAmount: paymentAmount,
      methodId,
    }));

    if (response?.code) {
      createPaymentRecord(product, {
        paymentId,
        method: `${method.label} 결제 실패`,
        status: response.message || "결제가 완료되지 않았습니다.",
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 실패 · 다시 시도 필요`, tone: "alert" });
    } else {
      const paidPaymentId = response?.paymentId || paymentId;
      let verifiedStatus = "결제 완료 · 서버 검증 후 회원권 충전 대기";
      try {
        const verification = await verifyServerPayment(paidPaymentId);
        if (verification?.ok) {
          verifiedStatus = verification.status === "verified"
            ? "서버 검증 완료 · 이용권 충전 확인 필요"
            : "서버 검증 확인 · 관리자 확인 필요";
        }
      } catch (error) {
        verifiedStatus = `결제 완료 · 서버 검증 대기 · ${paymentServerErrorMessage(error)}`;
      }
      createPaymentRecord(product, {
        paymentId: paidPaymentId,
        serverPaymentId: preparedPayment?.localPaymentId || "",
        method: method.label,
        status: verifiedStatus,
      });
      state.ticketHistory.unshift({ text: `${product.title} 결제 완료 접수 · 검증 후 회원권 충전`, tone: "wait" });
    }
  } catch (error) {
    createPaymentRecord(product, {
      paymentId,
      method: "결제창 오류",
      status: "결제창을 열지 못했습니다. 관리자 확인이 필요합니다.",
    });
    state.ticketHistory.unshift({ text: `${product.title} 결제창 오류 · 관리자 확인 필요`, tone: "alert" });
  }

  await syncMemberTicketsFromServer();
  renderAll();
  setView("shopView");
}

function renderJournalCalendar() {
  const target = $("#journalCalendar");
  if (!target) return;
  const todayValue = localDateKey();
  const selectedDate = state.selectedJournalDate || todayValue;
  const monthValue = state.activeJournalMonth || selectedDate.slice(0, 7);
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const query = (state.journalSearchQuery || "").trim();
  const entries = journalEntries();
  const lessonDates = new Set(entries.filter((entry) => entry.kind === "레슨" && entry.dateValue?.startsWith(monthValue)).map((entry) => entry.dateValue));
  const entriesByDate = entries.reduce((map, entry) => {
    if (!entry.dateValue?.startsWith(monthValue) || !journalMatchesSearch(entry, query)) return map;
    if (!map.has(entry.dateValue)) map.set(entry.dateValue, []);
    map.get(entry.dateValue).push(entry);
    return map;
  }, new Map());
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"].map((day) => `<b>${day}</b>`).join("");
  const emptyMarkup = Array.from({ length: firstWeekday }, () => `<span class="calendar-empty"></span>`).join("");
  const daysMarkup = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
    const dayEntries = entriesByDate.get(dateValue) || [];
    const hasRecord = dayEntries.length > 0;
    const hasLesson = lessonDates.has(dateValue);
    const entry = dayEntries[0];
    const label = dayEntries.length > 1 ? `${dayEntries.length}건` : entry?.kind || (hasLesson ? "수업" : "");
    const accessibleLabel = label || "기록 없음";
    return `
      <button class="journal-day ${hasRecord ? "has-record" : ""} ${hasLesson ? "has-lesson" : ""} ${selectedDate === dateValue ? "is-selected" : ""} ${query && hasRecord ? "matches-search" : ""}" type="button" data-select-journal-date="${dateValue}" aria-label="${dateValue} ${accessibleLabel}">
        <strong>${day}</strong>
        ${label ? `<span>${label}</span>` : ""}
      </button>`;
  }).join("");
  target.innerHTML = `<div class="calendar-weekdays">${weekdays}</div><div class="calendar-days">${emptyMarkup}${daysMarkup}</div>`;
  const monthLabel = $("#journalMonthLabel");
  if (monthLabel) monthLabel.textContent = `${year}년 ${monthIndex + 1}월`;
  const jumpInput = $("#journalJumpDate");
  if (jumpInput && jumpInput.value !== selectedDate) jumpInput.value = selectedDate;
  const searchInput = $("#journalSearch");
  if (searchInput && searchInput.value !== query) searchInput.value = query;
  renderSelectedJournalDayPanel();
}

function journalEntries() {
  const lessonEntries = state.lessonLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      kind: "레슨",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: lessonReviewTitle(log),
      subtitle: log.lessonLabel,
      body: log.selfMemo,
      note: log.coachComment || "코치 피드백 대기",
      next: log.memberVisibleSummary || selectedNextText(log),
      curriculumStep: curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum),
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  const practiceEntries = state.practiceLogs.map((log) => {
    const dateValue = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
    return {
      id: log.id,
      kind: "개인운동",
      day: new Date(`${dateValue}T00:00:00`).getDate(),
      dateLabel: dateValue,
      dateValue,
      title: `${log.type} 기록`,
      subtitle: log.date,
      body: log.memo,
      note: log.coachFeedback || log.feedbackStatus || "개인 기록",
      next: log.next,
      mediaNames: log.mediaNames || [],
      mediaItems: normalizeMediaItems(log),
    };
  });
  return [...lessonEntries, ...practiceEntries];
}

function journalMatchesSearch(entry, rawQuery) {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query) return true;
  return [entry.kind, entry.dateLabel, entry.title, entry.subtitle, entry.body, entry.note, entry.next, ...(entry.mediaNames || [])]
    .some((value) => `${value || ""}`.toLowerCase().includes(query));
}

function selectedJournalEntries() {
  const selectedDate = state.selectedJournalDate || localDateKey();
  const query = state.journalSearchQuery || "";
  return journalEntries().filter((entry) => entry.dateValue === selectedDate && journalMatchesSearch(entry, query));
}

function renderSelectedJournalCard(entry) {
  return `
    <article class="journal-selected-card ${entry.kind === "레슨" ? "lesson" : "practice"}">
      <div class="journal-selected-card-head">
        <span>${entry.kind}</span>
        <strong>${entry.title}</strong>
        <small>${entry.subtitle || entry.dateLabel}</small>
      </div>
      <p>${entry.body}</p>
      <div class="journal-selected-meta">
        <span>${entry.note}</span>
        ${entry.next ? `<b>${entry.next}</b>` : ""}
        ${entry.mediaNames?.length ? `<small>첨부 ${entry.mediaNames.length}개</small>` : ""}
      </div>
      <button class="small-button" type="button" data-open-journal-detail="${entry.id}">자세히 보기</button>
    </article>`;
}

function renderSelectedJournalDayPanel() {
  const target = $("#journalSelectedDayPanel");
  if (!target) return;
  const selectedDate = state.selectedJournalDate || localDateKey();
  const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const query = (state.journalSearchQuery || "").trim();
  const entries = selectedJournalEntries();
  target.innerHTML = `
    <div class="journal-selected-heading">
      <div>
        <strong>${dateLabel}</strong>
        <span>${query ? `"${query}" 검색 결과` : "선택한 날짜 기록"}</span>
      </div>
      <button class="small-button" type="button" data-journal-write-date="${selectedDate}">이 날짜에 기록</button>
    </div>
    <div class="journal-selected-list">
      ${entries.length ? entries.map(renderSelectedJournalCard).join("") : `<p class="empty-text">선택한 날짜에 표시할 기록이 없습니다.</p>`}
    </div>`;
}

function selectJournalDate(dateValue) {
  if (!dateValue) return;
  state.selectedJournalDate = dateValue;
  state.activeJournalMonth = dateValue.slice(0, 7);
  renderJournalCalendar();
  saveSnapshot();
}

function changeJournalMonth(delta) {
  const selectedDate = state.selectedJournalDate || localDateKey();
  const monthValue = state.activeJournalMonth || selectedDate.slice(0, 7);
  const [yearText, monthText] = monthValue.split("-");
  const nextMonth = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  const nextMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  state.activeJournalMonth = nextMonthValue;
  if (!selectedDate.startsWith(nextMonthValue)) state.selectedJournalDate = `${nextMonthValue}-01`;
  renderJournalCalendar();
  saveSnapshot();
}

let activeAppSheetId = "";

function refreshAppSheetState() {
  document.body.classList.toggle("sheet-open", Boolean(activeAppSheetId));
}

function openAppSheet(sheetId) {
  const target = $(`#${sheetId}`);
  if (!target) return;
  if (activeAppSheetId && activeAppSheetId !== sheetId) closeAppSheet(activeAppSheetId, true);
  target.hidden = false;
  activeAppSheetId = sheetId;
  refreshAppSheetState();
  const historyState = typeof history.state === "object" && history.state ? history.state : {};
  if (historyState.tennisNoteSheet !== sheetId) {
    history.pushState({ ...historyState, tennisNoteSheet: sheetId }, "", window.location.href);
  }
}

function closeAppSheet(sheetId, fromHistory = false) {
  const target = $(`#${sheetId}`);
  if (!target) return;
  target.hidden = true;
  if (activeAppSheetId === sheetId) activeAppSheetId = "";
  refreshAppSheetState();
  if (!fromHistory && history.state?.tennisNoteSheet === sheetId) history.back();
}

function closeVisibleAppSheet(fromHistory = false) {
  if (activeAppSheetId) closeAppSheet(activeAppSheetId, fromHistory);
}

function journalDateLabel(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "선택한 날짜";
  return parsed.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function openJournalComposer(dateValue = "") {
  const selectedDate = dateValue || state.selectedJournalDate || $("#journalDate")?.value || localDateKey();
  selectJournalDate(selectedDate);
  if ($("#journalDate")) $("#journalDate").value = selectedDate;
  if ($("#journalComposerDateLabel")) $("#journalComposerDateLabel").textContent = journalDateLabel(selectedDate);
  renderJournalMode();
  openAppSheet("journalComposerSheet");
  window.setTimeout(() => $("#journalMode")?.focus(), 40);
}

function openProfileEditor(focusNtrp = false) {
  openAppSheet("profileEditorSheet");
  window.setTimeout(() => {
    const focusTarget = focusNtrp ? $("#profileSelfNtrp") : $("#profileNicknameInput");
    focusTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
    focusTarget?.focus();
  }, 40);
}

function openMembershipDetails(detailsId) {
  const target = $(`#${detailsId}`);
  if (!target) return;
  target.open = true;
  window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function prepareJournalWriteDate(dateValue) {
  openJournalComposer(dateValue);
}

function selectedNextText(log) {
  const step = curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum);
  return step?.title ? `다음: ${step.title}` : "";
}

function openJournalDetail(id) {
  const entry = journalEntries().find((item) => item.id === id);
  if (!entry) return;
  const curriculumBlock = entry.curriculumStep
    ? `
      <section class="journal-curriculum-card">
        <span>다음 수업 커리큘럼</span>
        <strong>${entry.curriculumStep.id} · ${entry.curriculumStep.title}</strong>
        <p>${entry.curriculumStep.focus}</p>
        <a class="small-button notion-link" href="${entry.curriculumStep.notionUrl || "https://www.notion.so/"}" target="_blank" rel="noreferrer">노션에서 자세히 보기</a>
      </section>`
    : "";
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${entry.title}</h2>
      <span>${entry.dateLabel} · ${entry.subtitle}</span>
    </div>
    <article class="journal-detail-card">
      <strong>작성 내용</strong>
      <p>${entry.body}</p>
      ${entry.mediaItems?.length ? `<strong>첨부</strong>${renderMediaPreview(entry.mediaItems)}` : ""}
      <strong>코치 확인</strong>
      <p>${entry.note}</p>
      ${entry.next ? `<strong>다음 내용</strong><p>${entry.next}</p>` : ""}
      ${curriculumBlock}
    </article>`;
  $("#journalDetailModal").hidden = false;
}

function openJournalDay(day) {
  const monthValue = state.activeJournalMonth || new Date().toISOString().slice(0, 7);
  const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
  const entries = journalEntries().filter((item) => item.dateValue === dateValue);
  if (!entries.length) return;
  if (entries.length === 1) {
    openJournalDetail(entries[0].id);
    return;
  }
  $("#journalDetailContent").innerHTML = `
    <div class="section-title compact-title">
      <h2>${day}일 운동 기록</h2>
      <span>하루에 작성한 기록을 모두 확인합니다.</span>
    </div>
    <div class="journal-entry-list">
      ${entries
        .map(
          (entry) => `
            <button class="journal-entry-button" type="button" data-open-journal-detail="${entry.id}">
              <strong>${entry.kind}</strong>
              <span>${entry.title}</span>
              <small>${entry.subtitle}</small>
            </button>`,
        )
        .join("")}
    </div>`;
  $("#journalDetailModal").hidden = false;
}

function closeJournalDetail() {
  $("#journalDetailModal").hidden = true;
}

function setView(viewId) {
  if (!viewId || !$(`#${viewId}`)) return;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  jumpToTop();
  if (viewId === "scheduleView") renderSchedule();
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function memberApprovalStatus() {
  return state.member?.status || state.member?.approvalStatus || "active";
}

function isApprovalPending() {
  return ["inactive", "archived"].includes(memberApprovalStatus());
}

function renderPendingApprovalGate() {
  const pending = isApprovalPending();
  const gate = $("#pendingApprovalGate");
  document.body.classList.toggle("member-pending-approval", pending);
  if (gate) gate.hidden = !pending;
  const message = $("#pendingApprovalMessage");
  if (message && pending) {
    message.textContent = `${state.member?.name || "회원"}님 계정은 현재 이용 확인이 필요합니다. 고객지원으로 문의해 주세요.`;
  }
}

function canUseCoachMode() {
  return state.member?.coachApproved === true && !isApprovalPending();
}

function memberModeOverrideActive() {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (requestedMode === "member") sessionStorage.setItem(appModePreferenceKey, "member");
  return requestedMode === "member" || sessionStorage.getItem(appModePreferenceKey) === "member";
}

function shouldOpenCoachModeByDefault() {
  return canUseCoachMode() && !memberModeOverrideActive();
}

function updateCoachModeAccess() {
  const button = $("#coachModeButton");
  if (!button) return;
  button.hidden = !canUseCoachMode();
}

function openCoachMode() {
  if (!canUseCoachMode()) return;
  coachModeNavigationStarted = true;
  sessionStorage.setItem(appModePreferenceKey, "coach");
  sessionStorage.setItem("tennis-note-coach-mode-entry", "member-profile");
  saveSnapshot();
  const params = new URLSearchParams({ v: "coach-one-day-schedule-1" });
  window.location.href = `../tennis-note-coach-app/index.html?${params.toString()}`;
}

function applyRequestedMemberView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (requestedView && $(`#${requestedView}`)) setView(requestedView);
}

function openKakaoInquiryModal() {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  modal.hidden = false;
  $("#kakaoChannelLink")?.focus();
}

function closeKakaoInquiryModal() {
  const modal = $("#kakaoInquiryModal");
  if (!modal) return;
  modal.hidden = true;
  $("#openKakaoInquiryButton")?.focus();
}

function handleHomeAction(action) {
  const viewMap = {
    "lesson-log": "lessonLogView",
    curriculum: "curriculumView",
    makeup: "scheduleView",
    ticket: "shopView",
    shop: "shopView",
  };
  const viewId = viewMap[action];
  if (!viewId) return;
  setView(viewId);
  if (action === "makeup") {
    renderSchedule();
    requestAnimationFrame(() => $("#scheduleView")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  if (action === "curriculum") {
    renderCurriculum();
    requestAnimationFrame(() => $("#curriculumGuide")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return;
  }
  jumpToTop();
}

function handleSummaryAction(action) {
  if (action === "schedule") {
    setView("scheduleView");
    jumpToTop();
    return;
  }
  if (action === "shop") {
    setView("shopView");
    jumpToTop();
    return;
  }
  if (action === "change" || action === "makeup") {
    setView("scheduleView");
    renderSelects();
    const firstDue = memberMakeupDueLessons()[0];
    if (firstDue && $("#absenceLesson")) $("#absenceLesson").value = firstDue.id;
    renderSelects();
    renderAvailableSlots();
    openChangeRequestModal();
    return;
  }
  if (action === "comments") {
    const latest = state.lessonLogs.find((log) => log.status === "confirmed") || state.lessonLogs[0];
    if (latest) {
      openJournalDetail(latest.id);
      return;
    }
    setView("lessonLogView");
    jumpToTop();
  }
}

function handleScheduleClick(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId);
  if (!lesson) return;
  if (isCurrentMemberName(lesson.member) && lesson.status === "scheduled") {
    $("#absenceLesson").value = lesson.id;
    setView("scheduleView");
    renderAvailableSlots();
    openChangeRequestModal();
    return;
  }
  if (lesson.status === "available") {
    const firstRegular = currentScheduledLessonsForChange()[0];
    if (firstRegular) $("#absenceLesson").value = firstRegular.id;
    renderSelects();
    $("#makeupSlot").value = lesson.id;
    setView("scheduleView");
    renderAvailableSlots();
    openChangeRequestModal();
  }
}

function selectAvailableSlot(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId && item.status === "available");
  if (!lesson) return;
  $("#makeupSlot").value = lesson.id;
  renderAvailableSlots();
  openChangeRequestModal();
}

function changeMemberWeek(delta) {
  state.activeMemberWeekIndex = Math.min(
    Math.max((Number(state.activeMemberWeekIndex) || 0) + delta, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
}

function memberWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const targetDayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + targetDayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
}

function changeMemberMonth(delta) {
  const currentStart = new Date(`${activeMemberWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.activeMemberWeekIndex = Math.min(
    Math.max(memberWeekOffsetForDate(target), memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
  saveSnapshot();
}

function selectMemberMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeMemberWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.activeMemberWeekIndex = Math.min(
    Math.max(memberWeekOffsetForDate(target), memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
  saveSnapshot();
}

function memberScheduleMonthValue(week = activeMemberWeek()) {
  return String(week.startDate || "").slice(0, 7);
}

function changeMemberScheduleTimeRange(range) {
  state.scheduleTimeRange = range || "lesson";
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
  saveSnapshot();
}

function openChangeRequestModal() {
  renderChangeModalSummary();
  $("#changeRequestModal").hidden = false;
}

function closeChangeRequestModal() {
  $("#changeRequestModal").hidden = true;
}

function openChangeHistoryModal() {
  renderRequests();
  $("#changeHistoryModal").hidden = false;
}

function closeChangeHistoryModal() {
  $("#changeHistoryModal").hidden = true;
}

async function saveJournal() {
  const button = $("#saveJournal");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = "서버에 저장 중";
  }
  if (($("#journalMode")?.value || "lesson") === "lesson") {
    let saved = false;
    try {
      saved = await submitLessonLog();
    } finally {
      if (button) button.disabled = false;
      renderJournalMode();
    }
    if (saved) closeAppSheet("journalComposerSheet");
    return;
  }
  savePracticeLog();
  if (button) button.disabled = false;
  renderJournalMode();
  closeAppSheet("journalComposerSheet");
}

function handleProfilePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.profile.photoDataUrl = String(reader.result || "");
    renderProfile();
    saveSnapshot();
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  state.profile.photoDataUrl = "";
  if ($("#profilePhotoInput")) $("#profilePhotoInput").value = "";
  renderProfile();
  saveSnapshot();
}

function normalizeIdentityText(value = "") {
  return String(value || "").trim().replace(/\s+/gu, " ");
}

function normalizeIdentityPhone(value = "") {
  return String(value || "").replace(/\D/gu, "");
}

function formatIdentityPhone(value = "") {
  const digits = normalizeIdentityPhone(value).slice(0, 11);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

function suggestedNicknameFromUser(user = {}) {
  const metadata = user?.user_metadata || {};
  return normalizeIdentityText(
    metadata.nickname
      || metadata.name
      || metadata.full_name
      || metadata.preferred_username
      || "",
  ).slice(0, 20);
}

function identityProfileComplete() {
  const name = normalizeIdentityText(state.profile?.name || "");
  const nickname = normalizeIdentityText(state.profile?.nickname || "");
  const phone = normalizeIdentityPhone(state.profile?.phone || "");
  return Boolean(
    name
      && name !== "가입 확인 중"
      && nickname.length >= 2
      && phone.length >= 10
      && state.profile?.profileCompletedAt
      && state.profile?.privacyConsentVersion === identityPrivacyVersion,
  );
}

function setNicknameStatus(targetId, message, tone = "") {
  const target = $(`#${targetId}`);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-available", tone === "available");
  target.classList.toggle("is-unavailable", tone === "unavailable");
}

function identityErrorMessage(error) {
  const code = String(error?.message || error || "").toLowerCase();
  if (code.includes("nickname_already_taken")) return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (code.includes("nickname_invalid") || code.includes("nickname_length_invalid")) return "닉네임은 공백을 제외하고 2~20자로 입력해 주세요.";
  if (code.includes("real_name_invalid")) return "실명을 확인해 주세요.";
  if (code.includes("phone_invalid")) return "휴대전화 번호를 010부터 정확히 입력해 주세요.";
  if (code.includes("privacy_consent")) return "개인정보 처리방침 동의가 필요합니다.";
  if (code.includes("login_required")) return "로그인 상태를 다시 확인해 주세요.";
  return "정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

async function checkNicknameAvailability(inputId, statusId) {
  const nickname = normalizeIdentityText($(`#${inputId}`)?.value || "");
  if (nickname.length < 2 || nickname.length > 20) {
    setNicknameStatus(statusId, "닉네임은 2~20자로 입력해 주세요.", "unavailable");
    return false;
  }
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) {
    setNicknameStatus(statusId, "실사용 로그인 후 중복을 확인할 수 있습니다.", "unavailable");
    return false;
  }
  setNicknameStatus(statusId, "중복 여부를 확인하고 있습니다.");
  try {
    const rawResult = await client.rpc("tn_check_nickname_available", { target_nickname: nickname });
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (result?.available) {
      setNicknameStatus(statusId, "사용할 수 있는 닉네임입니다.", "available");
      return true;
    }
    setNicknameStatus(statusId, identityErrorMessage(result?.reason || "nickname_already_taken"), "unavailable");
    return false;
  } catch (error) {
    setNicknameStatus(statusId, identityErrorMessage(error), "unavailable");
    return false;
  }
}

function applySavedIdentity(profile = {}) {
  state.profile.name = normalizeIdentityText(profile.name || state.profile.name);
  state.profile.nickname = normalizeIdentityText(profile.nickname || state.profile.nickname);
  state.profile.phone = normalizeIdentityPhone(profile.phone || state.profile.phone);
  state.profile.profileCompletedAt = profile.profile_completed_at || state.profile.profileCompletedAt || new Date().toISOString();
  state.profile.privacyConsentVersion = profile.privacy_consent_version || state.profile.privacyConsentVersion || identityPrivacyVersion;
  state.profile.privacyConsentedAt = profile.privacy_consented_at || state.profile.privacyConsentedAt || new Date().toISOString();
  if (state.member) {
    state.member.name = state.profile.name;
    state.member.nickname = state.profile.nickname;
  }
}

async function persistIdentityProfile({ realName, nickname, phone }) {
  const normalizedRealName = normalizeIdentityText(realName);
  const normalizedNickname = normalizeIdentityText(nickname);
  const normalizedPhone = normalizeIdentityPhone(phone);
  if (!normalizedRealName || normalizedRealName.length > 40) throw new Error("real_name_invalid");
  if (normalizedNickname.length < 2 || normalizedNickname.length > 20) throw new Error("nickname_invalid");
  if (!/^01[0-9]{8,9}$/u.test(normalizedPhone)) throw new Error("phone_invalid");

  const client = window.TennisNoteDataClient;
  if (hasLiveMemberSession() && client?.rpc) {
    const rawResult = await client.rpc("tn_update_my_identity_profile", {
      target_real_name: normalizedRealName,
      target_nickname: normalizedNickname,
      target_phone: normalizedPhone,
      target_privacy_version: identityPrivacyVersion,
    });
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (!result?.ok || !result?.profile) throw new Error("identity_profile_update_not_confirmed");
    applySavedIdentity(result.profile);
    return result.profile;
  }

  const profile = {
    name: normalizedRealName,
    nickname: normalizedNickname,
    phone: normalizedPhone,
    profile_completed_at: new Date().toISOString(),
    privacy_consent_version: identityPrivacyVersion,
    privacy_consented_at: new Date().toISOString(),
  };
  applySavedIdentity(profile);
  return profile;
}

function populateIdentitySetup(user = null) {
  const realName = state.profile.name === "가입 확인 중" ? "" : state.profile.name || "";
  const suggestedNickname = state.profile.nickname || state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  if ($("#identityRealName")) $("#identityRealName").value = realName;
  if ($("#identityNickname")) $("#identityNickname").value = suggestedNickname;
  if ($("#identityPhone")) $("#identityPhone").value = formatIdentityPhone(state.profile.phone || "");
  if ($("#identityPrivacyConsent")) {
    $("#identityPrivacyConsent").checked = state.profile.privacyConsentVersion === identityPrivacyVersion;
  }
  setNicknameStatus("identityNicknameStatus", "닉네임은 모든 회원 사이에서 중복될 수 없습니다.");
  if ($("#identitySetupMessage")) $("#identitySetupMessage").textContent = "";
}

function syncIdentitySetupModal(user = null) {
  const modal = $("#identitySetupModal");
  if (!modal) return;
  if (!hasLiveMemberSession() || identityProfileComplete()) {
    modal.hidden = true;
    document.body.classList.remove("identity-setup-required");
    return;
  }
  state.profile.suggestedNickname = state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  populateIdentitySetup(user);
  modal.hidden = false;
  document.body.classList.add("identity-setup-required");
  window.setTimeout(() => $("#identityRealName")?.focus(), 40);
}

async function submitIdentitySetup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#identitySetupMessage");
  if (!$("#identityPrivacyConsent")?.checked) {
    if (message) message.textContent = "개인정보 처리방침 동의가 필요합니다.";
    return;
  }
  button.disabled = true;
  if (message) message.textContent = "가입 정보를 안전하게 저장하고 있습니다.";
  try {
    await persistIdentityProfile({
      realName: $("#identityRealName")?.value,
      nickname: $("#identityNickname")?.value,
      phone: $("#identityPhone")?.value,
    });
    $("#identitySetupModal").hidden = true;
    document.body.classList.remove("identity-setup-required");
    renderAll();
    saveSnapshot();
    showToast("가입 정보가 저장되었습니다.");
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    if (message) message.textContent = errorMessage;
    setNicknameStatus("identityNicknameStatus", errorMessage, "unavailable");
  } finally {
    button.disabled = false;
  }
}

async function updateMemberProfileOnServer(values = {}) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.updateRows || !profileId) return { skipped: true };
  try {
    const rows = await client.updateRows("tn_users", { id: profileId }, {
      ...values,
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("profile_update_not_confirmed");
    return { ok: true, profile: rows[0] };
  } catch (error) {
    return { ok: false, error };
  }
}

async function saveProfileInfo() {
  try {
    await persistIdentityProfile({
      realName: $("#profileRealNameInput")?.value,
      nickname: $("#profileNicknameInput")?.value,
      phone: $("#profilePhoneInput")?.value,
    });
    setNicknameStatus("profileNicknameStatus", "실명과 닉네임을 확인했습니다.", "available");
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    setNicknameStatus("profileNicknameStatus", errorMessage, "unavailable");
    showToast(errorMessage);
    return;
  }
  state.profile.hand = $("#profileHand")?.value || state.profile.hand;
  state.profile.backhand = $("#profileBackhand")?.value || state.profile.backhand;
  state.profile.startedAt = $("#profileStartedAt")?.value || "";
  state.profile.goal = $("#profileGoal")?.value.trim() || "";
  state.profile.styleMemo = $("#profileStyleMemo")?.value.trim() || "";
  state.profile.selfNtrp = $("#profileSelfNtrp")?.value || state.profile.selfNtrp;
  state.profile.ntrpSurvey = collectNtrpSurvey().answers;
  const serverResult = await updateMemberProfileOnServer({
    profile_photo_url: state.profile.photoDataUrl || null,
    dominant_hand: state.profile.hand || null,
    backhand_style: state.profile.backhand || null,
    tennis_started_on: state.profile.startedAt || null,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
    self_ntrp: Number(state.profile.selfNtrp) || null,
    ntrp_survey: state.profile.ntrpSurvey || {},
  });
  if (serverResult.ok === false) {
    state.ticketHistory.unshift({ text: "내 정보 서버 저장 실패 · 연결 확인 필요", tone: "alert" });
    renderProfile();
    renderTickets();
    saveSnapshot();
    showToast("서버 저장에 실패했습니다. 다시 시도해주세요.");
    return;
  }
  state.ticketHistory.unshift({ text: "내 정보와 테니스 스타일 저장 완료", tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
  closeAppSheet("profileEditorSheet");
}

async function requestNtrpCheck() {
  const survey = collectNtrpSurvey();
  state.profile.ntrpCheckRequested = true;
  state.profile.ntrpSurvey = survey.answers;
  state.profile.selfNtrp = survey.level;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  const requestedAt = new Date().toISOString();
  const serverResult = await updateMemberProfileOnServer({
    self_ntrp: Number(survey.level),
    ntrp_survey: survey.answers,
    ntrp_requested_at: requestedAt,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
  });
  exportNtrpRequest(survey);
  state.ticketHistory.unshift({
    text: serverResult.ok === false ? "NTRP 요청 서버 전송 실패 · 다시 시도 필요" : "코치에게 NTRP 측정 요청 완료",
    tone: serverResult.ok === false ? "alert" : "wait",
  });
  renderProfile();
  renderTickets();
  saveSnapshot();
}

function collectNtrpSurvey() {
  const answers = {};
  const scores = ntrpSurveyQuestions.map((question) => {
    const selected = document.querySelector(`input[name="ntrp-${question.id}"]:checked`);
    const score = Number(selected?.value || 2.5);
    answers[question.id] = score;
    return score;
  });
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const rounded = Math.round(average * 2) / 2;
  return { answers, level: String(Math.max(1.5, Math.min(4, rounded)).toFixed(1)), average };
}

function calculateNtrpFromSurvey() {
  const survey = collectNtrpSurvey();
  state.profile.selfNtrp = survey.level;
  state.profile.ntrpSurvey = survey.answers;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  state.ticketHistory.unshift({ text: `설문 기준 자가 NTRP ${survey.level} 계산 완료`, tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
}

function exportNtrpRequest(survey) {
  const shared = loadSharedData();
  const payload = {
    id: "ntrp-kimseojun",
    member: currentMemberName(),
    selfNtrp: survey.level,
    coachNtrp: state.profile.coachNtrp || "측정 전",
    status: "측정 요청",
    requestedAt: new Date().toISOString(),
    surveyAnswers: survey.answers,
    style: `${state.profile.hand} · ${state.profile.backhand}`,
    goal: state.profile.goal || "",
    memo: state.profile.styleMemo || "",
    references: ntrpReferences,
  };
  const index = shared.ntrpRequests.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.ntrpRequests[index] = { ...shared.ntrpRequests[index], ...payload };
  else shared.ntrpRequests.unshift(payload);
  saveSharedData(shared);
}

function activateLiveMemberProfile(profileId) {
  const nextProfileId = String(profileId || "");

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  state.demoPresentationVersion = 0;
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.coachModeAllowed = false;
  state.remaining = 0;
  state.profile = {
    ...state.profile,
    name: "",
    nickname: "",
    phone: "",
    profileCompletedAt: "",
    privacyConsentVersion: "",
    privacyConsentedAt: "",
    suggestedNickname: "",
    branch: "",
    mainCoach: "",
    ticket: "현재 이용권 없음",
    photoDataUrl: "",
    hand: "",
    backhand: "",
    startedAt: "",
    goal: "",
    styleMemo: "",
    selfNtrp: "",
    coachNtrp: "측정 전",
    ntrpCheckRequested: false,
  };
  state.makeupRequests = [];
  state.lessonLogs = [];
  state.practiceLogs = [];
  state.paymentRequests = [];
  state.expiredTickets = [];
  state.ticketHistory = [];
  state.liveMembershipProducts = [];
  state.liveTickets = [];
  state.liveLessons = [];
  state.liveLessonsLoaded = false;
  state.groupAccount = null;
  state.liveNotifications = [];
  state.accountDeletionRequest = null;
  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  state.pendingPaymentCheckStatus = null;
  state.lastLiveTicketKey = "";
  state.lastLiveNotificationKey = "";
  state.activeJournalMonth = localDateKey().slice(0, 7);
  state.selectedJournalDate = localDateKey();
  lessons.splice(0, lessons.length);
  localStorage.removeItem(sharedStorageKey);
}

function openAppFromSession(showNotice = false) {
  if (!state.member) return;
  $("#loginScreen").hidden = true;
  $("#appScreen").hidden = false;
  document.body.dataset.screen = "app";
  renderPendingApprovalGate();
  updateCoachModeAccess();
  applyRequestedMemberView();
  jumpToTop();
  if (showNotice && !isApprovalPending()) showNoticeAfterLiveSync();
}

async function applySupabaseMemberSession(showNotice = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  client.consumeOAuthRedirect?.();
  const session = await client.ensureSession?.() || client.getSession?.();
  if (!session?.access_token) return false;
  try {
    let current = await client.selectCurrentProfile();
    if (!current?.profile) {
      await client.bootstrapCurrentProfile?.({ providerHint: session.provider || "" });
      current = await client.selectCurrentProfile();
    }
    const { user, profile, coachRole } = current;
    activateLiveMemberProfile(profile?.id);
    const displayName = profile?.name || state.profile?.name || "가입 확인 중";
    state.member = {
      provider: session.provider || "Supabase",
      name: displayName,
      nickname: profile?.nickname || "",
      profileId: profile?.id || "",
      authUserId: user?.id || "",
      role: profile?.role || "member",
      memberKind: profile?.member_kind || "journal_only",
      status: profile?.status || "active",
      birthYear: profile?.birth_year || "",
      neighborhood: profile?.neighborhood || "",
      gender: profile?.gender || "",
      coachApproved: coachRole?.status === "approved",
    };
    state.coachModeAllowed = state.member.coachApproved;
    if (shouldOpenCoachModeByDefault()) {
      openCoachMode();
      return true;
    }
    state.profile.name = profile?.name || "가입 확인 중";
    state.profile.nickname = profile?.nickname || "";
    state.profile.phone = profile?.phone || "";
    state.profile.profileCompletedAt = profile?.profile_completed_at || "";
    state.profile.privacyConsentVersion = profile?.privacy_consent_version || "";
    state.profile.privacyConsentedAt = profile?.privacy_consented_at || "";
    state.profile.suggestedNickname = suggestedNicknameFromUser(user);
    if (profile?.profile_photo_url) state.profile.photoDataUrl = profile.profile_photo_url;
    if (profile?.dominant_hand) state.profile.hand = profile.dominant_hand;
    if (profile?.backhand_style) state.profile.backhand = profile.backhand_style;
    if (profile?.tennis_started_on) state.profile.startedAt = profile.tennis_started_on;
    if (profile?.self_ntrp) state.profile.selfNtrp = String(profile.self_ntrp);
    if (profile?.coach_ntrp) state.profile.coachNtrp = String(profile.coach_ntrp);
    if (profile?.tennis_goal) state.profile.goal = profile.tennis_goal;
    if (profile?.play_style_memo) state.profile.styleMemo = profile.play_style_memo;
    if (profile?.ntrp_survey && typeof profile.ntrp_survey === "object") state.profile.ntrpSurvey = profile.ntrp_survey;
    state.profile.ntrpCheckRequested = Boolean(profile?.ntrp_requested_at && !profile?.coach_ntrp);
    await syncLiveMembershipProductsFromServer();
    await syncMemberEnrollmentFromServer(profile);
    await syncMemberTicketsFromServer(profile);
    await syncMemberLessonsFromServer(profile);
    await syncMemberChangeRequestsFromServer(profile);
    await syncMemberJournalEntriesFromServer(profile);
    await syncMemberHoldingPolicyFromServer();
    await syncMemberHoldingRequestsFromServer(profile);
    await syncMemberAccountDeletionRequestFromServer(profile);
    await syncMemberGroupAccountFromServer(profile);
    await syncMemberNotificationsFromServer(profile);
    await syncNativePushRegistration(profile, false);
    openAppFromSession(showNotice);
    renderAll();
    syncIdentitySetupModal(user);
    saveSnapshot();
    return true;
  } catch (error) {
    return false;
  }
}

async function login(provider) {
  const client = window.TennisNoteDataClient;
  const status = $("#memberEmailLoginStatus");
  if (client?.readiness?.().ready) {
    try {
      if (status) status.textContent = `${provider} 로그인 화면을 여는 중입니다.`;
      client.signInWithOAuth(provider);
      return;
    } catch (error) {
      if (status) status.textContent = `${provider} 로그인을 열지 못했습니다. 잠시 후 다시 시도해주세요.`;
      return;
    }
  }
  if (status) status.textContent = "실사용 로그인 연결 설정을 확인해 주세요.";
}

async function syncAppleLoginAvailability() {
  const buttons = $$('[data-login-provider="Apple"]');
  if (!buttons.length) return;
  let ready = false;
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    try {
      const settings = await client.getAuthSettings();
      ready = Boolean(settings?.external?.apple);
    } catch {
      ready = false;
    }
  }
  buttons.forEach((button) => {
    const label = button.querySelector("[data-apple-login-label]");
    button.disabled = !ready;
    button.classList.toggle("is-preparing", !ready);
    const buttonLabel = ready ? button.dataset.readyLabel : "Apple 로그인 설정 중";
    if (label) label.textContent = buttonLabel;
    button.setAttribute("aria-label", buttonLabel);
  });
}

function emailLoginErrorMessage(error) {
  const code = `${error?.code || error?.message || ""}`.toLowerCase();
  if (code.includes("invalid_credentials") || code.includes("invalid login")) return "이메일 또는 비밀번호를 확인해주세요.";
  if (code.includes("email_not_confirmed")) return "이메일 인증을 먼저 완료해주세요.";
  if (code.includes("credentials_required")) return "이메일과 비밀번호를 입력해주세요.";
  return "로그인을 완료하지 못했습니다. 고객지원으로 문의해주세요.";
}

async function loginWithEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const status = $("#memberEmailLoginStatus");
  submitButton.disabled = true;
  status.textContent = "로그인 확인 중";
  try {
    const client = window.TennisNoteDataClient;
    await client.signInWithPassword($("#memberLoginEmail").value, $("#memberLoginPassword").value);
    const opened = await applySupabaseMemberSession(true);
    if (!opened) throw new Error("profile_bootstrap_failed");
    form.reset();
    status.textContent = "";
  } catch (error) {
    status.textContent = emailLoginErrorMessage(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  await disableNativePushForLogout();
  try {
    await window.TennisNoteDataClient?.signOut?.();
  } catch {
    state.ticketHistory.unshift({ text: "외부 로그인 해제 확인 필요 · 앱에서는 로그아웃 처리", tone: "wait" });
  }
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.liveTickets = [];
  state.liveLessons = [];
  state.liveMakeupEntitlements = [];
  state.liveReleasedMakeupSlots = [];
  state.ticketSyncStatus = { tone: "wait", text: "로그인 후 실제 회원권을 확인합니다" };
  state.lastLiveTicketKey = "";
  sessionStorage.removeItem(appModePreferenceKey);
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  $("#appScreen").hidden = true;
  $("#loginScreen").hidden = false;
  if ($("#identitySetupModal")) $("#identitySetupModal").hidden = true;
  document.body.classList.remove("identity-setup-required");
  delete document.body.dataset.screen;
  document.body.classList.remove("member-pending-approval");
  if ($("#pendingApprovalGate")) $("#pendingApprovalGate").hidden = true;
  updateCoachModeAccess();
  jumpToTop();
  saveSnapshot();
}

async function requestMakeup() {
  const absence = ensureMemberScheduleLesson($("#absenceLesson").value);
  const makeup = ensureMemberScheduleLesson($("#makeupSlot").value);
  if (!absence || !makeup) return;

  const originalDay = absence.day;
  const originalTime = absence.time;
  const originalCoach = absence.coach;
  const isMakeupEntitlement = Boolean(absence.makeupEntitlementId);
  const reason = isMakeupEntitlement ? "불참 처리 후 보강 예약" : $("#changeReason")?.value.trim() || "";
  if (!isMakeupEntitlement && reason.length < 2) {
    showToast("변경 이유를 2자 이상 입력해주세요.");
    $("#changeReason")?.focus();
    return;
  }
  const client = window.TennisNoteDataClient;
  const liveRequest = Boolean(state.member?.profileId && (absence.serverLessonId || absence.makeupEntitlementId) && client?.rpc);
  if (state.dataMode === "live" && !liveRequest) {
    showToast("실제 수업 연결을 다시 확인한 뒤 요청해주세요.");
    return;
  }

  if (liveRequest) {
    const button = $("#requestMakeup");
    if (button) {
      button.disabled = true;
      button.textContent = isMakeupEntitlement ? "예약 중" : "요청 중";
    }
    try {
      const targetDate = makeup.lessonDate || memberScheduleDateForDay(makeup.day);
      if (!targetDate) throw new Error("target_lesson_date_required");
      const result = isMakeupEntitlement
        ? await client.rpc("tn_book_makeup_entitlement", {
            target_entitlement_id: absence.makeupEntitlementId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
          })
        : await client.rpc("tn_submit_lesson_change_request", {
            target_lesson_id: absence.serverLessonId,
            target_lesson_date: targetDate,
            target_start_time: makeup.time,
            target_reason: reason,
          });
      await syncMemberLessonsFromServer();
      if (!isMakeupEntitlement) await syncMemberChangeRequestsFromServer();
      state.ticketHistory.unshift({
        text: isMakeupEntitlement
          ? `${originalDay} ${originalTime} 불참 수업 → ${makeup.day} ${makeup.time} 보강 예약 완료`
          : `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} ${result?.status === "auto_approved" ? "자동 변경 완료" : "코치 승인 요청"}`,
        tone: isMakeupEntitlement || result?.status === "auto_approved" ? "done" : "wait",
      });
      if ($("#changeReason")) $("#changeReason").value = "";
      closeChangeRequestModal();
      renderAll();
      saveSnapshot();
      showToast(isMakeupEntitlement
        ? "보강 예약이 완료되었습니다."
        : result?.status === "auto_approved" ? "수업 시간이 변경되었습니다." : "코치에게 변경 요청을 보냈습니다.");
    } catch (error) {
      let code = error?.payload?.message || error?.payload?.code || error?.message || "server_error";
      if (typeof code === "string" && code.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(code);
          code = parsed.message || parsed.code || code;
        } catch {
          // Keep the original server message when it is not valid JSON.
        }
      }
      const messages = {
        change_reason_required: "변경 이유를 2자 이상 입력해주세요.",
        lesson_already_started: "이미 시작한 수업은 변경할 수 없습니다.",
        target_time_must_be_future: "이미 지난 시간으로는 변경할 수 없습니다.",
        same_lesson_time: "현재 수업과 다른 시간을 선택해주세요.",
        no_nearby_coach_lesson: "담당 코치의 기존 수업과 40분 이내인 시간만 신청할 수 있습니다.",
        target_time_occupied: "방금 다른 수업이 배정된 시간입니다. 다른 시간을 선택해주세요.",
        target_time_blocked: "브레이크 또는 운영 중지 시간입니다.",
        coach_not_working: "담당 코치의 근무시간이 아닙니다.",
        schedule_scope_mismatch: "평일권은 평일, 주말권은 주말 시간만 변경할 수 있습니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과합니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과합니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과합니다.",
        target_date_outside_ticket: "회원권 사용기간 밖의 날짜입니다.",
        makeup_entitlement_not_found: "보강 대상 수업을 찾을 수 없습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_entitlement_not_open: "이미 예약되었거나 종료된 보강입니다.",
        makeup_source_lesson_invalid: "원래 수업 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
        makeup_booking_forbidden: "이 보강을 예약할 권한이 없습니다.",
        active_ticket_required: "사용 가능한 회원권 횟수를 확인해 주세요.",
      };
      showToast(messages[code] || `${isMakeupEntitlement ? "보강 예약" : "수업 변경 요청"} 실패: ${code}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = isMakeupEntitlement ? "보강 예약 확정" : "수업 변경 요청";
      }
    }
    return;
  }

  absence.status = "available";
  absence.member = "";
  absence.type = "수업 변경 가능";
  absence.policy = "auto";
  makeup.status = "requested";
  makeup.member = currentMemberName();
  const needsApproval = makeup.policy === "coach";
  const request = {
    id: `makeup-${Date.now()}`,
    absence: `${originalDay} ${originalTime} 기존 수업`,
    makeup: `${makeup.day} ${makeup.time} 수업 변경 희망 · ${makeup.coach}`,
    reason,
    policy: policyDetail(makeup.policy),
    status: needsApproval ? "코치 승인 대기 · 당일 취소 차감" : "자동 변경 완료",
  };
  state.makeupRequests.unshift(request);
  pushMakeupRequestToShared(request);
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} → ${makeup.day} ${makeup.time} 수업 변경 요청 접수`, tone: "wait" });
  state.ticketHistory.unshift({ text: `${originalDay} ${originalTime} ${originalCoach} 시간 비움 · 다른 회원 수업변경 신청 가능`, tone: "done" });
  if ($("#changeReason")) $("#changeReason").value = "";
  closeChangeRequestModal();
  renderAll();
}

async function submitLessonLog() {
  const lesson = memberScheduleLessons().find((item) => item.id === $("#logLesson").value);
  if (!lesson) return false;

  const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
  const mediaInput = $("#lessonMedia");
  const files = [...(mediaInput?.files || [])];
  const mediaItems = mediaItemsFromInput(mediaInput);
  const mediaNames = mediaItems.map((file) => file.name);
  const journalDate = $("#journalDate")?.value || localDateKey();
  const hasLiveSession = Boolean(state.member?.profileId && window.TennisNoteDataClient?.getSession?.()?.access_token);
  const log = {
    id: `member-log-${Date.now()}`,
    lessonId: lesson.id,
    lessonLabel: `${lesson.day} ${lesson.time} · ${lesson.coach}`,
    round: lessonRound(),
    journalDate,
    content: $("#todayLessonContent").value.trim() || "수업 내용 미입력",
    selfMemo: $("#selfWorkoutMemo").value.trim() || "자기 운동 일지 미입력",
    mediaNames,
    mediaItems,
    status: hasLiveSession ? "uploading" : "coach_pending",
    curriculum,
    nextCurriculumId: curriculum.id,
    coachComment: "",
    memberVisibleSummary: "",
    ticketDeducted: false,
    submittedAt: new Date().toISOString(),
  };
  state.lessonLogs.unshift(log);
  state.selectedJournalDate = journalDate;
  state.activeJournalMonth = journalDate.slice(0, 7);
  renderAll();

  if (hasLiveSession) {
    try {
      await persistLessonJournalToServer(log, files);
      log.status = "coach_pending";
      state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 운동일지 · 서버 저장 완료`, tone: "done" });
    } catch {
      log.status = "server_error";
      state.ticketHistory.unshift({ text: "운동일지 서버 저장 실패 · 네트워크와 저장공간을 확인해 주세요.", tone: "alert" });
      renderAll();
      return false;
    }
  }

  pushLessonLogToShared(log);
  state.ticketHistory.unshift({ text: `${dayName(lesson.day)} ${lessonRound()}회차 수업기록 제출 · 코멘트/커리큘럼 작성 대기`, tone: "wait" });
  if (mediaInput) mediaInput.value = "";
  renderAll();
  return true;
}

function confirmLatestLesson() {
  let pendingLog = state.lessonLogs.find((log) => log.status === "coach_pending");
  if (!pendingLog) {
    const fallbackLesson = memberScheduleLessons().find((item) => isCurrentMemberName(item.member) && item.status === "scheduled");
    if (!fallbackLesson || state.remaining <= 0) return;
    const curriculum = curriculumSteps[state.lessonLogs.length % curriculumSteps.length];
    pendingLog = {
      id: `coach-only-${Date.now()}`,
      lessonId: fallbackLesson.id,
      lessonLabel: `${fallbackLesson.day} ${fallbackLesson.time} · ${fallbackLesson.coach}`,
      round: lessonRound(),
      content: "회원 운동일지 미작성 · 코치 코멘트와 다음 커리큘럼으로 출석 확인",
      selfMemo: "회원에게는 운동일지 작성 안내만 표시하고, 미작성 상태여도 코치 코멘트와 다음 커리큘럼 등록으로 횟수 체크합니다.",
      status: "coach_pending",
      curriculum,
      nextCurriculumId: curriculum.id,
      coachComment: "출석 확인 완료. 회원 운동일지 미작성 상태지만 코치 코멘트로 수업을 확인했습니다.",
      memberVisibleSummary: curriculum.next,
      ticketDeducted: false,
      submittedAt: new Date().toISOString(),
    };
    state.lessonLogs.unshift(pendingLog);
  }
  if (state.remaining <= 0) return;

  const lesson = ensureMemberScheduleLesson(pendingLog.lessonId);
  pendingLog.status = "confirmed";
  if (lesson) lesson.status = "completed";
  state.remaining -= 1;
  state.ticketHistory.unshift({
    text: `${lessonReviewTitle(pendingLog)} · 1회 차감`,
    tone: "done",
  });
  if (state.remaining === 2) {
    state.ticketHistory.unshift({ text: "잔여횟수 2회 · 재등록 안내 및 결제 요청 필요", tone: "alert" });
  }
  renderAll();
}

function bindEvents() {
  $$("[data-login-provider]").forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.loginProvider));
  });
  $("#memberEmailLoginForm")?.addEventListener("submit", loginWithEmail);
  $$("[data-install-pwa]").forEach((button) => {
    button.addEventListener("click", promptPwaInstall);
  });
  $("#logoutButton")?.addEventListener("click", logout);
  $("#profileLogoutButton")?.addEventListener("click", logout);
  $("#pendingLogoutButton")?.addEventListener("click", logout);
  $("#coachModeButton")?.addEventListener("click", openCoachMode);
  $("#openKakaoInquiryButton")?.addEventListener("click", openKakaoInquiryModal);
  $("#kakaoInquiryModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-kakao-inquiry-modal]")) closeKakaoInquiryModal();
  });
  $$(".tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#homeAccountSummary")?.addEventListener("click", () => setView("profileView"));
  $$("[data-summary-action]").forEach((button) => {
    button.addEventListener("click", () => handleSummaryAction(button.dataset.summaryAction));
  });
  $("#requestMakeup").addEventListener("click", requestMakeup);
  $("#saveJournal").addEventListener("click", saveJournal);
  $("#journalMode").addEventListener("change", renderJournalMode);
  $("#openJournalComposer")?.addEventListener("click", () => openJournalComposer());
  $("#journalComposerSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-journal-composer]")) closeAppSheet("journalComposerSheet");
  });
  $("#journalPrevMonth")?.addEventListener("click", () => changeJournalMonth(-1));
  $("#journalNextMonth")?.addEventListener("click", () => changeJournalMonth(1));
  $("#journalSearch")?.addEventListener("input", (event) => {
    state.journalSearchQuery = event.target.value;
    renderJournalCalendar();
    saveSnapshot();
  });
  $("#journalJumpDate")?.addEventListener("change", (event) => selectJournalDate(event.target.value));
  $("#journalCalendar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-journal-date]");
    if (button) selectJournalDate(button.dataset.selectJournalDate);
  });
  $("#journalSelectedDayPanel")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-journal-write-date]");
    if (button) prepareJournalWriteDate(button.dataset.journalWriteDate);
  });
  $("#profilePhotoInput")?.addEventListener("change", handleProfilePhotoChange);
  $("#removeProfilePhoto")?.addEventListener("click", removeProfilePhoto);
  $("#saveProfileInfo")?.addEventListener("click", saveProfileInfo);
  $("#profileNicknameCheckButton")?.addEventListener("click", () => checkNicknameAvailability("profileNicknameInput", "profileNicknameStatus"));
  $("#profileNicknameInput")?.addEventListener("input", () => setNicknameStatus("profileNicknameStatus", "저장할 때 중복 여부를 다시 확인합니다."));
  $("#profilePhoneInput")?.addEventListener("input", (event) => {
    event.target.value = formatIdentityPhone(event.target.value);
  });
  $("#identitySetupForm")?.addEventListener("submit", submitIdentitySetup);
  $("#identityNicknameCheckButton")?.addEventListener("click", () => checkNicknameAvailability("identityNickname", "identityNicknameStatus"));
  $("#identityNickname")?.addEventListener("input", () => setNicknameStatus("identityNicknameStatus", "저장할 때 중복 여부를 다시 확인합니다."));
  $("#identityPhone")?.addEventListener("input", (event) => {
    event.target.value = formatIdentityPhone(event.target.value);
  });
  $("#identitySetupLogoutButton")?.addEventListener("click", logout);
  $("#openProfileEditorButton")?.addEventListener("click", () => openProfileEditor());
  $("#openProfileEditorMenuButton")?.addEventListener("click", () => openProfileEditor());
  $("#openNtrpEditorButton")?.addEventListener("click", () => openProfileEditor(true));
  $("#profileEditorSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-profile-editor]")) closeAppSheet("profileEditorSheet");
  });
  $("#pushNotificationButton")?.addEventListener("click", async () => {
    try {
      await syncNativePushRegistration(null, true);
    } catch {
      setPushNotificationState("unknown", "알림 연결 실패", "네트워크와 앱 설정을 확인한 뒤 다시 시도해 주세요.");
    }
  });
  $("#openAccountDeletionButton")?.addEventListener("click", async () => {
    if (state.accountDeletionRequest?.status === "pending") await cancelAccountDeletionRequest();
    else openAccountDeletionModal();
  });
  $("#accountDeletionModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-account-deletion-modal]")) closeAccountDeletionModal();
  });
  $("#accountDeletionForm")?.addEventListener("submit", submitAccountDeletionRequest);
  $("#requestNtrpCheck")?.addEventListener("click", requestNtrpCheck);
  $("#calculateNtrp")?.addEventListener("click", calculateNtrpFromSurvey);
  $("#ntrpReferenceCards")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-ntrp-reference]");
    if (button) openNtrpReference(button.dataset.openNtrpReference);
  });
  $("#makeupSlot").addEventListener("change", renderAvailableSlots);
  $("#absenceLesson").addEventListener("change", () => {
    renderSelects();
    renderAvailableSlots();
    renderChangeModalSummary();
  });
  $("#confirmLatestLesson")?.addEventListener("click", confirmLatestLesson);
  $("#noticeClose").addEventListener("click", () => closeNotice(false));
  $("#noticeHideToday").addEventListener("click", () => closeNotice(true));
  $("#noticeAction")?.addEventListener("click", (event) => {
    const route = event.currentTarget?.dataset?.route || "";
    if (route === "schedule") {
      event.preventDefault();
      closeNotice(false);
      setView("scheduleView");
      jumpToTop();
      return;
    }
    closeNotice(false);
  });
  $("#scheduleGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lesson]");
    if (button) handleScheduleClick(button.dataset.lesson);
  });
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#scheduleGrid [data-lesson]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      handleScheduleClick(button.dataset.lesson);
    },
    true,
  );
  $("#memberWeekSwitcher")?.addEventListener("click", (event) => {
    const monthButton = event.target.closest("[data-change-member-month]");
    if (monthButton) {
      changeMemberMonth(Number(monthButton.dataset.changeMemberMonth));
      return;
    }
    const button = event.target.closest("[data-change-member-week]");
    if (button) changeMemberWeek(Number(button.dataset.changeMemberWeek));
  });
  $("#memberWeekSwitcher")?.addEventListener("change", (event) => {
    if (event.target.matches("[data-member-month]")) selectMemberMonth(event.target.value);
  });
  $("#scheduleGrid")?.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-member-schedule-day]");
    if (dayButton) {
      state.selectedScheduleDay = dayButton.dataset.memberScheduleDay;
      renderSchedule();
      saveSnapshot();
      return;
    }
    const button = event.target.closest("[data-member-schedule-time-range]");
    if (button) changeMemberScheduleTimeRange(button.dataset.memberScheduleTimeRange);
  });
  $("#availableSlotList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-slot]");
    if (button) selectAvailableSlot(button.dataset.selectSlot);
  });
  $("#changeRequestModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-change-modal]")) closeChangeRequestModal();
  });
  $("#holdingRequestModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-holding-modal]")) closeHoldingRequestModal();
  });
  $("#holdingRequestType")?.addEventListener("change", updateHoldingEvidenceFields);
  $("#holdingRequestForm")?.addEventListener("submit", submitHoldingRequest);
  $("#memberEnrollmentForm")?.addEventListener("submit", submitMemberEnrollment);
  $("#memberEnrollmentModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-member-enrollment]")) closeMemberEnrollmentModal();
  });
  $("#changeHistoryModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-history-modal]")) closeChangeHistoryModal();
  });
  $("#journalDetailModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-journal-modal]")) closeJournalDetail();
  });
  $("#ntrpReferenceModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-ntrp-modal]")) closeNtrpReference();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#noticeDialog")?.hidden) {
      event.preventDefault();
      closeNotice(false);
      return;
    }
    if (event.key === "Escape" && activeAppSheetId) {
      event.preventDefault();
      closeVisibleAppSheet();
      return;
    }
    if (event.key === "Escape" && !$("#kakaoInquiryModal")?.hidden) closeKakaoInquiryModal();
    if (event.key === "Escape" && !$("#memberEnrollmentModal")?.hidden) closeMemberEnrollmentModal();
  });
  window.addEventListener("popstate", () => closeVisibleAppSheet(true));
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }
    const groupModeButton = event.target.closest("[data-member-group-mode]");
    if (groupModeButton) {
      setMemberGroupPaymentMode(groupModeButton.dataset.memberGroupMode);
      return;
    }
    const groupLinkButton = event.target.closest("[data-member-group-link]");
    if (groupLinkButton) {
      linkMemberGroupPartner();
      return;
    }
    const paymentMethodButton = event.target.closest("[data-select-payment-method]");
    if (paymentMethodButton) {
      selectPaymentMethod(paymentMethodButton.dataset.selectPaymentMethod);
      return;
    }
    const productButton = event.target.closest("[data-buy-product]");
    if (productButton) {
      event.preventDefault();
      startProductPayment(productButton.dataset.buyProduct);
      return;
    }
    const pageButton = event.target.closest("[data-page-list]");
    if (pageButton) {
      changePagedList(pageButton.dataset.pageList, Number(pageButton.dataset.pageIndex));
      return;
    }
    const detailButton = event.target.closest("[data-open-journal-detail]");
    if (detailButton) {
      openJournalDetail(detailButton.dataset.openJournalDetail);
      return;
    }
    const dayButton = event.target.closest("[data-open-journal-day]");
    if (dayButton) {
      openJournalDay(dayButton.dataset.openJournalDay);
      return;
    }
    const curriculumFilterButton = event.target.closest("[data-member-curriculum-filter]");
    if (curriculumFilterButton) {
      state.curriculumFilter = curriculumFilterButton.dataset.memberCurriculumFilter;
      renderCurriculum();
      saveSnapshot();
      return;
    }
    const curriculumButton = event.target.closest("[data-open-curriculum-view]");
    if (curriculumButton) setView("curriculumView");
  });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "memberCurriculumSearch") return;
    state.curriculumQuery = event.target.value;
    renderMemberCurriculumLibrary();
    saveSnapshot();
  });
  $("#openChangeHistory")?.addEventListener("click", openChangeHistoryModal);
  $("#currentTicketPanel")?.addEventListener("click", (event) => {
    const membershipPurchaseButton = event.target.closest("[data-open-membership-products]");
    if (membershipPurchaseButton) {
      openMembershipDetails("membershipPurchaseDetails");
      return;
    }
    const membershipHistoryButton = event.target.closest("[data-open-membership-history]");
    if (membershipHistoryButton) {
      openMembershipDetails("membershipHistoryDetails");
      return;
    }
    const holdingButton = event.target.closest("[data-open-holding-request]");
    if (holdingButton) {
      openHoldingRequestModal();
      return;
    }
    const resumeButton = event.target.closest("[data-resume-pending-ticket]");
    if (resumeButton) {
      resumePendingTicketPayment(resumeButton.dataset.resumePendingTicket);
      return;
    }
    const button = event.target.closest("[data-check-pending-ticket]");
    if (button) checkPendingTicketPayment(button.dataset.checkPendingTicket);
  });
  $("#todayActionCards")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-action]");
    if (button) handleHomeAction(button.dataset.homeAction);
  });
}

function changePagedList(type, pageIndex) {
  if (type === "lesson") {
    state.lessonLogPage = pageIndex;
    normalizePage("lesson", state.lessonLogs.length);
    renderLessonLogs();
  }
  if (type === "ticket") {
    state.ticketHistoryPage = pageIndex;
    normalizePage("ticket", state.lessonLogs.length);
    renderTickets();
  }
  if (type === "expired") {
    state.expiredTicketPage = pageIndex;
    normalizePage("expired", membershipPassRecords().length);
    renderProducts();
  }
  if (type === "practice") {
    state.practiceLogPage = pageIndex;
    normalizePage("practice", state.practiceLogs.length);
    renderPracticeLogs();
  }
  saveSnapshot();
}

function renderAll() {
  renderProfile();
  renderTodayActions();
  renderSchedule();
  renderSelects();
  renderMakeupDueBanner();
  renderJournalMode();
  renderAvailableSlots();
  renderRequests();
  renderLessonLogs();
  renderCurriculum();
    renderTickets();
  renderPracticeLogs();
  renderJournalCalendar();
  renderProducts();
  renderPendingApprovalGate();
  saveSnapshot();
}

let memberLiveScheduleRefreshTimer = 0;
let memberLiveScheduleRefreshInFlight = false;

async function refreshMemberLiveSchedule(options = {}) {
  const client = window.TennisNoteDataClient;
  if (
    memberLiveScheduleRefreshInFlight
    || document.hidden
    || state.dataMode !== "live"
    || !state.member?.profileId
    || !client?.readiness?.().ready
    || !client?.getSession?.()?.access_token
  ) return false;

  memberLiveScheduleRefreshInFlight = true;
  try {
    await syncMemberTicketsFromServer();
    const [lessonsSynced, requestsSynced, notificationResult] = await Promise.all([
      syncMemberLessonsFromServer(),
      syncMemberChangeRequestsFromServer(),
      syncMemberNotificationsFromServer(),
    ]);
    if (options.render !== false) renderAll();
    if (notificationResult?.newNotification) {
      showToast(`${notificationResult.newNotification.title} · 시간표에서 확인해 주세요.`);
    }
    return Boolean(lessonsSynced || requestsSynced || notificationResult?.ok);
  } finally {
    memberLiveScheduleRefreshInFlight = false;
  }
}

function installMemberLiveScheduleRefresh() {
  if (memberLiveScheduleRefreshTimer) return;
  const refresh = () => refreshMemberLiveSchedule().catch(() => false);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  memberLiveScheduleRefreshTimer = window.setInterval(refresh, 15_000);
}

async function initApp() {
  registerPwaServiceWorker();
  registerPwaInstallPrompt();
  purgeLegacyDemoStorage();
  restoreSnapshot();
  await syncLiveSchedulePolicy();
  bindEvents();
  installMemberLiveScheduleRefresh();
  renderAll();
  await syncAppleLoginAvailability();
  const openedFromSupabase = await applySupabaseMemberSession(true);
  if (coachModeNavigationStarted) return;
  await handlePaymentRedirectResult();
  if (!openedFromSupabase && state.member) {
    const client = window.TennisNoteDataClient;
    const needsRealSession = client?.readiness?.().ready;
    const hasRealSession = Boolean(client?.getSession?.()?.access_token);
    if (needsRealSession && !hasRealSession) {
      state.member = null;
      state.coachModeAllowed = false;
      updateCoachModeAccess();
      saveSnapshot();
      return;
    }
    markTicketSyncLoginNeeded();
    openAppFromSession(true);
    renderAll();
  }
}

initApp().finally(hideBrandSplash);
