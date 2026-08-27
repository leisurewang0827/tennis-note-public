// schedule 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberScheduleOptions() {
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedId = state.selectedMemberChangeSourceId || $("#absenceLesson")?.value;
  const sourceLessons = memberMakeupDueLessons().concat(
    scheduleLessons.filter((lesson) => memberLessonCanRequestChange(lesson)),
    loadedFutureScheduledLessonsForChange(),
    memberBookableCouponTickets(),
    memberBookableRegularTickets(),
    memberBookablePausedTickets(),
  );
  const selectedLesson = sourceLessons.find((lesson) => lesson.id === selectedId) || null;
  const candidateState = memberChangeCandidateLoadState(selectedLesson);
  const generated = memberHasPendingPaymentOnly()
    ? []
    : candidateState === "ready"
      ? state.serverChangeCandidates.filter(memberChangeCandidateInActiveWeek)
      : ["loading", "error"].includes(candidateState)
        ? []
        : memberChangeUsesServerCandidates(selectedLesson) && candidateState !== "fallback"
          ? []
          : generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson);
  const assignedCoachIds = memberAssignedCoachRoleIds();
  const initialCoachSelection = Boolean(selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId);
  const visibleGenerated = memberUniqueAvailableSlots(generated.filter((lesson) => {
    if (lesson.status !== "available") return true;
    const roleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
    return Boolean(roleId) && (initialCoachSelection || assignedCoachIds.has(roleId));
  }));
  return scheduleLessons.concat(visibleGenerated);
}

function memberAvailableSlotsForSelectedLesson() {
  const selectedId = state.selectedMemberChangeSourceId || $("#absenceLesson")?.value;
  const policy = loadAdminSchedulePolicy();
  const scheduleLessons = memberScheduleLessons();
  const selectedLesson = scheduleLessons.find((lesson) => lesson.id === selectedId) || currentScheduledLessonsForChange().find((lesson) => lesson.id === selectedId);
  const candidateState = memberChangeCandidateLoadState(selectedLesson);
  const generated = candidateState === "ready"
    ? state.serverChangeCandidates
    : memberChangeUsesServerCandidates(selectedLesson) && candidateState !== "fallback"
      ? []
      : generatedMemberAvailableSlots(scheduleLessons, policy, selectedLesson);
  const options = scheduleLessons.concat(generated);
  const selectedCoachId = selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId
    ? ""
    : selectedLesson ? memberLessonCoach(selectedLesson, loadAdminSchedulePolicy()).id : "";
  const assignedCoachIds = memberAssignedCoachRoleIds();
  const initialCoachSelection = Boolean(selectedLesson?.regularInitialBooking && !selectedLesson.coachRoleId);
  return memberUniqueAvailableSlots(options.filter((lesson) => {
    if (lesson.status !== "available") return false;
    if (!memberChangeCandidateInActiveWeek(lesson)) return false;
    const lessonCoachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "").trim();
    if (!lessonCoachRoleId || (!initialCoachSelection && !assignedCoachIds.has(lessonCoachRoleId))) return false;
    if (!selectedCoachId) return true;
    return memberLessonCoach(lesson, loadAdminSchedulePolicy()).id === selectedCoachId;
  }));
}

