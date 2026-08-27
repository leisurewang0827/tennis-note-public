// 시간표 관련해 관리자가 누른 것을 처리하는 함수들.
//
// 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function liveSchedulePolicyRevisionIsCurrent() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  const rows = await client.selectRows("tn_admin_settings", {
    select: "key,updated_at",
    filters: { key: liveSchedulePolicyKey },
    limit: 1,
  });
  if (!rows?.length) return !liveSchedulePolicyServerUpdatedAt;
  if (!liveSchedulePolicyServerUpdatedAt) return false;
  return String(rows[0].updated_at || "") === String(liveSchedulePolicyServerUpdatedAt);
}

async function recoverLiveSchedulePolicySave(status, rollback) {
  if (status === "server") return true;
  if (typeof rollback === "function") rollback();
  if (status === "conflict") await loadLiveSchedulePolicyFromServer();
  saveSnapshot();
  renderAll();
  showToast(status === "conflict"
    ? "다른 화면에서 설정이 변경되어 최신 내용을 다시 불러왔습니다."
    : "서버 저장에 실패해 이전 설정으로 되돌렸습니다.");
  return false;
}

async function saveLiveSchedulePolicy() {
  const client = window.TennisNoteDataClient;
  const button = $("#saveLiveSchedulePolicyButton");
  if (!adminApprovalReady() || !client?.rpc) {
    showToast("관리자 로그인 후 근무·브레이크를 저장할 수 있습니다.");
    return;
  }
  const branchId = activeOperationBranchId();
  if (!branchId) {
    showToast("운영 프로필에서 지점을 먼저 선택해주세요.");
    return;
  }
  const serverCoaches = operationBranchCoaches().filter((coach) => (
    coach.serverRoleId && String(coach.branchId || "") === branchId
  ));
  if (!serverCoaches.length) {
    showToast(`${activeOperationBranchName()}에 등록된 코치를 먼저 확인해주세요.`);
    return;
  }
  try {
    if (!(await liveSchedulePolicyRevisionIsCurrent())) {
      await loadLiveSchedulePolicyFromServer();
      renderAll();
      saveSnapshot();
      showToast("다른 화면에서 설정이 변경되어 최신 내용을 다시 불러왔습니다.");
      return;
    }
  } catch (error) {
    showToast("최신 운영 설정을 확인하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.");
    return;
  }
  const targetCoaches = serverCoaches.map((coach) => {
    const targetedBreaks = (scheduleSettings.breakRules || [])
      .filter((rule) => breakRuleCoachRoleIds(rule).includes(coach.serverRoleId))
      .map((rule) => ({
        days: (rule.days || []).map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: rule.start,
        endTime: rule.end,
        label: rule.label || "브레이크",
        availabilityType: "blocked",
      }));
    const blocks = (coach.status || "active") === "active" ? [
      ...normalizeCoachWorkBlocks(coach).map((block) => ({
        days: block.days.map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: block.start,
        endTime: block.end,
        label: block.label || "근무",
        availabilityType: "available",
      })),
      ...normalizeCoachBreakBlocks(coach).map((block) => ({
        days: block.days.map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
        startTime: block.start,
        endTime: block.end,
        label: block.label || "브레이크",
        availabilityType: "blocked",
      })),
      ...targetedBreaks,
    ] : [];
    const uniqueBlocks = [...new Map(blocks.map((block) => [`${block.availabilityType}|${block.days.join(",")}|${block.startTime}|${block.endTime}|${block.label}`, block])).values()];
    return { coachRoleId: coach.serverRoleId, workBlocks: uniqueBlocks };
  });
  const targetBreakRules = (scheduleSettings.breakRules || []).filter((rule) => !breakRuleCoachRoleIds(rule).length).map((rule) => ({
    days: (rule.days || []).map(postgresDayOfWeek).filter((day) => Number.isInteger(day)),
    startTime: rule.start,
    endTime: rule.end,
    label: rule.label || "브레이크타임",
  }));

  if (button) {
    button.disabled = true;
    button.textContent = "저장 중";
  }
  try {
    const result = await client.rpc("tn_admin_replace_schedule_policy", {
      target_branch_id: branchId,
      target_coaches: targetCoaches,
      target_break_rules: targetBreakRules,
    });
    const snapshotStatus = await syncLiveSchedulePolicyToServer();
    if (snapshotStatus === "server" || snapshotStatus === "conflict") {
      await loadLiveSchedulePolicyFromServer();
    }
    renderSchedule();
    renderScheduleSettings();
    saveSnapshot();
    billingLogs.unshift(`근무·브레이크 서버 저장: 근무 ${result?.availabilityCount || 0}개 · 브레이크 ${result?.breakCount || 0}개`);
    if (snapshotStatus === "server") {
      showToast("근무시간과 브레이크 저장 완료");
    } else if (snapshotStatus === "conflict") {
      billingLogs.unshift("다른 화면의 운영 설정과 충돌해 최신 설정을 다시 불러옴");
      showToast("근무시간은 저장됐지만 표시 설정이 충돌해 최신 내용을 다시 불러왔습니다.");
    } else {
      billingLogs.unshift("앱 시간표 표시 설정 동기화 재시도 필요");
      showToast("근무시간은 저장됐습니다. 앱 표시 동기화를 다시 시도해 주세요.");
    }
  } catch (error) {
    showToast(`근무·브레이크 저장 실패: ${error?.payload?.code || error?.message || "server_error"}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "근무·브레이크 저장";
    }
  }
}

async function createLessonPolicy() {
  const policy = normalizeLessonPolicy({
    id: `lesson-policy-${Date.now()}`,
    title: "새 수업 정책",
    detail: "정책 내용을 입력해 주세요.",
    category: "기타",
    status: "active",
  }, lessonPolicies.length);
  lessonPolicies.push(policy);
  state.lessonPolicySearch = "";
  await persistLessonPolicies("새 수업 정책을 추가했습니다");
  window.setTimeout(() => {
    const row = $$('[data-lesson-policy-id]').find((item) => item.dataset.lessonPolicyId === policy.id);
    if (!row) return;
    row.open = true;
    row.querySelector('[data-lesson-policy-field="title"]')?.select();
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 0);
}

async function saveLessonPolicy(policyId) {
  const policy = lessonPolicies.find((item) => item.id === policyId);
  const row = $$('[data-lesson-policy-id]').find((item) => item.dataset.lessonPolicyId === policyId);
  if (!policy || !row) return;
  const field = (name) => row.querySelector(`[data-lesson-policy-field="${name}"]`);
  const title = field("title")?.value.trim() || "";
  const detail = field("detail")?.value.trim() || "";
  if (title.length < 2) {
    showToast("정책명을 2자 이상 입력해 주세요.");
    field("title")?.focus();
    return;
  }
  if (detail.length < 4) {
    showToast("정책 내용을 4자 이상 입력해 주세요.");
    field("detail")?.focus();
    return;
  }
  Object.assign(policy, normalizeLessonPolicy({
    ...policy,
    title,
    detail,
    category: field("category")?.value,
    status: field("status")?.value,
  }, lessonPolicies.indexOf(policy)));
  await persistLessonPolicies("수업 정책을 수정했습니다");
}

async function deleteLessonPolicy(policyId) {
  const policyIndex = lessonPolicies.findIndex((item) => item.id === policyId);
  if (policyIndex < 0) return;
  if (!window.confirm(`'${lessonPolicies[policyIndex].title}' 정책을 삭제할까요?`)) return;
  lessonPolicies.splice(policyIndex, 1);
  await persistLessonPolicies("수업 정책을 삭제했습니다");
}

function applySchedulePreset(preset) {
  const weekdays = scheduleDays.slice(0, 5);
  const weekend = scheduleDays.slice(5);
  if (preset === "weekday-split" || preset === "clubhouse-current") {
    scheduleSettings.openStart = "06:40";
    scheduleSettings.openEnd = "22:00";
    setCoachWorkBlocks("coach-no", [
      { id: "coach-no-weekday-am", days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" },
      { id: "coach-no-weekday-pm", days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" },
    ]);
    setCoachWorkBlocks("coach-hwang", [{ id: "coach-hwang-weekday-am", days: weekdays, start: "06:40", end: "13:00", label: "평일 오전" }]);
    setCoachWorkBlocks("coach-kang", [{ id: "coach-kang-weekday-pm", days: weekdays, start: "17:00", end: "22:00", label: "평일 저녁" }]);
    setCoachWorkBlocks("coach-park", [{ id: "coach-park-weekend", days: weekend, start: "09:00", end: "15:00", label: "주말 탄력 운영" }]);
    scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => rule.id !== "preset-weekday-midday");
    upsertBreakRule("weekday-midday", weekdays, "13:00", "17:00", "수업 없음");
    scheduleSettings.coachWorkPolicyVersion = 2;
    return "현재 운영 시간표 반영 완료";
  }
  if (preset === "evening-buffer") {
    upsertBreakRule("preset-evening-buffer", weekdays, "20:00", "20:20", "상담/정리 브레이크");
    return "20시 20분 브레이크 반영 완료";
  }
  if (preset === "clear-breaks") {
    scheduleSettings.breakRules = [];
    return "브레이크타임 초기화 완료";
  }
  return "시간표 설정을 확인해주세요";
}

function setScheduleOpenSlotSelection(key, selectedValue) {
  const slot = parseScheduleOpenSlotKey(key);
  if (!slot.day || !slot.time || !slot.coachId) return false;
  if (!canAddLessonAt(slot.day, slot.time, 20, slot.coachId)) {
    showToast("수업을 추가할 수 있는 빈 시간만 선택할 수 있습니다.");
    return false;
  }
  const selected = selectedScheduleOpenSlotKeys();
  if (selectedValue) selected.add(key);
  else selected.delete(key);
  state.selectedScheduleOpenSlots = [...selected].map(parseScheduleOpenSlotKey);
  return true;
}

function setScheduleLessonSelection(lessonId, selectedValue) {
  const lesson = lessons.find((item) => String(item.serverLessonId) === String(lessonId));
  if (!scheduleBulkEligible(lesson)) {
    showToast("예정된 실제 수업만 다중 수정할 수 있습니다.");
    return false;
  }
  const selected = selectedScheduleLessonIdSet();
  if (selectedValue) selected.add(String(lessonId));
  else selected.delete(String(lessonId));
  state.selectedScheduleLessonIds = [...selected];
  state.scheduleBulkOperationKey = "";
  const button = document.querySelector(`[data-select-schedule-lesson="${CSS.escape(String(lessonId))}"]`);
  button?.setAttribute("aria-pressed", String(selectedValue));
  return true;
}

function findScheduleSheetTicket(memberName, coachId, lessonSource, durationMinutes, lessonDate = "") {
  return getEligibleTickets(memberName, coachId, lessonDate)
    .filter((ticket) => ticketMatchesLessonSource(ticket, lessonSource))
    .find((ticket) => Number(getTicketDurationMinutes(ticket)) === Number(durationMinutes))
    || getEligibleTickets(memberName, coachId, lessonDate)
      .find((ticket) => ticketMatchesLessonSource(ticket, lessonSource))
    || null;
}

function validateScheduleSheetRows(rows) {
  const seen = new Map();
  return rows.map((row) => {
    const next = { ...row, issues: scheduleSheetBaseIssues(row) };
    const source = normalizeScheduleSheetLessonSource(row.lessonSourceLabel || row.lessonSource);
    const ticket = findScheduleSheetTicket(
      row.memberName,
      row.coachId,
      source,
      row.durationMinutes,
      adminWeekDateForDay(row.day),
    );
    next.lessonSource = source;
    next.ticketId = ticket?.id || "";
    if (!ticket) next.issues.push("회원권 확인");
    else if (!ticketAllowsScheduleDay(ticket, row.day)) next.issues.push("평일/주말 확인");
    const candidate = scheduleSheetRowCandidate(next);
    const duplicateKey = scheduleSheetRowKey(next);
    if (seen.has(duplicateKey)) next.issues.push("붙여넣기 중복");
    else seen.set(duplicateKey, true);
    if (candidate && !adminManualOverrideEnabled()) {
      const conflict = getLessonConflict(candidate);
      if (conflict) next.issues.push("시간 겹침");
      const exactDuplicate = getAdminManualExactDuplicate(candidate);
      if (exactDuplicate) next.issues.push("이미 등록됨");
    }
    next.issues = [...new Set(next.issues)];
    return next;
  });
}

function parseScheduleSheetPaste(text) {
  const rawLines = String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) return [];
  const firstCells = rawLines[0].split(rawLines[0].includes("\t") ? "\t" : ",").map(normalizeScheduleSheetCell);
  const hasHeader = firstCells.some((cell) => ["요일", "시간", "코치", "회원"].includes(cell));
  const lines = hasHeader ? rawLines.slice(1) : rawLines;
  const parsedRows = lines.map((line, index) => {
    const cells = line.split(line.includes("\t") ? "\t" : ",").map(normalizeScheduleSheetCell);
    const [dayCell, timeCell, coachCell, memberCell, sourceCell, minutesCell] = cells;
    const day = normalizeScheduleSheetDay(dayCell);
    const coach = findScheduleSheetCoach(coachCell);
    const source = normalizeScheduleSheetLessonSource(sourceCell);
    const durationMinutes = Number(minutesCell || 20);
    const issues = [];
    if (!day) issues.push("요일 확인");
    if (!/^\d{1,2}:\d{2}$/u.test(timeCell || "")) issues.push("시간 확인");
    if (!coach) issues.push("코치 확인");
    if (!memberCell) issues.push("회원 확인");
    if (![20, 30, 40, 60].includes(durationMinutes)) issues.push("분 확인");
    return {
      rowNumber: index + 1 + (hasHeader ? 1 : 0),
      day,
      time: timeCell || "",
      coachId: coach?.id || "",
      coachName: coach?.name || coachCell || "",
      memberName: memberCell || "",
      lessonSource: source,
      lessonSourceLabel: sourceCell || "정규",
      durationMinutes: [20, 30, 40, 60].includes(durationMinutes) ? durationMinutes : 20,
      issues,
    };
  });
  return validateScheduleSheetRows(parsedRows);
}

function pruneScheduleSheetPasteSelection(rows = state.scheduleSheetPasteRows || []) {
  const available = new Set(rows.map((row, index) => scheduleSheetPasteRowSelectionKey(row, index)));
  state.selectedScheduleSheetPasteRowNumbers = (state.selectedScheduleSheetPasteRowNumbers || [])
    .map(String)
    .filter((rowNumber) => available.has(rowNumber));
}

function toggleScheduleSheetPasteRowSelection(rowNumber, checked) {
  const selected = scheduleSheetPasteSelectedRowSet();
  const key = String(rowNumber || "");
  if (!key) return;
  if (checked) selected.add(key);
  else selected.delete(key);
  state.selectedScheduleSheetPasteRowNumbers = [...selected];
  renderScheduleSheetPastePreview();
}

function selectVisibleScheduleSheetPasteRows() {
  const selected = scheduleSheetPasteSelectedRowSet();
  scheduleSheetPasteVisibleRows().forEach(({ row, index }) => {
    selected.add(scheduleSheetPasteRowSelectionKey(row, index));
  });
  state.selectedScheduleSheetPasteRowNumbers = [...selected];
  renderScheduleSheetPastePreview();
}

function clearScheduleSheetPasteSelection() {
  state.selectedScheduleSheetPasteRowNumbers = [];
  renderScheduleSheetPastePreview();
}

function applyScheduleSheetPasteBulkUpdate() {
  const selected = scheduleSheetPasteSelectedRowSet();
  if (!selected.size) {
    showToast("먼저 적용할 줄을 선택해 주세요.");
    return;
  }
  const coachId = $("#scheduleSheetBulkCoach")?.value || "";
  const lessonSource = $("#scheduleSheetBulkSource")?.value || "";
  const durationMinutes = Number($("#scheduleSheetBulkDuration")?.value || 0);
  if (!coachId && !lessonSource && !durationMinutes) {
    showToast("바꿀 코치, 수업종류 또는 수업시간을 선택해 주세요.");
    return;
  }
  const coach = coachId
    ? scheduleSheetCoachOptions().find((item) => String(item.id) === String(coachId))
    : null;
  const rows = (state.scheduleSheetPasteRows || []).map((row, index) => {
    if (!selected.has(scheduleSheetPasteRowSelectionKey(row, index))) return row;
    const next = { ...row };
    if (coachId) {
      next.coachId = coach?.id || "";
      next.coachName = coach?.name || "";
    }
    if (lessonSource) {
      next.lessonSource = normalizeLessonSource(lessonSource);
      next.lessonSourceLabel = lessonSourceLabel(next.lessonSource);
    }
    if (durationMinutes) next.durationMinutes = durationMinutes;
    return next;
  });
  state.scheduleSheetPasteRows = validateScheduleSheetRows(rows);
  renderScheduleSheetPastePreview();
  showToast(`선택한 ${selected.size}줄을 다시 검증했습니다.`);
}

function updateScheduleSheetPasteRow(index, field, value) {
  const rowIndex = Number(index);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (state.scheduleSheetPasteRows || []).length) return;
  const rows = state.scheduleSheetPasteRows.map((row, currentIndex) => {
    if (currentIndex !== rowIndex) return row;
    const next = { ...row };
    if (field === "durationMinutes") next.durationMinutes = Number(value) || 20;
    else if (field === "coachId") {
      const coach = scheduleSheetCoachOptions().find((item) => String(item.id) === String(value));
      next.coachId = coach?.id || "";
      next.coachName = coach?.name || "";
    } else if (field === "lessonSource") {
      next.lessonSource = normalizeLessonSource(value);
      next.lessonSourceLabel = lessonSourceLabel(next.lessonSource);
    } else {
      next[field] = normalizeScheduleSheetCell(value);
    }
    return next;
  });
  state.scheduleSheetPasteRows = validateScheduleSheetRows(rows);
  renderScheduleSheetPastePreview();
}

function removeScheduleSheetPasteRow(index) {
  const rowIndex = Number(index);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= (state.scheduleSheetPasteRows || []).length) return;
  state.scheduleSheetPasteRows = validateScheduleSheetRows(state.scheduleSheetPasteRows.filter((_, currentIndex) => currentIndex !== rowIndex));
  pruneScheduleSheetPasteSelection();
  renderScheduleSheetPastePreview();
}

function clearScheduleSheetPasteIssueRows() {
  const rows = state.scheduleSheetPasteRows || [];
  const readyRows = rows.filter((row) => !row.issues.length);
  if (readyRows.length === rows.length) return;
  state.scheduleSheetPasteRows = validateScheduleSheetRows(readyRows);
  state.scheduleSheetPasteFilter = "all";
  pruneScheduleSheetPasteSelection();
  renderScheduleSheetPastePreview();
}

function openScheduleSheetPastePanel() {
  state.scheduleSheetPasteOpen = true;
  renderScheduleSheetPastePreview();
  $("#scheduleSheetPasteInput")?.focus();
}

function closeScheduleSheetPastePanel() {
  state.scheduleSheetPasteOpen = false;
  renderScheduleSheetPastePreview();
}

function previewScheduleSheetPaste() {
  const rows = parseScheduleSheetPaste($("#scheduleSheetPasteInput")?.value || "");
  state.scheduleSheetPasteRows = rows;
  state.selectedScheduleSheetPasteRowNumbers = [];
  renderScheduleSheetPastePreview(rows);
}

function clearScheduleSheetPaste() {
  state.scheduleSheetPasteRows = [];
  state.selectedScheduleSheetPasteRowNumbers = [];
  if ($("#scheduleSheetPasteInput")) $("#scheduleSheetPasteInput").value = "";
  renderScheduleSheetPastePreview([]);
}

function groupScheduleSheetCandidates(rows = []) {
  const readyRows = rows.filter((row) => !row.issues.length);
  const grouped = new Map();
  readyRows.forEach((row) => {
    const candidate = scheduleSheetRowCandidate(row);
    if (!candidate) return;
    const key = `${candidate.ticketId}|${candidate.coachId}|${candidate.lessonSource}|${candidate.durationMinutes}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidate);
  });
  return [...grouped.values()];
}

