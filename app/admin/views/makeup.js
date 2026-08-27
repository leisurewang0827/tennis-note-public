// 보강 화면을 그리는 함수들.
//
// app.js 에서 본문 그대로 옮겨왔다. 전역 함수 선언이라 호출부는 예전과 같고
// renderAll() 도 그대로 이 함수들을 부른다.
// DOM 을 만지므로 domain/ 과 달리 단위 테스트 대상은 아니다.

function renderHoldingRequestAdminList() {
  const target = $("#holdingRequestAdminList");
  if (!target) return;
  const requests = loadSharedData().holdingRequests || [];
  const panel = target.closest("details");
  if (panel && requests.some((request) => request.status === "pending")) panel.open = true;
  target.innerHTML = requests.length
    ? requests.map((request) => `
      <article class="holding-admin-row ${escapeHtml(request.status || "pending")}">
        <div class="holding-admin-main">
          <strong>${escapeHtml(request.member || "회원")}</strong>
          <span>${escapeHtml(request.typeLabel || (request.type === "injury" ? "부상·입원" : "개인 사유"))} · ${escapeHtml(request.startDate)}~${escapeHtml(request.endDate)} · ${Number(request.days) || "-"}일</span>
          <small>${escapeHtml(request.ticketTitle || "회원권")} · ${request.type === "injury" ? "민감정보 상세 비공개" : escapeHtml(request.reason || "사유 미입력")}</small>
        </div>
        <div class="holding-admin-status">
          ${badge(request.status === "approved" ? "ready" : request.status === "rejected" ? "danger" : "pending", request.status === "approved" ? "승인" : request.status === "rejected" ? "반려" : "검토중")}
          ${request.type === "injury" ? `<button class="ghost-button" type="button" data-view-holding-evidence="${escapeHtml(request.id)}">증빙 확인</button>` : ""}
          ${request.evidencePath && request.status !== "pending" ? `<button class="ghost-button" type="button" data-delete-holding-evidence="${escapeHtml(request.id)}">원본 삭제</button>` : ""}
        </div>
        <div class="holding-admin-actions">
          <button class="small-button" type="button" data-review-holding="approved" data-holding-request-id="${escapeHtml(request.id)}" ${request.status !== "pending" ? "disabled" : ""}>승인</button>
          <button class="small-button danger-button" type="button" data-review-holding="rejected" data-holding-request-id="${escapeHtml(request.id)}" ${request.status !== "pending" ? "disabled" : ""}>반려</button>
        </div>
      </article>`).join("")
    : `<p class="empty-text">접수된 홀딩 요청이 없습니다.</p>`;
}

function renderMakeups() {
  const target = $("#makeupRows");
  if (!target) return;
  const entitlements = operationBranchMakeupRequests()
    .filter((item) => item.makeupType === "entitlement");
  target.innerHTML = entitlements
    .map(
      (item) => `
        <tr>
          <td>${item.member}</td>
          <td>${item.original}</td>
          <td>${item.requested}</td>
          <td>${item.policy}</td>
          <td>${badge(item.status, item.statusLabel)}</td>
          <td>
            <button class="small-button" type="button" data-book-entitlement="${item.entitlementId}" ${item.status === "approved" ? "disabled" : ""}>${item.status === "approved" ? "예약완료" : "시간표에서 예약"}</button>
          </td>
        </tr>`,
    )
    .join("") || `<tr><td colspan="6">현재 생성된 보강권이 없습니다.</td></tr>`;
}

function renderHoldingPolicySettings() {
  if (state.view !== "settings") return;
  const target = $("#holdingPolicySettings");
  if (!target) return;
  target.innerHTML = `
    <div class="holding-policy-grid">
      <label><small>4주권 개인 홀딩</small><input id="holdingPersonalMaxDays" type="number" min="0" max="30" value="${Number(holdingPolicySettings.fourWeekPersonalMaxDays ?? holdingPolicySettings.personalMaxDays) || 7}" /></label>
      <label><small>3개월권 개인 홀딩</small><input id="holdingThreeMonthPersonalMaxDays" type="number" min="0" max="60" value="${Number(holdingPolicySettings.threeMonthPersonalMaxDays) || 14}" /></label>
      <label><small>부상·입원 최대일</small><input id="holdingInjuryMaxDays" type="number" min="1" max="180" value="${Number(holdingPolicySettings.injuryMaxDays) || 30}" /></label>
      <label><small>응급 소급 신청</small><input id="holdingEmergencyRetroactiveDays" type="number" min="0" max="7" value="${Number(holdingPolicySettings.emergencyRetroactiveDays) || 3}" /></label>
      <label><small>증빙 원본 보관일</small><input id="holdingEvidenceRetentionDays" type="number" min="1" max="90" value="${Number(holdingPolicySettings.evidenceRetentionDays) || 30}" /></label>
      <label class="holding-policy-toggle"><input id="holdingEvidenceRequired" type="checkbox" ${holdingPolicySettings.evidenceRequired !== false ? "checked" : ""} /><span>부상 홀딩 증빙 필수</span></label>
    </div>
    <div class="holding-policy-note">
      <strong>현재 기준</strong>
      <span>4주권 ${Number(holdingPolicySettings.fourWeekPersonalMaxDays ?? holdingPolicySettings.personalMaxDays) || 7}일 · 3개월권 ${Number(holdingPolicySettings.threeMonthPersonalMaxDays) || 14}일 · 쿠폰 개인 홀딩 없음 · 부상 ${Number(holdingPolicySettings.injuryMaxDays) || 30}일</span>
    </div>
    <button class="small-button" type="button" id="saveHoldingPolicy">홀딩 정책 저장</button>`;
}
