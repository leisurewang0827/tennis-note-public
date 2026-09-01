// 요청 목록과 수업 상세 시트를 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderRequests() {
  syncMakeupRequestsFromCoach();
  const bookedMakeupRequests = state.liveMakeupEntitlements
    .filter((entitlement) => entitlement.status === "booked" && entitlement.bookedLessonId)
    .map((entitlement) => {
      const bookedLesson = state.liveLessons.find((lesson) => lesson.serverLessonId === entitlement.bookedLessonId) || {};
      return {
        id: `booked-${entitlement.id}`,
        serverEntitlementId: entitlement.id,
        absence: `${entitlement.lessonDate} ${entitlement.time} 불참 수업`.trim(),
        makeup: `${bookedLesson.lessonDate || ""} ${bookedLesson.time || ""} 보강 예약`.trim(),
        reason: entitlement.reason || "",
        policy: "예약 시간을 잘못 선택했다면 수업 시작 전 취소할 수 있습니다.",
        status: "보강 예약 완료",
        cancelable: Boolean(bookedLesson.lessonDate && bookedLesson.time),
        cancelKind: "makeup",
      };
    });
  const visibleRequests = [...state.makeupRequests, ...bookedMakeupRequests]
    .sort((left, right) => String(right.createdAt || right.makeup || "").localeCompare(String(left.createdAt || left.makeup || "")));
  if ($("#requestCount")) $("#requestCount").textContent = `${visibleRequests.length}건`;
  if (!$("#makeupRequests")) return;
  $("#makeupRequests").innerHTML =
    visibleRequests
      .map(
        (request) => `
          <article class="request-card ${request.rawStatus === "pending" ? "is-pending" : ""}">
            <b>${request.status}</b>
            <strong>${request.rawStatus === "rejected" ? "기존 수업 유지" : request.rawStatus === "pending" ? "변경 확인 중" : "변경된 수업"}</strong>
            <span>${request.absence} → ${request.makeup}</span>
            ${request.reason ? `<small>이유: ${request.reason}</small>` : ""}
            <small>${request.rawStatus === "pending" ? "승인 전까지 기존 수업은 그대로 유지됩니다." : request.policy || ""}</small>
            ${request.editable ? `
              <button class="small-button" type="button" data-edit-change-request="${request.serverRequestId}">요청 수정</button>
            ` : ""}
            ${request.cancelable ? `
              <button
                class="small-button"
                type="button"
                data-cancel-${request.cancelKind === "makeup" ? "makeup-booking" : "change-request"}="${request.cancelKind === "makeup" ? request.serverEntitlementId : request.serverRequestId}"
              >예약 취소</button>
            ` : ""}
          </article>`,
      )
      .join("") || memberEmptyState({
        title: "수업 변경 요청이 없습니다",
        reason: "변경이 필요하면 내 수업에서 가능한 시간을 선택해 주세요.",
        action: { label: "시간표 보기", homeAction: "makeup", primary: false },
        compact: true,
      });
}

function renderLessonDetailSheet(lesson) {
  if (!lesson) return;
  const info = lessonDetailStatusInfo(lesson);
  const roundLabel = memberScheduleRoundLabel(lesson, true);
  const duration = Number(lesson.durationMinutes) || lessonDuration(lesson);
  const primaryButton = $("#lessonDetailPrimaryAction");
  const absenceButton = $("#lessonDetailAbsenceAction");
  const journalButton = $("#lessonDetailJournalAction");
  const isPastOrToday = Boolean(lesson.lessonDate && lesson.lessonDate <= localDateKey());
  const canWriteJournal = isPastOrToday || ["completed", "no_show"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase());

  $("#lessonDetailStatus").textContent = info.label;
  $("#lessonDetailDateTime").textContent = lessonDetailDateTimeLabel(lesson);
  $("#lessonDetailCoach").textContent = memberCoachShortName(lesson.coach || "담당 코치");
  $("#lessonDetailType").textContent = `${lesson.type || memberLessonTitle(lesson, true)} · ${duration}분`;
  $("#lessonDetailRound").textContent = roundLabel || "회차 확인";
  $("#lessonDetailMessage").textContent = info.message;

  primaryButton.hidden = !info.primaryAction;
  primaryButton.dataset.lessonDetailAction = info.primaryAction;
  primaryButton.textContent = info.primaryAction === "makeup" ? "보강 시간 선택" : "수업 변경 요청";
  absenceButton.hidden = !info.absenceAction;
  absenceButton.disabled = false;
  absenceButton.dataset.lessonDetailAction = info.absenceAction || "";
  absenceButton.textContent = info.absenceActionLabel || "오늘 못 가요";
  journalButton.hidden = !canWriteJournal;
  journalButton.dataset.lessonDetailAction = "journal";
}
