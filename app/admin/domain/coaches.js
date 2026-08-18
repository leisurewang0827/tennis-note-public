// 코치(coach) 값 판정·표시 문구를 만드는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachBlocksFromAvailability(rows = [], type = "available", allScheduleDays = scheduleDays) {
  const grouped = new Map();
  rows.filter((item) => item.availability_type === type).forEach((item) => {
    const start = String(item.start_time || "").slice(0, 5);
    const end = String(item.end_time || "").slice(0, 5);
    const label = item.note || (type === "blocked" ? "브레이크" : "근무");
    const key = `${start}|${end}|${label}`;
    const group = grouped.get(key) || { id: item.id, days: [], start, end, label };
    const day = dayLabelForPostgres(item.day_of_week);
    if (day && !group.days.includes(day)) group.days.push(day);
    grouped.set(key, group);
  });
  return [...grouped.values()].map((block) => ({
    ...block,
    days: allScheduleDays.filter((day) => block.days.includes(day)),
  }));
}

function getCoachAvailabilityLabel(coachId, allCoaches = coaches) {
  const labels = {
    full: "하루종일",
    split: "오전+저녁",
    "weekday-am": "평일 오전",
    "weekday-pm": "평일 오후",
    weekend: "주말 전담",
  };
  const coach = allCoaches.find((item) => item.id === coachId);
  return labels[coach?.availability] || "시간 협의";
}

function getCoachToneClass(coachId) {
  const toneByCoach = {
    "coach-no": "coach-tone-green",
    "coach-kang": "coach-tone-blue",
    "coach-hwang": "coach-tone-amber",
    "coach-machine": "coach-tone-slate",
  };
  return toneByCoach[coachId] || "coach-tone-red";
}

function breakRuleCoachRoleIds(rule = {}) {
  return Array.isArray(rule.coachRoleIds) ? rule.coachRoleIds.filter(Boolean) : [];
}

function breakRuleAppliesToCoach(rule, coachId = "", allCoaches = coaches) {
  const targetRoleIds = breakRuleCoachRoleIds(rule);
  if (!targetRoleIds.length || !coachId) return true;
  const coach = allCoaches.find((item) => item.id === coachId || item.serverRoleId === coachId);
  return targetRoleIds.includes(coach?.serverRoleId || coachId);
}

function breakRuleCoachNames(rule = {}, allCoaches = coaches) {
  const targetRoleIds = breakRuleCoachRoleIds(rule);
  if (!targetRoleIds.length) return "전체 코치";
  return targetRoleIds.map((roleId) => {
    const coach = allCoaches.find((item) => item.serverRoleId === roleId || item.id === roleId);
    return String(coach?.name || "코치").replace(/\s*코치$/, "");
  }).join(", ");
}

function lessonScheduleCoachLabel(lesson = {}) {
  const scheduleCoachId = lessonScheduleCoachId(lesson);
  const actualCoachId = lesson.coachId || "";
  if (scheduleCoachId && actualCoachId && scheduleCoachId !== actualCoachId) {
    return `대타 ${scheduleCoachDisplayName(getCoachName(actualCoachId))}`;
  }
  return scheduleCoachDisplayName(getCoachName(scheduleCoachId));
}