function memberMobileScheduleSegments(day, policy, baseLessons, scheduleLessons = []) {
  const candidateWindows = scheduleLessons
    .filter((lesson) => lesson.day === day && lesson.status === "available")
    .map((lesson) => ({
      start: lesson.time,
      end: timeFromMinutes(minutesFromTime(lesson.time) + Math.max(10, lessonDuration(lesson))),
    }));
  if (state.memberScheduleMode === "availability") {
    const focusWindows = scheduleLessons
      .filter((lesson) => (
        lesson.day === day
        && (lesson.status === "available" || isOwnMemberScheduleLesson(lesson))
      ))
      .map((lesson) => {
        const start = Math.max(0, minutesFromTime(lesson.time) - 20);
        const end = Math.min(24 * 60, minutesFromTime(lesson.time) + lessonDuration(lesson) + 20);
        return { start: timeFromMinutes(start), end: timeFromMinutes(end) };
      });
    const compactWindows = mergeMemberScheduleWindows(focusWindows);
    if (compactWindows.length) return compactWindows;
  }
  const windows = mergeMemberScheduleWindows([
    ...memberOperatingWindows(day, policy),
    ...candidateWindows,
  ]);
  const range = "all";
  if (range === "morning") return windows.filter((window) => window.startMinutes < minutesFromTime("17:00"));
  if (range === "evening") return windows.filter((window) => window.endMinutes > minutesFromTime("17:00"));
  if (range === "all") return windows;
  const focusLesson = baseLessons.find((lesson) => lesson.day === day && isOwnMemberScheduleLesson(lesson))
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

function selectAvailableSlot(lessonId) {
  const lesson = memberScheduleOptions().find((item) => item.id === lessonId && item.status === "available");
  if (!lesson) return;
  const source = currentScheduledLessonsForChange().find((item) => item.id === $("#absenceLesson")?.value);
  if (source?.regularInitialBooking) {
    const requiredCount = Math.max(1, Number(source.frequencyPerWeek) || 1);
    const selected = [...state.regularInitialSelections];
    const existingIndex = selected.indexOf(lessonId);
    if (existingIndex >= 0) {
      selected.splice(existingIndex, 1);
    } else {
      const differentCoachSelected = selected.some((id) => {
        const selectedLesson = memberScheduleOptions().find((item) => item.id === id);
        return String(selectedLesson?.coachRoleId || "") !== String(lesson.coachRoleId || "");
      });
      if (differentCoachSelected) selected.splice(0, selected.length);
      if (selected.length >= requiredCount) selected.shift();
      selected.push(lessonId);
    }
    state.regularInitialSelections = selected;
  }
  $("#makeupSlot").value = lesson.id;
  renderAvailableSlots();
  void openChangeRequestModal(source?.id || "", { editing: Boolean(state.editingChangeRequestId) });
}

async function prepareChangeRequestSource(preferredLessonId = "") {
  let sources = currentScheduledLessonsForChange();
  let futureLessons = loadedFutureScheduledLessonsForChange();
  const alreadyAvailableSource = sources.find((lesson) => lesson.id === preferredLessonId);
  if (alreadyAvailableSource?.couponBooking) return alreadyAvailableSource.id;
  const hasFalseInitialSource = sources.some((lesson) => lesson.regularInitialBooking) && !futureLessons.length;
  const preferredSourceMissing = Boolean(preferredLessonId) && !sources.some((lesson) => lesson.id === preferredLessonId);
  const workspaceNeedsRefresh = !memberScheduleV2WorkspaceCache?.workspace
    || !state.scheduleV2WorkspaceLoaded
    || activeMemberScheduleLoadState() !== "ready"
    || hasFalseInitialSource
    || preferredSourceMissing;
  if (workspaceNeedsRefresh && state.dataMode === "live" && state.member?.profileId) {
    memberScheduleV2WorkspaceCache = null;
    await syncMemberScheduleV2(state.profile, { force: true });
    sources = currentScheduledLessonsForChange();
    futureLessons = loadedFutureScheduledLessonsForChange();
  }

  const selectedSourceId = preferredLessonId || $("#absenceLesson")?.value || "";
  if (!selectedSourceId) return "";
  const selectedSource = sources.find((lesson) => lesson.id === selectedSourceId);
  if (selectedSource && !selectedSource.regularInitialBooking) return selectedSource.id;

  const preferredFuture = futureLessons.find((lesson) => lesson.id === selectedSourceId);
  const nextFuture = preferredFuture;
  if (!nextFuture) return selectedSource?.id || "";
  return nextFuture.id;
}
