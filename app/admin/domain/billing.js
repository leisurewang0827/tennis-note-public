// 결제·정산 값 계산. 순수 함수만 둔다.
// app.js 에서 본문 그대로 옮겨왔다. adminLocalDateKey 는 values.js 에 있다.

function billingEffectiveDate(item = {}) {
  const candidates = [
    item.paidAt,
    item.paid_at,
    item.verifiedAt,
    item.verified_at,
    item.requestedAt,
    item.requested_at,
    item.createdAt,
    item.created_at,
  ];
  for (const value of candidates) {
    const text = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return adminLocalDateKey(new Date(parsed));
  }
  return "";
}

function billingMatchesMonth(item, month) {
  if (!month) return true;
  return billingEffectiveDate(item).slice(0, 7) === month;
}
