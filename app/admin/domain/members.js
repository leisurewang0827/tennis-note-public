// 회원(member) 값 판정·표시 문구를 만드는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberListStatus(member) {
  if (member.serverStatus === "inactive" || member.serverStatus === "archived" || member.status === "inactive") return "inactive";
  // A legacy profile may still say journal_only after a ticket is issued.
  // The live ticket-derived status is the source of truth for member lists.
  if (member.status === "active") return "active";
  if (member.status === "expired") return "expired";
  if (member.status === "pending" || member.memberKind === "lesson_pending") return "pending";
  if (member.status === "journal" || member.memberKind === "journal_only") return "journal";
  return "active";
}

function memberManagementLessonTypeLabel(value = "") {
  return value === "one_on_two" ? "1:2" : value === "one_on_one" ? "1:1" : "미입력";
}

function memberManagementLessonMethodLabel(record = null, ticket = null) {
  const scope = record?.lesson_schedule_scope || ticket?.scheduleScope || "";
  const frequency = Number(record?.lesson_frequency_per_week || ticket?.weeklyCount || 0);
  if (!scope || !frequency) return "미입력";
  const scopeLabel = scope === "mixed" ? "혼합" : scope === "weekend" ? "주말" : "평일";
  return `${scopeLabel} 주${frequency}회`;
}

function memberManagementLessonDaysLabel(record = null, ticket = null) {
  const days = Array.isArray(record?.lesson_days)
    ? record.lesson_days
    : Array.isArray(ticket?.lessonDays)
      ? ticket.lessonDays
      : [];
  const labels = [...new Set(days.map(memberManagementDayLabel).filter(Boolean))];
  return labels.length ? labels.join(" · ") : "미입력";
}

function defaultAuthRoleForMember(member) {
  return ["member", "coach", "admin"].includes(member.authRole) ? member.authRole : "member";
}

function memberAuthConnection(member = {}) {
  const providers = [...new Set((member.authProviders || [])
    .map(normalizedAuthProvider)
    .filter(Boolean))];
  const primaryProvider = providers[0] || "";
  const primaryLabel = authProviderLabel(primaryProvider) || primaryProvider;
  const linked = Boolean(member.authLinked);
  return {
    linked,
    provider: primaryProvider,
    providers: primaryProvider ? [primaryProvider] : [],
    summary: linked ? (primaryLabel ? `${primaryLabel} 연결` : "로그인 계정 연결됨") : "앱 가입 전",
    detail: linked ? (primaryLabel ? `로그인 수단: ${primaryLabel}` : "로그인 계정은 연결됐으며 수단 정보는 확인 중입니다.") : "로그인 수단 미연결",
  };
}

function renderMemberEnrollmentDetails(member) {
  const enrollment = member.enrollment;
  if (!enrollment) return "";
  const levelLabels = { first: "처음 시작", beginner: "입문·초급", intermediate: "중급", advanced: "상급" };
  return `
    <details class="member-admin-more">
      <summary>수강 가입서 자세히 보기</summary>
      <dl class="member-db-grid member-db-grid-compact">
        <div><dt>테니스 경험</dt><dd>${escapeHtml(levelLabels[enrollment.experience_level] || enrollment.experience_level || "미입력")}</dd></div>
        ${Number(enrollment.group_size || 1) === 2 ? `<div><dt>2대1 파트너</dt><dd>${escapeHtml(enrollment.partner_name || "확인 필요")}</dd></div>` : ""}
      </dl>
    </details>`;
}

function memberManagementActionLabel(action) {
  return ({
    create: "회원 수동 추가",
    assign: "회원권 등록",
    profile: "기본정보 수정",
    app_link: "앱 로그인 관리",
    link_existing: "기존 수강 DB 연결",
    extend: "회원권 기간 연장",
    correct: "회원권 숫자·기간 수정",
    expire: "회원권 만료 처리",
    close: "회원권·미래수업 종료",
    force_delete: "회원권 강제 삭제",
    permanent_delete: "회원 영구 삭제",
    reenroll: "다시 수강 등록",
    deactivate: "회원 삭제 처리",
    restore: "회원 복원",
  })[action] || "회원 관리";
}

function memberManagementDate(value = "") {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : adminLocalDateKey(new Date());
}

