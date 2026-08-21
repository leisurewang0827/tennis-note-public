// members 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function currentMemberName() {
  return normalizeMemberName(state.member?.name || state.profile?.name || "");
}

function adminMemberScheduleLessons() {
  const snapshot = readAdminSnapshot();
  if (!snapshot || !Array.isArray(snapshot.lessons)) return [];
  return snapshot.lessons
    .map((lesson) => normalizeAdminLessonForMember(lesson, snapshot))
    .filter(Boolean);
}

function activeMemberWeek() {
  const offset = Math.min(
    Math.max(Number(state.activeMemberWeekIndex) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  state.activeMemberWeekIndex = offset;
  return memberScheduleWeekForOffset(offset);
}

function ensureMemberScheduleLesson(lessonId) {
  let lesson = lessons.find((item) => item.id === lessonId);
  if (lesson) return lesson;
  const weekLesson = memberMakeupDueLessons().find((item) => item.id === lessonId)
    || currentScheduledLessonsForChange().find((item) => item.id === lessonId)
    || memberScheduleOptions().find((item) => item.id === lessonId);
  if (!weekLesson) return null;
  lesson = { ...weekLesson };
  lessons.push(lesson);
  return lesson;
}

function upcomingMemberLessons(limit = 2, ticketId = "") {
  if (state.dataMode === "live" || state.liveLessonsLoaded) {
    const today = localDateKey();
    const now = new Date();
    return (state.liveLessons || [])
      .filter((lesson) => {
        const isMine = isOwnMemberScheduleLesson(lesson);
        return isMine
          && lesson.status === "scheduled"
          && lesson.lessonDate
          && lesson.lessonDate >= today
          && memberLessonPriority(lesson, now).group < 2
          && (!ticketId || memberLessonTicketId(lesson) === String(ticketId));
      })
      .sort((left, right) => compareMemberLessonsByNearest(left, right, now))
      .slice(0, limit);
  }
  const dayOrder = new Map(days.map((day, index) => [day, index]));
  return memberLessons()
    .filter((lesson) => lesson.status === "scheduled")
    .sort((a, b) => {
      const dayDiff = (dayOrder.get(a.day) ?? 99) - (dayOrder.get(b.day) ?? 99);
      return dayDiff || minutesFromTime(a.time) - minutesFromTime(b.time);
    })
    .slice(0, limit);
}

function latestMemberFeedbackLog() {
  return [...state.lessonLogs]
    .filter((log) => log.status === "confirmed" && (log.coachComment || log.memberVisibleSummary || log.ticketDeducted))
    .sort((left, right) => String(right.submittedAt || right.journalDate || "").localeCompare(String(left.submittedAt || left.journalDate || "")))[0] || null;
}

function pendingMemberFeedbackLog() {
  return [...state.lessonLogs]
    .filter((log) => ["coach_pending", "uploading", "server_error"].includes(log.status))
    .sort((left, right) => String(right.submittedAt || right.journalDate || "").localeCompare(String(left.submittedAt || left.journalDate || "")))[0] || null;
}

function selectedMemberScheduleDay() {
  if (!days.includes(state.selectedScheduleDay)) state.selectedScheduleDay = currentMemberScheduleDay();
  return state.selectedScheduleDay;
}

function filteredMemberCurriculumTracks() {
  const query = String(state.curriculumQuery || "").trim().toLowerCase();
  const filter = state.curriculumFilter || "all";
  return curriculumSkillTracks
    .map((track) => {
      const matchesTrack = !query || `${track.id || ""} ${track.title} ${track.category || ""} ${track.summary || ""}`.toLowerCase().includes(query);
      const steps = track.steps.filter((step) => {
        const matchesFilter = memberCurriculumMatchesFilter(filter, step.category || track.category);
        const text = `${step.id} ${step.title} ${step.level || ""} ${step.focus || ""} ${step.guide || ""}`.toLowerCase();
        return matchesFilter && (matchesTrack || !query || text.includes(query));
      });
      return { ...track, steps };
    })
    .filter((track) => track.steps.length > 0);
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

function rejectMemberScheduleIdentity(issue, integrity = null) {
  state.scheduleV2SyncStatus = "error";
  state.scheduleV2SyncErrorCode = issue?.code || "member_schedule_identity_error";
  state.scheduleV2SyncError = issue?.message || "회원 연결을 확인해야 시간표를 불러올 수 있습니다.";
  state.scheduleV2Integrity = integrity;
  state.liveLessonsLoaded = true;
  renderMemberRuntimeDiagnostics();
  return false;
}

function activeMemberScheduleLoadState() {
  if (state.dataMode !== "live" || !state.member?.profileId) return "ready";
  const activeKey = memberScheduleV2Context().key;
  if (state.scheduleV2TargetKey === activeKey && state.scheduleV2SyncStatus === "loading") return "loading";
  if (state.scheduleV2TargetKey === activeKey && state.scheduleV2SyncStatus === "error") return "error";
  if (state.scheduleV2LoadedKey === activeKey) return "ready";
  return state.scheduleV2WorkspaceLoaded ? "ready" : "loading";
}

function mapServerMemberChangeCandidate(candidate = {}, source = null) {
  const lessonDate = String(candidate.lessonDate || "");
  const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
  const time = String(candidate.startTime || "").slice(0, 5);
  const coachRoleId = candidate.coachRoleId || source?.coachRoleId || source?.coach_role_id || "";
  const rawAnchorGap = candidate.anchorGapMinutes !== undefined
    ? candidate.anchorGapMinutes
    : state.serverChangeAnchorGapMinutes;
  return {
    id: `server-change-slot-${source?.serverLessonId || "lesson"}-${coachRoleId || "coach"}-${lessonDate}-${time}`,
    day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
    time,
    coach: source?.coach || "담당 코치",
    coachRoleId,
    coach_role_id: coachRoleId,
    lessonDate,
    member: "",
    type: source?.couponBooking ? "쿠폰 예약 가능" : "수업 변경 신청가능",
    status: "available",
    policy: candidate.policy || "coach",
    policySnapshot: candidate.policySnapshot || state.serverChangePolicySnapshot || null,
    anchorGapMinutes: rawAnchorGap === null ? null : Math.max(0, Number(rawAnchorGap) || 40),
    generated: true,
    authoritativeCandidate: true,
    couponBooking: Boolean(source?.couponBooking),
    durationMinutes: Number(candidate.durationMinutes) || lessonDuration(source),
    member_ticket_id: source?.member_ticket_id || source?.ticketId || "",
    ticketId: source?.member_ticket_id || source?.ticketId || "",
  };
}

function mergeScheduleV2MemberRecords(mappedLessons = []) {
  mappedLessons
    .filter((lesson) => {
      const record = lesson.participantRecord;
      if (!lesson.isOwnLesson || record?.recordStatus !== "final") return false;
      return Boolean(record.coachComment) || ["completed", "no_show"].includes(record.outcome);
    })
    .forEach((lesson) => {
      const record = lesson.participantRecord;
      const existingIndex = state.lessonLogs.findIndex((log) => (
        String(log.serverLessonId || "") === String(lesson.serverLessonId || "")
      ));
      const existing = existingIndex >= 0 ? state.lessonLogs[existingIndex] : {};
      const nextCurriculumId = record.nextCurriculumSkillLabel || existing.nextCurriculumId || "FH-01";
      const curriculum = curriculumById(nextCurriculumId, existing.curriculum || curriculumSteps[0]);
      const outcomeText = record.outcome === "no_show" ? "노쇼 처리" : "코치 수업기록";
      const log = {
        ...existing,
        id: existing.id || `schedule-v2-record-${lesson.serverLessonId}`,
        serverJournalId: existing.serverJournalId || "",
        serverLessonId: lesson.serverLessonId,
        lessonId: existing.lessonId || lesson.id,
        lessonLabel: existing.lessonLabel || `${lesson.day} ${lesson.time} · ${lesson.coach}`,
        round: Number(existing.round) || Math.max(1, Number(lesson.ticketUsedSessions) || lessonRound()),
        journalDate: existing.journalDate || lesson.lessonDate,
        content: existing.content || `회원 운동일지 미작성 · ${outcomeText}`,
        selfMemo: existing.selfMemo || "회원 운동일지 미작성",
        mediaNames: existing.mediaNames || [],
        mediaItems: existing.mediaItems || [],
        status: "confirmed",
        curriculum,
        nextCurriculumId,
        coachComment: record.coachComment || existing.coachComment || "",
        memberVisibleSummary: record.nextGoal
          ? `다음 수업 목표: ${record.nextGoal}`
          : record.nextCurriculumTitle
            ? `다음 수업: ${record.nextCurriculumTitle}`
            : existing.memberVisibleSummary || "",
        ticketDeducted: Number(record.deductedSessions) > 0,
        participantOutcome: record.outcome,
        submittedAt: record.finalizedAt || existing.submittedAt || `${lesson.lessonDate}T${lesson.time}:00`,
      };
      if (existingIndex >= 0) state.lessonLogs[existingIndex] = log;
      else state.lessonLogs.unshift(log);
    });
}

function openProfileEditor(focusNtrp = false) {
  openAppSheet("profileEditorSheet", {
    initialFocus: focusNtrp ? "#profileSelfNtrp" : "",
  });
}

function navigateMemberView(viewId) {
  if (purchaseFlowState().open && viewId !== "shopView") {
    closeMembershipPurchaseFlow({ fromHistory: true, skipScroll: true });
    setView(viewId, { replaceHistory: true });
    return;
  }
  setView(viewId, { pushHistory: true });
}

function filteredMemberHelpEntries() {
  const query = memberHelpQuery.trim().toLowerCase();
  return memberHelpEntries.filter((entry) => (
    (memberHelpCategory === "all" || entry.category === memberHelpCategory)
    && (!query || `${entry.question} ${entry.answer}`.toLowerCase().includes(query))
  ));
}

function changeMemberWeek(delta) {
  state.activeMemberWeekIndex = Math.min(
    Math.max((Number(state.activeMemberWeekIndex) || 0) + delta, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  refreshSelectedMemberScheduleWeek();
}

function selectMemberWeekOffset(offset) {
  state.activeMemberWeekIndex = Math.min(
    Math.max(Number(offset) || 0, memberScheduleMinWeekOffset),
    memberScheduleMaxWeekOffset,
  );
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
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
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
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
  saveSnapshot();
  refreshSelectedMemberScheduleWeek();
}

function changeMemberScheduleTimeRange(range) {
  state.scheduleTimeRange = range || "lesson";
  renderSchedule();
  renderSelects();
  renderAvailableSlots();
  saveSnapshot();
}

async function changeMemberScheduleMode(mode) {
  state.memberScheduleMode = ["availability", "flex"].includes(mode) ? "availability" : "mine";
  state.memberScheduleModeTouched = true;
  state.memberScheduleFullView = state.memberScheduleMode === "availability";
  if (state.memberScheduleMode === "availability") {
    renderSchedule();
    const preferredSourceId = await prepareChangeRequestSource(state.selectedMemberChangeSourceId);
    const sources = memberInlineChangeSources();
    if (preferredSourceId && sources.some((lesson) => lesson.id === preferredSourceId)) {
      state.selectedMemberChangeSourceId = preferredSourceId;
    }
    if (!sources.some((lesson) => lesson.id === state.selectedMemberChangeSourceId)) {
      state.selectedMemberChangeSourceId = "";
    }
  }
  renderSchedule();
  renderSelects();
  if (state.memberScheduleMode === "availability") {
    const source = memberInlineChangeSources().find((lesson) => lesson.id === state.selectedMemberChangeSourceId);
    await syncMemberChangeCandidates(source);
  }
  saveSnapshot();
}

function identityProfileComplete() {
  const name = normalizeIdentityText(state.profile?.name || "");
  const nickname = normalizeIdentityText(state.profile?.nickname || "");
  const phone = normalizeIdentityPhone(state.profile?.phone || "");
  const birthYear = Number(state.profile?.birthYear) || 0;
  const gender = String(state.profile?.gender || "");
  return Boolean(
    name
      && name !== "가입 확인 중"
      && nickname.length >= 2
      && phone.length >= 10
      && birthYear >= 1900
      && birthYear <= new Date().getFullYear()
      && ["female", "male", "other", "prefer_not"].includes(gender)
      && state.profile?.profileCompletedAt
      && state.profile?.privacyConsentVersion === identityPrivacyVersion,
  );
}