async function submitScheduleSheetPaste() {
  const rows = state.scheduleSheetPasteRows?.length
    ? validateScheduleSheetRows(state.scheduleSheetPasteRows)
    : parseScheduleSheetPaste($("#scheduleSheetPasteInput")?.value || "");
  state.scheduleSheetPasteRows = rows;
  renderScheduleSheetPastePreview(rows);
  const groups = groupScheduleSheetCandidates(rows);
  if (!groups.length) {
    showToast("저장 가능한 줄이 없습니다. 미리보기의 확인 필요 항목을 먼저 고쳐 주세요.");
    return;
  }
  if (!window.confirm(`${groups.reduce((sum, group) => sum + group.length, 0)}개 수업을 서버에 등록할까요?`)) return;
  const saveButton = $("#saveScheduleSheetPaste");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중";
  }
  saveScheduleSafetySnapshot(lessons, "before-sheet-paste-write");
  const savedGroups = [];
  try {
    for (const group of groups) {
      state.lessonOperationKey = createAdminOperationKey("lesson-sheet-paste");
      await saveLiveAdminLessonSet(group);
      savedGroups.push(group);
    }
    const synced = await syncAdminLiveData();
    if (!synced) throw new Error("admin_live_refresh_failed_after_sheet_paste");
    state.scheduleSheetPasteRows = [];
    state.selectedScheduleSheetPasteRowNumbers = [];
    if ($("#scheduleSheetPasteInput")) $("#scheduleSheetPasteInput").value = "";
    renderScheduleSheetPastePreview([]);
    renderAll();
    showToast(`표 붙여넣기 등록 완료 · ${savedGroups.reduce((sum, group) => sum + group.length, 0)}개 수업`);
  } catch (error) {
    await syncAdminLiveData().catch(() => false);
    renderScheduleSheetPastePreview(rows);
    showToast(`표 붙여넣기 저장 실패: ${error?.payload?.message || error?.message || "서버 확인 필요"}`);
  } finally {
    state.lessonOperationKey = "";
    if (saveButton) {
      saveButton.textContent = "확인한 줄 일괄 등록";
      renderScheduleSheetPastePreview(state.scheduleSheetPasteRows);
    }
  }
}