function addMemberManagementDays(value, days) {
  const date = new Date(`${memberManagementDate(value)}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return adminLocalDateKey(date);
}

function memberManagementValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function memberManagementFieldLabel(label, required = false, conditional = "") {
  const badge = required ? "필수" : conditional || "선택";
  const tone = required ? "is-required" : conditional ? "is-conditional" : "is-optional";
  return `<span class="member-field-label">${escapeHtml(label)}<em class="${tone}">${escapeHtml(badge)}</em></span>`;
}

function memberManualProfileFields(member = {}) {
  const dominantHand = member.dominantHand || "";
  const backhandStyle = member.backhandStyle || "";
  return `
    <label class="form-field span-2">${memberManagementFieldLabel("실명", true)}<input name="memberName" type="text" minlength="2" maxlength="40" value="${escapeHtml(member.name || "")}" autocomplete="name" required /></label>
    <label class="form-field">${memberManagementFieldLabel("닉네임")}<input name="memberNickname" type="text" minlength="2" maxlength="16" value="${escapeHtml(member.nickname || "")}" placeholder="선택 입력" /></label>
    <label class="form-field">${memberManagementFieldLabel("휴대전화", true)}<input name="memberPhone" type="tel" inputmode="tel" maxlength="20" value="${escapeHtml(member.phone || "")}" placeholder="010-0000-0000" required /></label>
    <label class="form-field">${memberManagementFieldLabel("출생연도", true)}<input name="memberBirthYear" type="number" min="1900" max="2100" step="1" value="${escapeHtml(String(member.birthYear || ""))}" placeholder="예: 1990" required /></label>
    <label class="form-field">${memberManagementFieldLabel("거주동", true)}<input name="memberNeighborhood" type="text" maxlength="40" value="${escapeHtml(member.neighborhood || "")}" placeholder="예: 군자동" required /></label>
    <label class="form-field">${memberManagementFieldLabel("성별")}<select name="memberGender">
      <option value="" ${member.gender ? "" : "selected"}>미입력</option>
      <option value="female" ${member.gender === "female" ? "selected" : ""}>여성</option>
      <option value="male" ${member.gender === "male" ? "selected" : ""}>남성</option>
      <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
      <option value="prefer_not" ${member.gender === "prefer_not" ? "selected" : ""}>응답 안 함</option>
    </select></label>
    <label class="form-field">${memberManagementFieldLabel("주사용 손")}<select name="memberDominantHand">
      <option value="" ${dominantHand ? "" : "selected"}>미입력</option>
      <option value="right" ${dominantHand === "right" ? "selected" : ""}>오른손</option>
      <option value="left" ${dominantHand === "left" ? "selected" : ""}>왼손</option>
      <option value="ambidextrous" ${dominantHand === "ambidextrous" ? "selected" : ""}>양손</option>
    </select></label>
    <label class="form-field">${memberManagementFieldLabel("백핸드")}<select name="memberBackhandStyle">
      <option value="" ${backhandStyle ? "" : "selected"}>미입력</option>
      <option value="two_handed" ${backhandStyle === "two_handed" ? "selected" : ""}>투핸드</option>
      <option value="one_handed" ${backhandStyle === "one_handed" ? "selected" : ""}>원핸드</option>
    </select></label>
    <label class="form-field">${memberManagementFieldLabel("테니스 시작일")}<input name="memberTennisStartedOn" type="date" value="${escapeHtml(member.tennisStartedOn || "")}" /></label>
    <label class="form-field">${memberManagementFieldLabel("자가 NTRP")}<input name="memberSelfNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.selfNtrp || ""))}" /></label>
    <label class="form-field">${memberManagementFieldLabel("코치 측정 NTRP")}<input name="memberCoachNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.coachNtrp || ""))}" /></label>
    <label class="form-field span-2">${memberManagementFieldLabel("테니스 목표")}<textarea name="memberTennisGoal" rows="2" maxlength="1000" placeholder="선택 입력">${escapeHtml(member.tennisGoal || "")}</textarea></label>
    <label class="form-field span-2">${memberManagementFieldLabel("플레이 스타일·관리 메모")}<textarea name="memberPlayStyleMemo" rows="2" maxlength="2000" placeholder="선택 입력">${escapeHtml(member.playStyleMemo || "")}</textarea></label>`;
}

function memberBasicProfileFields(member = {}) {
  const dominantHand = member.dominantHand || "";
  const backhandStyle = member.backhandStyle || "";
  return `
    <label class="form-field span-2">${memberManagementFieldLabel("이름", true)}<input name="memberName" type="text" minlength="2" maxlength="40" value="${escapeHtml(member.name || "")}" autocomplete="name" required /></label>
    <label class="form-field">${memberManagementFieldLabel("휴대전화")}<input name="memberPhone" type="tel" inputmode="tel" maxlength="20" value="${escapeHtml(member.phone || "")}" placeholder="010-0000-0000" /></label>
    <label class="form-field">${memberManagementFieldLabel("출생연도")}<input name="memberBirthYear" type="number" min="1900" max="2100" step="1" value="${escapeHtml(String(member.birthYear || ""))}" placeholder="예: 1990" /></label>
    <label class="form-field">${memberManagementFieldLabel("거주동")}<input name="memberNeighborhood" type="text" maxlength="40" value="${escapeHtml(member.neighborhood || "")}" placeholder="예: 군자동" /></label>
    <label class="form-field">${memberManagementFieldLabel("성별")}<select name="memberGender">
      <option value="" ${member.gender ? "" : "selected"}>미입력</option>
      <option value="female" ${member.gender === "female" ? "selected" : ""}>여성</option>
      <option value="male" ${member.gender === "male" ? "selected" : ""}>남성</option>
      <option value="other" ${member.gender === "other" ? "selected" : ""}>기타</option>
      <option value="prefer_not" ${member.gender === "prefer_not" ? "selected" : ""}>응답 안 함</option>
    </select></label>
    <input name="memberNickname" type="hidden" value="${escapeHtml(member.nickname || "")}" />
    <details class="member-profile-optional span-2">
      <summary>테니스 정보 수정 <small>선택</small></summary>
      <div class="member-management-form-grid">
        <label class="form-field">${memberManagementFieldLabel("주사용 손")}<select name="memberDominantHand">
          <option value="" ${dominantHand ? "" : "selected"}>미입력</option>
          <option value="right" ${dominantHand === "right" ? "selected" : ""}>오른손</option>
          <option value="left" ${dominantHand === "left" ? "selected" : ""}>왼손</option>
          <option value="ambidextrous" ${dominantHand === "ambidextrous" ? "selected" : ""}>양손</option>
        </select></label>
        <label class="form-field">${memberManagementFieldLabel("백핸드")}<select name="memberBackhandStyle">
          <option value="" ${backhandStyle ? "" : "selected"}>미입력</option>
          <option value="two_handed" ${backhandStyle === "two_handed" ? "selected" : ""}>투핸드</option>
          <option value="one_handed" ${backhandStyle === "one_handed" ? "selected" : ""}>원핸드</option>
        </select></label>
        <label class="form-field">${memberManagementFieldLabel("테니스 시작일")}<input name="memberTennisStartedOn" type="date" value="${escapeHtml(member.tennisStartedOn || "")}" /></label>
        <label class="form-field">${memberManagementFieldLabel("내 테니스 수준")}<input name="memberSelfNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.selfNtrp || ""))}" /></label>
        <label class="form-field">${memberManagementFieldLabel("코치 확인 수준")}<input name="memberCoachNtrp" type="number" min="1" max="7" step="0.5" value="${escapeHtml(String(member.coachNtrp || ""))}" /></label>
        <label class="form-field span-2">${memberManagementFieldLabel("테니스 목표")}<textarea name="memberTennisGoal" rows="2" maxlength="1000">${escapeHtml(member.tennisGoal || "")}</textarea></label>
        <label class="form-field span-2">${memberManagementFieldLabel("플레이 스타일·관리 메모")}<textarea name="memberPlayStyleMemo" rows="2" maxlength="2000">${escapeHtml(member.playStyleMemo || "")}</textarea></label>
      </div>
    </details>`;
}

function automaticMemberManagementReason(action) {
  return {
    create: "관리자 수동 회원 등록",
    assign: "관리자 기존 회원 회원권 등록",
    profile: "관리자 회원 정보 수정",
    app_link: "관리자 앱 계정 연결",
    link_existing: "관리자 운동노트·기존 수강 DB 연결",
    extend: "관리자 회원권 기간 연장",
    correct: "관리자 회원권 수동 조정",
    expire: "관리자 회원권 만료 처리",
    close: "관리자 회원권·미래수업 종료",
    force_delete: "관리자 잘못된 회원권 강제 삭제",
    permanent_delete: "관리자 삭제회원 영구 삭제",
    reenroll: "관리자 회원 재등록",
    deactivate: "관리자 회원 운영 삭제",
    restore: "관리자 회원 복원",
  }[action] || "관리자 수동 처리";
}

function memberLinkCandidateLabel(candidate = {}) {
  const providers = (candidate.providers || []).map(authProviderLabel).filter(Boolean).join("·") || "로그인";
  const matches = (candidate.matchedFields || []).map((field) => ({
    phone: "전화번호",
    name: "이름",
    birth_year: "출생연도",
  })[field] || field).join("+");
  const last4 = candidate.phoneLast4 ? ` · 전화 끝 ${candidate.phoneLast4}` : "";
  const recommended = candidate.recommended ? " · 추천" : "";
  return `${candidate.name || "가입자"} · ${providers}${last4}${matches ? ` · ${matches} 일치` : ""}${recommended}`;
}

function normalizedMemberLinkSearch(value = "") {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function memberManualRegistrationFields() {
  return `
    <label class="form-field span-2">${memberManagementFieldLabel("이름", true)}<input name="memberName" type="text" minlength="2" maxlength="40" autocomplete="name" required /></label>
    <label class="form-field">${memberManagementFieldLabel("휴대전화", true)}<input name="memberPhone" type="tel" inputmode="tel" maxlength="20" placeholder="010-0000-0000" required /></label>
    <label class="form-field">${memberManagementFieldLabel("출생연도", true)}<input name="memberBirthYear" type="number" min="1900" max="2100" step="1" placeholder="예: 1990" required /></label>
    <input name="memberNickname" type="hidden" value="" />
    <label class="form-field">${memberManagementFieldLabel("거주동", true)}<input name="memberNeighborhood" type="text" maxlength="40" placeholder="예: 군자동" required /></label>
    <label class="form-field">${memberManagementFieldLabel("성별")}<select name="memberGender">
      <option value="">미입력</option>
      <option value="female">여성</option>
      <option value="male">남성</option>
      <option value="other">기타</option>
      <option value="prefer_not">응답 안 함</option>
    </select></label>
    <input name="memberDominantHand" type="hidden" value="" />
    <input name="memberBackhandStyle" type="hidden" value="" />
    <input name="memberTennisStartedOn" type="hidden" value="" />
    <input name="memberSelfNtrp" type="hidden" value="" />
    <input name="memberCoachNtrp" type="hidden" value="" />
    <input name="memberTennisGoal" type="hidden" value="" />
    <input name="memberPlayStyleMemo" type="hidden" value="" />`;
}

function maskMemberPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return "연락처 확인 필요";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function memberManagementNullableNumber(input) {
  const value = String(input?.value || "").trim();
  return value === "" ? null : Number(value);
}

function memberManagementErrorText(error) {
  const raw = `${error?.payload?.code || ""} ${error?.message || ""}`;
  if (raw.includes("server_request_timeout")) return "서버 응답이 지연되었습니다. 중복 저장은 차단되어 있으니 새로고침 후 결과를 확인해 주세요.";
  if (raw.includes("admin_live_refresh_failed_after_write")) return "서버 저장은 요청됐지만 결과를 다시 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.";
  if (raw.includes("member_ticket_extension_date_must_increase")) return "현재 만료일보다 늦은 날짜를 선택해 주세요.";
  if (raw.includes("member_ticket_extension_status_invalid")) return "사용 중 또는 홀딩 중인 회원권만 기간을 연장할 수 있습니다.";
  if (raw.includes("member_ticket_revision_conflict")) return "다른 화면에서 회원권이 먼저 변경됐습니다. 최신 정보를 다시 확인해 주세요.";
  if (raw.includes("member_ticket_expected_updated_at_required")) return "최신 회원권 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.";
  if (raw.includes("ticket_grid_equivalent_product_not_found")) return "같은 지점·횟수·수업시간 조건의 평일/주말 대응 상품이 없습니다. 운영 설정에서 대응 상품을 먼저 활성화해 주세요.";
  if (raw.includes("ticket_grid_equivalent_product_ambiguous")) return "조건이 같은 대응 상품이 여러 개입니다. 운영 설정에서 중복 상품을 정리한 뒤 다시 저장해 주세요.";
  if (raw.includes("ticket_grid_cross_branch_product_blocked")) return "다른 지점 상품으로는 회원권을 변경할 수 없습니다.";
  if (raw.includes("ticket_grid_inactive_product_blocked")) return "판매 중지 또는 숨김 상품으로는 회원권을 변경할 수 없습니다.";
  if (raw.includes("ticket_grid_product_scope_mismatch")) return "선택한 상품의 평일/주말 범위가 요청한 범위와 다릅니다.";
  if (raw.includes("ticket_grid_future_schedule_scope_conflict")) return "새 평일/주말 범위와 맞지 않는 미래 수업이 있습니다. 기존 예약을 유지할지 미래 일정을 다시 설정할지 먼저 선택해 주세요.";
  if (raw.includes("ticket_grid_terminal_status_locked")) return "환불 또는 삭제가 끝난 회원권은 사용 중 상태로 되돌릴 수 없습니다.";
  if (raw.includes("ticket_grid_current_product_missing")) return "이관 회원권의 상품 연결이 없습니다. 먼저 정확한 상품을 연결해 주세요.";
  if (raw.includes("member_management_write_not_confirmed")) return "서버에서 변경 결과를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.";
  if (raw.includes("member_schedule_write_not_confirmed")) return "회원권은 저장됐지만 새 시간표를 확인하지 못했습니다. 새로고침 후 시간표를 확인해 주세요.";
  if (raw.includes("regular_schedule_count_mismatch")) return "회원권의 주 횟수만큼 요일과 시간을 선택해 주세요.";
  if (raw.includes("regular_schedule_duplicate")) return "같은 요일·시간을 두 번 선택할 수 없습니다.";
  if (raw.includes("schedule_scope_mismatch")) return "회원권의 평일·주말 범위에 맞는 요일을 선택해 주세요.";
  if (raw.includes("coach_not_working")) return "선택한 요일·시간은 담당 코치의 근무시간이 아닙니다.";
  if (raw.includes("target_time_blocked")) return "선택한 시간은 브레이크 또는 수업 제한 시간입니다.";
  if (raw.includes("target_time_occupied")) return "선택한 시간에 담당 코치의 다른 수업이 있습니다.";
  if (raw.includes("regular_schedule_not_created")) return "선택한 시간으로 만들 수 있는 미래 수업이 없습니다. 시작일·만료일·잔여 횟수를 확인해 주세요.";
  if (raw.includes("member_create_schedule_not_created")) return "선택한 정규시간에 생성할 수 있는 미래 수업이 없습니다. 코치 시간표와 회원권 기간을 확인해 주세요.";
  if (raw.includes("member_create_schedule_frequency_mismatch")) return "회원권 횟수만큼 정규 요일과 시간을 모두 선택해 주세요.";
  if (raw.includes("member_create_schedule_duplicate")) return "같은 요일과 시간을 중복 선택할 수 없습니다.";
  if (raw.includes("member_create_schedule_value_invalid")) return "회원권의 평일·주말 범위에 맞는 10분 단위 시간을 선택해 주세요.";
  if (raw.includes("member_create_schedule_blocked_time") || raw.includes("member_create_schedule_outside_working_hours")) return "코치 수업 가능 시간과 브레이크 시간을 확인해 다른 시간을 선택해 주세요.";
  if (raw.includes("member_assignment_schedule_not_created")) return "회원권과 정규시간을 함께 만들지 못해 전체 저장을 취소했습니다. 시작일·만료일·코치 시간을 확인해 주세요.";
  if (raw.includes("member_assignment_schedule_frequency_mismatch")) return "주 횟수만큼 정규 요일과 시간을 모두 선택해 주세요.";
  if (raw.includes("member_assignment_schedule_duplicate")) return "같은 요일과 시간을 중복 선택할 수 없습니다.";
  if (raw.includes("member_assignment_schedule_value_invalid")) return "회원권의 평일·주말 범위에 맞는 시간을 선택해 주세요.";
  if (raw.includes("member_assignment_schedule_blocked_time") || raw.includes("member_assignment_schedule_outside_working_hours")) return "코치 근무시간·브레이크와 겹치지 않는 시간을 선택해 주세요.";
  if (raw.includes("reenrollment_keep_schedule_product_mismatch")) return "새 회원권의 수업시간·주 횟수·인원이 달라 기존 시간을 유지할 수 없습니다. ‘새 요일·시간 선택’을 사용해 주세요.";
  if (raw.includes("reenrollment_regular_schedule_missing")) return "기존 정규시간을 확인할 수 없습니다. ‘새 요일·시간 선택’에서 주 횟수만큼 다시 선택해 주세요.";
  if (raw.includes("reenrollment_schedule_frequency_mismatch")) return "새 회원권의 주 횟수만큼 요일과 시간을 모두 선택해 주세요.";
  if (raw.includes("reenrollment_schedule_duplicate")) return "재등록 시간에 같은 요일·시간을 중복 선택할 수 없습니다.";
  if (raw.includes("reenrollment_schedule_value_invalid")) return "회원권의 평일·주말 범위와 시작 시간 규칙에 맞는 시간을 선택해 주세요.";
  if (raw.includes("reenrollment_schedule_not_supported")) return "쿠폰·원데이는 정규시간 변경 없이 재등록해 주세요.";
  if (raw.includes("reenrollment_operation_in_progress")) return "같은 재등록 요청을 처리 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.";
  if (raw.includes("schedule_v2_approved_coach_required")) return "같은 지점의 현재 승인 코치를 선택해 주세요.";
  if (raw.includes("schedule_v2_rule_outside_ticket_window")) return "회원권 사용기간 안에 선택한 정규 요일이 없습니다. 시작일과 만료일을 확인해 주세요.";
  if (raw.includes("payment_product_mismatch")) return "기존 결제에 연결된 회원권과 선택한 회원권이 다릅니다. 결제 회원권을 선택해 주세요.";
  if (raw.includes("payment_already_linked")) return "이 결제는 이미 다른 회원권에 연결되어 있습니다.";
  if (raw.includes("payment_member_mismatch")) return "기존 결제 회원과 발급 대상 회원이 맞지 않습니다.";
  if (raw.includes("payment_not_verified")) return "확인 완료된 결제만 회원권에 연결할 수 있습니다.";
  if (raw.includes("existing_payment_link_failed")) return "회원권은 발급됐지만 기존 결제 연결을 확인하지 못했습니다. 새로고침 후 결제/정산에서 확인해 주세요.";
  if (raw.includes("member_ticket_management_forbidden") || raw.includes("admin_role_required")) return "화면의 관리자 표시와 서버 관리자 권한이 일치하지 않습니다. 다시 로그인한 뒤 계정 권한을 확인해 주세요. (오류 코드: admin_role_required)";
  if (raw.includes("member_close_staff_forbidden") || raw.includes("member_profile_required")) return "관리자·코치 계정은 회원권 종료 기능으로 처리할 수 없습니다.";
  if (raw.includes("member_deleted_restore_first")) return "삭제회원은 먼저 회원 복원을 해 주세요. 회원권 종료는 만료회원으로 보존할 때 사용합니다.";
  if (raw.includes("member_already_expired")) return "이미 만료 처리된 회원입니다. 재등록 또는 복원을 선택해 주세요.";
  if (raw.includes("member_close_reason_required")) return "회원권 종료 사유를 5자 이상 입력해 주세요.";
  if (raw.includes("member_close_ticket_remaining") || raw.includes("member_close_future_lesson_remaining")) return "회원권과 미래 수업을 모두 종료하지 못해 변경을 롤백했습니다. 새로고침 후 다시 확인해 주세요.";
  if (raw.includes("PGRST202") && raw.includes("tn_admin_preview_member_ticket_and_future_lessons_close")) return "회원 종료 안전 패치가 서버에 아직 적용되지 않았습니다. DB 업데이트 후 다시 시도해 주세요.";
  if (raw.includes("force_delete_reason_required")) return "강제 삭제 사유를 5자 이상 입력해 주세요.";
  if (raw.includes("force_delete_ticket_not_removed")) return "연결 기록을 정리했지만 회원권 행이 삭제되지 않았습니다. 새로고침 후 다시 확인해 주세요. (오류 코드: force_delete_ticket_not_removed)";
  if (raw.includes("23503") || raw.toLowerCase().includes("foreign key")) return "회원권에 연결된 기록이 남아 있어 삭제하지 못했습니다. 최신 DB 패치를 적용한 뒤 다시 시도해 주세요. (오류 코드: linked_record_remaining)";
  if (raw.includes("PGRST202") || raw.includes("tn_admin_member_ticket_force_delete_preview")) return "회원권 삭제 안전 패치가 서버에 아직 적용되지 않았습니다. DB 업데이트 후 다시 시도해 주세요. (오류 코드: delete_patch_missing)";
  if (raw.includes("management_reason_required")) return "변경 사유를 두 글자 이상 입력해 주세요.";
  if (raw.includes("ticket_balance_invalid")) return "총횟수는 소진횟수와 잔여횟수를 더한 값이어야 합니다.";
  if (raw.includes("ticket_date_range_invalid")) return "시작일과 만료일 순서를 확인해 주세요.";
  if (raw.includes("source_ticket_still_active") || raw.includes("active_ticket_already_exists")) return "현재 사용 중인 동일 회원권이 있어 재등록할 수 없습니다.";
  if (raw.includes("member_inactive_restore_first")) return "삭제회원은 먼저 회원 복원을 해 주세요.";
  if (raw.includes("group_ticket_requires_two_participants")) return "2대1 회원권의 파트너 연결을 먼저 확인해 주세요.";
  if (raw.includes("group_partner_required")) return "2대1 회원권은 파트너를 선택해야 합니다.";
  if (raw.includes("group_partner_name_required")) return "같이 등록할 파트너 실명을 두 글자 이상 입력해 주세요.";
  if (raw.includes("group_partner_phone_invalid")) return "파트너 휴대전화 번호를 확인해 주세요.";
  if (raw.includes("group_partner_phone_already_exists")) return "앱 가입 또는 기존 회원 계정이 있습니다. 자동으로 열린 기존 회원 검색에서 이름과 전화번호 끝자리를 확인해 선택해 주세요.";
  if (raw.includes("partner_search_query_too_short")) return "파트너 이름은 두 글자, 전화번호는 네 자리 이상 입력해 주세요.";
  if (raw.includes("group_partner_birth_year_invalid")) return "파트너 출생연도를 확인해 주세요.";
  if (raw.includes("group_partner_gender_invalid")) return "파트너 성별 값을 다시 선택해 주세요.";
  if (raw.includes("member_phone_already_exists")) return "같은 휴대전화 번호가 회원 또는 직원 계정에 사용 중입니다. 회원 검색에 없으면 운영 설정의 직원 계정과 계정 연결을 확인해 주세요.";
  if (raw.includes("member_name_required")) return "회원 이름을 두 글자 이상 입력해 주세요.";
  if (raw.includes("invalid_schedule_scope")) return "평일, 주말 또는 혼합을 선택해 주세요.";
  if (raw.includes("invalid_ticket_status")) return "회원권 상태를 다시 선택해 주세요.";
  if (raw.includes("active_ticket_requires_remaining_sessions")) return "사용 중 또는 일시정지 상태는 잔여 횟수가 1회 이상이어야 합니다.";
  if (raw.includes("invalid_payment_record_state")) return "결제 구분을 다시 선택해 주세요.";
  if (raw.includes("complete_payment_fields_required")) return "결제 완료는 결제일자, 결제수단, 1원 이상의 금액이 필요합니다.";
  if (raw.includes("transfer_payment_must_be_zero")) return "양도 회원권의 결제금액은 0원이어야 합니다.";
  if (raw.includes("unentered_payment_fields_must_be_empty")) return "미입력 상태에서는 결제값을 비워 주세요.";
  if (raw.includes("verified_payment_cannot_be_cleared")) return "확인된 결제는 회원관리에서 지울 수 없습니다. 환불 또는 결제 관리 절차를 사용해 주세요.";
  if (raw.includes("active_ticket_date_expired")) return "이미 지난 만료일로는 회원권을 사용 중 상태로 바꿀 수 없습니다.";
  if (raw.includes("pending_payment_status_locked")) return "결제 대기 회원권 상태는 결제 확인 절차에서만 변경할 수 있습니다.";
  if (raw.includes("voided_ticket_locked") || raw.includes("ticket_already_voided")) return "이미 삭제 처리된 회원권은 수정할 수 없습니다.";
  if (raw.includes("ticket_has_verified_payment")) return "결제가 확인된 회원권은 삭제 대신 만료 또는 환불 처리를 사용해 주세요.";
  if (raw.includes("admin_account_cannot_be_deactivated_here")) return "관리자 계정은 회원관리에서 삭제할 수 없습니다.";
  if (raw.includes("approved_branch_coach_required")) return "같은 지점의 승인 코치를 선택해 주세요.";
  if (raw.includes("ticket_not_found") || raw.includes("product_not_found")) return "회원권 정보가 변경됐습니다. 새로고침 후 다시 선택해 주세요.";
  if (raw.includes("refunded_ticket_locked")) return "환불 완료 회원권은 수정할 수 없습니다.";
  if (raw.includes("target_member_already_linked")) return "이미 다른 앱 계정이 연결된 회원입니다.";
  if (raw.includes("target_provider_already_linked") || raw.includes("login_provider_already_linked")) return "같은 로그인 방식의 다른 계정이 이미 연결되어 있습니다. 기존 로그인 계정을 확인해 주세요.";
  if (raw.includes("membership_link_target_required")) return "연결할 기존 수강회원을 선택해 주세요.";
  if (raw.includes("member_login_link_not_confirmed")) return "앱 계정 연결 결과를 확인하지 못했습니다. 새로고침 후 회원의 계정 연결 상태를 확인해 주세요.";
  if (raw.includes("source_signup_not_linked") || raw.includes("signup_profile_not_found")) return "가입 계정이 변경됐습니다. 새로고침 후 다시 선택해 주세요.";
  if (raw.includes("source_signup_has_operational_data")) return "선택한 가입 계정에 별도 회원권이나 수업이 있어 자동 병합할 수 없습니다. 관리자 검토가 필요합니다.";
  if (raw.includes("nickname_already_taken") || raw.includes("uq_tn_users_normalized_nickname")) return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (raw.includes("nickname_length_invalid")) return "닉네임은 2~16자로 입력해 주세요.";
  if (raw.includes("member_phone_invalid")) return "휴대전화 번호를 확인해 주세요.";
  if (raw.includes("member_birth_year_invalid")) return "출생연도를 확인해 주세요.";
  if (raw.includes("invalid_weekly_frequency")) return "평일은 주 1~3회, 주말은 주 1~2회로 선택해 주세요.";
  if (raw.includes("invalid_lesson_type")) return "레슨 종류를 1:1 또는 1:2로 선택해 주세요.";
  if (raw.includes("invalid_lesson_day") || raw.includes("lesson_days_must_be_array")) return "평일·주말 구분에 맞는 레슨 요일을 선택해 주세요.";
  if (raw.includes("lesson_method_product_mismatch")) return "레슨 방식과 종류에 맞는 회원권 상품을 선택해 주세요.";
  if (raw.includes("active_member_ticket_required")) return "수강중 회원은 활성 회원권과 1회 이상의 잔여 회차가 필요합니다.";
  if (raw.includes("member_required") || raw.includes("member_not_found")) return "회원 정보를 다시 불러온 뒤 수정해 주세요.";
  if (raw.includes("terminal_ticket_locked")) return "환불 또는 강제삭제가 끝난 회원권은 수정할 수 없습니다.";
  if (raw.includes("invalid_member_database_status")) return "회원 상태를 다시 확인해 주세요.";
  if (raw.includes("active_product_required")) return "사용 가능한 회원권 상품을 선택해 주세요.";
  if (raw.includes("member_verified_pending_ticket_exists")) return "결제가 확인된 대기 회원권이 있습니다. 결제/정산에서 회원권 연결을 확인해 주세요.";
  if (raw.includes("member_ticket_renewal_overlap_forbidden")) return "같은 코치·같은 회원권의 이용기간이 겹칩니다. 기존권 만료 다음 날부터 시작하는 재등록권으로 입력해 주세요.";
  if (raw.includes("member_ticket_exact_duplicate")) return "같은 코치·상품·기간·참여자의 회원권이 이미 있습니다.";
  if (raw.includes("member_ticket_overlap_confirmation_required")) return "같은 코치·같은 회원권의 이용기간이 겹칩니다. 별도 복수권이 아니라 재등록권으로 이어서 입력해 주세요.";
  if (raw.includes("member_active_ticket_exists")) return "구형 회원권 등록 규칙이 남아 있습니다. 최신 DB 패치를 적용한 뒤 다시 시도해 주세요.";
  if (raw.includes("ticket_price_invalid")) return "결제금액은 0원 이상으로 입력해 주세요.";
  if (raw.includes("group_surviving_member_required")) return "1:1로 계속 수강할 회원을 다시 선택해 주세요.";
  if (raw.includes("surviving_member_active_ticket_exists")) return "선택한 회원에게 다른 사용 중 회원권이 있습니다. 기존 회원권을 먼저 확인해 주세요.";
  if (raw.includes("separate_group_structure_requires_team_edit")) return "1:2 팀의 종류·파트너 변경은 팀 설정에서 함께 처리해 주세요.";
  const safeCode = String(error?.payload?.code || "").trim();
  const codeSuffix = /^[A-Za-z0-9_]{3,40}$/.test(safeCode) ? ` (오류 코드: ${safeCode})` : "";
  return `처리에 실패했습니다. 입력값과 서버 적용 상태를 확인해 주세요.${codeSuffix}`;
}

function normalizedMemberPhone(value = "") {
  return String(value || "").replace(/[^0-9]/g, "");
}

function memberDetailDateLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "없음";
  const date = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("ko-KR");
}

function memberGenderLabel(value = "") {
  const labels = { female: "여", male: "남", other: "기타", prefer_not: "미응답" };
  return labels[value] || value || "미입력";
}

function memberLessonPlanLabel(member, ticket) {
  const record = memberDatabaseRecord(member, ticket);
  if (!ticket && !record) return member.lessonType || "회원권 없음";
  return [
    memberManagementLessonMethodLabel(record, ticket),
    memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
    ticket?.durationMinutes ? `${ticket.durationMinutes}분` : "",
  ].filter(Boolean).join(" · ");
}

function getLessonMembersMarkup(lesson) {
  return scheduleMemberLinesMarkup(getLessonMembersLabel(lesson));
}

function billingMembershipDetail(item = {}) {
  if (item.oneDayBookingId) {
    const booking = oneDayBookingForBilling(item);
    if (!booking) return '<strong>원데이 예약</strong><br><small>결제와 예약이 연결됐습니다.</small>';
    const coach = getCoachName(booking.coachId || "") || "코치 확인 필요";
    const schedule = [booking.lessonDate, booking.time].filter(Boolean).join(" ");
    const status = booking.status === "completed" ? "수업 완료" : "예약 완료";
    return `<strong>원데이 예약</strong><br><small>${escapeHtml(coach)}${schedule ? ` · ${escapeHtml(schedule)}` : ""} · ${status}</small>`;
  }
  const ticket = linkedTicketForBilling(item);
  if (!ticket) return '<span class="payment-link-warning">회원권 연결 필요</span>';
  const product = getTicketDisplayProduct(ticket) || ticket.product || "회원권";
  const coach = getCoachName(ticket.coachId || "") || "코치 미지정";
  return `<strong>${escapeHtml(product)}</strong><br><small>${escapeHtml(coach)} · ${Number(ticket.used) || 0}/${Number(ticket.total) || 0}회 진행 · 잔여 ${Number(ticket.remaining) || 0}회</small>`;
}

function importMemberSampleRows() {
  return [
    ["AUG-001", "테니스클럽하우스", "홍길동", "010-0000-0000", 1990, "군자동", "남", "수강중", "노황규", "평일 4주 1대1 20분 주2회 8회", "현재 회원권 갱신", "평일", "1:1", "", "", "2026-08-03", "2026-09-06", 8, 0, 8, "결제완료", "2026-08-01", "카드", 286000, "가상 작성 예시"],
    ["AUG-002", "테니스클럽하우스", "김테니스", "010-1111-1111", 1988, "능동", "여", "수강중", "박창준", "주말 4주 2대1 20분 주1회 4회", "새 회원권", "주말", "1:2", "AUG-003", "010-2222-2222", "2026-08-01", "2026-09-04", 4, 0, 4, "결제완료", "2026-08-01", "현금", 120000, "가상 1:2 예시"],
    ["AUG-003", "테니스클럽하우스", "이파트너", "010-2222-2222", 1992, "화양동", "여", "수강중", "박창준", "주말 4주 2대1 20분 주1회 4회", "새 회원권", "주말", "1:2", "AUG-002", "010-1111-1111", "2026-08-01", "2026-09-04", 4, 0, 4, "결제완료", "2026-08-01", "현금", 120000, "가상 1:2 예시"],
    ["AUG-004", "테니스클럽하우스", "휴회예시", "010-3333-3333", 1985, "군자동", "남", "휴회", "노황규", "평일 4주 1대1 20분 주1회 4회", "현재 회원권 갱신", "평일", "1:1", "", "", "2026-08-03", "2026-10-31", 4, 0, 4, "해당없음", "", "", 0, "앱에서 복귀 시간을 다시 선택하는 예시"],
  ];
}

function importMemberStatus(value = "") {
  const normalized = String(value).replace(/\s+/g, "");
  if (["수강중", "활성", "active"].includes(normalized)) return "active";
  if (["휴회", "일시정지", "paused"].includes(normalized)) return "paused";
  if (["만료회원", "만료", "종료", "historical"].includes(normalized)) return "historical";
  if (["가입대기", "대기", "pending"].includes(normalized)) return "pending";
  return "";
}

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function readCachedOperationsIdentity() {
  for (const storage of operationsProfileCacheStores()) {
    try {
      const cached = JSON.parse(storage.getItem(operationsProfileCacheStorageKey) || "null");
      if (cached?.user?.id && ["admin", "coach"].includes(cached?.profile?.role)) return cached;
    } catch (error) {
      try {
        storage.removeItem(operationsProfileCacheStorageKey);
      } catch (storageError) {
        // Continue to the next available storage area.
      }
    }
  }
  return null;
}

function invalidateMemberSearchIndex({ preserveDirectory = false } = {}) {
  memberSearchIndex.clear();
  memberTicketsIndex.clear();
  ticketParticipantNamesIndex.clear();
  if (!preserveDirectory) {
    adminMemberDirectoryState.loaded = false;
    adminMemberDirectoryState.signature = "";
    adminMemberDirectoryState.rows = [];
    adminMemberDirectoryState.counts = null;
    adminMemberDirectoryState.preserveCountsWhileLoading = false;
  }
  adminMemberDetailCache.clear();
  adminUserNameIndex = null;
}

function adminMemberDetailEntry(member) {
  const userId = String(member?.serverUserId || "");
  return userId ? adminMemberDetailCache.get(userId) || null : null;
}

function adminMemberDirectoryCoachRoleId() {
  if (state.memberCoachFilter === "all") return null;
  return operationBranchCoaches().find((coach) => coach.name === state.memberCoachFilter)?.serverRoleId || null;
}

function adminMemberDirectorySignature() {
  return JSON.stringify({
    branchId: activeOperationBranchId() || null,
    status: state.memberFilter || "active",
    search: String(state.memberSearch || "").trim(),
    coachRoleId: adminMemberDirectoryCoachRoleId(),
    productKind: state.memberTicketFilter === "all" ? null : state.memberTicketFilter,
    page: Number(state.memberListPage) || 0,
    pageSize: memberListPageSize,
  });
}

function inferCoachIdForMember(memberName) {
  const member = members.find((item) => item.name === memberName);
  if (!member) return coaches.find((coach) => coach.status === "active")?.id || "coach-no";
  return coaches.find((coach) => member.coach.includes(coach.name.replace(" 코치", "")))?.id || coaches.find((coach) => coach.name === member.coach)?.id || "coach-no";
}

function operationBranchMembers(source = members) {
  const activeBranchId = activeOperationBranchId();
  if (!activeBranchId) return source;
  return source.filter((member) => {
    const branchIds = memberOperationBranchIds(member);
    return branchIds.length
      ? branchIds.includes(activeBranchId)
      : operationBranchAllowsLegacyRows();
  });
}

function discountIssueEligibleMembers(query = "") {
  const keyword = String(query || "").trim().toLowerCase();
  return members
    .filter((member) => member.serverUserId && !["admin", "coach"].includes(String(member.authRole || "").toLowerCase()))
    .filter((member) => !keyword || `${member.name || ""} ${member.phone || ""}`.toLowerCase().includes(keyword))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function dashboardOperationalMembers() {
  return operationBranchMembers().filter((member) => {
    const status = memberListStatus(member);
    return ["active", "expiring", "pending"].includes(status) || memberRemainingCount(member) > 0;
  });
}

function ticketBelongsToMember(ticket, memberReference) {
  if (!ticket || !memberReference) return false;
  const memberRecords = memberRecordsForReference(memberReference);
  const memberUserIds = [...new Set(memberRecords.flatMap(memberServerUserIds))];
  const participantUserIds = ticketParticipantUserIds(ticket);
  if (memberUserIds.length && participantUserIds.length) {
    return participantUserIds.some((userId) => memberUserIds.includes(userId));
  }
  const memberNames = memberRecords.length
    ? memberRecords.map((member) => member.name)
    : splitMemberNames(memberReference);
  const participantNames = ticketParticipantNames(ticket);
  return participantNames.some((name) => memberNames.includes(name));
}

function ticketsForMember(memberReference) {
  const memberKey = memberReference && typeof memberReference === "object"
    ? String(memberReference.serverUserId || memberReference.id || memberReference.name || "")
    : String(memberReference || "");
  const branchKey = activeOperationBranchId();
  const cacheKey = `current|${branchKey}|${memberKey}`;
  const cached = memberKey ? memberTicketsIndex.get(cacheKey) : null;
  if (cached) return cached;
  const matches = operationBranchTickets()
    .filter((ticket) => ticketBelongsToMember(ticket, memberReference))
    .sort((left, right) => ticketPriorityForMember(right, memberReference) - ticketPriorityForMember(left, memberReference));
  if (memberKey) memberTicketsIndex.set(cacheKey, matches);
  return matches;
}

function normalizeMemberManagementPaymentPayload(payload = null) {
  if (!payload) return payload;
  const inferredState = memberPaymentRecordState({
    payment_record_state: payload.paymentRecordState,
    payment_recorded_on: payload.paymentDate,
    payment_method: payload.paymentMethod,
    payment_amount: payload.paymentAmount,
  });
  payload.paymentRecordState = inferredState;
  if (inferredState === "transfer_zero") {
    payload.paymentAmount = 0;
    payload.paymentMethod = "membership_transfer";
  } else if (inferredState === "unentered") {
    payload.paymentDate = null;
    payload.paymentMethod = null;
    payload.paymentAmount = 0;
  }
  return payload;
}

function normalizedMemberSearchText(member) {
  const memberId = String(member?.serverUserId || member?.id || "");
  const cached = memberSearchIndex.get(memberId);
  if (cached) return cached;
  const value = memberSearchValues(member)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .join("\n");
  memberSearchIndex.set(memberId, value);
  return value;
}

function dedupeMembersByLessonUnit(memberList) {
  const units = new Map();
  memberList.forEach((member) => {
    const key = memberDirectoryUnitKey(member);
    const current = units.get(key);
    const ticket = memberCurrentTicket(member);
    const isTicketOwner = memberServerUserIds(member).includes(ticket?.serverUserId);
    if (!current || isTicketOwner) units.set(key, member);
  });
  return [...units.values()];
}

function manualMemberPartnerOptions(form = null) {
  const local = (adminLiveDataState.users || []).filter(manualMemberPartnerLocalEligibility);
  const remoteState = form ? manualMemberPartnerSearchState.get(form) : null;
  const remote = (remoteState?.candidates || []).filter((candidate) => candidate.eligible === true);
  return [...new Map([...local, ...remote].map((user) => [String(user.id || ""), user])).values()]
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function touchMemberAdminEditSession() {
  if (!memberAdminEditEnabled) return;
  if (Date.now() >= memberAdminEditExpiresAt) {
    setMemberAdminEditEnabled(false);
    showToast("개인정보 보호를 위해 회원표 편집이 자동 잠금되었습니다.");
    return;
  }
  memberAdminEditExpiresAt = Date.now() + memberAdminEditTimeoutMs;
}

function latestMemberPayment(member) {
  const record = memberManagementTickets(member)
    .map((ticket) => memberDatabaseRecord(member, ticket))
    .filter((item) => item && (item.payment_recorded_on || item.payment_method || Number(item.payment_amount) > 0))
    .sort((left, right) => String(right.payment_recorded_on || "").localeCompare(String(left.payment_recorded_on || "")))[0] || null;
  if (record) {
    return {
      memberDatabaseRecord: true,
      paidAt: record.payment_recorded_on || "",
      method: record.payment_method || "",
      amount: record.payment_amount ?? 0,
      finalAmount: record.payment_amount ?? 0,
    };
  }
  const rows = billings.filter((billing) => {
    const matchesMember = member.serverUserId && billing.serverUserId
      ? member.serverUserId === billing.serverUserId
      : billing.member === member.name;
    return matchesMember && !["draft", "failed"].includes(billing.status);
  });
  const liveRows = rows.filter((billing) => billing.environment !== "테스트");
  return (liveRows.length ? liveRows : rows)
    .sort((left, right) => {
      const leftAt = new Date(left.paidAt || left.verifiedAt || left.requestedAt || 0).getTime() || 0;
      const rightAt = new Date(right.paidAt || right.verifiedAt || right.requestedAt || 0).getTime() || 0;
      return rightAt - leftAt;
    })[0] || null;
}

function selectedMemberIdSet() {
  return new Set((state.selectedMemberIds || []).map(Number));
}

function scheduleLessonMatchesMemberSearch(lesson) {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword) return true;
  return normalizedScheduleMemberSearch(getLessonMembersLabel(lesson)).includes(keyword);
}

function scheduleMemberSearchMatches() {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword) return [];
  return operationBranchLessons()
    .filter((lesson) => lesson.status !== "cancelled" && scheduleLessonMatchesMemberSearch(lesson))
    .sort((left, right) => `${left.lessonDate || "9999-12-31"} ${left.time || ""}`.localeCompare(`${right.lessonDate || "9999-12-31"} ${right.time || ""}`));
}

function autoJumpToExactScheduleMember() {
  const keyword = normalizedScheduleMemberSearch(state.scheduleMemberSearch);
  if (!keyword || keyword === state.scheduleSearchLastAutoJump) return;
  const exactMatches = scheduleMemberSearchMatches().filter((lesson) => (
    splitMemberNames(getLessonMembersLabel(lesson))
      .some((name) => normalizedScheduleMemberSearch(name) === keyword)
  ));
  if (!exactMatches.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const target = exactMatches.find((lesson) => lessonMatchesActiveScheduleWeek(lesson, lesson.day))
    || exactMatches.find((lesson) => !lesson.lessonDate || lesson.lessonDate >= today)
    || exactMatches[exactMatches.length - 1];
  state.scheduleSearchLastAutoJump = keyword;
  jumpToScheduleSearchResult(target.lessonDate, target.day, target.id);
}

function getSelectableMembers(search = "") {
  const keyword = search.trim().toLowerCase();
  const matchingMembers = members.filter((member) => {
    const status = memberListStatus(member);
    const usableOnSelectedDate = allTicketsForMember(member)
      .some((ticket) => ticket.remaining > 0 && lessonTicketCanBeSelected(ticket));
    if (!adminManualOverrideEnabled() && status === "inactive") return false;
    if (!adminManualOverrideEnabled() && status === "expired" && !usableOnSelectedDate) return false;
    return !keyword || memberSearchValues(member)
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  return dedupeMembersByLessonUnit(matchingMembers);
}

function getMemberOptionLabel(member) {
  const ticket = getActiveTicketForMember(member);
  if (!ticket) return `${member.name} · 회원권 없음`;
  const displayName = memberDirectoryDisplayName(member, ticket);
  return `${displayName} · ${getTicketDisplayProduct(ticket)} · 총 ${ticket.total}회 · 잔여 ${ticket.remaining}회`;
}

function getEditingLessonMemberName(lesson) {
  if (!lesson) return "";
  const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
    ? lesson.serverParticipantUserIds.filter(Boolean)
    : [];
  const participantNames = getLessonParticipantNames(lesson);
  const currentTicket = getTicketByLesson(lesson);
  const matchingMembers = members.filter((member) => {
    const matchesParticipantId = participantUserIds.length
      && memberServerUserIds(member).some((userId) => participantUserIds.includes(userId));
    const matchesParticipantName = participantNames.includes(member.name);
    return (matchesParticipantId || matchesParticipantName)
      && (!currentTicket || ticketBelongsToMember(currentTicket, member));
  });
  const ticketOwner = matchingMembers.find((member) => memberServerUserIds(member).includes(currentTicket?.serverUserId));
  return ticketOwner?.name
    || matchingMembers[0]?.name
    || participantNames.find((name) => members.some((member) => member.name === name))
    || "";
}

function ticketReviewMember(userId) {
  const normalizedUserId = String(userId || "");
  if (!normalizedUserId) return null;
  return operationBranchMembers().find((member) => (
    memberServerUserIds(member).some((memberUserId) => String(memberUserId) === normalizedUserId)
  )) || null;
}