function normalizedCoachLinkName(value = "") {
  return String(value || "")
    .trim()
    .replace(/(?:코치|coach)\s*$/iu, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function scheduleSheetCoachOptions(allLiveData = adminLiveDataState) {
  const roleCoaches = (allLiveData.coachRoles || [])
    .filter((role) => role?.id)
    .map((role) => ({
      id: role.id,
      name: role.display_name || role.name || role.coach_name || "",
    }));
  return [...coaches, ...roleCoaches]
    .filter((coach) => coach?.id)
    .map((coach) => ({
      id: String(coach.id),
      name: normalizeScheduleSheetCell(coach.name || coach.display_name),
    }));
}

function findScheduleSheetCoach(value) {
  const token = normalizeScheduleSheetCell(value).replace(/\s+/g, "");
  if (!token) return null;
  return scheduleSheetCoachOptions().find((coach) => {
    const name = normalizeScheduleSheetCell(coach.name).replace(/\s+/g, "");
    return name === token || name.replace(/코치$/u, "") === token.replace(/코치$/u, "");
  }) || null;
}

function scheduleSheetCoachField(row, index) {
  const options = scheduleSheetCoachOptions().map((coach) => ({ value: coach.id, label: scheduleCoachDisplayName(coach.name) }));
  return `<select data-schedule-sheet-field="coachId" data-row-index="${index}" aria-label="코치">
    <option value="">코치</option>
    ${scheduleSheetSelectOptions(options, row.coachId)}
  </select>`;
}

function renderCoachLaneClosedCard(coach, label = "근무외", detail = "") {
  return `
    <div class="coach-lane-card unavailable is-closed" data-coach-lane="${coach.id}" aria-label="${escapeHtml(getCoachName(coach.id))} ${escapeHtml(label)} ${escapeHtml(detail)}"></div>`;
}

function coachNameForRoleId(roleId = "", allCoaches = coaches) {
  return allCoaches.find((coach) => coach.serverRoleId === roleId || coach.id === roleId)?.name || "코치";
}

function recordCoachId(source = {}, context = null, allMembers = members) {
  if (source.coachId) return source.coachId;
  const memberNames = String(source.member || "").split("&").map((name) => name.trim()).filter(Boolean);
  if (!memberNames.length) return "";
  if (context) {
    for (const name of memberNames) {
      const ticketCoachId = context.ticketCoachByMember.get(name);
      if (ticketCoachId) return ticketCoachId;
    }
    for (const name of memberNames) {
      const memberCoachId = context.memberCoachByName.get(name);
      if (memberCoachId) return memberCoachId;
    }
    return "";
  }
  const memberTicket = [...tickets, ...expiredTickets].find((ticket) => (
    String(ticket.member || "").split("&").some((name) => memberNames.includes(name.trim()))
  ));
  if (memberTicket?.coachId) return memberTicket.coachId;
  return allMembers.find((member) => memberNames.includes(member.name))?.coachId || "";
}

function withRecordCoach(record, source = record, context = null) {
  const coachId = recordCoachId(source, context);
  return {
    ...record,
    coachId,
    coachName: coachId ? getCoachName(coachId) : "미배정",
  };
}

function preferredLocalCoachId(displayName = "") {
  const value = displayName.trim().toLowerCase().replace(/\s+/g, " ");
  if (value.includes("노황규") || value.includes("노 코치") || value === "no coach" || value === "coach no") return "coach-no";
  if (value.includes("강정훈") || value.includes("강 코치") || value === "kang coach" || value === "coach kang") return "coach-kang";
  if (value.includes("황유미") || value.includes("황 코치") || value === "hwang coach" || value === "coach hwang") return "coach-hwang";
  if (value.includes("박창준") || value === "park coach" || value === "coach park") return "coach-park";
  return "";
}

function mergeServerCoachRole(role, index, allCoaches = coaches) {
  const preferredId = preferredLocalCoachId(role.display_name || "");
  let coach = allCoaches.find((item) => item.serverRoleId === role.id)
    || allCoaches.find((item) => preferredId && item.id === preferredId)
    || allCoaches.find((item) => item.name === role.display_name);
  if (!coach) {
    const availabilityByCoach = {
      "coach-no": "split",
      "coach-kang": "weekday-pm",
      "coach-hwang": "weekday-am",
      "coach-park": "weekend",
    };
    coach = {
      id: preferredId || `coach-live-${index + 1}`,
      name: role.display_name || `코치 ${index + 1}`,
      role: "레슨",
      status: "active",
      account: "Supabase 연결",
      coachMode: "approved",
      availability: availabilityByCoach[preferredId] || "full",
      photoUrl: "",
    };
    allCoaches.push(coach);
  }
  Object.assign(coach, {
    serverRoleId: role.id,
    branchId: role.branch_id,
    status: role.status === "approved" ? "active" : "inactive",
    coachMode: role.status === "approved" ? "approved" : "disabled",
    color: role.color || coach.color || "",
    settlementType: role.settlement_type || "ratio",
    settlementRate: Number(role.settlement_rate) || 0,
    hourlyRate: Number(role.hourly_rate) || 0,
    availabilityRevision: Number(role.availability_revision) || 0,
    scheduleLaneOrder: Number.isFinite(Number(role.schedule_lane_order)) ? Number(role.schedule_lane_order) : 1000 + index,
  });
  return coach;
}

function knownCoachNamesForImport(allCoaches = coaches) {
  return allCoaches.map((coach) => coach.name).filter(Boolean);
}

function coachModeLabel(coach) {
  const mode = coach.coachMode || "pending";
  if (mode === "approved") return "사용 중";
  if (mode === "disabled") return "사용 중지";
  return "등록 확인";
}

function coachModeTone(coach) {
  const mode = coach.coachMode || "pending";
  if (mode === "approved") return "good";
  if (mode === "disabled") return "danger";
  return "warn";
}

function coachSignupLabel(coach) {
  return coach.accountLinked ? "회원가입 완료" : "회원가입 전";
}

function coachSignupTone(coach) {
  return coach.accountLinked ? "good" : "neutral";
}

function coachApprovalLabel(coach) {
  const status = coach.approvalStatus || coach.coachMode || "pending";
  if (status === "approved" || status === "active") return "코치 승인 완료";
  if (status === "disabled" || status === "inactive") return "코치 사용 중지";
  return "코치 승인 대기";
}

function coachApprovalTone(coach) {
  const status = coach.approvalStatus || coach.coachMode || "pending";
  if (status === "approved" || status === "active") return "good";
  if (status === "disabled" || status === "inactive") return "danger";
  return "warn";
}

function coachAccountDetail(coach) {
  if (!coach.accountLinked) return "가입 후 같은 휴대전화 번호로 자동 연결됩니다.";
  const providerLabels = {
    kakao: "카카오",
    "custom:kakao": "카카오",
    naver: "네이버",
    "custom:naver": "네이버",
    apple: "Apple",
    email: "이메일",
  };
  const providers = (coach.authProviders || []).map((provider) => providerLabels[provider] || "소셜");
  return providers.length ? `${providers.join(", ")} 로그인 연결` : "로그인 계정 연결 완료";
}

function coachEmploymentLabel(coach) {
  if (coach.employmentStatus === "archived") return "보관";
  if (coach.employmentStatus === "ended") return "근무 종료";
  return "근무 중";
}

function coachBlockListMarkup(blocks, type) {
  const title = type === "break" ? "브레이크" : "근무";
  return blocks.length
    ? blocks.map((block) => `
      <div class="coach-staff-block-row">
        <div>
          <strong>${escapeHtml(block.days.join("·"))} ${escapeHtml(block.start)}~${escapeHtml(block.end)}</strong>
          <span>${escapeHtml(block.label || title)}</span>
        </div>
        <div class="coach-staff-block-actions">
          <button class="small-button" type="button" data-edit-coach-staff-block="${escapeHtml(block.id)}" data-coach-staff-block-type="${type}">수정</button>
          <button class="icon-button" type="button" aria-label="${title} 삭제" title="${title} 삭제" data-remove-coach-staff-block="${escapeHtml(block.id)}" data-coach-staff-block-type="${type}">×</button>
        </div>
      </div>`).join("")
    : `<p class="empty-text">등록된 ${title} 시간이 없습니다.</p>`;
}

function coachStaffEditingBlock(type, allCoachStaffEditorState = coachStaffEditorState) {
  if (allCoachStaffEditorState.editingBlockType !== type || !allCoachStaffEditorState.editingBlockId) return null;
  const blocks = type === "break"
    ? allCoachStaffEditorState.draft?.breakBlocks
    : allCoachStaffEditorState.draft?.workBlocks;
  return blocks?.find((block) => block.id === allCoachStaffEditorState.editingBlockId) || null;
}

function coachStaffDayInputs(type, selectedDays = [], allScheduleDays = scheduleDays) {
  return allScheduleDays.map((day) => `
    <label><input type="checkbox" value="${day}" data-coach-staff-${type}-day ${selectedDays.includes(day) ? "checked" : ""} />${day}</label>`).join("");
}

function renderCoachStaffBasicTab(draft, allCoachStaffEditorState = coachStaffEditorState) {
  return `
    <div class="coach-staff-form-grid">
      <label class="form-field"><span>이름</span><input id="coachStaffName" value="${escapeHtml(draft.name)}" maxlength="40" required /></label>
      <label class="form-field"><span>휴대전화</span><input id="coachStaffPhone" value="${escapeHtml(draft.phone)}" inputmode="tel" placeholder="010-0000-0000" ${allCoachStaffEditorState.mode === "create" ? "required" : ""} /></label>
      <label class="form-field"><span>직책</span><input id="coachStaffJobTitle" value="${escapeHtml(draft.jobTitle)}" maxlength="40" /></label>
      <label class="form-field"><span>코치 승인</span>
        <select id="coachStaffApprovalStatus">
          <option value="pending" ${draft.approvalStatus === "pending" ? "selected" : ""}>승인 대기</option>
          <option value="approved" ${draft.approvalStatus === "approved" ? "selected" : ""}>승인</option>
          <option value="disabled" ${draft.approvalStatus === "disabled" ? "selected" : ""}>사용 중지</option>
        </select>
      </label>
      <label class="form-field"><span>근무 시작일</span><input id="coachStaffEmploymentStartedOn" type="date" value="${escapeHtml(draft.employmentStartedOn)}" /></label>
      <label class="form-field"><span>표시 색상</span><input id="coachStaffColor" type="color" value="${escapeHtml(draft.color)}" /></label>
      <label class="form-field coach-staff-wide"><span>소개</span><textarea id="coachStaffBio" rows="3" maxlength="500">${escapeHtml(draft.bio)}</textarea></label>
    </div>
    <div class="coach-staff-account-summary">
      <strong>${draft.accountLinked ? "계정 연결 완료" : "계정 연결 전"}</strong>
      <span>${escapeHtml(draft.accountDetail)}</span>
    </div>`;
}

function renderCoachStaffWorkTab(draft) {
  const editingWork = coachStaffEditingBlock("work");
  const editingBreak = coachStaffEditingBlock("break");
  return `
    <section class="coach-staff-block-section">
      <h3>근무시간</h3>
      <div class="coach-staff-block-list">${coachBlockListMarkup(draft.workBlocks, "work")}</div>
      <div class="coach-staff-block-add">
        <div class="coach-day-grid compact">${coachStaffDayInputs("work", editingWork?.days || [])}</div>
        <label><span>시작</span><input id="coachStaffWorkStart" type="time" step="600" value="${escapeHtml(editingWork?.start || "06:40")}" /></label>
        <label><span>종료</span><input id="coachStaffWorkEnd" type="time" step="600" value="${escapeHtml(editingWork?.end || "07:00")}" /></label>
        <label><span>표시명</span><input id="coachStaffWorkLabel" value="${escapeHtml(editingWork?.label || "근무")}" maxlength="30" /></label>
        <button class="small-button" type="button" data-add-coach-staff-block="work">${editingWork ? "수정 적용" : "근무 추가"}</button>
        ${editingWork ? '<button class="small-button is-muted" type="button" data-cancel-coach-staff-block="work">취소</button>' : ""}
      </div>
    </section>
    <section class="coach-staff-block-section is-break">
      <h3>브레이크</h3>
      <div class="coach-staff-block-list">${coachBlockListMarkup(draft.breakBlocks, "break")}</div>
      <div class="coach-staff-block-add">
        <div class="coach-day-grid compact">${coachStaffDayInputs("break", editingBreak?.days || [])}</div>
        <label><span>시작</span><input id="coachStaffBreakStart" type="time" step="600" value="${escapeHtml(editingBreak?.start || "13:00")}" /></label>
        <label><span>종료</span><input id="coachStaffBreakEnd" type="time" step="600" value="${escapeHtml(editingBreak?.end || "13:20")}" /></label>
        <label><span>표시명</span><input id="coachStaffBreakLabel" value="${escapeHtml(editingBreak?.label || "브레이크")}" maxlength="30" /></label>
        <button class="small-button" type="button" data-add-coach-staff-block="break">${editingBreak ? "수정 적용" : "브레이크 추가"}</button>
        ${editingBreak ? '<button class="small-button is-muted" type="button" data-cancel-coach-staff-block="break">취소</button>' : ""}
      </div>
    </section>`;
}

function renderCoachStaffSettlementTab(draft) {
  const settlement = draft.settlement;
  const ratio = settlement.method === "ratio";
  return `
    <div class="coach-staff-form-grid">
      <label class="form-field"><span>정산 방식</span>
        <select id="coachStaffSettlementMethod">
          <option value="ratio" ${ratio ? "selected" : ""}>비율</option>
          <option value="hourly" ${!ratio ? "selected" : ""}>시급</option>
        </select>
      </label>
      <label class="form-field ${ratio ? "" : "is-hidden"}" data-settlement-mode-field="ratio"><span>코치 비율(%)</span><input id="coachStaffSettlementRatio" type="number" min="0" max="100" step="1" value="${settlement.ratio}" /></label>
      <label class="form-field ${ratio ? "is-hidden" : ""}" data-settlement-mode-field="hourly"><span>시급</span><input id="coachStaffSettlementHourly" type="number" min="0" step="1000" value="${settlement.hourly}" /></label>
      <label class="form-field"><span>정산 기준</span>
        <select id="coachStaffSettlementBasis">
          <option value="cash_ex_vat" ${settlement.basis === "cash_ex_vat" ? "selected" : ""}>현금가·부가세 제외</option>
          <option value="actual_paid_inc_vat" ${settlement.basis === "actual_paid_inc_vat" ? "selected" : ""}>실제 결제금액</option>
        </select>
      </label>
      <label class="form-field"><span>대타 기준</span>
        <select id="coachStaffSettlementSubstitute">
          <option value="actualCoach" ${settlement.substitute === "actualCoach" ? "selected" : ""}>실제 진행 코치</option>
          <option value="originalCoach" ${settlement.substitute === "originalCoach" ? "selected" : ""}>담당 코치</option>
          <option value="manual" ${settlement.substitute === "manual" ? "selected" : ""}>관리자 확인</option>
        </select>
      </label>
      <label class="form-field"><span>적용일</span><input id="coachStaffSettlementEffectiveFrom" type="date" value="${escapeHtml(settlement.effectiveFrom)}" required /></label>
    </div>
    <p class="coach-staff-inline-note">적용일 이전에 확정된 정산은 바뀌지 않습니다.</p>`;
}

function coachStaffPayload(draft) {
  const availabilityBlocks = [
    ...draft.workBlocks.map((block) => ({
      days: block.days.map(postgresDayOfWeek).filter(Number.isInteger),
      startTime: block.start,
      endTime: block.end,
      label: block.label || "근무",
      availabilityType: "available",
    })),
    ...draft.breakBlocks.map((block) => ({
      days: block.days.map(postgresDayOfWeek).filter(Number.isInteger),
      startTime: block.start,
      endTime: block.end,
      label: block.label || "브레이크",
      availabilityType: "blocked",
    })),
  ];
  return {
    coachRoleId: draft.coachRoleId || null,
    branchId: draft.branchId || null,
    name: draft.name,
    phone: draft.phone,
    jobTitle: draft.jobTitle,
    bio: draft.bio,
    color: draft.color,
    approvalStatus: draft.approvalStatus,
    employmentStatus: draft.employmentStatus,
    employmentStartedOn: draft.employmentStartedOn || null,
    employmentEndedOn: draft.employmentEndedOn || null,
    availabilityBlocks,
    settlement: {
      method: draft.settlement.method,
      ratio: draft.settlement.method === "ratio" ? draft.settlement.ratio / 100 : null,
      hourly: draft.settlement.method === "hourly" ? draft.settlement.hourly : null,
      basis: draft.settlement.basis,
      substitute: draft.settlement.substitute,
      effectiveFrom: draft.settlement.effectiveFrom,
    },
  };
}

function coachBlockSignature(blocks = []) {
  return blocks
    .flatMap((block) => (block.days || []).map((day) => `${day}|${block.start}|${block.end}|${block.label || ""}`))
    .sort()
    .join(";");
}

function sameCoachRoleSet(left = [], right = []) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right.map(String));
  return left.every((roleId) => rightSet.has(String(roleId)));
}

function coachWorksAtPreviewTime(coach, day, time) {
  const minute = timeToMinutes(time);
  return (coach.workBlocks || []).some((block) => (
    Array.isArray(block.days)
    && block.days.includes(day)
    && minute >= timeToMinutes(block.start)
    && minute < timeToMinutes(block.end)
  ));
}
