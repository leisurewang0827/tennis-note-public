// 할인권 보유·사용 정보는 서버 조회 결과만 표시하며 브라우저 저장소에 남기지 않습니다.
const adminDiscountLedger = { branchId: "", status: "idle", issues: [], redemptions: [], request: 0 };

async function loadAdminDiscountLedger() {
  const branchId = activeOperationBranchId();
  const client = window.TennisNoteDataClient;
  const request = ++adminDiscountLedger.request;
  Object.assign(adminDiscountLedger, { branchId, status: "loading", issues: [], redemptions: [] });
  if (!branchId || !client?.selectRows || !adminApprovalReady()) {
    adminDiscountLedger.status = "error";
    return false;
  }
  async function pages(table, select, order) {
    const rows = [];
    for (let offset = 0; offset < 100000; offset += 500) {
      const page = await client.selectRows(table, { select, filters: { branch_id: branchId }, order, limit: 500, offset });
      if (!Array.isArray(page)) throw new Error("discount_ledger_response_invalid");
      rows.push(...page);
      if (page.length < 500) return rows;
    }
    throw new Error("discount_ledger_page_limit");
  }
  try {
    const [issues, redemptions] = await Promise.all([
      pages("tn_discount_issues", "id,policy_id,issued_to_user_id,status,issued_at,expires_at,used_at,member:tn_users!issued_to_user_id(name),policy:tn_discount_policies(name,discount_type,discount_value)", "issued_at.desc,id.desc"),
      pages("tn_discount_redemptions", "id,issue_id,member_user_id,discount_amount,status,created_at,member:tn_users!member_user_id(name),policy:tn_discount_policies(name,discount_type,discount_value)", "created_at.desc,id.desc"),
    ]);
    if (request !== adminDiscountLedger.request || branchId !== activeOperationBranchId() || !adminApprovalReady()) return false;
    Object.assign(adminDiscountLedger, { status: "ready", issues, redemptions });
  } catch {
    if (request !== adminDiscountLedger.request) return false;
    Object.assign(adminDiscountLedger, { status: "error", issues: [], redemptions: [] });
  }
  if (state.view === "members") renderMembers();
  if (state.view === "settings" && state.settingsTab === "membership") renderServiceReadiness();
  return adminDiscountLedger.status === "ready";
}

function adminDiscountLedgerReady() {
  return adminApprovalReady() && adminDiscountLedger.branchId === activeOperationBranchId() && adminDiscountLedger.status === "ready";
}

function adminDiscountIssueStatus(issue) {
  if (["issued", "reserved"].includes(issue.status) && issue.expires_at && Date.parse(issue.expires_at) <= Date.now()) return "만료";
  return ({ issued: "미사용", reserved: "결제 진행 중", used: "사용 완료", expired: "만료", cancelled: "취소" })[issue.status] || "확인 필요";
}

function adminDiscountPolicyLabel(policy) {
  if (!policy) return "할인권 정보 없음";
  return `${policy.name || "할인권"} · ${Number(policy.discount_value || 0).toLocaleString("ko-KR")}${policy.discount_type === "amount" ? "원" : "%"}`;
}

function adminDiscountDate(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기한 없음";
}

function adminMemberDiscountMarkup(member, detail = false) {
  if (!adminDiscountLedgerReady()) return `<small class="member-grid-review-reason">${adminDiscountLedger.status === "error" ? "할인권 조회 실패 · 화면 재진입 필요" : "할인권 확인 중"}</small>`;
  const rows = adminDiscountLedger.issues.filter((issue) => issue.issued_to_user_id === member.serverUserId
    && ["미사용", "결제 진행 중"].includes(adminDiscountIssueStatus(issue)));
  if (!detail) return rows.length ? `<small class="member-grid-review-reason">할인권 ${rows.length}장 · ${escapeHtml(rows.map((issue) => adminDiscountPolicyLabel(issue.policy)).join(" / "))}</small>` : "";
  return `<section class="member-db-section"><h3>보유 할인쿠폰 ${rows.length}장</h3>${rows.length ? rows.map((issue) => `<p><strong>${escapeHtml(adminDiscountPolicyLabel(issue.policy))}</strong><br><small>${escapeHtml(adminDiscountIssueStatus(issue))} · 사용기한 ${escapeHtml(adminDiscountDate(issue.expires_at))}</small></p>`).join("") : '<p>현재 보유한 할인쿠폰이 없습니다.</p>'}</section>`;
}

function adminDiscountHistoryMarkup(search = "") {
  if (!adminDiscountLedgerReady()) return `<p class="empty-text">${adminDiscountLedger.status === "error" ? "할인권 내역을 불러오지 못했습니다. 화면을 다시 열어 확인해 주세요." : "서버에서 할인권 내역을 확인하고 있습니다."}</p>`;
  const usedIds = new Set(adminDiscountLedger.redemptions.filter((r) => r.status === "applied").map((r) => r.issue_id));
  const events = adminDiscountLedger.issues.flatMap((issue) => {
    const name = issue.member?.name || (issue.issued_to_user_id ? "회원 정보 없음" : "코치 지급분"), label = adminDiscountPolicyLabel(issue.policy);
    const entries = [{ id: `issued:${issue.id}`, at: issue.issued_at, text: `${name} · ${label} · 발급 · 현재 ${adminDiscountIssueStatus(issue)} · 사용기한 ${adminDiscountDate(issue.expires_at)}` }];
    if (issue.used_at && !usedIds.has(issue.id)) entries.push({ id: `used:${issue.id}`, at: issue.used_at, text: `${name} · ${label} · 사용 기록` });
    return entries;
  }).concat(adminDiscountLedger.redemptions.map((r) => ({ id: `redemption:${r.id}`, at: r.created_at, text: `${r.member?.name || "회원 정보 없음"} · ${adminDiscountPolicyLabel(r.policy)} · ${r.status === "voided" ? "사용 취소" : "사용"} · ${Number(r.discount_amount || 0).toLocaleString("ko-KR")}원 할인` })));
  const visible = events.filter((e) => `${e.text} ${adminDiscountDate(e.at)}`.toLowerCase().includes(String(search).trim().toLowerCase())).sort((a,b) => String(b.at).localeCompare(String(a.at)) || a.id.localeCompare(b.id));
  return `<article class="discount-policy-card discount-history-card"><div><strong>발급·사용 내역</strong><span class="status-badge ready">${visible.length}건</span></div><div class="discount-history-list">${visible.length ? visible.map((e) => `<div><time>${escapeHtml(adminDiscountDate(e.at))}</time><span>${escapeHtml(e.text)}</span></div>`).join("") : '<p class="empty-text">검색 조건에 맞는 발급·사용 내역이 없습니다.</p>'}</div></article>`;
}