async function submitScheduleBulkShift(minuteDelta) {
  const selected = selectedScheduleLessons();
  if (!selected.length) return;
  if (!window.TennisNoteDataClient?.rpc || !adminApprovalReady()) {
    showToast("관리자 로그인과 서버 연결을 확인해 주세요.");
    return;
  }
  if (!window.confirm(`${selected.length}개 수업을 ${Math.abs(minuteDelta)}분 ${minuteDelta < 0 ? "앞으로" : "뒤로"} 이동할까요?`)) return;
  const expectedRevisions = Object.fromEntries(selected.map((lesson) => [
    String(lesson.serverLessonId),
    lesson.serverRevision ?? null,
  ]));
  if (!state.scheduleBulkOperationKey) {
    state.scheduleBulkOperationKey = createAdminOperationKey("lesson-bulk-shift");
  }
  $$("[data-shift-schedule-lessons]").forEach((button) => {
    button.disabled = true;
  });
  try {
    const result = await window.TennisNoteDataClient.rpc("tn_admin_shift_lessons_guarded", {
      target_lesson_ids: selected.map((lesson) => lesson.serverLessonId),
      target_minute_delta: minuteDelta,
      target_expected_revisions: expectedRevisions,
      target_operation_key: state.scheduleBulkOperationKey,
    });
    await syncAdminLiveData();
    state.selectedScheduleLessonIds = [];
    state.scheduleBulkOperationKey = "";
    state.scheduleBulkMode = false;
    renderAll();
    showToast(`${Number(result?.shiftedCount ?? result?.shifted_count ?? selected.length)}개 수업 시간을 변경했습니다.`);
  } catch (error) {
    const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
    if (raw.includes("lesson_concurrent_update")) {
      await syncAdminLiveData();
      state.selectedScheduleLessonIds = [];
      state.scheduleBulkOperationKey = "";
      renderAll();
    }
    showToast(isMissingRpcError(error, "tn_admin_shift_lessons_guarded")
      ? "운영 DB에 다중 시간 변경 기능을 먼저 적용해야 합니다."
      : scheduleBulkErrorMessage(error));
  } finally {
    renderScheduleBulkToolbar();
  }
}

function applyLessonRepeatSlotDefaults(slots = []) {
  if (!Array.isArray(slots) || slots.length <= 1) return;
  slots.slice(1, 7).forEach((slot, index) => {
    const row = $$(".lesson-repeat-slot")[index];
    if (!row || row.classList.contains("is-disabled")) return;
    const daySelect = row.querySelector("[data-lesson-slot-day]");
    const timeSelect = row.querySelector("[data-lesson-slot-time]");
    if (!daySelect || !timeSelect) return;
    if ([...daySelect.options].some((option) => option.value === slot.day)) {
      daySelect.value = slot.day;
    }
    fillSelect(timeSelect, getTimeOptionsForLessonSlot(daySelect.value));
    if ([...timeSelect.options].some((option) => option.value === slot.time)) {
      timeSelect.value = slot.time;
    }
  });
}

function applySelectedAdminMakeupEntitlement() {
  const entitlement = selectedAdminMakeupEntitlement();
  if (!entitlement) {
    syncMakeupEntitlementIdentityLock();
    return;
  }
  if ([...$("#lessonTicket").options].some((option) => option.value === entitlement.ticketId)) {
    $("#lessonTicket").value = entitlement.ticketId;
  }
  if ([...$("#lessonCoach").options].some((option) => option.value === entitlement.coachId)) {
    $("#lessonCoach").value = entitlement.coachId;
  }
  $("#lessonDuration").value = String(entitlement.durationMinutes);
  syncLessonSourceOptions();
  refreshLessonDurationOptions();
  refreshLessonTimeOptions($("#lessonTime").value);
  renderLessonTicketHint();
}

function setLessonFormMessage(message, tone = "") {
  const target = $("#lessonFormMessage");
  target.textContent = message;
  target.className = `form-message ${tone}`;
}

function setLessonSubmitEnabled(enabled) {
  const button = $("#saveLessonButton");
  if (button) button.disabled = !enabled;
}

function submitLessonFormWithoutNativeValidation() {
  return addLessonFromForm({ preventDefault() {} });
}

async function markEditingLessonAbsentForMakeup() {
  const lesson = lessons.find((item) => item.id === state.editingLessonId);
  const reason = $("#lessonAbsenceReason")?.value.trim() || "";
  if (!lesson?.serverLessonId || lessonStatusValue(lesson) !== "scheduled" || lessonSourceValue(lesson) !== "regular") {
    setLessonFormMessage("예정 상태의 정규수업만 불참 처리할 수 있습니다.", "danger");
    return;
  }
  if (isPastLessonCorrectionMode(getLessonFormCandidate())) {
    const absenceCorrectionMode = document.querySelector('input[name="lessonPastCorrectionMode"][value="absence"]');
    if (absenceCorrectionMode) absenceCorrectionMode.checked = true;
    if (!window.confirm(
      `${lesson.member} ${lesson.day} ${lesson.time} 지난 정규수업을 불참으로 보정할까요?\n\n`
      + "횟수는 차감하지 않고 보강 신청을 열며, 시간표 기록은 불참 상태로 보존합니다.",
    )) return;
    renderLessonPreview();
    await submitLessonFormWithoutNativeValidation();
    return;
  }
  if (reason.length < 2) {
    setLessonFormMessage("불참 사유를 2자 이상 입력해 주세요.", "danger");
    $("#lessonAbsenceReason")?.focus();
    return;
  }
  if (!window.confirm(`${lesson.member} ${lesson.day} ${lesson.time} 정규수업을 불참 처리할까요?\n\n횟수는 지금 차감되지 않습니다. 원래 시간은 보강 전용으로 열리고 회원에게 보강 시간 선택 안내가 전달됩니다.`)) return;
  const button = $("#markLessonAbsentButton");
  if (button) {
    button.disabled = true;
    button.textContent = "처리 중";
  }
  setLessonFormMessage("불참 처리와 보강 대기를 생성하고 있습니다.");
  try {
    await window.TennisNoteDataClient.rpc("tn_mark_lesson_absent_for_makeup", {
      target_lesson_id: lesson.serverLessonId,
      target_reason: reason,
    });
    billingLogs.unshift(`${lesson.member} ${lesson.day} ${lesson.time} 불참 처리 · 보강 선택 대기`);
    lesson.serverStatus = "cancelled";
    lesson.status = "cancelled";
    window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
    closeLessonModal();
    renderSchedule();
    showToast("불참 처리 완료 · 빈자리 공개 및 보강 안내 생성");
    void syncAdminLiveData(true).then((synced) => {
      if (synced && state.view === "schedule") renderSchedule();
    });
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const message = code.includes("absence_reason_required")
      ? "불참 사유를 2자 이상 입력해 주세요."
      : code.includes("absence_lesson_already_started")
        ? "이미 시작한 수업은 사전 불참으로 처리할 수 없습니다."
      : code.includes("absence_lesson_not_scheduled")
        ? "예정 상태가 아닌 수업입니다. 시간표를 새로고침해 주세요."
        : code.includes("absence_regular_lesson_required")
          ? "정규수업만 불참 처리할 수 있습니다."
          : code.includes("absence_coach_or_admin_required")
            ? "관리자 또는 담당 코치만 불참 처리할 수 있습니다."
            : "불참 처리에 실패했습니다. 수업 상태를 다시 확인해 주세요.";
    setLessonFormMessage(message, "danger");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "불참 처리·보강 열기";
    }
  }
}

