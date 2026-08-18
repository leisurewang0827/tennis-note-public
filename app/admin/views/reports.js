// 리포트 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderReports() {
  const metricTarget = $("#reportMetrics");
  const memberTarget = $("#managementMemberReport");
  const qualityTarget = $("#managementQualityReport");
  const financeTarget = $("#managementFinanceReport");
  const sourceTarget = $("#managementSourcePlan");
  if (!metricTarget || !memberTarget || !qualityTarget || !financeTarget || !sourceTarget) return;

  state.managementReportMonth = /^\d{4}-\d{2}$/.test(state.managementReportMonth)
    ? state.managementReportMonth
    : adminLocalDateKey(new Date()).slice(0, 7);
  const month = state.managementReportMonth;
  const monthLabel = managementReportMonthLabel(month);
  const monthInput = $("#managementReportMonth");
  if (monthInput) monthInput.value = month;
  if ($("#managementReportPeriodLabel")) $("#managementReportPeriodLabel").textContent = `${monthLabel} 요약`;
  const driveStatusInfo = managementDriveReportStatusInfo();
  const driveStatusTarget = $("#managementFinanceSourceStatus");
  if (driveStatusTarget) {
    driveStatusTarget.textContent = driveStatusInfo.label;
    driveStatusTarget.className = `source-pill ${driveStatusInfo.pillTone}`.trim();
  }
  const driveRefreshButton = $("#refreshDriveReportButton");
  if (driveRefreshButton) {
    driveRefreshButton.disabled = adminDriveReportState.loading;
    driveRefreshButton.textContent = adminDriveReportState.loading ? "확인 중" : "Drive 확인";
  }

  const branchMembers = operationBranchMembers();
  const branchTickets = operationBranchTickets();
  const branchBillings = operationBranchBillings();
  const branchLessons = operationBranchLessons();
  const monthBillings = branchBillings.filter((item) => (
    billingMatchesMonth(item, month) || (adminDemoMode && !billingEffectiveDate(item))
  ));
  const paidBillings = monthBillings.filter((item) => item.status === "paid");
  const paidAmount = paidBillings.reduce((sum, item) => sum + Number(item.finalAmount || item.amount || 0), 0);
  const refundedAmount = monthBillings.reduce((sum, item) => (
    sum + Number(item.refundedAmount || (item.status === "cancelled" ? item.finalAmount || item.amount : 0) || 0)
  ), 0);
  const monthLessons = branchLessons.filter((lesson) => String(lesson.lessonDate || "").startsWith(month));
  const completedLessons = monthLessons.filter((lesson) => lessonStatusValue(lesson) === "completed");
  const noShowLessons = monthLessons.filter((lesson) => lessonStatusValue(lesson) === "no_show");
  const activeMembers = branchMembers.filter((member) => member.status === "active");
  const activeTickets = branchTickets.filter((ticket) => managementReportTicketIsActive(ticket));
  const lowTickets = activeTickets.filter((ticket) => Number(ticket.remaining) <= 2);
  const recordGroups = adminRecordGroups();
  const recordDone = recordGroups.done.length;
  const recordPending = recordGroups.pending.length + recordGroups.issue.length;
  const recordTotal = recordDone + recordPending;
  const recordRate = recordTotal ? Math.round((recordDone / recordTotal) * 100) : 100;
  const pendingChanges = operationBranchMakeupRequests()
    .filter((item) => ["pending", "requested", "coach_required"].includes(item.status)).length;
  const missingScheduleCount = unassignedRegularTickets().length + couponTicketsWithoutUpcomingLesson().length;

  const metrics = [
    { label: "결제 완료 매출", value: `${money.format(paidAmount)}원`, detail: `${paidBillings.length}건 · 결제 DB 기준`, tone: "accent" },
    { label: "활성 회원", value: `${activeMembers.length}명`, detail: `활성 회원권 ${activeTickets.length}개`, tone: "" },
    { label: "완료 수업", value: `${completedLessons.length}건`, detail: `${monthLabel} 시간표 기준`, tone: "calm" },
    { label: "기록 완료율", value: `${recordRate}%`, detail: `현재 확인 필요 ${recordPending}건`, tone: recordPending ? "warning" : "", needsAttention: recordPending > 0 },
  ];
  const visibleMetrics = managementReportVisibleItems("summary", metrics);
  metricTarget.innerHTML = visibleMetrics.map((item) => `
    <article class="metric-card ${item.tone}">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.detail}</small>
    </article>`).join("") || managementReportEmptyMarkup("기록·차감 상태가 모두 정상입니다.");

  memberTarget.innerHTML = managementReportListMarkup(managementReportVisibleItems("members", [
    { label: "활성 회원", value: `${activeMembers.length}명`, detail: "현재 지점의 수강중 회원" },
    { label: "활성 회원권", value: `${activeTickets.length}개`, detail: "잔여 횟수와 사용 기간이 남은 회원권" },
    { label: "잔여 2회 이하", value: `${lowTickets.length}개`, detail: "재등록 안내가 필요한 회원권", tone: lowTickets.length ? "warning" : "", needsAttention: lowTickets.length > 0 },
    { label: "시간표 확인 필요", value: `${missingScheduleCount}개`, detail: "정규시간 미배정 또는 쿠폰 다음 예약 없음", tone: missingScheduleCount ? "warning" : "", needsAttention: missingScheduleCount > 0 },
  ]), "회원권과 시간표에 확인할 항목이 없습니다.");

  qualityTarget.innerHTML = managementReportListMarkup(managementReportVisibleItems("quality", [
    { label: "완료 수업", value: `${completedLessons.length}건`, detail: `${monthLabel} 완료 처리` },
    { label: "기록·차감 완료", value: `${recordDone}건`, detail: "최종 피드백과 차감이 확인된 기록" },
    { label: "기록 확인 필요", value: `${recordPending}건`, detail: "초안·미차감·수정 요청", tone: recordPending ? "warning" : "", needsAttention: recordPending > 0 },
    { label: "노쇼·변경 승인", value: `${noShowLessons.length} / ${pendingChanges}건`, detail: "선택 월 노쇼 / 현재 변경 승인 대기", tone: noShowLessons.length || pendingChanges ? "warning" : "", needsAttention: noShowLessons.length > 0 || pendingChanges > 0 },
  ]), "피드백·출석에서 확인할 항목이 없습니다.");

  financeTarget.innerHTML = managementReportListMarkup(managementReportVisibleItems("finance", [
    { label: "결제 완료 매출", value: `${money.format(paidAmount)}원`, detail: "테니스노트 결제 기록에서 실시간 계산", tone: "ready" },
    { label: "선택 월 결제건 환불", value: `${money.format(refundedAmount)}원`, detail: "취소·환불 증빙 기준", needsAttention: refundedAmount > 0 },
    ...managementDriveFinanceRows(),
  ]), "재무 자료에 확인할 항목이 없습니다.");

  const sourceItems = managementReportVisibleItems("sources", [
    { title: "1. 운영 KPI", detail: "회원·회원권·수업·피드백·결제는 현재 운영 DB에서 자동 계산합니다.", status: "현재 적용" },
    { title: "2. 월간 사업 지표", detail: "매출·이익, 전체 등록, 신규·재등록·이탈, 고객 분포를 공통 지표로 정리합니다.", status: "정의 통합", needsAttention: true },
    { title: "3. 장부 읽기 전용 연결", detail: "2023~2026 리포트·장부 12개 파일, 277개 탭은 원본 행을 복제하지 않고 allowlist 집계 셀과 자료 상태만 읽습니다.", status: adminDriveReportState.status === "fresh" ? "현재 적용" : "서버 연결 필요", needsAttention: adminDriveReportState.status !== "fresh" },
    { title: "4. 자료 품질 게이트", detail: "미입력·작성 중·검증 필요·마감과 수식 오류를 숫자보다 먼저 표시합니다.", status: "필수", needsAttention: true },
  ]);
  sourceTarget.innerHTML = sourceItems.map((item) => `
    <article><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span><em>${escapeHtml(item.status)}</em></article>
  `).join("") || managementReportEmptyMarkup("리포트 개발 확인 항목이 없습니다.");
}
