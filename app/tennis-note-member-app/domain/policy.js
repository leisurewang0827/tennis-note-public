// 운영 정책·홀딩·쿠폰 기간을 판정하는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

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

function writeLiveSchedulePolicySnapshot(value = {}, branchId = "") {
  if (!value || typeof value !== "object") return false;
  const existing = readAdminSnapshot() || {};
  const resolved = resolveLiveSchedulePolicyForBranch(value, branchId);
  const scheduleSettings = resolved.scheduleSettings;
  const coaches = resolved.coaches;
  if (!scheduleSettings.openStart && !scheduleSettings.openEnd && !coaches.length) return false;
  safeLocalStorageSet(adminStorageKey, JSON.stringify({
    ...existing,
    scheduleSettings: {
      ...(existing.scheduleSettings || {}),
      ...scheduleSettings,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : existing.scheduleSettings?.breakRules || [],
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
      memberScheduleRequestOnly: scheduleSettings.memberScheduleRequestOnly !== false,
    },
    coaches,
    operationPolicyBranchId: resolved.branchId || "",
  }));
  return true;
}

function memberCouponPeriodInfo(source = {}) {
  if (!source?.couponBooking) return null;
  const expectedDays = Math.max(0, Number(source.productValidityDays) || 0)
    + Math.max(0, Number(source.productGraceDays) || 0);
  const actualDays = memberInclusiveDateDays(source.startsOn, source.expiresOn);
  return {
    startsOn: source.startsOn || "",
    expiresOn: source.expiresOn || "",
    expectedDays,
    actualDays,
    isShorterThanProduct: Boolean(expectedDays && actualDays && actualDays < expectedDays),
  };
}

function memberCouponPeriodSummary(source = {}) {
  const period = memberCouponPeriodInfo(source);
  if (!period?.startsOn || !period.expiresOn) return "";
  const range = `${memberReadableDate(period.startsOn)}~${memberReadableDate(period.expiresOn)}`;
  if (!period.isShorterThanProduct) return `예약 가능 기간 ${range}`;
  return `예약 가능 기간 ${range} · 상품 기본 ${period.expectedDays}일보다 짧게 등록됨`;
}

function policyLabel(policy) {
  return policy === "coach" ? "24h 이내" : "24h 이전";
}

function policyShortLabel(policy) {
  return policy === "coach" ? "24h내" : "24h전";
}

function policyDetail(policy) {
  return policy === "coach"
    ? "담당 코치 또는 관리자가 확인합니다. 승인 전까지 원래 수업은 그대로 유지되며, 거절돼도 차감되지 않습니다."
    : "수업까지 24시간 이상 남아 선택한 시간으로 바로 변경됩니다.";
}

function holdingStatusLabel(status) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "cancelled") return "취소";
  return "검토중";
}

function holdingRequestDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function safeHoldingFileName(fileName = "evidence") {
  const extension = `${fileName}`.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `evidence.${extension}`;
}