async function saveLiveAdminLesson(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !branchId || !lessonDate || !participantUserIds.length) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_participant_user_ids: participantUserIds,
    target_update_regular_rule: !editingLesson
      && !state.quickLessonEntry
      && liveLessonSource(candidate) === "regular",
  };
  if (adminManualOverrideEnabled()) {
    return client.rpc("tn_admin_force_save_lesson", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
      target_makeup_entitlement_id: entitlement?.id || null,
    });
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-save");
  }
  return guardedRpcWithFallback(
    "tn_admin_save_lesson_guarded",
    {
      ...payload,
      target_expected_revision: editingLesson?.serverRevision ?? null,
      target_operation_key: state.lessonOperationKey,
    },
    "tn_admin_save_lesson",
    payload,
  );
}

async function saveLiveAdminRegularScheduleAnchor(candidate) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate || !candidate.time) {
    throw new Error("정규수업의 회원권·코치·날짜 연결을 확인해 주세요.");
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("regular-anchor");
  }
  return client.rpc("tn_admin_add_regular_schedule_anchor", {
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_anchor_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    operation_key: state.lessonOperationKey,
  });
}

async function saveLiveAdminRegularLessonSeries(candidate) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!editingLesson?.serverLessonId || !ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate) {
    throw new Error("수정할 정규수업과 회원권·코치 연결을 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson.serverLessonId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_coach_role_id: coach.serverRoleId,
    target_duration_minutes: candidate.durationMinutes,
  };
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-series");
  }
  return guardedRpcWithFallback(
    "tn_admin_reschedule_regular_lesson_series_guarded",
    {
      ...payload,
      target_expected_revision: editingLesson.serverRevision ?? null,
      target_operation_key: state.lessonOperationKey,
    },
    "tn_admin_reschedule_regular_lesson_series",
    payload,
  );
}

async function resetLiveAdminRegularSchedule(candidate) {
  const client = window.TennisNoteDataClient;
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = getCurrentEditingLesson();
  const startDate = $("#lessonResetStartOn")?.value || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!editingLesson?.serverLessonId || !coach?.serverRoleId || !startDate) {
    throw new Error("새 시작일과 정규수업·코치 연결을 확인해 주세요.");
  }
  if (!state.lessonOperationKey) {
    state.lessonOperationKey = createAdminOperationKey("lesson-schedule-reset");
  }
  return client.rpc("tn_admin_reset_regular_schedule_guarded", {
    target_lesson_id: editingLesson.serverLessonId,
    target_lesson_date: startDate,
    target_start_time: candidate.time,
    target_coach_role_id: coach.serverRoleId,
    target_duration_minutes: candidate.durationMinutes,
    target_expected_revision: editingLesson.serverRevision ?? null,
    target_operation_key: state.lessonOperationKey,
  });
}

async function saveLivePastLessonCorrection(candidate, entitlement = null) {
  const client = window.TennisNoteDataClient;
  const ticket = scheduleTicketById(candidate.ticketId);
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const editingLesson = getCurrentEditingLesson();
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  const correctionReason = adminPastCorrectionReason();
  const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인 확인이 필요합니다.");
  }
  if (!ticket?.serverTicketId || !coach?.serverRoleId || !branchId || !lessonDate || !participantUserIds.length) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const payload = {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_coach_comment: coachComment,
    target_correction_reason: correctionReason,
    target_makeup_entitlement_id: entitlement?.id || null,
    target_participant_user_ids: participantUserIds,
  };
  if (adminManualOverrideEnabled()) {
    return client.rpc("tn_admin_force_record_past_lesson", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
    });
  }
  return client.rpc("tn_admin_record_past_lesson", payload);
}

async function saveLiveCompletedLessonCorrection(candidate) {
  const client = window.TennisNoteDataClient;
  const editingLesson = getCurrentEditingLesson();
  const coach = coaches.find((item) => item.id === candidate.coachId);
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인 확인이 필요합니다.");
  }
  if (!editingLesson?.serverLessonId || !coach?.serverRoleId || !lessonDate || !candidate.time) {
    throw new Error("완료 수업·코치·날짜 연결을 확인해 주세요.");
  }
  return client.rpc("tn_admin_correct_completed_lesson", {
    target_lesson_id: editingLesson.serverLessonId,
    target_coach_role_id: coach.serverRoleId,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_duration_minutes: candidate.durationMinutes,
    target_lesson_source: liveLessonSource(candidate),
    target_override_reason: "관리자 완료 수업 정정",
  });
}

async function saveLiveMakeupEntitlement(candidate, entitlement) {
  const client = window.TennisNoteDataClient;
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!entitlement?.id || !lessonDate || !candidate.time) throw new Error("보강 대기와 예약 시간을 확인해 주세요.");
  return client.rpc("tn_book_makeup_entitlement", {
    target_entitlement_id: entitlement.id,
    target_lesson_date: lessonDate,
    target_start_time: candidate.time,
    target_reason: "관리자 수동 보강 예약",
  });
}

async function saveLiveAdminLessonSet(candidates = []) {
  const client = window.TennisNoteDataClient;
  const primary = candidates[0];
  const ticket = scheduleTicketById(primary?.ticketId);
  const coach = coaches.find((item) => item.id === primary?.coachId);
  const participantUserIds = ticket?.participantUserIds || [];
  const branchId = ticket?.branchId || coach?.branchId || "";
  if (!client?.rpc || !adminApprovalReady()) throw new Error("관리자 로그인 확인이 필요합니다.");
  if (!primary || !ticket?.serverTicketId || !coach?.serverRoleId || !branchId) {
    throw new Error("회원권·코치·참여회원의 서버 연결을 먼저 확인해 주세요.");
  }
  const targetSchedules = candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminLessonDateForCandidate(candidate.day),
    startTime: candidate.time,
    durationMinutes: candidate.durationMinutes,
  }));
  if (targetSchedules.some((schedule) => !schedule.lessonDate || !schedule.startTime)) {
    throw new Error("저장할 수업 날짜와 시간을 확인해 주세요.");
  }
  const payload = {
    target_branch_id: branchId,
    target_ticket_id: ticket.serverTicketId,
    target_coach_role_id: coach.serverRoleId,
    target_schedules: targetSchedules,
    target_lesson_source: liveLessonSource(primary),
    target_participant_user_ids: participantUserIds,
  };
  let result;
  if (adminManualOverrideEnabled()) {
    result = await client.rpc("tn_admin_force_save_lesson_set", {
      ...payload,
      target_override_reason: adminManualOverrideReason(),
    });
  } else {
    if (!state.lessonOperationKey) {
      state.lessonOperationKey = createAdminOperationKey("lesson-set");
    }
    result = await guardedRpcWithFallback(
      "tn_admin_save_lesson_set_guarded",
      {
        ...payload,
        target_operation_key: state.lessonOperationKey,
      },
      "tn_admin_save_lesson_set",
      payload,
    );
  }
  const savedCount = Number(result?.scheduleCount || 0);
  if (!result?.ok || savedCount < candidates.length) {
    throw new Error(`live_lesson_write_not_confirmed: 저장 요청 ${savedCount}/${candidates.length}건 확인`);
  }
  return result;
}

async function addLessonFromForm(event) {
  event.preventDefault();
  if (state.lessonWriteInFlight) {
    const writeAge = Date.now() - Number(state.lessonWriteStartedAt || 0);
    if (writeAge < 35_000) {
      setLessonFormMessage("이전 저장을 확인하는 중입니다. 최대 30초 안에 결과를 안내합니다.", "neutral");
      return;
    }
    state.lessonWriteInFlight = false;
    state.lessonWriteStartedAt = 0;
    setLessonSubmitEnabled(true);
    setLessonFormMessage("이전 요청의 응답이 늦어 최신 시간표를 다시 확인합니다. 중복 저장은 서버에서 차단됩니다.", "neutral");
    await syncAdminLiveData(true);
  }
  refreshLessonTicketOptions();
  let candidate = getLessonFormCandidate();
  const pastCorrection = syncPastLessonCorrectionUi(candidate);
  candidate = getLessonFormCandidate();
  const selectedEntitlement = selectedAdminMakeupEntitlement();
  const ticket = scheduleTicketById($("#lessonTicket").value);
  const manualOverride = adminManualOverrideEnabled();
  if (!ticket) {
    setLessonFormMessage("선택한 코치의 회원권이 없어 수업을 추가할 수 없습니다.", "danger");
    return;
  }
  if (isCompletedLessonCorrectionMode()) {
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    const endTimestamp = adminLessonEndTimestamp(candidate);
    if (exactDuplicate) {
      setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있어 중복 저장할 수 없습니다.", "danger");
      return;
    }
    if (!Number.isFinite(endTimestamp) || endTimestamp > Date.now()) {
      setLessonFormMessage("완료 수업은 이미 끝난 날짜와 시간으로만 정정할 수 있습니다.", "danger");
      return;
    }
    const warnings = getAdminManualOverrideWarnings(candidate, ticket, false);
    if (!window.confirm(
      `${getLessonMembersLabel(getCurrentEditingLesson())} 완료 수업을 정정할까요?\n\n`
      + `${candidate.day} ${candidate.time} · ${scheduleCoachDisplayName(getCoachName(candidate.coachId))} · ${candidate.durationMinutes}분\n`
      + `완료 피드백은 유지되고, 회차 차감은 수업시간 차이만큼 자동 조정됩니다.\n`
      + `${warnings.length ? `정책 예외 ${warnings.length}건은 감사 기록에 남습니다.` : "정책 충돌은 없습니다."}`,
    )) return;
    setLessonSubmitEnabled(false);
    setLessonFormMessage("완료 기록과 회원권 회차를 함께 정정하고 있습니다.");
    try {
      const result = await saveLiveCompletedLessonCorrection(candidate);
      const synced = await syncAdminLiveData();
      if (!synced) throw new Error("admin_live_refresh_failed_after_completed_correction");
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      const delta = Number(result?.deductionDelta) || 0;
      showToast(`완료 수업 정정 완료${delta ? ` · 회차 ${delta > 0 ? "+" : ""}${delta}` : " · 회차 유지"}`);
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      const messages = {
        completed_correction_admin_required: "관리자 계정으로만 완료 수업을 정정할 수 있습니다.",
        completed_correction_completed_lesson_required: "완료 상태가 아닌 수업입니다. 시간표를 새로고침해 주세요.",
        completed_correction_record_required: "코치 피드백과 차감 기록을 찾지 못했습니다. 기록/차감 확인에서 먼저 확인해 주세요.",
        completed_correction_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있습니다.",
        completed_correction_future_time: "완료 수업은 이미 끝난 날짜와 시간으로만 정정할 수 있습니다.",
        completed_correction_ticket_balance_insufficient: "수업시간 증가분을 차감할 잔여 횟수가 부족합니다.",
        completed_correction_ticket_count_inconsistent: "회원권 사용 횟수와 완료 기록이 맞지 않아 자동 정정을 중단했습니다.",
        completed_correction_regular_ticket_required: "쿠폰 회원권은 정규수업으로 바꿀 수 없습니다.",
        completed_correction_coupon_ticket_required: "쿠폰수업은 쿠폰 회원권에만 연결할 수 있습니다.",
        admin_live_refresh_failed_after_completed_correction: "정정은 저장됐지만 최신 시간표를 다시 불러오지 못했습니다. 중복 저장하지 말고 새로고침해 주세요.",
      };
      const message = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1]
        || error?.message
        || "완료 수업 정정에 실패했습니다.";
      setLessonFormMessage(message, "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  if (pastCorrection) {
    const correctionReason = adminPastCorrectionReason();
    const coachComment = $("#lessonPastCoachComment")?.value.trim() || "";
    const absenceMode = pastLessonCorrectionMode() === "absence";
    if (absenceMode) {
      const editingLesson = getCurrentEditingLesson();
      const ticket = getSelectedTicket();
      if (editingLesson?.serverLessonId && normalizeLessonSource(editingLesson.lessonSource) !== "regular") {
        setLessonFormMessage("정규수업만 사전 불참으로 보정할 수 있습니다.", "danger");
        return;
      }
      if (!editingLesson?.serverLessonId && (!ticket?.serverTicketId || isCouponLessonTicket(ticket))) {
        setLessonFormMessage("불참 회원의 정규 회원권을 선택해 주세요.", "danger");
        return;
      }
      if (correctionReason.length < 5) {
        setLessonFormMessage("보정 사유를 5자 이상 입력해 주세요.", "danger");
        return;
      }
      if (!consumeAdminActionGrant("past_absence_correction")
        && !requestAdminActionUnlock("past_absence_correction", "지난 수업 사전 불참 보정", submitLessonFormWithoutNativeValidation)) {
        if (adminPinNeedsSetup()) setLessonFormMessage("운영 설정의 보안/잠금에서 관리자 PIN을 먼저 설정해 주세요.", "danger");
        return;
      }
      setLessonSubmitEnabled(false);
      setLessonFormMessage("사전 불참으로 보정하고 횟수와 보강 상태를 확인하고 있습니다.");
      try {
        const result = await saveLivePastLessonAbsenceCorrection();
        const restoredSessions = Number(result?.restoredSessions) || 0;
        const occupyingLessonCount = Number(result?.occupyingLessonCount) || 0;
        window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
        closeLessonModal();
        await syncAdminLiveData();
        setView("schedule");
        const resultParts = ["사전 불참 보정 완료"];
        if (restoredSessions > 0) resultParts.push(`${restoredSessions}회 복원`);
        else resultParts.push("횟수 차감 없음");
        resultParts.push("보강 신청 가능");
        if (occupyingLessonCount > 0) resultParts.push("실제 수업 유지");
        showToast(resultParts.join(" · "));
      } catch (error) {
        const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
        const messages = {
          past_absence_admin_required: "관리자 계정으로만 지난 수업을 보정할 수 있습니다.",
          past_absence_reason_too_short: "보정 사유를 5자 이상 입력해 주세요.",
          past_absence_lesson_not_found: "보정할 지난 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.",
          past_absence_slot_required: "불참 회원권·코치·날짜·시간을 모두 확인해 주세요.",
          past_absence_ticket_missing: "불참 회원의 정규 회원권을 선택해 주세요.",
          past_absence_regular_ticket_required: "쿠폰권이 아닌 정규 회원권을 선택해 주세요.",
          past_absence_duration_invalid: "수업 시간은 20·30·40·60분 중에서 선택해 주세요.",
          past_absence_regular_lesson_required: "정규수업만 사전 불참으로 보정할 수 있습니다.",
          past_absence_lesson_not_started: "아직 시작하지 않은 수업은 일반 불참 처리 기능을 사용해 주세요.",
          past_absence_makeup_already_booked: "이미 이 수업의 보강이 예약되어 있습니다. 보강 예약을 먼저 확인해 주세요.",
          past_absence_status_invalid: "현재 수업 상태는 사전 불참으로 보정할 수 없습니다.",
        };
        const matched = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1];
        setLessonFormMessage(matched || "사전 불참 보정에 실패했습니다. 새로고침 후 다시 시도해 주세요.", "danger");
        setLessonSubmitEnabled(true);
      }
      return;
    }
    const sourceRequiresEntitlement = candidate.lessonSource === "makeup" && !state.editingLessonId;
    const sourceInvalid = !state.editingLessonId && candidate.lessonSource === "regular";
    const conflict = getPastLessonCorrectionConflict(candidate);
    const exactDuplicate = getAdminManualExactDuplicate(candidate);
    if (coachComment.length < 5) {
      setLessonFormMessage("실제 수업 코멘트를 5자 이상 입력해 주세요.", "danger");
      return;
    }
    if (manualOverride) {
      if (exactDuplicate) {
        setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다. 기존 수업을 수정해 주세요.", "danger");
        return;
      }
      const warnings = getAdminManualOverrideWarnings(candidate, ticket, true);
      if (!confirmAdminManualOverride(candidate, warnings)) return;
    } else {
      if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) {
        setLessonFormMessage("선택한 수업 종류에 맞는 회원권이 없습니다.", "danger");
        return;
      }
      if (sourceInvalid) {
        setLessonFormMessage("새 과거 수업은 보강·쿠폰수업 또는 과거수업 보정으로 등록해 주세요.", "danger");
        return;
      }
      if (sourceRequiresEntitlement && !selectedEntitlement) {
        setLessonFormMessage("보강 대기를 선택하거나 수업 종류를 과거수업 보정으로 바꿔 주세요.", "danger");
        return;
      }
      if (conflict) {
        setLessonFormMessage(conflict.message, "danger");
        return;
      }
    }

    setLessonSubmitEnabled(false);
    setLessonFormMessage("과거 수업 완료 기록과 회원권 차감을 함께 반영하고 있습니다.");
    try {
      const result = await saveLivePastLessonCorrection(candidate, selectedEntitlement);
      const deductedSessions = Number(result?.deductedSessions) || 1;
      const remainingSessions = Number(result?.remainingSessions);
      billingLogs.unshift(`${candidate.member} ${candidate.day} ${candidate.time} 과거 수업 보정 · ${deductedSessions}회 차감`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      await syncAdminLiveData();
      showToast(manualOverride
        ? `관리자 강제 처리 완료 · ${deductedSessions}회 차감 · 감사 기록 저장`
        : `과거 수업 반영 완료 · ${deductedSessions}회 차감${Number.isFinite(remainingSessions) ? ` · 잔여 ${remainingSessions}회` : ""}`);
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      const occupiedConflict = errorText.includes("target_time_occupied")
        || errorText.includes("coach_time_occupied")
        || errorText.includes("admin_manual_exact_duplicate");
      if (errorText.includes("lesson_concurrent_update") || occupiedConflict) {
        const conflictDate = candidates?.[0]?.lessonDate || "";
        if (conflictDate) {
          state.activeAdminWeekIndex = Math.min(
            Math.max(adminWeekOffsetForDate(conflictDate), adminScheduleMinWeekOffset),
            adminScheduleMaxWeekOffset,
          );
        }
        await syncAdminLiveData(true);
      }
      const messages = {
        past_lesson_admin_required: "관리자 계정으로만 과거 수업을 보정할 수 있습니다.",
        past_lesson_not_finished: "아직 끝나지 않은 수업은 과거 완료로 처리할 수 없습니다.",
        past_lesson_reason_too_short: "보정 사유를 5자 이상 입력해 주세요.",
        lesson_complete_comment_too_short: "수업 코멘트를 구체적으로 5자 이상 입력해 주세요.",
        lesson_complete_comment_too_generic: "수업 코멘트에 실제 진행 내용과 다음 연습 포인트를 적어 주세요.",
        lesson_complete_comment_recent_duplicate: "최근 코멘트와 같은 내용입니다. 이번 수업 내용을 구체적으로 적어 주세요.",
        past_lesson_duplicate: "같은 회원권·날짜·시간의 수업 기록이 이미 있습니다.",
        past_lesson_coach_time_occupied: "선택한 코치의 기존 수업과 시간이 겹칩니다.",
        past_lesson_date_outside_ticket: "회원권 시작일과 만료일 안의 날짜만 보정할 수 있습니다.",
        past_lesson_ticket_balance_insufficient: "차감할 수 있는 잔여 횟수가 없습니다. 회원권 횟수를 먼저 확인해 주세요.",
        past_lesson_entitlement_required: "불참 처리에서 생성된 보강 대기를 선택해 주세요.",
        past_lesson_entitlement_unavailable: "선택한 보강 대기가 이미 처리됐거나 회원권과 맞지 않습니다.",
        past_lesson_existing_status_invalid: "예정 상태인 지난 수업만 완료 처리할 수 있습니다. 완료 기록은 정정 삭제 후 다시 등록해 주세요.",
        released_regular_slot_makeup_only: "불참으로 비워진 정규 자리는 보강 수업으로 선택해 주세요.",
        admin_manual_override_reason_required: "강제 처리 사유를 5자 이상 입력해 주세요.",
        admin_manual_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있어 이중 차감을 막았습니다.",
        admin_manual_past_lesson_not_finished: "아직 끝나지 않은 수업은 완료 처리할 수 없습니다.",
        admin_manual_lesson_already_completed: "이미 완료 기록이 있는 수업입니다. 완료 기록을 정정 삭제한 뒤 다시 등록해 주세요.",
      };
      const matchedMessage = Object.entries(messages).find(([code]) => errorText.includes(code))?.[1];
      setLessonFormMessage(matchedMessage || error?.message || "과거 수업 반영에 실패했습니다. 시간표를 새로고침한 뒤 다시 확인해 주세요.", "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  const restorableRegularSlot = getRestorableReleasedRegularSlot(candidate);
  if (!manualOverride && restorableRegularSlot) {
    state.releasedAbsenceEntitlementId = restorableRegularSlot.entitlementId || "";
    await restoreAbsentLessonFromModal();
    return;
  }
  if (!manualOverride) {
    if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) {
      setLessonFormMessage("선택한 수업 종류에 맞는 회원권이 없습니다.", "danger");
      return;
    }
    const conflict = getLessonConflict(candidate);
    if (conflict) {
      setLessonFormMessage(conflict.message, "danger");
      return;
    }
  }

  const regularScheduleValidation = getRegularScheduleValidation(ticket);
  if (!manualOverride && !regularScheduleValidation.valid) {
    setLessonFormMessage(regularScheduleValidation.message, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const selectedSchedules = state.editingLessonId
    ? [{ day: candidate.day, time: candidate.time, lessonDate: candidate.lessonDate }]
    : getSelectedLessonSchedules();
  const scheduleIssueMessage = regularScheduleSaveCheckMessage(ticket, candidate, regularScheduleValidation);
  if (!manualOverride && scheduleIssueMessage) {
    setLessonFormMessage(scheduleIssueMessage, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const scheduleScopeMismatch = selectedSchedules.find((schedule) => !ticketAllowsScheduleDay(ticket, schedule.day));
  if (!manualOverride && scheduleScopeMismatch) {
    setLessonFormMessage(`${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))}은 ${scheduleScopeMismatch.day}요일에 등록할 수 없습니다.`, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const internalConflict = getInternalScheduleConflict(selectedSchedules, candidate.durationMinutes);
  if (internalConflict) {
    setLessonFormMessage(internalConflict.message, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  const candidates = selectedSchedules.map((schedule, index) => getLessonFormCandidate({
    id: state.editingLessonId || Date.now() + index,
    day: schedule.day,
    time: schedule.time,
    ...(schedule.lessonDate ? { lessonDate: schedule.lessonDate } : {}),
    courtId: getAvailableCourtId(schedule.day, schedule.time, candidate.durationMinutes),
  }));
  const blockingConflict = candidates
    .map((item) => ({ item, conflict: getLessonConflict(item) }))
    .find((result) => result.conflict);
  if (!manualOverride && blockingConflict) {
    setLessonFormMessage(`${blockingConflict.item.day}요일 ${blockingConflict.item.time}: ${blockingConflict.conflict.message}`, "danger");
    setLessonSubmitEnabled(false);
    return;
  }
  if (manualOverride) {
    const exactDuplicate = candidates.map((candidate) => getAdminManualExactDuplicate(candidate)).find(Boolean);
    if (exactDuplicate) {
      setLessonFormMessage("같은 회원권·날짜·시간의 수업이 이미 있습니다. 기존 수업을 수정해 주세요.", "danger");
      return;
    }
    const warnings = [...new Set(candidates.flatMap((item) => getAdminManualOverrideWarnings(item, ticket, false)))];
    if (!confirmAdminManualOverride(candidate, warnings)) return;
  }

  if (state.liveScheduleLoaded) {
    const wasEditing = Boolean(state.editingLessonId);
    const assignmentTicketId = state.scheduleAssignmentTicketId;
    const assignmentLessonSource = state.scheduleAssignmentLessonSource;
    state.lessonWriteInFlight = true;
    state.lessonWriteStartedAt = Date.now();
    setLessonSubmitEnabled(false);
    saveScheduleSafetySnapshot(lessons, "before-lesson-write");
    setLessonFormMessage("실서버 시간표에 저장 중입니다.");
    showLessonSaveResultPanel({
      status: "saving",
      title: "서버 저장 중",
      message: "저장 후 시간표 재조회까지 확인합니다.",
      expectedCount: candidates.length,
      confirmedCount: 0,
      missingRows: [],
    });
    try {
      let writeResult = null;
      if (selectedEntitlement && candidates.length !== 1) throw new Error("보강 대기 한 건은 한 시간만 예약할 수 있습니다.");
      if (selectedEntitlement && manualOverride) writeResult = await saveLiveAdminLesson(candidates[0], selectedEntitlement);
      else if (selectedEntitlement) writeResult = await saveLiveMakeupEntitlement(candidates[0], selectedEntitlement);
      else if (wasEditing && selectedLessonEditScope() === "reset") writeResult = await resetLiveAdminRegularSchedule(candidates[0]);
      else if (wasEditing && selectedLessonEditScope() === "series") writeResult = await saveLiveAdminRegularLessonSeries(candidates[0]);
      else if (wasEditing) writeResult = await saveLiveAdminLesson(candidates[0]);
      else if (state.quickLessonEntry) {
        writeResult = liveLessonSource(candidates[0]) === "regular"
          ? await saveLiveAdminRegularScheduleAnchor(candidates[0])
          : await saveLiveAdminLesson(candidates[0]);
      } else {
        const scheduleProtectionMessage = !manualOverride
          ? regularScheduleProtectionMessage(ticket, candidates)
          : "";
        if (scheduleProtectionMessage) {
          setLessonSubmitEnabled(true);
          setLessonFormMessage(scheduleProtectionMessage, "danger");
          clearLessonSaveResultPanel();
          return;
        }
        writeResult = await saveLiveAdminLessonSet(candidates);
      }
      const verificationCandidates = selectedLessonEditScope() === "reset"
        ? [{ ...candidates[0], lessonDate: $("#lessonResetStartOn")?.value || "" }]
        : candidates;
      const synced = await syncAdminLiveData();
      if (!synced) throw new Error("admin_live_refresh_failed_after_write");
      const verificationDetails = liveLessonWriteVerificationDetails(ticket, verificationCandidates);
      const writeVerificationError = liveLessonWriteVerification(ticket, verificationCandidates);
      if (writeVerificationError) throw new Error(writeVerificationError);
      const missingAnchorCount = Number(writeResult?.missingAnchorCount) || 0;
      const assignmentCompleted = assignmentTicketId && String(ticket.id) === String(assignmentTicketId)
        && (assignmentLessonSource !== "regular" || missingAnchorCount === 0);
      const nextAssignmentTicket = assignmentCompleted
        ? advanceScheduleTicketAssignment({ currentTicketId: assignmentTicketId, respectUiFilters: false, render: false, notify: false })
        : null;
      showLessonSaveResultPanel({
        status: "good",
        title: "서버 저장 확인 완료",
        message: "저장 요청과 시간표 반영을 모두 확인했습니다.",
        expectedCount: candidates.length,
        confirmedCount: verificationDetails.expectedLessons.length,
        missingRows: [],
      });
      billingLogs.unshift(`${candidate.member} ${selectedSchedules.map((item) => `${item.day} ${item.time}`).join(", ")} 실서버 수업 저장`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      showToast(nextAssignmentTicket
        ? `저장 완료 · 다음 ${ticketParticipantNames(nextAssignmentTicket).join(" & ") || nextAssignmentTicket.member} 회원을 배정하세요.`
        : assignmentCompleted
          ? "저장 완료 · 정규시간 배정 대기열을 모두 처리했습니다."
          : missingAnchorCount > 0
        ? `정규시간 저장 완료 · 다른 요일/시간 ${missingAnchorCount}개를 추가해 주세요.`
        : manualOverride
          ? "관리자 강제 처리 완료 · 감사 기록 저장"
          : selectedEntitlement ? "보강 예약 완료" : wasEditing ? "수업 수정 완료" : "수업 추가 완료");
    } catch (error) {
      const errorText = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
      if (errorText.includes("lesson_concurrent_update")) {
        await syncAdminLiveData();
      }
      const messages = {
        released_regular_slot_makeup_only: "불참으로 비워진 정규자리에는 보강수업만 등록할 수 있습니다.",
        makeup_entitlement_not_found: "연결할 보강 대기를 찾지 못했습니다. 시간표를 새로고침해 주세요.",
        makeup_entitlement_not_open: "이미 예약되거나 종료된 보강 대기입니다. 시간표를 새로고침해 주세요.",
        makeup_source_lesson_invalid: "원래 불참 수업 상태가 변경됐습니다. 회원의 보강 대기를 다시 확인해 주세요.",
        makeup_booking_forbidden: "이 보강을 예약할 권한이 없습니다.",
        target_time_must_be_future: "일반 보강 예약은 아직 시작하지 않은 시간만 가능합니다. 지난 수업은 과거수업 보정을 사용해 주세요.",
        active_ticket_required: "사용 가능한 잔여 회원권이 없습니다.",
        target_date_outside_ticket: "회원권 사용기간 안의 날짜를 선택해 주세요.",
        lesson_date_outside_ticket: "회원권 사용기간 안의 날짜를 선택해 주세요.",
        schedule_scope_mismatch: "평일권과 주말권의 이용 가능 요일을 확인해 주세요.",
        coach_not_working: "담당 코치의 근무시간 안에서 선택해 주세요.",
        target_time_blocked: "브레이크타임 또는 수업 제한 시간입니다.",
        no_nearby_coach_lesson: "보강 가능 범위 밖의 시간입니다. 인접 수업과의 간격을 확인해 주세요.",
        target_time_occupied: "서버에 이미 등록된 수업이 있습니다. 해당 주차를 최신 상태로 열었습니다.",
        coach_time_occupied: "서버에 이미 등록된 수업이 있습니다. 해당 주차를 최신 상태로 열었습니다.",
        daily_session_limit: "하루 이용 가능 횟수를 초과했습니다.",
        weekly_session_limit: "이번 주 이용 가능 횟수를 초과했습니다.",
        weekly_booking_day_limit: "이번 주 예약 가능 일수를 초과했습니다.",
        lesson_duration_ticket_mismatch: "회원권의 수업시간과 선택한 수업시간이 맞지 않습니다.",
        regular_schedule_pending_change_exists: "처리 중인 수업 변경 요청이 있어 정규시간을 교체할 수 없습니다. 요청을 먼저 처리해 주세요.",
        regular_schedule_count_mismatch: `이 회원권은 주 ${ticket.weeklyCount}회이므로 요일/시간 ${ticket.weeklyCount}개를 모두 선택해 주세요.`,
        regular_schedule_anchor_outside_ticket: "회원권 기간 안의 아직 시작하지 않은 날짜를 선택해 주세요.",
        regular_schedule_anchor_limit_reached: "필요한 정규시간이 이미 모두 등록되어 있습니다. 기존 수업 카드를 눌러 시간을 수정해 주세요.",
        regular_ticket_required: "정규권 회원만 미래 정규일정을 자동 등록할 수 있습니다.",
        regular_schedule_exists_edit_existing: "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.",
        regular_schedule_time_invalid: "회원권 기간 안의 아직 시작하지 않은 시간만 정규시간으로 저장할 수 있습니다.",
        regular_series_lesson_required: "예정된 정규수업만 전체 일정으로 수정할 수 있습니다.",
        regular_series_conflict: "변경할 전체 일정 중 다른 수업과 겹치는 시간이 있습니다.",
        regular_series_outside_ticket: "변경하면 회원권 기간을 벗어나는 수업이 생깁니다. 선택일만 수정하거나 회원권 기간을 먼저 확인해 주세요.",
        regular_schedule_rule_not_found: "연결된 정규 일정 규칙을 찾지 못했습니다. 기존 수업을 새로고침한 뒤 다시 시도해 주세요.",
        regular_reset_start_date_invalid: "오늘 이후의 새 시작일을 선택해 주세요.",
        regular_reset_outside_ticket: "회원권 사용기간 안에서 새 시작일을 선택해 주세요.",
        lesson_concurrent_update: "다른 화면에서 이 수업이 먼저 수정되었습니다. 최신 시간표를 불러왔으니 다시 확인해 주세요.",
        lesson_expected_revision_required: "수업의 최신 상태를 확인할 수 없습니다. 시간표를 새로고침한 뒤 다시 수정해 주세요.",
        operation_key_reused_with_different_payload: "저장 내용이 변경되었습니다. 창을 닫았다가 다시 열어 저장해 주세요.",
        admin_manual_override_reason_required: "강제 처리 사유를 5자 이상 입력해 주세요.",
        admin_manual_exact_duplicate: "같은 회원권·날짜·시간의 수업이 이미 있습니다. 해당 주차에서 기존 수업을 수정해 주세요.",
        admin_manual_ticket_required: "연결할 회원권을 찾지 못했습니다.",
        admin_live_refresh_failed_after_write: "저장 후 서버 시간표를 다시 불러오지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
        live_lesson_write_not_confirmed: "서버 저장 결과를 시간표에서 다시 확인하지 못했습니다. 중복 저장하지 말고 새로고침 후 확인해 주세요.",
      };
      const message = liveLessonWriteFailureMessage(errorText)
        || Object.entries(messages).find(([code]) => errorText.includes(code))?.[1]
        || error?.message
        || "실서버 수업 저장에 실패했습니다.";
      setLessonFormMessage(message, "danger");
      const verificationDetails = liveLessonWriteVerificationDetails(ticket, candidates);
      const isWriteConfirmFailure = errorText.includes("live_lesson_write_not_confirmed")
        || errorText.includes("admin_live_refresh_failed_after_write");
      showLessonSaveResultPanel({
        status: "danger",
        title: isWriteConfirmFailure ? "서버 반영 확인 필요" : "저장 실패",
        message,
        expectedCount: candidates.length,
        confirmedCount: Math.max(0, verificationDetails.expectedLessons.length - verificationDetails.missing.length),
        missingRows: verificationDetails.missing,
        recoverySteps: lessonSaveRecoverySteps(isWriteConfirmFailure),
      });
      setLessonSubmitEnabled(true);
    } finally {
      state.lessonWriteInFlight = false;
      state.lessonWriteStartedAt = 0;
    }
    return;
  }

  if (!adminDemoMode) {
    setLessonFormMessage("실서버 시간표 연결을 확인하기 전에는 수업을 저장할 수 없습니다. 새로고침 후 다시 시도해 주세요.", "danger");
    setLessonSubmitEnabled(true);
    return;
  }

  const existingIndex = lessons.findIndex((lesson) => lesson.id === state.editingLessonId);
  if (existingIndex >= 0) {
    lessons.splice(existingIndex, 1, candidates[0]);
    billingLogs.unshift(`${candidate.member} ${candidate.day} ${candidate.time} ${lessonTypeLabel(candidate)} 수업 수정`);
  } else {
    lessons.push(...candidates);
    billingLogs.unshift(`${candidate.member} ${selectedSchedules.map((item) => `${item.day} ${item.time}`).join(", ")} ${lessonTypeLabel(candidate)} 수업 추가`);
  }
  lessons.sort((a, b) => scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || timeToMinutes(a.time) - timeToMinutes(b.time));
  if (state.scheduleAssignmentTicketId && String(ticket.id) === String(state.scheduleAssignmentTicketId)) {
    clearScheduleTicketAssignment(false);
  }
  window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  closeLessonModal();
  setView("schedule");
  renderAll();
}

async function deleteEditingLesson() {
  if (operationsRole() !== "admin") {
    setLessonFormMessage("관리자만 수업을 강제 삭제할 수 있습니다.", "danger");
    return;
  }
  const lesson = adminForceDeleteLessonTarget();
  if (!lesson) {
    setLessonFormMessage("현재 조건에서 삭제할 기존 수업이 없습니다.", "danger");
    return;
  }
  if (state.liveScheduleLoaded && lesson.serverLessonId) {
    const confirmationMessage = `${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 수업을 강제 삭제할까요?\n\n완료·불참·보강·과거 수업도 제거하며 차감 횟수는 복원합니다. 삭제 사실은 감사 기록에 남습니다.`;
    if (!window.confirm(confirmationMessage)) return;
    setLessonSubmitEnabled(false);
    setLessonFormMessage("차감 횟수를 복원하고 수업을 강제 삭제하는 중입니다.");
    try {
      const result = await window.TennisNoteDataClient.rpc("tn_admin_force_delete_lesson", {
        target_lesson_id: lesson.serverLessonId,
        target_reason: "관리자 수업 강제 삭제",
      });
      const restoredSessions = Number(result?.restoredSessions || 0);
      billingLogs.unshift(`${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 강제 삭제 · ${restoredSessions}회 복원`);
      window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
      closeLessonModal();
      setView("schedule");
      await syncAdminLiveData();
      showToast(`수업 강제 삭제 완료 · ${restoredSessions}회 복원`);
    } catch (error) {
      const message = `${error?.payload?.message || ""} ${error?.message || ""}`;
      const friendlyMessage = message.includes("lesson_correction_ticket_inconsistent")
        ? "회원권 횟수와 완료 기록이 맞지 않아 자동 복원을 중단했습니다. 관리자 데이터 확인이 필요합니다."
        : message.includes("tn_admin_force_delete_lesson") || message.includes("PGRST202")
            ? "강제 삭제 DB 기능을 먼저 적용해 주세요."
            : "실서버 수업 강제 삭제에 실패했습니다.";
      setLessonFormMessage(friendlyMessage, "danger");
      setLessonSubmitEnabled(true);
    }
    return;
  }
  const index = lessons.findIndex((item) => item.id === lesson.id);
  if (index >= 0) lessons.splice(index, 1);
  billingLogs.unshift(`${getLessonMembersLabel(lesson)} ${lesson.day} ${lesson.time} 강제 삭제`);
  window.TennisNoteInputGuard?.markSaved?.("#lessonModal");
  closeLessonModal();
  setView("schedule");
  renderAll();
}

async function reviewAdminLessonChangeRequest(requestId, decision, button) {
  const request = makeupRequests.find((item) => String(item.serverRequestId || item.id) === String(requestId || ""));
  if (!request || request.status !== "pending") {
    showToast("이미 처리되었거나 요청을 찾을 수 없습니다. 시간표를 새로고침해 주세요.");
    return;
  }
  if (decision === "rejected" && !window.confirm(`${request.member}님의 변경 요청을 거절할까요? 원래 수업은 그대로 유지되고 회원권은 차감되지 않습니다.`)) return;
  const originalLabel = button?.textContent || "처리";
  if (button) {
    button.disabled = true;
    button.textContent = "처리 중";
  }
  try {
    await window.TennisNoteDataClient.rpc("tn_review_lesson_change_request", {
      target_request_id: request.serverRequestId,
      target_decision: decision,
      target_note: decision === "rejected" ? "관리자 승인 불가" : null,
    });
    await syncAdminLiveData();
    renderAdminView("schedule");
    showToast(decision === "approved" ? "수업 변경을 승인했습니다." : "수업 변경 요청을 거절했습니다.");
  } catch (error) {
    const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
    const messages = {
      request_not_pending: "다른 사용자가 먼저 처리했습니다. 새로고침합니다.",
      effective_coach_or_admin_required: "현재 담당 코치 또는 관리자만 처리할 수 있습니다.",
      target_time_occupied: "요청한 시간에 다른 수업이 생겼습니다. 회원에게 새 시간을 요청해 주세요.",
      target_effective_coach_unavailable: "현재 담당 코치가 요청한 시간에 근무하지 않습니다.",
    };
    const key = Object.keys(messages).find((candidate) => code.includes(candidate));
    showToast(messages[key] || `변경 요청 처리 실패: ${code}`);
    await syncAdminLiveData();
    renderAdminView("schedule");
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

function updateLessonRecordCurriculumLink() {
  const selectedId = $("#lessonRecordCurriculum")?.value || "";
  const curriculum = adminCurriculumChoices().find((item) => item.value === selectedId);
  const link = $("#lessonRecordCurriculumLink");
  if (!link) return;
  link.hidden = selectedLessonRecordOutcome().startsWith("no_show") || !curriculum?.notionUrl;
  link.href = curriculum?.notionUrl || "#";
}

async function saveLessonRecord(event) {
  event.preventDefault();
  if (lessonRecordEditorState.saving) return;
  const comment = $("#lessonRecordComment").value.trim();
  const curriculumId = $("#lessonRecordCurriculum").value;
  const outcomeValue = selectedLessonRecordOutcome();
  const noShow = outcomeValue.startsWith("no_show");
  const deduct = outcomeValue.endsWith("_deduct");
  const message = $("#lessonRecordMessage");
  if (comment.length < (noShow ? 2 : 5) || (!noShow && !curriculumId)) {
    message.textContent = comment.length < (noShow ? 2 : 5)
      ? noShow ? "노쇼 사유를 2자 이상 작성해 주세요." : "코치 코멘트를 5자 이상 작성해 주세요."
      : "다음 커리큘럼을 선택해 주세요.";
    return;
  }
  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !operationsAccessReady()) {
    message.textContent = "대표 관리자 계정 로그인 상태를 확인해 주세요.";
    return;
  }
  lessonRecordEditorState.saving = true;
  const button = $("#saveLessonRecordButton");
  button.disabled = true;
  button.textContent = "서버 저장 중";
  message.textContent = "";
  try {
    const curriculumRefId = noShow ? null : await ensureAdminCurriculumRef(curriculumId);
    const result = await client.rpc("tn_process_lesson_outcome", {
      target_lesson_id: lessonRecordEditorState.lessonId,
      target_outcome: noShow ? "no_show" : "completed",
      target_deduct: deduct,
      target_note: comment,
      target_next_curriculum_ref_id: curriculumRefId,
      target_member_journal_id: lessonRecordEditorState.journalId || null,
    });
    window.TennisNoteInputGuard?.markSaved?.("#lessonRecordModal");
    closeLessonRecordModal();
    state.recordFilter = "done";
    await syncAdminLiveData();
    setView("notes", { skipLock: true });
    showToast(result?.idempotent ? "이미 처리된 수업을 확인했습니다." : `${noShow ? "노쇼" : "수업 완료"} 처리와 ${deduct ? "횟수 차감" : "미차감 기록"}이 저장됐습니다.`);
  } catch (error) {
    message.textContent = lessonRecordErrorMessage(error);
  } finally {
    lessonRecordEditorState.saving = false;
    button.disabled = false;
    syncLessonRecordOutcomeUi();
  }
}

async function saveLivePastLessonAbsenceCorrection() {
  const client = window.TennisNoteDataClient;
  const editingLesson = getCurrentEditingLesson();
  const candidate = getLessonFormCandidate();
  const ticket = getSelectedTicket();
  const coach = coaches.find((item) => item.id === candidate.coachId || item.serverRoleId === candidate.coachId);
  const lessonDate = adminWeekDateForDay(candidate.day);
  const correctionReason = adminPastCorrectionReason();
  if (!client?.rpc || operationsRole() !== "admin" || !adminApprovalReady()) {
    throw new Error("관리자 로그인이 필요합니다.");
  }
  if (!editingLesson?.serverLessonId && (!ticket?.serverTicketId || !coach?.serverRoleId || !lessonDate || !candidate.time)) {
    throw new Error("past_absence_slot_required");
  }
  return client.rpc("tn_admin_record_past_regular_absence", {
    target_lesson_id: editingLesson?.serverLessonId || null,
    target_ticket_id: ticket?.serverTicketId || null,
    target_coach_role_id: coach?.serverRoleId || null,
    target_lesson_date: lessonDate || null,
    target_start_time: candidate.time || null,
    target_duration_minutes: Number(candidate.durationMinutes) || 20,
    target_reason: correctionReason,
  });
}

function resetScheduleEntryState() {
  // The saved browser snapshot may contain a coach-only or pending-only view.
  // A first visit must always start from the full weekly timetable instead.
  state.scheduleView = "week";
  state.scheduleFilter = "all";
  state.scheduleCoachFilter = "all";
  state.activeAdminWeekIndex = 0;
  state.selectedScheduleDay = currentScheduleDay();
  scheduleSessionInitialized = true;
}

function resetScheduleV2IntegrityPreview() {
  scheduleV2IntegrityPreviewState = {
    branchId: "",
    ticketIds: [],
    plannedLessonCount: 0,
    plannedUnits: 0,
  };
  const applyButton = $("#scheduleV2IntegrityApplyButton");
  if (applyButton) applyButton.disabled = true;
}

async function applyScheduleV2IntegrityPreview() {
  const client = window.TennisNoteDataClient;
  const preview = scheduleV2IntegrityPreviewState;
  if (!client?.rpc || operationsRole() !== "admin" || !preview.ticketIds.length) return false;
  if (preview.branchId !== activeOperationBranchId()) {
    resetScheduleV2IntegrityPreview();
    showToast("운영 지점이 바뀌었습니다. 다시 점검해 주세요.");
    return false;
  }
  const approved = window.confirm(
    `확정 가능한 회원권 ${preview.ticketIds.length}개의 미래 수업 ${preview.plannedLessonCount}건을 생성할까요?\n\n요일·시간 누락과 충돌 항목은 변경하지 않습니다.`,
  );
  if (!approved) return false;
  const applyButton = $("#scheduleV2IntegrityApplyButton");
  if (applyButton) applyButton.disabled = true;
  try {
    const result = await client.rpc("tn_admin_reconcile_future_regular_schedules", {
      target_branch_id: preview.branchId,
      target_ticket_ids: preview.ticketIds,
      target_operation_key: `future-regular-apply-${Date.now()}`,
      target_dry_run: false,
    });
    if (!result?.ok || Number(result.remainingUnassignedUnits) !== 0) {
      throw new Error("future_regular_reconcile_incomplete");
    }
    await syncAdminLiveData(true, { abortIfDirty: true });
    showToast(`미래 수업 ${Number(result.createdCount) || 0}건을 생성했습니다.`);
    await previewScheduleV2Integrity();
    return true;
  } catch (error) {
    showToast("미래 수업을 생성하지 못했습니다. 데이터는 서버에서 다시 확인해 주세요.");
    await previewScheduleV2Integrity();
    return false;
  }
}
